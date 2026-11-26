'use strict';
// Regression coverage for the phasePlan sync (CLAUDE.md decisions 48 and 51),
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
// AC-I7 (CLAUDE.md decision 51): the silent push-once of decision 48 is replaced
// by the explicit device import; the device-import flag is
// triMomentumDeviceImported_sb_v1 (value = auth user id).
//
// Isolation: each test() is a fresh scenario (new server, new browser context,
// empty storage). Where a test reloads inside its scenario it is testing
// persistence of the flag, and says so.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend } = require('./lib/supabase-mock');
const { exposeHandle } = require('./lib/handle');

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

const DISCARD_SENTENCE = "Discard shows your account's data on this device now. Rows held only on this device are removed from it.";
const ACCOUNT_WINS = 'Your account already has a phase plan, so these are not added.';
const phaseLines = (page) => page.$$eval('#import-phases li', (n) => n.map((x) => x.textContent));
const periodisation = (page) => page.evaluate(() => window.__t.state.periodisation);
const DEVICE_FLAG = 'triMomentumDeviceImported_sb_v1';
async function dialogOpen(page) { return page.$eval('#import-dialog', (d) => d.open); }
async function waitDevicePreview(page) {
  await page.waitForSelector('#import-dialog[open] #import-go:text-is("Add to my account")', { timeout: 8000 });
}

