#!/usr/bin/env node
/**
 * Must-b cross-platform entry wrapper.
 *
 * Production (global install): runs dist/index.cjs directly with Node.
 * Development (local clone):   falls back to tsx + src/index.ts.
 *
 * Works on Windows, Linux, macOS after `npm install -g @must-b/must-b`.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

// ── 1. Resolve real package root (follows symlinks — handles npm link / global) ─
function findRoot() {
  try {
    let dir = fs.realpathSync(__dirname);
    while (dir !== path.parse(dir).root) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        // Accept if we have a built dist OR a dev src tree
        if (
          fs.existsSync(path.join(dir, 'dist', 'index.cjs')) ||
          fs.existsSync(path.join(dir, 'src', 'index.ts'))
        ) return dir;
      }
      dir = path.dirname(dir);
    }
  } catch { /* fallthrough */ }
  return path.resolve(__dirname, '..');
}

const root  = findRoot();
const args  = process.argv.slice(2);
const env   = { ...process.env, MUSTB_ROOT: root };

const distEntry = path.join(root, 'dist', 'index.cjs');
const srcEntry  = path.join(root, 'src', 'index.ts');

// ── 2. Production path: dist/index.cjs exists → run directly with Node ───────
if (fs.existsSync(distEntry)) {
  const result = spawnSync(
    process.execPath,
    ['--no-warnings', distEntry, ...args],
    { stdio: 'inherit', cwd: root, env }
  );
  process.exit(result.status ?? 1);
}

// ── 3. Dev path: no dist → require tsx to transpile src/index.ts ─────────────
if (!fs.existsSync(srcEntry)) {
  console.error(
    '\n[must-b] Installation appears incomplete.\n' +
    '  Expected: ' + distEntry + '\n' +
    '  Reinstall: npm install -g @must-b/must-b\n'
  );
  process.exit(1);
}

const tsxDir = path.join(root, 'node_modules', 'tsx');
if (!fs.existsSync(tsxDir)) {
  console.error(
    '\n[must-b] Dev dependencies not installed.\n' +
    '  Run: npm install\n' +
    '  in:  ' + root + '\n'
  );
  process.exit(1);
}

const rootRequire = createRequire(path.join(root, 'package.json'));
let loaderPath;
try {
  loaderPath = rootRequire.resolve('tsx/esm');
} catch {
  loaderPath = rootRequire.resolve('tsx');
}

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
const hookFlag  = nodeMajor >= 20 ? '--import' : '--loader';
const hookArg   = hookFlag === '--import'
  ? pathToFileURL(loaderPath).href
  : loaderPath;

const result = spawnSync(
  process.execPath,
  [hookFlag, hookArg, '--no-warnings', srcEntry, ...args],
  { stdio: 'inherit', cwd: root, env }
);
process.exit(result.status ?? 1);
