/**
 * Client HTTP centralisé GBLRecover (TRD §2.5)
 * -----------------------------------------------
 * - Ajoute l'en-tête Authorization: Bearer <JWT>
 * - Génère et propage un X-Request-ID (corrélation backend)
 * - Convertit les erreurs API en objets ApiError typés
 * - Applique un timeout explicite
 * - Une réponse 401 (JWT expiré) déclenche la déconnexion
 * - Normalise les réponses paginées
 *
 * Note stack : le TRD impose React 19 + TanStack Query (+ réact-hook-form + zod).
 * Axios n'étant pas dans la stack officielle, le transport est du fetch natif
 * encapsulé ici : pour changer de transport, on ne touche qu'à ce fichier.
 */
import { ApiError, type AgingDatum, type UiDashboardData, type UiCustomer, type UiCustomerDetail, type UiImportBatch, type UiImportResult, type UiInvoice, type UiManager, type UiPayment, type UiReceivable } from "@/api/types";
import { customers as mockCustomers, DEMO_FRESHNESS, importBatches, managers as mockManagers, trend } from "@/data/mock-data";

/** URL de base, préfixe versionné et modes depuis .env (Vite expose VITE_*). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api/v1";
export const DEMO_MODE = (import.meta.env.VITE_DEMO_MODE ?? "true") === "true";

/** Clé de stockage de la session (JWT). */
export const SESSION_STORAGE_KEY = "gbl-session";

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    status: string;
  };
}

/** Lit la session JWT stockée (localStorage). */
export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/** Stocke la session JWT. */
export function setStoredSession(session: StoredSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/** Supprime la session (déconnexion). */
export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** Génère un identifiant de corrélation (TRD §5.1 : X-Request-ID). */
export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Ajouter l'en-tête d'authentification si une session existe. */
  auth?: boolean;
  /** Timeout en millisecondes (défaut 15 s). */
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Requête HTTP typée vers l'API GBLRecover.
 * Lève une ApiError normalisée en cas d'échec (TRD §8).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    timeoutMs = 15_000,
    headers = {},
  } = options;

  const requestId = createRequestId();
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": requestId,
    ...headers,
  };

  // En-tête d'authentification JWT (TRD §6.1)
  if (auth) {
    const session = getStoredSession();
    if (session?.access_token) {
      finalHeaders.Authorization = `Bearer ${session.access_token}`;
    }
  }

  // Sérialisation JSON du corps (document JSON UTF-8, TRD §5.1)
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // Lecture du corps (JSON ou vide pour 204)
    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    // 401 => session invalide ou expirée : on déconnecte l'utilisateur
    if (response.status === 401) {
      clearStoredSession();
      window.dispatchEvent(new CustomEvent("gbl:session-expired"));
    }

    if (!response.ok) {
      throw normalizeApiError(response.status, payload, requestId);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "La réponse prend plus de temps que prévu. Réessayez.", "TIMEOUT", requestId);
    }
    // Erreur réseau : backend injoignable
    throw new ApiError(0, "Le service est temporairement indisponible. Vérifiez votre connexion.", "NETWORK_ERROR", requestId);
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Convertit une réponse d'erreur API en ApiError typée (TRD §5.3). */
function normalizeApiError(status: number, payload: unknown, requestId: string): ApiError {
  const body = payload as { error?: { code?: string; message?: string; details?: Array<{ field: string; reason: string }> }; detail?: string } | null;

  const message =
    body?.error?.message ??
    body?.detail ??
    "Une erreur est survenue. Réessayez plus tard.";

  const code = body?.error?.code ?? `HTTP_${status}`;
  const details = body?.error?.details;

  return new ApiError(status, message, code, requestId, details);
}

/** Exécute une requête en basculant sur le mode démo si l'API est indisponible ou renvoie 501. */
export async function withDemoFallback<T>(path: string, demoFn: () => T | Promise<T>, options: RequestOptions = {}): Promise<T> {
  // Mode démo forcé par configuration : on n'appelle même pas l'API
  if (DEMO_MODE) {
    return await demoFn();
  }
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    // 501 Not Implemented : le backend a un stub (voir crud.py _todo)
    // ou le réseau est coupé : on sert des données de démonstration.
    if (error instanceof ApiError && (error.status === 501 || error.status === 0)) {
      return await demoFn();
    }
    throw error;
  }
}

// ============================================================
// Authentification
// ============================================================

