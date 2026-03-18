/**
 * MobilePage — Must-b Companion (v4.6)
 *
 * Mobile-optimized companion interface. Reads `?token=` from the URL and
 * connects to the /mobile socket.io namespace with that token.
 *
 * Sections:
 *  1. Header — logo + connection status
 *  2. Voice Command — large push-to-talk microphone button
 *  3. Workflow Monitor — live step cards fed from /mobile namespace
 *  4. Skills Runner — list of saved skills with Run buttons
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence }                  from "framer-motion";
import { io, Socket }                               from "socket.io-client";
import {
  Mic, MicOff, Loader2, CheckCircle2, AlertCircle,
  Zap, Play, RefreshCw, Wifi, WifiOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  id:          string;
  description: string;
  status:      "running" | "done" | "error";
}

interface SavedSkill {
  id:       string;
  name:     string;
  goal:     string;
  runCount: number;
}

type ConnState = "connecting" | "connected" | "disconnected" | "denied";
type MicState  = "idle" | "recording" | "sending";

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokenFromURL(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MobilePage() {
  const [conn,     setConn]     = useState<ConnState>("connecting");
  const [steps,    setSteps]    = useState<WorkflowStep[]>([]);
  const [skills,   setSkills]   = useState<SavedSkill[]>([]);
  const [micState, setMicState] = useState<MicState>("idle");
  const [runningId,setRunningId]= useState<string | null>(null);
  const [transcript,setTranscript] = useState("");

  const socketRef     = useRef<Socket | null>(null);
  const mediaRef      = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const token         = tokenFromURL();

  // ── Socket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setConn("denied"); return; }

    const s = io(`${window.location.origin}/mobile`, {
      query:      { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = s;

    s.on("connect",    () => setConn("connected"));
    s.on("disconnect", () => setConn("disconnected"));
    s.on("authError",  () => { setConn("denied"); s.disconnect(); });

    s.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      const { type } = data;

      if (type === "planStart") {
        setSteps([]);
      }

      if (type === "stepStart") {
        const step = data.step as { description?: string } | undefined;
        setSteps(prev => [...prev, {
          id:          `${Date.now()}-${Math.random()}`,
          description: step?.description ?? "Working…",
          status:      "running",
        }]);
      }

      if (type === "stepFinish") {
        setSteps(prev => {
          const copy = [...prev];
          const last = copy.findLastIndex(s => s.status === "running");
          if (last >= 0) copy[last] = { ...copy[last], status: data.status === "error" ? "error" : "done" };
          return copy;
        });
      }

      if (type === "skillRunStart" && data.skillId) {
        setRunningId(data.skillId as string);
      }

      if (type === "planFinish") {
        setRunningId(null);
      }
    });

    return () => { s.disconnect(); };
  }, [token]);

  // ── Skills loader ──────────────────────────────────────────────────────────
  const loadSkills = useCallback(async () => {
    try {
      const r = await fetch(`/api/skills/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json() as { skills: SavedSkill[] };
        setSkills(d.skills ?? []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec    = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        sendVoice();
      };
      rec.start();
      mediaRef.current = rec;
      setMicState("recording");
    } catch {
      setMicState("idle");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setMicState("sending");
  };

  const sendVoice = async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");
    try {
      const r = await fetch("/api/voice/transcribe", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      if (r.ok) {
        const { text } = await r.json() as { text: string };
        setTranscript(text);
        // Submit as goal
        await fetch("/api/goal", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ goal: text }),
        });
      }
    } catch { /* silent */ }
    setMicState("idle");
  };

  // ── Run a skill ────────────────────────────────────────────────────────────
  const runSkill = async (skill: SavedSkill) => {
    if (runningId) return;
    setRunningId(skill.id);
    try {
      await fetch("/api/skills/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ id: skill.id }),
      });
    } catch {
      setRunningId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!token || conn === "denied") {
    return (
      <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center gap-4 text-center px-8">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-white font-bold text-xl">Access Denied</p>
        <p className="text-gray-500 text-sm">This link is invalid or has expired.<br />Generate a new QR code from your desktop.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02040a] text-white flex flex-col pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Must-b" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Must-b</span>
          <span className="text-[10px] text-orange-400 font-medium bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full">
            Companion
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {conn === "connected" ? (
            <><Wifi size={13} className="text-green-400" /><span className="text-green-400">Connected</span></>
          ) : conn === "connecting" ? (
            <><Loader2 size={13} className="animate-spin text-orange-400" /><span className="text-orange-400">Connecting…</span></>
          ) : (
            <><WifiOff size={13} className="text-gray-600" /><span className="text-gray-500">Offline</span></>
          )}
        </div>
      </div>

      {/* ── Voice Button ── */}
      <div className="flex flex-col items-center justify-center py-10 px-6 border-b border-white/5">
        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-widest mb-6">Voice Command</p>
        <motion.button
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={micState === "recording" ? stopRecording : undefined}
          disabled={micState === "sending" || conn !== "connected"}
          whileTap={{ scale: 0.93 }}
          className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all select-none ${
            micState === "recording"
              ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
              : micState === "sending"
              ? "bg-orange-500/10 border-2 border-orange-500/30"
              : "bg-orange-500/10 border-2 border-orange-500/40 hover:bg-orange-500/20 active:scale-95"
          } disabled:opacity-40`}
        >
          {micState === "sending" ? (
            <Loader2 size={36} className="text-orange-400 animate-spin" />
          ) : micState === "recording" ? (
            <MicOff size={36} className="text-red-400" />
          ) : (
            <Mic size={36} className="text-orange-400" />
          )}

          {micState === "recording" && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-red-500"
              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
        </motion.button>
        <p className="text-[12px] text-gray-600 mt-4">
          {micState === "recording" ? "Listening… release to send" : "Hold to speak"}
        </p>
        {transcript && (
          <p className="text-[11px] text-orange-300 mt-3 text-center max-w-xs">
            "{transcript}"
          </p>
        )}
      </div>

      {/* ── Workflow Monitor ── */}
      <div className="px-5 pt-6 pb-4 border-b border-white/5">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Live Workflow</p>

        <AnimatePresence>
          {steps.length === 0 ? (
            <p className="text-[12px] text-gray-700 text-center py-4">No active workflow</p>
          ) : (
            <div className="space-y-2">
              {steps.slice(-6).map((step) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-[12px] ${
                    step.status === "running"
                      ? "bg-orange-500/8 border-orange-500/20"
                      : step.status === "error"
                      ? "bg-red-500/8 border-red-500/15"
                      : "bg-white/3 border-white/5"
                  }`}
                >
                  {step.status === "running" && <Loader2 size={12} className="animate-spin text-orange-400 mt-0.5 shrink-0" />}
                  {step.status === "done"    && <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />}
                  {step.status === "error"   && <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />}
                  <span className={
                    step.status === "running" ? "text-orange-300" :
                    step.status === "error"   ? "text-red-300" :
                    "text-gray-400"
                  }>
                    {step.description}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Skills Runner ── */}
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">My Skills</p>
          <button onClick={loadSkills} className="text-gray-600 hover:text-gray-400 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>

        {skills.length === 0 ? (
          <p className="text-[12px] text-gray-700 text-center py-6">No skills saved yet</p>
        ) : (
          <div className="space-y-2.5">
            {skills.map((skill) => {
              const isRunning = runningId === skill.id;
              return (
                <motion.div
                  key={skill.id}
                  layout
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                    isRunning
                      ? "bg-orange-500/10 border-orange-500/25"
                      : "bg-[#0c0f18] border-white/6"
                  }`}
                >
                  <Zap size={14} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-white truncate">{skill.name}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{skill.runCount}× run</p>
                  </div>
                  <button
                    onClick={() => runSkill(skill)}
                    disabled={!!runningId}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                      isRunning
                        ? "bg-orange-500/15 text-orange-400 border border-orange-500/25 cursor-not-allowed"
                        : "bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    {isRunning ? "Running" : "Run"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
