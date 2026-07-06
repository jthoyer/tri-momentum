import PhasePill from './shared/PhasePill.jsx';
import SessionCard from './shared/SessionCard.jsx';
import { CADENCE_INSIGHTS } from '../data/insights.js';

export default function Today({ profile, calendar, sessionStatuses, onStatusChange, active }) {
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = dayNames[today.getDay()];

  const dateLabel = today.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();

  const todaySessions = (calendar[todayName] ?? []).filter(Boolean);

  const currentCadence = profile?.currentCadence ?? 'base';
  const insightText = CADENCE_INSIGHTS[currentCadence];

  return (
    <div className={`tab-screen${active ? ' active' : ''}`}>
      <div className="page-hdr">
        <div className="today-hdr-inner">
          <div>
            <div className="today-date">{dateLabel}</div>
            <div className="page-title">Today</div>
          </div>
          {profile?.phase && (
            <PhasePill phase={profile.phase} position={profile.phasePosition} />
          )}
        </div>
      </div>

      <div className="tab-scroll">
        {insightText && (
          <div className="insight-card">
            <div className="insight-label">This week's focus</div>
            <div className="insight-text">{insightText}</div>
          </div>
        )}

        {todaySessions.length > 0 ? (
          <div className="session-cards">
            {todaySessions.map((type, i) => (
              <SessionCard
                key={i}
                sessionType={type}
                day={todayName}
                status={sessionStatuses?.[`${todayName}_${i}`] ?? null}
                onStatusChange={(s) => onStatusChange(`${todayName}_${i}`, s)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-today">
            <div className="empty-icon">😴</div>
            <div className="empty-title">Rest day</div>
            <div className="empty-desc">No sessions scheduled for today. Recovery is training too.</div>
          </div>
        )}

        <div className="cadence-section">
          <div className="cadence-title">This week's cadence</div>
          <div className="cadence-grid">
            {['base', 'build', 'peak', 'taper'].map(c => (
              <button
                key={c}
                className={`cadence-btn${currentCadence === c ? ` sel-${c}` : ''}`}
                onClick={() => profile?.onCadenceChange?.(c)}
              >
                <span className="c-name">{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                <span className="c-desc">{cadenceDesc[c]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const cadenceDesc = {
  base:  'Foundation aerobic work',
  build: 'Threshold and sweetspot',
  peak:  'Race-specific intensity',
  taper: 'Volume down, sharpness up',
};
