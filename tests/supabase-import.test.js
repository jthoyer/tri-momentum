'use strict';
// AC20: the one-off import from the Google Sheet. Real index.html, real
// vendored supabase-js, a stateful PostgREST mock, and a mock of the Apps Script
// web app's four GET endpoints. Nothing here touches the live Sheet or project.
//
// Isolation: each test() is a fresh scenario (new server, new browser context,
// empty storage). Tests that need "a different device" build a second scenario
// that shares only the Backend object (= the server), exactly as two devices do.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend, OWNER_EMAIL } = require('./lib/supabase-mock');
const { ratioOf } = require('./lib/contrast');

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const S1 = { when: '2026-10-01', disc: 'swim', duration: 45, intensity: 'easy', rpe: 4, a1: 'intent', a2: 'planned', a3: '', b2: 'good', b3: 'none', note: 'steady', phase: 'base' };
const S2 = { when: '2026-10-02', disc: 'run', duration: '', intensity: 'hard', rpe: '7', a1: 'slight', a2: 'planned', a3: 'good', b2: '', b3: '', note: '', phase: '' };
const SHEET = {
  sessions: [S1, S2, Object.assign({}, S1), Object.assign({}, S1, { when: '15/10/2026' }), Object.assign({}, S2, { when: '' })],  // S1 twice (a genuine repeat); two bad dates
  races: [
    { id: 'r1', name: 'Sam Lee Tri', date: '2031-03-01', url: 'x.example', notes: 'n', status: 'locked' },
    { id: 'r2', name: 'Other Race', date: '2031-04-01', url: '', notes: '', status: 'considering' },
    { id: 'r3', name: '', date: '2031-05-01', url: '', notes: '', status: 'locked' },        // no name
    { id: 'r4', name: 'Bad Date', date: 'soon', url: '', notes: '', status: 'locked' },
  ],
  plan: [
    { id: 'p1', date: '2031-03-04', disc: 'bike', title: 'Z2', intensity: 'easy', duration: 90, key: true, notes: 'hr cap', phase: 'base' },
    { id: 'p2', date: '2031-03-05', disc: 'run', title: '', intensity: 'hard', duration: '60 min', key: 'TRUE', notes: '', phase: '' },
    { id: 'p3', date: '2031-03-06', disc: 'swim', title: 'Squad', intensity: 'easy', duration: 45, key: false, notes: '', phase: '' },
    { id: 'p4', date: '', disc: 'swim', title: 'No date', intensity: 'easy', duration: 45, key: false, notes: '', phase: '' },
  ],
  phases: [
    { id: 'ph1', from: '2030-12-01', phase: 'base' },
    { id: 'ph2', from: '2031-02-01', phase: 'build1' },
    { id: 'ph3', from: '2031-03-01', phase: '' },
  ],
};
const EXPECT = { sessions: 3, races: 2, plan: 3, phases: 2 };            // rows that should land
const SKIPPED = { sessions: 2, races: 2, plan: 1, phases: 1 };

const canon = (r) => JSON.stringify([r.when, r.disc, r.duration === '' ? null : parseInt(r.duration, 10), r.intensity, r.rpe === '' ? null : parseInt(r.rpe, 10), r.a1 || null, r.a2 || null, r.a3 || null, r.b2 || null, r.b3 || null, r.note || '', r.phase || null]);
const idFor = (r, n) => 'sheet-' + crypto.createHash('sha256').update(canon(r)).digest('hex').slice(0, 32) + '-' + n;

async function clean(s) {
  assert.deepStrictEqual(s.errors, [], 'page errors');
  assert.deepStrictEqual(await s.unhandled(), [], 'unhandled rejections');
  assert.deepStrictEqual(s.guard.blocked, [], 'requests nobody mocked');
}
const pending = (extra) => Object.assign({ backend: new Backend(), signedIn: true, sheet: SHEET }, extra || {});
async function openDialog(s) {
  if (!s.opened) { await s.open(); s.opened = true; await s.settle(500); }
  await s.page.click('#splash-account-btn');
  await s.page.waitForSelector('#import-dialog[open] #import-go:not([hidden])');
}
async function runImport(s) {
  await openDialog(s);
  await s.page.click('#import-go');
  await s.page.waitForFunction(() => /^Imported|Import stopped/.test(document.getElementById('import-msg').textContent), null, { timeout: 15000 });
}
const msg = (s) => s.page.textContent('#import-msg');
const rowsWritten = (b) => b.tables.session_checkins.length + b.tables.races.length + b.tables.plan_sessions.length + b.tables.phase_blocks.length;

