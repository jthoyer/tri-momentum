// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_TODAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
const SESSION_ICONS = {swim:'🏊',bike:'🚴',run:'🏃',brick:'⚡',strength:'💪',rest:'😴'};
const SESSION_LABELS = {swim:'Swim',bike:'Bike',run:'Run',brick:'Brick',strength:'Strength',rest:'Rest / easy'};
const SESSION_ABBR = {swim:'SW',bike:'BI',run:'RU',brick:'BK',strength:'ST',rest:'—'};

const PILLAR_CYCLE = [
  {p:1,label:'Foundations',cls:'p1'},
  {p:2,label:'Technique',cls:'p2'},
  {p:3,label:'Durability',cls:'p3'},
  {p:4,label:'Intensity',cls:'p4'},
  {p:5,label:'Race craft',cls:'p5'},
  {p:6,label:'Integration',cls:'p6'},
];

const PHASES_39 = [
  {label:'Base building',weeks:[1,2,3,4,5,6,7],defaultCadence:'base'},
  {label:'Build 1',weeks:[8,9,10,11,12,13,14],defaultCadence:'build'},
  {label:'Build 2',weeks:[15,16,17,18,19,20,21],defaultCadence:'build'},
  {label:'Race preparation',weeks:[22,23,24,25,26],defaultCadence:'peak'},
  {label:'Recovery',weeks:[27],defaultCadence:'taper'},
  {label:'Second cycle — base',weeks:[28,29,30,31,32,33,34],defaultCadence:'base'},
  {label:'Second cycle — build',weeks:[35,36,37,38,39],defaultCadence:'build'},
];

const CADENCE_INSIGHTS = {
  base:"Zone 2 is your foundation. If you can't hold a full conversation, you're not in Zone 2 — you're in the grey zone. Drop the pace.",
  build:"Sweetspot sessions (88–93% FTP) build threshold fitness. The danger: they feel manageable until they don't. Check your breathing in the final 5 minutes.",
  peak:"Race specificity matters more than fitness right now. Every hard session should rehearse a race decision — pacing, fueling, or transition.",
  taper:"Taper is not rest. Reduce volume by 30–40%. Keep intensity. Trust the adaptation you've already built.",
};

