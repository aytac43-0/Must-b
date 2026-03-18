/**
 * Shadow Bridge (v4.8)
 *
 * Shared state + EventEmitter for Shadow Mode.
 * Imported by both browser.ts (writes state) and input.ts (reads state).
 * Kept as a thin module to avoid circular dependencies.
 *
 * Events:
 *   'shadowFrame'  { base64: string, ts: number }   — 500ms JPEG frames
 *   'shadowToggle' { enabled: boolean }              — mode changed
 */

import { EventEmitter } from 'events';

export const shadowBridge = new EventEmitter();
shadowBridge.setMaxListeners(20);

// ── State ─────────────────────────────────────────────────────────────────────

interface ShadowState {
  enabled:  boolean;
  /** Active Playwright Page — typed as any to avoid importing playwright here */
  page:     any | null;
  /** Active Playwright Browser */
  browser:  any | null;
  /** Current page URL */
  url:      string;
}

const _state: ShadowState = {
  enabled: false,
  page:    null,
  browser: null,
  url:     'about:blank',
};

export function getShadowState(): Readonly<ShadowState> {
  return _state;
}

export function setShadowState(patch: Partial<ShadowState>): void {
  Object.assign(_state, patch);
}
