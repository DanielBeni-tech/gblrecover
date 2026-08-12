from secrets import token_urlsafe
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.db.session import get_db

router = APIRouter()
ACCESS_TOKENS: dict[str, str] = {}
REFRESH_TOKENS: dict[str, str] = {}
RESET_TOKENS: dict[str, str] = {}


def _create_token() -> str:
    return token_urlsafe(32)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    user_id = ACCESS_TOKENS.get(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await crud.get_user(db, UUID(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/login", response_model=schemas.AuthToken)
async def login(data: schemas.AuthLogin, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, data.email)
    if not user or not crud.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token = _create_token()
    refresh_token = _create_token()
    ACCESS_TOKENS[access_token] = str(user.id)
    REFRESH_TOKENS[refresh_token] = str(user.id)
    return schemas.AuthToken(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=schemas.UserRead.from_orm(user),
    )


@router.post("/refresh", response_model=schemas.AuthToken)
async def refresh_token(data: schemas.AuthRefresh):
    user_id = REFRESH_TOKENS.get(data.refresh_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    access_token = _create_token()
    refresh_token = _create_token()
    ACCESS_TOKENS[access_token] = user_id
    REFRESH_TOKENS[refresh_token] = user_id
    return schemas.AuthToken(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user=None)


@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    data: schemas.AuthLogout = None,
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    ACCESS_TOKENS.pop(token, None)
    return {"status": "logged_out"}


@router.post("/change-password")
async def change_password(
    data: schemas.AuthChangePassword,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not crud.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is invalid")
    await crud.change_user_password(db, current_user.id, data.new_password)
    return {"status": "password_changed"}


@router.post("/forgot-password")
async def forgot_password(data: schemas.AuthForgotPassword):
    reset_token = _create_token()
    RESET_TOKENS[reset_token] = data.email
    return {"reset_token": reset_token}


@router.post("/reset-password")
async def reset_password(data: schemas.AuthResetPassword, db: AsyncSession = Depends(get_db)):
    email = RESET_TOKENS.get(data.token)
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    user = await crud.get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await crud.change_user_password(db, user.id, data.new_password)
    RESET_TOKENS.pop(data.token, None)
    return {"status": "password_reset"}
