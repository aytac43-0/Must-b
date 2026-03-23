import {
  History, Plus, LogOut, Edit3, Trash2, Check, X,
  Settings as SettingsIcon, ChevronLeft, ChevronRight, MessageSquare,
} from "lucide-react";
import clsx from "clsx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

interface Chat { id: string; title: string; created_at?: string; }

export default function Sidebar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const pathname  = location.pathname;

  const [chats,         setChats]         = useState<Chat[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle,     setEditTitle]     = useState("");
  const [deletingChatId,setDeletingChatId]= useState<string | null>(null);
  const [collapsed,     setCollapsed]     = useState(false);
  const [activeProvider, setActiveProvider] = useState("");
  const [activeModel,    setActiveModel]    = useState("");

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

  // Fetch active provider + model on mount so the sidebar footer is hydrated
  useEffect(() => {
    apiFetch("/api/setup/status")
      .then(r => r.ok ? r.json() : null)
      .then((data: { activeProvider?: string; activeModel?: string } | null) => {
        if (!data) return;
        setActiveProvider(data.activeProvider ?? "");
        setActiveModel(data.activeModel ?? "");
      })
      .catch(() => { /* non-fatal */ });
  }, []);

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

  const isSettings = pathname === "/app/settings";

  return (
    <aside
      className={clsx(
        "h-screen bg-[#0d0a07]/90 border-r border-orange-500/10 flex flex-col overflow-hidden sticky top-0 font-sans z-50 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[64px]" : "w-[260px]"
      )}
    >
      {/* ── Header / Logo ─────────────────────────────────────────────── */}
      <div className={clsx("flex items-center gap-3 shrink-0", collapsed ? "px-4 py-5 justify-center" : "p-5")}>
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 bg-orange-500 rounded-full blur-md opacity-40" />
          <img src="/logo.png" alt="Must-b" className="w-full h-full object-contain relative z-10" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-white truncate">Must-b</span>
        )}
      </div>

      {/* ── New Chat Button ────────────────────────────────────────────── */}
      <div className={clsx("shrink-0", collapsed ? "px-3 mb-3" : "px-4 mb-4")}>
        <button
          onClick={handleNewChat}
          title="New Chat"
          className={clsx(
            "w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]",
            collapsed ? "h-10 px-2" : "h-10 px-3 text-sm"
          )}
        >
          <Plus size={17} strokeWidth={2.5} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* ── Scrollable area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4">

        {/* Recent Chats */}
        {!collapsed && (
          <h3 className="px-2 mt-2 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Recent Chats
          </h3>
        )}
        {collapsed && <div className="mt-1 mb-1 border-t border-white/5" />}

        <div className="space-y-0.5">
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
                  <button onClick={saveEdit} className="p-1 hover:bg-green-500/20 text-green-500 rounded">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setEditingChatId(null)} className="p-1 hover:bg-red-500/20 text-red-500 rounded">
                    <X size={13} />
                  </button>
                </div>
              ) : collapsed ? (
                <Link
                  to={`/app?chat=${chat.id}`}
                  title={chat.title}
                  className={clsx(
                    "flex items-center justify-center p-2.5 rounded-lg transition-all",
                    pathname.includes(chat.id) ? "bg-orange-500/10 text-orange-400" : "text-gray-500 hover:text-white hover:bg-white/5"
                  )}
                >
                  <MessageSquare size={15} />
                </Link>
              ) : (
                <>
                  <Link
                    to={`/app?chat=${chat.id}`}
                    className={clsx(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[13px] font-medium pr-10",
                      pathname.includes(chat.id) ? "bg-orange-500/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <History size={14} className={pathname.includes(chat.id) ? "text-orange-500 shrink-0" : "text-gray-600 shrink-0"} />
                    <span className="flex-1 truncate">{chat.title}</span>
                  </Link>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#0F0F0F] px-1 rounded-md shadow-lg border border-white/5">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(chat); }}
                      className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-orange-400"
                      title="Rename"
                    ><Edit3 size={13} /></button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingChatId(chat.id); }}
                      className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-red-400"
                      title="Delete"
                    ><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Settings ────────────────────────────────────────────────── */}
        {!collapsed && (
          <h3 className="px-2 mt-5 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">System</h3>
        )}
        {collapsed && <div className="mt-3 mb-1 border-t border-white/5" />}

        {collapsed ? (
          <Link
            to="/app/settings"
            title="Settings"
            className={clsx(
              "flex items-center justify-center p-2.5 rounded-lg transition-all",
              isSettings ? "bg-orange-500/10 text-orange-400" : "text-gray-500 hover:text-white hover:bg-white/5"
            )}
          >
            <SettingsIcon size={15} />
          </Link>
        ) : (
          <Link
            to="/app/settings"
            className={clsx(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[13px] font-medium",
              isSettings ? "bg-orange-500/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <SettingsIcon size={15} className={isSettings ? "text-orange-500" : "text-gray-500"} />
            <span>Settings</span>
          </Link>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className={clsx("border-t border-orange-500/10 bg-black/20 shrink-0", collapsed ? "p-2" : "p-3")}>
        {!collapsed && (
          <div className="mb-3 px-1">
            {/* Active model display — hydrated from /api/setup/status on mount */}
            {activeModel ? (
              <div className="mb-2.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-0.5">Active Model</p>
                <p className="text-orange-400 text-[11px] font-bold truncate" title={activeModel}>{activeModel}</p>
                {activeProvider && (
                  <p className="text-gray-600 text-[10px] capitalize">{activeProvider}</p>
                )}
              </div>
            ) : (
              <div className="mb-2.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-0.5">Active Model</p>
                <p className="text-gray-700 text-[11px] italic">No model active</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-0.5">Powered by</p>
                <p className="text-orange-500 text-xs font-bold">Auto Step Platform</p>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        )}

        <div className={clsx("flex", collapsed ? "flex-col gap-1 items-center" : "items-center gap-1")}>
          {/* Logout */}
          <button
            onClick={() => navigate("/")}
            title="Logout"
            className={clsx(
              "flex items-center gap-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-xs font-medium",
              collapsed ? "p-2.5 justify-center" : "flex-1 px-2.5 py-2"
            )}
          >
            <LogOut size={14} />
            {!collapsed && "Logout"}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-2.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
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
