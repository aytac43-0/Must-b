/**
 * NightOwl — Autonomous Night-Shift Scheduler (v1.17.0)
 *
 * Monitors GhostGuard resource stats on a 90-second poll cycle.
 * When the system is considered "idle" (CPU < CPU_IDLE_PCT, RAM < RAM_IDLE_PCT,
 * orchestrator not busy), it runs a multi-task deep scan and indexes all
 * findings into LTM Semantic Memory with the tag 'NightShift-Insights'.
 *
 * Deep Scan Tasks
 * ───────────────
 *   1. Code Health    — TODO/FIXME/@ts-ignore/console.error density per file
 *   2. Dep Audit      — package.json: 0.x versions, missing lockfile, dep count
 *   3. Log Analysis   — memory/logs/*.md recurring error patterns
 *   4. LTM Gap        — semantic memory coverage vs. episodic volume
 *   5. Workspace Diff — files changed since last NightOwl run (mtime)
 *
 * Events emitted
 * ─────────────
 *   'nightShiftStart'  { ts, idleCpu, idleRam }
 *   'nightShiftEnd'    { ts, findingsCount, durationMs }
 *   'finding'          { task, summary, ts }
 *
 * Wire-up (src/index.ts)
 * ──────────────────────
 *   const owl = new NightOwl({ root, guard, intelligence, ltm, logger, orchestrator });
 *   apiServer.attachNightOwl(owl);
 *   owl.start();
 */

import { EventEmitter } from 'events';
import fs               from 'fs';
import path             from 'path';
import winston          from 'winston';
import { LOGS_DIR }     from '../paths.js';
import type { GhostGuard }          from '../guard/ghost-guard.js';
import type { ProjectIntelligence } from '../intelligence/project-intelligence.js';
import type { LTMController }       from '../memory/ltm.js';
import type { Orchestrator }        from '../orchestrator.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

const CPU_IDLE_PCT        = 15;   // CPU usage must be below this
const RAM_IDLE_PCT        = 65;   // RAM usage must be below this
const POLL_INTERVAL_MS    = 90_000;        // idle-check cadence
const SHIFT_COOLDOWN_MS   = 2 * 60 * 60 * 1000; // min gap between shifts (2 h)
const MAX_SCAN_FILES      = 200;  // cap file walk to avoid long scans
const MAX_FILE_BYTES      = 80_000; // skip files larger than 80 KB

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NightShiftFinding {
  task:    string;
  summary: string;
  ts:      number;
}

export interface NightOwlStatus {
  running:        boolean;
  scanning:       boolean;
  lastShiftTs:    number | null;
  lastShiftMs:    number | null;
  totalFindings:  number;
  idleCpu:        number;
  idleRam:        number;
}

// ── Code Health patterns ──────────────────────────────────────────────────────

interface CodeIssue {
  pattern: RegExp;
  label:   string;
}

