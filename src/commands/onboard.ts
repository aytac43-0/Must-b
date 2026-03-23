/**
 * Must-b Onboarding Wizard (v1.4.0)
 *
 * Interactive CLI setup using inquirer v8.
 * Covers all 11 AI providers + full 10-tool skill roster.
 * Writes directly to .env — user never touches a text editor.
 * Writes MUSTB_SETUP_COMPLETE=true only on full success,
 * so an ESC/Ctrl+C mid-way always re-triggers the wizard.
 */
import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { printBanner }    from '../utils/banner.js';
import { runDoctor, DoctorResult } from './doctor.js';
import { LongTermMemory } from '../memory/long-term.js';

// ── Colour helpers (matches Must-b identity) ──────────────────────────────

const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Helpers ────────────────────────────────────────────────────────────────

function generateUid(): string { return 'mustb_' + crypto.randomBytes(12).toString('hex'); }

function writeEnvKey(envPath: string, key: string, value: string): void {
  let c = ''; try { c = fs.readFileSync(envPath, 'utf-8'); } catch { c = ''; }
  const lines = c.split('\n');
  const idx = lines.findIndex((l: string) => l.startsWith(key + '='));
  if (idx >= 0) lines[idx] = `${key}=${value}`; else lines.push(`${key}=${value}`);
  fs.writeFileSync(envPath, lines.filter(l => l !== '').join('\n') + '\n', 'utf-8');
}

function readEnvKey(envPath: string, key: string): string {
  try {
    const match = fs.readFileSync(envPath, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : '';
  } catch { return ''; }
}

// ── Provider + Skill Definitions ──────────────────────────────────────────

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter',       keyEnv: 'OPENROUTER_API_KEY',     hint: 'openrouter.ai/keys',       isUrl: false },
  { value: 'openai',     label: 'OpenAI',            keyEnv: 'OPENAI_API_KEY',         hint: 'platform.openai.com',      isUrl: false },
  { value: 'anthropic',  label: 'Anthropic',         keyEnv: 'ANTHROPIC_API_KEY',      hint: 'console.anthropic.com',    isUrl: false },
  { value: 'gemini',     label: 'Google Gemini',     keyEnv: 'GOOGLE_API_KEY',         hint: 'aistudio.google.com',      isUrl: false },
  { value: 'groq',       label: 'Groq',              keyEnv: 'GROQ_API_KEY',           hint: 'console.groq.com',         isUrl: false },
  { value: 'ollama',     label: 'Ollama  (local)',   keyEnv: 'OLLAMA_BASE_URL',        hint: 'http://localhost:11434',   isUrl: true  },
  { value: 'mistral',    label: 'Mistral AI',        keyEnv: 'MISTRAL_API_KEY',        hint: 'console.mistral.ai',       isUrl: false },
  { value: 'xai',        label: 'xAI  (Grok)',       keyEnv: 'XAI_API_KEY',            hint: 'console.x.ai',             isUrl: false },
  { value: 'deepseek',   label: 'DeepSeek',          keyEnv: 'DEEPSEEK_API_KEY',       hint: 'platform.deepseek.com',    isUrl: false },
  { value: 'azure',      label: 'Azure OpenAI',      keyEnv: 'AZURE_OPENAI_API_KEY',   hint: 'azure.microsoft.com/ai',   isUrl: false },
  { value: 'vertex',     label: 'Vertex AI',         keyEnv: 'GOOGLE_CLOUD_PROJECT',   hint: 'cloud.google.com/vertex',  isUrl: true  },
] as const;

