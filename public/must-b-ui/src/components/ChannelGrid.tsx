/**
 * ChannelGrid — shared channel management component.
 * Used by both IntegrationsPage (full page) and SettingsPage (Channels tab).
 * Data source: GET /api/openclaw/channels → OpenClaw channels.status RPC.
 * Falls back to Must-b's own /api/channels when OpenClaw is offline.
 */

import { useState, useEffect } from "react";
import {
  MessageSquare, CheckCircle2, XCircle, AlertTriangle,
  LogOut, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useOpenClawStatus } from "@/hooks/useOpenClawStatus";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface OcAccount {
  accountId: string;
  name?: string;
  connected?: boolean;
  configured?: boolean;
  lastConnectedAt?: number;
  lastError?: string;
}

interface OcChannelData {
  offline?: boolean;
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: Record<string, { description?: string }>;
  channelAccounts?: Record<string, OcAccount[]>;
}

interface FallbackChannel {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  docsUrl: string;
}

/* ── Status dot ─────────────────────────────────────────────────────────── */
function StatusDot({ connected, configured }: { connected?: boolean; configured?: boolean }) {
  if (connected) return <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />;
  if (configured) return <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />;
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function ChannelGrid() {
  const { online } = useOpenClawStatus();
  const [ocData, setOcData] = useState<OcChannelData | null>(null);
  const [fallback, setFallback] = useState<FallbackChannel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch OpenClaw channels
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/openclaw/channels");
        const data: OcChannelData = await res.json();
        setOcData(data);
        if (data.channelOrder?.length) {
          setSelected(data.channelOrder[0]);
        }
      } catch {
        setOcData({ offline: true, channelOrder: [], channelLabels: {}, channelAccounts: {} });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [online]);

  // Fallback: Must-b's own channels when OpenClaw offline
  useEffect(() => {
    if (!ocData?.offline) return;
    apiFetch("/api/channels")
      .then(r => r.json())
      .then(setFallback)
      .catch(() => setFallback([]));
  }, [ocData?.offline]);

  const handleLogout = async (channel: string, accountId: string) => {
    setLoggingOut(`${channel}-${accountId}`);
    try {
      await apiFetch(`/api/openclaw/channels/${channel}/logout`, {
        method: "POST",
        body: JSON.stringify({ accountId }),
      });
      // Refresh
      const res = await apiFetch("/api/openclaw/channels");
      setOcData(await res.json());
    } catch { /* ignore */ }
    finally { setLoggingOut(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={18} className="animate-spin text-orange-400" />
        <span className="ml-2 text-sm text-gray-500">Kanallar yükleniyor…</span>
      </div>
    );
  }

  // OpenClaw offline — show Must-b fallback
  if (ocData?.offline) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <WifiOff size={14} className="text-orange-400 flex-shrink-0" />
          <p className="text-[12px] text-orange-300">
            OpenClaw gateway çevrimdışı — yerel kanallar gösteriliyor.
            Başlatmak için: <code className="font-mono bg-white/5 px-1 rounded">cd openclaw && node openclaw.mjs</code>
          </p>
        </div>

        {fallback.length === 0 ? (
          <p className="text-center text-sm text-gray-600 py-6">Yapılandırılmış kanal yok.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {fallback.map(ch => (
              <div key={ch.id} className="px-3 py-2.5 rounded-xl bg-white/3 border border-white/6">
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot configured={ch.configured} connected={false} />
                  <span className="text-[13px] font-semibold text-gray-200">{ch.name}</span>
                  {ch.configured && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400">
                      Yapılandırıldı
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2">{ch.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const channelOrder = ocData?.channelOrder ?? [];
  const labels = ocData?.channelLabels ?? {};
  const accounts = ocData?.channelAccounts ?? {};

  if (channelOrder.length === 0) {
    return (
      <p className="text-center text-sm text-gray-600 py-8">
        OpenClaw'da yapılandırılmış kanal bulunamadı.
      </p>
    );
  }

  const selectedAccounts = selected ? (accounts[selected] ?? []) : [];

  return (
    <div className="flex gap-4 min-h-[320px]">
      {/* Channel list */}
      <div className="w-48 flex-shrink-0 space-y-1">
        {channelOrder.map(id => {
          const accs = accounts[id] ?? [];
          const anyConnected = accs.some(a => a.connected);
          const anyConfigured = accs.some(a => a.configured);
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                selected === id
                  ? "bg-orange-500/12 border-orange-500/30"
                  : "bg-white/3 border-white/6 hover:bg-white/5 hover:border-white/12"
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusDot connected={anyConnected} configured={anyConfigured} />
                <span className="text-[12px] font-semibold text-gray-200 truncate">
                  {labels[id] ?? id}
                </span>
                {accs.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-gray-500">{accs.length}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Channel detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <p className="text-sm text-gray-600 pt-4">Bir kanal seçin.</p>
        ) : selectedAccounts.length === 0 ? (
          <div className="px-4 py-4 rounded-xl bg-white/3 border border-white/6">
            <p className="text-[13px] font-semibold text-gray-300 mb-1">
              {labels[selected] ?? selected}
            </p>
            <p className="text-[12px] text-gray-500">Henüz bağlı hesap yok.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedAccounts.map(acc => (
              <div key={acc.accountId} className="px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                <div className="flex items-center gap-2 mb-2">
                  {acc.connected
                    ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                    : acc.lastError
                    ? <XCircle size={13} className="text-red-400 flex-shrink-0" />
                    : <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />
                  }
                  <span className="text-[13px] font-semibold text-gray-200 truncate">
                    {acc.name ?? acc.accountId}
                  </span>
                  <button
                    onClick={() => handleLogout(selected, acc.accountId)}
                    disabled={loggingOut === `${selected}-${acc.accountId}`}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-[10px] font-semibold hover:bg-red-500/15 transition-all disabled:opacity-40"
                  >
                    <LogOut size={9} />
                    Çıkış
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-20 flex-shrink-0">Durum</span>
                    <span className={`text-[11px] font-semibold ${acc.connected ? "text-green-400" : "text-gray-500"}`}>
                      {acc.connected ? "Bağlı" : "Bağlantı yok"}
                    </span>
                  </div>
                  {acc.lastConnectedAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-20 flex-shrink-0">Son bağlantı</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(acc.lastConnectedAt).toLocaleString("tr-TR")}
                      </span>
                    </div>
                  )}
                  {acc.lastError && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-gray-600 w-20 flex-shrink-0 pt-0.5">Hata</span>
                      <span className="text-[11px] text-red-400 break-all">{acc.lastError}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelGrid;
