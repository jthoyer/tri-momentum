'use strict';
// Regression coverage for the phasePlan sync (CLAUDE.md decisions 48 and 49),
// ported from the Google Sheet to Supabase mocks. Added after a fresh incognito
// window showed "UNSET" for every week — the Races calendar's per-week phase
// never left the device it was set on.
//
// phasePlan carries an invariant Races/Plan never had to deal with: once any
// block exists there must always be at least one (deletePhaseBlock refuses to
// remove the last one). That makes an *empty* server response ambiguous —
// "nothing planned yet" and "this device has real blocks the server doesn't
// know about yet" look identical — so the sync has to push local data up rather
// than pull an empty response down whenever local has something real. These
// tests prove that fork against the real shipped index.html and a stateful
// PostgREST mock (tests/lib/supabase-mock.js).
//
// AC19: the push-once flag is a NEW key (triMomentumPhaseSynced_sb_v1), so the
// Sheet-era flag (triMomentumPhaseSynced_v1) has no effect on it.
//
// Isolation: each test() is a fresh scenario (new server, new browser context,
// empty storage). Where a test reloads inside its scenario it is testing
// persistence of the flag, and says so.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend } = require('./lib/supabase-mock');

const LOCAL_PLAN = [
  { id: 'local1', from: '2020-01-01', phase: 'base' },
  { id: 'local2', from: '2026-09-01', phase: 'peak' },
];
// Anchored safely in the past/future relative to any real calendar date this
// suite could run on, so the assertions don't depend on knowing "today".
const SERVER_PLAN = [
  { id: 'srv1', from_date: '2000-01-01', phase: 'build1' },
  { id: 'srv2', from_date: '2099-01-01', phase: 'taper' },
];
const NEW_FLAG = 'triMomentumPhaseSynced_sb_v1';
const OLD_FLAG = 'triMomentumPhaseSynced_v1';

// Decision 50 moved the phase gate from the Check-in tab to the *start of a
// check-in*: tapping Check-in now always shows the Calendar, whatever the phase.
// "The picker is hidden after tapping #tab-flow" therefore proves nothing about
// whether a phase resolved. What does is starting a check-in — "Log an
// unplanned session" under today's cards — and seeing whether the picker
// gates it. These helpers are that proof, used by the checks below.
async function startUnplannedCheckIn(page) {
  await page.click('#tab-flow');
  await page.waitForTimeout(100);
  await page.click('.cal-unplanned');
  await page.waitForTimeout(150);
}
async function pickerHidden(page) {
  return page.$eval('#view-period', (el) => el.hidden);
}
async function flowShowing(page) {
  return page.$eval('#view-flow', (el) => !el.hidden);
}

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const posts = (b) => b.requests.filter((r) => r.table === 'phase_blocks' && r.method === 'POST');

describe('phase plan sync — an empty server response never wipes a real local plan', () => {
  test('the local phasePlan is untouched; it is pushed up once; the new flag is set; Check-in shows no phase picker', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN, 'an empty read must not overwrite a real local plan');
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => [r.id, r.from_date, r.phase]), LOCAL_PLAN.map((p) => [p.id, p.from, p.phase]), 'the local plan was pushed up');
      assert.strictEqual(await s.ls(NEW_FLAG), '1', 'the push-once flag is set');
      await startUnplannedCheckIn(s.page);
      assert.strictEqual(await pickerHidden(s.page), true, 'state.periodisation still resolves from the untouched local plan');
      assert.strictEqual(await flowShowing(s.page), true, 'the check-in flow itself is showing, so the picker really was skipped');
      assert.deepStrictEqual(s.errors, []);
      assert.deepStrictEqual(await s.unhandled(), []);
      assert.deepStrictEqual(s.guard.blocked, []);
    } finally { await s.close(); }
  });

  test('the push happens once per device: a reload (flag persisted on purpose) sends nothing more', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(posts(b).length, 1);
      await s.page.reload(); await s.settle(600);
      assert.strictEqual(posts(b).length, 1, 'no second push');
      assert.strictEqual(b.rows('phase_blocks').length, 2, 'and no duplicate rows');
    } finally { await s.close(); }
  });

  test('the Sheet-era flag does not count: with only the OLD flag set, the plan is still pushed', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN, [OLD_FLAG]: '1' } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(posts(b).length, 1, 'pushed despite triMomentumPhaseSynced_v1');
      assert.strictEqual(await s.ls(NEW_FLAG), '1');
    } finally { await s.close(); }
  });

  test('a push that failed leaves the flag unset, so the next load tries again', async () => {
    const b = new Backend({ imported: true });
    const rule = b.inject((i) => i.table === 'phase_blocks' && i.method === 'POST', { status: 500, body: { message: 'down' } });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await s.ls(NEW_FLAG), null, 'not marked pushed');
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN, 'and still not wiped');
      assert.ok(s.warns().some((w) => /phase push of the local plan was not saved/.test(w)));
      b.rules.splice(b.rules.indexOf(rule), 1);
      await s.page.reload(); await s.settle(600);   // persistence is the point
      assert.strictEqual(b.rows('phase_blocks').length, 2);
      assert.strictEqual(await s.ls(NEW_FLAG), '1');
    } finally { await s.close(); }
  });

  test('empty server, empty local: nothing is pushed and nothing is invented', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(posts(b).length, 0);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), []);
    } finally { await s.close(); }
  });
});

