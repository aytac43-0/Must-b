/**
 * Must-b Model Catalog
 *
 * Defines every LLM that Must-b can use — both local (Ollama) and cloud
 * (OpenRouter / OpenAI / Anthropic).  Each entry carries RAM requirements
 * and the minimum hardware score needed to run it comfortably.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type ModelProvider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

export type ModelCategory = 'local' | 'cloud';

export type ModelFitLabel =
  | 'Sorunsuz çalışır'   // score ≥ minScore
  | 'Zorlanabilir'        // score ≥ minScore - 4 (marginal)
  | 'Bulut Önerilir';    // score < minScore - 4 (underpowered for local)

export interface ModelEntry {
  id: string;
  /** Human-readable display name */
  name: string;
  provider: ModelProvider;
  category: ModelCategory;
  /** Ollama pull tag or API model ID */
  modelId: string;
  /** Approximate RAM required (GB) */
  ramGb: number;
  /** Minimum hardware score for comfortable local use (N/A for cloud) */
  minScore: number;
  /** Short description shown in Dashboard */
  description: string;
  /** Parameter size shorthand (e.g. "3B", "70B") */
  params: string;
  /** True if this model needs a paid API key */
  requiresApiKey: boolean;
  /** Model speciality tags */
  tags: string[];
}

// ── Local Models (Ollama) ─────────────────────────────────────────────────

const LOCAL_MODELS: ModelEntry[] = [
  {
    id: 'phi3-mini',
    name: 'Phi-3 Mini',
    provider: 'ollama',
    category: 'local',
    modelId: 'phi3:mini',
    ramGb: 2.5,
    minScore: 4,
    description: 'Microsoft\'s compact powerhouse. Best for low-RAM systems.',
    params: '3.8B',
    requiresApiKey: false,
    tags: ['fast', 'efficient', 'reasoning'],
  },
  {
    id: 'llama3.2-3b',
    name: 'Llama 3.2 3B',
    provider: 'ollama',
    category: 'local',
    modelId: 'llama3.2:3b',
    ramGb: 3,
    minScore: 5,
    description: 'Meta\'s smallest Llama 3 — great for quick tasks.',
    params: '3B',
    requiresApiKey: false,
    tags: ['fast', 'general'],
  },
  {
    id: 'gemma2-2b',
    name: 'Gemma 2 2B',
    provider: 'ollama',
    category: 'local',
    modelId: 'gemma2:2b',
    ramGb: 2,
    minScore: 4,
    description: 'Google\'s ultra-light model. Surprisingly capable at 2B.',
    params: '2B',
    requiresApiKey: false,
    tags: ['fast', 'lightweight'],
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'ollama',
    category: 'local',
    modelId: 'mistral:7b',
    ramGb: 5,
    minScore: 10,
    description: 'Efficient 7B model with strong instruction following.',
    params: '7B',
    requiresApiKey: false,
    tags: ['general', 'coding', 'instruction'],
  },
  {
    id: 'llama3.2-8b',
    name: 'Llama 3.2 8B',
    provider: 'ollama',
    category: 'local',
    modelId: 'llama3.2:latest',
    ramGb: 6,
    minScore: 12,
    description: 'Meta\'s latest 8B — excellent reasoning and instruction following.',
    params: '8B',
    requiresApiKey: false,
    tags: ['general', 'reasoning', 'recommended'],
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'ollama',
    category: 'local',
    modelId: 'llama3.1:8b',
    ramGb: 6,
    minScore: 12,
    description: 'Llama 3.1 8B — strong coding and multi-turn conversations.',
    params: '8B',
    requiresApiKey: false,
    tags: ['coding', 'general'],
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    provider: 'ollama',
    category: 'local',
    modelId: 'qwen2.5:7b',
    ramGb: 5.5,
    minScore: 11,
    description: 'Alibaba\'s Qwen 2.5 — excellent multilingual and coding tasks.',
    params: '7B',
    requiresApiKey: false,
    tags: ['multilingual', 'coding', 'recommended'],
  },
  {
    id: 'gemma2-9b',
    name: 'Gemma 2 9B',
    provider: 'ollama',
    category: 'local',
    modelId: 'gemma2:9b',
    ramGb: 7,
    minScore: 14,
    description: 'Google\'s capable 9B — great reasoning at modest hardware.',
    params: '9B',
    requiresApiKey: false,
    tags: ['reasoning', 'general'],
  },
  {
    id: 'deepseek-r1-8b',
    name: 'DeepSeek R1 8B',
    provider: 'ollama',
    category: 'local',
    modelId: 'deepseek-r1:8b',
    ramGb: 6.5,
    minScore: 13,
    description: 'Chain-of-thought reasoning specialist. Excellent for complex tasks.',
    params: '8B',
    requiresApiKey: false,
    tags: ['reasoning', 'coding', 'thinking'],
  },
  {
    id: 'llama3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'ollama',
    category: 'local',
    modelId: 'llama3.1:70b',
    ramGb: 42,
    minScore: 50,
    description: 'Full-power Llama 70B — matches GPT-4 class performance locally.',
    params: '70B',
    requiresApiKey: false,
    tags: ['powerful', 'general', 'ultra-max'],
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 32B',
    provider: 'ollama',
    category: 'local',
    modelId: 'deepseek-r1:32b',
    ramGb: 22,
    minScore: 32,
    description: 'Large reasoning model — ideal for agentic and multi-step work.',
    params: '32B',
    requiresApiKey: false,
    tags: ['reasoning', 'agentic', 'ultra'],
  },
];

