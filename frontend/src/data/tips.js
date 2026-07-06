/**
 * TRI Momentum — Block-Relative Tip Content
 * frontend/src/data/tips.js
 *
 * Schema: CARD_CONTENT[phase][phasePosition][pillar].{tue|thu|sun}.{title|mech|prompt|good|med}
 *
 * Phases:         base | build | peak | recovery
 * Phase positions: early | mid | late | only
 *   early  — first week of a 2+ week phase
 *   mid    — middle weeks of a 3+ week phase (repeats for longer phases)
 *   late   — final week of any phase
 *   only   — phase is exactly 1 week long
 *   recovery always uses 'only'
 *
 * Position resolution by phase length:
 *   1 week:  only
 *   2 weeks: early → late
 *   3 weeks: early → mid → late
 *   4+ weeks: early → mid (repeating) → late
 *
 * Pillars:  foundations | technique | durability | intensity | racecraft | integration
 *
 * Pillar emphasis per phase × position (Option B — position drives pillar):
 *   phase     | early        | mid        | late       | only
 *   base      | foundations  | technique  | durability | foundations
 *   build     | intensity    | technique  | durability | intensity
 *   peak      | racecraft    | intensity  | durability | racecraft
 *   recovery  | —            | —          | —          | durability
 *
 * Block config: set by athlete during onboarding. Stored in user_profiles.block_config.
 *   { base: N, build: N, peak: N, recovery: 1 }
 *   Ranges: base 1–8, build 1–4, peak 1–4, recovery always 1.
 *
 * Migration from v2 (blockWeek 1–4):
 *   base[1]→early, base[2+3]→mid (wk3 wins on conflict), base[4]→late
 *   Same pattern for build and peak. recovery[1]→only.
 *
 * Freemium gate: enforced in Tips.jsx via canAccessPhase() from tipResolver.js.
 *   Free tier: base phase only (all positions, all pillars).
 *   Paid tier: all phases.
 *
 * Race-proximity overlay lives in raceProximity.js — separate file,
 * activated by resolveProximityZone() in tipResolver.js.
 *
 * Do not modify this file without explicit instruction.
 * Authoring guide is in CLAUDE.md under "Content — do not modify without instruction".
 *
 * v3 — April 2026. Variable block length migration (blockWeek → phasePosition).
 */

