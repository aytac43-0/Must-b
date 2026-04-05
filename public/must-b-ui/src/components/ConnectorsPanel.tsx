/**
 * ConnectorsPanel — v1.28.0
 *
 * Real-time channel message feed sourced from Socket.io `channelMessage` events.
 * Displayed in the Dashboard as a floating activity panel.
 *
 * Socket events consumed:
 *   'channelMessage'  { channel, from, contact, text, ts, msgId?, guildId? }
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence }     from "framer-motion";
import { MessageSquare, X, Wifi }      from "lucide-react";
import { getSocket }                   from "@/lib/socket";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface ChannelMessage {
  id:       string;
  channel:  "whatsapp" | "discord" | "telegram" | "slack" | string;
  from:     string;
  contact:  string;
  text:     string;
  ts:       number;
}

/* ── Channel meta ───────────────────────────────────────────────────────── */
const CHANNEL_ICON: Record<string, string> = {
  whatsapp: "🟢",
  discord:  "🟣",
  telegram: "🔵",
  slack:    "🟠",
};

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: "#25d366",
  discord:  "#7289da",
  telegram: "#0088cc",
  slack:    "#e01e5a",
};

function channelColor(ch: string): string {
  return CHANNEL_COLOR[ch] ?? "#ea580c";
}

function channelIcon(ch: string): string {
  return CHANNEL_ICON[ch] ?? "💬";
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function ConnectorsPanel() {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [open, setOpen]         = useState(false);
  const [hasNew, setHasNew]     = useState(false);
  const listRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sk = getSocket();

    sk.on("channelMessage", (data: Omit<ChannelMessage, "id">) => {
      const msg: ChannelMessage = {
        ...data,
        id: `${data.ts}-${Math.random().toString(36).slice(2, 7)}`,
      };
      setMessages(prev => [msg, ...prev].slice(0, 100)); // keep latest 100
      if (!open) setHasNew(true);
    });

    return () => { sk.off("channelMessage"); };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setHasNew(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[180] flex flex-col items-end gap-2">

      {/* ── Floating feed panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="connectors-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-80 max-h-96 flex flex-col rounded-2xl overflow-hidden"
            style={{
              background:    "rgba(16,6,2,0.9)",
              border:        "1px solid rgba(249,115,22,0.18)",
              backdropFilter:"blur(24px)",
              boxShadow:     "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Wifi size={12} style={{ color: "#ea580c" }} />
                <span className="text-[12px] font-bold text-white/85">Live Connectors</span>
                <span className="text-[10px] font-mono text-white/30 ml-1">{messages.length}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Message list */}
            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                  <MessageSquare size={18} className="text-white/15" />
                  <p className="text-[11px] text-white/25">Waiting for channel messages…</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {messages.map((msg) => (
                    <div key={msg.id} className="px-4 py-3 hover:bg-white/3 transition-colors">
                      {/* Channel + contact row */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px]">{channelIcon(msg.channel)}</span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: channelColor(msg.channel) }}
                        >
                          {msg.channel}
                        </span>
                        <span className="text-[10px] text-white/40 truncate max-w-[120px]">
                          {msg.contact || msg.from}
                        </span>
                        <span className="ml-auto text-[9px] font-mono text-white/20 shrink-0">
                          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Message text */}
                      <p className="text-[12px] text-white/70 leading-relaxed line-clamp-2">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB trigger ──────────────────────────────────────────────────── */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="relative flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-[12px] transition-all select-none shadow-lg"
        style={{
          background: open
            ? "rgba(234,88,12,0.9)"
            : "rgba(16,6,2,0.85)",
          border:     "1px solid rgba(249,115,22,0.25)",
          color:      open ? "#fff" : "rgba(255,255,255,0.65)",
          backdropFilter: "blur(16px)",
        }}
      >
        <MessageSquare size={13} />
        <span>Connectors</span>

        {/* New-message badge */}
        {hasNew && !open && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-[#100602] animate-pulse"
          />
        )}
      </button>
    </div>
  );
}
