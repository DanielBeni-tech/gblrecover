from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthRefresh(BaseModel):
    refresh_token: str


class AuthLogout(BaseModel):
    refresh_token: Optional[str] = None


class AuthChangePassword(BaseModel):
    current_password: str
    new_password: str


class AuthForgotPassword(BaseModel):
    email: str


class AuthResetPassword(BaseModel):
    token: str
    new_password: str


class UserBase(BaseModel):
    email: str
    full_name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    role_ids: Optional[List[UUID]] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    status: Optional[str] = None
    role_ids: Optional[List[UUID]] = None


class UserRead(UserBase):
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthToken(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: Optional[UserRead] = None


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)


class CentreBase(BaseModel):
    nom_centre: str = Field(min_length=1, max_length=128)


class CentreCreate(CentreBase):
    pass


class CentreUpdate(BaseModel):
    nom_centre: Optional[str] = Field(None, min_length=1, max_length=128)


class AgencyBase(BaseModel):
    id_agence: str = Field(min_length=1, max_length=128)
    nom_centre: str = Field(min_length=1, max_length=128)
    nom_agence: Optional[str] = Field(None, max_length=128)


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    nom_agence: Optional[str] = Field(None, max_length=128)
    nom_centre: Optional[str] = Field(None, max_length=128)


class ManagerBase(BaseModel):
    mat_gestionnaire: str = Field(min_length=1, max_length=128)
    nom_gestionnaire: str = Field(min_length=1, max_length=128)
    tel_gestionnaire: Optional[int] = None
    email_gestionnaire: Optional[str] = Field(None, max_length=128)


class ManagerCreate(ManagerBase):
    pass


class ManagerUpdate(BaseModel):
    nom_gestionnaire: Optional[str] = Field(None, max_length=128)
    tel_gestionnaire: Optional[int] = None
    email_gestionnaire: Optional[str] = Field(None, max_length=128)


class CentreRead(CentreBase):
    agences: Optional[List[AgencyBase]] = None

    class Config:
        from_attributes = True


class AgencyRead(AgencyBase):
    class Config:
        from_attributes = True


class ManagerRead(ManagerBase):
    class Config:
        from_attributes = True


class OrganizationHierarchy(BaseModel):
    centres: List[CentreRead]


class ClientBase(BaseModel):
    code_client: int
    raison_sociale: str = Field(min_length=1, max_length=128)
    marche: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=128)
    tel: Optional[int] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    raison_sociale: Optional[str] = Field(None, max_length=128)
    marche: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=128)
    tel: Optional[int] = None


class AccountRead(BaseModel):
    num_compte: int
    mat_gestionnaire: Optional[str]
    id_agence: str
    code_client: int
    e_bill: Optional[str]
    statut_souscription: Optional[str]
    identification: Optional[str]
    balance: float

    class Config:
        from_attributes = True


class ClientRead(ClientBase):
    comptes: Optional[List[AccountRead]] = None

    class Config:
        from_attributes = True


class ClientSummary(BaseModel):
    total_balance: float
    total_accounts: int
    total_outstanding: float


class ClientHistoryItem(BaseModel):
    timestamp: datetime
    action: str
    note: Optional[str] = None


class ClientMergeRequest(BaseModel):
    source_id: int
    target_id: int


class ServiceBase(BaseModel):
    type_service: str = Field(min_length=1, max_length=128)
    libelle_service: Optional[str] = Field(None, max_length=128)


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    libelle_service: Optional[str] = Field(None, max_length=128)


class ServiceRead(ServiceBase):
    class Config:
        from_attributes = True


class SubscriptionBase(BaseModel):
    type_service: str
    num_compte: int
    date_souscription: Optional[date] = None
    statut_souscription: Optional[str] = None


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionUpdate(BaseModel):
    date_souscription: Optional[date] = None
    statut_souscription: Optional[str] = None


class SubscriptionRead(SubscriptionBase):
    class Config:
        from_attributes = True


class InvoiceRead(BaseModel):
    id_facture: str
    num_compte: int
    date_emission: Optional[date] = None
    montant_facture: Optional[float] = None
    paid_amount: Optional[float] = None
    outstanding_amount: Optional[float] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentRead(BaseModel):
    id_paiement: str
    id_facture: str
    date_paiement: Optional[date] = None
    montant_paye: Optional[float] = None

    class Config:
        from_attributes = True


