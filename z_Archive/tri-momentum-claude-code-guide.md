# Building TRI Momentum with Claude Code
## A Step-by-Step Guide from Prototype to Production PWA

---

## Before You Start

**What you need:**
- Node.js 18+ installed (`node --version` to check)
- A Claude subscription (Pro at $20/month minimum — Max at $100/month recommended for a build this size)
- A GitHub account
- A Supabase account (free tier is sufficient)
- A Stripe account (test mode only to start)
- A Vercel account (frontend hosting — free tier)
- A Fly.io account (backend hosting — free tier)

**What you already have (from this project):**
- `CLAUDE.md` — the complete architectural north star
- `TRI_Momentum__standalone_.html` — the v5 prototype with the full design system
- `triathlon_momentum_v5.html` — the source HTML (the one to migrate from)
- `tipResolver.js` — the resolver logic (v3, already correct)
- `tips.js` — tip content (partially populated)
- `raceProximity.js` — proximity overlay content

The prototype has already done the hard work. You are migrating a working product into a production stack, not designing from scratch.

---

## Part 1 — Install Claude Code

### Step 1.1 — Install via npm

```bash
npm install -g @anthropic-ai/claude-code
```

Verify installation:
```bash
claude --version
```

### Step 1.2 — Authenticate

```bash
claude
```

On first launch, Claude Code will prompt you to log in with your Anthropic account. Follow the browser-based OAuth flow. Your credentials are stored locally — you won't need to log in again.

### Step 1.3 — (Optional) Install the VS Code extension

If you prefer working in an IDE alongside the terminal, install the Claude Code extension from the VS Code marketplace. It adds a launcher and lets you run multiple Claude Code instances in separate panes.

---

## Part 2 — Repository Setup

### Step 2.1 — Create the project structure

```bash
mkdir tri-momentum
cd tri-momentum
git init
```

### Step 2.2 — Copy in your project files

Copy the following files from this Claude project into the root of your new repository:

```
tri-momentum/
├── CLAUDE.md                          ← already written — this is Claude Code's north star
├── frontend/src/data/tipResolver.js   ← copy tipResolver.js here
├── frontend/src/data/tips.js          ← copy tips.js here
├── frontend/src/data/raceProximity.js ← copy raceProximity.js here
```

Also copy `TRI_Momentum__standalone_.html` and `triathlon_momentum_v5.html` into the root. Claude Code will use these as the reference for all visual decisions.

### Step 2.3 — Create the `.env.example` file

Create `.env.example` in the root (safe to commit — contains no secrets):

```bash
# frontend/.env.local
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRICE_MONTHLY=
VITE_STRIPE_PRICE_ANNUAL=

# backend/.env.local
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=3001
```

Add `.env.local` to `.gitignore` immediately:

```bash
echo ".env.local" >> .gitignore
echo "node_modules" >> .gitignore
git add .gitignore CLAUDE.md .env.example
git commit -m "chore: project scaffold and CLAUDE.md"
```

### Step 2.4 — Open Claude Code

```bash
claude
```

Claude Code will load `CLAUDE.md` automatically on startup. Every session begins from a shared understanding of the architecture, design system, and session build order — you do not need to re-explain the project each time.

---

## Part 3 — Understanding How to Work with Claude Code

Before issuing any session prompts, internalise these three working principles.

### Principle 1: Plan Mode before every session

For any work touching more than two files or involving architectural decisions, start with Plan Mode:

```
> plan
```

Claude Code will reason through the approach and present it for your approval before writing a single line of code. For a project of this complexity, skipping Plan Mode is how you end up three files into the wrong implementation.

### Principle 2: `CLAUDE.md` is your authority document

`CLAUDE.md` is loaded into every Claude Code session automatically. If Claude Code makes a decision that contradicts it — using Tailwind, deviating from the colour tokens, widening the 430px max-width — correct it immediately and reference the relevant section. Claude Code is designed to iterate; it will not get defensive.

### Principle 3: Clear context between sessions

At the end of each session, use `/clear` before starting a new one. Long conversation history from a completed session actively degrades performance on the next task. Your state is in the codebase, not the chat history.

---

## Part 4 — Session-by-Session Build Prompts

These are the prompts for each session in the build order from `CLAUDE.md`. Each is ready to paste directly into Claude Code after opening the project directory.

