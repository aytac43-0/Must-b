import { useEffect, useState, useRef } from "react";
import { ChatInput } from "./ChatInput";
import clsx from "clsx";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

function eventToMessage(type: string, data: Record<string, unknown>): Message | null {
  const id = `${Date.now()}-${Math.random()}`;
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
      const step = data.step as { description?: string } | undefined;
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

export function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      const { type, ...rest } = data;
      if (type === "planStart") setIsTyping(true);
      if (type === "planFinish") setIsTyping(false);
      const msg = eventToMessage(type, rest);
      if (msg) setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("agentUpdate");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    // Model guidance warning injected by ChatInput — render as system message, don't POST
    if (text.startsWith("__GUIDANCE__")) {
      const content = text.slice("__GUIDANCE__".length);
      setMessages((prev) => [...prev, {
        id: `guidance-${Date.now()}`,
        role: "system",
        content: `⚠ ${content}`,
        timestamp: Date.now(),
      }]);
      return;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    try {
      await apiFetch("/api/goal", {
        method: "POST",
        body: JSON.stringify({ goal: text }),
      });
    } catch {
      setIsTyping(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#02040a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-20" />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto w-full px-6 pt-16 pb-12">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
              <div className="relative w-44 h-44 mb-8 group cursor-pointer">
                <div className="absolute inset-0 bg-orange-500 rounded-full blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
                <div className="absolute inset-4 bg-amber-400 rounded-full blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-full h-full p-2">
                  <img
                    src="/logo.png"
                    alt="Must-b"
                    className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_30px_rgba(234,88,12,0.6)]"
                  />
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
                  <div
                    className={clsx(
                      "max-w-[80%] rounded-2xl px-6 py-4 text-[15px] leading-relaxed transition-all shadow-xl",
                      message.role === "user"
                        ? "bg-orange-600/10 border border-orange-500/20 text-white"
                        : message.role === "system"
                        ? "bg-white/5 border border-white/10 text-gray-400 text-xs font-mono"
                        : "glass border-white/5 text-gray-200"
                    )}
                  >
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
