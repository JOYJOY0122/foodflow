"""整合測試用的資料建立工具。批次一律經由 StockLedger.receive 建立，與正式路徑相同。"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from itertools import count
from uuid import uuid4

import jwt
from sqlalchemy.orm import Session

from app.core.enums import EmployeeRole, GoodsReceiptStatus, StorageType
from app.db.models import (
    Employee,
    GoodsReceipt,
    GoodsReceiptItem,
    Ingredient,
    IngredientCategory,
    InventoryBatch,
    StorageLocation,
    Supplier,
)
from app.modules.inventory.ledger import StockOp
from app.modules.inventory.ledger_sqlalchemy import SqlAlchemyStockLedger
from tests.conftest import TEST_JWT_SECRET

NOW = datetime(2026, 11, 6, 2, 0, tzinfo=UTC)
TODAY = date(2026, 11, 6)  # NOW 在 Asia/Taipei 的日期
_sequence = count(1)


def add_employee(session: Session, **overrides) -> Employee:
    number = next(_sequence)
    values = {
        "username": f"user{number}",
        "password_hash": "not-a-real-hash",
        "name": f"員工{number}",
        "role": EmployeeRole.STAFF,
        "is_active": True,
        "token_version": 0,
        "created_at": NOW,
    }
    employee = Employee(**(values | overrides))
    session.add(employee)
    session.flush()
    return employee


def add_location(session: Session) -> StorageLocation:
    number = next(_sequence)
    location = StorageLocation(
        code=f"L{number}",
        name=f"位置{number}",
        storage_type=StorageType.REFRIGERATED,
        is_active=True,
    )
    session.add(location)
    session.flush()
    return location


def add_ingredient(session: Session, safety: str = "0", is_active: bool = True) -> Ingredient:
    number = next(_sequence)
    category = IngredientCategory(
        code=f"C{number}", name=f"分類{number}", is_active=True, created_at=NOW
    )
    session.add(category)
    session.flush()
    ingredient = Ingredient(
        name=f"食材{number}",
        category_id=category.id,
        unit="kg",
        storage_method=StorageType.REFRIGERATED,
        safety_stock_quantity=Decimal(safety),
        is_active=is_active,
        created_at=NOW,
    )
    session.add(ingredient)
    session.flush()
    return ingredient


def add_item(
    session: Session,
    *,
    ingredient_id: int,
    location_id: int,
    operator_id: int,
    quantity: str = "10",
    expiry_date: date = TODAY + timedelta(days=30),
    receipt_date: date = TODAY,
    unit_price: str | None = "100.00",
) -> GoodsReceiptItem:
    supplier = Supplier(name=f"供應商{next(_sequence)}", is_active=True)
    session.add(supplier)
    session.flush()
    receipt = GoodsReceipt(
        supplier_id=supplier.id,
        receipt_date=receipt_date,
        status=GoodsReceiptStatus.CONFIRMED,
        created_by_id=operator_id,
        created_at=NOW,
    )
    session.add(receipt)
    session.flush()
    item = GoodsReceiptItem(
        receipt_id=receipt.id,
        ingredient_id=ingredient_id,
        quantity=Decimal(quantity),
        unit_price=None if unit_price is None else Decimal(unit_price),
        expiry_date=expiry_date,
        location_id=location_id,
    )
    session.add(item)
    session.flush()
    return item


def op_for(operator_id: int, reason: str | None = None) -> StockOp:
    return StockOp(
        operation_group_id=uuid4(), operator_id=operator_id, occurred_at=NOW, reason=reason
    )


@dataclass(frozen=True)
class SeededBatch:
    batch_id: int
    ingredient_id: int
    location_id: int
    operator_id: int


def seed_batch(session: Session, quantity: str = "10") -> SeededBatch:
    """建立員工、食材、位置與一個已入帳的批次，並 commit。"""
    employee = add_employee(session)
    ingredient = add_ingredient(session)
    location = add_location(session)
    item = add_item(
        session,
        ingredient_id=ingredient.id,
        location_id=location.id,
        operator_id=employee.id,
        quantity=quantity,
    )
    transaction = SqlAlchemyStockLedger(session).receive(item, op_for(employee.id))
    session.commit()
    return SeededBatch(transaction.batch_id, ingredient.id, location.id, employee.id)


def receive_batch(
    session: Session,
    *,
    ingredient_id: int,
    location_id: int,
    operator_id: int,
    quantity: str = "10",
    expiry_date: date = TODAY + timedelta(days=30),
) -> InventoryBatch:
    item = add_item(
        session,
        ingredient_id=ingredient_id,
        location_id=location_id,
        operator_id=operator_id,
        quantity=quantity,
        expiry_date=expiry_date,
    )
    transaction = SqlAlchemyStockLedger(session).receive(item, op_for(operator_id))
    return session.get_one(InventoryBatch, transaction.batch_id)


def make_token(
    employee_id: int | str,
    *,
    token_version: int = 0,
    expires_at: datetime = NOW + timedelta(hours=12),
    secret: str = TEST_JWT_SECRET,
    omit: Collection[str] = (),
) -> str:
    claims = {
        "sub": str(employee_id),
        "token_version": token_version,
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(
        {name: value for name, value in claims.items() if name not in omit},
        secret,
        algorithm="HS256",
    )
