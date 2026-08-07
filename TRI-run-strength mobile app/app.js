(function () {
  'use strict';

  var STORAGE_KEY = 'triRunStrength.progress.v1';
  var SESSIONS_KEY = 'triRunStrength.sessionsCompleted.v1';
  var ROUNDS = 4;

  var mainCircuit = [
    { id: 'e1', name: 'Glute Bridge', dose: '12 reps', cue: 'Feet hip-width, drive through heels, squeeze glutes hard at the top — don’t just lift with the lower back.' },
    { id: 'e2', name: 'Single-Leg RDL', dose: '8 reps each leg', cue: 'Dumbbell in the hand opposite the standing leg; hinge at the hip with a soft knee and flat back, reach the free leg straight behind you.' },
    { id: 'e3', name: 'Reverse Lunge', dose: '10 reps each leg', cue: 'Dumbbells at your sides; step back and drop the back knee toward the floor, drive up through the front heel.' },
    { id: 'e4', name: 'Single-Leg Squat + Jump', dose: '6 reps each leg', cue: 'Squat down on one leg with a forward lean like your running posture, then hop straight up and stick the landing soft on the same leg — builds the ankle stability and pelvic control that keeps your hips level late in a run.' },
    { id: 'e5', name: 'Copenhagen Plank', dose: '20 sec each side', cue: 'Top foot on a bench, forearm on the floor, hips lifted into a straight line — this is adductor strength, not a hip-flexor stretch.' },
    { id: 'e6', name: 'Jump Squat', dose: '20 sec', cue: 'Squat down and explode up; land soft through the mid-foot and reset before the next rep.' },
    { id: 'e7', name: 'Weighted Tiptoe Walk', dose: '20 steps', cue: 'Dumbbell in each hand, rise onto your toes and walk forward keeping a soft bend in the knees — the bent knee shifts the load onto the soleus, the muscle that fatigues late in a run or long ride.' }
  ];

  var totalItems = mainCircuit.length * ROUNDS;
  var rowsById = {};
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

  function roundRange() {
    var rs = [];
    for (var r = 1; r <= ROUNDS; r++) { rs.push(r); }
    return rs;
  }

  function renderRoundsPhase(listEl, exercises) {
    listEl.innerHTML = '';
    rowsById = {};
    exercises.forEach(function (ex, exIndex) {
      var row = document.createElement('div');
      row.className = 'exercise-row';
      row.dataset.id = ex.id;
      rowsById[ex.id] = row;

      var body = document.createElement('div');
      body.className = 'exercise-body';
      body.innerHTML =
        '<div class="exercise-top"><h3 class="exercise-name">' + ex.name + '</h3><span class="exercise-dose">' + ex.dose + '</span></div>' +
        '<p class="exercise-cue">' + ex.cue + '</p>';

      var rounds = document.createElement('div');
      rounds.className = 'round-checks';

      var roundBtns = roundRange().map(function (r) {
        var key = ex.id + '-r' + r;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'round-btn';
        btn.textContent = 'R' + r;
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', ex.name + ' round ' + r);
        btn.addEventListener('click', function () {
          var justChecked = !state[key];
          state[key] = justChecked;
          saveState();
          btn.classList.toggle('checked', !!state[key]);
          btn.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
          row.classList.toggle('checked', roundRange().every(function (n) { return state[ex.id + '-r' + n]; }));
          refreshProgress();

          if (justChecked) {
            if (countDone(mainCircuit) === totalItems) {
              handleAllComplete();
            } else {
              advanceToExercise(exIndex);
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
      row.classList.toggle('checked', roundRange().every(function (n) { return state[ex.id + '-r' + n]; }));
    });
  }

  function countDone(exercises) {
    var done = 0;
    exercises.forEach(function (ex) {
      roundRange().forEach(function (r) { if (state[ex.id + '-r' + r]) done++; });
    });
    return done;
  }

  function refreshProgress() {
    var done = countDone(mainCircuit);

    setPhaseProgress('phaseMainProgress', done, totalItems);

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

  function clearActiveRows() {
    Object.keys(rowsById).forEach(function (id) { rowsById[id].classList.remove('active'); });
  }

  function advanceToExercise(currentIndex) {
    var nextIndex = (currentIndex + 1) % mainCircuit.length;
    var nextRow = rowsById[mainCircuit[nextIndex].id];
    clearActiveRows();
    if (nextRow) {
      nextRow.classList.add('active');
      nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function handleAllComplete() {
    clearActiveRows();
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
    renderRoundsPhase(document.getElementById('phaseMainList'), mainCircuit);
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
