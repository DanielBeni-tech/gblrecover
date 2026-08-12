/**
 * Données de démonstration GBLRecover.
 * -----------------------------------
 * Ces données reproduisent les colonnes du schéma réel (database/schema.sql)
 * et des vues de reporting (database/views.sql). Elles ne sont servies que :
 *  - si VITE_DEMO_MODE=true, ou
 *  - si le backend est injoignable / renvoie 501 (stubs crud._todo)
 * Elles sont 100 % fictives et anonymisées (GBLContext §23, pas de données réelles).
 */

import type {
  Agency,
  Centre,
  Client,
  ClientHistoryItem,
  ClientSummary,
  CollectionAction,
  CollectionActionDashboard,
  Invoice,
  Manager,
  Payment,
  ReceivableSummary,
} from "@/api/types";

export const demoUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "agent@camtel.cm",
  full_name: "Diane Mbarga",
  phone: "+237 690 00 00 00",
  status: "ACTIVE",
};

export const demoPassword = "camtel2026";

// ============================================================
// Référentiels organisationnels
// ============================================================

export const centres: Centre[] = [
  {
    nom_centre: "CENTRE LITTORAL",
    agences: [
      { id_agence: "AG_DOUALA_1", nom_centre: "CENTRE LITTORAL", nom_agence: "Douala 1er" },
      { id_agence: "AG_DOUALA_2", nom_centre: "CENTRE LITTORAL", nom_agence: "Douala Akwa" },
    ],
  },
  {
    nom_centre: "CENTRE DU SUD",
    agences: [
      { id_agence: "AG_YAOUNDE_1", nom_centre: "CENTRE DU SUD", nom_agence: "Yaoundé Centre" },
      { id_agence: "AG_YAOUNDE_2", nom_centre: "CENTRE DU SUD", nom_agence: "Yaoundé Bastos" },
    ],
  },
  {
    nom_centre: "CENTRE DU NORD",
    agences: [
      { id_agence: "AG_GAROUA_1", nom_centre: "CENTRE DU NORD", nom_agence: "Garoua" },
    ],
  },
];

export const managers: Manager[] = [
  { mat_gestionnaire: "MGA-001", nom_gestionnaire: "Diane Mbarga", tel_gestionnaire: 690000001, email_gestionnaire: "diane.mbarga@camtel.cm" },
  { mat_gestionnaire: "MGA-002", nom_gestionnaire: "Jean-Paul Etoa", tel_gestionnaire: 690000002, email_gestionnaire: "jp.etoa@camtel.cm" },
  { mat_gestionnaire: "MGA-003", nom_gestionnaire: "Clarisse Ngo", tel_gestionnaire: 690000003, email_gestionnaire: "clarisse.ngo@camtel.cm" },
  { mat_gestionnaire: "MGA-004", nom_gestionnaire: "Serge Kamdem", tel_gestionnaire: 690000004, email_gestionnaire: "serge.kamdem@camtel.cm" },
  { mat_gestionnaire: "MGA-005", nom_gestionnaire: "Aline Fotso", tel_gestionnaire: 690000005, email_gestionnaire: "aline.fotso@camtel.cm" },
];

// ============================================================
// Clients et comptes
// ============================================================

