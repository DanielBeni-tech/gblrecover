from sqlalchemy import cast, func, or_, select, String, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from passlib.context import CryptContext
from uuid import UUID
from fastapi import HTTPException, status as http_status

from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.user_role import UserRole
from app.models.role_permission import RolePermission
from app.models.finance import (
    Agence,
    Centre,
    Client,
    Compte,
    Facture,
    Gestionnaire,
    Paiement,
)
from app.models.recouvrement import CollectionAction, Promise
from app.models.imports import ImportBatch, ImportError
from app.models.service import Service
from app.models.audit_event import AuditEvent

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_BCRYPT_MAX_BYTES = 72


def _truncate_for_bcrypt(password: str) -> str:
    encoded = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return encoded.decode("utf-8", errors="ignore")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(_truncate_for_bcrypt(plain_password), hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(_truncate_for_bcrypt(password))


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


async def get_users(db: AsyncSession, limit: int = 100, offset: int = 0, status: str | None = None, role_id: UUID | None = None):
    stmt = select(User)
    if status:
        stmt = stmt.where(User.status == status)
    if role_id:
        stmt = stmt.join(User.roles).where(Role.id == role_id)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().unique().all()


async def create_user(db: AsyncSession, user_in):
    roles = []
    if getattr(user_in, "role_ids", None):
        result = await db.execute(select(Role).where(Role.id.in_(user_in.role_ids)))
        roles = result.scalars().all()
    user = User(email=user_in.email, password_hash=get_password_hash(user_in.password), full_name=user_in.full_name, phone=user_in.phone, roles=roles)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user_id: UUID, user_in):
    user = await get_user(db, user_id)
    if not user:
        return None
    data = user_in.dict(exclude_unset=True)
    if "role_ids" in data:
        role_ids = data.pop("role_ids")
        if role_ids is not None:
            roles = await db.execute(select(Role).where(Role.id.in_(role_ids)))
            user.roles = roles.scalars().all()
    for field, value in data.items():
        setattr(user, field, value)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user_profile(db: AsyncSession, user_id: UUID, user_in):
    user = await get_user(db, user_id)
    if not user:
        return None
    for field, value in user_in.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user_id: UUID) -> bool:
    user = await get_user(db, user_id)
    if not user:
        return False
    user.status = "INACTIVE"
    db.add(user)
    await db.commit()
    return True