---

### Session 1 — Scaffold + Design Migration

**Goal:** Vite + React scaffold, full design system migrated from v5 HTML, four tab components stubbed, onboarding screens stubbed, file structure established.

**Open Claude Code:**
```bash
cd tri-momentum
claude
```

**Prompt:**
```
Read CLAUDE.md and triathlon_momentum_v5.html carefully before doing anything.

Session 1 goal: scaffold the React + Vite frontend and migrate the v5 design system.

Work through this in order:

1. Scaffold the frontend directory with Vite + React. Use the exact file structure in CLAUDE.md — no deviations.

2. Migrate the complete CSS design system from triathlon_momentum_v5.html into frontend/src/index.css. Preserve every CSS custom property exactly as documented in CLAUDE.md under "Design system — do not deviate". Import DM Sans and DM Mono from Google Fonts in index.css.

3. Migrate the JavaScript constants from triathlon_momentum_v5.html: DAYS, SESSION_ICONS, PILLAR_CYCLE, PHASES_39, CADENCE_INSIGHTS, CARD_CONTENT, RACE_PROXIMITY_CONTENT. Place them in the correct files under frontend/src/data/ per CLAUDE.md. Do not put them in App.jsx.

4. The tipResolver.js file already exists in frontend/src/data/. Do not touch it.

5. Create stub components for all four tabs — Today.jsx, Week.jsx, Tips.jsx, Calendar.jsx — and the two onboarding screens — Onboarding.jsx, Auth.jsx. Each stub should render the correct shell (header, page title, bottom nav) using the design system tokens. No logic yet.

6. Create BottomNav.jsx in frontend/src/components/shared/. The nav is a fixed 4-column grid, 64px tall, with icons and labels for Today, Week, Tips, Calendar.

7. Wire App.jsx to render the correct tab based on a useState('today') router. No React Router — internal state is sufficient for this MVP.

Do not install Tailwind. Do not introduce any component library. Check the design system section of CLAUDE.md before choosing any colour, font size, or border-radius value.

After scaffolding, run the dev server and confirm it renders without errors.
```

**What to check when done:**
- `npm run dev` in `frontend/` launches without errors
- The app renders at 430px max-width
- All four tabs are navigable via bottom nav
- Colour tokens match the CLAUDE.md spec exactly (inspect in browser DevTools)
- DM Sans and DM Mono are loading

---

### Session 2 — Supabase Auth + User Profile

**Goal:** Magic link + Google OAuth, `user_profiles` table, `useAuth` hook, profile creation on first sign-in.

**Prerequisite:** Create a Supabase project at supabase.com. Copy your project URL and anon key into `frontend/.env.local`.

**Prompt:**
```
Read CLAUDE.md, specifically the Database schema and Auth sections.

Session 2 goal: Supabase auth and user profile.

1. Run the SQL from CLAUDE.md (the 001_initial_schema.sql block) in the Supabase SQL editor to create all tables with RLS. Do not generate a migration file yet — I will paste and run it manually.

2. Install the Supabase JS client: npm install @supabase/supabase-js

3. Create frontend/src/lib/supabase.js — initialise the Supabase client from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

4. Create frontend/src/hooks/useAuth.js — exports the current Supabase auth session and user. Listens to onAuthStateChange. Returns { user, session, loading }.

5. Create frontend/src/hooks/useProfile.js — fetches user_profiles row for the authenticated user. On first sign-in, if no profile row exists, creates one with defaults (subscription_tier: 'free', mode: null, training_start_date: null, race_date: null, block_config: null).

6. Build Auth.jsx with two flows:
   - Magic link: email input, submit button, confirmation state ("Check your inbox")
   - Google OAuth: single button using Supabase signInWithOAuth({ provider: 'google' })
   
   Style using the design system — primary CTA button pattern from CLAUDE.md.

7. In App.jsx, gate the tab UI behind auth state. Unauthenticated users see Auth.jsx. Authenticated users with incomplete profiles (mode or training_start_date is null) see Onboarding.jsx. Fully onboarded users see the tab UI.

No passwords. No custom JWT logic. Supabase handles all session management.
```

