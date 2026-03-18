/**
 * Must-b Remote Access (v4.6)
 *
 * Short-lived mobile pairing tokens stored in-process.
 * generateMobileToken()  → { token, url, expiresAt }
 * validateMobileToken()  → true | false
 * expireTokens()         → cleans up stale entries (called automatically)
 *
 * Tokens are 32-byte hex strings valid for TOKEN_TTL_MS (15 minutes).
 * The pairing URL encodes the token so mobile browsers can auto-connect.
 */

import os     from 'os';
import crypto from 'crypto';

// ── Config ───────────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 15 * 60 * 1_000; // 15 minutes

// ── Token store ──────────────────────────────────────────────────────────────

interface TokenEntry {
  token:     string;
  expiresAt: number;
}

const _tokens = new Map<string, TokenEntry>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of _tokens) {
    if (v.expiresAt <= now) _tokens.delete(k);
  }
}

// ── Local IP detection ───────────────────────────────────────────────────────

/**
 * Returns the most probable LAN IPv4 address of this machine.
 * Falls back to '127.0.0.1' if nothing is found.
 */
export function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name];
    if (!list) continue;
    // Prefer non-loopback, non-internal IPv4 addresses
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface MobileToken {
  token:     string;
  url:       string;
  expiresAt: number; // unix ms
}

/**
 * Generate a new short-lived mobile pairing token.
 * @param port  The port Must-b server is listening on.
 */
export function generateMobileToken(port: number): MobileToken {
  purgeExpired();

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  _tokens.set(token, { token, expiresAt });

  const ip  = getLocalIP();
  const url = `http://${ip}:${port}/mobile?token=${token}`;

  return { token, url, expiresAt };
}

/**
 * Validate a mobile pairing token.
 * Returns true if the token exists and has not expired.
 */
export function validateMobileToken(token: string): boolean {
  purgeExpired();
  const entry = _tokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    _tokens.delete(token);
    return false;
  }
  return true;
}

/**
 * Revoke a specific token (e.g. after pairing is complete).
 */
export function revokeToken(token: string): void {
  _tokens.delete(token);
}
