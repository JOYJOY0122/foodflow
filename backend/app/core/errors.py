"""AD-16：統一的錯誤型別與回應格式。轉成 HTTP 的 handler 在 app/main.py。"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import ErrorCode

ERROR_HTTP_STATUS: Mapping[ErrorCode, int] = {
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.INVALID_CREDENTIALS: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.INSUFFICIENT_STOCK: 409,
    ErrorCode.STALE_QUANTITY: 409,
    ErrorCode.STATE_CONFLICT: 409,
    ErrorCode.DUPLICATE: 409,
    ErrorCode.REFERENCED: 409,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.RULE_VIOLATION: 422,
    ErrorCode.INTERNAL_ERROR: 500,
}


@dataclass(frozen=True)
class FieldError:
    field: str
    message: str


def _stringify_decimals(value: Any) -> Any:
    """Decimal 不進 jsonable_encoder（T4），在這裡先轉成固定三位小數的字串。"""
    if isinstance(value, Decimal):
        return f"{value:.3f}"
    if isinstance(value, Mapping):
        return {key: _stringify_decimals(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_stringify_decimals(item) for item in value]
    return value


class DomainError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: Mapping[str, Any] | None = None,
        fields: Sequence[FieldError] = (),
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details: dict[str, Any] = _stringify_decimals(details or {})
        self.fields = tuple(fields)

    @property
    def status_code(self) -> int:
        return ERROR_HTTP_STATUS[self.code]


def insufficient_stock(
    batch_id: int | None = None,
    remaining_quantity: Decimal | None = None,
    available_quantity: Decimal | None = None,
) -> DomainError:
    return DomainError(
        ErrorCode.INSUFFICIENT_STOCK,
        "可用量不足",
        {
            "batch_id": batch_id,
            "remaining_quantity": remaining_quantity,
            "available_quantity": available_quantity,
        },
    )


_CONSTRAINT_ERRORS: Mapping[str, tuple[ErrorCode, str]] = {
    "uq_employee_username": (ErrorCode.DUPLICATE, "帳號已存在"),
    "uq_ingredient_category_code": (ErrorCode.DUPLICATE, "分類代碼已存在"),
    "uq_ingredient_name": (ErrorCode.DUPLICATE, "食材名稱已存在"),
    "uq_storage_location_code": (ErrorCode.DUPLICATE, "位置代碼已存在"),
    "uq_inventory_batch_batch_number": (ErrorCode.STATE_CONFLICT, "批號已存在"),
    "uq_inventory_batch_source_item_id": (ErrorCode.STATE_CONFLICT, "此進貨明細已入庫"),
    "uq_inventory_transaction_operation_group_id_batch_id": (
        ErrorCode.DUPLICATE,
        "此操作已處理過",
    ),
    "uq_inventory_transaction_reverses_transaction_id": (
        ErrorCode.STATE_CONFLICT,
        "此異動已沖銷",
    ),
}


def flush_or_raise(
    session: Session,
    constraint_errors: Mapping[str, DomainError] | None = None,
) -> None:
    """flush，並把 IntegrityError 依 constraint 名稱轉成 DomainError。

    constraint_errors 可覆寫或補充預設對應；對應不到的 constraint 代表程式錯誤，原樣丟出。
    """
    try:
        session.flush()
    except IntegrityError as exc:
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if constraint_errors and constraint in constraint_errors:
            raise constraint_errors[constraint] from exc
        if constraint == "ck_inventory_batch_remaining_quantity_non_negative":
            raise insufficient_stock() from exc
        if constraint in _CONSTRAINT_ERRORS:
            code, message = _CONSTRAINT_ERRORS[constraint]
            raise DomainError(code, message) from exc
        raise


class ErrorField(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str
    details: dict[str, Any]
    fields: list[ErrorField]


class ErrorResponse(BaseModel):
    error: ErrorBody


def error_payload(
    code: ErrorCode,
    message: str,
    details: Mapping[str, Any] | None = None,
    fields: Sequence[FieldError] = (),
) -> dict[str, Any]:
    return {
        "error": {
            "code": code.value,
            "message": message,
            "details": dict(details or {}),
            "fields": [{"field": item.field, "message": item.message} for item in fields],
        }
    }


# 宣告在 APIRouter(responses=...)，取代 FastAPI 預設的 HTTPValidationError（T11）。
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 500)
}
