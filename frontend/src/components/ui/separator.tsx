import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-outline-variant",
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        className,
      )}
    />
  );
}
