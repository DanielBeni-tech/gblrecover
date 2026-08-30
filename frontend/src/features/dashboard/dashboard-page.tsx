import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  Filter,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Wallet,
  Eye,
  AlertCircle,
  BarChart3,
  Activity,
  DollarSign,
} from "lucide-react";
import {
  getDashboard,
  getTopIndebtedClients,
  getCamtelDebts,
  getAvailableMonths,
} from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendChart } from "@/components/charts/trend-chart";
import { OrgCascadeFilters } from "@/components/filters/org-cascade-filters";
import { xaf, dateTimeFr } from "@/lib/format";

// ============================================================================
// HELPERS
// ============================================================================

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function indebtedSourceUrl(row: ReportRow): string {
  const code = str(row.code_client);
  const params = new URLSearchParams({ tab: "creances", from: "dashboard" });
  const centre = str(row.nom_centre);
  const agence = str(row.nom_agence);
  if (centre) params.set("centre", centre);
  if (agence) params.set("agence", agence);
  return `/clients/${code}?${params.toString()}`;
}

function camtelSourceUrl(row: ReportRow): string {
  const code = str(row.code_client);
  const params = new URLSearchParams({ tab: "comptes", from: "dashboard" });
  const compte = str(row.num_compte);
  const centre = str(row.nom_centre);
  const agence = str(row.nom_agence);
  if (compte) params.set("compte", compte);
  if (centre) params.set("centre", centre);
  if (agence) params.set("agence", agence);
  return `/clients/${code}?${params.toString()}`;
}

// ============================================================================
// TYPES
// ============================================================================

interface AlertItem {
  id: string;
  type: "critical_debt" | "low_recovery" | "camtel_debt";
  message: string;
  value: number;
  severity: "error" | "warning";
}

// ============================================================================
// SECTION: ALERTES
// ============================================================================

