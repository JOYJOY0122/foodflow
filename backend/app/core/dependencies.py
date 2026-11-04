"""AD-2：get_session、get_clock、get_uow 的唯一定義，模組不可另寫一份。"""

from collections.abc import Iterator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.clock import Clock, FixedClock, SystemClock
from app.core.config import Settings, get_settings
from app.core.db import get_session_factory
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
