/**
 * Production-grade AI adapter layer.
 *
 * - Provider-agnostic interface
 * - HuggingFace provider implementation
 * - OpenAI-ready provider structure
 * - Timeout + retry with exponential backoff
 * - Structured error mapping
 */

type AIProviderName = "huggingface" | "openai";

type AIErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "GONE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "TIMEOUT"
  | "SERVICE_UNAVAILABLE"
  | "BAD_REQUEST"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export interface AIAdapterError {
  code: AIErrorCode;
  status?: number;
  retryable: boolean;
  provider: AIProviderName;
  message: string;
  details?: unknown;
}

export interface AIResponse {
  ok: true;
  provider: AIProviderName;
  text: string;
}

export interface AIErrorResponse {
  ok: false;
  provider: AIProviderName;
  error: AIAdapterError;
}

export type AIResult = AIResponse | AIErrorResponse;

interface ProviderGenerateParams {
  prompt: string;
  signal: AbortSignal;
}

interface AIProvider {
  readonly name: AIProviderName;
  generate(params: ProviderGenerateParams): Promise<string>;
}

interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface GenerateOptions {
  timeoutMs: number;
  retry: RetryOptions;
}

const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
  retry: {
    retries: Number(process.env.AI_RETRY_COUNT || 2),
    baseDelayMs: Number(process.env.AI_RETRY_BASE_DELAY_MS || 500),
    maxDelayMs: Number(process.env.AI_RETRY_MAX_DELAY_MS || 5000),
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.max(50, exp * 0.25));
  return Math.min(maxDelayMs, exp + jitter);
}

function normalizeErrorMessage(input: unknown, fallback: string): string {
  if (typeof input === "string" && input.trim()) return input;
  if (input && typeof input === "object" && "message" in input) {
    const maybe = (input as { message?: unknown }).message;
    if (typeof maybe === "string" && maybe.trim()) return maybe;
  }
  return fallback;
}

function mapHttpError(provider: AIProviderName, status: number, body?: unknown): AIAdapterError {
  const bodyMessage = normalizeErrorMessage(body, "Provider request failed.").toLowerCase();

  if (status === 400) {
    return { code: "BAD_REQUEST", status, retryable: false, provider, message: "Invalid request payload for AI provider.", details: body };
  }
  if (status === 401) {
    return { code: "UNAUTHORIZED", status, retryable: false, provider, message: "AI provider authentication failed.", details: body };
  }
  if (status === 403) {
    return { code: "FORBIDDEN", status, retryable: false, provider, message: "AI provider rejected the request.", details: body };
  }
  if (status === 404) {
    return { code: "NOT_FOUND", status, retryable: false, provider, message: "Requested AI model or endpoint was not found.", details: body };
  }
  if (status === 410) {
    return { code: "GONE", status, retryable: false, provider, message: "AI endpoint/model is no longer available (410 Gone).", details: body };
  }

  if (status === 429 || bodyMessage.includes("rate limit")) {
    const quotaRelated = bodyMessage.includes("quota") || bodyMessage.includes("insufficient_quota");
    return {
      code: quotaRelated ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
      status,
      retryable: !quotaRelated,
      provider,
      message: quotaRelated ? "AI provider quota exceeded." : "AI provider rate limit reached.",
      details: body,
    };
  }

  if (status >= 500 || bodyMessage.includes("currently loading") || bodyMessage.includes("temporarily")) {
    return {
      code: "SERVICE_UNAVAILABLE",
      status,
      retryable: true,
      provider,
      message: "AI provider is temporarily unavailable.",
      details: body,
    };
  }

  return {
    code: "PROVIDER_ERROR",
    status,
    retryable: false,
    provider,
    message: "AI provider returned an unexpected error.",
    details: body,
  };
}

function mapRuntimeError(provider: AIProviderName, error: unknown): AIAdapterError {
  const message = normalizeErrorMessage(error, "Unknown AI runtime error");

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "TIMEOUT",
      retryable: true,
      provider,
      message: "AI request timed out.",
      details: { original: message },
    };
  }

  return {
    code: "UNKNOWN",
    retryable: true,
    provider,
    message,
    details: error,
  };
}

class HuggingFaceProvider implements AIProvider {
  readonly name: AIProviderName = "huggingface";
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly modelUrl: string;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || "";

    // Public, actively maintained text-generation model.
    this.modelId = process.env.HUGGINGFACE_MODEL_ID || "Qwen/Qwen2.5-7B-Instruct";

