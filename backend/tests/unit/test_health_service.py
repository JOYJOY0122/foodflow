from app.modules.health.repository import HealthRepository
from app.modules.health.service import HealthService


class FakeHealthRepository(HealthRepository):
    def __init__(self, available: bool) -> None:
        self._available = available

    def is_database_available(self) -> bool:
        return self._available


def test_ok_when_database_available() -> None:
    report = HealthService(FakeHealthRepository(available=True)).check()
    assert (report.status, report.database) == ("ok", "ok")


def test_degraded_when_database_unavailable() -> None:
    report = HealthService(FakeHealthRepository(available=False)).check()
    assert (report.status, report.database) == ("degraded", "unavailable")
