// Open interactive modals/drawers on a PDP and screenshot each open state.
// Usage: node .capture-modals.mjs <url> <itemsJsonFilePath>
//   items file = [{ "label": "...", "tag": "drawer-open", "text": "Supplement Facts" }, ...]
// Reloads fresh per item so a previously-open overlay never blocks the next click.
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const url = process.argv[2];
const items = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const outDir = path.join(os.homedir(), 'moodboard', 'pdp-ecommerce');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Dismiss marketing email-capture popups (Klaviyo/Privy etc). Safe to call before opening a drawer.
async function dismissPromoFull(page) {
  for (const t of ['No thanks', 'No, thanks', 'No Thanks', 'no thank']) {
    try { const l = page.getByText(t, { exact: false }).first(); if ((await l.count()) > 0 && (await l.isVisible())) { await l.click({ timeout: 1500 }); await page.waitForTimeout(400); return; } } catch {}
  }
  for (const cs of ['[aria-label="Close dialog"]', '.klaviyo-close-form', '.needsclick[aria-label="Close"]', 'div[role="dialog"] button[aria-label="Close"]']) {
    try { const c = page.locator(cs).first(); if ((await c.count()) > 0 && (await c.isVisible())) { await c.click({ timeout: 1500 }); await page.waitForTimeout(400); } } catch {}
  }
}
// Only dismiss the promo via its "No thanks" link - won't close an info drawer we want open.
async function dismissPromoSoft(page) {
  for (const t of ['No thanks', 'No, thanks', 'No Thanks', 'no thank']) {
    try { const l = page.getByText(t, { exact: false }).first(); if ((await l.count()) > 0 && (await l.isVisible())) { await l.click({ timeout: 1500 }); await page.waitForTimeout(400); return; } } catch {}
  }
}

async function prepare(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const t = (await page.title().catch(() => '')) || '';
    if (!/just a moment|verify you are human|attention required|checking your browser/i.test(t)) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(2500);
  for (const sel of ['[id*="cookie"] button', 'button:has-text("Accept")', 'button:has-text("Agree")']) {
    try { const b = page.locator(sel).first(); if ((await b.count()) > 0 && (await b.isVisible())) { await b.click({ timeout: 2000 }); break; } } catch {}
  }
  await dismissPromoFull(page);
}

async function run(channel) {
  const browser = await chromium.launch({ headless: false, channel, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, userAgent: UA, locale: 'en-US', timezoneId: 'America/Toronto' });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await ctx.newPage();

    const results = [];
    for (const it of items) {
      const out = path.join(outDir, `.modal-${it.label}.png`);
      try {
        await prepare(page); // fresh load every time
        const trigger = it.tag
          ? page.locator(`${it.tag}:has-text(${JSON.stringify(it.text)})`).first()
          : page.getByText(it.text, { exact: false }).first();
        await trigger.scrollIntoViewIfNeeded({ timeout: 8000 });
        await page.waitForTimeout(500);
        await dismissPromoFull(page); // clear promo before opening
        await trigger.click({ timeout: 8000 });
        await page.waitForTimeout(2500); // animate + load gifs
        await dismissPromoSoft(page);   // clear promo that popped over the drawer
        await page.waitForTimeout(800);
        await page.screenshot({ path: out, fullPage: false });
        results.push({ label: it.label, ok: true, path: out });
      } catch (e) {
        results.push({ label: it.label, ok: false, err: e.message.split('\n')[0] });
      }
    }
    console.log(JSON.stringify(results, null, 0));
  } finally {
    await browser.close();
  }
}

try { await run('chrome'); } catch (e) { console.warn('chrome channel failed: ' + e.message.split('\n')[0]); await run(undefined); }
