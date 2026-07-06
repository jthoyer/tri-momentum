import { useState } from 'react';
import { ALL_PILLARS, PILLAR_LABELS, resolveTip } from '../lib/tipResolver.js';
import { CARD_CONTENT } from '../data/tips.js';

export default function Tips({ profile, active }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const phase    = profile?.phase          ?? 'base';
  const position = profile?.phasePosition  ?? 'early';
  const emphasis = profile?.emphasisPillar ?? 'foundations';

  const days = ['tue', 'thu', 'sun'];
  const dayLabels = { tue: 'Tuesday', thu: 'Thursday', sun: 'Sunday' };

  const pillars = activeFilter === 'all' ? ALL_PILLARS : [activeFilter];

  return (
    <div className={`tab-screen${active ? ' active' : ''}`}>
      <div className="page-hdr">
        <div className="page-eyebrow">
          {phase.charAt(0).toUpperCase() + phase.slice(1)} · {position}
        </div>
        <div className="page-title">Tips</div>
        <div className="page-sub">Focus: {PILLAR_LABELS[emphasis]}</div>
      </div>

      <div className="tips-filter">
        <button
          className={`tf-btn${activeFilter === 'all' ? ' active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        {ALL_PILLARS.map(p => (
          <button
            key={p}
            className={`tf-btn${activeFilter === p ? ' active' : ''}`}
            onClick={() => setActiveFilter(p)}
          >
            {PILLAR_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="tab-scroll">
        {pillars.map(pillar => {
          const hasTips = days.some(day => resolveTip(CARD_CONTENT, phase, position, pillar, day));
          if (!hasTips) return null;

          return (
            <div key={pillar} className="week-tip-group">
              <div className="wtg-phase">
                <span className={`wtc-pillar p${ALL_PILLARS.indexOf(pillar) + 1}`}>
                  {PILLAR_LABELS[pillar]}
                </span>
                {pillar === emphasis && <span style={{ fontSize: 9, color: 'var(--ink3)', fontFamily: 'var(--fm)' }}>EMPHASIS</span>}
              </div>
              {days.map(day => {
                const tip = resolveTip(CARD_CONTENT, phase, position, pillar, day);
                if (!tip) return null;
                return (
                  <TipCard key={day} day={day} dayLabel={dayLabels[day]} tip={tip} pillarIdx={ALL_PILLARS.indexOf(pillar)} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TipCard({ day, dayLabel, tip, pillarIdx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`week-tip-card${open ? ' expanded' : ''}`} onClick={() => setOpen(!open)}>
      <div className="wtc-hdr">
        <span className="wtc-num">{dayLabel}</span>
        <span className={`wtc-pillar p${pillarIdx + 1}`} style={{ display: 'none' }} />
        <span className={`wtc-chevron${open ? ' open' : ''}`}>▾</span>
      </div>
      <div className="wtc-title">{tip.title}</div>
      {open && (
        <div className="wtc-body on">
          <div className="dpc-mechanism">{tip.mech}</div>
          <div className="wtc-prompt">{tip.prompt}</div>
        </div>
      )}
    </div>
  );
}
