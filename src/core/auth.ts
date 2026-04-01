/**
 * Must-b Auth Module (v1.22.0 — Cloud Bridge)
 *
 * OAuth flow:
 *   1. Frontend opens /api/auth/user-connect?provider=github|google
 *   2. Server redirects → must-b.com/auth/oauth?provider=...&callback=localhost:4309/api/auth/callback
 *   3. must-b.com calls back → /api/auth/callback?access_token=...&user_email=...
 *   4. Server calls signInFromCallback() → persists session to STORAGE_ROOT/config.json
 *   5. Socket.io emits 'authStateChanged' → Frontend refreshes via /api/auth/user-status
 *
 * When must-b.com goes live, replace the OAuth redirect URL in getOAuthUrl().
 * Session storage already writes to OS-standard path via STORAGE_ROOT.
 */

import path from 'node:path';
import fs   from 'node:fs';
import { STORAGE_ROOT } from './paths.js';

// ── Config path ───────────────────────────────────────────────────────────

/** Absolute path: %APPDATA%/must-b/config.json (Win) or ~/.config/must-b/config.json */
const CONFIG_PATH = path.join(STORAGE_ROOT, 'config.json');

// ── Types ─────────────────────────────────────────────────────────────────

export interface MustbUser {
  id:          string;
  email:       string;
  name?:       string;
  avatarUrl?:  string;
  /** OAuth access token */
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

/** Params received from must-b.com OAuth callback */
export interface CallbackParams {
  access_token:  string;
  refresh_token?: string;
  expires_at?:   string;
  user_id?:      string;
  user_email?:   string;
  user_name?:    string;
  user_avatar?:  string;
}

// ── Internal config store ────────────────────────────────────────────────

interface StoredConfig {
  session?: MustbSession;
}

function _readConfig(): StoredConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return {};
  }
}

function _writeConfig(data: StoredConfig): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* ignore write errors in read-only envs */ }
}

// ── Internal state ────────────────────────────────────────────────────────

let _session: MustbSession | null = null;
const _listeners: AuthStateCallback[] = [];

function _emit(event: AuthStateEvent, session: MustbSession | null): void {
  for (const fn of _listeners) fn(event, session);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build the OAuth redirect URL for a given provider.
 * The local server will redirect the browser here; must-b.com handles
 * the provider handshake and calls back to callbackBase/api/auth/callback.
 */
export function getOAuthUrl(provider: OAuthProvider, callbackBase: string): string {
  const CLOUD_URL = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
  const url = new URL(`${CLOUD_URL}/auth/oauth`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('callback', `${callbackBase}/api/auth/callback`);
  return url.toString();
}

/**
 * Sign in with email and password.
 * Placeholder — will call Supabase Auth when must-b.com is live.
 */
export async function signInWithEmail(
  _email: string,
  _password: string,
): Promise<AuthResult<MustbSession>> {
  return { data: null, error: 'must-b.com cloud auth is not yet available. Use OAuth (GitHub/Google).' };
}

/**
 * Initiate OAuth sign-in via a supported provider.
 * Returns the redirect URL — the caller (api.ts) performs the actual redirect.
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  callbackBase: string,
): Promise<AuthResult<{ url: string }>> {
  const url = getOAuthUrl(provider, callbackBase);
  return { data: { url }, error: null };
}

/**
 * Process the OAuth callback params received from must-b.com.
 * Creates a session, persists it to STORAGE_ROOT/config.json,
 * and emits SIGNED_IN to all listeners.
 */
export async function signInFromCallback(
  params: CallbackParams,
): Promise<AuthResult<MustbSession>> {
  const expiresAt = params.expires_at
    ?? new Date(Date.now() + 3600 * 1000).toISOString();

  const session: MustbSession = {
    user: {
      id:          params.user_id    ?? crypto.randomUUID(),
      email:       params.user_email ?? '',
      name:        params.user_name,
      avatarUrl:   params.user_avatar,
      accessToken: params.access_token,
      expiresAt,
    },
    refreshToken: params.refresh_token ?? '',
  };

  _session = session;
  _emit('SIGNED_IN', _session);

  const cfg = _readConfig();
  cfg.session = session;
  _writeConfig(cfg);

  return { data: _session, error: null };
}

/**
 * Restore a session from STORAGE_ROOT/config.json (called at server boot).
 * Silently ignores missing or expired sessions.
 */
export async function restoreSessionFromDisk(): Promise<AuthResult<MustbSession>> {
  const cfg = _readConfig();
  if (!cfg.session) return { data: null, error: 'No saved session.' };
  return restoreSession(cfg.session);
}

/**
 * Restore a previously saved session object (validates expiry).
 */
export async function restoreSession(raw: MustbSession): Promise<AuthResult<MustbSession>> {
  const expiresAt = new Date(raw.user.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    // Clear stale session from disk
    const cfg = _readConfig();
    delete cfg.session;
    _writeConfig(cfg);
    return { data: null, error: 'Session expired. Please sign in again.' };
  }
  _session = raw;
  _emit('SIGNED_IN', _session);
  return { data: _session, error: null };
}

/**
 * Sign out — clears in-memory session, config.json entry, and emits SIGNED_OUT.
 */
export async function signOut(): Promise<AuthResult> {
  if (_session) {
    _session = null;
    _emit('SIGNED_OUT', null);
    const cfg = _readConfig();
    delete cfg.session;
    _writeConfig(cfg);
  }
  return { data: null, error: null };
}

/** Return the current active session, or null if not signed in. */
export function getSession(): MustbSession | null {
  return _session;
}

/** Return the current user, or null if not signed in. */
export function getUser(): MustbUser | null {
  return _session?.user ?? null;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function. Immediately fires with current state.
 */
export function onAuthStateChange(callback: AuthStateCallback): () => void {
  _listeners.push(callback);
  callback(_session ? 'SIGNED_IN' : 'SIGNED_OUT', _session);
  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/**
 * Check whether the current session token is still valid.
 */
export function isAuthenticated(): boolean {
  if (!_session) return false;
  return Date.now() < new Date(_session.user.expiresAt).getTime();
}

/**
 * Auth state summary for health/status endpoints and the frontend.
 */
export function authInfo(): Record<string, unknown> {
  return {
    authenticated: isAuthenticated(),
    userEmail:     _session?.user.email     ?? null,
    userName:      _session?.user.name      ?? null,
    avatarUrl:     _session?.user.avatarUrl ?? null,
    expiresAt:     _session?.user.expiresAt ?? null,
    provider:      'must-b.com OAuth',
    status:        isAuthenticated() ? 'connected' : 'not-connected',
  };
}
