import { useState } from 'react';
import { DAYS, SESSION_ICONS, SESSION_LABELS } from '../data/phases.js';
import { DEFAULT_BLOCK_CONFIG } from '../lib/tipResolver.js';

const SESSION_TYPES = ['swim', 'bike', 'run', 'brick', 'strength', 'rest'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(null);
  const [trainingStart, setTrainingStart] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [blockConfig, setBlockConfig] = useState({ ...DEFAULT_BLOCK_CONFIG });
  const [calendar, setCalendar] = useState({});
  const [selectedType, setSelectedType] = useState('swim');

  const totalSteps = mode === 'race' ? 5 : 4;

  function weeksToRace() {
    if (!raceDate || !trainingStart) return null;
    const ms = new Date(raceDate) - new Date(trainingStart);
    return Math.round(ms / (1000 * 60 * 60 * 24 * 7));
  }

  function addSession(day) {
    const current = calendar[day] ?? [];
    if (current.length >= 4) return;
    setCalendar({ ...calendar, [day]: [...current, selectedType] });
  }

  function removeSession(day, index) {
    const current = [...(calendar[day] ?? [])];
    current.splice(index, 1);
    setCalendar({ ...calendar, [day]: current });
  }

  function handleFinish() {
    onComplete({ mode, trainingStart, raceDate: mode === 'race' ? raceDate : null, blockConfig, calendar });
  }

  const canProceed = () => {
    if (step === 1) return !!mode;
    if (step === 2) return !!trainingStart;
    if (step === 3 && mode === 'race') return !!raceDate;
    return true;
  };

  return (
    <div className="app-shell">
      <div className="ob-wrap">
        <div className="ob-logo">
          <div className="ob-logo-boxes">
            {['T', 'R', 'I'].map(l => <div key={l} className="ob-logo-box">{l}</div>)}
          </div>
          <div>
            <div className="ob-logo-name">TRI Momentum</div>
            <div className="ob-logo-tag">Training intelligence</div>
          </div>
        </div>

        {step === 1 && (
          <>
            <div className="ob-title">How are you training?</div>
            <div className="ob-sub">This sets how the app resolves your training position and surfaces the right prompts.</div>
            <div className="ob-section">
              <div className="mode-cards">
                <div className={`mode-card${mode === 'race' ? ' sel' : ''}`} onClick={() => setMode('race')}>
                  <div className="mode-card-icon">🏁</div>
                  <div>
                    <div className="mode-card-title">Race mode</div>
                    <div className="mode-card-desc">You have a target race. The app tracks your proximity and adjusts tip content as race day approaches.</div>
                  </div>
                </div>
                <div className={`mode-card${mode === 'general' ? ' sel' : ''}`} onClick={() => setMode('general')}>
                  <div className="mode-card-icon">📈</div>
                  <div>
                    <div className="mode-card-title">General training</div>
                    <div className="mode-card-desc">No specific race target. The app cycles through the training block structure without race-proximity overlays.</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-title">When did your training block start?</div>
            <div className="ob-sub">This anchors your phase and week position. Choose the Monday of the week you started structured training.</div>
            <div className="ob-section">
              <div className="ob-label">Training start date</div>
              <input
                type="date"
                className="date-inp"
                value={trainingStart}
                onChange={e => setTrainingStart(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 3 && mode === 'race' && (
          <>
            <div className="ob-title">When is your race?</div>
            <div className="ob-sub">The app activates proximity overlays in the final 21 days. Race week and race day content replaces the standard tip system entirely.</div>
            <div className="ob-section">
              <div className="ob-label">Race date</div>
              <div className="date-row">
                <input
                  type="date"
                  className="date-inp"
                  value={raceDate}
                  onChange={e => setRaceDate(e.target.value)}
                  min={trainingStart}
                />
                {weeksToRace() && (
                  <div className="weeks-badge">{weeksToRace()}w to race</div>
                )}
              </div>
            </div>
          </>
        )}

        {(step === (mode === 'race' ? 4 : 3)) && (
          <>
            <div className="ob-title">Set your block structure</div>
            <div className="ob-sub">How many weeks in each phase? The block repeats. Recovery is always 1 week.</div>
            <div className="ob-section">
              {[
                { key: 'base',  label: 'Base',  min: 1, max: 8 },
                { key: 'build', label: 'Build', min: 1, max: 4 },
                { key: 'peak',  label: 'Peak',  min: 1, max: 4 },
              ].map(({ key, label, min, max }) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <div className="ob-label">{label} — {blockConfig[key]} week{blockConfig[key] !== 1 ? 's' : ''}</div>
                  <input
                    type="range" min={min} max={max}
                    value={blockConfig[key]}
                    onChange={e => setBlockConfig({ ...blockConfig, [key]: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
              <div className="ob-label">Recovery — 1 week (fixed)</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
                Total block: {blockConfig.base + blockConfig.build + blockConfig.peak + 1} weeks
              </div>
            </div>
          </>
        )}

        {(step === (mode === 'race' ? 5 : 4)) && (
          <>
            <div className="ob-title">Build your weekly template</div>
            <div className="ob-sub">Tap a session type, then tap a day to add it. You can edit this later in the Calendar tab.</div>
            <div className="ob-section">
              <div className="ob-label">Session type</div>
              <div className="type-strip">
                {SESSION_TYPES.map(type => (
                  <button
                    key={type}
                    className={`type-chip${selectedType === type ? ` active-${type}` : ''}`}
                    onClick={() => setSelectedType(type)}
                  >
                    {SESSION_ICONS[type]} {SESSION_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="cal-grid">
              {DAYS.map(day => {
                const sessions = calendar[day] ?? [];
                return (
                  <div key={day} className="cal-day-block">
                    <div className="cal-day-lbl">{day}</div>
                    <div className="cal-day-slots">
                      {sessions.map((type, i) => (
                        <div key={i} className={`slot has-session ${type}`}>
                          <span className="slot-icon">{SESSION_ICONS[type]}</span>
                          <span className="slot-txt">{type.slice(0,2).toUpperCase()}</span>
                          <button className="slot-del" onClick={(e) => { e.stopPropagation(); removeSession(day, i); }}>×</button>
                        </div>
                      ))}
                      {sessions.length < 4 && (
                        <div className="slot add-slot" onClick={() => addSession(day)}>+</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {step < totalSteps ? (
            <button className="cta-btn" onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Continue
            </button>
          ) : (
            <button className="cta-btn" onClick={handleFinish}>
              Start training
            </button>
          )}
          {step > 1 && (
            <button className="ghost-btn" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          <div style={{ textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--ink3)', letterSpacing: '.1em' }}>
            STEP {step} OF {totalSteps}
          </div>
        </div>
      </div>
    </div>
  );
}
