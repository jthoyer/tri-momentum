# Supabase: owner runbook

This is what you, the owner, do by hand to move TRI Momentum from the Google Sheet to a new Supabase project. Nothing in this repo applies anything for you: the SQL is pasted in the dashboard, the settings are dashboard clicks, and the app talks to the project only after you sign in.

Placeholders used below, never filled in by this repo: `<project-ref>` (the 20-character reference in your project's address, `https://<project-ref>.supabase.co`) and `<your-publishable-key>` (the project's publishable key). Your dashboard is at `https://supabase.com/dashboard/project/<project-ref>`. The app is at `https://jthoyer.github.io/tri-momentum/`.

**Order matters.** Merging the cutover pull request is the release (GitHub Pages serves `main`). Do steps 1 to 10 first. Between the merge and step 14 the app runs on this device only, by design.

What you must never do: put the **secret key**, any `service_role` key, a Google OAuth client secret or a Supabase personal access token in the repo, a chat or `index.html`. Only the **publishable** key goes in the app. It is public by design; row-level security in the database is what protects the data. `npm test` fails the build if any of those, or the address of an Apps Script deployment, appears in a tracked file.

## What the database holds

Eight tables in `public`, from `migrations/` (apply in filename order):

| File | Table | Holds |
|---|---|---|
| `20261101000100_allowed_users.sql` | `allowed_users` | The allow-list. One row per Google account that may use the data. |
| `20261101000200_session_checkins.sql` | `session_checkins` | The check-in log. |
| `20261101000300_races.sql` | `races` | The race calendar. |
| `20261101000400_plan_sessions.sql` | `plan_sessions` | The training plan. |
| `20261101000500_phase_blocks.sql` | `phase_blocks` | The dated phase plan. |
| `20261101000600_sheet_import.sql` | `sheet_import` | A marker: "this account's Sheet history has been imported". |
| `20261126000100_activities.sql` | `activities` | Synced activities (Garmin, Strava), written by the TM-014 writer, never by the app. |
| `20261126000200_analysis.sql` | `analysis` | One weekly analysis row per week, written by the TM-014 writer, never by the app. |

Row-level security is on for all of them. A signed-in user sees and writes only their own rows, and only if their user id is in `allowed_users`. Grants are the least the app needs:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `allowed_users` | yes | no | no | no |
| `session_checkins` | yes | yes | no | no |
| `races` | yes | yes | no | yes |
| `plan_sessions` | yes | yes | `disc, title, intensity, duration, is_key, notes, phase` only | yes |
| `phase_blocks` | yes | yes | `from_date, phase` only | yes |
| `sheet_import` | yes | yes | no | no |
| `activities` | yes | no | no | no |
| `analysis` | yes | no | no | no |

`anon` has nothing on any table. No path in the app can edit or delete a logged session; if you need to, do it in the SQL editor. The plan date cannot be changed by the app: delete and re-add.

## Before you merge

1. **Create the project and apply the migrations.** Dashboard, New project. The free plan is what this runbook assumes. A free project is **paused after about 7 days without activity**; the repo's keep-alive workflow (`.github/workflows/keep-alive.yml`) pings it every 3 days. It reads two **repository variables** (GitHub, Settings, Secrets and variables, Actions, Variables): `SUPABASE_URL` (the project address, `https://<project-ref>.supabase.co`, no trailing slash) and `SUPABASE_KEY` (the publishable key; a repository secret of that name also works). Set both now. Know the limit: **GitHub disables scheduled workflows after 60 days without repository activity**, so if you stop committing, re-enable the workflow in the Actions tab, or the project can pause. A paused project makes the app fall back to this device only, and new check-ins wait in the outbox until it is back.

   Then SQL editor: open each of the **eight** files in `supabase/migrations/` in filename order, paste each as **plain text** (Cmd+Shift+V; a normal paste can mangle it), run it, and confirm it says success before the next one. Each file runs in its own transaction, so a failure leaves no half-applied table. If a paste looks wrong (missing lines, text out of order), open a new empty tab and paste again, or run the file in two parts.
2. **Check what you applied.** Paste `supabase/checks/verify.sql` and run it (it only reads). Expect:
   - Part 1: `rls_enabled = true` for every one of the eight tables. Any `false` is a stop.
   - Part 2: the `anon` column `false` everywhere. `authenticated` true only where the grant table above says yes (`SELECT` only for `activities` and `analysis`). `TRUNCATE`, `REFERENCES` and `TRIGGER` false for both.
   - Part 3: exactly the columns named in the comment above it (`plan_sessions`: `disc, title, intensity, duration, is_key, notes, phase`, not `plan_date`; `phase_blocks`: `from_date, phase`).
   - Part 4: every data-table policy mentions `allowed_users`, and every policy is for `authenticated` only.
   - Part 5: no rows.

   Then dashboard **Advisors** (Security): read every finding. Anything about RLS or a table exposed to `anon` on these eight tables is a stop. (A leaked-password or MFA hint is not about this change.)
