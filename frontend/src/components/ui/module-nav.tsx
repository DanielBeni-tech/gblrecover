import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface ModuleNavItem {
  /** Numéro affiché dans le pastille circulaire. */
  number: number;
  label: string;
  to: string;
}

/** Ordre du parcours métier officiel : Client → Facture → Paiement. */
export const MODULE_NAV_ITEMS: ModuleNavItem[] = [
  { number: 1, label: "Clients", to: "/clients" },
  { number: 2, label: "Factures", to: "/factures" },
  { number: 3, label: "Paiements", to: "/paiements" },
];

/**
 * Navigation numérotée partagée par les modules Clients · Factures · Paiements.
 *
 * Entièrement dynamique : l'état actif est déduit de la route courante
 * (react-router). Au clic — ou après toute navigation — le numéro du module
 * visité « se manifeste » (cercle rempli, zoom, anneau, libellé en gras)
 * pour indiquer où l'utilisateur se trouve dans le parcours.
 */
export function ModuleNav({ items = MODULE_NAV_ITEMS }: { items?: ModuleNavItem[] }) {
  return (
    <nav
      aria-label="Parcours métier : Clients, Factures, Paiements"
      className="flex w-fit max-w-full items-center overflow-x-auto rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-1.5 shadow-card"
    >
      {items.map((item, i) => (
        <span key={item.to} className="flex items-center">
          {i > 0 && <span aria-hidden className="h-[2px] w-5 shrink-0 rounded-full bg-outline-variant sm:w-9" />}
          <NavLink
            to={item.to}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2 rounded-full p-1 pr-1 transition-colors duration-300 sm:pr-3",
                isActive ? "bg-primary-fixed-dim/40" : "hover:bg-surface-container-low",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "t-tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                    isActive
                      ? "scale-110 bg-primary text-on-primary shadow-popover ring-4 ring-primary-fixed-dim"
                      : "bg-surface-container-high text-on-surface-variant group-hover:bg-secondary-fixed group-hover:text-on-secondary-fixed",
                  )}
                >
                  {item.number}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[13px] transition-colors duration-300",
                    isActive ? "font-bold text-primary" : "hidden font-medium text-on-surface-variant sm:block",
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        </span>
      ))}
    </nav>
  );
}
