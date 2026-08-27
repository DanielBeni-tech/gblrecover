import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { getClient } from "@/api/client";
import { Avatar } from "@/components/ui/avatar";

const labels: Record<string, string> = {
  "vue-nationale": "Vue nationale",
  "analyse-dette": "Analyse de la dette",
  centres: "Centres",
  agences: "Agences",
  gestionnaires: "Gestionnaires",
  referentiels: "Référentiels",
  administration: "Référentiels",
  dashboard: "Vue nationale",
  clients: "Clients",
  factures: "Factures",
  paiements: "Paiements",
  creances: "Analyse de la dette",
  imports: "Imports",
};

export function Topbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem("gbl-session") ?? "null") as { user: { full_name: string; email: string; role: string; initials: string } } | null);

  const segs = location.pathname.split("/").filter(Boolean);
  const clientId = segs[0] === "clients" && segs[1] ? segs[1] : null;

  // Résolution du nom du client courant via l'API (cache par id).
  const { data: client } = useQuery({
    queryKey: ["client-breadcrumb", clientId],
    queryFn: () => getClient(clientId!),
    enabled: Boolean(clientId),
    staleTime: 60_000,
  });

  const crumbs = useMemo(() => {
    const out: Array<{ label: string; to?: string }> = [];
    if (segs[0] === "clients") {
      out.push({ label: "Clients", to: "/clients" });
      if (segs[1]) {
        out.push({ label: client?.raison_sociale ?? segs[1] });
      }
    } else if (segs[0]) {
      out.push({ label: labels[segs[0]] ?? segs[0] });
    }
    return out;
  }, [location.pathname, client]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/clients?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-outline-variant bg-surface-bright px-4 lg:px-6">
      <button onClick={onMenuOpen} aria-label="Ouvrir le menu" className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* Fil d'Ariane (Breadcrumb) s'il y a un sous-niveau */}
      {crumbs.length > 1 && (
        <nav aria-label="Fil d'Ariane" className="hidden items-center gap-1.5 text-[13px] md:flex shrink-0">
          <Link to={crumbs[0]!.to!} className="text-on-surface-variant hover:text-primary transition-colors">
            {crumbs[0]!.label}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-outline" />
          <span className="truncate font-semibold text-on-surface max-w-[160px]">{crumbs[crumbs.length - 1]!.label}</span>
        </nav>
      )}

      {/* Barre de Recherche Globale élégante & toujours visible */}
      <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center max-w-lg" role="search">
        <div className="relative flex h-9.5 w-full items-center gap-2 rounded-card border border-outline-variant/80 bg-surface-container-low px-3 transition-colors focus-within:border-primary focus-within:bg-surface-bright focus-within:ring-1 focus-within:ring-primary shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-outline" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client, compte, facture, matricule…"
            aria-label="Recherche globale"
            className="w-full bg-transparent text-[13px] text-on-surface outline-none placeholder:text-outline/80"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
              className="rounded p-0.5 text-outline hover:text-on-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center rounded border border-outline-variant/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono text-outline select-none">
              Ctrl K
            </kbd>
          )}
        </div>
      </form>

      {/* Actions utilisateur & Avatar */}
      <div className="flex shrink-0 items-center gap-2 ml-auto">
        <button aria-label="Notifications" className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <button aria-label="Paramètres" className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors">
          <Settings className="h-[18px] w-[18px]" />
        </button>
        <span className="mx-1 hidden h-6 w-px bg-outline-variant sm:block" />
        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar name={session?.user.full_name ?? "Utilisateur"} className="h-8 w-8 border border-primary-fixed-dim" />
          <div className="hidden leading-tight md:block">
            <p className="text-[13px] font-semibold text-on-surface">{session?.user.full_name ?? "Utilisateur"}</p>
            <p className="text-[11px] text-on-surface-variant">{session?.user.email ?? ""}</p>
          </div>
        </div>
        <button
          aria-label="Se déconnecter"
          className="rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors"
          onClick={async () => {
            try {
              localStorage.removeItem("gbl-session");
              setSession(null);
              navigate("/login");
            } catch {
              navigate("/login");
            }
          }}
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
