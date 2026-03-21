/**
 * ActiveWorkflow
 *
 * Two panels in one:
 *  1. Workflow Steps — shows workflowStart/workflowStep/workflowDone events
 *  2. Action Feed   — shows live OS-level input actions (mouseMove/mouseClick/
 *                     typeText/visionClick) emitted by input.ts via socket.io
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, FileText, Brain, Terminal,
  CheckCircle2, Loader2,
  MousePointerClick, MousePointer2, Keyboard, Eye,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useI18n } from "@/i18n";

// ── Workflow types ─────────────────────────────────────────────────────────

type StepType   = "browse" | "write" | "think" | "exec";
type StepStatus = "queued" | "running" | "done";

interface WorkflowStep {
  id:      string;
  type:    StepType;
  label:   string;
  status:  StepStatus;
  detail?: string;
}

// ── Input-action log types ─────────────────────────────────────────────────

type ActionKind = "mouseMove" | "mouseClick" | "typeText" | "visionClick";

interface ActionLog {
  id:        string;
  action:    ActionKind;
  label:     string;
  timestamp: number;
}

const ACTION_ICONS: Record<ActionKind, React.ElementType> = {
  mouseMove:   MousePointer2,
  mouseClick:  MousePointerClick,
  typeText:    Keyboard,
  visionClick: Eye,
};

const ACTION_COLORS: Record<ActionKind, string> = {
  mouseMove:   "text-gray-500",
  mouseClick:  "text-orange-400",
  typeText:    "text-blue-400",
  visionClick: "text-purple-400",
};

const MAX_LOG_ENTRIES = 12;

// ── Step icons / classes ───────────────────────────────────────────────────

const STEP_ICONS: Record<StepType, React.ElementType> = {
  browse: Globe,
  write:  FileText,
  think:  Brain,
  exec:   Terminal,
};

const STEP_CLASSES: Record<StepStatus, string> = {
  running: "bg-orange-500/8 border border-orange-500/20 text-orange-300",
  done:    "bg-green-500/5  border border-green-500/10  text-gray-500",
  queued:  "bg-white/2      border border-white/5        text-gray-600",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function ActiveWorkflow() {
  const { t } = useI18n();

  const [steps,   setSteps]   = useState<WorkflowStep[]>([]);
  const [goal,    setGoal]    = useState<string | null>(null);
  const [actions, setActions] = useState<ActionLog[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    const handler = (update: { type: string } & Record<string, unknown>) => {
      // ── Workflow events ──────────────────────────────────────────────
      if (update.type === "workflowStart") {
        setGoal((update.goal as string) ?? null);
        setSteps((update.steps as WorkflowStep[]) ?? []);
      }
      if (update.type === "workflowStep" && update.step) {
        const s = update.step as WorkflowStep;
        setSteps((prev) => prev.map((p) => p.id === s.id ? s : p));
      }
      if (update.type === "workflowDone") {
        setTimeout(() => { setSteps([]); setGoal(null); }, 2500);
      }

      // ── Input-action events ──────────────────────────────────────────
      if (update.type === "inputAction") {
        const entry: ActionLog = {
          id:        `${Date.now()}-${Math.random()}`,
          action:    (update.action as ActionKind) ?? "mouseClick",
          label:     (update.label as string)  ?? String(update.action),
          timestamp: (update.timestamp as number) ?? Date.now(),
        };
        setActions((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
      }
    };

    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actions]);

  const hasWorkflow = steps.length > 0;
  const hasActions  = actions.length > 0;

  if (!hasWorkflow && !hasActions) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
        className="mx-4 mb-3 bg-[#0c0f18] border border-orange-500/15 rounded-2xl overflow-hidden shadow-xl shadow-orange-500/5"
      >
        {/* ── Workflow panel ─────────────────────────────────────────────── */}
        {hasWorkflow && (
          <>
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                {t.workflow.title}
              </span>
            </div>

            {goal && (
              <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                <p className="text-[11px] text-gray-500 truncate">
                  {t.workflow.goal}:{" "}
                  <span className="text-gray-300 font-medium">{goal}</span>
                </p>
              </div>
            )}

            <div className="p-3 space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-hide">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[step.type] ?? Brain;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-medium ${STEP_CLASSES[step.status]}`}
                  >
                    {step.status === "running" ? (
                      <Loader2 size={13} className="animate-spin text-orange-400 shrink-0" />
                    ) : step.status === "done" ? (
                      <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                    ) : (
                      <Icon size={13} className="text-gray-600 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{step.label}</span>
                    {step.detail && (
                      <span className="text-[10px] text-gray-600 truncate max-w-[90px]">
                        {step.detail}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Action feed ────────────────────────────────────────────────── */}
        {hasActions && (
          <>
            <div className={`px-4 py-2 flex items-center gap-2 ${hasWorkflow ? "border-t border-white/5" : ""}`}>
              <MousePointerClick size={11} className="text-orange-400/70" />
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                Control Feed
              </span>
            </div>

            <div className="px-3 pb-3 space-y-0.5 max-h-[160px] overflow-y-auto scrollbar-hide font-mono">
              {actions.map((entry) => {
                const Icon = ACTION_ICONS[entry.action] ?? MousePointerClick;
                const color = ACTION_COLORS[entry.action] ?? "text-gray-500";
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 py-0.5"
                  >
                    <Icon size={11} className={`${color} shrink-0`} />
                    <span className={`text-[11px] ${color} truncate flex-1`}>
                      {entry.label}
                    </span>
                    <span className="text-[9px] text-gray-700 shrink-0 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </span>
                  </motion.div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
