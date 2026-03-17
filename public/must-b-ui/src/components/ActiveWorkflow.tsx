/**
 * ActiveWorkflow
 *
 * Renders a live progress card whenever the backend emits a `workflowStart`
 * agentUpdate event via Socket.IO.  Each step fires `workflowStep` updates
 * and the sequence closes with `workflowDone`.
 *
 * Step types map to icons:
 *   browse → Globe   write → FileText   think → Brain   exec → Terminal
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, FileText, Brain, Terminal, CheckCircle2, Loader2 } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useI18n } from "@/i18n";

type StepType   = "browse" | "write" | "think" | "exec";
type StepStatus = "queued" | "running" | "done";

interface WorkflowStep {
  id:      string;
  type:    StepType;
  label:   string;
  status:  StepStatus;
  detail?: string;
}

interface AgentUpdate {
  type:   string;
  steps?: WorkflowStep[];
  step?:  WorkflowStep;
  goal?:  string;
}

const ICONS: Record<StepType, React.ElementType> = {
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

export default function ActiveWorkflow() {
  const { t } = useI18n();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [goal,  setGoal]  = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handler = (update: AgentUpdate) => {
      if (update.type === "workflowStart") {
        setGoal(update.goal ?? null);
        setSteps(update.steps ?? []);
      }
      if (update.type === "workflowStep" && update.step) {
        setSteps((prev) =>
          prev.map((s) => s.id === update.step!.id ? update.step! : s)
        );
      }
      if (update.type === "workflowDone") {
        setTimeout(() => { setSteps([]); setGoal(null); }, 2500);
      }
    };

    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, []);

  return (
    <AnimatePresence>
      {steps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="mx-4 mb-3 bg-[#0c0f18] border border-orange-500/15 rounded-2xl overflow-hidden shadow-xl shadow-orange-500/5"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
              {t.workflow.title}
            </span>
          </div>

          {/* Goal */}
          {goal && (
            <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
              <p className="text-[11px] text-gray-500 truncate">
                {t.workflow.goal}:{" "}
                <span className="text-gray-300 font-medium">{goal}</span>
              </p>
            </div>
          )}

          {/* Steps */}
          <div className="p-3 space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-hide">
            {steps.map((step, i) => {
              const Icon = ICONS[step.type] ?? Brain;
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
