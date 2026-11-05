"""AD-20：真實與 fake StockLedger 跑同一份契約測試。"""

from collections.abc import Iterator
from datetime import timedelta
from decimal import Decimal
from itertools import count
from typing import Protocol
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_session_factory
from app.core.enums import ErrorCode, TransactionType
from app.core.errors import DomainError
from app.db.models import GoodsReceiptItem, InventoryBatch, InventoryTransaction
from app.modules.inventory.ledger import BatchNotLockedError, StockLedger, StockOp
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.fakes.fake_stock_ledger import FakeStockLedger
from tests.integration import factories
from tests.integration.factories import NOW, TODAY

Q = Decimal
EXPIRY = TODAY + timedelta(days=30)
RECEIVED = TODAY - timedelta(days=1)


class Harness(Protocol):
    ledger: StockLedger
    operator_id: int

    def new_ingredient(self) -> int: ...
    def new_location(self) -> int: ...
    def new_item(self, ingredient_id: int, quantity: str = "10") -> GoodsReceiptItem: ...
    def batch(self, batch_id: int) -> InventoryBatch: ...
    def batch_transactions(self, batch_id: int) -> list[InventoryTransaction]: ...
    def end_transaction(self) -> None: ...


class RealHarness:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.ledger = SqlAlchemyStockLedger(session)
        self.operator_id = factories.add_employee(session).id
        self.location_id = self.new_location()

    def new_ingredient(self) -> int:
        return factories.add_ingredient(self.session).id

    def new_location(self) -> int:
        return factories.add_location(self.session).id

    def new_item(self, ingredient_id: int, quantity: str = "10") -> GoodsReceiptItem:
        return factories.add_item(
            self.session,
            ingredient_id=ingredient_id,
            location_id=self.location_id,
            operator_id=self.operator_id,
            quantity=quantity,
            expiry_date=EXPIRY,
            receipt_date=RECEIVED,
        )

    def batch(self, batch_id: int) -> InventoryBatch:
        return self.session.get_one(InventoryBatch, batch_id)

    def batch_transactions(self, batch_id: int) -> list[InventoryTransaction]:
        stmt = (
            select(InventoryTransaction)
            .where(InventoryTransaction.batch_id == batch_id)
            .order_by(InventoryTransaction.id)
        )
        return list(self.session.scalars(stmt))

    def end_transaction(self) -> None:
        self.session.commit()


class FakeHarness:
    def __init__(self) -> None:
        self.ledger = FakeStockLedger(receipt_dates={1: RECEIVED})
        self.operator_id = 1
        self._ids = count(1)
        self.location_id = self.new_location()

    def new_ingredient(self) -> int:
        return next(self._ids)

    def new_location(self) -> int:
        return next(self._ids)

    def new_item(self, ingredient_id: int, quantity: str = "10") -> GoodsReceiptItem:
        return GoodsReceiptItem(
            id=next(self._ids),
            receipt_id=1,
            ingredient_id=ingredient_id,
            quantity=Q(quantity),
            unit_price=Q("100.00"),
            expiry_date=EXPIRY,
            location_id=self.location_id,
        )

    def batch(self, batch_id: int) -> InventoryBatch:
        return self.ledger.batches[batch_id]

    def batch_transactions(self, batch_id: int) -> list[InventoryTransaction]:
        return [item for item in self.ledger.transactions if item.batch_id == batch_id]

    def end_transaction(self) -> None:
        self.ledger.end_transaction()


@pytest.fixture(params=["sqlalchemy", "fake"])
def env(request: pytest.FixtureRequest) -> Iterator[Harness]:
    if request.param == "fake":
        yield FakeHarness()
        return
    with get_session_factory()() as session:
        yield RealHarness(session)
        session.rollback()


def _op(env: Harness, reason: str | None = None) -> StockOp:
    return StockOp(uuid4(), env.operator_id, NOW, reason)


def _new_batch(env: Harness, quantity: str = "10", ingredient_id: int | None = None) -> int:
    """建立一個已入帳、鎖已釋放的批次。"""
    ingredient_id = ingredient_id if ingredient_id is not None else env.new_ingredient()
    transaction = env.ledger.receive(env.new_item(ingredient_id, quantity), _op(env))
    env.end_transaction()
    return transaction.batch_id


