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
import { runBootCheck } from './core/doctor.js';
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
function _resolveRoot(): string {
  if (process.env.MUSTB_ROOT) return path.resolve(process.env.MUSTB_ROOT);
  if (typeof __dirname !== 'undefined') return path.resolve(__dirname, '..');
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

// ── First-run check ────────────────────────────────────────────────────────
// Runs the onboarding wizard if setup is incomplete.
// Returns { webMode: true } if the user chose Web Dashboard — caller must
// boot the gateway server instead of continuing the normal launch prompt.
async function runFirstTimeSetup(): Promise<{ webMode?: boolean }> {
  const envPath    = path.join(ROOT, '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  // Complete if: explicit flag (v1.3.2+) OR legacy users with name+provider
  const isComplete  = /^MUSTB_SETUP_COMPLETE=true/m.test(envContent);
  const hasName     = /^MUSTB_NAME=/m.test(envContent);
  const hasProvider = /^LLM_PROVIDER=/m.test(envContent);
  if (isComplete || (hasName && hasProvider)) return {};
  // Incomplete / cancelled — run wizard then fall through to launch prompt
  const result = await runOnboard(ROOT);
  dotenv.config({ override: true }); // pick up keys written by the wizard
  return result ?? {};
}

// ── Command routing ────────────────────────────────────────────────────────
const rawArg = process.argv[2]?.toLowerCase().trim() ?? '';

async function main() {
  // Skip first-run check for pure informational / non-interactive commands
  const skipFirstRun = ['doctor', 'help', '--help', '-h', 'memory-sync', 'onboard'].includes(rawArg);
  if (!skipFirstRun) {
    const setupResult = await runFirstTimeSetup();
    // Phase 2: if the user picked Web Dashboard during first-run setup,
    // boot the gateway immediately and never reach the switch below.
    if (setupResult.webMode) {
      // Browser was already opened by onboard.ts → suppress second launch
      await bootServer('gateway', true);
      return;
    }
  }

  switch (rawArg) {
    // ── Utility commands (always exit) ────────────────────────────────────
    case 'doctor': {
      const fix = process.argv.includes('--fix');
      await runDoctor(ROOT, fix);
      process.exit(0);
    }

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
      console.log(`  ${cyan('(no args)')}    ${dim('Start web dashboard + open browser (default)')}`);
      console.log(`  ${cyan('--logs')}       ${dim('Start web dashboard, stream logs to terminal (no browser)')}`);
      console.log(`  ${cyan('cli')}          ${dim('Interactive terminal chat')}`);
      console.log(`  ${cyan('doctor')}       ${dim('System health check')}`);
      console.log(`  ${cyan('doctor --fix')} ${dim('Self-Healing mode — auto-repair issues')}`);
      console.log(`  ${cyan('onboard')}      ${dim('Re-run the setup wizard')}`);
      console.log(`  ${cyan('memory-sync')} ${dim('View / sync long-term memory')}`);
      console.log(`  ${cyan('help')}         ${dim('Show this help')}\n`);
      process.exit(0);
    }

    // ── Onboard: run wizard then launch dashboard ─────────────────────────
    case 'onboard': {
      const onboardResult = await runOnboard(ROOT);
      dotenv.config({ override: true });
      // suppressBrowser when onboard.ts already opened a tab to /setup
      await bootServer('gateway', Boolean(onboardResult.webMode));
      return;
    }

    // ── Direct-mode shortcuts (no prompt) ─────────────────────────────────
    case 'web':
    case 'gateway':
      await bootServer('gateway');
      return;

    case 'cli':
      await bootServer('cli');
      return;

    // ── --logs: host web server, stream logs to terminal, no auto-browser ─
    case '--logs':
      await bootServer('--logs');
      return;

    // ── Default: no arg → Web Dashboard + open browser immediately ────────
    default:
      await bootServer('gateway');
  }
}

// ── Gateway Pre-Flight: visible boot health check ────────────────────────
async function runPreFlight(): Promise<void> {
  const result = await runBootCheck(ROOT);
  if (result.criticalBlock) process.exit(1);
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


// ── Server / CLI boot ──────────────────────────────────────────────────────
// arg: 'cli' → terminal directly
//      'gateway'|'web' → dashboard directly
//      '' → show launch-mode prompt
// suppressBrowser: when true the auto-browser launch is skipped (used when the
//   onboarding wizard already opened the browser to /setup — prevents a second tab).
async function bootServer(arg: string, suppressBrowser = false) {
  ensureWorldUid();
  await runPreFlight();

  let resolvedMode: 'terminal' | 'dashboard';
  if (arg === 'cli') {
    resolvedMode = 'terminal';
  } else if (arg === '--logs') {
    resolvedMode = 'terminal'; // isHostMode=true → web server + terminal logs, no browser
  } else {
    resolvedMode = 'dashboard'; // 'gateway' | 'web' | default
  }

  const PORT = parseInt(process.env.PORT || '4309', 10);

  // 'terminal' from the menu means "host web server, show logs here" — NOT the
  // old CLI chat loop.  The CLI chat loop is only reached via `must-b cli`.
  const isHostMode = resolvedMode === 'terminal' && arg !== 'cli';

  printBanner(resolvedMode === 'dashboard' || isHostMode ? 'web' : 'cli', PORT);

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

  // ── Memory + Orchestrator (shared by both modes) ──────────────────────────
  const mem = new LongTermMemory(ROOT);
  await mem.load();
  await mem.initSemantic();
  const profile = mem.getProfile();
  if (profile) {
    mem.touchLastSeen();
    await mem.save();
    logger.info(`Welcome back, ${profile.name}!`);
  }

  const planner      = new Planner(logger);
  const executor     = new Executor(logger, mem);
  const orchestrator = new Orchestrator(logger, planner, executor);

  // ── Web Dashboard mode (and "Host in Terminal" menu choice) ─────────────
  if (resolvedMode === 'dashboard' || isHostMode) {
    if (isHostMode) {
      logger.info('Starting Web Dashboard host in terminal — logs will stream here.');
      logger.info(`Open your browser:  http://localhost:${PORT}`);
    }
    const history   = new SessionHistory(logger, path.join(ROOT, 'memory'));
    const apiServer = new ApiServer(logger, orchestrator, history, PORT, ROOT);
    apiServer.start();
    startHealthMonitor(ROOT, logger);

    // ── Ollama Auto-Discovery ─────────────────────────────────────────────
    // Runs silently in background. Warns only if OLLAMA_BASE_URL is set but
    // the daemon is unreachable.
    if ((process.env.LLM_PROVIDER ?? '').toLowerCase() === 'ollama') {
      import('./utils/ollama-autodiscovery.js').then(async ({ autoDiscoverOllama }) => {
        const explicitly = Boolean(process.env.OLLAMA_BASE_URL);
        const result = await autoDiscoverOllama(explicitly);
        if (result.reachable && result.models.length > 0) {
          logger.info(
            `[Ollama] Auto-discovered ${result.models.length} model(s) at ${result.baseUrl}` +
            ` — reasoning: ${result.models.filter(m => m.isReasoning).map(m => m.name).join(', ') || 'none'}`,
          );
        } else if (!result.reachable && explicitly) {
          logger.warn(`[Ollama] Daemon unreachable at ${result.baseUrl}. Run: ollama serve`);
        }
      }).catch((e: any) => logger.warn(`[Ollama] Auto-discovery failed: ${e.message}`));
    }
    // Open browser unless suppressed (e.g. onboarding wizard already opened one tab).
    if (!suppressBrowser) {
      setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1200);
    }

    const caps = getAgentRole();
    if (caps.canIdleInfer) {
      logger.info(`[Hierarchy] Role: ${caps.role} (${caps.tier}, score=${caps.score}) — idling loop enabled.`);
      startIdlingInference(ROOT, logger, 30);
    } else {
      logger.info(`[Hierarchy] Role: ${caps.role} (${caps.tier}, score=${caps.score}) — Worker tier, idling loop skipped.`);
    }

    logger.info(`Dashboard live → http://localhost:${PORT}`);
    // Express keeps the process alive — no return needed, but be explicit:
    return;
  }

  // ── Interactive Terminal (CLI) mode — only reached via `must-b cli` ───────
  logger.info('CLI mode active. Type a goal and press Enter.  "exit" to quit.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => rl.question('\x1b[38;2;0;204;255mMust-b > \x1b[0m', async (line) => {
    const goal = line.trim();
    if (!goal) { prompt(); return; }
    if (goal === 'exit' || goal === 'quit') {
      logger.info('Goodbye!');
      rl.close();
      process.exit(0);
    }
    try {
      await orchestrator.run(goal);
      await mem.recordConversation({ goal, outcome: 'completed' });
    } catch (e: any) {
      logger.error(e.message);
      await mem.recordConversation({ goal, outcome: 'failed', summary: e.message });
    }
    prompt();
  });

  rl.on('close', () => { logger.info('Session ended.'); process.exit(0); });
  prompt();
}

main().catch((err) => {
  console.error('Must-b failed to start:', err);
  process.exit(1);
});
