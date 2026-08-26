/**
 * Types GBLRecover — calqués sur le contrat réel /api/v1 (backend/app/api/v1/schemas.py).
 * Les champs correspondent EXACTEMENT aux réponses Pydantic : code_client,
 * raison_sociale, num_compte, id_facture, id_paiement, etc.
 */

// ============================================================
// Authentification
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser | null;
}

// ============================================================
// Organisation (centres / agences / gestionnaires)
// ============================================================

export interface Centre {
  nom_centre: string;
  agences?: Agency[] | null;
}

export interface Agency {
  id_agence: string;
  nom_centre: string;
  nom_agence: string | null;
}

export interface Manager {
  mat_gestionnaire: string;
  nom_gestionnaire: string;
  tel_gestionnaire: number | null;
  email_gestionnaire: string | null;
}

// ============================================================
// Clients et comptes
// ============================================================

export interface Client {
  code_client: number;
  raison_sociale: string;
  marche: string | null;
  email: string | null;
  tel: number | null;
  comptes?: Account[] | null;
}

export interface Account {
  num_compte: number;
  mat_gestionnaire: string | null;
  id_agence: string;
  code_client: number;
  e_bill: string | null;
  statut_facturation: string | null;
  identification: string | null;
  balance: number;
}

export interface ClientSummary {
  total_balance: number;
  total_accounts: number;
  total_outstanding: number;
}

export interface ClientHistoryItem {
  timestamp: string;
  action: string;
  note: string | null;
}

// ============================================================
// Factures, paiements, créances
// ============================================================

export interface Invoice {
  id_facture: string;
  num_compte: number;
  date_emission: string | null;
  montant_facture: number | null;
  paid_amount: number | null;
  outstanding_amount: number | null;
  status: string | null;
}

export interface Payment {
  id_paiement: string;
  id_facture: string;
  date_paiement: string | null;
  montant_paye: number | null;
}

export interface ReceivableSummary {
  total_outstanding: number;
  overdue_amount: number;
  open_invoices: number;
}

// ============================================================
// Recouvrement
// ============================================================

export type CollectionActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface CollectionAction {
  id: string;
  account_id: number;
  action_type: string;
  due_date: string;
  comment: string | null;
  priority: string | null;
  created_by: string;
  status: string;
  completed_at: string | null;
  result: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionActionDashboard {
  by_status: Record<string, number>;
  due_today: number;
  overdue: number;
}

export interface Promise {
  id: string;
  collection_action_id: string;
  account_id: number;
  promised_amount: number;
  promised_date: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Alias exporté pour éviter la collision avec le `Promise` global. */
export type PaymentPromise = Promise;

// ============================================================
// Imports Excel (§3.9)
// ============================================================

export interface ImportBatch {
  id: string;
  filename: string;
  file_checksum: string;
  entity_type: string;
  status: string;
  total_rows: number | null;
  processed_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportError {
  id: string;
  batch_id: string;
  row_number: number;
  column_name: string | null;
  raw_value: string | null;
  error_message: string;
  created_at: string;
}

// ============================================================
// Services (§3.12)
// ============================================================

export interface Service {
  type_service: string;
  libelle_service: string | null;
}

// ============================================================
// Audit (§3.11)
// ============================================================

export interface AuditEvent {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
}

// ============================================================
// Dashboards (lignes de rapports / vues SQL — colonnes permissives)
// ============================================================

/** Ligne générique d'un dashboard : le backend projette les colonnes des vues SQL. */
export interface ReportRow {
  [key: string]: string | number | null | undefined;
}

export interface DashboardSummary extends ReportRow {}
export interface DashboardAging extends ReportRow {}
export interface DashboardTrend extends ReportRow {}
export interface DashboardActivity extends ReportRow {}

// ============================================================
// Pagination
// ============================================================

export interface PageMeta {
  total: number;
  page: number;
  page_size: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// ============================================================
// Erreurs API normalisées (TRD §5.3)
// ============================================================

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field: string; reason: string }>;
    request_id?: string;
  };
  detail?: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: Array<{ field: string; reason: string }>;

  constructor(status: number, message: string, code = "API_ERROR", requestId?: string, details?: Array<{ field: string; reason: string }>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

// ============================================================
// Modèle UI (utilisé par les pages et les adaptateurs du client API)
// ============================================================

export type CustomerType = "entreprise" | "particulier" | "etat";

export interface UiCenter {
  id: string;
  name: string;
}

export interface UiAgency {
  id: string;
  name: string;
  center: string;
}

export interface UiManager {
  id: string;
  name: string;
  role: string;
  agency: string;
  workload: number;
}

export interface UiCustomer {
  id: string;
  name: string;
  type: CustomerType;
  phone: string;
  email: string;
  address: string;
  city: string;
  agency: string;
  center: string;
  managerId: string;
  status: string;
  createdAt: string;
  lastPayment: string;
  overdue: number;
  balance: number;
}

export interface UiCustomerDetail extends UiCustomer {
  accounts: UiAccount[];
  invoices: UiInvoice[];
  payments: UiPayment[];
  receivables: UiReceivable[];
  actions: UiCollectionAction[];
  manager: UiManager | null;
  marche?: string;
  eBill?: string;
  identification?: string;
}

export interface UiAccount {
  id: string;
  customerId: string;
  number: string;
  agency: string;
  center: string;
  managerId: string;
  status: string;
  balance: number;
  eBill?: string;
}

export interface UiInvoice {
  id: string;
  number: string;
  customerId: string;
  accountNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  status: string;
}

export interface UiPayment {
  id: string;
  reference: string;
  customerId: string;
  accountNumber: string;
  date: string;
  amount: number;
  allocated: number;
  status: string;
}

export interface UiReceivable {
  id: string;
  customerId: string;
  accountNumber: string;
  invoiceNumber: string;
  initial: number;
  balance: number;
  ageDays: number;
  dueDate: string;
  status: string;
}

export interface UiCollectionAction {
  id: string;
  customerId: string;
  type: string;
  status: string;
  owner: string;
  date: string;
  dueDate: string | null;
  note: string;
  result: string | null;
}

export interface UiImportBatch {
  id: string;
  fileName: string;
  type: string;
  status: string;
  processed: number;
  rejected: number;
  date: string;
}

export interface UiImportReject {
  row: number;
  column: string;
  value: string;
  reason: string;
}

export interface UiImportResult {
  batch: UiImportBatch;
  rejects: UiImportReject[];
}

export interface UiDashboardData {
  kpis: {
    encoursTotal: number;
    echues: number;
    payees: number;
    tauxRecouvrement: number;
    actionsEnRetard: number;
    totalComptes: number;
    soldeNegatif: number;
  };
  aging: AgingDatum[];
  trend: Array<{ month: string; dette: number; encaissement: number }>;
  priorities: UiPriorityItem[];
  refreshedAt: string;
}

export interface UiPriorityItem {
  id: string;
  name: string;
  overdue: number;
  lastActionDate: string;
  status: string;
}

export interface AgingDatum {
  label: string;
  amount: number;
  percent: number;
  tone: "primary" | "secondary" | "warning" | "error";
}
