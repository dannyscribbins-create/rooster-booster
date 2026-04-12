import { useState, useEffect, useRef } from 'react';
import { getPaletteSync } from 'colorthief';
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

function SwatchItem({ hex, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: 5,
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          fontFamily: "'Roboto Mono', monospace", fontSize: 10,
          padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 10,
        }}>
          {hex}
        </div>
      )}
      <div
        onClick={e => { e.stopPropagation(); onSelect(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 40, height: 40, borderRadius: 8,
          backgroundColor: hex, cursor: 'pointer',
          outline: selected ? '2px solid #ffffff' : 'none',
          outlineOffset: 2,
          boxShadow: selected ? '0 0 0 4px rgba(96,165,250,0.5)' : 'none',
          transition: 'outline 0.1s, box-shadow 0.1s',
        }}
      />
    </div>
  );
}

function SwatchRow({ colors, selectedIdx, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {colors.map((hex, i) => (
        <SwatchItem key={i} hex={hex} selected={selectedIdx === i} onSelect={() => onSelect(i)} />
      ))}
    </div>
  );
}

function ColorRow({ label, value, onChange, placeholder, pendingColor, onAssign }) {
  const isValid = HEX_RE.test(value);
  const swatchColor = isValid ? value : '#cccccc';
  const hasPending = !!pendingColor;

  return (
    <div
      onClick={hasPending ? e => { e.stopPropagation(); onAssign(pendingColor); } : undefined}
      style={{ cursor: hasPending ? 'pointer' : 'default' }}
    >
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6, cursor: 'inherit' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="color"
          value={swatchColor}
          onChange={e => onChange(e.target.value)}
          onClick={e => { if (hasPending) e.stopPropagation(); }}
          style={{
            width: 36, height: 36, borderRadius: 6, flexShrink: 0,
            border: `1px solid ${AD.border}`, cursor: 'pointer',
            padding: 2, background: 'none', outline: 'none',
          }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onClick={e => { if (hasPending) e.stopPropagation(); }}
          placeholder={placeholder}
          readOnly={hasPending}
          style={{
            flex: 1, padding: '9px 12px',
            background: AD.bgCard, border: `1px solid ${hasPending ? '#60a5fa' : AD.border}`,
            borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            ...(hasPending ? { animation: 'rbColorPulse 1.2s ease-in-out infinite' } : {}),
          }}
          onFocus={e => { if (!hasPending) e.target.style.borderColor = AD.blueLight; }}
          onBlur={e => { if (!hasPending) e.target.style.borderColor = AD.border; }}
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
  const [formData, setFormData]           = useState(EMPTY_FORM);
  const [logoData, setLogoData]           = useState({ logo_url: null, app_logo_url: null });
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saveStatus, setSaveStatus]       = useState(null);
  const [dirty, setDirty]                 = useState(false);
  const [inviteUrl, setInviteUrl]         = useState(null);
  const [qrDataUrl, setQrDataUrl]         = useState(null);
  const [copied, setCopied]               = useState(false);

  // Color detection state
  const [detectionTab, setDetectionTab]       = useState('upload');
  const [extractedColors, setExtractedColors] = useState([]);
  const [selectedSwatchIdx, setSelectedSwatchIdx] = useState(null);
  const [previewSrc, setPreviewSrc]           = useState(null);
  const [dragOver, setDragOver]               = useState(false);
  const [urlInput, setUrlInput]               = useState('');
  const [urlLoading, setUrlLoading]           = useState(false);
  const [urlError, setUrlError]               = useState(null);

  const fullSettingsRef = useRef(null);
  const statusTimer     = useRef(null);
  const copiedTimer     = useRef(null);
  const fileInputRef    = useRef(null);

  // Inject keyframe animations once
  useEffect(() => {
    if (!document.getElementById('rb-color-detect-styles')) {
      const s = document.createElement('style');
      s.id = 'rb-color-detect-styles';
      s.textContent = [
        '@keyframes rbColorPulse { 0%,100% { box-shadow: 0 0 0 2px rgba(96,165,250,0.6); } 50% { box-shadow: 0 0 0 5px rgba(96,165,250,0.2); } }',
        '@keyframes rbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
      ].join('\n');
      document.head.appendChild(s);
    }
  }, []);

  // Clear swatch selection on click anywhere outside
  useEffect(() => {
    function handleDocClick() { setSelectedSwatchIdx(null); }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

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

  // ── Color detection handlers ──

  function processImageFile(file) {
    if (!file || !file.type.match(/^image\/(png|jpeg|webp)$/)) return;
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target.result;
      const img = new Image();
      img.onload = () => {
        try {
          const palette = getPaletteSync(img, { colorCount: 5 });
          const hexColors = palette.map(color => color.hex());
          setExtractedColors(hexColors);
          setPreviewSrc(src);
          setSelectedSwatchIdx(null);
        } catch {}
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }

  async function handleDetectUrl() {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    setExtractedColors([]);
    setSelectedSwatchIdx(null);
    try {
      const token = sessionStorage.getItem('rb_admin_token');
      const res = await fetch(
        `${BACKEND_URL}/api/admin/extract-colors?url=${encodeURIComponent(urlInput.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.error) {
        setUrlError(data.error);
      } else {
        setExtractedColors(data.colors || []);
      }
    } catch {
      setUrlError('Could not reach this website. Try uploading your logo instead.');
    }
    setUrlLoading(false);
  }

  function handleSwatchAssign(field, hex) {
    handleChange(field, hex);
    setSelectedSwatchIdx(null);
  }

  const pendingHex = selectedSwatchIdx !== null ? extractedColors[selectedSwatchIdx] : null;

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

        {/* ── Color Detection Section ── */}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${AD.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 4 }}>
            Brand Color Detection
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>
            Upload your logo or paste your website URL to pull your brand colors automatically.
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: 14, borderBottom: `1px solid ${AD.border}` }}>
            {['upload', 'url'].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setDetectionTab(tab);
                  setExtractedColors([]);
                  setSelectedSwatchIdx(null);
                  setPreviewSrc(null);
                  setUrlError(null);
                }}
                style={{
                  padding: '7px 16px', border: 'none', background: 'none',
                  fontFamily: AD.fontSans, fontSize: 13,
                  fontWeight: detectionTab === tab ? 600 : 400,
                  color: detectionTab === tab ? AD.textPrimary : AD.textTertiary,
                  cursor: 'pointer',
                  borderBottom: detectionTab === tab ? `2px solid ${AD.blueLight}` : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 0.15s',
                }}
              >
                {tab === 'upload' ? 'Upload Image' : 'Paste URL'}
              </button>
            ))}
          </div>

          {/* Upload Image tab */}
          {detectionTab === 'upload' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? AD.blueLight : AD.border}`,
                  borderRadius: AD.radiusMd, padding: '20px 16px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(96,165,250,0.06)' : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  marginBottom: extractedColors.length > 0 ? 12 : 0,
                }}
              >
                <i className="ph ph-upload-simple" style={{ fontSize: 20, color: AD.textTertiary, display: 'block', marginBottom: 6 }} />
                <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                  Drop your logo or any brand image here
                </span>
                <span style={{ display: 'block', fontSize: 11, color: AD.textTertiary, marginTop: 4, opacity: 0.7 }}>
                  PNG, JPG, WEBP · click to browse
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>

              {extractedColors.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {previewSrc && (
                    <img
                      src={previewSrc}
                      alt="Uploaded preview"
                      style={{ maxWidth: 100, maxHeight: 60, width: 'auto', height: 'auto', borderRadius: 4, border: `1px solid ${AD.border}`, flexShrink: 0 }}
                    />
                  )}
                  <SwatchRow colors={extractedColors} selectedIdx={selectedSwatchIdx} onSelect={setSelectedSwatchIdx} />
                </div>
              )}
            </>
          )}

          {/* Paste URL tab */}
          {detectionTab === 'url' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => {
                    setUrlInput(e.target.value);
                    if (!e.target.value) { setExtractedColors([]); setSelectedSwatchIdx(null); }
                    setUrlError(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleDetectUrl(); }}
                  placeholder="https://yourwebsite.com"
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
                <button
                  onClick={handleDetectUrl}
                  disabled={!urlInput.trim() || urlLoading}
                  style={{
                    padding: '9px 16px', borderRadius: AD.radiusMd, border: 'none',
                    background: AD.navy, color: '#fff',
                    fontFamily: AD.fontSans, fontSize: 13, fontWeight: 500,
                    cursor: !urlInput.trim() || urlLoading ? 'not-allowed' : 'pointer',
                    opacity: !urlInput.trim() || urlLoading ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    flexShrink: 0, whiteSpace: 'nowrap',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {urlLoading ? (
                    <>
                      <i className="ph ph-spinner" style={{ fontSize: 14, animation: 'rbSpin 1s linear infinite' }} />
                      Detecting…
                    </>
                  ) : 'Detect Colors'}
                </button>
              </div>
              {urlError && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', fontFamily: AD.fontSans }}>{urlError}</p>
              )}
              {extractedColors.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <SwatchRow colors={extractedColors} selectedIdx={selectedSwatchIdx} onSelect={setSelectedSwatchIdx} />
                </div>
              )}
            </>
          )}

          {/* Assignment instruction */}
          {selectedSwatchIdx !== null && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: AD.blueLight, fontFamily: AD.fontSans }}>
              Now click Primary, Secondary, or Accent to apply
            </p>
          )}
        </div>
        {/* ── End Color Detection Section ── */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ColorRow
            label="Primary Color"
            value={formData.primary_color}
            onChange={v => handleChange('primary_color', v)}
            placeholder="#012854"
            pendingColor={pendingHex}
            onAssign={hex => handleSwatchAssign('primary_color', hex)}
          />
          <ColorRow
            label="Secondary Color"
            value={formData.secondary_color}
            onChange={v => handleChange('secondary_color', v)}
            placeholder="#CC0000"
            pendingColor={pendingHex}
            onAssign={hex => handleSwatchAssign('secondary_color', hex)}
          />
          <ColorRow
            label="Accent Color"
            value={formData.accent_color}
            onChange={v => handleChange('accent_color', v)}
            placeholder="#D3E3F0"
            pendingColor={pendingHex}
            onAssign={hex => handleSwatchAssign('accent_color', hex)}
          />
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
