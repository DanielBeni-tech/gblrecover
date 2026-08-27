import { useQuery } from "@tanstack/react-query";
import { getGestionnairesReport, listManagers } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function GestionnairesPage() {
  const managersQ = useQuery({ queryKey: ["managers-api"], queryFn: () => listManagers({ pageSize: 200 }) });
  const reportQ = useQuery({ queryKey: ["report", "gestionnaires"], queryFn: getGestionnairesReport });

  const isLoading = managersQ.isLoading || reportQ.isLoading;
  const hasError = managersQ.isError || reportQ.isError;

  const managersList = managersQ.data ?? [];
  const reportData = reportQ.data ?? [];

  const workloadMap = new Map<string, number>();
  for (const row of reportData) {
    const id = String(row.mat_gestionnaire ?? row.id_gestionnaire ?? "");
    const dossiers = Number(row.dossiers ?? row.workload ?? row.nb_clients ?? 0);
    if (id) workloadMap.set(id, dossiers);
  }

  const totalManagers = managersList.length;
  const totalPortefeuille = Array.from(workloadMap.values()).reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance des Gestionnaires"
        subtitle="Suivi de la charge de travail et du portefeuille des gestionnaires de recouvrement."
      />

      {hasError && (
        <div className="flex items-start gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Une erreur s'est produite lors du chargement des gestionnaires.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Gestionnaires Actifs"
          value={String(totalManagers)}
          tone="default"
        />
        <KpiCard
          label="Dossiers en Portefeuille"
          value={String(totalPortefeuille)}
          tone="default"
        />
        <KpiCard
          label="Disponibilité Équipe"
          value="100%"
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[16px] font-semibold text-on-surface">
            Portefeuille des Gestionnaires
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gestionnaire</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead className="text-right">Dossiers gérés</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : managersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[13px] text-on-surface-variant">
                      Aucun gestionnaire référencé.
                    </TableCell>
                  </TableRow>
                ) : (
                  managersList.map((m) => {
                    const w = workloadMap.get(m.mat_gestionnaire) ?? 0;
                    return (
                      <TableRow key={m.mat_gestionnaire}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={m.nom_gestionnaire} className="h-8 w-8 text-[12px]" />
                            <span className="font-semibold text-on-surface">{m.nom_gestionnaire}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-on-surface-variant font-medium">
                          {m.mat_gestionnaire}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {w > 0 ? `${w} clients` : "—"}
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