describe('AC20 — offered only in import-pending mode', () => {
  for (const [name, opts] of Object.entries({
    synced: { backend: new Backend({ imported: true }), signedIn: true },
    'not permitted': { backend: new Backend({ allowed: false }), signedIn: true },
    'signed out': { backend: new Backend(), signedIn: false },
  })) {
    test(name + ': no "Import from Sheet" button, the dialog cannot be opened, the Sheet is never read', async () => {
      const s = await scenario(browser, Object.assign({ sheet: SHEET }, opts));
      try {
        await s.open(); await s.settle(500);
        assert.notStrictEqual((await s.page.textContent('#splash-account-btn')).trim(), 'Import from Sheet');
        assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.open), false);
        assert.deepStrictEqual(s.sheet.requests, []);
        await clean(s);
      } finally { await s.close(); }
    });
  }
});

describe('AC20 — preview, confirmation, order, report', () => {
  test('preview: found/skipped per kind with reasons, an instruction to compare with the Sheet, and NOTHING written until confirmed; Esc cancels', async () => {
    const s = await scenario(browser, pending());
    try {
      await openDialog(s);
      const text = await s.page.textContent('#import-counts');
      assert.match(text, /Sessions5 found · 2 skipped \(bad date\)/);
      assert.match(text, /Races4 found · 2 skipped \(1 missing id, name or date, 1 bad date\)/);
      assert.match(text, /Planned sessions4 found · 1 skipped \(bad date\)/);
      assert.match(text, /Phase blocks3 found · 1 skipped \(missing id, from or phase\)/);
      assert.match(await s.page.textContent('#import-note'), /Compare these counts with each tab of your Sheet/);
      assert.strictEqual(rowsWritten(s.backend), 0, 'nothing written before confirming');
      assert.strictEqual(s.backend.requests.filter((r) => r.method !== 'GET').length, 0);
      assert.deepStrictEqual(s.sheet.requests.map((r) => r.method + r.search).sort(), ['GET?list=1', 'GET?phases=1', 'GET?plan=1', 'GET?races=1']);
      // Esc: cancelled, still nothing written, focus back on the button that opened it.
      await s.page.keyboard.press('Escape');
      assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.open), false);
      assert.strictEqual(await s.page.evaluate(() => document.activeElement.id), 'splash-account-btn');
      assert.strictEqual(rowsWritten(s.backend), 0);
      assert.ok((await s.accountText()).startsWith('Bring your history across'), 'still import-pending');
      await clean(s);
    } finally { await s.close(); }
  });

  test('a full run: kinds in order, marker LAST, stable ids, report, switch to synced and repaint without a reload', async () => {
    const s = await scenario(browser, pending());
    try {
      await s.open(); s.opened = true; await s.settle(500);
      await s.page.evaluate(() => { window.__noReload = 'same document'; });
      await runImport(s);
      const b = s.backend;
      assert.strictEqual(await msg(s), 'Imported 3 sessions · 2 races · 3 planned · 2 phase blocks. 6 skipped (sessions: 2 bad date; races: 1 missing id, name or date, 1 bad date; planned sessions: 1 bad date; phase blocks: 1 missing id, from or phase).');
      // order on the wire
      const posts = b.requests.filter((r) => r.method === 'POST' && r.rest).map((r) => r.table);
      assert.deepStrictEqual(posts, ['session_checkins', 'races', 'plan_sessions', 'phase_blocks', 'sheet_import'], 'sessions first, the marker last');
      assert.strictEqual(b.rows('sheet_import').length, 1);
      assert.deepStrictEqual(b.rows('sheet_import')[0].counts.sessions, { found: 5, inserted: 3, present: 0, skipped: 2 });
      // every write was insert-if-absent
      b.requests.filter((r) => r.method === 'POST' && r.rest).forEach((r) => assert.match(r.headers['prefer'], /resolution=ignore-duplicates/));
      // session ids: derived from content, two identical rows stay two rows
      const ids = b.rows('session_checkins').map((r) => r.id);
      assert.deepStrictEqual(ids, [idFor(S1, 0), idFor(S2, 0), idFor(S1, 1)]);
      assert.strictEqual(ids[0], 'sheet-70e2ba827b53795cae8ce22f144c44eb-0');
      // mapping of the awkward rows
      const s2 = b.rows('session_checkins')[1];
      assert.strictEqual(s2.duration, null); assert.strictEqual(s2.rpe, 7); assert.strictEqual(s2.phase, null); assert.strictEqual(s2.session_date, '2026-10-02');
      assert.strictEqual(b.rows('plan_sessions').find((r) => r.id === 'p2').duration, 60, '"60 min" coerced by the app\'s own parse rule');
      assert.strictEqual(b.rows('plan_sessions').find((r) => r.id === 'p2').is_key, true);
      // switched to synced, repainted, no reload
      assert.strictEqual(await s.accountText(), 'Synced · ' + OWNER_EMAIL);
      assert.strictEqual(await s.page.evaluate(() => window.__noReload), 'same document');
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).length, 3);
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('Sam Lee Tri'));
      // announced via say(), once
      const live = await s.live();
      assert.strictEqual(live.filter((m) => /^Imported 3 sessions/.test(m)).length, 1, 'the result was announced once: ' + JSON.stringify(live));
      // only GETs ever went to the Sheet
      assert.ok(s.sheet.requests.every((r) => r.method === 'GET'));
      // Done → closes, focus to the heading
      await s.page.click('#import-go');
      await s.page.waitForTimeout(100);
      assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.open), false);
      assert.strictEqual(await s.page.evaluate(() => document.activeElement.id), 'splash-h');
      await clean(s);
    } finally { await s.close(); }
  });

  test('run twice (marker deleted, as the runbook says): identical row counts and identical session ids, no duplicates', async () => {
    const s = await scenario(browser, pending());
    try {
      await runImport(s);
      const b = s.backend;
      const first = { ids: b.rows('session_checkins').map((r) => r.id), n: rowsWritten(b) };
      await s.page.click('#import-go');   // Done
      // The owner deletes their sheet_import row in the dashboard and reloads.
      b.tables.sheet_import = [];
      await s.page.reload(); await s.settle(500);
      await s.page.click('#splash-account-btn');
      await s.page.waitForSelector('#import-dialog[open] #import-go:not([hidden])');
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 15000 });
      assert.strictEqual(rowsWritten(b), first.n, 'identical row counts');
      assert.deepStrictEqual(b.rows('session_checkins').map((r) => r.id), first.ids, 'identical session ids');
      assert.match(await msg(s), /^Imported 0 sessions · 0 races · 0 planned · 0 phase blocks\. 10 already there\./);
      assert.strictEqual(b.rows('sheet_import').length, 1);
      await clean(s);
    } finally { await s.close(); }
  });

  test('a failure injected at plan stops there, writes no marker, says where; running it again completes with no duplicates', async () => {
    const b = new Backend();
    const rule = b.inject((i) => i.table === 'plan_sessions' && i.method === 'POST', { status: 500, body: { message: 'plan insert failed' } });
    const s = await scenario(browser, pending({ backend: b }));
    try {
      await runImport(s);
      assert.strictEqual(await msg(s), 'Import stopped at plan. Nothing is lost — run it again.');
      assert.strictEqual(b.rows('sheet_import').length, 0, 'no marker after a partial run');
      assert.strictEqual(b.rows('session_checkins').length, 3, 'sessions and races landed');
      assert.strictEqual(b.rows('races').length, 2);
      assert.strictEqual(b.rows('plan_sessions').length, 0);
      assert.strictEqual(b.rows('phase_blocks').length, 0, 'phases (after plan) were never attempted');
      assert.ok((await s.accountText()).startsWith('Bring your history across'), 'still import-pending: the cutover has not happened');
      assert.ok(s.warns().some((w) => /import stopped at plan/.test(w)));
      b.rules.splice(b.rules.indexOf(rule), 1);
      await s.page.click('#import-go');   // "Run it again"
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 15000 });
      assert.deepStrictEqual([b.rows('session_checkins').length, b.rows('races').length, b.rows('plan_sessions').length, b.rows('phase_blocks').length], [3, 2, 3, 2]);
      assert.match(await msg(s), /^Imported 0 sessions · 0 races · 3 planned · 2 phase blocks\. 5 already there\./);
      assert.strictEqual(b.rows('sheet_import').length, 1);
      assert.strictEqual((await s.accountText()), 'Synced · ' + OWNER_EMAIL);
      await clean(s);
    } finally { await s.close(); }
  });

  test('a different device (fresh browser context, same server): the same ids, no duplicates', async () => {
    const b = new Backend();
    const a = await scenario(browser, pending({ backend: b }));
    let ids;
    try { await runImport(a); ids = b.rows('session_checkins').map((r) => r.id); } finally { await a.close(); }
    b.tables.sheet_import = [];   // the marker is deleted for the second run
    const c = await scenario(browser, pending({ backend: b, viewport: { width: 1024, height: 768 } }));
    try {
      await runImport(c);
      assert.deepStrictEqual(b.rows('session_checkins').map((r) => r.id), ids);
      assert.strictEqual(b.rows('session_checkins').length, 3);
      assert.strictEqual(b.rows('races').length, 2);
      await clean(c);
    } finally { await c.close(); }
  });

  test('the session ids are pinned: content-derived, not positional (reordering the Sheet does not change them)', async () => {
    const b = new Backend();
    const reordered = Object.assign({}, SHEET, { sessions: [SHEET.sessions[1], SHEET.sessions[0], SHEET.sessions[2], SHEET.sessions[3], SHEET.sessions[4]] });
    const s = await scenario(browser, pending({ backend: b, sheet: reordered }));
    try {
      await runImport(s);
      assert.deepStrictEqual(b.rows('session_checkins').map((r) => r.id), [idFor(S2, 0), idFor(S1, 0), idFor(S1, 1)]);
      assert.match(idFor(S1, 0), /^sheet-[0-9a-f]{32}-0$/);
    } finally { await s.close(); }
  });
});

