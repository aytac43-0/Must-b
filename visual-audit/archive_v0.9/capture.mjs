/**
 * Must-b Visual Audit Script
 * Captures all 7 UI scenarios via Playwright.
 * Run: node visual-audit/capture.mjs
 */

import { chromium } from 'playwright';
import { spawn }    from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = resolve(__dir, '..');
const OUT    = __dir;  // visual-audit/
const PORT   = 3000;
const BASE   = `http://localhost:${PORT}`;

mkdirSync(OUT, { recursive: true });

// ── Helper: write a PNG + companion .txt note ──────────────────────────────
function note(filename, text) {
  writeFileSync(resolve(OUT, filename.replace('.png', '.txt')), text.trim(), 'utf-8');
}

async function screenshot(page, filename, fullPage = true) {
  await page.screenshot({
    path: resolve(OUT, filename),
    fullPage,
    animations: 'disabled',
  });
  console.log(`  ✓  ${filename}`);
}

// ── Start Vite dev server ──────────────────────────────────────────────────
function startVite() {
  return new Promise((resolve, reject) => {
    console.log('  …  Starting Vite dev server on port 3000…');
    const proc = spawn('npx', ['vite', '--port', String(PORT)], {
      cwd:   `${ROOT}/public/must-b-ui`,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let ready = false;
    proc.stdout.on('data', (chunk) => {
      const out = chunk.toString();
      if (!ready && (out.includes('Local') || out.includes('localhost'))) {
        ready = true;
        setTimeout(() => resolve(proc), 1500); // extra settle time
      }
    });
    proc.stderr.on('data', () => {});
    proc.on('error', reject);
    setTimeout(() => {
      if (!ready) { ready = true; resolve(proc); }
    }, 12_000);
  });
}

// ── Common route mocks ─────────────────────────────────────────────────────
async function mockApiRoutes(context) {
  await context.route('**/api/setup/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ configured: true }) })
  );
  await context.route('**/api/auth/local', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, token: 'mock-token' }) })
  );
  await context.route('**/api/auth/cloud-connect', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true }) })
  );
  await context.route('**/api/setup/performance**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ label: 'Yüksek Hız', modelRamGb: 4, systemRamGb: 32, ratioPercent: 12 }) })
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  let viteProc;
  let browser;

  try {
    viteProc = await startVite();
    console.log('  ✓  Vite ready.\n');

    browser = await chromium.launch({ headless: true });

    // ─────────────────────────────────────────────────────────────────────
    // 01 — Welcome (Sleep)
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await mockApiRoutes(ctx);
      const page = await ctx.newPage();

      await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200); // let animations settle

      await screenshot(page, '01_Welcome_Sleep.png');
      note('01_Welcome_Sleep.png',
        `Welcome Screen — Uyku Hali
Backend bağlantısı: YOK (salt okunur render)
İlgili dosyalar:
  - public/must-b-ui/src/pages/WelcomePage.tsx
  - public/must-b-ui/public/avatar/sleep.png
API bağlantısı: Yok (mount'ta API çağrısı yapılmıyor)
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 02 — Welcome (Awake) — Uyandır butonuna basılıyor
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await mockApiRoutes(ctx);
      const page = await ctx.newPage();

      await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      // Click "Uyandır" and capture the awake animation state before navigation
      await page.click('button:has-text("Uyandır")', { timeout: 5000 }).catch(() =>
        page.click('button:has-text("Must-b")').catch(() => {})
      );

      // Wait for awake animation (600ms) but before navigate (1800ms)
      await page.waitForTimeout(900);
      await screenshot(page, '02_Welcome_Awake.png');
      note('02_Welcome_Awake.png',
        `Welcome Screen — Uyanış Anı
Tetikleyici: "Must-b'yi Uyandır" butonuna basıldı
İlgili dosyalar:
  - public/must-b-ui/src/pages/WelcomePage.tsx  (handleWake)
  - public/must-b-ui/public/avatar/awake.png
API bağlantısı: GET /api/setup/status → GET /api/auth/local
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 03 — Setup: Kim Olduğunuzu Girin (Step 0 — İsim)
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await mockApiRoutes(ctx);
      const page = await ctx.newPage();

      await page.goto(`${BASE}/setup`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      await screenshot(page, '03_Setup_Identity.png');
      note('03_Setup_Identity.png',
        `Setup Wizard — Kimlik Adımı (Step 1/5)
Kullanıcıdan isim alınıyor.
İlgili dosyalar:
  - public/must-b-ui/src/pages/SetupPage.tsx  (step 0)
  - src/core/identity.ts  (Ed25519 kimlik üretimi)
  - src/memory/long-term.ts  (profil kaydı)
API bağlantısı: POST /api/setup (Finish'e kadar yok)
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 04 — Setup: LLM Sağlayıcı Seçimi (Step 1 — Model)
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await mockApiRoutes(ctx);
      const page = await ctx.newPage();

      await page.goto(`${BASE}/setup`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      // Fill in name to unlock "Continue"
      await page.fill('input[type="text"]', 'Mustafa');
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(400); // wait for step animation

      await screenshot(page, '04_Setup_Model_Selection.png');
      note('04_Setup_Model_Selection.png',
        `Setup Wizard — LLM Sağlayıcı Seçimi (Step 2/5)
OpenRouter / OpenAI / Anthropic / Ollama seçenekleri gösterilir.
İlgili dosyalar:
  - public/must-b-ui/src/pages/SetupPage.tsx  (step 1 — PROVIDERS)
  - src/utils/hardware.ts  (getPerformancePrediction, recommendModels)
  - src/core/models-catalog.ts  (MODELS_LIST)
API bağlantısı: GET /api/setup/performance?modelId=... (Step 1 render)
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 05 — Setup: Cloud Connect Butonu (CloudSyncButton açık)
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await mockApiRoutes(ctx);
      const page = await ctx.newPage();

      await page.goto(`${BASE}/setup`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Click the Cloud button (fixed bottom-right) to expand it
      await page.click('button:has-text("Giriş Yap")').catch(() =>
        page.click('button:has-text("Yükle")').catch(() => {})
      );
      await page.waitForTimeout(500);

      await screenshot(page, '05_Setup_Cloud_Connect.png');
      note('05_Setup_Cloud_Connect.png',
        `Setup — CloudSyncButton Panel (Açık)
Sağ alttaki "Giriş Yap / Yükle" butonu açıldıktan sonraki panel.
İki akış:
  1. Must-b Worlds OAuth → /api/auth/cloud-connect
  2. Hafıza dosyası sürükle/bırak (.md/.json) → POST /api/memory/import
İlgili dosyalar:
  - public/must-b-ui/src/components/CloudSyncButton.tsx
  - src/interface/api.ts  (POST /api/memory/import)
  - src/core/cloud-sync.ts  (CloudSync — OAuth ardından çalışır)
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 06 — Sync Conflict Modal: Max vs Alex
    //
    // Strategy:
    //   1. addInitScript: override window.WebSocket so socket.io connections
    //      fail immediately → socket.io-client falls back to HTTP polling.
    //   2. ctx.route('**/socket.io/**'): intercept polling at browser level,
    //      skip any residual transport=websocket routes, serve:
    //        pollSeq 1 → EIO4 handshake
    //        pollSeq 2 → Socket.IO namespace connect (40)
    //        pollSeq 3 → agentUpdate CONFLICT_DETECTED event
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });

      // Force socket.io WebSocket to fail immediately so polling kicks in.
      // We only patch /socket.io/ URLs; Vite HMR (path '/') is unaffected.
      await ctx.addInitScript(() => {
        const _WS = window.WebSocket;
        window.WebSocket = function FakeWS(url, protocols) {
          if (typeof url === 'string' && url.includes('/socket.io/')) {
            // Fake WebSocket: fires error + close after 20ms, forcing polling fallback
            this.readyState   = 0; // CONNECTING
            this.url          = url;
            this.protocol     = '';
            this.binaryType   = 'blob';
            this.bufferedAmount = 0;
            this.extensions   = '';
            this.onopen = this.onclose = this.onerror = this.onmessage = null;
            this.send  = () => {};
            this.close = () => { this.readyState = 3; };
            const self = this;
            setTimeout(() => {
              self.readyState = 3; // CLOSED
              if (typeof self.onerror === 'function') {
                try { self.onerror(new Event('error')); } catch (_) {}
              }
              if (typeof self.onclose === 'function') {
                try { self.onclose(new CloseEvent('close', { code: 1006, wasClean: false })); } catch (_) {}
              }
            }, 20);
            return; // returns `this` (FakeWS instance)
          }
          return new _WS(url, protocols);
        };
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN       = 1;
        window.WebSocket.CLOSING    = 2;
        window.WebSocket.CLOSED     = 3;
        window.WebSocket.prototype  = _WS.prototype;
      });

      // API mocks
      await ctx.route('**/api/**', (route) => {
        const url = route.request().url();
        if (url.includes('/api/auth/local'))
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'mock-token' }) });
        if (url.includes('/api/chats'))
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
            { id: 'c1', title: 'Mission Alpha', created_at: '2026-03-17T09:00:00Z' },
            { id: 'c2', title: 'Data Sweep',    created_at: '2026-03-16T14:00:00Z' },
          ]) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      });

      // Socket.IO polling mock.
      // WebSocket upgrade requests contain 'transport=websocket' — skip them
      // so they fail naturally; socket.io-client then starts real HTTP polling.
      let pollSeq = 0;
      await ctx.route('**/socket.io/**', async (route) => {
        const url = route.request().url();

        // Let WS upgrade requests (if intercepted) fail naturally
        if (url.includes('transport=websocket')) {
          return route.abort('connectionrefused');
        }
        // Client POST (send buffer / ping) → ack
        if (route.request().method() === 'POST') {
          return route.fulfill({ status: 200, body: 'ok' });
        }

        pollSeq++;
        if (pollSeq === 1) {
          // EIO4 handshake — upgrades:[] disables WS upgrade attempt
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
            body: '0{"sid":"cfmock","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
          });
        }
        if (pollSeq === 2) {
          // Socket.IO namespace connect ACK
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
            body: '40',
          });
        }
        if (pollSeq === 3) {
          // Deliver CONFLICT_DETECTED — small delay lets React settle first
          await new Promise(r => setTimeout(r, 700));
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
            body: '42["agentUpdate",{"type":"CONFLICT_DETECTED","localAgentName":"Alex","cloudAgentName":"Max","localMtime":"2026-03-15T10:00:00.000Z","cloudTimestamp":"2026-03-16T14:30:00.000Z"}]',
          });
        }
        // Long-poll keep-alive (wait until screenshot is done)
        await new Promise(r => setTimeout(r, 30_000));
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' }, body: '2' });
      });

      const page = await ctx.newPage();
      await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
      // Wait for: page render (1s) + WS fail (20ms) + polling sequence (3 round trips) + modal animation
      await page.waitForTimeout(6000);

      await screenshot(page, '06_Sync_Conflict_Max_vs_Alex.png');
      note('06_Sync_Conflict_Max_vs_Alex.png',
        `Hafıza Çakışması Modalı — Max vs Alex
Socket.IO "CONFLICT_DETECTED" eventi alındığında gösterilir.
Üç karar seçeneği:
  1. Yeni Ajan Oluştur (duplicate)
  2. Bulutu Kullan — Üstüne Yaz (restore)
  3. Lokalimi Koru (upload)
İlgili dosyalar:
  - public/must-b-ui/src/components/ConflictModal.tsx
  - src/core/cloud-sync.ts  (CloudSync.checkConflict — çakışma tespiti)
  - src/interface/api.ts  (POST /api/setup/sync-resolve)
`);
      await ctx.close();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 07 — Main Dashboard
    // ─────────────────────────────────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });

      // Single dispatch-based API mock — avoids LIFO ordering issues
      await ctx.route('**/api/**', (route) => {
        const url = route.request().url();
        if (url.includes('/api/auth/local'))
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'mock-token' }) });
        if (url.includes('/api/chats'))
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', title: 'Mission Alpha', created_at: '2026-03-17T09:00:00Z' }, { id: 'c2', title: 'Research Sprint', created_at: '2026-03-16T14:00:00Z' }, { id: 'c3', title: 'Code Review', created_at: '2026-03-15T11:00:00Z' }]) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      });
      // NO routeWebSocket — Vite HMR works normally, socket.io fails silently (ECONNREFUSED)

      const page = await ctx.newPage();
      await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      await screenshot(page, '07_Main_Dashboard.png');
      note('07_Main_Dashboard.png',
        `Ana Komuta Merkezi — Dashboard (/app)
Kurulum tamamlandıktan sonra gösterilen ana ekran.
İlgili dosyalar:
  - public/must-b-ui/src/pages/DashboardPage.tsx
  - public/must-b-ui/src/components/chat/ChatArea.tsx
  - public/must-b-ui/src/components/layout/AppLayout.tsx  (Sidebar + Outlet)
  - public/must-b-ui/src/components/layout/Sidebar.tsx    (GET /api/chats)
  - src/interface/api.ts  (GET /api/status, GET /api/chats)
  - src/core/hierarchy.ts  (getAgentRole — rol rozeti)
  - src/core/orchestrator.ts  (mesaj işleme motoru)
`);
      await ctx.close();
    }

    console.log(`\n  ════════════════════════════════════════`);
    console.log(`  ✅  Visual audit tamamlandı.`);
    console.log(`  📁  Konum: ${OUT}`);
    console.log(`  📸  7 PNG + 7 TXT not hazır.`);
    console.log(`  ════════════════════════════════════════\n`);

  } catch (err) {
    console.error('\n  ✗  Hata:', err.message);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    viteProc?.kill();
  }
})();
