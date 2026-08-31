import { Link, NavLink } from "react-router-dom";
import {
  Activity,
  Building2,
  Contact,
  CreditCard,
  FolderTree,
  Globe,
  Home,
  Landmark,
  PieChart,
  Receipt,
  Upload,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const groups = [
  {
    label: "Pilotage",
    items: [
      { to: "/vue-nationale", label: "Voir le national", icon: Globe },
      { to: "/analyse-dette", label: "Analyser la dette", icon: PieChart },
    ],
  },
  {
    label: "Performance",
    items: [
      { to: "/centres", label: "Comparer les centres", icon: Building2 },
      { to: "/agences", label: "Comparer les agences", icon: Landmark },
      { to: "/gestionnaires", label: "Comparer les gestionnaires", icon: Users },
    ],
  },
  {
    label: "Dossiers",
    items: [
      { to: "/clients", label: "Ouvrir un client", icon: Contact },
      { to: "/factures", label: "Lire les factures", icon: Receipt },
      { to: "/paiements", label: "Suivre les paiements", icon: CreditCard },
      { to: "/imports", label: "Importer Excel", icon: Upload },
    ],
  },
  {
    label: "Référentiels",
    items: [{ to: "/referentiels", label: "Explorer la structure", icon: FolderTree }],
  },
] as const;

export function Sidebar({ open, onClose }: SidebarProps) {
  const activeClass = "border-r-[3px] border-primary bg-brand-50 font-semibold text-primary shadow-sm";
  const inactiveClass = "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium";

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-l-md px-3.5 py-2.5 text-[13.5px] leading-5 transition-all duration-150",
      isActive ? activeClass : inactiveClass,
    );

  const content = (
    <div className="flex h-full flex-col bg-surface py-4">
      <div className="mb-5 flex items-center gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-on-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-bold leading-6 tracking-tight text-primary">GBLRecover</h1>
          <p className="t-label text-[10px] tracking-wider text-on-surface-variant">Revenue Assurance</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer le menu"
          className="ml-auto rounded p-1 text-on-surface-variant hover:bg-surface-container-high lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3" aria-label="Navigation principale">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-3.5 pb-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{group.label}</div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onClose} className={navLinkStyle}>
                  <item.icon className="h-[18px] w-[18px] shrink-0 text-current" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-5 pt-2">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 text-[12px] text-on-surface-variant hover:text-primary"
        >
          <Home className="h-3.5 w-3.5" />
          Présentation publique
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-outline-variant lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-outline-variant shadow-popover">{content}</aside>
        </div>
      )}
    </>
  );
}