describe('AC20 — a malformed envelope aborts with nothing written', () => {
  const BAD = {
    'ok:false': { body: { ok: false, error: 'nope' } },
    'ok:true but the list is missing (a placeholder deployment, decision 36)': { body: { ok: true } },
    'the list is not an array': { body: { ok: true, __K__: 'rows' } },
    'HTML instead of JSON': { body: '<html>Sign in to Google</html>' },
    'HTTP 500': { status: 500, body: { ok: true, __K__: [] } },
  };
  for (const [query, key, endpointName] of [['?list=1', 'sessions', 'sessions'], ['?plan=1', 'plan', 'plan'], ['?phases=1', 'phases', 'phases']]) {
    for (const [label, spec] of Object.entries(BAD)) {
      test(query + ' — ' + label, async () => {
        const s = await scenario(browser, pending());
        try {
          const body = typeof spec.body === 'string' ? spec.body : JSON.parse(JSON.stringify(spec.body).replace('__K__', key));
          s.sheet.overrides[query] = { status: spec.status, body };
          await s.open(); await s.settle(400);
          await s.page.click('#splash-account-btn');
          await s.page.waitForFunction(() => /Nothing was written/.test(document.getElementById('import-msg').textContent), null, { timeout: 10000 });
          const m = await msg(s);
          assert.ok(m.includes(query), 'the message names the endpoint (' + query + '): ' + m);
          assert.strictEqual(rowsWritten(s.backend), 0);
          assert.strictEqual(s.backend.requests.filter((r) => r.method !== 'GET').length, 0, 'no write of any kind');
          assert.strictEqual(s.backend.rows('sheet_import').length, 0);
          assert.strictEqual((await s.page.textContent('#import-go')).trim(), 'Try again');
          await clean(s);
        } finally { await s.close(); }
      });
    }
  }

  test('no Sheet address in the build: a clear message, nothing written, no request anywhere', async () => {
    const s = await scenario(browser, { backend: new Backend(), signedIn: true });   // sheet: none → TRAINING_LOG_WRITE_URL is ''
    try {
      await s.open(); await s.settle(400);
      await s.page.click('#splash-account-btn');
      await s.page.waitForFunction(() => /Nothing was written/.test(document.getElementById('import-msg').textContent));
      assert.match(await msg(s), /No Sheet address/);
      assert.strictEqual(s.backend.requests.filter((r) => r.method !== 'GET').length, 0);
      await clean(s);
    } finally { await s.close(); }
  });
});

