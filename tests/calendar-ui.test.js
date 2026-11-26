'use strict';
// The Calendar start screen (CLAUDE.md decision 50, docs/specs/calendar-start-screen.md
// section 8, criteria A1-A25), driven through the real UI.
//
// Runs against the shipped index.html over http, local-only by default (the
// Supabase key and the Sheet address both blank, so nothing can overwrite a
// seeded scenario). The background-refresh scenarios (A25, H1, M1-new, M2, L-a)
// are about what happens when a READ lands, so they run with `sb: true`: signed
// in to a synced Supabase mock (tests/lib/supabase-mock.js) seeded from the same
// fixture. They were Sheet-route scenarios before the storage moved; each keeps
// its name and its assertions, only the way the data arrives and changes is new.
// No test hook lives in the shipped file: everything below reads the DOM or
// localStorage.
//
// ISOLATION. Every scenario gets its own browser context — fresh cookies, a
// fresh localStorage, a fresh page — and a pinned clock (Australia/Sydney, so
// "today" never depends on the machine running the suite). The seed is written
// once per context (guarded by a flag, so a reload inside a scenario keeps what
// the app wrote). The two scenarios that deliberately share a session do so
// inside one test function and say why. Nothing is shared between tests except
// the http server and the browser process.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { serveApp, guardNetwork, chromiumPath, loadFunctions, extractFunction } = require('./lib/app');
const { KEYS, F1, F2, F3, planItem, logEntry, serverRows, canonical, planRow, phaseRow, sessionRow } = require('./lib/calendar-fixtures');
const { Backend } = require('./lib/supabase-mock');
const { KEY } = require('./lib/scenario');

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

let server, browser;

before(async () => {
  server = await serveApp();
  browser = await chromium.launch({ executablePath: chromiumPath() });
});
after(async () => {
  await browser.close();
  await server.close();
});

// One scenario = one fresh context. `fx` is a fixture ({now, plan, log, phases,
// races}); any key it omits is simply not seeded. A scenario passes only if its
// page raised no errors (A24).
//
// opts.sb: the scenario runs signed in to a synced Supabase mock (its own
// server and its own mock, so nothing is shared) seeded from the fixture; the
// cache is seeded with the CANONICAL copy of the fixture, i.e. what a device
// that has already synced holds, so a read of unchanged data is unchanged.
// `fn(page, ctx, sb)` gets {backend, guard} to change what the server holds
// part-way through. The scenario ends by asserting nothing unmocked was reached.
function scenario(name, fx, opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  test(name, async () => {
    let sb = null, srv = server;
    const seedFx = opts.sb ? canonical(fx) : fx;
    if (opts.sb) {
      const backend = new Backend({ imported: true });
      const rows = serverRows(fx);
      Object.keys(rows).forEach((t) => backend.seed(t, rows[t]));
      srv = await serveApp({ key: KEY });
      sb = { backend };
    }
    const ctx = await browser.newContext({
      viewport: { width: opts.width || 390, height: 900 },
      timezoneId: 'Australia/Sydney',
      serviceWorkers: 'block',
    });
    if (sb) {
      sb.guard = await guardNetwork(ctx);
      await sb.backend.install(ctx);
      await sb.backend.seedSignedIn(ctx);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.clock.setFixedTime(new Date(opts.now || fx.now || F1.now));
      await page.addInitScript(([keys, data, raw]) => {
        if (localStorage.getItem('__seeded')) { return; }
        localStorage.setItem('__seeded', '1');
        for (const k of ['log', 'plan', 'races', 'phases']) {
          if (raw && raw[k] !== undefined) { localStorage.setItem(keys[k], raw[k]); }
          else if (data[k]) { localStorage.setItem(keys[k], JSON.stringify(data[k])); }
        }
      }, [KEYS, seedFx, opts.raw || null]);
      await page.goto(srv.origin);
      await page.waitForSelector('#calendar-h');
      if (sb) {
        // Signed in: wait for the device to reach `synced` (its first reads are
        // then in), the account line being the app's own statement of the mode.
        await page.waitForFunction(() => { const n = document.getElementById('cal-account-line'); return !!n && /^Synced/.test(n.textContent); });
      }
      await page.waitForTimeout(250);
      await fn(page, ctx, sb);
      assert.deepStrictEqual(errors, [], 'page errors (A24): ' + errors.join(' | '));
      if (sb) { assert.deepStrictEqual(sb.guard.blocked, [], 'nothing unmocked was reached'); }
    } finally {
      await ctx.close();
      if (srv !== server) { await srv.close(); }
    }
  });
}

const selectDay = (page, iso) => page.click('.cal-chip[data-date="' + iso + '"]');
const pressedDate = (page) => page.$eval('.cal-chip[aria-pressed="true"]', (n) => n.getAttribute('data-date'));
const calVisible = (page) => page.isVisible('#view-calendar');
const flowVisible = (page) => page.isVisible('#view-flow');
const tabStates = (page) =>
  page.$$eval('#view-tabs .view-tab', (ns) => Object.fromEntries(ns.map((n) => [n.id, n.getAttribute('aria-selected')])));

// Every card of the selected day, as plain data.
const SEGS = ['good', 'mid', 'bad', 'missed', 'planned', 'extra', 'na'];
const cards = (page) =>
  page.$$eval('.cal-card', (ns, segs) => ns.map((n) => {
    const seg = n.querySelector('.cal-card-seg');
    return {
      title: n.querySelector('.cal-card-title').textContent,
      word: n.querySelector('.cal-card-word') ? n.querySelector('.cal-card-word').textContent : null,
      seg: seg ? [...seg.classList].filter((c) => segs.includes(c))[0] : null,
      key: !!n.querySelector('.plan-item-key'),
      cta: !!n.querySelector('.cal-card-cta'),
      edit: !!n.querySelector('.cal-card-edit'),
      logged: n.classList.contains('is-logged'),
    };
  }), SEGS);

// Walks Next until the review screen and returns {date, disc, ...} -> label
// ("Not answered" when unset). Review lists every question the flow asks, so
// this reads the whole of state.ans through the real UI without a hook.
const REVIEW_KEYS = [
  ['date', 'Which day was this session'], ['disc', 'Which session was it'],
  ['b3', 'Any pain, tightness or niggle'], ['duration', 'Roughly how long'],
  ['intensity', 'Was it meant to be easy or hard'], ['rpe', 'How hard was it'],
  ['a1', 'Did it finish at the effort you intended'], ['a3', 'Did you fuel during it'],
  ['a2', 'Did you do it as planned'], ['b2', 'How did it feel'],
];
async function reviewAnswers(page) {
  for (let i = 0; i < 12 && norm(await page.textContent('#btn-next')) !== 'Save'; i++) {
    await page.click('#btn-next');
  }
  const rows = await page.$$eval('.review-row', (ns) => ns.map((n) => [n.querySelector('.review-q').textContent, n.querySelector('.review-a').textContent]));
  const out = {};
  for (const [q, a] of rows) {
    const hit = REVIEW_KEYS.find(([, prefix]) => q.startsWith(prefix));
    assert.ok(hit, 'unrecognised review row: ' + q);
    out[hit[0]] = a;
  }
  return out;
}
const UNSET = 'Not answered';
function assertOutcomesUnset(ans, keys) {
  for (const k of keys) { assert.strictEqual(ans[k], UNSET, k + ' must never be pre-filled, got ' + ans[k]); }
}

