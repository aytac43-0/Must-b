/**
 * PluginsPanel — Plugin Architect UI (v4.9)
 *
 * Browse, build, run, and stop auto-generated plugins.
 * Connects to: GET /api/plugins/list, POST /api/plugins/build,
 *              POST /api/plugins/run, POST /api/plugins/stop
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import {
  Puzzle, Plus, Play, Square, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Code2, FileCode2, Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n }  from "@/i18n";

// ── Types ─────────────────────────────────────────────────────────────────

interface PluginInfo {
  name:      string;
  lang:      "node" | "python";
  filename:  string;
  running:   boolean;
  createdAt: string;
}

type Notice = { ok: boolean; msg: string } | null;

// ── Helpers ───────────────────────────────────────────────────────────────

const LANG_ICONS: Record<string, React.ElementType> = {
  node:   Code2,
  python: FileCode2,
};

const LANG_COLORS: Record<string, string> = {
  node:   "text-green-400",
  python: "text-blue-400",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function PluginsPanel() {
  const { t }        = useI18n();
  const pp           = t.panels.plugins;
  const [plugins,    setPlugins]    = useState<PluginInfo[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [busyName,   setBusyName]   = useState<string | null>(null);
  const [notice,     setNotice]     = useState<Notice>(null);
  const [showBuild,  setShowBuild]  = useState(false);

  // Build form state
  const [buildName,    setBuildName]    = useState("");
  const [buildGoal,    setBuildGoal]    = useState("");
  const [buildLang,    setBuildLang]    = useState<"node" | "python">("node");
  const [buildContext, setBuildContext] = useState("");
  const [building,     setBuilding]     = useState(false);

  const flash = (ok: boolean, msg: string) => {
    setNotice({ ok, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/plugins/list");
      if (r.ok) {
        const d = await r.json() as { plugins: PluginInfo[] };
        setPlugins(d.plugins ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  const handleRun = async (name: string, running: boolean) => {
    setBusyName(name);
    try {
      const endpoint = running ? "/api/plugins/stop" : "/api/plugins/run";
      const r = await apiFetch(endpoint, {
        method: "POST",
        body:   JSON.stringify({ name }),
      });
      if (r.ok) {
        flash(true, running ? `${name} stopped` : `${name} launched`);
        await loadPlugins();
      } else {
        flash(false, pp.opFailed);
      }
    } catch {
      flash(false, pp.reqError);
    }
    setBusyName(null);
  };

  const handleBuild = async () => {
    if (!buildName.trim() || !buildGoal.trim()) return;
    setBuilding(true);
    try {
      const r = await apiFetch("/api/plugins/build", {
        method: "POST",
        body:   JSON.stringify({
          name:    buildName.trim(),
          goal:    buildGoal.trim(),
          lang:    buildLang,
          context: buildContext.trim() || undefined,
        }),
      });
      if (r.ok) {
        flash(true, `Plugin "${buildName}" created`);
        setBuildName(""); setBuildGoal(""); setBuildContext("");
        setShowBuild(false);
        await loadPlugins();
      } else {
        flash(false, pp.buildFailed);
      }
    } catch {
      flash(false, pp.reqError);
    }
    setBuilding(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#080b12]">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Puzzle size={14} className="text-orange-400" />
          <span className="text-[13px] font-bold text-gray-300">{pp.title}</span>
          <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full font-mono">
            {plugins.length} {pp.installed}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPlugins}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            title={pp.refresh}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowBuild(v => !v)}
            className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
              showBuild
                ? "bg-orange-500/15 border-orange-500/25 text-orange-400"
                : "bg-white/4 border-white/8 text-gray-500 hover:text-gray-300"
            }`}
          >
            <Plus size={10} />
            {pp.newPlugin}
          </button>
        </div>
      </div>

      {/* Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-1.5 px-6 py-2 text-[11px] font-medium shrink-0 ${
              notice.ok ? "text-green-400" : "text-red-400"
            }`}
          >
            {notice.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            {notice.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build Form */}
      <AnimatePresence>
        {showBuild && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/5 bg-white/2 overflow-hidden shrink-0"
          >
            <div className="px-6 py-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {pp.buildTitle}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={buildName}
                  onChange={e => setBuildName(e.target.value)}
                  placeholder={pp.namePlaceholder}
                  className="col-span-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 text-[12px] text-gray-200 outline-none placeholder-gray-700 focus:border-orange-500/30 transition-colors"
                />
                <input
                  value={buildGoal}
                  onChange={e => setBuildGoal(e.target.value)}
                  placeholder={pp.goalPlaceholder}
                  className="col-span-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 text-[12px] text-gray-200 outline-none placeholder-gray-700 focus:border-orange-500/30 transition-colors"
                />
                <input
                  value={buildContext}
                  onChange={e => setBuildContext(e.target.value)}
                  placeholder={pp.contextPlaceholder}
                  className="col-span-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 text-[12px] text-gray-200 outline-none placeholder-gray-700 focus:border-orange-500/30 transition-colors"
                />
                <div className="flex gap-2">
                  {(["node", "python"] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setBuildLang(l)}
                      className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-all capitalize ${
                        buildLang === l
                          ? "bg-orange-500/15 border-orange-500/25 text-orange-400"
                          : "bg-white/4 border-white/8 text-gray-500"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleBuild}
                  disabled={building || !buildName.trim() || !buildGoal.trim()}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500/12 border border-orange-500/20 text-orange-400 text-[11px] font-bold hover:bg-orange-500/20 transition-all disabled:opacity-40"
                >
                  {building ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  {pp.generatePlugin}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plugin List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
        {plugins.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Puzzle size={36} className="text-gray-700 mb-4" />
            <p className="text-sm font-semibold text-gray-500">{pp.emptyTitle}</p>
            <p className="text-xs text-gray-700 mt-1">{pp.emptyHint}</p>
          </div>
        )}

        {plugins.map((p, i) => {
          const LangIcon = LANG_ICONS[p.lang] ?? Code2;
          const busy     = busyName === p.name;
          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                p.running
                  ? "bg-green-500/5 border-green-500/15 hover:border-green-500/25"
                  : "bg-[#0c0f18] border-white/6 hover:border-white/12"
              }`}
            >
              <LangIcon size={13} className={LANG_COLORS[p.lang] ?? "text-gray-400"} />

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-300 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-600 font-mono">{p.filename}</p>
              </div>

              {p.running && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/12 border border-green-500/20 text-green-400 font-bold">
                  {pp.running}
                </span>
              )}

              <button
                disabled={busy}
                onClick={() => handleRun(p.name, p.running)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all disabled:opacity-40 ${
                  p.running
                    ? "bg-red-500/8 border-red-500/15 text-red-400 hover:bg-red-500/15"
                    : "bg-green-500/8 border-green-500/15 text-green-400 hover:bg-green-500/15"
                }`}
              >
                {busy
                  ? <Loader2 size={10} className="animate-spin" />
                  : p.running
                    ? <Square size={10} />
                    : <Play size={10} />}
                {p.running ? pp.stop : pp.run}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
