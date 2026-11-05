"""AD-2：get_session、get_clock、get_uow、get_idempotency_key 的唯一定義，模組不可另寫一份。"""

from collections.abc import Iterator
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.clock import Clock, FixedClock, SystemClock
from app.core.config import Settings, get_settings
from app.core.db import get_session_factory
from app.core.idempotency import IDEMPOTENCY_KEY_HEADER
from app.core.uow import SqlAlchemyUnitOfWork, UnitOfWork


def get_session() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def get_clock(settings: Settings = Depends(get_settings)) -> Clock:
    if settings.app_fixed_now is not None and settings.app_env != "production":
        return FixedClock(settings.app_fixed_now)
    return SystemClock()


def get_uow(session: Session = Depends(get_session)) -> UnitOfWork:
    return SqlAlchemyUnitOfWork(session)


def get_idempotency_key(
    idempotency_key: UUID = Header(alias=IDEMPOTENCY_KEY_HEADER),
) -> UUID:
    """AD-8：領用、報廢的必填標頭。缺少或不是 UUID 時回 422 VALIDATION_ERROR。"""
    return idempotency_key
