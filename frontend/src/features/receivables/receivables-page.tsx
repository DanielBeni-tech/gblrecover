import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDebtAgingByCentre,
  getDebtAgingByAgence,
  getDebtAgingTrend,
  getAvailableMonths,
  listCentres,
  listClientMarkets,
} from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart } from "@/components/charts/donut-chart";
import { StackedBarChart, type StackedBarDatum } from "@/components/charts/stacked-bar-chart";
import { xafCompact } from "@/lib/format";
import { Filter, Download, RefreshCcw, AlertTriangle } from "lucide-react";
import { PageLoading } from "@/components/ui/loading";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}
function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

const BUCKET_COLORS = ["#2563eb", "#f59e0b", "#f97316", "#ef4444"];

/** Colored circle badge colors per centre prefix */
const CENTRE_BADGE_COLORS: Record<string, string> = {
  "MC-CENTRE": "#059669",
  "MC-LITTORAL": "#7c3aed",
  "MC-OUEST": "#2563eb",
  "MC-NORD": "#f59e0b",
  "MC-SUD": "#ef4444",
  "MC-SOUTH WEST": "#dc2626",
  "MC-EST": "#0f766e",
  "MC-DG": "#1d4ed8",
  "MC-EXTREME NORD": "#ea580c",
};
const FALLBACK_BADGE_COLORS = ["#059669", "#7c3aed", "#2563eb", "#f59e0b", "#ef4444", "#0f766e", "#1d4ed8", "#ea580c"];

function getCentreBadgeColor(name: string): string {
  if (CENTRE_BADGE_COLORS[name]) return CENTRE_BADGE_COLORS[name];
  const key = Object.keys(CENTRE_BADGE_COLORS).find((k) => name.startsWith(k));
  if (key) return CENTRE_BADGE_COLORS[key];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_BADGE_COLORS[Math.abs(hash) % FALLBACK_BADGE_COLORS.length];
}

function getCentreInitials(name: string): string {
  const clean = name.replace(/^(MC-|DIVISION-)/, "");
  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function CentreBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: getCentreBadgeColor(name) }}
      title={name}
    >
      {getCentreInitials(name)}
    </span>
  );
}

