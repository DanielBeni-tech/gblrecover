"""Routes de recouvrement — sections 3.5 (sous-routes) et 3.8 de la spec."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


# ============================================================
# §3.5 — Sous-routes d'un compte liées au recouvrement
# ============================================================

@router.get(
    "/accounts/{account_id}/collection-actions",
    response_model=List[schemas.CollectionActionRead],
)
async def list_account_collection_actions(
    account_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_collection_actions_for_account(db, account_id, page=page, page_size=page_size)


@router.post(
    "/accounts/{account_id}/collection-actions",
    response_model=schemas.CollectionActionRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def create_account_collection_action(
    account_id: int,
    payload: schemas.CollectionActionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_collection_action_for_account(db, account_id, payload, created_by=current_user.id)


@router.get(
    "/accounts/{account_id}/promises",
    response_model=List[schemas.PromiseRead],
)
async def list_account_promises(
    account_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_promises_for_account(db, account_id, page=page, page_size=page_size)


@router.post(
    "/accounts/{account_id}/promises",
    response_model=schemas.PromiseRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def create_account_promise(
    account_id: int,
    payload: schemas.PromiseCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_promise_for_account(db, account_id, payload, created_by=current_user.id)


# ============================================================
# §3.8 — Collection actions
# ============================================================

@router.get("/collection-actions", response_model=List[schemas.CollectionActionRead])
async def list_collection_actions(
    assigned_to: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    due_date__lte: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_collection_actions(
        db, assigned_to=assigned_to, status=status, due_date_lte=due_date__lte,
        page=page, page_size=page_size,
    )


@router.get("/collection-actions/dashboard", response_model=schemas.CollectionActionDashboard)
async def collection_actions_dashboard(db: AsyncSession = Depends(get_db)):
    return await crud.collection_actions_dashboard(db)


@router.get("/collection-actions/{action_id}", response_model=schemas.CollectionActionRead)
async def read_collection_action(action_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await crud.get_collection_action(db, action_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return obj


@router.post(
    "/collection-actions",
    response_model=schemas.CollectionActionRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def create_collection_action(
    payload: schemas.CollectionActionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_collection_action(db, payload, created_by=current_user.id)


@router.patch(
    "/collection-actions/{action_id}",
    response_model=schemas.CollectionActionRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def update_collection_action(
    action_id: UUID,
    payload: schemas.CollectionActionUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.update_collection_action(db, action_id, payload)


# ============================================================
# §3.8 — Promesses
# ============================================================

@router.get("/promises", response_model=List[schemas.PromiseRead])
async def list_promises(
    status: Optional[str] = Query(None),
    account_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_promises(db, status=status, account_id=account_id, page=page, page_size=page_size)


@router.post(
    "/promises/{promise_id}/keep",
    response_model=schemas.PromiseRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def keep_promise(
    promise_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.mark_promise_kept(db, promise_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promise not found")
    return await crud.get_promise(db, promise_id)


@router.post(
    "/promises/{promise_id}/break",
    response_model=schemas.PromiseRead,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def break_promise(
    promise_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.mark_promise_broken(db, promise_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promise not found")
    return await crud.get_promise(db, promise_id)