    // Enforce correct HuggingFace Inference endpoint format.
    this.modelUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(this.modelId)}`;
  }

  async generate({ prompt, signal }: ProviderGenerateParams): Promise<string> {
    if (!this.apiKey) {
      throw {
        kind: "config",
        status: 401,
        body: { message: "HUGGINGFACE_API_KEY is not configured." },
      };
    }

    console.log(`[AI][HuggingFace] Using model: ${this.modelId}`);

    const response = await fetch(this.modelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false,
        },
      }),
      signal,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }
      throw { kind: "http", status: response.status, body };
    }

    const data = (await response.json()) as unknown;

    if (Array.isArray(data) && data[0] && typeof data[0] === "object" && "generated_text" in data[0]) {
      let text = String((data[0] as { generated_text?: unknown }).generated_text || "").trim();
      if (text.startsWith("<s>[INST]")) {
        text = text.split("[/INST]").pop()?.trim() || text;
      }
      return text || "I'm sorry, I couldn't form a response. Please try again.";
    }

    if (data && typeof data === "object" && "error" in data) {
      const body = data as { error?: unknown };
      throw { kind: "http", status: 503, body: { message: normalizeErrorMessage(body.error, "Provider error") } };
    }

    throw { kind: "http", status: 502, body: { message: "Unexpected HuggingFace response format." } };
  }
}

/**
 * Structure-ready OpenAI provider.
 * Activated by setting AI_PROVIDER=openai and OPENAI_API_KEY + OPENAI_MODEL.
 */
class OpenAIProvider implements AIProvider {
  readonly name: AIProviderName = "openai";
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async generate({ prompt, signal }: ProviderGenerateParams): Promise<string> {
    if (!this.apiKey) {
      throw {
        kind: "config",
        status: 401,
        body: { message: "OPENAI_API_KEY is not configured." },
      };
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
      signal,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }
      throw { kind: "http", status: response.status, body };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw { kind: "http", status: 502, body: { message: "Unexpected OpenAI response format." } };
    }

    return content;
  }
}

function createProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "huggingface").toLowerCase();

  if (provider === "openai") return new OpenAIProvider();
  return new HuggingFaceProvider();
}

async function withRetry(
  provider: AIProvider,
  prompt: string,
  options: GenerateOptions
): Promise<AIResult> {
  let lastError: AIAdapterError | null = null;

  for (let attempt = 1; attempt <= options.retry.retries + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const text = await provider.generate({ prompt, signal: controller.signal });
      clearTimeout(timeout);
      return { ok: true, provider: provider.name, text };
    } catch (rawError) {
      clearTimeout(timeout);

      let mapped: AIAdapterError;
      if (rawError && typeof rawError === "object" && "kind" in rawError && (rawError as { kind?: unknown }).kind === "http") {
        const typed = rawError as { status: number; body?: unknown };
        mapped = mapHttpError(provider.name, typed.status, typed.body);
      } else if (rawError && typeof rawError === "object" && "kind" in rawError && (rawError as { kind?: unknown }).kind === "config") {
        const typed = rawError as { status: number; body?: unknown };
        mapped = mapHttpError(provider.name, typed.status, typed.body);
      } else {
        mapped = mapRuntimeError(provider.name, rawError);
      }

      lastError = mapped;
      const canRetry = mapped.retryable && attempt <= options.retry.retries;

      if (!canRetry) {
        break;
      }

      const delay = getBackoffDelayMs(attempt, options.retry.baseDelayMs, options.retry.maxDelayMs);
      await sleep(delay);
    }
  }

  return {
    ok: false,
    provider: provider.name,
    error:
      lastError || {
        code: "UNKNOWN",
        retryable: false,
        provider: provider.name,
        message: "Unknown error while generating AI response.",
      },
  };
}

function toUserFacingMessage(error: AIAdapterError): string {
  switch (error.code) {
    case "TIMEOUT":
      return "Must-b took too long to respond. Please try again in a moment.";
    case "RATE_LIMITED":
      return "Must-b is receiving too many requests right now. Please retry shortly.";
    case "QUOTA_EXCEEDED":
      return "Must-b AI capacity is currently exhausted. Please try again later.";
    case "GONE":
      return "The configured AI model is no longer available. Please contact support.";
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return "Must-b AI configuration is invalid. Please check provider credentials.";
    case "SERVICE_UNAVAILABLE":
      return "Must-b is warming up its conversational core. Please retry in a few seconds.";
    default:
      return "Oops! I hit a snag in my thinking process. Please try again.";
  }
}

export async function getAIResponse(message: string): Promise<string> {
  const result = await getAIResponseStructured(message);
  if (result.ok) return result.text;
  return toUserFacingMessage(result.error);
}

export async function getAIResponseStructured(
  message: string,
  options: Partial<GenerateOptions> = {}
): Promise<AIResult> {
  const merged: GenerateOptions = {
    timeoutMs: options.timeoutMs ?? DEFAULT_GENERATE_OPTIONS.timeoutMs,
    retry: {
      retries: options.retry?.retries ?? DEFAULT_GENERATE_OPTIONS.retry.retries,
      baseDelayMs: options.retry?.baseDelayMs ?? DEFAULT_GENERATE_OPTIONS.retry.baseDelayMs,
      maxDelayMs: options.retry?.maxDelayMs ?? DEFAULT_GENERATE_OPTIONS.retry.maxDelayMs,
    },
  };

  const provider = createProvider();
  const result = await withRetry(provider, message, merged);

  if (!result.ok) {
    console.error("AI adapter error", {
      provider: result.provider,
      code: result.error.code,
      status: result.error.status,
      retryable: result.error.retryable,
      message: result.error.message,
    });
  }

  return result;
}

export { toUserFacingMessage };
