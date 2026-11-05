"""AD-8：check_replay 的重送比對。"""

from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

import pytest

from app.core.enums import ErrorCode, TransactionType
from app.core.errors import DomainError
from app.core.idempotency import check_replay
from app.db.models import InventoryBatch
from app.modules.inventory.ledger import StockOp
from tests.fakes.fake_stock_ledger import FakeStockLedger
from tests.integration.factories import NOW

Q = Decimal


@dataclass
class Recorded:
    batch_id: int
    quantity_delta: Decimal


EXISTING = [Recorded(1, Q("-7.000")), Recorded(2, Q("-3.000"))]


def test_no_existing_transaction_is_a_new_operation() -> None:
    assert check_replay([], {1: Q("7")}) is False


def test_same_batches_and_quantities_is_a_replay() -> None:
    assert check_replay(EXISTING, {2: Q("3.000"), 1: Q("7")}) is True


@pytest.mark.parametrize(
    "requested",
    [
        pytest.param({1: Q("7"), 2: Q("4")}, id="數量不同"),
        pytest.param({1: Q("7")}, id="批次較少"),
        pytest.param({1: Q("7"), 2: Q("3"), 3: Q("1")}, id="批次較多"),
        pytest.param({1: Q("7"), 9: Q("3")}, id="批次不同"),
        pytest.param({1: Q("-7"), 2: Q("-3")}, id="正負號錯誤"),
        pytest.param({}, id="空請求"),
    ],
)
def test_different_content_raises_duplicate(requested: dict[int, Decimal]) -> None:
    with pytest.raises(DomainError) as caught:
        check_replay(EXISTING, requested)

    assert caught.value.code is ErrorCode.DUPLICATE
    assert caught.value.status_code == 409
    assert caught.value.message == "此 Idempotency-Key 已用於內容不同的操作"


def test_same_batch_recorded_twice_is_treated_as_duplicate() -> None:
    # 唯一鍵 (operation_group_id, batch_id) 下不會發生；萬一發生不可當成重放。
    existing = [Recorded(1, Q("-3")), Recorded(1, Q("-4"))]

    with pytest.raises(DomainError) as caught:
        check_replay(existing, {1: Q("4")})

    assert caught.value.code is ErrorCode.DUPLICATE
    assert caught.value.status_code == 409


def test_works_with_transactions_returned_by_find_operation() -> None:
    """InventoryTransaction 符合 RecordedDeduction：先扣量，再以同一把 key 重送。"""
    ledger = FakeStockLedger()
    batch_id = ledger.add_batch(InventoryBatch(remaining_quantity=Q("10"))).id
    key = uuid4()
    batch = ledger.lock_batches([batch_id])[0]
    ledger.deduct(batch, Q("7"), TransactionType.ISSUE, StockOp(key, 1, NOW))
    ledger.end_transaction()

    existing = ledger.find_operation(key, TransactionType.ISSUE)

    assert check_replay(existing, {batch_id: Q("7.000")}) is True
    with pytest.raises(DomainError):
        check_replay(existing, {batch_id: Q("6")})
