/**
 * Must-b Provider Catalog (v1.5.0-alpha.3)
 *
 * Comprehensive registry of every AI provider Must-b can connect to.
 * Extracted from OpenClaw's models-config.providers.* analysis + current AI landscape.
 *
 * Categories:
 *   frontier    — Leading commercial labs (OpenAI, Anthropic, Google, xAI)
 *   gateway     — Aggregators that proxy many providers via one key
 *   fast        — Ultra-low-latency inference clouds
 *   local       — On-device / offline inference
 *   open        — Open-source model hosting clouds
 *   specialist  — Domain-focused providers (code, search, reasoning)
 *   regional    — East-Asian and regional providers
 *   enterprise  — Cloud-native enterprise integrations
 *   custom      — Generic OpenAI-compatible endpoints
 */

export type ProviderCategory =
  | 'frontier'
  | 'gateway'
  | 'fast'
  | 'local'
  | 'open'
  | 'specialist'
  | 'regional'
  | 'enterprise'
  | 'custom';

export interface ProviderMeta {
  id: string;
  label: string;
  description: string;
  /** Primary API base URL (informational — routing is in provider.ts) */
  baseUrl: string;
  /** Environment variable that holds the API key or base URL */
  envKey: string;
  /** true when envKey stores a URL rather than an API key */
  envKeyIsUrl: boolean;
  /** Recommended default model ID */
  defaultModel: string;
  /** Latest / recommended model IDs shown in the UI */
  latestModels: string[];
  /** Placeholder shown in the password input */
  placeholder: string;
  category: ProviderCategory;
  /** Feature tags shown as badges */
  tags: string[];
  docsUrl: string;
}

