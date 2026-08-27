import { useQuery } from "@tanstack/react-query";
import { listAgencies } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function AgencesPage() {
  const agencesQ = useQuery({ queryKey: ["agencies"], queryFn: () => listAgencies({ pageSize: 200 }) });

  const isLoading = agencesQ.isLoading;
  const hasError = agencesQ.isError;
  const agencesList = agencesQ.data ?? [];

  const totalAgences = agencesList.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance par Agences"
        subtitle="Supervision de la performance opérationnelle et suivi du réseau d'agences."
      />

      {hasError && (
        <div className="flex items-start gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Une erreur s'est produite lors du chargement des agences.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Agences"
          value={String(totalAgences)}
          tone="default"
        />
        <KpiCard
          label="Réseau Commercial"
          value="Opérationnel"
          tone="default"
        />
        <KpiCard
          label="Maillage Territorial"
          value="Actif"
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[16px] font-semibold text-on-surface">
            Liste des Agences
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code Agence</TableHead>
                  <TableHead>Nom de l'Agence</TableHead>
                  <TableHead>Centre de Rattachement</TableHead>
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
                ) : agencesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[13px] text-on-surface-variant">
                      Aucune agence trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  agencesList.map((a) => (
                    <TableRow key={a.id_agence}>
                      <TableCell className="font-mono text-[13px] font-medium text-on-surface">
                        {a.id_agence}
                      </TableCell>
                      <TableCell className="font-semibold text-on-surface">
                        {a.nom_agence ?? a.id_agence}
                      </TableCell>
                      <TableCell className="text-on-surface-variant font-medium">
                        {a.nom_centre ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge tone="success">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
