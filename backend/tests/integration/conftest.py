"""整合測試連真實 PostgreSQL（foodflow_test），不用 create_all，schema 一律由 Alembic 建立。"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, make_url, update
from sqlalchemy.orm import Session

import app.db.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import get_engine, get_session_factory
from app.db.base import Base
from app.db.models import AlertSetting

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def alembic_config() -> Config:
    return Config(str(BACKEND_ROOT / "alembic.ini"))


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> Iterator[None]:
    settings = get_settings()
    if not settings.test_database_url:
        pytest.fail("整合測試需要 TEST_DATABASE_URL，請依 README 設定 .env 並啟動資料庫")
    database = make_url(settings.database_url).database or ""
    if not database.endswith("_test"):
        pytest.fail(f"整合測試會清空資料庫，名稱必須以 _test 結尾：{database}")
    command.upgrade(alembic_config(), "head")
    yield
    get_engine().dispose()


def _clean_database() -> None:
    """清空資料，alert_setting 預設列保留並還原成 migration 建立時的值。"""
    with get_engine().begin() as connection:
        connection.execute(update(AlertSetting).values(updated_by_id=None, warning_days=3))
        for table in reversed(Base.metadata.sorted_tables):
            if table.name != AlertSetting.__tablename__:
                connection.execute(delete(table))


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    _clean_database()
    yield
    _clean_database()


@pytest.fixture
def session() -> Iterator[Session]:
    with get_session_factory()() as db_session:
        yield db_session
