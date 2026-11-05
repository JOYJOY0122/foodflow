from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.clock import TAIPEI, Clock, FixedClock, SystemClock, taipei_day_range
from app.core.config import REPO_ROOT, Settings, get_settings
from app.core.dependencies import get_clock
from app.core.enums import ErrorCode
from app.core.errors import DomainError
from app.main import create_app

URL = "postgresql+psycopg://user@localhost/db"


def _settings(**values) -> Settings:
    return Settings(_env_file=None, database_url=URL, **values)


def test_missing_jwt_secret_is_rejected_with_clear_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(ValidationError, match="JWT_SECRET 未設定或短於 32 bytes"):
        _settings()


def test_empty_jwt_secret_env_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "")
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings()


def test_short_jwt_secret_is_rejected_and_not_echoed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "s3cret-short")
    with pytest.raises(ValidationError) as caught:
        _settings()
    assert "s3cret-short" not in str(caught.value)


def test_length_is_measured_in_bytes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "密" * 11)  # 11 字、33 bytes
    assert _settings().jwt_secret.get_secret_value() == "密" * 11


def test_env_example_can_be_loaded(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("APP_ENV", "DATABASE_URL", "TEST_DATABASE_URL", "APP_FIXED_NOW"):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=REPO_ROOT / ".env.example", jwt_secret="x" * 32)

    assert settings.app_env == "development"
    assert settings.database_url.startswith("postgresql+psycopg://")
    # 資料庫埠只綁 127.0.0.1；寫 localhost 時可能先試 ::1 而卡到逾時。
    assert "@127.0.0.1:" in settings.database_url
    assert "@127.0.0.1:" in settings.test_database_url
    assert settings.app_fixed_now is None


def test_app_refuses_to_start_without_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.delenv("JWT_SECRET")
    try:
        with pytest.raises(ValidationError, match="JWT_SECRET"):
            create_app()
    finally:
        get_settings.cache_clear()


def test_system_clock_is_timezone_aware() -> None:
    assert SystemClock().now().tzinfo is not None


def test_today_uses_taipei_date_not_utc_date() -> None:
    clock = FixedClock(datetime(2026, 11, 5, 16, 0, tzinfo=UTC))  # 台北 11/6 00:00
    assert clock.today() == date(2026, 11, 6)
    before_midnight = FixedClock(datetime(2026, 11, 5, 15, 59, 59, tzinfo=UTC))
    assert before_midnight.today() == date(2026, 11, 5)


def test_fixed_clock_requires_timezone() -> None:
    with pytest.raises(ValueError):
        FixedClock(datetime(2026, 11, 5))


def test_taipei_day_range_is_half_open() -> None:
    start, end = taipei_day_range(date(2026, 11, 1), date(2026, 11, 2))
    assert start == datetime(2026, 11, 1, tzinfo=TAIPEI)
    assert end == datetime(2026, 11, 3, tzinfo=TAIPEI)
    assert start.utcoffset() == timedelta(hours=8)


FIXED = datetime(2026, 11, 18, 9, 0, tzinfo=timezone(timedelta(hours=8)))


def test_get_clock_uses_fixed_now_outside_production() -> None:
    clock = get_clock(_settings(app_env="development", app_fixed_now=FIXED))
    assert clock.now() == FIXED


def test_get_clock_ignores_fixed_now_in_production() -> None:
    clock = get_clock(_settings(app_env="production", app_fixed_now=FIXED))
    assert isinstance(clock, SystemClock)


def test_fixed_now_must_have_timezone() -> None:
    with pytest.raises(ValidationError):
        _settings(app_fixed_now="2026-11-18T09:00:00")


def test_clock_can_be_overridden_for_cross_day_tests() -> None:
    """C5：API 測試以 dependency_overrides[get_clock] 跨日。"""
    app = FastAPI()

    @app.get("/today")
    def read_today(clock: Clock = Depends(get_clock)) -> str:
        return clock.today().isoformat()

    app.dependency_overrides[get_clock] = lambda: FixedClock(FIXED)

    assert TestClient(app).get("/today").json() == "2026-11-18"


def test_domain_error_stringifies_nested_decimals() -> None:
    error = DomainError(
        ErrorCode.STALE_QUANTITY,
        "數量已變更",
        {"current_quantity": Decimal("2.5"), "lines": [{"quantity": Decimal("1")}]},
    )

    assert error.details == {"current_quantity": "2.500", "lines": [{"quantity": "1.000"}]}
    assert error.status_code == 409
