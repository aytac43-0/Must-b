import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import winston from 'winston';

import { Orchestrator, type PlanStep } from '../core/orchestrator.js';
import { SessionHistory } from '../memory/history.js';

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
    const frontendOut = path.join(process.cwd(), 'public', 'Luma', 'out');
    this.app.use(express.static(frontendOut));
    // SPA fallback — serve index.html for all non-API routes
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendOut, 'index.html'), (err) => {
        if (err) res.sendFile(path.join(frontendOut, '404.html'));
      });
    });
  }

  private setupRoutes() {
    this.app.get('/api/status', async (req, res) => {
      res.json({ status: 'online', gateway: 'Must-b', port: this.port, timestamp: Date.now() });
    });

    this.app.post('/api/goal', async (req, res) => {
      const { goal } = req.body;
      if (!goal) return res.status(400).json({ error: 'goal required' });
      // Trigger orchestrator (fire-and-forget for gateway stability)
      this.orchestrator.run(goal).catch(err => {
        this.logger.error(`Gateway: failed to run goal: ${err?.message}`);
      });
      res.json({ ok: true, goal });
    });

    this.app.get('/api/logs', async (req, res) => {
      // Simple placeholder; real-time logs come via socket.io
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
    // Forward orchestration events to dashboard
    this.orchestrator.on('planStart', (d) => this.io.emit('agentUpdate', { type: 'planStart', ...d }));
    this.orchestrator.on('planGenerated', (d) => this.io.emit('agentUpdate', { type: 'planGenerated', ...d }));
    this.orchestrator.on('stepStart', (d) => this.io.emit('agentUpdate', { type: 'stepStart', ...d }));
    this.orchestrator.on('stepFinish', (d) => this.io.emit('agentUpdate', { type: 'stepFinish', ...d }));
    this.orchestrator.on('planFinish', (d) => this.io.emit('agentUpdate', { type: 'planFinish', ...d }));
  }

  start() {
    this.server.listen(this.port, () => {
      this.logger.info(`[Gateway] Must-b live at http://localhost:${this.port} — UI + API on single port`);
    });
  }
}
