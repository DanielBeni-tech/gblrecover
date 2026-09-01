import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  nextAction,
  actions,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  nextAction?: string;
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        <h1
          className={
            size === "lg"
              ? "text-[32px] font-bold leading-[40px] tracking-[-0.02em] text-on-surface md:text-[36px] md:leading-[44px]"
              : "text-[24px] font-semibold leading-8 tracking-[-0.01em] text-on-surface"
          }
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[14px] leading-5 text-on-surface-variant">{subtitle}</p>}
        {nextAction && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-primary">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{nextAction}</span>
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
