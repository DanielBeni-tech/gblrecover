import { useState } from "react";
import { xafCompact } from "@/lib/format";

const MONTH_LABELS: Record<string, string> = {
  "2025-12": "Déc 25", "2026-01": "Jan 26", "2026-02": "Fév 26", "2026-03": "Mar 26",
  "2026-04": "Avr 26", "2026-05": "Mai 26", "2026-06": "Juin 26",
};

function fmtMonth(raw: string): string {
  if (!raw) return raw;
  const ym = raw.slice(0, 7);
  return MONTH_LABELS[ym] ?? raw;
}

export function TrendChart({ data }: { data: Array<{ month: string; dette: number; encaissement: number }> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => Math.max(d.dette, d.encaissement)), 1);

  return (
    <div>
      <div className="mb-4 flex items-center gap-5 text-[12px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-error" /> Impayé (dette)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-success" /> Encaissement (payé)
        </span>
      </div>
      <div className="relative flex h-[240px] items-end gap-3">
        {data.map((d, idx) => {
          const detteH = (d.dette / max) * 100;
          const encH = (d.encaissement / max) * 100;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={d.month}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-lg border border-outline-variant bg-surface-bright p-2.5 shadow-lg">
                  <div className="mb-1.5 text-[12px] font-bold text-on-surface">{fmtMonth(d.month)}</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-error" /> Impayé</span>
                      <span className="t-tabular font-semibold text-error">{xafCompact(d.dette)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> Payé</span>
                      <span className="t-tabular font-semibold text-success">{xafCompact(d.encaissement)}</span>
                    </div>
                    <div className="mt-1 border-t border-outline-variant pt-1 text-[11px] font-medium text-on-surface-variant">
                      Total: {xafCompact(d.dette + d.encaissement)}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div className="w-1/2 min-w-[6px] max-w-[20px] rounded-t-[2px] bg-error transition-all" style={{ height: `${Math.max(2, detteH)}%`, opacity: isHovered ? 1 : 0.75 }} />
                <div className="w-1/2 min-w-[6px] max-w-[20px] rounded-t-[2px] bg-success transition-all" style={{ height: `${Math.max(2, encH)}%`, opacity: isHovered ? 1 : 0.75 }} />
              </div>
              <span className="t-tabular text-[10px] text-on-surface-variant">{fmtMonth(d.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
