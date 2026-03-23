/**
 * Ollama Manager (v1.4.2)
 *
 * Autonomous Ollama lifecycle manager called during onboarding when the
 * user chooses Ollama as their AI provider.
 *
 * Flow:
 *   1. Analyse system hardware (RAM, GPU)
 *   2. Check / auto-install the Ollama CLI if missing
 *   3. Ensure the daemon is running (auto-spawn if needed)
 *   4. Check for already-installed models (skip pull if present)
 *   5. Present smart model picker — ALL models shown, tagged by fit
 *   6. Pull the selected model with live progress output
 *
 * v1.4.1 fixes:
 *   - Windows PATH bypass: spawn via absolute LOCALAPPDATA path after winget install
 *   - Polling extended to 25 s (fresh installs need time to settle)
 *   - Zero fall-through: daemon failure triggers Doctor-style auto-repair loop
 *     (kills hung processes + hard-restarts) instead of silently returning
 *
 * v1.4.2 fixes:
 *   - installOllama() no longer fails when winget exits non-zero due to
 *     "already installed" / "No available upgrade found" — performs a two-step
 *     verification (winget list + absolute exe existence) before giving up
 */

import fs           from 'fs';
import os           from 'os';
import path         from 'path';
import { spawnSync, spawn, execSync } from 'child_process';

// ── Colour helpers ──────────────────────────────────────────────────────────
const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Model catalogue ─────────────────────────────────────────────────────────

interface ModelEntry {
  id:        string;   // ollama pull id
  label:     string;   // human-readable name
  sizeGb:    number;   // approximate download size
  minRamGb:  number;   // practical minimum RAM
  specialty?: string;  // brief note (e.g. "code", "multilingual")
}

const MODEL_CATALOG: ModelEntry[] = [
  { id: 'qwen2.5:0.5b',  label: 'Qwen 2.5 0.5B',        sizeGb: 0.4,  minRamGb: 2,  specialty: 'ultralight'      },
  { id: 'phi3:mini',     label: 'Microsoft Phi-3 Mini',  sizeGb: 2.3,  minRamGb: 4,  specialty: 'lightweight'     },
  { id: 'qwen2.5:7b',   label: 'Qwen 2.5 7B',           sizeGb: 4.4,  minRamGb: 8,  specialty: 'multilingual'    },
  { id: 'mistral:7b',   label: 'Mistral 7B',             sizeGb: 4.1,  minRamGb: 8                               },
  { id: 'llama3:8b',    label: 'Meta Llama 3 8B',        sizeGb: 5.0,  minRamGb: 8                               },
  { id: 'gemma2:9b',    label: 'Google Gemma 2 9B',      sizeGb: 5.5,  minRamGb: 8                               },
  { id: 'llama3.1:8b',  label: 'Meta Llama 3.1 8B',      sizeGb: 5.0,  minRamGb: 8,  specialty: 'tool use'        },
  { id: 'codellama:7b', label: 'Code Llama 7B',          sizeGb: 3.8,  minRamGb: 8,  specialty: 'coding'          },
  { id: 'deepseek-r1:7b', label: 'DeepSeek R1 7B',       sizeGb: 4.7,  minRamGb: 8,  specialty: 'reasoning'       },
  { id: 'mixtral:8x7b', label: 'Mixtral 8x7B MoE',       sizeGb: 26.0, minRamGb: 32, specialty: 'high-performance'},
  { id: 'llama3:70b',   label: 'Meta Llama 3 70B',       sizeGb: 40.0, minRamGb: 48, specialty: 'flagship'        },
];

// ── Hardware analysis ───────────────────────────────────────────────────────

interface HardwareInfo {
  ramGb:    number;
  gpuName?: string;
  hasGpu:   boolean;
}

