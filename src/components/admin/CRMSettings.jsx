import { useState, useEffect, useRef, useCallback } from 'react';
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

// ── Campaign field mapping constants ─────────────────────────────────────────

const CFM_VALID_KEYS = ['work_category', 'job_source', 'material_type', 'assigned_rep'];
const CFM_KEY_LABELS = {
  work_category: 'Work category',
  job_source:    'Job source',
  material_type: 'Material type',
  assigned_rep:  'Assigned rep',
};

function cfmSelectionsFromMappings(fields, mappings) {
  const reverse = {};
  for (const [key, label] of Object.entries(mappings)) reverse[label] = key;
  const initial = {};
  for (const field of fields) initial[field.label] = reverse[field.label] || '';
  return initial;
}

function CfmToast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      background: type === 'success' ? AD.greenBg : AD.red2Bg,
      color: type === 'success' ? AD.greenText : AD.red2Text,
      border: `1px solid ${(type === 'success' ? AD.green : AD.red2)}30`,
      borderRadius: 10, padding: '12px 18px',
      fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
      boxShadow: AD.shadowLg,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className={`ph ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 16 }} />
      {message}
    </div>
  );
}

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

  // Campaign field mapping
  const [cfmFields, setCfmFields]           = useState([]);
  const [cfmSelections, setCfmSelections]   = useState({});
  const [cfmLoading, setCfmLoading]         = useState(true);
  const [cfmDiscovering, setCfmDiscovering] = useState(false);
  const [cfmSaving, setCfmSaving]           = useState(false);
  const [cfmToast, setCfmToast]             = useState(null);
  const [cfmNoToken, setCfmNoToken]         = useState(false);
  const [cfmOpen, setCfmOpen]               = useState(false);

  // Import flow
  const [importPhase, setImportPhase]           = useState('idle'); // 'idle'|'modal'|'running'|'results_success'|'results_error'
  const [importFilterMode, setImportFilterMode] = useState('recommended');
  const [importCustomDate, setImportCustomDate] = useState('');
  const [importPosting, setImportPosting]       = useState(false);
  const [importInlineError, setImportInlineError] = useState('');
  const [importCounters, setImportCounters]     = useState({ totalFound: 0, imported: 0, tagged: 0, matchingProcessed: 0, matchingLinked: 0, matchingTotal: 0 });
  const [importLastResult, setImportLastResult] = useState(null);
  const [importErrorMsg, setImportErrorMsg]     = useState('');

  const fieldSavedTimer     = useRef(null);
  const syncMsgTimer        = useRef(null);
  const startDateMsgTimer   = useRef(null);
  const importPollRef       = useRef(null);

  const cfmShowToast    = useCallback((message, type = 'success') => setCfmToast({ message, type }), []);
  const cfmDismissToast = useCallback(() => setCfmToast(null), []);

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

  // Clear import poll interval on unmount
  useEffect(() => {
    return () => {
      if (importPollRef.current) clearInterval(importPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume import progress UI on mount if an import is already running on the server.
  // Covers the case where an admin navigates away mid-import and returns to this page.
  useEffect(() => {
    async function checkImportStatusOnMount() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/jobber-import-status`, {
          headers: authHeaders(),
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'running') {
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: 0, matchingLinked: 0, matchingTotal: 0 });
          setImportPhase('running');
          startImportPolling();
        } else if (d.status === 'matching') {
          const mp = d.matchingProgress || {};
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: mp.processed || 0, matchingLinked: mp.linked || 0, matchingTotal: mp.total || 0 });
          setImportPhase('matching');
          startImportPolling();
        } else if (d.status === 'complete' && d.totalFound > 0) {
          const mp = d.matchingProgress || {};
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: mp.processed || 0, matchingLinked: d.linksEstablished || 0, matchingTotal: mp.total || 0 });
          setImportLastResult({
            totalFound: d.totalFound,
            imported: d.imported,
            tagged: d.tagged,
            linksEstablished: d.linksEstablished || 0,
            date: new Date().toLocaleDateString(),
          });
          setImportPhase('results_success');
        } else if (d.status === 'error' && d.errorMessage) {
          setImportErrorMsg(d.errorMessage);
          setImportPhase('results_error');
        }
        // 'idle' or no active import → leave importPhase as 'idle', button shows
      } catch { /* if status check fails on mount, show the button */ }
    }
    checkImportStatusOnMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCampaignFields() {
    setCfmLoading(true);
    try {
      const [fieldsRes, mappingsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/jobber/fields`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, { headers: authHeaders() }),
      ]);
      const fieldsData   = await fieldsRes.json();
      const mappingsData = await mappingsRes.json();
      const loadedFields   = fieldsData.fields || [];
      const loadedMappings = mappingsData.mappings || {};
      setCfmFields(loadedFields);
      setCfmSelections(cfmSelectionsFromMappings(loadedFields, loadedMappings));
    } catch {
      cfmShowToast('Failed to load field data.', 'error');
    } finally {
      setCfmLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCampaignFields(); }, []);

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

  async function handleCfmDiscover() {
    setCfmDiscovering(true);
    setCfmNoToken(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/jobber/discover-fields`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_token') {
          setCfmNoToken(true);
        } else {
          cfmShowToast(data.error || 'Discovery failed.', 'error');
        }
        return;
      }
      const discovered = data.fields || [];
      const mappingsRes  = await fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, { headers: authHeaders() });
      const mappingsData = await mappingsRes.json();
      setCfmFields(discovered);
      setCfmSelections(cfmSelectionsFromMappings(discovered, mappingsData.mappings || {}));
      cfmShowToast(`${discovered.length} field${discovered.length === 1 ? '' : 's'} discovered.`);
    } catch {
      cfmShowToast('Discovery request failed.', 'error');
    } finally {
      setCfmDiscovering(false);
    }
  }

  async function handleCfmSave() {
    setCfmSaving(true);
    try {
      const payload = {};
      for (const [fieldLabel, key] of Object.entries(cfmSelections)) {
        if (key && CFM_VALID_KEYS.includes(key)) payload[key] = fieldLabel;
      }
      const res = await fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { cfmShowToast(data.error || 'Save failed.', 'error'); return; }
      cfmShowToast('Mappings saved.');
    } catch {
      cfmShowToast('Save request failed.', 'error');
    } finally {
      setCfmSaving(false);
    }
  }

  // ── Import flow handlers ─────────────────────────────────────────────────────
  function openImportModal() {
    setImportFilterMode('recommended');
    setImportCustomDate('');
    setImportInlineError('');
    setImportPhase('modal');
  }

  function closeImportModal() {
    setImportFilterMode('recommended');
    setImportCustomDate('');
    setImportInlineError('');
    setImportPhase('idle');
  }

  function startImportPolling() {
    if (importPollRef.current) clearInterval(importPollRef.current);
    importPollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/jobber-import-status`, {
          headers: authHeaders(),
        });
        const d = await r.json();
        if (d.status === 'running') {
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: 0, matchingLinked: 0, matchingTotal: 0 });
        } else if (d.status === 'matching') {
          const mp = d.matchingProgress || {};
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: mp.processed || 0, matchingLinked: mp.linked || 0, matchingTotal: mp.total || 0 });
          setImportPhase('matching');
        } else if (d.status === 'complete') {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
          const mp = d.matchingProgress || {};
          setImportCounters({ totalFound: d.totalFound, imported: d.imported, tagged: d.tagged, matchingProcessed: mp.processed || 0, matchingLinked: d.linksEstablished || 0, matchingTotal: mp.total || 0 });
          setImportLastResult({
            totalFound: d.totalFound,
            imported: d.imported,
            tagged: d.tagged,
            linksEstablished: d.linksEstablished || 0,
            date: new Date().toLocaleDateString(),
          });
          setImportPhase('results_success');
        } else if (d.status === 'error') {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
          setImportErrorMsg(d.errorMessage || 'An error occurred during import. Please try again.');
          setImportPhase('results_error');
        }
      } catch { /* network error during poll — keep polling */ }
    }, 3000);
  }

  async function handleStartImport() {
    setImportPosting(true);
    setImportInlineError('');
    const filterPreference = {
      mode: importFilterMode,
      customDate: importFilterMode === 'custom_date' ? importCustomDate : null,
    };
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/jobber-full-import`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterPreference }),
      });
      if (r.status === 202) {
        setImportPhase('running');
        setImportCounters({ totalFound: 0, imported: 0, tagged: 0, matchingProcessed: 0, matchingLinked: 0 });
        startImportPolling();
      } else if (r.status === 409) {
        setImportInlineError('An import is already running. Check back shortly.');
      } else {
        setImportInlineError('Something went wrong. Please try again.');
      }
    } catch {
      setImportInlineError('Something went wrong. Please try again.');
    } finally {
      setImportPosting(false);
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

  // ── Card 4 ── Pipeline stage transparency ──────────────────────────────────
  function renderStageMappingCard() {
    const pipelineStages = [
      { name: 'Lead',               description: 'Referral submitted — appointment not yet scheduled', trigger: 'Client created in Jobber' },
      { name: 'Inspection',         description: 'Site visit or estimate has been scheduled',          trigger: 'Quote created in Jobber' },
      { name: 'Sold',               description: 'Job approved and work is in progress',              trigger: 'Job created in Jobber' },
      { name: 'Pending Completion', description: 'Work complete — awaiting payment',                  trigger: 'Job archived, invoice not yet paid' },
      { name: 'Complete ✓',         description: 'Invoice paid — referral bonus triggered',           trigger: 'Invoice marked paid in Jobber' },
      { name: 'Not Sold',           description: 'Client did not proceed',                            trigger: 'All quotes archived, no job created' },
    ];

    const cardStatuses = [
      { name: 'In App',       description: "Your referral downloaded the app via a referrer's personal link but hasn't been scheduled yet" },
      { name: 'Booking Sent', description: "Your referral submitted a booking request through the app — awaiting entry in your CRM" },
    ];

    return (
      <Card>
        <SectionHeading>Pipeline Stage Mapping</SectionHeading>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: AD.textTertiary, lineHeight: 1.6 }}>
          RoofMiles automatically tracks referral progress based on activity in your connected CRM.
          Here's exactly how your referrers see each stage.
        </p>

        {/* Sub-section A — Referral Pipeline Stages */}
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 12,
        }}>
          Referral Pipeline Stages
        </div>
        <div style={{ border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd, overflow: 'hidden', marginBottom: 28 }}>
          {pipelineStages.map((stage, i) => (
            <div key={stage.name} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr',
              padding: '14px 16px', alignItems: 'start',
              borderBottom: i < pipelineStages.length - 1 ? `1px solid ${AD.border}` : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: AD.textPrimary, paddingRight: 12, lineHeight: 1.4 }}>
                {stage.name}
              </div>
              <div>
                <div style={{ fontSize: 13, color: AD.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>
                  {stage.description}
                </div>
                <div style={{ fontSize: 12, color: AD.textTertiary }}>
                  {'Triggered by: '}
                  <span style={{
                    display: 'inline-block', padding: '1px 7px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${AD.border}`,
                    fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: AD.textTertiary,
                  }}>
                    {stage.trigger}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sub-section B — Card Status Indicators */}
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 8,
        }}>
          Card Status Indicators
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: AD.textTertiary, lineHeight: 1.55 }}>
          These appear on individual referral cards in the app — they are not pipeline stage pills
          and do not advance the progress bar.
        </p>
        <div style={{ border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd, overflow: 'hidden' }}>
          {cardStatuses.map((item, i) => (
            <div key={item.name} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr',
              padding: '14px 16px', alignItems: 'start',
              borderBottom: i < cardStatuses.length - 1 ? `1px solid ${AD.border}` : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: AD.textPrimary, paddingRight: 12, lineHeight: 1.4 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 13, color: AD.textSecondary, lineHeight: 1.5 }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // ── Card 4b ── Campaign field mapping ──────────────────────────────────────
  function renderCampaignFieldMappingCard() {
    const mappedCount    = Object.values(cfmSelections).filter(v => v).length;
    const isCollapsible  = cfmFields.length > 0;
    const showBody       = !isCollapsible || cfmOpen;
    const crmDisplayName = status?.crmType
      ? (CRM_LABEL[status.crmType] || status.crmType)
      : null;

    return (
      <Card>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isCollapsible ? 'pointer' : 'default', flex: 1 }}
            onClick={() => isCollapsible && setCfmOpen(o => !o)}
          >
            {isCollapsible && (
              <i
                className={`ph ${cfmOpen ? 'ph-caret-up' : 'ph-caret-down'}`}
                style={{ fontSize: 14, color: AD.textTertiary, flexShrink: 0 }}
              />
            )}
            <div>
              <SectionHeading>{`CRM FIELD MAPPING${crmDisplayName ? ` — ${crmDisplayName}` : ''}`}</SectionHeading>
              {isCollapsible && !cfmOpen && (
                <span style={{ fontSize: 13, color: AD.textTertiary, display: 'block', marginTop: -10, marginBottom: 4 }}>
                  {cfmFields.length} field{cfmFields.length === 1 ? '' : 's'} discovered · {mappedCount} mapped
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <OutlineBtn onClick={handleCfmDiscover} disabled={cfmDiscovering} style={{ padding: '7px 14px', fontSize: 13 }}>
              <i
                className={`ph ${cfmDiscovering ? 'ph-circle-notch' : 'ph-arrows-clockwise'}`}
                style={{ fontSize: 13, animation: cfmDiscovering ? 'crmSpin 0.8s linear infinite' : 'none' }}
              />
              {cfmDiscovering ? 'Discovering...' : 'Re-run Discovery'}
            </OutlineBtn>
            {showBody && cfmFields.length > 0 && (
              <PrimaryBtn onClick={handleCfmSave} loading={cfmSaving} style={{ padding: '7px 14px', fontSize: 13 }}>
                <i className="ph ph-floppy-disk" style={{ fontSize: 13 }} />
                {cfmSaving ? 'Saving...' : 'Save Mappings'}
              </PrimaryBtn>
            )}
          </div>
        </div>

        {showBody && (
          <div style={{ marginTop: 12 }}>
            {!crmDisplayName ? (
              <p style={{ color: AD.textSecondary, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
                Connect a CRM to configure field mapping.
              </p>
            ) : (
              <p style={{ color: AD.textSecondary, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
                Your {crmDisplayName} account uses custom fields to track job details like work type,
                materials, and lead source. This mapping tells RoofMiles which of your {crmDisplayName} fields
                correspond to these standard concepts — so your contacts are automatically tagged, your
                audiences can filter by job type, and your campaigns can personalize outreach based on real
                job data. Run Discovery any time you add new custom fields in {crmDisplayName}.
              </p>
            )}

            <div style={{ opacity: !crmDisplayName ? 0.4 : 1, pointerEvents: !crmDisplayName ? 'none' : 'auto' }}>

            {cfmNoToken && (
              <div style={{
                background: AD.amberBg, border: `1px solid ${AD.amber}30`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8,
                color: AD.amberText, fontSize: 13,
              }}>
                <i className="ph ph-warning" style={{ fontSize: 16, flexShrink: 0 }} />
                Connect your Jobber account first to discover fields.
              </div>
            )}

            {cfmLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: AD.textTertiary, fontSize: 14 }}>
                <i className="ph ph-circle-notch" style={{ fontSize: 20, animation: 'crmSpin 0.8s linear infinite' }} />
                <p style={{ margin: '8px 0 0' }}>Loading fields…</p>
              </div>
            ) : cfmFields.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 20px',
                background: AD.bgCardTint, borderRadius: 12,
                border: `1px dashed ${AD.border}`,
              }}>
                <i className="ph ph-plugs" style={{ fontSize: 32, color: AD.textTertiary, display: 'block', marginBottom: 10 }} />
                <p style={{ color: AD.textSecondary, margin: '0 0 14px', fontSize: 14 }}>
                  No Jobber fields discovered yet.
                </p>
                <PrimaryBtn onClick={handleCfmDiscover} loading={cfmDiscovering}>
                  <i
                    className={`ph ${cfmDiscovering ? 'ph-circle-notch' : 'ph-magnifying-glass'}`}
                    style={{ fontSize: 14, animation: cfmDiscovering ? 'crmSpin 0.8s linear infinite' : 'none' }}
                  />
                  {cfmDiscovering ? 'Discovering...' : 'Run Discovery'}
                </PrimaryBtn>
              </div>
            ) : (
              <div style={{ border: `1px solid ${AD.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  padding: '8px 16px', background: AD.bgCardTint,
                  borderBottom: `1px solid ${AD.border}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: AD.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Your Jobber Field
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: AD.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Maps to in RoofMiles
                  </span>
                </div>
                {cfmFields.map((field, i) => (
                  <div key={field.jobber_field_id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    padding: '10px 16px', alignItems: 'center',
                    borderBottom: i < cfmFields.length - 1 ? `1px solid ${AD.border}` : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}>
                    <div>
                      <span style={{ fontSize: 14, color: AD.textPrimary }}>{field.label}</span>
                      {field.field_type && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: AD.textTertiary }}>{field.field_type}</span>
                      )}
                    </div>
                    <select
                      value={cfmSelections[field.label] || ''}
                      onChange={e => setCfmSelections(s => ({ ...s, [field.label]: e.target.value }))}
                      style={{
                        background: AD.bgCard, border: `1px solid ${AD.border}`,
                        borderRadius: AD.radiusMd, color: AD.textPrimary,
                        fontFamily: AD.fontSans, fontSize: 14, padding: '7px 10px',
                        outline: 'none', cursor: 'pointer', width: '100%', maxWidth: 240,
                      }}
                    >
                      <option value="">Don't use in campaigns</option>
                      {CFM_VALID_KEYS.map(key => (
                        <option key={key} value={key}>{CFM_KEY_LABELS[key]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            </div>
          </div>
        )}
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

  // ── Import modal (Phase 1) ───────────────────────────────────────────────────
  function renderImportModal() {
    if (importPhase !== 'modal') return null;
    const canStart = importFilterMode !== 'custom_date' || importCustomDate.length > 0;
    const filterOptions = [
      {
        value: 'recommended',
        label: 'Recommended',
        sub: 'Paying clients from all time + active prospects from the last 12 months',
        isDefault: true,
      },
      {
        value: 'paying_only',
        label: 'Paying clients only',
        sub: 'Only clients with at least one paid invoice — no prospects',
      },
      {
        value: 'custom_date',
        label: 'Custom date range',
        sub: 'Paying clients from all time + prospects created after a specific date',
      },
    ];
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: AD.bgCard, borderRadius: AD.radiusLg,
          border: `1px solid ${AD.border}`, padding: '32px',
          maxWidth: 480, width: '100%', boxShadow: AD.shadowLg,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, marginBottom: 8 }}>
            Import Jobber Clients
          </div>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
            Choose which clients to pull from Jobber into RoofMiles.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {filterOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => setImportFilterMode(opt.value)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px', borderRadius: AD.radiusMd,
                  border: `1px solid ${importFilterMode === opt.value ? AD.blueLight : AD.border}`,
                  background: importFilterMode === opt.value ? AD.blueBg : 'transparent',
                  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  border: `2px solid ${importFilterMode === opt.value ? AD.blueLight : AD.border}`,
                  background: importFilterMode === opt.value ? AD.blueLight : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {importFilterMode === opt.value && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: AD.textPrimary }}>{opt.label}</span>
                    {opt.isDefault && (
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        padding: '2px 8px', borderRadius: AD.radiusPill,
                        background: AD.greenBg, color: AD.greenText,
                      }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: AD.textTertiary, lineHeight: 1.5 }}>
                    {opt.sub}
                  </div>
                  {opt.value === 'custom_date' && importFilterMode === 'custom_date' && (
                    <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      <input
                        type="date"
                        value={importCustomDate}
                        onChange={e => setImportCustomDate(e.target.value)}
                        style={{
                          padding: '8px 10px',
                          background: AD.bgCard, border: `1px solid ${AD.border}`,
                          borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
                          color: AD.textPrimary, outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.target.style.borderColor = AD.blueLight; }}
                        onBlur={e => { e.target.style.borderColor = AD.border; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {importInlineError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '10px 14px', background: AD.red2Bg, borderRadius: AD.radiusMd,
            }}>
              <i className="ph ph-warning-circle" style={{ fontSize: 16, color: AD.red2Text, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: AD.red2Text }}>{importInlineError}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <OutlineBtn onClick={closeImportModal}>Cancel</OutlineBtn>
            <PrimaryBtn onClick={handleStartImport} loading={importPosting} disabled={!canStart}>
              Start Import
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  // ── Import section (Phases 2, 3, 4 — in-page card) ───────────────────────────
  function renderImportSection() {
    if (importPhase === 'running') {
      return (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <i className="ph ph-circle-notch" style={{
              fontSize: 24, color: AD.blueText,
              animation: 'crmSpin 0.8s linear infinite', flexShrink: 0,
            }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
              Import in Progress
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40, marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Clients found', value: importCounters.totalFound },
              { label: 'Imported',      value: importCounters.imported },
              { label: 'Tagged',        value: importCounters.tagged },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {stat.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: AD.textTertiary, lineHeight: 1.6 }}>
            This may take a few minutes. You can navigate away — the import will continue in the background.
          </p>
        </Card>
      );
    }

    if (importPhase === 'matching') {
      const matchTotal   = importCounters.matchingTotal || importCounters.totalFound || 0;
      const matchDone    = importCounters.matchingProcessed || 0;
      const barPct       = matchTotal > 0 ? (matchDone / matchTotal) * 100 : 0;
      // Snap to nearest 100 — interval jumps, not smooth crawl
      const snapDone     = Math.round(matchDone / 100) * 100;
      return (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{
              padding: '3px 10px', borderRadius: AD.radiusPill,
              background: '#FAEEDA', color: '#633806',
              fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
            }}>
              Matching…
            </span>
            <i className="ph ph-circle-notch" style={{
              fontSize: 16, color: '#EF9F27',
              animation: 'crmSpin 0.8s linear infinite',
            }} />
          </div>
          <div style={{ background: AD.bgCardTint, borderRadius: 99, height: 8, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: '#EF9F27',
              width: `${barPct}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
              {snapDone.toLocaleString()} / {matchTotal.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: 13, color: AD.textTertiary, marginBottom: 20 }}>
            Finding email and phone matches — establishing contact links
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: AD.greenText }}>
              ✓ {importCounters.imported.toLocaleString()} clients imported
            </span>
            <span style={{ fontSize: 13, color: AD.textSecondary }}>
              {(importCounters.matchingLinked || 0).toLocaleString()} links established
            </span>
          </div>
        </Card>
      );
    }

    if (importPhase === 'results_success') {
      return (
        <Card style={{ borderColor: AD.green }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <i className="ph-duotone ph-check-circle" style={{ fontSize: 28, color: AD.greenText, flexShrink: 0 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
              Import Complete
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40, marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Clients Found', value: importCounters.totalFound },
              { label: 'Imported',      value: importCounters.imported },
              { label: 'Tagged',        value: importCounters.tagged },
              { label: 'Links Made',    value: importCounters.matchingLinked },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {stat.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
            Your Jobber clients are now available in RoofMiles. Tags have been applied and contacts matched to app users automatically.
          </p>
          <PrimaryBtn onClick={() => setImportPhase('idle')}>Done</PrimaryBtn>
        </Card>
      );
    }

    if (importPhase === 'results_error') {
      return (
        <Card style={{ borderColor: AD.amber }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <i className="ph-duotone ph-warning-circle" style={{ fontSize: 28, color: AD.amberText, flexShrink: 0 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
              Import Failed
            </div>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
            {importErrorMsg || 'An error occurred during import. Please try again.'}
          </p>
          <PrimaryBtn onClick={openImportModal}>Try Again</PrimaryBtn>
        </Card>
      );
    }

    // Phase 4 — Idle (fresh or post-completion)
    return (
      <Card>
        <SectionHeading>Jobber Client Import</SectionHeading>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, lineHeight: 1.65 }}>
          {importLastResult
            ? `Last import: ${importLastResult.imported.toLocaleString()} clients imported, ${importLastResult.tagged.toLocaleString()} tagged — ${importLastResult.date}`
            : 'Pull your Jobber clients into RoofMiles to enable outreach, tagging, and audience building.'}
        </p>
        <PrimaryBtn onClick={openImportModal}>
          {importLastResult ? 'Run Import Again' : 'Migrate Client Contacts'}
        </PrimaryBtn>
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
          {renderCampaignFieldMappingCard()}
          {renderImportSection()}
          {renderSyncCard()}
          {renderStartDateCard()}
          {renderDangerCard()}
        </>
      )}

      {renderDisconnectModal()}
      {renderImportModal()}
      {cfmToast && <CfmToast message={cfmToast.message} type={cfmToast.type} onDismiss={cfmDismissToast} />}
    </div>
  );
}