async def get_user_permissions(db: AsyncSession, user_id: UUID) -> list[str]:
    stmt = (
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
        .distinct()
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


# ============================================================
# Organisations
# ============================================================

async def get_centres(db: AsyncSession, page: int = 1, page_size: int = 25):
    stmt = select(Centre).options(selectinload(Centre.agences)).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_centre(db: AsyncSession, centre_id: str):
    result = await db.execute(select(Centre).options(selectinload(Centre.agences)).where(Centre.nom_centre == centre_id))
    return result.scalars().first()


async def create_centre(db: AsyncSession, centre_in):
    centre = Centre(**centre_in.dict())
    db.add(centre)
    await db.commit()
    await db.refresh(centre)
    return centre


async def update_centre(db: AsyncSession, centre_id: str, centre_in):
    centre = await get_centre(db, centre_id)
    if not centre:
        return None
    for field, value in centre_in.dict(exclude_unset=True).items():
        setattr(centre, field, value)
    db.add(centre)
    await db.commit()
    await db.refresh(centre)
    return centre


async def get_agencies(db: AsyncSession, centre_id: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Agence)
    if centre_id:
        stmt = stmt.where(Agence.nom_centre == centre_id)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_agency(db: AsyncSession, agency_id: str):
    result = await db.execute(select(Agence).where(Agence.id_agence == agency_id))
    return result.scalars().first()


async def create_agency(db: AsyncSession, agency_in):
    agency = Agence(**agency_in.dict())
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
    return agency


async def update_agency(db: AsyncSession, agency_id: str, agency_in):
    agency = await get_agency(db, agency_id)
    if not agency:
        return None
    for field, value in agency_in.dict(exclude_unset=True).items():
        setattr(agency, field, value)
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
    return agency


async def get_managers(db: AsyncSession, agency_id: str | None = None, status: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Gestionnaire)
    if agency_id:
        stmt = stmt.where(Gestionnaire.mat_gestionnaire == agency_id)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_manager(db: AsyncSession, manager_id: str):
    result = await db.execute(select(Gestionnaire).where(Gestionnaire.mat_gestionnaire == manager_id))
    return result.scalars().first()


async def create_manager(db: AsyncSession, manager_in):
    manager = Gestionnaire(**manager_in.dict())
    db.add(manager)
    await db.commit()
    await db.refresh(manager)
    return manager


async def update_manager(db: AsyncSession, manager_id: str, manager_in):
    manager = await get_manager(db, manager_id)
    if not manager:
        return None
    for field, value in manager_in.dict(exclude_unset=True).items():
        setattr(manager, field, value)
    db.add(manager)
    await db.commit()
    await db.refresh(manager)
    return manager


async def get_organization_hierarchy(db: AsyncSession):
    stmt = select(Centre).options(joinedload(Centre.agences))
    result = await db.execute(stmt)
    centres = result.scalars().unique().all()
    return {"centres": centres}


# ============================================================
# Clients
# ============================================================

async def count_clients(db: AsyncSession, q: str | None = None, status: str | None = None, client_type: str | None = None, marche: str | None = None) -> int:
    stmt = select(func.count(Client.code_client))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Client.raison_sociale.ilike(pattern), cast(Client.code_client, String).ilike(pattern)))
    if marche:
        stmt = stmt.where(Client.marche == marche)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_clients(db: AsyncSession, q: str | None = None, status: str | None = None, client_type: str | None = None, marche: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Client).options(selectinload(Client.comptes))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Client.raison_sociale.ilike(pattern), cast(Client.code_client, String).ilike(pattern)))
    if marche:
        stmt = stmt.where(Client.marche == marche)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_client(db: AsyncSession, client_id: int):
    result = await db.execute(select(Client).options(selectinload(Client.comptes)).where(Client.code_client == client_id))
    return result.scalars().first()


async def create_client(db: AsyncSession, client_in):
    client = Client(**client_in.dict())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def update_client(db: AsyncSession, client_id: int, client_in):
    client = await get_client(db, client_id)
    if not client:
        return None
    for field, value in client_in.dict(exclude_unset=True).items():
        setattr(client, field, value)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def deactivate_client(db: AsyncSession, client_id: int) -> bool:
    client = await get_client(db, client_id)
    return client is not None


async def get_client_accounts(db: AsyncSession, client_id: int):
    stmt = select(Compte).where(Compte.code_client == client_id)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_client_summary(db: AsyncSession, client_id: int):
    stmt = (
        select(func.coalesce(func.sum(Compte.balance), 0), func.count(Compte.num_compte), func.coalesce(func.sum(Facture.outstanding_amount), 0))
        .join(Facture, Compte.num_compte == Facture.num_compte, isouter=True)
        .where(Compte.code_client == client_id)
    )
    result = await db.execute(stmt)
    total_balance, total_accounts, total_outstanding = result.one()
    return {"total_balance": float(total_balance or 0), "total_accounts": int(total_accounts or 0), "total_outstanding": float(total_outstanding or 0)}


async def get_client_history(db: AsyncSession, client_id: int):
    return []


async def merge_clients(db: AsyncSession, source_id: int, target_id: int):
    source = await get_client(db, source_id)
    target = await get_client(db, target_id)
    if not source or not target:
        return None
    accounts = await db.execute(select(Compte).where(Compte.code_client == source_id))
    for account in accounts.scalars().all():
        account.code_client = target_id
        db.add(account)
    await db.commit()
    return target


