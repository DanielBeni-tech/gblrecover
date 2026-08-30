import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";

interface EnhancedKpiProps {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: number | null;
  sparklineData?: number[];
  tone?: "default" | "success" | "warning" | "error";
  accentColor?: string;
  onClick?: () => void;
}

export function EnhancedKpi({
  label,
  value,
  icon: Icon,
  trend,
  sparklineData,
  tone = "default",
  accentColor = "#6366f1",
  onClick,
}: EnhancedKpiProps) {
  const toneStyles = {
    default: "border-outline-variant/50",
    success: "border-success/30",
    warning: "border-warning/30",
    error: "border-error/30",
  };

  const toneDot = {
    default: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={onClick ? "cursor-pointer text-left" : ""}
    >
      <Card
        className={`group relative overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 ${toneStyles[tone]} ${
          onClick ? "hover:border-primary/50" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  {label}
                </p>
              </div>
              <p className="t-tabular truncate text-xl font-bold text-on-surface">
                {value}
              </p>
              {trend !== undefined && trend !== null && (
                <p
                  className={`flex items-center gap-0.5 text-[10px] font-medium ${
                    trend > 0 ? "text-success" : trend < 0 ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  <span>{trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}</span>
                  <span className="t-tabular">
                    {Math.abs(trend).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-on-surface-variant">vs mois préc.</span>
                </p>
              )}
            </div>
            {Icon && (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                style={{
                  backgroundColor: `${accentColor}15`,
                  color: accentColor,
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>
          {sparklineData && sparklineData.length >= 2 && (
            <div className="mt-3 -mb-1">
              <Sparkline
                data={sparklineData}
                width={140}
                height={28}
                color={accentColor}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Component>
  );
}
