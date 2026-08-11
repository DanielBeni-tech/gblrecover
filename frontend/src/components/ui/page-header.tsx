import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className={size === "lg" ? "text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-on-surface" : "text-[24px] font-semibold leading-8 tracking-[-0.01em] text-on-surface"}>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[14px] text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
