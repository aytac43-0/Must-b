/**
 * Skill Router (v1.0) — Skill_Master
 *
 * Maps Omni-Menu skill slugs (e.g. "browser", "terminal", "file-manager")
 * to concrete plugin invocations or prompt templates.
 *
 * Two invocation modes:
 *   DIRECT  — params already known; call invokePlugin() immediately.
 *   PROMPT  — pre-built system prompt injected into the orchestrator goal.
 *
 * The API endpoint POST /api/v1/skills/invoke calls routeSkill().
 */

import { invokePlugin, getPlugin } from './index.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type InvokeMode = 'direct' | 'prompt';

export interface SkillRoute {
  /** Omni-Menu skill slug */
  skill:        string;
  /** Human label shown in UI */
  label:        string;
  /** Short description */
  description:  string;
  /** Invocation mode */
  mode:         InvokeMode;
  /**
   * DIRECT mode: plugin name + optional default params.
   * The caller can pass additional/override params at invocation time.
   */
  plugin?:      string;
  defaultParams?: Record<string, unknown>;
  /**
   * PROMPT mode: template string for the orchestrator goal.
   * Use {params.key} placeholders — they are replaced with caller params.
   */
  promptTemplate?: string;
}

export interface RouteResult {
  ok:      boolean;
  mode:    InvokeMode;
  skill:   string;
  data?:   unknown;
  prompt?: string;
  error?:  string;
}

// ── Route table ───────────────────────────────────────────────────────────

const ROUTES: SkillRoute[] = [
  // ── Terminal ─────────────────────────────────────────────────────────────
  {
    skill:       'terminal',
    label:       'Terminal',
    description: 'Run a shell command',
    mode:        'direct',
    plugin:      'terminal',
    defaultParams: { timeout: 30_000 },
  },
  {
    skill:       'cli-commands',
    label:       'CLI Commands',
    description: 'Interactive terminal helper',
    mode:        'prompt',
    promptTemplate: 'Help me run a shell command. {params.goal}',
  },

  // ── Filesystem ───────────────────────────────────────────────────────────
  {
    skill:       'file-manager',
    label:       'File Manager',
    description: 'Browse and manage workspace files',
    mode:        'prompt',
    promptTemplate: 'List and explore files in the workspace. {params.goal}',
  },
  {
    skill:       'files',
    label:       'Files',
    description: 'Open the file browser',
    mode:        'direct',
    plugin:      'filesystem-list',
    defaultParams: { recursive: false },
  },
  {
    skill:       'filesystem-read',
    label:       'Read File',
    description: 'Read a specific file',
    mode:        'direct',
    plugin:      'filesystem-read',
  },
  {
    skill:       'filesystem-search',
    label:       'Search Files',
    description: 'Search file contents (grep)',
    mode:        'direct',
    plugin:      'filesystem-search',
  },

  // ── Browser (Playwright) ──────────────────────────────────────────────────
  {
    skill:       'browser',
    label:       'Browser',
    description: 'Open and control a Playwright browser',
    mode:        'direct',
    plugin:      'browser-navigate',
    defaultParams: { url: 'about:blank' },
  },
  {
    skill:       'web-fetch',
    label:       'Web Fetch',
    description: 'Fetch and extract content from a URL',
    mode:        'prompt',
    promptTemplate: 'Fetch and summarise the content at this URL using the browser tool: {params.url}',
  },
  {
    skill:       'web-search',
    label:       'Web Search',
    description: 'Search the web',
    mode:        'prompt',
    promptTemplate: 'Search the web for: {params.query}',
  },
  {
    skill:       'browser-screenshot',
    label:       'Screenshot',
    description: 'Capture a screenshot of a web page',
    mode:        'direct',
    plugin:      'browser-screenshot',
  },

  // ── AI / Generation ───────────────────────────────────────────────────────
  {
    skill:       'image-analysis',
    label:       'Image Analysis',
    description: 'Analyse an image with AI vision',
    mode:        'prompt',
    promptTemplate: 'Analyse this image and describe what you see: {params.path}',
  },
  {
    skill:       'image-generate',
    label:       'Image Generation',
    description: 'Generate an image from a prompt',
    mode:        'prompt',
    promptTemplate: 'Generate an image: {params.prompt}',
  },
  {
    skill:       'tts',
    label:       'Text-to-Speech',
    description: 'Convert text to audio',
    mode:        'prompt',
    promptTemplate: 'Convert to speech: {params.text}',
  },
  {
    skill:       'pdf',
    label:       'PDF Reader',
    description: 'Read and summarise a PDF',
    mode:        'prompt',
    promptTemplate: 'Read and summarise this PDF file: {params.path}',
  },

  // ── Agents / Multi-agent ──────────────────────────────────────────────────
  {
    skill:       'spawn-agent',
    label:       'Spawn Agent',
    description: 'Spawn a sub-agent for a task',
    mode:        'prompt',
    promptTemplate: 'Spawn a sub-agent to: {params.goal}',
  },
  {
    skill:       'sessions',
    label:       'Agent Sessions',
    description: 'List and manage active agent sessions',
    mode:        'prompt',
    promptTemplate: 'Show me all active agent sessions and their status.',
  },
  {
    skill:       'multi-agent',
    label:       'Multi-Agent',
    description: 'Coordinate multiple agents',
    mode:        'prompt',
    promptTemplate: 'Set up a multi-agent workflow to: {params.goal}',
  },
  {
    skill:       'canvas',
    label:       'Canvas',
    description: 'Open the visual agent canvas',
    mode:        'prompt',
    promptTemplate: 'Show the agent workflow canvas.',
  },

  // ── System / Tools ────────────────────────────────────────────────────────
  {
    skill:       'git',
    label:       'Git',
    description: 'Git operations',
    mode:        'prompt',
    promptTemplate: 'Help me with a git operation: {params.goal}',
  },
  {
    skill:       'gateway',
    label:       'Gateway',
    description: 'API gateway and webhook management',
    mode:        'prompt',
    promptTemplate: 'Show gateway status and connections.',
  },
  {
    skill:       'cron',
    label:       'Cron',
    description: 'Manage scheduled tasks',
    mode:        'prompt',
    promptTemplate: 'Help me manage cron / scheduled tasks: {params.goal}',
  },
  {
    skill:       'messages',
    label:       'Messages',
    description: 'Send notifications or messages',
    mode:        'prompt',
    promptTemplate: 'Send a message: {params.text}',
  },
  {
    skill:       'automations',
    label:       'Automations',
    description: 'Set up automations',
    mode:        'prompt',
    promptTemplate: 'Create an automation workflow: {params.goal}',
  },
  {
    skill:       'scheduled-tasks',
    label:       'Scheduled Tasks',
    description: 'Manage recurring tasks',
    mode:        'prompt',
    promptTemplate: 'Show and manage scheduled tasks.',
  },
  {
    skill:       'commands',
    label:       'Commands',
    description: 'Browse available commands',
    mode:        'prompt',
    promptTemplate: 'Show me all available must-b commands.',
  },
  {
    skill:       'nodes',
    label:       'Nodes',
    description: 'Visual workflow node editor',
    mode:        'prompt',
    promptTemplate: 'Open the workflow node editor for: {params.goal}',
  },

  // ── Memory ────────────────────────────────────────────────────────────────
  {
    skill:       'memory-add',
    label:       'Add Memory',
    description: 'Store something in long-term memory',
    mode:        'prompt',
    promptTemplate: 'Remember this for future sessions: {params.text}',
  },
  {
    skill:       'contacts',
    label:       'Contacts',
    description: 'Manage contacts',
    mode:        'prompt',
    promptTemplate: 'Show and manage my contacts.',
  },
  {
    skill:       'calendar',
    label:       'Calendar',
    description: 'Manage calendar events',
    mode:        'prompt',
    promptTemplate: 'Help me with my calendar: {params.goal}',
  },

  // ── Plugin tools ──────────────────────────────────────────────────────────
  {
    skill:       'plugins-marketplace',
    label:       'Plugin Marketplace',
    description: 'Browse the global plugin marketplace',
    mode:        'prompt',
    promptTemplate: 'Search the must-b plugin marketplace for: {params.query}',
  },
  {
    skill:       'plugins-mcp',
    label:       'MCP Plugins',
    description: 'Model Context Protocol plugin manager',
    mode:        'prompt',
    promptTemplate: 'Show installed MCP plugins and help me manage them.',
  },
  {
    skill:       'bundle-mcp',
    label:       'Bundle MCP',
    description: 'Create a bundled MCP server',
    mode:        'prompt',
    promptTemplate: 'Help me bundle and configure an MCP server: {params.goal}',
  },
];

