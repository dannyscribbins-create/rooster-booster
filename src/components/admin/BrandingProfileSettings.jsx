import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function SettingsInput({ label, labelIcon, value, onChange, placeholder, type = 'text', multiline = false }) {
  const sharedStyle = {
    width: '100%', padding: '9px 12px',
    background: AD.bgCard, border: `1px solid ${AD.border}`,
    borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
    color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  return (
    <div>
      {label && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
          {labelIcon && <i className={`ph ${labelIcon}`} style={{ fontSize: 13, color: AD.textTertiary }} />}
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...sharedStyle, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.border}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.border}
        />
      )}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 20,
    }}>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange, placeholder }) {
  const isValid = HEX_RE.test(value);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          border: `1px solid ${AD.border}`,
          backgroundColor: isValid ? value : 'transparent',
          transition: 'background-color 0.1s',
        }} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: '9px 12px',
            background: AD.bgCard, border: `1px solid ${AD.border}`,
            borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.border}
        />
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  primary_color: '', secondary_color: '', accent_color: '',
  social_facebook: '', social_instagram: '', social_google: '',
  social_nextdoor: '', social_website: '',
  review_url: '', review_button_text: '', review_message: '',
};

export default function BrandingProfileSettings() {
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [logoData, setLogoData]     = useState({ logo_url: null, app_logo_url: null });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'success' | 'error'
  const [dirty, setDirty]           = useState(false);
  const fullSettingsRef             = useRef(null);
  const statusTimer                 = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => r.json())
      .then(d => {
        fullSettingsRef.current = d;
        setLogoData({
          logo_url:     d.logo_url     || null,
          app_logo_url: d.app_logo_url || null,
        });
        setFormData({
          primary_color:     d.primary_color     || '',
          secondary_color:   d.secondary_color   || '',
          accent_color:      d.accent_color      || '',
          social_facebook:   d.social_facebook   || '',
          social_instagram:  d.social_instagram  || '',
          social_google:     d.social_google     || '',
          social_nextdoor:   d.social_nextdoor   || '',
          social_website:    d.social_website    || '',
          review_url:        d.review_url        || '',
          review_button_text: d.review_button_text || '',
          review_message:    d.review_message    || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  function handleSave() {
    setSaving(true);
    const merged = { ...fullSettingsRef.current, ...formData };
    fetch(`${BACKEND_URL}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(merged),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false);
        setSaveStatus(d.success ? 'success' : 'error');
        if (d.success) {
          setDirty(false);
          fullSettingsRef.current = { ...fullSettingsRef.current, ...formData };
        }
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
      })
      .catch(() => {
        setSaving(false);
        setSaveStatus('error');
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
      });
  }

  if (loading) {
    return (
      <div style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14, padding: '8px 0' }}>
        Loading…
      </div>
    );
  }

  const saveDisabled = !dirty || saving;

  return (
    <div style={{ maxWidth: 640 }}>

      {/* ── Section 1: Brand Logos (display only) ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>Brand Logos</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'App Logo', url: logoData.logo_url },
            { label: 'Referrer App Logo', url: logoData.app_logo_url },
          ].map(({ label, url }) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 8 }}>{label}</div>
              {url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={url} alt={label} style={{ height: 48, width: 'auto', borderRadius: 6, border: `1px solid ${AD.border}`, background: AD.bgCard, padding: 4 }} />
                  <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace", wordBreak: 'break-all' }}>{url}</span>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>No logo set</span>
              )}
            </div>
          ))}
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 12, color: AD.textTertiary, fontStyle: 'italic', fontFamily: AD.fontSans }}>
          Logo uploads coming soon — contact support to update
        </p>
      </div>

      {/* ── Section 2: Brand Colors ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>Brand Colors</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ColorRow label="Primary Color"   value={formData.primary_color}   onChange={v => handleChange('primary_color', v)}   placeholder="#012854" />
          <ColorRow label="Secondary Color" value={formData.secondary_color} onChange={v => handleChange('secondary_color', v)} placeholder="#CC0000" />
          <ColorRow label="Accent Color"    value={formData.accent_color}    onChange={v => handleChange('accent_color', v)}    placeholder="#D3E3F0" />
        </div>
      </div>

      {/* ── Section 3: Social Links ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>Social Links</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput labelIcon="ph-facebook-logo" label="Facebook"  value={formData.social_facebook}  onChange={v => handleChange('social_facebook', v)}  placeholder="https://facebook.com/yourpage" />
          <SettingsInput labelIcon="ph-instagram-logo" label="Instagram" value={formData.social_instagram} onChange={v => handleChange('social_instagram', v)} placeholder="https://instagram.com/yourhandle" />
          <SettingsInput labelIcon="ph-google-logo"   label="Google Business" value={formData.social_google}   onChange={v => handleChange('social_google', v)}   placeholder="https://g.page/yourprofile" />
          <SettingsInput labelIcon="ph-house-line"    label="Nextdoor"  value={formData.social_nextdoor}  onChange={v => handleChange('social_nextdoor', v)}  placeholder="https://nextdoor.com/pages/yourpage" />
          <SettingsInput labelIcon="ph-globe"         label="Website"   value={formData.social_website}   onChange={v => handleChange('social_website', v)}   placeholder="https://accentroofingservice.com" />
        </div>
      </div>

      {/* ── Section 4: Review Settings ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 24,
      }}>
        <SectionHeading>Review Settings</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput label="Review URL"         value={formData.review_url}         onChange={v => handleChange('review_url', v)}         placeholder="https://g.page/r/..." />
          <SettingsInput label="Review Button Text" value={formData.review_button_text} onChange={v => handleChange('review_button_text', v)} placeholder="Leave a Review" />
          <SettingsInput label="Review Message"     value={formData.review_message}     onChange={v => handleChange('review_message', v)}     placeholder="Enjoying the rewards? Leave us a quick Google review!" multiline />
        </div>
      </div>

      {/* ── Save row ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {saveStatus === 'success' && (
          <span style={{ fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>✓ Saved</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>Save failed — try again</span>
        )}
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={{
            padding: '9px 24px', borderRadius: AD.radiusMd, border: 'none',
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            background: '#CC0000', color: '#fff',
            fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
            opacity: saveDisabled ? 0.45 : 1,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!saveDisabled) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { if (!saveDisabled) e.currentTarget.style.opacity = '1'; }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

    </div>
  );
}
