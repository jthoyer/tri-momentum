# Build spec: Calendar start screen (TM-006)

Status: spec for build. Written 24 Nov 2026. Branch: `claude/compassionate-gauss-wljjol` in both repos.
Owner decisions: 24 Nov 2026 (TM-006 map, decisions 1 to 10), plus the items the owner confirmed in this session. Nothing here re-opens them.
Readers: Implementer (`cody`), `mc-reviewer`, `mc-verifier`, `security-auditor` (stages b and c).
Self-review: red-team unavailable, self-applied. The Reviewer is the first independent read.

---

## 1. Objective

When the app opens, and whenever Check-in is tapped, the athlete sees their week as a calendar: what they planned, what they logged, how each planned session scored, and (later) what is booked in Google Calendar, with a check-in one tap away.

---

## 2. Prior art and dependencies

- **Layout pattern:** the OpenAthlete calendar (week, compliance strip, week summary). It is AGPL-3.0 and this repo is public. Copy the pattern only. Do not copy, adapt or paste any of its code, CSS or markup.
- **Google Calendar (stages b, c):** Apps Script's built-in `CalendarApp`, inside the existing `apps-script/Code.gs`, behind the existing `/exec` URL (research TM-007). No Cloud project, no browser sign-in, no token in the page. It needs no library.
- **New dependencies: none allowed.** `index.html` stays one static file with no build step and no framework. `package.json` keeps `playwright` as its only dev dependency.
- **Reuse, do not rebuild** (all in `index.html`): `planDayResults()` (1784), `dayPlanSplit()` (4942), `weekDayFor()` (1593), `buildWeek()` (1564), `planItemsFor()` (3492), `planItemsInWeek()` (3495), `nextRace()` (1557), `raceCountdownLabel()` (1538), `raceCalMonthWeeks()` (2945), `raceCalWeekRow()` (2989), `raceCalPhaseRow()` (3010), `setPhaseForWeek()` (1455), `resolvePhaseForDate()` (1413), `isoWeekNumber()` (1516), `startCheckInFromPlan()` (4900), `applyPlanPrefill()` (4862), `flowIsPristine()` (5027), `openPlanDayForm()`/`goToPlanDay()`/`openPlanEditor()` (4469 to 4494), `planMetaLine()`, `splashTodayName()` (3290), `say()`, the `.plan-week-nav`/`.plan-week-btn` stepper, the `.dash-cell-seg` state classes, and the `.race-cal-*` classes.

---

## 3. Non-goals

- No sixth nav tab. The nav stays five buttons at 84px.
- No Season view, no go-to-date, no sport filter.
- No fitness, fatigue or form. No new derived metric of any kind (revisit with TM-005).
- No change to `planDayResults()`, `tallyPlanDays()` or any Adherence rule. No second "is it logged" rule anywhere.
- No change to how a check-in is asked or saved. `a1` is never pre-filled through any path.
- No moving a planned session to another date. No drag and drop. No session times on planned sessions.
- The app never suggests, generates or adjusts a plan. Write-back copies what the athlete planned; it decides nothing.
- Google events are never scored, never counted in planned or logged time, never matched to sessions, and never shown in Month.
- No reading Strava columns N to T. The TM-004 vs CLAUDE.md Strava conflict is noted in section 15, not resolved.
- No fix to the pre-existing issues in section 16.
- Leave the "review openathlete" backlog row Pending.

---

## 4. Planner calls (my reading of the decisions; the Reviewer may challenge)

These fill gaps the decisions left. They are not owner decisions. Anything genuinely open is in section 18 instead.

| # | Call | Why |
|---|---|---|
| P1 | The phase in the week summary and the Month band both come from `resolvePhaseForDate(mondayISO)`. | That is what `setPhaseForWeek()` writes, so an edit in Month shows at once in Week. Review's Month reads a different source (finding F3, section 15). |
| P2 | "Logged time" counts every logged session in the week, planned or not. "Planned time" counts every planned session. Google events count in neither. | The chip minutes are "minutes logged that day"; the summary must add up to the chips. |
| P3 | "Check in on this" shows only on a planned card with no matched log entry whose date is today or earlier. Future cards have none. | `dateField()` caps the date at today (5186). `planDayResults()` already scores future cards `pending`. |
| P4 | "Log an unplanned session" is dated the selected day, and is hidden when the selected day is in the future. | It sits under that day's cards. The date field cannot hold a future date. |
| P5 | Stepping to another week selects today if the week holds today, else its Monday. Month tap-through does the same. | Predictable, and Today is always one tap away. |
| P6 | The "Still to log" row shows only when the shown week is the current week. | It is the decision 37 Monday gap. On other weeks "Today" is the way back. |
| P7 | A chip shows at most four dots; more are summarised in its accessible name. | Seven chips must fit 320px at 44px each. |
| P8 | Month shows no Google events. All-day Google events show on every day they cover; timed events show on their start day only. | Month cells are 24 to 26px. Kept simple. |
| P9 | The picker does not show "Connected as …" (the mock does). | Reading the account email needs an extra OAuth scope. |
| P10 | Boot paints Calendar without moving focus or announcing. Tapping Check-in focuses the Calendar heading, as every tab does. | The splash never stole focus at boot either. |
| P11 | Write-back creates all-day events (stage c). Title is the discipline plus title, as `splashTodayName()` builds it. Description carries the meta line, notes and "Added by TRI Momentum". | Planned sessions carry a date and no time. |

---

## 5. Screens, states and element inventory

All new surfaces use `style-guide.md` tokens and Outfit only, light theme only. **Every new text or non-text colour pairing must be measured on the rendered page against its actual composited background, and the figure recorded** (4.5:1 normal text, 3:1 large text and UI parts). No new colour token unless a measured pairing cannot be met with existing ones; if one is added, mirror it into `style-guide.md` and `TRI-Momentum-Design-Guide.html`. Every interactive element is at least 44 by 44 px at a 320px viewport (a `::before` hit area is allowed, as decision 46 did). Status words must never use `--dash-good` or `--dash-mid` as text colour: both fail 4.5:1 on white (style-guide Accessibility).

### 5.1 Calendar view (`showView('calendar')`)

A new full view inside `#app-main`, labelled by its own heading. Top to bottom:

| Element | Content and behaviour |
|---|---|
| Eyebrow | "Check-in". |
| Heading | "Calendar". Focus target for `showView`. |
| Race strip | The `nextRace()` race (locked only). Text: race name, then `raceCountdownLabel(days)` plus " to go" when days ≥ 7, as `renderSplashCountdown()` builds it today (3161). Absent from the DOM when there is no qualifying race. Static, not a control. A race whose `date` is not a real `YYYY-MM-DD` never qualifies (see A6). |
| Resume bar | See 5.4. |
| View switch | Week / Month, a tablist. Arrow keys move between them. Week is the default. |
| Panel | Week panel (5.2) or Month panel (5.3). |
| Quiet line | Empty state only (5.5). |
| Google Calendar row | Stage b onward. A full-width row at the foot: "Google Calendar" with a sub-line ("Not set up", "Reading N", "Reading N · Writing to {name}"). Opens `showView('gcal')`. Absent in stage a. |
| Live region | Reuse the existing `say()`. |

Calendar state (shown week, selected date, view, shown month, the week whose phase is mid-edit) is module state, never read back from the DOM, so a background Sheet refresh can rebuild the view without losing place. Same reason as `raceCalYear`/`planFormOpenFor`.

### 5.2 Week panel (Option A: day strip plus agenda)