export const PROVIDER_CATALOG: ProviderMeta[] = [
  // ── Frontier ───────────────────────────────────────────────────────────────
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o, o1, o3 — the industry standard',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'gpt-4o-mini',
    latestModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
    placeholder: 'sk-...',
    category: 'frontier',
    tags: ['vision', 'reasoning', 'json-mode'],
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude 3.5 Sonnet/Haiku — best for complex reasoning & code',
    baseUrl: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'claude-3-5-haiku-20241022',
    latestModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...',
    category: 'frontier',
    tags: ['reasoning', 'coding', 'long-context'],
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 1.5/2.0 Flash — multimodal, 1M token context',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GOOGLE_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'gemini-2.0-flash',
    latestModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    placeholder: 'AIza...',
    category: 'frontier',
    tags: ['vision', 'long-context', 'free-tier'],
    docsUrl: 'https://aistudio.google.com',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    description: 'Grok-2 — real-time knowledge, reasoning specialist',
    baseUrl: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'grok-2-latest',
    latestModels: ['grok-2-latest', 'grok-2-mini', 'grok-beta'],
    placeholder: 'xai-...',
    category: 'frontier',
    tags: ['reasoning', 'real-time'],
    docsUrl: 'https://console.x.ai',
  },

  // ── Gateway ────────────────────────────────────────────────────────────────
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Access 200+ models via one unified API key',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'openai/gpt-4o-mini',
    latestModels: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5', 'meta-llama/llama-3.3-70b-instruct'],
    placeholder: 'sk-or-v1-...',
    category: 'gateway',
    tags: ['200+ models', 'free-tier', 'unified-key'],
    docsUrl: 'https://openrouter.ai/keys',
  },

  // ── Fast Inference ─────────────────────────────────────────────────────────
  {
    id: 'groq',
    label: 'Groq Cloud',
    description: 'LPU-accelerated inference — 500 tok/s Llama 3.3 70B',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'llama-3.3-70b-versatile',
    latestModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    placeholder: 'gsk_...',
    category: 'fast',
    tags: ['ultra-fast', 'free-tier', 'open-source'],
    docsUrl: 'https://console.groq.com',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    description: 'Wafer-scale AI chips — world\'s fastest inference',
    baseUrl: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'llama3.1-70b',
    latestModels: ['llama3.1-70b', 'llama3.1-8b'],
    placeholder: 'csk-...',
    category: 'fast',
    tags: ['ultra-fast', 'open-source'],
    docsUrl: 'https://inference.cerebras.ai',
  },
  {
    id: 'sambanova',
    label: 'SambaNova',
    description: 'RDU-powered inference — Llama 3.1 405B at scale',
    baseUrl: 'https://api.sambanova.ai/v1',
    envKey: 'SAMBANOVA_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'Meta-Llama-3.1-8B-Instruct',
    latestModels: ['Meta-Llama-3.1-405B-Instruct', 'Meta-Llama-3.1-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct'],
    placeholder: 'sn-...',
    category: 'fast',
    tags: ['ultra-fast', 'open-source'],
    docsUrl: 'https://sambanova.ai/apis',
  },

  // ── Local ──────────────────────────────────────────────────────────────────
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Run 100+ models 100% locally — zero cost, full privacy',
    baseUrl: 'http://localhost:11434/v1',
    envKey: 'OLLAMA_BASE_URL',
    envKeyIsUrl: true,
    defaultModel: 'llama3.2:latest',
    latestModels: ['llama3.2:latest', 'llama3.1:8b', 'qwen2.5:7b', 'phi3:mini', 'deepseek-r1:8b'],
    placeholder: 'http://localhost:11434',
    category: 'local',
    tags: ['local', 'free', 'private', 'no-api-key'],
    docsUrl: 'https://ollama.com',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    description: 'Local OpenAI-compatible server — GUI model management',
    baseUrl: 'http://localhost:1234/v1',
    envKey: 'LMSTUDIO_BASE_URL',
    envKeyIsUrl: true,
    defaultModel: 'local-model',
    latestModels: ['local-model'],
    placeholder: 'http://localhost:1234',
    category: 'local',
    tags: ['local', 'free', 'private', 'openai-compat'],
    docsUrl: 'https://lmstudio.ai',
  },
  {
    id: 'jan',
    label: 'Jan',
    description: 'Open-source ChatGPT alternative — runs locally',
    baseUrl: 'http://localhost:1337/v1',
    envKey: 'JAN_BASE_URL',
    envKeyIsUrl: true,
    defaultModel: 'local-model',
    latestModels: ['local-model'],
    placeholder: 'http://localhost:1337',
    category: 'local',
    tags: ['local', 'free', 'private', 'openai-compat'],
    docsUrl: 'https://jan.ai',
  },

  // ── Open Source Cloud ──────────────────────────────────────────────────────
  {
    id: 'together',
    label: 'Together AI',
    description: 'Open-source models cloud — Llama, Mixtral, FLUX',
    baseUrl: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'meta-llama/Llama-3-8b-chat-hf',
    latestModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3-8b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    placeholder: 'together-...',
    category: 'open',
    tags: ['open-source', 'free-tier'],
    docsUrl: 'https://api.together.xyz',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    description: 'Fast open-source model hosting — FireFunction, Llama',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    envKey: 'FIREWORKS_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    latestModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct'],
    placeholder: 'fw_...',
    category: 'open',
    tags: ['open-source', 'fast'],
    docsUrl: 'https://fireworks.ai',
  },
  {
    id: 'hyperbolic',
    label: 'Hyperbolic AI',
    description: 'Affordable GPU cloud — Llama 3.1 405B, DeepSeek',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    envKey: 'HYPERBOLIC_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    latestModels: ['meta-llama/Meta-Llama-3.1-405B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    placeholder: 'hyp-...',
    category: 'open',
    tags: ['open-source', 'affordable'],
    docsUrl: 'https://hyperbolic.xyz',
  },

  // ── Specialist ─────────────────────────────────────────────────────────────
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'R1 chain-of-thought reasoning + V3 coding powerhouse',
    baseUrl: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'deepseek-chat',
    latestModels: ['deepseek-chat', 'deepseek-reasoner'],
    placeholder: 'sk-...',
    category: 'specialist',
    tags: ['reasoning', 'coding', 'affordable'],
    docsUrl: 'https://platform.deepseek.com',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Mixtral MoE, Mistral Large — strong code + multilingual',
    baseUrl: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'mistral-small-latest',
    latestModels: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    placeholder: 'mst-...',
    category: 'specialist',
    tags: ['coding', 'multilingual'],
    docsUrl: 'https://console.mistral.ai',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    description: 'Command R+ — enterprise RAG and tool-use champion',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    envKey: 'COHERE_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'command-r-plus',
    latestModels: ['command-r-plus', 'command-r', 'command-light'],
    placeholder: 'co-...',
    category: 'specialist',
    tags: ['rag', 'enterprise', 'tool-use'],
    docsUrl: 'https://cohere.com',
  },
  {
    id: 'perplexity',
    label: 'Perplexity AI',
    description: 'Sonar — real-time web search + citations built-in',
    baseUrl: 'https://api.perplexity.ai',
    envKey: 'PERPLEXITY_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'llama-3.1-sonar-small-128k-online',
    latestModels: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
    placeholder: 'pplx-...',
    category: 'specialist',
    tags: ['web-search', 'citations', 'real-time'],
    docsUrl: 'https://perplexity.ai/api',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    description: 'Optimized inference on NVIDIA hardware — Llama, Mistral',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'meta/llama-3.1-8b-instruct',
    latestModels: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mixtral-8x7b-instruct-v0.1'],
    placeholder: 'nvapi-...',
    category: 'specialist',
    tags: ['optimized', 'enterprise'],
    docsUrl: 'https://build.nvidia.com',
  },

  // ── Regional ───────────────────────────────────────────────────────────────
  {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    description: 'Kimi — 128k context, strong Chinese + English',
    baseUrl: 'https://api.moonshot.cn/v1',
    envKey: 'MOONSHOT_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'moonshot-v1-8k',
    latestModels: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
    placeholder: 'sk-...',
    category: 'regional',
    tags: ['chinese', 'long-context'],
    docsUrl: 'https://platform.moonshot.cn',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    description: 'MiniMax-Text-01 — 1M token context, multimodal',
    baseUrl: 'https://api.minimax.chat/v1',
    envKey: 'MINIMAX_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'MiniMax-Text-01',
    latestModels: ['MiniMax-Text-01', 'abab6.5s-chat'],
    placeholder: 'mm-...',
    category: 'regional',
    tags: ['chinese', 'long-context', 'vision'],
    docsUrl: 'https://www.minimaxi.com',
  },
  {
    id: 'modelstudio',
    label: 'Alibaba DashScope',
    description: 'Qwen2.5 series — top open-weight multilingual models',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'qwen-turbo',
    latestModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
    placeholder: 'sk-...',
    category: 'regional',
    tags: ['chinese', 'coding', 'multilingual'],
    docsUrl: 'https://dashscope.aliyuncs.com',
  },
  {
    id: 'qianfan',
    label: 'Baidu Qianfan',
    description: 'ERNIE Bot — Baidu\'s flagship LLM platform',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
    envKey: 'QIANFAN_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'ernie-speed-128k',
    latestModels: ['ernie-4.0-8k', 'ernie-speed-128k'],
    placeholder: 'ERNIE-...',
    category: 'regional',
    tags: ['chinese'],
    docsUrl: 'https://cloud.baidu.com/product/wenxinworkshop',
  },
  {
    id: 'doubao',
    label: 'Volcengine Doubao',
    description: 'ByteDance Doubao — powerful Chinese LLM suite',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    envKey: 'DOUBAO_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'doubao-pro-32k',
    latestModels: ['doubao-pro-128k', 'doubao-pro-32k', 'doubao-lite-32k'],
    placeholder: 'ark-...',
    category: 'regional',
    tags: ['chinese', 'coding'],
    docsUrl: 'https://console.volcengine.com/ark',
  },

  // ── Enterprise ─────────────────────────────────────────────────────────────
  {
    id: 'azure',
    label: 'Azure OpenAI',
    description: 'Enterprise-grade OpenAI via Microsoft Azure',
    baseUrl: 'https://{endpoint}.openai.azure.com',
    envKey: 'AZURE_OPENAI_API_KEY',
    envKeyIsUrl: false,
    defaultModel: 'gpt-4o-mini',
    latestModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    placeholder: '00000000-...',
    category: 'enterprise',
    tags: ['enterprise', 'soc2', 'hipaa'],
    docsUrl: 'https://azure.microsoft.com/ai',
  },
  {
    id: 'vertex',
    label: 'Vertex AI',
    description: 'Google Cloud enterprise — Gemini + Claude on GCP',
    baseUrl: 'https://us-central1-aiplatform.googleapis.com/v1',
    envKey: 'GOOGLE_CLOUD_PROJECT',
    envKeyIsUrl: false,
    defaultModel: 'gemini-1.5-flash-001',
    latestModels: ['gemini-1.5-pro-001', 'gemini-1.5-flash-001'],
    placeholder: 'my-gcp-project',
    category: 'enterprise',
    tags: ['enterprise', 'gcp', 'soc2'],
    docsUrl: 'https://cloud.google.com/vertex-ai',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    description: 'Edge-deployed AI inference — Llama, Mistral on CDN',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1',
    envKey: 'CLOUDFLARE_API_KEY',
    envKeyIsUrl: false,
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    latestModels: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1'],
    placeholder: 'cf-...',
    category: 'enterprise',
    tags: ['edge', 'fast', 'affordable'],
    docsUrl: 'https://developers.cloudflare.com/workers-ai',
  },

  // ── Custom ─────────────────────────────────────────────────────────────────
  {
    id: 'custom',
    label: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API — vLLM, TGI, Ollama remote',
    baseUrl: 'http://localhost:8000/v1',
    envKey: 'CUSTOM_API_BASE_URL',
    envKeyIsUrl: true,
    defaultModel: 'default',
    latestModels: ['default'],
    placeholder: 'http://localhost:8000',
    category: 'custom',
    tags: ['openai-compat', 'self-hosted'],
    docsUrl: 'https://github.com/vllm-project/vllm',
  },
];

/** Look up a provider by its ID */
export function findProvider(id: string): ProviderMeta | undefined {
  return PROVIDER_CATALOG.find(p => p.id === id);
}

/** All providers grouped by category */
export function groupProviders(): Record<ProviderCategory, ProviderMeta[]> {
  const groups = {} as Record<ProviderCategory, ProviderMeta[]>;
  for (const p of PROVIDER_CATALOG) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  }
  return groups;
}

/** Category display labels */
export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  frontier:   '⚡ Frontier',
  gateway:    '🌐 Gateway',
  fast:       '🚀 Fast Inference',
  local:      '💻 Local / Offline',
  open:       '🔓 Open Source Cloud',
  specialist: '🎯 Specialist',
  regional:   '🌏 Regional',
  enterprise: '🏢 Enterprise',
  custom:     '⚙️  Custom',
};

/**
 * Map from provider ID to the env var key that stores its API credential.
 * Used by the save endpoint to write the correct .env key.
 */
export const PROVIDER_ENV_KEY_MAP: Record<string, string> = Object.fromEntries(
  PROVIDER_CATALOG.map(p => [p.id, p.envKey]),
);
