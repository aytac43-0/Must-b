/**
 * SkillsPanel — Skill Library (v5.0) — Skill_Master
 *
 * Two tabs:
 *   • Saved    — recorded workflows (/api/skills/list)
 *   • Library  — native SKILL.md catalog (/api/skills/catalog)
 *
 * Library tab: shows all 52 built-in skills with emoji, description,
 * required bins/config, and a "Use" button that invokes via /api/v1/skills/invoke.
 * Must-b native — no external service dependencies.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import {
  Zap, Trash2, Play, RefreshCw, BookOpen,
  Clock, BarChart2, Loader2, CheckCircle2, AlertCircle,
  Library, Terminal, Settings2, ChevronRight,
} from "lucide-react";
import { apiFetch }  from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useI18n }   from "@/i18n";

// ── Types ─────────────────────────────────────────────────────────────────

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

interface CatalogSkillRequires {
  bins?:   string[];
  config?: string[];
}

interface CatalogSkill {
  id:          string;
  name:        string;
  description: string;
  homepage?:   string;
  emoji?:      string;
  requires:    CatalogSkillRequires;
  hasScripts:  boolean;
}

type RunState = "idle" | "running" | "done" | "error";
type Tab      = "saved" | "library";

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function CatalogSkillCard({ skill }: { skill: CatalogSkill }) {
  const [invoking, setInvoking]   = useState(false);
  const [invoked,  setInvoked]    = useState(false);
  const [goal,     setGoal]       = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleUse = async () => {
    if (!showInput) { setShowInput(true); return; }
    if (!goal.trim()) return;
    setInvoking(true);
    try {
      await apiFetch("/api/v1/skills/invoke", {
        method: "POST",
        body:   JSON.stringify({ skill: skill.id, params: { goal: goal.trim(), _autoRun: true } }),
      });
      setInvoked(true);
      setShowInput(false);
      setGoal("");
      setTimeout(() => setInvoked(false), 3000);
    } catch { /* silent */ }
    setInvoking(false);
  };

  const hasBins   = (skill.requires.bins   ?? []).length > 0;
  const hasConfig = (skill.requires.config ?? []).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/6 bg-[#0c0f18] hover:border-white/12 transition-all"
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className="text-base leading-none mt-0.5 shrink-0">
            {skill.emoji ?? "⚡"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-gray-200 truncate capitalize">
              {skill.name}
            </p>
          </div>
          {skill.hasScripts && (
            <Terminal size={10} className="text-gray-700 shrink-0 mt-0.5" />
          )}
        </div>

        {/* Description */}
        <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-2 ml-6">
          {skill.description}
        </p>

        {/* Requirements */}
        {(hasBins || hasConfig) && (
          <div className="flex flex-wrap gap-1 mb-2 ml-6">
            {(skill.requires.bins ?? []).map(b => (
              <span key={b} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/8 border border-blue-500/15 text-blue-400 font-mono">
                bin:{b}
              </span>
            ))}
            {(skill.requires.config ?? []).map(c => (
              <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/8 border border-purple-500/15 text-purple-400 font-mono">
                cfg:{c}
              </span>
            ))}
          </div>
        )}

        {/* Inline goal input */}
        <AnimatePresence>
          {showInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <input
                autoFocus
                value={goal}
                onChange={e => setGoal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleUse(); if (e.key === "Escape") { setShowInput(false); setGoal(""); }}}
                placeholder={`Goal for ${skill.name}…`}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/4 border border-white/10 text-[11px] text-gray-200 placeholder-gray-700 outline-none focus:border-orange-500/30 transition-colors"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row */}
        <div className="flex items-center justify-end gap-1 ml-6">
          {showInput && (
            <button
              onClick={() => { setShowInput(false); setGoal(""); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/4 text-gray-600 hover:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleUse}
            disabled={invoking || (showInput && !goal.trim())}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all disabled:opacity-40 ${
              invoked
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-orange-500/8 border-orange-500/15 text-orange-400 hover:bg-orange-500/15"
            }`}
          >
            {invoking ? (
              <Loader2 size={9} className="animate-spin" />
            ) : invoked ? (
              <><CheckCircle2 size={9} /> Sent</>
            ) : showInput ? (
              <><ChevronRight size={9} /> Run</>
            ) : (
              <><Settings2 size={9} /> Use</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function SkillsPanel() {
  const { t }         = useI18n();
  const ps            = t.panels.skills;

  const [tab,         setTab]        = useState<Tab>("saved");

  // Saved skills state
  const [skills,      setSkills]      = useState<SavedSkill[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [runningId,   setRunningId]   = useState<string | null>(null);
  const [runState,    setRunState]    = useState<RunState>("idle");
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null);

  // Catalog state
  const [catalog,     setCatalog]     = useState<CatalogSkill[]>([]);
  const [catalogLoad, setCatalogLoad] = useState(false);
  const [catFilter,   setCatFilter]   = useState("");

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

  const loadCatalog = useCallback(async () => {
    setCatalogLoad(true);
    try {
      const r = await apiFetch("/api/skills/catalog");
      if (r.ok) {
        const d = await r.json() as { skills: CatalogSkill[] };
        setCatalog(d.skills ?? []);
      }
    } catch { /* silent */ }
    setCatalogLoad(false);
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { if (tab === "library" && catalog.length === 0) loadCatalog(); }, [tab, catalog.length, loadCatalog]);

  // Socket listener for skill run updates
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { type: string; skillId?: string }) => {
      if (data.type === "skillRunStart" && data.skillId) {
        setRunningId(data.skillId);
        setRunState("running");
      }
      if (data.type === "planFinish") {
        setRunState("done");
        setRunningId(null);
        loadSkills();
        setTimeout(() => setRunState("idle"), 2500);
      }
    };
    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, [loadSkills]);

  const runSkill = async (skill: SavedSkill) => {
    if (runningId) return;
    setRunningId(skill.id);
    setRunState("running");
    try {
      const r = await apiFetch("/api/skills/run", {
        method: "POST",
        body:   JSON.stringify({ id: skill.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
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

  const filteredCatalog = catFilter.trim()
    ? catalog.filter(s =>
        s.name.toLowerCase().includes(catFilter.toLowerCase()) ||
        s.description.toLowerCase().includes(catFilter.toLowerCase())
      )
    : catalog;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#080b12]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-orange-400" />
          <span className="text-[13px] font-bold text-gray-300">{ps.title}</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/4 rounded-lg p-0.5">
          <button
            onClick={() => setTab("saved")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              tab === "saved"
                ? "bg-orange-500/15 text-orange-400"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            <Zap size={9} />
            Saved
            {skills.length > 0 && (
              <span className="text-[9px] font-mono text-gray-600">{skills.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("library")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              tab === "library"
                ? "bg-orange-500/15 text-orange-400"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            <Library size={9} />
            Library
            {catalog.length > 0 && (
              <span className="text-[9px] font-mono text-gray-600">{catalog.length}</span>
            )}
          </button>
        </div>

        <button
          onClick={tab === "saved" ? loadSkills : loadCatalog}
          disabled={tab === "saved" ? loading : catalogLoad}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} className={(tab === "saved" ? loading : catalogLoad) ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── SAVED TAB ── */}
      {tab === "saved" && (
        <>
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
                {runState === "running" ? ps.runningStatus :
                 runState === "done"    ? ps.completedStatus :
                                         ps.failedStatus}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
            {loading && skills.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-700 text-xs gap-2">
                <Loader2 size={13} className="animate-spin" /> {ps.loading}
              </div>
            ) : skills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Zap size={36} className="text-gray-700 mb-4" />
                <p className="text-sm font-semibold text-gray-500">{ps.emptyTitle}</p>
                <p className="text-xs text-gray-700 mt-1 max-w-xs">
                  {ps.emptyHint}{" "}
                  <span className="text-orange-400 font-medium">{ps.saveAsSkill}</span>{" "}
                  {ps.emptyHint2}
                </p>
                <button
                  onClick={() => setTab("library")}
                  className="mt-4 flex items-center gap-1.5 text-[11px] text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <Library size={11} /> Browse skill library
                </button>
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

                      <p className="text-[11px] text-gray-500 leading-relaxed mb-2 line-clamp-2">
                        {skill.goal}
                      </p>

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

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-gray-700">
                          <Clock size={9} />
                          <span>{fmtRelative(skill.savedAt)}</span>
                          {skill.lastRunAt && (
                            <span className="text-gray-800">· {ps.lastRun} {fmtDate(skill.lastRunAt)}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {confirmDel === skill.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-red-400">{ps.deleteConfirm}</span>
                              <button
                                onClick={() => deleteSkill(skill.id)}
                                disabled={isDeleting}
                                className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                              >
                                {isDeleting ? "…" : ps.yes}
                              </button>
                              <button
                                onClick={() => setConfirmDel(null)}
                                className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 hover:bg-white/8"
                              >
                                {ps.no}
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
                              <><Loader2 size={11} className="animate-spin" /> {ps.runningBtn}</>
                            ) : isDone ? (
                              <><CheckCircle2 size={11} /> {ps.doneBtn}</>
                            ) : (
                              <><Play size={11} /> {ps.runBtn}</>
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
        </>
      )}

      {/* ── LIBRARY TAB ── */}
      {tab === "library" && (
        <>
          {/* Search bar */}
          <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
            <input
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              placeholder="Search skills…"
              className="w-full px-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-[11px] text-gray-300 placeholder-gray-700 outline-none focus:border-orange-500/25 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-3 grid grid-cols-1 gap-2">
            {catalogLoad && catalog.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-700 text-xs gap-2 col-span-1">
                <Loader2 size={13} className="animate-spin" /> Loading skill library…
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center col-span-1">
                <Library size={36} className="text-gray-700 mb-3" />
                <p className="text-sm font-semibold text-gray-500">No skills found</p>
                {catFilter && (
                  <button
                    onClick={() => setCatFilter("")}
                    className="mt-2 text-[11px] text-orange-400 hover:text-orange-300"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              filteredCatalog.map((skill, i) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                >
                  <CatalogSkillCard skill={skill} />
                </motion.div>
              ))
            )}
          </div>

          {/* Footer count */}
          {catalog.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 shrink-0 flex items-center gap-1.5">
              <span className="text-[10px] text-gray-700 font-mono">
                {filteredCatalog.length} / {catalog.length} skills
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
