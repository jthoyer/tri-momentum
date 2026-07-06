import { useState } from 'react';
import { DAYS, SESSION_ICONS, SESSION_LABELS } from '../data/phases.js';

const SESSION_TYPES = ['swim', 'bike', 'run', 'brick', 'strength', 'rest'];

export default function Calendar({ calendar, onCalendarChange, active }) {
  const [selectedType, setSelectedType] = useState('swim');

  function addSession(day) {
    const current = calendar[day] ?? [];
    if (current.length >= 4) return;
    onCalendarChange({ ...calendar, [day]: [...current, selectedType] });
  }

  function removeSession(day, index) {
    const current = [...(calendar[day] ?? [])];
    current.splice(index, 1);
    onCalendarChange({ ...calendar, [day]: current });
  }

  return (
    <div className={`tab-screen${active ? ' active' : ''}`}>
      <div className="page-hdr">
        <div className="page-title">Calendar</div>
        <div className="page-sub">Set up your weekly training template</div>
      </div>

      <div className="tab-scroll">
        <div style={{ padding: '1rem 1rem 0' }}>
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

        <div style={{ padding: '1rem' }}>
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
        </div>
      </div>
    </div>
  );
}
