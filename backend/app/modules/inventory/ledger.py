"""AD-20：庫存寫入的唯一入口。

下方的 helper 由真實實作與 tests/fakes/fake_stock_ledger.py 共用，
兩者只差在鎖定與持久化方式，並跑同一份契約測試。
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.core.enums import TransactionType
from app.core.errors import insufficient_stock
from app.db.models import (
    BatchLocationChange,
    GoodsReceiptItem,
    InventoryBatch,
    InventoryTransaction,
)

DEFAULT_REASONS = {
    TransactionType.RECEIPT: "進貨入庫",
    TransactionType.ISSUE: "領用",
    TransactionType.WASTE: "報廢",
    TransactionType.ADJUSTMENT: "盤點調整",
    TransactionType.REVERSAL: "沖銷",
}
DEFAULT_MOVE_REASON = "位置變更"
_QUANTITY_STEP = Decimal("0.001")


class BatchNotLockedError(RuntimeError):
    """程式錯誤：未經 lock_* 就修改批次。不是 DomainError，不應被轉成業務錯誤。"""

    def __init__(self, batch_id: int) -> None:
        super().__init__(f"批次 {batch_id} 未在目前交易中鎖定，不可修改")


@dataclass(frozen=True)
class StockOp:
    """同次操作共用。"""

    operation_group_id: UUID
    operator_id: int
    occurred_at: datetime  # Service 以 clock.now() 取一次
    reason: str | None = None


class StockLedger(ABC):
    """quantity 一律大於 0，正負由 Ledger 決定；時間由 StockOp 傳入。

    未鎖定的批次呼叫 deduct、adjust、reverse、move 時丟 BatchNotLockedError；
    鎖定只在當次交易內有效。
    """

    @abstractmethod
    def lock_batches(self, batch_ids: Sequence[int]) -> list[InventoryBatch]:
        """依 id 遞增鎖定並回傳；不存在的 id 不算錯誤。"""

    @abstractmethod
    def lock_ingredient_batches(self, ingredient_id: int) -> list[InventoryBatch]:
        """依 id 遞增鎖定該食材所有 remaining_quantity > 0 的批次。"""

    @abstractmethod
    def find_operation(
        self, group_id: UUID, tx_type: TransactionType
    ) -> list[InventoryTransaction]:
        """防重送查詢（AD-8），須在取得鎖後呼叫。"""

    @abstractmethod
    def receive(self, item: GoodsReceiptItem, op: StockOp) -> InventoryTransaction:
        """建立批次與 RECEIPT 異動；新批次視為已鎖定。"""

    @abstractmethod
    def deduct(
        self,
        batch: InventoryBatch,
        quantity: Decimal,
        tx_type: TransactionType,
        op: StockOp,
        is_non_fefo: bool = False,
    ) -> InventoryTransaction:
        """tx_type 只接受 ISSUE、WASTE；結果小於 0 時丟 INSUFFICIENT_STOCK。"""

    @abstractmethod
    def adjust(
        self, batch: InventoryBatch, actual_quantity: Decimal, op: StockOp
    ) -> InventoryTransaction | None:
        """調整到實際量；無差額回 None。"""

    @abstractmethod
    def reverse(self, original: InventoryTransaction, op: StockOp) -> InventoryTransaction:
        """沖銷原異動；結果小於 0 時丟 INSUFFICIENT_STOCK。"""

    @abstractmethod
    def move(
        self, batch: InventoryBatch, to_location_id: int, op: StockOp
    ) -> BatchLocationChange | None:
        """整批換位置；同位置回 None。"""


def _require_valid_scale(quantity: Decimal) -> None:
    if quantity != quantity.quantize(_QUANTITY_STEP):
        raise ValueError(f"數量最多三位小數：{quantity}")


def require_positive_quantity(quantity: Decimal) -> None:
    if quantity <= 0:
        raise ValueError(f"quantity 必須大於 0：{quantity}")
    _require_valid_scale(quantity)


def require_non_negative_quantity(quantity: Decimal) -> None:
    if quantity < 0:
        raise ValueError(f"實際量不可小於 0：{quantity}")
    _require_valid_scale(quantity)


def require_deduct_type(tx_type: TransactionType) -> None:
    if tx_type not in (TransactionType.ISSUE, TransactionType.WASTE):
        raise ValueError(f"deduct 只接受 ISSUE 或 WASTE：{tx_type}")


def require_reversible(original: InventoryTransaction) -> None:
    if original.type is TransactionType.REVERSAL:
        raise ValueError("不可沖銷另一筆沖銷異動")


def batch_from_item(item: GoodsReceiptItem, received_date: date) -> InventoryBatch:
    """item 必須已有 id，且確認入庫時已驗證過必填欄位（AD-8）。"""
    if item.id is None or item.quantity is None or item.expiry_date is None:
        raise ValueError("進貨明細缺少 id、數量或到期日，不可入庫")
    if item.location_id is None:
        raise ValueError("進貨明細缺少入庫位置，不可入庫")
    require_positive_quantity(item.quantity)
    return InventoryBatch(
        batch_number=f"B-{item.id:08d}",
        source_item_id=item.id,
        ingredient_id=item.ingredient_id,
        expiry_date=item.expiry_date,
        received_date=received_date,
        current_location_id=item.location_id,
        unit_price=item.unit_price,
        initial_quantity=item.quantity,
        remaining_quantity=item.quantity,
    )


def apply_quantity_change(
    batch: InventoryBatch,
    tx_type: TransactionType,
    delta: Decimal,
    op: StockOp,
    *,
    is_non_fefo: bool = False,
    reverses_transaction_id: int | None = None,
) -> InventoryTransaction:
    """更新批次剩餘量並回傳尚未持久化的異動。批次剩餘量不足時丟 INSUFFICIENT_STOCK。"""
    before = batch.remaining_quantity
    after = before + delta
    if after < 0:
        raise insufficient_stock(batch_id=batch.id, remaining_quantity=before)
    batch.remaining_quantity = after
    return InventoryTransaction(
        operation_group_id=op.operation_group_id,
        batch_id=batch.id,
        type=tx_type,
        quantity_delta=delta,
        quantity_before=before,
        quantity_after=after,
        operator_id=op.operator_id,
        occurred_at=op.occurred_at,
        reason=op.reason or DEFAULT_REASONS[tx_type],
        is_non_fefo=is_non_fefo,
        reverses_transaction_id=reverses_transaction_id,
    )


def apply_move(
    batch: InventoryBatch, to_location_id: int, op: StockOp
) -> BatchLocationChange | None:
    if batch.current_location_id == to_location_id:
        return None
    change = BatchLocationChange(
        batch_id=batch.id,
        from_location_id=batch.current_location_id,
        to_location_id=to_location_id,
        operator_id=op.operator_id,
        occurred_at=op.occurred_at,
        reason=op.reason or DEFAULT_MOVE_REASON,
    )
    batch.current_location_id = to_location_id
    return change