export const clients: Client[] = [
  {
    code_client: 1001,
    raison_sociale: "SOCIETE GENERALE DU CAMEROUN",
    marche: "OFF",
    email: "comptabilite@sgc.cm",
    tel: 233121234,
    comptes: [
      { num_compte: 5001001, mat_gestionnaire: "MGA-001", id_agence: "AG_DOUALA_1", code_client: 1001, e_bill: "OUI", statut_facturation: "EN COURS", identification: "Identifié", balance: 458_750_000 },
      { num_compte: 5001002, mat_gestionnaire: "MGA-001", id_agence: "AG_DOUALA_1", code_client: 1001, e_bill: "OUI", statut_facturation: "EN COURS", identification: "Identifié", balance: 12_480_000 },
    ],
  },
  {
    code_client: 1002,
    raison_sociale: "CAMEROON TELECOMMUNICATIONS",
    marche: "OFF",
    email: "facturation@camtel.cm",
    tel: 233431000,
    comptes: [
      { num_compte: 5002001, mat_gestionnaire: "MGA-002", id_agence: "AG_YAOUNDE_1", code_client: 1002, e_bill: "OUI", statut_facturation: "EN COURS", identification: "Identifié", balance: 287_300_000 },
    ],
  },
  {
    code_client: 1003,
    raison_sociale: "GEOCAM INDUSTRIES",
    marche: "PRO",
    email: "admin@geocam.cm",
    tel: 233456789,
    comptes: [
      { num_compte: 5003001, mat_gestionnaire: "MGA-003", id_agence: "AG_DOUALA_2", code_client: 1003, e_bill: "NON", statut_facturation: "EN COURS", identification: "Non identifié", balance: 96_540_000 },
      { num_compte: 5003002, mat_gestionnaire: "MGA-003", id_agence: "AG_DOUALA_2", code_client: 1003, e_bill: "NON", statut_facturation: "ARRÊT", identification: "Non identifié", balance: 18_900_000 },
    ],
  },
  {
    code_client: 1004,
    raison_sociale: "HOTEL LA FALAISE BONANJO",
    marche: "PRO",
    email: "direction@lafalaise.cm",
    tel: 233789123,
    comptes: [
      { num_compte: 5004001, mat_gestionnaire: "MGA-001", id_agence: "AG_DOUALA_1", code_client: 1004, e_bill: "OUI", statut_facturation: "EN COURS", identification: "Identifié", balance: 42_100_000 },
    ],
  },
  {
    code_client: 1005,
    raison_sociale: "UNIVERSITE DE YAOUNDE I",
    marche: "OFF",
    email: "sie@uy1.cm",
    tel: 222230152,
    comptes: [
      { num_compte: 5005001, mat_gestionnaire: "MGA-002", id_agence: "AG_YAOUNDE_1", code_client: 1005, e_bill: "NON", statut_facturation: "EN COURS", identification: "En cours de vérification", balance: 154_200_000 },
    ],
  },
  {
    code_client: 1006,
    raison_sociale: "SOCIETE CAMEROUNAISE DE TRANSPORT",
    marche: "PRO",
    email: "facturation@sct.cm",
    tel: 699102030,
    comptes: [
      { num_compte: 5006001, mat_gestionnaire: "MGA-004", id_agence: "AG_YAOUNDE_2", code_client: 1006, e_bill: "OUI", statut_facturation: "ARRÊT", identification: "Identifié", balance: 78_500_000 },
      { num_compte: 5006002, mat_gestionnaire: "MGA-004", id_agence: "AG_YAOUNDE_2", code_client: 1006, e_bill: "OUI", statut_facturation: "EN COURS", identification: "Identifié", balance: 5_200_000 },
    ],
  },
  {
    code_client: 1007,
    raison_sociale: "CABINET MEDICAL DU PALAIS",
    marche: "PAR",
    email: "contact@cmp.cm",
    tel: 690112233,
    comptes: [
      { num_compte: 5007001, mat_gestionnaire: "MGA-005", id_agence: "AG_GAROUA_1", code_client: 1007, e_bill: "NON", statut_facturation: "EN COURS", identification: "Non identifié", balance: 3_850_000 },
    ],
  },
  {
    code_client: 1008,
    raison_sociale: "MAIRIE DE GAROUA",
    marche: "OFF",
    email: "comptabilite@mairie-garoua.cm",
    tel: 222271110,
    comptes: [
      { num_compte: 5008001, mat_gestionnaire: "MGA-005", id_agence: "AG_GAROUA_1", code_client: 1008, e_bill: "NON", statut_facturation: "EN COURS", identification: "En cours de vérification", balance: 21_750_000 },
    ],
  },
];

// ============================================================
// Factures, paiements et créances (détail par compte)
// ============================================================

