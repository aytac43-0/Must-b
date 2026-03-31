/**
 * NightShiftLog — v1.18.0
 *
 * Compact floating panel (top-right, below nav) showing real-time NightOwl
 * activity via Socket.io.
 *
 * Behaviour:
 *   – Appears automatically when a shift starts ('shiftStart' event).
 *   – Shows live findings as they arrive ('finding' event).
 *   – Summarises on shift end ('shiftEnd' event) then auto-collapses after 20 s.
 *   – Can be opened/closed manually via a compact status pill.
 *
 * Socket event: 'nightOwlEvent'
 *   { type: 'shiftStart', ts, idleCpu, idleRam }
 *   { type: 'finding',    task, summary, ts }
 *   { type: 'shiftEnd',   ts, findingsCount, durationMs }
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, Variants }         from "framer-motion";
import { getSocket }                                  from "@/lib/socket";
import {
  Moon, Code2, Package, FileText, Brain,
  FolderGit2, Sparkles, ChevronDown, ChevronUp,
  CheckCircle2,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────────── */
type ShiftPhase = "idle" | "scanning" | "done";

interface LogEntry {
  id:      string;
  task:    string;
  summary: string;
  ts:      number;
}

interface ShiftSummary {
  findingsCount: number;
  durationMs:    number;
  ts:            number;
}

/* ── Task meta ───────────────────────────────────────────────────────────── */
const TASK_META: Record<string, { label: string; Icon: typeof Sparkles; color: string }> = {
  CodeHealth:    { label: "Kod Sağlığı",   Icon: Code2,      color: "#fb923c" },
  DepAudit:      { label: "Bağımlılık",    Icon: Package,    color: "#a78bfa" },
  LogAnalysis:   { label: "Log Analizi",   Icon: FileText,   color: "#38bdf8" },
  LTMGap:        { label: "Bellek",        Icon: Brain,      color: "#34d399" },
  WorkspaceDiff: { label: "Değişiklikler", Icon: FolderGit2, color: "#fbbf24" },
};

function resolveMeta(task: string) {
  const key = Object.keys(TASK_META).find(k =>
    task.toLowerCase().includes(k.toLowerCase())
  );
  return key ? TASK_META[key] : { label: task, Icon: Sparkles, color: "#fb923c" };
}

function shortDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ── Animation variants ─────────────────────────────────────────────────── */
const panelV: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.96 },
  show:   { opacity: 1, x: 0,  scale: 1, transition: { type: "spring", stiffness: 320, damping: 28 } },
  exit:   { opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.22 } },
};

const rowV: Variants = {
  hidden: { opacity: 0, y: -6 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.22 } },
};

