import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { clearStoredSession, getStoredSession, login, setStoredSession } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TeamSection } from "./team-section";

const bullets = [
  "Vue client 360° — comptes, factures, paiements, créances",
  "Recherche globale et priorisation des dossiers",
  "Import Excel contrôlé avec rapport de rejets",
  "Habilitations par rôle et périmètre, traçabilité",
];

export function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si une session existe déjà, on redirige vers le dashboard
  useEffect(() => {
    if (getStoredSession()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  // Si le backend nous déconnecte (401 intercepté par apiRequest), on revient à /login
  useEffect(() => {
    const handler = () => {
      clearStoredSession();
      navigate("/login", { replace: true });
    };
    window.addEventListener("gbl:session-expired", handler);
    return () => window.removeEventListener("gbl:session-expired", handler);
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await login(identifier, password);
      // On normalise la forme de la session : si le backend ne renvoie pas l'objet user
      // (cas de /auth/refresh par ex.), on conserve un user minimal pour l'UI.
      const storedUser = session.user ?? {
        id: "00000000-0000-0000-0000-000000000001",
        email: identifier,
        full_name: identifier,
        status: "ACTIVE",
      };
      setStoredSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        user: {
          id: storedUser.id,
          email: storedUser.email,
          full_name: storedUser.full_name,
          status: storedUser.status,
        },
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Panneau Équipe CAMTEL */}
      <div className="hidden w-[44%] flex-col justify-center bg-primary p-10 text-on-primary lg:flex overflow-hidden relative">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        <div className="relative z-10">
          <TeamSection />
        </div>
        <div className="relative z-10 max-w-md mt-auto pt-10">
          <h2 className="text-[24px] font-bold leading-[30px] tracking-[-0.02em]">
            Voir juste.
            <br />
            Comprendre vite.
            <br />
            Agir avec confiance.
          </h2>
          <p className="mt-3 text-[14px] text-on-primary-container">
            La source de vérité opérationnelle de CAMTEL pour piloter la dette client et le recouvrement.
          </p>
          <ul className="mt-6 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[13px]">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-container" />
                {b}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-on-primary-container mt-8">© 2026 CAMTEL — Accès réservé aux équipes autorisées</p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-6 w-6 text-on-on-primary" />
            </div>
            <h1 className="text-[24px] font-semibold text-on-surface">GBLRecover</h1>
            <p className="text-[13px] text-on-surface-variant">Plateforme de Revenue Assurance — CAMTEL</p>
          </div>
          <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-on-surface">Connexion</h2>
          <p className="mt-1 text-[14px] text-on-surface-variant">Accédez à votre espace de recouvrement.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <Label htmlFor="identifier">Identifiant ou e-mail</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="agent@camtel.cm"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-card border border-error/30 bg-error-container px-3 py-2.5 text-[13px] text-on-error-container">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || !identifier || !password} className="w-full" size="lg">
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <p className="mt-5 flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <ShieldCheck className="h-3.5 w-3.5" />
            Session sécurisée — accès réservé aux équipes habilitées.
          </p>
        </div>
      </div>
    </div>
  );
}
