"""SQLAlchemy employee storage; no commits or policy decisions."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.db import for_update
from app.core.enums import EmployeeRole
from app.core.errors import flush_or_raise
from app.db.models import Employee
from app.modules.auth.repository import AuthRepository


class SqlAlchemyAuthRepository(AuthRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_username(self, username: str) -> Employee | None:
        return self._session.scalar(select(Employee).where(Employee.username == username))

    def lock_all(self) -> list[Employee]:
        return list(self._session.scalars(for_update(select(Employee).order_by(Employee.id))))

    def list_employees(
        self,
        search: str,
        role: EmployeeRole | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Employee], int]:
        stmt = select(Employee)
        if search:
            # contains(autoescape) treats user input as text, not SQL LIKE wildcards.
            stmt = stmt.where(
                or_(
                    Employee.username.contains(search, autoescape=True),
                    Employee.name.contains(search, autoescape=True),
                )
            )
        if role is not None:
            stmt = stmt.where(Employee.role == role)
        if is_active is not None:
            stmt = stmt.where(Employee.is_active == is_active)
        total = self._session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = self._session.scalars(
            stmt.order_by(Employee.id).offset((page - 1) * page_size).limit(page_size)
        )
        return list(items), total

    def add(self, employee: Employee) -> None:
        self._session.add(employee)
        self.flush()

    def flush(self) -> None:
        flush_or_raise(self._session)