describe('phase plan sync — a real server response reaches a fresh device', () => {
  test('the fetched blocks land in localStorage and state.periodisation; the flag is set; no phase picker', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true });   // nothing in localStorage: the incognito-window case
    try {
      await s.open(); await s.settle(600);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), SERVER_PLAN.map((r) => ({ id: r.id, from: r.from_date, phase: r.phase })));
      assert.strictEqual(await s.ls(NEW_FLAG), '1');
      assert.strictEqual(posts(b).length, 0, 'nothing to push once a real plan arrived');
      await startUnplannedCheckIn(s.page);
      assert.strictEqual(await pickerHidden(s.page), true, 'the synced plan reached state.periodisation, not just storage');
      assert.strictEqual(await flowShowing(s.page), true, 'the check-in flow itself is showing, so the picker really was skipped');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });

  test('a server plan replaces a different local plan (the server is the source of truth once it has data)', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.deepStrictEqual((await s.lsJson('triMomentumPhasePlan_v1')).map((p) => p.id), ['srv1', 'srv2']);
    } finally { await s.close(); }
  });
});

describe('phase plan sync — local-only modes leave the plan alone', () => {
  test('signed out: no push, no read, the plan is not touched', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: false, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(500);
      assert.strictEqual(b.requests.filter((r) => r.rest).length, 0);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN);
      assert.strictEqual(await s.ls(NEW_FLAG), null);
    } finally { await s.close(); }
  });

  test('import pending: the one-time push waits for the switch to synced (so it can\'t race the import)', async () => {
    const b = new Backend();   // permitted, not yet imported
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(500);
      assert.strictEqual(posts(b).length, 0);
      assert.strictEqual(await s.ls(NEW_FLAG), null);
    } finally { await s.close(); }
  });
});

// The counter-case that makes the two gate checks above discriminate. With no
// phase anywhere (nothing local, nothing on the server) the Calendar still
// opens and Check-in still shows it — but starting a check-in is gated by the
// picker. If a check above passed no matter what the phase was, this describe
// is where that would show: the very same helpers must come out the other way.
describe('phase plan sync — with no phase anywhere, the picker gates the start of a check-in, not the Calendar', () => {
  test('the Calendar shows on boot and after tapping Check-in, picker hidden; "Log an unplanned session" opens the picker; choosing a phase lands in the flow', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await s.page.$eval('#view-calendar', (el) => !el.hidden), true);
      assert.strictEqual(await pickerHidden(s.page), true);
      await s.page.click('#tab-flow'); await s.page.waitForTimeout(100);
      assert.strictEqual(await s.page.$eval('#view-calendar', (el) => !el.hidden), true, 'Check-in shows the Calendar');
      assert.strictEqual(await pickerHidden(s.page), true, 'the Check-in tab no longer opens the picker');
      await s.page.click('.cal-unplanned'); await s.page.waitForTimeout(150);
      assert.strictEqual(await pickerHidden(s.page), false, 'no phase resolved, so the picker gates the check-in');
      assert.strictEqual(await flowShowing(s.page), false);
      await s.page.click('#period-choices .choice:has-text("Base")'); await s.page.waitForTimeout(150);
      assert.strictEqual(await pickerHidden(s.page), true);
      assert.strictEqual(await flowShowing(s.page), true);
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });
});
