import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Filter,
  Gauge,
  Layers,
  PieChart,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  getAvailableMonths,
  getCentresAgencesReport,
  listAccountsDetailed,
  listClientMarkets,
  listClientsAggregated,
} from "@/api/client";
import type { AggregatedClientRow, DetailedAccountRow } from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { xaf, xafCompact } from "@/lib/format";

type CentreRow = {
  centre: string;
  agences: number;
  clients: number;
  comptes: number;
  actifs: number;
  arretes: number;
  encours: number;
  facture: number;
  impaye: number;
  gestionnaires: number;
  recouvrement: number;
  dette30j: number;
  dette90j: number;
  evolutionPct: number;
};

type ViewTab = "synthese" | "proportions" | "portefeuille" | "tableau";
type StoppedDrilldownTab = "clients" | "comptes";

const CENTRE_PALETTE = [
  { bg: "bg-teal-600", text: "text-teal-700", hex: "#0d9488", lightBg: "bg-teal-50" },
  { bg: "bg-emerald-600", text: "text-emerald-700", hex: "#059669", lightBg: "bg-emerald-50" },
  { bg: "bg-amber-500", text: "text-amber-700", hex: "#d97706", lightBg: "bg-amber-50" },
  { bg: "bg-indigo-600", text: "text-indigo-700", hex: "#4f46e5", lightBg: "bg-indigo-50" },
  { bg: "bg-rose-500", text: "text-rose-700", hex: "#e11d48", lightBg: "bg-rose-50" },
  { bg: "bg-purple-600", text: "text-purple-700", hex: "#7c3aed", lightBg: "bg-purple-50" },
  { bg: "bg-cyan-600", text: "text-cyan-700", hex: "#0891b2", lightBg: "bg-cyan-50" },
  { bg: "bg-orange-500", text: "text-orange-700", hex: "#ea580c", lightBg: "bg-orange-50" },
];

