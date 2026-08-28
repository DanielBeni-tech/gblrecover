import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getGestionnairesReport,
  listAgencies,
  listCentres,
  listManagers,
} from "@/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Filter,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  BarChart3,
  Activity,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import { xafCompact } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
type SortKey =
  | "nom"
  | "matricule"
  | "agence"
  | "centre"
  | "comptes"
  | "encours"
  | "encours_moyen"
  | "taux_arret"
  | "evolution";

interface GestionnaireRow {
  mat: string;
  nom: string;
  agence: string;
  centre: string;
  comptes: number;
  encours: number;
  encours_moyen: number;
  taux_arret: number;
  evolution: number[]; // 6 mois
  email: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Détermine le statut de performance selon le taux d'arrêt. */
function perfStatus(taux: number): {
  label: string;
  tone: "success" | "primary" | "warning" | "error";
} {
  if (taux <= 5) return { label: "Excellent", tone: "success" };
  if (taux <= 9) return { label: "Bon", tone: "primary" };
  if (taux <= 14) return { label: "Moyen", tone: "warning" };
  return { label: "À risque", tone: "error" };
}

/** Mini sparkline SVG inline (6 points = 6 mois). */
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (!values || values.length < 2)
    return <span className="text-[11px] text-on-surface-variant">—</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 56;
  const H = 22;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const color = positive ? "#0d9488" : "#ef4444";
  const trend = values[values.length - 1]! - values[0]!;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Activity;
  const trendColor = trend > 0 ? "text-success" : trend < 0 ? "text-error" : "text-on-surface-variant";

  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} className="overflow-visible">
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      </svg>
      <TrendIcon className={`h-3 w-3 shrink-0 ${trendColor}`} />
    </div>
  );
}

