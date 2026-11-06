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
