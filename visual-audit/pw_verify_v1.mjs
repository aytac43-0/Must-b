import { chromium } from 'playwright';

const br = await chromium.launch({ headless: true });
const page = await br.newPage();
const errors = [];

page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('WebSocket') && !m.text().includes('socket.io'))
    errors.push('CONSOLE: ' + m.text());
});

// Welcome
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
const welcomeOk = await page.evaluate(() => document.body.innerText.trim().length > 0);
console.log('Welcome:', welcomeOk ? 'PASS' : 'FAIL');

// App
await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
const appOk = await page.evaluate(() => document.body.innerText.trim().length > 0);
console.log('App:', appOk ? 'PASS' : 'FAIL');

// Tabs
const tabs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .map(b => b.textContent?.trim())
    .filter(t => ['Chat','Workspace','Skills','Memory','Plugins'].includes(t ?? ''))
);
console.log('Tabs found:', tabs.join(', '));

for (const label of ['Workspace','Skills','Memory','Plugins','Chat']) {
  const btn = page.getByRole('button', { name: label, exact: true });
  if (await btn.count() > 0) {
    await btn.click();
    await page.waitForTimeout(500);
    const ok = await page.evaluate(() => document.body.innerText.trim().length > 0);
    console.log(label + ':', ok ? 'PASS' : 'FAIL blank');
  } else {
    console.log(label + ': NOT FOUND');
  }
}

console.log('Non-socket errors:', errors.length ? errors.join(' | ') : 'none');
await br.close();
