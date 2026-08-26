import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listInvoices, listInvoicesCountFiltered } from "@/api/client";
import type { Invoice } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { xaf, dateFr } from "@/lib/format";

const PAGE_SIZE = 50;

const invoiceStatusLabel: Record<string, string> = { OPEN: "Impayée", PAID: "Payée" };

interface InvoiceRow {
  id: string;
  number: string;
  accountNumber: string;
  issueDate: string;
  total: number;
  paid: number;
  outstanding: number;
  status: string;
}

/** Convertit une facture backend (InvoiceRead) en ligne UI. */
function toRow(inv: Invoice): InvoiceRow {
  const total = inv.montant_facture ?? 0;
  const paid = inv.paid_amount ?? 0;
  const outstanding = inv.outstanding_amount ?? Math.max(0, total - paid);
  const derivedStatus = outstanding > 0 ? "OPEN" : "PAID";
  return {
    id: inv.id_facture,
    number: inv.id_facture,
    accountNumber: String(inv.num_compte),
    issueDate: inv.date_emission ?? "",
    total,
    paid,
    outstanding,
    status: derivedStatus,
  };
}

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

  const filters = useMemo(
    () => ({ q: debounced || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
    [debounced, status, page],
  );

  // Le backend ne supporte pas (encore) de filtre texte libre sur id_facture ;
  // on récupère la page et on filtre côté client.
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => listInvoices({ status: filters.status, page: filters.page, pageSize: filters.pageSize }),
  });

  // Count total for real pagination
  const { data: countData } = useQuery({
    queryKey: ["invoices-count", status],
    queryFn: () => listInvoicesCountFiltered({ status: status || undefined }),
  });

  const items = (data ?? [])
    .map(toRow)
    .filter((row) => {
      if (!debounced) return true;
      const q = debounced.toLowerCase();
      return row.number.toLowerCase().includes(q) || row.accountNumber.toLowerCase().includes(q);
    });

  const totalCount = countData?.total ?? 0;

  return (
    <>
      <PageHeader title="Factures" subtitle="Consultez les factures émises, leurs statuts et les soldes restants." />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="f-q">Recherche</Label>
            <Input id="f-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro de facture, n° de compte…" />
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
            {totalCount.toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">factures au total — page {page}</span>
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
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
                  <TableHead>Compte</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Facturé</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Impayé</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="t-tabular text-data">{f.number}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{f.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(f.issueDate)}</TableCell>
                    <TableCell className="t-tabular text-right">{xaf(f.total)}</TableCell>
                    <TableCell className="t-tabular text-right text-on-surface-variant">{xaf(f.paid)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${f.outstanding > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(f.outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={f.status === "PAID" ? "success" : "error"}>{f.status === "PAID" ? "Payée" : "Impayée"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalCount > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={totalCount} onChange={setPage} />
        )}
      </Card>
    </>
  );
}
