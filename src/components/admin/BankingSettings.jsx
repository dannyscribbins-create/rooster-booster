import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

const OPTIONS = [
  {
    value: 'manual_all',
    label: 'Manual Review Required',
    description: 'Every Stripe ACH cashout request requires your approval before the transfer is sent.',
  },
  {
    value: 'full_auto',
    label: 'Fully Automatic',
    description: 'Stripe ACH cashout requests are transferred automatically when submitted. No review needed.',
  },
  {
    value: 'threshold',
    label: 'Threshold-Based',
    description: 'Cashout requests below your set amount transfer automatically. At or above it, your approval is required first.',
  },
];

export default function BankingSettings() {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');

  const [initLoading, setInitLoading] = useState(true);
  const [automation, setAutomation]   = useState('manual_all');
  const [threshold, setThreshold]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/payout-automation`, {
          headers: { 'Authorization': `Bearer ${adminToken()}` },
        });
        const d = await r.json();
        setAutomation(d.payout_automation || 'manual_all');
        setThreshold(d.payout_review_threshold != null ? String(d.payout_review_threshold) : '');
      } catch {
        // silent — defaults remain in place
      } finally {
        setInitLoading(false);
      }
    }
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAutomationChange(val) {
    setAutomation(val);
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/payout-automation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({
          payout_automation: automation,
          payout_review_threshold: automation === 'threshold' && threshold ? parseFloat(threshold) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (initLoading) {
    return (
      <div style={{ maxWidth: 560 }}>
        {[100, 72, 72, 72].map((h, i) => (
          <div key={i} style={{
            background: AD.bgCard, borderRadius: AD.radiusLg, height: h,
            marginBottom: 12, opacity: 0.5, animation: 'bkPulse 1.5s ease-in-out infinite',
          }} />
        ))}
        <style>{`@keyframes bkPulse { 0%,100%{opacity:0.35} 50%{opacity:0.6} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>

      {/* ── Section 1: Stripe Account ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Stripe Account
      </h2>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <i className="ph ph-credit-card" style={{ fontSize: 18, color: AD.textTertiary, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: AD.textSecondary, fontFamily: AD.fontSans }}>Connection Status</span>
        </div>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: AD.radiusPill,
          background: AD.bgCardTint, border: `1px solid ${AD.border}`,
          color: AD.textSecondary, fontSize: 12, fontFamily: AD.fontSans, marginBottom: 14,
        }}>
          Not Connected
        </span>
        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
          Stripe Connect setup will be available in a future update. Once connected, approved Stripe ACH cashout requests will be transferred automatically to your referrers' bank accounts.
        </p>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: `1px solid ${AD.border}`, margin: '28px 0' }} />

      {/* ── Section 2: Payout Automation ── */}
      <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Payout Automation
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Control how Stripe ACH cashout requests are processed when a referrer submits them.
      </p>

      {/* Option cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPTIONS.map(opt => {
          const selected = automation === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => handleAutomationChange(opt.value)}
              style={{
                background: selected ? AD.blueBg : AD.bgCard,
                border: `1px solid ${selected ? AD.blueText : AD.border}`,
                borderLeft: `4px solid ${selected ? AD.blueText : 'transparent'}`,
                borderRadius: AD.radiusLg,
                padding: '14px 18px',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: selected ? AD.blueText : AD.textPrimary, fontFamily: AD.fontSans }}>
                {opt.label}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
                {opt.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Threshold input — smooth reveal */}
      <div style={{
        overflow: 'hidden',
        maxHeight: automation === 'threshold' ? 100 : 0,
        opacity: automation === 'threshold' ? 1 : 0,
        transition: 'max-height 0.25s ease, opacity 0.2s ease',
        marginTop: automation === 'threshold' ? 16 : 0,
      }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 8 }}>
          Require manual review for cashout requests at or above
        </label>
        <div style={{ display: 'flex', alignItems: 'center', width: 'fit-content' }}>
          <span style={{
            padding: '8px 10px',
            background: AD.bgCardTint,
            border: `1px solid ${AD.border}`,
            borderRight: 'none',
            borderRadius: `${AD.radiusMd} 0 0 ${AD.radiusMd}`,
            color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans,
          }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            style={{
              padding: '8px 12px',
              background: AD.bgCard,
              border: `1px solid ${AD.border}`,
              borderRadius: `0 ${AD.radiusMd} ${AD.radiusMd} 0`,
              color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans,
              width: 140, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '9px 22px',
            borderRadius: AD.radiusMd,
            border: 'none',
            background: saving ? AD.bgCardTint : AD.blueText,
            color: saving ? AD.textSecondary : AD.bgPage,
            fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {saveSuccess && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>
            <i className="ph ph-check-circle" style={{ marginRight: 6 }} />
            Payout settings saved.
          </p>
        )}
        {saveError && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>
            <i className="ph ph-warning-circle" style={{ marginRight: 6 }} />
            {saveError}
          </p>
        )}
      </div>

    </div>
  );
}
