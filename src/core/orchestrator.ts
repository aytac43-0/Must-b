import { EventEmitter } from 'events';
import winston from 'winston';
import { Planner, type PlanStep } from './planner.js';
import { Executor } from './executor.js';

export { PlanStep };

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
        for (const step of steps) {
          this.emit('stepStart', { step, timestamp: Date.now() });
          const result = await this.executor.executeStep(step);
          this.emit('stepFinish', { step, status: 'success', result, timestamp: Date.now() });
        }

        // All steps passed
        this.logger.info(`Orchestrator: Goal completed — "${goal}"`);
        this.emit('planFinish', { goal, status: 'completed', timestamp: Date.now() });
        break;

      } catch (err: any) {
        revision++;
        const msg = err?.message ?? String(err);
        this.logger.warn(`Orchestrator: Step failed (revision ${revision}/${this.MAX_REVISIONS}) — ${msg}`);
        this.emit('stepFinish', { status: 'error', error: msg, timestamp: Date.now() });

        if (revision > this.MAX_REVISIONS) {
          this.logger.error(`Orchestrator: Max revisions hit. Aborting goal "${goal}".`);
          this.emit('planFinish', { goal, status: 'failed', error: msg, timestamp: Date.now() });
          break;
        }

        // Re-plan with error context
        currentGoal = `Revised: "${goal}" — previous attempt failed: ${msg}`;
      }
    }

    this._busy = false;
  }
}
