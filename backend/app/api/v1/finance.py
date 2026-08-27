from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


# ============================================================
# §3.5 — Comptes
# ============================================================

@router.get("/accounts", response_model=List[schemas.AccountRead])
async def read_accounts(
    client_id: Optional[int] = Query(None),
    agency_id: Optional[str] = Query(None),
    manager_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    account_number: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_accounts(
        db,
        client_id=client_id,
        agency_id=agency_id,
        page=page,
        page_size=page_size,
    )


@router.get("/accounts/{account_id}", response_model=schemas.AccountRead)
async def read_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await crud.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.patch("/accounts/{account_id}", response_model=schemas.AccountRead)
async def patch_account(
    account_id: int,
    account_in: schemas.SubscriptionUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await crud.update_account(db, account_id, account_in)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.get("/accounts/{account_id}/invoices", response_model=List[schemas.InvoiceRead])
async def account_invoices(
    account_id: int,
    status: Optional[str] = Query(None),
    due_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_account_invoices(db, account_id, page=page, page_size=page_size)


@router.get("/accounts/{account_id}/payments", response_model=List[schemas.PaymentRead])
async def account_payments(
    account_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_account_payments(db, account_id, page=page, page_size=page_size)


# Route canonique (spec §3.5)
@router.get("/accounts/{account_id}/receivable-summary", response_model=schemas.ReceivableSummary)
async def account_receivable_summary(account_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_receivable_summary(db, account_id)


# Alias deprecated pour rétrocompat avec le front déjà branché
@router.get(
    "/accounts/{account_id}/receivable",
    response_model=schemas.ReceivableSummary,
    deprecated=True,
)
async def account_receivable_legacy(account_id: int, db: AsyncSession = Depends(get_db)):
    """DEPRECATED : utilisez /accounts/{id}/receivable-summary."""
    return await crud.get_receivable_summary(db, account_id)


# ============================================================
# §3.6 — Factures
# ============================================================

@router.get("/invoices", response_model=List[schemas.InvoiceRead])
async def read_invoices(
    account_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    due_date__gte: Optional[str] = Query(None),
    due_date__lte: Optional[str] = Query(None),
    outstanding_amount__gt: Optional[float] = Query(None),
    payment_state: Optional[str] = Query(None, description="Statut de règlement dérivé des montants : PAID | PARTIAL | UNPAID"),
    order_by: Optional[str] = Query(None, description="Colonne de tri : date_emission | montant_facture | paid_amount | outstanding_amount"),
    order: Optional[str] = Query(None, description="Direction du tri : asc | desc (défaut desc)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_invoices(
        db,
        status=status,
        page=page,
        page_size=page_size,
        payment_state=payment_state,
        order_by=order_by,
        order=order,
    )


@router.get("/invoices/count")
async def count_invoices(
    status: Optional[str] = Query(None),
    payment_state: Optional[str] = Query(None, description="Filtre dérivé des montants : PAID | PARTIAL | UNPAID"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {"total": await crud.count_invoices_filtered(db, status=status, payment_state=payment_state)}


@router.get("/invoices/{invoice_id}", response_model=schemas.InvoiceRead)
async def read_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    inv = await crud.get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return inv


@router.post(
    "/invoices",
    response_model=schemas.InvoiceRead)
async def create_invoice(
    invoice_in: schemas.InvoiceCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_invoice(db, invoice_in)


@router.patch(
    "/invoices/{invoice_id}",
    response_model=schemas.InvoiceRead)
async def update_invoice(
    invoice_id: str,
    invoice_in: schemas.InvoiceUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.update_invoice(db, invoice_id, invoice_in)


@router.delete(
    "/invoices/{invoice_id}")
async def cancel_invoice(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.cancel_invoice(db, invoice_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")


@router.get("/invoices/{invoice_id}/payments", response_model=List[schemas.PaymentRead])
async def invoice_payments(
    invoice_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_invoice_payments(db, invoice_id, page=page, page_size=page_size)


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=schemas.AllocationRead)
async def allocate_payment_via_invoice(
    invoice_id: str,
    payload: schemas.AllocationCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.allocate_payment_to_invoice(
        db, invoice_id=invoice_id, payment_id=payload.invoice_id, amount=payload.amount
    )


# ============================================================
# §3.7 — Paiements & Allocations
# ============================================================

@router.get("/payments", response_model=List[schemas.PaymentRead])
async def read_payments(
    account_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    payment_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_payments(db, status=status, page=page, page_size=page_size)


@router.get("/payments/unallocated", response_model=List[schemas.PaymentRead])
async def unallocated_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_unallocated_payments(db, page=page, page_size=page_size)


@router.get("/payments/count")
async def count_payments(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {"total": await crud.count_payments_filtered(db, status=status)}

@router.get("/payments/{payment_id}", response_model=schemas.PaymentRead)
async def read_payment(payment_id: str, db: AsyncSession = Depends(get_db)):
    p = await crud.get_payment(db, payment_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return p


@router.post(
    "/payments",
    response_model=schemas.PaymentRead)
async def create_payment(
    payment_in: schemas.PaymentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_payment(db, payment_in)


@router.patch(
    "/payments/{payment_id}",
    response_model=schemas.PaymentRead)
async def update_payment(
    payment_id: str,
    payment_in: schemas.PaymentUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.update_payment(db, payment_id, payment_in)


@router.delete(
    "/payments/{payment_id}")
async def cancel_payment(
    payment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.cancel_payment(db, payment_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")


@router.post(
    "/payments/{payment_id}/allocations",
    response_model=List[schemas.AllocationRead])
async def create_payment_allocations(
    payment_id: str,
    allocations: List[schemas.AllocationCreate],
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_payment_allocations(db, payment_id, allocations)


@router.delete(
    "/allocations/{allocation_id}")
async def delete_allocation(
    allocation_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.delete_allocation(db, allocation_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found")


# ============================================================

@router.get("/receivables", response_model=List[schemas.ReportRow])
async def list_receivables(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.get_receivables(db, q=q, status=status, page=page, page_size=page_size)


@router.get("/receivables/count")
async def count_receivables(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {"total": await crud.count_receivables_filtered(db, q=q, status=status)}