export const CARD_CONTENT = {

  // ═══════════════════════════════════════════════════════════════════════════
  // BASE PHASE — FREE TIER (all positions, all pillars)
  // ═══════════════════════════════════════════════════════════════════════════

  base: {

    // ─── Early ─────────────────────────────────────────────────────────
    // Early — first week. Emphasis: foundations. Opening the phase.

    early: {

      foundations: {
        tue: {
          title: `Your floor is not where you think it is`,
          mech: `Most intermediate athletes confuse 'average week' with 'minimum viable week'. Without a defined floor, the first stressful work week deletes training entirely. The floor is not what you do when things are good — it is what you protect when things are not.`,
          prompt: `What is the actual minimum training you need every week to arrive at the start line better? Name it in sessions, not hours. Write it down. Is it currently protected — or the first thing you sacrifice when work gets heavy?`,
          good: `Defines a non-negotiable floor. Misses the long ride in a hard week but never misses the floor. Consistency compounds.`,
          med: `Has an ideal week in mind. When life hits, the whole plan collapses and the athlete starts the next week from zero.`,
        },
        thu: {
          title: `Your aerobic zone is probably not Zone 2`,
          mech: `Heart rate zones derived from max HR formulas can be off by 15–20 BPM for trained athletes. If your Zone 2 ceiling is too high, every 'easy' session is actually grey zone — accumulating fatigue without producing the aerobic base adaptation you're targeting.`,
          prompt: `In tomorrow's easy session: can you hold a full conversation — genuinely comfortable, not just technically possible? If the answer is 'mostly', drop 10 BPM and observe how Monday feels. That's your data.`,
          good: `Accepts the humbling pace. Trains the actual aerobic system. Faster at the same heart rate by month three.`,
          med: `Defends the higher HR. Continues 'comfortable hard' as 'easy'. Wonders why aerobic fitness feels stuck.`,
        },
        sun: {
          title: `The consistency audit`,
          mech: `One week is enough to reveal your behavioural patterns. The session that gets dropped first under pressure is not a random casualty — it is telling you something structural about how your week is designed.`,
          prompt: `Which session was the first to be shortened or skipped when pressure arrived this week? That session is your early-warning indicator for every hard block ahead. Is it actually skippable — or does it need a different time slot?`,
          good: `Identifies the vulnerable session and reschedules it earlier in the day or week. The pattern changes.`,
          med: `Frames the missed session as a one-off. The same session gets dropped in week three, and week seven.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Fitness is not fixing your swim`,
          mech: `For most adult-learned swimmers, drag — not power — is the primary limiter. A high-drag stroke at higher fitness is still a slow stroke. Adding swim volume without addressing head position, hip drop, or crossover produces a fitter athlete who is still slow.`,
          prompt: `If you held your current fitness but reduced frontal drag by 15% — head still, hips higher, quieter entry — how much time would you gain versus adding 2km per week of volume? Which investment has the higher return?`,
          good: `Spends two weeks on catch drills and head position. Swims faster at the same heart rate. Volume comes later.`,
          med: `Adds another early morning pool session. Gets fitter. Doesn't get faster. Blames genetics.`,
        },
        thu: {
          title: `Cadence before power on the bike`,
          mech: `Pushing big gears at low cadence (under 80 RPM) recruits fast-twitch muscle fibre — the exact resource you need to preserve for the run leg. High cadence (88–95 RPM) shifts the load toward the aerobic system and leaves the legs functional at T2.`,
          prompt: `In your next ride, spend the first 30 minutes at a cadence 5 RPM higher than your default. Track how your legs feel at the 90-minute mark compared to a normal ride. What does that data point tell you about your current T2 state?`,
          good: `Accepts the initial power drop. Adapts cadence over 3–4 weeks. Arrives at T2 with legs that can actually run.`,
          med: `Finds high cadence 'spinny' and uncomfortable. Returns to 75 RPM. Continues the T2 shuffle.`,
        },
        sun: {
          title: `The efficiency question`,
          mech: `Efficiency gains are invisible in training logs — no metric captures them — but they compound across a season. A 5% reduction in energy cost per swim stroke, or a 3% improvement in run economy, produces a meaningfully different athlete by race day without adding a single training hour.`,
          prompt: `Name one technical change you worked on this week across any discipline. Did you feel a difference under fatigue, or just think about it in the first 10 minutes? There is a gap between knowing a correction and executing it when tired.`,
          good: `Tests one movement change deliberately under increasing fatigue across three sessions. Notices what holds and what reverts.`,
          med: `Makes a mental note after the coach says something. Returns to default movement pattern the moment intensity increases.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `Recovery is a session, not an absence`,
          mech: `The adaptation from a training stimulus does not happen during the session — it happens in the 24–72 hours after. An athlete who treats the off-day as unused capacity and fills it is not accumulating more training — they are blocking the adaptation from the session before it.`,
          prompt: `Name your recovery inputs this week — sleep hours, food quality, and the one session you genuinely went easy on. Are those inputs deliberate or accidental? Accidental recovery is not a system — it is luck.`,
          good: `Treats the easy day with the same intention as the hard day. Recovery inputs are planned. Adaptation happens on schedule.`,
          med: `Fills the 'easy' day with low-intensity extras. Arrives at the next hard session at 90% rather than 100%. Wonders why the hard sessions feel harder each week.`,
        },
        thu: {
          title: `Volume without specificity is just mileage`,
          mech: `Aerobic durability is the capacity to hold race-pace effort in the final 20% of race duration — not just the ability to complete the distance. Easy long sessions build the foundation but do not build the specific capacity to perform when fatigued. That requires intentional structure in the back half of long sessions.`,
          prompt: `In your last long ride or run: what happened in the final 30 minutes? Was the fade a conscious pacing decision, or were you genuinely running out of capacity? Those are different problems — one is tactical, one is physiological.`,
          good: `Identifies a pacing problem. Starts building negative-split structure into long sessions. Practices holding form when tired.`,
          med: `Identifies an endurance problem. Adds more long, easy sessions. The fade happens in the same place every time.`,
        },
        sun: {
          title: `Did your long session build durability or confirm fatigue?`,
          mech: `Supercompensation — the adaptation process — requires a recovery window after the training stimulus. A long session that leaves you unable to train well on Tuesday produced the stimulus but may have blocked the adaptation if the recovery was insufficient. More is not always better.`,
          prompt: `Rate your readiness to train hard tomorrow on a scale of 1–10. If below 6: what specifically about today's session — duration, intensity, nutrition, heat — produced that result? And what would you change to arrive at a 7?`,
          good: `Reduces duration or intensity by 10% next week to hit a sustainable readiness score. Adaptation improves.`,
          med: `Views a low readiness score as proof of hard work. Repeats the session. Arrives at week five already suppressed.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Your strength work might be slowing you down`,
          mech: `Strength training for triathletes has one job: structural resilience. Protecting tendons, connective tissue, and running economy under load. The moment a strength session produces enough neuromuscular fatigue to compromise the quality of the subsequent endurance session, it has exceeded its brief.`,
          prompt: `How did your legs and CNS feel 16 hours after your last strength session? If the answer is not 'ready', your strength work is competing with your training rather than supporting it. Which exercise is the most likely culprit?`,
          good: `Identifies and removes or reduces the offending exercise. Endurance session quality improves immediately.`,
          med: `Decides the fatigue is an adaptation phase and pushes through. The adaptation phase lasts the entire season.`,
        },
        thu: {
          title: `Sweetspot is not a safe zone`,
          mech: `Sweetspot (88–93% FTP) feels sustainable and purposeful. On fresh legs, it is. On accumulated weekly fatigue, it produces low-grade overreaching — a suppression of adaptation that does not announce itself until performance has already declined for two or three weeks.`,
          prompt: `In your next sweetspot block, observe your breathing in the final 5 minutes. Controlled and rhythmic means you are adapting to the correct stimulus. Ragged and effortful means you are in the wrong zone on tired legs. The power number on the screen looks the same. The adaptation does not.`,
          good: `Drops target power 3–5% when the breathing signal appears. Trains the correct system. Recovery is faster.`,
          med: `Treats ragged late-session breathing as evidence of sufficient effort. Wonders why two-day recovery becomes three-day recovery.`,
        },
        sun: {
          title: `The intensity honesty check`,
          mech: `Most intermediate athletes significantly overestimate how much of their training is genuinely hard and underestimate how much is grey zone. Grey zone — too hard for aerobic adaptation, too easy for threshold adaptation — is the primary reason athletes plateau despite consistent training.`,
          prompt: `Categorise every session this week: genuinely easy (full conversation possible), genuinely hard (specific target, above threshold), or grey zone (felt like work but no clear target). What percentage was grey zone? What would the week have looked like without it?`,
          good: `Restructures next week with polarised intent. Easy sessions get easier. Hard sessions get harder. Grey zone shrinks.`,
          med: `Defends grey zone as 'solid moderate training'. The plateau extends through the build phase.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Race thinking starts before fitness does`,
          mech: `Race craft — the quality of decisions made under race conditions — is not determined by fitness. It is determined by how often and how deliberately you have practised making those decisions. Athletes who start thinking about race execution only when fitness is high have compressed their learning window. The base phase is where race intelligence is built cheaply.`,
          prompt: `Name one race-day decision you have not yet practised in training: pacing through the first 5km of the run, nutrition timing off the bike, or managing swim contact. That decision will be made for the first time on race day — under cortisol, fatigue, and peer pressure — unless you rehearse it now.`,
          good: `Identifies one untrained race decision and finds a training context to rehearse it this block. Race intelligence compounds.`,
          med: `Focuses entirely on fitness in the base phase. Arrives at race day with undertrained decision-making. Relies on instinct under the worst possible cognitive conditions.`,
        },
        thu: {
          title: `Your transition is a technical session`,
          mech: `T1 and T2 are neuromuscular transition events executed when blood lactate is elevated and fine motor control is compromised. A transition practised fresh in the driveway is a categorically different experience from one executed at race pace. The time lost is not from slowness — it is from cognitive freezing on a sequence that was never automated under load.`,
          prompt: `Set up a T1 or T2 rehearsal after a genuinely hard effort this week — heart rate above 150, legs loaded. Execute the full sequence and note exactly where it breaks down. That breakdown point is what needs rehearsing, not the parts that already work.`,
          good: `Automates the transition sequence under fatigue across multiple rehearsals. Gains 30–90 seconds at no fitness cost.`,
          med: `Practises transitions in the driveway, rested. Executes the sequence smoothly. Loses the time on race day when the cognitive load is real.`,
        },
        sun: {
          title: `Race craft compounds only if you debrief`,
          mech: `A hard session without a structured debrief is experience without learning. The gap between a good age-grouper and a sharp one is often not fitness — it is the quality of decisions made under fatigue, and the willingness to audit those decisions after the fact.`,
          prompt: `After this week's key session: what decision did you get right? What decision cost you time or energy? If you can name one of each, the session produced race intelligence. If you can only name what hurt, it produced fatigue.`,
          good: `Names one right decision and one wrong one after every race-intensity session. The pattern of wrong decisions gets shorter each month.`,
          med: `Finishes the session, logs the time and distance, moves on. The same decisions — the same fades, the same surges too early — repeat at the race.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Training load and life load are the same budget`,
          mech: `The physiological stress response does not distinguish between a threshold run and a high-stakes work deadline. Both elevate cortisol. Both consume recovery capacity. An athlete carrying a life-stress load of 4 out of 5 and training at a normal load is effectively training at 140% of their recovery capacity — even if the training sessions themselves are identical to a lower-stress week.`,
          prompt: `On a scale of 1–5, what is your current life stress load? Is your training this week calibrated to that number — or was the block designed for a stress level of 2 and you are currently living a 4? Name the specific sessions you would protect and the ones you would sacrifice if the week became a 4.`,
          good: `Reduces training intensity — not volume — during high-stress weeks. The floor holds. The block survives intact.`,
          med: `Maintains planned load regardless of life stress. Eventually breaks down and loses two weeks entirely. Arrives at the next block below baseline.`,
        },
        thu: {
          title: `The session that repays the most`,
          mech: `For any given athlete at a given training phase, one session type produces the highest adaptation-per-fatigue-cost ratio. Identifying that session and making it structurally untouchable is the single highest-leverage training decision you can make. Everything else is secondary.`,
          prompt: `If you could only complete two sessions this week, which two would produce the most race-specific adaptation? Are those two sessions currently protected in your schedule — or are they the first things that get cut when time gets tight?`,
          good: `Identifies the two highest-leverage sessions and protects them unconditionally. Everything else is negotiable.`,
          med: `Treats all sessions as equally important and equally sacrificial. Consistently misses the two that matter most.`,
        },
        sun: {
          title: `The sustainability check`,
          mech: `A training block is only as good as it is executable across its full duration. An athlete who arrives at the start line undertrained but rested and structurally sound will outperform an athlete who arrives overtrained, brittle, and carrying a niggle from month two.`,
          prompt: `Could you repeat this exact week's training load — same sessions, same intensity, same recovery — for the next four weeks without performance degrading or wellbeing declining? If not, what specifically would need to change to make it sustainable?`,
          good: `Identifies the specific inflection point before it arrives. Adjusts load proactively. Arrives at the build phase healthy.`,
          med: `Waits until the inflection point forces the adjustment. Loses a week recovering from something that was visible three weeks earlier.`,
        },
      }, // end integration

    }, // end early

    // ─── Mid ─────────────────────────────────────────────────────────
    // Mid — middle weeks. Emphasis: technique. Building specificity.

    mid: {

      foundations: {
        tue: {
          title: `What has the base actually built?`,
          mech: `Three weeks of consistent aerobic work produces measurable adaptation — lower heart rate at the same pace, better fat oxidation, improved cardiac stroke volume. Most athletes cannot see these changes because they are not testing for them. They feel fitter in a vague sense but have no specific data to act on.`,
          prompt: `At the same effort level as week one of this block, what has changed? Pick one measurable: pace at Zone 2 HR, time to first perceived fatigue on the long ride, or how your legs feel on Monday after a Sunday long run. Name the number. Has it moved?`,
          good: `Has a specific metric to point to. Knows exactly what the base phase built and what it did not.`,
          med: `Feels generally fitter. Cannot name a specific adaptation. Enters the build phase without knowing what foundation they are building on.`,
        },
        thu: {
          title: `The minimum effective dose principle`,
          mech: `More training is not always better training. The minimum effective dose — the smallest training stimulus that produces the target adaptation — preserves recovery capacity for the sessions that require maximum quality. Athletes who always do more than the minimum accumulate fatigue that caps the sessions where it most matters.`,
          prompt: `This week's long run or long ride: what was the minimum duration that would have produced the specific adaptation you were targeting? Was what you actually did meaningfully above that minimum — or were the extra kilometres junk volume accumulating fatigue without additional benefit?`,
          good: `Calibrates session duration to the target adaptation. Stops when the stimulus is achieved. More recovery capacity available for the next session.`,
          med: `Equates longer with better by default. Extra kilometres feel productive. Recovery is compressed. The next session suffers.`,
        },
        sun: {
          title: `Before the build phase: the honest inventory`,
          mech: `The transition from base to build is the highest-leverage structural moment in the block. Athletes who enter the build phase with unresolved technique deficits, accumulated fatigue, or unclear priority sessions carry those problems into higher intensity — where they are harder and more expensive to fix.`,
          prompt: `Three questions before next block: What is the one technique issue that has not improved despite attention? What is the one session you have consistently under-delivered on? What is the one recovery habit that has been inconsistent? Each answer is a specific input to your build phase plan.`,
          good: `Arrives at the build phase with a specific list of three things to carry forward and address under increasing load.`,
          med: `Arrives at the build phase excited about adding intensity. The unresolved issues from base become amplified liabilities.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Open water swimming is a different sport`,
          mech: `Pool swimming and open water swimming require different skills: sighting, navigation, contact management, wave entry, and maintaining stroke when you cannot see the bottom. Athletes who train exclusively in pools and then race in open water are entering a different technical environment for the first time on race day — at race intensity.`,
          prompt: `When did you last swim in open water? If the answer is more than four weeks ago, that is your highest-return swim investment this week. One open water session exposes more race-relevant technique problems than four pool sessions.`,
          good: `Schedules open water sessions monthly through the base phase. Arrives at the race swim with automatic sighting and contact management.`,
          med: `Trains exclusively in the pool. Open water on race day is a novel environment. The first 400m is adaptation time, not race time.`,
        },
        thu: {
          title: `Run form under fatigue is your actual run form`,
          mech: `Run form observed in the first kilometre of a fresh run is not your race-day run form. Your race-day run form is what emerges after 90 minutes on the bike and 10 kilometres of running. The hip drop, the shortened stride, the forward lean — these are the movement patterns that need correcting, not the ones visible when you are fresh.`,
          prompt: `In your next long run, video your running form at kilometre 14 or 15. Compare it to any video from a fresh run. What is different? The differences are not just fatigue — they are technique deficits that increase injury risk and energy cost exactly when you most need to be efficient.`,
          good: `Trains technique correction specifically under fatigue. Practises the cues at kilometre 15, not kilometre 1. Race-day form improves.`,
          med: `Works on run form drills when fresh. Assumes the corrections will transfer automatically to fatigued running. They do not.`,
        },
        sun: {
          title: `The efficiency question`,
          mech: `Efficiency gains are invisible in training logs — no metric captures them — but they compound across a season. A 5% reduction in energy cost per swim stroke, or a 3% improvement in run economy, produces a meaningfully different athlete by race day without adding a single training hour.`,
          prompt: `Name one technical change you worked on this week across any discipline. Did you feel a difference under fatigue, or just think about it in the first 10 minutes? There is a gap between knowing a correction and executing it when tired.`,
          good: `Tests one movement change deliberately under increasing fatigue across three sessions. Notices what holds and what reverts.`,
          med: `Makes a mental note after the coach says something. Returns to default movement pattern the moment intensity increases.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `Volume without specificity is just mileage`,
          mech: `Aerobic durability is the capacity to hold race-pace effort in the final 20% of race duration — not just the ability to complete the distance. Easy long sessions build the foundation but do not build the specific capacity to perform when fatigued. That requires intentional structure in the back half of long sessions.`,
          prompt: `In your last long ride or run: what happened in the final 30 minutes? Was the fade a conscious pacing decision, or were you genuinely running out of capacity? Those are different problems — one is tactical, one is physiological.`,
          good: `Identifies a pacing problem. Starts building negative-split structure into long sessions. Practices holding form when tired.`,
          med: `Identifies an endurance problem. Adds more long, easy sessions. The fade happens in the same place every time.`,
        },
        thu: {
          title: `The fat-burning question you are avoiding`,
          mech: `At genuine Zone 2, the primary fuel source is fat. This matters for race durability — not body composition. Athletes who train chronically in the grey zone never fully develop fat oxidation, meaning they are more dependent on carbohydrate at race intensity and more vulnerable to the late-race wall.`,
          prompt: `In your long session this weekend, complete the first 45 minutes without any carbohydrate. Does your pace drop, does perceived effort rise, or does nothing change? That response is your aerobic system reporting its actual fitness level.`,
          good: `Completes the experiment honestly without 'just in case' gels. Uses the result to calibrate where their aerobic base actually sits.`,
          med: `Takes a gel at minute 15 as insurance. Gets no data. Has no idea how carbohydrate-dependent their aerobic base has become.`,
        },
        sun: {
          title: `Did your long session build durability or confirm fatigue?`,
          mech: `Supercompensation — the adaptation process — requires a recovery window after the training stimulus. A long session that leaves you unable to train well on Tuesday produced the stimulus but may have blocked the adaptation if the recovery was insufficient. More is not always better.`,
          prompt: `Rate your readiness to train hard tomorrow on a scale of 1–10. If below 6: what specifically about today's session — duration, intensity, nutrition, heat — produced that result? And what would you change to arrive at a 7?`,
          good: `Reduces duration or intensity by 10% next week to hit a sustainable readiness score. Adaptation improves.`,
          med: `Views a low readiness score as proof of hard work. Repeats the session. Arrives at week five already suppressed.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Your strength work might be slowing you down`,
          mech: `Strength training for triathletes has one job: structural resilience. Protecting tendons, connective tissue, and running economy under load. The moment a strength session produces enough neuromuscular fatigue to compromise the quality of the subsequent endurance session, it has exceeded its brief.`,
          prompt: `How did your legs and CNS feel 16 hours after your last strength session? If the answer is not 'ready', your strength work is competing with your training rather than supporting it. Which exercise is the most likely culprit?`,
          good: `Identifies and removes or reduces the offending exercise. Endurance session quality improves immediately.`,
          med: `Decides the fatigue is an adaptation phase and pushes through. The adaptation phase lasts the entire season.`,
        },
        thu: {
          title: `Sweetspot is not a safe zone`,
          mech: `Sweetspot (88–93% FTP) feels sustainable and purposeful. On fresh legs, it is. On accumulated weekly fatigue, it produces low-grade overreaching — a suppression of adaptation that does not announce itself until performance has already declined for two or three weeks.`,
          prompt: `In your next sweetspot block, observe your breathing in the final 5 minutes. Controlled and rhythmic means you are adapting to the correct stimulus. Ragged and effortful means you are in the wrong zone on tired legs.`,
          good: `Drops target power 3–5% when the breathing signal appears. Trains the correct system. Recovery is faster.`,
          med: `Treats ragged late-session breathing as evidence of sufficient effort. Wonders why two-day recovery becomes three-day recovery.`,
        },
        sun: {
          title: `The intensity honesty check`,
          mech: `Most intermediate athletes significantly overestimate how much of their training is genuinely hard and underestimate how much is grey zone. Grey zone — too hard for aerobic adaptation, too easy for threshold adaptation — is the primary reason athletes plateau despite consistent training.`,
          prompt: `Categorise every session this week: genuinely easy (full conversation possible), genuinely hard (specific target, above threshold), or grey zone. What percentage was grey zone? What would the week have looked like without it?`,
          good: `Restructures next week with polarised intent. Easy sessions get easier. Hard sessions get harder. Grey zone shrinks.`,
          med: `Defends grey zone as 'solid moderate training'. The plateau extends through the build phase.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Race thinking starts in training`,
          mech: `Decision-making under race-pace conditions is a learned skill, not an instinct. Athletes who have never deliberately rehearsed pacing decisions — when to push, when to hold, how to read effort against power or pace — make those decisions for the first time on race day, under the worst possible cognitive conditions.`,
          prompt: `In your last race-intensity session: were you making active pacing decisions, or just holding on and hoping? Holding on is practising survival. Practising survival does not produce race intelligence.`,
          good: `Builds explicit decision moments into hard sessions. Knows before the session starts exactly where they will push and where they will hold.`,
          med: `Trains hard and expects race instinct to arrive on race day fully formed. It does not.`,
        },
        thu: {
          title: `Course knowledge is race craft`,
          mech: `Athletes who know their race course — where the headwinds are on the bike, which kilometre the run gets hard, where the hills appear — can distribute effort intelligently rather than reactively. Course knowledge converts fitness into performance more efficiently than additional training can.`,
          prompt: `What do you know about your specific race course that should change your pacing strategy? If you have not yet studied the bike elevation profile and the run course layout in detail, do it this week. One hour of course analysis produces more race-day performance than one additional training session.`,
          good: `Studies the course in detail. Adjusts pacing strategy to the specific demands. Executes a course-specific race plan.`,
          med: `Prepares for a generic race. Encounters the specific challenges without preparation.`,
        },
        sun: {
          title: `What does your race actually require?`,
          mech: `Race-specific preparation requires knowing exactly what the race will demand — not just the distance, but the course profile, the likely weather, the transition layout, and the specific physiological challenges of that particular event. Generic training produces generic performance.`,
          prompt: `Name three specific demands of your target race that your current training is not addressing. Course elevation? Heat? Open water sighting? A technical T2? Each is a race craft gap — and the base phase is still the time to start closing it.`,
          good: `Identifies the specific race demands and builds deliberate rehearsal sessions around them. Race day has fewer surprises.`,
          med: `Trains generically. Arrives at the race having prepared for a standard event.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Burnout is not about volume`,
          mech: `Training burnout in intermediate athletes is rarely caused by too many kilometres. It is caused by sustained misalignment between training load, life stress, and recovery quality. A 12-hour training week during a high-stress work period produces more physiological suppression than a 15-hour week during a calm one.`,
          prompt: `What is your current life stress load on a scale of 1–5? Is your training load this week calibrated to that number?`,
          good: `Proactively reduces training intensity — not volume — during high-stress weeks. Training consistency survives intact.`,
          med: `Maintains the planned load regardless of life stress. Eventually breaks down.`,
        },
        thu: {
          title: `The session that repays the most`,
          mech: `For any given athlete at a given training phase, one session type produces the highest adaptation-per-fatigue-cost ratio. Identifying that session and making it structurally untouchable is the single highest-leverage training decision you can make. Everything else is secondary.`,
          prompt: `If you could only complete two sessions this week, which two would produce the most race-specific adaptation? Are those two sessions currently protected in your schedule?`,
          good: `Identifies the two highest-leverage sessions and protects them unconditionally.`,
          med: `Treats all sessions as equally important and equally sacrificial. Consistently misses the two that matter most.`,
        },
        sun: {
          title: `The double discipline day requires sequencing`,
          mech: `On days with two training sessions — squad swim plus run intervals, for example — session sequencing is not arbitrary. The technically demanding or quality-sensitive session should come first when the CNS is fresh. The second session adapts to whatever capacity remains. Getting this backwards consistently degrades the quality of the sessions you most need to protect.`,
          prompt: `On your double session days this week: was the sequence intentional, or did it default to whatever was logistically easiest? Which session suffered — and was it the one you could afford to compromise, or the one that mattered most?`,
          good: `Sequences double sessions by priority, not convenience. High-quality sessions are protected.`,
          med: `Sequences sessions by schedule default. High-priority sessions are often the second one. Quality is compressed by residual fatigue.`,
        },
      }, // end integration

    }, // end mid

    // ─── Late ─────────────────────────────────────────────────────────
    // Late — final week. Emphasis: durability. Consolidating before transition.

    late: {

      foundations: {
        tue: {
          title: `Seven weeks in: what has the base actually built?`,
          mech: `Consistent aerobic work produces measurable adaptation — lower heart rate at the same pace, better fat oxidation, improved cardiac stroke volume. Most athletes cannot see these changes because they are not testing for them. They feel fitter in a vague sense but have no specific data to act on.`,
          prompt: `At the same effort level as week one of this block, what has changed? Pick one measurable: pace at Zone 2 HR, time to first perceived fatigue on the long ride, or how your legs feel on the day after a long run. Name the number. Has it moved?`,
          good: `Has a specific metric to point to. Knows exactly what the base phase built and what it did not. Plans the build phase accordingly.`,
          med: `Feels generally fitter. Cannot name a specific adaptation. Enters the build phase without knowing what foundation they are building on.`,
        },
        thu: {
          title: `The floor evolved`,
          mech: `The minimum viable week established at the start of this block should look different by the end of it. Fitness, experience, and pattern recognition mean the floor becomes more specific, more evidence-based, and more defensible with each block. If your floor looks identical to when you started, the block has not refined it.`,
          prompt: `Define your current floor with the precision that this block's evidence allows. Name the sessions, the sequence, the minimum duration, and the recovery requirements. Compare it to where you started. Is it more specific?`,
          good: `Has a more refined, evidence-based floor than at block start. Carries it into the next block as the first piece of the plan.`,
          med: `Has a floor similar to the original definition. The block's evidence has not refined what is protected.`,
        },
        sun: {
          title: `Before the build phase: the honest inventory`,
          mech: `The transition from base to build is the highest-leverage structural moment in any training cycle. Athletes who enter the build phase with unresolved technique deficits, accumulated fatigue, or unclear priority sessions carry those problems into higher intensity — where they are harder and more expensive to fix.`,
          prompt: `Three questions before next block: What is the one technique issue that has not improved despite attention? What is the one session you have consistently under-delivered on? What is the one recovery habit that has been inconsistent? Each is a specific input to your build phase plan.`,
          good: `Arrives at the build phase with a specific list of three things to carry forward and address under increasing load.`,
          med: `Arrives at the build phase excited about adding intensity. The unresolved issues from base become amplified liabilities.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `The last technique session before build: consolidate, don't introduce`,
          mech: `Technical changes introduced in the final week of base phase will not be consolidated before intensity increases. The neuromuscular consolidation of a movement pattern requires repeated execution across multiple sessions. Week 4 of base is for confirming what held, not adding new corrections.`,
          prompt: `Of the technique work done this block, which change is most consolidated — holds under fatigue without conscious attention? Which is least consolidated — still requires deliberate cuing? The consolidated one is an asset for the build phase. The unconsolidated one is a risk.`,
          good: `Enters build phase knowing which technique changes are assets and which require continued deliberate attention.`,
          med: `Enters build phase with multiple half-consolidated technique changes. All revert at threshold intensity.`,
        },
        thu: {
          title: `Video analysis: the session you never do`,
          mech: `Proprioceptive feedback during swimming, cycling, and running is unreliable — what athletes feel they are doing and what they are actually doing are frequently different. Video analysis resolves this gap with a single session. The value of one hour of video analysis typically exceeds weeks of technique-focused training done without accurate feedback.`,
          prompt: `When did you last see yourself swim, run, or ride on video? If the answer is more than three months ago for any discipline, you are training based on perceived movement rather than actual movement. Schedule one video session per discipline before the build phase begins.`,
          good: `Completes one video analysis session per discipline. Identifies one specific movement correction per discipline based on what they actually see.`,
          med: `Trains based on proprioceptive feedback. Continues patterns that feel correct but may be technically inefficient.`,
        },
        sun: {
          title: `The build phase demands a new technique contract`,
          mech: `The base phase was about volume. The build phase is about quality under load. Technique that held at Zone 2 will be tested at threshold and above — and the gaps will be exposed. The athletes who improve fastest in build are not the fittest; they are the ones who set explicit technique targets for hard sessions.`,
          prompt: `Name one technique target for each discipline for the build phase — something specific enough to be checkable mid-session. Not 'swim better'. 'Keep my head still through the entire pull phase at threshold pace.' Specificity is what makes the target trainable.`,
          good: `Enters each build session with a technique target as well as a power or pace target. Dual-mode attention. Adaptation is faster.`,
          med: `Focuses entirely on hitting the power or pace number. Technique is whatever happens to emerge. The base phase ceiling follows them into build.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `What recovery is actually doing`,
          mech: `A recovery week is not a pause in training — it is the week the adaptation from the previous three weeks is consolidated. The stimulus has been applied. Supercompensation requires the stress to be removed before the adaptation can be expressed. This week's easy sessions are not junk — they are the mechanism.`,
          prompt: `In this recovery week: what is the one session you are most tempted to make 'a bit harder because you feel good'? That session is the one to protect. Feeling good is the adaptation. Spending it early means you arrive at the next block's base week with less than you built.`,
          good: `Holds easy easy. The block's fitness is preserved going into the next phase. Arrives at build week 1 genuinely fresh.`,
          med: `Turns the recovery week into a medium week. Arrives at the next base week carrying residual fatigue. The next block starts below its own floor.`,
        },
        thu: {
          title: `The physio appointment you have been postponing`,
          mech: `Most triathletes carry a structural issue through a training block — a recurring tightness, a nagging joint, a compensatory movement pattern — that they manage rather than resolve because addressing it would require reducing training load. The recovery week is the window to address these issues fully, without the training-load constraint.`,
          prompt: `Name the physical issue you managed through this block rather than resolved. Book the appointment this week — physio, sports medicine, massage. The issue does not resolve itself during recovery. It just gets a rest before returning when load increases.`,
          good: `Books and attends the relevant appointment in the recovery week. Starts the next block with the structural issue resolved.`,
          med: `Plans to address it before the next block starts. Starts the next block with the same issue managed rather than resolved.`,
        },
        sun: {
          title: `Rest is a skill`,
          mech: `Highly motivated endurance athletes are generally poor at resting. The same psychological characteristics that produce training consistency — discipline, goal orientation, discomfort tolerance — also produce guilt during rest, anxiety during reduced load, and a tendency to equate productivity with training. Rest is a skill because it has to be actively practised against these tendencies.`,
          prompt: `Rate your ability to rest without guilt or anxiety on a 1–10 scale. If below 7, rest is currently working against you rather than for you. What specifically produces the discomfort — fear of detraining, identity, loss of structure? Naming it makes it more manageable.`,
          good: `Rests deliberately and without guilt. Returns to training physiologically and psychologically refreshed. The next block starts from a genuine baseline.`,
          med: `Rests with chronic low-level anxiety about detraining. Returns to training too early. The next block starts from an incomplete recovery.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Recovery week: no new intensity`,
          mech: `The recovery week is not an opportunity to test fitness or add one more quality session 'just to stay sharp'. Every quality session in a recovery week delays the supercompensation it is designed to produce. The fitness is not going anywhere. The recovery window is finite.`,
          prompt: `Is there any session this week you are planning that includes sustained effort above Zone 2? If yes, ask: what specific adaptation does this session produce that the next block's week 1 cannot produce on fresher legs? If you cannot answer that question with specificity, the session should not happen.`,
          good: `Holds the recovery week to genuinely easy movement. Arrives at the next block's week 1 feeling sharp and slightly under-trained — the correct feeling.`,
          med: `Adds one 'light intensity' session. Feels productive. Arrives at week 1 of the next block 10% less recovered than they would have been.`,
        },
        thu: {
          title: `What the block's intensity told you`,
          mech: `Three weeks of base-phase training reveals an athlete's current intensity tolerance — how quickly they recover from hard sessions, how their Zone 2 pace responds under fatigue, and where the grey zone most often appears. This information is specific to this athlete at this fitness level. It should inform how the build phase is loaded.`,
          prompt: `Looking back at this block: on which days did intensity accumulate unexpectedly? After which sessions did recovery take longer than expected? That pattern is your personal intensity tolerance profile — the most useful data point for planning the build phase loading.`,
          good: `Identifies the specific sessions and days where intensity accumulated beyond plan. Adjusts build phase structure accordingly.`,
          med: `Has a general sense of how the block went. Plans the build phase from a template rather than personal data.`,
        },
        sun: {
          title: `The intensity honesty check at block end`,
          mech: `Most intermediate athletes significantly overestimate how much of their training is genuinely hard and underestimate how much is grey zone. At the end of a base block, the honest question is: what percentage of intended Zone 2 sessions was actually grey zone? That percentage is the first thing to address in the next block.`,
          prompt: `Across this base block: how many of your designated easy sessions drifted above Zone 2? Estimate a percentage. If above 30%, the next block's base work needs a structural fix — not more willpower, a structural change to how easy sessions are set up.`,
          good: `Identifies the grey zone drift and makes one structural change that addresses it for the next block.`,
          med: `Acknowledges the grey zone drift as a tendency. Plans to try harder to hold Zone 2. The drift continues.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Race craft block review`,
          mech: `Race craft decisions — pacing, nutrition timing, transition execution — are built through deliberate rehearsal over many sessions. At the end of a base block, the honest question is: how many rehearsals actually happened? Each rehearsal in base phase is a rehearsal that does not need to happen for the first time under race-day pressure.`,
          prompt: `Name one race craft decision you rehearsed deliberately in this block. Name one you intended to rehearse but did not. The one you did not rehearse is the one you will need to make on race day without preparation. What is the specific opportunity in the build phase to address it?`,
          good: `Has rehearsed at least two race craft decisions deliberately in the base block. The build phase adds race-intensity rehearsal on top of that foundation.`,
          med: `Has not deliberately rehearsed any race craft decisions. The build phase introduces intensity on top of unmade decisions.`,
        },
        thu: {
          title: `The second season race target: specific ambition`,
          mech: `Race targets should be specific. Not 'faster than last time' — a specific segment improvement, a specific pacing execution, a specific process goal. Specificity makes targets trainable and makes debriefs accurate. Vague ambition produces vague results.`,
          prompt: `Name your race target in three specific components: a finish time or segment time target, a pacing execution target (specific numbers for each segment), and a process target (something you will do differently from last race regardless of outcome). If you only have the first, the plan is incomplete.`,
          good: `Has all three components written, specific, and reflected in training sessions.`,
          med: `Has a finish time goal and a general intention to race smarter. The specifics are undefined. Execution on race day defaults to intuition.`,
        },
        sun: {
          title: `Post-race: what the result actually means`,
          mech: `A race result is one data point from one day under one set of conditions. It is not a verdict on the block's training. The most useful post-race question is not 'did I hit my time?' — it is 'did I execute the plan?' Execution quality is something you control. Race-day conditions are not.`,
          prompt: `Evaluate your last race on execution, not result. Did you execute the swim start plan? Did you hold the bike pacing strategy? Did you take the first run gel at the right time? If execution was good and the result was slower than expected, the variables were external. If execution was poor, you have specific things to fix.`,
          good: `Evaluates the race on a specific execution scorecard. Knows exactly what to carry forward and what to change.`,
          med: `Evaluates the race entirely on finish time. Draws conclusions about fitness that may be inaccurate. Changes the wrong things.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Block complete: what story does the data tell?`,
          mech: `Four weeks of training data — session logs, readiness scores, grey zone tracking, reflection notes — contains the most accurate picture of an athlete's physiological patterns available anywhere. Most athletes do not read this data. They have access to a longitudinal performance analysis and treat it as a log.`,
          prompt: `Review your readiness scores across this block. At what points did they consistently drop most significantly? Before which specific sessions? After which specific weeks? Three patterns from the data should directly inform how the build phase is structured.`,
          good: `Reads the block data analytically. Identifies three specific patterns. Adjusts the build phase plan based on evidence, not intuition.`,
          med: `Uses the data as a log, not an analysis. The build phase is structured on the same assumptions as the base phase.`,
        },
        thu: {
          title: `Life has changed since block start`,
          mech: `The training plan designed at the start of this block was built around the life that existed then — work schedule, family commitments, available training time. Four weeks later, at least some of these may have changed. Training built on outdated life constraints produces chronic friction that erodes consistency.`,
          prompt: `What has changed in your life since you started this block? Work load, family schedule, available training windows? Name each change and identify whether your current training structure reflects it or is fighting against it.`,
          good: `Redesigns the next block's training structure around the current life, not the life that existed at block start. Consistency improves.`,
          med: `Continues the current structure unchanged. The life changes create chronic friction. Training consistency suffers without a clear diagnosis.`,
        },
        sun: {
          title: `Training consistency is the long game`,
          mech: `Training consistency — completing the planned sessions across the full block — is more predictive of race-day performance than any single session. An athlete who completes 85% of planned sessions consistently outperforms an athlete who completes 120% of planned sessions in good weeks and 40% in bad weeks.`,
          prompt: `What percentage of planned sessions have you completed in this block? If below 80%, the issue is not motivation — it is structural. The plan does not fit the life. Which sessions are consistently not happening, and what would make them happen?`,
          good: `Maintains 85%+ session completion by designing the plan around the actual life, not the ideal one.`,
          med: `Has high-completion good weeks and low-completion bad weeks. Treats the low weeks as motivation failures. The structural cause is unaddressed.`,
        },
      }, // end integration

    }, // end late

  }, // end base

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD PHASE — PRO TIER
  // ═══════════════════════════════════════════════════════════════════════════

  build: {

    // ─── Early ─────────────────────────────────────────────────────────
    // Early — first week. Emphasis: intensity. Opening the phase.

    early: {

      foundations: {
        tue: {
          title: `What has changed since base week one?`,
          mech: `Thirteen weeks of training produces objective physiological change — lower resting heart rate, higher power at threshold, better running economy, faster swim pace at the same effort. Most athletes cannot quantify these changes because they never established baselines. Without baselines, the build phase is flying blind.`,
          prompt: `Pick one metric you can measure today that you could also have measured in base week one. Resting HR, Zone 2 pace, FTP estimate, swim pace per 100m at threshold. Measure it this week. What has changed? If the answer is 'I don't know', that is the problem to fix before the peak phase.`,
          good: `Has one or two tracked metrics with a base-week-one baseline. Can see the adaptation curve. Knows exactly what the block has built.`,
          med: `Feels fitter in a general sense. Cannot name a specific improvement. The peak phase will be built on an unclear foundation.`,
        },
        thu: {
          title: `The minimum effective dose principle`,
          mech: `More training is not always better training. The minimum effective dose — the smallest training stimulus that produces the target adaptation — preserves recovery capacity for the sessions that require maximum quality. Athletes who always do more than the minimum accumulate fatigue that caps the sessions where it most matters.`,
          prompt: `This week's long run or long ride: what was the minimum duration that would have produced the specific adaptation you were targeting? Was what you actually did meaningfully above that minimum — or were the extra kilometres junk volume accumulating fatigue without additional benefit?`,
          good: `Calibrates session duration to the target adaptation. Stops when the stimulus is achieved. More recovery capacity available for the next session.`,
          med: `Equates longer with better by default. Extra kilometres feel productive. Recovery is compressed. The next session suffers.`,
        },
        sun: {
          title: `The pre-peak foundation check`,
          mech: `The peak phase works by applying race-specific intensity to a base of accumulated fitness. If the build phase was executed well, the foundation is solid and the peak phase accelerates. If the build phase was poorly structured — too much grey zone, insufficient recovery, technique not advancing — the peak phase amplifies the cracks.`,
          prompt: `Three questions: Is your technique more durable under fatigue than it was at base week one? Are you recovering from hard sessions faster than you were at base week one? Has your relationship with race-pace effort — its feel, its sustainability — become more familiar? If the answer to all three is yes, the build phase is working.`,
          good: `Can answer all three questions specifically and affirmatively. The build phase is producing the intended adaptations.`,
          med: `Cannot answer the questions specifically. The build phase produced fitness but not intelligence.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Technique degrades before fitness does`,
          mech: `When threshold intensity is introduced, the first thing to break down is not cardiovascular capacity — it is movement quality. Swim stroke crossover returns. Run cadence drops. Bike position collapses. These are not fatigue symptoms; they are signs that technique was not sufficiently automated during the base phase.`,
          prompt: `In your hardest session this week: at what point did your technique noticeably degrade? Note the elapsed time and the specific breakdown. That is your current technical durability ceiling — the thing the build phase needs to extend.`,
          good: `Identifies the breakdown point precisely. Uses it as a target: extend technical durability by 5 minutes per week through the build phase.`,
          med: `Notices form degrades but attributes it entirely to fitness. Adds more intensity. The technique ceiling stays fixed.`,
        },
        thu: {
          title: `Power without position is wasted`,
          mech: `Aerodynamic drag increases with the square of speed. At race pace on the bike, a poor position can cost more watts than a training block's worth of FTP gains. Most intermediate athletes spend months improving power and minutes on position — the return on investment is inverted.`,
          prompt: `In your next structured ride, spend 10 minutes consciously holding your race position at sweetspot effort. Where does it break down — lower back, neck, hip flexors? That breakdown point tells you what mobility or strength work would produce the fastest bike split improvement.`,
          good: `Identifies the specific limiter in their race position. Works on the targeted mobility or strength. Holds position longer each week.`,
          med: `Trains in a slightly elevated, comfortable position. Produces good power numbers in training. Loses significant time to drag on race day.`,
        },
        sun: {
          title: `The build phase demands a new technique contract`,
          mech: `The base phase was about volume. The build phase is about quality under load. Technique that held at Zone 2 will be tested at threshold and above — and the gaps will be exposed. The athletes who improve fastest in build are not the fittest; they are the ones who set explicit technique targets for hard sessions.`,
          prompt: `Name one technique target for each discipline this week — something specific enough to be checkable mid-session. Not 'swim better'. 'Keep my head still through the entire pull phase at threshold pace.' Specificity is what makes the target trainable.`,
          good: `Enters each build session with a technique target as well as a power or pace target. Dual-mode attention. Adaptation is faster.`,
          med: `Focuses entirely on hitting the power or pace number. Technique is whatever happens to emerge. The base phase ceiling follows them into build.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `The brick run is your race-day preview`,
          mech: `The off-the-bike run is the most race-specific stimulus in triathlon training. Nothing else — not a standalone run at the same pace, not a turbo session at the same power — replicates the neuromuscular state of starting a run after 90+ minutes of cycling. How your legs respond in the first 2km of a brick run is exactly how they will respond on race day.`,
          prompt: `In your last brick run: what happened in the first 2km? Were your legs heavy and shuffling, or were they functional within a kilometre? If the transition felt bad, was it the bike effort, the nutrition timing, or the cadence into T2? One of those is the lever.`,
          good: `Diagnoses the brick run transition specifically. Adjusts one variable — bike intensity, nutrition, or cadence — and tests the result next session.`,
          med: `Accepts heavy legs as inevitable. Does not investigate the cause. The race-day transition is the same.`,
        },
        thu: {
          title: `Run durability is built in the middle kilometres`,
          mech: `The first and last kilometres of a long run produce the least durability adaptation per unit of fatigue. The middle kilometres — kilometres 8 through 16 of a 20km run — are where the neuromuscular and connective tissue adaptations that produce run durability actually occur. Cutting runs short consistently truncates this window.`,
          prompt: `In your last long run: what were kilometres 8–14 like? Were you holding form, or was that the window where cadence dropped, hip extension shortened, and pace slipped? If it was the latter, that window is your durability target — not the overall distance.`,
          good: `Focuses attention and form cues on the middle window of the long run. Notices and corrects the specific breakdown. Durability extends week by week.`,
          med: `Measures the long run by total distance only. The middle-kilometre degradation continues unexamined.`,
        },
        sun: {
          title: `Two weeks of build: what is the cost?`,
          mech: `The first two weeks of a build phase reveal whether the base was sufficient. Athletes with a genuine aerobic base recover from threshold sessions within 36–48 hours. Athletes who spent the base phase in the grey zone find that build sessions take 60–72 hours to recover from.`,
          prompt: `How long did your hardest session this week take to clear — measured by readiness to train hard again? 36 hours means the base was solid. 72 hours means it was not. That recovery time is the most honest feedback the build phase produces.`,
          good: `Uses recovery time as diagnostic data. If too long, returns to Z2 emphasis for one week before resuming build. Arrives at peak phase genuinely ready.`,
          med: `Pushes through long recovery periods as evidence of hard training. Cumulative suppression builds through the entire build phase.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Threshold is a ceiling, not a cruise control`,
          mech: `Lactate threshold is the intensity at which lactate production exceeds clearance. Training at threshold — not above, not below — raises this ceiling over time. The problem: most athletes overshoot threshold in the early intervals when fresh, then undershoot it when fatigued. The result is a session that was neither threshold nor VO2 — it was just hard.`,
          prompt: `In your threshold intervals this week: were the final reps at the same quality as the first two? If not, what degraded first — pace, power, or breathing control? The answer tells you whether you started too fast or whether threshold fitness is genuinely the limiter.`,
          good: `Starts threshold intervals conservatively. Final reps match or slightly exceed early ones. The session produces the intended stimulus.`,
          med: `Goes out hard on rep one. Survives the rest. Logs the session as completed. The threshold ceiling does not move.`,
        },
        thu: {
          title: `Your run pace zones are probably wrong`,
          mech: `Pace-based run zones calculated from race times assume even pacing, flat terrain, and current fitness. For athletes running hillier routes, carrying fatigue from swim and bike sessions, or whose run fitness has changed since their last race, pace zones misrepresent effort. Heart rate or RPE are more honest signals on most training runs.`,
          prompt: `On your next threshold run, cover the first 10 minutes by feel and breathing — not pace. At the 10-minute mark, check your actual pace. Is it faster or slower than your zone target? If it is meaningfully different, your zones need recalibrating before build phase intensity causes problems.`,
          good: `Recalibrates run zones using current fitness data. Sessions are training the intended system.`,
          med: `Defends the existing pace zones as correct. Continues training to numbers that do not reflect current fitness. Wonders why the build phase feels wrong.`,
        },
        sun: {
          title: `The recovery session is not optional`,
          mech: `Adaptation occurs during recovery, not during training. A threshold session on Tuesday followed by another threshold session on Wednesday produces cumulative fatigue, not double adaptation. The easy sessions between hard sessions are not filler — they are where the previous session's adaptation is expressed and consolidated.`,
          prompt: `How easy were your easy sessions this week — measured by heart rate, not perceived effort? If your 'easy' sessions were running at 140+ BPM, they were not easy. They were extending the fatigue state from your hard sessions and compressing the recovery window.`,
          good: `Holds easy sessions genuinely easy, regardless of how slow it feels. Hard sessions get harder because recovery is real.`,
          med: `Drifts easy sessions into moderate effort. All sessions become the same. The polarisation that drives adaptation disappears.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Pacing is a skill, not a feeling`,
          mech: `Most age-group athletes start races too fast and finish too slow. This is not a fitness problem — it is a pacing skill problem. The adrenaline of race start overrides every rational pace calculation made in the preceding weeks. The only countermeasure is practising deliberate, uncomfortable under-effort in the first segments of hard training sessions.`,
          prompt: `In your next race-pace session: set a target for the first 10 minutes that feels too easy. Not slightly conservative — genuinely too easy. Note your power or pace. Now compare the back half of the session to your last equivalent effort. Was the back half better?`,
          good: `Practises deliberate early-session restraint. Back half performance consistently improves. The skill transfers to race day.`,
          med: `Trusts their feeling for pace. Goes out at perceived race effort. Fades in the back half of every hard session and every race.`,
        },
        thu: {
          title: `The nutrition rehearsal is as important as the physical one`,
          mech: `Gut tolerance for carbohydrates at race intensity is trainable — but only if you train it. Athletes who use gels and sports drink only on race day are testing an untrained system under the worst possible conditions. The build phase is the window to train gut tolerance, dial in timing, and identify what does and does not work.`,
          prompt: `In your long brick this week: execute the exact nutrition protocol you plan to use on race day. Same products, same timing, same volumes. What happened? Any gut response at all — positive or negative — is data you need to have now, not on race morning.`,
          good: `Treats every long brick as a nutrition rehearsal. Arrives at race day with a protocol that has been tested at race intensity six or more times.`,
          med: `Uses whatever gels are convenient in training. Plans to 'sort nutrition out' before the race. Race-day gut issues are a surprise.`,
        },
        sun: {
          title: `What does your race actually require?`,
          mech: `Race-specific preparation requires knowing exactly what the race will demand — not just the distance, but the course profile, the likely weather, the transition layout, and the specific physiological challenges of that particular event. Generic training produces generic performance.`,
          prompt: `Name three specific demands of your target race that your current training is not addressing. Course elevation? Heat? Open water sighting? A technical T2? Each is a race craft gap — and the build phase is the time to close it.`,
          good: `Identifies the specific race demands and builds deliberate rehearsal sessions around them. Race day has fewer surprises.`,
          med: `Trains generically. Arrives at the race having prepared for a standard event. Encounters the specific challenges for the first time on the day.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Sleep is the only legal performance enhancer`,
          mech: `Growth hormone — the primary driver of muscular repair and adaptation — is released almost entirely during deep sleep. Seven hours of sleep after a threshold session produces significantly more adaptation than six. The arithmetic is simple: an athlete sleeping six hours while training 12 hours per week is leaving measurable adaptation unrealised.`,
          prompt: `What was your average sleep duration this week? And more importantly: what was your sleep quality on the two nights after your hardest sessions? If the answer is under seven hours or consistently disrupted, that is your single highest-leverage recovery intervention — more than ice baths, compression, or supplements.`,
          good: `Treats sleep as a training variable. Protects pre-session and post-session sleep windows. Adaptation rate improves noticeably.`,
          med: `Sleeps whatever the schedule allows. Supplements with caffeine to compensate. Wonders why recovery is slow.`,
        },
        thu: {
          title: `The double discipline day requires sequencing`,
          mech: `On days with two training sessions — squad swim plus run intervals, for example — session sequencing is not arbitrary. The technically demanding or quality-sensitive session should come first when the CNS is fresh. The second session adapts to whatever capacity remains. Getting this backwards consistently degrades the quality of the sessions you most need to protect.`,
          prompt: `On your double session days this week: was the sequence intentional, or did it default to whatever was logistically easiest? Which session suffered — and was it the one you could afford to compromise, or the one that mattered most?`,
          good: `Sequences double sessions by priority, not convenience. High-quality sessions are protected. The second session is calibrated to what is genuinely achievable.`,
          med: `Sequences sessions by schedule default. High-priority sessions are often the second one. Quality is compressed by residual fatigue.`,
        },
        sun: {
          title: `Build phase halfway: the load audit`,
          mech: `Seven weeks into a build phase is when cumulative fatigue becomes the dominant variable. Athletes who started build too aggressively are now carrying suppression they can no longer outrun with caffeine and motivation. The question is not whether you feel tired — you are supposed to. The question is whether the fatigue is productive or accumulated.`,
          prompt: `Productive fatigue: performance in hard sessions is stable or improving, despite feeling tired. Accumulated fatigue: performance is declining, sleep quality is dropping, resting HR is elevated. Which describes this week? If the latter, the load needs to come down — not next week, this week.`,
          good: `Distinguishes productive from accumulated fatigue using performance data. Adjusts load before the suppression becomes a problem.`,
          med: `Interprets all fatigue as productive. Continues the load. Arrives at the peak phase already overtrained.`,
        },
      }, // end integration

    }, // end early

    // ─── Mid ─────────────────────────────────────────────────────────
    // Mid — middle weeks. Emphasis: technique. Building specificity.

    mid: {

      foundations: {
        tue: {
          title: `What your floor looks like at peak build`,
          mech: `Peak build week — the highest-load week of the block — is the week the floor matters most. Athletes who protect their floor during peak build do not arrive at race day depleted. Athletes who let the floor collapse during peak build spend the next two weeks in recovery rather than supercompensation.`,
          prompt: `Name your floor for this week specifically — given the higher load and the proximity of race day. Which session is non-negotiable? Which session is the first to sacrifice if the week gets hard? That sacrificeable session is where the decision needs to be made now, not reactively.`,
          good: `Has a clear floor for peak build week. Arrives at recovery week ready to supercompensate, not still recovering.`,
          med: `Treats peak build week as a week to do everything. Arrives at recovery week depleted and behind on the taper timeline.`,
        },
        thu: {
          title: `The race simulation session: do it once, do it right`,
          mech: `A full race simulation — swim, bike, and run at race intensity, with race nutrition — is the single most valuable session in a build block. It is also the most demanding, requiring two to three days of recovery. Done once in build week 3 with full commitment and correct execution, it answers every important race-readiness question.`,
          prompt: `When is your race simulation session scheduled, and what is your plan for it? Specific times, specific intensities, specific nutrition protocol, specific target for each leg. If you do not have all of these written down before the session, it is a long training day, not a race simulation.`,
          good: `Executes one full race simulation with written targets and a post-session debrief. Arrives at the race having answered the race-readiness questions in training.`,
          med: `Completes a long brick session without race-intensity targets or race nutrition. Calls it a race simulation. The race-day questions remain unanswered.`,
        },
        sun: {
          title: `Three-quarter block: what story does the data tell?`,
          mech: `Three weeks of training data — session logs, readiness scores, grey zone tracking, reflection notes — contains the most accurate picture of an athlete's current physiological state available anywhere. Most athletes do not read this data. They have access to a performance analysis and treat it as a log.`,
          prompt: `Review your readiness scores across this block. What patterns appear? What sessions consistently produce the worst readiness? What weeks consistently show highest grey zone percentage? Three patterns from the data should directly inform how the final weeks are structured.`,
          good: `Reads the block data analytically. Identifies three specific patterns. Adjusts the final weeks based on evidence, not intuition.`,
          med: `Uses the data as a log, not an analysis. The final weeks are structured on the same assumptions as the beginning.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `The last technique session that can produce race-day adaptation`,
          mech: `Technical changes introduced within two weeks of race day do not have time to become automated. The neuromuscular consolidation of a movement pattern requires repeated execution across multiple sessions over multiple days. Build week 3 is approximately the last week a technique change can meaningfully improve race performance.`,
          prompt: `Is there one technique change — in any discipline — that you have been meaning to consolidate but have not yet automated? This is your last practical window. Name it, make it the focus of every relevant session this week, and commit to not introducing anything new after Sunday.`,
          good: `Identifies one technique target and over-rehearses it this week. It is automated enough by race day to hold under fatigue.`,
          med: `Continues working on multiple technique points. None is sufficiently consolidated. Under race fatigue, all revert to default.`,
        },
        thu: {
          title: `Swim start strategy is not optional`,
          mech: `The first 400 metres of a triathlon swim is the most physiologically chaotic segment of the race. Blood lactate spikes, breathing is disrupted, and athletes make contact they did not plan for. The athletes who manage this well do not have better fitness — they have a specific plan for the first 400 metres that they have mentally rehearsed.`,
          prompt: `Name your swim start strategy: seeding position, first 100 metres pace, breathing pattern, contact response. If you cannot answer all four specifically, your swim start is whatever the crowd and the chaos produce. That is not a strategy.`,
          good: `Has a specific, rehearsed swim start plan. Executes it regardless of what happens around them. The first 400m is controlled.`,
          med: `Plans to find their feet in the first 200 metres. The chaos determines their first 400m. They enter T1 more disrupted than necessary.`,
        },
        sun: {
          title: `Build complete: what did it produce?`,
          mech: `A build phase should have produced three specific outputs: a higher lactate threshold, more durable technique under race-pace conditions, and a refined understanding of how your body responds to specific training stimuli. If you cannot name all three in specific terms, the build phase produced fitness but not intelligence.`,
          prompt: `Complete this sentence with specific numbers or observations, not feelings: 'My bike threshold is higher than base week one because...', 'My run durability is better because...', 'My swim technique under fatigue is improved because...'. If you cannot complete all three sentences, identify which one is the gap — that is the peak phase priority.`,
          good: `Can complete all three sentences with specific evidence. Enters the peak phase knowing exactly what they have built.`,
          med: `Can complete zero or one sentence specifically. Enters the peak phase with undefined fitness and undefined gaps.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `The race simulation session: do it once, do it right`,
          mech: `A full race simulation — swim, bike, and run at race intensity, with race nutrition — is the single most valuable session in a 70.3 build. Done once with full commitment and correct execution, it answers every important race-readiness question. Done sloppily, it produces fatigue and false confidence.`,
          prompt: `When is your race simulation session scheduled, and what is your plan for it? Specific times, specific intensities, specific nutrition protocol, specific target for each leg. If you do not have all of these written down before the session, it is a long training day, not a race simulation.`,
          good: `Executes one full race simulation with written targets and a post-session debrief. Arrives at the race having answered the race-readiness questions in training.`,
          med: `Completes a long brick session without race-intensity targets or race nutrition. Calls it a race simulation. The race-day questions remain unanswered.`,
        },
        thu: {
          title: `Multi-discipline fatigue is qualitatively different`,
          mech: `The fatigue accumulated across three disciplines in a triathlon is not additive — it is multiplicative. A 90km bike ride followed by a 21km run is physiologically more demanding than either alone, and the interaction effects on gut tolerance, thermoregulation, and neuromuscular control are only experienced when you actually do it. Simulating this in training is non-negotiable.`,
          prompt: `In your last brick session: what degraded first — legs, gut, pace, or form? And was that degradation something you expected, or something that surprised you? If it surprised you, it will surprise you again on race day unless you specifically address it.`,
          good: `Identifies the specific multi-discipline interaction that degrades first. Addresses it in the final training weeks. Race day is less surprising.`,
          med: `Notes the degradation but attributes it to fatigue. No specific intervention. The same interaction produces the same degradation on race day.`,
        },
        sun: {
          title: `Durability check before the peak phase`,
          mech: `Durability — the ability to maintain quality output late in the race — is the final measure of build phase success. Fitness without durability produces athletes who look great on paper and underperform at hour three. The peak phase cannot build durability from scratch; it can only express what the build phase produced.`,
          prompt: `In your last long session: were you a different athlete at the 70% mark than you were at the 30% mark? If form, pace, power, and mental engagement were all declining significantly, durability is the gap. If they held, the build phase achieved its core objective.`,
          good: `Can point to specific evidence of improved durability compared to base week one. Enters peak phase with confidence in late-race capacity.`,
          med: `Has general fitness but significant late-session degradation. The peak phase will confirm this gap on race day.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Race prep intensity: precise, not maximal`,
          mech: `The peak build week is not about producing new fitness — the earlier build weeks did that. It is about sharpening race-specific intensity and practising race-pace execution. Sessions should be precise and purposeful, not maximal. Maximal effort in peak build produces injury and fatigue, not fitness.`,
          prompt: `In your intensity sessions this week: were they at race pace specifically, or just hard? Race pace is a number — watts, pace per kilometre, heart rate band. If you cannot specify the target, you are not practising race pace, you are practising hard effort. Different skill.`,
          good: `Executes race-prep sessions at precise race-pace targets. The effort is familiar and controllable by race day.`,
          med: `Goes hard in race-prep sessions without specific targets. Arrives at race start having practised intensity but not race-pace precision.`,
        },
        thu: {
          title: `Reduce volume, protect intensity`,
          mech: `The taper reduces training volume — typically 30–50% across three weeks — while maintaining intensity. This combination allows the body to supercompensate: glycogen stores refill, muscle damage repairs, neuromuscular freshness returns. Athletes who reduce both volume and intensity produce none of these effects — they just detrain.`,
          prompt: `This week: what was your volume compared to peak? And what was your intensity — did you maintain race-pace efforts, or did everything become moderate as the volume came down? If intensity also dropped, your taper is producing detraining rather than supercompensation.`,
          good: `Reduces volume by 35% while maintaining at least two race-intensity efforts. Arrives at race day sharp and fresh.`,
          med: `Reduces everything — volume and intensity — because lower feels safer. Arrives at race day flat and sluggish.`,
        },
        sun: {
          title: `The race-week mental rehearsal`,
          mech: `Mental rehearsal — specifically, visualising the race execution in sequential detail — activates the same motor pathways as physical execution. Athletes who have mentally rehearsed a race multiple times approach the start line with a sense of familiarity that reduces anxiety and improves decision-making under pressure.`,
          prompt: `Close your eyes and run through your entire race in your head — from the swim start to the finish line. Where does the mental image become vague or uncertain? Those are the sections where the race plan is not fully formed. Clarify them before race day.`,
          good: `Can run through the entire race mentally with specific detail at each transition and decision point. Race day feels like repetition.`,
          med: `Has a general sense of how the race will go. Encounters vague sections on race day without a plan. Makes reactive decisions.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `The race plan is not a prediction, it is a framework`,
          mech: `A race plan specifies your decision framework — what you will do under specific conditions — not a prediction of exactly what will happen. Wind, heat, how your legs feel at kilometre 60, what the swim did to you — these will vary. The plan answers: given condition X, I do Y. Athletes without this framework make decisions reactively.`,
          prompt: `Write your race plan as a series of if/then statements rather than a fixed script. If the wind is headwind on the return leg, I drop 5 watts and extend the effort later. If my legs feel heavy at run kilometre 8, I hold pace and do not surge. Name three conditional decisions you have prepared for.`,
          good: `Arrives at the race with three to five conditional plans written and mentally rehearsed. Unexpected conditions trigger plans, not panic.`,
          med: `Has a fixed race plan based on ideal conditions. When conditions deviate, decision-making quality drops.`,
        },
        thu: {
          title: `Nutrition is the last piece to finalise`,
          mech: `Race-day nutrition must be finalised by race week — products confirmed, timing confirmed, volumes confirmed, contingency plan confirmed. Gut issues in triathlon are rarely unpredictable surprises; they are the result of an untested or poorly executed protocol meeting race-intensity gut stress.`,
          prompt: `Write your complete nutrition plan for race day: product, dose, and timing for every gel, drink, and aid station interaction. Then identify the one step in the plan most likely to fail — the gel you might drop, the aid station you might miss — and decide what you do if it happens.`,
          good: `Has a written nutrition plan with a contingency for every failure point. Race-day gut management is on autopilot.`,
          med: `Has a rough idea of the nutrition plan. Finalises it on race morning. Makes at least one significant error under pressure.`,
        },
        sun: {
          title: `Four weeks out: the final commitment`,
          mech: `Four weeks before a race is the last point at which training can meaningfully influence performance. What happens in the next four weeks is execution, recovery, and preparation — not fitness building. The fitness exists. The question is whether you can deliver it on race day.`,
          prompt: `What is the single most important thing you can do in the next four weeks to improve race performance? It is probably not more training. It is more likely sleep, refined nutrition, a specific technique rehearsal, or a logistics decision you have been avoiding. Name it and schedule it.`,
          good: `Identifies the highest-leverage non-training intervention and executes it with the same commitment as a key session.`,
          med: `Defaults to more training as the answer to 'what can I do'. Arrives at race day slightly overtrained and with unresolved logistics.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Three weeks out: protect everything`,
          mech: `Three weeks before race day is the highest injury-risk window of the season. Athletes are fit, motivated, slightly anxious, and still training hard enough to sustain overuse injuries. A three-week-out injury does not resolve before the race. A single session of poor decision-making can end the season.`,
          prompt: `Name every physical signal your body is currently producing — tightness, tenderness, niggling joint, muscular asymmetry. Each is a potential race-week problem if ignored now. What is the specific management plan for each one?`,
          good: `Addresses every physical signal specifically — physio, load reduction, targeted mobility. Arrives at race week structurally sound.`,
          med: `Dismisses physical signals as normal training wear. The race-week urgency amplifies one of them into an injury.`,
        },
        thu: {
          title: `Race week logistics: the full checklist`,
          mech: `Every unresolved logistical detail consumes cognitive resources that should be available for race execution. Athletes who arrive at race morning with gear still to pack, routes still to check, and decisions still to make are at a cognitive disadvantage before the gun fires. Logistics are not trivial — they are race preparation.`,
          prompt: `Build your complete race-week checklist now: gear, nutrition, transition setup, travel, registration, bike check-in timing, warm-up protocol, race-morning routine. Resolve every item by Wednesday of race week. Nothing should be decided on race morning.`,
          good: `Completes the full checklist by Tuesday of race week. Race morning is calm execution of a pre-decided plan.`,
          med: `Handles logistics on a rolling basis. Race morning involves several unplanned decisions. Energy is misdirected before the start.`,
        },
        sun: {
          title: `The confidence inventory`,
          mech: `Race-day confidence is not manufactured — it is earned through specific, nameable evidence of preparation. Athletes who arrive at the start line knowing exactly what they have done, what they have tested, and what they are capable of perform more consistently than those who arrive hoping their training was sufficient.`,
          prompt: `Name five specific things you have done in this block that you know will help you on race day. Not vague ('I am fitter') — specific. A specific session, a tested nutrition protocol, a technique that now holds under fatigue, a transition that is automatic. Five concrete reasons to be confident.`,
          good: `Can name five specific evidence points without hesitation. Confidence is earned, not hoped for. Race day is execution.`,
          med: `Has general confidence based on training volume. Cannot name specific evidence. Confidence is fragile when race conditions are harder than expected.`,
        },
      }, // end integration

    }, // end mid

    // ─── Late ─────────────────────────────────────────────────────────
    // Late — final week. Emphasis: durability. Consolidating before transition.

    late: {

      foundations: {
        tue: {
          title: `Build block complete: what did it produce?`,
          mech: `A build block should produce three specific outputs: a higher lactate threshold, more durable technique under race-pace conditions, and a refined understanding of how your body responds to specific training stimuli. If you cannot name all three in specific terms, the block produced fitness but not intelligence.`,
          prompt: `Name the single biggest performance gain from this build block. Name the single biggest unresolved problem. The gain tells you what to protect in the next block. The problem tells you what must be addressed — because it will not fix itself under higher load.`,
          good: `Can articulate both precisely. Enters the next block with a clear asset to leverage and a clear gap to close.`,
          med: `Has a vague sense that fitness improved. Enters the next block without specific intelligence.`,
        },
        thu: {
          title: `The floor evolved through the build block`,
          mech: `The minimum viable week at the end of a build block is defined by four weeks of evidence about what actually matters, what is actually sustainable, and what actually produces adaptation for this specific athlete. It should be significantly more refined, specific, and defensible than the base phase floor.`,
          prompt: `Define your end-of-build-block minimum viable week with the precision that the evidence allows. Name the sessions, the sequence, the minimum duration, and the recovery requirements. This is not an ideal week — it is the floor that survives anything life throws at it.`,
          good: `Has a highly specific, evidence-based floor definition. The next block starts with this floor, not a generic template.`,
          med: `Has a floor similar to the original base phase definition. Four weeks of evidence has not significantly refined what is protected.`,
        },
        sun: {
          title: `What the next block begins with`,
          mech: `The first decision of the next block is made at the end of this one. Athletes who complete a block debrief — honestly, specifically, without defensiveness — set up the next block with accurate information. Athletes who move straight to the next training plan repeat the same patterns with slightly more fitness.`,
          prompt: `Name the three things that most limited your performance this block — not the result, the performance. One physiological, one tactical, one logistical. These are your three highest-priority inputs for the next block's planning. If you cannot name them specifically, the next block will produce familiar limitations.`,
          good: `Completes a specific block debrief and carries three clear priorities into the recovery week and next-block planning.`,
          med: `Moves straight to planning the next race and the next training block. The same limitations appear in the same places.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Technique at block end: what held, what did not`,
          mech: `Technique targets set at the start of the build block have now been through four weeks of increasing intensity. The technique changes that held under race-pace fatigue are now part of the athlete's movement repertoire. The ones that did not hold under fatigue are the ones that needed more time or a different approach.`,
          prompt: `For each of the technique targets set at the start of this build block: does the change hold at race intensity, or does it revert under fatigue? The ones that revert are not failures — they are the starting points for the next block. Name each specifically.`,
          good: `Can account for each technique target precisely — held or reverted, and why. Next block technique work begins from this specific diagnosis.`,
          med: `Has a general sense of technique improvement. Cannot specify which changes held under fatigue and which reverted. Next block technique work starts without accurate diagnosis.`,
        },
        thu: {
          title: `Final race prep: nothing new`,
          mech: `The single most common race-week error at all levels is introducing something new — a new nutrition product, a new equipment configuration, a new session type — in the belief that it might produce marginal improvement. It does not. The marginal gains available from last-minute innovation are negative. The only available gain is executing everything proven with precision.`,
          prompt: `Is there anything in your upcoming race preparation — nutrition, equipment, session, supplement, routine — that has not been tested in training at race intensity? If yes, remove it. The risk-adjusted value of any untested intervention in race week is negative.`,
          good: `Race week is 100% proven protocol. Nothing untested. Execution is precise and familiar.`,
          med: `Introduces one or two small new elements 'just to optimise'. Each carries unrealised risk. At least one produces a suboptimal outcome.`,
        },
        sun: {
          title: `The technical audit`,
          mech: `An honest technical audit at block end serves two purposes simultaneously: it confirms what is consolidated and race-ready, and it identifies what the next block's technique work should prioritise. Both are valuable. Both require the same level of honesty.`,
          prompt: `Rate your technique in each discipline on a 1–10 scale — not relative to other athletes, but relative to the best version of your technique you have demonstrated in training this block. Where are the gaps between your best-day technique and your race-day technique? Those gaps are the next block's technical starting points.`,
          good: `Produces a specific per-discipline technique rating with evidence. The gap between best-day and race-day technique is identified and becomes the next block's target.`,
          med: `Has a general sense of technique level. Cannot specify the best-day to race-day gap. Next block technique work starts without a specific target.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `What recovery is actually doing at block end`,
          mech: `A build block recovery week is different from a base block recovery week: the accumulated stimulus is higher, the connective tissue has been under more stress, and the neuromuscular system is more depleted. The recovery window needs to be genuinely respected — not just volume-reduced — or the next block starts below the ceiling the build phase raised.`,
          prompt: `Compare your current physical state to base recovery week. What specifically is different — where is the fatigue accumulated, which structures feel most loaded, which sessions would feel hardest right now? That comparison tells you whether this recovery week needs to be more aggressive than the previous one.`,
          good: `Calibrates recovery week depth to the actual accumulated load, not to a generic protocol. The next block starts genuinely fresh.`,
          med: `Applies the same recovery week protocol as after the base block. Under-recovers from a heavier stimulus. The next block starts carrying residual load.`,
        },
        thu: {
          title: `Connective tissue takes longer than muscle`,
          mech: `Muscular fitness adapts to training within weeks. Connective tissue — tendons, ligaments, cartilage — adapts over months to years. Athletes who build muscular fitness faster than their connective tissue can adapt are accumulating structural fragility. This is why overuse injuries peak at the end of build phases — the muscles are ready, the tendons are not.`,
          prompt: `Which connective tissue structures have been the most stressed or symptomatic this block — Achilles, knee, plantar fascia, shoulder, hip flexor? What is the specific loading pattern that aggravates each? That loading pattern should be managed in the next block, not repeated without modification.`,
          good: `Identifies the high-risk connective tissue structures and adjusts loading patterns specifically. Next block injury risk is reduced.`,
          med: `Continues the same loading patterns. The same connective tissue structures become symptomatic at the same points in the training cycle.`,
        },
        sun: {
          title: `Build block complete: durability audit`,
          mech: `The build block should have produced a higher durability ceiling than the base block — measured by how long into a long session performance holds before degrading. If the ceiling is in the same place as it was after the base phase, the quality of build work needs examination — too much grey zone, insufficient session length, or inadequate recovery.`,
          prompt: `Compare your long-session durability now to the end of the base block: how many more minutes can you sustain quality output before it degrades? If the number has not changed, what specifically limited the build block from raising the ceiling?`,
          good: `Can identify a specific improvement in durability ceiling and attribute it to specific training changes. Next block starts on a higher platform.`,
          med: `Has a vague sense that build fitness is similar to base fitness. Cannot identify specific durability improvement. Next block starts from the same point.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Intensity tolerance has a ceiling`,
          mech: `An athlete's capacity to absorb high-intensity training — measured by recovery time, performance maintenance, and injury risk — has an individual ceiling that is relatively fixed in the short term. Athletes who repeatedly exceed this ceiling do not adapt faster; they suppress adaptation and increase injury risk. Knowing your ceiling is more valuable than raising it.`,
          prompt: `At what training density — how many high-intensity sessions per week, at what volume — do you reliably recover well versus start to struggle? Name the specific numbers. If you do not know, the next build block will teach you — but at higher cost than knowing in advance.`,
          good: `Enters the next build block with a known intensity tolerance ceiling. High-quality sessions are scheduled within it. Adaptation is more consistent.`,
          med: `Does not know their intensity ceiling. Discovers it reactively when suppression or injury appears. Recovery time is lost.`,
        },
        thu: {
          title: `Recovery week: no new intensity`,
          mech: `The recovery week is not an opportunity to test fitness or add one more quality session. Every quality session in a recovery week delays the supercompensation it is designed to produce. The fitness is not going anywhere. The recovery window is finite.`,
          prompt: `Is there any session this week you are planning that includes sustained effort above Zone 2? If yes, ask: what specific adaptation does this session produce that next block's week 1 cannot produce on fresher legs? If you cannot answer that question, the session should not happen.`,
          good: `Holds the recovery week to genuinely easy movement. Arrives at the next block's week 1 feeling sharp and slightly under-trained — the correct feeling.`,
          med: `Adds one 'light intensity' session. Feels productive. Arrives at week 1 of the next block 10% less recovered than they would have been.`,
        },
        sun: {
          title: `Transition to the next block: what the build phase produced`,
          mech: `The next block is most effective when entered with specific knowledge of what this build phase developed and what it did not. Athletes who enter the next block without this knowledge apply intensity to an undefined foundation. The result is inconsistent — sometimes effective, sometimes not — and impossible to troubleshoot.`,
          prompt: `Complete this sentence: 'My aerobic base is stronger than it was at base block start in these specific ways...' If you cannot complete it, identify the specific measurement that would tell you whether it is stronger. Then take that measurement this week.`,
          good: `Has specific evidence of improvement compared to block start. Next block intensity is calibrated to the actual foundation.`,
          med: `Has general confidence that fitness is better. Next block intensity is set on intuition rather than evidence.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Race craft block review`,
          mech: `Race craft decisions — pacing, nutrition timing, transition execution — are built through deliberate rehearsal over many sessions. At the end of a build block, the honest question is: how many rehearsals actually happened? Each rehearsal in the build block is a rehearsal that does not need to happen for the first time under race-day pressure.`,
          prompt: `Name one race craft decision you rehearsed deliberately in this block. Name one you intended to rehearse but did not. The one you did not rehearse is the one you will need to make on race day without preparation. What is the specific opportunity in the next block to address it?`,
          good: `Has rehearsed at least two race craft decisions deliberately in the build block. The next block adds race-intensity rehearsal on top of that foundation.`,
          med: `Has not deliberately rehearsed any race craft decisions. The next block introduces intensity on top of unmade decisions.`,
        },
        thu: {
          title: `Second season racing: execute the lessons`,
          mech: `Each block builds race craft advantage over the previous one: you know your pacing tendencies, your nutrition response, your transition patterns, and your psychological vulnerabilities under race conditions. The only question is whether you will use that knowledge to race differently, or whether familiarity will produce the same decisions.`,
          prompt: `Name the three most expensive race-craft errors from your last race — specific decisions that cost time or energy. Now name the specific change you have practised in training for each one. If you cannot name the training rehearsal, the error has not been corrected — only understood.`,
          good: `Has rehearsed the corrected decision in training for each of the three errors. Race day implements corrections that have been tested.`,
          med: `Understands what went wrong. Has not rehearsed the corrections in training. Makes similar decisions under race-day conditions.`,
        },
        sun: {
          title: `Patience is the recovery week's most important skill`,
          mech: `The recovery week is the time to rebuild the aerobic foundation — not accelerate it. Athletes who use the higher fitness from the build block to train at higher intensity in recovery week compromise the adaptations that the recovery week is specifically designed to produce.`,
          prompt: `Are your recovery week sessions genuinely easy — at the same relative Zone 2 effort as base recovery week — or are they drifting harder because you feel fitter? Feeling fitter and training easier simultaneously is correct. If it feels wrong, that is the patience problem.`,
          good: `Holds recovery week at genuine Zone 2 despite higher fitness. Supercompensation completes fully. Next block starts on a higher platform.`,
          med: `Trains harder in recovery week because they feel fitter. Grey zone re-enters. The next block builds on a compromised foundation.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Two seasons of data: use it`,
          mech: `An athlete who has completed a full block with consistent reflection logging has a dataset that most coaches would consider invaluable. Readiness patterns, grey zone trends, vulnerable session identification, recovery time profiles — all of this is captured and most of it has not been used analytically. The recovery week is the opportunity to close the loop.`,
          prompt: `Review your readiness scores across this block. At what points in the cycle do they consistently drop most significantly? Before which specific sessions? After which specific weeks? The pattern is your physiological rhythm — designing the next block around it produces better performance than designing around a generic plan.`,
          good: `Identifies two or three readiness patterns from the full dataset and applies them to next-block planning. Key sessions hit at peak readiness.`,
          med: `Has the data but does not analyse it. Plans the next block generically. Readiness on key sessions is a function of luck rather than design.`,
        },
        thu: {
          title: `Manage the block's accumulated fatigue`,
          mech: `Week 4 of a build block carries significant accumulated fatigue. The supercompensation window requires the stress to be removed completely before the adaptation can be expressed. Athletes who do not account for this arrive at the next block's week 1 under-recovered.`,
          prompt: `Compare your current resting HR and subjective energy to build week 1. If both are lower or worse, you are carrying more accumulated fatigue than a standard recovery week addresses. The recovery week may need to be more aggressive than planned.`,
          good: `Adjusts recovery week depth based on accumulated fatigue signal. Arrives at the next block more recovered than the previous cycle.`,
          med: `Applies the same recovery protocol regardless of accumulated load. Arrives at the next block with more residual fatigue.`,
        },
        sun: {
          title: `The block-long integration: what has held together?`,
          mech: `Training consistency — the percentage of planned sessions completed across the full block — is the primary driver of performance improvement. Not session quality, not training load, not programme sophistication. The athletes who make the most consistent long-term progress are the ones who have the highest session completion over the longest period.`,
          prompt: `Across the full build block: what has held together consistently — discipline, habit, recovery practice, or session type — regardless of what life threw at it? And what has been the most fragile? The consistent element is your training identity. The fragile element is the next block's structural problem to solve.`,
          good: `Identifies the consistent core and the fragile periphery. The next block is designed to protect the core and structurally reinforce the periphery.`,
          med: `Has not tracked session completion with enough granularity to answer. Designs the next block without this information.`,
        },
      }, // end integration

    }, // end late

  }, // end build

  // ═══════════════════════════════════════════════════════════════════════════
  // PEAK PHASE — PRO TIER
  // ═══════════════════════════════════════════════════════════════════════════

  peak: {

    // ─── Early ─────────────────────────────────────────────────────────
    // Early — first week. Emphasis: racecraft. Opening the phase.

    early: {

      foundations: {
        tue: {
          title: `Race week training: less is more, precision is everything`,
          mech: `The purpose of peak-phase training is not to add fitness — it is to maintain neuromuscular sharpness while allowing full recovery. Sessions should be short, precise, and at race pace for brief efforts. More than 45 minutes of quality work in race week risks leaving residual fatigue in the legs on race day.`,
          prompt: `What does your peak-phase training schedule look like? If any session exceeds 60 minutes or includes sustained effort above race pace, it is too much. The goal is to arrive at race morning feeling sharp and slightly under-loaded, not fully trained.`,
          good: `Peak phase includes two short, sharp sessions of 30–45 minutes with race-pace efforts. Arrives at race morning sharp and fresh.`,
          med: `Treats peak phase as a normal reduced-volume week. Sessions are still 75–90 minutes with moderate intensity. Arrives carrying residual fatigue.`,
        },
        thu: {
          title: `The night before: control only what you can`,
          mech: `Race-eve anxiety focuses on variables outside your control — weather, competitors, course conditions. This is physiologically counterproductive. Cortisol elevation from anxiety disrupts sleep, impairs glycogen storage, and reduces next-day performance. Directing attention to controllable variables — nutrition, sleep, gear, routine — produces better physiological and psychological preparation.`,
          prompt: `Name every variable in tomorrow's race that is within your control. Pack that list. Name every variable that is outside your control. Put that list down. The race you can influence is only the first list.`,
          good: `Focuses entirely on controllable variables race-eve. Sleep is protected. Arrives at race morning calm and prepared.`,
          med: `Spends race-eve thinking about weather, competition, and what-ifs. Sleep is disrupted. Cortisol is elevated before the gun.`,
        },
        sun: {
          title: `Post-race: what the result actually means`,
          mech: `A race result is one data point from one day under one set of conditions. It is not a verdict on the block's training. The most useful post-race question is not 'did I hit my time?' — it is 'did I execute the plan?' Execution quality is something you control. Race-day conditions are not.`,
          prompt: `Evaluate your race on execution, not result. Did you execute the swim start plan? Did you hold the bike pacing strategy? Did you take the first run gel at the right time? If execution was good and the result was slower than expected, the variables were external. If execution was poor, you have specific things to fix.`,
          good: `Evaluates the race on a specific execution scorecard. Knows exactly what to carry forward and what to change.`,
          med: `Evaluates the race entirely on finish time. Draws conclusions about fitness that may be inaccurate. Changes the wrong things.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Final race prep: nothing new`,
          mech: `The single most common race-week error at all levels is introducing something new — a new nutrition product, a new equipment configuration, a new session type — in the belief that it might produce marginal improvement. It does not. The marginal gains available from race-week innovation are negative. The only available gain is executing everything proven with precision.`,
          prompt: `Is there anything in your race-week preparation — nutrition, equipment, session, supplement, routine — that has not been tested in training at race intensity? If yes, remove it. The risk-adjusted value of any untested intervention in race week is negative.`,
          good: `Race week is 100% proven protocol. Nothing untested. Execution is precise and familiar.`,
          med: `Introduces one or two small new elements 'just to optimise'. Each carries unrealised risk. At least one produces a suboptimal outcome.`,
        },
        thu: {
          title: `Swim start strategy is not optional`,
          mech: `The first 400 metres of a triathlon swim is the most physiologically chaotic segment of the race. Blood lactate spikes, breathing is disrupted, and athletes make contact they did not plan for. The athletes who manage this well do not have better fitness — they have a specific plan for the first 400 metres that they have mentally rehearsed.`,
          prompt: `Name your swim start strategy: seeding position, first 100 metres pace, breathing pattern, contact response. If you cannot answer all four specifically, your swim start is whatever the crowd and the chaos produce. That is not a strategy.`,
          good: `Has a specific, rehearsed swim start plan. Executes it regardless of what happens around them. The first 400m is controlled.`,
          med: `Plans to find their feet in the first 200 metres. The chaos determines their first 400m. They enter T1 more disrupted than necessary.`,
        },
        sun: {
          title: `The technical audit at peak`,
          mech: `An honest technical audit at the start of peak phase serves two purposes: it confirms what is consolidated and race-ready, and it identifies what needs focused attention in the final weeks. Both require the same level of honesty.`,
          prompt: `Rate your technique in each discipline on a 1–10 scale — not relative to other athletes, but relative to the best version of your technique demonstrated in training this block. Where are the gaps between your best-day technique and your race-day technique?`,
          good: `Produces a specific per-discipline technique rating with evidence. The gap between best-day and race-day technique is identified and targeted.`,
          med: `Has a general sense of technique level. Cannot specify the best-day to race-day gap. Technique work is undirected.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `Durability arriving at peak phase`,
          mech: `The durability developed across the base and build phases is now the most important asset going into race week. It does not disappear in a taper — in fact, the taper allows it to be expressed fully for the first time. What may feel like reduced fitness during taper is the aerobic system consolidating the block's work. Durability is the foundation. The peak phase is the expression.`,
          prompt: `In your last quality session before taper begins in earnest: how long did you sustain race-pace quality before performance noticeably degraded? That duration is your current durability ceiling. What would it take to extend it by 10–15 minutes? That answer is the specific durability target for the final sessions of this block.`,
          good: `Knows their current durability ceiling precisely. Has a specific target for extending it. Uses the final quality sessions purposefully.`,
          med: `Has a general sense of late-session fatigue. Does not know their specific durability ceiling. Final sessions are not purposefully directed.`,
        },
        thu: {
          title: `The final hard session of the block`,
          mech: `The final quality session of a training block should be executed with intention — not maximally, but precisely. Its purpose is to confirm race readiness, not build fitness. The session should feel controlled, sharp, and familiar. If it feels maximal and desperate, the taper has not done its job.`,
          prompt: `What is your final quality session this block, and what does success look like? Not a time or power target — an execution description. Controlled effort in the first third. Race-pace precision in the middle. Form held in the final third. Success is not how fast. It is how well.`,
          good: `Executes the final quality session to a specific execution description. Arrives at race day with a confirmed readiness signal.`,
          med: `Treats the final quality session as a fitness test. Goes hard. Carries residual fatigue into race week.`,
        },
        sun: {
          title: `Durability across the block: the honest measure`,
          mech: `The durability developed across a full training block is the most durable asset in endurance sport. It does not disappear in a taper week. It is the accumulated structural resilience of the connective tissue, the deep aerobic base of the cardiac system, and the neuromuscular economy of practised movement patterns. It is what the block was building.`,
          prompt: `Compare your long-session durability now to the start of the base phase: how many more minutes can you sustain race-pace quality before performance degrades? That number is the block's most honest performance metric — more informative than any single race result.`,
          good: `Can quantify the durability improvement specifically. The number is the evidence that the block produced what it was designed to produce.`,
          med: `Feels more durable in a general sense. Cannot quantify the improvement. The block produced fitness that cannot be measured or replicated.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Race prep intensity: precise, not maximal`,
          mech: `The peak phase is not about producing new fitness — the build phase did that. It is about sharpening race-specific intensity and practising race-pace execution. Sessions should be precise and purposeful, not maximal. Maximal effort in peak phase produces injury and fatigue, not fitness.`,
          prompt: `In your intensity sessions this week: were they at race pace specifically, or just hard? Race pace is a number — watts, pace per kilometre, heart rate band. If you cannot specify the target, you are not practising race pace, you are practising hard effort. Different skill.`,
          good: `Executes race-prep sessions at precise race-pace targets. The effort is familiar and controllable by race day.`,
          med: `Goes hard in race-prep sessions without specific targets. Arrives at race start having practised intensity but not race-pace precision.`,
        },
        thu: {
          title: `Reduce volume, protect intensity`,
          mech: `The taper reduces training volume — typically 30–50% — while maintaining intensity. This combination allows the body to supercompensate. Athletes who reduce both volume and intensity produce none of these effects — they just detrain.`,
          prompt: `This week: what was your volume compared to peak build? And what was your intensity — did you maintain race-pace efforts, or did everything become moderate as the volume came down? If intensity also dropped, your taper is producing detraining rather than supercompensation.`,
          good: `Reduces volume by 35% while maintaining at least two race-intensity efforts. Arrives at race day sharp and fresh.`,
          med: `Reduces everything — volume and intensity — because lower feels safer. Arrives at race day flat and sluggish.`,
        },
        sun: {
          title: `The race-week mental rehearsal`,
          mech: `Mental rehearsal — specifically, visualising the race execution in sequential detail — activates the same motor pathways as physical execution. Athletes who have mentally rehearsed a race multiple times approach the start line with a sense of familiarity that reduces anxiety and improves decision-making under pressure.`,
          prompt: `Close your eyes and run through your entire race in your head — from the swim start to the finish line. Where does the mental image become vague or uncertain? Those are the sections where the race plan is not fully formed. Clarify them before race day.`,
          good: `Can run through the entire race mentally with specific detail at each transition and decision point. Race day feels like repetition.`,
          med: `Has a general sense of how the race will go. Encounters vague sections on race day without a plan. Makes reactive decisions.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `The race plan is not a prediction, it is a framework`,
          mech: `A race plan specifies your decision framework — what you will do under specific conditions — not a prediction of exactly what will happen. Wind, heat, how your legs feel at kilometre 60 — these will vary. The plan answers: given condition X, I do Y. Athletes without this framework make decisions reactively.`,
          prompt: `Write your race plan as a series of if/then statements. If the wind is headwind on the return leg, I drop 5 watts. If my legs feel heavy at run kilometre 8, I hold pace and do not surge. Name three conditional decisions you have prepared for.`,
          good: `Arrives at the race with three to five conditional plans written and mentally rehearsed. Unexpected conditions trigger plans, not panic.`,
          med: `Has a fixed race plan based on ideal conditions. When conditions deviate, decision-making quality drops.`,
        },
        thu: {
          title: `Nutrition is the last piece to finalise`,
          mech: `Race-day nutrition must be finalised by race week — products confirmed, timing confirmed, volumes confirmed, contingency plan confirmed. Gut issues in triathlon are rarely unpredictable surprises; they are the result of an untested or poorly executed protocol meeting race-intensity gut stress.`,
          prompt: `Write your complete nutrition plan for race day: product, dose, and timing for every gel, drink, and aid station interaction. Then identify the one step most likely to fail — the gel you might drop, the aid station you might miss — and decide what you do if it happens.`,
          good: `Has a written nutrition plan with a contingency for every failure point. Race-day gut management is on autopilot.`,
          med: `Has a rough idea of the nutrition plan. Finalises it on race morning. Makes at least one significant error under pressure.`,
        },
        sun: {
          title: `Race craft compounds across blocks`,
          mech: `Race intelligence — the quality of decisions made under race conditions — develops across blocks, not within them. The next race is the first opportunity to apply what this block taught about pacing, nutrition, transitions, and race-start execution. Athletes who debrief and carry specific lessons forward improve race craft faster.`,
          prompt: `Name the three race-craft lessons from this block that will directly change how you race next time. Specific decisions, not general intentions. 'I will start the bike 5 watts lower than race pace for the first 20 minutes' rather than 'I will pace better'.`,
          good: `Carries three specific, actionable race-craft changes into the next block and rehearses them in training.`,
          med: `Has a general sense that they learned something. The specific lessons are vague and do not produce specific training behaviour.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `The pre-race taper anxiety is not a signal`,
          mech: `Taper anxiety — the feeling of detraining, flatness, and reduced motivation that accompanies reduced training volume — is a well-documented psychological phenomenon with no physiological basis. The body is supercompensating. The mind is interpreting reduced training as threat. These two things are happening simultaneously and should not be confused.`,
          prompt: `Describe your mental state in the last 48 hours. Are you interpreting flat legs as detraining, or as glycogen supercompensation? Are you interpreting reduced motivation as loss of fitness, or as parasympathetic nervous system recovery? Name the correct interpretation for each feeling you have.`,
          good: `Recognises taper anxiety as a process, not a signal. Continues the taper protocol. Arrives at race day fresh and sharp.`,
          med: `Interprets taper anxiety as evidence of insufficient fitness. Adds training. Arrives at race day carrying fatigue.`,
        },
        thu: {
          title: `Race week logistics are race preparation`,
          mech: `Cognitive load on race morning is the enemy of performance. Every decision made on race morning is made under cortisol and sleep disruption. Every decision made in the preceding week is made calmly and rationally. The cognitive budget for race morning should be as close to zero as possible.`,
          prompt: `List every race-morning decision that you have not yet made. Gear checklist, nutrition protocol, transition setup, warm-up routine, drive time to venue, wetsuit decision criteria. Each unresolved decision is a cognitive tax on race morning. Resolve them this week.`,
          good: `Completes a race-morning decision inventory. Everything is resolved before race week. Race morning is execution only.`,
          med: `Handles race-morning decisions on race morning. Makes several suboptimal choices under pressure. Performance is affected before the gun goes off.`,
        },
        sun: {
          title: `What the block produced: the honest ledger`,
          mech: `The block is enough to see clearly what has changed and what has not. The next block exists to address what this one could not. An honest ledger of progress and persistent limitations is the most useful document a self-coached athlete can produce.`,
          prompt: `Two columns: what has genuinely improved since block start, with specific evidence; and what is still the same or unresolved, also with specific evidence. The second column is not a failure list — it is the next block's priority list.`,
          good: `Produces a specific, honest two-column ledger. The next block addresses column two deliberately.`,
          med: `Has a general sense of improvement and a vague awareness of persistent problems. The next block repeats this block's priority list.`,
        },
      }, // end integration

    }, // end early

    // ─── Mid ─────────────────────────────────────────────────────────
    // Mid — middle weeks. Emphasis: intensity. Building specificity.

    mid: {

      foundations: {
        tue: {
          title: `One week out: the floor that survives race week`,
          mech: `Race week training is not about fitness — it is about arriving at race morning with neuromuscular sharpness, fully recovered, and carrying no new variables. The floor for race week is the minimum that maintains sharpness without adding fatigue. Everything above that floor is risk.`,
          prompt: `What is your race week training floor — the sessions that maintain sharpness without adding fatigue? Name them specifically: duration, intensity, and purpose. If any session on your current race week plan exceeds those parameters, question whether it stays.`,
          good: `Has a clear race week floor that is deliberately below normal training load. Arrives at race morning sharp and rested.`,
          med: `Treats race week as a normal reduced-volume week. Sessions drift above the sharpness-maintenance threshold. Arrives with avoidable residual fatigue.`,
        },
        thu: {
          title: `Recovery is a skill`,
          mech: `Highly motivated endurance athletes are generally poor at resting. The same psychological characteristics that produce training consistency — discipline, goal orientation, discomfort tolerance — also produce guilt during rest, anxiety during reduced load, and a tendency to equate productivity with training.`,
          prompt: `Rate your ability to rest without guilt or anxiety on a 1–10 scale. If below 7, rest is currently working against you rather than for you. What specifically produces the discomfort — fear of detraining, identity, loss of structure? Naming it makes it more manageable.`,
          good: `Rests deliberately and without guilt. Returns to training physiologically and psychologically refreshed.`,
          med: `Rests with chronic low-level anxiety about detraining. Returns to training too early. The next block starts from an incomplete recovery.`,
        },
        sun: {
          title: `Thirty-seven weeks: the athlete you have become`,
          mech: `Consistent structured training across multiple blocks produces an athlete who is qualitatively different from the one who started — not just fitter, but more self-aware, better at reading physiological signals, more accurate in effort calibration, and more capable of making good decisions under race conditions.`,
          prompt: `Name three ways you train differently now than you did at the start of your first block — not harder or longer, but differently. Different session design, different recovery practice, different zone calibration, different technique focus. Those three differences are the evidence of athletic development, as distinct from fitness improvement.`,
          good: `Can name three specific behavioural or methodological changes. The development is real and articulable.`,
          med: `Trains harder and longer than at block start. Cannot name specific methodological changes. Fitness has improved; athletic intelligence less so.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Race week: consolidate, do not introduce`,
          mech: `Technical changes introduced in race week will not be consolidated before the race. The neuromuscular consolidation of a movement pattern requires repeated execution across multiple sessions. Race week is for confirming what is consolidated, not adding new corrections.`,
          prompt: `Of all the technique work done this block, which change is most consolidated — holds under fatigue without conscious attention? That is your race-day technical asset. Focus entirely on expressing it on race day. Stop trying to fix anything else.`,
          good: `Arrives at race day knowing exactly which technique changes are assets and which are still in progress. Does not try to fix in-progress ones on race day.`,
          med: `Continues trying to correct multiple technique points in race week. Arrives at race day without a clear technical identity.`,
        },
        thu: {
          title: `Final race prep: nothing new`,
          mech: `The single most common race-week error at all levels is introducing something new in the belief that it might produce marginal improvement. It does not. The marginal gains available from race-week innovation are negative. The only available gain is executing everything proven with precision.`,
          prompt: `Is there anything in your race-week preparation that has not been tested in training at race intensity? If yes, remove it.`,
          good: `Race week is 100% proven protocol. Nothing untested. Execution is precise and familiar.`,
          med: `Introduces one or two small new elements 'just to optimise'. Each carries unrealised risk.`,
        },
        sun: {
          title: `The technical audit at peak week 3`,
          mech: `An honest technical audit at the end of the peak phase serves two purposes: it confirms what is consolidated and race-ready, and it identifies what the next block's technique work should prioritise.`,
          prompt: `Rate your technique in each discipline on a 1–10 scale relative to the best version demonstrated this block. Where are the gaps between your best-day technique and your race-day technique? Those gaps are the next block's technical starting points.`,
          good: `Produces a specific per-discipline technique rating with evidence.`,
          med: `Has a general sense of technique level. Cannot specify the best-day to race-day gap.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `Durability across the block: the final measure`,
          mech: `The durability developed across a full training block is the most durable asset in endurance sport — it does not disappear in a taper week. It is the accumulated structural resilience of the connective tissue, the deep aerobic base of the cardiac system, and the neuromuscular economy of practised movement patterns.`,
          prompt: `Compare your long-session durability now to the start of the base phase: how many more minutes can you sustain race-pace quality before performance degrades? That number is the block's most honest performance metric.`,
          good: `Can quantify the durability improvement specifically. The number is the evidence that the block produced what it was designed to produce.`,
          med: `Feels more durable in a general sense. Cannot quantify the improvement.`,
        },
        thu: {
          title: `Unstructured movement is not wasted time`,
          mech: `Complete rest after a peak-load race or training week produces psychological flatness and mild detraining within 10–14 days. Unstructured movement — walking, easy swimming, casual cycling — maintains baseline physiological function, supports active recovery, and preserves the psychological relationship with exercise without adding training load.`,
          prompt: `What does your movement this week look like — not training, movement? If the answer is nothing at all, that is probably too little. If it is structured sessions, that is too much. The target is 30–60 minutes of genuinely easy movement per day, no targets, no data.`,
          good: `Moves daily without structure or targets. Motivation for training returns naturally.`,
          med: `Either does nothing (psychologically difficult, mild detraining) or returns to structured training immediately (extends the suppression).`,
        },
        sun: {
          title: `Block complete: the debrief that sets up the next one`,
          mech: `The quality of the next block's first week is determined by the quality of this block's final debrief. Athletes who complete a specific, honest, evidence-based debrief begin the next block with a clear platform and clear targets.`,
          prompt: `Three final questions. One: what is the single most important thing this block produced that you want to protect going forward? Two: what is the single most important thing this block failed to resolve that the next block must address? Three: what is the one training behaviour that produced the most consistent positive results? Those three answers are your next block's north star.`,
          good: `Answers all three specifically, with evidence. Next block begins with a clear mandate rather than a blank programme.`,
          med: `Moves to next block planning without completing the debrief. The next block starts with more fitness but without the intelligence to use it optimally.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Race prep intensity: precise, not maximal`,
          mech: `Peak week 3 is the final sharpening window. Sessions should be at race pace — not above it, not below it. Precise race-pace work confirms the fitness is there and leaves nothing in the fatigue tank that doesn't need to be there.`,
          prompt: `In your final intensity sessions this week: were they at race pace specifically? If not, what did you actually train? The gap between 'hard' and 'race pace' is the gap between practising effort and practising execution.`,
          good: `Final intensity sessions are at precise race-pace targets. Arrives at race morning with a confirmed readiness signal.`,
          med: `Goes hard in final sessions without specific targets. Arrives carrying unnecessary fatigue.`,
        },
        thu: {
          title: `Race week training: nothing that can't be recovered from`,
          mech: `The only training permitted in race week is training you can fully recover from before race morning. A 30-minute easy spin is recoverable. A 45-minute threshold session is not, if the race is in three days. The filter is not 'will this help' — it is 'will this be fully cleared before the gun fires'.`,
          prompt: `Apply the recovery filter to every session on your race week plan: will I be fully recovered from this before race morning? If the answer is 'probably' rather than 'definitely', the session does not happen or the intensity drops.`,
          good: `Applies the recovery filter decisively. Race week is genuinely easy. Arrives at race morning with nothing outstanding.`,
          med: `Applies the recovery filter loosely. Keeps sessions that feel manageable rather than recoverable. The difference shows on race day.`,
        },
        sun: {
          title: `Peak phase complete: intensity audit`,
          mech: `The purpose of the peak phase intensity work was to sharpen race-specific output — not to build new fitness, but to ensure the fitness built can be expressed at race-pace precision on demand. The question now is whether it worked.`,
          prompt: `In your final race-pace sessions this block: did race pace feel controlled, familiar, and sustainable for the target duration? Or did it still feel like an effort that required pushing rather than expressing? The answer tells you whether the peak phase achieved its sharpening goal.`,
          good: `Race pace feels controlled and familiar. The peak phase sharpened what the build phase built. Race day is expression, not effort.`,
          med: `Race pace still feels like a push. The peak phase did not complete the sharpening. The race will reveal whether fitness or readiness is the gap.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `The race plan is a framework, not a script`,
          mech: `A race plan specifies your decision framework — what you will do under specific conditions — not a prediction of what will happen. The plan answers: given condition X, I do Y. Athletes without this framework make decisions reactively. Athletes with it make them confidently.`,
          prompt: `Write your race plan as a series of if/then statements. Name three conditional decisions you have prepared for. Test each one mentally: if condition X occurs, am I ready to execute Y automatically, or do I need to think about it?`,
          good: `Has three to five conditional plans that activate automatically under pressure. Race day is decision execution, not decision making.`,
          med: `Has a fixed race plan based on ideal conditions. When conditions deviate, decision-making quality drops.`,
        },
        thu: {
          title: `Race craft compounds only if you debrief`,
          mech: `A race without a structured debrief is experience without learning. The gap between a good age-grouper and a sharp one is often not fitness — it is the quality of decisions made under fatigue, and the willingness to audit those decisions after the fact.`,
          prompt: `After race day: name one decision you got right across each discipline. Name one decision you would change. That is six answers. Write them down within 48 hours. Those six answers are the next block's race craft starting points.`,
          good: `Completes the race craft debrief within 48 hours. The six answers feed directly into the next block's rehearsal priorities.`,
          med: `Waits a week to debrief. Memory has distorted. The result frames the debrief rather than the execution.`,
        },
        sun: {
          title: `What the next block's race will reveal`,
          mech: `The purpose of the next block's target race is not just to produce a result — it is to reveal the next layer of performance limiters. Every race result, well-executed or not, contains information about what the next block needs to develop. Athletes who approach the race as a data-collection event extract more value from it.`,
          prompt: `Before the race: name three questions you want the race to answer about your current performance level. Not 'will I go faster?' — specific questions. Does my pacing strategy hold in the second half? Does the nutrition protocol work under race-day gut stress? Does my run form hold past kilometre 15? These are the answers worth getting.`,
          good: `Arrives at race day with three specific questions to answer. The debrief is structured around the answers. Next-block planning is evidence-based.`,
          med: `Arrives at race day focused on the finish time. The race produces a result but not specific performance intelligence.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Peak phase: protect your investment`,
          mech: `The peak phase represents the accumulated training investment of the full block. The highest risk in this phase is not insufficient training — it is injury or illness from overextension in the final push. The fitness exists. The job of peak week 3 is to arrive at race day with that fitness intact.`,
          prompt: `Name every training decision in the next seven days that carries injury or illness risk. For each, identify whether the potential gain justifies the risk given where you are in the block. Almost none will.`,
          good: `Eliminates unnecessary risk from the final week. Protects the accumulated investment. Arrives at race day with the block's full fitness.`,
          med: `Continues to train as if fitness is still being built. Takes avoidable risks. The accumulated investment is partially lost before race day.`,
        },
        thu: {
          title: `Life has changed since block start`,
          mech: `The training plan designed at the start of this block was built around the life that existed then. Four-plus weeks later, at least some of these may have changed. Training built on outdated life constraints produces chronic friction. Race week is not the time for chronic friction.`,
          prompt: `What has changed in your life since block start that could affect race week? Work schedule, family commitments, travel, sleep environment. Name each and identify whether your race week plan accounts for it.`,
          good: `Race week plan reflects the current life, not the life at block start. No unpleasant surprises.`,
          med: `Race week plan was designed at block start and has not been updated. Encounters logistical friction in race week that was foreseeable.`,
        },
        sun: {
          title: `Block complete: what the season produced`,
          mech: `Multiple blocks of consistent training produces an athlete who is qualitatively different — not just fitter, but more intelligent about their own physiology, more deliberate in session design, and more capable of performing under pressure. The question at the end of any peak phase is: can you articulate what changed?`,
          prompt: `Name three ways you train differently now than you did at the start of your first block — not harder or longer, but differently. Different session design, different recovery practice, different zone calibration, different technique focus. Those three differences are the evidence of athletic development, as distinct from fitness improvement.`,
          good: `Can name three specific behavioural or methodological changes. The development is real and articulable.`,
          med: `Trains harder and longer. Cannot name specific methodological changes. Fitness has improved; athletic intelligence less so.`,
        },
      }, // end integration

    }, // end mid

    // ─── Late ─────────────────────────────────────────────────────────
    // Late — final week. Emphasis: durability. Consolidating before transition.

    late: {

      foundations: {
        tue: {
          title: `Race week: the floor that survives anything`,
          mech: `Race week is the week where the floor concept matters most. The floor is not a training minimum — it is a race-preparation minimum. Everything on the race week plan exists to protect the race-morning state, not to add fitness.`,
          prompt: `Review your race week plan. What is the non-negotiable minimum — the session or sessions that maintain sharpness without adding fatigue? Everything above that minimum is optional. Evaluate each optional session against the question: does this improve my race-morning state or risk it?`,
          good: `Has a clear race week floor that is deliberately below normal training load. Every session above the floor has been evaluated and either kept or cut.`,
          med: `Has a race week plan that feels like a training week with reduced volume. Has not evaluated individual sessions against the race-morning filter.`,
        },
        thu: {
          title: `The athlete you are at peak week 4`,
          mech: `Multiple blocks of consistent training produces an athlete who is qualitatively different from the one who started. The physiological changes are real and measurable. The behavioural changes are often more important — how you make training decisions, how you manage fatigue, how you execute under pressure.`,
          prompt: `Name three ways you make better training decisions now than you did at the start of your first block. Not 'I am fitter' — specific decision improvements. Better zone calibration, better recovery management, better session prioritisation. Those three decision improvements are the season's most durable output.`,
          good: `Can name three specific decision improvements with evidence. The season produced athletic intelligence, not just fitness.`,
          med: `Trains harder and longer. Cannot name specific decision improvements. The season produced fitness but not intelligence.`,
        },
        sun: {
          title: `What the next block begins with`,
          mech: `The first decision of the next block is made at the end of this one. Athletes who complete a thorough debrief begin the next block with accurate information and clear priorities. Athletes who move straight to the next training plan repeat the same patterns with slightly more fitness.`,
          prompt: `Three final questions. One: what is the single most important thing this block produced that you want to protect going forward? Two: what is the single most important thing this block failed to resolve? Three: what is the one training behaviour that produced the most consistent positive results? Those three answers are your next block's north star.`,
          good: `Answers all three specifically, with evidence. Next block begins with a clear mandate.`,
          med: `Moves to next block planning without completing the debrief. The next block starts with more fitness but without the intelligence to use it optimally.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Technique in peak week 4: execute what you have`,
          mech: `Peak week 4 is race week or immediately pre-race. Technical changes introduced now will not consolidate. The only job is to execute the technique changes that did consolidate this block — automatically, at race intensity, without thinking about them.`,
          prompt: `Name the one technique change from this block that is most consolidated — that you can execute automatically at race intensity without thinking about it. That is your race-day technical identity. Everything else is secondary.`,
          good: `Arrives at race day with one fully automated technique improvement. Executes it automatically in all three disciplines.`,
          med: `Continues trying to consciously apply multiple technique changes under race conditions. Movement quality is inconsistent.`,
        },
        thu: {
          title: `Final race prep: nothing new`,
          mech: `The single most common race-week error at all levels is introducing something new in the belief that it might produce marginal improvement. It does not. The marginal gains available from last-minute innovation are negative.`,
          prompt: `Is there anything in your race-week preparation that has not been tested in training at race intensity? If yes, remove it. The risk-adjusted value of any untested intervention in race week is negative.`,
          good: `Race week is 100% proven protocol. Nothing untested. Execution is precise and familiar.`,
          med: `Introduces one or two small new elements 'just to optimise'. Each carries unrealised risk.`,
        },
        sun: {
          title: `The season-end technical audit`,
          mech: `An honest technical audit at the end of the peak phase serves two purposes: it confirms what is consolidated and race-ready, and it identifies what the next block's technique work should prioritise.`,
          prompt: `Rate your technique in each discipline on a 1–10 scale. Where are the gaps between your best-day technique and your race-day technique? Those gaps are the next block's technical starting points.`,
          good: `Produces a specific per-discipline technique rating with evidence. The gap is identified and becomes the next block's target.`,
          med: `Has a general sense of technique level. Cannot specify the gap.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `The last hard session of the block`,
          mech: `The final quality session of a training block should be executed with intention — not maximally, but precisely. Its purpose is to confirm race readiness, not build fitness. The session should feel controlled, sharp, and familiar.`,
          prompt: `What is your final quality session this block, and what does success look like? Not a time or power target — an execution description. Controlled effort in the first third. Race-pace precision in the middle. Form held in the final third.`,
          good: `Executes the final quality session to a specific execution description. Arrives at race day with a confirmed readiness signal.`,
          med: `Treats the final quality session as a fitness test. Goes hard. Carries residual fatigue into race week.`,
        },
        thu: {
          title: `Durability across the block: the honest measure`,
          mech: `The durability developed across a full training block does not disappear in a taper week. It is the accumulated structural resilience of the connective tissue, the deep aerobic base of the cardiac system, and the neuromuscular economy of practised movement patterns. It is what the block was building.`,
          prompt: `Compare your long-session durability now to the start of the base phase: how many more minutes can you sustain race-pace quality before performance degrades? That number is the block's most honest performance metric.`,
          good: `Can quantify the durability improvement specifically.`,
          med: `Feels more durable in a general sense. Cannot quantify the improvement.`,
        },
        sun: {
          title: `Block complete: the debrief`,
          mech: `The quality of the next block's first week is determined by the quality of this block's final debrief. Athletes who complete a specific, honest, evidence-based debrief begin the next block with a clear platform and clear targets.`,
          prompt: `Three questions. One: what is the single most important thing this block produced that you want to protect? Two: what is the single most important thing this block failed to resolve? Three: what is the one training behaviour that produced the most consistent positive results? Those three answers are your next block's north star.`,
          good: `Answers all three specifically. Next block begins with a clear mandate.`,
          med: `Moves to next block planning without the debrief. The next block starts with more fitness but without the intelligence to use it optimally.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Race prep intensity: the final sharpening`,
          mech: `The final quality session before race week should be a sharpening session — brief, at race pace, with full recovery. Its purpose is to confirm the race-pace feel is familiar, not to add fitness. If it feels hard, the taper has not done its job.`,
          prompt: `What is your final quality session, and what does success look like? Not a power target or pace target — a description of how the effort should feel. Controlled. Familiar. Not maximal. If it feels maximal, back off.`,
          good: `Final quality session feels controlled and familiar. Arrives at race morning with a positive sharpness signal.`,
          med: `Final quality session is used as a fitness test. Goes hard. Carries residual fatigue into race week.`,
        },
        thu: {
          title: `Recovery week: no new intensity`,
          mech: `The recovery window before race day is finite. Every quality session in that window delays the supercompensation it is designed to produce. The fitness is not going anywhere. The job is to let the adaptation express itself.`,
          prompt: `Is there any session this week you are planning that includes sustained effort above Zone 2? If yes, ask: what specific adaptation does this session produce that cannot be produced after the race, on fresher legs? If you cannot answer that question with specificity, the session should not happen.`,
          good: `Holds race week to genuinely easy movement. Arrives at race morning feeling sharp and slightly under-trained — the correct feeling.`,
          med: `Adds one 'light intensity' session. Feels productive. Arrives 10% less recovered than they would have been.`,
        },
        sun: {
          title: `Peak phase complete: the intensity audit`,
          mech: `The purpose of peak phase intensity work was to sharpen race-specific output. The question now is whether it worked — whether race pace feels controlled, familiar, and sustainable.`,
          prompt: `In your final race-pace sessions this block: did race pace feel controlled, familiar, and sustainable for the target duration? Or did it still feel like a push? The answer tells you whether the peak phase achieved its sharpening goal.`,
          good: `Race pace feels controlled and familiar. The peak phase sharpened what the build phase built.`,
          med: `Race pace still feels like a push. The peak phase did not complete the sharpening.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `You have already done the work — race day is expression`,
          mech: `Nothing you do in race week changes your fitness. The aerobic base, the threshold work, the brick sessions, the nutrition rehearsals — those are locked in. Race week is about expressing what you built, not adding to it. The only variables left are execution: pacing discipline, nutrition timing, and the decision not to respond to what other athletes do in the first kilometre.`,
          prompt: `Name your three execution anchors for race day. Not goals — anchors. The pace you hold through the first 10 minutes of the run regardless of how you feel. The nutrition timing you do not deviate from regardless of GI signals in the first half. The bike effort ceiling you do not exceed regardless of the athlete next to you. Three anchors. Everything else is noise.`,
          good: `Knows their three anchors before leaving for transition. Executes the race they trained for, not the race they feel like running in kilometre one.`,
          med: `Arrives at the start line pumped. Goes out hard because they feel good. Pays for it in kilometre 8 of the run. Every time.`,
        },
        thu: {
          title: `Race craft compounds across blocks`,
          mech: `Race intelligence — the quality of decisions made under race conditions — develops across blocks. Each race is a data collection event. The athletes who improve most dramatically are not those who train hardest — they are those who carry the most specific lessons from each race into the next block.`,
          prompt: `Name the three most expensive race-craft errors from your last race — specific decisions that cost time or energy. Now name the specific training rehearsal you completed for each correction. If you cannot name the rehearsal, the error has not been corrected — only understood.`,
          good: `Has rehearsed corrected decisions in training for each of the three errors. Race day implements corrections that have been tested.`,
          med: `Understands what went wrong. Has not rehearsed the corrections. Makes similar decisions under race-day conditions.`,
        },
        sun: {
          title: `What the race will reveal`,
          mech: `The purpose of the race is not just to produce a result — it is to reveal the next layer of performance limiters. Every race result, well-executed or not, contains information about what the next block needs to develop.`,
          prompt: `Before the race: name three questions you want the race to answer. Not 'will I go faster?' — specific questions. Does my pacing strategy hold in the second half? Does the nutrition protocol work under race-day gut stress? Does my run form hold past kilometre 15?`,
          good: `Arrives at race day with three specific questions to answer. The debrief is structured around the answers. Next-block planning is evidence-based.`,
          med: `Arrives focused on the finish time. The race produces a result but not specific performance intelligence.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Race week logistics are race preparation`,
          mech: `Cognitive load on race morning is the enemy of performance. Every decision made on race morning is made under cortisol and sleep disruption. Every decision made in the preceding week is made calmly and rationally. The cognitive budget for race morning should be as close to zero as possible.`,
          prompt: `List every race-morning decision that you have not yet made. Gear checklist, nutrition protocol, transition setup, warm-up routine, drive time to venue, wetsuit decision criteria. Each unresolved decision is a cognitive tax on race morning. Resolve them this week.`,
          good: `Completes a race-morning decision inventory. Everything is resolved before race morning. Race morning is execution only.`,
          med: `Handles race-morning decisions on race morning. Makes several suboptimal choices under pressure.`,
        },
        thu: {
          title: `Two seasons of data: use it`,
          mech: `An athlete who has completed a full block with consistent reflection logging has a dataset that most coaches would consider invaluable. Readiness patterns, grey zone trends, vulnerable session identification, recovery time profiles — all captured and most of it unused analytically.`,
          prompt: `Review your readiness scores across this block. At what points did they consistently drop most significantly? Before which specific sessions? After which specific weeks? Three patterns from the data should directly inform how the next block is structured.`,
          good: `Identifies two or three readiness patterns and applies them to next-block planning. Key sessions will hit at peak readiness.`,
          med: `Has the data but does not analyse it. Plans the next block generically.`,
        },
        sun: {
          title: `The season-long integration: what has held together?`,
          mech: `Training consistency — the percentage of planned sessions completed — is the primary driver of performance improvement across blocks. Not session quality, not training load, not programme sophistication. The athletes who make the most consistent long-term progress have the highest session completion over the longest period.`,
          prompt: `Across this block: what has held together consistently — discipline, habit, recovery practice, or session type — regardless of what life threw at it? And what has been the most fragile? The consistent element is your training identity. The fragile element is the next block's structural problem to solve.`,
          good: `Identifies the consistent core and the fragile periphery. The next block is designed to protect the core and structurally reinforce the periphery.`,
          med: `Has not tracked session completion with enough granularity to answer. Designs the next block without this information.`,
        },
      }, // end integration

    }, // end late

  }, // end peak

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOVERY PHASE — PRO TIER (single position: only)
  // ═══════════════════════════════════════════════════════════════════════════

  recovery: {

    // ─── Only ─────────────────────────────────────────────────────────
    // Only — single-week phase. Emphasis: durability.

    only: {

      foundations: {
        tue: {
          title: `The recovery week floor`,
          mech: `The minimum viable week during recovery is not about training — it is about maintaining the physiological and psychological conditions for supercompensation. Easy movement, sleep, food, and one deliberate reflection session. Athletes who try to maintain a training floor during recovery week are preventing the adaptation the previous block produced.`,
          prompt: `Name your recovery week floor: what movement, sleep, and nutrition inputs will you protect this week? Compare them to your training block floor. Notice how different they are. Both are correct — they serve different purposes at different points in the cycle.`,
          good: `Has a clear recovery week floor that is categorically different from the training floor. Both are protected with equal intention.`,
          med: `Applies the training block floor to the recovery week. Under-recovers. The next block starts carrying residual load.`,
        },
        thu: {
          title: `What the block actually built`,
          mech: `The recovery week is the first opportunity to see clearly what the previous block produced — without the noise of accumulated fatigue. Resting heart rate drops, motivation returns, movement feels effortless. These are not signs of detraining; they are the supercompensation the block was building. The recovery week reveals the adaptation.`,
          prompt: `Compare your resting heart rate, sleep quality, and subjective energy on day 3 of recovery week to the same metrics in block week 3. The difference is the adaptation. Can you quantify it? If the numbers have not changed by day 3, the recovery week started too early or the previous block produced insufficient stimulus.`,
          good: `Uses recovery week metrics to quantify the block's adaptation. Enters the next block knowing specifically what was built.`,
          med: `Views recovery week as passive rest. Does not measure anything. Enters the next block without knowing what the previous one produced.`,
        },
        sun: {
          title: `Block debrief: three questions before the next cycle`,
          mech: `The final day of a recovery week is the best time for a block debrief — the emotional charge of the final hard sessions has cleared, the body is recovered, and the perspective needed for honest analysis is available. Athletes who skip this debrief enter the next block repeating patterns they could have diagnosed.`,
          prompt: `Three questions. One: what is the single most important thing this block produced that you want to protect in the next one? Two: what is the single most important thing this block failed to resolve? Three: what is the one training behaviour — not session type, behaviour — that produced the most consistent positive results? Those three answers are the next block's north star.`,
          good: `Answers all three specifically, with evidence. Next block begins with a clear mandate rather than a blank programme.`,
          med: `Moves to next block planning without completing the debrief. The next block starts with more fitness but without the intelligence to use it optimally.`,
        },
      }, // end foundations

      technique: {
        tue: {
          title: `Technique in recovery week: observe, don't coach`,
          mech: `The recovery week is not a technique-training week — it is a technique-observation week. Easy movement at low intensity provides a rare opportunity to observe movement patterns without the noise of fatigue. What you see in genuinely easy movement is your default motor pattern — the baseline that training has either improved or left unchanged.`,
          prompt: `In your easy movement this week — a gentle swim, a slow run, a casual ride — observe your technique without trying to correct it. What does your default movement pattern actually look like? How does it differ from your best technique under fatigue? That gap is the next block's technique starting point.`,
          good: `Uses recovery week movement as observation, not training. Arrives at the next block's base week with a specific technique baseline to improve from.`,
          med: `Continues applying technique cues even in recovery week. Never observes the default pattern. Never knows what the baseline actually is.`,
        },
        thu: {
          title: `The technique ceiling is higher than you think`,
          mech: `Most intermediate athletes plateau in technique because they stop pursuing improvement after achieving functional competence. The recovery week is the time to honestly assess where functional competence ends and genuine efficiency begins — and to set a specific technique target for the next block.`,
          prompt: `In each of the three disciplines: what would genuinely excellent technique look like, in specific observable terms? Not 'smoother' — what specific movement characteristics distinguish your current technique from elite technique? Name one for each. Those three characteristics are the next block's technique targets.`,
          good: `Identifies three specific technique targets — one per discipline — before the next block begins. The block has direction from day one.`,
          med: `Begins the next block without specific technique targets. Technique work is reactive rather than directed.`,
        },
        sun: {
          title: `Video analysis: the session you never do`,
          mech: `Proprioceptive feedback during swimming, cycling, and running is unreliable — what athletes feel they are doing and what they are actually doing are frequently different. Video analysis resolves this gap with a single session. The value of one hour of video analysis typically exceeds weeks of technique-focused training done without accurate feedback.`,
          prompt: `When did you last see yourself swim, run, or ride on video? If the answer is more than three months ago for any discipline, you are training based on perceived movement rather than actual movement. Schedule one video session per discipline before the next build phase begins.`,
          good: `Completes one video analysis session per discipline during the recovery week. Identifies one specific movement correction per discipline based on what they actually see.`,
          med: `Trains based on proprioceptive feedback. Continues patterns that feel correct but may be technically inefficient.`,
        },
      }, // end technique

      durability: {
        tue: {
          title: `Unstructured movement is not wasted time`,
          mech: `Complete rest after a season-peak race produces psychological flatness and mild detraining within 10–14 days. Unstructured movement — walking, easy swimming, casual cycling — maintains baseline physiological function, supports active recovery, and preserves the psychological relationship with exercise without adding training load.`,
          prompt: `What does your movement this week look like — not training, movement? If the answer is nothing at all, that is probably too little for an athlete at your training age. If it is structured sessions, that is too much. The target is 30–60 minutes of genuinely easy movement per day, no targets, no data.`,
          good: `Moves daily without structure or targets. CNS recovers. Motivation for training returns naturally within two weeks.`,
          med: `Either does nothing for two weeks (psychologically difficult, mild detraining) or returns to structured training immediately (extends the suppression).`,
        },
        thu: {
          title: `The physio appointment you have been postponing`,
          mech: `Most triathletes carry a structural issue through a training block — a recurring tightness, a nagging joint, a compensatory movement pattern — that they manage rather than resolve because addressing it would require reducing training load. The recovery week is the window to address these issues fully, without the training-load constraint.`,
          prompt: `Name the physical issue you managed through this block rather than resolved. Book the appointment this week — physio, sports medicine, massage. The issue does not resolve itself during recovery. It just gets a rest before returning when load increases.`,
          good: `Books and attends the relevant appointment in the recovery week. Starts the next block with the structural issue resolved.`,
          med: `Plans to address it before the next block starts. Starts the next block with the same issue managed rather than resolved.`,
        },
        sun: {
          title: `Rest is a skill`,
          mech: `Highly motivated endurance athletes are generally poor at resting. The same psychological characteristics that produce training consistency — discipline, goal orientation, discomfort tolerance — also produce guilt during rest, anxiety during reduced load, and a tendency to equate productivity with training. Rest is a skill because it has to be actively practised against these tendencies.`,
          prompt: `Rate your ability to rest without guilt or anxiety on a 1–10 scale. If below 7, rest is currently working against you rather than for you. What specifically produces the discomfort — fear of detraining, identity, loss of structure? Naming it makes it more manageable.`,
          good: `Rests deliberately and without guilt. Returns to training physiologically and psychologically refreshed. The next block starts from a genuine baseline.`,
          med: `Rests with chronic low-level anxiety about detraining. Returns to training too early. The next block starts from an incomplete recovery.`,
        },
      }, // end durability

      intensity: {
        tue: {
          title: `Recovery week: no intensity, no exceptions`,
          mech: `Every quality session in a recovery week delays the supercompensation it is designed to produce. The principle is not 'less intensity' — it is 'no intensity above Zone 2'. The fitness is not going anywhere. The adaptation window is finite. Athletes who compromise the recovery week are borrowing from next block's fitness to pay for this week's need to feel productive.`,
          prompt: `Is there any session this week that includes sustained effort above Zone 2? If yes, ask: what specific adaptation does this session produce that cannot be produced in the next block's week 1, on genuinely recovered legs? If you cannot answer that question specifically, the intensity does not happen.`,
          good: `Holds the full recovery week to Zone 2 and below. No exceptions. The next block's week 1 feels sharp and powerful — the signal that recovery worked.`,
          med: `Includes one 'just to stay sharp' quality session. Feels better psychologically. Arrives at the next block's week 1 carrying 10% more residual fatigue than necessary.`,
        },
        thu: {
          title: `What the block's intensity told you`,
          mech: `A full training block reveals an athlete's actual intensity tolerance — how quickly they recover from hard sessions, how their Zone 2 pace responds under cumulative fatigue, and where grey zone most often appears. This information is specific to this athlete at this fitness level. It should directly inform how the next block is loaded.`,
          prompt: `Looking back at this block: on which days did intensity accumulate unexpectedly? After which sessions did recovery take longer than anticipated? That pattern is your personal intensity tolerance profile — the most useful input for planning the next block's loading.`,
          good: `Identifies the specific sessions and days where intensity accumulated beyond plan. Adjusts next block structure accordingly.`,
          med: `Has a general sense of how the block went. Plans the next block from a template rather than personal data.`,
        },
        sun: {
          title: `The intensity audit at block end`,
          mech: `Most intermediate athletes significantly overestimate how much of their training is genuinely hard and underestimate how much is grey zone. At the end of a block, the honest question is: what percentage of intended Zone 2 sessions was actually grey zone? That percentage is the first thing to address in the next block.`,
          prompt: `Across this block: how many of your designated easy sessions drifted above Zone 2? Estimate a percentage. If above 30%, the next block's base work needs a structural fix — not more willpower, a structural change to how easy sessions are set up. What is that change?`,
          good: `Identifies the grey zone drift and makes one structural change that addresses it for the next block.`,
          med: `Acknowledges the grey zone drift as a tendency. Plans to try harder to hold Zone 2. The drift continues.`,
        },
      }, // end intensity

      racecraft: {
        tue: {
          title: `Race craft in recovery week: review, don't rehearse`,
          mech: `The recovery week is not a race craft rehearsal week — it is a race craft review week. The decisions you made in the last race or race simulation are still fresh. The cognitive capacity you have during recovery week — unclouded by training fatigue — is the best available for honest analysis. Use it.`,
          prompt: `Review the last race or race-intensity session: name one race-craft decision you got right and one that cost you time or energy. Not in general — specifically, with a timestamp or segment. Those two answers are the most important race craft data points you currently have. What is the training rehearsal that addresses the wrong decision?`,
          good: `Completes a specific race craft review in recovery week. The next block's race craft rehearsal is directed at a specific known error.`,
          med: `Does not review race craft in recovery week. The next block begins without specific race craft targets. The same errors repeat.`,
        },
        thu: {
          title: `Patience is the next block's most important skill`,
          mech: `The next base phase is the time to rebuild the aerobic foundation — not accelerate it. Athletes who use the higher fitness baseline from the previous block to train at higher intensity in base phase compromise the aerobic adaptations that the base phase is specifically designed to produce.`,
          prompt: `Are you planning to make the next base phase harder than the previous one because you feel fitter? That is the patience problem. Feeling fitter and training easier in base phase simultaneously is correct. The ceiling rises precisely because you protect the foundation.`,
          good: `Holds the next base phase at genuine Zone 2 despite higher fitness. The aerobic ceiling rises further. The next build phase has a better foundation.`,
          med: `Trains harder in base because they feel fitter. Grey zone re-enters the base phase. The next build phase builds on a compromised foundation.`,
        },
        sun: {
          title: `The next block's race target: specific ambition`,
          mech: `Race targets should be specific. Not 'faster than last time' — a specific segment improvement, a specific pacing execution, a specific process goal. Specificity makes targets trainable and debriefs accurate. Vague ambition produces vague results.`,
          prompt: `Name your next race target in three specific components: a finish time or segment time target, a pacing execution target (specific numbers for each segment), and a process target (something you will do differently from last race regardless of outcome). If you only have the first, the plan is incomplete.`,
          good: `Has all three components written, specific, and carried into the next block as training targets.`,
          med: `Has a finish time goal and a general intention to race smarter. The specifics are undefined. Execution on race day defaults to intuition.`,
        },
      }, // end racecraft

      integration: {
        tue: {
          title: `Recovery week integration: the full-life audit`,
          mech: `The recovery week is the best time to assess training-life integration — when training load is low, the friction points in the life-training interface become visible without the noise of daily training stress. What felt manageable during the block often reveals itself as a structural friction in recovery week. Resolving it before the next block is far easier than managing it during one.`,
          prompt: `What was the single greatest source of friction between training and life this block? Not a one-off event — a structural pattern. Which session type was most vulnerable? Which life demand most often collided with training? Name it, and name one structural change that would reduce that friction in the next block.`,
          good: `Identifies the structural friction point and makes one concrete change before the next block starts. Training consistency in the next block improves.`,
          med: `Identifies the friction but attributes it to a busy period. The structural cause is unaddressed. The same friction reappears in the same place in the next block.`,
        },
        thu: {
          title: `The equipment audit`,
          mech: `Equipment contributes to performance in measurable ways — not because new equipment makes athletes faster, but because equipment that does not fit, does not work reliably, or creates physical discomfort produces avoidable performance loss and injury risk. The recovery week is the time to address equipment issues that were managed through the block.`,
          prompt: `Name every piece of equipment that produced friction, discomfort, or unreliability this block. Bike fit, wetsuit fit, run shoe wear, nutrition flask access. Each is a manageable variable. Which one, if resolved, would produce the largest performance return in the next block?`,
          good: `Addresses the highest-return equipment issue during the recovery week. No repeating avoidable equipment problems.`,
          med: `Manages the same equipment issues through another block. The friction is familiar but no less costly.`,
        },
        sun: {
          title: `The next block's floor`,
          mech: `The minimum viable week for the next block should reflect everything learned in the previous one — which sessions are highest leverage, which are skippable, which recovery habits are non-negotiable. A more informed floor is a more effective floor.`,
          prompt: `Define your next block's floor: the sessions you will protect unconditionally. Compare it to your very first floor. Is it better informed? More specific? More realistic about what life allows? If it looks identical to your first floor, you have not used the block's data.`,
          good: `Next block floor is more specific, more defensible, and more aligned with what actually produces adaptation for this athlete.`,
          med: `Next block floor is copied from the previous one. The same sessions get sacrificed in the same circumstances.`,
        },
      }, // end integration

    }, // end only

  }, // end recovery

}; // end CARD_CONTENT
