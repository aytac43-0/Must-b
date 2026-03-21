/**
 * WarRoomPanel — Unified Vision + Workflow Center (v4.3)
 *
 * Merges LiveSightPanel and ActiveWorkflow into a single collapsible banner
 * that sits above the main content area in DashboardPage.
 *
 * Left column  : Live Sight thumbnail + element count badge + Capture button
 * Right column : Workflow steps + OS input action log (Control Feed)
 *
 * Hidden entirely when idle (no capture, no steps, no action log).
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Scan, Globe, FileText, Brain, Terminal,
  CheckCircle2, Loader2,
  MousePointerClick, MousePointer2, Keyboard,
  ChevronDown, ChevronUp, Ghost,
} from "lucide-react";
import { getSocket }  from "@/lib/socket";
import { apiFetch }   from "@/lib/api";
import { useI18n }    from "@/i18n";

// ── Shared types ────────────────────────────────────────────────────────────

interface UIElement {
  type: "button" | "input" | "image" | "unknown";
  x: number; y: number; width: number; height: number;
  confidence: number;
}

interface CapturePayload {
  base64: string; width: number; height: number; source: string;
  elements?: UIElement[];
}

type StepType   = "browse" | "write" | "think" | "exec";
type StepStatus = "queued" | "running" | "done";

interface WorkflowStep {
  id: string; type: StepType; label: string; status: StepStatus; detail?: string;
}

type ActionKind = "mouseMove" | "mouseClick" | "typeText" | "visionClick";
interface ActionLog {
  id: string; action: ActionKind; label: string; timestamp: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  button:  "rgba(234,88,12,0.7)",
  input:   "rgba(59,130,246,0.7)",
  image:   "rgba(168,85,247,0.6)",
  unknown: "rgba(255,255,255,0.3)",
};

const STEP_ICONS: Record<StepType, React.ElementType> = {
  browse: Globe, write: FileText, think: Brain, exec: Terminal,
};

const STEP_CLASSES: Record<StepStatus, string> = {
  running: "bg-orange-500/8 border border-orange-500/20 text-orange-300",
  done:    "bg-green-500/5  border border-green-500/10  text-gray-500",
  queued:  "bg-white/2      border border-white/5        text-gray-600",
};

const ACTION_ICONS: Record<ActionKind, React.ElementType> = {
  mouseMove: MousePointer2, mouseClick: MousePointerClick,
  typeText:  Keyboard,      visionClick: Eye,
};

const ACTION_COLORS: Record<ActionKind, string> = {
  mouseMove: "text-gray-500", mouseClick: "text-orange-400",
  typeText:  "text-blue-400",  visionClick: "text-purple-400",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WarRoomPanel() {
  const { t } = useI18n();

  // Vision
  const [scanning,  setScanning]  = useState(false);
  const [capture,   setCapture]   = useState<CapturePayload | null>(null);
  const [guidance,  setGuidance]  = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Shadow Mode mirror (v4.8)
  const [shadowFrame,  setShadowFrame]  = useState<string | null>(null);
  const [shadowActive, setShadowActive] = useState(false);
  // Parallel ghost mirrors (v4.9) — slot 0..2 (lazy init for stable array)
  const [ghostFrames,  setGhostFrames]  = useState<(string | null)[]>(() => new Array(3).fill(null) as (string | null)[]);
  const [activeGhostSlot, setActiveGhostSlot] = useState(0);

  // Workflow
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [goal,  setGoal]  = useState<string | null>(null);

  // Action log
  const [actions, setActions] = useState<ActionLog[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Panel collapse
  const [collapsed, setCollapsed] = useState(false);

  // ── Canvas draw ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!capture || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (capture.elements?.length) {
        for (const el of capture.elements) {
          ctx.strokeStyle = TYPE_COLOR[el.type] ?? TYPE_COLOR.unknown;
          ctx.lineWidth   = Math.max(2, Math.round(img.width / 400));
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          ctx.fillStyle = TYPE_COLOR[el.type] ?? TYPE_COLOR.unknown;
          ctx.font      = `${Math.max(10, Math.round(img.width / 120))}px monospace`;
          ctx.fillText(el.type, el.x + 4, el.y + 14);
        }
      }
    };
    img.src = `data:image/png;base64,${capture.base64}`;
  }, [capture]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const handler = (data: { type: string } & Record<string, unknown>) => {
      // Vision
      if (data.type === "SCREEN_CAPTURE_START") setScanning(true);
      if (data.type === "SCREEN_CAPTURED") {
        setScanning(false);
        setCapture({
          base64:   data.base64   as string,
          width:    data.width    as number,
          height:   data.height   as number,
          source:   data.source   as string,
          elements: data.elements as UIElement[] | undefined,
        });
        setCollapsed(false);
      }

      // Workflow
      if (data.type === "workflowStart") {
        setGoal((data.goal as string) ?? null);
        setSteps((data.steps as WorkflowStep[]) ?? []);
        setCollapsed(false);
      }
      if (data.type === "workflowStep" && data.step) {
        const s = data.step as WorkflowStep;
        setSteps((prev) => prev.map((p) => p.id === s.id ? s : p));
      }
      if (data.type === "workflowDone") {
        setTimeout(() => { setSteps([]); setGoal(null); }, 2500);
      }

      // Shadow Mode frames (v4.8 — single context)
      if (data.type === "shadowFrame" && typeof data.slot !== "number") {
        setShadowFrame(data.base64 as string);
        setShadowActive(true);
        setCollapsed(false);
      }
      if (data.type === "shadowToggle" && typeof data.slot !== "number") {
        setShadowActive(data.enabled as boolean);
        if (!data.enabled) setShadowFrame(null);
      }
      // Parallel Ghost frames (v4.9 — multi-context)
      if (data.type === "ghostFrame") {
        const slot = typeof data.slot === "number" ? data.slot : -1;
        if (slot >= 0 && slot <= 2 && typeof data.base64 === "string") {
          setGhostFrames(prev => {
            const next = [...prev] as (string | null)[];
            next[slot] = data.base64 as string;
            return next;
          });
          setCollapsed(false);
        }
      }
      if (data.type === "ghostSlot") {
        const slot = typeof data.slot === "number" ? data.slot : -1;
        if (slot >= 0 && slot <= 2) setActiveGhostSlot(slot);
      }
      if (data.type === "shadowToggle" && typeof data.slot === "number") {
        const slot = data.slot;
        if (slot >= 0 && slot <= 2 && !(data.enabled as boolean)) {
          setGhostFrames(prev => { const n = [...prev] as (string | null)[]; n[slot] = null; return n; });
        }
      }

      // Input actions
      if (data.type === "inputAction") {
        const entry: ActionLog = {
          id:        `${Date.now()}-${Math.random()}`,
          action:    (data.action as ActionKind) ?? "mouseClick",
          label:     (data.label  as string)     ?? "",
          timestamp: (data.timestamp as number)  ?? Date.now(),
        };
        setActions((prev) => [...prev.slice(-11), entry]);
        setCollapsed(false);
      }
    };

    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, []);

  // Auto-scroll action log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actions]);

  const handleCapture = async () => {
    if (scanning) return;
    try {
      const r = await apiFetch("/api/system/vision-guidance");
      if (r.ok) {
        const g = await r.json() as { warn: boolean; message: string | null };
        if (g.warn && g.message) setGuidance(g.message);
      }
    } catch { /* silent */ }
    await apiFetch("/api/system/screenshot", {
      method: "POST",
      body:   JSON.stringify({ detect: true }),
    }).catch(() => {});
  };

  const hasActiveGhost = ghostFrames.some(f => f !== null);
  const isVisible = capture || steps.length > 0 || actions.length > 0 || scanning || shadowActive || hasActiveGhost;
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22 }}
        className="mx-4 mb-3 bg-[#0a0d16] border border-orange-500/12 rounded-2xl overflow-hidden shadow-xl shadow-orange-500/4 shrink-0"
      >
        {/* ── Panel header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
              War Room
            </span>
            {capture && (
              <span className="text-[10px] text-gray-600 font-mono">
                {capture.width}×{capture.height}
              </span>
            )}
            {shadowActive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-full">
                <Ghost size={9} className="animate-pulse" />
                Shadow Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Capture button */}
            <button
              onClick={handleCapture}
              disabled={scanning}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                scanning
                  ? "text-orange-400 bg-orange-500/10 animate-pulse cursor-not-allowed"
                  : "text-gray-600 hover:text-orange-400 hover:bg-orange-500/8 border border-white/5"
              }`}
            >
              <Scan size={10} />
              {scanning ? "Scanning…" : "Capture"}
            </button>

            {/* Expand vision toggle */}
            {capture && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-gray-700 hover:text-gray-400 transition-colors"
                title={expanded ? "Collapse preview" : "Expand preview"}
              >
                {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            )}

            {/* Collapse panel */}
            <button
              onClick={() => setCollapsed(v => !v)}
              className="text-gray-700 hover:text-gray-400 transition-colors"
              title={collapsed ? "Expand war room" : "Collapse war room"}
            >
              {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>
        </div>

        {/* ── Panel body ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Model guidance warning */}
              {guidance && (
                <div className="px-4 py-2 bg-amber-500/8 border-b border-amber-500/15 flex items-start justify-between gap-2">
                  <p className="text-[11px] text-amber-400 leading-relaxed flex-1">{guidance}</p>
                  <button onClick={() => setGuidance(null)} className="text-[10px] text-amber-600 hover:text-amber-400 shrink-0">Dismiss</button>
                </div>
              )}

              <div className="flex gap-0 divide-x divide-white/5">
                {/* ── LEFT: Vision thumbnail / Shadow Mirror ──────────── */}
                <div className="w-1/2 shrink-0">
                  {hasActiveGhost && ghostFrames[activeGhostSlot] ? (
                    /* Parallel Ghost multi-context mirror (v4.9) */
                    <div className="flex flex-col">
                      {/* Slot selector tabs */}
                      <div className="flex border-b border-white/5">
                        {[0, 1, 2].map(s => ghostFrames[s] !== null && (
                          <button
                            key={s}
                            onClick={() => setActiveGhostSlot(s)}
                            className={`flex items-center gap-0.5 px-2 py-1 text-[9px] font-bold transition-colors ${
                              activeGhostSlot === s
                                ? "text-purple-400 border-b-2 border-purple-500"
                                : "text-gray-600 hover:text-gray-400"
                            }`}
                          >
                            <Ghost size={7} /> G{s + 1}
                          </button>
                        ))}
                      </div>
                      <div className={`relative overflow-hidden transition-all duration-300 ${expanded ? "max-h-[300px]" : "max-h-[110px]"}`}>
                        <img
                          src={`data:image/jpeg;base64,${ghostFrames[activeGhostSlot]}`}
                          alt={`Ghost ${activeGhostSlot + 1}`}
                          className="w-full object-contain"
                        />
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 bg-black/75 rounded-lg text-[9px] font-bold text-purple-400 border border-purple-500/30">
                          <Ghost size={8} className="animate-pulse" /> G{activeGhostSlot + 1}
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[8px] font-mono text-purple-300 border border-purple-500/20">
                          LIVE
                        </div>
                      </div>
                    </div>
                  ) : shadowActive && shadowFrame ? (
                    /* Shadow browser live mirror (v4.8 single context) */
                    <div className={`relative overflow-hidden transition-all duration-300 ${expanded ? "max-h-[300px]" : "max-h-[120px]"}`}>
                      <img
                        src={`data:image/jpeg;base64,${shadowFrame}`}
                        alt="Shadow browser"
                        className="w-full object-contain"
                      />
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 bg-black/75 rounded-lg text-[9px] font-bold text-purple-400 border border-purple-500/30">
                        <Ghost size={8} className="animate-pulse" /> SHADOW
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[8px] font-mono text-purple-300 border border-purple-500/20">
                        LIVE
                      </div>
                    </div>
                  ) : capture ? (
                    <div className={`relative overflow-hidden transition-all duration-300 ${expanded ? "max-h-[300px]" : "max-h-[120px]"}`}>
                      <canvas
                        ref={canvasRef}
                        className="w-full object-contain"
                        style={{ imageRendering: "auto" }}
                      />
                      {capture.elements && capture.elements.length > 0 && (
                        <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/70 rounded text-[9px] font-mono text-orange-400 border border-orange-500/20">
                          {capture.elements.length} elements
                        </div>
                      )}
                    </div>
                  ) : scanning ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-orange-400 text-xs animate-pulse">
                      <Scan size={13} className="animate-spin" /> Scanning…
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-gray-700 text-[11px]">
                      No capture yet
                    </div>
                  )}
                </div>

                {/* ── RIGHT: Workflow + Action log ───────────────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Workflow steps */}
                  {steps.length > 0 && (
                    <div className="border-b border-white/5">
                      {goal && (
                        <div className="px-3 py-1.5 border-b border-white/4 bg-white/[0.01]">
                          <p className="text-[10px] text-gray-500 truncate">
                            {t.workflow.goal}: <span className="text-gray-300">{goal}</span>
                          </p>
                        </div>
                      )}
                      <div className="p-2 space-y-1 max-h-[100px] overflow-y-auto scrollbar-hide">
                        {steps.map((step) => {
                          const Icon = STEP_ICONS[step.type] ?? Brain;
                          return (
                            <div
                              key={step.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium ${STEP_CLASSES[step.status]}`}
                            >
                              {step.status === "running" ? (
                                <Loader2 size={11} className="animate-spin text-orange-400 shrink-0" />
                              ) : step.status === "done" ? (
                                <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                              ) : (
                                <Icon size={11} className="text-gray-600 shrink-0" />
                              )}
                              <span className="flex-1 truncate">{step.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action log */}
                  {actions.length > 0 && (
                    <div className="flex-1 overflow-hidden">
                      <div className="px-3 py-1 border-b border-white/4">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Control Feed</span>
                      </div>
                      <div className="px-2 py-1 space-y-px overflow-y-auto max-h-[100px] scrollbar-hide font-mono">
                        {actions.map((entry) => {
                          const Icon  = ACTION_ICONS[entry.action] ?? MousePointerClick;
                          const color = ACTION_COLORS[entry.action] ?? "text-gray-500";
                          return (
                            <div key={entry.id} className="flex items-center gap-1.5 py-0.5">
                              <Icon size={10} className={`${color} shrink-0`} />
                              <span className={`text-[10px] ${color} truncate flex-1`}>{entry.label}</span>
                              <span className="text-[9px] text-gray-700 shrink-0 tabular-nums">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>
                            </div>
                          );
                        })}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
