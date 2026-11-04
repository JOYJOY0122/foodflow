from decimal import Decimal

import pytest
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.cli import find_stock_discrepancies, main
from app.core.enums import TransactionType, WasteReason
from app.db.models import InventoryBatch, InventoryTransaction, WasteRecord
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.integration.factories import (
    NOW,
    TODAY,
    add_employee,
    add_ingredient,
    add_item,
    add_location,
    op_for,
    seed_batch,
)


def test_consistent_stock_passes(session: Session, capsys: pytest.CaptureFixture[str]) -> None:
    seed_batch(session)

    assert main(["verify-stock"]) == 0
    assert "通過" in capsys.readouterr().out


def test_batch_without_any_transaction_fails(
    session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    employee = add_employee(session)
    ingredient = add_ingredient(session)
    location = add_location(session)
    item = add_item(
        session,
        ingredient_id=ingredient.id,
        location_id=location.id,
        operator_id=employee.id,
    )
    session.add(
        InventoryBatch(
            batch_number=f"B-{item.id:08d}",
            source_item_id=item.id,
            ingredient_id=ingredient.id,
            expiry_date=TODAY,
            received_date=TODAY,
            current_location_id=location.id,
            initial_quantity=Decimal("5"),
            remaining_quantity=Decimal("5"),
        )
    )
    session.commit()

    assert main(["verify-stock"]) != 0
    assert "異動合計" in capsys.readouterr().err


def test_remaining_quantity_mismatch_fails(
    session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    seeded = seed_batch(session)
    session.execute(
        update(InventoryBatch)
        .where(InventoryBatch.id == seeded.batch_id)
        .values(remaining_quantity=Decimal("9"))
    )
    session.commit()

    assert main(["verify-stock"]) == 1
    errors = capsys.readouterr().err
    assert "異動合計" in errors
    assert "quantity_after" in errors


def test_latest_quantity_after_mismatch_fails(session: Session) -> None:
    seeded = seed_batch(session)
    # 差額合計與剩餘量相同，只有最新一筆 quantity_after 錯，check constraint 也要同步繞過。
    session.execute(
        update(InventoryTransaction)
        .where(InventoryTransaction.batch_id == seeded.batch_id)
        .values(quantity_before=Decimal("1"), quantity_after=Decimal("11"))
    )
    session.commit()

    problems = find_stock_discrepancies(session)

    assert len(problems) == 1
    assert "quantity_after" in problems[0]


def _deduct_waste(session: Session, seeded):
    ledger = SqlAlchemyStockLedger(session)
    batch = ledger.lock_batches([seeded.batch_id])[0]
    return ledger.deduct(batch, Decimal("1"), TransactionType.WASTE, op_for(seeded.operator_id))


def test_waste_transaction_without_record_fails(session: Session) -> None:
    seeded = seed_batch(session)
    _deduct_waste(session, seeded)
    session.commit()

    problems = find_stock_discrepancies(session)

    assert len(problems) == 1
    assert "報廢紀錄" in problems[0]
    assert main(["verify-stock"]) == 1


def test_waste_transaction_with_record_passes(session: Session) -> None:
    seeded = seed_batch(session)
    transaction = _deduct_waste(session, seeded)
    session.add(
        WasteRecord(
            batch_id=seeded.batch_id,
            transaction_id=transaction.id,
            quantity=Decimal("1"),
            reason=WasteReason.EXPIRED,
            loss_amount=Decimal("100.00"),
            operator_id=seeded.operator_id,
            occurred_at=NOW,
        )
    )
    session.commit()

    assert find_stock_discrepancies(session) == []
