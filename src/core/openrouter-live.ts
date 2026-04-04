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
  architecture?:  { modality?: string; input_modalities?: string[] };
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

/**
 * Pick the best available free fallback model from the live catalog.
 * Used by the 402 failover logic in provider.ts.
 * Falls back to the hardcoded constant if the catalog fetch fails.
 */
export async function pickFreeFallbackModel(apiKey: string): Promise<string> {
  const HARDCODED_FREE = process.env.OPENROUTER_FREE_MODEL
    ?? 'google/gemini-2.5-pro-exp-03-25:free';
  try {
    const catalog = await fetchOpenRouterModels(apiKey);
    if (catalog.free.length > 0) return catalog.free[0].id;
  } catch { /* network unavailable during failover — use hardcoded */ }
  return HARDCODED_FREE;
}
