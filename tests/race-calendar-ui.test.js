'use strict';
// The Races tab's month calendar (CLAUDE.md decision 46), driven through the
// real UI. Replaces the old 52-column horizontal week strip with an actual
// month grid, and adds a per-week tap-to-edit-phase interaction.
//
// Runs against the shipped index.html over http, with only the Apps Script URL
// blanked so a live Sheet fetch can't overwrite the seeded scenario mid-test.
// No test hook lives in the shipped file.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { serveApp, chromiumPath } = require('./lib/app');

const RACES = [
  { id: 'r1', name: 'SwimRun North', date: '2026-10-10', status: 'locked', url: '', notes: '' },
  { id: 'r2', name: 'Bondi to Manly Ultra', date: '2026-10-24', status: 'locked', url: '', notes: '' },
];
const PLAN = [
  { id: 'p1', from: '2026-09-21', phase: 'base' },
  { id: 'p2', from: '2026-09-28', phase: 'build1' },
  { id: 'p3', from: '2026-10-05', phase: 'build2' },
  { id: 'p4', from: '2026-10-12', phase: 'peak' },
  { id: 'p5', from: '2026-10-19', phase: 'taper' },
  { id: 'p6', from: '2026-10-26', phase: 'base' },
];

describe('race calendar — month view', { concurrency: false }, () => {
  let server, browser, ctx, page, errors;

  before(async () => {
    server = await serveApp();
    browser = await chromium.launch({ executablePath: chromiumPath() });
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(
      ([races, plan]) => {
        localStorage.setItem('triMomentumRaces_v1', JSON.stringify(races));
        localStorage.setItem('triMomentumPhasePlan_v1', JSON.stringify(plan));
      },
      [RACES, PLAN]
    );
    await page.goto(server.origin);
    await page.waitForTimeout(400);
    await page.click('#tab-races');
    await page.waitForTimeout(300);
  });

  after(async () => {
    await browser.close();
    await server.close();
  });

  test('opens on the current real month, with a weekday header and today ringed', async () => {
    const monthLabel = await page.textContent('.race-cal .plan-week-num');
    assert.ok(/2026/.test(monthLabel), 'month label carries a year: ' + monthLabel);
    const wd = await page.$$eval('.race-cal-weekday', (ns) => ns.map((n) => n.textContent));
    assert.deepStrictEqual(wd, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    const todayCount = await page.$$eval('.race-cal-day.today', (ns) => ns.length);
    assert.strictEqual(todayCount, 1, 'exactly one .today cell in the current month');
  });

  test('the Races calendar no longer offers the phase-plan/phase-build links', async () => {
    // Removed on request — per-week editing directly on the calendar is now
    // the only way in; view-phaseplan and view-phasebuild still exist
    // (goToPhasePlan()/goToPhaseBuild()) but are deliberately unreachable
    // from the UI. See CLAUDE.md decision 46's follow-up note.
    const links = await page.$$eval('.race-cal .dash-signal-link', (ns) => ns.length);
    assert.strictEqual(links, 0);
  });

  test('paging forward shows real race days and every phase in the sample cycle', async () => {
    await page.click('.race-cal .plan-week-btn[aria-label="Show the next month"]');
    await page.waitForTimeout(150);
    const octLabel = await page.textContent('.race-cal .plan-week-num');
    assert.ok(octLabel.includes('Oct'), 'paged to October: ' + octLabel);

    const lockedDays = await page.$$eval('.race-cal-day.locked', (ns) => ns.length);
    assert.strictEqual(lockedDays, 2, 'both real races render as locked day markers');

    const phaseLabels = await page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
    ['Build 1', 'Build 2', 'Peak', 'Taper', 'Base'].forEach((label) => {
      assert.ok(
        phaseLabels.some((l) => l.startsWith(label)),
        label + ' week is labelled — got ' + JSON.stringify(phaseLabels)
      );
    });
  });

  test('paging back returns to September — month state is not lost by navigating', async () => {
    await page.click('.race-cal .plan-week-btn[aria-label="Show the previous month"]');
    await page.waitForTimeout(150);
    const label = await page.textContent('.race-cal .plan-week-num');
    assert.ok(label.includes('Sep'), 'paged back to September: ' + label);
  });

  test('tapping a week\'s phase label opens an inline select that writes phasePlan on change', async () => {
    await page.click('.race-cal .plan-week-btn[aria-label="Show the next month"]');
    await page.waitForTimeout(150);

    // Targets the button by its aria-label (real accessibility markup, not a
    // test hook) rather than by visible text — two weeks can read the same
    // phase label at once, which is exactly what the next test exercises.
    const peakBtn = await page.$('[aria-label="Edit the phase for the week of Mon 12 Oct"]');
    assert.ok(peakBtn, 'found the week of 12 Oct\'s edit control');
    await peakBtn.click();
    await page.waitForTimeout(100);

    const select = await page.$('.race-cal-phase-select');
    assert.ok(select, 'a <select> replaced the button');
    await select.selectOption('build2');
    await page.waitForTimeout(150);

    const afterEdit = await page.$$eval('.race-cal-phase-edit', (ns) => ns.map((n) => n.textContent.trim()));
    assert.ok(afterEdit.some((l) => l.startsWith('Build 2')), 'the edited week now reads Build 2');
    assert.ok(!afterEdit.some((l) => l.startsWith('Peak')), 'no week still reads Peak');
    // The select itself must be gone — editing closes back to the button,
    // it doesn't stay open after a change.
    assert.strictEqual(await page.$('.race-cal-phase-select'), null);

    const storedPlan = JSON.parse(
      await page.evaluate(() => localStorage.getItem('triMomentumPhasePlan_v1'))
    );
    const editedBlock = storedPlan.find((b) => b.from === '2026-10-12');
    assert.ok(editedBlock, 'a phasePlan block now starts on the edited week\'s own Monday, not "today"');
    assert.strictEqual(editedBlock.phase, 'build2');
  });

  test('editing a week that already has a block updates it in place, not a duplicate', async () => {
    // The previous test edited the week starting 2026-10-12 once already —
    // editing it again must overwrite that same row, mirroring the rule
    // setPhaseFromToday already applies to "today"'s own block. Targeted by
    // aria-label, not text: this week and the week of 5 Oct both now read
    // "Build 2", which is exactly the ambiguity this test guards against.
    const editBtn = await page.$('[aria-label="Edit the phase for the week of Mon 12 Oct"]');
    assert.ok(editBtn);
    await editBtn.click();
    await page.waitForTimeout(100);
    await page.selectOption('.race-cal-phase-select', 'peak');
    await page.waitForTimeout(150);

    const storedPlan = JSON.parse(
      await page.evaluate(() => localStorage.getItem('triMomentumPhasePlan_v1'))
    );
    const blocksAtThatMonday = storedPlan.filter((b) => b.from === '2026-10-12');
    assert.strictEqual(blocksAtThatMonday.length, 1, 'exactly one block for that Monday — no duplicate row');
    assert.strictEqual(blocksAtThatMonday[0].phase, 'peak');
  });

  test('no page errors were raised at any point', async () => {
    assert.deepStrictEqual(errors, []);
  });
});
