/**
 * ClientsPage — OpenClaw connected nodes (devices/clients).
 * Data: GET /api/openclaw/clients → node.list RPC
 */

import { useState, useEffect } from "react";
import { Users, WifiOff, RefreshCw, Monitor, Smartphone, Apple, Laptop } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useOpenClawStatus } from "@/hooks/useOpenClawStatus";

interface NodeEntry {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  caps?: string[];
  roles?: string[];
  presence?: { ts?: number };
}

function isOnline(node: NodeEntry): boolean {
  if (!node.presence?.ts) return false;
  return Date.now() - node.presence.ts < 60_000;
}

function PlatformIcon({ platform }: { platform?: string }) {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("ios") || p.includes("iphone")) return <Smartphone size={14} className="text-gray-400" />;
  if (p.includes("android")) return <Smartphone size={14} className="text-green-500" />;
  if (p.includes("mac") || p.includes("darwin")) return <Apple size={14} className="text-gray-300" />;
  if (p.includes("win")) return <Monitor size={14} className="text-blue-400" />;
  return <Laptop size={14} className="text-gray-500" />;
}

export default function ClientsPage() {
  const { online } = useOpenClawStatus();
  const [nodes, setNodes] = useState<NodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/openclaw/clients");
      const data = await res.json();
      setNodes(Array.isArray(data?.nodes) ? data.nodes : Array.isArray(data) ? data : []);
    } catch { setNodes([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [online]);

  const handleRename = async (nodeId: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    try {
      await apiFetch(`/api/openclaw/clients/${nodeId}/rename`, {
        method: "POST",
        body: JSON.stringify({ displayName: editName.trim() }),
      });
      setNodes(prev => prev.map(n => n.nodeId === nodeId ? { ...n, displayName: editName.trim() } : n));
    } catch { /* ignore */ }
    finally { setEditingId(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Users size={16} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Bağlı Nodlar</h1>
            <p className="text-[11px] text-gray-500">{nodes.length} cihaz</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-red-500/8 border border-red-500/20 text-red-400">
              <WifiOff size={10} /> Çevrimdışı
            </span>
          )}
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-[11px] text-gray-400 hover:text-white hover:border-white/16 transition-all disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Yenile
          </button>
        </div>
      </div>

      {/* Nodes */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={18} className="animate-spin text-orange-400" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Users size={32} className="text-gray-700" />
          <p className="text-sm text-gray-600">
            {online
              ? "Bağlı node yok. Bağlamak için: openclaw pair"
              : "OpenClaw çevrimdışı."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {nodes.map(node => (
            <div key={node.nodeId} className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/6 hover:border-white/10 transition-all">
              <div className="flex items-start gap-2 mb-2">
                <PlatformIcon platform={node.platform} />
                <div className="flex-1 min-w-0">
                  {editingId === node.nodeId ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleRename(node.nodeId)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename(node.nodeId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-white/6 border border-orange-500/30 rounded-lg px-2 py-0.5 text-[13px] text-white outline-none"
                    />
                  ) : (
                    <p
                      className="text-[13px] font-semibold text-gray-200 truncate cursor-text"
                      onDoubleClick={() => { setEditingId(node.nodeId); setEditName(node.displayName ?? ""); }}
                      title="Çift tıklayarak düzenle"
                    >
                      {node.displayName ?? node.nodeId}
                    </p>
                  )}
                </div>
                <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${isOnline(node) ? "bg-green-400 animate-pulse" : "bg-gray-700"}`} />
              </div>

              <div className="space-y-1">
                {node.platform && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-16">Platform</span>
                    <span className="text-[11px] text-gray-400">{node.platform}</span>
                  </div>
                )}
                {node.version && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-16">Versiyon</span>
                    <span className="text-[11px] text-gray-400">{node.version}</span>
                  </div>
                )}
                {(node.caps ?? []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {(node.caps ?? []).slice(0, 3).map(cap => (
                      <span key={cap} className="px-1.5 py-0.5 rounded-md bg-orange-500/8 border border-orange-500/15 text-[9px] text-orange-400 font-medium">
                        {cap}
                      </span>
                    ))}
                    {(node.caps ?? []).length > 3 && (
                      <span className="text-[9px] text-gray-600">+{(node.caps ?? []).length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