const TWO_MONTHS_AGO = "2026-06-10";
const ONE_MONTH_AGO = "2026-07-10";
const THIS_MONTH = "2026-08-10";

/** Factures ouvertes par propriétaire de compte (FACTURE / IMPAYE : colonnes réelles). */
export const invoicesByAccount: Record<number, Invoice[]> = {
  5001001: [
    { id_facture: "FAC-2026-06-5001001", num_compte: 5001001, date_emission: TWO_MONTHS_AGO, montant_facture: 158_000_000, paid_amount: 0, outstanding_amount: 158_000_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-07-5001001", num_compte: 5001001, date_emission: ONE_MONTH_AGO, montant_facture: 152_000_000, paid_amount: 0, outstanding_amount: 152_000_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5001001", num_compte: 5001001, date_emission: THIS_MONTH, montant_facture: 148_750_000, paid_amount: 0, outstanding_amount: 148_750_000, status: "IMPAYE" },
  ],
  5001002: [
    { id_facture: "FAC-2026-07-5001002", num_compte: 5001002, date_emission: ONE_MONTH_AGO, montant_facture: 6_240_000, paid_amount: 0, outstanding_amount: 6_240_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5001002", num_compte: 5001002, date_emission: THIS_MONTH, montant_facture: 6_240_000, paid_amount: 0, outstanding_amount: 6_240_000, status: "IMPAYE" },
  ],
  5002001: [
    { id_facture: "FAC-2026-05-5002001", num_compte: 5002001, date_emission: "2026-05-10", montant_facture: 96_000_000, paid_amount: 0, outstanding_amount: 96_000_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-06-5002001", num_compte: 5002001, date_emission: TWO_MONTHS_AGO, montant_facture: 95_300_000, paid_amount: 0, outstanding_amount: 95_300_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-07-5002001", num_compte: 5002001, date_emission: ONE_MONTH_AGO, montant_facture: 96_000_000, paid_amount: 0, outstanding_amount: 96_000_000, status: "IMPAYE" },
  ],
  5003001: [
    { id_facture: "FAC-2026-06-5003001", num_compte: 5003001, date_emission: TWO_MONTHS_AGO, montant_facture: 32_180_000, paid_amount: 0, outstanding_amount: 32_180_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-07-5003001", num_compte: 5003001, date_emission: ONE_MONTH_AGO, montant_facture: 32_180_000, paid_amount: 0, outstanding_amount: 32_180_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5003001", num_compte: 5003001, date_emission: THIS_MONTH, montant_facture: 32_180_000, paid_amount: 0, outstanding_amount: 32_180_000, status: "IMPAYE" },
  ],
  5003002: [
    { id_facture: "FAC-2026-04-5003002", num_compte: 5003002, date_emission: "2026-04-10", montant_facture: 9_450_000, paid_amount: 0, outstanding_amount: 9_450_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-05-5003002", num_compte: 5003002, date_emission: "2026-05-10", montant_facture: 9_450_000, paid_amount: 0, outstanding_amount: 9_450_000, status: "IMPAYE" },
  ],
  5004001: [
    { id_facture: "FAC-2026-07-5004001", num_compte: 5004001, date_emission: ONE_MONTH_AGO, montant_facture: 21_050_000, paid_amount: 0, outstanding_amount: 21_050_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5004001", num_compte: 5004001, date_emission: THIS_MONTH, montant_facture: 21_050_000, paid_amount: 0, outstanding_amount: 21_050_000, status: "IMPAYE" },
  ],
  5005001: [
    { id_facture: "FAC-2026-06-5005001", num_compte: 5005001, date_emission: TWO_MONTHS_AGO, montant_facture: 51_400_000, paid_amount: 0, outstanding_amount: 51_400_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-07-5005001", num_compte: 5005001, date_emission: ONE_MONTH_AGO, montant_facture: 51_400_000, paid_amount: 0, outstanding_amount: 51_400_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5005001", num_compte: 5005001, date_emission: THIS_MONTH, montant_facture: 51_400_000, paid_amount: 0, outstanding_amount: 51_400_000, status: "IMPAYE" },
  ],
  5006001: [
    { id_facture: "FAC-2026-03-5006001", num_compte: 5006001, date_emission: "2026-03-10", montant_facture: 26_100_000, paid_amount: 0, outstanding_amount: 26_100_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-04-5006001", num_compte: 5006001, date_emission: "2026-04-10", montant_facture: 26_200_000, paid_amount: 0, outstanding_amount: 26_200_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-05-5006001", num_compte: 5006001, date_emission: "2026-05-10", montant_facture: 26_200_000, paid_amount: 0, outstanding_amount: 26_200_000, status: "IMPAYE" },
  ],
  5006002: [
    { id_facture: "FAC-2026-08-5006002", num_compte: 5006002, date_emission: THIS_MONTH, montant_facture: 5_200_000, paid_amount: 0, outstanding_amount: 5_200_000, status: "IMPAYE" },
  ],
  5007001: [
    { id_facture: "FAC-2026-07-5007001", num_compte: 5007001, date_emission: ONE_MONTH_AGO, montant_facture: 1_925_000, paid_amount: 0, outstanding_amount: 1_925_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5007001", num_compte: 5007001, date_emission: THIS_MONTH, montant_facture: 1_925_000, paid_amount: 0, outstanding_amount: 1_925_000, status: "IMPAYE" },
  ],
  5008001: [
    { id_facture: "FAC-2026-07-5008001", num_compte: 5008001, date_emission: ONE_MONTH_AGO, montant_facture: 10_875_000, paid_amount: 0, outstanding_amount: 10_875_000, status: "IMPAYE" },
    { id_facture: "FAC-2026-08-5008001", num_compte: 5008001, date_emission: THIS_MONTH, montant_facture: 10_875_000, paid_amount: 0, outstanding_amount: 10_875_000, status: "IMPAYE" },
  ],
};

/** Paiements récents par compte (imputés ou non). */
export const paymentsByAccount: Record<number, Payment[]> = {
  5001001: [
    { id_paiement: "PAY-2026-07-5001001-A", id_facture: "FAC-2026-05-5001001", date_paiement: "2026-07-02", montant_paye: 150_000_000 },
  ],
  5002001: [
    { id_paiement: "PAY-2026-06-5002001-A", id_facture: "FAC-2026-04-5002001", date_paiement: "2026-06-18", montant_paye: 98_500_000 },
  ],
  5003001: [
    { id_paiement: "PAY-2026-07-5003001-A", id_facture: "FAC-2026-05-5003001", date_paiement: "2026-07-15", montant_paye: 30_000_000 },
  ],
  5004001: [
    { id_paiement: "PAY-2026-07-5004001-A", id_facture: "FAC-2026-06-5004001", date_paiement: "2026-07-21", montant_paye: 21_050_000 },
  ],
  5005001: [
    { id_paiement: "PAY-2026-07-5005001-A", id_facture: "FAC-2026-05-5005001", date_paiement: "2026-07-08", montant_paye: 50_000_000 },
  ],
  5007001: [
    { id_paiement: "PAY-2026-07-5007001-A", id_facture: "FAC-2026-06-5007001", date_paiement: "2026-07-29", montant_paye: 1_925_000 },
  ],
};

/**
 * Historique d'actions de recouvrement (GET /clients/{id}/history).
 * Le backend renvoie un tableau vide pour l'instant ; la démo sert un historique réaliste.
 */
export const historyByClient: Record<number, ClientHistoryItem[]> = {
  1001: [
    { timestamp: "2026-08-12T09:15:00Z", action: "Relance téléphonique", note: "Contact du directeur financier — promesse de règlement imminente." },
    { timestamp: "2026-07-28T14:40:00Z", action: "Envoi mise en demeure", note: "Mise en demeure n°MD-2026-118 adressée par courrier." },
    { timestamp: "2026-07-15T10:05:00Z", action: "Relance téléphonique", note: "Prise de contact avec la comptabilité." },
  ],
  1003: [
    { timestamp: "2026-08-05T16:20:00Z", action: "Visite sur site", note: "Rencontre avec le responsable administratif et financier." },
    { timestamp: "2026-07-22T11:30:00Z", action: "Relance téléphonique", note: "Ligne joignable, dossier transmis à la direction." },
  ],
  1005: [
    { timestamp: "2026-08-01T08:45:00Z", action: "Email de relance", note: "Relance envoyée au service informatique de l'université." },
  ],
};

/** Actions de recouvrement par compte (GET /accounts/{id}/collection-actions). */
export const actionsByAccount: Record<number, CollectionAction[]> = {
  5001001: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      account_id: 5001001,
      action_type: "PHONE_CALL",
      due_date: "2026-08-20",
      comment: "Relance planifiée avant échéance de fin de mois.",
      priority: "HIGH",
      created_by: demoUser.id,
      status: "PLANNED",
      completed_at: null,
      result: null,
      assigned_to: demoUser.id,
      created_at: "2026-08-12T09:00:00Z",
      updated_at: "2026-08-12T09:00:00Z",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      account_id: 5001001,
      action_type: "FORMAL_NOTICE",
      due_date: "2026-07-28",
      comment: "Mise en demeure envoyée.",
      priority: "HIGH",
      created_by: demoUser.id,
      status: "COMPLETED",
      completed_at: "2026-07-28T14:40:00Z",
      result: "Mise en demeure n°MD-2026-118 adressée.",
      assigned_to: demoUser.id,
      created_at: "2026-07-25T09:00:00Z",
      updated_at: "2026-07-28T14:40:00Z",
    },
  ],
  5003001: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      account_id: 5003001,
      action_type: "VISIT",
      due_date: "2026-08-05",
      comment: "Visite de suivi du dossier.",
      priority: "NORMAL",
      created_by: demoUser.id,
      status: "IN_PROGRESS",
      completed_at: null,
      result: null,
      assigned_to: demoUser.id,
      created_at: "2026-08-05T16:20:00Z",
      updated_at: "2026-08-05T16:20:00Z",
    },
  ],
};

