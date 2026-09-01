import { useState } from "react";
import { xafCompact } from "@/lib/format";

const BUCKET_COLORS = ["#2563eb", "#f59e0b", "#f97316", "#ef4444"];
const BUCKET_LABELS = ["0 – 30 jours", "31 – 60 jours", "61 – 90 jours", "> 90 jours"];

function fmtMonth(raw: string): string {
  if (!raw) return raw;
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [y, m] = raw.split("-");
  return `${months[parseInt(m, 10) - 1] ?? m} ${y?.slice(2) ?? ""}`;
}

export interface StackedBarDatum {
  mois: string;
  t0_30: number;
  t31_60: number;
  t61_90: number;
  t90plus: number;
}

export function StackedBarChart({ data }: { data: StackedBarDatum[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = Math.max(
    ...data.map((d) => d.t0_30 + d.t31_60 + d.t61_90 + d.t90plus),
    1,
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[11px] text-on-surface-variant">
        {BUCKET_LABELS.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[i] }} />
            {label}
          </span>
        ))}
      </div>
      <div className="relative flex h-[220px] items-end gap-1.5">
        {data.map((d, idx) => {
          const total = d.t0_30 + d.t31_60 + d.t61_90 + d.t90plus;
          const h0 = (d.t0_30 / max) * 100;
          const h1 = (d.t31_60 / max) * 100;
          const h2 = (d.t61_90 / max) * 100;
          const h3 = (d.t90plus / max) * 100;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={d.mois}
              className="flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg border border-outline-variant bg-surface-bright p-2.5 shadow-lg">
                  <div className="mb-1.5 text-[12px] font-bold text-on-surface">
                    {fmtMonth(d.mois)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {BUCKET_LABELS.map((label, i) => {
                      const vals = [d.t0_30, d.t31_60, d.t61_90, d.t90plus];
                      return (
                        <div key={label} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[i] }} />
                            {label}
                          </span>
                          <span className="t-tabular font-semibold">{xafCompact(vals[i])}</span>
                        </div>
                      );
                    })}
                    <div className="mt-1 border-t border-outline-variant pt-1 text-[11px] font-medium text-on-surface-variant">
                      Total: {xafCompact(total)}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex w-full flex-1 flex-col justify-end">
                <div className="w-full rounded-t-[2px] bg-error transition-all" style={{ height: `${Math.max(1, h3)}%`, opacity: isHovered ? 1 : 0.8 }} />
                <div className="w-full bg-warning transition-all" style={{ height: `${Math.max(1, h2)}%`, opacity: isHovered ? 1 : 0.8 }} />
                <div className="w-full bg-amber-400 transition-all" style={{ height: `${Math.max(1, h1)}%`, opacity: isHovered ? 1 : 0.8 }} />
                <div className="w-full bg-primary transition-all" style={{ height: `${Math.max(1, h0)}%`, opacity: isHovered ? 1 : 0.8 }} />
              </div>
              <span className="mt-1 t-tabular text-[9px] text-on-surface-variant">
                {fmtMonth(d.mois)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
