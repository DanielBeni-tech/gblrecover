import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilterX, Plus, UserPlus, ArrowRight } from "lucide-react";
import {
  type AggregatedClientRow,
  createCustomer,
  listAgencies,
  listClientMarkets,
  listClientsAggregated,
} from "@/api/client";
import type { CustomerType } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrgCascadeFilters } from "@/components/filters/org-cascade-filters";
import { xaf } from "@/lib/format";

const PAGE_SIZE = 50;

type Priority = { label: string; tone: "error" | "warning" | "success" | "neutral"; action: string };

function clientPriority(outstanding: number): Priority {
  if (outstanding >= 5_000_000) return { label: "Urgent", tone: "error", action: "Traiter créances" };
  if (outstanding > 0) return { label: "À traiter", tone: "warning", action: "Ouvrir dossier" };
  return { label: "OK", tone: "success", action: "Consulter" };
}

export function ClientsPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [agency, setAgency] = useState("");
  const [center, setCenter] = useState("");
  const [marche, setMarche] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [agency, center, marche, statut]);

  const filters = useMemo(
    () => ({ query: debounced, agency, center, marche, statut_facturation: statut }),
    [debounced, agency, center, marche, statut],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["customers", filters, page],
    queryFn: () => listClientsAggregated(filters, page, PAGE_SIZE),
  });

  const marketsQ = useQuery({
    queryKey: ["client-markets"],
    queryFn: listClientMarkets,
    staleTime: 300_000,
  });

  const agenciesQ = useQuery({
    queryKey: ["agencies"],
    queryFn: () => listAgencies({ pageSize: 300 }),
    staleTime: 300_000,
  });

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (center) parts.push(center);
    if (agency) {
      const ag = (agenciesQ.data ?? []).find((a) => a.id_agence === agency);
      parts.push(ag?.nom_agence ?? agency);
    }
    if (marche) parts.push(`Marché ${marche}`);
    if (statut) parts.push(statut);
    return parts;
  }, [center, agency, marche, statut, agenciesQ.data]);

  const pageOutstanding = useMemo(
    () => (data?.items ?? []).reduce((s, c) => s + Number(c.total_outstanding || 0), 0),
    [data?.items],
  );

  const exportCsv = async () => {
    const allItems: AggregatedClientRow[] = [];
    let pg = 1;
    while (true) {
      const batch = await listClientsAggregated(filters, pg, 200);
      allItems.push(...batch.items);
      if (allItems.length >= batch.total || batch.items.length === 0) break;
      pg++;
    }
    const header = ["Code client;Raison sociale;Marché;Email;Téléphone;Centre;Agence;Gestionnaire;Statut facturation;Balance (XAF);Créances (XAF)"];
    const rows = allItems.map((c) =>
      [
        c.code_client,
        `"${c.raison_sociale}"`,
        (c.marche as string ?? "").trim(),
        c.email ?? "",
        c.tel ?? "",
        c.nom_centre ?? "",
        c.nom_agence ?? "",
        c.nom_gestionnaire ?? "",
        c.statut_facturation ?? "",
        c.total_balance,
        c.total_outstanding,
      ].join(";"),
    );
    const blob = new Blob(["\uFEFF" + [...header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_gblrecover.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré.");
  };

  const reset = () => {
    setQuery("");
    setDebounced("");
    setAgency("");
    setCenter("");
    setMarche("");
    setStatut("");
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Clients & Comptes"
        subtitle="Priorisez les dossiers à fort encours, filtrez le portefeuille réel, puis lancez l’action de recouvrement."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau dossier
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <OrgCascadeFilters
            value={{ centre: center, agence: agency }}
            onChange={({ centre, agence }) => {
              setCenter(centre);
              setAgency(agence);
            }}
            centreClassName="md:col-span-2"
            agenceClassName="md:col-span-2"
          />
          <div className="md:col-span-2">
            <Label htmlFor="marche">Marché</Label>
            <Select id="marche" value={marche} onChange={(e) => setMarche(e.target.value)}>
              <option value="">Tous les marchés</option>
              {(marketsQ.data ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="statut">Statut facturation</Label>
            <Select id="statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Tous les statuts</option>
              <option value="En cours">En cours</option>
              <option value="Arrêt">Arrêt</option>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="q">Recherche</Label>
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Code client, raison sociale…"
            />
          </div>
          <div className="flex justify-end md:col-span-1">
            <Button variant="outline" size="icon" onClick={reset} title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-outline-variant bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[16px] font-semibold text-on-surface">
              {(data?.total ?? 0).toLocaleString("fr-FR")}{" "}
              <span className="text-[14px] font-normal text-on-surface-variant">clients</span>
              {filterSummary.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-on-surface-variant">
                  · {filterSummary.join(" · ")}
                </span>
              )}
            </p>
            <p className="text-[12px] text-on-surface-variant">
              Triés par créances décroissantes · encours page : {xaf(pageOutstanding)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Exporter CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="Aucun client trouvé"
            description="Modifiez votre recherche, ajustez les filtres ou créez un nouveau dossier client pour commencer."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  Réinitialiser les filtres
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nouveau dossier
                </Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <tr>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Code client</TableHead>
                  <TableHead>Raison sociale</TableHead>
                  <TableHead>Marché</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-right">Créances</TableHead>
                  <TableHead>Gestionnaire</TableHead>
                  <TableHead className="text-center">Action recommandée</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((c) => {
                  const priority = clientPriority(Number(c.total_outstanding || 0));
                  const treatHref =
                    Number(c.total_outstanding || 0) > 0
                      ? `/clients/${c.code_client}?tab=creances`
                      : `/clients/${c.code_client}`;
                  return (
                    <TableRow key={c.code_client} className={Number(c.total_outstanding || 0) > 0 ? "bg-error-container/5" : undefined}>
                      <TableCell>
                        <Badge tone={priority.tone}>{priority.label}</Badge>
                      </TableCell>
                      <TableCell className="t-tabular text-data">
                        <Link to={treatHref} className="font-medium hover:underline">
                          {c.code_client}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{c.raison_sociale}</TableCell>
                      <TableCell className="text-on-surface-variant">{(c.marche ?? "—").trim()}</TableCell>
                      <TableCell className="text-on-surface-variant">{c.nom_centre || "—"}</TableCell>
                      <TableCell className="text-on-surface-variant">{c.nom_agence || c.id_agence || "—"}</TableCell>
                      <TableCell className="text-on-surface-variant">{c.statut_facturation || "—"}</TableCell>
                      <TableCell className="t-tabular text-right">{xaf(c.total_balance)}</TableCell>
                      <TableCell className={`t-tabular text-right font-semibold ${Number(c.total_outstanding) > 0 ? "text-error" : "text-outline"}`}>
                        {xaf(c.total_outstanding)}
                      </TableCell>
                      <TableCell className="text-on-surface-variant">{c.nom_gestionnaire || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Link
                          to={treatHref}
                          className="inline-flex items-center gap-1.5 rounded-card border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-[13px] font-medium text-on-surface hover:border-primary hover:text-primary"
                          title={priority.action}
                          aria-label={`${priority.action} — ${c.raison_sociale}`}
                        >
                          {priority.action} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
        )}
      </Card>

      <NewCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agencies={(agenciesQ.data ?? []).map((a) => ({ id: a.id_agence, name: a.nom_agence ?? a.id_agence }))}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setCreateOpen(false);
          setPage(1);
          toast.success("Dossier créé.");
          navigate(`/clients/${id}`);
        }}
      />
    </>
  );
}

function NewCustomerModal({
  open,
  onClose,
  onCreated,
  agencies,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  agencies: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomerType>("entreprise");
  const [agency, setAgency] = useState(agencies[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createCustomer({ name: name.trim(), type, agency, phone: phone.trim() });
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau dossier client"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button form="new-customer-form" type="submit" disabled={busy || !name.trim()}>
            <UserPlus className="h-4 w-4" /> Créer le dossier
          </Button>
        </>
      }
    >
      <form id="new-customer-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="nc-name">Raison sociale / nom complet</Label>
          <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Ets Ngono & Fils" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nc-type">Type</Label>
            <Select id="nc-type" value={type} onChange={(e) => setType(e.target.value as CustomerType)}>
              <option value="entreprise">Entreprise</option>
              <option value="particulier">Particulier</option>
              <option value="etat">État</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="nc-agence">Agence</Label>
            <Select id="nc-agence" value={agency} onChange={(e) => setAgency(e.target.value)}>
              {agencies.length === 0 ? (
                <option value="">Aucune agence disponible</option>
              ) : (
                agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="nc-phone">Téléphone</Label>
          <Input id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XX XX XX" />
        </div>
      </form>
    </Modal>
  );
}
