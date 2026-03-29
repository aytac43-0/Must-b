/**
 * Must-b UniversalStore / ConfigStore (v1.5.0-alpha.1)
 *
 * Must-b Native Config Architecture.
 * Provides secure env-var management, auth-profile rotation, and config persistence.
 * Config home: MUSTB_HOME env var (default ~/.mustb/)
 */
import fs    from 'fs';
import path  from 'path';
import os    from 'os';
import dotenv from 'dotenv';

// ── MUSTB_HOME ─────────────────────────────────────────────────────────────────
export function getMustbHome(): string {
  return process.env.MUSTB_HOME ?? path.join(os.homedir(), '.mustb');
}

// ── Dangerous env var blocking ─────────────────────────────────────────────────
// Prevents config files from overriding critical system / loader environment variables.
// Prevents config files from overriding critical system / loader environment variables.
const BLOCKED_ENV_NAMES = new Set([
  'HOME', 'USER', 'SHELL', 'PATH', 'TERM', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TMP', 'TEMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'SYSTEMROOT', 'WINDIR', 'COMPUTERNAME', 'USERNAME',
  'NODE_PATH', 'NODE_ENV', 'npm_config_prefix', 'npm_execpath',
]);
const BLOCKED_ENV_PREFIXES = ['LD_', 'DYLD_', 'PYTHONPATH', 'CLASSPATH', 'JAVA_'];

export function isDangerousEnvVar(key: string): boolean {
  if (BLOCKED_ENV_NAMES.has(key)) return true;
  return BLOCKED_ENV_PREFIXES.some(pfx => key.startsWith(pfx));
}

// ── Auth Profile Store ─────────────────────────────────────────────────────────
// Persists multiple API keys per provider at ~/.mustb/auth-profiles.json,
// enabling in-process key rotation without touching .env.

export interface MustbAuthProfile {
  provider: string;
  /** Ordered list of API keys available for this provider. */
  keys: string[];
  /** Index of the currently active key. */
  activeIndex: number;
  lastUpdated: string;
}

export interface MustbAuthStore {
  version: 2;
  profiles: Record<string, MustbAuthProfile>;
  updatedAt: string;
}

function authStorePath(): string {
  return path.join(getMustbHome(), 'auth-profiles.json');
}

function emptyStore(): MustbAuthStore {
  return { version: 2, profiles: {}, updatedAt: new Date().toISOString() };
}

export function loadAuthStore(): MustbAuthStore {
  try {
    const p = authStorePath();
    if (!fs.existsSync(p)) return emptyStore();
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as MustbAuthStore;
    return parsed?.version === 2 ? parsed : emptyStore();
  } catch { return emptyStore(); }
}

