'use strict';
// Regression coverage for the phasePlan Sheet sync (CLAUDE.md decision 48),
// added after a fresh incognito window showed "UNSET" for every week — the
// Races calendar's per-week phase never left the device it was set on.
//
// phasePlan carries an invariant Races/Plan never had to deal with: once
// any block exists there must always be at least one (deletePhaseBlock
// refuses to remove the last one). That makes an *empty* Sheet response
// ambiguous — "nothing planned yet" and "this device has real blocks the
// Sheet doesn't know about yet" look identical — so the sync has to push
// local data up rather than pull an empty response down whenever local has
// something real. These tests prove that fork against the real shipped
// index.html, with the Sheet's ?phases=1 response mocked at the http layer
// (see serveApp's `routes` option in lib/app.js) rather than reimplemented.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { serveApp, chromiumPath } = require('./lib/app');

const LOCAL_PLAN = [
  { id: 'local1', from: '2020-01-01', phase: 'base' },
  { id: 'local2', from: '2026-09-01', phase: 'peak' },
];
// 'from' dates are anchored safely in the past/future relative to any real
// calendar date this suite could run on, so the assertions below don't
// depend on knowing what "today" actually is in CI.
const SHEET_PLAN = [
  { id: 'sheet1', from: '2000-01-01', phase: 'build1' },
  { id: 'sheet2', from: '2099-01-01', phase: 'taper' },
];

async function launch(routes) {
  const server = await serveApp({ routes });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { server, browser, page, errors };
}

describe('phase plan sync — an empty Sheet response never wipes a real local plan', { concurrency: false }, () => {
  let server, browser, page, errors;

  before(async () => {
    ({ server, browser, page, errors } = await launch({
      'phases=1': JSON.stringify({ ok: true, phases: [] }),
    }));
    await page.addInitScript((plan) => {
      localStorage.setItem('triMomentumPhasePlan_v1', JSON.stringify(plan));
    }, LOCAL_PLAN);
    await page.goto(server.origin);
    await page.waitForTimeout(400);
  });

  after(async () => {
    await browser.close();
    await server.close();
  });

  test('the local phasePlan is untouched, not wiped to empty', async () => {
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('triMomentumPhasePlan_v1')));
    assert.deepStrictEqual(stored, LOCAL_PLAN, 'an empty Sheet response must not overwrite a real local plan');
  });

  test('the one-time push flag is set, so this device does not keep re-pushing every refresh', async () => {
    const flag = await page.evaluate(() => localStorage.getItem('triMomentumPhaseSynced_v1'));
    assert.strictEqual(flag, '1');
  });

  test('Check-in does not show the phase picker — a real phase is still in effect', async () => {
    await page.click('#tab-flow');
    await page.waitForTimeout(150);
    const pickerHidden = await page.$eval('#view-period', (el) => el.hidden);
    assert.strictEqual(pickerHidden, true, 'state.periodisation should still resolve from the untouched local plan');
  });

  test('no page errors were raised', async () => {
    assert.deepStrictEqual(errors, []);
  });
});

describe('phase plan sync — a real Sheet response reaches a fresh device', { concurrency: false }, () => {
  let server, browser, page, errors;

  before(async () => {
    ({ server, browser, page, errors } = await launch({
      'phases=1': JSON.stringify({ ok: true, phases: SHEET_PLAN }),
    }));
    // No addInitScript here — this is the incognito-window case: nothing in
    // localStorage yet, exactly what surfaced the bug.
    await page.goto(server.origin);
    await page.waitForTimeout(400);
  });

  after(async () => {
    await browser.close();
    await server.close();
  });

  test('the fetched blocks land in localStorage', async () => {
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('triMomentumPhasePlan_v1')));
    assert.deepStrictEqual(stored, SHEET_PLAN);
  });

  test('the one-time push flag is set (nothing left to push once a real plan arrived)', async () => {
    const flag = await page.evaluate(() => localStorage.getItem('triMomentumPhaseSynced_v1'));
    assert.strictEqual(flag, '1');
  });

  test('Check-in does not show the phase picker — the synced plan reached state.periodisation, not just storage', async () => {
    await page.click('#tab-flow');
    await page.waitForTimeout(150);
    const pickerHidden = await page.$eval('#view-period', (el) => el.hidden);
    assert.strictEqual(pickerHidden, true, 'a freshly-synced plan should resolve a phase for today just like a locally-set one would');
  });

  test('no page errors were raised', async () => {
    assert.deepStrictEqual(errors, []);
  });
});
