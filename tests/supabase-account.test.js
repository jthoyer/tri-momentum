'use strict';
// AC10–AC14: the library is optional, the key decides whether anything happens
// at all, the splash shows exactly one account line per state, sign-in is PKCE
// to the canonical URL, and every mode but "synced" stays local.
//
// Isolation: every test() builds its own scenario — a new http server and a new
// browser CONTEXT (empty localStorage / sessionStorage / cookies) — so nothing
// one test stores can set up the next. Where a test reloads or navigates within
// its scenario to check persistence, it says so.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { scenario, launchBrowser } = require('./lib/scenario');
const { Backend, STORAGE_KEY, OWNER_EMAIL } = require('./lib/supabase-mock');
const { ratioOf } = require('./lib/contrast');
const { completeCheckIn } = require('./lib/checkin');

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

const RACE = { id: 'r-cache', name: 'Cached Race', date: '2031-06-01', url: '', notes: '', status: 'locked' };
const LOG = { id: 's-cache', date: '2026-10-01', disc: 'swim', intensity: 'easy', duration: 30, a1: null, a2: null, a3: null, rpe: 4, b2: null, b3: null, note: '', phase: null, loggedAt: null };
const CACHE = { triMomentumRaces_v1: [RACE], triMomentumLog_v1: [LOG], triMomentumPlan_v1: [], triMomentumPhasePlan_v1: [{ id: 'ph1', from: '2020-01-01', phase: 'base' }] };
const SUPA = (s) => s.backend.requests.length;

async function clean(s) {
  assert.deepStrictEqual(s.errors, [], 'page errors');
  assert.deepStrictEqual(await s.unhandled(), [], 'unhandled rejections');
  assert.deepStrictEqual(s.guard.blocked, [], 'requests nobody mocked');
}

describe('AC10 — the library is optional', () => {
  test('vendor request aborted: no page error, no account line, no Supabase request, cache painted', async () => {
    const s = await scenario(browser, { backend: new Backend({ imported: true }), abortVendor: true, localStorage: CACHE });
    try {
      await s.open(); await s.settle();
      assert.strictEqual(await s.accountVisible(), false, 'no account line without the library');
      assert.strictEqual(SUPA(s), 0, 'no request to Supabase');
      assert.ok((await s.page.textContent('#splash-countdown-race')).includes('Cached Race'), 'the splash painted from the cache');
      assert.ok(s.warns().some((w) => /library did not load/.test(w)), 'says so once on the console');
      await clean(s);
    } finally { await s.close(); }
  });

  test('createClient throws: same — local-only, a warning, no page error', async () => {
    const s = await scenario(browser, { backend: new Backend({ imported: true }), vendorBody: 'var supabase = { createClient: function(){ throw new Error("boom"); } };', localStorage: CACHE });
    try {
      await s.open(); await s.settle();
      assert.strictEqual(await s.accountVisible(), false);
      assert.strictEqual(SUPA(s), 0);
      assert.ok(s.warns().some((w) => /could not create the Supabase client/.test(w)));
      assert.ok((await s.page.textContent('#splash-countdown-race')).includes('Cached Race'));
      await clean(s);
    } finally { await s.close(); }
  });
});

describe('AC11 — a blank key is unconfigured mode', () => {
  test('no account line, zero requests to Supabase or the Sheet, painted from cache — across a tab tour', async () => {
    const s = await scenario(browser, { backend: null, localStorage: CACHE });
    try {
      await s.open(); await s.page.waitForTimeout(400);
      assert.strictEqual(await s.accountVisible(), false);
      assert.ok((await s.page.textContent('#splash-countdown-race')).includes('Cached Race'));
      for (const tab of ['#tab-races', '#tab-dash', '#tab-flow']) { await s.page.click(tab); await s.page.waitForTimeout(150); }
      await s.page.reload(); await s.page.waitForTimeout(300);
      assert.deepStrictEqual(s.guard.blocked, [], 'a blank key sends nothing to *.supabase.co or script.google.com');
      assert.deepStrictEqual(s.errors, []);
      assert.deepStrictEqual(await s.live(), [], 'nothing announced');
    } finally { await s.close(); }
  });
});