**What to check when done:**
- Magic link email arrives and signs you in
- Google OAuth redirects back correctly
- `user_profiles` row is created on first sign-in
- Incomplete profiles route to Onboarding

---

### Session 3 — Onboarding + Full State Migration

**Goal:** Onboarding flow, block config selection, all `window.storage` calls replaced with Supabase queries via hooks.

**Prompt:**
```
Read CLAUDE.md, specifically the Onboarding flow, block_config schema, and Source of truth for v5 HTML sections.

Session 3 goal: complete onboarding and migrate all state to Supabase.

1. Build Onboarding.jsx as a multi-step flow:
   - Step 1: Mode selection — Race mode vs General training mode. Store to user_profiles.mode.
   - Step 2: Training start date picker. Store to user_profiles.training_start_date.
   - Step 3 (Race mode only): Race date picker. Store to user_profiles.race_date.
   - Step 4: Block config — let the athlete set base, build, peak, recovery week counts within the ranges in CLAUDE.md (base 1–8, build 1–4, peak 1–4, recovery always 1). Default to { base: 4, build: 3, peak: 2, recovery: 1 } from DEFAULT_BLOCK_CONFIG in tipResolver.js. Store to user_profiles.block_config.
   
   Each step saves immediately to Supabase on Next. If the user closes mid-flow and returns, resume from the last incomplete step.

2. Create frontend/src/hooks/useReflections.js — CRUD for week_reflections table. Exposes getReflection(weekNum), saveReflection(weekNum, data), and the loading state.

3. Replace all window.storage calls in the existing tab components with Supabase queries:
   - Calendar session layout → calendar_sessions table
   - Week cadence selections → week_cadences table
   - Session status logs (done/modified/skipped) → session_logs table
   - Week reflections → week_reflections table via useReflections hook

4. Today.jsx: resolve the athlete's current phase, phasePosition, and emphasisPillar using resolvePosition() from tipResolver.js, passing user_profiles.training_start_date and user_profiles.block_config. Display the phase pill (PhasePill.jsx component), the emphasis pillar, and the current session cards.

5. Create PhasePill.jsx — a small pill component that shows the current phase with the correct colour token (--base, --build, --peak, --taper from the design system).

Do not refactor tipResolver.js — it is correct as-is.
```

---

### Session 4 — Freemium Gating + Paywall

**Goal:** Phase gate logic, Upgrade.jsx bottom sheet, three paywall trigger points, clean free-tier experience.

**Prompt:**
```
Read CLAUDE.md, specifically the Freemium model section and the "Paywall behaviour" and "Checking subscription tier" subsections.

Session 4 goal: implement freemium gating correctly.

1. Add canAccessPhase(phase, subscriptionTier) to tipResolver.js. Free users can access 'base' only. Paid users can access all phases.

2. Tips.jsx: implement the full tip render decision pattern from CLAUDE.md (the block starting with "Resolve position — requires both training start date and block config"). This involves:
   - resolvePosition() to get phase, phasePosition, emphasisPillar
   - resolveProximityZone() to check race proximity
   - The zone-based render logic (replacement vs supplement vs normal)
   - canAccessPhase() gate check — if gated, render <Upgrade /> instead

3. Build Upgrade.jsx as a bottom sheet component (slides up from bottom, not a page redirect). The sheet shows:
   - "TRI Momentum Pro" heading
   - Two pricing options: $9.99/month and $79/year (reference VITE_STRIPE_PRICE_MONTHLY and VITE_STRIPE_PRICE_ANNUAL)
   - A primary CTA button: "Start free 7-day trial" (placeholder — wires to Stripe in Session 5)
   - A close affordance

4. Wire the three paywall trigger points:
   - Trigger 1: Tips tab attempts to render a Build/Peak/Recovery card → show Upgrade bottom sheet
   - Trigger 2: Week tab "Save reflection" button → show Upgrade bottom sheet (free users can fill in the form but cannot save)
   - Trigger 3: Tips tab trend chart area → show Upgrade bottom sheet with "Unlock your trend data" heading variant

5. Free tier behaviour: the Tips tab must end cleanly at the phase boundary. No blurred cards, no locked states with padlocks. When Base phase ends, the tab shows a clean "You've completed the Base phase" message followed immediately by the Upgrade prompt. Never show Build content in a degraded/teased state.

Subscription tier is always derived from Supabase: use the canAccessPhase check after fetching the profile — never trust a client-side flag alone.
```

