/**
 * WorkspaceWatcher — lightweight chokidar-based file monitor
 *
 * Watches:
 *   - WORKSPACE_ROOT/code/   — agent-generated source files
 *   - MUSTB_PROJECT_PATH      — user's own project (opt-in via env)
 *
 * Detected change categories:
 *   'new_dep'      package.json / requirements.txt modified
 *   'readme'       README.md updated
 *   'new_source'   new .ts/.js/.py/.go file added
 *   'config'       .env / tsconfig / vite.config / next.config changed
 *   'generic'      everything else
 */
import { EventEmitter }        from 'events';
import path                    from 'path';
import { watch, type FSWatcher } from 'chokidar';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChangeKind = 'new_dep' | 'readme' | 'new_source' | 'config' | 'generic';

export interface FileChangeEvent {
  kind:     ChangeKind;
  filePath: string;
  rel:      string;
  op:       'add' | 'change' | 'unlink';
  ts:       number;
}

// ── Pattern classifier ────────────────────────────────────────────────────────

function classify(rel: string): ChangeKind {
  const base = path.basename(rel).toLowerCase();
  if (/^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml)$/.test(base)) return 'new_dep';
  if (/^readme(\.\w+)?$/i.test(base)) return 'readme';
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|kt)$/.test(base)) return 'new_source';
  if (/^(\.|tsconfig|vite\.config|next\.config|babel\.config|\.env)/.test(base)) return 'config';
  return 'generic';
}

// ── WorkspaceWatcher ──────────────────────────────────────────────────────────

export class WorkspaceWatcher extends EventEmitter {
  private watchers:  FSWatcher[]  = [];
  private watchDirs: string[]     = [];

  constructor(workspaceRoot: string) {
    super();
    this.watchDirs = [path.join(workspaceRoot, 'code')];
    const projectPath = process.env.MUSTB_PROJECT_PATH?.trim();
    if (projectPath) this.watchDirs.push(projectPath);
  }

  start(): void {
    for (const dir of this.watchDirs) {
      const w = watch(dir, {
        ignoreInitial: true,
        persistent:    false,
        ignored:       /(node_modules|\.git|dist|__pycache__|\.next)/,
        depth:         4,
      });

      const emit = (op: 'add' | 'change' | 'unlink', absPath: string) => {
        const rel  = path.relative(dir, absPath).replace(/\\/g, '/');
        const kind = classify(rel);
        const ev: FileChangeEvent = { kind, filePath: absPath, rel, op, ts: Date.now() };
        this.emit('fileChange', ev);
      };

      w.on('add',    p => emit('add',    p));
      w.on('change', p => emit('change', p));
      w.on('unlink', p => emit('unlink', p));
      this.watchers.push(w);
    }
  }

  stop(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
  }
}
