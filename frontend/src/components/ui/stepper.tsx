import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className={cn("h-[2px] w-8 shrink-0", i <= current ? "bg-primary" : "bg-outline-variant")} />}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  active && "bg-primary text-on-primary",
                  done && "bg-primary-fixed text-primary",
                  !active && !done && "bg-surface-container-high text-on-surface opacity-60",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("hidden text-[12px] font-medium sm:block", active && "font-bold text-primary", !active && "text-on-surface")}>
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
