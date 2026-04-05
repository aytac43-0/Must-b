/**
 * OpenRouter Live Model Catalog (v1.0)
 *
 * Fetches the full live model list from OpenRouter API and categorises
 * models into three tiers matching the 3-Tier Router (ADR-026):
 *
 *   Free      — $0 / 1M tokens (or :free suffix)
 *   Balanced  — ≤ $3 / 1M tokens  (cheap paid models)
 *   Power     — > $3 / 1M tokens  (frontier: GPT-4o, Claude 3 Opus, etc.)
 *
 * Results are cached in memory for CACHE_TTL_MS to avoid spamming
 * the OpenRouter API on every settings page open.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpenRouterTier = 'free' | 'balanced' | 'power';

export interface LiveModel {
  id:          string;
  name:        string;
  tier:        OpenRouterTier;
  contextK:    number;   // context length in thousands (rounded)
  costPer1M:   number;   // USD per 1M prompt tokens
  description: string;
  hasVision:   boolean;
}

export interface OpenRouterCatalog {
  free:     LiveModel[];
  balanced: LiveModel[];
  power:    LiveModel[];
  fetchedAt: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
let _cache: OpenRouterCatalog | null = null;

export function clearOpenRouterCache(): void { _cache = null; }

// ── Core fetch ────────────────────────────────────────────────────────────────

interface RawModel {
  id:             string;
  name:           string;
  description?:   string;
  context_length?: number;
  pricing?:       { prompt?: string; completion?: string };
  architecture?:  { modality?: string; input_modalities?: string[]; output_modalities?: string[] };
}

// ── Chat-capability guard ─────────────────────────────────────────────────────
// Models whose output modality is not text (music, image-gen, video, TTS, etc.)
// must never be used as a chat fallback.
const NON_CHAT_ID_PATTERNS = /lyria|imagen-3|gen-3|kling|runway|stable-diffusion|sdxl|dall-e|tts|whisper|suno|udio|musicgen|bark|elevenlabs|speech/i;

function isChatCapable(m: RawModel): boolean {
  // Output modality must produce text. Reject anything that generates audio/image/video.
  const outModality = (m.architecture?.modality ?? '').toLowerCase();
  if (outModality && !outModality.includes('->text') && outModality.includes('->')) return false;
  // Reject by ID/name keyword (catches models not tagged with modality)
  if (NON_CHAT_ID_PATTERNS.test(m.id)) return false;
  if (NON_CHAT_ID_PATTERNS.test(m.name ?? '')) return false;
  return true;
}

/**
 * Fetch and categorise all current OpenRouter models.
 * Returns the cached result if it is less than CACHE_TTL_MS old.
 *
 * @param apiKey  OpenRouter API key — needed for the auth header.
 *                Pass empty string to make an unauthenticated request
 *                (works for the public model list, may return fewer entries).
 */
export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterCatalog> {
  // Return cache if still fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache;

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'HTTP-Referer':  'https://must-b.com',
    'X-Title':       'Must-b Agent',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
  if (!res.ok) {
    throw new Error(`OpenRouter /models fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  const json  = await res.json() as { data: RawModel[] };
  const raw   = json.data ?? [];

  const catalog: OpenRouterCatalog = {
    free:      [],
    balanced:  [],
    power:     [],
    fetchedAt: Date.now(),
  };

  for (const m of raw) {
    if (!m.id || !m.name) continue;
    if (!isChatCapable(m)) continue; // skip music / image-gen / TTS / video models

    const promptCostStr = m.pricing?.prompt ?? '0';
    const promptCost    = parseFloat(promptCostStr);
    const costPer1M     = isNaN(promptCost) ? 0 : promptCost * 1_000_000;

    const contextK = Math.round((m.context_length ?? 0) / 1_000);

    const modalities = m.architecture?.input_modalities ?? [];
    const hasVision  =
      modalities.includes('image') ||
      (m.architecture?.modality ?? '').includes('image') ||
      m.name.toLowerCase().includes('vision');

    const entry: LiveModel = {
      id:          m.id,
      name:        m.name,
      tier:        'free',
      contextK,
      costPer1M,
      description: m.description?.slice(0, 120) ?? '',
      hasVision,
    };

    // Tier classification
    if (costPer1M === 0 || m.id.endsWith(':free')) {
      entry.tier = 'free';
      catalog.free.push(entry);
    } else if (costPer1M <= 3) {
      entry.tier = 'balanced';
      catalog.balanced.push(entry);
    } else {
      entry.tier = 'power';
      catalog.power.push(entry);
    }
  }

  // Sort each tier: free by context (largest first), paid by cost (cheapest first)
  catalog.free.sort((a, b) => b.contextK - a.contextK);
  catalog.balanced.sort((a, b) => a.costPer1M - b.costPer1M);
  catalog.power.sort((a, b) => a.costPer1M - b.costPer1M);

  _cache = catalog;
  return catalog;
}

/** Guaranteed safe fallback — never changes without a deliberate release. */
export const CHAT_FREE_DEFAULT = 'google/gemini-2.5-pro-exp-03-25:free';

/**
 * Pick the best available free chat-capable fallback model from the live catalog.
 *
 * Filters: only text-output (chat/instruct/thinking) models are considered.
 * Music (Lyria), image-gen (Imagen), TTS, video, etc. are always excluded.
 *
 * If the catalog fetch fails OR yields no valid chat model,
 * returns CHAT_FREE_DEFAULT unconditionally.
 */
export async function pickFreeFallbackModel(apiKey: string): Promise<string> {
  // Explicit env override wins — but still validate it looks like a chat model
  const envOverride = (process.env.OPENROUTER_FREE_MODEL ?? '').trim();
  if (envOverride && !NON_CHAT_ID_PATTERNS.test(envOverride)) return envOverride;

  try {
    const catalog = await fetchOpenRouterModels(apiKey);
    // catalog.free is already filtered to chat-capable models by fetchOpenRouterModels
    const candidate = catalog.free.find(m =>
      // Prefer models with "instruct", "chat", "it", "think" in ID — extra safety net
      /instruct|chat|\-it\b|thinking|gemini|claude|llama|mistral|qwen|deepseek/i.test(m.id)
    ) ?? catalog.free[0];
    if (candidate?.id) return candidate.id;
  } catch { /* network unavailable during failover */ }

  return CHAT_FREE_DEFAULT;
}
