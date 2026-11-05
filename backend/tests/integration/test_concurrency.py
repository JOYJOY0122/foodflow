"""AD-7、NFR-02：真實 PostgreSQL 上的列鎖。結尾一律執行 verify-stock。

這些測試的前提是 for_update：移除 with_for_update 時，第二連線觀察不到鎖等待而轉紅；
移除 populate_existing 時，「鎖前先讀」的測試會轉紅。
"""

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.cli import main as cli_main
from app.core.db import get_engine, get_session_factory
from app.core.enums import ErrorCode, TransactionType
from app.core.errors import DomainError
from app.core.uow import SqlAlchemyUnitOfWork
from app.db.models import InventoryBatch, InventoryTransaction
from app.modules.inventory.ledger import StockOp
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.integration.factories import NOW, SeededBatch, seed_batch

THREAD_TIMEOUT = 20
BLOCKED_TIMEOUT = 5

LockMethod = Callable[[SqlAlchemyStockLedger, SeededBatch], list[InventoryBatch]]


def lock_by_batch_id(ledger: SqlAlchemyStockLedger, seeded: SeededBatch) -> list[InventoryBatch]:
    return ledger.lock_batches([seeded.batch_id])


def lock_by_ingredient(ledger: SqlAlchemyStockLedger, seeded: SeededBatch) -> list[InventoryBatch]:
    return ledger.lock_ingredient_batches(seeded.ingredient_id)


@pytest.fixture(
    params=[lock_by_batch_id, lock_by_ingredient],
    ids=["lock_batches", "lock_ingredient_batches"],
)
def lock(request: pytest.FixtureRequest) -> LockMethod:
    return request.param


@pytest.fixture
def seeded() -> SeededBatch:
    with get_session_factory()() as session:
        return seed_batch(session, quantity="10")


@dataclass
class Outcome:
    backend_pid: int | None = None
    seen_before_lock: Decimal | None = None
    seen_after_lock: Decimal | None = None
    locked_batch_ids: list[int] | None = None
    error: DomainError | None = None
    unexpected: BaseException | None = None
    pid_ready: threading.Event = field(default_factory=threading.Event)

    @property
    def succeeded(self) -> bool:
        return self.error is None and self.unexpected is None and self.seen_after_lock is not None


def _no_pause() -> None:
    pass


def lock_and_deduct(
    seeded: SeededBatch,
    outcome: Outcome,
    *,
    lock: LockMethod = lock_by_batch_id,
    quantity: Decimal = Decimal("7"),
    read_first: bool = False,
    before_lock: Callable[[], None] = _no_pause,
    after_deduct: Callable[[], None] = _no_pause,
) -> None:
    """用獨立連線鎖定後扣量；鎖不到批次時不扣。after_deduct 時交易尚未 commit。"""
    try:
        with get_session_factory()() as session:
            outcome.backend_pid = session.scalar(text("SELECT pg_backend_pid()"))
            outcome.pid_ready.set()
            if read_first:
                batch = session.get_one(InventoryBatch, seeded.batch_id)
                outcome.seen_before_lock = batch.remaining_quantity
            before_lock()

            ledger = SqlAlchemyStockLedger(session)
            op = StockOp(uuid4(), seeded.operator_id, NOW)
            with SqlAlchemyUnitOfWork(session).transaction():
                batches = lock(ledger, seeded)
                outcome.locked_batch_ids = [batch.id for batch in batches]
                if not batches:
                    return
                batch = batches[0]
                outcome.seen_after_lock = batch.remaining_quantity
                ledger.deduct(batch, quantity, TransactionType.ISSUE, op)
                after_deduct()
    except DomainError as exc:
        outcome.error = exc
    except BaseException as exc:  # 讓主執行緒的斷言看得到
        outcome.unexpected = exc


def wait_until_blocked_on_row_lock(blocked_pid: int, holder_pid: int) -> dict:
    """輪詢 pg_stat_activity，直到確認 blocked_pid 正在等 holder_pid 的 FOR UPDATE 列鎖。"""
    query = text(
        """
        SELECT wait_event_type, wait_event, query, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity
        WHERE pid = :pid
        """
    )
    deadline = time.monotonic() + BLOCKED_TIMEOUT
    last = None
    while time.monotonic() < deadline:
        with get_engine().connect() as connection:
            last = connection.execute(query, {"pid": blocked_pid}).mappings().first()
        if (
            last is not None
            and last["wait_event_type"] == "Lock"
            and holder_pid in last["blockers"]
            and "FOR UPDATE" in last["query"]
        ):
            return dict(last)
        time.sleep(0.02)
    raise AssertionError(f"第二連線未在 {BLOCKED_TIMEOUT} 秒內被 FOR UPDATE 擋住：{last}")


