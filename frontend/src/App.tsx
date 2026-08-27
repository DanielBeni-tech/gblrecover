import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { ReceivablesPage } from "@/features/receivables/receivables-page";
import { CentresPage } from "@/features/performance/centres-page";
import { AgencesPage } from "@/features/performance/agences-page";
import { GestionnairesPage } from "@/features/performance/gestionnaires-page";
import { ReferentielsPage } from "@/features/referentiels/referentiels-page";
import { ClientsPage } from "@/features/customers/clients-page";
import { CustomerDetailPage } from "@/features/customers/customer-detail-page";
import { InvoicesPage } from "@/features/invoices/invoices-page";
import { PaymentsPage } from "@/features/payments/payments-page";
import { ImportsPage } from "@/features/imports/imports-page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } },
});

function hasSession(): boolean {
  return Boolean(localStorage.getItem("gbl-session"));
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            {/* Redirections et routes principales de la navigation */}
            <Route path="/" element={<Navigate to="/vue-nationale" replace />} />
            <Route path="/vue-nationale" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/vue-nationale" replace />} />

            <Route path="/analyse-dette" element={<ReceivablesPage />} />
            <Route path="/creances" element={<Navigate to="/analyse-dette" replace />} />

            <Route path="/centres" element={<CentresPage />} />
            <Route path="/agences" element={<AgencesPage />} />
            <Route path="/gestionnaires" element={<GestionnairesPage />} />

            <Route path="/referentiels" element={<ReferentielsPage />} />
            <Route path="/administration" element={<Navigate to="/referentiels" replace />} />

            {/* Vues complémentaires */}
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<CustomerDetailPage />} />
            <Route path="/factures" element={<InvoicesPage />} />
            <Route path="/paiements" element={<PaymentsPage />} />
            <Route path="/imports" element={<ImportsPage />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="t-tabular text-[48px] font-bold text-primary">404</p>
      <h1 className="mt-2 text-[20px] font-semibold text-on-surface">Page introuvable</h1>
      <p className="mt-1 text-[14px] text-on-surface-variant">La page demandée n'existe pas ou vous n'y avez pas accès.</p>
    </div>
  );
}
