import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import winston from 'winston';
import { Planner, type PlanStep } from './planner.js';
import { Executor } from './executor.js';

export { PlanStep };

/** Classify an error message for self-healing decisions */
function classifyError(msg: string): 'auth' | 'network' | 'ratelimit' | 'unknown' {
  const m = msg.toLowerCase();
  if (m.includes('401') || m.includes('unauthorized') || m.includes('api key') || m.includes('invalid key')) return 'auth';
  if (m.includes('429') || m.includes('rate limit') || m.includes('too many requests')) return 'ratelimit';
  if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed') || m.includes('network')) return 'network';
  return 'unknown';
}

/** Reload .env into process.env so keys written by onboard are picked up */
async function reloadEnv(): Promise<void> {
  try {
    const require = createRequire(import.meta.url);
    const dotenv = require('dotenv');
    const envPath = path.join(process.cwd(), '.env');
    dotenv.config({ path: envPath, override: true });
  } catch { /* best-effort */ }
}

/** Exponential back-off: 1s, 2s, 4s … capped at 30s */
function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
}

export class Orchestrator extends EventEmitter {
  private logger: winston.Logger;
  private planner: Planner;
  private executor: Executor;
  private readonly MAX_REVISIONS = 3;
  private _busy = false;

  get busy(): boolean { return this._busy; }

  constructor(logger: winston.Logger, planner: Planner, executor: Executor) {
    super();
    this.logger = logger;
    this.planner = planner;
    this.executor = executor;
    this.logger.info('Orchestrator: Initialized.');
  }

  async run(goal: string): Promise<void> {
    this._busy = true;
    this.logger.info(`Orchestrator: Goal received — "${goal}"`);
    this.emit('planStart', { goal, timestamp: Date.now() });

    let revision = 0;
    let currentGoal = goal;

    while (revision <= this.MAX_REVISIONS) {
      try {
        // Plan
        const steps = await this.planner.plan(currentGoal);
        this.emit('planGenerated', { goal: currentGoal, steps, timestamp: Date.now() });

        if (!steps.length) {
          this.emit('planFinish', { goal, status: 'empty', timestamp: Date.now() });
          break;
        }

        // Execute each step
        const stepResults: Array<{ description: string; result: any }> = [];
        for (const step of steps) {
          this.emit('stepStart', { step, timestamp: Date.now() });
          const result = await this.executor.executeStep(step);
          stepResults.push({ description: step.description, result });
          this.emit('stepFinish', { step, status: 'success', result, timestamp: Date.now() });
        }

        // Synthesize final human-readable answer from all step results
        const answer = await this.planner.synthesize(goal, stepResults);
        this.emit('finalAnswer', { goal, answer, timestamp: Date.now() });

        this.logger.info(`Orchestrator: Goal completed — "${goal}"`);
        this.emit('planFinish', { goal, status: 'completed', timestamp: Date.now() });
        break;

      } catch (err: any) {
        revision++;
        const msg = err?.message ?? String(err);
        const kind = classifyError(msg);
        this.logger.warn(`Orchestrator: Step failed [${kind}] (revision ${revision}/${this.MAX_REVISIONS}) — ${msg}`);
        this.emit('stepFinish', { status: 'error', error: msg, errorKind: kind, timestamp: Date.now() });

        if (revision > this.MAX_REVISIONS) {
          this.logger.error(`Orchestrator: Max revisions hit. Aborting goal "${goal}".`);
          this.emit('planFinish', { goal, status: 'failed', error: msg, timestamp: Date.now() });
          break;
        }

        // Self-healing: take remediation action based on error type
        if (kind === 'auth') {
          this.logger.info('Orchestrator: Auth error detected — reloading .env and retrying.');
          this.emit('agentRepair', { action: 'reload_env', reason: msg, timestamp: Date.now() });
          await reloadEnv();
          // Retry same goal (don't mutate currentGoal for auth errors)
          continue;
        }

        if (kind === 'ratelimit') {
          const wait = backoffMs(revision);
          this.logger.info(`Orchestrator: Rate-limit — waiting ${wait}ms before retry.`);
          this.emit('agentRepair', { action: 'backoff', waitMs: wait, reason: msg, timestamp: Date.now() });
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        if (kind === 'network') {
          const wait = backoffMs(revision);
          this.logger.info(`Orchestrator: Network error — waiting ${wait}ms then re-planning.`);
          this.emit('agentRepair', { action: 'backoff', waitMs: wait, reason: msg, timestamp: Date.now() });
          await new Promise(r => setTimeout(r, wait));
        }

        // Re-plan with error context for unknown / network errors
        currentGoal = `Revised: "${goal}" — previous attempt failed: ${msg}`;
      }
    }

    this._busy = false;
  }
}
