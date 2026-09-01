const fr = new Intl.NumberFormat("fr-FR");

/** Montant en XAF, groupé à la française : "XAF 45 200 000" */
export function xaf(amount: number): string {
  return `XAF ${fr.format(Math.round(amount))}`;
}

/** Montant compact pour les charts : "2,4 M" */
export function xafCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  }
  return fr.format(amount);
}

/** Date courte française : "12/07/2026" */
export function dateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

/** Date + heure : "26/07/2026 09:45" */
export function dateTimeFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ancienneté en jours par rapport à aujourd'hui */
export function ageInDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Initiales pour les avatars : "Alain Leroux" → "AL" */
export function initials(name: string): string {
  return name
    .replace(/^(M\.|Mme|Mlle|Dr)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
