import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUp, BarChart3,
  Building2, CalendarDays, ChevronDown, ChevronUp, Download,
  Filter, Gauge, RotateCcw, Target, TrendingUp, Users
} from "lucide-react";
import { getAvailableMonths, getCentresAgencesReport, listClientsAggregated } from "@/api/client";
import type { AggregatedClientRow } from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { OrgCascadeFilters } from "@/components/filters/org-cascade-filters";
import { Pagination } from "@/components/ui/pagination";
import { xaf, xafCompact } from "@/lib/format";
import { DonutChart } from "@/components/charts/donut-chart";
import { ProgressBar } from "@/components/charts/progress-bar";
import { EnhancedKpi } from "@/components/widgets/enhanced-kpi";
import { FilterChip } from "@/components/widgets/filter-chip";

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
};

type ClientListMode = "identified" | "stopped";

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
    const current = groups.get(rowCentre) ?? {
      centre: rowCentre,
      agences: 0, clients: 0, comptes: 0, actifs: 0, arretes: 0,
      encours: 0, facture: 0, impaye: 0, gestionnaires: 0, recouvrement: 0
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
    .map((row) => ({
      ...row,
      recouvrement: row.facture > 0 ? ((row.facture - row.impaye) / row.facture) * 100 : 0
    }))
    .sort((a, b) => b.encours - a.encours);
}

