/**
 * ProductsPage — Must-b native tools catalog & agents.
 * Tabs: Tools (skill-router + plugins) / Agents (src/core/skills)
 * Must-b native — works 100% standalone.
 */

import { useState, useEffect } from "react";
import { Package, RefreshCw, Wrench, Bot, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Tab = "tools" | "agents";
type ToolFilter = "all" | "core" | "plugin";

interface ToolEntry {
  name: string;
  label?: string;
  description?: string;
  source?: string;
  defaultProfiles?: string[];
}

interface ToolGroup {
  id: string;
  label?: string;
  tools?: ToolEntry[];
}

interface AgentSummary {
  id: string;
  name?: string;
  emoji?: string;
  description?: string;
  isDefault?: boolean;
}

/* ── Tools tab ─────────────────────────────────────────────────────────── */
function ToolsTab() {
  const [groups, setGroups] = useState<ToolGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ToolFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/tools")
      .then(r => r.json())
      .then(d => {
        const g: ToolGroup[] = Array.isArray(d?.groups) ? d.groups : [];
        setGroups(g);
        setExpanded(new Set(g.slice(0, 3).map((gr: ToolGroup) => gr.id)));
      })
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredGroups = groups.map(g => ({
    ...g,
    tools: (g.tools ?? []).filter(t => {
      if (filter === "core") return t.source !== "plugin";
      if (filter === "plugin") return t.source === "plugin";
      return true;
    }),
  })).filter(g => g.tools.length > 0);

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Source filter */}
      <div className="flex gap-1.5">
        {(["all", "core", "plugin"] as ToolFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
              filter === f
                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
            }`}
          >
            {f === "all" ? "Tümü" : f === "core" ? "Core" : "Plugin"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-orange-400" /></div>
      ) : filteredGroups.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-8">Araç bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map(group => (
            <div key={group.id} className="rounded-xl bg-white/[0.02] border border-white/6 overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Wrench size={12} className="text-orange-400" />
                  <span className="text-[12px] font-semibold text-gray-300">{group.label ?? group.id}</span>
                  <span className="text-[10px] text-gray-600">{group.tools?.length ?? 0} araç</span>
                </div>
                {expanded.has(group.id)
                  ? <ChevronDown size={12} className="text-gray-600" />
                  : <ChevronRight size={12} className="text-gray-600" />
                }
              </button>
              {expanded.has(group.id) && (
                <div className="border-t border-white/5 divide-y divide-white/4">
                  {(group.tools ?? []).map((tool, i) => (
                    <div key={i} className="px-4 py-2 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-300">{tool.label ?? tool.name}</p>
                        {tool.description && (
                          <p className="text-[11px] text-gray-600 line-clamp-1">{tool.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                          tool.source === "plugin"
                            ? "bg-blue-500/8 border-blue-500/20 text-blue-400"
                            : "bg-orange-500/8 border-orange-500/20 text-orange-400"
                        }`}>
                          {tool.source === "plugin" ? "plugin" : "core"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Agents tab ────────────────────────────────────────────────────────── */
function AgentsTab() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/agents")
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d?.agents) ? d.agents : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return loading ? (
    <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-orange-400" /></div>
  ) : agents.length === 0 ? (
    <p className="text-center text-sm text-gray-600 py-8">Agent bulunamadı.</p>
  ) : (
    <div className="grid grid-cols-2 gap-3">
      {agents.map(agent => (
        <div key={agent.id} className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">{agent.emoji ?? "🤖"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-200 truncate">{agent.name ?? agent.id}</p>
            </div>
            {agent.isDefault && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/12 border border-orange-500/25 text-orange-400">
                Varsayılan
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-[11px] text-gray-500 line-clamp-2">{agent.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function ProductsPage() {
  const [tab, setTab] = useState<Tab>("tools");

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
          <Package size={16} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Araçlar & Agent'lar</h1>
          <p className="text-[11px] text-gray-500">Must-b araç kataloğu ve agent yönetimi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["tools", "agents"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
              tab === t
                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                : "bg-white/3 border-white/6 text-gray-500 hover:text-gray-300 hover:border-white/12"
            }`}
          >
            {t === "tools" ? <Wrench size={11} /> : <Bot size={11} />}
            {t === "tools" ? "Araçlar" : "Agent'lar"}
          </button>
        ))}
      </div>

      {tab === "tools" && <ToolsTab />}
      {tab === "agents" && <AgentsTab />}
    </div>
  );
}
