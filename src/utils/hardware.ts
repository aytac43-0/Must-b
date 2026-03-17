/**
 * Must-b Hardware Utilities
 *
 * Provides hardware-aware model recommendations and performance predictions.
 * Uses the hardware score from identity.ts to classify which models
 * will run smoothly, may struggle, or require cloud fallback.
 */

import os from 'os';
import {
  MODELS_LIST,
  LOCAL_MODELS_LIST,
  CLOUD_MODELS_LIST,
  type ModelEntry,
  type ModelFitLabel,
} from '../core/models-catalog.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ModelRecommendation {
  model: ModelEntry;
  fit: ModelFitLabel;
}

export interface RecommendationResult {
  /** Models that run comfortably on this hardware */
  recommended: ModelRecommendation[];
  /** Models that may work but could be slow */
  marginal: ModelRecommendation[];
  /** Models beyond hardware capability — cloud is a better choice */
  cloudOnly: ModelRecommendation[];
  /** All cloud models (always available if API key present) */
  cloud: ModelRecommendation[];
  /** Flat list of all models with their fit labels */
  all: ModelRecommendation[];
}

// ── Core Logic ────────────────────────────────────────────────────────────

/**
 * Classify a single local model against the current hardware score.
 *
 * Score thresholds relative to model.minScore:
 *   score ≥ minScore          → 'Sorunsuz çalışır'
 *   score ≥ minScore - 4      → 'Zorlanabilir'
 *   score < minScore - 4      → 'Bulut Önerilir'
 */
function classifyModel(model: ModelEntry, score: number): ModelFitLabel {
  if (model.category === 'cloud') return 'Sorunsuz çalışır'; // cloud always available
  if (score >= model.minScore) return 'Sorunsuz çalışır';
  if (score >= model.minScore - 4) return 'Zorlanabilir';
  return 'Bulut Önerilir';
}

/**
 * Return hardware-aware model recommendations for the given score.
 *
 * @param score  Hardware score from getHardwareScore() in identity.ts
 */
export function recommendModels(score: number): RecommendationResult {
  const allRecs: ModelRecommendation[] = MODELS_LIST.map(model => ({
    model,
    fit: classifyModel(model, score),
  }));

  const localRecs = allRecs.filter(r => r.model.category === 'local');
  const cloudRecs = allRecs.filter(r => r.model.category === 'cloud');

  return {
    recommended: localRecs.filter(r => r.fit === 'Sorunsuz çalışır'),
    marginal:    localRecs.filter(r => r.fit === 'Zorlanabilir'),
    cloudOnly:   localRecs.filter(r => r.fit === 'Bulut Önerilir'),
    cloud:       cloudRecs,
    all:         allRecs,
  };
}

/**
 * Return the single best local model for the given score.
 * Prefers 'recommended' tag, then highest minScore within capability.
 * Falls back to null if no local model fits.
 */
export function bestLocalModel(score: number): ModelEntry | null {
  const recs = recommendModels(score);
  const candidates = recs.recommended;
  if (candidates.length === 0) {
    // Fall back to marginal if nothing is comfortable
    const marginal = recs.marginal;
    if (marginal.length === 0) return null;
    return marginal.sort((a, b) => b.model.minScore - a.model.minScore)[0].model;
  }
  // Prefer "recommended" tagged models first, then pick highest minScore
  const tagged = candidates.filter(r => r.model.tags.includes('recommended'));
  const pool   = tagged.length > 0 ? tagged : candidates;
  return pool.sort((a, b) => b.model.minScore - a.model.minScore)[0].model;
}

/**
 * Return the best default cloud model for a given provider.
 * Prefers models tagged 'recommended'.
 */
export function bestCloudModel(provider: 'openrouter' | 'openai' | 'anthropic'): ModelEntry | null {
  const clouds = CLOUD_MODELS_LIST.filter(m => m.provider === provider);
  const tagged = clouds.filter(m => m.tags.includes('recommended'));
  return (tagged[0] ?? clouds[0]) ?? null;
}

// ── Performance Prediction ─────────────────────────────────────────────────

export type PerformanceLabel = 'Yüksek Hız' | 'Dengeli' | 'Düşük Performans';

export interface PerformancePrediction {
  /** Human-readable performance estimate */
  label:         PerformanceLabel;
  /** RAM required by the model in GB (0 for cloud models) */
  modelRamGb:    number;
  /** Total system RAM in GB (rounded to 1 decimal) */
  systemRamGb:   number;
  /** model RAM as a percentage of system RAM (0 for cloud models) */
  ratioPercent:  number;
}

/**
 * Predict how well a model will perform on the current machine.
 *
 * Compares the model's RAM requirement against `os.totalmem()`:
 *   ≤ 50 % of system RAM  → 'Yüksek Hız'       (plenty of headroom)
 *   51–80 % of system RAM → 'Dengeli'            (workable, modest swap risk)
 *   > 80 % of system RAM  → 'Düşük Performans'   (heavy swap / OOM risk)
 *
 * Cloud models (ramGb === 0) are always rated 'Yüksek Hız' because
 * inference runs on the provider's servers.
 *
 * @param modelId  Model catalog id or Ollama modelId, e.g. 'phi3-mini' or 'phi3:mini'
 */
export function getPerformancePrediction(modelId: string): PerformancePrediction {
  const model = MODELS_LIST.find(m => m.id === modelId || m.modelId === modelId);
  const systemRamGb   = os.totalmem() / (1024 ** 3);
  const modelRamGb    = model?.ramGb ?? 0;

  // Cloud models or unknown — treat as high-speed (no local inference cost)
  if (modelRamGb === 0) {
    return {
      label:        'Yüksek Hız',
      modelRamGb,
      systemRamGb:  Math.round(systemRamGb * 10) / 10,
      ratioPercent: 0,
    };
  }

  const ratioPercent = Math.round((modelRamGb / systemRamGb) * 100);

  let label: PerformanceLabel;
  if (ratioPercent <= 50) {
    label = 'Yüksek Hız';
  } else if (ratioPercent <= 80) {
    label = 'Dengeli';
  } else {
    label = 'Düşük Performans';
  }

  return {
    label,
    modelRamGb,
    systemRamGb: Math.round(systemRamGb * 10) / 10,
    ratioPercent,
  };
}
