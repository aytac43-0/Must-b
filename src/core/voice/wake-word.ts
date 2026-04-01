/**
 * WakeWordDetector — Must-b Voice Core (v1.23.1)
 *
 * Listens for "Hey Must-b" (or any configured phrase) and wakes
 * the Orchestrator with the remainder of the utterance as the goal.
 *
 * Trigger sources:
 *   1. Frontend Web Speech API → Socket.io 'wakeWord' event (attachToSocket)
 *   2. POST /api/voice/transcribe result piped here via processTranscript()
 *   3. Direct call via trigger() — e.g., from /api/voice/wake
 *
 * Cooldown: 3 s between triggers to prevent rapid re-fires.
 * The detector can be started/stopped independently of the orchestrator.
 */

import { EventEmitter }      from 'node:events';
import type { Server }       from 'socket.io';
import type { Orchestrator } from '../orchestrator.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface WakeWordConfig {
  /** The phrase to detect — case-insensitive. Default: 'hey must-b' */
  phrase:      string;
  /** Minimum ms between successive triggers. Default: 3000 */
  cooldownMs:  number;
}

export interface WakeEvent {
  transcript: string;
  goal:       string;
  ts:         number;
}

// ── WakeWordDetector ──────────────────────────────────────────────────────

export class WakeWordDetector extends EventEmitter {
  private orchestrator: Orchestrator;
  private cfg: Required<WakeWordConfig>;
  private lastTrigger = 0;
  private _listening  = false;

  constructor(orchestrator: Orchestrator, config?: Partial<WakeWordConfig>) {
    super();
    this.orchestrator = orchestrator;
    this.cfg = {
      phrase:     (config?.phrase     ?? 'hey must-b').toLowerCase().trim(),
      cooldownMs:  config?.cooldownMs ?? 3000,
    };
  }

  // ── State ─────────────────────────────────────────────────────────────

  get isListening(): boolean { return this._listening; }

  start(): void {
    if (this._listening) return;
    this._listening = true;
    this.emit('listening', true);
  }

  stop(): void {
    if (!this._listening) return;
    this._listening = false;
    this.emit('listening', false);
  }

  // ── Core trigger logic ────────────────────────────────────────────────

  private _canTrigger(): boolean {
    return Date.now() - this.lastTrigger >= this.cfg.cooldownMs;
  }

  private _fire(transcript: string, goal: string): void {
    this.lastTrigger = Date.now();
    const ev: WakeEvent = { transcript, goal, ts: this.lastTrigger };
    this.emit('triggered', ev);
    const runGoal = goal.length > 2
      ? goal
      : 'Dinliyorum. Nasıl yardımcı olabilirim?';
    this.orchestrator.run(runGoal).catch(() => {});
  }

  /**
   * Feed a speech-to-text transcript into the detector.
   * Strips the wake phrase and passes the remainder to the orchestrator.
   * Returns true if the wake phrase was detected and acted on.
   */
  processTranscript(transcript: string): boolean {
    if (!this._listening || !this._canTrigger()) return false;
    const norm = transcript.toLowerCase().trim();
    const idx  = norm.indexOf(this.cfg.phrase);
    if (idx === -1) return false;
    const goal = norm.slice(idx + this.cfg.phrase.length).trim();
    this._fire(transcript, goal);
    return true;
  }

  /**
   * Direct trigger — bypasses phrase matching.
   * Used by /api/voice/wake and Socket.io 'wakeWord' events
   * when the caller already knows the phrase was detected.
   */
  trigger(goal = ''): void {
    if (!this._canTrigger()) return;
    // Auto-start listening if called directly
    if (!this._listening) this.start();
    this._fire(goal, goal.trim());
  }

  // ── Socket.io integration ─────────────────────────────────────────────

  /**
   * Attach to a Socket.io server.
   * Listens for:
   *   'wakeWord'   — { goal?: string }  fired by the frontend WakeWordListener
   *   'transcript' — { text: string }   fired after Whisper transcription
   *
   * Re-broadcasts 'wakeTriggered' to all clients so the VoiceFeedbackLayer
   * can react immediately without waiting for planStart.
   */
  attachToSocket(io: Server): void {
    io.on('connection', (socket) => {
      socket.on('wakeWord', (data: { goal?: string } = {}) => {
        if (!this._canTrigger()) return;
        if (!this._listening) this.start();
        const goal = (data?.goal ?? '').trim();
        this._fire(goal, goal);
        io.emit('wakeTriggered', { goal, ts: Date.now() });
      });

      socket.on('transcript', (data: { text?: string } = {}) => {
        const text = (data?.text ?? '').trim();
        if (!text) return;
        const triggered = this.processTranscript(text);
        if (triggered) {
          io.emit('wakeTriggered', { goal: text, ts: Date.now() });
        }
      });
    });
  }
}
