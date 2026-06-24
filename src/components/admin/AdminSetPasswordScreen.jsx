import { useState } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';

export default function AdminSetPasswordScreen({ token }) {
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [status, setStatus]             = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg]         = useState('');
  const [pwFocused, setPwFocused]       = useState(false);
  const [cfFocused, setCfFocused]       = useState(false);

  async function handleSubmit() {
    setErrorMsg('');
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords don\'t match.');
      return;
    }
    setStatus('loading');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setStatus('success');
        setTimeout(() => window.location.replace('/?admin=true'), 1800);
      } else {
        setErrorMsg(data.error || 'Invalid or expired invite');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  const inputStyle = (focused) => ({
    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
    background: AD.bgSurface, color: AD.textPrimary, fontSize: 14,
    fontFamily: AD.fontSans, outline: 'none',
    border: `1.5px solid ${focused ? AD.blueText : AD.border}`,
    borderRadius: AD.radiusMd, transition: 'border-color 0.18s',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${AD.navy} 0%, #01408a 100%)`,
      padding: '32px 24px', fontFamily: AD.fontSans,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto' }} />
      </div>

      <div style={{
        width: '100%', maxWidth: 380,
        background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
        borderRadius: AD.radiusLg, padding: '32px 28px',
        boxShadow: AD.shadowLg,
      }}>
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <i className="ph-fill ph-check-circle" style={{ fontSize: 44, color: AD.greenText, display: 'block', marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 6 }}>Password set!</div>
            <div style={{ fontSize: 14, color: AD.textSecondary }}>Redirecting to sign in…</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: AD.textPrimary, marginBottom: 4 }}>Set your password</div>
              <div style={{ fontSize: 14, color: AD.textSecondary, lineHeight: 1.5 }}>
                Choose a password for your admin account (minimum 8 characters).
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 5 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Min. 8 characters"
                style={inputStyle(pwFocused)}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 5 }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onFocus={() => setCfFocused(true)}
                onBlur={() => setCfFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Re-enter password"
                style={inputStyle(cfFocused)}
              />
            </div>

            {(errorMsg) && (
              <div style={{
                marginTop: 12, padding: '9px 12px', borderRadius: AD.radiusMd,
                background: AD.red2Bg, border: `1px solid ${AD.red2}`,
                color: AD.red2Text, fontSize: 13,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <span style={{ lineHeight: 1.5 }}>
                  {errorMsg}
                  {status === 'error' && (
                    <span style={{ display: 'block', marginTop: 4, color: AD.textSecondary, fontSize: 12 }}>
                      Ask your Owner to resend the invite from the team roster.
                    </span>
                  )}
                </span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              style={{
                width: '100%', marginTop: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px',
                background: status === 'loading'
                  ? AD.bgCardTint
                  : `linear-gradient(135deg, ${AD.red} 0%, ${AD.redDark} 100%)`,
                border: 'none', borderRadius: AD.radiusMd,
                color: status === 'loading' ? AD.textSecondary : '#fff',
                fontSize: 15, fontWeight: 700, fontFamily: AD.fontSans,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                boxShadow: status === 'loading' ? 'none' : '0 4px 14px rgba(204,0,0,0.35)',
                transition: 'all 0.18s',
              }}
            >
              {status === 'loading'
                ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Setting password…</>
                : <><i className="ph ph-lock-key" style={{ fontSize: 16 }} /> Set Password</>
              }
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
