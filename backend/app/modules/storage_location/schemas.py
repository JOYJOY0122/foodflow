"""儲存位置 API 契約：只接受明列欄位，回應不含內部欄位。"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.enums import StorageType

LocationCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
LocationName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StorageLocationCreate(StrictRequest):
    code: LocationCode
    name: LocationName
    storage_type: StorageType
    description: str | None = Field(default=None, max_length=500)

    @field_validator("description", mode="before")
    @classmethod
    def _blank_description_is_none(cls, value: object) -> object:
        # 空白說明一律存成 null，避免清單出現看不見的內容。
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class StorageLocationUpdate(StorageLocationCreate):
    is_active: bool


class StorageLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    storage_type: StorageType
    description: str | None
    is_active: bool


class StorageLocationList(BaseModel):
    items: list[StorageLocationResponse]
    total: int
    page: int
    page_size: int
