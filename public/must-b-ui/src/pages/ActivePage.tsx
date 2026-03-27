/**
 * ActivePage — OpenClaw active sessions viewer.
 * Data: GET /api/openclaw/sessions
 */

import { useState, useEffect } from "react";
import { Globe, WifiOff, RefreshCw, MessageSquare, Clock, Cpu } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useOpenClawStatus } from "@/hooks/useOpenClawStatus";

interface Session {
  key: string;
  agentId?: string;
  label?: string;
  derivedTitle?: string;
  lastMessage?: string;
  lastActivityAt?: number;
  runningAtMs?: number;
  messageCount?: number;
}

function relativeTime(ms?: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s önce`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}dk önce`;
  return `${Math.floor(diff / 3_600_000)}sa önce`;
}

type Filter = "all" | "running" | "idle";

export default function ActivePage() {
  const { online } = useOpenClawStatus();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/openclaw/sessions?limit=50&includeDerivedTitles=true&includeLastMessage=true");
      const data = await res.json();
      const list: Session[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.sessions)
        ? data.sessions
        : [];
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [online]);

  const isRunning = (s: Session) => !!s.runningAtMs && Date.now() - s.runningAtMs < 120_000;

  const filtered = sessions.filter(s => {
    if (filter === "running") return isRunning(s);
    if (filter === "idle") return !isRunning(s);
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Globe size={16} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Aktif Oturumlar</h1>
            <p className="text-[11px] text-gray-500">{sessions.length} oturum</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-[11px] text-gray-400 hover:text-white hover:border-white/16 transition-all disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Yenile
        </button>
      </div>

      {/* Offline banner */}
      {!online && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <WifiOff size={13} className="text-orange-400 flex-shrink-0" />
          <p className="text-[12px] text-orange-300">OpenClaw çevrimdışı — oturum verisi alınamıyor.</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["all", "running", "idle"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
              filter === f
                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
            }`}
          >
            {f === "all" ? "Tümü" : f === "running" ? "Çalışıyor" : "Boşta"}
          </button>
        ))}
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={18} className="animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageSquare size={32} className="text-gray-700" />
          <p className="text-sm text-gray-600">
            {online ? "Aktif oturum bulunamadı." : "OpenClaw çevrimdışı."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const running = isRunning(s);
            return (
              <div key={s.key} className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/6 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  {/* Running indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    {running
                      ? <span className="block w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                      : <span className="block w-2 h-2 rounded-full bg-gray-700" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-gray-200 truncate">
                        {s.derivedTitle ?? s.label ?? s.key.slice(0, 20) + "…"}
                      </p>
                      {s.agentId && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-600 flex-shrink-0">
                          <Cpu size={9} />
                          {s.agentId}
                        </span>
                      )}
                    </div>
                    {s.lastMessage && (
                      <p className="text-[11px] text-gray-500 truncate mb-1">{s.lastMessage}</p>
                    )}
                    <div className="flex items-center gap-3">
                      {s.messageCount !== undefined && (
                        <span className="text-[10px] text-gray-600">
                          {s.messageCount} mesaj
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-gray-600">
                        <Clock size={9} />
                        {relativeTime(s.lastActivityAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
