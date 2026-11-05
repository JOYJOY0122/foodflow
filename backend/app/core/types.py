"""AD-9：API 的數量與金額型別。輸入只接受字串，輸出固定小數位數。

正規式用 [0-9] 而不用 \\d，避免接受全形等 Unicode 數字。
"""

import re
from collections.abc import Callable
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema

_UNSIGNED_QUANTITY = r"^[0-9]{1,9}(\.[0-9]{1,3})?$"
_SIGNED_QUANTITY = r"^-?[0-9]{1,9}(\.[0-9]{1,3})?$"
_MONEY = r"^[0-9]{1,10}(\.[0-9]{1,2})?$"
_CENT = Decimal("0.01")


def _parser(pattern: str, message: str) -> Callable[[object], Decimal]:
    compiled = re.compile(pattern)

    def parse(value: object) -> Decimal:
        if isinstance(value, Decimal):
            return value
        if isinstance(value, str) and compiled.fullmatch(value):
            return Decimal(value)
        raise ValueError(message)

    return parse


def _must_be_positive(value: Decimal) -> Decimal:
    if value <= 0:
        raise ValueError("數量須大於 0")
    return value


def _quantity_type(pattern: str, message: str, *validators: Callable[[Decimal], Decimal]):
    parse = _parser(pattern, message)

    def validate(value: object) -> Decimal:
        parsed = parse(value)
        for validator in validators:
            parsed = validator(parsed)
        return parsed

    return Annotated[
        Decimal,
        BeforeValidator(validate),
        PlainSerializer(lambda value: f"{value:.3f}", return_type=str, when_used="json"),
        WithJsonSchema({"type": "string", "pattern": pattern}),
    ]


_QUANTITY_MESSAGE = "數量須為字串，整數最多 9 位、小數最多 3 位"

PositiveQuantity = _quantity_type(_UNSIGNED_QUANTITY, _QUANTITY_MESSAGE, _must_be_positive)
NonNegativeQuantity = _quantity_type(_UNSIGNED_QUANTITY, _QUANTITY_MESSAGE)
SignedQuantity = _quantity_type(_SIGNED_QUANTITY, _QUANTITY_MESSAGE)

Money = Annotated[
    Decimal,
    BeforeValidator(_parser(_MONEY, "金額須為字串，整數最多 10 位、小數最多 2 位")),
    PlainSerializer(lambda value: f"{value:.2f}", return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "pattern": _MONEY}),
]


def round_money(amount: Decimal) -> Decimal:
    """金額計算一律以 ROUND_HALF_UP 四捨五入到兩位。"""
    return amount.quantize(_CENT, rounding=ROUND_HALF_UP)
