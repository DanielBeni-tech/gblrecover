import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAgenciesPerformanceReport,
  listCentres,
  getAvailableMonths,
} from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChip } from "@/components/widgets/filter-chip";
import {
  Building2,
  Users,
  CheckCircle2,
  Wallet,
  TrendingDown,
  AlertTriangle,
  TrendingUp,
  Eye,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  RotateCcw,
  BarChart3,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type SortKey = "name" | "managers" | "accounts" | "balance" | "stopRate" | "tauxRecouvrement" | "tauxKyc";

type AgencyStatus = "performant" | "attention" | "critique";

interface AgencyPerformance {
  id: string;
  name: string;
  centre: string;
  managers: number;
  accounts: number;
  balance: number;
  stopped: number;
  stopRate: number | null;
  tauxRecouvrement: number | null;
  tauxKycDefaillant: number | null;
  status: AgencyStatus;
}

interface AlertItem {
  id: string;
  agencyId: string;
  agencyName: string;
  type: "stop_rate" | "kyc" | "recouvrement";
  message: string;
  value: number;
  threshold: number;
}

type ViewMode = "list" | "agency-detail";

// ============================================================================
// HELPERS
// ============================================================================

function getStatus(row: AgencyPerformance): AgencyStatus {
  // Règles métier (cohérentes avec les seuils d'alerte) :
  // - CRITIQUE : taux d'arrêt > 50% OU KYC défaillant > 70% OU taux recouvrement < 30%
  // - ATTENTION : taux d'arrêt entre 30% et 50% OU KYC défaillant entre 50% et 70% OU taux recouvrement entre 30% et 50%
  // - PERFORMANT : sinon
  const stopRate = row.stopRate ?? 0;
  const kycRate = row.tauxKycDefaillant ?? 0;
  const recRate = row.tauxRecouvrement;

  if (stopRate > 50 || kycRate > 70 || (recRate !== null && recRate < 30)) return "critique";
  if (
    (stopRate >= 30 && stopRate <= 50) ||
    (kycRate > 50 && kycRate <= 70) ||
    (recRate !== null && recRate >= 30 && recRate < 50)
  ) {
    return "attention";
  }
  return "performant";
}

function getStatusLabel(status: AgencyStatus): string {
  switch (status) {
    case "critique": return "Critique";
    case "attention": return "Attention";
    case "performant": return "Performant";
  }
}

function getStatusBgColor(status: AgencyStatus): string {
  switch (status) {
    case "critique": return "bg-error-container text-on-error-container";
    case "attention": return "bg-warning-container text-on-warning-container";
    case "performant": return "bg-success-container text-on-success-container";
  }
}

function formatXafFull(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return `${value.toLocaleString("fr-FR")} XAF`;
}

function formatXafCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  }
  return value.toLocaleString("fr-FR");
}

function formatTaux(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-FR");
}

// ============================================================================
// SORT ICON
// ============================================================================

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <span className="text-on-surface-variant/30 ml-1">↕</span>;
  return <span className="ml-1">{direction === "asc" ? "↑" : "↓"}</span>;
}

// ============================================================================
// SECTION: ALERTES
// ============================================================================

