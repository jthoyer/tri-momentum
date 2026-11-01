# Supabase: owner runbook

This is what you, the owner, do by hand to move TRI Momentum from the Google Sheet to Supabase. Nothing in this repo applies anything for you: the SQL is pasted in the dashboard, the settings are dashboard clicks, and the app reads the project only after you sign in.

Project: `ghfvmsyxfovwaeeuzlzn` (dashboard: <https://supabase.com/dashboard/project/ghfvmsyxfovwaeeuzlzn>). App: <https://jthoyer.github.io/tri-momentum/>.

**Order matters.** Merging the cutover pull request is the release (GitHub Pages serves `main`). Do steps 1 to 9 first. Between the merge and step 13 the app runs on this device only, by design.

What you must never do: put the **secret** key (`sb_secret_…`) or any `service_role` key in the repo, a chat or `index.html`. Only the **publishable** key (`sb_publishable_…`) goes in the app. It is public by design; row-level security in the database is what protects the data.

## What the database holds

Six tables in `public`, from `migrations/` (apply in filename order):

| File | Table | Holds |
|---|---|---|
| `20261101000100_allowed_users.sql` | `allowed_users` | The allow-list. One row per Google account that may use the data. |
| `20261101000200_session_checkins.sql` | `session_checkins` | The check-in log. |
| `20261101000300_races.sql` | `races` | The race calendar. |
| `20261101000400_plan_sessions.sql` | `plan_sessions` | The training plan. |
| `20261101000500_phase_blocks.sql` | `phase_blocks` | The dated phase plan. |
| `20261101000600_sheet_import.sql` | `sheet_import` | A marker: "this account's Sheet history has been imported". |

Row-level security is on for all of them. A signed-in user sees and writes only their own rows, and only if their user id is in `allowed_users`. Grants are the least the app needs:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `allowed_users` | yes | no | no | no |
| `session_checkins` | yes | yes | no | no |
| `races` | yes | yes | no | yes |
| `plan_sessions` | yes | yes | `disc, title, intensity, duration, is_key, notes, phase` only | yes |
| `phase_blocks` | yes | yes | `from_date, phase` only | yes |
| `sheet_import` | yes | yes | no | no |

So no path in the app can edit or delete a logged session. If you need to, do it in the SQL editor. The plan date cannot be changed by the app: delete and re-add.

## Before you merge

1. **Apply the migrations.** Dashboard, SQL editor. Open each file in `supabase/migrations/` in filename order, paste it as **plain text** (Cmd+Shift+V; a normal paste can mangle it), run it, and confirm it says success before the next one. Each file runs in its own transaction, so a failure leaves no half-applied table. If a paste looks wrong (missing lines, text out of order), open a new empty tab and paste again, or run the file in two parts.
2. **Check what you applied.** Paste `supabase/checks/verify.sql` and run it (it only reads). Expect:
   - Part 1: `rls_enabled = true` for every table. Any `false` is a stop.
   - Part 2: the `anon` column `false` everywhere. `authenticated` true only where the table above says yes. `TRUNCATE`, `REFERENCES` and `TRIGGER` false for both.
   - Part 3: exactly the columns named in the comment above it (`plan_sessions`: `disc, title, intensity, duration, is_key, notes, phase`, not `plan_date`; `phase_blocks`: `from_date, phase`).
   - Part 4: every data-table policy mentions `allowed_users`, and every policy is for `authenticated` only.
   - Part 5: no rows.

   Then dashboard **Advisors** (Security): read every finding. Anything about RLS or a table exposed to `anon` on these six tables is a stop. (A leaked-password or MFA hint is not about this change.)
3. **Settings, Data API:** confirm `public` is an exposed schema. If you do not use GraphQL, turn the `pg_graphql` extension off (Database, Extensions), so there is one fewer way in.
4. **Google Cloud Console, OAuth consent screen:** User type **External**, publishing status **Testing**, and add your own Google account as the **only** test user. Default scopes (openid, email, profile) are fine. While it is in Testing, only that account can complete a Google sign-in at all: that is the second of three layers (the first is RLS, the third is step 12).
5. **Google Cloud Console, Credentials, Create OAuth client ID, Web application:**
   - Authorized JavaScript origin: `https://jthoyer.github.io`
   - Authorized redirect URI: `https://ghfvmsyxfovwaeeuzlzn.supabase.co/auth/v1/callback`
6. **Supabase, Authentication, Sign In / Providers:**
   - **Google:** enable it and paste the client ID and secret from step 5. The secret stays in the dashboard.
   - **Email:** disable it.
   - **Phone:** disable it.
   - **Anonymous sign-ins:** make sure they are off.
7. **Authentication, URL Configuration:**
   - Site URL: `https://jthoyer.github.io/tri-momentum/`
   - Redirect URLs: exactly `https://jthoyer.github.io/tri-momentum/`. No wildcards, nothing else. (The app always asks for that URL, not whatever page you are on; if the dashboard does not list it, Supabase falls back to the Site URL.)
8. **Settings, API Keys:** copy the **publishable** key (`sb_publishable_…`) into the marked constant `SUPABASE_PUBLISHABLE_KEY` in `index.html` on the pull request branch. Never the secret key. `npm test` fails if the committed key starts with `sb_secret_` or decodes to a `service_role` JWT.
9. **Close or reload TRI Momentum on every other device**, so a stale tab cannot keep an old copy of the app around across the cutover.
10. **Decide the shared-origin question (R6) before merging.** `jthoyer.github.io` is shared by every GitHub Pages site under this account. Any page served from that origin, and any cross-site-scripting hole in `index.html`, can read the Supabase session from `localStorage`. That session is now a credential, not just a cache. The pull request records this as an accepted limitation, on two conditions that this runbook makes true: the Apps Script write hole is closed (step 14), and nobody else can sign up (step 12). The real fix is a dedicated origin (a custom domain); that is not part of this change. If you do not accept it, do not merge.

**Merge the pull request. This is the release.**

## After you merge

11. Open the live app, tap **Sign in with Google**, and complete it. Expect "This Google account isn’t set up for TRI Momentum." at this point: that is the allow-list working.
12. **Supabase, Authentication, Users:** copy your user id (UID). In the SQL editor run the allow-list insert, with your UID in place of the placeholder:

    ```sql
    insert into public.allowed_users (user_id, note)
    values ('<UID copied from Authentication > Users>', 'owner');
    ```

    **In the same sitting, turn off "Allow new users to sign up"** (Authentication, Sign In / Providers). This is not optional: it is the third layer. With it on, anyone who got past Google could create an account (they would still see nothing, because they are not on the allow-list, but you should not rely on one layer).
13. Reload the app. The splash now says "Bring your history across from the Google Sheet." Tap **Import from Sheet**.
    - The dialog shows, for sessions, races, planned sessions and phase blocks, how many rows it found and how many it will skip and why. **Compare each number with the matching tab of your Sheet** (rows, not counting the header row). Sessions with an empty date are not counted by the Sheet script itself, so a blank row can make the Sheet look one longer. Nothing is written until you confirm.
    - Confirm. Read the report ("Imported 214 sessions · 6 races · …"). If it says "Import stopped at …", nothing is lost: run it again. It is safe to repeat.
14. **Close the Apps Script write hole.** The Apps Script web-app URL is public (it is in the old `index.html`), and its `doPost` has no authentication: anyone with the URL can write to the Sheet. Apps Script, **Deploy, Manage deployments, Archive** the web-app deployment, and any older deployments in that list. The Sheet stays as a read-only backup that you can open yourself. The **Strava time trigger keeps running**: a trigger is not a deployment. (Archiving does end the Strava authorisation redirect, which is pinned to that URL; you only need that if you ever re-authorise Strava.) There is nothing to redeploy: `Code.gs` changed only in comments.
15. **Smoke test.**
    - This week shows your history.
    - Sign in on a second device (it works for your account only) and confirm the same data appears.
    - Add a dummy race on one device, see it on the other, then delete it.
    - Log the next real session and confirm it shows on the other device.
16. Run the Supabase **Advisors** (Security) once more, now that the app is in use, and read what it says.

## If you need to run the import again

The in-app import is offered only while your account has no `sheet_import` row. To run it again, delete that row in the dashboard (Table Editor, `sheet_import`, your row), reload, and import. The consequences:

- **Sessions are never duplicated.** Each session id is derived from the row's own content, so the same Sheet row always gets the same id. Two genuinely identical rows stay two rows.
- A session whose Sheet row you **edited** in the meantime has a different content, so it is imported as a new session next to the old one.
- A race, plan or phase row you **deleted** in Supabase after the first import is created again, because it is still in the Sheet.

## What is checked, and what is not

The repo checks the migrations on a throwaway PostgreSQL 16 cluster (`supabase/tests/run.sh`), the app against a stateful mock of Supabase (`npm test`), and that the SQL harness itself can fail (`supabase/tests/mutate.sh`). None of that touches your project. It has **not** been run against the live project, so these are yours to see with your own eyes in the steps above: the real Google sign-in round trip, the dashboard settings, the migrations on the live project, and PostgREST's real behaviour (ignore-duplicates, the 1,000-row page cap, whether an unfiltered delete is refused, how the publishable key is handled).

## Known follow-ups (not part of this change)

- **Default EXECUTE on functions.** Supabase lets `anon` call any new function in `public` by default. There are no functions yet. Before the Garmin step adds the first one, revoke that default (`alter default privileges … revoke execute on functions from anon, authenticated, public`) and add a check for it to `supabase/tests/`.
- **Strava sync.** It only fills rows that already exist in the Sheet, so sessions logged after the cutover get no objective data until the Garmin step builds it on Supabase. The Strava OAuth callback in `Code.gs` has no `state` check.
- **Length limits.** The text and `jsonb` columns have no length check.
- **A dedicated origin** for the app (see step 10).
