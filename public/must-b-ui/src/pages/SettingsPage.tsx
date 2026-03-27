/**
 * SettingsPage — Phase 9 comprehensive rebuild (v1.9.0)
 *
 * Features:
 *  - Full 20+ provider grid fetched from /api/setup/providers
 *  - Per-category tabs (Frontier / Gateway / Fast / Local / Open / Specialist / …)
 *  - Search filter across provider name + description
 *  - Per-provider model selector (latestModels list)
 *  - Ollama: custom base-URL input + live installed-model list with pull CTA
 *  - Test Connection → POST /api/setup/test-key
 *  - Save Key       → POST /api/setup/update-key
 *  - Hardware score badge from GET /api/setup/status
 *  - 401 warning banner wired to mustb:401 event
 */

import { useState, useEffect, useRef } from "react";
import {
  Settings, Key, CheckCircle2, AlertTriangle, Eye, EyeOff,
  RefreshCw, Save, Search, Cpu, Zap, Globe, HardDrive,
  ChevronRight, Server, ExternalLink, Download, Loader2, MessageCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n }  from "@/i18n";
import { ChannelGrid } from "@/components/ChannelGrid";

/* ── Types ────────────────────────────────────────────────────────────────── */

type ProviderCategory =
  | "frontier" | "gateway" | "fast" | "local"
  | "open" | "specialist" | "regional" | "enterprise" | "custom";

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
  docsUrl: string;
}

interface HardwareStatus {
  score: number;
  tier: string;
  configured: boolean;
  provider?: string;
  mode?: string;
  name?: string;
}

interface OllamaModel {
  id: string;
  label: string;
  sizeGb: number;
  fit: "recommended" | "marginal" | "warning";
}

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  frontier:   "⚡ Frontier",
  gateway:    "🌐 Gateway",
  fast:       "🚀 Fast",
  local:      "💻 Local",
  open:       "🔓 Open Source",
  specialist: "🎯 Specialist",
  regional:   "🌏 Regional",
  enterprise: "🏢 Enterprise",
  custom:     "⚙️ Custom",
};

const CATEGORY_ORDER: ProviderCategory[] = [
  "frontier", "gateway", "fast", "local", "open",
  "specialist", "regional", "enterprise", "custom",
];

declare global { interface Window { __MUSTB_NEED_API_KEY?: boolean; } }

/* ── Tag badge ────────────────────────────────────────────────────────────── */
function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-[9px] text-gray-500 font-medium">
      {tag}
    </span>
  );
}

