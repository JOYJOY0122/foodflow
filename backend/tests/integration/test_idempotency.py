"""AD-8、AD-16：get_idempotency_key 的標頭解析與錯誤格式。測試路由只存在於測試。"""

from uuid import UUID

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient

from app.core.dependencies import get_idempotency_key
from app.core.idempotency import IDEMPOTENCY_KEY_HEADER
from app.db.models import Employee
from app.main import create_app
from app.modules.auth.dependencies import get_current_employee

KEY = "3f2b8c1e-9a4d-4e7b-8c2f-1d5e6a7b8c9d"

key_router = APIRouter()


@key_router.post("/test-idempotency")
def echo_key(key: UUID = Depends(get_idempotency_key)) -> dict[str, str]:
    return {"key": str(key)}


@pytest.fixture
def client() -> TestClient:
    app = create_app(extra_api_routers=[key_router])
    # /api/v1 預設要登入；這裡只測標頭解析，登入另由 test_auth_and_write 驗證。
    app.dependency_overrides[get_current_employee] = lambda: Employee(id=1)
    return TestClient(app)


def _post(client: TestClient, headers: dict[str, str]):
    return client.post("/api/v1/test-idempotency", headers=headers)


def test_valid_key_is_parsed_as_uuid(client: TestClient) -> None:
    response = _post(client, {IDEMPOTENCY_KEY_HEADER: KEY})

    assert response.status_code == 200
    assert response.json() == {"key": KEY}


def test_upper_case_key_is_the_same_key(client: TestClient) -> None:
    response = _post(client, {IDEMPOTENCY_KEY_HEADER: KEY.upper()})

    assert response.json() == {"key": KEY}


def test_header_name_is_case_insensitive(client: TestClient) -> None:
    response = _post(client, {"idempotency-key": KEY})

    assert response.json() == {"key": KEY}


def _validation_error(message: str) -> dict:
    return {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "輸入資料有誤",
            "details": {},
            "fields": [{"field": IDEMPOTENCY_KEY_HEADER, "message": message}],
        }
    }


def test_missing_key_returns_422(client: TestClient) -> None:
    response = _post(client, {})

    assert response.status_code == 422
    assert response.json() == _validation_error("此欄位為必填")


@pytest.mark.parametrize("value", ["abc", "", "3f2b8c1e-9a4d-4e7b-8c2f"])
def test_malformed_key_returns_422(client: TestClient, value: str) -> None:
    response = _post(client, {IDEMPOTENCY_KEY_HEADER: value})

    assert response.status_code == 422
    assert response.json() == _validation_error("須為 UUID")


def test_openapi_declares_required_uuid_header(client: TestClient) -> None:
    operation = client.get("/openapi.json").json()["paths"]["/api/v1/test-idempotency"]["post"]

    header = next(item for item in operation["parameters"] if item["in"] == "header")
    assert header["name"] == IDEMPOTENCY_KEY_HEADER
    assert header["required"] is True
    assert header["schema"]["format"] == "uuid"