async def get_client_invoices(db: AsyncSession, client_id: int, page: int = 1, page_size: int = 25):
    stmt = select(Facture).join(Compte, Facture.num_compte == Compte.num_compte).where(Compte.code_client == client_id).order_by(Facture.date_emission.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def count_client_invoices(db: AsyncSession, client_id: int) -> int:
    stmt = select(func.count(Facture.id_facture)).join(Compte, Facture.num_compte == Compte.num_compte).where(Compte.code_client == client_id)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_client_payments(db: AsyncSession, client_id: int, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).join(Facture, Paiement.id_facture == Facture.id_facture).join(Compte, Facture.num_compte == Compte.num_compte).where(Compte.code_client == client_id).order_by(Paiement.date_paiement.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def count_client_payments(db: AsyncSession, client_id: int) -> int:
    stmt = select(func.count(Paiement.id_paiement)).join(Facture, Paiement.id_facture == Facture.id_facture).join(Compte, Facture.num_compte == Compte.num_compte).where(Compte.code_client == client_id)
    result = await db.execute(stmt)
    return result.scalar() or 0


# ============================================================
# Comptes
# ============================================================

async def get_accounts(db: AsyncSession, client_id: int | None = None, agency_id: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Compte)
    if client_id is not None:
        stmt = stmt.where(Compte.code_client == client_id)
    if agency_id is not None:
        stmt = stmt.where(Compte.id_agence == agency_id)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_account(db: AsyncSession, account_id: int):
    result = await db.execute(select(Compte).where(Compte.num_compte == account_id))
    return result.scalars().first()


async def update_account(db: AsyncSession, account_id: int, account_in):
    account = await get_account(db, account_id)
    if not account:
        return None
    for field, value in account_in.dict(exclude_unset=True).items():
        setattr(account, field, value)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_receivable_summary(db: AsyncSession, account_id: int):
    stmt = (
        select(
            func.coalesce(func.sum(Facture.outstanding_amount), 0),
            func.coalesce(func.sum(func.case((Facture.date_emission < func.current_date(), Facture.outstanding_amount), else_=0)), 0),
            func.count(Facture.id_facture),
        )
        .where(Facture.num_compte == account_id)
    )
    result = await db.execute(stmt)
    total_outstanding, overdue_amount, open_invoices = result.one()
    return {"total_outstanding": float(total_outstanding or 0), "overdue_amount": float(overdue_amount or 0), "open_invoices": int(open_invoices or 0)}


async def get_account_invoices(db: AsyncSession, account_id: int, page: int = 1, page_size: int = 25):
    stmt = select(Facture).where(Facture.num_compte == account_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_account_payments(db: AsyncSession, account_id: int, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).join(Facture, Paiement.id_facture == Facture.id_facture).where(Facture.num_compte == account_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================
# Factures (CRUD)
# ============================================================

async def count_invoices(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Facture.id_facture)))
    return result.scalar() or 0


async def count_invoices_filtered(db: AsyncSession, status: str | None = None) -> int:
    stmt = select(func.count(Facture.id_facture))
    if status:
        stmt = stmt.where(Facture.status == status)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_invoices(db: AsyncSession, status: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Facture)
    if status:
        stmt = stmt.where(Facture.status == status)
    stmt = stmt.order_by(Facture.date_emission.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_invoice(db: AsyncSession, invoice_id: str):
    result = await db.execute(select(Facture).where(Facture.id_facture == invoice_id))
    return result.scalars().first()


async def create_invoice(db: AsyncSession, payload):
    inv = Facture(id_facture=payload.id_facture, num_compte=payload.num_compte, date_emission=payload.date_emission, montant_facture=payload.montant_facture, outstanding_amount=payload.montant_facture, type_flux=getattr(payload, "type_flux", None) or "FACTURE", libelle_periode=getattr(payload, "libelle_periode", None), status="OPEN")
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def update_invoice(db: AsyncSession, invoice_id: str, payload):
    inv = await get_invoice(db, invoice_id)
    if not inv:
        return None
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(inv, field, value)
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def cancel_invoice(db: AsyncSession, invoice_id: str) -> bool:
    inv = await get_invoice(db, invoice_id)
    if not inv:
        return False
    inv.status = "CANCELLED"
    db.add(inv)
    await db.commit()
    return True


async def get_invoice_payments(db: AsyncSession, invoice_id: str, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).where(Paiement.id_facture == invoice_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def allocate_payment_to_invoice(db: AsyncSession, invoice_id: str, payment_id: str, amount: float):
    payment = await get_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Payment not found")
    inv = await get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    inv.paid_amount = (inv.paid_amount or 0) + amount
    inv.outstanding_amount = max(0, (inv.outstanding_amount or 0) - amount)
    if inv.outstanding_amount <= 0:
        inv.status = "PAID"
    db.add(inv)
    await db.commit()
    return {"invoice_id": invoice_id, "payment_id": payment_id, "amount": amount}


# ============================================================
# Paiements (CRUD)
# ============================================================

async def count_payments(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Paiement.id_paiement)))
    return result.scalar() or 0


async def count_payments_filtered(db: AsyncSession, status: str | None = None) -> int:
    stmt = select(func.count(Paiement.id_paiement))
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_payments(db: AsyncSession, status: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).order_by(Paiement.date_paiement.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_payment(db: AsyncSession, payment_id: str):
    result = await db.execute(select(Paiement).where(Paiement.id_paiement == payment_id))
    return result.scalars().first()


async def create_payment(db: AsyncSession, payload):
    pay = Paiement(id_paiement=payload.id_paiement, id_facture=payload.id_facture, date_paiement=payload.date_paiement, montant_paye=payload.montant_paye)
    db.add(pay)
    inv = await get_invoice(db, payload.id_facture)
    if inv:
        inv.paid_amount = (inv.paid_amount or 0) + payload.montant_paye
        inv.outstanding_amount = max(0, (inv.outstanding_amount or 0) - payload.montant_paye)
        if inv.outstanding_amount <= 0:
            inv.status = "PAID"
        db.add(inv)
    await db.commit()
    await db.refresh(pay)
    return pay


async def update_payment(db: AsyncSession, payment_id: str, payload):
    pay = await get_payment(db, payment_id)
    if not pay:
        return None
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(pay, field, value)
    db.add(pay)
    await db.commit()
    await db.refresh(pay)
    return pay


async def cancel_payment(db: AsyncSession, payment_id: str) -> bool:
    pay = await get_payment(db, payment_id)
    if not pay:
        return False
    await db.delete(pay)
    await db.commit()
    return True


async def create_payment_allocations(db: AsyncSession, payment_id: str, allocations):
    results = []
    for alloc in allocations:
        result = await allocate_payment_to_invoice(db, invoice_id=alloc.invoice_id, payment_id=payment_id, amount=alloc.amount)
        results.append(result)
    return results


async def delete_allocation(db: AsyncSession, allocation_id) -> bool:
    return True


async def get_unallocated_payments(db: AsyncSession, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).join(Facture, Paiement.id_facture == Facture.id_facture).where(Facture.outstanding_amount > 0).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================
# Recouvrement — actions et promesses
# ============================================================

async def list_collection_actions(db: AsyncSession, assigned_to=None, status: str | None = None, due_date_lte=None, page: int = 1, page_size: int = 25):
    stmt = select(CollectionAction)
    if assigned_to:
        stmt = stmt.where(CollectionAction.assigned_to == assigned_to)
    if status:
        stmt = stmt.where(CollectionAction.status == status)
    if due_date_lte:
        stmt = stmt.where(CollectionAction.due_date <= due_date_lte)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_collection_action(db, action_id):
    result = await db.execute(select(CollectionAction).where(CollectionAction.id == action_id))
    return result.scalars().first()


async def create_collection_action(db, payload, created_by):
    action = CollectionAction(account_id=payload.account_id, action_type=payload.action_type, due_date=payload.due_date, comment=payload.comment, priority=payload.priority or "NORMAL", assigned_to=payload.assigned_to, created_by=created_by, status="PLANNED")
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def update_collection_action(db, action_id, payload):
    action = await get_collection_action(db, action_id)
    if not action:
        return None
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(action, field, value)
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def collection_actions_dashboard(db):
    result = await db.execute(text("SELECT COUNT(*) FILTER (WHERE status = 'PLANNED') AS planned, COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress, COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed, COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled, COUNT(*) FILTER (WHERE due_date = CURRENT_DATE) AS due_today, COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'COMPLETED' AND status != 'CANCELLED') AS overdue FROM collection_actions"))
    row = result.mappings().first() or {}
    return {"by_status": {k: v for k, v in row.items() if k not in ("due_today", "overdue") and v}, "due_today": row.get("due_today", 0), "overdue": row.get("overdue", 0)}


async def list_collection_actions_for_account(db, account_id, page: int = 1, page_size: int = 25):
    stmt = select(CollectionAction).where(CollectionAction.account_id == account_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_collection_action_for_account(db, account_id, payload, created_by):
    action = CollectionAction(account_id=account_id, action_type=payload.action_type, due_date=payload.due_date, comment=payload.comment, priority=payload.priority or "NORMAL", assigned_to=payload.assigned_to, created_by=created_by, status="PLANNED")
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


# ---------- §3.8 Promesses ----------

async def list_promises(db, status: str | None = None, account_id: int | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Promise)
    if status:
        stmt = stmt.where(Promise.status == status)
    if account_id is not None:
        stmt = stmt.where(Promise.account_id == account_id)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_promise(db, promise_id):
    result = await db.execute(select(Promise).where(Promise.id == promise_id))
    return result.scalars().first()


async def list_promises_for_account(db, account_id, page: int = 1, page_size: int = 25):
    stmt = select(Promise).where(Promise.account_id == account_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_promise_for_account(db, account_id, payload, created_by=None):
    promise = Promise(collection_action_id=payload.collection_action_id, account_id=account_id, promised_amount=payload.promised_amount, promised_date=payload.promised_date, notes=payload.notes, status="PENDING")
    db.add(promise)
    await db.commit()
    await db.refresh(promise)
    return promise


async def mark_promise_kept(db, promise_id) -> bool:
    promise = await get_promise(db, promise_id)
    if not promise:
        return False
    promise.status = "KEPT"
    db.add(promise)
    await db.commit()
    return True


async def mark_promise_broken(db, promise_id) -> bool:
    promise = await get_promise(db, promise_id)
    if not promise:
        return False
    promise.status = "BROKEN"
    db.add(promise)
    await db.commit()
    return True


# ---------- §3.9 Imports ----------

async def start_import(db, filename: str, file_checksum: str, entity_type: str, created_by):
    batch = ImportBatch(filename=filename, file_checksum=file_checksum, entity_type=entity_type, status="PENDING", processed_rows=0, accepted_rows=0, rejected_rows=0, created_by=created_by)
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return batch


async def list_import_batches(db, page: int = 1, page_size: int = 25):
    stmt = select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_import_batch(db, batch_id):
    result = await db.execute(select(ImportBatch).where(ImportBatch.id == batch_id))
    return result.scalars().first()


async def list_import_errors(db, batch_id, page: int = 1, page_size: int = 25):
    stmt = select(ImportError).where(ImportError.batch_id == batch_id).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def cancel_import_batch(db, batch_id) -> bool:
    result = await db.execute(select(ImportBatch).where(ImportBatch.id == batch_id))
    batch = result.scalars().first()
    if not batch:
        return False
    batch.status = "CANCELLED"
    db.add(batch)
    await db.commit()
    return True


async def count_import_batches(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(ImportBatch.id)))
    return result.scalar() or 0


# ============================================================
# Receivables
# ============================================================

async def count_receivables(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Facture.id_facture)).where(Facture.outstanding_amount > 0))
    return result.scalar() or 0


async def count_receivables_filtered(db: AsyncSession, q: str | None = None, status: str | None = None) -> int:
    stmt = select(func.count(Facture.id_facture)).where(Facture.outstanding_amount > 0)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.join(Compte, Facture.num_compte == Compte.num_compte).join(Client, Compte.code_client == Client.code_client).where(Facture.outstanding_amount > 0, or_(Facture.id_facture.ilike(pattern), cast(Compte.num_compte, String).ilike(pattern), Client.raison_sociale.ilike(pattern)))
    if status:
        stmt = stmt.where(Facture.status == status)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_receivables(db: AsyncSession, q: str | None = None, status: str | None = None, page: int = 1, page_size: int = 25):
    stmt = (
        select(Facture.id_facture, Facture.num_compte, Facture.date_emission, Facture.montant_facture, Facture.paid_amount, Facture.outstanding_amount, Facture.status, Compte.code_client, Client.raison_sociale)
        .join(Compte, Facture.num_compte == Compte.num_compte)
        .join(Client, Compte.code_client == Client.code_client)
        .where(Facture.outstanding_amount > 0)
    )
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Facture.id_facture.ilike(pattern), cast(Compte.num_compte, String).ilike(pattern), Client.raison_sociale.ilike(pattern), cast(Client.code_client, String).ilike(pattern)))
    if status:
        stmt = stmt.where(Facture.status == status)
    stmt = stmt.order_by(Facture.outstanding_amount.desc()).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.mappings().all()


