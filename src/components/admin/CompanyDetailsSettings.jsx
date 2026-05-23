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

const ALL_AWARDS = [
  { id: 'gaf_master_elite',        label: 'GAF Master Elite',                         group: 'Manufacturer Certifications', multiYear: false },
  { id: 'gaf_presidents_club',     label: "GAF President's Club",                     group: 'Manufacturer Certifications', multiYear: false },
  { id: 'gaf_triple_excellence',   label: 'GAF Triple Excellence Award',              group: 'Manufacturer Certifications', multiYear: false },
  { id: 'certainteed_select',      label: 'CertainTeed SELECT ShingleMaster',         group: 'Manufacturer Certifications', multiYear: false },
  { id: 'certainteed_premier',     label: 'CertainTeed Premier',                      group: 'Manufacturer Certifications', multiYear: false },
  { id: 'owens_corning_preferred', label: 'Owens Corning Preferred',                  group: 'Manufacturer Certifications', multiYear: false },
  { id: 'bbb_a_plus',              label: 'BBB A+ Accredited Business',               group: 'Industry & Trade',            multiYear: false },
  { id: 'ga_rca',                  label: 'GA RCA Licensed',                          group: 'Industry & Trade',            multiYear: false },
  { id: 'nrca_member',             label: 'NRCA Member',                              group: 'Industry & Trade',            multiYear: false },
  { id: 'nrcia_member',            label: 'NRCIA Member',                             group: 'Industry & Trade',            multiYear: false },
  { id: 'haag_certified',          label: 'HAAG Certified Inspector',                 group: 'Industry & Trade',            multiYear: false },
  { id: 'fortified_home',          label: 'Fortified Home',                           group: 'Industry & Trade',            multiYear: false },
  { id: 'best_of_gwinnett',        label: 'Best of Gwinnett',                         group: 'Consumer Awards',             multiYear: true  },
  { id: 'best_of_georgia',         label: 'Best of Georgia',                          group: 'Consumer Awards',             multiYear: true  },
  { id: 'angi_super_service',      label: 'Angi Super Service Award',                 group: 'Consumer Awards',             multiYear: true  },
  { id: 'nextdoor_faves',          label: 'NextDoor Neighborhood Faves',              group: 'Consumer Awards',             multiYear: true  },
  { id: 'guildmaster',             label: 'Guildmaster Award for Service Excellence', group: 'Consumer Awards',             multiYear: false },
  { id: 'homeadvisor_best_of',     label: 'Best of HomeAdvisor',                      group: 'Consumer Awards',             multiYear: false },
];

const AWARD_GROUPS = ['Manufacturer Certifications', 'Industry & Trade', 'Consumer Awards'];