// ── Cloud Models ──────────────────────────────────────────────────────────

const CLOUD_MODELS: ModelEntry[] = [
  // ── OpenRouter (multi-provider, one key) ─────────────────────────────
  {
    id: 'claude-3-5-sonnet-or',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'anthropic/claude-3.5-sonnet',
    ramGb: 0,
    minScore: 0,
    description: 'Anthropic\'s best — exceptional reasoning, code and long context.',
    params: '?',
    requiresApiKey: true,
    tags: ['powerful', 'coding', 'reasoning', 'recommended'],
  },
  {
    id: 'gpt-4o-or',
    name: 'GPT-4o',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'openai/gpt-4o',
    ramGb: 0,
    minScore: 0,
    description: 'OpenAI flagship — multimodal, fast and highly capable.',
    params: '?',
    requiresApiKey: true,
    tags: ['powerful', 'multimodal', 'general'],
  },
  {
    id: 'gpt-4o-mini-or',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'openai/gpt-4o-mini',
    ramGb: 0,
    minScore: 0,
    description: 'Affordable GPT-4 class model. Great for everyday automation.',
    params: '?',
    requiresApiKey: true,
    tags: ['affordable', 'fast', 'general', 'recommended'],
  },
  {
    id: 'claude-3-haiku-or',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'anthropic/claude-3-haiku',
    ramGb: 0,
    minScore: 0,
    description: 'Anthropic\'s fastest/cheapest model — excellent for high-frequency tasks.',
    params: '?',
    requiresApiKey: true,
    tags: ['fast', 'affordable'],
  },
  {
    id: 'mistral-large-or',
    name: 'Mistral Large',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'mistralai/mistral-large',
    ramGb: 0,
    minScore: 0,
    description: 'Mistral\'s flagship cloud model — strong multilingual support.',
    params: '?',
    requiresApiKey: true,
    tags: ['multilingual', 'coding'],
  },
  {
    id: 'gemini-flash-or',
    name: 'Gemini 1.5 Flash',
    provider: 'openrouter',
    category: 'cloud',
    modelId: 'google/gemini-flash-1.5',
    ramGb: 0,
    minScore: 0,
    description: 'Google\'s ultra-fast model with 1M token context window.',
    params: '?',
    requiresApiKey: true,
    tags: ['fast', 'long-context'],
  },
  // ── OpenAI direct ─────────────────────────────────────────────────────
  {
    id: 'gpt-4o-direct',
    name: 'GPT-4o (direct)',
    provider: 'openai',
    category: 'cloud',
    modelId: 'gpt-4o',
    ramGb: 0,
    minScore: 0,
    description: 'OpenAI GPT-4o via direct API.',
    params: '?',
    requiresApiKey: true,
    tags: ['powerful', 'multimodal'],
  },
  {
    id: 'gpt-4o-mini-direct',
    name: 'GPT-4o Mini (direct)',
    provider: 'openai',
    category: 'cloud',
    modelId: 'gpt-4o-mini',
    ramGb: 0,
    minScore: 0,
    description: 'OpenAI GPT-4o Mini via direct API.',
    params: '?',
    requiresApiKey: true,
    tags: ['affordable', 'fast'],
  },
  // ── Anthropic direct ──────────────────────────────────────────────────
  {
    id: 'claude-3-5-sonnet-direct',
    name: 'Claude 3.5 Sonnet (direct)',
    provider: 'anthropic',
    category: 'cloud',
    modelId: 'claude-3-5-sonnet-20241022',
    ramGb: 0,
    minScore: 0,
    description: 'Anthropic Claude 3.5 Sonnet via direct API.',
    params: '?',
    requiresApiKey: true,
    tags: ['powerful', 'coding', 'reasoning'],
  },
  {
    id: 'claude-3-haiku-direct',
    name: 'Claude 3 Haiku (direct)',
    provider: 'anthropic',
    category: 'cloud',
    modelId: 'claude-3-haiku-20240307',
    ramGb: 0,
    minScore: 0,
    description: 'Anthropic Claude 3 Haiku via direct API — cheapest option.',
    params: '?',
    requiresApiKey: true,
    tags: ['affordable', 'fast'],
  },
];

// ── Exports ────────────────────────────────────────────────────────────────

/** Complete model list — local + cloud */
export const MODELS_LIST: ModelEntry[] = [...LOCAL_MODELS, ...CLOUD_MODELS];

/** All local (Ollama) models */
export const LOCAL_MODELS_LIST  = LOCAL_MODELS;

/** All cloud models */
export const CLOUD_MODELS_LIST  = CLOUD_MODELS;

/** Look up a model by its catalog ID */
export function findModel(id: string): ModelEntry | undefined {
  return MODELS_LIST.find(m => m.id === id);
}

/** Look up a model by its actual modelId (e.g. 'llama3.2:latest') */
export function findModelByModelId(modelId: string): ModelEntry | undefined {
  return MODELS_LIST.find(m => m.modelId === modelId);
}
