"""Public login and authenticated employee management endpoints."""

from fastapi import APIRouter, Depends, Query, Response

from app.core.config import Settings, get_settings
from app.core.enums import EmployeeRole
from app.core.errors import ERROR_RESPONSES
from app.db.models import Employee
from app.modules.auth.dependencies import get_auth_service, get_current_employee, require_admin
from app.modules.auth.schemas import (
    EmployeeCreate,
    EmployeeList,
    EmployeeResponse,
    EmployeeUpdate,
    LoginRequest,
    PasswordReset,
)
from app.modules.auth.service import AuthService

public_router = APIRouter(responses=ERROR_RESPONSES, tags=["auth"])
router = APIRouter(responses=ERROR_RESPONSES, tags=["auth"])


@public_router.post("/auth/login", response_model=EmployeeResponse)
def login(
    body: LoginRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> Employee:
    employee, token, _ = service.login(body.username, body.password)
    response.set_cookie(
        settings.auth_cookie_name,
        token,
        max_age=settings.jwt_expire_hours * 3600,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return employee


@router.get("/auth/me", response_model=EmployeeResponse)
def current_employee(
    response: Response, employee: Employee = Depends(get_current_employee)
) -> Employee:
    response.headers["Cache-Control"] = "no-store"
    return employee


@router.post("/auth/logout", status_code=204)
def logout(
    employee: Employee = Depends(get_current_employee),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> Response:
    service.logout(employee.id)
    response = Response(status_code=204)
    response.delete_cookie(
        settings.auth_cookie_name,
        path="/",
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
    )
    return response


@router.get("/employees", response_model=EmployeeList)
def list_employees(
    search: str = Query(default="", max_length=100),
    role: EmployeeRole | None = None,
    is_active: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    admin: Employee = Depends(require_admin),
    service: AuthService = Depends(get_auth_service),
) -> EmployeeList:
    items, total = service.list_employees(search, role, is_active, page, page_size)
    return EmployeeList(
        items=[EmployeeResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/employees", status_code=201, response_model=EmployeeResponse)
def create_employee(
    body: EmployeeCreate,
    admin: Employee = Depends(require_admin),
    service: AuthService = Depends(get_auth_service),
) -> Employee:
    return service.create(admin.id, **body.model_dump())


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    admin: Employee = Depends(require_admin),
    service: AuthService = Depends(get_auth_service),
) -> Employee:
    return service.update(admin.id, employee_id, **body.model_dump())


@router.post("/employees/{employee_id}/password", status_code=204)
def reset_password(
    employee_id: int,
    body: PasswordReset,
    admin: Employee = Depends(require_admin),
    service: AuthService = Depends(get_auth_service),
) -> Response:
    service.reset_password(admin.id, employee_id, body.password)
    return Response(status_code=204)
