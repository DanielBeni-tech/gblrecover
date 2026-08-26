import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown10, ArrowUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function InvoicesPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [sortByDueDate, setSortByDueDate] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(
    () => ({ query: debounced, status, sortByDueDate, page, pageSize: PAGE_SIZE }),
    [debounced, status, sortByDueDate, page],
  );

  const { data, isLoading } = useQuery({ queryKey: ["invoices", filters], queryFn: () => getInvoices(filters) });

  // Garde-fous : valeurs par défaut si le backend ne fournit pas les agrégats.
  const counts = data?.counts ?? { payee: 0, partielle: 0, impayee: 0, annulee: 0, nonPayees: 0 };
  const summary = data?.summary ?? { montantAttendu: 0, montantRecu: 0, tauxRecouvrement: 0 };

  const toggleSort = () => {
    setSortByDueDate((s) => !s);
    setPage(1);
  };

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
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-outline-variant bg-surface px-4 py-2.5">
          <div>
            <p className="flex items-baseline gap-2 text-[16px] font-semibold text-on-surface">
              {(data?.total ?? 0).toLocaleString("fr-FR")}
              <span className="text-[14px] font-normal text-on-surface-variant">factures</span>
            </p>
            {data && (
              <p className="mt-0.5 text-[12px] text-on-surface-variant">
                dont <span className="font-semibold text-error">{counts.nonPayees}</span> non payées
              </p>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              Attendu {xaf(summary.montantAttendu)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              Reçu {xaf(summary.montantRecu)}
            </span>
            <span className="inline-flex items-center rounded-card bg-secondary-fixed px-2 py-0.5 font-semibold text-on-secondary-fixed">
              Taux de recouvrement {summary.tauxRecouvrement}%
            </span>
          </div>
        </div>

        {data?.freshness && (
          <div className="border-b border-outline-variant bg-surface-container-low px-4 py-1.5 text-[11px] text-on-surface-variant">
            Données à jour au {dateFr(data.freshness)} — lot « GBL - Juillet 2026 »
          </div>
        )}
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
                  <TableHead>
                    <button
                      type="button"
                      onClick={toggleSort}
                      aria-pressed={sortByDueDate}
                      title={sortByDueDate ? "Tri : les plus en retard d'abord (désactiver)" : "Trier par échéance (les plus en retard d'abord)"}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                        sortByDueDate ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      Échéance
                      {sortByDueDate ? <ArrowDown10 className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Réglé</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className={cn("t-tabular text-success")}>
                      {f.number}
                    </TableCell>
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
