# CLAUDE.md — TRI Momentum

> This file is the project north star. Read it at the start of every session before touching any code.
> Update it when architectural decisions change. Never let it go stale.

---

## ⚠️ Two codebases: current app vs. target architecture

This repo contains **two things at once**, and it matters which one a session is touching:

- **Current app (`index.html`, repo root, plus its two Strength sub-apps)** — `index.html` is a single static HTML/CSS/JS file, no build step, no framework, no accounts; the Strength tab is a core part of the same product, implemented as two co-deployed PWAs (`TRI-swim-strength mobile app/`, `TRI-run-strength mobile app/`) embedded via `<iframe>`. This is **what's actually live** at `https://jthoyer.github.io/tri-momentum/` (GitHub Pages serves the repo root directly) and what recent commits have been iterating on (bottom nav, Strength sub-tabs, week numbering, etc.). Treat all three as the real product — the Strength apps are not an optional add-on.
- **Target architecture (`frontend/`, `backend/`, `supabase/`)** — a React + Vite + Hono + Supabase + Stripe scaffold representing where the product is intended to go: accounts, cross-device sync, a phase-aware tip/content system, and a paywall. It has a single "initial commit" and is **not wired up or in active use** — no `supabase-js` installed, no backend server, `Auth.jsx` isn't reachable from the app, nothing persists past `localStorage`.

Both are intentional. Most of this document (Freemium model, Database schema, Auth flow, Stripe, `tips.js` content system) describes the **target**, not what's running today. Sections are labelled accordingly. When in doubt: if it's not described under "Current implementation" below, assume it doesn't exist yet in the shipped app.

---

## What this product is (north star — target)

**TRI Momentum** is a mobile-first progressive web app (PWA) for intermediate age-group triathletes training for Olympic distance and 70.3 Ironman events. It is not a training log. It is a decision-support tool — it helps athletes make better choices about load, recovery, and race preparation across a repeating training block cycle (base → build → peak → recovery).

The target core value loop is:
1. Athlete sets their training start date and race date
2. App resolves their current phase, block week, and emphasis pillar from those dates
3. App surfaces the right thinking prompt for their current position in the training cycle
4. Athlete logs session outcomes and a weekly reflection
5. App tracks readiness, grey-zone training %, and vulnerable sessions over time
6. Trend data surfaces patterns the athlete can't see week-to-week

The product is built for **one primary user type**: a time-pressured age-grouper with 10–15 hours/week of training, strong self-knowledge, and no interest in being hand-held. The tone of the app — including all copy — reflects this.

**Today's shipped app is a narrower, working subset of this vision** — a reactive check-in log with rule-based pattern detection, no accounts and no coaching-prompt content system (see below). It's the direction, not yet the destination.

---

## Current implementation (`index.html`) — what's actually live

Single self-contained HTML file at the repo root, deployed via GitHub Pages with no build step. No framework, no bundler, no npm dependencies.

### Storage & sync
- **The Google Sheet is the source of truth**, so the log reads the same on the phone and the laptop (no accounts, no login). A personal Sheet, written to and read from via a Google Apps Script Web App (`apps-script/Code.gs`).
  - **Write:** every saved session fires a `no-cors` POST — fire-and-forget, opaque response, a failed write never blocks the check-in (the entry still shows locally this session via the optimistic `log.push` in `save()`).
  - **Read:** the app fetches the full log from the Sheet (`GET .../exec?list=1`, normal `cors` mode since the JSON body needs parsing) on load, and again whenever the This week or Month tab is opened, replacing the in-memory log with whatever the Sheet returns.
  - **`localStorage` is a same-device cache only** — it paints the last-known state instantly on load and is what's used if a Sheet fetch fails (offline, blocked request, extension interference, etc). It is not authoritative and is never the reason two devices would disagree.
- No Supabase, no Postgres, no RLS, no server-side persistence of our own.

### Splash
First thing shown on every load — full-bleed `--blue` background, the `favicon.png` logo (no drop shadow), a sub head ("Helping triathletes progress"), and a headline ("Mobility, intensity, fuelling, strength") styled to the page-title spec. The base nav is visible underneath it, same as it is under the training-phase screen. No timer, no auto-advance — it's dismissed only by tapping a nav tab. Tapping **Check-in** from the splash routes to the training-phase picker first if no phase is set yet (see below); tapping any other tab bypasses straight to that view, same as tapping a tab from the phase screen always has.

### Navigation — 4 tabs
| Tab | What it does |
|---|---|
| **Strength** | A core tab, not a content tab — renders two purpose-built strength PWAs via `<iframe>`: `TRI-swim-strength mobile app/` and `TRI-run-strength mobile app/` (each its own `index.html`/`app.js`/`manifest.webmanifest`/service worker). They're separate deployable units for build/versioning reasons, not a bolt-on — they ship in this repo, deploy under the same GitHub Pages site, and are part of the product's core navigation. Sub-tabs: Swim / Ride-Run. |
| **Check-in** | The primary interaction — a stepped, after-session logging wizard ("Just finished", step counter). Not a pre-scheduled calendar; purely reactive logging. |
| **This week** | Weekly dashboard: discipline breakdown grid, phase pills, signal sections (see below), week number. |
| **Month** | Same signal/dashboard machinery as "This week," rolled up by week blocks across the month. |

