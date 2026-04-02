/**
 * Must-b Coordinator (v1.24.0) — Research → Synthesis → Implementation → Verification
 *
 * Architecture transplanted from Claude Code's coordinatorMode.ts:
 *   "You never hand off understanding to another worker."
 *   "Never write 'based on your findings' — synthesize first."
 *
 * Phases:
 *   1. RESEARCH    — Parallel, read-only steps (filesystem, memory, web)
 *   2. SYNTHESIS   — Coordinator reads findings, writes specific impl spec
 *   3. IMPLEMENTATION — Execute with exact file paths + line numbers
 *   4. VERIFICATION — Prove it works; do not rubber-stamp
 *
 * Task notification format (Socket.io 'coordinatorTask' event):
 *   { phase, taskId, status, description, result?, durationMs }
 */

import winston  from 'winston';
import type { Planner }   from './planner.js';
import type { Executor }  from './executor.js';
import type { PlanStep }  from './planner.js';
import type { Server as SocketServer } from 'socket.io';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkPhase = 'research' | 'synthesis' | 'implementation' | 'verification';

export interface WorkerTask {
  id:          string;
  phase:       WorkPhase;
  description: string;
  steps:       PlanStep[];
  result?:     string;
  status:      'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
}

export interface SynthesisSpec {
  goal:                string;
  /** Coordinator-written summary of what was found */
  researchSummary:     string;
  /** Exact steps with file paths, line numbers, specific changes */
  implementationSteps: PlanStep[];
  /** Steps to verify the implementation works */
  verificationSteps:   PlanStep[];
}

export interface CoordinatorResult {
  goal:             string;
  researchFindings: string;
  spec:             SynthesisSpec;
  finalAnswer:      string;
  phases: {
    research:       { steps: number; durationMs: number };
    synthesis:      { durationMs: number };
    implementation: { steps: number; durationMs: number };
    verification:   { steps: number; durationMs: number };
  };
}

// ── Complexity heuristic ──────────────────────────────────────────────────────

/**
 * Determine whether a goal warrants the full coordinator workflow.
 * Coordinator mode is slower but produces higher-quality results for
 * multi-file, architectural, or high-stakes tasks.
 *
 * Returns true for goals that:
 *   - Mention multiple files or "across the codebase"
 *   - Involve refactoring, architecture, or feature implementation
 *   - Require security-sensitive changes
 *   - Explicitly request research/investigation
 */
export function assessCoordinatorNeed(goal: string): boolean {
  const g = goal.toLowerCase();
  const triggers = [
    // Multi-file or system-wide
    /\b(refactor|redesign|architect|migrate|overhaul)\b/i,
    /\ball\s+(files|modules|services|endpoints)\b/i,
    /\bacross\s+the\s+(codebase|project|repo)\b/i,
    /\bmultiple\s+files\b/i,
    // Feature development
    /\bimplement\s+(a\s+)?(new\s+)?(feature|system|module|service|api)\b/i,
    /\badd\s+(support\s+for|full|complete)\b/i,
    // Investigation + fix
    /\b(investigate|diagnose|audit|analyze)\b.*\b(and|then)\s+(fix|implement|add)\b/i,
    /\bfind\s+(all|every|the\s+root)\b/i,
    // Security / compliance
    /\bsecurity\b.*\b(audit|review|fix|vulnerability)\b/i,
    /\b(vulnerability|cve|exploit|injection|xss|sql.inject)\b/i,
    // Multi-step explicit
    /\b(first|step\s+1|phase\s+1)\b.*\bthen\b.*\b(implement|update|change)\b/i,
    // Explicit research
    /\bresearch\b.*\b(and|then)\b/i,
    /\binvestigate\b/i,
  ];
  return triggers.some(p => p.test(g));
}

// ── Coordinator system prompt ─────────────────────────────────────────────────

/**
 * Adapted from Claude Code's coordinatorMode.ts system prompt.
 * Replaces Claude-specific tools with Must-b's PlanStep tool names.
 */
export function getCoordinatorSystemPrompt(): string {
  return `You are Must-b's Coordinator — the strategic brain for complex multi-phase tasks.

## Your Role

You orchestrate work across four phases: Research → Synthesis → Implementation → Verification.
You never delegate understanding to another step. You synthesize before directing.

## Phase Definitions

### RESEARCH (Parallel, Read-Only)
Generate steps that ONLY read data — never write files. Use:
  filesystem_read, filesystem_list, filesystem_search, memory_search,
  browser_research, browser_extract_text, web_search

Cover multiple angles simultaneously. Return findings as structured text.

### SYNTHESIS (You Only)
Read all research findings. Identify:
  - Exact file paths (e.g., src/core/auth.ts)
  - Specific line numbers if relevant
  - Root cause or design decision
  - Exact changes required

NEVER write "based on your findings, implement this." YOU understand. YOU write the spec.

### IMPLEMENTATION (Sequential, Write-Allowed)
Steps must reference exact files and what to change. Use any tool.
Each step should: make the change, then verify it compiles / runs.

### VERIFICATION (Prove It Works)
Run tests, typechecks, or read the modified file.
Prove correctness — do not rubber-stamp.

## Task Notification Format

When a phase completes, emit a coordinatorTask event:
{ phase: "research|synthesis|implementation|verification", status: "completed|failed", result: "..." }

## Writing Implementation Specs

Good: "Fix null pointer in src/auth/validate.ts line 42. The user field is undefined when session expires. Add null check before user.id access — return 401 with 'Session expired' if null."
Bad: "Based on your findings, fix the auth bug."

Good: "Update src/api/endpoints.ts to add POST /api/goals/batch. Import BatchGoal from types.ts line 18. Add rate-limit header X-RateLimit-Limit: 100."
Bad: "Add the batch endpoint like we discussed."`;
}

