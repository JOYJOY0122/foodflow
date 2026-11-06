"""儲存位置的資料存取介面。引用與剩餘批次只讀取，不寫入其他模組的表（AD-4）。"""

from abc import ABC, abstractmethod

from app.core.enums import StorageType
from app.db.models import StorageLocation


class StorageLocationRepository(ABC):
    @abstractmethod
    def list_locations(
        self,
        search: str,
        storage_type: StorageType | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[StorageLocation], int]: ...

    @abstractmethod
    def lock(self, location_id: int) -> StorageLocation | None: ...

    @abstractmethod
    def find_code(self, code: str) -> StorageLocation | None: ...

    @abstractmethod
    def count_stocked_batches(self, location_id: int) -> int:
        """目前位於此位置、剩餘量大於 0 的批次數。"""

    @abstractmethod
    def is_referenced(self, location_id: int) -> bool:
        """是否曾被進貨明細、批次或位置變更紀錄引用。"""

    @abstractmethod
    def add(self, location: StorageLocation) -> None: ...

    @abstractmethod
    def delete(self, location: StorageLocation) -> None: ...

    @abstractmethod
    def flush(self) -> None: ...
