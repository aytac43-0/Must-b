import { execSync, spawnSync, spawn } from 'child_process';
import fs from 'fs';
import https from 'https';
import http from 'http';
import os from 'os';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const PASS = green('✓');
const FAIL = red('✗');
const WARN = yellow('⚠');

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
  /** If true, gateway startup is blocked when this check fails and cannot be auto-fixed */
  critical?: boolean;
  /** If true, skip auto-apply in pre-flight silent mode (e.g. heavy ~2GB installs) */
  heavy?: boolean;
  autoFix?: () => Promise<boolean>;
}

export interface DoctorResult {
  failed: number;
  healed: number;
  remaining: number;
  /** True when at least one critical check failed and could not be auto-fixed */
  criticalBlock: boolean;
}

// ── Interactive Y/n prompt ─────────────────────────────────────────────────

function askYN(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`  ${yellow('?')} ${question} ${dim('(Y/n)')} `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}

// ── OS-aware install command helper ───────────────────────────────────────

function getInstallCmd(cmds: { win32?: string; darwin?: string; linux?: string }): string | undefined {
  return cmds[process.platform as 'win32' | 'darwin' | 'linux'];
}

// ── Shadow Config: .env ↔ .env.bak ────────────────────────────────────────

function shadowEnv(root: string): void {
  const envPath = path.join(root, '.env');
  const bakPath = path.join(root, '.env.bak');

  if (fs.existsSync(envPath)) {
    try { fs.copyFileSync(envPath, bakPath); } catch { /* best-effort */ }
  } else if (fs.existsSync(bakPath)) {
    try {
      fs.copyFileSync(bakPath, envPath);
      console.log(green('  ↻  .env dosyası .env.bak\'tan geri yüklendi!'));
    } catch { /* best-effort */ }
  }
}

// ── Core checks ───────────────────────────────────────────────────────────

function checkNode(): CheckResult {
  const version = process.version;
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  const ok = major >= 18;
  return {
    label: 'Node.js',
    ok,
    critical: true,
    detail: `${version} ${ok ? '(>= 18 required)' : '(upgrade to Node 18+)'}`,
    fix: ok ? undefined : 'Install Node 18+ from https://nodejs.org',
    autoFix: ok ? undefined : async () => {
      const cmd = getInstallCmd({
        win32:  'winget install OpenJS.NodeJS.LTS',
        darwin: 'brew install node@20',
        linux:  'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs',
      });
      if (!cmd) return false;
      console.log(dim(`  → ${cmd}`));
      try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { return false; }
    },
  };
}

function checkGit(): CheckResult {
  try {
    const out = execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    return { label: 'Git', ok: true, detail: out };
  } catch {
    return {
      label: 'Git',
      ok: false,
      detail: 'not found',
      fix: 'Install Git from https://git-scm.com',
      autoFix: async () => {
        const cmd = getInstallCmd({
          win32:  'winget install Git.Git',
          darwin: 'brew install git',
          linux:  'sudo apt-get install -y git',
        });
        if (!cmd) return false;
        console.log(dim(`  → ${cmd}`));
        try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { return false; }
      },
    };
  }
}