### Training phase
Asked **once, ever** (not resolved from dates) via a simple picker: `Base / Taper`, `Build 1`, `Build 2`, `Peak`. Changeable later from the dashboard. There is no `training_start_date`, no `race_date`, no `block_config`, and no per-day content resolution — the target's `resolvePosition()`/`phasePosition` system does not exist in this app.

Every other tab (This week, Month, Strength, Warm up) can be reached without ever setting a phase — the bottom nav bypasses the phase screen for those. **Check-in is the exception**: since a logged session is stamped with whatever phase is current, tapping Check-in with no phase set routes to the phase picker first rather than bypassing it, then returns straight to Check-in once a phase is chosen.

### Check-in data model
Each logged session (`log` array in `localStorage`) captures: `date`, `disc` (`swim`|`bike`|`run`|`brick`|`strength`), `duration`, `intensity`, `rpe`, three execution/intent questions (`a1`, `a2`, `a3`), two fuelling-related fields (`b2`, `b3`), a free-text `note`, and the currently-set `phase`. There is no `tips`/`prompt`/`mechanism`/contrast-pair content shown alongside a session — nothing from `tips.js` is used.

### Signals (replaces "weekly reflection")
Instead of a self-reported readiness score + grey-zone %, the app derives **rule-based signals** from logged sessions:
- **Fuelling** and **Intensity drift** categories, each with a severity (`good`/`mid`/`bad`)
- **Compound-pair detection** — e.g. two consecutive over-intent sessions — flagged as a distinct, higher-priority pattern than an isolated one
- Auto-generated plain-language headlines per signal (e.g. "X times this week, a session that ran well over intent was followed by another one running well over intent…")

This is a different mechanism from the target's `readiness`/`grey_zone_pct`/`vuln_session` self-report fields — it's inferred from logged data, not asked directly.

### Design system
Shares the same CSS custom properties as documented below (discipline colours, DM Sans/DM Mono, card/radius conventions) — **this part of the doc is accurate for both current and target.**

### PWA
Manifest is inlined as a `data:` URI in the `<head>` (not a separate `public/manifest.json` + `sw.js` pair as the target architecture specifies).

---

## Target tech stack (not yet implemented)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dev server, clean component model, easy PWA setup |
| Styling | CSS custom properties (no Tailwind) | Design system already established — preserve it exactly |
| Backend | Hono on Node.js | Lightweight, edge-compatible, minimal boilerplate |
| Database | Supabase (Postgres) | Auth + database + row-level security in one. Free tier sufficient for launch. |
| Auth | Supabase Auth | Magic link + Google OAuth. No passwords to manage. |
| Payments | Stripe | Checkout + webhooks. Subscription status written to Supabase. |
| Hosting | Vercel (frontend) + Fly.io (backend) | Both have generous free tiers. Vercel handles PWA edge cases well. |
| Garmin | Unofficial garminconnect Python wrapper OR official OAuth API (future) | Backend-only — never expose credentials client-side |

`frontend/` is scaffolded (components exist: `Today.jsx`, `Week.jsx`, `Tips.jsx`, `Calendar.jsx`, `Onboarding.jsx`, `Auth.jsx`, `Upgrade.jsx`) but not wired: no `supabase-js` dependency, no `frontend/src/lib/supabase.js`, no `frontend/src/hooks/`, `Auth.jsx`'s magic-link form doesn't call any API, and `App.jsx`'s screen state machine never actually routes to it. `backend/` contains only `.env.example`, `.gitignore`, and an unrelated standalone script — no Hono server exists yet.

---

## Repository structure

