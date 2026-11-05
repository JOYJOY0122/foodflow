"""Auth rules without a database; transaction/locking behavior is tested on PostgreSQL."""

from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from pwdlib import PasswordHash

from app.core.clock import FixedClock
from app.core.config import Settings
from app.core.enums import EmployeeRole, ErrorCode
from app.core.errors import DomainError
from app.db.models import Employee
from app.modules.auth.schemas import EmployeeCreate, EmployeeUpdate
from app.modules.auth.service import AuthService

NOW = datetime(2026, 11, 6, tzinfo=UTC)


class FakeRepository:
    def __init__(self):
        self.employees = [
            Employee(
                id=1,
                username="admin",
                name="管理者",
                role=EmployeeRole.ADMIN,
                is_active=True,
                token_version=0,
                created_at=NOW,
                password_hash=PasswordHash.recommended().hash("password123"),
            )
        ]

    def lock_all(self):
        return self.employees

    def find_username(self, username):
        return next((e for e in self.employees if e.username == username), None)

    def add(self, employee):
        employee.id = len(self.employees) + 1
        self.employees.append(employee)

    def flush(self):
        pass


class FakeUow:
    @contextmanager
    def transaction(self):
        yield


@pytest.fixture
def service():
    repository = FakeRepository()
    settings = Settings(database_url="unused", jwt_secret="x" * 32)
    return AuthService(repository, FakeUow(), FixedClock(NOW), settings), repository


def test_login_unknown_disabled_and_corrupt_hash_fail_uniformly(service):
    auth, repo = service
    for username, password in [("missing", "wrong"), ("admin", "wrong")]:
        with pytest.raises(DomainError) as caught:
            auth.login(username, password)
        assert caught.value.code is ErrorCode.INVALID_CREDENTIALS
    repo.employees[0].password_hash = "broken"
    with pytest.raises(DomainError, match="登入失敗"):
        auth.login("admin", "password123")
    repo.employees[0].is_active = False
    with pytest.raises(DomainError, match="登入失敗"):
        auth.login("admin", "password123")


def test_last_admin_cannot_be_disabled_or_demoted(service):
    auth, repo = service
    for body in [
        EmployeeUpdate(name="管理者", role="STAFF", is_active=True),
        EmployeeUpdate(name="管理者", role="ADMIN", is_active=False),
    ]:
        with pytest.raises(DomainError) as caught:
            auth.update(1, 1, **body.model_dump())
        assert caught.value.code is ErrorCode.STATE_CONFLICT
        assert repo.employees[0].role is EmployeeRole.ADMIN
        assert repo.employees[0].is_active


def test_creation_uses_clock_and_does_not_trim_password(service):
    auth, repo = service
    employee = auth.create(
        1,
        **EmployeeCreate(
            username=" new ", name=" 姓名 ", password=" password ", role="STAFF"
        ).model_dump(),
    )
    assert employee.username == "new" and employee.name == "姓名"
    assert employee.created_at == NOW
    assert PasswordHash.recommended().verify(" password ", employee.password_hash)
    assert repo.employees[0].token_version == 0


def test_duplicate_username_and_revalidation_of_actor(service):
    auth, repo = service
    body = EmployeeCreate(username="admin", name="名字", password="password123", role="STAFF")
    with pytest.raises(DomainError) as caught:
        auth.create(1, **body.model_dump())
    assert caught.value.code is ErrorCode.DUPLICATE
    repo.employees[0].role = EmployeeRole.STAFF
    with pytest.raises(DomainError) as caught:
        auth.create(1, **body.model_dump())
    assert caught.value.code is ErrorCode.FORBIDDEN


def test_password_reset_and_logout_revoke_sessions(service):
    auth, repo = service
    auth.reset_password(1, 1, "new-password")
    assert repo.employees[0].token_version == 1
    assert PasswordHash.recommended().verify("new-password", repo.employees[0].password_hash)
    auth.logout(1)
    assert repo.employees[0].token_version == 2


@pytest.mark.parametrize("extra", [{"token_version": 4}, {"password_hash": "bad"}])
def test_payloads_forbid_internal_fields(extra):
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        EmployeeCreate(username="user", name="name", password="12345678", role="STAFF", **extra)
    with pytest.raises(ValidationError):
        EmployeeUpdate(name="name", role="STAFF", is_active=True, **extra)