export function saveAuthStore(store: MustbAuthStore): void {
  try {
    const dir = getMustbHome();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(authStorePath(), JSON.stringify(store, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

/** Add an API key to a provider's rotation pool (no-op if already present). */
export function registerProviderKey(provider: string, key: string): void {
  if (!key?.trim()) return;
  const store = loadAuthStore();
  const p = store.profiles[provider];
  if (p) {
    if (!p.keys.includes(key)) { p.keys.push(key); p.lastUpdated = new Date().toISOString(); }
  } else {
    store.profiles[provider] = {
      provider, keys: [key], activeIndex: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
  saveAuthStore(store);
}

/** Advance to the next API key in the provider's rotation pool. Returns the new key or null. */
export function rotateProviderKey(provider: string): string | null {
  const store = loadAuthStore();
  const p = store.profiles[provider];
  if (!p || p.keys.length < 2) return null;
  p.activeIndex = (p.activeIndex + 1) % p.keys.length;
  p.lastUpdated = new Date().toISOString();
  saveAuthStore(store);
  return p.keys[p.activeIndex];
}

/**
 * Collect all available keys for a given env-var base name.
 * Reads VAR_NAME, VAR_NAME_2, VAR_NAME_3 … VAR_NAME_5 from process.env.
 * Scans VAR_NAME, VAR_NAME_2 … VAR_NAME_5 for key rotation.
 */
export function resolveEnvKeys(baseEnvVar: string): string[] {
  const keys: string[] = [];
  const primary = process.env[baseEnvVar];
  if (primary?.trim()) keys.push(primary.trim());
  for (let i = 2; i <= 5; i++) {
    const v = process.env[`${baseEnvVar}_${i}`];
    if (v?.trim()) keys.push(v.trim());
  }
  return keys;
}

// ── Dot-notation config path access ───────────────────────────────────────────
// Dot-notation path accessor.

export function getConfigAtPath(obj: Record<string, any>, dotPath: string): any {
  return dotPath.split('.').reduce(
    (cur: any, part: string) =>
      (cur != null && typeof cur === 'object' ? cur[part] : undefined),
    obj,
  );
}

export function setConfigAtPath(obj: Record<string, any>, dotPath: string, value: any): void {
  const parts = dotPath.split('.');
  let cur: Record<string, any> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Config env-var application ─────────────────────────────────────────────────
// Applies config-sourced vars to process.env, skipping dangerous overrides
// and unresolved ${VAR} placeholder references.

const ENV_REF_RE = /\$\{[A-Z0-9_]+\}/;

export function applyConfigEnvVars(
  vars: Record<string, string>,
  target: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, value] of Object.entries(vars)) {
    if (!key || !value?.trim()) continue;
    if (isDangerousEnvVar(key)) continue;
    if (ENV_REF_RE.test(value)) continue;  // skip literal ${VAR} placeholders
    if (target[key]?.trim()) continue;     // don't override already-set vars
    target[key] = value;
  }
}

// ── .env hot-reload ────────────────────────────────────────────────────────────
// Reloads .env from disk, applying only safe (non-dangerous) variables.
// .env hot-reload — reloads vars from disk, skipping dangerous overrides.

export function reloadEnvFile(envPath?: string): void {
  try {
    const p = envPath ?? path.join(process.cwd(), '.env');
    if (!fs.existsSync(p)) return;
    const parsed = dotenv.parse(fs.readFileSync(p, 'utf-8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (isDangerousEnvVar(key)) continue;
      process.env[key] = value;
    }
  } catch { /* best-effort */ }
}

// ── UniversalStore singleton ────────────────────────────────────────────────────
// Central config/state hub for Must-b.
// Merges runtime overrides, auth profiles, and process.env into a single source of truth.

export class UniversalStore {
  private static _instance: UniversalStore | null = null;
  private _runtime: Map<string, string> = new Map();

  private constructor() { dotenv.config({ override: true }); }

  static get(): UniversalStore {
    if (!UniversalStore._instance) UniversalStore._instance = new UniversalStore();
    return UniversalStore._instance;
  }

  /** Lookup order: runtime override → process.env */
  get(key: string): string | undefined {
    return this._runtime.get(key) ?? process.env[key];
  }

  /** Set a runtime-only override (also writes to process.env, blocks dangerous vars). */
  set(key: string, value: string): void {
    if (isDangerousEnvVar(key)) return;
    this._runtime.set(key, value);
    process.env[key] = value;
  }

  /** Reload .env from disk. */
  reload(envPath?: string): void { reloadEnvFile(envPath); }

  /** MUSTB_HOME directory (e.g. ~/.mustb or $MUSTB_HOME). */
  get home(): string { return getMustbHome(); }

  /**
   * Resolve the best available API key for a provider.
   * Priority: runtime override → auth profile store → env var (+ suffixed variants).
   */
  resolveApiKey(provider: string, baseEnvVar: string): string {
    const rt = this._runtime.get(baseEnvVar);
    if (rt?.trim()) return rt;

    const store = loadAuthStore();
    const profile = store.profiles[provider];
    if (profile?.keys.length) {
      const k = profile.keys[profile.activeIndex] ?? profile.keys[0];
      if (k?.trim()) return k;
    }

    return resolveEnvKeys(baseEnvVar)[0] ?? '';
  }

  /** Rotate to the next API key in the provider's pool. Returns new key or null. */
  rotateKey(provider: string): string | null {
    return rotateProviderKey(provider);
  }
}
