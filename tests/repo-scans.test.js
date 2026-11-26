'use strict';
// Repo-wide scans (AC-S1, AC-S2, AC-S3) and the static pins of AC-C1 and
// AC-C4. No browser: text checks over every file git knows about.
//
// What the scans can and cannot do. They read tracked and not-yet-ignored
// files as text and match fixed shapes. They cannot see an encoded or split
// secret, anything in git history, or PR and commit text. z_Archive/ is
// outside the scan (frozen old versions) and so is the pinned vendored
// supabase.js (covered by its SHA-256). Every pattern below is built from
// parts so this file does not match itself.
//
// Each scan is proven to fail: the "discrimination" tests plant a bad string in
// a markdown doc, a test fixture and a workflow file (in memory, on top of the
// real tree) and require the scan to flag each one.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const { ROOT, readIndex, inlineScript, extractFunction } = require('./lib/app');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function listFiles(root) {
  const out = cp.execSync('git ls-files -co --exclude-standard', { cwd: root, maxBuffer: 1e8 }).toString().split('\n').filter(Boolean);
  return out.filter((f) => !/^z_Archive\//.test(f) && f !== 'vendor/supabase-js/supabase.js' && !/^\.claude\/worktrees\//.test(f) && fs.existsSync(path.join(root, f)));
}
function readText(root, f) {
  const buf = fs.readFileSync(path.join(root, f));
  if (buf.includes(0)) return null;   // binary
  return buf.toString('utf8');
}
function realFiles(root) {
  return listFiles(root).map((f) => ({ path: f, text: readText(root, f) })).filter((x) => x.text !== null);
}

// ── AC-S1 ─────────────────────────────────────────────────────────
const SECRET = 'sb_' + 'secret_';
const PAT = new RegExp('sb' + 'p_[A-Za-z0-9]{20,}');
const GOOGLE_SECRET = 'GOC' + 'SPX-';
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
function jwtRole(tok) {
  try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).role || 'none'; } catch (e) { return 'undecodable'; }
}
function scanSecrets(files, skipPrefixIn) {
  const bad = [];
  for (const { path: p, text } of files) {
    if (text.includes(SECRET) && !(skipPrefixIn || []).includes(p)) bad.push(p + ': secret key prefix');
    if (PAT.test(text)) bad.push(p + ': personal access token');
    if (text.includes(GOOGLE_SECRET)) bad.push(p + ': Google OAuth client secret');
    for (const m of text.match(JWT) || []) {
      const role = jwtRole(m);
      if (role === 'service_role' || role === 'undecodable') bad.push(p + ': JWT with role ' + role);
    }
  }
  return bad;
}

// ── AC-S3 ─────────────────────────────────────────────────────────
const DEPLOY_PREFIX = 'AKfy' + 'cb';
const EXEC_SHAPE = /script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/g;
const SHEET_ID = /docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{10,}/;
function scanAddress(files) {
  const bad = [];
  for (const { path: p, text } of files) {
    if (text.includes(DEPLOY_PREFIX)) bad.push(p + ': Apps Script deployment id prefix');
    let m;
    EXEC_SHAPE.lastIndex = 0;
    while ((m = EXEC_SHAPE.exec(text))) if (!/^TEST-[A-Z0-9-]{1,20}$/.test(m[1])) bad.push(p + ': a /exec address with a non-synthetic id');
    if (SHEET_ID.test(text)) bad.push(p + ': a spreadsheet id');
  }
  return bad;
}

// The project this app first pointed at no longer exists. Built from parts.
const OLD_REF = 'ghfvmsyx' + 'fovwaeeuzlzn';
// supabase/README.md still names it, and still writes out the secret-key prefix
// in prose; chunk 4 (docs) owns that file. Remove this entry when that lands:
// it is the ONLY exemption, and it covers those two findings in that one file.
const OLD_REF_PENDING_DOCS = ['supabase/README.md'];

const files = realFiles(ROOT);
const plant = (p, text) => files.concat([{ path: p, text }]);

