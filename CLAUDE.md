# CLAUDE.md — TRI Momentum

> This file is the project north star. Read it at the start of every session before touching any code.
> Update it when architectural decisions change. Never let it go stale.

---

## What this product is

**TRI Momentum** is a mobile-first progressive web app (PWA) for intermediate age-group triathletes training for Olympic distance and 70.3 Ironman events. It is not a training log. It is a decision-support tool — it helps athletes make better choices about load, recovery, and race preparation across a repeating 13-week block cycle (base → build → peak → recovery).

The core value loop is:
1. Athlete sets their training start date and race date
2. App resolves their current phase, block week, and emphasis pillar from those dates
3. App surfaces the right thinking prompt for their current position in the training cycle
4. Athlete logs session outcomes and a weekly reflection
5. App tracks readiness, grey-zone training %, and vulnerable sessions over time
6. Trend data surfaces patterns the athlete can't see week-to-week

The product is built for **one primary user type**: a time-pressured age-grouper with 10–15 hours/week of training, strong self-knowledge, and no interest in being hand-held. The tone of the app — including all tip copy — reflects this.

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dev server, clean component model, easy PWA setup |
| Styling | CSS custom properties (no Tailwind) | Design system already established in v5 — preserve it exactly |
| Backend | Hono on Node.js | Lightweight, edge-compatible, minimal boilerplate |
| Database | Supabase (Postgres) | Auth + database + row-level security in one. Free tier sufficient for launch. |
| Auth | Supabase Auth | Magic link + Google OAuth. No passwords to manage. |
| Payments | Stripe | Checkout + webhooks. Subscription status written to Supabase. |
| Hosting | Vercel (frontend) + Fly.io (backend) | Both have generous free tiers. Vercel handles PWA edge cases well. |
| Garmin | Unofficial garminconnect Python wrapper OR official OAuth API (future) | Backend-only — never expose credentials client-side |

---

## Repository structure