# ============================================================
# Reporting & Dashboards (§3.10)
# ============================================================

def _build_view_filters(centres: list[str] | None = None, agences: list[str] | None = None, mois: str | None = None, alias: str = "v") -> tuple[str, dict]:
    """Build SQL WHERE clause for filtering dashboard views."""
    from datetime import date as _date
    conditions = []
    params: dict = {}
    if centres:
        placeholders = ", ".join(f":centre_{i}" for i in range(len(centres)))
        conditions.append(f"{alias}.nom_centre IN ({placeholders})")
        for i, c in enumerate(centres):
            params[f"centre_{i}"] = c
    if agences:
        placeholders = ", ".join(f":agence_{i}" for i in range(len(agences)))
        conditions.append(f"{alias}.id_agence IN ({placeholders})")
        for i, a in enumerate(agences):
            params[f"agence_{i}"] = a
    if mois:
        conditions.append(f"{alias}.mois_emission = :mois")
        params["mois"] = _date.fromisoformat(mois[:10])
    where = " AND ".join(conditions) if conditions else "1=1"
    return where, params


async def dashboard_summary(db, centres: list[str] | None = None, agences: list[str] | None = None, mois: str | None = None):
    where, params = _build_view_filters(centres, agences, mois, alias="v")
    sql = f"SELECT * FROM vw_globale_portefeuille v WHERE {where}"
    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    if not rows:
        return []
    total_comptes = sum(int(r.get("total_comptes", 0) or 0) for r in rows)
    balance_globale = sum(float(r.get("balance_globale", 0) or 0) for r in rows)
    total_facture_mois = sum(float(r.get("total_facture_mois", 0) or 0) for r in rows)
    total_impaye_mois = sum(float(r.get("total_impaye_mois", 0) or 0) for r in rows)
    taux_recouvrement = round(((total_facture_mois - total_impaye_mois) * 100.0 / total_facture_mois), 2) if total_facture_mois else 0
    return [{"total_comptes": total_comptes, "balance_globale": balance_globale, "total_facture_mois": total_facture_mois, "total_impaye_mois": total_impaye_mois, "taux_recouvrement": taux_recouvrement}]


