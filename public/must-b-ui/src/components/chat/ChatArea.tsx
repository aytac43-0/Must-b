/**
 * Must-b ChatArea (v1.11.0) — Glassmorphism Dark (ref: dashboard new.jpeg)
 *
 * Empty state : Massive "Must-b" hero title + centered glass input.
 * Message state: Conversation turns (dark-glass user / white-glass assistant)
 *                + glass input bar pinned at the bottom.
 *
 * Background comes from body gradient in index.css — this component is transparent.
 */
import {
  Component,
  type ReactNode,
  useEffect,
  useState,
  useRef,
  Fragment,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookmarkPlus,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Copy,
  Check,
  ArrowRight,
  Mic,
  MicOff,
  Send,
} from "lucide-react";
import { getSocket }  from "@/lib/socket";
import { apiFetch }   from "@/lib/api";
import { useI18n }    from "@/i18n";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompletedWorkflow {
  goal:   string;
  answer: string;
  steps:  { description: string; tool?: string }[];
}

interface Turn {
  id:       string;
  kind:     "user" | "assistant";
  content:  string;
  thoughts: string[];
  status:   "pending" | "done" | "error";
  workflow?: CompletedWorkflow;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function safeStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.text ?? o.content ?? o.result;
    if (msg !== undefined) return safeStr(msg);
    return JSON.stringify(v);
  }
  return String(v);
}

