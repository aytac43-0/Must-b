#!/usr/bin/env node
/**
 * Must-b Production Build Script
 *
 * Steps:
 *  1. Build the React frontend (Vite — minified, tree-shaken)
 *  2. Compile + bundle the TypeScript backend with esbuild (minified)
 *  3. Copy the Vite output into dist/public/ so the Express server can serve it
 *
 * Output layout:
 *   dist/
 *     index.js          ← backend bundle (minified, ESM)
 *     public/           ← frontend static files (served by Express)
 *
 * Usage:
 *   node scripts/build-prod.mjs
 *   # or via npm:
 *   npm run build:prod
 */

import { execSync } from "child_process";
import { cpSync, rmSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── 1. Clean dist/ ────────────────────────────────────────────────────────
console.log("\n[1/4] Cleaning dist/…");
rmSync(join(ROOT, "dist"), { recursive: true, force: true });
mkdirSync(join(ROOT, "dist"), { recursive: true });

// ── 2. Build frontend ─────────────────────────────────────────────────────
console.log("\n[2/4] Building frontend (Vite)…");
const UI_DIR = join(ROOT, "public", "must-b-ui");
if (!existsSync(join(UI_DIR, "node_modules"))) {
  run("npm install --prefer-offline", UI_DIR);
}
run("npx vite build --mode production", UI_DIR);

// Copy Vite output → dist/public/
cpSync(join(UI_DIR, "dist"), join(ROOT, "dist", "public"), { recursive: true });
console.log("  ✓ Frontend built → dist/public/");

// ── 3. Bundle + minify backend (esbuild) ─────────────────────────────────
console.log("\n[3/4] Bundling backend (esbuild)…");

// Install esbuild if absent
let esbuildBin;
try {
  esbuildBin = join(ROOT, "node_modules", ".bin", "esbuild");
  if (!existsSync(esbuildBin)) throw new Error("not found");
} catch {
  run("npm install --save-dev esbuild --prefer-offline");
  esbuildBin = join(ROOT, "node_modules", ".bin", "esbuild");
}

run(
  [
    `"${esbuildBin}" src/index.ts`,
    "--bundle",
    "--platform=node",
    "--target=node20",
    "--format=esm",
    "--minify",
    "--sourcemap=external",
    "--external:sharp",        // native addon — keep external
    "--external:fsevents",     // macOS-only native
    "--outfile=dist/index.js",
    "--log-level=info",
  ].join(" ")
);
console.log("  ✓ Backend bundled → dist/index.js");

// ── 4. Patch Express static path ──────────────────────────────────────────
// The backend resolves static files relative to import.meta.url at runtime.
// In dist/ that already resolves to dist/public/ — no patch needed.
console.log("\n[4/4] Build complete.\n");
console.log("  Run:   node dist/index.js web");
console.log("  Or:    MUSTB_PORT=4309 node dist/index.js web\n");
