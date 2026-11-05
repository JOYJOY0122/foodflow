"""Employee persistence contract. All writes use the same ordered lock."""

from abc import ABC, abstractmethod

from app.core.enums import EmployeeRole
from app.db.models import Employee


class AuthRepository(ABC):
    @abstractmethod
    def find_username(self, username: str) -> Employee | None: ...

    @abstractmethod
    def lock_all(self) -> list[Employee]: ...

    @abstractmethod
    def list_employees(
        self,
        search: str,
        role: EmployeeRole | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Employee], int]: ...

    @abstractmethod
    def add(self, employee: Employee) -> None: ...

    @abstractmethod
    def flush(self) -> None: ...
