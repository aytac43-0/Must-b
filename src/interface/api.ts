import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import winston from 'winston';

import { Orchestrator, type PlanStep } from '../core/orchestrator.js';
import { SessionHistory } from '../memory/history.js';
import { LongTermMemory } from '../memory/long-term.js';
import { runDoctor } from '../commands/doctor.js';
import { loadOrCreateIdentity, sign, getHardwareScore } from '../core/identity.js';
import { MODELS_LIST, CLOUD_MODELS_LIST } from '../core/models-catalog.js';
import { recommendModels, getPerformancePrediction } from '../utils/hardware.js';
import { ensureModel } from '../commands/doctor.js';
import { CloudSync, type SyncDecision } from '../core/cloud-sync.js';
import { getAgentRole, getNodeCard, canRouteTo } from '../core/hierarchy.js';
import { getSkillsMarket, publishSkill } from '../commands/doctor.js';

/** One-time random local auth token — valid for this process lifetime */
const LOCAL_TOKEN = process.env.MUSTB_LOCAL_TOKEN ?? crypto.randomBytes(16).toString('hex');

// ── Workspace file listing helper (v4.3) ─────────────────────────────────

interface WsFile { name: string; rel: string; ext: string; size: number; mtime: string; }

async function listWorkspaceFiles(
  root: string, dir: string, depth: number, maxDepth: number,
): Promise<WsFile[]> {
  if (depth > maxDepth) return [];
  let entries: import('fs').Dirent[];
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
  catch { return []; }

  const results: WsFile[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (e.isDirectory()) {
      results.push(...await listWorkspaceFiles(root, abs, depth + 1, maxDepth));
    } else if (e.isFile()) {
      const st  = await fs.promises.stat(abs).catch(() => null);
      const ext = path.extname(e.name).toLowerCase().slice(1);
      results.push({ name: e.name, rel, ext, size: st?.size ?? 0, mtime: st?.mtime.toISOString() ?? '' });
    }
  }
  return results;
}

/** In-memory local chat store (replaces Supabase dependency) */
interface LocalChat {
  id: string;
  title: string;
  created_at: string;
}
const localChats: LocalChat[] = [];

// ── Channel Registry ──────────────────────────────────────────────────────
// Defines every messaging channel the dashboard can manage.
// envKey: the primary .env variable that indicates the channel is configured.
// configFields: additional fields saved to .env when the user configures a channel.

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  envKey: string;
  configFields: string[];
  requiresMac: boolean;
  docsUrl: string;
}

const CHANNEL_REGISTRY: ChannelDef[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp Business Cloud API — send and receive messages from WhatsApp numbers.',
    envKey: 'WHATSAPP_PHONE_NUMBER_ID',
    configFields: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
    requiresMac: false,
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Telegram Bot API — create a bot and connect it to Must-b.',
    envKey: 'TELEGRAM_BOT_TOKEN',
    configFields: ['TELEGRAM_BOT_TOKEN'],
    requiresMac: false,
    docsUrl: 'https://core.telegram.org/bots/api',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack Workspace Bot — respond to messages in your Slack workspace.',
    envKey: 'SLACK_BOT_TOKEN',
    configFields: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'],
    requiresMac: false,
    docsUrl: 'https://api.slack.com/start',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    description: 'iMessage via BlueBubbles relay — requires macOS + BlueBubbles server.',
    envKey: 'BLUEBUBBLES_URL',
    configFields: ['BLUEBUBBLES_URL', 'BLUEBUBBLES_PASSWORD'],
    requiresMac: true,
    docsUrl: 'https://bluebubbles.app',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Discord Bot — join servers and reply to messages.',
    envKey: 'DISCORD_BOT_TOKEN',
    configFields: ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'],
    requiresMac: false,
    docsUrl: 'https://discord.com/developers/docs/intro',
  },
];

/** Pending OAuth state tokens — map of state → { timestamp, resolve } */
const _pendingCloudStates = new Map<string, { ts: number; resolve: (token: string) => void }>();