const CARD_CONTENT = {
  1:{tue:{title:"Your floor is not where you think it is",mech:"Most intermediate athletes confuse 'average week' with 'minimum viable week'. Without a defined floor, the first stressful work week deletes training entirely.",prompt:"What is the actual minimum training you need every week to arrive at the start line better? Name it in sessions. Write it down. Is it protected — or the first thing you sacrifice?",good:"Defines a non-negotiable floor. Misses a long ride but never misses the floor.",med:"Has an ideal week in mind. When life hits, the whole plan collapses."},
  thu:{title:"Your aerobic zone is probably not Zone 2",mech:"Heart rate zones from max HR formulas can be off by 15–20 BPM for trained athletes. If your Zone 2 ceiling is too high, you accumulate fatigue debt without the aerobic base adaptation.",prompt:"In tomorrow's easy session: can you hold a full conversation — genuinely comfortable, not just technically possible? If the answer is 'mostly', drop 10 BPM and observe how Monday feels.",good:"Accepts the humbling pace. Builds real aerobic base. Faster by month three.",med:"Defends the higher HR. Continues 'comfortable hard' as 'easy'. Wonders why they plateau."},
  sun:{title:"The consistency audit",mech:"One week reveals your behavioural patterns. Which session was first to be shortened or skipped when pressure arrived?",prompt:"Which session was the first to be dropped when pressure hit? That session is your early-warning indicator for every hard week ahead. Is it actually skippable?",good:"Identifies the vulnerable session and protects it by scheduling it earlier.",med:"Frames the missed session as a one-off. The pattern repeats in week three."}},
  2:{tue:{title:"Fitness is not fixing your swim",mech:"For most adult-learned swimmers, drag — not power — is the primary limiter. Adding swim volume to a high-drag stroke produces a fitter athlete who is still slow.",prompt:"If you held your current fitness but reduced frontal drag by 15% — keeping your head still, hips higher — how much time would you gain versus adding 2km/week? Which investment would you choose?",good:"Spends two weeks on catch drills and head position. Swims faster at the same heart rate.",med:"Adds another early morning session. Gets fitter. Doesn't get faster."},
  thu:{title:"Cadence before power on the bike",mech:"Pushing big gears at low cadence (under 80 RPM) recruits fast-twitch muscle fibre — the exact resource you need to save for the run.",prompt:"In your ride this weekend, spend the first 30 minutes at a cadence 5 RPM higher than your default. Notice how your legs feel at the 90-minute mark. What does that tell you about T2?",good:"Accepts the initial power drop. Adapts cadence. Arrives at T2 with functional legs.",med:"Finds high cadence 'spinny'. Returns to 75 RPM. Shuffles the first 3km of every run."},
  sun:{title:"The efficiency question",mech:"Efficiency gains are invisible in training logs — but they compound. A 5% reduction in energy cost per stroke produces a meaningfully different athlete by race day.",prompt:"Name one technical change you made this week. Did you feel a difference, or just think about it? There's a gap between knowing a correction and executing it under fatigue.",good:"Tests one movement change under increasing fatigue across three sessions.",med:"Makes a mental note. Returns to default the moment intensity increases."}},
  3:{tue:{title:"Volume without specificity is just mileage",mech:"Aerobic durability is the capacity to sustain race-pace effort in the final 20% of race duration. Easy long sessions alone do not produce this.",prompt:"In your last long ride: what happened in the final 30 minutes? Was that a conscious pacing decision, or were you genuinely running out of capacity? Different problems, different solutions.",good:"Identifies a pacing problem. Starts practising negative-split long rides.",med:"Identifies an endurance problem. Adds more long sessions. Same thing happens in week 8."},
  thu:{title:"The fat-burning question you are avoiding",mech:"At true Zone 2, the body burns fat. This is about fuel availability at race pace — not body composition. Grey-zone athletes build neither aerobic nor threshold system.",prompt:"In your long session this weekend, cover the first 45 minutes without carbohydrates. Does your pace drop, perceived effort rise, or do you feel normal? That response is your aerobic system reporting its fitness.",good:"Completes the experiment honestly. Uses data to decide on fat-adaptation work.",med:"Takes gels from minute 15 'just in case'. Gets no data. Has no idea where their aerobic base sits."},
  sun:{title:"Did your long session build durability or confirm fatigue?",mech:"Supercompensation requires recovery after the stimulus. A long session that leaves you unable to train well Tuesday produced the stimulus but blocked the adaptation.",prompt:"Rate your readiness to train tomorrow 1–10. If below 6: what would you change about today's session to arrive at a 7?",good:"Reduces duration or intensity by 10% next week to hit a sustainable readiness score.",med:"Views low readiness as evidence of hard training. Repeats the session. Starts week 5 suppressed."}},
  4:{tue:{title:"Your strength work might be slowing you down",mech:"Strength training has one job: structural resilience. The moment a strength session compromises the subsequent endurance session, it has failed its brief.",prompt:"How did your legs and CNS feel 16 hours after your last strength session? If not 'ready', your strength programme is competing with your training. Which exercise is the culprit?",good:"Removes the offending exercise. Endurance sessions become more productive immediately.",med:"Decides they need to push through the adaptation phase. This phase lasts the entire season."},
  thu:{title:"Sweetspot is not a safe zone",mech:"Sweetspot (88–93% FTP) feels manageable. Done on accumulated fatigue, it produces low-grade overreaching that doesn't announce itself until performance has already declined.",prompt:"In your next sweetspot block, observe your breathing in the final 5 minutes. Controlled = adapting. Ragged = wrong zone. The session looks the same. The adaptation does not.",good:"Adjusts target power down 3–5% when breathing becomes ragged. Trains the correct system.",med:"Treats ragged breathing as evidence of effort. Wonders why recovery takes longer."},
  sun:{title:"The intensity honesty check",mech:"Most intermediate athletes overestimate how much training is genuinely hard and underestimate how much is grey zone. This is the primary reason athletes plateau.",prompt:"Categorise this week: genuinely easy, genuinely hard, or grey zone (felt like work, no specific target). What % was grey zone? What would the week look like if you removed it?",good:"Restructures next week with polarised intent. Easy sessions faster, hard sessions harder.",med:"Defends grey zone as 'moderate training'. The plateau continues into month three."}},
  5:{tue:{title:"Race thinking starts in training",mech:"Decision-making under race-pace conditions is a learned skill. Athletes who have never rehearsed pacing decisions make those decisions for the first time on race day.",prompt:"In your last race-intensity session: did you make active pacing decisions, or just hold on? If you were just holding on, you were practising survival — not race craft.",good:"Builds explicit pacing decisions into hard sessions. Arrives at race start with rehearsed instincts.",med:"Trains hard and hopes pacing instinct arrives on race day. It doesn't."},
  thu:{title:"Your transition is a technical session",mech:"T1 and T2 are neuromuscular transition events happening when blood lactate is elevated. An unpractised transition at race pace is a different experience from one in the driveway.",prompt:"Set up your T1 or T2 after a hard effort this weekend. Practise the sequence when your heart rate is above 150. Notice what goes wrong. That's the version that needs rehearsing.",good:"Automates the transition sequence under fatigue. Gains 30–60 seconds at no fitness cost.",med:"Practises transitions fresh. Panics at race pace. Loses time they can never recover."},
  sun:{title:"Race craft post-session debrief",mech:"Race craft compounds only if you extract the lesson from each simulation. A hard session without a structured debrief is experience without learning.",prompt:"After your key session: what decision did you get right? What decision cost you time or energy? If you can name both, the session produced race intelligence.",good:"Names one right decision and one wrong one after every race-intensity session.",med:"Finishes the session, logs the time, moves on. The same decisions get made at the race."}},
  6:{tue:{title:"Burnout is not about volume",mech:"Training burnout in intermediate athletes is rarely caused by too many kilometres. It is caused by sustained misalignment between training load, life stress, and recovery quality.",prompt:"What is your current life stress load (1–5)? Is your training load this week calibrated to that number — or was the plan written for a 2 and you're currently living a 4?",good:"Proactively reduces training intensity during high-stress weeks. Consistency survives the season.",med:"Maintains planned load regardless of life stress. Eventually breaks down and loses 3 weeks."},
  thu:{title:"The session that repays the most",mech:"For any given athlete at a given phase, one session type produces the highest adaptation-per-fatigue-cost. Identifying and protecting it is the highest-leverage training decision.",prompt:"If you could only do two sessions this week, which two would produce the most specific adaptation for your race target? Are those two currently protected — or most at risk?",good:"Identifies the two highest-leverage sessions and protects them unconditionally.",med:"Treats all sessions as equally important. Consistently misses the two that matter most."},
  sun:{title:"The sustainability check",mech:"A season plan is only as good as it is sustainable. An athlete who arrives undertrained but rested will outperform an athlete who arrives overtrained and brittle.",prompt:"Could you repeat this week's training load for the next four weeks without degrading performance or wellbeing? If no — what specifically would need to change?",good:"Identifies the inflection point before it hits. Adjusts proactively.",med:"Waits until the inflection point forces the adjustment. Loses a week recovering."}}
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let mode = null; // 'race' | 'general'
let raceDate = null;
let calendar = {}; // {Mon: ['swim','run'], ...}
let selectedType = 'swim';
let selectedTypeEdit = 'swim';
let currentTab = 'today';
let currentWeekNum = 1;
let weekCadences = {}; // {weekNum: 'base'|'build'|'peak'|'taper'}
let reflections = {}; // keyed by "w{n}" + session notes keyed by "s_w{n}_day_type"
let setupDone = false;
let tipsFilter = 'all';

// ═══════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════
async function loadAll() {
  try {
    const r = { value: localStorage.getItem('tri_v4_state') };
    if (r?.value) {
      const d = JSON.parse(r.value);
      mode = d.mode||null; raceDate = d.raceDate||null;
      calendar = d.calendar||{}; weekCadences = d.weekCadences||{};
      reflections = d.reflections||{}; setupDone = d.setupDone||false;
      currentWeekNum = d.currentWeekNum||1;
    }
  } catch(e) {}
}

async function saveAll() {
  try {
    localStorage.setItem('tri_v4_state', JSON.stringify({
      mode, raceDate, calendar, weekCadences, reflections, setupDone, currentWeekNum
    }));
  } catch(e) {}
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  await loadAll();
  if (setupDone) {
    showScreen('screen-main');
    renderAllTabs();
    switchTab('today', document.querySelector('.nav-item'));
  } else {
    showScreen('screen-ob-mode');
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ═══════════════════════════════════════════════
// ONBOARDING — MODE
// ═══════════════════════════════════════════════
function selectMode(m, card) {
  mode = m;
  document.querySelectorAll('#mode-cards .mode-card').forEach(c => c.classList.remove('sel'));
  card.classList.add('sel');
  document.getElementById('race-date-section').style.display = m === 'race' ? 'block' : 'none';
  updateModeNextBtn();
}

function updateModeNextBtn() {
  const ok = mode === 'general' || (mode === 'race' && raceDate);
  document.getElementById('ob-mode-next').disabled = !ok;
}

function updateRaceWeeks() {
  raceDate = document.getElementById('ob-race-date').value;
  if (raceDate) {
    const w = Math.round((new Date(raceDate) - new Date()) / (1000*60*60*24*7));
    const badge = document.getElementById('race-weeks-badge');
    badge.style.display = 'block';
    badge.textContent = w > 0 ? `${w} wks` : 'Past';
  }
  updateModeNextBtn();
}

function goToCalendarSetup() {
  renderObCalGrid();
  showScreen('screen-ob-cal');
}

// ═══════════════════════════════════════════════
// ONBOARDING — CALENDAR
// ═══════════════════════════════════════════════
function selectType(type, btn) {
  selectedType = type;
  document.querySelectorAll('#type-strip .type-chip').forEach(b => {
    b.className = 'type-chip';
    if (b.dataset.type === type) b.className = `type-chip active-${type}`;
  });
}

function renderObCalGrid() {
  document.getElementById('ob-cal-grid').innerHTML = buildCalGridHTML(calendar, 'ob');
}

function buildCalGridHTML(cal, prefix) {
  return DAYS.map(d => {
    const sessions = cal[d] || [];
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const s = sessions[i];
      if (s) {
        slots.push(`<div class="slot has-session ${s}" onclick="removeSlot('${d}',${i},'${prefix}')">
          <button class="slot-del" onclick="event.stopPropagation();removeSlot('${d}',${i},'${prefix}')">✕</button>
          <span class="slot-icon">${SESSION_ICONS[s]}</span>
          <span class="slot-txt">${SESSION_ABBR[s]}</span>
        </div>`);
      } else if (i === sessions.length) {
        slots.push(`<div class="slot add-slot" onclick="addSlot('${d}','${prefix}')">+</div>`);
        break;
      }
    }
    if (sessions.length === 4) {} // no add slot
    return `<div class="cal-day-block"><div class="cal-day-lbl">${d}</div><div class="cal-day-slots">${slots.join('')}</div></div>`;
  }).join('');
}

function addSlot(day, prefix) {
  if (!calendar[day]) calendar[day] = [];
  if (calendar[day].length < 4) {
    const type = prefix === 'ob' ? selectedType : selectedTypeEdit;
    calendar[day].push(type);
    if (prefix === 'ob') renderObCalGrid();
    else renderEditCalGrid();
  }
}

function removeSlot(day, idx, prefix) {
  if (calendar[day]) {
    calendar[day].splice(idx, 1);
    if (calendar[day].length === 0) delete calendar[day];
  }
  if (prefix === 'ob') renderObCalGrid();
  else renderEditCalGrid();
}

async function finishSetup() {
  setupDone = true;
  if (!currentWeekNum) currentWeekNum = 1;
  await saveAll();
  showScreen('screen-main');
  renderAllTabs();
  switchTab('today', document.querySelector('.nav-item'));
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function switchTab(tab, btn) {
  currentTab = tab;
  ['today','week','tips','cal'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'flex' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'tips') renderTips();
  if (tab === 'cal') renderCalTab();
  if (tab === 'today') renderToday();
  if (tab === 'week') renderWeekTab();
}

// ═══════════════════════════════════════════════
// RENDER ALL TABS
// ═══════════════════════════════════════════════
function renderAllTabs() {
  renderToday();
  renderWeekTab();
}

// ═══════════════════════════════════════════════
// TAB 1 — TODAY
// ═══════════════════════════════════════════════
function renderToday() {
  const now = new Date();
  document.getElementById('today-date-lbl').textContent =
    now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});

  // Phase pill
  const cadence = weekCadences[currentWeekNum] || getDefaultCadence(currentWeekNum);
  const pill = document.getElementById('phase-pill');
  pill.className = `week-phase-pill phase-${cadence}`;
  pill.textContent = cadence.charAt(0).toUpperCase() + cadence.slice(1);

  // Insight
  document.getElementById('insight-text').textContent = CADENCE_INSIGHTS[cadence];

  // Today's sessions
  const todaySessions = calendar[DAY_TODAY] || [];
  const container = document.getElementById('today-sessions-container');

  if (todaySessions.length === 0) {
    const hasAnySessions = Object.values(calendar).some(s => s.length > 0);
    container.innerHTML = `<div class="empty-today">
      <div class="empty-icon">${hasAnySessions ? '🛌' : '📅'}</div>
      <div class="empty-title">${hasAnySessions ? 'Rest day' : 'No sessions set'}</div>
      <div class="empty-desc">${hasAnySessions ? 'Recovery is training. Absorb the adaptation from this week.' : 'Go to Calendar to set up your typical training week.'}</div>
    </div>`;
  } else {
    const cards = todaySessions.map((type, i) => {
      const key = `s_w${currentWeekNum}_${DAY_TODAY}_${i}`;
      const sess = reflections[key] || {};
      const status = sess.status;
      return `<div class="session-card" id="scard-${i}">
        <div class="session-card-hdr">
          <div class="session-type-dot dot-${type}"></div>
          <div class="session-card-name">${SESSION_LABELS[type]}</div>
          <div class="session-card-day">${DAY_TODAY}</div>
        </div>
        <div class="status-row">
          <button class="status-btn ${status==='done'?'done-active':''}" onclick="setTodayStatus(${i},'done',this)">✓ Done</button>
          <button class="status-btn ${status==='modified'?'mod-active':''}" onclick="setTodayStatus(${i},'modified',this)">~ Modified</button>
          <button class="status-btn ${status==='skipped'?'skip-active':''}" onclick="setTodayStatus(${i},'skipped',this)">✕ Skipped</button>
        </div>
        <div class="mini-refl ${status&&status!=='skipped'?'visible':''}" id="mini-refl-${i}">
          <div class="mini-refl-label">Post-session note</div>
          <textarea class="mini-ta" id="mini-ta-${i}" placeholder="How did it go? What did you notice?" rows="2">${sess.note||''}</textarea>
          <button class="mini-save" onclick="saveMiniNote(${i})">Save note</button>
        </div>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="session-cards">${cards}</div>`;
  }

  // Cadence selector — highlight current
  const cadenceBtns = document.querySelectorAll('.cadence-btn');
  cadenceBtns.forEach(b => {
    b.className = 'cadence-btn';
    const cad = b.querySelector('.c-name').textContent.toLowerCase();
    if (cad === cadence) b.className = `cadence-btn sel-${cadence}`;
  });
}

async function setTodayStatus(idx, status, btn) {
  const key = `s_w${currentWeekNum}_${DAY_TODAY}_${idx}`;
  if (!reflections[key]) reflections[key] = {};
  const current = reflections[key].status;
  reflections[key].status = current === status ? null : status;
  await saveAll();
  renderToday();
}

async function saveMiniNote(idx) {
  const key = `s_w${currentWeekNum}_${DAY_TODAY}_${idx}`;
  if (!reflections[key]) reflections[key] = {};
  reflections[key].note = document.getElementById(`mini-ta-${idx}`)?.value || '';
  await saveAll();
}

async function setCadence(cadence, btn) {
  weekCadences[currentWeekNum] = cadence;
  await saveAll();
  renderToday();
  renderWeekTab();
}

function getDefaultCadence(weekNum) {
  for (const phase of PHASES_39) {
    if (phase.weeks.includes(weekNum)) return phase.defaultCadence;
  }
  return 'base';
}

// ═══════════════════════════════════════════════
// TAB 2 — WEEK
// ═══════════════════════════════════════════════
function renderWeekTab() {
  const pillarIdx = (currentWeekNum - 1) % 6;
  const pillar = PILLAR_CYCLE[pillarIdx];
  const cadence = weekCadences[currentWeekNum] || getDefaultCadence(currentWeekNum);
  const content = CARD_CONTENT[pillar.p];
  const refl = reflections[`w${currentWeekNum}`] || {};

  document.getElementById('week-eyebrow').textContent = `Week ${currentWeekNum} · ${cadence.charAt(0).toUpperCase()+cadence.slice(1)}`;
  document.getElementById('week-title').textContent = pillar.label;

  // Week nav row
  const pillarSection = `<div style="padding:.75rem 1rem .25rem">
    <div style="font-family:var(--fm);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px">Pillar ${currentWeekNum} of 39</div>
    <div style="font-family:var(--fd);font-size:20px;font-weight:600;color:var(--ink);margin-bottom:.75rem">${pillar.label}</div>
  </div>`;
  const wkNav = `<div style="display:flex;gap:6px;padding:0 1rem .75rem;overflow-x:auto">
    ${[-2,-1,0,1,2].map(offset => {
      const wn = currentWeekNum + offset;
      if (wn < 1 || wn > 39) return '';
      const isCur = wn === currentWeekNum;
      const hasRefl = !!reflections[`w${wn}`]?.savedAt;
      return `<button class="week-num-btn${isCur?' cur':''}" onclick="selectWeekNum(${wn})">
        Wk ${wn}${hasRefl?'<span style="position:absolute;top:3px;right:5px;width:5px;height:5px;border-radius:50%;background:var(--done)"></span>':''}
      </button>`;
    }).join('')}
  </div>`;

  // Session review for Sunday
  const allWeekSessions = DAYS.flatMap(d => (calendar[d]||[]).map((t,i) => ({
    day:d, type:t, idx:i, label:`${d} — ${SESSION_LABELS[t]}`
  })));
  const sessionStatuses = reflections[`w${currentWeekNum}`]?.sessionStatuses || {};
  const srRows = allWeekSessions.length > 0
    ? allWeekSessions.map(s => {
        const key = `${s.day}_${s.idx}`;
        const st = sessionStatuses[key];
        return `<div class="sr-row">
          <span class="sr-name">${s.label}</span>
          <div class="sr-btns">
            <button class="srb ${st==='done'?'done':''}" onclick="setSrStatus(${currentWeekNum},'${key}','done',this)">Done</button>
            <button class="srb ${st==='modified'?'modified':''}" onclick="setSrStatus(${currentWeekNum},'${key}','modified',this)">Mod</button>
            <button class="srb ${st==='skipped'?'skipped':''}" onclick="setSrStatus(${currentWeekNum},'${key}','skipped',this)">Skip</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="font-size:12px;color:var(--ink3);font-style:italic">Set up your calendar to track sessions here.</div>`;

  const vulnTags = [...new Set(
    DAYS.flatMap(d => (calendar[d]||[]).map(t => SESSION_LABELS[t]))
  ), 'None — held the floor'].map(s =>
    `<button class="stag ${refl.vulnSession===s?'sel':''}" onclick="setVuln(${currentWeekNum},'${s}',this)">${s}</button>`
  ).join('');

  const gzVal = refl.greyZone;

  const sunReflHTML = `
    <div class="sun-refl">
      <div class="sun-refl-title">Sunday reflection</div>

      <div class="dpc-label">Session outcomes this week</div>
      <div class="session-review-block"><div class="sr-title">Mark each session</div>${srRows}</div>

      <div class="dpc-label">Readiness tomorrow (1–10)</div>
      <div class="rating-strip" style="margin-bottom:12px">
        ${[1,2,3,4,5,6,7,8,9,10].map(n =>
          `<button class="rb ${refl.readiness===n?'sel':''}" onclick="setRating(${currentWeekNum},${n},this)">${n}</button>`
        ).join('')}
      </div>

      <div class="gz-explainer">
        <div class="gz-title">Training zones — what was this week?</div>
        <div class="gz-row">
          <div class="gz-cell gz-ez">
            <div class="gz-cell-name">Easy</div>
            <div class="gz-cell-desc">Full conversation comfortable. Nose-breathing possible.</div>
            <div class="gz-cell-eg">Z1–Z2 run, recovery spin, technique swim</div>
          </div>
          <div class="gz-cell gz-gz">
            <div class="gz-cell-name">Grey ⚠</div>
            <div class="gz-cell-desc">Too hard for aerobic base. Too easy for threshold. No specific target.</div>
            <div class="gz-cell-eg">"Moderate" ride, "tempo-ish" run without target</div>
          </div>
          <div class="gz-cell gz-hz">
            <div class="gz-cell-name">Hard</div>
            <div class="gz-cell-desc">At or above lactate threshold. Speaking is difficult. Specific target held.</div>
            <div class="gz-cell-eg">2×20 sweetspot, 5×400m, race-pace brick</div>
          </div>
        </div>
        <div class="gz-q">What % of this week's training was in the grey zone?</div>
        <div class="gz-btns">
          ${[['<20%',10],['20–40%',30],['40–60%',50],['>60%',70]].map(([l,v]) =>
            `<button class="gzb ${gzVal===v?'sel':''}" onclick="setGZ(${currentWeekNum},${v},this)">${l}</button>`
          ).join('')}
        </div>
      </div>

      <div class="dpc-label" style="margin-top:4px">Most vulnerable session</div>
      <div class="stags" style="margin-bottom:12px">${vulnTags}</div>

      <div class="dpc-label">Open reflection</div>
      <textarea class="refl-ta" id="sun-ta-${currentWeekNum}" placeholder="What did you notice? What decision did you get right — or wrong?">${refl.notes||''}</textarea>
      <button class="save-refl-btn" onclick="saveWeekRefl(${currentWeekNum})">Save reflection</button>
      <div class="saved-badge ${refl.savedAt?'on':''}" id="saved-badge-${currentWeekNum}">
        ✓ Saved ${refl.savedAt?new Date(refl.savedAt).toLocaleDateString('en-AU',{day:'numeric',month:'short'}):''}
      </div>
    </div>`;

  const cards = [
    {badge:'tue',day:'Tuesday',data:content.tue},
    {badge:'thu',day:'Thursday',data:content.thu},
    {badge:'sun',day:'Sunday',data:content.sun,sunRefl:sunReflHTML},
  ].map(d => {
    const hasSaved = d.badge==='sun' && !!refl.savedAt;
    return `<div class="day-prompt-card ${hasSaved?'expanded':''}" id="dpc-${d.badge}">
      <div class="dpc-hdr" onclick="toggleDpc('${d.badge}')">
        <span class="dpc-day ${d.badge}">${d.day}</span>
        <span class="dpc-title">${d.data.title}</span>
        <span class="dpc-chevron ${hasSaved?'open':''}">▼</span>
      </div>
      <div class="dpc-body ${hasSaved?'on':''}">
        <div class="dpc-mechanism">${d.data.mech}</div>
        <div class="dpc-prompt">${d.data.prompt}</div>
        <div class="dpc-label">The difference it makes</div>
        <div class="contrast-pair">
          <div class="cp-cell cp-good"><div class="cp-lbl g">Sharp</div><div class="cp-txt">${d.data.good}</div></div>
          <div class="cp-cell cp-mid"><div class="cp-lbl m">Mediocre</div><div class="cp-txt">${d.data.med}</div></div>
        </div>
        ${d.sunRefl||''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('week-cards').innerHTML = pillarSection + wkNav + cards;
}

async function selectWeekNum(n) {
  currentWeekNum = n;
  await saveAll();
  renderWeekTab();
  renderToday();
}

function toggleDpc(badge) {
  const card = document.getElementById(`dpc-${badge}`);
  const body = card.querySelector('.dpc-body');
  const chevron = card.querySelector('.dpc-chevron');
  const isOpen = body.classList.contains('on');
  document.querySelectorAll('.dpc-body').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.dpc-chevron').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.day-prompt-card').forEach(c => c.classList.remove('expanded'));
  if (!isOpen) { body.classList.add('on'); chevron.classList.add('open'); card.classList.add('expanded'); }
}

function ensureRefl(week) {
  if (!reflections[`w${week}`]) reflections[`w${week}`] = {};
  return reflections[`w${week}`];
}

function setRating(week, val, btn) {
  btn.closest('.rating-strip').querySelectorAll('.rb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  ensureRefl(week).readiness = val;
}

function setGZ(week, val, btn) {
  btn.closest('.gz-btns').querySelectorAll('.gzb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  ensureRefl(week).greyZone = val;
}

function setVuln(week, val, btn) {
  btn.closest('.stags').querySelectorAll('.stag').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  ensureRefl(week).vulnSession = val;
}

async function setSrStatus(week, key, status, btn) {
  const r = ensureRefl(week);
  if (!r.sessionStatuses) r.sessionStatuses = {};
  r.sessionStatuses[key] = r.sessionStatuses[key] === status ? null : status;
  btn.closest('.sr-btns').querySelectorAll('.srb').forEach(b => b.className='srb');
  if (r.sessionStatuses[key]) btn.className = `srb ${status}`;
  await saveAll();
}

async function saveWeekRefl(week) {
  const r = ensureRefl(week);
  r.notes = document.getElementById(`sun-ta-${week}`)?.value || '';
  r.savedAt = Date.now();
  await saveAll();
  const badge = document.getElementById(`saved-badge-${week}`);
  if (badge) { badge.textContent = `✓ Saved · ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`; badge.classList.add('on'); }
}

// ═══════════════════════════════════════════════
// TAB 3 — TIPS
// ═══════════════════════════════════════════════
function filterTips(filter, btn) {
  tipsFilter = filter;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTips();
}

function renderTips() {
  renderTrend();
  const container = document.getElementById('tips-list');
  let html = '';
  PHASES_39.forEach(phase => {
    const filteredWeeks = phase.weeks.filter(wn => {
      if (tipsFilter === 'all') return true;
      const pillarIdx = (wn-1)%6;
      return PILLAR_CYCLE[pillarIdx].cls === tipsFilter;
    });
    if (filteredWeeks.length === 0) return;
    html += `<div class="wtg-phase">${phase.label}</div>`;
    filteredWeeks.forEach(wn => {
      const pillar = PILLAR_CYCLE[(wn-1)%6];
      const content = CARD_CONTENT[pillar.p];
      const refl = reflections[`w${wn}`];
      const hasRefl = !!refl?.savedAt;
      const isCurrent = wn === currentWeekNum;
      html += `<div class="week-tip-card ${isCurrent?'expanded':''}" id="wtc-${wn}" onclick="toggleWtc(${wn})">
        <div class="wtc-hdr">
          <span class="wtc-num">Wk ${wn}</span>
          <span class="wtc-pillar ${pillar.cls}">${pillar.label}</span>
          <span class="wtc-dot ${hasRefl?'on':''}"></span>
          <span class="wtc-chevron ${isCurrent?'open':''}">▼</span>
        </div>
        <div class="wtc-title">${content.sun.title}</div>
        <div class="wtc-body ${isCurrent?'on':''}">
          <div class="wtc-prompt">${content.sun.prompt}</div>
          <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div style="padding:8px 10px;border-radius:8px;background:var(--bike-l);border:1px solid rgba(15,110,86,0.2)">
              <div style="font-family:var(--fm);font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--bike);margin-bottom:3px">Sharp</div>
              <div style="font-size:11px;color:var(--ink2);line-height:1.45">${content.sun.good}</div>
            </div>
            <div style="padding:8px 10px;border-radius:8px;background:var(--s3);border:0.5px solid var(--bd)">
              <div style="font-family:var(--fm);font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-bottom:3px">Mediocre</div>
              <div style="font-size:11px;color:var(--ink2);line-height:1.45">${content.sun.med}</div>
            </div>
          </div>
          ${isCurrent?`<button class="wtc-goto-btn" onclick="event.stopPropagation();switchTab('week',document.querySelectorAll('.nav-item')[1])">Go to this week's prompts ↗</button>`:''}
        </div>
      </div>`;
    });
  });
  container.innerHTML = html;
}

function toggleWtc(wn) {
  const card = document.getElementById(`wtc-${wn}`);
  const body = card.querySelector('.wtc-body');
  const chev = card.querySelector('.wtc-chevron');
  const isOpen = body.classList.contains('on');
  if (isOpen) {
    body.classList.remove('on'); chev.classList.remove('open'); card.classList.remove('expanded');
  } else {
    body.classList.add('on'); chev.classList.add('open'); card.classList.add('expanded');
  }
}

function renderTrend() {
  // last 12 weeks or all logged weeks
  const weeks = [];
  for (let i = Math.max(1, currentWeekNum-11); i <= currentWeekNum; i++) weeks.push(i);
  const maxVal = 1;
  const bars = weeks.map(wn => {
    const cadence = weekCadences[wn] || getDefaultCadence(wn);
    const colorMap = {base:'base-c',build:'build-c',peak:'peak-c',taper:'taper-c'};
    const hasRefl = !!reflections[`w${wn}`]?.savedAt;
    const heightPct = hasRefl ? 100 : 20;
    return `<div class="trend-bar-wrap">
      <div class="trend-bar ${colorMap[cadence]}" style="height:${heightPct}%"></div>
      <div class="trend-wk-lbl">${wn}</div>
    </div>`;
  });
  document.getElementById('trend-bars').innerHTML = bars.join('');

  // Stats
  const allRefls = Object.entries(reflections).filter(([k])=>k.startsWith('w')&&!k.startsWith('w_')).map(([,v])=>v).filter(r=>r?.savedAt);
  const rdArr = allRefls.filter(r=>r.readiness).map(r=>r.readiness);
  const avgRD = rdArr.length ? (rdArr.reduce((a,b)=>a+b,0)/rdArr.length).toFixed(1) : '—';
  const gzArr = allRefls.filter(r=>r.greyZone).map(r=>r.greyZone);
  const avgGZ = gzArr.length ? Math.round(gzArr.reduce((a,b)=>a+b,0)/gzArr.length)+'%' : '—';
  const rdWarn = typeof avgRD==='string'?false : parseFloat(avgRD)<6.5;
  const gzWarn = typeof avgGZ==='string'?false : parseInt(avgGZ)>40;
  document.getElementById('trend-stats').innerHTML = `
    <div class="ts-cell"><div class="ts-val ${rdWarn?'warn':'good'}">${avgRD}</div><div class="ts-desc">Avg readiness</div></div>
    <div class="ts-cell"><div class="ts-val ${gzWarn?'warn':'good'}">${avgGZ}</div><div class="ts-desc">Avg grey zone</div></div>
    <div class="ts-cell"><div class="ts-val">${allRefls.length}</div><div class="ts-desc">Reflections logged</div></div>`;
}

// ═══════════════════════════════════════════════
// TAB 4 — CALENDAR EDIT
// ═══════════════════════════════════════════════
function selectTypeEdit(type, btn) {
  selectedTypeEdit = type;
  document.querySelectorAll('#cal-type-strip .type-chip').forEach(b => {
    b.className = 'type-chip';
    if (b.dataset.type === type) b.className = `type-chip active-${type}`;
  });
}

function renderCalTab() {
  renderEditCalGrid();
  renderCalPreview();
  // Set mode cards
  document.querySelectorAll('#edit-mode-cards .mode-card').forEach(c => c.classList.remove('sel'));
  const modeCard = document.querySelector(`#edit-mode-cards .mode-card:${mode==='race'?'first':'last'}-child`);
  if (modeCard) modeCard.classList.add('sel');
  const rdr = document.getElementById('edit-race-date-row');
  if (rdr) rdr.style.display = mode==='race' ? 'block' : 'none';
  if (raceDate) document.getElementById('edit-race-date').value = raceDate;
}

function renderCalPreview() {
  const container = document.getElementById('cal-preview-card');
  const days = DAYS.map(d => {
    const sessions = (calendar[d]||[]).slice(0,4);
    const slots = sessions.map(s =>
      `<div class="wp-session ${s}">${SESSION_ICONS[s]}</div>`
    ).join('');
    const extras = sessions.length > 2 ? `<div class="wp-more">+${sessions.length-2}</div>` : '';
    return `<div class="wp-day">
      <div class="wp-day-name">${d.substring(0,2)}</div>
      ${sessions.slice(0,2).map(s=>`<div class="wp-session ${s}">${SESSION_ICONS[s]}</div>`).join('')}
      ${sessions.length>2?`<div class="wp-more">+${sessions.length-2}</div>`:''}
      ${sessions.length===0?`<div class="wp-session empty">—</div>`:''}
    </div>`;
  }).join('');
  container.innerHTML = `<div class="cur-cal-title">Current calendar</div><div class="week-preview">${days}</div>`;
}

function renderEditCalGrid() {
  document.getElementById('edit-cal-grid').innerHTML = buildCalGridHTML(calendar, 'edit');
}

function selectModeEdit(m, card) {
  mode = m;
  document.querySelectorAll('#edit-mode-cards .mode-card').forEach(c => c.classList.remove('sel'));
  card.classList.add('sel');
  document.getElementById('edit-race-date-row').style.display = m==='race'?'block':'none';
}

function updateEditRaceWeeks() {
  raceDate = document.getElementById('edit-race-date').value;
  if (raceDate) {
    const w = Math.round((new Date(raceDate)-new Date())/(1000*60*60*24*7));
    const badge = document.getElementById('edit-weeks-badge');
    badge.style.display = 'block';
    badge.textContent = w>0?`${w} wks`:'Past';
  }
}

async function saveCalEdit() {
  await saveAll();
  renderCalPreview();
  renderToday();
  renderWeekTab();
  // Flash confirmation
  const btn = document.querySelector('#tab-cal .cta-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Saved';
  btn.style.opacity = '.7';
  setTimeout(()=>{ btn.textContent=orig; btn.style.opacity=''; },1500);
}

// ═══════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════
init();

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

