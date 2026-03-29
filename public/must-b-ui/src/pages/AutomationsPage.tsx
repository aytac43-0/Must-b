/**
 * AutomationsPage — Must-b cron job management.
 * Data: GET /api/gateway/automations → cron.list RPC
 */

import { useState, useEffect } from "react";
import { Zap, WifiOff, Plus, Play, Trash2, RefreshCw, Clock, CheckCircle2, XCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";

interface CronJob {
  id: string;
  name?: string;
  enabled?: boolean;
  schedule?: unknown;
  state?: {
    nextRunAtMs?: number;
    lastRunStatus?: string;
    lastRunAtMs?: number;
    consecutiveErrors?: number;
  };
  payload?: string;
}

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return String(schedule ?? "—");
  const s = schedule as Record<string, unknown>;
  if (s.type === "every" && s.intervalMs) return `Her ${Math.round((s.intervalMs as number) / 60_000)} dakika`;
  if (s.type === "at" && s.time) return `Her gün ${s.time}`;
  if (s.type === "cron" && s.expression) return `Cron: ${s.expression}`;
  return JSON.stringify(schedule).slice(0, 40);
}

function countdownTo(ms?: number): string {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff < 0) return "Geçti";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s sonra`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}dk sonra`;
  return `${Math.floor(diff / 3_600_000)}sa sonra`;
}

type Filter = "all" | "enabled" | "disabled";

export default function AutomationsPage() {
  const { online } = useGatewayStatus();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [running, setRunning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/gateway/automations?enabled=all&limit=50");
      const data = await res.json();
      setJobs(Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data) ? data : []);
    } catch { setJobs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [online]);

  const handleToggle = async (job: CronJob) => {
    try {
      await apiFetch(`/api/gateway/automations/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ patch: { enabled: !job.enabled } }),
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j));
    } catch { /* ignore */ }
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try {
      await apiFetch(`/api/gateway/automations/${id}/run`, { method: "POST" });
      await load();
    } catch { /* ignore */ }
    finally { setRunning(null); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu otomasyon silinsin mi?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/gateway/automations/${id}`, { method: "DELETE" });
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const filtered = jobs.filter(j => {
    if (filter === "enabled") return j.enabled;
    if (filter === "disabled") return !j.enabled;
    return true;
  });

  const statusBadge = (status?: string) => {
    if (status === "ok") return <span className="flex items-center gap-1 text-[10px] text-green-400"><CheckCircle2 size={9} /> Başarılı</span>;
    if (status === "error") return <span className="flex items-center gap-1 text-[10px] text-red-400"><XCircle size={9} /> Hata</span>;
    return <span className="text-[10px] text-gray-600">—</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Zap size={16} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Otomasyonlar</h1>
            <p className="text-[11px] text-gray-500">{jobs.length} zamanlanmış görev</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-red-500/8 border border-red-500/20 text-red-400">
              <WifiOff size={10} /> Çevrimdışı
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-[11px] text-gray-400 hover:text-white hover:border-white/16 transition-all disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Yenile
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["all", "enabled", "disabled"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
              filter === f
                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
            }`}
          >
            {f === "all" ? "Tümü" : f === "enabled" ? "Aktif" : "Pasif"}
          </button>
        ))}
      </div>

      {/* Jobs */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={18} className="animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Zap size={32} className="text-gray-700" />
          <p className="text-sm text-gray-600">
            {online ? "Otomasyon bulunamadı." : "Gateway çevrimdışı."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => (
            <div key={job.id} className={`px-4 py-3 rounded-xl border transition-all ${
              job.enabled ? "bg-white/[0.025] border-white/6" : "bg-white/[0.01] border-white/4"
            }`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggle(job)}
                  disabled={!online}
                  className="mt-0.5 text-gray-500 hover:text-orange-400 transition-colors disabled:opacity-40"
                  title={job.enabled ? "Devre dışı bırak" : "Etkinleştir"}
                >
                  {job.enabled
                    ? <ToggleRight size={18} className="text-orange-400" />
                    : <ToggleLeft size={18} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-[13px] font-semibold truncate ${job.enabled ? "text-gray-200" : "text-gray-500"}`}>
                      {job.name ?? job.id}
                    </p>
                    {statusBadge(job.state?.lastRunStatus)}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock size={9} /> {formatSchedule(job.schedule)}
                    </span>
                    {job.state?.nextRunAtMs && (
                      <span className="text-[11px] text-gray-600">{countdownTo(job.state.nextRunAtMs)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRun(job.id)}
                    disabled={!online || running === job.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/8 border border-orange-500/20 text-orange-400 text-[10px] font-semibold hover:bg-orange-500/15 transition-all disabled:opacity-40"
                  >
                    {running === job.id
                      ? <RefreshCw size={9} className="animate-spin" />
                      : <Play size={9} />
                    }
                    Çalıştır
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={!online || deleting === job.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-[10px] font-semibold hover:bg-red-500/15 transition-all disabled:opacity-40"
                  >
                    {deleting === job.id
                      ? <RefreshCw size={9} className="animate-spin" />
                      : <Trash2 size={9} />
                    }
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
