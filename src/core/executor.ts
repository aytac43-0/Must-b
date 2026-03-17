import net from 'net';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import http from 'http';
import winston from 'winston';
import { FilesystemTools } from '../tools/filesystem.js';
import { TerminalTools } from '../tools/terminal.js';
import { BrowserTools } from '../tools/browser.js';
import { LongTermMemory } from '../memory/long-term.js';

export interface PlanStep {
  id: string;
  description: string;
  tool: string;
  parameters: Record<string, any>;
}

// ── Device IPC Client ─────────────────────────────────────────────────────
// Communicates with the MustB macOS companion app via a Unix socket.
// The macOS app exposes a JSONL protocol on ~/.mustb/device.sock.
// On non-macOS platforms commands gracefully return a "not available" result.

const DEVICE_SOCK = path.join(os.homedir(), '.mustb', 'device.sock');
const DEVICE_IPC_TIMEOUT_MS = 8_000;

async function sendDeviceCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Device IPC requires the MustB macOS companion app.' };
  }
  return new Promise((resolve) => {
    const socket = net.createConnection(DEVICE_SOCK);
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'Device IPC timeout — is the MustB app running?' });
    }, DEVICE_IPC_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write(JSON.stringify({ command, params }) + '\n');
    });
    socket.on('data', (chunk) => { buf += chunk.toString(); });
    socket.on('end', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(buf.trim())); } catch { resolve({ ok: false, raw: buf }); }
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `IPC error: ${err.message}` });
    });
  });
}

export class Executor {
  private logger: winston.Logger;
  private fsTools: FilesystemTools;
  private terminalTools: TerminalTools;
  private browserTools: BrowserTools;
  private mem: LongTermMemory | null;

  constructor(logger: winston.Logger, mem?: LongTermMemory) {
    this.logger = logger;
    this.fsTools = new FilesystemTools();
    this.terminalTools = new TerminalTools();
    this.browserTools = new BrowserTools(logger);
    this.mem = mem ?? null;
  }

  async executeStep(step: PlanStep): Promise<any> {
    this.logger.info(`Executor: [${step.id}] ${step.description}`);

    try {
      let result: any;

      switch (step.tool) {
        // ── Filesystem ──────────────────────────────────────────────────────
        case 'filesystem_read':
          result = await this.fsTools.readFile(step.parameters as any);
          break;

        case 'filesystem_write':
          result = await this.fsTools.writeFile(step.parameters as any);
          break;

        case 'filesystem_list':
          result = await this.fsTools.listFiles(step.parameters as any);
          break;

        // ── Terminal ────────────────────────────────────────────────────────
        case 'terminal':
          result = await this.terminalTools.execute(step.parameters as any);
          break;

        // ── Browser ─────────────────────────────────────────────────────────
        case 'browser_navigate':
          result = await this.browserTools.navigate(step.parameters as any);
          break;

        case 'browser_screenshot':
          result = await this.browserTools.screenshot(step.parameters as any);
          break;

        case 'browser_click':
          result = await this.browserTools.click(step.parameters as any);
          break;

        case 'browser_type':
          result = await this.browserTools.type(step.parameters as any);
          break;

        case 'browser_extract':
          result = await this.browserTools.extract(step.parameters as any);
          break;

        case 'browser_snapshot':
          result = await this.browserTools.snapshot();
          break;

        case 'browser_evaluate':
          result = await this.browserTools.evaluate(step.parameters as any);
          break;

        case 'browser_url':
          result = await this.browserTools.currentUrl();
          break;

        case 'browser_close':
          await this.browserTools.close();
          result = { success: true };
          break;

        // ── Memory ──────────────────────────────────────────────────────────
        case 'memory_search': {
          const query = String(step.parameters.query ?? '');
          const limit = Number(step.parameters.limit ?? 10);
          if (!this.mem) {
            result = { results: [], note: 'Memory not initialized' };
          } else {
            const entries = this.mem.searchMemory(query, limit);
            result = { results: entries };
          }
          break;
        }

        case 'memory_write': {
          if (this.mem) {
            const content = String(step.parameters.content ?? '');
            await this.mem.recordConversation({
              goal: content,
              outcome: 'completed',
              summary: step.parameters.summary as string | undefined,
            });
          }
          result = { success: true };
          break;
        }

        // ── Web Search (DuckDuckGo via Playwright) ───────────────────────────
        case 'web_search': {
          const query = String(step.parameters.query ?? '');
          const maxResults = Number(step.parameters.maxResults ?? 5);
          if (!query) { result = { results: [] }; break; }
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          await this.browserTools.navigate({ url: searchUrl, waitFor: 'domcontentloaded' });
          const raw = await this.browserTools.extract({ selector: '.result__snippet' });
          const titles = await this.browserTools.extract({ selector: '.result__title' });
          const snippets = (raw.text ?? '').split('\n').filter(Boolean).slice(0, maxResults);
          result = { query, snippets };
          break;
        }

        // ── Device Skills (MustBKit IPC — requires macOS companion app) ─────
        case 'device_camera': {
          // params: { quality?: 'low'|'medium'|'high', camera?: 'front'|'back' }
          result = await sendDeviceCommand('camera.capture', {
            quality: step.parameters.quality ?? 'medium',
            camera:  step.parameters.camera  ?? 'back',
          });
          break;
        }

        case 'device_calendar': {
          // params: { action: 'list'|'create', title?, startDate?, endDate?, notes? }
          const action = String(step.parameters.action ?? 'list');
          result = await sendDeviceCommand(`calendar.${action}`, step.parameters);
          break;
        }

        case 'device_screen': {
          // params: { format?: 'png'|'jpeg', rect?: {x,y,width,height} }
          result = await sendDeviceCommand('screen.capture', {
            format: step.parameters.format ?? 'png',
            rect:   step.parameters.rect   ?? null,
          });
          break;
        }

        case 'device_system': {
          // params: { action: 'volume'|'brightness'|'battery'|'wifi', value?: number }
          result = await sendDeviceCommand('system.control', {
            action: String(step.parameters.action ?? 'battery'),
            value:  step.parameters.value ?? null,
          });
          break;
        }

        // ── Utility ─────────────────────────────────────────────────────────
        case 'log':
          this.logger.info(`> ${step.parameters.message}`);
          result = { success: true };
          break;

        default:
          throw new Error(`Unknown tool: ${step.tool}`);
      }

      this.logger.info(`Executor: Step [${step.id}] completed.`);
      return result;

    } catch (error: any) {
      this.logger.error(`Executor: Error in step ${step.id} — ${error.message}`);
      throw error;
    }
  }

