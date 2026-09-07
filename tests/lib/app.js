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

// Evaluate a set of extracted functions in isolation, with whatever module-level
// constants they close over supplied as a preamble.
function loadFunctions(names, preamble = '') {
  const src = inlineScript();
  const body = names.map((n) => extractFunction(n, src)).join('\n');
  const exp = names.map((n) => n + ': ' + n).join(', ');
  // eslint-disable-next-line no-new-func
  return new Function(preamble + '\n' + body + '\nreturn {' + exp + '};')();
}

// Serve the real index.html over http, with only the Apps Script URL blanked so
// a live Google Sheet fetch can't overwrite a seeded scenario mid-test.
// http rather than file:// on purpose: a file:// origin makes localStorage and
// the service-worker check throw, which buries any real page error in noise.
async function serveApp() {
  let html = readIndex().replace(
    /var TRAINING_LOG_WRITE_URL = '[^']*';/,
    "var TRAINING_LOG_WRITE_URL = '';"
  );
  if (!html.includes("var TRAINING_LOG_WRITE_URL = '';")) {
    throw new Error('could not blank TRAINING_LOG_WRITE_URL — has it been renamed?');
  }
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: 'http://127.0.0.1:' + server.address().port + '/',
    close: () => new Promise((resolve) => server.close(resolve)),
  };
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

module.exports = { ROOT, INDEX, readIndex, inlineScript, extractFunction, loadFunctions, serveApp, chromiumPath };
