/**
 * Must-b v1.0 Visual Archive — capture_v1.mjs
 *
 * Takes 9 high-resolution screenshots of v1.0 features and writes
 * companion .txt metadata files to visual-audit/release_v1.0/
 *
 * Usage:
 *   node visual-audit/capture_v1.mjs
 *
 * Requires: Vite dev server running at http://localhost:3000
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'release_v1.0');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:3000';
const VP   = { width: 1440, height: 900 };

// ── Helpers ────────────────────────────────────────────────────────────────

function txt(name, content) {
  fs.writeFileSync(path.join(OUT_DIR, name.replace('.png', '.txt')), content.trim() + '\n', 'utf8');
}

async function shot(page, name, meta) {
  const out = path.join(OUT_DIR, name);
  await page.screenshot({ path: out, fullPage: false });
  txt(name, meta);
  console.log(`  ✓ ${name}`);
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
const page    = await ctx.newPage();

try {
  console.log('\n🎬 Must-b v1.0 Visual Gallery — Starting captures…\n');

  // ── 01: Welcome / Sleep (fox idle) ──────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  await shot(page, '01_Immersive_Welcome_Sleep.png',
    `Feature: Immersive Welcome Screen (Sleeping)
Version: Must-b v1.0
Description: Full-screen animated fox avatar in sleep state. Radial gradient
  background, pulsing breathing animation. Touch/click to wake interaction.
Component: WelcomePage → SleepingFox
Added: v4.3 XU UI Master Dashboard`);

  // ── 02: Welcome / Awake ─────────────────────────────────────────────────
  // Click somewhere to trigger wake animation
  await page.mouse.click(VP.width / 2, VP.height / 2);
  await wait(1200);
  await shot(page, '02_Immersive_Welcome_Awake.png',
    `Feature: Immersive Welcome Screen (Awake)
Version: Must-b v1.0
Description: Fox avatar transitions to awake state with orange glow bloom,
  eye-open animation and 'Start' CTA button appearing. Framer Motion spring.
Component: WelcomePage → AwakeFox
Added: v4.3 XU UI Master Dashboard`);

  // ── 03: War Room Dashboard (main layout) ────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(2000);
  await shot(page, '03_WarRoom_Dashboard.png',
    `Feature: 3-Column War Room Dashboard
Version: Must-b v1.0
Description: Main dashboard layout — Left sidebar with navigation, central
  content area with Chat tab active (empty state with logo), Right panel showing
  Agent Role badge, Hardware score bar, Model Roster and Shadow Mode toggle.
Components: AppLayout, Sidebar, DashboardPage, ChatArea, RightPanel
Added: v4.3 XU UI Master Dashboard`);

  // ── 04: War Room Live Sight ─────────────────────────────────────────────
  // Trigger a screenshot action via fetch
  try {
    await page.evaluate(async () => {
      await fetch('/api/system/screenshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detect: true }) });
    });
    await wait(3000);
  } catch { /* server may not be running — capture whatever state is there */ }
  await shot(page, '04_WarRoom_Live_Sight.png',
    `Feature: War Room Live Sight Panel
Version: Must-b v1.0
Description: WarRoomPanel expands above the chat area after a screen capture.
  Left half: captured screenshot thumbnail with Sobel-detected UI element overlays
  (button/input/image bounding boxes). Right half: workflow step cards + Control Feed.
Component: WarRoomPanel (v4.3)
Added: v4.2 Precision Control → v4.3 XU UI`);

  // ── 05: Shadow Mode Active ──────────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  // Try to click Shadow Mode toggle via UI
  try {
    await page.evaluate(async () => {
      await fetch('/api/shadow/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });
    });
    await wait(2500); // wait for first mirror frame
  } catch { /* API not available */ }
  await shot(page, '05_WarRoom_Shadow_Active.png',
    `Feature: Shadow Mode — Virtual Stealth Execution
Version: Must-b v1.0 (v4.8)
Description: When Shadow Mode is enabled from the RightPanel toggle, the War Room
  left column switches from OS screenshots to a live JPEG mirror of the headless
  Playwright browser (500ms refresh). Purple 'SHADOW / LIVE' badges overlay the
  mirror. Panel header shows the pulsing 'Ghost Active' pill badge.
  Mouse/keyboard input is silently routed to the Playwright Page, not the OS.
Components: shadow-bridge.ts, WarRoomPanel, RightPanel
Added: v4.8 Shadow Mode`);

  // Disable shadow mode
  try {
    await page.evaluate(async () => {
      await fetch('/api/shadow/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
    });
  } catch { /* ignore */ }

  // ── 06: Workspace Preview ───────────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  // Click Workspace tab
  await page.locator('button:has-text("Workspace")').click().catch(() => {});
  await wait(1500);
  await shot(page, '06_Workspace_Preview.png',
    `Feature: Live Workspace Preview
Version: Must-b v1.0 (v4.3)
Description: The Workspace tab in DashboardPage renders a file tree from
  GET /api/workspace/files. Selecting a file previews it inline:
  • HTML → sandboxed iframe with srcdoc
  • JSON → regex syntax-colored pre block
  • Other text → monospace pre
  File icons differ by extension (Globe2 for HTML, FileCode2 for JSON/JS/TS).
Component: WorkspacePreview
Added: v4.3 XU UI Master Dashboard`);

  // ── 07: Skills Library ──────────────────────────────────────────────────
  await page.locator('button:has-text("Skills")').click().catch(() => {});
  await wait(1500);
  await shot(page, '07_Skills_Library.png',
    `Feature: Skill Builder — Autonomous Task Library
Version: Must-b v1.0 (v4.5)
Description: The Skills tab displays all saved skills from GET /api/skills/list.
  Each card shows: name, goal preview, step tool badges (browser/terminal/etc.),
  run count, timestamps. Run button shows live socket state (Loader2 → CheckCircle2).
  Delete with two-step confirmation. SaveSkillBanner in ChatArea offers one-click
  recording after any completed workflow (planFinish event).
Component: SkillsPanel, skills-hub.ts
Added: v4.5 Skill Builder`);

  // ── 08: Memory Semantic Search ──────────────────────────────────────────
  await page.locator('button:has-text("Memory")').click().catch(() => {});
  await wait(1500);
  // Type a demo query
  await page.fill('input[placeholder*="Search"]', 'research browser automation').catch(() => {});
  await wait(500);
  await shot(page, '08_Memory_Semantic_Search.png',
    `Feature: Elephant Memory — Local Vector Semantic Search
Version: Must-b v1.0 (v4.7)
Description: The Memory tab connects to GET /api/memory/search?q= which runs
  vectra LocalIndex similarity search using @huggingface/transformers all-MiniLM-L6-v2
  (384-dim, on-device, no API key required). Results show:
  • Similarity score badge (% colour-coded: green ≥85%, orange ≥65%)
  • Source type badges (Skill / Conversation / Workspace / Custom)
  • Text snippet with score progress bar
  Collapsible control row: Index Skills | Index Workspace | Clear Index.
  Completed conversations auto-indexed on planFinish event.
Components: MemoryPanel, memory-index.ts
Added: v4.7 Elephant Memory`);

  // ── 09: Mobile QR Pairing Modal ────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(1500);
  // Click Connect Mobile
  await page.locator('button:has-text("Connect Mobile")').click().catch(() => {});
  await wait(2500); // wait for QR to load
  await shot(page, '09_Mobile_Pairing_QR.png',
    `Feature: Mobile Companion — QR Pairing System
Version: Must-b v1.0 (v4.6)
Description: Clicking 'Connect Mobile' in the RightPanel opens QRPairingModal.
  It calls GET /api/companion/pair which generates a 32-byte hex token (15-min TTL)
  using generateMobileToken() from remote-access.ts. The modal shows:
  • QR code encoding http://<LAN-IP>:<port>/mobile?token=<hex>
  • Countdown timer (expires in MM:SS)
  • Refresh button for a new code
  Scanning opens /mobile — a standalone React page with voice push-to-talk,
  live workflow monitor, and skills runner connected to /mobile socket.io namespace.
Components: QRPairingModal, remote-access.ts, MobilePage
Added: v4.6 Must-b Companion`);

  console.log(`\n✅ All 9 screenshots saved to visual-audit/release_v1.0/\n`);

} finally {
  await browser.close();
}
