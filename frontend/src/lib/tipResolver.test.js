/**
 * TRI Momentum — tests for tipResolver.js
 * =======================================
 *     npm test                                  (from frontend/)
 *     node --test src/lib/tipResolver.test.js    (a single file)
 *
 * No install needed. This uses Node's built-in test runner, and tipResolver.js
 * imports nothing, so there is nothing to resolve and no dependency to add.
 *
 * WHY THIS FILE
 * tipResolver decides what the athlete sees. resolvePosition() walks a variable
 * block config to work out the phase and week; resolveProximityZone() decides
 * whether the race overlay replaces that. Both are date arithmetic, which is the
 * classic place for an off-by-one that a careful read will not catch.
 *
 * DETERMINISM
 * Every date-based test passes an explicit `today`. Nothing calls new Date()
 * without an argument, so these results are the same in every timezone and on
 * every day of the year. Dates are built by adding exact millisecond offsets to a
 * fixed UTC instant, so daylight saving cannot shift a boundary either.
 *
 * TWO TESTS DOCUMENT BEHAVIOUR RATHER THAN ASSERT A RULE.
 * Both are marked  DOCUMENTS CURRENT BEHAVIOUR  and explain the question they
 * raise. They are written so that changing the behaviour breaks a test rather
 * than passing silently.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BLOCK_CONFIG,
  BLOCK_CONFIG_RANGES,
  PILLAR_EMPHASIS,
  ALL_PILLARS,
  resolvePhasePosition,
  resolvePosition,
  resolveTip,
  resolveAllPillarsForDay,
  validateBlockConfig,
  blockLength,
  describeBlockConfig,
  resolveProximityZone,
  daysToRace,
  resolveProximityTip,
  canAccessPhase,
} from './tipResolver.js';

const DAY = 24 * 60 * 60 * 1000;

/** A fixed UTC instant to hang every date test off. */
const START = new Date('2026-01-05T00:00:00.000Z');

/** `weeks` whole weeks (and optionally extra days) after START. */
const after = (weeks, extraDays = 0) =>
  new Date(START.getTime() + (weeks * 7 + extraDays) * DAY);

// ─── resolvePhasePosition ─────────────────────────────────────────────────────

describe('resolvePhasePosition', () => {
  test('a one-week phase is always "only"', () => {
    assert.equal(resolvePhasePosition(1, 1), 'only');
  });

  test('a two-week phase has no middle', () => {
    assert.equal(resolvePhasePosition(1, 2), 'early');
    assert.equal(resolvePhasePosition(2, 2), 'late');
  });

  test('a three-week phase is early, mid, late', () => {
    assert.equal(resolvePhasePosition(1, 3), 'early');
    assert.equal(resolvePhasePosition(2, 3), 'mid');
    assert.equal(resolvePhasePosition(3, 3), 'late');
  });

  test('a long phase repeats "mid" and keeps one "late"', () => {
    assert.equal(resolvePhasePosition(1, 8), 'early');
    for (const wk of [2, 3, 4, 5, 6, 7]) {
      assert.equal(resolvePhasePosition(wk, 8), 'mid', `week ${wk} of 8`);
    }
    assert.equal(resolvePhasePosition(8, 8), 'late');
  });
});

// ─── blockLength / describeBlockConfig ────────────────────────────────────────

describe('blockLength', () => {
  test('the default block is ten weeks', () => {
    assert.equal(blockLength(), 10);
    assert.equal(blockLength(DEFAULT_BLOCK_CONFIG), 10);
  });

  test('the longest allowed block is seventeen weeks', () => {
    assert.equal(blockLength({ base: 8, build: 4, peak: 4, recovery: 1 }), 17);
  });

  test('the shortest allowed block is four weeks', () => {
    assert.equal(blockLength({ base: 1, build: 1, peak: 1, recovery: 1 }), 4);
  });

  test('recovery is pinned to one week even if a longer one is passed in', () => {
    assert.equal(blockLength({ base: 1, build: 1, peak: 1, recovery: 9 }), 4);
  });

  test('a partial config falls back to the defaults for whatever is missing', () => {
    assert.equal(blockLength({ base: 6 }), 12, '6 base + default 3 build + 2 peak + 1 recovery');
  });
});

describe('describeBlockConfig', () => {
  test('reads as a sentence with the total on the end', () => {
    assert.equal(describeBlockConfig(), '4w base → 3w build → 2w peak → 1w recovery (10 weeks)');
  });

  test('reflects a custom config', () => {
    assert.equal(
      describeBlockConfig({ base: 8, build: 4, peak: 4 }),
      '8w base → 4w build → 4w peak → 1w recovery (17 weeks)'
    );
  });
});

