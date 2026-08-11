/**
 * Client API GBLRecover — IMPLÉMENTATION MOCK.
 *
 * Chaque fonction reproduit le contrat REST /api/v1 (TRD §5) avec une latence
 * simulée et des données synthétiques. Pour brancher le vrai backend, remplacer
 * le corps de ces fonctions par des appels fetch vers l'API FastAPI : les types
 * et les signatures ne changent pas, les composants restent intacts.
 */
import {
  agencies,
  customers,
  demoCredentials,
  importBatches,
  importRejects,
  managers,
  trend,
} from "@/data/mock-data";
import type {
  ActionStatus,
  CollectionAction,
  Customer,
  CustomerDetail,
  CustomerFilters,
  CustomerType,
  DashboardKpis,
  DashboardPriority,
  ImportBatch,
  ImportResult,
  Invoice,
  Manager,
  Paginated,
  Payment,
  Receivable,
  Session,
} from "@/api/types";

/** Store mutable en mémoire (session démo) : clients créés et actions ajoutées. */
const store: CustomerDetail[] = [...customers];

const latency = (ms = 550) => new Promise<void>((r) => setTimeout(r, ms));

/** Données mutables en mémoire (session démo) : actions créées par l'utilisateur. */
const liveActions: CollectionAction[] = [];

export async function login(identifier: string, password: string): Promise<Session> {
  await latency(700);
  if (identifier.trim().toLowerCase() !== demoCredentials.identifier || password !== demoCredentials.password) {
    throw new Error("Identifiant ou mot de passe incorrect.");
  }
  return {
    token: "demo.jwt.token",
    user: { name: "Diane Mbarga", role: "Agent de recouvrement", initials: "DM" },
  };
}

export async function getDashboard(): Promise<{
  kpis: DashboardKpis;
  aging: Array<{ label: string; amount: number; percent: number; tone: "primary" | "secondary" | "warning" | "error" }>;
  trend: typeof trend;
  priorities: DashboardPriority[];
  refreshedAt: string;
}> {
  await latency();
  const encoursTotal = customers.reduce((s, c) => s + c.balance, 0);
  const echues = customers.reduce((s, c) => s + c.overdue, 0);

  const buckets = [
    { label: "0-30 J", min: 0, max: 30, tone: "primary" as const },
    { label: "31-60 J", min: 31, max: 60, tone: "secondary" as const },
    { label: "61-90 J", min: 61, max: 90, tone: "warning" as const },
    { label: "90+ J", min: 91, max: Infinity, tone: "error" as const },
  ];
  const aging = buckets.map((b) => {
    const amount = customers.reduce(
      (s, c) => s + c.receivables.filter((r) => r.ageDays >= b.min && r.ageDays <= b.max).reduce((x, r) => x + r.balance, 0),
      0,
    );
    return { label: b.label, amount, percent: echues > 0 ? Math.round((amount / echues) * 100) : 0, tone: b.tone };
  });

  const priorities: DashboardPriority[] = customers
    .filter((c) => c.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      overdue: c.overdue,
      lastActionDate: c.actions[0]?.date ?? c.lastPayment,
      status: c.status,
    }));

  return {
    kpis: {
      encoursTotal,
      echues,
      tauxRecouvrement: 78.5,
      actionsEnRetard: customers.reduce((s, c) => s + c.actions.filter((a) => a.status !== "cloturee").length, 0) + 14,
    },
    aging,
    trend,
    priorities,
    refreshedAt: new Date().toISOString(),
  };
}

export async function searchCustomers(filters: CustomerFilters, page = 1, pageSize = 10): Promise<Paginated<Customer>> {
  await latency();
  const q = filters.query.trim().toLowerCase();
  let items: Customer[] = store;
  if (q) {
    items = items.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        c.city.toLowerCase().includes(q),
    );
  }
  if (filters.agency) items = items.filter((c) => c.agency === filters.agency);
  if (filters.center) items = items.filter((c) => c.center === filters.center);
  if (filters.status) items = items.filter((c) => c.status === filters.status);

  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  await latency();
  const found = store.find((c) => c.id === id);
  if (!found) throw new Error("Client introuvable.");
  return found;
}

