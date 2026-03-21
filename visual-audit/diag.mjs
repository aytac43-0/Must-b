import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await ctx.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/local'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'mock-token' }) });
    if (url.includes('/api/chats'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', title: 'Mission Alpha', created_at: '2026-03-17T09:00:00Z' }]) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });

  await page.goto('http://localhost:3000/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 300) ?? 'NO ROOT');
  const url = page.url();
  console.log('Final URL:', url);
  console.log('Root (300 chars):', rootHTML);
  console.log('Errors:', errors.join('\n') || 'none');

  await page.screenshot({ path: 'visual-audit/diag_app.png', fullPage: true });
  await browser.close();
})();
