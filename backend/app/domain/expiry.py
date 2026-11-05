"""AD-11：效期狀態的唯一定義。令 D＝到期日－今天，T＝預警天數（SRS 第 5 節第 2 點）。"""

from datetime import date

from app.core.enums import ExpiryStatus


def days_until_expiry(expiry_date: date, today: date) -> int:
    return (expiry_date - today).days


def classify_expiry(expiry_date: date, today: date, warning_days: int) -> ExpiryStatus:
    days = days_until_expiry(expiry_date, today)
    if days < 0:
        return ExpiryStatus.EXPIRED
    if days == 0:
        return ExpiryStatus.EXPIRES_TODAY
    if days <= warning_days:
        return ExpiryStatus.EXPIRING_SOON
    return ExpiryStatus.NORMAL


def is_available(expiry_date: date, today: date) -> bool:
    """今日到期仍可領用，次日禁止（A7）。"""
    return days_until_expiry(expiry_date, today) >= 0
