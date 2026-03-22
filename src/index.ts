#!/usr/bin/env tsx
import winston from 'winston';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import readline from 'readline';
import { exec } from 'child_process';
import path from 'path';
import { printBanner } from './utils/banner.js';
import { Orchestrator } from './core/orchestrator.js';
import { Planner } from './core/planner.js';
import { Executor } from './core/executor.js';
import { ApiServer, startHealthMonitor } from './interface/api.js';
import { SessionHistory } from './memory/history.js';
import { LongTermMemory } from './memory/long-term.js';
import { runDoctor } from './commands/doctor.js';
import { runOnboard } from './commands/onboard.js';
import { startIdlingInference, attemptSelfRepair } from './core/executor.js';
import { getAgentRole } from './core/hierarchy.js';
import { ErrorObserver } from './core/observer.js';
import { initWorkspace } from './core/paths.js';

dotenv.config();

// ── Resolve project root ───────────────────────────────────────────────────
// MUSTB_ROOT is always set by bin/must-b.cjs before this file runs.
// Fallback: in CJS bundles __dirname is the dist/ directory (injected by Node/esbuild);
// tsx also runs in CJS mode, so __dirname is always available.
// We must NOT use `const __dirname = …` here — that would shadow the CJS global.
function _resolveRoot(): string {
  if (process.env.MUSTB_ROOT) return path.resolve(process.env.MUSTB_ROOT);
  // CJS bundle / tsx: __dirname is always available as a global
  if (typeof __dirname !== 'undefined') return path.resolve(__dirname, '..');
  // Last resort — should never reach here
  return process.cwd();
}
const ROOT = _resolveRoot();

// ── World mode: ensure MUSTB_UID is set and persisted ─────────────────────
function ensureWorldUid() {
  if ((process.env.MUSTB_MODE ?? 'local') !== 'world') return;
  if (process.env.MUSTB_UID) return;
  const uid = 'mustb_' + crypto.randomBytes(12).toString('hex');
  process.env.MUSTB_UID = uid;
  const envPath = path.join(ROOT, '.env');
  try {
    const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').split('\n') : [];
    const idx = lines.findIndex(l => l.startsWith('MUSTB_UID='));
    if (idx >= 0) lines[idx] = `MUSTB_UID=${uid}`;
    else lines.push(`MUSTB_UID=${uid}`);
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
  } catch { /* best-effort */ }
}

