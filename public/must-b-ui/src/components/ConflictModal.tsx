/**
 * ConflictModal
 *
 * Listens for Socket.IO 'agentUpdate' events with type 'CONFLICT_DETECTED'.
 * When a conflict is detected between the local agent (e.g. "Alex") and the
 * cloud agent (e.g. "Max"), this modal surfaces three resolution options:
 *
 *   1. "Create New Agent"    → duplicate  (keep local, copy cloud to cloud-restore/)
 *   2. "Use Cloud (Overwrite)" → restore  (cloud wins, overwrite local)
 *   3. "Keep Mine"           → upload     (local wins, overwrite cloud)
 *
 * Posts the decision to POST /api/setup/sync-resolve and closes when resolved.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, GitMerge, CloudDownload, Shield, Loader2 } from "lucide-react";
import { getSocket } from "@/lib/socket";

interface ConflictData {
  localAgentName:  string | null;
  cloudAgentName:  string | null;
  localMtime:      string | null;
  cloudTimestamp:  string | null;
}

type Decision = "upload" | "restore" | "duplicate";

interface Option {
  decision:    Decision;
  label:       string;
  sublabel:    string;
  icon:        React.ElementType;
  accent:      string;
}

const OPTIONS: Option[] = [
  {
    decision: "duplicate",
    label:    "Create New Agent",
    sublabel: "Keep both — cloud data is copied to a separate folder",
    icon:     GitMerge,
    accent:   "border-blue-500/30 bg-blue-500/8 hover:border-blue-500/50 text-blue-400",
  },
  {
    decision: "restore",
    label:    "Use Cloud (Overwrite)",
    sublabel: "Cloud wins — local memory is replaced with cloud version",
    icon:     CloudDownload,
    accent:   "border-orange-500/30 bg-orange-500/8 hover:border-orange-500/50 text-orange-400",
  },
  {
    decision: "upload",
    label:    "Keep Mine",
    sublabel: "Local wins — cloud memory is overwritten with local data",
    icon:     Shield,
    accent:   "border-green-500/30 bg-green-500/8 hover:border-green-500/50 text-green-400",
  },
];

export default function ConflictModal() {
  const [conflict, setConflict]   = useState<ConflictData | null>(null);
  const [resolving, setResolving] = useState(false);
  const [done, setDone]           = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handler = (update: { type: string } & Partial<ConflictData>) => {
      if (update.type === "CONFLICT_DETECTED") {
        setConflict({
          localAgentName:  update.localAgentName  ?? null,
          cloudAgentName:  update.cloudAgentName  ?? null,
          localMtime:      update.localMtime       ?? null,
          cloudTimestamp:  update.cloudTimestamp   ?? null,
        });
        setDone(false);
      }
      if (update.type === "syncResolveFinish") {
        setDone(true);
        setTimeout(() => { setConflict(null); setDone(false); }, 1800);
      }
    };

    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, []);

  const resolve = async (decision: Decision) => {
    if (resolving) return;
    setResolving(true);
    try {
      await fetch("/api/setup/sync-resolve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decision }),
      });
    } catch { /* handled via socket event */ }
    setResolving(false);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  return (
    <AnimatePresence>
      {conflict && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md bg-[#0c0f18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/8 bg-amber-500/5">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Memory Conflict Detected</h2>
                <p className="text-gray-500 text-xs mt-0.5">Two agent identities found — action required</p>
              </div>
            </div>

            {/* Agent comparison */}
            <div className="grid grid-cols-2 gap-3 px-6 pt-5 pb-2">
              <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Local Agent</p>
                <p className="text-white font-bold text-sm">{conflict.localAgentName ?? "—"}</p>
                <p className="text-gray-600 text-[10px] mt-1">{formatDate(conflict.localMtime)}</p>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                <p className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest mb-1">Cloud Agent</p>
                <p className="text-orange-300 font-bold text-sm">{conflict.cloudAgentName ?? "—"}</p>
                <p className="text-orange-400/40 text-[10px] mt-1">{formatDate(conflict.cloudTimestamp)}</p>
              </div>
            </div>

            {/* Options */}
            <div className="px-6 py-4 space-y-2">
              {done ? (
                <div className="flex items-center justify-center gap-2 py-6 text-green-400 text-sm font-semibold">
                  <span className="w-4 h-4 rounded-full border-2 border-green-400 flex items-center justify-center text-[10px]">✓</span>
                  Conflict resolved
                </div>
              ) : (
                OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.decision}
                      onClick={() => resolve(opt.decision)}
                      disabled={resolving}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${opt.accent}`}
                    >
                      {resolving ? (
                        <Loader2 size={16} className="animate-spin flex-shrink-0" />
                      ) : (
                        <Icon size={16} className="flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-sm text-white">{opt.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{opt.sublabel}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-6 pb-5 pt-1">
              <p className="text-[10px] text-gray-700 text-center">
                This action cannot be undone · If unsure, choose "Create New Agent" first
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
