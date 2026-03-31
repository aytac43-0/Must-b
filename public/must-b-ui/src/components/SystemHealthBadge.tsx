/**
 * SystemHealthBadge — v1.16.0
 *
 * Live CPU / RAM bars sourced from Ghost Guard via Socket.io.
 * Mounts inside the AppLayout nav pill.
 *
 * Socket events consumed:
 *   'systemStats'   { cpu, ram, liteMode, ts }   — streamed every 3 s
 *   'systemHealth'  { level, kind, message, recommendation, ts }  — on alert
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import { Cpu, AlertTriangle, X }             from "lucide-react";
import { getSocket }                         from "@/lib/socket";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface SystemStats {
  cpu:      number;
  ram:      number;
  liteMode: boolean;
  ts:       number;
}

interface HealthAlert {
  level:          "warning" | "critical" | "info";
  kind:           string;
  message:        string;
  recommendation: string;
  ts:             number;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function barColor(pct: number): string {
  if (pct >= 90) return "#ef4444"; // red-500
  if (pct >= 70) return "#f97316"; // orange-500
  return "#22c55e";                // green-500
}

function levelColor(level: HealthAlert["level"]): string {
  if (level === "critical") return "#ef4444";
  if (level === "warning")  return "#f97316";
  return "#60a5fa"; // info = blue
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function SystemHealthBadge() {
  const [stats,  setStats]  = useState<SystemStats | null>(null);
  const [alert,  setAlert]  = useState<HealthAlert | null>(null);
  const [open,   setOpen]   = useState(false);

  const dismissAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    const sk = getSocket();

    sk.on("systemStats",  (data: SystemStats)  => setStats(data));
    sk.on("systemHealth", (data: HealthAlert)  => {
      setAlert(data);
      setOpen(true);
      // Auto-dismiss info after 6 s; warning after 12 s; critical stays
      if (data.level !== "critical") {
        const delay = data.level === "info" ? 6_000 : 12_000;
        setTimeout(() => setAlert(null), delay);
      }
    });

    return () => {
      sk.off("systemStats");
      sk.off("systemHealth");
    };
  }, []);

  const cpu = stats?.cpu ?? 0;
  const ram = stats?.ram ?? 0;

  return (
    <div className="relative flex items-center">
      {/* ── Compact pill ─────────────────────────────────────────────── */}
      <button
        onClick={() => alert && setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full select-none transition-all"
        style={{
          background: "rgba(26,12,6,0.08)",
          border:     "1px solid rgba(0,0,0,0.08)",
          cursor:     alert ? "pointer" : "default",
        }}
        title={alert ? alert.message : "System Health"}
      >
        {/* Alert pulse OR CPU icon */}
        {alert ? (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
            style={{ background: levelColor(alert.level) }}
          />
        ) : (
          <Cpu size={12} style={{ color: "#ea580c" }} />
        )}

        {/* CPU bar */}
        {stats && (
          <span className="hidden sm:flex items-center gap-1.5">
            {/* CPU */}
            <span className="text-[10px] font-semibold text-black/50">CPU</span>
            <span className="w-10 h-1.5 rounded-full bg-black/10 overflow-hidden flex-shrink-0">
              <span
                className="h-full rounded-full block transition-all duration-700"
                style={{ width: `${cpu}%`, background: barColor(cpu) }}
              />
            </span>
            <span className="text-[10px] font-mono text-black/55 w-7 text-right">{cpu}%</span>

            {/* Divider */}
            <span className="w-px h-3 bg-black/10" />

            {/* RAM */}
            <span className="text-[10px] font-semibold text-black/50">RAM</span>
            <span className="w-10 h-1.5 rounded-full bg-black/10 overflow-hidden flex-shrink-0">
              <span
                className="h-full rounded-full block transition-all duration-700"
                style={{ width: `${ram}%`, background: barColor(ram) }}
              />
            </span>
            <span className="text-[10px] font-mono text-black/55 w-7 text-right">{ram}%</span>

            {/* Lite mode badge */}
            {stats.liteMode && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 ml-1">
                LITE
              </span>
            )}
          </span>
        )}

        {/* No stats yet */}
        {!stats && (
          <span className="text-[11px] font-semibold hidden sm:inline text-black/55">
            System
          </span>
        )}
      </button>

      {/* ── Alert detail popover ─────────────────────────────────────── */}
      <AnimatePresence>
        {open && alert && (
          <motion.div
            key="health-popover"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full right-0 mt-2 w-72 z-[200] rounded-2xl overflow-hidden"
            style={{
              background:    "rgba(20,8,2,0.88)",
              border:        `1px solid ${levelColor(alert.level)}44`,
              backdropFilter:"blur(20px)",
              boxShadow:     `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${levelColor(alert.level)}22`,
            }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-4 pt-3 pb-2"
              style={{ borderBottom: `1px solid ${levelColor(alert.level)}22` }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} style={{ color: levelColor(alert.level) }} />
                <span className="text-[12px] font-bold text-white/90 capitalize">
                  {alert.level} — {alert.kind}
                </span>
              </div>
              <button
                onClick={dismissAlert}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-[13px] text-white/80 leading-relaxed">{alert.message}</p>
              <p className="text-[11px] text-white/45 leading-relaxed italic">
                {alert.recommendation}
              </p>
            </div>

            {/* Timestamp */}
            <div className="px-4 pb-3">
              <span className="text-[10px] text-white/25 font-mono">
                {new Date(alert.ts).toLocaleTimeString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
