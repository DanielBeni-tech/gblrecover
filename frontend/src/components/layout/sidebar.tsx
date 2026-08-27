import { NavLink } from "react-router-dom";
import {
  Activity,
  Globe,
  PieChart,
  Building2,
  Landmark,
  Users,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const activeClass =
    "border-r-[3px] border-primary bg-brand-50 font-semibold text-primary shadow-sm";
  const inactiveClass =
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium";

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3.5 rounded-l-md px-3.5 py-3 text-[14px] transition-all duration-150",
      isActive ? activeClass : inactiveClass,
    );

  const content = (
    <div className="flex h-full flex-col bg-surface py-4">
      {/* Brand Header */}
      <div className="mb-6 flex items-center gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-on-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold leading-6 tracking-tight text-primary">
            GBLRecover
          </h1>
          <p className="t-label text-[10px] tracking-wider text-on-surface-variant uppercase">
            REVENUE ASSURANCE
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer le menu"
          className="ml-auto rounded p-1 text-on-surface-variant hover:bg-surface-container-high lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Main */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-3" aria-label="Navigation principale">
        {/* GROUPE 1: PILOTAGE */}
        <div className="mb-5">
          <div className="px-3.5 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            PILOTAGE
          </div>
          <div className="flex flex-col gap-1">
            <NavLink to="/vue-nationale" onClick={onClose} className={navLinkStyle}>
              <Globe className="h-[18px] w-[18px] shrink-0 text-current" />
              <span>Vue nationale</span>
            </NavLink>
            <NavLink to="/analyse-dette" onClick={onClose} className={navLinkStyle}>
              <PieChart className="h-[18px] w-[18px] shrink-0 text-current" />
              <span>Analyse de la dette</span>
            </NavLink>
          </div>
        </div>

        {/* GROUPE 2: PERFORMANCE */}
        <div className="mb-5">
          <div className="px-3.5 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            PERFORMANCE
          </div>
          <div className="flex flex-col gap-1">
            <NavLink to="/centres" onClick={onClose} className={navLinkStyle}>
              <Building2 className="h-[18px] w-[18px] shrink-0 text-current" />
              <span>Centres</span>
            </NavLink>
            <NavLink to="/agences" onClick={onClose} className={navLinkStyle}>
              <Landmark className="h-[18px] w-[18px] shrink-0 text-current" />
              <span>Agences</span>
            </NavLink>
            <NavLink to="/gestionnaires" onClick={onClose} className={navLinkStyle}>
              <Users className="h-[18px] w-[18px] shrink-0 text-current" />
              <span>Gestionnaires</span>
            </NavLink>
          </div>
        </div>

        {/* BOTTOM SECTION: Administration */}
        <div className="mt-auto border-t border-outline-variant pt-3">
          <NavLink to="/administration" onClick={onClose} className={navLinkStyle}>
            <Settings className="h-[18px] w-[18px] shrink-0 text-current" />
            <span>Administration</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-outline-variant lg:block">
        {content}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-outline-variant shadow-[0_8px_24px_rgba(15,23,42,0.2)]">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
