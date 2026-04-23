import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor';
import { X, CheckCircle } from '@phosphor-icons/react';

export default function BookingFormModal({ visible, onClose, onBookingSuccess, sessionToken }) {
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
    border: '1px solid rgba(211,227,240,0.25)',
    borderRadius: 10, fontFamily: R.fontBody, fontSize: 15,
    color: '#fff', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const focusHandler = e => { e.target.style.borderColor = 'rgba(211,227,240,0.65)'; };
  const blurHandler  = e => { e.target.style.borderColor = 'rgba(211,227,240,0.25)'; };

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
          background: R.navy,
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
            {CONTRACTOR_CONFIG.logoUrl ? (
              <img
                src={CONTRACTOR_CONFIG.logoUrl}
                alt={CONTRACTOR_CONFIG.name}
                style={{ maxWidth: 160, width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: R.fontSans }}>
                {CONTRACTOR_CONFIG.name}
              </p>
            )}
            <CheckCircle size={64} weight="fill" color="#22C55E" />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: R.fontSans }}>
              You're all set!
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.75)', fontFamily: R.fontBody, lineHeight: 1.6 }}>
              We'll be in touch soon to schedule your free inspection.
            </p>
          </div>
        ) : (
          <div style={{ padding: '24px 24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: R.fontSans }}>
                Request Inspection
              </h2>
              <button
                onClick={onClose}
                disabled={status === 'submitting'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: status === 'submitting' ? 0.4 : 1 }}
              >
                <X size={22} color="rgba(211,227,240,0.7)" weight="bold" />
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

            {/* Validation error */}
            {fieldError && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#f87171', fontFamily: R.fontBody }}>
                {fieldError}
              </p>
            )}

            {/* API error */}
            {status === 'error' && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#f87171', fontFamily: R.fontBody }}>
                Something went wrong. Please try again.
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={status === 'submitting'}
              style={{
                marginTop: 20, width: '100%', padding: '14px 24px',
                background: status === 'submitting' ? R.redDark : R.red,
                border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
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
