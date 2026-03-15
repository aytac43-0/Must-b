"use client";

import { Bell, HelpCircle, Search, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from '@/utils/supabase/client';

export function TopBar() {
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            router.push("/login");
            toast.success("Successfully logged out.");
        }
    };

    return (
        <header className="h-16 border-b border-sidebar-border/50 flex items-center justify-between px-6 bg-background/50 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search your brain..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[14px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                toast.info("Search functionality will be enabled in Phase 2.");
                            }
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
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-background"></span>
                </button>
                <button
                    onClick={() => toast.info("Support and documentation will be available soon.")}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                    <HelpCircle size={20} />
                </button>
                <div className="h-8 w-px bg-white/10 mx-2"></div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>

                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-900/40 cursor-default">
                        USER
                    </div>
                </div>
            </div>
        </header>
    );
}