/* ── Component ──────────────────────────────────────────────────────────── */
export default function NightShiftLog() {
  const [phase,    setPhase]   = useState<ShiftPhase>("idle");
  const [entries,  setEntries] = useState<LogEntry[]>([]);
  const [summary,  setSummary] = useState<ShiftSummary | null>(null);
  const [open,     setOpen]    = useState(false);
  const [visible,  setVisible] = useState(false);

  const autocloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryIdx     = useRef(0);

  const scheduleAutoClose = useCallback((delayMs = 20_000) => {
    if (autocloseRef.current) clearTimeout(autocloseRef.current);
    autocloseRef.current = setTimeout(() => {
      setOpen(false);
      setTimeout(() => setVisible(false), 600);
    }, delayMs);
  }, []);

  useEffect(() => {
    const sk = getSocket();

    sk.on("nightOwlEvent", (ev: { type: string } & Record<string, unknown>) => {
      if (ev.type === "shiftStart") {
        if (autocloseRef.current) clearTimeout(autocloseRef.current);
        setPhase("scanning");
        setEntries([]);
        setSummary(null);
        setVisible(true);
        setOpen(true);
        return;
      }

      if (ev.type === "finding") {
        const entry: LogEntry = {
          id:      `${++entryIdx.current}`,
          task:    String(ev.task ?? "General"),
          summary: String(ev.summary ?? "").slice(0, 120),
          ts:      Number(ev.ts ?? Date.now()),
        };
        setEntries(prev => [entry, ...prev].slice(0, 20));
        return;
      }

      if (ev.type === "shiftEnd") {
        setPhase("done");
        setSummary({
          findingsCount: Number(ev.findingsCount ?? 0),
          durationMs:    Number(ev.durationMs   ?? 0),
          ts:            Number(ev.ts            ?? Date.now()),
        });
        scheduleAutoClose(20_000);
        return;
      }
    });

    return () => {
      sk.off("nightOwlEvent");
      if (autocloseRef.current) clearTimeout(autocloseRef.current);
    };
  }, [scheduleAutoClose]);

  /* ─────────────────────────────────────────────────────────────────────── */
  if (!visible) return null;

  const scanColor = "#fb923c";

  return (
    <AnimatePresence>
      <motion.div
        key="night-shift-log"
        variants={panelV}
        initial="hidden"
        animate="show"
        exit="exit"
        className="fixed z-[130] flex flex-col"
        style={{
          top:       "80px",       /* below nav pill */
          right:     "20px",
          width:     "300px",
          maxHeight: "70vh",
          pointerEvents: "auto",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{
            background:    "rgba(10,4,1,0.90)",
            border:        `1px solid ${scanColor}28`,
            backdropFilter:"blur(24px)",
            boxShadow:     "0 12px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <button
            onClick={() => {
              setOpen(v => !v);
              if (autocloseRef.current) clearTimeout(autocloseRef.current);
            }}
            className="flex items-center justify-between px-4 py-3 w-full select-none"
            style={{ borderBottom: open ? `1px solid ${scanColor}10` : "none" }}
          >
            <div className="flex items-center gap-2.5">
              {/* Status indicator */}
              {phase === "scanning" ? (
                <span className="relative flex-shrink-0">
                  <span className="block w-2 h-2 rounded-full bg-orange-400" />
                  <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-70" />
                </span>
              ) : phase === "done" ? (
                <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
              ) : (
                <Moon size={13} className="text-orange-300/50 flex-shrink-0" />
              )}

              <span className="text-[12px] font-semibold text-white/75">
                {phase === "scanning" ? "Gece Vardiyası" : "Vardiya Logu"}
              </span>

              {phase === "scanning" && (
                <span className="text-[10px] text-orange-400/70 font-mono animate-pulse">
                  taranıyor…
                </span>
              )}

              {phase === "done" && summary && (
                <span className="text-[10px] text-white/30 font-mono">
                  {summary.findingsCount} bulgu · {shortDuration(summary.durationMs)}
                </span>
              )}
            </div>

            {open ? (
              <ChevronUp size={12} className="text-white/25" />
            ) : (
              <ChevronDown size={12} className="text-white/25" />
            )}
          </button>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <AnimatePresence>
            {open && (
              <motion.div
                key="log-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div
                  className="overflow-y-auto"
                  style={{ maxHeight: "52vh", scrollbarWidth: "none" }}
                >
                  {/* Scanning pulse banner */}
                  {phase === "scanning" && entries.length === 0 && (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span key={i}
                            className="w-1.5 h-1.5 rounded-full bg-orange-400/50 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-white/30">Sistem analiz ediliyor…</span>
                    </div>
                  )}

                  {/* Entry list */}
                  <AnimatePresence initial={false}>
                    {entries.map(entry => {
                      const meta = resolveMeta(entry.task);
                      const Icon = meta.Icon;
                      return (
                        <motion.div
                          key={entry.id}
                          variants={rowV}
                          initial="hidden"
                          animate="show"
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-3 px-4 py-3"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
                          >
                            <Icon size={11} style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold mb-0.5" style={{ color: meta.color }}>
                              {meta.label}
                            </p>
                            <p className="text-[11px] text-white/50 leading-snug line-clamp-3">
                              {entry.summary}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Done state — no findings */}
                  {phase === "done" && entries.length === 0 && (
                    <p className="text-center text-[12px] text-white/25 py-8">
                      Kayda değer bulgu yok.
                    </p>
                  )}
                </div>

                {/* Done footer */}
                {phase === "done" && summary && (
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{ borderTop: `1px solid ${scanColor}10` }}
                  >
                    <span className="text-[10px] text-white/25 font-mono">
                      {new Date(summary.ts).toLocaleTimeString("tr-TR")}
                    </span>
                    <span className="text-[10px] text-green-400/70 font-semibold">
                      ✓ Tamamlandı
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
