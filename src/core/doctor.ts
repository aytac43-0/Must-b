/**
 * src/core/doctor.ts — Boot-time system health module.
 *
 * Wraps src/commands/doctor.ts for use in the gateway boot sequence.
 * Runs checks silently, then prints a compact visible summary.
 * Called from src/index.ts before the API server starts.
 */

import path from 'path';
import { runDoctor } from '../commands/doctor.js';

// ── ANSI helpers ──────────────────────────────────────────────────────────
const orange = (s: string) => `\x1b[38;2;251;146;60m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface BootCheckResult {
  ready: boolean;
  failed: number;
  healed: number;
  remaining: number;
  criticalBlock: boolean;
}

/**
 * runBootCheck — Runs system health diagnostics at gateway startup.
 *
 * Silently runs doctor checks + auto-repair, then prints a visible
 * summary to the console. Exits process if a critical block is found
 * and cannot be healed.
 */
export async function runBootCheck(root: string): Promise<BootCheckResult> {
  const sep = dim('  ─────────────────────────────────────────────────');

  console.log('');
  console.log(orange(bold('  Must-b  ·  Boot Sequence')));
  console.log(sep);

  // Run in silent+fix mode: auto-repairs issues without Y/n prompts,
  // suppresses verbose output — we show our own compact summary below.
  const result = await runDoctor(root, true, true);

  // ── Summary line ────────────────────────────────────────────────────────
  const portCheck = await checkPort(4309);

  console.log(`  ${portCheck.ok ? green('✓') : yellow('⚠')}  Port 4309      ${portCheck.ok ? dim('available') : yellow('in use — server may fail to bind')}`);

  if (result.healed > 0) {
    console.log(`  ${green('✓')}  Auto-repair    ${dim(`${result.healed} issue(s) resolved`)}`);
  }

  if (result.remaining > 0) {
    console.log(`  ${yellow('⚠')}  Issues         ${yellow(`${result.remaining} non-critical — run: must-b doctor`)}`);
  }

  console.log(sep);

  if (result.criticalBlock) {
    console.log('');
    console.log(red(bold('  ✗  SYSTEM BLOCKED')));
    console.log(red('     Critical dependency missing. Gateway cannot start.'));
    console.log(dim('     Repair with: must-b doctor --fix'));
    console.log('');
  } else {
    console.log('');
    console.log(green(bold('  ▶  SYSTEM READY')));
    console.log('');
  }

  return {
    ready: !result.criticalBlock,
    failed: result.failed,
    healed: result.healed,
    remaining: result.remaining,
    criticalBlock: result.criticalBlock,
  };
}

// ── Port availability check ───────────────────────────────────────────────

async function checkPort(port: number): Promise<{ ok: boolean }> {
  return new Promise(resolve => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve({ ok: false }));
    server.once('listening', () => {
      server.close(() => resolve({ ok: true }));
    });
    server.listen(port, '127.0.0.1');
  });
}