  /** Plan tamamlandıktan sonra tarayıcı gibi kaynakları serbest bırak */
  async cleanup(): Promise<void> {
    if (this.browserTools.isOpen) {
      await this.browserTools.close();
    }
  }
}

// ── Idling Self-Improvement Loop ─────────────────────────────────────────

/**
 * Starts a background idling inference loop.
 *
 * When no user activity is detected and a local Ollama model is reachable,
 * Must-b scans the extensions/ directory for installed plugins, analyses
 * each plugin manifest and source for potential issues or improvements, and
 * writes a Markdown report to memory/idling-report.md.
 *
 * Suggestions are never auto-applied — they are saved for human review.
 * The loop sleeps for `intervalMinutes` between passes.
 *
 * @param root             Project root directory
 * @param logger           Winston logger instance
 * @param intervalMinutes  Minutes between scans (default 30)
 * @returns NodeJS.Timeout handle — call clearInterval to stop
 */
export function startIdlingInference(
  root: string,
  logger: winston.Logger,
  intervalMinutes = 30
): NodeJS.Timeout {
  const fs   = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const http = require('http') as typeof import('http');

  const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const EXT_DIR     = path.join(root, 'src', 'core', 'extensions');
  const REPORT_PATH = path.join(root, 'memory', 'idling-report.md');
  const MODEL       = process.env.OLLAMA_IDLE_MODEL ?? 'phi3:mini';

  /** Check if Ollama daemon is reachable */
  function isOllamaReachable(): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL('/api/tags', OLLAMA_BASE);
      http.get({ hostname: url.hostname, port: Number(url.port || 11434), path: url.pathname }, (r) => {
        resolve((r.statusCode ?? 0) < 400);
      }).on('error', () => resolve(false));
    });
  }

  /** Ask Ollama to analyse a plugin snippet */
  function ollamaPrompt(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const body = Buffer.from(JSON.stringify({ model: MODEL, prompt, stream: false }));
      const url  = new URL('/api/generate', OLLAMA_BASE);
      const req  = http.request({
        hostname: url.hostname,
        port:     Number(url.port || 11434),
        path:     url.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': body.byteLength },
      }, (r) => {
        let raw = '';
        r.on('data', c => { raw += c; });
        r.on('end', () => {
          try { resolve(JSON.parse(raw).response ?? ''); } catch { resolve(''); }
        });
      });
      req.on('error', () => resolve(''));
      req.write(body);
      req.end();
    });
  }

  /** Scan extensions/ and collect plugin manifests */
  function collectPlugins(): Array<{ id: string; dir: string; manifest: Record<string, unknown> }> {
    const plugins: Array<{ id: string; dir: string; manifest: Record<string, unknown> }> = [];
    if (!fs.existsSync(EXT_DIR)) return plugins;

    for (const entry of fs.readdirSync(EXT_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pluginJson = path.join(EXT_DIR, entry.name, 'must-b.plugin.json');
      if (!fs.existsSync(pluginJson)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf-8')) as Record<string, unknown>;
        plugins.push({ id: String(manifest.id ?? entry.name), dir: path.join(EXT_DIR, entry.name), manifest });
      } catch { /* malformed JSON — skip */ }
    }
    return plugins;
  }

  const run = async () => {
    if (!(await isOllamaReachable())) {
      logger.debug('[Idling] Ollama not reachable — skipping inference pass.');
      return;
    }

    const plugins = collectPlugins();
    if (plugins.length === 0) {
      logger.debug('[Idling] No plugins found — skipping pass.');
      return;
    }

    logger.info(`[Idling] Starting inference pass — ${plugins.length} plugin(s) to analyse.`);

    const sections: string[] = [
      `# Must-b Idling Report\n_Generated: ${new Date().toISOString()}_\n`,
    ];

    for (const plugin of plugins) {
      const pkgPath = path.join(plugin.dir, 'package.json');
      let pkgSnippet = '';
      try { pkgSnippet = fs.readFileSync(pkgPath, 'utf-8').slice(0, 600); } catch { /* no package.json */ }

      const prompt = [
        `You are a code quality assistant reviewing a Must-b plugin.`,
        `Plugin ID: ${plugin.id}`,
        `Manifest: ${JSON.stringify(plugin.manifest, null, 2).slice(0, 400)}`,
        pkgSnippet ? `package.json (truncated):\n${pkgSnippet}` : '',
        `Task: In 3–5 bullet points, identify any obvious issues (missing fields, deprecated patterns, security risks) and suggest improvements. Be concise.`,
      ].filter(Boolean).join('\n');

      const suggestion = await ollamaPrompt(prompt);

      sections.push(
        `## Plugin: \`${plugin.id}\`\n\n${suggestion.trim() || '_No suggestions generated._'}\n`
      );
    }

    try {
      fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
      fs.writeFileSync(REPORT_PATH, sections.join('\n'), 'utf-8');
      logger.info(`[Idling] Report written → ${REPORT_PATH}`);
    } catch (err: any) {
      logger.warn(`[Idling] Could not write report: ${err.message}`);
    }
  };

  const handle = setInterval(run, intervalMinutes * 60_000);
  handle.unref(); // don't block process exit
  logger.info(`[Idling] Self-improvement loop active (every ${intervalMinutes} min, model: ${MODEL}).`);
  return handle;
}

