'use strict';
// Entering `synced` (boot, return from sign-in, import complete) repaints what
// is on screen, and that repaint must follow the same rules as every other
// background redraw on the Calendar (CLAUDE.md decision 50): only when the
// data CHANGED, never under an open Month phase select or an open plan form,
// and never at the cost of keyboard focus. These drive the real index.html
// against the stateful Supabase mock, getting to `synced` the way a real device
// can: the first allow-list read fails (a blip, so the mode is "checking") and
// the next visibilitychange retries it.
//
// Isolation: every test() is a fresh scenario (new server, new browser context,
// empty storage), with the clock pinned to the F1 fixture's Tuesday.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend } = require('./lib/supabase-mock');
const { KEYS, F1, serverRows, canonical } = require('./lib/calendar-fixtures');

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const fire = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const NEW_PLAN = { id: 'new1', plan_date: '2026-11-26', disc: 'swim', title: 'Added elsewhere', intensity: 'easy', duration: 30, is_key: false, notes: '', phase: 'build1' };

// A device that is signed in, holds F1 in its cache, and whose server holds F1
// plus whatever `change` adds. The first allow-list read fails once.
async function checkingDevice(change) {
  const backend = new Backend({ imported: true });
  const rows = serverRows(F1);
  Object.keys(rows).forEach((t) => backend.seed(t, rows[t]));
  if (change) change(backend);
  backend.inject((i) => i.table === 'allowed_users', { status: 503, body: { message: 'blip' } }, { times: 1 });
  const fx = canonical(F1);
  const s = await scenario(browser, {
    backend, signedIn: true,
    localStorage: { [KEYS.log]: fx.log, [KEYS.plan]: fx.plan, [KEYS.races]: fx.races, [KEYS.phases]: fx.phases },
  });
  await s.page.clock.setFixedTime(new Date(F1.now));
  await s.open();
  await s.page.waitForSelector('#calendar-h');
  await s.settle(500);
  assert.ok((await s.accountText()).startsWith('Signed in'), 'checking, not yet synced: ' + (await s.accountText()));
  return s;
}
async function toSynced(s) {
  await fire(s.page);
  await s.page.waitForFunction(() => /^Synced/.test(document.getElementById('cal-account-line').textContent));
  await s.page.waitForTimeout(500);
}

describe("entering synced repaints under the Calendar's own rules", () => {
  test('unchanged data: the Calendar is not rebuilt and keyboard focus stays', async () => {
    const s = await checkingDevice();
    try {
      await s.page.$eval('.cal-chip[data-date="2026-11-25"]', (n) => n.setAttribute('data-keep', 'same'));
      await s.page.focus('.cal-chip[data-date="2026-11-25"]');
      await toSynced(s);
      assert.ok(await s.page.$('.cal-chip[data-keep="same"]'), 'the same chip node survived');
      assert.strictEqual(await s.page.evaluate(() => document.activeElement.getAttribute('data-keep')), 'same');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });

  test('changed data: the Calendar redraws, and focus is restored to the same chip', async () => {
    const s = await checkingDevice((b) => b.seed('plan_sessions', [NEW_PLAN]));
    try {
      await s.page.$eval('.cal-chip[data-date="2026-11-25"]', (n) => n.setAttribute('data-keep', 'old'));
      await s.page.focus('.cal-chip[data-date="2026-11-25"]');
      await toSynced(s);
      assert.strictEqual(await s.page.$('.cal-chip[data-keep="old"]'), null, 'the Calendar was rebuilt');
      assert.strictEqual(await s.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-date')), '2026-11-25', 'focus is on the twin of the chip it was on');
      await s.page.click('.cal-chip[data-date="2026-11-26"]');
      assert.deepStrictEqual(await s.page.$$eval('.cal-card-title', (ns) => ns.map((n) => n.textContent)), ['Swim — Added elsewhere']);
    } finally { await s.close(); }
  });

  test('a Month phase select open when the device syncs is held; the new data lands when it closes', async () => {
    const s = await checkingDevice((b) => b.seed('phase_blocks', [{ id: 'other', from_date: '2026-11-09', phase: 'taper' }]));
    try {
      await s.page.click('#cal-tab-month');
      await s.page.click('[aria-label="Edit the phase for the week of Mon 9 Nov"]');
      await s.page.waitForSelector('.race-cal-phase-select');
      await s.page.$eval('.race-cal-phase-select', (n) => n.setAttribute('data-held', '1'));
      await toSynced(s);
      assert.ok(await s.page.$('.race-cal-phase-select[data-held="1"]'), 'the select the athlete is using was not rebuilt');
      const during = await s.page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
      assert.ok(!during.some((l) => l.startsWith('Taper')), 'held, not half-redrawn: ' + JSON.stringify(during));
      await s.page.keyboard.press('Escape');
      const after = await s.page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
      assert.ok(after.some((l) => l.startsWith('Taper')), 'landed on close: ' + JSON.stringify(after));
    } finally { await s.close(); }
  });

  test('an open plan form is not redrawn under the athlete when the device syncs', async () => {
    const s = await checkingDevice((b) => b.seed('plan_sessions', [NEW_PLAN]));
    try {
      // The Calendar's Add opens the Plan view, with its add form, on that day.
      await s.page.click('.cal-chip[data-date="2026-11-27"]');
      await s.page.click('.cal-card-edit');
      await s.page.waitForSelector('#view-plan:not([hidden]) .plan-form');
      const title = '#view-plan .plan-form input[type=text]';
      await s.page.fill(title, 'half typed');
      await toSynced(s);
      assert.strictEqual(await s.page.inputValue(title), 'half typed', 'the typed value survived the sync repaint');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });

  test('a race form open with typed text is not redrawn under the athlete when the device syncs', async () => {
    const s = await checkingDevice((b) => b.seed('races', [{ id: 'rnew', name: 'From The Phone', race_date: '2031-09-09', url: '', notes: '', status: 'locked' }]));
    try {
      await s.page.click('#tab-races');
      await s.page.click('.race-add-toggle');
      const nameSel = '#view-races form input[type=text]';
      await s.page.waitForSelector(nameSel);
      await s.page.fill(nameSel, 'half typed race');
      await toSynced(s);
      assert.strictEqual(await s.page.inputValue(nameSel), 'half typed race', 'the race form was not rebuilt');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });
});
