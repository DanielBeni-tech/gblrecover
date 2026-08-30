import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "error" | "success" | "warning" | "primary" | "info";

const toneGradients: Record<Tone, string> = {
  default: "from-slate-400 via-slate-500 to-slate-400",
  primary: "from-cyan-400 via-blue-500 to-purple-500",
  success: "from-emerald-400 via-green-500 to-teal-500",
  warning: "from-amber-400 via-orange-500 to-yellow-500",
  error: "from-rose-400 via-red-500 to-pink-500",
  info: "from-sky-400 via-blue-500 to-indigo-500",
};

const toneGlow: Record<Tone, string> = {
  default: "shadow-slate-500/30",
  primary: "shadow-cyan-500/40",
  success: "shadow-emerald-500/40",
  warning: "shadow-amber-500/40",
  error: "shadow-rose-500/40",
  info: "shadow-sky-500/40",
};

const toneText: Record<Tone, string> = {
  default: "text-on-surface",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

const toneIconBg: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-cyan-100 text-cyan-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
};

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  icon?: ElementType;
  tone?: Tone;
  className?: string;
}) {
  const gradient = toneGradients[tone];
  const glow = toneGlow[tone];
  const textColor = toneText[tone];
  const iconBg = toneIconBg[tone];

  return (
    <div
      className={cn(
        // Card container with subtle dark surface (style néon)
        "group relative overflow-hidden rounded-2xl p-[1.5px]",
        "bg-gradient-to-br", gradient,
        "shadow-lg", glow,
        "transition-all duration-300 hover:-translate-y-0.5",
        "hover:shadow-xl",
        className
      )}
    >
      {/* Inner card with solid background */}
      <div className="relative rounded-[15px] bg-gradient-to-br from-surface to-surface-container-low px-4 py-3.5 backdrop-blur-sm">
        {/* Animated glow on hover */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[15px] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            "bg-gradient-to-br", gradient,
            "blur-xl"
          )}
          style={{ opacity: 0.06 }}
        />

        {/* Top row: label + icon */}
        <div className="relative flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {label}
          </p>
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
                iconBg
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Main value with gradient text */}
        <div className="relative mt-2">
          <p
            className={cn(
              "t-tabular text-[24px] leading-7 font-bold tracking-tight",
              textColor
            )}
          >
            {value}
          </p>
          {/* Underline accent */}
          <div
            className={cn(
              "mt-1.5 h-[2px] w-12 rounded-full bg-gradient-to-r", gradient,
              "transition-all duration-300 group-hover:w-20"
            )}
          />
        </div>

        {/* Delta / footer */}
        {delta && (
          <div className="relative mt-2 text-[11px] text-on-surface-variant">
            {delta}
          </div>
        )}

        {/* Corner glow accent */}
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-2xl",
            gradient
          )}
        />
      </div>
    </div>
  );
}
