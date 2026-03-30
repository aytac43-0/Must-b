/**
 * SummaryEngine — periodic project structure analyzer
 *
 * Every SUMMARY_INTERVAL_MS (default 30 min):
 *   1. Walks workspace/code/ and MUSTB_PROJECT_PATH (2 levels deep)
 *   2. Reads package.json for dependency list
 *   3. Produces a concise "Current Project Context" string
 *   4. Stores it in LTM Semantic memory (tag: project-context)
 *
 * Also exposes snapshotOnce() for an immediate scan at startup.
 */
import fs   from 'fs';
import path from 'path';
import type { LTMController } from '../memory/ltm.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectSnapshot {
  dirs:    string[];   // top-level directories
  files:   Record<string, number>;  // ext → count
  deps:    string[];   // from package.json / requirements.txt
  summary: string;     // human-readable text for LTM
  ts:      number;
}

const SUMMARY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir: string, depth = 0, maxDepth = 2): string[] {
  if (!fs.existsSync(dir)) return [];
  let result: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (/^(node_modules|\.git|dist|__pycache__|\.next|out)$/.test(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        result.push(abs);
        if (depth < maxDepth) result = result.concat(walkDir(abs, depth + 1, maxDepth));
      } else {
        result.push(abs);
      }
    }
  } catch { /* unreadable dir — skip */ }
  return result;
}

function readDeps(scanDir: string): string[] {
  // package.json
  const pkgPath = path.join(scanDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [
        ...Object.keys(pkg.dependencies    ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ].slice(0, 30);
    } catch { /* malformed JSON */ }
  }
  // requirements.txt
  const reqPath = path.join(scanDir, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      return fs.readFileSync(reqPath, 'utf-8')
        .split('\n')
        .map(l => l.split('==')[0].trim())
        .filter(Boolean)
        .slice(0, 30);
    } catch { /* skip */ }
  }
  return [];
}

function extCounts(files: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || '(no ext)';
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return counts;
}

// ── SummaryEngine ─────────────────────────────────────────────────────────────

export class SummaryEngine {
  private workspaceRoot: string;
  private ltm:           LTMController;
  private timer:         ReturnType<typeof setInterval> | null = null;

  constructor(workspaceRoot: string, ltm: LTMController) {
    this.workspaceRoot = workspaceRoot;
    this.ltm           = ltm;
  }

  /** Immediate scan — call at startup and before generating changelog. */
  snapshotOnce(): ProjectSnapshot {
    const scanDirs: string[] = [path.join(this.workspaceRoot, 'code')];
    const projectPath = process.env.MUSTB_PROJECT_PATH?.trim();
    if (projectPath && fs.existsSync(projectPath)) scanDirs.push(projectPath);

    const allFiles: string[] = [];
    const topDirs: string[]  = [];

    for (const d of scanDirs) {
      if (!fs.existsSync(d)) continue;
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) topDirs.push(e.name);
      }
      allFiles.push(...walkDir(d));
    }

    const fileEntries = allFiles.filter(f => !fs.statSync(f).isDirectory());
    const fileCounts  = extCounts(fileEntries);
    const deps        = scanDirs.flatMap(d => readDeps(d));

    const fileTypeSummary = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ext, n]) => `${ext}(${n})`)
      .join(', ');

    const summary = [
      `## Current Project Context`,
      `Workspace: ${this.workspaceRoot}`,
      projectPath ? `Project path: ${projectPath}` : '',
      `Top-level dirs: ${topDirs.slice(0, 12).join(', ') || '(empty)'}`,
      `File types: ${fileTypeSummary || '(no files)'}`,
      `Total files: ${fileEntries.length}`,
      deps.length ? `Dependencies (${deps.length}): ${deps.slice(0, 15).join(', ')}` : '',
      `Scanned at: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    return { dirs: topDirs, files: fileCounts, deps, summary, ts: Date.now() };
  }

  /** Start periodic summaries, storing each in LTM semantic memory. */
  start(): void {
    // Initial scan after 10s (let server boot settle)
    const runAndStore = () => {
      try {
        const snap = this.snapshotOnce();
        this.ltm.indexSemantic(snap.summary, ['project-context', 'workspace-summary']);
      } catch { /* best-effort */ }
    };

    setTimeout(runAndStore, 10_000);

    this.timer = setInterval(runAndStore, SUMMARY_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
