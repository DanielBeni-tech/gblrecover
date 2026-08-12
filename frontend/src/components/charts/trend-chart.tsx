import { xafCompact } from "@/lib/format";

export function TrendChart({ data }: { data: Array<{ month: string; dette: number; encaissement: number }> }) {
  const max = Math.max(...data.map((d) => Math.max(d.dette, d.encaissement)));
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-primary" /> Dette
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-secondary-container" /> Encaissements
        </span>
      </div>
      <div className="flex h-[220px] items-end gap-4">
        {data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div
                className="w-1/3 min-w-[8px] max-w-[22px] rounded-t-[2px] bg-primary"
                style={{ height: `${Math.max(4, (d.dette / max) * 100)}%` }}
                title={`Dette ${d.month} : ${xafCompact(d.dette)}`}
              />
              <div
                className="w-1/3 min-w-[8px] max-w-[22px] rounded-t-[2px] bg-secondary-container"
                style={{ height: `${Math.max(4, (d.encaissement / max) * 100)}%` }}
                title={`Encaissements ${d.month} : ${xafCompact(d.encaissement)}`}
              />
            </div>
            <span className="t-tabular text-[11px] text-on-surface-variant">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