function checkPython(): CheckResult {
  for (const cmd of ['python3', 'python']) {
    const result = spawnSync(cmd, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
    if (result.status === 0) {
      const ver = (result.stdout || result.stderr || '').trim();
      return { label: 'Python', ok: true, detail: ver };
    }
  }
  return {
    label: 'Python',
    ok: false,
    detail: 'not found (optional but recommended for some tools)',
    fix: 'Install Python 3 from https://python.org',
    autoFix: async () => {
      if (process.platform === 'win32') {
        // Try Python 3.12 specifically first (more stable winget ID), then generic
        for (const cmd of ['winget install Python.Python.3.12', 'winget install Python.Python.3']) {
          console.log(dim(`  → ${cmd}`));
          try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { /* try next */ }
        }
        console.log(yellow('  ⚠  Otomatik kurulum başarısız oldu.'));
        console.log(yellow('     Manuel indirme: https://www.python.org/downloads/windows/'));
        return false;
      }
      const cmd = getInstallCmd({ darwin: 'brew install python3', linux: 'sudo apt-get install -y python3' });
      if (!cmd) {
        console.log(yellow('  ⚠  Manuel indirme: https://www.python.org/downloads/'));
        return false;
      }
      console.log(dim(`  → ${cmd}`));
      try { execSync(cmd, { stdio: 'inherit' }); return true; }
      catch {
        console.log(yellow('  ⚠  Manuel indirme: https://www.python.org/downloads/'));
        return false;
      }
    },
  };
}

function checkEnvFile(root: string): CheckResult {
  const envPath = path.join(root, '.env');
  const bakPath = path.join(root, '.env.bak');
  const exPath  = path.join(root, '.env.example');
  if (fs.existsSync(envPath)) {
    return { label: '.env file', ok: true, detail: envPath };
  }
  return {
    label: '.env file',
    ok: false,
    critical: true,
    detail: 'missing',
    fix: 'Copy .env.example to .env and fill in your API keys:\n    cp .env.example .env',
    autoFix: async () => {
      if (fs.existsSync(bakPath)) {
        fs.copyFileSync(bakPath, envPath);
        console.log(green('  ↻  .env.bak\'tan geri yüklendi'));
        return true;
      }
      if (fs.existsSync(exPath)) {
        fs.copyFileSync(exPath, envPath);
        console.log(green('  ↻  .env.example\'dan oluşturuldu'));
        return true;
      }
      return false;
    },
  };
}

function checkApiKey(): CheckResult {
  dotenv.config();
  const key = process.env.OPENROUTER_API_KEY ?? '';
  if (!key || key.startsWith('sk-or-v1-...') || key.trim() === '') {
    return {
      label: 'OPENROUTER_API_KEY',
      ok: false,
      critical: true,
      detail: 'not set or is placeholder',
      fix: 'Get a key at https://openrouter.ai and set it in .env',
    };
  }
  const masked = key.slice(0, 12) + '***' + key.slice(-4);
  return { label: 'OPENROUTER_API_KEY', ok: true, detail: masked };
}

function checkMode(root: string): CheckResult {
  const mode = process.env.MUSTB_MODE ?? '';
  if (!mode) {
    return {
      label: 'MUSTB_MODE',
      ok: false,
      detail: 'not set (defaulting to local)',
      fix: 'Add MUSTB_MODE=local or MUSTB_MODE=world to .env',
      autoFix: async () => {
        const envPath = path.join(root, '.env');
        if (!fs.existsSync(envPath)) return false;
        fs.appendFileSync(envPath, '\nMUSTB_MODE=local\n', 'utf-8');
        console.log(green('  ↻  MUSTB_MODE=local .env dosyasına eklendi'));
        return true;
      },
    };
  }
  return { label: 'MUSTB_MODE', ok: true, detail: mode };
}

function checkMemoryDir(root: string): CheckResult {
  const memDir = path.join(root, 'memory');
  try {
    fs.mkdirSync(memDir, { recursive: true });
    fs.accessSync(memDir, fs.constants.R_OK | fs.constants.W_OK);
    return { label: 'memory/ dir', ok: true, detail: memDir };
  } catch (e: any) {
    return {
      label: 'memory/ dir',
      ok: false,
      detail: `not writable: ${e.message}`,
      fix: `Check permissions on ${memDir}`,
    };
  }
}

function checkNodeModules(root: string): CheckResult {
  const rootMod = path.join(root, 'node_modules');
  const uiDir   = path.join(root, 'public', 'must-b-ui');
  const uiMod   = path.join(uiDir, 'node_modules');

  const rootOk = fs.existsSync(rootMod);
  const uiOk   = !fs.existsSync(uiDir) || fs.existsSync(uiMod);

  if (rootOk && uiOk) {
    return { label: 'node_modules', ok: true, detail: 'root + must-b-ui present' };
  }

  const missing = [!rootOk && 'root', !uiOk && 'must-b-ui'].filter(Boolean).join(', ');
  return {
    label: 'node_modules',
    ok: false,
    detail: `missing: ${missing}`,
    fix: 'Run: npm install (root & public/must-b-ui)',
    autoFix: async () => {
      try {
        if (!rootOk) {
          console.log(dim('  → npm install (root)...'));
          execSync('npm install', { cwd: root, stdio: 'inherit' });
        }
        if (!uiOk && fs.existsSync(uiDir)) {
          console.log(dim('  → npm install (must-b-ui)...'));
          execSync('npm install', { cwd: uiDir, stdio: 'inherit' });
        }
        return true;
      } catch { return false; }
    },
  };
}

// ── Capability checks ─────────────────────────────────────────────────────

async function checkPlaywright(): Promise<CheckResult> {
  try {
    const { chromium } = await import('playwright');
    const executablePath = chromium.executablePath();
    if (!fs.existsSync(executablePath)) {
      return {
        label: 'Playwright (Chromium)',
        ok: false,
        detail: 'browser not installed',
        fix: 'Run: npx playwright install chromium',
        autoFix: async () => {
          try { execSync('npx playwright install chromium', { stdio: 'inherit' }); return true; }
          catch { return false; }
        },
      };
    }
    return { label: 'Playwright (Chromium)', ok: true, detail: 'executable found — browser ready' };
  } catch {
    return {
      label: 'Playwright (Chromium)',
      ok: false,
      detail: 'package not installed',
      fix: 'Run: npm install playwright && npx playwright install chromium',
      autoFix: async () => {
        try {
          execSync('npm install playwright && npx playwright install chromium', { stdio: 'inherit' });
          return true;
        } catch { return false; }
      },
    };
  }
}

async function checkSQLite(): Promise<CheckResult> {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE VIRTUAL TABLE _test_fts USING fts5(content, tokenize='unicode61')`);
    db.close();
    return {
      label: 'SQLite + FTS5 (node:sqlite)',
      ok: true,
      detail: `built-in Node ${process.version} — unicode61 tokenizer active`,
    };
  } catch (e: any) {
    return {
      label: 'SQLite + FTS5 (node:sqlite)',
      ok: false,
      detail: (e?.message ?? 'unknown error').slice(0, 80),
      fix: 'Requires Node 22.5+. Current: ' + process.version,
    };
  }
}

async function checkChokidar(): Promise<CheckResult> {
  try {
    await import('chokidar');
    return { label: 'chokidar (file watcher)', ok: true, detail: 'installed — memory sync active' };
  } catch {
    return {
      label: 'chokidar (file watcher)',
      ok: false,
      detail: 'not installed',
      fix: 'Run: npm install chokidar',
      autoFix: async () => {
        try { execSync('npm install chokidar', { stdio: 'inherit' }); return true; }
        catch { return false; }
      },
    };
  }
}

async function checkSharp(): Promise<CheckResult> {
  try {
    const sharp = (await import('sharp')).default;
    const vipsVersion = (sharp as any).versions?.vips ?? 'unknown';
    return { label: 'sharp (image processing)', ok: true, detail: `vips ${vipsVersion}` };
  } catch {
    return {
      label: 'sharp (image processing)',
      ok: false,
      detail: 'not installed',
      fix: 'Run: npm install sharp',
      autoFix: async () => {
        try { execSync('npm install sharp', { stdio: 'inherit' }); return true; }
        catch { return false; }
      },
    };
  }
}

// ── Build Tool checks ─────────────────────────────────────────────────────

function checkCMake(): CheckResult {
  const result = spawnSync('cmake', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
  if (result.status === 0) {
    const version = (result.stdout ?? '').split('\n')[0].trim();
    return { label: 'CMake', ok: true, detail: version };
  }
  return {
    label: 'CMake',
    ok: false,
    detail: 'not found (required for native node modules)',
    fix: process.platform === 'win32'
      ? 'Run: winget install Kitware.CMake'
      : process.platform === 'darwin'
      ? 'Run: brew install cmake'
      : 'Run: sudo apt-get install -y cmake',
    autoFix: async () => {
      const cmd = getInstallCmd({
        win32:  'winget install Kitware.CMake',
        darwin: 'brew install cmake',
        linux:  'sudo apt-get install -y cmake',
      });
      if (!cmd) return false;
      console.log(dim(`  → ${cmd}`));
      try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { return false; }
    },
  };
}

/** Locate cl.exe in typical Visual Studio / Build Tools installations on Windows */
function findMsvcCompiler(): string | null {
  // Fast path: cl.exe already on PATH
  const whereResult = spawnSync('where', ['cl'], { encoding: 'utf-8', stdio: 'pipe' });
  if (whereResult.status === 0 && whereResult.stdout.trim()) {
    return whereResult.stdout.split('\n')[0].trim();
  }

  // Deep search in standard VS installation directories
  const roots = [
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    process.env['ProgramFiles']      ?? 'C:\\Program Files',
  ];
  const vsVersions = ['2022', '2019', '2017'];
  const vsEditions = ['BuildTools', 'Community', 'Professional', 'Enterprise'];

  for (const root of roots) {
    for (const ver of vsVersions) {
      for (const ed of vsEditions) {
        const msvcBase = path.join(root, 'Microsoft Visual Studio', ver, ed, 'VC', 'Tools', 'MSVC');
        if (!fs.existsSync(msvcBase)) continue;
        try {
          const versions = fs.readdirSync(msvcBase).sort().reverse();
          for (const v of versions) {
            const clPath = path.join(msvcBase, v, 'bin', 'Hostx64', 'x64', 'cl.exe');
            if (fs.existsSync(clPath)) return clPath;
          }
        } catch { /* skip */ }
      }
    }
  }

  // Last resort: check vcvarsall.bat existence as presence indicator
  for (const root of roots) {
    for (const ver of vsVersions) {
      for (const ed of vsEditions) {
        const vcvars = path.join(root, 'Microsoft Visual Studio', ver, ed, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');
        if (fs.existsSync(vcvars)) return vcvars; // not cl.exe but confirms VS installed
      }
    }
  }
  return null;
}

function checkCppBuildTools(): CheckResult {
  if (process.platform === 'win32') {
    const clPath = findMsvcCompiler();
    if (clPath) {
      // Get compiler version from stderr (cl.exe banner)
      const result = spawnSync(clPath, [], { encoding: 'utf-8', stdio: 'pipe' });
      const banner = (result.stderr ?? '').split('\n')[0].trim();
      return {
        label: 'C++ Build Tools (MSVC)',
        ok: true,
        detail: banner || `cl.exe → ${path.basename(path.dirname(clPath))}`,
      };
    }
    return {
      label: 'C++ Build Tools (MSVC)',
      ok: false,
      heavy: true, // ~2GB — skip in silent auto-mode
      detail: 'cl.exe not found — native modules cannot be compiled',
      fix: 'winget install Microsoft.VisualStudio.2022.BuildTools (~2GB)',
      autoFix: async () => {
        console.log('');
        console.log(yellow('  ⚠  Sisteminde C++ derleyiciler (MSVC) eksik.'));
        console.log(yellow('     Bu, Must-b\'nin yerel modüllerini tam derleyebilmesi için gereklidir.'));
        console.log(yellow('     Kurulum yaklaşık 2GB indirir ve birkaç dakika sürer.'));
        const yes = await askYN('Visual Studio 2022 Build Tools kurulumunu başlatmamı ister misin?');
        if (!yes) {
          console.log(dim('     Manuel: https://visualstudio.microsoft.com/visual-cpp-build-tools/'));
          return false;
        }
        const cmd = [
          'winget install',
          '--id Microsoft.VisualStudio.2022.BuildTools',
          '--silent',
          '--override',
          '"--quiet --wait',
          '--add Microsoft.VisualStudio.Workload.VCTools',
          '--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
          '--includeRecommended"',
        ].join(' ');
        console.log(dim(`  → ${cmd}`));
        try {
          execSync(cmd, { stdio: 'inherit' });
          return true;
        } catch {
          console.log(yellow('  ⚠  Kurulum başarısız. Manuel:'));
          console.log(yellow('     https://visualstudio.microsoft.com/visual-cpp-build-tools/'));
          return false;
        }
      },
    };
  }

  // macOS / Linux — check clang++ or g++
  for (const compiler of ['clang++', 'g++', 'c++']) {
    const result = spawnSync(compiler, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
    if (result.status === 0) {
      const ver = (result.stdout ?? result.stderr ?? '').split('\n')[0].trim();
      return { label: 'C++ Compiler', ok: true, detail: `${compiler}: ${ver}` };
    }
  }

  if (process.platform === 'darwin') {
    return {
      label: 'C++ Compiler',
      ok: false,
      detail: 'clang++ not found — Xcode Command Line Tools required',
      fix: 'Run: xcode-select --install',
      autoFix: async () => {
        console.log(dim('  → xcode-select --install'));
        try { execSync('xcode-select --install', { stdio: 'inherit' }); return true; }
        catch { return false; }
      },
    };
  }
  return {
    label: 'C++ Compiler',
    ok: false,
    detail: 'g++ not found — build-essential package required',
    fix: 'Run: sudo apt-get install -y build-essential',
    autoFix: async () => {
      console.log(dim('  → sudo apt-get install -y build-essential'));
      try { execSync('sudo apt-get install -y build-essential', { stdio: 'inherit' }); return true; }
      catch { return false; }
    },
  };
}

// ── Python Headers ────────────────────────────────────────────────────────

function checkPythonHeaders(): CheckResult {
  // Find the active python executable
  let pyCmd: string | null = null;
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
    if (r.status === 0) { pyCmd = cmd; break; }
  }

  if (!pyCmd) {
    return {
      label: 'Python Headers',
      ok: false,
      detail: 'Python not found — headers unavailable',
    };
  }

  if (process.platform === 'win32') {
    // On Windows, headers ship with the standard Python installer under Include/
    const pyExe = spawnSync('where', [pyCmd], { encoding: 'utf-8', stdio: 'pipe' });
    const pyPath = pyExe.stdout?.split('\n')[0].trim();
    if (pyPath) {
      const includeDir = path.join(path.dirname(pyPath), 'Include');
      const headerFile = path.join(includeDir, 'Python.h');
      if (fs.existsSync(headerFile)) {
        return { label: 'Python Headers', ok: true, detail: headerFile };
      }
    }
    return {
      label: 'Python Headers',
      ok: false,
      detail: 'Python.h not found — reinstall Python with "Add to PATH" checked',
      fix: 'Reinstall Python from https://python.org (check "Add Python to PATH")',
    };
  }

  // macOS / Linux — python3-config is the authoritative test
  const configResult = spawnSync(`${pyCmd}-config`, ['--includes'], { encoding: 'utf-8', stdio: 'pipe' });
  if (configResult.status === 0 && configResult.stdout.trim()) {
    return { label: 'Python Headers', ok: true, detail: configResult.stdout.trim() };
  }

  const pkg = process.platform === 'darwin' ? 'python3' : 'python3-dev';
  return {
    label: 'Python Headers',
    ok: false,
    detail: `${pyCmd}-config not found — dev headers missing`,
    fix: process.platform === 'darwin'
      ? 'Run: brew install python3  (headers included)'
      : 'Run: sudo apt-get install -y python3-dev',
    autoFix: async () => {
      const cmd = process.platform === 'darwin'
        ? `brew reinstall ${pkg}`
        : `sudo apt-get install -y ${pkg}`;
      console.log(dim(`  → ${cmd}`));
      try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { return false; }
    },
  };
}

// ── Network Access ────────────────────────────────────────────────────────

interface NetworkTarget { label: string; host: string; path: string; }

function probeUrl(target: NetworkTarget, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { req.destroy(); resolve(false); }, timeoutMs);
    const req = https.request(
      { hostname: target.host, path: target.path, method: 'HEAD', timeout: timeoutMs },
      (res) => { clearTimeout(timer); resolve((res.statusCode ?? 0) < 500); }
    );
    req.on('error', () => { clearTimeout(timer); resolve(false); });
    req.end();
  });
}

async function checkNetworkAccess(): Promise<CheckResult> {
  const targets: NetworkTarget[] = [
    { label: 'OpenRouter API', host: 'openrouter.ai',      path: '/api/v1/models' },
    { label: 'npm registry',   host: 'registry.npmjs.org', path: '/'              },
  ];

  const results = await Promise.all(targets.map(async (t) => ({
    ...t,
    reachable: await probeUrl(t),
  })));

  const failed = results.filter(r => !r.reachable);
  if (failed.length === 0) {
    return {
      label: 'Network Access',
      ok: true,
      detail: results.map(r => r.label).join(' · ') + ' — reachable',
    };
  }

  return {
    label: 'Network Access',
    ok: false,
    detail: `unreachable: ${failed.map(r => r.label).join(', ')}`,
    fix: 'Check your internet connection or firewall/proxy settings',
  };
}

// ── TypeScript Auto-Repair ────────────────────────────────────────────────

async function fixImports(root: string): Promise<void> {
  console.log('');
  console.log(cyan('  ── TypeScript Auto-Repair ──────────────────────────────'));

  let tscOutput = '';
  try {
    execSync('npx tsc --noEmit', { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    console.log(green('  ✓  TypeScript hatası bulunamadı.'));
    return;
  } catch (e: any) {
    tscOutput = ((e.stdout ?? '') + (e.stderr ?? '')) as string;
  }

  const errorLines = tscOutput.split('\n').filter(l => l.includes('error TS'));
  if (errorLines.length === 0) {
    console.log(green('  ✓  TypeScript hatası bulunamadı.'));
    return;
  }

  console.log(yellow(`  ⚠  ${errorLines.length} hata tespit edildi. Otomatik onarım deneniyor...`));

  let fixedCount = 0;

  const missingJsMods = errorLines
    .filter(l => l.includes('Cannot find module') && l.includes("'./") && !l.includes('.js'))
    .map(l => l.match(/Cannot find module '([^']+)'/)?.[1])
    .filter((m): m is string => !!m && !m.endsWith('.js'));

  if (missingJsMods.length > 0) {
    console.log(dim(`  → ${missingJsMods.length} eksik .js uzantısı düzeltiliyor...`));
    const srcDir = path.join(root, 'src');
    if (fs.existsSync(srcDir)) {
      for (const file of getAllTsFiles(srcDir)) {
        let content = fs.readFileSync(file, 'utf-8');
        let changed = false;
        for (const mod of missingJsMods) {
          const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const updated = content.replace(
            new RegExp(`(from\\s+['"])(${escaped})(['"])`, 'g'),
            (_, prefix, m, suffix) => `${prefix}${m}.js${suffix}`
          );
          if (updated !== content) { content = updated; changed = true; }
        }
        if (changed) { fs.writeFileSync(file, content, 'utf-8'); fixedCount++; }
      }
    }
  }

  const tsconfigPath = path.join(root, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      tsconfig.compilerOptions ??= {};
      if (!tsconfig.compilerOptions.moduleResolution) {
        tsconfig.compilerOptions.moduleResolution = 'node16';
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
        console.log(green('  ↻  tsconfig.json güncellendi (moduleResolution: node16)'));
        fixedCount++;
      }
    } catch { /* skip */ }
  }

  if (fixedCount > 0) {
    console.log(green(`  ✓  ${fixedCount} dosya/config onarıldı.`));
  } else {
    console.log(yellow('  ⚠  Otomatik düzeltilemedi. Manuel inceleme gerekiyor.'));
    errorLines.slice(0, 5).forEach(l => console.log(dim(`     ${l.trim()}`)));
  }
}

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...getAllTsFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