export function login(identifier: string, password: string): Promise<{ access_token: string; refresh_token: string; token_type: string; user: { id: string; email: string; full_name: string; status: string } }> {
  return withDemoFallback(
    "/auth/login",
    async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (identifier === "agent@camtel.cm" && password === "demo1234") {
        return {
          access_token: "demo-token-" + Date.now(),
          refresh_token: "demo-refresh-" + Date.now(),
          token_type: "bearer",
          user: { id: "00000000-0000-0000-0000-000000000001", email: "agent@camtel.cm", full_name: "Diane Mbarga", status: "ACTIVE" },
        };
      }
      throw new ApiError(401, "Identifiant ou mot de passe incorrect.", "INVALID_CREDENTIALS");
    },
    { method: "POST", body: { identifier, password }, auth: false },
  );
}

// ============================================================
// Dashboard
// ============================================================

export async function getDashboard(): Promise<UiDashboardData> {
  return withDemoFallback("/dashboard", async () => {
    await new Promise((r) => setTimeout(r, 300));
    const all = mockCustomers;
    const encoursTotal = all.reduce((s, c) => s + c.balance, 0);
    const echues = all.reduce((s, c) => s + c.overdue, 0);
    const totalPaid = all.reduce((s, c) => s + c.invoices.reduce((si, inv) => si + inv.paid, 0), 0);
    const totalInvoiced = all.reduce((s, c) => s + c.invoices.reduce((si, inv) => si + inv.total, 0), 0);
    const tauxRecouvrement = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
    const actionsEnRetard = all.reduce((s, c) => s + c.actions.filter((a) => a.status === "planifiee" && a.dueDate && new Date(a.dueDate) < new Date()).length, 0);

    const buckets = [
      { label: "0-30 J", min: 0, max: 30, tone: "primary" as const },
      { label: "31-60 J", min: 31, max: 60, tone: "secondary" as const },
      { label: "61-90 J", min: 61, max: 90, tone: "warning" as const },
      { label: "90+ J", min: 91, max: Infinity, tone: "error" as const },
    ];
    const aging: AgingDatum[] = buckets.map((b) => {
      const amount = all.reduce((s, c) => s + c.receivables.filter((r) => r.ageDays >= b.min && r.ageDays <= b.max).reduce((si, r) => si + r.balance, 0), 0);
      const percent = encoursTotal > 0 ? Math.round((amount / encoursTotal) * 100) : 0;
      return { label: b.label, amount, percent, tone: b.tone };
    });

    const priorities = all
      .filter((c) => c.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        overdue: c.overdue,
        lastActionDate: c.actions[0]?.date ?? c.createdAt,
        status: c.status,
      }));

    return {
      kpis: { encoursTotal, echues, tauxRecouvrement, actionsEnRetard },
      aging,
      trend: trend.map((t) => ({ month: t.month, dette: t.dette, encaissement: t.encaissement })),
      priorities,
      refreshedAt: new Date().toISOString(),
    };
  });
}

// ============================================================
// Clients
// ============================================================

export async function searchCustomers(filters: { query?: string; agency?: string; center?: string; status?: string }, page: number, pageSize: number): Promise<{ total: number; items: UiCustomer[] }> {
  return withDemoFallback("/clients", async () => {
    await new Promise((r) => setTimeout(r, 300));
    let items = [...mockCustomers];
    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    if (filters.agency) {
      items = items.filter((c) => c.agency === filters.agency);
    }
    if (filters.center) {
      items = items.filter((c) => c.center === filters.center);
    }
    if (filters.status) {
      items = items.filter((c) => c.status === filters.status);
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);
    return { total, items };
  });
}

export async function createCustomer(data: { name: string; type: string; agency: string; phone: string }): Promise<string> {
  return withDemoFallback("/clients", async () => {
    await new Promise((r) => setTimeout(r, 400));
    const id = "CL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    return id;
  }, { method: "POST", body: data });
}

export async function getCustomer(id: string): Promise<UiCustomerDetail> {
  return withDemoFallback(`/clients/${id}`, async () => {
    await new Promise((r) => setTimeout(r, 300));
    const found = mockCustomers.find((c) => c.id === id);
    if (!found) throw new ApiError(404, "Client introuvable.", "NOT_FOUND");
    return found;
  });
}

// ============================================================
// Factures
// ============================================================