describe('AC12 — the import dialog is operable and readable', () => {
  test('keyboard: nothing behind the dialog takes focus, Esc is refused mid-import, buttons are real and ≥44px, contrast ≥ 4.5:1 — at 320px', async (t) => {
    const b = new Backend();
    b.inject((i) => i.table === 'plan_sessions' && i.method === 'POST', { delayMs: 900 });
    const s = await scenario(browser, pending({ backend: b, viewport: { width: 320, height: 640 } }));
    try {
      await openDialog(s);
      const dlg = await s.page.$eval('#import-dialog', (d) => ({ name: d.getAttribute('aria-labelledby'), label: document.getElementById(d.getAttribute('aria-labelledby')).textContent, modal: d.matches(':modal') }));
      assert.strictEqual(dlg.modal, true, 'a modal dialog'); assert.strictEqual(dlg.label, 'Import from your Google Sheet');
      // Tab around: a modal dialog makes everything behind it inert, so focus is
      // either on one of the dialog's own controls or has left the page for the
      // browser's chrome (activeElement = body). It never lands on the splash,
      // the account button or the tab bar behind the scrim.
      for (let i = 0; i < 7; i++) {
        await s.page.keyboard.press('Tab');
        const where = await s.page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : (a.closest('#import-dialog') ? 'dialog' : 'BEHIND:' + (a.id || a.tagName)); });
        assert.ok(where === 'dialog' || where === 'body', 'focus went to ' + where + ' on Tab ' + (i + 1));
      }
      for (const id of ['import-cancel', 'import-go']) {
        const box = await (await s.page.$('#' + id)).boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44, id + ' is ' + box.width + 'x' + box.height);
        assert.strictEqual(await s.page.$eval('#' + id, (n) => n.tagName + n.type), 'BUTTONbutton');
      }
      assert.strictEqual(await s.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, 'no horizontal overflow');
      await s.page.screenshot({ path: '/tmp/import-preview-320.png' });
      // Contrast against the rendered backgrounds.
      const c = await s.page.evaluate(() => {
        const g = (sel) => getComputedStyle(document.querySelector(sel));
        return { bg: g('#import-dialog').backgroundColor, h: g('#import-h').color, msg: g('#import-msg').color, k: g('#import-counts li .k').color, n: g('#import-counts li .n').color, note: g('#import-note').color, goBg: g('#import-go').backgroundColor, goFg: g('#import-go').color, caFg: g('#import-cancel').color };
      });
      const r = { heading: ratioOf(c.h, c.bg), message: ratioOf(c.msg, c.bg), label: ratioOf(c.k, c.bg), count: ratioOf(c.n, c.bg), note: ratioOf(c.note, c.bg), importBtn: ratioOf(c.goFg, c.goBg), cancelBtn: ratioOf(c.caFg, c.bg) };
      t.diagnostic(Object.entries(r).map(([k, v]) => k + ' ' + v.toFixed(2)).join(' · '));
      for (const [k, v] of Object.entries(r)) assert.ok(v >= 4.5, k + ' contrast ' + v);
      // Start the import; Esc must not close it while it writes.
      await s.page.click('#import-go');
      await s.page.waitForFunction(() => /^Importing/.test(document.getElementById('import-msg').textContent));
      await s.page.keyboard.press('Escape');
      assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.open), true, 'Esc is refused while writing');
      assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.getAttribute('aria-busy')), 'true');
      await s.page.waitForFunction(() => /^Imported/.test(document.getElementById('import-msg').textContent), null, { timeout: 15000 });
      await s.page.screenshot({ path: '/tmp/import-done-320.png' });
      assert.strictEqual(await s.page.evaluate(() => document.activeElement.id), 'import-go', 'focus is on Done');
      await s.page.keyboard.press('Enter');   // Done, by keyboard
      await s.page.waitForTimeout(100);
      assert.strictEqual(await s.page.$eval('#import-dialog', (d) => d.open), false);
      await clean(s);
    } finally { await s.close(); }
  });
});
