interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "#3b82f6",
  size = "md",
  showLabel = false,
  label,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const heightClass = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  }[size];

  return (
    <div className="w-full">
      {showLabel && label && (
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-on-surface-variant">{label}</span>
          <span className="t-tabular font-medium text-on-surface">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-surface-container ${heightClass}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