function analyzeHardware(): HardwareInfo {
  const ramGb = Math.round(os.totalmem() / (1024 ** 3));
  let gpuName: string | undefined;

  // NVIDIA — nvidia-smi
  try {
    const r = spawnSync('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
      encoding: 'utf8', timeout: 3000, shell: true,
    });
    if (r.status === 0 && r.stdout?.trim()) {
      gpuName = r.stdout.trim().split('\n')[0].trim();
    }
  } catch { /* nvidia-smi not installed */ }

  // macOS — system_profiler fallback
  if (!gpuName && process.platform === 'darwin') {
    try {
      const r = spawnSync('system_profiler', ['SPDisplaysDataType'], {
        encoding: 'utf8', timeout: 5000,
      });
      const m = r.stdout?.match(/Chipset Model:\s*(.+)/);
      if (m) gpuName = m[1].trim();
    } catch { /* ignore */ }
  }

  // Windows — wmic fallback
  if (!gpuName && process.platform === 'win32') {
    try {
      const r = spawnSync('wmic', ['path', 'win32_VideoController', 'get', 'name'], {
        encoding: 'utf8', timeout: 4000, shell: true,
      });
      const lines = (r.stdout ?? '').split('\n').map((l: string) => l.trim()).filter((l: string) => l && l !== 'Name');
      if (lines.length > 0) gpuName = lines[0];
    } catch { /* ignore */ }
  }

  return { ramGb, gpuName, hasGpu: !!gpuName };
}

// ── Ollama CLI detection + installation ────────────────────────────────────

function isOllamaCli(): boolean {
  return isOllamaPresent();
}

/**
 * Returns true if Ollama is present on disk (bypasses stale PATH).
 * Checks the absolute exe path first, then falls back to `ollama --version`.
 */
function isOllamaPresent(): boolean {
  // Absolute path check — works even when PATH is stale after winget install
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    const absExe = path.join(local, 'Programs', 'Ollama', 'ollama.exe');
    if (fs.existsSync(absExe)) return true;
  }
  // Shell PATH fallback
  const r = spawnSync('ollama', ['--version'], { encoding: 'utf8', timeout: 5000, shell: true });
  return r.status === 0 && !r.error;
}

async function installOllama(): Promise<boolean> {
  if (process.platform === 'win32') {
    console.log(`  ${cyan('→')}  Running: winget install Ollama.Ollama`);
    const r = spawnSync(
      'winget', ['install', '--id', 'Ollama.Ollama', '-e', '--silent'],
      { stdio: 'inherit', shell: true },
    );

    if (r.status === 0) return true;

    // winget exits non-zero for "already installed" / "No available upgrade found".
    // Verify via `winget list` first (captures output), then check exe on disk.
    console.log(`  ${cyan('→')}  winget exited non-zero — verifying Ollama presence…`);

    const listCheck = spawnSync(
      'winget', ['list', '--id', 'Ollama.Ollama', '-e'],
      { encoding: 'utf8', shell: true, timeout: 15000 },
    );
    const listOut = `${listCheck.stdout ?? ''} ${listCheck.stderr ?? ''}`.toLowerCase();
    if (listCheck.status === 0 && listOut.includes('ollama')) {
      console.log(`  ${green('✓')}  Ollama already installed (winget list confirmed).`);
      return true;
    }

    // Final fallback: check exe on disk directly
    if (isOllamaPresent()) {
      console.log(`  ${green('✓')}  Ollama executable found on disk — treating as installed.`);
      return true;
    }

    return false; // genuinely failed
  } else {
    // Linux / macOS
    console.log(`  ${cyan('→')}  Running: curl -fsSL https://ollama.com/install.sh | sh`);
    const r = spawnSync('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
      stdio: 'inherit',
    });
    return r.status === 0;
  }
}

// ── Daemon management ───────────────────────────────────────────────────────

/** Absolute path to the Ollama executable on Windows (survives fresh installs
 *  where the current terminal's PATH has not yet been refreshed). */
function ollamaAbsPath(): string {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'Programs', 'Ollama', 'ollama.exe');
  }
  return 'ollama'; // on Linux/macOS the shell PATH is fine
}

async function pingOllama(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Spawn the Ollama daemon detached, trying the absolute path first on Windows
 *  to bypass the stale PATH problem that appears right after a winget install. */
function spawnDaemon(): void {
  const absExe = ollamaAbsPath();

  // On Windows try absolute path first; fall back to shell PATH variant
  const spawnArgs: Parameters<typeof spawn> = process.platform === 'win32'
    ? [absExe, ['serve'], { detached: true, stdio: 'ignore', shell: false }]
    : ['ollama', ['serve'], { detached: true, stdio: 'ignore', shell: true }];

  try {
    const child = spawn(...spawnArgs);
    child.unref();
  } catch {
    // If the absolute-path spawn failed (e.g. not yet installed there), fall
    // back to the shell PATH form so at least something is attempted.
    try {
      const fallback = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', shell: true });
      fallback.unref();
    } catch { /* will be caught by the polling timeout */ }
  }
}

/** Kill any hanging Ollama processes (hard-reset for auto-repair). */
function killOllamaProcesses(): void {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM ollama.exe', { stdio: 'ignore' });
    } else {
      execSync('pkill -9 ollama', { stdio: 'ignore' });
    }
  } catch { /* process may not exist — that's fine */ }
}

