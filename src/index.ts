#!/usr/bin/env tsx
import winston from 'winston';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { printBanner } from './utils/banner.js';
import { Orchestrator } from './core/orchestrator.js';
import { Planner } from './core/planner.js';
import { Executor } from './core/executor.js';
import { ApiServer } from './interface/api.js';
import { SessionHistory } from './memory/history.js';
import { LongTermMemory } from './memory/long-term.js';
import { runDoctor } from './commands/doctor.js';
import { runOnboard } from './commands/onboard.js';

dotenv.config();

// ── Resolve project root ───────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.MUSTB_ROOT ?? path.resolve(__dirname, '..');

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

// ── Command routing ────────────────────────────────────────────────────────
const rawArg = process.argv[2]?.toLowerCase().trim() ?? '';

async function main() {
  switch (rawArg) {
    case 'doctor':
      await runDoctor(ROOT);
      process.exit(0);

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

// ── Silent pre-boot health check (auto-doctor) ────────────────────────────
function quickHealthCheck(): void {
  const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
  const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;

  // Node version — hard block
  const major = parseInt(process.version.replace('v', '').split('.')[0], 10);
  if (major < 18) {
    console.error(red(`\n  [must-b] Node ${process.version} is unsupported. Requires 18+.\n`));
    process.exit(1);
  }

  // .env missing — soft warning
  if (!fs.existsSync(path.join(ROOT, '.env'))) {
    console.warn(yellow('  [must-b] No .env file found. Run: must-b onboard'));
  }

  // API key missing — soft warning
  const key = process.env.OPENROUTER_API_KEY ?? '';
  if (!key || key.startsWith('sk-or-v1-...')) {
    console.warn(yellow('  [must-b] OPENROUTER_API_KEY not set — AI calls will fail. Run: must-b onboard'));
  }
}

// ── Server / CLI boot ──────────────────────────────────────────────────────
async function bootServer(arg: string) {
  ensureWorldUid();
  quickHealthCheck();

  const mode = arg === 'cli' ? 'cli' : 'web';
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

  // Greet returning users via long-term memory
  const mem = new LongTermMemory(ROOT);
  await mem.load();
  const profile = mem.getProfile();
  if (profile) {
    mem.touchLastSeen();
    await mem.save();
    logger.info(`Welcome back, ${profile.name}!`);
  }

  const planner = new Planner(logger);
  const executor = new Executor(logger);
  const orchestrator = new Orchestrator(logger, planner, executor);

  if (mode === 'web') {
    const history = new SessionHistory(logger, path.join(ROOT, 'memory'));
    const apiServer = new ApiServer(logger, orchestrator, history, PORT);
    apiServer.start();
    return;
  }

  // CLI mode — interactive loop
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
