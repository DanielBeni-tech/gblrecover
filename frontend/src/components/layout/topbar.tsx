import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, LogOut, Menu, Search, Settings } from "lucide-react";
import { customers } from "@/data/mock-data";
import { Avatar } from "@/components/ui/avatar";

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  factures: "Factures",
  paiements: "Paiements",
  creances: "Créances",
  imports: "Imports",
  administration: "Administration",
};

export function Topbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem("gbl-session") ?? "null") as { user: { name: string; role: string; initials: string } } | null);

  const crumbs = useMemo(() => {
    const segs = location.pathname.split("/").filter(Boolean);
    const out: Array<{ label: string; to?: string }> = [];
    if (segs[0] === "clients") {
      out.push({ label: "Clients", to: "/clients" });
      if (segs[1]) {
        const c = customers.find((x) => x.id === segs[1]);
        out.push({ label: c ? c.name : segs[1] });
      }
    } else if (segs[0]) {
      out.push({ label: labels[segs[0]] ?? segs[0] });
    }
    return out;
  }, [location.pathname]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/clients?q=${encodeURIComponent(q)}` : "/clients");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline-variant bg-surface-bright px-4 lg:px-6">
      <button onClick={onMenuOpen} aria-label="Ouvrir le menu" className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb / recherche globale */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {crumbs.length > 1 ? (
          <>
            <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-[14px]">
              <Link to={crumbs[0]!.to!} className="text-on-surface-variant hover:text-primary">
                {crumbs[0]!.label}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-outline" />
              <span className="truncate font-semibold text-on-surface">{crumbs[crumbs.length - 1]!.label}</span>
            </nav>
            <button onClick={() => setSearchOpen((s) => !s)} aria-label="Rechercher" className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary sm:hidden">
              <Search className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setSearchOpen((s) => !s)} aria-label="Rechercher" className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary sm:hidden">
              <Search className="h-4 w-4" />
            </button>
            <form onSubmit={submitSearch} className={`${searchOpen ? "flex" : "hidden"} w-full max-w-md sm:flex`} role="search">
              <div className="flex h-9 items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low px-3 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Search className="h-4 w-4 shrink-0 text-outline" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Recherche rapide globale…"
                  aria-label="Recherche globale"
                  className="w-full bg-transparent text-[14px] text-on-surface outline-none placeholder:text-outline"
                />
              </div>
            </form>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button aria-label="Notifications" className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <button aria-label="Paramètres" className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
          <Settings className="h-[18px] w-[18px]" />
        </button>
        <span className="mx-1 hidden h-6 w-px bg-outline-variant sm:block" />
        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar name={session?.user.name ?? "Utilisateur"} className="h-8 w-8 border border-primary-fixed-dim" />
          <div className="hidden leading-tight md:block">
            <p className="text-[13px] font-semibold text-on-surface">{session?.user.name}</p>
            <p className="text-[11px] text-on-surface-variant">{session?.user.role}</p>
          </div>
        </div>
        <button
          aria-label="Se déconnecter"
          className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          onClick={() => {
            localStorage.removeItem("gbl-session");
            setSession(null);
            navigate("/login");
          }}
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
