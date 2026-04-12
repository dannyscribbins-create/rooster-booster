import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import BrandingPreview from './BrandingPreview';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const HEADING_FONTS = ['Montserrat', 'Poppins', 'Inter', 'Raleway', 'Playfair Display', 'DM Serif Display', 'Oswald', 'Lato'];
const BODY_FONTS    = ['Roboto', 'Open Sans', 'Inter', 'Lato', 'Nunito', 'Source Sans Pro', 'Work Sans', 'DM Sans'];

// ── Local components ──────────────────────────────────────────────────────────

function SettingsInput({ label, labelIcon, value, onChange, placeholder, type = 'text', multiline = false, rows = 3 }) {
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
          rows={rows}
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
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 20 }}>
      {children}
    </div>
  );
}

function HelperText({ children }) {
  return <p style={{ margin: '6px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>{children}</p>;
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

function FontSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '9px 36px 9px 12px',
            background: AD.bgCard, border: `1px solid ${AD.border}`,
            borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s', appearance: 'none', cursor: 'pointer',
          }}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.border}
        >
          {options.map(opt => (
            <option key={opt} value={opt} style={{ background: '#1f2638' }}>{opt}</option>
          ))}
        </select>
        <i className="ph ph-caret-down" style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, color: AD.textSecondary, pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  primary_color: '', secondary_color: '', accent_color: '',
  social_facebook: '', social_instagram: '', social_google: '',
  social_nextdoor: '', social_website: '',
  review_url: '', review_button_text: '', review_message: '',
  font_heading: 'Montserrat', font_body: 'Roboto',
  app_display_name: '', tagline: '',
  email_sender_name: '', email_footer_text: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BrandingProfileSettings() {
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [logoData, setLogoData]     = useState({ logo_url: null, app_logo_url: null });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [dirty, setDirty]           = useState(false);
  const [inviteUrl, setInviteUrl]   = useState(null);
  const [qrDataUrl, setQrDataUrl]   = useState(null);
  const [copied, setCopied]         = useState(false);
  const fullSettingsRef             = useRef(null);
  const statusTimer                 = useRef(null);
  const copiedTimer                 = useRef(null);

  // Mount: fetch settings + invite links in parallel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = sessionStorage.getItem('rb_admin_token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BACKEND_URL}/api/admin/settings`,      { headers }).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/admin/invite-links`,  { headers }).then(r => r.json()),
    ])
      .then(([settings, links]) => {
        fullSettingsRef.current = settings;
        setLogoData({
          logo_url:     settings.logo_url     || null,
          app_logo_url: settings.app_logo_url || null,
        });
        setFormData({
          primary_color:      settings.primary_color      || '',
          secondary_color:    settings.secondary_color    || '',
          accent_color:       settings.accent_color       || '',
          social_facebook:    settings.social_facebook    || '',
          social_instagram:   settings.social_instagram   || '',
          social_google:      settings.social_google      || '',
          social_nextdoor:    settings.social_nextdoor    || '',
          social_website:     settings.social_website     || '',
          review_url:         settings.review_url         || '',
          review_button_text: settings.review_button_text || '',
          review_message:     settings.review_message     || '',
          font_heading:       settings.font_heading       || 'Montserrat',
          font_body:          settings.font_body          || 'Roboto',
          app_display_name:   settings.app_display_name   || '',
          tagline:            settings.tagline            || '',
          email_sender_name:  settings.email_sender_name  || '',
          email_footer_text:  settings.email_footer_text  || '',
        });
        if (Array.isArray(links) && links.length > 0) {
          setInviteUrl(links[0].fullUrl);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Generate QR code when invite URL is available
  useEffect(() => {
    if (!inviteUrl) return;
    QRCode.toDataURL(inviteUrl, { width: 1024, margin: 2, color: { dark: '#012854', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [inviteUrl]);

  // Load Google Fonts for selected fonts
  useEffect(() => {
    [formData.font_heading, formData.font_body].filter(Boolean).forEach(font => {
      const id = `gfont-${font.replace(/\s+/g, '-')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, [formData.font_heading, formData.font_body]);

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

  function handleCopy() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return <div style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14, padding: '8px 0' }}>Loading…</div>;
  }

  const saveDisabled = !dirty || saving;

  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', maxWidth: 1220, margin: '0 auto' }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 820 }}>

      {/* ── Section 1: Brand Logos (display only) ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
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
                <span style={{ fontSize: 13, color: AD.textTertiary }}>No logo set</span>
              )}
            </div>
          ))}
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 12, color: AD.textTertiary, fontStyle: 'italic', fontFamily: AD.fontSans }}>
          Logo uploads coming soon — contact support to update
        </p>
      </div>

      {/* ── Section 2: Brand Colors ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Brand Colors</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ColorRow label="Primary Color"   value={formData.primary_color}   onChange={v => handleChange('primary_color', v)}   placeholder="#012854" />
          <ColorRow label="Secondary Color" value={formData.secondary_color} onChange={v => handleChange('secondary_color', v)} placeholder="#CC0000" />
          <ColorRow label="Accent Color"    value={formData.accent_color}    onChange={v => handleChange('accent_color', v)}    placeholder="#D3E3F0" />
        </div>
      </div>

      {/* ── Section 3: Social Links ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Social Links</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput labelIcon="ph-facebook-logo"  label="Facebook"       value={formData.social_facebook}  onChange={v => handleChange('social_facebook', v)}  placeholder="https://facebook.com/yourpage" />
          <SettingsInput labelIcon="ph-instagram-logo" label="Instagram"      value={formData.social_instagram} onChange={v => handleChange('social_instagram', v)} placeholder="https://instagram.com/yourhandle" />
          <SettingsInput labelIcon="ph-google-logo"    label="Google Business" value={formData.social_google}   onChange={v => handleChange('social_google', v)}   placeholder="https://g.page/yourprofile" />
          <SettingsInput labelIcon="ph-house-line"     label="Nextdoor"       value={formData.social_nextdoor}  onChange={v => handleChange('social_nextdoor', v)}  placeholder="https://nextdoor.com/pages/yourpage" />
          <SettingsInput labelIcon="ph-globe"          label="Website"        value={formData.social_website}   onChange={v => handleChange('social_website', v)}   placeholder="https://accentroofingservice.com" />
        </div>
      </div>

      {/* ── Section 4: Review Settings ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Review Settings</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput label="Review URL"         value={formData.review_url}         onChange={v => handleChange('review_url', v)}         placeholder="https://g.page/r/..." />
          <SettingsInput label="Review Button Text" value={formData.review_button_text} onChange={v => handleChange('review_button_text', v)} placeholder="Leave a Review" />
          <SettingsInput label="Review Message"     value={formData.review_message}     onChange={v => handleChange('review_message', v)}     placeholder="Enjoying the rewards? Leave us a quick Google review!" multiline />
        </div>
      </div>

      {/* ── Section 5: App Identity ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>App Identity</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <SettingsInput label="App Display Name" value={formData.app_display_name} onChange={v => handleChange('app_display_name', v)} placeholder="Rooster Booster" />
            <HelperText>This name replaces "Rooster Booster" throughout the referrer app</HelperText>
          </div>
          <div>
            <SettingsInput label="Tagline" value={formData.tagline} onChange={v => handleChange('tagline', v)} placeholder="Refer your neighbors. Earn cash rewards." multiline rows={2} />
            <HelperText>Shown on the referrer login screen and dashboard</HelperText>
          </div>
        </div>
      </div>

      {/* ── Section 6: Typography ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Typography</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <FontSelect label="Heading Font" value={formData.font_heading} onChange={v => handleChange('font_heading', v)} options={HEADING_FONTS} />
            <p style={{ margin: '10px 0 0', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: `'${formData.font_heading}', sans-serif`, lineHeight: 1.4 }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
          <div>
            <FontSelect label="Body Font" value={formData.font_body} onChange={v => handleChange('font_body', v)} options={BODY_FONTS} />
            <p style={{ margin: '10px 0 0', fontSize: 14, color: AD.textSecondary, fontFamily: `'${formData.font_body}', sans-serif`, lineHeight: 1.5 }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 7: Email Branding ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Email Branding</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <SettingsInput label="Email Sender Name" value={formData.email_sender_name} onChange={v => handleChange('email_sender_name', v)} placeholder="Accent Roofing Service" />
            <HelperText>The "From" name on all emails sent to referrers</HelperText>
          </div>
          <div>
            <SettingsInput label="Email Footer Text" value={formData.email_footer_text} onChange={v => handleChange('email_footer_text', v)} placeholder="Accent Roofing Service · Powered by Rooster Booster" multiline rows={2} />
            <HelperText>Appears at the bottom of verification and notification emails</HelperText>
          </div>
        </div>
      </div>

      {/* ── Section 8: Marketing Assets ── */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 24 }}>
        <SectionHeading>Marketing Assets</SectionHeading>
        {!inviteUrl ? (
          <p style={{ margin: 0, fontSize: 14, color: AD.textTertiary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
            Generate an invite link first (Referrers → Invite Links) to unlock your QR code.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="Invite QR code" style={{ width: 200, height: 200, borderRadius: 8, border: `1px solid ${AD.border}` }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace", wordBreak: 'break-all', lineHeight: 1.4 }}>
                {inviteUrl}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
                  background: copied ? AD.greenBg : 'transparent',
                  color: copied ? AD.greenText : AD.textSecondary,
                  fontFamily: AD.fontSans, fontSize: 12, cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <i className={`ph ${copied ? 'ph-check' : 'ph-copy'}`} style={{ fontSize: 13 }} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download="rooster-booster-invite-qr.png"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                  padding: '8px 18px', borderRadius: AD.radiusMd, border: 'none',
                  background: AD.navy, color: '#fff',
                  fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
                  textDecoration: 'none', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <i className="ph ph-download-simple" style={{ fontSize: 16 }} />
                Download QR Code
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Save row ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {saveStatus === 'success' && <span style={{ fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>✓ Saved</span>}
        {saveStatus === 'error'   && <span style={{ fontSize: 13, color: AD.red2Text,  fontFamily: AD.fontSans }}>Save failed — try again</span>}
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={{
            padding: '9px 24px', borderRadius: AD.radiusMd, border: 'none',
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            background: '#CC0000', color: '#fff',
            fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
            opacity: saveDisabled ? 0.45 : 1, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!saveDisabled) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { if (!saveDisabled) e.currentTarget.style.opacity = '1'; }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      </div>
      <div style={{ flexShrink: 0, width: 320, position: 'sticky', top: 20 }}>
        <BrandingPreview formData={formData} />
      </div>
    </div>
  );
}
