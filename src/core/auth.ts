/**
 * Must-b Auth Module (v1.24.0 — Active)
 *
 * OAuth flow (live — must-b.com):
 *   1. Frontend opens /api/auth/user-connect?provider=github|google
 *   2. Server → getOAuthUrl() → https://must-b.com/auth/oauth?provider=...&callback=...
 *   3. must-b.com OAuth consent → redirects to /api/auth/callback?access_token=...
 *   4. /api/auth/callback validates token → signInFromCallback() → config.json
 *   5. Socket.io 'authStateChanged' → UserProfilePanel refreshes
 *
 * Session storage: STORAGE_ROOT/config.json
 *   Windows  → %APPDATA%/must-b/config.json
 *   Linux/mac → ~/.config/must-b/config.json
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

/** Params received from must-b.com OAuth callback (query-string or JSON body) */
export interface CallbackParams {
  access_token:   string;
  refresh_token?: string;
  /**
   * Token expiry — accepts either:
   *   ISO-8601 string  ("2026-04-02T18:00:00.000Z")
   *   Unix timestamp   (1743609600)           ← seconds since epoch
   *   seconds-from-now (3600)                 ← OAuth "expires_in" style
   */
  expires_at?:    string | number;
  /** Seconds until expiry — alternative to expires_at */
  expires_in?:    string | number;
  user_id?:       string;
  user_email?:    string;
  user_name?:     string;
  user_avatar?:   string;
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
 *
 * Live endpoint: https://must-b.com/auth/oauth
 * Override with MUSTB_CLOUD_URL env var for staging/local must-b server development.
 *
 * Params sent to must-b.com:
 *   provider  — 'github' | 'google'
 *   callback  — full URL of /api/auth/callback on this local server
 */
export function getOAuthUrl(provider: OAuthProvider, callbackBase: string): string {
  const base = process.env.MUSTB_CLOUD_URL
    ? `${process.env.MUSTB_CLOUD_URL.replace(/\/$/, '')}/auth/oauth`
    : 'https://must-b.com/auth/oauth';
  const url = new URL(base);
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
 * Normalise any expiry representation to an ISO-8601 string.
 *
 * Handles three formats sent by OAuth providers:
 *   ISO string   → used as-is
 *   Unix epoch   → converted (values > 1e9 are seconds since epoch)
 *   seconds-from-now → Date.now() + value * 1000
 */
function _normaliseExpiry(raw: string | number | undefined, fallbackSecs = 3600): string {
  if (!raw) return new Date(Date.now() + fallbackSecs * 1000).toISOString();

  if (typeof raw === 'string') {
    // Already ISO? Quick-validate by parsing
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    // Might be a numeric string
    raw = Number(raw);
  }

  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    // Heuristic: Unix epoch timestamps are > 1 Jan 2000 (946684800 seconds)
    if (raw > 946_684_800) return new Date(raw * 1000).toISOString();
    // Otherwise treat as seconds-from-now (OAuth "expires_in")
    return new Date(Date.now() + raw * 1000).toISOString();
  }

  return new Date(Date.now() + fallbackSecs * 1000).toISOString();
}

/**
 * Process the OAuth callback params received from must-b.com.
 * Creates a session, persists it to STORAGE_ROOT/config.json,
 * and emits SIGNED_IN to all listeners.
 *
 * Normalises expires_at / expires_in into ISO-8601 before storing.
 */
export async function signInFromCallback(
  params: CallbackParams,
): Promise<AuthResult<MustbSession>> {
  const expiresAt = _normaliseExpiry(params.expires_at ?? params.expires_in);

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
