/**
 * Types de domaine GBLRecover — calqués sur le contrat API /api/v1 (TRD §5).
 * Le client mock (client.ts) renvoie ces types ; l'équipe backend branchera
 * le même contrat sur les endpoints réels sans toucher aux composants.
 */

export type CustomerType = "entreprise" | "particulier" | "etat";
export type CustomerStatus = "actif" | "impaye" | "contentieux" | "irrecouvrable";

export interface Customer {
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
  status: CustomerStatus;
  /** Solde total en XAF */
  balance: number;
  /** Créances échues en XAF */
  overdue: number;
  lastPayment: string;
  createdAt: string;
}

export type AccountStatus = "actif" | "suspendu" | "cloture";

export interface Account {
  id: string;
  customerId: string;
  number: string;
  agency: string;
  center: string;
  managerId: string;
  status: AccountStatus;
  balance: number;
}

export type InvoiceStatus = "payee" | "partielle" | "impayee" | "annulee";

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  accountNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  status: InvoiceStatus;
}

export type PaymentStatus = "recu" | "partiel" | "impute" | "anomalie";

export interface Payment {
  id: string;
  reference: string;
  customerId: string;
  accountNumber: string;
  date: string;
  amount: number;
  allocated: number;
  status: PaymentStatus;
}

export type ReceivableStatus = "en-cours" | "echue" | "urgente" | "reglee";

export interface Receivable {
  id: string;
  customerId: string;
  accountNumber: string;
  invoiceNumber: string;
  initial: number;
  balance: number;
  ageDays: number;
  dueDate: string;
  status: ReceivableStatus;
}

export type ActionStatus = "planifiee" | "en-cours" | "cloturee";

export interface CollectionAction {
  id: string;
  customerId: string;
  type: string;
  status: ActionStatus;
  owner: string;
  date: string;
  dueDate: string | null;
  note: string;
  result: string | null;
}

export interface Manager {
  id: string;
  name: string;
  role: string;
  agency: string;
  workload: number;
}

export interface Agency {
  id: string;
  name: string;
  center: string;
}

export interface Center {
  id: string;
  name: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  type: string;
  status: "succes" | "partiel" | "echec";
  processed: number;
  rejected: number;
  date: string;
}

export interface ImportReject {
  row: number;
  column: string;
  value: string;
  reason: string;
}

export interface ImportResult {
  batch: ImportBatch;
  rejects: ImportReject[];
}

export interface Session {
  token: string;
  user: { name: string; role: string; initials: string };
}

export interface DashboardKpis {
  encoursTotal: number;
  echues: number;
  tauxRecouvrement: number;
  actionsEnRetard: number;
}

export interface AgingBucket {
  label: string;
  amount: number;
  percent: number;
  tone: "primary" | "secondary" | "warning" | "error";
}

export interface TrendPoint {
  month: string;
  dette: number;
  encaissement: number;
}

export interface DashboardPriority {
  id: string;
  name: string;
  overdue: number;
  lastActionDate: string;
  status: CustomerStatus;
}

export interface CustomerDetail extends Customer {
  accounts: Account[];
  invoices: Invoice[];
  payments: Payment[];
  receivables: Receivable[];
  actions: CollectionAction[];
  manager: Manager | null;
}

export interface CustomerFilters {
  query: string;
  agency: string;
  center: string;
  status: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
