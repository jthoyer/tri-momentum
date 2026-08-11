# TRI Momentum — style guide

> This is the design system's source of truth: colour tokens, typography, layout rules, and component patterns.
> Preserve it exactly across all new components — **this applies to both the current app (`index.html`) and any target-architecture work.** Never introduce Tailwind, Bootstrap, or component libraries that override these tokens.
>
> [TRI-Momentum-Design-Guide.html](TRI-Momentum-Design-Guide.html) is a browsable visual rendering of this file — every swatch, type sample, and component tile in it is compiled from what's documented here. Update this file first when a design decision changes, then bring the HTML guide in sync.
>
> Product context, feature history, and the "why" behind decisions live in [CLAUDE.md](CLAUDE.md), not here — this file is tokens and patterns only.

## Colour tokens (CSS custom properties)

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

/* Phase colours — own tokens, not reused from discipline colours */
--phase-base: #0F6E56;  --phase-base-l: #E1F5EE;   /* green */
--phase-build: #D9660B; --phase-build-l: #FFF1E0;  /* tangerine */
--phase-peak: #993C1D;  --phase-peak-l: #FAECE7;   /* red — shares --run's hex, but is its own token */
```

## Typography

- **Body / UI:** DM Sans (400, 500, 600)
- **Monospace / labels / badges:** DM Mono (400, 500)
- **Page titles:** 23px, weight 600, letter-spacing -0.3px, line-height 1.25 (`h1` in `index.html`)
- **Eyebrows / tags:** DM Mono, 14px, uppercase, letter-spacing 0.1em (`.eyebrow` in `index.html`)
- **Body copy:** 13–15px, color `--ink2`, line-height 1.55–1.65

## Layout

- Max width: 430px, centred — never wider
- Horizontal padding: 1.25rem (20px) throughout
- Bottom nav: 84px fixed (`--tabbar-h`), flex row, 5 equal-width tabs
- Page headers: sticky, white background, 0.5px border-bottom in `--bd`
- Cards: white background, 0.5px border in `--bd2`, border-radius 16px
- All scrollable areas: hide scrollbars, `-webkit-overflow-scrolling: touch`

## Component patterns

- **Primary CTA button:** full width, 14px padding, `--blue` background, DM Sans 17px weight 600
- **Ghost button:** full width, transparent, `--bd2` border
- **Status chips:** pill shape, 6px/14px padding, border-radius 20px
- **Insight card:** `--blue` background, white text, italic body copy
- **Prompt blocks:** `--blue-l` background, 3px left border in `--blue`, italic text
- **Month week phase pill:** solid `--phase-{base,build,peak}` background, reversed light text in the matching `-l` tint, pill shape (999px radius), 3px/10px padding, DM Sans 11.5px weight 600 — sits inline next to the "Week N" label in each Month-view week card (`.month-week-pill` in `index.html`)
- **Splash countdown card:** on the splash's `--blue` background, a translucent white card (`rgba(255,255,255,.12)` fill, `rgba(255,255,255,.22)` 1px border, `--rlg` radius) below the headline — DM Mono eyebrow ("Next race"), DM Sans 15px/600 race name, DM Sans 22px/600 countdown line. Hidden entirely when there's no upcoming race, rather than showing an empty state (`.splash-countdown` in `index.html`)
- **Race card:** white card, `--bd2` border, `--rlg` radius, matching `.floor-card`/`.week-row` conventions — DM Mono date + countdown on one line, DM Sans 16px/600 race name, a commitment pill (see below), optional notes and "Race website" link, "Remove" text action. The nearest upcoming race gets `--blue`/`--blue-l` emphasis (`.race-card.is-next` in `index.html`)
- **Commitment pill:** solid-fill pill (999px radius, 3px/10px padding, DM Sans 11.5px weight 600) reading "Considering" (`--modified`/`--modified-l`, amber) or "Locked in" (`--done`/`--done-l`, green) — same reversed-fill convention as the Month week phase pill. Set via a two-option `.choices.grid2` toggle on the Add a race form (defaults to "Considering"), shown on every race card (`.race-status-pill` in `index.html`)
- **Text input:** same shape as `.date-input` (1px `--bd2` border, `--rmd` radius, 52px min-height) but full width — used for race name/website fields (`.text-input` in `index.html`). Never use `type="url"` for a free-text website field — its native constraint validation requires a full `https://` scheme and silently blocks form submission on a bare domain like `ironman.com/geelong`; use `type="text"` and prefix the scheme at render time instead
