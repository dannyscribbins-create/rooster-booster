import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';

const VALID_KEYS = ['work_category', 'job_source', 'material_type', 'assigned_rep'];
const KEY_LABELS = {
  work_category: 'Work category',
  job_source:    'Job source',
  material_type: 'Material type',
  assigned_rep:  'Assigned rep',
};

function getSelectionsFromFieldsAndMappings(fields, mappings) {
  // Build reverse lookup: Jobber field label → RoofMiles key
  const reverse = {};
  for (const [key, label] of Object.entries(mappings)) {
    reverse[label] = key;
  }
  const initial = {};
  for (const field of fields) {
    initial[field.label] = reverse[field.label] || '';
  }
  return initial;
}

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      background: type === 'success' ? AD.greenBg : AD.red2Bg,
      color: type === 'success' ? AD.greenText : AD.red2Text,
      border: `1px solid ${type === 'success' ? AD.green : AD.red2}30`,
      borderRadius: 10, padding: '12px 18px',
      fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
      boxShadow: AD.shadowMd,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className={`ph ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 16 }} />
      {message}
    </div>
  );
}

export default function AdminCRMSettings({ setLoggedIn }) {
  const [fields, setFields]           = useState([]);
  const [selections, setSelections]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [noToken, setNoToken]         = useState(false);

  const token = sessionStorage.getItem('rb_admin_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [fieldsRes, mappingsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/admin/jobber/fields`, { headers }),
          fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, { headers }),
        ]);
        const fieldsData   = await fieldsRes.json();
        const mappingsData = await mappingsRes.json();
        const loadedFields   = fieldsData.fields || [];
        const loadedMappings = mappingsData.mappings || {};
        setFields(loadedFields);
        setSelections(getSelectionsFromFieldsAndMappings(loadedFields, loadedMappings));
      } catch {
        showToast('Failed to load field data.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDiscover() {
    setDiscovering(true);
    setNoToken(false);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/admin/jobber/discover-fields`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_token') {
          setNoToken(true);
        } else {
          showToast(data.error || 'Discovery failed.', 'error');
        }
        return;
      }
      const discovered = data.fields || [];
      // Fetch current mappings so pre-population stays accurate after re-discovery
      const mappingsRes  = await fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, { headers });
      const mappingsData = await mappingsRes.json();
      const currentMappings = mappingsData.mappings || {};
      setFields(discovered);
      setSelections(getSelectionsFromFieldsAndMappings(discovered, currentMappings));
      showToast(`${discovered.length} field${discovered.length === 1 ? '' : 's'} discovered.`);
    } catch {
      showToast('Discovery request failed.', 'error');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Build forward mapping: RoofMiles key → Jobber field label (only selected, non-empty)
      const payload = {};
      for (const [fieldLabel, roofmilesKey] of Object.entries(selections)) {
        if (roofmilesKey && VALID_KEYS.includes(roofmilesKey)) {
          payload[roofmilesKey] = fieldLabel;
        }
      }
      const res  = await fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, {
        method: 'PATCH', headers, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Save failed.', 'error');
        return;
      }
      showToast('Mappings saved.');
    } catch {
      showToast('Save request failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = {
    background: AD.bgCard, border: `1px solid ${AD.border}`,
    borderRadius: 16, padding: '24px 28px',
    boxShadow: AD.shadowSm, marginBottom: 24,
  };

  const sectionTitleStyle = {
    fontSize: 16, fontWeight: 600, color: AD.textPrimary,
    fontFamily: AD.fontSans, margin: 0,
  };

  const dropdownStyle = {
    background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
    borderRadius: 8, color: AD.textPrimary, fontFamily: AD.fontSans,
    fontSize: 14, padding: '7px 10px', outline: 'none',
    cursor: 'pointer', width: '100%', maxWidth: 240,
    appearance: 'auto',
  };

  return (
    <div style={{ fontFamily: AD.fontSans, color: AD.textPrimary }}>
      <AdminPageHeader
        title="CRM Settings"
        subtitle="Field discovery and campaign mapping"
      />

      {/* ── Pipeline Stage Mapping (placeholder) ─────────────────────────────── */}
      <div style={cardStyle}>
        <p style={{ ...sectionTitleStyle, marginBottom: 12 }}>Pipeline Stage Mapping</p>
        <p style={{ color: AD.textSecondary, fontSize: 14, margin: 0 }}>
          Pipeline stage mapping coming soon.
        </p>
      </div>

      {/* ── Campaign Field Mapping ────────────────────────────────────────────── */}
      <div style={cardStyle}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <p style={sectionTitleStyle}>Campaign Field Mapping</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              onClick={handleDiscover}
              variant="outline"
              size="sm"
              style={{ opacity: discovering ? 0.7 : 1, pointerEvents: discovering ? 'none' : 'auto' }}
            >
              <i className={`ph ${discovering ? 'ph-circle-notch' : 'ph-arrows-clockwise'}`}
                style={{ fontSize: 14, animation: discovering ? 'spin 0.8s linear infinite' : 'none' }} />
              {discovering ? 'Discovering...' : 'Re-run Discovery'}
            </Btn>
            <Btn
              onClick={handleSave}
              variant="primary"
              size="sm"
              style={{ opacity: saving ? 0.7 : 1, pointerEvents: saving ? 'none' : 'auto' }}
            >
              <i className="ph ph-floppy-disk" style={{ fontSize: 14 }} />
              {saving ? 'Saving...' : 'Save Mappings'}
            </Btn>
          </div>
        </div>

        <p style={{ color: AD.textSecondary, fontSize: 13, marginBottom: 20, margin: '0 0 20px' }}>
          Map your Jobber custom fields to RoofMiles concepts so the campaign builder knows how to filter and personalize your outreach.
        </p>

        {/* No token warning */}
        {noToken && (
          <div style={{
            background: AD.amberBg, border: `1px solid ${AD.amber}30`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            color: AD.amberText, fontSize: 13,
          }}>
            <i className="ph ph-warning" style={{ fontSize: 16, flexShrink: 0 }} />
            Connect your Jobber account first to discover fields.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: AD.textTertiary, fontSize: 14 }}>
            <i className="ph ph-circle-notch" style={{ fontSize: 20, animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: '8px 0 0' }}>Loading fields…</p>
          </div>
        ) : fields.length === 0 ? (
          /* Empty state */
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: AD.bgCardTint, borderRadius: 12,
            border: `1px dashed ${AD.borderStrong}`,
          }}>
            <i className="ph ph-plugs" style={{ fontSize: 36, color: AD.textTertiary, display: 'block', marginBottom: 10 }} />
            <p style={{ color: AD.textSecondary, margin: '0 0 16px', fontSize: 14 }}>
              No Jobber fields discovered yet.
            </p>
            <Btn onClick={handleDiscover} variant="primary" size="md"
              style={{ opacity: discovering ? 0.7 : 1, pointerEvents: discovering ? 'none' : 'auto' }}>
              <i className={`ph ${discovering ? 'ph-circle-notch' : 'ph-magnifying-glass'}`}
                style={{ fontSize: 15, animation: discovering ? 'spin 0.8s linear infinite' : 'none' }} />
              {discovering ? 'Discovering...' : 'Run Discovery'}
            </Btn>
          </div>
        ) : (
          /* Field mapping table */
          <div style={{ border: `1px solid ${AD.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              padding: '10px 16px', background: AD.bgCardTint,
              borderBottom: `1px solid ${AD.border}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your Jobber Field
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Maps to in RoofMiles
              </span>
            </div>
            {/* Table rows */}
            {fields.map((field, i) => (
              <div key={field.jobber_field_id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                padding: '12px 16px', alignItems: 'center',
                borderBottom: i < fields.length - 1 ? `1px solid ${AD.border}` : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}>
                <div>
                  <span style={{ fontSize: 14, color: AD.textPrimary }}>{field.label}</span>
                  {field.field_type && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: AD.textTertiary }}>
                      {field.field_type}
                    </span>
                  )}
                </div>
                <select
                  value={selections[field.label] || ''}
                  onChange={e => setSelections(s => ({ ...s, [field.label]: e.target.value }))}
                  style={dropdownStyle}
                >
                  <option value="">Don't use in campaigns</option>
                  {VALID_KEYS.map(key => (
                    <option key={key} value={key}>{KEY_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