/** Synthèse de dettes par compte (GET /accounts/{id}/receivable-summary). */
export function receivableSummaryFor(accountId: number): ReceivableSummary {
  const invoices = invoicesByAccount[accountId] ?? [];
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount ?? 0), 0);
  const overdueAmount = invoices
    .filter((inv) => inv.date_emission && inv.date_emission < "2026-08-01")
    .reduce((sum, inv) => sum + (inv.outstanding_amount ?? 0), 0);
  return {
    total_outstanding: totalOutstanding,
    overdue_amount: overdueAmount,
    open_invoices: invoices.length,
  };
}

/** Synthèse client (GET /clients/{id}/summary). */
export function clientSummaryFor(codeClient: number): ClientSummary {
  const client = clients.find((c) => c.code_client === codeClient);
  const accounts = client?.comptes ?? [];
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalOutstanding = accounts.reduce((sum, acc) => sum + receivableSummaryFor(acc.num_compte).total_outstanding, 0);
  return {
    total_balance: totalBalance,
    total_accounts: accounts.length,
    total_outstanding: totalOutstanding,
  };
}

/** Résumé du dashboard des actions (GET /collection-actions/dashboard). */
export function collectionActionsDashboard(): CollectionActionDashboard {
  return {
    by_status: { PLANNED: 12, IN_PROGRESS: 8, COMPLETED: 245 },
    due_today: 3,
    overdue: 17,
  };
}

/** Liste globale des agences (pour les filtres de recherche). */
export function allAgencies(): Agency[] {
  return centres.flatMap((c) => c.agences ?? []);
}

/** Recherche plein texte sur raison_sociale / numéro client (miroir du filtre backend). */
export function searchClients(query: string): Client[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter(
    (c) =>
      c.raison_sociale.toLowerCase().includes(q) ||
      String(c.code_client).includes(q) ||
      (c.marche ?? "").toLowerCase().includes(q),
  );
}
