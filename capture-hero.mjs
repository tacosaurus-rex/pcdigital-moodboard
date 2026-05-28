// Moodboard hero capture - dwells at the top of a page and captures an
// auto-advancing slider/carousel/video hero.
// Usage: node capture-hero.mjs <url> <folder> "<one-line note>" [frames=5] [intervalMs=3000]
//
// Loads the page (headed, past bot walls), stays at scroll Y=0, and takes N
// viewport screenshots at the given interval while recording a video. Use
// this when the page has an auto-advancing hero slider, a video hero, or any
// motion concentrated above the fold that capture-motion would scroll past.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const [, , url, folder, note = '', framesArg, intervalArg] = process.argv;
if (!url || !folder) {
  console.error('Usage: node capture-hero.mjs <url> <folder> "<one-line note>" [frames=5] [intervalMs=3000]');
  process.exit(1);
}

const FRAMES = parseInt(framesArg ?? '5', 10);
const INTERVAL_MS = parseInt(intervalArg ?? '3000', 10);

const moodboardRoot = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(moodboardRoot, folder);
await fs.mkdir(targetDir, { recursive: true });

let hostname;
try { hostname = new URL(url).hostname; } catch { console.error(`Invalid URL: ${url}`); process.exit(1); }
const slug = hostname.replace(/\./g, '-');

const existing = await fs.readdir(targetDir);
const indices = existing.map((f) => /^(\d{2})-/.exec(f)).filter(Boolean).map((m) => parseInt(m[1], 10));
const nn = String((indices.length ? Math.max(...indices) : 0) + 1).padStart(2, '0');

const videoOut = path.join(targetDir, `${nn}-${slug}-hero.webm`);
const framePrefix = `${nn}-${slug}-hero-`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Aggressively dismiss email-capture / promo popups. Tries text links first
// ("No thanks"), then close-X buttons on visible dialog overlays.
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
  const videoDir = path.join(targetDir, '.video-tmp-hero');
  await fs.mkdir(videoDir, { recursive: true });
  let videoTmpPath = null;
  const framePaths = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      userAgent: UA,
      locale: 'en-US',
      timezoneId: 'America/Toronto',
      recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
    });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Cloudflare wait.
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const t = (await page.title().catch(() => '')) || '';
      if (!/just a moment|verify you are human|attention required|checking your browser/i.test(t)) break;
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(2000);

    for (const sel of ['[id*="cookie"] button', 'button:has-text("Accept")', 'button:has-text("Agree")']) {
      try { const b = page.locator(sel).first(); if ((await b.count()) > 0 && (await b.isVisible())) { await b.click({ timeout: 2000 }); break; } } catch {}
    }
    await dismissPromo(page);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));

    for (let i = 0; i < FRAMES; i++) {
      // Email-capture popups often appear partway through the dwell. Dismiss before each frame.
      await dismissPromo(page);
      const fp = path.join(targetDir, `${framePrefix}${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: fp, fullPage: false });
      framePaths.push(fp);
      if (i < FRAMES - 1) await page.waitForTimeout(INTERVAL_MS);
    }

    const video = page.video();
    if (video) videoTmpPath = await video.path();
    await ctx.close();
  } finally {
    await browser.close();
  }

  if (videoTmpPath) await fs.copyFile(videoTmpPath, videoOut);
  try { await fs.rm(path.join(targetDir, '.video-tmp-hero'), { recursive: true, force: true }); } catch {}

  return { videoOut, framePaths };
}

let result;
try { result = await run('chrome'); } catch (e) { console.warn('chrome channel unavailable (' + e.message.split('\n')[0] + '); using bundled chromium'); result = await run(undefined); }

const entry =
  `## ${nn}-${slug} (hero)\n` +
  `Source: ${url}\n` +
  `Captured: ${new Date().toISOString()}\n` +
  `Love: ${note}\n` +
  `Video: ${path.basename(result.videoOut)}\n` +
  `Frames: ${result.framePaths.map((p) => path.basename(p)).join(', ')}\n\n`;
await fs.appendFile(path.join(targetDir, 'notes.md'), entry, 'utf8');
console.log(result.videoOut);
