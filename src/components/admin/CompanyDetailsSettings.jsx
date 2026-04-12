import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

function SettingsInput({ label, value, onChange, placeholder, type = 'text' }) {
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
        style={{
          width: '100%', padding: '9px 12px',
          background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
          color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.border}
      />
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

const EMPTY_FORM = {
  company_name: '', company_phone: '', company_email: '', company_url: '',
  company_address: '', company_city: '', company_state: '', company_zip: '', company_country: 'US',
};

export default function CompanyDetailsSettings() {
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'success' | 'error'
  const [dirty, setDirty]           = useState(false);
  const statusTimer                 = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => r.json())
      .then(d => {
        setFormData({
          company_name:    d.company_name    || '',
          company_phone:   d.company_phone   || '',
          company_email:   d.company_email   || '',
          company_url:     d.company_url     || '',
          company_address: d.company_address || '',
          company_city:    d.company_city    || '',
          company_state:   d.company_state   || '',
          company_zip:     d.company_zip     || '',
          company_country: d.company_country || 'US',
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
    fetch(`${BACKEND_URL}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false);
        setSaveStatus(d.success ? 'success' : 'error');
        if (d.success) setDirty(false);
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
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* ── Section 1: Company Information ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>Company Information</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput
            label="Company Name"
            value={formData.company_name}
            onChange={v => handleChange('company_name', v)}
            placeholder="Accent Roofing Service"
          />
          <SettingsInput
            label="Phone Number"
            value={formData.company_phone}
            onChange={v => handleChange('company_phone', v)}
            placeholder="770-277-4869"
          />
          <SettingsInput
            label="Email Address"
            value={formData.company_email}
            onChange={v => handleChange('company_email', v)}
            placeholder="contact@leaksmith.com"
            type="email"
          />
          <SettingsInput
            label="Website URL"
            value={formData.company_url}
            onChange={v => handleChange('company_url', v)}
            placeholder="accentroofingservice.com"
          />
        </div>
      </div>

      {/* ── Section 2: Address ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 24,
      }}>
        <SectionHeading>Address</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsInput
            label="Street Address"
            value={formData.company_address}
            onChange={v => handleChange('company_address', v)}
            placeholder="123 Main St"
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}>
              <SettingsInput
                label="City"
                value={formData.company_city}
                onChange={v => handleChange('company_city', v)}
                placeholder="Atlanta"
              />
            </div>
            <div style={{ flex: 1 }}>
              <SettingsInput
                label="State"
                value={formData.company_state}
                onChange={v => handleChange('company_state', v)}
                placeholder="GA"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <SettingsInput
                label="ZIP Code"
                value={formData.company_zip}
                onChange={v => handleChange('company_zip', v)}
                placeholder="30301"
              />
            </div>
            <div style={{ flex: 1 }}>
              <SettingsInput
                label="Country"
                value={formData.company_country}
                onChange={v => handleChange('company_country', v)}
                placeholder="US"
              />
            </div>
          </div>
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
