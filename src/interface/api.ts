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
import { recommendModels } from '../utils/hardware.js';
import { ensureModel } from '../commands/doctor.js';
import { CloudSync, type SyncDecision } from '../core/cloud-sync.js';

/** One-time random local auth token — valid for this process lifetime */
const LOCAL_TOKEN = process.env.MUSTB_LOCAL_TOKEN ?? crypto.randomBytes(16).toString('hex');

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
  }

  private setupMiddleware() {
    this.app.use(express.json());
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
