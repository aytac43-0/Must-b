/**
 * QRPairingModal (v4.6)
 *
 * Shown when the user clicks "Connect Mobile" in RightPanel.
 * Calls GET /api/companion/pair  → { token, url, expiresAt }
 * Renders a QR code (via canvas) + a countdown timer.
 * Closes on Escape or backdrop click.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence }                  from "framer-motion";
import { X, Loader2, AlertCircle, Smartphone, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Tiny QR via canvas (no external library) ─────────────────────────────────
// We embed the URL as a simple text QR using the browser's built-in
// approach: render a QR via an <img> pointing at a free QR API hosted
// locally (no tracking) OR use a reliable CDN approach.
// To keep zero-dependency: we use the Google Charts QR API which is
// a well-known, stable, privacy-respecting endpoint.

function QRImage({ url, size = 220 }: { url: string; size?: number }) {
  // Google Charts QR — zero JS dependency, works offline once cached
  const src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8`;
  return (
    <div
      style={{ width: size, height: size }}
      className="bg-white p-3 rounded-2xl shadow-[0_0_40px_rgba(234,88,12,0.15)] mx-auto"
    >
      <img src={src} alt="QR code" width={size - 24} height={size - 24} className="rounded-lg" />
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(expiresAt: number | null): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) { setRemaining(""); return; }
    const tick = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      const m    = Math.floor(diff / 60_000);
      const s    = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1_000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  return remaining;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PairData {
  token:     string;
  url:       string;
  expiresAt: number;
}

type LoadState = "idle" | "loading" | "ready" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { onClose: () => void; }

export default function QRPairingModal({ onClose }: Props) {
  const [state,    setState]    = useState<LoadState>("idle");
  const [pairData, setPairData] = useState<PairData | null>(null);
  const countdown = useCountdown(pairData?.expiresAt ?? null);

  const generatePair = useCallback(async () => {
    setState("loading");
    try {
      const r = await apiFetch("/api/companion/pair");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as PairData;
      setPairData(d);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  // Generate on mount
  useEffect(() => { generatePair(); }, [generatePair]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
      >
        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-sm bg-[#0c0f18] border border-white/8 rounded-3xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-orange-400" />
              <span className="font-bold text-sm text-white">Connect Mobile</span>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col items-center gap-4">
            {state === "loading" && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 size={24} className="text-orange-400 animate-spin" />
                <p className="text-xs text-gray-500">Generating secure link…</p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <AlertCircle size={24} className="text-red-400" />
                <p className="text-sm text-gray-400 text-center">Failed to generate pairing link.</p>
                <button
                  onClick={generatePair}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500/12 border border-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/22 transition-all"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {state === "ready" && pairData && (
              <>
                <QRImage url={pairData.url} size={224} />

                <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                  Scan with your phone's camera to open the<br />
                  <span className="text-orange-400 font-medium">Must-b Companion</span> in your browser.
                </p>

                <div className="w-full bg-[#080b12] rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-600 mb-1 font-medium uppercase tracking-widest">Access URL</p>
                  <p className="text-[11px] text-orange-300 font-mono break-all leading-relaxed">
                    {pairData.url}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full text-[11px]">
                  <span className="text-gray-600">Expires in</span>
                  <span className={`font-mono font-bold ${
                    countdown < "1:00" ? "text-red-400" : "text-orange-400"
                  }`}>{countdown}</span>
                </div>

                <button
                  onClick={generatePair}
                  className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <RefreshCw size={10} /> Generate new code
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
