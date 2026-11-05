"""AD-15: cookie authentication and auth service composition."""

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.config import Settings, get_settings
from app.core.dependencies import get_clock, get_session, get_uow
from app.core.enums import EmployeeRole, ErrorCode
from app.core.errors import DomainError
from app.core.uow import UnitOfWork
from app.db.models import Employee
from app.modules.auth.repository_sqlalchemy import SqlAlchemyAuthRepository
from app.modules.auth.service import AuthService

JWT_ALGORITHM = "HS256"


def build_auth_service(
    session: Session, uow: UnitOfWork, clock: Clock, settings: Settings
) -> AuthService:
    return AuthService(SqlAlchemyAuthRepository(session), uow, clock, settings)


def get_auth_service(
    session: Session = Depends(get_session),
    uow: UnitOfWork = Depends(get_uow),
    clock: Clock = Depends(get_clock),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return build_auth_service(session, uow, clock, settings)


def _unauthenticated() -> DomainError:
    return DomainError(ErrorCode.UNAUTHENTICATED, "尚未登入或登入已失效")


def get_current_employee(
    request: Request,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
    settings: Settings = Depends(get_settings),
) -> Employee:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise _unauthenticated()

    # exp 由注入的 Clock 比對，APP_FIXED_NOW 下才能正常登入。
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={
                "verify_exp": False,
                "verify_iat": False,
                "require": ["sub", "exp", "token_version"],
            },
        )
        expires_at = float(claims["exp"])
        employee_id = int(claims["sub"])
    except (jwt.InvalidTokenError, TypeError, ValueError) as exc:
        raise _unauthenticated() from exc

    if clock.now().timestamp() >= expires_at:
        raise _unauthenticated()

    employee = session.get(Employee, employee_id)
    if (
        employee is None
        or not employee.is_active
        or employee.token_version != claims["token_version"]
    ):
        raise _unauthenticated()
    return employee


def require_admin(employee: Employee = Depends(get_current_employee)) -> Employee:
    if employee.role is not EmployeeRole.ADMIN:
        raise DomainError(ErrorCode.FORBIDDEN, "沒有執行此操作的權限")
    return employee