// ── Render helpers ────────────────────────────────────────────────────────

function printResult(r: CheckResult, silent: boolean) {
  if (silent && r.ok) return; // suppress passing checks in silent mode
  const icon = r.ok ? PASS : r.fix ? FAIL : WARN;
  console.log(`  ${icon}  ${bold(r.label.padEnd(28))} ${dim(r.detail)}`);
  if (!r.ok && r.fix) {
    console.log(`       ${yellow('→')} ${r.fix}`);
  }
}

// ── Self-Healing loop ─────────────────────────────────────────────────────

async function selfHeal(
  failed: CheckResult[],
  /** If true, auto-apply all fixes without Y/n prompts (used in gateway pre-flight) */
  autoApply: boolean,
  silent: boolean
): Promise<number> {
  let healed = 0;
  for (const check of failed) {
    if (!check.autoFix) continue;

    // Heavy installs (e.g. MSVC ~2GB) are never auto-applied without user consent
    if (autoApply && check.heavy) continue;

    let shouldFix = autoApply;
    if (!autoApply) {
      shouldFix = await askYN(`${bold(check.label)} sorununu otomatik onarmamı ister misin?`);
    }
    if (!shouldFix) continue;

    if (!silent) process.stdout.write(`  ${cyan('⟳')}  ${check.label} onarılıyor...`);
    const success = await check.autoFix();
    if (!silent) process.stdout.write('\r' + ' '.repeat(60) + '\r');

    if (success) {
      console.log(`  ${PASS}  ${bold(check.label.padEnd(28))} ${green('onarıldı!')}`);
      healed++;
    } else {
      console.log(`  ${FAIL}  ${bold(check.label.padEnd(28))} ${red('onarım başarısız — manuel müdahale gerekli')}`);
    }
  }
  return healed;
}

