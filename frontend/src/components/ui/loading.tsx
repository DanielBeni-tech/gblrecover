import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/** Loader Uiverse (milley69) — polyline animée. */
export function Loading({ className, label = "Chargement" }: { className?: string; label?: string }) {
  return (
    <div className={cn("loading flex flex-col items-center justify-center gap-3", className)} role="status" aria-live="polite" aria-busy="true">
      <svg width="64" height="48" viewBox="0 0 64 48" aria-hidden="true">
        <polyline id="back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" />
        <polyline id="front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[280px] w-full items-center justify-center py-12", className)}>
      <Loading />
    </div>
  );
}

/** Overlay dès qu'une requête ou mutation React Query est en cours. */
export function GlobalQueryLoader() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = fetching + mutating > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(t);
  }, [busy]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-surface/50" aria-hidden>
      <Loading label="Chargement en cours" />
    </div>
  );
}
