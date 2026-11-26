'use strict';
// One isolated scenario = one fresh http server for the real index.html, one
// fresh browser CONTEXT (so empty localStorage, sessionStorage and cookies —
// nothing carries over from another test), the Supabase and Sheet mocks
// installed, and capture of everything that must stay empty: page errors,
// unhandled promise rejections, and any request to Supabase/Google that
// nobody mocked.
//
// Isolation, stated once: every scenario() call is "new context + new server";
// a test that wants persistence across a reload does `page.reload()` inside the
// scenario and says so.

const { serveApp, guardNetwork, chromiumPath } = require('./app');
const { chromium } = require('playwright');
const { Backend } = require('./supabase-mock');

const SHEET_URL = 'https://script.google.com/macros/s/TEST-DEPLOYMENT/exec';
const KEY = 'sb_publishable_test_key_not_real';

async function launchBrowser() {
  return chromium.launch({ executablePath: chromiumPath() });
}

// A stand-in for the Apps Script web app's four GET endpoints.
class SheetMock {
  constructor(data) {
    this.data = Object.assign({ sessions: [], races: [], plan: [], phases: [] }, data || {});
    this.requests = [];
    this.overrides = {};   // query -> {status, body (string or object), raw}
  }
  async install(ctx) {
    await ctx.route(/^https:\/\/script\.google\.com\/macros\/s\/TEST-DEPLOYMENT\/exec/, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
      this.requests.push({ method: req.method(), search: url.search });
      if (req.method() !== 'GET') return route.fulfill({ status: 405, headers, body: '{}' });
      const ov = this.overrides[url.search];
      if (ov) {
        return route.fulfill({ status: ov.status || 200, headers, body: typeof ov.body === 'string' ? ov.body : JSON.stringify(ov.body) });
      }
      const key = { '?list=1': 'sessions', '?races=1': 'races', '?plan=1': 'plan', '?phases=1': 'phases' }[url.search];
      if (!key) return route.fulfill({ status: 200, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: 'TRI Momentum training log endpoint is live.' });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, [key]: this.data[key] }) });
    });
  }
}

async function scenario(browser, opts) {
  opts = opts || {};
  const backend = opts.backend === undefined ? new Backend() : opts.backend;
  const sheet = opts.sheet ? new SheetMock(opts.sheet) : null;
  const server = await serveApp({
    key: opts.key === undefined ? (backend ? KEY : '') : opts.key,
    sheetUrl: sheet ? SHEET_URL : '',
    timeoutMs: opts.timeoutMs,
    transform: opts.transform,
  });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, serviceWorkers: 'block' });
  const guard = await guardNetwork(ctx);
  if (backend) await backend.install(ctx);
  if (sheet) await sheet.install(ctx);
  if (opts.abortVendor) await ctx.route('**/vendor/supabase-js/supabase.js', (route) => route.abort('failed'));
  if (opts.vendorBody) await ctx.route('**/vendor/supabase-js/supabase.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: opts.vendorBody }));
  const page = await ctx.newPage();
  const errors = [];
  const consoleMsgs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
  await ctx.addInitScript(() => {
    window.__unhandled = [];
    window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason && e.reason.message || e.reason)));
    // Record every announcement the app makes (assert the history, not the last value).
    window.__live = [];
    document.addEventListener('DOMContentLoaded', () => {
      ['live', 'live-splash'].forEach((id) => {
        const n = document.getElementById(id);
        if (n) new MutationObserver(() => { if (n.textContent) window.__live.push(n.textContent); }).observe(n, { childList: true, characterData: true, subtree: true });
      });
    });
  });
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  if (backend && opts.signedIn) await backend.seedSignedIn(ctx);
  if (opts.localStorage) {
    await ctx.addInitScript((kv) => {
      if (window.sessionStorage.getItem('__ls_seeded')) return;
      window.sessionStorage.setItem('__ls_seeded', '1');
      Object.keys(kv).forEach((k) => window.localStorage.setItem(k, typeof kv[k] === 'string' ? kv[k] : JSON.stringify(kv[k])));
    }, opts.localStorage);
  }
  const s = {
    backend, sheet, server, ctx, page, guard, errors, consoleMsgs,
    warns: () => consoleMsgs.filter((m) => m.type === 'warning').map((m) => m.text),
    live: () => page.evaluate(() => window.__live.slice()),
    unhandled: () => page.evaluate(() => window.__unhandled.slice()),
    ls: (k) => page.evaluate((key) => window.localStorage.getItem(key), k),
    lsJson: async (k) => JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), k)),
    // Wait for the app's own mode value, read from the account line it renders.
    accountText: () => page.$eval('#splash-account-line', (n) => n.textContent).catch(() => null),
    accountVisible: () => page.$eval('#splash-account', (n) => !n.hidden).catch(() => false),
    async open() {
      await page.goto(server.origin);
      return s;
    },
    // Resolve once the request log has been quiet for `ms` — the app does its
    // work in promise chains with no single "done" event to wait for.
    async settle(ms) {
      ms = ms || 350;
      let n = -1;
      for (let i = 0; i < 40; i++) {
        const now = (backend ? backend.requests.length : 0) + (sheet ? sheet.requests.length : 0);
        if (now === n) return;
        n = now;
        await page.waitForTimeout(ms);
      }
    },
    async close() {
      await ctx.close();
      await server.close();
    },
  };
  return s;
}

module.exports = { scenario, launchBrowser, SheetMock, SHEET_URL, KEY };
