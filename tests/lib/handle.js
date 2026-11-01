'use strict';
// A test-only handle onto the app's own functions, injected into the HTML the
// test server sends — never into the file on disk (decisions 32, 34 and 43 use
// the same technique). The functions are the real ones the UI handlers call;
// this exists to reach writes whose only UI entrances were removed on purpose
// (the phase-plan editor and "Plan back from a race", decision 46), and to
// read module state the DOM does not show.
const NAMES = [
  'addRace', 'deleteRace',
  'addPlanSession', 'updatePlanSession', 'deletePlanSession', 'copyPlanWeek', 'clearPlanWeek',
  'setPhaseFromToday', 'setPhaseForWeek', 'addPhaseBlock', 'updatePhaseBlock', 'deletePhaseBlock',
  'applyPhaseBuild', 'undoPhaseBuild',
  'refreshLogFromSheet', 'refreshRacesFromSheet', 'refreshPlanFromSheet', 'refreshPhasePlanFromSheet',
  'submitSessionToSheet', 'newSessionId', 'newPhaseBlockId', 'newPlanId', 'newRaceId',
];
function exposeHandle(html) {
  const end = html.lastIndexOf('})();');
  if (end < 0) throw new Error('could not find the end of the IIFE');
  const body = NAMES.map((n) => n + ': ' + n).join(', ');
  const state = 'get phasePlan(){return phasePlan;}, get plan(){return plan;}, get races(){return races;}, get log(){return log;}, get mode(){return syncMode;}, state: state';
  return html.slice(0, end) + 'window.__t = {' + body + ', ' + state + '};\n' + html.slice(end);
}
module.exports = { exposeHandle };
