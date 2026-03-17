import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [waking, setWaking]           = useState(false);
  const [awake, setAwake]             = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);

  // Check if first-time setup is required
  useEffect(() => {
    fetch("/api/setup/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: { configured?: boolean } | null) => {
        if (d && !d.configured) setSetupNeeded(true);
      })
      .catch(() => { /* server not ready yet — ignore */ });
  }, []);

  const handleWake = async () => {
    if (setupNeeded) { navigate("/setup"); return; }
    setWaking(true);
    try { await fetch("/api/auth/local"); } catch { /* local — always available */ }
    setTimeout(() => setAwake(true), 600);
    setTimeout(() => navigate("/app"), 1800);
  };

  // Stable star positions (no random re-renders)
  const stars = [
    { w: 1.8, h: 1.8, top: "8%",  left: "12%", op: 0.25 },
    { w: 1.2, h: 1.2, top: "22%", left: "85%", op: 0.18 },
    { w: 2.1, h: 2.1, top: "35%", left: "5%",  op: 0.30 },
    { w: 1.5, h: 1.5, top: "60%", left: "92%", op: 0.20 },
    { w: 1.0, h: 1.0, top: "75%", left: "18%", op: 0.15 },
    { w: 2.0, h: 2.0, top: "88%", left: "72%", op: 0.28 },
    { w: 1.3, h: 1.3, top: "14%", left: "55%", op: 0.22 },
    { w: 1.7, h: 1.7, top: "45%", left: "78%", op: 0.19 },
    { w: 1.1, h: 1.1, top: "92%", left: "40%", op: 0.16 },
    { w: 2.2, h: 2.2, top: "5%",  left: "38%", op: 0.24 },
  ];

  return (
    <div className="relative min-h-screen bg-[#02040a] flex flex-col items-center justify-center overflow-hidden">
      {/* Background warm glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-700/15 rounded-full blur-[60px]" />
      </div>

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: s.w + "px", height: s.h + "px", top: s.top, left: s.left, opacity: s.op }}
          />
        ))}
      </div>

      {/* Setup link — top right corner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="absolute top-5 right-5 z-20"
      >
        <Link
          to="/setup"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all text-xs font-medium"
        >
          <Settings size={13} />
          {setupNeeded ? <span className="text-orange-400">Setup required</span> : "Reconfigure"}
        </Link>
      </motion.div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p className="text-xs font-bold text-orange-500/60 tracking-[0.4em] uppercase mb-2">
            Your AI Brain
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white">Must-b</h1>
        </motion.div>

        {/* Sleeping avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="relative"
        >
          {/* Glow ring */}
          <div
            className={`absolute inset-0 rounded-full blur-[40px] transition-all duration-700 ${
              awake ? "bg-orange-400/50 scale-125" : "bg-orange-800/30 animate-breathe"
            }`}
          />

          {/* Avatar */}
          <motion.div
            animate={awake ? { scale: 1.12, rotate: [0, -3, 3, 0] } : waking ? { scale: 1.05 } : {}}
            transition={{ duration: 0.5 }}
            className="relative w-52 h-52 animate-float-slow"
          >
            <img
              src="/avatar/sleep.png"
              alt="Must-b sleeping red panda"
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(234,88,12,0.4)]"
            />
          </motion.div>

          {/* Zzz */}
          <AnimatePresence>
            {!waking && !awake && (
              <>
                <motion.span key="z1" className="absolute top-2 right-4 text-orange-400 font-bold text-lg select-none animate-zzz" style={{ animationDelay: "0s" }}>z</motion.span>
                <motion.span key="z2" className="absolute -top-3 right-10 text-orange-400 font-bold text-xl select-none animate-zzz-2">z</motion.span>
                <motion.span key="z3" className="absolute -top-8 right-3 text-orange-400/70 font-bold text-2xl select-none animate-zzz-3">Z</motion.span>
              </>
            )}
          </AnimatePresence>

          {/* Wake sparkles */}
          <AnimatePresence>
            {awake && (
              <>
                {(["✦", "✧", "✦", "✧"] as const).map((s, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0], x: (i % 2 === 0 ? 1 : -1) * (30 + i * 15), y: -(40 + i * 10) }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="absolute top-1/2 left-1/2 text-amber-400 text-xl pointer-events-none"
                  >
                    {s}
                  </motion.span>
                ))}
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Status text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-gray-500 text-sm font-medium tracking-wide"
        >
          {awake ? "Uyanıyor..." : waking ? "Uyandırılıyor..." : setupNeeded ? "Kurulum bekleniyor..." : "Uyuyor..."}
        </motion.p>

        {/* Wake / Setup button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.7 }}
          className="flex flex-col items-center gap-3"
        >
          <button
            onClick={handleWake}
            disabled={waking}
            className={`relative group px-10 py-4 rounded-2xl font-bold text-base tracking-wide transition-all duration-300 overflow-hidden ${
              waking
                ? "bg-orange-700/50 text-orange-300/60 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-500 hover:to-amber-500 shadow-[0_0_30px_rgba(234,88,12,0.35)] hover:shadow-[0_0_45px_rgba(234,88,12,0.55)] active:scale-[0.97]"
            }`}
          >
            {!waking && (
              <span className="absolute inset-0 w-1/3 h-full bg-white/10 skew-x-12 -translate-x-full group-hover:translate-x-[350%] transition-transform duration-700" />
            )}
            <span className="relative z-10 flex items-center gap-3">
              {waking ? (
                <><span className="w-4 h-4 border-2 border-orange-300/60 border-t-orange-300 rounded-full animate-spin" />Uyanıyor...</>
              ) : setupNeeded ? (
                <><Settings size={20} />Kurulumu Başlat</>
              ) : (
                <><span className="text-xl">🦊</span>Must-b&apos;yi Uyandır</>
              )}
            </span>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="text-[11px] text-gray-700 font-medium tracking-widest uppercase"
        >
          © 2026 Must-b — Auto Step Platform
        </motion.p>
      </div>
    </div>
  );
}