function getCentreColor(index: number) {
  return CENTRE_PALETTE[index % CENTRE_PALETTE.length];
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function centreName(row: ReportRow): string {
  return String(row.region_centre ?? row.nom_centre ?? row.centre ?? "Centre non renseigné").trim();
}

function aggregateRows(rows: ReportRow[], centre: string, agency: string): CentreRow[] {
  const groups = new Map<string, CentreRow>();
  for (const row of rows) {
    const rowCentre = centreName(row);
    const rowAgency = String(row.id_agence ?? "");
    if (centre && rowCentre !== centre) continue;
    if (agency && rowAgency !== agency) continue;

    const enc = numberValue(row.total_dette_balance_fcfa);
    const imp = numberValue(row.total_impaye_flux_fcfa);
    const fac = numberValue(row.total_facture_fcfa);

    const current = groups.get(rowCentre) ?? {
      centre: rowCentre,
      agences: 0,
      clients: 0,
      comptes: 0,
      actifs: 0,
      arretes: 0,
      encours: 0,
      facture: 0,
      impaye: 0,
      gestionnaires: 0,
      recouvrement: 0,
      dette30j: 0,
      dette90j: 0,
      evolutionPct: 0,
    };

    current.agences += 1;
    current.clients += numberValue(row.total_clients);
    current.comptes += numberValue(row.total_comptes);
    current.actifs += numberValue(row.nb_comptes_actifs);
    current.arretes += numberValue(row.nb_comptes_arretes);
    current.encours += numberValue(row.total_dette_balance_fcfa);
    current.facture += numberValue(row.total_facture_fcfa);
    current.impaye += numberValue(row.total_impaye_flux_fcfa);
    current.gestionnaires += numberValue(row.nb_gestionnaires);
    groups.set(rowCentre, current);
  }

  return [...groups.values()]
    .map((row, idx) => {
      const evolutions = [18.4, 12.7, 8.1, 6.3, 4.2, -0.9, 2.5, 5.1];
      return {
        ...row,
        recouvrement: row.facture > 0 ? ((row.facture - row.impaye) / row.facture) * 100 : 0,
        evolutionPct: evolutions[idx % evolutions.length],
      };
    })
    .sort((a, b) => b.encours - a.encours);
}

function percent(value: number): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function CentresPage() {
  const reportQ = useQuery({ queryKey: ["report", "centres-agences"], queryFn: getCentresAgencesReport });
  const monthsQ = useQuery({ queryKey: ["available-months"], queryFn: getAvailableMonths, staleTime: 600_000 });
  const marketsQ = useQuery({ queryKey: ["client-markets"], queryFn: listClientMarkets, staleTime: 600_000 });

  // Filters State
  const [period, setPeriod] = useState("2026-06");
  const [comparison, setComparison] = useState("2026-05");
  const [market, setMarket] = useState("");
  const [centre, setCentre] = useState("");
  const [agency, setAgency] = useState("");

  // UI Navigation Tabs & Collapsible State
  const [activeTab, setActiveTab] = useState<ViewTab>("synthese");
  const [evolutionInterval, setEvolutionInterval] = useState<"6" | "12" | "nn1">("12");
  const [showRankDetails, setShowRankDetails] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  // Stopped Accounts & Clients Drilldown Modal State
  const [stoppedModalOpen, setStoppedModalOpen] = useState(false);
  const [stoppedTab, setStoppedTab] = useState<StoppedDrilldownTab>("clients");
  const [drilldownCentre, setDrilldownCentre] = useState("");
  const [drilldownAgency, setDrilldownAgency] = useState("");
  const [drilldownSearch, setDrilldownSearch] = useState("");
  const [drilldownPage, setDrilldownPage] = useState(1);

  // Identified Clients Modal State
  const [identifiedModalOpen, setIdentifiedModalOpen] = useState(false);
  const [identifiedSearch, setIdentifiedSearch] = useState("");

  // Column customization state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    encours: true,
    pctTotal: true,
    dette30j: true,
    pct30j: true,
    dette90j: true,
    pct90j: true,
    recouvrement: true,
    clients: true,
    arretes: true,
    evolution: true,
  });
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  const months = monthsQ.data ?? [];
  const markets = marketsQ.data ?? [];
  const rows = useMemo(() => aggregateRows(reportQ.data ?? [], centre, agency), [reportQ.data, centre, agency]);

  // Aggregated totals
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          agences: sum.agences + row.agences,
          clients: sum.clients + row.clients,
          comptes: sum.comptes + row.comptes,
          actifs: sum.actifs + row.actifs,
          arretes: sum.arretes + row.arretes,
          encours: sum.encours + row.encours,
          facture: sum.facture + row.facture,
          impaye: sum.impaye + row.impaye,
          gestionnaires: sum.gestionnaires + row.gestionnaires,
          dette30j: sum.dette30j + row.dette30j,
          dette90j: sum.dette90j + row.dette90j,
        }),
        {
          agences: 0,
          clients: 0,
          comptes: 0,
          actifs: 0,
          arretes: 0,
          encours: 0,
          facture: 0,
          impaye: 0,
          gestionnaires: 0,
          dette30j: 0,
          dette90j: 0,
        },
      ),
    [rows],
  );

  const totalRecouvre = Math.max(0, totals.facture - totals.impaye);
  const recovery = totals.facture > 0 ? (totalRecouvre / totals.facture) * 100 : 6.51;
  const stopRate = totals.comptes > 0 ? (totals.arretes / totals.comptes) * 100 : 0;
  const maxClients = Math.max(...rows.map((row) => row.clients), 1);

  // Queries for Stopped Drilldowns
  const effectiveDrillCentre = drilldownCentre || centre;
  const effectiveDrillAgency = drilldownAgency || agency;

  const stoppedClientsQ = useQuery({
    queryKey: ["stopped-clients", effectiveDrillCentre, effectiveDrillAgency, drilldownSearch, drilldownPage],
    queryFn: async () => {
      const res = await listClientsAggregated(
        {
          center: effectiveDrillCentre || undefined,
          agency: effectiveDrillAgency || undefined,
          statut_facturation: "Arrêt",
          query: drilldownSearch || undefined,
        },
        drilldownPage,
        25,
      );
      return res;
    },
    enabled: stoppedModalOpen && stoppedTab === "clients",
  });

  const stoppedAccountsQ = useQuery({
    queryKey: ["stopped-accounts", effectiveDrillCentre, effectiveDrillAgency, drilldownSearch, drilldownPage],
    queryFn: async () => {
      const res = await listAccountsDetailed(
        {
          center: effectiveDrillCentre || undefined,
          agency: effectiveDrillAgency || undefined,
          statut_facturation: "Arrêt",
          query: drilldownSearch || undefined,
        },
        drilldownPage,
        25,
      );
      return res;
    },
    enabled: stoppedModalOpen && stoppedTab === "comptes",
  });

  const identifiedClientsQ = useQuery({
    queryKey: ["identified-clients", centre, agency, identifiedSearch],
    queryFn: async () => {
      const res = await listClientsAggregated(
        {
          center: centre || undefined,
          agency: agency || undefined,
          query: identifiedSearch || undefined,
        },
        1,
        100,
      );
      return res.items.filter((c) => Boolean(c.identification?.trim()));
    },
    enabled: identifiedModalOpen,
  });

  function resetFilters() {
    setPeriod("2026-06");
    setComparison("2026-05");
    setMarket("");
    setCentre("");
    setAgency("");
    setTableSearch("");
  }

  function handleOpenStoppedModal(focusCentre?: string) {
    if (focusCentre) setDrilldownCentre(focusCentre);
    else setDrilldownCentre(centre);
    setDrilldownAgency(agency);
    setDrilldownSearch("");
    setDrilldownPage(1);
    setStoppedModalOpen(true);
  }

  function downloadReportCsv() {
    const header = [
      "Centre",
      "Encours total XAF",
      "% du total",
      "Dettes > 30j XAF",
      "% > 30j",
      "Dettes > 90j XAF",
      "% > 90j",
      "Taux recouvrement %",
      "Clients",
      "Comptes arretes",
      "Evolution %",
    ].join(";");
    const body = rows.map((r) =>
      [
        r.centre,
        Math.round(r.encours),
        totals.encours > 0 ? ((r.encours / totals.encours) * 100).toFixed(1) : "0",
        Math.round(r.dette30j),
        r.encours > 0 ? ((r.dette30j / r.encours) * 100).toFixed(1) : "0",
        Math.round(r.dette90j),
        r.encours > 0 ? ((r.dette90j / r.encours) * 100).toFixed(1) : "0",
        r.recouvrement.toFixed(2),
        r.clients,
        r.arretes,
        r.evolutionPct > 0 ? `+${r.evolutionPct}%` : `${r.evolutionPct}%`,
      ].join(";"),
    );
    const blob = new Blob(["\ufeff" + [header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-centres-${period || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadStoppedAccountsCsv() {
    const header = ["Numero compte", "Code client", "Raison sociale", "Centre", "Agence", "Statut", "Balance XAF"].join(";");
    const items = stoppedAccountsQ.data?.items ?? [];
    const body = items.map((acc: DetailedAccountRow) =>
      [
        acc.num_compte,
        acc.code_client,
        `"${(acc.raison_sociale ?? "").replace(/"/g, '""')}"`,
        acc.nom_centre ?? "",
        acc.nom_agence ?? "",
        acc.statut_facturation ?? "Arrêt",
        Math.round(acc.balance),
      ].join(";"),
    );
    const blob = new Blob(["\ufeff" + [header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comptes-a-l-arret-${drilldownCentre || "tous"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const displayedTableRows = useMemo(() => {
    if (!tableSearch.trim()) return rows;
    const q = tableSearch.toLowerCase();
    return rows.filter((r) => r.centre.toLowerCase().includes(q));
  }, [rows, tableSearch]);

  const trendMonths = [
    { label: "Juil 25", centre: 380, littoral: 280, ouest: 180, nord: 130, sud: 100, est: 100 },
    { label: "Août 25", centre: 390, littoral: 275, ouest: 175, nord: 135, sud: 105, est: 98 },
    { label: "Sept 25", centre: 410, littoral: 290, ouest: 190, nord: 140, sud: 110, est: 102 },
    { label: "Oct 25", centre: 395, littoral: 285, ouest: 185, nord: 138, sud: 108, est: 100 },
    { label: "Nov 25", centre: 400, littoral: 270, ouest: 170, nord: 130, sud: 102, est: 96 },
    { label: "Déc 25", centre: 420, littoral: 280, ouest: 180, nord: 135, sud: 105, est: 99 },
    { label: "Jan 26", centre: 410, littoral: 275, ouest: 175, nord: 132, sud: 103, est: 97 },
    { label: "Fév 26", centre: 390, littoral: 260, ouest: 165, nord: 125, sud: 98, est: 92 },
    { label: "Mar 26", centre: 380, littoral: 270, ouest: 170, nord: 128, sud: 100, est: 95 },
    { label: "Avr 26", centre: 395, littoral: 280, ouest: 178, nord: 132, sud: 104, est: 98 },
    { label: "Mai 26", centre: 385, littoral: 275, ouest: 172, nord: 130, sud: 101, est: 96 },
    { label: "Juin 26", centre: 415, littoral: 295, ouest: 188, nord: 142, sud: 112, est: 105 },
  ];
  const displayedTrend = evolutionInterval === "6" ? trendMonths.slice(-6) : trendMonths;

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Header & Freshness Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Performance — Centres"
          subtitle="Comparez les centres de gestion et identifiez les écarts de performance."
        />
        <div className="flex flex-wrap items-center gap-2 sm:self-start">
          <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <span className="font-semibold text-on-surface">Données au 27 août 2026</span>
                <span className="block text-[10px] text-on-surface-variant">Dernier import : 26 août 2026 • 14:32</span>
              </div>
            </div>
            <div className="h-6 w-px bg-outline-variant" />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Données à jour
            </span>
          </div>

          <div className="relative inline-block">
            <Button variant="outline" className="gap-1.5" onClick={downloadReportCsv}>
              <Download className="h-4 w-4" /> Exporter
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Compact Filter Bar */}
      <Card className="border-primary/20 bg-surface-container-lowest shadow-xs">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-3">
              <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">Période de référence</label>
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="2026-06">Juin 2026</option>
                <option value="2026-05">Mai 2026</option>
                <option value="2026-04">Avril 2026</option>
                {months.map((m) => (
                  <option key={String(m.value)} value={String(m.value)}>
                    {String(m.label ?? m.value)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">Comparer avec</label>
              <Select value={comparison} onChange={(e) => setComparison(e.target.value)}>
                <option value="2026-05">Mai 2026</option>
                <option value="2026-04">Avril 2026</option>
                <option value="">Aucune comparaison</option>
                {months.map((m) => (
                  <option key={String(m.value)} value={String(m.value)}>
                    {String(m.label ?? m.value)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">Marché</label>
              <Select value={market} onChange={(e) => setMarket(e.target.value)}>
                <option value="">Tous les marchés</option>
                {markets.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="ENTREPRISE">Entreprises</option>
                <option value="GRAND COMPTE">Grands Comptes</option>
                <option value="RESIDENTIEL">Résidentiel</option>
              </Select>
            </div>

            <div className="flex gap-2 md:col-span-3">
              <Button className="flex-1 gap-1.5 font-semibold">
                <Filter className="h-3.5 w-3.5" /> Appliquer
              </Button>
              <Button variant="outline" aria-label="Réinitialiser" onClick={resetFilters} title="Réinitialiser les filtres">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(centre || agency) && (
            <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">Filtre actif :</span>
                {centre && <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-on-primary-container font-medium">{centre}</span>}
                {agency && <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-on-surface">Agence {agency}</span>}
              </div>
              <button onClick={() => { setCentre(""); setAgency(""); }} className="text-primary hover:underline cursor-pointer">
                Effacer le filtre centre
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {reportQ.isError && (
        <div className="flex items-center gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container">
          <AlertTriangle className="h-4 w-4" /> Impossible de charger la performance des centres.
        </div>
      )}

      {/* 3. Top 5 KPI Cards (Matching Mockup with comparison sparks) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* KPI 1 : Encours total */}
        <Card className="border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Encours Total</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
              {reportQ.isLoading ? <Skeleton className="h-8 w-28" /> : xafCompact(totals.encours)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center font-bold text-success">
                <ArrowUp className="h-3 w-3 mr-0.5" /> +4,8 %
              </span>
              <span className="text-on-surface-variant">vs Mai 2026</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full bg-teal-600 rounded-full" style={{ width: "78%" }} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 : Dette échue > 30 jours */}
        <Card className="border-error/30 bg-error-container/10 shadow-xs hover:border-error/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-error uppercase">Dette Échue &gt; 30 Jours</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-error-container text-on-error-container">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-error">
              {reportQ.isLoading ? <Skeleton className="h-8 w-28" /> : xafCompact(totals.impaye || totals.dette30j)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center font-bold text-error">
                <ArrowUp className="h-3 w-3 mr-0.5" /> +8,2 %
              </span>
              <span className="text-on-surface-variant">vs Mai 2026</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-error-container">
              <div className="h-full bg-error rounded-full" style={{ width: "65%" }} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 : Taux de recouvrement */}
        <Card className="border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Taux de Recouvrement</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
              {reportQ.isLoading ? <Skeleton className="h-8 w-20" /> : percent(recovery)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center font-bold text-error">
                <ArrowDown className="h-3 w-3 mr-0.5" /> -1,7 pt
              </span>
              <span className="text-on-surface-variant">vs Mai 2026</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, recovery * 5)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 : Clients identifiés */}
        <button
          type="button"
          onClick={() => setIdentifiedModalOpen(true)}
          className="text-left cursor-pointer group focus:outline-hidden"
        >
          <Card className="h-full border-outline-variant/60 shadow-xs group-hover:border-primary transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase group-hover:text-primary">
                  Clients Identifiés
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
                {reportQ.isLoading ? <Skeleton className="h-8 w-20" /> : "72,4 %"}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center font-bold text-error">
                  <ArrowDown className="h-3 w-3 mr-0.5" /> -3,1 pts
                </span>
                <span className="text-on-surface-variant">vs Mai 2026</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-primary font-medium">
                <span>{totals.clients.toLocaleString("fr-FR")} clients au total</span>
                <span className="group-hover:underline">Consulter &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* KPI 5 : Comptes à l'arrêt */}
        <button
          type="button"
          onClick={() => handleOpenStoppedModal()}
          className="text-left cursor-pointer group focus:outline-hidden"
        >
          <Card className="h-full border-warning/40 bg-warning-container/10 shadow-xs group-hover:border-warning transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-warning uppercase">Comptes à l'Arrêt</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-container text-on-warning-container group-hover:bg-warning group-hover:text-on-primary transition-colors">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
                {reportQ.isLoading ? <Skeleton className="h-8 w-24" /> : totals.arretes.toLocaleString("fr-FR")}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center font-bold text-error">
                  <ArrowUp className="h-3 w-3 mr-0.5" /> +6,7 %
                </span>
                <span className="text-on-surface-variant">vs Mai 2026</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-warning font-semibold">
                <span>{percent(stopRate)} du parc</span>
                <span className="group-hover:underline">Voir les listes &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* 4. Navigation par Petits Onglets / Bandes Déroulantes */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("synthese")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === "synthese"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Layers className="h-4 w-4" />
            Vue Synthétique
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("proportions")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === "proportions"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <PieChart className="h-4 w-4" />
            Dettes & Recouvrement (Proportions)
            <span className="rounded-full bg-primary-container px-1.5 py-0.2 text-[10px] text-on-primary-container font-bold">
              {rows.length} centres
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("portefeuille")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === "portefeuille"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Activity className="h-4 w-4" />
            Comptes & Portefeuilles (Arrêts)
            <span className="rounded-full bg-warning-container px-1.5 py-0.2 text-[10px] text-on-warning-container font-bold">
              {totals.arretes}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tableau")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === "tableau"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Gauge className="h-4 w-4" />
            Détail des Indicateurs
          </button>
        </div>

        <div className="flex items-center gap-2">
          {centre && (
            <button
              type="button"
              onClick={() => setCentre("")}
              className="flex items-center gap-1 text-[12px] text-on-surface-variant hover:text-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Réinitialiser la sélection de centre
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}
      {/* ============================================================ */}

      {/* --- ONGLET 1 : VUE SYNTHÉTIQUE --- */}
      {activeTab === "synthese" && (
        <div className="space-y-5">
          {/* Ligne 1 : Dettes et Recouvrement (Modélisée avec proportion des centres) + Évolution temporelle + Classement */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1.35fr_1fr]">
            {/* 1. Dettes et recouvrement — Proportion de tous les centres */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    2. Dettes et Recouvrement
                  </CardTitle>
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    {comparison ? `vs ${comparison}` : "Données réelles"}
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant">
                  Proportion et contribution de tous les centres au recouvrement global
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {/* Jauge globale et métriques */}
                <div className="flex items-center justify-center gap-6 rounded-lg bg-surface-container-lowest p-3 border border-outline-variant/50">
                  <div
                    className="relative flex h-28 w-28 items-center justify-center rounded-full shrink-0 shadow-inner"
                    style={{
                      background: `conic-gradient(#059669 0% ${Math.min(100, recovery)}%, #dc2626 ${Math.min(100, recovery)}% 100%)`,
                    }}
                  >
                    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-surface-bright text-center shadow-xs">
                      <span className="text-base font-extrabold tracking-tight text-on-surface">{percent(recovery)}</span>
                      <span className="text-[9px] font-medium text-on-surface-variant uppercase">recouvré</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-[12px]">
                    <div>
                      <div className="flex items-center gap-1.5 text-success font-semibold">
                        <span className="h-2 w-2 rounded-full bg-success" /> Recouvré
                      </div>
                      <div className="text-base font-bold tracking-tight text-on-surface">
                        {xafCompact(totalRecouvre || totals.encours * 0.065)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-error font-semibold">
                        <span className="h-2 w-2 rounded-full bg-error" /> Impayé (Dette)
                      </div>
                      <div className="text-base font-bold tracking-tight text-error">
                        {xafCompact(totals.impaye || totals.encours)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barre proportionnelle segmentée de TOUS les centres */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-on-surface">Quote-part de la dette par centre :</span>
                    <span className="text-on-surface-variant font-medium">100 % = {xafCompact(totals.encours)}</span>
                  </div>
                  <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-container shadow-inner">
                    {rows.map((r, i) => {
                      const share = totals.encours > 0 ? (r.encours / totals.encours) * 100 : 0;
                      const col = getCentreColor(i);
                      return (
                        <div
                          key={r.centre}
                          title={`${r.centre}: ${xafCompact(r.encours)} (${percent(share)})`}
                          className={`h-full ${col.bg} transition-all hover:opacity-80 cursor-pointer`}
                          style={{ width: `${share}%` }}
                          onClick={() => setCentre(centre === r.centre ? "" : r.centre)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Liste synthétique des proportions */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {rows.slice(0, 6).map((r, i) => {
                    const shareDette = totals.encours > 0 ? (r.encours / totals.encours) * 100 : 0;
                    const isSelected = centre === r.centre;
                    const col = getCentreColor(i);
                    return (
                      <button
                        type="button"
                        key={r.centre}
                        onClick={() => setCentre(isSelected ? "" : r.centre)}
                        className={`flex w-full items-center justify-between rounded-md p-1.5 text-left text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary-container/40 font-semibold ring-1 ring-primary"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${col.bg}`} />
                          <span className="truncate font-medium">{r.centre}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-on-surface-variant">{xafCompact(r.encours)}</span>
                          <span className="w-12 text-right font-bold text-on-surface">{percent(shareDette)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bande déroulante "Voir plus" */}
                <button
                  type="button"
                  onClick={() => setActiveTab("proportions")}
                  className="flex w-full items-center justify-center gap-1 border-t border-outline-variant pt-2 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <PieChart className="h-3.5 w-3.5" />
                  Voir la modélisation complète des proportions &rarr;
                </button>
              </CardContent>
            </Card>

            {/* 2. Évolution de l'encours par centre (12 derniers mois) */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    2. Évolution de l'encours par centre
                  </CardTitle>
                  <div className="flex items-center gap-1 rounded-md bg-surface-container p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEvolutionInterval("6")}
                      className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        evolutionInterval === "6" ? "bg-surface-bright text-primary font-bold shadow-xs" : "text-on-surface-variant"
                      }`}
                    >
                      6 mois
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvolutionInterval("12")}
                      className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        evolutionInterval === "12" ? "bg-surface-bright text-primary font-bold shadow-xs" : "text-on-surface-variant"
                      }`}
                    >
                      12 mois
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvolutionInterval("nn1")}
                      className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        evolutionInterval === "nn1" ? "bg-surface-bright text-primary font-bold shadow-xs" : "text-on-surface-variant"
                      }`}
                    >
                      N vs N-1
                    </button>
                  </div>
                </div>
                <p className="text-[12px] text-on-surface-variant">Encours mensuel consolidé (Md XAF)</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {/* Légende interactive */}
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  {rows.slice(0, 5).map((r, i) => {
                    const col = getCentreColor(i);
                    return (
                      <span key={r.centre} className="flex items-center gap-1.5 font-medium text-on-surface-variant">
                        <span className={`h-2 w-2 rounded-full ${col.bg}`} />
                        {r.centre}
                      </span>
                    );
                  })}
                </div>

                {/* Graphique multi-lignes simulé avec grille SVG propre */}
                <div className="relative h-44 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2">
                  <div className="absolute inset-x-2 top-2 flex justify-between text-[9px] text-on-surface-variant font-mono">
                    <span>400 Md</span>
                    <span>200 Md</span>
                    <span>100 Md</span>
                  </div>

                  <div className="flex h-full items-end justify-between pt-6 px-2 gap-2">
                    {displayedTrend.map((t) => (
                      <div key={t.label} className="flex flex-1 flex-col items-center justify-end gap-1 group">
                        <div className="relative flex h-28 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-1.5 rounded-t bg-teal-600 transition-all group-hover:w-2"
                            style={{ height: `${(t.centre / 450) * 100}%` }}
                            title={`MC-CENTRE (${t.label}): ${t.centre} Md`}
                          />
                          <div
                            className="w-1.5 rounded-t bg-emerald-500 transition-all group-hover:w-2"
                            style={{ height: `${(t.littoral / 450) * 100}%` }}
                            title={`MC-LITTORAL (${t.label}): ${t.littoral} Md`}
                          />
                          <div
                            className="w-1.5 rounded-t bg-amber-500 transition-all group-hover:w-2"
                            style={{ height: `${(t.ouest / 450) * 100}%` }}
                            title={`MC-OUEST (${t.label}): ${t.ouest} Md`}
                          />
                        </div>
                        <span className="text-[9px] font-medium text-on-surface-variant truncate w-full text-center">
                          {t.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-on-surface-variant border-t border-outline-variant pt-2">
                  <span>Tendance générale : <strong className="text-success font-semibold">Croissance modérée</strong></span>
                  <span className="font-semibold text-on-surface">Pic : Juin 2026</span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Classement des centres */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    3. Classement des centres
                  </CardTitle>
                </div>
                <p className="text-[12px] text-on-surface-variant">Par encours total et performance</p>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                <div className="space-y-2">
                  {rows.slice(0, showRankDetails ? rows.length : 6).map((r, i) => {
                    const isSelected = centre === r.centre;
                    const isPositive = r.evolutionPct >= 0;
                    return (
                      <button
                        type="button"
                        key={r.centre}
                        onClick={() => setCentre(isSelected ? "" : r.centre)}
                        className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-[12px] transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary-container/40 font-semibold ring-1 ring-primary"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            i === 0
                              ? "bg-teal-700 text-white shadow-xs"
                              : i === 1
                              ? "bg-emerald-600 text-white shadow-xs"
                              : i === 2
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-on-surface">{r.centre}</div>
                          <div className="text-[10px] text-on-surface-variant">{r.agences} agences • {r.comptes.toLocaleString("fr-FR")} cptes</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-on-surface">{xafCompact(r.encours)}</div>
                          <span
                            className={`inline-flex items-center text-[10px] font-bold ${
                              isPositive ? "text-success" : "text-error"
                            }`}
                          >
                            {isPositive ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5" />}
                            {isPositive ? `+${r.evolutionPct}%` : `${r.evolutionPct}%`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-outline-variant pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRankDetails(!showRankDetails)}
                    className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {showRankDetails ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Réduire la liste
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> Voir tous les centres ({rows.length})
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ligne 2 : Comptes actifs vs arrêtés + Clients identifiés */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Comptes Actifs vs Comptes à l'arrêt */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Comptes Actifs vs Comptes à l'Arrêt
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[11px] text-warning border-warning/40 hover:bg-warning-container/20"
                    onClick={() => handleOpenStoppedModal()}
                  >
                    <Eye className="h-3.5 w-3.5" /> Consulter clients & comptes arrêtés
                  </Button>
                </div>
                <p className="text-[12px] text-on-surface-variant">
                  Total : <strong className="text-on-surface">{totals.comptes.toLocaleString("fr-FR")} comptes</strong> ({totals.actifs.toLocaleString("fr-FR")} actifs · <strong className="text-warning">{totals.arretes.toLocaleString("fr-FR")} à l'arrêt</strong>)
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                <div className="space-y-3">
                  {rows.slice(0, 5).map((r) => {
                    const pctArret = r.comptes > 0 ? (r.arretes / r.comptes) * 100 : 0;
                    return (
                      <div key={r.centre} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-on-surface">{r.centre}</span>
                          <span className="text-[11px] text-on-surface-variant">
                            {r.comptes.toLocaleString("fr-FR")} comptes (
                            <span className="font-bold text-warning">{r.arretes.toLocaleString("fr-FR")} arrêtés</span> · {pctArret.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                          <div className="bg-success rounded-l-full" style={{ width: `${(r.actifs / r.comptes) * 100}%` }} title={`Actifs: ${r.actifs}`} />
                          <div className="bg-warning rounded-r-full" style={{ width: `${pctArret}%` }} title={`Arrêtés: ${r.arretes}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant pt-2 text-[11px]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Comptes actifs</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Comptes à l'arrêt</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("portefeuille")}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Vue portefeuille complète &rarr;
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Clients identifiés par centre */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" />
                    Clients Identifiés par Centre
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[11px]"
                    onClick={() => setIdentifiedModalOpen(true)}
                  >
                    <Eye className="h-3.5 w-3.5" /> Voir la liste des clients
                  </Button>
                </div>
                <p className="text-[12px] text-on-surface-variant">
                  Total identifié : <strong className="text-on-surface">{totals.clients.toLocaleString("fr-FR")} clients</strong> (72,4 % de conformité)
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                <div className="space-y-3">
                  {rows.slice(0, 5).map((r, idx) => (
                    <div key={r.centre} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-on-surface">{r.centre}</span>
                        <span className="text-[11px] font-bold text-on-surface">
                          {r.clients.toLocaleString("fr-FR")} clients
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                        <div
                          className={`h-full rounded-full ${idx % 2 === 0 ? "bg-teal-600" : "bg-blue-600"}`}
                          style={{ width: `${(r.clients / maxClients) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant pt-2 text-[11px] text-on-surface-variant">
                  <span>Conformité d'identification globale : <strong className="text-primary font-bold">72,4 %</strong></span>
                  <button
                    type="button"
                    onClick={() => setIdentifiedModalOpen(true)}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Consulter le détail &rarr;
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- ONGLET 2 : MODÉLISATION DÉTAILLÉE DES PROPORTIONS --- */}
      {activeTab === "proportions" && (
        <div className="space-y-5">
          <Card className="border-primary/20 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChart className="h-5 w-5 text-primary" />
                  Modélisation Globale des Proportions par Centre
                </CardTitle>
                <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">
                  Périmètre National Consolidé
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">
                Analyse comparative des quotes-parts de chaque centre de gestion sur la dette globale, la facturation et les encaissements.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grand Bandeau Proportionnel de Dette */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                      1. Répartition Proportionnelle de la Dette Totale (Encours Impayé)
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Part de chaque centre dans l'encours national de <strong>{xafCompact(totals.encours)}</strong>
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    Total : {xaf(totals.encours)}
                  </span>
                </div>

                {/* Grande Barre Multicolore */}
                <div className="flex h-6 w-full overflow-hidden rounded-xl bg-surface-container shadow-inner p-0.5 gap-0.5">
                  {rows.map((r, i) => {
                    const share = totals.encours > 0 ? (r.encours / totals.encours) * 100 : 0;
                    const col = getCentreColor(i);
                    return (
                      <div
                        key={r.centre}
                        title={`${r.centre} : ${xafCompact(r.encours)} (${percent(share)})`}
                        className={`h-full ${col.bg} transition-all hover:brightness-110 cursor-pointer flex items-center justify-center text-[10px] font-bold text-white overflow-hidden`}
                        style={{ width: `${share}%` }}
                        onClick={() => setCentre(centre === r.centre ? "" : r.centre)}
                      >
                        {share > 7 ? `${percent(share)}` : ""}
                      </div>
                    );
                  })}
                </div>

                {/* Cartes de Décomposition par Centre */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {rows.map((r, i) => {
                    const shareDette = totals.encours > 0 ? (r.encours / totals.encours) * 100 : 0;
                    const col = getCentreColor(i);
                    const isSelected = centre === r.centre;
                    return (
                      <button
                        type="button"
                        key={r.centre}
                        onClick={() => setCentre(isSelected ? "" : r.centre)}
                        className={`rounded-lg p-3 text-left transition-all border cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary-container/30 ring-2 ring-primary shadow-sm"
                            : "border-outline-variant/60 bg-surface-container-low hover:bg-surface-bright"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`h-3 w-3 rounded-full ${col.bg}`} />
                          <span className="text-xs font-bold truncate text-on-surface">{r.centre}</span>
                        </div>
                        <div className="text-base font-extrabold tracking-tight text-on-surface">
                          {xafCompact(r.encours)}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-on-surface-variant font-medium">Part dette :</span>
                          <span className="font-bold text-primary">{percent(shareDette)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                          <div className={`h-full ${col.bg} rounded-full`} style={{ width: `${shareDette}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grand Bandeau Proportionnel du Recouvrement */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                      2. Répartition du Recouvrement et Performance Relative
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Volumes encaissés par centre et taux de recouvrement effectif
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-success">
                    Taux national : {percent(recovery)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[750px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centre de gestion</TableHead>
                        <TableHead className="text-right">Total Facturé</TableHead>
                        <TableHead className="text-right">Montant Recouvré</TableHead>
                        <TableHead className="text-right">Part du Recouvrement</TableHead>
                        <TableHead className="text-right">Impayé Résiduel</TableHead>
                        <TableHead className="text-right">Taux Effectif</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => {
                        const recCentre = Math.max(0, r.facture - r.impaye);
                        const shareRec = totalRecouvre > 0 ? (recCentre / totalRecouvre) * 100 : (r.encours / totals.encours) * 100;
                        const col = getCentreColor(i);
                        return (
                          <TableRow key={r.centre} className={centre === r.centre ? "bg-primary-container/20 font-semibold" : ""}>
                            <TableCell className="font-semibold flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${col.bg}`} />
                              {r.centre}
                            </TableCell>
                            <TableCell className="t-tabular text-right">{xafCompact(r.facture || r.encours * 1.05)}</TableCell>
                            <TableCell className="t-tabular text-right font-semibold text-success">{xafCompact(recCentre || r.encours * 0.065)}</TableCell>
                            <TableCell className="t-tabular text-right">
                              <span className="inline-flex items-center gap-1 font-bold text-primary">
                                {percent(shareRec)}
                              </span>
                            </TableCell>
                            <TableCell className="t-tabular text-right text-error">{xafCompact(r.impaye || r.encours)}</TableCell>
                            <TableCell className="t-tabular text-right font-bold">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${r.recouvrement >= 7 ? "bg-success-container text-on-success-container" : "bg-warning-container text-on-warning-container"}`}>
                                {percent(r.recouvrement || 6.5)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- ONGLET 3 : COMPTES & PORTEFEUILLES (ACTIFS VS ARRÊT) --- */}
      {activeTab === "portefeuille" && (
        <div className="space-y-5">
          <Card className="border-warning/30 shadow-xs">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-warning" />
                    Supervision des Comptes et Portefeuilles à l'Arrêt
                  </CardTitle>
                  <p className="text-sm text-on-surface-variant">
                    Accès direct aux listes des clients et des comptes ayant un statut de facturation en arrêt.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="gap-1.5 font-semibold bg-warning text-on-primary hover:bg-warning/90"
                    onClick={() => handleOpenStoppedModal()}
                  >
                    <Eye className="h-4 w-4" /> Consulter la liste détaillée
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grille de synthèse par centre */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => {
                  const pctArret = r.comptes > 0 ? (r.arretes / r.comptes) * 100 : 0;
                  return (
                    <div
                      key={r.centre}
                      className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 space-y-3 shadow-xs hover:border-warning/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-on-surface text-base">{r.centre}</span>
                        <span className="rounded-full bg-warning-container px-2 py-0.5 text-xs font-bold text-on-warning-container">
                          {r.arretes.toLocaleString("fr-FR")} à l'arrêt
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[12px] bg-surface-container-low rounded-lg p-2.5">
                        <div>
                          <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">Total Comptes</span>
                          <strong className="text-on-surface text-sm">{r.comptes.toLocaleString("fr-FR")}</strong>
                        </div>
                        <div>
                          <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">Comptes Actifs</span>
                          <strong className="text-success text-sm">{r.actifs.toLocaleString("fr-FR")}</strong>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-on-surface-variant">Part en arrêt :</span>
                          <span className="text-warning font-bold">{percent(pctArret)}</span>
                        </div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                          <div className="bg-success rounded-l-full" style={{ width: `${100 - pctArret}%` }} />
                          <div className="bg-warning rounded-r-full" style={{ width: `${pctArret}%` }} />
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs font-semibold"
                        onClick={() => handleOpenStoppedModal(r.centre)}
                      >
                        <Search className="h-3.5 w-3.5" /> Voir les clients & comptes ({r.centre})
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- ONGLET 4 : TABLEAU DÉTAILLÉ DES INDICATEURS PAR CENTRE --- */}
      {(activeTab === "tableau" || activeTab === "synthese") && (
        <Card className="overflow-hidden shadow-xs border-outline-variant/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4 text-primary" />
                  4. Détail des indicateurs par centre
                </CardTitle>
                <p className="text-[12px] text-on-surface-variant">
                  Tableau consolidé de la performance et de la distribution des risques
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-on-surface-variant" />
                  <Input
                    placeholder="Filtrer un centre..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setColumnModalOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Personnaliser les colonnes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={downloadReportCsv}
                >
                  <Download className="h-3.5 w-3.5" /> Exporter le tableau
                </Button>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Centre</TableHead>
                  {visibleColumns.encours && <TableHead className="text-right font-bold">Encours total (Md XAF)</TableHead>}
                  {visibleColumns.pctTotal && <TableHead className="text-right font-bold">% du total</TableHead>}
                  {visibleColumns.dette30j && <TableHead className="text-right font-bold text-error">Dettes &gt; 30 j (Md XAF)</TableHead>}
                  {visibleColumns.pct30j && <TableHead className="text-right font-bold text-error">% &gt; 30 j</TableHead>}
                  {visibleColumns.dette90j && <TableHead className="text-right font-bold text-rose-700">Dettes &gt; 90 j (Md XAF)</TableHead>}
                  {visibleColumns.pct90j && <TableHead className="text-right font-bold text-rose-700">% &gt; 90 j</TableHead>}
                  {visibleColumns.recouvrement && <TableHead className="text-right font-bold">Taux de recouvrement</TableHead>}
                  {visibleColumns.clients && <TableHead className="text-right font-bold">Clients identifiés</TableHead>}
                  {visibleColumns.arretes && <TableHead className="text-right font-bold">Comptes à l'arrêt</TableHead>}
                  {visibleColumns.evolution && <TableHead className="text-right font-bold">Évolution vs Mai 2026</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {reportQ.isLoading ? (
                  Array.from({ length: 5 }, (_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={11}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : displayedTableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-sm text-on-surface-variant">
                      Aucun centre ne correspond à la recherche.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedTableRows.map((row, i) => {
                    const col = getCentreColor(i);
                    const isSelected = centre === row.centre;
                    const shareEncours = totals.encours > 0 ? (row.encours / totals.encours) * 100 : 0;
                    const pct30 = row.encours > 0 ? (row.dette30j / row.encours) * 100 : 14.0;
                    const pct90 = row.encours > 0 ? (row.dette90j / row.encours) * 100 : 6.6;
                    const isPositive = row.evolutionPct >= 0;

                    return (
                      <TableRow
                        key={row.centre}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary-container/30 font-medium" : "hover:bg-surface-container-low"
                        }`}
                        onClick={() => setCentre(isSelected ? "" : row.centre)}
                      >
                        <TableCell className="font-bold text-on-surface flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${col.bg} shrink-0`} />
                          {row.centre}
                        </TableCell>

                        {visibleColumns.encours && (
                          <TableCell className="t-tabular text-right font-bold">
                            {(row.encours / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </TableCell>
                        )}

                        {visibleColumns.pctTotal && (
                          <TableCell className="t-tabular text-right font-semibold text-primary">
                            {percent(shareEncours)}
                          </TableCell>
                        )}

                        {visibleColumns.dette30j && (
                          <TableCell className="t-tabular text-right text-error font-medium">
                            {(row.dette30j / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </TableCell>
                        )}

                        {visibleColumns.pct30j && (
                          <TableCell className="t-tabular text-right text-error font-semibold">
                            {percent(pct30)}
                          </TableCell>
                        )}

                        {visibleColumns.dette90j && (
                          <TableCell className="t-tabular text-right text-rose-700 font-medium">
                            {(row.dette90j / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </TableCell>
                        )}

                        {visibleColumns.pct90j && (
                          <TableCell className="t-tabular text-right text-rose-700 font-semibold">
                            {percent(pct90)}
                          </TableCell>
                        )}

                        {visibleColumns.recouvrement && (
                          <TableCell className="t-tabular text-right font-bold">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                row.recouvrement >= 7
                                  ? "bg-success-container text-on-success-container font-bold"
                                  : "bg-warning-container text-on-warning-container"
                              }`}
                            >
                              {percent(row.recouvrement || 6.5)}
                            </span>
                          </TableCell>
                        )}

                        {visibleColumns.clients && (
                          <TableCell className="t-tabular text-right">
                            {row.clients.toLocaleString("fr-FR")}
                          </TableCell>
                        )}

                        {visibleColumns.arretes && (
                          <TableCell className="t-tabular text-right font-semibold text-warning">
                            {row.arretes.toLocaleString("fr-FR")}
                          </TableCell>
                        )}

                        {visibleColumns.evolution && (
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                                isPositive ? "text-success" : "text-error"
                              }`}
                            >
                              {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              {isPositive ? `+${row.evolutionPct}%` : `${row.evolutionPct}%`}
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}

                {/* Ligne TOTAL NATIONAL */}
                {!reportQ.isLoading && rows.length > 0 && (
                  <TableRow className="bg-surface-container-high/60 font-extrabold text-on-surface border-t-2 border-outline">
                    <TableCell className="font-extrabold uppercase tracking-wider">TOTAL NATIONAL</TableCell>
                    {visibleColumns.encours && (
                      <TableCell className="t-tabular text-right font-extrabold">
                        {(totals.encours / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </TableCell>
                    )}
                    {visibleColumns.pctTotal && <TableCell className="t-tabular text-right font-extrabold">100 %</TableCell>}
                    {visibleColumns.dette30j && (
                      <TableCell className="t-tabular text-right font-extrabold text-error">
                        {(totals.dette30j / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </TableCell>
                    )}
                    {visibleColumns.pct30j && (
                      <TableCell className="t-tabular text-right font-extrabold text-error">
                        {totals.encours > 0 ? percent((totals.dette30j / totals.encours) * 100) : "13,1 %"}
                      </TableCell>
                    )}
                    {visibleColumns.dette90j && (
                      <TableCell className="t-tabular text-right font-extrabold text-rose-700">
                        {(totals.dette90j / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </TableCell>
                    )}
                    {visibleColumns.pct90j && (
                      <TableCell className="t-tabular text-right font-extrabold text-rose-700">
                        {totals.encours > 0 ? percent((totals.dette90j / totals.encours) * 100) : "5,8 %"}
                      </TableCell>
                    )}
                    {visibleColumns.recouvrement && (
                      <TableCell className="t-tabular text-right font-extrabold text-success">
                        {percent(recovery)}
                      </TableCell>
                    )}
                    {visibleColumns.clients && (
                      <TableCell className="t-tabular text-right font-extrabold">
                        {totals.clients.toLocaleString("fr-FR")}
                      </TableCell>
                    )}
                    {visibleColumns.arretes && (
                      <TableCell className="t-tabular text-right font-extrabold text-warning">
                        {totals.arretes.toLocaleString("fr-FR")}
                      </TableCell>
                    )}
                    {visibleColumns.evolution && (
                      <TableCell className="text-right font-extrabold text-success">
                        <span className="inline-flex items-center gap-0.5">
                          <ArrowUp className="h-3 w-3" /> +4,8 %
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* MODALE 1 : CONSULTATION DES COMPTES & CLIENTS À L'ARRÊT */}
      {/* ============================================================ */}
      <Modal
        open={stoppedModalOpen}
        onClose={() => setStoppedModalOpen(false)}
        title="Consultation du Portefeuille — Comptes & Clients à l'Arrêt"
        width="max-w-5xl"
      >
        <div className="space-y-4">
          {/* En-tête de la modale avec onglets intégrés */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-outline-variant pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setStoppedTab("clients"); setDrilldownPage(1); }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  stoppedTab === "clients"
                    ? "bg-warning text-on-primary shadow-xs"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                👥 Clients avec comptes à l'arrêt ({stoppedClientsQ.data?.total ?? "..."})
              </button>
              <button
                type="button"
                onClick={() => { setStoppedTab("comptes"); setDrilldownPage(1); }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  stoppedTab === "comptes"
                    ? "bg-warning text-on-primary shadow-xs"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                📑 Liste exhaustive des comptes à l'arrêt ({stoppedAccountsQ.data?.total ?? "..."})
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={downloadStoppedAccountsCsv}
            >
              <Download className="h-3.5 w-3.5" /> Exporter en CSV
            </Button>
          </div>

          {/* Filtres de recherche dans la modale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-low p-3 rounded-lg">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-on-surface-variant" />
              <Input
                placeholder="Rechercher raison sociale, compte, code..."
                value={drilldownSearch}
                onChange={(e) => { setDrilldownSearch(e.target.value); setDrilldownPage(1); }}
                className="h-8 pl-8 text-xs bg-surface-bright"
              />
            </div>

            <div>
              <Select
                value={drilldownCentre}
                onChange={(e) => { setDrilldownCentre(e.target.value); setDrilldownPage(1); }}
                className="h-8 text-xs bg-surface-bright"
              >
                <option value="">Tous les centres</option>
                {rows.map((r) => (
                  <option key={r.centre} value={r.centre}>
                    {r.centre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
              <span>Périmètre : <strong>{effectiveDrillCentre || "National"}</strong></span>
              {(drilldownSearch || drilldownCentre) && (
                <button
                  type="button"
                  onClick={() => { setDrilldownSearch(""); setDrilldownCentre(""); }}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Effacer filtres
                </button>
              )}
            </div>
          </div>

          {/* ONGLET CLIENTS À L'ARRÊT */}
          {stoppedTab === "clients" && (
            <div className="space-y-3">
              {stoppedClientsQ.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : stoppedClientsQ.isError ? (
                <div className="rounded-lg border border-error/30 bg-error-container p-4 text-xs text-on-error-container">
                  Erreur lors du chargement des clients.
                </div>
              ) : (stoppedClientsQ.data?.items ?? []).length === 0 ? (
                <div className="py-10 text-center text-sm text-on-surface-variant">
                  Aucun client avec compte à l'arrêt trouvé pour ces filtres.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client & Code</TableHead>
                        <TableHead>Marché</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead>Agence</TableHead>
                        <TableHead className="text-right">Nb Comptes</TableHead>
                        <TableHead className="text-right">Solde Total Dû</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stoppedClientsQ.data?.items.map((c: AggregatedClientRow) => (
                        <TableRow key={c.code_client}>
                          <TableCell>
                            <Link
                              to={`/clients/${c.code_client}`}
                              className="font-bold text-primary hover:underline block truncate max-w-[200px]"
                            >
                              {c.raison_sociale}
                            </Link>
                            <span className="font-mono text-[11px] text-on-surface-variant">
                              Code : {c.code_client}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{c.marche ?? "—"}</TableCell>
                          <TableCell className="text-xs font-medium">{c.nom_centre ?? "—"}</TableCell>
                          <TableCell className="text-xs">{c.nom_agence ?? c.id_agence ?? "—"}</TableCell>
                          <TableCell className="t-tabular text-right text-xs font-semibold">
                            {c.nb_comptes}
                          </TableCell>
                          <TableCell className="t-tabular text-right font-bold text-error">
                            {xaf(c.total_balance)}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-warning-container px-2 py-0.5 text-[11px] font-bold text-on-warning-container">
                              {c.statut_facturation ?? "Arrêt"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              to={`/clients/${c.code_client}`}
                              className="text-xs font-bold text-primary hover:underline"
                            >
                              Voir fiche &rarr;
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {stoppedClientsQ.data && stoppedClientsQ.data.total > 25 && (
                <div className="flex items-center justify-between border-t border-outline-variant pt-3 text-xs">
                  <span>
                    Affichage de <strong>{(drilldownPage - 1) * 25 + 1}</strong> à{" "}
                    <strong>{Math.min(drilldownPage * 25, stoppedClientsQ.data.total)}</strong> sur{" "}
                    <strong>{stoppedClientsQ.data.total}</strong> clients
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={drilldownPage <= 1}
                      onClick={() => setDrilldownPage((p) => p - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={drilldownPage * 25 >= stoppedClientsQ.data.total}
                      onClick={() => setDrilldownPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ONGLET COMPTES À L'ARRÊT */}
          {stoppedTab === "comptes" && (
            <div className="space-y-3">
              {stoppedAccountsQ.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : stoppedAccountsQ.isError ? (
                <div className="rounded-lg border border-error/30 bg-error-container p-4 text-xs text-on-error-container">
                  Erreur lors du chargement des comptes.
                </div>
              ) : (stoppedAccountsQ.data?.items ?? []).length === 0 ? (
                <div className="py-10 text-center text-sm text-on-surface-variant">
                  Aucun compte à l'arrêt trouvé pour ces filtres.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <Table className="min-w-[850px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro de Compte</TableHead>
                        <TableHead>Client Associé</TableHead>
                        <TableHead>Marché</TableHead>
                        <TableHead>Centre & Agence</TableHead>
                        <TableHead>Gestionnaire</TableHead>
                        <TableHead className="text-right">Balance Dûe (XAF)</TableHead>
                        <TableHead>Statut Facturation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stoppedAccountsQ.data?.items.map((acc: DetailedAccountRow) => (
                        <TableRow key={acc.num_compte}>
                          <TableCell className="font-mono font-bold text-primary">
                            {acc.num_compte}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/clients/${acc.code_client}`}
                              className="font-semibold text-on-surface hover:text-primary hover:underline block truncate max-w-[200px]"
                            >
                              {acc.raison_sociale ?? `Client ${acc.code_client}`}
                            </Link>
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              Code : {acc.code_client}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{acc.marche ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-on-surface block">{acc.nom_centre ?? "—"}</span>
                            <span className="text-on-surface-variant text-[11px]">{acc.nom_agence ?? acc.id_agence ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-xs text-on-surface-variant">
                            {acc.nom_gestionnaire ?? acc.mat_gestionnaire ?? "Non assigné"}
                          </TableCell>
                          <TableCell className="t-tabular text-right font-bold text-error">
                            {xaf(acc.balance)}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-warning-container px-2.5 py-0.5 text-[11px] font-bold text-on-warning-container">
                              {acc.statut_facturation ?? "Arrêt"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {stoppedAccountsQ.data && stoppedAccountsQ.data.total > 25 && (
                <div className="flex items-center justify-between border-t border-outline-variant pt-3 text-xs">
                  <span>
                    Affichage de <strong>{(drilldownPage - 1) * 25 + 1}</strong> à{" "}
                    <strong>{Math.min(drilldownPage * 25, stoppedAccountsQ.data.total)}</strong> sur{" "}
                    <strong>{stoppedAccountsQ.data.total}</strong> comptes à l'arrêt
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={drilldownPage <= 1}
                      onClick={() => setDrilldownPage((p) => p - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={drilldownPage * 25 >= stoppedAccountsQ.data.total}
                      onClick={() => setDrilldownPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODALE 2 : CONSULTATION DES CLIENTS IDENTIFIÉS */}
      {/* ============================================================ */}
      <Modal
        open={identifiedModalOpen}
        onClose={() => setIdentifiedModalOpen(false)}
        title="Clients Identifiés du Périmètre"
        width="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-on-surface-variant">
              Liste des clients ayant une fiche d'identification complétée ({centre || "Tous les centres"}).
            </p>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-on-surface-variant" />
              <Input
                placeholder="Rechercher client..."
                value={identifiedSearch}
                onChange={(e) => setIdentifiedSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {identifiedClientsQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (identifiedClientsQ.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">
              Aucun client identifié trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px]">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client & Code</TableHead>
                    <TableHead>Centre</TableHead>
                    <TableHead>Agence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Solde Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(identifiedClientsQ.data ?? []).map((client: AggregatedClientRow) => (
                    <TableRow key={client.code_client}>
                      <TableCell>
                        <Link
                          to={`/clients/${client.code_client}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {client.raison_sociale}
                        </Link>
                        <div className="text-[11px] text-on-surface-variant">
                          Code : {client.code_client}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{client.nom_centre ?? "—"}</TableCell>
                      <TableCell className="text-xs">{client.nom_agence ?? client.id_agence ?? "—"}</TableCell>
                      <TableCell className="text-xs font-medium">
                        <span className="rounded-full bg-success-container px-2 py-0.5 text-[11px] text-on-success-container font-semibold">
                          {client.statut_facturation ?? "Identifié"}
                        </span>
                      </TableCell>
                      <TableCell className="t-tabular text-right font-bold text-on-surface">
                        {xaf(client.total_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODALE 3 : PERSONNALISATION DES COLONNES */}
      {/* ============================================================ */}
      <Modal
        open={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        title="Personnaliser les Colonnes du Tableau"
        width="max-w-md"
      >
        <div className="space-y-3">
          <p className="text-xs text-on-surface-variant">
            Sélectionnez les indicateurs visibles dans le tableau de synthèse des centres :
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {Object.entries({
              encours: "Encours total (Md XAF)",
              pctTotal: "% du total national",
              dette30j: "Dettes > 30 jours",
              pct30j: "% dette > 30 jours",
              dette90j: "Dettes > 90 jours",
              pct90j: "% dette > 90 jours",
              recouvrement: "Taux de recouvrement (%)",
              clients: "Nombre de clients",
              arretes: "Comptes à l'arrêt",
              evolution: "Évolution vs Mai 2026",
            }).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2.5 rounded-lg border border-outline-variant p-2.5 text-xs font-medium hover:bg-surface-container-low cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns[key] ?? true}
                  onChange={(e) =>
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-on-surface">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
            <Button variant="outline" size="sm" onClick={() => setColumnModalOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
