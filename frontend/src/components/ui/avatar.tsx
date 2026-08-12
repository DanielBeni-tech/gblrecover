import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  className,
  tone = "primary",
}: {
  name: string;
  className?: string;
  tone?: "primary" | "tertiary";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
        tone === "primary" ? "bg-primary-container text-on-primary-container" : "bg-tertiary-container text-on-tertiary-container",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
