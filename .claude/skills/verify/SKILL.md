---
name: verify
description: How to run and drive the TRI Momentum app (static index.html, Playwright over a local http server) to check a change in the real app. Use after changing index.html, the Calendar, Check-in, Plan or Review.
---

# Verify TRI Momentum

The app is one static `index.html`. There is no build step. Tests run with `npm test` (node --test, Playwright, pre-installed Chromium).

## Run the suite
```bash
cd /home/user/tri-momentum && npm ci && npm test
```
Use `npm test`, not `node --test --trace off`: node reads `--trace off` as a V8 flag and floods the output.

## Drive the real app
Write a script that requires `tests/lib/app.js` and the repo's `playwright`.
- `serveApp({routes})` serves the repo root over http on an ephemeral port with `TRAINING_LOG_WRITE_URL` blanked, so a live Sheet cannot overwrite seeded data. `routes` maps an exact query string (for example `plan=1`, `list=1`, `races=1`, `phases=1`) to a JSON body.
- Launch with `chromium.launch({executablePath: chromiumPath()})`.
- Set `TRI_INDEX_PATH=<scratch copy of index.html>` **before** requiring `tests/lib/app.js` to serve a different copy (for example the pre-change commit, or a mutated copy). Setting it afterwards silently serves the real file.

## Seed
`require('tests/lib/calendar-fixtures.js')` gives `KEYS`, `F1`, `F2`, `F3`.
1. `browser.newContext({timezoneId:'Australia/Sydney', viewport:{width:390 or 320, height:900}})`
2. `page.clock.setFixedTime(new Date(fx.now))`
3. `addInitScript` that writes `JSON.stringify(fx[k])` to `KEYS[k]` once, guarded by a `__seeded` flag so reloads keep the app's own writes.
4. `page.goto(origin)`, then wait for `#calendar-h`.

## What to check
- Calendar: `.cal-summary`, `.cal-card` with `.cal-card-word`, `.cal-card-cta`, `.cal-unplanned`, `.cal-chip[data-date]`, tabs `#cal-tab-week` and `#cal-tab-month`, resume bar `.cal-resume` (`.cal-resume-go`, `.cal-resume-discard`).
- Phase picker `#view-period`; flow `#view-flow`.
- Radio inputs sit on top of their labels: click the input (`#view-flow input[name="o-q-b3"]`), not the label.
- After an answer wait about 650 ms for the auto-advance. `#btn-next` reads "Save" on the review page.
- Background refresh: dispatch `document.dispatchEvent(new Event('visibilitychange'))` after changing a route body.
- Midnight: call `page.clock.setFixedTime(<next day>)` again with no reload, then tap `#tab-dash` and `#tab-flow`.
- Widths 390 and 320. `a1`, `a2`, `a3`, `b2`, `b3` and `rpe` must read "Not answered" after any plan pre-fill.

## Traps
- A `fullPage` screenshot shows the fixed nav bar mid-image. That is an artefact.
- Playwright's `locator(':visible').click()` on the Plan view's Edit/Remove buttons can time out; `page.$eval(sel, b => b.click())` works.
- The old (pre-Calendar) build has no `#calendar-h`; use `#view-splash` as the wait target there.