describe('AC-S1 — no secret key, personal access token, Google client secret or privileged JWT in any tracked text file', () => {
  test('the real tree is clean', () => { assert.deepStrictEqual(scanSecrets(files, OLD_REF_PENDING_DOCS), []); });
  test('the scan reads a real number of files (it is not scanning nothing)', () => {
    assert.ok(files.length > 30, 'only ' + files.length + ' files scanned');
    assert.ok(files.some((f) => f.path === 'index.html') && files.some((f) => f.path === 'CLAUDE.md'));
    assert.ok(!files.some((f) => /^z_Archive\//.test(f.path)), 'z_Archive is outside the scan');
  });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = (role) => b64({ alg: 'HS256' }) + '.' + b64({ role }) + '.c2ln';
  const PLANTS = {
    'secret key': SECRET + 'abcdefghijklmnop',
    'personal access token': 'sb' + 'p_' + 'a'.repeat(24),
    'Google client secret': GOOGLE_SECRET + 'abcdefghijkl',
    'service-role JWT': jwt('service_role'),
    'undecodable JWT': 'eyJ!!.eyJxxxx.sig'.replace('!!', 'abc') + '',
  };
  for (const [name, value] of Object.entries(PLANTS)) {
    for (const [where, p] of [['a markdown doc', 'docs/planted.md'], ['a test fixture', 'tests/lib/planted-fixture.js'], ['a workflow file', '.github/workflows/planted.yml']]) {
      test('discriminates: a ' + name + ' planted in ' + where + ' is flagged', () => {
        assert.ok(scanSecrets(plant(p, 'x\n' + value + '\n')).length >= 1);
      });
    }
  }
  test('does not over-flag: an anon-role JWT and a short sbp_ string pass', () => {
    assert.deepStrictEqual(scanSecrets([{ path: 'docs/x.md', text: jwt('anon') + ' ' + 'sb' + 'p_short' }]), []);
  });
  test('mutation shown: with the secret-prefix check removed, the planted secret key passes (so the check is what catches it)', () => {
    const only = (list) => list.filter((x) => !/secret key prefix/.test(x));
    const one = [{ path: 'docs/p.md', text: SECRET + 'abc' }];
    assert.deepStrictEqual(only(scanSecrets(one)), []);
    assert.strictEqual(scanSecrets(one).length, 1);
  });
});

describe('AC-S2 — committed project constants', () => {
  const src = inlineScript();
  test('SUPABASE_URL is blank or a 20-character project address; the key is blank, sb_publishable_ or an anon JWT', () => {
    const url = /var SUPABASE_URL = '([^']*)';/.exec(src)[1];
    assert.ok(url === '' || /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url));
    const key = /var SUPABASE_PUBLISHABLE_KEY = '([^']*)';/.exec(src)[1];
    assert.ok(key === '' || /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || (key.split('.').length === 3 && jwtRole(key) === 'anon'));
  });
  test('the deleted project\'s ref appears in no tracked file outside z_Archive (README exempt until the docs chunk)', () => {
    const hits = files.filter((f) => f.text.includes(OLD_REF) && !OLD_REF_PENDING_DOCS.includes(f.path)).map((f) => f.path);
    assert.deepStrictEqual(hits, []);
  });
  test('discriminates: the old ref planted in a test file is flagged', () => {
    const planted = plant('tests/planted.js', "const u = 'https://" + OLD_REF + ".supabase.co';");
    assert.deepStrictEqual(planted.filter((f) => f.text.includes(OLD_REF) && !OLD_REF_PENDING_DOCS.includes(f.path)).map((f) => f.path), ['tests/planted.js']);
  });
});

describe('AC-S3 — no Apps Script deployment id, /exec address or spreadsheet id in any tracked file', () => {
  test('the real tree is clean', () => { assert.deepStrictEqual(scanAddress(files), []); });
  test('index.html has no TRAINING_LOG_WRITE_URL identifier and no spreadsheet id', () => {
    const html = readIndex();
    assert.ok(!html.includes('TRAINING_LOG_WRITE_URL'));
    assert.ok(!SHEET_ID.test(html));
  });
  const ID60 = DEPLOY_PREFIX + 'x'.repeat(54);
  for (const [name, value] of Object.entries({
    'a 60-character deployment id': ID60,
    'a full /exec address with a real-looking id': 'https://script.google.com/macros/s/' + 'Q'.repeat(30) + '/exec',
    'a spreadsheet link': 'https://docs.google.com/spreadsheets/d/' + 'z'.repeat(40) + '/edit',
  })) {
    for (const [where, p] of [['index.html', 'index.html'], ['a markdown doc', 'docs/p.md'], ['a workflow file', '.github/workflows/p.yml']]) {
      test('discriminates: ' + name + ' planted in ' + where + ' is flagged', () => {
        assert.ok(scanAddress(plant(p, value)).length >= 1);
      });
    }
  }
  test('the synthetic fixture id passes, a look-alike with lower-case letters does not', () => {
    const at = (id) => [{ path: 'tests/f.js', text: 'https://script.google.com/' + 'macros/s/' + id + '/exec' }];
    assert.deepStrictEqual(scanAddress(at('TEST-DEPLOYMENT-ABCDEF')), []);
    assert.strictEqual(scanAddress(at('test-deployment-abcdef')).length, 1);
  });
});