function DashboardAlertsSection({
  kpis,
  camtelDebts,
}: {
  kpis: { tauxRecouvrement: number; echues: number; encoursTotal: number };
  camtelDebts: ReportRow[];
}) {
  const alerts = useMemo((): AlertItem[] => {
    const items: AlertItem[] = [];

    // Alerte taux recouvrement bas
    if (kpis.tauxRecouvrement < 30) {
      items.push({
        id: "low-recovery",
        type: "low_recovery",
        message: `Taux de recouvrement critique : ${kpis.tauxRecouvrement.toFixed(1)}%`,
        value: kpis.tauxRecouvrement,
        severity: "error",
      });
    } else if (kpis.tauxRecouvrement < 50) {
      items.push({
        id: "low-recovery",
        type: "low_recovery",
        message: `Taux de recouvrement insuffisant : ${kpis.tauxRecouvrement.toFixed(1)}%`,
        value: kpis.tauxRecouvrement,
        severity: "warning",
      });
    }

    // Alerte creances impayees elevees
    if (kpis.echues > 100_000_000) {
      items.push({
        id: "high-debt",
        type: "critical_debt",
        message: `Creances impayees elevees : ${xaf(kpis.echues)}`,
        value: kpis.echues,
        severity: "error",
      });
    }

    // Alerte CAMTEL dette
    const totalCamtelDebt = camtelDebts.reduce((sum, r) => sum + Math.abs(num(r.balance)), 0);
    if (totalCamtelDebt > 50_000_000) {
      items.push({
        id: "camtel-debt",
        type: "camtel_debt",
        message: `CAMTEL doit ${xaf(totalCamtelDebt)} a ses clients`,
        value: totalCamtelDebt,
        severity: "warning",
      });
    }

    return items.sort((a, b) => (a.severity === "error" ? -1 : 1) - (b.severity === "error" ? -1 : 1));
  }, [kpis, camtelDebts]);

  if (alerts.length === 0) {
    return (
      <Card className="border-success/30 bg-gradient-to-br from-success/5 to-transparent">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-full bg-success/10">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-success">Tableau de bord operationnel</p>
            <p className="text-xs text-on-surface-variant">Tous les indicateurs sont dans les normes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-error/30 bg-gradient-to-br from-error/[0.08] via-error/[0.03] to-transparent shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 border-b border-error/10">
        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-error tracking-tight">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-error/15 ring-1 ring-error/20">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          Alertes operationnelles
        </CardTitle>
        <span className="text-[11px] font-medium text-on-surface-variant bg-error/10 px-2 py-0.5 rounded-full">
          {alerts.length} active{alerts.length > 1 ? "s" : ""}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {alerts.slice(0, 3).map((alert) => {
          const isCritical = alert.severity === "error";
          const ringColor = isCritical
            ? "ring-error/30 bg-error/[0.07]"
            : "ring-warning/30 bg-warning/[0.07]";
          const iconColor = isCritical ? "text-error" : "text-warning";
          const bgColor = isCritical ? "bg-error/15" : "bg-warning/15";

          return (
            <div
              key={alert.id}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl ring-1 ${ringColor} transition-all duration-200`}
            >
              <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${bgColor}`}>
                <AlertCircle className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-semibold text-on-surface">{alert.message}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${iconColor} shrink-0`}>
                    {alert.type === "low_recovery" ? "Recouv." : alert.type === "critical_debt" ? "Dette" : "CAMTEL"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SECTION: STATS GLOBALES
// ============================================================================

function GlobalDashboardStats({
  kpis,
}: {
  kpis: {
    totalComptes: number;
    encoursTotal: number;
    echues: number;
    payees: number;
    tauxRecouvrement: number;
    soldeNegatif: number;
  };
}) {
  // Score de sante global (0-100)
  const healthScore = useMemo(() => {
    let score = 100;
    if (kpis.tauxRecouvrement < 30) score -= 40;
    else if (kpis.tauxRecouvrement < 50) score -= 20;
    if (kpis.echues > 100_000_000) score -= 30;
    else if (kpis.echues > 50_000_000) score -= 15;
    if (kpis.soldeNegatif < -50_000_000) score -= 20;
    else if (kpis.soldeNegatif < -20_000_000) score -= 10;
    return Math.max(0, score);
  }, [kpis]);

  const healthColor = healthScore >= 70 ? "text-success" : healthScore >= 40 ? "text-warning" : "text-error";
  const healthBgColor = healthScore >= 70 ? "bg-success/15" : healthScore >= 40 ? "bg-warning/15" : "bg-error/15";

  return (
    <>
      {/* Score de sante global */}
      <Card
        className={`overflow-hidden border ${
          healthScore >= 70
            ? "border-success/30"
            : healthScore >= 40
              ? "border-warning/30"
              : "border-error/30"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl ${healthBgColor} flex items-center justify-center shrink-0`}>
              <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface">Santé du réseau</p>
              <p className="text-xs text-on-surface-variant">
                {healthScore >= 70
                  ? "Indicateurs dans les normes"
                  : healthScore >= 40
                    ? "Necessite une attention particuliere"
                    : "Intervention urgente requise"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total comptes"
          value={kpis.totalComptes.toLocaleString("fr-FR")}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Encours total"
          value={`${(kpis.encoursTotal / 1_000_000).toFixed(1)} M`}
          icon={Wallet}
        />
        <KpiCard
          label="Impayees"
          value={`${(kpis.echues / 1_000_000).toFixed(1)} M`}
          icon={TrendingDown}
          tone="error"
        />
        <KpiCard
          label="Payees"
          value={`${(kpis.payees / 1_000_000).toFixed(1)} M`}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Tx Recouvrement"
          value={`${kpis.tauxRecouvrement.toFixed(1)} %`}
          icon={Activity}
          tone={kpis.tauxRecouvrement > 50 ? "success" : kpis.tauxRecouvrement > 20 ? "warning" : "error"}
        />
        <KpiCard
          label="Solde CAMTEL"
          value={`${(Math.abs(kpis.soldeNegatif) / 1_000_000).toFixed(1)} M`}
          icon={DollarSign}
          tone={kpis.soldeNegatif < 0 ? "warning" : "default"}
        />
      </div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DashboardPage() {
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [selectedAgences, setSelectedAgences] = useState<string[]>([]);
  const [selectedMois, setSelectedMois] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{ centres?: string; agences?: string; mois?: string }>({});

  const { data: monthsData } = useQuery({
    queryKey: ["available-months"],
    queryFn: () => getAvailableMonths(),
    staleTime: 600_000,
  });

  const availableMonths = [
    { label: "Tous les mois", value: "" },
    ...(monthsData ?? []).map((m) => ({
      label: String(m.label ?? ""),
      value: String(m.value ?? ""),
    })),
  ];

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", appliedFilters],
    queryFn: () => getDashboard(appliedFilters),
  });

  const centreQs = appliedFilters.centres ?? "";
  const agenceQs = appliedFilters.agences ?? "";

  const { data: topIndebted, isLoading: loadingIndebted } = useQuery({
    queryKey: ["dashboard-top-indebted", appliedFilters],
    queryFn: () =>
      getTopIndebtedClients({
        centres: centreQs || undefined,
        agences: agenceQs || undefined,
        mois: appliedFilters.mois || undefined,
      }),
    staleTime: 60_000,
  });

  const { data: camtelDebts, isLoading: loadingDebts } = useQuery({
    queryKey: ["dashboard-camtel-debts", appliedFilters],
    queryFn: () =>
      getCamtelDebts({ centres: centreQs || undefined, agences: agenceQs || undefined }),
    staleTime: 60_000,
  });

  function handleApply() {
    setAppliedFilters({
      centres: selectedCentres.length > 0 ? selectedCentres.join(",") : undefined,
      agences: selectedAgences.length > 0 ? selectedAgences.join(",") : undefined,
      mois: selectedMois || undefined,
    });
  }

  function handleReset() {
    setSelectedCentres([]);
    setSelectedAgences([]);
    setSelectedMois("");
    setAppliedFilters({});
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-[80px]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-panel border border-error/30 bg-error-container p-6">
        <p className="flex items-center gap-2 font-semibold text-on-error-container">
          <AlertTriangle className="h-4 w-4" /> Impossible de charger le tableau de bord.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-[13px] font-medium text-on-error-container underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { kpis, trend, refreshedAt } = data;
  const isFiltered = !!(appliedFilters.centres || appliedFilters.agences || appliedFilters.mois);

  return (
    <>
      <PageHeader
        size="lg"
        title="Tableau de bord — Revenue Assurance"
        subtitle="Vue décisionnelle consolidée des indicateurs de recouvrement CAMTEL"
      />

      {/* Alertes operationnelles */}
      <DashboardAlertsSection kpis={kpis} camtelDebts={camtelDebts ?? []} />

      {/* Info de mise a jour */}
      <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
        <RefreshCw className="h-3 w-3" />
        Mises a jour le {dateTimeFr(refreshedAt)}
        {isFiltered && (
          <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">
            FILTRÉ
          </span>
        )}
        <button
          onClick={() => refetch()}
          aria-label="Actualiser"
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filtres */}
      <Card className="border-primary/30 bg-surface-container-lowest">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filtres du tableau de bord
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <OrgCascadeFilters
              mode="multi"
              value={{ centres: selectedCentres, agences: selectedAgences }}
              onChange={({ centres, agences }) => {
                setSelectedCentres(centres);
                setSelectedAgences(agences);
              }}
            />
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Mois
              </label>
              <Select value={selectedMois} onChange={(e) => setSelectedMois(e.target.value)}>
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button onClick={handleApply} className="h-9">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Appliquer
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="h-9 bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
              >
                Reinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats globales */}
      <GlobalDashboardStats kpis={kpis} />

      {/* Graphique d'evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            Evolution de la dette vs encaissements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-on-surface-variant">
              Aucune donnée d'evolution disponible pour ce filtre.
            </div>
          ) : (
            <TrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      {/* Tableaux */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Top 20 clients les plus endettes */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-error">
              <TrendingUp className="h-5 w-5" />
              Top 10 — Clients les plus endettes
            </CardTitle>
            <p className="text-[12px] text-on-surface-variant">
              Classement par montant total de factures impayees
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <tr>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="text-right">Total impaye</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {loadingIndebted ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (topIndebted ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Aucune donnee disponible.
                    </TableCell>
                  </TableRow>
                ) : (
                  (topIndebted ?? []).slice(0, 10).map((row: ReportRow, idx: number) => {
                    const href = indebtedSourceUrl(row);
                    return (
                      <TableRow
                        key={`${str(row.code_client)}-${idx}`}
                        className={`hover:bg-surface-container-low ${idx < 3 ? "bg-error-container/10" : ""}`}
                      >
                        <TableCell className="t-tabular font-bold text-error">{idx + 1}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-medium">
                          <Link to={href} className="hover:text-error">
                            {str(row.raison_sociale)}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-[12px] text-on-surface-variant">
                          {str(row.nom_centre) || "—"}
                        </TableCell>
                        <TableCell className="t-tabular text-right font-bold text-error">
                          {xaf(num(row.total_impaye))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={href}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Voir
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Top 20 dettes CAMTEL */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-warning">
              <TrendingDown className="h-5 w-5" />
              Top 10 — Dettes CAMTEL
            </CardTitle>
            <p className="text-[12px] text-on-surface-variant">
              Comptes ou CAMTEL a verse plus que facture
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <tr>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead className="text-right">Dette CAMTEL</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {loadingDebts ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (camtelDebts ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Aucune dette CAMTEL enregistree.
                    </TableCell>
                  </TableRow>
                ) : (
                  (camtelDebts ?? [])
                    .filter((r) => num(r.balance) < 0)
                    .slice(0, 10)
                    .map((row: ReportRow, idx: number) => {
                      const href = camtelSourceUrl(row);
                      return (
                        <TableRow
                          key={`${str(row.num_compte)}-${idx}`}
                          className={`hover:bg-surface-container-low ${idx < 3 ? "bg-warning-container/10" : ""}`}
                        >
                          <TableCell className="t-tabular font-bold text-warning">{idx + 1}</TableCell>
                          <TableCell className="max-w-[180px] truncate font-medium">
                            <Link to={href} className="hover:text-warning">
                              {str(row.raison_sociale)}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-[12px] text-on-surface-variant">
                            {str(row.nom_agence) || "—"}
                          </TableCell>
                          <TableCell className="t-tabular text-right font-bold text-warning">
                            {xaf(Math.abs(num(row.balance)))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              to={href}
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Voir
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
