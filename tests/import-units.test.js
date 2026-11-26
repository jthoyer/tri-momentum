'use strict';
// Unit checks (no browser) of the import's pure functions, extracted from the
// shipped index.html: the address validator (AC-S5) and the session id /
// normaliser (AC-I3).

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { loadFunctions } = require('./lib/app');

const f = loadFunctions(['parseSheetAddress', 'toIntOrNull', 'normalizeSession', 'sessionImportId', 'hex'], 'var window = {crypto: globalThis.crypto};');
const ID = 'TEST-DEPLOYMENT-ABCDEF';
const OK = 'https://script.google.com/macros/s/' + ID + '/exec';

describe('AC-S5 — the address validator', () => {
  test('accepts the synthetic address, with surrounding whitespace, and returns it trimmed', () => {
    assert.deepStrictEqual(f.parseSheetAddress('  ' + OK + ' \n'), { ok: true, url: OK });
  });
  const REFUSED = {
    http: 'http://script.google.com/macros/s/' + ID + '/exec',
    'look-alike host': 'https://script.google.com.evil.example/macros/s/' + ID + '/exec',
    'user info': 'https://user@script.google.com/macros/s/' + ID + '/exec',
    'user and password': 'https://user:pw@script.google.com/macros/s/' + ID + '/exec',
    'explicit port': 'https://script.google.com:8443/macros/s/' + ID + '/exec',
    'query': OK + '?list=1',
    'empty query': OK + '?',
    'hash': OK + '#x',
    'trailing slash': OK + '/',
    'workspace path': 'https://script.google.com/a/macros/example.test/s/' + ID + '/exec',
    'backslash trick': 'https://script.google.com\\@evil.example/macros/s/' + ID + '/exec',
    'javascript:': 'javascript:alert(1)',
    'empty': '',
    'whitespace only': '   ',
    'other google host': 'https://docs.google.com/macros/s/' + ID + '/exec',
    'short id': 'https://script.google.com/' + 'macros/s/short/exec',
    'dev endpoint': 'https://script.google.com/macros/s/' + ID + '/dev',
    'an interior newline': 'https://script.google.com/macros/s/' + ID.slice(0, 5) + '\n' + ID.slice(5) + '/exec',
    'an interior tab': 'https://script.google.com/macros/s/' + ID + '\t/exec',
    'upper-case scheme and host': 'HTTPS://SCRIPT.GOOGLE.COM/macros/s/' + ID + '/exec',
    'explicit default port': 'https://script.google.com:443/macros/s/' + ID + '/exec',
    'encoded dot segment': 'https://script.google.com/macros/s/%2e%2e/exec',
    'path traversal': 'https://script.google.com/macros/s/' + ID + '/../exec',
    'a second address appended': OK + ' ' + OK,
  };
  for (const [name, value] of Object.entries(REFUSED)) {
    test('refuses: ' + name, () => {
      const r = f.parseSheetAddress(value);
      assert.strictEqual(r.ok, false);
      assert.ok(typeof r.why === 'string' && r.why.length > 5);
      assert.ok(!r.why.includes(ID), 'the reason never repeats the address');
    });
  }
  test('non-strings are refused, not thrown on', () => {
    for (const v of [null, undefined, 42, {}]) assert.strictEqual(f.parseSheetAddress(v).ok, false);
  });
});

