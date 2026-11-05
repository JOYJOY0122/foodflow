"""AD-21、AD-11 對照測試：SQL 結果與 Domain 判定必須一致。"""

from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import TransactionType
from app.db.models import InventoryBatch
from app.db.queries.stock_levels import stock_level_stmt
from app.domain.expiry import is_available
from app.domain.stock import is_low_stock, shortfall
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.integration.factories import (
    TODAY,
    add_employee,
    add_ingredient,
    add_location,
    op_for,
    receive_batch,
)

YESTERDAY = TODAY - timedelta(days=1)
TOMORROW = TODAY + timedelta(days=1)


def _row(session: Session, ingredient_id: int, location_id: int | None = None):
    rows = session.execute(stock_level_stmt(TODAY, location_id)).all()
    return next(row for row in rows if row.ingredient_id == ingredient_id)


def _assert_matches_domain(session: Session, row) -> None:
    """用 Domain 重新計算一次，比對 SQL 的可用量與過期量。"""
    batches = session.scalars(
        select(InventoryBatch).where(InventoryBatch.ingredient_id == row.ingredient_id)
    ).all()
    available = sum(
        (b.remaining_quantity for b in batches if is_available(b.expiry_date, TODAY)),
        Decimal("0"),
    )
    physical = sum((b.remaining_quantity for b in batches), Decimal("0"))
    assert row.store_available_quantity == available
    assert row.available_quantity == available
    assert row.physical_quantity == physical
    assert row.expired_quantity == physical - available


@pytest.fixture
def people(session: Session) -> dict[str, int]:
    return {
        "operator_id": add_employee(session).id,
        "location_id": add_location(session).id,
    }


def test_ingredient_without_batches_is_included_and_low(session, people) -> None:
    ingredient = add_ingredient(session, safety="5")

    row = _row(session, ingredient.id)

    assert (row.physical_quantity, row.available_quantity, row.expired_quantity) == (0, 0, 0)
    assert is_low_stock(row.store_available_quantity, row.safety_stock_quantity)
    assert shortfall(row.store_available_quantity, row.safety_stock_quantity) == Decimal("5")


def test_all_expired_counts_as_physical_but_not_available(session, people) -> None:
    ingredient = add_ingredient(session, safety="1")
    receive_batch(session, ingredient_id=ingredient.id, expiry_date=YESTERDAY, **people)

    row = _row(session, ingredient.id)

    _assert_matches_domain(session, row)
    assert row.physical_quantity == Decimal("10")
    assert row.available_quantity == 0
    assert row.expired_quantity == Decimal("10")
    assert is_low_stock(row.store_available_quantity, row.safety_stock_quantity)


def test_expiring_today_is_still_available(session, people) -> None:
    ingredient = add_ingredient(session)
    receive_batch(session, ingredient_id=ingredient.id, expiry_date=TODAY, **people)
    receive_batch(session, ingredient_id=ingredient.id, expiry_date=TOMORROW, **people)
    receive_batch(session, ingredient_id=ingredient.id, expiry_date=YESTERDAY, **people)

    row = _row(session, ingredient.id)

    _assert_matches_domain(session, row)
    assert row.available_quantity == Decimal("20")
    assert row.expired_quantity == Decimal("10")


def test_available_equal_to_safety_is_low(session, people) -> None:
    ingredient = add_ingredient(session, safety="10")
    receive_batch(session, ingredient_id=ingredient.id, **people)

    row = _row(session, ingredient.id)

    _assert_matches_domain(session, row)
    assert is_low_stock(row.store_available_quantity, row.safety_stock_quantity)
    assert shortfall(row.store_available_quantity, row.safety_stock_quantity) == 0


def test_safety_zero_is_never_low(session, people) -> None:
    ingredient = add_ingredient(session, safety="0")

    row = _row(session, ingredient.id)

    assert not is_low_stock(row.store_available_quantity, row.safety_stock_quantity)


def test_location_filter_only_affects_display_quantities(session, people) -> None:
    ingredient = add_ingredient(session, safety="15")
    other_location = add_location(session).id
    receive_batch(session, ingredient_id=ingredient.id, **people)
    receive_batch(
        session,
        ingredient_id=ingredient.id,
        operator_id=people["operator_id"],
        location_id=other_location,
    )

    row = _row(session, ingredient.id, other_location)

    assert row.physical_quantity == Decimal("10")
    assert row.available_quantity == Decimal("10")
    assert row.store_available_quantity == Decimal("20")
    assert not is_low_stock(row.store_available_quantity, row.safety_stock_quantity)

    empty_location = add_location(session).id
    filtered_out = _row(session, ingredient.id, empty_location)
    assert filtered_out.physical_quantity == 0
    assert filtered_out.store_available_quantity == Decimal("20")


def test_location_filter_only_counts_expired_batches_in_that_location(session, people) -> None:
    ingredient = add_ingredient(session)
    other_location = add_location(session).id
    receive_batch(
        session, ingredient_id=ingredient.id, quantity="4", expiry_date=YESTERDAY, **people
    )
    receive_batch(
        session,
        ingredient_id=ingredient.id,
        operator_id=people["operator_id"],
        location_id=other_location,
        quantity="6",
        expiry_date=YESTERDAY,
    )

    assert _row(session, ingredient.id, people["location_id"]).expired_quantity == Decimal("4")
    assert _row(session, ingredient.id, other_location).expired_quantity == Decimal("6")
    assert _row(session, ingredient.id).expired_quantity == Decimal("10")


def test_depleted_batch_contributes_nothing(session, people) -> None:
    ingredient = add_ingredient(session)
    batch = receive_batch(session, ingredient_id=ingredient.id, **people)
    ledger = SqlAlchemyStockLedger(session)
    ledger.lock_batches([batch.id])
    ledger.deduct(batch, Decimal("10"), TransactionType.ISSUE, op_for(people["operator_id"]))

    row = _row(session, ingredient.id)

    assert row.physical_quantity == 0
    assert row.available_quantity == 0


def test_inactive_ingredient_exposes_flag_for_the_rule(session, people) -> None:
    ingredient = add_ingredient(session, safety="5", is_active=False)

    assert _row(session, ingredient.id).is_active is False
