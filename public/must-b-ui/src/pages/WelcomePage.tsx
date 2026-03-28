/**
 * WelcomePage — v1.10.0 "Sleeping Fox"
 *
 * Phase 1 — Sleeping: sleep.png fills the screen, dark overlay,
 *   centered "UYANDIR" button with breathing animation.
 *
 * Phase 2 — Wake transition: sleep.png blurs and fades out,
 *   dark hero (orange/black palette) fades in.
 *
 * Phase 3 — Awake: Full hero layout matching dashboard new.jpeg
 *   but with Must-b orange-black palette. Glass input at bottom.
 *
 * Navigasyon: UYANDIR → setup check → /app
 */

import { useState, useEffect } from "react";
import { useNavigate, Link }   from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, ArrowRight, Moon }    from "lucide-react";
import { useI18n }              from "@/i18n";

type Phase = "sleeping" | "waking" | "awake" | "exiting";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { t }    = useI18n();
  const [phase, setPhase] = useState<Phase>("sleeping");

  // Check setup status on mount
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res  = await fetch("/api/setup/status");
        if (!res.ok || cancelled) return;
        const data = await res.json() as { configured?: boolean };
        if (!cancelled && !data.configured) navigate("/setup");
      } catch { /* gateway not ready yet */ }
    };
    const timer = setTimeout(check, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [navigate]);

  const handleWake = () => {
    if (phase !== "sleeping") return;
    setPhase("waking");
    setTimeout(() => setPhase("awake"), 700);
  };

  const handleNavigate = async () => {
    if (phase !== "awake") return;
    setPhase("exiting");

    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
        const data = await res.json() as { configured?: boolean };
        if (!data.configured) { navigate("/setup"); return; }
      }
      await fetch("/api/auth/local").catch(() => {});
    } catch { /* continue */ }

    setTimeout(() => navigate("/app"), 500);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">

      {/* ═══════════════════════════════════════════════════════════
          PHASE 1 — SLEEPING: sleep.png full-screen
          ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(phase === "sleeping" || phase === "waking") && (
          <motion.div
            key="sleep-screen"
            className="fixed inset-0 z-40 flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{
              opacity: phase === "waking" ? 0 : 1,
              filter: phase === "waking" ? "blur(24px)" : "blur(0px)",
            }}
            exit={{ opacity: 0, filter: "blur(24px)" }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          >
            {/* Fox background */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url(/avatar/sleep.png)" }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/55" />

            {/* Center content */}
            <div className="relative z-10 flex flex-col items-center gap-8 px-6">
              {/* Logo + sleep indicator */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Moon size={20} className="text-orange-400/70" />
                </motion.div>
                <span className="text-white/30 text-sm font-semibold tracking-widest uppercase select-none">
                  Must-b
                </span>
              </div>

              {/* UYANDIR button */}
              <motion.button
                onClick={handleWake}
                disabled={phase === "waking"}
                className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl
                           bg-orange-500/15 border border-orange-500/35 text-orange-300
                           backdrop-blur-md hover:bg-orange-500/25 hover:border-orange-500/60
                           transition-all duration-300 disabled:opacity-50 select-none"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="text-[15px] font-bold tracking-wider">UYANDIR</span>
                <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                  <ArrowRight size={14} className="text-orange-400" />
                </div>
              </motion.button>

              <p className="text-white/20 text-[11px] tracking-widest uppercase select-none">
                Devam etmek için uyandir
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════
          PHASE 2 — AWAKE: Dark orange hero (dashboard new.jpeg style)
          ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(phase === "awake" || phase === "exiting") && (
          <motion.div
            key="awake-screen"
            className="fixed inset-0 z-30 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "exiting" ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 35%, #3a1505 0%, #1a0802 45%, #080301 100%)",
            }}
          >
            {/* Orange ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(251,146,60,0.12) 0%, transparent 70%)",
              }}
            />

            {/* ── Floating pill nav ─────────────────────────────── */}
            <motion.header
              className="fixed top-4 left-0 right-0 z-50 px-6 flex items-center justify-between"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {/* Logo */}
              <span className="text-[20px] font-black text-white tracking-tighter select-none drop-shadow-lg">
                Must-b
              </span>

              {/* White pill nav */}
              <nav className="nav-pill px-3 py-2 flex items-center gap-0.5">
                {["Home", "AI Models", "API", "Skills", "Labs"].map((item, i) => (
                  <span
                    key={item}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-semibold cursor-default select-none transition-colors ${
                      i === 0 ? "bg-orange-500 text-white" : "text-black/60 hover:text-black"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </nav>

              {/* Settings pill */}
              <Link
                to="/setup"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/18 text-white/90 rounded-full px-4 py-2 text-[13px] font-semibold backdrop-blur-sm border border-white/15 transition-all"
              >
                <Settings size={13} />
                {t.welcome.reconfigure}
                <ArrowRight size={12} className="opacity-60" />
              </Link>
            </motion.header>

            {/* ── Hero content ──────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 pt-28 select-none relative z-10">

              {/* Massive title */}
              <motion.h1
                initial={{ opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
                className="font-black leading-none tracking-tighter text-white mb-12 text-center"
                style={{ fontSize: "clamp(5rem, 18vw, 13rem)", textShadow: "0 0 80px rgba(251,146,60,0.3)" }}
              >
                Must-b
              </motion.h1>

              {/* Glass input — bottom-anchored hero input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.55 }}
                className="w-full max-w-2xl"
              >
                <button
                  onClick={handleNavigate}
                  className="glass-input w-full rounded-2xl flex items-center justify-between px-5 py-4 group cursor-pointer"
                  style={{ background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.25)" }}
                >
                  <span className="text-white/45 text-[16px] leading-relaxed font-normal">
                    What do you want to know?
                  </span>
                  <div className="w-10 h-10 rounded-full bg-orange-500/80 group-hover:bg-orange-500 flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-orange-500/30">
                    <ArrowRight size={18} className="text-white" />
                  </div>
                </button>
              </motion.div>

              {/* Scroll indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 1.2 }}
                className="mt-12 flex flex-col items-center gap-1"
              >
                <div className="w-6 h-9 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
                  <div className="w-1 h-2 rounded-full bg-white/30 animate-bounce" />
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 1.5 }}
              className="relative z-10 text-center pb-6 text-[11px] text-white/40 font-medium tracking-widest uppercase select-none"
            >
              {t.welcome.footer}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit overlay */}
      <AnimatePresence>
        {phase === "exiting" && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ background: "linear-gradient(180deg, #1a0802 0%, #f97316 40%, #0d0602 100%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