/** Création d'un dossier client (démo, en mémoire). En production : POST /api/v1/customers. */
export async function createCustomer(input: { name: string; type: CustomerType; agency: string; phone: string }): Promise<string> {
  await latency();
  const agency = agencies.find((a) => a.name === input.agency) ?? agencies[0]!;
  const id = `CAM-${String(10000 + store.length + 1)}-X`;
  const customer: CustomerDetail = {
    id,
    name: input.name,
    type: input.type,
    phone: input.phone || "—",
    email: "",
    address: "",
    city: agency.name,
    agency: agency.name,
    center: agency.center,
    managerId: "mgr-1",
    status: "actif",
    balance: 0,
    overdue: 0,
    lastPayment: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    accounts: [],
    invoices: [],
    payments: [],
    receivables: [],
    actions: [],
    manager: managers[0] ?? null,
  };
  store.unshift(customer);
  return id;
}

export async function getInvoices(filters: { query?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Invoice>> {
  await latency();
  const q = filters.query?.trim().toLowerCase() ?? "";
  let items = store.flatMap((c) => c.invoices);
  if (q) items = items.filter((f) => f.number.toLowerCase().includes(q) || f.customerId.toLowerCase().includes(q));
  if (filters.status) items = items.filter((f) => f.status === filters.status);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

export async function getPayments(filters: { query?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Payment>> {
  await latency();
  const q = filters.query?.trim().toLowerCase() ?? "";
  let items = store.flatMap((c) => c.payments);
  if (q) items = items.filter((p) => p.reference.toLowerCase().includes(q) || p.customerId.toLowerCase().includes(q));
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

export async function getReceivables(filters: { query?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Receivable>> {
  await latency();
  const q = filters.query?.trim().toLowerCase() ?? "";
  let items = store.flatMap((c) => c.receivables);
  if (q) items = items.filter((r) => r.invoiceNumber.toLowerCase().includes(q) || r.customerId.toLowerCase().includes(q));
  if (filters.status) items = items.filter((r) => r.status === filters.status);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

export async function getManagers(): Promise<Manager[]> {
  await latency(350);
  return managers;
}

export async function getImportBatches(): Promise<ImportBatch[]> {
  await latency();
  return importBatches;
}

/**
 * Simule l'import d'un fichier Excel : le type détermine les contrôles de
 * validation. En production, POST /api/v1/imports puis GET /imports/{id}.
 */
export async function runImport(fileName: string, type: string): Promise<ImportResult> {
  await latency(1400);
  const badName = /rejet/i.test(fileName);
  const batch: ImportBatch = {
    id: `IMP-2026-${String(importBatches.length + 1).padStart(4, "0")}`,
    fileName,
    type,
    status: badName ? "echec" : "partiel",
    processed: badName ? 0 : 8_204,
    rejected: badName ? 450 : 12,
    date: new Date().toISOString(),
  };
  return { batch, rejects: badName ? importRejects : importRejects.slice(0, 3) };
}

export async function createAction(input: {
  customerId: string;
  type: string;
  note: string;
  dueInDays: number | null;
  status: ActionStatus;
}): Promise<CollectionAction> {
  await latency(600);
  const customer = customers.find((c) => c.id === input.customerId);
  const action: CollectionAction = {
    id: `ACT-${Date.now()}`,
    customerId: input.customerId,
    type: input.type,
    status: input.status,
    owner: "Diane Mbarga",
    date: new Date().toISOString(),
    dueDate: input.dueInDays === null ? null : new Date(Date.now() + input.dueInDays * 86_400_000).toISOString(),
    note: input.note,
    result: null,
  };
  liveActions.unshift(action);
  if (customer) customer.actions.unshift(action);
  return action;
}
