"""儲存位置規則（FR-05）與交易邊界。權限由路由層 require_admin 把關。"""

from app.core.enums import ErrorCode, StorageType
from app.core.errors import DomainError
from app.core.uow import UnitOfWork
from app.db.models import StorageLocation
from app.modules.storage_location.errors import (
    duplicate_code,
    referenced_on_delete,
    stocked_on_deactivate,
)
from app.modules.storage_location.repository import StorageLocationRepository


class StorageLocationService:
    def __init__(self, repository: StorageLocationRepository, uow: UnitOfWork) -> None:
        self._repository = repository
        self._uow = uow

    def list_locations(
        self,
        search: str,
        storage_type: StorageType | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[StorageLocation], int]:
        return self._repository.list_locations(
            search.strip(), storage_type, is_active, page, page_size
        )

    def create(
        self, *, code: str, name: str, storage_type: StorageType, description: str | None
    ) -> StorageLocation:
        with self._uow.transaction():
            self._ensure_code_free(code, None)
            location = StorageLocation(
                code=code,
                name=name,
                storage_type=storage_type,
                description=description,
                is_active=True,
            )
            self._repository.add(location)
            return location

    def update(
        self,
        location_id: int,
        *,
        code: str,
        name: str,
        storage_type: StorageType,
        description: str | None,
        is_active: bool,
    ) -> StorageLocation:
        with self._uow.transaction():
            location = self._lock(location_id)
            self._ensure_code_free(code, location.id)
            if location.is_active and not is_active:
                batch_count = self._repository.count_stocked_batches(location.id)
                if batch_count > 0:
                    raise stocked_on_deactivate(batch_count)
            location.code = code
            location.name = name
            location.storage_type = storage_type
            location.description = description
            location.is_active = is_active
            self._repository.flush()
            return location

    def delete(self, location_id: int) -> None:
        with self._uow.transaction():
            location = self._lock(location_id)
            if self._repository.is_referenced(location.id):
                raise referenced_on_delete()
            self._repository.delete(location)

    def _lock(self, location_id: int) -> StorageLocation:
        location = self._repository.lock(location_id)
        if location is None:
            raise DomainError(ErrorCode.NOT_FOUND, "找不到儲存位置")
        return location

    def _ensure_code_free(self, code: str, own_id: int | None) -> None:
        existing = self._repository.find_code(code)
        if existing is not None and existing.id != own_id:
            raise duplicate_code()
