"""報廢紀錄。每筆對應一筆 WASTE 類型的庫存異動。"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import WasteReason
from app.db.base import Base, IdMixin, enum_type
from app.db.models.inventory import InventoryBatch, InventoryTransaction
from app.db.models.master_data import Employee


class WasteRecord(IdMixin, Base):
    __tablename__ = "waste_record"
    __table_args__ = (
        UniqueConstraint("transaction_id"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
    )

    batch_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch.id"), index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("inventory_transaction.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    reason: Mapped[WasteReason] = mapped_column(enum_type(WasteReason, "reason"))
    note: Mapped[str | None] = mapped_column(Text)
    # 單價未知時為 NULL，不推算為零。
    loss_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    operator_id: Mapped[int] = mapped_column(ForeignKey("employee.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    batch: Mapped[InventoryBatch] = relationship(lazy="raise")
    transaction: Mapped[InventoryTransaction] = relationship(lazy="raise")
    operator: Mapped[Employee] = relationship(lazy="raise")
