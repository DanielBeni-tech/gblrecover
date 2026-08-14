import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilterX, Plus, UserPlus, ArrowRight } from "lucide-react";
import { createCustomer, listAgencies, listCentres, listManagers, searchCustomers } from "@/api/client";
import type { CustomerType } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { customerStatusLabel } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { xaf } from "@/lib/format";

const PAGE_SIZE = 10;

export function ClientsPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [agency, setAgency] = useState("");
  const [center, setCenter] = useState("");
  const [status, setStatus] = useState("");
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

  const filters = useMemo(() => ({ query: debounced, agency, center, status }), [debounced, agency, center, status]);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", filters, page],
    queryFn: () => searchCustomers(filters, page, PAGE_SIZE),
  });

  // Référentiels pour les filtres (alimentés par l'API)
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: () => listAgencies({ pageSize: 200 }) });
  const centresQ = useQuery({ queryKey: ["centres"], queryFn: () => listCentres({ pageSize: 200 }) });
  const managersQ = useQuery({ queryKey: ["managers"], queryFn: () => listManagers({ pageSize: 200 }) });

  const exportCsv = async () => {
    const all = await searchCustomers(filters, 1, 10_000);
    const header = ["Client ID;Nom;Type;Agence;Centre;Gestionnaire;Statut;Solde (XAF);Créances échues (XAF)"];
    const rows = all.items.map((c) =>
      [
        c.id,
        `"${c.name}"`,
        c.type,
        c.agency,
        c.center,
        c.managerId,
        c.status,
        c.balance,
        c.overdue,
      ].join(";"),
    );
    const blob = new Blob(["﻿" + [...header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
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
    setStatus("");
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Clients & Comptes"
        subtitle="Gérez le portefeuille clients, analysez les soldes et initiez des actions de recouvrement."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau dossier
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <Label htmlFor="q">Recherche spécifique</Label>
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID client, nom complet…"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="agence">Agence</Label>
            <Select id="agence" value={agency} onChange={(e) => setAgency(e.target.value)}>
              <option value="">Toutes les agences</option>
              {(agenciesQ.data ?? []).map((a) => (
                <option key={a.id_agence} value={a.id_agence}>
                  {a.nom_agence ?? a.id_agence}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="centre">Centre de gestion</Label>
            <Select id="centre" value={center} onChange={(e) => setCenter(e.target.value)}>
              <option value="">Tous les centres</option>
              {(centresQ.data ?? []).map((c) => (
                <option key={c.nom_centre} value={c.nom_centre}>
                  {c.nom_centre}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="statut">Statut du compte</Label>
            <Select id="statut" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(customerStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end md:col-span-1">
            <Button variant="outline" size="icon" onClick={reset} title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-2.5">
          <p className="text-[16px] font-semibold text-on-surface">
            {(data?.total ?? 0).toLocaleString("fr-FR")}{" "}
            <span className="text-[14px] font-normal text-on-surface-variant">clients trouvés</span>
          </p>
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
            <Table className="min-w-[1080px]">
              <TableHeader>
                <tr>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead className="text-right">Solde total</TableHead>
                  <TableHead className="text-right">Créances échues</TableHead>
                  <TableHead>Gestionnaire</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {data?.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="t-tabular text-primary-container">
                      <Link to={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">{c.name}</TableCell>
                    <TableCell className="text-on-surface-variant">{c.agency || "—"}</TableCell>
                    <TableCell className="t-tabular text-right">{xaf(c.balance)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${c.overdue > 0 ? "bg-error-container/10 text-error" : "text-outline"}`}>
                      {xaf(c.overdue)}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {c.managerName || (managersQ.data ?? []).find((m) => m.mat_gestionnaire === c.managerId)?.nom_gestionnaire || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link
                        to={`/clients/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-card border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-[13px] font-medium text-on-surface hover:border-primary hover:text-primary"
                        title="Ouvrir le dossier et consulter les actions possibles"
                        aria-label={`Ouvrir le dossier de ${c.name}`}
                      >
                        Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
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
