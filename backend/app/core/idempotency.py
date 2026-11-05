"""AD-8：領用、報廢的防重送比對。只比對，不查詢、不組回應；不 import fastapi，Service 可直接使用。

標頭解析在 core/dependencies.py 的 get_idempotency_key。確認入庫靠狀態機防重送，不使用此標頭。

用法（Service 內，取得鎖之後）：

    existing = ledger.find_operation(idempotency_key, TransactionType.ISSUE)
    if check_replay(existing, {batch.id: quantity for ...}):
        return 從 existing 重建的回應   # 重放：不再寫入
    ...                                # 新操作：照常扣量
"""

from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Protocol

from app.core.enums import ErrorCode
from app.core.errors import DomainError

IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"


class RecordedDeduction(Protocol):
    """find_operation 回傳的異動中，比對需要的欄位（InventoryTransaction 符合）。"""

    @property
    def batch_id(self) -> int: ...

    @property
    def quantity_delta(self) -> Decimal: ...


def duplicate_operation() -> DomainError:
    return DomainError(ErrorCode.DUPLICATE, "此 Idempotency-Key 已用於內容不同的操作")


def check_replay(existing: Sequence[RecordedDeduction], requested: Mapping[int, Decimal]) -> bool:
    """回傳 False 表示新操作，True 表示重放；內容不同時丟 409 DUPLICATE。

    existing 是同一把 key、同一種異動類型的既有扣量異動（quantity_delta 為負）；
    requested 是本次請求的 {batch_id: 扣量}，扣量為正。數量以數值比較，7 與 7.000 視為相同。
    """
    if not existing:
        return False
    recorded: dict[int, Decimal] = {}
    for transaction in existing:
        if transaction.batch_id in recorded:
            raise duplicate_operation()
        recorded[transaction.batch_id] = -transaction.quantity_delta
    if recorded != dict(requested):
        raise duplicate_operation()
    return True