// ── Index ─────────────────────────────────────────────────────────────────

const _routeMap = new Map<string, SkillRoute>(ROUTES.map(r => [r.skill, r]));

export function getRoute(skill: string): SkillRoute | undefined {
  return _routeMap.get(skill);
}

export function listRoutes(): Array<Pick<SkillRoute, 'skill' | 'label' | 'description' | 'mode'>> {
  return ROUTES.map(({ skill, label, description, mode }) => ({ skill, label, description, mode }));
}

/**
 * Register a custom route at runtime (for user-installed plugins).
 */
export function registerRoute(route: SkillRoute): void {
  _routeMap.set(route.skill, route);
}

// ── Core router ───────────────────────────────────────────────────────────

/**
 * Route a skill invocation.
 *
 * DIRECT mode: calls the mapped plugin and returns its result.
 * PROMPT mode: interpolates the template and returns the ready-to-send prompt.
 *
 * Callers (API endpoint) decide what to do with the result:
 *   - DIRECT data → return as JSON
 *   - PROMPT string → forward to orchestrator.run()
 */
export async function routeSkill(
  skill:   string,
  params:  Record<string, unknown> = {},
): Promise<RouteResult> {
  const route = _routeMap.get(skill);

  if (!route) {
    // No registered route — fall back to a generic prompt
    const fallbackPrompt = params.goal
      ? String(params.goal)
      : `Invoke the "${skill}" skill with these parameters: ${JSON.stringify(params)}`;
    return { ok: true, mode: 'prompt', skill, prompt: fallbackPrompt };
  }

  if (route.mode === 'direct' && route.plugin) {
    // Validate plugin exists in registry
    if (!getPlugin(route.plugin)) {
      return {
        ok:    false,
        mode:  'direct',
        skill,
        error: `Plugin "${route.plugin}" is not registered. Call registerBuiltins() first.`,
      };
    }
    const merged = { ...(route.defaultParams ?? {}), ...params };
    const result = await invokePlugin(route.plugin, merged);
    return { ok: result.ok, mode: 'direct', skill, data: result.data, error: result.error };
  }

  if (route.mode === 'prompt' && route.promptTemplate) {
    const prompt = interpolate(route.promptTemplate, params);
    return { ok: true, mode: 'prompt', skill, prompt };
  }

  return { ok: false, mode: route.mode, skill, error: 'Route is misconfigured (no plugin or template)' };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Replace {params.key} placeholders in a template string.
 * Undefined keys → empty string.
 */
function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{params\.([^}]+)\}/g, (_match, key) => {
    const val = params[key];
    return val !== undefined ? String(val) : '';
  });
}