| Element | Content and behaviour |
|---|---|
| Week stepper | `‹` / `›` (44px), centre label "Week {ISO week}" over "{d} – {d} {Mon}". Reuse `.plan-week-nav`. |
| Today button | Returns to the current week with today selected (also in Month: returns to the current month). |
| Week summary row | Week number, phase pill (P1; no pill when the phase resolves to null), "Planned {h}h{mm}", "Logged {h}h{mm}". A meter shows logged over planned, capped visually at 100%, with an accessible name stating both figures. No meter when nothing is planned. |
| "Still to log" row | One quiet row under the summary: "Still to log: N earlier session →" (singular) or "sessions" (plural). Rules in A14. |
| Day chips | Seven buttons, Mon to Sun, a group. Each: weekday, day number, up to four dots, logged minutes ("60m", or "–"). Selected chip: `aria-pressed="true"`. Today's chip: blue ring. Accessible name: full date, "today" when it is, planned count, logged minutes. |
| Agenda header | Heading for the selected day. When today is selected it reads "Today", with the full date beside it. Right side: "{N} min logged" or "Nothing logged". A race day carries a "Race day" pill. |
| Session cards | One per `planDayResults(day).results` entry, in plan order, then one per `extras` entry. Card inventory below. |
| Google blocks | Stage b onward. After the cards, all-day first, then by start time. See 5.8. |
| Empty day | "Nothing planned" plus an "Add" button (`goToPlanDay(date)`). |
| Unplanned button | "Log an unplanned session", under the day's cards. Rules in P4 and A12. |

**Planned session card:**

| Part | Content |
|---|---|
| Discipline dot | Existing `--{disc}` token, `aria-hidden`. |
| Title | `splashTodayName(item)`. "Key" pill when `item.key`. |
| Meta | `planMetaLine(item)`. |
| Status word and strip | One `.dash-cell-seg` segment and one word, mapped exactly as below. The word is always present, so colour never carries meaning alone. |
| Edit | Opens `openPlanEditor(item)`. On every planned card, logged or not. |
| "Check in on this →" | Only under P3. Calls `startCheckInFromPlan(item)`. A logged card is a static record: no CTA, rendered as decisions 32(b) and 34 render logged items. |
| "Not in Google yet" | Stage c only. Rules in C9. |

**Status mapping.** One mapping, shared with `planDashCell()` (1878) so the grid and the cards cannot disagree. Do not write a second copy.

| `planDayResults` result | Segment class | Word |
|---|---|---|
| `cat: 'good'` | `good` | As planned |
| `cat: 'mid'` | `mid` | Adjusted |
| `cat: 'bad'`, has `entry` | `bad` | Off plan |
| `cat: 'bad'`, no `entry` | `missed` | Missed |
| `cat: 'pending'` | `planned` | Not due yet |
| an `extras` entry | `extra` | Unplanned |

**Unplanned (extra) card:** dot, discipline name, "{duration} min · logged", the Unplanned word and strip. No Edit, no CTA (log entries are not editable anywhere in the app).

### 5.3 Month panel

| Element | Content and behaviour |
|---|---|
| Month stepper | `‹` / `›`, "{Mon} {yyyy}". Today button as in Week. |
| Grid | Six Monday-start weeks from `raceCalMonthWeeks(year, month)`: week number column, weekday header, day cells with dim adjacent-month days, today ring, race-day colour (locked over considering, as today). |
| Week tap-through | Each week's number-and-days row is one button ("Week {n}, {d} to {d} {Mon}. Show this week") that opens Week on that week (P5). |
| Phase band | Each week's phase row from `raceCalPhaseRow()`: tap the label to get the inline select; a change calls `setPhaseForWeek(mondayISO, v)` and closes. The band button is a sibling of the week button, never nested inside it. |
| Legend | The existing race-calendar legend: Locked in, Considering, Today; Base, Build, Peak, Taper. |
| Nice-to-have | Per-week planned/logged time beside each week; dots in day cells. Not required. |

Keep the `.race-cal`, `.race-cal-phase`, `.race-cal-legend-dot` and `.race-cal-phase-edit` class names and their `phase-*` modifiers, so `tests/syntax.test.js` keeps checking the phase colours unchanged.

### 5.4 Resume bar

Shown under the race strip when a check-in is part-way through: `flowIsPristine()` is false **and** `state.mode` is `'ask'` or `'review'`. Never in `'saved'` (`flowIsPristine()` returns false for saved, 5028, so that mode must be excluded explicitly). Content: "Check-in in progress", a line naming what is known (discipline and duration if answered, the date if not today, and "question X of Y" or "ready to review"), and a "Resume check-in" button that shows the flow exactly where it was. Nothing in `state` changes on resume. If it is hidden with `.hidden`, it needs its own `[hidden]` rule and a `HIDEABLE` row (there is no global `[hidden]` rule).

### 5.5 Empty state

When the shown week has no planned sessions **and** Google reading is not set up: the week still renders, logged sessions included, and one quiet line sits under the agenda: "Add a plan or connect Google Calendar". "Add a plan" opens `goToPlanDay(selected date)`. "connect Google Calendar" opens `showView('gcal')`. In stage a the line reads "Add a plan" only, because the picker does not exist yet. An empty day in the empty state reads "Nothing logged" (mock wording).

### 5.6 Check-in from Calendar

- **Planned card:** `startCheckInFromPlan(item)`, dated `item.date`, pre-filled with `disc`, `intensity` and the duration bucket only.
- **Unplanned:** a fresh check-in, dated the selected day, nothing pre-filled. Decision 29's "Use these details" hint cards still appear on the date page (decision 32 kept them).
- **Phase gate:** if no phase resolves for today, either action goes to the phase picker first, then lands on the action it was aimed at, with the same date and pre-fill. Calendar itself never needs a phase.

### 5.7 Picker (`showView('gcal')`, stage b onward)

| Element | Content and behaviour |
|---|---|
| Back | "‹ Calendar", returns to Calendar. |
| Heading | "Google Calendar". |
| Read section | Fieldset "Read events from", hint "Shown as quiet blocks beside your sessions. Never scored." One checkbox per calendar from `?calendar=1`. Stage c: the write calendar is listed but disabled, with "Receives your sessions". |
| Write section | Stage c only. Fieldset "Write planned sessions to", hint "One calendar only." Radios: "Create a new TRI Momentum calendar" first and selected by default, then each writable calendar. Picking an existing calendar shows: "Your own events in this calendar will not show here." |
| Save | Writes the choices (section 7.1). Then re-reads Settings. |
| Status | Saving, saved, or "Couldn't reach Google Calendar. Try again." with a Try again button when the list call fails. |

### 5.8 Google block

Read-only. A dashed `--bd2` border on `--s3`, `--ink2` text: time ("All day" or "HH:mm"), title, and a small "Google" tag. No discipline dot, no strip, no word, no CTA, not focusable, not counted anywhere. Accessible as a note: "Google Calendar event, {time} {title}". Titles are untrusted text (section 11).

### 5.9 "Not in Google yet" mark

Stage c. A small pill on a planned card: "Not in Google yet". Existing tokens (the mock uses `--modified` on `--modified-l`; measure it). Rules in C9.

---

## 6. How existing surfaces change

### 6.1 Splash removal (decisions 15, 22, 29, 34, 36, 37)

