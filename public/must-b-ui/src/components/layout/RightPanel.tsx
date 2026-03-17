import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Zap, Crown, Brain, Wrench, BarChart2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/i18n";

interface AgentStatus {
  role:   string;
  tier:   string;
  score:  number;
  model?: string;
  ramGb?: number;
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

export default function RightPanel() {
  const { t } = useI18n();
  const [status, setStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await apiFetch("/api/status");
        if (r.ok) setStatus(await r.json());
      } catch { /* silent — gateway may be starting */ }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  const tier       = status?.tier?.toLowerCase() ?? "worker";
  const tierStyle  = TIER_STYLES[tier] ?? TIER_STYLES.worker;
  const TierIcon   = TIER_ICONS[tier]  ?? Wrench;
  const scorePct   = Math.min(100, Math.round((status?.score ?? 0) * 10));

  return (
    <aside className="w-[220px] h-screen bg-[#090c14]/80 border-l border-white/5 flex flex-col overflow-hidden sticky top-0 backdrop-blur-xl shrink-0">

      {/* Agent Role */}
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
            <span>{status.role}</span>
          </motion.div>
        ) : (
          <div className="h-10 bg-white/4 rounded-xl animate-pulse" />
        )}
      </div>

      {/* Hardware Score */}
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
        {status?.ramGb != null && (
          <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1">
            <BarChart2 size={10} />
            {status.ramGb} GB RAM
          </p>
        )}
      </div>

      {/* Active Model */}
      <div className="p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t.rightPanel.model}
        </p>
        <div className="flex items-start gap-2">
          <Zap size={13} className="text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs font-medium text-gray-300 break-all leading-relaxed">
            {status?.model ?? "—"}
          </p>
        </div>
      </div>

      {/* Live indicator */}
      <div className="mt-auto p-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-[10px] text-gray-600 font-medium">{t.rightPanel.connected}</span>
        </div>
      </div>
    </aside>
  );
}