// ─── validateBlockConfig ──────────────────────────────────────────────────────

describe('validateBlockConfig', () => {
  test('the default config is valid', () => {
    assert.deepEqual(validateBlockConfig(DEFAULT_BLOCK_CONFIG), { valid: true });
  });

  test('every phase must be at least one week', () => {
    const out = validateBlockConfig({ base: 0, build: 3, peak: 2, recovery: 1 });
    assert.equal(out.valid, false);
    assert.match(out.errors[0], /^base: must be between 1 and 8/);
  });

  test('base tops out at eight weeks', () => {
    assert.equal(validateBlockConfig({ base: 9, build: 3, peak: 2, recovery: 1 }).valid, false);
    assert.equal(validateBlockConfig({ base: 8, build: 3, peak: 2, recovery: 1 }).valid, true);
  });

  test('build and peak top out at four weeks', () => {
    assert.equal(validateBlockConfig({ base: 4, build: 5, peak: 2, recovery: 1 }).valid, false);
    assert.equal(validateBlockConfig({ base: 4, build: 3, peak: 5, recovery: 1 }).valid, false);
    assert.equal(validateBlockConfig({ base: 4, build: 4, peak: 4, recovery: 1 }).valid, true);
  });

  test('recovery must be exactly one week', () => {
    assert.equal(validateBlockConfig({ base: 4, build: 3, peak: 2, recovery: 2 }).valid, false);
  });

  test('a fractional week is rejected as not an integer', () => {
    const out = validateBlockConfig({ base: 4.5, build: 3, peak: 2, recovery: 1 });
    assert.equal(out.valid, false);
    assert.deepEqual(out.errors, ['base: must be an integer']);
  });

  test('a string that looks like a number is still rejected', () => {
    assert.equal(validateBlockConfig({ base: '4', build: 3, peak: 2, recovery: 1 }).valid, false);
  });

  test('an empty or missing config reports every phase, not just the first', () => {
    assert.equal(validateBlockConfig({}).errors.length, 4);
    assert.equal(validateBlockConfig(null).errors.length, 4, 'null must not throw');
    assert.equal(validateBlockConfig(undefined).errors.length, 4);
  });

  test('the stated ranges are the ones actually enforced', () => {
    for (const [phase, range] of Object.entries(BLOCK_CONFIG_RANGES)) {
      const atMin = { ...DEFAULT_BLOCK_CONFIG, [phase]: range.min };
      const atMax = { ...DEFAULT_BLOCK_CONFIG, [phase]: range.max };
      const under = { ...DEFAULT_BLOCK_CONFIG, [phase]: range.min - 1 };
      const over = { ...DEFAULT_BLOCK_CONFIG, [phase]: range.max + 1 };
      assert.equal(validateBlockConfig(atMin).valid, true, `${phase} at min`);
      assert.equal(validateBlockConfig(atMax).valid, true, `${phase} at max`);
      assert.equal(validateBlockConfig(under).valid, false, `${phase} below min`);
      assert.equal(validateBlockConfig(over).valid, false, `${phase} above max`);
    }
  });
});

// ─── resolvePosition ──────────────────────────────────────────────────────────