// ───────────────────────────── A1, A2, A3 ─────────────────────────────
describe('start screen and navigation', { concurrency: false }, () => {
  scenario('A1 boots on Calendar (F1)', F1, async (page) => {
    assert.ok(await page.isVisible('#app-main'), '#app-main visible');
    assert.ok(await calVisible(page), 'Calendar visible');
    assert.ok((await page.$('.splash')) === null, 'no .splash element');
    assert.ok((await page.$('#view-splash')) === null, 'no #view-splash element');
    assert.strictEqual((await tabStates(page))['tab-flow'], 'true');
    // Boot paints quietly: no focus move (spec P10).
    assert.strictEqual(await page.evaluate(() => document.activeElement === document.body), true, 'focus stays on <body> at boot');
  });
  scenario('A1 boots on Calendar with nothing in localStorage', {}, async (page) => {
    assert.ok(await page.isVisible('#app-main'));
    assert.ok(await calVisible(page));
    assert.strictEqual((await tabStates(page))['tab-flow'], 'true');
  });
  scenario('A1 boots on Calendar with unreadable localStorage', F1,
    { raw: { log: '{nope', plan: '[[[', races: 'x', phases: 'null' } }, async (page) => {
    assert.ok(await page.isVisible('#app-main'));
    assert.ok(await calVisible(page));
    assert.ok((await page.$('.splash')) === null, 'no .splash');
  });

  for (const tab of ['tab-warmup', 'tab-strength', 'tab-dash', 'tab-races']) {
    scenario('A2 Check-in opens Calendar from #' + tab, F1, async (page) => {
      await page.click('#' + tab);
      assert.strictEqual(await calVisible(page), false, 'Calendar is hidden on another tab');
      await page.click('#tab-flow');
      assert.ok(await calVisible(page), 'Calendar shows');
      assert.strictEqual(await page.$eval('.cal-agenda-title', (n) => n.firstChild.textContent), 'Today', 'the agenda reads Today');
      assert.strictEqual(norm(await page.textContent('.cal-agenda-date')), 'Tuesday 24 November', 'with the full date beside it');
      assert.strictEqual(await pressedDate(page), '2026-11-24', "today's chip is pressed");
      assert.strictEqual(norm(await page.textContent('.cal-week-nav .plan-week-num')), 'Week 48');
      // Every tab does this: the heading takes focus.
      assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'calendar-h');
    });
  }
  scenario('A2 Check-in opens Calendar from the middle of a different week and month', F1, async (page) => {
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    await page.click('#cal-tab-month');
    await page.click('#tab-dash');
    await page.click('#tab-flow');
    assert.strictEqual(await page.isVisible('#cal-tab-week[aria-selected="true"]'), true, 'back on Week');
    assert.strictEqual(norm(await page.textContent('.cal-week-nav .plan-week-num')), 'Week 48');
    assert.strictEqual(await pressedDate(page), '2026-11-24');
  });
  scenario('A2 with no phase set, Check-in still opens Calendar (no picker)', { ...F1, phases: [] }, async (page) => {
    await page.click('#tab-dash');
    await page.click('#tab-flow');
    assert.ok(await calVisible(page));
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), true, 'the phase picker is not shown');
    assert.strictEqual(await pressedDate(page), '2026-11-24');
  });
  scenario('A3 #tab-flow is selected for Calendar and for the flow; the other four are not', F1, async (page) => {
    const want = (flow, dash) => ({
      'tab-warmup': 'false', 'tab-strength': 'false', 'tab-flow': flow, 'tab-dash': dash, 'tab-races': 'false',
    });
    assert.deepStrictEqual(await tabStates(page), want('true', 'false'), 'on Calendar');
    await page.click('.cal-card-cta');            // Tue bike's CTA is the only one today
    assert.ok(await flowVisible(page));
    assert.deepStrictEqual(await tabStates(page), want('true', 'false'), 'in the flow');
    await page.click('#tab-dash');
    assert.deepStrictEqual(await tabStates(page), want('false', 'true'), 'on Review');
    await page.click('#tab-flow');
    assert.deepStrictEqual(await tabStates(page), want('true', 'false'), 'back on Calendar');
  });
});

describe('announcements', { concurrency: false }, () => {
  scenario('say() is exposed on the Calendar and announces a day change exactly once', F1, async (page) => {
    // The live region used to sit inside the check-in flow, which is hidden on
    // every other view — a hidden live region announces nothing.
    assert.strictEqual(await page.evaluate(() => document.getElementById('live').closest('[hidden]')), null, '#live is not inside a hidden subtree');
    // A live region is transient: record its history, not its final text.
    await page.evaluate(() => {
      window.__said = [];
      new MutationObserver(() => {
        const t = document.getElementById('live').textContent;
        if (t) { window.__said.push(t); }
      }).observe(document.getElementById('live'), { childList: true, characterData: true, subtree: true });
    });
    await selectDay(page, '2026-11-23');
    await page.waitForTimeout(200);
    assert.deepStrictEqual(await page.evaluate(() => window.__said), ['Showing Monday 23 November.']);
  });
});

