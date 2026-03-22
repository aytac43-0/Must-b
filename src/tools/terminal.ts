/**
 * Must-b Terminal Tool (v2.0) — Advanced Bash/Shell Execution
 *
 * Runs arbitrary shell commands with configurable timeout, CWD,
 * environment injection, and streamed output capture.
 * No command whitelist — the agent is trusted at this level.
 * Dangerous commands (rm -rf /, shutdown, etc.) are blocked by guard list.
 */

import { exec, spawn }  from 'child_process';
import { EventEmitter } from 'events';
import util  from 'util';
import os    from 'os';
import path  from 'path';

const execAsync = util.promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface TerminalParams {
  command:  string;
  cwd?:     string;
  timeout?: number;               // ms, default 30_000
  env?:     Record<string, string>;
  shell?:   boolean;              // default true
}

export interface TerminalResult {
  stdout:   string;
  stderr:   string;
  exitCode: number;
  command:  string;
  durationMs: number;
}

// ── Blocked pattern guard ─────────────────────────────────────────────────

const BLOCKED = [
  /rm\s+-rf\s+\/(?:\s|$)/,
  /mkfs/,
  /dd\s+if=.*of=\/dev\/(s|h|nv)d/,
  /shutdown\s+(-[hnr]|now)/,
  /halt\b/,
  /reboot\b/,
  /format\s+[a-z]:/i,          // Windows format C:
];

function guardCommand(cmd: string): void {
  for (const pattern of BLOCKED) {
    if (pattern.test(cmd)) {
      throw new Error(`[terminal] Blocked: command matched safety pattern: ${pattern}`);
    }
  }
}

// ── TerminalTools ─────────────────────────────────────────────────────────

export class TerminalTools {
  private defaultCwd: string;
  private defaultTimeout: number;

  constructor(cwd?: string, timeoutMs = 30_000) {
    this.defaultCwd     = cwd ?? process.cwd();
    this.defaultTimeout = timeoutMs;
  }

  /**
   * Execute a command and return its full output once complete.
   */
  async execute(params: TerminalParams): Promise<TerminalResult> {
    const command = params.command.trim();
    guardCommand(command);

    const cwd     = params.cwd ?? this.defaultCwd;
    const timeout = params.timeout ?? this.defaultTimeout;
    const env     = { ...process.env, ...(params.env ?? {}) };

    const t0 = Date.now();
    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout, env });
      return {
        stdout:     stdout.trimEnd(),
        stderr:     stderr.trimEnd(),
        exitCode:   0,
        command,
        durationMs: Date.now() - t0,
      };
    } catch (err: any) {
      return {
        stdout:     (err.stdout ?? '').trimEnd(),
        stderr:     (err.stderr ?? err.message ?? '').trimEnd(),
        exitCode:   err.code ?? 1,
        command,
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Execute a command and emit 'data' events per line (streaming output).
   * Returns an EventEmitter that emits: 'data'(line, stream), 'error'(err), 'close'(exitCode)
   */
  stream(params: TerminalParams): EventEmitter {
    const ee      = new EventEmitter();
    const command = params.command.trim();
    try { guardCommand(command); } catch (e: any) { process.nextTick(() => ee.emit('error', e)); return ee; }

    const shell   = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const flag    = process.platform === 'win32' ? '/C' : '-c';
    const child   = spawn(shell, [flag, command], {
      cwd: params.cwd ?? this.defaultCwd,
      env: { ...process.env, ...(params.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const emit = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      chunk.toString().split(/\r?\n/).filter(Boolean).forEach(line => ee.emit('data', line, stream));
    };

    child.stdout.on('data', emit('stdout'));
    child.stderr.on('data', emit('stderr'));
    child.on('error', (err) => ee.emit('error', err));
    child.on('close', (code) => ee.emit('close', code ?? 0));

    return ee;
  }

  /**
   * Quick helper — run and return stdout or throw with stderr.
   */
  async run(command: string, cwd?: string): Promise<string> {
    const r = await this.execute({ command, cwd });
    if (r.exitCode !== 0) throw new Error(r.stderr || `Exit code ${r.exitCode}`);
    return r.stdout;
  }

  /**
   * Detect the current platform shell info.
   */
  static platformInfo(): { platform: string; shell: string; home: string } {
    return {
      platform: process.platform,
      shell:    process.env.SHELL ?? (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'),
      home:     os.homedir(),
    };
  }
}