export function ReceivablesPage() {
  const [periode, setPeriode] = useState("");
  const [segment, setSegment] = useState("Centre");
  const [centre, setCentre] = useState("");
  const [agence, setAgence] = useState("");
  const [marche, setMarche] = useState("");

  // Filter data queries
  const { data: months = [] } = useQuery({
    queryKey: ["available-months"],
    queryFn: () => getAvailableMonths().then((rows) => rows.map((r: ReportRow) => ({ label: str(r.label), value: str(r.value) }))),
    staleTime: 300_000,
  });

  const { data: centresList = [] } = useQuery({
    queryKey: ["centres-list"],
    queryFn: () => listCentres({ pageSize: 50 }).then((cs) => cs.map((c) => c.nom_centre)),
    staleTime: 300_000,
  });

  const { data: marketsList = [] } = useQuery({
    queryKey: ["markets-list"],
    queryFn: () => listClientMarkets(),
    staleTime: 300_000,
  });

  // Main data queries
  const filterKey = { centre: centre || undefined, agence: agence || undefined, marche: marche || undefined };

  const { data: centreData = [], isLoading: loadingCentre } = useQuery({
    queryKey: ["debt-aging-centre", filterKey],
    queryFn: () => getDebtAgingByCentre(filterKey),
    staleTime: 30_000,
  });

  const { data: agenceData = [], isLoading: loadingAgence } = useQuery({
    queryKey: ["debt-aging-agence", { centre: filterKey.centre, marche: filterKey.marche }],
    queryFn: () => getDebtAgingByAgence({ centre: filterKey.centre, marche: filterKey.marche, limit: 10 }),
    staleTime: 30_000,
  });

  const { data: trendData = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["debt-aging-trend", filterKey],
    queryFn: () => getDebtAgingTrend(filterKey),
    staleTime: 30_000,
  });

  // ---- Compute national totals from centre data ----
  const national = useMemo(() => {
    let t0 = 0, t1 = 0, t2 = 0, t3 = 0, total = 0;
    for (const r of centreData) {
      t0 += num(r.tranche_0_30); t1 += num(r.tranche_31_60);
      t2 += num(r.tranche_61_90); t3 += num(r.tranche_plus_90);
      total += num(r.total);
    }
    return { t0, t1, t2, t3, total };
  }, [centreData]);

  const donutData = useMemo(() => {
    if (national.total === 0) return [];
    return [
      { label: "0 – 30 jours", value: national.t0, color: BUCKET_COLORS[0] },
      { label: "31 – 60 jours", value: national.t1, color: BUCKET_COLORS[1] },
      { label: "61 – 90 jours", value: national.t2, color: BUCKET_COLORS[2] },
      { label: "> 90 jours", value: national.t3, color: BUCKET_COLORS[3] },
    ];
  }, [national]);

  const pct90 = national.total > 0 ? ((national.t3 / national.total) * 100).toFixed(1) : "0";

  // ---- Trend data for stacked bars ----
  const stackedData: StackedBarDatum[] = useMemo(() => {
    return trendData.map((r) => ({
      mois: str(r.mois),
      t0_30: num(r.tranche_0_30),
      t31_60: num(r.tranche_31_60),
      t61_90: num(r.tranche_61_90),
      t90plus: num(r.tranche_plus_90),
    }));
  }, [trendData]);

  // ---- Centre table rows ----
  const centreRows = useMemo(() => {
    return centreData.map((r) => {
      const total = num(r.total);
      const pctNational = national.total > 0 ? ((total / national.total) * 100).toFixed(1) : "0";
      const t90 = num(r.tranche_plus_90);
      const pct90 = total > 0 ? ((t90 / total) * 100).toFixed(1) : "0";
      const tauxRecouv = num(r.taux_recouvrement_pct);
      return {
        centre: str(r.nom_centre),
        encours: total,
        pctNational,
        t90,
        pct90,
        tauxRecouv,
      };
    });
  }, [centreData, national]);

  // ---- Difficulty bars (top centres by >90j) ----
  const difficultyRows = useMemo(() => {
    return [...centreData]
      .sort((a, b) => num(b.tranche_plus_90) - num(a.tranche_plus_90))
      .slice(0, 5)
      .map((r) => {
        const total = num(r.total);
        const t90 = num(r.tranche_plus_90);
        const pct90 = total > 0 ? ((t90 / total) * 100).toFixed(1) : "0";
        const pctNational90 = national.t3 > 0 ? ((t90 / national.t3) * 100).toFixed(1) : "0";
        return { centre: str(r.nom_centre), t90, pct90, pctNational90 };
      });
  }, [centreData, national]);
  const maxDiff = Math.max(...difficultyRows.map((r) => r.t90), 1);

  // ---- Agency table rows ----
  const agencyRows = useMemo(() => {
    return agenceData.map((r) => {
      const total = num(r.total);
      const agenceCentre = str(r.nom_centre);
      const encoursPctCentre = total > 0 ? ((total / national.total) * 100).toFixed(1) : "0";
      const t90 = num(r.tranche_plus_90);
      const pct90 = total > 0 ? ((t90 / total) * 100).toFixed(1) : "0";
      const tauxRecouv = num(r.taux_recouvrement_pct);
      return {
        agence: str(r.nom_agence),
        centre: agenceCentre,
        encours: total,
        encoursPctCentre,
        t90,
        pct90,
        tauxRecouv,
      };
    });
  }, [agenceData, national]);

  const isLoading = loadingCentre || loadingAgence || loadingTrend;

  return (
    <>
      <PageHeader
        title="Analyse de la dette"
        subtitle="Décomposez l’encours par ancienneté pour identifier où relancer."
        nextAction="Repérez la tranche > 90 jours, puis ouvrez le centre concerné."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" /> Exporter
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="mt-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Période de référence
              </label>
              <Select value={periode} onChange={(e) => setPeriode(e.target.value)}>
                <option value="">Toutes les périodes</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Segmenter par
              </label>
              <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="Centre">Centre</option>
                <option value="Agence">Agence</option>
                <option value="Marché">Marché</option>
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Centre
              </label>
              <Select value={centre} onChange={(e) => setCentre(e.target.value)}>
                <option value="">Tous les centres</option>
                {centresList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Agence
              </label>
              <Select value={agence} onChange={(e) => setAgence(e.target.value)}>
                <option value="">Toutes les agences</option>
              </Select>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Marché
              </label>
              <Select value={marche} onChange={(e) => setMarche(e.target.value)}>
                <option value="">Tous les marchés</option>
                {marketsList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <Button variant="primary" size="sm" className="gap-1.5">
              <Filter className="h-4 w-4" /> Appliquer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => { setPeriode(""); setCentre(""); setAgence(""); setMarche(""); }}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <PageLoading className="mt-4" />
      ) : (
        <div className="mt-4 space-y-4">
          {/* Row 1: Donut + Trend */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Section 1: Aging Bucket National */}
            <Card>
              <CardHeader>
                <CardTitle>1. Aging bucket national — Dettes par ancienneté</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={donutData} centerLabel="XAF" centerValue={xafCompact(national.total)} />
                {num(pct90) > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-error/5 px-3 py-2 text-[12px] text-error">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>{pct90}%</strong> de la dette totale est à plus de 90 jours de retard
                    </span>
                  </div>
                )}
                {/* Table of buckets */}
                <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="px-3 py-2 text-left font-semibold text-on-surface-variant">Tranche</th>
                        <th className="px-3 py-2 text-right font-semibold text-on-surface-variant">Montant (XAF)</th>
                        <th className="px-3 py-2 text-right font-semibold text-on-surface-variant">% du total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donutData.map((d, i) => (
                        <tr key={d.label} className="border-t border-outline-variant">
                          <td className="px-3 py-1.5">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[i] }} />
                              {d.label}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right t-tabular font-semibold">{xafCompact(d.value)}</td>
                          <td className="px-3 py-1.5 text-right t-tabular text-on-surface-variant">
                            {national.total > 0 ? ((d.value / national.total) * 100).toFixed(1) : "0"} %
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-outline-variant bg-surface-container-low font-bold">
                        <td className="px-3 py-1.5">Total</td>
                        <td className="px-3 py-1.5 text-right t-tabular">{xafCompact(national.total)}</td>
                        <td className="px-3 py-1.5 text-right t-tabular">100 %</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Évolution des tranches */}
            <Card>
              <CardHeader>
                <CardTitle>2. Évolution des tranches d'ancienneté (12 mois)</CardTitle>
                <div className="flex gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Montant</span>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant">% du total</span>
                </div>
              </CardHeader>
              <CardContent>
                {stackedData.length > 0 ? (
                  <StackedBarChart data={stackedData} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-on-surface-variant">
                    Aucune évolution pour ce filtre. Choisissez une autre période ou un autre centre.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Centre table + Difficulty bars side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Section 3: Décomposition par centre (2/3 width) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>3. Décomposition de la dette par centre</CardTitle>
                <span className="text-[12px] text-on-surface-variant">Voir le détail par agence →</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead>Centre</TableHead>
                        <TableHead className="text-right">Encours total (M XAF)</TableHead>
                        <TableHead className="text-right">% du total</TableHead>
                        <TableHead className="text-right">&gt; 90 jours (M XAF)</TableHead>
                        <TableHead className="text-right">% de &gt; 90 jours</TableHead>
                        <TableHead className="text-right">Taux de recouvrement</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {centreRows.map((r) => (
                        <TableRow key={r.centre}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <CentreBadge name={r.centre} />
                              {r.centre}
                            </span>
                          </TableCell>
                          <TableCell className="text-right t-tabular">{xafCompact(r.encours)}</TableCell>
                          <TableCell className="text-right t-tabular text-on-surface-variant">{r.pctNational} %</TableCell>
                          <TableCell className="text-right t-tabular text-error font-semibold">{xafCompact(r.t90)}</TableCell>
                          <TableCell className="text-right t-tabular text-on-surface-variant">{r.pct90} %</TableCell>
                          <TableCell className="text-right t-tabular text-on-surface-variant">{r.tauxRecouv} %</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-surface-container-low font-bold">
                        <TableCell>TOTAL NATIONAL</TableCell>
                        <TableCell className="text-right t-tabular">{xafCompact(national.total)}</TableCell>
                        <TableCell className="text-right t-tabular">100 %</TableCell>
                        <TableCell className="text-right t-tabular text-error">{xafCompact(national.t3)}</TableCell>
                        <TableCell className="text-right t-tabular">100 %</TableCell>
                        <TableCell className="text-right t-tabular">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Centres les plus en difficulté (1/3 width) */}
            <Card>
              <CardHeader>
                <CardTitle>4. Centres les plus en difficulté (&gt; 90 jours)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {difficultyRows.map((r) => (
                    <div key={r.centre} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[12px] font-medium text-on-surface">
                          <CentreBadge name={r.centre} />
                          <span className="truncate">{r.centre}</span>
                        </span>
                        <span className="text-[12px] font-semibold text-error">{xafCompact(r.t90)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative h-4 flex-1 overflow-hidden rounded bg-surface-container-low">
                          <div
                            className="absolute inset-y-0 left-0 rounded bg-error transition-all"
                            style={{ width: `${Math.max(2, (r.t90 / maxDiff) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right t-tabular text-[11px] text-on-surface-variant">
                          {r.pctNational90} %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <span className="text-[12px] text-primary cursor-pointer hover:underline">Voir tous les centres →</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 5: Décomposition par agence */}
          <Card>
            <CardHeader>
              <CardTitle>5. Décomposition par agence (Top 10 par encours)</CardTitle>
              <div className="flex gap-2">
                <span className="text-[12px] text-on-surface-variant">Voir toutes les agences →</span>
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-3.5 w-3.5" /> Exporter le tableau
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Agence</TableHead>
                      <TableHead>Centre</TableHead>
                      <TableHead className="text-right">Encours total (M XAF)</TableHead>
                      <TableHead className="text-right">% du total centre</TableHead>
                      <TableHead className="text-right">&gt; 90 jours (M XAF)</TableHead>
                      <TableHead className="text-right">% de &gt; 90 jours</TableHead>
                      <TableHead className="text-right">Taux de recouvrement</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {agencyRows.map((r) => (
                      <TableRow key={r.agence}>
                        <TableCell className="font-medium">{r.agence}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-on-surface-variant">
                            <CentreBadge name={r.centre} />
                            {r.centre}
                          </span>
                        </TableCell>
                        <TableCell className="text-right t-tabular">{xafCompact(r.encours)}</TableCell>
                        <TableCell className="text-right t-tabular text-on-surface-variant">{r.encoursPctCentre} %</TableCell>
                        <TableCell className="text-right t-tabular text-error font-semibold">{xafCompact(r.t90)}</TableCell>
                        <TableCell className="text-right t-tabular text-on-surface-variant">{r.pct90} %</TableCell>
                        <TableCell className="text-right t-tabular text-on-surface-variant">{r.tauxRecouv} %</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
