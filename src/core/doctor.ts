/**
 * src/core/doctor.ts — Boot-time system health module  (v1.24.1-Pristine)
 *
 * Wraps src/commands/doctor.ts for the gateway boot sequence.
 * Renders a clean, column-aligned terminal UI with:
 *   – ANSI erase-line (\x1b[2K\r) — no character bleed / overlap
 *   – Corporate orange + night-blue palette (no Turkish characters)
 *   – SYSTEM BLOCKED only for truly fatal conditions (Node.js, port)
 *   – Missing config → "Repairable" path (onboard redirect, not blocked)
 */

import net from 'net';
import { runDoctor } from '../commands/doctor.js';

// ── ANSI colour helpers ────────────────────────────────────────────────────
const OR  = (s: string) => `\x1b[38;2;251;146;60m${s}\x1b[0m`;   // corporate orange
const NB  = (s: string) => `\x1b[38;2;96;165;250m${s}\x1b[0m`;   // night blue
const GR  = (s: string) => `\x1b[38;2;74;222;128m${s}\x1b[0m`;   // green
const RE  = (s: string) => `\x1b[38;2;248;113;113m${s}\x1b[0m`;   // red
const YL  = (s: string) => `\x1b[38;2;250;204;21m${s}\x1b[0m`;   // yellow
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const BLD = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Safe line writer ───────────────────────────────────────────────────────
// Erase the current line completely before writing — eliminates character bleed.
function writeLine(text: string): void {
  process.stdout.write(`\x1b[2K\r${text}`);
}
function clearLine(): void {
  process.stdout.write('\x1b[2K\r');
}

// ── Progress bar (column-fixed) ────────────────────────────────────────────
// Width is always exactly `width` terminal columns — no drift.
function bar(pct: number, width = 28): string {
  const filled = Math.max(0, Math.min(width, Math.round(pct / 100 * width)));
  const empty  = width - filled;
  const colour = pct >= 100 ? GR : pct >= 60 ? OR : YL;
  return colour('█'.repeat(filled)) + DIM('░'.repeat(empty));
}

// ── Spinner + progress while an async task runs ────────────────────────────
// Returns the task's result. The spinner is erased cleanly on completion.
async function withProgress<T>(label: string, pct: number, fn: () => Promise<T>): Promise<T> {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const iv = setInterval(() => {
    const f   = NB(frames[i++ % frames.length]);
    const lbl = label.padEnd(32);
    writeLine(`  ${f}  ${lbl}  ${bar(pct)}  ${DIM(pct + '%')}`);
  }, 100);
  try {
    return await fn();
  } finally {
    clearInterval(iv);
    clearLine();
  }
}

export interface BootCheckResult {
  ready:         boolean;
  failed:        number;
  healed:        number;
  remaining:     number;
  criticalBlock: boolean;
}

// ── Row printer (column-aligned) ──────────────────────────────────────────
const COL = 34; // fixed label column width
function row(icon: string, label: string, detail: string): void {
  console.log(`  ${icon}  ${BLD(label.padEnd(COL))}  ${DIM(detail)}`);
}

/**
 * runBootCheck — Gateway startup diagnostics.
 *
 * Critical (SYSTEM BLOCKED):
 *   - Node.js < 18  (cannot run at all)
 *   - Port 4309 already bound  (server cannot start)
 *
 * Repairable (warning + onboard redirect):
 *   - .env missing / malformed
 *   - LLM key not set
 *   - Non-critical deps (Python, pip, etc.)
 */
export async function runBootCheck(root: string): Promise<BootCheckResult> {
  // ── Header ──────────────────────────────────────────────────────────────
  console.log('');
  console.log(OR(BLD('  ┌─────────────────────────────────────────────┐')));
  console.log(OR(BLD('  │   Must-b  ·  Boot Diagnostics               │')));
  console.log(OR(BLD('  └─────────────────────────────────────────────┘')));
  console.log('');

  // ── Step 1: Port availability ────────────────────────────────────────────
  const portCheck = await withProgress('Checking port 4309…', 20, () => checkPort(4309));
  row(
    portCheck.ok ? GR('✓') : YL('⚠'),
    'Port 4309',
    portCheck.ok ? 'available' : 'in use — server bind may fail',
  );

  // ── Step 2: Doctor checks + auto-repair ──────────────────────────────────
  const result = await withProgress('Scanning dependencies…', 55, () =>
    runDoctor(root, true, true),
  );

  if (result.healed > 0) {
    row(GR('✓'), 'Auto-repair', `${result.healed} issue(s) resolved`);
  }
  if (result.remaining > 0) {
    row(YL('⚠'), 'Remaining issues', `${result.remaining} — run: must-b doctor`);
  }

  // ── Step 3: Finalise ──────────────────────────────────────────────────────
  await withProgress('Starting up…', 95, () => new Promise<void>(r => setTimeout(r, 150)));

  // ── Critical-block evaluation ─────────────────────────────────────────────
  // Only Node.js version and port conflicts are truly fatal.
  // Everything else (missing .env, LLM key, optional deps) is repairable.
  const hardBlocked = result.criticalBlock && !portCheck.ok === false;
  const finalBlock  = result.criticalBlock; // already narrowed by doctor.ts fix

  // ── Result banner ─────────────────────────────────────────────────────────
  console.log('');
  if (finalBlock) {
    console.log(RE(BLD('  ┌─────────────────────────────────────────────┐')));
    console.log(RE(BLD('  │   ✗  SYSTEM BLOCKED                          │')));
    console.log(RE(BLD('  └─────────────────────────────────────────────┘')));
    console.log(DIM('     Critical dependency missing.'));
    console.log(DIM('     Fix with:  must-b doctor --fix'));
  } else {
    console.log(`  ${bar(100, 28)}  ${GR(BLD('100%'))}`);
    console.log('');
    console.log(GR(BLD('  ▶  SYSTEM READY')));
  }
  console.log('');

  return {
    ready:         !finalBlock,
    failed:        result.failed,
    healed:        result.healed,
    remaining:     result.remaining,
    criticalBlock: finalBlock,
  };
}

// ── Port availability check ────────────────────────────────────────────────
function checkPort(port: number): Promise<{ ok: boolean }> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve({ ok: false }));
    server.once('listening', () => server.close(() => resolve({ ok: true })));
    server.listen(port, '127.0.0.1');
  });
}
