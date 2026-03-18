/**
 * RightPanel — Hierarchy Dashboard (v4.3)
 *
 * Sections:
 *  1. Agent Role   — rank badge (Master/Planner/Worker) with animated icon
 *  2. Hardware     — Ollama score bar + RAM + GPU hint
 *  3. Active Model — current Ollama model name
 *  4. Model Roster — top models available in Ollama (from /api/models)
 *  5. Live indicator
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Zap, Crown, Brain, Wrench, BarChart2, Database, CheckCircle2, Smartphone, Ghost, Loader2, Layers, Activity, Puzzle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n }  from "@/i18n";
import QRPairingModal from "@/components/QRPairingModal";

interface AgentStatus {
  role:   string;
  tier:   string;
  score:  number;
  model?: string;
  ramGb?: number;
  gpu?:   string;
}

interface OllamaModel {
  name:        string;
  size:        number;
  modified_at: string;
}

const TIER_STYLES: Record<string, string> = {
  master:  "text-amber-400 bg-amber-400/10 border-amber-400/25",
  planner: "text-blue-400  bg-blue-400/10  border-blue-400/25",
  worker:  "text-green-400 bg-green-400/10 border-green-400/25",
};

const TIER_ICONS: Record<string, React.ElementType> = {
  master:  Crown,
  planner: Brain,
  worker:  Wrench,
};

const TIER_DESC: Record<string, string> = {
  master:  "Full autonomy",
  planner: "Plan & delegate",
  worker:  "Execute tasks",
};

function fmtModelSize(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_048_576).toFixed(0)} MB`;
}

function shortModel(name: string): string {
  // Remove registry prefix and tag for display: "llama3:8b" → "Llama 3 8B"
  return name
    .replace(/^[^/]+\//, "")      // drop registry prefix
    .replace(/[-_]/g, " ")         // underscores/dashes → spaces
    .replace(/\b(\w)/g, c => c.toUpperCase()) // title-case
    .replace(/:(\w+)$/, " $1")    // "Model:tag" → "Model tag"
    .trim();
}

export default function RightPanel() {
  const { t } = useI18n();
  const [status,       setStatus]       = useState<AgentStatus | null>(null);
  const [models,       setModels]       = useState<OllamaModel[]>([]);
  const [showQR,       setShowQR]       = useState(false);
  const [shadowOn,     setShadowOn]     = useState(false);
  const [shadowBusy,   setShadowBusy]   = useState(false);
  // Parallel ghost slots (v4.9) — lazy init for stable arrays
  const [ghostSlots,   setGhostSlots]   = useState<boolean[]>(() => [false, false, false]);
  const [ghostBusy,    setGhostBusy]    = useState<boolean[]>(() => [false, false, false]);
  // Tone observer (v4.9)
  const [tone, setTone] = useState<{ tone: string; score: number; badgeClass: string; badgeLabel: string } | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const r = await apiFetch("/api/status");
        if (r.ok) setStatus(await r.json());
      } catch { /* silent */ }
    };
    const loadModels = async () => {
      try {
        const r = await apiFetch("/api/models");
        if (r.ok) {
          const d = await r.json() as { models: OllamaModel[] };
          setModels((d.models ?? []).slice(0, 5));
        }
      } catch { /* silent — Ollama may not be running */ }
    };

    loadStatus(); loadModels();

    // Load ghost slot status (v4.9)
    apiFetch("/api/ghost/status").then(async r => {
      if (r.ok) {
        const d = await r.json() as { pool: { slot: number; enabled: boolean }[] };
        setGhostSlots(d.pool.map(g => g.enabled));
      }
    }).catch(() => {});

    const iv = setInterval(() => { loadStatus(); loadModels(); }, 20_000);
    return () => clearInterval(iv);
  }, []);

  // Listen for tone changes via socket.io agentUpdate
  useEffect(() => {
    const handler = (ev: CustomEvent) => {
      try {
        const d = ev.detail;
        if (
          d != null &&
          typeof d === "object" &&
          d.type === "toneChange" &&
          typeof d.tone === "string" &&
          d.tone !== "normal"
        ) {
          setTone({
            tone:       String(d.tone),
            score:      typeof d.score === "number" ? d.score : 0,
            badgeClass: typeof d.theme?.badgeClass === "string" ? d.theme.badgeClass : "",
            badgeLabel: typeof d.theme?.badgeLabel === "string" ? d.theme.badgeLabel : String(d.tone),
          });
          setTimeout(() => setTone(null), 8000);
        }
      } catch { /* ignore malformed events */ }
    };
    window.addEventListener("mustb:agentUpdate" as any, handler as EventListener);
    return () => window.removeEventListener("mustb:agentUpdate" as any, handler as EventListener);
  }, []);

  const tier      = status?.tier?.toLowerCase() ?? "worker";
  const tierStyle = TIER_STYLES[tier] ?? TIER_STYLES.worker;
  const TierIcon  = TIER_ICONS[tier]  ?? Wrench;
  const scorePct  = Math.min(100, Math.round((status?.score ?? 0) * 10));

  return (
    <aside className="w-[220px] h-screen bg-[#090c14]/80 border-l border-white/5 flex flex-col overflow-hidden sticky top-0 backdrop-blur-xl shrink-0">

      {/* ── Agent Role ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-white/5">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t.rightPanel.agentRole}
        </p>
        {status ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold ${tierStyle}`}
          >
            <TierIcon size={14} />
            <div className="min-w-0">
              <p className="leading-none">{status.role}</p>
              <p className="text-[9px] font-normal opacity-60 mt-0.5 leading-none">
                {TIER_DESC[tier] ?? ""}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="h-12 bg-white/4 rounded-xl animate-pulse" />
        )}
      </div>

      {/* ── Hardware Score ──────────────────────────────────────────────── */}
      <div className="p-4 border-b border-white/5">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t.rightPanel.hardware}
        </p>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
            <Cpu size={11} className="text-orange-400" />
            Score
          </div>
          <span className="text-orange-400 font-bold text-xs tabular-nums">
            {status?.score?.toFixed(2) ?? "—"}
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-600 to-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${scorePct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
        <div className="flex flex-col gap-0.5 mt-2">
          {status?.ramGb != null && (
            <p className="text-[10px] text-gray-600 flex items-center gap-1">
              <BarChart2 size={9} /> {status.ramGb} GB RAM
            </p>
          )}
          {status?.gpu && (
            <p className="text-[10px] text-gray-600 flex items-center gap-1 truncate">
              <Zap size={9} /> {status.gpu}
            </p>
          )}
        </div>
      </div>

      {/* ── Active Model ────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-white/5">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t.rightPanel.model}
        </p>
        <div className="flex items-start gap-2">
          <Zap size={13} className="text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs font-medium text-gray-300 break-all leading-relaxed">
            {status?.model ? shortModel(status.model) : "—"}
          </p>
        </div>
      </div>

      {/* ── Model Roster ────────────────────────────────────────────────── */}
      <div className="p-4 flex-1 overflow-hidden">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Database size={9} className="text-gray-600" />
          Available Models
        </p>

        <AnimatePresence>
          {models.length === 0 ? (
            <p className="text-[10px] text-gray-700">Ollama not detected</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto scrollbar-hide">
              {models.map((m, i) => {
                const isActive = status?.model && m.name.startsWith(status.model.split(":")[0]);
                return (
                  <motion.div
                    key={m.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] transition-colors ${
                      isActive
                        ? "bg-orange-500/10 border border-orange-500/20"
                        : "bg-white/2 border border-white/4"
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 size={10} className="text-orange-400 shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium leading-none truncate ${isActive ? "text-orange-300" : "text-gray-400"}`}>
                        {shortModel(m.name)}
                      </p>
                      <p className="text-[9px] text-gray-700 mt-0.5">{fmtModelSize(m.size)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Shadow Mode Toggle (v4.8) ───────────────────────────────────── */}
      <div className="px-4 pb-3 border-b border-white/5">
        <button
          onClick={async () => {
            setShadowBusy(true);
            try {
              const next = !shadowOn;
              const r = await apiFetch("/api/shadow/toggle", {
                method: "POST",
                body:   JSON.stringify({ enabled: next }),
              });
              if (r.ok) setShadowOn(next);
            } catch { /* silent */ }
            setShadowBusy(false);
          }}
          disabled={shadowBusy}
          className={`w-full flex items-center justify-between gap-2 py-2 px-3 rounded-xl border text-[11px] font-semibold transition-all ${
            shadowOn
              ? "bg-purple-500/12 border-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.12)]"
              : "bg-white/4 border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/8"
          } disabled:opacity-50`}
          title="Toggle Shadow Mode — routes input to a headless browser"
        >
          <div className="flex items-center gap-1.5">
            {shadowBusy
              ? <Loader2 size={12} className="animate-spin" />
              : <Ghost size={12} className={shadowOn ? "animate-pulse" : ""} />}
            Shadow Mode
          </div>
          {/* Toggle pill */}
          <div className={`w-8 h-4 rounded-full border transition-all relative ${
            shadowOn ? "bg-purple-500/40 border-purple-500/50" : "bg-white/8 border-white/10"
          }`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
              shadowOn ? "left-4 bg-purple-400" : "left-0.5 bg-gray-600"
            }`} />
          </div>
        </button>
      </div>

      {/* ── Parallel Ghost Slots (v4.9) ─────────────────────────────────── */}
      <div className="px-4 pb-3 border-b border-white/5">
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1">
          <Layers size={8} /> Ghost Slots
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((slot) => (
            <button
              key={slot}
              disabled={ghostBusy[slot]}
              onClick={async () => {
                const next = !ghostSlots[slot];
                setGhostBusy(b => { const c = [...b]; c[slot] = true; return c; });
                try {
                  const r = await apiFetch("/api/ghost/toggle", {
                    method: "POST",
                    body: JSON.stringify({ slot, enabled: next }),
                  });
                  if (r.ok) setGhostSlots(s => { const c = [...s]; c[slot] = next; return c; });
                } catch { /* silent */ }
                setGhostBusy(b => { const c = [...b]; c[slot] = false; return c; });
              }}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                ghostSlots[slot]
                  ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                  : "bg-white/4 border-white/8 text-gray-600 hover:text-gray-400"
              } disabled:opacity-40`}
              title={`Ghost ${slot + 1} — ${ghostSlots[slot] ? "active" : "inactive"}`}
            >
              {ghostBusy[slot]
                ? <Loader2 size={9} className="animate-spin" />
                : <Ghost size={9} className={ghostSlots[slot] ? "animate-pulse" : ""} />}
              G{slot + 1}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tone Observer (v4.9) ────────────────────────────────────────── */}
      {tone && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2"
          >
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${tone.badgeClass}`}>
              <Activity size={9} className="animate-pulse" />
              {tone.badgeLabel}
              <span className="ml-auto text-[9px] opacity-60">{Math.round(tone.score * 100)}%</span>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Connect Mobile ──────────────────────────────────────────────── */}
      <div className="px-4 pb-3 border-b border-white/5">
        <button
          onClick={() => setShowQR(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-500/8 border border-orange-500/18 text-orange-400 text-[11px] font-semibold hover:bg-orange-500/15 hover:border-orange-500/30 transition-all"
        >
          <Smartphone size={12} />
          Connect Mobile
        </button>
      </div>

      {/* ── Live indicator ──────────────────────────────────────────────── */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-[10px] text-gray-600 font-medium">{t.rightPanel.connected}</span>
        </div>
      </div>

      {/* QR Pairing Modal */}
      {showQR && <QRPairingModal onClose={() => setShowQR(false)} />}
    </aside>
  );
}
