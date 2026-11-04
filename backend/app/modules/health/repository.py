from abc import ABC, abstractmethod


class HealthRepository(ABC):
    @abstractmethod
    def is_database_available(self) -> bool:
        """資料庫是否可連線。連不上時回 False，不丟例外。"""