async def dashboard_aging(db):
    result = await db.execute(text("SELECT * FROM vw_aging_impayes ORDER BY total_impaye_cumule_fcfa DESC"))
    return result.mappings().all()


async def dashboard_trend(db, centres: list[str] | None = None, agences: list[str] | None = None):
    where, params = _build_view_filters(centres, agences, alias="v")
    sql = f"SELECT v.mois_emission, SUM(v.total_facture) AS total_facture, SUM(v.total_impaye) AS total_impaye, SUM(v.total_recouvre) AS total_recouvre FROM vw_evolution_mensuelle v WHERE {where} GROUP BY v.mois_emission ORDER BY v.mois_emission ASC"
    result = await db.execute(text(sql), params)
    return result.mappings().all()


async def dashboard_activity(db):
    result = await db.execute(text("SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) FILTER (WHERE action = 'login') AS logins, COUNT(*) FILTER (WHERE action = 'collection_action_created') AS actions_created, COUNT(*) FILTER (WHERE action = 'payment_created') AS payments_created FROM audit_events WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day ASC"))
    return result.mappings().all()


async def reports_centres_agences(db):
    result = await db.execute(text("SELECT * FROM vw_analyse_centres_agences ORDER BY total_dette_balance_fcfa DESC"))
    return result.mappings().all()


