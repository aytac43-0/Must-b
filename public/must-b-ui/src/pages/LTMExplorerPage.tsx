/**
 * LTMExplorerPage — Long-Term Memory Explorer v1.0
 *
 * Glassmorphism hafıza tarayıcısı.
 *   – Kategori filtreleri: Tümü / NightOwl Bulguları / Kullanıcı Tercihleri /
 *     Proje Mimarisi / Episodik / Semantik
 *   – Anlık arama (içerikte substring)
 *   – "Relativity" zaman tüneli göstergesi
 *   – Her kayıt şık glassmorphism kart olarak görünür
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence }                    from "framer-motion";
import {
  Brain, Search, Clock, Tag, Filter,
  Sparkles, Moon, User, Layers, RefreshCw,
  ChevronRight, Database,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LTMEntry {
  category:  "episodic" | "semantic";
  content:   string;
  tags:      string[];
  score:     number;
  createdAt: string; // ISO datetime from SQLite
}

type FilterKey = "all" | "nightowl" | "preferences" | "architecture" | "episodic" | "semantic";

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; icon: React.ElementType; test: (e: LTMEntry) => boolean }[] = [
  {
    key:  "all",
    label:"Tümü",
    icon: Database,
    test: () => true,
  },
  {
    key:  "nightowl",
    label:"NightOwl Bulguları",
    icon: Moon,
    test: (e) => e.tags.some(t => /nightshift|nightowl/i.test(t)),
  },
  {
    key:  "preferences",
    label:"Kullanıcı Tercihleri",
    icon: User,
    test: (e) =>
      e.category === "semantic" &&
      !e.tags.some(t => /project|workspace|nightshift|nightowl/i.test(t)),
  },
  {
    key:  "architecture",
    label:"Proje Mimarisi",
    icon: Layers,
    test: (e) => e.tags.some(t => /project|workspace|context|summary/i.test(t)),
  },
  {
    key:  "episodic",
    label:"Episodik",
    icon: Clock,
    test: (e) => e.category === "episodic",
  },
  {
    key:  "semantic",
    label:"Semantik",
    icon: Brain,
    test: (e) => e.category === "semantic",
  },
];

const CATEGORY_STYLE = {
  episodic: {
    border: "rgba(249,115,22,0.30)",
    bg:     "rgba(249,115,22,0.08)",
    dot:    "#f97316",
    label:  "Episodik",
  },
  semantic: {
    border: "rgba(99,102,241,0.30)",
    bg:     "rgba(99,102,241,0.08)",
    dot:    "#6366f1",
    label:  "Semantik",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format SQLite datetime to relative Turkish string */
function relativity(createdAt: string): { label: string; tier: "fresh" | "recent" | "old" | "ancient" } {
  const ms = Date.now() - new Date(createdAt + "Z").getTime();
  const s  = ms / 1000;
  const m  = s / 60;
  const h  = m / 60;
  const d  = h / 24;

  if (s < 60)  return { label: "az önce",               tier: "fresh"   };
  if (m < 60)  return { label: `${Math.floor(m)}d önce`, tier: "fresh"   };
  if (h < 24)  return { label: `${Math.floor(h)}s önce`, tier: "recent"  };
  if (d < 7)   return { label: `${Math.floor(d)}g önce`, tier: "recent"  };
  if (d < 30)  return { label: `${Math.floor(d / 7)}h önce`, tier: "old" };
  return       { label: `${Math.floor(d / 30)}ay önce`, tier: "ancient"  };
}

const TIER_COLOR: Record<string, string> = {
  fresh:   "#34d399",
  recent:  "#f97316",
  old:     "#a78bfa",
  ancient: "#6b7280",
};

