from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from passlib.context import CryptContext
from uuid import UUID

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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


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

    user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        roles=roles,
    )
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
    data = user_in.dict(exclude_unset=True)
    for field, value in data.items():
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


async def get_centres(db: AsyncSession, page: int = 1, page_size: int = 25):
    stmt = select(Centre).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_centre(db: AsyncSession, centre_id: str):
    result = await db.execute(select(Centre).where(Centre.nom_centre == centre_id))
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
    centres = result.scalars().all()
    return {"centres": centres}


async def get_clients(db: AsyncSession, q: str | None = None, status: str | None = None, client_type: str | None = None, marche: str | None = None, page: int = 1, page_size: int = 25):
    stmt = select(Client)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Client.raison_sociale.ilike(pattern),
                cast(Client.code_client, String).ilike(pattern),
            )
        )
    if marche:
        stmt = stmt.where(Client.marche == marche)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_client(db: AsyncSession, client_id: int):
    result = await db.execute(select(Client).where(Client.code_client == client_id))
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
        select(
            func.coalesce(func.sum(Compte.balance), 0),
            func.count(Compte.num_compte),
            func.coalesce(func.sum(Facture.outstanding_amount), 0),
        )
        .join(Facture, Compte.num_compte == Facture.num_compte, isouter=True)
        .where(Compte.code_client == client_id)
    )
    result = await db.execute(stmt)
    total_balance, total_accounts, total_outstanding = result.one()
    return {
        "total_balance": float(total_balance or 0),
        "total_accounts": int(total_accounts or 0),
        "total_outstanding": float(total_outstanding or 0),
    }


async def get_client_history(db: AsyncSession, client_id: int):
    return []


async def merge_clients(db: AsyncSession, source_id: int, target_id: int):
    source = await get_client(db, source_id)
    target = await get_client(db, target_id)
    if not source or not target:
        return None
    await db.execute(select(Compte).where(Compte.code_client == source_id).execution_options(synchronize_session="fetch"))
    accounts = await db.execute(select(Compte).where(Compte.code_client == source_id))
    for account in accounts.scalars().all():
        account.code_client = target_id
        db.add(account)
    await db.commit()
    return target


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
    return {
        "total_outstanding": float(total_outstanding or 0),
        "overdue_amount": float(overdue_amount or 0),
        "open_invoices": int(open_invoices or 0),
    }


async def get_subscriptions(db: AsyncSession, page: int = 1, page_size: int = 25):
    # Subscriptions not modeled in DB yet; placeholder
    return []


async def get_invoices(db: AsyncSession, page: int = 1, page_size: int = 25):
    stmt = select(Facture).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_invoice(db: AsyncSession, invoice_id: str):
    result = await db.execute(select(Facture).where(Facture.id_facture == invoice_id))
    return result.scalars().first()


async def get_payments(db: AsyncSession, page: int = 1, page_size: int = 25):
    stmt = select(Paiement).limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_payment(db: AsyncSession, payment_id: str):
    result = await db.execute(select(Paiement).where(Paiement.id_paiement == payment_id))
    return result.scalars().first()


# ============================================================
# STUBS — sections 3.5 à 3.12 (appendice spec v2)
# ============================================================
#
# Les fonctions ci-dessous sont livrées en squelette : elles lèvent
# NotImplementedError pour signaler au front que l'endpoint existe dans
# le contrat mais que la logique métier n'est pas encore implémentée.
# Les routes FastAPI associées renvoient 501 Not Implemented.
#
# Voir API_specification_and_db_coherence_v2.md pour le détail de chaque
# opération.


def _todo(name: str) -> None:
    raise NotImplementedError(
        f"TODO: implement {name} — see API_specification_and_db_coherence_v2.md"
    )


# ---------- §3.5 Comptes — sous-routes manquantes ----------

async def get_account_invoices(db: AsyncSession, account_id: int, page: int = 1, page_size: int = 25):
    _todo("get_account_invoices")


async def get_account_payments(db: AsyncSession, account_id: int, page: int = 1, page_size: int = 25):
    _todo("get_account_payments")


# ---------- §3.6 Factures — POST/PATCH/DELETE + sub-routes ----------

async def create_invoice(db: AsyncSession, payload):
    _todo("create_invoice")


async def update_invoice(db: AsyncSession, invoice_id: str, payload):
    _todo("update_invoice")


async def cancel_invoice(db: AsyncSession, invoice_id: str) -> bool:
    _todo("cancel_invoice")


async def get_invoice_payments(db: AsyncSession, invoice_id: str, page: int = 1, page_size: int = 25):
    _todo("get_invoice_payments")


async def allocate_payment_to_invoice(db: AsyncSession, invoice_id: str, payment_id: str, amount: float):
    _todo("allocate_payment_to_invoice")


# ---------- §3.7 Paiements & Allocations ----------

