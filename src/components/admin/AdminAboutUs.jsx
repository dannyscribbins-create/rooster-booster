import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';

const CERT_OPTIONS = [
  { key: 'gaf_master_elite',  label: 'GAF Master Elite' },
  { key: 'gaf_certified',     label: 'GAF Certified Contractor' },
  { key: 'owens_corning',     label: 'Owens Corning Preferred' },
  { key: 'certainteed',       label: 'CertainTeed SELECT ShingleMaster' },
  { key: 'bbb',               label: 'BBB Accredited Business' },
  { key: 'angi',              label: 'Angi Super Service Award' },
  { key: 'homeadvisor',       label: 'HomeAdvisor Elite Service' },
  { key: 'haag',              label: 'HAAG Certified Inspector' },
  { key: 'nrca',              label: 'NRCA Member' },
  { key: 'licensed_insured',  label: 'Licensed & Insured' },
];

export default function AdminAboutUs({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState('');

  // About Us fields
  const [enabled, setEnabled]               = useState(false);
  const [bio, setBio]                       = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [serviceArea, setServiceArea]       = useState('');
  const [googlePlaceId, setGooglePlaceId]   = useState('');
  const [certifications, setCertifications] = useState([]);

  // Booking fields
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingEmail, setBookingEmail]     = useState('');

  // Save states
  const [savingAbout, setSavingAbout]           = useState(false);
  const [saveAboutStatus, setSaveAboutStatus]   = useState('');
  const [savingBooking, setSavingBooking]        = useState(false);
  const [saveBookingStatus, setSaveBookingStatus] = useState('');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/about`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setEnabled(d.enabled ?? false);
        setBio(d.bio || '');
        setYearsInBusiness(d.years_in_business || '');
        setServiceArea(d.service_area || '');
        setGooglePlaceId(d.google_place_id || '');
        setCertifications(d.certifications || []);
        setBookingEnabled(d.booking_enabled ?? false);
        setBookingEmail(d.booking_email || '');
        setLoading(false);
      })
      .catch(() => { setLoadError('Failed to load settings.'); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildPayload() {
    return {
      enabled,
      booking_enabled: bookingEnabled,
      bio: bio || null,
      years_in_business: yearsInBusiness || null,
      service_area: serviceArea || null,
      google_place_id: googlePlaceId || null,
      certifications,
      booking_email: bookingEmail || null,
    };
  }

  function handleSaveAbout() {
    setSavingAbout(true); setSaveAboutStatus('');
    fetch(`${BACKEND_URL}/api/admin/about`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify(buildPayload()),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        setSavingAbout(false);
        if (!d) return;
        setSaveAboutStatus(d.success ? 'saved' : 'error');
        setTimeout(() => setSaveAboutStatus(''), 2000);
      })
      .catch(() => { setSavingAbout(false); setSaveAboutStatus('error'); });
  }

  function handleSaveBooking() {
    setSavingBooking(true); setSaveBookingStatus('');
    fetch(`${BACKEND_URL}/api/admin/about`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify(buildPayload()),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        setSavingBooking(false);
        if (!d) return;
        setSaveBookingStatus(d.success ? 'saved' : 'error');
        setTimeout(() => setSaveBookingStatus(''), 2000);
      })
      .catch(() => { setSavingBooking(false); setSaveBookingStatus('error'); });
  }

  function toggleCert(key) {
    setCertifications(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  if (loading) {
    return (
      <>
        <AdminPageHeader title="About Us & Booking" />
        <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AdminPageHeader title="About Us & Booking" />
        <p style={{ color: AD.red2Text, fontSize: 15 }}>{loadError}</p>
      </>
    );
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px',
    background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
    borderRadius: 10, fontFamily: AD.fontSans, fontSize: 15,
    color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const sectionCard = {
    background: AD.bgCard, border: `1px solid ${AD.border}`,
    borderRadius: 16, padding: '20px 24px',
    marginBottom: 20, boxShadow: AD.shadowSm,
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 500,
    color: AD.textSecondary, marginBottom: 8,
  };

  const helperStyle = {
    margin: '4px 0 0', fontSize: 11, color: AD.textTertiary,
  };

  const fieldWrap = { marginBottom: 20 };

  return (
    <>
      <AdminPageHeader title="About Us & Booking" />

      {/* ── SECTION 1: About Us Settings ─────────────────────────────── */}
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textSecondary }}>
        About Us Settings
      </p>

      {/* Master toggle */}
      <div style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Show About Us to referrers</p>
          {!enabled && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>
              About Us modal and card are hidden from all referrers
            </p>
          )}
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            background: enabled ? '#2D8B5F' : AD.bgCardTint,
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: enabled ? 22 : 2,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {/* Bio, Years, Service Area, Place ID */}
      <div style={sectionCard}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Company Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell referrers about your company, your story, and what makes you different."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical', lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = AD.blueLight}
            onBlur={e => e.target.style.borderColor = AD.borderStrong}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Years in Business</label>
            <input
              type="text"
              value={yearsInBusiness}
              onChange={e => setYearsInBusiness(e.target.value)}
              placeholder="e.g. 12 years"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = AD.blueLight}
              onBlur={e => e.target.style.borderColor = AD.borderStrong}
            />
          </div>
          <div>
            <label style={labelStyle}>Service Area</label>
            <input
              type="text"
              value={serviceArea}
              onChange={e => setServiceArea(e.target.value)}
              placeholder="e.g. Metro Atlanta & surrounding counties"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = AD.blueLight}
              onBlur={e => e.target.style.borderColor = AD.borderStrong}
            />
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Google Place ID</label>
          <input
            type="text"
            value={googlePlaceId}
            onChange={e => setGooglePlaceId(e.target.value)}
            placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = AD.blueLight}
            onBlur={e => e.target.style.borderColor = AD.borderStrong}
          />
          <p style={helperStyle}>
            Find your Place ID at: developers.google.com/maps/documentation/places/web-service/place-id
          </p>
        </div>
      </div>

      {/* Certifications */}
      <div style={sectionCard}>
        <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>
          Certifications &amp; Credentials
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CERT_OPTIONS.map(cert => {
            const selected = certifications.includes(cert.key);
            return (
              <button
                key={cert.key}
                onClick={() => toggleCert(cert.key)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${selected ? AD.navy : AD.borderStrong}`,
                  background: selected ? AD.navy : 'transparent',
                  color: selected ? '#fff' : AD.textPrimary,
                  fontSize: 12, fontWeight: 500,
                  fontFamily: AD.fontSans,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  lineHeight: 1.4,
                }}
              >
                {cert.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save About Us */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <Btn onClick={handleSaveAbout} variant="accent" size="lg">
          {savingAbout
            ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            : <><i className="ph ph-floppy-disk" /> Save About Us Settings</>}
        </Btn>
        {saveAboutStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved!</span>}
        {saveAboutStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* ── SECTION 2: Booking Settings ───────────────────────────────── */}
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textSecondary }}>
        Booking Settings
      </p>

      {/* Booking toggle */}
      <div style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Enable Booking Feature</p>
          {!bookingEnabled && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>
              Booking form and dashboard banner are hidden from all referrers
            </p>
          )}
        </div>
        <button
          onClick={() => setBookingEnabled(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            background: bookingEnabled ? '#2D8B5F' : AD.bgCardTint,
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: bookingEnabled ? 22 : 2,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {/* Booking email */}
      <div style={sectionCard}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Booking Notification Email</label>
          <input
            type="text"
            value={bookingEmail}
            onChange={e => setBookingEmail(e.target.value)}
            placeholder="Leave blank to use your default notification email"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = AD.blueLight}
            onBlur={e => e.target.style.borderColor = AD.borderStrong}
          />
          <p style={helperStyle}>
            Booking form submissions will be emailed here. Leave blank to use your default notification email.
          </p>
        </div>
      </div>

      {/* Save Booking */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={handleSaveBooking} variant="accent" size="lg">
          {savingBooking
            ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            : <><i className="ph ph-floppy-disk" /> Save Booking Settings</>}
        </Btn>
        {saveBookingStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved!</span>}
        {saveBookingStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
