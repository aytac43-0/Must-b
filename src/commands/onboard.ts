/**
 * Must-b Onboarding Wizard (v1.3.0)
 *
 * Interactive CLI setup using @clack/prompts.
 * Covers all 11 AI providers + full 10-tool skill roster.
 * Writes directly to .env — user never touches a text editor.
 */
import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import { printBanner } from '../utils/banner.js';
import { runDoctor }   from './doctor.js';
import { LongTermMemory } from '../memory/long-term.js';

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
  { value: 'openrouter', label: 'OpenRouter',       keyEnv: 'OPENROUTER_API_KEY',     hint: 'sk-or-v1-…   → openrouter.ai/keys',    isUrl: false },
  { value: 'openai',     label: 'OpenAI',            keyEnv: 'OPENAI_API_KEY',         hint: 'sk-…         → platform.openai.com',    isUrl: false },
  { value: 'anthropic',  label: 'Anthropic',         keyEnv: 'ANTHROPIC_API_KEY',      hint: 'sk-ant-…     → console.anthropic.com',  isUrl: false },
  { value: 'gemini',     label: 'Google Gemini',     keyEnv: 'GOOGLE_API_KEY',         hint: 'AIza…        → aistudio.google.com',    isUrl: false },
  { value: 'groq',       label: 'Groq',              keyEnv: 'GROQ_API_KEY',           hint: 'gsk_…        → console.groq.com',       isUrl: false },
  { value: 'ollama',     label: 'Ollama  (local)',   keyEnv: 'OLLAMA_BASE_URL',        hint: 'http://localhost:11434  (no key needed)', isUrl: true  },
  { value: 'mistral',    label: 'Mistral AI',        keyEnv: 'MISTRAL_API_KEY',        hint: 'your-key     → console.mistral.ai',     isUrl: false },
  { value: 'xai',        label: 'xAI  (Grok)',       keyEnv: 'XAI_API_KEY',            hint: 'xai-…        → console.x.ai',           isUrl: false },
  { value: 'deepseek',   label: 'DeepSeek',          keyEnv: 'DEEPSEEK_API_KEY',       hint: 'sk-…         → platform.deepseek.com',  isUrl: false },
  { value: 'azure',      label: 'Azure OpenAI',      keyEnv: 'AZURE_OPENAI_API_KEY',   hint: 'your-key     → azure.microsoft.com/ai', isUrl: false },
  { value: 'vertex',     label: 'Vertex AI',         keyEnv: 'GOOGLE_CLOUD_PROJECT',   hint: 'project-id   → cloud.google.com/vertex',isUrl: true  },
] as const;

const SKILLS = [
  { value: 'terminal',   label: 'Terminal & Bash Execution',  envKey: 'SKILL_TERMINAL',    hint: 'Run shell commands, npm, Python scripts' },
  { value: 'filesystem', label: 'Full Filesystem Suite',      envKey: 'SKILL_FILESYSTEM',  hint: 'Read, write, patch, search, delete files' },
  { value: 'git',        label: 'Git Integration',            envKey: 'SKILL_GIT',         hint: 'Commit, push, create PRs automatically' },
  { value: 'browser',    label: 'Browser Automation',         envKey: 'SKILL_BROWSER',     hint: 'Playwright Chromium — navigate, click, scrape' },
  { value: 'web_search', label: 'Web Search',                 envKey: 'SKILL_WEB_SEARCH',  hint: 'Search the web and summarize results' },
  { value: 'vision',     label: 'Screen Vision & Capture',    envKey: 'SKILL_VISION',      hint: 'Screenshot, detect UI elements, video stream' },
  { value: 'input',      label: 'OS Input Control',           envKey: 'SKILL_INPUT',       hint: 'Simulate mouse clicks & keyboard typing' },
  { value: 'memory',     label: 'Long-Term Memory',           envKey: 'SKILL_MEMORY',      hint: 'Semantic vector index, knowledge base' },
  { value: 'telegram',   label: 'Telegram Messaging',         envKey: 'SKILL_TELEGRAM',    hint: 'Send messages via Telegram Bot API' },
  { value: 'analyzer',   label: 'Project Analyzer',           envKey: 'SKILL_ANALYZER',    hint: 'Read and summarize codebases & READMEs' },
] as const;

// ── Main Wizard ────────────────────────────────────────────────────────────