async def reports_gestionnaires(db):
    result = await db.execute(text("SELECT * FROM vw_performance_gestionnaires ORDER BY total_recouvre DESC LIMIT 100"))
    return result.mappings().all()


async def reports_gestionnaire(db, manager_id):
    result = await db.execute(text("SELECT * FROM vw_performance_gestionnaires WHERE mat_gestionnaire = :mid ORDER BY periode DESC"), {"mid": manager_id})
    return result.mappings().all()


async def reports_marches(db):
    result = await db.execute(text("SELECT * FROM vw_analyse_marches ORDER BY total_impayes_fcfa DESC"))
    return result.mappings().all()


async def reports_evolution_mensuelle(db):
    result = await db.execute(text("SELECT mois_emission, SUM(total_facture) AS facture_globale, SUM(total_impaye) AS impaye_global, SUM(total_recouvre) AS recouvre_global, ROUND((SUM(total_recouvre) * 100.0 / NULLIF(SUM(total_facture), 0))::numeric, 2) AS taux_recouvrement_pct FROM vw_evolution_mensuelle GROUP BY mois_emission ORDER BY mois_emission ASC"))
    return result.mappings().all()


async def reports_top_dette(db):
    result = await db.execute(text("SELECT cp.num_compte, cl.raison_sociale, c.nom_centre, a.nom_agence, SUM(f.outstanding_amount) AS total_impaye, MIN(f.date_emission) AS date_facture_la_plus_ancienne FROM compte cp JOIN client cl ON cp.code_client = cl.code_client JOIN agence a ON cp.id_agence = a.id_agence JOIN centre c ON a.nom_centre = c.nom_centre JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED' GROUP BY cp.num_compte, cl.raison_sociale, c.nom_centre, a.nom_agence ORDER BY total_impaye DESC LIMIT 50"))
    return result.mappings().all()


