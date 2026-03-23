/**
 * Must-b LLM Provider (v2.0) — Multi-Provider Router
 *
 * Routes to the correct API based on LLM_PROVIDER env var.
 * Supported: OpenRouter, OpenAI, Anthropic, Google Gemini, Groq,
 *            Ollama, Mistral, xAI, DeepSeek, Azure OpenAI, Vertex AI,
 *            Together AI, Moonshot (Kimi)
 *
 * v1.4.7 additions:
 *   - LLM_MODEL is a universal override checked first across all providers
 *   - Ollama 404 → auto-selects first installed model via `ollama list`,
 *     writes OLLAMA_MODEL + LLM_MODEL to .env, then retries seamlessly;
 *     returns a graceful system string if no models are installed at all
 */
import fs            from 'fs';
import path          from 'path';
import { spawnSync } from 'child_process';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config({ override: true });

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PC {
  baseUrl: string;
  apiKey:  string;
  model:   string;
  headers: Record<string, string>;
  noJM?:   boolean;
}

/** Universal active-model override — checked first across all providers. */
function universalModel(providerDefault: string): string {
  return process.env.LLM_MODEL || providerDefault;
}

function rc(): PC {
  dotenv.config({ override: true });
  const p = (process.env.LLM_PROVIDER ?? 'openrouter').toLowerCase();
  if (p === 'openai') {
    const k = process.env.OPENAI_API_KEY ?? '';
    return { baseUrl: 'https://api.openai.com/v1', apiKey: k,
      model: universalModel(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'anthropic') {
    const k = process.env.ANTHROPIC_API_KEY ?? '';
    return { baseUrl: 'https://api.anthropic.com/v1', apiKey: k,
      model: universalModel(process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022'),
      headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      noJM: true };
  }
  if (p === 'gemini') {
    const k = process.env.GOOGLE_API_KEY ?? '';
    const m = universalModel(process.env.GEMINI_MODEL ?? 'gemini-1.5-flash');
    return { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + k,
      apiKey: k, model: m, headers: { 'Content-Type': 'application/json' }, noJM: true };
  }
  if (p === 'groq') {
    const k = process.env.GROQ_API_KEY ?? '';
    return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: k,
      model: universalModel(process.env.GROQ_MODEL ?? 'llama3-8b-8192'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'ollama') {
    const b = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    return { baseUrl: b + '/v1', apiKey: 'ollama',
      model: universalModel(process.env.OLLAMA_MODEL ?? 'llama3'),
      headers: { 'Content-Type': 'application/json' }, noJM: true };
  }
  if (p === 'mistral') {
    const k = process.env.MISTRAL_API_KEY ?? '';
    return { baseUrl: 'https://api.mistral.ai/v1', apiKey: k,
      model: universalModel(process.env.MISTRAL_MODEL ?? 'mistral-small-latest'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'xai') {
    const k = process.env.XAI_API_KEY ?? '';
    return { baseUrl: 'https://api.x.ai/v1', apiKey: k,
      model: universalModel(process.env.XAI_MODEL ?? 'grok-beta'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'deepseek') {
    const k = process.env.DEEPSEEK_API_KEY ?? '';
    return { baseUrl: 'https://api.deepseek.com/v1', apiKey: k,
      model: universalModel(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'together') {
    const k = process.env.TOGETHER_API_KEY ?? '';
    return { baseUrl: 'https://api.together.xyz/v1', apiKey: k,
      model: universalModel(process.env.TOGETHER_MODEL ?? 'meta-llama/Llama-3-8b-chat-hf'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'moonshot') {
    const k = process.env.MOONSHOT_API_KEY ?? '';
    return { baseUrl: 'https://api.moonshot.cn/v1', apiKey: k,
      model: universalModel(process.env.MOONSHOT_MODEL ?? 'moonshot-v1-8k'),
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'azure') {
    const k   = process.env.AZURE_OPENAI_API_KEY ?? '';
    const ep  = process.env.AZURE_OPENAI_ENDPOINT ?? '';
    const dep = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini';
    const ver = process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01';
    return { baseUrl: ep + '/openai/deployments/' + dep + '/chat/completions?api-version=' + ver,
      apiKey: k, model: dep, headers: { 'api-key': k, 'Content-Type': 'application/json' } };
  }
  if (p === 'vertex') {
    const proj = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    const loc  = process.env.VERTEX_LOCATION ?? 'us-central1';
    const m    = universalModel(process.env.VERTEX_MODEL ?? 'gemini-1.5-flash-001');
    let t = '';
    try {
      t = (require('child_process') as typeof import('child_process'))
        .execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
    } catch { /**/ }
    return { baseUrl: 'https://' + loc + '-aiplatform.googleapis.com/v1/projects/' + proj +
        '/locations/' + loc + '/publishers/google/models/' + m + ':generateContent',
      apiKey: t, model: m, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, noJM: true };
  }
  // Default: OpenRouter
  const k = process.env.OPENROUTER_API_KEY ?? '';
  return { baseUrl: 'https://openrouter.ai/api/v1', apiKey: k,
    model: universalModel(process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'),
    headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://must-b.ai', 'X-Title': 'Must-b Agent' } };
}

// ── Ollama 404 fallback ──────────────────────────────────────────────────────

/** Attempt to update OLLAMA_MODEL and LLM_MODEL in .env and process.env. */
function persistOllamaModel(model: string): void {
  process.env.OLLAMA_MODEL = model;
  process.env.LLM_MODEL    = model;
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf-8'); } catch { /**/ }
    const setKey = (src: string, key: string, val: string) => {
      const lines = src.split('\n');
      const idx = lines.findIndex(l => l.startsWith(key + '='));
      if (idx >= 0) lines[idx] = `${key}=${val}`; else lines.push(`${key}=${val}`);
      return lines.filter(l => l !== '').join('\n') + '\n';
    };
    content = setKey(content, 'OLLAMA_MODEL', model);
    content = setKey(content, 'LLM_MODEL',    model);
    fs.writeFileSync(envPath, content, 'utf-8');
  } catch { /**/ }
}

/**
 * Called when Ollama returns 404 (model not found).
 * Runs `ollama list`, picks the first installed model, retries once.
 * Returns a graceful system string if no models are installed at all.
 */
async function handleOllamaFallback(
  cfg: PC,
  messages: CompletionMessage[],
  options: { jsonMode?: boolean },
  logger: winston.Logger,
): Promise<string> {
  const NO_MODELS = '[System Error: No Ollama models installed. Please pull a model via `ollama pull <name>` or the Must-b UI.]';

  // Run `ollama list` — try PATH first, then absolute Windows path
  let listOut = '';
  const tryList = (cmd: string, shell: boolean) => {
    const r = spawnSync(cmd, ['list'], { encoding: 'utf8', timeout: 6000, shell });
    return r.status === 0 ? r.stdout ?? '' : '';
  };
  listOut = tryList('ollama', true);
  if (!listOut) {
    const abs = path.join(
      process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? '', 'AppData', 'Local'),
      'Programs', 'Ollama', 'ollama.exe',
    );
    if (fs.existsSync(abs)) listOut = tryList(abs, false);
  }

  // Parse: skip header line, take first column of each data line
  const models = listOut
    .split('\n')
    .slice(1)
    .map(l => l.trim().split(/\s+/)[0])
    .filter(Boolean);

  if (models.length === 0) {
    logger.warn('Ollama fallback: no installed models found.');
    return NO_MODELS;
  }

  const chosen = models[0];
  logger.info(`Ollama fallback: auto-switching to "${chosen}"`);
  persistOllamaModel(chosen);

  // Retry the original request with the new model
  const b: any = { model: chosen, messages, temperature: 0.1 };
  if (options.jsonMode && cfg.noJM !== true) b.response_format = { type: 'json_object' };
  try {
    const res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST', headers: cfg.headers, body: JSON.stringify(b),
    });
    if (!res.ok) return NO_MODELS;
    const content = ((await res.json()) as any).choices?.[0]?.message?.content;
    return content || NO_MODELS;
  } catch {
    return NO_MODELS;
  }
}

async function aAnthropic(c: PC, msgs: CompletionMessage[]): Promise<string> {
  const sys  = msgs.find(m => m.role === 'system')?.content ?? '';
  const conv = msgs.filter(m => m.role !== 'system');
  const res  = await fetch(c.baseUrl + '/messages', { method: 'POST', headers: c.headers,
    body: JSON.stringify({ model: c.model, max_tokens: 4096, system: sys, messages: conv, temperature: 0.1 }) });
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + await res.text());
  return ((await res.json()) as any).content?.[0]?.text ?? '';
}

async function aGemini(c: PC, msgs: CompletionMessage[]): Promise<string> {
  const contents = msgs.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const sp = msgs.find(m => m.role === 'system')?.content;
  const body: any = { contents, generationConfig: { temperature: 0.1 } };
  if (sp) body.systemInstruction = { parts: [{ text: sp }] };
  const res = await fetch(c.baseUrl, { method: 'POST', headers: c.headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Gemini ' + res.status + ': ' + await res.text());
  return ((await res.json()) as any).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export class LLMProvider {
  private logger: winston.Logger;
  constructor(logger: winston.Logger) { this.logger = logger; }

  async generateJson<T>(messages: CompletionMessage[]): Promise<T> {
    const response = await this.chat(messages, { jsonMode: true });
    try {
      const clean = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(clean) as T;
    } catch (e: any) {
      this.logger.error('Provider: Failed to parse JSON response: ' + e.message);
      throw new Error('LLM failed to produce valid JSON');
    }
  }

  async chat(messages: CompletionMessage[], options: { jsonMode?: boolean } = {}): Promise<string> {
    const cfg = rc();
    const p   = (process.env.LLM_PROVIDER ?? 'openrouter').toLowerCase();
    if (!cfg.apiKey && p !== 'ollama') this.logger.warn('Provider [' + p + ']: API key not set.');
    this.logger.info('Provider [' + p + ']: ' + cfg.model);
    try {
      if (p === 'anthropic') return await aAnthropic(cfg, messages);
      if (p === 'gemini' || p === 'vertex') return await aGemini(cfg, messages);
      if (p === 'azure') {
        const b: any = { messages, temperature: 0.1 };
        if (options.jsonMode) b.response_format = { type: 'json_object' };
        const res = await fetch(cfg.baseUrl, { method: 'POST', headers: cfg.headers, body: JSON.stringify(b) });
        if (!res.ok) throw new Error('Azure ' + res.status + ': ' + await res.text());
        return ((await res.json()) as any).choices?.[0]?.message?.content ?? '';
      }
      // OpenAI-compatible: openrouter, openai, groq, mistral, xai, deepseek, ollama, together, moonshot
      const b: any = { model: cfg.model, messages, temperature: 0.1 };
      if (options.jsonMode && !cfg.noJM) b.response_format = { type: 'json_object' };
      const res = await fetch(cfg.baseUrl + '/chat/completions', {
        method: 'POST', headers: cfg.headers, body: JSON.stringify(b),
      });
      // Ollama 404: model not found — auto-recover from installed models
      if (!res.ok && p === 'ollama' && res.status === 404) {
        return await handleOllamaFallback(cfg, messages, options, this.logger);
      }
      if (!res.ok) throw new Error(p + ' API ' + res.status + ': ' + await res.text());
      const content = ((await res.json()) as any).choices?.[0]?.message?.content;
      if (!content) throw new Error('Provider: Empty response from LLM.');
      return content;
    } catch (e: any) {
      this.logger.error('Provider [' + p + ']: ' + e.message);
      throw e;
    }
  }
}
