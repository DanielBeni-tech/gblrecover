import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarClock, CheckCircle2, Mail, MessageSquare, Phone } from "lucide-react";
import { createAction, getCustomer } from "@/api/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge, customerStatusLabel, customerStatusTone, invoiceStatusLabel, invoiceStatusTone, paymentStatusLabel, paymentStatusTone, receivableStatusLabel, receivableStatusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timeline } from "@/components/ui/timeline";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AgedBars } from "@/components/charts/aging-chart";
import { xaf, dateFr } from "@/lib/format";

type Risk = { label: string; tone: "success" | "warning" | "error" };

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "resume";
  const [actionOpen, setActionOpen] = useState(false);

  const { data: customer, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: Boolean(id),
  });

  const metrics = useMemo(() => {
    if (!customer) return null;
    const open = customer.receivables.filter((r) => r.balance > 0);
    const montantEchu = open.filter((r) => r.ageDays > 0).reduce((s, r) => s + r.balance, 0);
    const weightedAge = open.length ? open.reduce((s, r) => s + r.balance * r.ageDays, 0) / open.reduce((s, r) => s + r.balance, 0) : 0;
    const risk: Risk = open.some((r) => r.status === "urgente")
      ? { label: "Élevé", tone: "error" }
      : montantEchu > 0
        ? { label: "Moyen", tone: "warning" }
        : { label: "Faible", tone: "success" };
    const buckets = [
      { label: "0-30 J", min: 0, max: 30, tone: "primary" as const },
      { label: "31-60 J", min: 31, max: 60, tone: "secondary" as const },
      { label: "61-90 J", min: 61, max: 90, tone: "warning" as const },
      { label: "90+ J", min: 91, max: Infinity, tone: "error" as const },
    ];
    const aged = buckets.map((b) => {
      const amount = open.filter((r) => r.ageDays >= b.min && r.ageDays <= b.max).reduce((s, r) => s + r.balance, 0);
      return { label: b.label, amount, percent: 0, tone: b.tone };
    });
    return { montantEchu, dso: weightedAge, risk, aged, open };
  }, [customer]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="rounded-panel border border-error/30 bg-error-container p-6">
        <p className="flex items-center gap-2 font-semibold text-on-error-container">
          <AlertTriangle className="h-4 w-4" /> Client introuvable ou accès non autorisé.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "resume", label: "Résumé" },
    { id: "comptes", label: "Comptes", count: customer.accounts.length },
    { id: "factures", label: "Factures", count: customer.invoices.length },
    { id: "paiements", label: "Paiements", count: customer.payments.length },
    { id: "creances", label: "Créances", count: customer.receivables.filter((r) => r.balance > 0).length },
    { id: "historique", label: "Historique d'actions", count: customer.actions.length },
  ];

  return (
    <>
      <Link to="/clients" className="flex w-fit items-center gap-1.5 text-[13px] text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour à la liste
      </Link>

      {/* Résumé client */}
      <Card className="p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-on-surface">{customer.name}</h2>
              <span className="t-tabular rounded-card border border-outline-variant bg-surface-container-low px-2 py-0.5 text-on-surface-variant">
                ID : {customer.id}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={customerStatusTone[customer.status]}>{customerStatusLabel[customer.status]}</Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-[12px] text-on-surface">
                <Building2 className="h-3 w-3" /> Agence : {customer.agency}
              </span>
              <span className="text-[12px] text-on-surface-variant">
                {customer.type === "entreprise" ? "Entreprise" : customer.type === "etat" ? "État" : "Particulier"} · {customer.center}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="t-label text-on-surface-variant">Solde total</p>
            <p className="t-tabular text-[28px] font-semibold tracking-tight text-primary">
              {xaf(customer.balance)}
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        items={tabs}
        active={tab}
        onChange={(t) => setSearchParams(t === "resume" ? {} : { tab: t })}
      />

      {metrics && metrics.montantEchu > 0 && (
        <div className="flex items-start gap-3 rounded-panel border border-warning/30 bg-warning-container p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-semibold text-on-warning-container">
              {xaf(metrics.montantEchu)} de créances échues — action requise
            </p>
            <p className="text-[13px] text-on-warning-container">
              Ce client a des dettes en retard. Prochaine étape recommandée : planifier une relance ou une mise en demeure depuis l'onglet Créances ou Historique.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setActionOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> Nouvelle action de recouvrement
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearchParams({ tab: "creances" })}>
                Voir les créances <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "resume" && metrics && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 flex flex-col gap-5 md:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations de contact</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                  <div>
                    <p className="t-label text-on-surface-variant">Adresse</p>
                    <p className="mt-1 text-[14px] text-on-surface">
                      {customer.address || "—"}
                      <br />
                      {customer.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                  <div>
                    <p className="t-label text-on-surface-variant">E-mail principal</p>
                    <p className="t-tabular mt-1 text-on-surface">{customer.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                  <div>
                    <p className="t-label text-on-surface-variant">Téléphone</p>
                    <p className="t-tabular mt-1 text-on-surface">{customer.phone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gestionnaire de compte</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.manager ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={customer.manager.name} tone="tertiary" className="h-11 w-11 text-[15px]" />
                    <div>
                      <p className="text-[15px] font-semibold text-on-surface">{customer.manager.name}</p>
                      <p className="text-[13px] text-on-surface-variant">{customer.manager.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-on-surface-variant">Aucun gestionnaire affecté.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 flex flex-col gap-5 md:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle>Vue financière — balance âgée</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <AgedBars data={metrics.aged} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-card border border-outline-variant bg-surface-container-low p-3">
                    <p className="t-label text-on-surface-variant">Montant échu</p>
                    <p className="t-tabular mt-1 text-[16px] font-semibold text-on-surface">{xaf(metrics.montantEchu)}</p>
                  </div>
                  <div className="rounded-card border border-outline-variant bg-surface-container-low p-3">
                    <p className="t-label text-on-surface-variant">Délai moyen (DSO)</p>
                    <p className="t-tabular mt-1 text-[16px] font-semibold text-on-surface">{Math.round(metrics.dso)} jours</p>
                  </div>
                  <RiskBox risk={metrics.risk} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dernières actions de recouvrement</CardTitle>
                <button
                  onClick={() => setSearchParams({ tab: "historique" })}
                  className="t-label text-primary hover:underline"
                >
                  Voir tout l'historique
                </button>
              </CardHeader>
              <CardContent>
                <Timeline actions={customer.actions.slice(0, 3)} />
              </CardContent>
            </Card>

            <Button onClick={() => setActionOpen(true)} className="self-start">
              <MessageSquare className="h-4 w-4" /> Nouvelle action de recouvrement
            </Button>
          </div>
        </div>
      )}

      {tab === "comptes" && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Numéro de compte</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Gestionnaire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {customer.accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="t-tabular text-data">{a.number}</TableCell>
                    <TableCell className="text-on-surface-variant">{a.agency}</TableCell>
                    <TableCell className="text-on-surface-variant">{a.center}</TableCell>
                    <TableCell className="text-on-surface-variant">{customer.manager?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={a.status === "actif" ? "success" : a.status === "suspendu" ? "warning" : "neutral"}>
                        {a.status === "actif" ? "Actif" : a.status === "suspendu" ? "Suspendu" : "Clôturé"}
                      </Badge>
                    </TableCell>
                    <TableCell className="t-tabular text-right">{xaf(a.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {tab === "factures" && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Numéro</TableHead>
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
                {customer.invoices.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="t-tabular text-data">{f.number}</TableCell>
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
        </Card>
      )}

      {tab === "paiements" && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Référence</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Imputé</TableHead>
                  <TableHead>Statut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {customer.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="t-tabular text-data">{p.reference}</TableCell>
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
        </Card>
      )}

      {tab === "creances" && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
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
                {customer.receivables.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="t-tabular text-data">{r.invoiceNumber}</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.accountNumber}</TableCell>
                    <TableCell className="t-tabular text-right text-on-surface-variant">{xaf(r.initial)}</TableCell>
                    <TableCell className={`t-tabular text-right font-semibold ${r.balance > 0 ? "text-error" : "text-on-surface"}`}>
                      {xaf(r.balance)}
                    </TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{r.ageDays} j</TableCell>
                    <TableCell className="t-tabular text-on-surface-variant">{dateFr(r.dueDate)}</TableCell>
                    <TableCell>
                      <Badge tone={receivableStatusTone[r.status]}>{receivableStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {tab === "historique" && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des actions</CardTitle>
            <Button size="sm" onClick={() => setActionOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5" /> Nouvelle action
            </Button>
          </CardHeader>
          <CardContent>
            <Timeline actions={customer.actions} />
          </CardContent>
        </Card>
      )}

      <NewActionModal customerId={customer.id} open={actionOpen} onClose={() => setActionOpen(false)} />
    </>
  );
}

const riskBoxStyles: Record<Risk["tone"], { box: string; label: string; value: string }> = {
  success: { box: "border-success/30 bg-success-container", label: "text-success", value: "text-success" },
  warning: { box: "border-warning/30 bg-warning-container", label: "text-warning", value: "text-warning" },
  error: { box: "border-error/30 bg-error-container", label: "text-on-error-container", value: "text-error" },
};

function RiskBox({ risk }: { risk: Risk }) {
  const s = riskBoxStyles[risk.tone];
  return (
    <div className={`rounded-card border p-3 ${s.box}`}>
      <p className={`t-label ${s.label}`}>Risque</p>
      <p className={`mt-1 text-[16px] font-semibold ${s.value}`}>{risk.label}</p>
    </div>
  );
}

function NewActionModal({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
  const [type, setType] = useState("Appel téléphonique");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"planifiee" | "en-cours">("planifiee");
  const [dueDate, setDueDate] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Action enregistrée et tracée.");
      setNote("");
      setDueDate("");
      onClose();
    },
    onError: () => toast.error("Enregistrement impossible, réessayez."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueInDays = dueDate ? Math.max(0, Math.ceil((Date.parse(dueDate) - Date.now()) / 86_400_000)) : null;
    mutation.mutate({ customerId, type, note, status, dueInDays });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle action de recouvrement"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button form="action-form" type="submit" disabled={mutation.isPending || !type || !note.trim()}>
            <CheckCircle2 className="h-4 w-4" /> Enregistrer l'action
          </Button>
        </>
      }
    >
      <form id="action-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="act-type">Type d'action</Label>
          <Select id="act-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option>Appel téléphonique</option>
            <option>Email de relance</option>
            <option>SMS de relance</option>
            <option>Relance écrite</option>
            <option>Mise en demeure</option>
            <option>Visite sur site</option>
            <option>Plan de règlement</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="act-note">Note / compte-rendu</Label>
          <textarea
            id="act-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Décrivez le contact, l'engagement du client ou la relance envoyée…"
            className="w-full resize-none rounded-card border border-outline-variant bg-surface-bright px-3 py-2 text-[14px] text-on-surface outline-none placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="act-status">Statut</Label>
            <Select id="act-status" value={status} onChange={(e) => setStatus(e.target.value as "planifiee" | "en-cours")}>
              <option value="planifiee">Planifiée</option>
              <option value="en-cours">En cours</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="act-due">Échéance (optionnel)</Label>
            <Input id="act-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
          <CalendarClock className="h-3.5 w-3.5" />
          L'action est horodatée et rattachée au dossier (traçabilité).
        </p>
      </form>
    </Modal>
  );
}
