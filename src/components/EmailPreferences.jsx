import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config/contractor';

export default function EmailPreferences() {
  const token = new URLSearchParams(window.location.search).get('token');

  const [status, setStatus]           = useState('loading'); // loading | invalid | valid | success
  const [data, setData]               = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [optOutCampaigns, setOptOutCampaigns] = useState(false);
  const [optOutSms, setOptOutSms]             = useState(false);
  const [optOutAll, setOptOutAll]             = useState(false);
  const [referralOnly, setReferralOnly]       = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/unsubscribe/validate?token=${encodeURIComponent(token)}`);
        if (res.status === 404 || res.status === 410) { setStatus('invalid'); return; }
        if (!res.ok) { setStatus('invalid'); return; }
        const json = await res.json();
        setData(json);
        const p = json.existingPreferences || {};
        setOptOutCampaigns(!!p.opt_out_campaigns);
        setOptOutSms(!!p.opt_out_sms);
        setOptOutAll(!!p.opt_out_all);
        setReferralOnly(!!p.referral_only);
        setStatus('valid');
      } catch {
        setStatus('invalid');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOptOutAllChange(checked) {
    setOptOutAll(checked);
    if (checked) {
      setOptOutCampaigns(true);
      setOptOutSms(true);
    } else {
      setOptOutCampaigns(false);
      setOptOutSms(false);
    }
  }

  const anyChecked = optOutCampaigns || optOutSms || optOutAll || referralOnly;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/unsubscribe/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          opt_out_campaigns: optOutCampaigns,
          opt_out_sms: optOutSms,
          opt_out_all: optOutAll,
          referral_only: referralOnly,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error || 'Something went wrong. Please try again.');
        return;
      }
      setStatus('success');
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const companyName  = data?.companyName  || 'Us';
  const companyEmail = data?.companyEmail || null;

  const s = {
    page:    { minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px 60px', fontFamily: 'Roboto, sans-serif' },
    card:    { background: '#ffffff', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 520, boxShadow: '0 2px 24px rgba(0,0,0,0.08)' },
    heading: { fontSize: 22, fontWeight: 700, color: '#021428', margin: '0 0 6px', fontFamily: 'Montserrat, sans-serif', textAlign: 'center' },
    sub:     { fontSize: 14, color: '#555', margin: '0 0 28px', textAlign: 'center', lineHeight: 1.6 },
    intro:   { fontSize: 14, color: '#444', lineHeight: 1.7, margin: '0 0 24px' },
    row:     { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, cursor: 'pointer', userSelect: 'none' },
    label:   { fontSize: 15, fontWeight: 600, color: '#021428', margin: '0 0 3px', display: 'block' },
    desc:    { fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 },
    btn:     { width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#021428', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', marginTop: 8 },
    btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
    err:     { fontSize: 13, color: '#cc0000', marginTop: 10, textAlign: 'center' },
    contact: { fontSize: 12, color: '#888', marginTop: 20, textAlign: 'center' },
  };

  if (status === 'loading') {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: 'center', padding: '60px 32px' }}>
          <p style={{ fontSize: 15, color: '#888' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <i className="ph ph-warning-circle" style={{ fontSize: 48, color: '#cc0000' }} />
          </div>
          <h1 style={s.heading}>Link expired or invalid</h1>
          <p style={{ ...s.sub, marginBottom: 0 }}>
            This unsubscribe link has expired or is no longer valid. Links are valid for 72 hours.
            {companyEmail && (
              <> If you need to update your preferences, please contact{' '}
                <a href={`mailto:${companyEmail}`} style={{ color: '#021428' }}>{companyEmail}</a>.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <i className="ph ph-check-circle" style={{ fontSize: 52, color: '#16a34a' }} />
          </div>
          <h1 style={s.heading}>You're all set.</h1>
          <p style={{ ...s.sub, marginBottom: 0 }}>
            You have been removed from the selected outreach lists. It may take up to 24 hours for all systems to reflect your preferences.
          </p>
          {companyEmail && (
            <p style={s.contact}>
              Questions? Contact us at{' '}
              <a href={`mailto:${companyEmail}`} style={{ color: '#021428' }}>{companyEmail}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  // status === 'valid'
  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Confirmation pixel — fires silently on page load */}
        {token && (
          <img
            src={`${BACKEND_URL}/api/unsubscribe/pixel?token=${encodeURIComponent(token)}`}
            alt=""
            width="1"
            height="1"
            style={{ display: 'none', width: 1, height: 1 }}
          />
        )}

        {/* Logo */}
        {data?.logoUrl && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src={data.logoUrl} alt={companyName} style={{ maxWidth: 200, maxHeight: 60, objectFit: 'contain' }} />
          </div>
        )}

        {/* Company name */}
        {data?.companyName && (
          <p style={{ textAlign: 'center', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 16, color: '#021428', margin: '0 0 4px' }}>
            {data.companyName}
          </p>
        )}

        <h1 style={{ ...s.heading, marginTop: 12 }}>Manage Your Communication Preferences</h1>

        <p style={s.intro}>
          Please select which types of communications you'd like to opt out of. Your transactional messages (like reward confirmations) will still be delivered.
        </p>

        {/* Checkbox rows */}
        {[
          {
            checked: optOutCampaigns,
            onChange: (v) => { if (!optOutAll) setOptOutCampaigns(v); },
            disabled: optOutAll,
            label: 'Campaign & Promotional Emails',
            desc: `Marketing campaigns and outreach emails from ${companyName}`,
          },
          {
            checked: optOutSms,
            onChange: (v) => { if (!optOutAll) setOptOutSms(v); },
            disabled: optOutAll,
            label: 'SMS Text Messages',
            desc: `Text message notifications from ${companyName}`,
          },
          {
            checked: optOutAll,
            onChange: handleOptOutAllChange,
            disabled: false,
            label: 'All Emails & Texts',
            desc: 'Unsubscribe from all communications (except active referral updates)',
          },
          {
            checked: referralOnly,
            onChange: setReferralOnly,
            disabled: false,
            label: 'Referral Updates Only',
            desc: 'Only contact me about my active referrals',
          },
        ].map(({ checked, onChange, disabled, label, desc }) => (
          <div
            key={label}
            style={{ ...s.row, opacity: disabled ? 0.5 : 1 }}
            onClick={() => !disabled && onChange(!checked)}
          >
            <div style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 4,
              border: `2px solid ${checked ? '#021428' : '#ccc'}`,
              background: checked ? '#021428' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1, transition: 'background 0.15s, border-color 0.15s',
            }}>
              {checked && <i className="ph ph-check" style={{ fontSize: 13, color: '#fff' }} />}
            </div>
            <div>
              <span style={s.label}>{label}</span>
              <p style={s.desc}>{desc}</p>
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={!anyChecked || submitting}
          style={{ ...s.btn, ...(!anyChecked || submitting ? s.btnDisabled : {}) }}
        >
          {submitting ? 'Saving…' : 'Submit and Confirm Opt Out'}
        </button>

        {submitError && (
          <p style={s.err}>
            {submitError}
            {companyEmail && <> or contact <a href={`mailto:${companyEmail}`} style={{ color: '#cc0000' }}>{companyEmail}</a>.</>}
          </p>
        )}

        {companyEmail && !submitError && (
          <p style={s.contact}>
            Questions? Contact us at{' '}
            <a href={`mailto:${companyEmail}`} style={{ color: '#021428' }}>{companyEmail}</a>
          </p>
        )}
      </div>
    </div>
  );
}
