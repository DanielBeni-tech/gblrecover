import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { getImportBatches, runImport } from "@/api/client";
import type { UiImportResult } from "@/api/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { dateTimeFr } from "@/lib/format";

const templates: Record<string, string> = {
  Factures: "NUMERO_FACTURE;NUMERO_COMPTE;DATE_EMISSION;DATE_ECHEANCE;MONTANT;STATUT",
  Paiements: "REFERENCE_PAIEMENT;NUMERO_COMPTE;DATE_PAIEMENT;MONTANT",
  Clients: "IDENTIFIANT_CLIENT;NOM_COMPLET;TYPE;TELEPHONE;AGENCE",
  Créances: "NUMERO_FACTURE;NUMERO_COMPTE;MONTANT_INITIAL;SOLDE;DATE_ECHEANCE",
};

const batchTone: Record<string, "success" | "secondary" | "error"> = { succes: "success", partiel: "secondary", echec: "error" };
const batchLabel: Record<string, string> = { succes: "Succès", partiel: "Partiel", echec: "Échec" };

export function ImportsPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("Factures");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<UiImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: batches, refetch } = useQuery({ queryKey: ["imports"], queryFn: getImportBatches });

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx") && !f.name.toLowerCase().endsWith(".xls")) {
      toast.error("Format non autorisé. Sélectionnez un fichier .xlsx ou .xls.");
      return;
    }
    setFile(f);
    setResult(null);
    setStep(1);
    setValidating(true);
    runImport(f.name, type)
      .then((r) => setResult(r))
      .catch(() => toast.error("La validation du fichier a échoué."))
      .finally(() => setValidating(false));
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + templates[type]], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele_gblrecover_${type.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Modèle téléchargé.");
  };

  const confirmImport = () => {
    setStep(2);
    queryClient.invalidateQueries({ queryKey: ["imports"] });
    toast.success("Import validé — lot enregistré et tracé.");
  };

  const restart = () => {
    setFile(null);
    setResult(null);
    setStep(0);
  };

  return (
    <>
      <PageHeader
        title="Importation de données Excel"
        subtitle="Intégration des fichiers de facturation, paiements, clients et créances."
        actions={<Stepper steps={["Sélection", "Validation", "Rapport"]} current={step} />}
      />

      {step === 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label htmlFor="imp-type" className="text-[12px] font-medium text-on-surface-variant">
                Type de données à importer
              </label>
              <Select id="imp-type" value={type} onChange={(e) => setType(e.target.value)} className="w-52">
                {Object.keys(templates).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={`group flex min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed p-8 text-center transition-colors ${
                dragging ? "border-primary bg-primary-fixed/20" : "border-outline-variant hover:border-primary hover:bg-primary-fixed/10"
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed transition-transform group-hover:scale-110">
                <CloudUpload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-[18px] font-semibold text-on-surface">Glissez-déposez votre fichier ici</h3>
              <p className="max-w-md text-[14px] text-on-surface-variant">
                ou cliquez pour parcourir vos dossiers locaux. Les données seront automatiquement validées avant l'intégration finale.
              </p>
              <div className="flex items-center gap-3 text-[12px] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Formats acceptés : .xlsx
                </span>
                <span className="h-1 w-1 rounded-full bg-outline" />
                <span className="flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" /> Taille max : 20 Mo
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                aria-label="Sélectionner un fichier Excel"
                onChange={(e) => {
                  acceptFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </button>
          </div>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Préparation des données
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="flex-1 text-[14px] text-on-surface-variant">
                Vérifiez que votre fichier respecte la structure standard GBLRecover. Les colonnes obligatoires doivent être présentes pour garantir l'intégrité de la base.
              </p>
              <ul className="space-y-2 rounded-card border border-outline-variant bg-surface-container-low p-3 text-[13px]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Formats de dates (JJ/MM/AAAA)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Montants sans devise (XAF)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Identifiants clients uniques
                </li>
              </ul>
              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-4 w-4" /> Télécharger le modèle type
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            {validating ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-[15px] font-semibold text-on-surface">Validation du fichier « {file?.name} »…</p>
                <p className="text-[13px] text-on-surface-variant">Contrôle des colonnes, des types et des règles métier.</p>
              </>
            ) : result ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed">
                  <FileSpreadsheet className="h-7 w-7 text-primary" />
                </div>
                <p className="text-[16px] font-semibold text-on-surface">
                  {result.batch.rejected === 0 ? "Fichier conforme" : result.batch.status === "echec" ? "Fichier bloqué" : "Rejets partiels détectés"}
                </p>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="t-tabular text-[20px] font-semibold text-success">{result.batch.processed.toLocaleString("fr-FR")}</p>
                    <p className="text-[12px] text-on-surface-variant">lignes valides</p>
                  </div>
                  <div className="w-px bg-outline-variant" />
                  <div>
                    <p className={`t-tabular text-[20px] font-semibold ${result.batch.rejected > 0 ? "text-warning" : "text-on-surface-variant"}`}>
                      {result.batch.rejected.toLocaleString("fr-FR")}
                    </p>
                    <p className="text-[12px] text-on-surface-variant">rejets</p>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>

          {result && result.rejects.length > 0 && (
            <div>
              <div className="border-t border-outline-variant bg-surface px-4 py-2.5">
                <p className="text-[14px] font-semibold text-on-surface">Détail des rejets</p>
              </div>
              <div className="max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Ligne</TableHead>
                      <TableHead>Colonne</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Motif</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {result.rejects.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="t-tabular text-on-surface-variant">{r.row}</TableCell>
                        <TableCell className="t-tabular text-success">{r.column}</TableCell>
                        <TableCell className="t-tabular text-on-surface-variant">{r.value || "—"}</TableCell>
                        <TableCell className="text-on-surface">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant bg-surface-container-low px-4 py-3">
              <Button variant="outline" onClick={restart}>
                <RefreshCw className="h-4 w-4" /> Corriger le fichier
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Télécharger le rapport de rejets
              </Button>
              {result.batch.status !== "echec" ? (
                <Button onClick={confirmImport}>Importer les lignes valides</Button>
              ) : (
                <Button variant="danger" disabled>
                  <AlertTriangle className="h-4 w-4" /> Import bloqué
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 2 && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <p className="text-[18px] font-semibold text-on-surface">Import terminé avec succès</p>
            <p className="max-w-md text-[13px] text-on-surface-variant">
              Le lot <span className="t-tabular text-on-surface">{result.batch.id}</span> a été enregistré : {result.batch.processed.toLocaleString("fr-FR")} lignes traitées,{" "}
              {result.batch.rejected.toLocaleString("fr-FR")} rejets isolés dans le rapport.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={restart}>
                <Upload className="h-4 w-4" /> Nouvel import
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Rapport final (démo)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Historique des imports récents</CardTitle>
          <button onClick={() => refetch()} aria-label="Actualiser" className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
            <RefreshCw className="h-4 w-4" />
          </button>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <tr>
                <TableHead>Date</TableHead>
                <TableHead>Fichier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Lignes traitées</TableHead>
                <TableHead className="text-right">Rejetées</TableHead>
                <TableHead className="text-center">Rapport</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {batches?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="t-tabular text-on-surface-variant">{dateTimeFr(b.date)}</TableCell>
                  <TableCell className="font-medium">{b.fileName}</TableCell>
                  <TableCell className="text-on-surface-variant">{b.type}</TableCell>
                  <TableCell>
                    <Badge tone={batchTone[b.status]}>{batchLabel[b.status]}</Badge>
                  </TableCell>
                  <TableCell className="t-tabular text-right">{b.processed.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className={`t-tabular text-right ${b.rejected > 0 ? "font-semibold text-warning" : "text-on-surface-variant"}`}>
                    {b.rejected.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      aria-label="Télécharger le rapport"
                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                      onClick={() => toast.success("Rapport téléchargé (démo).")}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Référence de fraîcheur */}
      <p className="text-[12px] text-on-surface-variant">Données de démonstration — volumes et montants synthétiques anonymisés (lot « GBL — Juillet 2026 »).</p>
    </>
  );
}