export class ApiServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private logger: winston.Logger;
  private orchestrator: Orchestrator;
  private history: SessionHistory;
  private port: number;

  constructor(
    logger: winston.Logger,
    orchestrator: Orchestrator,
    history: SessionHistory,
    port: number = 4309
  ) {
    this.logger = logger;
    this.orchestrator = orchestrator;
    this.history = history;
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, { cors: { origin: '*' } });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupOrchestratorListeners();
    this.setupInputEventBridge();
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    // Multipart raw body for /api/memory/import (handled inline, no heavy dep needed)
    this.app.use('/api/memory/import', express.raw({ type: '*/*', limit: '10mb' }));
    const frontendOut = path.join(process.cwd(), 'public', 'must-b-ui', 'out');
    this.app.use(express.static(frontendOut));
    // SPA fallback
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendOut, 'index.html'), (err) => {
        if (err) res.sendFile(path.join(frontendOut, '404.html'));
      });
    });
  }

  private setupRoutes() {
    // ── Health ────────────────────────────────────────────────────────────
    this.app.get('/api/status', (_req, res) => {
      res.json({ status: 'online', gateway: 'Must-b', port: this.port, timestamp: Date.now() });
    });

    // ── Identity — expose agent name for voice wake-word ─────────────────
    this.app.get('/api/identity', async (_req, res) => {
      try {
        const identity = await loadOrCreateIdentity();
        res.json({ name: identity.name, id: identity.id });
      } catch {
        res.json({ name: 'Must-b', id: '' });
      }
    });

    // ── Local-Auth handshake (localhost only) ─────────────────────────────
    this.app.get('/api/auth/local', (req, res) => {
      const ip = req.socket.remoteAddress ?? '';
      const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
      if (!isLocal) return res.status(403).json({ error: 'local access only' });
      res.json({ token: LOCAL_TOKEN, mode: 'local' });
    });

    // ── Cloud Auth Bridge ─────────────────────────────────────────────────
    const CLOUD_URL = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';

    /**
     * GET /api/auth/cloud-connect
     * Initiates the Must-b Worlds OAuth handshake.
     * - Generates a CSRF state token and signs it with this node's Ed25519 key
     * - Redirects the browser to CLOUD_URL/auth/connect with uid, state, sig, callback
     * - Resolves when the cloud calls back with a bearer token
     */
    this.app.get('/api/auth/cloud-connect', (req, res) => {
      const identity = loadOrCreateIdentity();
      const state    = crypto.randomBytes(24).toString('hex');
      const sig      = sign(state);
      const callback = `http://localhost:${this.port}/api/auth/cloud-callback`;

      // Store state with 10-minute TTL
      _pendingCloudStates.set(state, {
        ts: Date.now(),
        resolve: (token: string) => {
          // Persist cloud token to .env
          const root    = process.cwd();
          const envPath = path.join(root, '.env');
          let envContent = '';
          try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }
          const lines = envContent.split('\n');
          const idx   = lines.findIndex(l => l.startsWith('MUSTB_CLOUD_TOKEN='));
          if (idx >= 0) lines[idx] = `MUSTB_CLOUD_TOKEN=${token}`;
          else lines.push(`MUSTB_CLOUD_TOKEN=${token}`);
          fs.writeFileSync(envPath, lines.join('\n').trim() + '\n', 'utf-8');
          dotenv.config({ path: envPath, override: true });
          this.logger.info('[CloudAuth] Cloud token received and persisted.');
          this.io.emit('agentUpdate', { type: 'cloudConnected', uid: identity.uid });
        },
      });

      // Expire stale states after 10 minutes
      setTimeout(() => _pendingCloudStates.delete(state), 10 * 60 * 1000);

      const redirectUrl = new URL(`${CLOUD_URL}/auth/connect`);
      redirectUrl.searchParams.set('uid',      identity.uid);
      redirectUrl.searchParams.set('pub',      identity.publicKey);
      redirectUrl.searchParams.set('state',    state);
      redirectUrl.searchParams.set('sig',      sig);
      redirectUrl.searchParams.set('callback', callback);

      this.logger.info(`[CloudAuth] Redirecting to ${redirectUrl.hostname} for uid=${identity.uid}`);
      res.redirect(302, redirectUrl.toString());
    });

    /**
     * GET /api/auth/cloud-callback?state=...&token=...
     * Receives the OAuth callback from must-b.com.
     * Validates the state token, persists the cloud bearer token, and closes the browser tab.
     */
    this.app.get('/api/auth/cloud-callback', (req, res) => {
      const { state, token, error } = req.query as Record<string, string>;

      if (error) {
        this.logger.warn(`[CloudAuth] Callback error: ${error}`);
        return res.status(400).send(`<html><body><p>Auth failed: ${error}</p><script>setTimeout(()=>window.close(),2000)</script></body></html>`);
      }

      const pending = _pendingCloudStates.get(state);
      if (!pending) {
        return res.status(400).send('<html><body><p>Invalid or expired state.</p></body></html>');
      }

      _pendingCloudStates.delete(state);
      if (token) pending.resolve(token);

      res.send('<html><body><p>Must-b Worlds bağlantısı kuruldu! Bu sekmeyi kapatabilirsin.</p><script>setTimeout(()=>window.close(),1500)</script></body></html>');
    });

    // ── Auth middleware: localhost always passes, others need Bearer token ─
    const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = req.socket.remoteAddress ?? '';
      if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return next();
      if (req.headers.authorization === `Bearer ${LOCAL_TOKEN}`) return next();
      res.status(401).json({ error: 'Unauthorized — call /api/auth/local first' });
    };

    /** GET /api/auth/cloud-status — returns cloud connection state for dashboard */
    this.app.get('/api/auth/cloud-status', requireAuth, (_req, res) => {
      const identity = loadOrCreateIdentity();
      res.json({
        uid:       identity.uid,
        publicKey: identity.publicKey,
        connected: Boolean(process.env.MUSTB_CLOUD_TOKEN),
        cloudUrl:  process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com',
      });
    });

    // ── Chats (local store — no Supabase needed) ──────────────────────────
    this.app.get('/api/chats', requireAuth, (_req, res) => {
      res.json([...localChats].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 20));
    });

    this.app.post('/api/chats', requireAuth, (req, res) => {
      const title = String(req.body.title || 'New Chat');
      const chat: LocalChat = { id: crypto.randomUUID(), title, created_at: new Date().toISOString() };
      localChats.push(chat);
      res.json(chat);
    });

    this.app.patch('/api/chats/:id', requireAuth, (req, res) => {
      const chat = localChats.find(c => c.id === req.params.id);
      if (!chat) return res.status(404).json({ error: 'not found' });
      chat.title = String(req.body.title || chat.title);
      res.json(chat);
    });

    this.app.delete('/api/chats/:id', requireAuth, (req, res) => {
      const idx = localChats.findIndex(c => c.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: 'not found' });
      localChats.splice(idx, 1);
      res.json({ ok: true });
    });

    // ── Channel Management ────────────────────────────────────────────────

    /** GET /api/channels — list all supported channels with their config status */
    this.app.get('/api/channels', requireAuth, (_req, res) => {
      const root = process.cwd();
      const envPath = path.join(root, '.env');
      let envVars: Record<string, string> = {};
      try {
        envVars = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
      } catch { /* no .env yet */ }

      const channels = CHANNEL_REGISTRY.map((ch) => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        requiresMac: ch.requiresMac,
        docsUrl: ch.docsUrl,
        configured: Boolean(envVars[ch.envKey] && envVars[ch.envKey].length > 4),
        configFields: ch.configFields,
      }));
      res.json(channels);
    });

    /** GET /api/channels/:id/status — single channel config status */
    this.app.get('/api/channels/:id/status', requireAuth, (req, res) => {
      const ch = CHANNEL_REGISTRY.find(c => c.id === req.params.id);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });

      const root = process.cwd();
      const envPath = path.join(root, '.env');
      let envVars: Record<string, string> = {};
      try { envVars = dotenv.parse(fs.readFileSync(envPath, 'utf-8')); } catch { /* no .env */ }

      const configured = Boolean(envVars[ch.envKey] && envVars[ch.envKey].length > 4);
      const fields = Object.fromEntries(ch.configFields.map(f => [f, envVars[f] ? '***' : '']));
      res.json({ id: ch.id, configured, fields });
    });

    /** POST /api/channels/:id/configure — save channel credentials to .env */
    this.app.post('/api/channels/:id/configure', requireAuth, (req, res) => {
      const ch = CHANNEL_REGISTRY.find(c => c.id === req.params.id);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });

      const root = process.cwd();
      const envPath = path.join(root, '.env');
      let envContent = '';
      try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

      function setEnvLine(content: string, key: string, value: string): string {
        const lines = content.split('\n');
        const idx = lines.findIndex(l => l.startsWith(key + '='));
        if (idx >= 0) lines[idx] = `${key}=${value}`;
        else lines.push(`${key}=${value}`);
        return lines.join('\n');
      }

      const body = req.body as Record<string, string>;
      let saved = 0;
      for (const field of ch.configFields) {
        if (typeof body[field] === 'string' && body[field].length > 0) {
          envContent = setEnvLine(envContent, field, body[field]);
          saved++;
        }
      }

      if (saved === 0) return res.status(400).json({ error: 'No valid fields provided' });
      try {
        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
        dotenv.config({ path: envPath, override: true });
        this.logger.info(`[Channels] ${ch.name} configured (${saved} field(s) saved).`);
        res.json({ ok: true, channel: ch.id, saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    /** DELETE /api/channels/:id/configure — remove channel credentials from .env */
    this.app.delete('/api/channels/:id/configure', requireAuth, (req, res) => {
      const ch = CHANNEL_REGISTRY.find(c => c.id === req.params.id);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });

      const root = process.cwd();
      const envPath = path.join(root, '.env');
      let envContent = '';
      try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch { return res.json({ ok: true }); }

      const lines = envContent.split('\n').filter(l => !ch.configFields.some(f => l.startsWith(f + '=')));
      fs.writeFileSync(envPath, lines.join('\n').trim() + '\n', 'utf-8');
      this.logger.info(`[Channels] ${ch.name} credentials removed.`);
      res.json({ ok: true, channel: ch.id });
    });

    // ── Vision: OS screen capture (no rank restriction) ───────────────────
    this.app.post('/api/system/screenshot', requireAuth, async (req, res) => {
      const detect = req.body?.detect === true;
      try {
        // Broadcast capture-start so Dashboard can show "Scanning…" overlay
        this.io.emit('agentUpdate', { type: 'SCREEN_CAPTURE_START', timestamp: Date.now() });
        this.logger.info('[Vision] Screen capture requested');

        const { captureScreen } = await import('../tools/vision.js');
        const { detectUIElements } = await import('../tools/vision.js');
        const capture = await captureScreen();

        let elements;
        if (detect) {
          const det = await detectUIElements(capture.base64);
          elements = det.elements;
        }

        // Broadcast result so Dashboard shows thumbnail
        this.io.emit('agentUpdate', {
          type:   'SCREEN_CAPTURED',
          base64: capture.base64,
          width:  capture.width,
          height: capture.height,
          source: capture.source,
          elements,
          timestamp: Date.now(),
        });

        this.logger.info(`[Vision] Captured ${capture.width}×${capture.height} via ${capture.source}`);
        res.json({ ok: true, ...capture, elements });
      } catch (err: any) {
        this.io.emit('agentUpdate', { type: 'SCREEN_CAPTURE_END', timestamp: Date.now() });
        this.logger.error(`[Vision] Screen capture failed: ${err?.message}`);
        res.status(500).json({ error: err?.message ?? 'Screen capture failed' });
      }
    });

    // ── Vision: model guidance — warn if weak model is active ─────────────
    this.app.get('/api/system/vision-guidance', requireAuth, async (_req, res) => {
      try {
        const { getAgentRole } = await import('../core/hierarchy.js');
        const role  = await getAgentRole();
        const model = (process.env.OLLAMA_MODEL ?? process.env.MUSTB_MODEL ?? '').toLowerCase();
        const weakPatterns = ['phi', 'phi-3', 'phi3', 'tinyllama', 'smollm', 'gemma:2b', 'qwen:0.5'];
        const isWeak = weakPatterns.some(p => model.includes(p));
        res.json({
          warn: isWeak,
          message: isWeak
            ? "I've opened my eyes and ears, but the mind you've selected may struggle to process this data. For the best experience, I recommend switching to Llama 3 or above."
            : null,
          model,
          role,
        });
      } catch {
        res.json({ warn: false, message: null });
      }
    });

    // ── Workspace file browser (v4.3) ─────────────────────────────────────

    /** GET /api/workspace/files — list files in WORKSPACE_ROOT (2 levels deep) */
    this.app.get('/api/workspace/files', requireAuth, async (_req, res) => {
      try {
        const { WORKSPACE_ROOT } = await import('../core/paths.js');
        const files = await listWorkspaceFiles(WORKSPACE_ROOT, WORKSPACE_ROOT, 0, 2);
        res.json({ files });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** GET /api/workspace/file?p=relative/path — serve file content as JSON */
    this.app.get('/api/workspace/file', requireAuth, async (req, res) => {
      try {
        const { WORKSPACE_ROOT, workspacePath } = await import('../core/paths.js');
        const rel = String(req.query.p ?? '');
        if (!rel) return res.status(400).json({ error: 'p (relative path) required' });
        const abs = workspacePath(rel);
        const raw = await fs.promises.readFile(abs, 'utf8');
        const truncated = raw.length > 1_500_000;
        res.json({ content: raw.slice(0, 1_500_000), truncated });
      } catch (err: any) {
        const status = err?.message?.includes('traversal') ? 403 : 500;
        res.status(status).json({ error: err?.message });
      }
    });

    // ── Ollama model roster (v4.3) ─────────────────────────────────────────

    /** GET /api/models — list models available in the local Ollama instance */
    this.app.get('/api/models', async (_req, res) => {
      try {
        const r = await fetch('http://localhost:11434/api/tags');
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const data = await r.json() as { models?: { name: string; size: number; modified_at: string }[] };
        res.json({ models: data.models ?? [] });
      } catch {
        res.json({ models: [] });
      }
    });

    // ── Precision Input: Mouse & Keyboard (v4.2) ─────────────────────────

    /** POST /api/system/mouse/move  { x, y } */
    this.app.post('/api/system/mouse/move', requireAuth, async (req, res) => {
      const { x, y } = req.body ?? {};
      if (typeof x !== 'number' || typeof y !== 'number')
        return res.status(400).json({ error: 'x and y (numbers) required' });
      try {
        const { osMouseMove } = await import('../tools/input.js');
        await osMouseMove(x, y);
        res.json({ ok: true, x, y });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** POST /api/system/mouse/click  { x, y, button? } */
    this.app.post('/api/system/mouse/click', requireAuth, async (req, res) => {
      const { x, y, button = 'left' } = req.body ?? {};
      if (typeof x !== 'number' || typeof y !== 'number')
        return res.status(400).json({ error: 'x and y (numbers) required' });
      try {
        const { osMouseClick } = await import('../tools/input.js');
        await osMouseClick(x, y, button);
        res.json({ ok: true, x, y, button });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** POST /api/system/keyboard/type  { text, delayMs? } */
    this.app.post('/api/system/keyboard/type', requireAuth, async (req, res) => {
      const { text, delayMs = 60 } = req.body ?? {};
      if (!text) return res.status(400).json({ error: 'text required' });
      try {
        const { osTypeText } = await import('../tools/input.js');
        await osTypeText(String(text), Number(delayMs));
        res.json({ ok: true, chars: String(text).length });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** POST /api/system/vision/click  { base64, elementType?, index?, label? } */
    this.app.post('/api/system/vision/click', requireAuth, async (req, res) => {
      const { base64, elementType, index = 0, label } = req.body ?? {};
      if (!base64) return res.status(400).json({ error: 'base64 PNG required' });
      try {
        const { osVisionClick } = await import('../tools/input.js');
        const result = await osVisionClick({ base64, elementType, index, label });
        res.json(result ?? { ok: false });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    // ── Goal execution ────────────────────────────────────────────────────
    this.app.post('/api/goal', requireAuth, (req, res) => {
      const { goal, chatId } = req.body;
      if (!goal) return res.status(400).json({ error: 'goal required' });
      this.orchestrator.run(goal).catch(err => {
        this.logger.error(`Gateway: failed to run goal: ${err?.message}`);
      });
      res.json({ ok: true, goal });
    });

    // ── Logs ──────────────────────────────────────────────────────────────
    this.app.get('/api/logs', (_req, res) => {
      res.json({ logs: [] });
    });

    // ── Setup Wizard ──────────────────────────────────────────────────────
    /** Check if first-time setup is needed, memory presence, hardware tier,
     *  cloud agent name and sync status for the Dashboard. */
    this.app.get('/api/setup/status', async (_req, res) => {
      const root = process.cwd();
      const envPath = path.join(root, '.env');

      // LLM yapılandırması kontrolü
      let configured = false;
      if (fs.existsSync(envPath)) {
        const env = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
        const key = env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY ?? env.ANTHROPIC_API_KEY ?? env.OLLAMA_BASE_URL ?? '';
        configured = key.length > 0 && !key.includes('...');
      }

      // memory/must-b.md varlık kontrolü → "Giriş yap veya dosyanı yükle" butonu için
      const memoryMdPath = path.join(root, 'memory', 'must-b.md');
      const hasMemory = fs.existsSync(memoryMdPath);

      // Donanım puanı (önbelleğe alınır, identity.json'a kaydedilir)
      const hw = getHardwareScore();

      // Cloud sync durumu ve agent adı (hızlı metadata kontrolü)
      const cloudSync = new CloudSync(root, this.logger);
      let syncStatus: string = 'unknown';
      let cloudAgentName: string | null = null;
      let localAgentName: string | null = null;

      try {
        const conflict = await cloudSync.checkConflicts();
        syncStatus      = conflict.state;
        cloudAgentName  = conflict.cloudAgentName;
        localAgentName  = conflict.localAgentName;

        // Auto-resolve non-conflict states and emit event
        if (conflict.state === 'local_only') {
          cloudSync.backup().then(r => {
            if (r.ok) this.io.emit('agentUpdate', { type: 'syncAutoUpload', files: r.files });
          }).catch(() => {});
        } else if (conflict.state === 'cloud_only') {
          cloudSync.restore().then(r => {
            if (r.ok) this.io.emit('agentUpdate', { type: 'syncAutoRestore', files: r.files });
          }).catch(() => {});
        } else if (conflict.state === 'conflict') {
          // Broadcast conflict to Dashboard — user must decide
          this.io.emit('agentUpdate', {
            type:           'CONFLICT_DETECTED',
            localAgentName,
            cloudAgentName,
            localMtime:     conflict.localMtime,
            cloudTimestamp: conflict.cloudTimestamp,
          });
        }
      } catch { /* cloud unreachable or no token — non-fatal */ }

      res.json({
        configured,
        hasMemory,
        memoryPath:     hasMemory ? memoryMdPath : null,
        hardware:       { score: hw.score, tier: hw.tier },
        syncStatus,
        cloudAgentName,
        localAgentName,
        version: '2.0',
      });
    });

    /**
     * POST /api/setup/sync-resolve
     * Body: { decision: 'upload' | 'restore' | 'duplicate' }
     *
     * Resolves a CONFLICT_DETECTED state based on the user's choice:
     *   upload    → push local memory to cloud (local wins)
     *   restore   → pull cloud memory to local (cloud wins)
     *   duplicate → keep local, copy cloud into memory/cloud-restore/
     *
     * Also handles auto-flow when called without a prior conflict:
     * the checkConflicts() result is re-evaluated and used to pick the right action.
     */
    this.app.post('/api/setup/sync-resolve', requireAuth, async (req, res) => {
      const { decision } = req.body as { decision?: string };
      if (!decision || !['upload', 'restore', 'duplicate'].includes(decision)) {
        return res.status(400).json({ error: "decision must be 'upload', 'restore', or 'duplicate'" });
      }

      const root = process.cwd();
      const sync = new CloudSync(root, this.logger);

      this.logger.info(`[SyncResolve] User decision: ${decision}`);
      this.io.emit('agentUpdate', { type: 'syncResolveStart', decision });

      try {
        const result = await sync.resolveConflict(decision as SyncDecision);

        this.io.emit('agentUpdate', {
          type:     'syncResolveFinish',
          decision,
          ok:       result.ok,
          files:    result.files,
          bytes:    result.bytes,
          error:    result.error,
        });

        if (result.ok) {
          res.json({ ok: true, decision, files: result.files, bytes: result.bytes });
        } else {
          res.status(500).json({ ok: false, decision, error: result.error });
        }
      } catch (err: any) {
        this.logger.error(`[SyncResolve] Failed: ${err.message}`);
        this.io.emit('agentUpdate', { type: 'syncResolveFinish', decision, ok: false, error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /**
     * GET /api/setup/sync-status
     * Returns current conflict state without triggering auto-resolve.
     * Lightweight — just the metadata check.
     */
    this.app.get('/api/setup/sync-status', requireAuth, async (_req, res) => {
      const root   = process.cwd();
      const sync   = new CloudSync(root, this.logger);
      try {
        const result = await sync.checkConflicts();
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /api/setup/models
     * Returns hardware-aware model recommendations for the Dashboard.
     *
     * Response shape:
     * {
     *   score: number,
     *   tier: string,
     *   recommended: ModelRecommendation[],   // comfortable local models
     *   marginal: ModelRecommendation[],       // may work but slow
     *   cloud: ModelRecommendation[],          // all cloud options
     *   all: ModelRecommendation[],            // every model with fit label
     * }
     */
    this.app.get('/api/setup/models', (_req, res) => {
      const hw   = getHardwareScore();
      const recs = recommendModels(hw.score);

      // Strip heavy fields (privateKey etc.) — only send catalog data
      const strip = (list: typeof recs.recommended) =>
        list.map(r => ({
          id:            r.model.id,
          name:          r.model.name,
          provider:      r.model.provider,
          category:      r.model.category,
          modelId:       r.model.modelId,
          ramGb:         r.model.ramGb,
          params:        r.model.params,
          description:   r.model.description,
          requiresApiKey: r.model.requiresApiKey,
          tags:          r.model.tags,
          fit:           r.fit,
        }));

      res.json({
        score:       hw.score,
        tier:        hw.tier,
        recommended: strip(recs.recommended),
        marginal:    strip(recs.marginal),
        cloudOnly:   strip(recs.cloudOnly),
        cloud:       strip(recs.cloud),
        all:         strip(recs.all),
      });
    });

    /**
     * POST /api/setup/ensure-model
     * Body: { modelId: string }  — e.g. "llama3.2:latest"
     *
     * Ensures Ollama is installed and the model is pulled.
     * Streams progress via 'agentUpdate' Socket.IO events.
     */
    this.app.post('/api/setup/ensure-model', requireAuth, async (req, res) => {
      const { modelId } = req.body as { modelId?: string };
      if (!modelId || typeof modelId !== 'string') {
        return res.status(400).json({ error: 'modelId is required' });
      }

      // Validate modelId is in catalog
      const catalogEntry = MODELS_LIST.find(m => m.modelId === modelId && m.category === 'local');
      if (!catalogEntry) {
        return res.status(400).json({ error: `Model '${modelId}' not found in local catalog` });
      }

      this.io.emit('agentUpdate', { type: 'modelPullStart', modelId });
      this.logger.info(`[Models] Ensuring local model: ${modelId}`);

      try {
        const result = await ensureModel(modelId);
        this.io.emit('agentUpdate', { type: 'modelPullFinish', modelId, ok: result.ok, error: result.error });

        if (result.ok) {
          res.json({ ok: true, modelId, ollamaInstalled: result.ollamaInstalled, modelPulled: result.modelPulled });
        } else {
          res.status(500).json({ ok: false, modelId, error: result.error });
        }
      } catch (err: any) {
        this.logger.error(`[Models] ensureModel failed: ${err.message}`);
        this.io.emit('agentUpdate', { type: 'modelPullFinish', modelId, ok: false, error: err.message });
        res.status(500).json({ ok: false, modelId, error: err.message });
      }
    });

    /**
     * GET /api/setup/model-progress?modelId=<id>
     *
     * Spawns `ollama pull <modelId>` and streams real-time progress via Socket.IO.
     * Emits 'modelProgress' events: { modelId, percent, totalGb, downloadedGb, status }
     * Emits 'modelPullFinish' on completion or error.
     *
     * The HTTP response returns immediately with { ok: true, modelId } — progress
     * is delivered exclusively through Socket.IO to avoid long-polling.
     */
    this.app.get('/api/setup/model-progress', requireAuth, (req, res) => {
      const modelId = String(req.query.modelId ?? '').trim();
      if (!modelId) {
        return res.status(400).json({ error: 'modelId query param required' });
      }

      const catalogEntry = MODELS_LIST.find(m => m.modelId === modelId && m.category === 'local');
      if (!catalogEntry) {
        return res.status(400).json({ error: `Model '${modelId}' not found in local catalog` });
      }

      const { spawn: spawnProc } = require('child_process') as typeof import('child_process');
      const child = spawnProc('ollama', ['pull', modelId], { stdio: ['ignore', 'pipe', 'pipe'] });

      this.logger.info(`[ModelProgress] Starting: ollama pull ${modelId}`);
      this.io.emit('agentUpdate', { type: 'modelPullStart', modelId });

      // Parse progress lines like:
      //   "pulling manifest"
      //   "pulling abc123... 42% ▕████      ▏  1.3 GB/3.1 GB"
      const parseProgress = (line: string) => {
        // Try to extract percentage and GB values
        const pctMatch  = line.match(/(\d+)%/);
        const gbMatch   = line.match(/([\d.]+)\s*GB\s*\/\s*([\d.]+)\s*GB/i);
        const percent   = pctMatch  ? Number(pctMatch[1])  : null;
        const downloadedGb = gbMatch ? Number(gbMatch[1])  : null;
        const totalGb      = gbMatch ? Number(gbMatch[2])  : null;
        const status    = line.replace(/\x1b\[[0-9;]*m/g, '').trim(); // strip ANSI

        if (percent !== null || downloadedGb !== null) {
          this.io.emit('agentUpdate', {
            type: 'modelProgress',
            modelId,
            percent:      percent ?? 0,
            downloadedGb: downloadedGb ?? 0,
            totalGb:      totalGb ?? catalogEntry.ramGb,
            status,
          });
        }
      };

      let stdout = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        const lines = (stdout + chunk.toString()).split('\n');
        stdout = lines.pop() ?? '';
        for (const line of lines) { if (line.trim()) parseProgress(line); }
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) { if (line.trim()) parseProgress(line); }
      });

      child.on('close', (code) => {
        const ok = code === 0;
        this.logger.info(`[ModelProgress] ollama pull ${modelId} exited with code ${code}`);
        this.io.emit('agentUpdate', {
          type:    'modelPullFinish',
          modelId,
          ok,
          error:   ok ? undefined : `ollama pull exited with code ${code}`,
        });
      });

      // Respond immediately — client listens for progress via Socket.IO
      res.json({ ok: true, modelId, message: 'Pull started — listen for modelProgress events via Socket.IO' });
    });

    /**
     * GET /api/setup/performance?modelId=<id>
     *
     * Returns a performance prediction for how well the given model will run
     * on the current machine (RAM ratio analysis).
     */
    this.app.get('/api/setup/performance', (_req, res) => {
      const modelId = String((_req.query.modelId as string) ?? '').trim();
      if (!modelId) {
        return res.status(400).json({ error: 'modelId query param required' });
      }
      const prediction = getPerformancePrediction(modelId);
      res.json(prediction);
    });

    // ── Agent Hierarchy ────────────────────────────────────────────────────

    /** GET /api/world/node-card — returns this node's identity + role */
    this.app.get('/api/world/node-card', (_req, res) => {
      res.json(getNodeCard());
    });

    /** GET /api/world/capabilities — full role capability set */
    this.app.get('/api/world/capabilities', (_req, res) => {
      res.json(getAgentRole());
    });

    // ── P2P Task Bridge ───────────────────────────────────────────────────
    // Tasks are relayed through the Must-b cloud (must-b.com/api/v1/world/*).
    // Each task payload is AES-256-GCM encrypted with the sender's key before
    // it leaves the machine.  The cloud stores only opaque ciphertext.

    /**
     * POST /api/world/send-task
     * Body: { recipientUid: string, task: string, taskMinScore?: number }
     *
     * Encrypts the task string and sends it to the cloud relay addressed
     * to recipientUid.  The recipient must have a score ≥ taskMinScore
     * (default 0) to accept the task.
     */
    this.app.post('/api/world/send-task', requireAuth, async (req, res) => {
      const { recipientUid, task, taskMinScore = 0 } = req.body as {
        recipientUid?: string;
        task?: string;
        taskMinScore?: number;
      };

      if (!recipientUid || !task) {
        return res.status(400).json({ error: 'recipientUid and task are required' });
      }

      const senderCaps = getAgentRole();
      if (!senderCaps.canDelegate) {
        return res.status(403).json({
          error: `Role '${senderCaps.role}' cannot delegate tasks. Upgrade your hardware tier.`,
          senderRole: senderCaps.role,
        });
      }

      const token = process.env.MUSTB_CLOUD_TOKEN;
      if (!token) {
        return res.status(403).json({ error: 'Cloud token required. Run must-b cloud-connect first.' });
      }

      const { encrypt } = await import('../core/identity.js');
      const payload = encrypt(JSON.stringify({
        task,
        senderUid:    getNodeCard().uid,
        senderRole:   senderCaps.role,
        senderTier:   senderCaps.tier,
        taskMinScore,
        sentAt:       new Date().toISOString(),
      }));

      // Relay to cloud
      const cloudUrl  = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
      const body      = Buffer.from(JSON.stringify({ recipientUid, payload }));
      const https     = await import('https');
      const relayUrl  = new URL('/api/v1/world/relay', cloudUrl);

      try {
        await new Promise<void>((resolve, reject) => {
          const req = https.default.request({
            hostname: relayUrl.hostname,
            port:     relayUrl.port ? Number(relayUrl.port) : 443,
            path:     relayUrl.pathname,
            method:   'POST',
            headers: {
              'Content-Type':   'application/json',
              'Content-Length': body.byteLength,
              'Authorization':  `Bearer ${token}`,
            },
          }, (r) => {
            let raw = '';
            r.on('data', c => { raw += c; });
            r.on('end', () => {
              (r.statusCode ?? 0) >= 400 ? reject(new Error(`Cloud: ${r.statusCode} ${raw.slice(0,120)}`)) : resolve();
            });
          });
          req.on('error', reject);
          req.write(body);
          req.end();
        });

        this.logger.info(`[World] Task sent to ${recipientUid} (minScore=${taskMinScore})`);
        this.io.emit('agentUpdate', { type: 'taskSent', recipientUid, taskMinScore });
        res.json({ ok: true, recipientUid, taskMinScore });
      } catch (err: any) {
        this.logger.warn(`[World] send-task failed: ${err.message}`);
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    /**
     * GET /api/world/receive-task
     * Polls the cloud relay for tasks addressed to this node's UID.
     * Decrypts each packet and returns only those where this node's
     * score meets taskMinScore.  Accepted tasks are auto-queued.
     */
    this.app.get('/api/world/receive-task', requireAuth, async (_req, res) => {
      const token = process.env.MUSTB_CLOUD_TOKEN;
      if (!token) {
        return res.status(403).json({ error: 'Cloud token required.' });
      }

      const identity  = loadOrCreateIdentity();
      const myCaps    = getAgentRole();
      const cloudUrl  = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
      const https     = await import('https');
      const fetchUrl  = new URL(`/api/v1/world/relay/${identity.uid}`, cloudUrl);

      try {
        const raw = await new Promise<string>((resolve, reject) => {
          https.default.get({
            hostname: fetchUrl.hostname,
            port:     fetchUrl.port ? Number(fetchUrl.port) : 443,
            path:     fetchUrl.pathname,
            headers:  { 'Authorization': `Bearer ${token}` },
          }, (r) => {
            let buf = '';
            r.on('data', c => { buf += c; });
            r.on('end', () => ((r.statusCode ?? 0) >= 400 ? reject(new Error(`${r.statusCode}`)) : resolve(buf)));
          }).on('error', reject);
        });

        const packets: Array<{ payload: { iv: string; tag: string; ciphertext: string } }> = JSON.parse(raw);
        const { decrypt } = await import('../core/identity.js');

        const accepted: unknown[] = [];
        const rejected: unknown[] = [];

        for (const pkt of packets ?? []) {
          try {
            const plain   = JSON.parse(decrypt(pkt.payload));
            const minScore = Number(plain.taskMinScore ?? 0);
            if (myCaps.score >= minScore) {
              accepted.push(plain);
              // Kick off the goal in the background
              this.orchestrator.run(String(plain.task)).catch(() => {});
              this.io.emit('agentUpdate', { type: 'taskReceived', from: plain.senderUid, task: plain.task });
            } else {
              rejected.push({ senderUid: plain.senderUid, taskMinScore: minScore, myScore: myCaps.score });
            }
          } catch { /* skip packets we can't decrypt */ }
        }

        res.json({ accepted: accepted.length, rejected: rejected.length, myRole: myCaps.role, myScore: myCaps.score });
      } catch (err: any) {
        this.logger.warn(`[World] receive-task failed: ${err.message}`);
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    // ── P2P File Exchange ──────────────────────────────────────────────────

    /**
     * POST /api/world/send-file
     * Body: { recipientUid: string, filename: string, content: string (base64), mimeType?: string }
     *
     * Encrypts the base64-encoded file payload (AES-256-GCM via identity.encrypt) and
     * relays it to the Must-b cloud relay addressed to recipientUid.
     * Max accepted content size: 10 MB (base64-encoded).
     */
    this.app.post('/api/world/send-file', requireAuth, async (req, res) => {
      const { recipientUid, filename, content, mimeType = 'application/octet-stream' } = req.body as {
        recipientUid?: string;
        filename?:     string;
        content?:      string;   // base64-encoded file bytes
        mimeType?:     string;
      };

      if (!recipientUid || !filename || !content) {
        return res.status(400).json({ error: 'recipientUid, filename and content (base64) are required.' });
      }

      // Enforce 10 MB limit (base64 ≈ 4/3× raw, so 10 MB raw → ~13.3 MB base64)
      const MAX_B64_BYTES = Math.ceil(10 * 1024 * 1024 * (4 / 3));
      if (Buffer.byteLength(content, 'utf-8') > MAX_B64_BYTES) {
        return res.status(413).json({ error: 'File exceeds 10 MB limit.' });
      }

      const token = process.env.MUSTB_CLOUD_TOKEN;
      if (!token) {
        return res.status(403).json({ error: 'Cloud token required. Run must-b cloud-connect first.' });
      }

      const { encrypt } = await import('../core/identity.js');
      const payload = encrypt(JSON.stringify({
        filename,
        mimeType,
        content,       // base64 blob
        senderUid: getNodeCard().uid,
        sentAt:    new Date().toISOString(),
      }));

      const cloudUrl  = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
      const relayUrl  = new URL('/api/v1/world/relay/file', cloudUrl);
      const body      = Buffer.from(JSON.stringify({ recipientUid, payload, type: 'file' }));
      const httpsLib  = await import('https');

      try {
        await new Promise<void>((resolve, reject) => {
          const r = httpsLib.default.request({
            hostname: relayUrl.hostname,
            port:     relayUrl.port ? Number(relayUrl.port) : 443,
            path:     relayUrl.pathname,
            method:   'POST',
            headers: {
              'Content-Type':   'application/json',
              'Content-Length': body.byteLength,
              'Authorization':  `Bearer ${token}`,
            },
          }, (res) => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () =>
              (res.statusCode ?? 0) >= 400
                ? reject(new Error(`Cloud: ${res.statusCode} ${raw.slice(0, 120)}`))
                : resolve()
            );
          });
          r.on('error', reject);
          r.write(body);
          r.end();
        });

        this.logger.info(`[World/File] Sent "${filename}" to ${recipientUid}`);
        this.io.emit('agentUpdate', { type: 'fileSent', recipientUid, filename });
        res.json({ ok: true, recipientUid, filename });
      } catch (err: any) {
        this.logger.warn(`[World/File] send-file failed: ${err.message}`);
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    /**
     * GET /api/world/receive-file
     *
     * Polls the cloud relay for file packets addressed to this node's UID.
     * Each packet is decrypted and written to  memory/received-files/<filename>.
     * Returns a list of received filenames and byte sizes.
     */
    this.app.get('/api/world/receive-file', requireAuth, async (_req, res) => {
      const token = process.env.MUSTB_CLOUD_TOKEN;
      if (!token) {
        return res.status(403).json({ error: 'Cloud token required.' });
      }

      const identity   = loadOrCreateIdentity();
      const cloudUrl   = process.env.MUSTB_CLOUD_URL ?? 'https://must-b.com';
      const fetchUrl   = new URL(`/api/v1/world/relay/file/${identity.uid}`, cloudUrl);
      const httpsLib   = await import('https');

      try {
        const raw = await new Promise<string>((resolve, reject) => {
          httpsLib.default.get({
            hostname: fetchUrl.hostname,
            port:     fetchUrl.port ? Number(fetchUrl.port) : 443,
            path:     fetchUrl.pathname,
            headers:  { 'Authorization': `Bearer ${token}` },
          }, (r) => {
            let buf = '';
            r.on('data', (c) => { buf += c; });
            r.on('end', () =>
              (r.statusCode ?? 0) >= 400
                ? reject(new Error(`Cloud: ${r.statusCode}`))
                : resolve(buf)
            );
          }).on('error', reject);
        });

        const packets: Array<{ payload: { iv: string; tag: string; ciphertext: string } }> = JSON.parse(raw);
        const { decrypt } = await import('../core/identity.js');

        const root     = process.cwd();
        const saveDir  = path.join(root, 'memory', 'received-files');
        fs.mkdirSync(saveDir, { recursive: true });

        const saved: Array<{ filename: string; bytes: number }> = [];

        for (const pkt of packets ?? []) {
          try {
            const plain    = JSON.parse(decrypt(pkt.payload)) as {
              filename: string;
              mimeType: string;
              content:  string;  // base64
              senderUid: string;
            };

            // Safety: strip path traversal from filename
            const safeName = path.basename(plain.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
            if (!safeName) continue;

            const fileBytes = Buffer.from(plain.content, 'base64');
            const dest      = path.join(saveDir, safeName);
            fs.writeFileSync(dest, fileBytes);

            saved.push({ filename: safeName, bytes: fileBytes.length });
            this.io.emit('agentUpdate', {
              type:      'fileReceived',
              filename:  safeName,
              bytes:     fileBytes.length,
              senderUid: plain.senderUid,
            });
            this.logger.info(`[World/File] Received "${safeName}" (${fileBytes.length} bytes) from ${plain.senderUid}`);
          } catch { /* skip undecryptable packets */ }
        }

        res.json({ ok: true, received: saved.length, files: saved });
      } catch (err: any) {
        this.logger.warn(`[World/File] receive-file failed: ${err.message}`);
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    // ── Skills Hub ────────────────────────────────────────────────────────

    /**
     * GET /api/v1/skills/market
     * Browse the global Must-b Skills Hub (must-b.com/api/v1/market).
     * Open to all agents regardless of tier.
     */
    this.app.get('/api/v1/skills/market', async (req, res) => {
      const query  = String(req.query.q ?? '');
      const limit  = Math.min(Number(req.query.limit ?? 20), 100);
      try {
        const result = await getSkillsMarket({ query, limit });
        res.json(result);
      } catch (err: any) {
        this.logger.warn(`[Skills] Market fetch failed: ${err.message}`);
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    /**
     * POST /api/v1/skills/publish
     * Body: { skillId: string, manifest: object, readme: string }
     *
     * Publishes a local skill to the global market.
     * Requires Pro tier or higher (canPublishSkills = true).
     */
    this.app.post('/api/v1/skills/publish', requireAuth, async (req, res) => {
      const caps = getAgentRole();
      if (!caps.canPublishSkills) {
        return res.status(403).json({
          error: `Only Pro+ agents can publish skills. Your tier: ${caps.tier} (${caps.role}).`,
          tier:  caps.tier,
          role:  caps.role,
        });
      }

      const token = process.env.MUSTB_CLOUD_TOKEN;
      if (!token) {
        return res.status(403).json({ error: 'Cloud token required. Run must-b cloud-connect first.' });
      }

      const { skillId, manifest, readme } = req.body as {
        skillId?: string;
        manifest?: object;
        readme?: string;
      };

      if (!skillId || !manifest) {
        return res.status(400).json({ error: 'skillId and manifest are required' });
      }

      try {
        const result = await publishSkill({ skillId, manifest, readme: readme ?? '', token, caps });
        if (result.ok) {
          this.logger.info(`[Skills] Published: ${skillId}`);
          this.io.emit('agentUpdate', { type: 'skillPublished', skillId });
          res.json(result);
        } else {
          res.status(500).json(result);
        }
      } catch (err: any) {
        this.logger.error(`[Skills] Publish failed: ${err.message}`);
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    // ── Skill Library (v4.5) ───────────────────────────────────────────────

    /** GET /api/skills/list — all saved skills, newest first */
    this.app.get('/api/skills/list', requireAuth, async (_req, res) => {
      try {
        const { listSkills } = await import('../core/skills-hub.js');
        res.json({ skills: listSkills() });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** POST /api/skills/save — record a completed workflow as a skill */
    this.app.post('/api/skills/save', requireAuth, async (req, res) => {
      const { goal, answer, steps, name, tags } = req.body ?? {};
      if (!goal) return res.status(400).json({ error: 'goal required' });
      try {
        const { saveSkill } = await import('../core/skills-hub.js');
        const skill = saveSkill({ goal, answer: answer ?? '', steps: steps ?? [], name, tags });
        this.logger.info(`[Skills] Saved: "${skill.name}" (${skill.id})`);
        res.json({ ok: true, skill });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** POST /api/skills/run — replay a saved skill by re-submitting its goal */
    this.app.post('/api/skills/run', requireAuth, async (req, res) => {
      const { id } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id required' });
      try {
        const { getSkill, bumpRunCount } = await import('../core/skills-hub.js');
        const skill = getSkill(id);
        if (!skill) return res.status(404).json({ error: 'Skill not found' });

        bumpRunCount(id);
        this.logger.info(`[Skills] Running: "${skill.name}" — "${skill.goal}"`);
        this.io.emit('agentUpdate', { type: 'skillRunStart', skillId: id, skillName: skill.name, goal: skill.goal });

        // Run the goal through the live orchestrator (non-blocking)
        this.orchestrator.run(skill.goal).catch((err: any) => {
          this.logger.error(`[Skills] Run failed for ${id}: ${err?.message}`);
        });

        res.json({ ok: true, skillId: id, goal: skill.goal });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** DELETE /api/skills/:id — remove a saved skill */
    this.app.delete('/api/skills/:id', requireAuth, async (req, res) => {
      const { id } = req.params;
      try {
        const { deleteSkill } = await import('../core/skills-hub.js');
        const deleted = deleteSkill(id);
        if (!deleted) return res.status(404).json({ error: 'Skill not found' });
        this.logger.info(`[Skills] Deleted: ${id}`);
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    });

    /** Save setup wizard results — writes .env and persists memory profile */
    this.app.post('/api/setup', async (req, res) => {
      try {
        const { name, provider, apiKey, skills, mode } = req.body as {
          name?: string;
          provider?: string;
          apiKey?: string;
          skills?: string[];
          mode?: string;
        };

        const root = process.cwd();
        const envPath = path.join(root, '.env');
        let envContent = '';
        try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch { envContent = ''; }

        function setEnvKey(content: string, key: string, value: string): string {
          const lines = content.split('\n');
          const idx = lines.findIndex(l => l.startsWith(key + '='));
          if (idx >= 0) lines[idx] = `${key}=${value}`;
          else lines.push(`${key}=${value}`);
          return lines.join('\n');
        }

        const safeMode = mode === 'world' ? 'world' : 'local';
        const safeName = (name ?? 'User').trim() || 'User';
        const safeProvider = provider ?? 'openrouter';
        const safeKey = (apiKey ?? '').trim();
        const safeSkills: string[] = Array.isArray(skills) ? skills : ['browser', 'terminal', 'memory', 'web_search', 'filesystem'];

        // Write LLM provider + key
        envContent = setEnvKey(envContent, 'LLM_PROVIDER', safeProvider);
        if (safeKey) {
          if (safeProvider === 'openrouter') envContent = setEnvKey(envContent, 'OPENROUTER_API_KEY', safeKey);
          else if (safeProvider === 'openai') envContent = setEnvKey(envContent, 'OPENAI_API_KEY', safeKey);
          else if (safeProvider === 'anthropic') envContent = setEnvKey(envContent, 'ANTHROPIC_API_KEY', safeKey);
          else if (safeProvider === 'ollama') envContent = setEnvKey(envContent, 'OLLAMA_BASE_URL', safeKey);
        }

        // Write skills
        const allSkills = ['browser', 'terminal', 'memory', 'web_search', 'filesystem'];
        for (const s of allSkills) {
          envContent = setEnvKey(envContent, `SKILL_${s.toUpperCase()}`, safeSkills.includes(s) ? 'true' : 'false');
        }

        // Write mode
        envContent = setEnvKey(envContent, 'MUSTB_MODE', safeMode);
        if (safeMode === 'world') {
          const uid = 'mustb_' + crypto.randomBytes(12).toString('hex');
          envContent = setEnvKey(envContent, 'MUSTB_UID', uid);
        }

        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

        // Reload into process.env
        dotenv.config({ path: envPath, override: true });

        // Persist to long-term memory
        const mem = new LongTermMemory(root);
        await mem.load();
        mem.setProfile({ name: safeName, mode: safeMode });
        await mem.save();

        res.json({ ok: true, name: safeName, provider: safeProvider, mode: safeMode });
      } catch (err: any) {
        this.logger.error(`Setup: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // ── Memory File Import ──────────────────────────────────────────────────
    /**
     * POST /api/memory/import
     * Accepts a multipart/form-data body with a single 'file' field (.md or .json).
     * Writes the file into the memory/ directory, naming it by the original filename.
     * Allows the CloudSyncButton "Drag memory file" flow to land without cloud credentials.
     */
    this.app.post('/api/memory/import', requireAuth, (req, res) => {
      try {
        const contentType = String(req.headers['content-type'] ?? '');
        const raw = req.body as Buffer;

        // Extract filename from X-Filename header if present, else fallback
        const disposition = String(req.headers['x-filename'] ?? '');
        let filename = disposition || 'imported-memory.md';

        // Parse multipart boundary to extract real filename + content
        let fileContent: Buffer = raw;

        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
          if (boundaryMatch) {
            const boundary = '--' + boundaryMatch[1];
            const rawStr = raw.toString('binary');
            const parts = rawStr.split(boundary);
            for (const part of parts) {
              const fnMatch = part.match(/filename="([^"]+)"/);
              if (fnMatch) {
                filename = fnMatch[1];
                const bodyStart = part.indexOf('\r\n\r\n');
                if (bodyStart >= 0) {
                  const bodyStr = part.slice(bodyStart + 4).replace(/\r\n--$/, '');
                  fileContent = Buffer.from(bodyStr, 'binary');
                }
                break;
              }
            }
          }
        }

        // Safety: only allow .md and .json, strip path traversal
        const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!safeName.endsWith('.md') && !safeName.endsWith('.json')) {
          return res.status(400).json({ error: 'Only .md and .json files are accepted' });
        }

        const root   = process.cwd();
        const memDir = path.join(root, 'memory');
        fs.mkdirSync(memDir, { recursive: true });
        fs.writeFileSync(path.join(memDir, safeName), fileContent);

        this.logger.info(`[MemoryImport] ${safeName} imported (${fileContent.length} bytes)`);
        this.io.emit('agentUpdate', { type: 'memoryImported', filename: safeName, bytes: fileContent.length });
        res.json({ ok: true, filename: safeName, bytes: fileContent.length });
      } catch (err: any) {
        this.logger.error(`[MemoryImport] Failed: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      this.logger.info(`Gateway: client connected ${socket.id}`);
      socket.on('disconnect', () => this.logger.info(`Gateway: client disconnected ${socket.id}`));
    });
  }

  private setupOrchestratorListeners() {
    this.orchestrator.on('planStart',    (d) => this.io.emit('agentUpdate', { type: 'planStart',    ...d }));
    this.orchestrator.on('planGenerated',(d) => this.io.emit('agentUpdate', { type: 'planGenerated',...d }));
    this.orchestrator.on('stepStart',    (d) => this.io.emit('agentUpdate', { type: 'stepStart',    ...d }));
    this.orchestrator.on('stepFinish',   (d) => this.io.emit('agentUpdate', { type: 'stepFinish',   ...d }));
    this.orchestrator.on('finalAnswer',  (d) => this.io.emit('agentUpdate', { type: 'finalAnswer',  ...d }));
    this.orchestrator.on('planFinish',   (d) => this.io.emit('agentUpdate', { type: 'planFinish',   ...d }));
    // Auto-repair events surfaced to the dashboard
    this.orchestrator.on('agentRepair',  (d) => this.io.emit('agentUpdate', { type: 'agentRepair',  ...d }));
  }

  /**
   * Bridge inputEvents (from input.ts) → socket.io → Dashboard.
   * This is what makes "Clicking at 450, 210…" appear in the ActiveWorkflow feed.
   */
  private async setupInputEventBridge() {
    try {
      const { inputEvents } = await import('../tools/input.js');

      inputEvents.on('mouseMove', (d: { x: number; y: number }) => {
        this.io.emit('agentUpdate', {
          type:   'inputAction',
          action: 'mouseMove',
          label:  `Moving to ${d.x}, ${d.y}`,
          ...d,
          timestamp: Date.now(),
        });
      });

      inputEvents.on('mouseClick', (d: { x: number; y: number; button: string }) => {
        this.io.emit('agentUpdate', {
          type:   'inputAction',
          action: 'mouseClick',
          label:  `Clicking at ${d.x}, ${d.y} (${d.button})`,
          ...d,
          timestamp: Date.now(),
        });
        this.logger.info(`[Input] Click at (${d.x}, ${d.y}) btn=${d.button}`);
      });

      inputEvents.on('typeText', (d: { preview: string }) => {
        this.io.emit('agentUpdate', {
          type:   'inputAction',
          action: 'typeText',
          label:  `Typing: "${d.preview}${d.preview.length >= 60 ? '…' : ''}"`,
          ...d,
          timestamp: Date.now(),
        });
        this.logger.info(`[Input] Type: "${d.preview}"`);
      });

      inputEvents.on('visionClick', (d: { x: number; y: number; type: string; label: string }) => {
        this.io.emit('agentUpdate', {
          type:   'inputAction',
          action: 'visionClick',
          label:  `Vision → ${d.label} (${d.type}) at ${d.x}, ${d.y}`,
          ...d,
          timestamp: Date.now(),
        });
        this.logger.info(`[Input] VisionClick ${d.label} at (${d.x}, ${d.y})`);
      });
    } catch (err: any) {
      this.logger.warn(`[Input] Bridge setup failed: ${err?.message}`);
    }
  }

  start() {
    this.server.listen(this.port, () => {
      this.logger.info(`[Gateway] Must-b live at http://localhost:${this.port}`);
    });
  }
}

// ── Background Health Watcher ──────────────────────────────────────────────

const HEALTH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Starts a recurring background health monitor.
 * Runs silent (no-fix) doctor checks every 30 minutes and logs any issues found.
 * Returns the interval handle so callers can clear it if needed.
 */
export function startHealthMonitor(root: string, logger: winston.Logger): NodeJS.Timeout {
  const run = async () => {
    try {
      const result = await runDoctor(root, false, true); // silent, no interactive fix
      if (result.remaining > 0) {
        logger.warn(
          `[HealthMonitor] ${result.remaining} sorun tespit edildi. ` +
          `Onarım için: must-b doctor --fix`
        );
      } else {
        logger.debug('[HealthMonitor] Tüm kontroller geçti.');
      }
    } catch (e: any) {
      logger.error(`[HealthMonitor] Kontrol başarısız: ${e?.message ?? e}`);
    }
  };

  // First check after 30 minutes (boot already ran pre-flight)
  const handle = setInterval(run, HEALTH_INTERVAL_MS);
  // Allow process to exit even if the interval is still active
  handle.unref();

  logger.info(`[HealthMonitor] Arka plan sağlık izleyicisi aktif (her ${HEALTH_INTERVAL_MS / 60000} dakikada bir).`);
  return handle;
}