const CODE_ISSUES: CodeIssue[] = [
  { pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,         label: 'TODO/FIXME' },
  { pattern: /\/\/\s*@ts-ignore/g,                       label: '@ts-ignore' },
  { pattern: /console\.error\s*\(/g,                     label: 'console.error' },
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,            label: 'empty catch' },
  { pattern: /throw new Error\(\s*['"]{2}\s*\)/g,        label: 'empty Error' },
  { pattern: /any(?:\s*[;,)\]])/g,                       label: 'explicit any' },
];

// ── NightOwl ──────────────────────────────────────────────────────────────────

export class NightOwl extends EventEmitter {
  private logger:       winston.Logger;
  private root:         string;
  private guard:        GhostGuard;
  private intelligence: ProjectIntelligence;
  private ltm:          LTMController;
  private orchestrator: Orchestrator | null;

  private _running      = false;
  private _scanning     = false;
  private _pollTimer:   ReturnType<typeof setInterval> | null = null;
  private _lastShiftTs: number | null = null;
  private _lastShiftMs: number | null = null;
  private _totalFindings = 0;
  private _lastIdleCpu  = 0;
  private _lastIdleRam  = 0;
  // mtime watermark — only report files changed after this
  private _lastScanWatermark = 0;

  constructor(opts: {
    root:          string;
    guard:         GhostGuard;
    intelligence:  ProjectIntelligence;
    ltm:           LTMController;
    logger:        winston.Logger;
    orchestrator?: Orchestrator;
  }) {
    super();
    this.root         = opts.root;
    this.guard        = opts.guard;
    this.intelligence = opts.intelligence;
    this.ltm          = opts.ltm;
    this.logger       = opts.logger;
    this.orchestrator = opts.orchestrator ?? null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  start(): void {
    if (this._running) return;
    this._running = true;

    this._pollTimer = setInterval(() => this._onPoll(), POLL_INTERVAL_MS);
    this._pollTimer.unref();

    this.logger.info('[NightOwl] Scheduler active — idle poll every 90s.');
  }

  stop(): void {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    this._running = false;
    this.logger.info('[NightOwl] Scheduler stopped.');
  }

  /** Manually trigger a night shift (bypasses idle check + cooldown). */
  async triggerNow(): Promise<NightShiftFinding[]> {
    return this._runNightShift(true);
  }

  getStatus(): NightOwlStatus {
    return {
      running:       this._running,
      scanning:      this._scanning,
      lastShiftTs:   this._lastShiftTs,
      lastShiftMs:   this._lastShiftMs,
      totalFindings: this._totalFindings,
      idleCpu:       this._lastIdleCpu,
      idleRam:       this._lastIdleRam,
    };
  }

  // ── Idle Check ──────────────────────────────────────────────────────────────

  private _onPoll(): void {
    if (this._scanning) return; // shift already in progress

    const { cpu, ram } = this.guard.getStats();
    this._lastIdleCpu = cpu;
    this._lastIdleRam = ram;

    const orchestratorBusy = this.orchestrator?.busy ?? false;
    const isIdle = cpu < CPU_IDLE_PCT && ram < RAM_IDLE_PCT && !orchestratorBusy;

    if (!isIdle) return;

    // Cooldown gate
    const now = Date.now();
    if (this._lastShiftTs && now - this._lastShiftTs < SHIFT_COOLDOWN_MS) return;

    this.logger.info(
      `[NightOwl] Sistem boşta (CPU: %${cpu.toFixed(1)}, RAM: %${ram.toFixed(1)}) — NightShift başlatılıyor.`,
    );

    this._runNightShift(false).catch((e: Error) => {
      this.logger.error(`[NightOwl] NightShift hatası: ${e.message}`);
    });
  }

  // ── Night Shift Orchestration ───────────────────────────────────────────────

  private async _runNightShift(manual: boolean): Promise<NightShiftFinding[]> {
    if (this._scanning) return [];
    this._scanning = true;

    const startTs = Date.now();
    const { cpu, ram } = this.guard.getStats();

    this.logger.info(`[NightOwl] NightShift başladı${manual ? ' (manuel)' : ''}.`);
    this.emit('nightShiftStart', { ts: startTs, idleCpu: cpu, idleRam: ram });

    const findings: NightShiftFinding[] = [];

    // Run all tasks sequentially — each yields ≥1 finding
    const tasks: Array<() => Promise<NightShiftFinding | null>> = [
      () => this._taskCodeHealth(),
      () => this._taskDepAudit(),
      () => this._taskLogAnalysis(),
      () => this._taskLtmGap(),
      () => this._taskWorkspaceDiff(),
    ];

    for (const task of tasks) {
      try {
        const finding = await task();
        if (finding) {
          findings.push(finding);
          this.emit('finding', finding);
          // Index immediately so findings are retrievable mid-shift
          this.ltm.indexSemantic(
            `[NightOwl ${new Date(finding.ts).toISOString()}] ${finding.task}: ${finding.summary}`,
            ['NightShift-Insights', finding.task],
          );
          this.logger.info(`[NightOwl] Bulgu (${finding.task}): ${finding.summary.slice(0, 120)}`);
        }
      } catch (e: any) {
        this.logger.warn(`[NightOwl] Görev başarısız (${e.message})`);
      }
    }

    const durationMs = Date.now() - startTs;
    this._lastShiftTs   = startTs;
    this._lastShiftMs   = durationMs;
    this._totalFindings += findings.length;
    this._lastScanWatermark = startTs;
    this._scanning = false;

    this.emit('nightShiftEnd', { ts: Date.now(), findingsCount: findings.length, durationMs });
    this.logger.info(
      `[NightOwl] NightShift tamamlandı — ${findings.length} bulgu, ${(durationMs / 1000).toFixed(1)}s.`,
    );

    return findings;
  }

  // ── Task 1: Code Health ─────────────────────────────────────────────────────

  private async _taskCodeHealth(): Promise<NightShiftFinding | null> {
    const srcDir = path.join(this.root, 'src');
    if (!fs.existsSync(srcDir)) return null;

    const fileCounts: Map<string, Map<string, number>> = new Map();
    let scanned = 0;

    const walk = (dir: string) => {
      if (scanned >= MAX_SCAN_FILES) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

      for (const e of entries) {
        if (scanned >= MAX_SCAN_FILES) return;
        const full = path.join(dir, e.name);

        if (e.isDirectory()) {
          if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(full);
          continue;
        }

        if (!/\.(ts|tsx|js|jsx)$/.test(e.name)) continue;
        scanned++;

        let content = '';
        try {
          const st = fs.statSync(full);
          if (st.size > MAX_FILE_BYTES) continue;
          content = fs.readFileSync(full, 'utf-8');
        } catch { continue; }

        const issueMap: Map<string, number> = new Map();
        for (const issue of CODE_ISSUES) {
          const matches = content.match(issue.pattern);
          if (matches && matches.length > 0) {
            issueMap.set(issue.label, (issueMap.get(issue.label) ?? 0) + matches.length);
          }
        }

        if (issueMap.size > 0) {
          const rel = path.relative(this.root, full).replace(/\\/g, '/');
          fileCounts.set(rel, issueMap);
        }
      }
    };

    walk(srcDir);

    if (fileCounts.size === 0) {
      return {
        task:    'CodeHealth',
        summary: `${scanned} dosya tarandı — kod sağlığı problemi tespit edilmedi.`,
        ts:      Date.now(),
      };
    }

    // Summarize hotspots
    const totalIssues = [...fileCounts.values()]
      .reduce((acc, m) => acc + [...m.values()].reduce((a, b) => a + b, 0), 0);

    const hotspots = [...fileCounts.entries()]
      .map(([file, m]) => ({
        file,
        count: [...m.values()].reduce((a, b) => a + b, 0),
        labels: [...m.entries()].map(([l, c]) => `${l}(${c})`).join(', '),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hotspotStr = hotspots
      .map(h => `  • ${h.file} [${h.labels}]`)
      .join('\n');

    return {
      task: 'CodeHealth',
      summary:
        `${scanned} dosya tarandı, ${fileCounts.size} dosyada toplam ${totalIssues} kod kalitesi sorunu bulundu.\n` +
        `En kritik dosyalar:\n${hotspotStr}`,
      ts: Date.now(),
    };
  }

  // ── Task 2: Dependency Audit ────────────────────────────────────────────────

  private async _taskDepAudit(): Promise<NightShiftFinding | null> {
    const pkgPath  = path.join(this.root, 'package.json');
    const lockPath = path.join(this.root, 'package-lock.json');
    const yarnLock = path.join(this.root, 'yarn.lock');
    const pnpmLock = path.join(this.root, 'pnpm-lock.yaml');

    if (!fs.existsSync(pkgPath)) return null;

    let pkg: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      name?: string;
      version?: string;
    };
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as typeof pkg;
    } catch {
      return {
        task:    'DepAudit',
        summary: 'package.json parse edilemiyor — JSON bozuk olabilir.',
        ts:      Date.now(),
      };
    }

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    const hasLockfile = fs.existsSync(lockPath) || fs.existsSync(yarnLock) || fs.existsSync(pnpmLock);

    // Risk flags
    const unstable: string[] = [];   // ^0.x versions
    const loose: string[]    = [];   // * or latest or >= with no upper bound

    for (const [name, version] of Object.entries(allDeps)) {
      const v = String(version);
      if (/^\^0\./.test(v) || /^~0\./.test(v)) unstable.push(`${name}@${v}`);
      if (v === '*' || v === 'latest' || /^>=\s*\d/.test(v)) loose.push(`${name}@${v}`);
    }

    const issues: string[] = [];
    if (!hasLockfile) issues.push('Lockfile bulunamadı (npm install sonrası versiyon kayması riski)');
    if (unstable.length > 0) issues.push(`${unstable.length} kararsız bağımlılık (0.x): ${unstable.slice(0, 5).join(', ')}`);
    if (loose.length > 0)    issues.push(`${loose.length} serbest versiyon kısıtı (*|latest|>=): ${loose.slice(0, 3).join(', ')}`);

    const depCount = Object.keys(allDeps).length;

    if (issues.length === 0) {
      return {
        task:    'DepAudit',
        summary: `${depCount} bağımlılık incelendi — risk faktörü tespit edilmedi. Lockfile: ${hasLockfile ? '✓' : '✗'}`,
        ts:      Date.now(),
      };
    }

    return {
      task:    'DepAudit',
      summary: `${depCount} bağımlılık incelendi — ${issues.length} risk faktörü:\n${issues.map(i => `  • ${i}`).join('\n')}`,
      ts:      Date.now(),
    };
  }

  // ── Task 3: Log Analysis ────────────────────────────────────────────────────

  private async _taskLogAnalysis(): Promise<NightShiftFinding | null> {
    const logDir = LOGS_DIR;
    if (!fs.existsSync(logDir)) {
      return {
        task:    'LogAnalysis',
        summary: 'memory/logs/ dizini bulunamadı — henüz hata kaydı yok.',
        ts:      Date.now(),
      };
    }

    let files: string[];
    try {
      files = fs.readdirSync(logDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(logDir, f))
        .sort()
        .slice(-20); // last 20 log files
    } catch {
      return null;
    }

    if (files.length === 0) {
      return {
        task:    'LogAnalysis',
        summary: 'Hata log dosyası yok — sistem temiz görünüyor.',
        ts:      Date.now(),
      };
    }

    // Count error pattern hits across all log files
    const patternCounts: Map<string, number> = new Map([
      ['ECONNREFUSED / connection refused', 0],
      ['heap out of memory', 0],
      ['Cannot find module', 0],
      ['TypeScript error', 0],
      ['self-repair triggered', 0],
      ['kritik hata', 0],
    ]);

    const patterns: Array<[string, RegExp]> = [
      ['ECONNREFUSED / connection refused', /ECONNREFUSED|connection refused/i],
      ['heap out of memory', /heap out of memory|JavaScript heap/i],
      ['Cannot find module', /Cannot find module|module not found/i],
      ['TypeScript error', /TS\d{4}:|TypeScript|type error/i],
      ['self-repair triggered', /self.?repair|auto.?heal/i],
      ['kritik hata', /kritik hata|critical error/i],
    ];

    for (const filePath of files) {
      let content = '';
      try { content = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
      for (const [label, re] of patterns) {
        if (re.test(content)) {
          patternCounts.set(label, (patternCounts.get(label) ?? 0) + 1);
        }
      }
    }

    const hits = [...patternCounts.entries()].filter(([, c]) => c > 0);

    if (hits.length === 0) {
      return {
        task:    'LogAnalysis',
        summary: `${files.length} log dosyası analiz edildi — bilinen hata desenleri tespit edilmedi.`,
        ts:      Date.now(),
      };
    }

    const hitStr = hits.map(([l, c]) => `  • ${l}: ${c} dosyada`).join('\n');

    return {
      task:    'LogAnalysis',
      summary:
        `${files.length} log dosyası analiz edildi — ${hits.length} aktif hata deseni:\n${hitStr}`,
      ts: Date.now(),
    };
  }

  // ── Task 4: LTM Gap Analysis ────────────────────────────────────────────────

  private async _taskLtmGap(): Promise<NightShiftFinding | null> {
    const stats = this.ltm.stats();

    const gaps: string[] = [];

    if (stats.episodic > 50 && stats.semantic < 5) {
      gaps.push(
        `Episodik bellek zengin (${stats.episodic} giriş) ama semantik bellek zayıf (${stats.semantic} giriş). ` +
        `Önemli konuşmalar semantik hafızaya alınmamış olabilir.`,
      );
    }

    if (stats.episodic > 100) {
      gaps.push(
        `Episodik bellek büyük (${stats.episodic} giriş). ` +
        `Eski girişlerin belirli aralıklarla semantik özete çevrilmesi önerilir.`,
      );
    }

    if (stats.semantic === 0 && stats.episodic > 0) {
      gaps.push(
        `Semantik bellek tamamen boş. Sistemin bağlamsal öğrenme kapasitesi kullanılmıyor.`,
      );
    }

    // Check if Project Intelligence topics are missing
    const piTopics = ['workspace', 'project context', 'architecture', 'dependency'];
    const missingTopics: string[] = [];
    for (const topic of piTopics) {
      const results = this.ltm.retrieve(topic, 1, 'semantic');
      if (results.length === 0) missingTopics.push(topic);
    }

    if (missingTopics.length > 0) {
      gaps.push(
        `Semantik bellekte eksik kapsam: ${missingTopics.join(', ')}. ` +
        `Project Intelligence verileri henüz indekslenmemiş.`,
      );
    }

    if (gaps.length === 0) {
      return {
        task:    'LTMGap',
        summary:
          `LTM dengeli — episodik: ${stats.episodic}, semantik: ${stats.semantic}. ` +
          `Tüm kapsam alanları mevcut.`,
        ts: Date.now(),
      };
    }

    return {
      task:    'LTMGap',
      summary: `LTM boşluk analizi — ${gaps.length} tespit:\n${gaps.map(g => `  • ${g}`).join('\n')}`,
      ts:      Date.now(),
    };
  }

  // ── Task 5: Workspace Diff ──────────────────────────────────────────────────

  private async _taskWorkspaceDiff(): Promise<NightShiftFinding | null> {
    // Scan key project directories for recently modified files
    const watchDirs = [
      path.join(this.root, 'src'),
      path.join(this.root, 'public', 'must-b-ui', 'src'),
    ].filter(d => fs.existsSync(d));

    if (watchDirs.length === 0) return null;

    const watermark   = this._lastScanWatermark;
    const changedFiles: string[] = [];
    let   scanned = 0;

    const walk = (dir: string) => {
      if (scanned >= MAX_SCAN_FILES) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

      for (const e of entries) {
        if (scanned >= MAX_SCAN_FILES) return;
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);

        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx|js|jsx|css|json|md)$/.test(e.name)) continue;

        scanned++;
        try {
          const st = fs.statSync(full);
          if (watermark === 0 || st.mtimeMs > watermark) {
            changedFiles.push(path.relative(this.root, full).replace(/\\/g, '/'));
          }
        } catch { /* skip */ }
      }
    };

    for (const dir of watchDirs) walk(dir);

    if (changedFiles.length === 0) {
      return {
        task:    'WorkspaceDiff',
        summary: watermark === 0
          ? `İlk tarama — ${scanned} dosya kayıt altına alındı. Sonraki çalışmada diff üretilecek.`
          : `Son NightShift'ten bu yana değişen dosya yok (${scanned} dosya kontrol edildi).`,
        ts: Date.now(),
      };
    }

    const summary = changedFiles.slice(0, 10).map(f => `  • ${f}`).join('\n');
    const extra   = changedFiles.length > 10 ? `\n  … ve ${changedFiles.length - 10} dosya daha` : '';

    return {
      task:    'WorkspaceDiff',
      summary:
        `Son taramadan bu yana ${changedFiles.length} dosya değişti:\n${summary}${extra}`,
      ts: Date.now(),
    };
  }
}
