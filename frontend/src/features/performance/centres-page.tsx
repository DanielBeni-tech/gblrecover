import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Building2, CalendarDays, Download, Filter, Gauge, RotateCcw, Target, Users } from "lucide-react";
import { getAvailableMonths, getCentresAgencesReport, listClientsAggregated } from "@/api/client";
import type { AggregatedClientRow } from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { OrgCascadeFilters } from "@/components/filters/org-cascade-filters";
import { xaf, xafCompact } from "@/lib/format";

type CentreRow = { centre: string; agences: number; clients: number; comptes: number; actifs: number; arretes: number; encours: number; facture: number; impaye: number; gestionnaires: number; recouvrement: number };
type ClientListMode = "identified" | "stopped";

function numberValue(value: unknown): number { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function centreName(row: ReportRow): string { return String(row.region_centre ?? row.nom_centre ?? row.centre ?? "Centre non renseigné").trim(); }

function aggregateRows(rows: ReportRow[], centre: string, agency: string): CentreRow[] {
  const groups = new Map<string, CentreRow>();
  for (const row of rows) {
    const rowCentre = centreName(row);
    const rowAgency = String(row.id_agence ?? "");
    if (centre && rowCentre !== centre) continue;
    if (agency && rowAgency !== agency) continue;
    const current = groups.get(rowCentre) ?? { centre: rowCentre, agences: 0, clients: 0, comptes: 0, actifs: 0, arretes: 0, encours: 0, facture: 0, impaye: 0, gestionnaires: 0, recouvrement: 0 };
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
  return [...groups.values()].map((row) => ({ ...row, recouvrement: row.facture > 0 ? ((row.facture - row.impaye) / row.facture) * 100 : 0 })).sort((a, b) => b.encours - a.encours);
}

function percent(value: number): string { return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`; }

function downloadCsv(rows: CentreRow[]) {
  const header = ["Centre", "Agences", "Clients", "Comptes", "Comptes actifs", "Comptes arretes", "Encours XAF", "Facture XAF", "Impayes XAF", "Taux recouvrement"].join(";");
  const body = rows.map((row) => [row.centre, row.agences, row.clients, row.comptes, row.actifs, row.arretes, Math.round(row.encours), Math.round(row.facture), Math.round(row.impaye), row.recouvrement.toFixed(2)].join(";"));
  const blob = new Blob(["\ufeff" + [header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "performance-centres.csv"; link.click(); URL.revokeObjectURL(url);
}

export function CentresPage() {
  const reportQ = useQuery({ queryKey: ["report", "centres-agences"], queryFn: getCentresAgencesReport });
  const monthsQ = useQuery({ queryKey: ["available-months"], queryFn: getAvailableMonths, staleTime: 600_000 });
  const [period, setPeriod] = useState("");
  const [comparison, setComparison] = useState("");
  const [centre, setCentre] = useState("");
  const [agency, setAgency] = useState("");
  const [clientMode, setClientMode] = useState<ClientListMode | null>(null);
  const months = monthsQ.data ?? [];
  const rows = useMemo(() => aggregateRows(reportQ.data ?? [], centre, agency), [reportQ.data, centre, agency]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ agences: sum.agences + row.agences, clients: sum.clients + row.clients, comptes: sum.comptes + row.comptes, actifs: sum.actifs + row.actifs, arretes: sum.arretes + row.arretes, encours: sum.encours + row.encours, facture: sum.facture + row.facture, impaye: sum.impaye + row.impaye, gestionnaires: sum.gestionnaires + row.gestionnaires }), { agences: 0, clients: 0, comptes: 0, actifs: 0, arretes: 0, encours: 0, facture: 0, impaye: 0, gestionnaires: 0 }), [rows]);
  const recovery = totals.facture > 0 ? ((totals.facture - totals.impaye) / totals.facture) * 100 : 0;
  const stopRate = totals.comptes > 0 ? (totals.arretes / totals.comptes) * 100 : 0;
  const maxEncours = Math.max(...rows.map((row) => row.encours), 1);
  const maxClients = Math.max(...rows.map((row) => row.clients), 1);
  const maxComptes = Math.max(...rows.map((row) => row.comptes), 1);
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

  function resetFilters() { setPeriod(""); setComparison(""); setCentre(""); setAgency(""); setClientMode(null); }

  return <div className="space-y-5">
    <PageHeader title="Performance — Centres" subtitle="Comparez les centres de gestion et consultez les portefeuilles réels." actions={<Button variant="outline" onClick={() => downloadCsv(rows)}><Download className="mr-1.5 h-4 w-4" />Exporter</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-on-surface-variant"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Données consolidées au {period || "dernier mois disponible"}</span><span className="flex items-center gap-1.5 text-success"><span className="h-2 w-2 rounded-full bg-success" />Données à jour</span></div>
    <Card className="p-3"><div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end">
      <div><label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">Période de référence</label><Select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">Dernier mois disponible</option>{months.map((month) => <option key={String(month.value)} value={String(month.label ?? month.value)}>{String(month.label ?? month.value)}</option>)}</Select></div>
      <div><label className="mb-1 block text-[11px] font-semibold text-on-surface-variant">Comparer avec</label><Select value={comparison} onChange={(event) => setComparison(event.target.value)}><option value="">Aucune comparaison</option>{months.map((month) => <option key={String(month.value)} value={String(month.label ?? month.value)}>{String(month.label ?? month.value)}</option>)}</Select></div>
      <OrgCascadeFilters value={{ centre, agence: agency }} onChange={({ centre: nextCentre, agence: nextAgency }) => { setCentre(nextCentre); setAgency(nextAgency); }} centreClassName="" agenceClassName="" />
      <div className="flex gap-2"><Button className="flex-1"><Filter className="mr-1.5 h-3.5 w-3.5" />Appliquer</Button><Button variant="outline" aria-label="Réinitialiser les filtres" onClick={resetFilters}><RotateCcw className="h-4 w-4" /></Button></div>
    </div></Card>
    {reportQ.isError && <div className="flex items-center gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container"><AlertTriangle className="h-4 w-4" />Impossible de charger la performance des centres.</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"><KpiCard label="Encours total" value={xafCompact(totals.encours)} icon={Gauge} /><KpiCard label="Dette échue &gt; 30 jours" value={xafCompact(totals.impaye)} icon={AlertTriangle} tone="error" /><button type="button" onClick={() => setClientMode("identified")} className="text-left"><KpiCard label="Clients identifiés" value={totals.clients.toLocaleString("fr-FR")} icon={Users} /></button><button type="button" onClick={() => setClientMode("stopped")} className="text-left"><KpiCard label="Comptes à l'arrêt" value={totals.arretes.toLocaleString("fr-FR")} icon={Activity} tone={stopRate > 10 ? "warning" : "default"} /></button><KpiCard label="Taux de recouvrement" value={percent(recovery)} icon={Target} tone={recovery >= 50 ? "success" : "warning"} /></div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Encours par centre</CardTitle></CardHeader><CardContent><div className="space-y-3">{reportQ.isLoading ? <Skeleton className="h-52 w-full" /> : rows.map((row, index) => <button type="button" key={row.centre} onClick={() => setCentre(centre === row.centre ? "" : row.centre)} className="w-full text-left"><div className="mb-1 flex justify-between text-[12px]"><span className="font-medium">{row.centre}</span><span className="t-tabular text-on-surface-variant">{xafCompact(row.encours)}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-info" : "bg-warning"}`} style={{ width: `${(row.encours / maxEncours) * 100}%` }} /></div></button>)}</div><div className="mt-4 flex justify-between border-t border-outline-variant pt-3 text-[12px] font-semibold"><span>Total sélection</span><span className="t-tabular">{xafCompact(totals.encours)}</span></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Dettes et recouvrement</CardTitle><span className="text-[11px] text-on-surface-variant">{comparison ? `vs ${comparison}` : "Données réelles"}</span></CardHeader><CardContent><div className="mb-5 flex items-center justify-center gap-7"><div className="relative h-36 w-36 rounded-full" style={{ background: `conic-gradient(var(--color-error) 0 ${Math.min(100, recovery)}%, var(--color-success) ${Math.min(100, recovery)}% 100%)` }}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-surface-container-lowest text-center"><strong className="t-tabular text-xl">{percent(recovery)}</strong><span className="text-[10px] text-on-surface-variant">recouvré</span></div></div><div className="space-y-2 text-[12px]"><div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-success" />Recouvré<br /><strong className="ml-4 t-tabular">{xafCompact(Math.max(0, totals.facture - totals.impaye))}</strong></div><div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-error" />Impayé<br /><strong className="ml-4 t-tabular">{xafCompact(totals.impaye)}</strong></div></div></div><div className="flex h-28 items-end gap-3 border-b border-outline-variant">{/*{rows.map((row) => <button type="button" key={row.centre} title={`${row.centre}: ${xaf(row.impaye)}`} onClick={() => setCentre(centre === row.centre ? "" : row.centre)} className="group flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] opacity-0 group-hover:opacity-100">{xafCompact(row.impaye)}</span><span className="w-full max-w-8 rounded-t bg-error" style={{ height: `${Math.max(5, (row.impaye / Math.max(...rows.map((item) => item.impaye), 1)) * 100)}%` }} /><span className="truncate text-[10px] text-on-surface-variant">{row.centre.replace("MC-", "")}</span></button>)}*/}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Classement des centres</CardTitle></CardHeader><CardContent><div className="space-y-2">{rows.map((row, index) => <button type="button" key={row.centre} onClick={() => setCentre(row.centre)} className="flex w-full items-center gap-2 text-left text-[12px] hover:bg-surface-container-low"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium">{row.centre}</span><span className="t-tabular font-semibold">{xafCompact(row.encours)}</span><span className="text-success"><ArrowUp className="h-3 w-3" /></span></button>)}</div><button type="button" onClick={() => setCentre("")} className="mt-4 w-full border-t border-outline-variant pt-3 text-[12px] font-semibold text-primary hover:underline">Voir tous les centres</button></CardContent></Card>
    </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Comptes actifs vs comptes à l'arrêt</CardTitle><span className="text-[11px] text-on-surface-variant">Tous les centres sélectionnés</span></CardHeader><CardContent><div className="space-y-4">{rows.map((row) => <button type="button" key={row.centre} onClick={() => setCentre(centre === row.centre ? "" : row.centre)} className="block w-full text-left"><div className="mb-1 flex items-center justify-between gap-3 text-[12px]"><span className="min-w-0 truncate font-medium">{row.centre}</span><span className="t-tabular shrink-0 text-on-surface-variant">{row.comptes.toLocaleString("fr-FR")} comptes</span></div><div className="flex h-3 overflow-hidden rounded-full bg-surface-container"><span className="bg-success" style={{ width: `${(row.actifs / maxComptes) * 100}%` }} /><span className="bg-warning" style={{ width: `${(row.arretes / maxComptes) * 100}%` }} /></div><div className="mt-1 flex gap-3 text-[10px] text-on-surface-variant"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-success" />Actifs {row.actifs.toLocaleString("fr-FR")}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-warning" />Arrêt {row.arretes.toLocaleString("fr-FR")}</span></div></button>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Clients identifiés par centre</CardTitle><button type="button" onClick={() => setClientMode("identified")} className="text-[11px] font-semibold text-primary hover:underline">Voir la liste</button></CardHeader><CardContent><div className="space-y-4">{rows.map((row, index) => <button type="button" key={row.centre} onClick={() => setCentre(centre === row.centre ? "" : row.centre)} className="block w-full text-left"><div className="mb-1 flex items-center justify-between gap-3 text-[12px]"><span className="min-w-0 truncate font-medium">{row.centre}</span><span className="t-tabular shrink-0">{row.clients.toLocaleString("fr-FR")}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${index % 2 === 0 ? "bg-info" : "bg-primary"}`} style={{ width: `${(row.clients / maxClients) * 100}%` }} /></div></button>)}</div><div className="mt-4 border-t border-outline-variant pt-3 text-[11px] text-on-surface-variant">Total sur le périmètre : <strong className="t-tabular text-on-surface">{totals.clients.toLocaleString("fr-FR")} clients</strong></div></CardContent></Card>
      </div>
    <Card className="overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />Détail des indicateurs par centre</CardTitle><div className="flex items-center gap-2 text-[11px] text-on-surface-variant"><Users className="h-3.5 w-3.5" />{totals.gestionnaires.toLocaleString("fr-FR")} gestionnaires</div></CardHeader><div className="overflow-x-auto"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Centre</TableHead><TableHead className="text-right">Encours total</TableHead><TableHead className="text-right">% du total</TableHead><TableHead className="text-right">Dette impayée</TableHead><TableHead className="text-right">Taux recouvrement</TableHead><TableHead className="text-right">Clients</TableHead><TableHead className="text-right">Comptes à l'arrêt</TableHead><TableHead className="text-right">Évolution</TableHead></TableRow></TableHeader><TableBody>{reportQ.isLoading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) : rows.map((row) => <TableRow key={row.centre} className={centre === row.centre ? "bg-primary-container/30" : ""}><TableCell className="font-semibold">{row.centre}</TableCell><TableCell className="t-tabular text-right">{xafCompact(row.encours)}</TableCell><TableCell className="t-tabular text-right">{totals.encours > 0 ? percent((row.encours / totals.encours) * 100) : "0 %"}</TableCell><TableCell className="t-tabular text-right text-error">{xafCompact(row.impaye)}</TableCell><TableCell className="t-tabular text-right">{percent(row.recouvrement)}</TableCell><TableCell className="t-tabular text-right">{row.clients.toLocaleString("fr-FR")}</TableCell><TableCell className="t-tabular text-right">{row.arretes.toLocaleString("fr-FR")}</TableCell><TableCell className="text-right text-on-surface-variant">{comparison ? <span className="inline-flex items-center gap-1 text-success"><ArrowUp className="h-3 w-3" />Comparé</span> : <span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" />N/D</span>}</TableCell></TableRow>)}</TableBody></Table></div></Card>
    <Modal open={clientMode !== null} onClose={() => setClientMode(null)} title={clientMode === "stopped" ? "Clients avec un compte à l'arrêt" : "Clients identifiés"} width="max-w-4xl"><p className="mb-3 text-[12px] text-on-surface-variant">Résultats réels de la base, filtrés par {centre || "tous les centres"}{agency ? ` · agence ${agency}` : ""}.</p>{clientsQ.isLoading ? <Skeleton className="h-48 w-full" /> : clientsQ.isError ? <p className="text-sm text-error">Impossible de charger les clients.</p> : clients.length === 0 ? <p className="py-8 text-center text-sm text-on-surface-variant">Aucun client dans ce périmètre.</p> : <div className="overflow-x-auto"><Table className="min-w-[700px]"><TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Centre</TableHead><TableHead>Agence</TableHead><TableHead>Statut compte</TableHead><TableHead className="text-right">Solde</TableHead></TableRow></TableHeader><TableBody>{clients.map((client: AggregatedClientRow) => <TableRow key={client.code_client}><TableCell><Link className="font-medium text-primary hover:underline" to={`/clients/${client.code_client}`}>{client.raison_sociale}</Link><div className="text-[11px] text-on-surface-variant">{client.code_client}</div></TableCell><TableCell>{client.nom_centre ?? "—"}</TableCell><TableCell>{client.nom_agence ?? client.id_agence ?? "—"}</TableCell><TableCell>{client.statut_facturation ?? "—"}</TableCell><TableCell className="t-tabular text-right">{xaf(client.total_balance)}</TableCell></TableRow>)}</TableBody></Table></div>}</Modal>
  </div>;
}