// ── Main ──────────────────────────────────────────────────────────────────

export async function runDoctor(
  root: string,
  fix = false,
  silent = false
): Promise<DoctorResult> {

  if (!silent) {
    console.log('');
    console.log(cyan('  ══════════════════════════════════════════════════════'));
    console.log(cyan('    Must-b Doctor — System Health Check'));
    if (fix) console.log(cyan('    ⚡ Mod: Self-Healing  (--fix)'));
    console.log(cyan('  ══════════════════════════════════════════════════════'));
    console.log('');
  }

  // Shadow .env backup/restore runs every time
  shadowEnv(root);

  if (!silent) console.log(dim('  [ Core ]'));
  const coreChecks: CheckResult[] = [
    checkNode(),
    checkGit(),
    checkPython(),
    checkEnvFile(root),
    checkApiKey(),
    checkMode(root),
    checkMemoryDir(root),
    checkNodeModules(root),
  ];
  for (const c of coreChecks) printResult(c, silent);

  if (!silent) { console.log(''); console.log(dim('  [ Build Tools ]')); }
  const buildChecks: CheckResult[] = [
    checkCMake(),
    checkCppBuildTools(),
  ];
  for (const c of buildChecks) printResult(c, silent);

  if (!silent) { console.log(''); console.log(dim('  [ Capabilities ]')); }
  const capChecks = await Promise.all([
    checkPlaywright(),
    checkSQLite(),
    checkChokidar(),
    checkSharp(),
  ]);
  for (const c of capChecks) printResult(c, silent);

  if (!silent) { console.log(''); console.log(dim('  [ LLM Runtime ]')); }
  const llmChecks: CheckResult[] = [checkPythonHeaders()];
  for (const c of llmChecks) printResult(c, silent);

  if (!silent) { console.log(''); console.log(dim('  [ Network ]')); }
  const netChecks: CheckResult[] = [await checkNetworkAccess()];
  for (const c of netChecks) printResult(c, silent);

  const allChecks = [...coreChecks, ...buildChecks, ...capChecks, ...llmChecks, ...netChecks];
  const failed    = allChecks.filter(c => !c.ok && c.fix);
  const warned    = allChecks.filter(c => !c.ok && !c.fix);

  if (!silent) console.log('');

  let healedCount = 0;

  if (failed.length === 0 && warned.length === 0) {
    if (!silent) {
      console.log(green('  ✔  Tüm kontroller geçti. Must-b tam olarak çalışıyor!'));
      console.log(dim('     Browser: Playwright  |  Memory: SQLite FTS5  |  Watcher: chokidar'));
    }
  } else {
    if (!silent) {
      if (failed.length > 0) console.log(red(`  ${failed.length} sorun tespit edildi (yukarıdaki → ipuçlarına bak).`));
      if (warned.length > 0) console.log(yellow(`  ${warned.length} uyarı — isteğe bağlı bileşenler yapılandırılmamış.`));
    }

    if (fix) {
      if (!silent) {
        console.log('');
        console.log(cyan('  ── Self-Healing ────────────────────────────────────────'));
      }

      const fixable = failed.filter(c => c.autoFix);
      if (fixable.length > 0) {
        // silent+fix → gateway pre-flight: auto-apply without Y/n
        // fix only   → interactive mode: ask Y/n
        healedCount = await selfHeal(fixable, silent, silent);
        if (!silent) {
          console.log('');
          console.log(healedCount > 0
            ? green(`  ✔  ${healedCount} sorun onarıldı.`)
            : yellow('  Hiçbir sorun otomatik onarılamadı.'));
        }
      } else if (!silent) {
        console.log(yellow('  Otomatik onarılabilir sorun yok. Manuel müdahale gerekli.'));
      }

      // TypeScript repair — only in interactive (non-silent) mode
      if (!silent) {
        console.log('');
        const doTsFix = await askYN('TypeScript hatalarını kontrol edip otomatik onarmamı ister misin?');
        if (doTsFix) await fixImports(root);
      }

    } else if (!silent) {
      console.log('');
      console.log(dim('  Sorunları düzelttikten sonra tekrar çalıştır: must-b doctor'));
      console.log(dim(`  ${bold('İpucu:')} must-b doctor --fix  →  otomatik onarım modu`));
    }
  }

  if (!silent) console.log('');

  const remaining = Math.max(0, failed.length - healedCount);
  // criticalBlock: at least one critical check is still broken AND has no autoFix
  // (autoFix-able criticals were attempted; if they failed they are already counted in `remaining`)
  const criticalBlock = allChecks.some(c => !c.ok && c.critical);

  return { failed: failed.length, healed: healedCount, remaining, criticalBlock };
}