```
tri-momentum/
├── CLAUDE.md                  ← this file
├── index.html                 ← ★ CURRENT LIVE APP (shell) — static, self-contained, deployed as-is via GH Pages
├── apps-script/
│   └── Code.gs                ← Google Apps Script Web App — receives session POSTs, writes to the athlete's Sheet
├── TRI-swim-strength mobile app/   ← ★ CORE — Strength tab's Swim sub-tab, rendered via iframe in index.html
│   ├── index.html / app.js / styles.css / manifest.webmanifest / sw.js
├── TRI-run-strength mobile app/    ← ★ CORE — Strength tab's Ride/Run sub-tab, same pattern
│
│  ─── target architecture (scaffolded, not yet wired up) ───
│
├── .env.example               ← all required env vars documented here
├── .env.local                 ← never committed
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Today.jsx
│   │   │   ├── Week.jsx
│   │   │   ├── Tips.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Onboarding.jsx
│   │   │   ├── Auth.jsx           ← sign in / sign up / magic link (currently disconnected)
│   │   │   ├── Upgrade.jsx        ← paywall prompt component (currently no-op)
│   │   │   └── shared/
│   │   │       ├── BottomNav.jsx
│   │   │       ├── SessionCard.jsx
│   │   │       └── PhasePill.jsx
│   │   ├── data/
│   │   │   ├── tips.js            ← block-relative tip content (static, see schema below) — unused by current app
│   │   │   ├── raceProximity.js   ← race-proximity overlay content (23 cards, 5 zones) — unused by current app
│   │   │   ├── phases.js          ← PHASES_39 and PILLAR_CYCLE constants
│   │   │   └── insights.js        ← CADENCE_INSIGHTS constant
│   │   ├── hooks/                 ← does not exist yet (useAuth.js, useProfile.js, useReflections.js planned)
│   │   ├── lib/
│   │   │   └── tipResolver.js     ← resolvePosition(), resolveTip(), resolveProximityZone(), canAccessPhase() — written but not called anywhere
│   │   ├── App.jsx                ← localStorage only; auth screen unreachable
│   │   └── main.jsx
│   └── vite.config.js
├── backend/                    ← empty scaffold: .env.example + .gitignore only, no server code
└── supabase/                   ← does not exist yet (no migrations applied, no project schema)
```

---

## Design system — do not deviate

The visual language is established and must be preserved exactly across all new components — **this applies to both the current app and any target-architecture work.** Never introduce Tailwind, Bootstrap, or component libraries that override these tokens.

### Colour tokens (CSS custom properties)

```css
--bg: #F7F8FC;
--s1: #FFFFFF;
--s3: #F0F2F8;
--s4: #E8EBF5;

--ink: #0E1020;
--ink2: #4B5278;
--ink3: #8B93B8;

--bd: rgba(14,16,32,0.08);
--bd2: rgba(14,16,32,0.14);

--blue: #0022FF;    --blue-l: #E8EFFE;   --blue-m: #4F7BE8;

/* Discipline colours */
--swim: #0022FF;   --swim-l: #E8EFFE;
--bike: #0F6E56;   --bike-l: #E1F5EE;
--run:  #993C1D;   --run-l:  #FAECE7;
--brick: #534AB7;  --brick-l: #EEEDFE;
--strength: #854F0B; --strength-l: #FAEEDA;
--rest: #8B93B8;   --rest-l: #F0F2F8;

/* Status colours */
--done: #0F6E56;     --done-l: #E1F5EE;
--skipped: #993C1D;  --skipped-l: #FAECE7;
--modified: #854F0B; --modified-l: #FAEEDA;

/* Phase colours map to discipline colours */
--base: var(--swim);
--build: var(--bike);
--peak: var(--run);
--taper: var(--brick);
```

### Typography

- **Body / UI:** DM Sans (400, 500, 600)
- **Monospace / labels / badges:** DM Mono (400, 500)
- **Page titles:** 23px, weight 600, letter-spacing -0.3px, line-height 1.25 (`h1` in `index.html`)
- **Eyebrows / tags:** DM Mono, 14px, uppercase, letter-spacing 0.1em (`.eyebrow` in `index.html`)
- **Body copy:** 13–15px, color `--ink2`, line-height 1.55–1.65

### Layout

- Max width: 430px, centred — never wider
- Horizontal padding: 1.25rem (20px) throughout
- Bottom nav: 64px fixed, 4-column grid
- Page headers: sticky, white background, 0.5px border-bottom in `--bd`
- Cards: white background, 0.5px border in `--bd2`, border-radius 16px
- All scrollable areas: hide scrollbars, `-webkit-overflow-scrolling: touch`

### Component patterns

- **Primary CTA button:** full width, 14px padding, `--blue` background, DM Sans 17px weight 600
- **Ghost button:** full width, transparent, `--bd2` border
- **Status chips:** pill shape, 6px/14px padding, border-radius 20px
- **Insight card:** `--blue` background, white text, italic body copy
- **Prompt blocks:** `--blue-l` background, 3px left border in `--blue`, italic text

---

## 🔮 Freemium model — target, future phase, not implemented today

The current app is entirely free, local-only, and has no accounts. Everything below describes the intended monetisation model once the target architecture (Supabase + Stripe) is built — treat it as the plan, not a spec for the live app.

> **Note:** the data-persistence side of this plan now assumes the adopted `session_checkins` model (see Database schema), so "reflection"/"readiness"/"grey zone" below refer to that model's equivalents (check-in history, computed signals), not the original self-report fields. The **content side** — gating Build/Peak/Recovery tip cards — still assumes the `tips.js` phase-content system gets built, which is a separate, still-unresolved question (see Content system). If that system is never built, this whole gate needs rethinking — Option B (below) becomes the more natural fit, now as a check-in/signal-history gate rather than a reflection gate.

