'use strict';
// AC15–AC18: synced reads (shapes, order, paging), every write action with its
// column mapping, write ordering, failure fallback, and the session outbox —
// against the real index.html, the real vendored supabase-js and a STATEFUL
// PostgREST mock (tests/lib/supabase-mock.js) that refuses what the real
// database refuses: merge upserts, nulls in NOT NULL columns, unfiltered
// deletes, writes outside the grant matrix.
//
// Isolation: each test() is its own scenario (new server + new browser
// context = empty storage). A test that reloads inside its scenario does so to
// test persistence, and says so.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend, OWNER_ID } = require('./lib/supabase-mock');
const { exposeHandle } = require('./lib/handle');
const { completeCheckIn } = require('./lib/checkin');

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const READ_TABLES = ['session_checkins', 'races', 'plan_sessions', 'phase_blocks'];
const sess = (id, date, extra) => Object.assign({ id, session_date: date, disc: 'run', intensity: 'easy', duration: 45, rpe: 4, note: '' }, extra);
async function clean(s) {
  assert.deepStrictEqual(s.errors, [], 'page errors');
  assert.deepStrictEqual(await s.unhandled(), [], 'unhandled rejections');
  assert.deepStrictEqual(s.guard.blocked, [], 'requests nobody mocked');
}
const synced = (b, o) => Object.assign({ backend: b, signedIn: true, transform: exposeHandle }, o || {});
const writes = (b, table) => b.requests.filter((r) => r.table === table && r.method !== 'GET');
const reads = (b, table) => b.requests.filter((r) => r.table === table && r.method === 'GET');

