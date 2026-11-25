'use strict';
// Stage (b) of the Calendar start screen, server side: the `?calendar=1` read,
// the `Settings` tab and the Script Property allowlist
// (docs/specs/calendar-start-screen.md sections 7, 10, 11; criteria B1-B7).
//
// This is the first test to touch apps-script/Code.gs. It loads the real file
// in a Node `vm` with small in-memory stubs for the Apps Script globals, so the
// code under test is the code that gets pasted into the editor. No dependency.
//
// What the stubs are NOT: they do not prove Google behaves this way. The
// owner-side checks (all-day dates, time zones, Strava after the scope pin) stay
// manual — see the PR notes.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

// ── Time zone helpers (stand-ins for Utilities.formatDate / parseDate) ──────
function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}
function formatDate(date, tz, fmt) {
  const p = partsIn(date, tz);
  if (fmt === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (fmt === "yyyy-MM-dd'T'HH:mm") return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  throw new Error('stub: unsupported format ' + fmt);
}
function parseDate(str, tz, fmt) {
  assert.strictEqual(fmt, 'yyyy-MM-dd');
  const [y, m, d] = str.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const p = partsIn(new Date(guess), tz);
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess - (local - guess));
}

// ── In-memory spreadsheet ────────────────────────────────────────────────────
function makeSheetApp(log) {
  const sheets = {};
  function makeSheet(name) {
    const cells = {}; // 'r,c' -> {v, fmt}
    let lastRow = 0;
    const get = (r, c) => cells[r + ',' + c] || (cells[r + ',' + c] = { v: '', fmt: '' });
    const sheet = {
      name,
      getLastRow: () => lastRow,
      getLastColumn: () => 3,
      appendRow(row) {
        lastRow += 1;
        row.forEach((v, i) => { get(lastRow, i + 1).v = v; });
      },
      getRange(r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        return {
          getValues() {
            const out = [];
            for (let i = 0; i < nr; i++) {
              const row = [];
              for (let j = 0; j < nc; j++) row.push(get(r + i, c + j).v);
              out.push(row);
            }
            return out;
          },
          setNumberFormat(f) { get(r, c).fmt = f; log.push(['fmt', name, r, c, f]); return this; },
          setValue(v) {
            const cell = get(r, c);
            // Mimic Sheets: a plain-text-formatted cell keeps the literal string;
            // a General cell would evaluate a leading '=' as a formula.
            cell.v = cell.fmt === '@' ? String(v) : v;
            cell.evaluatedAsFormula = cell.fmt !== '@' && typeof v === 'string' && /^[=+\-@]/.test(v);
            if (r > lastRow) lastRow = r;
            log.push(['set', name, r, c, v]);
            return this;
          },
          setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { get(r + i, c + j).v = v; })); return this; },
        };
      },
      _cell: (r, c) => get(r, c),
    };
    return sheet;
  }
  return {
    sheets,
    app: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n)),
        getSheets: () => Object.values(sheets),
      }),
    },
  };
}

// ── Calendar stub ───────────────────────────────────────────────────────────
function makeCal(id, opts) {
  opts = opts || {};
  const cal = {
    calls: { getEvents: 0 },
    getId: () => id,
    getName: () => opts.name || 'Cal ' + id,
    getColor: () => opts.color || '#123456',
    isMyPrimaryCalendar: () => !!opts.primary,
    isOwnedByMe: () => opts.owned !== false,
    getTimeZone: () => opts.tz || 'Australia/Sydney',
    getEvents(from, to) {
      cal.calls.getEvents += 1;
      cal.lastRange = [from, to];
      if (opts.throwOnEvents) throw new Error(opts.throwOnEvents);
      return (opts.events || []).filter((e) => e.getStartTime() < to && e.getEndTime() > from);
    },
  };
  return cal;
}
function makeEvent(o) {
  return {
    getTitle: () => o.title,
    isAllDayEvent: () => !!o.allDay,
    getStartTime: () => o.start,
    getEndTime: () => o.end,
    getAllDayStartDate: () => o.start,
    getAllDayEndDate: () => o.end,
    getTag: (k) => (o.tags || {})[k] || null,
    // Fields that must never leave the script. If any reaches a response the
    // "event fields" test fails.
    getDescription: () => 'SECRET-DESC',
    getLocation: () => 'SECRET-LOC',
    getGuestList: () => [{ getEmail: () => 'secret@example.com' }],
    getId: () => 'SECRET-EVENT-ID',
  };
}

