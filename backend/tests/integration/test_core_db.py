"""core 的 UnitOfWork、flush_or_raise、Session 設定，在真實 PostgreSQL 上驗證。"""

from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_session_factory
from app.core.enums import ErrorCode, GoodsReceiptStatus
from app.core.errors import DomainError, flush_or_raise
from app.core.uow import SqlAlchemyUnitOfWork
from app.db.models import Employee, GoodsReceipt, InventoryBatch, Supplier
from tests.integration.factories import NOW, TODAY, add_employee, seed_batch


def _supplier_exists(name: str) -> bool:
    with get_session_factory()() as other_session:
        return other_session.scalar(select(Supplier).where(Supplier.name == name)) is not None


def test_session_settings(session: Session) -> None:
    assert session.scalar(text("SHOW transaction_isolation")) == "read committed"
    assert session.expire_on_commit is False
    assert session.autoflush is True


def test_transaction_commits_when_block_ends(session: Session) -> None:
    with SqlAlchemyUnitOfWork(session).transaction():
        session.add(Supplier(name="落地測試", is_active=True))
    assert _supplier_exists("落地測試")


def test_transaction_rolls_back_on_exception(session: Session) -> None:
    with pytest.raises(RuntimeError, match="boom"):
        with SqlAlchemyUnitOfWork(session).transaction():
            session.add(Supplier(name="回滾測試", is_active=True))
            session.flush()
            raise RuntimeError("boom")
    assert not _supplier_exists("回滾測試")


def test_transaction_cannot_be_nested(session: Session) -> None:
    uow = SqlAlchemyUnitOfWork(session)
    with pytest.raises(RuntimeError, match="巢狀"):
        with uow.transaction():
            with uow.transaction():
                pass
    # 離開後可以再次使用。
    with uow.transaction():
        pass


def test_flush_maps_unique_constraint_by_name(session: Session) -> None:
    employee = add_employee(session)
    session.add(
        Employee(
            username=employee.username,
            password_hash="x",
            name="重複",
            role=employee.role,
            created_at=employee.created_at,
        )
    )
    with pytest.raises(DomainError) as caught:
        flush_or_raise(session)
    assert caught.value.code is ErrorCode.DUPLICATE


def test_flush_maps_negative_remaining_to_insufficient_stock(session: Session) -> None:
    seeded = seed_batch(session)
    session.get_one(InventoryBatch, seeded.batch_id).remaining_quantity = Decimal("-1")
    with pytest.raises(DomainError) as caught:
        flush_or_raise(session)
    assert caught.value.code is ErrorCode.INSUFFICIENT_STOCK


def test_flush_constraint_errors_can_be_overridden(session: Session) -> None:
    employee = add_employee(session)
    session.add(
        Employee(
            username=employee.username,
            password_hash="x",
            name="重複",
            role=employee.role,
            created_at=employee.created_at,
        )
    )
    custom = DomainError(ErrorCode.STATE_CONFLICT, "自訂訊息")
    with pytest.raises(DomainError) as caught:
        flush_or_raise(session, {"uq_employee_username": custom})
    assert caught.value is custom


def test_flush_reraises_unmapped_constraints(session: Session) -> None:
    employee = add_employee(session)
    session.add(
        GoodsReceipt(
            supplier_id=999_999,
            receipt_date=TODAY,
            status=GoodsReceiptStatus.DRAFT,
            created_by_id=employee.id,
            created_at=NOW,
        )
    )
    with pytest.raises(IntegrityError) as caught:
        flush_or_raise(session)
    assert caught.value.orig.diag.constraint_name == "fk_goods_receipt_supplier_id_supplier"
