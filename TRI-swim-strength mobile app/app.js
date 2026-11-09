(function () {
  'use strict';

  // v2 storage: two sessions share one app, so every key is namespaced by session.
  var PROGRESS_KEY = 'triSwimStrength.progress.v2';
  var LOAD_KEY = 'triSwimStrength.load.v1';
  var SESSIONS_KEY = 'triSwimStrength.sessionsCompleted.v2';
  var COUNTED_KEY = 'triSwimStrength.counted.v2';
  var ACTIVE_KEY = 'triSwimStrength.activeSession.v1';
  var LEGACY_SESSIONS_KEY = 'triSwimStrength.sessionsCompleted.v1';

  // Why two sessions, and why these moves, is written up in CLAUDE.md decision 49.
  // Short version: the swim fade is stroke length falling late in a long rep, so
  // the strength session targets lat, triceps and trunk, and the primer wakes the
  // shoulder up without costing any swim quality.
  //
  // `sets` > 1 renders one button per set. `log: true` adds a load/reps field that
  // survives a reset, because without a record of the band there is no progression.
  var SESSIONS = [
    {
      id: 'primer',
      tabName: 'Pre-swim primer',
      tabMeta: '20 min',
      name: 'Primer',
      eyebrow: 'DRYLAND PRIMER · BEFORE YOU SWIM',
      titleLead: 'Pre-swim ',
      titleEm: 'primer',
      sub: 'Wake up the shoulder, lats and trunk. Do not tire them. You should swim better after it, not worse.',
      meta: [
        { label: 'Structure', value: 'Open up (4) → Prime the pull (8) → into the water' },
        { label: 'Equipment', value: 'Light loop band and an anchor above head height (fence or door)' },
        { label: 'Short on time', value: 'Skip the circles and the plank. One set of everything else takes about 8 minutes.' }
      ],
      phases: [
        {
          id: 'p1',
          eyebrow: 'PHASE 1 · 4 MIN',
          title: 'Open up',
          intro: 'Light band. Smooth reps. Nothing here should feel hard.',
          items: [
            { id: 'circles', name: 'Arm Circles + Trunk Rotation', dose: '1 min', cue: 'Big forward and backward circles, then 5 slow trunk rotations each side. Stay loose.' },
            { id: 'er', name: 'Band External Rotation', dose: '2 x 12 each arm', sets: 2, cue: 'Elbow pinned to your side. Rotate out, hold 1 second, return slowly. RPE 4–5.' },
            { id: 'pullapart', name: 'Band Pull-Apart', dose: '2 x 15', sets: 2, cue: 'Arms straight. Pull the band to your chest and squeeze the shoulder blades.' }
          ]
        },
        {
          id: 'p2',
          eyebrow: 'PHASE 2 · 8 MIN',
          title: 'Prime the pull',
          intro: 'Rehearse the catch and the swim position. Stop every set well short of effort.',
          items: [
            { id: 'sapd', name: 'Straight-Arm Band Pulldown', dose: '2 x 12', sets: 2, cue: 'Hinge to about 45°, anchor above head. Sweep straight arms to your thighs. Feel the lats, not the arms.' },
            { id: 'evf', name: 'EVF Isolation (Early Vertical Forearm)', dose: '2 x 15', sets: 2, cue: 'Elbow high and still. Bend only at the elbow until your fingers point at the floor.' },
            { id: 'plank', name: 'Front Plank', dose: '2 x 30 sec', sets: 2, cue: 'Ribs down, glutes tight, one straight line. This is your swim position.' },
            { id: 'fast', name: 'Fast Band Pulls', dose: '2 x 6 fast', sets: 2, cue: 'Light to medium band, hinged. Fast catch to hip, smooth return. Stop at 6. This switches the muscles on; it is not work.' }
          ]
        }
      ],
      reminders: [
        '<strong>Finish fresher than you started.</strong> If you feel tired, the band is too heavy or you did too much.',
        '<strong>RPE 5 or below.</strong> A set taken to failure defeats the point.',
        '<strong>Short and often beats long and rare.</strong> Do it before every swim, not just one.',
        '<strong>Finish 5–10 minutes before you get in.</strong> Walk to the water. Do not sit.'
      ]
    },
    {
      id: 'strength',
      tabName: 'Strength',
      tabMeta: '35 min',
      name: 'Strength session',
      eyebrow: 'DRYLAND STRENGTH · BIKE DAY',
      titleLead: '35-minute ',
      titleEm: 'strength',
      titleTail: ' session',
      sub: 'Built to hold your stroke length late in a long rep: strong lats and triceps, a stiff trunk, and pull endurance.',
      meta: [
        { label: 'Structure', value: 'Warm-up (4) → Strength (24) → Fade finisher (7)' },
        { label: 'Equipment', value: 'Loop or handled bands in two strengths, and an anchor point' },
        { label: 'When', value: 'After an easy or Z2 ride. Leave 24 hours before your next hard swim.' }
      ],
      phases: [
        {
          id: 's1',
          eyebrow: 'PHASE 1 · 4 MIN',
          title: 'Warm-up',
          intro: 'Two quick moves. Save your energy for the strength block.',
          items: [
            { id: 'circles', name: 'Arm Circles + Band Pull-Apart', dose: '1 min + 1 x 15', cue: 'Loosen the shoulders, then 15 pull-aparts with straight arms.' },
            { id: 'bridge', name: 'Glute Bridge', dose: '1 x 10', cue: 'Drive the hips up and squeeze. Your legs are tired from the ride, so keep it smooth.' }
          ]
        },
        {
          id: 's2',
          eyebrow: 'PHASE 2 · 24 MIN',
          title: 'Strength block',
          intro: 'Pair A1 with A2, and B1 with B2. Rest 60 seconds after each pair. Stop each set 1–2 reps short of failure.',
          items: [
            { id: 'a1', name: 'A1 · Kneeling Band Pulldown', dose: '4 x 6–10', sets: 4, log: true, cue: 'Anchor high and kneel. Pull the band to your chest, elbows down and back. The last 2 reps should be hard. Too easy? Kneel further back, double the band, or lower for 3 seconds.' },
            { id: 'a2', name: 'A2 · Band Pallof Press', dose: '4 x 8 each side', sets: 4, log: true, cue: 'Anchor at chest height. Press out, hold 2 seconds, and resist the pull. Keep your hips square.' },
            { id: 'b1', name: 'B1 · Single-Arm Band Row', dose: '3 x 8–10 each arm', sets: 3, log: true, cue: 'Anchor at waist height. Pull the elbow past your ribs and squeeze. Do not twist to cheat the rep.' },
            { id: 'b2', name: 'B2 · Band Triceps Pushdown', dose: '3 x 12–15', sets: 3, log: true, cue: 'Elbows pinned. Lock out hard. This is the end of your stroke.' },
            { id: 'dl', name: 'Band Deadlift', dose: '3 x 10', sets: 3, log: true, cue: 'Stand on the band, hinge, and drive the hips forward. Keep it light after a ride.' }
          ]
        },
        {
          id: 's3',
          eyebrow: 'PHASE 3 · 7 MIN',
          title: 'Fade finisher',
          intro: 'This is the part that copies the late-rep fade. Stay strict about form.',
          items: [
            { id: 'endure', name: 'Pull-Endurance Finisher', dose: '3 x 90 sec', sets: 3, log: true, cue: 'Hinge to 45°, anchor above head. Alternate-arm pulls at a steady rate, elbow high. RPE 7. End the set the moment your elbows drop. Rest 60 seconds.' }
          ]
        }
      ],
      reminders: [
        '<strong>Stop 1–2 reps short of failure</strong> on every work set. Never grind.',
        '<strong>Log the band and the reps.</strong> If you do not write it down, you cannot progress it.',
        '<strong>Progress by band, not by reps.</strong> When every set hits the top of the range at RPE 8 or below, step up to a stronger band.',
        '<strong>Place it after an easy ride</strong> and 24 hours before your next hard swim. Tired lats cost swim quality.',
        '<strong>Check it works.</strong> On your longest continuous swim rep, compare strokes per length for lengths 2–4 with the last three. Your baseline is about +5%. If that has not dropped after 8 weeks, swap this session for a swim.'
      ]
    }
  ];

  var sessionsById = {};
  SESSIONS.forEach(function (s) { sessionsById[s.id] = s; });

  var state = readJSON(PROGRESS_KEY, {});
  var loads = readJSON(LOAD_KEY, {});
  var counted = readJSON(COUNTED_KEY, {});
  var counts = loadCounts();
  var activeId = loadActive();
  var rowsByKey = {};

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  // The v1 app was one 45-minute strength session with one all-time counter.
  // Carry that count over to the strength session once, so history is not lost.
  function loadCounts() {
    var stored = readJSON(SESSIONS_KEY, null);
    if (stored) return stored;
    var legacy = 0;
    try { legacy = parseInt(localStorage.getItem(LEGACY_SESSIONS_KEY), 10) || 0; } catch (e) {}
    var fresh = { primer: 0, strength: legacy };
    writeJSON(SESSIONS_KEY, fresh);
    return fresh;
  }

  function loadActive() {
    var id = null;
    try { id = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
    return sessionsById[id] ? id : 'primer';
  }

  function setActive(id) {
    activeId = id;
    try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  }

  function current() { return sessionsById[activeId]; }

  function setCount(s) { return s.sets && s.sets > 1 ? s.sets : 1; }

  function allItems(session) {
    var out = [];
    session.phases.forEach(function (p) { p.items.forEach(function (it) { out.push(it); }); });
    return out;
  }

  function keyFor(session, item, n) {
    return session.id + '.' + item.id + (n ? '.s' + n : '');
  }

  function isDone(session, item, n) { return !!state[keyFor(session, item, n)]; }

  function itemDoneCount(session, item) {
    var total = setCount(item);
    if (total === 1) return isDone(session, item) ? 1 : 0;
    var done = 0;
    for (var n = 1; n <= total; n++) { if (isDone(session, item, n)) done++; }
    return done;
  }

  function itemComplete(session, item) {
    return itemDoneCount(session, item) === setCount(item);
  }

  function sessionTotals(session) {
    var total = 0;
    var done = 0;
    allItems(session).forEach(function (it) {
      total += setCount(it);
      done += itemDoneCount(session, it);
    });
    return { done: done, total: total };
  }

  function saveState() { writeJSON(PROGRESS_KEY, state); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------- rendering ----------

  function renderTabs() {
    var tabs = document.querySelectorAll('.session-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      var selected = tab.getAttribute('data-session') === activeId;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('sessionPanel').setAttribute('aria-labelledby', 'tab-' + activeId);
  }

  function renderHero(session) {
    document.getElementById('heroEyebrow').textContent = session.eyebrow;
    var h1 = document.getElementById('heroTitle');
    h1.textContent = '';
    h1.appendChild(document.createTextNode(session.titleLead));
    h1.appendChild(el('em', '', session.titleEm));
    if (session.titleTail) h1.appendChild(document.createTextNode(session.titleTail));
    document.getElementById('heroSub').textContent = session.sub;

    var meta = document.getElementById('sessionMeta');
    meta.textContent = '';
    session.meta.forEach(function (m) {
      var item = el('div', 'session-meta-item');
      item.appendChild(el('span', 'meta-label', m.label));
      item.appendChild(el('span', '', m.value));
      meta.appendChild(item);
    });
  }

  function renderReminders(session) {
    var list = document.getElementById('reminderList');
    list.textContent = '';
    session.reminders.forEach(function (html) {
      var li = document.createElement('li');
      // Static strings written in this file, never user input.
      li.innerHTML = html;
      list.appendChild(li);
    });
  }

  function renderLogRow(session, item) {
    var stored = loads[session.id + '.' + item.id] || {};
    var row = el('div', 'log-row');

    function field(labelText, key, attrs) {
      var wrap = el('label', 'log-field');
      wrap.appendChild(el('span', '', labelText));
      var input = document.createElement('input');
      Object.keys(attrs).forEach(function (a) { input.setAttribute(a, attrs[a]); });
      input.value = stored[key] || '';
      input.addEventListener('input', function () {
        var id = session.id + '.' + item.id;
        loads[id] = loads[id] || {};
        loads[id][key] = input.value;
        writeJSON(LOAD_KEY, loads);
      });
      wrap.appendChild(input);
      return wrap;
    }

    row.appendChild(field('Band / load', 'load', { type: 'text', maxlength: '24', autocomplete: 'off', placeholder: 'e.g. red, doubled' }));
    row.appendChild(field('Last set reps', 'reps', { type: 'number', inputmode: 'numeric', min: '0', max: '99', placeholder: 'reps' }));
    return row;
  }

  function renderItem(session, item, listEl) {
    var row = el('div', 'exercise-row');
    row.dataset.id = item.id;
    var total = setCount(item);
    var rowKey = session.id + '.' + item.id;
    rowsByKey[rowKey] = row;

    var checkBtn = null;
    if (total === 1) {
      checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'check-btn';
      checkBtn.setAttribute('aria-pressed', 'false');
      checkBtn.setAttribute('aria-label', 'Mark ' + item.name + ' done');
      checkBtn.innerHTML = '&#10003;';
      row.appendChild(checkBtn);
    }

    var body = el('div', 'exercise-body');
    var top = el('div', 'exercise-top');
    top.appendChild(el('h3', 'exercise-name', item.name));
    top.appendChild(el('span', 'exercise-dose', item.dose));
    body.appendChild(top);
    body.appendChild(el('p', 'exercise-cue', item.cue));

    var setBtns = [];
    if (total > 1) {
      var rounds = el('div', 'round-checks');
      for (var n = 1; n <= total; n++) {
        (function (setNo) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'round-btn';
          btn.textContent = 'Set ' + setNo;
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', item.name + ' set ' + setNo);
          btn.addEventListener('click', function () { toggle(session, item, setNo); });
          rounds.appendChild(btn);
          setBtns.push(btn);
        })(n);
      }
      body.appendChild(rounds);
    } else {
      checkBtn.addEventListener('click', function () { toggle(session, item, 0); });
    }

    if (item.log) body.appendChild(renderLogRow(session, item));

    row.appendChild(body);
    listEl.appendChild(row);
    paintItem(session, item, row, checkBtn, setBtns);
    row._checkBtn = checkBtn;
    row._setBtns = setBtns;
  }

  function paintItem(session, item, row, checkBtn, setBtns) {
    var total = setCount(item);
    if (total === 1) {
      var on = isDone(session, item);
      checkBtn.classList.toggle('checked', on);
      checkBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    } else {
      setBtns.forEach(function (btn, i) {
        var set = isDone(session, item, i + 1);
        btn.classList.toggle('checked', set);
        btn.setAttribute('aria-pressed', set ? 'true' : 'false');
      });
    }
    row.classList.toggle('checked', itemComplete(session, item));
  }

  function renderPhases(session) {
    var host = document.getElementById('phases');
    host.textContent = '';
    rowsByKey = {};
    session.phases.forEach(function (phase) {
      var card = el('section', 'phase-card');
      card.setAttribute('aria-labelledby', 'title-' + phase.id);

      var header = el('div', 'card-header');
      var left = document.createElement('div');
      left.appendChild(el('p', 'eyebrow phase-eyebrow', phase.eyebrow));
      var h2 = el('h2', '', phase.title);
      h2.id = 'title-' + phase.id;
      left.appendChild(h2);
      header.appendChild(left);
      var badge = el('span', 'phase-progress', '0/0');
      badge.id = 'progress-' + phase.id;
      header.appendChild(badge);
      card.appendChild(header);

      card.appendChild(el('p', 'card-intro', phase.intro));
      var list = el('div', 'exercise-list');
      phase.items.forEach(function (item) { renderItem(session, item, list); });
      card.appendChild(list);
      host.appendChild(card);
    });
  }

  function refreshProgress() {
    var session = current();
    session.phases.forEach(function (phase) {
      var total = 0;
      var done = 0;
      phase.items.forEach(function (it) { total += setCount(it); done += itemDoneCount(session, it); });
      var badge = document.getElementById('progress-' + phase.id);
      badge.textContent = done + '/' + total;
      badge.classList.toggle('all-done', total > 0 && done === total);
    });

    var t = sessionTotals(session);
    document.getElementById('progressDone').textContent = t.done;
    document.getElementById('progressTotal').textContent = t.total;
    var pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
    document.getElementById('progressPct').textContent = pct + '%';
    document.getElementById('progressFill').style.width = pct + '%';
    var n = counts[session.id] || 0;
    document.getElementById('sessionsCompletedLabel').textContent =
      'Completed ' + n + (n === 1 ? ' time' : ' times') + ' all-time';
  }

  function renderAll() {
    var session = current();
    renderTabs();
    renderHero(session);
    renderPhases(session);
    renderReminders(session);
    refreshProgress();
  }

  // ---------- behaviour ----------

  function toggle(session, item, setNo) {
    var key = keyFor(session, item, setNo);
    var justChecked = !state[key];
    state[key] = justChecked;
    saveState();

    var row = rowsByKey[session.id + '.' + item.id];
    paintItem(session, item, row, row._checkBtn, row._setBtns);
    refreshProgress();

    if (!justChecked) return;
    var totals = sessionTotals(session);
    if (totals.done === totals.total) {
      handleAllComplete(session);
    } else if (itemComplete(session, item)) {
      advanceFrom(session, item);
    }
  }

  // After an exercise is finished, point at the next one that is not.
  function advanceFrom(session, item) {
    var items = allItems(session);
    var idx = items.indexOf(item);
    var next = null;
    for (var step = 1; step < items.length; step++) {
      var candidate = items[(idx + step) % items.length];
      if (!itemComplete(session, candidate)) { next = candidate; break; }
    }
    Object.keys(rowsByKey).forEach(function (k) { rowsByKey[k].classList.remove('active'); });
    if (!next) return;
    var row = rowsByKey[session.id + '.' + next.id];
    if (!row) return;
    row.classList.add('active');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  function handleAllComplete(session) {
    Object.keys(rowsByKey).forEach(function (k) { rowsByKey[k].classList.remove('active'); });
    // Count each run once. The flag is persisted, so a reload followed by an
    // untick-and-retick cannot count the same run twice.
    if (!counted[session.id]) {
      counted[session.id] = true;
      writeJSON(COUNTED_KEY, counted);
      counts[session.id] = (counts[session.id] || 0) + 1;
      writeJSON(SESSIONS_KEY, counts);
      refreshProgress();
    }
    document.getElementById('completionTitle').textContent = 'Well done! ' + session.name + ' complete 🎉';
    document.getElementById('completionSub').textContent =
      'All ' + allItems(session).length + ' exercises logged — that’s ' + session.name.toLowerCase() + ' #' + counts[session.id] + '.';
    document.getElementById('completionBanner').classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function resetChecklist() {
    var session = current();
    Object.keys(state).forEach(function (k) {
      if (k.indexOf(session.id + '.') === 0) delete state[k];
    });
    counted[session.id] = false;
    saveState();
    writeJSON(COUNTED_KEY, counted);
    document.getElementById('completionBanner').classList.add('hidden');
    renderAll();
  }

  function switchTo(id) {
    if (!sessionsById[id] || id === activeId) return;
    setActive(id);
    document.getElementById('completionBanner').classList.add('hidden');
    renderAll();
    window.scrollTo(0, 0);
  }

  // ---------- wiring ----------

  var tabEls = document.querySelectorAll('.session-tab');
  Array.prototype.forEach.call(tabEls, function (tab, i) {
    tab.addEventListener('click', function () { switchTo(tab.getAttribute('data-session')); });
    tab.addEventListener('keydown', function (e) {
      var move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!move) return;
      e.preventDefault();
      var target = tabEls[(i + move + tabEls.length) % tabEls.length];
      switchTo(target.getAttribute('data-session'));
      target.focus();
    });
  });

  document.getElementById('resetButton').addEventListener('click', function () {
    if (confirm('Reset all checkmarks for this session?')) resetChecklist();
  });

  document.getElementById('completionResetButton').addEventListener('click', resetChecklist);

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