// Load Code.gs fresh with a given world.
function load(world) {
  world = world || {};
  const log = [];
  const sheet = makeSheetApp(log);
  const props = Object.assign({}, world.props || {});
  const cals = world.cals || [];
  const sandbox = {
    SpreadsheetApp: sheet.app,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    CalendarApp: {
      getCalendarById(id) {
        sandbox._asked.push(id);
        return cals.find((c) => c.getId() === id) || null;
      },
      getAllCalendars: () => cals,
    },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json', TEXT: 'text' },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }),
    },
    Session: { getScriptTimeZone: () => world.scriptTz || 'Australia/Sydney' },
    Utilities: { formatDate, parseDate },
    Logger: { log: (m) => sandbox._logged.push(String(m)) },
    _asked: [],
    _logged: [],
    JSON, Date, Math, Object, Array, String, Number, RegExp, Error, isNaN, parseInt, parseFloat,
  };
  vm.runInNewContext(CODE, sandbox, { filename: 'Code.gs' });
  const get = (params) => JSON.parse(sandbox.doGet({ parameter: params }).text);
  const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  return { sandbox, sheets: sheet.sheets, log, get, post, cals, props };
}

const ID_A = 'a@group.calendar.google.com';
const ID_B = 'b@group.calendar.google.com';
const ID_PRIVATE = 'private@example.com';
const sydney = (iso) => new Date(iso); // callers pass an ISO with offset

function worldWith(readIds, extra) {
  const lunch = makeEvent({ title: 'Team lunch', start: sydney('2026-11-25T12:30:00+11:00'), end: sydney('2026-11-25T13:30:00+11:00') });
  const world = Object.assign({
    props: { GCAL_ALLOWLIST: JSON.stringify([ID_A, ID_B]) },
    cals: [
      makeCal(ID_A, { name: 'Work', events: [lunch] }),
      makeCal(ID_B, { name: 'Family', owned: false }),
      makeCal(ID_PRIVATE, { name: 'Private', primary: true, events: [makeEvent({ title: 'Therapy', start: sydney('2026-11-25T09:00:00+11:00'), end: sydney('2026-11-25T10:00:00+11:00') })] }),
    ],
  }, extra || {});
  const w = load(world);
  if (readIds) w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: readIds });
  return w;
}

