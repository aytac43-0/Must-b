/**
 * LiveBrowserView — v1.17.0
 *
 * Floating Picture-in-Picture window that streams the Must-b headless browser.
 * Auto-shows when browser is active, auto-hides 6 s after the last frame.
 *
 * Socket events consumed (all under 'agentUpdate'):
 *   shadowFrame  { base64, timestamp }           — primary shadow JPEG (500 ms)
 *   ghostFrame   { base64, timestamp, slot }      — parallel ghost slots
 *   shadowToggle { enabled, slot? }               — on / off signal
 *   ghostNav     { url, slot }                    — ghost slot navigation
 *   stepStart    { step: { description, tool? } } — action label
 *   stepFinish   { step: { description } }        — clears action label
 *   planFinish   {}                               — session end → hide
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence }                   from "framer-motion";
import { Globe, X, Minus, Maximize2, Loader2 }       from "lucide-react";
import { getSocket }                                  from "@/lib/socket";

/* ── Constants ──────────────────────────────────────────────────────────── */
const IDLE_TIMEOUT_MS = 6_000;   // hide after 6 s with no frame
const URL_RE          = /https?:\/\/[^\s"'>)]+/;
const BROWSER_TOOLS   = new Set([
  "browser_navigate", "browser_click", "browser_type",
  "browser_scroll", "browser_wait", "browser_perceive",
  "browser_extract", "browser_snapshot", "browser_screenshot",
  "web_fetch", "web-fetch", "web-search",
]);

/* ── Helpers ────────────────────────────────────────────────────────────── */
function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[.,;)]+$/, "") : null;
}

