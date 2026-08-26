import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listReceivables, listReceivablesCount } from "@/api/client";
import type { ReportRow } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
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

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function receivableStatus(outstanding: number, ageDays: number): string {
  if (outstanding <= 0) return "payee";
  if (ageDays > 90) return "urgente";
  if (ageDays > 30) return "en_retard";
  return "normale";
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
    queryKey: ["receivables", debounced, status, page],
    queryFn: () => listReceivables({ q: debounced || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
    staleTime: 30_000,
  });

  const { data: countData } = useQuery({
    queryKey: ["receivables-count", debounced],
    queryFn: () => listReceivablesCount({ q: debounced || undefined }),
  });

  const totalCount = countData?.total ?? 0;

  const now = Date.now();
  const items = useMemo(() => {
    return (data ?? []).map((row: ReportRow) => {
      const outstanding = num(row.outstanding_amount);
      const issueDate = str(row.date_emission);
      const ageDays = issueDate ? Math.max(0, Math.floor((now - new Date(issueDate).getTime()) / 86_400_000)) : 0;
      return {
        id: str(row.id_facture),
        accountNumber: str(row.num_compte),
        customerName: str(row.raison_sociale),
        customerId: str(row.code_client),
        initial: num(row.montant_facture),
        balance: outstanding,
        ageDays,
        issueDate,
        status: receivableStatus(outstanding, ageDays),
      };
    });
  }, [data]);

  return (
    <>
      <PageHeader title="Créances" subtitle="Suivez les montants dus, leur ancienneté et leur priorité de recouvrement." />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="r-q">Recherche</Label>
            <Input id="r-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro de facture, code client, raison sociale…" />
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="r-status">Statut</Label>
            <Select id="r-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Tous les statuts</option>
              <option value="normale">Normale</option>
              <option value="en_retard">En retard</option>
              <option value="urgente">Urgente</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {totalCount.toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">créances ouvertes — page {page}</span>
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
            title="Aucune créance ouverte"
            description="Toutes les dettes sont réglées ou les filtres sont trop restrictifs. Ajustez votre recherche pour voir plus de résultats."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <tr>
                  <TableHead>Facture</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant facturé</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Ancienneté</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="t-tabular text-data">{r.id}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.accountNumber}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-on-surface-variant">{r.customerName || r.customerId}</TableCell>
                    <TableCell className="t-tabular text-right text-on-surface-variant">{xaf(r.initial)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${r.balance > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(r.balance)}
                    </TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.ageDays} j</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant text-[12px]">{dateFr(r.issueDate)}</TableCell>
                    <TableCell>
                      <Badge tone={r.status === "urgente" ? "error" : r.status === "en_retard" ? "warning" : "success"}>
                        {r.status === "urgente" ? "Urgente" : r.status === "en_retard" ? "En retard" : "Normale"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalCount > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={totalCount} onChange={setPage} />}
      </Card>
    </>
  );
}
