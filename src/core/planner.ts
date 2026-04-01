import winston from 'winston';
import { LLMProvider, CompletionMessage } from './provider.js';
import { getSystemPrompt } from './identity.js';
import { loadSkillCatalog } from './skill-catalog.js';

export interface PlanStep {
  id: string;
  description: string;
  tool:
    | 'filesystem_read'
    | 'filesystem_write'
    | 'filesystem_list'
    | 'filesystem_search'
    | 'filesystem_copy'
    | 'filesystem_delete'
    | 'filesystem_mkdir'
    | 'terminal'
    | 'browser_navigate'
    | 'browser_screenshot'
    | 'browser_click'
    | 'browser_type'
    | 'browser_extract'
    | 'browser_snapshot'
    | 'browser_evaluate'
    | 'browser_url'
    | 'browser_close'
    | 'browser_perceive'
    | 'browser_scroll'
    | 'browser_wait'
    | 'memory_search'
    | 'memory_write'
    | 'web_search'
    | 'http_request'
    | 'log'
    | 'invoke_skill';
  parameters: Record<string, any>;
}

interface PlanResponse {
  steps: PlanStep[];
}

export class Planner {
  private logger: winston.Logger;
  private provider: LLMProvider;
  /** Rolling conversation buffer used by directChat — compacted on overflow. */
  private _chatHistory: CompletionMessage[] = [];

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.provider = new LLMProvider(logger);
  }

  /**
   * Context-window overflow recovery (called by Orchestrator on 'overflow' error).
   * Drops the oldest conversation turns while keeping the system prompt.
   * Must-b overflow-compaction strategy.
   */
  compactHistory(keepTurns = 4): void {
    const system  = this._chatHistory.filter(m => m.role === 'system');
    const conv    = this._chatHistory.filter(m => m.role !== 'system');
    const trimmed = conv.slice(-keepTurns);
    this._chatHistory = [...system, ...trimmed];
    this.logger.warn(
      `Planner: compactHistory — dropped ${conv.length - trimmed.length} turn(s), ` +
      `${this._chatHistory.length} remain.`,
    );
  }

  async plan(goal: string, memCtx = '', liteMode = false): Promise<PlanStep[]> {
    this.logger.info(`Planner: Generating plan for goal: "${goal}"`);

    const liteNote = liteMode
      ? '\n\nSYSTEM: Kaynak kısıtı aktif (Hafif Mod). Adım sayısını minimumda tut, gereksiz araç çağrılarından kaçın.'
      : '';
    const memBlock = memCtx ? `\n\n${memCtx}\n` : '';

    // Dynamic Skill Catalog — injected at plan-time
    const catalogSkills = loadSkillCatalog();
    const skillsBlock = catalogSkills.length > 0
      ? `\n\nDYNAMIC SKILLS — ${catalogSkills.length} Native Capabilities:\n26. invoke_skill   { skill: string, params?: object, goal?: string }\n` +
        `                                                                 – Invoke a specialized built-in skill by its ID. The executor routes this to the skill module autonomously.\n\n` +
        `Skill Catalog (use the "id" as the skill value):\n` +
        catalogSkills.map(s => `  • ${s.id.padEnd(24)} ${s.description}`).join('\n')
      : '';

    const systemPrompt = getSystemPrompt('agent') + liteNote + memBlock + `\n\nYou are the Planner for Must-b, an autonomous AI agent with full browser, filesystem, terminal, and memory capabilities.
Your job is to break down a high-level user Goal into a precise, executable sequence of steps.

Available Tools:

FILESYSTEM:
1.  filesystem_read    { path: string }                          – Read file content.
2.  filesystem_write   { path: string, content: string }         – Write text to a file.
3.  filesystem_list    { path: string }                          – List files in a directory.

TERMINAL:
4.  terminal           { command: string }                       – Execute a shell command (git, npm, node, ls, etc).

BROWSER (Playwright-powered):
5.  browser_navigate   { url: string, waitFor?: "load"|"domcontentloaded"|"networkidle" }
                                                                 – Navigate to a URL. Returns { url, title, status }.
6.  browser_screenshot { selector?: string, fullPage?: boolean } – Take a screenshot. Returns { base64, width, height }.
7.  browser_click      { selector: string, timeout?: number }    – Click an element by CSS selector.
8.  browser_type       { selector: string, text: string, clear?: boolean }
                                                                 – Type text into an input field.
9.  browser_extract    { selector: string }                      – Extract text/html from an element.
10. browser_snapshot   {}                                        – Get ARIA accessibility snapshot of the page (great for AI navigation).
11. browser_evaluate   { script: string }                        – Run JavaScript in the browser and return result.
12. browser_url        {}                                        – Get current URL and page title.
13. browser_close      {}                                        – Close the browser and free resources.

ACTION FORCE — El-Göz (Hand-Eye) tools:
14. browser_perceive   {}                                        – Combined ARIA snapshot + URL + title in one call. Best first step before interacting.
15. browser_scroll     { x?: number, y?: number, selector?: string }
                                                                 – Scroll the page or a specific element (pixels; negative = up/left).
16. browser_wait       { selector?: string, state?: "visible"|"hidden"|"attached"|"detached"|"networkidle", timeout?: number }
                                                                 – Wait until a selector appears or network is idle.

MEMORY (SQLite FTS5 + Temporal Decay):
14. memory_search      { query: string, limit?: number }         – Search past conversations and memory files.
15. memory_write       { content: string, summary?: string }     – Save an important note to long-term memory.

WEB SEARCH:
19. web_search         { query: string, maxResults?: number }    – DuckDuckGo search via Playwright. Returns { query, snippets }.

FILESYSTEM (extended):
20. filesystem_search  { pattern: string, cwd?: string, maxResults?: number }           – Search for files by name pattern.
21. filesystem_copy    { src: string, dest: string }                                     – Copy a file.
22. filesystem_delete  { path: string }                                                  – Delete a file or directory.
23. filesystem_mkdir   { path: string }                                                  – Create a directory recursively.

HTTP:
24. http_request       { url: string, method?: "GET"|"POST"|"PUT"|"PATCH"|"DELETE", headers?: object, body?: object }
                                                                                         – HTTP request to any URL (GitHub API, REST, webhooks).

UTILITY:
25. log                { message: string }                       – Log a message or observation.
${skillsBlock}

CONTEXT ALIGNMENT — Dynamic Skill Priority:
- If the user's request matches one of the Dynamic Skills listed above (e.g., Spotify control, Docker management, GitHub operations, code analysis, data pipelines), prefer invoke_skill with the matching skill ID over basic terminal/browser tools.
- invoke_skill autonomously routes the request to the correct skill module — no manual plugin wiring needed.
- For skills requiring setup (config/bins listed in catalog), still use invoke_skill — the skill handles its own requirements or returns a helpful error.

Rules:
- Return ONLY a valid JSON object with no markdown, no backticks, no explanation.
- The JSON must have a single key "steps" which is an array of step objects.
- Each step must have: "id" (unique string), "description" (what this step does), "tool" (exact name), "parameters" (object).
- For browser tasks: always start with browser_navigate, then use browser_perceive to see the full page context before interacting. browser_perceive returns snapshot+url+title in one shot — prefer it over browser_snapshot when you also need the URL.
- After browser_navigate, browser_click, and browser_type the executor automatically appends perception data (snapshot+url+title) to the result — you can read it without an extra step.
- Use browser_wait before clicking elements that may load asynchronously.
- Use browser_scroll to reveal off-screen content before trying to extract or click.
- For memory-intensive tasks: start with memory_search to check what was done before.
- Be precise with CSS selectors. Prefer IDs and aria-labels over class names.
- Close the browser with browser_close when the browsing task is complete.

Example Output:
{
  "steps": [
    { "id": "1", "description": "Navigate to target page", "tool": "browser_navigate", "parameters": { "url": "https://example.com" } },
    { "id": "2", "description": "Get page structure", "tool": "browser_snapshot", "parameters": {} },
    { "id": "3", "description": "Extract main content", "tool": "browser_extract", "parameters": { "selector": "main" } },
    { "id": "4", "description": "Save result to memory", "tool": "memory_write", "parameters": { "content": "Visited example.com", "summary": "page content extracted" } },
    { "id": "5", "description": "Close browser", "tool": "browser_close", "parameters": {} }
  ]
}`;

    const messages: CompletionMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Goal: ${goal}` },
    ];

    try {
      const planResponse = await this.provider.generateJson<PlanResponse>(messages);

      if (!planResponse.steps || !Array.isArray(planResponse.steps)) {
        throw new Error('Planner: Generated JSON is missing the "steps" array.');
      }

      this.logger.info(`Planner: Generated ${planResponse.steps.length} steps.`);
      return planResponse.steps;
    } catch (error: any) {
      this.logger.error(`Planner: Failed to generate plan — ${error.message}`);
      return [
        {
          id: 'fallback-error',
          description: 'Report planning failure',
          tool: 'log',
          parameters: {
            message: `Planning failed for goal: ${goal}. Error: ${error.message}`,
          },
        },
      ];
    }
  }

  /**
   * Fast-path: answer a conversational prompt directly without planning or tool use.
   * Used by the Orchestrator's direct-chat router for simple queries.
   */
  async directChat(goal: string, memCtx = '', liteMode = false): Promise<string> {
    this.logger.info(`Planner: directChat — "${goal.slice(0, 80)}"`);
    const liteNote = liteMode
      ? '\n\nSYSTEM: Kaynak kısıtı aktif (Hafif Mod). Yanıtları kısa ve öz tut.'
      : '';
    const sysContent = `${getSystemPrompt('direct')}${liteNote}${memCtx ? '\n\n' + memCtx : ''}`;
    const messages: CompletionMessage[] = [
      { role: 'system', content: sysContent },
      { role: 'user', content: goal },
    ];
    try {
      const answer = await this.provider.chat(messages, { jsonMode: false });
      return answer.trim();
    } catch (err: any) {
      this.logger.warn(`Planner: directChat failed — ${err.message}`);
      throw err;
    }
  }

  /**
   * After all steps complete, synthesize a final human-readable answer
   * from the collected step results using the LLM.
   */
  async synthesize(goal: string, stepResults: Array<{ description: string; result: any }>): Promise<string> {
    const resultSummary = stepResults
      .map((s, i) => `Step ${i + 1} (${s.description}): ${JSON.stringify(s.result).slice(0, 500)}`)
      .join('\n');

    const messages: CompletionMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt('synthesize'),
      },
      {
        role: 'user',
        content: `Goal: "${goal}"\n\nExecution results:\n${resultSummary}\n\nProvide a clear final answer:`,
      },
    ];

    try {
      const answer = await this.provider.chat(messages, { jsonMode: false });
      return answer.trim();
    } catch (err: any) {
      this.logger.warn(`Planner: Synthesis failed — ${err.message}`);
      return `Goal completed. ${stepResults.length} step(s) executed successfully.`;
    }
  }
}