```
tri-momentum/
├── CLAUDE.md                  ← this file
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
│   │   │   ├── Auth.jsx           ← sign in / sign up / magic link
│   │   │   ├── Upgrade.jsx        ← paywall prompt component
│   │   │   └── shared/
│   │   │       ├── BottomNav.jsx
│   │   │       ├── SessionCard.jsx
│   │   │       └── Phasepill.jsx
│   │   ├── data/
│   │   │   ├── tips.js            ← block-relative tip content (static, see schema below)
│   │   │   ├── raceProximity.js   ← race-proximity overlay content (23 cards, 5 zones)
│   │   │   ├── phases.js          ← PHASES_39 and PILLAR_CYCLE constants
│   │   │   └── insights.js        ← CADENCE_INSIGHTS constant
│   │   ├── hooks/
│   │   │   ├── useAuth.js         ← Supabase auth state
│   │   │   ├── useProfile.js      ← user profile + subscription tier
│   │   │   └── useReflections.js  ← reflection CRUD
│   │   ├── lib/
│   │   │   ├── supabase.js        ← Supabase client init
│   │   │   ├── stripe.js          ← Stripe client init
│   │   │   └── tipResolver.js     ← resolvePosition(), resolveTip(), resolveProximityZone() etc.
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   ├── manifest.json          ← PWA manifest
│   │   └── sw.js                  ← service worker
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── index.js               ← Hono server entry
│   │   ├── routes/
│   │   │   ├── stripe.js          ← webhook handler + checkout session
│   │   │   └── garmin.js          ← Garmin OAuth + activity fetch (future)
│   │   └── lib/
│   │       └── supabase-admin.js  ← Supabase admin client (service role key)
│   └── package.json
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Design system — do not deviate

The visual language is established and must be preserved exactly across all new components. Never introduce Tailwind, Bootstrap, or component libraries that override these tokens.

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

/* Discipline colours */
--swim: #1650C8;   --swim-l: #E8EFFE;
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
- **Page titles:** 26px, weight 600, letter-spacing -0.3px
- **Eyebrows / tags:** DM Mono, 9–10px, uppercase, letter-spacing 0.1em
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

## Freemium model — the single most important product decision

### Free tier
- Onboarding (mode selection, training start date, race date, calendar setup)
- Tips: **Base phase only** — all 4 block weeks, all 6 pillars (full first training block)
- Race-proximity overlay: **not included** — taper, race week, and post-race cards are paid
- Session status logging (done / modified / skipped) — **in-session only, no persistence**
- Today tab: phase pill, cadence selector, session cards
- Calendar tab: full access (they need this to use the app at all)

### Paid tier — "TRI Momentum Pro" ($9.99 AUD/month or $79 AUD/year)
- All phases: Build, Peak, Recovery (in addition to Base)
- Race-proximity overlay — all 5 zones (awareness, taper, race week, race day, post-race)
- Full reflection persistence (readiness, grey zone, session notes, week reflections)
- Cross-device sync
- Trend analytics (training trend chart, avg readiness, avg grey zone %)
- Garmin integration (when built)
- Future: club features

### Why the Base phase gate
The Base phase covers 4 block weeks — a complete training block with all 6 pillars and a recovery week. The paywall hits at the natural phase boundary when training intensifies (Build phase begins), which is the highest-intent upgrade moment. The conceptual split is clean: "free = learn the foundations of training structure, paid = train for a race."

**Alternative model (Option B — reflection gate):** gate on reflection saving and trend analytics rather than content. All tip content free; gate on what the app does with the athlete's history over time. Converts on data-loss fear rather than content scarcity — stronger long-term LTV argument. Evaluate at first 100 paid users.

### Paywall behaviour
- **Never** show blurred/locked content. Free users see only Base phase cards — the Tips tab ends cleanly with an upgrade prompt at phase boundary.
- Phase gate is enforced via `canAccessPhase(phase, subscriptionTier)` in `tipResolver.js`.
- **Upgrade prompt triggers:**
  1. Attempting to view a Build, Peak, or Recovery tip card
  2. Attempting to save a week reflection (Week tab → save button)
  3. Attempting to view the trend chart (Tips tab)
- Upgrade prompt is a bottom sheet component (`<Upgrade />`) — not a page redirect
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

## Database schema

All tables use Supabase row-level security (RLS). Users can only read and write their own rows.

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

create table public.calendar_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week text not null, -- 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'
  position integer not null, -- 0-3
  session_type text not null, -- 'swim'|'bike'|'run'|'brick'|'strength'|'rest'
  created_at timestamptz not null default now(),
  unique(user_id, day_of_week, position)
);

create table public.week_cadences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num integer not null,
  cadence text not null, -- 'base'|'build'|'peak'|'taper'
  created_at timestamptz not null default now(),
  unique(user_id, week_num)
);

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num integer not null,
  day text not null,
  session_index integer not null,
  status text, -- 'done'|'modified'|'skipped'
  note text,
  logged_at timestamptz not null default now(),
  unique(user_id, week_num, day, session_index)
);

create table public.week_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num integer not null,
  readiness integer, -- 1-10
  grey_zone_pct integer, -- 10|30|50|70
  vuln_session text,
  notes text,
  saved_at timestamptz,
  unique(user_id, week_num)
);

-- Future table — add in a later migration
-- create table public.garmin_activities ( ... );

-- RLS policies (repeat pattern for each table)
alter table public.user_profiles enable row level security;
create policy "Users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- (repeat for calendar_sessions, week_cadences, session_logs, week_reflections)
```

---

## Authentication flow

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

## Stripe integration

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

- `manifest.json`: name "TRI Momentum", short_name "TRI", theme colour `#1650C8`, background `#F7F8FC`, display `standalone`, orientation `portrait`
- Service worker: cache-first for static assets, network-first for API calls
- Offline: Today and Week tabs should render from cached data when offline. Tips tab static content is always cached. Saves queue when offline and sync on reconnect.
- Install prompt: trigger after second session, not on first visit

---

## Content — do not modify without instruction

The tip system is the product's primary intellectual property. Content lives in two static JS files bundled with the app. It is **never fetched from the database** — the database only stores which weeks a user has reflected on.

The freemium gate is enforced in the component layer (`Tips.jsx`) via `canAccessPhase()` from `tipResolver.js`, not in the data layer. The full content object is always in the bundle.

This is intentional: it keeps tips fast (no API call), and the locked content is not sensitive enough to warrant server-side enforcement.

### Content files

| File | Purpose |
|---|---|
| `frontend/src/data/tips.js` | Block-relative tip content — `CARD_CONTENT[phase][phasePosition][pillar][day]` |
| `frontend/src/data/raceProximity.js` | Race-proximity overlay — `RACE_PROXIMITY_CONTENT[zone][key]` |
| `frontend/src/lib/tipResolver.js` | Runtime resolver — `resolvePosition()`, `resolveTip()`, `resolveProximityZone()` etc. |

### Updating tip content