describe('resolvePosition — walking the default 10-week block', () => {
  // base 4 → build 3 → peak 2 → recovery 1
  const expected = [
    { wk: 0, phase: 'base', pos: 'early', pillar: 'foundations', weekInPhase: 1, phaseLength: 4 },
    { wk: 1, phase: 'base', pos: 'mid', pillar: 'technique', weekInPhase: 2, phaseLength: 4 },
    { wk: 2, phase: 'base', pos: 'mid', pillar: 'technique', weekInPhase: 3, phaseLength: 4 },
    { wk: 3, phase: 'base', pos: 'late', pillar: 'durability', weekInPhase: 4, phaseLength: 4 },
    { wk: 4, phase: 'build', pos: 'early', pillar: 'intensity', weekInPhase: 1, phaseLength: 3 },
    { wk: 5, phase: 'build', pos: 'mid', pillar: 'technique', weekInPhase: 2, phaseLength: 3 },
    { wk: 6, phase: 'build', pos: 'late', pillar: 'durability', weekInPhase: 3, phaseLength: 3 },
    { wk: 7, phase: 'peak', pos: 'early', pillar: 'racecraft', weekInPhase: 1, phaseLength: 2 },
    { wk: 8, phase: 'peak', pos: 'late', pillar: 'durability', weekInPhase: 2, phaseLength: 2 },
    { wk: 9, phase: 'recovery', pos: 'only', pillar: 'durability', weekInPhase: 1, phaseLength: 1 },
  ];

  for (const e of expected) {
    test(`week ${e.wk} is ${e.phase} / ${e.pos} → ${e.pillar}`, () => {
      const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(e.wk));
      assert.equal(p.phase, e.phase);
      assert.equal(p.phasePosition, e.pos);
      assert.equal(p.emphasisPillar, e.pillar);
      assert.equal(p.weekInPhase, e.weekInPhase);
      assert.equal(p.phaseLength, e.phaseLength);
      assert.equal(p.weekInSeason, e.wk);
      assert.equal(p.blockNumber, 1);
    });
  }

  test('week 10 starts block 2 back at base / early', () => {
    const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(10));
    assert.equal(p.blockNumber, 2);
    assert.equal(p.weekInBlock, 0);
    assert.equal(p.phase, 'base');
    assert.equal(p.phasePosition, 'early');
    assert.equal(p.weekInSeason, 10);
  });

  test('block 3 lands where block 1 did', () => {
    const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(24));
    assert.equal(p.blockNumber, 3);
    assert.equal(p.weekInBlock, 4);
    assert.equal(p.phase, 'build');
    assert.equal(p.phasePosition, 'early');
  });
});

describe('resolvePosition — boundaries', () => {
  test('day one of training is week 0, not week 1', () => {
    assert.equal(resolvePosition(START, DEFAULT_BLOCK_CONFIG, START).weekInSeason, 0);
  });

  test('the week does not roll over until the seventh full day', () => {
    assert.equal(resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(0, 6)).weekInSeason, 0);
    assert.equal(resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(0, 7)).weekInSeason, 1);
  });

  test('mid-week sits in the same week as its Monday', () => {
    const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(2, 3));
    assert.equal(p.weekInSeason, 2);
    assert.equal(p.phase, 'base');
    assert.equal(p.phasePosition, 'mid');
  });

  test('a start date in the future clamps to week 0 rather than going negative', () => {
    const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, new Date(START.getTime() - 30 * DAY));
    assert.equal(p.weekInSeason, 0);
    assert.equal(p.phase, 'base');
    assert.equal(p.phasePosition, 'early');
  });

  test('a one-week base phase reports "only", not "early"', () => {
    const cfg = { base: 1, build: 1, peak: 1, recovery: 1 };
    const p = resolvePosition(START, cfg, after(0));
    assert.equal(p.phase, 'base');
    assert.equal(p.phasePosition, 'only');
    assert.equal(p.emphasisPillar, 'foundations');
  });

  test('the longest block still resolves its final recovery week', () => {
    const cfg = { base: 8, build: 4, peak: 4, recovery: 1 };
    const p = resolvePosition(START, cfg, after(16));
    assert.equal(p.phase, 'recovery');
    assert.equal(p.phasePosition, 'only');
    assert.equal(p.blockNumber, 1);
    assert.equal(resolvePosition(START, cfg, after(17)).blockNumber, 2);
  });

  test('an omitted config uses the default rather than throwing', () => {
    assert.equal(resolvePosition(START, undefined, after(4)).phase, 'build');
  });

  test('a recovery longer than one week is ignored, keeping the block honest', () => {
    const p = resolvePosition(START, { base: 4, build: 3, peak: 2, recovery: 5 }, after(10));
    assert.equal(p.blockNumber, 2, 'the block is still 10 weeks, so week 10 starts block 2');
    assert.equal(p.phase, 'base');
  });
});

describe('resolvePosition — invariant across every valid config', () => {
  test('always returns a real pillar, for every week of every allowed block', () => {
    for (let base = 1; base <= 8; base++) {
      for (let build = 1; build <= 4; build++) {
        for (let peak = 1; peak <= 4; peak++) {
          const cfg = { base, build, peak, recovery: 1 };
          const len = base + build + peak + 1;
          for (let wk = 0; wk < len; wk++) {
            const p = resolvePosition(START, cfg, after(wk));
            assert.ok(
              ALL_PILLARS.includes(p.emphasisPillar),
              `config ${JSON.stringify(cfg)} week ${wk} gave pillar ${p.emphasisPillar}`
            );
            assert.ok(
              PILLAR_EMPHASIS[p.phase][p.phasePosition],
              `no emphasis for ${p.phase}/${p.phasePosition}`
            );
            assert.ok(p.weekInPhase >= 1 && p.weekInPhase <= p.phaseLength,
              `weekInPhase ${p.weekInPhase} outside 1..${p.phaseLength}`);
          }
        }
      }
    }
  });

  test('weekInBlock cycles rather than growing without bound', () => {
    for (let wk = 0; wk < 35; wk++) {
      const p = resolvePosition(START, DEFAULT_BLOCK_CONFIG, after(wk));
      assert.equal(p.weekInBlock, wk % 10);
      assert.equal(p.blockNumber, Math.floor(wk / 10) + 1);
    }
  });
});