const SKILLS = [
  { value: 'terminal',   label: 'Terminal & Bash Execution',  envKey: 'SKILL_TERMINAL',    hint: 'Run shell commands, npm, Python scripts' },
  { value: 'filesystem', label: 'Full Filesystem Suite',      envKey: 'SKILL_FILESYSTEM',  hint: 'Read, write, patch, search, delete files' },
  { value: 'git',        label: 'Git Integration',            envKey: 'SKILL_GIT',         hint: 'Commit, push, create PRs automatically' },
  { value: 'browser',    label: 'Browser Automation',         envKey: 'SKILL_BROWSER',     hint: 'Playwright — navigate, click, scrape' },
  { value: 'web_search', label: 'Web Search',                 envKey: 'SKILL_WEB_SEARCH',  hint: 'Search the web and summarize results' },
  { value: 'vision',     label: 'Screen Vision & Capture',    envKey: 'SKILL_VISION',      hint: 'Screenshot, detect UI elements' },
  { value: 'input',      label: 'OS Input Control',           envKey: 'SKILL_INPUT',       hint: 'Simulate mouse clicks & keyboard typing' },
  { value: 'memory',     label: 'Long-Term Memory',           envKey: 'SKILL_MEMORY',      hint: 'Semantic vector index, knowledge base' },
  { value: 'telegram',   label: 'Telegram Messaging',         envKey: 'SKILL_TELEGRAM',    hint: 'Send messages via Telegram Bot API' },
  { value: 'analyzer',   label: 'Project Analyzer',           envKey: 'SKILL_ANALYZER',    hint: 'Read and summarize codebases & READMEs' },
] as const;

// ── Ollama Interactive Setup ───────────────────────────────────────────────
// Called when the user selects Ollama as their provider.
// 1) Pings the local Ollama API.  If down, warns and returns.
// 2) Fetches installed models.  If none, prompts to pull a recommended one.

const OLLAMA_RECOMMENDED = [
  { name: 'llama3:8b    — Meta Llama 3 8B  (5 GB)  · best balance',    value: 'llama3:8b'   },
  { name: 'mistral:7b   — Mistral 7B       (4.1 GB) · fast & capable',  value: 'mistral:7b'  },
  { name: 'phi3:mini    — Microsoft Phi-3  (2.3 GB) · lightweight',      value: 'phi3:mini'   },
  { name: 'gemma2:9b    — Google Gemma 2   (5.5 GB)',                    value: 'gemma2:9b'   },
  { name: 'qwen2.5:7b   — Alibaba Qwen 2.5 (4.4 GB)',                   value: 'qwen2.5:7b'  },
  { name: 'Skip — I will pull a model manually later',                   value: null          },
] as const;

