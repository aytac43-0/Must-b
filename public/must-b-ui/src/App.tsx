import { Component, type ReactNode, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import WelcomePage    from "@/pages/WelcomePage";

// ── Global Error Boundary — prevents white screens from uncaught render errors
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center gap-4 text-center px-6">
          <span className="text-3xl">⚠️</span>
          <p className="text-orange-400 font-bold text-sm">Something went wrong</p>
          <p className="text-gray-600 text-xs font-mono max-w-sm break-all">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import SetupPage      from "@/pages/SetupPage";
import DashboardPage  from "@/pages/DashboardPage";
import SettingsPage   from "@/pages/SettingsPage";
import MobilePage       from "@/pages/MobilePage";
import AppLayout        from "@/components/layout/AppLayout";
import ConflictModal    from "@/components/ConflictModal";
import { I18nProvider } from "@/i18n";

// ── Setup Guard ───────────────────────────────────────────────────────────────
// Phase 2: Universal Onboarding Fork.
// Wraps the War Room (/app) — if setupComplete === false, redirects to the
// Visual Setup Wizard (/setup) before allowing entry.
// setupComplete === true → renders the War Room (sleeping/wake aesthetic).
function SetupGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup/status")
      .then(r => r.ok ? r.json() : { configured: true })
      .then((data: { configured?: boolean }) => {
        if (cancelled) return;
        if (!data.configured) {
          navigate("/setup", { replace: true });
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // Gateway not reachable yet — allow through to avoid a blank screen.
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  // Show nothing while the status check is in-flight (prevents flash of war-room).
  if (!ready) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <I18nProvider>
      <BrowserRouter>
        <Toaster position="top-right" theme="dark" closeButton richColors />
        {/* Global conflict resolution modal — listens for CONFLICT_DETECTED via Socket.IO */}
        <ConflictModal />
        <Routes>
          {/*
           * Phase 2 routing fork:
           *   setupComplete === false → Visual Setup Wizard (/setup)
           *   setupComplete === true  → War Room dashboard (Sleeping / Wake aesthetic)
           *
           * WelcomePage already performs the setup check and redirects to /setup
           * if not configured.  SetupGuard adds a second safety layer on /app so
           * that direct navigation (e.g. bookmark, back button) also gets caught.
           */}

          {/* War Room entry point — sleeping / wake Must-b aesthetic */}
          <Route path="/"        element={<WelcomePage />} />
          <Route path="/welcome" element={<WelcomePage />} />

          {/* Visual Setup Wizard — rendered when setupComplete === false */}
          <Route path="/setup" element={<SetupPage />} />

          {/* War Room dashboard — guarded: only accessible after setup is complete */}
          <Route path="/app" element={
            <SetupGuard>
              <AppLayout />
            </SetupGuard>
          }>
            <Route index        element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*"        element={<Navigate to="/app" replace />} />
          </Route>

          {/* Mobile Companion — standalone page, no AppLayout */}
          <Route path="/mobile" element={<MobilePage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
    </ErrorBoundary>
  );
}
