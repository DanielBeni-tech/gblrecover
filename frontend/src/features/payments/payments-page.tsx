import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listInvoices, listInvoicesCountFiltered } from "@/api/client";
import type { Invoice } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { xaf, dateFr } from "@/lib/format";

const PAGE_SIZE = 10;

/** Statut de règlement dérivé des montants — jamais du champ `status` en base (non fiable : tout vaut 'OPEN'). */
type SettlementState = "PAID" | "PARTIAL" | "UNPAID";

const settlementBadge: Record<SettlementState, { label: string; tone: BadgeTone }> = {
  PAID: { label: "Payée", tone: "success" },
  PARTIAL: { label: "Partiellement payée", tone: "warning" },
  UNPAID: { label: "Non payée", tone: "error" },
};

/** Colonnes triables côté serveur (alignées sur la whitelist crud._INVOICE_ORDERABLE). */
const sortableColumns = [
  { field: "date_emission", label: "Émission" },
  { field: "montant_facture", label: "Total" },
  { field: "paid_amount", label: "Réglé" },
  { field: "outstanding_amount", label: "Solde restant" },
] as const;

type SortField = (typeof sortableColumns)[number]["field"];

interface SettlementRow {
  id: string;
  accountNumber: string;
  emissionDate: string;
  total: number;
  paid: number;
  remaining: number;
  state: SettlementState;
}

const EPSILON = 0.005;

function toRow(inv: Invoice): SettlementRow {
  const total = inv.montant_facture ?? 0;
  const paid = inv.paid_amount ?? 0;
  const remaining = inv.outstanding_amount ?? Math.max(total - paid, 0);
  let state: SettlementState;
  if (remaining <= EPSILON) state = "PAID";
  else if (paid > EPSILON) state = "PARTIAL";
  else state = "UNPAID";
  return {
    id: inv.id_facture,
    accountNumber: String(inv.num_compte),
    emissionDate: inv.date_emission ?? "",
    total,
    paid,
    remaining,
    state,
  };
}

function SortableHead({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <TableHead aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 hover:text-on-surface">
        {label}
        <span aria-hidden className={cn("text-[10px]", active ? "text-primary" : "opacity-50")}>
          {active ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

export function PaymentsPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("date_emission");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Réinitialise la page à chaque changement de filtre ou de tri.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortField, sortOrder]);

  function toggleSort(field: SortField) {
    if (field === sortField) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  const filters = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, paymentState: statusFilter || undefined, orderBy: sortField, order: sortOrder }),
    [page, statusFilter, sortField, sortOrder],
  );

  // Vue « suivi des règlements » : les données de règlement sont portées par les factures
  // (paid_amount / outstanding_amount) ; tri et filtres appliqués côté serveur.
  const { data, isLoading } = useQuery({
    queryKey: ["payments-followup", filters],
    queryFn: () => listInvoices(filters),
  });

  // Total réel pour la pagination dynamique (reflète le filtre de statut actif).
  const { data: countData } = useQuery({
    queryKey: ["payments-count-total", statusFilter],
    queryFn: () => listInvoicesCountFiltered({ paymentState: statusFilter || undefined }),
  });
  const totalCount = countData?.total ?? 0;

  // Sous-compteur « dont N non payées » : global, indépendant du filtre courant.
  const { data: unpaidData } = useQuery({
    queryKey: ["payments-count-unpaid"],
    queryFn: () => listInvoicesCountFiltered({ paymentState: "UNPAID" }),
  });
  const unpaidCount = unpaidData?.total ?? 0;

  // Fraîcheur : dernière émission connue (tri serveur par défaut = plus récentes).
  const { data: freshness } = useQuery({
    queryKey: ["payments-freshness"],
    queryFn: () => listInvoices({ pageSize: 1 }),
  });
  const freshAsOf = freshness?.[0]?.date_emission ?? null;

  const items = (data ?? [])
    .map(toRow)
    .filter((row) => {
      if (!debounced) return true;
      const q = debounced.toLowerCase();
      return row.id.toLowerCase().includes(q) || row.accountNumber.toLowerCase().includes(q);
    });

  return (
    <>
      <PageHeader
        title="Paiements"
        subtitle="Suivi des règlements par facture — statuts dérivés des montants réglés. Le tri « Émission » croissant remonte les factures les plus anciennes, meilleure approximation des retards (l'échéance n'est pas fournie par le flux GBL actuel)."
      />
      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <Label htmlFor="p-q">Recherche</Label>
            <Input id="p-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N° de facture, n° de compte…" />
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="p-status">Statut de règlement</Label>
            <Select id="p-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(settlementBadge).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {totalCount.toLocaleString("fr-FR")}{" "}
            <span className="text-[14px] font-normal text-on-surface-variant">factures suivies</span>
            {" · "}
            <span className="text-[14px] font-semibold text-error">dont {unpaidCount.toLocaleString("fr-FR")} non payées</span>
          </p>
          {freshAsOf && (
            <span className="rounded-full bg-surface-container px-3 py-1 text-[12px] text-on-surface-variant">
              Données à jour au {dateFr(freshAsOf)}
            </span>
          )}
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
            description={
              debounced || statusFilter
                ? "Ajustez la recherche ou le filtre de statut de règlement pour retrouver des factures."
                : "Aucune facture disponible côté serveur."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <tr>
                  <TableHead>N° facture</TableHead>
                  <TableHead>Compte client</TableHead>
                  <SortableHead label="Émission" field="date_emission" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                  <SortableHead label="Total" field="montant_facture" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                  <SortableHead label="Réglé" field="paid_amount" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                  <SortableHead label="Solde restant" field="outstanding_amount" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const badge = settlementBadge[r.state];
                  return (
                    <TableRow key={r.id}>
                      {/* Numéro grisé lorsque la facture est réglée (état lisible même sans couleur). */}
                      <TableCell className={cn("t-tabular", r.state === "PAID" ? "text-on-surface-variant opacity-60" : "text-data")}>
                        {r.id}
                      </TableCell>
                      <TableCell className="t-tabular text-on-surface-variant">{r.accountNumber}</TableCell>
                      <TableCell className="t-tabular text-on-surface-variant">{dateFr(r.emissionDate)}</TableCell>
                      <TableCell className="t-tabular text-right">{xaf(r.total)}</TableCell>
                      <TableCell
                        className={cn(
                          "t-tabular text-right",
                          r.state === "UNPAID" ? "text-error" : r.paid > EPSILON ? "font-semibold text-success" : "",
                        )}
                      >
                        {xaf(r.paid)}
                      </TableCell>
                      <TableCell className={cn("t-tabular text-right", r.remaining > EPSILON ? "font-semibold text-error" : "text-success")}>
                        {xaf(r.remaining)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {totalCount > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={totalCount} onChange={setPage} />}
      </Card>
    </>
  );
}
