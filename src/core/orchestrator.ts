import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import winston from 'winston';
import { Planner, type PlanStep } from './planner.js';
import { Executor } from './executor.js';
import { type CompletionMessage } from './provider.js';
import type { LTMController } from './memory/ltm.js';

export { PlanStep };

// ── Fast-Path Intent Classifier ────────────────────────────────────────────
// Determines whether a user prompt requires the full Planner/Executor pipeline
// (agent mode) or can be answered directly via a single LLM call (direct mode).
//
// Strategy: keyword heuristic — zero LLM calls, sub-millisecond latency.
//   If ANY action-verb pattern or URL is detected → 'agent'
//   Otherwise → 'direct' (conversational, factual, greetings, math, etc.)

const AGENT_PATTERNS: RegExp[] = [
  // Browser / web navigation
  /\b(navigate|browse)\b/i,
  /\bopen\s+(the\s+)?(website|url|browser|page|site|link)\b/i,
  /\b(go\s+to|visit|open)\s+https?:\/\//i,
  /https?:\/\/\S+/,
  // Filesystem
  /\bread\s+(the\s+)?(file|folder|directory|path)\b/i,
  /\bwrite\s+(to\s+)?(the\s+)?(file|disk|path)\b/i,
  /\b(create|delete|remove|rename|move|copy)\s+(a\s+)?(file|folder|directory|script)\b/i,
  /\bsave\s+(this|it)\s+to\b/i,
  /\bpatch\s+(the\s+)?file\b/i,
  // Terminal / shell
  /\b(run|execute|launch)\s+(a\s+)?(command|script|program|code)\b/i,
  /\bterminal\b/i,
  /\bbash\b/i,
  /\bnpm\s+\w/i,
  /\bgit\s+(clone|commit|push|pull|checkout|status|log|diff|add|merge)\b/i,
  /\bpython\s+\w.*\.py\b/i,
  // Web search (explicit)
  /\b(search|look\s+up)\s+(the\s+)?(web|internet|online|google|bing)\b/i,
  /\bfind\s+(it\s+)?(online|on\s+the\s+web)\b/i,
  // System actions
  /\b(take\s+a?\s*)screenshot\b/i,
  /\bdownload\b/i,
  /\binstall\b/i,
  /\blist\s+(the\s+)?(files|folders|contents)\b/i,
  /\bclick\s+(on\s+)?(the\s+)?\w/i,
  /\btype\s+(into|in)\b/i,
];

function classifyIntent(goal: string): 'direct' | 'agent' {
  for (const pat of AGENT_PATTERNS) {
    if (pat.test(goal)) return 'agent';
  }
  return 'direct';
}

/** Classify an error message for self-healing decisions */
function classifyError(msg: string): 'auth' | 'network' | 'ratelimit' | 'overflow' | 'unknown' {
  const m = msg.toLowerCase();
  if (m.includes('401') || m.includes('unauthorized') || m.includes('api key') || m.includes('invalid key')) return 'auth';
  if (m.includes('429') || m.includes('rate limit') || m.includes('too many requests')) return 'ratelimit';
  if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed') || m.includes('network')) return 'network';
  // Context window overflow detection
  if (
    m.includes('context length') ||
    m.includes('context window') ||
    m.includes('maximum context') ||
    m.includes('token limit') ||
    m.includes('too many tokens') ||
    m.includes('prompt is too long') ||
    m.includes('reduce the length') ||
    (m.includes('413') && m.includes('request'))
  ) return 'overflow';
  return 'unknown';
}

/**
 * Compact message history when context window overflow is detected.
 * Drops the oldest non-system turns (keeping system prompt + last N turns).
 * Must-b overflow-compaction strategy.
 */