// ───────────────────────────── A4, A5, A6, A7, A8 ─────────────────────────────
describe('the week: summary, chips, race strip, cards', { concurrency: false }, () => {
  scenario('A4 week summary for F1', F1, async (page) => {
    assert.strictEqual(norm(await page.textContent('.cal-summary-week')), 'Week 48');
    assert.strictEqual(norm(await page.textContent('.cal-summary .month-week-pill')), 'Build 1');
    const stats = await page.$$eval('.cal-stat', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepStrictEqual(stats, ['Planned 7h05', 'Logged 2h00']);
    assert.strictEqual(await page.getAttribute('.cal-meter', 'aria-label'), 'Logged 2h00 of 7h05 planned');
    assert.strictEqual(norm(await page.textContent('.cal-note')), 'Times are approximate');
  });
  scenario('A4 no meter when nothing is planned, no pill when no phase resolves', { ...F2, phases: [] }, async (page) => {
    assert.ok((await page.$('.cal-meter')) === null, 'no meter with nothing planned');
    assert.ok((await page.$('.cal-summary .month-week-pill')) === null, 'no pill when the phase is null');
    const stats = await page.$$eval('.cal-stat', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepStrictEqual(stats, ['Planned 0h00', 'Logged 1h00']);
  });
  scenario('A5 day chips', F1, async (page) => {
    const chips = await page.$$eval('.cal-chip', (ns) => ns.map((n) => ({
      date: n.getAttribute('data-date'),
      pressed: n.getAttribute('aria-pressed'),
      today: n.classList.contains('is-today'),
      mins: n.querySelector('.cal-chip-min').textContent,
      label: n.getAttribute('aria-label'),
      dots: n.querySelectorAll('.cal-chip-dot').length,
    })));
    assert.strictEqual(chips.length, 7);
    assert.deepStrictEqual(chips.map((c) => c.date),
      ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    assert.deepStrictEqual(chips.map((c) => c.mins), ['60m', '60m', '–', '–', '–', '–', '–']);
    assert.deepStrictEqual(chips.map((c) => c.pressed), ['false', 'true', 'false', 'false', 'false', 'false', 'false']);
    assert.deepStrictEqual(chips.map((c) => c.today), [false, true, false, false, false, false, false]);
    assert.deepStrictEqual(chips.map((c) => c.dots), [2, 3, 1, 0, 1, 1, 0], 'planned + unplanned sessions, at most four');
    assert.ok(chips[0].label.includes('Monday 23 November 2026'), chips[0].label);
    assert.ok(chips[1].label.includes('Tuesday 24 November 2026') && chips[1].label.includes('today'), chips[1].label);
    assert.ok(chips[1].label.includes('2 planned') && chips[1].label.includes('1 unplanned') && chips[1].label.includes('60 minutes logged'), chips[1].label);
    assert.ok(chips[3].label.includes('0 planned') && chips[3].label.includes('nothing logged'), chips[3].label);
    assert.strictEqual(await page.getAttribute('.cal-chips', 'role'), 'group');
  });
  scenario('A5 a day with more than four sessions still shows four dots, counts in the name', {
    ...F1,
    plan: F1.plan.concat([1, 2, 3].map((i) => planItem('x' + i, '2026-11-26', 'run', 'Extra ' + i, 20, 'easy'))).concat([
      planItem('x4', '2026-11-26', 'swim', 'Extra 4', 20, 'easy'), planItem('x5', '2026-11-26', 'bike', 'Extra 5', 20, 'easy'),
    ]),
  }, async (page) => {
    assert.strictEqual(await page.$$eval('.cal-chip[data-date="2026-11-26"] .cal-chip-dot', (ns) => ns.length), 4);
    assert.ok((await page.getAttribute('.cal-chip[data-date="2026-11-26"]', 'aria-label')).includes('5 planned'));
  });
  scenario('A6 race strip for the locked race', F1, async (page) => {
    assert.strictEqual(norm(await page.textContent('.cal-race')), 'Sample race · 16 weeks · 4 days to go');
    assert.strictEqual(await page.$eval('.cal-race', (n) => n.tagName), 'P', 'static text, not a control');
  });
  scenario('A6 race strip is absent with only considering races', { ...F1, races: [F1.races[1]] }, async (page) => {
    assert.ok((await page.$('.cal-race')) === null, 'no .cal-race');
  });
  for (const bad of ['TBC', '2027-02-30', '']) {
    scenario('A6 race strip is absent for a locked race dated ' + JSON.stringify(bad) + ' (no "NaN weeks")', {
      ...F1, races: [{ id: 'b', name: 'Mystery', date: bad, status: 'locked', url: '', notes: '' }],
    }, async (page) => {
      assert.ok((await page.$('.cal-race')) === null, 'no .cal-race');
      assert.ok(!(await page.textContent('#view-calendar')).includes('NaN'));
    });
  }
  scenario('A6 a bad locked race does not hide a good one behind it', {
    ...F1, races: [{ id: 'b', name: 'Mystery', date: 'TBC', status: 'locked', url: '', notes: '' }, F1.races[0]],
  }, async (page) => {
    assert.strictEqual(norm(await page.textContent('.cal-race')), 'Sample race · 16 weeks · 4 days to go');
  });

  const WORD_SEG = {
    'As planned': 'good', 'Adjusted': 'mid', 'Off plan': 'bad', 'Missed': 'missed',
    'Not due yet': 'planned', 'To log': 'planned', 'Unplanned': 'extra',
  };
  scenario('A7 status words and segment classes for every day of F1', F1, async (page) => {
    const expected = {
      '2026-11-23': [['Swim — Squad', 'As planned'], ['Strength — Gym A', 'Missed']],
      '2026-11-24': [['Run — Easy run', 'Adjusted'], ['Bike — Turbo', 'To log'], ['Swim', 'Unplanned']],
      '2026-11-25': [['Swim — Technique', 'Not due yet']],
      '2026-11-26': [],
      '2026-11-27': [['Run — Run intervals', 'Not due yet']],
      '2026-11-28': [['Bike — Long ride', 'Not due yet']],
      '2026-11-29': [],
    };
    for (const [iso, want] of Object.entries(expected)) {
      await selectDay(page, iso);
      const got = await cards(page);
      assert.deepStrictEqual(got.map((c) => [c.title, c.word]), want, iso);
      for (const c of got) { assert.strictEqual(c.seg, WORD_SEG[c.word], iso + ' ' + c.title + ': segment class matches the word'); }
    }
    await selectDay(page, '2026-11-27');
    assert.strictEqual((await cards(page))[0].key, true, 'Fri run carries the Key pill');
    await selectDay(page, '2026-11-23');
    assert.deepStrictEqual((await cards(page)).map((c) => c.key), [false, false], 'only Fri run is a key session');
  });
  scenario('A7 a session logged as "didn\'t do it" reads Off plan, not Missed', {
    ...F1, log: F1.log.concat([logEntry('2026-11-23', 'strength', 30, 'didnt')]),
  }, async (page) => {
    await selectDay(page, '2026-11-23');
    const got = await cards(page);
    const gym = got.find((c) => c.title === 'Strength — Gym A');
    assert.deepStrictEqual([gym.word, gym.seg, gym.logged, gym.cta], ['Off plan', 'bad', true, false]);
  });
  scenario('A7 the grid and the cards cannot disagree: one shared mapping', F1, async () => {
    const { planResultSeg } = loadFunctions(['planResultSeg']);
    assert.strictEqual(planResultSeg({ cat: 'good', entry: {} }), 'good');
    assert.strictEqual(planResultSeg({ cat: 'mid', entry: {} }), 'mid');
    assert.strictEqual(planResultSeg({ cat: 'bad', entry: {} }), 'bad');
    assert.strictEqual(planResultSeg({ cat: 'bad', entry: null }), 'missed');
    assert.strictEqual(planResultSeg({ cat: 'pending', entry: null }), 'planned');
    // Both consumers go through it; neither carries its own copy of the table.
    assert.ok(extractFunction('planDashCell').includes('planResultSeg('), 'Review grid uses the shared mapping');
    assert.ok(extractFunction('calPlannedCard').includes('planResultSeg('), 'Calendar cards use the shared mapping');
  });
  scenario('A8 "Check in on this" appears on Mon strength and Tue bike only', F1, async (page) => {
    const ctasByDay = {};
    for (const iso of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) {
      await selectDay(page, iso);
      ctasByDay[iso] = (await cards(page)).filter((c) => c.cta).map((c) => c.title);
    }
    assert.deepStrictEqual(ctasByDay, {
      '2026-11-23': ['Strength — Gym A'], '2026-11-24': ['Bike — Turbo'],
      '2026-11-25': [], '2026-11-26': [], '2026-11-27': [], '2026-11-28': [], '2026-11-29': [],
    });
    await selectDay(page, '2026-11-24');
    const tue = await cards(page);
    assert.strictEqual(tue.find((c) => c.word === 'Adjusted').cta, false, 'a logged card is a static record');
    assert.strictEqual(tue.find((c) => c.word === 'Unplanned').cta, false, 'the Unplanned card has no CTA');
    assert.strictEqual(tue.find((c) => c.word === 'Unplanned').edit, false, 'log entries are not editable');
    assert.ok(tue.filter((c) => c.title !== 'Swim').every((c) => c.edit), 'every planned card has Edit, logged or not');
  });
});

// ───────────────────────────── A9, A10, A11, A12 ─────────────────────────────
describe('starting a check-in from the Calendar', { concurrency: false }, () => {
  scenario('A9 Tue bike CTA: dated today, disc/intensity/duration only, nothing else pre-filled', F1, async (page) => {
    await selectDay(page, '2026-11-24');
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.date, 'Today');
    assert.strictEqual(ans.disc, 'Bike');
    assert.strictEqual(ans.intensity, 'Hard / quality');
    assert.strictEqual(ans.duration, '45–90 min', '60 planned minutes -> the "60" bucket');
    // a1 and every other outcome field: never pre-filled, through this path.
    assertOutcomesUnset(ans, ['a1', 'a2', 'a3', 'b2', 'b3', 'rpe']);
  });
  scenario('A9 Mon strength CTA: dated 23 Nov', F1, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.date, 'Mon 23 Nov');
    assert.strictEqual(ans.disc, 'Strength');
    assert.strictEqual(ans.intensity, 'Easy / steady');
    assert.strictEqual(ans.duration, '≤ 45 min');
    assertOutcomesUnset(ans, ['a1', 'a2', 'b2', 'b3', 'rpe']);
    assert.strictEqual(ans.a3, undefined, 'fuelling is not asked of a short session');
  });
  scenario('A10 with no phase: Calendar boots without the picker; a CTA gates on it, then lands with the same date and pre-fill', { ...F1, phases: [] }, async (page) => {
    assert.ok(await calVisible(page));
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), true, 'no picker at boot');
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), false, 'the CTA shows the picker');
    assert.strictEqual(await flowVisible(page), false);
    await page.click('#period-choices .choice:has-text("Build 1")');
    assert.ok(await flowVisible(page), 'lands in the flow');
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.date, 'Mon 23 Nov', 'the held tap kept its own date, not today');
    assert.strictEqual(ans.disc, 'Strength');
    assert.strictEqual(ans.duration, '≤ 45 min');
    assertOutcomesUnset(ans, ['a1', 'a2', 'b2', 'b3', 'rpe']);
    assert.strictEqual(await page.textContent('#flow-phase-label'), 'Build 1', 'the chosen phase is the one it will be stamped with');
  });
  scenario('A10 with no phase: "Log an unplanned session" gates the same way', { ...F1, phases: [] }, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-unplanned');
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), false);
    await page.click('#period-choices .choice:has-text("Base")');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.date, 'Mon 23 Nov');
    assertOutcomesUnset(ans, ['disc', 'duration', 'intensity', 'a1', 'a2', 'b2', 'b3', 'rpe']);
    assert.strictEqual(ans.a3, undefined, 'fuelling is not asked until a long duration is chosen');
  });
  scenario('A10 walking away from the picker abandons the held check-in', { ...F1, phases: [] }, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    await page.click('#tab-dash');                       // leaves the picker unanswered
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), true);
    await page.click('#view-dashboard .dash-phase-change');   // Review's "Change phase →"
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), false);
    await page.click('#period-choices .choice:has-text("Peak")');
    assert.strictEqual(await flowVisible(page), false, 'a later Change phase must not resurrect the abandoned check-in');
  });
  scenario('A11 decision 19: Change phase inside the flow returns to the same question, answers intact', F1, async (page) => {
    await page.click('.cal-unplanned');
    await page.click('#o-disc-swim');
    await page.waitForTimeout(700);                      // the debounced auto-advance
    const heading = norm(await page.textContent('#step-h'));
    assert.strictEqual(heading, 'Any pain, tightness or niggle?');
    await page.click('#flow-phase-change');
    assert.strictEqual(await page.$eval('#view-period', (el) => el.hidden), false);
    await page.click('#period-choices .choice:has-text("Peak")');
    assert.ok(await flowVisible(page));
    assert.strictEqual(norm(await page.textContent('#step-h')), heading, 'same question');
    assert.strictEqual(await page.textContent('#flow-phase-label'), 'Peak');
    await page.click('#btn-back');
    assert.strictEqual(await page.isChecked('#o-disc-swim'), true, 'the answer given before the detour is still there');
  });
  scenario('A12 unplanned: dated the selected day, nothing else set; absent on a future day', F1, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-unplanned');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.date, 'Mon 23 Nov');
    assertOutcomesUnset(ans, ['disc', 'duration', 'intensity', 'a1', 'a2', 'b2', 'b3', 'rpe']);
  });
  scenario('A12 "Log an unplanned session" is shown today and earlier, never on a future day', F1, async (page) => {
    const present = {};
    for (const iso of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-28', '2026-11-29']) {
      await selectDay(page, iso);
      present[iso] = (await page.$$('.cal-unplanned')).length;
    }
    assert.deepStrictEqual(present, { '2026-11-23': 1, '2026-11-24': 1, '2026-11-25': 0, '2026-11-28': 0, '2026-11-29': 0 });
  });
});

