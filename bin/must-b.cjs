#!/usr/bin/env node
/**
 * Must-b cross-platform entry wrapper.
 *
 * Strategy: use process.execPath (the running Node.js binary — always exists)
 * and register tsx as a --loader / --import hook.
 * This eliminates ANY reliance on tsx.exe / tsx.cmd / tsx shell scripts.
 *
 * Works on Windows, Linux, macOS after `npm install`.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

// ── 1. Resolve real project root (follows symlinks — handles npm link) ─────
function findRoot() {
  try {
    let dir = fs.realpathSync(__dirname);
    while (dir !== path.parse(dir).root) {
      if (
        fs.existsSync(path.join(dir, 'src', 'index.ts')) &&
        fs.existsSync(path.join(dir, 'package.json'))
      ) return dir;
      dir = path.dirname(dir);
    }
  } catch { /* fallthrough */ }
  return path.resolve(__dirname, '..');
}

const root = findRoot();
const entry = path.join(root, 'src', 'index.ts');
const args  = process.argv.slice(2);
const env   = { ...process.env, MUSTB_ROOT: root };

// ── 2. Check tsx is installed ──────────────────────────────────────────────
if (!fs.existsSync(path.join(root, 'node_modules', 'tsx'))) {
  console.error(
    '\n[must-b] Dependencies not installed.\n' +
    '  Run: npm install\n' +
    '  in:  ' + root + '\n'
  );
  process.exit(1);
}

// ── 3. Resolve tsx loader path (absolute — no global lookup needed) ────────
const rootRequire = createRequire(path.join(root, 'package.json'));
let loaderPath;
try {
  // tsx v4 exports 'tsx/esm' as the ESM/CJS hook
  loaderPath = rootRequire.resolve('tsx/esm');
} catch {
  // Fallback to tsx package main if export map differs
  loaderPath = rootRequire.resolve('tsx');
}

// ── 4. Pick the right hook flag for this Node version ─────────────────────
//   Node 20.6+: --import (stable, requires file:// URL on Windows)
//   Node 18/19: --loader (experimental but fully functional)
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
const hookFlag = nodeMajor >= 20 ? '--import' : '--loader';

// --import requires a file:// URL on Windows; --loader accepts bare paths
const hookArg = hookFlag === '--import'
  ? pathToFileURL(loaderPath).href
  : loaderPath;

// ── 5. Spawn Node itself with tsx hook — no tsx binary required ────────────
const result = spawnSync(
  process.execPath,
  [hookFlag, hookArg, '--no-warnings', entry, ...args],
  { stdio: 'inherit', cwd: root, env }
);

process.exit(result.status ?? 1);
