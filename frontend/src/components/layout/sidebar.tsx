import { NavLink } from "react-router-dom";
import {
  Activity,
  FileText,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/factures", label: "Factures", icon: FileText },
  { to: "/paiements", label: "Paiements", icon: Wallet },
  { to: "/creances", label: "Créances", icon: Scale },
  { to: "/imports", label: "Imports", icon: Upload },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const content = (
    <div className="flex h-full flex-col bg-surface py-4">
      <div className="mb-6 flex items-center gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-on-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold leading-6 tracking-tight text-primary">GBLRecover</h1>
          <p className="t-label text-[10px] text-on-surface-variant">Revenue Assurance</p>
        </div>
        <button onClick={onClose} aria-label="Fermer le menu" className="ml-auto rounded p-1 text-on-surface-variant hover:bg-surface-container-high lg:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2" aria-label="Navigation principale">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-card px-3 py-2.5 text-[14px] transition-colors",
                isActive
                  ? "border-r-4 border-primary bg-primary-fixed font-semibold text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto border-t border-outline-variant pt-2">
          <NavLink
            to="/administration"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-card px-3 py-2.5 text-[14px] transition-colors",
                isActive
                  ? "border-r-4 border-primary bg-primary-fixed font-semibold text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )
            }
          >
            <ShieldCheck className="h-[18px] w-[18px]" />
            Administration
          </NavLink>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-outline-variant lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-outline-variant shadow-[0_8px_24px_rgba(15,23,42,0.2)]">{content}</aside>
        </div>
      )}
    </>
  );
}
