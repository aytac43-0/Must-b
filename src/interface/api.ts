import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import winston from 'winston';

import { Orchestrator, type PlanStep } from '../core/orchestrator.js';
import { SessionHistory } from '../memory/history.js';

/** One-time random local auth token — valid for this process lifetime */
const LOCAL_TOKEN = process.env.MUSTB_LOCAL_TOKEN ?? crypto.randomBytes(16).toString('hex');

/** In-memory local chat store (replaces Supabase dependency) */
interface LocalChat {
  id: string;
  title: string;
  created_at: string;
}
const localChats: LocalChat[] = [];

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
  }

  start() {
    this.server.listen(this.port, () => {
      this.logger.info(`[Gateway] Must-b live at http://localhost:${this.port}`);
    });
  }
}