function AlertSection({
  rows,
  onViewDetail,
}: {
  rows: AgencyPerformance[];
  onViewDetail: (agencyId: string) => void;
}) {
  const alerts = useMemo((): AlertItem[] => {
    const items: AlertItem[] = [];
    rows.forEach((row) => {
      // Alerte taux d'arrêt critique (> 50%)
      if ((row.stopRate ?? 0) > 50) {
        items.push({
          id: `stop-${row.id}`,
          agencyId: row.id,
          agencyName: row.name,
          type: "stop_rate",
          message: `Taux d'arrêt critique : ${formatTaux(row.stopRate)} sur ${formatNumber(row.accounts)} comptes`,
          value: row.stopRate ?? 0,
          threshold: 50,
        });
      }
      // Alerte KYC défaillant élevé (> 70%)
      if ((row.tauxKycDefaillant ?? 0) > 70) {
        items.push({
          id: `kyc-${row.id}`,
          agencyId: row.id,
          agencyName: row.name,
          type: "kyc",
          message: `Indice KYC défaillant élevé : ${formatTaux(row.tauxKycDefaillant)} de clients non identifiés`,
          value: row.tauxKycDefaillant ?? 0,
          threshold: 70,
        });
      }
      // Alerte recouvrement insuffisant (< 30%) — null = pas de facturation = pas d'alerte
      if (row.tauxRecouvrement !== null && row.tauxRecouvrement < 30) {
        items.push({
          id: `rec-${row.id}`,
          agencyId: row.id,
          agencyName: row.name,
          type: "recouvrement",
          message: `Taux de recouvrement insuffisant : ${formatTaux(row.tauxRecouvrement)}`,
          value: row.tauxRecouvrement,
          threshold: 30,
        });
      }
    });
    return items.sort((a, b) => {
      const priority: Record<string, number> = { stop_rate: 3, kyc: 2, recouvrement: 1 };
      return (priority[b.type] ?? 0) - (priority[a.type] ?? 0);
    });
  }, [rows]);

  if (alerts.length === 0) {
    return (
      <Card className="border-success/30 bg-gradient-to-br from-success/5 to-transparent">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-full bg-success/10">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-success">Aucune alerte active</p>
            <p className="text-xs text-on-surface-variant">Toutes les agences sont dans les normes definies</p>
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
          Alertes critiques
        </CardTitle>
        <span className="text-[11px] font-medium text-on-surface-variant bg-error/10 px-2 py-0.5 rounded-full">
          {alerts.length} active{alerts.length > 1 ? "s" : ""}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {alerts.slice(0, 3).map((alert) => {
          const isCritical = alert.type === "stop_rate";
          const ringColor = isCritical ? "ring-error/30 bg-error/[0.07]" : "ring-warning/30 bg-warning/[0.07]";
          const iconColor = isCritical ? "text-error" : "text-warning";
          return (
            <button
              key={alert.id}
              onClick={() => onViewDetail(alert.agencyId)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl ring-1 ${ringColor} hover:ring-2 transition-all duration-200 group hover:shadow-sm`}
            >
              <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isCritical ? "bg-error/15" : "bg-warning/15"}`}>
                <AlertCircle className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-semibold text-on-surface group-hover:text-error transition-colors truncate">
                    {alert.agencyName}
                  </p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${iconColor} shrink-0`}>
                    {isCritical ? "Arrêt" : alert.type === "kyc" ? "KYC" : "Recouv."}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-on-surface-variant">
                  {alert.message}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-on-surface-variant group-hover:text-error transition-colors shrink-0 mt-1">
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Voir</span>
              </div>
            </button>
          );
        })}
        {alerts.length > 3 && (
          <p className="text-[11px] text-on-surface-variant text-center pt-2 font-medium">
            +{alerts.length - 3} autre{alerts.length - 3 > 1 ? "s" : ""} alerte
            {alerts.length - 3 > 1 ? "s" : ""} — voir liste ci-dessous
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SECTION: STATISTIQUES GLOBALES
// ============================================================================

function GlobalStatsSection({ rows }: { rows: AgencyPerformance[] }) {
  const stats = useMemo(() => {
    return {
      totalAgencies: rows.length,
      totalManagers: rows.reduce((sum, r) => sum + r.managers, 0),
      totalAccounts: rows.reduce((sum, r) => sum + r.accounts, 0),
      totalBalance: rows.reduce((sum, r) => sum + r.balance, 0),
      avgStopRate:
        rows.length > 0 ? rows.reduce((sum, r) => sum + (r.stopRate ?? 0), 0) / rows.length : 0,
      avgRecouvrement:
        rows.filter((r) => r.tauxRecouvrement !== null).length > 0
          ? rows
              .filter((r) => r.tauxRecouvrement !== null)
              .reduce((sum, r) => sum + (r.tauxRecouvrement ?? 0), 0) /
            rows.filter((r) => r.tauxRecouvrement !== null).length
          : 0,
    };
  }, [rows]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard label="Agences" value={stats.totalAgencies.toString()} icon={Building2} />
      <KpiCard label="Gestionnaires" value={formatNumber(stats.totalManagers)} icon={Users} />
      <KpiCard label="Comptes geres" value={formatNumber(stats.totalAccounts)} icon={CheckCircle2} />
      <KpiCard label="Encours gere" value={formatXafCompact(stats.totalBalance)} icon={Wallet} />
      <KpiCard
        label="Tx Arret Moyen"
        value={formatTaux(stats.avgStopRate)}
        icon={TrendingDown}
        tone={stats.avgStopRate > 50 ? "error" : stats.avgStopRate > 30 ? "warning" : "default"}
      />
      <KpiCard
        label="Tx Recouvrement"
        value={formatTaux(stats.avgRecouvrement)}
        icon={TrendingUp}
        tone={
          stats.avgRecouvrement < 30 ? "error" : stats.avgRecouvrement < 50 ? "warning" : "default"
        }
      />
    </div>
  );
}

// ============================================================================
// VUE DETAIL AGENCE
// ============================================================================

function AgencyDetailView({
  agency,
  allRows,
  onBack,
}: {
  agency: AgencyPerformance;
  allRows: AgencyPerformance[];
  onBack: () => void;
}) {
  const otherAgencies = useMemo(() => allRows.filter((r) => r.id !== agency.id), [allRows, agency.id]);

  const avgStopRate =
    otherAgencies.length > 0
      ? otherAgencies.reduce((sum, r) => sum + (r.stopRate ?? 0), 0) / otherAgencies.length
      : 0;
  const avgRecouvrement =
    otherAgencies.filter((r) => r.tauxRecouvrement !== null).length > 0
      ? otherAgencies
          .filter((r) => r.tauxRecouvrement !== null)
          .reduce((sum, r) => sum + (r.tauxRecouvrement ?? 0), 0) /
        otherAgencies.filter((r) => r.tauxRecouvrement !== null).length
      : 0;

  const comparatifStopRate = agency.stopRate !== null ? agency.stopRate - avgStopRate : null;
  const comparatifRecouvrement =
    agency.tauxRecouvrement !== null ? agency.tauxRecouvrement - avgRecouvrement : null;

  const similarAgencies = useMemo(
    () =>
      otherAgencies
        .filter((r) => r.centre === agency.centre)
        .sort((a, b) => (b.stopRate ?? 0) - (a.stopRate ?? 0)),
    [otherAgencies, agency.centre],
  );

  // Score de sante global (0-100)
  // - stopRate : plus c'est haut, plus c'est mauvais
  // - tauxRecouvrement : plus c'est bas, plus c'est mauvais (null = pas de facturation = on ne pénalise pas)
  // - tauxKycDefaillant : plus c'est haut, plus c'est mauvais
  const healthScore = useMemo(() => {
    let score = 100;
    // Pénalités taux d'arrêt
    if ((agency.stopRate ?? 0) > 50) score -= 40;
    else if ((agency.stopRate ?? 0) > 30) score -= 20;
    // Pénalités taux de recouvrement (null = pas de données = pas de pénalité)
    if (agency.tauxRecouvrement !== null) {
      if (agency.tauxRecouvrement < 30) score -= 30;
      else if (agency.tauxRecouvrement < 50) score -= 15;
    }
    // Pénalités KYC défaillant
    if ((agency.tauxKycDefaillant ?? 0) > 70) score -= 20;
    else if ((agency.tauxKycDefaillant ?? 0) > 50) score -= 10;
    return Math.max(0, score);
  }, [agency]);

  const healthColor = healthScore >= 70 ? "text-success" : healthScore >= 40 ? "text-warning" : "text-error";
  const healthBgColor = healthScore >= 70 ? "bg-success/15" : healthScore >= 40 ? "bg-warning/15" : "bg-error/15";

  return (
    <div className="space-y-6">
      {/* Header avec bouton retour et info agence */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm">
        <Button
          size="sm"
          onClick={onBack}
          className="gap-2 bg-primary text-on-primary hover:bg-primary/90 shadow-sm font-semibold shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-on-surface truncate">{agency.name}</h2>
          <p className="text-sm text-on-surface-variant flex items-center gap-2">
            <span>{agency.centre}</span>
            <span className="text-outline">•</span>
            <span>{formatNumber(agency.managers)} gestionnaire{agency.managers > 1 ? "s" : ""}</span>
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBgColor(agency.status)}`}
        >
          {getStatusLabel(agency.status)}
        </span>
      </div>

      {/* Score de sante global */}
      <Card className={`overflow-hidden border ${healthScore >= 70 ? "border-success/30" : healthScore >= 40 ? "border-warning/30" : "border-error/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl ${healthBgColor} flex items-center justify-center shrink-0`}>
              <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface">Score de sante global</p>
              <p className="text-xs text-on-surface-variant">
                {healthScore >= 70 ? "Agence en bonne sante" : healthScore >= 40 ? "Necessite une attention particuliere" : "Intervention urgente requise"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Encours total</p>
              <p className="text-lg font-bold text-on-surface">{formatXafCompact(agency.balance)}</p>
              <p className="text-xs text-on-surface-variant">{formatNumber(agency.accounts)} comptes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs detaillees */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">Tx Arret</p>
            <p
              className={`text-2xl font-bold ${
                (agency.stopRate ?? 0) > 50
                  ? "text-error"
                  : (agency.stopRate ?? 0) > 30
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {formatTaux(agency.stopRate)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {formatNumber(agency.stopped)} / {formatNumber(agency.accounts)}
            </p>
            {comparatifStopRate !== null && (
              <p className={`text-[10px] font-medium mt-1 ${comparatifStopRate > 0 ? "text-error" : "text-success"}`}>
                {comparatifStopRate > 0 ? "+" : ""}{formatTaux(comparatifStopRate)} vs moyenne
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">Tx Recouv.</p>
            <p
              className={`text-2xl font-bold ${
                (agency.tauxRecouvrement ?? 100) < 30
                  ? "text-error"
                  : (agency.tauxRecouvrement ?? 100) < 50
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {formatTaux(agency.tauxRecouvrement)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Moyenne nationale: {formatTaux(avgRecouvrement)}
            </p>
            {comparatifRecouvrement !== null && (
              <p className={`text-[10px] font-medium mt-1 ${comparatifRecouvrement < 0 ? "text-error" : "text-success"}`}>
                {comparatifRecouvrement > 0 ? "+" : ""}{formatTaux(comparatifRecouvrement)} vs moyenne
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">KYC Def.</p>
            <p
              className={`text-2xl font-bold ${
                (agency.tauxKycDefaillant ?? 0) > 70
                  ? "text-error"
                  : (agency.tauxKycDefaillant ?? 0) > 50
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {formatTaux(agency.tauxKycDefaillant)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {(agency.tauxKycDefaillant ?? 0) > 70 ? "Risque reglementaire" : "Dans les normes"}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">Comptes</p>
            <p className="text-2xl font-bold text-on-surface">
              {formatNumber(agency.accounts)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {formatNumber(agency.stopped)} arretes
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">Ratio</p>
            <p className="text-2xl font-bold text-on-surface">
              {agency.managers > 0 ? formatNumber(Math.round(agency.accounts / agency.managers)) : "—"}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              comptes / gestionnaire
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
            <BarChart3 className="w-4 h-4" />
            Comparaison avec le centre {agency.centre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {similarAgencies.slice(0, 5).map((similar) => (
              <div key={similar.id} className="flex items-center justify-between text-sm">
                <span className="text-on-surface truncate max-w-[160px]">
                  {similar.name}
                  {similar.id === agency.id && (
                    <span className="text-primary ml-1">(cette agence)</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-medium ${
                      (similar.stopRate ?? 0) > 50
                        ? "text-error"
                        : (similar.stopRate ?? 0) > 30
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {formatTaux(similar.stopRate)} arret
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {formatTaux(similar.tauxRecouvrement)} rec.
                  </span>
                </div>
              </div>
            ))}
            {similarAgencies.length === 0 && (
              <p className="text-sm text-on-surface-variant">Aucune autre agence dans ce centre</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-primary">
            Analyse & Actions recommandées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(agency.stopRate ?? 0) > 50 && (
              <li className="flex items-start gap-2 text-error">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Urgent : Reprendre contact avec {formatNumber(agency.stopped)} comptes arrêtés pour
                  identifier les obstructions au paiement
                </span>
              </li>
            )}
            {(agency.tauxKycDefaillant ?? 0) > 70 && (
              <li className="flex items-start gap-2 text-warning">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Critique : Intensifier la vérification KYC - {formatTaux(agency.tauxKycDefaillant)}{" "}
                  de clients non identifiés représentent un risque réglementaire
                </span>
              </li>
            )}
            {agency.tauxRecouvrement !== null && agency.tauxRecouvrement < 30 && (
              <li className="flex items-start gap-2 text-warning">
                <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Taux de recouvrement insuffisant ({formatTaux(agency.tauxRecouvrement)}) -
                  Renforcer les relances et négocier des échéanciers
                </span>
              </li>
            )}
            {agency.tauxRecouvrement !== null &&
              agency.tauxRecouvrement >= 30 &&
              agency.tauxRecouvrement < 50 && (
                <li className="flex items-start gap-2 text-warning">
                  <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Taux de recouvrement à améliorer ({formatTaux(agency.tauxRecouvrement)}) - Mettre
                    en place un plan de relance structuré
                  </span>
                </li>
              )}
            {(agency.stopRate ?? 0) <= 30 && (
              agency.tauxRecouvrement === null || agency.tauxRecouvrement >= 50
            ) && (
              <li className="flex items-start gap-2 text-success">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Agence performante - Maintenir les bonnes pratiques et partager les retours
                  d'expérience
                </span>
              </li>
            )}
            <li className="flex items-start gap-2 text-on-surface-variant">
              <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Encours total de {formatXafFull(agency.balance)} à suivre - {formatNumber(agency.accounts)}{" "}
                comptes confiés à {formatNumber(agency.managers)} gestionnaire
                {agency.managers > 1 ? "s" : ""}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgencesPage() {
  const [centre, setCentre] = useState("");
  const [period, setPeriod] = useState("");
  const [comparaisonMois, setComparaisonMois] = useState("");
  const [facturationStatus, setFacturationStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "stopRate",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const centresQ = useQuery({
    queryKey: ["centres"],
    queryFn: () => listCentres(),
  });

  const monthsQ = useQuery({
    queryKey: ["available-months"],
    queryFn: getAvailableMonths,
    staleTime: 600_000,
  });

  const periods = useMemo(() => {
    const seen = new Set<string>();
    return (monthsQ.data ?? [])
      .map((row) => ({
        value: String(row.mois ?? row.value ?? ""),
        label: String(row.libelle ?? row.label ?? row.mois ?? ""),
      }))
      .filter((p) => p.value && !seen.has(p.value) && seen.add(p.value))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [monthsQ.data]);

  const reportQ = useQuery({
    queryKey: ["reports", "agencies-performance", centre, period, comparaisonMois],
    queryFn: () =>
      getAgenciesPerformanceReport({
        ...(centre ? { centre } : {}),
        ...(period ? { mois: period } : {}),
        ...(comparaisonMois ? { comparaison_mois: comparaisonMois } : {}),
      }),
  });

  const isLoading = reportQ.isLoading || centresQ.isLoading || monthsQ.isLoading;

  const rows = useMemo<AgencyPerformance[]>(() => {
    return (reportQ.data ?? []).map((row) => {
      // === Colonnes retournées par le backend reports_agencies_performance ===
      // - id_agence, nom_agence, region_centre
      // - total_comptes, nb_gestionnaires, total_dette_balance_fcfa
      // - nb_comptes_arretes, taux_comptes_arretes_pct
      // - taux_recouvrement_pct, taux_kyc_defaillant
      // - total_facture_fcfa, total_impaye_flux_fcfa
      // - evolution_pct, trend, mois, comparaison_mois

      // Total des comptes gérés (depuis table compte)
      const accounts = Number(row.total_comptes ?? 0) || 0;

      // Nombre de comptes arrêtés (depuis table compte, statut_facturation='arrêt')
      const stopped = Number(row.nb_comptes_arretes ?? 0) || 0;

      // Encours total géré (somme des balances)
      const balance = Number(row.total_dette_balance_fcfa ?? 0) || 0;

      // Taux d'arrêt : calculé par le backend (ROUNDet à 2 décimales)
      // On garde la valeur backend si elle existe, sinon recalcul
      const stopRateRaw = row.taux_comptes_arretes_pct;
      let stopRate: number | null = null;
      if (stopRateRaw !== undefined && stopRateRaw !== null) {
        const n = Number(stopRateRaw);
        if (Number.isFinite(n)) stopRate = n;
      }
      if (stopRate === null && accounts > 0) {
        stopRate = Math.round((stopped / accounts) * 100 * 100) / 100;
      }

      // Taux de recouvrement : (facturé - impayé) / facturé * 100, NULL si pas de facturation
      const recRaw = row.taux_recouvrement_pct;
      const tauxRecouvrement =
        recRaw !== undefined && recRaw !== null && Number.isFinite(Number(recRaw))
          ? Number(recRaw)
          : null;

      // Taux KYC défaillant : % de comptes non identifiés
      const kycRaw = row.taux_kyc_defaillant;
      const tauxKycDefaillant =
        kycRaw !== undefined && kycRaw !== null && Number.isFinite(Number(kycRaw))
          ? Number(kycRaw)
          : null;

      // Nombre de gestionnaires distincts
      const managers = Number(row.nb_gestionnaires ?? 0) || 0;

      const agencyRow: AgencyPerformance = {
        id: String(row.id_agence ?? ""),
        name: String(row.nom_agence ?? row.id_agence ?? "Agence non nommée"),
        centre: String(row.region_centre ?? row.nom_centre ?? "Centre non renseigné"),
        managers,
        accounts,
        balance,
        stopped,
        stopRate,
        tauxRecouvrement,
        tauxKycDefaillant,
        status: "performant",
      };
      return { ...agencyRow, status: getStatus(agencyRow) };
    });
  }, [reportQ.data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const matchesSearch =
          !query || `${row.name} ${row.id} ${row.centre}`.toLowerCase().includes(query);
        const matchesCentre = !centre || row.centre === centre;
        let matchesFacturation = true;
        if (facturationStatus === "arret") {
          matchesFacturation = row.stopRate !== null && row.stopRate > 0;
        } else if (facturationStatus === "en_cours") {
          matchesFacturation = row.stopRate === 0;
        }
        return matchesSearch && matchesCentre && matchesFacturation;
      })
      .sort((a, b) => {
        // Tri demandé par l'utilisateur en priorité
        const dir = sort.direction === "asc" ? 1 : -1;
        let primary = 0;
        switch (sort.key) {
          case "name":
            primary = dir * a.name.localeCompare(b.name);
            break;
          case "managers":
            primary = dir * (a.managers - b.managers);
            break;
          case "accounts":
            primary = dir * (a.accounts - b.accounts);
            break;
          case "balance":
            primary = dir * (a.balance - b.balance);
            break;
          case "stopRate":
            primary = dir * ((a.stopRate ?? 0) - (b.stopRate ?? 0));
            break;
          case "tauxRecouvrement":
            primary = dir * ((a.tauxRecouvrement ?? 0) - (b.tauxRecouvrement ?? 0));
            break;
          case "tauxKyc":
            primary = dir * ((a.tauxKycDefaillant ?? 0) - (b.tauxKycDefaillant ?? 0));
            break;
          default:
            primary = 0;
        }
        if (primary !== 0) return primary;
        // Tri secondaire stable par nom d'agence
        return a.name.localeCompare(b.name);
      });
  }, [rows, search, centre, facturationStatus, sort]);

  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const selectedAgency = useMemo(
    () => rows.find((r) => r.id === selectedAgencyId) ?? null,
    [rows, selectedAgencyId],
  );

  const resetFilters = () => {
    setCentre("");
    setPeriod("");
    setComparaisonMois("");
    setFacturationStatus("");
    setSearch("");
    setPage(1);
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleViewDetail = (agencyId: string) => {
    setSelectedAgencyId(agencyId);
    setViewMode("agency-detail");
  };

  const handleBack = () => {
    setViewMode("list");
    setSelectedAgencyId(null);
  };

  const activeFilters = useMemo(() => {
    const filters: { label: string; value: string }[] = [];
    if (centre) filters.push({ label: "Centre", value: centre });
    if (period) {
      const periodLabel = periods.find((p) => p.value === period)?.label ?? period;
      filters.push({ label: "Periode", value: periodLabel });
    }
    if (comparaisonMois) {
      const compLabel = periods.find((p) => p.value === comparaisonMois)?.label ?? comparaisonMois;
      filters.push({ label: "Comparer a", value: compLabel });
    }
    if (facturationStatus === "arret") filters.push({ label: "Statut", value: "Arret" });
    if (facturationStatus === "en_cours") filters.push({ label: "Statut", value: "En cours" });
    return filters;
  }, [centre, period, comparaisonMois, facturationStatus, periods]);

  if (viewMode === "agency-detail" && selectedAgency) {
    return (
      <div className="space-y-6">
        <AgencyDetailView agency={selectedAgency} allRows={rows} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agences" subtitle="Performance et analyse des agences CAMTEL" />

      {!isLoading && <AlertSection rows={filteredRows} onViewDetail={handleViewDetail} />}

      <Card className="overflow-hidden border-opacity-50 bg-gradient-to-br from-surface to-surface-container-low transition-all duration-300 hover:shadow-md hover:shadow-black/5">
        <CardContent className="space-y-4 p-5">
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <FilterChip
                  key={`${filter.label}-${index}`}
                  label={filter.label}
                  value={filter.value}
                  onRemove={() => {
                    if (filter.label === "Centre") setCentre("");
                    else if (filter.label === "Periode") setPeriod("");
                    else if (filter.label === "Comparer a") setComparaisonMois("");
                    else if (filter.label === "Statut") setFacturationStatus("");
                  }}
                />
              ))}
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
                Reinitialiser
              </Button>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Rechercher une agence..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />

            <div className="min-w-[160px] flex-1">
              <Select
                value={centre}
                onChange={(e) => {
                  setCentre(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tous les centres</option>
                {(centresQ.data ?? []).map((c) => (
                  <option key={c.nom_centre} value={c.nom_centre}>
                    {c.nom_centre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="min-w-[160px] flex-1">
              <Select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Periode actuelle</option>
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="min-w-[170px] flex-1">
              <Select
                value={comparaisonMois}
                onChange={(e) => {
                  setComparaisonMois(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Comparer a (optionnel)</option>
                {periods
                  .filter((p) => p.value !== period)
                  .map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="min-w-[140px] flex-1">
              <Select
                value={facturationStatus}
                onChange={(e) => {
                  setFacturationStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tous les statuts</option>
                <option value="arret">Comptes arretes</option>
                <option value="en_cours">Comptes en cours</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isLoading && <GlobalStatsSection rows={filteredRows} />}

      <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low/50 py-4 px-5">
          <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-on-surface">
            Liste des agences ({filteredRows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={pageSize.toString()}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[900px]">
              <TableHeader>
                <TableRow className="border-b border-outline-variant/50">
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container"
                    onClick={() => toggleSort("name")}
                  >
                    Agence <SortIcon active={sort.key === "name"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-center"
                    onClick={() => toggleSort("managers")}
                  >
                    Gest. <SortIcon active={sort.key === "managers"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-right"
                    onClick={() => toggleSort("accounts")}
                  >
                    Comptes <SortIcon active={sort.key === "accounts"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-right"
                    onClick={() => toggleSort("balance")}
                  >
                    Encours <SortIcon active={sort.key === "balance"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-right"
                    onClick={() => toggleSort("stopRate")}
                  >
                    Tx Arret <SortIcon active={sort.key === "stopRate"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-right"
                    onClick={() => toggleSort("tauxRecouvrement")}
                  >
                    Tx Recouv.{" "}
                    <SortIcon active={sort.key === "tauxRecouvrement"} direction={sort.direction} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer bg-surface-container-low hover:bg-surface-container text-right"
                    onClick={() => toggleSort("tauxKyc")}
                  >
                    KYC Def. <SortIcon active={sort.key === "tauxKyc"} direction={sort.direction} />
                  </TableHead>
                  <TableHead className="bg-surface-container-low text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index} className="animate-pulse">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <TableCell key={i}>
                          <div className="h-5 bg-surface-variant rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        title="Aucune agence trouvee"
                        description={
                          activeFilters.length > 0
                            ? "Essayez de modifier vos filtres"
                            : "Aucune donnee disponible"
                        }
                        action={
                          activeFilters.length > 0 ? (
                            <Button
                              variant="outline"
                              onClick={resetFilters}
                              className="gap-2 bg-warning/10 text-warning border-warning/30 hover:bg-warning/20 font-medium text-xs shadow-sm"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reinitialiser
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-surface-container-low transition-colors"
                      onClick={() => handleViewDetail(row.id)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium text-on-surface">{row.name}</div>
                          <div className="text-xs text-on-surface-variant">{row.centre}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{formatNumber(row.managers)}</TableCell>
                      <TableCell className="text-right">
                        <div>{formatNumber(row.accounts)}</div>
                        {row.stopped > 0 && (
                          <div className="text-xs text-error">
                            {formatNumber(row.stopped)} arret.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatXafCompact(row.balance)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          (row.stopRate ?? 0) > 50
                            ? "text-error"
                            : (row.stopRate ?? 0) > 30
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {formatTaux(row.stopRate)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          (row.tauxRecouvrement ?? 100) < 30
                            ? "text-error"
                            : (row.tauxRecouvrement ?? 100) < 50
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {formatTaux(row.tauxRecouvrement)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          (row.tauxKycDefaillant ?? 0) > 70
                            ? "text-error"
                            : (row.tauxKycDefaillant ?? 0) > 50
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {formatTaux(row.tauxKycDefaillant)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBgColor(row.status)}`}
                        >
                          {getStatusLabel(row.status)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination page={page} pageSize={pageSize} total={filteredRows.length} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}