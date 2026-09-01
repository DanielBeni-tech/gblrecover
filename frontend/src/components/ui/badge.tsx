import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "error" | "secondary" | "primary" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  error: "bg-error-container text-on-error-container",
  secondary: "bg-secondary-fixed text-on-secondary-fixed",
  primary: "bg-primary-fixed text-on-primary-fixed-variant",
  neutral: "bg-surface-container text-on-surface-variant",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Mappage des statuts métier vers les tons sémantiques. */
export const customerStatusTone: Record<string, BadgeTone> = {
  actif: "success",
  impaye: "warning",
  contentieux: "secondary",
  irrecouvrable: "error",
};

export const customerStatusLabel: Record<string, string> = {
  actif: "Actif · Sain",
  impaye: "Impayé < 30j",
  contentieux: "Contentieux",
  irrecouvrable: "Irrecouvrable",
};

export const invoiceStatusTone: Record<string, BadgeTone> = {
  payee: "success",
  partielle: "secondary",
  impayee: "warning",
  annulee: "neutral",
};

export const invoiceStatusLabel: Record<string, string> = {
  payee: "Payée",
  partielle: "Partielle",
  impayee: "Impayée",
  annulee: "Annulée",
};

export const paymentStatusTone: Record<string, BadgeTone> = {
  impute: "success",
  partiel: "secondary",
  recu: "warning",
  anomalie: "error",
};

export const paymentStatusLabel: Record<string, string> = {
  impute: "Imputé",
  partiel: "Partiel",
  recu: "Reçu",
  anomalie: "Anomalie",
};

export const receivableStatusTone: Record<string, BadgeTone> = {
  "en-cours": "primary",
  echue: "warning",
  urgente: "error",
  reglee: "success",
};

export const receivableStatusLabel: Record<string, string> = {
  "en-cours": "En cours",
  echue: "Échue",
  urgente: "Urgente",
  reglee: "Réglée",
};