function shortenUrl(url: string, max = 52): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.length > 1 ? u.pathname : "";
    const full = host + path;
    return full.length > max ? full.slice(0, max - 1) + "…" : full;
  } catch {
    return url.length > max ? url.slice(0, max - 1) + "…" : url;
  }
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function LiveBrowserView() {
  const [frame,      setFrame]      = useState<string | null>(null);
  const [visible,    setVisible]    = useState(false);
  const [minimized,  setMinimized]  = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [action,     setAction]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShadow    = useRef(false);

  /* ── Idle timer management ─────────────────────────────────────────── */
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setVisible(false);
      setFrame(null);
      setCurrentUrl(null);
      setAction(null);
      hasShadow.current = false;
    }, IDLE_TIMEOUT_MS);
  }, []);

  /* ── Socket listener ───────────────────────────────────────────────── */
  useEffect(() => {
    const sk = getSocket();

    const handler = (data: { type: string } & Record<string, unknown>) => {
      /* Browser frame — show & refresh idle timer */
      if (
        (data.type === "shadowFrame" && typeof data.slot !== "number") ||
        data.type === "ghostFrame"
      ) {
        const b64 = data.base64 as string | undefined;
        if (!b64) return;
        setFrame(b64);
        setLoading(false);
        if (!hasShadow.current) {
          hasShadow.current = true;
          setVisible(true);
          setMinimized(false);
        }
        resetIdle();
        return;
      }

      /* Toggle off */
      if (data.type === "shadowToggle") {
        if (!(data.enabled as boolean) && typeof data.slot !== "number") {
          setVisible(false);
          setFrame(null);
          setCurrentUrl(null);
          setAction(null);
          hasShadow.current = false;
          if (idleTimer.current) clearTimeout(idleTimer.current);
        } else if (data.enabled && typeof data.slot !== "number") {
          setLoading(true);
          setVisible(true);
          setMinimized(false);
          hasShadow.current = true;
        }
        return;
      }

      /* Navigation URL (ghost slots) */
      if (data.type === "ghostNav") {
        const url = data.url as string | undefined;
        if (url && url !== "about:blank") setCurrentUrl(url);
        return;
      }

      /* Step start — parse action + URL from description */
      if (data.type === "stepStart") {
        const step = data.step as { description?: string; tool?: string } | undefined;
        const desc = step?.description ?? "";
        const tool = step?.tool ?? "";
        if (BROWSER_TOOLS.has(tool) || /navigate|click|type|browse|fetch|search/i.test(desc)) {
          const label = desc.length > 72 ? desc.slice(0, 71) + "…" : desc;
          setAction(label);
          const found = extractUrl(desc);
          if (found) setCurrentUrl(found);
        }
        return;
      }

      /* Step finish — clear action */
      if (data.type === "stepFinish") {
        setAction(null);
        return;
      }

      /* Plan finish — start idle countdown */
      if (data.type === "planFinish") {
        setAction(null);
        resetIdle();
        return;
      }
    };

    sk.on("agentUpdate", handler);
    return () => {
      sk.off("agentUpdate", handler);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="live-browser-pip"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-6 left-5 z-[140] flex flex-col"
          style={{
            width:         minimized ? "auto" : "320px",
            pointerEvents: "auto",
          }}
        >
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              background:    "rgba(10,4,1,0.88)",
              border:        "1px solid rgba(249,115,22,0.28)",
              backdropFilter:"blur(24px) saturate(180%)",
              boxShadow:     "0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(249,115,22,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* ── Title bar ──────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-3 py-2 select-none flex-shrink-0"
              style={{ borderBottom: minimized ? "none" : "1px solid rgba(249,115,22,0.12)" }}
            >
              <div className="flex items-center gap-2">
                {/* Pulsing active dot */}
                <span className="relative flex-shrink-0">
                  <span className="block w-2 h-2 rounded-full bg-orange-500" />
                  <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-60" />
                </span>
                <Globe size={11} className="text-orange-400/70" />
                <span className="text-[11px] font-semibold text-white/70 tracking-wide">
                  Live Browser
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(v => !v)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/8 transition-all"
                  title={minimized ? "Expand" : "Minimize"}
                >
                  {minimized ? <Maximize2 size={10} /> : <Minus size={10} />}
                </button>
                <button
                  onClick={() => { setVisible(false); hasShadow.current = false; }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/8 transition-all"
                  title="Close"
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* ── Content (hidden when minimized) ───────────────────── */}
            <AnimatePresence>
              {!minimized && (
                <motion.div
                  key="pip-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  {/* Screenshot area — 16:10 aspect ratio (1280×800) */}
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ aspectRatio: "16 / 10", background: "#08030100" }}
                  >
                    {loading && !frame ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={20} className="text-orange-400/50 animate-spin" />
                      </div>
                    ) : frame ? (
                      <img
                        src={`data:image/jpeg;base64,${frame}`}
                        alt="Browser preview"
                        className="w-full h-full object-cover"
                        style={{ imageRendering: "auto" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <Globe size={22} className="text-orange-400/20" />
                        <span className="text-[11px] text-white/20">Tarayıcı bekleniyor…</span>
                      </div>
                    )}

                    {/* Scan line overlay for active feel */}
                    {frame && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
                        }}
                      />
                    )}
                  </div>

                  {/* ── URL bar ────────────────────────────────────────── */}
                  {currentUrl && (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5"
                      style={{ borderTop: "1px solid rgba(249,115,22,0.10)" }}
                    >
                      <Globe size={9} className="text-orange-400/40 flex-shrink-0" />
                      <span className="text-[10px] font-mono text-white/40 truncate flex-1">
                        {shortenUrl(currentUrl)}
                      </span>
                    </div>
                  )}

                  {/* ── Action bar ─────────────────────────────────────── */}
                  <AnimatePresence>
                    {action && (
                      <motion.div
                        key="action-bar"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="px-3 py-2 flex items-start gap-2"
                        style={{ borderTop: "1px solid rgba(249,115,22,0.08)" }}
                      >
                        {/* Animated loading dots */}
                        <div className="flex items-center gap-0.5 mt-1 flex-shrink-0">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="block w-1 h-1 rounded-full bg-orange-400/60 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <p className="text-[10.5px] text-white/50 leading-snug line-clamp-2">
                          {action}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