describe('AC-I3 — one normaliser, ids per source, content-derived', () => {
  const SHEET_ROW = { when: '2026-10-01', disc: 'swim', duration: '60', intensity: 'easy', rpe: '6', a1: 'intent', a2: 'planned', a3: '', b2: 'good', b3: 'none', note: 'steady', phase: 'base' };
  const CACHE = { date: '2026-10-01', disc: 'swim', duration: 60, intensity: 'easy', rpe: 6, a1: 'intent', a2: 'planned', a3: null, b2: 'good', b3: 'none', note: 'steady', phase: 'base', loggedAt: 1790000000000 };
  test('a Sheet row and a cache entry for the same session get the same id', async () => {
    const a = await f.sessionImportId(f.normalizeSession(SHEET_ROW), {});
    const b = await f.sessionImportId(f.normalizeSession(CACHE), {});
    assert.strictEqual(a, b);
    assert.match(a, /^sheet-[0-9a-f]{32}-0$/);
  });
  test('two identical rows in one source get -0 and -1', async () => {
    const seen = {};
    const ids = [await f.sessionImportId(f.normalizeSession(SHEET_ROW), seen), await f.sessionImportId(f.normalizeSession(SHEET_ROW), seen)];
    assert.match(ids[0], /-0$/); assert.match(ids[1], /-1$/);
    assert.strictEqual(ids[0].slice(0, -2), ids[1].slice(0, -2));
  });
  test('the occurrence counter is per source: a fresh cache restarts at 0', async () => {
    const x = await f.sessionImportId(f.normalizeSession(SHEET_ROW), {});
    const y = await f.sessionImportId(f.normalizeSession(CACHE), {});
    assert.match(x, /-0$/); assert.match(y, /-0$/);
  });
  test('a different field gives a different id; the normaliser coerces "60 min", "" and NaN the same way for both shapes', async () => {
    const other = await f.sessionImportId(f.normalizeSession(Object.assign({}, SHEET_ROW, { note: 'other' })), {});
    assert.notStrictEqual(other.slice(0, -2), (await f.sessionImportId(f.normalizeSession(SHEET_ROW), {})).slice(0, -2));
    assert.strictEqual(f.normalizeSession({ when: '2026-10-01', duration: '60 min', rpe: 'x' }).duration, 60);
    assert.strictEqual(f.normalizeSession({ when: '2026-10-01', duration: '60 min', rpe: 'x' }).rpe, null);
    assert.strictEqual(f.normalizeSession({ date: '2026-10-01', duration: '', rpe: null }).duration, null);
  });
  test('loggedAt does not take part in the id', async () => {
    const a = await f.sessionImportId(f.normalizeSession(CACHE), {});
    const b = await f.sessionImportId(f.normalizeSession(Object.assign({}, CACHE, { loggedAt: 1 })), {});
    assert.strictEqual(a, b);
  });

  // A Sheet cell that holds a number comes back as a number; the device holds
  // the text the athlete typed. Both must derive the same id.
  test('numeric note parity: Sheet note:5 and device note:"5" get the same id; so do 0 and "0"', async () => {
    for (const [sheetNote, deviceNote] of [[5, '5'], [0, '0']]) {
      const a = await f.sessionImportId(f.normalizeSession(Object.assign({}, SHEET_ROW, { note: sheetNote })), {});
      const b = await f.sessionImportId(f.normalizeSession(Object.assign({}, CACHE, { note: deviceNote })), {});
      assert.strictEqual(a, b, 'note ' + JSON.stringify(sheetNote) + ' vs ' + JSON.stringify(deviceNote));
      assert.strictEqual(f.normalizeSession({ when: '2026-10-01', note: sheetNote }).note, deviceNote);
    }
  });
  test('an absent note is the empty string in both shapes, and 0 is not an absent note', () => {
    for (const n of [null, undefined, '']) {
      assert.strictEqual(f.normalizeSession({ when: '2026-10-01', note: n }).note, '');
      assert.strictEqual(f.normalizeSession({ date: '2026-10-01', note: n }).note, '');
    }
    assert.notStrictEqual(f.normalizeSession({ when: '2026-10-01', note: 0 }).note, '');
  });
  // Ids of ordinary sessions did not move. These two literals were computed with
  // the normaliser as it was before the note coercion (git show 0011f1f:index.html).
  test('ids for ordinary fixtures are byte-identical to what the previous normaliser produced', async () => {
    assert.strictEqual(await f.sessionImportId(f.normalizeSession(SHEET_ROW), {}), 'sheet-bc7eb60e4cb2fac9236d5ab5d2934f3b-0');
    assert.strictEqual(await f.sessionImportId(f.normalizeSession(Object.assign({}, CACHE, { note: '' })), {}), 'sheet-254197f9c5870adb99967d5eb6485fdc-0');
  });
});
