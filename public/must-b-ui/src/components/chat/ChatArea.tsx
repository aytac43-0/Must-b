/**
 * Must-b ChatArea (v1.5.0-alpha.4)
 *
 * Phase 4: War Room UI Overhaul
 *   - Turn-based model (user/assistant pairs) instead of flat message list
 *   - No chat bubbles — full-width ChatGPT/Anthropic Console aesthetic
 *   - Raw JSON and system logs hidden behind a collapsible "Thought Process" accordion
 *   - Final answers rendered with a lightweight inline Markdown renderer
 *     (fenced code blocks + copy, bold, italic, inline code, headings, lists)
 *   - Typing indicator lives inside the pending assistant turn, not as a separate item
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
} from "lucide-react";
import { ChatInput } from "./ChatInput";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompletedWorkflow {
  goal:  string;
  answer: string;
  steps: { description: string; tool?: string }[];
}

interface Turn {
  id:       string;
  kind:     "user" | "assistant";
  content:  string;           // user text  OR  final assistant answer
  thoughts: string[];         // intermediate step/system messages (hidden by default)
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

/** Convert a socket event into a single-line thought string, or null to ignore. */
function eventToThought(
  type: string,
  data: Record<string, unknown>,
): string | null {
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
      return result && result.length < 180
        ? `✓ ${base} → ${result}`
        : `✓ ${base}`;
    }
    case "agentRepair": {
      const action = safeStr(data.action);
      const reason = data.reason ? ` — ${safeStr(data.reason).slice(0, 120)}` : "";
      return `⟳ Repair: ${action}${reason}`;
    }
    default:
      return null;
  }
}

// ── Markdown renderer (no external deps) ──────────────────────────────────────

