import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Revenir en haut de la zone de contenu à chaque navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-full">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex h-full min-w-0 flex-1 flex-col lg:pl-[260px]">
        <Topbar onMenuOpen={() => setMenuOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
