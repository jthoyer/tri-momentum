'use strict';
// Strava minutes against planned minutes (CLAUDE.md decision 50).
//
// Code.gs's Strava sync writes ActualMin into the session sheet; listSessions_
// now reads it back as `actualMin`. These tests drive the real index.html with
// the Sheet's ?list=1 and ?plan=1 responses mocked at the http layer, then read
// This week › Adherence as an athlete would. They check three things: the
// number reaches the screen, the week total only covers sessions that have
// both a plan and a Strava figure, and an athlete with no Strava data sees no
// change at all.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { serveApp, chromiumPath } = require('./lib/app');

// Dates inside the real current week, whatever day CI runs on. The matcher
// pairs plan and log by (date, disc) with no reference to today, so a logged
// session later in the week still pairs.
function weekDate(offset) {
  const d = new Date();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  monday.setDate(monday.getDate() + offset);
  const p = (n) => String(n).padStart(2, '0');
  return monday.getFullYear() + '-' + p(monday.getMonth() + 1) + '-' + p(monday.getDate());
}

const MON = weekDate(0), TUE = weekDate(1), WED = weekDate(2), THU = weekDate(3), FRI = weekDate(4);

const PLAN = [
  { id: 'p1', date: MON, disc: 'swim', title: 'Squad', intensity: 'easy', duration: 60, key: false, notes: '', phase: 'base' },
  { id: 'p2', date: TUE, disc: 'bike', title: 'Hills', intensity: 'hard', duration: 90, key: false, notes: '', phase: 'base' },
  { id: 'p3', date: WED, disc: 'run', title: 'Easy', intensity: 'easy', duration: 45, key: false, notes: '', phase: 'base' },
];

function session(when, disc, duration, actualMin, a2) {
  return { when, disc, duration, intensity: 'easy', rpe: 4, a1: 'intent', a2: a2 || 'planned', a3: '', b2: '', b3: '', note: '', phase: 'base', actualMin };
}

async function launch(sessions, plan) {
  const server = await serveApp({
    routes: {
      'list=1': JSON.stringify({ ok: true, sessions }),
      'plan=1': JSON.stringify({ ok: true, plan: plan || PLAN }),
      'races=1': JSON.stringify({ ok: true, races: [] }),
      'phases=1': JSON.stringify({ ok: true, phases: [{ id: 'ph1', from: '2020-01-01', phase: 'base' }] }),
    },
  });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(server.origin);
  await page.waitForTimeout(400);
  await page.click('#tab-dash');
  await page.waitForTimeout(300);
  await page.click('#view-dashboard [data-signal="adherence"]');
  await page.waitForTimeout(200);
  return { server, browser, page, errors };
}

describe('Strava minutes — synced sessions', { concurrency: false }, () => {
  let server, browser, page, errors;

  before(async () => {
    ({ server, browser, page, errors } = await launch([
      session(MON, 'swim', '60', 52),     // planned 60, Strava 52
      session(TUE, 'bike', '120', null),  // logged, Strava hasn't matched it yet
    ]));
  });
  after(async () => { await browser.close(); await server.close(); });

  test('a synced session shows Strava minutes against its planned minutes', async () => {
    const lines = await page.locator('.dash-plan-actual').allTextContents();
    assert.deepStrictEqual(lines, ['Strava: 52 min of 60 planned']);
  });

  test('the week total covers only sessions with both figures, and names the unsynced one', async () => {
    const text = await page.locator('.dash-plan-strava').textContent();
    assert.strictEqual(text,
      'Strava: 52 of 60 planned minutes (87%), across 1 synced session. 1 logged session has no Strava data yet.');
  });

  test('scoring is unchanged: both logged sessions still count, the run is still due', async () => {
    const n = await page.locator('.dash-stat-n').first().textContent();
    assert.match(n, /^2 of /);
  });

  test('actualMin survives into the local cache', async () => {
    const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('triMomentumLog_v1') || '[]'));
    const swim = cached.find((e) => e.disc === 'swim');
    assert.ok(swim, 'swim entry cached');
    assert.strictEqual(swim.actualMin, 52);
  });

  test('no page errors', () => {
    assert.deepStrictEqual(errors.filter((e) => !/Failed to fetch|NetworkError/.test(e)), []);
  });
});

describe('Strava minutes — no Strava data at all', { concurrency: false }, () => {
  let server, browser, page;

  before(async () => {
    ({ server, browser, page } = await launch([
      session(MON, 'swim', '60', null),
      session(TUE, 'bike', '120', undefined), // a deployment that predates the field
    ]));
  });
  after(async () => { await browser.close(); await server.close(); });

  test('shows no Strava line anywhere', async () => {
    // The plan list must have rendered, or the zero counts below prove nothing.
    assert.strictEqual(await page.locator('.dash-plan-week').count(), 1);
    assert.strictEqual(await page.locator('.dash-plan-actual').count(), 0);
    assert.strictEqual(await page.locator('.dash-plan-strava').count(), 0);
  });
});

// Two swims planned on one day, one logged. The Strava line must follow the
// greedy matcher Adherence runs (first planned swim takes the log row), so
// exactly one line appears, on the first swim. A find-by-(date, disc) that
// ignored the matcher would draw it on both.
describe('Strava minutes — pairing follows the Adherence matcher', { concurrency: false }, () => {
  let server, browser, page;

  before(async () => {
    ({ server, browser, page } = await launch([
      session(THU, 'swim', '30', 31),
      session(FRI, 'run', '60', null, 'didnt'),
    ], [
      { id: 's1', date: THU, disc: 'swim', title: 'Drills', intensity: 'easy', duration: 30, key: false, notes: '', phase: 'base' },
      { id: 's2', date: THU, disc: 'swim', title: 'Endurance', intensity: 'easy', duration: 45, key: false, notes: '', phase: 'base' },
      { id: 'r1', date: FRI, disc: 'run', title: 'Tempo', intensity: 'hard', duration: 50, key: false, notes: '', phase: 'base' },
    ]));
  });
  after(async () => { await browser.close(); await server.close(); });

  test('one Strava line, on the first planned swim', async () => {
    const lines = page.locator('.dash-plan-actual');
    assert.strictEqual(await lines.count(), 1);
    assert.strictEqual(await lines.first().textContent(), 'Strava: 31 min of 30 planned');
    const owner = await lines.first().evaluate((n) => n.closest('.dash-plan-line').textContent);
    assert.match(owner, /Drills/);
  });

  test('a session logged as didn\'t happen is not counted as waiting on Strava', async () => {
    const text = await page.locator('.dash-plan-strava').textContent();
    assert.strictEqual(text, 'Strava: 31 of 30 planned minutes (103%), across 1 synced session.');
  });
});
