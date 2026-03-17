import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import LanguageSwitcher from "./LanguageSwitcher";

export default function AppLayout() {
  return (
    <div className="flex bg-[#02040a] min-h-screen relative font-sans text-white">
      {/* Left — chat history & navigation */}
      <Sidebar />

      {/* Center — active content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen min-w-0">
        {/* Topbar: language switcher (right-aligned) */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-white/5 bg-black/10 shrink-0">
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