// ───────────────────────────── A13 ─────────────────────────────
describe('the resume bar and the Resume / Discard choice', { concurrency: false }, () => {
  scenario('A13 no bar on a fresh app, and none after starting a pristine check-in', F1, async (page) => {
    assert.ok((await page.$('.cal-resume')) === null, 'fresh app');
    await page.click('.cal-unplanned');                  // today, nothing answered: pristine
    await page.click('#tab-flow');
    assert.ok((await page.$('.cal-resume')) === null, 'a pristine flow is nothing to resume');
  });
  scenario('A13 resume bar shows part-way through and Resume returns to the same step, answer intact', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    const heading = norm(await page.textContent('#step-h'));
    assert.strictEqual(heading, 'Any pain, tightness or niggle?');
    await page.click('#tab-flow');
    assert.ok(await calVisible(page), 'Check-in tab shows the Calendar, mid-check-in');
    assert.strictEqual(norm(await page.textContent('.cal-resume-title')), 'Check-in in progress');
    const line = norm(await page.textContent('.cal-resume-line'));
    assert.ok(line.includes('Bike') && line.includes('45–90 min') && line.includes('step 2 of 5'), line);
    await page.click('.cal-resume-go');
    assert.ok(await flowVisible(page));
    assert.strictEqual(norm(await page.textContent('#step-h')), heading, 'same step');
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.disc, 'Bike', 'the pre-filled answers are intact');
    assert.strictEqual(ans.intensity, 'Hard / quality');
  });
  scenario('A13 the resume line names a chosen date that is not today, and reads "ready to review" in review', F1, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-unplanned');
    await page.click('#tab-flow');
    assert.ok(norm(await page.textContent('.cal-resume-line')).includes('Mon 23 Nov'), 'a chosen date is an entered answer');
    await page.click('.cal-resume-go');
    await reviewAnswers(page);                           // now on the review screen
    await page.click('#tab-flow');
    assert.ok(norm(await page.textContent('.cal-resume-line')).includes('ready to review'));
  });
  scenario('A13 the bar is absent after a save', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#o-b3-nothing');       // niggle
    await page.waitForTimeout(650);
    await page.click('#o-rpe-6');
    await page.waitForTimeout(650);
    await page.click('#o-a1-intent');
    await page.waitForTimeout(650);
    await page.click('#o-a3-race');          // fuelling (a 60-minute session)
    await page.waitForTimeout(650);
    await page.click('#o-a2-planned');
    await page.waitForTimeout(650);
    await page.click('#o-b2-solid');
    await page.waitForTimeout(650);
    assert.strictEqual(norm(await page.textContent('#btn-next')), 'Save', 'reached the review screen');
    await page.click('#btn-next');                       // Save -> Review
    await page.waitForSelector('#view-dashboard:not([hidden])');
    await page.click('#tab-flow');
    assert.ok(await calVisible(page));
    assert.ok((await page.$('.cal-resume')) === null, 'a saved check-in is finished, not something to resume');
    // And the session it logged is now a static record: no second CTA for it.
    const bike = (await cards(page)).find((c) => c.title === 'Bike — Turbo');
    assert.deepStrictEqual([bike.logged, bike.cta], [true, false]);
  });
  scenario('A13 starting another check-in while one is in progress never discards it silently: Resume keeps it', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    // The tap did not start anything: Calendar is still up, with a choice.
    assert.ok(await calVisible(page));
    assert.strictEqual(await flowVisible(page), false);
    const btns = await page.$$eval('.cal-resume button', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepStrictEqual(btns, ['Resume', 'Discard and start this one']);
    assert.ok(norm(await page.textContent('.cal-resume')).includes('Strength — Gym A'), 'names what was tapped');
    await page.click('.cal-resume-go');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.disc, 'Bike', 'Resume kept the first check-in');
    assert.strictEqual(ans.date, 'Today');
  });
  scenario('A13 Discard and start this one replaces it, and only then', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    await page.click('.cal-resume-discard');
    assert.ok(await flowVisible(page));
    const ans = await reviewAnswers(page);
    assert.strictEqual(ans.disc, 'Strength');
    assert.strictEqual(ans.date, 'Mon 23 Nov');
    assert.strictEqual(ans.duration, '≤ 45 min');
    assertOutcomesUnset(ans, ['a1', 'a2', 'b2', 'b3', 'rpe']);
  });
  scenario('A13 the choice also guards "Log an unplanned session"', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    await page.click('.cal-unplanned');
    assert.strictEqual(await flowVisible(page), false);
    assert.ok(await page.isVisible('.cal-resume-discard'));
    await page.click('.cal-resume-go');
    assert.strictEqual((await reviewAnswers(page)).disc, 'Bike');
  });
});

