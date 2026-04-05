/** Cached local auth token (localhost-only, always succeeds) */
let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const r = await fetch("/api/auth/local");
    if (r.ok) {
      const d = await r.json();
      cachedToken = d.token ?? null;
      return cachedToken;
    }
  } catch { /* local access — no token needed */ }
  return null;
}

/**
 * Authenticated fetch wrapper with connection retry.
 *
 * - Injects Bearer token when available.
 * - Retries up to `retries` times on network failure (TypeError / fetch error)
 *   with exponential back-off (800 ms → 1.6 s → 3.2 s …).
 * - Dispatches `mustb:401`   when the server returns 401 (re-auth needed).
 * - Dispatches `mustb:offline` when all retries are exhausted (no connection).
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
  { retries = 3, retryDelay = 800 }: { retries?: number; retryDelay?: number } = {},
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        cachedToken = null;
        window.dispatchEvent(new CustomEvent("mustb:401", { detail: { url: input } }));
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * attempt));
      }
    }
  }

  // All retries exhausted — signal offline state to any listener
  window.dispatchEvent(new CustomEvent("mustb:offline", { detail: { url: input } }));
  throw lastErr;
}
