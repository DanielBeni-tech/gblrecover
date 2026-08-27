import { useQuery } from "@tanstack/react-query";
import { getCentresAgencesReport, listCentres } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function CentresPage() {
  const centresQ = useQuery({ queryKey: ["centres"], queryFn: () => listCentres({ pageSize: 200 }) });
  const reportQ = useQuery({ queryKey: ["report", "centres-agences"], queryFn: getCentresAgencesReport });

  const isLoading = centresQ.isLoading || reportQ.isLoading;
  const hasError = centresQ.isError || reportQ.isError;

  const centresList = centresQ.data ?? [];
  const reportData = reportQ.data ?? [];

  // Mapper le rapport par centre
  const reportMap = new Map<string, { agences: number; total_balance?: number; total_outstanding?: number }>();
  for (const row of reportData) {
    const centre = String(row.nom_centre ?? row.centre ?? row.code ?? "");
    if (centre) {
      reportMap.set(centre, {
        agences: Number(row.agences ?? row.nb_agences ?? 0),
        total_balance: Number(row.total_balance ?? row.balance ?? 0),
        total_outstanding: Number(row.total_outstanding ?? row.impayes ?? 0),
      });
    }
  }

  const totalCentres = centresList.length;
  const totalAgences = Array.from(reportMap.values()).reduce((acc, curr) => acc + curr.agences, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance par Centres"
        subtitle="Suivi de la performance et de la ventilation des agences par centre de gestion."
      />

      {hasError && (
        <div className="flex items-start gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Une erreur s'est produite lors du chargement des centres de gestion.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Centres de Gestion"
          value={String(totalCentres)}
          tone="default"
        />
        <KpiCard
          label="Agences Rattachées"
          value={String(totalAgences)}
          tone="default"
        />
        <KpiCard
          label="Couverture Nationale"
          value="100%"
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[16px] font-semibold text-on-surface">
            Liste des Centres de Gestion
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom du Centre</TableHead>
                  <TableHead className="text-right">Nombre d'Agences</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : centresList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-[13px] text-on-surface-variant">
                      Aucun centre de gestion trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  centresList.map((c, index) => {
                    const r = reportMap.get(c.nom_centre);
                    return (
                      <TableRow key={c.nom_centre || index}>
                        <TableCell className="font-semibold text-on-surface">
                          {c.nom_centre}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {r?.agences ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge tone="success">Actif</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
