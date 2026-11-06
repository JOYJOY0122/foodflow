"""SQLAlchemy 儲存位置存取；不 commit、不判斷規則。"""

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.db import for_update
from app.core.enums import StorageType
from app.core.errors import flush_or_raise
from app.db.models import BatchLocationChange, GoodsReceiptItem, InventoryBatch, StorageLocation
from app.modules.storage_location.errors import duplicate_code, referenced_on_delete
from app.modules.storage_location.repository import StorageLocationRepository

# 檢查後仍被併發寫入引用時，由 FK 擋下刪除（最後防線）。
_REFERENCING_FOREIGN_KEYS = (
    "fk_goods_receipt_item_location_id_storage_location",
    "fk_inventory_batch_current_location_id_storage_location",
    "fk_batch_location_change_from_location_id_storage_location",
    "fk_batch_location_change_to_location_id_storage_location",
)


class SqlAlchemyStorageLocationRepository(StorageLocationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_locations(
        self,
        search: str,
        storage_type: StorageType | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[StorageLocation], int]:
        stmt = select(StorageLocation)
        if search:
            # contains(autoescape) 把輸入當文字，不當 LIKE 萬用字元。
            stmt = stmt.where(
                or_(
                    StorageLocation.code.contains(search, autoescape=True),
                    StorageLocation.name.contains(search, autoescape=True),
                )
            )
        if storage_type is not None:
            stmt = stmt.where(StorageLocation.storage_type == storage_type)
        if is_active is not None:
            stmt = stmt.where(StorageLocation.is_active == is_active)
        total = self._session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = self._session.scalars(
            stmt.order_by(StorageLocation.code, StorageLocation.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(items), total

    def lock(self, location_id: int) -> StorageLocation | None:
        return self._session.scalar(
            for_update(select(StorageLocation).where(StorageLocation.id == location_id))
        )

    def find_code(self, code: str) -> StorageLocation | None:
        return self._session.scalar(select(StorageLocation).where(StorageLocation.code == code))

    def count_stocked_batches(self, location_id: int) -> int:
        return (
            self._session.scalar(
                select(func.count())
                .select_from(InventoryBatch)
                .where(
                    InventoryBatch.current_location_id == location_id,
                    InventoryBatch.remaining_quantity > 0,
                )
            )
            or 0
        )

    def is_referenced(self, location_id: int) -> bool:
        references = (
            exists().where(GoodsReceiptItem.location_id == location_id),
            exists().where(InventoryBatch.current_location_id == location_id),
            exists().where(
                or_(
                    BatchLocationChange.from_location_id == location_id,
                    BatchLocationChange.to_location_id == location_id,
                )
            ),
        )
        return bool(self._session.scalar(select(or_(*references))))

    def add(self, location: StorageLocation) -> None:
        self._session.add(location)
        self.flush()

    def delete(self, location: StorageLocation) -> None:
        self._session.delete(location)
        flush_or_raise(
            self._session, {name: referenced_on_delete() for name in _REFERENCING_FOREIGN_KEYS}
        )

    def flush(self) -> None:
        flush_or_raise(self._session, {"uq_storage_location_code": duplicate_code()})