// ── Remote Skill Downloader ───────────────────────────────────────────────

export interface SkillInstallResult {
  ok: boolean;
  skillId: string;
  installPath: string;
  error?: string;
}

/**
 * Download a Must-b skill package from a URL (or a local .zip path),
 * validate its structure, run a doctor-style safety check, then extract
 * it into the local extensions/ directory.
 *
 * @param source   HTTPS URL or absolute local path to a .zip file
 * @param root     Project root (defaults to process.cwd())
 */
export async function downloadSkill(source: string, root = process.cwd()): Promise<SkillInstallResult> {
  const isLocal = !source.startsWith('http://') && !source.startsWith('https://');
  const tmpDir  = path.join(os.tmpdir(), `mustb-skill-${Date.now()}`);
  const zipPath = path.join(tmpDir, 'skill.zip');

  fs.mkdirSync(tmpDir, { recursive: true });

  // ── Step 1: Acquire the zip ──────────────────────────────────────────
  if (isLocal) {
    if (!fs.existsSync(source)) {
      return { ok: false, skillId: '', installPath: '', error: `Local file not found: ${source}` };
    }
    fs.copyFileSync(source, zipPath);
  } else {
    console.log(cyan(`  ⬇  Skill indiriliyor: ${source}`));
    try {
      await downloadFile(source, zipPath);
    } catch (err: any) {
      return { ok: false, skillId: '', installPath: '', error: `Download failed: ${err.message}` };
    }
  }

  // ── Step 2: Extract to a temp staging directory ──────────────────────
  const stagingDir = path.join(tmpDir, 'staging');
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    extractZip(zipPath, stagingDir);
  } catch (err: any) {
    cleanup(tmpDir);
    return { ok: false, skillId: '', installPath: '', error: `Extraction failed: ${err.message}` };
  }

  // ── Step 3: Validate package structure ──────────────────────────────
  // Expected layout: <skillId>/must-b.plugin.json  (or plugin.json at root)
  const rootEntries = fs.readdirSync(stagingDir);
  let skillDir = stagingDir;
  if (rootEntries.length === 1 && fs.statSync(path.join(stagingDir, rootEntries[0])).isDirectory()) {
    skillDir = path.join(stagingDir, rootEntries[0]);
  }

  const pluginJson = path.join(skillDir, 'must-b.plugin.json');
  if (!fs.existsSync(pluginJson)) {
    cleanup(tmpDir);
    return { ok: false, skillId: '', installPath: '', error: 'Invalid skill package: missing must-b.plugin.json' };
  }

  let plugin: { id?: string } = {};
  try {
    plugin = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'));
  } catch {
    cleanup(tmpDir);
    return { ok: false, skillId: '', installPath: '', error: 'Invalid must-b.plugin.json — could not parse JSON' };
  }

  const skillId = (plugin.id ?? path.basename(skillDir)).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!skillId) {
    cleanup(tmpDir);
    return { ok: false, skillId: '', installPath: '', error: 'Skill plugin.json missing "id" field' };
  }

  // ── Step 4: Safety check — refuse dangerous file patterns ────────────
  const dangerPatterns = [/\.\.[\\/]/, /node_modules/, /\.(exe|bat|cmd|sh|ps1)$/i];
  const allFiles = walkDir(skillDir);
  for (const f of allFiles) {
    const rel = path.relative(skillDir, f);
    if (dangerPatterns.some(p => p.test(rel))) {
      cleanup(tmpDir);
      return { ok: false, skillId, installPath: '', error: `Security: suspicious file in package: ${rel}` };
    }
  }

  // ── Step 5: Install into extensions/ ────────────────────────────────
  const extDir     = path.join(root, 'src', 'core', 'extensions');
  const installPath = path.join(extDir, skillId);

  if (fs.existsSync(installPath)) {
    // Back up existing version
    const bakPath = `${installPath}.bak-${Date.now()}`;
    fs.renameSync(installPath, bakPath);
    console.log(dim(`  ↻  Mevcut versiyon yedeklendi: ${path.basename(bakPath)}`));
  }

  copyDir(skillDir, installPath);
  cleanup(tmpDir);

  console.log(green(`  ✔  Skill kuruldu: ${skillId}  →  ${installPath}`));

  // ── Step 6: Install npm dependencies if package.json present ────────
  const pkgJson = path.join(installPath, 'package.json');
  if (fs.existsSync(pkgJson)) {
    console.log(dim('  → npm install (skill bağımlılıkları)...'));
    try { execSync('npm install --omit=dev', { cwd: installPath, stdio: 'pipe' }); }
    catch { console.log(yellow('  ⚠  npm install başarısız — skill çalışabilir ama bazı özellikler eksik olabilir.')); }
  }

  return { ok: true, skillId, installPath };
}

