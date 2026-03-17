/**
 * Must-b Vision Tools
 *
 * captureScreen()     — OS-level primary screen capture → base64 PNG
 * detectUIElements()  — Sobel edge + bounding-box heuristics on a PNG
 */

import { exec }            from 'child_process';
import { promisify }       from 'util';
import { tmpdir }          from 'os';
import { join }            from 'path';
import { readFile, unlink } from 'fs/promises';
import { chromium }        from 'playwright';

const execAsync = promisify(exec);

// ── Types ─────────────────────────────────────────────────────────────────

export interface ScreenCapture {
  /** Base64-encoded PNG */
  base64: string;
  width:  number;
  height: number;
  /** 'os' = native screen capture, 'playwright' = headless browser fallback */
  source: 'os' | 'playwright';
}

export type UIElementType = 'button' | 'input' | 'image' | 'unknown';

export interface UIElement {
  type:       UIElementType;
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  /** Heuristic confidence 0–1 */
  confidence: number;
}

export interface DetectionResult {
  elements:    UIElement[];
  imageWidth:  number;
  imageHeight: number;
  durationMs:  number;
}

// ── Screen Capture ────────────────────────────────────────────────────────

async function captureWindows(): Promise<Buffer> {
  const tmp = join(tmpdir(), `mustb-screen-${Date.now()}.png`).replace(/\\/g, '\\\\');
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing;',
    '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;',
    '$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height);',
    '$g=[System.Drawing.Graphics]::FromImage($bmp);',
    '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);',
    `$bmp.Save('${tmp}',[System.Drawing.Imaging.ImageFormat]::Png);`,
    '$g.Dispose();$bmp.Dispose()',
  ].join('');
  await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`);
  const buf = await readFile(tmp.replace(/\\\\/g, '\\'));
  await unlink(tmp.replace(/\\\\/g, '\\')).catch(() => {});
  return buf;
}

async function captureMac(): Promise<Buffer> {
  const tmp = join(tmpdir(), `mustb-screen-${Date.now()}.png`);
  await execAsync(`screencapture -x -t png "${tmp}"`);
  const buf = await readFile(tmp);
  await unlink(tmp).catch(() => {});
  return buf;
}

async function captureLinux(): Promise<Buffer> {
  const tmp = join(tmpdir(), `mustb-screen-${Date.now()}.png`);
  try {
    await execAsync(`scrot "${tmp}"`);
  } catch {
    // ImageMagick fallback
    await execAsync(`import -window root "${tmp}"`);
  }
  const buf = await readFile(tmp);
  await unlink(tmp).catch(() => {});
  return buf;
}

async function playwrightFallback(): Promise<ScreenCapture> {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await ctx.newPage();
  await page.setContent('<html style="background:#111;margin:0"><body></body></html>');
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return { base64: buf.toString('base64'), width: 1280, height: 800, source: 'playwright' };
}

/**
 * Capture the primary OS screen.
 * Falls back to a blank Playwright viewport if no native tool is available.
 */
export async function captureScreen(): Promise<ScreenCapture> {
  try {
    let buf: Buffer;
    switch (process.platform) {
      case 'win32':  buf = await captureWindows(); break;
      case 'darwin': buf = await captureMac();     break;
      default:       buf = await captureLinux();   break;
    }
    // Read PNG IHDR dimensions (bytes 16-23)
    const width  = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { base64: buf.toString('base64'), width, height, source: 'os' };
  } catch {
    return playwrightFallback();
  }
}

// ── UI Element Detection ──────────────────────────────────────────────────

/**
 * Analyse a base64 PNG with a Playwright headless browser.
 * Runs Sobel edge detection on a canvas, groups edge pixels into bounding
 * boxes, then classifies each box by aspect-ratio heuristics.
 *
 * Returns up to 50 detected elements sorted by confidence descending.
 */
export async function detectUIElements(base64Png: string): Promise<DetectionResult> {
  const t0      = Date.now();
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page    = await ctx.newPage();
  await page.setContent('<html><body></body></html>');

  const result = await page.evaluate(async (b64: string) => {
    type Box = { x1: number; y1: number; x2: number; y2: number };

    const img = await new Promise<HTMLImageElement>((res) => {
      const i  = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(i);
      i.src    = 'data:image/png;base64,' + b64;
      document.body.appendChild(i);
    });

    const W = img.naturalWidth  || 1280;
    const H = img.naturalHeight || 800;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const c2d    = canvas.getContext('2d')!;
    c2d.drawImage(img, 0, 0);
    const { data } = c2d.getImageData(0, 0, W, H);

    const lum = (x: number, y: number): number => {
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      const i = (y * W + x) * 4;
      return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    };

    const sobelAt = (x: number, y: number): number => {
      const gx = -lum(x-1,y-1) - 2*lum(x-1,y) - lum(x-1,y+1)
               +  lum(x+1,y-1) + 2*lum(x+1,y) + lum(x+1,y+1);
      const gy = -lum(x-1,y-1) - 2*lum(x,y-1) - lum(x+1,y-1)
               +  lum(x-1,y+1) + 2*lum(x,y+1) + lum(x+1,y+1);
      return Math.sqrt(gx * gx + gy * gy);
    };

    // Collect strong edge pixels (sample every 4px for performance)
    const STEP = 4, THRESHOLD = 40, MERGE = 32;
    const pts: { x: number; y: number }[] = [];
    for (let y = STEP; y < H - STEP; y += STEP) {
      for (let x = STEP; x < W - STEP; x += STEP) {
        if (sobelAt(x, y) > THRESHOLD) pts.push({ x, y });
      }
    }

    // Merge nearby points into bounding boxes
    const boxes: Box[] = [];
    for (const p of pts) {
      let hit = false;
      for (const b of boxes) {
        if (p.x >= b.x1 - MERGE && p.x <= b.x2 + MERGE &&
            p.y >= b.y1 - MERGE && p.y <= b.y2 + MERGE) {
          b.x1 = Math.min(b.x1, p.x); b.y1 = Math.min(b.y1, p.y);
          b.x2 = Math.max(b.x2, p.x); b.y2 = Math.max(b.y2, p.y);
          hit = true; break;
        }
      }
      if (!hit) boxes.push({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    }

    // Classify by aspect-ratio heuristics
    const elements: object[] = [];
    for (const b of boxes) {
      const w = b.x2 - b.x1, h = b.y2 - b.y1;
      if (w < 20 || h < 10) continue;
      const ar = w / h;
      let type = 'unknown', confidence = 0.35;
      if      (ar >= 2.5 && ar <= 10 && h >= 12 && h <= 55)  { type = 'button'; confidence = 0.72; }
      else if (ar >= 5   && h >= 18  && h <= 50)              { type = 'input';  confidence = 0.65; }
      else if (w >= 50   && h >= 50)                           { type = 'image';  confidence = 0.48; }
      elements.push({ type, x: b.x1, y: b.y1, width: w, height: h, confidence });
    }

    // Sort by confidence desc, cap at 50
    (elements as any[]).sort((a, b) => b.confidence - a.confidence);
    return { elements: elements.slice(0, 50), W, H };
  }, base64Png);

  await browser.close();

  return {
    elements:    result.elements as UIElement[],
    imageWidth:  result.W,
    imageHeight: result.H,
    durationMs:  Date.now() - t0,
  };
}
