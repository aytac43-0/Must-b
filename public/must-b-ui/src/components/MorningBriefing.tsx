/**
 * MorningBriefing — v1.18.0
 *
 * Story-like full-screen glassmorphism modal that greets the CEO on Dashboard
 * entry when a NightOwl shift ran while they were away.
 *
 * Display rule:
 *   Show once per shift — keyed by lastShiftTs in sessionStorage.
 *   Requires lastShiftTs to be within BRIEFING_WINDOW_MS (14 h).
 *
 * Data:
 *   GET /api/automation/nightowl/status   → NightOwlStatus
 *   GET /api/memory/ltm/search?q=NightShift-Insights&limit=15&category=semantic
 *     → { results: LTMResult[] }
 */
import { useEffect, useState, useRef }        from "react";
import { motion, AnimatePresence, Variants }  from "framer-motion";
import { apiFetch }                           from "@/lib/api";
import {
  Moon, Sparkles, Code2, Package, FileText,
  Brain, FolderGit2, ChevronRight, X, Zap,
} from "lucide-react";

/* ── Constants ──────────────────────────────────────────────────────────── */
const BRIEFING_KEY       = "mustb_briefing_shown";
const BRIEFING_WINDOW_MS = 14 * 60 * 60 * 1000; // 14 h

/* ── Types ──────────────────────────────────────────────────────────────── */
interface NightOwlStatus {
  running:       boolean;
  scanning:      boolean;
  lastShiftTs:   number | null;
  lastShiftMs:   number | null;
  totalFindings: number;
}

interface LTMResult {
  content: string;
  tags:    string[];
  score:   number;
}

interface Finding {
  task:    string;
  summary: string;
}

/* ── Task meta ──────────────────────────────────────────────────────────── */
const TASK_META: Record<string, { label: string; Icon: typeof Sparkles; color: string }> = {
  CodeHealth:    { label: "Kod Sağlığı",      Icon: Code2,      color: "#fb923c" },
  DepAudit:      { label: "Bağımlılık Denetimi", Icon: Package,    color: "#a78bfa" },
  LogAnalysis:   { label: "Log Analizi",      Icon: FileText,   color: "#38bdf8" },
  LTMGap:        { label: "Bellek Boşluğu",   Icon: Brain,      color: "#34d399" },
  WorkspaceDiff: { label: "Değişiklik Özeti", Icon: FolderGit2, color: "#fbbf24" },
};

function taskMeta(tag: string) {
  const key = Object.keys(TASK_META).find(k =>
    tag.toLowerCase().includes(k.toLowerCase())
  );
  return key ? TASK_META[key] : { label: tag, Icon: Sparkles, color: "#fb923c" };
}

function findingTask(tags: string[]): string {
  const skip = new Set(["NightShift-Insights", "nightshift-insights", "nightshift", "night-shift"]);
  return tags.find(t => !skip.has(t)) ?? "General";
}

function humanDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sn`;
  return `${Math.floor(s / 60)} dk ${s % 60} sn`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h} saat ${m} dk önce`;
  if (m > 0) return `${m} dk önce`;
  return "Az önce";
}

/* ── Framer variants ────────────────────────────────────────────────────── */
const overlayV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.4 } },
  exit:   { opacity: 0, transition: { duration: 0.35 } },
};

const modalV: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", stiffness: 260, damping: 26 } },
  exit:   { opacity: 0, y: 20, scale: 0.97, transition: { duration: 0.25 } },
};

const staggerContainer: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.11, delayChildren: 0.45 } },
};

const cardV: Variants = {
  hidden: { opacity: 0, x: 24 },
  show:   { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 28 } },
};

