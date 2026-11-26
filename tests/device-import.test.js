'use strict';
// AC-I7 for check-ins, and the AC-C3 invariant (decision 29): a1, a2, a3, rpe, b2
// and b3 are only ever the athlete's own answers, through every entry point,
// including the ones that arrived with the Supabase work (device import, outbox
// flush, synced read). Real index.html, the stateful Supabase mock, synthetic
// data. Isolation: every test() is a fresh scenario (new server, new browser
// context, empty storage); two-device tests share only the Backend object.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend } = require('./lib/supabase-mock');
const { exposeHandle } = require('./lib/handle');

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const FLAG = 'triMomentumDeviceImported_sb_v1';
const entry = (date, extra) => Object.assign({ date, disc: 'swim', intensity: 'easy', duration: 60, rpe: 5, a1: 'intent', a2: 'planned', a3: null, b2: 'good', b3: 'none', note: '', phase: 'base', loggedAt: null }, extra);
const canon = (e) => JSON.stringify([e.date, e.disc, e.duration, e.intensity, e.rpe, e.a1, e.a2, e.a3, e.b2, e.b3, e.note || '', e.phase || null]);
const idFor = (e, n) => 'sheet-' + crypto.createHash('sha256').update(canon(e)).digest('hex').slice(0, 32) + '-' + n;
const LOCAL_FUTURE = (d) => d;

async function waitPreview(page) { await page.waitForSelector('#import-dialog[open] #import-go:text-is("Add to my account")', { timeout: 8000 }); }
const local = (d) => { const x = new Date(d || Date.now()); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

describe('AC-I7 — check-ins made while signed out are not lost to the first read', () => {
  test('sessions without ids: the dialog counts them, Add writes them once with content ids, a reload adds nothing, a second device sees them', async () => {
    const A = entry('2026-10-01'), B = entry('2026-10-01'), C = entry('2026-10-03', { disc: 'run', rpe: 7 });
    const b = new Backend({ imported: true });
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumLog_v1: [A, B, C] } });
    try {
      await s.open(); await s.settle(600); await waitPreview(s.page);
      assert.match(await s.page.textContent('#import-counts'), /SessionsThis device 3 · Already in your account 0 · New 3/);
      assert.strictEqual(b.rows('session_checkins').length, 0);
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).length, 3, 'cache untouched while held');
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported 3 sessions/.test(document.getElementById('import-msg').textContent), null, { timeout: 8000 });
      assert.deepStrictEqual(b.rows('session_checkins').map((r) => r.id), [idFor(A, 0), idFor(A, 1), idFor(C, 0)]);
      await s.page.click('#import-go'); await s.settle(500);
      await s.page.reload(); await s.settle(600);
      assert.strictEqual(b.rows('session_checkins').length, 3);
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).length, 3);
      // Another device that holds the same sessions (no ids) finds nothing new.
      const d = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumLog_v1: [A, B, C] } });
      try {
        await d.open(); await d.settle(600);
        assert.strictEqual(await d.page.$eval('#import-dialog', (n) => n.open), false, 'the same sessions are already in the account');
        assert.strictEqual(await d.ls(FLAG), b.userId);
        assert.strictEqual(b.rows('session_checkins').length, 3, 'no duplicate');
      } finally { await d.close(); }
    } finally { await s.close(); }
  });

  test('a session with a server id is matched by that id (kept as is), not re-derived', async () => {
    const A = entry('2026-10-01', { id: 's-local-1', loggedAt: 1790000000000 });
    const b = new Backend({ imported: true }).seed('session_checkins', [{ id: 's-local-1', session_date: '2026-10-01', disc: 'swim', intensity: 'easy', duration: 60, rpe: 5, a1: 'intent', a2: 'planned', b2: 'good', b3: 'none', note: '', phase: 'base' }]);
    const s = await scenario(browser, { backend: b, signedIn: true, localStorage: { triMomentumLog_v1: [A] } });
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual(await s.page.$eval('#import-dialog', (n) => n.open), false);
      assert.strictEqual(b.rows('session_checkins').length, 1);
    } finally { await s.close(); }
  });
});

// ── AC-C3 ───────────────────────────────────────────────────────────
const OUTCOME = ['a1', 'a2', 'a3', 'rpe', 'b2', 'b3'];
async function ans(page) { return page.evaluate(() => JSON.parse(JSON.stringify(window.__t.state.ans))); }
function assertOnlyAthleteKeys(a, where) {
  for (const k of OUTCOME) assert.strictEqual(a[k], undefined, where + ': ' + k + ' must not be set by anything but the athlete (' + JSON.stringify(a) + ')');
}
const TODAY = local();
const PLAN = [{ id: 'cp1', date: TODAY, disc: 'run', title: 'Easy run', intensity: 'hard', duration: 45, key: true, notes: '', phase: 'base' }];
const SERVER_SESSION = { id: 'srv-s1', session_date: '2026-10-01', disc: 'bike', intensity: 'hard', duration: 120, rpe: 9, a1: 'well', a2: 'short', a3: 'poor', b2: 'bad', b3: 'sore', note: '', phase: 'base' };
const PHASES = [{ id: 'cph', from: '2020-01-01', phase: 'base' }];
const PLAN_ROW = { id: 'cp1', plan_date: TODAY, disc: 'run', title: 'Easy run', intensity: 'hard', duration: 45, is_key: true, notes: '', phase: 'base' };
const PHASE_ROW = { id: 'cph', from_date: '2020-01-01', phase: 'base' };

