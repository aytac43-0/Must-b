/**
 * SystemBootReport — v1.27.0
 *
 * Shown once after onboarding completes (sessionStorage flag "mustb_boot_report").
 * Fetches /api/status and presents a clean system-ready summary in corporate
 * orange + night-blue palette. Auto-dismisses after 14 s or on user click.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import { CheckCircle2, Cpu, MemoryStick, Zap, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const BOOT_REPORT_KEY = "mustb_boot_report";
const AUTO_DISMISS_MS = 14_000;

interface StatusPayload {
  status:   string;
  role:     string;
  model:    string;
  provider: string;
  port:     number;
  cpuPct:   number;
  ramGb:    number;
  liteMode: boolean;
  score:    number;
  tier:     string;
}

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct  = Math.round((value / max) * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f97316" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}

export default function SystemBootReport() {
  const [visible, setVisible] = useState(false);
  const [status,  setStatus]  = useState<StatusPayload | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    sessionStorage.removeItem(BOOT_REPORT_KEY);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(BOOT_REPORT_KEY) !== "1") return;
    setVisible(true);

    apiFetch("/api/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: StatusPayload | null) => { if (d) setStatus(d); })
      .catch(() => {});

    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [dismiss]);

  const channels = [
    process.env.CHANNEL_TELEGRAM_ENABLED && "Telegram",
    process.env.CHANNEL_DISCORD_ENABLED  && "Discord",
    process.env.CHANNEL_SLACK_ENABLED    && "Slack",
    process.env.CHANNEL_WHATSAPP_ENABLED && "WhatsApp",
  ].filter(Boolean);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot-report"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{   opacity: 0, scale: 0.96,  y: 16 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background:    "rgba(14,6,2,0.92)",
              border:        "1px solid rgba(234,88,12,0.30)",
              boxShadow:     "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(234,88,12,0.10)",
              backdropFilter:"blur(24px)",
            }}
          >
            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-white/25 hover:text-white/60 transition-colors z-10"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.25)" }}
              >
                <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white/90">System Ready</p>
                <p className="text-[11px] text-white/40">Must-b initialised successfully</p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 20px" }} />

            {/* Stats */}
            <div className="px-5 py-4 space-y-3">

              {/* Agent + Model */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-white/30 mb-1">Agent</p>
                  <p className="text-[12px] font-semibold text-white/80 truncate">
                    {status?.role ?? "—"}
                  </p>
                </div>
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-white/30 mb-1">Model</p>
                  <p className="text-[12px] font-semibold text-white/80 truncate">
                    {status?.model ?? "—"}
                  </p>
                </div>
              </div>

              {/* CPU / RAM */}
              <div
                className="rounded-xl px-3 py-2.5 space-y-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
                    <Cpu size={10} /> CPU
                  </span>
                  <span className="text-[10px] font-mono text-white/50">{status?.cpuPct ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
                    <MemoryStick size={10} /> RAM
                  </span>
                  <span className="text-[10px] font-mono text-white/50">{(status?.ramGb ?? 0).toFixed(2)} GB</span>
                </div>
                {status && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
                      <Zap size={10} /> Score
                    </span>
                    <ScoreBar value={status.score} />
                  </div>
                )}
              </div>

              {/* Port */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-white/30">Dashboard port</span>
                <span className="text-[11px] font-mono text-orange-400/70">
                  :{status?.port ?? 4309}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 pb-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}
            >
              <button
                onClick={dismiss}
                className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: "rgba(234,88,12,0.15)",
                  border:     "1px solid rgba(234,88,12,0.30)",
                  color:      "#fb923c",
                }}
              >
                Open Dashboard
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
              style={{
                position:        "absolute",
                bottom:          0,
                left:            0,
                right:           0,
                height:          2,
                background:      "rgba(234,88,12,0.50)",
                transformOrigin: "left",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
