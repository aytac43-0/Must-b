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
import { useNavigate }         from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Moon }    from "lucide-react";

type Phase = "sleeping" | "exiting";

export default function WelcomePage() {
  const navigate = useNavigate();
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

  const handleWake = async () => {
    if (phase !== "sleeping") return;
    // Skip awake intermediate — go directly to /app/chat after a brief exit animation
    setPhase("exiting");

    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
        const data = await res.json() as { configured?: boolean };
        if (!data.configured) { navigate("/setup", { replace: true }); return; }
      }
      await fetch("/api/auth/local").catch(() => {});
    } catch { /* continue */ }

    setTimeout(() => navigate("/app/chat", { replace: true }), 450);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">

      {/* ═══════════════════════════════════════════════════════════
          PHASE 1 — SLEEPING: sleep.png full-screen
          ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "sleeping" && (
          <motion.div
            key="sleep-screen"
            className="fixed inset-0 z-40 flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
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
                disabled={phase === "exiting"}
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