def _locked(env: Harness, batch_id: int) -> InventoryBatch:
    return env.ledger.lock_batches([batch_id])[0]


class TestLocking:
    def test_lock_batches_returns_unique_batches_in_id_order(self, env: Harness) -> None:
        first, second = _new_batch(env), _new_batch(env)
        locked = env.ledger.lock_batches([second, first, second, 999_999])
        assert [batch.id for batch in locked] == [first, second]

    def test_lock_batches_with_no_ids(self, env: Harness) -> None:
        assert env.ledger.lock_batches([]) == []

    def test_lock_ingredient_batches_skips_empty_and_other_ingredients(self, env: Harness) -> None:
        ingredient_id = env.new_ingredient()
        empty = _new_batch(env, ingredient_id=ingredient_id)
        kept_first = _new_batch(env, ingredient_id=ingredient_id)
        kept_second = _new_batch(env, ingredient_id=ingredient_id)
        _new_batch(env)
        env.ledger.deduct(_locked(env, empty), Q("10"), TransactionType.ISSUE, _op(env))
        env.end_transaction()

        locked = env.ledger.lock_ingredient_batches(ingredient_id)

        assert [batch.id for batch in locked] == [kept_first, kept_second]

    @pytest.mark.parametrize("method", ["deduct", "adjust", "move", "reverse"])
    def test_unlocked_batch_raises_and_writes_nothing(self, env: Harness, method: str) -> None:
        batch_id = _new_batch(env)
        batch = env.batch(batch_id)
        receipt = env.batch_transactions(batch_id)[0]
        location_before = batch.current_location_id

        with pytest.raises(BatchNotLockedError):
            match method:
                case "deduct":
                    env.ledger.deduct(batch, Q("1"), TransactionType.ISSUE, _op(env))
                case "adjust":
                    env.ledger.adjust(batch, Q("1"), _op(env))
                case "move":
                    env.ledger.move(batch, env.new_location(), _op(env))
                case "reverse":
                    env.ledger.reverse(receipt, _op(env))

        assert batch.remaining_quantity == Q("10")
        assert batch.current_location_id == location_before
        assert len(env.batch_transactions(batch_id)) == 1

    def test_unlocked_error_is_a_programming_error_not_domain_error(self) -> None:
        assert not issubclass(BatchNotLockedError, DomainError)

    def test_lock_does_not_survive_the_transaction(self, env: Harness) -> None:
        batch_id = _new_batch(env)
        batch = _locked(env, batch_id)
        env.end_transaction()

        with pytest.raises(BatchNotLockedError):
            env.ledger.deduct(batch, Q("1"), TransactionType.ISSUE, _op(env))


class TestReceive:
    def test_creates_batch_and_receipt_transaction(self, env: Harness) -> None:
        item = env.new_item(env.new_ingredient(), "12.5")
        op = _op(env, None)

        transaction = env.ledger.receive(item, op)

        batch = env.batch(transaction.batch_id)
        assert batch.batch_number == f"B-{item.id:08d}"
        assert batch.source_item_id == item.id
        assert batch.ingredient_id == item.ingredient_id
        assert batch.expiry_date == EXPIRY
        assert batch.received_date == RECEIVED
        assert batch.current_location_id == item.location_id
        assert batch.unit_price == Q("100.00")
        assert batch.initial_quantity == Q("12.5")
        assert batch.remaining_quantity == Q("12.5")
        assert transaction.type is TransactionType.RECEIPT
        assert transaction.quantity_delta == Q("12.5")
        assert transaction.quantity_before == Q("0")
        assert transaction.quantity_after == Q("12.5")
        assert transaction.operation_group_id == op.operation_group_id
        assert transaction.reason == "進貨入庫"

    def test_new_batch_counts_as_locked(self, env: Harness) -> None:
        transaction = env.ledger.receive(env.new_item(env.new_ingredient()), _op(env))
        env.ledger.reverse(transaction, _op(env))
        assert env.batch(transaction.batch_id).remaining_quantity == Q("0")

    def test_same_item_cannot_be_received_twice(self, env: Harness) -> None:
        item = env.new_item(env.new_ingredient())
        env.ledger.receive(item, _op(env))
        with pytest.raises(DomainError) as caught:
            env.ledger.receive(item, _op(env))
        assert caught.value.code is ErrorCode.STATE_CONFLICT

    @pytest.mark.parametrize("field", ["quantity", "expiry_date", "location_id"])
    def test_incomplete_draft_item_is_rejected(self, env: Harness, field: str) -> None:
        item = env.new_item(env.new_ingredient())
        setattr(item, field, None)
        with pytest.raises(ValueError):
            env.ledger.receive(item, _op(env))


