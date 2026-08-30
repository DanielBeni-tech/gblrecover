interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  size = 100,
  strokeWidth = 12,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-[11px] text-on-surface-variant">Aucune donnée</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate stroke-dasharray for each segment
  let accumulatedOffset = 0;
  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const dashLength = (percentage / 100) * circumference;
    const gapLength = circumference - dashLength;
    const segment = {
      ...item,
      percentage,
      dashArray: `${dashLength.toFixed(2)} ${gapLength.toFixed(2)}`,
      dashOffset: (-accumulatedOffset).toFixed(2),
    };
    accumulatedOffset += dashLength;
    return segment;
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-surface-container text-opacity-30"
          />
          {/* Data segments */}
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {/* Center text */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="t-tabular text-lg font-bold text-on-surface">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-on-surface-variant">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="space-y-1.5">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-on-surface-variant">{item.label}</span>
              <span className="t-tabular font-medium text-on-surface">
                {item.value.toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