// ───────────────────────────── A14, A15 ─────────────────────────────
describe('still to log, and stepping', { concurrency: false }, () => {
  const stillText = (page) => page.$eval('.cal-still', (n) => n.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  scenario('A14 Monday gap (F3): the row counts Sunday\'s open run and opens that day', F3, async (page) => {
    assert.strictEqual(await stillText(page), 'Still to log: 1 earlier session →', 'Sun 22 (eight days back) is never counted');
    await page.click('.cal-still');
    assert.strictEqual(norm(await page.textContent('.cal-week-nav .plan-week-num')), 'Week 48');
    assert.strictEqual(await pressedDate(page), '2026-11-29');
    assert.strictEqual(await stillText(page), null, 'absent on any week other than the current one');
    const sun = await cards(page);
    assert.deepStrictEqual(sun.map((c) => [c.title, c.word, c.cta]), [['Run — Sunday run', 'Missed', true]]);
  });
  scenario('A14 a swim logged on Sunday does not consume the planned run: the row stays', {
    ...F3, log: F3.log.concat([logEntry('2026-11-29', 'swim', 30, 'planned')]),
  }, async (page) => {
    assert.strictEqual(await stillText(page), 'Still to log: 1 earlier session →');
  });
  scenario('A14 logging the run removes the row', {
    ...F3, log: F3.log.concat([logEntry('2026-11-29', 'swim', 30, 'planned'), logEntry('2026-11-29', 'run', 60, 'planned')]),
  }, async (page) => {
    assert.strictEqual(await stillText(page), null);
  });
  scenario('A14 the row is absent on every other week, and on a weekday', F3, async (page) => {
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    assert.strictEqual(await stillText(page), null, 'next week');
    await page.click('.plan-week-btn[aria-label="Show the previous week"]');
    assert.strictEqual(await stillText(page), 'Still to log: 1 earlier session →', 'current week again');
  });
  scenario('A14 on a Tuesday the row is absent: Sunday is no longer the gap, the week holds everything', {
    ...F3, now: '2026-12-01T10:00:00+11:00',
  }, async (page) => {
    assert.strictEqual(await stillText(page), null);
  });
  scenario('A14 two open sessions on Sunday read "2 earlier sessions"', {
    ...F3, plan: F3.plan.concat([planItem('f3p4', '2026-11-29', 'swim', 'Sunday swim', 30, 'easy')]),
  }, async (page) => {
    assert.strictEqual(await stillText(page), 'Still to log: 2 earlier sessions →');
  });
  scenario('A15 stepping a week and back, week 49 selects Monday, Today returns', F1, async (page) => {
    const week = async () => norm(await page.textContent('.cal-week-nav .plan-week-num'));
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    assert.strictEqual(await week(), 'Week 49');
    assert.strictEqual(await pressedDate(page), '2026-11-30', 'a week without today selects its Monday');
    assert.strictEqual(norm(await page.textContent('.cal-week-range')), '30 Nov – 6 Dec');
    await page.click('.plan-week-btn[aria-label="Show the previous week"]');
    assert.strictEqual(await week(), 'Week 48');
    assert.strictEqual(await pressedDate(page), '2026-11-24', 'a week with today selects today');
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    await page.click('.cal-today');
    assert.strictEqual(await week(), 'Week 48');
    assert.strictEqual(await pressedDate(page), '2026-11-24');
  });
  scenario('keyboard focus survives the rebuild: steppers, Today and chips keep it', F1, async (page) => {
    const active = () => page.evaluate(() => document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.className));
    await page.focus('.cal-week-nav [aria-label="Show the next week"]');
    await page.keyboard.press('Enter');
    assert.strictEqual(await active(), 'Show the next week');
    await page.focus('.cal-today');
    await page.keyboard.press('Enter');
    assert.strictEqual(await active(), 'cal-today');
    await page.focus('.cal-chip[data-date="2026-11-26"]');
    await page.keyboard.press('Enter');
    assert.ok((await active()).includes('Thursday 26 November'), 'the chip stays focused');
    await page.click('#cal-tab-month');
    await page.focus('.race-cal [aria-label="Show the next month"]');
    await page.keyboard.press('Enter');
    assert.strictEqual(await active(), 'Show the next month');
  });
  scenario('A15 week 49 shows the phase the plan gives it (P1) and a different week total', F1, async (page) => {
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    assert.strictEqual(norm(await page.textContent('.cal-summary .month-week-pill')), 'Build 2');
    const stats = await page.$$eval('.cal-stat', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepStrictEqual(stats, ['Planned 0h00', 'Logged 0h00']);
  });
});

// ───────────────────────────── A16, A17 ─────────────────────────────
describe('month', { concurrency: false }, () => {
  scenario('A16 the Week / Month tablist switches by click and by arrow keys', F1, async (page) => {
    assert.strictEqual(await page.getAttribute('#cal-tab-week', 'aria-selected'), 'true');
    assert.strictEqual(await page.getAttribute('.cal-switch [role="tablist"]', 'aria-label'), 'Calendar view');
    await page.click('#cal-tab-month');
    assert.strictEqual(await page.getAttribute('#cal-tab-month', 'aria-selected'), 'true');
    assert.ok(await page.isVisible('.race-cal'));
    assert.ok((await page.$('.cal-chips')) === null, 'the Week panel is gone');
    await page.click('#cal-tab-week');
    assert.ok(await page.isVisible('.cal-chips'));
    // Arrow keys. Focus the selected tab, then move.
    await page.focus('#cal-tab-week');
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.getAttribute('#cal-tab-month', 'aria-selected'), 'true');
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'cal-tab-month', 'focus follows the selection');
    await page.keyboard.press('ArrowLeft');
    assert.strictEqual(await page.getAttribute('#cal-tab-week', 'aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.strictEqual(await page.getAttribute('#cal-tab-month', 'aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.strictEqual(await page.getAttribute('#cal-tab-week', 'aria-selected'), 'true');
    // Roving tabindex: only the selected tab is in the tab order.
    assert.deepStrictEqual(await page.$$eval('.cal-switch [role="tab"]', (ns) => ns.map((n) => n.tabIndex)), [0, -1]);
  });
  scenario('A16 November 2026: six weeks 44-49, one today, the considering race on 6 Dec', F1, async (page) => {
    await page.click('#cal-tab-month');
    assert.strictEqual(norm(await page.textContent('.race-cal .plan-week-num')), 'Nov 2026');
    const nums = await page.$$eval('.race-cal-week-row .race-cal-weeknum', (ns) => ns.map((n) => n.textContent));
    assert.deepStrictEqual(nums, ['44', '45', '46', '47', '48', '49']);
    assert.strictEqual(await page.$$eval('.race-cal-day.today', (ns) => ns.length), 1);
    const considering = await page.$$eval('.race-cal-day.considering', (ns) => ns.map((n) => n.textContent));
    assert.deepStrictEqual(considering, ['6']);
    assert.strictEqual(await page.$$eval('.race-cal-day.locked', (ns) => ns.length), 0);
    assert.strictEqual(await page.$$eval('.race-cal .dash-signal-link', (ns) => ns.length), 0, 'no phase-plan links');
  });
  scenario('A16 each week row is one button with the specified name; tapping week 49 opens Week on it', F1, async (page) => {
    await page.click('#cal-tab-month');
    const labels = await page.$$eval('.race-cal-week-row', (ns) => ns.map((n) => n.getAttribute('aria-label')));
    assert.strictEqual(labels[0], 'Week 44, 26 Oct to 1 Nov. Show this week');
    assert.ok(labels[5].startsWith('Week 49, 30 Nov to 6 Dec.') && labels[5].endsWith('Show this week'), labels[5]);
    assert.ok(labels[5].includes('Sample sprint'), 'a race in the week is in the name');
    // Siblings, never nested.
    assert.strictEqual(await page.$$eval('.race-cal-week-row button, .race-cal-week-row select', (ns) => ns.length), 0);
    await page.click('.race-cal-week-row[aria-label^="Week 49,"]');
    assert.strictEqual(norm(await page.textContent('.cal-week-nav .plan-week-num')), 'Week 49');
    assert.strictEqual(await pressedDate(page), '2026-11-30');
    assert.strictEqual(await page.getAttribute('#cal-tab-week', 'aria-selected'), 'true');
  });
  scenario('A16 tapping the current week in Month selects today', F1, async (page) => {
    await page.click('#cal-tab-month');
    await page.click('.race-cal-week-row[aria-label^="Week 48,"]');
    assert.strictEqual(await pressedDate(page), '2026-11-24');
  });
  scenario('A16 Month paging and Today', F1, async (page) => {
    await page.click('#cal-tab-month');
    await page.click('.race-cal .plan-week-btn[aria-label="Show the next month"]');
    assert.strictEqual(norm(await page.textContent('.race-cal .plan-week-num')), 'Dec 2026');
    await page.click('.cal-today');
    assert.strictEqual(norm(await page.textContent('.race-cal .plan-week-num')), 'Nov 2026', 'Today in Month returns to the current month');
    assert.strictEqual(await page.getAttribute('#cal-tab-month', 'aria-selected'), 'true', 'and stays in Month');
  });
  scenario('A17 Month phase edit writes one block on that Monday, then updates it in place', F1, async (page) => {
    await page.click('#cal-tab-month');
    await page.click('[aria-label="Edit the phase for the week of Mon 16 Nov"]');
    await page.selectOption('.race-cal-phase-select', 'peak');
    assert.ok((await page.$('.race-cal-phase-select')) === null, 'the select closes');
    const read = async () => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEYS.phases));
    let blocks = (await read()).filter((b) => b.from === '2026-11-16');
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].phase, 'peak');
    await page.click('[aria-label="Edit the phase for the week of Mon 16 Nov"]');
    await page.selectOption('.race-cal-phase-select', 'taper');
    blocks = (await read()).filter((b) => b.from === '2026-11-16');
    assert.strictEqual(blocks.length, 1, 'edited in place, not duplicated');
    assert.strictEqual(blocks[0].phase, 'taper');
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Edit the phase for the week of Mon 16 Nov', 'focus returns to the control that opened the select');
    // P1: the edit shows in Week at once, because both read resolvePhaseForDate.
    await page.click('.race-cal-week-row[aria-label^="Week 47,"]');
    assert.strictEqual(norm(await page.textContent('.cal-summary .month-week-pill')), 'Taper');
  });
  scenario('A17 Escape abandons a phase edit without writing', F1, async (page) => {
    await page.click('#cal-tab-month');
    await page.click('[aria-label="Edit the phase for the week of Mon 16 Nov"]');
    await page.keyboard.press('Escape');
    assert.ok((await page.$('.race-cal-phase-select')) === null, 'the select closes');
    const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEYS.phases));
    assert.strictEqual(stored.filter((b) => b.from === '2026-11-16').length, 0);
  });
});

