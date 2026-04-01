/**
 * GhostGuard — Must-b Resource & Error Intelligence (v1.0)
 *
 * Four subsystems:
 *   1. Resource Monitor  — CPU + RAM sampling every 5s; emits 'liteMode' when RAM > 90%
 *   2. Log Scanner       — watches memory/logs/ for recurring error patterns
 *   3. Proactive Alerts  — emits 'alert' events consumed by ApiServer → Socket.io dashboard
 *   4. Auto-Heal Trigger — invokes doctor --fix for recoverable faults
 *
 * Usage (src/index.ts):
 *   const guard = new GhostGuard({ root, logger });
 *   guard.on('liteMode', ({ active }) => orchestrator.setLiteMode(active));
 *   apiServer.attachGuard(guard);
 *   guard.start();
 */
import { EventEmitter } from 'events';
import os              from 'os';
import fs              from 'fs';
import path            from 'path';
import { watch, type FSWatcher } from 'chokidar';
import winston         from 'winston';
import { LOGS_DIR }    from '../paths.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface GuardAlert {
  level:          AlertLevel;
  kind:           string;
  message:        string;
  recommendation: string;
  ts:             number;
}

export interface LiteModeEvent {
  active: boolean;
  reason: string;
}

// ── Error Pattern Registry ────────────────────────────────────────────────────

interface ErrorPattern {
  re:             RegExp;
  kind:           string;
  level:          AlertLevel;
  message:        string;
  recommendation: string;
  /** Whether doctor --fix can address this */
  healable:       boolean;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    re: /connection refused|ECONNREFUSED/i,
    kind: 'network',
    level: 'warning',
    message: 'Ağ bağlantısı reddedildi.',
    recommendation: 'LLM provider\'a ulaşılamıyor. .env içindeki API anahtarını ve ağ bağlantısını kontrol et.',
    healable: false,
  },
  {
    re: /model not found|model.*does not exist|no such model/i,
    kind: 'model',
    level: 'warning',
    message: 'Belirtilen model bulunamadı.',
    recommendation: 'MUSTB_MODEL değişkenini kontrol et veya Settings > Model\'dan mevcut bir model seç.',
    healable: false,
  },
  {
    re: /JavaScript heap out of memory|out of memory/i,
    kind: 'oom',
    level: 'critical',
    message: 'Node.js bellek sınırına ulaşıldı.',
    recommendation: 'Daha küçük bir model seç veya NODE_OPTIONS=--max-old-space-size=4096 ile başlat.',
    healable: false,
  },
  {
    re: /python.*not found|pip.*not found|\'python\' is not recognized/i,
    kind: 'path',
    level: 'warning',
    message: 'Python PATH\'te bulunamadı.',
    recommendation: 'must-b doctor --fix ile otomatik onarım başlatılacak.',
    healable: true,
  },
  {
    re: /cannot find module|module not found/i,
    kind: 'module',
    level: 'warning',
    message: 'Eksik Node.js modülü tespit edildi.',
    recommendation: 'must-b doctor --fix ile npm bağımlılıkları onarılacak.',
    healable: true,
  },
  {
    re: /ENOENT.*node_modules/i,
    kind: 'deps',
    level: 'warning',
    message: 'node_modules eksik veya bozuk.',
    recommendation: 'must-b doctor --fix ile npm install tetiklenecek.',
    healable: true,
  },
];

// ── RAM Thresholds ────────────────────────────────────────────────────────────

const RAM_LITE_PCT    = 90;  // activate lite mode
const RAM_WARN_PCT    = 85;  // emit warning alert
const RAM_CRIT_PCT    = 95;  // emit critical alert
const CPU_WARN_PCT    = 95;  // CPU saturation threshold

// Minimum gap between same-kind alerts (ms)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ── GhostGuard ────────────────────────────────────────────────────────────────

export class GhostGuard extends EventEmitter {
  private logger:         winston.Logger;
  private root:           string;
  private logDir:         string;
  private resourceTimer:  ReturnType<typeof setInterval> | null = null;
  private logWatcher:     FSWatcher | null = null;
  private liteActive      = false;
  private healing         = false;
  private lastAlertTs:    Map<string, number> = new Map();
  // Latest sampled values — exposed via getStats()
  private _lastCpu        = 0;
  private _lastRam        = 0;
  // Track log-pattern hit counts (kind → [count, windowStart])
  private patternHits:    Map<string, [number, number]> = new Map();
  private readonly PATTERN_WINDOW_MS = 5 * 60 * 1000;
  private readonly PATTERN_THRESHOLD = 3;

