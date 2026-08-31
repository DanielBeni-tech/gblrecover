import { xafCompact } from "@/lib/format";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

const COLORS = ["#2563eb", "#f59e0b", "#f97316", "#ef4444"];

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let acc = 0;
  const stops = data
    .map((d) => {
      const from = (acc / total) * 360;
      acc += d.value;
      const to = (acc / total) * 360;
      return `${d.color} ${from}deg ${to}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
        />
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-surface-container-lowest text-center">
          {centerValue && (
            <strong className="t-tabular text-lg font-bold text-on-surface">
              {centerValue}
            </strong>
          )}
          {centerLabel && (
            <span className="text-[11px] text-on-surface-variant">
              {centerLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COLORS[i] ?? d.color }}
              />
              {d.label}
            </span>
            <span className="t-tabular text-[13px] font-semibold text-on-surface">
              {xafCompact(d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