- Remove `#view-splash` (markup 687 to 695), its CSS, `renderSplashCountdown()`, `renderSplashToday()`, `splashTodayRow()`, `splashPrevDays()`, `splashPrevCarousel()`, `splashPrevDayIndex`, `formatSplashPrevDate()`, `exitSplash()`, `revealPostSplashScreen()`, the splash branch of `refreshVisibleViewFromSheet()` (5483 to 5490), and the splash calls at init (5724 to 5735) and in `addRace()`/`deleteRace()` (2651, 2660).
- Keep `splashTodayName()`: `flowPlanCard()` and `usePlannedSession()` use it. Renaming it is optional.
- At boot `#app-main` is visible and Calendar shows (P10). The race strip, Today's sessions and the "Earlier this week" carousel all fold into Calendar. The carousel retires: past days show their own Missed cards with "Check in on this".
- **Splash tests:** none are committed. The 42 splash checks of decision 34 lived in a scratch harness. The only committed splash reference is the `.splash` row in `HIDEABLE` (`tests/syntax.test.js` 85). Remove that row in the same change that removes `.splash`; it would otherwise fail as stale. This is deleting a dead row, not weakening the check.

### 6.2 Check-in nav, landing and the phase gate (decisions 19 and 32)

- Tapping Check-in always shows Calendar, reset to the current week with today selected, whether or not a phase is set and whether or not a check-in is part-way through (the resume bar is the way back). The handler at 5574 to 5593 no longer routes to the picker.
- `tab-flow` is `aria-selected="true"` for the Calendar, flow and picker views. Today `showView()` sets it from `isFlow` alone (5443).
- Add `isCalendar` and `isGcal` to the `isFlow` exclusion chain (5433). `tests/syntax.test.js` enforces this.
- The "Which session?" landing retires: `state.mode === 'plan'`, `renderPlanLanding()`, its branches in `renderChrome()`, `renderFoot()`, `render()` and the Back/Next guards, and `startUnplannedCheckIn()`. `startCheckIn()` either becomes "show Calendar" or goes. `phaseReturnWantsLanding` is replaced by a held action (planned item or unplanned date) that `choosePeriod()` resumes. Keep the `.flow-foot[hidden]` CSS rule: its `HIDEABLE` row still applies.
- `flowIsPristine()` gains a second caller (the resume bar). Its comment at 5030 to 5036 says `startCheckIn()` is its only caller; update the comment. Do not loosen its date rule.
- **Decision 19 holds:** "Change phase" inside the flow still returns to the question you were on (`openPhasePicker()`, 5639).
- **Decision 32's guard holds in a new form:** a half-finished check-in is never discarded without the athlete choosing to (A13). How that choice is offered is open question Q2.
- After save, the app still goes to Review (5411), unchanged.

### 6.3 Review (decision 31)

Remove the "This week's plan" list: the call at 2631 to 2633, `dashPlanWeekSection()`, `dashPlanDay()`, `dashPlanLine()` and their CSS (keep any class another surface still uses, such as `.plan-item-key`). Review keeps its three signals, the legend, "See this month →" and "Edit plan →".

### 6.4 Races (decisions 41, 42, 46, 47)

Races keeps the hero, the add form and the Upcoming/Past lists, and loses the month grid: remove the `raceCalendarSection()` call (3151), the `resetRaceCalToCurrentMonth()` call in `showView` (5452), and the phase refresh in the Races branch of `refreshVisibleViewFromSheet()` (5511 to 5513). Per-week phase editing moves into Calendar Month.

### 6.5 Plan view

"Edit plan" stays reachable from Calendar through Add and Edit. The Plan view's back link (4029 to 4033) returns to whichever view opened it: "← Back to calendar" or "← Back to this week". Review's own "Edit plan →" link is unchanged.

### 6.6 Background refresh

Calendar refreshes log, plan, races and phases when shown and on `visibilitychange`, and redraws only if something changed and only while still visible. While a Month phase select is open, hold the redraw, as the Plan view does for an open form (5525). Stage b adds Settings and Google events to this.

---

## 7. Data contracts

### 7.1 `Settings` sheet tab (stage b)

- **Sheet:** `Settings`, created on demand like `Races`/`Plan`/`Phases`. Headers: `Key`, `Value`, `UpdatedAt`.
- **Keys (an exact allowlist; anything else is refused):**

| Key | Value stored | Stage |
|---|---|---|
| `gcal.read` | JSON array of calendar id strings. `[]` means "read none". | b |
| `gcal.write` | One calendar id string, or empty for "write-back off". | c |
| `gcal.created` | Id of the calendar the script itself created. Written by the script only, never by a request. | c |

