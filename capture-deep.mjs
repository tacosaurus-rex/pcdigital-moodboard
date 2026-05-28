// Moodboard deep capture - robust full-page screenshot.
// Usage: node capture-deep.mjs <url> <folder> "<one-line note>"
//
// Same output contract as capture.mjs (NN-hostname.png + notes.md entry),
// but uses a headed browser with a realistic fingerprint so it clears
// Cloudflare/bot walls and tracker-heavy storefronts that defeat the plain
// headless capture.mjs. Reach for this when capture.mjs returns a bot wall.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const [, , url, folder, note = ''] = process.argv;
if (!url || !folder) {
  console.error('Usage: node capture-deep.mjs <url> <folder> "<one-line note>"');
  process.exit(1);
}

const moodboardRoot = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(moodboardRoot, folder);
await fs.mkdir(targetDir, { recursive: true });

let hostname;
try { hostname = new URL(url).hostname; } catch { console.error(`Invalid URL: ${url}`); process.exit(1); }
const slug = hostname.replace(/\./g, '-');

const existing = await fs.readdir(targetDir);
const indices = existing.map((f) => /^(\d{2})-/.exec(f)).filter(Boolean).map((m) => parseInt(m[1], 10));
const nn = String((indices.length ? Math.max(...indices) : 0) + 1).padStart(2, '0');
const filename = `${nn}-${slug}.png`;
const filepath = path.join(targetDir, filename);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Aggressively dismiss email-capture / promo popups. Tries text links then
// close-X buttons on visible dialog overlays.
async function dismissPromo(page) {
  for (const t of ['No thanks', 'No, thanks', 'No Thanks', 'no thank you']) {
    try { const l = page.getByText(t, { exact: false }).first(); if ((await l.count()) > 0 && (await l.isVisible())) { await l.click({ timeout: 1500 }); await page.waitForTimeout(300); return; } } catch {}
  }
  const closeSelectors = [
    'button[aria-label="Close form"]',
    '.klaviyo-close-form',
    '[role="dialog"] button[aria-label*="close" i]',
    'button[aria-label="Close dialog"]',
    'button[aria-label*="close" i]',
    '[aria-label="Close"]',
  ];
  for (const cs of closeSelectors) {
    try { const c = page.locator(cs).first(); if ((await c.count()) > 0 && (await c.isVisible())) { await c.click({ timeout: 1500 }); await page.waitForTimeout(300); return; } } catch {}
  }
}

async function run(channel) {
  const browser = await chromium.launch({ headless: false, channel, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, userAgent: UA, locale: 'en-US', timezoneId: 'America/Toronto' });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait out a Cloudflare challenge if present.
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const t = (await page.title().catch(() => '')) || '';
      if (!/just a moment|verify you are human|attention required|checking your browser/i.test(t)) break;
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(2000);

    // Best-effort cookie + marketing-popup dismissal.
    for (const sel of ['[id*="cookie"] button', '[class*="cookie"] button[class*="accept"]', 'button:has-text("Accept")', 'button:has-text("Agree")']) {
      try { const b = page.locator(sel).first(); if ((await b.count()) > 0 && (await b.isVisible())) { await b.click({ timeout: 2000 }); break; } } catch {}
    }
    await dismissPromo(page);

    // Scroll to trigger lazy loads, then back to top.
    await page.evaluate(async () => {
      await new Promise((r) => { let t = 0, g = 0; const i = setInterval(() => { window.scrollBy(0, 400); t += 400; g += 1; if (t >= document.body.scrollHeight || g > 100) { clearInterval(i); r(); } }, 150); });
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    // Promo popups often appear during the dwell at top; dismiss once more right before the shot.
    await dismissPromo(page);
    await page.waitForTimeout(400);

    await page.screenshot({ path: filepath, fullPage: true });
  } finally {
    await browser.close();
  }
}

try { await run('chrome'); } catch (e) { console.warn('chrome channel unavailable (' + e.message.split('\n')[0] + '); using bundled chromium'); await run(undefined); }

const entry = `## ${filename}\nSource: ${url}\nCaptured: ${new Date().toISOString()}\nLove: ${note}\n\n`;
await fs.appendFile(path.join(targetDir, 'notes.md'), entry, 'utf8');
console.log(path.resolve(filepath));
