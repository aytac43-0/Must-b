import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import winston from 'winston';
import {
  shadowBridge, getShadowState, setShadowState,
  getGhostContext, setGhostContext, MAX_GHOST_SLOTS,
} from './shadow-bridge.js';

export interface NavigateResult {
  url: string;
  title: string;
  status?: number;
}

export interface ScreenshotResult {
  base64: string;
  width: number;
  height: number;
}

export interface ExtractResult {
  text: string;
  html?: string;
}

export interface SnapshotResult {
  snapshot: string;
}

export interface EvaluateResult {
  result: unknown;
}

// ── Shadow Mode (v4.8) ────────────────────────────────────────────────────────

let _mirrorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Enable or disable Shadow Mode — a headless Playwright browser that:
 *   • runs invisibly in the background
 *   • streams JPEG screenshots to the dashboard every 500 ms via shadowBridge
 *   • intercepts osMouseMove/osMouseClick/osTypeText and routes them to its Page
 */
export async function toggleShadowMode(enabled: boolean): Promise<void> {
  const state = getShadowState();
  if (enabled === state.enabled) return;

  if (enabled) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('about:blank').catch(() => {});

    setShadowState({ enabled: true, page, browser, url: 'about:blank' });

    // Navigate event — keep URL in sync
    page.on('framenavigated', (frame: any) => {
      if (frame === page.mainFrame()) setShadowState({ url: frame.url() });
    });

    // Start 500ms mirror loop
    _mirrorInterval = setInterval(async () => {
      const s = getShadowState();
      if (!s.enabled || !s.page) return;
      try {
        const buf = await (s.page as Page).screenshot({ type: 'jpeg', quality: 55 });
        shadowBridge.emit('shadowFrame', { base64: buf.toString('base64'), ts: Date.now() });
      } catch { /* page closed — will auto-disable */ }
    }, 500);

    shadowBridge.emit('shadowToggle', { enabled: true });
  } else {
    // Stop mirror loop
    if (_mirrorInterval) { clearInterval(_mirrorInterval); _mirrorInterval = null; }

    const { browser } = getShadowState();
    try { await (browser as Browser | null)?.close(); } catch { /* best-effort */ }

    setShadowState({ enabled: false, page: null, browser: null, url: 'about:blank' });
    shadowBridge.emit('shadowToggle', { enabled: false });
  }
}

/**
 * Navigate the shadow browser to a URL (no-op when shadow mode is off).
 */
export async function shadowNavigate(url: string): Promise<void> {
  const { enabled, page } = getShadowState();
  if (!enabled || !page) return;
  await (page as Page).goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}

// ── Parallel Ghosting v2 (v4.9) ───────────────────────────────────────────

/**
 * Enable or disable a specific ghost slot (0–2).
 * Each slot runs its own headless Chromium + 500ms JPEG mirror loop.
 */
export async function toggleGhostSlot(slot: number, enabled: boolean): Promise<void> {
  if (slot < 0 || slot >= MAX_GHOST_SLOTS) return;
  const ctx = getGhostContext(slot);
  if (!ctx || ctx.enabled === enabled) return;

  if (enabled) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('about:blank').catch(() => {});

    page.on('framenavigated', (frame: any) => {
      if (frame === page.mainFrame()) setGhostContext(slot, { url: frame.url() });
    });

    const interval = setInterval(async () => {
      const ghost = getGhostContext(slot);
      if (!ghost?.enabled || !ghost.page) return;
      try {
        const buf = await (ghost.page as Page).screenshot({ type: 'jpeg', quality: 55 });
        shadowBridge.emit('shadowFrame', {
          base64: buf.toString('base64'),
          ts:     Date.now(),
          slot,
        });
      } catch { /* page closed */ }
    }, 500);

    setGhostContext(slot, { enabled: true, page, browser, url: 'about:blank', interval });
    shadowBridge.emit('shadowToggle', { enabled: true, slot });

  } else {
    const ghost = getGhostContext(slot);
    if (ghost?.interval) clearInterval(ghost.interval);
    try { await (ghost?.browser as Browser | null)?.close(); } catch { /* best-effort */ }
    setGhostContext(slot, { enabled: false, page: null, browser: null, url: 'about:blank', interval: null });
    shadowBridge.emit('shadowToggle', { enabled: false, slot });
  }
}

/**
 * Navigate a specific ghost slot to a URL.
 */
export async function ghostNavigate(slot: number, url: string): Promise<void> {
  const ctx = getGhostContext(slot);
  if (!ctx?.enabled || !ctx.page) return;
  await (ctx.page as Page).goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  setGhostContext(slot, { url });
  shadowBridge.emit('shadowNav', { url, slot });
}

/**
 * Stop all ghost slots (emergency shutdown).
 */