export async function getInvoices(filters: {
  query?: string;
  status?: string;
  sortByDueDate?: boolean;
  page: number;
  pageSize: number;
}): Promise<{
  total: number;
  items: UiInvoice[];
  counts: { payee: number; partielle: number; impayee: number; annulee: number; nonPayees: number };
  summary: { montantAttendu: number; montantRecu: number; tauxRecouvrement: number };
  freshness: string;
}> {
  return withDemoFallback("/invoices", async () => {
    await new Promise((r) => setTimeout(r, 300));
    let all: UiInvoice[] = [];
    mockCustomers.forEach((c) => {
      c.invoices.forEach((inv) => {
        all.push({ ...inv, customerId: c.id });
      });
    });
    if (filters.query) {
      const q = filters.query.toLowerCase();
      all = all.filter((inv) => inv.number.toLowerCase().includes(q) || inv.customerId.toLowerCase().includes(q));
    }
    // Compteurs et synthèse « revenue assurance » sur l'ensemble filtré (tous statuts confondus).
    const counts = { payee: 0, partielle: 0, impayee: 0, annulee: 0, nonPayees: 0 };
    let montantAttendu = 0;
    let montantRecu = 0;
    for (const inv of all) {
      if (inv.status === "payee") counts.payee += 1;
      else if (inv.status === "partielle") counts.partielle += 1;
      else if (inv.status === "impayee") counts.impayee += 1;
      else counts.annulee += 1;
      montantAttendu += inv.total;
      montantRecu += inv.paid;
    }
    counts.nonPayees = counts.partielle + counts.impayee;
    const summary = {
      montantAttendu,
      montantRecu,
      tauxRecouvrement: montantAttendu > 0 ? Math.round((montantRecu / montantAttendu) * 100) : 0,
    };
    let items = filters.status ? all.filter((inv) => inv.status === filters.status) : all;
    if (filters.sortByDueDate) {
      items = [...items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    items = items.slice(start, start + filters.pageSize);
    return { total, items, counts, summary, freshness: DEMO_FRESHNESS };
  });
}

// ============================================================
// Paiements
// ============================================================

export async function getPayments(filters: { query?: string; page: number; pageSize: number }): Promise<{ total: number; items: UiPayment[] }> {
  return withDemoFallback("/payments", async () => {
    await new Promise((r) => setTimeout(r, 300));
    let items: UiPayment[] = [];
    mockCustomers.forEach((c) => {
      c.payments.forEach((pay) => {
        items.push({ ...pay, customerId: c.id });
      });
    });
    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter((pay) => pay.reference.toLowerCase().includes(q) || pay.customerId.toLowerCase().includes(q));
    }
    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    items = items.slice(start, start + filters.pageSize);
    return { total, items };
  });
}

// ============================================================
// Créances
// ============================================================

export async function getReceivables(filters: { query?: string; status?: string; page: number; pageSize: number }): Promise<{ total: number; items: UiReceivable[] }> {
  return withDemoFallback("/receivables", async () => {
    await new Promise((r) => setTimeout(r, 300));
    let items: UiReceivable[] = [];
    mockCustomers.forEach((c) => {
      c.receivables.forEach((rec) => {
        items.push({ ...rec, customerId: c.id });
      });
    });
    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter((rec) => rec.invoiceNumber.toLowerCase().includes(q) || rec.customerId.toLowerCase().includes(q));
    }
    if (filters.status) {
      items = items.filter((rec) => rec.status === filters.status);
    }
    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    items = items.slice(start, start + filters.pageSize);
    return { total, items };
  });
}

// ============================================================
// Imports Excel
// ============================================================

export async function getImportBatches(): Promise<UiImportBatch[]> {
  return withDemoFallback("/imports", async () => {
    await new Promise((r) => setTimeout(r, 300));
    return importBatches;
  });
}

export async function runImport(fileName: string, type: string): Promise<UiImportResult> {
  return withDemoFallback("/imports/run", async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const batch: UiImportBatch = {
      id: "IMP-" + Date.now().toString(36).toUpperCase(),
      fileName,
      type,
      status: "succes",
      processed: Math.floor(Math.random() * 5000) + 100,
      rejected: 0,
      date: new Date().toISOString(),
    };
    return { batch, rejects: [] };
  }, { method: "POST", body: { fileName, type } });
}

// ============================================================
// Administration
// ============================================================

export async function getManagers(): Promise<UiManager[]> {
  return withDemoFallback("/managers", async () => {
    await new Promise((r) => setTimeout(r, 300));
    return mockManagers;
  });
}

// ============================================================
// Actions de recouvrement
// ============================================================

export async function createAction(data: { customerId: string; type: string; note: string; status: string; dueInDays: number | null }): Promise<void> {
  return withDemoFallback(`/clients/${data.customerId}/actions`, async () => {
    await new Promise((r) => setTimeout(r, 400));
  }, { method: "POST", body: data });
}