/* ── Provider card ────────────────────────────────────────────────────────── */
function ProviderCard({
  p, active, onClick,
}: { p: ProviderMeta; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
        active
          ? "bg-orange-500/12 border-orange-500/30"
          : "bg-white/3 border-white/6 hover:bg-white/5 hover:border-white/12"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-tight truncate ${active ? "text-orange-300" : "text-gray-200"}`}>
            {p.label}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{p.description}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {p.tags.slice(0, 3).map(t => <TagBadge key={t} tag={t} />)}
          </div>
        </div>
        {active && <ChevronRight size={13} className="text-orange-400 shrink-0 mt-1" />}
      </div>
    </button>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { t }          = useI18n();
  const sp             = t.panels.settings;
  const [providers,    setProviders]    = useState<ProviderMeta[]>([]);
  const [status,       setStatus]       = useState<HardwareStatus | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);

  const [activeCat,   setActiveCat]   = useState<ProviderCategory | "all">("all");
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState<ProviderMeta | null>(null);
  const [model,       setModel]       = useState("");
  const [apiKey,      setApiKey]      = useState("");
  const [showKey,     setShowKey]     = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveMsg,     setSaveMsg]     = useState<string | null>(null);
  const [needs401,    setNeeds401]    = useState(!!window.__MUSTB_NEED_API_KEY);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"providers" | "channels">("providers");

  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Data fetching ──────────────────────────────────────────────────────── */
  useEffect(() => {
    // Providers catalog
    apiFetch("/api/setup/providers")
      .then(r => r.ok ? r.json() : null)
      .then((d: { providers: ProviderMeta[] } | null) => {
        if (d?.providers) setProviders(d.providers);
      })
      .catch(() => {});

    // Setup status + hardware
    apiFetch("/api/setup/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: HardwareStatus | null) => {
        if (d) setStatus(d);
      })
      .catch(() => {});

    // Ollama model catalog
    apiFetch("/api/setup/ollama-models")
      .then(r => r.ok ? r.json() : null)
      .then((d: { models?: OllamaModel[] } | null) => {
        if (d?.models) setOllamaModels(d.models);
      })
      .catch(() => {});

    // 401 event listener
    const on401 = () => { setNeeds401(true); window.__MUSTB_NEED_API_KEY = true; };
    window.addEventListener("mustb:401", on401);
    return () => window.removeEventListener("mustb:401", on401);
  }, []);

  // When provider selected, pre-fill model
  useEffect(() => {
    if (selected) setModel(selected.defaultModel);
  }, [selected]);

  /* ── Filtering ──────────────────────────────────────────────────────────── */
  const q = search.toLowerCase();
  const filtered = providers.filter(p => {
    if (activeCat !== "all" && p.category !== activeCat) return false;
    if (q && !p.label.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
    return true;
  });

  /* ── Grouped for display ────────────────────────────────────────────────── */
  const grouped: Partial<Record<ProviderCategory, ProviderMeta[]>> = {};
  for (const p of filtered) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category]!.push(p);
  }

  /* ── Actions ────────────────────────────────────────────────────────────── */
  const handleTest = async () => {
    if (!selected) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await apiFetch("/api/setup/test-key", {
        method: "POST",
        body: JSON.stringify({
          provider: selected.id,
          apiKey: apiKey || undefined,
          model: model || undefined,
        }),
      });
      const d = await r.json() as { ok: boolean; message?: string };
      setTestResult({ ok: d.ok, msg: d.message ?? (d.ok ? "Connection successful" : "Connection failed") });
    } catch {
      setTestResult({ ok: false, msg: "Gateway unreachable" });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    const isLocal = selected.envKeyIsUrl;
    if (!isLocal && !apiKey.trim()) return;
    setSaving(true); setSaveMsg(null);
    try {
      const r = await apiFetch("/api/setup/update-key", {
        method: "POST",
        body: JSON.stringify({
          provider: selected.id,
          apiKey: apiKey || undefined,
          model: model || undefined,
        }),
      });
      if (r.ok) {
        setSaveMsg("Saved successfully.");
        setApiKey("");
        window.__MUSTB_NEED_API_KEY = false;
        setNeeds401(false);
        const sr = await apiFetch("/api/setup/status");
        if (sr.ok) setStatus(await sr.json());
      } else {
        const d = await r.json() as { error?: string };
        setSaveMsg(d.error ?? "Failed to save.");
      }
    } catch {
      setSaveMsg("Gateway unreachable.");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 6000);
  };

  const handleOllamaPull = (modelId: string) => {
    setPullingModel(modelId);
    apiFetch("/api/setup/save", {
      method: "POST",
      body: JSON.stringify({ provider: "ollama", model: modelId }),
    }).finally(() => {
      setTimeout(() => setPullingModel(null), 3000);
    });
  };

  const isLocal = selected?.envKeyIsUrl ?? false;
  const isOllama = selected?.id === "ollama";
  const activeCategories = CATEGORY_ORDER.filter(c => providers.some(p => p.category === c));

  /* ── Hardware badge ─────────────────────────────────────────────────────── */
  const hwColor = status
    ? status.score >= 70 ? "text-green-400" : status.score >= 40 ? "text-amber-400" : "text-red-400"
    : "text-gray-500";

  return (
    <div className="h-full flex flex-col overflow-hidden font-sans">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Settings size={15} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-white leading-tight">{sp.title}</h1>
            <p className="text-[10px] text-gray-500 leading-tight">
              {status?.configured
                ? `Active · ${status.provider ?? "unknown"}`
                : "Not configured"}
              {status?.mode ? ` · ${status.mode}` : ""}
            </p>
          </div>
        </div>

        {/* Hardware badge */}
        {status && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/4 border border-white/8">
            <Cpu size={11} className={hwColor} />
            <span className={`text-[11px] font-semibold ${hwColor}`}>
              HW {status.score}
            </span>
            <span className="text-[10px] text-gray-600">· {status.tier}</span>
          </div>
        )}
      </div>

      {/* ── 401 banner ───────────────────────────────────────────────────────── */}
      {needs401 && (
        <div className="shrink-0 mx-4 mt-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold">API key missing or invalid</p>
            <p className="text-[10px] text-red-400/70 mt-0.5">
              A request returned 401 Unauthorized. Select a provider and update your key below.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab switcher ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1.5 px-5 pt-3 pb-0">
        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
            activeTab === "providers"
              ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
              : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
          }`}
        >
          <Cpu size={11} /> LLM Providers
        </button>
        <button
          onClick={() => setActiveTab("channels")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
            activeTab === "channels"
              ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
              : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
          }`}
        >
          <MessageCircle size={11} /> Kanallar
        </button>
      </div>

      {/* ── Channels tab ─────────────────────────────────────────────────────── */}
      {activeTab === "channels" && (
        <div className="flex-1 overflow-y-auto p-5">
          <ChannelGrid />
        </div>
      )}

      {/* ── Body: split layout ───────────────────────────────────────────────── */}
      {activeTab === "providers" && <div className="flex flex-1 min-h-0 gap-0">

        {/* ── Left: provider grid ──────────────────────────────────────────── */}
        <div className="w-[52%] flex flex-col border-r border-white/6 min-h-0">

          {/* Search + tabs */}
          <div className="shrink-0 px-4 pt-3 pb-2 space-y-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={sp.searchPlaceholder}
                className="w-full bg-white/4 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-[12px] text-white placeholder:text-gray-600 outline-none focus:border-orange-500/40 transition-colors"
              />
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveCat("all")}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                  activeCat === "all"
                    ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                    : "bg-white/4 border-white/8 text-gray-500 hover:text-gray-300"
                }`}
              >
                {sp.allProviders}
              </button>
              {activeCategories.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCat(c)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                    activeCat === c
                      ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                      : "bg-white/4 border-white/8 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Provider list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {providers.length === 0 && (
              <div className="flex items-center gap-2 py-6 text-gray-600 text-[12px]">
                <Loader2 size={13} className="animate-spin" /> Loading providers…
              </div>
            )}
            {CATEGORY_ORDER.filter(c => grouped[c]?.length).map(cat => (
              <div key={cat}>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 px-1">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="space-y-1.5">
                  {grouped[cat]!.map(p => (
                    <ProviderCard
                      key={p.id}
                      p={p}
                      active={selected?.id === p.id}
                      onClick={() => { setSelected(p); setTestResult(null); setApiKey(""); }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {providers.length > 0 && filtered.length === 0 && (
              <p className="text-[12px] text-gray-600 py-4 text-center">No providers match "{search}"</p>
            )}
          </div>
        </div>

        {/* ── Right: configuration panel ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/8 border border-orange-500/15 flex items-center justify-center">
                <Globe size={20} className="text-orange-500/50" />
              </div>
              <p className="text-[13px] text-gray-500">Select a provider from the left to configure your API key</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Provider header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-white">{selected.label}</h2>
                  <p className="text-[12px] text-gray-400 mt-0.5 leading-snug">{selected.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selected.tags.map(t => <TagBadge key={t} tag={t} />)}
                  </div>
                </div>
                <a
                  href={selected.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/4 border border-white/8 text-[11px] text-gray-400 hover:text-white transition-colors"
                >
                  Docs <ExternalLink size={10} />
                </a>
              </div>

              {/* Ollama special UI */}
              {isOllama && ollamaModels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Recommended Models for Your Hardware
                  </p>
                  <div className="space-y-1.5">
                    {ollamaModels.map(m => {
                      const fitColor = m.fit === "recommended"
                        ? "text-green-400 border-green-500/20 bg-green-500/6"
                        : m.fit === "marginal"
                          ? "text-amber-400 border-amber-500/20 bg-amber-500/6"
                          : "text-red-400 border-red-500/20 bg-red-500/6";
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-gray-200 truncate">{m.label}</p>
                            <p className="text-[10px] text-gray-500">{m.sizeGb} GB</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${fitColor}`}>
                              {m.fit}
                            </span>
                            <button
                              onClick={() => { setModel(m.id); handleOllamaPull(m.id); }}
                              disabled={pullingModel === m.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-semibold hover:bg-orange-500/15 transition-all disabled:opacity-40"
                            >
                              {pullingModel === m.id
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Download size={10} />}
                              {pullingModel === m.id ? "Pulling…" : "Pull"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* API Key / URL input */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  {isLocal ? <Server size={9} /> : <Key size={9} />}
                  {isLocal ? sp.baseUrl : sp.apiKey}
                </p>
                {isOllama && !isLocal ? (
                  <div className="px-3.5 py-2.5 rounded-xl bg-green-500/6 border border-green-500/15 text-green-400 text-[12px]">
                    Ollama runs locally — no API key required. Just make sure Ollama is running.
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type={showKey || isLocal ? "text" : "password"}
                      value={apiKey}
                      onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                      placeholder={selected.placeholder}
                      className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-[12px] text-white placeholder:text-gray-600 outline-none focus:border-orange-500/40 transition-colors"
                    />
                    {!isLocal && (
                      <button
                        onClick={() => setShowKey(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-600 px-1">
                  {isLocal
                    ? `Stored in .env as ${selected.envKey}. Default: ${selected.placeholder}`
                    : `Stored locally in .env as ${selected.envKey} — never sent to external servers.`}
                </p>
              </div>

              {/* Model selector */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Zap size={9} />
                  {sp.model}
                </p>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none focus:border-orange-500/40 transition-colors appearance-none"
                >
                  {selected.latestModels.map(m => (
                    <option key={m} value={m} className="bg-[#1a0c06]">{m}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                {!isOllama && (
                  <button
                    onClick={handleTest}
                    disabled={testing || (!apiKey && !status?.configured)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[12px] text-gray-300 font-medium hover:bg-white/8 hover:text-white transition-all disabled:opacity-40"
                  >
                    <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
                    {testing ? sp.testing : sp.testConnection}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || (!apiKey.trim() && !isLocal && !isOllama)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[12px] font-semibold transition-all disabled:opacity-40 shadow-lg shadow-orange-500/20"
                >
                  <Save size={12} className={saving ? "animate-spin" : ""} />
                  {saving ? sp.saving : sp.save}
                </button>
              </div>

              {/* Feedback: test result */}
              {testResult && (
                <div className={`flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] ${
                  testResult.ok
                    ? "bg-green-500/8 border-green-500/20 text-green-300"
                    : "bg-red-500/8 border-red-500/20 text-red-300"
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                    : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                  {testResult.msg}
                </div>
              )}

              {/* Feedback: save message */}
              {saveMsg && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/20 text-orange-300 text-[12px]">
                  <CheckCircle2 size={13} className="shrink-0" />
                  {saveMsg}
                </div>
              )}

              {/* Ollama base URL note */}
              {isOllama && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <HardDrive size={9} />
                    Custom Base URL (optional)
                  </p>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-2.5 text-[12px] text-white placeholder:text-gray-600 outline-none focus:border-orange-500/40 transition-colors"
                  />
                  <p className="text-[10px] text-gray-600 px-1">
                    Leave blank to use the default http://localhost:11434
                  </p>
                </div>
              )}

            </div>
          )}

          {/* Bottom: Re-run wizard link */}
          <div className="shrink-0 px-5 py-4 border-t border-white/5 mt-auto">
            <a
              href="/setup"
              className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Settings size={11} />
              Re-run full setup wizard
            </a>
          </div>
        </div>

      </div>}
    </div>
  );
}
