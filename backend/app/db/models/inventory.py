"""庫存批次、庫存異動、位置變更。寫入者只有 StockLedger（AD-4、AD-5）。"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import TransactionType
from app.db.base import Base, IdMixin, enum_type
from app.db.models.goods_receipt import GoodsReceiptItem
from app.db.models.master_data import Employee, Ingredient, StorageLocation


class InventoryBatch(IdMixin, Base):
    __tablename__ = "inventory_batch"
    __table_args__ = (
        UniqueConstraint("batch_number"),
        UniqueConstraint("source_item_id"),
        CheckConstraint("initial_quantity > 0", name="initial_quantity_positive"),
        CheckConstraint("remaining_quantity >= 0", name="remaining_quantity_non_negative"),
        CheckConstraint("unit_price >= 0", name="unit_price_non_negative"),
    )

    batch_number: Mapped[str] = mapped_column(String(32))
    source_item_id: Mapped[int] = mapped_column(ForeignKey("goods_receipt_item.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredient.id"), index=True)
    expiry_date: Mapped[date] = mapped_column(Date)
    # FEFO 依進貨日排序而鎖定查詢不可 join，所以由 receive 寫入一份不可變副本。
    received_date: Mapped[date] = mapped_column(Date)
    current_location_id: Mapped[int] = mapped_column(ForeignKey("storage_location.id"))
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    initial_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))

    source_item: Mapped[GoodsReceiptItem] = relationship(lazy="raise")
    ingredient: Mapped[Ingredient] = relationship(lazy="raise")
    current_location: Mapped[StorageLocation] = relationship(lazy="raise")


class InventoryTransaction(IdMixin, Base):
    __tablename__ = "inventory_transaction"
    __table_args__ = (
        UniqueConstraint("operation_group_id", "batch_id"),
        UniqueConstraint("reverses_transaction_id"),
        CheckConstraint(
            "(type = 'REVERSAL') = (reverses_transaction_id IS NOT NULL)",
            name="reversal_link",
        ),
        CheckConstraint("quantity_after >= 0", name="quantity_after_non_negative"),
        CheckConstraint(
            "quantity_after = quantity_before + quantity_delta",
            name="quantity_balance",
        ),
    )

    operation_group_id: Mapped[UUID] = mapped_column(Uuid)
    batch_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(enum_type(TransactionType, "type"))
    quantity_delta: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    quantity_before: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    quantity_after: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    operator_id: Mapped[int] = mapped_column(ForeignKey("employee.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    reason: Mapped[str] = mapped_column(Text)
    is_non_fefo: Mapped[bool] = mapped_column(Boolean, default=False)
    reverses_transaction_id: Mapped[int | None] = mapped_column(
        # 自動命名會超過 PostgreSQL 的 63 字元上限，所以明確命名。
        ForeignKey("inventory_transaction.id", name="fk_inventory_transaction_reverses")
    )

    batch: Mapped[InventoryBatch] = relationship(lazy="raise")
    operator: Mapped[Employee] = relationship(lazy="raise")
    reverses: Mapped["InventoryTransaction | None"] = relationship(
        remote_side="InventoryTransaction.id", lazy="raise"
    )


class BatchLocationChange(IdMixin, Base):
    __tablename__ = "batch_location_change"

    batch_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch.id"), index=True)
    from_location_id: Mapped[int] = mapped_column(ForeignKey("storage_location.id"))
    to_location_id: Mapped[int] = mapped_column(ForeignKey("storage_location.id"))
    operator_id: Mapped[int] = mapped_column(ForeignKey("employee.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text)

    batch: Mapped[InventoryBatch] = relationship(lazy="raise")
    from_location: Mapped[StorageLocation] = relationship(
        foreign_keys=[from_location_id], lazy="raise"
    )
    to_location: Mapped[StorageLocation] = relationship(foreign_keys=[to_location_id], lazy="raise")
    operator: Mapped[Employee] = relationship(lazy="raise")
