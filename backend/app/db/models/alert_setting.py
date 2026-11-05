"""預警設定。單列：Migration 建立預設值，讀取固定取 id 最小者（AD-13）。"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin
from app.db.models.master_data import Employee


class AlertSetting(IdMixin, Base):
    __tablename__ = "alert_setting"
    __table_args__ = (CheckConstraint("warning_days >= 0", name="warning_days_non_negative"),)

    name: Mapped[str] = mapped_column(String(100))
    warning_days: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("employee.id"))

    updated_by: Mapped[Employee | None] = relationship(lazy="raise")
