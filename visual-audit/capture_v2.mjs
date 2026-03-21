/**
 * Must-b v2.0 Visual Gallery — capture_v2.mjs
 *
 * Captures 8 high-resolution screenshots of v2.0 Evolution features
 * and writes companion .txt metadata to visual-audit/v2.0_evolution/
 *
 * Usage:
 *   node visual-audit/capture_v2.mjs
 *
 * Requires: Vite dev server running at http://localhost:3000
 */

import { chromium } from 'playwright';
import fs           from 'fs';
import path         from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'v2.0_evolution');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:3000';
const VP   = { width: 1440, height: 900 };

function txt(name, content) {
  fs.writeFileSync(path.join(OUT_DIR, name.replace('.png', '.txt')), content.trim() + '\n', 'utf8');
}

async function shot(page, name, meta) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
  txt(name, meta);
  console.log(`  ✓ ${name}`);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// ── Main ───────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
const page    = await ctx.newPage();

try {
  console.log('\n🚀 Must-b v2.0 Visual Gallery — Capturing evolution features…\n');

  // ── 01: Plugin Architect — Empty state ──────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  await page.locator('button:has-text("Plugins")').click().catch(() => {});
  await wait(1000);
  await shot(page, '01_PluginArchitect_Empty.png',
    `Feature: Plugin Architect — Empty State
Version: Must-b v2.0 (v4.9)
Description: The Plugins tab in DashboardPage shows the empty state before any plugins
  have been installed. Orange 'New Plugin' button in header; puzzle icon placeholder
  with instructions. Connects to GET /api/plugins/list.
Component: PluginsPanel
Added: v4.9 Synthetic Consciousness`);

  // ── 02: Plugin Architect — Build Form ───────────────────────────────────
  await page.locator('button:has-text("New Plugin")').click().catch(() => {});
  await wait(500);
  await page.fill('input[placeholder*="Plugin name"]', 'weather-monitor').catch(() => {});
  await page.fill('input[placeholder*="Goal"]', 'Poll OpenWeather API every 5 minutes and alert on extreme conditions').catch(() => {});
  await wait(300);
  await shot(page, '02_PluginArchitect_Build.png',
    `Feature: Plugin Architect — Build Form
Version: Must-b v2.0 (v4.9)
Description: Collapsed build form with plugin name, goal, optional context, and
  language selector (Node.js / Python). 'Generate Plugin' CTA calls
  POST /api/plugins/build which writes src/plugins/<name>.mjs or .py and returns
  PluginInfo { name, lang, filename, filePath, running, createdAt }.
Component: PluginsPanel → build form
Added: v4.9 Synthetic Consciousness`);

  // ── 03: Parallel Ghost Slots (Right Panel) ──────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  // Try activating Ghost slot 1 via API
  try {
    await page.evaluate(async () => {
      await fetch('/api/ghost/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: 0, enabled: true }),
      });
    });
    await wait(3500); // wait for first ghost frame
  } catch { /* server may not have playwright installed */ }
  await shot(page, '03_ParallelGhost_Slot1.png',
    `Feature: Parallel Ghosting v2 — Ghost Slot 1 Active
Version: Must-b v2.0 (v4.9)
Description: When Ghost Slot 1 (G1) is enabled from the Right Panel ghost controls,
  a headless Chromium instance launches for that slot. The WarRoomPanel left column
  shows a slot-tab selector (G1 | G2 | G3) and renders the active slot's live
  JPEG mirror. The Right Panel shows purple G1/G2/G3 pill buttons; active slots
  animate-pulse. POST /api/ghost/toggle { slot: 0, enabled: true }.
Components: RightPanel (ghost slot buttons), WarRoomPanel (slot tab + mirror), browser.ts
Added: v4.9 Synthetic Consciousness`);

  // Disable ghost slot
  try {
    await page.evaluate(async () => {
      await fetch('/api/ghost/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: 0, enabled: false }) });
    });
  } catch { /* ignore */ }

  // ── 04: Emotional Tone — Stress Detected ────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  // Inject a tone change via API
  try {
    await page.evaluate(async () => {
      await fetch('/api/tone/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "This is broken and not working! I'm so frustrated, help me fix this error ASAP!" }),
      });
    });
    await wait(1500);
  } catch { /* ignore */ }
  await shot(page, '04_ToneObserver_Stress.png',
    `Feature: Emotional Tone Observer — Stress Detected
Version: Must-b v2.0 (v4.9)
Description: When the user sends a message with stress signals (frustration,
  error, broken, not working, urgency markers), the Tone Observer detects 'stress'
  tone and broadcasts a 'toneChange' socket event. The Right Panel shows a red
  pulsing 'Stress Detected' badge with a score % and auto-dismisses after 8s.
  No LLM call required — runs on local keyword scoring, <1ms.
Components: tone-observer.ts, RightPanel, socket.ts (global event bridge)
Added: v4.9 Synthetic Consciousness`);

  // ── 05: Emotional Tone — Focused Mode ───────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  await shot(page, '05_ToneObserver_Normal.png',
    `Feature: Emotional Tone Observer — Normal State
Version: Must-b v2.0 (v4.9)
Description: In the normal/focused state the Right Panel shows no tone badge.
  The tone observer analyzes every user message sent via POST /api/goal and
  only emits 'toneChange' when tone is non-normal (stress / urgent / focused).
  Tone history aggregation uses a 5-message sliding window.
Components: tone-observer.ts observeHistory(), RightPanel
Added: v4.9 Synthetic Consciousness`);

  // ── 06: Video Stream — 15 FPS Vision Start ──────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  try {
    await page.evaluate(async () => {
      await fetch('/api/vision/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fps: 15 }),
      });
    });
    await wait(2500);
  } catch { /* ignore */ }
  await shot(page, '06_VideoVision_Stream.png',
    `Feature: Real-Time Video Vision — 15 FPS Screen Stream
Version: Must-b v2.0 (v4.9)
Description: POST /api/vision/stream/start { fps: 15 } launches a setInterval
  loop at 66ms intervals (15 FPS) that calls captureScreen() and emits each
  frame over Socket.IO as 'videoFrame' events. Change detection uses sampled
  base64 FNV-1a hashing; significant diffs (>5%) also emit 'videoChange' events.
  The WarRoomPanel receives these as live captures, giving the AI a continuous
  visual feed of the OS screen for dynamic UI tracking.
Components: vision.ts startVideoStream(), api.ts /api/vision/stream/*, WarRoomPanel
Added: v4.9 Synthetic Consciousness`);

  // Stop video stream
  try {
    await page.evaluate(async () => {
      await fetch('/api/vision/stream/stop', { method: 'POST' });
    });
  } catch { /* ignore */ }

  // ── 07: Dashboard — All 5 Tabs ──────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  await shot(page, '07_Dashboard_FiveTabs.png',
    `Feature: Dashboard — 5-Tab War Room (v2.0)
Version: Must-b v2.0 (v4.9)
Description: The DashboardPage tab bar now includes 5 tabs:
  💬 Chat | 📁 Workspace | ⚡ Skills | 🧠 Memory | 🧩 Plugins
  Each tab is a dedicated panel: ChatArea, WorkspacePreview, SkillsPanel,
  MemoryPanel, PluginsPanel. Auto-switches to Chat on planStart/skillRunStart.
Components: DashboardPage, PluginsPanel (new in v4.9)
Added: v4.9 Synthetic Consciousness`);

  // ── 08: Right Panel — Ghost + Tone ──────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  await shot(page, '08_RightPanel_v49.png',
    `Feature: Right Panel — v2.0 Controls
Version: Must-b v2.0 (v4.9)
Description: The Right Panel now includes:
  • Ghost Slots section: G1 / G2 / G3 buttons — each toggles an independent
    headless Chromium context via POST /api/ghost/toggle { slot, enabled }.
    Active slots show purple animate-pulse Ghost icons.
  • Tone Observer badge (conditional): appears when tone is non-normal,
    shows red/orange/blue badge with label + score %. Auto-dismisses in 8s.
  • Previous sections: Agent Role, Hardware Score, Active Model, Model Roster,
    Shadow Mode toggle, Connect Mobile button.
Components: RightPanel, tone-observer.ts, browser.ts toggleGhostSlot()
Added: v4.9 Synthetic Consciousness`);

  console.log(`\n✅ All 8 v2.0 evolution screenshots saved to visual-audit/v2.0_evolution/\n`);

} finally {
  await browser.close();
}
