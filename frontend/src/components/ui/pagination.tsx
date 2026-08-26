import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Fenêtre glissante de numéros : suit la page courante pour que son numéro reste toujours visible. */
function pageWindow(page: number, pages: number, windowSize = 5): number[] {
  if (pages <= windowSize) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(page - 2, pages - windowSize + 1));
  const end = Math.min(pages, start + windowSize - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-2.5">
      <p className="text-[13px] text-on-surface-variant">
        Affichage de <span className="font-medium text-on-surface">{from}</span> à{" "}
        <span className="font-medium text-on-surface">{to}</span> sur{" "}
        <span className="font-medium text-on-surface">{total.toLocaleString("fr-FR")}</span> entrées
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageWindow(page, pages).map((n) => {
          const active = n === page;
          return (
            <button
              key={n}
              type="button"
              aria-label={`Aller à la page ${n}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(n)}
              className={cn(
                "t-tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] transition-all duration-300",
                active
                  ? "scale-110 bg-primary font-bold text-on-primary shadow-popover ring-4 ring-primary-fixed-dim"
                  : "border border-outline-variant bg-surface-bright text-on-surface-variant hover:border-primary hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              {n}
            </button>
          );
        })}
        {pages > 5 && page < pages - 2 && <span className="px-0.5 text-[13px] text-on-surface-variant">…</span>}
        {pages > 1 && (
          <span className="t-tabular hidden whitespace-nowrap px-1.5 text-[12px] text-on-surface-variant sm:block">
            page {page.toLocaleString("fr-FR")} / {pages.toLocaleString("fr-FR")}
          </span>
        )}
        <Button variant="outline" size="icon" aria-label="Page suivante" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
