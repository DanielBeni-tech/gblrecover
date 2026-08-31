import { Link } from "react-router-dom";
import { Activity, ArrowRight, Eye, Lightbulb, MousePointerClick } from "lucide-react";
import { getStoredSession } from "@/api/client";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const TEAM = [
  {
    name: "Daniel Beni Mpodol Welisan",
    role: "Fullstack JS, frontend, responsable UI/UX",
    photo: "/team/team-daniel.png",
  },
  {
    name: "Nkoumou Tsade Nikaise Germain",
    role: "Fullstack Python, backend, responsable des API",
    photo: "/team/team-nkoumou.png",
  },
  {
    name: "Evijo Evina",
    role: "Backend Python, logique métier et base de données",
    photo: "/team/team-evijo.png",
  },
  {
    name: "Kegne Ange",
    role: "Architecture globale de la base de données",
    photo: "/team/team-kegne.png",
  },
  {
    name: "Soudjonk Divine",
    role: "Recette, documentation utilisateur et qualité des parcours",
    photo: "/team/team-soudjonk.png",
  },
  {
    name: "Balawe Chips",
    role: "DevOps, Docker et mise en production",
    photo: "/team/team-balawe.png",
  },
] as const;

const PILLARS = [
  {
    icon: Eye,
    title: "Voir juste",
    body: "Un encours, une balance, un client — les chiffres du Excel GBL, sans double comptage.",
  },
  {
    icon: Lightbulb,
    title: "Comprendre vite",
    body: "Filtres centre, agence et mois. Aging, Top 20, fiche 360°. La dette se lit en une passe.",
  },
  {
    icon: MousePointerClick,
    title: "Agir",
    body: "Ouvrir un dossier, relancer une facture, importer le prochain fichier. La prochaine action est visible.",
  },
] as const;

export function HomePage() {
  const signedIn = Boolean(getStoredSession());
  const ctaTo = signedIn ? "/vue-nationale" : "/login";
  const ctaLabel = signedIn ? "Ouvrir l’espace" : "Se connecter";

  return (
    <div className="min-h-full bg-background text-on-background">
      <header className="sticky top-0 z-30 border-b border-outline-variant/80 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-[18px] w-[18px] text-on-primary" />
            </span>
            <span className="leading-tight">
              <span className="block text-[16px] font-bold tracking-tight">GBLRecover</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                CAMTEL
              </span>
            </span>
          </Link>
          <Link to={ctaTo} className={buttonVariants({ variant: "copper", size: "md" })}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <div>
            <h1 className="max-w-[18ch] text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-on-surface md:text-[52px]">
              Voir juste. Comprendre vite. Agir.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-7 text-on-surface-variant">
              GBLRecover centralise factures, paiements et créances CAMTEL. Un espace unique pour
              retrouver un client, lire sa dette et décider de la prochaine relance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={ctaTo} className={buttonVariants({ variant: "copper", size: "lg" })}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!signedIn && (
                <p className="text-[13px] text-on-surface-variant">Accès réservé aux équipes habilitées.</p>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-panel border border-outline-variant shadow-popover">
            <img
              src="/illustrations/hero-gblrecover.png"
              alt="Tableau de recouvrement CAMTEL : dossiers, montants et carte du réseau."
              width={1600}
              height={900}
              className="aspect-video w-full object-cover"
            />
          </div>
        </section>

        <section className="border-y border-outline-variant bg-surface-container-lowest">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 md:gap-10 md:py-14">
            {PILLARS.map((pillar) => (
              <div key={pillar.title}>
                <pillar.icon className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-on-surface">{pillar.title}</h2>
                <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">{pillar.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-on-surface">L’équipe</h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-on-surface-variant">
            Six personnes construisent et maintiennent la plateforme : produit, données, recette et exploitation.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="overflow-hidden rounded-panel border border-outline-variant bg-surface-container-lowest shadow-card"
              >
                <img
                  src={member.photo}
                  alt={`Portrait de ${member.name}`}
                  width={800}
                  height={800}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="text-[15px] font-semibold leading-snug text-on-surface">{member.name}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">{member.role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Separator />
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[12px] text-on-surface-variant sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© 2026 CAMTEL — GBLRecover, Revenue Assurance</p>
        <Link to={ctaTo} className="font-medium text-primary hover:underline">
          {ctaLabel}
        </Link>
      </footer>
    </div>
  );
}
