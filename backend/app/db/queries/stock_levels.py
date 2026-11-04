"""AD-21：庫存量的共用唯讀查詢，inventory 與 alerts 都使用。

可用量條件 expiry_date >= today 與 app.domain.expiry.is_available 相同，
低庫存判定請把 store_available_quantity 交給 app.domain.stock.is_low_stock。
"""

from datetime import date

from sqlalchemy import ColumnElement, Select, case, func, select, true

from app.db.models import Ingredient, InventoryBatch


def _sum_when(condition: ColumnElement[bool]) -> ColumnElement:
    # LEFT JOIN 沒有批次時 remaining_quantity 為 NULL，所以要 coalesce。
    return func.coalesce(func.sum(case((condition, InventoryBatch.remaining_quantity), else_=0)), 0)


def stock_level_stmt(today: date, location_id: int | None = None) -> Select:
    """每項食材一列，包含從未進貨的食材（數量皆為 0）。

    physical_quantity、available_quantity、expired_quantity 受位置篩選影響，僅供顯示；
    store_available_quantity 一律是全店可用量，低庫存只能用它判定。
    有位置篩選時，physical_quantity > 0 代表該食材有剩餘批次位於該位置。
    """
    in_location = (
        InventoryBatch.current_location_id == location_id if location_id is not None else true()
    )
    available = InventoryBatch.expiry_date >= today
    expired = InventoryBatch.expiry_date < today

    return (
        select(
            Ingredient.id.label("ingredient_id"),
            Ingredient.name.label("ingredient_name"),
            Ingredient.category_id,
            Ingredient.unit,
            Ingredient.storage_method,
            Ingredient.safety_stock_quantity,
            Ingredient.is_active,
            _sum_when(in_location).label("physical_quantity"),
            _sum_when(in_location & available).label("available_quantity"),
            _sum_when(in_location & expired).label("expired_quantity"),
            _sum_when(available).label("store_available_quantity"),
        )
        .select_from(Ingredient)
        .outerjoin(InventoryBatch, InventoryBatch.ingredient_id == Ingredient.id)
        .group_by(Ingredient.id)
        .order_by(Ingredient.id)
    )