### Free tier
- Onboarding (mode selection, training start date, race date, calendar setup)
- Tips: **Base phase only** — all 4 block weeks, all 6 pillars (full first training block)
- Race-proximity overlay: **not included** — taper, race week, and post-race cards are paid
- Check-in logging (the `session_checkins` flow) — **in-session only, no persistence**
- Today tab: phase pill, cadence selector, session cards
- Calendar tab: full access (they need this to use the app at all)

### Paid tier — "TRI Momentum Pro" ($9.99 AUD/month or $79 AUD/year)
- All phases: Build, Peak, Recovery (in addition to Base)
- Race-proximity overlay — all 5 zones (awareness, taper, race week, race day, post-race)
- Full check-in history persistence (`session_checkins` rows saved and synced across devices, not just held in-session)
- Cross-device sync
- Trend analytics (fuelling / intensity-drift signal trends over time, compound-pair pattern history)
- Garmin integration (when built)
- Future: club features

### Why the Base phase gate
The Base phase covers 4 block weeks — a complete training block with all 6 pillars and a recovery week. The paywall hits at the natural phase boundary when training intensifies (Build phase begins), which is the highest-intent upgrade moment. The conceptual split is clean: "free = learn the foundations of training structure, paid = train for a race."

**Alternative model (Option B — reflection gate):** gate on reflection saving and trend analytics rather than content. All tip content free; gate on what the app does with the athlete's history over time. Converts on data-loss fear rather than content scarcity — stronger long-term LTV argument. Evaluate at first 100 paid users.

### Paywall behaviour
- **Never** show blurred/locked content. Free users see only Base phase cards — the Tips tab ends cleanly with an upgrade prompt at phase boundary.
- Phase gate is enforced via `canAccessPhase(phase, subscriptionTier)` in `tipResolver.js` — **this function is already written but not called from anywhere yet.**
- **Upgrade prompt triggers:**
  1. Attempting to view a Build, Peak, or Recovery tip card
  2. Attempting to persist a check-in past the current session (Check-in flow → save)
  3. Attempting to view the trend chart (Tips tab)
- Upgrade prompt is a bottom sheet component (`<Upgrade />`) — not a page redirect. **Currently presentational only; its buttons have no handlers.**
- After successful Stripe checkout, Supabase `subscription_tier` updates via webhook and the UI responds immediately on next auth check

### Checking subscription tier
```js
// Always derive from Supabase session — never trust client-side state alone
const { data: profile } = await supabase
  .from('user_profiles')
  .select('subscription_tier, subscription_expires_at')
  .eq('user_id', user.id)
  .single()

const isPro = profile.subscription_tier === 'paid'
  && new Date(profile.subscription_expires_at) > new Date()
```

---

## 🔮 Database schema — target, not yet applied

No `supabase/migrations/` exist yet and no Supabase project schema has been created. This is the plan for when Phase 2/3 of the multi-user build begins. All tables use Supabase row-level security (RLS). Users can only read and write their own rows.

```sql
-- 001_initial_schema.sql

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_tier text not null default 'free', -- 'free' | 'paid'
  subscription_expires_at timestamptz,
  stripe_customer_id text,
  mode text, -- 'race' | 'general'
  race_date date,
  training_start_date date, -- used by resolvePosition() to determine current phase/block week
  block_config jsonb, -- { base: N, build: N, peak: N, recovery: 1 } — set during onboarding
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Superseded the original session_logs + week_reflections tables below — the
-- current index.html app's check-in model won out (see "Key product
-- decisions"). Mirrors the shape of the localStorage `log` array in
-- index.html directly, so the eventual Supabase migration is a straight
-- copy of existing data, not a remodel.
create table public.session_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  disc text not null, -- 'swim'|'bike'|'run'|'brick'|'strength'
  duration integer, -- minutes
  intensity text,
  rpe integer,
  a1 text, -- execution/intent question — drives the intensity-drift signal
  a2 text,
  a3 text,
  b2 text, -- fuelling question — drives the fuelling signal
  b3 text,
  note text,
  phase text, -- 'base'|'build1'|'build2'|'peak' — whatever was current when logged, not resolved from dates
  logged_at timestamptz not null default now()
);

-- Signals (fuelling, intensity drift, compound-pair detection, severity,
-- auto-generated headlines) are computed at read time from
-- session_checkins, exactly as index.html does today — not stored.
-- Don't add a signals/reflections table unless a caching or
-- historical-snapshot need is actually proven out first.

-- Future table — add in a later migration
-- create table public.garmin_activities ( ... );

-- RLS policies (repeat pattern for each table)
alter table public.user_profiles enable row level security;
create policy "Users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- (repeat for session_checkins)
```

**Resolved:** the target schema adopts the current app's check-in + computed-signals model (`session_checkins`), not the original `session_logs`/`week_reflections` self-report design. `calendar_sessions` and `week_cadences` are dropped entirely — they described proactive day-of-week planning that neither the current app nor the adopted model implements. If calendar-based planning is ever wanted, design it fresh against actual need rather than reviving these.

