/**
 * OpenRouterModelPicker — Live Model Selector  v1.0
 *
 * Fetches the full OpenRouter model catalog from /api/providers/openrouter/models
 * and presents it in three category tabs:
 *
 *   🆓 Free     — $0 / 1M tokens (Gemini 2.5 Pro, Llama 4, DeepSeek R1…)
 *   ⚖ Balanced  — ≤ $3 / 1M tokens (cheap paid models)
 *   ⚡ Power    — frontier models (GPT-4o, Claude 3 Opus, Gemini Ultra…)
 *
 * When the user selects a model the `onSelect(modelId)` callback fires.
 * The currently active model is highlighted and scrolled into view.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { Search, RefreshCw, Eye, Zap, Scale, Gift } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveModel {
  id:          string;
  name:        string;
  tier:        "free" | "balanced" | "power";
  contextK:    number;
  costPer1M:   number;
  description: string;
  hasVision:   boolean;
}

interface CatalogResponse {
  free:      LiveModel[];
  balanced:  LiveModel[];
  power:     LiveModel[];
  totals:    { free: number; balanced: number; power: number };
  fetchedAt: number;
}

type Tier = "free" | "balanced" | "power";

interface Props {
  currentModel?: string;
  onSelect:      (modelId: string) => void;
  className?:    string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCost(costPer1M: number): string {
  if (costPer1M === 0) return "Free";
  if (costPer1M < 1)   return `$${costPer1M.toFixed(3)}/1M`;
  return `$${costPer1M.toFixed(2)}/1M`;
}

function formatCtx(k: number): string {
  if (!k) return "—";
  if (k >= 1000) return `${(k / 1000).toFixed(0)}M`;
  return `${k}k`;
}

const TIER_META: Record<Tier, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  free:     { label: "Free",     icon: <Gift   size={11} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  balanced: { label: "Balanced", icon: <Scale  size={11} />, color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  power:    { label: "Power",    icon: <Zap    size={11} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function OpenRouterModelPicker({ currentModel, onSelect, className }: Props) {
  const [catalog,   setCatalog]   = useState<CatalogResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTier, setTier]     = useState<Tier>("free");
  const [query,     setQuery]     = useState("");
  const activeRef                 = useRef<HTMLButtonElement | null>(null);

  const loadCatalog = (refresh = false) => {
    setLoading(true);
    setError(null);
    fetch(`/api/providers/openrouter/models${refresh ? "?refresh=1" : ""}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: CatalogResponse) => {
        setCatalog(data);
        // Auto-select tab that contains the current model
        if (currentModel) {
          const tier =
            data.free.some(m => m.id === currentModel)     ? "free"     :
            data.balanced.some(m => m.id === currentModel) ? "balanced" :
            data.power.some(m => m.id === currentModel)    ? "power"    :
            "free";
          setTier(tier);
        }
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => { loadCatalog(); }, []);

  // Scroll active model card into view when tab changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeTier, catalog]);

  const models: LiveModel[] = catalog?.[activeTier] ?? [];
  const filtered = query
    ? models.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toLowerCase().includes(query.toLowerCase()))
    : models;

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden ${className ?? ""}`}
      style={{ background: "rgba(12,5,2,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* ── Header + refresh ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          OpenRouter Models
        </span>
        <button
          onClick={() => loadCatalog(true)}
          className="text-gray-600 hover:text-orange-400 transition-colors p-1 rounded"
          title="Refresh catalog"
          disabled={loading}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Tier tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-3 pb-2">
        {(["free", "balanced", "power"] as Tier[]).map(tier => {
          const meta   = TIER_META[tier];
          const count  = catalog?.totals?.[tier] ?? 0;
          const active = activeTier === tier;
          return (
            <button
              key={tier}
              onClick={() => setTier(tier)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: active ? meta.bg  : "transparent",
                color:      active ? meta.color : "#6b7280",
                border:     `1px solid ${active ? meta.color + "40" : "transparent"}`,
              }}
            >
              {meta.icon}
              {meta.label}
              {count > 0 && (
                <span className="text-[9px] font-bold opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search models…"
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[11px] text-gray-300 placeholder-gray-600 outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border:     "1px solid rgba(255,255,255,0.07)",
            }}
          />
        </div>
      </div>

      {/* ── Model list ────────────────────────────────────────────────── */}
      <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
        {loading && (
          <div className="py-8 text-center text-[11px] text-gray-600">
            <RefreshCw size={14} className="animate-spin mx-auto mb-2" />
            Fetching live catalog…
          </div>
        )}

        {!loading && error && (
          <div className="py-6 px-4 text-center text-[11px] text-red-400">
            {error}
            <br />
            <button
              onClick={() => loadCatalog(true)}
              className="mt-2 underline text-orange-400 hover:text-orange-300"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-8 text-center text-[11px] text-gray-600">
            No models found.
          </div>
        )}

        {!loading && !error && filtered.map(m => {
          const isActive = m.id === currentModel;
          const meta     = TIER_META[m.tier];
          return (
            <button
              key={m.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(m.id)}
              className="w-full text-left px-3 py-2 transition-all"
              style={{
                background:  isActive ? "rgba(234,88,12,0.10)" : "transparent",
                borderLeft:  isActive ? "2px solid #ea580c"    : "2px solid transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-semibold truncate ${isActive ? "text-orange-300" : "text-gray-300"}`}>
                      {m.name}
                    </span>
                    {m.hasVision && (
                      <Eye size={9} className="text-purple-400 flex-shrink-0" title="Vision / multimodal" />
                    )}
                  </div>
                  <span className="text-[9px] text-gray-600 font-mono truncate block">{m.id}</span>
                  {m.description && (
                    <span className="text-[10px] text-gray-600 line-clamp-1 mt-0.5">{m.description}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[9px] font-bold" style={{ color: meta.color }}>
                    {formatCost(m.costPer1M)}
                  </span>
                  <span className="text-[9px] text-gray-600">{formatCtx(m.contextK)} ctx</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Footer: cache timestamp ────────────────────────────────────── */}
      {catalog && (
        <div className="px-3 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <span className="text-[9px] text-gray-700 font-mono">
            Catalog cached · {new Date(catalog.fetchedAt).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
