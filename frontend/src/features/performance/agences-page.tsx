import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAgencies } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Loading } from "@/components/ui/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Building, Landmark, MapPin, Search } from "lucide-react";

export function AgencesPage() {
  const [search, setSearch] = useState("");
  const agencesQ = useQuery({ queryKey: ["agencies"], queryFn: () => listAgencies({ pageSize: 200 }) });

  const isLoading = agencesQ.isLoading;
  const hasError = agencesQ.isError;
  const agencesList = agencesQ.data ?? [];

  const filteredAgencies = useMemo(() => {
    if (!search.trim()) return agencesList;
    const q = search.toLowerCase();
    return agencesList.filter(
      (a) =>
        (a.nom_agence ?? "").toLowerCase().includes(q) ||
        a.id_agence.toLowerCase().includes(q) ||
        a.nom_centre.toLowerCase().includes(q),
    );
  }, [agencesList, search]);

  const totalAgences = agencesList.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparer les agences"
        subtitle="Supervision du réseau d’agences et rattachement aux centres."
        nextAction="Cherchez une agence, puis ouvrez son centre de rattachement."
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
          icon={Landmark}
          tone="default"
        />
        <KpiCard
          label="Réseau Commercial"
          value="Opérationnel"
          icon={Building}
          tone="default"
        />
        <KpiCard
          label="Maillage Territorial"
          value="Actif"
          icon={MapPin}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-outline-variant py-3 px-4">
          <CardTitle className="text-[16px] font-semibold text-on-surface">
            Liste des Agences
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-outline" />
            <Input
              placeholder="Rechercher agence, centre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-[12px]"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
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
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Loading className="py-8" />
                    </TableCell>
                  </TableRow>
                ) : filteredAgencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-[13px] text-on-surface-variant">
                      Aucune agence pour cette recherche. Effacez le filtre ou vérifiez le rattachement centre.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgencies.map((a) => (
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
