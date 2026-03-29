/**
 * Ollama Auto-Discovery (v1.0) — Must-b Native
 *
 * Silent auto-detection of locally running Ollama instances at startup.
 * Fetches available models, enriches them with context-window info,
 * and heuristically marks reasoning models.
 *
 * Behaviour:
 *   - Silent failure if Ollama is unreachable AND not explicitly configured.
 *   - console.warn if Ollama is explicitly configured (OLLAMA_BASE_URL) but
 *     the daemon is not reachable.
 *   - Auto-detects reasoning models via /r1|reasoning|think|reason/i heuristic.
 *   - Concurrently fetches context-window sizes via /api/show (batch of 8).
 */

export const OLLAMA_DEFAULT_BASE_URL  = 'http://127.0.0.1:11434';
export const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128_000;
export const OLLAMA_DEFAULT_MAX_TOKENS     = 8_192;

// ── Types ────────────────────────────────────────────────────────────────────

export interface OllamaTagModel {
  name:        string;
  modified_at?: string;
  size?:        number;
  digest?:      string;
  details?: {
    family?:         string;
    parameter_size?: string;
  };
}

export interface OllamaModelWithContext extends OllamaTagModel {
  contextWindow?: number;
  isReasoning?:   boolean;
}

export interface OllamaDiscoveryResult {
  reachable: boolean;
  baseUrl:   string;
  models:    OllamaModelWithContext[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip the `/v1` OpenAI-compat suffix from a configured base URL so we can
 * call the native Ollama API (`/api/tags`, `/api/show`).
 *
 * Examples:
 *   'http://192.168.1.1:11434/v1' → 'http://192.168.1.1:11434'
 *   'http://localhost:11434'      → 'http://localhost:11434'
 */
export function resolveOllamaApiBase(configuredBaseUrl?: string): string {
  if (!configuredBaseUrl) return OLLAMA_DEFAULT_BASE_URL;
  const trimmed = configuredBaseUrl.replace(/\/+$/, '');
  return trimmed.replace(/\/v1$/i, '');
}

/**
 * Heuristic: treat models whose ID contains "r1", "reasoning", "think", or
 * "reason" as reasoning models (extended chain-of-thought output).
 * Must-b reasoning model heuristic.
 */
export function isReasoningModelHeuristic(modelId: string): boolean {
  return /r1|reasoning|think|reason/i.test(modelId);
}

// ── Core fetch functions ─────────────────────────────────────────────────────

/**
 * Query the actual context-window size for a single model via `/api/show`.
 * Returns `undefined` on any error (timeout, model not found, malformed response).
 */
export async function queryOllamaContextWindow(
  apiBase:   string,
  modelName: string,
): Promise<number | undefined> {
  try {
    const res = await fetch(`${apiBase}/api/show`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: modelName }),
      signal:  AbortSignal.timeout(3_000),
    });
    if (!res.ok) return undefined;

    const data = (await res.json()) as { model_info?: Record<string, unknown> };
    if (!data.model_info) return undefined;

    for (const [key, value] of Object.entries(data.model_info)) {
      if (
        key.endsWith('.context_length') &&
        typeof value === 'number' &&
        Number.isFinite(value)
      ) {
        const ctx = Math.floor(value);
        if (ctx > 0) return ctx;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch the full model list from `/api/tags`.
 * Returns `{ reachable: false, models: [] }` on connection failure.
 */
export async function fetchOllamaModels(
  baseUrl: string,
): Promise<{ reachable: boolean; models: OllamaTagModel[] }> {
  try {
    const apiBase = resolveOllamaApiBase(baseUrl);
    const res = await fetch(`${apiBase}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { reachable: true, models: [] };

    const data   = (await res.json()) as { models?: OllamaTagModel[] };
    const models = (data.models ?? []).filter(m => Boolean(m.name));
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

const CONTEXT_FETCH_CONCURRENCY = 8;

/**
 * Enrich a list of Ollama models with context-window sizes.
 * Requests are batched (up to 8 concurrent) to avoid hammering the daemon.
 */
export async function enrichOllamaModelsWithContext(
  apiBase: string,
  models:  OllamaTagModel[],
): Promise<OllamaModelWithContext[]> {
  const enriched: OllamaModelWithContext[] = [];

  for (let i = 0; i < models.length; i += CONTEXT_FETCH_CONCURRENCY) {
    const batch = models.slice(i, i + CONTEXT_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (model) => ({
        ...model,
        contextWindow: await queryOllamaContextWindow(apiBase, model.name),
        isReasoning:   isReasoningModelHeuristic(model.name),
      })),
    );
    enriched.push(...results);
  }

  return enriched;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Silently auto-discover a locally running Ollama instance.
 *
 * Reads `OLLAMA_BASE_URL` from env (defaults to `http://127.0.0.1:11434`).
 * On success returns the enriched model list.
 * On failure:
 *   - Silent return if Ollama was not explicitly configured.
 *   - console.warn if OLLAMA_BASE_URL was set but the daemon is unreachable.
 *
 * @param explicitlyConfigured  Pass `true` when `OLLAMA_BASE_URL` is set in .env
 */
export async function autoDiscoverOllama(
  explicitlyConfigured = false,
): Promise<OllamaDiscoveryResult> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? OLLAMA_DEFAULT_BASE_URL;
  const apiBase = resolveOllamaApiBase(baseUrl);

  const { reachable, models } = await fetchOllamaModels(baseUrl);

  if (!reachable) {
    if (explicitlyConfigured) {
      // Warn only when the user explicitly pointed to an Ollama instance
      console.warn(
        `[Ollama] Auto-discovery: daemon unreachable at ${baseUrl}. ` +
        `Is 'ollama serve' running?`,
      );
    }
    return { reachable: false, baseUrl, models: [] };
  }

  if (models.length === 0) {
    return { reachable: true, baseUrl, models: [] };
  }

  const enriched = await enrichOllamaModelsWithContext(apiBase, models);
  return { reachable: true, baseUrl, models: enriched };
}

// ── Lightweight model descriptor (for provider integration) ──────────────────

export interface OllamaModelDefinition {
  id:            string;
  name:          string;
  contextWindow: number;
  maxTokens:     number;
  isReasoning:   boolean;
  parameterSize?: string;
  sizeBytes?:     number;
}

/**
 * Build a normalised model descriptor from a discovered Ollama model.
 * Falls back to `OLLAMA_DEFAULT_CONTEXT_WINDOW` when `/api/show` returned no data.
 */
export function buildOllamaModelDefinition(
  model: OllamaModelWithContext,
): OllamaModelDefinition {
  return {
    id:            model.name,
    name:          model.name,
    contextWindow: model.contextWindow ?? OLLAMA_DEFAULT_CONTEXT_WINDOW,
    maxTokens:     OLLAMA_DEFAULT_MAX_TOKENS,
    isReasoning:   model.isReasoning ?? isReasoningModelHeuristic(model.name),
    parameterSize: model.details?.parameter_size,
    sizeBytes:     model.size,
  };
}
