import { CalendarClock } from "lucide-react";
import type { CollectionAction } from "@/api/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

const actionTone: Record<string, BadgeTone> = {
  planifiee: "primary",
  "en-cours": "secondary",
  cloturee: "neutral",
};

const actionLabel: Record<string, string> = {
  planifiee: "Planifiée",
  "en-cours": "En cours",
  cloturee: "Clôturée",
};

export function Timeline({ actions }: { actions: CollectionAction[] }) {
  if (actions.length === 0) {
    return <p className="py-6 text-center text-[13px] text-on-surface-variant">Aucune action enregistrée pour le moment.</p>;
  }
  return (
    <ol className="relative ml-1 flex flex-col border-l border-outline-variant pl-5">
      {actions.map((a) => (
        <li key={a.id} className="relative pb-5 last:pb-0">
          <span
            className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest ${
              a.status === "cloturee" ? "bg-outline" : a.status === "planifiee" ? "bg-primary" : "bg-secondary-container"
            }`}
            aria-hidden
          />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-on-surface">
                {a.type}
                <Badge tone={actionTone[a.status]}>{actionLabel[a.status]}</Badge>
              </p>
              <p className="mt-0.5 text-[13px] text-on-surface-variant">{a.note}</p>
              <p className="mt-1 text-[12px] text-on-surface-variant">
                {a.owner} · {dateFr(a.date)}
                {a.result && <span className="ml-2 text-on-surface">Résultat : {a.result}</span>}
              </p>
              {a.dueDate && (
                <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-primary">
                  <CalendarClock className="h-3 w-3" /> Échéance : {dateFr(a.dueDate)}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
