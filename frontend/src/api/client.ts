/**
 * Client HTTP centralisé GBLRecover (TRD §2.5)
 * -----------------------------------------------
 * - Ajoute l'en-tête Authorization: Bearer <JWT>
 * - Génère et propage un X-Request-ID (corrélation backend)
 * - Convertit les erreurs API en objets ApiError typés
 * - Applique un timeout explicite
 * - Une réponse 401 (JWT expiré) déclenche la déconnexion
 * - Supporte multipart/form-data (imports Excel) via apiUpload
 *
 * Note stack : le TRD impose React 19 + TanStack Query (+ réact-hook-form + zod).
 * Axios n'étant pas dans la stack officielle, le transport est du fetch natif
 * encapsulé ici : pour changer de transport, on ne touche qu'à ce fichier.
 */
import {
  ApiError,
  type Account,
  type Agency,
  type AuditEvent,
  type Centre,
  type Client,
  type ClientHistoryItem,
  type ClientSummary,
  type CollectionAction,
  type CollectionActionDashboard,
  type ImportBatch,
  type ImportError,
  type Invoice,
  type Manager,
  type Payment,
  type PaymentPromise,
  type ReportRow,
  type Service,
  type UiAccount,
  type UiCollectionAction,
  type UiCustomerDetail,
  type UiDashboardData,
  type UiInvoice,
  type UiManager,
  type UiPayment,
  type UiReceivable,
} from "@/api/types";

/** URL de base et préfixe versionné depuis .env (Vite expose VITE_*). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api/v1";

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
  /** Query string pré-construite (par ex. "page=1&page_size=25"). */
  query?: string;
}

/**
 * Construit l'URL finale en concaténant base + prefix + path (+ query).
 * Le path est nettoyé des "/" en tête pour éviter //.
 */
function buildUrl(path: string, query?: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return `${API_BASE_URL}${API_PREFIX}${cleanPath}${qs}`;
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
    query,
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
    const response = await fetch(buildUrl(path, query), {
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

/**
 * Variante pour les uploads multipart (imports Excel).
 * `file` est envoyé en binaire, les autres champs deviennent des champs form-data.
 * `extraHeaders` permet d'ajouter X-Idempotency-Key (requis par /imports).
 */
export async function apiUpload<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
  timeoutMs = 60_000,
): Promise<T> {
  const requestId = createRequestId();
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": requestId,
    ...extraHeaders,
  };
  const session = getStoredSession();
  if (session?.access_token) finalHeaders.Authorization = `Bearer ${session.access_token}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildUrl(path), {
      method: "POST",
      headers: finalHeaders,
      body: form,
      signal: controller.signal,
    });
    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (response.status === 401) {
      clearStoredSession();
      window.dispatchEvent(new CustomEvent("gbl:session-expired"));
    }
    if (!response.ok) throw normalizeApiError(response.status, payload, requestId);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "L'envoi du fichier prend trop de temps. Réessayez.", "TIMEOUT", requestId);
    }
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

/** Construit une query string à partir d'un objet (skip null/undefined/empty). */
function qs(params: Record<string, unknown> | undefined): string | undefined {
  if (!params) return undefined;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? s : undefined;
}

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

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser | null;
}

export function login(identifier: string, password: string): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: { email: identifier, password },
    auth: false,
  });
}

export function refreshSession(refreshToken: string): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/auth/refresh", { method: "POST", body: { refresh_token: refreshToken }, auth: false });
}

export function logout(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/auth/change-password", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
}

export function forgotPassword(email: string): Promise<{ reset_token: string }> {
  return apiRequest<{ reset_token: string }>("/auth/forgot-password", { method: "POST", body: { email }, auth: false });
}

export function resetPassword(token: string, newPassword: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/auth/reset-password", { method: "POST", body: { token, new_password: newPassword }, auth: false });
}

// ============================================================
// Utilisateur courant + administration utilisateurs
// ============================================================

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/users/me");
}

export function updateCurrentUser(payload: { full_name?: string; phone?: string | null }): Promise<AuthUser> {
  return apiRequest<AuthUser>("/users/me", { method: "PATCH", body: payload });
}

export function listUsers(opts: { status?: string; role_id?: string; page?: number; pageSize?: number } = {}): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>("/users", { query: qs({ status: opts.status, role_id: opts.role_id, page: opts.page, page_size: opts.pageSize }) });
}

export function getUser(userId: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/users/${userId}`);
}

