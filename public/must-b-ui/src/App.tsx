import { Component, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

export default function App() {
  return (
    <ErrorBoundary>
    <I18nProvider>
      <BrowserRouter>
        <Toaster position="top-right" theme="dark" closeButton richColors />
        {/* Global conflict resolution modal — listens for CONFLICT_DETECTED via Socket.IO */}
        <ConflictModal />
        <Routes>
          {/* Welcome / gate screen (checks setup status, redirects to /setup if needed) */}
          <Route path="/"       element={<WelcomePage />} />
          <Route path="/welcome" element={<WelcomePage />} />

          {/* First-time setup wizard */}
          <Route path="/setup" element={<SetupPage />} />

          {/* App dashboard — three-column war-room layout */}
          <Route path="/app" element={<AppLayout />}>
            <Route index           element={<DashboardPage />} />
            <Route path="settings"    element={<SettingsPage />} />
            <Route path="*"           element={<Navigate to="/app" replace />} />
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