/* ── Component ─────────────────────────────────────────────────────────── */
export default function MorningBriefing() {
  const [visible,  setVisible]  = useState(false);
  const [status,   setStatus]   = useState<NightOwlStatus | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading,  setLoading]  = useState(true);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    (async () => {
      try {
        /* 1 — fetch status */
        const sr  = await apiFetch("/api/automation/nightowl/status");
        if (!sr.ok) return;
        const s: NightOwlStatus = await sr.json();

        /* 2 — guard: no recent shift or already shown */
        if (!s.lastShiftTs) return;
        if (Date.now() - s.lastShiftTs > BRIEFING_WINDOW_MS) return;
        if (sessionStorage.getItem(BRIEFING_KEY) === String(s.lastShiftTs)) return;
        if (s.totalFindings === 0) return;

        /* 3 — fetch LTM findings */
        const mr = await apiFetch(
          "/api/memory/ltm/search?q=NightShift-Insights&limit=15&category=semantic"
        );
        const parsed: { results: LTMResult[] } = mr.ok ? await mr.json() : { results: [] };

        const found: Finding[] = parsed.results
          .filter(r => r.tags.some(t => t.toLowerCase().includes("nightshift")))
          .slice(0, 8)
          .map(r => ({
            task:    findingTask(r.tags),
            summary: r.content.replace(/\n/g, " ").slice(0, 180),
          }));

        setStatus(s);
        setFindings(found);
        setLoading(false);
        setVisible(true);

        /* 4 — mark as shown for this shift */
        sessionStorage.setItem(BRIEFING_KEY, String(s.lastShiftTs));
      } catch {
        /* silent — briefing is non-critical */
      }
    })();
  }, []);

  const dismiss = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="morning-briefing-overlay"
          variants={overlayV}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-[400] flex items-center justify-center px-4"
          style={{ background: "rgba(4,1,0,0.82)", backdropFilter: "blur(8px)" }}
          onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
        >
          <motion.div
            variants={modalV}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative w-full max-w-[620px] max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
            style={{
              background:    "rgba(14,6,1,0.92)",
              border:        "1px solid rgba(249,115,22,0.22)",
              backdropFilter:"blur(32px)",
              boxShadow:     "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* ── Close ──────────────────────────────────────────────── */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/8 transition-all"
            >
              <X size={14} />
            </button>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              className="flex-shrink-0 px-8 pt-8 pb-6"
              style={{ borderBottom: "1px solid rgba(249,115,22,0.10)" }}
            >
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                {/* Moon icon with glow */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(249,115,22,0.12)",
                    border:     "1px solid rgba(249,115,22,0.25)",
                    boxShadow:  "0 0 24px rgba(249,115,22,0.15)",
                  }}
                >
                  <Moon size={22} className="text-orange-400" />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-orange-400/60 tracking-widest uppercase mb-1">
                    Sabah Raporu
                  </p>
                  <h2 className="text-[22px] font-black text-white/90 leading-tight tracking-tight">
                    Gece Vardiyası Tamamlandı
                  </h2>
                  {status?.lastShiftTs && (
                    <p className="text-[12px] text-white/35 mt-1">
                      {timeAgo(status.lastShiftTs)} · {humanDuration(status.lastShiftMs)} sürdü
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Stats strip */}
              {status && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-4 mt-5"
                >
                  {[
                    { label: "Bulgu",   value: String(status.totalFindings) },
                    { label: "Görev",   value: String(Object.keys(TASK_META).length) },
                    { label: "Süre",    value: humanDuration(status.lastShiftMs) },
                  ].map(s => (
                    <div key={s.label} className="flex-1 rounded-xl px-3 py-2.5 text-center"
                      style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
                      <p className="text-[18px] font-black text-orange-400">{s.value}</p>
                      <p className="text-[10px] text-white/30 font-medium mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* ── Findings list (scrollable) ─────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-2.5"
              style={{ scrollbarWidth: "none" }}>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400/40 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {!loading && findings.length === 0 && (
                <p className="text-center text-[13px] text-white/30 py-10">
                  Kayıtlı bulgu bulunamadı.
                </p>
              )}

              {!loading && findings.length > 0 && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-2.5"
                >
                  {findings.map((f, i) => {
                    const meta = taskMeta(f.task);
                    const Icon = meta.Icon;
                    return (
                      <motion.div key={i} variants={cardV}>
                        <div
                          className="flex items-start gap-3 p-4 rounded-2xl"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border:     `1px solid ${meta.color}22`,
                          }}
                        >
                          {/* Task icon */}
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
                          >
                            <Icon size={14} style={{ color: meta.color }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[11px] font-bold mb-1 tracking-wide"
                              style={{ color: meta.color }}
                            >
                              {meta.label}
                            </p>
                            <p className="text-[12.5px] text-white/65 leading-relaxed">
                              {f.summary}
                            </p>
                          </div>

                          <ChevronRight size={13} className="text-white/15 flex-shrink-0 mt-1" />
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* ── Footer CTA ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex-shrink-0 px-8 py-5"
              style={{ borderTop: "1px solid rgba(249,115,22,0.10)" }}
            >
              <button
                onClick={dismiss}
                className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-[14px] transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(249,115,22,0.15)",
                  border:     "1px solid rgba(249,115,22,0.30)",
                  color:      "#fdba74",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(249,115,22,0.15)")}
              >
                <Zap size={15} />
                Günün başlasın
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
