import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import PermissionGate from './PermissionGate';
import LockedSection from './LockedSection';
import { usePermissions } from '../../hooks/useAdminPermissions';
import { REGISTRY_SECTIONS, FINANCE_WALL_FLAGS, PERM_GROUPS } from '../../constants/registrySections';

// ── PRESET DEFINITIONS (§8.1) ─────────────────────────────────────────────────
// Presets are one-time STAMPS: selecting a preset populates the permission set on
// create. Permissions remain individually editable in Sub-piece 2's permission grid.
const PRESETS = [
  {
    id: 'full_admin',
    name: 'Full Admin',
    tier: 'admin',
    icon: 'ph-shield-checkered',
    blurb: 'All sections and management controls. cashout_approve off by default.',
    permissions: {
      dashboard: true,
      referrers: true, 'referrers.manage': true,
      contacts: true, 'contacts.manage': true,
      campaigns: true, 'campaigns.manage': true,
      audiences: true, 'audiences.manage': true,
      experience: true, 'experience.manage': true,
      referral_review: true, 'referral_review.manage': true,
      cashouts: true, 'cashouts.manage': true,
      finance_settings: true, 'finance_settings.manage': true,
      billing: true, 'billing.manage': true,
      branding: true, 'branding.manage': true,
      integrations: true, 'integrations.manage': true,
      advanced: true,
      activity: true,
      team: true, 'team.manage': true,
      rep_assignment: true,
    },
  },
  {
    id: 'marketing_admin',
    name: 'Marketing Admin',
    tier: 'admin',
    icon: 'ph-megaphone',
    blurb: 'Campaigns, Contacts, Audiences, Experience. Finance view-only.',
    permissions: {
      campaigns: true, 'campaigns.manage': true,
      audiences: true, 'audiences.manage': true,
      contacts: true, 'contacts.manage': true,
      experience: true, 'experience.manage': true,
      finance_settings: true,
    },
  },
  {
    id: 'finance_admin',
    name: 'Finance Admin',
    tier: 'admin',
    icon: 'ph-bank',
    blurb: 'Billing, Finance Settings, Cash Outs. cashout_approve off — Owner can enable.',
    permissions: {
      billing: true, 'billing.manage': true,
      cashouts: true, 'cashouts.manage': true,
      finance_settings: true, 'finance_settings.manage': true,
    },
  },
  {
    id: 'office_manager',
    name: 'Office Manager',
    tier: 'general',
    icon: 'ph-briefcase',
    blurb: 'Broad view access, referral review management, rep assignment.',
    permissions: {
      dashboard: true,
      referrers: true,
      contacts: true,
      campaigns: true,
      audiences: true,
      experience: true,
      referral_review: true, 'referral_review.manage': true,
      cashouts: true,
      activity: true,
      rep_assignment: true,
    },
  },
  {
    id: 'internal_team',
    name: 'Internal Team',
    tier: 'general',
    icon: 'ph-users',
    blurb: 'Dashboard, Contacts, Campaigns — view only.',
    permissions: { dashboard: true, contacts: true, campaigns: true },
  },
  {
    id: 'field_rep',
    name: 'Field Rep',
    tier: 'general',
    icon: 'ph-hard-hat',
    blurb: 'No admin panel access. Rep tracking and attribution only.',
    permissions: {},
  },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const cfg = {
    owner:   { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
    admin:   { bg: AD.blueBg,               color: AD.blueText },
    general: { bg: AD.grayBg,               color: AD.textSecondary },
  };
  const { bg, color } = cfg[tier] || cfg.general;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: AD.radiusPill,
      background: bg, color, fontSize: 11, fontWeight: 500, fontFamily: AD.fontSans,
    }}>
      {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '—'}
    </span>
  );
}

