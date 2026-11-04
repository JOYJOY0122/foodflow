"""管理指令。用法：uv run python -m app.cli verify-stock"""

import argparse
import sys
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_session_factory
from app.core.enums import TransactionType
from app.db.models import InventoryBatch, InventoryTransaction, WasteRecord


def find_stock_discrepancies(session: Session) -> list[str]:
    """庫存核對（NFR-03、SM-2）：回傳所有差異的說明，空清單代表一致。"""
    problems: list[str] = []

    delta_sum = (
        select(
            InventoryTransaction.batch_id,
            func.sum(InventoryTransaction.quantity_delta).label("total"),
        )
        .group_by(InventoryTransaction.batch_id)
        .subquery()
    )
    rows = session.execute(
        select(InventoryBatch.id, InventoryBatch.remaining_quantity, delta_sum.c.total)
        .outerjoin(delta_sum, delta_sum.c.batch_id == InventoryBatch.id)
        .where(InventoryBatch.remaining_quantity != func.coalesce(delta_sum.c.total, 0))
        .order_by(InventoryBatch.id)
    )
    for batch_id, remaining, total in rows:
        problems.append(f"批次 {batch_id}：剩餘量 {remaining} 不等於異動合計 {total or 0}")

    latest_id = (
        select(
            InventoryTransaction.batch_id,
            func.max(InventoryTransaction.id).label("transaction_id"),
        )
        .group_by(InventoryTransaction.batch_id)
        .subquery()
    )
    rows = session.execute(
        select(
            InventoryBatch.id,
            InventoryBatch.remaining_quantity,
            InventoryTransaction.quantity_after,
        )
        .join(latest_id, latest_id.c.batch_id == InventoryBatch.id)
        .join(InventoryTransaction, InventoryTransaction.id == latest_id.c.transaction_id)
        .where(InventoryBatch.remaining_quantity != InventoryTransaction.quantity_after)
        .order_by(InventoryBatch.id)
    )
    for batch_id, remaining, quantity_after in rows:
        problems.append(
            f"批次 {batch_id}：剩餘量 {remaining} 不等於最新異動的 quantity_after {quantity_after}"
        )

    rows = session.scalars(
        select(InventoryTransaction.id)
        .outerjoin(WasteRecord, WasteRecord.transaction_id == InventoryTransaction.id)
        .where(InventoryTransaction.type == TransactionType.WASTE, WasteRecord.id.is_(None))
        .order_by(InventoryTransaction.id)
    )
    for transaction_id in rows:
        problems.append(f"異動 {transaction_id}：WASTE 異動沒有對應的報廢紀錄")

    return problems


def _verify_stock() -> int:
    with get_session_factory()() as session:
        problems = find_stock_discrepancies(session)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        print(f"庫存核對失敗：{len(problems)} 項差異", file=sys.stderr)
        return 1
    print("庫存核對通過")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="FoodFlow 管理指令")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("verify-stock", help="核對批次剩餘量與異動紀錄")
    args = parser.parse_args(argv)

    if args.command == "verify-stock":
        return _verify_stock()
    return 2


if __name__ == "__main__":
    sys.exit(main())
