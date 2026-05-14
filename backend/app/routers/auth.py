"""
Auth router: login + me.
We authenticate against Supabase Auth, then issue our own JWT containing role info.
"""
from datetime import datetime, timedelta, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import (
    SESSION_COOKIE_NAME,
    SESSION_HINT_COOKIE_NAME,
    CurrentUser,
    get_current_user,
)
from app.models.admin_user import AdminUser
from app.models.admin_user_permission import AdminUserPermission
from app.schemas.auth import LoginRequest, LoginResponse, UserInfo, PermissionInfo
from jose import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _create_token(user: AdminUser) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _set_session_cookie(response: Response, token: str) -> None:
    secure_cookie = settings.APP_ENV != "development"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=SESSION_HINT_COOKIE_NAME,
        value="1",
        httponly=False,
        secure=secure_cookie,
        samesite="strict",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=settings.APP_ENV != "development",
        samesite="strict",
        path="/",
    )
    response.delete_cookie(
        key=SESSION_HINT_COOKIE_NAME,
        httponly=False,
        secure=settings.APP_ENV != "development",
        samesite="strict",
        path="/",
    )


async def _load_user_permissions(db: AsyncSession, user_id: uuid.UUID) -> list[PermissionInfo]:
    result = await db.execute(
        select(AdminUserPermission).where(AdminUserPermission.user_id == user_id)
    )
    return [
        PermissionInfo(resource=p.resource, can_view=p.can_view, can_edit=p.can_edit)
        for p in result.scalars().all()
    ]


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # Authenticate via Supabase Auth REST API
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": settings.SUPABASE_PUBLISHABLE_KEY,
                "Content-Type": "application/json",
            },
            json={"email": body.email, "password": body.password},
            timeout=10,
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"},
        )

    supabase_data = resp.json()
    supabase_user_id = uuid.UUID(supabase_data["user"]["id"])

    # Look up in our admin_users table
    result = await db.execute(
        select(AdminUser)
        .where(AdminUser.id == supabase_user_id)
        .where(AdminUser.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Not an admin user", "code": "NOT_ADMIN"},
        )

    # Update last_login_at
    await db.execute(
        update(AdminUser)
        .where(AdminUser.id == user.id)
        .values(last_login_at=datetime.now(timezone.utc))
    )
    await db.commit()

    # Load permissions
    perms = await _load_user_permissions(db, user.id)

    token = _create_token(user)
    user_info = UserInfo(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        permissions=perms,
    )
    _set_session_cookie(response, token)
    return LoginResponse(user=user_info)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    _clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserInfo)
async def me(current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminUser).where(AdminUser.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found", "code": "NOT_FOUND"})

    perms = await _load_user_permissions(db, user.id)
    return UserInfo(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        permissions=perms,
    )
