import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
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
      {/* ── THE PLATE (D-D, REVISED BY 5.2c-2): THE CONTRACTOR'S MARK ALONE ───
          ⚠ THIS SUPERSEDES PART OF D-D, DELIBERATELY. D-D specified a LOCKUP —
          contractor mark · divider · platform mark, with the platform mark
          UNCONDITIONAL. That is gone. This plate holds the contractor's mark and
          nothing else, centered. No divider. No second mark.

          WHY, AND IT IS NOT TASTE: the platform mark was a FIXED 120px square
          (the asset is 1024x1024, drawn at width 120). With the divider and two
          12px gaps it reserved 145px of a 182px content box, leaving 37px — of
          which 16px went to the old inner backing's padding. So a contractor
          logo had to render under ~21px wide or the row wrapped and stranded the
          divider. The tenant it was built against happens to have a SQUARE logo,
          which fit at 28px with 1px to spare; at D-D's own advertised maxWidth of
          96 the lockup needed 257px in that 182px box. It was never
          contractor-agnostic — most real contractor logos are horizontal
          wordmarks, and contractor #2 would have wrapped no matter what.
          Accent-ready has to MEAN contractor-#2-ready, so the lockup went.

          SPEC §1 IS UNCHANGED — the panel is still co-branded neutral. What moved
          is WHERE RoofMiles lives: the `RoofMiles · <Contractor>` identity line
          in the page header, rendered on every screen via platformIdentity.js.
          Two marks competing inside a 230px column was the weaker co-brand.

          ⚠ DO NOT REINTRODUCE A PLATFORM MARK HERE. This space is the
          contractor's. Adding one back re-creates the fixed-width block that
          made the header fit exactly one logo shape.

          ── SIZING IS CONTRACTOR-AGNOSTIC BY CONSTRUCTION ──────────────────
          BOTH axes are capped, so no aspect ratio can overflow:
            230 sidebar - 8 (margin 4 each side) - 40 (padding 20 each side)
              = 182px content box -> maxWidth 170 leaves 6px of air each side.
            maxHeight 56 stops a SQUARE logo from dominating the column (it was
              120x120 before) while leaving a wordmark room to be legible: a
              400x120 mark hits the width cap first and draws 170x51.
          A single centered child cannot wrap, so there is no flex-wrap here and
          no inner wrapper to hold gaps that no longer exist.

          NO FALLBACK LOGO, deliberately — unchanged from D-D. An identity-bearing
          value gets no default: borrowing another contractor's mark is a
          white-label breach and a stringified null renders a dead src.

          ── THE EMPTY CASE IS THE COMPANY NAME, NOT AN EMPTY PLATE ─────────
          With the platform mark gone the plate would otherwise render blank, so
          the NAME stands in for the mark. Text is not identity-bearing the way a
          logo is — it states who the contractor is rather than borrowing how they
          look — and resolveBrandingTheme defaults companyName to 'RoofMiles' when
          there is no contractor at all, so the neutral and in-flight states read
          as the RoofMiles panel rather than as a broken one. Navy on linen,
          12.61:1.

          ── THE LIGHT PLATE (D-D, option B) ───────────────────────────────
          The nav below is navy and a contractor whose logo is dark would
          disappear into it. The plate is applied to EVERY contractor rather than
          conditioned on the logo's colour — one rule, no new data, nothing to get
          wrong per tenant.

          ⚠ THE INNER WHITE BACKING IS GONE, folded into the plate. It existed to
          give a dark logo pure white rather than warm off-white, but at maxWidth
          170 its own 16px of padding would push it to 186px — wider than the
          182px box it sits in. Linen is 2% off white and carries a dark logo
          just as well, and one light plate reads as a seated object where two
          nested ones read as stacked bands. */}
      {/* ── 5.2c (A4): THE PLATE IS INSET, NOT A BAND ──────────────────────
          It ran full-width, which turned the top of the sidebar into a light
          band cutting across the corner — it read as a rendering mistake rather
          than as a deliberate space for the marks. margin 4 + borderRadius 6
          make it an object SEATED INSIDE the sidebar instead.

          ⚠ THIS ONLY WORKS BECAUSE THE PARENT CARRIES THE NAVY. The wrapper
          above is `position: fixed; top: 0; height: 100vh` with the sidebar
          background on it, so the 4px the margin opens up exposes NAVY on all
          four sides and the navy still runs unbroken to the top edge behind the
          plate. If that background is ever moved off the parent, this margin
          starts exposing the page ground and the plate becomes a floating
          rectangle on linen — worse than the band it replaced.

          `margin: 4` also replaces the old `marginBottom: 8`, so the gap to
          MAIN MENU tightens by 4px. Deliberate: a uniform inset is what makes
          it read as a seated object, and the label below carries 12px of its
          own top padding. */}
      <div style={{ padding: '24px 20px 20px', background: AD.bgSidebarHeader, borderBottom: `1px solid ${AD.border}`, margin: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {branding.logoUrl
          ? <img src={branding.logoUrl} alt={branding.companyName}
              style={{ maxWidth: 170, maxHeight: 56, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
          : <span style={{ fontFamily: AD.fontDisplay, fontSize: 18, lineHeight: 1.25, color: AD.textPrimary, textAlign: 'center' }}>{branding.companyName}</span>
        }
      </div>
      {/* ── 5.2c: MAIN MENU MATCHES CONFIGURATION ─────────────────────────
          0.3 measured 2.59:1 on #1C2D4D and failed; 0.55 clears at 5.27:1. A
          section label is copy, so it takes the 4.5:1 bar rather than 3:1.

          ⚠ THIS CROSSED THE 5.2d FENCE, AND THE RULE IT INHERITS IS THE TEST,
          NOT THE EXCEPTION. Its own ratio barely moved when the sidebar gradient
          retired — it already sat at the gradient's 0% stop — so "it is also a
          failing white-alpha" is NOT what admitted it. That is true of ~70 sites
          and every one of them stays fenced.

          What admitted it: BOTH SIDEBARS ARE MOUNTED AT ONCE in Settings, so
          raising CONFIGURATION to 0.55 put two sibling section labels on screen
          together at 4.71:1 and 2.59:1. Fixing the neighbour made this one worse
          than touching neither — the same shape as the Lead legend swatch in
          5.2b, and the same test.

          Ask that question, not "is it the same defect." Vestigial or merely
          also-broken does not cross; if it did there would be no fence. */}
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', padding: '12px 16px 8px' }}>Main Menu</div>
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
              //
              // ── 5.2b (A7): THE ACTIVE GEAR WAS EFFECTIVELY INVISIBLE ─────────
              // It painted AD.blueLight on a pale wash over linen. As an alias of
              // `tint`, #D4DDEB measures 1.26:1 against the linen ground and
              // 1.05:1 against the composited wash it actually sat on (#E2E1E0) —
              // so the wash and the icon inside it both read as nothing, and the
              // one control that says "you are in Settings" said it to no one.
              // 5.1 recorded this and left it for the blueLight sweep; 5.2b takes
              // it out of that queue because the answer is not a repointed tint.
              //
              // A SOLID NAVY FILL WITH A WHITE GLYPH (13.71:1) is what every other
              // active control in the panel already does, so this is the panel's
              // existing idiom rather than a special case for one button.
              //
              // ⚠ THE ACTIVE STATE IS WRITTEN IN THREE PLACES — here, and again in
              // both handlers below. All three MUST agree or the gear renders a
              // different active background depending on its hover history. Note
              // that onMouseEnter's background used to be UNCONDITIONAL: harmless
              // when active was a 0.10 wash and hover a 0.06 one, but it would now
              // paint that pale wash straight over the navy fill and strand the
              // white glyph at roughly 1.1:1. It is branched for that reason.
              background: settingsActive ? AD.navy : 'transparent',
              border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: settingsActive ? '#FFFFFF' : AD.textTertiary,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = settingsActive ? '#FFFFFF' : AD.textPrimary; e.currentTarget.style.background = settingsActive ? AD.navy : 'rgba(28,45,77,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = settingsActive ? '#FFFFFF' : AD.textTertiary; e.currentTarget.style.background = settingsActive ? AD.navy : 'transparent'; }}
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
  // ── 5.2b (A5): THE TRACK AND ITS EMPTY STATE WERE BOTH WHITE ON WHITE ───────
  // Both were white alphas from the dark panel. On AD.bgCard (#FFFFFF) a white
  // alpha composites to #FFFFFF at any opacity — a 0/255 delta, so the channel
  // did not exist and the filled segments appeared to float on nothing.
  //
  // rgba(28,45,77,0.10) is the same navy alpha AD.border carries, compositing to
  // #E8EAED on a card: a 23/255 delta, which is the right visual weight for a
  // channel. It is written as a literal rather than as AD.border because the two
  // are the same VALUE serving different ROLES — a track is not a hairline, and
  // 5.2d may well move one without the other.
  const gradient = active.length > 0 ? `linear-gradient(to right, ${gradientStops.join(', ')})` : 'rgba(28,45,77,0.10)';
  return (
    <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(28,45,77,0.10)', marginBottom: 16, position: 'relative' }}>
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
