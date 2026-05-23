import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { Btn } from './AdminComponents';

const sectionLabel = {
  margin: '0 0 16px', fontSize: 13, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textSecondary,
};

const sectionCard = {
  background: AD.bgCard, border: `1px solid ${AD.border}`,
  borderRadius: 16, padding: '20px 24px',
  marginBottom: 20, boxShadow: AD.shadowSm,
};

export default function AdminSettingsExperience() {
  // Load the full about payload so we preserve all fields on save
  const [aboutPayload,   setAboutPayload]   = useState(null);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saveStatus,     setSaveStatus]     = useState('');

  const [engagementPayload,     setEngagementPayload]     = useState(null);
  const [experienceFlowEnabled, setExperienceFlowEnabled] = useState(false);
  const [efLoading,             setEfLoading]             = useState(true);
  const [efSaving,              setEfSaving]              = useState(false);
  const [efSaveStatus,          setEfSaveStatus]          = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/about`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        setAboutPayload(d);
        setBookingEnabled(d.booking_enabled ?? false);
      } catch {
        // swallow
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/engagement-settings`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        setEngagementPayload(d);
        setExperienceFlowEnabled(d.experience_flow_enabled ?? false);
      } catch {
        // swallow
      } finally {
        setEfLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true); setSaveStatus('');
    try {
      const payload = { ...(aboutPayload || {}), booking_enabled: bookingEnabled };
      const r = await fetch(`${BACKEND_URL}/api/admin/about`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      setSaveStatus(d.success ? 'saved' : 'error');
      if (d.success) setAboutPayload(prev => ({ ...(prev || {}), booking_enabled: bookingEnabled }));
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }

  async function handleSaveExperience() {
    setEfSaving(true); setEfSaveStatus('');
    try {
      const payload = { ...(engagementPayload || {}), experience_flow_enabled: experienceFlowEnabled };
      const r = await fetch(`${BACKEND_URL}/api/admin/engagement-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      setEfSaveStatus(d.success ? 'saved' : 'error');
      if (d.success) setEngagementPayload(prev => ({ ...(prev || {}), experience_flow_enabled: experienceFlowEnabled }));
    } catch {
      setEfSaveStatus('error');
    } finally {
      setEfSaving(false);
      setTimeout(() => setEfSaveStatus(''), 3000);
    }
  }

  return (
    <>
      {/* ── SECTION 1: Booking Requests ── */}
      <p style={sectionLabel}>Booking Requests</p>

      <div style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Enable Booking Feature</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>
            When enabled, referrers can submit booking requests directly from the app.
          </p>
        </div>
        <button
          onClick={() => setBookingEnabled(v => !v)}
          disabled={loading}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: bookingEnabled ? '#2D8B5F' : AD.bgCardTint, position: 'relative', cursor: loading ? 'default' : 'pointer', transition: 'background 0.2s', flexShrink: 0, opacity: loading ? 0.5 : 1 }}
        >
          <div style={{ position: 'absolute', top: 3, left: bookingEnabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <Btn onClick={handleSave} variant="accent" size="lg" disabled={loading}>
          {saving
            ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            : <><i className="ph ph-floppy-disk" /> Save Booking Settings</>
          }
        </Btn>
        {saveStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved</span>}
        {saveStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* ── SECTION 2: Customer Experience ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>Customer Experience</p>

      <div style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Customer Experience Flow</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>
            When enabled, customers who complete a paid invoice will automatically receive a feedback prompt. Keep this OFF during development and testing — only enable when the app is live.
          </p>
        </div>
        <button
          onClick={() => setExperienceFlowEnabled(v => !v)}
          disabled={efLoading || !engagementPayload}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: experienceFlowEnabled ? '#2D8B5F' : AD.bgCardTint, position: 'relative', cursor: (efLoading || !engagementPayload) ? 'default' : 'pointer', transition: 'background 0.2s', flexShrink: 0, opacity: (efLoading || !engagementPayload) ? 0.5 : 1 }}
        >
          <div style={{ position: 'absolute', top: 3, left: experienceFlowEnabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <Btn onClick={handleSaveExperience} variant="accent" size="lg" disabled={efLoading || !engagementPayload}>
          {efSaving
            ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            : <><i className="ph ph-floppy-disk" /> Save Experience Settings</>
          }
        </Btn>
        {efSaveStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved</span>}
        {efSaveStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* ── SECTION 3: Referrer App Features (placeholder) ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>Referrer App Features</p>
      <div style={{ ...sectionCard, display: 'flex', alignItems: 'flex-start', gap: 16, opacity: 0.65 }}>
        <i className="ph ph-layout" style={{ fontSize: 24, color: AD.textTertiary, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>Feature Controls</p>
          <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
            Additional referrer-facing feature controls will appear here as new features are released.
          </p>
          <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 8px', borderRadius: 99, background: AD.bgCardTint, color: AD.textTertiary, fontSize: 11, fontFamily: AD.fontSans }}>Coming soon</span>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
