'use strict';
// TM-015 AC-K1 evidence: small text checks over CLAUDE.md and supabase/README.md.
// Each check is a function over text, so it is also run on planted bad copies to show it can fail.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLAUDE = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
const README = fs.readFileSync(path.join(ROOT, 'supabase', 'README.md'), 'utf8');

// A decision starts a line with its number, then bold text or an italic "(Update/Superseded ...)" note.
function decisionNumbers(text) {
  return [...text.matchAll(/^(\d+)\. (?=\*\*|\*\()/gm)].map((m) => Number(m[1]));
}
function decisionProblems(text) {
  const nums = decisionNumbers(text);
  const bad = [];
  for (const n of [49, 50, 51]) {
    const c = nums.filter((x) => x === n).length;
    if (c !== 1) bad.push('decision ' + n + ' appears ' + c + ' times (want exactly 1)');
  }
  const dup = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];
  if (dup.length) bad.push('duplicate decision numbers: ' + dup.join(', '));
  return bad;
}
// The first cut of this work called itself 49; 49 is Swim strength. No Supabase line may say so.
function wrongNumberProblems(text) {
  return text.split('\n').map((l, i) => [l, i + 1]).filter(([l]) => /supabase/i.test(l) && /decision 49\b/i.test(l))
    .map(([, n]) => 'line ' + n + ' mentions Supabase and "decision 49"');
}

// Built from parts so this file does not look like a secret to the repo-wide scan.
const PREFIXES = ['sb_' + 'secret_', 'sb' + 'p_', 'GOC' + 'SPX', 'AKfy' + 'cb', 'sb_' + 'publishable_', 'service' + '_role_key'];
const PLACEHOLDER = /<project-ref>/;
function readmeProblems(text) {
  const bad = [];
  for (const m of text.matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.co/g)) {
    if (m[1] !== '<project-ref>' && !/^<[a-z-]+>$/.test(m[1])) bad.push('a real-looking project address: ' + m[0]);
  }
  for (const m of text.matchAll(/supabase\.com\/dashboard\/project\/([^\s)`'"/]+)/g)) {
    if (!PLACEHOLDER.test(m[1])) bad.push('a real-looking dashboard project path: ' + m[0]);
  }
  for (const m of text.matchAll(/\b[a-z0-9]{20}\b/g)) {
    if (/[a-z]/.test(m[0]) && /\d/.test(m[0])) bad.push('a 20-character project-ref-shaped token: ' + m[0]);
  }
  for (const p of PREFIXES) if (text.includes(p)) bad.push('a spelled-out secret prefix: ' + p);
  return bad;
}

test('CLAUDE.md: exactly one decision 49, one 50, one 51, and no duplicate numbers', () => {
  assert.deepStrictEqual(decisionProblems(CLAUDE), []);
  assert.ok(decisionNumbers(CLAUDE).length >= 40, 'the decision list was not found');
});
test('CLAUDE.md: no line that mentions Supabase says "decision 49"', () => {
  assert.deepStrictEqual(wrongNumberProblems(CLAUDE), []);
});
test('supabase/README.md: no real-looking project ref and no spelled-out secret prefix', () => {
  assert.ok(README.includes('<project-ref>'), 'the placeholder is missing, so the check reads the wrong file');
  assert.deepStrictEqual(readmeProblems(README), []);
});

// Discrimination: each check refuses a planted defect, in memory and in a scratch copy.
test('discriminates: a second decision 51, a missing 50, and a duplicate 49 are refused', () => {
  assert.ok(decisionProblems(CLAUDE + '\n51. **A second decision fifty-one.** text\n').some((b) => /decision 51 appears 2/.test(b)));
  assert.ok(decisionProblems(CLAUDE.replace(/^50\. \*\*/m, '5O. **')).some((b) => /decision 50 appears 0/.test(b)));
  assert.ok(decisionProblems(CLAUDE + '\n49. *(Superseded)* **Another 49.**\n').some((b) => /decision 49 appears 2/.test(b)));
});
test('discriminates: "decision 49" on a Supabase line is refused, on an unrelated line it is not', () => {
  assert.strictEqual(wrongNumberProblems('Storage moved to Supabase (decision 49).').length, 1);
  assert.strictEqual(wrongNumberProblems('Swim strength is decision 49.').length, 0);
});
test('discriminates: a project ref, a dashboard path and each secret prefix in the README are refused', () => {
  const ref = 'abcde12345fghij67890';
  assert.ok(readmeProblems(README + '\nhttps://' + ref + '.supabase.co\n').length >= 1);
  assert.ok(readmeProblems(README + '\nhttps://supabase.com/dashboard/project/' + ref + '\n').length >= 1);
  assert.ok(readmeProblems(README + '\nref ' + ref + '\n').length >= 1);
  for (const p of PREFIXES) assert.ok(readmeProblems(README + '\n' + p + 'x\n').length >= 1, p);
  assert.deepStrictEqual(readmeProblems('https://<project-ref>.supabase.co and a plain sentence'), []);
});
test('discriminates on a scratch copy written to disk; the real files stay clean', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-integrity-'));
  const c = path.join(dir, 'CLAUDE.md');
  fs.writeFileSync(c, CLAUDE + '\n51. **Duplicate.** x\nSupabase: decision 49\n');
  const text = fs.readFileSync(c, 'utf8');
  assert.ok(decisionProblems(text).length >= 1 && wrongNumberProblems(text).length >= 1);
  assert.deepStrictEqual(decisionProblems(CLAUDE), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