3. **Settings, Data API:** confirm `public` is an exposed schema. If you do not use GraphQL, turn the `pg_graphql` extension off (Database, Extensions), so there is one fewer way in.
4. **Google Cloud Console, OAuth consent screen:** User type **External**, publishing status **Testing**, and add your own Google account as the **only** test user. Default scopes (openid, email, profile) are fine. While it is in Testing, only that account can complete a Google sign-in at all: that is the second of three layers (the first is RLS, the third is step 13).
5. **Google Cloud Console, Credentials, Create OAuth client ID, Web application:**
   - Authorized JavaScript origin: `https://jthoyer.github.io`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
6. **Supabase, Authentication, Sign In / Providers:**
   - **Google:** enable it and paste the client ID and client secret from step 5. The client secret stays in the dashboard.
   - **Email:** disable it.
   - **Phone:** disable it.
   - **Anonymous sign-ins:** make sure they are off.
7. **Authentication, URL Configuration:**
   - Site URL: `https://jthoyer.github.io/tri-momentum/`
   - Redirect URLs: exactly `https://jthoyer.github.io/tri-momentum/`. No wildcards, nothing else. (The app always asks for that URL, not whatever page you are on; if the dashboard does not list it, Supabase falls back to the Site URL.)
8. **Put the project in the app.** In `index.html` on the pull request branch, find the two marked constants and fill them in: `SUPABASE_URL` = `https://<project-ref>.supabase.co` and `SUPABASE_PUBLISHABLE_KEY` = `<your-publishable-key>` (Settings, API Keys, the **publishable** key). Never the secret key or a `service_role` key. `npm test` fails if the committed key is a secret key or decodes to a `service_role` JWT, or if the URL is not a 20-character project address. Left blank, the app runs on this device only.
9. **Close or reload TRI Momentum on every other device**, so a stale tab cannot keep an old copy of the app around across the cutover.
10. **Decide the shared-origin question (R6) before merging.** `jthoyer.github.io` is shared by every GitHub Pages site under this account. Any page served from that origin, and any cross-site-scripting hole in `index.html`, can read the Supabase session from `localStorage`. That session is now a credential, not just a cache. The pull request records this as an accepted limitation (recommended default, not yet confirmed by you), on two conditions that this runbook makes true: every Apps Script deployment is archived (step 16) and nobody else can sign up (step 13). The real fix is a dedicated origin (a custom domain); that is not part of this change. If you do not accept it, do not merge.

**Merge the pull request. This is the release.**

## After you merge

11. Open the live app, go to the bottom of the **Calendar**, and tap **Sign in with Google** in the account line. Complete it. Expect "This Google account isn’t set up for TRI Momentum." at this point: that is the allow-list working.
12. **Supabase, Authentication, Users:** copy your user id (UID). In the SQL editor run the allow-list insert, with your UID in place of the placeholder:

    ```sql
    insert into public.allowed_users (user_id, note)
    values ('<UID copied from Authentication > Users>', 'owner');
    ```
13. **In the same sitting, turn off "Allow new users to sign up"** (Authentication, Sign In / Providers). This is not optional: it is the third layer. With it on, anyone who got past Google could create an account (they would still see nothing, because they are not on the allow-list, but you should not rely on one layer).
14. **Import.** Reload the app. The account line now says "Bring your history across from the Google Sheet." Tap **Import from Sheet**. Do this on the device that holds your phase plan: the phase plan lives only in the browser of the device where you edited it.
    - **The address prompt.** The dialog asks for the Google Sheet address. The Sheet field is optional: leave it empty to bring across only what is on this device. To get the current address, open the Apps Script project, **Deploy, Manage deployments**, and copy the web-app address that ends in `/exec`. It must be the address of the deployment that holds your data (the owner has more than one live; if a deployment answers with unrelated or empty data, try another). The address is held in memory only while the dialog is open: it is never saved, written to this repo, or shown in a message. Tap **Read**.
    - **What the counts mean.** For sessions, races, planned sessions and phase blocks the preview shows, as they apply: how many were found in the Sheet, how many on this device, how many are **already in your account**, how many are **new** (what Import will add), how many are **skipped** and why (for example a bad date), and how many **differ** (same id, different content; the Sheet's version is kept and the device's row is not written). **Compare each Sheet number with the matching tab of your Sheet** (rows, not counting the header row). Sessions with an empty date are not counted by the Sheet script itself, so a blank row can make the Sheet look one longer. If the Sheet has no phase tab, the dialog says so and uses this device's phase plan. Nothing is written until you tap **Import**.
    - Confirm. Read the report. If it says the import stopped partway, nothing is lost: run it again. It is safe to repeat.
