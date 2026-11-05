"""Authentication, revocation and employee policies, with transactional writes."""

from datetime import datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.clock import Clock
from app.core.config import Settings
from app.core.enums import EmployeeRole, ErrorCode
from app.core.errors import DomainError
from app.core.uow import UnitOfWork
from app.db.models import Employee
from app.modules.auth.repository import AuthRepository

_PASSWORDS = PasswordHash.recommended()
_DUMMY_HASH = _PASSWORDS.hash("unknown-account-timing-placeholder")
JWT_ALGORITHM = "HS256"


class AuthService:
    def __init__(
        self, repository: AuthRepository, uow: UnitOfWork, clock: Clock, settings: Settings
    ) -> None:
        self._repository = repository
        self._uow = uow
        self._clock = clock
        self._settings = settings

    def login(self, username: str, password: str) -> tuple[Employee, str, datetime]:
        employee = self._repository.find_username(username)
        hashed = employee.password_hash if employee is not None else _DUMMY_HASH
        try:
            valid = _PASSWORDS.verify(password, hashed)
        except (UnknownHashError, ValueError):
            valid = False
        if not valid or employee is None or not employee.is_active:
            raise DomainError(ErrorCode.INVALID_CREDENTIALS, "登入失敗，請確認帳號密碼")
        expires = self._clock.now() + timedelta(hours=self._settings.jwt_expire_hours)
        token = jwt.encode(
            {
                "sub": str(employee.id),
                "token_version": employee.token_version,
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret.get_secret_value(),
            algorithm=JWT_ALGORITHM,
        )
        return employee, token, expires

    def _lock_admin(self, operator_id: int) -> list[Employee]:
        employees = self._repository.lock_all()
        operator = next((e for e in employees if e.id == operator_id), None)
        if operator is None or not operator.is_active or operator.role is not EmployeeRole.ADMIN:
            raise DomainError(ErrorCode.FORBIDDEN, "沒有執行此操作的權限")
        return employees

    @staticmethod
    def _target(employees: list[Employee], employee_id: int) -> Employee:
        employee = next((e for e in employees if e.id == employee_id), None)
        if employee is None:
            raise DomainError(ErrorCode.NOT_FOUND, "找不到員工")
        return employee

    def list_employees(
        self,
        search: str,
        role: EmployeeRole | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Employee], int]:
        return self._repository.list_employees(search.strip(), role, is_active, page, page_size)

    def create(
        self,
        operator_id: int,
        *,
        username: str,
        name: str,
        password: str,
        role: EmployeeRole,
        is_active: bool = True,
    ) -> Employee:
        with self._uow.transaction():
            self._lock_admin(operator_id)
            return self._create(username, name, password, role, is_active)

    def _create(
        self, username: str, name: str, password: str, role: EmployeeRole, is_active: bool
    ) -> Employee:
        if self._repository.find_username(username) is not None:
            raise DomainError(ErrorCode.DUPLICATE, "帳號已存在")
        employee = Employee(
            username=username,
            name=name,
            password_hash=_PASSWORDS.hash(password),
            role=role,
            is_active=is_active,
            token_version=0,
            created_at=self._clock.now(),
        )
        self._repository.add(employee)
        return employee

    def bootstrap_admin(self, *, username: str, name: str, password: str) -> Employee:
        """Interactive local CLI entry; never exposed as a web endpoint."""
        with self._uow.transaction():
            self._repository.lock_all()
            return self._create(username, name, password, EmployeeRole.ADMIN, True)

    def update(
        self, operator_id: int, employee_id: int, *, name: str, role: EmployeeRole, is_active: bool
    ) -> Employee:
        with self._uow.transaction():
            employees = self._lock_admin(operator_id)
            employee = self._target(employees, employee_id)
            was_admin = employee.is_active and employee.role is EmployeeRole.ADMIN
            will_be_admin = is_active and role is EmployeeRole.ADMIN
            if (
                was_admin
                and not will_be_admin
                and sum(e.is_active and e.role is EmployeeRole.ADMIN for e in employees) <= 1
            ):
                raise DomainError(ErrorCode.STATE_CONFLICT, "最後一位有效管理者不能停用或降權")
            if (employee.is_active and not is_active) or (
                employee.role is EmployeeRole.ADMIN and role is EmployeeRole.STAFF
            ):
                employee.token_version += 1
            employee.name, employee.role, employee.is_active = name, role, is_active
            self._repository.flush()
            return employee

    def reset_password(self, operator_id: int, employee_id: int, password: str) -> None:
        with self._uow.transaction():
            employees = self._lock_admin(operator_id)
            employee = self._target(employees, employee_id)
            employee.password_hash = _PASSWORDS.hash(password)
            employee.token_version += 1
            self._repository.flush()

    def logout(self, employee_id: int) -> None:
        with self._uow.transaction():
            employee = self._target(self._repository.lock_all(), employee_id)
            employee.token_version += 1
            self._repository.flush()
