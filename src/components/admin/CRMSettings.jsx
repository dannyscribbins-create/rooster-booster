import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor';
import Skeleton from '../shared/Skeleton';

// ── Local design primitives ───────────────────────────────────────────────────

function SettingsInput({ label, value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', padding: '9px 12px',
          background: disabled ? AD.bgCardTint : AD.bgCard,
          border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
          color: disabled ? AD.textTertiary : AD.textPrimary,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = AD.blueLight; }}
        onBlur={e => { e.target.style.borderColor = AD.border; }}
      />
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: AD.bgCard, borderRadius: AD.radiusLg,
      border: `1px solid ${AD.border}`, padding: '28px 32px',
      marginBottom: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function PrimaryBtn({ children, onClick, loading: isLoading, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      style={{
        background: isLoading || disabled
          ? AD.redDark
          : `linear-gradient(135deg, ${AD.red} 0%, ${AD.redDark} 100%)`,
        border: 'none', borderRadius: AD.radiusMd, padding: '10px 20px',
        color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: AD.fontSans,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        opacity: disabled && !isLoading ? 0.55 : 1,
        transition: 'opacity 0.15s', ...style,
      }}
    >
      {isLoading && <i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'crmSpin 0.8s linear infinite' }} />}
      {children}
    </button>
  );
}

function OutlineBtn({ children, onClick, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent', border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusMd, padding: '10px 20px',
        color: AD.textSecondary, fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'border-color 0.15s, color 0.15s, background 0.15s', ...style,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = AD.borderStrong; e.currentTarget.style.color = AD.textPrimary; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = style.borderColor || AD.border; e.currentTarget.style.color = style.color || AD.textSecondary; }}
    >
      {children}
    </button>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return d.toLocaleDateString();
}