export default function CompanyDetailsSettings() {
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'success' | 'error'
  const [dirty, setDirty]           = useState(false);
  const statusTimer                 = useRef(null);

  const EMPTY_NOTIF = {
    notification_email_payouts: '',
    notification_email_general: '',
    booking_email: '',
  };

  const [notifData, setNotifData]       = useState(EMPTY_NOTIF);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving]   = useState(false);
  const [notifStatus, setNotifStatus]   = useState(null); // null | 'success' | 'error'
  const notifTimer                      = useRef(null);

  // About Us state
  const [aboutLoading, setAboutLoading]           = useState(true);
  const [aboutEnabled, setAboutEnabled]           = useState(false);
  const [bio, setBio]                             = useState('');
  const [yearsInBusiness, setYearsInBusiness]     = useState('');
  const [serviceArea, setServiceArea]             = useState('');
  const [googlePlaceId, setGooglePlaceId]         = useState('');
  const [certifications, setCertifications]       = useState([]);
  const [certSearch, setCertSearch]               = useState('');
  const [addingYearFor, setAddingYearFor]         = useState(null);
  const [yearInputVal, setYearInputVal]           = useState('');
  const [hoveredCert, setHoveredCert]             = useState(null);
  const [aboutBookingEnabled, setAboutBookingEnabled] = useState(false); // preserved from API, managed by Experience settings
  const [savingAbout, setSavingAbout]             = useState(false);
  const [aboutSaveStatus, setAboutSaveStatus]     = useState(null); // null | 'success' | 'error'
  const aboutTimer                                = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        const d = await r.json();
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
      } catch {
        // swallow — leave defaults
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/notification-settings`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        const d = await r.json();
        setNotifData({
          notification_email_payouts: d.notification_email_payouts || '',
          notification_email_general: d.notification_email_general || '',
          booking_email:              d.booking_email              || '',
        });
      } catch {
        // swallow
      } finally {
        setNotifLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/about`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        const d = await r.json();
        setAboutEnabled(d.enabled ?? false);
        setBio(d.bio || '');
        setYearsInBusiness(d.years_in_business || '');
        setServiceArea(d.service_area || '');
        setGooglePlaceId(d.google_place_id || '');
        setAboutBookingEnabled(d.booking_enabled ?? false);
        const normalize = (raw) => {
          if (!Array.isArray(raw)) return [];
          return raw.map(item => typeof item === 'string' ? { id: item, enabled: true, years: [] } : item);
        };
        const saved = normalize(d.certifications);
        setCertifications(ALL_AWARDS.map(award => {
          const found = saved.find(s => s.id === award.id);
          return found ? { id: award.id, enabled: true, years: found.years || [] }
                       : { id: award.id, enabled: false, years: [] };
        }));
      } catch {
        // swallow
      } finally {
        setAboutLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const d = await r.json();
      setSaveStatus(d.success ? 'success' : 'error');
      if (d.success) setDirty(false);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  async function handleNotifSave() {
    setNotifSaving(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/notification-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifData),
      });
      const d = await r.json();
      setNotifStatus(d.success ? 'success' : 'error');
    } catch {
      setNotifStatus('error');
    } finally {
      setNotifSaving(false);
      if (notifTimer.current) clearTimeout(notifTimer.current);
      notifTimer.current = setTimeout(() => setNotifStatus(null), 3000);
    }
  }

  async function handleAboutSave() {
    setSavingAbout(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/about`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled:           aboutEnabled,
          booking_enabled:   aboutBookingEnabled,
          bio:               bio || null,
          years_in_business: yearsInBusiness || null,
          service_area:      serviceArea || null,
          google_place_id:   googlePlaceId || null,
          certifications:    certifications.filter(c => c.enabled),
        }),
      });
      const d = await r.json();
      setAboutSaveStatus(d.success ? 'success' : 'error');
    } catch {
      setAboutSaveStatus('error');
    } finally {
      setSavingAbout(false);
      if (aboutTimer.current) clearTimeout(aboutTimer.current);
      aboutTimer.current = setTimeout(() => setAboutSaveStatus(null), 3000);
    }
  }

  function toggleCert(id) {
    setCertifications(prev =>
      prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    );
  }

  function removeYear(id, year) {
    setCertifications(prev =>
      prev.map(c => c.id === id ? { ...c, years: c.years.filter(y => y !== year) } : c)
    );
  }

  function confirmAddYear(id) {
    const yr = parseInt(yearInputVal, 10);
    if (!yr || yr < 1900 || yr > 2100) return;
    setCertifications(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const years = [...new Set([...c.years, yr])].sort((a, b) => b - a);
        return { ...c, years };
      })
    );
    setAddingYearFor(null);
    setYearInputVal('');
  }

  if (loading) {
    return (
      <div style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14, padding: '8px 0' }}>
        Loading…
      </div>
    );
  }

  const saveDisabled = !dirty || saving;

  const aboutInputStyle = {
    width: '100%', padding: '9px 12px',
    background: AD.bgCard, border: `1px solid ${AD.border}`,
    borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
    color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>

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

      {/* ── Section 3: Notification Settings ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>Notification Settings</SectionHeading>
        {notifLoading ? (
          <div style={{ color: AD.textSecondary, fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <SettingsInput
                label="Payout Notifications Email"
                value={notifData.notification_email_payouts}
                onChange={v => setNotifData(prev => ({ ...prev, notification_email_payouts: v }))}
                placeholder="Leave blank to use your company email"
                type="email"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary }}>
                Cashout requests and ACH transfer alerts are sent here.
              </p>
            </div>

            <div>
              <SettingsInput
                label="General Notifications Email"
                value={notifData.notification_email_general}
                onChange={v => setNotifData(prev => ({ ...prev, notification_email_general: v }))}
                placeholder="Leave blank to use your company email"
                type="email"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary }}>
                New referrer signups, account alerts, and general platform notifications are sent here.
              </p>
            </div>

            <div>
              <SettingsInput
                label="Booking Notifications Email"
                value={notifData.booking_email}
                onChange={v => setNotifData(prev => ({ ...prev, booking_email: v }))}
                placeholder="Leave blank to use your company email"
                type="email"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary }}>
                Booking form submissions from referrers are sent here.
              </p>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: AD.textTertiary, fontStyle: 'italic' }}>
              All notification emails fall back to your Company Email above if left blank.
            </p>

            {/* Notification save row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              {notifStatus === 'success' && (
                <span style={{ fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>✓ Saved</span>
              )}
              {notifStatus === 'error' && (
                <span style={{ fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>Save failed — try again</span>
              )}
              <button
                onClick={handleNotifSave}
                disabled={notifSaving}
                style={{
                  padding: '9px 24px', borderRadius: AD.radiusMd, border: 'none',
                  cursor: notifSaving ? 'not-allowed' : 'pointer',
                  background: '#CC0000', color: '#fff',
                  fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
                  opacity: notifSaving ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!notifSaving) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { if (!notifSaving) e.currentTarget.style.opacity = '1'; }}
              >
                {notifSaving ? 'Saving…' : 'Save Notification Settings'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ── Section 4: About Us ── */}
      <div style={{
        background: AD.bgSurface, border: `1px solid ${AD.border}`,
        borderRadius: AD.radiusLg, padding: 32, marginBottom: 20,
      }}>
        <SectionHeading>About Us</SectionHeading>
        {aboutLoading ? (
          <div style={{ color: AD.textSecondary, fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Master toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: AD.textPrimary }}>Show About Us to referrers</p>
                {!aboutEnabled && (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: AD.textSecondary }}>
                    About Us section is hidden from all referrers
                  </p>
                )}
              </div>
              <button
                onClick={() => setAboutEnabled(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: aboutEnabled ? '#2D8B5F' : AD.bgCardTint,
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: aboutEnabled ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Company Bio */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
                Company Bio
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell referrers about your company, your story, and what makes you different."
                rows={4}
                style={{ ...aboutInputStyle, resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = AD.blueLight}
                onBlur={e => e.target.style.borderColor = AD.border}
              />
            </div>

            {/* Years in Business + Service Area */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SettingsInput
                label="Years in Business"
                value={yearsInBusiness}
                onChange={setYearsInBusiness}
                placeholder="e.g. 12 years"
              />
              <SettingsInput
                label="Service Area"
                value={serviceArea}
                onChange={setServiceArea}
                placeholder="e.g. Metro Atlanta & surrounding counties"
              />
            </div>

            {/* Google Place ID */}
            <div>
              <SettingsInput
                label="Google Place ID"
                value={googlePlaceId}
                onChange={setGooglePlaceId}
                placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary }}>
                Find your Place ID at: developers.google.com/maps/documentation/places/web-service/place-id
              </p>
            </div>

            {/* Certifications & Awards */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 10 }}>
                Certifications &amp; Awards
              </label>

              {/* Search bar */}
              <input
                type="text"
                value={certSearch}
                onChange={e => setCertSearch(e.target.value)}
                placeholder="Search awards…"
                style={{ ...aboutInputStyle, marginBottom: 16 }}
                onFocus={e => e.target.style.borderColor = AD.blueLight}
                onBlur={e => e.target.style.borderColor = AD.border}
              />

              {/* Grouped award rows */}
              {AWARD_GROUPS.map(group => {
                const q = certSearch.trim().toLowerCase();
                const awards = ALL_AWARDS.filter(a =>
                  a.group === group && (!q || a.label.toLowerCase().includes(q))
                );
                if (awards.length === 0) return null;
                return (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <p style={{
                      margin: '0 0 6px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: AD.textTertiary,
                    }}>
                      {group}
                    </p>
                    {awards.map(award => {
                      const certState = certifications.find(c => c.id === award.id) || { id: award.id, enabled: false, years: [] };
                      const isHovered = hoveredCert === award.id;
                      const rowBg = certState.enabled
                        ? 'rgba(37,99,235,0.07)'
                        : isHovered ? AD.bgCardTint : 'transparent';
                      return (
                        <div
                          key={award.id}
                          onMouseEnter={() => setHoveredCert(award.id)}
                          onMouseLeave={() => setHoveredCert(null)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '8px 10px', borderRadius: 8,
                            background: rowBg, transition: 'background 0.12s',
                            cursor: 'default',
                          }}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={() => toggleCert(award.id)}
                            style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
                              border: `1.5px solid ${certState.enabled ? AD.blueLight : AD.borderStrong}`,
                              background: certState.enabled ? AD.navy : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                            }}
                          >
                            {certState.enabled && (
                              <i className="ph ph-check" style={{ fontSize: 10, color: AD.blueLight }} />
                            )}
                          </div>

                          {/* Label + year management */}
                          <div style={{ flex: 1 }}>
                            <span
                              onClick={() => toggleCert(award.id)}
                              style={{
                                fontSize: 14,
                                color: certState.enabled ? AD.textPrimary : AD.textSecondary,
                                cursor: 'pointer', userSelect: 'none',
                                transition: 'color 0.12s',
                              }}
                            >
                              {award.label}
                            </span>

                            {award.multiYear && certState.enabled && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                {certState.years.map(yr => (
                                  <span
                                    key={yr}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 9999,
                                      background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`,
                                      fontSize: 12, color: AD.textPrimary, fontFamily: AD.fontSans,
                                    }}
                                  >
                                    {yr}
                                    <button
                                      onClick={() => removeYear(award.id, yr)}
                                      style={{
                                        background: 'none', border: 'none', padding: 0,
                                        color: AD.textSecondary, cursor: 'pointer',
                                        lineHeight: 1, display: 'flex', alignItems: 'center',
                                      }}
                                    >
                                      <i className="ph ph-x" style={{ fontSize: 10 }} />
                                    </button>
                                  </span>
                                ))}

                                {addingYearFor === award.id ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                      type="number"
                                      value={yearInputVal}
                                      onChange={e => setYearInputVal(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') confirmAddYear(award.id);
                                        if (e.key === 'Escape') { setAddingYearFor(null); setYearInputVal(''); }
                                      }}
                                      placeholder="Year"
                                      autoFocus
                                      style={{
                                        width: 70, padding: '2px 8px',
                                        background: AD.bgCard, border: `1px solid ${AD.blueLight}`,
                                        borderRadius: 6, fontFamily: AD.fontSans, fontSize: 12,
                                        color: AD.textPrimary, outline: 'none',
                                      }}
                                    />
                                    <button
                                      onClick={() => confirmAddYear(award.id)}
                                      style={{
                                        padding: '2px 8px', borderRadius: 6, border: 'none',
                                        background: AD.navy, color: AD.blueLight,
                                        fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                                      }}
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => { setAddingYearFor(null); setYearInputVal(''); }}
                                      style={{
                                        background: 'none', border: 'none', padding: '2px 4px',
                                        color: AD.textSecondary, cursor: 'pointer', fontSize: 13,
                                        fontFamily: AD.fontSans,
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setAddingYearFor(award.id); setYearInputVal(''); }}
                                    style={{
                                      background: 'none', border: `1px dashed ${AD.borderStrong}`,
                                      borderRadius: 9999, padding: '2px 10px',
                                      color: AD.textSecondary, fontSize: 12,
                                      fontFamily: AD.fontSans, cursor: 'pointer',
                                    }}
                                  >
                                    + Add Year
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* About Us save row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              {aboutSaveStatus === 'success' && (
                <span style={{ fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans }}>✓ Saved</span>
              )}
              {aboutSaveStatus === 'error' && (
                <span style={{ fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>Save failed — try again</span>
              )}
              <button
                onClick={handleAboutSave}
                disabled={savingAbout}
                style={{
                  padding: '9px 24px', borderRadius: AD.radiusMd, border: 'none',
                  cursor: savingAbout ? 'not-allowed' : 'pointer',
                  background: '#CC0000', color: '#fff',
                  fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
                  opacity: savingAbout ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!savingAbout) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { if (!savingAbout) e.currentTarget.style.opacity = '1'; }}
              >
                {savingAbout ? 'Saving…' : 'Save About Us'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ── Save row (Company Info + Address) ── */}
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
