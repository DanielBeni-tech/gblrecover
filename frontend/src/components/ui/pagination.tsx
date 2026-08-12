import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const n = i + 1;
          const active = n === page;
          return (
            <Button
              key={n}
              variant={active ? "primary" : "outline"}
              size="icon"
              className={cn("text-[13px]", !active && "text-on-surface-variant")}
              onClick={() => onChange(n)}
              aria-current={active ? "page" : undefined}
            >
              {n}
            </Button>
          );
        })}
        <Button variant="outline" size="icon" aria-label="Page suivante" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
