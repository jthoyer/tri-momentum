'use strict';
// Date maths for "Plan back from a race" (CLAUDE.md decision 43).
//
// phaseBuildBlocks() is pure on purpose — no module state, no DOM — so the one
// guarantee the screen exists to make (the last phase ends on race week) can be
// checked directly. The functions are extracted from index.html rather than
// reimplemented here: a copy would pass while the shipped logic was wrong.

const { test } = require('node:test');
const assert = require('node:assert');
const { loadFunctions } = require('./lib/app');

const M = loadFunctions(
  ['isoDate', 'mondayOf', 'addDays', 'formatWeekdayDate', 'phaseBuildBlocks', 'phaseBuildSpanDates', 'phaseBuildSpanMeta'],
  `var MONTH_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
   var MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
   var PHASE_BUILD_ORDER=['base','build1','build2','peak'];`
);

const FULL = { base: 4, build1: 4, build2: 4, peak: 3 };
const RACE = '2026-10-17'; // a Saturday; its Monday is 2026-10-12

test('a full cycle dates backwards from race week', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  assert.deepStrictEqual(
    b.map((x) => x.phase + ' ' + x.from),
    ['base 2026-07-06', 'build1 2026-08-03', 'build2 2026-08-31', 'peak 2026-09-28', 'base 2026-10-19']
  );
});

test('the last cycle block ends on race week', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  const peak = b[3];
  assert.strictEqual(peak.endsRaceWeek, true);
  const end = M.isoDate(M.addDays(new Date(peak.from + 'T00:00:00'), peak.weeks * 7 - 1));
  assert.ok(peak.from <= RACE && RACE <= end, `race ${RACE} outside ${peak.from}..${end}`);
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
  assert.strictEqual(b.length, 4);
  assert.ok(b.every((x) => !x.openEnded));
});

test('a cycle already ending in Base gets no duplicate post-race block', () => {
  // It would say exactly what the open-ended block before it already says.
  const b = M.phaseBuildBlocks(RACE, { base: 3, build1: 0, build2: 0, peak: 0 }, true);
  assert.deepStrictEqual(b.map((x) => x.phase), ['base']);
});

test('a phase set to 0 is skipped, not emitted as a zero-length block', () => {
  const b = M.phaseBuildBlocks(RACE, { base: 2, build1: 0, build2: 0, peak: 1 }, false);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), ['base 2026-09-28', 'peak 2026-10-12']);
});

test('all zero produces nothing', () => {
  assert.deepStrictEqual(M.phaseBuildBlocks(RACE, { base: 0, build1: 0, build2: 0, peak: 0 }, true), []);
});

test('a race falling on a Monday still ends on its own week', () => {
  const b = M.phaseBuildBlocks('2026-10-12', { base: 0, build1: 0, build2: 0, peak: 2 }, true);
  assert.deepStrictEqual(b.map((x) => x.phase + ' ' + x.from), ['peak 2026-10-05', 'base 2026-10-19']);
});

test('a cycle crossing the year boundary stays chronological', () => {
  const b = M.phaseBuildBlocks('2027-01-09', { base: 2, build1: 2, build2: 2, peak: 2 }, true);
  assert.strictEqual(b[0].from, '2026-11-16');
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].from < b[i].from);
});

test('span labels read as a date range and a week count', () => {
  const b = M.phaseBuildBlocks(RACE, FULL, true);
  assert.strictEqual(M.phaseBuildSpanDates(b[3]), 'Mon 28 Sep – Sun 18 Oct');
  assert.strictEqual(M.phaseBuildSpanMeta(b[3]), '3 weeks · ends race week');
  assert.strictEqual(M.phaseBuildSpanDates(b[4]), 'From Mon 19 Oct');
  assert.strictEqual(M.phaseBuildSpanMeta(b[4]), 'Ongoing · after the race');
  assert.strictEqual(M.phaseBuildSpanMeta({ weeks: 1 }), '1 week');
});
