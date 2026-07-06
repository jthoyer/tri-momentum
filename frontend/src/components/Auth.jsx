import { useState } from 'react';

export default function Auth({ onSkip }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleMagicLink(e) {
    e.preventDefault();
    setSent(true);
  }

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

        <div className="ob-title">Sign in to sync</div>
        <div className="ob-sub">
          Save your reflections and training data across devices. Sign in with a magic link — no password needed.
        </div>

        {sent ? (
          <div style={{ background: 'var(--bike-l)', border: '1px solid var(--bike)', borderRadius: 'var(--rlg)', padding: '1rem 1.25rem' }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--bike)', marginBottom: 6 }}>Check your inbox</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
              We sent a sign-in link to <strong>{email}</strong>. Tap it on any device to sign in.
            </div>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="ob-label">Email address</div>
            <input
              type="email"
              className="date-inp"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button className="cta-btn" type="submit" disabled={!email}>
              Send magic link
            </button>
          </form>
        )}

        <div className="divider" />

        <button className="ghost-btn" onClick={onSkip}>
          Continue without signing in
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>
          Without an account, your data stays on this device only.
        </div>
      </div>
    </div>
  );
}