---

## 🔮 Authentication flow — target, not implemented today

The current app has no accounts (see Current implementation). This is the plan for the target architecture.

- **Sign up:** magic link (email only — no password friction at sign-up)
- **Sign in:** magic link or Google OAuth
- **Session:** Supabase handles JWT refresh automatically
- **On first sign-in:** create `user_profiles` row via Supabase trigger or `useEffect` in `useAuth.js`
- **Auth state:** stored in React context via `useAuth` hook, available app-wide
- **Unauthenticated users:** can use the app in free/local mode (no persistence). Upgrade prompt appears when they hit a save action.

```js
// useAuth.js pattern
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user ?? null
const isAuthenticated = !!user
```

---

## 🔮 Stripe integration — target, not implemented today

### Products to create in Stripe dashboard
- **TRI Momentum Pro Monthly** — $9.99 AUD / month, recurring
- **TRI Momentum Pro Annual** — $79.00 AUD / year, recurring

### Checkout flow
1. User taps upgrade prompt → `<Upgrade />` bottom sheet opens
2. User selects monthly or annual
3. Frontend calls `POST /api/stripe/create-checkout-session` with `{ priceId, userId }`
4. Backend creates Stripe Checkout session with `success_url` and `cancel_url`
5. Frontend redirects to Stripe Checkout
6. On success, Stripe fires `checkout.session.completed` webhook
7. Backend webhook handler updates `user_profiles.subscription_tier = 'paid'` and sets `subscription_expires_at`
8. User redirected back to app — `useProfile` hook re-fetches, UI unlocks immediately

### Webhook handler (backend/src/routes/stripe.js)
```js
// Always verify webhook signature — never skip this
const sig = req.headers['stripe-signature']
const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)

if (event.type === 'checkout.session.completed') {
  // update supabase user_profiles via admin client
}
if (event.type === 'customer.subscription.deleted') {
  // downgrade to free
}
```

---

## PWA requirements

- **Current app:** manifest is inlined as a `data:` URI in `index.html`'s `<head>`; no separate service worker for the main app (the two Strength sub-apps each have their own `manifest.webmanifest` + `sw.js`).
- **Target (not yet built):** `manifest.json`: name "TRI Momentum", short_name "TRI", theme colour `#0022FF`, background `#F7F8FC`, display `standalone`, orientation `portrait`. Service worker: cache-first for static assets, network-first for API calls. Offline: Today and Week tabs render from cached data when offline; Tips tab static content always cached; saves queue when offline and sync on reconnect. Install prompt triggers after second session, not on first visit.

---

## 🔮 Content system (`tips.js` / `raceProximity.js`) — target, unused by current app

**None of this is used by the shipped app today.** The current app has no phase-aware prompt content at all — it's a check-in + signal-detection tool (see Current implementation). This section describes the content system as planned for the target `frontend/` architecture, written but not wired up (`tipResolver.js` exists; nothing calls it).

The tip system is intended to be the product's primary intellectual property, once built. Content would live in two static JS files bundled with the app, never fetched from a database.

### Content files (target)

| File | Purpose |
|---|---|
| `frontend/src/data/tips.js` | Block-relative tip content — `CARD_CONTENT[phase][phasePosition][pillar][day]` |
| `frontend/src/data/raceProximity.js` | Race-proximity overlay — `RACE_PROXIMITY_CONTENT[zone][key]` |
| `frontend/src/lib/tipResolver.js` | Runtime resolver — `resolvePosition()`, `resolveTip()`, `resolveProximityZone()` etc. |

### Updating tip content

**Do not embed tip copy in CLAUDE.md.** If/when this system is activated, all content lives exclusively in the two data files above:

1. Claude Code reads the relevant data file at the start of the content session
2. Edits are made directly to that file
3. CLAUDE.md is never touched for content changes — only for architectural decisions

### tips.js schema (v3 — phasePosition)

```js
// frontend/src/data/tips.js
export const CARD_CONTENT = {

  // Level 1: phase — 'base' | 'build' | 'peak' | 'recovery'
  base: {

    // Level 2: phasePosition — 'early' | 'mid' | 'late' | 'only'
    //   early  first week of a 2+ week phase
    //   mid    middle weeks of a 3+ week phase (repeats for longer phases)
    //   late   final week of any 2+ week phase
    //   only   phase is exactly 1 week (recovery always uses 'only')
    early: {

      // Level 3: pillar
      foundations: {
        tue: { title, mech, prompt, good, med },
        thu: { title, mech, prompt, good, med },
        sun: { title, mech, prompt, good, med },
      },
      technique:   { tue: {...}, thu: {...}, sun: {...} },
      // ... all 6 pillars
    },
    mid:  { /* same 6 pillars */ },
    late: { /* same 6 pillars */ },
  },
  build:    { early: {...}, mid: {...}, late: {...} },
  peak:     { early: {...}, mid: {...}, late: {...} },
  recovery: { only: {...} },  // single position only
};
```

