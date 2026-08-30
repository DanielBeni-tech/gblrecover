import { useRef, useState, type ElementType, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "error" | "success" | "warning" | "primary" | "info";

const toneGradients: Record<Tone, string> = {
  default: "from-slate-400 via-slate-500 to-slate-400",
  primary: "from-cyan-400 via-blue-500 to-purple-500",
  success: "from-emerald-400 via-green-500 to-teal-500",
  warning: "from-amber-400 via-orange-500 to-yellow-500",
  error: "from-rose-400 via-red-500 to-pink-500",
  info: "from-sky-400 via-blue-500 to-indigo-500",
};

const toneRing: Record<Tone, string> = {
  default: "ring-slate-400/40",
  primary: "ring-cyan-400/50",
  success: "ring-emerald-400/50",
  warning: "ring-amber-400/50",
  error: "ring-rose-400/50",
  info: "ring-sky-400/50",
};

const toneShadow: Record<Tone, string> = {
  default: "shadow-slate-500/30",
  primary: "shadow-cyan-500/40",
  success: "shadow-emerald-500/40",
  warning: "shadow-amber-500/40",
  error: "shadow-rose-500/40",
  info: "shadow-sky-500/40",
};

const toneText: Record<Tone, string> = {
  default: "text-on-surface",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

const toneIconBg: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-cyan-100 text-cyan-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
};

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * KpiCard — carte métrique dynamique au toucher.
 * - Bordure dégradée néon selon la tonalité
 * - Effet 3D tilt suivant le curseur
 * - Ripple au clic/tap
 * - Glow qui suit la souris
 * - Underline accent animé
 * - Coins ambiants lumineux
 */
export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
  className,
  onClick,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  icon?: ElementType;
  tone?: Tone;
  className?: string;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const gradient = toneGradients[tone];
  const ring = toneRing[tone];
  const glow = toneShadow[tone];
  const textColor = toneText[tone];
  const iconBg = toneIconBg[tone];

  // Effet de suivi du curseur (tilt 3D dynamique au toucher)
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Tilt max ±6 degrés
    const tiltX = ((y - centerY) / centerY) * -6;
    const tiltY = ((x - centerX) / centerX) * 6;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsPressed(false);
  };

  // Effet ripple au clic/tap
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 1.5;
    const newRipple = { id: Date.now() + Math.random(), x, y, size };
    setRipples((prev) => [...prev, newRipple]);
    // Retire le ripple après l'animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 800);
    if (onClick) onClick();
  };

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);

  return (
    <>
      {/* Keyframes pour l'animation ripple (inline, évite de toucher au CSS global) */}
      <style>{`
        @keyframes kpi-ripple {
          0% { transform: scale(0); opacity: 0.45; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .kpi-ripple {
          animation: kpi-ripple 0.8s ease-out forwards;
          pointer-events: none;
        }
      `}</style>
      <div
        ref={cardRef}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        style={{
          transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${
            isPressed ? "scale(0.97)" : "scale(1)"
          }`,
          transformStyle: "preserve-3d",
          transition: "transform 0.15s ease-out",
        }}
        className={cn(
          // Card container with gradient neon border
          "group relative overflow-hidden rounded-2xl p-[1.5px]",
          "bg-gradient-to-br",
          gradient,
          "shadow-lg",
          glow,
          "transition-shadow duration-300 hover:shadow-2xl",
          onClick && "cursor-pointer active:scale-[0.97]",
          className
        )}
      >
        {/* Inner card */}
        <div className="relative rounded-[15px] bg-gradient-to-br from-surface to-surface-container-low px-4 py-3.5 overflow-hidden">
          {/* Cursor-tracking glow (follows mouse) */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[15px] opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              "bg-gradient-to-br",
              gradient
            )}
            style={{
              opacity: 0.08,
              maskImage: `radial-gradient(circle 120px at ${50 + tilt.y * 4}% ${
                50 + tilt.x * 4
              }%, black, transparent)`,
              WebkitMaskImage: `radial-gradient(circle 120px at ${
                50 + tilt.y * 4
              }% ${50 + tilt.x * 4}%, black, transparent)`,
            }}
          />

          {/* Ripple effect on click */}
          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              className={cn(
                "absolute rounded-full bg-gradient-to-br kpi-ripple",
                gradient
              )}
              style={{
                left: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                width: ripple.size,
                height: ripple.size,
                opacity: 0.3,
              }}
            />
          ))}

          {/* Animated ring on press */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[15px] ring-2 transition-all duration-300",
              isPressed ? `${ring} opacity-100` : "ring-transparent opacity-0"
            )}
          />

          {/* Top row: label + icon */}
          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {label}
            </p>
            {Icon && (
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
                  "group-hover:scale-110 group-hover:rotate-3",
                  iconBg
                )}
                style={{
                  transform: isPressed
                    ? "scale(0.9) rotate(-3deg)"
                    : undefined,
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Main value */}
          <div className="relative mt-2">
            <p
              className={cn(
                "t-tabular text-[24px] leading-7 font-bold tracking-tight transition-all duration-300",
                "group-hover:translate-x-0.5",
                textColor
              )}
            >
              {value}
            </p>
            {/* Underline accent that grows on hover */}
            <div
              className={cn(
                "mt-1.5 h-[2px] rounded-full bg-gradient-to-r",
                gradient,
                "transition-all duration-500 ease-out",
                "w-12 group-hover:w-24 group-hover:shadow-sm",
                glow
              )}
            />
          </div>

          {/* Delta / footer */}
          {delta && (
            <div className="relative mt-2 text-[11px] text-on-surface-variant">
              {delta}
            </div>
          )}

          {/* Corner ambient glow */}
          <div
            className={cn(
              "pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br opacity-25 blur-2xl",
              gradient,
              "transition-opacity duration-500 group-hover:opacity-40"
            )}
          />

          {/* Bottom corner subtle glow */}
          <div
            className={cn(
              "pointer-events-none absolute -left-6 -bottom-6 h-16 w-16 rounded-full bg-gradient-to-tr opacity-15 blur-xl",
              gradient,
              "transition-opacity duration-500 group-hover:opacity-25"
            )}
          />
        </div>
      </div>
    </>
  );
}
