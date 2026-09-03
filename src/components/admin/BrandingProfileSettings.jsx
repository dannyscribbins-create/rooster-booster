import { useState, useEffect, useRef } from 'react';
import { getPaletteSync } from 'colorthief';
import QRCode from 'qrcode';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import BrandingPreview from './BrandingPreview';
// The PLATFORM default mark — the ICON + WORDMARK file, not the wordmark-only
// one. This slot is a brand mark standing in where a contractor has uploaded no
// logo of their own, rather than an inline wordmark set in a sentence.
//
// NOT rb_logo_* — those are the Rooster Booster mark, which is Accent's white
// label rather than the platform's identity.
//
// WAS roofmiles_logo_svg.svg, removed 2026-08-02. That file was an SVG in name
// only: 640KB, because it wrapped a base64 PNG. It bought no vector advantage at
// any size this mark is drawn, and the same PNG was already the counterpart used
// for email, where SVG support is unreliable — so one asset now serves both and
// the SVG-vs-upload-policy note that used to live here is moot.
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import { getAdminToken } from '../../utils/authStorage';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const HEADING_FONTS = ['Montserrat', 'Poppins', 'Inter', 'Raleway', 'Playfair Display', 'DM Serif Display', 'Oswald', 'Lato'];
const BODY_FONTS    = ['Roboto', 'Open Sans', 'Inter', 'Lato', 'Nunito', 'Source Sans Pro', 'Work Sans', 'DM Sans'];

// ── Local components ──────────────────────────────────────────────────────────

