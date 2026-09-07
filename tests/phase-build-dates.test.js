'use strict';
// Date maths for "Plan back from a race" (CLAUDE.md decision 43).
//
// phaseBuildBlocks() is pure on purpose — no module state, no DOM — so the one
// guarantee the screen exists to make (the last phase ends on race week) can be
// checked directly. The functions are extracted from index.html rather than
// reimplemented here: a copy would pass while the shipped logic was wrong.

const { test } = require('node:test');
const assert = require('node:assert');
const { loadFunctions, extractConst } = require('./lib/app');

// PHASE_BUILD_ORDER and the default week counts are read out of index.html
// rather than restated here: a hardcoded four-phase order would have gone on
// passing after Taper was added, which is exactly the drift a test must not
// have (CLAUDE.md decision 45).
const M = loadFunctions(
  ['isoDate', 'mondayOf', 'addDays', 'formatWeekdayDate', 'phaseBuildBlocks', 'phaseBuildSpanDates', 'phaseBuildSpanMeta'],
  `var MONTH_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
   var MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
   ` + extractConst('PHASE_BUILD_ORDER')
);
const ORDER = new Function(extractConst('PHASE_BUILD_ORDER') + 'return PHASE_BUILD_ORDER;')();
const FULL = new Function(extractConst('PHASE_BUILD_DEFAULT_WEEKS') + 'return PHASE_BUILD_DEFAULT_WEEKS;')();

const RACE = '2026-10-17'; // a Saturday; its Monday is 2026-10-12
const raceEndOf = (b) => M.isoDate(M.addDays(new Date(b.from + 'T00:00:00'), b.weeks * 7 - 1));

test('the cycle ends on Taper, and Base is what follows the race', () => {
  // The shape the athlete asked for: race week is a taper week, and base
  // picks up the Monday after. Read off the app's own constants, so changing
  // the cycle in index.html changes what this asserts.
  assert.strictEqual(ORDER[ORDER.length - 1], 'taper');
  assert.deepStrictEqual(ORDER, ['base', 'build1', 'build2', 'peak', 'taper']);
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  assert.strictEqual(b[b.length - 2].phase, 'taper');
  assert.strictEqual(b[b.length - 1].phase, 'base');
  assert.strictEqual(b[b.length - 1].openEnded, true);
});

test('race day falls inside the taper block, not the peak block', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  const taper = b.find((x) => x.phase === 'taper');
  const peak = b.find((x) => x.phase === 'peak');
  assert.ok(taper.from <= RACE && RACE <= raceEndOf(taper), 'race outside the taper block');
  assert.ok(raceEndOf(peak) < RACE, 'peak still covers race day');
});

test('a full cycle dates backwards from race week', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), [
    'base 2026-06-29',
    'build1 2026-07-27',
    'build2 2026-08-24',
    'peak 2026-09-21',
    'taper 2026-10-12',
    'base 2026-10-19',
  ]);
});

test('the last cycle block ends on race week', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  const last = b.filter((x) => !x.openEnded).pop();
  assert.strictEqual(last.endsRaceWeek, true);
  assert.ok(last.from <= RACE && RACE <= raceEndOf(last), `race ${RACE} outside ${last.from}..${raceEndOf(last)}`);
});

test('blocks are chronological, Monday-dated and never share a date', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].from < b[i].from);
  for (const x of b) assert.strictEqual(M.isoDate(M.mondayOf(new Date(x.from + 'T00:00:00'))), x.from);
  assert.strictEqual(new Set(b.map((x) => x.from)).size, b.length);
});

test('the post-race block starts the Monday after race week', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  const last = b[b.length - 1];
  assert.strictEqual(last.phase, 'base');
  assert.strictEqual(last.openEnded, true);
  assert.strictEqual(last.from, '2026-10-19');
});

test('unchecking the post-race block leaves the cycle alone', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, false);
  assert.strictEqual(b.length, ORDER.filter((k) => FULL[k] > 0).length);
  assert.ok(b.every((x) => !x.openEnded));
});

test('a cycle already ending in Base gets no duplicate post-race block', () => {
  // It would say exactly what the open-ended block before it already says.
  // Still reachable now Taper exists: zeroing taper and peak ends on base.
  const b = M.phaseBuildBlocks(RACE, { base: 3, build1: 0, build2: 0, peak: 0, taper: 0 }, true);
  assert.deepStrictEqual(b.map((x) => x.phase), ['base']);
});

test('a phase set to 0 is skipped, not emitted as a zero-length block', () => {
  const b = M.phaseBuildBlocks(RACE, { base: 2, build1: 0, build2: 0, peak: 1, taper: 0 }, false);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), ['base 2026-09-28', 'peak 2026-10-12']);
});

test('zeroing the taper puts whatever precedes it back on race week', () => {
  const b = M.phaseBuildBlocks(RACE, { base: 0, build1: 0, build2: 0, peak: 2, taper: 0 }, false);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), ['peak 2026-10-05']);
  assert.strictEqual(b[0].endsRaceWeek, true);
});

test('all zero produces nothing', () => {
  assert.deepStrictEqual(M.phaseBuildBlocks(RACE, { base: 0, build1: 0, build2: 0, peak: 0, taper: 0 }, true), []);
});

test('a race falling on a Monday still ends on its own week', () => {
  const b = M.phaseBuildBlocks('2026-10-12', { base: 0, build1: 0, build2: 0, peak: 1, taper: 1 }, true);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), ['peak 2026-10-05', 'taper 2026-10-12', 'base 2026-10-19']);
});

test('a cycle crossing the year boundary stays chronological', () => {
  const b = M.phaseBuildBlocks('2027-01-09', { base: 2, build1: 2, build2: 2, peak: 2, taper: 1 }, true);
  assert.strictEqual(b[0].from, '2026-11-09');
  assert.strictEqual(b.find((x) => x.phase === 'taper').from, '2027-01-04');
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].from < b[i].from);
});

test('span labels read as a date range and a week count', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  assert.strictEqual(M.phaseBuildSpanDates(b[4]), 'Mon 12 Oct – Sun 18 Oct');
  assert.strictEqual(M.phaseBuildSpanMeta(b[4]), '1 week · ends race week');
  assert.strictEqual(M.phaseBuildSpanDates(b[5]), 'From Mon 19 Oct');
  assert.strictEqual(M.phaseBuildSpanMeta(b[5]), 'Ongoing · after the race');
  assert.strictEqual(M.phaseBuildSpanMeta({ weeks: 2 }), '2 weeks');
});
