/**
 * Emotional Tone Observer (v4.9) — Synthetic Consciousness
 *
 * Detects the emotional tone of user messages by scoring word patterns.
 * No LLM call required — runs locally, < 1ms per message.
 *
 * Tone categories:
 *   'stress'  — frustration, urgency, negative signals (red tint)
 *   'urgent'  — time-pressure, priority demands (orange tint)
 *   'focused' — task language, technical precision (blue tint)
 *   'normal'  — calm conversational tone (neutral / no tint)
 *
 * Public API:
 *   analyzeTone(text)           → ToneResult
 *   observeHistory(messages)    → ToneResult (aggregated over recent messages)
 *   getToneTheme(tone)          → ToneTheme (CSS colour tokens)
 *   onToneChange(cb)            → subscribe to tone change events
 *   emitTone(result)            → push a tone update to subscribers
 */

import { EventEmitter } from 'events';

// ── Types ─────────────────────────────────────────────────────────────────

export type Tone = 'stress' | 'urgent' | 'focused' | 'normal';

export interface ToneResult {
  tone:    Tone;
  score:   number;   // 0–1 confidence
  signals: string[]; // matched keywords / patterns
}

export interface ToneTheme {
  tone:           Tone;
  accentColor:    string;  // hex
  glowColor:      string;  // rgba
  borderColor:    string;  // rgba
  badgeLabel:     string;
  badgeClass:     string;  // tailwind class
}

// ── Keyword banks ─────────────────────────────────────────────────────────

const STRESS_WORDS = new Set([
  'error', 'broken', 'bug', 'crash', 'fail', 'failed', 'wrong', 'bad',
  'terrible', 'horrible', 'awful', 'hate', 'frustrated', 'frustrating',
  'annoying', 'annoyed', 'stuck', 'not working', 'doesnt work', "doesn't work",
  'cant', "can't", 'fix', 'help', 'ugh', 'argh', 'wtf', 'damn', 'shit',
  'problem', 'issue', 'broken again', 'still broken', 'why is',
]);

const URGENT_WORDS = new Set([
  'asap', 'urgent', 'immediately', 'right now', 'hurry', 'quick', 'fast',
  'quickly', 'deadline', 'critical', 'priority', 'important', 'now',
  'emergency', 'rush', 'time-sensitive', 'no time', 'running out',
  'need it now', 'must be done', 'by tomorrow', 'by today', 'by eod',
  'need this', 'need asap', 'please hurry', 'please fast',
]);

const FOCUSED_WORDS = new Set([
  'implement', 'build', 'create', 'write', 'code', 'function', 'class',
  'module', 'algorithm', 'optimize', 'refactor', 'analyze', 'review',
  'test', 'debug', 'deploy', 'configure', 'setup', 'install', 'update',
  'research', 'investigate', 'check', 'verify', 'compare', 'calculate',
  'generate', 'parse', 'extract', 'transform', 'convert', 'migrate',
]);

// ── Scoring ───────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean);
}

function multigramMatch(text: string, bank: Set<string>): string[] {
  const lower   = text.toLowerCase();
  const matched: string[] = [];
  for (const phrase of bank) {
    if (lower.includes(phrase)) matched.push(phrase);
  }
  return matched;
}

function score(matched: string[], total: number): number {
  if (matched.length === 0 || total === 0) return 0;
  // Logarithmic scale — 1 match = ~0.25, 3 = ~0.55, 5+ = 0.85
  return Math.min(1, 0.18 + Math.log(matched.length + 1) * 0.35);
}

/**
 * Analyze the emotional tone of a single text string.
 */
