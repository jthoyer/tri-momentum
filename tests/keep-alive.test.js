'use strict';
// TM-015 AC-W1..W3. A static check of .github/workflows/keep-alive.yml, plus a run of its
// shell step with a stub `curl` (no network, ever). The workflow must hold no project host,
// no key and no project ref: the URL comes from a repository variable and the publishable key
// from a repository SECRET only (variables are echoed in run logs). There is no YAML parser in this repo, so the file is
// read as text; checkWorkflow() is also run on planted bad copies to prove each rule can fail.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'keep-alive.yml');
const REAL = fs.readFileSync(WORKFLOW, 'utf8');

// Built from parts so this file does not itself look like a secret to a repo-wide scan.
const KEY_SHAPES = [
  new RegExp('sb_' + 'publishable_[A-Za-z0-9_-]{8,}'),
  new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{8,}'),
  new RegExp('sbp' + '_[A-Za-z0-9]{20,}'),
  new RegExp('eyJ[A-Za-z0-9_-]{5,}\\.eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}'),
  /\b[A-Za-z0-9_-]{40,}\b/, // any long token-looking run
];
const HOST = /[a-z0-9-]+\.supabase\.co/i;

function lines(text) { return text.split('\n'); }
function code(text) { return lines(text).filter((l) => !/^\s*#/.test(l)).join('\n'); }

// Returns a list of problems; empty means every rule holds.
function checkWorkflow(text) {
  const bad = [];
  const body = code(text);

  if (!/^permissions:\s*\{\}\s*$/m.test(body)) bad.push('permissions must be {} at the top level');

  const crons = [...body.matchAll(/^\s*-\s*cron:\s*'([^']+)'\s*$/gm)].map((m) => m[1]);
  if (crons.length === 0) bad.push('no cron schedule found');
  for (const c of crons) {
    const f = c.trim().split(/\s+/);
    if (f.length !== 5) { bad.push('cron "' + c + '" does not have five fields'); continue; }
    const [min, hr, dom, mon, dow] = f;
    if (!/^\d+$/.test(min) || !/^\d+$/.test(hr)) bad.push('cron "' + c + '": minute and hour must be fixed numbers');
    if (mon !== '*' || dow !== '*') bad.push('cron "' + c + '": month and weekday must be *');
    const step = dom === '*' ? 1 : (dom.match(/^\*\/(\d+)$/) || [])[1];
    if (!step || Number(step) < 1 || Number(step) > 3) bad.push('cron "' + c + '": day-of-month must be * or */N with N <= 3');
  }
  if (!/^\s*workflow_dispatch:/m.test(body)) bad.push('workflow_dispatch is missing');

  // no hostname, no key-shaped string, anywhere (comments included)
  if (HOST.test(text)) bad.push('contains a *.supabase.co hostname: ' + text.match(HOST)[0]);
  for (const re of KEY_SHAPES) {
    const m = text.match(re);
    if (m) bad.push('contains a key-shaped string: ' + m[0].slice(0, 12) + '...');
  }

  // URL from a repository variable; key from a repository secret ONLY (never a variable)
  const env = (name) => (body.match(new RegExp('^\\s*' + name + ':\\s*(.*)$', 'm')) || [])[1];
  if ((env('SUPABASE_URL') || '').trim() !== '${{ vars.SUPABASE_URL }}') bad.push('SUPABASE_URL must be exactly ${{ vars.SUPABASE_URL }}');
  if ((env('SUPABASE_KEY') || '').trim() !== '${{ secrets.SUPABASE_KEY }}') bad.push('SUPABASE_KEY must be exactly ${{ secrets.SUPABASE_KEY }}');
  for (const m of body.matchAll(/\$\{\{([^}]*)\}\}/g)) {
    if (!/^\s*(vars\.SUPABASE_URL|secrets\.SUPABASE_KEY)\s*$/.test(m[1])) bad.push('unexpected expression: ' + m[0]);
  }
  if (/vars\.SUPABASE_KEY/.test(text)) bad.push('the key must not be read from vars.SUPABASE_KEY (variables show in run logs)');

  // fails cleanly: unset checks and URL shape check, each with a message on stderr and exit 1
  for (const v of ['SUPABASE_URL', 'SUPABASE_KEY']) {
    const re = new RegExp('if \\[ -z "\\$' + v + '" \\]; then\\s*\\n\\s*echo "[^"]*' + v + ' is not set[^"]*" >&2\\s*\\n\\s*exit 1');
    if (!re.test(body)) bad.push('no clean failure (message on stderr, exit 1) when ' + v + ' is unset');
  }
  if (!/grep -Eq '\^https:\/\/\[a-z0-9\]\{20\}\\\.supabase\\\.co\$'/.test(body)) bad.push('no check that SUPABASE_URL matches ^https://[a-z0-9]{20}\\.supabase\\.co$');
  if (!/-ge 500/.test(body) || !/-eq 000/.test(body)) bad.push('does not fail on a 5xx or a network error');

  // reads no table: the only paths appended to the URL are the two gateway endpoints
  const paths = [...body.matchAll(/"\$SUPABASE_URL([^"]+)"/g)].map((m) => m[1]);
  const looped = (body.match(/for path in ([^;]+);/) || [])[1];
  if (!looped || looped.trim() !== '/rest/v1/ /auth/v1/health') bad.push('the ping loop must cover exactly /rest/v1/ and /auth/v1/health');
  for (const p of paths) if (p !== '$path') bad.push('URL used with a literal path: ' + p);
  if (/\/rest\/v1\/[a-z_]/.test(body)) bad.push('reads a table under /rest/v1/');
  return bad;
}

// The `run: |` block of the ping step, de-indented.
function runScript(text) {
  const ls = lines(text);
  const i = ls.findIndex((l) => /^\s*run:\s*\|\s*$/.test(l));
  assert.ok(i >= 0, 'run block not found');
  const indent = ls[i + 1].match(/^\s*/)[0].length;
  const out = [];
  for (let j = i + 1; j < ls.length && (ls[j].trim() === '' || ls[j].match(/^\s*/)[0].length >= indent); j++) out.push(ls[j].slice(indent));
  return out.join('\n');
}

test('the real workflow passes every static rule', () => {
  assert.deepStrictEqual(checkWorkflow(REAL), []);
});

test('the schedule is exactly one cron, every 3 days', () => {
  const crons = [...REAL.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.deepStrictEqual(crons, ['17 3 */3 * *']);
});

// Each planted defect must be reported, and by the rule it breaks.
const PLANTS = [
  ['hardcoded project host', (t) => t.replace('${{ vars.SUPABASE_URL }}', 'https://abcdefghijklmnopqrst.supabase.co'), /supabase\.co hostname/],
  ['host hidden in a comment', (t) => '# see https://abcdefghijklmnopqrst.supabase.co\n' + t, /supabase\.co hostname/],
  ['publishable key literal', (t) => t.replace('${{ secrets.SUPABASE_KEY }}', 'sb_' + 'publishable_AAAAAAAAAAAAAAAAAAAA'), /key-shaped/],
  ['JWT literal in a comment', (t) => '# eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl\n' + t, /key-shaped/],
  ['long token literal', (t) => t + '# ' + 'A'.repeat(48) + '\n', /key-shaped/],
  ['schedule every 4 days', (t) => t.replace('*/3', '*/4'), /N <= 3/],
  ['schedule weekly', (t) => t.replace("'17 3 */3 * *'", "'17 3 * * 0'"), /weekday must be \*/],
  ['schedule as a day list', (t) => t.replace('*/3', '1,10,20'), /N <= 3/],
  ['no schedule', (t) => t.replace(/^\s*schedule:\n\s*- cron:.*\n/m, ''), /no cron/],
  ['permissions widened', (t) => t.replace('permissions: {}', 'permissions:\n  contents: read'), /permissions must be/],
  ['URL from a literal env value', (t) => t.replace('${{ vars.SUPABASE_URL }}', 'http://localhost'), /SUPABASE_URL must be exactly/],
  ['key from an unrelated expression', (t) => t.replace('${{ secrets.SUPABASE_KEY }}', '${{ github.token }}'), /SUPABASE_KEY must be exactly|unexpected expression/],
  ['key read from vars only', (t) => t.replace('${{ secrets.SUPABASE_KEY }}', '${{ vars.SUPABASE_KEY }}'), /must not be read from vars|SUPABASE_KEY must be exactly/],
  ['key read from vars with a secrets fallback', (t) => t.replace('${{ secrets.SUPABASE_KEY }}', '${{ vars.SUPABASE_KEY || secrets.SUPABASE_KEY }}'), /must not be read from vars/],
  ['a vars.SUPABASE_KEY use hidden in a comment', (t) => '# fallback: ${{ vars.SUPABASE_KEY }}\n' + t, /must not be read from vars/],
  ['unset-URL guard removed', (t) => t.replace(/if \[ -z "\$SUPABASE_URL" \]; then[\s\S]*?fi\n\s*if \[ -z "\$SUPABASE_KEY"/, 'if [ -z "$SUPABASE_KEY"'), /when SUPABASE_URL is unset/],
  ['unset-key message not on stderr', (t) => t.replace('SUPABASE_KEY is not set as a repository secret." >&2', 'SUPABASE_KEY is not set as a repository secret."'), /when SUPABASE_KEY is unset/],
  ['URL shape check removed', (t) => t.replace(/grep -Eq '[^']*'/, 'grep -Eq "."'), /matches \^https/],
  ['5xx no longer fails', (t) => t.replace('-ge 500', '-ge 600'), /5xx/],
  ['reads a table', (t) => t.replace('/rest/v1/ /auth/v1/health', '/rest/v1/ /rest/v1/session_checkins'), /exactly \/rest\/v1\/ and|reads a table/],
];
for (const [name, mutate, want] of PLANTS) {
  test('planted defect is refused: ' + name, () => {
    const planted = mutate(REAL);
    assert.notStrictEqual(planted, REAL, 'the plant did not change the file');
    const bad = checkWorkflow(planted);
    assert.ok(bad.some((b) => want.test(b)), 'expected a problem matching ' + want + ', got ' + JSON.stringify(bad));
  });
}

test('a planted workflow written to a scratch file is refused, the real file is not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepalive-'));
  const bad = path.join(dir, 'keep-alive.yml');
  fs.writeFileSync(bad, REAL.replace('${{ vars.SUPABASE_URL }}', 'https://abcdefghijklmnopqrst.supabase.co'));
  assert.ok(checkWorkflow(fs.readFileSync(bad, 'utf8')).length > 0);
  assert.deepStrictEqual(checkWorkflow(fs.readFileSync(WORKFLOW, 'utf8')), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Run the step's shell with a stub curl first on PATH: nothing leaves this machine.
function runStep({ url, key, curlStatus, curlExit = 0 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepalive-run-'));
  const calls = path.join(dir, 'calls.txt');
  fs.writeFileSync(path.join(dir, 'curl'),
    '#!/usr/bin/env bash\necho "$@" >> "' + calls + '"\nprintf "%s" "' + curlStatus + '"\nexit ' + curlExit + '\n', { mode: 0o755 });
  const env = { PATH: dir + ':' + process.env.PATH };
  if (url !== undefined) env.SUPABASE_URL = url;
  if (key !== undefined) env.SUPABASE_KEY = key;
  const r = spawnSync('bash', ['-e', '-c', runScript(REAL)], { env, encoding: 'utf8' });
  const called = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '';
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout, called };
}
const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

test('step: URL unset -> exit 1, plain message, no request', () => {
  const r = runStep({ key: 'k', curlStatus: 200 });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /SUPABASE_URL is not set/);
  assert.strictEqual(r.called, '');
});
test('step: key unset -> exit 1, plain message, no request', () => {
  const r = runStep({ url: URL_OK, curlStatus: 200 });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /SUPABASE_KEY is not set/);
  assert.strictEqual(r.called, '');
});
test('step: malformed URLs are refused before any request', () => {
  for (const url of ['https://example.com', URL_OK + '/', 'http://abcdefghijklmnopqrst.supabase.co', 'https://abcdefghijklmnopqrst.supabase.co.evil.example', 'https://short.supabase.co']) {
    const r = runStep({ url, key: 'k', curlStatus: 200 });
    assert.strictEqual(r.status, 1, url);
    assert.match(r.stderr, /not a project URL/, url);
    assert.strictEqual(r.called, '', url);
  }
});
test('step: a healthy project -> exit 0, only the two gateway paths requested, key sent as apikey header', () => {
  const r = runStep({ url: URL_OK, key: 'test-key', curlStatus: 200 });
  assert.strictEqual(r.status, 0, r.stderr);
  const urls = r.called.trim().split('\n').map((l) => l.match(/https:\/\/\S+/)[0]);
  assert.deepStrictEqual(urls, [URL_OK + '/rest/v1/', URL_OK + '/auth/v1/health']);
  assert.match(r.called, /apikey: test-key/);
});
test('step: a 401 from the gateway still counts as traffic -> exit 0', () => {
  assert.strictEqual(runStep({ url: URL_OK, key: 'k', curlStatus: 401 }).status, 0);
});
test('step: a 5xx -> exit 1 with a plain message', () => {
  const r = runStep({ url: URL_OK, key: 'k', curlStatus: 503 });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /did not answer/);
});
test('step: a network error (curl exits non-zero) -> exit 1 with a plain message', () => {
  const r = runStep({ url: URL_OK, key: 'k', curlStatus: '000', curlExit: 6 });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /did not answer/);
});
