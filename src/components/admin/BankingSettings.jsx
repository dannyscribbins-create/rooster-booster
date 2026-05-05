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

const METHODS = [
  { key: 'stripe_ach',  label: 'Stripe ACH',     description: 'Direct bank transfer. Requires Stripe Connect setup.',                                 icon: 'ph-bank' },
  { key: 'check',       label: 'Check by Mail',   description: 'Contractor mails a physical check. Always requires manual approval.',                  icon: 'ph-envelope-simple' },
  { key: 'venmo',       label: 'Venmo',           description: 'Contractor sends payment manually via Venmo. Always requires manual approval.',         icon: 'ph-device-mobile' },
  { key: 'zelle',       label: 'Zelle',           description: 'Contractor sends payment manually via Zelle. Always requires manual approval.',         icon: 'ph-lightning' },
];

export default function BankingSettings() {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');

  const [initLoading, setInitLoading]   = useState(true);
  const [automation, setAutomation]     = useState('manual_all');
  const [threshold, setThreshold]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [saveError, setSaveError]       = useState(null);

  const [methods, setMethods]                       = useState(['stripe_ach', 'check', 'venmo', 'zelle']);
  const [methodsSaving, setMethodsSaving]           = useState(false);
  const [methodsSuccess, setMethodsSuccess]         = useState(false);
  const [methodsError, setMethodsError]             = useState(null);
  const [lastEnabledError, setLastEnabledError]     = useState(false);

  const [stripeStatus, setStripeStatus]             = useState('not_connected');
  const [stripeAccountId, setStripeAccountId]       = useState(null);
  const [stripeConnecting, setStripeConnecting]     = useState(false);
  const [stripeConfirming, setStripeConfirming]     = useState(false);
  const [stripeBanner, setStripeBanner]             = useState(null);
  const [stripeDisconnecting, setStripeDisconnecting] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [autoRes, methodsRes, stripeRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/admin/payout-automation`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
          fetch(`${BACKEND_URL}/api/admin/payout-methods`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
          fetch(`${BACKEND_URL}/api/admin/stripe/connection-status`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
        ]);
        const autoData    = await autoRes.json();
        const methodsData = await methodsRes.json();
        const stripeData  = stripeRes.ok ? await stripeRes.json() : {};
        setAutomation(autoData.payout_automation || 'manual_all');
        setThreshold(autoData.payout_review_threshold != null ? String(autoData.payout_review_threshold) : '');
        setMethods(methodsData.enabled_payout_methods || ['stripe_ach', 'check', 'venmo', 'zelle']);
        setStripeStatus(stripeData.stripe_connect_status || 'not_connected');
        setStripeAccountId(stripeData.stripe_account_id_masked || null);
      } catch {
        // silent — defaults remain in place
      } finally {
        setInitLoading(false);
      }
    }

    async function handleStripeUrlParam() {
      const params = new URLSearchParams(window.location.search);
      const stripeParam = params.get('stripe_connect');
      if (!stripeParam) return;

      const clean = new URL(window.location.href);
      clean.searchParams.delete('stripe_connect');
      window.history.replaceState({}, '', clean.toString());

      if (stripeParam === 'success') {
        setStripeConfirming(true);
        try {
          const r = await fetch(`${BACKEND_URL}/api/admin/stripe/confirm-connection`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          });
          const d = await r.json();
          if (r.ok) {
            setStripeStatus(d.status);
            setStripeBanner({ type: 'success', text: 'Stripe account connected successfully!' });
            setTimeout(() => setStripeBanner(null), 4000);
          }
        } catch {
          // silent
        } finally {
          setStripeConfirming(false);
        }
      } else if (stripeParam === 'cancelled') {
        setStripeBanner({ type: 'warning', text: 'Stripe connection cancelled — you can connect anytime.' });
        setTimeout(() => setStripeBanner(null), 4000);
      } else if (stripeParam === 'refresh') {
        try {
          const r = await fetch(`${BACKEND_URL}/api/admin/stripe/create-account-link`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          });
          const d = await r.json();
          if (r.ok && d.url) window.location.href = d.url;
        } catch {
          // silent
        }
      }
    }

    handleStripeUrlParam();
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

  async function handleMethodToggle(key) {
    const isEnabled = methods.includes(key);
    if (isEnabled && methods.length === 1) {
      setLastEnabledError(true);
      setTimeout(() => setLastEnabledError(false), 3000);
      return;
    }
    const prev = methods;
    const next = isEnabled ? methods.filter(m => m !== key) : [...methods, key];
    setMethods(next);
    setMethodsSaving(true);
    setMethodsError(null);
    setMethodsSuccess(false);
    setLastEnabledError(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/payout-methods`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ enabled_payout_methods: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setMethodsSuccess(true);
      setTimeout(() => setMethodsSuccess(false), 3000);
    } catch (err) {
      setMethods(prev);
      setMethodsError(err.message || 'Failed to save payout methods');
    } finally {
      setMethodsSaving(false);
    }
  }

  async function handleStripeConnect() {
    setStripeConnecting(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/stripe/create-account-link`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to start Stripe onboarding');
      window.location.href = d.url;
    } catch (err) {
      setStripeBanner({ type: 'warning', text: err.message || 'Failed to connect Stripe' });
      setTimeout(() => setStripeBanner(null), 4000);
      setStripeConnecting(false);
    }
  }

  async function handleStripeDisconnect() {
    if (!window.confirm('Disconnect your Stripe account? ACH payouts will be disabled.')) return;
    setStripeDisconnecting(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/stripe/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      if (!r.ok) throw new Error('Disconnect failed');
      setStripeStatus('not_connected');
      setStripeAccountId(null);
    } catch (err) {
      setStripeBanner({ type: 'warning', text: err.message || 'Disconnect failed' });
      setTimeout(() => setStripeBanner(null), 4000);
    } finally {
      setStripeDisconnecting(false);
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

      {/* ── Section 1: Stripe Connect ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Stripe Connect
      </h2>

      {stripeBanner && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: AD.radiusMd,
          background: stripeBanner.type === 'success' ? AD.greenBg : AD.amberBg,
          border: `1px solid ${stripeBanner.type === 'success' ? AD.green : AD.amber}`,
          color: stripeBanner.type === 'success' ? AD.greenText : AD.amberText,
          fontSize: 13, fontFamily: AD.fontSans, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className={`ph ${stripeBanner.type === 'success' ? 'ph-check-circle' : 'ph-warning'}`} style={{ fontSize: 16 }} />
          {stripeBanner.text}
        </div>
      )}

      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: '20px 22px' }}>

        {stripeStatus === 'not_connected' && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              Connect your Stripe account to enable automatic ACH payouts for referrers who choose Stripe ACH.
            </p>
            <button
              onClick={handleStripeConnect}
              disabled={stripeConnecting || stripeConfirming}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: AD.radiusMd, border: 'none',
                background: stripeConnecting ? AD.bgCardTint : AD.navy,
                color: stripeConnecting ? AD.textSecondary : '#fff',
                fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                cursor: stripeConnecting ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="ph ph-plugs" style={{ fontSize: 16 }} />
              {stripeConnecting ? 'Connecting…' : 'Connect Stripe'}
            </button>
          </>
        )}

        {stripeStatus === 'pending' && (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: AD.radiusPill, background: AD.amberBg, border: `1px solid ${AD.amber}`, marginBottom: 14 }}>
              <i className="ph ph-clock" style={{ fontSize: 14, color: AD.amberText }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.amberText, fontFamily: AD.fontSans }}>Stripe Connection Pending</span>
            </div>
            {stripeAccountId && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>
                Account: {stripeAccountId}
              </p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              Complete your Stripe onboarding to activate ACH payouts.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleStripeConnect}
                disabled={stripeConnecting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: AD.radiusMd, border: 'none',
                  background: stripeConnecting ? AD.bgCardTint : AD.navy,
                  color: stripeConnecting ? AD.textSecondary : '#fff',
                  fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                  cursor: stripeConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                <i className="ph ph-plugs" style={{ fontSize: 16 }} />
                {stripeConnecting ? 'Loading…' : 'Resume Onboarding'}
              </button>
              <button
                onClick={handleStripeDisconnect}
                disabled={stripeDisconnecting}
                style={{
                  padding: '8px 14px', borderRadius: AD.radiusMd,
                  border: `1px solid ${AD.border}`, background: 'transparent',
                  color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
                  cursor: stripeDisconnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {stripeDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </>
        )}

        {stripeStatus === 'active' && (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: AD.radiusPill, background: AD.greenBg, border: `1px solid ${AD.green}`, marginBottom: 14 }}>
              <i className="ph ph-check-circle" style={{ fontSize: 14, color: AD.greenText }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.greenText, fontFamily: AD.fontSans }}>Stripe Connected</span>
            </div>
            {stripeAccountId && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>
                Account: {stripeAccountId}
              </p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              ACH payouts are active. Referrers can be paid automatically via Stripe.
            </p>
            <button
              onClick={handleStripeDisconnect}
              disabled={stripeDisconnecting}
              style={{
                padding: '8px 14px', borderRadius: AD.radiusMd,
                border: `1px solid ${AD.border}`, background: 'transparent',
                color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
                cursor: stripeDisconnecting ? 'not-allowed' : 'pointer',
              }}
            >
              {stripeDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        )}

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

      {/* ── Divider ── */}
      <div style={{ borderTop: `1px solid ${AD.border}`, margin: '28px 0' }} />

      {/* ── Section 3: Payout Methods ── */}
      <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Payout Methods
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Choose which payout options are available to your referrers.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {METHODS.map(method => {
          const enabled = methods.includes(method.key);
          return (
            <div
              key={method.key}
              style={{
                background: AD.bgCard,
                border: `1px solid ${AD.border}`,
                borderRadius: AD.radiusLg,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: methodsSaving ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <i
                className={`ph ${method.icon}`}
                style={{ fontSize: 20, color: enabled ? AD.greenText : AD.textTertiary, flexShrink: 0, transition: 'color 0.2s' }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {method.label}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
                  {method.description}
                </p>
              </div>
              <button
                onClick={() => !methodsSaving && handleMethodToggle(method.key)}
                disabled={methodsSaving}
                aria-label={`${enabled ? 'Disable' : 'Enable'} ${method.label}`}
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 24,
                  borderRadius: AD.radiusPill,
                  border: 'none',
                  background: enabled ? AD.green : AD.bgCardTint,
                  cursor: methodsSaving ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                  padding: 0,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: enabled ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          );
        })}
      </div>

      {lastEnabledError && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans }}>
          <i className="ph ph-warning" style={{ marginRight: 6 }} />
          At least one payout method must be enabled.
        </p>
      )}
      {methodsSuccess && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>
          <i className="ph ph-check-circle" style={{ marginRight: 6 }} />
          Payout methods saved.
        </p>
      )}
      {methodsError && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>
          <i className="ph ph-warning-circle" style={{ marginRight: 6 }} />
          {methodsError}
        </p>
      )}

    </div>
  );
}