/** Poll ${baseUrl}/api/version every second for up to ${maxSeconds} seconds. */
async function pollUntilUp(baseUrl: string, maxSeconds: number): Promise<boolean> {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await pingOllama(baseUrl)) return true;
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return false;
}

/**
 * Ensure the Ollama daemon is running.
 *
 * Strategy:
 *   1. Already up?  → return true immediately.
 *   2. Spawn daemon (absolute path on Windows to bypass stale PATH).
 *   3. Poll 25 s.
 *   4. Still down?  → prompt user for Doctor-style auto-repair.
 *      4a. Kill hung processes + hard-restart via absolute path.
 *      4b. Poll another 25 s.
 *      4c. Still down?  → throw so the caller never falls through silently.
 */
async function ensureDaemon(
  baseUrl: string,
  inq: { prompt: (q: object[]) => Promise<Record<string, unknown>> },
): Promise<void> {
  if (await pingOllama(baseUrl)) return; // already running

  console.log(`  ${cyan('→')}  Starting Ollama daemon…`);
  spawnDaemon();

  if (await pollUntilUp(baseUrl, 25)) {
    console.log(`  ${green('✓')}  Ollama daemon is up.`);
    return;
  }

  // ── Auto-repair loop ────────────────────────────────────────────────────
  console.log(`\n  ${yellow('⚠')}  Daemon did not respond after 25 s.`);
  const { doRepair } = await inq.prompt([{
    type:    'confirm',
    name:    'doRepair',
    message: 'Daemon failed to start. Attempt hard-reset and auto-repair?',
    default: true,
  }]);

  if (!doRepair) {
    throw new Error(
      'Ollama daemon is not running. Run `ollama serve` in a separate terminal then re-run `must-b onboard`.',
    );
  }

  console.log(`  ${cyan('→')}  Killing any hung Ollama processes…`);
  killOllamaProcesses();
  await new Promise(r => setTimeout(r, 2000)); // brief settle time

  console.log(`  ${cyan('→')}  Hard-restarting Ollama via absolute path…`);
  spawnDaemon();

  if (await pollUntilUp(baseUrl, 25)) {
    console.log(`  ${green('✓')}  Ollama daemon is up after auto-repair.`);
    return;
  }

  throw new Error(
    'Ollama daemon could not be started even after auto-repair. ' +
    'Please run `ollama serve` manually in a separate terminal, then re-run `must-b onboard`.',
  );
}

// ── Model list query ────────────────────────────────────────────────────────

