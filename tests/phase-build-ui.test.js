'use strict';
// "Plan back from a race" driven through the real UI (CLAUDE.md decision 43).
//
// Runs against the shipped index.html over http, with only the Apps Script URL
// blanked so a live Sheet fetch can't overwrite the seeded scenario mid-test.
// No test hook lives in the shipped file.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { serveApp, chromiumPath } = require('./lib/app');

const RACES = [
  { id: 'r1', name: 'Nepean Tri', date: '2026-10-17', status: 'locked', url: '', notes: '' },
  { id: 'r2', name: 'Huskisson 70.3', date: '2027-02-20', status: 'considering', url: '', notes: '' },
];
// A legacy block outside the span the build covers, plus one inside it — so the
// keep/replace split and the warning count are both exercised.
const PLAN = [
  { id: 'legacy', from: '2020-01-01', phase: 'base' },
  { id: 'mid', from: '2026-08-15', phase: 'peak' },
];

describe('plan back from a race', { concurrency: false }, () => {
  let server, browser, ctx, page, errors;

  before(async () => {
    server = await serveApp();
    browser = await chromium.launch({ executablePath: chromiumPath() });
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // Seed once, not per navigation: addInitScript re-runs on reload, and
    // re-seeding would undo the empty-races case at the end.
    await page.addInitScript(
      ([races, plan]) => {
        if (localStorage.getItem('__seeded')) return;
        localStorage.setItem('__seeded', '1');
        localStorage.setItem('triMomentumRaces_v1', JSON.stringify(races));
        localStorage.setItem('triMomentumPhasePlan_v1', JSON.stringify(plan));
      },
      [RACES, PLAN]
    );
    await page.goto(server.origin);
    await page.waitForTimeout(400);
  });

  after(async () => {
    await browser.close();
    await server.close();
  });

  const openBuilder = async () => {
    await page.click('#tab-races');
    await page.waitForTimeout(250);
    await page.click('.race-cal .dash-signal-link');
    await page.waitForTimeout(300);
  };
  const rows = () =>
    page.$$eval('#phasebuild-preview .plan-item', (ns) =>
      ns.map((n) => ({
        pill: n.querySelector('.month-week-pill').textContent,
        name: n.querySelector('.phasebuild-row-name').textContent,
        meta: n.querySelector('.phasebuild-row-span').textContent,
      }))
    );
  const storedPlan = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('triMomentumPhasePlan_v1')));

  test('the Races calendar offers both phase links', async () => {
    await page.click('#tab-races');
    await page.waitForTimeout(250);
    const links = await page.$$eval('.race-cal .dash-signal-link', (ns) => ns.map((n) => n.textContent));
    assert.deepStrictEqual(links, ['Plan back from a race →', 'Edit phase plan →']);
  });

  test('the builder opens without the check-in flow rendering underneath', async () => {
    await openBuilder();
    assert.ok(await page.isVisible('#view-phasebuild'));
    assert.ok(await page.isHidden('#view-races'));
    assert.ok(await page.isHidden('#view-flow'));
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'phasebuild-h');
  });

  test('it preselects the nearest upcoming race and sensible defaults', async () => {
    const weeks = await page.$$eval('.phasebuild-week input', (ns) => ns.map((n) => n.value));
    assert.deepStrictEqual(weeks, ['4', '4', '4', '3']);
    const sel = await page.$eval('#phasebuild-race', (n) => n.options[n.selectedIndex].textContent);
    assert.ok(sel.startsWith('Nepean Tri'), sel);
    assert.strictEqual(await page.$$eval('#phasebuild-race option', (n) => n.length), 2);
  });

  test('the preview shows the whole cycle plus the post-race block', async () => {
    const r = await rows();
    assert.strictEqual(r.length, 5);
    assert.strictEqual(r[3].pill, 'Peak');
    assert.strictEqual(r[3].name, 'Mon 28 Sep – Sun 18 Oct');
    assert.strictEqual(r[3].meta, '3 weeks · ends race week');
    assert.strictEqual(r[4].meta, 'Ongoing · after the race');
    // The pill carries the phase name; the row body must not repeat it.
    assert.ok(r.every((x) => !x.name.includes(x.pill)));
  });

  test('it names the exact blocks it will replace, before the button is pressed', async () => {
    const warn = await page.textContent('.phasebuild-warn');
    assert.match(warn, /replaces 1 phase block /);
    assert.ok(warn.includes('Mon 6 Jul') && warn.includes('Mon 19 Oct'), warn);
  });

  test('typing a week count recomputes without stealing focus', async () => {
    await page.click('#phasebuild-w-peak');
    await page.fill('#phasebuild-w-peak', '5');
    await page.waitForTimeout(150);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'phasebuild-w-peak');
    const r = await rows();
    assert.strictEqual(r[3].meta, '5 weeks · ends race week');
    assert.ok(r[3].name.startsWith('Mon 14 Sep'), r[3].name);
    await page.fill('#phasebuild-w-peak', '3');
    await page.waitForTimeout(150);
  });

  test('week counts clamp, and the clamped value is written back on change', async () => {
    await page.fill('#phasebuild-w-base', '99');
    await page.waitForTimeout(150);
    assert.ok((await rows())[0].meta.startsWith('26 weeks'));
    await page.$eval('#phasebuild-w-base', (n) => n.blur());
    await page.waitForTimeout(150);
    assert.strictEqual(await page.inputValue('#phasebuild-w-base'), '26');
    await page.fill('#phasebuild-w-base', '4');
    await page.waitForTimeout(150);
  });

  test('with nothing to add the action is hidden, not a dead button', async () => {
    for (const k of ['base', 'build1', 'build2', 'peak']) await page.fill('#phasebuild-w-' + k, '0');
    await page.waitForTimeout(200);
    assert.ok(await page.isVisible('.phasebuild-empty'));
    assert.strictEqual((await rows()).length, 0);
    assert.ok(await page.isHidden('#phasebuild-actions'));
    await page.fill('#phasebuild-w-base', '4');
    await page.fill('#phasebuild-w-build1', '4');
    await page.fill('#phasebuild-w-build2', '4');
    await page.fill('#phasebuild-w-peak', '3');
    await page.waitForTimeout(200);
    assert.ok(await page.isVisible('#phasebuild-actions'));
  });

  test('the post-race toggle adds and removes its block', async () => {
    await page.uncheck('.phasebuild-toggle input');
    await page.waitForTimeout(150);
    let r = await rows();
    assert.strictEqual(r.length, 4);
    assert.strictEqual(r[3].pill, 'Peak');
    await page.check('.phasebuild-toggle input');
    await page.waitForTimeout(150);
    assert.strictEqual((await rows()).length, 5);
  });

  test('switching race re-dates the whole cycle', async () => {
    await page.selectOption('#phasebuild-race', 'r2');
    await page.waitForTimeout(150);
    assert.strictEqual((await rows())[3].name, 'Mon 1 Feb – Sun 21 Feb');
    await page.selectOption('#phasebuild-race', 'r1');
    await page.waitForTimeout(150);
  });

  test('applying keeps blocks outside the span and replaces those inside it', async () => {
    await page.click('#phasebuild-actions .btn-primary');
    await page.waitForTimeout(350);
    assert.ok(await page.isVisible('#view-phaseplan'));
    assert.ok(await page.isHidden('#view-phasebuild'));
    assert.match(await page.textContent('#live'), /Nepean Tri/);

    const plan = await storedPlan();
    assert.ok(plan.some((b) => b.from === '2020-01-01'), 'legacy block was dropped');
    assert.ok(!plan.some((b) => b.from === '2026-08-15'), 'in-span block survived');
    assert.strictEqual(plan.length, 6);
    assert.strictEqual(new Set(plan.map((b) => b.from)).size, plan.length, 'duplicate dates written');
    assert.strictEqual(new Set(plan.map((b) => b.id)).size, plan.length, 'duplicate ids written');

    const dates = await page.$$eval('.phaseplan-row', (ns) => ns.map((n) => n.querySelector('.phaseplan-date').value));
    assert.deepStrictEqual(dates, [
      '2020-01-01', '2026-07-06', '2026-08-03', '2026-08-31', '2026-09-28', '2026-10-19',
    ]);
  });

  test('undo restores the previous plan exactly', async () => {
    assert.ok(await page.isVisible('.phasebuild-undo'));
    await page.click('.phasebuild-undo button');
    await page.waitForTimeout(250);
    assert.deepStrictEqual(await storedPlan(), PLAN);
    assert.strictEqual(await page.$('.phasebuild-undo'), null);
  });

  test('a hand edit drops the stale undo', async () => {
    // Restoring a pre-build snapshot over edits made since would discard them.
    await openBuilder();
    await page.click('#phasebuild-actions .btn-primary');
    await page.waitForTimeout(350);
    assert.ok(await page.isVisible('.phasebuild-undo'));
    await page.selectOption('.phaseplan-row .phaseplan-select', 'peak');
    await page.waitForTimeout(250);
    assert.strictEqual(await page.$('.phasebuild-undo'), null);
  });

  test('with no upcoming race it explains itself instead of showing a dead form', async () => {
    await page.evaluate(() => localStorage.setItem('triMomentumRaces_v1', '[]'));
    await page.reload();
    await page.waitForTimeout(400);
    await openBuilder();
    assert.match(await page.textContent('.phasebuild-empty'), /no upcoming races/);
    assert.strictEqual(await page.$('#phasebuild-race'), null);
    assert.strictEqual(await page.textContent('#view-phasebuild .dash-signal-link'), 'Go to races →');
  });

  test('no page errors were raised at any point', () => {
    assert.deepStrictEqual(errors, []);
  });
});
