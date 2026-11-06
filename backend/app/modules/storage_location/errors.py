"""Service 與 Repository 實作共用的錯誤，訊息只定義一次。"""

from app.core.enums import ErrorCode
from app.core.errors import DomainError, FieldError


def duplicate_code() -> DomainError:
    return DomainError(
        ErrorCode.DUPLICATE,
        "位置代碼已存在",
        fields=[FieldError("code", "位置代碼已存在，請換一個代碼")],
    )


def referenced_on_delete() -> DomainError:
    return DomainError(ErrorCode.REFERENCED, "此位置已被進貨或庫存紀錄使用，不能刪除，請改用停用")


def stocked_on_deactivate(batch_count: int) -> DomainError:
    return DomainError(
        ErrorCode.REFERENCED,
        f"此位置仍有 {batch_count} 個批次有剩餘量，不能停用",
        details={"batch_count": batch_count},
        fields=[FieldError("is_active", "位置上仍有剩餘庫存")],
    )


def batch_not_found() -> DomainError:
    return DomainError(ErrorCode.NOT_FOUND, "找不到批次")


def location_not_found() -> DomainError:
    return DomainError(ErrorCode.NOT_FOUND, "找不到儲存位置")


def invalid_move_target() -> DomainError:
    return DomainError(
        ErrorCode.RULE_VIOLATION,
        "目標位置不存在或已停用",
        fields=[FieldError("to_location_id", "請選擇啟用中的儲存位置")],
    )


def reversed_source() -> DomainError:
    return DomainError(ErrorCode.RULE_VIOLATION, "此批次的來源進貨單已沖銷，不能換位置")


def exhausted_batch() -> DomainError:
    return DomainError(ErrorCode.RULE_VIOLATION, "此批次已無剩餘量，不需要換位置")
