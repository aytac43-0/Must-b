import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { BookmarkPlus, CheckCircle2, Loader2 } from "lucide-react";
import { ChatInput }   from "./ChatInput";
import clsx            from "clsx";
import { getSocket }   from "@/lib/socket";
import { apiFetch }    from "@/lib/api";

type Message = {
  id:        string;
  role:      "user" | "assistant" | "system";
  content:   string;
  timestamp: number;
};

// Minimal skill context captured from a completed workflow
interface CompletedWorkflow {
  goal:   string;
  answer: string;
  steps:  { description: string; tool?: string }[];
}

function eventToMessage(type: string, data: Record<string, unknown>): Message | null {
  const id        = `${Date.now()}-${Math.random()}`;
  const timestamp = (data.timestamp as number) ?? Date.now();
  switch (type) {
    case "planStart":
      return { id, role: "system", content: `Planning: "${data.goal}"`, timestamp };
    case "planGenerated": {
      const steps = data.steps as unknown[];
      return { id, role: "system", content: `Plan ready — ${steps?.length ?? 0} step(s)`, timestamp };
    }
    case "stepStart": {
      const step = data.step as { description?: string };
      return { id, role: "system", content: `▶ ${step?.description ?? JSON.stringify(data.step)}`, timestamp };
    }
    case "stepFinish": {
      if (data.status === "error") {
        return { id, role: "system", content: `✗ Error: ${data.error}`, timestamp };
      }
      const step   = data.step as { description?: string } | undefined;
      const result = (data.result as string) ?? `✓ ${step?.description ?? "Step complete"}`;
      return { id, role: "assistant", content: result, timestamp };
    }
    case "finalAnswer":
      return { id, role: "assistant", content: String(data.answer ?? "Done."), timestamp };
    case "planFinish":
      if (data.status === "completed") return null;
      return { id, role: "system", content: `◼ Finished (${data.status})`, timestamp };
    default:
      return null;
  }
}

// ── Save-as-Skill banner ────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveSkillBanner({
  workflow,
  onDismiss,
}: {
  workflow:  CompletedWorkflow;
  onDismiss: () => void;
}) {
  const [state,     setState]     = useState<SaveState>("idle");
  const [skillName, setSkillName] = useState(
    workflow.goal.slice(0, 52) + (workflow.goal.length > 52 ? "…" : "")
  );

  const handleSave = async () => {
    setState("saving");
    try {
      const r = await apiFetch("/api/skills/save", {
        method: "POST",
        body:   JSON.stringify({
          goal:   workflow.goal,
          answer: workflow.answer,
          steps:  workflow.steps,
          name:   skillName.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState("saved");
      setTimeout(onDismiss, 1800);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.22 }}
      className="mx-auto max-w-4xl w-full px-6 mb-2"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-orange-500/6 border border-orange-500/20">
        {state === "saved" ? (
          <>
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-xs font-medium text-green-400">Skill saved to your library!</span>
          </>
        ) : (
          <>
            <BookmarkPlus size={14} className="text-orange-400 shrink-0" />
            <span className="text-[11px] text-gray-500 shrink-0 font-medium">Save as Skill:</span>
            <input
              value={skillName}
              onChange={e => setSkillName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && state === "idle" && handleSave()}
              placeholder="Skill name…"
              className="flex-1 bg-transparent text-[12px] text-gray-200 outline-none placeholder-gray-600 min-w-0"
            />
            <button
              onClick={handleSave}
              disabled={state !== "idle"}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-500/12 hover:bg-orange-500/22 border border-orange-500/22 text-orange-400 text-[11px] font-semibold transition-all shrink-0 disabled:opacity-50"
            >
              {state === "saving"
                ? <><Loader2 size={10} className="animate-spin" /> Saving…</>
                : state === "error"
                ? "Retry"
                : "Save"}
            </button>
            <button
              onClick={onDismiss}
              className="text-gray-700 hover:text-gray-400 transition-colors text-[11px] shrink-0"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Main ChatArea ───────────────────────────────────────────────────────────

export function ChatArea() {
  const [messages,          setMessages]          = useState<Message[]>([]);
  const [isTyping,          setIsTyping]          = useState(false);
  const [completedWorkflow, setCompletedWorkflow] = useState<CompletedWorkflow | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      const { type, ...rest } = data;

      if (type === "planStart")  setIsTyping(true);
      if (type === "planFinish") {
        setIsTyping(false);
        if (rest.status === "completed") {
          setCompletedWorkflow({
            goal:   String(rest.goal   ?? ""),
            answer: String(rest.answer ?? ""),
            steps:  (rest.steps as { description: string; tool?: string }[]) ?? [],
          });
        }
      }

      const msg = eventToMessage(type, rest);
      if (msg) setMessages((prev) => [...prev, msg]);
    });

    return () => { socket.off("agentUpdate"); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (text.startsWith("__GUIDANCE__")) {
      const content = text.slice("__GUIDANCE__".length);
      setMessages((prev) => [...prev, {
        id: `guidance-${Date.now()}`, role: "system",
        content: `⚠ ${content}`, timestamp: Date.now(),
      }]);
      return;
    }

    setCompletedWorkflow(null); // clear save prompt on new message
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    try {
      await apiFetch("/api/goal", { method: "POST", body: JSON.stringify({ goal: text }) });
    } catch {
      setIsTyping(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#02040a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-20" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto w-full px-6 pt-16 pb-12">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
              <div className="relative w-44 h-44 mb-8 group cursor-pointer">
                <div className="absolute inset-0 bg-orange-500 rounded-full blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
                <div className="absolute inset-4 bg-amber-400 rounded-full blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-full h-full p-2">
                  <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_30px_rgba(234,88,12,0.6)]" />
                </div>
              </div>
              <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                Must-b —{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                  Your Personal AI Brain
                </span>
              </h1>
              <p className="text-gray-400 text-xl font-medium max-w-2xl">
                Ask questions, manage automations, explore your data, and control your AI workflows — all in one place.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <div key={message.id} className={clsx("flex w-full group", message.role === "user" ? "justify-end" : "justify-start")}>
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 mr-4 mt-2">
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md" />
                        <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
                      </div>
                    </div>
                  )}
                  <div className={clsx(
                    "max-w-[80%] rounded-2xl px-6 py-4 text-[15px] leading-relaxed transition-all shadow-xl",
                    message.role === "user"
                      ? "bg-orange-600/10 border border-orange-500/20 text-white"
                      : message.role === "system"
                      ? "bg-white/5 border border-white/10 text-gray-400 text-xs font-mono"
                      : "glass border-white/5 text-gray-200"
                  )}>
                    <div className="whitespace-pre-wrap font-medium">{message.content}</div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex w-full justify-start animate-pulse">
                  <div className="flex-shrink-0 mr-4 mt-2">
                    <div className="relative w-8 h-8">
                      <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md" />
                      <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
                    </div>
                  </div>
                  <div className="glass border-white/5 rounded-2xl px-6 py-4 inline-flex items-center gap-1.5 shadow-xl">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Save-as-Skill banner — appears after a completed workflow */}
      <AnimatePresence>
        {completedWorkflow && !isTyping && (
          <SaveSkillBanner
            workflow={completedWorkflow}
            onDismiss={() => setCompletedWorkflow(null)}
          />
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="p-8 bg-[#02040a]">
        <div className="max-w-4xl mx-auto w-full">
          <ChatInput onSend={handleSend} disabled={isTyping} />
          <p className="text-center mt-4 text-[12px] text-gray-600 font-medium tracking-wide">
            Must-b can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}