describe('AC15 — synced reads', () => {
  test('all four tables replace the copies and caches under the unchanged keys, with the unchanged shapes, in seq order', async () => {
    const b = new Backend({ imported: true });
    // Inserted in this order on purpose: seq order is NOT date order.
    b.seed('session_checkins', [
      sess('s-b', '2026-10-05', { a1: 'intent', a2: 'planned', a3: 'good', b2: 'good', b3: 'none', phase: 'base', logged_at: '2026-10-05T08:30:00Z' }),
      sess('s-a', '2026-10-01'),
    ]);
    b.seed('races', [{ id: 'r1', name: 'Alpha', race_date: '2031-03-01', url: 'x.example', notes: 'n', status: 'locked' }, { id: 'r0', name: 'Zed', race_date: '2030-01-01', url: '', notes: '', status: 'considering' }]);
    b.seed('plan_sessions', [{ id: 'p1', plan_date: '2031-03-04', disc: 'bike', title: 'Z2', intensity: 'easy', duration: 90, is_key: true, notes: 'hr cap', phase: 'build1' }]);
    b.seed('phase_blocks', [{ id: 'ph2', from_date: '2031-02-01', phase: 'build1' }, { id: 'ph1', from_date: '2030-12-01', phase: 'base' }]);
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      const log = await s.lsJson('triMomentumLog_v1');
      assert.deepStrictEqual(log.map((e) => e.id), ['s-b', 's-a'], 'seq order, not date order');
      assert.deepStrictEqual(Object.keys(log[0]).sort(), ['a1', 'a2', 'a3', 'b2', 'b3', 'date', 'disc', 'duration', 'id', 'intensity', 'loggedAt', 'note', 'phase', 'rpe']);
      assert.strictEqual(log[0].date, '2026-10-05'); assert.strictEqual(log[0].loggedAt, Date.parse('2026-10-05T08:30:00Z'));
      assert.strictEqual(typeof log[0].loggedAt, 'number'); assert.strictEqual(log[1].loggedAt, null); assert.strictEqual(log[1].a1, null);
      const races = await s.lsJson('triMomentumRaces_v1');
      assert.deepStrictEqual(races[0], { id: 'r1', name: 'Alpha', date: '2031-03-01', url: 'x.example', notes: 'n', status: 'locked' });
      assert.deepStrictEqual(races.map((r) => r.id), ['r1', 'r0']);
      assert.deepStrictEqual(await s.lsJson('triMomentumPlan_v1'), [{ id: 'p1', date: '2031-03-04', disc: 'bike', title: 'Z2', intensity: 'easy', duration: 90, key: true, notes: 'hr cap', phase: 'build1' }]);
      assert.deepStrictEqual(await s.lsJson('triMomentumPhasePlan_v1'), [{ id: 'ph2', from: '2031-02-01', phase: 'build1' }, { id: 'ph1', from: '2030-12-01', phase: 'base' }]);
      for (const t of READ_TABLES) assert.ok(reads(b, t).every((r) => r.query.get('order') === 'seq.asc'), t + ' is read ordered by seq');
      await clean(s);
    } finally { await s.close(); }
  });

  test('more than 1,000 rows: paged, nothing truncated (1,001 rows, default cap)', async () => {
    const b = new Backend({ imported: true });
    b.seed('session_checkins', Array.from({ length: 1001 }, (_, i) => sess('s' + i, '2026-01-01')));
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(600);
      const log = await s.lsJson('triMomentumLog_v1');
      assert.strictEqual(log.length, 1001);
      assert.strictEqual(log[1000].id, 's1000');
      assert.deepStrictEqual(reads(b, 'session_checkins').map((r) => r.query.get('offset') + '/' + r.query.get('limit')), ['0/1000', '1000/1000']);
      await clean(s);
    } finally { await s.close(); }
  });

  test('a server that caps pages below ours (500) still yields every row', async () => {
    const b = new Backend({ imported: true, maxRows: 500 });
    b.seed('session_checkins', Array.from({ length: 1201 }, (_, i) => sess('s' + i, '2026-01-01')));
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(600);
      const log = await s.lsJson('triMomentumLog_v1');
      assert.strictEqual(log.length, 1201);
      assert.deepStrictEqual(log.slice(0, 3).map((e) => e.id), ['s0', 's1', 's2']);
      assert.strictEqual(new Set(log.map((e) => e.id)).size, 1201, 'no row twice');
      await clean(s);
    } finally { await s.close(); }
  });

  test('boot reads all four; opening Races / This week / Plan and visibilitychange trigger the same refreshes as before', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b, { localStorage: { triMomentumPhasePlan_v1: [{ id: 'ph', from: '2020-01-01', phase: 'base' }] } }));
    try {
      await s.open(); await s.settle(500);
      for (const t of READ_TABLES) assert.ok(reads(b, t).length >= 1, 'boot read ' + t);
      const tablesAfter = async (fn) => { const n = b.requests.length; await fn(); await s.settle(400); return Array.from(new Set(b.requests.slice(n).filter((r) => r.rest && r.method === 'GET').map((r) => r.table))).sort(); };
      assert.deepStrictEqual(await tablesAfter(() => s.page.click('#tab-races')), ['phase_blocks', 'races']);
      assert.deepStrictEqual(await tablesAfter(() => s.page.click('#tab-dash')), ['phase_blocks', 'session_checkins']);
      assert.deepStrictEqual(await tablesAfter(() => s.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))), ['phase_blocks', 'session_checkins']);
      await clean(s);
    } finally { await s.close(); }
  });

  test('another device adds a race: opening Races replaces the copy (the entry point resolved true) and repaints', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      b.seed('races', [{ id: 'r-new', name: 'From The Phone', race_date: '2031-09-09', url: '', notes: '', status: 'locked' }]);
      await s.page.click('#tab-races'); await s.settle(500);
      assert.ok((await s.page.textContent('#view-races')).includes('From The Phone'));
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('From The Phone'));
      await clean(s);
    } finally { await s.close(); }
  });
});

