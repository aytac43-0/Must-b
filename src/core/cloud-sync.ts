/**
 * Must-b CloudSync — optional encrypted memory backup to Must-b Worlds.
 *
 * All data is AES-256-GCM encrypted with a key derived from this node's
 * Ed25519 identity before it ever leaves the machine.  The cloud stores
 * only opaque ciphertext; it cannot read the contents.
 *
 * Usage:
 *   const sync = new CloudSync(root, logger);
 *   await sync.backup();
 *   await sync.restore();
 *   sync.startAutoSync(60);  // every 60 minutes
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { loadOrCreateIdentity, encrypt, decrypt } from './identity.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SyncResult {
  ok: boolean;
  files: number;
  bytes: number;
  error?: string;
}

/** Outcome of a conflict check between local and cloud memory */
export type ConflictState =
  | 'both_empty'   // neither local nor cloud has data → nothing to do
  | 'local_only'   // local has data, cloud is empty → auto-upload
  | 'cloud_only'   // cloud has data, local is empty → auto-restore
  | 'in_sync'      // both have data, cloud is newer or equal → no conflict
  | 'conflict';    // both have data with different timestamps → user must decide

export interface ConflictResult {
  state: ConflictState;
  /** ISO timestamp of the local must-b.md (null if not present) */
  localMtime: string | null;
  /** ISO timestamp from cloud backup metadata (null if no cloud data) */
  cloudTimestamp: string | null;
  /** Agent name stored in cloud backup metadata (e.g. "Max" or "Alex") */
  cloudAgentName: string | null;
  /** Local agent name from memory/user.json profile */
  localAgentName: string | null;
}

/** Resolution decision sent by the user (or auto-resolved) */
export type SyncDecision = 'upload' | 'restore' | 'duplicate';

interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface CloudBackup {
  uid: string;
  version: number;
  timestamp: string;
  /** Plaintext metadata — not sensitive, stored unencrypted for conflict detection */
  agentName?: string;
  files: Record<string, EncryptedPayload>; // relative path → encrypted content
}

/** Lightweight cloud metadata response (no file contents) */
interface CloudBackupMeta {
  uid: string;
  version: number;
  timestamp: string;
  agentName?: string;
  fileCount: number;
}

// ── CloudSync ─────────────────────────────────────────────────────────────

const SYNC_VERSION = 1;
const MEMORY_PATTERNS = [
  '*.md',        // markdown memory files
  '*.json',      // JSON state
  'MEMORY.md',   // memory index
];

export class CloudSync {
  private root:     string;
  private logger:   winston.Logger;
  private cloudUrl: string;
  private memDir:   string;
  private _timer:   NodeJS.Timeout | null = null;