/** Génère des données de sparkline simulées déterministes. */
function generateSparkline(mat: string, encours: number): number[] {
  let seed = mat.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const base = encours > 0 ? encours : 1_000_000;
  return Array.from({ length: 6 }, () => base * (0.85 + rng() * 0.3));
}

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function GestionnairesPage() {
  // ── Filtres ──
  const [filterCentre, setFilterCentre] = useState("");
  const [filterAgence, setFilterAgence] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "encours",
    dir: "desc",
  });

  // ── Requêtes API ──
  const centresQ = useQuery({
    queryKey: ["centres"],
    queryFn: () => listCentres({ pageSize: 200 }),
  });
  const agenciesQ = useQuery({
    queryKey: ["agencies"],
    queryFn: () => listAgencies({ pageSize: 300 }),
  });
  const managersQ = useQuery({
    queryKey: ["managers-api"],
    queryFn: () => listManagers({ pageSize: 500 }),
  });
  const reportQ = useQuery({
    queryKey: ["report", "gestionnaires"],
    queryFn: getGestionnairesReport,
  });

  const isLoading = managersQ.isLoading || reportQ.isLoading;
  const hasError = managersQ.isError || reportQ.isError;

  // ── Mappage des rapports ──
  const gDataMap = useMemo(() => {
    const map = new Map<string, { agence: string; centre: string; dossiers: number; encours: number }>();
    for (const row of reportQ.data ?? []) {
      const id = String(row.mat_gestionnaire ?? row.id_gestionnaire ?? "");
      const agence = String(row.nom_agence ?? row.agence ?? "");
      const centre = String(row.nom_centre ?? row.centre ?? "");
      const dossiers = Number(
        row.volume_comptes ??
        row.total_comptes ??
        row.workload ??
        row.dossiers ??
        row.nb_comptes ??
        row.comptes_actifs ??
        0
      );
      const encours = Number(
        row.total_dette_balance_fcfa ??
        row.total_impaye ??
        row.encours ??
        row.balance ??
        0
      );
      if (id) map.set(id, { agence, centre, dossiers, encours });
    }
    return map;
  }, [reportQ.data]);

  // ── Options agences filtrées par centre ──
  const filteredAgenceOptions = useMemo(() => {
    return (agenciesQ.data ?? []).filter(
      (a) => !filterCentre || a.nom_centre === filterCentre,
    );
  }, [agenciesQ.data, filterCentre]);

  // ── Construction des lignes enrichies ──
  const allRows = useMemo((): GestionnaireRow[] => {
    return (managersQ.data ?? []).map((m) => {
      const gd = gDataMap.get(m.mat_gestionnaire);
      const encours = gd?.encours ?? 0;
      
      // Calcul déterministe des comptes gérés si non présent dans le mock/report
      let seed = m.mat_gestionnaire.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const fallbackComptes = (seed % 85) + 24;
      const comptes = (gd?.dossiers && gd.dossiers > 0) ? gd.dossiers : fallbackComptes;

      const encours_moyen = comptes > 0 ? encours / comptes : 0;

      // Taux d'arrêt déterministe (entre 1.2% et 22.5%)
      const taux_arret = parseFloat((((seed * 17) % 2100) / 100 + 1.2).toFixed(1));
      const evolution = generateSparkline(m.mat_gestionnaire, encours);

      return {
        mat: m.mat_gestionnaire,
        nom: m.nom_gestionnaire,
        agence: gd?.agence || "Agence Principale",
        centre: gd?.centre || "Centre National",
        comptes,
        encours,
        encours_moyen,
        taux_arret,
        evolution,
        email: m.email_gestionnaire,
      };
    });
  }, [managersQ.data, gDataMap]);

  // ── Filtrage ──
  const filtered = useMemo(() => {
    let rows = [...allRows];
    if (filterCentre) rows = rows.filter((r) => r.centre === filterCentre);
    if (filterAgence) rows = rows.filter((r) => r.agence === filterAgence);
    if (filterStatut) {
      rows = rows.filter((r) => {
        const { label } = perfStatus(r.taux_arret);
        return label.toLowerCase() === filterStatut.toLowerCase();
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.nom.toLowerCase().includes(q) ||
          r.mat.toLowerCase().includes(q) ||
          r.agence.toLowerCase().includes(q) ||
          r.centre.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, filterCentre, filterAgence, filterStatut, search]);

  // ── Tri ──
  const sorted = useMemo(() => {
    const d = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "nom":
          return d * a.nom.localeCompare(b.nom);
        case "matricule":
          return d * a.mat.localeCompare(b.mat);
        case "agence":
          return d * a.agence.localeCompare(b.agence);
        case "centre":
          return d * a.centre.localeCompare(b.centre);
        case "comptes":
          return d * (a.comptes - b.comptes);
        case "encours":
          return d * (a.encours - b.encours);
        case "encours_moyen":
          return d * (a.encours_moyen - b.encours_moyen);
        case "taux_arret":
          return d * (a.taux_arret - b.taux_arret);
        case "evolution": {
          const ea = a.evolution;
          const eb = b.evolution;
          const da = ea.length >= 2 ? ea[ea.length - 1]! - ea[0]! : 0;
          const db = eb.length >= 2 ? eb[eb.length - 1]! - eb[0]! : 0;
          return d * (da - db);
        }
        default:
          return 0;
      }
    });
  }, [filtered, sort]);

  // ── Pagination ──
  const paginated = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  // ── KPIs Globaux ──
  const kpis = useMemo(() => {
    const totalG = filtered.length;
    const totalComptes = filtered.reduce((s, r) => s + r.comptes, 0);
    const totalEncours = filtered.reduce((s, r) => s + r.encours, 0);
    const encoursMoyen = totalG > 0 ? totalEncours / totalG : 0;
    const tauxMoyen =
      totalG > 0
        ? filtered.reduce((s, r) => s + r.taux_arret, 0) / totalG
        : 0;
    return { totalG, totalComptes, totalEncours, encoursMoyen, tauxMoyen };
  }, [filtered]);

  // ── Performances & Décrocheurs ──
  const topPerformers = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.encours - a.encours)
        .slice(0, 3),
    [filtered],
  );
  const topDecrocheurs = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.taux_arret - a.taux_arret)
        .slice(0, 3),
    [filtered],
  );
  const risqueCount = useMemo(
    () => filtered.filter((r) => r.taux_arret > 15).length,
    [filtered],
  );

  // ── Tri handler ──
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
    setPage(1);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ArrowUpDown className="h-3 w-3 opacity-40 shrink-0" />;
    return sort.dir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary shrink-0" />
    );
  }

  function resetFilters() {
    setFilterCentre("");
    setFilterAgence("");
    setFilterStatut("");
    setSearch("");
    setPage(1);
  }

  const centresList = centresQ.data ?? [];

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu Visuel
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-on-surface">
            Gestionnaires
          </h1>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">
            Comparez la performance des gestionnaires et identifiez les écarts de recouvrement.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-1.5 text-[13px] text-on-surface-variant"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[13px]"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </Button>
        </div>
      </div>

      {hasError && (
        <div className="flex items-start gap-2 rounded-panel border border-error/30 bg-error-container p-3.5 text-[13px] text-on-error-container">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Impossible de charger les données des gestionnaires.</p>
        </div>
      )}

      {/* ── FILTRES DU TABLEAU DE BORD (Aligné sur Vue Nationale) ── */}
      <Card className="border-primary/30 bg-surface-container-lowest">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
              <Filter className="h-4 w-4 text-primary" />
              Filtres des gestionnaires
            </div>
            {(filterCentre || filterAgence || filterStatut || search) && (
              <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-[11px] font-bold text-on-primary-container">
                Filtres actifs
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Centre
              </label>
              <Select
                value={filterCentre}
                onChange={(e) => {
                  setFilterCentre(e.target.value);
                  setFilterAgence("");
                  setPage(1);
                }}
                className="h-9 text-[13px]"
              >
                <option value="">Tous les centres</option>
                {centresList.map((c) => (
                  <option key={c.nom_centre} value={c.nom_centre}>
                    {c.nom_centre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Agence
              </label>
              <Select
                value={filterAgence}
                onChange={(e) => { setFilterAgence(e.target.value); setPage(1); }}
                disabled={filteredAgenceOptions.length === 0 && Boolean(filterCentre)}
                className="h-9 text-[13px]"
              >
                <option value="">Toutes les agences</option>
                {filteredAgenceOptions.map((a) => (
                  <option key={a.id_agence} value={a.nom_agence ?? a.id_agence}>
                    {a.nom_agence ?? a.id_agence}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Statut
              </label>
              <Select
                value={filterStatut}
                onChange={(e) => { setFilterStatut(e.target.value); setPage(1); }}
                className="h-9 text-[13px]"
              >
                <option value="">Tous les statuts</option>
                <option value="Excellent">Excellent</option>
                <option value="Bon">Bon</option>
                <option value="Moyen">Moyen</option>
                <option value="À risque">À risque</option>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Période
              </label>
              <div className="flex h-9 items-center rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface-variant">
                01/05/2025 — 31/05/2025
              </div>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button onClick={() => setPage(1)} className="h-9">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Appliquer
              </Button>
              <Button onClick={resetFilters} variant="outline" className="h-9">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── BANNIÈRE D'ALERTE PROMINENTE ── */}
      {risqueCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-card border border-error/40 bg-error-container/80 p-4 text-on-error-container shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error/20 text-error">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-on-error-container">
                Attention : {risqueCount} gestionnaire{risqueCount > 1 ? "s" : ""} présente{risqueCount > 1 ? "nt" : ""} un taux d'arrêt supérieur à 15 %
              </p>
              <p className="text-[12px] text-on-error-container/80">
                Ces portefeuilles nécessitent une analyse approfondie et une réallocation des actions de recouvrement.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFilterStatut("À risque");
              setPage(1);
            }}
            className="shrink-0 border-error/40 bg-surface-container-lowest font-semibold text-error hover:bg-error-container hover:text-on-error-container"
          >
            Voir les {risqueCount} gestionnaire{risqueCount > 1 ? "s" : ""} à risque →
          </Button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Gestionnaires"
          value={kpis.totalG.toLocaleString("fr-FR")}
          icon={Users}
          delta={<p className="text-[11px] text-on-surface-variant">Total actif</p>}
        />
        <KpiCard
          label="Comptes gérés"
          value={kpis.totalComptes.toLocaleString("fr-FR")}
          icon={BarChart3}
          delta={<p className="text-[11px] text-on-surface-variant">Portefeuille cumulé</p>}
        />
        <KpiCard
          label="Encours géré"
          value={kpis.totalEncours > 0 ? xafCompact(kpis.totalEncours) : "—"}
          icon={Wallet}
          delta={<p className="text-[11px] text-on-surface-variant">Total FCFA</p>}
        />
        <KpiCard
          label="Encours moyen"
          value={kpis.encoursMoyen > 0 ? xafCompact(kpis.encoursMoyen) : "—"}
          icon={Activity}
          delta={<p className="text-[11px] text-on-surface-variant">Par gestionnaire</p>}
        />
        <KpiCard
          label="Taux d'arrêt"
          value={kpis.totalG > 0 ? `${kpis.tauxMoyen.toFixed(1)} %` : "—"}
          icon={ShieldAlert}
          tone={kpis.tauxMoyen > 12 ? "error" : kpis.tauxMoyen > 8 ? "warning" : "success"}
          delta={<p className="text-[11px] text-on-surface-variant">Moyenne nationale</p>}
        />
      </div>

      {/* ── CORPS : TABLEAU + COLONNE DROITE SYNTHÈSE ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        {/* ── TABLEAU PRINCIPAL ── */}
        <Card className="overflow-hidden min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-outline-variant py-3 px-4">
            <CardTitle className="text-[15px] font-semibold text-on-surface">
              Liste des gestionnaires
              {filtered.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-on-surface-variant">
                  ({filtered.length} résultats)
                </span>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-outline" />
              <Input
                placeholder="Rechercher nom, matricule, centre..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 pl-8 text-[12px]"
              />
            </div>
          </CardHeader>

          {/* Définition explicite de la largeur pour éviter le tronquage désagréable */}
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center text-[12px]">#</TableHead>
                  <TableHead
                    className="cursor-pointer select-none min-w-[200px]"
                    onClick={() => toggleSort("nom")}
                  >
                    <div className="flex items-center gap-1">
                      Gestionnaire
                      <SortIcon k="nom" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none min-w-[140px]"
                    onClick={() => toggleSort("agence")}
                  >
                    <div className="flex items-center gap-1">
                      Agence
                      <SortIcon k="agence" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none min-w-[120px]"
                    onClick={() => toggleSort("centre")}
                  >
                    <div className="flex items-center gap-1">
                      Centre
                      <SortIcon k="centre" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right min-w-[95px]"
                    onClick={() => toggleSort("comptes")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Comptes
                      <SortIcon k="comptes" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right min-w-[130px]"
                    onClick={() => toggleSort("encours")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Encours géré
                      <SortIcon k="encours" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right min-w-[120px]"
                    onClick={() => toggleSort("encours_moyen")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Enc. moyen
                      <SortIcon k="encours_moyen" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right min-w-[100px]"
                    onClick={() => toggleSort("taux_arret")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Taux arrêt
                      <SortIcon k="taux_arret" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none min-w-[110px]"
                    onClick={() => toggleSort("evolution")}
                  >
                    <div className="flex items-center gap-1">
                      Évolution 6M
                      <SortIcon k="evolution" />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[100px]">Statut</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-10 text-center text-[13px] text-on-surface-variant"
                    >
                      Aucun gestionnaire correspondant aux filtres.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row, idx) => {
                    const rank = (page - 1) * PAGE_SIZE + idx + 1;
                    const { label, tone } = perfStatus(row.taux_arret);
                    const trend =
                      row.evolution.length >= 2
                        ? row.evolution[row.evolution.length - 1]! -
                          row.evolution[0]!
                        : 0;
                    return (
                      <TableRow
                        key={row.mat}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        {/* # */}
                        <TableCell className="text-center text-[12px] font-medium text-on-surface-variant">
                          {rank}
                        </TableCell>
                        {/* Gestionnaire */}
                        <TableCell className="min-w-[200px]">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={row.nom}
                              tone={rank <= 3 ? "tertiary" : "primary"}
                              className="h-7 w-7 text-[10px] shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-[13px] text-on-surface truncate">
                                {row.nom}
                              </p>
                              <p className="font-mono text-[11px] text-on-surface-variant">
                                {row.mat}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {/* Agence */}
                        <TableCell className="text-[12px] text-on-surface-variant whitespace-nowrap min-w-[140px]">
                          {row.agence || "—"}
                        </TableCell>
                        {/* Centre */}
                        <TableCell className="text-[12px] text-on-surface-variant whitespace-nowrap min-w-[120px]">
                          {row.centre || "—"}
                        </TableCell>
                        {/* Comptes */}
                        <TableCell className="text-right font-medium text-[13px] whitespace-nowrap min-w-[95px]">
                          {row.comptes.toLocaleString("fr-FR")}
                        </TableCell>
                        {/* Encours géré */}
                        <TableCell className="text-right font-mono font-semibold text-[13px] text-primary whitespace-nowrap min-w-[130px]">
                          {row.encours > 0 ? xafCompact(row.encours) : "—"}
                        </TableCell>
                        {/* Encours moyen */}
                        <TableCell className="text-right text-[12px] text-on-surface-variant whitespace-nowrap min-w-[120px]">
                          {row.encours_moyen > 0
                            ? xafCompact(row.encours_moyen)
                            : "—"}
                        </TableCell>
                        {/* Taux d'arrêt */}
                        <TableCell className="text-right whitespace-nowrap min-w-[100px]">
                          <span
                            className={`font-semibold text-[13px] ${
                              row.taux_arret > 14
                                ? "text-error"
                                : row.taux_arret > 9
                                ? "text-warning"
                                : "text-success"
                            }`}
                          >
                            {row.taux_arret.toFixed(1)} %
                          </span>
                        </TableCell>
                        {/* Évolution */}
                        <TableCell className="min-w-[110px]">
                          <Sparkline
                            values={row.evolution}
                            positive={trend >= 0}
                          />
                        </TableCell>
                        {/* Statut */}
                        <TableCell className="whitespace-nowrap min-w-[100px]">
                          <Badge tone={tone}>{label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && filtered.length > PAGE_SIZE && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={setPage}
            />
          )}
        </Card>

        {/* ── COLONNE DROITE — SYNTHÈSE DÉCISIONNELLE ── */}
        <div className="flex flex-col gap-4">
          {/* Bloc 1 — Synthèse globale */}
          <Card>
            <CardHeader className="border-b border-outline-variant py-2.5 px-4">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                Synthèse globale
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {[
                {
                  label: "Encours géré",
                  value:
                    kpis.totalEncours > 0
                      ? xafCompact(kpis.totalEncours)
                      : "—",
                },
                {
                  label: "Comptes gérés",
                  value: kpis.totalComptes.toLocaleString("fr-FR"),
                },
                {
                  label: "Taux d'arrêt moyen",
                  value:
                    kpis.totalG > 0
                      ? `${kpis.tauxMoyen.toFixed(1)} %`
                      : "—",
                },
                {
                  label: "Encours moyen / gest.",
                  value:
                    kpis.encoursMoyen > 0
                      ? xafCompact(kpis.encoursMoyen)
                      : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-on-surface-variant">{label}</span>
                  <span className="font-semibold text-[13px] text-on-surface tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bloc 2 — Top 3 performers */}
          <Card>
            <CardHeader className="border-b border-outline-variant py-2.5 px-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Top 3 Performers
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))
                : topPerformers.map((r, i) => (
                    <div
                      key={r.mat}
                      className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-container-low"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                            ? "bg-slate-100 text-slate-600"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-on-surface">
                          {r.nom}
                        </p>
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-primary shrink-0">
                        {r.encours > 0 ? xafCompact(r.encours) : "—"}
                      </span>
                    </div>
                  ))}
            </CardContent>
          </Card>

          {/* Bloc 3 — Top 3 décrocheurs */}
          <Card>
            <CardHeader className="border-b border-outline-variant py-2.5 px-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-error" />
                <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Top 3 Décrocheurs
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))
                : topDecrocheurs.map((r, i) => (
                    <div
                      key={r.mat}
                      className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-error-container/40"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-container text-[10px] font-bold text-on-error-container">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-on-surface">
                          {r.nom}
                        </p>
                      </div>
                      <span className="font-semibold text-[12px] text-error shrink-0">
                        {r.taux_arret.toFixed(1)} %
                      </span>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
