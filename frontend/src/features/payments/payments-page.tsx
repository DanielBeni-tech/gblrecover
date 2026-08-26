import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPayments } from "@/api/client";
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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function PaymentsPage() {
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

  const { data, isLoading } = useQuery({ queryKey: ["payments", filters], queryFn: () => getPayments(filters) });

  // Garde-fous : valeurs par défaut si le backend ne fournit pas les compteurs.
  const counts = data?.counts ?? { impute: 0, partiel: 0, recu: 0, anomalie: 0 };

  return (
    <>
      <PageHeader title="Paiements" subtitle="Vérifiez les encaissements reçus et leurs imputations." />
      <Card className="p-4">
        <div className="md:w-1/2">
          <Label htmlFor="p-q">Recherche</Label>
          <Input id="p-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Référence de paiement, ID client…" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {(data?.total ?? 0).toLocaleString("fr-FR")} <span className="text-[14px] font-normal text-on-surface-variant">paiements</span>
          </p>
        </div>

        {/* Navigation rapide par section — accès direct à une catégorie de statut sans scroller */}
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-surface px-4 py-2.5">
          <span className="t-label mr-1 text-on-surface-variant">Sections</span>
          {[
            { key: "", label: "Toutes", count: data?.total ?? 0, rest: "bg-surface-container text-on-surface" },
            { key: "impute", label: "Imputés", count: counts.impute, rest: "bg-success-container text-success" },
            { key: "partiel", label: "Partiels", count: counts.partiel, rest: "bg-secondary-fixed text-on-secondary-fixed" },
            { key: "recu", label: "Reçus", count: counts.recu, rest: "bg-warning-container text-warning" },
            { key: "anomalie", label: "Anomalies", count: counts.anomalie, rest: "bg-error-container text-on-error-container" },
          ].map((chip) => {
            const active = status === chip.key;
            return (
              <button
                key={chip.key || "toutes"}
                type="button"
                onClick={() => {
                  setStatus(chip.key);
                  setPage(1);
                }}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                  active ? "border-primary bg-primary text-on-primary" : cn(chip.rest, "border-outline-variant hover:border-primary"),
                )}
              >
                {chip.label}
                <span className="t-tabular text-[11px] opacity-80">{(chip.count ?? 0).toLocaleString("fr-FR")}</span>
              </button>
            );
          })}
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
      ) : data && data.items.length === 0 ? (
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
          <div className="max-h-[560px] overflow-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <tr>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Imputé</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="t-tabular text-success">{p.reference}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{p.customerId}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{p.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(p.date)}</TableCell>
                    <TableCell className="t-tabular text-right">{xaf(p.amount)}</TableCell>
                    <TableCell className="t-tabular text-right text-success">{xaf(p.allocated)}</TableCell>
                    <TableCell>
                      <Badge tone={paymentStatusTone[p.status]}>{paymentStatusLabel[p.status]}</Badge>
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
