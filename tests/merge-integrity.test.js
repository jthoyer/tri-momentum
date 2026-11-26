'use strict';
// AC-M3. The Supabase storage layer was written against an older index.html
// that still had the splash; main has since deleted the splash and its
// functions. A merge of the two can be CLEAN and WRONG: git is happy, the file
// parses, and the first synced load calls a function nobody defines. This is
// the static check for that class, and it reads the shipped file.
//
//  1. nothing refers to the deleted splash (names, ids, the landing mode);
//  2. every function the script CALLS is declared in it (or is a known built-in);
//  3. every id the script looks up is in the markup or is assigned by the script.
//
// Each check is also run on a doctored copy that plants the defect it is for, so
// a checker that has gone blind fails here rather than passing quietly.

const { test } = require('node:test');
const assert = require('node:assert');
const { readIndex, inlineScript } = require('./lib/app');

const DELETED = [
  'renderSplashCountdown', 'renderSplashToday', 'splash-account', 'live-splash', 'splashScreen', 'splash-h',
  'view-splash', 'exitSplash', 'liveSplash', "state.mode === 'plan'", 'state.mode === "plan"',
];
function deletedRefs(html) {
  return DELETED.filter((d) => html.includes(d));
}

// Comments and string/regex literals out, so prose and data never look like calls.
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}
const BUILTINS = new Set(('if for while switch catch function return typeof new void delete in of do else throw ' +
  'parseInt parseFloat isNaN isFinite Promise String Number Boolean Date Array Object JSON URL Error Math RegExp Set Map ' +
  'WeakMap WeakSet AbortController TextEncoder Uint8Array Event setTimeout clearTimeout setInterval clearInterval fetch encodeURIComponent ' +
  'decodeURIComponent requestAnimationFrame alert confirm CustomEvent').split(' '));
function declared(src) {
  const names = new Set();
  for (const m of src.matchAll(/\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
    if (m[1]) names.add(m[1]);
    m[2].split(',').map((p) => p.trim()).filter(Boolean).forEach((p) => names.add(p));
  }
  for (const m of src.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)) names.add(m[1]);   // var a = 1, b = 2
  return names;
}
function undeclaredCalls(src) {
  const c = code(src);
  const have = declared(c);
  const out = new Set();
  for (const m of c.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n = m[2];
    if (BUILTINS.has(n) || have.has(n)) continue;
    out.add(n);
  }
  return [...out].sort();
}
function staticIds(html) {
  const body = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  return new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}
function unresolvedIds(html) {
  const src = inlineScript(html);
  const known = staticIds(html);
  for (const m of src.matchAll(/\.id\s*=\s*'([^']+)'/g)) known.add(m[1]);
  const looked = [...src.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  return [...new Set(looked.filter((id) => !known.has(id)))].sort();
}

test('AC-M3: nothing in index.html refers to the deleted splash or the landing mode', () => {
  assert.deepStrictEqual(deletedRefs(readIndex()), []);
});

test('AC-M3: every function the inline script calls is declared in it (storage layer included)', () => {
  assert.deepStrictEqual(undeclaredCalls(inlineScript()), []);
});

test('AC-M3: every id the script looks up exists in the markup or is assigned by the script', () => {
  assert.deepStrictEqual(unresolvedIds(readIndex()), []);
});

test('the checks above can fail: each fires on a doctored copy', () => {
  const html = readIndex();
  // (1) a call to a function main deleted, planted in the storage layer
  const planted = html.replace('function onEnteredSynced(){', 'function onEnteredSynced(){ renderSplashToday();');
  assert.notStrictEqual(planted, html, 'the plant found its anchor');
  assert.deepStrictEqual(deletedRefs(planted), ['renderSplashToday']);
  // (2) the same call, caught as undeclared even if the name list were out of date
  assert.deepStrictEqual(undeclaredCalls(inlineScript(planted)), ['renderSplashToday']);
  // (3) a lookup of an id that is nowhere
  const badId = html.replace("document.getElementById('import-cancel')", "document.getElementById('splash-account-btn')");
  assert.notStrictEqual(badId, html);
  assert.deepStrictEqual(unresolvedIds(badId), ['splash-account-btn']);
  // (4) the landing mode coming back
  assert.deepStrictEqual(deletedRefs(html.replace('function onEnteredSynced(){', "function onEnteredSynced(){ if(state.mode === 'plan'){}")), ["state.mode === 'plan'"]);
});