function eventToThought(type: string, data: Record<string, unknown>): string | null {
  switch (type) {
    case "planGenerated": {
      const steps = data.steps as unknown[];
      return `Plan ready — ${steps?.length ?? 0} step(s)`;
    }
    case "stepStart": {
      const step = data.step as { description?: string } | undefined;
      return `▶ ${step?.description ?? safeStr(data.step)}`;
    }
    case "stepFinish": {
      if (data.status === "error") return `✗ ${safeStr(data.error)}`;
      const step   = data.step as { description?: string } | undefined;
      const result = data.result !== undefined ? safeStr(data.result) : undefined;
      const base   = step?.description ?? "Step complete";
      return result && result.length < 180 ? `✓ ${base} → ${result}` : `✓ ${base}`;
    }
    case "agentRepair": {
      const action = safeStr(data.action);
      const reason = data.reason ? ` — ${safeStr(data.reason).slice(0, 120)}` : "";
      return `⟳ Repair: ${action}${reason}`;
    }
    default: return null;
  }
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/8 bg-[#1a0800]/90">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/6 select-none">
        <span className="text-[11px] font-mono text-orange-300/50">{lang || "code"}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-[11px] text-orange-300/50 hover:text-orange-200 transition-colors"
        >
          {copied
            ? <><Check size={10} className="text-orange-400" /><span className="text-orange-400">Copied</span></>
            : <><Copy size={10} />Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[13px] text-orange-50 font-mono leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function inlineRender(text: string, baseKey: string): ReactNode {
  const codeParts = text.split(/(`[^`\n]+`)/);
  return codeParts.map((part, ci) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={`${baseKey}-ic${ci}`} className="px-1.5 py-0.5 rounded bg-black/15 text-orange-700 font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const boldItalic = part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/);
    return (
      <Fragment key={`${baseKey}-bi${ci}`}>
        {boldItalic.map((sp, bi) => {
          if (sp.startsWith("**") && sp.endsWith("**") && sp.length > 4)
            return <strong key={`${baseKey}-b${ci}-${bi}`} className="font-bold text-[#1a0c06]">{sp.slice(2, -2)}</strong>;
          if (sp.startsWith("*") && sp.endsWith("*") && sp.length > 2)
            return <em key={`${baseKey}-em${ci}-${bi}`} className="italic">{sp.slice(1, -1)}</em>;
          return <span key={`${baseKey}-s${ci}-${bi}`}>{sp}</span>;
        })}
      </Fragment>
    );
  });
}

function Markdown({ text, dark = false }: { text: string; dark?: boolean }) {
  const textCls = dark ? "text-orange-50" : "text-[#3d1a06]";
  const nodes: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0, seq = 0;
  const k = () => `md-${seq++}`;

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang: string = fence[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      if (i < lines.length) i++;
      nodes.push(<CodeBlock key={k()} lang={lang} code={codeLines.join("\n")} />);
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) { nodes.push(<h3 key={k()} className={`text-sm font-bold mt-4 mb-1 ${textCls}`}>{inlineRender(h3[1], k())}</h3>); i++; continue; }
    const h2 = line.match(/^## (.+)/);
    if (h2) { nodes.push(<h2 key={k()} className={`text-base font-bold mt-5 mb-1.5 ${textCls}`}>{inlineRender(h2[1], k())}</h2>); i++; continue; }
    const h1 = line.match(/^# (.+)/);
    if (h1) { nodes.push(<h1 key={k()} className={`text-lg font-bold mt-6 mb-2 ${textCls}`}>{inlineRender(h1[1], k())}</h1>); i++; continue; }
    if (line.match(/^[-*]{3,}$/)) { nodes.push(<hr key={k()} className="border-black/10 my-4" />); i++; continue; }
    if (line.match(/^[-*•] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) { items.push(lines[i].replace(/^[-*•] /, "")); i++; }
      nodes.push(
        <ul key={k()} className="my-2 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className={`flex items-start gap-2.5 text-[14px] leading-relaxed ${textCls}`}>
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
              <span>{inlineRender(item, `ul-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      nodes.push(
        <ol key={k()} className="my-2 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className={`flex items-start gap-2.5 text-[14px] leading-relaxed ${textCls}`}>
              <span className="flex-shrink-0 mt-px font-mono text-[12px] w-5 text-right text-orange-600/60">{idx + 1}.</span>
              <span>{inlineRender(item, `ol-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(```|#{1,3} |[-*•] |\d+\. |[-*]{3,}$)/)) {
      paraLines.push(lines[i]); i++;
    }
    if (paraLines.length) {
      nodes.push(
        <p key={k()} className={`text-[14px] leading-[1.75] my-1.5 ${textCls}`}>
          {inlineRender(paraLines.join(" "), `p-${seq}`)}
        </p>
      );
    }
  }
  return <div>{nodes}</div>;
}

// ── Save-as-Skill banner ────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveSkillBanner({ workflow, onDismiss }: { workflow: CompletedWorkflow; onDismiss: () => void }) {
  const [state, setState]       = useState<SaveState>("idle");
  const [skillName, setSkillName] = useState(workflow.goal.slice(0, 52) + (workflow.goal.length > 52 ? "…" : ""));

  const handleSave = async () => {
    setState("saving");
    try {
      const r = await apiFetch("/api/skills/save", {
        method: "POST",
        body: JSON.stringify({ goal: workflow.goal, answer: workflow.answer, steps: workflow.steps, name: skillName.trim() || undefined }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState("saved");
      setTimeout(onDismiss, 1800);
    } catch { setState("error"); setTimeout(() => setState("idle"), 3000); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }} className="mt-3">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-orange-900/20 border border-orange-600/30">
        {state === "saved" ? (
          <><CheckCircle2 size={13} className="text-orange-400 shrink-0" /><span className="text-xs font-medium text-orange-400">Skill saved!</span></>
        ) : (
          <>
            <BookmarkPlus size={13} className="text-orange-600 shrink-0" />
            <span className="text-[11px] text-orange-200 shrink-0 font-medium">Save as Skill:</span>
            <input value={skillName} onChange={e => setSkillName(e.target.value)} onKeyDown={e => e.key === "Enter" && state === "idle" && handleSave()} placeholder="Skill name…" className="flex-1 bg-transparent text-[12px] text-orange-100 outline-none placeholder-orange-600/50 min-w-0" />
            <button onClick={handleSave} disabled={state !== "idle"} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 border border-orange-800/40 text-orange-200 text-[11px] font-semibold transition-all shrink-0 disabled:opacity-50">
              {state === "saving" ? <><Loader2 size={10} className="animate-spin" /> Saving…</> : state === "error" ? "Retry" : "Save"}
            </button>
            <button onClick={onDismiss} className="text-orange-700 hover:text-orange-500 transition-colors text-[11px] shrink-0">✕</button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Error Boundary ─────────────────────────────────────────────────────────────

class ChatErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err: Error) { return { error: err.message ?? "Unknown error" }; }
  override componentDidCatch(err: Error, info: { componentStack: string }) { console.error("[ChatErrorBoundary]", err, info.componentStack); }
  override render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-400 font-bold text-sm">Chat render error</p>
          <p className="text-orange-200/70 text-xs font-mono max-w-sm break-all">{this.state.error}</p>
          <button onClick={() => this.setState({ error: null })} className="mt-1 px-4 py-2 rounded-xl bg-orange-900/20 border border-orange-800/30 text-orange-200 text-xs font-bold hover:bg-orange-900/40 transition-all">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Hero Input (centered, deep green glass) ───────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function HeroInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled?: boolean }) {
  const { t }            = useI18n();
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const hasSR = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setValue(t);
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    recRef.current = rec; rec.start(); setListening(true);
  };

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    if (listening) { recRef.current?.stop(); }
    setValue(""); onSend(text);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-input rounded-2xl flex items-center gap-3 px-5 py-4">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
          placeholder={listening ? t.chat.listening : "What do you want to know?"}
          disabled={disabled}
          className="flex-1 bg-transparent text-white/90 placeholder-white/35 text-[16px] outline-none min-w-0 leading-relaxed"
        />
        <div className="flex items-center gap-2 shrink-0">
          {hasSR && (
            <button
              type="button"
              onClick={toggleMic}
              className={`p-2 rounded-full transition-all ${listening ? "text-orange-300 bg-orange-800/40 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/8"}`}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              value.trim() && !disabled
                ? "bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] active:scale-95"
                : "bg-white/10 text-white/25 cursor-not-allowed"
            }`}
          >
            {disabled
              ? <Loader2 size={16} className="animate-spin text-white/50" />
              : <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bottom input bar (message mode) ───────────────────────────────────────────

function BottomInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled?: boolean }) {
  const { t }            = useI18n();
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const taRef  = useRef<HTMLTextAreaElement>(null);

  const hasSR = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setValue(txt);
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    recRef.current = rec; rec.start(); setListening(true);
  };

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    if (listening) { recRef.current?.stop(); }
    setValue(""); onSend(text);
  };

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="max-w-3xl mx-auto">
        <div className="glass-input rounded-2xl flex items-end gap-3 px-5 py-3">
          <textarea
            ref={taRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={listening ? t.chat.listening : "What do you want to know?"}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-white/90 placeholder-white/35 text-[15px] outline-none resize-none min-h-[28px] max-h-[160px] scrollbar-hide leading-relaxed"
          />
          <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
            {hasSR && (
              <button onClick={toggleMic} className={`p-2 rounded-full transition-all ${listening ? "text-orange-300 bg-orange-800/40 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/8"}`}>
                {listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                value.trim() && !disabled
                  ? "bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] active:scale-95"
                  : "bg-white/10 text-white/25 cursor-not-allowed"
              }`}
            >
              {disabled ? <Loader2 size={14} className="animate-spin text-white/50" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ChatArea ──────────────────────────────────────────────────────────────

export function ChatArea() {
  const [turns, setTurns]   = useState<Turn[]>([]);
  const activeTurnIdRef     = useRef<string | null>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const isTyping = turns.some(t => t.kind === "assistant" && t.status === "pending");

  useEffect(() => {
    const socket = getSocket();
    socket.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      const { type, ...rest } = data;

      if (type === "planStart") {
        const id = `asst-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeTurnIdRef.current = id;
        setTurns(prev => [...prev, { id, kind: "assistant", content: "", thoughts: [], status: "pending" }]);
        return;
      }
      if (type === "finalAnswer") {
        const id = activeTurnIdRef.current;
        if (!id) return;
        setTurns(prev => prev.map(t => t.id === id ? { ...t, content: safeStr(rest.answer ?? "Done.") } : t));
        return;
      }
      if (type === "planFinish") {
        const id = activeTurnIdRef.current;
        if (!id) return;
        const status: Turn["status"] = rest.status === "failed" ? "error" : "done";
        const workflow: CompletedWorkflow | undefined =
          rest.status === "completed"
            ? { goal: String(rest.goal ?? ""), answer: String(rest.answer ?? ""), steps: (rest.steps as { description: string; tool?: string }[]) ?? [] }
            : undefined;
        setTurns(prev => prev.map(t => t.id === id ? { ...t, status, ...(workflow ? { workflow } : {}) } : t));
        activeTurnIdRef.current = null;
        return;
      }
      const thought = eventToThought(type, rest);
      if (!thought) return;
      const id = activeTurnIdRef.current;
      if (!id) return;
      setTurns(prev => prev.map(t => t.id === id ? { ...t, thoughts: [...t.thoughts, thought] } : t));
    });
    return () => { socket.off("agentUpdate"); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const handleSend = async (text: string) => {
    if (text.startsWith("__GUIDANCE__")) {
      const content = text.slice("__GUIDANCE__".length);
      setTurns(prev => [...prev, { id: `guidance-${Date.now()}`, kind: "assistant", content: `ℹ ${content}`, thoughts: [], status: "done" }]);
      return;
    }
    setTurns(prev => prev.map(t => ({ ...t, workflow: undefined })));
    setTurns(prev => [...prev, { id: `user-${Date.now()}`, kind: "user", content: text, thoughts: [], status: "done" }]);
    try { await apiFetch("/api/goal", { method: "POST", body: JSON.stringify({ goal: text }) }); }
    catch { /* planFinish 'failed' arrives via socket */ }
  };

  const hasMessages = turns.length > 0;

  return (
    <ChatErrorBoundary>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Empty / hero state ──────────────────────────────────────── */}
        {!hasMessages && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 select-none">
            {/* Massive title */}
            <motion.h1
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-black leading-none tracking-tighter mb-10 text-center"
              style={{
                fontSize: "clamp(5rem, 18vw, 12rem)",
                color: "#0a0400",
                textShadow: "0 0 80px rgba(249,115,22,0.5), 0 0 160px rgba(249,115,22,0.25)",
              }}
            >
              Must-b
            </motion.h1>

            {/* Centered glass input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
              className="w-full max-w-2xl"
            >
              <HeroInput onSend={handleSend} disabled={isTyping} />
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1.2 }}
              className="mt-10 flex flex-col items-center gap-1"
            >
              <div className="w-6 h-9 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
                <div className="w-1 h-2 rounded-full bg-white/30 animate-bounce" />
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Conversation turns ──────────────────────────────────────── */}
        {hasMessages && (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="max-w-3xl mx-auto w-full px-5 pt-6 pb-4">
                {turns.map(turn => {

                  // ── User turn ────────────────────────────────────────
                  if (turn.kind === "user") {
                    return (
                      <div key={turn.id} className="flex justify-end mb-5">
                        <div className="max-w-[78%]">
                          <div
                            className="rounded-2xl rounded-br-sm px-5 py-3 text-white text-[14px] leading-relaxed whitespace-pre-wrap"
                            style={{ background: "rgba(25,10,2,0.72)", border: "1px solid rgba(249,115,22,0.22)", backdropFilter: "blur(12px)" }}
                          >
                            {turn.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Assistant turn ───────────────────────────────────
                  const hasThoughts = turn.thoughts.length > 0;
                  const hasAnswer   = turn.content.length > 0;
                  const isPending   = turn.status === "pending";
                  const isError     = turn.status === "error" && !hasAnswer;

                  return (
                    <div key={turn.id} className="mb-8">
                      {/* Avatar row */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="relative w-5 h-5 shrink-0">
                          <div className="absolute inset-0 bg-orange-600/30 rounded-full blur-sm" />
                          <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
                        </div>
                        <span className="text-[12px] font-semibold text-white/70 tracking-wide">Must-b</span>
                        {hasThoughts && (
                          <span className="text-[10px] text-white/35 font-mono">
                            {turn.thoughts.length} step{turn.thoughts.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Thought accordion */}
                      {hasThoughts && (
                        <details className="mb-3 group" {...(!hasAnswer ? { open: true } : {})}>
                          <summary className="flex items-center gap-1.5 cursor-pointer list-none select-none w-fit">
                            <ChevronRight size={11} className="text-white/30 group-open:rotate-90 transition-transform duration-150 flex-shrink-0" />
                            <span className="text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors">
                              Thought Process
                            </span>
                          </summary>
                          <div className="mt-2 ml-3.5 pl-3.5 border-l border-white/10 space-y-1">
                            {turn.thoughts.map((thought, idx) => (
                              <p key={idx} className="text-[11px] font-mono text-white/35 leading-relaxed break-all">{thought}</p>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Answer card */}
                      {hasAnswer ? (
                        <div
                          className="rounded-2xl px-5 py-4"
                          style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(0,0,0,0.06)", backdropFilter: "blur(16px)" }}
                        >
                          <Markdown text={turn.content} dark={false} />
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-1.5 py-2 px-1">
                          {[0, 150, 300].map(delay => (
                            <div key={delay} className="w-2 h-2 bg-orange-500/60 rounded-full animate-bounce" style={{ animationDelay: `-${delay}ms` }} />
                          ))}
                        </div>
                      ) : isError ? (
                        <p className="text-sm text-red-400/80">Something went wrong. Please try again.</p>
                      ) : null}

                      <AnimatePresence>
                        {turn.workflow && !isPending && (
                          <SaveSkillBanner
                            workflow={turn.workflow}
                            onDismiss={() => setTurns(prev => prev.map(t => t.id === turn.id ? { ...t, workflow: undefined } : t))}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                <div ref={bottomRef} className="h-2" />
              </div>
            </div>

            {/* Bottom input bar */}
            <BottomInput onSend={handleSend} disabled={isTyping} />
          </>
        )}
      </div>
    </ChatErrorBoundary>
  );
}
