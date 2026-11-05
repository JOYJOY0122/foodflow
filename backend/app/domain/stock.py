"""AD-21：低庫存的唯一定義。available 一律是全店可用量。"""

from decimal import Decimal


def is_low_stock(available: Decimal, safety: Decimal) -> bool:
    return safety > 0 and available <= safety


def shortfall(available: Decimal, safety: Decimal) -> Decimal:
    return max(safety - available, Decimal("0"))
