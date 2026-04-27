import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';
import AdminSettings from './AdminSettings';

export const ADMIN_NAV = [
  { id: 'dashboard',    icon: 'ph-squares-four',          label: 'Dashboard'          },
  { id: 'referrers',    icon: 'ph-users',                 label: 'Referrers'          },
  { id: 'cashouts',     icon: 'ph-money',                 label: 'Cash Outs'          },
  { id: 'activity',     icon: 'ph-clock-clockwise',       label: 'Activity'           },
  { id: 'announcements', icon: 'ph-megaphone',            label: 'Announcements'      },
  { id: 'engagement',   icon: 'ph-trophy',                label: 'Engagement'         },
  { id: 'about',          icon: 'ph-identification-card',   label: 'About Us & Booking' },
  { id: 'referralReview', icon: 'ph-git-branch',           label: 'Referral Review'    },
];

export function AdminSidebar({ page, setPage, pendingCount, flaggedUnresolved, pendingReferralCount }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: 230, height: '100vh',
      background: AD.bgSidebar, display: 'flex', flexDirection: 'column',
      zIndex: 100, fontFamily: AD.fontSans,
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${AD.border}`, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 120, height: 'auto', display: 'block' }} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '12px 16px 8px' }}>Main Menu</div>
      <nav style={{ padding: '0 10px', flex: 1 }}>
        {ADMIN_NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', margin: 0, borderRadius: 10,
              background: active ? AD.bgActive : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              fontSize: 15, fontWeight: active ? 500 : 400,
              fontFamily: AD.fontSans, transition: 'background 0.15s, color 0.15s',
              position: 'relative',
            }}>
              {active && <div style={{ position: 'absolute', left: -2, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: AD.blueLight, borderRadius: 99 }} />}
              <i className={`ph ${item.icon}`} style={{ fontSize: 16, opacity: 0.85, flexShrink: 0 }} />
              <span>{item.label}</span>
              {item.id === 'cashouts' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{pendingCount}</span>
              )}
              {item.id === 'referralReview' && (flaggedUnresolved + pendingReferralCount) > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{flaggedUnresolved + pendingReferralCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${AD.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>DS</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Danny Scribbins</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children, page, setPage, pendingCount, flaggedUnresolved, pendingReferralCount, onSettingsClick, settingsActive, dashboardCachedAt, onRefreshDashboard, onInboxOpen, inboxUnreadCount = 0 }) {
  const cachedAgoText = dashboardCachedAt
    ? `Cached ${Math.round((Date.now() - new Date(dashboardCachedAt).getTime()) / 60000)}m ago`
    : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: AD.bgPage, fontFamily: AD.fontSans, color: AD.textPrimary }}>
      <AdminSidebar page={page} setPage={setPage} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved} pendingReferralCount={pendingReferralCount} />
      <div style={{ marginLeft: 230, flex: 1, position: 'relative', minHeight: '100vh', maxWidth: 'calc(100vw - 230px)' }}>

        {/* ── Persistent top bar (floats over content) ── */}
        <div style={{ position: 'absolute', top: 20, right: 40, zIndex: 150, display: 'flex', alignItems: 'center', gap: 12 }}>
          {page === 'dashboard' && !settingsActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {cachedAgoText && (
                <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>{cachedAgoText}</span>
              )}
              <Btn onClick={onRefreshDashboard} variant="outline" size="sm">
                <i className="ph ph-arrows-clockwise" /> Refresh
              </Btn>
            </div>
          )}
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              onClick={onInboxOpen}
              title="Inbox"
              style={{
                background: 'transparent',
                border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(240,237,232,0.45)',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = AD.textPrimary; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.45)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <i className="ph ph-bell" style={{ fontSize: 22 }} />
            </button>
            {inboxUnreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 18, height: 18,
                background: AD.red,
                color: '#fff',
                fontSize: 11, fontWeight: 600,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: AD.fontSans,
                pointerEvents: 'none',
              }}>
                {inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onSettingsClick}
            title="Settings"
            style={{
              background: settingsActive ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: settingsActive ? AD.blueLight : 'rgba(240,237,232,0.45)',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = settingsActive ? AD.blueLight : AD.textPrimary; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = settingsActive ? AD.blueLight : 'rgba(240,237,232,0.45)'; e.currentTarget.style.background = settingsActive ? 'rgba(255,255,255,0.10)' : 'transparent'; }}
          >
            <i className="ph ph-gear-six" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* ── Page content ── */}
        {settingsActive
          ? <AdminSettings />
          : <main style={{ padding: '36px 80px 36px 40px' }}>{children}</main>
        }

      </div>
    </div>
  );
}

export function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
      <div>
        {subtitle && <p style={{ fontSize: 15, color: AD.textSecondary, marginBottom: 2, fontFamily: AD.fontSans }}>{subtitle}</p>}
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary, lineHeight: 1.2 }}>{title}</h1>
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon = '', accent, animDelay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);
  return (
    <div style={{
      background: AD.bgCard, borderRadius: 16, padding: '20px 22px',
      border: `1px solid ${AD.border}`, boxShadow: AD.shadowSm,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.4s ease, translate 0.4s ease',
      opacity: visible ? 1 : 0, translate: visible ? '0 0' : '0 12px',
      cursor: 'default', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || AD.textSecondary }}>
          <i className={`ph ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 600, color: AD.textPrimary, lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: AD.fontSans }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: AD.textSecondary, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export function Badge({ type, children }) {
  const styles = {
    success: { background: AD.greenBg,  color: AD.greenText },
    warning: { background: AD.amberBg,  color: AD.amberText },
    danger:  { background: AD.red2Bg,   color: AD.red2Text  },
    info:    { background: AD.blueBg,   color: AD.blueText  },
    neutral: { background: 'rgba(255,255,255,0.06)', color: AD.textSecondary },
  };
  const s = styles[type] || styles.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {children}
    </span>
  );
}

