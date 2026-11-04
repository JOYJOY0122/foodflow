"""AD-20：記憶體版 StockLedger，供 Service 單元測試使用。

與真實實作共用 app.modules.inventory.ledger 的 helper，並跑同一份契約測試
（tests/integration/test_stock_ledger_contract.py）。

用法：以 `receive` 建立批次（會留下 RECEIPT 異動），或以 `add_batch` 直接放入；
真實 Session 的鎖在交易結束時釋放，測試可用 `end_transaction` 模擬。
"""

from collections.abc import Iterable, Sequence
from datetime import date
from decimal import Decimal
from itertools import count
from uuid import UUID

from app.core.enums import ErrorCode, TransactionType
from app.core.errors import DomainError
from app.db.models import (
    BatchLocationChange,
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


class FakeStockLedger(StockLedger):
    def __init__(self, receipt_dates: dict[int, date] | None = None) -> None:
        self.batches: dict[int, InventoryBatch] = {}
        self.transactions: list[InventoryTransaction] = []
        self.location_changes: list[BatchLocationChange] = []
        self.receipt_dates: dict[int, date] = dict(receipt_dates or {})
        self._locked_ids: set[int] = set()
        self._batch_ids = count(1)
        self._transaction_ids = count(1)
        self._change_ids = count(1)

    def add_batch(self, batch: InventoryBatch) -> InventoryBatch:
        """直接放入批次，不留異動紀錄；未指定 id 時自動配發。"""
        if batch.id is None:
            batch.id = next(self._batch_ids)
        self.batches[batch.id] = batch
        return batch

    def end_transaction(self) -> None:
        """模擬交易結束：列鎖全部釋放。"""
        self._locked_ids.clear()

    def _require_locked(self, batch_id: int) -> None:
        if batch_id not in self._locked_ids:
            raise BatchNotLockedError(batch_id)

    def _lock(self, batches: Iterable[InventoryBatch]) -> list[InventoryBatch]:
        locked = sorted(batches, key=lambda batch: batch.id)
        self._locked_ids.update(batch.id for batch in locked)
        return locked

    def lock_batches(self, batch_ids: Sequence[int]) -> list[InventoryBatch]:
        return self._lock(
            self.batches[batch_id] for batch_id in set(batch_ids) if batch_id in self.batches
        )

    def lock_ingredient_batches(self, ingredient_id: int) -> list[InventoryBatch]:
        return self._lock(
            batch
            for batch in self.batches.values()
            if batch.ingredient_id == ingredient_id and batch.remaining_quantity > 0
        )

    def find_operation(
        self, group_id: UUID, tx_type: TransactionType
    ) -> list[InventoryTransaction]:
        return [
            transaction
            for transaction in self.transactions
            if transaction.operation_group_id == group_id and transaction.type == tx_type
        ]

    def receive(self, item: GoodsReceiptItem, op: StockOp) -> InventoryTransaction:
        batch = batch_from_item(item, self.receipt_dates[item.receipt_id])
        if any(existing.source_item_id == item.id for existing in self.batches.values()):
            raise DomainError(ErrorCode.STATE_CONFLICT, "此進貨明細已入庫")
        quantity = batch.remaining_quantity
        batch.remaining_quantity = Decimal("0")
        self.add_batch(batch)
        self._locked_ids.add(batch.id)
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
        self._reject_duplicate_group(batch.id, op)
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
        self._reject_duplicate_group(batch.id, op)
        return self._add(apply_quantity_change(batch, TransactionType.ADJUSTMENT, delta, op))

    def reverse(self, original: InventoryTransaction, op: StockOp) -> InventoryTransaction:
        require_reversible(original)
        self._require_locked(original.batch_id)
        if any(item.reverses_transaction_id == original.id for item in self.transactions):
            raise DomainError(ErrorCode.STATE_CONFLICT, "此異動已沖銷")
        self._reject_duplicate_group(original.batch_id, op)
        return self._add(
            apply_quantity_change(
                self.batches[original.batch_id],
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
            change.id = next(self._change_ids)
            self.location_changes.append(change)
        return change

    def _reject_duplicate_group(self, batch_id: int, op: StockOp) -> None:
        if any(
            item.operation_group_id == op.operation_group_id and item.batch_id == batch_id
            for item in self.transactions
        ):
            raise DomainError(ErrorCode.DUPLICATE, "此操作已處理過")

    def _add(self, transaction: InventoryTransaction) -> InventoryTransaction:
        transaction.id = next(self._transaction_ids)
        self.transactions.append(transaction)
        return transaction
