import { useQuery } from "@tanstack/react-query";
import {
  getCentresAgencesReport,
  getGestionnairesReport,
  listAgencies,
  listCentres,
  listManagers,
} from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function AdministrationPage() {
  const centresQ = useQuery({ queryKey: ["centres"], queryFn: () => listCentres({ pageSize: 200 }) });
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: () => listAgencies({ pageSize: 200 }) });
  const managersQ = useQuery({ queryKey: ["managers-api"], queryFn: () => listManagers({ pageSize: 200 }) });
  // Volumétrie : on tire le rapport "centres-agences" qui synthétise le nombre d'agences par centre
  const centresAgencesQ = useQuery({ queryKey: ["report", "centres-agences"], queryFn: getCentresAgencesReport });
  const gestionnairesReportQ = useQuery({ queryKey: ["report", "gestionnaires"], queryFn: getGestionnairesReport });

  const isLoading = centresQ.isLoading || agenciesQ.isLoading || managersQ.isLoading;
  const hasError = centresQ.isError || agenciesQ.isError || managersQ.isError;

  // Index du nombre d'agences par centre (colonne "agences" du rapport backend)
  const agenciesByCentre = new Map<string, number>();
  for (const row of centresAgencesQ.data ?? []) {
    const centre = (row.nom_centre ?? row.centre ?? row.code) as string | undefined;
    const count = Number(row.agences ?? row.nb_agences ?? row.total_agences ?? 0);
    if (centre) agenciesByCentre.set(centre, count);
  }

  // Workload estimé par gestionnaire (colonne "dossiers" du rapport)
  const workloadByManager = new Map<string, number>();
  for (const row of gestionnairesReportQ.data ?? []) {
    const id = (row.mat_gestionnaire ?? row.id_gestionnaire) as string | undefined;
    const w = Number(row.dossiers ?? row.workload ?? row.nb_clients ?? 0);
    if (id) workloadByManager.set(id, w);
  }

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Référentiels organisationnels — centres, agences et gestionnaires (lecture)."
      />

      {hasError && (
        <div className="mb-4 flex items-start gap-2 rounded-panel border border-error/30 bg-error-container p-3 text-[13px] text-on-error-container">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <p>Impossible de charger les référentiels organisationnels depuis l'API.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Centres de gestion</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Centre de gestion</TableHead>
                  <TableHead className="text-right">Agences</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {centresQ.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (centresQ.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-[13px] text-on-surface-variant py-4">Aucun centre référencé.</TableCell>
                  </TableRow>
                ) : (
                  (centresQ.data ?? []).map((c) => (
                    <TableRow key={c.nom_centre}>
                      <TableCell className="font-medium">{c.nom_centre}</TableCell>
                      <TableCell className="t-tabular text-right text-on-surface-variant">
                        {agenciesByCentre.get(c.nom_centre) ?? c.agences?.length ?? 0}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Agences</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Agence</TableHead>
                  <TableHead>Centre</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {agenciesQ.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={2}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (agenciesQ.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-[13px] text-on-surface-variant py-4">Aucune agence référencée.</TableCell>
                  </TableRow>
                ) : (
                  (agenciesQ.data ?? []).map((a) => (
                    <TableRow key={a.id_agence}>
                      <TableCell className="font-medium">{a.nom_agence ?? a.id_agence}</TableCell>
                      <TableCell className="text-on-surface-variant">{a.nom_centre}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Gestionnaires</CardTitle>
          <Badge tone="neutral">Recouvrement</Badge>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Gestionnaire</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Dossiers actifs</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {(managersQ.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-[13px] text-on-surface-variant py-4">Aucun gestionnaire enregistré.</TableCell>
                  </TableRow>
                ) : (
                  (managersQ.data ?? []).map((m) => (
                    <TableRow key={m.mat_gestionnaire}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={m.nom_gestionnaire} tone="tertiary" className="h-8 w-8 text-[11px]" />
                          <span className="font-medium">{m.nom_gestionnaire}</span>
                        </div>
                      </TableCell>
                      <TableCell className="t-tabular text-on-surface-variant">{m.mat_gestionnaire}</TableCell>
                      <TableCell className="text-on-surface-variant">
                        {m.email_gestionnaire ?? m.tel_gestionnaire ?? "—"}
                      </TableCell>
                      <TableCell className="t-tabular text-right">{workloadByManager.get(m.mat_gestionnaire) ?? 0}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
