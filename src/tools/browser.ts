import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import winston from 'winston';

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
}
