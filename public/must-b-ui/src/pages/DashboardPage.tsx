/**
 * DashboardPage — War Room Center (v4.5)
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ WarRoomPanel  (vision thumbnail | workflow steps + action feed)      │ shrink-0
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │  [💬 Chat]   [📁 Workspace]   [⚡ Skills]                  tab bar  │ shrink-0
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │   ChatArea  ─OR─  WorkspacePreview  ─OR─  SkillsPanel               │ flex-1
 *   └──────────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect }           from "react";
import { MessageSquare, FolderOpen, Zap } from "lucide-react";
import { ChatArea }          from "@/components/chat/ChatArea";
import WarRoomPanel          from "@/components/WarRoomPanel";
import ScreenScanOverlay     from "@/components/ScreenScanOverlay";
import WorkspacePreview      from "@/components/WorkspacePreview";
import SkillsPanel           from "@/components/SkillsPanel";
import { getSocket }         from "@/lib/socket";

type Tab = "chat" | "workspace" | "skills";

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: "chat",      icon: MessageSquare, label: "Chat"      },
  { id: "workspace", icon: FolderOpen,    label: "Workspace" },
  { id: "skills",    icon: Zap,           label: "Skills"    },
];

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("chat");

  // Auto-switch to Chat when any workflow starts (manual or skill replay)
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { type: string }) => {
      if (data.type === "planStart" || data.type === "skillRunStart") setTab("chat");
    };
    socket.on("agentUpdate", handler);
    return () => { socket.off("agentUpdate", handler); };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScreenScanOverlay />
      <WarRoomPanel />

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-black/10 shrink-0">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              tab === id
                ? "bg-orange-500/12 text-orange-400 border border-orange-500/20"
                : "text-gray-600 hover:text-gray-300 hover:bg-white/4"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat"      && <ChatArea />}
        {tab === "workspace" && <WorkspacePreview />}
        {tab === "skills"    && <SkillsPanel />}
      </div>
    </div>
  );
}
