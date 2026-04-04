/**
 * AppLayout — OMNI-MENU DOCK  v1.8.0
 *
 * Centralized hub for every Must-b feature.
 * ─ Single floating pill: Logo → Quick Actions → Skill Dropdowns → Settings → Status
 * ─ NO sidebars, NO right-panel overlays.
 * ─ Every label runs through the i18n t() hook (EN / TR / DE instant switch).
 * ─ Memory, Plugins, Skills open as real centered stage overlays.
 * ─ AI tools dispatch mustb:invoke-skill so the chat input pre-fills.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, FolderOpen, Globe, ChevronDown,
  Brain, Puzzle, Settings, X,
  Search, FileText, Image, Volume2, Clock,
  Network, Bot, Layers, BookOpen, Plus,
  Play, Terminal, Zap, Activity, GitBranch,
  Camera, Link2, Package, Code2, Workflow,
  Users, BarChart3, Eye, Cpu,
} from "lucide-react";
import { WakeWordListener }  from "@/components/chat/WakeWordListener";
import { useI18n }           from "@/i18n";
import MemoryPanel           from "@/components/MemoryPanel";
import PluginsPanel          from "@/components/PluginsPanel";
import SkillsPanel           from "@/components/SkillsPanel";
import WorkspacePreview      from "@/components/WorkspacePreview";
import LiveSightPanel        from "@/components/LiveSightPanel";
import LanguageSwitcher      from "@/components/layout/LanguageSwitcher";
import SystemHealthBadge     from "@/components/SystemHealthBadge";
import WhisperPanel          from "@/components/WhisperPanel";
import LiveBrowserView       from "@/components/LiveBrowserView";
import UserProfilePanel      from "@/components/UserProfilePanel";
import VoiceFeedbackLayer   from "@/components/VoiceFeedbackLayer";
import ActionMonitorPanel   from "@/components/ActionMonitorPanel";
import GeziHaritasi         from "@/components/GeziHaritasi";

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */
type StagePanel = "memory" | "plugins" | "skills" | "workspace" | "livesight" | null;

interface MenuItem {
  icon:       React.ReactNode;
  label:      string;
  desc?:      string;
  /** If set, opens this stage panel instead of dispatching a skill event. */
  panel?:     StagePanel;
  action?:    () => void;
}
interface MenuGroup {
  category: string;
  items:    MenuItem[];
}

/* ─────────────────────────────────────────────────────────────────────────
   Skill invocation — fires CustomEvent that ChatInput picks up
───────────────────────────────────────────────────────────────────────── */
function invokeSkill(skill: string) {
  window.dispatchEvent(
    new CustomEvent("mustb:invoke-skill", { detail: { skill } })
  );
  setTimeout(() => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, 80);
}

/* ─────────────────────────────────────────────────────────────────────────
   StageOverlay — renders a real component as a centred modal
───────────────────────────────────────────────────────────────────────── */
function StageOverlay({
  panel, title, onClose,
}: {
  panel:   NonNullable<StagePanel>;
  title:   string;
  onClose: () => void;
}) {
  // Keyboard Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="stage-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel card */}
      <motion.div
        key="stage-card"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="fixed z-50 top-[88px] left-1/2 -translate-x-1/2
                   w-full max-w-2xl max-h-[calc(100vh-108px)]
                   glass-panel rounded-3xl overflow-hidden flex flex-col
                   shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(249,115,22,0.18)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-orange-500/12 shrink-0">
          <span className="text-[13px] font-bold text-white/80">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Component */}
        <div className="flex-1 overflow-hidden min-h-0">
          {panel === "memory"    && <MemoryPanel />}
          {panel === "plugins"   && <PluginsPanel />}
          {panel === "skills"    && <SkillsPanel />}
          {panel === "workspace" && <WorkspacePreview />}
          {panel === "livesight" && <LiveSightPanel />}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DockDropdown
