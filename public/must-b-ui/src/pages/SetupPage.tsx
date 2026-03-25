/**
 * Must-b Visual Setup Wizard (v1.5.0-alpha.4 — Phase 3.5)
 *
 * 5-Step Onboarding Seal:
 *   Step 1 — Identity & Locale   (name + language)
 *   Step 2 — AI Provider & Engine (dynamic grid + API key / Ollama scanner)
 *   Step 3 — Secure Workspace    (directory path)
 *   Step 4 — Voice & Wake Word   (toggle + mic permission test)
 *   Step 5 — Telemetry & Finalize (toggle + Initialize button)
 *
 * Persists to /api/setup/save → .env + UniversalStore.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronRight, ChevronLeft, Search,
  Cpu, MemoryStick, Zap, AlertTriangle,
  Folder, Mic, MicOff, ShieldCheck, Globe,
} from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────────

type ProviderCategory =
  | "frontier" | "gateway" | "fast" | "local" | "open"
  | "specialist" | "regional" | "enterprise" | "custom";

interface ProviderMeta {
  id: string; label: string; description: string;
  envKey: string; envKeyIsUrl: boolean;
  defaultModel: string; latestModels: string[];
  placeholder: string; category: ProviderCategory; tags: string[];
}

interface OllamaModel {
  id: string; name: string; modelId: string;
  description: string; params: string; ramGb: number;
  tags: string[]; fit: "recommended" | "marginal" | "warning";
}

interface HardwareInfo {
  ramGb: number; cpuCount: number; score: number; tier: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  frontier:   "⚡ Frontier",
  gateway:    "🌐 Gateway",
  fast:       "🚀 Fast Inference",
  local:      "💻 Local / Offline",
  open:       "🔓 Open Source Cloud",
  specialist: "🎯 Specialist",
  regional:   "🌏 Regional",
  enterprise: "🏢 Enterprise",
  custom:     "⚙️  Custom",
};

const CATEGORY_ORDER: ProviderCategory[] = [
  "frontier","gateway","fast","local","open","specialist","regional","enterprise","custom",
];

const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "tr-TR", label: "Türkçe" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "zh-CN", label: "中文 (简体)" },
  { value: "ja-JP", label: "日本語" },
  { value: "ar-SA", label: "العربية" },
];

const STEP_LABELS = [
  "Identity",
  "AI Engine",
  "Workspace",
  "Voice",
  "Finalize",
];

// ── Small sub-components ───────────────────────────────────────────────────────

function StepDot({ index, current }: { index: number; current: number }) {
  const done   = index < current;
  const active = index === current;
  return (
    <div className="flex items-center">
      <div className={clsx(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
        done   ? "bg-orange-500 text-white" :
        active ? "bg-orange-500/20 border-2 border-orange-500 text-orange-400" :
                 "bg-white/5 border border-white/10 text-gray-600",
      )}>
        {done ? <Check size={13} /> : index + 1}
      </div>
      {index < STEP_LABELS.length - 1 && (
        <div className={clsx(
          "w-8 h-px transition-colors duration-300",
          done ? "bg-orange-500/50" : "bg-white/10",
        )} />
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-gray-500 border border-white/8">
      {label}
    </span>
  );
}

function FitBadge({ fit }: { fit: OllamaModel["fit"] }) {
  if (fit === "recommended") return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
      <Check size={9} /> Recommended
    </span>
  );
  if (fit === "marginal") return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
      <Zap size={9} /> Marginal
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
      <AlertTriangle size={9} /> Heavy
    </span>
  );
}

/** Simple CSS toggle switch — no external deps. */
function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        "w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all text-left",
        checked
          ? "bg-orange-500/10 border-orange-500/30 text-white"
          : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white",
      )}
    >
      {/* Track */}
      <div className={clsx(
        "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200",
        checked ? "bg-orange-500" : "bg-white/15",
      )}>
        <div className={clsx(
          "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
          checked ? "left-6" : "left-1",
        )} />
      </div>
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SetupPage() {
  const navigate = useNavigate();

  // ── Remote data ────────────────────────────────────────────────────────────
  const [providers,        setProviders]        = useState<ProviderMeta[]>([]);
  const [ollamaModels,     setOllamaModels]     = useState<OllamaModel[]>([]);
  const [hardware,         setHardware]         = useState<HardwareInfo | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [defaultWorkspace, setDefaultWorkspace] = useState("~/Mustb-Projects");

  // ── Form state ─────────────────────────────────────────────────────────────
  const [step,          setStep]          = useState(0);
  const [name,          setName]          = useState("");
  const [language,      setLanguage]      = useState("en-US");
  const [provider,      setProvider]      = useState("openrouter");
  const [provSearch,    setProvSearch]    = useState("");
  const [apiKey,        setApiKey]        = useState("");
  const [ollamaUrl,     setOllamaUrl]     = useState("http://localhost:11434");
  const [ollamaModel,   setOllamaModel]   = useState("");
  const [workspacePath, setWorkspacePath] = useState("");
  const [wakeWord,      setWakeWord]      = useState(false);
  const [telemetry,     setTelemetry]     = useState(false);

  // Microphone permission test
  type MicState = "idle" | "testing" | "granted" | "denied";
  const [micState, setMicState] = useState<MicState>("idle");

  // Submit
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // ── Bootstrap remote data ──────────────────────────────────────────────────
  useEffect(() => {
    // Provider catalog
    fetch("/api/setup/providers")
      .then(r => r.ok ? r.json() : { providers: [] })
      .then((d: { providers?: ProviderMeta[] }) => {
        if (d.providers?.length) setProviders(d.providers);
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));

    // Default workspace path from OS
    fetch("/api/setup/workspace-default")
      .then(r => r.ok ? r.json() : null)
      .then((d: { suggested?: string } | null) => {
        if (d?.suggested) {
          setDefaultWorkspace(d.suggested);
          setWorkspacePath(d.suggested);
        }
      })
      .catch(() => {});
  }, []);

  // Ollama hardware + model list (only when provider === 'ollama')
  useEffect(() => {
    if (provider !== "ollama") return;
    fetch("/api/setup/ollama-models")
      .then(r => r.ok ? r.json() : null)
      .then((d: { models?: OllamaModel[]; hardware?: HardwareInfo } | null) => {
        if (d?.models)   setOllamaModels(d.models);
        if (d?.hardware) setHardware(d.hardware);
      })
      .catch(() => {});
  }, [provider]);

  // ── Derived helpers ────────────────────────────────────────────────────────
  const isOllama      = provider === "ollama";
  const selectedMeta  = providers.find(p => p.id === provider);

  const filteredProviders = useMemo(() => {
    const q = provSearch.toLowerCase().trim();
    if (!q) return providers;
    return providers.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [providers, provSearch]);

  const grouped = useMemo(() => {
    const g: Partial<Record<ProviderCategory, ProviderMeta[]>> = {};
    for (const p of filteredProviders) {
      if (!g[p.category]) g[p.category] = [];
      g[p.category]!.push(p);
    }
    return g;
  }, [filteredProviders]);

  // ── Navigation guards ──────────────────────────────────────────────────────
  const canNext = (): boolean => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: {
        if (isOllama) return ollamaUrl.trim().length > 0;
        return selectedMeta?.envKeyIsUrl ? true : apiKey.trim().length > 0;
      }
      case 2: return workspacePath.trim().length > 0;
      default: return true;
    }
  };

  // ── Mic permission test ───────────────────────────────────────────────────
  const testMic = async () => {
    setMicState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicState("granted");
    } catch {
      setMicState("denied");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:          name.trim() || "User",
        language,
        provider,
        apiKey:        isOllama ? ollamaUrl : apiKey,
        model:         isOllama ? ollamaModel : selectedMeta?.defaultModel,
        skills:        ["browser","terminal","memory","web_search","filesystem","git","vision","input","telegram","analyzer"],
        mode:          "local",
        workspacePath: workspacePath.trim() || defaultWorkspace,
        wakeWord,
        telemetry,
      };

      let res = await fetch("/api/setup/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      // Fallback to legacy endpoint if new one not found
      if (!res.ok && res.status === 404) {
        res = await fetch("/api/setup", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
      }
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-900/12 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 bg-orange-500 rounded-full blur-lg opacity-40 animate-pulse" />
              <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Setup Must-b</h1>
          <p className="text-gray-500 mt-1.5 text-sm">First-time configuration · 5 steps</p>
        </div>

        {/* Step progress dots */}
        <div className="flex justify-center items-center mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <StepDot index={i} current={step} />
              <span className={clsx(
                "text-[9px] font-bold uppercase tracking-widest transition-colors",
                i === step ? "text-orange-400" : i < step ? "text-orange-500/50" : "text-gray-700",
              )}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="glass rounded-2xl p-6 border border-white/8"
          >
            <p className="text-[10px] font-bold text-orange-500/60 uppercase tracking-widest mb-1">
              Step {step + 1} of {STEP_LABELS.length}
            </p>
            <h2 className="text-xl font-bold text-white mb-5">{STEP_LABELS[step]}</h2>

            {/* ── Step 1: Identity & Locale ─────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Your name</label>
                  <input
                    autoFocus type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canNext() && setStep(1)}
                    placeholder="e.g. Burak"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-base"
                  />
                  <p className="text-gray-600 text-xs">Used in greetings and memory. Editable anytime in Settings.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Language</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-sm appearance-none cursor-pointer"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.value} value={l.value} className="bg-[#0d1117] text-white">
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: AI Provider & Engine ─────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text" value={provSearch}
                    onChange={e => setProvSearch(e.target.value)}
                    placeholder="Search providers…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-sm"
                  />
                </div>

                {/* Scrollable provider grid */}
                <div className="max-h-[260px] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {loadingProviders ? (
                    <p className="text-center py-6 text-gray-600 text-sm">Loading providers…</p>
                  ) : (
                    CATEGORY_ORDER.map(cat => {
                      const items = grouped[cat];
                      if (!items?.length) return null;
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 px-1">
                            {CATEGORY_LABELS[cat]}
                          </p>
                          <div className="space-y-1">
                            {items.map(p => (
                              <button
                                key={p.id}
                                onClick={() => { setProvider(p.id); setApiKey(""); }}
                                className={clsx(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                                  provider === p.id
                                    ? "bg-orange-500/10 border-orange-500/40 text-white"
                                    : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white",
                                )}
                              >
                                <div className={clsx(
                                  "w-3 h-3 rounded-full border-2 flex-shrink-0 transition-all",
                                  provider === p.id ? "border-orange-500 bg-orange-500" : "border-gray-600",
                                )} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm leading-tight">{p.label}</p>
                                  <p className="text-xs text-gray-500 truncate">{p.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 max-w-[120px]">
                                  {p.tags.slice(0, 2).map(t => <Tag key={t} label={t} />)}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {!loadingProviders && filteredProviders.length === 0 && (
                    <p className="text-center py-6 text-gray-600 text-sm">No providers match "{provSearch}"</p>
                  )}
                </div>

                {/* Credential input — adapts to selected provider */}
                {isOllama ? (
                  <div className="space-y-3 pt-1 border-t border-white/6">
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Ollama Base URL</label>
                      <input
                        type="url" value={ollamaUrl}
                        onChange={e => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono text-sm"
                      />
                    </div>

                    {/* Hardware info + model picker */}
                    {hardware && (
                      <div className="flex items-center gap-4 rounded-xl bg-white/3 border border-white/8 px-3 py-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5"><MemoryStick size={11} className="text-orange-400" />{hardware.ramGb.toFixed(1)} GB RAM</span>
                        <span className="flex items-center gap-1.5"><Cpu size={11} className="text-orange-400" />{hardware.cpuCount} CPUs</span>
                        <span className="flex items-center gap-1.5"><Zap size={11} className="text-orange-400" />Score {hardware.score} · {hardware.tier}</span>
                      </div>
                    )}

                    {ollamaModels.length > 0 && (
                      <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1">
                        {ollamaModels.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setOllamaModel(m.modelId)}
                            className={clsx(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                              ollamaModel === m.modelId
                                ? "bg-orange-500/10 border-orange-500/40 text-white"
                                : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white",
                            )}
                          >
                            <div className={clsx("w-3 h-3 rounded-full border-2 flex-shrink-0",
                              ollamaModel === m.modelId ? "border-orange-500 bg-orange-500" : "border-gray-600")} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{m.name}</p>
                                <span className="text-[10px] text-gray-600 font-mono">{m.params}</span>
                              </div>
                              <p className="text-xs text-gray-500 truncate">{m.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <FitBadge fit={m.fit} />
                              <span className="text-[10px] text-gray-600">{m.ramGb} GB</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : selectedMeta ? (
                  <div className="space-y-2 pt-1 border-t border-white/6">
                    <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                      {selectedMeta.envKeyIsUrl ? "Base URL" : `${selectedMeta.label} API Key`}
                    </label>
                    <input
                      type={selectedMeta.envKeyIsUrl ? "url" : "password"}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={selectedMeta.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono text-sm"
                    />
                    {selectedMeta.latestModels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedMeta.latestModels.slice(0, 4).map(m => (
                          <span key={m} className="text-[11px] font-mono text-orange-400/60 bg-orange-500/5 border border-orange-500/10 px-2 py-0.5 rounded-lg">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-gray-600 text-xs">
                      Stored locally in <code className="text-orange-500/60">.env</code> — never sent to external servers.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Step 3: Secure Workspace ─────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Workspace Directory</label>
                  <div className="relative">
                    <Folder size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      autoFocus type="text"
                      value={workspacePath}
                      onChange={e => setWorkspacePath(e.target.value)}
                      placeholder={defaultWorkspace}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono text-sm"
                    />
                  </div>
                  <p className="text-gray-600 text-xs">
                    Must-b will read and write files <span className="text-orange-500/70 font-medium">only within this directory</span>.
                    The folder will be created if it doesn't exist.
                  </p>
                </div>

                {/* Security notice */}
                <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/8 px-4 py-3">
                  <ShieldCheck size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Must-b operates in a sandboxed workspace. It cannot access files outside
                    this directory unless you explicitly provide a path in a prompt.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 4: Voice & Wake Word ────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <Toggle
                  checked={wakeWord}
                  onChange={setWakeWord}
                  label='Enable "Hey Must-b" Wake Word'
                  description="Always-on voice activation — must-b-ui listens passively via your microphone."
                />

                {/* Mic permission test */}
                <div className="rounded-xl bg-white/3 border border-white/8 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Test Microphone Permission</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {micState === "idle"    && "Click to verify your browser can access the microphone."}
                        {micState === "testing" && "Requesting permission…"}
                        {micState === "granted" && "Microphone access granted ✓"}
                        {micState === "denied"  && "Permission denied — check browser settings."}
                      </p>
                    </div>
                    <button
                      onClick={testMic}
                      disabled={micState === "testing"}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
                        micState === "granted"
                          ? "bg-green-500/10 border border-green-500/20 text-green-400 cursor-default"
                          : micState === "denied"
                          ? "bg-red-500/10 border border-red-500/20 text-red-400"
                          : "bg-white/5 border border-white/10 text-gray-300 hover:border-white/25 hover:text-white",
                      )}
                    >
                      {micState === "granted" ? (
                        <><Check size={12} /> Granted</>
                      ) : micState === "denied" ? (
                        <><MicOff size={12} /> Denied</>
                      ) : (
                        <><Mic size={12} /> Test</>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-gray-700 text-xs px-1">
                  Wake word and microphone can be reconfigured at any time in Settings → Voice.
                </p>
              </div>
            )}

            {/* ── Step 5: Telemetry & Finalize ─────────────────────────── */}
            {step === 4 && (
              <div className="space-y-5">
                <Toggle
                  checked={telemetry}
                  onChange={setTelemetry}
                  label="Send anonymous crash reports"
                  description="Helps improve Must-b. No personal data, no conversation content — only error traces."
                />

                {/* Summary card */}
                <div className="rounded-xl bg-white/3 border border-white/6 px-4 py-4 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Configuration Summary</p>
                  {[
                    { label: "Name",      value: name || "—" },
                    { label: "Language",  value: LANGUAGES.find(l => l.value === language)?.label ?? language },
                    { label: "Provider",  value: providers.find(p => p.id === provider)?.label ?? provider },
                    { label: "Workspace", value: (workspacePath || defaultWorkspace).replace(/^.*\/([^/]+\/[^/]+)$/, "…/$1") },
                    { label: "Wake Word", value: wakeWord ? "Enabled" : "Disabled" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="text-gray-300 font-mono truncate max-w-[200px]">{row.value}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Big Initialize button */}
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-base transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Initializing…</>
                  ) : (
                    <><span className="text-lg">🚀</span> Initialize Must-b</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation — hidden on step 5 (big button handles it) */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-25 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Back button on step 5 */}
        {step === 4 && (
          <div className="flex justify-start mt-5">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
            >
              <ChevronLeft size={16} /> Back
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-700 mt-5">
          All settings saved locally · Run <code className="text-orange-500/60">must-b doctor</code> to verify
        </p>
      </div>
    </div>
  );
}