export function Btn({ onClick, children, variant = 'primary', size = 'md', style: extraStyle = {} }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'background 0.15s, opacity 0.15s, transform 0.15s', borderRadius: 10, whiteSpace: 'nowrap', lineHeight: 1 };
  const sizes = { sm: { padding: '6px 12px', fontSize: 12 }, md: { padding: '8px 16px', fontSize: 15 }, lg: { padding: '13px 28px', fontSize: 15 } };
  const variants = {
    primary: { background: AD.navy,  color: '#fff' },
    accent:  { background: AD.red,   color: '#fff' },
    outline: { background: 'transparent', color: AD.textPrimary, border: `1px solid ${AD.borderStrong}` },
    ghost:   { background: 'transparent', color: AD.textSecondary },
    success: { background: AD.greenBg, color: AD.greenText, border: `1px solid ${AD.green}30` },
    danger:  { background: AD.red2Bg,  color: AD.red2Text,  border: `1px solid ${AD.red2}30` },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >{children}</button>
  );
}

export function AdminInput({ value, onChange, placeholder, type = 'text', label, onKeyDown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 8 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} style={{
        width: '100%', padding: '8px 12px', background: AD.bgSurface,
        border: `1px solid ${AD.borderStrong}`, borderRadius: 10,
        fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary,
        outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
      }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.borderStrong}
      />
    </div>
  );
}

export function PipelineBar({ segments, total }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, [total]);
  const active = segments.filter(s => s.val > 0);
  let gradientStops = [];
  let cursor = 0;
  active.forEach(s => {
    const pct = (s.val / total) * 100;
    gradientStops.push(`${s.color} ${cursor.toFixed(1)}%`);
    gradientStops.push(`${s.color} ${(cursor + pct).toFixed(1)}%`);
    cursor += pct;
  });
  const gradient = active.length > 0 ? `linear-gradient(to right, ${gradientStops.join(', ')})` : 'rgba(255,255,255,0.1)';
  return (
    <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 16, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: '100%', background: gradient, borderRadius: 99,
        transform: animated ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  );
}
