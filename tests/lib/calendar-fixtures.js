'use strict';
// Fixtures F1, F2 and F3 from docs/specs/calendar-start-screen.md section 14,
// as the localStorage values the app reads on boot. Dates are fixed and every
// suite that uses them pins the browser clock (see `launch` in
// calendar-ui.test.js), so none of them depends on the day the suite runs.
//
// Logged duration is always one of the check-in's three buckets (30/60/120).

const KEYS = {
  log: 'triMomentumLog_v1',
  plan: 'triMomentumPlan_v1',
  races: 'triMomentumRaces_v1',
  phases: 'triMomentumPhasePlan_v1',
  settings: 'triMomentumSettings_v1',
  gcalEvents: 'triMomentumGcalEvents_v1',
};

function planItem(id, date, disc, title, duration, intensity, key) {
  return { id, date, disc, title, intensity, duration, key: !!key, notes: '', phase: 'build1' };
}
function logEntry(date, disc, duration, a2) {
  return {
    date, disc, intensity: 'easy', duration, a1: 'intent', a2, a3: null,
    rpe: 6, b2: 'solid', b3: 'nothing', note: '', phase: 'build1', loggedAt: null,
  };
}

// F1 — Tue 24 Nov 2026, 10:00 local. Planned total 425 min (7h05), logged 120 (2h00).
const F1 = {
  now: '2026-11-24T10:00:00+11:00',
  plan: [
    planItem('f1p1', '2026-11-23', 'swim', 'Squad', 60, 'moderate'),
    planItem('f1p2', '2026-11-23', 'strength', 'Gym A', 30, 'easy'),
    planItem('f1p3', '2026-11-24', 'run', 'Easy run', 45, 'easy'),
    planItem('f1p4', '2026-11-24', 'bike', 'Turbo', 60, 'hard'),
    planItem('f1p5', '2026-11-25', 'swim', 'Technique', 60, 'easy'),
    planItem('f1p6', '2026-11-27', 'run', 'Run intervals', 50, 'hard', true),
    planItem('f1p7', '2026-11-28', 'bike', 'Long ride', 120, 'easy'),
  ],
  log: [
    logEntry('2026-11-23', 'swim', 60, 'planned'),
    logEntry('2026-11-24', 'run', 30, 'short'),
    logEntry('2026-11-24', 'swim', 30, 'planned'),
  ],
  phases: [
    { id: 'f1h1', from: '2026-11-02', phase: 'build1' },
    { id: 'f1h2', from: '2026-11-30', phase: 'build2' },
  ],
  races: [
    { id: 'f1r1', name: 'Sample race', date: '2027-03-20', status: 'locked', url: '', notes: '' },
    { id: 'f1r2', name: 'Sample sprint', date: '2026-12-06', status: 'considering', url: '', notes: '' },
  ],
};

// F2 — empty state: no plan, no Google settings, one logged run on Mon 23.
const F2 = {
  now: '2026-11-24T10:00:00+11:00',
  plan: [],
  log: [logEntry('2026-11-23', 'run', 60, 'planned')],
  phases: F1.phases,
  races: [],
};

// F3 — Monday gap: Mon 30 Nov. Sun 22 run and Sun 29 run are open, Sat 28 bike is logged.
const F3 = {
  now: '2026-11-30T10:00:00+11:00',
  plan: [
    planItem('f3p1', '2026-11-22', 'run', 'Sunday run', 60, 'easy'),
    planItem('f3p2', '2026-11-28', 'bike', 'Long ride', 120, 'easy'),
    planItem('f3p3', '2026-11-29', 'run', 'Sunday run', 60, 'easy'),
  ],
  log: [logEntry('2026-11-28', 'bike', 120, 'planned')],
  phases: F1.phases,
  races: [],
};

module.exports = { KEYS, F1, F2, F3, planItem, logEntry };
