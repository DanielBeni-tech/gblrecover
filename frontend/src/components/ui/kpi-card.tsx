import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  icon?: ElementType;
  tone?: "default" | "error" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-surface-container-lowest p-4 shadow-card transition-all",
        tone === "error" ? "border-error/40" : tone === "success" ? "border-success/40" : tone === "warning" ? "border-warning/40" : "border-outline-variant",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="t-label text-on-surface-variant">{label}</p>
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-fixed/60 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className={cn("t-tabular mt-1.5 text-[22px] leading-7 font-semibold tracking-tight", tone === "error" ? "text-error" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-on-surface")}>
        {value}
      </p>
      {delta && <div className="mt-1.5">{delta}</div>}
    </div>
  );
}