// ─── Race proximity ───────────────────────────────────────────────────────────

describe('resolveProximityZone', () => {
  const TODAY = new Date('2026-06-01T09:00:00.000Z');
  const raceIn = days => new Date(TODAY.getTime() + days * DAY);
  const zone = days => resolveProximityZone(raceIn(days), TODAY);

  test('more than three weeks out shows no overlay', () => {
    assert.equal(zone(22), null);
    assert.equal(zone(60), null);
  });

  test('15 to 21 days out is awareness', () => {
    assert.equal(zone(21), 'awareness');
    assert.equal(zone(18), 'awareness');
    assert.equal(zone(15), 'awareness');
  });

  test('8 to 14 days out is taper', () => {
    assert.equal(zone(14), 'taper');
    assert.equal(zone(8), 'taper');
  });

  test('1 to 7 days out is race week', () => {
    assert.equal(zone(7), 'raceweek');
    assert.equal(zone(1), 'raceweek');
  });

  test('the boundaries land on the documented side', () => {
    assert.equal(zone(22), null, '22 is outside');
    assert.equal(zone(21), 'awareness', '21 is inside');
    assert.equal(zone(15), 'awareness');
    assert.equal(zone(14), 'taper');
    assert.equal(zone(8), 'taper');
    assert.equal(zone(7), 'raceweek');
  });

  test('the race date itself is race day', () => {
    assert.equal(resolveProximityZone(TODAY, TODAY), 'raceday');
  });

  test('up to a week afterwards is post, then nothing', () => {
    assert.equal(zone(-1), 'post');
    assert.equal(zone(-7), 'post');
    assert.equal(zone(-8), null);
  });

  /* DOCUMENTS CURRENT BEHAVIOUR — asymmetric race-day window.
     daysToRace rounds UP (Math.ceil), so any moment before the race on race day
     is already "1 day out" and shows race-week content, while the same morning
     AFTER the start time correctly shows race day.

     In practice: an athlete checking the app at 6am for a 7am start sees race
     week, not race morning — which is the one moment the raceday content exists
     for. Making it symmetric means comparing calendar dates rather than
     millisecond gaps. Flagged, not fixed: it is a product call, not a crash. */
  test('DOCUMENTS CURRENT BEHAVIOUR: race morning before the start reads as race week', () => {
    const raceAt7am = new Date('2026-06-01T07:00:00.000Z');
    const at6am = new Date('2026-06-01T06:00:00.000Z');
    const at8am = new Date('2026-06-01T08:00:00.000Z');

    assert.equal(resolveProximityZone(raceAt7am, at6am), 'raceweek',
      'one hour BEFORE the gun — currently reads as race week');
    assert.equal(resolveProximityZone(raceAt7am, at8am), 'raceday',
      'one hour AFTER the gun — reads as race day');
  });
});

describe('daysToRace', () => {
  const TODAY = new Date('2026-06-01T09:00:00.000Z');

  test('counts forward as a positive number', () => {
    assert.equal(daysToRace(new Date(TODAY.getTime() + 10 * DAY), TODAY), 10);
  });

  test('counts back as a negative number', () => {
    assert.equal(daysToRace(new Date(TODAY.getTime() - 3 * DAY), TODAY), -3);
  });

  test('the race date itself is zero', () => {
    assert.equal(daysToRace(TODAY, TODAY), 0);
  });

  test('rounds up, so part of a day counts as a whole day', () => {
    assert.equal(daysToRace(new Date(TODAY.getTime() + 0.1 * DAY), TODAY), 1);
  });
});

