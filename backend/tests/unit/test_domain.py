from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.enums import ExpiryStatus
from app.domain.expiry import classify_expiry, days_until_expiry, is_available
from app.domain.stock import is_low_stock, shortfall

TODAY = date(2026, 11, 5)


@pytest.mark.parametrize(
    ("days", "warning_days", "expected"),
    [
        (-1, 3, ExpiryStatus.EXPIRED),
        (0, 3, ExpiryStatus.EXPIRES_TODAY),
        (1, 3, ExpiryStatus.EXPIRING_SOON),
        (3, 3, ExpiryStatus.EXPIRING_SOON),
        (4, 3, ExpiryStatus.NORMAL),
        (0, 0, ExpiryStatus.EXPIRES_TODAY),
        (1, 0, ExpiryStatus.NORMAL),  # T＝0 時不產生即期提醒
    ],
)
def test_classify_expiry(days: int, warning_days: int, expected: ExpiryStatus) -> None:
    assert classify_expiry(TODAY + timedelta(days=days), TODAY, warning_days) is expected


@pytest.mark.parametrize(("days", "expected"), [(-1, False), (0, True), (1, True)])
def test_is_available(days: int, expected: bool) -> None:
    assert is_available(TODAY + timedelta(days=days), TODAY) is expected


def test_days_until_expiry_is_negative_after_expiry() -> None:
    assert days_until_expiry(TODAY - timedelta(days=2), TODAY) == -2


@pytest.mark.parametrize(
    ("available", "safety", "low", "gap"),
    [
        ("0", "5", True, "5"),  # 無批次或全過期
        ("5", "5", True, "0"),  # 等於安全量
        ("5.001", "5", False, "0"),
        ("0", "0", False, "0"),  # 安全量為 0 不提醒
        ("2.5", "5", True, "2.5"),
    ],
)
def test_low_stock(available: str, safety: str, low: bool, gap: str) -> None:
    assert is_low_stock(Decimal(available), Decimal(safety)) is low
    assert shortfall(Decimal(available), Decimal(safety)) == Decimal(gap)
