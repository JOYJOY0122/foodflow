"""AD-6：SqlAlchemyUnitOfWork 與 FakeUnitOfWork 跑同一份契約測試。"""

from collections.abc import Iterator
from contextlib import nullcontext
from decimal import Decimal
from typing import Literal, Protocol

import pytest
from sqlalchemy import select

from app.core.db import get_session_factory
from app.core.enums import TransactionType
from app.core.uow import SqlAlchemyUnitOfWork, UnitOfWork
from app.db.models import InventoryBatch, StorageLocation
from app.modules.inventory.ledger import BatchNotLockedError, StockLedger
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.fakes.fake_stock_ledger import FakeStockLedger
from tests.fakes.fake_uow import FakeUnitOfWork
from tests.integration import factories

Outcome = Literal["committed", "rolled_back"]


class Harness(Protocol):
    uow: UnitOfWork
    ledger: StockLedger
    batch_id: int

    def write(self) -> None: ...
    def outcome(self) -> Outcome: ...


class RealHarness:
    def __init__(self) -> None:
        self.session = get_session_factory()()
        self.uow = SqlAlchemyUnitOfWork(self.session)
        self.ledger = SqlAlchemyStockLedger(self.session)
        self.batch_id = factories.seed_batch(self.session).batch_id
        self._written: int | None = None

    def write(self) -> None:
        self._written = factories.add_location(self.session).id

    def outcome(self) -> Outcome:
        with get_session_factory()() as other:
            found = other.scalar(
                select(StorageLocation.id).where(StorageLocation.id == self._written)
            )
        return "committed" if found is not None else "rolled_back"


class FakeHarness:
    def __init__(self) -> None:
        self.ledger = FakeStockLedger()
        self.uow = FakeUnitOfWork(self.ledger)
        self.batch_id = self.ledger.add_batch(InventoryBatch(remaining_quantity=Decimal("10"))).id
        self._before = (0, 0)

    def write(self) -> None:
        self._before = (self.uow.commits, self.uow.rollbacks)

    def outcome(self) -> Outcome:
        commits = self.uow.commits - self._before[0]
        rollbacks = self.uow.rollbacks - self._before[1]
        assert (commits, rollbacks) in {(1, 0), (0, 1)}
        return "committed" if commits else "rolled_back"


@pytest.fixture(params=["sqlalchemy", "fake"])
def env(request: pytest.FixtureRequest) -> Iterator[Harness]:
    if request.param == "fake":
        yield FakeHarness()
        return
    harness = RealHarness()
    try:
        yield harness
    finally:
        harness.session.close()


class Boom(Exception):
    pass


def test_block_that_ends_normally_commits(env: Harness) -> None:
    with env.uow.transaction():
        env.write()

    assert env.outcome() == "committed"


def test_exception_rolls_back_and_propagates_unchanged(env: Harness) -> None:
    error = Boom("boom")
    with pytest.raises(Boom) as caught:
        with env.uow.transaction():
            env.write()
            raise error

    assert caught.value is error
    assert env.outcome() == "rolled_back"


def test_nested_transaction_raises_and_outer_still_commits(env: Harness) -> None:
    with env.uow.transaction():
        env.write()
        with pytest.raises(RuntimeError, match="巢狀"):
            with env.uow.transaction():
                pass

    assert env.outcome() == "committed"


def test_can_be_used_again_after_rollback(env: Harness) -> None:
    with pytest.raises(Boom):
        with env.uow.transaction():
            raise Boom

    with env.uow.transaction():
        env.write()

    assert env.outcome() == "committed"


@pytest.mark.parametrize("fail", [False, True], ids=["commit", "rollback"])
def test_locks_are_released_when_transaction_ends(env: Harness, fail: bool) -> None:
    with pytest.raises(Boom) if fail else nullcontext():
        with env.uow.transaction():
            env.ledger.lock_batches([env.batch_id])
            if fail:
                raise Boom

    with env.uow.transaction():
        batch = _batch(env)
        with pytest.raises(BatchNotLockedError):
            env.ledger.deduct(batch, Decimal("1"), TransactionType.ISSUE, factories.op_for(1))


def _batch(env: Harness) -> InventoryBatch:
    if isinstance(env, RealHarness):
        return env.session.get_one(InventoryBatch, env.batch_id)
    assert isinstance(env.ledger, FakeStockLedger)
    return env.ledger.batches[env.batch_id]


def test_fake_records_commits_and_rollbacks_and_active_state() -> None:
    uow = FakeUnitOfWork()
    assert uow.active is False

    with uow.transaction():
        assert uow.active is True
    with pytest.raises(Boom):
        with uow.transaction():
            raise Boom

    assert (uow.commits, uow.rollbacks, uow.active) == (1, 1, False)


def test_fake_rollback_does_not_undo_ledger_writes() -> None:
    """記錄已知限制：失敗路徑請斷言 rollbacks，不要斷言 fake 資料已還原。"""
    ledger = FakeStockLedger()
    uow = FakeUnitOfWork(ledger)
    batch_id = ledger.add_batch(InventoryBatch(remaining_quantity=Decimal("10"))).id

    with pytest.raises(Boom):
        with uow.transaction():
            batch = ledger.lock_batches([batch_id])[0]
            ledger.deduct(batch, Decimal("4"), TransactionType.ISSUE, factories.op_for(1))
            raise Boom

    assert uow.rollbacks == 1
    assert ledger.batches[batch_id].remaining_quantity == Decimal("6")
