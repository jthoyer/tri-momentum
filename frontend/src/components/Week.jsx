import { useState } from 'react';

export default function Week({ profile, weekNum, tips, active }) {
  const [expanded, setExpanded] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [greyZone, setGreyZone] = useState(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const days = ['tue', 'thu', 'sun'];
  const dayLabels = { tue: 'Tuesday', thu: 'Thursday', sun: 'Sunday' };

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className={`tab-screen${active ? ' active' : ''}`}>
      <div className="page-hdr">
        <div className="page-eyebrow">Week {weekNum ?? 1}</div>
        <div className="page-title">This week</div>
        {profile?.phase && (
          <div className="page-sub">
            {profile.phase.charAt(0).toUpperCase() + profile.phase.slice(1)} phase
            {profile.emphasisPillar ? ` · ${profile.emphasisPillar}` : ''}
          </div>
        )}
      </div>

      <div className="tab-scroll">
        <div className="week-cards">
          {days.map(day => {
            const tip = tips?.[day];
            if (!tip) return null;
            const isOpen = expanded === day;
            return (
              <div key={day} className="day-prompt-card">
                <div className="dpc-hdr" onClick={() => setExpanded(isOpen ? null : day)}>
                  <div className={`dpc-day ${day}`}>{dayLabels[day]}</div>
                  <div className="dpc-title">{tip.title}</div>
                  <div className={`dpc-chevron${isOpen ? ' open' : ''}`}>▾</div>
                </div>
                {isOpen && (
                  <div className="dpc-body on">
                    <div className="dpc-mechanism">{tip.mech}</div>
                    <div className="dpc-prompt">{tip.prompt}</div>
                    {(tip.good || tip.med) && (
                      <>
                        <div className="dpc-label">The contrast</div>
                        <div className="contrast-pair">
                          {tip.good && (
                            <div className="cp-cell cp-good">
                              <div className="cp-lbl g">Sharp</div>
                              <div className="cp-txt">{tip.good}</div>
                            </div>
                          )}
                          {tip.med && (
                            <div className="cp-cell cp-mid">
                              <div className="cp-lbl m">Mediocre</div>
                              <div className="cp-txt">{tip.med}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {day === 'sun' && (
                      <div className="sun-refl">
                        <div className="sun-refl-title">Weekly reflection</div>

                        <div className="ob-label">Readiness 1–10</div>
                        <div className="rating-strip">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <button key={n} className={`rb${readiness === n ? ' sel' : ''}`} onClick={() => setReadiness(n)}>
                              {n}
                            </button>
                          ))}
                        </div>

                        <div className="ob-label" style={{ marginTop: '12px' }}>Grey zone %</div>
                        <div className="gz-btns">
                          {[10, 30, 50, 70].map(pct => (
                            <button key={pct} className={`gzb${greyZone === pct ? ' sel' : ''}`} onClick={() => setGreyZone(pct)}>
                              {pct}%
                            </button>
                          ))}
                        </div>

                        <div className="ob-label" style={{ marginTop: '12px' }}>Notes</div>
                        <textarea
                          className="refl-ta"
                          placeholder="What happened this week?"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                        />
                        <button className="save-refl-btn" onClick={handleSave}>
                          Save reflection
                        </button>
                        {saved && <div className="saved-badge">Saved ✓</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