describe('AC16 — every write action: operation, column mapping, filters', () => {
  const MONDAY = '2031-03-03';

  test('session save: insert-if-absent of one row, every key present, client id, ISO logged_at', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b, { localStorage: { triMomentumPhasePlan_v1: [{ id: 'ph', from: '2020-01-01', phase: 'build1' }] } }));
    try {
      await s.open(); await s.settle(400);
      await completeCheckIn(s.page); await s.settle(500);
      const posts = writes(b, 'session_checkins');
      assert.strictEqual(posts.length, 1);
      assert.strictEqual(posts[0].query.get('on_conflict'), 'user_id,id');
      assert.match(posts[0].headers['prefer'], /resolution=ignore-duplicates/);
      assert.ok(!/merge-duplicates/.test(posts[0].headers['prefer']));
      const row = posts[0].body[0] || posts[0].body;
      assert.deepStrictEqual(Object.keys(row).sort(), ['a1', 'a2', 'a3', 'b2', 'b3', 'disc', 'duration', 'id', 'intensity', 'logged_at', 'note', 'phase', 'rpe', 'session_date']);
      assert.match(row.id, /^s[0-9a-z]+$/); assert.match(row.session_date, /^\d{4}-\d{2}-\d{2}$/); assert.match(row.logged_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.strictEqual(row.phase, 'build1');
      assert.strictEqual(b.rows('session_checkins').length, 1);
      assert.deepStrictEqual(await s.lsJson('triMomentumPendingSessions_v1'), [], 'confirmed: out of the outbox');
      await clean(s);
    } finally { await s.close(); }
  });

  test('races: add is insert-if-absent with race_date; delete is by id; the UI form is wired to it', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(400);
      await s.page.click('#tab-races');
      await s.page.click('.race-add-toggle');
      await s.page.fill('#race-name', 'Mock Tri');
      await s.page.fill('#race-date', '2031-05-05');
      await s.page.click('.race-form button[type=submit]');
      await s.settle(500);
      const post = writes(b, 'races')[0];
      assert.ok(post, 'a POST to races');
      assert.match(post.headers['prefer'], /resolution=ignore-duplicates/);
      const row = Array.isArray(post.body) ? post.body[0] : post.body;
      assert.deepStrictEqual(Object.keys(row).sort(), ['id', 'name', 'notes', 'race_date', 'status', 'url']);
      assert.strictEqual(row.race_date, '2031-05-05'); assert.strictEqual(row.status, 'considering');
      assert.strictEqual(b.rows('races').length, 1);
      const id = row.id;
      await s.page.evaluate((i) => window.__t.deleteRace(i), id); await s.settle(400);
      const del = writes(b, 'races').find((r) => r.method === 'DELETE');
      assert.strictEqual(del.query.get('id'), 'eq.' + id);
      assert.strictEqual(b.rows('races').length, 0);
      await clean(s);
    } finally { await s.close(); }
  });

  test('plan: add, addBatch (copy week), update (the seven fields only), delete, deleteWeek (date range)', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(400);
      const id = await s.page.evaluate((d) => window.__t.addPlanSession(d, { disc: 'swim', title: 'Squad', intensity: 'hard', duration: 60, key: true, notes: 'n' }).id, '2031-03-04');
      await s.settle(300);
      let post = writes(b, 'plan_sessions')[0];
      assert.match(post.headers['prefer'], /resolution=ignore-duplicates/);
      const row = Array.isArray(post.body) ? post.body[0] : post.body;
      assert.deepStrictEqual(Object.keys(row).sort(), ['disc', 'duration', 'id', 'intensity', 'is_key', 'notes', 'phase', 'plan_date', 'title']);
      assert.strictEqual(row.plan_date, '2031-03-04'); assert.strictEqual(row.is_key, true);

      // addBatch via copy-week: one request, n rows, identical key sets.
      await s.page.evaluate((m) => { window.__t.state.planWeek = m; }, MONDAY);
      const n = await s.page.evaluate(() => window.__t.copyPlanWeek(['2031-03-10', '2031-03-17'])); await s.settle(300);
      assert.strictEqual(n, 2);
      post = writes(b, 'plan_sessions')[1];
      assert.strictEqual(post.body.length, 2);
      assert.strictEqual(new Set(post.body.map((r) => Object.keys(r).sort().join())).size, 1, 'every row has the same keys');
      assert.deepStrictEqual(post.body.map((r) => r.plan_date).sort(), ['2031-03-11', '2031-03-18']);
      assert.strictEqual(b.rows('plan_sessions').length, 3);

      // update: PATCH by id with exactly the seven editable fields.
      await s.page.evaluate(([i]) => window.__t.updatePlanSession(i, { disc: 'bike', title: 'Edited', intensity: 'easy', duration: 30, key: false, notes: 'x' }), [id]); await s.settle(300);
      const patch = b.requests.find((r) => r.table === 'plan_sessions' && r.method === 'PATCH');
      assert.strictEqual(patch.query.get('id'), 'eq.' + id);
      assert.deepStrictEqual(Object.keys(patch.body).sort(), ['disc', 'duration', 'intensity', 'is_key', 'notes', 'phase', 'title']);
      assert.strictEqual(b.rows('plan_sessions').find((r) => r.id === id).title, 'Edited');
      assert.strictEqual(b.rows('plan_sessions').find((r) => r.id === id).plan_date, '2031-03-04', 'the date is untouched');

      // delete by id, deleteWeek by date range.
      await s.page.evaluate((i) => window.__t.deletePlanSession(i), id); await s.settle(300);
      assert.strictEqual(b.requests.filter((r) => r.table === 'plan_sessions' && r.method === 'DELETE')[0].query.get('id'), 'eq.' + id);
      await s.page.evaluate(() => { window.__t.state.planWeek = '2031-03-10'; window.__t.clearPlanWeek(); }); await s.settle(300);
      const dw = b.requests.filter((r) => r.table === 'plan_sessions' && r.method === 'DELETE')[1];
      assert.deepStrictEqual(dw.query.getAll('plan_date').sort(), ['gte.2031-03-10', 'lte.2031-03-16']);
      assert.strictEqual(b.rows('plan_sessions').length, 1, 'only the other copied week is left');
      await clean(s);
    } finally { await s.close(); }
  });

  test('phase: add, update (two columns), delete, deleteRange, addBatch, replaceAll — and the writes land in the table', async () => {
    const b = new Backend({ imported: true });
    b.seed('phase_blocks', [{ id: 'keep', from_date: '2030-01-01', phase: 'base' }]);
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      const t = (fn, arg) => s.page.evaluate(fn, arg);
      await t(() => window.__t.addPhaseBlock('2031-03-03', 'build1')); await s.settle(300);
      const added = b.rows('phase_blocks').find((r) => r.from_date === '2031-03-03');
      assert.ok(added); assert.match(writes(b, 'phase_blocks')[0].headers['prefer'], /resolution=ignore-duplicates/);

      await t((id) => window.__t.updatePhaseBlock(id, { from: '2031-03-10', phase: 'peak' }), added.id); await s.settle(300);
      const patch = b.requests.find((r) => r.table === 'phase_blocks' && r.method === 'PATCH');
      assert.deepStrictEqual(Object.keys(patch.body).sort(), ['from_date', 'phase']);
      assert.strictEqual(b.rows('phase_blocks').find((r) => r.id === added.id).from_date, '2031-03-10');

      await t((id) => window.__t.deletePhaseBlock(id), added.id); await s.settle(300);
      assert.strictEqual(b.requests.filter((r) => r.table === 'phase_blocks' && r.method === 'DELETE')[0].query.get('id'), 'eq.' + added.id);

      // deleteRange then addBatch: the phase builder.
      await t(() => window.__t.applyPhaseBuild([{ from: '2031-06-02', phase: 'base' }, { from: '2031-06-09', phase: 'build1' }, { from: '2031-06-16', phase: 'peak' }])); await s.settle(500);
      const dr = b.requests.filter((r) => r.table === 'phase_blocks' && r.method === 'DELETE')[1];
      assert.deepStrictEqual(dr.query.getAll('from_date').sort(), ['gte.2031-06-02', 'lte.2031-06-16']);
      const batch = writes(b, 'phase_blocks').filter((r) => r.method === 'POST').pop();
      assert.strictEqual(batch.body.length, 3);
      assert.strictEqual(new Set(batch.body.map((r) => Object.keys(r).sort().join())).size, 1);
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => r.from_date).sort(), ['2030-01-01', '2031-06-02', '2031-06-09', '2031-06-16']);

      // undo = replaceAll: a delete with an EXPLICIT filter, then the insert.
      await t(() => window.__t.undoPhaseBuild()); await s.settle(500);
      const dels = b.requests.filter((r) => r.table === 'phase_blocks' && r.method === 'DELETE');
      const all = dels[dels.length - 1];
      assert.strictEqual(all.status, 204, 'the mock refuses an unfiltered DELETE (pg-safeupdate) and this one was accepted');
      assert.strictEqual(all.query.get('user_id'), 'eq.' + OWNER_ID);
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => r.from_date).sort(), ['2030-01-01']);
      assert.deepStrictEqual(s.warns(), [], 'no write was refused');
      await clean(s);
    } finally { await s.close(); }
  });

  test('"Change phase" and the race calendar edit write add vs update correctly (update by id when the block exists)', async () => {
    const b = new Backend({ imported: true });
    b.seed('phase_blocks', [{ id: 'b0', from_date: '2020-01-01', phase: 'base' }]);
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      await s.page.evaluate(() => window.__t.setPhaseFromToday('peak')); await s.settle(300);
      await s.page.evaluate(() => window.__t.setPhaseFromToday('taper')); await s.settle(300);
      assert.strictEqual(writes(b, 'phase_blocks').filter((r) => r.method === 'POST').length, 1, 'the second change the same day is an update');
      assert.strictEqual(writes(b, 'phase_blocks').filter((r) => r.method === 'PATCH').length, 1);
      assert.strictEqual(b.rows('phase_blocks').length, 2);
      assert.strictEqual(b.rows('phase_blocks').find((r) => r.id !== 'b0').phase, 'taper');
      await clean(s);
    } finally { await s.close(); }
  });

  test('ORDER: a phase build\'s deleteRange completes before its addBatch is sent (delete response delayed 700ms)', async () => {
    const b = new Backend({ imported: true });
    b.seed('phase_blocks', [{ id: 'old', from_date: '2031-06-09', phase: 'base' }]);
    b.inject((i) => i.table === 'phase_blocks' && i.method === 'DELETE', { delayMs: 700 });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      await s.page.evaluate(() => window.__t.applyPhaseBuild([{ from: '2031-06-02', phase: 'base' }, { from: '2031-06-09', phase: 'build1' }]));
      await s.page.waitForTimeout(2000);
      const del = b.requests.find((r) => r.table === 'phase_blocks' && r.method === 'DELETE');
      const post = b.requests.find((r) => r.table === 'phase_blocks' && r.method === 'POST');
      assert.ok(del && post, 'both writes went out');
      assert.ok(del.end - del.start >= 650, 'the delete really was held (' + (del.end - del.start) + 'ms)');
      assert.ok(post.start >= del.end - 5, 'the insert started ' + (post.start - del.end) + 'ms after the delete completed');
      assert.deepStrictEqual(b.rows('phase_blocks').map((r) => r.from_date).sort(), ['2031-06-02', '2031-06-09'], 'the new blocks survived the delete');
      await clean(s);
    } finally { await s.close(); }
  });

  test('a read waits for a write of its own kind still in flight (no stale replace of the device\'s own edit)', async () => {
    const b = new Backend({ imported: true });
    b.inject((i) => i.table === 'races' && i.method === 'POST', { delayMs: 600 });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      await s.page.evaluate(() => window.__t.addRace({ name: 'Fresh', date: '2031-05-05', url: '', notes: '', status: 'locked' }));
      await s.page.click('#tab-races');
      await s.page.waitForTimeout(1800);
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('Fresh'), 'the new race is still there after the refresh');
      assert.strictEqual(b.rows('races').length, 1);
      await clean(s);
    } finally { await s.close(); }
  });
});

