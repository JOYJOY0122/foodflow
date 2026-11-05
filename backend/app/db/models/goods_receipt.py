"""進貨單與進貨明細。草稿階段到期日、數量、位置可為空（A4）。"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import GoodsReceiptStatus
from app.db.base import Base, IdMixin, enum_type
from app.db.models.master_data import Employee, Ingredient, StorageLocation, Supplier


class GoodsReceipt(IdMixin, Base):
    __tablename__ = "goods_receipt"

    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id"))
    receipt_date: Mapped[date] = mapped_column(Date)
    status: Mapped[GoodsReceiptStatus] = mapped_column(enum_type(GoodsReceiptStatus, "status"))
    created_by_id: Mapped[int] = mapped_column(ForeignKey("employee.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    supplier: Mapped[Supplier] = relationship(lazy="raise")
    created_by: Mapped[Employee] = relationship(lazy="raise")
    items: Mapped[list["GoodsReceiptItem"]] = relationship(
        back_populates="receipt", lazy="raise", order_by="GoodsReceiptItem.id"
    )

    @property
    def receipt_number(self) -> str:
        return f"GR-{self.id:08d}"


class GoodsReceiptItem(IdMixin, Base):
    __tablename__ = "goods_receipt_item"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_non_negative"),
    )

    receipt_id: Mapped[int] = mapped_column(ForeignKey("goods_receipt.id"), index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredient.id"))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    expiry_date: Mapped[date | None] = mapped_column(Date)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("storage_location.id"))
    note: Mapped[str | None] = mapped_column(Text)

    receipt: Mapped[GoodsReceipt] = relationship(back_populates="items", lazy="raise")
    ingredient: Mapped[Ingredient] = relationship(lazy="raise")
    location: Mapped[StorageLocation | None] = relationship(lazy="raise")
