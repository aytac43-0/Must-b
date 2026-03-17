import { ChatArea } from "@/components/chat/ChatArea";
import ActiveWorkflow from "@/components/ActiveWorkflow";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Live workflow progress card — only visible when the agent is running a task */}
      <ActiveWorkflow />

      {/* Main chat area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatArea />
      </div>
    </div>
  );
}
