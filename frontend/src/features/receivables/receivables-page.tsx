import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccountInvoices, listClients, getClientAccounts } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
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

interface ReceivableRow {
  id: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  invoiceNumber: string;
  initial: number;
  balance: number;
  ageDays: number;
  dueDate: string;
  status: string;
}

function receivableStatus(ageDays: number): string {
  if (ageDays > 90) return "urgente";
  if (ageDays > 30) return "en_retard";
  return "normale";
}

/**
 * Récupère les créances en agrégeant les factures impayées de tous les comptes
 * des clients présents dans le système. Pas d'endpoint /receivables côté backend
 * à ce stade : on dérive depuis /clients + /accounts + /accounts/{id}/invoices.
 */
async function fetchReceivables(): Promise<ReceivableRow[]> {
  const clients = await listClients({ page: 1, pageSize: 100 });
  const perClient = await Promise.all(
    clients.map(async (c) => {
      const accounts = await getClientAccounts(c.code_client).catch(() => []);
      const invoicesByAccount = await Promise.all(
        accounts.map(async (a) => {
          const invs = await getAccountInvoices(a.num_compte, { pageSize: 200 }).catch(() => []);
          return invs
            .filter((inv) => (inv.outstanding_amount ?? 0) > 0)
            .map((inv) => ({ inv, account: a }));
        }),
      );
      return invoicesByAccount.flat();
    }),
  );
  const now = Date.now();
  const rows: ReceivableRow[] = [];
  for (const items of perClient) {
    for (const { inv, account } of items) {
      const issue = inv.date_emission ? new Date(inv.date_emission).getTime() : now;
      const ageDays = Math.max(0, Math.floor((now - issue) / 86_400_000));
      const total = inv.montant_facture ?? 0;
      const paid = inv.paid_amount ?? 0;
      const balance = inv.outstanding_amount ?? total - paid;
      rows.push({
        id: inv.id_facture,
        customerId: String(account.code_client),
        customerName: "",
        accountNumber: String(account.num_compte),
        invoiceNumber: inv.id_facture,
        initial: total,
        balance,
        ageDays,
        dueDate: inv.date_emission ?? "",
        status: receivableStatus(ageDays),
      });
    }
  }
  return rows;
}

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

  const { data, isLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: fetchReceivables,
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (status && r.status !== status) return false;
      if (!debounced) return true;
      const q = debounced.toLowerCase();
      return r.invoiceNumber.toLowerCase().includes(q) || r.customerId.toLowerCase().includes(q);
    });
  }, [data, debounced, status]);

  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader title="Créances" subtitle="Suivez les montants dus, leur ancienneté et leur priorité de recouvrement." />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="r-q">Recherche</Label>
            <Input id="r-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro de facture, code client…" />
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
            {items.length.toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">créances ouvertes</span>
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <EmptyState
            title="Aucune créance ouverte"
            description="Toutes les dettes sont réglées ou les filtres sont trop restrictifs. Ajustez votre recherche pour voir plus de résultats."
            action={
              <Button variant="outline" size="sm" onClick={() => {}}>
                Consulter les clients
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <tr>
                  <TableHead>Facture</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead className="text-right">Montant initial</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Ancienneté</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {pageItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="t-tabular text-primary-container">{r.invoiceNumber}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-right text-on-surface-variant">{xaf(r.initial)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${r.balance > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(r.balance)}
                    </TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.ageDays} j</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(r.dueDate)}</TableCell>
                    <TableCell>
                      <Badge tone={receivableStatusTone[r.status] ?? "neutral"}>{receivableStatusLabel[r.status] ?? r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {items.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onChange={setPage} />}
      </Card>
    </>
  );
}
