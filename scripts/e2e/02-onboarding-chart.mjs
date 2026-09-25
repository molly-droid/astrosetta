// Precise onboarding drive using the real step structure:
// age_gate -> experience -> referral -> birth_data -> chart_summary -> email_digest -> app
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
const consoleErrors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 250)); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 250)));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png' });
const log = (...a) => console.log('▸', ...a);

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.click('text=Create an account');
  const email = `e2e-${Date.now()}@test.com`;
  await page.fill('#full_name', 'E2E Tester');
  await page.fill('#email', email);
  await page.fill('#password', 'e2e-password-123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/onboarding', { timeout: 20000 });
  log('signed up:', email);

  // age_gate
  await page.click('input[type="checkbox"]');
  await page.click('button:has-text("Continue")');
  // experience
  await page.click('button:has-text("Some basics")');
  await page.click('button:has-text("Continue")');
  // referral
  await page.waitForTimeout(500);
  await page.locator('button').filter({ hasText: /friend|social|search|podcast|instagram|tiktok/i }).first().click();
  await page.click('button:has-text("Continue")');
  // birth_data
  await page.waitForTimeout(500);
  await shot('20-birthdata');
  await page.fill('input[placeholder="Preferred name or nickname"]', 'E2E');
  await page.fill('input[type="date"]', '1990-06-15');
  await page.fill('input[type="time"]', '14:30');
  await page.fill('input[placeholder="e.g. Austin, Texas"]', 'New York');
  await page.waitForTimeout(3000); // open-meteo autocomplete
  await shot('21-location-suggest');
  const opt = page.locator('button, li, [role="option"]').filter({ hasText: /New York/ }).first();
  await opt.click();
  await page.waitForTimeout(500);
  await shot('22-birthdata-filled');
  await page.click('button:has-text("Calculate My Birth Chart")');
  log('calculating chart…');
  // chart_summary — chart-calculator round trip
  await page.waitForTimeout(9000);
  await shot('23-chart-summary');
  const summaryText = (await page.textContent('body')).slice(0, 0) || '';
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  log('chart summary excerpt:', bodyText.replace(/\n+/g, ' | ').slice(0, 300));
  const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")').first();
  if (await startBtn.count()) { log('clicking:', (await startBtn.textContent())?.trim()); await startBtn.click(); }
  // email_digest
  await page.waitForTimeout(1500);
  await shot('24-email-digest');
  const finish = page.locator('button').filter({ hasText: /continue|finish|start|begin|enter/i }).first();
  if (await finish.count()) { log('clicking:', (await finish.textContent())?.trim()); await finish.click(); }
  await page.waitForTimeout(4000);
  log('final url:', page.url());
  await shot('25-final');
} catch (err) {
  console.error('DRIVER ERROR:', err.message);
  await shot('99-error3');
}
console.log('CONSOLE ERRORS (' + consoleErrors.length + '):');
for (const e of [...new Set(consoleErrors)].slice(0, 12)) console.log('  •', e);
await browser.close();
