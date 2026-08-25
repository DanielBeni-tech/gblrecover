import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPayments } from "@/api/client";
import type { Payment } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge, paymentStatusLabel, paymentStatusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { xaf, dateFr } from "@/lib/format";

const PAGE_SIZE = 10;

interface PaymentRow {
  id: string;
  reference: string;
  invoiceId: string;
  date: string;
  amount: number;
  status: string;
}

function toRow(p: Payment): PaymentRow {
  return {
    id: p.id_paiement,
    reference: p.id_paiement,
    invoiceId: p.id_facture,
    date: p.date_paiement ?? "",
    amount: p.montant_paye ?? 0,
    status: "valide",
  };
}

export function PaymentsPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);

  const { data, isLoading } = useQuery({ queryKey: ["payments", filters], queryFn: () => listPayments(filters) });

  const items = (data ?? [])
    .map(toRow)
    .filter((row) => {
      if (!debounced) return true;
      const q = debounced.toLowerCase();
      return row.reference.toLowerCase().includes(q) || row.invoiceId.toLowerCase().includes(q);
    });

  return (
    <>
      <PageHeader title="Paiements" subtitle="Vérifiez les encaissements reçus et leurs imputations." />
      <Card className="p-4">
        <div className="md:w-1/2">
          <Label htmlFor="p-q">Recherche</Label>
          <Input id="p-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Référence de paiement, ID facture…" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {items.length.toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">paiements affichés</span>
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
            title="Aucun paiement enregistré"
            description="Vérifiez votre recherche ou attendez les prochains encaissements pour voir les paiements ici."
            action={
              <Button variant="outline" size="sm" onClick={() => {}}>
                Voir les créances
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <tr>
                  <TableHead>Référence</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="t-tabular text-data">{p.reference}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{p.invoiceId}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(p.date)}</TableCell>
                    <TableCell className="t-tabular text-right">{xaf(p.amount)}</TableCell>
                    <TableCell>
                      <Badge tone={paymentStatusTone[p.status] ?? "neutral"}>{paymentStatusLabel[p.status] ?? p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.length} onChange={setPage} />}
      </Card>
    </>
  );
}
