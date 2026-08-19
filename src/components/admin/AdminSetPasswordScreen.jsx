import { useState } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';

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
        // Bare '/' — `?admin=true` was dropped in C/DL-3b Phase 5. Nothing reads
        // it any more: routing is by identity, so this invitee lands on the
        // unified door and signs in with the password they just set.
        //
        // ⚠ THIS IS THE ONE PLACE IN THE APP THAT DESTROYS THE QUERY STRING on the
        // way to the panel — window.location.replace is a real navigation, unlike
        // signing in, which only flips React state. Harmless here (an invite link
        // carries no deep-link parameter), but it is the shape that would break
        // the Stripe Connect return if this pattern were ever copied onto the
        // login path. src/components/auth/deepLinkSurvival.test.jsx pins that.
        setTimeout(() => window.location.replace('/'), 1800);
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
      background: `linear-gradient(160deg, ${AD.navy} 0%, #2A4270 100%)`,
      padding: '32px 24px', fontFamily: AD.fontSans,
    }}>
      {/* ── 5.3: THE PLATFORM MARK, BECAUSE THE CONTRACTOR IS NOT RESOLVABLE ──
          ⚠ THE REASON IS A CONSTRAINT, NOT A DESIGN RULING. An earlier version of
          this comment said the mark stays because the screen is "admin-facing and
          co-branded per §1". §1 is CONSISTENT with the outcome but does not
          explain it, and stating it as the cause would leave a future session
          thinking this was a taste call that could simply be reversed.

          THE TENANT IS KNOWABLE — SERVER-SIDE ONLY. An invite is generated per
          contractor, and team_member_invite_tokens.team_member_id joins to
          team_members.contractor_id, so the backend can always say whose invite
          this is. But the ONLY route touching an invite token is
          POST /api/admin/team/accept-invite, which CONSUMES it. There is no GET,
          so at render time this screen holds an opaque string and nothing else.
          It also mounts ABOVE ThemeProvider (App.jsx, Ruling 5), so there is no
          branding context to read even if one existed.

          ⚠ AND ADDING THAT GET IS NOT FREE. The accept route returns a single
          GENERIC_INVALID for every failure mode — expired, used, nonexistent —
          which is enumeration-safe by design. An unauthenticated
          GET /api/admin/team/invite/:token/branding would answer "is this token
          valid?" by whether branding comes back, on a surface anyone can probe
          with guessed tokens. That trades a real oracle on the invite path for a
          logo on a single-use screen.

          ── THE REVISIT CONDITION ─────────────────────────────────────────
          If a SAFE token->branding path ever exists — an authenticated one, or one
          returning branding only alongside a SUCCESSFUL accept — then the
          contractor's mark becomes the better answer here: the invitee works for
          that contractor, and the two sibling auth screens already carry it.
          ⚠ REUSE THE SHIPPED PATTERN, DO NOT DESIGN A SECOND ONE. SignupScreen and
          EmailVerifyScreen both do `branding?.logoUrl || roofMilesLogo` inside the
          card — contractor's mark when one resolves, platform mark when none does.
          That is the whole mechanism.

          ── THE ASPECT RATIO CHANGED WITH THE ASSET ───────────────────────
          The retired rooster was 1024x1024, so width:180 rendered a 180x180
          square. roofmiles_logo_png is 400x120, so the same width:180 now renders
          180x54 — 126px shorter. The wrapper centres on both axes with
          justifyContent: 'center' and nothing is positioned against the old
          height, so the column simply re-centres. */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <img src={roofMilesLogo} alt="RoofMiles" style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto' }} />
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
                boxShadow: status === 'loading' ? 'none' : '0 4px 14px rgba(220,38,38,0.35)',
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