/** Copy-to-clipboard code block with language label. */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-white/8 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/6 select-none">
        <span className="text-[11px] font-mono text-gray-600">{lang || "code"}</span>
        <button
          onClick={doCopy}
          className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-orange-400 transition-colors"
        >
          {copied ? (
            <><Check size={10} className="text-green-400" /><span className="text-green-400">Copied</span></>
          ) : (
            <><Copy size={10} />Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[13px] text-gray-300 font-mono leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Process inline markdown: `code`, **bold**, *italic* */
function inlineRender(text: string, baseKey: string): ReactNode {
  // Split on inline code spans first to avoid false matches inside them
  const codeParts = text.split(/(`[^`\n]+`)/);
  return codeParts.map((part, ci) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={`${baseKey}-ic${ci}`}
          className="px-1.5 py-0.5 rounded bg-white/8 text-orange-300/90 font-mono text-[13px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold and italic in remaining text
    const boldItalic = part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/);
    return (
      <Fragment key={`${baseKey}-bi${ci}`}>
        {boldItalic.map((sp, bi) => {
          if (sp.startsWith("**") && sp.endsWith("**") && sp.length > 4) {
            return <strong key={`${baseKey}-b${ci}-${bi}`} className="font-semibold text-white">{sp.slice(2, -2)}</strong>;
          }
          if (sp.startsWith("*") && sp.endsWith("*") && sp.length > 2) {
            return <em key={`${baseKey}-em${ci}-${bi}`} className="italic text-gray-300">{sp.slice(1, -1)}</em>;
          }
          return <span key={`${baseKey}-s${ci}-${bi}`}>{sp}</span>;
        })}
      </Fragment>
    );
  });
}

/** Block-level markdown → React nodes. */
function Markdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const lines = text.split("\n");
  let i   = 0;
  let seq = 0;
  const k = () => `md-${seq++}`;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────────────────
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang: string       = fence[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      nodes.push(<CodeBlock key={k()} lang={lang} code={codeLines.join("\n")} />);
      continue;
    }

    // ── Headings ────────────────────────────────────────────────────────────
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      nodes.push(<h3 key={k()} className="text-base font-bold text-white mt-5 mb-1.5">{inlineRender(h3[1], k())}</h3>);
      i++; continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      nodes.push(<h2 key={k()} className="text-lg font-bold text-white mt-6 mb-2">{inlineRender(h2[1], k())}</h2>);
      i++; continue;
    }
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      nodes.push(<h1 key={k()} className="text-xl font-bold text-white mt-7 mb-2">{inlineRender(h1[1], k())}</h1>);
      i++; continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────────
    if (line.match(/^[-*]{3,}$/)) {
      nodes.push(<hr key={k()} className="border-white/8 my-5" />);
      i++; continue;
    }

    // ── Bullet list ─────────────────────────────────────────────────────────
    if (line.match(/^[-*•] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        items.push(lines[i].replace(/^[-*•] /, ""));
        i++;
      }
      nodes.push(
        <ul key={k()} className="my-3 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-gray-200 text-[15px] leading-relaxed">
              <span className="mt-[8px] w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
              <span>{inlineRender(item, `ul-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Numbered list ───────────────────────────────────────────────────────
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={k()} className="my-3 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-gray-200 text-[15px] leading-relaxed">
              <span className="flex-shrink-0 mt-px text-orange-500/60 font-mono text-[13px] w-5 text-right">{idx + 1}.</span>
              <span>{inlineRender(item, `ol-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Blank line ──────────────────────────────────────────────────────────
    if (line.trim() === "") { i++; continue; }

    // ── Paragraph (consecutive non-special lines) ───────────────────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^(```|#{1,3} |[-*•] |\d+\. |[-*]{3,}$)/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      nodes.push(
        <p key={k()} className="text-gray-200 text-[15px] leading-[1.75] my-2">
          {inlineRender(paraLines.join(" "), `p-${seq}`)}
        </p>
      );
    }
  }

  return <div>{nodes}</div>;
}

// ── Save-as-Skill banner ────────────────────────────────────────────────────────

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
        body: JSON.stringify({
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="mt-4"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-orange-500/6 border border-orange-500/20">
        {state === "saved" ? (
          <>
            <CheckCircle2 size={13} className="text-green-400 shrink-0" />
            <span className="text-xs font-medium text-green-400">Skill saved to your library!</span>
          </>
        ) : (
          <>
            <BookmarkPlus size={13} className="text-orange-400 shrink-0" />
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

// ── Error Boundary ─────────────────────────────────────────────────────────────

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message ?? "Unknown render error" };
  }
  override componentDidCatch(err: Error, info: { componentStack: string }) {
    console.error("[ChatErrorBoundary]", err, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="text-2xl">⚠️</span>
          <p className="text-orange-400 font-bold text-sm">Chat render error</p>
          <p className="text-gray-600 text-xs font-mono max-w-sm break-all">{this.state.error}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main ChatArea ──────────────────────────────────────────────────────────────

export function ChatArea() {
  const [turns, setTurns]     = useState<Turn[]>([]);
  const activeTurnIdRef       = useRef<string | null>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);

  /** Derived — true while any assistant turn is still pending */
  const isTyping = turns.some(t => t.kind === "assistant" && t.status === "pending");

  // ── Socket event handler ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    socket.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      const { type, ...rest } = data;

      // ── planStart → create a new pending assistant turn ──────────────────
      if (type === "planStart") {
        const id = `asst-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeTurnIdRef.current = id;
        setTurns(prev => [
          ...prev,
          { id, kind: "assistant", content: "", thoughts: [], status: "pending" },
        ]);
        return;
      }

      // ── finalAnswer → set turn content ───────────────────────────────────
      if (type === "finalAnswer") {
        const id = activeTurnIdRef.current;
        if (!id) return;
        const answer = safeStr(rest.answer ?? "Done.");
        setTurns(prev =>
          prev.map(t => t.id === id ? { ...t, content: answer } : t)
        );
        return;
      }

      // ── planFinish → seal the turn ────────────────────────────────────────
      if (type === "planFinish") {
        const id = activeTurnIdRef.current;
        if (!id) return;
        const status: Turn["status"] = rest.status === "failed" ? "error" : "done";
        const workflow: CompletedWorkflow | undefined =
          rest.status === "completed"
            ? {
                goal:   String(rest.goal   ?? ""),
                answer: String(rest.answer ?? ""),
                steps:  (rest.steps as { description: string; tool?: string }[]) ?? [],
              }
            : undefined;
        setTurns(prev =>
          prev.map(t =>
            t.id === id
              ? { ...t, status, ...(workflow ? { workflow } : {}) }
              : t
          )
        );
        activeTurnIdRef.current = null;
        return;
      }

      // ── All other events → thought log ────────────────────────────────────
      const thought = eventToThought(type, rest);
      if (!thought) return;
      const id = activeTurnIdRef.current;
      if (!id) return;
      setTurns(prev =>
        prev.map(t =>
          t.id === id ? { ...t, thoughts: [...t.thoughts, thought] } : t
        )
      );
    });

    return () => { socket.off("agentUpdate"); };
  }, []);

  // Auto-scroll to bottom on new turns/updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // ── Send handler ─────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    // Guidance messages from ChatInput (e.g. wake-word alerts)
    if (text.startsWith("__GUIDANCE__")) {
      const content = text.slice("__GUIDANCE__".length);
      setTurns(prev => [
        ...prev,
        { id: `guidance-${Date.now()}`, kind: "assistant", content: `ℹ ${content}`, thoughts: [], status: "done" },
      ]);
      return;
    }

    // Clear any completed-workflow save prompt on new message
    setTurns(prev => prev.map(t => ({ ...t, workflow: undefined })));

    const id = `user-${Date.now()}`;
    setTurns(prev => [
      ...prev,
      { id, kind: "user", content: text, thoughts: [], status: "done" },
    ]);

    try {
      await apiFetch("/api/goal", {
        method: "POST",
        body: JSON.stringify({ goal: text }),
      });
    } catch {
      /* planFinish 'failed' will arrive via socket */
    }
  };

  const hasMessages = turns.length > 0;

  return (
    <ChatErrorBoundary>
      <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#02040a]">

        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-orange-900/8 rounded-full blur-[120px]" />
        </div>

        {/* ── Scroll area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
          <div className="max-w-3xl mx-auto w-full px-6 pt-16 pb-8">

            {/* ── Empty / wake state ──────────────────────────────────────── */}
            {!hasMessages && (
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center select-none">
                <div className="relative w-36 h-36 mb-8 cursor-pointer group">
                  <div className="absolute inset-0 bg-orange-500 rounded-full blur-[55px] opacity-35 group-hover:opacity-55 transition-opacity duration-700 animate-pulse" />
                  <div className="absolute inset-4 bg-amber-400 rounded-full blur-[28px] opacity-12 group-hover:opacity-30 transition-opacity duration-700" />
                  <img
                    src="/logo.png"
                    alt="Must-b"
                    className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_28px_rgba(234,88,12,0.55)]"
                  />
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
                  Must-b —{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                    Your AI Brain
                  </span>
                </h1>
                <p className="text-gray-500 text-base font-medium max-w-md leading-relaxed">
                  Ask questions, automate tasks, browse the web, manage files — all in one place.
                </p>
              </div>
            )}

            {/* ── Conversation turns ──────────────────────────────────────── */}
            {hasMessages && (
              <div>
                {turns.map(turn => {

                  // ── User turn ────────────────────────────────────────────
                  if (turn.kind === "user") {
                    return (
                      <div key={turn.id} className="flex justify-end mb-6">
                        <div className="max-w-[78%]">
                          <div className="bg-orange-600/10 border border-orange-500/20 rounded-2xl rounded-br-sm px-5 py-3.5 text-white text-[15px] leading-relaxed whitespace-pre-wrap">
                            {turn.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Assistant turn ───────────────────────────────────────
                  const hasThoughts = turn.thoughts.length > 0;
                  const hasAnswer   = turn.content.length > 0;
                  const isPending   = turn.status === "pending";
                  const isError     = turn.status === "error" && !hasAnswer;

                  return (
                    <div key={turn.id} className="mb-10">

                      {/* Avatar + label row */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="relative w-5 h-5 flex-shrink-0">
                          <div className="absolute inset-0 bg-orange-500/25 rounded-full blur-sm" />
                          <img
                            src="/logo.png"
                            alt="Must-b"
                            className="w-full h-full object-contain relative z-10"
                          />
                        </div>
                        <span className="text-[12px] font-semibold text-orange-400/80 tracking-wide">
                          Must-b
                        </span>
                        {hasThoughts && (
                          <span className="text-[10px] text-gray-700 font-mono">
                            {turn.thoughts.length} step{turn.thoughts.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Thought process accordion — hidden by default once answer arrives */}
                      {hasThoughts && (
                        <details
                          className="mb-4 group"
                          {...(!hasAnswer ? { open: true } : {})}
                        >
                          <summary className="flex items-center gap-1.5 cursor-pointer list-none select-none w-fit">
                            <ChevronRight
                              size={11}
                              className="text-gray-600 group-open:rotate-90 transition-transform duration-150 flex-shrink-0"
                            />
                            <span className="text-[11px] font-medium text-gray-600 hover:text-gray-400 transition-colors">
                              Thought Process
                            </span>
                          </summary>
                          <div className="mt-2.5 ml-3.5 pl-3.5 border-l border-white/6 space-y-1.5">
                            {turn.thoughts.map((thought, idx) => (
                              <p
                                key={idx}
                                className="text-[12px] font-mono text-gray-600 leading-relaxed break-all"
                              >
                                {thought}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Main content area */}
                      {hasAnswer ? (
                        <Markdown text={turn.content} />
                      ) : isPending ? (
                        <div className="flex items-center gap-1.5 py-1">
                          {[0, 150, 300].map(delay => (
                            <div
                              key={delay}
                              className="w-1.5 h-1.5 bg-orange-400/70 rounded-full animate-bounce"
                              style={{ animationDelay: `-${delay}ms` }}
                            />
                          ))}
                        </div>
                      ) : isError ? (
                        <p className="text-sm text-red-400/80">
                          Something went wrong. Please try again.
                        </p>
                      ) : null}

                      {/* Save-as-Skill banner (only after agentic workflows) */}
                      <AnimatePresence>
                        {turn.workflow && !isPending && (
                          <SaveSkillBanner
                            workflow={turn.workflow}
                            onDismiss={() =>
                              setTurns(prev =>
                                prev.map(t =>
                                  t.id === turn.id ? { ...t, workflow: undefined } : t
                                )
                              )
                            }
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <div ref={bottomRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="relative z-10 border-t border-white/5 bg-[#02040a]/95 backdrop-blur-sm px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} disabled={isTyping} />
            <p className="text-center mt-3 text-[11px] text-gray-700 font-medium tracking-wide">
              Must-b can make mistakes — verify critical information.
            </p>
          </div>
        </div>

      </div>
    </ChatErrorBoundary>
  );
}
