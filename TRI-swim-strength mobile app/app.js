(function () {
  'use strict';

  var STORAGE_KEY = 'triSwimStrength.progress.v1';
  var SESSIONS_KEY = 'triSwimStrength.sessionsCompleted.v1';

  var phase1 = [
    { id: 'w1', name: 'Arm Circles + Band Pec Stretch', dose: '2 min', cue: 'Perform forward/backward circles; stretch chest by holding band behind back.' },
    { id: 'w2', name: 'Band Lat Stretch', dose: '1 min each side', cue: 'Anchor band low; kneel and reach forward to feel the lat stretch.' },
    { id: 'w3', name: 'Standing Core Twists', dose: '2 min', cue: 'Hold band at chest height; twist torso side-to-side with control.' },
    { id: 'w4', name: 'Light Band Rows', dose: '2 x 15 reps', cue: 'Anchor at waist height; squeeze shoulder blades together.' }
  ];

  var phase2 = [
    { id: 'm1', name: 'Standing Band Row', dose: '3 x 12 reps', cue: 'Pull: Squeeze scapulae; slow, controlled return.' },
    { id: 'm2', name: 'Band Pull-Apart', dose: '3 x 15 reps', cue: 'Shoulder Health: Keep arms straight; pull band to chest.' },
    { id: 'm3', name: 'Overhead Band Press', dose: '3 x 10 reps', cue: 'Catch: Controlled descent; full extension overhead.' },
    { id: 'm4', name: 'Single-Arm Band Row', dose: '3 x 10 each arm', cue: 'Balance: Stabilise core; twist slightly to engage lat.' },
    { id: 'm5', name: 'Band Triceps Pushdown', dose: '3 x 15 reps', cue: 'Finish: Squeeze triceps at full extension.' },
    { id: 'm6', name: 'Band Bicep Curl', dose: '3 x 12 reps', cue: 'Pull Start: Isolate elbow flexion.' },
    { id: 'm7', name: 'Band Rotator Cuff (Ext.)', dose: '3 x 10 each arm', cue: 'Stabilise: Keep elbows pinned to sides.' },
    { id: 'm8', name: 'Standing Band Chest Press', dose: '3 x 12 reps', cue: 'Power: Drive forward from chest.' },
    { id: 'm9', name: 'Band Lateral Raise', dose: '3 x 10 reps', cue: 'Stability: Control the movement, avoid swinging.' },
    { id: 'm10', name: 'Band Woodchop (Diag. Down)', dose: '3 x 10 each side', cue: 'Core Rotation: Engage obliques and hips.' },
    { id: 'm11', name: 'Band Woodchop (Diag. Up)', dose: '3 x 10 each side', cue: 'Core Rotation: Engage obliques and hips.' },
    { id: 'm12', name: 'Band Pallof Press', dose: '3 x 10 each side', cue: 'Anti-Rotation: Resist the band’s pull; hold for 2 sec.' },
    { id: 'm13', name: 'Band Deadlift', dose: '3 x 12 reps', cue: 'Hinge: Stand on band; drive hips forward.' },
    { id: 'm14', name: 'Band Squat to Press', dose: '3 x 10 reps', cue: 'Full Body: Combine squat with overhead press.' },
    { id: 'm15', name: 'Band Bent-Over Row', dose: '3 x 12 reps', cue: 'Posture: Hinge at hips; pull band to lower ribs.' }
  ];

  var phase3 = [
    { id: 'c1', name: 'Band Plank Taps', dose: '1 min', cue: 'Plank with band around wrists; tap opposite shoulder.' },
    { id: 'c2', name: 'Band Glute Bridge', dose: '1 min', cue: 'Band above knees; drive hips up, push knees out.' },
    { id: 'c3', name: 'Band Russian Twist', dose: '1 min', cue: 'Sit with band secured; rotate torso with control.' },
    { id: 'c4', name: 'Static Stretching', dose: '2 min', cue: 'Pectoral, lat, triceps, and hamstring stretches.' }
  ];

  var totalItems = phase1.length + phase2.length * 3 + phase3.length;
  var ROUND_LABELS = ['R1 · Form', 'R2 · Power', 'R3 · Endurance & speed'];
  var phase2RowsById = {};
  var sessionLogged = false;

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getSessionsCompleted() {
    var raw = localStorage.getItem(SESSIONS_KEY);
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  function setSessionsCompleted(n) {
    try {
      localStorage.setItem(SESSIONS_KEY, String(n));
    } catch (e) {}
  }

  function renderSimplePhase(listEl, exercises) {
    listEl.innerHTML = '';
    exercises.forEach(function (ex) {
      var row = document.createElement('div');
      row.className = 'exercise-row';
      row.dataset.id = ex.id;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'check-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Mark ' + ex.name + ' done');
      btn.innerHTML = '&#10003;';
      btn.addEventListener('click', function () {
        var justChecked = !state[ex.id];
        state[ex.id] = justChecked;
        saveState();
        updateRow(row, btn, !!state[ex.id]);
        refreshProgress();
        if (justChecked && countDone(phase1, false) + countDone(phase2, true) + countDone(phase3, false) === totalItems) {
          handleAllComplete();
        }
      });

      var body = document.createElement('div');
      body.className = 'exercise-body';
      body.innerHTML =
        '<div class="exercise-top"><h3 class="exercise-name">' + ex.name + '</h3><span class="exercise-dose">' + ex.dose + '</span></div>' +
        '<p class="exercise-cue">' + ex.cue + '</p>';

      row.appendChild(btn);
      row.appendChild(body);
      listEl.appendChild(row);

      updateRow(row, btn, !!state[ex.id]);
    });
  }

  function updateRow(row, btn, checked) {
    row.classList.toggle('checked', checked);
    btn.classList.toggle('checked', checked);
    btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
  }

  function renderRoundsPhase(listEl, exercises) {
    listEl.innerHTML = '';
    phase2RowsById = {};
    exercises.forEach(function (ex, exIndex) {
      var row = document.createElement('div');
      row.className = 'exercise-row';
      row.dataset.id = ex.id;
      phase2RowsById[ex.id] = row;

      var body = document.createElement('div');
      body.className = 'exercise-body';
      body.innerHTML =
        '<div class="exercise-top"><h3 class="exercise-name">' + ex.name + '</h3><span class="exercise-dose">' + ex.dose + '</span></div>' +
        '<p class="exercise-cue">' + ex.cue + '</p>';

      var rounds = document.createElement('div');
      rounds.className = 'round-checks';

      var roundBtns = [1, 2, 3].map(function (r) {
        var key = ex.id + '-r' + r;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'round-btn';
        btn.textContent = ROUND_LABELS[r - 1];
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', ex.name + ' ' + ROUND_LABELS[r - 1]);
        btn.addEventListener('click', function () {
          var justChecked = !state[key];
          state[key] = justChecked;
          saveState();
          btn.classList.toggle('checked', !!state[key]);
          btn.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
          row.classList.toggle('checked', [1, 2, 3].every(function (n) { return state[ex.id + '-r' + n]; }));
          refreshProgress();

          if (justChecked) {
            if (countDone(phase1, false) + countDone(phase2, true) + countDone(phase3, false) === totalItems) {
              handleAllComplete();
            } else {
              advanceToNextPhase2Exercise(exIndex);
            }
          }
        });
        rounds.appendChild(btn);
        return { btn: btn, key: key };
      });

      body.appendChild(rounds);
      row.appendChild(body);
      listEl.appendChild(row);

      roundBtns.forEach(function (rb) {
        var checked = !!state[rb.key];
        rb.btn.classList.toggle('checked', checked);
        rb.btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
      });
      row.classList.toggle('checked', [1, 2, 3].every(function (n) { return state[ex.id + '-r' + n]; }));
    });
  }

  function advanceToNextPhase2Exercise(currentIndex) {
    var nextIndex = (currentIndex + 1) % phase2.length;
    var nextRow = phase2RowsById[phase2[nextIndex].id];
    Object.keys(phase2RowsById).forEach(function (id) { phase2RowsById[id].classList.remove('active'); });
    if (nextRow) {
      nextRow.classList.add('active');
      nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function countDone(exercises, rounds) {
    var done = 0;
    exercises.forEach(function (ex) {
      if (rounds) {
        [1, 2, 3].forEach(function (r) { if (state[ex.id + '-r' + r]) done++; });
      } else if (state[ex.id]) {
        done++;
      }
    });
    return done;
  }

  function refreshProgress() {
    var d1 = countDone(phase1, false);
    var d2 = countDone(phase2, true);
    var d3 = countDone(phase3, false);
    var done = d1 + d2 + d3;

    setPhaseProgress('phase1Progress', d1, phase1.length);
    setPhaseProgress('phase2Progress', d2, phase2.length * 3);
    setPhaseProgress('phase3Progress', d3, phase3.length);

    document.getElementById('progressDone').textContent = done;
    document.getElementById('progressTotal').textContent = totalItems;
    var pct = totalItems ? Math.round((done / totalItems) * 100) : 0;
    document.getElementById('progressPct').textContent = pct + '%';
    document.getElementById('progressFill').style.width = pct + '%';
  }

  function setPhaseProgress(elId, done, total) {
    var el = document.getElementById(elId);
    el.textContent = done + '/' + total;
    el.classList.toggle('all-done', done === total);
  }

  function renderSessionsCompleted() {
    document.getElementById('sessionsCompleted').textContent = getSessionsCompleted();
  }

  function handleAllComplete() {
    Object.keys(phase2RowsById).forEach(function (id) { phase2RowsById[id].classList.remove('active'); });
    if (!sessionLogged) {
      sessionLogged = true;
      var next = getSessionsCompleted() + 1;
      setSessionsCompleted(next);
      renderSessionsCompleted();
      document.getElementById('completionCount').textContent = next;
    }
    document.getElementById('completionBanner').classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function resetChecklist() {
    state = {};
    sessionLogged = false;
    saveState();
    document.getElementById('completionBanner').classList.add('hidden');
    renderAll();
  }

  function renderAll() {
    renderSimplePhase(document.getElementById('phase1List'), phase1);
    renderRoundsPhase(document.getElementById('phase2List'), phase2);
    renderSimplePhase(document.getElementById('phase3List'), phase3);
    refreshProgress();
    renderSessionsCompleted();
  }

  document.getElementById('resetButton').addEventListener('click', function () {
    if (confirm('Reset all checkmarks for this session?')) {
      resetChecklist();
    }
  });

  document.getElementById('completionResetButton').addEventListener('click', function () {
    resetChecklist();
  });

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
