/**
 * TRI Momentum training-log write endpoint + Strava sync.
 *
 * Deploy this bound to the Sheet at:
 *   https://docs.google.com/spreadsheets/d/15I6fMqoJjlakSrmbqgPkgz44eZ955LOUUrlvUh3IRy0/edit
 *
 * Setup (one-time, ~2 minutes):
 *   1. Open that Sheet.
 *   2. Extensions -> Apps Script.
 *   3. Delete anything in the editor, paste this whole file in, save (Ctrl/Cmd+S).
 *   4. Deploy -> New deployment -> gear icon next to "Select type" -> Web app.
 *   5. Description: anything. Execute as: Me. Who has access: Anyone.
 *   6. Deploy. Authorize when prompted (it's your own script touching your
 *      own sheet — the scary "Google hasn't verified this app" screen is
 *      expected for a personal script; Advanced -> Go to <project> (unsafe)).
 *   7. Copy the Web app URL it gives you (ends in /exec).
 *   8. Paste that URL into TRAINING_LOG_WRITE_URL near the top of
 *      Tri-momentum-log-v9.html's script.
 *
 * Verify it's live: open the /exec URL directly in a browser tab — it
 * should show "TRI Momentum training log endpoint is live." (see doGet
 * below). That confirms the deployment before the app ever tries to write
 * to it.
 *
 * What it does:
 *   - doPost(e): appends one row per logged session. Creates the header
 *     row automatically on the very first write if the sheet is still
 *     empty, using the exact column order/names the app's read path
 *     (parseTrainingLogRows in Tri-momentum-log-v9.html) expects. A body
 *     with `kind: 'race'` is routed to the race calendar instead (see
 *     "Race calendar" below) — everything else is treated as a session.
 *   - doGet(e): a plain health-check page, so you (and the app, in a
 *     pinch) can confirm the endpoint is reachable without POSTing
 *     anything. Also handles the Strava OAuth redirect (see below), and
 *     `?races=1` to list the race calendar.
 *
 * ---------------------------------------------------------------------
 * Race calendar: a second sheet tab named "Races" (created automatically
 * on first use), independent of the session-log sheet. The app's Race
 * calendar tab reads it via `?races=1` and writes to it via POST bodies
 * shaped `{ kind: 'race', action: 'add'|'delete', race: {...} }`. The
 * race `id` is generated client-side (index.html) rather than by the
 * script, so a fire-and-forget no-cors write (same pattern as session
 * logging) can still be deleted later without needing to read a response
 * body back. See handleRacePost_ / listRaces_ below.
 * ---------------------------------------------------------------------
 *
 * Redeploying after edits: Deploy -> Manage deployments -> pencil icon ->
 * "New version" -> Deploy. Editing the code alone does NOT update the live
 * /exec URL's behaviour until you redeploy a new version. Redeploying a new
 * *version* of an existing deployment keeps the same /exec URL — only
 * creating a brand new deployment would change it, which matters because
 * the Strava redirect URI below is pinned to this URL.
 *
 * ---------------------------------------------------------------------
 * Strava sync setup (one-time, ~5 minutes, after the steps above):
 *
 *   1. Register an app at https://www.strava.com/settings/api (you'll need
 *      a Strava account, done in your own browser — not something this
 *      script can do for you). Set "Authorization Callback Domain" to
 *      exactly: script.google.com
 *      Note the Client ID and Client Secret it gives you.
 *
 *   2. Back in this Apps Script project: Project Settings (gear icon) ->
 *      Script Properties -> add two properties:
 *        STRAVA_CLIENT_ID      = <your client id>
 *        STRAVA_CLIENT_SECRET  = <your client secret>
 *      (Set these directly in the Apps Script UI, not by pasting them into
 *      code anywhere — they never need to leave this settings screen.)
 *
 *   3. In the editor's function dropdown (top toolbar), select
 *      `authorizeStrava`, click Run. Open View -> Logs (or Ctrl/Cmd+Enter)
 *      and copy the URL it printed. Open that URL in a browser, log into
 *      Strava if needed, and click Authorize. You should land on a page
 *      that says "Strava connected." That's the one-time authorization —
 *      the refresh token it captures keeps working indefinitely unless you
 *      revoke access from Strava's side.
 *
 *   4. Select `createStravaSyncTrigger` in the function dropdown, click
 *      Run once. This installs a time-driven trigger that calls
 *      `syncStravaActivities` every 2 hours from then on — no further
 *      action needed. (Equivalent to setting up the same trigger by hand
 *      from the clock icon in the left sidebar, if you'd rather do it that
 *      way and pick a different interval.)
 *
 *   5. Redeploy (Deploy -> Manage deployments -> pencil -> New version) so
 *      the live /exec URL picks up the Strava-aware doGet.
 *
 * What the sync does: every run, it fetches Strava activities since the
 * last successful sync, and for each one looks for a same-day row in the
 * sheet whose Disc column matches the activity's mapped discipline (brick
 * rows match a same-day Ride + Run pair) and whose StravaId column is
 * still blank. When it finds one it fills in the objective columns
 * (ActualMin, ActualKm, AvgHR, AvgPaceOrPower, ElevM, SufferScore,
 * StravaId) on that row and leaves everything else — including the
 * subjective columns the check-in flow already wrote — untouched. Rows
 * with no matching activity (indoor/manual sessions, or anything not yet
 * synced from Strava) are simply left blank; nothing blocks on a miss.
 *
 * Why this doesn't use the Apps Script `OAuth2` library the original plan
 * named: Strava's token endpoint returns an absolute `expires_at` Unix
 * timestamp instead of the relative `expires_in` the library expects,
 * which is a known rough edge for that combination. Talking to Strava's
 * token endpoint directly (see the "Strava OAuth" section below) is ~40
 * lines, avoids installing a library dependency, and is easier to verify
 * by reading it top to bottom for a single-user personal script like this
 * one.
 *
 * Migration note: when the real product build reaches Garmin/Strava
 * integration (Session 7 in CLAUDE.md), this whole Strava section gets
 * replaced by the Hono backend + a per-user Supabase token table with RLS,
 * using webhook subscriptions instead of polling. This Apps Script version
 * is disposable — same relationship the Sheet mirror already has to the
 * eventual Supabase migration.
 * ---------------------------------------------------------------------
 */

