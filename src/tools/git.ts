/**
 * Must-b Git Tool (v1.0) — Full Git Integration
 *
 * Provides commit, push, pull, branch, log, diff, status, and
 * GitHub PR creation (via `gh` CLI when available).
 */

import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface GitParams {
  cwd?: string;
}

export interface CommitParams extends GitParams {
  message:  string;
  files?:   string[];   // specific files to stage; default = all changed files
  amend?:   boolean;
}

export interface PushParams extends GitParams {
  remote?: string;      // default 'origin'
  branch?: string;      // default current branch
  force?:  boolean;
}

export interface PullParams extends GitParams {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface BranchParams extends GitParams {
  name:     string;
  checkout?: boolean;
  delete?:  boolean;
}

export interface LogParams extends GitParams {
  count?: number;       // default 10
  oneline?: boolean;
}

export interface DiffParams extends GitParams {
  staged?: boolean;
  file?:   string;
}

export interface PrParams extends GitParams {
  title:   string;
  body?:   string;
  base?:   string;      // target branch, default 'main'
  draft?:  boolean;
}

// ── GitTools ───────────────────────────────────────────────────────────────

export class GitTools {
  private defaultCwd: string;

  constructor(cwd?: string) {
    this.defaultCwd = cwd ?? process.cwd();
  }

  private cwd(params?: GitParams): string {
    return params?.cwd ?? this.defaultCwd;
  }

  private async run(cmd: string, cwd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd });
      return (stdout + (stderr ? `\nstderr: ${stderr}` : '')).trimEnd();
    } catch (err: any) {
      throw new Error(err.stderr?.trim() || err.message);
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────

  async status(params?: GitParams): Promise<string> {
    return this.run('git status --short', this.cwd(params));
  }

  // ── Stage + Commit ───────────────────────────────────────────────────────

  async commit(params: CommitParams): Promise<string> {
    const cwd = this.cwd(params);
    // Stage files
    const filePart = params.files && params.files.length > 0
      ? params.files.map(f => `"${f}"`).join(' ')
      : '--all';
    await this.run(`git add ${filePart}`, cwd);
    // Commit
    const msg   = params.message.replace(/"/g, '\\"');
    const amend = params.amend ? '--amend --no-edit ' : '';
    return this.run(`git commit ${amend}-m "${msg}"`, cwd);
  }

  // ── Push ────────────────────────────────────────────────────────────────

  async push(params?: PushParams): Promise<string> {
    const cwd    = this.cwd(params);
    const remote = params?.remote ?? 'origin';
    const branch = params?.branch ?? await this.currentBranch(cwd);
    const force  = params?.force ? ' --force-with-lease' : '';
    return this.run(`git push ${remote} ${branch}${force}`, cwd);
  }

  // ── Pull ────────────────────────────────────────────────────────────────

  async pull(params?: PullParams): Promise<string> {
    const cwd    = this.cwd(params);
    const remote = params?.remote ?? 'origin';
    const branch = params?.branch ?? await this.currentBranch(cwd);
    const rebase = params?.rebase ? ' --rebase' : '';
    return this.run(`git pull${rebase} ${remote} ${branch}`, cwd);
  }

  // ── Branch ──────────────────────────────────────────────────────────────

  async branch(params: BranchParams): Promise<string> {
    const cwd = this.cwd(params);
    if (params.delete) return this.run(`git branch -d "${params.name}"`, cwd);
    const checkout = params.checkout ? '-b ' : '';
    return this.run(`git checkout ${checkout}"${params.name}"`, cwd);
  }

  async listBranches(params?: GitParams): Promise<string> {
    return this.run('git branch -a', this.cwd(params));
  }

  // ── Log ─────────────────────────────────────────────────────────────────

  async log(params?: LogParams): Promise<string> {
    const count   = params?.count ?? 10;
    const format  = params?.oneline ? '--oneline' : '--format="%h  %ad  %s  [%an]" --date=short';
    return this.run(`git log -${count} ${format}`, this.cwd(params));
  }

  // ── Diff ────────────────────────────────────────────────────────────────

  async diff(params?: DiffParams): Promise<string> {
    const staged = params?.staged ? '--cached ' : '';
    const file   = params?.file   ? `-- "${params.file}"` : '';
    return this.run(`git diff ${staged}${file}`, this.cwd(params));
  }

  // ── PR creation via gh CLI ───────────────────────────────────────────────

  async createPr(params: PrParams): Promise<string> {
    const cwd   = this.cwd(params);
    const base  = params.base  ?? 'main';
    const draft = params.draft ? ' --draft' : '';
    const body  = params.body
      ? ` --body "${params.body.replace(/"/g, '\\"')}"`
      : '';
    return this.run(
      `gh pr create --title "${params.title.replace(/"/g, '\\"')}" --base ${base}${draft}${body}`,
      cwd,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async currentBranch(cwd?: string): Promise<string> {
    return this.run('git rev-parse --abbrev-ref HEAD', cwd ?? this.defaultCwd);
  }

  async remoteUrl(cwd?: string): Promise<string> {
    return this.run('git remote get-url origin', cwd ?? this.defaultCwd).catch(() => 'unknown');
  }

  async isRepo(dir?: string): Promise<boolean> {
    try { await this.run('git rev-parse --is-inside-work-tree', dir ?? this.defaultCwd); return true; }
    catch { return false; }
  }
}
