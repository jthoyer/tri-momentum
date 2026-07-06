export default function PhasePill({ phase, position }) {
  const labels = {
    base:     'Base',
    build:    'Build',
    peak:     'Peak',
    recovery: 'Recovery',
  };

  const positionLabels = {
    early: 'Early',
    mid:   'Mid',
    late:  'Late',
    only:  '',
  };

  const label = [
    labels[phase] ?? phase,
    positionLabels[position],
  ].filter(Boolean).join(' — ');

  return (
    <span className={`week-phase-pill phase-${phase}`}>
      {label}
    </span>
  );
}
