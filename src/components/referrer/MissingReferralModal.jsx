import { useState } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';

const CHANNEL_OPTIONS = [
  { value: '',                        label: 'Select a channel...',              disabled: true  },
  { value: 'qr_code',                 label: 'In-app QR code'                                   },
  { value: 'personal_link',           label: 'Personal link via app'                            },
  { value: 'company_info_via_app',    label: 'Sent company info via app'                        },
  { value: 'company_info_outside_app',label: 'Sent company info outside of app'                 },
  { value: 'salesman_contact',        label: "Sent salesman's contact info"                     },
];

export default function MissingReferralModal({ isOpen, onClose, onSuccess }) {
  const [referredName,    setReferredName]    = useState('');
  const [referredContact, setReferredContact] = useState('');
  const [channel,         setChannel]         = useState('');
  const [approxDate,      setApproxDate]      = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');
  const [submitted,       setSubmitted]       = useState(false);

  const canSubmit = referredName.trim().length > 0 && channel !== '';

  const handleSubmit = safeAsync(async () => {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/referrer/missing-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('rb_token')}`,
        },
        body: JSON.stringify({
          referred_name:    referredName.trim(),
          channel,
          referred_contact: referredContact.trim() || undefined,
          approximate_date: approxDate || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, 'MissingReferralModal');

  function handleClose() {
    setReferredName('');
    setReferredContact('');
    setChannel('');
    setApproxDate('');
    setError('');
    setSubmitted(false);
    onClose();
  }

  if (!isOpen) return null;

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px',
    background: R.bgPage,
    border: `1.5px solid ${R.border}`,
    borderRadius: 10,
    fontSize: 15,
    color: R.textPrimary,
    fontFamily: R.fontBody,
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: R.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: R.fontBody,
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: R.bgCard,
        borderRadius: '20px 20px 0 0',
        zIndex: 1001,
        maxWidth: 430,
        margin: '0 auto',
        padding: '0 0 env(safe-area-inset-bottom)',
        boxShadow: R.shadowLg,
        maxHeight: '90dvh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: R.border }} />
        </div>

        <div style={{ padding: '4px 24px 32px' }}>
          {submitted ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: R.greenBg, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <i className="ph ph-check-circle" style={{ fontSize: 32, color: R.green }} />
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>
                Report Submitted
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: R.textSecondary, fontFamily: R.fontBody, lineHeight: 1.6 }}>
                Got it! We'll look into this and make sure you get credit if it's owed.
                You can track the status of this report in your profile.
              </p>
              <button
                onClick={handleClose}
                style={{
                  width: '100%', padding: '16px',
                  background: R.navy, color: '#fff',
                  border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  fontFamily: R.fontBody, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>
                Report a Missing Referral
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: R.textSecondary, fontFamily: R.fontBody, lineHeight: 1.5 }}>
                Don't see a referral in your pipeline? Let us know and we'll investigate.
              </p>

              {/* Referred person's name */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Who did you refer? <span style={{ color: R.red }}>*</span>
                </label>
                <input
                  type="text"
                  value={referredName}
                  onChange={e => setReferredName(e.target.value)}
                  placeholder="Their full name"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = R.navy; }}
                  onBlur={e => { e.target.style.borderColor = R.border; }}
                />
              </div>

              {/* Contact info */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Their contact info (optional)</label>
                <input
                  type="text"
                  value={referredContact}
                  onChange={e => setReferredContact(e.target.value)}
                  placeholder="Phone or email (optional)"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = R.navy; }}
                  onBlur={e => { e.target.style.borderColor = R.border; }}
                />
              </div>

              {/* Channel */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  How did you refer them? <span style={{ color: R.red }}>*</span>
                </label>
                <select
                  value={channel}
                  onChange={e => setChannel(e.target.value)}
                  style={{
                    ...inputStyle,
                    color: channel ? R.textPrimary : R.textMuted,
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 256 256'%3E%3Cpath fill='%236B6B6B' d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    paddingRight: 40,
                  }}
                  onFocus={e => { e.target.style.borderColor = R.navy; }}
                  onBlur={e => { e.target.style.borderColor = R.border; }}
                >
                  {CHANNEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Approximate date */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Approximate date (optional)</label>
                <input
                  type="date"
                  value={approxDate}
                  onChange={e => setApproxDate(e.target.value)}
                  style={{ ...inputStyle, color: approxDate ? R.textPrimary : R.textMuted }}
                  onFocus={e => { e.target.style.borderColor = R.navy; }}
                  onBlur={e => { e.target.style.borderColor = R.border; }}
                />
              </div>

              {error && (
                <p style={{ margin: '0 0 16px', fontSize: 14, color: R.red, fontFamily: R.fontBody }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{
                  width: '100%', padding: '16px',
                  background: canSubmit && !submitting ? R.navy : R.border,
                  color: canSubmit && !submitting ? '#fff' : R.textMuted,
                  border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  fontFamily: R.fontBody,
                  cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s, color 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {submitting
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Submitting...</>
                  : 'Submit Report'
                }
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
