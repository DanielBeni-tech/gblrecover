import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ label, options, selected, onChange, placeholder = "Tous", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-card border bg-surface-bright px-3 text-[13px] transition-colors",
          open ? "border-primary ring-1 ring-primary" : "border-outline-variant",
        )}
      >
        <span className={cn("flex-1 truncate text-left", !hasSelection && "text-on-surface-variant")}>
          {hasSelection ? `${selected.length} sélectionné(s)` : placeholder}
        </span>
        {hasSelection && (
          <X className="h-3.5 w-3.5 cursor-pointer text-on-surface-variant hover:text-error" onClick={clearAll} />
        )}
        <ChevronDown className={cn("h-4 w-4 text-on-surface-variant transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-card border border-outline-variant bg-surface-bright shadow-lg">
          {options.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-on-surface-variant">Aucune option</div>
          )}
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-container-high",
                  isSelected && "bg-primary-container/20",
                )}
              >
                <div className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  isSelected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-bright",
                )}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {hasSelection && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-medium text-on-primary-container">
              {s}
              <X className="h-2.5 w-2.5 cursor-pointer hover:text-error" onClick={() => toggle(s)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