// ---------------------------------------------------------------------------
// AC12 — one account line per state
// ---------------------------------------------------------------------------
const STATES = {
  'signed-out': { line: 'Not signed in. Check-ins wait on this device; other edits stay here.', btn: 'Sign in with Google', make: () => ({ backend: new Backend(), signedIn: false }) },
  checking: {
    line: 'Signed in · ' + OWNER_EMAIL, btn: 'Sign out',
    make: () => { const b = new Backend(); b.inject((i) => i.table === 'allowed_users', { status: 503, body: { message: 'upstream' } }); return { backend: b, signedIn: true }; },
  },
  'not-permitted': { line: 'This Google account isn’t set up for TRI Momentum.', btn: 'Sign out', make: () => ({ backend: new Backend({ allowed: false }), signedIn: true }) },
  'import-pending': { line: 'Bring your history across from the Google Sheet.', btn: 'Import from Sheet', make: () => ({ backend: new Backend(), signedIn: true }) },
  synced: { line: 'Synced · ' + OWNER_EMAIL, btn: 'Sign out', make: () => ({ backend: new Backend({ imported: true }), signedIn: true }) },
};

describe('AC12 — the account line, per state, at 320px', () => {
  for (const [name, st] of Object.entries(STATES)) {
    test(name + ': exactly one line, a real 44px button, a visible white focus ring, contrast ≥ 4.5:1', async (t) => {
      const s = await scenario(browser, Object.assign({ viewport: { width: 320, height: 640 } }, st.make()));
      try {
        await s.open(); await s.settle(600);
        assert.strictEqual(await s.page.$$eval('.splash-account-line', (n) => n.length), 1, 'exactly one account line');
        assert.strictEqual(await s.accountText(), st.line);
        const btn = await s.page.$('#splash-account-btn');
        assert.strictEqual(await btn.evaluate((n) => n.tagName + ':' + n.type), 'BUTTON:button', 'a real <button type=button>');
        assert.strictEqual((await btn.textContent()).trim(), st.btn);
        const box = await btn.boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44, 'tap target is ' + box.width + 'x' + box.height);

        // Keyboard: Tab reaches it, and it carries the splash's white ring.
        let reached = false;
        for (let i = 0; i < 12 && !reached; i++) {
          await s.page.keyboard.press('Tab');
          reached = await s.page.evaluate(() => document.activeElement && document.activeElement.id === 'splash-account-btn');
        }
        assert.ok(reached, 'Tab reaches the account button');
        const ring = await btn.evaluate((n) => { const c = getComputedStyle(n); return { w: c.outlineWidth, st: c.outlineStyle, col: c.outlineColor }; });
        assert.strictEqual(ring.st, 'solid'); assert.strictEqual(ring.w, '3px'); assert.strictEqual(ring.col, 'rgb(255, 255, 255)');

        // Contrast, against the composited background as rendered.
        const c = await s.page.evaluate(() => {
          const g = (sel) => getComputedStyle(document.querySelector(sel));
          return { page: g('#view-splash').backgroundColor, card: g('#splash-account').backgroundColor, line: g('#splash-account-line').color, btnBg: g('#splash-account-btn').backgroundColor, btnFg: g('#splash-account-btn').color };
        });
        const lineRatio = ratioOf(c.line, c.page, c.card);
        const btnRatio = ratioOf(c.btnFg, c.page, c.card, c.btnBg);
        const ringRatio = ratioOf('rgb(255,255,255)', c.page, c.card);
        t.diagnostic(name + ': line ' + lineRatio.toFixed(2) + ':1, button text ' + btnRatio.toFixed(2) + ':1, ring ' + ringRatio.toFixed(2) + ':1');
        assert.ok(lineRatio >= 4.5, 'line text contrast ' + lineRatio);
        assert.ok(btnRatio >= 4.5, 'button text contrast ' + btnRatio);
        assert.ok(ringRatio >= 3, 'focus ring contrast ' + ringRatio);
        const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        assert.strictEqual(overflow, false, 'no horizontal overflow at 320px');
        await clean(s);
      } finally { await s.close(); }
    });
  }

  test('the account line sits below the Today card (the card is inserted before it)', async () => {
    const today = new Date(); const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const backend = new Backend({ imported: true }).seed('plan_sessions', [{ id: 'p1', plan_date: iso(today), disc: 'swim', title: 'Squad', intensity: 'easy', duration: 45, is_key: false, notes: '', phase: 'base' }]);
    const s = await scenario(browser, { backend, signedIn: true });
    try {
      await s.open(); await s.settle(600);
      const order = await s.page.evaluate(() => Array.from(document.getElementById('view-splash').children).map((n) => n.id || n.className));
      assert.ok(order.indexOf('splash-today') > -1, 'a Today card is on the splash');
      assert.ok(order.indexOf('splash-today') < order.indexOf('splash-account'), 'order: ' + order.join(' > '));
    } finally { await s.close(); }
  });

  test('text from auth is set with textContent: a hostile email renders as text and runs nothing', async () => {
    const evil = '<img src=x onerror="window.__xss=1">@example.test';
    const s = await scenario(browser, { backend: new Backend({ imported: true, email: evil }), signedIn: true });
    try {
      await s.open(); await s.settle(600);
      assert.ok((await s.accountText()).includes(evil), 'shown literally');
      assert.strictEqual(await s.page.$$eval('#splash-account img', (n) => n.length), 0);
      assert.strictEqual(await s.page.evaluate(() => window.__xss), undefined);
      await clean(s);
    } finally { await s.close(); }
  });

  test('state changes are announced once each, via the splash live region (the app-main one is hidden)', async () => {
    const s = await scenario(browser, { backend: new Backend({ allowed: false }), signedIn: true });
    try {
      await s.open(); await s.settle(600);
      assert.deepStrictEqual(await s.live(), ['This Google account isn’t set up for TRI Momentum.'], 'announced exactly once, history not final value');
      // And it is the splash region, which is visible, that carries it.
      assert.strictEqual(await s.page.$eval('#live-splash', (n) => n.textContent), 'This Google account isn’t set up for TRI Momentum.');
      await s.page.click('#splash-account-btn'); await s.page.waitForTimeout(400);
      const live = await s.live();
      assert.deepStrictEqual(live, ['This Google account isn’t set up for TRI Momentum.', 'Signed out. Check-ins wait on this device.']);
    } finally { await s.close(); }
  });
});

