/**
 * DONNÉES DE DÉMONSTRATION — 100 % synthétiques / anonymisées (décision produit : GBLContext §24).
 * Les montants, noms et dates sont fictifs. À remplacer par les données du pipeline d'import
 * lorsque le backend sera branché. Référence de fraîcheur : 31/07/2026 (lot « GBL - Juillet 2026 »).
 */
import type {
  Account,
  Agency,
  Center,
  CollectionAction,
  Customer,
  CustomerDetail,
  ImportBatch,
  ImportReject,
  Invoice,
  Manager,
  Payment,
  Receivable,
} from "@/api/types";

const REF = Date.parse("2026-07-31T23:59:00");
const iso = (daysAgo: number): string => new Date(REF - daysAgo * 86_400_000).toISOString();

export const managers: Manager[] = [
  { id: "mgr-1", name: "M. Essomba", role: "Département Recouvrement", agency: "Yaoundé Centre", workload: 118 },
  { id: "mgr-2", name: "C. Njoya", role: "Département Recouvrement", agency: "Douala Akwa", workload: 94 },
  { id: "mgr-3", name: "P. Kamga", role: "Recouvrement Entreprises", agency: "Bafoussam", workload: 61 },
  { id: "mgr-4", name: "A. Leroux", role: "Département Recouvrement", agency: "Yaoundé Centre", workload: 37 },
];

export const centers: Center[] = [
  { id: "cg-entreprises", name: "CG Entreprises" },
  { id: "cg-pme", name: "CG PME" },
  { id: "cg-vip", name: "CG Particuliers VIP" },
  { id: "cg-etat", name: "CG État" },
];

export const agencies: Agency[] = [
  { id: "ag-yde", name: "Yaoundé Centre", center: "CG Entreprises" },
  { id: "ag-dla", name: "Douala Akwa", center: "CG PME" },
  { id: "ag-baf", name: "Bafoussam", center: "CG Entreprises" },
  { id: "ag-gar", name: "Garoua", center: "CG État" },
  { id: "ag-lim", name: "Limbé", center: "CG PME" },
];

interface CustomerSpec {
  customer: Omit<Customer, "lastPayment" | "overdue" | "balance">;
  accounts: Array<{ number: string; status: Account["status"] }>;
  invoices: Array<{ number: string; issueDaysAgo: number; dueDaysAgo: number; total: number; paid: number }>;
  payments: Array<{ reference: string; daysAgo: number; amount: number }>;
  actions: Array<{ type: string; status: CollectionAction["status"]; daysAgo: number; dueInDays: number | null; note: string; result: string | null }>;
}

