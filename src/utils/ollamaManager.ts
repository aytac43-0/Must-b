/**
 * Ollama Manager (v1.4.0)
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
 */

import os           from 'os';
import { spawnSync, spawn } from 'child_process';

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
  const r = spawnSync('ollama', ['--version'], {
    encoding: 'utf8', timeout: 5000, shell: true,
  });
  return r.status === 0 && !r.error;
}

async function installOllama(): Promise<boolean> {
  if (process.platform === 'win32') {
    console.log(`  ${cyan('→')}  Running: winget install Ollama.Ollama`);
    const r = spawnSync(
      'winget', ['install', '--id', 'Ollama.Ollama', '-e', '--silent'],
      { stdio: 'inherit', shell: true },
    );
    return r.status === 0;
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

async function ensureDaemon(baseUrl: string): Promise<boolean> {
  if (await pingOllama(baseUrl)) return true;

  console.log(`  ${cyan('→')}  Starting Ollama daemon…`);
  const child = spawn('ollama', ['serve'], {
    detached: true,
    stdio:    'ignore',
    shell:    true,
  });
  child.unref();

  // Poll up to 8 seconds
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await pingOllama(baseUrl)) {
      console.log(`  ${green('✓')}  Ollama daemon is up.`);
      return true;
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return false;
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
  const daemonUp = await ensureDaemon(baseUrl);
  if (!daemonUp) {
    console.log(`  ${yellow('⚠')}  Could not start Ollama daemon.`);
    console.log(dim(`     Start manually:  ollama serve`));
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
