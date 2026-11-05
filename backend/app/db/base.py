"""宣告式基底、constraint 命名規則與共用主鍵（AD-19）。"""

from enum import StrEnum

from sqlalchemy import BigInteger, Enum, Identity, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class IdMixin:
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)


def enum_type(enum_class: type[StrEnum], name: str) -> Enum:
    """通用字串欄位加 CHECK，不使用 PostgreSQL 原生 ENUM。"""
    return Enum(enum_class, name=name, native_enum=False, create_constraint=True, length=32)