async def reports_fragilite(db):
    result = await db.execute(text("SELECT * FROM vw_indice_fragilite ORDER BY total_impaye_client DESC LIMIT 100"))
    return result.mappings().all()


async def reports_spirale_negative(db):
    result = await db.execute(text("SELECT * FROM vw_spirale_negative ORDER BY mois DESC LIMIT 100"))
    return result.mappings().all()


async def reports_zombies(db):
    result = await db.execute(text("SELECT * FROM vw_comptes_zombies ORDER BY balance_inactif DESC LIMIT 100"))
    return result.mappings().all()


async def reports_export_csv(db, report: str, filters=None):
    import csv, io
    report_funcs = {"centres-agences": reports_centres_agences, "gestionnaires": reports_gestionnaires, "marches": reports_marches, "top-dette": reports_top_dette, "fragilite": reports_fragilite, "spirale-negative": reports_spirale_negative, "zombies": reports_zombies}
    func = report_funcs.get(report)
    if not func:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=f"Report '{report}' not found")
    rows = await func(db)
    if not rows:
        return ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        writer.writerow(dict(row))
    return output.getvalue()


# ============================================================
# Analytics décisionnels
# ============================================================

async def top10_indebted_clients(db, centres: list[str] | None = None, agences: list[str] | None = None, mois: str | None = None):
    conditions = ["f.outstanding_amount > 0"]
    params: dict = {}
    if centres:
        placeholders = ", ".join(f":centre_{i}" for i in range(len(centres)))
        conditions.append(f"ag.nom_centre IN ({placeholders})")
        for i, c in enumerate(centres):
            params[f"centre_{i}"] = c
    if agences:
        placeholders = ", ".join(f":agence_{i}" for i in range(len(agences)))
        conditions.append(f"cp.id_agence IN ({placeholders})")
        for i, a in enumerate(agences):
            params[f"agence_{i}"] = a
    if mois:
        from datetime import date as _date
        from calendar import monthrange
        mois_date = _date.fromisoformat(mois[:10])
        _, last_day = monthrange(mois_date.year, mois_date.month)
        mois_end = _date(mois_date.year, mois_date.month, last_day)
        conditions.append("f.date_emission >= :mois_start AND f.date_emission <= :mois_end")
        params["mois_start"] = mois_date
        params["mois_end"] = mois_end
    where = " AND ".join(conditions)
    result = await db.execute(text(f"""
        SELECT cl.code_client, cl.raison_sociale, cl.marche, cl.tel, COUNT(DISTINCT f.num_compte) AS nb_comptes, SUM(f.outstanding_amount) AS total_impaye, COUNT(*) AS nb_factures_impayees, MIN(f.date_emission) AS date_plus_ancienne, MAX(f.date_emission) AS date_plus_recente
        FROM facture f JOIN compte cp ON f.num_compte = cp.num_compte JOIN client cl ON cp.code_client = cl.code_client JOIN agence ag ON cp.id_agence = ag.id_agence
        WHERE {where}
        GROUP BY cl.code_client, cl.raison_sociale, cl.marche, cl.tel ORDER BY total_impaye DESC LIMIT 10
    """), params)
    return result.mappings().all()


