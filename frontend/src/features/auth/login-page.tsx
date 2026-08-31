import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { clearStoredSession, getStoredSession, login, setStoredSession } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";

export function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredSession()) navigate("/vue-nationale", { replace: true });
  }, [navigate]);

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
      navigate("/vue-nationale", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full bg-background">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loading label="Connexion" />
        </div>
      )}

      <div className="relative hidden w-[46%] overflow-hidden lg:block">
        <img
          src="/illustrations/login-gblrecover.png"
          alt="Agent CAMTEL consultant un dossier de recouvrement."
          width={1200}
          height={1600}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 via-brand-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-on-primary">
          <p className="text-[28px] font-bold leading-8 tracking-[-0.02em]">
            Voir juste.
            <br />
            Comprendre vite.
            <br />
            Agir.
          </p>
          <p className="mt-3 max-w-sm text-[14px] leading-6 text-brand-100">
            Retrouvez un client, lisez sa dette, décidez de la prochaine relance.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex items-center gap-2.5 text-primary">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-5 w-5 text-on-primary" />
            </span>
            <span className="leading-tight">
              <span className="block text-[16px] font-bold text-on-surface">GBLRecover</span>
              <span className="block text-[11px] text-on-surface-variant">Retour à l’accueil</span>
            </span>
          </Link>

          <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-on-surface">Connexion</h1>
          <p className="mt-1 text-[14px] text-on-surface-variant">Accédez à l’espace de recouvrement CAMTEL.</p>

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

            <Button type="submit" variant="copper" disabled={loading || !identifier || !password} className="w-full" size="lg">
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
