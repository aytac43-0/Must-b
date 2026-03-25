/**
 * AppLayout — OMNI-MENU DOCK  v1.7.0
 *
 * The centralized hub for EVERY Must-b feature.
 * One floating pill at the top:  Logo → Quick Actions → Skill Dropdowns → Settings → Status
 * NO sidebars.  NO right-panel overlays.  Content is maximized beneath the dock.
 *
 * Background: Liquid Orange/Charcoal glassmorphism defined in index.css.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, FolderOpen, Globe, ChevronDown,
  Brain, Puzzle, Settings, Cpu,
  Search, FileText, Image, Volume2, Clock,
  Network, Bot, Layers, BookOpen, Plus,
  Play, Terminal, Zap, Activity, GitBranch,
  Camera, Link2, Package, Code2, Workflow,
} from "lucide-react";
import { WakeWordListener } from "@/components/chat/WakeWordListener";
import { useI18n } from "@/i18n";

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */
interface MenuItem {
  icon:   React.ReactNode;
  label:  string;
  desc?:  string;
  action: () => void;
}
interface MenuGroup {
  category: string;
  items:    MenuItem[];
}

/* ─────────────────────────────────────────────────────────────────────────
   Skill invocation — fires a CustomEvent the ChatInput listens for
───────────────────────────────────────────────────────────────────────── */
function invokeSkill(skill: string) {
  window.dispatchEvent(
    new CustomEvent("mustb:invoke-skill", { detail: { skill } })
  );
  // Also focus the chat textarea so the user can continue naturally
  setTimeout(() => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, 80);
}