describe('AC-S8 — the app makes no POST and no no-cors request; its only fetch( is the import\'s Sheet GET', () => {
  const code = inlineScript().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  test('one fetch( and it is in importFetch, a GET', () => {
    assert.strictEqual((code.match(/\bfetch\(/g) || []).length, 1);
    assert.ok(extractFunction('importFetch').includes('fetch(base + ep.query, init)'));
    assert.match(extractFunction('importFetch'), /method: 'GET'/);
    assert.ok(!/no-cors|method:\s*'POST'/.test(code));
  });
});

// ── AC-C1: byte-identical to main f3c19c9 (pins from `git show f3c19c9:index.html`) ──
describe('AC-C1 — Calendar scoring and phase resolution are byte-identical to main f3c19c9', () => {
  const PINS = {
    planDayResults: '2421cb6896f1e61d1cde9a0a86ffeffaa2f48bfbfd3cf194be326e504a6f8de9',
    dayPlanSplit: 'c5f35e4c4a23ac77e2ab7f73da39ad342b25f9df234b5238ea49917c7699abb7',
    weekDayFor: '747d6439edeb779663b7e3121c563b25de9e92e41688229fe2198cfd1a827b9c',
    buildWeek: '72dcad6adbebdf5c53189c01b2e4f0e7b8d2d50612c29134d31fa90c106f7c14',
    tallyPlanDays: '4546d826d3d97671c77220ae520084a1732dabdab1d4eb8bb44bbdd7dfa84e27',
    planResultSeg: '4ffa39fd28bbfc98ef3ce6f3b852cf6f7317277bee049ffd06621e08295a7550',
    resolvePhaseForDate: 'cdea099988e58a8f3e35292900c236d6ec8533edce0e3c8553096da9b5ec3c45',
    isRealISODate: '42b3157c0f512c0cd36c2e5836f8a009454f4632a4dded68dde01801692f6896',
    applyPlanPrefill: '36601015be288f11792ee1e71cc1edc78af6f9b1c7c56dc47082fdf5ef934038',
  };
  for (const [name, pin] of Object.entries(PINS)) {
    test(name, () => assert.strictEqual(sha256(extractFunction(name)), pin, name + ' changed'));
  }
  test('discriminates: a one-character change to planDayResults moves its hash', () => {
    const f = extractFunction('planDayResults');
    assert.notStrictEqual(sha256(f.replace('return', 'return ')), PINS.planDayResults);
  });
});

// ── AC-C4 ─────────────────────────────────────────────────────────
describe('AC-C4 — a1, rpe, b2, b3 are only ever the athlete\'s own answer', () => {
  const code = inlineScript().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  function enclosing(idx) {
    const before = code.slice(0, idx);
    const all = [...before.matchAll(/function ([A-Za-z0-9_$]+)\(/g)];
    return all.length ? all[all.length - 1][1] : '(top level)';
  }
  const KEYED = /\b(a1|rpe|b2|b3)\b\s*:|\.(a1|rpe|b2|b3)\s*=[^=]|\[\s*['"](a1|rpe|b2|b3)['"]\s*\]\s*=[^=]/g;
  // Row mappers (server, Sheet and cache shapes) and the one saver.
  const ALLOWED = ['rowToSession', 'sessionToRow', 'normalizeSession', 'save'];
  test('every place the four keys are assigned or named in an object is a row mapper or save()', () => {
    const where = new Set();
    for (const m of code.matchAll(KEYED)) where.add(enclosing(m.index));
    assert.ok(where.size >= 3, 'the scan found the known sites');
    for (const w of where) assert.ok(ALLOWED.includes(w), 'a1/rpe/b2/b3 assigned inside ' + w);
  });
  test('nothing assigns state.ans.<outcome field>; state.ans[...] is written only by the answer handler and the date field', () => {
    assert.ok(!/state\.ans\.(a1|a2|a3|rpe|b2|b3)\s*=[^=]/.test(code));
    const sites = new Set();
    for (const m of code.matchAll(/state\.ans\[[^\]]+\]\s*=[^=]/g)) sites.add(enclosing(m.index));
    for (const s of sites) assert.ok(['pick', 'dateField'].includes(s), 'state.ans[…] assigned inside ' + s);
  });
  test('discriminates: a planted plan-to-answer assignment is caught', () => {
    const planted = code + '\nfunction sneaky(item){ state.ans.a1 = item.intensity; }';
    assert.ok(/state\.ans\.(a1|a2|a3|rpe|b2|b3)\s*=[^=]/.test(planted));
    const planted2 = code + '\nfunction sneaky2(item){ var o = {rpe: item.rpe}; }';
    const where = new Set();
    for (const m of planted2.matchAll(KEYED)) { const b = planted2.slice(0, m.index); const all = [...b.matchAll(/function ([A-Za-z0-9_$]+)\(/g)]; where.add(all[all.length - 1][1]); }
    assert.ok(where.has('sneaky2'));
  });
});