**Do not embed tip copy in CLAUDE.md.** All content lives exclusively in the two data files above. When updating content:

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
- **Sunday prompts drive the weekly reflection.** The Sunday card is the anchor — it should connect the week's theme to a concrete retrospective question that feeds the readiness and grey-zone inputs.
- **Content is phase-aware, not week-number-aware.** "Base Wk1 Foundations" is always about establishing the floor under fresh legs — regardless of what month of the year it is. Never write content that assumes a specific calendar date.

---

## Session build order

Work through these in order. Do not skip ahead.

| Session | Scope | Done? |
|---|---|---|
| 1 | Scaffold Vite + React, migrate v5 HTML into components, establish file structure | ☐ |
| 2 | Supabase integration — auth (magic link + Google), user_profiles table, useAuth hook | ☐ |
| 3 | Migrate all state from window.storage to Supabase — calendar, cadences, reflections, session logs | ☐ |
| 4 | Freemium gating — week 4 tip wall, reflection save wall, trend chart wall, Upgrade bottom sheet | ☐ |
| 5 | Stripe integration — checkout, webhooks, subscription status, monthly + annual pricing | ☐ |
| 6 | PWA — manifest, service worker, offline support, install prompt | ☐ |
| 7 | Garmin integration — backend OAuth or unofficial wrapper, activity import, session auto-population | ☐ |
| 8 | Club features — shared leaderboard, club admin, member management (scope TBD) | ☐ |

---

## What not to build

- No native iOS/Android app — PWA is the target. Do not introduce React Native.
- No Tailwind — the design system uses CSS custom properties. Tailwind would fight it.
- No server-side rendering — this is a client-side React SPA with a thin Hono API backend.
- No admin dashboard for now — manage via Supabase dashboard directly.
- No in-app training plan generation — the 4-week plan lives in a separate HTML file (`703_four_week_intervals_tuesday.html`) and is not integrated into this app yet.

---

## Environment variables

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

## Source of truth for v5 HTML

The original single-file prototype is at `triathlon_momentum_v5.html`. When migrating:

- All CSS custom properties and the full design system move to `frontend/src/index.css`
- JavaScript constants (`DAYS`, `SESSION_ICONS`, `PILLAR_CYCLE`, `PHASES_39`, `CADENCE_INSIGHTS`, `CARD_CONTENT`, `RACE_PROXIMITY_CONTENT`) move to the appropriate files in `frontend/src/data/`; `resolvePosition()` and related functions move to `frontend/src/lib/tipResolver.js`
- The `window.storage` API calls are replaced entirely with Supabase queries via the hooks in `frontend/src/hooks/`
- The four tab screens become four React components
- The two onboarding screens become `<Onboarding />`
- Do not attempt to preserve the single-file structure — it has served its purpose

---

## Key product decisions already made

1. **Freemium gate: Base phase only.** Free users get all 4 Base block weeks, all 6 pillars. Build, Peak, Recovery, and the race-proximity overlay require Pro. Paywall hits at the natural phase boundary — the highest-intent upgrade moment. Never show locked/blurred content; the Tips tab ends cleanly at the phase boundary with an upgrade prompt.
2. **Auth:** Supabase magic link + Google OAuth. No passwords.
3. **Pricing:** $9.99 AUD/month, $79 AUD/year.
4. **Stack:** React + Vite + Hono + Supabase + Stripe + Vercel/Fly.io.
5. **Tips are static content bundled client-side** — not served from the database.
6. **Garmin integration is backend-only** — credentials never touch the frontend.
7. **Club features are in scope but out of sequence** — design auth and database with multi-user in mind from session 1, but do not build club UI until session 8.
8. **PWA, not native app.**
9. **Content is block-relative with variable block length.** The primary key for tip content is `CARD_CONTENT[phase][phasePosition][pillar][day]`. Phase and position are resolved at runtime from `training_start_date` + `block_config` via `resolvePosition()` in `tipResolver.js`. Athletes set `block_config` during onboarding (base 1–8w, build 1–4w, peak 1–4w, recovery always 1w). Phase position is `early` | `mid` | `late` | `only` — normalises any phase length to the same content slots.
10. **Race-proximity overlay is a distinct content layer.** `raceProximity.js` is independent of `tips.js`. It activates via `resolveProximityZone()` when the user is within 21 days of their race date, and again for 7 days post-race. Zones: awareness (supplements), taper (equal weight), raceweek/raceday/post (full replacement). Zero changes to tips.js required to ship it.

---

*Last updated: April 2026. Variable block length migration (tips.js v3, tipResolver.js v3 — phasePosition replaces blockWeek). Owner: Justin. Update this file whenever a decision in the "Key product decisions" section changes.*