// ───────────────────────────── A18, A19, A20 ─────────────────────────────
describe('empty state, edit and back, and Review', { concurrency: false }, () => {
  scenario('A18 empty state (F2): logged sessions still show, one quiet line, no strip word', F2, async (page) => {
    await selectDay(page, '2026-11-23');
    const got = await cards(page);
    assert.strictEqual(got.length, 1);
    assert.deepStrictEqual([got[0].title, got[0].word, got[0].seg], ['Run', 'Logged', null], 'reads "Logged" with no strip');
    assert.ok(!(await page.textContent('.cal-agenda')).includes('Unplanned'));
    assert.strictEqual(norm(await page.textContent('.cal-quiet')), 'Add a plan');
    assert.ok((await page.$('.cal-empty')) === null, 'no "Nothing planned" row; the quiet line carries the invitation');
    assert.strictEqual(norm(await page.textContent('.cal-agenda-logged')), '60 min logged');
    await selectDay(page, '2026-11-24');
    assert.strictEqual(norm(await page.textContent('.cal-agenda-logged')), 'Nothing logged', 'an empty day reads Nothing logged');
  });
  scenario('A18 tapping "Add a plan" opens the Plan view with the selected day\'s add form', F2, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-quiet-link');
    assert.ok(await page.isVisible('#view-plan'));
    assert.ok(await page.isVisible('#plan-form-2026-11-23'), "Monday's form is open");
    assert.strictEqual(await page.$eval('#plan-form-2026-11-24', (n) => n.hidden), true, "Tuesday's is not");
    assert.ok(await page.$('#plan-title'));
  });
  scenario('A18 once any plan row exists in the week the six Adherence words apply and the quiet line goes', {
    ...F2, plan: [planItem('q1', '2026-11-27', 'run', 'Intervals', 45, 'hard')],
  }, async (page) => {
    assert.ok((await page.$('.cal-quiet')) === null, 'no quiet line once a plan exists');
    await selectDay(page, '2026-11-23');
    const got = await cards(page);
    assert.deepStrictEqual([got[0].word, got[0].seg], ['Unplanned', 'extra'], 'a logged run in a week with a plan is Unplanned');
  });
  scenario('A18 an empty day in a week with a plan reads "Nothing planned" with an Add that opens that day', F1, async (page) => {
    await selectDay(page, '2026-11-26');
    assert.strictEqual(norm(await page.$eval('.cal-empty span', (n) => n.textContent)), 'Nothing planned');
    await page.click('.cal-empty-add');
    assert.ok(await page.isVisible('#plan-form-2026-11-26'));
  });
  scenario('A19 Edit opens the Plan view\'s edit form; back returns to Calendar on the same week', F1, async (page) => {
    await page.click('.plan-week-btn[aria-label="Show the next week"]');
    await page.click('.plan-week-btn[aria-label="Show the previous week"]');
    await selectDay(page, '2026-11-25');
    await page.click('.cal-card:has(.cal-card-title:text("Swim — Technique")) .cal-card-edit');
    assert.ok(await page.isVisible('#view-plan'));
    assert.strictEqual(await page.inputValue('#plan-title'), 'Technique', 'pre-filled edit form');
    assert.strictEqual(norm(await page.textContent('#view-plan .dash-phase-change')), '← Back to calendar');
    await page.click('#view-plan .dash-phase-change');
    assert.ok(await calVisible(page));
    assert.strictEqual(norm(await page.textContent('.cal-week-nav .plan-week-num')), 'Week 48');
    assert.strictEqual(await pressedDate(page), '2026-11-25', 'same week and day');
  });
  scenario('A19 an edit made in the Plan view shows on the Calendar', F1, async (page) => {
    await selectDay(page, '2026-11-25');
    await page.click('.cal-card:has(.cal-card-title:text("Swim — Technique")) .cal-card-edit');
    await page.fill('#plan-title', 'Drills');
    await page.click('#view-plan .plan-form button[type="submit"]');
    await page.click('#view-plan .dash-phase-change');
    await selectDay(page, '2026-11-25');
    assert.deepStrictEqual((await cards(page)).map((c) => c.title), ['Swim — Drills']);
  });
  scenario('A19 Review\'s "Edit plan →" still says "← Back to this week"', F1, async (page) => {
    await page.click('#tab-dash');
    await page.click('text=Edit plan →');
    assert.ok(await page.isVisible('#view-plan'));
    assert.strictEqual(norm(await page.textContent('#view-plan .dash-phase-change')), '← Back to this week');
    await page.click('#view-plan .dash-phase-change');
    assert.ok(await page.isVisible('#view-dashboard'));
  });
  scenario('A20 Review keeps its signals, "See this month →" and "Edit plan →", and loses the plan list', F1, async (page) => {
    await page.click('#tab-dash');
    assert.deepStrictEqual(
      await page.$$eval('#view-dashboard .signal-subtab', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim())),
      ['Intensity', 'Fuelling', 'Adherence']);
    for (const name of ['Intensity', 'Fuelling', 'Adherence']) {
      await page.click('#view-dashboard .signal-subtab:has-text("' + name + '")');
      assert.ok(await page.isVisible('text=See this month →'), name + ': See this month');
      assert.ok(await page.isVisible('text=Edit plan →'), name + ': Edit plan');
      assert.ok((await page.$('.dash-plan-week')) === null, name + ': no plan list');
      assert.ok(!(await page.textContent('#view-dashboard')).includes('This week’s plan'), name + ': no "This week\'s plan"');
    }
  });
});

// ───────────────────────────── A22 ─────────────────────────────
describe('320px', { concurrency: false }, () => {
  // Hit area included: a control's own box, or its ::before when that is what
  // completes the 44px (decision 46's pattern).
  const smallTargets = (page) => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#view-calendar button, #view-calendar select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) { return; }
      let w = r.width, h = r.height;
      const b = getComputedStyle(el, '::before');
      if (b.content !== 'none' && b.position === 'absolute') {
        w = Math.max(w, parseFloat(b.width) || 0);
        h = Math.max(h, parseFloat(b.height) || 0);
      }
      if (w < 43.9 || h < 43.9) { out.push((el.className || el.tagName) + ' "' + el.textContent.trim().slice(0, 24) + '" ' + w.toFixed(1) + 'x' + h.toFixed(1)); }
    });
    return out;
  });
  const overflow = (page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth, body: document.body.scrollWidth }));
  scenario('A22 Week: no horizontal overflow, every control at least 44x44', F1, { width: 320 }, async (page) => {
    for (const iso of ['2026-11-24', '2026-11-23']) {
      await selectDay(page, iso);
      const o = await overflow(page);
      assert.ok(o.doc <= o.win && o.body <= o.win, 'overflow ' + JSON.stringify(o));
      assert.deepStrictEqual(await smallTargets(page), [], iso);
    }
    const chip = await page.$eval('.cal-chip', (n) => n.getBoundingClientRect().width);
    assert.ok(chip >= 44, 'chip width ' + chip);
  });
  scenario('A22 Week with the resume bar and the Resume / Discard choice', F1, { width: 320 }, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    assert.deepStrictEqual(await smallTargets(page), [], 'resume bar');
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    const o = await overflow(page);
    assert.ok(o.doc <= o.win, 'overflow ' + JSON.stringify(o));
    assert.deepStrictEqual(await smallTargets(page), [], 'choice');
  });
  scenario('A22 Week, empty state and the Monday gap', F3, { width: 320 }, async (page) => {
    assert.deepStrictEqual(await smallTargets(page), [], 'still-to-log row');
    const o = await overflow(page);
    assert.ok(o.doc <= o.win);
  });
  scenario('A22 Month: no horizontal overflow, every control at least 44x44, select included', F1, { width: 320 }, async (page) => {
    await page.click('#cal-tab-month');
    let o = await overflow(page);
    assert.ok(o.doc <= o.win && o.body <= o.win, 'overflow ' + JSON.stringify(o));
    assert.deepStrictEqual(await smallTargets(page), []);
    await page.click('[aria-label="Edit the phase for the week of Mon 16 Nov"]');
    assert.deepStrictEqual(await smallTargets(page), [], 'with a select open');
    o = await overflow(page);
    assert.ok(o.doc <= o.win);
  });
  scenario('A22 the visible area of every Month control is hit by that control, not a neighbour\'s hit zone', F1, { width: 320 }, async (page) => {
    await page.click('#cal-tab-month');
    const stolen = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.race-cal-week-row, .race-cal-phase-edit').forEach((el) => {
        // Scrolled to the middle first: the fixed tab bar covers whatever is
        // near the bottom edge, and that is not what this check is about.
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        // The middle of the control's own visible box, and the middle of each
        // vertical quarter, must resolve to the control (or a child of it).
        for (const fy of [0.2, 0.5, 0.8]) {
          const hit = document.elementFromPoint(r.left + r.width * 0.5, r.top + r.height * fy);
          if (!hit || !(hit === el || el.contains(hit))) { out.push((el.className) + ' @' + fy + ' -> ' + (hit && hit.className)); }
        }
      });
      return out;
    });
    assert.deepStrictEqual(stolen, []);
  });
});

