import { useContext, useMemo, useState } from 'react';
import { BACKEND_URL } from '../../config/contractor';
import { ThemeContext } from '../shared/ThemeProvider';
import { deriveThemeTokens, contrastRatio } from '../../utils/themeTokens.mjs';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import useEntrance from '../../hooks/useEntrance';

// ─── Set a New Password ───────────────────────────────────────────────────────
//
// C/DL-3b Phase 5. Rewritten alongside the unified door, for the same two
// reasons: it was the other Group A file carrying a hardcoded single-tenant logo
// and company name, and it is reached from an emailed link by a person who may
// never have seen this product before — so it is a white-label surface in exactly
// the way the login screen is.
//
// BRANDING FROM ThemeContext (CD-24). This screen renders inside ThemeProvider
// (App.jsx checks `resetToken` inside renderThemedRoute), so the D4 chain has
// already answered. It carries no branding logic of its own and consults no
// source directly.
//
// ⚠ THE PLATFORM LOGO IS THE ONLY FALLBACK, never another contractor's — a
// borrowed logo is a white-label breach, not a fallback. Same rule as
// FrozenAccountScreen, SignupScreen and EmailVerifyScreen.
//
// D12 — the unified 8-character minimum. The `^\d{4}$` era is over: no maxLength
// of 4, no digit coercion, and the word PIN appears nowhere a person can read.
export default function ResetPinScreen({ token }) {
  const { branding, mode } = useContext(ThemeContext);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const cardVisible = useEntrance(80);

  const companyName = branding?.companyName || 'RoofMiles';
  const logoSrc = branding?.logoUrl || roofMilesLogo;

  // See LoginScreen's header: the theme engine guarantees `primary` reads as TEXT
  // on `surface`, not as a background under a label. Same local computation, same
  // reason, and the same 3c follow-up owed.
  const onPrimary = useMemo(() => {
    try {
      const { primary } = deriveThemeTokens(branding, mode || 'light');
      return contrastRatio('#FFFFFF', primary) >= contrastRatio('#111111', primary)
        ? '#FFFFFF'
        : '#111111';
    } catch {
      return '#FFFFFF';
    }
  }, [branding, mode]);

  // The server enforces the same floor (POST /api/reset-pin). This check exists
  // so the person is told before a round trip, not instead of one.
  async function handleSubmit() {
    setError('');
    if (password.length < 8 || confirm.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setStatus('loading');
    try {
      // The wire field is still `pin` — D12 keeps the COLUMN name and rejected the
      // rename as cosmetic. Only what a person reads changed.
      const res = await fetch(`${BACKEND_URL}/api/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: password }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setTimeout(() => {
          window.history.replaceState({}, '', '/');
          window.location.reload();
        }, 1500);
      } else {
        setError(data.error || 'Something went wrong.');
        setStatus('idle');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: 'var(--rm-bg, #FFFFFF)',
    border: `1.5px solid ${focused === field ? 'var(--rm-primary, #F26A1B)' : 'rgba(128,128,128,0.35)'}`,
    borderRadius: 10, padding: '16px 16px 16px 48px',
    color: 'var(--rm-text, #1C2D4D)', fontSize: 15,
    fontFamily: 'Roboto, system-ui, sans-serif', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  });

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8,
    color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
  };

  const iconStyle = (field) => ({
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    fontSize: 16, pointerEvents: 'none', transition: 'color 0.2s',
    color: focused === field ? 'var(--rm-primary, #F26A1B)' : 'var(--rm-text, #1C2D4D)',
    opacity: focused === field ? 1 : 0.5,
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20, padding: '32px 28px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <img
          src={logoSrc}
          alt={companyName}
          style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 20px' }}
        />

        <h2 style={{
          margin: '0 0 8px', fontSize: 22, fontWeight: 700,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Set a new password
        </h2>
        <p style={{
          margin: '0 0 24px', fontSize: 15,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
        }}>
          Choose a password of at least 8 characters.
        </p>

        {status === 'success' ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            backgroundColor: 'var(--rm-success, #DCFCE7)',
            borderRadius: 10, padding: 16, fontSize: 15,
            color: 'var(--rm-success-text, #166534)',
          }}>
            <i className="ph ph-check-circle" style={{ fontSize: 20, flexShrink: 0 }} />
            Password updated! Redirecting to sign in…
          </div>
        ) : (
          <>
            <label htmlFor="rm-reset-password" style={labelStyle}>New password</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <i className="ph ph-lock" style={iconStyle('password')} />
              {/* No digit coercion and no maxLength of 4 (D12). The coercion was
                  not a validator — it stripped letters as the person typed, so a
                  14-character password vanished into a couple of digits with
                  nothing said. Worse, 'abc1234' became '1234', passed the old
                  four-digit check, and silently set the account password to 1234. */}
              <input
                id="rm-reset-password"
                value={password} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                type="password" placeholder="At least 8 characters"
                autoComplete="new-password" maxLength={200}
                style={inputStyle('password')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <label htmlFor="rm-reset-confirm" style={labelStyle}>Confirm password</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <i className="ph ph-lock" style={iconStyle('confirm')} />
              <input
                id="rm-reset-confirm"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                type="password" placeholder="Confirm password"
                autoComplete="new-password" maxLength={200}
                style={inputStyle('confirm')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8,
                backgroundColor: 'var(--rm-danger, #FEE2E2)', borderRadius: 8, padding: '8px 12px',
              }}>
                <i className="ph ph-warning-circle" style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 16, flexShrink: 0 }} />
                <p style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 15, margin: 0 }}>{error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={status === 'loading'} style={{
              width: '100%', marginTop: 16,
              backgroundColor: 'var(--rm-primary, #F26A1B)', color: onPrimary,
              border: 'none', borderRadius: 10, padding: 16,
              fontSize: 15, fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif',
              cursor: status === 'loading' ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.2s, opacity 0.2s',
              transform: status === 'loading' ? 'scale(0.98)' : 'scale(1)',
              opacity: status === 'loading' ? 0.85 : 1,
            }}>
              {status === 'loading'
                ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'rmSpin 0.8s linear infinite' }} /> Setting password…</>
                : <><i className="ph ph-check" style={{ fontSize: 16 }} /> Set password</>
              }
            </button>
          </>
        )}
      </div>

      <p style={{
        marginTop: 24, marginBottom: 0, fontSize: 12,
        fontFamily: 'Roboto Mono, ui-monospace, monospace', letterSpacing: '0.06em',
        color: 'var(--rm-text, #1C2D4D)', opacity: 0.45, textTransform: 'uppercase',
      }}>
        {companyName}
      </p>

      <style>{`
        @keyframes rmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