function fmtDate(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RepStatus({ m }) {
  if (!m.is_field_rep) return <span style={{ color: AD.textTertiary }}>—</span>;
  if (m.is_attributable) return <span style={{ color: AD.greenText, fontSize: 12 }}>Attributable</span>;
  return <span style={{ color: AD.textSecondary, fontSize: 12 }}>Non-attributable</span>;
}

function TH({ children, right = false }) {
  return (
    <th style={{
      padding: '8px 14px', textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 500, color: AD.textTertiary, fontFamily: AD.fontSans,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      borderBottom: `1px solid ${AD.border}`, whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );
}

// ── ADD MEMBER MODAL ──────────────────────────────────────────────────────────
function AddMemberModal({ creatorTier, onClose, onSuccess }) {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [email, setEmail]       = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState(null);
  const [done, setDone]         = useState(null); // { email, inviteSent }

  const canPickAdmin = creatorTier === 'owner';

  async function handleCreate() {
    if (!selectedPreset)   { setErr('Select a role preset.'); return; }
    if (!email.trim())     { setErr('Email is required.'); return; }
    if (!fullName.trim())  { setErr('Full name is required.'); return; }
    setSaving(true);
    setErr(null);
    const token = sessionStorage.getItem('rb_admin_token');
    try {
      // Step 1: create the member (no password — invite flow)
      const r = await fetch(`${BACKEND_URL}/api/admin/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), tier: selectedPreset.tier }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || 'Failed to create member.'); setSaving(false); return; }

      // Step 2: stamp preset permissions — surface wall errors explicitly
      const permRes = await fetch(`${BACKEND_URL}/api/admin/team/${data.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: selectedPreset.permissions }),
      });
      if (!permRes.ok) {
        const permErr = await permRes.json();
        setErr(`Member created but permissions could not be applied: ${permErr.error || 'Unknown error'}. Edit permissions from the roster.`);
        setSaving(false);
        // Still show success for member creation — they exist, just need manual permission edit
        setDone({ email: data.email, inviteSent: data.invite_sent });
        return;
      }

      setDone({ email: data.email, inviteSent: data.invite_sent });
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !done) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
        borderRadius: AD.radiusLg, boxShadow: AD.shadowLg,
        width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto',
        padding: '28px 32px', fontFamily: AD.fontSans,
      }}>
        {done ? (
          // ── SUCCESS ──────────────────────────────────────────────────────────
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <i className="ph-fill ph-paper-plane-right" style={{ fontSize: 44, color: AD.blueText, display: 'block', marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: AD.textPrimary, marginBottom: 6 }}>
              {done.inviteSent ? 'Invite sent!' : 'Member created'}
            </div>
            <div style={{ fontSize: 14, color: AD.textSecondary, marginBottom: 20 }}>{done.email}</div>

            {done.inviteSent ? (
              <div style={{
                fontSize: 13, color: AD.textSecondary, background: AD.bgCard,
                border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
                padding: '12px 16px', marginBottom: 20, lineHeight: 1.6, textAlign: 'left',
              }}>
                <i className="ph ph-envelope" style={{ fontSize: 14, color: AD.blueText, marginRight: 6 }} />
                They'll receive a link to set their password. Once set, they can log in.
              </div>
            ) : (
              <div style={{
                fontSize: 13, color: AD.amberText, background: AD.amberBg,
                border: `1px solid ${AD.amber}`, borderRadius: AD.radiusMd,
                padding: '12px 16px', marginBottom: 20, lineHeight: 1.6, textAlign: 'left',
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <i className="ph ph-warning" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <span>
                  The invite email failed to send. The member account was created — use the{' '}
                  <strong>Resend invite</strong> button on their roster row to retry.
                </span>
              </div>
            )}

            {/* Permission warning shown alongside success if stamp failed */}
            {err && (
              <div style={{
                fontSize: 12, color: AD.amberText, background: AD.amberBg,
                border: `1px solid ${AD.amber}`, borderRadius: AD.radiusMd,
                padding: '10px 14px', marginBottom: 16, textAlign: 'left',
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }} />
                <span>{err}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { setDone(null); setEmail(''); setFullName(''); setSelectedPreset(null); setErr(null); onSuccess(); }}
                style={{
                  padding: '9px 20px', borderRadius: AD.radiusMd, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${AD.border}`,
                  color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans,
                }}
              >
                Add Another
              </button>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                style={{
                  padding: '9px 22px', borderRadius: AD.radiusMd, cursor: 'pointer',
                  background: AD.blueText, border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary }}>Add Team Member</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: AD.textSecondary, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', padding: 2 }}>
                <i className="ph ph-x" />
              </button>
            </div>

            {/* Preset grid */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 10 }}>
                Role Preset{' '}
                <span style={{ fontWeight: 400, color: AD.textTertiary }}>(stamps default permissions — fine-tune in the edit drawer)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {PRESETS.map(p => {
                  const disabled = !canPickAdmin && p.tier === 'admin';
                  const selected = selectedPreset?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      disabled={disabled}
                      onClick={() => { if (!disabled) setSelectedPreset(p); }}
                      style={{
                        textAlign: 'left', padding: '11px 13px', borderRadius: AD.radiusMd,
                        background: selected ? 'rgba(37,99,235,0.1)' : (disabled ? AD.bgSurface : AD.bgCard),
                        border: `1px solid ${selected ? AD.blueText : AD.border}`,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.42 : 1,
                        transition: 'border-color 0.12s, background 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <i className={`ph ${p.icon}`} style={{ fontSize: 15, color: selected ? AD.blueText : AD.textSecondary, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>{p.name}</span>
                        <TierBadge tier={p.tier} />
                        {disabled && <span style={{ fontSize: 10, color: AD.textTertiary, marginLeft: 'auto' }}>Owner only</span>}
                      </div>
                      <div style={{ fontSize: 11, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.45 }}>{p.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>
              {[
                { label: 'Full Name', value: fullName, setter: setFullName, type: 'text',  placeholder: 'e.g. Jane Smith' },
                { label: 'Email',     value: email,    setter: setEmail,    type: 'email', placeholder: 'e.g. jane@yourcompany.com' },
              ].map(({ label, value, setter, type, placeholder }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 5, fontFamily: AD.fontSans }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    style={{
                      width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                      borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
                      background: AD.bgCard, color: AD.textPrimary,
                      fontSize: 14, fontFamily: AD.fontSans, outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            {err && (
              <div style={{
                padding: '9px 12px', borderRadius: AD.radiusMd, marginBottom: 14,
                background: AD.red2Bg, border: `1px solid ${AD.red2}`,
                color: AD.red2Text, fontSize: 13, fontFamily: AD.fontSans,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 15 }} />
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 20px', borderRadius: AD.radiusMd, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${AD.border}`,
                  color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 22px', borderRadius: AD.radiusMd, cursor: saving ? 'not-allowed' : 'pointer',
                  background: saving ? AD.bgCardTint : AD.blueText, border: 'none',
                  color: saving ? AD.textSecondary : '#fff',
                  fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans, transition: 'all 0.15s',
                }}
              >
                {saving
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Creating…</>
                  : <><i className="ph ph-user-plus" style={{ fontSize: 14 }} />Create Member</>
                }
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── MEMBER EDIT DRAWER (Sub-piece 2) ─────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', padding: 0,
        background: checked ? AD.blueText : 'rgba(255,255,255,0.12)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', flexShrink: 0, transition: 'background 0.15s',
        outline: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.15s', pointerEvents: 'none',
      }} />
    </button>
  );
}

function MemberEditDrawer({ member, myTier, onClose, onSaved }) {
  const [localName, setLocalName]       = useState(member.full_name || '');
  const [localTier, setLocalTier]       = useState(member.tier);
  const [workingPerms, setWorkingPerms] = useState({ ...(member.permissions || {}) });
  const [presetSel, setPresetSel]       = useState('');
  const [collapsed, setCollapsed]       = useState({ forward: true });
  const [saving, setSaving]             = useState(false);
  const [saveErr, setSaveErr]           = useState(null);

  // Non-owners cannot edit admin-tier members — read-only view only
  const readOnly      = myTier !== 'owner' && member.tier === 'admin';
  // Only Owners can change tier, and only when the target is not already an Owner
  const canChangeTier = myTier === 'owner' && member.tier !== 'owner';

  function toggleGroup(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }));
  }

  function toggleFlag(flag, val) {
    setWorkingPerms(p => {
      const next = { ...p, [flag]: val };
      if (!val) delete next[flag];
      return next;
    });
  }

  function applyPreset(presetId) {
    setPresetSel(presetId);
    if (!presetId) return;
    const p = PRESETS.find(x => x.id === presetId);
    if (p) setWorkingPerms({ ...p.permissions });
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    const token = sessionStorage.getItem('rb_admin_token');
    try {
      // Step 1: PATCH identity only when something actually changed
      const identityChanged = localName !== (member.full_name || '') || localTier !== member.tier;
      if (identityChanged) {
        const body = {};
        if (localName !== (member.full_name || '')) body.full_name = localName;
        if (localTier !== member.tier) body.tier = localTier;
        const r = await fetch(`${BACKEND_URL}/api/admin/team/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json();
          setSaveErr(d.error || 'Failed to update member details.');
          setSaving(false);
          return;
        }
      }
      // Step 2: POST permissions — always a full JSONB replace
      const pr = await fetch(`${BACKEND_URL}/api/admin/team/${member.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: workingPerms }),
      });
      if (!pr.ok) {
        const d = await pr.json();
        setSaveErr(d.error || 'Permission update rejected.');
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setSaveErr('Network error. Please try again.');
      setSaving(false);
    }
  }

  const availablePresets = PRESETS.filter(p => p.tier === localTier);

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px',
    borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
    background: AD.bgCard, color: AD.textPrimary,
    fontSize: 13, fontFamily: AD.fontSans, outline: 'none',
  };

  const sectionCardStyle = {
    background: AD.bgCard, border: `1px solid ${AD.border}`,
    borderRadius: AD.radiusMd, padding: '16px 18px',
  };

  return (
    <>
      {/* Backdrop — click to close (blocked while saving) */}
      <div
        onClick={() => { if (!saving) onClose(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 199 }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 520, height: '100vh',
        background: AD.bgSurface, borderLeft: `1px solid ${AD.borderStrong}`,
        boxShadow: '-4px 0 32px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', zIndex: 200,
        fontFamily: AD.fontSans,
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${AD.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          background: AD.bgCard, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.full_name || member.email}
            </div>
            {member.full_name && (
              <div style={{ fontSize: 12, color: AD.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
            )}
            {readOnly && (
              <div style={{
                marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: AD.radiusPill,
                background: AD.grayBg, color: AD.textSecondary, fontSize: 11,
              }}>
                <i className="ph ph-eye" style={{ fontSize: 11 }} />
                View only — only Owners can edit admin members
              </div>
            )}
          </div>
          <button
            onClick={() => { if (!saving) onClose(); }}
            style={{ background: 'none', border: 'none', color: AD.textSecondary, cursor: 'pointer', fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Identity */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: AD.textTertiary, marginBottom: 14 }}>
              Identity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, marginBottom: 4 }}>Full Name</label>
                {readOnly ? (
                  <div style={{ ...inputStyle, background: AD.bgSurface, color: AD.textSecondary }}>{localName || '—'}</div>
                ) : (
                  <input type="text" value={localName} onChange={e => setLocalName(e.target.value)} placeholder="Full name" style={inputStyle} />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, marginBottom: 4 }}>Tier</label>
                {member.tier === 'owner' ? (
                  <div style={{ ...inputStyle, background: AD.bgSurface, color: '#fbbf24' }}>Owner</div>
                ) : canChangeTier ? (
                  <select value={localTier} onChange={e => { setLocalTier(e.target.value); setPresetSel(''); }} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="admin">Admin</option>
                    <option value="general">General</option>
                  </select>
                ) : (
                  <div style={{ ...inputStyle, background: AD.bgSurface, color: AD.textSecondary, textTransform: 'capitalize' }}>{localTier}</div>
                )}
              </div>
              {/* Title selector — stub until Sub-piece 3 wires the titles CRUD endpoint */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, marginBottom: 4 }}>
                  Title
                  <span style={{ marginLeft: 6, fontSize: 10, color: AD.textTertiary, fontStyle: 'italic' }}>(Sub-piece 3)</span>
                </label>
                <div style={{ ...inputStyle, background: AD.bgSurface, color: AD.textTertiary, cursor: 'not-allowed', userSelect: 'none' }}>
                  {member.title_name || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Preset stamp — edit mode only, not shown for Owner targets */}
          {!readOnly && member.tier !== 'owner' && (
            <div style={sectionCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: AD.textTertiary, marginBottom: 10 }}>
                Stamp a Preset
              </div>
              <select value={presetSel} onChange={e => applyPreset(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Select preset to stamp permissions —</option>
                {availablePresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: AD.textTertiary, marginTop: 7, lineHeight: 1.5 }}>
                Stamping replaces the current permission set. Adjust individual toggles below after stamping.
              </div>
            </div>
          )}

          {/* Permission grid */}
          {member.tier !== 'owner' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: AD.textTertiary, marginBottom: 2 }}>
                Permissions
              </div>
              {PERM_GROUPS.map(group => {
                const isCollapsed = !!collapsed[group.key];
                const sections    = group.sections.map(k => REGISTRY_SECTIONS.find(s => s.key === k)).filter(Boolean);
                return (
                  <div key={group.key} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd, overflow: 'hidden' }}>
                    {/* Collapsible group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <i className={`ph ${group.icon}`} style={{ fontSize: 14, color: AD.blueLight, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: AD.textPrimary, flex: 1 }}>{group.label}</span>
                      {group.key === 'forward' && (
                        <span style={{ fontSize: 10, color: AD.textTertiary, background: AD.bgSurface, padding: '1px 7px', borderRadius: AD.radiusPill, marginRight: 4 }}>Coming soon</span>
                      )}
                      <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'}`} style={{ fontSize: 12, color: AD.textTertiary, flexShrink: 0 }} />
                    </button>

                    {!isCollapsed && (
                      <div style={{ borderTop: `1px solid ${AD.border}` }}>
                        {sections.map((section, idx) => {
                          const rowBase = {
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px',
                            borderBottom: idx === sections.length - 1 ? 'none' : `1px solid ${AD.border}`,
                          };

                          // ── cashout_approve: two-wall treatment ──────────────
                          if (section.key === 'cashout_approve') {
                            if (localTier === 'general') {
                              // Wall 2 hard lock — General members can never approve cash-outs
                              return (
                                <div key={section.key} style={{ ...rowBase, background: 'rgba(220,38,38,0.05)' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                      <i className="ph ph-lock-simple" style={{ fontSize: 12, color: AD.red2Text, flexShrink: 0 }} />
                                      <span style={{ fontSize: 13, fontWeight: 500, color: AD.textSecondary }}>Approve Cash-Outs</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: AD.red2Text, lineHeight: 1.5 }}>
                                      General members can never approve cash-outs. This is a permanent security constraint.
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            // Admin tier — toggleable with amber danger note
                            return (
                              <div key={section.key} style={{ ...rowBase, background: 'rgba(217,119,6,0.05)' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <i className="ph ph-warning" style={{ fontSize: 12, color: AD.amberText, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: 500, color: AD.textPrimary }}>Approve Cash-Outs</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: AD.amberText, lineHeight: 1.5 }}>
                                    Grants real money transfer approval. Cannot be delegated to General-tier members.
                                  </div>
                                </div>
                                <div style={{ paddingTop: 2, flexShrink: 0 }}>
                                  <ToggleSwitch
                                    checked={!!workingPerms['cashout_approve']}
                                    onChange={v => toggleFlag('cashout_approve', v)}
                                    disabled={readOnly}
                                  />
                                </div>
                              </div>
                            );
                          }

                          // ── All other sections ────────────────────────────────
                          const { type, flags } = section;

                          const renderToggle = (flag, label) => {
                            const softLocked = FINANCE_WALL_FLAGS.has(flag) && localTier === 'general' && myTier !== 'owner';
                            const toggleEl = (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                {label && <span style={{ fontSize: 10, color: AD.textTertiary }}>{label}</span>}
                                <ToggleSwitch
                                  checked={!!workingPerms[flag]}
                                  onChange={v => toggleFlag(flag, v)}
                                  disabled={readOnly || section.forward || softLocked}
                                />
                              </div>
                            );
                            if (softLocked) {
                              return (
                                <LockedSection mode="element" tooltip="Only the Owner can grant finance access to General members.">
                                  {toggleEl}
                                </LockedSection>
                              );
                            }
                            return toggleEl;
                          };

                          return (
                            <div key={section.key} style={rowBase}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: section.forward ? AD.textTertiary : AD.textSecondary, marginBottom: 2 }}>
                                  {section.label}
                                </div>
                                <div style={{ fontSize: 11, color: AD.textTertiary, lineHeight: 1.4 }}>
                                  {section.description}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 2 }}>
                                {type === 'view_only'   && renderToggle(flags.view,   'View')}
                                {type === 'manage_only' && renderToggle(flags.manage, '')}
                                {type === 'single'      && renderToggle(flags.single, '')}
                                {type === 'view_manage' && (
                                  <>
                                    {renderToggle(flags.view,   'View')}
                                    {renderToggle(flags.manage, 'Manage')}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Owner target — no individual flags apply */
            <div style={{ ...sectionCardStyle, textAlign: 'center' }}>
              <i className="ph ph-crown" style={{ fontSize: 24, color: '#fbbf24', display: 'block', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: AD.textSecondary, lineHeight: 1.5 }}>
                Owners bypass all permission checks. No individual flags apply.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${AD.border}`, background: AD.bgCard, flexShrink: 0 }}>
          {saveErr && (
            <div style={{
              padding: '8px 12px', borderRadius: AD.radiusMd, marginBottom: 10,
              background: AD.red2Bg, border: `1px solid ${AD.red2}`,
              color: AD.red2Text, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <i className="ph ph-warning-circle" style={{ fontSize: 14, flexShrink: 0 }} />
              {saveErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { if (!saving) onClose(); }}
              style={{
                padding: '8px 20px', borderRadius: AD.radiusMd, cursor: saving ? 'not-allowed' : 'pointer',
                background: 'transparent', border: `1px solid ${AD.border}`,
                color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
              }}
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 22px', borderRadius: AD.radiusMd,
                  background: saving ? AD.bgCardTint : AD.blueText, border: 'none',
                  color: saving ? AD.textSecondary : '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans, transition: 'all 0.15s',
                }}
              >
                {saving
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 13, animation: 'spin 0.8s linear infinite' }} />Saving…</>
                  : <><i className="ph ph-check" style={{ fontSize: 13 }} />Save Changes</>
                }
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminTeamSettings() {
  const { tier: myTier } = usePermissions();
  const [members, setMembers]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState(null);
  const [showAdd, setShowAdd]               = useState(false);
  const [confirm, setConfirm]               = useState(null);   // memberId awaiting deactivation confirm
  const [deactivating, setDeactivating]     = useState(false);
  const [resending, setResending]           = useState(null);   // memberId being resent
  const [resendMsg, setResendMsg]           = useState(null);   // { id, text, warn }
  const [selectedMember, setSelectedMember] = useState(null);   // Sub-piece 2: edit drawer

  async function fetchMembers() {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to load team');
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(memberId) {
    setDeactivating(true);
    setErr(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/${memberId}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Deactivation failed');
      await fetchMembers();
    } catch (e) {
      setErr(e.message);
    } finally {
      setDeactivating(false);
      setConfirm(null);
    }
  }

  async function handleResendInvite(memberId) {
    setResending(memberId);
    setResendMsg(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/${memberId}/resend-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Resend failed');
      setResendMsg({
        id: memberId,
        text: data.invite_sent ? 'Invite resent' : 'Invite re-issued (email failed — check Resend)',
        warn: !data.invite_sent,
      });
      setTimeout(() => setResendMsg(null), 4000);
    } catch (e) {
      setResendMsg({ id: memberId, text: e.message, warn: true });
      setTimeout(() => setResendMsg(null), 4000);
    } finally {
      setResending(null);
    }
  }

  useEffect(() => {
    fetchMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount   = members.filter(m => m.active).length;
  const inactiveCount = members.filter(m => !m.active).length;

  return (
    <PermissionGate flag="team" mode="page" label="Manage Team" tooltip="Ask your Owner for access to Manage Team.">
      <div style={{ fontFamily: AD.fontSans }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: AD.textSecondary }}>
            {!loading && (
              <>
                <span style={{ color: AD.textPrimary, fontWeight: 500 }}>{activeCount} active</span>
                {inactiveCount > 0 && <span style={{ marginLeft: 8, color: AD.textTertiary }}>· {inactiveCount} inactive</span>}
              </>
            )}
          </div>
          <PermissionGate flag="team.manage" mode="element" tooltip="Requires team management permission.">
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: AD.radiusMd,
                background: AD.blueText, border: 'none',
                color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans, cursor: 'pointer',
              }}
            >
              <i className="ph ph-user-plus" style={{ fontSize: 15 }} />
              Add Member
            </button>
          </PermissionGate>
        </div>

        {/* Error banner */}
        {err && (
          <div style={{
            padding: '10px 14px', borderRadius: AD.radiusMd, marginBottom: 16,
            background: AD.red2Bg, border: `1px solid ${AD.red2}`,
            color: AD.red2Text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ fontSize: 15 }} />
            {err}
            <button onClick={() => setErr(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: AD.red2Text, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center' }}>
              <i className="ph ph-x" />
            </button>
          </div>
        )}

        {/* Roster table */}
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: AD.textTertiary }}>
              <i className="ph ph-circle-notch" style={{ fontSize: 22, animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: AD.bgSurface }}>
                  <TH>Name</TH>
                  <TH>Title</TH>
                  <TH>Tier</TH>
                  <TH>Rep</TH>
                  <TH>Last Active</TH>
                  <TH>Status</TH>
                  <TH right>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const isPending = m.invite_pending || (!m.last_login_at && m.active);
                  const rowResendMsg = resendMsg?.id === m.id ? resendMsg : null;
                  return (
                    <tr
                      key={m.id}
                      style={{ borderTop: i === 0 ? `1px solid ${AD.border}` : `1px solid ${AD.border}`, opacity: m.active ? 1 : 0.48 }}
                      onMouseEnter={e => { e.currentTarget.style.background = AD.bgSurface; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Name / email */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${AD.navy} 0%, ${AD.navyDark} 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                              {(m.full_name || m.email)[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: m.full_name ? AD.textPrimary : AD.textSecondary, lineHeight: 1.2, fontStyle: m.full_name ? 'normal' : 'italic' }}>
                              {m.full_name || m.email}
                            </div>
                            {m.full_name && <div style={{ fontSize: 11, color: AD.textTertiary, marginTop: 1 }}>{m.email}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Title */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle', fontSize: 13, color: m.title_name ? AD.textSecondary : AD.textTertiary }}>
                        {m.title_name || '—'}
                      </td>
                      {/* Tier */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <TierBadge tier={m.tier} />
                      </td>
                      {/* Rep */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <RepStatus m={m} />
                      </td>
                      {/* Last active */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle', fontSize: 13, color: AD.textSecondary }}>
                        {fmtDate(m.last_login_at)}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        {isPending ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: AD.radiusPill,
                            background: AD.amberBg, color: AD.amberText, fontSize: 11, fontWeight: 500,
                          }}>
                            Pending invite
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: AD.radiusPill,
                            background: m.active ? AD.greenBg : AD.grayBg,
                            color: m.active ? AD.greenText : AD.textTertiary,
                            fontSize: 11, fontWeight: 500,
                          }}>
                            {m.active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        {rowResendMsg ? (
                          <span style={{ fontSize: 12, color: rowResendMsg.warn ? AD.amberText : AD.greenText }}>
                            <i className={`ph ${rowResendMsg.warn ? 'ph-warning' : 'ph-check'}`} style={{ marginRight: 4 }} />
                            {rowResendMsg.text}
                          </span>
                        ) : confirm === m.id ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: AD.amberText }}>Deactivate?</span>
                            <button
                              onClick={() => handleDeactivate(m.id)}
                              disabled={deactivating}
                              style={{
                                padding: '4px 10px', borderRadius: AD.radiusMd, cursor: 'pointer',
                                background: AD.red2Bg, border: `1px solid ${AD.red2}`,
                                color: AD.red2Text, fontSize: 12, fontFamily: AD.fontSans,
                              }}
                            >
                              {deactivating ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirm(null)}
                              style={{
                                padding: '4px 10px', borderRadius: AD.radiusMd, cursor: 'pointer',
                                background: 'transparent', border: `1px solid ${AD.border}`,
                                color: AD.textSecondary, fontSize: 12, fontFamily: AD.fontSans,
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <PermissionGate flag="team.manage" mode="element" tooltip="Requires team management permission.">
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {/* Resend invite — shown only for pending members */}
                              {isPending && m.active && (
                                <button
                                  onClick={() => handleResendInvite(m.id)}
                                  disabled={resending === m.id}
                                  title="Resend invite email"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '4px 10px', borderRadius: AD.radiusMd, cursor: resending === m.id ? 'not-allowed' : 'pointer',
                                    background: AD.bgSurface, border: `1px solid ${AD.border}`,
                                    color: AD.blueText, fontSize: 12, fontFamily: AD.fontSans, whiteSpace: 'nowrap',
                                  }}
                                >
                                  {resending === m.id
                                    ? <i className="ph ph-circle-notch" style={{ fontSize: 12, animation: 'spin 0.8s linear infinite' }} />
                                    : <i className="ph ph-paper-plane-right" style={{ fontSize: 12 }} />
                                  }
                                  Resend
                                </button>
                              )}
                              {/* Edit — Sub-piece 2 wires this drawer */}
                              <button
                                onClick={() => setSelectedMember(m)}
                                title="Edit member"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 30, height: 30, borderRadius: AD.radiusMd, cursor: 'pointer',
                                  background: 'transparent', border: `1px solid ${AD.border}`,
                                  color: AD.textSecondary, transition: 'all 0.12s',
                                }}
                              >
                                <i className="ph ph-pencil-simple" style={{ fontSize: 14 }} />
                              </button>
                              {/* Deactivate — hidden for owners, inactive members */}
                              {m.active && m.tier !== 'owner' && (
                                <button
                                  onClick={() => setConfirm(m.id)}
                                  title="Deactivate member"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 30, height: 30, borderRadius: AD.radiusMd, cursor: 'pointer',
                                    background: 'transparent', border: `1px solid ${AD.border}`,
                                    color: AD.red2Text, transition: 'all 0.12s',
                                  }}
                                >
                                  <i className="ph ph-user-minus" style={{ fontSize: 14 }} />
                                </button>
                              )}
                            </div>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedMember && (
          <MemberEditDrawer
            key={selectedMember.id}
            member={selectedMember}
            myTier={myTier}
            onClose={() => setSelectedMember(null)}
            onSaved={fetchMembers}
          />
        )}

        {showAdd && (
          <AddMemberModal
            creatorTier={myTier}
            onClose={() => setShowAdd(false)}
            onSuccess={fetchMembers}
          />
        )}

        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    </PermissionGate>
  );
}
