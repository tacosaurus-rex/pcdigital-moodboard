// Discovery: load a PDP (headed + stealth) and list candidate modal/popup triggers.
// Usage: node .explore.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

async function attempt(channel) {
  const browser = await chromium.launch({ headless: false, channel, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: UA, locale: 'en-US', timezoneId: 'America/Toronto' });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // wait for cloudflare to clear
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const t = (await page.title().catch(() => '')) || '';
      if (!/just a moment|verify you are human|attention required|checking your browser/i.test(t)) break;
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(2000);
    const data = await page.evaluate(() => {
      const out = [];
      const els = Array.from(document.querySelectorAll('button, a, [role="button"], [data-modal], summary, [aria-haspopup]'));
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const txt = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
        if (!txt) continue;
        out.push({ tag: el.tagName.toLowerCase(), txt, ariaHaspopup: el.getAttribute('aria-haspopup') || '', dataModal: el.getAttribute('data-modal') || '', visible: r.width > 0 && r.height > 0 });
      }
      // dedupe by txt
      const seen = new Set();
      return out.filter(o => { const k = o.tag + '|' + o.txt; if (seen.has(k)) return false; seen.add(k); return true; });
    });
    console.log('TITLE: ' + (await page.title()));
    console.log(JSON.stringify(data, null, 0));
    return browser;
  } finally {
    await browser.close();
  }
}

try { await attempt('chrome'); } catch (e) { console.warn('chrome channel failed: ' + e.message.split('\n')[0]); await attempt(undefined); }