var SHEET_HEADERS = [
  'Week No', 'When', 'Disc', 'Duration', 'Intensity', 'RPE',
  'VsIntent', 'VsPlan', 'Fuelling', 'Feeling', 'Niggle', 'Note', 'Phase',
  'StravaId', 'ActualMin', 'ActualKm', 'AvgHR', 'AvgPaceOrPower', 'ElevM', 'SufferScore'
];

// Same ISO-8601 week-number algorithm as isoWeekNumber() in index.html
// (Thursday-anchored: week 1 is whichever week contains the year's first
// Thursday), so "Week No" here always matches the "Week NN" label the app
// shows for the same date. Takes the plain "yyyy-MM-dd" string doPost
// receives and works entirely in UTC calendar-date arithmetic, so there's
// no dependency on the script's or spreadsheet's timezone setting.
function isoWeekNumber_(iso) {
  var parts = String(iso).split('-');
  var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, day = parseInt(parts[2], 10);
  var date = new Date(Date.UTC(y, m, day));
  var dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  var firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  var diff = date - firstThursday;
  return 1 + Math.round(diff / (7 * 86400000));
}

function doGet(e) {
  if (e && e.parameter && e.parameter.stravaCallback === '1') {
    return handleStravaCallback_(e);
  }
  if (e && e.parameter && e.parameter.list === '1') {
    return listSessions_();
  }
  if (e && e.parameter && e.parameter.races === '1') {
    return listRaces_();
  }
  return ContentService
    .createTextOutput('TRI Momentum training log endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Read path — the Sheet is the cross-device source of truth the app loads
// from on every visit (see index.html's loadLogFromSheet). Returns every
// logged session as JSON, in the same field names doPost accepts, so a
// round trip through the Sheet is lossless. Column order here must match
// SHEET_HEADERS positionally (A-M; Week No (A) is derived, not part of the
// entry shape the app uses, so it's read but not included in the output —
// the Strava columns N-T aren't read back either since nothing in the app
// currently displays them).
function listSessions_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();
  var sessions = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      if (!r[1]) { continue; }
      sessions.push({
        when: formatWhen_(r[1]),
        disc: r[2] || '',
        duration: r[3] === '' ? null : r[3],
        intensity: r[4] || '',
        rpe: r[5] === '' ? null : r[5],
        a1: r[6] || '', a2: r[7] || '', a3: r[8] || '',
        b2: r[9] || '', b3: r[10] || '',
        note: r[11] || '', phase: r[12] || ''
      });
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sessions: sessions }))
    .setMimeType(ContentService.MimeType.JSON);
}

