#!/usr/bin/env node
/**
 * Must-b cross-platform binary wrapper.
 * Works on Windows, Linux and macOS without requiring a global tsx install.
 * Resolves tsx from the local node_modules and spawns the TypeScript entry point.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'src', 'index.ts');

// Resolve tsx from local node_modules (works after npm install)
const tsxBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

if (!fs.existsSync(tsxBin)) {
  console.error(
    '[must-b] tsx not found. Run "npm install" inside the must-b directory first.\n' +
    `Expected: ${tsxBin}`
  );
  process.exit(1);
}

const args = process.argv.slice(2);

const result = spawnSync(tsxBin, [entry, ...args], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, MUSTB_ROOT: root },
});

process.exit(result.status ?? 1);
