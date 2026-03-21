import {
  History, Plus, LogOut, Zap, Globe, Package, Users,
  Link as LinkIcon, BarChart3, Edit3, Trash2, Check, X,
  Settings as SettingsIcon,
} from "lucide-react";
import clsx from "clsx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  comingSoon?: boolean;
}

interface Chat { id: string; title: string; created_at?: string; }

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const [chats, setChats] = useState<Chat[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      const r = await apiFetch("/api/chats");
      if (r.ok) setChats(await r.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 10_000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  const handleNewChat = async () => {
    try {
      const r = await apiFetch("/api/chats", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!r.ok) { toast.error("Failed to create chat."); return; }
      const data = await r.json();
      setChats((prev) => [data, ...prev]);
      navigate(`/app?chat=${data.id}`);
    } catch { toast.error("Gateway unreachable."); }
  };

  const confirmDeleteChat = async () => {
    if (!deletingChatId) return;
    try {
      await apiFetch(`/api/chats/${deletingChatId}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== deletingChatId));
      toast.success("Chat deleted.");
      if (pathname.includes(deletingChatId)) navigate("/app");
    } catch { toast.error("Failed to delete chat."); }
    setDeletingChatId(null);
  };

  const startEditing = (chat: Chat) => { setEditingChatId(chat.id); setEditTitle(chat.title); };

  const saveEdit = async () => {
    if (!editingChatId || !editTitle.trim()) { setEditingChatId(null); return; }
    try {
      await apiFetch(`/api/chats/${editingChatId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle }),
      });
      setChats((prev) => prev.map((c) => c.id === editingChatId ? { ...c, title: editTitle } : c));
      toast.success("Chat renamed.");
    } catch { toast.error("Failed to rename chat."); }
    setEditingChatId(null);
  };

  const NavItem = ({ to, icon: Icon, label, active = false, comingSoon = false }: NavItemProps) => (
    <Link
      to={comingSoon ? "#" : to}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-[13px] font-medium group",
        active ? "bg-orange-500/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5",
        comingSoon && "opacity-60 cursor-not-allowed"
      )}
    >
      <Icon size={18} className={clsx(active ? "text-orange-500" : "text-gray-500 group-hover:text-gray-300")} />
      <span className="flex-1">{label}</span>
    </Link>
  );

  const SectionHeader = ({ label }: { label: string }) => (
    <h3 className="px-3 mt-6 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</h3>
  );

  return (
    <aside className="w-[280px] h-screen bg-[#0d0a07]/90 border-r border-orange-500/10 flex flex-col overflow-hidden text-sm sticky top-0 font-sans z-50 backdrop-blur-xl">
      {/* Header / Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="relative w-9 h-9">
          <div className="absolute inset-0 bg-orange-500 rounded-full blur-md opacity-50" />
          <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Must-b</span>
      </div>

      {/* New Chat Button */}
      <div className="px-4 mb-4">
        <button
          onClick={handleNewChat}
          className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white rounded-xl flex items-center justify-center gap-3 font-semibold transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-8">
        {/* Chat History */}
        <SectionHeader label="Recent Chats" />
        <div className="space-y-1 mb-4">
          {chats.map((chat) => (
            <div key={chat.id} className="group relative">
              {editingChatId === chat.id ? (
                <div className="flex items-center gap-1 px-2 py-1.5 bg-white/5 rounded-lg border border-orange-500/50">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-white outline-none min-w-0"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingChatId(null);
                    }}
                  />
                  <div className="flex items-center">
                    <button onClick={saveEdit} className="p-1 hover:bg-green-500/20 text-green-500 rounded"><Check size={14} /></button>
                    <button onClick={() => setEditingChatId(null)} className="p-1 hover:bg-red-500/20 text-red-500 rounded"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    to={`/app?chat=${chat.id}`}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-[13px] font-medium pr-10",
                      pathname.includes(chat.id) ? "bg-orange-500/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <History size={16} className={pathname.includes(chat.id) ? "text-orange-500" : "text-gray-500"} />
                    <span className="flex-1 truncate">{chat.title}</span>
                  </Link>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#0F0F0F] px-1 rounded-md shadow-lg border border-white/5">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(chat); }}
                      className="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-orange-400" title="Rename"
                    ><Edit3 size={14} /></button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingChatId(chat.id); }}
                      className="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-red-400" title="Delete"
                    ><Trash2 size={14} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Platform */}
        <SectionHeader label="Platform" />
        <NavItem to="/app/automations" icon={Zap}       label="My Automations"      active={pathname === "/app/automations"} />
        <NavItem to="/app/active"      icon={Globe}     label="Active Workflows"    active={pathname === "/app/active"} />
        <NavItem to="/app/products"    icon={Package}   label="Products & Services" active={pathname === "/app/products"} />
        <NavItem to="/app/clients"     icon={Users}     label="Client Management"   active={pathname === "/app/clients"} />
        <NavItem to="/app/integrations" icon={LinkIcon} label="Integrations"        active={pathname === "/app/integrations"} />

        {/* System */}
        <SectionHeader label="System" />
        <NavItem to="/app/logs"     icon={BarChart3}    label="Logs & Activity" active={pathname === "/app/logs"} />
        <NavItem to="/app/settings" icon={SettingsIcon} label="Settings"        active={pathname === "/app/settings"} />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-orange-500/10 bg-black/20">
        <div className="mb-4">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">Powered by</p>
          <p className="text-orange-500 text-xs font-bold">Auto Step Platform</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-xs font-medium"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingChatId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Chat?</h3>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeletingChatId(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">Cancel</button>
              <button onClick={confirmDeleteChat} className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors shadow-lg shadow-red-500/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