function compactMessages(
  messages: CompletionMessage[],
  keepTurns = 6,
): CompletionMessage[] {
  const system = messages.filter(m => m.role === 'system');
  const conv   = messages.filter(m => m.role !== 'system');
  // Keep most recent turns; drop oldest to free context
  const trimmed = conv.slice(-keepTurns);
  return [...system, ...trimmed];
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

/**
 * Rotate to the next available API key for auth failures.
 * Reads OPENROUTER_API_KEY, OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3 … from env.
 * Returns true if a new key was activated, false if no alternatives exist.
 */
function rotateApiKey(logger: winston.Logger): boolean {
  const envKeys = [
    'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3',
    'OPENAI_API_KEY_2', 'ANTHROPIC_API_KEY_2',
  ];
  const active = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
  for (const k of envKeys) {
    const v = process.env[k];
    if (v && v !== active && v.length > 8) {
      // Activate this key as the primary
      if (k.startsWith('OPENROUTER') || k.includes('OPENROUTER_API_KEY')) {
        process.env.OPENROUTER_API_KEY = v;
      } else if (k.startsWith('OPENAI')) {
        process.env.OPENAI_API_KEY = v;
      } else if (k.startsWith('ANTHROPIC')) {
        process.env.ANTHROPIC_API_KEY = v;
      }
      logger.info(`Orchestrator: Rotated to backup API key (${k}).`);
      return true;
    }
  }
  return false;
}

/** Exponential back-off: 1s, 2s, 4s … capped at 30s */
function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
}

export class Orchestrator extends EventEmitter {
  private logger: winston.Logger;
  private planner: Planner;
  private executor: Executor;
  private ltm: LTMController | null = null;
  private readonly MAX_REVISIONS = 3;
  private _busy = false;
  /** Tracks recurring error signatures for auto-repair loop deduplication */
  private _errorSignatures: Map<string, number> = new Map();

  get busy(): boolean { return this._busy; }

  constructor(logger: winston.Logger, planner: Planner, executor: Executor, ltm?: LTMController) {
    super();
    this.logger = logger;
    this.planner = planner;
    this.executor = executor;
    this.ltm = ltm ?? null;
    this.logger.info('Orchestrator: Initialized.');
  }

  /** Attach or replace the LTM instance after construction. */
  setLTM(ltm: LTMController): void {
    this.ltm = ltm;
  }

  /** Expose LTM for API layer use. */
  getLTM(): LTMController | null {
    return this.ltm;
  }

  /**
   * Fast-path: bypass Planner/Executor entirely.
   * Emits planStart → finalAnswer → planFinish using a single direct LLM call.
   * Used for conversational prompts that don't require tools.
   */
  async runDirect(goal: string): Promise<void> {
    this._busy = true;
    this.emit('planStart', { goal, timestamp: Date.now() });

    // ── LTM: inject relevant memories into system context ─────────────────
    const memCtx = this.ltm?.buildSystemContext(goal) ?? '';

    try {
      const answer = await this.planner.directChat(goal, memCtx);
      this.emit('finalAnswer', { goal, answer, timestamp: Date.now() });
      this.emit('planFinish', {
        goal, status: 'completed', answer, steps: [], timestamp: Date.now(),
      });
      // ── LTM: auto-index successful conversation ──────────────────────────
      this.ltm?.indexEpisodic(goal, 'completed', answer.slice(0, 400));
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.logger.warn(`Orchestrator: directChat failed — ${msg}`);
      // Self-heal: try once more after env reload
      await reloadEnv();
      try {
        const answer = await this.planner.directChat(goal, memCtx);
        this.emit('finalAnswer', { goal, answer, timestamp: Date.now() });
        this.emit('planFinish', { goal, status: 'completed', answer, steps: [], timestamp: Date.now() });
        this.ltm?.indexEpisodic(goal, 'completed', answer.slice(0, 400));
      } catch (err2: any) {
        const msg2 = err2?.message ?? String(err2);
        this.emit('finalAnswer', { goal, answer: `I'm sorry, I ran into an error: ${msg2}`, timestamp: Date.now() });
        this.emit('planFinish', { goal, status: 'failed', error: msg2, timestamp: Date.now() });
        this.ltm?.indexEpisodic(goal, 'failed');
      }
    } finally {
      this._busy = false;
    }
  }

