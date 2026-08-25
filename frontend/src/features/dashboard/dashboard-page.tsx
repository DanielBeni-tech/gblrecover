import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Filter, TrendingDown, TrendingUp } from "lucide-react";
import { getDashboard, getTopIndebtedClients, getCamtelDebts, listCentres, listAgencies, getAvailableMonths } from "@/api/client";
import type { DashboardFilters } from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendChart } from "@/components/charts/trend-chart";
import { xaf, dateFr, dateTimeFr } from "@/lib/format";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function DashboardPage() {
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [selectedAgences, setSelectedAgences] = useState<string[]>([]);
  const [selectedMois, setSelectedMois] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>({});

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

  const { data: centresData } = useQuery({
    queryKey: ["centres-list"],
    queryFn: () => listCentres({ pageSize: 50 }),
    staleTime: 300_000,
  });

  const { data: agencesData } = useQuery({
    queryKey: ["agences-list"],
    queryFn: () => listAgencies({ pageSize: 300 }),
    staleTime: 300_000,
  });

  const allCentres = (centresData ?? []).map((c) => c.nom_centre).sort();

  // Carte id_agence -> nom_agence pour l'affichage lisible.
  const agencyLabelById = new Map<string, string>(
    (agencesData ?? []).map((a) => [a.id_agence, a.nom_agence ?? a.id_agence]),
  );

  // Agences proposées : restreintes au(x) centre(s) sélectionné(s).
  const filteredAgencies = (agencesData ?? [])
    .filter((a) => selectedCentres.length === 0 || selectedCentres.includes(a.nom_centre))
    .sort((x, y) => (x.nom_agence ?? x.id_agence).localeCompare(y.nom_agence ?? y.id_agence));
  const filteredAgenceIds = filteredAgencies.map((a) => a.id_agence);
  const agencyName = (id: string) => agencyLabelById.get(id) ?? id;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", appliedFilters],
    queryFn: () => getDashboard(appliedFilters),
  });

  const centreQs = appliedFilters.centres ?? "";
  const agenceQs = appliedFilters.agences ?? "";

  const { data: topIndebted, isLoading: loadingIndebted } = useQuery({
    queryKey: ["dashboard-top-indebted", appliedFilters],
    queryFn: () => getTopIndebtedClients({ centres: centreQs || undefined, agences: agenceQs || undefined, mois: appliedFilters.mois || undefined }),
    staleTime: 60_000,
  });

  const { data: camtelDebts, isLoading: loadingDebts } = useQuery({
    queryKey: ["dashboard-camtel-debts", appliedFilters],
    queryFn: () => getCamtelDebts({ centres: centreQs || undefined, agences: agenceQs || undefined }),
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
          {[0, 1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-28" />))}
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
        <button onClick={() => refetch()} className="mt-3 text-[13px] font-medium text-on-error-container underline">Réessayer</button>
      </div>
    );
  }

  const { kpis, trend, refreshedAt } = data;
  const isFiltered = !!(appliedFilters.centres || appliedFilters.agences || appliedFilters.mois);

  return (
    <>
      <PageHeader size="lg" title="Tableau de bord — Revenue Assurance" subtitle="Vue décisionnelle consolidée des indicateurs de recouvrement CAMTEL" />

      <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
        <RefreshCw className="h-3 w-3" />
        Mises à jour le {dateTimeFr(refreshedAt)}
        {isFiltered && <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">FILTRÉ</span>}
        <button onClick={() => refetch()} aria-label="Actualiser" className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Filter bar ── */}
      <Card className="border-primary/30 bg-surface-container-lowest">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3 text-[13px] font-semibold text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filtres du tableau de bord
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <MultiSelect label="Centre" options={allCentres} selected={selectedCentres} onChange={(v) => { setSelectedCentres(v); setSelectedAgences([]); }} placeholder="Tous les centres" className="min-w-[220px] flex-1" />
            <MultiSelect label="Agence" options={filteredAgenceIds} selected={selectedAgences} onChange={setSelectedAgences} getLabel={agencyName} placeholder="Toutes les agences" className="min-w-[220px] flex-1" />
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Mois</label>
              <Select value={selectedMois} onChange={(e) => setSelectedMois(e.target.value)}>
                {availableMonths.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </Select>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button onClick={handleApply} className="h-9"><Filter className="mr-1.5 h-3.5 w-3.5" />Appliquer</Button>
              <Button onClick={handleReset} variant="outline" className="h-9">Réinitialiser</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Nombre de comptes" value={num(kpis.totalComptes).toLocaleString("fr-FR")} />
        <KpiCard label="Encours total (créances clients)" value={xaf(kpis.encoursTotal)} />
        <KpiCard label="Créances impayées" value={xaf(kpis.echues)} tone="error" />
        <KpiCard label="Créances payées" value={xaf(kpis.payees)} tone="success" />
        <KpiCard label="Taux de recouvrement" value={`${kpis.tauxRecouvrement.toLocaleString("fr-FR")} %`} tone={kpis.tauxRecouvrement > 50 ? "success" : kpis.tauxRecouvrement > 20 ? "warning" : "error"} />
        <KpiCard label="Solde négatif (CAMTEL doit)" value={xaf(Math.abs(kpis.soldeNegatif))} tone={kpis.soldeNegatif < 0 ? "warning" : "default"} />
      </div>

      {/* ── Trend chart ── */}
      <Card>
        <CardHeader><CardTitle>Évolution de la dette vs encaissements</CardTitle></CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-on-surface-variant">Aucune donnée d'évolution disponible pour ce filtre.</div>
          ) : (<TrendChart data={trend} />)}
        </CardContent>
      </Card>

      {/* ── Top 10 Clients les plus endettés ── */}
      <Card className="overflow-hidden border-l-4 border-l-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-error" />Top 10 — Clients les plus endettés</CardTitle>
          <p className="text-[13px] text-on-surface-variant">Classement par montant total de factures impayées (outstanding)</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader><tr>
              <TableHead className="w-8">#</TableHead><TableHead>Client</TableHead><TableHead>Code</TableHead><TableHead>Marché</TableHead>
              <TableHead className="text-right">Nb comptes</TableHead><TableHead className="text-right">Nb factures</TableHead><TableHead className="text-right">Total impayé</TableHead><TableHead>Période</TableHead><TableHead className="text-right">Action</TableHead>
            </tr></TableHeader>
            <TableBody>
              {loadingIndebted ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
              : (topIndebted ?? []).length === 0 ? (<TableRow><TableCell colSpan={9} className="py-8 text-center text-on-surface-variant">Aucune donnée disponible.</TableCell></TableRow>)
              : (topIndebted ?? []).map((row: ReportRow, idx: number) => (
                <TableRow key={idx} className={idx < 3 ? "bg-error-container/10" : ""}>
                  <TableCell className="t-tabular font-bold text-error">{idx + 1}</TableCell>
                  <TableCell className="font-medium max-w-[280px] truncate">{str(row.raison_sociale)}</TableCell>
                  <TableCell className="t-tabular text-data font-medium"><Link to={`/clients/${row.code_client}`} className="hover:underline">{str(row.code_client)}</Link></TableCell>
                  <TableCell>{str(row.marche)}</TableCell>
                  <TableCell className="t-tabular text-right">{num(row.nb_comptes)}</TableCell>
                  <TableCell className="t-tabular text-right">{num(row.nb_factures_impayees)}</TableCell>
                  <TableCell className="t-tabular text-right font-bold text-error">{xaf(num(row.total_impaye))}</TableCell>
                  <TableCell className="t-tabular text-on-surface-variant text-[12px]">{dateFr(str(row.date_plus_ancienne))} → {dateFr(str(row.date_plus_recente))}</TableCell>
                  <TableCell className="text-right"><Link to={`/clients/${row.code_client}`} className="t-label text-primary hover:underline">Ouvrir</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Top 10 Dettes CAMTEL ── */}
      <Card className="overflow-hidden border-l-4 border-l-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-warning" />Top 10 — Dettes CAMTEL (soldes négatifs)</CardTitle>
          <p className="text-[13px] text-on-surface-variant">Comptes où CAMTEL a versé plus que ce qui était facturé (avances / remboursements dus)</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader><tr>
              <TableHead className="w-8">#</TableHead><TableHead>Client</TableHead><TableHead>Code</TableHead><TableHead>Compte</TableHead><TableHead>Marché</TableHead><TableHead>Agence</TableHead><TableHead className="text-right">Dette CAMTEL</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
            </tr></TableHeader>
            <TableBody>
              {loadingDebts ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
              : (camtelDebts ?? []).length === 0 ? (<TableRow><TableCell colSpan={9} className="py-8 text-center text-on-surface-variant">Aucune dette CAMTEL enregistrée.</TableCell></TableRow>)
              : (camtelDebts ?? []).map((row: ReportRow, idx: number) => (
                <TableRow key={idx} className={idx < 3 ? "bg-warning-container/10" : ""}>
                  <TableCell className="t-tabular font-bold text-warning">{idx + 1}</TableCell>
                  <TableCell className="font-medium max-w-[240px] truncate">{str(row.raison_sociale)}</TableCell>
                  <TableCell className="t-tabular text-data font-medium"><Link to={`/clients/${row.code_client}`} className="hover:underline">{str(row.code_client)}</Link></TableCell>
                  <TableCell className="t-tabular">{str(row.num_compte)}</TableCell>
                  <TableCell>{str(row.marche)}</TableCell>
                  <TableCell className="text-[12px] text-on-surface-variant max-w-[180px] truncate">{str(row.nom_agence)}</TableCell>
                  <TableCell className="t-tabular text-right font-bold text-warning">{xaf(Math.abs(num(row.balance)))}</TableCell>
                  <TableCell>{str(row.statut_facturation)}</TableCell>
                  <TableCell className="text-right"><Link to={`/clients/${row.code_client}`} className="t-label text-primary hover:underline">Ouvrir</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
