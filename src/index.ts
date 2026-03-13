import winston from 'winston';
import dotenv from 'dotenv';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { printBanner } from './utils/banner.js';
import { Orchestrator } from './core/orchestrator.js';
import { Planner } from './core/planner.js';
import { Executor } from './core/executor.js';
import { ApiServer } from './interface/api.js';
import { SessionHistory } from './memory/history.js';

dotenv.config();

const rawArg = process.argv[2]?.toLowerCase().trim();
const mode = rawArg === 'cli' ? 'cli' : 'web';
const PORT = parseInt(process.env.PORT || '4309', 10);

// ── Banner first ────────────────────────────────────────────────────
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

function checkEnvironment(): boolean {
  try {
    fs.accessSync(process.cwd(), fs.constants.R_OK | fs.constants.W_OK);
    logger.info(`Workspace OK — ${process.cwd()}`);
    return true;
  } catch (err: any) {
    logger.error(`Workspace access failed: ${err.message}`);
    return false;
  }
}

async function boot() {
  if (!checkEnvironment()) {
    process.exit(1);
  }

  const planner = new Planner(logger);
  const executor = new Executor(logger);
  const orchestrator = new Orchestrator(logger, planner, executor);

  if (mode === 'web') {
    const history = new SessionHistory(logger, 'memory');
    const apiServer = new ApiServer(logger, orchestrator, history, PORT);
    apiServer.start();
    return;
  }

  logger.info('CLI mode. Type a goal and press Enter. "exit" to quit.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.question('\x1b[38;2;0;204;255mMust-b > \x1b[0m', async (line) => {
    const goal = line.trim();
    if (!goal || goal === 'exit') { rl.close(); return; }
    try { await orchestrator.run(goal); } catch (e: any) { logger.error(e.message); }
    prompt();
  });
  prompt();
}

boot().catch((err) => {
  console.error('Must-b failed to start:', err);
  process.exit(1);
});