describe('AC17 — failure fallback', () => {
  const SEEDED = { triMomentumRaces_v1: [{ id: 'r-c', name: 'Cached', date: '2031-06-01', url: '', notes: '', status: 'locked' }], triMomentumPlan_v1: [{ id: 'p-c', date: '2031-03-04', disc: 'run', title: 'Cached run', intensity: 'easy', duration: 30, key: false, notes: '', phase: '' }], triMomentumLog_v1: [{ id: 's-c', date: '2026-10-01', disc: 'swim', intensity: 'easy', duration: 30, a1: null, a2: null, a3: null, rpe: 3, b2: null, b3: null, note: '', phase: null, loggedAt: null }], triMomentumPhasePlan_v1: [{ id: 'ph-c', from: '2020-01-01', phase: 'base' }] };
  const FAILS = { timeout: { neverRespond: true }, '500': { status: 500, body: { message: 'boom' } }, '503': { status: 503, body: { message: 'down' } }, 'dropped connection': { abort: true }, '404': { status: 404, body: { message: 'gone' } } };
  for (const [label, action] of Object.entries(FAILS)) {
    test('reads: ' + label + ' on every table → the cache is kept, nothing throws', async () => {
      const b = new Backend({ imported: true }).seed('races', [{ id: 'srv', name: 'Server', race_date: '2031-07-07', url: '', notes: '', status: 'locked' }]);
      b.inject((i) => i.rest && READ_TABLES.includes(i.table) && i.method === 'GET', action);
      const s = await scenario(browser, synced(b, { timeoutMs: 400, localStorage: SEEDED }));
      try {
        await s.open(); await s.settle(900);
        for (const k of Object.keys(SEEDED)) assert.deepStrictEqual(await s.lsJson(k), SEEDED[k], k + ' kept');
        assert.ok(s.warns().some((w) => /could not read/.test(w)), 'says what failed');
        await s.page.click('#tab-races'); await s.page.click('#tab-dash'); await s.page.waitForTimeout(900);
        assert.ok((await s.page.textContent('#view-dashboard')).length > 0);
        await clean(s);
      } finally { await s.close(); }
    });
  }

  test('a failed write never blocks the UI or throws: one console.warn naming kind and action; the edit stays local', async () => {
    const b = new Backend({ imported: true });
    b.inject((i) => i.table === 'races' && i.method === 'POST', { status: 500, body: { message: 'insert failed' } });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      await s.page.evaluate(() => window.__t.addRace({ name: 'Local only', date: '2031-05-05', url: '', notes: '', status: 'locked' }));
      await s.settle(500);
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('Local only'), 'still shown locally');
      const warns = s.warns().filter((w) => /race add was not saved/.test(w));
      assert.strictEqual(warns.length, 1, 'exactly one warning: ' + JSON.stringify(s.warns()));
      await clean(s);
    } finally { await s.close(); }
  });

  test('a refused write (the DB says no) is reported the same way, per kind and action', async () => {
    const b = new Backend({ imported: true });
    b.inject((i) => i.table === 'plan_sessions' && i.method === 'PATCH', { status: 403, body: { code: '42501', message: 'permission denied' } });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      const id = await s.page.evaluate(() => window.__t.addPlanSession('2031-03-04', { disc: 'run', title: 't', intensity: 'easy', duration: 30, key: false, notes: '' }).id);
      await s.settle(300);
      await s.page.evaluate((i) => window.__t.updatePlanSession(i, { disc: 'run', title: 'edited', intensity: 'easy', duration: 30, key: false, notes: '' }), id);
      await s.settle(400);
      assert.strictEqual(s.warns().filter((w) => /plan update was not saved/.test(w)).length, 1);
      await clean(s);
    } finally { await s.close(); }
  });

  test('a 401 from a data call moves the app to signed-out mode', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(500);
      assert.strictEqual(await s.accountText(), 'Synced · sam@example.test');
      b.tokenExpired = true;
      await s.page.click('#tab-races'); await s.settle(600);
      assert.ok((await s.accountText()).startsWith('Not signed in'), await s.accountText());
      assert.strictEqual(await s.page.evaluate(() => window.__t.mode), 'signed-out');
      assert.ok(s.warns().some((w) => /rejected the session \(401\)/.test(w)));
      // and from then on it is local-only: no further REST calls
      const n = b.requests.filter((r) => r.rest).length;
      await s.page.click('#tab-dash'); await s.page.click('#tab-races'); await s.settle(400);
      assert.strictEqual(b.requests.filter((r) => r.rest).length, n);
      await clean(s);
    } finally { await s.close(); }
  });
});