- **Read:** `GET .../exec?settings=1` returns `{ok: true, settings: {"gcal.read": [...], "gcal.write": "..."}}`. Only keys that have a row appear. `gcal.created` is not returned.
- **Write:** `POST {kind: 'settings', action: 'set', key, value}`, fire-and-forget no-cors like Races/Plan. An upsert by key under the document lock. **Rows are never deleted.** "None" is stored as `[]` or an empty string, never as a missing row.
- **Stage c extra write:** `POST {kind: 'settings', action: 'createWriteCalendar'}`. The script reuses `gcal.created` if that calendar still exists, otherwise creates a calendar named "TRI Momentum", records `gcal.created`, and sets `gcal.write` to it. Idempotent. The client cannot read the new id from a no-cors response, so it re-reads `?settings=1` and `?calendar=1` afterwards.
- **Validation:** `value` for `gcal.read` is an array of at most 50 strings, each at most 256 characters; for `gcal.write` one such string or empty. Values are stored as plain text, never as a formula (section 11).
- **Client cache:** `localStorage` keys `triMomentumSettings_v1` (the last known settings) and `triMomentumSettingsSynced_v1` (the push-once flag). Same-device cache only, as everywhere.
- **The empty-response problem (decision 48's thinking, applied per key).** An empty or partial `?settings=1` response is ambiguous on a device's first sync: "never set anywhere" and "set on this device but never pushed" look the same. Rules:
  1. A key present in the response wins, including `[]` and empty string. Local is overwritten.
  2. A key absent from the response, while the local cache holds a value for it and this device has not yet pushed: push the local value once, set the flag as soon as the push is attempted (decision 48's trade-off), keep local.
  3. A key absent and nothing local: unset.
  4. A failed or malformed read changes nothing.

  Because rows are never deleted, "absent" can only ever mean "never written from any device", so rule 2 cannot resurrect a choice another device cleared.

### 7.2 `?calendar=1` read (stage b)

Routing: the calendar branch must not be shadowed by `doGet`'s existing checks (159 to 178). `?calendar=1&list=1` would hit `listSessions_()` first, so use no parameter named `list`, `races`, `plan` or `phases` here. Tests depend on a fixed parameter order: `calendar=1&from=…&to=…`.

**Calendars list:** `GET ?calendar=1` (no `from`).

| Field | Shape |
|---|---|
| `ok` | `true` |
| `timeZone` | the script time zone, an IANA name |
| `calendars[]` | `{id, name, color, primary: bool, writable: bool, read: bool, write: bool}` |

`read` and `write` reflect Settings. What `name` exposes is part of open question Q1.

**Events:** `GET ?calendar=1&from=YYYY-MM-DD&to=YYYY-MM-DD` (both inclusive).

| Field | Shape |
|---|---|
| `ok` | `true` |
| `from`, `to`, `timeZone` | echoed |
| `events[]` | `{cal, title, allDay: bool, start, end}`. All-day: `start`/`end` are `YYYY-MM-DD`, `end` exclusive. Timed: `YYYY-MM-DDTHH:mm` in `timeZone`. Sorted by `start`. |
| `truncated` | `true` when more than 300 events matched; only the first 300 are returned |

- Calendars read = `gcal.read`, minus any id that no longer exists, **minus `gcal.write` always** (no echoes; enforced in the script, not only in the page).
- Only these fields leave the script: no description, location, guests, organiser, attachments, conference links or event ids. Titles are capped at 200 characters.
- Range: both dates must be real dates (a date that rolls over, such as `2026-02-30` or `2026-13-45`, is refused: it must format back to exactly the string sent), `to ≥ from`, and the span is at most 42 days (the Month grid).
- Errors: `{ok: false, error: 'bad_range' | 'unavailable'}`. A raw exception message never goes back in a response.
- The client fetches the shown week (Week) or the six grid weeks (Month never renders events, so Week only in practice), caches the last response per range in `triMomentumGcalEvents_v1`, and on failure keeps showing the cached range or nothing. A non-JSON response (the health-check text from an old deployment) counts as a failure.

### 7.3 `Plan` sheet: new columns (stage c)

Appended after `CreatedAt`, so `getPlanSheet_()`'s trailing-column backfill (409 to 431) adds the headers to the live sheet without touching rows:

| Column | Holds |
|---|---|
| `GcalEventId` | id of the event the script created for this row |
| `GcalCalendarId` | the calendar that event was created in |
| `GcalStatus` | `''` (never attempted), `'pending'`, `'ok'`, `'failed'` |
| `GcalError` | a short code: `no_calendar`, `calendar_missing`, `permission`, `quota`, `timeout`, `unknown` |
| `GcalUpdatedAt` | when the status last changed |

- `PLAN_EDITABLE_COL`/`PLAN_EDITABLE_COUNT` (489, 490) stay Disc to Phase. An `update` request can never write the new columns.
- `planRow_()` and `addBatch`'s `setValues` width grow to the new header count.
- `listPlan_()` adds one field per item: `gcal` = the `GcalStatus` value. It does not return the event id, calendar id or error code.
- Client: `parseSheetPlanItem()` keeps `gcal`; locally created items have no `gcal` until the next read. `updatePlanSession()` mutates in place, so `gcal` survives an edit.

### 7.4 Write actions and failure recording (stage c)

The existing Plan actions keep their shape. When `gcal.write` is empty, they behave exactly as today and `GcalStatus` stays `''`.

| Action | Sheet effect (as today) | Then, when write-back is on |
|---|---|---|
| `add` | append the row with status `pending` | create the all-day event in `gcal.write`, tag it with the plan id, record `ok` plus ids, or `failed` plus a code |
| `addBatch` | write all rows, status `pending` | create one event per row; each row records its own result; one failure never stops the rest |
| `update` | write Disc to Phase (unchanged) | if the row has an event id: update that event's title and description, in the row's own `GcalCalendarId`. If it has none: create one (an edit is the retry path). Record the result |
| `delete` | remove the row | first read the row's event and calendar ids; after the row is gone, delete the event |
| `deleteWeek` | remove the week's rows (bottom-up, unchanged) | first collect those rows' event and calendar ids; then delete each event |

Rules for every calendar call:
- **Order:** the Sheet write happens first and never depends on the calendar call. A calendar failure must leave the row exactly as a write-back-off write would have, plus its status.
- **Locks:** calendar calls run outside the document lock. Re-find the row by id under the lock to record the status. Event creation is slow, and holding the lock across it would time out other writers' 20-second `waitLock`.
- **Ids come only from the Sheet:** an event id or calendar id in a request body is ignored. Update and delete act only on an event that carries the script's tag with this row's plan id; otherwise the event is left alone and the row is marked `failed`/`permission`.
- **Dates:** build the all-day date from the `YYYY-MM-DD` parts in the script time zone. Never parse the string as UTC (it would land a day early in Australia).
- **Delete failures:** the row is already gone, so no mark can show. Write the orphan to the script's execution log with the plan id. Known gap (R9).
- **How success reaches the page without breaking fire-and-forget:** it doesn't, directly. The no-cors response stays opaque and nothing waits on it. The script records the outcome in the row; the page learns it from the next `?plan=1` read (on Calendar open, on `visibilitychange`, on Plan view open). Until then a fresh item has no `gcal` value and shows no mark.

---

## 8. Stage a: read-only Calendar on existing Sheet data

**Ships alone. No `Code.gs` change. No redeploy.** Files: `index.html`, `tests/*`, `style-guide.md`, `TRI-Momentum-Design-Guide.html` (if a new pattern is documented there), `CLAUDE.md`.

Each criterion names the test that checks it. "cal-ui" is the new `tests/calendar-ui.test.js`; fixtures are in section 14.

| # | Criterion | Test |
|---|---|---|
| A1 | On load, with any localStorage state, `#app-main` and the Calendar view are visible, no element with class `splash` or id `view-splash` exists, and `#tab-flow` has `aria-selected="true"`. | cal-ui "boots on Calendar" |
| A2 | Tapping `#tab-flow` from any other tab shows Calendar on the current week with today's chip pressed, including when `phasePlan` is empty. | cal-ui "Check-in opens Calendar", "no phase still opens Calendar" |
| A3 | `#tab-flow` is `aria-selected="true"` while Calendar or the flow shows, and the other four tabs are `"false"`. | cal-ui |
| A4 | The week summary for fixture F1 reads "Week 48", phase "Build 1", "Planned 7h05", "Logged 2h00". | cal-ui "week summary" |
| A5 | Chips: seven buttons; Tue 24 is pressed and ringed; logged minutes read Mon "60m", Tue "60m", all others "–"; each accessible name includes the full date. | cal-ui "chips" |
| A6 | Race strip reads "Sample race · 16 weeks · 4 days to go" (or the equivalent DOM text) for the locked race on 2027-03-20. With only considering races, or a locked race whose date is "TBC", the strip is absent from the DOM (today `raceCountdownLabel(NaN)` would print "NaN weeks"). | cal-ui "race strip" |
| A7 | Cards for F1 carry exactly these words: Mon swim "As planned", Mon strength "Missed", Tue run "Adjusted", Tue bike "Not due yet", Tue swim "Unplanned", Wed swim, Fri run and Sat ride "Not due yet". Fri run has a "Key" pill. Each card's segment class matches the word per the mapping table. | cal-ui "status words" |
| A8 | "Check in on this" appears on Mon strength and Tue bike only. It never appears on a logged card, the Unplanned card, or Wed to Sun. | cal-ui "CTA placement" |
| A9 | Tapping Tue bike's CTA opens the flow with `date` 2026-11-24, `disc` bike, `intensity` and duration bucket from the plan, and `a1`, `a2`, `a3`, `b2`, `b3`, `rpe` all unset. Tapping Mon strength's CTA gives `date` 2026-11-23. | cal-ui "a1 never pre-filled" |
| A10 | With an empty `phasePlan`, Calendar shows on boot without the picker. Tapping a CTA shows the picker; choosing a phase lands in the flow with A9's date and pre-fill. The same holds for "Log an unplanned session". | cal-ui "phase gate moves to check-in start" |
| A11 | In the flow, "Change phase", then a phase, returns to the same question with every answer intact (decision 19). | cal-ui "decision 19" |
| A12 | "Log an unplanned session" on Mon 23 opens the flow with `date` 2026-11-23 and no other answer set. It is absent when Wed 25 is selected. | cal-ui "unplanned path" |
| A13 | Start a check-in, answer one question, tap Check-in: the resume bar shows; "Resume check-in" returns to the same step with the answer intact. The bar is absent when the flow is pristine and after a save. Starting another check-in while the bar shows never discards the first one without an explicit choice (mechanism per Q2). | cal-ui "resume bar" |
| A14 | "Still to log" (fixture F3, clock Mon 30 Nov): with Sun 29 run open, the row reads "Still to log: 1 earlier session →"; tapping it shows week 48 with Sun 29 selected. Logging a swim on Sun 29 leaves the row in place (a run is still open). Logging the run removes it. An open session on Sun 22 (eight days back) is never counted. The row is absent on any week other than the current one. The count comes from `dayPlanSplit()`, never a second rule. | cal-ui "still to log" |
| A15 | Week stepping: `›` then `‹` returns to week 48. Stepping to week 49 selects Mon 30. Today returns to week 48 with Tue 24 selected. | cal-ui "stepping" |
| A16 | Month: the tablist switches with a click and with arrow keys. November 2026 shows six weeks with week numbers 44 to 49, exactly one `.race-cal-day.today`, and the considering race on 6 Dec marked. Tapping week 49's row opens Week on week 49. | cal-ui "month" |
| A17 | Month phase edit: tapping "Edit the phase for the week of Mon 16 Nov" opens a select; choosing Peak writes one `phasePlan` block `{from: '2026-11-16', phase: 'peak'}` and closes the select; editing again updates that block in place. | retargeted `race-calendar-ui.test.js` |
| A18 | Empty state (F2): the week shows its logged sessions, the line "Add a plan" shows, and tapping it opens the Plan view with the selected day's add form. | cal-ui "empty state" |
| A19 | Edit on a planned card opens the Plan view's edit form for that item; the back link reads "← Back to calendar" and returns to Calendar on the same week. | cal-ui "edit and back" |
| A20 | Review's Adherence tab has no "This week's plan" section; its three signal tabs, "See this month →" and "Edit plan →" remain. | cal-ui "Review keeps signals" |
| A21 | Races has no `.race-cal` element; hero, add toggle and Upcoming list remain. | retargeted `race-calendar-ui.test.js` |
| A22 | At a 320px viewport: no horizontal overflow on Calendar (Week and Month); every chip, button and card action measures at least 44 by 44 px (hit area included). | cal-ui "320px" |
| A23 | Every new text and UI colour pairing is measured on the rendered page and the figures are recorded in the PR and in `style-guide.md` where a new pattern is documented. None is below 4.5:1 (text) or 3:1 (UI), except the pre-existing `--dash-mid` segment (section 16), which is reported, not fixed. | manual, recorded |
| A24 | No page errors in any cal-ui scenario. | cal-ui |
| A25 | Background refresh: with Calendar showing, a changed `?plan=1` response redraws it; with a Month phase select open, the redraw waits until the select closes. | cal-ui "refresh" (serveApp `routes`) |

**Nice-to-have (not acceptance):** per-week totals and day dots in Month; fixing the `splashTodayName()` em-dash collision (pre-existing, decision 34) now that the landing it would have changed is gone.

---

## 9. Early spike (runs while stage a is built)

Purpose: answer the unverified Apps Script points before stage b is designed into code. **The owner redeploys once.**

Scope of the spike `Code.gs` change: a `?calendar=1` branch that returns `{ok, version: 'spike-1', scriptTimeZone, calendarCount, calendars: [{primary, writable, color}], probe}`. **No calendar names by default**: while the spike is deployed, anyone with the `/exec` URL (which is in this public repo) can call it (section 11). Names only if the owner accepts that, knowingly. `probe` reports one owner-named test event's start, formatted in the script zone and in its calendar's zone.

Owner steps and what each answers:
1. Project Settings: tick "Show appsscript.json manifest file in editor". In Overview, copy the current OAuth scopes list exactly.
2. Pin `oauthScopes` in `appsscript.json` to that list **plus** `https://www.googleapis.com/auth/calendar.readonly`. Without pinning, `CalendarApp` auto-detects the full `calendar` scope and grants write access before stage c. Expected current scopes (confirm against step 1, do not trust this list): `https://www.googleapis.com/auth/spreadsheets` or `.currentonly` (SpreadsheetApp, bound sheet), `https://www.googleapis.com/auth/script.external_request` (UrlFetchApp, Strava: 931, 975, 1103), `https://www.googleapis.com/auth/script.scriptapp` (triggers: 1005 to 1009). LockService, PropertiesService, ContentService, HtmlService output, Logger, Utilities and `Session.getScriptTimeZone()` are expected to need none.
3. Deploy, Manage deployments, pencil, New version. Re-authorise when asked.
4. Open `/exec?calendar=1`. Answers: does `CalendarApp` work with `calendar.readonly` alone, and without the Advanced Calendar service? Does turning the Advanced service on change the scopes asked for?
5. In the editor, run `syncStravaActivities` by hand and check Executions. Answers: did pinning break Strava or the trigger? (A scope change can leave a time trigger failing quietly until re-authorised.)
6. Change `version` to `spike-2`, save, **do not** make a new version. Reload `/exec?calendar=1`. Answers: does `/exec` stay on the last deployed version after a save? (Expected yes.)
7. Compare `scriptTimeZone` with the owner's real zone, and read the `probe`. Answers: the time-zone trap for events with no zone, and whether all-day dates come back on the right day.
8. Not tested by the spike: the 5,000 events-created-per-day consumer quota (Google's quotas page, read 24 Nov 2026, also lists 6 minutes per execution and 30 simultaneous executions per user). Stage c tests a small batch instead. Token expiry is irrelevant: `CalendarApp` runs on the script owner's own authorisation, with no stored token.

The spike code is replaced by stage b. Record the answers in the PR for stage b.

---

## 10. Stage b: Google read, Settings tab, picker (read-only)

**Ships alone. `Code.gs` changes. Scope pinned to `calendar.readonly`. Blocked by Q1.**

Files: `apps-script/Code.gs`, `index.html`, `tests/*`, `style-guide.md`, `CLAUDE.md`. `appsscript.json` is not in the repo: the owner edits it (section 13).

| # | Criterion | Test |
|---|---|---|
| B1 | `?calendar=1` returns the calendars shape in 7.2; `?calendar=1&from&to` returns the events shape; `?calendar=1&list=1` does not return sessions. | code-gs "calendar routing" |
| B2 | Events come only from `gcal.read` calendars that exist. Only the listed fields leave the script; titles over 200 characters are cut. | code-gs "event fields" |
| B3 | `from=2026-02-30`, `from=2026-13-45`, `to < from`, a span of 43 days, a missing `to`, and a non-date string each return `{ok:false, error:'bad_range'}`. A 42-day span succeeds. | code-gs "range" |
| B4 | More than 300 matching events returns 300 and `truncated: true`. | code-gs |
| B5 | `?settings=1` returns only rows that exist, never `gcal.created`. `set` with a key outside the allowlist, a key with a trailing space, a non-array `gcal.read`, 51 ids, or a 257-character id is refused and writes nothing. | code-gs "settings allowlist" |
| B6 | `set` upserts by key and never deletes a row. Setting `gcal.read` to `[]` stores `[]`. | code-gs |
| B7 | A value beginning `=`, `+`, `-` or `@` is stored and read back as that literal text, never evaluated as a formula. | code-gs "no formula" (stub asserts plain-text storage) plus owner check on the real Sheet |
| B8 | Client Settings sync follows 7.1's four rules: a present key wins (including `[]`); an absent key with a local value is pushed once and the flag set; a failed read changes nothing. | cal-ui "settings sync" (serveApp `routes` on `settings=1`) |
| B9 | Week shows Google blocks for F1's events: "12:30 Team lunch" on Wed 25, "08:00 Dentist" on Fri 27, after the cards, with no dot, strip, word or CTA, and not focusable. Google events change neither planned nor logged time nor chip minutes. | cal-ui "Google blocks" |
| B10 | An event titled `<img src=x onerror=…>` renders as that literal text; no `img` element is created inside the agenda. | cal-ui "untrusted titles" |
| B11 | Month shows no Google events. | cal-ui |
| B12 | The Google Calendar row reads "Not set up" with no `gcal.read`, "Reading 2" with two; it opens the picker; the empty state's "connect Google Calendar" opens the same picker. | cal-ui "picker entry" |
| B13 | Picker: checkboxes list every calendar from the mocked list; Save posts one `set` for `gcal.read` and re-reads; a failed list shows "Couldn't reach Google Calendar. Try again." with a working Try again. No write section exists in stage b. | cal-ui "picker" |
| B14 | When `?calendar=1` fails or returns non-JSON, Calendar still renders sessions with no error banner, using cached events for that range if any. | cal-ui "Google down" |
| B15 | Strava sync still runs after the scope pin (owner runs `syncStravaActivities` by hand; Executions shows success). | manual (owner) |
| B16 | Picker and blocks meet A22 and A23. | cal-ui "320px", manual |

---

## 11. Security surface (stages b and c), for `security-auditor`

**The threat model, stated plainly.** The `/exec` URL is hard-coded in `index.html` (1141) and this repo is public. The web app runs as the owner with access "Anyone". So any stranger can already send any GET or POST the script accepts, with the owner's authority. That is true today for sessions, races, plan and phases (pre-existing, section 16). Stage b raises the stakes from training data to the owner's whole Google account calendar list; stage c adds the power to create and delete events.

| Surface | Who sends what | What the consumer does | Property it must deliver | Mechanism in this spec, and what it cannot stop |
|---|---|---|---|---|
| `?calendar=1` events | Anyone, any range | Script reads calendars as the owner | A stranger learns no more than the owner accepts a stranger could see | Field allowlist, 200-char titles, 42-day span, 300 cap. **Cannot stop** a stranger reading titles from every calendar: `Settings` is web-writable, so the stranger can set `gcal.read` to every id from the calendars list first. The read list is a preference, not a security bound. See Q1. Red-team input that passes B2 and breaks the property: POST `set gcal.read` = all ids, then GET a range. |
| `?calendar=1` list | Anyone | Lists calendars | Calendar names do not leak | Withholding names. **Cannot** make the picker usable without them, unless Q1 adds a gate. |
| `Settings` write | Anyone | Upserts a row | Only the owner changes what is read and where sessions are written | Key allowlist, value caps. **Cannot stop** a stranger changing the settings. Red-team input that passes B5: a valid `set gcal.write` = the owner's primary calendar id. |
| Plan writes with write-back on (c) | Anyone | Creates, updates, deletes events | A stranger cannot change or delete the owner's own events | Ids only from the Sheet; tag check before update or delete. **Cannot stop** a stranger creating events (up to the daily quota) in whichever calendar `gcal.write` names, including the primary if they set it. Red-team input that passes C6: 2,000 `add` posts after pointing `gcal.write` at the primary. |
| Event titles in the page | Anyone who can invite the owner to an event | Page renders them | A title is shown as text and never runs | Render as text, never as markup (the mocks use `innerHTML`; do not port that). B10 tests it. |
| Strings into the Sheet | Anyone | `setValues` | No request string is ever stored as a formula (`IMPORTXML`/`HYPERLINK` could exfiltrate Sheet data) | Plain-text storage. B7 tests Settings; plan and race strings have the same pre-existing exposure (section 16). |
| Error responses | Anyone | Reads the response | No stack trace, token or internal id leaks | Short error codes only; raw messages go to the execution log. |

**Scopes.** Stage b: `calendar.readonly`. Stage c: the full `calendar` scope, which reaches every calendar the account can see, not only the write calendar. The code may only touch the write calendar and rows' own recorded calendars, but the token can do more; a code bug or a malicious `Code.gs` edit could too.

**Q1 must be answered before stage b ships.** Options for a real gate are in section 18.

---

## 12. Stage c: write-back

**Ships alone. `Code.gs` changes. Scope widens to `calendar`; the owner re-authorises.**

| # | Criterion | Test |
|---|---|---|
| C1 | With `gcal.write` empty, every Plan action writes exactly what it writes today and leaves `GcalStatus` empty; no calendar call is made. | code-gs "write-back off" |
| C2 | `add` writes the row first, then creates one all-day event on the item's date in `gcal.write`, tagged with the plan id, and records `ok`, the event id and the calendar id. | code-gs "add" |
| C3 | If event creation throws, the row still exists with every Disc to Phase value intact and `GcalStatus: 'failed'` with a code. | code-gs "add failure" |
| C4 | `addBatch` of 10 with the 4th creation failing: 10 rows, 9 `ok`, one `failed`. | code-gs "batch partial failure" |
| C5 | `update` on a row with an event updates that event in the row's own calendar; on a row with no event, creates one. Date never changes. | code-gs "update" |
| C6 | `delete` and `deleteWeek` delete only events carrying the script's tag for that row; an event id or calendar id in the request body is ignored; an untagged event is left alone. | code-gs "delete tag check" |
| C7 | `deleteWeek` collects event ids before removing rows and removes every collected event. | code-gs |
| C8 | All-day dates land on the item's own date in an Australian time zone (stub the zone; check a date near midnight UTC). | code-gs "date parts" plus owner check on a real event |
| C9 | "Not in Google yet" shows on a planned card only when `gcal.write` is set **and** the item's `gcal` is `'pending'` or `'failed'`. Never for `'ok'`, never for `''` or missing, never when write-back is off. | cal-ui "failure mark" (mocked `plan=1` with each status) |
| C10 | Picker write section: "Create a new TRI Momentum calendar" first and selected by default; choosing an existing calendar shows "Your own events in this calendar will not show here."; the write calendar is disabled in the read list; Save with "create" posts `createWriteCalendar` once. | cal-ui "picker write" |
| C11 | `createWriteCalendar` twice creates one calendar. | code-gs "create idempotent" |
| C12 | `?calendar=1` events never include the write calendar, even when `gcal.read` lists it. | code-gs "no echo" |
| C13 | Owner test on the real deployment: add one session, see it in Google; edit it, see the change; delete it, see it gone; copy a week of about 10 forward, see 10 events; clear that week, see them gone. Record any throttling. | manual (owner) |
| C14 | Strava sync still runs after the scope change. | manual (owner) |

---

## 13. Deploy gates

The front end goes live on merge to `main` (GitHub Pages). `Code.gs` only goes live when the owner pastes it and makes a new version. Each stage's client must work against the previous `Code.gs`.

| Stage | `Code.gs` change | Owner steps, in this order | Client merge |
|---|---|---|---|
| a | none | none | any time |
| spike | yes | section 9, steps 1 to 7 | none |
| b | yes | 1. Keep `oauthScopes` pinned (current scopes plus `calendar.readonly`). 2. Paste `Code.gs`, save. 3. Deploy, Manage deployments, pencil, New version. 4. Open `/exec?settings=1` and `/exec?calendar=1`, check both return JSON. 5. Run `syncStravaActivities` by hand. | **after** step 4. Before it, Calendar shows no Google row data and the picker shows its error, which is acceptable, but nothing should be merged that expects the endpoints |
| c | yes | 1. Change `calendar.readonly` to `https://www.googleapis.com/auth/calendar` in `oauthScopes`. 2. Paste `Code.gs`, save. 3. New version. 4. Re-authorise. 5. Open `/exec?plan=1` and check the `gcal` field appears. 6. Run `syncStravaActivities` by hand. 7. C13. | **after** step 5. An old `Code.gs` ignores write-back silently and returns no `gcal`, so no mark would show; that is safe but untested |

Rollback: redeploy the previous version from Manage deployments; narrow the scope back.

---

## 14. Test plan and fixtures

All tests follow `tests/`: `npm test`, `node --test`, Playwright Chromium, the real `index.html` served by `serveApp()` with only `TRAINING_LOG_WRITE_URL` blanked, a pinned clock, seeded `localStorage`, and `routes` for Sheet reads. **`routes` matches the exact query string** (`tests/lib/app.js` 88 to 93), so a mocked `?calendar=1&from=…&to=…` must use the exact dates the pinned clock produces, in that parameter order. No test hook in the shipped file. Prove each new suite can fail: break one fact on purpose, see it go red, restore it.

### 14.1 Fixture F1 (clock Tue 24 Nov 2026, 10:00 local)

This corrects the mocks' sample data.

**Plan** (each with an id, `phase: 'build1'`):

| Date | Disc | Title | Min | Key |
|---|---|---|---|---|
| Mon 23 Nov | swim | Squad | 60 | |
| Mon 23 Nov | strength | Gym A | 30 | |
| Tue 24 Nov | run | Easy run | 45 | |
| Tue 24 Nov | bike | Turbo | 60 | |
| Wed 25 Nov | swim | Technique | 60 | |
| Fri 27 Nov | run | Run intervals | 50 | yes |
| Sat 28 Nov | bike | Long ride | 120 | |

Planned total 425 min = **7h05** (the mock said 6h25).

**Log:**

| Date | Disc | Duration | a2 | Scores as |
|---|---|---|---|---|
| Mon 23 | swim | 60 | planned | As planned (bucket parity: `planDurationBucket(60)` is `'60'`) |
| Tue 24 | run | 30 | short | Adjusted |
| Tue 24 | swim | 30 | planned | Unplanned (no planned swim on Tue) |

Logged total 120 min = **2h00**. Chips: Mon 60m, Tue 60m. The mock's "73 min", "28 min" and "2h13" cannot occur: logged duration is always a bucket (30, 60 or 120). The mock's unplanned Tue bike would have **matched** the planned Tue bike (greedy by date and discipline), so it is a swim here.

**Phases:** `{from: '2026-11-02', phase: 'build1'}`, `{from: '2026-11-30', phase: 'build2'}`.

**Races:** locked "Sample race" on Sat 20 Mar 2027 (116 days: "16 weeks · 4 days to go"); considering "Sample sprint" on Sun 6 Dec 2026. The mock put the race on Sat 28 Nov with a 16-week countdown, and the long ride on race day; neither happens here.

**Google events** (stage b): Wed 25 12:30 to 13:30 "Team lunch"; Fri 27 08:00 to 08:45 "Dentist"; Thu 26 all-day `<img src=x onerror=alert(1)>`.

### 14.2 Fixture F2 (empty state)

Clock Tue 24 Nov. No plan, no Google settings. Log: Mon 23 run 60. See Q3 for the word this card shows.

### 14.3 Fixture F3 (Monday gap)

Clock Mon 30 Nov 2026, 10:00. Plan: Sun 22 Nov run 60, Sat 28 Nov bike 120, Sun 29 Nov run 60. Log: Sat 28 bike 120. Variants: add a Sun 29 swim (row stays), then a Sun 29 run (row goes).

### 14.4 Per stage

- **Stage a:** new `tests/calendar-ui.test.js` (A1 to A25). Update the three existing suites:
  - `tests/syntax.test.js`: remove the stale `.splash` row from `HIDEABLE`; add a row for each new component hidden with `.hidden`. The `isFlow` check picks up `isCalendar`/`isGcal` on its own. The phase-colour check keeps passing because the `.race-cal-*` classes and legend `cls:` strings move with the grid.
  - `tests/race-calendar-ui.test.js`: retarget every existing assertion to Calendar Month (open via `#tab-flow`, then Month). Keep all seven, including "no phase links inside `.race-cal`". Add A21. Rename the file if wanted; do not drop an assertion.
  - `tests/phase-plan-sync.test.js`: the two checks at 72 to 77 and 112 to 117 use "picker hidden after tapping `#tab-flow`" to prove a phase resolved. After this change the picker is hidden after that tap whatever the phase, so they would pass vacuously. Retarget each to tap `#tab-flow`, then "Log an unplanned session", then assert the picker is hidden. Add the counter-case (empty `phasePlan`: the picker shows) so the check discriminates. Mutation proof: force `state.periodisation` to null and confirm both fail.
- **Stage b:** new `tests/code-gs-*.test.js`, which load `apps-script/Code.gs` in a Node `vm` with small stubs for `SpreadsheetApp`, `CalendarApp`, `LockService`, `ContentService`, `Session`, `Utilities`. This is new ground for the repo (no test touches `Code.gs` today); it runs under `node --test` and needs no new dependency. Plus cal-ui cases B8 to B14.
- **Stage c:** code-gs cases C1 to C8, C11, C12; cal-ui C9, C10; owner checks C13, C14.

---

## 15. Source-of-truth reconciliation (`CLAUDE.md`, `style-guide.md`)

### 15.1 Contradictions found between the code and the documents

| # | Finding |
|---|---|
| F1 | The fourth nav tab is labelled **"Review"** in `index.html` (723). `CLAUDE.md`'s navigation table and `style-guide.md`'s layout section call it "This week". |
| F2 | `CLAUDE.md`'s target schema comments say `b2` is the fuelling question; the same file's check-in table, and the code, say fuelling is `a3`. |
| F3 | `CLAUDE.md` decision 40 says Month's phase pill reads `state.periodisation`. `monthWeeks()` (1625 to 1637) reads the phases stamped on logged sessions first, then the week's plan rows, then `state.periodisation`. Races and this spec read `phasePlan`. So Review's Month and Calendar can show different phases for the same week. Not fixed here; P1 picks `phasePlan` for Calendar. |
| F4 | `refreshVisibleViewFromSheet()`'s comment (5497 to 5498) says This week and Month show a phase from `resolvePhaseForDate`; they don't (see F3). |
| F5 | `Code.gs`'s header (52) lists Plan actions without `update`; its setup notes (18, 29) name `Tri-momentum-log-v9.html`, which no longer exists. |
| F6 | `CLAUDE.md` "Current implementation" calls Strava a disposable precursor and TM-004 (backlog) treats it differently. Noted only, as instructed; not resolved. |

### 15.2 Standing decisions this spec reverses, with proposed replacement wording

The Implementer updates `CLAUDE.md` in the same change as each stage, as a new decision entry plus edits to the sections named.

| Reversed | Proposed wording |
|---|---|
| Decision 15 and the "Splash" section: "The app opens on a splash screen." | "The app opens on the Calendar, which is also the first screen of Check-in. The splash was retired by decision 50; its race countdown became the Calendar's race strip and its Today card folded into the week." |
| Decisions 29, 34, 36, 37 (splash Today card, Earlier this week, Monday reach-back) | "Superseded by decision 50. Today's sessions, logged-or-open status and past open sessions now show as cards on the Calendar week, from the same `planDayResults()`/`dayPlanSplit()` source. The Monday gap is a 'Still to log' row." |
| Decision 32 (Check-in opens on the 'Which session?' landing) | "Superseded by decision 50. Check-in opens on the Calendar. 'Check in on this' sits on each open card and 'Log an unplanned session' under each day. A half-finished check-in shows a resume bar. Decision 32's rule that a half-finished check-in is never silently discarded still holds." |
| Navigation section: "Tapping Check-in with no phase set routes to the phase picker first." | "Calendar never needs a phase. The phase picker gates the start of a check-in instead, then lands on the action that was tapped." |
| Decision 31 (Review's 'This week's plan' list) | "Removed by decision 50; the Calendar week is the plan listing now. Review keeps its signals and 'Edit plan →'." |
| Decisions 41, 42, 46, 47 (Races month grid and per-week phase editing) | "The month grid and per-week phase editing moved to Calendar → Month (decision 50). Races keeps its hero, form and lists." |
| "What not to build" | Add: "Write-back (decision 50, stage c) copies the athlete's own planned sessions to one Google calendar they chose. It is a copy, like the Plan tab itself; it never authors, suggests or moves a session." |
| Storage & sync | Add the `Settings` tab (stage b), `?calendar=1` (stage b) and the Plan `Gcal*` columns (stage c), with the deploy gate for each. |
| `style-guide.md` layout line on the nav | "Month and Plan are full views reached by links in Review" (fixing F1's naming), plus the new Calendar patterns (chips, status card, Google block, resume bar, race strip) with measured contrast. |

### 15.3 Main-thread edits (not the Implementer's)

- `.claude/skills/verify/SKILL.md` in the app repo: `cody.md` forbids the Implementer editing it. If a verify recipe is saved after `mc-verifier` runs, the main thread does it. (None exists today.)
- `appsscript.json` and every redeploy: the owner, in the Apps Script editor.
- Notion: leave the "review openathlete" row Pending; note F6 against TM-004.

---

## 16. Pre-existing issues, not fixed here (separate items)

1. Nav label text fails contrast.
2. The default focus ring is invisible on the nav.
3. `--dash-mid` fails 3:1 as a UI colour (and `--dash-good`/`--dash-mid` fail 4.5:1 as text). The Calendar strip reuses `--dash-mid`; the word beside it carries the meaning.
4. The `/exec` URL is public and the web app accepts reads and writes from anyone, including `deleteWeek` and Phases `replaceAll`. Stages b and c inherit this (section 11).
5. Plan, race and session strings are written to the Sheet without formula protection.
6. A plan item added while offline exists only locally, and the next successful `?plan=1` read replaces it away.
7. `submitSessionToSheet()` and `submitRaceToSheet()` lack a `.catch` (decision 28).
8. The `splashTodayName()` em-dash collision (decision 34), now on Calendar cards (nice-to-have in stage a).

---

## 17. Risks and unverified items

| # | Risk or unverified item | How it is tested |
|---|---|---|
| R1 | `phase-plan-sync` tests go vacuous once Check-in stops gating on phase. | 14.4 retarget plus mutation proof |
| R2 | A new view missing from the `isFlow` chain renders the flow underneath. | `syntax.test.js` isFlow check |
| R3 | A new hideable component without a `[hidden]` rule stays visible. | `HIDEABLE` row per component |
| R4 | A second "is it logged" rule creeps in (resume, Still to log, CTA). | A8, A14 variants (a swim logged on a run day) |
| R5 | `a1` gets pre-filled through the new entry points. | A9, A10 |
| R6 | Seven chips at 320px fall under 44px. | A22 |
| R7 | Hand-typed race date makes the strip print "NaN weeks". | A6 |
| R8 | Calendar calls inside the document lock time out other writers. | C4 under a slow stub; code review |
| R9 | A failed event delete leaves an orphan event with no visible mark. | Logged with plan id; owner checks C13 |
| R10 | Pinning scopes breaks Strava or the trigger quietly. | Spike step 5, B15, C14 |
| R11 | `/exec` does not stay on the deployed version after a save. | Spike step 6 |
| R12 | Time-zone trap: all-day or zone-less events land a day out. | Spike step 7, C8 |
| R13 | Copying several weeks forward hits Calendar throttling beyond the documented 5,000 a day. | C13, per-row failure recording |
| R14 | Changing the write calendar later leaves old events in a calendar that may now be read (echoes). | Q4 |
| R15 | Strangers read or write the owner's calendar through the public URL. | Q1, section 11 |

---

## 18. Open questions (could not be closed from the material)

- **Q1 (blocks stage b). How are the calendar features gated against strangers?** The public `/exec` URL means anyone can read every calendar and rewrite Settings (section 11). Options: (a) accept it, with names withheld and fields minimised; (b) a passphrase stored in Script Properties, typed once per device and kept in that device's `localStorage` (never in the repo), sent with calendar reads and Settings writes; it cannot stop someone holding the device, and as a query parameter it can show up in browser history and Google's logs; (c) an allowlist of readable and writable calendar ids kept in Script Properties, edited only in the Apps Script editor, so the in-app picker can only choose inside it; (d) busy blocks only, no titles. Under each answer: the picker's checkboxes list (a) every calendar, (b) every calendar after the passphrase, (c) only allowlisted calendars, (d) every calendar; the Week blocks show titles in (a), (b), (c) and "Busy" in (d); the write radios in stage c follow the same list.
- **Q2. A check-in is in progress and the athlete taps another "Check in on this" or "Log an unplanned session".** The hard rule is no silent discard (A13). Offer an inline choice ("Resume" / "Discard and start this one"), or disable new starts until resumed or discarded? Under the first, both CTAs and the unplanned button stay live and show the choice; under the second, they show as unavailable with a reason and the resume bar gains a "Discard" action.
- **Q3. Logged sessions in a week with no plan at all.** `planDayResults()` makes every one an `extra`, so the F2 card reads "Unplanned" for an athlete who never plans. Review avoids this with its Stage A/B switch (`daysHavePlan()`, decision 30). Recommended: in a week with no planned sessions, logged cards show "Logged" with no strip word; once any plan row exists in the week, the six words apply.
- **Q4. Echoes after the write calendar changes.** The read leaves out the *current* write calendar only. Old events stay in the old one, which may be read. Also hide events carrying the script's tag from every read (the owner's fallback, used as a second guard), or accept the edge?
- **Q5. Copy.** Today's still-open session reads "Not due yet" (that is what `planDayResults()` says for today). Keep, or use "To log" for today only, as the mock did? And logged minutes are bucket values (30, 60, 120); keep the plain "60m", or mark them as approximate?

---

## Handoff note

- **Established:** a three-stage spec. Stage a is a read-only Calendar on existing data with every fold done and no `Code.gs` change. Stage b adds the Google read, the Settings tab and the picker on `calendar.readonly`. Stage c adds write-back on full `calendar`. The data contracts, the per-key empty-response rule and the deploy gates are fixed.
- **Needs attention most:** Q1. The public `/exec` URL makes the Settings read list a preference, not a security bound, so stage b cannot ship until the owner picks a gate.
- **Biggest risk area:** the Check-in rewiring (phase gate, landing retirement, resume bar, decision 19). Also two existing `phase-plan-sync` checks that would pass vacuously unless retargeted.
- **Do not relitigate:** owner decisions 1 to 10 and this session's confirmations: Option A, no sixth tab, the six Adherence words, read-exclusion for echoes, "Create a new TRI Momentum calendar" as the default, the Settings tab, the staging.
- **Still open:** Q1 to Q5, and the spike's answers on version pinning, the Advanced service, time zones and Strava after the scope pin.