/* ─────────────────────────────────────────────────────────────────────────
   DockDropdown — animated panel that opens below the dock pill
───────────────────────────────────────────────────────────────────────── */
function DockDropdown({
  id, label, icon, groups, isOpen, onToggle,
}: {
  id:       string;
  label:    string;
  icon:     React.ReactNode;
  groups:   MenuGroup[];
  isOpen:   boolean;
  onToggle: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
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
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-orange-500" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -8,   scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full mt-3 left-1/2 -translate-x-1/2 z-50 min-w-[280px] glass-panel rounded-2xl p-2 shadow-2xl"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.15)" }}
          >
            {groups.map((group) => (
              <div key={group.category} className="mb-1 last:mb-0">
                {/* Category header */}
                <div className="px-2.5 pt-2 pb-1 text-[9.5px] font-black uppercase tracking-[0.12em] text-orange-400/60">
                  {group.category}
                </div>

                {/* Items */}
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); onToggle(""); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-orange-500/10 text-left transition-colors group"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500/10 text-orange-400/70 group-hover:text-orange-400 group-hover:bg-orange-500/18 transition-all flex-shrink-0">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-white/85 leading-tight">
                        {item.label}
                      </div>
                      {item.desc && (
                        <div className="text-[10px] text-white/35 leading-tight mt-0.5 truncate">
                          {item.desc}
                        </div>
                      )}
                    </div>
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
   QuickAction — small pill button in the dock
───────────────────────────────────────────────────────────────────────── */
function QuickAction({
  icon, label, onClick, active,
}: {
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
        active
          ? "bg-black text-white shadow-sm"
          : "text-black/65 hover:text-black hover:bg-black/6"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AppLayout — root shell wrapping every /app/* page
───────────────────────────────────────────────────────────────────────── */
export default function AppLayout() {
  const { t }    = useI18n();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string>("");

  const isSettings = location.pathname === "/app/settings";

  const toggleMenu = useCallback((id: string) => {
    setOpenMenu(prev => prev === id ? "" : id);
  }, []);

  const handleWake = () => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  };

  /* ── SKILLS ─────────────────────────────────────────────────────────── */
  const skillsGroups: MenuGroup[] = [
    {
      category: "Web Tools",
      items: [
        {
          icon: <Search size={13} />,
          label: "Web Search",
          desc: "Real-time web search (multi-provider)",
          action: () => invokeSkill("web-search"),
        },
        {
          icon: <Globe size={13} />,
          label: "Web Fetch",
          desc: "Fetch any URL as clean text",
          action: () => invokeSkill("web-fetch"),
        },
        {
          icon: <Camera size={13} />,
          label: "Browser Control",
          desc: "Full Playwright browser automation",
          action: () => invokeSkill("browser"),
        },
      ],
    },
    {
      category: "File & Media",
      items: [
        {
          icon: <FileText size={13} />,
          label: "PDF Reader",
          desc: "Extract & analyse PDF documents",
          action: () => invokeSkill("pdf"),
        },
        {
          icon: <Image size={13} />,
          label: "Image Analysis",
          desc: "Describe and analyse images",
          action: () => invokeSkill("image-analysis"),
        },
        {
          icon: <Zap size={13} />,
          label: "Image Generation",
          desc: "Create AI-generated images",
          action: () => invokeSkill("image-generate"),
        },
        {
          icon: <Volume2 size={13} />,
          label: "Text-to-Speech",
          desc: "Convert text to natural speech",
          action: () => invokeSkill("tts"),
        },
      ],
    },
    {
      category: "AI & Agents",
      items: [
        {
          icon: <Bot size={13} />,
          label: "Spawn Sub-Agent",
          desc: "Launch a new autonomous agent session",
          action: () => invokeSkill("spawn-agent"),
        },
        {
          icon: <Layers size={13} />,
          label: "Agent Sessions",
          desc: "List and manage active sessions",
          action: () => invokeSkill("sessions"),
        },
        {
          icon: <Activity size={13} />,
          label: "Canvas",
          desc: "Visual drawing & whiteboard workspace",
          action: () => invokeSkill("canvas"),
        },
        {
          icon: <GitBranch size={13} />,
          label: "Git Operations",
          desc: "Commit, branch, diff, push/pull",
          action: () => invokeSkill("git"),
        },
      ],
    },
    {
      category: "System Tools",
      items: [
        {
          icon: <Network size={13} />,
          label: "Gateway",
          desc: "Inter-system & A2A communication",
          action: () => invokeSkill("gateway"),
        },
        {
          icon: <FolderOpen size={13} />,
          label: "File Manager",
          desc: "Read, write & manage files",
          action: () => invokeSkill("file-manager"),
        },
        {
          icon: <Clock size={13} />,
          label: "Cron Scheduler",
          desc: "Schedule recurring tasks",
          action: () => invokeSkill("cron"),
        },
        {
          icon: <MessageSquare size={13} />,
          label: "Messages",
          desc: "Send & receive inter-agent messages",
          action: () => invokeSkill("messages"),
        },
      ],
    },
  ];

  /* ── MEMORY ─────────────────────────────────────────────────────────── */
  const memoryGroups: MenuGroup[] = [
    {
      category: "Knowledge Base",
      items: [
        {
          icon: <BookOpen size={13} />,
          label: "Browse Memories",
          desc: "View all stored knowledge entries",
          action: () => invokeSkill("memory-browse"),
        },
        {
          icon: <Search size={13} />,
          label: "Search Memory",
          desc: "Semantic search across your KB",
          action: () => invokeSkill("memory-search"),
        },
        {
          icon: <Plus size={13} />,
          label: "Add Memory",
          desc: "Store new facts and knowledge",
          action: () => invokeSkill("memory-add"),
        },
      ],
    },
    {
      category: "Personal Organisation",
      items: [
        {
          icon: <Cpu size={13} />,
          label: "Contacts",
          desc: "Manage people and organisations",
          action: () => invokeSkill("contacts"),
        },
        {
          icon: <Clock size={13} />,
          label: "Calendar",
          desc: "Schedule and manage events",
          action: () => invokeSkill("calendar"),
        },
      ],
    },
  ];

  /* ── PLUGINS ─────────────────────────────────────────────────────────── */
  const pluginsGroups: MenuGroup[] = [
    {
      category: "Plugin Manager",
      items: [
        {
          icon: <Package size={13} />,
          label: "Marketplace",
          desc: "Discover plugins on ClawHub",
          action: () => invokeSkill("plugins-marketplace"),
        },
        {
          icon: <Puzzle size={13} />,
          label: "Installed",
          desc: "Manage and configure installed plugins",
          action: () => invokeSkill("plugins-installed"),
        },
        {
          icon: <Link2 size={13} />,
          label: "MCP Servers",
          desc: "Model Context Protocol integrations",
          action: () => invokeSkill("plugins-mcp"),
        },
      ],
    },
    {
      category: "Developer",
      items: [
        {
          icon: <Code2 size={13} />,
          label: "Bundle MCP",
          desc: "Package & deploy MCP tool bundles",
          action: () => invokeSkill("bundle-mcp"),
        },
        {
          icon: <Terminal size={13} />,
          label: "CLI Commands",
          desc: "Custom slash command registration",
          action: () => invokeSkill("cli-commands"),
        },
      ],
    },
  ];

  /* ── WORKFLOWS ───────────────────────────────────────────────────────── */
  const workflowsGroups: MenuGroup[] = [
    {
      category: "Automation",
      items: [
        {
          icon: <Play size={13} />,
          label: "Automations",
          desc: "Build and run automated workflows",
          action: () => invokeSkill("automations"),
        },
        {
          icon: <Clock size={13} />,
          label: "Scheduled Tasks",
          desc: "Manage all cron schedules",
          action: () => invokeSkill("scheduled-tasks"),
        },
        {
          icon: <Terminal size={13} />,
          label: "Commands",
          desc: "Custom slash commands",
          action: () => invokeSkill("commands"),
        },
      ],
    },
    {
      category: "Advanced",
      items: [
        {
          icon: <Network size={13} />,
          label: "Nodes Workflow",
          desc: "Visual node-graph pipelines",
          action: () => invokeSkill("nodes"),
        },
        {
          icon: <Bot size={13} />,
          label: "Multi-Agent",
          desc: "Orchestrate agent collaboration",
          action: () => invokeSkill("multi-agent"),
        },
      ],
    },
  ];

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">

      {/* ── OMNI-MENU DOCK ──────────────────────────────────────────────── */}
      <header className="fixed top-4 left-0 right-0 z-30 px-4 flex items-center justify-center pointer-events-none">
        <nav
          className="pointer-events-auto nav-pill flex items-center gap-0.5 px-2 py-1.5"
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >

          {/* ── Logo ─────────────────────────────────────────────────── */}
          <Link
            to="/app"
            className="flex items-center gap-1.5 px-3 py-1 mr-0.5 select-none group"
          >
            <span
              className="text-[18px] font-black tracking-tighter leading-none"
              style={{ color: "#1a0c06" }}
            >
              Must&#8209;b
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-orange-pulse"
              title="Online"
            />
          </Link>

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* ── Quick Actions ─────────────────────────────────────────── */}
          <QuickAction
            icon={<MessageSquare size={13} />}
            label="Chat"
            onClick={() => invokeSkill("chat-focus")}
            active={!isSettings}
          />
          <QuickAction
            icon={<FolderOpen size={13} />}
            label="Files"
            onClick={() => invokeSkill("files")}
          />
          <QuickAction
            icon={<Globe size={13} />}
            label="Browser"
            onClick={() => invokeSkill("browser")}
          />

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* ── Dropdown Menus ────────────────────────────────────────── */}
          <DockDropdown
            id="skills"
            label="Skills"
            icon={<Zap size={12} />}
            groups={skillsGroups}
            isOpen={openMenu === "skills"}
            onToggle={toggleMenu}
          />
          <DockDropdown
            id="memory"
            label="Memory"
            icon={<Brain size={12} />}
            groups={memoryGroups}
            isOpen={openMenu === "memory"}
            onToggle={toggleMenu}
          />
          <DockDropdown
            id="plugins"
            label="Plugins"
            icon={<Puzzle size={12} />}
            groups={pluginsGroups}
            isOpen={openMenu === "plugins"}
            onToggle={toggleMenu}
          />
          <DockDropdown
            id="workflows"
            label="Workflows"
            icon={<Workflow size={12} />}
            groups={workflowsGroups}
            isOpen={openMenu === "workflows"}
            onToggle={toggleMenu}
          />

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* ── Settings link ─────────────────────────────────────────── */}
          <Link
            to="/app/settings"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all select-none ${
              isSettings
                ? "bg-black text-white shadow-sm"
                : "text-black/65 hover:text-black hover:bg-black/6"
            }`}
          >
            <Settings size={12} />
            <span className="hidden md:inline">Settings</span>
          </Link>

          <div className="w-px h-4 bg-black/10 mx-0.5" />

          {/* ── Wake word listener ────────────────────────────────────── */}
          <WakeWordListener onWake={handleWake} />

          {/* ── Hardware / Status pill ────────────────────────────────── */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 ml-0.5 rounded-full select-none"
            style={{
              background: "rgba(26, 12, 6, 0.08)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <Cpu size={12} style={{ color: "#ea580c" }} />
            <span
              className="text-[11px] font-semibold hidden sm:inline"
              style={{ color: "rgba(0,0,0,0.55)" }}
            >
              {t.layout?.system ?? "System"}
            </span>
          </div>

        </nav>
      </header>

      {/* ── Page content — maximized beneath the dock ──────────────────── */}
      <main className="relative min-h-screen pt-[72px]">
        <Outlet />
      </main>

    </div>
  );
}
