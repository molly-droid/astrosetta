// Smoke-drive the migrated Astrosetta app against the local Supabase stack.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 300)));

const shot = (name) => page.screenshot({ path: SHOTS + name + '.png' });
const log = (...a) => console.log('▸', ...a);

try {
  // 1. Landing
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('01-landing');
  log('landing loaded, title:', await page.title());

  // 2. Go to /login (Landing's sign-in link goes through redirectToLogin)
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('02-login');
  log('login page heading:', await page.textContent('h1').catch(() => 'NO H1'));

  // 3. Sign up a fresh user
  const email = `e2e-${Date.now()}@test.com`;
  await page.click('text=Create an account');
  await page.waitForTimeout(400);
  await page.fill('#full_name', 'E2E Tester');
  await page.fill('#email', email);
  await page.fill('#password', 'e2e-password-123');
  await shot('03-signup-filled');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/onboarding', { timeout: 20000 }).catch(async () => {
    log('did not reach /onboarding, url:', page.url());
  });
  await page.waitForTimeout(2500);
  await shot('04-after-signup');
  log('after signup url:', page.url());
  log('signup email:', email);
} catch (err) {
  console.error('DRIVER ERROR:', err.message);
  await shot('99-error');
}
console.log('CONSOLE ERRORS (' + consoleErrors.length + '):');
for (const e of [...new Set(consoleErrors)].slice(0, 15)) console.log('  •', e);
await browser.close();
