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

/** Authenticated fetch wrapper — injects Bearer token when available.
 *  Dispatches `mustb:401` CustomEvent so the Settings page can prompt
 *  the user to update their API key. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    cachedToken = null; // force re-auth on next call
    window.dispatchEvent(new CustomEvent("mustb:401", { detail: { url: input } }));
  }
  return res;
}
