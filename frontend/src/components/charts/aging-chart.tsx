import { xaf, xafCompact } from "@/lib/format";

const barTone: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary-container",
  warning: "bg-warning",
  error: "bg-error",
};

const textTone: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  warning: "text-warning",
  error: "text-error",
};

export interface AgingDatum {
  label: string;
  amount: number;
  percent: number;
  tone: "primary" | "secondary" | "warning" | "error";
}

/** Liste des tranches d'ancienneté avec barres de proportion (dashboard). */
export function AgingList({ data }: { data: AgingDatum[] }) {
  return (
    <div className="flex flex-col gap-1">
      {data.map((b) => (
        <div key={b.label} className="py-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[14px] text-on-surface-variant">{b.label}</span>
            <span className={`t-tabular font-semibold ${textTone[b.tone]}`}>
              {b.percent}% · {xafCompact(b.amount)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-low">
            <div className={`h-full rounded-full ${barTone[b.tone]}`} style={{ width: `${Math.max(2, b.percent)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barres verticales de la balance âgée (fiche client), tooltip au survol. */
export function AgedBars({ data }: { data: AgingDatum[] }) {
  const max = Math.max(...data.map((b) => b.amount), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-3 border-b border-outline-variant pb-1">
        {data.map((b) => (
          <div key={b.label} className="group relative flex flex-1 items-end justify-center">
            <div
              className={`w-full rounded-t-[2px] transition-all group-hover:opacity-80 ${barTone[b.tone]}`}
              style={{ height: `${Math.max(4, (b.amount / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-tertiary px-1.5 py-0.5 text-[11px] text-on-tertiary opacity-0 transition-opacity group-hover:opacity-100">
              {xaf(b.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3">
        {data.map((b) => (
          <span key={b.label} className={`flex-1 text-center text-[10px] font-semibold ${textTone[b.tone]}`}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
