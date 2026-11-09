'use strict';
// The Swim strength sub-app (CLAUDE.md decision 49): two sessions in one PWA, a
// pre-swim primer and a strength session, driven through the real UI.
//
// Serves the shipped files from `TRI-swim-strength mobile app/` over http. No
// test hook lives in the app. Service workers are blocked so a cached copy from
// one test can't leak into the next.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const { ROOT, chromiumPath } = require('./lib/app');

const APP_DIR = path.join(ROOT, 'TRI-swim-strength mobile app');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const PRIMER_SETS = 13; // 1 + 6 exercises x 2 sets
const STRENGTH_SETS = 22; // 1 + 1 + 4 + 4 + 3 + 3 + 3 + 3

function serveDir() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(APP_DIR, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({
        origin: 'http://127.0.0.1:' + server.address().port + '/',
        close: () => new Promise((r) => server.close(r)),
      })
    );
  });
}

async function completeSession(page) {
  const btns = await page.$$('#phases .check-btn, #phases .round-btn');
  for (const b of btns) await b.click();
}

describe('swim strength — primer and strength sessions', { concurrency: false }, () => {
  let server, browser;

  before(async () => {
    server = await serveDir();
    browser = await chromium.launch({ executablePath: chromiumPath() });
  });

  after(async () => {
    await browser.close();
    await server.close();
  });

  async function freshPage() {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('dialog', (d) => d.accept());
    await page.goto(server.origin);
    return { ctx, page, errors };
  }

  test('opens on the primer with two tabs and the right set count', async () => {
    const { ctx, page, errors } = await freshPage();
    assert.strictEqual(await page.locator('.session-tab').count(), 2);
    assert.strictEqual(await page.getAttribute('#tab-primer', 'aria-selected'), 'true');
    assert.strictEqual(await page.getAttribute('#tab-strength', 'aria-selected'), 'false');
    assert.strictEqual(await page.textContent('#progressTotal'), String(PRIMER_SETS));
    assert.match(await page.textContent('#heroTitle'), /Pre-swim primer/);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  test('switching to strength swaps the whole session and the totals', async () => {
    const { ctx, page, errors } = await freshPage();
    await page.click('#tab-strength');
    assert.strictEqual(await page.getAttribute('#tab-strength', 'aria-selected'), 'true');
    assert.strictEqual(await page.textContent('#progressTotal'), String(STRENGTH_SETS));
    assert.match(await page.textContent('#heroTitle'), /strength/i);
    assert.strictEqual(await page.locator('#phases .phase-card').count(), 3);
    assert.ok((await page.locator('.log-row').count()) >= 6, 'strength moves carry load fields');
    assert.strictEqual(await page.locator('#phases .log-row').first().isVisible(), true);
    // The primer must never ask for a load: it is not a strength stimulus.
    await page.click('#tab-primer');
    assert.strictEqual(await page.locator('.log-row').count(), 0);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  test('arrow keys move between tabs', async () => {
    const { ctx, page } = await freshPage();
    await page.focus('#tab-primer');
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.getAttribute('#tab-strength', 'aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.strictEqual(await page.getAttribute('#tab-primer', 'aria-selected'), 'true');
    await ctx.close();
  });

  test('progress is kept per session and survives a reload', async () => {
    const { ctx, page } = await freshPage();
    await page.locator('#phases .round-btn').first().click();
    assert.strictEqual(await page.textContent('#progressDone'), '1');
    await page.click('#tab-strength');
    assert.strictEqual(await page.textContent('#progressDone'), '0', 'strength starts empty');
    await page.reload();
    assert.strictEqual(await page.getAttribute('#tab-strength', 'aria-selected'), 'true', 'remembers the tab');
    await page.click('#tab-primer');
    assert.strictEqual(await page.textContent('#progressDone'), '1', 'primer progress persisted');
    await ctx.close();
  });

  test('completing a session counts it once, even after untick-and-retick and a reload', async () => {
    const { ctx, page, errors } = await freshPage();
    await completeSession(page);
    assert.strictEqual(await page.locator('#completionBanner').isVisible(), true);
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 1 time all-time/);

    // The v1 app counted this run twice. Untick one set and retick it.
    await page.locator('#phases .round-btn').first().click();
    await page.locator('#phases .round-btn').first().click();
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 1 time all-time/);

    // ...and again after a reload, when the in-memory flag would be gone.
    await page.reload();
    await page.locator('#phases .round-btn').first().click();
    await page.locator('#phases .round-btn').first().click();
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 1 time all-time/);

    // A genuine second run does count.
    await page.click('#resetButton');
    await completeSession(page);
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 2 times all-time/);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  test('load and reps survive a reset and a reload', async () => {
    const { ctx, page } = await freshPage();
    await page.click('#tab-strength');
    const first = page.locator('#phases .log-row').first();
    await first.locator('input[type="text"]').fill('red, doubled');
    await first.locator('input[type="number"]').fill('8');
    await page.locator('#phases .round-btn').first().click();

    await page.click('#resetButton');
    assert.strictEqual(await page.textContent('#progressDone'), '0', 'reset clears the checks');
    assert.strictEqual(await first.locator('input[type="text"]').inputValue(), 'red, doubled', 'but keeps the load');

    await page.reload();
    const again = page.locator('#phases .log-row').first();
    assert.strictEqual(await again.locator('input[type="text"]').inputValue(), 'red, doubled');
    assert.strictEqual(await again.locator('input[type="number"]').inputValue(), '8');
    await ctx.close();
  });

  test('a v1 session count carries over to the strength session once', async () => {
    const { ctx, page } = await freshPage();
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('triSwimStrength.sessionsCompleted.v1', '7');
    });
    await page.reload();
    await page.click('#tab-strength');
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 7 times all-time/);
    await page.click('#tab-primer');
    assert.match(await page.textContent('#sessionsCompletedLabel'), /Completed 0 times all-time/);
    await ctx.close();
  });

  test('no horizontal scroll at 320px on either session', async () => {
    const { ctx, page } = await freshPage();
    await page.setViewportSize({ width: 320, height: 640 });
    for (const tab of ['#tab-primer', '#tab-strength']) {
      await page.click(tab);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, tab + ' overflows by ' + overflow + 'px');
    }
    await ctx.close();
  });
});