class AllocationCreate(BaseModel):
    invoice_id: str
    amount: float


class AllocationRead(BaseModel):
    id: UUID
    invoice_id: str
    amount: float

    class Config:
        from_attributes = True


class ReceivableSummary(BaseModel):
    total_outstanding: float
    overdue_amount: float
    open_invoices: int


class PermissionsRead(BaseModel):
    permissions: List[str]


# ============================================================
# Schémas étendus — sections 3.5 à 3.12 (appendice spec v2)
# ============================================================


# ---------- Factures (§3.6) ----------

class InvoiceBase(BaseModel):
    id_facture: str = Field(min_length=1, max_length=128)
    num_compte: int
    date_emission: date
    montant_facture: float
    type_flux: Optional[str] = Field(None, max_length=50)
    libelle_periode: Optional[str] = Field(None, max_length=128)


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    date_emission: Optional[date] = None
    montant_facture: Optional[float] = None
    type_flux: Optional[str] = Field(None, max_length=50)
    libelle_periode: Optional[str] = Field(None, max_length=128)
    status: Optional[str] = Field(None, max_length=50)


# ---------- Paiements (§3.7) ----------

class PaymentBase(BaseModel):
    id_paiement: str = Field(min_length=1, max_length=128)
    id_facture: str = Field(min_length=1, max_length=128)
    date_paiement: Optional[date] = None
    montant_paye: Optional[float] = None


class PaymentCreate(BaseModel):
    id_paiement: str = Field(min_length=1, max_length=128)
    id_facture: str = Field(min_length=1, max_length=128)
    date_paiement: date
    montant_paye: float


class PaymentUpdate(BaseModel):
    date_paiement: Optional[date] = None
    montant_paye: Optional[float] = None
    status: Optional[str] = Field(None, max_length=50)


# ---------- Allocations (§3.7) ----------

class AllocationCreate(BaseModel):
    invoice_id: str
    amount: float


class AllocationRead(BaseModel):
    id: UUID
    invoice_id: str
    amount: float

    class Config:
        from_attributes = True


class AllocationUpdate(BaseModel):
    allocated_amount: float


# ---------- Recouvrement — actions (§3.8) ----------

class CollectionActionBase(BaseModel):
    account_id: int
    action_type: str = Field(max_length=50)
    due_date: date
    comment: Optional[str] = None
    priority: Optional[str] = Field(None, max_length=20)


class CollectionActionCreate(CollectionActionBase):
    assigned_to: Optional[UUID] = None


class CollectionActionUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    comment: Optional[str] = None
    result: Optional[str] = Field(None, max_length=255)
    assigned_to: Optional[UUID] = None
    priority: Optional[str] = Field(None, max_length=20)
    due_date: Optional[date] = None


class CollectionActionRead(CollectionActionBase):
    id: UUID
    created_by: UUID
    status: str
    completed_at: Optional[datetime] = None
    result: Optional[str] = None
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CollectionActionDashboard(BaseModel):
    by_status: dict
    due_today: int
    overdue: int


# ---------- Promesses de paiement (§3.8) ----------

class PromiseBase(BaseModel):
    collection_action_id: UUID
    account_id: int
    promised_amount: float
    promised_date: date
    notes: Optional[str] = None


class PromiseCreate(PromiseBase):
    pass


class PromiseRead(PromiseBase):
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Imports Excel (§3.9) ----------

class ImportBatchRead(BaseModel):
    id: UUID
    filename: str
    file_checksum: str
    entity_type: str
    status: str
    total_rows: Optional[int] = None
    processed_rows: int
    accepted_rows: int
    rejected_rows: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportErrorRead(BaseModel):
    id: UUID
    batch_id: UUID
    row_number: int
    column_name: Optional[str] = None
    raw_value: Optional[str] = None
    error_message: str
    created_at: datetime

    class Config:
        from_attributes = True


class ImportStartResponse(BaseModel):
    batch_id: UUID
    status: str


# ---------- Audit (§3.11) ----------

class AuditEventRead(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: str
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Reporting & Admin (§3.10 et §3.11) ----------

class ReportRow(BaseModel):
    """Une ligne d'un rapport — schéma permissif qui accepte toutes les colonnes."""

    model_config = {"extra": "allow"}


class ReportCSVExportRequest(BaseModel):
    report: str
    filters: Optional[dict] = None


class DataCleanupRequest(BaseModel):
    target: str
    dry_run: bool = True
