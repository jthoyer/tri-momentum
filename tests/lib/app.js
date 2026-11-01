'use strict';
// Shared helpers for reading the real, shipped index.html.
//
// Nothing here injects a test hook into the file. The app is a single static
// HTML file with no build step, so the thing under test is always the thing
// that deploys — see CLAUDE.md decisions 34 and 43.

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'index.html');

function readIndex() {
  return fs.readFileSync(INDEX, 'utf8');
}

// The app's single inline <script>. Everything the tests care about lives here.
function inlineScript(html = readIndex()) {
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  if (!blocks.length) throw new Error('no inline <script> found in index.html');
  return blocks
    .map((b) => b.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    .sort((a, b) => b.length - a.length)[0];
}

// Pull a named function's source straight out of the file by brace matching.
// Deliberately not a reimplementation: a test that reasons about a copy of the
// logic proves nothing about the logic that ships.
function extractFunction(name, src = inlineScript()) {
  const start = src.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('function not found in index.html: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces reading function: ' + name);
}

// Pull a `var NAME = <literal>;` declaration out of the file. Used so a test
// never hardcodes a constant the app owns — a preamble that says
// PHASE_BUILD_ORDER is four phases long would keep passing after the app grew
// a fifth, and prove nothing.
function extractConst(name, src = inlineScript()) {
  const m = new RegExp('var ' + name + ' = ([^;]+);').exec(src);
  if (!m) throw new Error('constant not found in index.html: ' + name);
  return 'var ' + name + ' = ' + m[1] + ';';
}

// Evaluate a set of extracted functions in isolation, with whatever module-level
// constants they close over supplied as a preamble.
function loadFunctions(names, preamble = '') {
  const src = inlineScript();
  const body = names.map((n) => extractFunction(n, src)).join('\n');
  const exp = names.map((n) => n + ': ' + n).join(', ');
  // eslint-disable-next-line no-new-func
  return new Function(preamble + '\n' + body + '\nreturn {' + exp + '};')();
}

// Serve the real index.html over http. By default BOTH outside endpoints are
// blanked: the Sheet URL (so a live Sheet fetch can't overwrite a seeded
// scenario) and the Supabase publishable key (blank = the app runs local-only
// and sends nothing to *.supabase.co). A test that exercises the backend opts
// in with `key` and, for the import, `sheetUrl`, and must then mock those
// hosts itself — see guardNetwork() below, which aborts anything unmocked.
// http rather than file:// on purpose: a file:// origin makes localStorage and
// the service-worker check throw, which buries any real page error in noise.
//
// Options:
//   key        publishable key to put in the page ('' = unconfigured, the default)
//   sheetUrl   Apps Script URL to put in the page ('' = none, the default)
//   timeoutMs  replaces SB_TIMEOUT_MS (a hung-request test shouldn't take 15s)
//   transform  (html) => html, applied last. For discrimination checks only:
//              breaks the code on a copy served to the browser, never on disk.
//   routes     maps an exact query string ("phases=1") to a JSON body served for
//              that request, for tests that fake the page-origin itself.
//
// Non-root paths are served from the repo when the file exists (the vendored
// supabase-js, favicon.png, ...); anything else still gets index.html.
const MIME = { '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8' };
function setConst(html, name, value) {
  const re = new RegExp("var " + name + " = '[^']*';");
  if (!re.test(html)) throw new Error('could not set ' + name + ' — has it been renamed?');
  return html.replace(re, () => "var " + name + " = '" + String(value).replace(/'/g, "\\'") + "';");
}
async function serveApp(opts) {
  opts = opts || {};
  let html = readIndex();
  html = setConst(html, 'TRAINING_LOG_WRITE_URL', opts.sheetUrl || '');
  html = setConst(html, 'SUPABASE_PUBLISHABLE_KEY', opts.key || '');
  if (opts.timeoutMs) {
    if (!/var SB_TIMEOUT_MS = \d+;/.test(html)) throw new Error('SB_TIMEOUT_MS not found');
    html = html.replace(/var SB_TIMEOUT_MS = \d+;/, 'var SB_TIMEOUT_MS = ' + opts.timeoutMs + ';');
  }
  if (opts.transform) html = opts.transform(html);
  const server = http.createServer((req, res) => {
    const qIndex = req.url.indexOf('?');
    const query = qIndex === -1 ? '' : req.url.slice(qIndex + 1);
    const pathname = decodeURIComponent(qIndex === -1 ? req.url : req.url.slice(0, qIndex));
    if (opts.routes && Object.prototype.hasOwnProperty.call(opts.routes, query)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(opts.routes[query]);
      return;
    }
    if (pathname !== '/' && pathname !== '/index.html') {
      const file = path.resolve(ROOT, '.' + pathname);
      if (file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(fs.readFileSync(file));
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: 'http://127.0.0.1:' + server.address().port + '/',
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Abort every request to a host the app must not reach unprompted, and record
// it. Install it FIRST on a context; later page.route() handlers (the Supabase
// and Sheet mocks) take precedence over it, so only requests nobody mocked end
// up here. A test then asserts `guard.blocked` is empty.
const GUARDED_HOSTS = /^https:\/\/([a-z0-9-]+\.supabase\.co|script\.google\.com|script\.googleusercontent\.com)\//;
async function guardNetwork(ctx) {
  const blocked = [];
  await ctx.route(GUARDED_HOSTS, (route) => {
    blocked.push(route.request().method() + ' ' + route.request().url());
    return route.abort('blockedbyclient');
  });
  return { blocked };
}

// Resolve Chromium without downloading one. The remote/dev images ship browsers
// under PLAYWRIGHT_BROWSERS_PATH; CI installs them via `playwright install`.
// Returns undefined to let Playwright use its own default when nothing matches.
function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dir = fs
    .readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .pop();
  if (!dir) return undefined;
  const bin = path.join(base, dir, 'chrome-linux', 'chrome');
  return fs.existsSync(bin) ? bin : undefined;
}

module.exports = { ROOT, INDEX, readIndex, inlineScript, extractFunction, extractConst, loadFunctions, serveApp, guardNetwork, chromiumPath };
