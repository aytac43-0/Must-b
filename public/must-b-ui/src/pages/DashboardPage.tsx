/**
 * DashboardPage — Liquid Glass v1.6.1
 *
 * Single full-height container rendering ChatArea.
 * WarRoomPanel / secondary tabs accessible via keyboard shortcut or future toolbar.
 * The green gradient body background bleeds through — ChatArea is transparent.
 */
import { useEffect }          from "react";
import { ChatArea }           from "@/components/chat/ChatArea";
import ScreenScanOverlay      from "@/components/ScreenScanOverlay";
import WarRoomPanel           from "@/components/WarRoomPanel";
import MorningBriefing        from "@/components/MorningBriefing";
import NightShiftLog          from "@/components/NightShiftLog";
import { getSocket }          from "@/lib/socket";

export default function DashboardPage() {
  // Ensure socket is connected as soon as the dashboard mounts
  useEffect(() => {
    getSocket(); // establish connection if not yet open
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] overflow-hidden">
      <ScreenScanOverlay />
      <WarRoomPanel />
      <ChatArea />
      {/* Morning Briefing — full-screen modal, shows once per shift */}
      <MorningBriefing />
      {/* Night Shift Log — real-time floating panel, top-right */}
      <NightShiftLog />
    </div>
  );
}
