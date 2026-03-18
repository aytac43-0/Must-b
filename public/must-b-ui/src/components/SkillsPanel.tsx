/**
 * SkillsPanel — Skill Library (v4.5)
 *
 * Lists all saved skills from /api/skills/list.
 * Each card shows: name, goal preview, step count, run count, last run.
 * "Run" button → POST /api/skills/run → orchestrator replays the goal.
 * "Delete" button → DELETE /api/skills/:id.
 *
 * Also listens for skillRunStart socket event to show a live running indicator.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import {
  Zap, Trash2, Play, RefreshCw, BookOpen,
  Clock, BarChart2, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { apiFetch }  from "@/lib/api";
import { getSocket } from "@/lib/socket";

interface SkillStep {
  description: string;
  tool?:       string;
}

interface SavedSkill {
  id:         string;
  name:       string;
  goal:       string;
  answer:     string;
  steps:      SkillStep[];
  tags:       string[];
  savedAt:    string;
  runCount:   number;
  lastRunAt?: string;
}

type RunState = "idle" | "running" | "done" | "error";

function fmtDate(iso: string | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SkillsPanel() {
  const [skills,      setSkills]      = useState<SavedSkill[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [runningId,   setRunningId]   = useState<string | null>(null);
  const [runState,    setRunState]    = useState<RunState>("idle");
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/skills/list");
      if (r.ok) {
        const d = await r.json() as { skills: SavedSkill[] };
        setSkills(d.skills ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // Listen for skillRunStart / planFinish to update running state
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { type: string; skillId?: string }) => {
      if (data.type === "skillRunStart" && data.skillId) {
        setRunningId(data.skillId);
        setRunState("running");
      }
      if (data.type === "planFinish") {
        setRunState(data.type === "planFinish" ? "done" : "idle");
        setRunningId(null);
        // Refresh run count after completion
        loadSkills();
        setTimeout(() => setRunState("idle"), 2500);
      }
    };
    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, [loadSkills]);

  const runSkill = async (skill: SavedSkill) => {
    if (runningId) return; // only one at a time
    setRunningId(skill.id);
    setRunState("running");
    try {
      const r = await apiFetch("/api/skills/run", {
        method: "POST",
        body:   JSON.stringify({ id: skill.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // State updates will come via socket agentUpdate events
    } catch {
      setRunState("error");
      setRunningId(null);
      setTimeout(() => setRunState("idle"), 3000);
    }
  };

  const deleteSkill = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/skills/${id}`, { method: "DELETE" });
      setSkills(prev => prev.filter(s => s.id !== id));
    } catch { /* silent */ }
    setDeletingId(null);
    setConfirmDel(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#080b12]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-orange-400" />
          <span className="text-[13px] font-bold text-gray-300">Skill Library</span>
          {skills.length > 0 && (
            <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full font-mono">
              {skills.length}
            </span>
          )}
        </div>
        <button
          onClick={loadSkills}
          disabled={loading}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Run status banner */}
      <AnimatePresence>
        {runState !== "idle" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`px-6 py-2 border-b flex items-center gap-2 text-xs font-medium ${
              runState === "running" ? "bg-orange-500/8 border-orange-500/15 text-orange-400" :
              runState === "done"    ? "bg-green-500/8  border-green-500/15  text-green-400"  :
                                      "bg-red-500/8    border-red-500/15    text-red-400"
            }`}
          >
            {runState === "running" && <Loader2 size={12} className="animate-spin" />}
            {runState === "done"    && <CheckCircle2 size={12} />}
            {runState === "error"   && <AlertCircle size={12} />}
            {runState === "running" ? "Running skill…" :
             runState === "done"    ? "Skill completed" :
                                     "Skill run failed"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
        {loading && skills.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-700 text-xs gap-2">
            <Loader2 size={13} className="animate-spin" /> Loading skills…
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Zap size={36} className="text-gray-700 mb-4" />
            <p className="text-sm font-semibold text-gray-500">No skills saved yet</p>
            <p className="text-xs text-gray-700 mt-1 max-w-xs">
              Complete a workflow in the Chat tab, then click{" "}
              <span className="text-orange-400 font-medium">Save as Skill</span> to build your library.
            </p>
          </div>
        ) : (
          skills.map((skill, i) => {
            const isRunning  = runningId === skill.id && runState === "running";
            const isDone     = runningId === skill.id && runState === "done";
            const isDeleting = deletingId === skill.id;

            return (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-2xl border bg-[#0c0f18] transition-all ${
                  isRunning
                    ? "border-orange-500/30 shadow-[0_0_12px_rgba(234,88,12,0.12)]"
                    : isDone
                    ? "border-green-500/20"
                    : "border-white/6 hover:border-white/12"
                }`}
              >
                <div className="p-4">
                  {/* Name + run count */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap size={13} className="text-orange-400 shrink-0 mt-0.5" />
                      <p className="text-[13px] font-bold text-white truncate">{skill.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600 shrink-0 font-mono">
                      <BarChart2 size={9} />
                      {skill.runCount}×
                    </div>
                  </div>

                  {/* Goal preview */}
                  <p className="text-[11px] text-gray-500 leading-relaxed mb-2 line-clamp-2">
                    {skill.goal}
                  </p>

                  {/* Step badges */}
                  {skill.steps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {skill.steps.slice(0, 4).map((s, si) => (
                        <span
                          key={si}
                          className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/4 text-gray-600 font-mono"
                        >
                          {s.tool ?? "step"}
                        </span>
                      ))}
                      {skill.steps.length > 4 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/4 text-gray-600 font-mono">
                          +{skill.steps.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Meta + actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-gray-700">
                      <Clock size={9} />
                      <span>{fmtRelative(skill.savedAt)}</span>
                      {skill.lastRunAt && (
                        <span className="text-gray-800">· last run {fmtDate(skill.lastRunAt)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Delete */}
                      {confirmDel === skill.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-red-400">Delete?</span>
                          <button
                            onClick={() => deleteSkill(skill.id)}
                            disabled={isDeleting}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                          >
                            {isDeleting ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 hover:bg-white/8"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(skill.id)}
                          className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/8 transition-all"
                          title="Delete skill"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      {/* Run */}
                      <button
                        onClick={() => runSkill(skill)}
                        disabled={!!runningId}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                          isRunning
                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/25 cursor-not-allowed"
                            : isDone
                            ? "bg-green-500/12 text-green-400 border border-green-500/20"
                            : "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 hover:border-orange-500/35 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {isRunning ? (
                          <><Loader2 size={11} className="animate-spin" /> Running…</>
                        ) : isDone ? (
                          <><CheckCircle2 size={11} /> Done</>
                        ) : (
                          <><Play size={11} /> Run</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
