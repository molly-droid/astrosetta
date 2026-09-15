// Post-onboarding coverage: sign in as the created user, visit Chart and
// Planner, write a journal entry (entity CRUD through RLS from the real UI).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const email = process.argv[2];
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
const consoleErrors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png' });
const log = (...a) => console.log('▸', ...a);

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', 'e2e-password-123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 20000 });
  log('signed back in');

  await page.goto('http://localhost:5173/chart');
  await page.waitForTimeout(5000);
  await shot('30-chart');
  log('chart page loaded');

  await page.goto('http://localhost:5173/planner');
  await page.waitForTimeout(7000);
  await shot('31-planner');
  log('planner loaded');

  // Try a journal entry: look for journal/notes UI on planner day view
  const journalBox = page.locator('textarea').first();
  if (await journalBox.count()) {
    await journalBox.fill('E2E journal smoke note');
    await page.waitForTimeout(500);
    const save = page.locator('button').filter({ hasText: /save/i }).first();
    if (await save.count()) await save.click();
    await page.waitForTimeout(2000);
    log('journal note written');
    await shot('32-journal');
  } else {
    log('no textarea visible on planner — skipping journal');
  }

  await page.goto('http://localhost:5173/learn');
  await page.waitForTimeout(3000);
  await shot('33-learn');
  log('learn loaded');

  await page.goto('http://localhost:5173/profile');
  await page.waitForTimeout(3000);
  await shot('34-profile');
  log('profile loaded');
} catch (err) {
  console.error('DRIVER ERROR:', err.message);
  await shot('99-error4');
}
console.log('CONSOLE ERRORS (' + consoleErrors.length + '):');
for (const e of [...new Set(consoleErrors)].slice(0, 15)) console.log('  •', e);
await browser.close();
