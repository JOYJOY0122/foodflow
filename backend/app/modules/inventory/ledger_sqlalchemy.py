"""StockLedger 的 SQLAlchemy 實作。只 flush，交易邊界在 Service（AD-6）。"""

from collections.abc import Iterable, Sequence
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, SessionTransaction

from app.core.db import for_update
from app.core.enums import TransactionType
from app.core.errors import flush_or_raise
from app.db.models import (
    BatchLocationChange,
    GoodsReceipt,
    GoodsReceiptItem,
    InventoryBatch,
    InventoryTransaction,
)
from app.modules.inventory.ledger import (
    BatchNotLockedError,
    StockLedger,
    StockOp,
    apply_move,
    apply_quantity_change,
    batch_from_item,
    require_deduct_type,
    require_non_negative_quantity,
    require_positive_quantity,
    require_reversible,
)


class SqlAlchemyStockLedger(StockLedger):
    def __init__(self, session: Session) -> None:
        self._session = session
        self._locked_ids: set[int] = set()
        self._locked_in: SessionTransaction | None = None

    def _remember_locked(self, batch_ids: Iterable[int]) -> None:
        # 列鎖在交易結束時就釋放，所以紀錄只對鎖定當下的交易有效。
        transaction = self._session.get_transaction()
        if transaction is not self._locked_in:
            self._locked_ids = set()
            self._locked_in = transaction
        self._locked_ids.update(batch_ids)

    def _require_locked(self, batch_id: int) -> None:
        transaction = self._session.get_transaction()
        if (
            transaction is None
            or transaction is not self._locked_in
            or batch_id not in self._locked_ids
        ):
            raise BatchNotLockedError(batch_id)

    def lock_batches(self, batch_ids: Sequence[int]) -> list[InventoryBatch]:
        if not batch_ids:
            return []
        stmt = (
            select(InventoryBatch)
            .where(InventoryBatch.id.in_(set(batch_ids)))
            .order_by(InventoryBatch.id)
        )
        batches = list(self._session.scalars(for_update(stmt)))
        self._remember_locked(batch.id for batch in batches)
        return batches

    def lock_ingredient_batches(self, ingredient_id: int) -> list[InventoryBatch]:
        stmt = (
            select(InventoryBatch)
            .where(
                InventoryBatch.ingredient_id == ingredient_id,
                InventoryBatch.remaining_quantity > 0,
            )
            .order_by(InventoryBatch.id)
        )
        batches = list(self._session.scalars(for_update(stmt)))
        self._remember_locked(batch.id for batch in batches)
        return batches

    def find_operation(
        self, group_id: UUID, tx_type: TransactionType
    ) -> list[InventoryTransaction]:
        stmt = (
            select(InventoryTransaction)
            .where(
                InventoryTransaction.operation_group_id == group_id,
                InventoryTransaction.type == tx_type,
            )
            .order_by(InventoryTransaction.id)
        )
        return list(self._session.scalars(stmt))

    def receive(self, item: GoodsReceiptItem, op: StockOp) -> InventoryTransaction:
        received_date = self._session.scalar(
            select(GoodsReceipt.receipt_date).where(GoodsReceipt.id == item.receipt_id)
        )
        batch = batch_from_item(item, received_date)
        # apply_quantity_change 需要批次 id，所以先以 0 建立批次，再由異動入帳。
        quantity = batch.remaining_quantity
        batch.remaining_quantity = Decimal("0")
        self._session.add(batch)
        flush_or_raise(self._session)
        self._remember_locked([batch.id])
        return self._add(apply_quantity_change(batch, TransactionType.RECEIPT, quantity, op))

    def deduct(
        self,
        batch: InventoryBatch,
        quantity: Decimal,
        tx_type: TransactionType,
        op: StockOp,
        is_non_fefo: bool = False,
    ) -> InventoryTransaction:
        require_deduct_type(tx_type)
        require_positive_quantity(quantity)
        self._require_locked(batch.id)
        return self._add(
            apply_quantity_change(batch, tx_type, -quantity, op, is_non_fefo=is_non_fefo)
        )

    def adjust(
        self, batch: InventoryBatch, actual_quantity: Decimal, op: StockOp
    ) -> InventoryTransaction | None:
        require_non_negative_quantity(actual_quantity)
        self._require_locked(batch.id)
        delta = actual_quantity - batch.remaining_quantity
        if delta == 0:
            return None
        return self._add(apply_quantity_change(batch, TransactionType.ADJUSTMENT, delta, op))

    def reverse(self, original: InventoryTransaction, op: StockOp) -> InventoryTransaction:
        require_reversible(original)
        self._require_locked(original.batch_id)
        batch = self._session.get_one(InventoryBatch, original.batch_id)
        return self._add(
            apply_quantity_change(
                batch,
                TransactionType.REVERSAL,
                -original.quantity_delta,
                op,
                reverses_transaction_id=original.id,
            )
        )

    def move(
        self, batch: InventoryBatch, to_location_id: int, op: StockOp
    ) -> BatchLocationChange | None:
        self._require_locked(batch.id)
        change = apply_move(batch, to_location_id, op)
        if change is not None:
            self._session.add(change)
            flush_or_raise(self._session)
        return change

    def _add(self, transaction: InventoryTransaction) -> InventoryTransaction:
        self._session.add(transaction)
        flush_or_raise(self._session)
        return transaction