export async function runOnboard(root: string): Promise<void> {
  // Dynamic import — @clack/prompts is ESM-only; dynamic import works from CJS
  const {
    intro, outro, text, select, multiselect, password,
    isCancel, spinner, note, cancel,
  } = await import('@clack/prompts');

  printBanner('onboard', 4309);

  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    const ex = path.join(root, '.env.example');
    if (fs.existsSync(ex)) fs.copyFileSync(ex, envPath);
    else fs.writeFileSync(envPath, '', 'utf-8');
  }

  intro('  Must-b — First-Time Setup Wizard  ');

  // ── Step 1: Name ─────────────────────────────────────────────────────────
  const rawName = await text({
    message: 'Your name',
    placeholder: 'User',
    defaultValue: 'User',
  });
  if (isCancel(rawName)) { cancel('Setup cancelled.'); process.exit(0); }
  const userName = (rawName as string).trim() || 'User';
  writeEnvKey(envPath, 'MUSTB_NAME', userName);
  process.env.MUSTB_NAME = userName;

  // ── Step 2: Language ─────────────────────────────────────────────────────
  const lang = await select({
    message: 'Preferred language',
    options: [
      { value: 'en', label: 'English' },
      { value: 'tr', label: 'Türkçe' },
      { value: 'de', label: 'Deutsch' },
    ],
  });
  if (isCancel(lang)) { cancel('Setup cancelled.'); process.exit(0); }
  writeEnvKey(envPath, 'MUSTB_LANG', lang as string);
  process.env.MUSTB_LANG = lang as string;

  // ── Step 3: AI Provider ───────────────────────────────────────────────────
  const providerValue = await select({
    message: 'Select your AI provider',
    options: PROVIDERS.map(p => ({ value: p.value, label: p.label, hint: p.hint })),
  });
  if (isCancel(providerValue)) { cancel('Setup cancelled.'); process.exit(0); }

  const provider = PROVIDERS.find(p => p.value === providerValue)!;
  writeEnvKey(envPath, 'LLM_PROVIDER', provider.value);

  // ── Step 4: API Key / URL ─────────────────────────────────────────────────
  const existingKey = readEnvKey(envPath, provider.keyEnv) || (process.env as any)[provider.keyEnv] || '';
  if (existingKey && !existingKey.includes('...')) {
    note(`Already set: ${existingKey.slice(0, 12)}***`, 'API Key');
  } else {
    if (provider.isUrl) {
      const rawUrl = await text({
        message: provider.value === 'ollama'
          ? 'Ollama base URL'
          : `${provider.label} value`,
        placeholder: provider.hint.split('→')[0].trim(),
        defaultValue: provider.value === 'ollama' ? 'http://localhost:11434' : '',
      });
      if (isCancel(rawUrl)) { cancel('Setup cancelled.'); process.exit(0); }
      const val = (rawUrl as string).trim() || (provider.value === 'ollama' ? 'http://localhost:11434' : '');
      if (val) { writeEnvKey(envPath, provider.keyEnv, val); (process.env as any)[provider.keyEnv] = val; }
    } else {
      const rawKey = await password({
        message: `${provider.label} API key  (${provider.hint.split('→')[1]?.trim() ?? ''})\n  ` +
                 `${'\x1b[2m'}Press Enter without typing to skip and add later${'\x1b[0m'}`,
        mask: '▪',
      });
      if (isCancel(rawKey)) { cancel('Setup cancelled.'); process.exit(0); }
      const apiKey = (rawKey as string).trim();
      if (apiKey) {
        writeEnvKey(envPath, provider.keyEnv, apiKey);
        (process.env as any)[provider.keyEnv] = apiKey;
      } else {
        note(
          `No key entered — Must-b will still start.\n` +
          `  Add it any time:\n` +
          `    must-b onboard          re-run wizard\n` +
          `    .env → ${provider.keyEnv}=your-key`,
          'API Key Skipped'
        );
      }
    }
  }

  // ── Step 5: Skills / Tools (multi-select with Spacebar) ──────────────────
  note(
    'Use  ↑↓  to move,  Space  to toggle on/off,  Enter  to confirm.\n' +
    'All 10 tools are pre-selected. Deselect any you do not need.',
    'Tool Selection'
  );
  const selectedSkills = await multiselect({
    message: 'Enable tools  (Space = toggle, A = all/none, Enter = confirm)',
    options: SKILLS.map(s => ({ value: s.value, label: s.label, hint: s.hint })),
    initialValues: SKILLS.map(s => s.value) as unknown as string[],
    required: false,
  });
  if (isCancel(selectedSkills)) { cancel('Setup cancelled.'); process.exit(0); }

  for (const skill of SKILLS) {
    const enabled = (selectedSkills as string[]).includes(skill.value);
    writeEnvKey(envPath, skill.envKey, enabled ? 'true' : 'false');
  }

  // ── Step 6: Mode ─────────────────────────────────────────────────────────
  const mode = await select({
    message: 'Operating mode',
    options: [
      { value: 'local', label: 'Local',  hint: 'Single machine — no external ID' },
      { value: 'world', label: 'World',  hint: 'Cross-device — generates a unique MUSTB_UID' },
    ],
  });
  if (isCancel(mode)) { cancel('Setup cancelled.'); process.exit(0); }
  writeEnvKey(envPath, 'MUSTB_MODE', mode as string);

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

  // ── Health Check ──────────────────────────────────────────────────────────
  const sp = spinner();
  sp.start('Running system health check…');
  try {
    await runDoctor(root, true, true);
    sp.stop('Health check passed.');
  } catch {
    sp.stop('Health check completed (some warnings may exist — run: must-b doctor)');
  }

  outro(
    `  Must-b is ready, ${userName}!\n\n` +
    `  must-b web      →  http://localhost:4309\n` +
    `  must-b cli      →  terminal chat\n` +
    `  must-b doctor   →  health check`
  );
}