// ───────────────────────────── A25 ─────────────────────────────
// What "another device changed it" means now: the Supabase mock's rows change,
// and the next refresh (a visibilitychange, a view opening) reads them.
const setPlan = (sb, plan) => sb.backend.replace('plan_sessions', plan.map(planRow));
const setPhases = (sb, phases) => sb.backend.replace('phase_blocks', phases.map(phaseRow));
const setLog = (sb, log) => sb.backend.replace('session_checkins', log.map(sessionRow));
describe('background refresh', { concurrency: false }, () => {
  const fire = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  scenario('A25 a changed ?plan=1 response redraws the Calendar', F1, { sb: true }, async (page, ctx, sb) => {
    await selectDay(page, '2026-11-26');
    assert.deepStrictEqual((await cards(page)).map((c) => c.title), []);
    setPlan(sb, F1.plan.concat([planItem('new1', '2026-11-26', 'swim', 'Added elsewhere', 30, 'easy')]));
    await fire(page);
    await page.waitForTimeout(400);
    assert.deepStrictEqual((await cards(page)).map((c) => c.title), ['Swim — Added elsewhere'], 'the selected day survived the redraw and now shows the new session');
    assert.strictEqual(await pressedDate(page), '2026-11-26', 'the athlete\'s place is kept');
  });
  scenario('A25 a session logged on another device stops being offered', Object.assign({}, F1, { log: [] }), { sb: true }, async (page, ctx, sb) => {
    // The server holds no log, so the Mon swim and strength are both open.
    await selectDay(page, '2026-11-23');
    assert.strictEqual((await cards(page)).filter((c) => c.cta).length, 2);
    setLog(sb, [logEntry('2026-11-23', 'strength', 30, 'planned')]);
    await fire(page);
    await page.waitForTimeout(400);
    const strength = (await cards(page)).find((c) => c.title === 'Strength — Gym A');
    assert.deepStrictEqual([strength.logged, strength.cta, strength.word], [true, false, 'As planned'],
      'the matcher now sees the entry, so no duplicate-writing CTA is offered');
  });
  scenario('A25 while a Month phase select is open the redraw waits, and lands when it closes', F1, { sb: true }, async (page, ctx, sb) => {
    await page.click('#cal-tab-month');
    await page.click('[aria-label="Edit the phase for the week of Mon 9 Nov"]');
    await page.waitForSelector('.race-cal-phase-select');
    // Mark the very node the athlete is using: a rebuild would replace it, and
    // "a select is present" alone cannot tell a held redraw from a rebuilt one
    // (the open edit week is module state, so a rebuild draws a select again).
    await page.$eval('.race-cal-phase-select', (n) => { n.setAttribute('data-held', '1'); });
    // Another device re-plans: weeks of 9, 16 and 23 Nov become Taper.
    setPhases(sb, F1.phases.concat([{ id: 'other', from: '2026-11-09', phase: 'taper' }]));
    await fire(page);
    await page.waitForTimeout(400);
    assert.ok(await page.$('.race-cal-phase-select[data-held="1"]'), 'the select the athlete is using was not rebuilt');
    const during = await page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
    assert.ok(!during.some((l) => l.startsWith('Taper')), 'the band is held too, not half-redrawn: ' + JSON.stringify(during));
    await page.keyboard.press('Escape');
    const labels = await page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
    assert.ok(labels.some((l) => l.startsWith('Taper')), 'the held redraw landed on close: ' + JSON.stringify(labels));
  });
  scenario('A25 with no select open the same refresh redraws immediately', F1, { sb: true }, async (page, ctx, sb) => {
    await page.click('#cal-tab-month');
    setPhases(sb, F1.phases.concat([{ id: 'other', from: '2026-11-09', phase: 'taper' }]));
    await fire(page);
    await page.waitForTimeout(400);
    const labels = await page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
    assert.ok(labels.some((l) => l.startsWith('Taper')), JSON.stringify(labels));
  });
  scenario('A25 a held Resume / Discard choice survives a redraw', F1, { sb: true }, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    await selectDay(page, '2026-11-23');
    await page.click('.cal-card:has(.cal-card-title:text("Strength — Gym A")) .cal-card-cta');
    await fire(page);
    await page.waitForTimeout(400);
    assert.ok(await page.isVisible('.cal-resume-discard'), 'the question is module state, not DOM');
  });
});

// ───────────────────── background refresh: focus and identity ─────────────────────
// The Calendar must not rebuild when a read succeeds with data that has not
// changed — a rebuild destroys the node a keyboard user is on. These run with
// ALL FOUR tables served and equal to the cache (`sb: true` seeds both from one
// fixture), so an "ok" that is not a "changed" is what is being tested.
const FOCUS_TARGETS = [
  ['a day chip', '.cal-chip[data-date="2026-11-25"]'],
  ['a card Edit button', '.cal-card-edit'],
  ['the week stepper', '.cal-week-nav [aria-label="Show the next week"]'],
  ['the Week tab', '#cal-tab-week'],
];
describe('background refresh keeps the node and the focus', { concurrency: false }, () => {
  const fire = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const activeKey = (page) => page.evaluate(() => {
    const a = document.activeElement;
    return a && (a.getAttribute('data-keep') || 'other:' + (a.getAttribute('aria-label') || a.id || a.className));
  });
  for (const [name, sel] of FOCUS_TARGETS) {
    scenario('H1 unchanged reads (all four mocked): ' + name + ' is not rebuilt and keeps focus', F1, { sb: true }, async (page) => {
      await page.waitForTimeout(300);
      await page.$eval(sel, (n) => n.setAttribute('data-keep', 'same-node'));
      await page.focus(sel);
      for (let i = 0; i < 2; i++) { await fire(page); await page.waitForTimeout(400); }
      assert.ok(await page.$(sel + '[data-keep="same-node"]'), 'the very same node is still in the page (no rebuild)');
      assert.strictEqual(await activeKey(page), 'same-node', 'focus did not move');
    });
    scenario('H1 changed data: ' + name + ' redraws and focus is restored to its twin', F1, { sb: true }, async (page, ctx, sb) => {
      await page.waitForTimeout(300);
      await page.$eval(sel, (n) => n.setAttribute('data-keep', 'old-node'));
      await page.focus(sel);
      setPlan(sb, F1.plan.concat([planItem('chg1', '2026-11-26', 'swim', 'Changed elsewhere', 30, 'easy')]));
      await fire(page);
      await page.waitForTimeout(500);
      assert.ok((await page.$(sel + '[data-keep="old-node"]')) === null, 'the view was rebuilt');
      // Focus is on the equivalent control, not on <body>.
      const sameSpot = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
      assert.ok(sameSpot, 'focus was restored to the rebuilt control');
    });
  }
  scenario('H1 unchanged reads in Month: nothing rebuilt either', F1, { sb: true }, async (page) => {
    await page.click('#cal-tab-month');
    await page.$eval('.race-cal-week-row', (n) => n.setAttribute('data-keep', 'same-node'));
    await page.focus('.race-cal-week-row');
    await fire(page);
    await page.waitForTimeout(400);
    assert.ok(await page.$('.race-cal-week-row[data-keep="same-node"]'));
  });
});

