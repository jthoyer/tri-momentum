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
--ink3: #626B8C; /* darkened from #8B93B8 — the original failed WCAG AA (3.02:1 on white); this clears 4.5:1 on --s1/--bg/--blue-l */

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
--phase-build: #A64C09; --phase-build-l: #FFF1E0;  /* tangerine — darkened from #D9660B, which failed WCAG AA (3.23:1 on --phase-build-l); this clears 5.17:1 */
--phase-peak: #993C1D;  --phase-peak-l: #FAECE7;   /* red — shares --run's hex, but is its own token */
```

## Typography

- **One family, Outfit (400, 500, 600), for everything** — replaced the earlier two-family DM Sans (body/display) + DM Mono (labels) system. With a single typeface, the "sentence a human reads" vs. "the interface talking about itself" distinction is carried by weight/case/letter-spacing, not a family switch: body and titles stay sentence case at normal tracking; labels/eyebrows/badges go uppercase with wide tracking. `--fd`, `--fb`, and `--fm` in `index.html` all point to Outfit now — the three token names stay (still useful for "what role is this text playing"), only the value changed.
- **Page titles:** 23px, weight 600, letter-spacing -0.3px, line-height 1.25 (`h1` in `index.html`)
- **Eyebrows / tags / "mono" labels:** Outfit, 14px, uppercase, letter-spacing 0.1em (`.eyebrow` in `index.html`) — still called "mono" by convention/class-name (`.race-month-label`, etc.) even though it's no longer a literal monospace typeface
- **Body copy:** 13–15px, color `--ink2`, line-height 1.55–1.65

## Layout

- Max width: 430px, centred — never wider
- Horizontal padding: 1.25rem (20px) throughout
- Bottom nav: 84px fixed (`--tabbar-h`), flex row, 5 equal-width tabs
- Page headers: sticky, white background, 0.5px border-bottom in `--bd`
- Cards: white background, 0.5px border in `--bd2`, border-radius 16px
- All scrollable areas: hide scrollbars, `-webkit-overflow-scrolling: touch`

## Component patterns

- **Primary CTA button:** full width, 14px padding, `--blue` background, Outfit 17px weight 600
- **Ghost button:** full width, transparent, `--bd2` border. Transparent only reads as a real button on a **white (`--s1`) surface** — the flow footer, cards, etc. On the page background (`--bg`, a near-white grey), transparent blends in and looks disabled/unpressable; use a solid `--s1` fill with the `--bd2` border there instead (see Add a race toggle below)
- **Status chips:** pill shape, 6px/14px padding, border-radius 20px
- **Insight card:** `--blue` background, white text, italic body copy
- **Prompt blocks:** `--blue-l` background, 3px left border in `--blue`, italic text
- **Month week phase pill:** solid `--phase-{base,build,peak}` background, reversed light text in the matching `-l` tint, pill shape (999px radius), 3px/10px padding, Outfit 11.5px weight 600 — sits inline next to the "Week N" label in each Month-view week card (`.month-week-pill` in `index.html`)
- **Splash countdown card:** on the splash's `--blue` background, a translucent white card (`rgba(255,255,255,.12)` fill, `rgba(255,255,255,.22)` 1px border, `--rlg` radius) `56px` below the headline (doubled from an original `28px` — read as too tight, crowding the headline) — Outfit eyebrow ("Next race"), Outfit 15px/600 race name, Outfit 22px/600 countdown line. Only considers races with commitment `locked` ("Locked in") — a "Considering" race, however soon, never appears here, since the splash is meant to reflect a real commitment, not a maybe (`nextRace()` in `index.html`). Hidden entirely when there's no upcoming *locked* race, rather than showing an empty state (`.splash-countdown` in `index.html`)
- **Race card:** native `<details>` disclosure, `--rlg` radius, `overflow:hidden` so the two internal bands clip to the rounded corners — **soft two-layer shadow instead of a flat border** (`0 1px 2px rgba(14,16,32,.04), 0 10px 24px -10px rgba(14,16,32,.16)`), the "lifted card" treatment borrowed from the Strength apps' exercise rows, recoloured to this app's `--ink` rather than reusing their palette. Collapsed by default; the whole header (banner + meta, all inside `<summary>`) is always visible even collapsed, so nothing needs an extra tap to see. Two-band header, echoing the club calendar reference app's race card:
  - **Banner headline:** `--bd2` fill (same tone for every card — the nearest-upcoming distinction lives in the card's outer ring/shadow, not the banner colour), 16px/16-14px padding, race name in `--ink` Outfit 17px/600 as the headline, `--ink` rotating chevron top-right, and the commitment pill inline next to the name (wraps onto its own line on long names via `flex-wrap`). Whole banner is the disclosure's click target (via `<summary>`). Iterated through an earlier `--blue-l` tint (too close to the page background to register as a header band) and a solid `--blue` fill with white text, before landing on `--bd2` — a neutral 14%-ink tone that reads as a distinct header band without competing with the commitment pill's colour; `--ink` text/chevron clears 18.9:1 contrast against it (well past the 4.5:1 AA minimum below). The commitment pill keeps its own self-contained fill/text pairing, so it stays legible regardless of banner colour.
  - **Grey meta section:** `--s3` fill immediately below the banner, 10px/16px padding, date (Outfit, `--ink2`) and countdown (Outfit 600, `--ink`) on one row.
  - Expanded body (`padding:12px 16px 16px`, white): notes, a labelled "Race website" section (see below), and Remove.
- **Card section label:** Outfit, 10.5px, uppercase, 0.08em letter-spacing, `--ink3` — e.g. "RACE WEBSITE" — labels a distinct field inside an expanded race card, echoing the labelled-section pattern from the club calendar reference app's expanded race view. The link beneath it shows the full URL exactly as stored, not a generic "Race website" label (`.race-card-section-label` in `index.html`)
- **Section header with count pill:** Outfit eyebrow ("Upcoming") on the left, a `--s3`-fill count pill ("4 races") on the right — the Races tab's own header for its Upcoming/Past lists, echoing the Strength apps' phase-card header (eyebrow + trailing status pill). Deliberately its own class (`.race-section`/`.race-section-hd`), not a reuse of the shared `.dash-section` (which stays plain-eyebrow-only for Review/Month) — a change there would have cascaded to every other signal section in the app
- **Month group label:** Outfit, 12px, uppercase, 0.08em letter-spacing, `--ink3` — e.g. "Sep 2026" — sits above each run of same-month race cards on the Races tab, grouping the Upcoming/Past lists the way the athlete's club calendar reference app groups by month (`.race-month-label` in `index.html`)
- **Form field label:** Outfit 13.5px weight 600, `margin-bottom:12px` before its input/textarea (double the original 6px — cramped otherwise) — applies to every field on the Add a race form, including the Commitment toggle's label, which is a `<span>` rather than a `<label>` (it labels a radio group, not one control) but shares the exact same `.field-lbl` class and styling (`.race-field .field-lbl` in `index.html`)
- **Add a race toggle:** full-width pill button, `--blue` fill/white text when closed ("Add a race" — no "+", plain label reads clearly enough on its own), flips to a **solid white** pill (`--s1` fill, `--bd2` border, "Cancel") when open — not transparent. A transparent fill on the page's `--bg` background read as a disabled/unpressable button; white + border reads as a real secondary button. Sits above the (collapsed-by-default) add-race form on the Races tab; the form auto-collapses back behind the button after a successful add. Mirrors the toggle-a-hidden-form pattern from the athlete's club calendar reference app's "Add a race +" button, minus its own "+" (`.race-add-toggle` in `index.html`)
- **Commitment pill:** solid-fill pill (999px radius, 3px/10px padding, Outfit 11.5px weight 600) reading "Considering" (`--phase-build`/`--phase-build-l`, tangerine) or "Locked in" (`--done`/`--done-l`, green) — same reversed-fill convention as the Month week phase pill. Set via a two-option `.choices.grid2` toggle on the Add a race form (defaults to "Considering"), shown inline next to the race name in the card banner (`.race-status-pill` in `index.html`). The underlying value is a `Status` column on the `Races` sheet tab (`RACE_HEADERS` in `apps-script/Code.gs`) — it's fine to flip a race from "Considering" to "Locked in" (or back) by editing that column directly in the spreadsheet rather than only through the app; the next Sheet read (`listRaces_`) picks it up, same as any other race field. This is what the splash's "Next race" countdown keys off — see Splash countdown card above.
- **Text input:** same shape as `.date-input` (1px `--bd2` border, `--rmd` radius, 52px min-height) but full width — used for race name/website fields (`.text-input` in `index.html`). Never use `type="url"` for a free-text website field — its native constraint validation requires a full `https://` scheme and silently blocks form submission on a bare domain like `ironman.com/geelong`; use `type="text"` and prefix the scheme at render time instead