/** Highlight search term in text */
function highlight(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-orange-500/30 text-orange-300 rounded px-0.5">{p}</mark>
      : p
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function MemoryCard({ entry, query, index }: { entry: LTMEntry; query: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const rel     = relativity(entry.createdAt);
  const style   = CATEGORY_STYLE[entry.category];
  const preview = entry.content.slice(0, 180);
  const long    = entry.content.length > 180;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.25 }}
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background:    "rgba(10,4,1,0.78)",
        border:        `1px solid ${style.border}`,
        backdropFilter:"blur(20px)",
        boxShadow:     `0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px ${style.bg}, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5"
        style={{ borderBottom: `1px solid ${style.bg}` }}
      >
        {/* Category dot */}
        <span
          className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: style.dot, boxShadow: `0 0 6px ${style.dot}` }}
        />

        {/* Content preview */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/80 leading-relaxed break-words">
            {expanded ? highlight(entry.content, query) : highlight(preview + (long ? "…" : ""), query)}
          </p>
        </div>

        {/* Expand chevron */}
        {long && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="flex-shrink-0 text-white/20"
          >
            <ChevronRight size={14} />
          </motion.span>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
        {/* Category badge */}
        <span
          className="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{ color: style.dot, background: style.bg, border: `1px solid ${style.border}` }}
        >
          {style.label}
        </span>

        {/* Tags */}
        {entry.tags.slice(0, 3).map(tag => (
          <span key={tag}
            className="flex items-center gap-1 text-[10px] text-white/35 px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Tag size={8} className="opacity-60" />
            {tag}
          </span>
        ))}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Relativity — time tunnel */}
        <span
          className="flex items-center gap-1 text-[10px] font-medium"
          style={{ color: TIER_COLOR[rel.tier] }}
          title={entry.createdAt}
        >
          <Clock size={9} />
          {rel.label}
        </span>
      </div>
    </motion.div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ entries }: { entries: LTMEntry[] }) {
  const episodic = entries.filter(e => e.category === "episodic").length;
  const semantic = entries.filter(e => e.category === "semantic").length;
  const nightowl = entries.filter(e => e.tags.some(t => /nightshift|nightowl/i.test(t))).length;

  const pills = [
    { label: `${entries.length} toplam`, color: "#f97316" },
    { label: `${episodic} episodik`,     color: "#f97316" },
    { label: `${semantic} semantik`,     color: "#6366f1" },
    { label: `${nightowl} NightOwl`,     color: "#a78bfa" },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {pills.map(p => (
        <span key={p.label}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ color: p.color, background: `${p.color}14`, border: `1px solid ${p.color}30` }}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LTMExplorerPage() {
  const [entries,   setEntries]   = useState<LTMEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState("");
  const [filter,    setFilter]    = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/memory/ltm/list?limit=200");
      if (r.ok) {
        const d = await r.json() as { entries: LTMEntry[] };
        setEntries(d.entries ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const filterFn = FILTERS.find(f => f.key === filter)?.test ?? (() => true);
    const q = query.trim().toLowerCase();
    return entries
      .filter(filterFn)
      .filter(e => !q || e.content.toLowerCase().includes(q) || e.tags.some(t => t.includes(q)));
  }, [entries, filter, query]);

  return (
    <div className="h-[calc(100vh-72px)] overflow-y-auto px-6 py-6 space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background:    "rgba(249,115,22,0.12)",
              border:        "1px solid rgba(249,115,22,0.28)",
              boxShadow:     "0 0 16px rgba(249,115,22,0.12)",
            }}
          >
            <Brain size={18} className="text-orange-400" />
          </span>
          <div>
            <h1 className="text-[15px] font-bold text-white/90 tracking-tight">
              Hafıza Tüneli
            </h1>
            <p className="text-[11px] text-white/35">
              Long-Term Memory Explorer — semantik & episodik
            </p>
          </div>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Yenile
        </button>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      {!loading && <StatsBar entries={entries} />}

      {/* ── Search + Filters ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Search input */}
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background:    "rgba(255,255,255,0.04)",
            border:        "1px solid rgba(255,255,255,0.10)",
            backdropFilter:"blur(12px)",
          }}
        >
          <Search size={13} className="text-white/30 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Hafızada ara…"
            className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/25 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-white/25 hover:text-white/60 text-xs">✕</button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={11} className="text-white/25" />
          {FILTERS.map(f => {
            const Icon    = f.icon;
            const active  = filter === f.key;
            const count   = entries.filter(f.test).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: active ? "rgba(249,115,22,0.16)" : "rgba(255,255,255,0.04)",
                  border:     active ? "1px solid rgba(249,115,22,0.40)" : "1px solid rgba(255,255,255,0.08)",
                  color:      active ? "#fb923c"                          : "rgba(255,255,255,0.45)",
                }}
              >
                <Icon size={10} />
                {f.label}
                <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          >
            <Brain size={28} className="text-orange-500/50" />
          </motion.div>
          <p className="text-[12px] text-white/30">Hafıza taranıyor…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Sparkles size={28} className="text-white/15" />
          <p className="text-[13px] text-white/30">
            {entries.length === 0 ? "Henüz hafıza yok. İlk konuşmadan sonra dolmaya başlar." : "Filtrene uyan kayıt yok."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          <p className="text-[11px] text-white/25">
            {visible.length} kayıt gösteriliyor
            {query && <> · <span className="text-orange-400/60">"{query}"</span> araması</>}
          </p>
          <AnimatePresence mode="popLayout">
            {visible.map((entry, i) => (
              <MemoryCard
                key={`${entry.createdAt}-${i}`}
                entry={entry}
                query={query}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
