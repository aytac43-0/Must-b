/**
 * Must-b Auth Module (v1.21.0 — Placeholder)
 *
 * Future integration: must-b.com cloud identity via Supabase OAuth.
 *
 * When must-b.com goes live, replace the placeholder bodies with:
 *   import { createClient } from '@supabase/supabase-js'
 *   const supabase = createClient(MUSTB_SUPABASE_URL, MUSTB_SUPABASE_ANON_KEY)
 *
 * Supported flows (planned):
 *   - Email / password (Supabase Auth)
 *   - OAuth: GitHub, Google (via Supabase provider redirect)
 *   - Session persistence: localStorage (web) / secure file (CLI)
 *   - JWT refresh: automatic via Supabase client
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface MustbUser {
  id:        string;
  email:     string;
  name?:     string;
  avatarUrl?: string;
  /** Supabase access token */
  accessToken: string;
  /** ISO timestamp */
  expiresAt:   string;
}

export interface MustbSession {
  user:         MustbUser;
  refreshToken: string;
}

export type OAuthProvider = 'github' | 'google';

export type AuthStateEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

export type AuthStateCallback = (event: AuthStateEvent, session: MustbSession | null) => void;

export interface AuthResult<T = void> {
  data:  T | null;
  error: string | null;
}

// ── Internal state ────────────────────────────────────────────────────────

let _session: MustbSession | null = null;
const _listeners: AuthStateCallback[] = [];

function _emit(event: AuthStateEvent, session: MustbSession | null): void {
  for (const fn of _listeners) fn(event, session);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 * Placeholder — will call Supabase Auth when must-b.com is live.
 */
export async function signInWithEmail(
  _email: string,
  _password: string,
): Promise<AuthResult<MustbSession>> {
  // TODO: replace with supabase.auth.signInWithPassword({ email, password })
  return { data: null, error: 'must-b.com cloud auth is not yet available. Coming soon.' };
}

/**
 * Initiate OAuth sign-in via a supported provider.
 * In web mode, redirects the browser; in CLI mode, prints the OAuth URL.
 * Placeholder — will call Supabase OAuth redirect when must-b.com is live.
 */
export async function signInWithOAuth(
  _provider: OAuthProvider,
  _redirectTo?: string,
): Promise<AuthResult<{ url: string }>> {
  // TODO: replace with supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
  return { data: null, error: 'must-b.com OAuth is not yet available. Coming soon.' };
}

/**
 * Sign out the current session.
 * Clears local session state and emits SIGNED_OUT.
 */
export async function signOut(): Promise<AuthResult> {
  // TODO: replace with supabase.auth.signOut()
  if (_session) {
    _session = null;
    _emit('SIGNED_OUT', null);
  }
  return { data: null, error: null };
}

/**
 * Return the current active session, or null if not signed in.
 */
export function getSession(): MustbSession | null {
  return _session;
}

/**
 * Return the current user, or null if not signed in.
 */
export function getUser(): MustbUser | null {
  return _session?.user ?? null;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 *
 * @example
 *   const unsub = onAuthStateChange((event, session) => {
 *     if (event === 'SIGNED_IN') console.log('Welcome', session?.user.name);
 *   });
 *   // later: unsub();
 */
export function onAuthStateChange(callback: AuthStateCallback): () => void {
  _listeners.push(callback);
  // Immediately fire with current state
  callback(_session ? 'SIGNED_IN' : 'SIGNED_OUT', _session);
  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/**
 * Restore a previously saved session (e.g. from disk in CLI mode).
 * Validates expiry before accepting.
 */
export async function restoreSession(raw: MustbSession): Promise<AuthResult<MustbSession>> {
  const expiresAt = new Date(raw.user.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    return { data: null, error: 'Session expired. Please sign in again.' };
  }
  _session = raw;
  _emit('SIGNED_IN', _session);
  return { data: _session, error: null };
}

/**
 * Check whether the current session token is still valid.
 * Returns false if not signed in or token has expired.
 */
export function isAuthenticated(): boolean {
  if (!_session) return false;
  return Date.now() < new Date(_session.user.expiresAt).getTime();
}

/**
 * Summarise auth state for debug/health endpoints.
 */
export function authInfo(): Record<string, unknown> {
  return {
    authenticated: isAuthenticated(),
    userEmail:     _session?.user.email ?? null,
    expiresAt:     _session?.user.expiresAt ?? null,
    provider:      'supabase/must-b.com (placeholder)',
    status:        'not-connected',
  };
}
