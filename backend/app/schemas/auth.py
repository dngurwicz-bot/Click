from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PermissionInfo(BaseModel):
    resource: str
    can_view: bool
    can_edit: bool

    model_config = {"from_attributes": True}


class UserInfo(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    permissions: list[PermissionInfo] = []

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    user: UserInfo
