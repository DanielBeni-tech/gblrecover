from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


@router.get("/clients", response_model=list[schemas.ClientRead])
async def read_clients(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    client_type: Optional[str] = Query(None),
    marche: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_clients(db, q=q, status=status, client_type=client_type, marche=marche, page=page, page_size=page_size)


@router.get("/clients/{client_id}", response_model=schemas.ClientRead)
async def read_client(client_id: int, db: AsyncSession = Depends(get_db)):
    client = await crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.post("/clients", response_model=schemas.ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(client_in: schemas.ClientCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.create_client(db, client_in)


@router.patch("/clients/{client_id}", response_model=schemas.ClientRead)
async def update_client(client_id: int, client_in: schemas.ClientUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await crud.update_client(db, client_id, client_in)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(client_id: int, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await crud.deactivate_client(db, client_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return


@router.get("/clients/{client_id}/accounts", response_model=list[schemas.AccountRead])
async def read_client_accounts(client_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_client_accounts(db, client_id)


@router.get("/clients/{client_id}/summary", response_model=schemas.ClientSummary)
async def read_client_summary(client_id: int, db: AsyncSession = Depends(get_db)):
    summary = await crud.get_client_summary(db, client_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return summary


@router.get("/clients/{client_id}/history", response_model=list[schemas.ClientHistoryItem])
async def read_client_history(client_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_client_history(db, client_id)


@router.post("/clients/merge", response_model=schemas.ClientRead)
async def merge_clients(request: schemas.ClientMergeRequest, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await crud.merge_clients(db, request.source_id, request.target_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source or target client not found")
    return client
