import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { getDashboard } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, customerStatusLabel, customerStatusTone } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendChart } from "@/components/charts/trend-chart";
import { AgingList } from "@/components/charts/aging-chart";
import { xaf, dateFr, dateTimeFr } from "@/lib/format";
import { Select } from "@/components/ui/select";

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[300px] lg:col-span-2" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-panel border border-error/30 bg-error-container p-6">
        <p className="flex items-center gap-2 font-semibold text-on-error-container">
          <AlertTriangle className="h-4 w-4" /> Impossible de charger le tableau de bord.
        </p>
        <button onClick={() => refetch()} className="mt-3 text-[13px] font-medium text-on-error-container underline">
          Réessayer
        </button>
      </div>
    );
  }

  const { kpis, aging, trend, priorities, refreshedAt } = data;

  return (
    <>
      <PageHeader
        size="lg"
        title="Tableau de bord — Revenue Assurance"
        subtitle="Vue consolidée des indicateurs de recouvrement"
        actions={
          <>
            <Select aria-label="Période" defaultValue="30j" className="h-9 w-auto">
              <option value="30j">30 derniers jours</option>
              <option value="trimestre">Dernier trimestre</option>
              <option value="annee">Depuis janvier</option>
            </Select>
            <Select aria-label="Périmètre" defaultValue="tous" className="h-9 w-auto">
              <option value="tous">Tous les centres</option>
              <option value="cg-entreprises">CG Entreprises</option>
              <option value="cg-etat">CG État</option>
              <option value="cg-pme">CG PME</option>
              <option value="cg-vip">CG Particuliers VIP</option>
            </Select>
          </>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
        <RefreshCw className="h-3 w-3" />
        Données du lot « GBL — Juillet 2026 » · mises à jour le {dateTimeFr(refreshedAt)}
        <button onClick={() => refetch()} aria-label="Actualiser" className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Encours total"
          value={xaf(kpis.encoursTotal)}
          delta={
            <span className="flex items-center gap-1 text-[12px] text-error">
              <TrendingUp className="h-3.5 w-3.5" /> +2,4 % vs mois dernier
            </span>
          }
        />
        <KpiCard
          label="Créances échues"
          value={xaf(kpis.echues)}
          tone="error"
          delta={
            <span className="flex items-center gap-1 text-[12px] text-error">
              <AlertTriangle className="h-3.5 w-3.5" /> Action requise
            </span>
          }
        />
        <KpiCard
          label="Taux de recouvrement"
          value={`${kpis.tauxRecouvrement.toLocaleString("fr-FR")} %`}
          delta={
            <span className="flex items-center gap-1 text-[12px] text-primary">
              <TrendingUp className="h-3.5 w-3.5" /> Objectif : 80 %
            </span>
          }
        />
        <KpiCard
          label="Actions en retard"
          value={kpis.actionsEnRetard.toLocaleString("fr-FR")}
          delta={
            <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
              <Clock className="h-3.5 w-3.5" /> Échéances dépassées
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution de la dette vs encaissements</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aging de la dette</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingList data={aging} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dossiers prioritaires</CardTitle>
          <Link to="/clients" className="t-label flex items-center gap-1 text-primary hover:underline">
            Voir tout <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Client ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Montant échu</TableHead>
                <TableHead>Dernière action</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {priorities.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="t-tabular text-primary-container">
                    <Link to={`/clients/${p.id}`} className="hover:underline">
                      {p.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="t-tabular text-right font-semibold text-error">{xaf(p.overdue)}</TableCell>
                  <TableCell className="t-tabular text-on-surface-variant">{dateFr(p.lastActionDate)}</TableCell>
                  <TableCell>
                    <Badge tone={customerStatusTone[p.status]}>{customerStatusLabel[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/clients/${p.id}`} className="t-label text-primary hover:underline">
                      Ouvrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
