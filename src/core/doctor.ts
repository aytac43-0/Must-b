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
const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;

// ── Elite progress bar ────────────────────────────────────────────────────
// Renders a filled/empty bar: ████████░░  62%
function progressBar(pct: number, width = 24): string {
  const filled = Math.round(pct / 100 * width);
  const empty  = width - filled;
  const color  = pct >= 100 ? green : pct >= 60 ? orange : yellow;
  return color('█'.repeat(filled)) + dim('░'.repeat(empty));
}

// ── Animated step printer ─────────────────────────────────────────────────
// Renders: "  ⟳  Kontrol ediliyor…" then overwrites with result.
async function runStep<T>(
  label: string,
  fn: () => Promise<T>,
  stepNum: number,
  totalSteps: number,
): Promise<T> {
  const pct = Math.round((stepNum / totalSteps) * 100);
  process.stdout.write(
    `\r  ${cyan('⟳')}  ${label.padEnd(36)} ${progressBar(pct, 20)} ${dim(pct + '%')}   `
  );
  const result = await fn();
  return result;
}

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
  const BAR_WIDTH  = 32;
  const TOTAL_STEPS = 3;   // port → doctor → finalize

  console.log('');
  console.log(orange(bold('  ╔══════════════════════════════════════════╗')));
  console.log(orange(bold('  ║   Must-b  ·  Boot Diagnostics v1.24     ║')));
  console.log(orange(bold('  ╚══════════════════════════════════════════╝')));
  console.log('');

  // ── Step 1: Port check ────────────────────────────────────────────────
  const portCheck = await runStep('Port 4309 kontrol ediliyor…', () => checkPort(4309), 1, TOTAL_STEPS);
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  console.log(
    `  ${portCheck.ok ? green('✓') : yellow('⚠')}  ${bold('Port 4309'.padEnd(28))}  ${portCheck.ok ? dim('uygun') : yellow('kullanımda — bind başarısız olabilir')}`
  );

  // ── Step 2: Doctor silent+fix ─────────────────────────────────────────
  let result = { failed: 0, healed: 0, remaining: 0, criticalBlock: false };
  const doctorStep = runStep(
    'Sistem bağımlılıkları taranıyor…',
    () => runDoctor(root, true, true),
    2, TOTAL_STEPS,
  );

  if (result.healed === 0) {
    // show a live "Onarılıyor…" pulse while doctor runs
    const healFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let hf = 0;
    const healInterval = setInterval(() => {
      const bar = progressBar(45 + (hf % 10) * 2, BAR_WIDTH);
      process.stdout.write(
        `\r  ${orange(healFrames[hf++ % healFrames.length])}  ${orange('Onarılıyor…').padEnd(36)}  ${bar}   `
      );
    }, 120);
    result = await doctorStep;
    clearInterval(healInterval);
    process.stdout.write('\r' + ' '.repeat(90) + '\r');
  } else {
    result = await doctorStep;
    process.stdout.write('\r' + ' '.repeat(90) + '\r');
  }

  if (result.healed > 0) {
    console.log(`  ${green('✓')}  ${bold('Oto-onarım'.padEnd(28))}  ${dim(`${result.healed} sorun giderildi`)}`);
  }
  if (result.remaining > 0) {
    console.log(`  ${yellow('⚠')}  ${bold('Kalan sorunlar'.padEnd(28))}  ${yellow(`${result.remaining} — çalıştır: must-b doctor`)}`);
  }

  // ── Step 3: Finalize + 100% bar ───────────────────────────────────────
  process.stdout.write(`\r  ${cyan('⟳')}  ${'Hazırlanıyor…'.padEnd(36)}  ${progressBar(100, BAR_WIDTH)} ${dim('100%')}   `);
  await new Promise(r => setTimeout(r, 180));
  process.stdout.write('\r' + ' '.repeat(90) + '\r');

  // ── Result banner ─────────────────────────────────────────────────────
  console.log('');
  if (result.criticalBlock) {
    console.log(red(bold('  ╔══════════════════════════════════════════╗')));
    console.log(red(bold('  ║   ✗  SYSTEM BLOCKED                      ║')));
    console.log(red(bold('  ╚══════════════════════════════════════════╝')));
    console.log(dim('     Kritik bağımlılık eksik. Onar: must-b doctor --fix'));
  } else {
    const bar = progressBar(100, BAR_WIDTH);
    console.log(`  ${bar}  ${green(bold('100%'))}`);
    console.log('');
    console.log(green(bold('  ▶  SİSTEM HAZIR')));
  }
  console.log('');

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
