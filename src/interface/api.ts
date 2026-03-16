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

    // ── Auth middleware: localhost always passes, others need Bearer token ─
    const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = req.socket.remoteAddress ?? '';
      if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return next();
      if (req.headers.authorization === `Bearer ${LOCAL_TOKEN}`) return next();
      res.status(401).json({ error: 'Unauthorized — call /api/auth/local first' });
    };

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
    /** Check if first-time setup is needed */
    this.app.get('/api/setup/status', (_req, res) => {
      const root = process.cwd();
      const envPath = path.join(root, '.env');
      let configured = false;
      if (fs.existsSync(envPath)) {
        const env = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
        const key = env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY ?? env.ANTHROPIC_API_KEY ?? env.OLLAMA_BASE_URL ?? '';
        configured = key.length > 0 && !key.includes('...');
      }
      res.json({ configured, version: '2.0' });
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
