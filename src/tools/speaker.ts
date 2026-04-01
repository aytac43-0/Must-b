/**
 * Speaker — Must-b TTS Engine (v1.23.1)
 *
 * Speaks assistant responses using the best available TTS backend:
 *   1. OpenAI TTS  — if OPENAI_API_KEY is set (high quality, streams audio)
 *   2. System TTS  — OS-native, zero extra dependencies:
 *        Windows  → PowerShell SAPI5 SpeechSynthesizer
 *        macOS    → `say` command
 *        Linux    → `espeak` (falls back to `festival` if unavailable)
 *
 * Socket.io contract (v1.23.1):
 *   io.emit('assistantSpeaking', { speaking: true,  text: '<preview>' })  — on start
 *   io.emit('assistantSpeaking', { speaking: false, text: '' })           — on finish/stop
 *
 * Usage:
 *   import { speak, stop, isSpeaking } from './speaker.js';
 *   await speak('Merhaba!', io);
 *   stop();   // interrupts current speech immediately
 */

import { spawn }     from 'node:child_process';
import { tmpdir }    from 'node:os';
import { join }      from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import type { Server as SocketServer } from 'socket.io';

// ── Internal state ─────────────────────────────────────────────────────────

let _proc:     ReturnType<typeof spawn> | null = null;
let _speaking  = false;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip HTML tags and trim whitespace */
function sanitize(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Emit assistantSpeaking Socket.io event if io is provided */
function emitState(io: SocketServer | undefined, speaking: boolean, text = ''): void {
  io?.emit('assistantSpeaking', { speaking, text: speaking ? text.slice(0, 140) : '' });
}

// ── Platform TTS commands ──────────────────────────────────────────────────

interface TTSCmd { cmd: string; args: string[] }

function buildSystemCmd(text: string): TTSCmd | null {
  const p = process.platform;

  if (p === 'win32') {
    // PowerShell SAPI5 — available on all Windows versions, no install needed
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/"/g, '`"');
    return {
      cmd:  'powershell',
      args: [
        '-NoProfile', '-NonInteractive', '-Command',
        `Add-Type -AssemblyName System.Speech; ` +
        `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
        `$s.Rate = 1; $s.Volume = 100; $s.Speak('${escaped}')`,
      ],
    };
  }

  if (p === 'darwin') {
    return { cmd: 'say', args: ['-r', '175', text] };
  }

  if (p === 'linux') {
    // espeak is the most commonly installed voice synth on Linux
    return { cmd: 'espeak', args: ['-s', '150', '-a', '180', text] };
  }

  return null;
}

// ── OpenAI TTS ─────────────────────────────────────────────────────────────

/**
 * Speak via OpenAI TTS API (tts-1 model, alloy voice).
 * Writes audio to a temp file, then plays it with the platform audio player.
 * Requires OPENAI_API_KEY in env.
 */
async function speakOpenAI(text: string, io?: SocketServer): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No OPENAI_API_KEY');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: 'tts-1', voice: 'alloy', input: text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS ${response.status}: ${body}`);
  }

  const buf  = Buffer.from(await response.arrayBuffer());
  const tmp  = join(tmpdir(), `mustb-tts-${Date.now()}.mp3`);
  await writeFile(tmp, buf);

  await playAudioFile(tmp, io);
  await unlink(tmp).catch(() => {});
}

/**
 * Play an audio file using the platform's default audio player.
 */
function playAudioFile(filePath: string, io?: SocketServer): Promise<void> {
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];

    if (process.platform === 'win32') {
      cmd  = 'powershell';
      args = ['-NoProfile', '-NonInteractive', '-Command',
        `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
    } else if (process.platform === 'darwin') {
      cmd  = 'afplay';
      args = [filePath];
    } else {
      // Linux: try mpg123 (common), fall back to aplay
      cmd  = 'mpg123';
      args = ['-q', filePath];
    }

    _proc = spawn(cmd, args, { stdio: 'ignore' });
    _proc.on('close', () => {
      _proc = null;
      resolve();
    });
    _proc.on('error', () => {
      _proc = null;
      resolve();
    });
  });
}

// ── System TTS player ──────────────────────────────────────────────────────

function speakSystem(text: string, io?: SocketServer): Promise<void> {
  return new Promise((resolve) => {
    const ttsCmd = buildSystemCmd(text);
    if (!ttsCmd) {
      io && emitState(io, false);
      resolve();
      return;
    }

    _proc = spawn(ttsCmd.cmd, ttsCmd.args, { stdio: 'ignore' });
    _proc.on('close', () => {
      _proc = null;
      resolve();
    });
    _proc.on('error', () => {
      // TTS binary not found — silently degrade
      _proc = null;
      resolve();
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Speak text aloud.
 *
 * - Strips HTML/markdown artefacts before sending to TTS.
 * - Emits `assistantSpeaking: { speaking: true }` at start.
 * - Emits `assistantSpeaking: { speaking: false }` when done or on error.
 * - Tries OpenAI TTS first (if OPENAI_API_KEY is set); falls back to system TTS.
 * - Any in-progress speech is stopped before the new one begins.
 *
 * @param text  Text to speak (may contain HTML — will be stripped)
 * @param io    Optional Socket.io server for real-time events
 */
export async function speak(text: string, io?: SocketServer): Promise<void> {
  stop(); // cancel any current speech

  const clean = sanitize(text);
  if (!clean) return;

  _speaking = true;
  emitState(io, true, clean);

  try {
    if (process.env.OPENAI_API_KEY && process.env.MUSTB_TTS_OPENAI !== 'false') {
      await speakOpenAI(clean, io);
    } else {
      await speakSystem(clean, io);
    }
  } catch {
    // Silently fall back to system TTS if OpenAI fails
    try { await speakSystem(clean, io); } catch { /* ignore */ }
  } finally {
    _speaking = false;
    emitState(io, false);
  }
}

/**
 * Stop any in-progress speech immediately.
 * Emits `assistantSpeaking: { speaking: false }` if io is provided.
 *
 * @param io  Optional Socket.io server for real-time event
 */
export function stop(io?: SocketServer): void {
  if (_proc) {
    try { _proc.kill('SIGTERM'); } catch { /* ignore */ }
    _proc = null;
  }
  if (_speaking) {
    _speaking = false;
    io?.emit('assistantSpeaking', { speaking: false, text: '' });
  }
}

/** Returns true while TTS audio is actively playing. */
export function isSpeaking(): boolean {
  return _speaking;
}
