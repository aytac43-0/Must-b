/**
 * Must-b Visual Setup Wizard (v1.5.0-alpha.3)
 *
 * Phase 3: Unrestricted Web Setup Intelligence.
 * - Fetches the full provider catalog dynamically from /api/setup/providers
 * - Searchable, categorised provider grid — no hardcoded HTML
 * - Hardware-aware Ollama model picker (live from /api/setup/ollama-models)
 * - Saves via /api/setup/save with full UniversalStore sync
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Search, Cpu, MemoryStick, Zap, AlertTriangle, Globe, Package, Users, Monitor } from "lucide-react";
import clsx from "clsx";
import CloudSyncButton from "@/components/CloudSyncButton";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProviderCategory = 'frontier' | 'gateway' | 'fast' | 'local' | 'open' | 'specialist' | 'regional' | 'enterprise' | 'custom';

interface ProviderMeta {
  id: string;
  label: string;
  description: string;
  envKey: string;
  envKeyIsUrl: boolean;
  defaultModel: string;
  latestModels: string[];
  placeholder: string;
  category: ProviderCategory;
  tags: string[];
}

interface OllamaModel {
  id: string;
  name: string;
  modelId: string;
  description: string;
  params: string;
  ramGb: number;
  tags: string[];
  fit: 'recommended' | 'marginal' | 'warning';
}

interface HardwareInfo {
  ramGb: number;
  cpuCount: number;
  score: number;
  tier: string;
}

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  frontier:   '⚡ Frontier',
  gateway:    '🌐 Gateway',
  fast:       '🚀 Fast Inference',
  local:      '💻 Local / Offline',
  open:       '🔓 Open Source Cloud',
  specialist: '🎯 Specialist',
  regional:   '🌏 Regional',
  enterprise: '🏢 Enterprise',
  custom:     '⚙️  Custom',
};

const CATEGORY_ORDER: ProviderCategory[] = ['frontier', 'gateway', 'fast', 'local', 'open', 'specialist', 'regional', 'enterprise', 'custom'];

const SKILLS = [
  { id: "browser",    label: "Browser Automation", description: "Playwright Chromium — web scraping & interaction", icon: Globe },
  { id: "terminal",   label: "Terminal Access",     description: "Execute shell commands, git, npm",                icon: Monitor },
  { id: "memory",     label: "Long-Term Memory",    description: "SQLite FTS5 — remembers context across sessions", icon: Package },
  { id: "web_search", label: "Web Search",          description: "Search via Playwright browser (DuckDuckGo)",      icon: Zap },
  { id: "filesystem", label: "Filesystem",          description: "Read/write files in the workspace",               icon: Users },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ index, current, total }: { index: number; current: number; total: number }) {
  const done   = index < current;
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
        <div className={clsx("w-10 h-px transition-colors duration-300", done ? "bg-orange-500/50" : "bg-white/10")} />
      )}
    </div>
  );
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

function Tag({ label }: { label: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-gray-500 border border-white/8">
      {label}
    </span>
  );
}

// ── Fit badge for Ollama models ───────────────────────────────────────────────

function FitBadge({ fit }: { fit: OllamaModel['fit'] }) {
  if (fit === 'recommended') return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
      <Check size={9} /> Recommended
    </span>
  );
  if (fit === 'marginal') return (
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

// ── Main component ────────────────────────────────────────────────────────────

export default function SetupPage() {
  const navigate = useNavigate();

  // Remote data
  const [providers,     setProviders]     = useState<ProviderMeta[]>([]);
  const [ollamaModels,  setOllamaModels]  = useState<OllamaModel[]>([]);
  const [hardware,      setHardware]      = useState<HardwareInfo | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Form state
  const [name,          setName]          = useState("");
  const [provider,      setProvider]      = useState("openrouter");
  const [provSearch,    setProvSearch]    = useState("");
  const [apiKey,        setApiKey]        = useState("");
  const [ollamaUrl,     setOllamaUrl]     = useState("http://localhost:11434");
  const [ollamaModel,   setOllamaModel]   = useState("");
  const [skills,        setSkills]        = useState(SKILLS.map(s => s.id));
  const [mode,          setMode]          = useState<"local" | "world">("local");

  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Fetch provider catalog
  useEffect(() => {
    fetch("/api/setup/providers")
      .then(r => r.ok ? r.json() : { providers: [] })
      .then((d: { providers?: ProviderMeta[] }) => {
        if (d.providers?.length) setProviders(d.providers);
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  // Fetch Ollama hardware+model data when Ollama is selected
  useEffect(() => {
    if (provider !== 'ollama') return;
    fetch("/api/setup/ollama-models")
      .then(r => r.ok ? r.json() : null)
      .then((d: { models?: OllamaModel[]; hardware?: HardwareInfo } | null) => {
        if (d?.models)   setOllamaModels(d.models);
        if (d?.hardware) setHardware(d.hardware);
      })
      .catch(() => {});
  }, [provider]);

  // Dynamic steps — Ollama adds an extra model-selection step
  const isOllama = provider === 'ollama';
  const STEPS = isOllama
    ? ["Who are you?", "LLM Provider", "Ollama Setup", "Model", "Skills", "Mode"]
    : ["Who are you?", "LLM Provider", "API Key",      "Skills", "Mode"];
  const totalSteps = STEPS.length;

  // Filtered provider list
  const filteredProviders = useMemo(() => {
    const q = provSearch.toLowerCase().trim();
    if (!q) return providers;
    return providers.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [providers, provSearch]);

  // Grouped for display
  const grouped = useMemo(() => {
    const g: Partial<Record<ProviderCategory, ProviderMeta[]>> = {};
    for (const p of filteredProviders) {
      if (!g[p.category]) g[p.category] = [];
      g[p.category]!.push(p);
    }
    return g;
  }, [filteredProviders]);

  const toggleSkill = (id: string) =>
    setSkills(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const selectedMeta = providers.find(p => p.id === provider);

  // Step key → consistent indices regardless of Ollama branch
  // Step 0: name, Step 1: provider, Step 2: key/ollama-url, Step 3: (ollama) model / skills, Step 4: (ollama) skills / mode, Step 5: mode
  const stepKey = isOllama
    ? ['name', 'provider', 'ollama_url', 'ollama_model', 'skills', 'mode'][step]
    : ['name', 'provider', 'apikey', 'skills', 'mode'][step];

  const canNext = () => {
    if (stepKey === 'name')        return name.trim().length > 0;
    if (stepKey === 'apikey')      return selectedMeta?.envKeyIsUrl ? true : apiKey.trim().length > 0;
    if (stepKey === 'ollama_url')  return ollamaUrl.trim().length > 0;
    if (stepKey === 'skills')      return skills.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name:     name.trim() || "User",
        provider,
        skills,
        mode,
        model: isOllama ? ollamaModel : selectedMeta?.defaultModel,
      };

      if (isOllama) {
        payload.apiKey = ollamaUrl;
      } else {
        payload.apiKey = apiKey;
      }

      // Try /api/setup/save first (Phase 3); fall back to legacy /api/setup
      let res = await fetch("/api/setup/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
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

  return (
    <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-900/15 rounded-full blur-[100px]" />
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
          <p className="text-gray-500 mt-1.5 text-sm">First-time configuration · {totalSteps} steps</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center items-center mb-6">
          {STEPS.map((_, i) => <StepDot key={i} index={i} current={step} total={totalSteps} />)}
        </div>

        {/* Step card */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={step + '-' + stepKey}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-2xl p-6 border border-white/8"
            >
              <p className="text-xs font-bold text-orange-500/70 uppercase tracking-widest mb-1">
                Step {step + 1} of {totalSteps}
              </p>
              <h2 className="text-xl font-bold text-white mb-5">{STEPS[step]}</h2>

              {/* ── Step: Name ── */}
              {stepKey === 'name' && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Your name</label>
                  <input
                    autoFocus type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canNext() && setStep(1)}
                    placeholder="e.g. Mustafa"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-base"
                  />
                  <p className="text-gray-600 text-xs">Used in greetings and memory. Can be changed later.</p>
                </div>
              )}

              {/* ── Step: Provider (searchable grid) ── */}
              {stepKey === 'provider' && (
                <div className="space-y-3">
                  {/* Search bar */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text" value={provSearch}
                      onChange={e => setProvSearch(e.target.value)}
                      placeholder="Search providers…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-sm"
                    />
                  </div>

                  {/* Scrollable provider grid */}
                  <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {loadingProviders ? (
                      <div className="text-center py-8 text-gray-600 text-sm">Loading providers…</div>
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
                                      : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                                  )}
                                >
                                  <div className={clsx("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all",
                                    provider === p.id ? "border-orange-500 bg-orange-500" : "border-gray-600")} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-tight">{p.label}</p>
                                    <p className="text-xs text-gray-500 truncate">{p.description}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 max-w-[140px]">
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
                      <p className="text-center py-8 text-gray-600 text-sm">No providers match "{provSearch}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step: API Key ── */}
              {stepKey === 'apikey' && selectedMeta && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                    {selectedMeta.envKeyIsUrl ? 'Base URL' : `${selectedMeta.label} API Key`}
                  </label>
                  <input
                    autoFocus
                    type={selectedMeta.envKeyIsUrl ? "url" : "password"}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canNext() && setStep(s => s + 1)}
                    placeholder={selectedMeta.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono text-sm"
                  />
                  {/* Latest models hint */}
                  {selectedMeta.latestModels.length > 0 && (
                    <div className="rounded-xl bg-white/3 border border-white/8 px-3 py-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Latest models</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMeta.latestModels.map(m => (
                          <span key={m} className="text-[11px] font-mono text-orange-400/70 bg-orange-500/5 border border-orange-500/10 px-2 py-0.5 rounded-lg">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-gray-600 text-xs">
                    Stored locally in <code className="text-orange-500/70">.env</code> — never sent to external servers.
                  </p>
                </div>
              )}

              {/* ── Step: Ollama URL ── */}
              {stepKey === 'ollama_url' && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold">Ollama Base URL</label>
                  <input
                    autoFocus type="url" value={ollamaUrl}
                    onChange={e => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono text-sm"
                  />
                  <p className="text-gray-600 text-xs">
                    Default is <code className="text-orange-500/60">http://localhost:11434</code>.
                    Use a remote IP for Ollama on another machine.
                  </p>
                </div>
              )}

              {/* ── Step: Ollama Model (hardware-aware) ── */}
              {stepKey === 'ollama_model' && (
                <div className="space-y-3">
                  {/* Hardware info bar */}
                  {hardware && (
                    <div className="flex items-center gap-4 rounded-xl bg-white/3 border border-white/8 px-3 py-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5"><MemoryStick size={12} className="text-orange-400" />{hardware.ramGb.toFixed(1)} GB RAM</span>
                      <span className="flex items-center gap-1.5"><Cpu size={12} className="text-orange-400" />{hardware.cpuCount} CPUs</span>
                      <span className="flex items-center gap-1.5"><Zap size={12} className="text-orange-400" />Score {hardware.score} · {hardware.tier}</span>
                    </div>
                  )}

                  {/* Model list */}
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                    {ollamaModels.length === 0 ? (
                      <p className="text-center py-8 text-gray-600 text-sm">Loading model list…</p>
                    ) : (
                      ollamaModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setOllamaModel(m.modelId)}
                          className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                            ollamaModel === m.modelId
                              ? "bg-orange-500/10 border-orange-500/40 text-white"
                              : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                          )}
                        >
                          <div className={clsx("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
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
                      ))
                    )}
                  </div>
                  {ollamaModel && (
                    <p className="text-xs text-orange-400/70">
                      Selected: <code className="font-mono">{ollamaModel}</code>
                    </p>
                  )}
                  <p className="text-gray-600 text-xs">
                    Run <code className="text-orange-500/60">ollama pull {ollamaModel || "model:tag"}</code> if the model isn't installed yet.
                  </p>
                </div>
              )}

              {/* ── Step: Skills ── */}
              {stepKey === 'skills' && (
                <div className="space-y-1.5">
                  {SKILLS.map(s => {
                    const Icon   = s.icon;
                    const active = skills.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleSkill(s.id)}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                          active ? "bg-orange-500/10 border-orange-500/40 text-white"
                                 : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                        )}
                      >
                        <div className={clsx("w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                          active ? "border-orange-500 bg-orange-500" : "border-gray-600")}>
                          {active && <Check size={10} />}
                        </div>
                        <Icon size={15} className={active ? "text-orange-400" : "text-gray-600"} />
                        <div>
                          <p className="font-semibold text-sm">{s.label}</p>
                          <p className="text-xs text-gray-500">{s.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Step: Mode ── */}
              {stepKey === 'mode' && (
                <div className="space-y-3">
                  {(["local", "world"] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={clsx(
                        "w-full flex items-start gap-4 px-4 py-4 rounded-xl border transition-all text-left",
                        mode === m ? "bg-orange-500/10 border-orange-500/40 text-white"
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
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
              ) : (
                <><Check size={16} />Finish Setup</>
              )}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-5">
          All settings saved locally · Run <code className="text-orange-500/60">must-b doctor</code> to verify
        </p>
      </div>

      <CloudSyncButton />
    </div>
  );
}
