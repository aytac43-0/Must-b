/**
 * Must-b Runtime Paths (v1.20.0)
 *
 * Two roots:
 *
 *   STORAGE_ROOT — OS-standard location for ALL user data (memory, DB, logs).
 *     Global install  → %APPDATA%/must-b           (Windows)
 *                     → ~/.config/must-b            (Linux / macOS)
 *     Project/dev     → <projectRoot>/storage/
 *     Explicit        → $MUSTB_DATA_DIR
 *
 *   WORKSPACE_ROOT — Agent output (code, downloads, screenshots).
 *     Default  → STORAGE_ROOT/workspace/
 *     Override → $MUSTB_WORKSPACE
 *
 * Rule: .env stays in the project root. Everything else lives under STORAGE_ROOT.
 */

import fs   from 'fs';
import os   from 'os';
import path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────

function _resolveProjectRoot(): string {
  if (process.env.MUSTB_ROOT) return path.resolve(process.env.MUSTB_ROOT);
  if (typeof __dirname !== 'undefined') return path.resolve(__dirname, '..');
  return process.cwd();
}

function _isGlobalInstall(projectRoot: string): boolean {
  // Explicit flags
  if (process.env.MUSTB_GLOBAL === 'true')  return true;
  if (process.env.MUSTB_GLOBAL === 'false') return false;
  // npm sets this when running from a global install
  if (process.env.npm_config_global === 'true') return true;
  // Path-based heuristic: global npm packages live inside node_modules
  const norm = projectRoot.replace(/\\/g, '/');
  return norm.includes('/node_modules/') || norm.includes('\\node_modules\\');
}

function _osDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'must-b');
  }
  // macOS / Linux: respect XDG_CONFIG_HOME if set
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(xdgConfig, 'must-b');
}

// ── Storage Root ──────────────────────────────────────────────────────────

/**
 * Absolute path to the Must-b data directory.
 *
 * Priority:
 *   1. $MUSTB_DATA_DIR  — explicit override
 *   2. OS-standard dir  — when globally installed ($MUSTB_GLOBAL=true or npm global)
 *   3. <projectRoot>/storage/  — project / dev mode
 */
export const STORAGE_ROOT: string = (() => {
  if (process.env.MUSTB_DATA_DIR) return path.resolve(process.env.MUSTB_DATA_DIR);
  const projectRoot = _resolveProjectRoot();
  if (_isGlobalInstall(projectRoot)) return _osDataDir();
  return path.join(projectRoot, 'storage');
})();

/**
 * ENV_PATH — Safe location for .env that survives npm updates.
 *
 * Global install → STORAGE_ROOT/.env  (e.g. %APPDATA%/must-b/.env)
 * Dev / local    → <projectRoot>/.env  (original behaviour)
 *
 * Migration: on first start after v1.24.1, if STORAGE_ROOT/.env does not exist
 * but <projectRoot>/.env does, the file is silently copied to STORAGE_ROOT.
 * This means existing users keep their config without any manual steps.
 */
export const ENV_PATH: string = (() => {
  const projectRoot = _resolveProjectRoot();
  const globalEnv   = path.join(STORAGE_ROOT, '.env');
  const localEnv    = path.join(projectRoot, '.env');

  if (_isGlobalInstall(projectRoot)) {
    // Auto-migrate: copy local .env → STORAGE_ROOT if it doesn't exist yet
    if (!fs.existsSync(globalEnv) && fs.existsSync(localEnv)) {
      try {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
        fs.copyFileSync(localEnv, globalEnv);
      } catch { /* best-effort */ }
    }
    return globalEnv;
  }
  return localEnv;
})();

/** Long-term memory, vector DB, session history — under STORAGE_ROOT. */
export const MEMORY_DIR: string = path.join(STORAGE_ROOT, 'memory');

/** Runtime log reports (Guard, NightOwl, Observer) — under MEMORY_DIR. */
export const LOGS_DIR: string   = path.join(MEMORY_DIR, 'logs');

// ── Workspace Root ────────────────────────────────────────────────────────

/**
 * Absolute path to the agent output workspace directory.
 */
export const WORKSPACE_ROOT: string = (() => {
  if (process.env.MUSTB_WORKSPACE) return path.resolve(process.env.MUSTB_WORKSPACE);
  return path.join(STORAGE_ROOT, 'workspace');
})();

// ── Sub-directories ───────────────────────────────────────────────────────

/** Code files written by the agent (scripts, patches, generated source). */
export const CODE_DIR       = path.join(WORKSPACE_ROOT, 'code');

/** Data fetched from external sources (APIs, web pages, files). */
export const DATA_DIR       = path.join(WORKSPACE_ROOT, 'data');

/** Downloads from the internet (PDFs, ZIPs, binaries). */
export const DOWNLOADS_DIR  = path.join(WORKSPACE_ROOT, 'downloads');

/** Screenshots captured by the browser tool. */
export const SCREENSHOTS_DIR = path.join(WORKSPACE_ROOT, 'screenshots');

/** Files received via P2P relay (POST /api/world/receive-file). */
export const RECEIVED_FILES_DIR = path.join(WORKSPACE_ROOT, 'received-files');

/** Temporary scratch files (auto-cleaned between sessions). */
export const TMP_DIR        = path.join(WORKSPACE_ROOT, 'tmp');

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Ensure a workspace sub-directory exists, creating it recursively if needed.
 * Returns the absolute path for convenience.
 */
export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a relative path inside WORKSPACE_ROOT.
 * Throws if the resolved path escapes the workspace (path traversal guard).
 *
 * @example
 *   workspacePath('code/fix.ts')  // → '<WORKSPACE_ROOT>/code/fix.ts'
 */
export function workspacePath(...segments: string[]): string {
  const resolved = path.resolve(WORKSPACE_ROOT, ...segments);
  if (!resolved.startsWith(WORKSPACE_ROOT + path.sep) && resolved !== WORKSPACE_ROOT) {
    throw new Error(
      `[paths] Path traversal blocked: "${resolved}" is outside workspace "${WORKSPACE_ROOT}"`
    );
  }
  return resolved;
}

/**
 * Initialise all standard workspace sub-directories.
 * Call once at gateway boot before any agent tool runs.
 */
export function initWorkspace(): void {
  for (const dir of [
    CODE_DIR, DATA_DIR, DOWNLOADS_DIR,
    SCREENSHOTS_DIR, RECEIVED_FILES_DIR, TMP_DIR,
  ]) {
    ensureDir(dir);
  }
}

/**
 * Initialise the full storage tree (memory + logs + workspace).
 * Replaces the old per-module mkdir calls.
 */
export function initStorage(): void {
  ensureDir(STORAGE_ROOT);
  ensureDir(MEMORY_DIR);
  ensureDir(LOGS_DIR);
  initWorkspace();
}

// ── Debug ─────────────────────────────────────────────────────────────────

export function workspaceInfo(): Record<string, string> {
  return {
    WORKSPACE_ROOT,
    CODE_DIR,
    DATA_DIR,
    DOWNLOADS_DIR,
    SCREENSHOTS_DIR,
    RECEIVED_FILES_DIR,
    TMP_DIR,
    hostname: os.hostname(),
  };
}
