import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-panel border border-outline-variant bg-surface-container-lowest shadow-[0_8px_24px_rgba(15,23,42,0.16)] outline-none",
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-on-surface">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-card p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-outline-variant bg-surface-container-low px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
