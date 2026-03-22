/**
 * Must-b LLM Provider (v2.0) — Multi-Provider Router
 *
 * Routes to the correct API based on LLM_PROVIDER env var.
 * Supported: OpenRouter, OpenAI, Anthropic, Google Gemini, Groq,
 *            Ollama, Mistral, xAI, DeepSeek, Azure OpenAI, Vertex AI
 */
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

function rc(): PC {
  dotenv.config({ override: true });
  const p = (process.env.LLM_PROVIDER ?? 'openrouter').toLowerCase();
  if (p === 'openai') {
    const k = process.env.OPENAI_API_KEY ?? '';
    return { baseUrl: 'https://api.openai.com/v1', apiKey: k,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'anthropic') {
    const k = process.env.ANTHROPIC_API_KEY ?? '';
    return { baseUrl: 'https://api.anthropic.com/v1', apiKey: k,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022',
      headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      noJM: true };
  }
  if (p === 'gemini') {
    const k = process.env.GOOGLE_API_KEY ?? '';
    const m = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    return { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + k,
      apiKey: k, model: m, headers: { 'Content-Type': 'application/json' }, noJM: true };
  }
  if (p === 'groq') {
    const k = process.env.GROQ_API_KEY ?? '';
    return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: k,
      model: process.env.GROQ_MODEL ?? 'llama3-8b-8192',
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'ollama') {
    const b = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    return { baseUrl: b + '/v1', apiKey: 'ollama',
      model: process.env.OLLAMA_MODEL ?? 'llama3',
      headers: { 'Content-Type': 'application/json' }, noJM: true };
  }
  if (p === 'mistral') {
    const k = process.env.MISTRAL_API_KEY ?? '';
    return { baseUrl: 'https://api.mistral.ai/v1', apiKey: k,
      model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'xai') {
    const k = process.env.XAI_API_KEY ?? '';
    return { baseUrl: 'https://api.x.ai/v1', apiKey: k,
      model: process.env.XAI_MODEL ?? 'grok-beta',
      headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } };
  }
  if (p === 'deepseek') {
    const k = process.env.DEEPSEEK_API_KEY ?? '';
    return { baseUrl: 'https://api.deepseek.com/v1', apiKey: k,
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
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
    const m    = process.env.VERTEX_MODEL ?? 'gemini-1.5-flash-001';
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
    model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
    headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://must-b.ai', 'X-Title': 'Must-b Agent' } };
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
      // OpenAI-compatible: openrouter, openai, groq, mistral, xai, deepseek, ollama
      const b: any = { model: cfg.model, messages, temperature: 0.1 };
      if (options.jsonMode && !cfg.noJM) b.response_format = { type: 'json_object' };
      const res = await fetch(cfg.baseUrl + '/chat/completions', {
        method: 'POST', headers: cfg.headers, body: JSON.stringify(b),
      });
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