describe('AC18 — session ids and the outbox', () => {
  test('logged signed out → sign in → exactly one insert, one row, shown once', async () => {
    const b = new Backend({ imported: true });
    const s = await scenario(browser, synced(b, { signedIn: false, localStorage: { triMomentumPhasePlan_v1: [{ id: 'ph', from: '2020-01-01', phase: 'base' }] } }));
    try {
      await s.open(); await s.settle(300);
      await completeCheckIn(s.page);
      const held = await s.lsJson('triMomentumPendingSessions_v1');
      assert.strictEqual(held.length, 1);
      assert.strictEqual(b.requests.filter((r) => r.rest).length, 0, 'nothing sent while signed out');
      // "Sign in": the session arrives (storage seeded as the OAuth return would), then a reload — persistence is the point here.
      await s.page.evaluate(([k, v]) => localStorage.setItem(k, v), [require('./lib/supabase-mock').STORAGE_KEY, b.sessionJson()]);
      await s.page.reload(); await s.settle(600);
      assert.strictEqual(writes(b, 'session_checkins').length, 1, 'one insert');
      assert.strictEqual(b.rows('session_checkins').length, 1, 'one row');
      assert.strictEqual(b.rows('session_checkins')[0].id, held[0].id, 'the same id');
      assert.deepStrictEqual(await s.lsJson('triMomentumPendingSessions_v1'), []);
      const log = await s.lsJson('triMomentumLog_v1');
      assert.strictEqual(log.filter((e) => e.id === held[0].id).length, 1, 'shown once');
      // flush BEFORE the cache is replaced: the POST precedes the log GET that replaced it
      const iPost = b.requests.findIndex((r) => r.table === 'session_checkins' && r.method === 'POST');
      const iGet = b.requests.findIndex((r) => r.table === 'session_checkins' && r.method === 'GET');
      assert.ok(iPost < iGet, 'insert (' + iPost + ') before the read (' + iGet + ')');
      await clean(s);
    } finally { await s.close(); }
  });

  test('a failed insert is held, then flushed once on the next load; the row is not duplicated', async () => {
    const b = new Backend({ imported: true });
    const rule = b.inject((i) => i.table === 'session_checkins' && i.method === 'POST', { status: 500, body: { message: 'down' } });
    const s = await scenario(browser, synced(b, { localStorage: { triMomentumPhasePlan_v1: [{ id: 'ph', from: '2020-01-01', phase: 'base' }] } }));
    try {
      await s.open(); await s.settle(400);
      await completeCheckIn(s.page); await s.settle(500);
      assert.strictEqual((await s.lsJson('triMomentumPendingSessions_v1')).length, 1, 'held after the failure');
      assert.ok(s.warns().some((w) => /session save was not saved/.test(w)));
      assert.strictEqual(b.rows('session_checkins').length, 0);
      const id = (await s.lsJson('triMomentumPendingSessions_v1'))[0].id;
      // While it is held, a refresh must not drop it from the log either.
      await s.page.click('#tab-dash'); await s.settle(500);
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).filter((e) => e.id === id).length, 1, 'still shown, once, while pending');
      b.rules.splice(b.rules.indexOf(rule), 1);   // the network is back
      await s.page.reload(); await s.settle(700);   // persistence is the point
      assert.strictEqual(b.rows('session_checkins').length, 1);
      assert.strictEqual(writes(b, 'session_checkins').filter((r) => r.status === 201).length, 1, 'flushed exactly once');
      assert.deepStrictEqual(await s.lsJson('triMomentumPendingSessions_v1'), []);
      assert.strictEqual((await s.lsJson('triMomentumLog_v1')).filter((e) => e.id === id).length, 1);
      await clean(s);
    } finally { await s.close(); }
  });

  test('the server already holds a held entry (the response was lost): it is shown once and leaves the outbox', async () => {
    const b = new Backend({ imported: true }).seed('session_checkins', [sess('s-dup', '2026-10-02')]);
    b.inject((i) => i.table === 'session_checkins' && i.method === 'POST', { status: 500, body: { message: 'lost ack' } });
    const held = { id: 's-dup', date: '2026-10-02', disc: 'run', intensity: 'easy', duration: 45, a1: null, a2: null, a3: null, rpe: 4, b2: null, b3: null, note: '', phase: null, loggedAt: null };
    const s = await scenario(browser, synced(b, { localStorage: { triMomentumPendingSessions_v1: [held] } }));
    try {
      await s.open(); await s.settle(700);
      const log = await s.lsJson('triMomentumLog_v1');
      assert.strictEqual(log.filter((e) => e.id === 's-dup').length, 1);
      assert.deepStrictEqual(await s.lsJson('triMomentumPendingSessions_v1'), [], 'the server has it: confirmed');
      await clean(s);
    } finally { await s.close(); }
  });

  test('races, plan and phase writes have no outbox: a failed one is simply replaced by the next successful read', async () => {
    const b = new Backend({ imported: true });
    const rule = b.inject((i) => i.table === 'races' && i.method === 'POST', { status: 500, body: { message: 'down' } });
    const s = await scenario(browser, synced(b));
    try {
      await s.open(); await s.settle(400);
      await s.page.evaluate(() => window.__t.addRace({ name: 'Doomed', date: '2031-05-05', url: '', notes: '', status: 'locked' }));
      await s.settle(400);
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('Doomed'), 'survives locally');
      assert.strictEqual(await s.ls('triMomentumPendingRaces_v1'), null, 'no outbox for races');
      b.rules.splice(b.rules.indexOf(rule), 1);
      await s.page.click('#tab-races'); await s.settle(500);
      assert.ok(!(await s.ls('triMomentumRaces_v1')).includes('Doomed'), 'replaced by the next successful read');
      assert.strictEqual(b.rows('races').length, 0, 'and never retried');
      await clean(s);
    } finally { await s.close(); }
  });

  test('imported sessions and app sessions get distinct id shapes (s… vs sheet-…)', async () => {
    const s = await scenario(browser, synced(new Backend({ imported: true })));
    try {
      await s.open(); await s.settle(300);
      const id = await s.page.evaluate(() => window.__t.newSessionId());
      assert.match(id, /^s[0-9a-z]{6,}$/);
      assert.ok(!id.startsWith('sheet-'));
    } finally { await s.close(); }
  });
});