function SettingsInput({ label, labelIcon, value, onChange, placeholder, type = 'text', multiline = false, rows = 3 }) {
  const sharedStyle = {
    width: '100%', padding: '9px 12px',
    background: AD.bgCardTint, border: `1px solid ${AD.border}`,
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
          onFocus={e => e.target.style.borderColor = AD.marker}
          onBlur={e => e.target.style.borderColor = AD.border}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle}
          onFocus={e => e.target.style.borderColor = AD.marker}
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

// ── A GROUP LABEL WITHIN A CARD (BR-2 Phase 3, B.2) ─────────────────────────
// Deliberately NOT a second SectionHeading: a card has one heading, and two
// would read as two cards that failed to separate. This is one step down —
// same uppercase register, smaller, tighter — so the eye reads it as a division
// INSIDE the card rather than as a new one.
function GroupLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: AD.textSecondary, marginBottom: 14 }}>
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
            background: AD.bgCardTint, border: `1px solid ${hasPending ? '#60a5fa' : AD.border}`,
            borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            ...(hasPending ? { animation: 'rbColorPulse 1.2s ease-in-out infinite' } : {}),
          }}
          onFocus={e => { if (!hasPending) e.target.style.borderColor = AD.marker; }}
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
            background: AD.bgCardTint, border: `1px solid ${AD.border}`,
            borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s', appearance: 'none', cursor: 'pointer',
          }}
          onFocus={e => e.target.style.borderColor = AD.marker}
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
  // ⚠ SEEDED FROM THE GET RESPONSE ON MOUNT, exactly like the three colours above,
  // and that is not optional. handleSave sends { ...fullSettingsRef.current,
  // ...formData }, so a key that exists in formData SHADOWS the loaded payload. A
  // landing_bg_color left at '' here would overwrite a real saved colour with an
  // empty string the first time an admin saved anything at all — and a browser
  // renders an empty string as no colour, so their landing background would simply
  // vanish. Pinned by 'an existing landing background survives a save that edits
  // something else' in BrandingProfileSettings.test.jsx.
  landing_bg_color: '',
  social_facebook: '', social_instagram: '', social_google: '',
  social_nextdoor: '', social_website: '',
  review_url: '', review_button_text: '', review_message: '',
  font_heading: 'Montserrat', font_body: 'Roboto',
  app_display_name: '',
  landing_step1_title: '', landing_step2_title: '', landing_step2_body: '',
  landing_step3_title: '', landing_step3_body: '',
  email_sender_name: '', email_footer_text: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BrandingProfileSettings() {
  const [formData, setFormData]           = useState(EMPTY_FORM);
  const [logoData, setLogoData]           = useState({ logo_url: null });
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

  // Logo upload state (C/DL-2 Phase 3c)
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError]         = useState(null);

  const fullSettingsRef  = useRef(null);
  const statusTimer      = useRef(null);
  const copiedTimer      = useRef(null);
  const fileInputRef     = useRef(null);   // the colour eyedropper — persists nothing
  const logoInputRef     = useRef(null);   // the real logo uploader

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
    const token = getAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BACKEND_URL}/api/admin/settings`,      { headers }).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/admin/invite-links`,  { headers }).then(r => r.json()),
    ])
      .then(([settings, links]) => {
        fullSettingsRef.current = settings;
        setLogoData({
          logo_url:     settings.logo_url     || null,
        });
        setFormData({
          primary_color:      settings.primary_color      || '',
          secondary_color:    settings.secondary_color    || '',
          accent_color:       settings.accent_color       || '',
          landing_bg_color:   settings.landing_bg_color   || '',
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
          landing_step1_title: settings.landing_step1_title || '',
          landing_step2_title: settings.landing_step2_title || '',
          landing_step2_body:  settings.landing_step2_body  || '',
          landing_step3_title: settings.landing_step3_title || '',
          landing_step3_body:  settings.landing_step3_body  || '',
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
    QRCode.toDataURL(inviteUrl, { width: 1024, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
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
        Authorization: `Bearer ${getAdminToken()}`,
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

  // Uploads the chosen file to POST /api/admin/branding/logo and adopts the URL it
  // returns.
  //
  // ── THE THIRD LINE IS THE WHOLE POINT ────────────────────────────────────────
  // Updating fullSettingsRef.current is not bookkeeping, it is the fix for a
  // data-loss bug this control would otherwise INTRODUCE. handleSave sends
  // { ...fullSettingsRef.current, ...formData }, and logo_url lives in neither
  // formData nor anywhere else the save reads — only in that ref, captured on
  // mount. PUT /api/admin/settings is a full-row upsert, so the ordinary session
  //
  //     open Branding (no logo)  ->  upload a logo  ->  edit a colour  ->  Save
  //
  // would write logo_url = NULL and destroy the logo that was just uploaded.
  // Shipping the uploader without this line would be strictly worse than shipping
  // nothing: the feature would appear to work and silently undo itself one save
  // later. Pinned by 'a save after an upload sends the NEW logo_url, not the stale
  // one' in BrandingProfileSettings.test.jsx.
  //
  // The server cannot defend against this — it was told to write null and did.
  // See the [CHARACTERIZATION] test in server/test/brandingSaveRoundTrip.test.js.
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      // No Content-Type header, deliberately — the browser must set the multipart
      // boundary itself, and naming the type by hand strips it.
      const body = new FormData();
      body.append('logo', file);
      const res = await fetch(`${BACKEND_URL}/api/admin/branding/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.logo_url) {
        setLogoError(data.error || 'Upload failed. Please try again.');
      } else {
        setLogoData(prev => ({ ...prev, logo_url: data.logo_url }));
        if (fullSettingsRef.current) fullSettingsRef.current.logo_url = data.logo_url;
      }
    } catch {
      setLogoError('Upload failed. Please try again.');
    }
    setLogoUploading(false);
    // Clear the input so re-choosing the SAME file fires change again.
    if (logoInputRef.current) logoInputRef.current.value = '';
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
      const token = getAdminToken();
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

      {/* ── Section 1: Brand Logos ──
          Until C/DL-2 Phase 3c this card was display-only and said "Logo uploads
          coming soon — contact support to update", even though
          POST /api/admin/branding/logo had already shipped in Phase 3b. Nothing
          called it. */}
      <div style={{ background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: 32, marginBottom: 20 }}>
        <SectionHeading>Brand Logos</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ⚠ ONE ROW NOW, AND IT IS STILL AN ARRAY DELIBERATELY (BR-2 Phase 3).
              This rendered two: "App Logo" (logo_url, uploadable) and "Referrer
              App Logo" (app_logo_url, display-only). The second column is DROPPED
              — NULL for every contractor, no writer anywhere, its only reads three
              unreachable email fallback terms — so its row goes with it.
              ⚠ THE LABELS MAPPED OPPOSITE TO WHAT THEY SUGGESTED, which is the
              open item this closes: the generic-sounding "App Logo" was the column
              every surface reads, while the specific-sounding "Referrer App Logo"
              was read by nothing in the referrer app.
              The array shape is kept rather than inlined because the parent is a
              flex column with `gap`, so one member lays out identically to two
              with no orphaned label and no empty slot — a change from `.map` to a
              bare div would be a layout edit this phase did not rule. */}
          {[
            { label: 'App Logo', url: logoData.logo_url, uploadable: true },
          ].map(({ label, url, uploadable }) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 8 }}>{label}</div>
              {url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={url} alt={label} style={{ height: 48, width: 'auto', borderRadius: 6, border: `1px solid ${AD.border}`, background: AD.bgCard, padding: 4 }} />
                  <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace", wordBreak: 'break-all' }}>{url}</span>
                </div>
              ) : (
                /* ⚠ THIS PREVIEW USED TO SHOW THE ROOFMILES MARK AND SAY IT WAS
                   WHAT SHIPPED. BR-1 Phase 2's absence rule made that FALSE, and
                   a preview that lies is worse than no preview: an admin decided
                   whether to upload a logo based on it.
                   WHAT ACTUALLY SHIPS NOW (BrandMark, A2): a resolved contractor
                   with no logo gets their COMPANY NAME AS TEXT. The platform mark
                   appears only where NO contractor resolved at all — the bare
                   platform door — which is never this contractor's surface.
                   So the preview shows the company name, because that is what a
                   homeowner sees. */
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: 18, fontWeight: 700,
                    color: AD.textPrimary, border: `1px dashed ${AD.border}`,
                    borderRadius: 6, padding: '10px 14px', background: AD.bgCard,
                  }}>
                    {formData.company_name || 'Your company name'}
                  </span>
                  <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                    No logo set — your company name is shown instead, as text
                  </span>
                </div>
              )}

              {uploadable && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '8px 16px', borderRadius: AD.radiusMd,
                      border: `1px solid ${AD.border}`, background: 'transparent',
                      color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13,
                      cursor: logoUploading ? 'not-allowed' : 'pointer',
                      opacity: logoUploading ? 0.5 : 1, transition: 'opacity 0.15s',
                    }}
                  >
                    <i className={`ph ${logoUploading ? 'ph-spinner' : 'ph-upload-simple'}`}
                       style={{ fontSize: 14, ...(logoUploading ? { animation: 'rbSpin 1s linear infinite' } : {}) }} />
                    {logoUploading ? 'Uploading…' : url ? 'Replace Logo' : 'Upload Logo'}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                  <HelperText>
                    PNG, JPG or WEBP, up to 2MB. SVG is not accepted — it is served from a public
                    URL where a browser would treat it as a document and run any script inside it.
                  </HelperText>
                  {logoError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', fontFamily: AD.fontSans }}>{logoError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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
                  borderBottom: detectionTab === tab ? `2px solid ${AD.marker}` : '2px solid transparent',
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
                  border: `2px dashed ${dragOver ? AD.marker : AD.border}`,
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
                    background: AD.bgCardTint, border: `1px solid ${AD.border}`,
                    borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
                    color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = AD.marker}
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

          {/* Assignment instruction.
              TEXT bucket — 11px helper copy, the least prominent level, so textTertiary.
              Was AD.blueLight (#D4DDEB, 1.37:1 on white).
              ⚠ THE COPY NAMES EACH SLOT'S ROLE (B-2, 2026-09-01), AND THIS FLOW IS
              THE MOST LIKELY ORIGIN OF THE ONE MISFILED PALETTE IN PRODUCTION. It
              read "Now click Primary, Secondary, or Accent to apply" — three
              unexplained words beside a row of colours sampled off a logo, at the
              exact moment the decision is made. Someone picked sensibly and
              wrongly, and the stored tone was a shade DARKER than that company's
              published brand colour — the fingerprint of a swatch lifted from a
              logo's shaded pixels rather than a value typed in.
              ⚠ THE HEXES THAT USED TO BE IN THIS PARAGRAPH ARE GONE, AND THE BRAND
              SWEEP IN adminBranding.test.jsx IS WHY. It fired on this comment the
              first time it was written, correctly: a retired contractor literal in
              prose is how one gets pasted back into code. The guard was reworded
              around, never exempted.
              The role belongs HERE rather than only under the fields below,
              because this is where the assignment happens. */}
          {selectedSwatchIdx !== null && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              Click a swatch, then choose where it goes: Primary (your main dark colour),
              Secondary (buttons), or Accent (soft fills).
            </p>
          )}
        </div>
        {/* ── End Color Detection Section ── */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── ⚠ EVERY COLOUR FIELD SAYS WHAT IT PAINTS (B-2, 2026-09-01) ────────
              Three of these four carried no explanation at all, and the only one
              that did was the one that matters least. The one contractor palette
              in production was entered coherently from a wrong premise — "Primary"
              read as the main DARK brand colour rather than as the button colour —
              and nothing on this form could have told them otherwise. It produced a
              live burgundy page with a blue button.
              ⚠ B-1 RULED THAT PREMISE CORRECT AND SWAPPED THE ROUTING TO MATCH, so
              this copy describes the CURRENT behaviour, not the old. Each line
              names the surfaces the value actually reaches, and each agrees with
              its own placeholder — a placeholder and a description disagreeing
              would be worse than neither. */}
          <div>
            <ColorRow
              label="Primary Color"
              value={formData.primary_color}
              onChange={v => handleChange('primary_color', v)}
              placeholder="#1C2D4D"
              pendingColor={pendingHex}
              onAssign={hex => handleSwatchAssign('primary_color', hex)}
            />
            <HelperText>Your main brand colour, usually the darker one. Sets the page background in dark mode and your body text in light mode.</HelperText>
          </div>
          <div>
            <ColorRow
              label="Secondary Color"
              value={formData.secondary_color}
              onChange={v => handleChange('secondary_color', v)}
              placeholder="#F26A1B"
              pendingColor={pendingHex}
              onAssign={hex => handleSwatchAssign('secondary_color', hex)}
            />
            <HelperText>Your action colour. Buttons, links and anything you want tapped.</HelperText>
          </div>
          {/* ⚠ THE ACCENT PLACEHOLDER IS A TINT OF THE NEUTRAL SINCE B-2, AND IT
              IS DERIVED RATHER THAN PICKED. It was #FDF0E7, a pale tint of the
              ORANGE — which B-1 moved to secondary_color, so the placeholder was
              demonstrating the OPPOSITE of the rule printed directly beneath it.
              ⚠ Restating the rule against Secondary was the rejected fix: accent
              is a soft wash that sits near the NEUTRAL, not near the button.
              Derived with themeTokens' own hslToRgb from the relationship the old
              pair embodied — keep the hue, scale saturation by 0.9485, lift
              lightness to 0.949 — applied to #1C2D4D. Result #ECF0F8: hue 220.0
              against the navy's 219.2, luminance 0.869 against the old
              placeholder's 0.890, so it is a comparably pale wash. */}
          <div>
            <ColorRow
              label="Accent Color"
              value={formData.accent_color}
              onChange={v => handleChange('accent_color', v)}
              placeholder="#ECF0F8"
              pendingColor={pendingHex}
              onAssign={hex => handleSwatchAssign('accent_color', hex)}
            />
            <HelperText>Soft background washes: progress bars, avatars, section fills. Works best as a pale tint of your Primary colour.</HelperText>
          </div>
          {/* C/DL-2 Phase 3c. The column shipped in ff2a871 and the public landing
              page has read it since Phase 2a, but neither GET nor PUT mentioned it
              until Phase 3b and no admin could set it until now. */}
          <div>
            <ColorRow
              label="Landing Page Background"
              value={formData.landing_bg_color}
              onChange={v => handleChange('landing_bg_color', v)}
              placeholder="#FFFFFF"
              pendingColor={pendingHex}
              onAssign={hex => handleSwatchAssign('landing_bg_color', hex)}
            />
            <HelperText>The page background homeowners see when they scan your QR code or open your invite link</HelperText>
          </div>
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
          <SettingsInput labelIcon="ph-globe"          label="Website"        value={formData.social_website}   onChange={v => handleChange('social_website', v)}   placeholder="https://yourcompany.com" />
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
        {/* ⚠ RENAMED IN BR-2 PHASE 3 (B.1). It read "App Identity", which was
            accurate when it held two fields. It now holds seven, five of them
            landing-page copy, so the old name described the smaller half. */}
        <SectionHeading>App Identity &amp; Landing Page</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GroupLabel>Identity</GroupLabel>
          <div>
            {/* ⚠ THE PLACEHOLDER DESCRIBES, IT DOES NOT NAME (ruled BR-2 Phase 3).
                It read "Rooster Booster" — the RETIRED platform codename used as
                generic placeholder text, which also asserted a false default:
                an unset app_display_name does NOT fall back to that, or to
                RoofMiles. It falls back to the COMPANY NAME, verified in source
                at renderState1's `headlineSubject` and at the three referrer
                tabs' `programName || companyName`.
                ⚠ AND THE HELPER'S SURFACE LIST IS READ FROM SOURCE, NOT ASSUMED.
                The old text said "throughout the referrer app", which was false
                when written — the value reached only the landing headline. It is
                now partly true and still not "throughout": BR-1 Phase 2 wired the
                Profile, Cash Out and Rankings eyebrows to it. Four surfaces,
                named. */}
            <SettingsInput label="App Display Name" value={formData.app_display_name} onChange={v => handleChange('app_display_name', v)} placeholder="Your program name" />
            <HelperText>The name of your rewards program. Appears in your landing page headline and above the Profile, Cash Out and Rankings screens. Leave blank to use your company name.</HelperText>
          </div>

          {/* ── THE DIVIDER AND THE SECOND GROUP LABEL (BR-2 Phase 3, B.2) ────
              ⚠ THIS IS WHAT MAKES THE RENAME USEFUL RATHER THAN MERELY ACCURATE.
              Without it the five landing fields read as a continuation of app
              settings, and an admin editing "Landing Step 2 — Description" has
              no signal that they are editing their PUBLIC page.
              A divider and two labels — not a redesign, not a second card, not a
              collapsible section. */}
          <div style={{ borderTop: `1px solid ${AD.border}`, margin: '8px 0 4px' }} />
          <GroupLabel>Landing Page Copy</GroupLabel>

          {/* ── LP §2's how-it-works steps (BR-2 Phase 2, A32(a)) ──────────────
              ⚠ EACH PLACEHOLDER IS THE FROZEN DEFAULT, so a contractor sees what
              they are replacing rather than an empty box with no clue what it
              drives. Leaving a field blank keeps the default — the column stores
              NULL, and NULL means "use the frozen default". */}
          <div>
            <SettingsInput label="Landing Step 1 — Title" value={formData.landing_step1_title} onChange={v => handleChange('landing_step1_title', v)} placeholder="Share your personal link" />
          </div>
          <div>
            <SettingsInput label="Landing Step 2 — Title" value={formData.landing_step2_title} onChange={v => handleChange('landing_step2_title', v)} placeholder="They book a free inspection" />
          </div>
          <div>
            <SettingsInput label="Landing Step 2 — Description" value={formData.landing_step2_body} onChange={v => handleChange('landing_step2_body', v)} placeholder="We take care of them like family" />
          </div>
          <div>
            <SettingsInput label="Landing Step 3 — Title" value={formData.landing_step3_title} onChange={v => handleChange('landing_step3_title', v)} placeholder="You earn cash rewards" />
          </div>
          <div>
            <SettingsInput label="Landing Step 3 — Description" value={formData.landing_step3_body} onChange={v => handleChange('landing_step3_body', v)} placeholder="Get paid when their job completes" />
            <HelperText>The three how-it-works steps on your public landing page. Leave any field blank to keep the default shown in grey.</HelperText>
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
            {/* ⚠ "ALL emails" WAS FALSE, FOUND BY READING THE SENDS RATHER THAN
                TRUSTING THE HELPER. The campaign, cadence, post-job and pipeline
                sends use this column; the signup and resend-code verification
                emails send from the COMPANY NAME directly (BR-1 Phase 2, B.3).
                So it governs most transactional and marketing mail and not the
                two verification emails — which is what the text now says. */}
            <SettingsInput label="Email Sender Name" value={formData.email_sender_name} onChange={v => handleChange('email_sender_name', v)} placeholder="Your Company Name" />
            <HelperText>The "From" name on your marketing and notification emails. Verification emails always send from your company name. Leave blank to use your company name everywhere.</HelperText>
          </div>
          <div>
            {/* ⚠ "VERIFICATION AND NOTIFICATION EMAILS" WAS FALSE — and named the
                one class of email that does NOT read this column. Verified by
                grepping every reader: `server/cron/jobs/postJobSequence.js` and
                the Jobber invoice-paid webhook. The verification emails carry no
                footer text at all. Third false helper in this card, and all three
                sounded plausible. */}
            <SettingsInput label="Email Footer Text" value={formData.email_footer_text} onChange={v => handleChange('email_footer_text', v)} placeholder="Your Company Name · Powered by RoofMiles" multiline rows={2} />
            <HelperText>Appears at the bottom of post-job follow-up emails and reward notifications</HelperText>
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
            background: AD.red2, color: '#fff',
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
        {/* ── ⚠ THE PREVIEW GETS THE WHOLE DRAFT, NOT JUST THE EDITED FIELDS ──
            It used to receive `formData` alone, and `formData` carries eighteen
            keys while the branding resolver reads sixteen inputs — of which it
            supplied eight. So the preview could not see the contractor's logo or
            their company name, and the login screen inside it fell back to the
            platform mark and the platform name while the REAL screen, reading the
            same keys from the same resolver, showed the contractor's.
            ⚠ THE LOGO LOOKED LIKE A WRONG-FIELD READ AND WAS NOT. The form offers
            two logo slots and the second was unset with a note saying the platform
            mark stands in for it, so the preview appeared to be showing that one.
            It was showing NEITHER: both logo URLs live in `logoData`, which never
            reached it. Pointing the preview at the second column would have gone
            permanently blank — no resolver key exposes it.
            ⚠ THE SPREAD ORDER IS handleSave's ORDER, DELIBERATELY. Saved settings
            first, the form's edits over them, so the preview shows what a save
            would produce rather than a fourth combination that agrees with
            nothing. `logoData` LAST because an upload updates it after the
            snapshot was captured on mount — behind the edits it would show the old
            mark until the admin saved and came back, which is the defect B-3b
            removed arriving through a different key.
            ⚠ AND IT MEANS SAVED VALUES SHOW FOR FIELDS THIS FORM DOES NOT EDIT —
            the company name, the phone, the address. That is correct rather than
            incidental: those are what the live screen renders, and a preview that
            blanked them would be lying in the other direction. */}
        <BrandingPreview formData={{ ...fullSettingsRef.current, ...formData, ...logoData }} />
      </div>
    </div>
  );
}
