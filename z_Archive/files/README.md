# TRI Momentum — Prototype

Decision-support coaching for age-group triathletes. Olympic and 70.3 distance.

**Live prototype:** https://jthoyer.github.io/tri-momentum/

---

## What this is

A mobile-first PWA prototype (v5) built as a single-file app. Demonstrates the full UX — onboarding, Today tab, Week tab, Tips tab, Calendar tab — with a working tip resolution engine and race-proximity overlay system.

This is a prototype, not the production build. All data is stored in `localStorage`.

## Deploy to GitHub Pages in 5 minutes

```bash
# 1. Create repo at github.com/new — name it "tri-momentum"
# 2. Clone it
git clone https://github.com/jthoyer/tri-momentum.git
cd tri-momentum

# 3. Copy these files in:
#    index.html    manifest.json    sw.js    README.md
#    icons/        (see Icons section below)

# 4. Push
git add .
git commit -m "Ship prototype v5 as PWA"
git push

# 5. Enable GitHub Pages
#    → Settings → Pages → Source: Deploy from branch → Branch: main → / (root)
```

Done. The site is live at `https://jthoyer.github.io/tri-momentum/` within ~60 seconds.

## Icons

GitHub Pages will serve without icons, but the PWA "Add to Home Screen" prompt works best with them. Generate from any square image:

1. Go to https://realfavicongenerator.net
2. Upload a 512×512 image (the TRI Momentum logo or a plain `#1650C8` square with white T-R-I text)
3. Download the package
4. Copy `android-chrome-192x192.png` → `icons/icon-192.png`
5. Copy `android-chrome-512x512.png` → `icons/icon-512.png`

## From prototype to production

When the four open questions are resolved, production build starts in Claude Code:

```
tri-momentum/
├── frontend/     ← Vite + React (migrated from this single file)
├── backend/      ← Hono + Stripe webhooks
├── supabase/     ← migration files
└── CLAUDE.md     ← project north star
```

Production hosting: Vercel (frontend) + Fly.io (backend).

## Storage

Prototype uses `localStorage` under the key `tri_v4_state`.
Production will migrate to Supabase (Session 3 in Claude Code build order).

Export/import is not built into the prototype — if you need to transfer state between devices, open DevTools → Application → Local Storage → copy the value of `tri_v4_state`.

---

*Prototype v5 — May 2026. Production build has not started.*