def run_holder_then_waiter(
    seeded: SeededBatch,
    *,
    read_first: bool,
    lock: LockMethod,
    holder_quantity: Decimal = Decimal("7"),
) -> tuple[Outcome, Outcome]:
    """第一連線扣完後持鎖不放，以 pg_stat_activity 確認第二連線被擋住後才放行。"""
    holder, waiter = Outcome(), Outcome()
    both_read = threading.Barrier(2)
    holder_deducted = threading.Event()
    waiter_may_lock = threading.Event()
    release_holder = threading.Event()

    def holder_pause_after_deduct() -> None:
        holder_deducted.set()
        assert release_holder.wait(THREAD_TIMEOUT)

    def waiter_pause_before_lock() -> None:
        both_read.wait(THREAD_TIMEOUT)
        assert waiter_may_lock.wait(THREAD_TIMEOUT)

    threads = [
        threading.Thread(
            target=lock_and_deduct,
            args=(seeded, holder),
            kwargs={
                "lock": lock,
                "quantity": holder_quantity,
                "read_first": read_first,
                "before_lock": lambda: both_read.wait(THREAD_TIMEOUT),
                "after_deduct": holder_pause_after_deduct,
            },
        ),
        threading.Thread(
            target=lock_and_deduct,
            args=(seeded, waiter),
            kwargs={
                "lock": lock,
                "read_first": read_first,
                "before_lock": waiter_pause_before_lock,
            },
        ),
    ]
    for thread in threads:
        thread.start()
    try:
        assert holder_deducted.wait(THREAD_TIMEOUT), holder.unexpected
        assert waiter.pid_ready.wait(THREAD_TIMEOUT)
        waiter_may_lock.set()
        evidence = wait_until_blocked_on_row_lock(waiter.backend_pid, holder.backend_pid)
        assert evidence["wait_event"] in {"transactionid", "tuple"}
    finally:
        waiter_may_lock.set()
        release_holder.set()
        for thread in threads:
            thread.join(THREAD_TIMEOUT)
    assert not any(thread.is_alive() for thread in threads)
    return holder, waiter


def assert_exactly_one_issue_and_remaining(seeded: SeededBatch, remaining: str) -> None:
    with get_session_factory()() as session:
        batch = session.get_one(InventoryBatch, seeded.batch_id)
        issue_count = session.scalar(
            select(func.count())
            .select_from(InventoryTransaction)
            .where(
                InventoryTransaction.batch_id == seeded.batch_id,
                InventoryTransaction.type == TransactionType.ISSUE,
            )
        )
    assert batch.remaining_quantity == Decimal(remaining)
    assert issue_count == 1


def assert_insufficient_stock(outcome: Outcome) -> None:
    assert outcome.unexpected is None
    assert outcome.error is not None
    assert outcome.error.code is ErrorCode.INSUFFICIENT_STOCK
    assert outcome.error.status_code == 409
    assert outcome.error.details["remaining_quantity"] == "3.000"


def test_second_connection_is_blocked_and_cannot_over_deduct(
    seeded: SeededBatch, lock: LockMethod
) -> None:
    holder, waiter = run_holder_then_waiter(seeded, read_first=False, lock=lock)

    assert holder.succeeded, holder.unexpected
    assert_insufficient_stock(waiter)
    assert waiter.seen_after_lock == Decimal("3.000")
    assert_exactly_one_issue_and_remaining(seeded, "3.000")
    assert cli_main(["verify-stock"]) == 0


def test_read_before_lock_still_sees_the_value_after_the_lock(
    seeded: SeededBatch, lock: LockMethod
) -> None:
    holder, waiter = run_holder_then_waiter(seeded, read_first=True, lock=lock)

    assert holder.seen_before_lock == Decimal("10.000")
    assert waiter.seen_before_lock == Decimal("10.000")
    assert holder.succeeded, holder.unexpected
    assert waiter.seen_after_lock == Decimal("3.000")
    assert_insufficient_stock(waiter)
    assert_exactly_one_issue_and_remaining(seeded, "3.000")
    assert cli_main(["verify-stock"]) == 0


def test_batch_emptied_while_waiting_is_not_in_the_lock_result(seeded: SeededBatch) -> None:
    holder, waiter = run_holder_then_waiter(
        seeded, read_first=False, lock=lock_by_ingredient, holder_quantity=Decimal("10")
    )

    assert holder.succeeded, holder.unexpected
    assert waiter.unexpected is None
    assert waiter.error is None
    assert waiter.locked_batch_ids == []
    assert_exactly_one_issue_and_remaining(seeded, "0.000")
    assert cli_main(["verify-stock"]) == 0


@pytest.mark.parametrize("attempt", range(5))
def test_free_running_race_has_exactly_one_winner(
    seeded: SeededBatch, lock: LockMethod, attempt: int
) -> None:
    start = threading.Barrier(2)
    outcomes = [Outcome(), Outcome()]
    threads = [
        threading.Thread(
            target=lock_and_deduct,
            args=(seeded, outcome),
            kwargs={"lock": lock, "before_lock": lambda: start.wait(THREAD_TIMEOUT)},
        )
        for outcome in outcomes
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(THREAD_TIMEOUT)
    assert not any(thread.is_alive() for thread in threads)

    assert [outcome.unexpected for outcome in outcomes] == [None, None]
    assert sum(outcome.succeeded for outcome in outcomes) == 1
    assert_insufficient_stock(next(outcome for outcome in outcomes if not outcome.succeeded))
    assert_exactly_one_issue_and_remaining(seeded, "3.000")
    assert cli_main(["verify-stock"]) == 0
