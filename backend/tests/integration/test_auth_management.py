"""Account lifecycle and concurrent administrator changes on real PostgreSQL."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from time import monotonic, sleep

import jwt
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pwdlib import PasswordHash
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app import cli
from app.core.clock import FixedClock
from app.core.config import get_settings
from app.core.db import get_session_factory
from app.core.dependencies import get_clock, get_session
from app.core.enums import EmployeeRole
from app.core.errors import DomainError
from app.core.uow import SqlAlchemyUnitOfWork
from app.db.models import Employee
from app.main import create_app
from app.modules.auth.dependencies import build_auth_service, get_current_employee, require_admin
from app.modules.auth.repository_sqlalchemy import SqlAlchemyAuthRepository
from tests.integration.factories import NOW, add_employee, make_token

PASSWORD = "password123"


@pytest.fixture
def app():
    app = create_app()
    app.dependency_overrides[get_clock] = lambda: FixedClock(NOW)
    return app


@pytest.fixture
def admin_id(session):
    admin = add_employee(
        session, role=EmployeeRole.ADMIN, password_hash=PasswordHash.recommended().hash(PASSWORD)
    )
    session.commit()
    return admin.id


def client_for(app, employee_id):
    client = TestClient(app)
    client.cookies.set(get_settings().auth_cookie_name, make_token(employee_id))
    return client


def test_login_fixed_clock_cookie_lifecycle_and_persisted_creation(app, admin_id):
    with get_session_factory()() as session:
        username = session.get_one(Employee, admin_id).username
    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
    assert login.status_code == 200
    assert "password" not in login.text
    cookie = login.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Max-Age=43200" in cookie
    token = client.cookies[get_settings().auth_cookie_name]
    claims = jwt.decode(
        token,
        get_settings().jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        options={"verify_exp": False},
    )
    assert claims["exp"] == int(NOW.timestamp()) + 43200
    created = client.post(
        "/api/v1/employees",
        json={"username": "new", "name": " 新人 ", "password": PASSWORD, "role": "STAFF"},
    )
    assert created.status_code == 201
    assert "password" not in created.text and "token_version" not in created.text
    with get_session_factory()() as other:
        persisted = other.get_one(Employee, created.json()["id"])
        assert persisted.created_at == NOW and persisted.name == "新人"
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(get_settings().auth_cookie_name, token)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_access_validation_duplicate_and_reset(app, admin_id, session):
    staff = add_employee(session, password_hash=PasswordHash.recommended().hash(PASSWORD))
    session.commit()
    assert TestClient(app).get("/api/v1/employees").status_code == 401
    assert client_for(app, staff.id).get("/api/v1/employees").status_code == 403
    admin = client_for(app, admin_id)
    body = {"username": staff.username, "name": "名字", "password": PASSWORD, "role": "STAFF"}
    assert admin.post("/api/v1/employees", json=body).status_code == 409
    assert admin.post("/api/v1/employees", json=body | {"token_version": 8}).status_code == 422
    old = client_for(app, staff.id)
    reset = admin.post(f"/api/v1/employees/{staff.id}/password", json={"password": "new-password"})
    assert reset.status_code == 204
    assert old.get("/api/v1/auth/me").status_code == 401
    assert (
        admin.patch(
            f"/api/v1/employees/{admin_id}",
            json={"name": "管理者", "role": "STAFF", "is_active": True},
        ).status_code
        == 409
    )
    assert (
        admin.patch(
            f"/api/v1/employees/{staff.id}",
            json={"name": "離職", "role": "STAFF", "is_active": False},
        ).status_code
        == 200
    )
    assert (
        TestClient(app)
        .post("/api/v1/auth/login", json={"username": staff.username, "password": "new-password"})
        .status_code
        == 401
    )


def test_demotion_revokes_old_cookie_and_search_filters(app, admin_id, session):
    second = add_employee(session, role=EmployeeRole.ADMIN, name="查詢測試管理者")
    session.commit()
    old = client_for(app, second.id)
    admin = client_for(app, admin_id)
    response = admin.patch(
        f"/api/v1/employees/{second.id}",
        json={"name": second.name, "role": "STAFF", "is_active": True},
    )
    assert response.status_code == 200
    assert old.get("/api/v1/auth/me").status_code == 401
    result = admin.get(
        "/api/v1/employees",
        params={"search": "查詢測試", "role": "STAFF", "is_active": True, "page_size": 1},
    )
    assert result.status_code == 200
    assert result.json()["total"] == 1
    assert result.json()["items"][0]["id"] == second.id
    assert admin.get("/api/v1/employees", params={"search": "%"}).json()["total"] == 0


def test_lock_refreshes_preloaded_actor_and_target(app, admin_id, session):
    second = add_employee(session, role=EmployeeRole.ADMIN)
    session.commit()
    with get_session_factory()() as stale:
        preloaded = stale.get_one(Employee, second.id)
        assert preloaded.role is EmployeeRole.ADMIN
        admin = client_for(app, admin_id)
        assert (
            admin.patch(
                f"/api/v1/employees/{second.id}",
                json={"name": "已降權", "role": "STAFF", "is_active": True},
            ).status_code
            == 200
        )
        service = build_auth_service(
            stale, SqlAlchemyUnitOfWork(stale), FixedClock(NOW), get_settings()
        )
        with pytest.raises(DomainError) as caught:
            service.update(
                second.id, admin_id, name="不應儲存", role=EmployeeRole.STAFF, is_active=True
            )
        assert caught.value.status_code == 403
    with get_session_factory()() as other:
        assert other.get_one(Employee, admin_id).name != "不應儲存"


def test_create_admin_cli_persists_and_can_login(app, monkeypatch, capsys):
    inputs = iter([" bootstrap-admin ", " 首位管理者 "])
    passwords = iter([PASSWORD, PASSWORD])
    monkeypatch.setattr("builtins.input", lambda _: next(inputs))
    monkeypatch.setattr(cli.getpass, "getpass", lambda _: next(passwords))
    assert cli.main(["create-admin"]) == 0
    with get_session_factory()() as independent:
        employee = independent.scalar(
            select(Employee).where(Employee.username == "bootstrap-admin")
        )
        assert employee is not None
        assert employee.name == "首位管理者"
        assert employee.is_active and employee.role is EmployeeRole.ADMIN
        assert PasswordHash.recommended().verify(PASSWORD, employee.password_hash)
        employee_id = employee.id
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login", json={"username": "bootstrap-admin", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").json()["id"] == employee_id
    captured = capsys.readouterr()
    assert PASSWORD not in captured.out + captured.err


@pytest.mark.parametrize(
    "change", [{"is_active": False, "role": "ADMIN"}, {"is_active": True, "role": "STAFF"}]
)
def test_concurrent_mutual_changes_keep_an_admin_and_rollback(
    app, admin_id, session, change, monkeypatch
):
    second = add_employee(session, role=EmployeeRole.ADMIN)
    session.commit()
    barrier = Barrier(2)
    first_locked = Event()
    second_started = Event()
    release_first = Event()
    pids = {}

    def authenticated_admin(
        employee: Employee = Depends(get_current_employee),
        request_session: Session = Depends(get_session),
    ) -> Employee:
        require_admin(employee)
        request_session.info["actor"] = employee.id
        # Both requests have passed real cookie authentication before either can write.
        barrier.wait(timeout=10)
        return employee

    app.dependency_overrides[require_admin] = authenticated_admin
    original_lock_all = SqlAlchemyAuthRepository.lock_all

    def coordinated_lock_all(repository):
        actor = repository._session.info["actor"]
        pids[actor] = repository._session.scalar(text("SELECT pg_backend_pid()"))
        if actor == admin_id:
            result = original_lock_all(repository)
            first_locked.set()
            assert release_first.wait(timeout=15)
            return result
        assert first_locked.wait(timeout=10)
        second_started.set()
        return original_lock_all(repository)

    monkeypatch.setattr(SqlAlchemyAuthRepository, "lock_all", coordinated_lock_all)

    def change_other(actor, target):
        client = client_for(app, actor)
        return client.patch(f"/api/v1/employees/{target}", json={"name": "已修改", **change})

    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(change_other, admin_id, second.id)
        b = executor.submit(change_other, second.id, admin_id)
        try:
            assert first_locked.wait(timeout=10)
            assert second_started.wait(timeout=10)
            # Prove PostgreSQL is blocking the second transaction on the first's locks.
            deadline = monotonic() + 5
            with get_session_factory()() as observer:
                while True:
                    blockers = observer.scalar(
                        text("SELECT pg_blocking_pids(:pid)"), {"pid": pids[second.id]}
                    )
                    if pids[admin_id] in blockers:
                        break
                    assert monotonic() < deadline, (
                        "second transaction never waited on employee locks"
                    )
                    sleep(0.01)
            assert not b.done()
        finally:
            release_first.set()
        responses = [a.result(timeout=15), b.result(timeout=15)]
    assert sorted(r.status_code for r in responses)[0] == 200
    assert sorted(r.status_code for r in responses)[1] == 403
    with get_session_factory()() as other:
        employees = other.scalars(select(Employee).order_by(Employee.id)).all()
        assert sum(e.is_active and e.role is EmployeeRole.ADMIN for e in employees) == 1
        assert sum(e.name == "已修改" for e in employees) == 1