**Block structure:** variable. Athlete sets `block_config` during onboarding:
```js
// stored in user_profiles.block_config
{ base: N, build: N, peak: N, recovery: 1 }
// ranges: base 1–8, build 1–4, peak 1–4, recovery always 1
```
Total block length = sum of all four. Repeats indefinitely.

**Phase position resolution** (from `resolvePhasePosition(weekInPhase, phaseLength)` in tipResolver.js):

| Phase weeks | Wk 1 | Wk 2 | Wk 3 | Wk 4+ (last) |
|---|---|---|---|---|
| 1 | only | — | — | — |
| 2 | early | late | — | — |
| 3 | early | mid | late | — |
| 4+ | early | mid | mid… | late |

**Pillar emphasis matrix** (which pillar leads per phase × phasePosition):

| Phase | early | mid | late | only |
|---|---|---|---|---|
| base | foundations | technique | durability | foundations |
| build | intensity | technique | durability | intensity |
| peak | racecraft | intensity | durability | racecraft |
| recovery | — | — | — | durability |

All 6 pillars are populated for every phase × position slot. The emphasis pillar is surfaced on the Today tab; others are available via the Tips tab.

### raceProximity.js schema

```js
// frontend/src/data/raceProximity.js
export const RACE_PROXIMITY_CONTENT = {
  awareness: { tue, thu, sun },           // 15–21 days out — supplements block tip
  taper:     { tue, thu, sun },           // 8–14 days out  — equal weight with block tip
  raceweek:  { 7, 6, 5, 4, 3, 2 },       // keyed by days_to_race — replaces block tip
  raceday:   { morning },                 // race morning — replaces block tip
  post:      { 1, 2, 3, 7 },             // keyed by days_since_race — replaces block tip
};
```

### Tips.jsx render decision pattern

```js
// Resolve position — requires both training start date and block config
const pos  = resolvePosition(user.trainingStartDate, user.blockConfig);
const zone = resolveProximityZone(user.nextRaceDate);

if (zone === 'raceweek' || zone === 'raceday' || zone === 'post') {
  // Full replacement — block tip not shown
  const key = zone === 'raceweek' ? daysToRace(user.nextRaceDate)
            : zone === 'post'     ? daysSinceRace
            : 'morning';
  tip = resolveProximityTip(RACE_PROXIMITY_CONTENT, zone, key);
} else if (zone === 'taper' || zone === 'awareness') {
  // Supplement — both shown, proximity card first
  proximityTip = resolveProximityTip(RACE_PROXIMITY_CONTENT, zone, dayOfWeek);
  blockTip     = resolveTip(CARD_CONTENT, pos.phase, pos.phasePosition, pos.emphasisPillar, dayOfWeek);
} else {
  // Normal block tip only
  tip = resolveTip(CARD_CONTENT, pos.phase, pos.phasePosition, pos.emphasisPillar, dayOfWeek);
}

// Gate check
if (!canAccessPhase(pos.phase, user.subscriptionTier)) {
  // show <Upgrade /> prompt
}
```

### Authoring principles for tip content

- **Mechanism first.** Every tip explains *why* before *what*. Athletes who understand the mechanism self-correct — athletes who only get the instruction forget it under fatigue.
- **No hand-holding.** The target user has strong self-knowledge and finds generic coaching advice patronising. Write for someone who will push back if the reasoning is weak.
- **Specificity over generality.** "Drop 10 BPM and observe how Monday feels" beats "train in Zone 2". Name the number, the session, the observation.
- **The contrast pair is not good vs bad.** It is sharp vs mediocre. The mediocre response is defensible — it's what a reasonable athlete does when they haven't thought carefully. That's what makes it useful.
- **Sunday prompts drive the weekly reflection.** *(Stale pending reconciliation — the "readiness"/"grey-zone" inputs this originally fed no longer exist; the adopted model computes signals from `session_checkins` instead. If this content system is ever built, decide what the Sunday card should feed into under the adopted model before writing to this principle again.)*
- **Content is phase-aware, not week-number-aware.** "Base Wk1 Foundations" is always about establishing the floor under fresh legs — regardless of what month of the year it is. Never write content that assumes a specific calendar date.

---

## Session build order (target architecture)

This is the plan for building out `frontend/`/`backend/` toward the target. It does **not** describe work on the current `index.html` app, which is developed directly and iteratively without this sequence.