async function getInstalledModels(baseUrl: string): Promise<string[]> {
  try {
    const res  = await fetch(`${baseUrl}/api/tags`);
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// ── Smart choice builder ────────────────────────────────────────────────────

type Tag = 'recommended' | 'fits' | 'heavy';

function getTag(m: ModelEntry, ramGb: number): Tag {
  if (m.minRamGb > ramGb) return 'heavy';
  // Best fit per RAM tier
  if (ramGb < 8  && (m.id === 'phi3:mini'   || m.id === 'qwen2.5:0.5b')) return 'recommended';
  if (ramGb >= 8 && ramGb < 32 && (m.id === 'llama3:8b' || m.id === 'mistral:7b')) return 'recommended';
  if (ramGb >= 32 && m.id === 'mixtral:8x7b') return 'recommended';
  return 'fits';
}

function buildChoices(hw: HardwareInfo) {
  const tagged = MODEL_CATALOG.map(m => ({ m, tag: getTag(m, hw.ramGb) }));

  // Sort: recommended first, then fits, then heavy — preserve original order within each tier
  const order: Tag[] = ['recommended', 'fits', 'heavy'];
  tagged.sort((a, b) => order.indexOf(a.tag) - order.indexOf(b.tag));

  const choices = tagged.map(({ m, tag }) => {
    const suffix =
      tag === 'recommended' ? green('  ★ Recommended for your hardware')
      : tag === 'heavy'     ? yellow(`  ⚠ Needs ${m.minRamGb}GB+ RAM (you have ${hw.ramGb}GB)`)
      : '';

    const spec  = m.specialty ? dim(` · ${m.specialty}`) : '';
    const label = `${m.id.padEnd(22)} ${dim(m.label.padEnd(24))} ${dim(`${m.sizeGb}GB`)}${spec}${suffix}`;
    return { name: label, value: m.id };
  });

  choices.push({ name: dim('Skip — I will pull a model manually later'), value: 'skip' });
  return choices;
}

// ── Public entry point ──────────────────────────────────────────────────────

export async function runOllamaManager(baseUrl: string, inquirer: unknown): Promise<void> {
  const inq = inquirer as { prompt: (q: object[]) => Promise<Record<string, unknown>> };
  console.log('');

  // ── 1. Hardware analysis ────────────────────────────────────────────────
  process.stdout.write('  Analysing hardware…');
  const hw = analyzeHardware();
  const gpuLine = hw.gpuName
    ? `  ·  GPU: ${bold(hw.gpuName)}`
    : `  ·  ${dim('no discrete GPU detected')}`;
  process.stdout.write(`\r  ${green('✓')}  RAM: ${bold(`${hw.ramGb} GB`)}${gpuLine}\n`);

  // ── 2. Check / install Ollama CLI ───────────────────────────────────────
  let cliReady = isOllamaCli();
  if (!cliReady) {
    console.log(`\n  ${yellow('⚠')}  Ollama CLI not found on this system.`);
    const { doInstall } = await inq.prompt([{
      type:    'confirm',
      name:    'doInstall',
      message: 'Install Ollama automatically now?',
      default: true,
    }]);
    if (!doInstall) {
      console.log(dim(`  Install manually:  https://ollama.com  then re-run: must-b onboard`));
      return;
    }
    cliReady = await installOllama();
    if (!cliReady) {
      console.log(`  ${yellow('⚠')}  Auto-install may have failed. Visit: https://ollama.com`);
      return;
    }
    console.log(`  ${green('✓')}  Ollama installed.`);
  } else {
    const ver = spawnSync('ollama', ['--version'], { encoding: 'utf8', shell: true });
    const vStr = ver.stdout?.trim() ?? '';
    console.log(`  ${green('✓')}  Ollama CLI detected${vStr ? ` (${dim(vStr)})` : ''}.`);
  }

  // ── 3. Ensure daemon is running ─────────────────────────────────────────
  try {
    await ensureDaemon(baseUrl, inq);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`\n  ${yellow('⚠')}  ${msg}`);
    return;
  }

  // ── 4. Already have models? ─────────────────────────────────────────────
  const installed = await getInstalledModels(baseUrl);
  if (installed.length > 0) {
    console.log(`  ${green('✓')}  Models already installed: ${installed.slice(0, 5).join(', ')}`);
    return;
  }

  // ── 5. Smart model picker ───────────────────────────────────────────────
  console.log(`\n  ${yellow('⚠')}  No models installed yet.`);
  console.log(dim(`  All models are shown below. Recommended ones are tagged ★ based on your ${hw.ramGb}GB RAM.\n`));

  const { selectedModel } = await inq.prompt([{
    type:     'list',
    name:     'selectedModel',
    message:  'Select a model to download:',
    choices:  buildChoices(hw),
    pageSize: MODEL_CATALOG.length + 3,
  }]);

  if (selectedModel === 'skip') {
    console.log(dim(`  Skipped. Pull any time:  ollama pull <model>`));
    return;
  }

  // ── 6. Pull with live progress ──────────────────────────────────────────
  console.log(`\n  ${cyan('→')}  Pulling ${bold(String(selectedModel))} — this may take several minutes…\n`);
  const result = spawnSync('ollama', ['pull', String(selectedModel)], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status === 0) {
    console.log(`\n  ${green('✓')}  ${bold(String(selectedModel))} downloaded successfully.`);
  } else {
    console.log(`\n  ${yellow('⚠')}  Pull may have failed. Run manually:  ollama pull ${String(selectedModel)}`);
  }
}
