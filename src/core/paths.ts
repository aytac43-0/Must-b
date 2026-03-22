/**
 * Must-b Workspace Paths
 *
 * Single source of truth for every user-generated file produced at runtime:
 * code files, fetched data, downloads, screenshots, received files, etc.
 *
 * ALL agent output MUST be written under WORKSPACE_ROOT.
 * Nothing outside this directory should be written by agent tools.
 *
 * Default: c:/Users/<user>/must-b/workspace/
 * Override: set the MUSTB_WORKSPACE environment variable.
 */

import fs   from 'fs';
import os   from 'os';
import path from 'path';

// ── Root ──────────────────────────────────────────────────────────────────

/**
 * Absolute path to the user workspace directory.
 * Determined once at module load; guaranteed to exist on disk.
 */
export const WORKSPACE_ROOT: string = (() => {
  if (process.env.MUSTB_WORKSPACE) return path.resolve(process.env.MUSTB_WORKSPACE);

  // Resolve project root — works in CJS bundle (esbuild __dirname) and tsx,
  // and always when MUSTB_ROOT is set by bin/must-b.cjs.
  let projectRoot: string;
  if (process.env.MUSTB_ROOT) {
    projectRoot = path.resolve(process.env.MUSTB_ROOT);
  } else if (typeof __dirname !== 'undefined') {
    // CJS bundle / tsx: __dirname = dist/ → one level up is project root
    projectRoot = path.resolve(__dirname, '..');
  } else {
    // Last resort — should never reach here
    projectRoot = process.cwd();
  }
  return path.join(projectRoot, 'workspace');
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