// The When column holds whatever doPost was sent — usually an ISO date
// string, but Sheets sometimes autoconverts a plain "yyyy-MM-dd" string
// into a real Date cell depending on locale/format, so handle both.
function formatWhen_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function doPost(e) {
  var result = { ok: false };
  try {
    var body = JSON.parse(e.postData.contents);
    result = body.kind === 'race' ? handleRacePost_(body) : handleSessionPost_(body);
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSessionPost_(body) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  ensureHeaders_(sheet);

  // Order must match SHEET_HEADERS exactly — this is the one place that
  // encodes the column layout the read side (parseTrainingLogRows) relies
  // on by header name, not position, so a re-order here is harmless to
  // the reader as long as the header row and the values stay in the same
  // order as each other. The trailing blanks are the Strava columns —
  // syncStravaActivities fills those in later, on a separate write.
  var row = [
    body.when ? isoWeekNumber_(body.when) : '',
    body.when || '',
    body.disc || '',
    body.duration != null ? body.duration : '',
    body.intensity || '',
    body.rpe != null ? body.rpe : '',
    body.a1 || '',
    body.a2 || '',
    body.a3 || '',
    body.b2 || '',
    body.b3 || '',
    body.note || '',
    body.phase || '',
    '', '', '', '', '', '', ''
  ];

  sheet.appendRow(row);
  return { ok: true, row: sheet.getLastRow() };
}

/* ============================= Race calendar ============================= */

var RACE_SHEET_NAME = 'Races';
// Status is 'considering' | 'locked' — the commitment level set on the Add
// a race form, shown as a pill on each race card. Appended after the
// original columns (not inserted after Date) so a sheet created before
// this field existed backfills cleanly via the trailing-column check below,
// same pattern as ensureHeaders_ does for the session sheet's Strava columns.
var RACE_HEADERS = ['ID', 'Name', 'Date', 'Url', 'Notes', 'CreatedAt', 'Status'];

function getRacesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RACE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RACE_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RACE_HEADERS);
  } else {
    var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existing.length < RACE_HEADERS.length) {
      var addedCols = RACE_HEADERS.length - existing.length;
      sheet.getRange(1, existing.length + 1, 1, addedCols)
        .setValues([RACE_HEADERS.slice(existing.length)]);
      // Backfill existing race rows with an explicit 'considering' in any
      // newly-added column rather than leaving them blank — this sheet is
      // meant to be hand-edited (see Status below), so a visible default
      // beats an empty cell the athlete has to guess the valid values for.
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var statusColIndex = RACE_HEADERS.indexOf('Status') + 1;
        if (statusColIndex > existing.length && statusColIndex <= RACE_HEADERS.length) {
          var statusRange = sheet.getRange(2, statusColIndex, lastRow - 1, 1);
          var current = statusRange.getValues();
          var filled = current.map(function (row) { return [row[0] || 'considering']; });
          statusRange.setValues(filled);
        }
      }
    }
  }
  return sheet;
}

