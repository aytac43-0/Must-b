import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const cyan  = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold  = (s: string) => `\x1b[1m${s}\x1b[0m`;

const PASS = green('✓');
const FAIL = red('✗');
const WARN = yellow('⚠');

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

function checkNode(): CheckResult {
  const version = process.version; // e.g. "v20.11.0"
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  const ok = major >= 18;
  return {
    label: 'Node.js',
    ok,
    detail: `${version} ${ok ? '(>= 18 required)' : '(upgrade to Node 18+)'}`,
    fix: ok ? undefined : 'Install Node 18+ from https://nodejs.org',
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
  };
}

function checkEnvFile(root: string): CheckResult {
  const envPath = path.join(root, '.env');
  const exists = fs.existsSync(envPath);
  if (!exists) {
    return {
      label: '.env file',
      ok: false,
      detail: 'missing',
      fix: `Copy .env.example to .env and fill in your API keys:\n    cp .env.example .env`,
    };
  }
  return { label: '.env file', ok: true, detail: envPath };
}

function checkApiKey(): CheckResult {
  dotenv.config();
  const key = process.env.OPENROUTER_API_KEY ?? '';
  if (!key || key.startsWith('sk-or-v1-...') || key.trim() === '') {
    return {
      label: 'OPENROUTER_API_KEY',
      ok: false,
      detail: 'not set or is placeholder',
      fix: 'Get a key at https://openrouter.ai and set it in .env',
    };
  }
  const masked = key.slice(0, 12) + '***' + key.slice(-4);
  return { label: 'OPENROUTER_API_KEY', ok: true, detail: masked };
}

function checkMode(): CheckResult {
  const mode = process.env.MUSTB_MODE ?? '';
  if (!mode) {
    return {
      label: 'MUSTB_MODE',
      ok: false,
      detail: 'not set (defaulting to local)',
      fix: 'Add MUSTB_MODE=local or MUSTB_MODE=world to .env',
    };
  }
  return {
    label: 'MUSTB_MODE',
    ok: true,
    detail: mode,
  };
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

function printResult(r: CheckResult) {
  const icon = r.ok ? PASS : (r.fix ? FAIL : WARN);
  console.log(`  ${icon}  ${bold(r.label.padEnd(24))} ${dim(r.detail)}`);
  if (!r.ok && r.fix) {
    console.log(`       ${yellow('→')} ${r.fix}`);
  }
}

export async function runDoctor(root: string) {
  console.log('');
  console.log(cyan('  ══════════════════════════════════════════════'));
  console.log(cyan('    Must-b Doctor — System Health Check'));
  console.log(cyan('  ══════════════════════════════════════════════'));
  console.log('');

  const checks: CheckResult[] = [
    checkNode(),
    checkGit(),
    checkPython(),
    checkEnvFile(root),
    checkApiKey(),
    checkMode(),
    checkMemoryDir(root),
  ];

  for (const c of checks) {
    printResult(c);
  }

  const failed = checks.filter(c => !c.ok && c.fix);
  const warned = checks.filter(c => !c.ok && !c.fix);

  console.log('');
  if (failed.length === 0 && warned.length === 0) {
    console.log(green('  ✔  All checks passed. Must-b is ready.'));
  } else {
    if (failed.length > 0) {
      console.log(red(`  ${failed.length} issue(s) need your attention (see → hints above).`));
    }
    if (warned.length > 0) {
      console.log(yellow(`  ${warned.length} warning(s) — optional items not configured.`));
    }
    console.log('');
    console.log(dim('  Fix the issues above, then re-run: must-b doctor'));
  }
  console.log('');
}
