export default function Upgrade({ onClose, variant }) {
  const heading = variant === 'trend'
    ? 'Unlock your trend data'
    : 'TRI Momentum Pro';

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(14,16,32,0.4)', zIndex: 40 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: '#fff', borderRadius: 'var(--rxl) var(--rxl) 0 0',
        padding: '1.5rem 1.25rem 2rem', zIndex: 50,
        boxShadow: '0 -8px 32px rgba(14,16,32,0.12)',
      }}>
        <div style={{
          width: 40, height: 4, background: 'var(--bd2)', borderRadius: 2,
          margin: '-0.5rem auto 1.25rem',
        }} />

        <div style={{ fontFamily: 'var(--fm)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
          Upgrade
        </div>
        <div style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 600, letterSpacing: '-.3px', color: 'var(--ink)', marginBottom: 8 }}>
          {heading}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65, marginBottom: 20 }}>
          Unlock Build, Peak and Recovery phases, race-proximity overlays, full reflection persistence, and trend analytics.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <button className="cta-btn">
            $9.99 / month — Start free trial
          </button>
          <button className="ghost-btn">
            $79 / year — Best value
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.05em', paddingTop: 4 }}
        >
          Not now
        </button>
      </div>
    </>
  );
}
