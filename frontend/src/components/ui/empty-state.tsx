import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed">
        <Inbox className="h-6 w-6 text-primary" />
      </div>
      <p className="text-[15px] font-semibold text-on-surface">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-on-surface-variant">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
