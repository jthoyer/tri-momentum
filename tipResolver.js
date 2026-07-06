/**
 * TRI Momentum — Tip Resolver
 * frontend/src/lib/tipResolver.js
 *
 * Resolves the athlete's current training position from:
 *   - training_start_date  (stored in user_profiles)
 *   - block_config         (stored in user_profiles — set during onboarding)
 *
 * Block config shape:
 *   { base: N, build: N, peak: N, recovery: 1 }
 *   Ranges: base 1–8, build 1–4, peak 1–4, recovery always 1.
 *
 * Phase position resolution:
 *   1 week phase  → 'only'
 *   2 week phase  → early, late
 *   3 week phase  → early, mid, late
 *   4+ week phase → early, mid (repeating), late
 *
 * Race-proximity overlay runs in parallel: when the user is within 21 days
 * of their race date, resolveProximityZone() returns the zone string.
 * Tips.jsx uses this to supplement or replace the block tip.
 *
 * v3 — April 2026. Variable block length (phasePosition replaces blockWeek).
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASES = ['base', 'build', 'peak', 'recovery'];

// Default block config — used if none is stored for the user
export const DEFAULT_BLOCK_CONFIG = {
  base:     4,
  build:    3,
  peak:     2,
  recovery: 1,
};

// Valid ranges for onboarding validation
export const BLOCK_CONFIG_RANGES = {
  base:     { min: 1, max: 8 },
  build:    { min: 1, max: 4 },
  peak:     { min: 1, max: 4 },
  recovery: { min: 1, max: 1 },  // always 1
};

// Pillar emphasis per phase × phasePosition (Option B)
export const PILLAR_EMPHASIS = {
  base:     { early: 'foundations', mid: 'technique', late: 'durability', only: 'foundations' },
  build:    { early: 'intensity',   mid: 'technique', late: 'durability', only: 'intensity'   },
  peak:     { early: 'racecraft',   mid: 'intensity', late: 'durability', only: 'racecraft'   },
  recovery: { only:  'durability' },
};

// All 6 pillars — used to drive secondary pillar list in Tips tab
export const ALL_PILLARS = [
  'foundations',
  'technique',
  'durability',
  'intensity',
  'racecraft',
  'integration',
];

// Human-readable labels
export const PILLAR_LABELS = {
  foundations: 'Foundations',
  technique:   'Technique',
  durability:  'Durability',
  intensity:   'Intensity',
  racecraft:   'Race craft',
  integration: 'Integration',
};

export const PHASE_POSITION_LABELS = {
  early: 'Early',
  mid:   'Mid',
  late:  'Late',
  only:  '',
};

// ─── Block length → phasePosition ────────────────────────────────────────────

/**
 * Resolve the phasePosition label for a given week within a phase.
 *
 * @param {number} weekInPhase   1-indexed week within the phase (1 = first week)
 * @param {number} phaseLength   total weeks in this phase
 * @returns {'early'|'mid'|'late'|'only'}
 */
export function resolvePhasePosition(weekInPhase, phaseLength) {
  if (phaseLength === 1) return 'only';
  if (weekInPhase === 1) return 'early';
  if (weekInPhase === phaseLength) return 'late';
  return 'mid';
}

// ─── Position resolver ────────────────────────────────────────────────────────

/**
 * Resolves the athlete's current training position from their training start
 * date and block config.
 *
 * @param {Date}   trainingStartDate
 * @param {object} blockConfig        { base: N, build: N, peak: N, recovery: 1 }
 * @param {Date}  [today]             defaults to new Date()
 *
 * @returns {{
 *   phase:          string,   // 'base' | 'build' | 'peak' | 'recovery'
 *   phasePosition:  string,   // 'early' | 'mid' | 'late' | 'only'
 *   emphasisPillar: string,   // pillar to surface on Today tab
 *   weekInPhase:    number,   // 1-indexed week within current phase
 *   phaseLength:    number,   // total weeks in current phase (from blockConfig)
 *   blockNumber:    number,   // which full block cycle the user is in (1-indexed)
 *   weekInBlock:    number,   // 0-indexed position within current block
 *   weekInSeason:   number,   // total weeks elapsed since training start (0-indexed)
 * }}
 */
export function resolvePosition(trainingStartDate, blockConfig = DEFAULT_BLOCK_CONFIG, today = new Date()) {
  const cfg = { ...DEFAULT_BLOCK_CONFIG, ...blockConfig, recovery: 1 };

  const msPerDay     = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.max(0, Math.floor((today - trainingStartDate) / msPerDay));
  const weekInSeason = Math.floor(daysSinceStart / 7);

  // Total block length for this config
  const blockLength = PHASES.reduce((sum, ph) => sum + cfg[ph], 0);

  const blockNumber = Math.floor(weekInSeason / blockLength) + 1;
  const weekInBlock = weekInSeason % blockLength; // 0-indexed

  // Walk phases to find which one we're in
  let cursor = 0;
  for (const phase of PHASES) {
    const phaseLength = cfg[phase];
    if (weekInBlock < cursor + phaseLength) {
      const weekInPhase   = weekInBlock - cursor + 1; // 1-indexed
      const phasePosition = resolvePhasePosition(weekInPhase, phaseLength);
      const emphasisPillar = PILLAR_EMPHASIS[phase][phasePosition];
      return {
        phase,
        phasePosition,
        emphasisPillar,
        weekInPhase,
        phaseLength,
        blockNumber,
        weekInBlock,
        weekInSeason,
      };
    }
    cursor += phaseLength;
  }

  // Fallback — should never reach here
  return {
    phase:          'base',
    phasePosition:  'early',
    emphasisPillar: 'foundations',
    weekInPhase:    1,
    phaseLength:    cfg.base,
    blockNumber:    1,
    weekInBlock:    0,
    weekInSeason:   0,
  };
}

