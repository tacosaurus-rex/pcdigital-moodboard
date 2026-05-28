// Moodboard motion capture - records the scroll-through of a page.
// Usage: node capture-motion.mjs <url> <folder> "<one-line note>"
//
// Records a short .webm video of a smoothly scripted scroll from top to bottom
// AND saves a numbered sequence of viewport PNG frames captured at each scroll
// stop. Together these let any reader (Claude in a future session, claude.ai,
// or a human) reference the page's motion: the video preserves fidelity, the
// frame sequence is inline-readable as images.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const [, , url, folder, note = ''] = process.argv;
if (!url || !folder) {
  console.error('Usage: node capture-motion.mjs <url> <folder> "<one-line note>"');
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

const videoOut = path.join(targetDir, `${nn}-${slug}.webm`);
const framePrefix = `${nn}-${slug}-motion-`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const FRAMES = 8;        // frame count (incl. top + bottom)
const TOTAL_MS = 18000;  // total scroll duration

async function run(channel) {
  const browser = await chromium.launch({ headless: false, channel, args: ['--disable-blink-features=AutomationControlled'] });
  const videoDir = path.join(targetDir, '.video-tmp');
  await fs.mkdir(videoDir, { recursive: true });
  let framePaths = [];
  let videoTmpPath = null;
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
    for (const t of ['No thanks', 'No, thanks', 'No Thanks']) {
      try { const l = page.getByText(t, { exact: false }).first(); if ((await l.count()) > 0 && (await l.isVisible())) { await l.click({ timeout: 1500 }); break; } } catch {}
    }
    await page.waitForTimeout(1000);

    const pageHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    const viewportHeight = 900;
    const maxScroll = Math.max(0, pageHeight - viewportHeight);
    const stepY = maxScroll / (FRAMES - 1);
    const stepMs = TOTAL_MS / (FRAMES - 1);

    for (let i = 0; i < FRAMES; i++) {
      const y = Math.round(stepY * i);
      const dur = Math.max(200, stepMs - 700); // leave buffer to let reveals land before snapshot
      await page.evaluate(({ y, dur }) => new Promise((resolve) => {
        const startY = window.scrollY;
        const dy = y - startY;
        if (dy === 0) return resolve();
        const start = performance.now();
        function tick(now) {
          const t = Math.min(1, (now - start) / dur);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
          window.scrollTo(0, startY + dy * ease);
          if (t < 1) requestAnimationFrame(tick); else resolve();
        }
        requestAnimationFrame(tick);
      }), { y, dur });
      await page.waitForTimeout(700); // animation settle
      const fp = path.join(targetDir, `${framePrefix}${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: fp, fullPage: false });
      framePaths.push(fp);
    }

    const video = page.video();
    if (video) videoTmpPath = await video.path();
    await ctx.close();
  } finally {
    await browser.close();
  }

  if (videoTmpPath) {
    await fs.copyFile(videoTmpPath, videoOut);
  }
  try { await fs.rm(path.join(targetDir, '.video-tmp'), { recursive: true, force: true }); } catch {}

  return { videoOut, framePaths };
}

let result;
try { result = await run('chrome'); } catch (e) { console.warn('chrome channel unavailable (' + e.message.split('\n')[0] + '); using bundled chromium'); result = await run(undefined); }

const entry =
  `## ${nn}-${slug} (motion)\n` +
  `Source: ${url}\n` +
  `Captured: ${new Date().toISOString()}\n` +
  `Love: ${note}\n` +
  `Video: ${path.basename(result.videoOut)}\n` +
  `Frames: ${result.framePaths.map((p) => path.basename(p)).join(', ')}\n\n`;
await fs.appendFile(path.join(targetDir, 'notes.md'), entry, 'utf8');
console.log(result.videoOut);