async function runOllamaSetup(baseUrl: string, inquirer: any): Promise<void> {
  console.log('');

  // ── 1. Ping ───────────────────────────────────────────────────────────────
  let ollamaUp = false;
  try {
    const res = await fetch(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });
    ollamaUp = res.ok;
  } catch { /* unreachable or timeout */ }

  if (!ollamaUp) {
    console.log(`  ${yellow('⚠')}  Ollama is not running at ${dim(baseUrl)}.`);
    console.log(dim(`     Start it first:  ollama serve`));
    console.log(dim(`     Then re-run:     must-b onboard`));
    return;
  }
  console.log(`  ${green('✓')}  Ollama is running at ${dim(baseUrl)}.`);

  // ── 2. Fetch installed models ─────────────────────────────────────────────
  let installedModels: string[] = [];
  try {
    const tagsRes  = await fetch(`${baseUrl}/api/tags`);
    const data     = await tagsRes.json() as { models?: { name: string }[] };
    installedModels = (data.models ?? []).map((m: { name: string }) => m.name);
  } catch { /* ignore — treat as empty */ }

  if (installedModels.length > 0) {
    console.log(`  ${green('✓')}  Models installed: ${installedModels.slice(0, 5).join(', ')}`);
    return;
  }

  // ── 3. No models — offer to pull one ─────────────────────────────────────
  console.log(`  ${yellow('⚠')}  No models are installed in Ollama yet.`);
  const { modelToPull } = await inquirer.prompt([{
    type:    'list',
    name:    'modelToPull',
    message: 'Select a model to download now (or skip):',
    choices: OLLAMA_RECOMMENDED,
  }]);

  if (!modelToPull) {
    console.log(dim(`  Skipped. Pull later:  ollama pull <model>`));
    return;
  }

  console.log(`\n  ${cyan('→')}  Pulling ${modelToPull} — this may take several minutes…\n`);
  const result = spawnSync('ollama', ['pull', modelToPull], { stdio: 'inherit', shell: true });
  if (result.status === 0) {
    console.log(`\n  ${green('✓')}  ${modelToPull} downloaded successfully.`);
  } else {
    console.log(`\n  ${yellow('⚠')}  Pull may have failed. Run manually: ollama pull ${modelToPull}`);
  }
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export async function runOnboard(root: string): Promise<void> {
  // inquirer v8 is CJS — dynamic import resolves correctly from the bundled CJS context
  const { default: inquirer } = await import('inquirer');

  printBanner('onboard', 4309);
  console.log(cyan('  Must-b — First-Time Setup Wizard'));
  console.log(dim('  Press Ctrl+C at any time to cancel and resume later.\n'));

  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    const ex = path.join(root, '.env.example');
    if (fs.existsSync(ex)) fs.copyFileSync(ex, envPath);
    else fs.writeFileSync(envPath, '', 'utf-8');
  }

  // Graceful Ctrl+C — MUSTB_SETUP_COMPLETE is NOT written yet, so the wizard
  // will re-run on next invocation rather than leaving a broken config.
  process.on('SIGINT', () => {
    console.log('\n\n  Setup cancelled. Run  must-b onboard  to resume.\n');
    process.exit(0);
  });

  // ── Step 1: Name ──────────────────────────────────────────────────────────
  const { userName } = await inquirer.prompt([{
    type:    'input',
    name:    'userName',
    message: 'Your name:',
    default: 'User',
    filter:  (v: string) => v.trim() || 'User',
  }]);
  writeEnvKey(envPath, 'MUSTB_NAME', userName);
  process.env.MUSTB_NAME = userName;

  // ── Step 2: Language ──────────────────────────────────────────────────────
  const { lang } = await inquirer.prompt([{
    type:    'list',
    name:    'lang',
    message: 'Preferred language:',
    choices: [
      { name: 'English', value: 'en' },
      { name: 'Türkçe',  value: 'tr' },
      { name: 'Deutsch', value: 'de' },
    ],
  }]);
  writeEnvKey(envPath, 'MUSTB_LANG', lang);
  process.env.MUSTB_LANG = lang;

  // ── Step 3: AI Provider ───────────────────────────────────────────────────
  const { providerValue } = await inquirer.prompt([{
    type:    'list',
    name:    'providerValue',
    message: 'Select your AI provider:',
    choices: PROVIDERS.map(p => ({
      name:  `${p.label.padEnd(18)} ${dim(p.hint)}`,
      value: p.value,
    })),
  }]);
  const provider = PROVIDERS.find(p => p.value === providerValue)!;
  writeEnvKey(envPath, 'LLM_PROVIDER', provider.value);

  // ── Step 4: API Key / URL ─────────────────────────────────────────────────
  const existingKey = readEnvKey(envPath, provider.keyEnv)
                   || ((process.env as Record<string, string>)[provider.keyEnv] ?? '');

  if (existingKey && !existingKey.includes('...')) {
    console.log(`  ${green('✓')}  ${provider.label} key already set: ${existingKey.slice(0, 12)}***`);
  } else if (provider.isUrl) {
    const defaultUrl = provider.value === 'ollama' ? 'http://localhost:11434' : '';
    const { urlVal } = await inquirer.prompt([{
      type:    'input',
      name:    'urlVal',
      message: provider.value === 'ollama' ? 'Ollama base URL:' : `${provider.label} URL:`,
      default: defaultUrl,
    }]);
    const val = (urlVal as string).trim() || defaultUrl;
    if (val) {
      writeEnvKey(envPath, provider.keyEnv, val);
      (process.env as Record<string, string>)[provider.keyEnv] = val;
    }
    // Interactive Ollama model check — ping, list, and optionally pull
    if (provider.value === 'ollama') {
      await runOllamaSetup(val || defaultUrl, inquirer);
    }
  } else {
    console.log(dim(`  Leave blank to skip — add later in .env or re-run: must-b onboard`));
    const { apiKey } = await inquirer.prompt([{
      type:    'password',
      name:    'apiKey',
      message: `${provider.label} API key:`,
      mask:    '▪',
    }]);
    const key = (apiKey as string).trim();
    if (key) {
      writeEnvKey(envPath, provider.keyEnv, key);
      (process.env as Record<string, string>)[provider.keyEnv] = key;
      console.log(`  ${green('✓')}  Key saved.`);
    } else {
      console.log(`  ${yellow('⚠')}  No key — LLM chat disabled until a key is set.`);
      console.log(dim(`     Add later:  .env → ${provider.keyEnv}=your-key`));
    }
  }

  // ── Step 5: Tools / Skills ────────────────────────────────────────────────
  console.log('');
  console.log(dim('  Space = toggle  ·  A = select/deselect all  ·  Enter = confirm'));
  const { selectedSkills } = await inquirer.prompt([{
    type:    'checkbox',
    name:    'selectedSkills',
    message: 'Enable tools:',
    choices: SKILLS.map(s => ({
      name:    `${s.label.padEnd(30)} ${dim(s.hint)}`,
      value:   s.value,
      checked: true,
    })),
  }]);
  for (const skill of SKILLS) {
    const enabled = (selectedSkills as string[]).includes(skill.value);
    writeEnvKey(envPath, skill.envKey, enabled ? 'true' : 'false');
  }

  // ── Step 6: Mode ──────────────────────────────────────────────────────────
  const { mode } = await inquirer.prompt([{
    type:    'list',
    name:    'mode',
    message: 'Operating mode:',
    choices: [
      { name: `Local   ${dim('— single machine, no external ID')}`,             value: 'local' },
      { name: `World   ${dim('— cross-device, generates a unique MUSTB_UID')}`, value: 'world' },
    ],
  }]);
  writeEnvKey(envPath, 'MUSTB_MODE', mode);

  let uid = process.env.MUSTB_UID ?? '';
  if (mode === 'world' && !uid) {
    uid = generateUid();
    writeEnvKey(envPath, 'MUSTB_UID', uid);
    process.env.MUSTB_UID = uid;
  }

  // ── Save Profile ──────────────────────────────────────────────────────────
  const mem = new LongTermMemory(root);
  await mem.load();
  const modeStr = mode as 'local' | 'world';
  mem.setProfile({ name: userName, mode: modeStr, uid: modeStr === 'world' ? uid : undefined });
  await mem.save();

  // ── Mark setup complete — MUST be the last .env write ────────────────────
  // If the user cancels (Ctrl+C / process kill) before reaching this line,
  // MUSTB_SETUP_COMPLETE is never written and the wizard restarts on next run.
  writeEnvKey(envPath, 'MUSTB_SETUP_COMPLETE', 'true');

  // ── Health Check + Active Auto-Repair Prompt ──────────────────────────────
  console.log('');
  process.stdout.write('  Running health check…');
  let doctorResult: DoctorResult = { failed: 0, healed: 0, remaining: 0, criticalBlock: false };
  try {
    doctorResult = await runDoctor(root, false, true); // check-only, silent
    if (doctorResult.remaining === 0) {
      process.stdout.write(`\r  ${green('✓')}  Health check passed. All systems go.   \n`);
    } else {
      process.stdout.write(`\r  ${yellow('⚠')}  Health check complete.                 \n`);
    }
  } catch {
    process.stdout.write(`\r  ${yellow('⚠')}  Health check done.                     \n`);
  }

  // If any dependency checks failed, ask the user if they want active auto-repair
  if (doctorResult.remaining > 0) {
    console.log(`\n  ${yellow('⚠')}  ${doctorResult.remaining} dependency issue(s) detected.`);
    const { doFix } = await inquirer.prompt([{
      type:    'confirm',
      name:    'doFix',
      message: 'Some dependencies are missing. Do you want to run auto-repair now?',
      default: true,
    }]);
    if (doFix) {
      console.log('');
      await runDoctor(root, true, false); // fix=true, verbose output
      console.log('');
    }
  }

  console.log('');
  console.log(cyan('  ══════════════════════════════════════════════════'));
  console.log(`  Must-b is ready, ${bold(userName)}!`);
  console.log(cyan('  ══════════════════════════════════════════════════'));
  console.log(`  ${cyan('must-b web')}       →  http://localhost:4309`);
  console.log(`  ${cyan('must-b cli')}       →  terminal chat`);
  console.log(`  ${cyan('must-b doctor')}    →  health check`);
  console.log('');
}