---

### Session 5 — Stripe Payments

**Goal:** Checkout session, webhook handler, subscription status written back to Supabase.

**Prerequisite:** Create a Stripe account. Set up two prices in Stripe dashboard (monthly at $9.99 AUD, annual at $79 AUD). Copy test keys and price IDs to your `.env.local` files.

**Prompt:**
```
Read CLAUDE.md, specifically the Tech stack (Stripe + Hono backend) and the Freemium model sections.

Session 5 goal: wire Stripe checkout and webhooks.

BACKEND first:

1. Scaffold the backend directory with Hono on Node.js. Use the file structure in CLAUDE.md exactly.

2. Install: npm install hono @hono/node-server stripe @supabase/supabase-js

3. Create backend/src/lib/supabase-admin.js — initialise Supabase with the service role key (SUPABASE_SERVICE_ROLE_KEY). This is the admin client — never expose this key to the frontend.

4. Create backend/src/routes/stripe.js with two handlers:
   - POST /stripe/create-checkout — creates a Stripe Checkout session for the authenticated user. Requires a valid Supabase JWT in the Authorization header. Creates or retrieves a Stripe customer, then creates a checkout session for the selected price (monthly or annual). Returns the checkout URL.
   - POST /stripe/webhook — Stripe webhook handler. On checkout.session.completed, write subscription_tier: 'paid' and subscription_expires_at to the user's user_profiles row in Supabase using the admin client. On customer.subscription.deleted, write subscription_tier: 'free'. Verify the webhook signature using STRIPE_WEBHOOK_SECRET — never skip this.

5. Create backend/src/index.js — Hono server entry, registers routes, starts on PORT.

FRONTEND:

6. In Upgrade.jsx, wire the CTA button to call POST /stripe/create-checkout on your backend with the selected price ID and the user's Supabase JWT. Redirect to the returned checkout URL.

7. After successful checkout, Stripe redirects back to the app. Add a success route handler that triggers a fresh useProfile() fetch so the UI reflects the new subscription_tier immediately.

Do not store Stripe keys on the frontend. All Stripe API calls go through the Hono backend.
```

---

### Session 6 — PWA

**Goal:** Web app manifest, service worker, offline support, iOS install prompt.

**Prompt:**
```
Session 6 goal: make TRI Momentum a fully installable PWA.

1. Create frontend/public/manifest.json with:
   - name: "TRI Momentum"
   - short_name: "TRI"
   - theme_color: "#1650C8" (the --swim / primary blue)
   - background_color: "#F7F8FC" (the --bg token)
   - display: "standalone"
   - orientation: "portrait"
   - start_url: "/"
   - Icon set: generate SVG-based icons at 192x192 and 512x512 using the T·R·I block logo from TRI_Momentum__standalone_.html

2. Create frontend/public/sw.js — a service worker that:
   - Caches the app shell (HTML, CSS, JS bundles, fonts) on install
   - Uses a cache-first strategy for static assets
   - Uses a network-first strategy for Supabase API calls (so data is fresh when online, falls back gracefully when offline)
   - Shows the cached Today tab when offline rather than an error state

3. Register the service worker in frontend/src/main.jsx.

4. Add an install prompt: when the browser fires the beforeinstallprompt event, show a subtle banner (not a modal) at the bottom of the screen above the nav bar. "Add to Home Screen" with a dismiss option. Store the dismissed state so it doesn't reappear.

5. Add iOS-specific meta tags to index.html: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-touch-icon.

6. Update vite.config.js to output deterministic chunk hashes for cache-busting.

Test by running Lighthouse in Chrome DevTools and confirming a PWA score of 90+.
```

---

### Session 7 — Garmin Integration (Future)

*Do not build this until Sessions 1–6 are deployed and the first paying users are onboarded. See CLAUDE.md for scope notes.*

---

### Session 8 — Club Features (Future)

*Out of sequence. Database schema already supports multi-user. Do not build until directed.*

---

## Part 5 — Deployment

### Step 5.1 — Deploy the frontend to Vercel

```bash
# From the frontend/ directory
npx vercel
```

Vercel will detect Vite automatically. When prompted:
- Set build command: `npm run build`
- Set output directory: `dist`

