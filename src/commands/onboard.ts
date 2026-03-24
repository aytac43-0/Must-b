/**
 * Must-b Onboarding Wizard (v1.5.0-alpha.2)
 *
 * Phase 2: Universal Onboarding Fork.
 * After the welcome banner the user chooses:
 *   • Terminal (CLI)  — text-based wizard (existing flow)
 *   • Web Dashboard   — hands off to the Express/Vite server and opens /setup
 *
 * Every answer is written to BOTH the .env file AND UniversalStore so that
 * runtime env is immediately synchronised without server restarts.
 *
 * Returns { webMode: true } when the user picked Web Dashboard so that
 * index.ts can boot the server immediately.
 */
import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { printBanner }      from '../utils/banner.js';
import { runDoctor, DoctorResult } from './doctor.js';
import { LongTermMemory }   from '../memory/long-term.js';
import { runOllamaManager } from '../utils/ollamaManager.js';
import { UniversalStore }   from '../core/config-store.js';

/** Result returned by runOnboard — webMode signals gateway boot is needed. */
export interface OnboardResult {
  webMode?: boolean;
}

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
  { value: 'openrouter', label: 'OpenRouter',          keyEnv: 'OPENROUTER_API_KEY',   hint: 'openrouter.ai/keys',        isUrl: false },
  { value: 'openai',     label: 'OpenAI',              keyEnv: 'OPENAI_API_KEY',       hint: 'platform.openai.com',       isUrl: false },
  { value: 'anthropic',  label: 'Anthropic (Claude)',  keyEnv: 'ANTHROPIC_API_KEY',    hint: 'console.anthropic.com',     isUrl: false },
  { value: 'gemini',     label: 'Google Gemini',       keyEnv: 'GOOGLE_API_KEY',       hint: 'aistudio.google.com',       isUrl: false },
  { value: 'groq',       label: 'Groq (Fast)',         keyEnv: 'GROQ_API_KEY',         hint: 'console.groq.com',          isUrl: false },
  { value: 'deepseek',   label: 'DeepSeek API',        keyEnv: 'DEEPSEEK_API_KEY',     hint: 'platform.deepseek.com',     isUrl: false },
  { value: 'xai',        label: 'xAI  (Grok)',         keyEnv: 'XAI_API_KEY',          hint: 'console.x.ai',              isUrl: false },
  { value: 'mistral',    label: 'Mistral API',         keyEnv: 'MISTRAL_API_KEY',      hint: 'console.mistral.ai',        isUrl: false },
  { value: 'together',   label: 'Together AI',         keyEnv: 'TOGETHER_API_KEY',     hint: 'api.together.xyz',          isUrl: false },
  { value: 'moonshot',   label: 'Moonshot (Kimi)',     keyEnv: 'MOONSHOT_API_KEY',     hint: 'platform.moonshot.cn',      isUrl: false },
  { value: 'azure',      label: 'Azure OpenAI',        keyEnv: 'AZURE_OPENAI_API_KEY', hint: 'azure.microsoft.com/ai',    isUrl: false },
  { value: 'vertex',     label: 'Vertex AI',           keyEnv: 'GOOGLE_CLOUD_PROJECT', hint: 'cloud.google.com/vertex',   isUrl: true  },
  { value: 'ollama',     label: 'Ollama  (local)',     keyEnv: 'OLLAMA_BASE_URL',      hint: 'http://localhost:11434',    isUrl: true  },
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

// ── Browser launcher ───────────────────────────────────────────────────────

function openBrowserToSetup(port: number): void {
  const url = `http://localhost:${port}/setup`;
  const cmd =
    process.platform === 'win32'  ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
                                     `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.warn(`  [browser] ${err.message}`); });
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export async function runOnboard(root: string): Promise<OnboardResult> {
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

  // ── Setup Path Fork ──────────────────────────────────────────────────────
  // Phase 2: let the user choose between text-based CLI wizard and visual web UI.
  const { setupPath } = await inquirer.prompt([{
    type:    'list',
    name:    'setupPath',
    message: 'How would you like to complete the Must-b setup?',
    choices: [
      { name: `${cyan('Terminal (CLI)')}   ${dim('— Fast and text-based')}`,             value: 'cli' },
      { name: `${cyan('Web Dashboard')}    ${dim('— Visual and guided (Opens browser)')}`, value: 'web' },
    ],
  }]);

  if (setupPath === 'web') {
    const port = parseInt(process.env.PORT || '4309', 10);
    console.log('');
    console.log(cyan(`  Opening Web Setup Wizard → http://localhost:${port}/setup`));
    console.log(dim('  The Must-b server will start and your browser will open automatically.'));
    console.log(dim('  Complete the setup in the browser, then return here.\n'));
    openBrowserToSetup(port);
    return { webMode: true };
  }

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
  UniversalStore.get().set('MUSTB_NAME', userName);

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
  UniversalStore.get().set('MUSTB_LANG', lang);

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

  // Default model per provider — written as LLM_MODEL (universal active-model key)
  // and as AI_PROVIDER (alias for LLM_PROVIDER used by the frontend).
  const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
    openai:     'gpt-4o-mini',
    anthropic:  'claude-3-5-haiku-20241022',
    gemini:     'gemini-1.5-flash',
    groq:       'llama3-8b-8192',
    mistral:    'mistral-small-latest',
    xai:        'grok-beta',
    deepseek:   'deepseek-chat',
    together:   'meta-llama/Llama-3-8b-chat-hf',
    moonshot:   'moonshot-v1-8k',
    openrouter: 'openai/gpt-4o-mini',
    vertex:     'gemini-1.5-flash-001',
    ollama:     '', // set later by ollamaManager after the model pull
    azure:      '', // deployment-specific — set separately in .env
  };

  writeEnvKey(envPath, 'LLM_PROVIDER', provider.value);
  writeEnvKey(envPath, 'AI_PROVIDER',  provider.value);
  process.env.LLM_PROVIDER = provider.value;
  process.env.AI_PROVIDER  = provider.value;
  UniversalStore.get().set('LLM_PROVIDER', provider.value);
  UniversalStore.get().set('AI_PROVIDER',  provider.value);

  const defaultModel = PROVIDER_DEFAULT_MODELS[provider.value] ?? '';
  if (defaultModel) {
    writeEnvKey(envPath, 'LLM_MODEL', defaultModel);
    process.env.LLM_MODEL = defaultModel;
    UniversalStore.get().set('LLM_MODEL', defaultModel);
  }

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
    // Full autonomous Ollama lifecycle: install CLI, start daemon, smart model picker
    if (provider.value === 'ollama') {
      await runOllamaManager(val || defaultUrl, inquirer);
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
      UniversalStore.get().set(provider.keyEnv, key);
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
  UniversalStore.get().set('MUSTB_MODE', mode);

  let uid = process.env.MUSTB_UID ?? '';
  if (mode === 'world' && !uid) {
    uid = generateUid();
    writeEnvKey(envPath, 'MUSTB_UID', uid);
    process.env.MUSTB_UID = uid;
    UniversalStore.get().set('MUSTB_UID', uid);
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
  UniversalStore.get().set('MUSTB_SETUP_COMPLETE', 'true');

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
  return {};
}