  constructor(opts: { root: string; logger: winston.Logger }) {
    super();
    this.root   = opts.root;
    this.logger = opts.logger;
    this.logDir = LOGS_DIR;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    this.startResourceMonitor();
    this.startLogScanner();
    this.logger.info('[GhostGuard] Resource monitor + log scanner active.');
  }

  /** Current system snapshot — safe to call at any frequency. */
  getStats(): { cpu: number; ram: number; liteMode: boolean; ts: number } {
    return {
      cpu:      Math.round(this._lastCpu),
      ram:      Math.round(this._lastRam),
      liteMode: this.liteActive,
      ts:       Date.now(),
    };
  }

  stop(): void {
    if (this.resourceTimer) { clearInterval(this.resourceTimer); this.resourceTimer = null; }
    this.logWatcher?.close();
    this.logWatcher = null;
    this.logger.info('[GhostGuard] Stopped.');
  }

  // ── Resource Monitor ───────────────────────────────────────────────────────

  private startResourceMonitor(): void {
    // Initial CPU baseline sample
    let prevCpuSample = this.sampleCpu();

    this.resourceTimer = setInterval(() => {
      const ram  = this.ramUsagePct();
      const curr = this.sampleCpu();
      const cpu  = this.deltaCpu(prevCpuSample, curr);
      prevCpuSample = curr;

      this.onResourceSample(cpu, ram);
    }, 5_000);

    this.resourceTimer.unref();
  }

  private ramUsagePct(): number {
    const total = os.totalmem();
    const free  = os.freemem();
    return ((total - free) / total) * 100;
  }

  private sampleCpu(): { idle: number; total: number } {
    let idle = 0, total = 0;
    for (const cpu of os.cpus()) {
      for (const v of Object.values(cpu.times)) total += v;
      idle += cpu.times.idle;
    }
    return { idle, total };
  }

  private deltaCpu(prev: { idle: number; total: number }, curr: { idle: number; total: number }): number {
    const dTotal = curr.total - prev.total;
    const dIdle  = curr.idle  - prev.idle;
    if (dTotal === 0) return 0;
    return Math.max(0, Math.min(100, 100 * (1 - dIdle / dTotal)));
  }

  private onResourceSample(cpu: number, ram: number): void {
    this._lastCpu = cpu;
    this._lastRam = ram;
    // ── Lite mode toggle ────────────────────────────────────────────────────
    if (ram >= RAM_LITE_PCT && !this.liteActive) {
      this.liteActive = true;
      const reason = `RAM kullanımı %${ram.toFixed(1)} — Hafif Mod aktif`;
      this.logger.warn(`[GhostGuard] ${reason}`);
      this.emit('liteMode', { active: true, reason } satisfies LiteModeEvent);
    } else if (ram < RAM_LITE_PCT - 5 && this.liteActive) {
      this.liteActive = false;
      const reason = `RAM kullanımı %${ram.toFixed(1)}'e düştü — Hafif Mod devre dışı`;
      this.logger.info(`[GhostGuard] ${reason}`);
      this.emit('liteMode', { active: false, reason } satisfies LiteModeEvent);
    }

    // ── Critical RAM alert ──────────────────────────────────────────────────
    if (ram >= RAM_CRIT_PCT) {
      const model = process.env.LLM_MODEL ?? process.env.MUSTB_MODEL ?? '';
      const isHeavy = /70b|32b|34b|72b/i.test(model);
      this.emitAlert({
        level: 'critical',
        kind: 'ram_critical',
        message: `CEO, RAM kullanımı %${ram.toFixed(1)} — sistem kilitlenme riski.`,
        recommendation: isHeavy
          ? `${model} için RAM seviyeniz kritik. 8B veya 14B bir model önerilir.`
          : 'Gereksiz uygulamaları kapatın veya Must-b\'yi yeniden başlatın.',
      });
    } else if (ram >= RAM_WARN_PCT) {
      const model = process.env.LLM_MODEL ?? process.env.MUSTB_MODEL ?? '';
      const isHeavy = /70b|32b|34b|72b/i.test(model);
      this.emitAlert({
        level: 'warning',
        kind: 'ram_high',
        message: `RAM kullanımı %${ram.toFixed(1)} — performans düşebilir.`,
        recommendation: isHeavy
          ? `CEO, ${model} modeli için RAM seviyeniz riskli. Performansı korumak için 8B model önerilir.`
          : 'RAM kullanımı yüksek. Hafif Mod aktifleşebilir.',
      });
    }

    // ── CPU saturation alert ────────────────────────────────────────────────
    if (cpu >= CPU_WARN_PCT) {
      this.emitAlert({
        level: 'warning',
        kind: 'cpu_high',
        message: `CPU kullanımı %${cpu.toFixed(1)} — LLM yükü sistemi zorluyor.`,
        recommendation: 'Aktif arka plan işlemlerini kapatın veya daha küçük bir model seçin.',
      });
    }
  }

