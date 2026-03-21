import { useRef } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import LanguageSwitcher from "./LanguageSwitcher";
import { WakeWordListener } from "@/components/chat/WakeWordListener";

export default function AppLayout() {
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleWake = () => {
    // Focus the chat textarea when wake word is detected
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
    textarea?.focus();
  };

  return (
    <div className="flex bg-[#02040a] min-h-screen relative font-sans text-white">
      {/* Left — chat history & navigation */}
      <Sidebar />

      {/* Center — active content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen min-w-0">
        {/* Topbar: wake word toggle + language switcher */}
        <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-white/5 bg-black/10 shrink-0">
          <WakeWordListener onWake={handleWake} />
          <LanguageSwitcher />
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <Outlet />
        </div>
      </main>

      {/* Right — agent status panel (war room) */}
      <RightPanel />
    </div>
  );
}
