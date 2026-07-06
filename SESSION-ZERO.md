# TRI Momentum — Claude Code Handoff Briefing

> Read this once at the start of your first Claude Code session, then read CLAUDE.md.
> This file describes where the project stands today. CLAUDE.md is the architecture authority.

---

## Where we are

The prototype is complete and live. The production build has not started.

**Prototype:** https://jthoyer.github.io/tri-momentum/
**Repo:** https://github.com/jthoyer/tri-momentum

The GitHub Pages repo currently holds four files only:
- `index.html` — the v5 single-file prototype, PWA meta tags added, `localStorage` storage
- `manifest.json` — PWA manifest
- `sw.js` — cache-first service worker
- `README.md`

This is the prototype branch. The production build will be structured per the file tree in CLAUDE.md and will live on Vercel (frontend) + Fly.io (backend). The prototype repo can be left as-is or archived once production is live.

---

## What the prototype proves

Five iterations of a single-file HTML/JS app were built and tested in Claude's artifact renderer. By v5, the following were working:

- Full design system (CSS custom properties, DM Sans + DM Mono, discipline colours, phase colours)
- Four tab screens: Today, Week, Tips, Calendar
- Two onboarding screens: mode selection (race-targeting vs. open training), date setup
- Tip resolution engine: `resolvePosition()` → phase × phasePosition × pillar × day
- Race-proximity overlay: 5 zones (awareness, taper, raceweek, raceday, post)
- Session status logging (done / modified / skipped) with visual state
- Weekly reflection inputs (readiness score, grey-zone %, notes)
- Cadence selector with phase-aware insight cards
- `localStorage` persistence (was `window.storage` in the Claude artifact version — already migrated)

None of this needs to be redesigned. The migration job is to decompose the single file into the React component tree defined in CLAUDE.md, wire Supabase for persistence, and add the freemium gate.

---

## Key files already in this repo (project files, not GitHub)

These exist in the Claude project and need to be copied into your local repo before Session 1:

| File | Destination | Notes |
|---|---|---|
| `CLAUDE.md` | repo root | Architecture north star — Claude Code reads this automatically |
| `triathlon_momentum_v5.html` | repo root | Source of truth for all visual decisions |
| `tipResolver.js` | `frontend/src/lib/` | v3 — do not rewrite. `resolvePosition()`, `resolveTip()`, `resolveProximityZone()` all correct |
| `tips.js` | `frontend/src/data/` | Partially populated — Base phase content exists, Build/Peak/Recovery sparse |
| `raceProximity.js` | `frontend/src/data/` | 23 cards across 5 proximity zones — complete |
| `tri-momentum-claude-code-guide.md` | repo root (optional) | Session-by-session build prompts — paste directly into Claude Code |

---

## Session build order — current status

| Session | Scope | Status |
|---|---|---|
| 1 | Scaffold Vite + React, migrate v5 HTML into components, establish file structure | **Not started — start here** |
| 2 | Supabase auth (magic link + Google), user_profiles table, useAuth hook | Not started |
| 3 | Migrate all state from localStorage to Supabase | Not started |
| 4 | Freemium gating — phase wall, reflection save wall, Upgrade bottom sheet | Not started |
| 5 | Stripe integration — checkout, webhooks, subscription status | Not started |
| 6 | PWA — manifest, service worker, offline support, install prompt | Not started (prototype version shipped to GitHub Pages only) |
| 7 | Garmin integration | Future |
| 8 | Club features | Future |

---

## Decisions already locked — do not relitigate

1. **Stack:** React + Vite (frontend) · Hono on Node.js (backend) · Supabase (auth + DB) · Stripe (payments) · Vercel (frontend hosting) · Fly.io (backend hosting)
2. **No Tailwind.** The design system uses CSS custom properties. Tailwind fights it. CLAUDE.md is explicit.
3. **No React Router.** `useState` routing is sufficient for this MVP.
4. **No server-side rendering.** Client-side SPA + thin Hono API.
5. **Max width 430px.** Never wider. Mobile-first throughout.
6. **Freemium gate:** Base phase free (all 4 block weeks, all 6 pillars). Build, Peak, Recovery, and race-proximity overlay require Pro.
7. **Pricing:** $9.99 AUD/month · $79 AUD/year
8. **Auth:** Supabase magic link + Google OAuth. No passwords.
9. **Tips are static content** bundled client-side — not served from the database.
10. **Garmin is backend-only** — credentials never touch the frontend.

---

## Open questions (resolve before Session 3)

These were flagged in the PRD and affect the Supabase schema:

1. **Does the cadence selector persist to Supabase or stay session-only?** If it persists, the schema needs a `cadences` column or table. Resolve before Session 3.
2. **Does the weekly reflection include a structured readiness score (1–5) or remain qualitative?** Affects the reflections table schema. Resolve before Session 3.
3. **What happens when an athlete changes their race date mid-block?** `resolveProximityZone()` depends on `nextRaceDate`. The update flow is currently undefined.

---

## How to start Session 1

```bash
# 1. Clone or navigate to your local repo
cd tri-momentum

# 2. Copy in the project files listed above (CLAUDE.md, triathlon_momentum_v5.html, etc.)

# 3. Open Claude Code
claude

# 4. Paste the Session 1 prompt from tri-momentum-claude-code-guide.md
```

The Session 1 prompt is ready to paste verbatim from the guide. It scaffolds the full Vite + React structure, migrates the design system and JS constants, stubs all four tab components, and wires the bottom nav.

---

*Handoff date: May 2026. Prototype v5. Production build: Session 1 not yet started.*
