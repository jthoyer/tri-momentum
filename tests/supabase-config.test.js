'use strict';
// Static guarantees about the shipped files (AC10, AC11, AC21, AC22). No browser:
// these read index.html, the vendored client and Code.gs as text, so they run
// in milliseconds and fail with a plain message.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { ROOT, readIndex, inlineScript, extractFunction } = require('./lib/app');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const html = readIndex();
const BASE_COMMIT = '58ea18c'; // the last commit before storage moved to Supabase

describe('vendored supabase-js (AC10)', () => {
  const dir = path.join(ROOT, 'vendor', 'supabase-js');

  test('the UMD build and its licence are committed, same-origin', () => {
    assert.ok(fs.existsSync(path.join(dir, 'supabase.js')), 'vendor/supabase-js/supabase.js is missing');
    assert.ok(fs.existsSync(path.join(dir, 'LICENSE')), 'the licence must travel with the vendored file');
    const lic = fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8');
    assert.ok(/MIT License/.test(lic));
  });

  test('its SHA-256 equals the one recorded in the README beside it, and the version is recorded', () => {
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    const actual = sha256(fs.readFileSync(path.join(dir, 'supabase.js')));
    assert.ok(readme.includes(actual), 'vendor/supabase-js/README.md does not record the SHA-256 of supabase.js (' + actual + ')');
    assert.ok(/\b2\.\d+\.\d+\b/.test(readme), 'the README must record the exact version');
    assert.ok(/f2d4f13a8d7a96bdbf338b6f6887a475d1bbca438c6668172b867a94e3d454cf/.test(readme), 'the README records the tarball SHA-256');
  });

  test('it is loaded by a plain <script src> before the inline script — no import, no CDN', () => {
    const iSrc = html.indexOf('<script src="vendor/supabase-js/supabase.js"></script>');
    const iInline = html.indexOf('<script>\n"use strict";');
    assert.ok(iSrc > 0, 'no <script src="vendor/supabase-js/supabase.js">');
    assert.ok(iSrc < iInline, 'the vendor script must come before the inline script');
    assert.ok(!/^\s*import\s+(\{|\*|[\w$]+\s+from)|\bimport\(/m.test(inlineScript()), 'the inline script must not use import');
    assert.ok(!/cdn\.jsdelivr|unpkg\.com|esm\.sh|cdnjs/.test(html), 'no CDN');
  });
});

describe('configuration (AC11)', () => {
  const src = inlineScript();
  const key = (/var SUPABASE_PUBLISHABLE_KEY = '([^']*)';/.exec(src) || [])[1];

  test('the project URL is the Supabase project, as a constant', () => {
    assert.match(src, /var SUPABASE_URL = 'https:\/\/ghfvmsyxfovwaeeuzlzn\.supabase\.co';/);
  });

  test('the publishable key is its own marked constant', () => {
    assert.notStrictEqual(key, undefined, 'SUPABASE_PUBLISHABLE_KEY not found');
    const at = src.indexOf('var SUPABASE_PUBLISHABLE_KEY');
    const before = src.slice(Math.max(0, at - 700), at);
    assert.match(before, /PUBLISHABLE key/);
    assert.match(before, /Public by design/);
    assert.match(before, /NEVER/);
  });

  test('the committed key is not a secret key and not a privileged JWT', () => {
    assert.ok(!key.startsWith('sb_secret_'), 'a secret key is committed');
    if (key.split('.').length === 3) {
      let role;
      try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch (e) { role = 'unparseable'; }
      assert.notStrictEqual(role, 'service_role', 'a service-role JWT is committed');
      assert.notStrictEqual(role, 'unparseable', 'the key looks like a JWT but cannot be decoded');
    }
    assert.ok(key === '' || /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || key.split('.').length === 3, 'unexpected key shape');
  });

  test('index.html contains neither string that names a privileged key', () => {
    assert.ok(!/service_role/.test(html));
    assert.ok(!/sb_secret_/.test(html));
  });
});

describe('the Sheet is retired from the app (AC21) and nothing else slipped in (AC12)', () => {
  test('index.html sends no cross-origin opaque POST to the Apps Script URL', () => {
    assert.strictEqual((html.match(/no-cors/g) || []).length, 0);
    assert.ok(!/method:\s*'POST'/.test(inlineScript()), 'there is no POST left in the app');
  });

  test('the only fetch() of the Sheet is the import, a GET', () => {
    // Comments stripped first: the layer's header mentions fetch() in prose.
    const code = inlineScript().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const calls = code.match(/\bfetch\(/g) || [];
    assert.strictEqual(calls.length, 1, 'exactly one fetch( call in the app: the import');
    assert.match(inlineScript(), /fetch\(TRAINING_LOG_WRITE_URL \+ ep\.query/);
  });

  test('no innerHTML (or insertAdjacentHTML / outerHTML) is assigned anywhere', () => {
    assert.strictEqual((html.match(/\.innerHTML\s*=/g) || []).length, 0);
    assert.strictEqual((html.match(/insertAdjacentHTML|\.outerHTML\s*=/g) || []).length, 0);
  });

  test('Code.gs changed only in comment lines (no Apps Script redeploy is needed)', (t) => {
    let diff;
    try { diff = cp.execSync('git diff ' + BASE_COMMIT + ' -- apps-script/Code.gs', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1e8 }).toString(); }
    catch (e) { return t.skip('git history for ' + BASE_COMMIT + ' is not available (shallow clone)'); }
    const changed = diff.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
    for (const l of changed) {
      const body = l.slice(1).trim();
      assert.ok(body === '' || /^(\/\/|\/\*\*|\*\/|\*)/.test(body), 'Code.gs changed outside a comment: ' + l);
    }
  });
});

describe('no regressions (AC22)', () => {
  test('applyPlanPrefill is byte-identical to the pre-Supabase version (a1 is never pre-filled, decision 29)', () => {
    const now = extractFunction('applyPlanPrefill');
    // Pinned from `git show 58ea18c:index.html`, so this works in a shallow clone too.
    assert.strictEqual(sha256(now), '36601015be288f11792ee1e71cc1edc78af6f9b1c7c56dc47082fdf5ef934038');
    assert.ok(!/\ba1\s*[:=]/.test(now.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'applyPlanPrefill must not assign a1');
  });
});
