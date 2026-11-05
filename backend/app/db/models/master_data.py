"""員工、食材分類、食材、供應商、儲存位置。"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import EmployeeRole, StorageType
from app.db.base import Base, IdMixin, enum_type


class Employee(IdMixin, Base):
    __tablename__ = "employee"
    __table_args__ = (UniqueConstraint("username"),)

    username: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[EmployeeRole] = mapped_column(enum_type(EmployeeRole, "role"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class IngredientCategory(IdMixin, Base):
    __tablename__ = "ingredient_category"
    __table_args__ = (UniqueConstraint("code"),)

    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Ingredient(IdMixin, Base):
    __tablename__ = "ingredient"
    __table_args__ = (
        UniqueConstraint("name"),
        CheckConstraint("safety_stock_quantity >= 0", name="safety_stock_quantity_non_negative"),
    )

    name: Mapped[str] = mapped_column(String(100))
    category_id: Mapped[int] = mapped_column(ForeignKey("ingredient_category.id"))
    unit: Mapped[str] = mapped_column(String(16))
    storage_method: Mapped[StorageType] = mapped_column(enum_type(StorageType, "storage_method"))
    safety_stock_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    category: Mapped[IngredientCategory] = relationship(lazy="raise")


class Supplier(IdMixin, Base):
    __tablename__ = "supplier"

    name: Mapped[str] = mapped_column(String(100))
    contact_person: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(32))
    other_contact: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StorageLocation(IdMixin, Base):
    __tablename__ = "storage_location"
    __table_args__ = (UniqueConstraint("code"),)

    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(100))
    storage_type: Mapped[StorageType] = mapped_column(enum_type(StorageType, "storage_type"))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
