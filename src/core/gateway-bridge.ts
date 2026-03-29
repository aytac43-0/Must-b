/**
 * src/core/gateway-bridge.ts — Must-b Native Gateway Bridge
 *
 * Maintains a single persistent WebSocket connection to the local
 * Must-b gateway daemon. Implements the challenge-response handshake
 * + RPC frame protocol. All /api/gateway/* endpoints use this bridge.
 *
 * Environment:
 *   MUSTB_GATEWAY_PORT     — default 18789
 *   MUSTB_GATEWAY_PASSWORD — optional password auth
 *   MUSTB_GATEWAY_TOKEN    — optional token auth
 */

import { WebSocket } from 'ws';
import crypto from 'crypto';
import winston from 'winston';

export class MustbGatewayBridge {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private logger: winston.Logger;
  private connected = false;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.connect();
  }

  isAlive(): boolean { return this.connected; }

  private get url(): string {
    return `ws://127.0.0.1:${process.env.MUSTB_GATEWAY_PORT ?? '18789'}`;
  }

  private connect() {
    if (this.connected) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url, { maxPayload: 25 * 1024 * 1024 });
    } catch {
      this.scheduleReconnect();
      return;
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        // Server challenge — send connect handshake
        if (msg['event'] === 'connect.challenge') {
          const id = crypto.randomUUID();
          const params = {
            minProtocol: 3, maxProtocol: 3,
            client: {
              id: 'mustb-bridge',
              displayName: 'Must-b Bridge',
              version: '1.11.0',
              platform: process.platform,
              mode: 'backend',
            },
            caps: [] as string[],
            role: 'operator',
            scopes: ['operator.admin'],
            auth: process.env.MUSTB_GATEWAY_PASSWORD
              ? { password: process.env.MUSTB_GATEWAY_PASSWORD }
              : process.env.MUSTB_GATEWAY_TOKEN
              ? { token: process.env.MUSTB_GATEWAY_TOKEN }
              : undefined,
          };
          this.pending.set(id, {
            resolve: () => {
              this.connected = true;
              this.ws = ws;
              this.logger.info('[Gateway] Bridge connected and ready');
            },
            reject: (err) => {
              this.logger.warn(`[Gateway] Handshake failed: ${String(err)}`);
              ws.terminate();
            },
          });
          ws.send(JSON.stringify({ type: 'req', id, method: 'connect', params }));
          return;
        }

        // Response frame: { type: "res", id: "...", result?: ..., error?: ... }
        if (msg['type'] === 'res' && typeof msg['id'] === 'string') {
          const pend = this.pending.get(msg['id']);
          if (!pend) return;
          this.pending.delete(msg['id']);
          if (msg['error']) {
            const err = msg['error'] as Record<string, unknown>;
            pend.reject(new Error((err['message'] as string | undefined) ?? 'Gateway RPC error'));
          } else {
            pend.resolve(msg['result']);
          }
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on('close', () => {
      this.connected = false;
      if (this.ws === ws) this.ws = null;
      for (const [, p] of this.pending) p.reject({ offline: true });
      this.pending.clear();
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      this.logger.debug(`[Gateway] WS error: ${err.message}`);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5_000);
    this.reconnectTimer.unref();
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    if (!this.connected) {
      // Wait up to 2s for a connection
      await new Promise<void>((res, rej) => {
        const start = Date.now();
        const timer = setInterval(() => {
          if (this.connected) { clearInterval(timer); res(); }
          else if (Date.now() - start > 2000) { clearInterval(timer); rej({ offline: true }); }
        }, 100);
      });
    }
    if (!this.connected || !this.ws) throw { offline: true };

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pending.set(id, { resolve, reject });
      try {
        this.ws!.send(JSON.stringify({ type: 'req', id, method, params: params ?? {} }));
      } catch {
        this.pending.delete(id);
        reject({ offline: true });
        return;
      }
      // 10-second RPC timeout
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Gateway RPC timeout: ${method}`));
        }
      }, 10_000);
    });
  }
}