describe('AC-C3 — a1, a2, a3, rpe, b2, b3 are never pre-filled, through every entry point', () => {
  // The account holds the plan, so the synced read keeps it (a plan only on the device would be replaced).
  const opts = (extra) => Object.assign({ backend: new Backend({ imported: true }).seed('session_checkins', [SERVER_SESSION]).seed('plan_sessions', [PLAN_ROW]).seed('phase_blocks', [PHASE_ROW]), signedIn: true, deviceDecided: true, transform: exposeHandle, localStorage: { triMomentumPlan_v1: PLAN, triMomentumPhasePlan_v1: PHASES } }, extra || {});

  test('a synced read of server rows (including outcome answers) leaves state.ans alone', async () => {
    const s = await scenario(browser, opts());
    try {
      await s.open(); await s.settle(600);
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).length, 1, 'the server row arrived');
      assertOnlyAthleteKeys(await ans(s.page), 'after a synced read');
    } finally { await s.close(); }
  });

  test('the Calendar card "Check in on this", "Use these details", resume and the outbox flush', async () => {
    const held = { id: 'held-1', date: '2026-10-02', disc: 'run', intensity: 'easy', duration: 30, rpe: 3, a1: 'intent', a2: 'planned', a3: null, b2: 'good', b3: 'none', note: '', phase: 'base', loggedAt: null };
    const s = await scenario(browser, opts({ localStorage: { triMomentumPlan_v1: PLAN, triMomentumPhasePlan_v1: PHASES, triMomentumPendingSessions_v1: [held] } }));
    try {
      await s.open(); await s.settle(800);
      assert.ok(s.backend.rows('session_checkins').some((r) => r.id === 'held-1'), 'the outbox flushed');
      assertOnlyAthleteKeys(await ans(s.page), 'after the outbox flush');
      await s.page.click('.cal-card-cta');
      await s.page.waitForTimeout(250);
      const a = await ans(s.page);
      assertOnlyAthleteKeys(a, 'after "Check in on this"');
      assert.deepStrictEqual(Object.keys(a).sort(), ['date', 'disc', 'duration', 'intensity'], 'only what the plan states');
      // resume
      await s.page.click('#tab-flow'); await s.page.waitForTimeout(250);
      await s.page.click('.cal-resume-go'); await s.page.waitForTimeout(250);
      assertOnlyAthleteKeys(await ans(s.page), 'after Resume');
    } finally { await s.close(); }
  });

  test('"Use these details" inside the flow', async () => {
    const s = await scenario(browser, opts());
    try {
      await s.open(); await s.settle(500);
      await s.page.click('#tab-flow'); await s.page.waitForTimeout(200);
      await s.page.click('.cal-unplanned'); await s.page.waitForTimeout(250);
      assertOnlyAthleteKeys(await ans(s.page), 'on entering the manual flow');
      await s.page.click('.flow-plan-card'); await s.page.waitForTimeout(250);
      assertOnlyAthleteKeys(await ans(s.page), 'after "Use these details"');
    } finally { await s.close(); }
  });

  test('the phase-gated pending check-in (no phase yet): the picker, then the card\'s details only', async () => {
    const s = await scenario(browser, opts({ backend: new Backend({ imported: true }).seed('plan_sessions', [PLAN_ROW]), localStorage: {} }));
    try {
      await s.open(); await s.settle(500);
      await s.page.click('.cal-card-cta'); await s.page.waitForTimeout(250);
      assert.strictEqual(await s.page.$eval('#view-period', (n) => !n.hidden), true, 'the picker gates the start');
      assertOnlyAthleteKeys(await ans(s.page), 'at the picker');
      await s.page.click('#period-choices .choice:has-text("Base")'); await s.page.waitForTimeout(300);
      const a = await ans(s.page);
      assertOnlyAthleteKeys(a, 'after the picker');
      assert.strictEqual(a.disc, 'run');
    } finally { await s.close(); }
  });

  test('device import (Add): state.ans is untouched and a saved row keeps its own answers', async () => {
    const own = entry('2026-10-04', { a1: 'slight', rpe: 8 });
    const s = await scenario(browser, { backend: new Backend({ imported: true }), signedIn: true, transform: exposeHandle, localStorage: { triMomentumLog_v1: [own], triMomentumPlan_v1: PLAN, triMomentumPhasePlan_v1: PHASES } });
    try {
      await s.open(); await s.settle(600); await waitPreview(s.page);
      assertOnlyAthleteKeys(await ans(s.page), 'while the dialog is open');
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 8000 });
      await s.page.click('#import-go'); await s.settle(400);
      assertOnlyAthleteKeys(await ans(s.page), 'after the import');
      const row = s.backend.rows('session_checkins')[0];
      assert.strictEqual(row.a1, 'slight'); assert.strictEqual(row.rpe, 8);
    } finally { await s.close(); }
  });
});