// ─── Content lookup ───────────────────────────────────────────────────────────

/**
 * Resolve a single tip card.
 * Returns null if the slot has no content (graceful degradation).
 *
 * @param {object} CARD_CONTENT
 * @param {string} phase
 * @param {string} phasePosition   'early' | 'mid' | 'late' | 'only'
 * @param {string} pillar
 * @param {string} day             'tue' | 'thu' | 'sun'
 * @returns {object|null}
 */
export function resolveTip(CARD_CONTENT, phase, phasePosition, pillar, day) {
  return CARD_CONTENT?.[phase]?.[phasePosition]?.[pillar]?.[day] ?? null;
}

/**
 * Resolve all six pillar tips for a given phase + position + day.
 * Returns an array of { pillar, tip } pairs, filtering out nulls.
 * Used to populate the full Tips tab.
 *
 * @param {object} CARD_CONTENT
 * @param {string} phase
 * @param {string} phasePosition
 * @param {string} day
 * @returns {Array<{ pillar: string, tip: object }>}
 */
export function resolveAllPillarsForDay(CARD_CONTENT, phase, phasePosition, day) {
  return ALL_PILLARS
    .map(pillar => ({
      pillar,
      tip: resolveTip(CARD_CONTENT, phase, phasePosition, pillar, day),
    }))
    .filter(({ tip }) => tip !== null);
}

// ─── Block config helpers ─────────────────────────────────────────────────────

/**
 * Validate a block config object from onboarding.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateBlockConfig(config) {
  const errors = [];
  for (const phase of PHASES) {
    const val = config?.[phase];
    const range = BLOCK_CONFIG_RANGES[phase];
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      errors.push(`${phase}: must be an integer`);
    } else if (val < range.min || val > range.max) {
      errors.push(`${phase}: must be between ${range.min} and ${range.max} (got ${val})`);
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Returns the total block length in weeks for a given config.
 *
 * @param {object} blockConfig
 * @returns {number}
 */
export function blockLength(blockConfig = DEFAULT_BLOCK_CONFIG) {
  const cfg = { ...DEFAULT_BLOCK_CONFIG, ...blockConfig, recovery: 1 };
  return PHASES.reduce((sum, ph) => sum + cfg[ph], 0);
}

/**
 * Returns a human-readable summary of the block config.
 * e.g. "4w base → 3w build → 2w peak → 1w recovery (10 weeks)"
 *
 * @param {object} blockConfig
 * @returns {string}
 */
export function describeBlockConfig(blockConfig = DEFAULT_BLOCK_CONFIG) {
  const cfg = { ...DEFAULT_BLOCK_CONFIG, ...blockConfig, recovery: 1 };
  const parts = PHASES.map(ph => `${cfg[ph]}w ${ph}`);
  return `${parts.join(' → ')} (${blockLength(cfg)} weeks)`;
}

// ─── Race-proximity resolver ──────────────────────────────────────────────────

/**
 * Returns the proximity zone string if the user is within 21 days of
 * a race, or null if no overlay should be shown.
 *
 * Zones:
 *   'awareness'  — 15–21 days out: supplement the block tip
 *   'taper'      — 8–14 days out:  equal weight with block tip
 *   'raceweek'   — 2–7 days out:   replaces block tip entirely
 *   'raceday'    — race morning:   replaces block tip entirely
 *   'post'       — 1–7 days post:  replaces block tip entirely
 *   null         — beyond 21 days or more than 7 days post
 *
 * @param {Date}  raceDate
 * @param {Date} [today]
 * @returns {string|null}
 */
export function resolveProximityZone(raceDate, today = new Date()) {
  const msPerDay   = 1000 * 60 * 60 * 24;
  const daysToRace = Math.ceil((raceDate - today) / msPerDay);

  if (daysToRace < -7)  return null;
  if (daysToRace < 0)   return 'post';
  if (daysToRace === 0) return 'raceday';
  if (daysToRace <= 7)  return 'raceweek';
  if (daysToRace <= 14) return 'taper';
  if (daysToRace <= 21) return 'awareness';
  return null;
}

/**
 * Returns the days-to-race integer (positive = before race, negative = after).
 *
 * @param {Date}  raceDate
 * @param {Date} [today]
 * @returns {number}
 */
export function daysToRace(raceDate, today = new Date()) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((raceDate - today) / msPerDay);
}

/**
 * Resolve a race-proximity tip card.
 *
 * Key by zone:
 *   awareness / taper → day string ('tue' | 'thu' | 'sun')
 *   raceweek          → days_to_race integer (2–7)
 *   raceday           → 'morning'
 *   post              → days_since_race integer (1, 2, 3, 7)
 *
 * @param {object}        RACE_PROXIMITY_CONTENT
 * @param {string}        zone
 * @param {string|number} key
 * @returns {object|null}
 */
export function resolveProximityTip(RACE_PROXIMITY_CONTENT, zone, key) {
  return RACE_PROXIMITY_CONTENT?.[zone]?.[key] ?? null;
}

// ─── Freemium gate ────────────────────────────────────────────────────────────

/**
 * Returns true if the user can access content for this phase.
 *
 * Current gate: Base phase free, all others paid (Option A — phase gate).
 * To switch to Option B (reflection gate): remove this check in Tips.jsx
 * and gate only on the reflection save action.
 *
 * @param {string} phase            'base' | 'build' | 'peak' | 'recovery'
 * @param {string} subscriptionTier 'free' | 'paid'
 * @returns {boolean}
 */
export function canAccessPhase(phase, subscriptionTier) {
  if (subscriptionTier === 'paid') return true;
  return phase === 'base';
}