// ── Research step generator ───────────────────────────────────────────────────

/**
 * Generate read-only research steps from a goal.
 * These steps gather information without modifying any files.
 */
export async function generateResearchSteps(
  goal:    string,
  planner: Planner,
): Promise<PlanStep[]> {
  const researchPrompt = `${goal}

COORDINATOR INSTRUCTION: Generate ONLY research steps (read-only, no file writes).
Steps must use ONLY these tools: filesystem_read, filesystem_list, filesystem_search,
memory_search, browser_research, browser_extract_text, web_search, log.

Each step gathers information needed to write a precise implementation spec.
Cover multiple angles. Return 2–6 steps maximum.`;

  const allSteps = await planner.plan(researchPrompt, '', false);

  // Filter to read-only tools only — safety net
  const READ_ONLY_TOOLS = new Set([
    'filesystem_read', 'filesystem_list', 'filesystem_search', 'filesystem_read_json',
    'filesystem_read_markdown', 'memory_search', 'browser_navigate', 'browser_research',
    'browser_extract_text', 'browser_extract_links', 'browser_snapshot', 'browser_perceive',
    'browser_url', 'web_search', 'http_request', 'log',
  ]);

  return allSteps.filter(s => READ_ONLY_TOOLS.has(s.tool));
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

/**
 * Coordinator synthesizes research findings into a precise implementation spec.
 * This is the most critical step — the coordinator must understand, not delegate.
 */
export async function synthesizeFindings(
  goal:     string,
  findings: Array<{ description: string; result: unknown }>,
  planner:  Planner,
): Promise<SynthesisSpec> {
  const findingsSummary = findings
    .map((f, i) => `Finding ${i + 1} [${f.description}]:\n${JSON.stringify(f.result).slice(0, 800)}`)
    .join('\n\n');

  const synthesisPrompt = `You are Must-b's Coordinator. You just completed a research phase.

GOAL: ${goal}

RESEARCH FINDINGS:
${findingsSummary}

Now synthesize these findings into:
1. A brief research summary (2–3 sentences describing what you found and the root cause/approach)
2. Specific implementation steps with EXACT file paths, line numbers, and changes needed
3. Verification steps to prove the implementation works

Return JSON:
{
  "researchSummary": "...",
  "implementationSteps": [
    { "id": "impl-1", "description": "...", "tool": "filesystem_write", "parameters": { ... } }
  ],
  "verificationSteps": [
    { "id": "verify-1", "description": "...", "tool": "terminal", "parameters": { "command": "..." } }
  ]
}

RULES:
- Every step must reference specific files/paths — never be vague
- Never write "based on findings" in step descriptions — prove you understand
- Implementation steps: max 6. Verification steps: 1–3.`;

  const result = await planner.synthesize(goal, findings as any);

  // Parse the synthesized result or fall back to generating new steps
  try {
    // Try to extract JSON from synthesis result
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        researchSummary: string;
        implementationSteps: PlanStep[];
        verificationSteps: PlanStep[];
      };
      return {
        goal,
        researchSummary:     parsed.researchSummary ?? result.slice(0, 400),
        implementationSteps: parsed.implementationSteps ?? [],
        verificationSteps:   parsed.verificationSteps ?? [],
      };
    }
  } catch { /* fall through to direct plan */ }

  // Fallback: generate implementation plan from synthesis text
  const implSteps = await planner.plan(
    `${goal}\n\nCONTEXT FROM RESEARCH:\n${findingsSummary}\n\nSYNTHESIS:\n${result}\n\nNow generate ONLY implementation steps (no research).`,
    '',
    false,
  );

  return {
    goal,
    researchSummary:     result.slice(0, 600),
    implementationSteps: implSteps,
    verificationSteps:   [],
  };
}

// ── Coordinator Workflow ──────────────────────────────────────────────────────

export class CoordinatorWorkflow {
  private logger:  winston.Logger;
  private planner: Planner;
  private executor: Executor;
  private io?:     SocketServer;

  constructor(logger: winston.Logger, planner: Planner, executor: Executor, io?: SocketServer) {
    this.logger  = logger;
    this.planner = planner;
    this.executor = executor;
    this.io      = io;
  }