## Accessibility

- **Text colour must clear WCAG AA contrast — 4.5:1 for normal text, 3:1 for large text (18px+/14px bold+) and UI components/icons** — check any new colour against its actual background before shipping, not just against `--bg`/white in isolation. `--ink3` was originally `#8B93B8` (3.02:1 on white, 2.84:1 on `--bg`) — it read fine to the eye but failed AA everywhere it was used: `.eyebrow`, `.dash-eyebrow`, dates, hints, placeholders. Darkened to `#626B8C` (5.25:1 on white, 4.95:1 on `--bg`, 4.55:1 on `--blue-l`) — a token-level fix, not a per-component override, so every screen using "tertiary grey" got fixed at once rather than leaving some places compliant and others not. `--ink2` (7.56:1) and `--ink` (18.86:1) were already comfortably compliant and weren't touched.
- **`--phase-build` was originally `#D9660B`** — 3.23:1 for `--phase-build-l` text on it (a solid-pill badge colour, used at 11.5px bold — small enough to need the 4.5:1 bar, not the 3:1 large-text one). Surfaced when the "Considering" race commitment pill adopted this token; the same pairing was already failing on the Month week phase pill for Build, just unnoticed until a second use case put it in front of the same check. Darkened to `#A64C09` (5.17:1 on `--phase-build-l`, 5.74:1 on white) — token-level fix again, so both usages got corrected together. Even white text on the original `#D9660B` only reached 3.59:1, so a text-colour swap alone wouldn't have been enough — the background itself needed to darken.
