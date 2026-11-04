"""AD-9、T3：數量與金額型別。"""

from decimal import Decimal

import pytest
from pydantic import BaseModel, ValidationError

from app.core.types import (
    Money,
    NonNegativeQuantity,
    PositiveQuantity,
    SignedQuantity,
    round_money,
)


class Quantities(BaseModel):
    positive: PositiveQuantity = Decimal("1")
    non_negative: NonNegativeQuantity = Decimal("0")
    signed: SignedQuantity = Decimal("0")
    money: Money = Decimal("0")


@pytest.mark.parametrize(
    "value",
    [12.5, 1, "1e2", "1.2345", " 1.5 ", "1_000", "NaN", "Infinity", "", "1234567890", "-1", "１"],
)
def test_positive_quantity_rejects_non_canonical_input(value: object) -> None:
    with pytest.raises(ValidationError):
        Quantities.model_validate({"positive": value})


def test_positive_quantity_rejects_zero() -> None:
    with pytest.raises(ValidationError, match="大於 0"):
        Quantities.model_validate({"positive": "0.000"})


def test_non_negative_quantity_accepts_zero_but_not_negative() -> None:
    assert Quantities.model_validate({"non_negative": "0"}).non_negative == 0
    with pytest.raises(ValidationError):
        Quantities.model_validate({"non_negative": "-0.001"})


def test_signed_quantity_accepts_negative() -> None:
    assert Quantities.model_validate({"signed": "-2.5"}).signed == Decimal("-2.5")


@pytest.mark.parametrize("value", [1.5, "1.234", "12345678901", "-1"])
def test_money_rejects_invalid_input(value: object) -> None:
    with pytest.raises(ValidationError):
        Quantities.model_validate({"money": value})


def test_output_has_fixed_decimal_places() -> None:
    dumped = Quantities(
        positive=Decimal("12.5"),
        non_negative=Decimal("0"),
        signed=Decimal("-1"),
        money=Decimal("3.5"),
    ).model_dump(mode="json")
    assert dumped == {
        "positive": "12.500",
        "non_negative": "0.000",
        "signed": "-1.000",
        "money": "3.50",
    }


def test_json_schema_is_string_for_both_directions() -> None:
    for mode in ("validation", "serialization"):
        properties = Quantities.model_json_schema(mode=mode)["properties"]
        for field in properties.values():
            assert field["type"] == "string"
            assert "pattern" in field


@pytest.mark.parametrize(
    ("amount", "expected"),
    [("1.005", "1.01"), ("2.675", "2.68"), ("0.004", "0.00"), ("10", "10.00")],
)
def test_round_money_rounds_half_up(amount: str, expected: str) -> None:
    assert str(round_money(Decimal(amount))) == expected
