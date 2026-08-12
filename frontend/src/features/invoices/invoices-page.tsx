import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, invoiceStatusLabel, invoiceStatusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { xaf, dateFr } from "@/lib/format";

const PAGE_SIZE = 10;

export function InvoicesPage() {
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

  const { data, isLoading } = useQuery({ queryKey: ["invoices", filters], queryFn: () => getInvoices(filters) });

  return (
    <>
      <PageHeader title="Factures" subtitle="Consultez les factures émises, leurs statuts et les soldes restants." />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="f-q">Recherche</Label>
            <Input id="f-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro de facture, ID client…" />
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="f-status">Statut</Label>
            <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(invoiceStatusLabel).map(([k, v]) => (
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
            {(data?.total ?? 0).toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">factures</span>
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title="Aucune facture dans ce périmètre"
          description="Vérifiez les filtres de recherche et de statut, ou consultez un client pour voir ses factures."
          action={
            <Button variant="outline" size="sm" onClick={() => {}}>
              Consulter un client
            </Button>
          }
        />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <tr>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Réglé</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="t-tabular text-primary-container">{f.number}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">{f.customerId}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{f.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(f.issueDate)}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(f.dueDate)}</TableCell>
                    <TableCell className="t-tabular text-right">{xaf(f.total)}</TableCell>
                    <TableCell className="t-tabular text-right text-success">{xaf(f.paid)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${f.total - f.paid > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(f.total - f.paid)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={invoiceStatusTone[f.status]}>{invoiceStatusLabel[f.status]}</Badge>
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