| Session | Scope | Done? |
|---|---|---|
| 1 | Scaffold Vite + React, establish file structure | ☐ (scaffold exists) — data model resolved (adopt current app's check-in/signals model, see Database schema); **UI/tab reconciliation still open**: whether `frontend/` rebuilds the current Strength/Check-in/This week/Month tabs, the original Today/Week/Tips/Calendar tabs, or some merge |
| 2 | Supabase integration — auth (magic link + Google), user_profiles table, useAuth hook | ☐ |
| 3 | Migrate all state from localStorage to Supabase — `session_checkins` | ☐ |
| 4 | Freemium gating — phase content wall (if `tips.js` is built) or check-in/signal-history wall (Option B), Upgrade bottom sheet | ☐ |
| 5 | Stripe integration — checkout, webhooks, subscription status, monthly + annual pricing | ☐ |
| 6 | PWA — manifest, service worker, offline support, install prompt | ☐ |
| 7 | Garmin integration — backend OAuth or unofficial wrapper, activity import, session auto-population | ☐ |
| 8 | Club features — shared leaderboard, club admin, member management (scope TBD) | ☐ |

---

## What not to build

- No native iOS/Android app — PWA is the target. Do not introduce React Native.
- No Tailwind — the design system uses CSS custom properties. Tailwind would fight it.
- No server-side rendering — the target is a client-side React SPA with a thin Hono API backend; the current app is static HTML with no server at all.
- No admin dashboard for now — manage via Supabase dashboard directly (once it exists).
- No in-app training plan generation — the 4-week interval plan lives in a separate HTML file and is not integrated into this app.

---

## Environment variables (target — the current app needs none of this)

The current `index.html` app has no env vars; its only external dependency is the hardcoded Google Apps Script Web App URL for Sheet sync. Everything below is for the target architecture, once built.

```bash
# frontend/.env.local
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRICE_MONTHLY=
VITE_STRIPE_PRICE_ANNUAL=

# backend/.env.local
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # admin key — never expose to frontend
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=3001
```

---

## Key product decisions already made

1. **The current app is the live product** — `index.html` plus its two Strength sub-apps (`TRI-swim-strength mobile app/`, `TRI-run-strength mobile app/`), all three co-deployed via GitHub Pages and reachable through the same 4-tab nav. The Strength apps are core architecture, not an optional add-on — treat changes to them with the same weight as changes to `index.html`. `frontend/`/`backend`/`supabase/` are the intended future direction, not yet active. Don't confuse "documented in this file" with "shipped."
2. **Freemium gate (target): Base phase only.** Free users get all 4 Base block weeks, all 6 pillars. Build, Peak, Recovery, and the race-proximity overlay require Pro. Paywall hits at the natural phase boundary — the highest-intent upgrade moment. Never show locked/blurred content. **Not implemented today — current app has no accounts or paywall.**
3. **Auth (target):** Supabase magic link + Google OAuth. No passwords. **Not implemented today.**
4. **Pricing (target):** $9.99 AUD/month, $79 AUD/year.
5. **Target stack:** React + Vite + Hono + Supabase + Stripe + Vercel/Fly.io. **Current app is a static HTML file with no backend, deployed via GitHub Pages.**
6. **Tips are intended to be static content bundled client-side** — not served from the database. Currently unused; the current app has no tip/prompt content system at all.
7. **Garmin integration is backend-only** (target) — credentials never touch the frontend.
8. **Club features are in scope but out of sequence** (target) — design auth and database with multi-user in mind, but do not build club UI until the last session.
9. **PWA, not native app** — true for both current and target.
10. **Target content is block-relative with variable block length.** The primary key would be `CARD_CONTENT[phase][phasePosition][pillar][day]`, resolved at runtime via `resolvePosition()`. This is unbuilt and unused; the current app instead asks phase once, manually, with no date-based resolution.
11. **Race-proximity overlay (target) is a distinct content layer**, independent of `tips.js`, keyed off days-to-race. Unbuilt — the current app never captures a race date.
12. **Sync strategy today is Google Sheets, not Supabase — and the Sheet is the source of truth, not `localStorage`.** `apps-script/Code.gs` handles both directions: `doPost` appends a row per logged session (fire-and-forget write), `doGet(?list=1)` returns the full log as JSON. `index.html` fetches from `doGet` on load and whenever This week/Month is opened, so a session logged on the phone shows up on the laptop; `localStorage` is only a same-device cache used when a fetch fails. This is a deliberate current-state choice, separate from the target's Supabase sync plan — revisit when/if the target architecture is activated.
13. **The target Supabase schema adopts the current app's check-in + computed-signals model, not the original reflection model.** `session_checkins` (mirroring `index.html`'s `log` array: `disc`, `duration`, `intensity`, `rpe`, `a1-a3`, `b2-b3`, `note`, `phase`) replaces the old `session_logs` + `week_reflections` tables. Signals (fuelling, intensity drift, compound-pair detection) stay computed at read time, not stored — matching how the current app already works. Freemium copy referencing "reflection persistence" or "readiness/grey zone" now means this model's equivalents. `calendar_sessions`/`week_cadences` are **dropped** — proactive day-of-week planning that neither the current app nor the adopted model implements; design fresh if it's ever actually wanted. **Still open:** whether the target UI adopts the current app's tabs (Strength/Check-in/This week/Month) or the original ones (Today/Week/Tips/Calendar) — see Session build order.
14. **`TRI-swim-strength mobile app/` and `TRI-run-strength mobile app/` are core architecture, not an add-on.** They implement the Strength tab's Swim and Ride/Run sub-tabs (via `<iframe>` in `index.html`), ship in this repo, and deploy under the same GitHub Pages site as the main app. They're separate deployable units (their own `index.html`/`app.js`/`manifest.webmanifest`/`sw.js`) for build-isolation reasons, not because they're peripheral — any session touching the Strength tab should treat these two directories with the same weight as `index.html` itself.
15. **The app opens on a splash screen, not straight into a tab.** `--blue` background, `favicon.png` logo, sub head, page-title-styled headline, base nav visible beneath it. No auto-advance — dismissed only by a nav tap. Tapping Check-in with no phase set routes to the training-phase picker first (see Training phase); every other tab still bypasses it, as before.
16. **`--blue` is now the favicon's blue, `#0022FF` — not `#1650C8`.** Rebranded so the brand blue and the app-icon artwork are the same colour everywhere it's defined: `index.html`, this file, and the design guide. `--swim` (which has always shared `--blue`'s value) moved with it. `--blue-l`/`--blue-m` (tints) were left as-is — close enough in hue not to need re-deriving. Not touched: the base nav's hardcoded `#002DFF` and the PWA manifest's inline `theme_color` (`#002DFF`) — both pre-existing, separately-flagged discrepancies from `--blue`, unrelated to this change.
17. **Completion in Warm up and both Strength mini-apps is auto-detected only — there's no manual "mark complete" button anywhere anymore.** Checking the *last* exercise (or last round) off directly auto-fires a "Well done! [X] complete 🎉" banner immediately — mirroring TRI-run-strength's original `handleAllComplete()`, which TRI-swim-strength has now also gained (it previously had no auto-detect at all; its manual button was its only way to log a session, so the auto-detect logic was ported in *before* that button was removed, so it wasn't left with no way to complete). The banner increments an all-time completed-count (`localStorage`, device-local — not Sheet-synced), leaves the checklist checked rather than clearing it, logs exactly once per completion, and only its "Reset & go again" button or the always-visible header reset ("Reset warm-up" / "Reset session") clears it. Warm up's version is recoloured to the app's own `--done`/`--done-l` green and `--blue` button, matching the rest of `index.html`; both Strength apps keep their own existing yellow/green palette. **Consequence:** partial-completion logging (banking progress on a session you didn't finish) is no longer possible in any of the three — completion is all-or-nothing now.
18. **The documented type scale was wrong and has been corrected to match the shipped CSS.** Page titles are **23px** (not 26px) and eyebrows are **14px** (not 9–10px) — both now read directly from `index.html`'s `h1`/`.eyebrow` rules rather than the unused `frontend/src/index.css` scaffold they'd drifted to match instead. The splash headline (decision 15) was built against the old, wrong 26px figure and has been corrected to 23px/line-height 1.25 along with it.

---

*Last updated: 2026-08-07. Removed the manual "mark complete" button from Warm up and both Strength mini-apps (`TRI-swim-strength mobile app/`, `TRI-run-strength mobile app/`) — completion is now auto-detected only, everywhere (decision 17). Ported TRI-run-strength's auto-fire "Well done!" completion banner into TRI-swim-strength first (it had no auto-detect logic before), so removing its button didn't leave it unable to log a session. Design guide's "Complete + toast" tile (documenting the now-removed pattern) was deleted; "Well-done banner" tile updated to note it's the sole completion path. Splash logo→sub head gap halved again (20px→10px). Splash spacing rebalanced: tighter logo→sub head gap (44px→20px), wider sub head→headline gap (24px→36px); logo drop shadow removed; headline changed to "Mobility, intensity, fuelling, strength" (decision 15). Corrected the documented type scale to match the shipped CSS — page titles 23px not 26px, eyebrows 14px not 9–10px (decision 18) — and fixed the splash headline, which had been built against the old wrong figure, to match. Full design-guide review: the guide is now light-only (`color-scheme: only light`, matching `index.html`) instead of switching to a dark theme under `prefers-color-scheme: dark`; its Base navigation and Layout tiles were rebuilt to show the real 4-tab/84px nav instead of a stale 3-tab/74px mockup. Rebranded `--blue`/`--swim` from `#1650C8` to the favicon's `#0022FF` (decision 16) across `index.html`, this file, and the design guide, so the app icon and brand blue match exactly. Prior update: reframed the two Strength sub-apps from "sibling PWAs"/"add-on" language to core architecture. See decision 14, "Two codebases" intro, and Repository structure. Owner: Justin. Update this file whenever a decision changes, or when the target architecture moves from scaffold to active development.*
