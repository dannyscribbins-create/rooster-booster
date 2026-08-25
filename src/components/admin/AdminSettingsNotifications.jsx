import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { Btn } from './AdminComponents';
import { R } from '../../constants/theme';
import { useAdminBranding } from '../shared/BrandingProvider';
// ⚠ THE TEMPLATES AND THE RESOLVER NOW HAVE ONE HOME (Admin Brand Retirement
// Phase 4). This file used to carry its own copy whose resolver never
// substituted [Company] — so this preview, whose entire purpose is to show what
// the referrer will see, showed the raw token while the referrer saw the real
// company name. See utils/announcementMessage.js's header for why the
// duplication is what produced that.
import { PRESET_MESSAGES, resolveMessage } from '../../utils/announcementMessage';
import { getAdminToken } from '../../utils/authStorage';

function AnnouncementPreviewPopup({ announcement, referrerFirstName, onDismiss, settings }) {
  // ⚠ READ HERE, IN THE COMPONENT, AND PASSED DOWN AS AN ARGUMENT. resolveMessage
  // is module-level and cannot see this binding — referencing branding inside it
  // is exactly what threw a ReferenceError on every render in 6C.
  const { branding } = useAdminBranding();
  const [cardVisible, setCardVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!announcement || !settings) return null;
  const message = resolveMessage(settings, referrerFirstName, announcement.amount, announcement.referredName, branding.companyName);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,45,77,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 28px', width: '100%', maxWidth: 360, boxShadow: '0 12px 48px rgba(28,45,77,0.3)', textAlign: 'center', opacity: cardVisible ? 1 : 0, transform: cardVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 400ms ease-out, transform 400ms ease-out' }}>
        {/* ⚠ THIS IS A PREVIEW OF AnnouncementPopup, SO IT USES ITS LOCKUP —
            null-guard, fragment, and "the divider goes with the logo". No light
            plate here: this card is white, which is the surface the popup
            actually renders on. A preview that drew a different lockup from the
            thing it previews would be lying about what the referrer sees, which
            is the same defect class as the [Company] token above. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
          {/* ⚠ THIS MIRRORS AnnouncementPopup AND MUST NEVER LEAD IT (5.3).
              The platform mark and its divider came out of the popup, so they come
              out here identically. The reasoning for having no fallback lives at
              the popup; a preview that drew a different lockup from the thing it
              previews would be lying about what the referrer sees. */}
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt={branding.companyName} style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          )}
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.6, color: R.textPrimary, fontFamily: R.fontBody }}>{message}</p>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: R.navy, fontFamily: R.fontMono, letterSpacing: '-0.02em' }}>${parseFloat(announcement.amount).toLocaleString()}</span>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: R.textSecondary }}>for referring {announcement.referredName}</p>
        </div>
        <button onClick={onDismiss} style={{ width: '100%', marginBottom: 12, background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`, border: 'none', borderRadius: 12, padding: '14px 24px', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: R.fontSans, cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' }}>
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

// ── NOTIFICATION TOGGLE GROUPS ────────────────────────────────────────────────
const REFERRER_GROUPS = [
  {
    label: 'Pipeline Updates',
    items: [
      { key: 'first_referral_submitted', label: 'First referral submitted confirmation', desc: "Sent when a referrer's first client enters the pipeline." },
      { key: 'referral_inspection',      label: 'Referral moves to inspection',          desc: 'Sent when a referred client schedules an inspection.' },
      { key: 'referral_sold',            label: 'Referral moves to sold',                desc: 'Sent when a referred client signs.' },
      { key: 'referral_lost',            label: 'Referral lost',                         desc: 'Sent when a referred client goes cold (not_sold).' },
      { key: 'referral_reactivated',     label: 'Dormant referral reactivated',          desc: 'Sent when a previously lost referral re-engages.' },
    ],
  },
  {
    label: 'Rewards',
    items: [
      { key: 'bonus_earned',            label: 'Bonus earned',                    desc: "Sent when an invoice is paid and a bonus posts to the referrer's balance." },
      { key: 'first_reward_milestone',  label: 'First reward milestone',          desc: "Sent alongside the bonus email on the referrer's very first conversion." },
      { key: 'reward_earned_no_account', label: 'Reward earned — no account yet', desc: 'Sent to referrers without an app account when their referral earns a bonus.' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'cashout_request_received', label: 'Cashout request confirmation', desc: 'Sent to the referrer when they submit a cashout request.' },
      { key: 'cashout_approved',         label: 'Cashout approved',             desc: 'Sent to the referrer when their cashout is approved.' },
      { key: 'cashout_denied',           label: 'Cashout denied',               desc: 'Sent to the referrer when their cashout is denied.' },
      { key: 'missing_referral_resolved', label: 'Missing referral resolved',   desc: 'Sent when an admin resolves a missing referral report.' },
      { key: 'profile_photo_uploaded',   label: 'Profile photo uploaded confirmation', desc: 'Sent when a referrer saves a profile photo.' },
    ],
  },
];

const ADMIN_ITEMS = [
  { key: 'new_referrer_signup',    label: 'New referrer signup',                desc: 'Alert when someone creates an account in your referral program.' },
  { key: 'new_referral_detected',  label: 'New referral detected',              desc: 'Alert when a referred client first appears in the pipeline.' },
  { key: 'missing_referral_report', label: 'Missing referral report submitted', desc: 'Alert when a referrer submits a missing referral report.' },
];

const ALWAYS_ACTIVE = [
  'PIN reset confirmation',
  'Account deletion confirmation',
  'Email complaint rate warning',
  'Email bounce rate spike alert',
  'Error monitoring alerts',
];

function NotifToggle({ triggerKey, checked, onToggle, flash, defaultOn = true, label }) {
  // ⚠ THE DEFAULT USED TO BE HARDCODED HERE, AND ONE TRIGGER NEEDS THE OTHER ONE.
  // This read `const on = checked !== false`, which renders a key the server has
  // never heard of as ON. That is right for the fifteen triggers that ship
  // enabled, and exactly wrong for referral_match_outreach, which ships OFF and
  // whose first act if wrongly ON is to mail every referrer in the backlog.
  //
  // The existing call sites pass an already-resolved boolean
  // (`prefs[item.key] !== false`), so they never hit the nullish branch and
  // their behaviour is unchanged. Only a caller passing the RAW pref value —
  // possibly undefined — reaches `defaultOn`.
  const on = (checked === undefined || checked === null) ? defaultOn : checked !== false;
  return (
    <button
      role="switch"
      aria-checked={on}
      // Gives the control an accessible name so tests can query it by role+name
      // rather than walking the DOM from a label, which is how a layout change
      // silently retargets a test at the wrong switch. Only supplied where a
      // caller passes one; the existing switches are unchanged.
      aria-label={label}
      onClick={() => onToggle(triggerKey, !on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
        background: on ? AD.navy : AD.bgCardTint,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
        outline: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 22 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }} />
      {flash === 'saved'  && <span style={{ position: 'absolute', right: 50, top: 2, fontSize: 11, color: AD.greenText, whiteSpace: 'nowrap', fontFamily: AD.fontSans }}>Saved</span>}
      {flash === 'error'  && <span style={{ position: 'absolute', right: 50, top: 2, fontSize: 11, color: AD.red2Text, whiteSpace: 'nowrap', fontFamily: AD.fontSans }}>Failed to save</span>}
    </button>
  );
}

// ── DEEPLINK LANDING (Wave 0.4 item 4) ────────────────────────────────────────
// navRequest is the same shape AdminTeamSettings already uses for the Inbox →
// Manage Team jump: { token } where the token changes on every request, so a
// second jump to a card the admin is already looking at still re-fires. A
// boolean could not do that — it would be true the first time and true the
// second, and nothing would happen.
export default function AdminSettingsNotifications({ navRequest }) {
  // Momentary highlight so arrival is visible. The banner that sent the admin
  // here names one setting on a page of twenty; landing without a cue leaves
  // them scanning for it, which is the whole reason the deeplink exists.
  const [highlightGate, setHighlightGate] = useState(false);
  useEffect(() => {
    if (!navRequest) return;
    const el = document.getElementById('notif-referral-match-outreach');
    // scrollIntoView is absent in jsdom; guarded so the highlight still runs
    // under test rather than throwing past it.
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightGate(true);
    const t = setTimeout(() => setHighlightGate(false), 2000);
    return () => clearTimeout(t);
  }, [navRequest?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feeds the Live preview's [Company] substitution. Same reason as
  // AnnouncementPreviewPopup above: the resolver is module-level and takes the
  // name as an argument rather than reaching for a binding it cannot see.
  const { branding } = useAdminBranding();
  const [enabled,       setEnabled]       = useState(true);
  const [mode,          setMode]          = useState('preset_1');
  const [customMessage, setCustomMessage] = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saveStatus,    setSaveStatus]    = useState('');
  const [previewNameIdx, setPreviewNameIdx] = useState(PREVIEW_NAMES.length - 1);
  const [showPreview,   setShowPreview]   = useState(false);

  // ── Email notification preferences state ──────────────────────────────────
  const [prefs,       setPrefs]       = useState({});
  const [flashKey,    setFlashKey]    = useState(null);
  const [flashStatus, setFlashStatus] = useState('');
  const flashTimer = useRef(null);

  // ── Engagement cadence settings state ─────────────────────────────────────
  const [cadenceSettings,     setCadenceSettings]     = useState([]);
  const [cadenceFlashMonth,   setCadenceFlashMonth]   = useState(null);
  const [cadenceFlashStatus,  setCadenceFlashStatus]  = useState('');
  const cadenceFlashTimer = useRef(null);
  const [cadenceEditMonth,    setCadenceEditMonth]    = useState(null); // which month's editor is open
  const [cadenceEditDraft,    setCadenceEditDraft]    = useState({}); // { subject, body } being edited
  const [cadenceEditSaving,   setCadenceEditSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/notification-preferences`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        setPrefs(d);
      } catch {
        // swallow — prefs default to all-enabled
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePrefToggle(triggerKey, value) {
    // ⚠ THE RAW VALUE, NOT A RESOLVED BOOLEAN. This read `prefs[triggerKey] !== false`,
    // which collapses "never set" to true — so a failed save on a DEFAULT-OFF key
    // reverted the switch to ON and showed the gate as open while it was closed.
    // Wrong direction on a safety control. Keeping the raw value (undefined stays
    // undefined) lets NotifToggle re-derive from that key's own default.
    const prev = prefs[triggerKey];
    setPrefs(p => ({ ...p, [triggerKey]: value }));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ trigger_key: triggerKey, email_enabled: value }),
      });
      if (!r.ok) throw new Error('not ok');
      setFlashKey(triggerKey);
      setFlashStatus('saved');
    } catch {
      setPrefs(p => ({ ...p, [triggerKey]: prev })); // revert
      setFlashKey(triggerKey);
      setFlashStatus('error');
    }
    flashTimer.current = setTimeout(() => { setFlashKey(null); setFlashStatus(''); }, 1500);
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/engagement-cadence`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        setCadenceSettings(Array.isArray(d) ? d : []);
      } catch {
        // swallow — cadence defaults to empty
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCadenceToggle(month, value) {
    const prev = cadenceSettings;
    setCadenceSettings(s => s.map(r => r.cadence_month === month ? { ...r, is_enabled: value } : r));
    if (cadenceFlashTimer.current) clearTimeout(cadenceFlashTimer.current);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/engagement-cadence/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ is_enabled: value }),
      });
      if (!r.ok) throw new Error('not ok');
      setCadenceFlashMonth(month);
      setCadenceFlashStatus('saved');
    } catch {
      setCadenceSettings(prev);
      setCadenceFlashMonth(month);
      setCadenceFlashStatus('error');
    }
    cadenceFlashTimer.current = setTimeout(() => { setCadenceFlashMonth(null); setCadenceFlashStatus(''); }, 1500);
  }

  async function saveCadenceMessage(month) {
    setCadenceEditSaving(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/engagement-cadence/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ subject: cadenceEditDraft.subject, body: cadenceEditDraft.body }),
      });
      if (!r.ok) throw new Error('not ok');
      const updated = await r.json();
      setCadenceSettings(s => s.map(r2 => r2.cadence_month === month ? { ...r2, subject: updated.subject, body: updated.body } : r2));
      setCadenceEditMonth(null);
    } catch {
      // swallow
    } finally {
      setCadenceEditSaving(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
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
            <button key={opt.value} onClick={() => setMode(opt.value)} style={{ background: mode === opt.value ? AD.bgCardTint : 'transparent', border: `1.5px solid ${mode === opt.value ? AD.navy : AD.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', fontFamily: AD.fontSans }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: opt.value !== 'custom' ? 6 : 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${mode === opt.value ? AD.navy : AD.gray}`, background: mode === opt.value ? AD.navy : 'transparent' }} />
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
            <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="your payout has been approved and is heading your way!" rows={4} style={{ width: '100%', padding: '10px 12px', background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`, borderRadius: 10, fontFamily: AD.fontSans, fontSize: 14, color: AD.textPrimary, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} onFocus={e => e.target.style.borderColor = AD.marker} onBlur={e => e.target.style.borderColor = AD.borderStrong} />
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
          {resolveMessage(previewSettings, previewName.split(' ')[0], 500, 'Sample Client', branding.companyName)}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.textTertiary }}>Preview name: {previewName} · Amount: $500</p>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <Btn onClick={handleSave} variant="primary" size="lg">
          {saving ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</> : <><i className="ph ph-floppy-disk" /> Save Settings</>}
        </Btn>
        {saveStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved</span>}
        {saveStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* ── SECTION 2: Email Notifications ── */}
      <p style={{ ...sectionLabel, marginTop: 8 }}>Email Notifications</p>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Control which email notifications are sent to you and your referrers.
      </p>

      {/* Referrer Notifications */}
      <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>Referrer Notifications</p>
      {REFERRER_GROUPS.map((group, gi) => (
        <div key={group.label} style={{ ...sectionCard, marginBottom: gi < REFERRER_GROUPS.length - 1 ? 12 : 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>{group.label}</p>
          {group.items.map((item, idx) => (
            <div key={item.key}>
              {idx > 0 && <div style={{ height: 1, background: AD.border, margin: '12px 0' }} />}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>{item.desc}</p>
                </div>
                <div style={{ position: 'relative', marginTop: 2 }}>
                  <NotifToggle
                    triggerKey={item.key}
                    checked={prefs[item.key] !== false}
                    onToggle={handlePrefToggle}
                    flash={flashKey === item.key ? flashStatus : null}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ── Referral match outreach (Wave 0.4 item 2) ──────────────────────────
          ⚠ DELIBERATELY NOT A MEMBER OF REFERRER_GROUPS. Every entry in that
          array is rendered with `checked={prefs[item.key] !== false}`, which
          resolves an unknown key to ON. This is the one trigger that ships OFF,
          so it passes the RAW pref value and defaultOn={false} instead.
          ⚠ It is also the only card here that governs TWO different messages to
          TWO different people over TWO channels — the invite to the referrer and
          the credit-attribution email to the referred client, by email and SMS.
          The sub-copy says so because a contractor turning this off means off. */}
      <p style={{ margin: '28px 0 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>Referral Matching</p>
      <div
        id="notif-referral-match-outreach"
        style={{
          ...sectionCard,
          marginBottom: 20,
          // Momentary arrival cue. Uses the existing marker token rather than a
          // new colour, and returns to the normal card border after 2s.
          borderColor: highlightGate ? AD.marker : AD.border,
          boxShadow: highlightGate ? `0 0 0 3px ${AD.amberBg}` : AD.shadowSm,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>Referral match outreach</p>
            <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>
              Sent to both referrer and referred when a referral is matched to a referrer in your system. Both receive an invite to join the program.
            </p>
            {/* ⚠ Every other toggle on this page ships ON, so an OFF card reads as
                broken unless the copy says otherwise. It also must not assume the
                reason is pre-launch — a contractor may keep it off on purpose. */}
            <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, lineHeight: 1.4, fontStyle: 'italic' }}>
              Off until you are ready to invite referrers mentioned in a referral’s profile.
            </p>
          </div>
          <div style={{ position: 'relative', marginTop: 2 }}>
            <NotifToggle
              triggerKey="referral_match_outreach"
              checked={prefs.referral_match_outreach}
              defaultOn={false}
              label="Referral match outreach"
              onToggle={handlePrefToggle}
              flash={flashKey === 'referral_match_outreach' ? flashStatus : null}
            />
          </div>
        </div>
      </div>

      {/* Post-Job Engagement Cadence */}
      <p style={{ margin: '28px 0 4px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>Post-Job Engagement Cadence</p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Automated check-in emails sent to clients after their job is completed. Each message is sent once and never repeated.
      </p>
      {[
        { month: 1,  label: '1-Month Check-In',              desc: 'A post-job check-in sent one month after completion.' },
        { month: 3,  label: '3-Month Seasonal Update',       desc: 'A seasonal touchpoint sent three months after completion.' },
        { month: 6,  label: '6-Month Referral Re-Engagement', desc: 'A soft referral nudge sent six months after completion.' },
        { month: 12, label: '12-Month Anniversary',          desc: 'An anniversary message sent one year after completion.' },
      ].map((row, idx, arr) => {
        const setting = cadenceSettings.find(s => s.cadence_month === row.month);
        const isEnabled = setting ? setting.is_enabled : true;
        const isEditing = cadenceEditMonth === row.month;
        return (
          <div key={row.month} style={{ ...sectionCard, marginBottom: idx < arr.length - 1 ? 12 : 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>{row.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>{row.desc}</p>
              </div>
              <div style={{ position: 'relative', marginTop: 2 }}>
                <button
                  role="switch"
                  aria-checked={isEnabled}
                  onClick={() => handleCadenceToggle(row.month, !isEnabled)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0, background: isEnabled ? AD.navy : AD.bgCardTint, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', outline: 'none' }}
                >
                  <div style={{ position: 'absolute', top: 3, left: isEnabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }} />
                  {cadenceFlashMonth === row.month && cadenceFlashStatus === 'saved'  && <span style={{ position: 'absolute', right: 50, top: 2, fontSize: 11, color: AD.greenText, whiteSpace: 'nowrap', fontFamily: AD.fontSans }}>Saved</span>}
                  {cadenceFlashMonth === row.month && cadenceFlashStatus === 'error'  && <span style={{ position: 'absolute', right: 50, top: 2, fontSize: 11, color: AD.red2Text, whiteSpace: 'nowrap', fontFamily: AD.fontSans }}>Failed to save</span>}
                </button>
              </div>
            </div>
            {isEnabled && (
              <div style={{ marginTop: 10 }}>
                {!isEditing ? (
                  <button
                    onClick={() => { setCadenceEditMonth(row.month); setCadenceEditDraft({ subject: setting?.subject || '', body: setting?.body || '' }); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: AD.blueText, fontSize: 12, fontFamily: AD.fontSans, padding: 0 }}
                  >
                    <i className="ph ph-pencil-simple" style={{ marginRight: 4 }} />Edit message
                  </button>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 4 }}>Subject</label>
                      <input
                        value={cadenceEditDraft.subject || ''}
                        onChange={e => setCadenceEditDraft(d => ({ ...d, subject: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${AD.borderStrong}`, fontFamily: AD.fontSans, fontSize: 13, color: AD.textPrimary, background: AD.bgCardTint, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 4 }}>Body</label>
                      <textarea
                        value={cadenceEditDraft.body || ''}
                        onChange={e => setCadenceEditDraft(d => ({ ...d, body: e.target.value }))}
                        rows={5}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${AD.borderStrong}`, fontFamily: AD.fontSans, fontSize: 13, color: AD.textPrimary, background: AD.bgCardTint, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                        Available tokens: {'{{first_name}}'} {'{{company_name}}'} {'{{job_type}}'} {'{{install_month}}'} {'{{warranty_year}}'} {'{{referral_link}}'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => saveCadenceMessage(row.month)}
                        disabled={cadenceEditSaving}
                        style={{ padding: '7px 16px', borderRadius: 8, background: AD.navy, color: '#fff', border: 'none', fontSize: 13, fontFamily: AD.fontSans, fontWeight: 600, cursor: cadenceEditSaving ? 'default' : 'pointer' }}
                      >
                        {cadenceEditSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setCadenceEditMonth(null)}
                        style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', color: AD.textSecondary, border: `1px solid ${AD.border}`, fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Admin Alerts */}
      <p style={{ margin: '20px 0 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>Admin Alerts</p>
      <div style={sectionCard}>
        {ADMIN_ITEMS.map((item, idx) => (
          <div key={item.key}>
            {idx > 0 && <div style={{ height: 1, background: AD.border, margin: '12px 0' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>{item.desc}</p>
              </div>
              <div style={{ position: 'relative', marginTop: 2 }}>
                <NotifToggle
                  triggerKey={item.key}
                  checked={prefs[item.key] !== false}
                  onToggle={handlePrefToggle}
                  flash={flashKey === item.key ? flashStatus : null}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Always Active */}
      <p style={{ margin: '20px 0 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans }}>Always Active</p>
      <div style={{ ...sectionCard, background: AD.bgCardTint, borderColor: AD.borderStrong }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <i className="ph ph-info" style={{ fontSize: 18, color: AD.blueText, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>Always Active</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
              The following notifications are system-level and cannot be turned off. They exist to protect your account and program integrity.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALWAYS_ACTIVE.map(label => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ph ph-lock-simple" style={{ fontSize: 13, color: AD.textTertiary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
