import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { printBanner } from '../utils/banner.js';
import { runDoctor } from './doctor.js';
import { LongTermMemory } from '../memory/long-term.js';

const cyan   = (s: string) => `\x1b[38;2;0;204;255m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

function generateUid(): string {
  return 'mustb_' + crypto.randomBytes(12).toString('hex');
}

function writeEnvKey(envPath: string, key: string, value: string) {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf-8');
  } catch {
    content = '';
  }
  const lines = content.split('\n');
  const idx = lines.findIndex(l => l.startsWith(key + '='));
  const newLine = `${key}=${value}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }
  fs.writeFileSync(envPath, lines.filter((_, i) => i < lines.length).join('\n'), 'utf-8');
}

export async function runOnboard(root: string) {
  printBanner('onboard', 4309);

  console.log(cyan('  ══════════════════════════════════════════════'));
  console.log(cyan('    Welcome to Must-b — First Time Setup'));
  console.log(cyan('  ══════════════════════════════════════════════'));
  console.log('');
  console.log(dim('  This wizard will configure Must-b for your system.'));
  console.log(dim('  Press Ctrl+C at any time to cancel.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const envPath = path.join(root, '.env');

  // Ensure .env exists
  if (!fs.existsSync(envPath)) {
    const example = path.join(root, '.env.example');
    if (fs.existsSync(example)) {
      fs.copyFileSync(example, envPath);
      console.log(green('  ✓ Created .env from .env.example\n'));
    } else {
      fs.writeFileSync(envPath, '', 'utf-8');
    }
  }

  // 1. Name
  const rawName = await ask(rl, cyan('  Your name') + dim(' (used in memory/greetings): '));
  const userName = rawName.trim() || 'User';

  // 2. API key
  const existingKey = process.env.OPENROUTER_API_KEY ?? '';
  let apiKey = existingKey;
  if (!existingKey || existingKey.startsWith('sk-or-v1-...')) {
    const rawKey = await ask(
      rl,
      cyan('  OpenRouter API key') + dim(' (get one at https://openrouter.ai): ')
    );
    apiKey = rawKey.trim();
    if (apiKey) {
      writeEnvKey(envPath, 'OPENROUTER_API_KEY', apiKey);
      console.log(green('  ✓ API key saved to .env'));
    } else {
      console.log(yellow('  ⚠ No API key entered — you can add it to .env later.'));
    }
  } else {
    console.log(green('  ✓ API key already configured.'));
  }

  // 3. Mode
  console.log('');
  console.log(bold('  Mode selection:'));
  console.log(dim('    local  — runs only on this machine, no external ID'));
  console.log(dim('    world  — gets a unique MUSTB_UID for cross-device identity'));
  const rawMode = await ask(rl, cyan('  Mode') + dim(' [local/world, default: local]: '));
  const mode = (rawMode.trim().toLowerCase() === 'world') ? 'world' : 'local';
  writeEnvKey(envPath, 'MUSTB_MODE', mode);

  let uid = process.env.MUSTB_UID ?? '';
  if (mode === 'world') {
    if (!uid) {
      uid = generateUid();
      writeEnvKey(envPath, 'MUSTB_UID', uid);
      console.log(green(`  ✓ World mode — generated MUSTB_UID: ${uid}`));
    } else {
      console.log(green(`  ✓ World mode — using existing MUSTB_UID: ${uid}`));
    }
  } else {
    console.log(green('  ✓ Local mode configured.'));
  }

  rl.close();

  // 4. Save to long-term memory
  const mem = new LongTermMemory(root);
  await mem.load();
  mem.setProfile({ name: userName, mode, uid: mode === 'world' ? uid : undefined });
  await mem.save();
  console.log(green('  ✓ Profile saved to memory/user.json'));

  // 5. Run doctor
  console.log('');
  console.log(cyan('  Running system health check...\n'));
  await runDoctor(root);

  console.log(cyan('  ══════════════════════════════════════════════'));
  console.log(green('  Must-b is ready! Start with:'));
  console.log('');
  console.log(dim('    npm start          ') + dim('→ web UI at http://localhost:4309'));
  console.log(dim('    must-b cli         ') + dim('→ terminal chat'));
  console.log(dim('    must-b doctor      ') + dim('→ health check'));
  console.log(cyan('  ══════════════════════════════════════════════\n'));
}
