import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { Btn } from './AdminComponents';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';
import { R } from '../../constants/theme';

const PRESET_MESSAGES = {
  preset_1: "Great news — your $[Amount] payout for referring [Referred Name] has been approved and is on its way! We appreciate you so much.",
  preset_2: "Your cashout request of $[Amount] for referring [Referred Name] has been approved. Thank you for being part of the Accent Roofing family.",
};

function resolveMessage(settings, referrerFirstName, amount, referredName) {
  let template = '';
  if (settings.mode === 'custom' && settings.custom_message) {
    template = `Hey ${referrerFirstName}, ${settings.custom_message}`;
  } else {
    template = PRESET_MESSAGES[settings.mode] || PRESET_MESSAGES.preset_1;
  }
  return template
    .replace(/\[First Name\]/g, referrerFirstName)
    .replace(/\[Amount\]/g, `$${parseFloat(amount).toLocaleString()}`)
    .replace(/\[Referred Name\]/g, referredName);
}

function AnnouncementPreviewPopup({ announcement, referrerFirstName, onDismiss, settings }) {
  const [cardVisible, setCardVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!announcement || !settings) return null;
  const message = resolveMessage(settings, referrerFirstName, announcement.amount, announcement.referredName);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(1,40,84,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 28px', width: '100%', maxWidth: 360, boxShadow: '0 12px 48px rgba(1,40,84,0.3)', textAlign: 'center', opacity: cardVisible ? 1 : 0, transform: cardVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 400ms ease-out, transform 400ms ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
          <img src={accentRoofingLogo} alt="Accent Roofing Service" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.1)' }} />
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.6, color: R.textPrimary, fontFamily: R.fontBody }}>{message}</p>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: R.navy, fontFamily: R.fontMono, letterSpacing: '-0.02em' }}>${parseFloat(announcement.amount).toLocaleString()}</span>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: R.textSecondary }}>for referring {announcement.referredName}</p>
        </div>
        <button onClick={onDismiss} style={{ width: '100%', marginBottom: 12, background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`, border: 'none', borderRadius: 12, padding: '14px 24px', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: R.fontSans, cursor: 'pointer', boxShadow: '0 4px 14px rgba(204,0,0,0.35)' }}>
          <i className="ph ph-users" style={{ fontSize: 16, marginRight: 8 }} />
          Refer Another Friend
        </button>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', padding: '8px', color: R.textMuted, fontSize: 14, cursor: 'pointer', fontFamily: R.fontBody }}>I'll check it out later</button>
      </div>
    </div>
  );
}

const PREVIEW_NAMES = ['Paige Turner', 'Grant Gable', 'Nail Armstrong', 'Victor Valley', 'Pete Pitch'];

const sectionLabel = {
  margin: '0 0 16px', fontSize: 13, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textSecondary,
};

const sectionCard = {
  background: AD.bgCard, border: `1px solid ${AD.border}`,
  borderRadius: 16, padding: '20px 24px',
  marginBottom: 20, boxShadow: AD.shadowSm,
};

function PlaceholderCard({ icon, title, body }) {
  return (
    <div style={{ ...sectionCard, display: 'flex', alignItems: 'flex-start', gap: 16, opacity: 0.65, marginBottom: 0 }}>
      <i className={`ph ${icon}`} style={{ fontSize: 24, color: AD.textTertiary, flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>{title}</p>
        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>{body}</p>
        <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 8px', borderRadius: 99, background: AD.bgCardTint, color: AD.textTertiary, fontSize: 11, fontFamily: AD.fontSans }}>Coming soon</span>
      </div>
    </div>
  );
}

export default function AdminSettingsNotifications() {
  const [enabled,       setEnabled]       = useState(true);
  const [mode,          setMode]          = useState('preset_1');
  const [customMessage, setCustomMessage] = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saveStatus,    setSaveStatus]    = useState('');
  const [previewNameIdx, setPreviewNameIdx] = useState(PREVIEW_NAMES.length - 1);
  const [showPreview,   setShowPreview]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        setEnabled(d.enabled ?? true);
        setMode(d.mode || 'preset_1');
        setCustomMessage(d.custom_message || '');
      } catch {
        // swallow
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true); setSaveStatus('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify({ enabled, mode, customMessage }),
      });
      const d = await r.json();
      setSaveStatus(d.success ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      await fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify({ enabled: next, mode, customMessage }),
      });
    } catch {
      // swallow
    }
  }

  const modeOptions = [
    { value: 'preset_1', label: 'Preset 1 — Warm',        preview: PRESET_MESSAGES.preset_1 },
    { value: 'preset_2', label: 'Preset 2 — Professional', preview: PRESET_MESSAGES.preset_2 },
    { value: 'custom',   label: 'Custom',                  preview: '' },
  ];

  const previewSettings    = { enabled, mode, custom_message: customMessage };
  const previewName        = PREVIEW_NAMES[previewNameIdx];
  const previewAnnouncement = { id: 0, amount: 500, referredName: 'Sample Client' };

  return (
    <>
      {/* ── SECTION 1: In-App Announcements ── */}
      <p style={sectionLabel}>In-App Announcements</p>

      {/* Enable toggle */}
      <div style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Enable payout popup</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>When enabled, referrers see a celebration popup on next login after cashout approval.</p>
        </div>
        <button onClick={handleToggle} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: enabled ? '#2D8B5F' : AD.bgCardTint, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: enabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      {/* Message mode */}
      <div style={sectionCard}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Message style</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modeOptions.map(opt => (
            <button key={opt.value} onClick={() => setMode(opt.value)} style={{ background: mode === opt.value ? AD.bgCardTint : 'transparent', border: `1.5px solid ${mode === opt.value ? AD.blueLight : AD.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', fontFamily: AD.fontSans }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: opt.value !== 'custom' ? 6 : 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${mode === opt.value ? AD.blueLight : AD.borderStrong}`, background: mode === opt.value ? AD.blueLight : 'transparent' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: AD.textPrimary }}>{opt.label}</span>
              </div>
              {opt.preview && <p style={{ margin: '0 0 0 24px', fontSize: 12, color: AD.textSecondary, lineHeight: 1.5 }}>{opt.preview}</p>}
            </button>
          ))}
        </div>
        {mode === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textSecondary }}>
              <span style={{ fontWeight: 600, color: AD.textPrimary }}>Hey [First Name],</span>&nbsp;<span style={{ color: AD.textTertiary }}>(locked opener)</span>
            </p>
            <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="your payout has been approved and is heading your way!" rows={4} style={{ width: '100%', padding: '10px 12px', background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`, borderRadius: 10, fontFamily: AD.fontSans, fontSize: 14, color: AD.textPrimary, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} onFocus={e => e.target.style.borderColor = AD.blueLight} onBlur={e => e.target.style.borderColor = AD.borderStrong} />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: AD.textTertiary }}>Tokens: [First Name], [Amount], [Referred Name]</p>
          </div>
        )}
      </div>

      {/* Live preview */}
      <div style={sectionCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Live preview</p>
          <Btn onClick={() => { setPreviewNameIdx(i => (i + 1) % PREVIEW_NAMES.length); setShowPreview(true); }} variant="outline" size="sm">
            <i className="ph ph-eye" /> Preview
          </Btn>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, lineHeight: 1.6 }}>
          {resolveMessage(previewSettings, previewName.split(' ')[0], 500, 'Sample Client')}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.textTertiary }}>Preview name: {previewName} · Amount: $500</p>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <Btn onClick={handleSave} variant="accent" size="lg">
          {saving ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</> : <><i className="ph ph-floppy-disk" /> Save Settings</>}
        </Btn>
        {saveStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved</span>}
        {saveStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* ── SECTION 2: Email Notifications ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>Email Notifications</p>
      <PlaceholderCard
        icon="ph-envelope"
        title="Email Notification Controls"
        body="Configure which email notifications are sent to referrers and admins. Toggle individual notifications on or off."
      />

      <div style={{ marginBottom: 32 }} />

      {/* ── SECTION 3: SMS Notifications ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>SMS Notifications</p>
      <PlaceholderCard
        icon="ph-device-mobile"
        title="SMS Notifications"
        body="SMS notifications will be available once Twilio 10DLC registration is complete."
      />

      <div style={{ marginBottom: 32 }} />

      {/* ── SECTION 4: Push Notifications ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>Push Notifications</p>
      <PlaceholderCard
        icon="ph-bell"
        title="Push Notifications"
        body="Push notifications will be available with the native mobile app."
      />

      {/* Full-screen preview overlay */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }} onClick={() => setShowPreview(false)} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <AnnouncementPreviewPopup announcement={previewAnnouncement} referrerFirstName={previewName.split(' ')[0]} onDismiss={() => setShowPreview(false)} settings={previewSettings} />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
