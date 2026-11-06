"""FR-05 儲存位置規則，不連資料庫；鎖與 FK 防線在 PostgreSQL 整合測試驗證。"""

import pytest

from app.core.enums import ErrorCode, StorageType
from app.core.errors import DomainError
from app.db.models import StorageLocation
from app.modules.storage_location.repository import StorageLocationRepository
from app.modules.storage_location.service import StorageLocationService
from tests.fakes.fake_uow import FakeUnitOfWork


class FakeRepository(StorageLocationRepository):
    def __init__(self) -> None:
        self.locations: list[StorageLocation] = []
        self.stocked: dict[int, int] = {}
        self.referenced: set[int] = set()
        self.locked: list[int] = []

    def list_locations(self, search, storage_type, is_active, page, page_size):
        items = [
            loc
            for loc in self.locations
            if (is_active is None or loc.is_active == is_active)
            and (storage_type is None or loc.storage_type == storage_type)
            and (not search or search in loc.code or search in loc.name)
        ]
        return items, len(items)

    def get(self, location_id):
        return next((loc for loc in self.locations if loc.id == location_id), None)

    def lock(self, location_id):
        self.locked.append(location_id)
        return next((loc for loc in self.locations if loc.id == location_id), None)

    def lock_as_move_target(self, location_id):
        return self.lock(location_id)

    def find_code(self, code):
        return next((loc for loc in self.locations if loc.code == code), None)

    def count_stocked_batches(self, location_id):
        return self.stocked.get(location_id, 0)

    def is_referenced(self, location_id):
        return location_id in self.referenced

    def add(self, location):
        location.id = len(self.locations) + 1
        self.locations.append(location)

    def delete(self, location):
        self.locations.remove(location)

    def flush(self):
        pass

    # 換位置用的查詢由 test_batch_relocation_service.py 測試。
    def list_location_batches(self, location_id, page, page_size):
        raise NotImplementedError

    def load_batch(self, batch_id):
        raise NotImplementedError

    def source_status(self, source_item_id):
        raise NotImplementedError


@pytest.fixture
def repo() -> FakeRepository:
    return FakeRepository()


@pytest.fixture
def uow() -> FakeUnitOfWork:
    return FakeUnitOfWork()


@pytest.fixture
def service(repo, uow) -> StorageLocationService:
    return StorageLocationService(repo, uow)


def _create(service, code="A1", **overrides):
    values = {
        "code": code,
        "name": "冷藏庫 A",
        "storage_type": StorageType.REFRIGERATED,
        "description": None,
    } | overrides
    return service.create(**values)


def _update(service, location, **overrides):
    values = {
        "code": location.code,
        "name": location.name,
        "storage_type": location.storage_type,
        "description": location.description,
        "is_active": location.is_active,
    } | overrides
    return service.update(location.id, **values)


def _assert_error(exc_info, code: ErrorCode) -> DomainError:
    assert exc_info.value.code is code
    return exc_info.value


def test_create_is_active_and_committed(service, uow) -> None:
    location = _create(service, description="靠門口")

    assert location.is_active is True
    assert (location.code, location.description) == ("A1", "靠門口")
    assert uow.commits == 1


def test_create_duplicate_code_rolls_back_and_points_at_code(service, uow, repo) -> None:
    _create(service)

    with pytest.raises(DomainError) as exc_info:
        _create(service, name="另一個")

    error = _assert_error(exc_info, ErrorCode.DUPLICATE)
    assert [field.field for field in error.fields] == ["code"]
    assert (uow.commits, uow.rollbacks, len(repo.locations)) == (1, 1, 1)


def test_update_to_existing_code_is_duplicate_but_keeping_own_code_is_fine(service) -> None:
    first = _create(service, "A1")
    second = _create(service, "B1")

    with pytest.raises(DomainError) as exc_info:
        _update(service, second, code="A1")
    _assert_error(exc_info, ErrorCode.DUPLICATE)

    assert _update(service, first, name="冷藏庫 A（新）").name == "冷藏庫 A（新）"


def test_deactivate_with_stocked_batches_is_referenced_with_count(service, repo, uow) -> None:
    location = _create(service)
    repo.stocked[location.id] = 2

    with pytest.raises(DomainError) as exc_info:
        _update(service, location, is_active=False, name="改名不應生效")

    error = _assert_error(exc_info, ErrorCode.REFERENCED)
    assert error.details == {"batch_count": 2}
    assert "2 個批次" in error.message
    assert repo.locked[-1] == location.id
    assert (location.is_active, location.name) == (True, "冷藏庫 A")
    assert uow.rollbacks == 1


def test_deactivate_without_stocked_batches_succeeds_and_can_reactivate(service) -> None:
    location = _create(service)

    assert _update(service, location, is_active=False).is_active is False
    assert _update(service, location, is_active=True).is_active is True


def test_inactive_location_with_stock_can_still_be_edited(service, repo) -> None:
    location = _create(service)
    _update(service, location, is_active=False)
    repo.stocked[location.id] = 1

    assert _update(service, location, name="新名稱").name == "新名稱"


def test_delete_referenced_location_is_rejected(service, repo, uow) -> None:
    location = _create(service)
    repo.referenced.add(location.id)

    with pytest.raises(DomainError) as exc_info:
        service.delete(location.id)

    assert "停用" in _assert_error(exc_info, ErrorCode.REFERENCED).message
    assert repo.locations == [location]
    assert uow.rollbacks == 1


def test_delete_unreferenced_location(service, repo) -> None:
    location = _create(service)

    service.delete(location.id)

    assert repo.locations == []
    assert repo.locked[-1] == location.id


@pytest.mark.parametrize("action", ["update", "delete"])
def test_missing_location_is_not_found(service, action) -> None:
    ghost = StorageLocation(
        id=99,
        code="X",
        name="X",
        storage_type=StorageType.AMBIENT,
        description=None,
        is_active=True,
    )
    with pytest.raises(DomainError) as exc_info:
        _update(service, ghost) if action == "update" else service.delete(99)
    _assert_error(exc_info, ErrorCode.NOT_FOUND)


def test_list_only_active(service) -> None:
    active = _create(service, "A1")
    inactive = _create(service, "B1")
    _update(service, inactive, is_active=False)

    items, total = service.list_locations("  ", None, True, 1, 20)

    assert (items, total) == ([active], 1)
