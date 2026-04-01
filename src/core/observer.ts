import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { LOGS_DIR } from './paths.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ObservedError {
  message:   string;
  stack?:    string;
  filePath?: string;
  timestamp: string;
}

// ── ErrorObserver ──────────────────────────────────────────────────────────

/**
 * ErrorObserver
 *
 * Hooks into process-level unhandled error events and accepts explicit
 * `report()` calls from try-catch blocks.
 *
 * Each captured error is:
 *   1. Written to  memory/logs/<iso-timestamp>-error.md
 *   2. Forwarded to the `onError` callback (normally the self-repair loop)
 *
 * Usage:
 *   const observer = new ErrorObserver({ logger, root, onError: repair });
 *   observer.start();   // registers process handlers once
 *   observer.report(message, stack, filePath);  // manual trigger
 */
export class ErrorObserver {
  private logger:  winston.Logger;
  private logDir:  string;
  private onError: (err: ObservedError) => void;
  private active = false;

  constructor(opts: {
    logger:  winston.Logger;
    root:    string;
    onError: (err: ObservedError) => void;
  }) {
    this.logger  = opts.logger;
    this.logDir  = LOGS_DIR;
    this.onError = opts.onError;
  }

  /** Register process-level handlers (idempotent). */
  start(): void {
    if (this.active) return;
    this.active = true;

    fs.mkdirSync(this.logDir, { recursive: true });

    process.on('uncaughtException', (err: Error) => {
      this.handle({ message: err.message, stack: err.stack });
    });

    process.on('unhandledRejection', (reason: unknown) => {
      const msg   = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack   : undefined;
      this.handle({ message: msg, stack });
    });

    this.logger.info('[Observer] Error observer active — watching for runtime failures.');
  }

  /**
   * Manually report a caught error (e.g. from an orchestrator catch block).
   * @param message   Human-readable error description
   * @param stack     Optional stack trace string
   * @param filePath  Source file that likely caused the error (drives self-repair)
   */
  report(message: string, stack?: string, filePath?: string): void {
    this.handle({ message, stack, filePath });
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private handle(input: { message: string; stack?: string; filePath?: string }): void {
    const observed: ObservedError = {
      message:   input.message,
      stack:     input.stack,
      filePath:  input.filePath,
      timestamp: new Date().toISOString(),
    };

    this.writeLog(observed);
    this.logger.warn(`[Observer] Runtime error captured: ${observed.message}`);

    try {
      this.onError(observed);
    } catch (cbErr: any) {
      this.logger.error(`[Observer] onError callback threw: ${cbErr.message}`);
    }
  }

  /** Persist error to memory/logs/ as a Markdown file. */
  private writeLog(err: ObservedError): void {
    try {
      const safeName = err.timestamp.replace(/[:.]/g, '-');
      const logPath  = path.join(this.logDir, `${safeName}-error.md`);

      const lines = [
        `# Runtime Error Log`,
        ``,
        `**Timestamp:** \`${err.timestamp}\``,
        err.filePath ? `**Source File:** \`${err.filePath}\`` : '',
        ``,
        `## Message`,
        `\`\`\``,
        err.message,
        `\`\`\``,
        ``,
        `## Stack Trace`,
        `\`\`\``,
        err.stack ?? '(no stack trace available)',
        `\`\`\``,
      ].filter((l) => l !== null).join('\n');

      fs.writeFileSync(logPath, lines, 'utf-8');
      this.logger.debug(`[Observer] Error log saved → ${logPath}`);
    } catch {
      /* best-effort — never throw inside an error handler */
    }
  }
}