describe('calendar routing (B1)', () => {
  test('?calendar=1 returns the calendars shape', () => {
    const w = worldWith([ID_A]);
    const r = w.get({ calendar: '1' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.timeZone, 'Australia/Sydney');
    assert.strictEqual(r.configured, true);
    assert.deepStrictEqual(r.calendars.map((c) => c.id), [ID_A, ID_B]);
    const a = r.calendars[0];
    assert.deepStrictEqual(Object.keys(a).sort(), ['color', 'id', 'name', 'primary', 'read', 'writable', 'write']);
    assert.strictEqual(a.read, true);
    assert.strictEqual(r.calendars[1].read, false);
    assert.strictEqual(r.calendars[1].writable, false);
  });

  test('?calendar=1&list=1 does not return sessions', () => {
    const w = worldWith([ID_A]);
    const r = w.get({ calendar: '1', list: '1' });
    assert.ok(Array.isArray(r.calendars), 'calendar branch must win');
    assert.ok(!('sessions' in r) && !('entries' in r));
  });

  test('?settings=1 is not shadowed either', () => {
    const w = worldWith([ID_A]);
    const r = w.get({ settings: '1', list: '1' });
    assert.ok(r.settings && !Array.isArray(r.settings));
  });

  test('events shape: ?calendar=1&from&to', () => {
    const w = worldWith([ID_A]);
    const r = w.get({ calendar: '1', from: '2026-11-23', to: '2026-11-29' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.from, '2026-11-23');
    assert.strictEqual(r.to, '2026-11-29');
    assert.strictEqual(r.truncated, false);
    assert.strictEqual(r.events.length, 1);
    assert.strictEqual(r.events[0].title, 'Team lunch');
    assert.strictEqual(r.events[0].start, '2026-11-25T12:30');
    assert.strictEqual(r.events[0].end, '2026-11-25T13:30');
    assert.strictEqual(r.events[0].allDay, false);
  });
});

describe('the allowlist is the real gate (Q1, section 11)', () => {
  test('a calendar that is not on it is never opened, listed or read', () => {
    const w = worldWith([ID_A, ID_B, ID_PRIVATE]); // a stranger names the private one too
    const list = w.get({ calendar: '1' });
    assert.ok(!list.calendars.some((c) => c.id === ID_PRIVATE));
    const ev = w.get({ calendar: '1', from: '2026-11-23', to: '2026-11-29' });
    assert.ok(!ev.events.some((e) => e.title === 'Therapy'));
    assert.ok(!w.sandbox._asked.includes(ID_PRIVATE), 'the private calendar must never be looked up');
    const priv = w.cals.find((c) => c.getId() === ID_PRIVATE);
    assert.strictEqual(priv.calls.getEvents, 0);
  });

  test('an unset allowlist fails closed: nothing listed, nothing read', () => {
    const w = load({ cals: worldWith().cals, props: {} });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A, ID_PRIVATE] });
    const list = w.get({ calendar: '1' });
    assert.strictEqual(list.configured, false);
    assert.deepStrictEqual(list.calendars, []);
    const ev = w.get({ calendar: '1', from: '2026-11-23', to: '2026-11-29' });
    assert.deepStrictEqual(ev.events, []);
  });

  test('accepts a comma or newline separated allowlist, and skips an id that no longer exists', () => {
    const w = worldWith(null, { props: { GCAL_ALLOWLIST: ID_A + ',\n' + 'gone@example.com' } });
    const list = w.get({ calendar: '1' });
    assert.deepStrictEqual(list.calendars.map((c) => c.id), [ID_A]);
  });
});

