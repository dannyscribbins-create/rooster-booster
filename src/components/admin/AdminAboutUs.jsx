import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';
import Skeleton from '../shared/Skeleton';

const ALL_AWARDS = [
  // Manufacturer Certifications
  { id: 'gaf_master_elite',        label: 'GAF Master Elite',                            group: 'Manufacturer Certifications', multiYear: false },
  { id: 'gaf_presidents_club',     label: "GAF President's Club",                        group: 'Manufacturer Certifications', multiYear: false },
  { id: 'gaf_triple_excellence',   label: 'GAF Triple Excellence Award',                 group: 'Manufacturer Certifications', multiYear: false },
  { id: 'certainteed_select',      label: 'CertainTeed SELECT ShingleMaster',            group: 'Manufacturer Certifications', multiYear: false },
  { id: 'certainteed_premier',     label: 'CertainTeed Premier',                         group: 'Manufacturer Certifications', multiYear: false },
  { id: 'owens_corning_preferred', label: 'Owens Corning Preferred',                     group: 'Manufacturer Certifications', multiYear: false },
  // Industry & Trade
  { id: 'bbb_a_plus',              label: 'BBB A+ Accredited Business',                  group: 'Industry & Trade',            multiYear: false },
  { id: 'ga_rca',                  label: 'GA RCA Licensed',                             group: 'Industry & Trade',            multiYear: false },
  { id: 'nrca_member',             label: 'NRCA Member',                                 group: 'Industry & Trade',            multiYear: false },
  { id: 'nrcia_member',            label: 'NRCIA Member',                                group: 'Industry & Trade',            multiYear: false },
  { id: 'haag_certified',          label: 'HAAG Certified Inspector',                    group: 'Industry & Trade',            multiYear: false },
  { id: 'fortified_home',          label: 'Fortified Home',                              group: 'Industry & Trade',            multiYear: false },
  // Consumer Awards
  { id: 'best_of_gwinnett',        label: 'Best of Gwinnett',                            group: 'Consumer Awards',             multiYear: true  },
  { id: 'best_of_georgia',         label: 'Best of Georgia',                             group: 'Consumer Awards',             multiYear: true  },
  { id: 'angi_super_service',      label: 'Angi Super Service Award',                    group: 'Consumer Awards',             multiYear: true  },
  { id: 'nextdoor_faves',          label: 'NextDoor Neighborhood Faves',                 group: 'Consumer Awards',             multiYear: true  },
  { id: 'guildmaster',             label: 'Guildmaster Award for Service Excellence',    group: 'Consumer Awards',             multiYear: false },
  { id: 'homeadvisor_best_of',     label: 'Best of HomeAdvisor',                         group: 'Consumer Awards',             multiYear: false },
];

const AWARD_GROUPS = ['Manufacturer Certifications', 'Industry & Trade', 'Consumer Awards'];

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
  const [certSearch, setCertSearch]         = useState('');
  const [addingYearFor, setAddingYearFor]   = useState(null);
  const [yearInputVal, setYearInputVal]     = useState('');
  const [hoveredCert, setHoveredCert]       = useState(null);

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
      certifications: certifications.filter(c => c.enabled),
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
      <>
        <AdminPageHeader title="About Us & Booking" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height="52px" borderRadius="12px" />
          <Skeleton height="52px" width="75%" borderRadius="12px" />
          <Skeleton height="52px" width="55%" borderRadius="12px" />
        </div>
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

      {/* Certifications & Awards */}
      <div style={sectionCard}>
        <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>
          Certifications &amp; Awards
        </p>

        {/* Search bar */}
        <input
          type="text"
          value={certSearch}
          onChange={e => setCertSearch(e.target.value)}
          placeholder="Search awards…"
          style={{ ...inputStyle, marginBottom: 20 }}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.borderStrong}
        />

        {/* Grouped award rows */}
        {AWARD_GROUPS.map(group => {
          const q = certSearch.trim().toLowerCase();
          const awards = ALL_AWARDS.filter(a =>
            a.group === group && (!q || a.label.toLowerCase().includes(q))
          );
          if (awards.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 20 }}>
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
                      background: rowBg,
                      transition: 'background 0.12s',
                      cursor: 'default',
                    }}
                  >
                    {/* Custom checkbox */}
                    <div
                      onClick={() => toggleCert(award.id)}
                      style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        marginTop: 2,
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
                          fontSize: 14, color: certState.enabled ? AD.textPrimary : AD.textSecondary,
                          cursor: 'pointer', userSelect: 'none',
                          transition: 'color 0.12s',
                        }}
                      >
                        {award.label}
                      </span>

                      {/* Year area — only for multiYear awards that are enabled */}
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
                                  color: AD.textSecondary, cursor: 'pointer', fontSize: 13,
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
                                onKeyDown={e => { if (e.key === 'Enter') confirmAddYear(award.id); if (e.key === 'Escape') { setAddingYearFor(null); setYearInputVal(''); } }}
                                placeholder="Year"
                                autoFocus
                                style={{
                                  width: 70, padding: '2px 8px',
                                  background: AD.bgSurface, border: `1px solid ${AD.blueLight}`,
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
                                transition: 'color 0.12s, border-color 0.12s',
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