// ── First-run check: redirect to full onboard wizard if unconfigured ───────
async function runFirstTimeSetup(): Promise<void> {
  const envPath    = path.join(ROOT, '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  // Consider setup complete if: MUSTB_SETUP_COMPLETE flag is set (v1.3.2+)
  // OR both MUSTB_NAME and LLM_PROVIDER exist (users who set up before v1.3.2)
  const isComplete  = /^MUSTB_SETUP_COMPLETE=true/m.test(envContent);
  const hasName     = /^MUSTB_NAME=/m.test(envContent);
  const hasProvider = /^LLM_PROVIDER=/m.test(envContent);
  if (isComplete || (hasName && hasProvider)) return;
  // Incomplete or cancelled setup — run the full wizard, then exit
  await runOnboard(ROOT);
  process.exit(0);
}

// ── Command routing ────────────────────────────────────────────────────────
const rawArg = process.argv[2]?.toLowerCase().trim() ?? '';

async function main() {
  // First run: prompt for name & language before anything else
  // (skip for non-interactive commands like doctor, help, memory-sync)
  const skipFirstRun = ['doctor', 'help', '--help', '-h', 'memory-sync', 'onboard'].includes(rawArg);
  if (!skipFirstRun) await runFirstTimeSetup();

  switch (rawArg) {
    case 'doctor': {
      const fix = process.argv.includes('--fix');
      await runDoctor(ROOT, fix);
      process.exit(0);
    }

    case 'onboard':
      await runOnboard(ROOT);
      process.exit(0);

    case 'memory-sync': {
      const cyan = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
      const mem = new LongTermMemory(ROOT);
      await mem.load();
      const profile = mem.getProfile();
      if (!profile) {
        console.log('\nNo profile found. Run: must-b onboard\n');
      } else {
        console.log(cyan('\n  Must-b Long-term Memory\n'));
        console.log(mem.getContextSummary());
        const recent = mem.getRecentConversations(10);
        console.log(`\n  ${recent.length} conversation(s) in memory.`);
        console.log(`  Memory files: memory/user.json  memory/must-b.md\n`);
      }
      process.exit(0);
    }

    case 'help':
    case '--help':
    case '-h': {
      const cyan = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
      const dim  = (s: string) => `\x1b[2m${s}\x1b[0m`;
      printBanner('help', 4309);
      console.log('  Usage: must-b [command]\n');
      console.log(`  ${cyan('web')}         ${dim('Start web UI + API gateway (default)')}`);
      console.log(`  ${cyan('cli')}         ${dim('Interactive terminal chat')}`);
      console.log(`  ${cyan('doctor')}      ${dim('System health check (Node, Git, Python, API keys)')}`);
      console.log(`  ${cyan('doctor --fix')} ${dim('Self-Healing mode — auto-repair issues')}`);
      console.log(`  ${cyan('onboard')}     ${dim('First-time setup wizard')}`);
      console.log(`  ${cyan('memory-sync')} ${dim('View / sync long-term memory')}`);
      console.log(`  ${cyan('help')}        ${dim('Show this help')}\n`);
      process.exit(0);
    }

    case 'gateway':
    default:
      await bootServer(rawArg);
  }
}

// ── Gateway Pre-Flight: silent self-healing doctor ────────────────────────
async function runPreFlight(): Promise<void> {
  const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
  const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
  const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

  // Run doctor with fix=true, silent=true → auto-repairs fast issues, skips heavy (~2GB) installs
  const result = await runDoctor(ROOT, true, true);

  if (result.healed > 0) {
    console.log(green(`  [pre-flight] ${result.healed} issue(s) auto-repaired.`));
  }

  if (result.criticalBlock) {
    console.error(red('\n  ══════════════════════════════════════════════════'));
    console.error(red('  [pre-flight] CRITICAL ERROR — Gateway cannot start!'));
    console.error(red('  ══════════════════════════════════════════════════'));
    console.error(yellow('  Required components are missing or corrupted.'));
    console.error(yellow('  The gateway cannot start until these are resolved.'));
    console.error('');
    console.error(dim('  Run diagnostics and repair: must-b doctor --fix'));
    console.error('');
    process.exit(1);
  }
}

// ── Launch URL in default browser (cross-platform) ─────────────────────────
function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'  ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
                                     `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`  [browser] Could not open browser: ${err.message}`);
  });
}

// ── Terminal / Dashboard launch mode selector ──────────────────────────────
async function askLaunchMode(): Promise<'terminal' | 'dashboard'> {
  const cyanFn = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
  const dimFn  = (s: string) => `\x1b[2m${s}\x1b[0m`;
  console.log('');
  console.log(`  ${cyanFn('1')}  Dashboard  ${dimFn('Web UI — opens http://localhost:4309')}`);
  console.log(`  ${cyanFn('2')}  Terminal   ${dimFn('Re-run the setup wizard')}`);
  console.log('');
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Select (1 or 2): ', (answer) => {
      rl.close();
      resolve(answer.trim() === '2' ? 'terminal' : 'dashboard');
    });
    rl.on('close', () => resolve('dashboard'));
  });
}

// ── Server / CLI boot ──────────────────────────────────────────────────────
async function bootServer(arg: string) {
  ensureWorldUid();
  await runPreFlight(); // Deep pre-flight: self-heal silently, block on critical failures

  // If arg is explicitly 'cli' or 'gateway', skip the selection prompt
  let resolvedMode: 'terminal' | 'dashboard';
  if (arg === 'cli') {
    resolvedMode = 'terminal';
  } else if (arg === 'gateway') {
    resolvedMode = 'dashboard';
  } else {
    resolvedMode = await askLaunchMode();
  }

  if (resolvedMode === 'terminal') {
    await runOnboard(ROOT);
    process.exit(0);
  }

  const mode = 'web';
  const PORT = parseInt(process.env.PORT || '4309', 10);

  printBanner(mode, PORT);

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [new winston.transports.Console()],
  });

  try {
    fs.accessSync(ROOT, fs.constants.R_OK | fs.constants.W_OK);
    logger.info(`Workspace OK — ${ROOT}`);
  } catch (err: any) {
    logger.error(`Workspace access failed: ${err.message}`);
    process.exit(1);
  }

  // ── Workspace isolation — all agent output goes under workspace/ ──────────
  initWorkspace();
  logger.info('[Paths] Workspace directories initialised.');

  // ── Error Observer — autonomous runtime error capture + self-repair ───────
  const observer = new ErrorObserver({
    logger,
    root: ROOT,
    onError: (observed) => {
      if (observed.filePath) {
        attemptSelfRepair(
          { message: observed.message, stack: observed.stack },
          observed.filePath,
          logger,
          ROOT,
        ).catch((e: any) => logger.error(`[SelfRepair] Uncaught: ${e.message}`));
      }
    },
  });
  observer.start();

  // Greet returning users via long-term memory + start semantic engine
  const mem = new LongTermMemory(ROOT);
  await mem.load();
  await mem.initSemantic();
  const profile = mem.getProfile();
  if (profile) {
    mem.touchLastSeen();
    await mem.save();
    logger.info(`Welcome back, ${profile.name}!`);
  }

  const planner = new Planner(logger);
  const executor = new Executor(logger, mem);
  const orchestrator = new Orchestrator(logger, planner, executor);

  if (mode === 'web') {
    const history = new SessionHistory(logger, path.join(ROOT, 'memory'));
    const apiServer = new ApiServer(logger, orchestrator, history, PORT);
    apiServer.start();
    // Background health watcher: silent checks every 30 minutes
    startHealthMonitor(ROOT, logger);
    // Dashboard modunda tarayıcıyı otomatik aç
    setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1200);

    // Idling self-improvement loop — only for Planner/Master tier agents
    const caps = getAgentRole();
    if (caps.canIdleInfer) {
      logger.info(`[Hierarchy] Role: ${caps.role} (${caps.tier}, score=${caps.score}) — idling loop enabled.`);
      startIdlingInference(ROOT, logger, 30);
    } else {
      logger.info(`[Hierarchy] Role: ${caps.role} (${caps.tier}, score=${caps.score}) — Worker tier, idling loop skipped.`);
    }

    return;
  }

  // CLI mode — interactive loop (legacy, kept for direct 'cli' arg)
  logger.info('CLI mode. Type a goal and press Enter. "exit" to quit.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.question('\x1b[38;2;0;204;255mMust-b > \x1b[0m', async (line) => {
    const goal = line.trim();
    if (!goal || goal === 'exit') { rl.close(); return; }
    try {
      await orchestrator.run(goal);
      await mem.recordConversation({ goal, outcome: 'completed' });
    } catch (e: any) {
      logger.error(e.message);
      await mem.recordConversation({ goal, outcome: 'failed', summary: e.message });
    }
    prompt();
  });
  prompt();
}

main().catch((err) => {
  console.error('Must-b failed to start:', err);
  process.exit(1);
});