function percent(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function downloadCsv(rows: CentreRow[]) {
  const header = ["Centre", "Agences", "Clients", "Comptes", "Comptes actifs", "Comptes arretes", "Encours XAF", "Facture XAF", "Impayes XAF", "Taux recouvrement"].join(";");
  const body = rows.map((row) =>
    [row.centre, row.agences, row.clients, row.comptes, row.actifs, row.arretes, Math.round(row.encours), Math.round(row.facture), Math.round(row.impaye), row.recouvrement.toFixed(2)].join(";")
  );
  const blob = new Blob(["\ufeff" + [header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "performance-centres.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function CentresPage() {
  const reportQ = useQuery({ queryKey: ["report", "centres-agences"], queryFn: getCentresAgencesReport });
  const monthsQ = useQuery({ queryKey: ["available-months"], queryFn: getAvailableMonths, staleTime: 600_000 });
  
  const [period, setPeriod] = useState("");
  const [comparison, setComparison] = useState("");
  const [centre, setCentre] = useState("");
  const [agency, setAgency] = useState("");
  const [clientMode, setClientMode] = useState<ClientListMode | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [sortKey, setSortKey] = useState<"centre" | "encours" | "recouvrement" | "clients" | "arretes">("encours");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  
  const PAGE_SIZE = 10;
  
  const months = monthsQ.data ?? [];
  const rows = useMemo(() => aggregateRows(reportQ.data ?? [], centre, agency), [reportQ.data, centre, agency]);
  
  const totals = useMemo(() =>
    rows.reduce((sum, row) => ({
      agences: sum.agences + row.agences,
      clients: sum.clients + row.clients,
      comptes: sum.comptes + row.comptes,
      actifs: sum.actifs + row.actifs,
      arretes: sum.arretes + row.arretes,
      encours: sum.encours + row.encours,
      facture: sum.facture + row.facture,
      impaye: sum.impaye + row.impaye,
      gestionnaires: sum.gestionnaires + row.gestionnaires,
    }), { agences: 0, clients: 0, comptes: 0, actifs: 0, arretes: 0, encours: 0, facture: 0, impaye: 0, gestionnaires: 0 }),
  [rows]);
  
  const recovery = totals.facture > 0 ? ((totals.facture - totals.impaye) / totals.facture) * 100 : 0;
  const stopRate = totals.comptes > 0 ? (totals.arretes / totals.comptes) * 100 : 0;
  
  // Seuils dynamiques basés sur les données
  const dynamicThresholds = useMemo(() => {
    if (rows.length === 0) return { encours: { low: 0, medium: 0, high: 0 }, recovery: { low: 0, medium: 0, high: 0 }, stopRate: { low: 0, medium: 0, high: 0 } };
    
    const sortedEncours = [...rows].map(r => r.encours).sort((a, b) => a - b);
    const sortedRecovery = [...rows].map(r => r.recouvrement).sort((a, b) => a - b);
    const sortedStopRate = rows.map(r => totals.comptes > 0 ? (r.arretes / r.comptes) * 100 : 0).sort((a, b) => a - b);
    
    const getPercentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = (p / 100) * (arr.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return arr[lower];
      return arr[lower] + (arr[upper] - arr[lower]) * (index - lower);
    };
    
    return {
      encours: {
        low: getPercentile(sortedEncours, 33),
        medium: getPercentile(sortedEncours, 66),
        high: getPercentile(sortedEncours, 100),
      },
      recovery: {
        low: getPercentile(sortedRecovery, 33),
        medium: getPercentile(sortedRecovery, 66),
        high: getPercentile(sortedRecovery, 100),
      },
      stopRate: {
        low: getPercentile(sortedStopRate, 33),
        medium: getPercentile(sortedStopRate, 66),
        high: getPercentile(sortedStopRate, 100),
      },
    };
  }, [rows, totals.comptes]);
  
  const maxClients = Math.max(...rows.map((row) => row.clients), 1);
  const maxComptes = Math.max(...rows.map((row) => row.comptes), 1);
  
  // Tri des données
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case "centre":
          return sortDir === "asc" ? a.centre.localeCompare(b.centre) : b.centre.localeCompare(a.centre);
        case "encours":
          aVal = a.encours; bVal = b.encours; break;
        case "recouvrement":
          aVal = a.recouvrement; bVal = b.recouvrement; break;
        case "clients":
          aVal = a.clients; bVal = b.clients; break;
        case "arretes":
          aVal = a.arretes; bVal = b.arretes; break;
        default:
          aVal = a.encours; bVal = b.encours;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [rows, sortKey, sortDir]);
  
  const paginatedRows = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, tablePage]);
  
  // Filtres actifs
  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; value: string; onRemove: () => void }> = [];
    if (period) filters.push({ label: "Période", value: period, onRemove: () => setPeriod("") });
    if (comparison) filters.push({ label: "Comparaison", value: comparison, onRemove: () => setComparison("") });
    if (centre) filters.push({ label: "Centre", value: centre, onRemove: () => setCentre("") });
    if (agency) filters.push({ label: "Agence", value: agency, onRemove: () => setAgency("") });
    return filters;
  }, [period, comparison, centre, agency]);
  
  // Données pour graphiques
  const donutData = useMemo(() => {
    const top5 = rows.slice(0, 5);
    const totalTop5 = top5.reduce((sum, r) => sum + r.encours, 0);
    const others = totals.encours - totalTop5;
    
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    const data = top5.map((row, i) => ({
      label: row.centre.replace("MC-", ""),
      value: row.encours,
      color: colors[i % colors.length],
    }));
    if (others > 0) data.push({ label: "Autres", value: others, color: "#9ca3af" });
    return data;
  }, [rows, totals.encours]);
  
  // Sparklines pour les KPIs (simulation basée sur les données)
  const sparklineEncours = useMemo(() => {
    return rows.slice(0, 8).map(r => r.encours / 1_000_000);
  }, [rows]);
  
  const sparklineRecovery = useMemo(() => {
    return rows.slice(0, 8).map(r => r.recouvrement);
  }, [rows]);
  
  const sparklineStopRate = useMemo(() => {
    return rows.slice(0, 8).map(r => totals.comptes > 0 ? (r.arretes / r.comptes) * 100 : 0);
  }, [rows, totals.comptes]);
  
  // Top performers et watchlist
  const topPerformers = useMemo(() => {
    return [...rows].sort((a, b) => b.recouvrement - a.recouvrement).slice(0, 5);
  }, [rows]);
  
  const topRisk = useMemo(() => {
    return [...rows]
      .filter(r => r.recouvrement < dynamicThresholds.recovery.low)
      .sort((a, b) => a.recouvrement - b.recouvrement)
      .slice(0, 5);
  }, [rows, dynamicThresholds]);
  
  const clientFilters = { center: centre, agency, statut_facturation: clientMode === "stopped" ? "Arrêt" : undefined };
  const clientsQ = useQuery({
    queryKey: ["centre-client-drilldown", clientMode, centre, agency],
    queryFn: async () => {
      const allClients: AggregatedClientRow[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await listClientsAggregated(clientFilters, page, 200);
        allClients.push(...result.items);
        total = result.total;
        page += 1;
        if (result.items.length === 0) break;
      } while (allClients.length < total);
      return { total: allClients.length, items: allClients };
    },
    enabled: clientMode !== null,
  });
  const clients = (clientsQ.data?.items ?? []).filter((client) => clientMode !== "identified" || Boolean(client.identification?.trim()));
  
  function resetFilters() {
    setPeriod("");
    setComparison("");
    setCentre("");
    setAgency("");
    setClientMode(null);
    setTablePage(1);
  }
  
  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setTablePage(1);
  }
  
  function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant/40" />;
    return dir === "asc"
      ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  }
  
  const isLoading = reportQ.isLoading;
  
  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <PageHeader
        title="Performance — Centres"
        subtitle="Comparez les centres de gestion et consultez les portefeuilles réels."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="transition-all duration-200 hover:scale-[1.02]"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Réinitialiser
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadCsv(rows)}
              disabled={!rows.length}
              className="transition-all duration-200 hover:scale-[1.02]"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Exporter
            </Button>
          </div>
        }
      />
      
      {/* Filtres actifs */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-on-surface-variant">Filtres actifs :</span>
          {activeFilters.map((filter, index) => (
            <FilterChip
              key={`${filter.label}-${index}`}
              label={filter.label}
              value={filter.value}
              onRemove={filter.onRemove}
            />
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-2 text-[12px] text-primary hover:underline"
          >
            Tout effacer
          </button>
        </div>
      )}
      
      {/* Zone de filtres */}
      <Card className="overflow-hidden border-opacity-50 bg-gradient-to-br from-surface to-surface-container-low transition-all duration-300 hover:shadow-md hover:shadow-black/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filtres
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Période */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                Période de référence
              </label>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Dernier mois disponible</option>
                {months.map((month) => (
                  <option key={String(month.value)} value={String(month.label ?? month.value)}>
                    {String(month.label ?? month.value)}
                  </option>
                ))}
              </Select>
            </div>
            
            {/* Comparaison */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                Comparer avec
              </label>
              <Select
                value={comparison}
                onChange={(e) => setComparison(e.target.value)}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Aucune comparaison</option>
                {months.map((month) => (
                  <option key={String(month.value)} value={String(month.label ?? month.value)}>
                    {String(month.label ?? month.value)}
                  </option>
                ))}
              </Select>
            </div>
            
            {/* Centre et Agence via OrgCascadeFilters */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                Centre / Agence
              </label>
              <OrgCascadeFilters
                value={{ centre, agence: agency }}
                onChange={({ centre: nextCentre, agence: nextAgency }) => {
                  setCentre(nextCentre);
                  setAgency(nextAgency);
                }}
                centreClassName=""
                agenceClassName=""
              />
            </div>
            
            {/* Boutons d'action */}
            <div className="flex items-end gap-2">
              <Button
                onClick={() => setTablePage(1)}
                className="flex-1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Filter className="mr-1.5 h-4 w-4" />
                Appliquer
              </Button>
            </div>
          </div>
          
          {/* Indicateur de données */}
          <div className="flex items-center justify-between border-t border-outline-variant/50 pt-3 text-[12px]">
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <CalendarDays className="h-3.5 w-3.5" />
              Données consolidées au {period || "dernier mois disponible"}
            </span>
            <span className="flex items-center gap-1.5 text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              {rows.length} centre{rows.length !== 1 ? "s" : ""} · {totals.agences} agence{totals.agences !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Message d'erreur */}
      {reportQ.isError && (
        <div className="flex items-center gap-3 rounded-panel border border-error/30 bg-error-container/80 p-4 text-[13px] text-on-error-container shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Impossible de charger la performance des centres</p>
            <p className="mt-0.5 text-[12px] opacity-80">Vérifiez votre connexion ou réessayez plus tard.</p>
          </div>
        </div>
      )}
      
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </Card>
          ))
        ) : (
          <>
            <EnhancedKpi
              label="Encours total"
              value={xafCompact(totals.encours)}
              icon={Gauge}
              sparklineData={sparklineEncours}
              tone={totals.encours > dynamicThresholds.encours.medium ? "warning" : "default"}
              accentColor="var(--color-primary)"
            />
            <EnhancedKpi
              label="Dette échue > 30j"
              value={xafCompact(totals.impaye)}
              icon={AlertTriangle}
              tone="error"
              accentColor="var(--color-error)"
            />
            <button type="button" onClick={() => setClientMode("identified")} className="text-left">
              <EnhancedKpi
                label="Clients identifiés"
                value={totals.clients.toLocaleString("fr-FR")}
                icon={Users}
                tone="default"
                accentColor="var(--color-info)"
              />
            </button>
            <button type="button" onClick={() => setClientMode("stopped")} className="text-left">
              <EnhancedKpi
                label="Comptes à l'arrêt"
                value={totals.arretes.toLocaleString("fr-FR")}
                icon={Activity}
                sparklineData={sparklineStopRate}
                tone={stopRate > dynamicThresholds.stopRate.medium ? "warning" : "default"}
                accentColor="var(--color-warning)"
              />
            </button>
            <EnhancedKpi
              label="Taux de recouvrement"
              value={percent(recovery)}
              icon={Target}
              sparklineData={sparklineRecovery}
              tone={recovery >= 60 ? "success" : recovery >= 40 ? "warning" : "error"}
              accentColor={recovery >= 60 ? "var(--color-success)" : recovery >= 40 ? "var(--color-warning)" : "var(--color-error)"}
            />
          </>
        )}
      </div>
      
      {/* Grille principale : graphiques */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* Tableau principal */}
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low/50 py-4 px-5">
            <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-on-surface">
              <BarChart3 className="h-5 w-5 text-primary" />
              Détail des centres
            </CardTitle>
            <span className="text-[12px] text-on-surface-variant">
              {sortedRows.length} centre{sortedRows.length !== 1 ? "s" : ""}
            </span>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[1100px]">
                <TableHeader className="sticky top-0 z-10 bg-surface-container-low">
                  <TableRow className="border-b border-outline-variant/50">
                    <TableHead
                      onClick={() => handleSort("centre")}
                      className="cursor-pointer bg-surface-container-low transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center gap-1">
                        Centre
                        <SortIcon active={sortKey === "centre"} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-right bg-surface-container-low">
                      Agences
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("encours")}
                      className="cursor-pointer text-right bg-surface-container-low transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Encours total
                        <SortIcon active={sortKey === "encours"} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-right bg-surface-container-low">
                      % du total
                    </TableHead>
                    <TableHead className="text-right bg-surface-container-low">
                      Dette impayée
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("recouvrement")}
                      className="cursor-pointer text-right bg-surface-container-low transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Taux récup.
                        <SortIcon active={sortKey === "recouvrement"} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("clients")}
                      className="cursor-pointer text-right bg-surface-container-low transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Clients
                        <SortIcon active={sortKey === "clients"} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("arretes")}
                      className="cursor-pointer text-right bg-surface-container-low transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Arrêts
                        <SortIcon active={sortKey === "arretes"} dir={sortDir} />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-10" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-5 w-12" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="text-on-surface-variant">
                          <BarChart3 className="mx-auto mb-2 h-10 w-10 opacity-30" />
                          <p className="text-[14px]">Aucun centre trouvé</p>
                          <p className="mt-1 text-[12px]">Essayez de modifier vos filtres</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const percentOfTotal = totals.encours > 0 ? (row.encours / totals.encours) * 100 : 0;
                      const isTop = idx < 3;
                      const isRisk = row.recouvrement < dynamicThresholds.recovery.low;
                      
                      return (
                        <TableRow
                          key={row.centre}
                          className={`
                            transition-all duration-150
                            ${isTop ? "bg-primary-container/10" : ""}
                            ${isRisk ? "bg-error-container/10" : ""}
                            hover:bg-surface-container-low
                          `}
                        >
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setCentre(centre === row.centre ? "" : row.centre)}
                              className={`
                                flex items-center gap-2 font-semibold transition-colors
                                ${centre === row.centre ? "text-primary" : "text-on-surface hover:text-primary"}
                              `}
                            >
                              <Building2 className="h-4 w-4 text-primary/60" />
                              {row.centre}
                            </button>
                          </TableCell>
                          <TableCell className="text-right text-[13px] t-tabular text-on-surface-variant">
                            {row.agences}
                          </TableCell>
                          <TableCell className="text-right text-[13px] font-semibold t-tabular">
                            {xafCompact(row.encours)}
                          </TableCell>
                          <TableCell className="text-right text-[12px] t-tabular text-on-surface-variant">
                            {percent(percentOfTotal)}
                          </TableCell>
                          <TableCell className="text-right text-[13px] t-tabular text-error">
                            {xafCompact(row.impaye)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <ProgressBar
                                value={row.recouvrement}
                                max={100}
                                color={row.recouvrement >= 60 ? "#10b981" : row.recouvrement >= 40 ? "#f59e0b" : "#ef4444"}
                                size="sm"
                              />
                              <span className={`
                                min-w-[48px] text-right text-[12px] font-medium t-tabular
                                ${row.recouvrement >= 60 ? "text-success" : row.recouvrement >= 40 ? "text-warning" : "text-error"}
                              `}>
                                {percent(row.recouvrement)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-[13px] t-tabular">
                            {row.clients.toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[13px] t-tabular">{row.arretes.toLocaleString("fr-FR")}</span>
                              {row.comptes > 0 && (
                                <span className={`
                                  rounded-full px-1.5 py-0.5 text-[10px] font-medium
                                  ${(row.arretes / row.comptes) * 100 > dynamicThresholds.stopRate.medium ? "bg-warning/20 text-warning" : "bg-surface-container text-on-surface-variant"}
                                `}>
                                  {percent((row.arretes / row.comptes) * 100)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {!isLoading && sortedRows.length > PAGE_SIZE && (
              <div className="border-t border-outline-variant/50 bg-surface-container-low/50 px-4 py-3">
                <Pagination
                  page={tablePage}
                  pageSize={PAGE_SIZE}
                  total={sortedRows.length}
                  onChange={setTablePage}
                />
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Sidebar droite */}
        <aside className="space-y-4">
          {/* Top Performers */}
          <Card className="overflow-hidden border-success/20 bg-gradient-to-br from-success/5 to-transparent transition-all duration-300 hover:shadow-md hover:shadow-success/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-success">
                <TrendingUp className="h-4 w-4" />
                Top 5 Recouvrement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPerformers.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-on-surface-variant">Aucune donnée disponible</p>
              ) : (
                topPerformers.map((row, index) => (
                  <button
                    key={row.centre}
                    type="button"
                    onClick={() => setCentre(row.centre)}
                    className="flex w-full items-center gap-3 rounded-panel p-2 transition-all duration-150 hover:bg-success/10"
                  >
                    <span className={`
                      flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold
                      ${index === 0 ? "bg-success text-on-success" : index === 1 ? "bg-success/70 text-white" : "bg-success/40 text-success"}
                    `}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{row.centre.replace("MC-", "")}</p>
                      <ProgressBar
                        value={row.recouvrement}
                        max={100}
                        color="#10b981"
                        size="sm"
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-success t-tabular">
                      {percent(row.recouvrement)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
          
          {/* Alertes */}
          {topRisk.length > 0 && (
            <Card className="overflow-hidden border-error/20 bg-gradient-to-br from-error/5 to-transparent transition-all duration-300 hover:shadow-md hover:shadow-error/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-error">
                  <AlertTriangle className="h-4 w-4" />
                  Alertes ({topRisk.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topRisk.slice(0, 5).map((row) => (
                  <button
                    key={row.centre}
                    type="button"
                    onClick={() => setCentre(row.centre)}
                    className="flex w-full items-center gap-2 rounded-panel p-2 text-left transition-all duration-150 hover:bg-error/10"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error/20 text-[9px] font-bold text-error">
                      !
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">{row.centre.replace("MC-", "")}</p>
                      <p className="text-[10px] text-error">
                        Recouvrement: {percent(row.recouvrement)}
                      </p>
                    </div>
                    <ArrowUp className="h-3 w-3 text-error rotate-45" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
          
          {/* Répartition encours */}
          <Card className="overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-black/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
                <Building2 className="h-4 w-4 text-primary" />
                Répartition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={donutData} size={160} />
            </CardContent>
          </Card>
        </aside>
      </div>
      
      {/* Graphiques complémentaires */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Comptes actifs vs arrêt */}
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 py-3 px-5">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
              <Activity className="h-4 w-4 text-primary" />
              Comptes actifs vs arrêt
            </CardTitle>
            <span className="text-[11px] text-on-surface-variant">Tous centres confondus</span>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {rows.slice(0, 8).map((row) => (
                <div key={row.centre} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate font-medium">{row.centre.replace("MC-", "")}</span>
                    <div className="flex gap-3 text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        {row.actifs.toLocaleString("fr-FR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-warning" />
                        {row.arretes.toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-surface-container">
                    <span
                      className="bg-success transition-all duration-500"
                      style={{ width: `${(row.actifs / maxComptes) * 100}%` }}
                    />
                    <span
                      className="bg-warning transition-all duration-500"
                      style={{ width: `${(row.arretes / maxComptes) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-outline-variant/50 pt-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                Actifs: {totals.actifs.toLocaleString("fr-FR")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" />
                Arrêt: {totals.arretes.toLocaleString("fr-FR")}
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* Clients identifiés par centre */}
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 py-3 px-5">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
              <Users className="h-4 w-4 text-primary" />
              Clients par centre
            </CardTitle>
            <button
              type="button"
              onClick={() => setClientMode("identified")}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Voir la liste
            </button>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {rows.slice(0, 8).map((row, index) => (
                <div key={row.centre} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate font-medium">{row.centre.replace("MC-", "")}</span>
                    <span className="t-tabular font-medium">{row.clients.toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        index % 3 === 0 ? "bg-primary" : index % 3 === 1 ? "bg-info" : "bg-primary/60"
                      }`}
                      style={{ width: `${(row.clients / maxClients) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-outline-variant/50 pt-3 text-[12px] text-on-surface-variant">
              Total sur le périmètre: <strong className="t-tabular text-on-surface">{totals.clients.toLocaleString("fr-FR")} clients</strong>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Modal clients */}
      <Modal
        open={clientMode !== null}
        onClose={() => setClientMode(null)}
        title={clientMode === "stopped" ? "Clients avec un compte à l'arrêt" : "Clients identifiés"}
        width="max-w-4xl"
      >
        <p className="mb-4 text-[12px] text-on-surface-variant">
          Résultats réels de la base, filtrés par {centre || "tous les centres"}{agency ? ` · agence ${agency}` : ""}.
        </p>
        {clientsQ.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : clientsQ.isError ? (
          <div className="rounded-panel border border-error/30 bg-error-container/50 p-4 text-error">
            Impossible de charger les clients. Veuillez réessayer.
          </div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
            <p className="text-[14px]">Aucun client dans ce périmètre</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Statut compte</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client: AggregatedClientRow) => (
                  <TableRow key={client.code_client} className="hover:bg-surface-container-low">
                    <TableCell>
                      <Link
                        className="font-medium text-primary hover:underline"
                        to={`/clients/${client.code_client}`}
                      >
                        {client.raison_sociale}
                      </Link>
                      <div className="text-[11px] text-on-surface-variant">{client.code_client}</div>
                    </TableCell>
                    <TableCell className="text-[13px]">{client.nom_centre ?? "—"}</TableCell>
                    <TableCell className="text-[13px]">{client.nom_agence ?? client.id_agence ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`
                        inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium
                        ${client.statut_facturation === "Arrêt" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}
                      `}>
                        {client.statut_facturation ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right t-tabular ${numberValue(client.total_balance) < 0 ? "text-error" : ""}`}>
                      {xaf(numberValue(client.total_balance))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