Add your environment variables in the Vercel dashboard under Settings → Environment Variables (the `VITE_` prefixed ones from `.env.example`).

### Step 5.2 — Deploy the backend to Fly.io

```bash
# From the backend/ directory
fly launch
fly secrets set SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." STRIPE_SECRET_KEY="..." STRIPE_WEBHOOK_SECRET="..."
fly deploy
```

### Step 5.3 — Configure Stripe webhooks

In the Stripe dashboard, add a webhook endpoint pointing to your Fly.io backend URL:

```
https://your-app.fly.dev/stripe/webhook
```

Subscribe to: `checkout.session.completed`, `customer.subscription.deleted`

Copy the webhook signing secret into your Fly.io secrets as `STRIPE_WEBHOOK_SECRET`.

### Step 5.4 — Configure Supabase Auth redirect URLs

In Supabase → Authentication → URL Configuration:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

For Google OAuth, also add the production redirect URL to your Google Cloud Console OAuth client.

---

## Part 6 — Working Effectively with Claude Code Day-to-Day

### When Claude Code drifts from the design system

If Claude Code produces a component that deviates from the design spec, correct it precisely:

```
This component is using 14px border-radius. CLAUDE.md specifies 16px for cards.
Fix the border-radius and check all other components built in this session for
the same drift.
```

Claude Code responds better to specific corrections than to vague dissatisfaction.

### When a session produces files you didn't ask for

```
You created src/utils/helpers.js which isn't in the CLAUDE.md file structure.
Does this need to exist, or should this logic live somewhere else?
```

Always push back on structural additions that aren't in the architecture doc. Scope creep in file structure compounds over time.

### When Claude Code hits a context limit mid-session

Use `/compact` to compress the conversation while preserving code decisions:

```
/compact Focus on the Supabase schema and the Upgrade component state.
```

Then continue. Do not start a new session mid-task — compaction is better than losing context.

### When you want to queue multiple prompts

Claude Code supports message queuing. You can type the next prompt while it is still working on the current one. It will hold the queued message and run it when appropriate. Useful for:

```
[Claude is building the checkout handler]
> Also add error handling for network failures in the same handler
> And add a loading state to the Upgrade button while the checkout session creates
```

### Using `--dangerously-skip-permissions` for trusted sessions

By default, Claude Code asks permission before every file edit and command run. For sessions where you are actively watching the output and want it to move faster:

```bash
claude --dangerously-skip-permissions
```

Only do this in sessions where you are present and reviewing output in real time. Never in unattended agentic runs.

---

## Part 7 — Keeping CLAUDE.md Current

`CLAUDE.md` is a living document. Update it whenever:

- A key product decision in the final section changes (e.g. pricing, auth provider, freemium model variant)
- A new data file is added to `frontend/src/data/`
- The session build order advances (tick the Done checkboxes)
- A "What not to build" constraint is lifted

The format is:
```bash
claude
```
Then:
```
Update CLAUDE.md: Session 1 is now complete. Tick the checkbox.
Also add a note under "What not to build": React Router has been
evaluated and confirmed unnecessary — internal useState routing is sufficient.
```

A stale `CLAUDE.md` is worse than no `CLAUDE.md`. Every session that starts from wrong assumptions costs 20 minutes of correction.

---

## Quick Reference: Files to Touch in Each Session

| Session | New files | Modified files |
|---|---|---|
| 1 | `frontend/src/index.css`, all component stubs, `vite.config.js`, `App.jsx` | — |
| 2 | `supabase.js`, `useAuth.js`, `useProfile.js`, `Auth.jsx` | `App.jsx` |
| 3 | `useReflections.js`, `Onboarding.jsx`, `PhasePill.jsx` | All 4 tab components, `App.jsx` |
| 4 | `Upgrade.jsx` | `tipResolver.js`, `Tips.jsx`, `Week.jsx` |
| 5 | `backend/src/index.js`, `stripe.js`, `supabase-admin.js` | `Upgrade.jsx` |
| 6 | `manifest.json`, `sw.js` | `main.jsx`, `index.html`, `vite.config.js` |

---

*Guide version: April 2026. Aligned with CLAUDE.md v3 (variable block length, phasePosition resolver).*
