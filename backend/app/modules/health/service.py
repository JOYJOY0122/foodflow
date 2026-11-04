from dataclasses import dataclass
from typing import Literal

from app.modules.health.repository import HealthRepository


@dataclass(frozen=True)
class HealthReport:
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


class HealthService:
    def __init__(self, repository: HealthRepository) -> None:
        self._repository = repository

    def check(self) -> HealthReport:
        if self._repository.is_database_available():
            return HealthReport(status="ok", database="ok")
        return HealthReport(status="degraded", database="unavailable")
