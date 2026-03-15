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