// ───────────────────────────── midnight ─────────────────────────────
describe('an app left open past midnight', { concurrency: false }, () => {
  const NEXT_DAY = '2026-11-25T09:00:00+11:00';
  scenario('M1 no spurious resume bar the next day; a blank check-in is dated the new today', F1, async (page) => {
    await page.clock.setFixedTime(new Date(NEXT_DAY));
    await page.click('#tab-dash');
    await page.click('#tab-flow');
    assert.ok((await page.$('.cal-resume')) === null, 'an untouched seed is not a check-in in progress');
    assert.strictEqual(await pressedDate(page), '2026-11-25', 'the Calendar is on the new today');
    await page.click('.cal-unplanned');
    assert.strictEqual((await reviewAnswers(page)).date, 'Today');
  });
  scenario('M1 a date the athlete chose is still preserved across midnight (flowIsPristine not loosened)', F1, async (page) => {
    await selectDay(page, '2026-11-23');
    await page.click('.cal-unplanned');                 // a chosen date, not the seed
    await page.click('#tab-flow');
    await page.clock.setFixedTime(new Date(NEXT_DAY));
    await page.click('#tab-dash');
    await page.click('#tab-flow');
    assert.ok(norm(await page.textContent('.cal-resume-line')).includes('Mon 23 Nov'), 'the chosen date survived');
  });
  scenario('M1 an answered check-in is preserved across midnight', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.click('#tab-flow');
    await page.clock.setFixedTime(new Date(NEXT_DAY));
    await page.click('#tab-dash');
    await page.click('#tab-flow');
    assert.ok(await page.isVisible('.cal-resume'));
  });
});

// ───────────────────────────── leaving the flow quickly ─────────────────────────────
describe('leaving the flow within the auto-advance delay', { concurrency: false }, () => {
  scenario('L1 answer, tap Check-in at once: the hidden flow does not advance and nothing is announced', F1, async (page) => {
    await page.click('.cal-card:has(.cal-card-title:text("Bike — Turbo")) .cal-card-cta');
    await page.waitForTimeout(200);                    // let the CTA's own "Step 2 of 5" announcement land first
    await page.evaluate(() => {
      window.__said = [];
      new MutationObserver(() => {
        const t = document.getElementById('live').textContent;
        if (t) { window.__said.push(t); }
      }).observe(document.getElementById('live'), { childList: true, characterData: true, subtree: true });
    });
    await page.click('#o-b3-nothing');                 // arms the 450ms auto-advance
    await page.click('#tab-flow');                     // well inside it
    await page.waitForTimeout(900);
    assert.ok(norm(await page.textContent('.cal-resume-line')).includes('step 2 of 5'), norm(await page.textContent('.cal-resume-line')));
    assert.deepStrictEqual(await page.evaluate(() => window.__said), [], 'no "Step 3 of 5" announced on the Calendar');
    await page.click('.cal-resume-go');
    assert.strictEqual(norm(await page.textContent('#step-h')), 'Any pain, tightness or niggle?', 'Resume lands on the step the bar named');
    assert.ok(await page.isChecked('#o-b3-nothing'), 'and the answer is intact');
  });
});

// ───────────────────────────── phase picker copy ─────────────────────────────
describe('phase picker copy', { concurrency: false }, () => {
  scenario('the picker says what it is for, not the retired dashboard wording', { ...F1, phases: [] }, async (page) => {
    await page.click('.cal-unplanned');
    const hint = norm(await page.textContent('#view-period .hint'));
    assert.ok(hint.includes('start a check-in'), hint);
    assert.ok(hint.includes('Change phase'), hint);
    assert.ok(!hint.includes('dashboard') && !hint.includes('This week'), hint);
  });
});

// ───────────────────── a day change while the app is open ─────────────────────
describe('resuming after midnight (visibilitychange)', { concurrency: false }, () => {
  const NEXT_DAY = '2026-11-25T00:05:00+11:00';
  const fire = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const lastLogged = (page) => page.evaluate((k) => { const a = JSON.parse(localStorage.getItem(k)); return a[a.length - 1]; }, KEYS.log);

  scenario('M1-new flow visible and untouched across midnight: the date shown is the date saved', F1, { sb: true }, async (page) => {
    await page.click('.cal-unplanned');                       // flow on its date page, seeded with Tue 24
    assert.strictEqual(await page.inputValue('#o-date'), '2026-11-24');
    await page.clock.setFixedTime(new Date(NEXT_DAY));
    await fire(page);
    await page.waitForTimeout(300);
    assert.strictEqual(await page.inputValue('#o-date'), '2026-11-24', 'the input still shows what it showed');
    // Pick a session and run the flow to Save; the stored date must be the one on screen.
    await page.click('#o-disc-swim'); await page.waitForTimeout(650);
    await page.click('#o-b3-nothing'); await page.waitForTimeout(650);
    await page.click('#o-duration-30');
    await page.click('#o-intensity-easy');
    await page.click('#o-rpe-6');
    await page.click('#o-a1-intent'); await page.waitForTimeout(650);
    await page.click('#o-a2-planned');
    await page.click('#o-b2-solid'); await page.waitForTimeout(650);
    const rows = await page.$$eval('.review-row', (ns) => ns.map((n) => n.textContent));
    assert.ok(rows.some((r) => r.includes('Tue 24 Nov')), 'Review shows the date plainly: ' + rows.join(' | '));
    await page.click('#btn-next');
    await page.waitForSelector('#view-dashboard:not([hidden])');
    assert.strictEqual((await lastLogged(page)).date, '2026-11-24', 'saved under the date the athlete saw');
  });
  scenario('M1-new Calendar showing across midnight: no phantom resume bar', F1, { sb: true }, async (page) => {
    await page.click('.cal-unplanned');                       // pristine, dated today
    await page.click('#tab-flow');
    assert.ok((await page.$('.cal-resume')) === null);
    await page.clock.setFixedTime(new Date(NEXT_DAY));
    await fire(page);
    await page.waitForTimeout(400);
    assert.ok((await page.$('.cal-resume')) === null, 'an untouched seed from yesterday is not a check-in in progress');
    assert.strictEqual(await pressedDate(page), '2026-11-25');
  });
  scenario('M2 Calendar rolls to the new day on resume with every read UNCHANGED, and keeps focus', F1, { sb: true }, async (page) => {
    await page.waitForTimeout(300);
    await page.focus('.cal-chip[data-date="2026-11-27"]');
    await page.clock.setFixedTime(new Date('2026-11-25T09:00:00+11:00'));
    await fire(page);
    await page.waitForTimeout(400);
    assert.strictEqual(await page.$eval('.cal-chip.is-today', (n) => n.getAttribute('data-date')), '2026-11-25', 'the today ring moved');
    assert.strictEqual(await pressedDate(page), '2026-11-25', 'a selection parked on the old today follows it');
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('data-date')), '2026-11-27', 'focus kept on the chip the athlete was on');
    await selectDay(page, '2026-11-24');
    const bike = (await cards(page)).find((c) => c.title === 'Bike — Turbo');
    assert.deepStrictEqual([bike.word, bike.seg], ['Missed', 'missed'], 'yesterday\'s open session is Missed now, not "To log"');
    await selectDay(page, '2026-11-25');
    assert.strictEqual((await cards(page))[0].word, 'To log', "today's open session reads To log");
  });
  scenario('M2 Races countdown rolls on resume with every read UNCHANGED', F1, { sb: true }, async (page) => {
    await page.click('#tab-races');
    const read = () => page.$$eval('.race-card-countdown', (ns) => ns.map((n) => n.textContent.trim()));
    const before = await read();
    await page.clock.setFixedTime(new Date('2026-11-25T09:00:00+11:00'));
    await fire(page);
    await page.waitForTimeout(400);
    const after = await read();
    assert.notDeepStrictEqual(after, before, 'countdowns changed: ' + JSON.stringify([before, after]));
  });
});

// ───────────────────── focus restore keys ─────────────────────
describe('focus restore does not build selectors from plan text', { concurrency: false }, () => {
  const fire = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const NASTY = 'He said "go"\\';                      // ends in a backslash and holds a quote
  const twin = (id) => planItem(id, '2026-11-26', 'swim', NASTY, 30, 'easy');
  const fx = { ...F1, plan: F1.plan.concat([twin('tw1'), twin('tw2')]) };
  scenario('L-a two same-title same-day cards: focus returns to the right one; no throw', fx, { sb: true }, async (page, ctx, sb) => {
    await page.waitForTimeout(300);
    await selectDay(page, '2026-11-26');
    assert.strictEqual((await cards(page)).length, 2);
    await page.focus('[data-focus="edit:tw2"]');
    setPlan(sb, fx.plan.concat([planItem('tw3', '2026-11-27', 'run', 'Another', 20, 'easy')]));
    await fire(page);
    await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('data-focus')), 'edit:tw2', 'the second twin, not the first');
  });
});