describe('resolveProximityTip', () => {
  const CONTENT = {
    awareness: { tue: { title: 'Awareness Tue' } },
    raceweek: { 3: { title: 'Three to go' } },
    raceday: { morning: { title: 'Race morning' } },
    post: { 1: { title: 'Day after' } },
  };

  test('looks a tip up by zone and key', () => {
    assert.deepEqual(resolveProximityTip(CONTENT, 'awareness', 'tue'), { title: 'Awareness Tue' });
    assert.deepEqual(resolveProximityTip(CONTENT, 'raceday', 'morning'), { title: 'Race morning' });
  });

  test('race week and post are keyed by number', () => {
    assert.deepEqual(resolveProximityTip(CONTENT, 'raceweek', 3), { title: 'Three to go' });
    assert.deepEqual(resolveProximityTip(CONTENT, 'post', 1), { title: 'Day after' });
  });

  test('a missing zone, key or content object returns null rather than throwing', () => {
    assert.equal(resolveProximityTip(CONTENT, 'taper', 'tue'), null);
    assert.equal(resolveProximityTip(CONTENT, 'raceweek', 99), null);
    assert.equal(resolveProximityTip(null, 'raceday', 'morning'), null);
    assert.equal(resolveProximityTip(undefined, 'raceday', 'morning'), null);
  });
});

// ─── Content lookup ───────────────────────────────────────────────────────────

describe('resolveTip / resolveAllPillarsForDay', () => {
  const CONTENT = {
    base: {
      early: {
        foundations: { tue: { title: 'Foundations Tue' }, thu: { title: 'Foundations Thu' } },
        durability: { tue: { title: 'Durability Tue' } },
      },
    },
  };

  test('finds a tip four levels down', () => {
    assert.deepEqual(resolveTip(CONTENT, 'base', 'early', 'foundations', 'tue'),
      { title: 'Foundations Tue' });
  });

  test('any missing level returns null instead of throwing', () => {
    assert.equal(resolveTip(CONTENT, 'peak', 'early', 'foundations', 'tue'), null, 'no phase');
    assert.equal(resolveTip(CONTENT, 'base', 'late', 'foundations', 'tue'), null, 'no position');
    assert.equal(resolveTip(CONTENT, 'base', 'early', 'racecraft', 'tue'), null, 'no pillar');
    assert.equal(resolveTip(CONTENT, 'base', 'early', 'foundations', 'sun'), null, 'no day');
    assert.equal(resolveTip(null, 'base', 'early', 'foundations', 'tue'), null, 'no content at all');
  });

  test('collects only the pillars that have content for that day', () => {
    const out = resolveAllPillarsForDay(CONTENT, 'base', 'early', 'tue');
    assert.deepEqual(out.map(x => x.pillar), ['foundations', 'durability']);
    assert.deepEqual(out[0].tip, { title: 'Foundations Tue' });
  });

  test('keeps the canonical pillar order, not the order in the content object', () => {
    const out = resolveAllPillarsForDay(CONTENT, 'base', 'early', 'tue');
    const positions = out.map(x => ALL_PILLARS.indexOf(x.pillar));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  });

  test('a day with nothing for it returns an empty list, not nulls', () => {
    assert.deepEqual(resolveAllPillarsForDay(CONTENT, 'base', 'early', 'sun'), []);
    assert.deepEqual(resolveAllPillarsForDay({}, 'base', 'early', 'tue'), []);
  });
});

// ─── Freemium gate ────────────────────────────────────────────────────────────

describe('canAccessPhase', () => {
  test('a paid athlete sees every phase', () => {
    for (const phase of ['base', 'build', 'peak', 'recovery']) {
      assert.equal(canAccessPhase(phase, 'paid'), true, phase);
    }
  });

  test('a free athlete sees base and nothing else', () => {
    assert.equal(canAccessPhase('base', 'free'), true);
    assert.equal(canAccessPhase('build', 'free'), false);
    assert.equal(canAccessPhase('peak', 'free'), false);
    assert.equal(canAccessPhase('recovery', 'free'), false);
  });

  /* DOCUMENTS CURRENT BEHAVIOUR — the gate fails CLOSED for paid content but
     OPEN for base. An unknown, missing or misspelt tier is treated as free, so a
     lookup failure never gives away build/peak/recovery. Worth knowing: the only
     way to unlock is the exact string 'paid'. */
  test('DOCUMENTS CURRENT BEHAVIOUR: an unknown tier is treated as free', () => {
    assert.equal(canAccessPhase('build', undefined), false);
    assert.equal(canAccessPhase('build', null), false);
    assert.equal(canAccessPhase('build', 'Paid'), false, 'the check is case-sensitive');
    assert.equal(canAccessPhase('build', 'premium'), false);
    assert.equal(canAccessPhase('base', undefined), true, 'base stays open to everyone');
  });
});