// AC-I7. The decision-48 silent auto-push is gone: a device's first signed-in
// read is held until the owner has chosen Add or Discard for what only that
// device holds. "An empty read never replaces a non-empty local plan" stays.
describe('phase plan sync — a device holding a plan the account lacks asks before anything is read (AC-I7)', () => {
  test('first device (empty account): the dialog opens with only the device source; nothing is pushed, the plan and the flag are untouched, no read replaces anything', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      await waitDevicePreview(s.page);
      assert.strictEqual(await s.page.$eval('#import-url', (n) => n.closest('#import-source').hidden), true, 'no Sheet field in the device dialog');
      assert.match(await s.page.textContent('#import-counts'), /Phase blocksThis device 2 · Already in your account 0 · New 2/);
      assert.strictEqual(posts(b).length, 0, 'nothing is written before the owner chooses');
      assert.deepStrictEqual(await phaseLines(s.page), ['Wed 1 Jan: Base', 'Tue 1 Sep: Peak'], "the device's phase blocks are listed by date and phase");
      assert.strictEqual(await s.page.$eval('#import-phases-note', (n) => n.hidden), true, 'no "account wins" line when the account has no plan');
      assert.ok((await s.page.textContent('#import-note')).includes(DISCARD_SENTENCE), 'the Discard sentence, exactly, in device mode');
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN);
      assert.strictEqual(await s.ls(DEVICE_FLAG), null, 'not decided yet');
      assert.strictEqual(await s.page.$eval('#cal-account-review-btn', (n) => n.offsetParent !== null), true, 'a way back to the dialog exists');
      assert.deepStrictEqual(s.errors, []); assert.deepStrictEqual(await s.unhandled(), []); assert.deepStrictEqual(s.guard.blocked, []);
    } finally { await s.close(); }
  });

  test('first device, Add: the plan is written once (the account had none), the flag is set to the user id, the plan is kept, and Check-in shows no phase picker', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 8000 });
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => [r.id, r.from_date, r.phase]), LOCAL_PLAN.map((p) => [p.id, p.from, p.phase]));
      assert.strictEqual(b.rows('sheet_import').length, 1, 'no second marker, and the existing one is untouched');
      assert.strictEqual(await s.ls(DEVICE_FLAG), b.userId);
      await s.page.click('#import-go'); await s.settle(400);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN);
      await startUnplannedCheckIn(s.page);
      assert.strictEqual(await pickerHidden(s.page), true);
      assert.strictEqual(await flowShowing(s.page), true);
      await s.page.reload(); await s.settle(600);
      assert.strictEqual(posts(b).length, 1, 'a reload sends nothing more');
      assert.strictEqual(await dialogOpen(s.page), false);
    } finally { await s.close(); }
  });

  test('Discard: nothing is written, the flag is set, and an EMPTY account read still never wipes the local plan (decision 48 kept)', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      await s.page.click('#import-discard'); await s.settle(500);
      assert.strictEqual(await dialogOpen(s.page), false);
      assert.strictEqual(posts(b).length, 0);
      assert.strictEqual(await s.ls(DEVICE_FLAG), b.userId);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN, 'the empty read did not replace a non-empty plan');
      assert.strictEqual(await s.page.$('#cal-account-review-btn') === null, true, 'the review button is gone once decided');
      assert.strictEqual(await s.page.evaluate(() => document.activeElement.id), 'calendar-h');
      // Lost in the Supabase port, restored: the surviving plan reached state.periodisation (no picker gates a check-in) and nothing threw.
      await startUnplannedCheckIn(s.page);
      assert.strictEqual(await pickerHidden(s.page), true, 'no phase picker: the plan really resolved');
      assert.strictEqual(await flowShowing(s.page), true);
      assert.deepStrictEqual(s.errors, [], 'no page errors');
      assert.deepStrictEqual(await s.unhandled(), []);
    } finally { await s.close(); }
  });

  test('account holds a different plan: until Add or Discard the cache is NOT replaced; Discard then lets the next read replace it', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN, 'held');
      assert.strictEqual(b.requests.filter((r) => r.table === 'phase_blocks' && r.query.get('select') === 'id,from_date,phase').length, 0, 'no full read of phase_blocks while held');
      await s.page.keyboard.press('Escape'); await s.settle(300);
      await s.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await s.settle(500);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN, 'still held after Not now and a refresh');
      await s.page.click('#cal-account-review-btn'); await waitDevicePreview(s.page);
      await s.page.click('#import-discard'); await s.settle(600);
      assert.deepStrictEqual((await s.lsJson('triMomentumPhasePlan_v1')).map((p) => p.id), ['srv1', 'srv2']);
    } finally { await s.close(); }
  });

  test('account already has a phase plan, Add: the device\'s blocks are listed and NOT added; the account\'s plan wins and today\'s phase is the account\'s', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true, transform: exposeHandle, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    // What a device that only ever had the account's plan shows for today: the reference.
    const ref = await scenario(browser, { backend: new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN), signedIn: true, transform: exposeHandle });
    try {
      await ref.open(); await ref.settle(600);
      const accountPhase = await periodisation(ref.page);
      assert.strictEqual(accountPhase, 'build1', 'fixture: the account resolves to build1 today');
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      assert.strictEqual(await periodisation(s.page), 'peak', 'fixture: the stale device plan resolves differently while held');
      assert.deepStrictEqual(await phaseLines(s.page), ['Wed 1 Jan: Base', 'Tue 1 Sep: Peak']);
      assert.strictEqual(await s.page.textContent('#import-phases-note'), ACCOUNT_WINS);
      assert.strictEqual(await s.page.$eval('#import-phases-note', (n) => n.hidden), false);
      assert.match(await s.page.textContent('#import-counts'), /Phase blocksThis device 2 · Already in your account 0 · New 0 · Not added 2/);
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 8000 });
      await s.page.click('#import-go'); await s.settle(600);
      assert.strictEqual(posts(b).length, 0, 'no phase block is written');
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => r.id).sort(), ['srv1', 'srv2']);
      assert.deepStrictEqual((await s.lsJson('triMomentumPhasePlan_v1')).map((p) => p.id).sort(), ['srv1', 'srv2']);
      assert.strictEqual(await periodisation(s.page), accountPhase, "after Add, today's phase is the account's, not the stale device plan's");
    } finally { await s.close(); await ref.close(); }
  });

  test('account already has a phase plan and the device has OTHER new rows: Add writes those rows and still no phase block', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const race = { id: 'r-local', name: 'Local race', date: '2026-12-05', url: '', notes: '', status: 'locked' };
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN, triMomentumRaces_v1: [race] } });
    try {
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 8000 });
      assert.deepStrictEqual(b.rows('races').map((r) => r.id), ['r-local']);
      assert.strictEqual(posts(b).length, 0);
    } finally { await s.close(); }
  });

  test('a device with nothing the account lacks sets the flag silently: no dialog, and the account\'s plan arrives', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await dialogOpen(s.page), false);
      assert.strictEqual(await s.ls(DEVICE_FLAG), b.userId);
      assert.deepStrictEqual((await s.lsJson('triMomentumPhasePlan_v1')).map((p) => p.id), ['srv1', 'srv2']);
    } finally { await s.close(); }
  });

  test('rows the account already has (same ids) are not "new": a device that is merely behind sets the flag silently', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', [{ id: 'local1', from_date: '2020-01-01', phase: 'base' }, { id: 'local2', from_date: '2026-09-01', phase: 'peak' }]);
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await dialogOpen(s.page), false);
      assert.strictEqual(await s.ls(DEVICE_FLAG), b.userId);
      assert.strictEqual(posts(b).length, 0);
    } finally { await s.close(); }
  });

  test('a flag left by a different user does not count', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN, [DEVICE_FLAG]: 'someone-else' } });
    try {
      await s.open(); await s.settle(600); await waitDevicePreview(s.page);
      assert.strictEqual(posts(b).length, 0);
    } finally { await s.close(); }
  });

  test('a failed account read keeps the device held (no dialog, no replace) and retries on the next refresh', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const rule = b.inject((i) => i.table === 'races' && i.method === 'GET', { status: 500, body: { message: 'down' } });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await dialogOpen(s.page), false);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), LOCAL_PLAN);
      b.rules.splice(b.rules.indexOf(rule), 1);
      await s.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await s.settle(800);
      await waitDevicePreview(s.page);
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
      assert.strictEqual(posts(b).length, 0, 'nothing to push once a real plan arrived');
      await startUnplannedCheckIn(s.page);
      assert.strictEqual(await pickerHidden(s.page), true, 'the synced plan reached state.periodisation, not just storage');
      assert.strictEqual(await flowShowing(s.page), true, 'the check-in flow itself is showing, so the picker really was skipped');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });

  test('a server plan replaces a different local plan (the server is the source of truth once it has data)', async () => {
    const b = new Backend({ imported: true }).seed('phase_blocks', SERVER_PLAN);
    const s = await scenario(browser, { backend: b, signedIn: true, deviceDecided: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
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
      assert.strictEqual(await s.ls(DEVICE_FLAG), null);
    } finally { await s.close(); }
  });

  test('import pending: nothing is pushed or read for the device before the import (the import itself carries the device rows)', async () => {
    const b = new Backend();   // permitted, not yet imported
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumPhasePlan_v1: LOCAL_PLAN } });
    try {
      await s.open(); await s.settle(500);
      assert.strictEqual(posts(b).length, 0);
      assert.strictEqual(await s.ls(DEVICE_FLAG), null);
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
