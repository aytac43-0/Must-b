/**
 * Must-b Identity — Persistent cryptographic identity for each installation.
 *
 * Generates and stores:
 *   - MUSTB_UID  : stable UUID that identifies this node globally
 *   - Ed25519 key pair: used for signing payloads and deriving encryption keys
 *
 * Identity is stored in ~/.mustb/identity.json and survives upgrades.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────

export type HardwareTier = 'Macro' | 'Mini' | 'Normal' | 'Pro' | 'Ultra' | 'Ultra Max';

export interface Identity {
  uid: string;
  publicKey: string;   // base64-encoded DER
  privateKey: string;  // base64-encoded DER (PKCS8, stored locally only)
  createdAt: string;
  version: number;
  hardwareTier?: HardwareTier;
  hardwareScore?: number;
}

// ── Storage ───────────────────────────────────────────────────────────────

const IDENTITY_DIR  = path.join(os.homedir(), '.mustb');
const IDENTITY_FILE = path.join(IDENTITY_DIR, 'identity.json');
const IDENTITY_VERSION = 1;

let _cached: Identity | null = null;

// ── Core ──────────────────────────────────────────────────────────────────

/**
 * Load the existing identity from disk, or create a new one if none exists.
 * The returned identity is cached in-process for subsequent calls.
 */
export function loadOrCreateIdentity(): Identity {
  if (_cached) return _cached;

  // Try to load from disk
  try {
    const raw = fs.readFileSync(IDENTITY_FILE, 'utf-8');
    const id = JSON.parse(raw) as Identity;
    if (id.uid && id.publicKey && id.privateKey && id.version === IDENTITY_VERSION) {
      _cached = id;
      return id;
    }
  } catch { /* file missing or corrupted — generate fresh */ }

  // Generate new identity
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding:  { type: 'spki',  format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const identity: Identity = {
    uid:        crypto.randomUUID(),
    publicKey:  Buffer.from(publicKey).toString('base64'),
    privateKey: Buffer.from(privateKey).toString('base64'),
    createdAt:  new Date().toISOString(),
    version:    IDENTITY_VERSION,
  };

  try {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2) + '\n', {
      mode: 0o600, // owner read/write only
    });
  } catch (err: any) {
    // Non-fatal: we can still operate without persisting to disk
    process.stderr.write(`[identity] Warning: could not persist identity: ${err.message}\n`);
  }

  _cached = identity;
  return identity;
}

/** Return the cached identity (throws if loadOrCreateIdentity was never called). */
export function getIdentity(): Identity {
  if (!_cached) return loadOrCreateIdentity();
  return _cached;
}

// ── Crypto Helpers ────────────────────────────────────────────────────────

/**
 * Sign arbitrary data with this installation's Ed25519 private key.
 * Returns a base64-encoded signature.
 */
export function sign(data: string | Buffer): string {
  const id = getIdentity();
  const keyObj = crypto.createPrivateKey({
    key:    Buffer.from(id.privateKey, 'base64'),
    format: 'der',
    type:   'pkcs8',
  });
  const sig = crypto.sign(null, Buffer.isBuffer(data) ? data : Buffer.from(data), keyObj);
  return sig.toString('base64');
}

/**
 * Verify a signature produced by this installation.
 * Returns true if the signature is valid.
 */
export function verify(data: string | Buffer, signature: string): boolean {
  const id = getIdentity();
  const keyObj = crypto.createPublicKey({
    key:    Buffer.from(id.publicKey, 'base64'),
    format: 'der',
    type:   'spki',
  });
  try {
    return crypto.verify(
      null,
      Buffer.isBuffer(data) ? data : Buffer.from(data),
      keyObj,
      Buffer.from(signature, 'base64')
    );
  } catch { return false; }
}

/**
 * Derive a 32-byte AES encryption key from the Ed25519 private key.
 * Uses HKDF with a domain-separation salt so the derived key is independent
 * of the signing key.
 */
export function deriveEncryptionKey(): Buffer {
  const id = getIdentity();
  const ikm = Buffer.from(id.privateKey, 'base64');
  return Buffer.from(crypto.hkdfSync("sha256", ikm, "mustb-cloudsync-v1", "", 32));
}

/**
 * AES-256-GCM encrypt.  Returns { iv, tag, ciphertext } as base64 strings.
 */
export function encrypt(plaintext: string): { iv: string; tag: string; ciphertext: string } {
  const key = deriveEncryptionKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return {
    iv:         iv.toString('base64'),
    tag:        cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
  };
}

// ── Hardware Scoring ──────────────────────────────────────────────────────

/**
 * Computes a hardware score based on total RAM and logical CPU count,
 * assigns a tier label, and persists both to identity.json.
 *
 * Tiers:
 *   Macro     — score < 6   (< 4 GB RAM, 1-2 CPUs)
 *   Mini      — score 6-11  (~4-8 GB, 2-4 CPUs)
 *   Normal    — score 12-19 (~8-16 GB, 4-6 CPUs)
 *   Pro       — score 20-31 (~16-24 GB, 6-8 CPUs)
 *   Ultra     — score 32-47 (~24-32 GB, 8-12 CPUs)
 *   Ultra Max — score ≥ 48  (32 GB+, 12+ CPUs)
 */
export function getHardwareScore(): { score: number; tier: HardwareTier } {
  const ramGB    = os.totalmem() / (1024 ** 3);
  const cpuCount = os.cpus().length;
  const score    = Math.floor(ramGB) + cpuCount;

  let tier: HardwareTier;
  if      (score < 6)  tier = 'Macro';
  else if (score < 12) tier = 'Mini';
  else if (score < 20) tier = 'Normal';
  else if (score < 32) tier = 'Pro';
  else if (score < 48) tier = 'Ultra';
  else                 tier = 'Ultra Max';

  // Persist to identity.json
  const identity = loadOrCreateIdentity();
  identity.hardwareScore = score;
  identity.hardwareTier  = tier;
  try {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2) + '\n', { mode: 0o600 });
  } catch { /* best-effort */ }

  return { score, tier };
}

/**
 * AES-256-GCM decrypt.  Throws on tag mismatch (tampered data).
 */
export function decrypt(payload: { iv: string; tag: string; ciphertext: string }): string {
  const key    = deriveEncryptionKey();
  const iv     = Buffer.from(payload.iv,         'base64');
  const tag    = Buffer.from(payload.tag,        'base64');
  const ct     = Buffer.from(payload.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
}
