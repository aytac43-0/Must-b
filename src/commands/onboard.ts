import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { printBanner } from '../utils/banner.js';
import { runDoctor } from './doctor.js';
import { LongTermMemory } from '../memory/long-term.js';

const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const orange = (s: string) => `\x1b[38;2;255;140;0m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise(r => rl.question(q, r));
}
function generateUid(): string { return 'mustb_' + crypto.randomBytes(12).toString('hex'); }
function writeEnvKey(envPath: string, key: string, value: string) {
  let c = ''; try { c = fs.readFileSync(envPath, 'utf-8'); } catch { c = ''; }
  const lines = c.split('\n');
  const idx = lines.findIndex((l: string) => l.startsWith(key + '='));
  if (idx >= 0) lines[idx] = key + '=' + value; else lines.push(key + '=' + value);
  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

const PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter',    keyEnv: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai' },
  { id: 'openai',     label: 'OpenAI',          keyEnv: 'OPENAI_API_KEY',     url: 'https://platform.openai.com' },
  { id: 'anthropic',  label: 'Anthropic',       keyEnv: 'ANTHROPIC_API_KEY',  url: 'https://console.anthropic.com' },
  { id: 'ollama',     label: 'Ollama (local)',   keyEnv: 'OLLAMA_BASE_URL',    url: 'https://ollama.com' },
] as const;

const SKILLS = [
  { id: 'browser',    label: 'Browser Automation', envKey: 'SKILL_BROWSER',    desc: 'Playwright Chromium' },
  { id: 'terminal',   label: 'Terminal Execution',  envKey: 'SKILL_TERMINAL',   desc: 'Shell commands, git, npm' },
  { id: 'memory',     label: 'Long-Term Memory',    envKey: 'SKILL_MEMORY',     desc: 'SQLite FTS5 + temporal decay' },
  { id: 'web_search', label: 'Web Search',           envKey: 'SKILL_WEB_SEARCH', desc: 'Search via Playwright browser' },
  { id: 'filesystem', label: 'Filesystem Access',    envKey: 'SKILL_FILESYSTEM', desc: 'Read/write workspace files' },
] as const;

export async function runOnboard(root: string) {
  printBanner('onboard', 4309);
  console.log('');
  console.log(orange('  \u2554' + '\u2550'.repeat(46) + '\u2557'));
  console.log(orange('  \u2551   Must-b \u2014 First Time Setup Wizard          \u2551'));
  console.log(orange('  \u255a' + '\u2550'.repeat(46) + '\u255d'));
  console.log('');
  console.log(dim('  Press Ctrl+C at any time to cancel.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    const ex = path.join(root, '.env.example');
    if (fs.existsSync(ex)) { fs.copyFileSync(ex, envPath); console.log(green('  \u2713 Created .env\n')); }
    else fs.writeFileSync(envPath, '', 'utf-8');
  }

  // Step 1: Name
  console.log(bold('  \u2500\u2500\u2500 Step 1: Who are you? \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  const rawName = await ask(rl, orange('  Your name') + dim(' (used in memory/greetings): '));
  const userName = rawName.trim() || 'User';
  console.log(green(`  \u2713 Hello, ${userName}!\n`));

  // Step 2: Provider
  console.log(bold('  \u2500\u2500\u2500 Step 2: LLM Provider \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  PROVIDERS.forEach((p, i) => console.log(`  ${cyan(`[${i + 1}]`)} ${bold(p.label.padEnd(22))} ${dim(p.url)}`));
  console.log('');
  const rawProv = await ask(rl, orange('  Provider') + dim(' [1-4, default: 1 OpenRouter]: '));
  const provIdx = Math.max(0, Math.min(3, (parseInt(rawProv.trim()) || 1) - 1));
  const provider = PROVIDERS[provIdx];
  writeEnvKey(envPath, 'LLM_PROVIDER', provider.id);
  console.log(green(`  \u2713 Provider: ${provider.label}\n`));

  // Step 3: API Key
  console.log(bold('  \u2500\u2500\u2500 Step 3: API Key \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  const existingKey: string = (process.env as any)[provider.keyEnv] ?? '';
  if (!existingKey || existingKey.includes('...')) {
    if (provider.id === 'ollama') {
      const rawUrl = await ask(rl, orange('  Ollama URL') + dim(' [default: http://localhost:11434]: '));
      const url = rawUrl.trim() || 'http://localhost:11434';
      writeEnvKey(envPath, provider.keyEnv, url);
      console.log(green(`  \u2713 Ollama URL: ${url}\n`));
    } else {
      const rawKey = await ask(rl, orange(`  ${provider.label} key`) + dim(` (${provider.url}): `));
      const apiKey = rawKey.trim();
      if (apiKey) {
        writeEnvKey(envPath, provider.keyEnv, apiKey);
        if (provider.id === 'openrouter') writeEnvKey(envPath, 'OPENROUTER_API_KEY', apiKey);
        console.log(green(`  \u2713 Key saved: ${apiKey.slice(0, 10)}***\n`));
      } else console.log(yellow('  \u26a0 No key \u2014 add to .env later.\n'));
    }
  } else console.log(green(`  \u2713 Key already set: ${existingKey.slice(0, 10)}***\n`));

  // Step 4: Skills
  console.log(bold('  \u2500\u2500\u2500 Step 4: Activate Skills \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  console.log(dim('  Space-separated numbers. 0 = all skills.'));
  SKILLS.forEach((s, i) => console.log(`  ${cyan(`[${i + 1}]`)} ${bold(s.label.padEnd(24))} ${dim(s.desc)}`));
  console.log(`  ${cyan('[0]')} ${bold('All skills (recommended)')}`);
  console.log('');
  const rawSkills = await ask(rl, orange('  Skills') + dim(' [default: 0 all]: '));
  const skillInput = rawSkills.trim();
  let selectedSkills: typeof SKILLS[number][];
  if (!skillInput || skillInput === '0') {
    selectedSkills = [...SKILLS];
  } else {
    const nums = skillInput.split(/[\s,]+/).map((n: string) => parseInt(n) - 1).filter((n: number) => n >= 0 && n < SKILLS.length);
    selectedSkills = nums.length > 0 ? nums.map((n: number) => SKILLS[n]) : [...SKILLS];
  }
  for (const skill of SKILLS) writeEnvKey(envPath, skill.envKey, selectedSkills.includes(skill) ? 'true' : 'false');
  console.log(green(`  \u2713 Active: ${selectedSkills.map(s => s.label).join(', ')}\n`));

  // Step 5: Mode
  console.log(bold('  \u2500\u2500\u2500 Step 5: Must-b Mode \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  console.log(dim('    local  \u2014 single machine, no external ID'));
  console.log(dim('    world  \u2014 cross-device unique MUSTB_UID'));
  const rawMode = await ask(rl, orange('  Mode') + dim(' [local/world, default: local]: '));
  const mode = rawMode.trim().toLowerCase() === 'world' ? 'world' : 'local';
  writeEnvKey(envPath, 'MUSTB_MODE', mode);
  let uid = process.env.MUSTB_UID ?? '';
  if (mode === 'world') {
    if (!uid) { uid = generateUid(); writeEnvKey(envPath, 'MUSTB_UID', uid); }
    console.log(green(`  \u2713 World mode \u2014 UID: ${uid}\n`));
  } else console.log(green('  \u2713 Local mode configured.\n'));

  rl.close();

  const mem = new LongTermMemory(root);
  await mem.load();
  mem.setProfile({ name: userName, mode, uid: mode === 'world' ? uid : undefined });
  await mem.save();
  console.log(green('  \u2713 Profile saved to memory/user.json'));
  console.log('');
  console.log(cyan('  Running system health check...\n'));
  await runDoctor(root);

  console.log(orange('  \u2554' + '\u2550'.repeat(46) + '\u2557'));
  console.log(orange('  \u2551       Must-b is ready! Start with:           \u2551'));
  console.log(orange('  \u255a' + '\u2550'.repeat(46) + '\u255d'));
  console.log('');
  console.log(dim('    must-b start    \u2192  http://localhost:4309'));
  console.log(dim('    must-b cli      \u2192  terminal chat'));
  console.log(dim('    must-b doctor   \u2192  health check'));
  console.log('');
}
