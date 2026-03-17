import { ChatArea }         from "@/components/chat/ChatArea";
import ActiveWorkflow       from "@/components/ActiveWorkflow";
import LiveSightPanel       from "@/components/LiveSightPanel";
import ScreenScanOverlay    from "@/components/ScreenScanOverlay";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Full-viewport scan overlay — shown when Must-b captures the screen */}
      <ScreenScanOverlay />

      {/* Live workflow progress card */}
      <ActiveWorkflow />

      {/* Live Sight — thumbnail of what Must-b sees, with element detection */}
      <div className="mx-4 mb-3 shrink-0">
        <LiveSightPanel />
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatArea />
      </div>
    </div>
  );
}
