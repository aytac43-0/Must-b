/**
 * WhisperPanel — v1.16.0
 *
 * Floating glassmorphism panel (bottom-right) that surfaces Project Intelligence
 * "whisper" events from the backend.
 *
 * Socket event consumed:
 *   'projectInsight'  { message: string, filePath?: string, ts: number }
 *
 * Behaviour:
 *   – Stacks up to 4 whispers; oldest auto-dismisses after 10 s.
 *   – Each card can be manually dismissed.
 *   – Slides in from the right with spring physics.
 */
import { useState, useEffect, useCallback, useId } from "react";
import { motion, AnimatePresence }                  from "framer-motion";
import { FileText, X, Sparkles }                    from "lucide-react";
import { getSocket }                                from "@/lib/socket";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface WhisperCard {
  id:       string;
  message:  string;
  filePath?: string;
  ts:       number;
}

const MAX_WHISPERS = 4;
const AUTO_DISMISS = 10_000; // ms

/* ── Component ─────────────────────────────────────────────────────────── */
export default function WhisperPanel() {
  const [cards, setCards] = useState<WhisperCard[]>([]);
  const idPrefix = useId();

  const dismiss = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => {
    const sk = getSocket();

    sk.on("projectInsight", (ev: { message: string; filePath?: string; ts: number }) => {
      const card: WhisperCard = {
        id:       `${idPrefix}-${ev.ts}-${Math.random().toString(36).slice(2, 7)}`,
        message:  ev.message,
        filePath: ev.filePath,
        ts:       ev.ts,
      };

      setCards(prev => {
        const next = [card, ...prev].slice(0, MAX_WHISPERS);
        return next;
      });

      // Auto-dismiss after 10 s
      setTimeout(() => dismiss(card.id), AUTO_DISMISS);
    });

    return () => { sk.off("projectInsight"); };
  }, [dismiss, idPrefix]);

  if (cards.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-5 z-[150] flex flex-col gap-2.5 items-end"
      style={{ maxWidth: "340px", pointerEvents: "none" }}
    >
      <AnimatePresence mode="popLayout">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            style={{
              pointerEvents: "auto",
              opacity: i === 0 ? 1 : 1 - i * 0.12,
            }}
            className="w-full"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background:    "rgba(15,6,1,0.82)",
                border:        "1px solid rgba(249,115,22,0.28)",
                backdropFilter:"blur(24px)",
                boxShadow:     "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(249,115,22,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2"
                style={{ borderBottom: "1px solid rgba(249,115,22,0.12)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.30)" }}
                  >
                    <Sparkles size={10} className="text-orange-400" />
                  </span>
                  <span className="text-[11px] font-semibold text-orange-300/80 tracking-wide uppercase">
                    Must-b fısıldıyor
                  </span>
                </div>
                <button
                  onClick={() => dismiss(card.id)}
                  className="text-white/25 hover:text-white/60 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-2">
                <p className="text-[13px] text-white/80 leading-relaxed">
                  {card.message}
                </p>

                {card.filePath && (
                  <div className="flex items-center gap-1.5">
                    <FileText size={10} className="text-white/25 flex-shrink-0" />
                    <span className="text-[10px] font-mono text-white/35 truncate">
                      {card.filePath.replace(/\\/g, "/")}
                    </span>
                  </div>
                )}
              </div>

              {/* Auto-dismiss progress bar */}
              <div className="h-px w-full" style={{ background: "rgba(249,115,22,0.10)" }}>
                <motion.div
                  className="h-full"
                  style={{ background: "rgba(249,115,22,0.45)" }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: AUTO_DISMISS / 1000, ease: "linear" }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
