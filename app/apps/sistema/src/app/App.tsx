import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AppHeader,
  BottomNav,
  ConnectionPill,
  ErrorBoundary,
  LivingLinesBackground,
  ThemeToggle,
  Toaster,
  type BottomNavItem,
} from "@biodinamica/ui";
import { LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "../features/auth/useAuth";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireAccess } from "../features/auth/RequireAccess";
import { navFor, defaultPathFor } from "../features/auth/navigation";
import { LiveDataProvider, useLiveData } from "../features/live-data/useLiveData";
import { CameraScanProvider } from "../features/camera/useCameraScan";
import { AnnouncementComposer } from "../features/announcements/AnnouncementComposer";
import { AnnouncementPopup } from "../features/announcements/AnnouncementPopup";

const CheckinPage = lazy(() => import("../features/checkin/CheckinPage").then((m) => ({ default: m.CheckinPage })));
const AgendaPage = lazy(() => import("../features/agenda/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const PainelPage = lazy(() => import("../features/painel/PainelPage").then((m) => ({ default: m.PainelPage })));
const InscritosPage = lazy(() =>
  import("../features/inscritos/InscritosPage").then((m) => ({ default: m.InscritosPage }))
);
const VendaPage = lazy(() => import("../features/comercial/VendaPage").then((m) => ({ default: m.VendaPage })));
const CaixaEstoquePage = lazy(() =>
  import("../features/comercial/CaixaEstoquePage").then((m) => ({ default: m.CaixaEstoquePage }))
);
const ProdutosPage = lazy(() =>
  import("../features/comercial/ProdutosPage").then((m) => ({ default: m.ProdutosPage }))
);
const EstoqueControlePage = lazy(() =>
  import("../features/comercial/EstoqueControlePage").then((m) => ({ default: m.EstoqueControlePage }))
);
const HistoricoPage = lazy(() =>
  import("../features/comercial/HistoricoPage").then((m) => ({ default: m.HistoricoPage }))
);
const CadastrosPage = lazy(() =>
  import("../features/cadastro/CadastrosPage").then((m) => ({ default: m.CadastrosPage }))
);
const AlmocoPage = lazy(() => import("../features/almoco/AlmocoPage").then((m) => ({ default: m.AlmocoPage })));
const SelfAlmocoPage = lazy(() =>
  import("../features/almoco/SelfAlmocoPage").then((m) => ({ default: m.SelfAlmocoPage }))
);

function roleLabel(department: "tecnica" | "comercial" | "caixa" | "cadastro", level: "staff" | "admin") {
  if (department === "tecnica") return level === "admin" ? "Administrador · Consultoria Técnica" : "Consultoria Técnica";
  if (department === "caixa") return "Caixa";
  if (department === "cadastro") return "Cadastro";
  return level === "admin" ? "Administrador · Comercial" : "Comercial";
}

function UserBadge() {
  const { profile, logout } = useAuth();
  if (!profile) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="text-right leading-tight">
        <div className="text-[0.78rem] font-bold text-white">{profile.name}</div>
        <div className="text-[0.62rem] font-semibold uppercase tracking-wide text-white/60">
          {profile.staff_id != null ? "Equipe" : roleLabel(profile.department, profile.level)}
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Sair"
        title="Sair"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
      >
        <LogOut className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}

function Shell() {
  const { profile } = useAuth();
  const { connected } = useLiveData();
  const location = useLocation();
  const navigate = useNavigate();

  if (!profile) return null;

  const items: BottomNavItem[] = navFor(profile).map((n) => ({
    key: n.path,
    label: n.label,
    icon: n.icon,
    active: location.pathname === n.path,
    onClick: () => navigate(n.path),
  }));

  return (
    <div className="noir-bg relative min-h-screen">
      <LivingLinesBackground fixed />

      <div className="relative mx-auto max-w-3xl px-4 pb-28 sm:px-6">
        <AppHeader
          transparent
          eyebrow="Sistema ao vivo · CIOSP 2027"
          title="Estande Biodinâmica"
          right={
            <div className="flex items-center gap-2.5">
              <ConnectionPill ok={connected} />
              <ThemeToggle />
              <UserBadge />
            </div>
          }
        />

        <div className="pt-4">
        {/* key={pathname} — se uma tela quebrar, trocar de aba remonta a
            boundary do zero (limpa o erro) em vez de exigir F5. */}
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<div className="py-10 text-center text-sm text-white/60">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to={defaultPathFor(profile)} replace />} />
            <Route
              path="/check-in"
              element={
                <RequireAccess department="tecnica">
                  <CheckinPage />
                </RequireAccess>
              }
            />
            <Route
              path="/agenda"
              element={
                <RequireAccess department="tecnica" adminOnly>
                  <AgendaPage />
                </RequireAccess>
              }
            />
            <Route
              path="/inscritos"
              element={
                <RequireAccess department="tecnica">
                  <InscritosPage />
                </RequireAccess>
              }
            />
            <Route
              path="/painel"
              element={
                <RequireAccess department="tecnica" adminOnly>
                  <PainelPage />
                </RequireAccess>
              }
            />
            <Route
              path="/comercial/venda"
              element={
                <RequireAccess department="comercial">
                  <VendaPage />
                </RequireAccess>
              }
            />
            <Route
              path="/comercial/historico"
              element={
                <RequireAccess department="comercial">
                  <HistoricoPage />
                </RequireAccess>
              }
            />
            <Route
              path="/comercial/produtos"
              element={
                <RequireAccess department="comercial" adminOnly>
                  <ProdutosPage />
                </RequireAccess>
              }
            />
            <Route
              path="/caixa"
              element={
                <RequireAccess department="caixa">
                  <CaixaEstoquePage />
                </RequireAccess>
              }
            />
            <Route
              path="/caixa/estoque"
              element={
                <RequireAccess department="caixa">
                  <EstoqueControlePage />
                </RequireAccess>
              }
            />
            <Route
              path="/caixa/historico"
              element={
                <RequireAccess department="caixa">
                  <HistoricoPage itemsVariant="detailed" />
                </RequireAccess>
              }
            />
            <Route
              path="/cadastro"
              element={
                <RequireAccess department="cadastro">
                  <CadastrosPage />
                </RequireAccess>
              }
            />
            <Route
              path="/almoco"
              element={
                <RequireAccess department={["comercial", "tecnica"]} adminOnly>
                  <AlmocoPage />
                </RequireAccess>
              }
            />
            <Route
              path="/meu-almoco"
              element={
                <RequireAccess requireStaffLink>
                  <SelfAlmocoPage />
                </RequireAccess>
              }
            />
            <Route path="*" element={<Navigate to={defaultPathFor(profile)} replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>

        <p className="mt-8 border-t border-white/15 pt-4 text-[0.72rem] text-white/45">
          Sistema em operação — os dados registrados aqui já valem como registro real do dia. 27–30/01/2027 · 44º
          CIOSP · Expo Center Norte, SP.
        </p>
        </div>
      </div>

      <BottomNav items={items} />
      {profile.level === "admin" && <AnnouncementComposer />}
      {profile.level === "staff" && <AnnouncementPopup />}
      <Toaster />
    </div>
  );
}

function Gate() {
  const { status, logout } = useAuth();

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Carregando...</div>;
  }
  if (status === "reconnecting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-linen px-6 text-center">
        <div className="live-dot" />
        <p className="text-sm text-ink-soft">Conexão instável — tentando de novo...</p>
      </div>
    );
  }
  if (status === "anon") {
    return <LoginPage />;
  }
  if (status === "profile-error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-linen px-6 text-center">
        <p className="max-w-[320px] text-sm text-ink-soft">
          Sua conta existe mas não tem um perfil vinculado (nome/departamento/cargo). Confira se a migração
          <code className="mx-1 rounded bg-sage-tint px-1.5 py-0.5 text-xs text-moss-deep">
            supabase-migration-auth-profiles.sql
          </code>
          foi executada.
        </p>
        <button type="button" onClick={logout} className="text-sm font-bold text-moss underline">
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <LiveDataProvider>
      <CameraScanProvider>
        <Shell />
      </CameraScanProvider>
    </LiveDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