async def create_payment(db: AsyncSession, payload):
    _todo("create_payment")


async def update_payment(db: AsyncSession, payment_id: str, payload):
    _todo("update_payment")


async def cancel_payment(db: AsyncSession, payment_id: str) -> bool:
    _todo("cancel_payment")


async def create_payment_allocations(db: AsyncSession, payment_id: str, allocations):
    _todo("create_payment_allocations")


async def delete_allocation(db: AsyncSession, allocation_id) -> bool:
    _todo("delete_allocation")


async def get_unallocated_payments(db: AsyncSession, page: int = 1, page_size: int = 25):
    _todo("get_unallocated_payments")


# ---------- §3.5 + §3.8 Recouvrement — actions de recouvrement ----------

async def list_collection_actions(
    db: AsyncSession,
    assigned_to=None,
    status: str | None = None,
    due_date_lte=None,
    page: int = 1,
    page_size: int = 25,
):
    _todo("list_collection_actions")


async def get_collection_action(db, action_id):
    _todo("get_collection_action")


async def create_collection_action(db, payload, created_by):
    _todo("create_collection_action")


async def update_collection_action(db, action_id, payload):
    _todo("update_collection_action")


async def collection_actions_dashboard(db):
    _todo("collection_actions_dashboard")


async def list_collection_actions_for_account(db, account_id, page: int = 1, page_size: int = 25):
    _todo("list_collection_actions_for_account")


async def create_collection_action_for_account(db, account_id, payload, created_by):
    _todo("create_collection_action_for_account")


# ---------- §3.8 Promesses de paiement ----------

async def list_promises(db, status: str | None = None, account_id: int | None = None, page: int = 1, page_size: int = 25):
    _todo("list_promises")


async def get_promise(db, promise_id):
    _todo("get_promise")


async def list_promises_for_account(db, account_id, page: int = 1, page_size: int = 25):
    _todo("list_promises_for_account")


async def create_promise_for_account(db, account_id, payload, created_by=None):
    _todo("create_promise_for_account")


async def mark_promise_kept(db, promise_id) -> bool:
    _todo("mark_promise_kept")


async def mark_promise_broken(db, promise_id) -> bool:
    _todo("mark_promise_broken")


# ---------- §3.9 Imports Excel ----------

async def start_import(db, filename: str, file_checksum: str, entity_type: str, created_by):
    _todo("start_import")


async def list_import_batches(db, page: int = 1, page_size: int = 25):
    _todo("list_import_batches")


async def get_import_batch(db, batch_id):
    _todo("get_import_batch")


async def list_import_errors(db, batch_id, page: int = 1, page_size: int = 25):
    _todo("list_import_errors")


async def cancel_import_batch(db, batch_id) -> bool:
    _todo("cancel_import_batch")


# ---------- §3.10 Reporting & Dashboards ----------

async def dashboard_summary(db):
    _todo("dashboard_summary")


async def dashboard_aging(db):
    _todo("dashboard_aging")


async def dashboard_trend(db):
    _todo("dashboard_trend")


async def dashboard_activity(db):
    _todo("dashboard_activity")


async def reports_centres_agences(db):
    _todo("reports_centres_agences")


async def reports_gestionnaires(db):
    _todo("reports_gestionnaires")


async def reports_gestionnaire(db, manager_id):
    _todo("reports_gestionnaire")


async def reports_marches(db):
    _todo("reports_marches")


async def reports_evolution_mensuelle(db):
    _todo("reports_evolution_mensuelle")


async def reports_top_dette(db):
    _todo("reports_top_dette")


async def reports_fragilite(db):
    _todo("reports_fragilite")


async def reports_spirale_negative(db):
    _todo("reports_spirale_negative")


async def reports_zombies(db):
    _todo("reports_zombies")


async def reports_export_csv(db, report: str, filters=None):
    _todo("reports_export_csv")


# ---------- §3.11 Administration & Qualité ----------

async def admin_qualite_identification(db):
    _todo("admin_qualite_identification")


async def admin_completude_contacts(db):
    _todo("admin_completude_contacts")


async def admin_doublons_potentiels(db):
    _todo("admin_doublons_potentiels")


async def admin_comptes_orphelins(db):
    _todo("admin_comptes_orphelins")


async def admin_incoherences_facturation(db):
    _todo("admin_incoherences_facturation")


async def admin_ebill_adoption(db):
    _todo("admin_ebill_adoption")


async def admin_audit_list(db, user_id=None, action: str | None = None, entity_type: str | None = None, created_at_gte=None, page: int = 1, page_size: int = 25):
    _todo("admin_audit_list")


async def admin_data_cleanup(db, target: str, dry_run: bool = True):
    _todo("admin_data_cleanup")


# ---------- §3.12 Services ----------

async def list_services(db, page: int = 1, page_size: int = 25):
    _todo("list_services")


async def get_service(db, type_service: str):
    _todo("get_service")

