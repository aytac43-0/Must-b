/**
 * AppLayout — Liquid Glass Shell v1.6.1
 *
 * Visual: Matches the "Xrio"-style reference.
 *   • White floating pill navigation anchored at the top centre.
 *   • Must-b logo text on the far left, dark "System" pill on the far right.
 *   • Sidebar and RightPanel hidden by default — spring-slide in as glass overlays.
 *   • Body carries the soft-white → lime-green → deep-forest gradient via index.css.
 */
import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, ArrowRight, MessageSquare, Cpu } from "lucide-react";
import Sidebar     from "./Sidebar";
import RightPanel  from "./RightPanel";
import LanguageSwitcher from "./LanguageSwitcher";
import { WakeWordListener } from "@/components/chat/WakeWordListener";
import { useI18n } from "@/i18n";

function NavItem({ to, label, active }: { to: string; label: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all select-none ${
        active
          ? "bg-black text-white shadow-sm"
          : "text-black/70 hover:text-black hover:bg-black/6"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AppLayout() {
  const { t }    = useI18n();
  const location = useLocation();
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const isSettings = location.pathname === "/app/settings";

  const handleWake = () => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">

      {/* ── Left panel overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {leftOpen && (
          <motion.div
            key="left-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setLeftOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {leftOpen && (
          <motion.div
            key="left-panel"
            initial={{ x: "-100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed left-0 top-0 z-50 h-screen"
          >
            <Sidebar onClose={() => setLeftOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right panel overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            key="right-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setRightOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            key="right-panel"
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed right-0 top-0 z-50 h-screen"
          >
            <RightPanel onClose={() => setRightOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating pill navigation ──────────────────────────────────── */}
      <header className="fixed top-4 left-0 right-0 z-30 px-6 flex items-center justify-between pointer-events-none">

        {/* Left — logo + chats toggle */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setLeftOpen(true)}
            className="flex items-center gap-2 select-none"
            title={t.layout.openChats}
          >
            <span className="text-[22px] font-black text-[#0c1a07] tracking-tighter drop-shadow-sm">
              Must-b
            </span>
          </button>
          <button
            onClick={() => setLeftOpen(true)}
            className="p-2 rounded-full bg-white/70 hover:bg-white shadow-sm border border-white/50 text-[#0c1a07] transition-all"
            title={t.layout.openChats}
          >
            <MessageSquare size={15} />
          </button>
        </div>

        {/* Centre — white pill nav */}
        <nav className="pointer-events-auto nav-pill px-2 py-1.5 flex items-center gap-0.5">
          <NavItem to="/app"          label="Chat"      active={!isSettings} />
          <NavItem to="/app/settings" label="Settings"  active={isSettings}  />
          <div className="w-px h-4 bg-black/10 mx-1" />
          <WakeWordListener onWake={handleWake} />
          <LanguageSwitcher />
        </nav>

        {/* Right — system panel pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setRightOpen(true)}
            title={t.layout.openSystem}
            className="flex items-center gap-2 bg-[#0c1a07] hover:bg-[#1a3010] text-white/90 rounded-full px-4 py-2 text-[13px] font-semibold shadow-lg transition-all"
          >
            <Cpu size={13} />
            {t.layout.system}
            <ArrowRight size={12} className="opacity-60" />
          </button>
        </div>
      </header>

      {/* ── Page content (padded below fixed nav) ─────────────────────── */}
      <main className="relative min-h-screen pt-[72px]">
        <Outlet />
      </main>
    </div>
  );
}