// Read path for the Race calendar tab — mirrors listSessions_ in shape
// (an { ok, races } JSON envelope) so the app's fetch/parse handling can
// follow the same pattern as the session log.
function listRaces_() {
  var sheet = getRacesSheet_();
  var lastRow = sheet.getLastRow();
  var races = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, RACE_HEADERS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      if (!r[0]) { continue; }
      races.push({
        id: String(r[0]),
        name: r[1] || '',
        date: formatWhen_(r[2]),
        url: r[3] || '',
        notes: r[4] || '',
        status: normalizeRaceStatus_(r[6])
      });
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, races: races }))
    .setMimeType(ContentService.MimeType.JSON);
}

// The Status column is meant to be hand-edited directly in the sheet (see
// RACE_HEADERS comment above), so this normalizes whatever a human actually
// types there — "Locked in", "locked", "LOCKED", etc. — down to the two
// exact enum values ('considering' | 'locked') the app's status===checks
// rely on, rather than requiring the athlete to type the raw enum string.
function normalizeRaceStatus_(raw) {
  var s = String(raw || '').trim().toLowerCase();
  return s.indexOf('lock') === 0 ? 'locked' : 'considering';
}

// action: 'add' | 'delete'. The race id is generated client-side (see
// index.html) so a delete can target a row without ever having read an
// id back from a (opaque, no-cors) add response.
function handleRacePost_(body) {
  var sheet = getRacesSheet_();
  var action = body.action;
  var race = body.race || {};

  if (action === 'add') {
    if (!race.id || !race.name || !race.date) {
      return { ok: false, error: 'race add requires id, name, date' };
    }
    sheet.appendRow([race.id, race.name, race.date, race.url || '', race.notes || '', new Date(), race.status || 'considering']);
    return { ok: true };
  }

  if (action === 'delete') {
    var row = findRaceRow_(sheet, race.id);
    if (row) { sheet.deleteRow(row); }
    return { ok: true };
  }

  return { ok: false, error: 'unknown race action: ' + action };
}

function findRaceRow_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { return null; }
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { return i + 2; }
  }
  return null;
}

// Creates the header row on a blank sheet, or appends any headers a sheet
// created before the Strava columns existed is missing — without touching
// existing rows or reordering columns already in use.
function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (existing.length < SHEET_HEADERS.length) {
    sheet.getRange(1, existing.length + 1, 1, SHEET_HEADERS.length - existing.length)
      .setValues([SHEET_HEADERS.slice(existing.length)]);
  }
}

/* ============================= Strava OAuth ============================= */

var STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
var STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
var STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';

function stravaRedirectUri_() {
  return ScriptApp.getService().getUrl() + '?stravaCallback=1';
}

// Run this once from the editor (function dropdown -> authorizeStrava ->
// Run), then open the URL it logs and approve access. See the setup notes
// at the top of this file.
function authorizeStrava() {
  var clientId = PropertiesService.getScriptProperties().getProperty('STRAVA_CLIENT_ID');
  if (!clientId) {
    Logger.log('Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Project Settings > Script Properties first.');
    return;
  }
  var url = STRAVA_AUTH_URL
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(stravaRedirectUri_())
    + '&response_type=code'
    + '&approval_prompt=force'
    + '&scope=activity:read_all';
  Logger.log('Open this URL and approve access:\n' + url);
}

