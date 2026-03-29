/**
 * IntegrationsPage — Must-b channel management.
 * Data: GET /api/gateway/channels → Must-b gateway channels.status RPC
 */

import { Link2, WifiOff, Wifi } from "lucide-react";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { ChannelGrid } from "@/components/ChannelGrid";

function GatewayBadge({ online, loading }: { online: boolean; loading: boolean }) {
  if (loading) return null;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
      online
        ? "bg-green-500/8 border-green-500/20 text-green-400"
        : "bg-red-500/8 border-red-500/20 text-red-400"
    }`}>
      {online ? <Wifi size={10} /> : <WifiOff size={10} />}
      {online ? "Gateway Çevrimiçi" : "Gateway Çevrimdışı"}
    </span>
  );
}

export default function IntegrationsPage() {
  const { online, loading } = useGatewayStatus();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Link2 size={16} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Entegrasyonlar</h1>
            <p className="text-[11px] text-gray-500">Must-b gateway aracılığıyla mesajlaşma kanalları</p>
          </div>
        </div>
        <GatewayBadge online={online} loading={loading} />
      </div>

      {/* Content */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/6 p-5">
        <ChannelGrid />
      </div>
    </div>
  );
}
