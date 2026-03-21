import { Bell, HelpCircle, Search } from "lucide-react";
import { toast } from "sonner";

export default function TopBar() {
  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#02040a]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search your brain..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[14px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
            onKeyDown={(e) => {
              if (e.key === "Enter") toast.info("Search will be available in the next release.");
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => toast.info("Notifications will appear here once AI inference is active.")}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all relative"
        >
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#02040a]" />
        </button>
        <button
          onClick={() => toast.info("Support and documentation will be available soon.")}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <HelpCircle size={20} />
        </button>
        <div className="h-8 w-px bg-white/10 mx-2" />
        <div className="w-8 h-8 rounded-full overflow-hidden border border-orange-500/30 shadow-lg shadow-orange-900/30">
          <img src="/logo.png" alt="Must-b" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}
