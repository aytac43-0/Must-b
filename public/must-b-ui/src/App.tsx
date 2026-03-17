import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import WelcomePage from "@/pages/WelcomePage";
import SetupPage from "@/pages/SetupPage";
import DashboardPage from "@/pages/DashboardPage";
import AutomationsPage from "@/pages/AutomationsPage";
import ActivePage from "@/pages/ActivePage";
import ProductsPage from "@/pages/ProductsPage";
import ClientsPage from "@/pages/ClientsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import LogsPage from "@/pages/LogsPage";
import SettingsPage from "@/pages/SettingsPage";
import AppLayout from "@/components/layout/AppLayout";
import ConflictModal from "@/components/ConflictModal";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" theme="dark" closeButton richColors />
      {/* Global: conflict resolution modal — listens for CONFLICT_DETECTED via Socket.IO */}
      <ConflictModal />
      <Routes>
        {/* Welcome / Gate screen (checks setup status, redirects to /setup if needed) */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* First-time setup wizard */}
        <Route path="/setup" element={<SetupPage />} />

        {/* App dashboard */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="active" element={<ActivePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
