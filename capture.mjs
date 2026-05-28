// Moodboard capture agent
// Usage: node capture.mjs <url> <folder> "<one-line note>"
//
// Launches headless chromium, captures a full-page screenshot of <url>,
// files it into ~/moodboard/<folder>/ as <NN>-<hostname-slug>.png, and
// appends a note to that folder's notes.md.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const [, , url, folder, note = ''] = process.argv;

if (!url || !folder) {
  console.error('Usage: node capture.mjs <url> <folder> "<one-line note>"');
  process.exit(1);
}

// Resolve the moodboard root from this file's own location so the script
// works no matter which directory you run it from.
const moodboardRoot = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(moodboardRoot, folder);
await fs.mkdir(targetDir, { recursive: true });

// Build the hostname slug.
let hostname;
try {
  hostname = new URL(url).hostname;
} catch {
  console.error(`Invalid URL: ${url}`);
  process.exit(1);
}
const slug = hostname.replace(/\./g, '-');

// Determine the next 2-digit index in this folder.
const existing = await fs.readdir(targetDir);
const indices = existing
  .map((f) => /^(\d{2})-/.exec(f))
  .filter(Boolean)
  .map((m) => parseInt(m[1], 10));
const nextIndex = (indices.length ? Math.max(...indices) : 0) + 1;
const nn = String(nextIndex).padStart(2, '0');
const filename = `${nn}-${slug}.png`;
const filepath = path.join(targetDir, filename);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Honour the requested networkidle wait, but don't let a never-idle page
  // (common on tracker-heavy e-commerce sites) crash the whole capture.
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn(
      `networkidle not reached (${e.message.split('\n')[0]}); continuing with current page state.`
    );
  }

  // Best-effort cookie banner dismissal. Never fail on this.
  const cookieSelectors = [
    '[id*="cookie"] button',
    '[class*="cookie"] button[class*="accept"]',
    'button:has-text("Accept")',
    'button:has-text("Agree")',
  ];
  for (const sel of cookieSelectors) {
    try {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      /* ignore - best effort */
    }
  }

  // Scroll to the bottom in increments to trigger lazy-loaded images,
  // then scroll back to the top before capturing.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      let guard = 0;
      const step = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        guard += 1;
        if (total >= document.body.scrollHeight || guard > 100) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  await page.screenshot({ path: filepath, fullPage: true });
} finally {
  await browser.close();
}

// Append the note entry.
const entry =
  `## ${filename}\n` +
  `Source: ${url}\n` +
  `Captured: ${new Date().toISOString()}\n` +
  `Love: ${note}\n\n`;
await fs.appendFile(path.join(targetDir, 'notes.md'), entry, 'utf8');

console.log(path.resolve(filepath));
