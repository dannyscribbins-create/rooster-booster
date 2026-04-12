import { useState } from 'react';
import { AD } from '../../constants/adminTheme';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ─── BrandingPreview ──────────────────────────────────────────────────────────
// Phone mockup showing Login + Dashboard screens using live formData values.
// Fonts are already injected into <head> by BrandingProfileSettings's useEffect.

export default function BrandingPreview({ formData }) {
  const [screen, setScreen] = useState('login');

  const primary   = HEX_RE.test(formData.primary_color)   ? formData.primary_color   : '#012854';
  const secondary = HEX_RE.test(formData.secondary_color) ? formData.secondary_color : '#CC0000';
  const accent    = HEX_RE.test(formData.accent_color)    ? formData.accent_color    : '#D3E3F0';
  const fontH     = formData.font_heading    || 'Montserrat';
  const fontB     = formData.font_body       || 'Roboto';
  const appName   = formData.app_display_name || 'Rooster Booster';
  const tagline   = formData.tagline          || 'Refer your neighbors. Earn cash rewards.';
  const reviewBtn = formData.review_button_text || 'Leave a Review';

  return (
    <div>
      {/* Label */}
      <p style={{
        margin: '0 0 14px', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: AD.textTertiary, fontFamily: AD.fontSans,
      }}>
        Live Preview
      </p>

      {/* Screen toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
        {[
          { id: 'login', label: 'Login' },
          { id: 'dashboard', label: 'Dashboard' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              padding: '5px 16px', borderRadius: 999,
              border: `1.5px solid ${screen === id ? primary : AD.border}`,
              background: screen === id ? primary : 'transparent',
              color: screen === id ? '#fff' : AD.textSecondary,
              fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Phone shell */}
      <div style={{
        width: 260, margin: '0 auto',
        background: '#1c2333', borderRadius: 40,
        padding: '12px 10px 10px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        {/* Screen area */}
        <div style={{
          width: '100%', height: 500,
          borderRadius: 32, overflow: 'hidden',
          position: 'relative', background: '#fff',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 10,
            left: '50%', transform: 'translateX(-50%)',
            width: 70, height: 18, borderRadius: 9,
            background: '#1c2333', zIndex: 10,
          }} />

          {screen === 'login' ? (
            <LoginPreview
              primary={primary} secondary={secondary} accent={accent}
              fontH={fontH} fontB={fontB} appName={appName} tagline={tagline}
            />
          ) : (
            <DashboardPreview
              primary={primary} secondary={secondary} accent={accent}
              fontH={fontH} fontB={fontB} reviewBtn={reviewBtn}
            />
          )}
        </div>

        {/* Home indicator */}
        <div style={{
          height: 4, width: 90,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: 2, margin: '8px auto 0',
        }} />
      </div>
    </div>
  );
}

// ─── Login Screen Preview ─────────────────────────────────────────────────────

function LoginPreview({ primary, secondary, accent, fontH, fontB, appName, tagline }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(160deg, ${primary} 0%, ${accent} 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 16px 18px', boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* App identity — sits in upper half above card */}
      <div style={{
        position: 'absolute', top: 44, left: 0, right: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 5, padding: '0 24px',
      }}>
        {/* Logo placeholder */}
        <div style={{
          width: 64, height: 22, borderRadius: 5,
          background: 'rgba(255,255,255,0.22)',
          marginBottom: 4,
        }} />
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 800, color: '#fff',
          fontFamily: `'${fontH}', sans-serif`,
          textAlign: 'center', letterSpacing: '-0.02em',
        }}>
          {appName}
        </p>
        <p style={{
          margin: 0, fontSize: 9,
          color: 'rgba(255,255,255,0.65)',
          fontFamily: `'${fontB}', sans-serif`,
          textAlign: 'center', lineHeight: 1.4,
          maxWidth: 160,
        }}>
          {tagline}
        </p>
      </div>

      {/* Login card */}
      <div style={{
        width: '100%', background: '#fff',
        borderRadius: 16, padding: '14px 14px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      }}>
        {/* Contractor logo placeholder */}
        <div style={{
          width: 60, height: 16, borderRadius: 3,
          background: '#EEF2F7', margin: '0 auto 10px',
        }} />

        <p style={{
          margin: '0 0 2px', fontSize: 11, fontWeight: 700,
          color: primary, fontFamily: `'${fontH}', sans-serif`,
        }}>
          Welcome back
        </p>
        <p style={{
          margin: '0 0 10px', fontSize: 8,
          color: '#6B6B6B', fontFamily: `'${fontB}', sans-serif`,
        }}>
          Sign in to view your referral rewards
        </p>

        {/* Email mock input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#EEF2F7', borderRadius: 7,
          padding: '7px 9px', marginBottom: 7,
        }}>
          <i className="ph ph-envelope" style={{ fontSize: 10, color: '#A0A0A0', flexShrink: 0 }} />
          <div style={{ height: 5, width: '65%', background: '#D0D5DD', borderRadius: 3 }} />
        </div>

        {/* PIN mock input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#EEF2F7', borderRadius: 7,
          padding: '7px 9px', marginBottom: 11,
        }}>
          <i className="ph ph-lock" style={{ fontSize: 10, color: '#A0A0A0', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: '#D0D5DD',
              }} />
            ))}
          </div>
        </div>

        {/* Sign In button */}
        <div style={{
          background: `linear-gradient(135deg, ${secondary} 0%, ${secondary}bb 100%)`,
          borderRadius: 7, padding: '8px 0',
          textAlign: 'center', color: '#fff',
          fontSize: 10, fontWeight: 700,
          fontFamily: `'${fontH}', sans-serif`,
        }}>
          Sign In
        </div>
      </div>

      {/* Footer */}
      <p style={{
        margin: '7px 0 0', fontSize: 7,
        color: 'rgba(255,255,255,0.35)',
        fontFamily: "'Roboto Mono', monospace",
        letterSpacing: '0.06em', textAlign: 'center',
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>
    </div>
  );
}

// ─── Dashboard Screen Preview ─────────────────────────────────────────────────

const MOCK_REFERRALS = [
  { initials: 'JD', name: 'John Davis',   statusLabel: 'Sold ✓',     statusColor: '#15803d', statusBg: '#dcfce7' },
  { initials: 'SM', name: 'Sara Miller',  statusLabel: 'Inspection', statusColor: '#1d4ed8', statusBg: '#dbeafe' },
];

function DashboardPreview({ primary, secondary, accent, fontH, fontB, reviewBtn }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#EEF2F7', overflow: 'hidden',
    }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(145deg, ${primary} 0%, #041D3E 100%)`,
        padding: '32px 14px 14px', flexShrink: 0,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', top: -16, right: -16,
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(211,227,240,0.12)',
        }} />

        {/* Greeting */}
        <p style={{
          margin: '0 0 1px', fontSize: 9,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: `'${fontB}', sans-serif`,
        }}>
          Hey, Danny! 👋
        </p>
        <p style={{
          margin: '0 0 10px', fontSize: 13, fontWeight: 800,
          color: '#fff', fontFamily: `'${fontH}', sans-serif`,
          letterSpacing: '-0.02em',
        }}>
          Your Dashboard
        </p>

        {/* Balance card */}
        <div style={{
          background: '#fff', borderRadius: 12,
          padding: '11px 12px 10px',
          boxShadow: '0 8px 32px rgba(1,40,84,0.13)',
        }}>
          <p style={{
            margin: '0 0 2px', fontSize: 7,
            color: '#A0A0A0', fontFamily: "'Roboto Mono', monospace",
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Available Balance
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, margin: '2px 0 3px' }}>
            <span style={{
              fontSize: 13, color: secondary,
              fontFamily: "'Roboto Mono', monospace",
              fontWeight: 700, lineHeight: 1,
            }}>$</span>
            <span style={{
              fontSize: 24, fontWeight: 900, color: primary,
              fontFamily: `'${fontH}', sans-serif`,
              lineHeight: 1, letterSpacing: '-0.02em',
            }}>750</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 7, color: '#6B6B6B' }}>
            3 sold referrals · Next:{' '}
            <span style={{ color: secondary, fontWeight: 700 }}>$700</span>
          </p>

          {/* Cash Out button */}
          <div style={{
            background: `linear-gradient(135deg, ${secondary} 0%, ${secondary}bb 100%)`,
            borderRadius: 7, padding: '7px 0',
            textAlign: 'center', color: '#fff',
            fontSize: 9, fontWeight: 700,
            fontFamily: `'${fontH}', sans-serif`,
          }}>
            Cash Out Now
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '10px 12px 0', overflow: 'hidden' }}>
        {/* Boost Progress */}
        <div style={{
          background: '#fff', borderRadius: 10,
          padding: '8px 10px', marginBottom: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}>
          <p style={{
            margin: '0 0 5px', fontSize: 7, color: '#A0A0A0',
            fontFamily: "'Roboto Mono', monospace",
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Boost Progress
          </p>
          <div style={{ background: accent, borderRadius: 999, height: 5, overflow: 'hidden' }}>
            <div style={{
              width: '43%', height: '100%',
              background: `linear-gradient(90deg, ${secondary} 0%, ${primary} 100%)`,
              borderRadius: 999,
            }} />
          </div>
        </div>

        {/* Recent Referrals */}
        <p style={{
          margin: '0 0 5px', fontSize: 7, color: '#A0A0A0',
          fontFamily: "'Roboto Mono', monospace",
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Recent Referrals
        </p>
        {MOCK_REFERRALS.map((r, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 8,
            padding: '7px 8px', marginBottom: 5,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: accent, color: primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 700,
                fontFamily: "'Roboto Mono', monospace",
              }}>
                {r.initials}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, color: '#1A1A1A',
                fontFamily: `'${fontB}', sans-serif`,
              }}>
                {r.name}
              </span>
            </div>
            <span style={{
              fontSize: 7, fontWeight: 600,
              color: r.statusColor, background: r.statusBg,
              padding: '2px 5px', borderRadius: 99,
            }}>
              {r.statusLabel}
            </span>
          </div>
        ))}

        {/* Review Banner */}
        <div style={{
          background: '#1a3a6b', borderRadius: 8,
          padding: '8px 10px', marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="ph ph-star-fill" style={{ fontSize: 16, color: '#fff', flexShrink: 0 }} />
          <div style={{
            background: `linear-gradient(135deg, ${secondary} 0%, ${secondary}bb 100%)`,
            borderRadius: 5, padding: '4px 8px',
            color: '#fff', fontSize: 7, fontWeight: 700,
            fontFamily: `'${fontH}', sans-serif`,
            display: 'inline-block',
          }}>
            {reviewBtn}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        height: 44, background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px', flexShrink: 0,
      }}>
        {[
          { icon: 'ph-house-fill', active: true },
          { icon: 'ph-users',      active: false },
          { icon: 'ph-trophy',     active: false },
          { icon: 'ph-money',      active: false },
          { icon: 'ph-user',       active: false },
        ].map(({ icon, active }, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2,
          }}>
            <i className={`ph ${icon}`} style={{
              fontSize: 18, color: active ? primary : '#A0A0A0',
            }} />
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: primary,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
