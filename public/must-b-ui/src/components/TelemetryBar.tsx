/**
 * TelemetryBar — Real-Time Dashboard Telemetry Strip  v1.0
 *
 * Pinned to the top of DashboardPage. Sources:
 *   - CPU / RAM / liteMode  ← Socket.io 'systemStats' (GhostGuard, every 3s)
 *   - Active model          ← /api/system/status (on mount)
 *   - Coordinator mode      ← Socket.io 'coordinatorTask' events
 *
 * Design: dark glassmorphism, minimal height, no layout shift.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { Cpu, Brain, Zap, Radio }       from "lucide-react";
import { getSocket }                    from "@/lib/socket";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SystemStats {
  cpu:      number;
  ram:      number;
  liteMode: boolean;
  ts:       number;
}

interface CoordTask {
  phase:  string;
  status: string;
  description?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MiniBar({ pct }: { pct: number }) {
  const color =
    pct >= 90 ? "#ef4444" :
    pct >= 70 ? "#f97316" :
                "#22c55e";
  return (
    <span className="w-14 h-1 rounded-full bg-white/10 overflow-hidden inline-flex flex-shrink-0 align-middle">
      <span
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TelemetryBar() {
  const [stats,      setStats]      = useState<SystemStats | null>(null);
  const [model,      setModel]      = useState<string>("");
  const [provider,   setProvider]   = useState<string>("");
  const [coordPhase, setCoordPhase] = useState<string | null>(null);
  const coordTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sk = getSocket();

    sk.on("systemStats", (d: SystemStats) => setStats(d));

    // Coordinator phase events — show for 4s then clear
    sk.on("coordinatorTask", (d: CoordTask) => {
      if (d.status === "started" || d.status === "running") {
        setCoordPhase(d.phase);
        if (coordTimer.current) clearTimeout(coordTimer.current);
      } else if (d.status === "completed" || d.status === "failed") {
        setCoordPhase(d.phase + " ✓");
        coordTimer.current = setTimeout(() => setCoordPhase(null), 4_000);
      }
    });

    // Fetch current model once on mount
    fetch("/api/system/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (!d) return;
        setModel(d.activeModel ?? d.model ?? "");
        setProvider(d.provider ?? "");
      })
      .catch(() => {});

    return () => {
      sk.off("systemStats");
      sk.off("coordinatorTask");
      if (coordTimer.current) clearTimeout(coordTimer.current);
    };
  }, []);

  // Don't render until we have at least some data
  if (!stats && !model) return null;

  const cpu = stats?.cpu ?? 0;
  const ram = stats?.ram ?? 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-medium select-none overflow-hidden"
      style={{
        background:    "rgba(8,3,1,0.72)",
        borderBottom:  "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(16px)",
        minHeight:      "28px",
      }}
    >
      {/* ── CPU ──────────────────────────────────────────────────────── */}
      {stats && (
        <span className="flex items-center gap-1.5 text-gray-500">
          <Cpu size={9} className="text-orange-400 flex-shrink-0" />
          <span className="text-gray-600 font-bold">CPU</span>
          <MiniBar pct={cpu} />
          <span className="font-mono text-gray-500 w-6 text-right">{cpu}%</span>
        </span>
      )}

      {/* ── RAM ──────────────────────────────────────────────────────── */}
      {stats && (
        <span className="flex items-center gap-1.5 text-gray-500">
          <span className="text-gray-600 font-bold">RAM</span>
          <MiniBar pct={ram} />
          <span className="font-mono text-gray-500 w-6 text-right">{ram}%</span>
        </span>
      )}

      {/* ── Divider ──────────────────────────────────────────────────── */}
      {(stats && model) && (
        <span className="w-px h-3 bg-white/8 flex-shrink-0" />
      )}

      {/* ── Active model ─────────────────────────────────────────────── */}
      {model && (
        <span className="flex items-center gap-1.5 text-gray-600 min-w-0">
          <Brain size={9} className="text-purple-400 flex-shrink-0" />
          {provider && (
            <span className="text-gray-700 uppercase tracking-widest text-[9px] flex-shrink-0">
              {provider}
            </span>
          )}
          <span className="text-gray-500 truncate max-w-[200px]">{model}</span>
        </span>
      )}

      {/* ── Coordinator badge ─────────────────────────────────────────── */}
      <AnimatePresence>
        {coordPhase && (
          <motion.span
            key="coord"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa" }}
          >
            <Radio size={7} />
            COORDINATOR · {coordPhase.toUpperCase()}
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Lite mode badge ───────────────────────────────────────────── */}
      {stats?.liteMode && (
        <span
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
          style={{ background: "rgba(234,88,12,0.18)", color: "#fb923c" }}
        >
          <Zap size={7} />
          LITE
        </span>
      )}
    </div>
  );
}