describe('event fields (B2)', () => {
  test('only the listed fields leave the script; long titles are cut', () => {
    const long = 'x'.repeat(500);
    const w = worldWith(null, {
      cals: [makeCal(ID_A, { events: [makeEvent({ title: long, start: sydney('2026-11-25T09:00:00+11:00'), end: sydney('2026-11-25T10:00:00+11:00') })] })],
    });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    const text = w.sandbox.doGet({ parameter: { calendar: '1', from: '2026-11-25', to: '2026-11-25' } }).text;
    for (const secret of ['SECRET-DESC', 'SECRET-LOC', 'secret@example.com', 'SECRET-EVENT-ID']) {
      assert.ok(!text.includes(secret), secret + ' leaked');
    }
    const r = JSON.parse(text);
    assert.deepStrictEqual(Object.keys(r.events[0]).sort(), ['allDay', 'cal', 'end', 'start', 'title', 'tz']);
    assert.strictEqual(r.events[0].title.length, 200);
  });

  test('times are formatted in the calendar\'s own zone, not the script\'s', () => {
    const noon = makeEvent({ title: 'Noon', start: new Date('2026-11-25T12:00:00Z'), end: new Date('2026-11-25T13:00:00Z') });
    const w = worldWith(null, {
      scriptTz: 'Australia/Sydney',
      cals: [makeCal(ID_A, { tz: 'Europe/London', events: [noon] })],
    });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    const r = w.get({ calendar: '1', from: '2026-11-25', to: '2026-11-25' });
    assert.strictEqual(r.events[0].start, '2026-11-25T12:00', 'London is UTC in November');
    assert.strictEqual(r.events[0].tz, 'Europe/London');
  });

  test('all-day events come back as plain dates with an exclusive end', () => {
    const day = makeEvent({
      title: 'Holiday', allDay: true,
      start: new Date('2026-11-26T00:00:00+11:00'), end: new Date('2026-11-27T00:00:00+11:00'),
    });
    const w = worldWith(null, { cals: [makeCal(ID_A, { events: [day] })] });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    const r = w.get({ calendar: '1', from: '2026-11-23', to: '2026-11-29' });
    assert.strictEqual(r.events[0].allDay, true);
    assert.strictEqual(r.events[0].start, '2026-11-26');
    assert.strictEqual(r.events[0].end, '2026-11-27');
  });

  test('the write calendar is never read, and script-tagged events are hidden (no echoes)', () => {
    const mine = makeEvent({ title: 'My session', start: sydney('2026-11-25T09:00:00+11:00'), end: sydney('2026-11-25T10:00:00+11:00'), tags: { trimomentum: 'plan-1' } });
    const normal = makeEvent({ title: 'Real meeting', start: sydney('2026-11-25T11:00:00+11:00'), end: sydney('2026-11-25T12:00:00+11:00') });
    const w = worldWith(null, { cals: [makeCal(ID_A, { events: [mine, normal] }), makeCal(ID_B, { events: [normal] })] });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A, ID_B] });
    // gcal.write is stage c: put the row in by hand to prove the read side already honours it.
    const sheet = w.sheets.Settings;
    sheet.appendRow(['gcal.write', ID_B, new Date()]);
    const r = w.get({ calendar: '1', from: '2026-11-25', to: '2026-11-25' });
    assert.deepStrictEqual(r.events.map((e) => e.title), ['Real meeting']);
    assert.ok(r.events.every((e) => e.cal === ID_A));
  });

  test('a calendar that throws gives a short error, never the raw message', () => {
    const w = worldWith(null, { cals: [makeCal(ID_A, { throwOnEvents: 'Exception: TOP-SECRET-STACK' })] });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    const text = w.sandbox.doGet({ parameter: { calendar: '1', from: '2026-11-25', to: '2026-11-25' } }).text;
    assert.ok(!text.includes('TOP-SECRET-STACK'));
    assert.deepStrictEqual(JSON.parse(text), { ok: false, error: 'unavailable' });
    assert.ok(w.sandbox._logged.some((l) => l.includes('TOP-SECRET-STACK')), 'the raw message goes to the log');
  });
});

describe('range (B3, B4)', () => {
  const w = worldWith([ID_A]);
  const bad = (params, why) => assert.deepStrictEqual(w.get(Object.assign({ calendar: '1' }, params)), { ok: false, error: 'bad_range' }, why);

  test('rolling-over dates, reversed ranges, over-long spans, missing and non-dates are refused', () => {
    bad({ from: '2026-02-30', to: '2026-03-02' }, 'Feb 30');
    bad({ from: '2026-13-45', to: '2026-13-46' }, 'month 13');
    bad({ from: '2026-11-29', to: '2026-11-23' }, 'to before from');
    bad({ from: '2026-11-01', to: '2026-12-13' }, '43 days');
    bad({ from: '2026-11-23' }, 'missing to');
    bad({ to: '2026-11-23' }, 'missing from');
    bad({ from: 'tomorrow', to: 'next week' }, 'non-dates');
    bad({ from: '2026-1-5', to: '2026-1-6' }, 'unpadded');
  });

  test('a 42-day span succeeds; a single day succeeds', () => {
    assert.strictEqual(w.get({ calendar: '1', from: '2026-11-01', to: '2026-12-12' }).ok, true);
    assert.strictEqual(w.get({ calendar: '1', from: '2026-11-25', to: '2026-11-25' }).ok, true);
  });

  test('more than 300 matching events returns 300 and truncated', () => {
    const evs = [];
    for (let i = 0; i < 350; i++) {
      const start = new Date(Date.UTC(2026, 10, 25, 0, 0) + i * 60000);
      evs.push(makeEvent({ title: 'e' + i, start, end: new Date(start.getTime() + 30000) }));
    }
    const big = worldWith(null, { cals: [makeCal(ID_A, { tz: 'UTC', events: evs })] });
    big.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    const r = big.get({ calendar: '1', from: '2026-11-25', to: '2026-11-25' });
    assert.strictEqual(r.events.length, 300);
    assert.strictEqual(r.truncated, true);
  });
});