export async function stopAllGhosts(): Promise<void> {
  for (let i = 0; i < MAX_GHOST_SLOTS; i++) {
    await toggleGhostSlot(i, false).catch(() => {});
  }
}

/**
 * BrowserTools — Playwright tabanlı web tarayıcı kontrol aracı.
 * Executor tarafından lazy-initialized olarak kullanılır.
 * close() çağrılana kadar oturum açık kalır.
 */
export class BrowserTools {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  private async ensurePage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.info('BrowserTools: Launching Chromium (headless)...');
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'tr-TR',
      });
      this.page = await this.context.newPage();
    }
    return this.page!;
  }

  /** Bir URL'e git. waitFor: 'load' | 'domcontentloaded' | 'networkidle' */
  async navigate(params: {
    url: string;
    waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<NavigateResult> {
    const page = await this.ensurePage();
    this.logger.info(`BrowserTools: Navigating to ${params.url}`);
    const response = await page.goto(params.url, {
      waitUntil: params.waitFor ?? 'domcontentloaded',
      timeout: 30_000,
    });
    return {
      url: page.url(),
      title: await page.title(),
      status: response?.status(),
    };
  }

  /** Ekran görüntüsü al — base64 PNG döner */
  async screenshot(params?: {
    selector?: string;
    fullPage?: boolean;
  }): Promise<ScreenshotResult> {
    const page = await this.ensurePage();
    let buffer: Buffer;

    if (params?.selector) {
      const el = await page.$(params.selector);
      if (!el) throw new Error(`Selector not found: ${params.selector}`);
      buffer = await el.screenshot({ type: 'png' });
    } else {
      buffer = await page.screenshot({
        type: 'png',
        fullPage: params?.fullPage ?? false,
      });
    }

    const vp = page.viewportSize();
    return {
      base64: buffer.toString('base64'),
      width: vp?.width ?? 1280,
      height: vp?.height ?? 800,
    };
  }

  /** Bir elemente tıkla */
  async click(params: {
    selector: string;
    timeout?: number;
  }): Promise<{ success: boolean }> {
    const page = await this.ensurePage();
    this.logger.info(`BrowserTools: Click → ${params.selector}`);
    await page.click(params.selector, { timeout: params.timeout ?? 10_000 });
    return { success: true };
  }

  /** Bir input alanına metin yaz */
  async type(params: {
    selector: string;
    text: string;
    clear?: boolean;
  }): Promise<{ success: boolean }> {
    const page = await this.ensurePage();
    this.logger.info(`BrowserTools: Type into ${params.selector}`);
    if (params.clear !== false) {
      await page.fill(params.selector, params.text);
    } else {
      await page.type(params.selector, params.text);
    }
    return { success: true };
  }

  /** Bir elementten metin veya HTML içeriği çıkar */
  async extract(params: {
    selector: string;
  }): Promise<ExtractResult> {
    const page = await this.ensurePage();
    const text = (await page.textContent(params.selector)) ?? '';
    const html = await page.innerHTML(params.selector).catch(() => undefined);
    return { text, html };
  }

  /**
   * Sayfanın erişilebilirlik (ARIA) anlık görüntüsünü al.
   * AI'ın sayfayı anlaması için idealdir — DOM yerine semantik yapıyı döner.
   */
  async snapshot(): Promise<SnapshotResult> {
    const page = await this.ensurePage();
    try {
      // Playwright 1.46+ YAML-like ARIA snapshot
      const snap = await page.locator('html').ariaSnapshot();
      return { snapshot: snap };
    } catch {
      // Eski sürüm fallback
      const snap = await (page as any).accessibility?.snapshot?.();
      return { snapshot: JSON.stringify(snap ?? {}, null, 2) };
    }
  }

  /** Sayfada JavaScript çalıştır */
  async evaluate(params: { script: string }): Promise<EvaluateResult> {
    const page = await this.ensurePage();
    const result = await page.evaluate(params.script);
    return { result };
  }

  /** Mevcut sayfa URL'ini döner */
  async currentUrl(): Promise<{ url: string; title: string }> {
    const page = await this.ensurePage();
    return { url: page.url(), title: await page.title() };
  }

  /** Tarayıcıyı kapat ve kaynakları serbest bırak */
  async close(): Promise<void> {
    try {
      await this.context?.close();
      await this.browser?.close();
    } catch { /* best-effort */ }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.logger.info('BrowserTools: Browser closed.');
  }

  get isOpen(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Capture the primary OS screen — available on ALL ranks, no hierarchy restriction.
   * Uses native platform tools (PowerShell / screencapture / scrot).
   * Falls back to Playwright viewport screenshot if native capture fails.
   * If detect:true, also runs Sobel-based UI element detection on the image.
   */
  async captureScreen(params?: { detect?: boolean }): Promise<{
    base64:     string;
    width:      number;
    height:     number;
    source:     string;
    elements?:  import('./vision.js').UIElement[];
    durationMs?: number;
  }> {
    const { captureScreen, detectUIElements } = await import('./vision.js');
    const capture = await captureScreen();
    if (params?.detect) {
      const detection = await detectUIElements(capture.base64);
      return { ...capture, elements: detection.elements, durationMs: detection.durationMs };
    }
    return capture;
  }

  // ── OS-Level Input (Precision Hands v4.2) ─────────────────────────────

  /** Move the OS cursor to absolute screen coordinates (x, y). */
  async mouseMove(params: { x: number; y: number }): Promise<{ ok: boolean }> {
    const { osMouseMove } = await import('./input.js');
    await osMouseMove(params.x, params.y);
    return { ok: true };
  }

  /**
   * Move the OS cursor to (x, y) and click a mouse button.
   * button: 'left' (default) | 'right' | 'middle'
   */
  async mouseClick(params: {
    x:       number;
    y:       number;
    button?: 'left' | 'right' | 'middle';
  }): Promise<{ ok: boolean }> {
    const { osMouseClick } = await import('./input.js');
    await osMouseClick(params.x, params.y, params.button ?? 'left');
    return { ok: true };
  }

  /**
   * Type text into the focused OS input at a human pace.
   * delayMs: ms per keystroke (default 60, ±40% jitter).
   * Uses clipboard-paste technique for reliability on Windows/macOS.
   */
  async typeText(params: { text: string; delayMs?: number }): Promise<{ ok: boolean }> {
    const { osTypeText } = await import('./input.js');
    await osTypeText(params.text, params.delayMs ?? 60);
    return { ok: true };
  }

  /**
   * Vision integration: detect UI elements in a base64 PNG then click the
   * first element matching elementType (default 'button') at the given index.
   * Returns coordinates and matched element, or { ok: false } if none found.
   */
  async clickDetectedElement(params: {
    base64:       string;
    elementType?: 'button' | 'input' | 'image' | 'unknown';
    index?:       number;
    label?:       string;
  }): Promise<{ ok: boolean; x?: number; y?: number; element?: object }> {
    const { osVisionClick } = await import('./input.js');
    const result = await osVisionClick(params);
    return result ?? { ok: false };
  }

  // ── Action Force — El-Göz (Hand-Eye) tools ────────────────────────────

  /**
   * Combined perception: returns ARIA snapshot + current URL + title in one call.
   * LLM kullanır, sayfayı "görmek" için ideal — screenshot almaya gerek yok.
   */
  async perceive(): Promise<{ snapshot: string; url: string; title: string }> {
    const page = await this.ensurePage();
    const [snapResult, url, title] = await Promise.all([
      this.snapshot(),
      page.url(),
      page.title(),
    ]);
    return { snapshot: snapResult.snapshot, url, title };
  }

  /**
   * Sayfayı kaydır — x/y pixel cinsinden (negatif değer yukarı/sola kaydırır).
   * selector verilmişse o elementi, verilmemişse pencereyi kaydırır.
   */
  async scroll(params: {
    x?: number;
    y?: number;
    selector?: string;
  }): Promise<{ success: boolean }> {
    const page = await this.ensurePage();
    const dx = params.x ?? 0;
    const dy = params.y ?? 0;
    if (params.selector) {
      const el = await page.$(params.selector);
      if (!el) throw new Error(`Scroll target not found: ${params.selector}`);
      await el.evaluate((node, [sx, sy]) => {
        (node as Element).scrollBy(sx as number, sy as number);
      }, [dx, dy]);
    } else {
      await page.evaluate(([sx, sy]) => window.scrollBy(sx as number, sy as number), [dx, dy]);
    }
    return { success: true };
  }

  /**
   * Belirli bir selector görünene veya ağ idle durumuna gelene kadar bekle.
   * state: 'visible' (default) | 'hidden' | 'attached' | 'detached' | 'networkidle'
   */
  async waitFor(params: {
    selector?: string;
    state?: 'visible' | 'hidden' | 'attached' | 'detached' | 'networkidle';
    timeout?: number;
  }): Promise<{ success: boolean }> {
    const page    = await this.ensurePage();
    const timeout = params.timeout ?? 15_000;
    const state   = params.state as string | undefined;

    if (state === 'networkidle') {
      await page.waitForLoadState('networkidle', { timeout });
    } else if (params.selector) {
      await page.waitForSelector(params.selector, {
        state:   (state ?? 'visible') as 'visible' | 'hidden' | 'attached' | 'detached',
        timeout,
      });
    } else {
      await page.waitForLoadState('domcontentloaded', { timeout });
    }
    return { success: true };
  }
}
