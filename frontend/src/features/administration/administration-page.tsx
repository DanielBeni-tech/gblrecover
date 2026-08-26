import { useQuery } from "@tanstack/react-query";
import { getManagers } from "@/api/client";
import { agencies, centers } from "@/data/mock-data";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AdministrationPage() {
  const { data: managers, isLoading } = useQuery({ queryKey: ["managers"], queryFn: getManagers });

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Référentiels organisationnels — centres, agences et gestionnaires (lecture)."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Centres de gestion</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Code</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Agences</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {centers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="t-tabular text-success">{c.id}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">
                      {agencies.filter((a) => a.center === c.name).length}
                    </TableCell>
                  </TableRow>
                ))}
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
                {agencies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-on-surface-variant">{a.center}</TableCell>
                  </TableRow>
                ))}
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
                  <TableHead>Agence</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Dossiers actifs</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {managers?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} tone="tertiary" className="h-8 w-8 text-[11px]" />
                        <span className="font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{m.agency}</TableCell>
                    <TableCell className="text-on-surface-variant">{m.role}</TableCell>
                    <TableCell className="t-tabular text-right">{m.workload}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
