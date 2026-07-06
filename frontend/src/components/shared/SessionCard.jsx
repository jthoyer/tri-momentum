import { SESSION_ICONS, SESSION_LABELS } from '../../data/phases.js';

export default function SessionCard({ sessionType, day, status, onStatusChange }) {
  const icon  = SESSION_ICONS[sessionType]  ?? '?';
  const label = SESSION_LABELS[sessionType] ?? sessionType;

  return (
    <div className="session-card">
      <div className="session-card-hdr">
        <span className={`session-type-dot dot-${sessionType}`} />
        <span className="session-card-name">{icon} {label}</span>
        <span className="session-card-day">{day}</span>
      </div>
      <div className="status-row">
        {['done', 'modified', 'skipped'].map(s => (
          <button
            key={s}
            className={`status-btn${status === s ? ` ${s === 'done' ? 'done' : s === 'skipped' ? 'skip' : 'mod'}-active` : ''}`}
            onClick={() => onStatusChange(s === status ? null : s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
