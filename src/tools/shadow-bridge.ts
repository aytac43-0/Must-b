/**
 * Shadow Bridge (v4.9) — Parallel Ghosting
 *
 * Shared state + EventEmitter for Shadow Mode.
 * Imported by both browser.ts (writes state) and input.ts (reads state).
 * Kept as a thin module to avoid circular dependencies.
 *
 * v4.9 upgrade: Multi-Context support — up to 3 simultaneous ghost windows.
 *   Each GhostContext has its own page, browser, interval, and URL.
 *   The "active" slot (index 0–2) receives OS input routing.
 *
 * Events:
 *   'shadowFrame'   { base64, ts, slot }         — 500ms JPEG frames per slot
 *   'shadowToggle'  { enabled, slot? }            — slot toggled on/off
 *   'shadowNav'     { url, slot }                 — URL changed
 *   'ghostSlot'     { slot, active }              — active input slot changed
 */

import { EventEmitter } from 'events';

export const shadowBridge = new EventEmitter();
shadowBridge.setMaxListeners(30);

// ── Single-context state (v4.8 compatibility) ─────────────────────────────

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

// ── Multi-Context Ghost Pool (v4.9) ──────────────────────────────────────

export const MAX_GHOST_SLOTS = 3;

export interface GhostContext {
  slot:     number;
  page:     any | null;
  browser:  any | null;
  url:      string;
  enabled:  boolean;
  /** setInterval handle for the mirror loop */
  interval: ReturnType<typeof setInterval> | null;
}

/** Ghost pool: up to 3 parallel headless browser contexts */
const _ghostPool: GhostContext[] = Array.from({ length: MAX_GHOST_SLOTS }, (_, i) => ({
  slot:     i,
  page:     null,
  browser:  null,
  url:      'about:blank',
  enabled:  false,
  interval: null,
}));

/** Slot index receiving OS-level input routing (0–2) */
let _activeSlot = 0;

export function getGhostPool(): Readonly<GhostContext[]> {
  return _ghostPool;
}

export function getGhostContext(slot: number): GhostContext | null {
  if (slot < 0 || slot >= MAX_GHOST_SLOTS) return null;
  return _ghostPool[slot];
}

export function setGhostContext(slot: number, patch: Partial<GhostContext>): void {
  if (slot < 0 || slot >= MAX_GHOST_SLOTS) return;
  Object.assign(_ghostPool[slot], patch);
}

/** Return the active ghost context (receives OS input routing) */
export function getActiveGhost(): GhostContext | null {
  const ctx = _ghostPool[_activeSlot];
  return ctx.enabled ? ctx : null;
}

/** Switch which ghost slot handles OS input routing */
export function setActiveSlot(slot: number): void {
  if (slot < 0 || slot >= MAX_GHOST_SLOTS) return;
  _activeSlot = slot;
  shadowBridge.emit('ghostSlot', { slot, active: true });
}

export function getActiveSlot(): number {
  return _activeSlot;
}

/** True if ANY ghost slot is currently active */
export function isAnyGhostActive(): boolean {
  return _ghostPool.some(g => g.enabled);
}