export function createUser(payload: { email: string; full_name: string; password: string; phone?: string; role_ids?: string[] }): Promise<AuthUser> {
  return apiRequest<AuthUser>("/users", { method: "POST", body: payload });
}

export function updateUser(userId: string, payload: { full_name?: string; phone?: string; status?: string; role_ids?: string[] }): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/users/${userId}`, { method: "PATCH", body: payload });
}

export function deleteUser(userId: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}`, { method: "DELETE" });
}

export function getUserPermissions(userId: string): Promise<string[]> {
  return apiRequest<string[]>(`/users/${userId}/permissions`);
}

// ============================================================
// Organisation (centres / agences / gestionnaires)
// ============================================================

export function listCentres(opts: { page?: number; pageSize?: number } = {}): Promise<Centre[]> {
  return apiRequest<Centre[]>("/centres", { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getCentre(centreId: string): Promise<Centre> {
  return apiRequest<Centre>(`/centres/${centreId}`);
}

export function createCentre(payload: { nom_centre: string }): Promise<Centre> {
  return apiRequest<Centre>("/centres", { method: "POST", body: payload });
}

export function updateCentre(centreId: string, payload: { nom_centre?: string }): Promise<Centre> {
  return apiRequest<Centre>(`/centres/${centreId}`, { method: "PATCH", body: payload });
}

export function listAgencies(opts: { centre_id?: string; page?: number; pageSize?: number } = {}): Promise<Agency[]> {
  return apiRequest<Agency[]>("/agencies", { query: qs({ centre_id: opts.centre_id, page: opts.page, page_size: opts.pageSize }) });
}

export function getAgency(agencyId: string): Promise<Agency> {
  return apiRequest<Agency>(`/agencies/${agencyId}`);
}

export function createAgency(payload: { id_agence: string; nom_centre: string; nom_agence?: string }): Promise<Agency> {
  return apiRequest<Agency>("/agencies", { method: "POST", body: payload });
}

export function updateAgency(agencyId: string, payload: { nom_centre?: string; nom_agence?: string }): Promise<Agency> {
  return apiRequest<Agency>(`/agencies/${agencyId}`, { method: "PATCH", body: payload });
}

export function listManagers(opts: { agency_id?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Manager[]> {
  return apiRequest<Manager[]>("/managers", { query: qs({ agency_id: opts.agency_id, status: opts.status, page: opts.page, page_size: opts.pageSize }) });
}

export function getManager(managerId: string): Promise<Manager> {
  return apiRequest<Manager>(`/managers/${managerId}`);
}

export function createManager(payload: { mat_gestionnaire: string; nom_gestionnaire: string; tel_gestionnaire?: number; email_gestionnaire?: string }): Promise<Manager> {
  return apiRequest<Manager>("/managers", { method: "POST", body: payload });
}

export function updateManager(managerId: string, payload: { nom_gestionnaire?: string; tel_gestionnaire?: number; email_gestionnaire?: string }): Promise<Manager> {
  return apiRequest<Manager>(`/managers/${managerId}`, { method: "PATCH", body: payload });
}

export function getOrganizationHierarchy(): Promise<{ centres: Centre[] }> {
  return apiRequest<{ centres: Centre[] }>("/organizations/hierarchy");
}

// ============================================================
// Clients
// ============================================================

export function listClientsCount(opts: { q?: string; status?: string; marche?: string } = {}): Promise<{ total: number }> {
  return apiRequest<{ total: number }>("/clients/count", { query: qs({ q: opts.q, status: opts.status, marche: opts.marche }) });
}

export function listClients(opts: { q?: string; status?: string; client_type?: string; marche?: string; page?: number; pageSize?: number } = {}): Promise<Client[]> {
  return apiRequest<Client[]>("/clients", { query: qs({ q: opts.q, status: opts.status, client_type: opts.client_type, marche: opts.marche, page: opts.page, page_size: opts.pageSize }) });
}

export function getClient(clientId: number | string): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`);
}

export function createClient(payload: { code_client: number; raison_sociale: string; marche?: string; email?: string; tel?: number }): Promise<Client> {
  return apiRequest<Client>("/clients", { method: "POST", body: payload });
}

export function updateClient(clientId: number | string, payload: { raison_sociale?: string; marche?: string; email?: string; tel?: number }): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`, { method: "PATCH", body: payload });
}

export function deleteClient(clientId: number | string): Promise<void> {
  return apiRequest<void>(`/clients/${clientId}`, { method: "DELETE" });
}

export function mergeClients(sourceId: number, targetId: number): Promise<Client> {
  return apiRequest<Client>("/clients/merge", { method: "POST", body: { source_id: sourceId, target_id: targetId } });
}

export function getClientAccounts(clientId: number | string): Promise<Account[]> {
  return apiRequest<Account[]>(`/clients/${clientId}/accounts`);
}

export function getClientSummary(clientId: number | string): Promise<ClientSummary> {
  return apiRequest<ClientSummary>(`/clients/${clientId}/summary`);
}

export function getClientHistory(clientId: number | string): Promise<ClientHistoryItem[]> {
  return apiRequest<ClientHistoryItem[]>(`/clients/${clientId}/history`);
}

// Client sub-resources

export function getClientInvoices(clientId: number | string, opts: { page?: number; pageSize?: number } = {}): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(`/clients/${clientId}/invoices`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getClientInvoicesCount(clientId: number | string): Promise<{ total: number }> {
  return apiRequest<{ total: number }>(`/clients/${clientId}/invoices/count`);
}

export function getClientPayments(clientId: number | string, opts: { page?: number; pageSize?: number } = {}): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/clients/${clientId}/payments`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getClientPaymentsCount(clientId: number | string): Promise<{ total: number }> {
  return apiRequest<{ total: number }>(`/clients/${clientId}/payments/count`);
}

// ============================================================
// Comptes (finance §3.5)
// ============================================================

export function listAccounts(opts: { client_id?: number; agency_id?: string; manager_id?: string; status?: string; account_number?: string; page?: number; pageSize?: number } = {}): Promise<Account[]> {
  return apiRequest<Account[]>("/accounts", { query: qs({ client_id: opts.client_id, agency_id: opts.agency_id, manager_id: opts.manager_id, status: opts.status, account_number: opts.account_number, page: opts.page, page_size: opts.pageSize }) });
}

export function getAccount(accountId: number | string): Promise<Account> {
  return apiRequest<Account>(`/accounts/${accountId}`);
}

export function updateAccount(accountId: number | string, payload: { date_souscription?: string; statut_souscription?: string }): Promise<Account> {
  return apiRequest<Account>(`/accounts/${accountId}`, { method: "PATCH", body: payload });
}

export function getAccountInvoices(accountId: number | string, opts: { status?: string; due_date?: string; page?: number; pageSize?: number } = {}): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(`/accounts/${accountId}/invoices`, { query: qs({ status: opts.status, due_date: opts.due_date, page: opts.page, page_size: opts.pageSize }) });
}

export function getAccountPayments(accountId: number | string, opts: { page?: number; pageSize?: number } = {}): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/accounts/${accountId}/payments`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getAccountReceivableSummary(accountId: number | string): Promise<{ total_outstanding: number; overdue_amount: number; open_invoices: number }> {
  return apiRequest(`/accounts/${accountId}/receivable-summary`);
}

// Receivables

export function listReceivables(opts: { q?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/receivables", { query: qs({ q: opts.q, status: opts.status, page: opts.page, page_size: opts.pageSize }) });
}

export function listReceivablesCount(opts: { q?: string; status?: string } = {}): Promise<{ total: number }> {
  return apiRequest<{ total: number }>("/receivables/count", { query: qs({ q: opts.q, status: opts.status }) });
}

export function listInvoicesCountFiltered(opts: { status?: string } = {}): Promise<{ total: number }> {
  return apiRequest<{ total: number }>("/invoices/count", { query: qs({ status: opts.status }) });
}

export function listPaymentsCountFiltered(opts: { status?: string } = {}): Promise<{ total: number }> {
  return apiRequest<{ total: number }>("/payments/count", { query: qs({ status: opts.status }) });
}

// ============================================================
// Factures (finance §3.6)
// ============================================================

export function listInvoices(opts: { account_id?: number; status?: string; due_date__gte?: string; due_date__lte?: string; outstanding_amount__gt?: number; page?: number; pageSize?: number } = {}): Promise<Invoice[]> {
  return apiRequest<Invoice[]>("/invoices", { query: qs({ account_id: opts.account_id, status: opts.status, due_date__gte: opts.due_date__gte, due_date__lte: opts.due_date__lte, outstanding_amount__gt: opts.outstanding_amount__gt, page: opts.page, page_size: opts.pageSize }) });
}

export function getInvoice(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${invoiceId}`);
}

export function createInvoice(payload: { id_facture: string; num_compte: number; date_emission: string; montant_facture: number; type_flux?: string; libelle_periode?: string }): Promise<Invoice> {
  return apiRequest<Invoice>("/invoices", { method: "POST", body: payload });
}

export function updateInvoice(invoiceId: string, payload: { date_emission?: string; montant_facture?: number; type_flux?: string; libelle_periode?: string; status?: string }): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${invoiceId}`, { method: "PATCH", body: payload });
}

export function cancelInvoice(invoiceId: string): Promise<void> {
  return apiRequest<void>(`/invoices/${invoiceId}`, { method: "DELETE" });
}

export function getInvoicePayments(invoiceId: string, opts: { page?: number; pageSize?: number } = {}): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/invoices/${invoiceId}/payments`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

// ============================================================
// Paiements & Allocations (finance §3.7)
// ============================================================

export function listPayments(opts: { account_id?: number; status?: string; payment_date?: string; page?: number; pageSize?: number } = {}): Promise<Payment[]> {
  return apiRequest<Payment[]>("/payments", { query: qs({ account_id: opts.account_id, status: opts.status, payment_date: opts.payment_date, page: opts.page, page_size: opts.pageSize }) });
}

export function getPayment(paymentId: string): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${paymentId}`);
}

export function listUnallocatedPayments(opts: { page?: number; pageSize?: number } = {}): Promise<Payment[]> {
  return apiRequest<Payment[]>("/payments/unallocated", { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function createPayment(payload: { id_paiement: string; id_facture: string; date_paiement: string; montant_paye: number }): Promise<Payment> {
  return apiRequest<Payment>("/payments", { method: "POST", body: payload });
}

export function updatePayment(paymentId: string, payload: { date_paiement?: string; montant_paye?: number; status?: string }): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${paymentId}`, { method: "PATCH", body: payload });
}

export function cancelPayment(paymentId: string): Promise<void> {
  return apiRequest<void>(`/payments/${paymentId}`, { method: "DELETE" });
}

export function allocatePaymentToInvoice(invoiceId: string, paymentId: string, amount: number): Promise<unknown> {
  return apiRequest(`/invoices/${invoiceId}/payments`, { method: "POST", body: { invoice_id: paymentId, amount } });
}

export function createPaymentAllocations(paymentId: string, allocations: Array<{ invoice_id: string; amount: number }>): Promise<unknown[]> {
  return apiRequest<unknown[]>(`/payments/${paymentId}/allocations`, { method: "POST", body: allocations });
}

export function deleteAllocation(allocationId: string): Promise<void> {
  return apiRequest<void>(`/allocations/${allocationId}`, { method: "DELETE" });
}

// ============================================================
// Recouvrement — actions (§3.8) et promesses
// ============================================================

export function listCollectionActions(opts: { assigned_to?: string; status?: string; due_date__lte?: string; page?: number; pageSize?: number } = {}): Promise<CollectionAction[]> {
  return apiRequest<CollectionAction[]>("/collection-actions", { query: qs({ assigned_to: opts.assigned_to, status: opts.status, due_date__lte: opts.due_date__lte, page: opts.page, page_size: opts.pageSize }) });
}

export function getCollectionAction(actionId: string): Promise<CollectionAction> {
  return apiRequest<CollectionAction>(`/collection-actions/${actionId}`);
}

export function createCollectionAction(payload: { account_id: number; action_type: string; due_date: string; comment?: string; priority?: string; assigned_to?: string }): Promise<CollectionAction> {
  return apiRequest<CollectionAction>("/collection-actions", { method: "POST", body: payload });
}

export function updateCollectionAction(actionId: string, payload: { status?: string; comment?: string; result?: string; assigned_to?: string; priority?: string; due_date?: string }): Promise<CollectionAction> {
  return apiRequest<CollectionAction>(`/collection-actions/${actionId}`, { method: "PATCH", body: payload });
}

export function getCollectionActionDashboard(): Promise<CollectionActionDashboard> {
  return apiRequest<CollectionActionDashboard>("/collection-actions/dashboard");
}

export function listAccountCollectionActions(accountId: number | string, opts: { page?: number; pageSize?: number } = {}): Promise<CollectionAction[]> {
  return apiRequest<CollectionAction[]>(`/accounts/${accountId}/collection-actions`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function createAccountCollectionAction(accountId: number | string, payload: { action_type: string; due_date: string; comment?: string; priority?: string; assigned_to?: string }): Promise<CollectionAction> {
  return apiRequest<CollectionAction>(`/accounts/${accountId}/collection-actions`, { method: "POST", body: payload });
}

export function listPromises(opts: { status?: string; account_id?: number; page?: number; pageSize?: number } = {}): Promise<PaymentPromise[]> {
  return apiRequest<PaymentPromise[]>("/promises", { query: qs({ status: opts.status, account_id: opts.account_id, page: opts.page, page_size: opts.pageSize }) });
}

export function keepPromise(promiseId: string): Promise<PaymentPromise> {
  return apiRequest<PaymentPromise>(`/promises/${promiseId}/keep`, { method: "POST" });
}

export function breakPromise(promiseId: string): Promise<PaymentPromise> {
  return apiRequest<PaymentPromise>(`/promises/${promiseId}/break`, { method: "POST" });
}

// ============================================================
// Imports Excel (§3.9)
// ============================================================

export function listImportBatches(opts: { page?: number; pageSize?: number } = {}): Promise<ImportBatch[]> {
  return apiRequest<ImportBatch[]>("/imports", { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getImportBatch(batchId: string): Promise<ImportBatch> {
  return apiRequest<ImportBatch>(`/imports/${batchId}`);
}

export function listImportErrors(batchId: string, opts: { page?: number; pageSize?: number } = {}): Promise<ImportError[]> {
  return apiRequest<ImportError[]>(`/imports/${batchId}/errors`, { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function cancelImportBatch(batchId: string): Promise<void> {
  return apiRequest<void>(`/imports/${batchId}`, { method: "DELETE" });
}

export function startImport(file: File, entityType: string, idempotencyKey: string): Promise<{ batch_id: string; status: string }> {
  return apiUpload("/imports", file, { entity_type: entityType }, { "X-Idempotency-Key": idempotencyKey });
}

export function downloadImportTemplateUrl(): string {
  return buildUrl("/imports/templates");
}

// ============================================================
// Reports / Dashboards (§3.10)
// ============================================================

export function getDashboardActivity(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/dashboards/activity");
}

export function getCentresAgencesReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/centres-agences");
}

export function getGestionnairesReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/gestionnaires");
}

export function getGestionnaireReport(managerId: string): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>(`/reports/gestionnaires/${managerId}`);
}

export function getMarchesReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/marches");
}

export function getEvolutionMensuelleReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/evolution-mensuelle");
}

export function getTopDetteReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/top-dette");
}

export function getFragiliteReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/fragilite");
}

export function getSpiraleNegativeReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/spirale-negative");
}

export function getZombiesReport(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/reports/zombies");
}

export function exportReportCsvUrl(report: string): string {
  return buildUrl("/reports/export/csv", qs({ report }));
}

// Dashboard analytics

export interface DashboardFilters {
  centres?: string;
  agences?: string;
  mois?: string;
}

export function getDashboardSummary(filters?: { centres?: string; agences?: string; mois?: string }): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/dashboards/summary", { query: qs({ centres: filters?.centres, agences: filters?.agences, mois: filters?.mois }) });
}

export function getDashboardTrend(filters?: { centres?: string; agences?: string }): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/dashboards/trend", { query: qs({ centres: filters?.centres, agences: filters?.agences }) });
}

export function getTopIndebtedClients(filters?: { centres?: string; agences?: string; mois?: string }): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/dashboards/top-indebted", { query: qs({ centres: filters?.centres, agences: filters?.agences, mois: filters?.mois }) });
}

export function getCamtelDebts(filters?: { centres?: string; agences?: string }): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/dashboards/camtel-debts", { query: qs({ centres: filters?.centres, agences: filters?.agences }) });
}

// ============================================================
// Administration & Qualité (§3.11)
// ============================================================

export function getAdminQualiteIdentification(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/qualite-identification");
}

export function getAdminCompletudeContacts(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/completude-contacts");
}

export function getAdminDoublonsPotentiels(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/doublons-potentiels");
}

export function getAdminComptesOrphelins(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/comptes-orphelins");
}

export function getAdminIncoherencesFacturation(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/incoherences-facturation");
}

export function getAdminEbillAdoption(): Promise<ReportRow[]> {
  return apiRequest<ReportRow[]>("/admin/ebill-adoption");
}

export function listAuditEvents(opts: { user_id?: string; action?: string; entity_type?: string; created_at__gte?: string; page?: number; pageSize?: number } = {}): Promise<AuditEvent[]> {
  return apiRequest<AuditEvent[]>("/admin/audit", { query: qs({ user_id: opts.user_id, action: opts.action, entity_type: opts.entity_type, created_at__gte: opts.created_at__gte, page: opts.page, page_size: opts.pageSize }) });
}

export function runAdminDataCleanup(target: string, dryRun = true): Promise<unknown> {
  return apiRequest("/admin/data-cleanup", { method: "POST", body: { target, dry_run: dryRun } });
}

// ============================================================
// Services (§3.12)
// ============================================================

export function listServices(opts: { page?: number; pageSize?: number } = {}): Promise<Service[]> {
  return apiRequest<Service[]>("/services", { query: qs({ page: opts.page, page_size: opts.pageSize }) });
}

export function getService(typeService: string): Promise<Service> {
  return apiRequest<Service>(`/services/${typeService}`);
}

// ============================================================
// Adaptateurs UI → backend (vues synthétiques pour les pages)
// ============================================================

/** Forme UI minimale consommée par la page liste de clients. */
export interface UiCustomerSummary {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  agency: string;
  center: string;
  managerId: string;
  managerName: string;
  status: string;
  balance: number;
  overdue: number;
}

/**
 * Récupère une page de clients avec leurs agrégats financiers. Le backend ne
 * renvoie pas directement toutes les colonnes UI : on compose /clients puis
 * /summary par client pour dériver balance / overdue.
 */
export async function searchCustomers(
  filters: { query?: string; agency?: string; center?: string; status?: string },
  page: number,
  pageSize: number,
): Promise<{ total: number; items: UiCustomerSummary[] }> {
  const [pageRows, probe] = await Promise.all([
    listClients({ q: filters.query, status: filters.status, marche: undefined, page, pageSize }),
    listClients({ q: filters.query, status: filters.status, page: 1, pageSize: 200 }),
  ]);

  const items = await Promise.all(
    pageRows.map(async (c) => {
      const accounts = await getClientAccounts(c.code_client).catch(() => []);
      const first = accounts[0];
      const summary = await getClientSummary(c.code_client).catch(() => null);
      const out: UiCustomerSummary = {
        id: String(c.code_client),
        name: c.raison_sociale,
        type: c.marche === "ETAT" ? "etat" : c.marche === "PARTICULIER" ? "particulier" : "entreprise",
        phone: c.tel ? String(c.tel) : "",
        email: c.email ?? "",
        agency: first?.id_agence ?? "",
        center: "",
        managerId: first?.mat_gestionnaire ?? "",
        managerName: "",
        status: first?.statut_facturation ?? "actif",
        balance: num(summary?.total_balance ?? first?.balance),
        overdue: num(summary?.total_outstanding),
      };
      if (out.managerId) {
        try {
          const m = await getManager(out.managerId);
          out.managerName = m.nom_gestionnaire;
        } catch {
          out.managerName = "";
        }
      }
      // Filtres supplémentaires (agency/center) qui ne sont pas portés par /clients
      if (filters.agency && out.agency !== filters.agency) return null;
      if (filters.center && out.center !== filters.center) return null;
      return out;
    }),
  );

  return { total: probe.length, items: items.filter((x): x is UiCustomerSummary => x !== null) };
}

/** Crée un client à partir du payload UI et retourne son identifiant. */
export async function createCustomer(data: { name: string; type: string; agency: string; phone: string }): Promise<string> {
  const code = Date.now() % 1_000_000_000;
  const created = await createClient({
    code_client: code,
    raison_sociale: data.name,
    marche: data.type === "etat" ? "ETAT" : data.type === "particulier" ? "PARTICULIER" : "ENTREPRISE",
    tel: data.phone ? Number(data.phone.replace(/\D/g, "")) || undefined : undefined,
  });
  return String(created.code_client);
}

/**
 * Récupère le détail complet d'un client (comptes + factures + paiements + actions)
 * en composant les sous-ressources par compte, et le projette en UiCustomerDetail
 * consommé par la page Customer Detail.
 */
export async function getCustomer(id: string): Promise<UiCustomerDetail> {
  const client = await getClient(id);
  const summary = await getClientSummary(id).catch(() => null);
  const accounts = await getClientAccounts(id).catch(() => []);

  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const [invs, pays, actions] = await Promise.all([
        getAccountInvoices(a.num_compte, { pageSize: 200 }).catch(() => []),
        getAccountPayments(a.num_compte, { pageSize: 200 }).catch(() => []),
        listAccountCollectionActions(a.num_compte, { pageSize: 50 }).catch(() => []),
      ]);
      return { account: a, invoices: invs, payments: pays, actions };
    }),
  );

  const first = accounts[0];

  const allInvoices: UiInvoice[] = perAccount.flatMap(({ invoices }) =>
    invoices.map((inv) => ({
      id: inv.id_facture,
      number: inv.id_facture,
      customerId: id,
      accountNumber: String(inv.num_compte),
      issueDate: inv.date_emission ?? "",
      dueDate: inv.date_emission ?? "",
      total: num(inv.montant_facture),
      paid: num(inv.paid_amount),
      status: inv.status ?? "—",
    })),
  );

  const allPayments: UiPayment[] = perAccount.flatMap(({ payments }) =>
    payments.map((p) => ({
      id: p.id_paiement,
      reference: p.id_paiement,
      customerId: id,
      accountNumber: String(p.id_facture),
      date: p.date_paiement ?? "",
      amount: num(p.montant_paye),
      allocated: num(p.montant_paye),
      status: "valide",
    })),
  );

  let manager: UiManager | null = null;
  if (first?.mat_gestionnaire) {
    try {
      const m = await getManager(first.mat_gestionnaire);
      manager = { id: m.mat_gestionnaire, name: m.nom_gestionnaire, role: "Recouvrement", agency: first.id_agence, workload: 0 };
    } catch {
      manager = null;
    }
  }

  const allReceivables: UiReceivable[] = allInvoices
    .filter((inv) => inv.total - inv.paid > 0)
    .map((inv) => {
      const issue = inv.issueDate ? new Date(inv.issueDate) : new Date();
      const ageDays = Math.max(0, Math.floor((Date.now() - issue.getTime()) / 86_400_000));
      return {
        id: inv.id,
        customerId: id,
        accountNumber: inv.accountNumber,
        invoiceNumber: inv.number,
        initial: inv.total,
        balance: inv.total - inv.paid,
        ageDays,
        dueDate: inv.dueDate,
        status: ageDays > 90 ? "urgente" : ageDays > 30 ? "en_retard" : "normale",
      };
    });

  const allActions: UiCollectionAction[] = perAccount.flatMap(({ actions }) =>
    actions.map((a) => ({
      id: a.id,
      customerId: id,
      type: a.action_type,
      status: a.status.toLowerCase(),
      owner: a.assigned_to ?? "—",
      date: a.created_at,
      dueDate: a.due_date,
      note: a.comment ?? "",
      result: a.result,
    })),
  );

  const uiAccounts: UiAccount[] = accounts.map((a) => ({
    id: String(a.num_compte),
    customerId: id,
    number: String(a.num_compte),
    agency: a.id_agence,
    center: "",
    managerId: a.mat_gestionnaire ?? "",
    status: a.statut_facturation ?? "actif",
    balance: a.balance,
  }));

  return {
    id,
    name: client.raison_sociale,
    type: client.marche === "ETAT" ? "etat" : client.marche === "PARTICULIER" ? "particulier" : "entreprise",
    phone: client.tel ? String(client.tel) : "",
    email: client.email ?? "",
    address: "",
    city: "",
    agency: first?.id_agence ?? "",
    center: "",
    managerId: first?.mat_gestionnaire ?? "",
    status: first?.statut_facturation ?? "actif",
    createdAt: "",
    lastPayment: "",
    overdue: num(summary?.total_outstanding),
    balance: num(summary?.total_balance),
    accounts: uiAccounts,
    invoices: allInvoices,
    payments: allPayments,
    receivables: allReceivables,
    actions: allActions,
    manager,
  };
}

/** Crée une action de recouvrement sur le 1er compte trouvé pour le client. */
export async function createAction(data: { customerId: string; type: string; note: string; status: string; dueInDays: number | null }): Promise<void> {
  const accounts = await getClientAccounts(data.customerId);
  const first = accounts[0];
  if (!first) {
    throw new ApiError(400, "Aucun compte rattaché à ce client : impossible de planifier une action.", "NO_ACCOUNT");
  }
  const due_date = data.dueInDays != null
    ? new Date(Date.now() + data.dueInDays * 86_400_000).toISOString().slice(0, 10)
    : new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await createAccountCollectionAction(first.num_compte, {
    action_type: data.type,
    due_date,
    comment: data.note,
  });
}

// ============================================================
// Dashboard (vue agrégée consommée par la page Dashboard)
// ============================================================

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

export async function getDashboard(filters?: DashboardFilters): Promise<UiDashboardData> {
  const f = filters;
  const [summaryRows, trendRows] = await Promise.all([
    getDashboardSummary(f).catch(() => [] as ReportRow[]),
    getDashboardTrend(f).catch(() => [] as ReportRow[]),
  ]);
  const firstSummary = summaryRows[0] ?? {};
  const encoursTotal = num(firstSummary.balance_globale);
  const echues = num(firstSummary.total_impaye_mois);
  const totalComptes = num(firstSummary.total_comptes);
  const tauxRecouvrement = num(firstSummary.taux_recouvrement);
  const soldeNegatif = summaryRows.reduce((acc, r) => acc + (num(r.balance_globale) < 0 ? num(r.balance_globale) : 0), 0);
  const trend = trendRows.map((r) => ({
    month: str(r.mois_emission),
    dette: num(r.total_impaye),
    encaissement: num(r.total_recouvre),
  }));
  return {
    kpis: { encoursTotal, echues, tauxRecouvrement, actionsEnRetard: 0, totalComptes, soldeNegatif },
    aging: [], trend, priorities: [], refreshedAt: new Date().toISOString(),
  };
}
