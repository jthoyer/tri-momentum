/**
 * TRI Momentum — Race-Proximity Content
 * frontend/src/data/raceProximity.js
 *
 * Activated by resolveProximityZone() in tipResolver.js.
 * Lives entirely separate from the block-relative CARD_CONTENT schema.
 * Zero changes to tips.js required.
 *
 * Zone key map:
 *   awareness  — 15–21 days out  → supplements the block tip
 *   taper      — 8–14 days out   → equal weight with block tip
 *   raceweek   — 2–7 days out    → replaces block tip (keyed by days_to_race integer)
 *   raceday    — race morning    → replaces block tip
 *   post       — 1–7 days post   → replaces block tip (keyed by days_since_race integer)
 *
 * Authoring voice: same as tips.js — mechanism first, no hand-holding,
 * sharp/mediocre contrast, specificity over generality.
 *
 * 23 cards total across all zones.
 */

export const RACE_PROXIMITY_CONTENT = {

  // ─── Zone 1: Awareness — 15–21 days out ────────────────────────────────────
  // Supplement the block tip. Three cards (tue/thu/sun).
  // Intent: nutrition rehearsal, equipment/logistics, goal-setting and pace strategy.

  awareness: {

    tue: {
      title: "Rehearse the nutrition protocol now, not race week",
      mech: "Gut tolerance for carbohydrates at race intensity is trainable — but only if you train it under race conditions. Fifteen days out is the last window to run a full nutrition rehearsal at race intensity and have time to adjust the protocol if something goes wrong. One failed rehearsal race week is unrecoverable. One failed rehearsal today is information.",
      prompt: "In your next long brick or race-pace session: execute the exact nutrition protocol you plan to use on race day. Same products, same timing, same volumes. What happened? Any gut response — positive or negative — is data you need to have now, not on race morning.",
      good: "Runs at least one full nutrition rehearsal at race intensity 15–21 days out. Arrives at race day with a protocol that has been tested under race-specific conditions.",
      med: "Plans to test nutrition 'closer to the race'. Runs the first full-protocol rehearsal in race week. Discovers an issue with no time to fix it.",
    },

    thu: {
      title: "The equipment audit: 15 days out is the last practical window",
      mech: "Equipment issues discovered in race week cannot be resolved before race day. Equipment issues discovered 15 days out can. Bike fit friction, wetsuit entry difficulty, nutrition flask access under fatigue, helmet buckle under stress — all of these are solvable now and unsolvable on race morning. The audit takes 20 minutes.",
      prompt: "Run through every piece of race-day equipment — not a checklist, an active test. Put the wetsuit on. Rack and unrack the bike. Execute a T1 sequence with everything in place. Note every friction point. Each friction point resolved now is one fewer decision on race morning.",
      good: "Runs a full equipment test 15 days out. Resolves every friction point before race week. Race morning is pure execution.",
      med: "Assumes equipment is fine because it worked in training. Discovers a specific friction point in T2 on race day. Loses time and composure.",
    },

    sun: {
      title: "Set your pace targets now, not in the swim",
      mech: "Pace decisions made in the first 400 metres of a race — when blood lactate is spiking, breathing is disrupted, and adrenaline is overriding rational calculation — are systematically too aggressive. The only countermeasure is having pace targets set so specifically in advance that they require no in-race calculation: a single number for each segment, non-negotiable.",
      prompt: "Name your target watts or pace for: the first 20 minutes of the bike, the last 30 minutes of the bike, and the first 3km of the run. If you cannot name all three as specific numbers right now, you do not yet have a race plan — you have a race intention. Intentions are overridden by adrenaline. Numbers are not.",
      good: "Has three specific numbers written and mentally rehearsed. Race day executes the numbers, not the feeling.",
      med: "Plans to 'go by feel' or 'assess on the day'. Makes aggressive early decisions under adrenaline. Pays for them at kilometre 12 of the run.",
    },

  }, // end awareness

  // ─── Zone 2: Taper — 8–14 days out ────────────────────────────────────────
  // Equal weight with block tip. Three cards (tue/thu/sun).
  // Intent: taper mechanics and anxiety, last quality sessions, nothing new rule.

  taper: {

    tue: {
      title: "Feeling flat is the adaptation working",
      mech: "Taper anxiety is physiologically predictable. As training volume drops, plasma volume temporarily decreases, legs feel heavy, and the absence of training stress is misread by the nervous system as detraining. None of this is happening. The aerobic system is not degrading — it is consolidating the work of the last ten to twelve weeks into a state it can express on race day. The flat feeling is not a warning. It is the process.",
      prompt: "Is there anything you are tempted to add to this week's training because you feel undertrained? Name it. Then ask: would adding it improve your race, or would it make you feel better about your preparation? Those are different things. One costs you energy you need on race day. The other is free.",
      good: "Trusts the taper. Sleeps more. The flatness is understood as a signal, not a problem. Race day feels sharp.",
      med: "Adds a 'just to stay sharp' session mid-taper. Feels productive. Arrives at race day carrying residual fatigue. Attributes the performance to under-tapering.",
    },

    thu: {
      title: "The last quality session before race day: execute, don't test",
      mech: "The final quality session before race day should be a sharpening session — short, at race pace, with full recovery planned before the race. Its purpose is to confirm the race-pace feel is familiar, not to build fitness or test limits. If it feels hard, the taper has not done its job. If it feels controlled and sharp, the taper has.",
      prompt: "What is your final quality session before race day, and what does success look like? Not a power target or a pace target — a description of how the effort should feel. Controlled. Familiar. Not maximal. If it feels maximal, back off. The race needs that energy.",
      good: "Final quality session feels controlled and familiar. Arrives at race morning with a positive sharpness signal rather than a fitness signal.",
      med: "Uses the final quality session as a fitness test. Goes hard because anxiety demands it. Carries residual fatigue into race week.",
    },

    sun: {
      title: "Nothing new in the final 14 days: an absolute rule",
      mech: "Every untested variable introduced in the final 14 days carries only downside risk. The upside of any new gel, new equipment, new session, or new supplement is marginal at best. The downside — GI distress, equipment failure, unfamiliar fatigue, altered recovery — is race-ending at worst. The risk-adjusted value of any untested intervention in the final two weeks is negative. This is not a guideline. It is a rule.",
      prompt: "Name every element of your race-week plan — nutrition, equipment, sessions, supplements, logistics — and mark each as 'tested in training at race intensity' or 'not tested'. Every 'not tested' item is a risk you are choosing to carry. Eliminate them.",
      good: "Every race-week element is tested and familiar. Race morning is pure execution. No surprises.",
      med: "Introduces one or two small new elements 'just to optimise'. At least one produces an unexpected outcome. The race is managed rather than executed.",
    },

  }, // end taper

  // ─── Zone 3: Race week — 2–7 days out ──────────────────────────────────────
  // Replaces block tip entirely. Keyed by days_to_race integer (2–7).
  // Intent: daily countdown, each day has a specific preparation focus.

  raceweek: {

    7: {
      title: "Seven days out: carbohydrate loading begins today",
      mech: "Glycogen loading is a process that takes 48–72 hours, not a meal. The carbohydrate you eat starting today — not the pasta dinner the night before — is what fills your muscle glycogen stores to capacity. The night-before meal matters for gut comfort and blood glucose stability, not glycogen. Athletes who 'carb load' only at the Saturday dinner and race Sunday morning have done nothing for their glycogen stores.",
      prompt: "Starting today: meaningfully elevate your carbohydrate intake for the next 72 hours. Not dramatically different food — significantly more of it. Aim for 8–10g of carbohydrate per kilogram of body weight per day across the next three days. Can you execute that today? Name what you will eat at each meal to hit that target.",
      good: "Executes a structured 72-hour carbohydrate loading protocol starting 7 days out. Arrives at race morning with full glycogen stores and no GI surprises from unfamiliar food.",
      med: "Eats a large pasta dinner the night before the race. Feels full at the start line. Glycogen stores are partially loaded at best. Attributes a weak second half to fitness.",
    },

    6: {
      title: "Six days out: kit prep and checklist",
      mech: "Every decision made on race morning is made under cortisol and sleep disruption. Every decision made today is made calmly and rationally. The cognitive budget for race morning should be as close to zero as possible. Kit preparation is not a logistics task — it is a performance preparation task. The athlete who arrives at transition having made every decision in advance has a measurable performance advantage over the one who is still making decisions.",
      prompt: "Build your complete race-day kit list today — not a mental list, a physical written list. Lay everything out. Check every item. Resolve every question: wetsuit on or off the bike? Number belt or safety pins? What is on the nutrition belt and in what order? Every unresolved question on this list is a question you will answer on race morning. Resolve them now.",
      good: "Completes full kit prep and checklist today. Every item confirmed, every question resolved. Race morning is pure execution from a pre-decided plan.",
      med: "Plans to sort kit 'the night before'. Makes several decisions on race morning under pressure. At least one is suboptimal.",
    },

    5: {
      title: "Five days out: the mental race",
      mech: "Mental rehearsal — visualising race execution in sequential detail — activates the same motor pathways as physical execution. Athletes who have mentally rehearsed a race multiple times approach the start line with a sense of familiarity that reduces anxiety, tightens decision-making, and allows faster problem-solving when unexpected conditions arise. The practice takes 20 minutes. The return is measurable.",
      prompt: "Close your eyes and run through your entire race from start to finish — from the moment you enter the water to the finish line. Where does the mental image become vague or uncertain? Those are the sections where the race plan is not fully formed. Go back to each vague section and fill it in: what specifically will you do there? Repeat until the whole race is clear.",
      good: "Can run through the entire race mentally with specific detail at each transition and decision point. Race day feels like repetition, not novelty.",
      med: "Has a general mental picture of the race. Encounters sections on race day that feel unfamiliar. Makes reactive decisions rather than executing prepared ones.",
    },

    4: {
      title: "Four days out: the shakeout session",
      mech: "A shakeout session — 20 to 30 minutes easy with three or four 20-second race-pace efforts — maintains neuromuscular sharpness without adding meaningful fatigue load. Done correctly, the legs feel more awake and the race-pace movements feel familiar. Done incorrectly — too long, too hard, or too many efforts — it adds fatigue without proportional benefit. The session has a narrow effective window.",
      prompt: "Plan your shakeout session for today or tomorrow: 20–30 minutes total, three or four 20-second efforts at race pace with full recovery between each. Note how the race-pace efforts feel. If they feel sharp, the taper worked. If they feel heavy, do not add more — the feeling is the last wave of taper fatigue, not unfitness.",
      good: "Executes a precise shakeout session. Race-pace efforts feel sharp. Arrives at race morning confirmed and calm.",
      med: "Does a 60-minute 'easy' session 'just to feel the legs'. Adds unnecessary load. Arrives at race morning with avoidable residual fatigue.",
    },

    3: {
      title: "Three days out: finalise the nutrition plan",
      mech: "A race nutrition plan written on race morning is not a plan — it is improvisation under cortisol. Race-day nutrition must be finalised by three days out: products confirmed, quantities confirmed, timing confirmed, and the contingency plan confirmed. Gut issues in triathlon are rarely unpredictable surprises. They are the result of an incompletely specified protocol meeting race-intensity gut stress.",
      prompt: "Write your complete race-day nutrition plan right now: what product you take, the exact dose, and the timing for every gel, drink, and aid station interaction. Then identify the single step most likely to fail — the gel you might drop at speed, the aid station you might miss — and decide specifically what you do if it happens. Write that down too.",
      good: "Has a written nutrition plan with a contingency for every failure point. Race-day gut management requires no in-race decisions.",
      med: "Has a rough idea of the nutrition plan. Plans to finalise it the night before. Makes at least one significant error under race-day pressure.",
    },

    2: {
      title: "Two days out: control what you can, release what you can't",
      mech: "Race-eve anxiety attaches to uncontrollable variables — weather, competitors, course conditions, sleep quality. This is physiologically counterproductive: cortisol elevation from uncontrollable-variable anxiety disrupts sleep, impairs glycogen storage, and reduces next-day performance. The only available intervention is deliberate redirection of attention toward controllable variables. This is not a mindset technique — it is a performance preparation technique.",
      prompt: "Write two lists. List one: every variable in tomorrow's race that is within your control. List two: every variable that is outside your control. Read list one. Put list two face-down. The race you can influence is only list one. Is everything on list one already prepared? If not, prepare it now.",
      good: "Focuses entirely on controllable variables from two days out. Sleep is protected. Arrives at race morning calm, rested, and with nothing outstanding.",
      med: "Spends two days out thinking about weather, competitors, and what-ifs. Sleep is disrupted. Cortisol is elevated before the gun fires.",
    },

  }, // end raceweek

  // ─── Zone 4: Race day ───────────────────────────────────────────────────────
  // Single card. Replaces block tip entirely. The morning of the race.

  raceday: {

    morning: {
      title: "You have already done the work",
      mech: "Nothing you do this morning changes your fitness. The aerobic base, the threshold work, the brick sessions, the nutrition rehearsals — those are locked in. The adaptation window closed weeks ago. This morning is about expressing what you built, not adding to it. The only variables left are execution: pacing discipline in the first third, nutrition timing, and the decision not to respond to what other athletes do in the first kilometre.",
      prompt: "Name your three execution anchors for today. Not goals — anchors. The pace you hold through the first 10 minutes of the run regardless of how you feel. The nutrition timing you do not deviate from regardless of GI signals in the first half. The bike effort ceiling you do not exceed regardless of the athlete next to you. Three anchors. Everything else is noise.",
      good: "Knows their three anchors before leaving for transition. Executes the race they trained for, not the race they feel like running in kilometre one.",
      med: "Arrives at the start line pumped and anxious. Goes out hard because they feel good. Pays for it in kilometre 8 of the run. Every time.",
    },

  }, // end raceday

  // ─── Zone 5: Post-race — 1–7 days after ────────────────────────────────────
  // Replaces block tip entirely. Keyed by days_since_race integer (1, 2, 3, 7).
  // Intent: physical recovery, emotional debrief, performance data review, next-block seeding.

  post: {

    1: {
      title: "Day 1: physical recovery is the only job",
      mech: "Race-day physiological stress — muscle damage, glycogen depletion, immune system activation, and inflammatory response — peaks in the 24 hours post-race. Every training decision on day 1 should be evaluated against a single question: does this accelerate or slow recovery? Easy walking, eating, sleeping, and hydrating accelerate it. Every other intervention — including ice baths, compressions, and supplements not already established as routine — has marginal or unpredictable effect.",
      prompt: "What are your recovery inputs today? Sleep hours, total carbohydrate intake, hydration, and movement type. Each is controllable and each has a direct effect on how quickly you recover for the next block. Name a specific target for each one. Not 'I'll eat well' — a gram target. Not 'I'll get some sleep' — an hours target.",
      good: "Treats day 1 recovery with the same specificity as a training session. Inputs are planned, not accidental. Recovery is systematic.",
      med: "Celebrates the race, eats whatever is available, sleeps irregularly. Recovery happens but more slowly than it needed to. The next block starts later.",
    },

    2: {
      title: "Day 2: the emotional debrief",
      mech: "Race performance deviates from training predictions for three reasons: pacing error, nutrition failure, or a genuine fitness gap. Only one of those requires a training intervention. Pacing error is a tactical problem — it costs nothing to fix. Nutrition failure is a protocol problem — it costs a few training races to fix. A fitness gap requires a full block to address. Conflating them produces athletes who train harder when they need to eat better, or change their protocol when they need to address their run threshold.",
      prompt: "Where did your race deviate from your training prediction, and what is the most honest single explanation? Pick one: pacing decision, nutrition timing, or fitness ceiling. One answer. The next block's priority follows from it. If you pick pacing decision but train harder, you are solving the wrong problem. If you pick nutrition failure but change your training structure, same problem.",
      good: "Produces a specific, honest diagnosis within 48 hours. The next block's priority is evidence-based rather than emotional.",
      med: "Attributes a poor result to 'bad day' or overtrains the week after to compensate for perceived fitness gaps. The diagnosis is wrong. The wrong thing is addressed. The same outcome repeats.",
    },

    3: {
      title: "Day 3: the performance data review",
      mech: "The 48-hour post-race window is the optimal time for detailed performance analysis — memory is accurate, data files are fresh, and the emotional charge of the result has not yet distorted the analysis. Athletes who wait a week to review their data are reconstructing from memory with the result already shaping what they notice. The same event, analysed at day 3, produces categorically different and more accurate conclusions than at day 10.",
      prompt: "Walk through each segment of the race and name one decision you got right and one you would change: swim start, T1, bike first half, bike second half, T2, run first 5km, run final 5km. Fourteen specific answers. Write them down. Not 'I went too hard' — 'I was at 220W in the first 20 minutes instead of 205W and paid for it at kilometre 70.' That level of specificity.",
      good: "Completes the full segment debrief within 72 hours. The analysis is accurate and unfiltered. Next-block planning begins from correct information.",
      med: "Reviews race data in week two when the result has already shaped memory. Draws conclusions that reflect the finish time rather than the execution. Plans the next block on inaccurate information.",
    },

    7: {
      title: "Day 7: what to carry into the next block",
      mech: "The best preparation for the next block is a specific, honest inventory of what the previous block and race produced — not general confidence, not vague motivation, but three specific pieces of information: what to protect, what to fix, and what the next race requires. Athletes who begin the next block with these three things make faster progress than athletes who begin with equal fitness but without this intelligence.",
      prompt: "Three questions. One: what is the single thing from this block — a training behaviour, a nutrition approach, a recovery habit — that produced the most consistent positive results and must be protected in the next block? Two: what is the single thing the race revealed that the next block must specifically address? Three: what does the next target race require that this block did not fully prepare you for? Those three answers are your next block's north star.",
      good: "Answers all three with specific evidence. Next block begins with a clear mandate, a clear priority, and a clear race-specific target. Faster progress than last cycle.",
      med: "Moves to next block planning without this inventory. Begins with more fitness but without the intelligence to direct it. Makes similar errors at the next race.",
    },

  }, // end post

}; // end RACE_PROXIMITY_CONTENT
