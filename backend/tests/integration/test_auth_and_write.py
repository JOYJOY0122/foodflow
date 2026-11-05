"""骨架交付清單：帶登入 cookie 的寫入，以獨立 Session 確認資料確實落地。

寫入路由只存在於測試，由 create_app(extra_api_routers=...) 注入。
"""

from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import Clock, FixedClock
from app.core.config import get_settings
from app.core.db import get_session_factory
from app.core.dependencies import get_clock, get_session, get_uow
from app.core.enums import EmployeeRole, ErrorCode, TransactionType
from app.core.errors import DomainError
from app.core.types import NonNegativeQuantity, PositiveQuantity
from app.core.uow import UnitOfWork
from app.db.models import Employee, InventoryBatch, InventoryTransaction
from app.main import create_app
from app.modules.auth.dependencies import get_current_employee, require_admin
from app.modules.inventory.ledger import StockOp
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.integration.factories import NOW, SeededBatch, add_employee, make_token, seed_batch


class DeductionRequest(BaseModel):
    batch_id: int
    quantity: PositiveQuantity


class DeductionResponse(BaseModel):
    transaction_id: int
    operator_id: int
    quantity_after: NonNegativeQuantity


write_router = APIRouter()


@write_router.post("/test-deductions", response_model=DeductionResponse)
def create_test_deduction(
    body: DeductionRequest,
    session: Session = Depends(get_session),
    uow: UnitOfWork = Depends(get_uow),
    clock: Clock = Depends(get_clock),
    employee: Employee = Depends(get_current_employee),
) -> DeductionResponse:
    ledger = SqlAlchemyStockLedger(session)
    op = StockOp(uuid4(), employee.id, clock.now())
    with uow.transaction():
        batches = ledger.lock_batches([body.batch_id])
        if not batches:
            raise DomainError(ErrorCode.NOT_FOUND, "找不到批次")
        transaction = ledger.deduct(batches[0], body.quantity, TransactionType.ISSUE, op)
    return DeductionResponse(
        transaction_id=transaction.id,
        operator_id=transaction.operator_id,
        quantity_after=transaction.quantity_after,
    )


@write_router.get("/test-admin-only")
def read_admin_only(admin: Employee = Depends(require_admin)) -> dict[str, int]:
    return {"id": admin.id}


@pytest.fixture
def app():
    application = create_app(extra_api_routers=[write_router])
    application.dependency_overrides[get_clock] = lambda: FixedClock(NOW)
    return application


@pytest.fixture
def seeded() -> SeededBatch:
    with get_session_factory()() as session:
        return seed_batch(session, quantity="10")


def _client(app, token: str | None = None) -> TestClient:
    client = TestClient(app)
    if token is not None:
        client.cookies.set(get_settings().auth_cookie_name, token)
    return client


def _post(client: TestClient, batch_id: int, quantity: object = "2.5"):
    return client.post("/api/v1/test-deductions", json={"batch_id": batch_id, "quantity": quantity})


def test_write_with_cookie_is_visible_from_another_session(app, seeded: SeededBatch) -> None:
    response = _post(_client(app, make_token(seeded.operator_id)), seeded.batch_id)

    assert response.status_code == 200
    assert response.json()["quantity_after"] == "7.500"
    assert response.json()["operator_id"] == seeded.operator_id

    with get_session_factory()() as other_session:
        batch = other_session.get_one(InventoryBatch, seeded.batch_id)
        transaction = other_session.scalar(
            select(InventoryTransaction).where(
                InventoryTransaction.id == response.json()["transaction_id"]
            )
        )
    assert batch.remaining_quantity == Decimal("7.500")
    assert transaction.type is TransactionType.ISSUE
    assert transaction.operator_id == seeded.operator_id
    assert transaction.occurred_at == NOW


def test_over_deduct_returns_409_in_unified_format_and_rolls_back(app, seeded: SeededBatch) -> None:
    response = _post(_client(app, make_token(seeded.operator_id)), seeded.batch_id, "10.001")

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "INSUFFICIENT_STOCK",
            "message": "可用量不足",
            "details": {
                "batch_id": seeded.batch_id,
                "remaining_quantity": "10.000",
                "available_quantity": None,
            },
            "fields": [],
        }
    }
    with get_session_factory()() as other_session:
        batch = other_session.get_one(InventoryBatch, seeded.batch_id)
    assert batch.remaining_quantity == Decimal("10.000")