15. **Second device: the device choice.** Open the app on your other device and sign in. If that device holds rows your account does not have yet (a check-in, a race, a plan or phase edit made before the cutover), no cache on it is replaced until you choose. The account line says so and a dialog opens with only "this device" as the source, with three choices:
    - **Add to my account:** writes the rows the account lacks (nothing is duplicated).
    - **Discard:** keeps the account as it is. It deletes nothing on the device; the next read simply replaces the cache.
    - **Not now:** decide later; the account line keeps a **Review data on this device** button. Until you choose, the device's caches are not replaced.

    A device that holds nothing new sets its own flag silently and is never asked.
16. **Archive every Apps Script deployment.** The Apps Script web-app address is public in this repo's git history, and its `doPost` has no authentication: anyone with an address can write to the Sheet, and the old script also exposes calendar counts. Open the project, **Deploy, Manage deployments**, and **Archive every web-app deployment** in that list (you have at least three live from 26 Nov). Write nothing about them down. The Sheet stays as a read-only backup that you can open yourself. The **Strava time trigger keeps running**: a trigger is not a deployment. (Archiving ends the Strava authorisation redirect, which is pinned to a deployment address; you only need that if you ever re-authorise Strava.) There is nothing to redeploy, ever: the app no longer calls Apps Script, and `Code.gs` changed only in comments.
17. **Smoke test on a second device.**
    - The Calendar and This week show your history.
    - Add a dummy race on one device, see it on the other, then delete it.
    - Log the next real session and confirm it shows on the other device.
18. Run the Supabase **Advisors** (Security) once more, now that the app is in use, and read what it says.

## If you need to run the import again

The in-app Sheet import is offered only while your account has no `sheet_import` row. To run it again, delete that row in the dashboard (Table Editor, `sheet_import`, your row), reload, and import. The consequences:

- **Sessions are never duplicated.** Each session id is derived from the row's own content (the same normalisation for a Sheet row and a device entry), so the same session always gets the same id. Two genuinely identical rows stay two rows.
- A session whose Sheet row you **edited** in the meantime has a different content, so it is imported as a new session next to the old one.
- A race, plan or phase row you **deleted** in Supabase after the first import is created again, because it is still in the Sheet or on a device.
- Same id, different content: the Sheet's version is kept and the differing device row is counted and not written.

## For the TM-014 writer (Garmin and Strava sync)

`activities` and `analysis` are written only by the TM-014 writer, through your management access to the project, never by the app: the app can only read them, and only its own rows. So:

- The writer must set `user_id` on every row. There is deliberately no default, because the writer is not a signed-in app user. Use your own user id from Authentication, Users.
- `activities` is unique on `(user_id, source, source_id)`, so a repeated sync cannot duplicate an activity. `analysis` has one row per `(user_id, week_start)` and `week_start` must be a Monday.
- Management access bypasses row-level security; that is the intended path. **Never put the `service_role` key or a personal access token in the repo, in `index.html` or in a workflow file.** Keep them in the writer's own secret store. A repo-wide check in `npm test` fails on either.
- Neither table has a screen in the app yet.

## What is checked, and what is not

The repo checks the migrations on a throwaway PostgreSQL 16 cluster (`supabase/tests/run.sh`; last run: 865 assertions passed, 0 failed), the app against a stateful mock of Supabase (`npm test`), the keep-alive workflow text and its failure paths against a stubbed `curl` (`tests/keep-alive.test.js`), and that the SQL harness itself can fail (`supabase/tests/mutate.sh`, which breaks scratch copies of the migrations one edit at a time and reports whether `run.sh` goes red). A repo-wide scan fails on secret-shaped strings, Apps Script deployment ids and addresses, and the deleted project's reference.

None of that touches your project. It has **not** been run against a live project, so these are yours to see with your own eyes in the steps above, and nothing in the repo can show them to you:

- the real Google sign-in round trip and the dashboard settings;
- the migrations on the live project, and the Advisors;
- PostgREST's real behaviour: ignore-duplicates inserts, what `select` returns after one, the 1,000-row page cap, whether an unfiltered delete is refused, and how the publishable key is handled;
- a real scheduled run of the keep-alive workflow;
- the import against your real Sheet (the preview counts are how you check it).

## Known follow-ups (not part of this change)

- **Default EXECUTE on functions.** Supabase lets `anon` call any new function in `public` by default. There are no functions yet. Before the first one is added, revoke that default (`alter default privileges … revoke execute on functions from anon, authenticated, public`) and add a check for it to `supabase/tests/`.
- **Strava sync.** It keeps writing to the Sheet and nothing reads it, so sessions logged after the cutover get no objective data until the TM-014 work builds it on `activities`. The Strava OAuth callback in `Code.gs` has no `state` check.
- **Length limits.** The text and `jsonb` columns have no length check.
- **A dedicated origin** for the app (see step 10).
- **Keep-alive and inactivity.** GitHub disables scheduled workflows after 60 days of repository inactivity (see step 1).
- **`check_status` and `findings`** in the TM-014 tables are unconstrained until the writer exists.