function relativeDate(dateStr) {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CRM_LABEL = { jobber: 'Jobber', servicetitan: 'ServiceTitan', acculynx: 'AccuLynx' };

const CRM_DESCRIPTORS = {
  jobber:       'Field service management',
  servicetitan: 'Enterprise field service',
  acculynx:     'Roofing-specific CRM',
};

const CRM_INSTRUCTIONS = {
  jobber:
    'In Jobber, go to Settings → Connected Apps → API Access. Click Generate API Token. Copy the token and paste it below.',
  servicetitan:
    'In ServiceTitan, go to Settings → Integrations → API Application Access. Create a new application and copy the Client ID and Client Secret.',
  acculynx:
    'In AccuLynx, contact your AccuLynx account manager to request API access. Once enabled, find your key under Settings → API.',
};

const STAGE_DESCRIPTIONS = {
  lead:       'A referral was submitted but not yet scheduled',
  inspection: 'A site visit or estimate has been scheduled',
  sold:       'The job has been approved and is in progress',
  paid:       'The invoice has been paid — bonus is triggered',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CRMSettings() {
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);

  // API key inline flow
  const [expandedCRM, setExpandedCRM]   = useState(null); // 'jobber' | 'servicetitan' | 'acculynx' | null
  const [apiKeyStep, setApiKeyStep]     = useState(1);
  const [apiKey1, setApiKey1]           = useState('');
  const [apiKey2, setApiKey2]           = useState('');
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState(null);
  const [connecting, setConnecting]     = useState(false);

  // Field mapping
  const [fieldName, setFieldName]       = useState('Referred by');
  const [fieldSaving, setFieldSaving]   = useState(false);
  const [fieldSaved, setFieldSaved]     = useState(false);

  // Stage mapping
  const [stageMap, setStageMap]         = useState({ lead: '', inspection: '', sold: '', paid: '' });
  const [stageSaving, setStageSaving]   = useState(false);
  const [stageSaved, setStageSaved]     = useState(false);

  // Sync
  const [syncInterval, setSyncInterval] = useState(30);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Referral start date
  const [referralStartDate, setReferralStartDate] = useState(null);   // saved custom date (string or null)
  const [connectedAt, setConnectedAt]             = useState(null);   // OAuth connection date (string)
  const [startDateInput, setStartDateInput]       = useState('');     // controlled input value
  const [startDateSaving, setStartDateSaving]     = useState(false);
  const [startDateMessage, setStartDateMessage]   = useState('');

  // Disconnect modal
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnecting, setDisconnecting]   = useState(false);

  const fieldSavedTimer     = useRef(null);
  const stageSavedTimer     = useRef(null);
  const syncMsgTimer        = useRef(null);
  const startDateMsgTimer   = useRef(null);

  function authHeaders() {
    return { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` };
  }

  function loadStatus() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/crm/status`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        setStatus(d);
        setFieldName(d.referrerFieldName || 'Referred by');
        setStageMap(d.stageMap || { lead: '', inspection: '', sold: '', paid: '' });
        setSyncInterval(d.syncIntervalMins || 30);
        setLastSyncedAt(d.lastSyncedAt || null);
        setReferralStartDate(d.referralStartDate || null);
        setConnectedAt(d.connectedAt || null);
        setStartDateInput(d.referralStartDate ? d.referralStartDate.slice(0, 10) : '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStatus(); }, []);

  // Live-update relative timestamps every 60s
  useEffect(() => {
    const t = setInterval(() => setLastSyncedAt(prev => prev), 60000);
    return () => clearInterval(t);
  }, []);

  function openApiKeyFlow(crmType) {
    setExpandedCRM(crmType);
    setApiKeyStep(1);
    setApiKey1('');
    setApiKey2('');
    setTestResult(null);
  }

  function closeApiKeyFlow() {
    setExpandedCRM(null);
    setApiKeyStep(1);
    setApiKey1('');
    setApiKey2('');
    setTestResult(null);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const credential = expandedCRM === 'servicetitan'
      ? { clientId: apiKey1, clientSecret: apiKey2 }
      : apiKey1;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/crm/test-connection`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmType: expandedCRM, credential }),
      });
      const d = await r.json();
      setTestResult(d);
      if (d.success) setApiKeyStep(3);
    } catch {
      setTestResult({ success: false, message: 'Network error — please try again.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleConnectApiKey() {
    setConnecting(true);
    const credential = expandedCRM === 'servicetitan'
      ? { clientId: apiKey1, clientSecret: apiKey2 }
      : apiKey1;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/crm/connect-api-key`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmType: expandedCRM, credential }),
      });
      const d = await r.json();
      if (d.success) { closeApiKeyFlow(); loadStatus(); }
      else setTestResult({ success: false, message: d.error || 'Connection failed.' });
    } catch {
      setTestResult({ success: false, message: 'Network error — please try again.' });
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveFieldName() {
    setFieldSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/admin/crm/settings`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerFieldName: fieldName }),
      });
      setFieldSaved(true);
      if (fieldSavedTimer.current) clearTimeout(fieldSavedTimer.current);
      fieldSavedTimer.current = setTimeout(() => setFieldSaved(false), 2000);
    } finally {
      setFieldSaving(false);
    }
  }

  async function handleSaveStageMap() {
    setStageSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/admin/crm/settings`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageMap }),
      });
      setStageSaved(true);
      if (stageSavedTimer.current) clearTimeout(stageSavedTimer.current);
      stageSavedTimer.current = setTimeout(() => setStageSaved(false), 2000);
    } finally {
      setStageSaving(false);
    }
  }

  async function handleSyncIntervalChange(val) {
    const mins = parseInt(val, 10);
    setSyncInterval(mins);
    try {
      await fetch(`${BACKEND_URL}/api/admin/crm/settings`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncIntervalMins: mins }),
      });
      setSyncMsg('Saved ✓');
      if (syncMsgTimer.current) clearTimeout(syncMsgTimer.current);
      syncMsgTimer.current = setTimeout(() => setSyncMsg(''), 2000);
    } catch { /* silent */ }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/crm/sync`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (d.lastSyncedAt) setLastSyncedAt(d.lastSyncedAt);
      setSyncMsg('Synced ✓');
      if (syncMsgTimer.current) clearTimeout(syncMsgTimer.current);
      syncMsgTimer.current = setTimeout(() => setSyncMsg(''), 2000);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`${BACKEND_URL}/api/admin/crm/disconnect`, {
        method: 'POST',
        headers: authHeaders(),
      });
      setShowDisconnect(false);
      loadStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Skeleton loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Skeleton width="48px" height="48px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton height="20px" width="160px" style={{ marginBottom: 10 }} />
              <Skeleton height="14px" width="320px" />
            </div>
          </div>
        </Card>
        <Card>
          <Skeleton height="14px" width="120px" style={{ marginBottom: 20 }} />
          <div style={{ display: 'flex', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, background: AD.bgCardTint, borderRadius: AD.radiusMd, padding: 20 }}>
                <Skeleton height="20px" width="80px" style={{ marginBottom: 10 }} />
                <Skeleton height="14px" width="120px" style={{ marginBottom: 16 }} />
                <Skeleton height="38px" borderRadius={AD.radiusMd} style={{ marginBottom: 10 }} />
                <Skeleton height="14px" width="140px" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const isConnected = status?.isConnected;
  const tokenError  = isConnected && (status?.tokenStatus === 'expired' || status?.tokenStatus === 'missing');
  const isOAuth     = status?.connectionMethod === 'oauth';

  // ── Card 1 ── Connection status ─────────────────────────────────────────────
  function renderStatusCard() {
    if (!isConnected) {
      return (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <i className="ph-duotone ph-plugs-connected" style={{ fontSize: 52, color: AD.textTertiary, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, marginBottom: 6 }}>
                No CRM Connected
              </div>
              <div style={{ fontSize: 14, color: AD.textSecondary, lineHeight: 1.6 }}>
                Connect your CRM to enable automatic referral tracking and pipeline sync.
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (tokenError) {
      return (
        <Card style={{ borderColor: AD.amber }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <i className="ph-duotone ph-warning" style={{ fontSize: 52, color: AD.amberText, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, marginBottom: 6 }}>
                Connection Needs Attention
              </div>
              <div style={{ fontSize: 14, color: AD.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
                {isOAuth
                  ? 'Your Jobber authorization has expired. Reconnect to restore syncing.'
                  : 'Your API key may be invalid. Update it to restore syncing.'}
              </div>
              {isOAuth
                ? (
                  <PrimaryBtn onClick={() => { window.location.href = `${BACKEND_URL}/auth/jobber?contractorId=${CONTRACTOR_CONFIG.contractorId}`; }}>
                    <i className="ph ph-arrow-square-out" style={{ fontSize: 14 }} /> Reconnect with Jobber
                  </PrimaryBtn>
                )
                : (
                  <OutlineBtn onClick={() => openApiKeyFlow(status?.crmType)}>
                    Update API Key
                  </OutlineBtn>
                )}
            </div>
          </div>
        </Card>
      );
    }

    // Fully connected
    return (
      <Card style={{ borderColor: AD.green }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <i className="ph-duotone ph-check-circle" style={{ fontSize: 52, color: AD.greenText, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans, marginBottom: 4 }}>
              {CRM_LABEL[status?.crmType] || status?.crmType}
            </div>
            <div style={{ fontSize: 15, color: AD.textSecondary, marginBottom: 12 }}>
              {status?.crmAccountName}
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: AD.radiusPill, fontSize: 12, fontWeight: 500,
                background: isOAuth ? AD.blueBg : 'rgba(139,92,246,0.12)',
                color: isOAuth ? AD.blueText : '#c4b5fd',
              }}>
                {isOAuth ? 'Connected via OAuth' : 'Connected via API Key'}
              </span>
            </div>
            {!isOAuth && (
              <div style={{ fontSize: 13, color: AD.textSecondary, marginBottom: 6, fontFamily: "'Roboto Mono', monospace" }}>
                API Key: ••••••••
              </div>
            )}
            <div style={{ fontSize: 13, color: AD.textTertiary, marginBottom: 3 }}>Connected {relativeDate(status?.connectedAt)}</div>
            <div style={{ fontSize: 13, color: AD.textTertiary, marginBottom: 20 }}>Last synced {relativeTime(lastSyncedAt)}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={handleSyncNow} loading={syncing}>
                <i className="ph ph-arrows-clockwise" style={{ fontSize: 14 }} />
                {syncing ? 'Syncing…' : syncMsg || 'Sync Now'}
              </PrimaryBtn>
              <button
                onClick={() => setShowDisconnect(true)}
                style={{
                  background: 'transparent', border: `1px solid ${AD.red2}`,
                  borderRadius: AD.radiusMd, padding: '10px 20px',
                  color: AD.red2Text, fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = AD.red2Bg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <i className="ph ph-plugs" style={{ fontSize: 14 }} /> Disconnect
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ── Card 2 ── CRM option card (single item in the row) ──────────────────────
  function renderCRMOptionCard(crmType, oauthAvailable) {
    const expanded = expandedCRM === crmType;
    return (
      <div key={crmType} style={{
        flex: 1, minWidth: 160,
        background: AD.bgCardTint, borderRadius: AD.radiusMd,
        border: `1px solid ${expanded ? AD.blueLight : AD.border}`,
        padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.2s',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
          {CRM_LABEL[crmType]}
        </div>
        <div style={{ fontSize: 13, color: AD.textSecondary, marginBottom: 4 }}>
          {CRM_DESCRIPTORS[crmType]}
        </div>
        {oauthAvailable
          ? (
            <PrimaryBtn
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={() => { window.location.href = `${BACKEND_URL}/auth/jobber?contractorId=${CONTRACTOR_CONFIG.contractorId}`; }}
            >
              <i className="ph ph-link" style={{ fontSize: 14 }} /> Connect via OAuth
            </PrimaryBtn>
          )
          : (
            <button disabled style={{
              background: AD.bgCard, border: `1px solid ${AD.border}`,
              borderRadius: AD.radiusMd, padding: '10px 20px', width: '100%',
              color: AD.textTertiary, fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
              cursor: 'not-allowed',
            }}>
              OAuth — Coming Soon
            </button>
          )}
        <button
          onClick={() => expanded ? closeApiKeyFlow() : openApiKeyFlow(crmType)}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: expanded ? AD.textSecondary : AD.blueText,
            fontSize: 13, fontFamily: AD.fontSans,
            cursor: 'pointer', textDecoration: 'underline', textAlign: 'left',
          }}
        >
          {expanded ? 'Cancel' : 'Connect with API Key instead'}
        </button>
      </div>
    );
  }

  // ── API key 3-step inline expansion ─────────────────────────────────────────
  function renderApiKeyFlow() {
    if (!expandedCRM) return null;
    const isST = expandedCRM === 'servicetitan';

    return (
      <div style={{
        marginTop: 16, background: AD.bgCardTint, borderRadius: AD.radiusMd,
        border: `1px solid ${AD.borderStrong}`, padding: '24px',
      }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: apiKeyStep >= n ? AD.red : AD.bgCard,
                border: `1px solid ${apiKeyStep >= n ? AD.red : AD.border}`,
                color: apiKeyStep >= n ? '#fff' : AD.textTertiary,
                transition: 'background 0.2s, border-color 0.2s', flexShrink: 0,
              }}>
                {apiKeyStep > n
                  ? <i className="ph ph-check" style={{ fontSize: 11 }} />
                  : n}
              </div>
              {n < 3 && <div style={{ width: 28, height: 1, background: apiKeyStep > n ? AD.red : AD.border }} />}
            </div>
          ))}
          <span style={{ fontSize: 13, color: AD.textSecondary, marginLeft: 6 }}>
            {apiKeyStep === 1 ? 'Instructions' : apiKeyStep === 2 ? 'Enter Key' : 'Confirm'}
          </span>
        </div>

        {/* Step 1 — Instructions */}
        {apiKeyStep === 1 && (
          <div>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
              {CRM_INSTRUCTIONS[expandedCRM]}
            </p>
            <PrimaryBtn onClick={() => setApiKeyStep(2)}>Continue</PrimaryBtn>
          </div>
        )}

        {/* Step 2 — Key input + test */}
        {apiKeyStep === 2 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <SettingsInput
                label={isST ? 'Client ID' : expandedCRM === 'acculynx' ? 'API Key' : 'API Token'}
                value={apiKey1}
                onChange={setApiKey1}
                placeholder={isST ? 'Enter Client ID' : 'Paste your key here'}
              />
              {isST && (
                <SettingsInput
                  label="Client Secret"
                  value={apiKey2}
                  onChange={setApiKey2}
                  placeholder="Enter Client Secret"
                  type="password"
                />
              )}
            </div>
            {testResult && !testResult.success && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                padding: '10px 14px', background: AD.red2Bg, borderRadius: AD.radiusMd,
              }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 16, color: AD.red2Text, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: AD.red2Text }}>{testResult.message}</span>
              </div>
            )}
            <PrimaryBtn
              onClick={handleTestConnection}
              loading={testing}
              disabled={!apiKey1 || (isST && !apiKey2)}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </PrimaryBtn>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {apiKeyStep === 3 && testResult?.success && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
              padding: '14px 16px', background: AD.greenBg, borderRadius: AD.radiusMd,
            }}>
              <i className="ph-duotone ph-check-circle" style={{ fontSize: 28, color: AD.greenText, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: AD.greenText, marginBottom: 2 }}>
                  We found your account: {testResult.accountName}
                </div>
                <div style={{ fontSize: 13, color: AD.textSecondary }}>
                  Is this the correct account?
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryBtn onClick={handleConnectApiKey} loading={connecting}>
                <i className="ph ph-check" style={{ fontSize: 14 }} /> Connect {testResult.accountName}
              </PrimaryBtn>
              <OutlineBtn onClick={() => { setApiKeyStep(2); setTestResult(null); }}>
                Go Back
              </OutlineBtn>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Card 3 ── Referrer field mapping ────────────────────────────────────────
  function renderFieldMappingCard() {
    return (
      <Card>
        <SectionHeading>Referrer Field Mapping</SectionHeading>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
          This is the field in your CRM where your team records who referred the customer.
          The name must match exactly — Rooster Booster reads this field to credit the right referrer.
        </p>
        <div style={{ maxWidth: 360, marginBottom: 18 }}>
          <SettingsInput
            label="Referrer Field Name"
            value={fieldName}
            onChange={setFieldName}
            placeholder="e.g. Referred by"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PrimaryBtn onClick={handleSaveFieldName} loading={fieldSaving}>Save</PrimaryBtn>
          {fieldSaved && <span style={{ fontSize: 13, color: AD.greenText }}>Saved ✓</span>}
        </div>
      </Card>
    );
  }

  // ── Card 4 ── Stage mapping ─────────────────────────────────────────────────
  function renderStageMappingCard() {
    return (
      <Card>
        <SectionHeading>Pipeline Stage Mapping</SectionHeading>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px', background: AD.amberBg, borderRadius: AD.radiusMd, marginBottom: 24,
        }}>
          <i className="ph ph-warning" style={{ fontSize: 16, color: AD.amberText, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: AD.amberText, lineHeight: 1.55 }}>
            Stage names must match exactly what appears in your CRM. If a stage is mapped incorrectly,
            referral tracking will stop advancing past that step.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
          {['lead', 'inspection', 'sold', 'paid'].map(stage => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px', minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: AD.textPrimary, textTransform: 'capitalize', marginBottom: 3 }}>
                  {stage}
                </div>
                <div style={{ fontSize: 12, color: AD.textTertiary, lineHeight: 1.45 }}>
                  {STAGE_DESCRIPTIONS[stage]}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
                <SettingsInput
                  value={stageMap[stage] || ''}
                  onChange={val => setStageMap(m => ({ ...m, [stage]: val }))}
                  placeholder={`CRM label for "${stage}"`}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PrimaryBtn onClick={handleSaveStageMap} loading={stageSaving}>Save Stage Mapping</PrimaryBtn>
          {stageSaved && <span style={{ fontSize: 13, color: AD.greenText }}>Saved ✓</span>}
        </div>
      </Card>
    );
  }

  // ── Card 5 ── Sync settings ─────────────────────────────────────────────────
  function renderSyncCard() {
    return (
      <Card>
        <SectionHeading>Sync Settings</SectionHeading>
        <div style={{ fontSize: 13, color: AD.textSecondary, marginBottom: 18 }}>
          Last synced: <span style={{ color: AD.textPrimary }}>{relativeTime(lastSyncedAt)}</span>
          {syncMsg && <span style={{ color: AD.greenText, marginLeft: 10 }}>{syncMsg}</span>}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
            Auto-sync Interval
          </label>
          <select
            value={syncInterval}
            onChange={e => handleSyncIntervalChange(e.target.value)}
            style={{
              background: AD.bgCard, border: `1px solid ${AD.border}`,
              borderRadius: AD.radiusMd, padding: '9px 36px 9px 12px',
              color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans,
              cursor: 'pointer', outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}
          >
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
            <option value={240}>Every 4 hours</option>
          </select>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textTertiary, lineHeight: 1.6 }}>
          Rooster Booster automatically syncs when you log in or open the admin panel, as long as the sync interval has elapsed.
        </p>
        <PrimaryBtn onClick={handleSyncNow} loading={syncing}>
          <i className="ph ph-arrows-clockwise" style={{ fontSize: 14 }} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </PrimaryBtn>
      </Card>
    );
  }

  // ── Card 5b ── Referral program start date ──────────────────────────────────
  async function handleSaveStartDate(dateStr) {
    setStartDateSaving(true);
    setStartDateMessage('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/crm/referral-start-date`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralStartDate: dateStr }),
      });
      const d = await r.json();
      if (d.success) {
        setReferralStartDate(d.referralStartDate);
        if (d.referralStartDate) setStartDateInput(d.referralStartDate.slice(0, 10));
        setStartDateMessage(dateStr ? 'Start date saved ✓' : 'Reset to connection date ✓');
        if (startDateMsgTimer.current) clearTimeout(startDateMsgTimer.current);
        startDateMsgTimer.current = setTimeout(() => setStartDateMessage(''), 3000);
      } else {
        setStartDateMessage('Save failed — ' + (d.error || 'unknown error'));
      }
    } catch {
      setStartDateMessage('Network error — please try again.');
    } finally {
      setStartDateSaving(false);
    }
  }

  function renderStartDateCard() {
    // Placeholder shows connected_at formatted as YYYY-MM-DD so contractor sees the default
    const connectedAtPlaceholder = connectedAt
      ? new Date(connectedAt).toISOString().slice(0, 10)
      : 'e.g. 2026-04-01';

    return (
      <Card>
        <SectionHeading>Referral Program Start Date</SectionHeading>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
          Only clients created in Jobber on or after this date will appear in referrers' pipelines.
          Defaults to the date you connected Jobber.
        </p>
        <div style={{ maxWidth: 260, marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
            Start Date
          </label>
          <input
            type="date"
            value={startDateInput}
            onChange={e => setStartDateInput(e.target.value)}
            placeholder={connectedAtPlaceholder}
            style={{
              width: '100%', padding: '9px 12px',
              background: AD.bgCard, border: `1px solid ${AD.border}`,
              borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
              color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = AD.blueLight; }}
            onBlur={e => { e.target.style.borderColor = AD.border; }}
          />
          {!referralStartDate && connectedAt && (
            <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 5 }}>
              Default: {connectedAtPlaceholder} (connection date)
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PrimaryBtn
            onClick={() => handleSaveStartDate(startDateInput || null)}
            loading={startDateSaving}
            disabled={!startDateInput}
          >
            Save Start Date
          </PrimaryBtn>
          {referralStartDate && (
            <button
              onClick={() => { setStartDateInput(''); handleSaveStartDate(null); }}
              disabled={startDateSaving}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: AD.blueText, fontSize: 13, fontFamily: AD.fontSans,
                cursor: startDateSaving ? 'not-allowed' : 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reset to connection date
            </button>
          )}
          {startDateMessage && (
            <span style={{ fontSize: 13, color: startDateMessage.includes('failed') || startDateMessage.includes('error') ? AD.red2Text : AD.greenText }}>
              {startDateMessage}
            </span>
          )}
        </div>
      </Card>
    );
  }

  // ── Card 6 ── Danger zone ───────────────────────────────────────────────────
  function renderDangerCard() {
    const description = isOAuth
      ? `Disconnecting removes Rooster Booster's authorization from your ${CRM_LABEL[status?.crmType] || 'CRM'} account. All referral history is preserved. You will need to complete the full OAuth flow to reconnect.`
      : `Disconnecting removes your stored API key from Rooster Booster. Your CRM account is not affected. All referral history is preserved. You can reconnect at any time with a valid API key.`;

    return (
      <Card style={{ borderColor: AD.red2 }}>
        <SectionHeading>Danger Zone</SectionHeading>
        <div style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, marginBottom: 10 }}>
          Disconnect CRM
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
          {description}
        </p>
        <button
          onClick={() => setShowDisconnect(true)}
          style={{
            background: 'transparent', border: `1px solid ${AD.red2}`,
            borderRadius: AD.radiusMd, padding: '10px 20px',
            color: AD.red2Text, fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = AD.red2Bg; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="ph ph-plugs" style={{ fontSize: 14 }} /> Disconnect
        </button>
      </Card>
    );
  }

  // ── Disconnect confirmation modal ────────────────────────────────────────────
  function renderDisconnectModal() {
    if (!showDisconnect) return null;
    const modalDesc = isOAuth
      ? `Removing Rooster Booster's access from ${status?.crmAccountName}. All referral history will be preserved.`
      : `Removing your stored API key. Your CRM account will not be affected and all referral history will be preserved.`;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: AD.bgCard, borderRadius: AD.radiusLg,
          border: `1px solid ${AD.border}`, padding: '32px',
          maxWidth: 400, width: '100%', boxShadow: AD.shadowLg,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, marginBottom: 12 }}>
            Disconnect {status?.crmAccountName || CRM_LABEL[status?.crmType]}?
          </div>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
            {modalDesc}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <OutlineBtn onClick={() => setShowDisconnect(false)}>Cancel</OutlineBtn>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                background: disconnecting ? '#7f1d1d' : AD.red2,
                border: 'none', borderRadius: AD.radiusMd, padding: '10px 20px',
                color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: AD.fontSans,
                cursor: disconnecting ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
            >
              {disconnecting && <i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'crmSpin 0.8s linear infinite' }} />}
              {disconnecting ? 'Disconnecting…' : 'Yes, Disconnect'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Connect card row (shared for not-connected + token-error states) ─────────
  function renderConnectCard() {
    return (
      <Card>
        <SectionHeading>Connect a CRM</SectionHeading>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {renderCRMOptionCard('jobber', true)}
          {renderCRMOptionCard('servicetitan', false)}
          {renderCRMOptionCard('acculynx', false)}
        </div>
        {renderApiKeyFlow()}
      </Card>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`@keyframes crmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {renderStatusCard()}

      {(!isConnected || tokenError) && renderConnectCard()}

      {isConnected && !tokenError && (
        <>
          {renderFieldMappingCard()}
          {renderStageMappingCard()}
          {renderSyncCard()}
          {renderStartDateCard()}
          {renderDangerCard()}
        </>
      )}

      {renderDisconnectModal()}
    </div>
  );
}
