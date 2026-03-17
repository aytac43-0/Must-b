import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import { useI18n } from "@/i18n";

// Stable star positions — no random re-renders
const STARS = [
  { w: 1.8, top: "8%",  left: "12%", op: 0.25 },
  { w: 1.2, top: "22%", left: "85%", op: 0.18 },
  { w: 2.1, top: "35%", left: "5%",  op: 0.30 },
  { w: 1.5, top: "60%", left: "92%", op: 0.20 },
  { w: 1.0, top: "75%", left: "18%", op: 0.15 },
  { w: 2.0, top: "88%", left: "72%", op: 0.28 },
  { w: 1.3, top: "14%", left: "55%", op: 0.22 },
  { w: 1.7, top: "45%", left: "78%", op: 0.19 },
  { w: 1.1, top: "92%", left: "40%", op: 0.16 },
  { w: 2.2, top: "5%",  left: "38%", op: 0.24 },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { t }    = useI18n();

  const [waking,  setWaking]  = useState(false);
  const [awake,   setAwake]   = useState(false);
  const [exiting, setExiting] = useState(false);

  // No API calls on mount — the sleeping fox renders fully offline.
  // All gateway communication starts only when the user clicks "Wake".
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
    } catch { /* gateway not ready — continue anyway */ }

    setTimeout(() => setAwake(true), 600);
    // Fade out before navigate
    setTimeout(() => {
      setExiting(true);
      setTimeout(() => navigate("/app"), 550);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02040a]">

      {/* ── Full-screen immersive background image ── */}
      <motion.img
        src="/avatar/sleep.png"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: "center 25%" }}
        animate={{ opacity: waking ? 0 : 0.16, scale: waking ? 1.05 : 1 }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />
      <motion.img
        src="/avatar/awake.png"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: "center 25%" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: awake ? 0.20 : 0, scale: awake ? 1.04 : 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      {/* Dark vignette — keeps text readable over the large image */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-[#02040a]/40 to-[#02040a] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#02040a]/55 via-transparent to-[#02040a]/55 pointer-events-none" />

      {/* ── Warm background glow ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-900/15 rounded-full blur-[120px]" />
      </div>

      {/* ── Stars ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: s.w + "px", height: s.w + "px", top: s.top, left: s.left, opacity: s.op }}
          />
        ))}
      </div>

      {/* ── Exit fade overlay ── */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            className="absolute inset-0 bg-[#02040a] z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ── Reconfigure link (top-right) ── */}
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
          {t.welcome.reconfigure}
        </Link>
      </motion.div>

      {/* ── Main content ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center gap-8">

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p className="text-xs font-bold text-orange-500/60 tracking-[0.4em] uppercase mb-2">
            {t.welcome.tagline}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            {t.welcome.title}
          </h1>
        </motion.div>

        {/* Focal avatar */}
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

          <motion.div
            animate={awake ? { scale: 1.12, rotate: [0, -3, 3, 0] } : waking ? { scale: 1.05 } : {}}
            transition={{ duration: 0.5 }}
            className="relative w-48 h-48 animate-float-slow"
          >
            {/* Sleeping avatar */}
            <motion.img
              src="/avatar/sleep.png"
              alt="Must-b sleeping"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_0_30px_rgba(234,88,12,0.4)]"
              animate={{ opacity: waking || awake ? 0 : 1 }}
              transition={{ duration: 0.4 }}
            />
            {/* Awake avatar */}
            <motion.img
              src="/avatar/awake.png"
              alt="Must-b awake"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_0_40px_rgba(234,88,12,0.6)]"
              animate={{ opacity: waking || awake ? 1 : 0 }}
              transition={{ duration: 0.4, delay: waking ? 0.2 : 0 }}
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
                    animate={{
                      opacity: [0, 1, 0],
                      scale:   [0, 1.2, 0],
                      x: (i % 2 === 0 ? 1 : -1) * (30 + i * 15),
                      y: -(40 + i * 10),
                    }}
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
          {awake ? t.welcome.awake : waking ? t.welcome.waking : t.welcome.sleeping}
        </motion.p>

        {/* Wake button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.7 }}
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
                <>
                  <span className="w-4 h-4 border-2 border-orange-300/60 border-t-orange-300 rounded-full animate-spin" />
                  {t.welcome.waking}
                </>
              ) : (
                <>
                  <span className="text-xl">🦊</span>
                  {t.welcome.wakeBtn}
                </>
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
          {t.welcome.footer}
        </motion.p>
      </div>
    </div>
  );
}
