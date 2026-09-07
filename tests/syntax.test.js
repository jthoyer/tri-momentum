'use strict';
// The cheapest check that matters in this repo, and the one that covers every
// future change rather than one feature: index.html is a single 200KB+ inline
// script served straight to GitHub Pages with no build step, so a syntax error
// ships. The Strength sub-apps are separate deployable units with the same
// property (CLAUDE.md decision 14).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, readIndex, inlineScript, extractConst } = require('./lib/app');

test('index.html inline script parses', () => {
  assert.doesNotThrow(() => new Function(inlineScript()));
});

test('index.html has exactly one inline script block', () => {
  const blocks = readIndex().match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.strictEqual(blocks.length, 1);
});

for (const dir of fs.readdirSync(ROOT).filter((d) => /^TRI-.*strength mobile app$/.test(d))) {
  test(`${dir}/app.js parses`, () => {
    const src = fs.readFileSync(path.join(ROOT, dir, 'app.js'), 'utf8');
    assert.doesNotThrow(() => new Function(src));
  });
}

test('every view in the showView chain is excluded from isFlow', () => {
  // isFlow is "none of the named views". A view added to showView() without
  // being added to this chain renders the check-in flow underneath it — a
  // whole-screen defect with no error (CLAUDE.md decision 43).
  const src = inlineScript();
  const chain = src.match(/var isFlow = ([^;]+);/);
  assert.ok(chain, 'isFlow chain not found');
  const declared = [...src.matchAll(/var (is[A-Z]\w*) = view === '/g)].map((m) => m[1]);
  assert.ok(declared.length >= 7, 'expected several view flags, found ' + declared.length);
  for (const flag of declared) {
    assert.ok(chain[1].includes('!' + flag), `isFlow does not exclude ${flag}`);
  }
});

test('every phase value has a pill class and a colour rule for it', () => {
  // A phase added to PERIOD without a PERIOD_PILL_CLASS entry falls through to
  // the grey default everywhere a phase renders — Month week pills, the race
  // calendar band, the phase editor — with no error. Adding Taper is what made
  // this reachable (CLAUDE.md decision 45).
  const src = inlineScript();
  const css = (readIndex().match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const period = new Function(extractConst('PERIOD', src) + 'return PERIOD;')();
  const pillClass = new Function(extractConst('PERIOD_PILL_CLASS', src) + 'return PERIOD_PILL_CLASS;')();

  assert.ok(period.length >= 4, 'expected at least four phases, found ' + period.length);
  for (const { v, label } of period) {
    assert.ok(label && label.trim(), `phase ${v} has no label`);
    const cls = pillClass[v];
    assert.ok(cls, `phase ${v} has no PERIOD_PILL_CLASS entry — its pill renders grey`);
    // The three places a phase colour is actually painted.
    for (const sel of ['.month-week-pill.', '.race-cal-phase.', '.race-cal-legend-dot.']) {
      assert.ok(css.includes(sel + cls + '{'), `no CSS rule for ${sel}${cls}`);
    }
  }
  // The race-calendar legend must caption every distinct phase colour, or a
  // band appears in a colour the legend never explains.
  const legendClasses = new Set(Object.values(pillClass));
  for (const cls of legendClasses) {
    assert.ok(
      new RegExp("cls: '" + cls + "'").test(src),
      `${cls} is a phase colour but the race-calendar legend never lists it`
    );
  }
});

// Components the code hides by setting `.hidden`, with the full class list each
// one actually carries. The class list matters: an element can take its display
// mode from one class and its [hidden] guard from another — #phasebuild-actions
// is display:flex via .plan-form-actions and guarded via .phasebuild-actions.
// Add a row here whenever a new component is hidden this way.
const HIDEABLE = [
  { name: '#phasebuild-actions', classes: ['plan-form-actions', 'phasebuild-actions'] },
  { name: '.flow-foot', classes: ['flow-foot'] },
  { name: '.plan-form-wrap', classes: ['plan-form-wrap'] },
  { name: '.race-form-wrap', classes: ['race-form-wrap'] },
  { name: '.splash', classes: ['splash'] },
  { name: '.period', classes: ['period'] },
];

test('every component hidden via .hidden has a [hidden] rule that can win', () => {
  // This file has no global [hidden]{display:none}. An author `display` rule
  // beats the UA default, so `.hidden = true` on a display:flex element does
  // nothing at all, silently (CLAUDE.md decisions 32 and 43).
  const css = (readIndex().match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  assert.ok(css.length, 'no <style> block found');
  assert.ok(!/(^|\})\s*\[hidden\]\s*\{/.test(css), 'a global [hidden] rule now exists — this check is stale');

  const setsDisplay = (cls) =>
    new RegExp('\\.' + cls + '\\{[^}]*display:(flex|grid|block|inline-flex|inline-block)').test(css);
  const isGuarded = (cls) => css.includes('.' + cls + '[hidden]');

  for (const { name, classes } of HIDEABLE) {
    assert.ok(
      classes.some((c) => setsDisplay(c) || isGuarded(c)),
      `${name}: none of its classes exist in the CSS any more — is this row stale?`
    );
    if (classes.some(setsDisplay)) {
      assert.ok(
        classes.some(isGuarded),
        `${name} takes a display mode from ${classes.filter(setsDisplay).join(', ')} ` +
          `but no class of its has a [hidden] rule — setting .hidden on it does nothing`
      );
    }
  }
});
