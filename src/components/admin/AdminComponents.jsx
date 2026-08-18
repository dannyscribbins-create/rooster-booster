import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';
import AdminSettings from './AdminSettings';
import { usePermissions } from '../../hooks/useAdminPermissions';
import { useAdminBranding } from '../shared/BrandingProvider';

function getInitials(fullName, email) {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

export const ADMIN_NAV = [
  { id: 'dashboard',        icon: 'ph-squares-four',     label: 'Dashboard'        },
  { id: 'campaigns',        icon: 'ph-megaphone-simple', label: 'Campaigns'        },
  { id: 'referrers',        icon: 'ph-users',            label: 'Referrers'        },
  { id: 'payouts',          icon: 'ph-money',            label: 'Payouts'          },
  { id: 'retention',        icon: 'ph-trophy',           label: 'Retention'        },
  { id: 'missing-referrals', icon: 'ph-git-branch',      label: 'Missing Referrals' },
  { id: 'activity',         icon: 'ph-clock-clockwise',  label: 'Activity'         },
];

export function AdminSidebar({ page, setPage, pendingCount, flaggedUnresolved, pendingReferralCount, onLogout }) {
  const { full_name, email, tier } = usePermissions();
  const { branding } = useAdminBranding();
  const initials    = getInitials(full_name, email);
  const displayName = full_name || email || 'Team Member';
  const tierLabel   = tier ? (tier.charAt(0).toUpperCase() + tier.slice(1)) : null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: 230, height: '100vh',
      background: AD.bgSidebar, display: 'flex', flexDirection: 'column',
      zIndex: 100, fontFamily: AD.fontSans,
    }}>
      {/* ── THE LOCKUP (D-D): contractor mark · divider · platform mark ───────
          Spec §1: RoofMiles is the environment, the contractor gets a subtle
          branded touch that is personal to them. So the platform mark is
          UNCONDITIONAL and the contractor's joins it when there is one.

          ⚠ THE PATTERN IS AnnouncementPopup.jsx's, NOT A NEW ONE — D-D says do
          not re-invent the lockup. Reused unchanged: the `branding.logoUrl &&`
          null-guard, the fragment holding image + rule, the rule's 1px x 28px
          geometry, and the rule that THE DIVIDER GOES WITH THE LOGO — a
          separator with nothing on one side is a stray line, so the lockup
          collapses to the platform mark alone rather than leaving it behind.

          ONE DELIBERATE DEPARTURE: the divider's COLOUR. AnnouncementPopup
          draws rgba(0,0,0,0.1) because it sits on a white card. This sidebar is
          a dark navy gradient, where a black rule is invisible — so it is
          inverted to rgba(255,255,255,0.18). Same rule, same job, legible on
          the surface it actually sits on.

          NO FALLBACK LOGO, deliberately. An identity-bearing value gets no
          default: borrowing another contractor's mark is a white-label breach
          and a stringified null renders a dead src. Absent is a designed state.

          ── THE LIGHT PLATE (D-D, option B) ───────────────────────────────
          The sidebar below is a dark navy gradient, and a contractor whose logo
          is dark would disappear into it. The plate is applied to EVERY
          contractor rather than conditioned on the logo's colour — one rule,
          no new data, nothing to get wrong per tenant, and C/DL-3c inherits a
          shipped precedent instead of designing it cold.

          ⚠ IN 5.1 THE PLATE BECAME THE WHOLE HEADER BLOCK, not just a patch
          behind the logo. AD.bgSidebarHeader is linen, so the header is light
          and the nav beneath it is navy. The inner white backing is KEPT rather
          than folded into it: pure white is a safer ground for an arbitrary dark
          logo than a warm off-white, and it is still drawn only when there is a
          logo to sit on. The divider inverted with the plate — it was a white
          alpha for a dark header and would be invisible on linen. */}
      <div style={{ padding: '24px 20px 20px', background: AD.bgSidebarHeader, borderBottom: `1px solid ${AD.border}`, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {branding.logoUrl && (
            <>
              <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                <img src={branding.logoUrl} alt={branding.companyName}
                  style={{ height: 28, maxWidth: 96, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(28,45,77,0.18)' }} />
            </>
          )}
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
              {item.id === 'payouts' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{pendingCount}</span>
              )}
              {item.id === 'missing-referrals' && (flaggedUnresolved + pendingReferralCount) > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{flaggedUnresolved + pendingReferralCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${AD.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{displayName}</div>
            {tierLabel && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{tierLabel}</div>}
          </div>
        </div>

        {/* ── SIGN OUT (C/DL-3b Phase 5) ────────────────────────────────────
            ⚠ THE ADMIN PANEL HAD NO SIGN-OUT CONTROL AT ALL. `logoutAdmin()`
            shipped in Phase 4 — exported, tested, and deliberately without a
            caller, because the surface to put it on did not exist yet. This is
            that surface.

            It stopped being a nicety when D7 took the admin TTL from 24 hours to
            a 30-day sliding window with a 90-day cap: a team member on a shared
            or borrowed machine had no way to end their own session, on the one
            surface that carries cash-out approval. The referrer app — the
            LOWER-privilege surface — could sign out; this one could not.

            Placed under the identity block deliberately: sign-out belongs beside
            "who am I", not in the nav, where it would sit one slip away from
            Activity. */}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              marginTop: 12, width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none',
              padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              font: 'inherit', fontSize: 12, fontWeight: 500,
              // ⚠ WHITE ALPHAS, AND THE HOVER BELOW IS '#FFFFFF' RATHER THAN
              // AD.textPrimary. This button is INSIDE the dark sidebar, and 5.1
              // inverted textPrimary to navy — the hover would have painted navy
              // on navy and the control would have vanished on contact.
              color: 'rgba(255,255,255,0.45)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <i className="ph ph-sign-out" style={{ fontSize: 16, flexShrink: 0 }} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminShell({ children, page, setPage, pendingCount, flaggedUnresolved, pendingReferralCount, onLogout, onSettingsClick, settingsActive, dashboardCachedAt, onRefreshDashboard, onInboxOpen, inboxUnreadCount = 0, settingsTeamNavRequest, settingsTeamOpenFlagCount = 0 }) {
  const cachedAgoText = dashboardCachedAt
    ? `Cached ${Math.round((Date.now() - new Date(dashboardCachedAt).getTime()) / 60000)}m ago`
    : null;

  return (
    // ⚠ THIS ROOT SETS color: AD.textPrimary, AND SINCE 5.1 THAT IS NAVY (#1C2D4D).
    // Every descendant inherits it unless it sets its own. On the linen page and on
    // white cards that is correct and is why most of the panel needs no colour at all.
    //
    // THE TRAP: a DARK-FILLED element that omits `color` inherits navy onto navy and
    // its text disappears — 1.00:1, invisible rather than merely low-contrast. It is
    // not hypothetical. 5.2a fixed three sites that hit it by naming AD.textPrimary
    // explicitly on a selected-navy branch, and one of them was a CHILD of the navy
    // element rather than part of its own style object, so no same-object audit could
    // see it.
    //
    // THE PATTERN: any element with a dark or saturated fill states an explicit
    // '#FFFFFF' or a white-alpha. NEVER AD.textPrimary / textSecondary / textTertiary —
    // those three are for light grounds only. Today AdminContactDetailDrawer's navy
    // header (the one dark fill with no `color` of its own) is safe only because every
    // child sets its own; that is a property of those children, not of this root.
    <div style={{ display: 'flex', minHeight: '100vh', background: AD.bgPage, fontFamily: AD.fontSans, color: AD.textPrimary }}>
      <AdminSidebar page={page} setPage={setPage} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved} pendingReferralCount={pendingReferralCount} onLogout={onLogout} />
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
                // ⚠ THIS TOP BAR IS NOT ON THE SIDEBAR. It is positioned absolute
                // inside the CONTENT column (see the wrapper above), so it floats
                // over PAGE GROUND — linen after 5.1. The cream alpha it carried
                // was correct over the old dark slate and is invisible on linen,
                // which is why the token, not a literal, belongs here. The hover
                // wash inverted with it for the same reason.
                color: AD.textTertiary,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = AD.textPrimary; e.currentTarget.style.background = 'rgba(28,45,77,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = AD.textTertiary; e.currentTarget.style.background = 'transparent'; }}
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
              // ⚠ SAME GROUND AS THE INBOX BUTTON BESIDE IT — page, not sidebar.
              // The active wash is restated in onMouseLeave below, so the two
              // MUST move together: fixing only the handler would give this one
              // button two different active backgrounds depending on whether it
              // had been hovered.
              //
              // ⚠ THE AD.blueLight BRANCHES ARE LEFT ALONE ON PURPOSE (5.2 owns
              // all 86 of them) AND THIS IS THE SHARPEST CASE IN THE PANEL: as an
              // alias of `tint`, #D4DDEB measures 1.37:1 on white. The active gear
              // is not merely understated here, it is effectively invisible until
              // 5.2 repoints it to `marker`. Recorded rather than fixed, because
              // splitting one call site out of the 86 is how a triage list rots.
              background: settingsActive ? 'rgba(28,45,77,0.10)' : 'transparent',
              border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: settingsActive ? AD.blueLight : AD.textTertiary,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = settingsActive ? AD.blueLight : AD.textPrimary; e.currentTarget.style.background = 'rgba(28,45,77,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = settingsActive ? AD.blueLight : AD.textTertiary; e.currentTarget.style.background = settingsActive ? 'rgba(28,45,77,0.10)' : 'transparent'; }}
          >
            <i className="ph ph-gear-six" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* ── Page content ── */}
        {settingsActive
          ? <AdminSettings teamNavRequest={settingsTeamNavRequest} initialTeamOpenFlagCount={settingsTeamOpenFlagCount} />
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

export function Btn({ onClick, children, variant = 'primary', size = 'md', style: extraStyle = {}, disabled = false }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'background 0.15s, opacity 0.15s, transform 0.15s', borderRadius: 10, whiteSpace: 'nowrap', lineHeight: 1, opacity: disabled ? 0.5 : 1 };
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
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; } }}
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