function handleStravaCallback_(e) {
  if (e.parameter.error) {
    return HtmlService.createHtmlOutput('Strava authorization denied: ' + e.parameter.error);
  }
  var code = e.parameter.code;
  if (!code) {
    return HtmlService.createHtmlOutput('Missing authorization code.');
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var resp = UrlFetchApp.fetch(STRAVA_TOKEN_URL, {
      method: 'post',
      payload: {
        client_id: props.getProperty('STRAVA_CLIENT_ID'),
        client_secret: props.getProperty('STRAVA_CLIENT_SECRET'),
        code: code,
        grant_type: 'authorization_code'
      },
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (!data.access_token) {
      return HtmlService.createHtmlOutput('Token exchange failed: ' + resp.getContentText());
    }
    storeStravaTokens_(data);
    return HtmlService.createHtmlOutput('Strava connected. You can close this tab.');
  } catch (err) {
    return HtmlService.createHtmlOutput('Error: ' + String(err));
  }
}

function storeStravaTokens_(data) {
  PropertiesService.getScriptProperties().setProperties({
    STRAVA_ACCESS_TOKEN: data.access_token,
    STRAVA_REFRESH_TOKEN: data.refresh_token,
    STRAVA_EXPIRES_AT: String(data.expires_at) // absolute unix seconds
  });
}

// Returns a currently-valid access token, transparently refreshing (Strava
// access tokens last ~6hr; the refresh token itself doesn't expire unless
// revoked) if the stored one is expired or close to it.
function getStravaAccessToken_() {
  var props = PropertiesService.getScriptProperties();
  var expiresAt = Number(props.getProperty('STRAVA_EXPIRES_AT') || 0);
  var now = Math.floor(Date.now() / 1000);
  if (expiresAt - now > 300) {
    return props.getProperty('STRAVA_ACCESS_TOKEN');
  }

  var refreshToken = props.getProperty('STRAVA_REFRESH_TOKEN');
  if (!refreshToken) {
    throw new Error('No Strava refresh token — run authorizeStrava() and approve access first.');
  }
  var resp = UrlFetchApp.fetch(STRAVA_TOKEN_URL, {
    method: 'post',
    payload: {
      client_id: props.getProperty('STRAVA_CLIENT_ID'),
      client_secret: props.getProperty('STRAVA_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    },
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  if (!data.access_token) {
    throw new Error('Strava token refresh failed: ' + resp.getContentText());
  }
  storeStravaTokens_(data);
  return data.access_token;
}

/* ============================ Strava sync ============================ */

var STRAVA_TYPE_TO_DISC = {
  Swim: 'swim',
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Ride: 'bike', VirtualRide: 'bike', GravelRide: 'bike', MountainBikeRide: 'bike', EBikeRide: 'bike',
  WeightTraining: 'strength', Workout: 'strength', Crossfit: 'strength'
};

// Installs (or reinstalls) the recurring sync trigger. Run once from the
// editor; safe to re-run — it clears any previous trigger for this handler
// first so it never ends up duplicated.
function createStravaSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncStravaActivities') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncStravaActivities').timeBased().everyHours(2).create();
  Logger.log('Strava sync trigger installed — runs every 2 hours.');
}

function syncStravaActivities() {
  var props = PropertiesService.getScriptProperties();
  var lastSync = Number(props.getProperty('STRAVA_LAST_SYNC') || 0);
  if (!lastSync) {
    lastSync = Math.floor(Date.now() / 1000) - 30 * 24 * 3600; // first run: look back 30 days
  }

  var activities = fetchStravaActivities_(lastSync);
  if (!activities.length) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  ensureHeaders_(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // header only, nothing to match against yet

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var numCols = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  // Group same-day activities so a brick (bike immediately followed by
  // run) can still land in its single sheet row instead of needing two.
  var byDate = {};
  var maxEpoch = lastSync;
  activities.forEach(function (a) {
    var epoch = Math.floor(new Date(a.start_date).getTime() / 1000);
    if (epoch > maxEpoch) maxEpoch = epoch;
    if (!STRAVA_TYPE_TO_DISC[a.type]) return; // no mapping (hike, walk, etc.) — nothing to attach it to
    // start_date_local carries Strava's known quirk of a UTC "Z" suffix on
    // an already-local time — slicing the date portion directly is correct.
    var dateISO = a.start_date_local.slice(0, 10);
    byDate[dateISO] = byDate[dateISO] || [];
    byDate[dateISO].push(a);
  });

  Object.keys(byDate).forEach(function (dateISO) {
    var dayActivities = byDate[dateISO];

    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      if (normalizeDateISO_(row[col['When']]) !== dateISO) continue;
      if (row[col['StravaId']]) continue; // already matched, don't overwrite

      var rowDisc = row[col['Disc']];
      var match = null;

      if (rowDisc === 'brick') {
        var ride = dayActivities.filter(function (a) { return STRAVA_TYPE_TO_DISC[a.type] === 'bike'; })[0];
        var run = dayActivities.filter(function (a) { return STRAVA_TYPE_TO_DISC[a.type] === 'run'; })[0];
        if (ride && run) match = combineBrickActivities_(ride, run);
      } else {
        match = dayActivities.filter(function (a) { return STRAVA_TYPE_TO_DISC[a.type] === rowDisc; })[0];
      }

      if (!match) continue;
      writeMatchToRow_(sheet, r + 2, col, match);
    }
  });

  props.setProperty('STRAVA_LAST_SYNC', String(maxEpoch + 1));
}

function normalizeDateISO_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function fetchStravaActivities_(afterEpochSeconds) {
  var token = getStravaAccessToken_();
  var activities = [];
  var page = 1;
  while (page <= 10) { // 100/page, 1000 activities of headroom per sync — plenty for a 2-hourly poll
    var url = STRAVA_ACTIVITIES_URL + '?after=' + afterEpochSeconds + '&per_page=100&page=' + page;
    var batch = JSON.parse(fetchWithBackoff_(url, token).getContentText());
    if (!batch.length) break;
    activities = activities.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return activities;
}

function fetchWithBackoff_(url, token) {
  var attempt = 0;
  while (true) {
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 429 && attempt < 3) {
      Utilities.sleep((attempt + 1) * 15000);
      attempt++;
      continue;
    }
    if (resp.getResponseCode() >= 400) {
      throw new Error('Strava API error ' + resp.getResponseCode() + ': ' + resp.getContentText());
    }
    return resp;
  }
}

function combineBrickActivities_(ride, run) {
  return {
    id: ride.id + '+' + run.id,
    moving_time: (ride.moving_time || 0) + (run.moving_time || 0),
    distance: (ride.distance || 0) + (run.distance || 0),
    average_heartrate: run.average_heartrate || ride.average_heartrate,
    total_elevation_gain: (ride.total_elevation_gain || 0) + (run.total_elevation_gain || 0),
    suffer_score: (ride.suffer_score || 0) + (run.suffer_score || 0),
    _paceOrPower: formatPaceOrPower_(run)
  };
}

function formatPaceOrPower_(a) {
  if (a.average_watts) return Math.round(a.average_watts) + 'W';
  if (a.type === 'Run' || a.type === 'TrailRun' || a.type === 'VirtualRun') {
    if (!a.average_speed) return '';
    var secPerKm = 1000 / a.average_speed;
    var min = Math.floor(secPerKm / 60);
    var sec = Math.round(secPerKm % 60);
    return min + ':' + (sec < 10 ? '0' : '') + sec + '/km';
  }
  return '';
}

function writeMatchToRow_(sheet, sheetRow, col, activity) {
  var updates = {
    StravaId: String(activity.id),
    ActualMin: activity.moving_time ? Math.round(activity.moving_time / 60) : '',
    ActualKm: activity.distance ? Math.round(activity.distance / 100) / 10 : '',
    AvgHR: activity.average_heartrate ? Math.round(activity.average_heartrate) : '',
    AvgPaceOrPower: activity._paceOrPower != null ? activity._paceOrPower : formatPaceOrPower_(activity),
    ElevM: activity.total_elevation_gain ? Math.round(activity.total_elevation_gain) : '',
    SufferScore: activity.suffer_score || ''
  };
  Object.keys(updates).forEach(function (key) {
    if (col[key] == null) return;
    sheet.getRange(sheetRow, col[key] + 1).setValue(updates[key]);
  });
}
