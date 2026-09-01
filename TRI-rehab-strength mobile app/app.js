(function () {
  'use strict';

  var STORAGE_KEY = 'triRehabStrength.progress.v1';
  var SESSIONS_KEY = 'triRehabStrength.sessionsCompleted.v1';
  var SETS = 3;
  var SET_LABELS = ['S1', 'S2', 'S3'];

  var mainCircuit = [
    { id: 'e1', name: 'Seated Soleus Calf Raise', dose: '8–15 reps to fatigue', cue: 'Sit down and place a heavy dumbbell (or use a dedicated machine) across your lower thigh, aligned with the shin. Perform slow, controlled calf raises with the knee bent. Best for acute Achilles pain or a recent calf strain — done 3 to 4 times a week.' },
    { id: 'e2', name: 'Soleus Tiptoe Walk', dose: '10–20 yards', cue: 'Hold heavy dumbbells, squat slightly to bend the knees, then rise onto your tiptoes and walk while maintaining the bent-knee position — chin tucked, spine straight. Best for intermediate strengthening under dynamic load; adjust the dumbbell weight to your current symptoms.' },
    { id: 'e3', name: 'Soleus-Focused Calf Raise (On Step)', dose: 'Full range of motion', cue: 'Stand on the edge of a step, holding a wall for balance, and bend the working knee to 80–90°. Perform slow calf raises through a full range of motion — don’t let the knee straighten as the ankle moves up. Start on both legs if symptoms are severe, then progress to single-leg. Best for advanced strengthening and the final stage of a rehab programme.' }
  ];

  var totalItems = mainCircuit.length * SETS;
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

  function setRange() {
    var rs = [];
    for (var r = 1; r <= SETS; r++) { rs.push(r); }
    return rs;
  }

  function renderSetsPhase(listEl, exercises) {
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

      var sets = document.createElement('div');
      sets.className = 'round-checks';

      var setBtns = setRange().map(function (s) {
        var key = ex.id + '-s' + s;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'round-btn';
        btn.textContent = SET_LABELS[s - 1];
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', ex.name + ' set ' + s);
        btn.addEventListener('click', function () {
          var justChecked = !state[key];
          state[key] = justChecked;
          saveState();
          btn.classList.toggle('checked', !!state[key]);
          btn.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
          row.classList.toggle('checked', setRange().every(function (n) { return state[ex.id + '-s' + n]; }));
          refreshProgress();

          if (justChecked) {
            if (countDone(mainCircuit) === totalItems) {
              handleAllComplete();
            } else {
              advanceToExercise(exIndex);
            }
          }
        });
        sets.appendChild(btn);
        return { btn: btn, key: key };
      });

      body.appendChild(sets);
      row.appendChild(body);
      listEl.appendChild(row);

      setBtns.forEach(function (sb) {
        var checked = !!state[sb.key];
        sb.btn.classList.toggle('checked', checked);
        sb.btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
      });
      row.classList.toggle('checked', setRange().every(function (n) { return state[ex.id + '-s' + n]; }));
    });
  }

  function countDone(exercises) {
    var done = 0;
    exercises.forEach(function (ex) {
      setRange().forEach(function (s) { if (state[ex.id + '-s' + s]) done++; });
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
    renderSetsPhase(document.getElementById('phaseMainList'), mainCircuit);
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
