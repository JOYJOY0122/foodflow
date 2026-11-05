"""Explicit public fields prevent credential disclosure and mass assignment."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import EmployeeRole

Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
EmployeeName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictRequest):
    username: Username
    password: str = Field(min_length=1, max_length=128, repr=False)


class EmployeeCreate(StrictRequest):
    username: Username
    name: EmployeeName
    password: Password = Field(repr=False)
    role: EmployeeRole
    is_active: bool = True


class EmployeeUpdate(StrictRequest):
    name: EmployeeName
    role: EmployeeRole
    is_active: bool


class PasswordReset(StrictRequest):
    password: Password = Field(repr=False)


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: EmployeeRole
    is_active: bool
    created_at: datetime


class EmployeeList(BaseModel):
    items: list[EmployeeResponse]
    total: int
    page: int
    page_size: int