  // ── Log Scanner ────────────────────────────────────────────────────────────

  private startLogScanner(): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch { /* best-effort */ }

    // Watch for new/changed error log files
    this.logWatcher = watch(path.join(this.logDir, '*.md'), {
      ignoreInitial: true,
      persistent: false,
    });

    this.logWatcher.on('add',    fp => this.scanLogFile(fp));
    this.logWatcher.on('change', fp => this.scanLogFile(fp));
  }

  private scanLogFile(filePath: string): void {
    let content = '';
    try { content = fs.readFileSync(filePath, 'utf-8'); }
    catch { return; }

    for (const pat of ERROR_PATTERNS) {
      if (!pat.re.test(content)) continue;

      const now = Date.now();
      const [count, windowStart] = this.patternHits.get(pat.kind) ?? [0, now];

      // Reset window if expired
      const newCount = (now - windowStart < this.PATTERN_WINDOW_MS) ? count + 1 : 1;
      const newStart = (now - windowStart < this.PATTERN_WINDOW_MS) ? windowStart : now;
      this.patternHits.set(pat.kind, [newCount, newStart]);

      if (newCount >= this.PATTERN_THRESHOLD) {
        this.logger.warn(`[GhostGuard] Tekrarlayan hata: ${pat.kind} (${newCount}×)`);
        this.emitAlert({
          level:          pat.level,
          kind:           pat.kind,
          message:        `Tekrarlayan hata (${newCount}×): ${pat.message}`,
          recommendation: pat.recommendation,
        });
        this.patternHits.set(pat.kind, [0, now]); // reset after alert

        if (pat.healable) {
          this.triggerAutoHeal(pat.kind);
        }
      }
      break; // one match per file scan
    }
  }

  // ── Auto-Heal ──────────────────────────────────────────────────────────────

  private triggerAutoHeal(kind: string): void {
    if (this.healing) return;
    this.healing = true;

    this.logger.info(`[GhostGuard] Auto-heal başlatılıyor: ${kind}`);
    this.emit('autoHeal', { kind, message: `doctor --fix tetiklendi (${kind})` });

    // Import runDoctor dynamically to keep the guard module lean at parse time
    import('../../commands/doctor.js')
      .then(({ runDoctor }) => runDoctor(this.root, true, true))
      .then(() => {
        this.logger.info('[GhostGuard] Auto-heal tamamlandı.');
      })
      .catch((e: Error) => {
        this.logger.error(`[GhostGuard] Auto-heal başarısız: ${e.message}`);
      })
      .finally(() => {
        this.healing = false;
      });
  }

  // ── Alert Emitter ──────────────────────────────────────────────────────────

  private emitAlert(opts: Omit<GuardAlert, 'ts'>): void {
    const now = Date.now();
    const last = this.lastAlertTs.get(opts.kind) ?? 0;
    if (now - last < ALERT_COOLDOWN_MS) return; // cooldown active
    this.lastAlertTs.set(opts.kind, now);

    const alert: GuardAlert = { ...opts, ts: now };
    this.logger.warn(`[GhostGuard] Alert [${alert.level}/${alert.kind}]: ${alert.message}`);
    this.emit('alert', alert);
  }
}
