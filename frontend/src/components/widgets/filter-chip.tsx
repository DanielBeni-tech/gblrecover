import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-all duration-200 hover:bg-primary/20">
      <span className="text-on-surface-variant">{label}:</span>
      <span className="font-semibold text-primary">{value}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 rounded-full p-0.5 transition-colors duration-200 hover:bg-primary/20"
        aria-label={`Supprimer le filtre ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
