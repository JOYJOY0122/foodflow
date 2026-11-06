"""儲存位置與整批換位置的規則（FR-05、A3）與交易邊界。權限由路由層 require_admin 把關。"""

from uuid import uuid4

from app.core.clock import Clock
from app.core.enums import GoodsReceiptStatus, StorageType
from app.core.uow import UnitOfWork
from app.db.models import InventoryBatch, StorageLocation
from app.modules.inventory.ledger import StockLedger, StockOp
from app.modules.storage_location.errors import (
    batch_not_found,
    duplicate_code,
    exhausted_batch,
    invalid_move_target,
    location_not_found,
    referenced_on_delete,
    reversed_source,
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
            raise location_not_found()
        return location

    def _ensure_code_free(self, code: str, own_id: int | None) -> None:
        existing = self._repository.find_code(code)
        if existing is not None and existing.id != own_id:
            raise duplicate_code()


class BatchRelocationService:
    """整批換位置：批次只經 StockLedger 鎖定與寫入，不產生數量異動（AD-5、AD-20）。"""

    def __init__(
        self,
        repository: StorageLocationRepository,
        ledger: StockLedger,
        uow: UnitOfWork,
        clock: Clock,
    ) -> None:
        self._repository = repository
        self._ledger = ledger
        self._uow = uow
        self._clock = clock

    def list_batches(
        self, location_id: int, page: int, page_size: int
    ) -> tuple[list[InventoryBatch], int]:
        if self._repository.get(location_id) is None:
            raise location_not_found()
        return self._repository.list_location_batches(location_id, page, page_size)

    def move(
        self, batch_id: int, *, to_location_id: int, reason: str, operator_id: int
    ) -> InventoryBatch:
        with self._uow.transaction():
            # 鎖序：inventory_batch → storage_location；來源單頭只讀不鎖（AD-7）。
            locked = self._ledger.lock_batches([batch_id])
            if not locked:
                raise batch_not_found()
            batch = locked[0]
            if self._repository.source_status(batch.source_item_id) is GoodsReceiptStatus.REVERSED:
                raise reversed_source()
            if batch.remaining_quantity <= 0:
                raise exhausted_batch()
            if batch.current_location_id != to_location_id:
                # 鎖住目標位置，與停用位置（先鎖位置再數批次）互斥。
                target = self._repository.lock_as_move_target(to_location_id)
                if target is None or not target.is_active:
                    raise invalid_move_target()
                op = StockOp(
                    operation_group_id=uuid4(),
                    operator_id=operator_id,
                    occurred_at=self._clock.now(),
                    reason=reason,
                )
                self._ledger.move(batch, to_location_id, op)
            return self._repository.load_batch(batch.id)
