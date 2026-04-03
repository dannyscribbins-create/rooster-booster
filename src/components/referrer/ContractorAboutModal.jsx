import { R } from '../../constants/theme';
import { CONTRACTOR_CONFIG } from '../../config/contractor';
import { Clock, MapPin, Star } from '@phosphor-icons/react';

const AWARD_LABELS = {
  gaf_master_elite:        'GAF Master Elite',
  gaf_presidents_club:     "GAF President's Club",
  gaf_triple_excellence:   'GAF Triple Excellence Award',
  certainteed_select:      'CertainTeed SELECT ShingleMaster',
  certainteed_premier:     'CertainTeed Premier',
  owens_corning_preferred: 'Owens Corning Preferred',
  bbb_a_plus:              'BBB A+ Accredited Business',
  ga_rca:                  'GA RCA Licensed',
  nrca_member:             'NRCA Member',
  nrcia_member:            'NRCIA Member',
  haag_certified:          'HAAG Certified Inspector',
  fortified_home:          'Fortified Home',
  best_of_gwinnett:        'Best of Gwinnett',
  best_of_georgia:         'Best of Georgia',
  angi_super_service:      'Angi Super Service Award',
  nextdoor_faves:          'NextDoor Neighborhood Faves',
  guildmaster:             'Guildmaster Award for Service Excellence',
  homeadvisor_best_of:     'Best of HomeAdvisor',
};

export default function ContractorAboutModal({ visible, onContinue, onBook, aboutData }) {
  if (!visible || !aboutData) return null;

  const contractorName = CONTRACTOR_CONFIG.name || 'Your Contractor';

  return (
    <div
      onClick={onContinue}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '0 20px',
        animation: 'aboutOverlayFadeIn 300ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes aboutOverlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aboutPanelFloat { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: R.navy,
          borderRadius: 16,
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          animation: 'aboutPanelFloat 350ms ease-out forwards',
        }}
      >
        {/* Scrollable content */}
        <div style={{ padding: '28px 24px 0', flex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: 20, textAlign: 'center' }}>
            {CONTRACTOR_CONFIG.logoUrl ? (
              <img
                src={CONTRACTOR_CONFIG.logoUrl}
                alt={contractorName}
                style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: 12, display: 'block', margin: '0 auto 12px' }}
              />
            ) : (
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'rgba(211,227,240,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {contractorName}
              </p>
            )}
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: R.fontSans, letterSpacing: '-0.01em' }}>
              Meet {contractorName}
            </h2>
            <div style={{ width: 40, height: 3, background: R.red, borderRadius: 99, margin: '12px auto 0' }} />
          </div>

          {/* Bio */}
          {aboutData.bio && (
            <div style={{
              borderLeft: `3px solid ${R.red}`,
              paddingLeft: 16,
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.85)', fontFamily: R.fontBody, lineHeight: 1.65 }}>
                {aboutData.bio}
              </p>
            </div>
          )}

          {/* Years + Service Area */}
          {(aboutData.years_in_business || aboutData.service_area) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {aboutData.years_in_business && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={18} weight="fill" color={R.blueLight} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: R.fontBody }}>
                    {aboutData.years_in_business}
                  </span>
                </div>
              )}
              {aboutData.service_area && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={18} weight="fill" color={R.blueLight} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: R.fontBody }}>
                    {aboutData.service_area}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Google Rating */}
          {aboutData.google_rating != null && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Star size={22} weight="fill" color="#F5A623" />
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: R.fontMono, lineHeight: 1 }}>
                  {aboutData.google_rating}
                </span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontFamily: R.fontMono }}>/5</span>
              </div>
              {aboutData.google_review_count != null && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: R.fontBody }}>
                  Based on {Number(aboutData.google_review_count).toLocaleString()} Google reviews
                </p>
              )}
            </div>
          )}

          {/* Certifications & Awards */}
          {(() => {
            const normalize = (raw) => {
              if (!Array.isArray(raw)) return [];
              return raw.map(item => typeof item === 'string' ? { id: item, enabled: true, years: [] } : item);
            };
            const certs = normalize(aboutData.certifications).filter(c => c.enabled);
            if (certs.length === 0) return null;
            return (
            <div style={{ marginBottom: 28 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(211,227,240,0.5)' }}>
                Certifications &amp; Awards
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {certs.map(cert => {
                  const label = AWARD_LABELS[cert.id] || cert.id;
                  const allYears = cert.years || [];
                  const hasMore = allYears.length > 3;
                  // Slice 3 most recent (stored descending), reverse to ascending for display
                  const displayYears = [...allYears.slice(0, 3)].reverse();
                  return (
                    <div key={cert.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 11px', borderRadius: 99,
                        border: '1px solid rgba(211,227,240,0.3)',
                      }}>
                        <img
                          src={`/badges/${cert.id}.png`}
                          alt=""
                          height={28}
                          style={{ objectFit: 'contain' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <span style={{ color: R.blueLight, fontSize: 12, fontFamily: R.fontBody }}>
                          {label}
                        </span>
                      </div>
                      {displayYears.length > 0 && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(211,227,240,0.45)', fontFamily: R.fontBody }}>
                          {displayYears.join(' · ')}{hasMore ? ' +' : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}
        </div>

        {/* Sticky buttons */}
        <div style={{
          padding: '16px 24px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: R.navy,
          borderTop: '1px solid rgba(211,227,240,0.1)',
          position: 'sticky', bottom: 0,
        }}>
          <button
            onClick={onBook}
            style={{
              width: '100%', padding: '14px 24px',
              background: R.red, border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: 'pointer',
            }}
          >
            Book Your Free Inspection
          </button>
          <button
            onClick={onContinue}
            style={{
              width: '100%', padding: '12px 24px',
              background: 'transparent', border: 'none', borderRadius: 12,
              color: R.blueLight, fontSize: 14, fontWeight: 500,
              fontFamily: R.fontSans, cursor: 'pointer',
            }}
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