// ── downloadSkill helpers ─────────────────────────────────────────────────

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod  = url.startsWith('https://') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
      }
      if ((res.statusCode ?? 0) >= 400) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => { file.close(); reject(err); });
  });
}

function extractZip(zipPath: string, destDir: string): void {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'pipe' }
    );
  } else {
    execSync(`unzip -q "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  }
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function cleanup(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

// ── Ollama Bridge ─────────────────────────────────────────────────────────

export interface EnsureModelResult {
  ok: boolean;
  ollamaInstalled: boolean;
  modelPulled: boolean;
  modelName: string;
  error?: string;
}

/**
 * Ensure a local Ollama model is available for use.
 *
 * Steps:
 *   1. Check if Ollama is installed; if not, install it via doctor-style fix.
 *   2. Check if the model is already present (`ollama list`).
 *   3. If not present, run `ollama pull <modelName>` to download it.
 *
 * @param modelName  Ollama model tag, e.g. 'llama3.2:latest' or 'phi3:mini'
 */
export async function ensureModel(modelName: string): Promise<EnsureModelResult> {
  const result: EnsureModelResult = {
    ok: false,
    ollamaInstalled: false,
    modelPulled: false,
    modelName,
  };

  // ── Step 1: Is Ollama installed? ────────────────────────────────────
  const ollamaCheck = spawnSync('ollama', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
  const installed   = ollamaCheck.status === 0;

  if (!installed) {
    console.log(yellow(`  ⚠  Ollama bulunamadı. Kurulum deneniyor...`));

    const installCmd = getInstallCmd({
      win32:  'winget install Ollama.Ollama',
      darwin: 'brew install ollama',
      linux:  'curl -fsSL https://ollama.com/install.sh | sh',
    });

    if (!installCmd) {
      result.error = 'Ollama kurulumu bu platformda desteklenmiyor. Lütfen https://ollama.com adresinden manuel kurun.';
      console.error(red(`  ✗  ${result.error}`));
      return result;
    }

    console.log(dim(`  → ${installCmd}`));
    try {
      execSync(installCmd, { stdio: 'inherit' });
      console.log(green('  ✓  Ollama kuruldu.'));
    } catch (err: any) {
      result.error = `Ollama kurulum komutu başarısız: ${err.message}`;
      console.error(red(`  ✗  ${result.error}`));
      console.error(dim('     Manuel kurulum: https://ollama.com/download'));
      return result;
    }

    // Start the Ollama daemon after fresh install so subsequent pulls work
    console.log(dim('  → ollama serve başlatılıyor...'));
    try {
      const daemon = spawn('ollama', ['serve'], {
        detached:    true,
        stdio:       'ignore',
        windowsHide: true,
      });
      daemon.unref();
      // Give the daemon 2 seconds to bind its port before we pull
      await new Promise<void>(r => setTimeout(r, 2000));
      console.log(green('  ✓  Ollama servisi başlatıldı.'));
    } catch { /* non-fatal — pull will fail on its own if daemon isn't up */ }
  } else {
    const ver = (ollamaCheck.stdout ?? '').split('\n')[0].trim();
    console.log(green(`  ✓  Ollama mevcut — ${ver}`));
  }
  result.ollamaInstalled = true;

  // ── Step 2: Is the model already pulled? ────────────────────────────
  try {
    const listOut = execSync('ollama list', { encoding: 'utf-8', stdio: 'pipe' });
    const baseName = modelName.split(':')[0].toLowerCase();
    const tag      = (modelName.split(':')[1] ?? 'latest').toLowerCase();
    const alreadyPresent = listOut
      .split('\n')
      .slice(1)                     // skip header row
      .some(line => {
        const col = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
        return col === modelName.toLowerCase() ||
               col === `${baseName}:${tag}` ||
               col.startsWith(baseName + ':');
      });

    if (alreadyPresent) {
      console.log(green(`  ✓  Model zaten mevcut: ${modelName}`));
      result.modelPulled = true;
      result.ok = true;
      return result;
    }
  } catch { /* ollama list may fail if daemon isn't running yet — proceed to pull */ }

  // ── Step 3: Pull the model ───────────────────────────────────────────
  console.log(cyan(`  ⬇  Model indiriliyor: ${modelName}  (bu birkaç dakika sürebilir...)`));
  try {
    execSync(`ollama pull ${modelName}`, { stdio: 'inherit' });
    console.log(green(`  ✓  Model hazır: ${modelName}`));
    result.modelPulled = true;
    result.ok = true;
  } catch (err: any) {
    result.error = `ollama pull başarısız: ${err.message}`;
    console.error(red(`  ✗  ${result.error}`));
  }

  return result;
}

// ── Skills Hub (must-b.com/api/v1/market) ─────────────────────────────────

export interface SkillMarketEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tier: string;
  downloads: number;
  tags: string[];
  publishedAt: string;
}

export interface SkillsMarketResult {
  ok: boolean;
  skills: SkillMarketEntry[];
  total: number;
  error?: string;
}

export interface PublishSkillResult {
  ok: boolean;
  skillId: string;
  marketUrl?: string;
  error?: string;
}

const SKILLS_HUB_URL = process.env.SKILLS_HUB_URL ?? 'https://must-b.com';

/**
 * Fetch the global skills market listing.
 * All agents can browse; no auth required.
 */
export async function getSkillsMarket(opts: { query?: string; limit?: number } = {}): Promise<SkillsMarketResult> {
  const { query = '', limit = 20 } = opts;
  const fetch_url = new URL('/api/v1/market', SKILLS_HUB_URL);
  if (query) fetch_url.searchParams.set('q', query);
  fetch_url.searchParams.set('limit', String(limit));

  return new Promise((resolve) => {
    const mod = fetch_url.protocol === 'https:' ? https : http;
    mod.get({
      hostname: fetch_url.hostname,
      port:     fetch_url.port ? Number(fetch_url.port) : (fetch_url.protocol === 'https:' ? 443 : 80),
      path:     fetch_url.pathname + fetch_url.search,
      headers:  { 'Accept': 'application/json', 'User-Agent': 'Must-b/2.0' },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ ok: true, skills: data.skills ?? [], total: data.total ?? 0 });
        } catch {
          resolve({ ok: false, skills: [], total: 0, error: 'Invalid JSON from Skills Hub' });
        }
      });
    }).on('error', (err) => {
      resolve({ ok: false, skills: [], total: 0, error: err.message });
    });
  });
}

/**
 * Publish a local skill package to the global Must-b Skills Hub.
 * Requires Pro+ tier (enforced by the API route before this is called).
 *
 * @param opts.skillId   The skill ID (must match must-b.plugin.json)
 * @param opts.manifest  The parsed plugin manifest object
 * @param opts.readme    Markdown readme text
 * @param opts.token     MUSTB_CLOUD_TOKEN for auth
 * @param opts.caps      Caller's role capabilities (for tier metadata)
 */
export async function publishSkill(opts: {
  skillId: string;
  manifest: object;
  readme: string;
  token: string;
  caps: { role: string; tier: string; score: number };
}): Promise<PublishSkillResult> {
  const { skillId, manifest, readme, token, caps } = opts;

  const body = Buffer.from(JSON.stringify({
    skillId,
    manifest,
    readme,
    publishedBy: { role: caps.role, tier: caps.tier },
  }));

  const pub_url = new URL('/api/v1/market/publish', SKILLS_HUB_URL);

  return new Promise((resolve) => {
    const mod = pub_url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: pub_url.hostname,
      port:     pub_url.port ? Number(pub_url.port) : (pub_url.protocol === 'https:' ? 443 : 80),
      path:     pub_url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': body.byteLength,
        'Authorization':  `Bearer ${token}`,
        'User-Agent':     'Must-b/2.0',
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if ((res.statusCode ?? 0) >= 400) {
            resolve({ ok: false, skillId, error: data.error ?? `HTTP ${res.statusCode}` });
          } else {
            resolve({ ok: true, skillId, marketUrl: data.url });
          }
        } catch {
          resolve({ ok: false, skillId, error: `HTTP ${res.statusCode} — invalid JSON` });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, skillId, error: err.message }));
    req.write(body);
    req.end();
  });
}
