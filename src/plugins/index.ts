/**
 * Must-b Plugin Registry (v1.0) — Skill_Master Infrastructure
 *
 * Unified registry for ALL plugin capabilities:
 *   • Built-in tools: terminal, browser (Playwright), filesystem
 *   • User-generated plugins from src/plugins/*.{mjs,py}
 *
 * Public API:
 *   registerPlugin(def)        → add a plugin definition
 *   getPlugin(name)            → retrieve by name
 *   listAll()                  → all registered plugins (built-in + user)
 *   invokePlugin(name, params) → execute a plugin's handler
 *   loadUserPlugins()          → scan src/plugins/ and register .mjs files
 */

import path         from 'path';
import fs           from 'fs';
import { EventEmitter } from 'events';

// ── Types ─────────────────────────────────────────────────────────────────

export type PluginCategory =
  | 'system'      // terminal, filesystem
  | 'browser'     // playwright automation
  | 'ai'          // llm calls, image gen
  | 'data'        // search, scrape
  | 'user';       // user-generated plugins

export interface PluginDefinition {
  /** Unique slug, also the skill name (e.g. "terminal", "browser") */
  name:        string;
  /** Short description shown in Omni-Menu */
  description: string;
  category:    PluginCategory;
  /** Source: 'builtin' = ships with must-b, 'user' = generated/installed */
  source:      'builtin' | 'user';
  /** Parameter schema (JSON Schema subset) for auto-validation */
  schema?:     Record<string, unknown>;
  /** The actual handler — receives params, returns result */
  invoke:      (params: Record<string, unknown>) => Promise<unknown>;
}

export interface PluginResult {
  ok:     boolean;
  data?:  unknown;
  error?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────

const _registry = new Map<string, PluginDefinition>();
export const pluginBus = new EventEmitter();
pluginBus.setMaxListeners(50);

export function registerPlugin(def: PluginDefinition): void {
  _registry.set(def.name, def);
  pluginBus.emit('registered', { name: def.name, source: def.source });
}

export function getPlugin(name: string): PluginDefinition | undefined {
  return _registry.get(name);
}

export function listAll(): Array<Omit<PluginDefinition, 'invoke'>> {
  return [..._registry.values()].map(({ invoke: _invoke, ...rest }) => rest);
}

export async function invokePlugin(
  name: string,
  params: Record<string, unknown> = {},
): Promise<PluginResult> {
  const plugin = _registry.get(name);
  if (!plugin) {
    return { ok: false, error: `Plugin "${name}" not found in registry` };
  }
  try {
    const data = await plugin.invoke(params);
    pluginBus.emit('invoked', { name, params, ts: Date.now() });
    return { ok: true, data };
  } catch (err: any) {
    pluginBus.emit('error', { name, message: err.message, ts: Date.now() });
    return { ok: false, error: err.message ?? String(err) };
  }
}

// ── Built-in registrations ────────────────────────────────────────────────

export function registerBuiltins(opts?: {
  workspaceRoot?: string;
  logger?:        import('winston').Logger;
}): void {
  const { workspaceRoot, logger } = opts ?? {};

  // ── Terminal ────────────────────────────────────────────────────────────
  registerPlugin({
    name:        'terminal',
    description: 'Run shell commands with full stdout/stderr capture',
    category:    'system',
    source:      'builtin',
    schema: {
      command: { type: 'string', required: true },
      cwd:     { type: 'string' },
      timeout: { type: 'number' },
    },
    async invoke(params) {
      const { TerminalTools } = await import('../tools/terminal.js');
      const t = new TerminalTools(params.cwd as string | undefined);
      return t.execute(params as any);
    },
  });

  // ── Filesystem: read ────────────────────────────────────────────────────
  registerPlugin({
    name:        'filesystem-read',
    description: 'Read a file from the workspace (sandboxed)',
    category:    'system',
    source:      'builtin',
    schema: {
      path:     { type: 'string', required: true },
      offset:   { type: 'number' },
      limit:    { type: 'number' },
    },
    async invoke(params) {
      const { FilesystemTools } = await import('../tools/filesystem.js');
      const f = new FilesystemTools(workspaceRoot);
      return f.readFile(params as any);
    },
  });

  // ── Filesystem: list ────────────────────────────────────────────────────
  registerPlugin({
    name:        'filesystem-list',
    description: 'List files/dirs in the workspace',
    category:    'system',
    source:      'builtin',
    schema: {
      path:      { type: 'string' },
      recursive: { type: 'boolean' },
      pattern:   { type: 'string' },
    },
    async invoke(params) {
      const { FilesystemTools } = await import('../tools/filesystem.js');
      const f = new FilesystemTools(workspaceRoot);
      return f.listFiles(params as any);
    },
  });

  // ── Filesystem: search ──────────────────────────────────────────────────
  registerPlugin({
    name:        'filesystem-search',
    description: 'Grep-style search across workspace files',
    category:    'system',
    source:      'builtin',
    schema: {
      pattern:   { type: 'string', required: true },
      path:      { type: 'string' },
      recursive: { type: 'boolean' },
    },
    async invoke(params) {
      const { FilesystemTools } = await import('../tools/filesystem.js');
      const f = new FilesystemTools(workspaceRoot);
      return f.searchFiles(params as any);
    },
  });

  // ── Browser: navigate ────────────────────────────────────────────────────
  registerPlugin({
    name:        'browser-navigate',
    description: 'Navigate the Playwright browser to a URL',
    category:    'browser',
    source:      'builtin',
    schema: {
      url:     { type: 'string', required: true },
      waitFor: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] },
    },
    async invoke(params) {
      const { BrowserTools } = await import('../tools/browser.js');
      const b = new BrowserTools(logger ?? _silentLogger());
      try { return await b.navigate(params as any); }
      finally { await b.close(); }
    },
  });

  // ── Browser: screenshot ─────────────────────────────────────────────────
  registerPlugin({
    name:        'browser-screenshot',
    description: 'Capture a screenshot (base64 PNG) of the current page',
    category:    'browser',
    source:      'builtin',
    schema: {
      selector: { type: 'string' },
      fullPage: { type: 'boolean' },
    },
    async invoke(params) {
      const { BrowserTools } = await import('../tools/browser.js');
      const b = new BrowserTools(logger ?? _silentLogger());
      try { return await b.screenshot(params as any); }
      finally { await b.close(); }
    },
  });

  // ── Browser: extract ────────────────────────────────────────────────────
  registerPlugin({
    name:        'browser-extract',
    description: 'Extract text/HTML content from a CSS selector',
    category:    'browser',
    source:      'builtin',
    schema: {
      selector: { type: 'string', required: true },
    },
    async invoke(params) {
      const { BrowserTools } = await import('../tools/browser.js');
      const b = new BrowserTools(logger ?? _silentLogger());
      try { return await b.extract(params as any); }
      finally { await b.close(); }
    },
  });

  // ── Browser: snapshot (ARIA) ────────────────────────────────────────────
  registerPlugin({
    name:        'browser-snapshot',
    description: 'Get ARIA accessibility snapshot of the current page',
    category:    'browser',
    source:      'builtin',
    schema:      {},
    async invoke(_params) {
      const { BrowserTools } = await import('../tools/browser.js');
      const b = new BrowserTools(logger ?? _silentLogger());
      try { return await b.snapshot(); }
      finally { await b.close(); }
    },
  });

  // ── Browser: evaluate ───────────────────────────────────────────────────
  registerPlugin({
    name:        'browser-evaluate',
    description: 'Execute JavaScript in the browser page context',
    category:    'browser',
    source:      'builtin',
    schema: {
      script: { type: 'string', required: true },
    },
    async invoke(params) {
      const { BrowserTools } = await import('../tools/browser.js');
      const b = new BrowserTools(logger ?? _silentLogger());
      try { return await b.evaluate(params as any); }
      finally { await b.close(); }
    },
  });
}