// ── Self-Repair Loop ──────────────────────────────────────────────────────

export interface SelfRepairResult {
  success:  boolean;
  report:   string;
  filePath: string;
  model:    string;
}

/**
 * attemptSelfRepair
 *
 * Autonomous error recovery pipeline:
 *  1. Reads the faulty source file (if accessible)
 *  2. Sends error context + source code to the local Ollama model
 *  3. Extracts the patched code from the LLM response
 *  4. Writes the patch to disk
 *  5. Runs `must-b doctor --fix` silently (spawnSync) to verify build + deps
 *  6a. SUCCESS → schedules a gateway restart via a detached child process
 *  6b. FAILURE → writes a "Kritik Hata" report to memory/logs/
 *
 * @param error      The observed error (message + optional stack)
 * @param filePath   Absolute path of the source file to repair
 * @param logger     Winston logger instance
 * @param root       Project root directory (process.cwd() at startup)
 */
export async function attemptSelfRepair(
  error:    { message: string; stack?: string },
  filePath: string,
  logger:   winston.Logger,
  root:     string,
): Promise<SelfRepairResult> {
  const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const MODEL        = process.env.OLLAMA_REPAIR_MODEL ?? process.env.OLLAMA_IDLE_MODEL ?? 'phi3:mini';
  const REPORT_DIR   = path.join(root, 'memory', 'logs');

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // ── 1. Read source file ─────────────────────────────────────────────────
  let sourceCode = '';
  try {
    sourceCode = fs.readFileSync(filePath, 'utf-8');
  } catch {
    logger.warn(`[SelfRepair] Cannot read ${filePath} — skipping LLM patch.`);
  }

  // ── 2. Ask Ollama for a patch ───────────────────────────────────────────
  logger.info(`[SelfRepair] Querying ${MODEL} for patch of ${path.basename(filePath)}…`);

  const prompt = [
    `You are an autonomous code repair agent for the Must-b AI platform.`,
    `A runtime error occurred in the following TypeScript/JavaScript file.`,
    ``,
    `Error message: ${error.message}`,
    error.stack ? `Stack trace:\n${error.stack.slice(0, 800)}` : '',
    ``,
    `Source file (${path.basename(filePath)}):`,
    `\`\`\`typescript`,
    sourceCode.slice(0, 3000),
    `\`\`\``,
    ``,
    `Task: Provide ONLY the corrected file content (no explanation, no markdown fences). ` +
    `Fix the error while preserving all existing functionality.`,
  ].filter(Boolean).join('\n');

  const patchedCode = await new Promise<string>((resolve) => {
    const body = Buffer.from(JSON.stringify({ model: MODEL, prompt, stream: false }));
    const url  = new URL('/api/generate', OLLAMA_BASE);
    const req  = http.request({
      hostname: url.hostname,
      port:     Number(url.port || 11434),
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': body.byteLength },
    }, (r) => {
      let raw = '';
      r.on('data', (c) => { raw += c; });
      r.on('end', () => {
        try { resolve(JSON.parse(raw).response ?? ''); } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(body);
    req.end();
  });

  if (!patchedCode.trim() || !sourceCode) {
    const report = buildCriticalReport(error, filePath, 'Ollama returned empty patch or source unreadable.');
    writeCriticalReport(REPORT_DIR, report);
    logger.error('[SelfRepair] ✗ No patch generated — Kritik Hata raporu hazırlandı.');
    return { success: false, report, filePath, model: MODEL };
  }

  // ── 3. Apply patch ──────────────────────────────────────────────────────
  const backupPath = filePath + '.repair-backup';
  try {
    fs.copyFileSync(filePath, backupPath);   // keep original as safety backup
    fs.writeFileSync(filePath, patchedCode, 'utf-8');
    logger.info(`[SelfRepair] Patch written to ${path.basename(filePath)} (backup → .repair-backup).`);
  } catch (writeErr: any) {
    const report = buildCriticalReport(error, filePath, `File write failed: ${writeErr.message}`);
    writeCriticalReport(REPORT_DIR, report);
    return { success: false, report, filePath, model: MODEL };
  }

  // ── 4. Run doctor --fix silently ────────────────────────────────────────
  logger.info('[SelfRepair] Running doctor --fix…');
  const doctorResult = spawnSync(
    process.execPath,
    [path.join(root, 'src', 'index.ts'), 'doctor', '--fix'],
    { cwd: root, stdio: 'pipe', timeout: 60_000, env: process.env },
  );

  const doctorOk = doctorResult.status === 0;

  if (!doctorOk) {
    // Restore backup on failure
    try { fs.copyFileSync(backupPath, filePath); } catch { /* best-effort */ }
    const stderr  = doctorResult.stderr?.toString().slice(0, 400) ?? '(no stderr)';
    const report  = buildCriticalReport(error, filePath, `doctor --fix exited ${doctorResult.status}: ${stderr}`);
    writeCriticalReport(REPORT_DIR, report);
    logger.error('[SelfRepair] ✗ doctor --fix failed — Kritik Hata raporu hazırlandı.');
    return { success: false, report, filePath, model: MODEL };
  }

  // ── 5a. Success — schedule gateway restart ──────────────────────────────
  logger.info('[SelfRepair] ✓ Patch verified. Scheduling safe restart…');

  // Write a restart flag; the watchdog / process manager picks it up.
  // On systems where Must-b is managed by systemd / pm2 / launchd this file
  // triggers a restart.  We also attempt SIGTERM so the supervisor restarts us.
  const flagPath = path.join(root, 'memory', '.restart-flag');
  try { fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8'); } catch { /* best-effort */ }

  // Allow current event-loop tick to drain before exiting
  setTimeout(() => {
    logger.info('[SelfRepair] Exiting for supervised restart.');
    process.exit(0);
  }, 1500);

  const report = `[SelfRepair] ✓ Onarım başarılı. Gateway yeniden başlatılıyor. (model: ${MODEL}, file: ${filePath})`;
  return { success: true, report, filePath, model: MODEL };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildCriticalReport(
  error:    { message: string; stack?: string },
  filePath: string,
  reason:   string,
): string {
  return [
    `# Kritik Hata: Manuel Müdahale Gerekli`,
    ``,
    `**Zaman:** \`${new Date().toISOString()}\``,
    `**Dosya:** \`${filePath}\``,
    `**Onarım Sonucu:** Başarısız`,
    ``,
    `## Hata`,
    `\`\`\``,
    error.message,
    `\`\`\``,
    ``,
    `## Neden Onarılamadı`,
    reason,
    ``,
    `## Stack`,
    `\`\`\``,
    error.stack ?? '(yok)',
    `\`\`\``,
    ``,
    `## Önerilen Adımlar`,
    `1. Yukarıdaki hatayı manuel olarak düzeltin.`,
    `2. \`must-b doctor --fix\` komutunu çalıştırın.`,
    `3. Gateway'i yeniden başlatın: \`must-b gateway\``,
  ].join('\n');
}

function writeCriticalReport(dir: string, content: string): void {
  try {
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(dir, `${ts}-kritik-hata.md`);
    fs.writeFileSync(dest, content, 'utf-8');
  } catch { /* best-effort */ }
}
