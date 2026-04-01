/**
 * VoiceFeedbackLayer — v1.0
 *
 * Tam ekran ses geri bildirim katmanı. İki mod:
 *
 *   LISTENING  — wake word tetiklenince `mustb:wake` CustomEvent gelir.
 *                Avatar etrafında turuncu radyal ses dalgaları (3 halka, staggered).
 *                3 saniye sonra otomatik kapanır.
 *
 *   SPEAKING   — `agentUpdate { type: "planStart" }` socket eventi.
 *                Alt merkezde glassmorphism bar + animasyonlu waveform çubukları.
 *                `planFinish` gelince kaybolur.
 *
 * Temizlik: her iki listener da unmount'ta kaldırılır.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence }                  from "framer-motion";
import { Mic, Sparkles }                            from "lucide-react";
import { getSocket }                                from "@/lib/socket";

// ── Wake Aura ─────────────────────────────────────────────────────────────────

const RING_COUNT   = 4;
const AURA_DURATION = 3000; // ms — auto-dismiss

function WakeAura() {
  return (
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Vignette dim */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(249,115,22,0.04) 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Radial rings */}
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            border:      "1.5px solid rgba(249,115,22,0.70)",
            boxShadow:   "0 0 20px rgba(249,115,22,0.25)",
          }}
          initial={{ width: 64, height: 64, opacity: 0.9, scale: 1 }}
          animate={{
            width:   64 + i * 0,
            height:  64 + i * 0,
            scale:   [1, 3.5 + i * 1.2],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: 1.8,
            delay:    i * 0.22,
            ease:     "easeOut",
            repeat:   Infinity,
            repeatDelay: 0.1,
          }}
        />
      ))}

      {/* Center mic icon */}
      <motion.div
        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background:    "rgba(249,115,22,0.18)",
          border:        "1.5px solid rgba(249,115,22,0.55)",
          backdropFilter:"blur(16px)",
          boxShadow:     "0 0 32px rgba(249,115,22,0.35), 0 0 64px rgba(249,115,22,0.15)",
        }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mic size={26} className="text-orange-400" />
      </motion.div>

      {/* Label */}
      <motion.p
        className="absolute text-[12px] font-semibold text-orange-300/80 tracking-widest uppercase"
        style={{ top: "calc(50% + 52px)" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        Dinliyorum…
      </motion.p>
    </motion.div>
  );
}

// ── Speaking Bar ──────────────────────────────────────────────────────────────

const BAR_COUNT   = 7;
const BAR_HEIGHTS = [0.4, 0.7, 1.0, 0.8, 1.0, 0.65, 0.35];

function SpeakingBar() {
  return (
    <motion.div
      className="fixed bottom-8 left-1/2 z-[190] -translate-x-1/2 pointer-events-none"
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{ opacity: 0, y: 16, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl"
        style={{
          background:    "rgba(10,4,1,0.82)",
          border:        "1px solid rgba(249,115,22,0.32)",
          backdropFilter:"blur(24px)",
          boxShadow:     "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(249,115,22,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Sparkle icon */}
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.16)", border: "1px solid rgba(249,115,22,0.30)" }}
        >
          <Sparkles size={12} className="text-orange-400" />
        </span>

        {/* Label */}
        <span className="text-[12px] font-semibold text-white/70 tracking-wide whitespace-nowrap">
          Must-b düşünüyor
        </span>

        {/* Waveform bars */}
        <div className="flex items-end gap-[3px] h-5">
          {BAR_HEIGHTS.map((maxH, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full"
              style={{ background: "rgba(249,115,22,0.75)" }}
              animate={{
                scaleY: [maxH * 0.3, maxH, maxH * 0.5, maxH * 0.9, maxH * 0.2],
                opacity: [0.6, 1, 0.7, 1, 0.5],
              }}
              transition={{
                duration:    0.9 + i * 0.07,
                repeat:      Infinity,
                repeatType:  "mirror",
                ease:        "easeInOut",
                delay:       i * 0.09,
              }}
              style={{
                height:       "20px",
                originY:      1,
                background:   "rgba(249,115,22,0.75)",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── VoiceFeedbackLayer ────────────────────────────────────────────────────────

export default function VoiceFeedbackLayer() {
  const [listening, setListening] = useState(false);
  const [speaking,  setSpeaking]  = useState(false);
  const auraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerListening = useCallback(() => {
    setListening(true);
    if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
    auraTimerRef.current = setTimeout(() => setListening(false), AURA_DURATION);
  }, []);

  useEffect(() => {
    // ── Wake word aura ──────────────────────────────────────────────────────
    window.addEventListener("mustb:wake", triggerListening);

    // ── Agent speaking bar ──────────────────────────────────────────────────
    const sk = getSocket();
    const onAgentUpdate = (data: { type: string }) => {
      if (data.type === "planStart")  setSpeaking(true);
      if (data.type === "planFinish") setSpeaking(false);
    };
    sk.on("agentUpdate", onAgentUpdate);

    return () => {
      window.removeEventListener("mustb:wake", triggerListening);
      sk.off("agentUpdate", onAgentUpdate);
      if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
    };
  }, [triggerListening]);

  return (
    <>
      <AnimatePresence>
        {listening && <WakeAura key="wake-aura" />}
      </AnimatePresence>
      <AnimatePresence>
        {speaking && !listening && <SpeakingBar key="speaking-bar" />}
      </AnimatePresence>
    </>
  );
}
