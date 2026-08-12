import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getReceivables } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, receivableStatusLabel, receivableStatusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { xaf, dateFr } from "@/lib/format";

const PAGE_SIZE = 10;

export function ReceivablesPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(() => ({ query: debounced, status, page, pageSize: PAGE_SIZE }), [debounced, status, page]);

  const { data, isLoading } = useQuery({ queryKey: ["receivables", filters], queryFn: () => getReceivables(filters) });

  return (
    <>
      <PageHeader title="Créances" subtitle="Suivez les montants dus, leur ancienneté et leur priorité de recouvrement." />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="r-q">Recherche</Label>
            <Input id="r-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro de facture, ID client…" />
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="r-status">Statut</Label>
            <Select id="r-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(receivableStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {(data?.total ?? 0).toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">créances</span>
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState title="Aucune créance trouvée" description="Le périmètre ne contient pas de dette ouverte, ou ajustez les filtres." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <tr>
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead className="text-right">Montant initial</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Ancienneté</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="t-tabular text-primary-container">{r.invoiceNumber}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{r.customerId}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-right text-on-surface-variant">{xaf(r.initial)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${r.balance > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(r.balance)}
                    </TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.ageDays} j</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(r.dueDate)}</TableCell>
                    <TableCell>
                      <Badge tone={receivableStatusTone[r.status]}>{receivableStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}
      </Card>
    </>
  );
}