───────────────────────────────────────────────────────────────────────── */
function DockDropdown({
  id, label, icon, groups, isOpen, onToggle, onOpenPanel,
}: {
  id:          string;
  label:       string;
  icon:        React.ReactNode;
  groups:      MenuGroup[];
  isOpen:      boolean;
  onToggle:    (id: string) => void;
  onOpenPanel: (p: StagePanel) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle("");
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => onToggle(id)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all select-none ${
          isOpen
            ? "bg-orange-500/15 text-orange-600 border border-orange-400/30"
            : "text-black/65 hover:text-black hover:bg-black/6"
        }`}
      >
        <span className={isOpen ? "text-orange-500" : "text-black/50"}>{icon}</span>
        {label}
        <ChevronDown size={11} className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-orange-500" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -8,   scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full mt-3 left-1/2 -translate-x-1/2 z-50 min-w-[280px] glass-panel rounded-2xl p-2 shadow-2xl"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7),0 0 0 1px rgba(249,115,22,0.15)" }}
          >
            {groups.map((group) => (
              <div key={group.category} className="mb-1 last:mb-0">
                <div className="px-2.5 pt-2 pb-1 text-[9.5px] font-black uppercase tracking-[0.12em] text-orange-400/60">
                  {group.category}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.panel) {
                        onOpenPanel(item.panel);
                      } else if (item.action) {
                        item.action();
                      }
                      onToggle("");
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-orange-500/10 text-left transition-colors group"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500/10 text-orange-400/70 group-hover:text-orange-400 group-hover:bg-orange-500/18 transition-all flex-shrink-0">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-white/85 leading-tight">{item.label}</div>
                      {item.desc && (
                        <div className="text-[10px] text-white/35 leading-tight mt-0.5 truncate">{item.desc}</div>
                      )}
                    </div>
                    {item.panel && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400/60 font-mono shrink-0">
                        UI
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   QuickAction
───────────────────────────────────────────────────────────────────────── */
function QuickAction({ icon, label, onClick, active }: {
  icon:    React.ReactNode;
  label:   string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all select-none ${
        active ? "bg-black text-white shadow-sm" : "text-black/65 hover:text-black hover:bg-black/6"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AppLayout
───────────────────────────────────────────────────────────────────────── */
export default function AppLayout() {
  const { t }    = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu,  setOpenMenu]  = useState<string>("");
  const [stageOpen, setStageOpen] = useState<StagePanel>(null);

  const isSettings = location.pathname === "/app/settings";

  const toggleMenu = useCallback((id: string) => {
    setOpenMenu(prev => prev === id ? "" : id);
  }, []);

  const openPanel = useCallback((p: StagePanel) => {
    setStageOpen(p);
    setOpenMenu(""); // close any open dropdown
  }, []);

  const closePanel = useCallback(() => setStageOpen(null), []);

  const handleWake = () => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    window.dispatchEvent(new CustomEvent("mustb:wake"));
  };

  const d = t.dock; // shorthand

  /* ── SKILLS ─────────────────────────────────────────────────────────── */
  const skillsGroups: MenuGroup[] = [
    {
      category: d.cat_webTools,
      items: [
        { icon: <Search size={13} />,  label: d.skill_webSearch,  desc: d.desc_webSearch,  action: () => invokeSkill("web-search") },
        { icon: <Globe size={13} />,   label: d.skill_webFetch,   desc: d.desc_webFetch,   action: () => invokeSkill("web-fetch") },
        { icon: <Camera size={13} />,  label: d.skill_browserControl, desc: d.desc_browserControl, action: () => invokeSkill("browser") },
      ],
    },
    {
      category: d.cat_fileMedia,
      items: [
        { icon: <FileText size={13} />, label: d.skill_pdfReader,       desc: d.desc_pdfReader,       action: () => invokeSkill("pdf") },
        { icon: <Image size={13} />,    label: d.skill_imageAnalysis,   desc: d.desc_imageAnalysis,   action: () => invokeSkill("image-analysis") },
        { icon: <Zap size={13} />,      label: d.skill_imageGeneration, desc: d.desc_imageGeneration, action: () => invokeSkill("image-generate") },
        { icon: <Volume2 size={13} />,  label: d.skill_tts,             desc: d.desc_tts,             action: () => invokeSkill("tts") },
      ],
    },
    {
      category: d.cat_aiAgents,
      items: [
        // "Skill Library" opens the real SkillsPanel UI
        { icon: <Zap size={13} />,         label: d.skills,          desc: "Open saved skill library", panel: "skills" as StagePanel },
        { icon: <Eye size={13} />,         label: "Visual Audit",    desc: "Live screen capture & element detection", panel: "livesight" as StagePanel },
        { icon: <Bot size={13} />,         label: d.skill_spawnAgent,    desc: d.desc_spawnAgent,    action: () => invokeSkill("spawn-agent") },
        { icon: <Layers size={13} />,      label: d.skill_agentSessions, desc: d.desc_agentSessions, action: () => invokeSkill("sessions") },
        { icon: <Activity size={13} />,    label: d.skill_canvas,        desc: d.desc_canvas,        action: () => invokeSkill("canvas") },
        { icon: <GitBranch size={13} />,   label: d.skill_git,           desc: d.desc_git,           action: () => invokeSkill("git") },
      ],
    },
    {
      category: d.cat_systemTools,
      items: [
        { icon: <Network size={13} />,    label: d.skill_gateway,     desc: d.desc_gateway,     action: () => invokeSkill("gateway") },
        { icon: <FolderOpen size={13} />, label: d.skill_fileManager, desc: d.desc_fileManager, action: () => invokeSkill("file-manager") },
        { icon: <Clock size={13} />,      label: d.skill_cron,        desc: d.desc_cron,        action: () => invokeSkill("cron") },
        { icon: <MessageSquare size={13} />, label: d.skill_messages, desc: d.desc_messages,    action: () => invokeSkill("messages") },
      ],
    },
  ];

  /* ── MEMORY ─────────────────────────────────────────────────────────── */
  const memoryGroups: MenuGroup[] = [
    {
      category: d.cat_knowledgeBase,
      items: [
        // Real MemoryPanel UI for browse & search
        { icon: <BookOpen size={13} />, label: d.mem_browse,    desc: d.desc_memBrowse, panel: "memory" as StagePanel },
        { icon: <Search size={13} />,   label: d.mem_search,    desc: d.desc_memSearch, panel: "memory" as StagePanel },
        { icon: <Clock size={13} />,    label: "Hafıza Tüneli", desc: "LTM Explorer — tüm hafıza kayıtları, filtreleme ve zaman göstergesi", action: () => navigate("/app/memory") },
        { icon: <Plus size={13} />,     label: d.mem_add,       desc: d.desc_memAdd,    action: () => invokeSkill("memory-add") },
      ],
    },
    {
      category: d.cat_personalOrg,
      items: [
        { icon: <Cpu size={13} />,   label: d.mem_contacts, desc: d.desc_contacts, action: () => invokeSkill("contacts") },
        { icon: <Clock size={13} />, label: d.mem_calendar, desc: d.desc_calendar, action: () => invokeSkill("calendar") },
      ],
    },
  ];

  /* ── PLUGINS ─────────────────────────────────────────────────────────── */
  const pluginsGroups: MenuGroup[] = [
    {
      category: d.cat_pluginManager,
      items: [
        { icon: <Package size={13} />, label: d.plug_marketplace, desc: d.desc_marketplace, action: () => invokeSkill("plugins-marketplace") },
        // Installed opens real PluginsPanel UI
        { icon: <Puzzle size={13} />,  label: d.plug_installed,   desc: d.desc_installed,   panel: "plugins" as StagePanel },
        { icon: <Link2 size={13} />,   label: d.plug_mcp,         desc: d.desc_mcp,         action: () => invokeSkill("plugins-mcp") },
      ],
    },
    {
      category: d.cat_developer,
      items: [
        { icon: <Code2 size={13} />,    label: d.plug_bundleMcp, desc: d.desc_bundleMcp, action: () => invokeSkill("bundle-mcp") },
        { icon: <Terminal size={13} />, label: d.plug_cliCmds,   desc: d.desc_cliCmds,   action: () => invokeSkill("cli-commands") },
      ],
    },
  ];

  /* ── WORKFLOWS ───────────────────────────────────────────────────────── */
  const workflowsGroups: MenuGroup[] = [
    {
      category: d.cat_automation,
      items: [
        { icon: <Camera size={13} />,   label: "War Room",        desc: "Live vision + workflow control panel", panel: "livesight" as StagePanel },
        { icon: <Play size={13} />,     label: d.wf_automations, desc: d.desc_automations, action: () => invokeSkill("automations") },
        { icon: <Clock size={13} />,    label: d.wf_scheduled,   desc: d.desc_scheduled,   action: () => invokeSkill("scheduled-tasks") },
        { icon: <Terminal size={13} />, label: d.wf_commands,    desc: d.desc_commands,    action: () => invokeSkill("commands") },
      ],
    },
    {
      category: d.cat_advanced,
      items: [
        { icon: <Network size={13} />, label: d.wf_nodes,      desc: d.desc_nodes,      action: () => invokeSkill("nodes") },
        { icon: <Bot size={13} />,     label: d.wf_multiAgent, desc: d.desc_multiAgent, action: () => invokeSkill("multi-agent") },
      ],
    },
  ];

  /* ── Panel titles map ─────────────────────────────────────────────── */
  const panelTitles: Record<NonNullable<StagePanel>, string> = {
    memory:    d.memory,
    plugins:   d.plugins,
    skills:    d.skills,
    workspace: d.files,
    livesight: "Visual Audit",
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">

      {/* ── Stage overlay (real component panels) ───────────────────────── */}
      {stageOpen && (
        <StageOverlay
          panel={stageOpen}
          title={panelTitles[stageOpen]}
          onClose={closePanel}
        />
      )}

      {/* ── OMNI-MENU DOCK ──────────────────────────────────────────────── */}
      <header className="fixed top-4 left-0 right-0 z-30 px-4 flex items-center justify-center pointer-events-none">
        <nav
          className="pointer-events-auto nav-pill flex items-center gap-0.5 px-2 py-1.5"
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >

          {/* Logo */}
          <Link to="/app" className="flex items-center gap-1.5 px-3 py-1 mr-0.5 select-none">
            <span className="text-[18px] font-black tracking-tighter leading-none" style={{ color: "#1a0c06" }}>
              Must&#8209;b
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-orange-pulse" title="Online" />
          </Link>

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* Quick Actions */}
          <QuickAction
            icon={<MessageSquare size={13} />}
            label={d.chat}
            active={!isSettings}
            onClick={() => {
              if (isSettings) navigate("/app");
              else invokeSkill("chat-focus");
            }}
          />
          <QuickAction icon={<FolderOpen size={13} />}    label={d.files}   onClick={() => openPanel("workspace")} />
          <QuickAction icon={<Globe size={13} />}         label={d.browser} onClick={() => invokeSkill("browser")} />

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* Dropdown Menus */}
          <DockDropdown
            id="skills"    label={d.skills}    icon={<Zap size={12} />}
            groups={skillsGroups}
            isOpen={openMenu === "skills"}    onToggle={toggleMenu} onOpenPanel={openPanel}
          />
          <DockDropdown
            id="memory"    label={d.memory}    icon={<Brain size={12} />}
            groups={memoryGroups}
            isOpen={openMenu === "memory"}    onToggle={toggleMenu} onOpenPanel={openPanel}
          />
          <DockDropdown
            id="plugins"   label={d.plugins}   icon={<Puzzle size={12} />}
            groups={pluginsGroups}
            isOpen={openMenu === "plugins"}   onToggle={toggleMenu} onOpenPanel={openPanel}
          />
          <DockDropdown
            id="workflows" label={d.workflows} icon={<Workflow size={12} />}
            groups={workflowsGroups}
            isOpen={openMenu === "workflows"} onToggle={toggleMenu} onOpenPanel={openPanel}
          />

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* Platform page links */}
          {[
            { to: "/app/active",      icon: <Activity size={12} />,   label: t.sidebar.activeWorkflows  },
            { to: "/app/automations", icon: <Zap size={12} />,        label: t.sidebar.automations      },
            { to: "/app/clients",     icon: <Users size={12} />,      label: t.sidebar.clients          },
            { to: "/app/logs",        icon: <BarChart3 size={12} />,  label: t.sidebar.logs             },
            { to: "/app/products",    icon: <Package size={12} />,    label: t.sidebar.products         },
          ].map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              title={label}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-[12px] font-semibold transition-all select-none ${
                location.pathname === to
                  ? "bg-black text-white shadow-sm"
                  : "text-black/65 hover:text-black hover:bg-black/6"
              }`}
            >
              {icon}
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* Settings */}
          <Link
            to="/app/settings"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all select-none ${
              isSettings ? "bg-black text-white shadow-sm" : "text-black/65 hover:text-black hover:bg-black/6"
            }`}
          >
            <Settings size={12} />
            <span className="hidden md:inline">{d.settings}</span>
          </Link>

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Wake word listener */}
          <WakeWordListener onWake={handleWake} />

          {/* Hardware / System status — live via Ghost Guard */}
          <SystemHealthBadge />

        </nav>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="relative min-h-screen pt-[72px]">
        <Outlet />
      </main>

      {/* ── Project Intelligence whispers — fixed bottom-right overlay ─── */}
      <WhisperPanel />

      {/* ── Live Browser View — floating PiP bottom-left ─────────────── */}
      <LiveBrowserView />

      {/* ── User Profile — fixed top-right avatar + glassmorphism panel ── */}
      <UserProfilePanel />

      {/* ── Voice Feedback — wake aura + speaking bar ─────────────────── */}
      <VoiceFeedbackLayer />

      {/* ── Action Monitor — terminal/filesystem log overlay ──────────── */}
      <ActionMonitorPanel />

      {/* ── Gezi Haritası — browser/research journey map ─────────────── */}
      <GeziHaritasi />

    </div>
  );
}