// ---------------------------------------------------------------------------
// AC13 — sign-in and sign-out
// ---------------------------------------------------------------------------
describe('AC13 — sign-in (PKCE, canonical redirect) and sign-out', () => {
  test('"Sign in with Google" goes to /auth/v1/authorize with provider=google, a PKCE challenge and the canonical redirect_to', async () => {
    const backend = new Backend({ imported: true });
    backend.inject((i) => i.path === '/auth/v1/authorize', { abort: true });
    const s = await scenario(browser, { backend, signedIn: false });
    try {
      await s.open(); await s.settle(400);
      // Keyboard, not click: Enter on the focused real button.
      await s.page.focus('#splash-account-btn');
      await Promise.all([s.page.waitForRequest((r) => r.url().includes('/auth/v1/authorize')).catch(() => null), s.page.keyboard.press('Enter')]);
      await s.page.waitForTimeout(300);
      const auth = backend.requests.filter((r) => r.path === '/auth/v1/authorize');
      assert.strictEqual(auth.length, 1, 'one authorize request');
      const q = auth[0].query;
      assert.strictEqual(q.get('provider'), 'google');
      assert.strictEqual(q.get('redirect_to'), 'https://jthoyer.github.io/tri-momentum/', 'redirect_to is the constant, not the page URL');
      assert.ok(q.get('code_challenge'), 'PKCE: a code_challenge is sent');
      assert.ok(/^s256$/i.test(q.get('code_challenge_method')), 'S256');
      assert.ok(!/response_type=token/.test(auth[0].search), 'not the implicit flow');
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });

  test('the return carries ?code=; the exchange is mocked; the address bar ends with no code/token/error params', async () => {
    const backend = new Backend({ imported: true });
    backend.inject((i) => i.path === '/auth/v1/authorize', { abort: true });
    const s = await scenario(browser, { backend, signedIn: false });
    try {
      await s.open(); await s.settle(400);
      await s.page.click('#splash-account-btn'); await s.page.waitForTimeout(400);
      // The browser comes back from Google with a code. (Same context, so the PKCE verifier the click stored is still there.)
      await s.page.goto(s.server.origin + '?code=auth-code-123&keep=1');
      await s.settle(500);
      assert.strictEqual(backend.exchangeCount, 1, 'the code was exchanged exactly once');
      const body = backend.requests.find((r) => r.path === '/auth/v1/token').body;
      assert.strictEqual(body.auth_code, 'auth-code-123');
      assert.ok(body.code_verifier, 'with the stored verifier');
      const url = new URL(s.page.url());
      for (const k of ['code', 'access_token', 'error']) assert.ok(!url.searchParams.has(k) && !url.hash.includes(k + '='), k + ' left in the URL');
      assert.strictEqual(url.hash, '');
      assert.strictEqual(url.searchParams.get('keep'), '1', 'only the auth params are removed');
      assert.strictEqual(await s.accountText(), 'Synced · ' + OWNER_EMAIL);
      assert.ok(await s.ls(STORAGE_KEY), 'a session is stored');
      await clean(s);
    } finally { await s.close(); }
  });

  test('a failed return (?error=…) and tokens in the fragment are both ignored and cleaned away', async () => {
    for (const tail of ['?error=access_denied&error_description=nope', '#access_token=abc&refresh_token=def&token_type=bearer&expires_in=3600']) {
      const s = await scenario(browser, { backend: new Backend({ imported: true }), signedIn: false });
      try {
        await s.page.goto('about:blank');
        await s.page.goto(s.server.origin + tail); await s.settle(500);
        const url = new URL(s.page.url());
        assert.strictEqual(url.search + url.hash === '' || url.search + url.hash === '?', true, 'left in the URL: ' + url.search + url.hash);
        assert.ok((await s.accountText()).startsWith('Not signed in'), 'still signed out');
        assert.strictEqual(await s.ls(STORAGE_KEY), null, 'no session was stored from a fragment token');
        assert.deepStrictEqual(s.errors, []);
      } finally { await s.close(); }
    }
  });

  test('sign-out clears the stored session, returns to signed-out, keeps the data cache and sends nothing to the data tables', async () => {
    const backend = new Backend({ imported: true }).seed('races', [{ id: 'r-srv', name: 'Server Race', race_date: '2031-07-01', url: '', notes: '', status: 'locked' }]);
    const s = await scenario(browser, { backend, signedIn: true });
    try {
      await s.open(); await s.settle(500);
      assert.ok(await s.ls(STORAGE_KEY), 'signed in');
      const racesBefore = await s.ls('triMomentumRaces_v1');
      assert.ok(racesBefore.includes('Server Race'));
      const before = backend.requests.length;
      await s.page.click('#splash-account-btn'); await s.page.waitForTimeout(500);
      assert.strictEqual(await s.ls(STORAGE_KEY), null, 'the Supabase session is gone from storage');
      assert.ok((await s.accountText()).startsWith('Not signed in'));
      assert.strictEqual(await s.ls('triMomentumRaces_v1'), racesBefore, 'the cache is kept (Q1)');
      // Tour the tabs signed out: nothing more goes to the data tables.
      for (const tab of ['#tab-races', '#tab-dash']) { await s.page.click(tab); await s.page.waitForTimeout(150); }
      assert.deepStrictEqual(backend.requests.slice(before).filter((r) => r.rest), [], 'no REST call after sign-out');
      // Persistence across a reload (deliberately inherited storage): still signed out.
      await s.page.reload(); await s.settle(400);
      assert.ok((await s.accountText()).startsWith('Not signed in'));
      await clean(s);
    } finally { await s.close(); }
  });
});

// ---------------------------------------------------------------------------
// AC14 — local-only modes never touch server data
// ---------------------------------------------------------------------------
describe('AC14 — local-only modes', () => {
  const server = [{ id: 'srv', name: 'Server Race', race_date: '2031-07-01', url: '', notes: '', status: 'locked' }];
  const modes = {
    unconfigured: () => ({ backend: null }),
    'signed-out': () => ({ backend: new Backend({ imported: true }).seed('races', server), signedIn: false }),
    checking: () => { const b = new Backend({ imported: true }).seed('races', server); b.inject((i) => i.table === 'allowed_users', { status: 500, body: { message: 'x' } }); return { backend: b, signedIn: true }; },
    'not-permitted': () => ({ backend: new Backend({ allowed: false }).seed('races', server), signedIn: true }),
    'import-pending': () => ({ backend: new Backend().seed('races', server), signedIn: true }),
  };
  for (const [name, make] of Object.entries(modes)) {
    test(name + ': paints the cache, never replaces it, sends nothing to the four data tables or the Sheet', async () => {
      const s = await scenario(browser, Object.assign(make(), { sheet: name === 'import-pending' ? { sessions: [] } : undefined, localStorage: CACHE }));
      try {
        await s.open(); await s.settle(500);
        for (const tab of ['#tab-races', '#tab-dash', '#tab-flow', '#tab-races']) { await s.page.click(tab); await s.page.waitForTimeout(200); }
        await s.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await s.page.waitForTimeout(300);
        assert.ok((await s.ls('triMomentumRaces_v1')).includes('Cached Race'), 'cache kept');
        assert.ok(!(await s.ls('triMomentumRaces_v1')).includes('Server Race'), 'a server read never replaced the cache');
        assert.strictEqual(await s.ls('triMomentumLog_v1'), JSON.stringify([LOG]));
        if (s.backend) {
          const data = s.backend.requests.filter((r) => r.rest && ['session_checkins', 'races', 'plan_sessions', 'phase_blocks'].includes(r.table));
          assert.deepStrictEqual(data.map((r) => r.method + ' ' + r.table), [], 'no data-table request');
          if (name === 'signed-out') assert.strictEqual(s.backend.requests.filter((r) => r.rest).length, 0, 'signed out: no REST call at all');
        }
        if (s.sheet) assert.deepStrictEqual(s.sheet.requests, [], 'nothing sent to the Apps Script URL before the import is chosen');
        await clean(s);
      } finally { await s.close(); }
    });
  }

  test('a check-in saved in a local-only mode is held in the outbox and sends nothing', async () => {
    const s = await scenario(browser, { backend: new Backend({ imported: true }), signedIn: false, localStorage: { triMomentumPhasePlan_v1: CACHE.triMomentumPhasePlan_v1 } });
    try {
      await s.open(); await s.settle(300);
      await completeCheckIn(s.page);
      const held = await s.lsJson('triMomentumPendingSessions_v1');
      assert.strictEqual(held.length, 1);
      assert.match(held[0].id, /^s[0-9a-z]{6,}$/, 'a client-generated id');
      assert.strictEqual(s.backend.requests.filter((r) => r.rest).length, 0);
      await clean(s);
    } finally { await s.close(); }
  });

  for (const [label, action] of [['a dropped connection', { abort: true }], ['a 5xx', { status: 502, body: { message: 'bad gateway' } }], ['a 403', { status: 403, body: { message: 'denied' } }], ['a timeout', { neverRespond: true }]]) {
    test('a FAILED check (' + label + ') is "checking", never "not permitted"', async () => {
      const backend = new Backend({ imported: true });
      backend.inject((i) => i.table === 'allowed_users', action);
      const s = await scenario(browser, { backend, signedIn: true, timeoutMs: 400 });
      try {
        await s.open(); await s.settle(700);
        assert.strictEqual(await s.accountText(), 'Signed in · ' + OWNER_EMAIL);
        assert.ok(!(await s.live()).some((m) => /isn’t set up/.test(m)), 'never announced as not permitted');
        await clean(s);
      } finally { await s.close(); }
    });
  }

  test('a check that failed once is tried again when a tab is opened, and then the device syncs', async () => {
    const backend = new Backend({ imported: true }).seed('races', server);
    backend.inject((i) => i.table === 'allowed_users', { status: 500, body: { message: 'blip' } }, { times: 1 });
    const s = await scenario(browser, { backend, signedIn: true });
    try {
      await s.open(); await s.settle(500);
      assert.strictEqual(await s.accountText(), 'Signed in · ' + OWNER_EMAIL, 'checking');
      await s.page.click('#tab-races'); await s.settle(600);
      assert.strictEqual(await s.accountText(), 'Synced · ' + OWNER_EMAIL);
      assert.ok((await s.ls('triMomentumRaces_v1')).includes('Server Race'));
      await clean(s);
    } finally { await s.close(); }
  });
});
