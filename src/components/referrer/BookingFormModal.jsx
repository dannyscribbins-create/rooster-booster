import { useState, useEffect } from 'react';
import { statusVar } from '../../constants/statusTheme';

// ─── PALETTE-11 B2 TOKENS ─── ⚠ THIS IS A DARK PANEL ─────────────────────────
// ⚠ THE PANEL FILL IS `--rm-secondary` — the contractor's PRIMARY BRAND COLOUR,
// the dark neutral, per the documented crossover. Its text is
// `--rm-on-secondary`, DERIVED for that fill: worst 6.71:1 across all four
// seeded brands and both modes.
// ⚠ `--rm-text` WOULD BE WRONG HERE. It is floored against `surface` and
// `recess`, never against a brand fill, and a token floored against one ground
// is not safe on another — hand-caught in three consecutive phases.
// ⚠ THE PANEL KEEPS ITS SHAPE. This is a migration, not a redesign, and unlike
// ManageAccount's navy this one is DELIBERATE rather than the `||` fallback of a
// key that does not exist.
//
// ⚠ AND THE GAP THIS FILE EXPOSES, FILED RATHER THAN INVENTED AROUND: the token
// set has NO variant for a hairline, a divider or a STATUS colour sitting on a
// BRAND FILL. `elevationVar('border')` resolves per MODE, not per panel, so on a
// dark panel in light mode it is a black hairline nobody can see; and
// `statusVar('dangerText')` is a DARK red chosen for a light ground. Where no
// token covers the case the value stays a neutral literal WITH ITS REASON, and
// the gap is recorded in PRE_LAUNCH_CHECKLIST.md.
const SECONDARY    = 'var(--rm-secondary, #1C2D4D)';
const ON_SECONDARY = 'var(--rm-on-secondary, #FFFFFF)';
const PRIMARY      = 'var(--rm-primary, #F26A1B)';
const ON_PRIMARY   = 'var(--rm-on-primary, #000000)';
const MUTED = 0.72;
// The CTA's darker stop, for the submitting state.
const PRIMARY_DARK = 'var(--rm-primary-dark, #CE530C)';

import { BACKEND_URL } from '../../config/contractor';
import { useBranding } from '../shared/ThemeProvider';
import { X, CheckCircle } from '@phosphor-icons/react';
import { fontVar } from '../../constants/elevationTheme';

export default function BookingFormModal({ visible, onClose, onBookingSuccess, sessionToken }) {
  const branding = useBranding();
  const [name, setName]                   = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity]                   = useState('');
  const [state, setState]                 = useState('');
  const [zipCode, setZipCode]             = useState('');
  const [notes, setNotes]                 = useState('');
  const [status, setStatus]   = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [fieldError, setFieldError] = useState('');

  // Reset form each time modal opens
  useEffect(() => {
    if (visible) {
      setName(''); setPhone(''); setEmail('');
      setStreetAddress(''); setCity(''); setState(''); setZipCode('');
      setNotes('');
      setStatus('idle'); setFieldError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  async function handleSubmit() {
    setFieldError('');
    if (!name.trim() || !phone.trim()) {
      setFieldError('Please enter your name and phone number.');
      return;
    }
    setStatus('submitting');
    try {
      const r = await fetch(`${BACKEND_URL}/api/referrer/booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name, phone, email, address: `${streetAddress}, ${city}, ${state} ${zipCode}`.trim(), notes }),
      });
      const d = await r.json();
      if (d.success) {
        setStatus('success');
        if (onBookingSuccess) onBookingSuccess();
        setTimeout(() => onClose(), 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 10, fontFamily: fontVar('body'), fontSize: 15,
    color: ON_SECONDARY, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const focusHandler = e => { e.target.style.borderColor = 'rgba(255,255,255,0.65)'; };
  const blurHandler  = e => { e.target.style.borderColor = 'rgba(255,255,255,0.25)'; };

  return (
    <div
      onClick={() => status !== 'submitting' && onClose()}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: SECONDARY,
          borderRadius: '20px 20px 0 0',
          maxHeight: '90vh',
          overflowY: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 24px)',
        }}
      >
        {/* Success state */}
        {status === 'success' ? (
          <div style={{
            padding: '52px 24px 48px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 12,
          }}>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                style={{ maxWidth: 160, width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: ON_SECONDARY, fontFamily: fontVar('heading') }}>
                {branding.companyName}
              </p>
            )}
            <CheckCircle size={64} weight="fill" color={statusVar('success')} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: ON_SECONDARY, fontFamily: fontVar('heading') }}>
              You're all set!
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.75)', fontFamily: fontVar('body'), lineHeight: 1.6 }}>
              We'll be in touch soon to schedule your free inspection.
            </p>
          </div>
        ) : (
          <div style={{ padding: '24px 24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: ON_SECONDARY, fontFamily: fontVar('heading') }}>
                Request Inspection
              </h2>
              <button
                onClick={onClose}
                disabled={status === 'submitting'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: status === 'submitting' ? 0.4 : 1 }}
              >
                <X size={22} color={ON_SECONDARY} weight="bold" />
              </button>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Full Name *"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={status === 'submitting'}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={status === 'submitting'}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={status === 'submitting'}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <input
                type="text"
                placeholder="Street Address"
                value={streetAddress}
                onChange={e => setStreetAddress(e.target.value)}
                disabled={status === 'submitting'}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  disabled={status === 'submitting'}
                  style={{ ...inputStyle, flex: 2 }}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
                <input
                  type="text"
                  placeholder="State"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  disabled={status === 'submitting'}
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>
              <input
                type="text"
                placeholder="Zip Code"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                disabled={status === 'submitting'}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <textarea
                placeholder="Anything we should know?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={status === 'submitting'}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </div>

            {/* ⚠ THE TWO ERROR LINES BELOW HOLD A RAW LIGHT-RED, DELIBERATELY,
                AND THAT WAS TRUE BEFORE PALETTE-14 AND UNDOCUMENTED.
                Same case ProfileTab's error-on-a-brand-fill note sets out at
                length: an error message sitting ON a brand-coloured ground, for
                which the status set has no pair. `statusVar('dangerText')`
                mounts the LIGHT tone, which on this dark fill is less readable
                than the literal, not more — the route that looks correct is the
                one that fails.
                ⚠ AND THE TWO SITES DISAGREE WITH EACH OTHER: this is
                rgba(255,140,140,1) while ProfileTab holds #fca5a5 —
                rgb(252,165,165). Two different light-reds for one job, neither
                wrong, arrived at separately. ⚠ NOT UNIFIED HERE: picking one
                changes pixels on a surface nobody was asked about, and a
                migration phase is the wrong place to make a colour decision.
                Filed instead.
                ⚠ ALPHA 1 WRITTEN AS rgba() IS THE TELL that this wanted to be a
                hex and was never revisited. Left as-is for the same reason. */}
            {/* Validation error */}
            {fieldError && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,140,140,1)', fontFamily: fontVar('body') }}>
                {fieldError}
              </p>
            )}

            {/* API error */}
            {status === 'error' && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,140,140,1)', fontFamily: fontVar('body') }}>
                Something went wrong. Please try again.
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={status === 'submitting'}
              style={{
                marginTop: 20, width: '100%', padding: '14px 24px',
                background: status === 'submitting' ? PRIMARY_DARK : PRIMARY,
                border: 'none', borderRadius: 12,
                color: ON_SECONDARY, fontSize: 15, fontWeight: 700,
                fontFamily: fontVar('heading'), cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {status === 'submitting' ? (
                <>
                  <i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} />
                  Sending…
                </>
              ) : 'Request Inspection'}
            </button>
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
