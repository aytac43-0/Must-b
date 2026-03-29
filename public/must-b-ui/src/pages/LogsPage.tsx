/**
 * LogsPage — Must-b gateway logs, usage and session stats.
 * Tabs: Logs (logs.tail) / Usage (usage.cost) / Sessions (sessions.usage)
 */

import { useState, useEffect, useRef } from "react";
import { BarChart3, WifiOff, RefreshCw, Copy, DollarSign, Cpu } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";

type Tab = "logs" | "usage" | "sessions";

/* ── Logs tab ─────────────────────────────────────────────────────────── */
interface LogData { lines?: string[]; cursor?: number; truncated?: boolean; offline?: boolean; }

function LogsTab({ online }: { online: boolean }) {
  const [data, setData] = useState<LogData>({});
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetch_ = async (cursor = 0) => {
    try {
      const res = await apiFetch(`/api/gateway/logs?cursor=${cursor}&limit=200`);
      const d: LogData = await res.json();
      if (cursor === 0) {
        setData(d);
        cursorRef.current = d.cursor ?? 0;
      } else {
        setData(prev => ({
          ...d,
          lines: [...(prev.lines ?? []), ...(d.lines ?? [])],
        }));
        cursorRef.current = d.cursor ?? cursorRef.current;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(0); }, [online]);

  // Auto-tail every 10s
  useEffect(() => {
    const id = setInterval(() => fetch_(cursorRef.current), 10_000);
    return () => clearInterval(id);
  }, [online]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [data.lines?.length]);

  const lineColor = (line: string) => {
    if (line.includes("error") || line.includes("ERROR")) return "text-red-400";
    if (line.includes("warn") || line.includes("WARN")) return "text-amber-400";
    if (line.includes("info") || line.includes("INFO")) return "text-green-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-600">{(data.lines ?? []).length} satır</p>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText((data.lines ?? []).join("\n"))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/4 border border-white/8 text-[10px] text-gray-400 hover:text-white transition-all"
          >
            <Copy size={10} /> Kopyala
          </button>
          <button
            onClick={() => { cursorRef.current = 0; fetch_(0); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/4 border border-white/8 text-[10px] text-gray-400 hover:text-white transition-all"
          >
            <RefreshCw size={10} /> Sıfırla
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-96 overflow-y-auto rounded-xl bg-black/40 border border-white/6 p-3 font-mono text-[11px] space-y-0.5"
      >
        {loading ? (
          <p className="text-gray-600">Yükleniyor…</p>
        ) : !online || data.offline ? (
          <p className="text-orange-500">Gateway çevrimdışı — log verisi alınamıyor.</p>
        ) : (data.lines ?? []).length === 0 ? (
          <p className="text-gray-600">Henüz log yok.</p>
        ) : (
          (data.lines ?? []).map((line, i) => (
            <p key={i} className={`whitespace-pre-wrap break-all leading-5 ${lineColor(line)}`}>{line}</p>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Usage tab ────────────────────────────────────────────────────────── */
interface UsageData {
  offline?: boolean;
  total?: { tokens?: number; cost?: number };
  providers?: Array<{ provider: string; inputTokens?: number; outputTokens?: number; cost?: number }>;
  daily?: Array<{ date: string; tokens?: number; cost?: number }>;
}

function UsageTab({ online }: { online: boolean }) {
  const [data, setData] = useState<UsageData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/gateway/usage/cost")
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [online]);

  const daily = data.daily ?? [];
  const maxTokens = Math.max(1, ...daily.map(d => d.tokens ?? 0));

  return (
    <div className="space-y-4">
      {(!online || data.offline) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <WifiOff size={12} className="text-orange-400" />
          <p className="text-[11px] text-orange-300">Gateway çevrimdışı.</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/6">
          <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest">Toplam Token</p>
          <p className="text-xl font-bold text-white">
            {loading ? "—" : (data.total?.tokens ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/6">
          <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest flex items-center gap-1">
            <DollarSign size={8} /> Tahmini Maliyet
          </p>
          <p className="text-xl font-bold text-orange-400">
            {loading ? "—" : `$${(data.total?.cost ?? 0).toFixed(4)}`}
          </p>
        </div>
      </div>

      {/* Provider table */}
      {(data.providers ?? []).length > 0 && (
        <div className="rounded-xl bg-white/[0.02] border border-white/6 overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-2 border-b border-white/6 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span>Provider</span><span className="text-right">Giriş</span>
            <span className="text-right">Çıkış</span><span className="text-right">Maliyet</span>
          </div>
          {(data.providers ?? []).map((p, i) => (
            <div key={i} className="grid grid-cols-4 px-4 py-2 border-b border-white/4 last:border-0 text-[12px]">
              <span className="text-gray-300 font-medium truncate">{p.provider}</span>
              <span className="text-right text-gray-500">{(p.inputTokens ?? 0).toLocaleString()}</span>
              <span className="text-right text-gray-500">{(p.outputTokens ?? 0).toLocaleString()}</span>
              <span className="text-right text-orange-400">${(p.cost ?? 0).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daily bar chart */}
      {daily.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">Günlük Kullanım</p>
          <div className="flex items-end gap-1 h-16 px-1">
            {daily.slice(-14).map((d, i) => {
              const h = Math.max(2, Math.round(((d.tokens ?? 0) / maxTokens) * 56));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    style={{ height: h }}
                    className="w-full rounded-sm bg-orange-500/40 hover:bg-orange-500/60 transition-all"
                    title={`${d.date}: ${(d.tokens ?? 0).toLocaleString()} token`}
                  />
                  <span className="text-[8px] text-gray-700 truncate w-full text-center">{d.date?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sessions tab ─────────────────────────────────────────────────────── */
interface SessionUsage {
  key?: string;
  messageCount?: number;
  tokens?: number;
  cost?: number;
  lastActivityAt?: number;
}

function SessionsTab({ online }: { online: boolean }) {
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/gateway/sessions/usage?limit=30")
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : (d?.sessions ?? [])))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [online]);

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/6 overflow-hidden">
      <div className="grid grid-cols-4 px-4 py-2 border-b border-white/6 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
        <span className="col-span-2">Oturum</span>
        <span className="text-right">Token</span>
        <span className="text-right">Maliyet</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <RefreshCw size={14} className="animate-spin text-orange-400" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-6">
          {online ? "Oturum bulunamadı." : "Gateway çevrimdışı."}
        </p>
      ) : (
        sessions.map((s, i) => (
          <div key={i} className="grid grid-cols-4 px-4 py-2 border-b border-white/4 last:border-0 text-[12px]">
            <span className="col-span-2 text-gray-300 truncate font-mono text-[10px]">
              {s.key?.slice(0, 28) ?? "—"}
            </span>
            <span className="text-right text-gray-500">{(s.tokens ?? 0).toLocaleString()}</span>
            <span className="text-right text-orange-400">${(s.cost ?? 0).toFixed(4)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function LogsPage() {
  const { online } = useGatewayStatus();
  const [tab, setTab] = useState<Tab>("logs");

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
          <BarChart3 size={16} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Loglar & Aktivite</h1>
          <p className="text-[11px] text-gray-500">Must-b gateway log, kullanım ve oturum istatistikleri</p>
        </div>
        {!online && (
          <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-red-500/8 border border-red-500/20 text-red-400">
            <WifiOff size={10} /> Çevrimdışı
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["logs", "usage", "sessions"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
              tab === t
                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
            }`}
          >
            {t === "logs" ? "Loglar" : t === "usage" ? "Kullanım" : "Oturumlar"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "logs" && <LogsTab online={online} />}
      {tab === "usage" && <UsageTab online={online} />}
      {tab === "sessions" && <SessionsTab online={online} />}
    </div>
  );
}