  private emit(phase: WorkPhase, status: string, description: string, result?: string) {
    this.io?.emit('coordinatorTask', { phase, status, description, result, ts: Date.now() });
    this.logger.info(`[Coordinator] ${phase.toUpperCase()} — ${status}: ${description}`);
  }

  /**
   * Full coordinator run: Research → Synthesis → Implementation → Verification
   */
  async run(goal: string): Promise<CoordinatorResult> {
    this.emit('research', 'started', `Analyzing: "${goal.slice(0, 80)}"`);

    // ── Phase 1: Research ────────────────────────────────────────────────────
    const researchStart = Date.now();
    let researchSteps: PlanStep[] = [];
    const researchFindings: Array<{ description: string; result: unknown }> = [];

    try {
      researchSteps = await generateResearchSteps(goal, this.planner);
      this.logger.info(`[Coordinator] Research: ${researchSteps.length} steps`);

      // Execute research steps (could be parallel; sequential for safety)
      for (const step of researchSteps) {
        this.emit('research', 'running', step.description);
        try {
          const result = await this.executor.executeStep(step);
          researchFindings.push({ description: step.description, result });
          this.emit('research', 'step-done', step.description, JSON.stringify(result).slice(0, 200));
        } catch (e: any) {
          researchFindings.push({ description: step.description, result: `Error: ${e.message}` });
        }
      }
    } catch (e: any) {
      this.logger.warn(`[Coordinator] Research phase error: ${e.message}`);
    }

    const researchDuration = Date.now() - researchStart;
    this.emit('research', 'completed', `${researchFindings.length} findings gathered`, '');

    // ── Phase 2: Synthesis ───────────────────────────────────────────────────
    this.emit('synthesis', 'started', 'Coordinator synthesizing research into implementation spec');
    const synthesisStart = Date.now();

    let spec: SynthesisSpec;
    try {
      spec = await synthesizeFindings(goal, researchFindings, this.planner);
      this.emit('synthesis', 'completed', spec.researchSummary.slice(0, 120));
    } catch (e: any) {
      this.logger.warn(`[Coordinator] Synthesis failed: ${e.message}`);
      // Fallback: direct plan generation
      const steps = await this.planner.plan(goal, '', false);
      spec = { goal, researchSummary: 'Direct plan (synthesis fallback)', implementationSteps: steps, verificationSteps: [] };
    }

    const synthesisDuration = Date.now() - synthesisStart;

    // ── Phase 3: Implementation ──────────────────────────────────────────────
    this.emit('implementation', 'started', `Executing ${spec.implementationSteps.length} steps`);
    const implStart = Date.now();
    const implResults: Array<{ description: string; result: unknown }> = [];

    for (const step of spec.implementationSteps) {
      this.emit('implementation', 'running', step.description);
      try {
        const result = await this.executor.executeStep(step);
        implResults.push({ description: step.description, result });
        this.emit('implementation', 'step-done', step.description);
      } catch (e: any) {
        implResults.push({ description: step.description, result: `Error: ${e.message}` });
        this.emit('implementation', 'step-failed', step.description, e.message);
        this.logger.error(`[Coordinator] Impl step failed: ${step.description} — ${e.message}`);
      }
    }

    const implDuration = Date.now() - implStart;
    this.emit('implementation', 'completed', `${implResults.length} steps executed`);

    // ── Phase 4: Verification ────────────────────────────────────────────────
    this.emit('verification', 'started', `Verifying with ${spec.verificationSteps.length} checks`);
    const verifyStart = Date.now();
    const verifyResults: Array<{ description: string; result: unknown }> = [];

    for (const step of spec.verificationSteps) {
      this.emit('verification', 'running', step.description);
      try {
        const result = await this.executor.executeStep(step);
        verifyResults.push({ description: step.description, result });
        this.emit('verification', 'step-done', step.description);
      } catch (e: any) {
        verifyResults.push({ description: step.description, result: `Error: ${e.message}` });
        this.emit('verification', 'step-failed', step.description, e.message);
      }
    }

    const verifyDuration = Date.now() - verifyStart;

    // ── Final synthesis ──────────────────────────────────────────────────────
    const allResults = [...implResults, ...verifyResults];
    const finalAnswer = await this.planner.synthesize(goal, allResults as any);

    this.emit('verification', 'completed', 'Coordinator workflow complete');

    return {
      goal,
      researchFindings: researchFindings.map(f => `${f.description}: ${JSON.stringify(f.result).slice(0, 200)}`).join('\n'),
      spec,
      finalAnswer,
      phases: {
        research:       { steps: researchSteps.length,              durationMs: researchDuration },
        synthesis:      {                                            durationMs: synthesisDuration },
        implementation: { steps: spec.implementationSteps.length,   durationMs: implDuration },
        verification:   { steps: spec.verificationSteps.length,     durationMs: verifyDuration },
      },
    };
  }
}
