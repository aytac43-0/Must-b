import { useState, useEffect } from "react";
import { Settings, Key, CheckCircle2, AlertTriangle, Eye, EyeOff, RefreshCw, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SetupStatus {
  configured: boolean;
  name?:      string;
  provider?:  string;
  mode?:      string;
}

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter",     placeholder: "sk-or-v1-..." },
  { id: "openai",     label: "OpenAI",          placeholder: "sk-..." },
  { id: "anthropic",  label: "Anthropic",       placeholder: "sk-ant-..." },
  { id: "ollama",     label: "Ollama (local)",  placeholder: "ollama (no key needed)" },
];

// Global flag set by api.ts when a 401 is received
declare global { interface Window { __MUSTB_NEED_API_KEY?: boolean; } }

export default function SettingsPage() {
  const [status,     setStatus]     = useState<SetupStatus | null>(null);
  const [provider,   setProvider]   = useState("openrouter");
  const [apiKey,     setApiKey]     = useState("");
  const [showKey,    setShowKey]    = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null);
  const [needs401,   setNeeds401]   = useState(!!window.__MUSTB_NEED_API_KEY);

  useEffect(() => {
    apiFetch("/api/setup/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: SetupStatus | null) => {
        if (d) { setStatus(d); if (d.provider) setProvider(d.provider); }
      })
      .catch(() => {});

    // Listen for 401 events fired by api.ts
    const on401 = () => { setNeeds401(true); window.__MUSTB_NEED_API_KEY = true; };
    window.addEventListener("mustb:401", on401);
    return () => window.removeEventListener("mustb:401", on401);
  }, []);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await apiFetch("/api/setup/test-key", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey: apiKey || undefined }),
      });
      const d = await r.json() as { ok: boolean; message?: string };
      setTestResult({ ok: d.ok, msg: d.message ?? (d.ok ? "Connection successful" : "Connection failed") });
    } catch { setTestResult({ ok: false, msg: "Gateway unreachable" }); }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!apiKey.trim() && provider !== "ollama") return;
    setSaving(true); setSaveMsg(null);
    try {
      const r = await apiFetch("/api/setup/update-key", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey }),
      });
      if (r.ok) {
        setSaveMsg("API key saved.");
        setApiKey("");
        window.__MUSTB_NEED_API_KEY = false;
        setNeeds401(false);
        const sr = await apiFetch("/api/setup/status");
        if (sr.ok) setStatus(await sr.json());
      } else {
        const d = await r.json() as { error?: string };
        setSaveMsg(d.error ?? "Failed to save.");
      }
    } catch { setSaveMsg("Gateway unreachable."); }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 5000);
  };

  const currentProvider = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0];
  const isOllama = provider === "ollama";

  return (
    <div className="h-full overflow-y-auto p-6 font-sans">
      <div className="max-w-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Settings</h1>
            <p className="text-[12px] text-gray-500">
              {status?.name ? `Signed in as ${status.name}` : "Configure Must-b"}
              {status?.mode ? ` · ${status.mode} mode` : ""}
            </p>
          </div>
        </div>

        {/* 401 Warning Banner */}
        {needs401 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold">API key missing or invalid</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">
                A request returned 401 Unauthorized. Update your API key below.
              </p>
            </div>
          </div>
        )}

        {/* Current Status */}
        {status && (
          <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/8">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Current Configuration</p>
            <div className="flex items-center gap-2">
              {status.configured
                ? <CheckCircle2 size={13} className="text-green-400" />
                : <AlertTriangle size={13} className="text-amber-400" />}
              <span className="text-[13px] text-gray-300">
                {status.configured
                  ? `Active · Provider: ${status.provider ?? "unknown"}`
                  : "Not configured — use the setup wizard below"}
              </span>
            </div>
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">LLM Provider</p>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setTestResult(null); }}
                className={`px-3 py-2.5 rounded-xl border text-[13px] font-medium text-left transition-all ${
                  provider === p.id
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                    : "bg-white/3 border-white/8 text-gray-400 hover:text-white hover:bg-white/6"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
            <Key size={9} /> API Key
          </p>
          {isOllama ? (
            <div className="px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/15 text-green-400 text-[13px]">
              Ollama runs locally — no API key required.
            </div>
          ) : (
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder={currentProvider.placeholder}
                className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 pr-10 text-[13px] text-white placeholder:text-gray-600 outline-none focus:border-orange-500/40 transition-colors"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          )}
          <p className="text-[11px] text-gray-600 px-1">
            Stored locally in .env — never sent to external servers.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {!isOllama && (
            <button
              onClick={handleTest}
              disabled={testing || (!apiKey && !status?.configured)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-300 font-medium hover:bg-white/8 hover:text-white transition-all disabled:opacity-40"
            >
              <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
              Test Connection
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!apiKey.trim() && !isOllama)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[13px] font-semibold transition-all disabled:opacity-40 shadow-lg shadow-orange-500/20"
          >
            <Save size={13} className={saving ? "animate-spin" : ""} />
            Save Key
          </button>
        </div>

        {/* Feedback */}
        {testResult && (
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-[13px] ${
            testResult.ok
              ? "bg-green-500/8 border-green-500/20 text-green-300"
              : "bg-red-500/8 border-red-500/20 text-red-300"
          }`}>
            {testResult.ok
              ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
            {testResult.msg}
          </div>
        )}
        {saveMsg && (
          <div className="px-4 py-3 rounded-xl bg-orange-500/8 border border-orange-500/20 text-orange-300 text-[13px]">
            {saveMsg}
          </div>
        )}

        {/* Re-run wizard */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Advanced</p>
          <a
            href="/setup"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/4 border border-white/8 text-[13px] text-gray-400 hover:text-white hover:bg-white/7 transition-all font-medium"
          >
            <Settings size={13} />
            Re-run Setup Wizard
          </a>
        </div>

      </div>
    </div>
  );
}