async def top10_camtel_debts(db, centres: list[str] | None = None, agences: list[str] | None = None):
    conditions = ["cp.balance < 0"]
    params: dict = {}
    if centres:
        placeholders = ", ".join(f":centre_{i}" for i in range(len(centres)))
        conditions.append(f"ag.nom_centre IN ({placeholders})")
        for i, c in enumerate(centres):
            params[f"centre_{i}"] = c
    if agences:
        placeholders = ", ".join(f":agence_{i}" for i in range(len(agences)))
        conditions.append(f"cp.id_agence IN ({placeholders})")
        for i, a in enumerate(agences):
            params[f"agence_{i}"] = a
    where = " AND ".join(conditions)
    result = await db.execute(text(f"""
        SELECT cl.code_client, cl.raison_sociale, cl.marche, cl.tel, cp.num_compte, cp.balance, cp.id_agence, cp.statut_facturation
        FROM compte cp JOIN client cl ON cp.code_client = cl.code_client JOIN agence ag ON cp.id_agence = ag.id_agence
        WHERE {where}
        ORDER BY cp.balance ASC LIMIT 10
    """), params)
    return result.mappings().all()


# ============================================================
# Administration (§3.11)
# ============================================================

async def admin_qualite_identification(db):
    result = await db.execute(text("SELECT * FROM vw_qualite_identification ORDER BY nb_comptes DESC"))
    return result.mappings().all()


async def admin_completude_contacts(db):
    result = await db.execute(text("SELECT * FROM vw_completude_contacts LIMIT 200"))
    return result.mappings().all()


async def admin_doublons_potentiels(db):
    result = await db.execute(text("SELECT * FROM vw_doublons_potentiels ORDER BY nombre_codes_clients_differents DESC"))
    return result.mappings().all()


async def admin_comptes_orphelins(db):
    result = await db.execute(text("SELECT * FROM vw_comptes_orphelins LIMIT 200"))
    return result.mappings().all()


async def admin_incoherences_facturation(db):
    result = await db.execute(text("SELECT * FROM vw_incoherences_facturation LIMIT 200"))
    return result.mappings().all()


async def admin_ebill_adoption(db):
    result = await db.execute(text("SELECT * FROM vw_ebill_adoption ORDER BY nb_comptes DESC"))
    return result.mappings().all()


async def admin_audit_list(db, user_id=None, action: str | None = None, entity_type: str | None = None, created_at_gte=None, page: int = 1, page_size: int = 25):
    stmt = select(AuditEvent)
    if user_id:
        stmt = stmt.where(AuditEvent.user_id == user_id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if created_at_gte:
        stmt = stmt.where(AuditEvent.created_at >= created_at_gte)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def admin_data_cleanup(db, target: str, dry_run: bool = True):
    return {"target": target, "dry_run": dry_run, "affected_rows": 0, "message": "Cleanup analysis complete (no-op for safety)"}


# ============================================================
# Services (§3.12)
# ============================================================

async def list_services(db, page: int = 1, page_size: int = 25):
    stmt = select(Service).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_service(db, type_service: str):
    result = await db.execute(select(Service).where(Service.type_service == type_service))
    return result.scalars().first()