class TestDeduct:
    @pytest.mark.parametrize(
        ("tx_type", "reason"), [(TransactionType.ISSUE, "領用"), (TransactionType.WASTE, "報廢")]
    )
    def test_writes_transaction(self, env: Harness, tx_type: TransactionType, reason: str) -> None:
        batch = _locked(env, _new_batch(env))
        op = _op(env)

        transaction = env.ledger.deduct(batch, Q("7"), tx_type, op)

        assert batch.remaining_quantity == Q("3")
        assert transaction.type is tx_type
        assert transaction.quantity_delta == Q("-7")
        assert transaction.quantity_before == Q("10")
        assert transaction.quantity_after == Q("3")
        assert transaction.operator_id == env.operator_id
        assert transaction.occurred_at == NOW
        assert transaction.reason == reason
        assert transaction.is_non_fefo is False

    def test_keeps_non_fefo_flag_and_reason(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        transaction = env.ledger.deduct(
            batch, Q("1"), TransactionType.ISSUE, _op(env, "主廚指定"), is_non_fefo=True
        )
        assert transaction.is_non_fefo is True
        assert transaction.reason == "主廚指定"

    def test_exact_remaining_quantity_is_allowed(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        env.ledger.deduct(batch, Q("10"), TransactionType.ISSUE, _op(env))
        assert batch.remaining_quantity == Q("0")

    def test_over_deduct_raises_insufficient_stock_and_writes_nothing(self, env: Harness) -> None:
        batch_id = _new_batch(env, "2.5")
        batch = _locked(env, batch_id)

        with pytest.raises(DomainError) as caught:
            env.ledger.deduct(batch, Q("2.501"), TransactionType.ISSUE, _op(env))

        assert caught.value.code is ErrorCode.INSUFFICIENT_STOCK
        assert caught.value.status_code == 409
        assert caught.value.details == {
            "batch_id": batch_id,
            "remaining_quantity": "2.500",
            "available_quantity": None,
        }
        assert batch.remaining_quantity == Q("2.5")
        assert len(env.batch_transactions(batch_id)) == 1

    @pytest.mark.parametrize("quantity", ["0", "-1", "0.0001"])
    def test_invalid_quantity_is_rejected(self, env: Harness, quantity: str) -> None:
        batch = _locked(env, _new_batch(env))
        with pytest.raises(ValueError):
            env.ledger.deduct(batch, Q(quantity), TransactionType.ISSUE, _op(env))

    @pytest.mark.parametrize(
        "tx_type",
        [TransactionType.RECEIPT, TransactionType.ADJUSTMENT, TransactionType.REVERSAL],
    )
    def test_other_types_are_rejected(self, env: Harness, tx_type: TransactionType) -> None:
        batch = _locked(env, _new_batch(env))
        with pytest.raises(ValueError):
            env.ledger.deduct(batch, Q("1"), tx_type, _op(env))

    def test_same_operation_group_on_same_batch_is_duplicate(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        op = _op(env)
        env.ledger.deduct(batch, Q("1"), TransactionType.ISSUE, op)
        with pytest.raises(DomainError) as caught:
            env.ledger.deduct(batch, Q("1"), TransactionType.ISSUE, op)
        assert caught.value.code is ErrorCode.DUPLICATE


class TestFindOperation:
    def test_finds_only_matching_group_and_type(self, env: Harness) -> None:
        first, second = env.ledger.lock_batches([_new_batch(env), _new_batch(env)])
        op = _op(env)
        written = [
            env.ledger.deduct(first, Q("1"), TransactionType.ISSUE, op),
            env.ledger.deduct(second, Q("2"), TransactionType.ISSUE, op),
        ]
        env.ledger.deduct(first, Q("1"), TransactionType.ISSUE, _op(env))

        found = env.ledger.find_operation(op.operation_group_id, TransactionType.ISSUE)

        assert [item.id for item in found] == [item.id for item in written]
        assert env.ledger.find_operation(op.operation_group_id, TransactionType.WASTE) == []


class TestAdjust:
    @pytest.mark.parametrize(
        ("actual", "delta", "after"), [("12", "2", "12"), ("7.5", "-2.5", "7.5"), ("0", "-10", "0")]
    )
    def test_records_difference(self, env: Harness, actual: str, delta: str, after: str) -> None:
        batch = _locked(env, _new_batch(env))

        transaction = env.ledger.adjust(batch, Q(actual), _op(env))

        assert transaction is not None
        assert transaction.type is TransactionType.ADJUSTMENT
        assert transaction.quantity_delta == Q(delta)
        assert transaction.quantity_after == Q(after)
        assert transaction.reason == "盤點調整"
        assert batch.remaining_quantity == Q(after)

    def test_no_difference_returns_none(self, env: Harness) -> None:
        batch_id = _new_batch(env)
        batch = _locked(env, batch_id)
        assert env.ledger.adjust(batch, Q("10.000"), _op(env)) is None
        assert len(env.batch_transactions(batch_id)) == 1

    def test_negative_actual_quantity_is_rejected(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        with pytest.raises(ValueError):
            env.ledger.adjust(batch, Q("-0.001"), _op(env))


class TestReverse:
    def test_reverses_receipt(self, env: Harness) -> None:
        batch_id = _new_batch(env)
        receipt = env.batch_transactions(batch_id)[0]
        batch = _locked(env, batch_id)

        reversal = env.ledger.reverse(receipt, _op(env))

        assert reversal.type is TransactionType.REVERSAL
        assert reversal.reverses_transaction_id == receipt.id
        assert reversal.quantity_delta == Q("-10")
        assert reversal.quantity_after == Q("0")
        assert reversal.reason == "沖銷"
        assert batch.remaining_quantity == Q("0")

    def test_reverses_deduction_by_adding_back(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        issue = env.ledger.deduct(batch, Q("4"), TransactionType.ISSUE, _op(env))

        reversal = env.ledger.reverse(issue, _op(env))

        assert reversal.quantity_delta == Q("4")
        assert batch.remaining_quantity == Q("10")

    def test_insufficient_stock_when_result_would_be_negative(self, env: Harness) -> None:
        batch_id = _new_batch(env)
        receipt = env.batch_transactions(batch_id)[0]
        batch = _locked(env, batch_id)
        env.ledger.deduct(batch, Q("1"), TransactionType.ISSUE, _op(env))

        with pytest.raises(DomainError) as caught:
            env.ledger.reverse(receipt, _op(env))

        assert caught.value.code is ErrorCode.INSUFFICIENT_STOCK
        assert batch.remaining_quantity == Q("9")

    def test_cannot_reverse_twice(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        issue = env.ledger.deduct(batch, Q("4"), TransactionType.ISSUE, _op(env))
        env.ledger.reverse(issue, _op(env))
        with pytest.raises(DomainError) as caught:
            env.ledger.reverse(issue, _op(env))
        assert caught.value.code is ErrorCode.STATE_CONFLICT

    def test_cannot_reverse_a_reversal(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        issue = env.ledger.deduct(batch, Q("4"), TransactionType.ISSUE, _op(env))
        reversal = env.ledger.reverse(issue, _op(env))
        with pytest.raises(ValueError):
            env.ledger.reverse(reversal, _op(env))


class TestMove:
    def test_records_change_without_touching_quantity(self, env: Harness) -> None:
        batch_id = _new_batch(env)
        batch = _locked(env, batch_id)
        from_location_id = batch.current_location_id
        to_location_id = env.new_location()

        change = env.ledger.move(batch, to_location_id, _op(env, "冷藏庫維修"))

        assert change is not None
        assert change.batch_id == batch_id
        assert change.from_location_id == from_location_id
        assert change.to_location_id == to_location_id
        assert change.reason == "冷藏庫維修"
        assert batch.current_location_id == to_location_id
        assert batch.remaining_quantity == Q("10")
        assert len(env.batch_transactions(batch_id)) == 1

    def test_same_location_returns_none(self, env: Harness) -> None:
        batch = _locked(env, _new_batch(env))
        assert env.ledger.move(batch, batch.current_location_id, _op(env)) is None
