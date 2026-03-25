/**
 * WelcomePage — Liquid Orange v1.7.0
 *
 * White pill nav, massive dark title,
 * cream → warm orange → deep charcoal gradient (index.css).
 */
import { useState, useEffect } from "react";
import { useNavigate, Link }   from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, ArrowRight }    from "lucide-react";
import { useI18n }              from "@/i18n";

export default function WelcomePage() {
  const navigate       = useNavigate();
  const { t }          = useI18n();
  const [waking,  setWaking]  = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res  = await fetch("/api/setup/status");
        if (!res.ok || cancelled) return;
        const data = await res.json() as { configured?: boolean };
        if (!cancelled && !data.configured) navigate("/setup");
      } catch { /* gateway not ready */ }
    };
    const timer = setTimeout(check, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [navigate]);

  const handleWake = async () => {
    if (waking) return;
    setWaking(true);
    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
        const data = await res.json() as { configured?: boolean };
        if (!data.configured) { navigate("/setup"); return; }
      }
      await fetch("/api/auth/local");
    } catch { /* continue */ }
    setTimeout(() => {
      setExiting(true);
      setTimeout(() => navigate("/app"), 500);
    }, 600);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">

      {/* ── Exit fade ── */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ background: "linear-gradient(180deg, #fefaf5 0%, #f97316 30%, #0d0602 100%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          />
        )}
      </AnimatePresence>

      {/* ── Floating pill nav ── */}
      <header className="fixed top-4 left-0 right-0 z-30 px-6 flex items-center justify-between">
        {/* Logo */}
        <span className="text-[22px] font-black text-[#1a0c06] tracking-tighter drop-shadow-sm select-none">
          Must-b
        </span>

        {/* White pill nav */}
        <nav className="nav-pill px-3 py-2 flex items-center gap-0.5">
          {["Home", "AI Models", "API", "Skills", "Labs"].map((item, i) => (
            <span key={item} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold cursor-default select-none transition-colors ${i === 0 ? "bg-black text-white" : "text-black/60 hover:text-black"}`}>
              {item}
            </span>
          ))}
        </nav>

        {/* Settings pill */}
        <Link
          to="/setup"
          className="flex items-center gap-2 bg-[#1a0c06] hover:bg-[#3d1a06] text-white/90 rounded-full px-4 py-2 text-[13px] font-semibold shadow-lg transition-all"
        >
          <Settings size={13} />
          {t.welcome.reconfigure}
          <ArrowRight size={12} className="opacity-60" />
        </Link>
      </header>

      {/* ── Hero content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 pt-28 select-none">

        {/* Massive title */}
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-black leading-none tracking-tighter text-[#1a0c06] mb-12 text-center"
          style={{ fontSize: "clamp(5rem, 18vw, 13rem)" }}
        >
          Must-b
        </motion.h1>

        {/* Glass input — centered hero input */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          <button
            onClick={handleWake}
            disabled={waking}
            className="glass-input w-full rounded-2xl flex items-center justify-between px-5 py-4 group cursor-pointer disabled:opacity-70"
          >
            <span className="text-white/45 text-[16px] leading-relaxed font-normal">
              {waking ? t.welcome.waking : "What do you want to know?"}
            </span>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              waking
                ? "bg-white/10"
                : "bg-[#1a0c06] group-hover:bg-[#3d1a06] shadow-lg"
            }`}>
              {waking
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                : <ArrowRight size={18} className="text-white" />}
            </div>
          </button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.4 }}
          className="mt-12 flex flex-col items-center gap-1"
        >
          <div className="w-6 h-9 rounded-full border-2 border-[#1a0c06]/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-[#1a0c06]/40 animate-bounce" />
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ delay: 1.6 }}
        className="text-center pb-6 text-[11px] text-[#1a0c06]/50 font-medium tracking-widest uppercase select-none"
      >
        {t.welcome.footer}
      </motion.p>
    </div>
  );
}
