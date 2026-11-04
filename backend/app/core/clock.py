"""AD-10：時間只來自 Clock。這是全專案唯一可以呼叫 datetime.now() 的檔案。"""

from abc import ABC, abstractmethod
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

TAIPEI = ZoneInfo("Asia/Taipei")


class Clock(ABC):
    @abstractmethod
    def now(self) -> datetime:
        """目前時間，含時區。"""

    def today(self) -> date:
        """Asia/Taipei 的當日日期。"""
        return self.now().astimezone(TAIPEI).date()


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(UTC)


class FixedClock(Clock):
    def __init__(self, fixed_now: datetime) -> None:
        if fixed_now.tzinfo is None:
            raise ValueError("FixedClock 需要含時區的時間")
        self._fixed_now = fixed_now

    def now(self) -> datetime:
        return self._fixed_now


def taipei_day_range(start: date, end: date) -> tuple[datetime, datetime]:
    """把台北日期區間轉成半開區間：起日 00:00 含、迄日次日 00:00 不含。"""
    return (
        datetime.combine(start, time.min, tzinfo=TAIPEI),
        datetime.combine(end + timedelta(days=1), time.min, tzinfo=TAIPEI),
    )
