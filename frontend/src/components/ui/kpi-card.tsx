import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  tone?: "default" | "error" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
        tone === "error" ? "border-error/40" : tone === "success" ? "border-success/40" : tone === "warning" ? "border-warning/40" : "border-outline-variant",
      )}
    >
      <p className="t-label mb-1.5 text-on-surface-variant">{label}</p>
      <p className={cn("t-tabular text-[24px] leading-8 font-semibold tracking-tight", tone === "error" ? "text-error" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-on-surface")}>
        {value}
      </p>
      {delta && <div className="mt-1.5">{delta}</div>}
    </div>
  );
}