export function analyzeTone(text: string): ToneResult {
  if (!text || text.trim().length < 3) {
    return { tone: 'normal', score: 0, signals: [] };
  }

  const tokens        = tokenize(text);
  const total         = tokens.length;

  const stressSignals  = multigramMatch(text, STRESS_WORDS);
  const urgentSignals  = multigramMatch(text, URGENT_WORDS);
  const focusedSignals = multigramMatch(text, FOCUSED_WORDS);

  const stressScore  = score(stressSignals, total);
  const urgentScore  = score(urgentSignals, total);
  const focusedScore = score(focusedSignals, total);

  // Exclamation marks boost stress/urgent
  const exclamations = (text.match(/!/g) ?? []).length;
  const capsRatio    = (text.match(/[A-Z]/g) ?? []).length / Math.max(text.length, 1);

  const urgentBoost = Math.min(0.3, exclamations * 0.08 + (capsRatio > 0.4 ? 0.15 : 0));

  const finalStress  = Math.min(1, stressScore + (stressScore > 0 ? urgentBoost : 0));
  const finalUrgent  = Math.min(1, urgentScore + urgentBoost);
  const finalFocused = focusedScore;

  // Determine dominant tone
  const best = Math.max(finalStress, finalUrgent, finalFocused);

  if (best < 0.18) {
    return { tone: 'normal', score: 0, signals: [] };
  }

  if (finalStress >= finalUrgent && finalStress >= finalFocused) {
    return { tone: 'stress', score: finalStress, signals: stressSignals };
  }
  if (finalUrgent >= finalFocused) {
    return { tone: 'urgent', score: finalUrgent, signals: urgentSignals };
  }
  return { tone: 'focused', score: finalFocused, signals: focusedSignals };
}

/**
 * Aggregate tone over the last N messages (sliding window = 5).
 * Returns the dominant tone found.
 */
export function observeHistory(messages: string[], windowSize = 5): ToneResult {
  const recent  = messages.slice(-windowSize);
  const results = recent.map(analyzeTone);

  const counts: Record<Tone, number> = { stress: 0, urgent: 0, focused: 0, normal: 0 };
  const scores: Record<Tone, number> = { stress: 0, urgent: 0, focused: 0, normal: 0 };
  const allSignals: string[] = [];

  for (const r of results) {
    counts[r.tone]++;
    scores[r.tone] = Math.max(scores[r.tone], r.score);
    allSignals.push(...r.signals);
  }

  // Weighted: stress always dominates if present in ≥2 messages
  if (counts.stress >= 2) return { tone: 'stress', score: scores.stress, signals: [...new Set(allSignals)] };
  if (counts.urgent >= 2) return { tone: 'urgent', score: scores.urgent, signals: [...new Set(allSignals)] };

  const dominant = (Object.keys(counts) as Tone[]).reduce((a, b) => counts[a] >= counts[b] ? a : b);
  return { tone: dominant, score: scores[dominant], signals: [...new Set(allSignals)] };
}

// ── Theme mapping ─────────────────────────────────────────────────────────

const TONE_THEMES: Record<Tone, ToneTheme> = {
  stress: {
    tone:        'stress',
    accentColor: '#ef4444',
    glowColor:   'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.25)',
    badgeLabel:  'Stress Detected',
    badgeClass:  'bg-red-500/15 text-red-400 border-red-500/25',
  },
  urgent: {
    tone:        'urgent',
    accentColor: '#f97316',
    glowColor:   'rgba(249,115,22,0.15)',
    borderColor: 'rgba(249,115,22,0.25)',
    badgeLabel:  'Urgent Mode',
    badgeClass:  'bg-orange-500/15 text-orange-400 border-orange-500/25',
  },
  focused: {
    tone:        'focused',
    accentColor: '#3b82f6',
    glowColor:   'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.20)',
    badgeLabel:  'Deep Focus',
    badgeClass:  'bg-blue-500/12 text-blue-400 border-blue-500/20',
  },
  normal: {
    tone:        'normal',
    accentColor: '#f97316',
    glowColor:   'rgba(249,115,22,0.08)',
    borderColor: 'rgba(255,255,255,0.06)',
    badgeLabel:  'Normal',
    badgeClass:  'bg-white/5 text-gray-500 border-white/8',
  },
};

/**
 * Get CSS/design tokens for a given tone.
 */
export function getToneTheme(tone: Tone): ToneTheme {
  return TONE_THEMES[tone];
}

// ── Event bus ─────────────────────────────────────────────────────────────

const _toneEvents = new EventEmitter();
_toneEvents.setMaxListeners(20);

/**
 * Subscribe to tone change events.
 * Callback receives ToneResult whenever emitTone() is called.
 */
export function onToneChange(cb: (result: ToneResult) => void): () => void {
  _toneEvents.on('tone', cb);
  return () => _toneEvents.off('tone', cb);
}

/**
 * Broadcast a tone result to all subscribers.
 * Call this from api.ts whenever a new user message arrives.
 */
export function emitTone(result: ToneResult): void {
  _toneEvents.emit('tone', result);
}