// ── User plugin loader ────────────────────────────────────────────────────

const _pluginsDir = (() => {
  if (process.env.MUSTB_ROOT) return path.join(process.env.MUSTB_ROOT, 'src', 'plugins');
  if (typeof __dirname !== 'undefined') return path.resolve(__dirname);
  return path.join(process.cwd(), 'src', 'plugins');
})();

/**
 * Scan src/plugins/ for *.mjs files that export a `pluginDefinition` object.
 * Those get registered in the global registry as 'user' source plugins.
 *
 * Expected export shape:
 *   export const pluginDefinition: PluginDefinition = { name, description, category, invoke }
 */
export async function loadUserPlugins(): Promise<string[]> {
  const loaded: string[] = [];
  if (!fs.existsSync(_pluginsDir)) return loaded;

  const entries = fs.readdirSync(_pluginsDir).filter(f => f.endsWith('.mjs'));

  for (const file of entries) {
    const fullPath = path.join(_pluginsDir, file);
    try {
      const mod = await import(`file://${fullPath}`);
      const def: PluginDefinition | undefined = mod.pluginDefinition ?? mod.default?.pluginDefinition;
      if (def && typeof def.invoke === 'function') {
        registerPlugin({ ...def, source: 'user' });
        loaded.push(def.name);
        pluginBus.emit('userPluginLoaded', { name: def.name, file });
      }
    } catch (err: any) {
      pluginBus.emit('userPluginError', { file, message: err.message });
    }
  }

  return loaded;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _silentLogger() {
  const { createLogger, transports } = require('winston') as typeof import('winston');
  return createLogger({ transports: [new transports.Console({ silent: true })] });
}
