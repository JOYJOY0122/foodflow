"""整批換位置 API，連真實 PostgreSQL：位置批次清單、換位置寫入、錯誤、權限與列鎖等待。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from time import monotonic, sleep

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text, update

from app.core.clock import FixedClock
from app.core.config import get_settings
from app.core.db import for_update, get_session_factory
from app.core.dependencies import get_clock
from app.core.enums import EmployeeRole, ErrorCode, GoodsReceiptStatus, TransactionType
from app.db.models import (
    BatchLocationChange,
    GoodsReceipt,
    GoodsReceiptItem,
    InventoryBatch,
    InventoryTransaction,
    StorageLocation,
)
from app.main import create_app
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from app.modules.storage_location.repository_sqlalchemy import (
    SqlAlchemyStorageLocationRepository,
)
from tests.integration.factories import (
    NOW,
    TODAY,
    add_employee,
    add_ingredient,
    add_location,
    make_token,
    op_for,
    receive_batch,
)


@pytest.fixture
def app():
    app = create_app()
    app.dependency_overrides[get_clock] = lambda: FixedClock(NOW)
    return app


def _client(app, employee_id: int) -> TestClient:
    client = TestClient(app)
    client.cookies.set(get_settings().auth_cookie_name, make_token(employee_id))
    return client


@pytest.fixture
def world():
    """管理者、一般員工、位置 A（有批次）、B（啟用）、C（啟用），與 A 上一個 5 kg 的批次。"""
    with get_session_factory()() as session:
        admin = add_employee(session, role=EmployeeRole.ADMIN)
        staff = add_employee(session)
        a, b, c = (add_location(session) for _ in range(3))
        ingredient = add_ingredient(session)
        batch = receive_batch(
            session,
            ingredient_id=ingredient.id,
            location_id=a.id,
            operator_id=admin.id,
            quantity="5",
        )
        session.commit()
        return {
            "admin": admin.id,
            "staff": staff.id,
            "a": a.id,
            "b": b.id,
            "c": c.id,
            "ingredient": ingredient.id,
            "batch": batch.id,
            "batch_number": batch.batch_number,
        }


def _move_url(batch_id: int) -> str:
    return f"/api/v1/inventory-batches/{batch_id}/location"


def _counts(batch_id: int) -> tuple[int, int]:
    with get_session_factory()() as session:
        changes = session.scalar(
            select(func.count())
            .select_from(BatchLocationChange)
            .where(BatchLocationChange.batch_id == batch_id)
        )
        transactions = session.scalar(
            select(func.count())
            .select_from(InventoryTransaction)
            .where(InventoryTransaction.batch_id == batch_id)
        )
        return changes, transactions


def _location_of(batch_id: int) -> int:
    with get_session_factory()() as session:
        return session.get_one(InventoryBatch, batch_id).current_location_id


def test_location_batches_list_only_stocked_batches_sorted_by_expiry(app, world) -> None:
    with get_session_factory()() as session:
        later = receive_batch(
            session,
            ingredient_id=world["ingredient"],
            location_id=world["a"],
            operator_id=world["admin"],
            expiry_date=TODAY + timedelta(days=60),
        )
        exhausted = receive_batch(
            session,
            ingredient_id=world["ingredient"],
            location_id=world["a"],
            operator_id=world["admin"],
            quantity="2",
        )
        ledger = SqlAlchemyStockLedger(session)
        [locked] = ledger.lock_batches([exhausted.id])
        ledger.deduct(locked, Decimal("2"), TransactionType.ISSUE, op_for(world["admin"]))
        receive_batch(
            session,
            ingredient_id=world["ingredient"],
            location_id=world["b"],
            operator_id=world["admin"],
        )
        session.commit()
        later_id = later.id

    response = _client(app, world["staff"]).get(f"/api/v1/storage-locations/{world['a']}/batches")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [item["id"] for item in body["items"]] == [world["batch"], later_id]
    first = body["items"][0]
    assert first["batch_number"] == world["batch_number"]
    assert (first["remaining_quantity"], first["unit"]) == ("5.000", "kg")
    assert first["current_location_id"] == world["a"]
    assert first["source_status"] == GoodsReceiptStatus.CONFIRMED
    assert first["ingredient_name"].startswith("食材")

    second_page = (
        _client(app, world["staff"])
        .get(f"/api/v1/storage-locations/{world['a']}/batches", params={"page": 2, "page_size": 1})
        .json()
    )
    assert ([item["id"] for item in second_page["items"]], second_page["total"]) == ([later_id], 2)


def test_location_batches_of_unknown_location_is_not_found(app, world) -> None:
    response = _client(app, world["staff"]).get("/api/v1/storage-locations/999999/batches")
    assert response.status_code == 404


def test_move_updates_location_and_records_change_without_quantity_transaction(app, world) -> None:
    client = _client(app, world["admin"])

    response = client.post(
        _move_url(world["batch"]), json={"to_location_id": world["b"], "reason": " 冷藏庫整理 "}
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["current_location_id"], body["remaining_quantity"]) == (world["b"], "5.000")
    with get_session_factory()() as session:
        target = session.get_one(StorageLocation, world["b"])
        assert (body["current_location_code"], body["current_location_name"]) == (
            target.code,
            target.name,
        )
        batch = session.get_one(InventoryBatch, world["batch"])
        assert (batch.current_location_id, batch.remaining_quantity) == (world["b"], Decimal("5"))
        assert batch.expiry_date == TODAY + timedelta(days=30)
        [change] = session.scalars(
            select(BatchLocationChange).where(BatchLocationChange.batch_id == world["batch"])
        ).all()
        assert (change.from_location_id, change.to_location_id) == (world["a"], world["b"])
        assert (change.operator_id, change.occurred_at, change.reason) == (
            world["admin"],
            NOW,
            "冷藏庫整理",
        )
    assert _counts(world["batch"]) == (1, 1)  # 只有原本的 RECEIPT

    listed = client.get(f"/api/v1/storage-locations/{world['b']}/batches").json()["items"]
    assert [item["id"] for item in listed] == [world["batch"]]
    assert client.get(f"/api/v1/storage-locations/{world['a']}/batches").json()["total"] == 0


def test_moving_to_current_location_is_a_no_op(app, world) -> None:
    response = _client(app, world["admin"]).post(
        _move_url(world["batch"]), json={"to_location_id": world["a"], "reason": "重送"}
    )

    assert response.status_code == 200
    assert response.json()["current_location_id"] == world["a"]
    assert _counts(world["batch"]) == (0, 1)


@pytest.mark.parametrize("reason", [None, "   "])
def test_blank_reason_is_validation_error(app, world, reason) -> None:
    body = {"to_location_id": world["b"]} | ({} if reason is None else {"reason": reason})

    response = _client(app, world["admin"]).post(_move_url(world["batch"]), json=body)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == ErrorCode.VALIDATION_ERROR
    assert [field["field"] for field in error["fields"]] == ["reason"]
    assert _location_of(world["batch"]) == world["a"]


@pytest.mark.parametrize("target", ["missing", "inactive"])
def test_missing_or_inactive_target_is_rule_violation(app, world, target) -> None:
    to_location_id = 999999 if target == "missing" else world["b"]
    if target == "inactive":
        with get_session_factory()() as session:
            session.execute(
                update(StorageLocation)
                .where(StorageLocation.id == world["b"])
                .values(is_active=False)
            )
            session.commit()

    response = _client(app, world["admin"]).post(
        _move_url(world["batch"]), json={"to_location_id": to_location_id, "reason": "整理"}
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == ErrorCode.RULE_VIOLATION
    assert [field["field"] for field in error["fields"]] == ["to_location_id"]
    assert _location_of(world["batch"]) == world["a"]


def test_batch_from_reversed_receipt_cannot_move(app, world) -> None:
    with get_session_factory()() as session:
        receipt_id = session.scalar(
            select(GoodsReceiptItem.receipt_id)
            .join(InventoryBatch, InventoryBatch.source_item_id == GoodsReceiptItem.id)
            .where(InventoryBatch.id == world["batch"])
        )
        session.execute(
            update(GoodsReceipt)
            .where(GoodsReceipt.id == receipt_id)
            .values(status=GoodsReceiptStatus.REVERSED)
        )
        session.commit()

    response = _client(app, world["admin"]).post(
        _move_url(world["batch"]), json={"to_location_id": world["b"], "reason": "整理"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ErrorCode.RULE_VIOLATION
    assert _location_of(world["batch"]) == world["a"]


def test_exhausted_batch_cannot_move(app, world) -> None:
    with get_session_factory()() as session:
        ledger = SqlAlchemyStockLedger(session)
        [locked] = ledger.lock_batches([world["batch"]])
        ledger.deduct(locked, Decimal("5"), TransactionType.ISSUE, op_for(world["admin"]))
        session.commit()

    response = _client(app, world["admin"]).post(
        _move_url(world["batch"]), json={"to_location_id": world["b"], "reason": "整理"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ErrorCode.RULE_VIOLATION
    assert _counts(world["batch"])[0] == 0


def test_unknown_batch_is_not_found(app, world) -> None:
    response = _client(app, world["admin"]).post(
        _move_url(999999), json={"to_location_id": world["b"], "reason": "整理"}
    )
    assert response.status_code == 404


def test_staff_cannot_move(app, world) -> None:
    response = _client(app, world["staff"]).post(
        _move_url(world["batch"]), json={"to_location_id": world["b"], "reason": "整理"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == ErrorCode.FORBIDDEN
    assert _location_of(world["batch"]) == world["a"]


def _wait_until_blocked(pid_holder) -> None:
    """等到有其他連線在等 pid_holder 持有的鎖，證明請求確實被列鎖擋住。"""
    deadline = monotonic() + 5
    with get_session_factory()() as observer:
        while True:
            waiting = observer.scalar(
                text(
                    "SELECT count(*) FROM pg_stat_activity WHERE :pid = ANY(pg_blocking_pids(pid))"
                ),
                {"pid": pid_holder},
            )
            if waiting:
                return
            # pg_stat_activity 在同一交易內是快照，要結束交易才會讀到新狀態。
            observer.rollback()
            assert monotonic() < deadline, "換位置請求沒有等待列鎖"
            sleep(0.01)


def test_move_waits_for_concurrent_deactivation_of_target(app, world) -> None:
    client = _client(app, world["admin"])
    # executor 在外層：失敗時 holder 先關閉並 rollback 釋放鎖，執行緒才結束得了。
    with ThreadPoolExecutor(max_workers=1) as executor, get_session_factory()() as holder:
        # 模擬 2.1 的停用：先鎖位置 B 再改狀態，尚未 commit。
        target = holder.scalar(
            for_update(select(StorageLocation).where(StorageLocation.id == world["b"]))
        )
        target.is_active = False
        holder.flush()
        pid = holder.scalar(text("SELECT pg_backend_pid()"))

        pending = executor.submit(
            client.post,
            _move_url(world["batch"]),
            json={"to_location_id": world["b"], "reason": "整理"},
        )
        _wait_until_blocked(pid)
        assert not pending.done()
        holder.commit()
        response = pending.result(timeout=10)

    assert response.status_code == 422
    assert _location_of(world["batch"]) == world["a"]


def test_concurrent_move_of_same_batch_uses_latest_location(app, world) -> None:
    client = _client(app, world["admin"])
    # executor 在外層：失敗時 holder 先關閉並 rollback 釋放鎖，執行緒才結束得了。
    with ThreadPoolExecutor(max_workers=1) as executor, get_session_factory()() as holder:
        ledger = SqlAlchemyStockLedger(holder)
        [locked] = ledger.lock_batches([world["batch"]])
        ledger.move(locked, world["c"], op_for(world["admin"], "先移到 C"))
        pid = holder.scalar(text("SELECT pg_backend_pid()"))

        pending = executor.submit(
            client.post,
            _move_url(world["batch"]),
            json={"to_location_id": world["b"], "reason": "再移到 B"},
        )
        _wait_until_blocked(pid)
        assert not pending.done()
        holder.commit()
        response = pending.result(timeout=10)

    assert response.status_code == 200
    assert response.json()["current_location_id"] == world["b"]
    assert _location_of(world["batch"]) == world["b"]
    with get_session_factory()() as session:
        changes = session.scalars(
            select(BatchLocationChange)
            .where(BatchLocationChange.batch_id == world["batch"])
            .order_by(BatchLocationChange.id)
        ).all()
        assert [(c.from_location_id, c.to_location_id) for c in changes] == [
            (world["a"], world["c"]),
            (world["c"], world["b"]),
        ]


def test_concurrent_swap_between_two_locations_does_not_deadlock(app, world) -> None:
    """批次 1 由 A 移 B、批次 2 由 B 移 A 同時進行：目標位置鎖不可擋 FK 的 KEY SHARE。"""
    with get_session_factory()() as session:
        other = receive_batch(
            session,
            ingredient_id=world["ingredient"],
            location_id=world["b"],
            operator_id=world["admin"],
        )
        session.commit()
        other_id = other.id
    client = _client(app, world["admin"])
    # executor 在外層：失敗時 holder 先關閉並 rollback 釋放鎖，執行緒才結束得了。
    with ThreadPoolExecutor(max_workers=1) as executor, get_session_factory()() as holder:
        # holder 走與 Service 相同的順序：鎖批次 → 鎖目標位置 → move，但先不 commit。
        ledger = SqlAlchemyStockLedger(holder)
        [locked] = ledger.lock_batches([world["batch"]])
        SqlAlchemyStorageLocationRepository(holder).lock_as_move_target(world["b"])
        ledger.move(locked, world["b"], op_for(world["admin"], "A 到 B"))

        pending = executor.submit(
            client.post,
            _move_url(other_id),
            json={"to_location_id": world["a"], "reason": "B 到 A"},
        )
        response = pending.result(timeout=10)
        holder.commit()

    assert response.status_code == 200
    assert _location_of(world["batch"]) == world["b"]
    assert _location_of(other_id) == world["a"]