  async run(goal: string): Promise<void> {
    // ── Fast-Path Router ───────────────────────────────────────────────────
    // Conversational prompts skip the Planner entirely — faster, fewer tokens,
    // avoids JSON-plan hallucinations on local/small models.
    const intent = classifyIntent(goal);
    if (intent === 'direct') {
      this.logger.info(`Orchestrator: Fast-path (direct) — "${goal.slice(0, 80)}"`);
      return this.runDirect(goal);
    }
    this.logger.info(`Orchestrator: Agent mode — "${goal.slice(0, 80)}"`);

    this._busy = true;
    this.emit('planStart', { goal, timestamp: Date.now() });

    // ── LTM: inject relevant memories into planning context ───────────────
    const memCtx = this.ltm?.buildSystemContext(goal) ?? '';

    let revision = 0;
    let currentGoal = goal;

    while (revision <= this.MAX_REVISIONS) {
      try {
        // Plan
        const steps = await this.planner.plan(currentGoal, memCtx);
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

        this._errorSignatures.clear();
        this.logger.info(`Orchestrator: Goal completed — "${goal}"`);
        // Include minimal step shapes + answer so the frontend can offer "Save as Skill"
        this.emit('planFinish', {
          goal,
          status:    'completed',
          answer,
          steps:     steps.map(s => ({ description: s.description, tool: s.tool })),
          timestamp: Date.now(),
        });
        // ── LTM: auto-index successful agent run ────────────────────────────
        this.ltm?.indexEpisodic(goal, 'completed', answer.slice(0, 400));
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
          this.logger.info('Orchestrator: Auth error — reloading .env and attempting key rotation.');
          await reloadEnv();
          const rotated = rotateApiKey(this.logger);
          this.emit('agentRepair', {
            action: rotated ? 'key_rotation' : 'reload_env',
            reason: msg, timestamp: Date.now(),
          });
          // Retry same goal (don't mutate currentGoal for auth errors)
          continue;
        }

        if (kind === 'ratelimit') {
          const wait = backoffMs(revision);
          this.logger.info(`Orchestrator: Rate-limit — waiting ${wait}ms, then trying key rotation.`);
          await new Promise(r => setTimeout(r, wait));
          rotateApiKey(this.logger);
          this.emit('agentRepair', { action: 'backoff+rotation', waitMs: wait, reason: msg, timestamp: Date.now() });
          continue;
        }

        if (kind === 'network') {
          const wait = backoffMs(revision);
          this.logger.info(`Orchestrator: Network error — waiting ${wait}ms then re-planning.`);
          this.emit('agentRepair', { action: 'backoff', waitMs: wait, reason: msg, timestamp: Date.now() });
          await new Promise(r => setTimeout(r, wait));
        }

        // Context window overflow — compact history and shorten the goal to fit within limits.
        if (kind === 'overflow') {
          this.logger.warn('Orchestrator: Context window overflow — compacting history and retrying.');
          this.emit('agentRepair', { action: 'context_compaction', reason: msg, timestamp: Date.now() });
          // Ask the planner to compact its internal history (best-effort)
          if (typeof (this.planner as any).compactHistory === 'function') {
            (this.planner as any).compactHistory();
          }
          // Shorten the re-plan goal so it occupies fewer tokens
          currentGoal = `Concise version of: "${goal.slice(0, 300)}"`;
          continue;
        }

        // Auto-repair loop for unknown errors: track recurring signatures and
        // inject self-diagnostic context into the re-plan goal so the LLM can
        // propose a corrective action on the next attempt.
        const sig = msg.slice(0, 120);
        const sigCount = (this._errorSignatures.get(sig) ?? 0) + 1;
        this._errorSignatures.set(sig, sigCount);

        if (sigCount >= 2) {
          this.logger.warn(`Orchestrator: Recurring error (×${sigCount}) — injecting auto-repair context.`);
          this.emit('agentRepair', {
            action: 'auto_repair',
            errorSignature: sig,
            occurrences: sigCount,
            timestamp: Date.now(),
          });
          currentGoal = [
            `Auto-repair attempt for: "${goal}"`,
            `Recurring error (×${sigCount}): ${msg}`,
            'Diagnose the root cause, attempt a different approach or skip the failing step, and complete the original goal.',
          ].join(' — ');
        } else {
          // First occurrence: re-plan with basic error context
          currentGoal = `Revised: "${goal}" — previous attempt failed: ${msg}`;
        }
      }
    }

    this._busy = false;
  }
}
