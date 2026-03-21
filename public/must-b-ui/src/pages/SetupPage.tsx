import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Zap, Globe, Package, Users, Monitor } from "lucide-react";
import clsx from "clsx";
import CloudSyncButton from "@/components/CloudSyncButton";

// ── Types ────────────────────────────────────────────────────────────────────

interface Provider { id: string; label: string; description: string; keyLabel: string; placeholder: string; }
interface Skill    { id: string; label: string; description: string; icon: React.ElementType; }

const PROVIDERS: Provider[] = [
  { id: "openrouter", label: "OpenRouter",       description: "Access 100+ models via one API",     keyLabel: "OpenRouter API Key",  placeholder: "sk-or-v1-..." },
  { id: "openai",     label: "OpenAI",            description: "GPT-4o, o1 and more",                keyLabel: "OpenAI API Key",      placeholder: "sk-..." },
  { id: "anthropic",  label: "Anthropic",         description: "Claude 3.5, Claude 4 models",        keyLabel: "Anthropic API Key",   placeholder: "sk-ant-..." },
  { id: "ollama",     label: "Ollama (Local)",    description: "Run models 100% locally, no cost",   keyLabel: "Ollama Base URL",     placeholder: "http://localhost:11434" },
];

const SKILLS: Skill[] = [
  { id: "browser",    label: "Browser Automation", description: "Playwright Chromium — web scraping & interaction", icon: Globe },
  { id: "terminal",   label: "Terminal Access",     description: "Execute shell commands, git, npm",                icon: Monitor },
  { id: "memory",     label: "Long-Term Memory",    description: "SQLite FTS5 — remembers context across sessions", icon: Package },
  { id: "web_search", label: "Web Search",          description: "Search via Playwright browser (DuckDuckGo)",      icon: Zap },
  { id: "filesystem", label: "Filesystem",          description: "Read/write files in the workspace",               icon: Users },
];

// ── Step indicators ──────────────────────────────────────────────────────────

function StepDot({ index, current, total }: { index: number; current: number; total: number }) {
  const done = index < current;
  const active = index === current;
  return (
    <div className="flex items-center">
      <div className={clsx(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
        done   ? "bg-orange-500 text-white" :
        active ? "bg-orange-500/20 border-2 border-orange-500 text-orange-400" :
                 "bg-white/5 border border-white/10 text-gray-600"
      )}>
        {done ? <Check size={14} /> : index + 1}
      </div>
      {index < total - 1 && (
        <div className={clsx("w-12 h-px transition-colors duration-300", done ? "bg-orange-500/50" : "bg-white/10")} />
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName]       = useState("");
  const [provider, setProvider] = useState("openrouter");
  const [apiKey, setApiKey]   = useState("");
  const [skills, setSkills]   = useState<string[]>(SKILLS.map(s => s.id));
  const [mode, setMode]       = useState<"local" | "world">("local");

  const STEPS = ["Who are you?", "LLM Provider", "API Key", "Skills", "Mode"];
  const totalSteps = STEPS.length;

  const toggleSkill = (id: string) =>
    setSkills(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 2) return apiKey.trim().length > 0;
    if (step === 3) return skills.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "User", provider, apiKey, skills, mode }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Setup failed");
      }
      navigate("/app");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-900/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 bg-orange-500 rounded-full blur-lg opacity-40 animate-pulse" />
              <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Setup Must-b</h1>
          <p className="text-gray-500 mt-2 text-sm">First-time configuration wizard · {totalSteps} steps</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center items-center mb-8">
          {STEPS.map((_, i) => <StepDot key={i} index={i} current={step} total={totalSteps} />)}
        </div>

        {/* Step card */}
        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="glass rounded-2xl p-8 border border-white/8"
            >
              {/* Step label */}
              <p className="text-xs font-bold text-orange-500/70 uppercase tracking-widest mb-1">
                Step {step + 1} of {totalSteps}
              </p>
              <h2 className="text-xl font-bold text-white mb-6">{STEPS[step]}</h2>

              {/* ── Step 0: Name ── */}
              {step === 0 && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Your name</label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canNext() && setStep(1)}
                    placeholder="e.g. Mustafa"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-base"
                  />
                  <p className="text-gray-600 text-xs">Used in greetings and memory. Can be changed later.</p>
                </div>
              )}

              {/* ── Step 1: Provider ── */}
              {step === 1 && (
                <div className="space-y-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={clsx(
                        "w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left",
                        provider === p.id
                          ? "bg-orange-500/10 border-orange-500/40 text-white"
                          : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                      )}
                    >
                      <div className={clsx("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                        provider === p.id ? "border-orange-500 bg-orange-500" : "border-gray-600")} />
                      <div>
                        <p className="font-semibold text-sm">{p.label}</p>
                        <p className="text-xs text-gray-500">{p.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Step 2: API Key ── */}
              {step === 2 && (
                <div className="space-y-3">
                  {(() => {
                    const prov = PROVIDERS.find(p => p.id === provider)!;
                    return (
                      <>
                        <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">{prov.keyLabel}</label>
                        <input
                          autoFocus
                          type="password"
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && canNext() && setStep(3)}
                          placeholder={prov.placeholder}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm"
                        />
                        <p className="text-gray-600 text-xs">
                          Stored locally in <code className="text-orange-500/70">.env</code> — never sent to external servers.
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── Step 3: Skills ── */}
              {step === 3 && (
                <div className="space-y-2">
                  {SKILLS.map(s => {
                    const Icon = s.icon;
                    const active = skills.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSkill(s.id)}
                        className={clsx(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left",
                          active
                            ? "bg-orange-500/10 border-orange-500/40 text-white"
                            : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                        )}
                      >
                        <div className={clsx("w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                          active ? "border-orange-500 bg-orange-500" : "border-gray-600")}>
                          {active && <Check size={12} />}
                        </div>
                        <Icon size={16} className={active ? "text-orange-400" : "text-gray-600"} />
                        <div>
                          <p className="font-semibold text-sm">{s.label}</p>
                          <p className="text-xs text-gray-500">{s.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Step 4: Mode ── */}
              {step === 4 && (
                <div className="space-y-3">
                  {(["local", "world"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={clsx(
                        "w-full flex items-start gap-4 px-4 py-4 rounded-xl border transition-all text-left",
                        mode === m
                          ? "bg-orange-500/10 border-orange-500/40 text-white"
                          : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                      )}
                    >
                      <div className={clsx("mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                        mode === m ? "border-orange-500 bg-orange-500" : "border-gray-600")} />
                      <div>
                        <p className="font-semibold text-sm capitalize">{m} mode</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m === "local"
                            ? "Single machine, no external identity. Fastest and most private."
                            : "Cross-device sync with a unique MUSTB_UID. Enables multi-device access."}
                        </p>
                      </div>
                    </button>
                  ))}

                  {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Finish Setup
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          All settings saved locally · Run <code className="text-orange-500/60">must-b doctor</code> to verify
        </p>
      </div>

      {/* Fixed bottom-right: Cloud login + memory file ingestion */}
      <CloudSyncButton />
    </div>
  );
}
