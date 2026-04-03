/**
 * GeziHaritasi — Araştırmacı Gezi Haritası v1.0
 *
 * Researcher (browser/web araştırması) aktifken ziyaret edilen siteleri
 * gösteren glassmorphism widget.
 *
 * Dinlenen socket olayları (agentUpdate):
 *   stepStart  { step: { tool:"browser_navigate", parameters:{ url } } }
 *   stepStart  { step: { tool:"web_search",       parameters:{ query } } }
 *   stepStart  { step: { tool:"http_request",     parameters:{ url } } }
 *   planFinish → session kapat, 5s sonra gizle
 *
 * Her ziyaret kartı gösterir:
 *   • Favicon (letter fallback)
 *   • Domain adı
 *   • Arama sorgusu veya path
 *   • Zaman damgası
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence }                   from "framer-motion";
import { Globe, Search, Link2, X, Map, ChevronDown, ChevronUp } from "lucide-react";
import { getSocket } from "@/lib/socket";

// ── Types ─────────────────────────────────────────────────────────────────────

type VisitKind = "navigate" | "search" | "request";

interface VisitEntry {
  id:      string;
  kind:    VisitKind;
  url?:    string;       // browser_navigate / http_request
  query?:  string;       // web_search
  domain?: string;
  ts:      number;
  done:    boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BROWSER_TOOLS: Record<string, VisitKind> = {
  browser_navigate: "navigate",
  web_search:       "search",
  http_request:     "request",
};

const MAX_VISITS  = 20;
const HIDE_DELAY  = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

function parsePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.slice(0, 40) || "/";
  } catch {
    return "";
  }
}

function kindIcon(kind: VisitKind): React.ReactNode {
  if (kind === "search")  return <Search  size={10} />;
  if (kind === "request") return <Link2   size={10} />;
  return                         <Globe   size={10} />;
}

function kindColor(kind: VisitKind): string {
  if (kind === "search")  return "#a78bfa"; // violet
  if (kind === "request") return "#94a3b8"; // slate
  return "#38bdf8"; // sky
}

// ── FaviconBadge ──────────────────────────────────────────────────────────────

function FaviconBadge({ domain, kind }: { domain: string; kind: VisitKind }) {
  const letter = domain[0]?.toUpperCase() ?? "?";
  const color  = kindColor(kind);

  return (
    <span
      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black"
      style={{
        background: `${color}18`,
        border:     `1px solid ${color}30`,
        color,
      }}
    >
      {letter}
    </span>
  );
}

// ── VisitCard ─────────────────────────────────────────────────────────────────

function VisitCard({ entry, isLatest }: { entry: VisitEntry; isLatest: boolean }) {
  const color   = kindColor(entry.kind);
  const domain  = entry.domain ?? "";
  const sub     = entry.query ?? (entry.url ? parsePath(entry.url) : "");

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2"
      style={{
        borderLeft: isLatest ? `2px solid ${color}` : "2px solid transparent",
        background: isLatest ? `${color}08` : "transparent",
      }}
    >
      {/* Favicon badge */}
      <FaviconBadge domain={domain || "?"} kind={entry.kind} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-white/80 truncate leading-tight">
          {domain || entry.query?.slice(0, 30) || "—"}
        </p>
        {sub && (
          <p className="text-[9px] text-white/35 truncate font-mono mt-0.5">{sub}</p>
        )}
      </div>

      {/* Kind icon */}
      <span style={{ color, opacity: 0.6 }} className="flex-shrink-0">
        {kindIcon(entry.kind)}
      </span>

      {/* Time */}
      <span className="text-[9px] text-white/20 font-mono flex-shrink-0">
        {new Date(entry.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </div>
  );
}

// ── GeziHaritasi ─────────────────────────────────────────────────────────────

export default function GeziHaritasi() {
  const [visits,    setVisits]    = useState<VisitEntry[]>([]);
  const [visible,   setVisible]   = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [active,    setActive]    = useState(false); // plan is running
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setVisits([]);
      setActive(false);
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    const sk = getSocket();

    const onAgentUpdate = (data: { type: string; step?: { tool?: string; id?: string; parameters?: Record<string, unknown> }; status?: string }) => {
      const { type } = data;

      if (type === "planStart") {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setActive(true);
        return;
      }

      if (type === "planFinish") {
        setActive(false);
        // Mark all active visits as done
        setVisits(prev => prev.map(v => ({ ...v, done: true })));
        scheduleHide();
        return;
      }

      if (type === "stepStart" && data.step) {
        const step = data.step;
        const kind = step.tool ? BROWSER_TOOLS[step.tool] : undefined;
        if (!kind) return;

        const params = step.parameters ?? {};
        const url    = String(params.url ?? params.endpoint ?? "").trim();
        const query  = String(params.query ?? "").trim();

        // Only track if there's actual URL or query
        if (!url && !query) return;

        const entry: VisitEntry = {
          id:     `v-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          kind,
          url:    url || undefined,
          query:  query || undefined,
          domain: url ? parseDomain(url) : undefined,
          ts:     Date.now(),
          done:   false,
        };

        setVisits(prev => [entry, ...prev].slice(0, MAX_VISITS));
        setVisible(true);
        setMinimized(false);
      }
    };

    sk.on("agentUpdate", onAgentUpdate);
    return () => {
      sk.off("agentUpdate", onAgentUpdate);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  if (!visible || visits.length === 0) return null;

  return (
    <motion.div
      className="fixed right-4 z-[120] w-[300px]"
      style={{ top: "88px" }}
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0,   scale: 1    }}
      exit={{ opacity: 0, x: 16, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:    "rgba(5,3,1,0.88)",
          border:        "1px solid rgba(56,189,248,0.22)",
          backdropFilter:"blur(24px)",
          boxShadow:     "0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,189,248,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
          style={{ borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setMinimized(m => !m)}
        >
          <Map size={11} className="text-sky-400/70 flex-shrink-0" />
          <span className="text-[11px] font-bold text-white/60 flex-1 tracking-wide uppercase">
            Gezi Haritası
          </span>

          {/* Live pulse when active */}
          {active && (
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-sky-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-[10px] text-sky-400/70 font-medium">taranıyor</span>
            </span>
          )}

          <span className="text-[10px] text-white/25 flex-shrink-0 font-mono ml-1">
            {visits.length}
          </span>

          <button
            onClick={e => { e.stopPropagation(); setVisible(false); setVisits([]); }}
            className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 ml-1"
          >
            <X size={10} />
          </button>

          <span className="text-white/20 flex-shrink-0">
            {minimized ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </span>
        </div>

        {/* Visit list */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="overflow-y-auto divide-y divide-white/4" style={{ maxHeight: "260px" }}>
                <AnimatePresence mode="popLayout">
                  {visits.map((visit, i) => (
                    <motion.div
                      key={visit.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <VisitCard entry={visit} isLatest={i === 0 && active} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Footer stat */}
              <div
                className="px-3 py-1.5 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="text-[9px] text-white/20 font-mono">
                  {visits.filter(v => v.kind === "navigate").length} gezinti ·{" "}
                  {visits.filter(v => v.kind === "search").length} arama ·{" "}
                  {visits.filter(v => v.kind === "request").length} istek
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
