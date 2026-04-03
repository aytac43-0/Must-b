/**
 * ActionMonitorPanel — v1.0
 *
 * Terminal-like log overlay — aktif bir plan çalışırken ortaya çıkar.
 * Dinlenen socket olayları:
 *   agentUpdate { type:"stepStart",  step:{ tool, description, parameters } }
 *   agentUpdate { type:"stepFinish", step:{ tool }, status, result }
 *   agentUpdate { type:"planFinish" }
 *   terminalStream { stepId, line, stream }
 *
 * İzlenen tool'lar:
 *   terminal / filesystem_write / filesystem_read / filesystem_list /
 *   filesystem_search / filesystem_delete / filesystem_mkdir /
 *   filesystem_copy / filesystem_append_markdown / filesystem_patch_json
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence }                   from "framer-motion";
import { Terminal, FileText, Folder, Trash2, Copy, ChevronDown, ChevronUp, X } from "lucide-react";
import { getSocket } from "@/lib/socket";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogStatus = "running" | "done" | "error";

interface LogEntry {
  id:      string;
  tool:    string;
  label:   string;   // primary display string (command or path)
  status:  LogStatus;
  lines:   string[]; // live terminal output lines
  ts:      number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WATCHED_TOOLS = new Set([
  "terminal", "terminal_stream",
  "filesystem_write", "filesystem_read", "filesystem_list",
  "filesystem_search", "filesystem_delete", "filesystem_mkdir",
  "filesystem_copy", "filesystem_append_markdown",
  "filesystem_patch_json", "filesystem_write_json",
]);

const MAX_ENTRIES  = 40;
const MAX_LINES    = 30;   // max terminal output lines per entry
const HIDE_DELAY   = 4000; // ms after planFinish to auto-collapse

// ── Helpers ───────────────────────────────────────────────────────────────────

function toolIcon(tool: string) {
  if (tool.startsWith("terminal")) return <Terminal size={10} />;
  if (tool.includes("delete"))     return <Trash2   size={10} />;
  if (tool.includes("copy"))       return <Copy     size={10} />;
  if (tool.includes("list") || tool.includes("mkdir")) return <Folder size={10} />;
  return <FileText size={10} />;
}

function toolColor(tool: string): string {
  if (tool.startsWith("terminal"))         return "#34d399"; // green
  if (tool.includes("write") || tool.includes("append") || tool.includes("patch"))
                                           return "#f97316"; // orange
  if (tool.includes("delete"))             return "#f87171"; // red
  return "#94a3b8"; // slate
}

function statusChar(status: LogStatus): string {
  if (status === "running") return "●";
  if (status === "done")    return "✓";
  return "✕";
}

function extractLabel(tool: string, params: Record<string, unknown>): string {
  if (tool.startsWith("terminal")) {
    const cmd = String(params.command ?? params.cmd ?? "");
    return cmd.slice(0, 80) || tool;
  }
  const p = String(params.path ?? params.dest ?? params.src ?? "");
  return p.replace(/\\/g, "/").split("/").slice(-3).join("/") || tool;
}

// ── LogRow ────────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = toolColor(entry.tool);
  const isRunning = entry.status === "running";

  return (
    <div className="group">
      {/* Main line */}
      <div
        className="flex items-center gap-2 px-3 py-1 hover:bg-white/3 cursor-pointer"
        onClick={() => entry.lines.length > 0 && setExpanded(e => !e)}
      >
        {/* Status dot */}
        <span
          className="text-[9px] flex-shrink-0 font-bold"
          style={{ color, minWidth: 10 }}
        >
          {isRunning ? (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {statusChar(entry.status)}
            </motion.span>
          ) : statusChar(entry.status)}
        </span>

        {/* Tool icon */}
        <span style={{ color, opacity: 0.7 }} className="flex-shrink-0">
          {toolIcon(entry.tool)}
        </span>

        {/* Label */}
        <span className="text-[11px] font-mono text-white/70 truncate flex-1 min-w-0">
          {entry.label}
        </span>

        {/* Expand toggle */}
        {entry.lines.length > 0 && (
          <span className="text-white/20 group-hover:text-white/50 flex-shrink-0">
            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[9px] text-white/20 flex-shrink-0 font-mono">
          {new Date(entry.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Expanded terminal output */}
      <AnimatePresence>
        {expanded && entry.lines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="mx-3 mb-1 rounded-lg p-2 overflow-y-auto"
              style={{
                background:  "rgba(0,0,0,0.5)",
                border:      "1px solid rgba(255,255,255,0.06)",
                maxHeight:   "120px",
              }}
            >
              {entry.lines.map((line, i) => (
                <p key={i} className="text-[10px] font-mono text-green-400/80 leading-relaxed whitespace-pre-wrap break-all">
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ActionMonitorPanel ────────────────────────────────────────────────────────

export default function ActionMonitorPanel() {
  const [entries,    setEntries]    = useState<LogEntry[]>([]);
  const [visible,    setVisible]    = useState(false);
  const [minimized,  setMinimized]  = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef      = useRef<HTMLDivElement>(null);

  // stepId → entryId mapping (for terminalStream)
  const stepToEntryRef = useRef<Map<string, string>>(new Map());

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setEntries([]);
      stepToEntryRef.current.clear();
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    const sk = getSocket();

    const onAgentUpdate = (data: { type: string; step?: { id?: string; tool?: string; description?: string; parameters?: Record<string, unknown> }; status?: string }) => {
      const { type } = data;

      if (type === "planStart") {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setVisible(true);
        setMinimized(false);
        setEntries([]);
        stepToEntryRef.current.clear();
        return;
      }

      if (type === "planFinish") {
        // Mark all running as done
        setEntries(prev => prev.map(e => e.status === "running" ? { ...e, status: "done" as LogStatus } : e));
        scheduleHide();
        return;
      }

      if (type === "stepStart" && data.step) {
        const step = data.step;
        if (!step.tool || !WATCHED_TOOLS.has(step.tool)) return;

        const entryId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (step.id) stepToEntryRef.current.set(step.id, entryId);

        const entry: LogEntry = {
          id:     entryId,
          tool:   step.tool,
          label:  extractLabel(step.tool, step.parameters ?? {}),
          status: "running",
          lines:  [],
          ts:     Date.now(),
        };

        setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
        // Scroll to top
        setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = 0;
        }, 50);
        return;
      }

      if (type === "stepFinish" && data.step) {
        const step = data.step;
        if (!step.tool || !WATCHED_TOOLS.has(step.tool)) return;
        const newStatus: LogStatus = data.status === "error" ? "error" : "done";
        // Find entry by stepId first, fallback to most recent running entry for this tool
        const entryId = step.id ? stepToEntryRef.current.get(step.id) : undefined;
        setEntries(prev => prev.map(e => {
          if (entryId ? e.id === entryId : (e.tool === step.tool && e.status === "running")) {
            return { ...e, status: newStatus };
          }
          return e;
        }));
      }
    };

    const onTerminalStream = (data: { stepId?: string; line: string; stream: string }) => {
      if (!data.line?.trim()) return;
      const entryId = data.stepId ? stepToEntryRef.current.get(data.stepId) : undefined;
      if (!entryId) return;
      setEntries(prev => prev.map(e => {
        if (e.id !== entryId) return e;
        const lines = [...e.lines, data.line].slice(-MAX_LINES);
        return { ...e, lines };
      }));
    };

    sk.on("agentUpdate",    onAgentUpdate);
    sk.on("terminalStream", onTerminalStream);

    return () => {
      sk.off("agentUpdate",    onAgentUpdate);
      sk.off("terminalStream", onTerminalStream);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  if (!visible) return null;

  const runningCount = entries.filter(e => e.status === "running").length;

  return (
    <motion.div
      className="fixed bottom-[72px] left-4 z-[120] w-[340px]"
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0,   scale: 1    }}
      exit={{ opacity: 0, x: -16, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:    "rgba(5,3,1,0.88)",
          border:        "1px solid rgba(52,211,153,0.22)",
          backdropFilter:"blur(24px)",
          boxShadow:     "0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(52,211,153,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
          style={{ borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setMinimized(m => !m)}
        >
          <Terminal size={11} className="text-green-400/70 flex-shrink-0" />
          <span className="text-[11px] font-bold text-white/60 flex-1 tracking-wide uppercase">
            Eylem Monitörü
          </span>

          {runningCount > 0 && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-[10px] font-bold text-green-400/80 flex-shrink-0"
            >
              {runningCount} aktif
            </motion.span>
          )}

          <button
            onClick={e => { e.stopPropagation(); setVisible(false); setEntries([]); }}
            className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 ml-1"
          >
            <X size={10} />
          </button>

          <span className="text-white/20 flex-shrink-0">
            {minimized ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </span>
        </div>

        {/* Log list */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div
                ref={listRef}
                className="overflow-y-auto py-1"
                style={{ maxHeight: "220px" }}
              >
                {entries.length === 0 ? (
                  <p className="text-[11px] text-white/25 px-3 py-3 font-mono">
                    Eylem bekleniyor…
                  </p>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {entries.map(entry => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.15 }}
                      >
                        <LogRow entry={entry} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
