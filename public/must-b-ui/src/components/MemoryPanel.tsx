/**
 * MemoryPanel — Memory Insights (v4.7)
 *
 * Semantic search over the local vector memory index.
 * Shows result cards ranked by cosine similarity with source badges.
 * Also provides indexing controls: Index Skills / Index Workspace / Clear.
 */

import { useState, useCallback, useRef }  from "react";
import { motion, AnimatePresence }         from "framer-motion";
import {
  Brain, Search, Loader2, RefreshCw, Zap,
  FileText, MessageSquare, FolderOpen, Trash2,
  CheckCircle2, AlertCircle, SlidersHorizontal,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemoryResult {
  score:    number;
  text:     string;
  metadata: {
    source:  "skill" | "conversation" | "workspace" | "custom";
    title:   string;
    id?:     string;
    path?:   string;
    savedAt?: string;
    tags?:   string[];
  };
}

interface IndexStats {
  items:    number;
  indexDir: string;
}

type IndexOp = "skills" | "workspace" | "clear" | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

const SOURCE_META: Record<
  MemoryResult["metadata"]["source"],
  { label: string; icon: React.ElementType; color: string }
> = {
  skill:        { label: "Skill",        icon: Zap,            color: "text-orange-400" },
  conversation: { label: "Conversation", icon: MessageSquare,  color: "text-blue-400"   },
  workspace:    { label: "Workspace",    icon: FolderOpen,     color: "text-green-400"  },
  custom:       { label: "Custom",       icon: FileText,        color: "text-gray-400"  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MemoryPanel() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<MemoryResult[]>([]);
  const [stats,    setStats]    = useState<IndexStats | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [indexOp,  setIndexOp]  = useState<IndexOp>(null);
  const [notice,   setNotice]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [showCtrl, setShowCtrl] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Search ──────────────────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setResults([]);
    try {
      const r = await apiFetch(`/api/memory/search?q=${encodeURIComponent(trimmed)}&limit=10`);
      if (r.ok) {
        const d = await r.json() as { results: MemoryResult[] };
        setResults(d.results ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") search(query);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const r = await apiFetch("/api/memory/stats");
      if (r.ok) setStats(await r.json());
    } catch { /* silent */ }
  }, []);

  // ── Index ops ───────────────────────────────────────────────────────────────
  const runIndexOp = async (op: "skills" | "workspace" | "clear") => {
    setIndexOp(op);
    setNotice(null);
    try {
      const r = op === "clear"
        ? await apiFetch("/api/memory/clear-index", { method: "DELETE" })
        : await apiFetch(`/api/memory/index-${op}`,  { method: "POST" });

      if (r.ok) {
        const d = await r.json() as { indexed?: number };
        const msg = op === "clear"
          ? "Index cleared"
          : `Indexed ${d.indexed ?? 0} ${op === "skills" ? "skills" : "files"}`;
        setNotice({ ok: true, msg });
        loadStats();
        if (op === "clear") setResults([]);
      } else {
        setNotice({ ok: false, msg: "Operation failed" });
      }
    } catch {
      setNotice({ ok: false, msg: "Request error" });
    }
    setIndexOp(null);
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#080b12]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-orange-400" />
          <span className="text-[13px] font-bold text-gray-300">Memory Insights</span>
          {stats && (
            <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full font-mono">
              {stats.items.toLocaleString()} vectors
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCtrl(v => !v); if (!stats) loadStats(); }}
            className={`text-gray-600 hover:text-gray-400 transition-colors ${showCtrl ? "text-orange-400" : ""}`}
            title="Index controls"
          >
            <SlidersHorizontal size={13} />
          </button>
          <button
            onClick={loadStats}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            title="Refresh stats"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Index Controls ── */}
      <AnimatePresence>
        {showCtrl && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/5 bg-white/2 overflow-hidden shrink-0"
          >
            <div className="px-6 py-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold shrink-0">
                Index:
              </span>
              {(["skills", "workspace"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => runIndexOp(op)}
                  disabled={indexOp !== null}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/4 border border-white/6 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-all disabled:opacity-40 capitalize"
                >
                  {indexOp === op
                    ? <Loader2 size={10} className="animate-spin" />
                    : op === "skills" ? <Zap size={10} /> : <FolderOpen size={10} />}
                  {op}
                </button>
              ))}
              <button
                onClick={() => runIndexOp("clear")}
                disabled={indexOp !== null}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/8 border border-red-500/15 text-[11px] text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-40 ml-auto"
              >
                {indexOp === "clear"
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Trash2 size={10} />}
                Clear Index
              </button>
            </div>

            {/* Operation notice */}
            <AnimatePresence>
              {notice && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-1.5 px-6 pb-3 text-[11px] font-medium ${notice.ok ? "text-green-400" : "text-red-400"}`}
                >
                  {notice.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {notice.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Bar ── */}
      <div className="px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/8 focus-within:border-orange-500/30 transition-colors">
          <Search size={13} className="text-gray-600 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search your memory…"
            className="flex-1 bg-transparent text-[13px] text-gray-200 outline-none placeholder-gray-700"
          />
          {loading ? (
            <Loader2 size={13} className="text-orange-400 animate-spin shrink-0" />
          ) : (
            <button
              onClick={() => search(query)}
              disabled={!query.trim()}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-orange-500/12 text-orange-400 font-semibold hover:bg-orange-500/22 border border-orange-500/20 transition-all disabled:opacity-30"
            >
              ⌘↵
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5 ml-1">
          Semantic similarity search — press Enter or click to search
        </p>
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Brain size={36} className="text-gray-700 mb-4" />
            <p className="text-sm font-semibold text-gray-500">
              {query.trim() ? "No memories found" : "Search your AI memory"}
            </p>
            <p className="text-xs text-gray-700 mt-1 max-w-xs leading-relaxed">
              {query.trim()
                ? "Try a different phrase or index more content using the controls above."
                : "Type a phrase to find semantically similar skills, conversations, and workspace files."}
            </p>
          </div>
        )}

        {results.map((result, i) => {
          const src  = SOURCE_META[result.metadata.source] ?? SOURCE_META.custom;
          const Icon = src.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/6 bg-[#0c0f18] p-4 hover:border-white/12 transition-all"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon size={11} className={`${src.color} shrink-0`} />
                  <p className="text-[12px] font-semibold text-gray-300 truncate">
                    {result.metadata.title}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    result.score >= 0.85
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : result.score >= 0.65
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                      : "bg-white/4 border-white/6 text-gray-500"
                  }`}>
                    {pct(result.score)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/4 border border-white/6 font-medium ${src.color}`}>
                    {src.label}
                  </span>
                </div>
              </div>

              {/* Text snippet */}
              <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 mb-2">
                {result.text}
              </p>

              {/* Tags */}
              {result.metadata.tags && result.metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.metadata.tags.map((tag, ti) => (
                    <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/4 text-gray-600 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Score bar */}
              <div className="mt-2 h-0.5 bg-white/4 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400"
                  style={{ width: `${result.score * 100}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