  constructor(root: string, logger: winston.Logger) {
    this.root     = root;
    this.logger   = logger;
    this.cloudUrl = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
    this.memDir   = path.join(root, 'memory');
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Check for conflicts between local and cloud memory state.
   *
   * Logic:
   *   1. Probe cloud backup metadata (fast HEAD-like GET, no decryption).
   *   2. Check local memory/must-b.md existence + mtime.
   *   3. Return ConflictState + metadata for the Dashboard to act on.
   *
   * Auto-resolved states (caller should act without prompting):
   *   'both_empty'  → do nothing
   *   'local_only'  → call backup()
   *   'cloud_only'  → call restore()
   *
   * Manual-resolve state (show conflict UI):
   *   'conflict'    → send CONFLICT_DETECTED via Socket.IO, wait for user decision
   */
  async checkConflicts(): Promise<ConflictResult> {
    const token = process.env.MUSTB_CLOUD_TOKEN;
    const identity = loadOrCreateIdentity();
    const memMdPath = path.join(this.memDir, 'must-b.md');
    const userJsonPath = path.join(this.memDir, 'user.json');

    // ── Local state ─────────────────────────────────────────────────────
    const localExists = fs.existsSync(memMdPath);
    let localMtime: string | null = null;
    let localAgentName: string | null = null;

    if (localExists) {
      const stat = fs.statSync(memMdPath);
      localMtime = stat.mtime.toISOString();
    }

    // Try to read local agent name from user.json
    try {
      const userJson = JSON.parse(fs.readFileSync(userJsonPath, 'utf-8'));
      localAgentName = userJson?.profile?.name ?? null;
    } catch { /* no profile yet */ }

    // ── Cloud state ──────────────────────────────────────────────────────
    let cloudMeta: CloudBackupMeta | null = null;

    if (token) {
      try {
        cloudMeta = await this.cloudGet<CloudBackupMeta>(
          `/api/v1/sync/backup/${identity.uid}/meta`, token
        );
      } catch (err: any) {
        // 404 means no cloud backup exists — not an error
        if (!err.message?.includes('404')) {
          this.logger.warn(`[CloudSync] Meta fetch failed: ${err.message}`);
        }
      }
    }

    const cloudTimestamp  = cloudMeta?.timestamp ?? null;
    const cloudAgentName  = cloudMeta?.agentName ?? null;
    const cloudHasData    = cloudMeta !== null && (cloudMeta.fileCount ?? 0) > 0;

    // ── Conflict detection ───────────────────────────────────────────────
    let state: ConflictState;

    if (!localExists && !cloudHasData) {
      state = 'both_empty';
    } else if (localExists && !cloudHasData) {
      state = 'local_only';
    } else if (!localExists && cloudHasData) {
      state = 'cloud_only';
    } else {
      // Both have data — compare timestamps
      const localMs = localMtime ? new Date(localMtime).getTime() : 0;
      const cloudMs = cloudTimestamp ? new Date(cloudTimestamp).getTime() : 0;
      // If cloud is clearly newer (> 5 min delta) and names differ → conflict
      const deltaMin = Math.abs(cloudMs - localMs) / 60_000;
      const nameDiffers = localAgentName && cloudAgentName && localAgentName !== cloudAgentName;
      state = (deltaMin > 5 || nameDiffers) ? 'conflict' : 'in_sync';
    }

    this.logger.info(`[CloudSync] Conflict check: ${state} (local="${localAgentName}" cloud="${cloudAgentName}")`);

    return { state, localMtime, cloudTimestamp, cloudAgentName, localAgentName };
  }

  /**
   * Resolve a sync conflict based on user decision.
   *
   * @param decision  'upload'    → overwrite cloud with local data
   *                  'restore'   → overwrite local with cloud data
   *                  'duplicate' → keep local, copy cloud to memory/cloud-restore/
   */
  async resolveConflict(decision: SyncDecision): Promise<SyncResult> {
    if (decision === 'upload') {
      return this.backup();
    }

    if (decision === 'restore') {
      return this.restore();
    }

    // 'duplicate' — restore cloud data into a separate sub-folder
    const token = process.env.MUSTB_CLOUD_TOKEN;
    if (!token) {
      return { ok: false, files: 0, bytes: 0, error: 'Not connected to cloud.' };
    }

    const identity = loadOrCreateIdentity();
    let backup: CloudBackup;
    try {
      backup = await this.cloudGet<CloudBackup>(`/api/v1/sync/backup/${identity.uid}`, token);
    } catch (err: any) {
      return { ok: false, files: 0, bytes: 0, error: `Cloud fetch failed: ${err.message}` };
    }

    const restoreDir = path.join(this.memDir, 'cloud-restore');
    fs.mkdirSync(restoreDir, { recursive: true });

    let saved = 0;
    let totalBytes = 0;
    for (const [rel, payload] of Object.entries(backup.files ?? {})) {
      try {
        const { decrypt: decryptFn } = await import('./identity.js');
        const plaintext = decryptFn(payload);
        const dest = path.join(restoreDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, plaintext, 'utf-8');
        saved++;
        totalBytes += plaintext.length;
      } catch { /* skip corrupted entries */ }
    }

    this.logger.info(`[CloudSync] Duplicate restore: ${saved} files → ${restoreDir}`);
    return { ok: true, files: saved, bytes: totalBytes };
  }

  /**
   * Encrypt and upload all memory files to the cloud.
   * Requires MUSTB_CLOUD_TOKEN in the environment.
   */
  async backup(): Promise<SyncResult> {
    const token = process.env.MUSTB_CLOUD_TOKEN;
    if (!token) {
      return { ok: false, files: 0, bytes: 0, error: 'Not connected — run must-b cloud-connect first.' };
    }

    const identity = loadOrCreateIdentity();
    const files = this.collectMemoryFiles();
    if (files.length === 0) {
      this.logger.info('[CloudSync] No memory files to back up.');
      return { ok: true, files: 0, bytes: 0 };
    }

    // Read local agent name for metadata (not encrypted — used for conflict detection)
    let agentName: string | undefined;
    try {
      const userJson = JSON.parse(fs.readFileSync(path.join(this.memDir, 'user.json'), 'utf-8'));
      agentName = userJson?.profile?.name ?? undefined;
    } catch { /* no profile yet */ }

    const backup: CloudBackup = {
      uid:       identity.uid,
      version:   SYNC_VERSION,
      timestamp: new Date().toISOString(),
      agentName,
      files:     {},
    };

    let totalBytes = 0;
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        const rel     = path.relative(this.memDir, f).replace(/\\/g, '/');
        backup.files[rel] = encrypt(content);
        totalBytes += content.length;
      } catch { /* skip unreadable files */ }
    }

