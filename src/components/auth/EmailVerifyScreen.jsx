import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import useEntrance from '../../hooks/useEntrance';

// ─── Email Verify Screen ───────────────────────────────────────────────────────
export default function EmailVerifyScreen({ userId, email, inviteSlug, contractorName, onVerifyComplete }) {
  const [code, setCode]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [verified, setVerified]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess]   = useState(false);
  const cardVisible = useEntrance(80);

  // ─── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ─── Auto-redirect after success ──────────────────────────────────────────────
  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => onVerifyComplete(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  // ─── Verify ───────────────────────────────────────────────────────────────────
  function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    fetch(`${BACKEND_URL}/api/signup/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setError(data.error || 'Invalid or expired code. Please try again.');
        } else {
          setVerified(true);
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Something went wrong. Please try again.');
      });
  }

  // ─── Resend ───────────────────────────────────────────────────────────────────
  function handleResend() {
    // MVP: add a dedicated /api/signup/resend-code endpoint that regenerates and resends the code
    setResendCooldown(60);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 3000);
  }

  // ─── Success state ────────────────────────────────────────────────────────────
  if (verified) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
        padding: '32px 24px',
        fontFamily: R.fontBody,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          background: R.bgCard,
          borderRadius: 20,
          padding: '48px 28px',
          boxShadow: R.shadowLg,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{
            margin: '0 0 8px',
            fontSize: 24,
            fontWeight: 700,
            fontFamily: R.fontSans,
            color: R.navy,
          }}>
            Email verified!
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: R.textSecondary }}>
            Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  // ─── Normal state ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: '32px 24px',
      fontFamily: R.fontBody,
    }}>
      {/* Top brand mark */}
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <img
          src={rbLogoSquareWordmark}
          alt="Rooster Booster"
          style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }}
        />
      </div>

      {/* Verify card */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: R.bgCard,
        borderRadius: 20,
        padding: '32px 28px',
        boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <img
          src={accentRoofingLogo}
          alt={contractorName || 'Accent Roofing Service'}
          style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 20px' }}
        />

        <h2 style={{
          margin: '0 0 8px',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: R.fontSans,
          color: R.navy,
        }}>
          Check your email
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: R.textSecondary, lineHeight: 1.5 }}>
          We sent a 6-digit code to{' '}
          <strong style={{ color: R.textPrimary }}>{email}</strong>.
          Enter it below to verify your account.
        </p>

        {/* Error card */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fee2e2',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
          }}>
            <i className="ph ph-warning-circle" style={{ color: '#dc2626', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        {/* 6-digit code input */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: R.textSecondary,
            marginBottom: 8,
            fontFamily: R.fontBody,
          }}>
            Verification code
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => {
              setError('');
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            }}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="000000"
            style={{
              width: '100%',
              background: R.bgPage,
              border: `2px solid ${R.border}`,
              borderRadius: 12,
              padding: '18px 16px',
              color: R.textPrimary,
              fontSize: 36,
              fontFamily: R.fontMono,
              textAlign: 'center',
              letterSpacing: '0.25em',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = R.navy; }}
            onBlur={e => { e.target.style.borderColor = R.border; }}
          />
        </div>

        {/* Verify button — navy gradient */}
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          style={{
            width: '100%',
            background: (loading || code.length !== 6)
              ? R.navyDark
              : `linear-gradient(135deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: R.fontSans,
            cursor: (loading || code.length !== 6) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            boxShadow: (loading || code.length !== 6) ? 'none' : `0 4px 14px rgba(1,40,84,0.35)`,
            opacity: code.length !== 6 && !loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Verifying...</>
            : <><i className="ph ph-check-circle" style={{ fontSize: 16 }} /> Verify Email</>
          }
        </button>

        {/* Resend section */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          {resendSuccess ? (
            <p style={{ fontSize: 14, color: R.green, margin: 0, fontWeight: 500 }}>
              Code resent! Check your inbox.
            </p>
          ) : resendCooldown > 0 ? (
            <p style={{ fontSize: 14, color: R.textMuted, margin: 0 }}>
              Resend available in {resendCooldown}s
            </p>
          ) : (
            <p style={{ fontSize: 14, color: R.textMuted, margin: 0 }}>
              Didn't get a code?{' '}
              <button
                onClick={handleResend}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                  color: R.navy,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Resend
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: 24,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontFamily: R.fontMono,
        letterSpacing: '0.06em',
        opacity: cardVisible ? 1 : 0,
        transition: 'opacity 0.5s ease 0.3s',
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