const specs: CustomerSpec[] = [
  {
    customer: {
      id: "CAM-23901-B",
      name: "Société Forestière de l'Est",
      type: "entreprise",
      phone: "+237 698 45 12 30",
      email: "comptabilite@sfe.cm",
      address: "Route de l'Aéroport, BP 412",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG Entreprises",
      managerId: "mgr-1",
      status: "contentieux",
      createdAt: "2023-02-14",
    },
    accounts: [{ number: "CAM-23901-B-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0412", issueDaysAgo: 40, dueDaysAgo: -10, total: 18_500_000, paid: 6_000_000 },
      { number: "FAC-2026-0390", issueDaysAgo: 70, dueDaysAgo: 40, total: 12_400_000, paid: 4_900_000 },
      { number: "FAC-2026-0331", issueDaysAgo: 120, dueDaysAgo: 90, total: 15_200_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11882", daysAgo: 15, amount: 6_000_000 },
      { reference: "PAY-2026-10441", daysAgo: 55, amount: 4_900_000 },
    ],
    actions: [
      { type: "Mise en demeure", status: "cloturee", daysAgo: 28, dueInDays: null, note: "Courrier RAR envoyé pour les factures échues de plus de 90 jours.", result: "Aucune réponse à ce jour" },
      { type: "Appel téléphonique", status: "en-cours", daysAgo: 6, dueInDays: 9, note: "Contact avec la direction financière. Promesse de règlement partiel.", result: null },
    ],
  },
  {
    customer: {
      id: "CAM-10442-A",
      name: "Ministère des Finances (MINFI)",
      type: "etat",
      phone: "+237 222 22 10 45",
      email: "tresorerie@minfi.cm",
      address: "Avenue Mgr Vogt, BP 164",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG État",
      managerId: "mgr-2",
      status: "impaye",
      createdAt: "2022-11-02",
    },
    accounts: [{ number: "CAM-10442-A-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0408", issueDaysAgo: 45, dueDaysAgo: 15, total: 48_000_000, paid: 18_000_000 },
      { number: "FAC-2026-0355", issueDaysAgo: 95, dueDaysAgo: 65, total: 52_000_000, paid: 10_000_000 },
      { number: "FAC-2026-0301", issueDaysAgo: 150, dueDaysAgo: 120, total: 60_000_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11770", daysAgo: 20, amount: 18_000_000 },
      { reference: "PAY-2026-10200", daysAgo: 80, amount: 10_000_000 },
    ],
    actions: [
      { type: "Réunion de conciliation", status: "en-cours", daysAgo: 9, dueInDays: 12, note: "Séance avec la trésorerie générale. Demande de mandatement prioritaire.", result: null },
      { type: "Mise en demeure", status: "cloturee", daysAgo: 60, dueInDays: null, note: "Notification officielle transmise à la tutelle.", result: "Réponse partielle reçue" },
    ],
  },
  {
    customer: {
      id: "CAM-88321-C",
      name: "Brasseries du Cameroun",
      type: "entreprise",
      phone: "+237 233 42 80 11",
      email: "compta@brasseries.cm",
      address: "Zone industrielle Bassa, BP 372",
      city: "Douala",
      agency: "Douala Akwa",
      center: "CG Entreprises",
      managerId: "mgr-3",
      status: "actif",
      createdAt: "2021-06-19",
    },
    accounts: [{ number: "CAM-88321-C-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0420", issueDaysAgo: 22, dueDaysAgo: -8, total: 12_000_000, paid: 12_000_000 },
    ],
    payments: [
      { reference: "PAY-2026-11905", daysAgo: 2, amount: 12_000_000 },
    ],
    actions: [],
  },
  {
    customer: {
      id: "CAM-44512-D",
      name: "Ets Mballa & Fils",
      type: "entreprise",
      phone: "+237 677 88 90 21",
      email: "gestion@mballa-fils.cm",
      address: "Rue des Dipo, BP 811",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG PME",
      managerId: "mgr-1",
      status: "impaye",
      createdAt: "2024-01-27",
    },
    accounts: [{ number: "CAM-44512-D-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0415", issueDaysAgo: 33, dueDaysAgo: -5, total: 5_200_000, paid: 2_000_000 },
      { number: "FAC-2026-0377", issueDaysAgo: 88, dueDaysAgo: 58, total: 4_300_000, paid: 1_100_000 },
    ],
    payments: [
      { reference: "PAY-2026-11831", daysAgo: 12, amount: 2_000_000 },
      { reference: "PAY-2026-10780", daysAgo: 65, amount: 1_100_000 },
    ],
    actions: [
      { type: "Email de relance", status: "cloturee", daysAgo: 30, dueInDays: null, note: "Relance niveau 2 envoyée pour les factures 30+ jours.", result: "Pas de retour" },
    ],
  },
  {
    customer: {
      id: "CAM-11209-E",
      name: "Hôpital Général de Yaoundé",
      type: "etat",
      phone: "+237 222 21 40 55",
      email: "comptabilite@hgy.cm",
      address: "Rue Henri Dunant, BP 5408",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG État",
      managerId: "mgr-4",
      status: "contentieux",
      createdAt: "2022-08-03",
    },
    accounts: [{ number: "CAM-11209-E-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0388", issueDaysAgo: 62, dueDaysAgo: 32, total: 11_000_000, paid: 2_000_000 },
      { number: "FAC-2026-0350", issueDaysAgo: 105, dueDaysAgo: 75, total: 9_000_000, paid: 1_500_000 },
      { number: "FAC-2026-0309", issueDaysAgo: 140, dueDaysAgo: 110, total: 8_000_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11601", daysAgo: 26, amount: 2_000_000 },
      { reference: "PAY-2026-10800", daysAgo: 62, amount: 1_500_000 },
    ],
    actions: [
      { type: "Mise en demeure", status: "cloturee", daysAgo: 40, dueInDays: null, note: "Notification au directeur administratif et financier.", result: "Engagement de paiement partiel" },
      { type: "Plan de règlement", status: "planifiee", daysAgo: 3, dueInDays: 21, note: "Échéancier sur 3 mois proposé par l'agent.", result: null },
    ],
  },
  {
    customer: {
      id: "CL-2024-089",
      name: "Société Générale Cameroun",
      type: "entreprise",
      phone: "+237 233 43 70 00",
      email: "contact.sgc@socgen.cm",
      address: "Avenue du Général de Gaulle, BP 244",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG Entreprises",
      managerId: "mgr-4",
      status: "impaye",
      createdAt: "2022-03-30",
    },
    accounts: [{ number: "CL-2024-089-01", status: "actif" }, { number: "CL-2024-089-02", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0395", issueDaysAgo: 48, dueDaysAgo: -2, total: 9_000_000, paid: 2_500_000 },
      { number: "FAC-2026-0341", issueDaysAgo: 118, dueDaysAgo: 88, total: 7_240_000, paid: 1_000_000 },
    ],
    payments: [
      { reference: "PAY-2026-11554", daysAgo: 25, amount: 2_500_000 },
      { reference: "PAY-2026-10990", daysAgo: 75, amount: 1_000_000 },
    ],
    actions: [
      { type: "Appel téléphonique", status: "cloturee", daysAgo: 17, dueInDays: null, note: "Contact avec le DAF. Engagement à régler 5 M XAF avant fin août.", result: "Promesse consignée" },
      { type: "Relance écrite", status: "planifiee", daysAgo: 1, dueInDays: 8, note: "Suivi de la promesse de paiement.", result: null },
    ],
  },
  {
    customer: {
      id: "CAM-55671-F",
      name: "Mme Ngo Bassa Clotilde",
      type: "particulier",
      phone: "+237 691 22 45 78",
      email: "c.ngobassa@gmail.com",
      address: "Quartier Mvog-Ada, BP 900",
      city: "Yaoundé",
      agency: "Yaoundé Centre",
      center: "CG Particuliers VIP",
      managerId: "mgr-1",
      status: "impaye",
      createdAt: "2025-04-11",
    },
    accounts: [{ number: "CAM-55671-F-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0405", issueDaysAgo: 48, dueDaysAgo: 18, total: 840_000, paid: 300_000 },
    ],
    payments: [
      { reference: "PAY-2026-11720", daysAgo: 21, amount: 300_000 },
    ],
    actions: [
      { type: "Appel téléphonique", status: "en-cours", daysAgo: 4, dueInDays: 6, note: "Accord de principe pour un règlement fin de mois.", result: null },
    ],
  },
  {
    customer: {
      id: "CAM-33210-G",
      name: "Université de Buea",
      type: "etat",
      phone: "+237 233 32 21 34",
      email: "bursar@ubuea.cm",
      address: "Molyko, Buea",
      city: "Buea",
      agency: "Limbé",
      center: "CG État",
      managerId: "mgr-2",
      status: "actif",
      createdAt: "2023-09-15",
    },
    accounts: [{ number: "CAM-33210-G-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0425", issueDaysAgo: 12, dueDaysAgo: -18, total: 6_400_000, paid: 6_400_000 },
    ],
    payments: [
      { reference: "PAY-2026-11990", daysAgo: 5, amount: 6_400_000 },
    ],
    actions: [],
  },
  {
    customer: {
      id: "CAM-77124-H",
      name: "M. Ntone Jean-Pierre",
      type: "particulier",
      phone: "+237 677 40 18 62",
      email: "jp.ntone@yahoo.fr",
      address: "Quartier Bonapriso, BP 45",
      city: "Douala",
      agency: "Douala Akwa",
      center: "CG Particuliers VIP",
      managerId: "mgr-2",
      status: "irrecouvrable",
      createdAt: "2021-12-08",
    },
    accounts: [{ number: "CAM-77124-H-01", status: "suspendu" }],
    invoices: [
      { number: "FAC-2025-9981", issueDaysAgo: 380, dueDaysAgo: 350, total: 2_150_000, paid: 0 },
    ],
    payments: [],
    actions: [
      { type: "Mise en demeure", status: "cloturee", daysAgo: 300, dueInDays: null, note: "Contentieux transmis au service juridique.", result: "Saisine en cours" },
    ],
  },
  {
    customer: {
      id: "CAM-66401-J",
      name: "Clinique de la Cité",
      type: "entreprise",
      phone: "+237 233 44 27 90",
      email: "facturation@cliniquecite.cm",
      address: "Carrefour Warda, BP 1123",
      city: "Douala",
      agency: "Douala Akwa",
      center: "CG PME",
      managerId: "mgr-3",
      status: "impaye",
      createdAt: "2024-06-22",
    },
    accounts: [{ number: "CAM-66401-J-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0410", issueDaysAgo: 42, dueDaysAgo: -6, total: 3_900_000, paid: 1_400_000 },
      { number: "FAC-2026-0362", issueDaysAgo: 100, dueDaysAgo: 70, total: 2_800_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11795", daysAgo: 18, amount: 1_400_000 },
    ],
    actions: [
      { type: "Email de relance", status: "en-cours", daysAgo: 7, dueInDays: 14, note: "Relance jointe au relevé de compte.", result: null },
    ],
  },
  {
    customer: {
      id: "CAM-22180-K",
      name: "Mme Fotso Michèle",
      type: "particulier",
      phone: "+237 699 51 33 07",
      email: "m.fotso@outlook.com",
      address: "Quartier Tam-Tam, BP 208",
      city: "Bafoussam",
      agency: "Bafoussam",
      center: "CG Particuliers VIP",
      managerId: "mgr-3",
      status: "actif",
      createdAt: "2025-11-03",
    },
    accounts: [{ number: "CAM-22180-K-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0430", issueDaysAgo: 5, dueDaysAgo: -25, total: 1_120_000, paid: 1_120_000 },
    ],
    payments: [
      { reference: "PAY-2026-12041", daysAgo: 1, amount: 1_120_000 },
    ],
    actions: [],
  },
  {
    customer: {
      id: "CAM-90873-L",
      name: "Cargo Express International",
      type: "entreprise",
      phone: "+237 233 36 55 88",
      email: "finance@cargoexpress.cm",
      address: "Quartier Aéroport, BP 332",
      city: "Douala",
      agency: "Douala Akwa",
      center: "CG Entreprises",
      managerId: "mgr-2",
      status: "contentieux",
      createdAt: "2023-05-17",
    },
    accounts: [{ number: "CAM-90873-L-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0368", issueDaysAgo: 92, dueDaysAgo: 62, total: 6_800_000, paid: 1_200_000 },
      { number: "FAC-2026-0312", issueDaysAgo: 142, dueDaysAgo: 112, total: 9_600_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11300", daysAgo: 42, amount: 1_200_000 },
    ],
    actions: [
      { type: "Mise en demeure", status: "en-cours", daysAgo: 11, dueInDays: 19, note: "Notification juridique envoyée au siège.", result: null },
    ],
  },
  {
    customer: {
      id: "CAM-44765-M",
      name: "Ets Kamga & Frères",
      type: "entreprise",
      phone: "+237 690 12 78 45",
      email: "direction@kamgafreres.cm",
      address: "Route de Bafoussam, BP 510",
      city: "Bafoussam",
      agency: "Bafoussam",
      center: "CG PME",
      managerId: "mgr-3",
      status: "actif",
      createdAt: "2025-02-09",
    },
    accounts: [{ number: "CAM-44765-M-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0432", issueDaysAgo: 3, dueDaysAgo: -27, total: 2_300_000, paid: 2_300_000 },
    ],
    payments: [
      { reference: "PAY-2026-12070", daysAgo: 1, amount: 2_300_000 },
    ],
    actions: [],
  },
  {
    customer: {
      id: "CAM-12095-N",
      name: "M. Manga Daniel",
      type: "particulier",
      phone: "+237 678 90 11 23",
      email: "daniel.manga@gmail.com",
      address: "Quartier Ndokoti, BP 72",
      city: "Douala",
      agency: "Douala Akwa",
      center: "CG Particuliers VIP",
      managerId: "mgr-1",
      status: "impaye",
      createdAt: "2024-09-30",
    },
    accounts: [{ number: "CAM-12095-N-01", status: "actif" }],
    invoices: [
      { number: "FAC-2026-0399", issueDaysAgo: 52, dueDaysAgo: 22, total: 1_540_000, paid: 400_000 },
      { number: "FAC-2026-0335", issueDaysAgo: 130, dueDaysAgo: 100, total: 980_000, paid: 0 },
    ],
    payments: [
      { reference: "PAY-2026-11678", daysAgo: 24, amount: 400_000 },
    ],
    actions: [
      { type: "SMS de relance", status: "cloturee", daysAgo: 20, dueInDays: null, note: "Relance automatique envoyée.", result: "Aucune réponse" },
    ],
  },
];

function buildDetail(spec: CustomerSpec): CustomerDetail {
  const { customer } = spec;
  const accounts: Account[] = spec.accounts.map((a, i) => ({
    id: `${customer.id}-ACC-${i + 1}`,
    customerId: customer.id,
    number: a.number,
    agency: customer.agency,
    center: customer.center,
    managerId: customer.managerId,
    status: a.status,
    balance: 0,
  }));

  const invoices: Invoice[] = spec.invoices.map((f, i) => {
    const status: Invoice["status"] = f.paid >= f.total ? "payee" : f.paid > 0 ? "partielle" : "impayee";
    return {
      id: `${f.number}-${i}`,
      number: f.number,
      customerId: customer.id,
      accountNumber: accounts[0]!.number,
      issueDate: iso(f.issueDaysAgo),
      dueDate: iso(f.dueDaysAgo),
      total: f.total,
      paid: f.paid,
      status,
    };
  });

  const payments: Payment[] = spec.payments.map((p, i) => {
    const allocated = p.amount;
    const status: Payment["status"] = allocated >= p.amount ? "impute" : "partiel";
    return {
      id: `${p.reference}-${i}`,
      reference: p.reference,
      customerId: customer.id,
      accountNumber: accounts[0]!.number,
      date: iso(p.daysAgo),
      amount: p.amount,
      allocated,
      status,
    };
  });

  const receivables: Receivable[] = invoices
    .filter((f) => f.paid < f.total)
    .map((f, i) => {
      const balance = f.total - f.paid;
      const ageDays = Math.max(0, Math.floor((REF - Date.parse(f.dueDate)) / 86_400_000));
      const status: Receivable["status"] = ageDays > 90 ? "urgente" : ageDays > 0 ? "echue" : "en-cours";
      return {
        id: `${f.number}-REC-${i}`,
        customerId: customer.id,
        accountNumber: f.accountNumber,
        invoiceNumber: f.number,
        initial: f.total,
        balance,
        ageDays,
        dueDate: f.dueDate,
        status,
      };
    });

  const actions: CollectionAction[] = spec.actions.map((a, i) => ({
    id: `${customer.id}-ACT-${i + 1}`,
    customerId: customer.id,
    type: a.type,
    status: a.status,
    owner: managers.find((m) => m.id === customer.managerId)?.name ?? "—",
    date: iso(a.daysAgo),
    dueDate: a.dueInDays === null ? null : iso(-a.dueInDays),
    note: a.note,
    result: a.result,
  }));

  accounts.forEach((a) => {
    a.balance = receivables.reduce((s, r) => (r.accountNumber === a.number ? s + r.balance : s), 0);
  });

  return {
    ...customer,
    balance: receivables.reduce((s, r) => s + r.balance, 0),
    overdue: receivables.filter((r) => r.ageDays > 0).reduce((s, r) => s + r.balance, 0),
    lastPayment: payments[0]?.date ?? customer.createdAt,
    accounts,
    invoices,
    payments,
    receivables,
    actions,
    manager: managers.find((m) => m.id === customer.managerId) ?? null,
  };
}

export const customers: CustomerDetail[] = specs.map(buildDetail);

export const importBatches: ImportBatch[] = [
  { id: "IMP-2026-0712", fileName: "Factures_Entreprises_Juin2026.xlsx", type: "Factures", status: "succes", processed: 14_520, rejected: 0, date: iso(5) },
  { id: "IMP-2026-0711", fileName: "Paiements_Semaine29.xlsx", type: "Paiements", status: "partiel", processed: 8_950, rejected: 12, date: iso(6) },
  { id: "IMP-2026-0708", fileName: "Clients_Nouveaux_MiseAJour.xlsx", type: "Clients", status: "succes", processed: 1_204, rejected: 0, date: iso(9) },
  { id: "IMP-2026-0705", fileName: "Créances_Rejets_Q2.xlsx", type: "Créances", status: "echec", processed: 0, rejected: 450, date: iso(12) },
];

export const importRejects: ImportReject[] = [
  { row: 1042, column: "NUMERO_FACTURE", value: "FAC-2026-0A41", reason: "Format invalide (alphanumérique attendu)" },
  { row: 1043, column: "MONTANT", value: "12,500.00 €", reason: "Devise non autorisée (XAF attendu)" },
  { row: 1089, column: "DATE_ECHEANCE", value: "31/02/2026", reason: "Date incohérente avec la date d'émission" },
  { row: 1210, column: "NUMERO_COMPTE", value: "", reason: "Champ obligatoire manquant" },
  { row: 1244, column: "NUMERO_COMPTE", value: "CAM-23901-B-01", reason: "Doublon détecté dans le lot" },
  { row: 1317, column: "MONTANT", value: "-450000", reason: "Montant négatif non autorisé" },
];

export const trend: Array<{ month: string; dette: number; encaissement: number }> = [
  { month: "Fév", dette: 312_400_000, encaissement: 38_100_000 },
  { month: "Mar", dette: 304_900_000, encaissement: 41_200_000 },
  { month: "Avr", dette: 298_500_000, encaissement: 44_600_000 },
  { month: "Mai", dette: 291_800_000, encaissement: 39_900_000 },
  { month: "Juin", dette: 287_300_000, encaissement: 47_500_000 },
  { month: "Juil", dette: 283_600_000, encaissement: 52_300_000 },
];

export const demoCredentials = { identifier: "agent@camtel.cm", password: "demo1234" };