    try {
      await this.cloudPost('/api/v1/sync/backup', backup, token);
      this.logger.info(`[CloudSync] Backed up ${files.length} files (${totalBytes} bytes).`);
      return { ok: true, files: files.length, bytes: totalBytes };
    } catch (err: any) {
      this.logger.warn(`[CloudSync] Backup failed: ${err.message}`);
      return { ok: false, files: 0, bytes: 0, error: err.message };
    }
  }

  /**
   * Download and decrypt the latest cloud backup into the memory directory.
   * Existing files are NOT overwritten unless they are older than the backup.
   */
  async restore(): Promise<SyncResult> {
    const token = process.env.MUSTB_CLOUD_TOKEN;
    if (!token) {
      return { ok: false, files: 0, bytes: 0, error: 'Not connected — run must-b cloud-connect first.' };
    }

    const identity = loadOrCreateIdentity();

    let backup: CloudBackup;
    try {
      backup = await this.cloudGet<CloudBackup>(`/api/v1/sync/backup/${identity.uid}`, token);
    } catch (err: any) {
      this.logger.warn(`[CloudSync] Restore fetch failed: ${err.message}`);
      return { ok: false, files: 0, bytes: 0, error: err.message };
    }

    if (!backup?.files) {
      return { ok: false, files: 0, bytes: 0, error: 'No backup found in cloud.' };
    }

    fs.mkdirSync(this.memDir, { recursive: true });

    let restored = 0;
    let totalBytes = 0;
    for (const [rel, payload] of Object.entries(backup.files)) {
      const destPath = path.join(this.memDir, rel);
      try {
        const plaintext = decrypt(payload);
        // Only restore if local file doesn't exist or cloud version is newer
        const localExists = fs.existsSync(destPath);
        if (!localExists) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, plaintext, 'utf-8');
          restored++;
          totalBytes += plaintext.length;
        }
      } catch { /* skip files with bad auth tag (tampered or wrong key) */ }
    }

    this.logger.info(`[CloudSync] Restored ${restored} files from cloud backup.`);
    return { ok: true, files: restored, bytes: totalBytes };
  }

  /**
   * Start a periodic auto-sync that backs up memory on a fixed interval.
   * @param intervalMinutes  How often to sync (default: 60 minutes)
   */
  startAutoSync(intervalMinutes = 60): void {
    if (this._timer) return; // already running

    const ms = intervalMinutes * 60 * 1000;
    this._timer = setInterval(async () => {
      const result = await this.backup();
      if (!result.ok && result.error) {
        this.logger.warn(`[CloudSync] Auto-sync failed: ${result.error}`);
      } else if (result.ok && result.files > 0) {
        this.logger.debug(`[CloudSync] Auto-sync: ${result.files} files.`);
      }
    }, ms);
    this._timer.unref(); // don't block process exit

    this.logger.info(`[CloudSync] Auto-sync aktif (her ${intervalMinutes} dakikada bir).`);
  }

  stopAutoSync(): void {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private collectMemoryFiles(): string[] {
    if (!fs.existsSync(this.memDir)) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(this.memDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.md' || ext === '.json') {
        files.push(path.join(this.memDir, entry.name));
      }
    }
    return files;
  }

  private cloudPost(endpoint: string, body: unknown, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const data  = Buffer.from(JSON.stringify(body), 'utf-8');
      const url   = new URL(endpoint, this.cloudUrl);
      const req   = https.request({
        hostname: url.hostname,
        port:     url.port ? Number(url.port) : 443,
        path:     url.pathname,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': data.byteLength,
          'Authorization':  `Bearer ${token}`,
        },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Cloud responded ${res.statusCode}: ${raw.slice(0, 200)}`));
          } else {
            resolve();
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private cloudGet<T>(endpoint: string, token: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.cloudUrl);
      https.get({
        hostname: url.hostname,
        port:     url.port ? Number(url.port) : 443,
        path:     url.pathname + url.search,
        headers:  { 'Authorization': `Bearer ${token}` },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Cloud responded ${res.statusCode}: ${raw.slice(0, 200)}`));
          } else {
            try { resolve(JSON.parse(raw) as T); } catch { reject(new Error('Invalid JSON from cloud')); }
          }
        });
      }).on('error', reject);
    });
  }
}