describe('Settings tab (B5, B6, B7)', () => {
  test('?settings=1 returns only rows that exist and never gcal.created', () => {
    const w = worldWith();
    assert.deepStrictEqual(w.get({ settings: '1' }), { ok: true, settings: {} });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A] });
    w.sheets.Settings.appendRow(['gcal.created', 'secret-created-id', new Date()]);
    const r = w.get({ settings: '1' });
    assert.deepStrictEqual(r.settings, { 'gcal.read': [ID_A] });
    assert.ok(!JSON.stringify(r).includes('secret-created-id'));
  });

  test('a write outside the allowlist, or with a bad value, is refused and writes nothing', () => {
    const w = worldWith();
    const before = () => w.log.filter((l) => l[0] === 'set').length;
    const cases = [
      [{ key: 'gcal.created', value: 'x' }, 'bad_key'],
      [{ key: 'gcal.write', value: ID_A }, 'bad_key'],      // stage c
      [{ key: 'gcal.read ', value: [ID_A] }, 'bad_key'],     // trailing space
      [{ key: 'anything', value: [] }, 'bad_key'],
      [{ key: '__proto__', value: [] }, 'bad_key'],
      [{ key: 'gcal.read', value: 'not-an-array' }, 'bad_value'],
      [{ key: 'gcal.read', value: Array.from({ length: 51 }, (_, i) => 'id' + i) }, 'bad_value'],
      [{ key: 'gcal.read', value: ['x'.repeat(257)] }, 'bad_value'],
      [{ key: 'gcal.read', value: [42] }, 'bad_value'],
      [{ key: 'gcal.read', value: [''] }, 'bad_value'],
    ];
    for (const [body, error] of cases) {
      const n = before();
      assert.deepStrictEqual(w.post(Object.assign({ kind: 'settings', action: 'set' }, body)), { ok: false, error }, JSON.stringify(body).slice(0, 60));
      assert.strictEqual(before(), n, 'a refused write must not touch the sheet');
    }
    assert.deepStrictEqual(w.post({ kind: 'settings', action: 'delete', key: 'gcal.read' }), { ok: false, error: 'bad_request' });
  });

  test('exactly 50 ids of 256 characters are accepted', () => {
    const w = worldWith();
    const ids = Array.from({ length: 50 }, (_, i) => String(i).padStart(256, 'x'));
    assert.deepStrictEqual(w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: ids }), { ok: true });
  });

  test('set upserts by key, never adds a second row and never deletes one; [] is stored as []', () => {
    const w = worldWith();
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [ID_A, ID_B] });
    w.post({ kind: 'settings', action: 'set', key: 'gcal.read', value: [] });
    const sheet = w.sheets.Settings;
    assert.strictEqual(sheet.getLastRow(), 2, 'header + one row');
    assert.strictEqual(sheet._cell(2, 1).v, 'gcal.read');
    assert.strictEqual(sheet._cell(2, 2).v, '[]');
    assert.deepStrictEqual(w.get({ settings: '1' }).settings, { 'gcal.read': [] });
  });

  test('a value beginning = + - @ is stored as literal text, never evaluated', () => {
    const w = worldWith();
    w.get({ settings: '1' }); // creates the sheet
    for (const evil of ['=IMPORTXML("http://evil","//a")', '+1+1', '-1', '@SUM(1)', '=HYPERLINK("http://evil")']) {
      w.sandbox.settingsUpsert_(w.sheets.Settings, 'gcal.read', evil);
      const cell = w.sheets.Settings._cell(w.sheets.Settings.getLastRow(), 2);
      assert.strictEqual(cell.v, evil);
      assert.strictEqual(cell.fmt, '@', 'the cell must be plain text before the value is written');
      assert.strictEqual(cell.evaluatedAsFormula, false);
    }
    // And the order matters: the format is applied before the value, every time.
    const ops = w.log.filter((l) => l[3] === 2 && l[0] !== undefined);
    for (let i = 0; i < ops.length; i++) {
      if (ops[i][0] === 'set') assert.strictEqual(ops[i - 1][0], 'fmt', 'setNumberFormat must precede setValue');
    }
  });
});
