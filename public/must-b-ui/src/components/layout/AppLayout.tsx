/**
 * AppLayout — Liquid Glass Shell (v1.6.0)
 *
 * Both Sidebar and RightPanel are hidden by default.
 * They slide in as glass overlays via Framer Motion AnimatePresence.
 * The centre stage is always full-width, dominated by the chat.
 */
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import LanguageSwitcher from "./LanguageSwitcher";
import { WakeWordListener } from "@/components/chat/WakeWordListener";
import { useI18n } from "@/i18n";

export default function AppLayout() {
  const { t } = useI18n();
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const handleWake = () => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden font-sans text-white">

      {/* ── Deep gradient background ───────────────────────────────────── */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#020407] via-[#04060e] to-[#020508] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(234,88,12,0.10),transparent)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_110%,rgba(30,20,60,0.25),transparent)] pointer-events-none" />

      {/* ── Left panel overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {leftOpen && (
          <motion.div
            key="left-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
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

      {/* ── Centre stage (full width) ─────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col h-screen overflow-hidden min-w-0">

        {/* Top bar — glass strip */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2 shrink-0 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">

          {/* Left: chats toggle */}
          <button
            onClick={() => setLeftOpen(true)}
            title={t.layout.openChats}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-white/8 text-gray-400 hover:text-orange-400 hover:border-orange-500/25 transition-all text-xs font-medium"
          >
            <PanelLeftOpen size={14} />
            <span className="hidden sm:inline">{t.layout.chats}</span>
          </button>

          {/* Centre: logo + wordmark */}
          <div className="flex items-center gap-2 select-none">
            <div className="relative w-6 h-6">
              <div className="absolute inset-0 bg-orange-500 rounded-full blur-[6px] opacity-50" />
              <img src="/logo.png" alt="Must-b" className="relative z-10 w-full h-full object-contain" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white/80">Must-b</span>
          </div>

          {/* Right: wake word + language + system panel */}
          <div className="flex items-center gap-2">
            <WakeWordListener onWake={handleWake} />
            <LanguageSwitcher />
            <button
              onClick={() => setRightOpen(true)}
              title={t.layout.openSystem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-white/8 text-gray-400 hover:text-orange-400 hover:border-orange-500/25 transition-all text-xs font-medium"
            >
              <span className="hidden sm:inline">{t.layout.system}</span>
              <PanelRightOpen size={14} />
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="relative flex-1 overflow-hidden min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