@pytest.mark.parametrize("quantity", [2.5, "1e2", "1.2345", " 1 ", "0"])
def test_invalid_quantity_returns_422_with_field_path(
    app, seeded: SeededBatch, quantity: object
) -> None:
    response = _post(_client(app, make_token(seeded.operator_id)), seeded.batch_id, quantity)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert [field["field"] for field in error["fields"]] == ["quantity"]


def _assert_unauthenticated(response) -> None:
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
    assert response.json()["error"]["fields"] == []


def test_no_cookie_returns_401(app, seeded: SeededBatch) -> None:
    _assert_unauthenticated(_post(_client(app), seeded.batch_id))


def test_garbage_cookie_returns_401(app, seeded: SeededBatch) -> None:
    _assert_unauthenticated(_post(_client(app, "not-a-jwt"), seeded.batch_id))


def test_token_signed_with_other_secret_returns_401(app, seeded: SeededBatch) -> None:
    token = make_token(seeded.operator_id, secret="another-secret-that-is-also-32-bytes-long")
    _assert_unauthenticated(_post(_client(app, token), seeded.batch_id))


def test_non_numeric_subject_returns_401(app, seeded: SeededBatch) -> None:
    _assert_unauthenticated(_post(_client(app, make_token("abc")), seeded.batch_id))


def test_unknown_employee_returns_401(app, seeded: SeededBatch) -> None:
    _assert_unauthenticated(_post(_client(app, make_token(999_999)), seeded.batch_id))


def test_expired_token_is_judged_by_the_injected_clock(app, seeded: SeededBatch) -> None:
    token = make_token(seeded.operator_id, expires_at=NOW)
    _assert_unauthenticated(_post(_client(app, token), seeded.batch_id))

    # 實際時間早已超過 2020 年的到期時間，但固定時鐘下仍有效（AD-15、C5）。
    past = NOW - timedelta(days=2000)
    app.dependency_overrides[get_clock] = lambda: FixedClock(past)
    token = make_token(seeded.operator_id, expires_at=past + timedelta(hours=1))
    assert _post(_client(app, token), seeded.batch_id).status_code == 200


def test_deducting_everything_returns_zero(app, seeded: SeededBatch) -> None:
    response = _post(_client(app, make_token(seeded.operator_id)), seeded.batch_id, "10")

    assert response.status_code == 200
    assert response.json()["quantity_after"] == "0.000"


@pytest.mark.parametrize("claim", ["sub", "exp", "token_version"])
def test_token_missing_claim_returns_401(app, seeded: SeededBatch, claim: str) -> None:
    token = make_token(seeded.operator_id, omit={claim})
    _assert_unauthenticated(_post(_client(app, token), seeded.batch_id))


def test_token_version_mismatch_returns_401(app, seeded: SeededBatch) -> None:
    token = make_token(seeded.operator_id, token_version=1)
    _assert_unauthenticated(_post(_client(app, token), seeded.batch_id))


def test_deactivated_employee_returns_401(app, seeded: SeededBatch) -> None:
    with get_session_factory()() as session:
        session.get_one(Employee, seeded.operator_id).is_active = False
        session.commit()
    token = make_token(seeded.operator_id)
    _assert_unauthenticated(_post(_client(app, token), seeded.batch_id))


def test_require_admin(app, seeded: SeededBatch) -> None:
    with get_session_factory()() as session:
        admin_id = add_employee(session, role=EmployeeRole.ADMIN).id
        session.commit()

    staff = _client(app, make_token(seeded.operator_id)).get("/api/v1/test-admin-only")
    assert staff.status_code == 403
    assert staff.json()["error"]["code"] == "FORBIDDEN"

    admin = _client(app, make_token(admin_id)).get("/api/v1/test-admin-only")
    assert admin.status_code == 200
    assert admin.json() == {"id": admin_id}
