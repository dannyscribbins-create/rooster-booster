import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, StatCard, PipelineBar } from './AdminComponents';
import Skeleton from '../shared/Skeleton';
import { usePermissions } from '../../hooks/useAdminPermissions';
import { useAdminBranding } from '../shared/BrandingProvider';
import { platformIdentityLine } from '../../utils/platformIdentity';
import { clearAdminToken, getAdminToken } from '../../utils/authStorage';

// ─── money(): format a currency stat, or say the value is unavailable ────────
// Guards the two money StatCards below. `stats.X.toLocaleString()` on a field
// the payload did not carry throws a TypeError DURING RENDER, and a render
// error takes the WHOLE PANEL rather than blanking the one card.
//
// ⚠ THE OBJECT-LEVEL `stats &&` GUARD BELOW CANNOT PREVENT THIS, and that is
// the point: `{}` is truthy, so it passes and the throw happens anyway.
// A FIELD-LEVEL GUARD IS CORRECT REGARDLESS OF HOW MANY FIELDS ARE MISSING and
// degrades one card at a time. An object-level "is this empty enough" check
// would have to invent a threshold — one missing field, or five? — with no rule
// behind it. Field-level guards have a rule; emptiness thresholds don't.
//
// ⚠ AN EM DASH, NOT $0. A missing value is a "what", not a "who", so a default
// is legitimate under the identity-bearing-values rule. But $0 asserts a
// SPECIFIC FALSEHOOD ABOUT MONEY: an admin reading "$0 Total Balance Owed" has
// been told something untrue and may act on it, where "—" tells them the value
// is unavailable. Absent is a designed state, not a placeholder.
//
// Number.isFinite is the predicate rather than a bare undefined check because
// it has the same rule the dash does — "is this a finite number I can honestly
// format as money" — and so also covers null, NaN and Infinity, each of which
// would otherwise throw or render "$NaN" on the money surface.
const STAT_ABSENT = '—';
function money(val) {
  return Number.isFinite(val) ? `$${val.toLocaleString()}` : STAT_ABSENT;
}

export default function AdminDashboard({ setLoggedIn, setPage, refreshKey, onStats, onSettingsClick, onFlaggedBannerClick }) {
  const { full_name } = usePermissions();
  const { branding } = useAdminBranding();
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [crmNotConnected, setCrmNotConnected] = useState(false);
  const [flaggedUnresolved, setFlaggedUnresolved] = useState(0);

  async function loadStats(forceRefresh = false) {
    setLoading(true); setError(''); setCrmNotConnected(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/stats${forceRefresh ? '?refresh=true' : ''}`, {
        headers: { 'Authorization': `Bearer ${getAdminToken()}` },
      });
      if (r.status === 401) { clearAdminToken(); setLoggedIn(false); return; }
      const d = await r.json();
      if (d.error === 'crm_not_connected') { setCrmNotConnected(true); }
      else if (d.error) { setError(d.error); }
      else { setStats(d); if (onStats) onStats(d); }
    } catch {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, [refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/flagged-referrals/summary`, {
          headers: { 'Authorization': `Bearer ${getAdminToken()}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.unresolved_count != null) setFlaggedUnresolved(d.unresolved_count);
      } catch {
        // swallow
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pipelineTotal = stats ? stats.totalLeads + stats.totalInspections + stats.totalSold + stats.totalNotSold : 0;
  // ⚠ GUARDS BOTH ITS ARGUMENT AND THE pipelineTotal IT CLOSES OVER — and the
  // `val` guard is UNREACHABLE TODAY. Stated as a fact so the next reader does
  // not have to re-derive the analysis: the sole call site (the pipeline legend
  // below) passes only the four fields pipelineTotal SUMS, so any absent val
  // makes pipelineTotal non-finite too and that guard always fires first.
  //
  // It is kept because pipelineTotal's own definition is out of scope here. The
  // pre-launch item that fixes the "NaN total referrals" heading below will
  // likely make pipelineTotal finite at source, and THE val GUARD THEN BECOMES
  // THE ONLY ONE. So: not paranoia, and not dead code to strip — pct() does not
  // get to assume its sole caller stays sole.
  //
  // ⚠ UNKNOWN IS NOT 0%. `NaN > 0` is false, so before this every segment
  // reported a confident, precise zero over data we did not have. A genuinely
  // EMPTY pipeline is still 0% — that is a true statement about known data and
  // it survives below. Renders (—%) rather than a bare dash so the slot still
  // reads as a percentage that is unknown, parallel with the (50%) beside it.
  const pct = (val) => {
    if (!Number.isFinite(val) || !Number.isFinite(pipelineTotal)) return STAT_ABSENT;
    return pipelineTotal > 0 ? Math.round((val / pipelineTotal) * 100) : 0;
  };

  // The pending cash-out count has THREE states, not two, and BOTH the Review
  // Payouts card's text and its colour branch on it. Derived ONCE here and read
  // twice below — two independent copies of the same three-way check is how they
  // drift apart, and a card whose words say "unknown" while its colour still
  // says "all clear" is the half-fix that looks complete.
  //
  // ⚠ ABSENT IS NOT ZERO. `undefined > 0` is false, so the absent case was
  // silently handled by the branch written for zero: an admin whose payload
  // lost this field was told affirmatively that there was nothing to review, on
  // the money surface.
  const pendingState = Number.isFinite(stats?.pendingCashouts)
    ? (stats.pendingCashouts > 0 ? 'some' : 'none')
    : 'unknown';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = full_name ? full_name.trim().split(/\s+/)[0] : null;
  const greetingTitle = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <>
      <AdminPageHeader title={greetingTitle} subtitle={platformIdentityLine(branding)} />
      {flaggedUnresolved > 0 && (
        <div
          onClick={onFlaggedBannerClick}
          style={{ background: '#FFC107', color: '#1A1A1A', padding: '12px 16px', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, fontWeight: 500, cursor: onFlaggedBannerClick ? 'pointer' : 'default' }}
        >
          <span>⚠️ {flaggedUnresolved} flagged referral{flaggedUnresolved !== 1 ? 's' : ''} need review</span>
          {onFlaggedBannerClick && <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>Review <i className="ph ph-arrow-right" /></span>}
        </div>
      )}
      {/* ⚠ THIS BANNER STAYS SILENT WHEN THE COUNT IS UNKNOWN, DELIBERATELY.
          `undefined > 0` is false, so a payload missing pendingCashouts draws
          nothing here — and that is the RULED behaviour, not an oversight. A
          banner is an ALERT: it means "there is definitely something". We do not
          know that, and an alert with no action attached trains admins to ignore
          the slot where the real ones appear.

          ⚠ IT IS LOAD-BEARING ON THE REVIEW PAYOUTS CARD BELOW, which renders
          "— pending review" in amber for exactly this state. That card is what
          puts the unknown on the screen; this silence is honest ONLY because it
          does. Nothing else here says it.

          ⚠ SO: ANYONE REMOVING, WEAKENING OR RELOCATING THAT CARD'S ABSENT
          BRANCH MUST COME BACK TO THIS LINE. Take the unknown off the screen and
          this silence stops being a designed state and becomes a money-surface
          defect again — an admin reading no banner concludes there is nothing
          pending. That is the exact shape this pass was opened to kill. */}
      {stats?.pendingCashouts > 0 && (
        <div onClick={() => setPage('payouts')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: AD.amberBg, border: `1px solid ${AD.amber}40`, borderRadius: 12, padding: '16px 24px', marginBottom: 24, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph ph-warning" style={{ fontSize: 16, color: AD.amberText }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: AD.amberText }}>{stats.pendingCashouts} cash out request{stats.pendingCashouts !== 1 ? 's' : ''} awaiting your review</span>
          </div>
          <span style={{ fontSize: 12, color: AD.amberText, display: 'flex', alignItems: 'center', gap: 4 }}>Review <i className="ph ph-arrow-right" /></span>
        </div>
      )}
      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height="108px" borderRadius="16px" />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height="108px" borderRadius="16px" />
            ))}
          </div>
          <Skeleton height="120px" borderRadius="16px" style={{ marginBottom: 24 }} />
        </>
      ) : error ? (
        <div style={{ background: AD.red2Bg, border: `1px solid ${AD.red2}30`, borderRadius: 12, padding: '16px 20px' }}>
          <span style={{ color: AD.red2Text, fontSize: 15 }}>{error}</span>
        </div>
      ) : crmNotConnected ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {/* accent is SEMANTIC here, never a marker or a tint — its three siblings
                below use AD.amberText and AD.greenText. AD.blueLight was a mis-token
                from the start; as `tint` it measured 1.37:1 and vanished on the card. */}
            <StatCard label="Active Referrers"   value="—" sub="no CRM connected" icon="ph-users"        accent={AD.blueText}   animDelay={0}   />
            <StatCard label="Total Balance Owed" value="—" sub="no CRM connected" icon="ph-scales"       accent={AD.amberText}  animDelay={80}  />
            <StatCard label="Total Paid Out"     value="—" sub="approved payouts"  icon="ph-check-circle" accent={AD.greenText}  animDelay={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="Total Referrals" value="—" icon="ph-clipboard-text" animDelay={240} />
            <StatCard label="Leads"           value="—" icon="ph-funnel"          accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value="—" icon="ph-magnifying-glass" accent={AD.blueText}     animDelay={360} />
            <StatCard label="Sold"            value="—" icon="ph-trophy"           accent={AD.greenText}    animDelay={420} />
          </div>
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 24, boxShadow: AD.shadowSm }}>
            <PipelineBar segments={[{ val: 0, color: AD.grayMuted }]} total={0} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-plugs-connected" style={{ fontSize: 15, color: AD.textTertiary }} />
              <span style={{ fontSize: 13, color: AD.textTertiary }}>
                Connect a CRM in Settings to start syncing data.{' '}
                {onSettingsClick
                  ? <button onClick={onSettingsClick} style={{ background: 'none', border: 'none', padding: 0, color: AD.blueText, fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer', textDecoration: 'underline' }}>Open Settings</button>
                  : null}
              </span>
            </div>
          </div>
        </>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {/* Semantic, matching the crm-not-connected variant above — see its comment. */}
            <StatCard label="Active Referrers"   value={stats.activeReferrers}  sub={`of ${stats.totalReferrers} enrolled`} icon="ph-users" accent={AD.blueText}   animDelay={0}   />
            <StatCard label="Total Balance Owed" value={money(stats.totalBalance)}  sub="across all referrers"  icon="ph-scales" accent={AD.amberText} animDelay={80}  />
            <StatCard label="Total Paid Out"     value={money(stats.totalPaidOut)}  sub="approved payouts"      icon="ph-check-circle" accent={AD.greenText} animDelay={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Referrals" value={stats.totalReferrals}   icon="ph-clipboard-text" animDelay={240} />
            <StatCard label="Leads"           value={stats.totalLeads}       icon="ph-funnel" accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value={stats.totalInspections} icon="ph-magnifying-glass" accent={AD.blueText}      animDelay={360} />
            <StatCard label="Sold"            value={stats.totalSold}        icon="ph-trophy" accent={AD.greenText}     animDelay={420} />
          </div>
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 24, boxShadow: AD.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline Health</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary }}>{pipelineTotal} total referrals across all active referrers</p>
              </div>
            </div>
            <PipelineBar segments={[
              { val: stats.totalLeads,       color: AD.grayMuted },
              { val: stats.totalInspections, color: AD.blue      },
              { val: stats.totalSold,        color: AD.green     },
              { val: stats.totalNotSold,     color: AD.red2      },
            ]} total={pipelineTotal} />
            {/* ── 5.2b (A5, extended): THE LEAD LEGEND KEY ──────────────────────
                This dot was rgba(255,255,255,0.4) — 1.00:1 on the white card, the
                same white-on-white defect as the segment above it.

                ⚠ IT CROSSED THE 5.2d FENCE DELIBERATELY, AND THE FENCE STILL HOLDS
                FOR EVERYTHING ELSE. The argument is not "it is the same defect" —
                that is true of ~70 sites. It is that this dot is the legend KEY for
                the exact segment 5.2b fixes, so leaving it produced a state strictly
                WORSE than before: a visibly gray bar segment beside a legend row
                with a blank where its swatch belongs, next to three siblings that
                have theirs. A half-fixed legend is more conspicuous than an evenly
                broken one. That test — does fixing the neighbour make this one worse
                than not touching either? — is what admits a site early, not mere
                similarity.

                The three siblings were already solid semantic tokens and needed
                nothing. Note they use the *Text variants while the segments above
                use the base ones: the darker weight reads better at 8px. Lead has
                no grayMutedText, and grayMuted is already in that darker class
                (#4B5563, darker than AD.gray), so it serves both roles here. */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Lead',       val: stats.totalLeads,       color: AD.grayMuted },
                { label: 'Inspection', val: stats.totalInspections, color: AD.blueText  },
                { label: 'Sold',       val: stats.totalSold,        color: AD.greenText },
                { label: 'Not Sold',   val: stats.totalNotSold,     color: AD.red2Text  },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: AD.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: AD.textPrimary }}>{s.val}</span>
                  <span style={{ fontSize: 12, color: AD.textTertiary }}>({pct(s.val)}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Manage Referrers', sub: `${stats.totalReferrers} accounts enrolled`, icon: 'ph-users', page: 'referrers', color: AD.blueText },
              { label: 'Review Payouts',
                sub: pendingState === 'some' ? `${stats.pendingCashouts} pending review`
                   : pendingState === 'none' ? 'All caught up'
                   : `${STAT_ABSENT} pending review`,
                icon: 'ph-money', page: 'payouts',
                // Only the KNOWN all-clear earns the calm colour. Unknown wears
                // amber: "look at this", without claiming a number.
                color: pendingState === 'none' ? AD.textSecondary : AD.amberText },
              { label: 'Activity Log',     sub: 'Logins, payouts & admin actions', icon: 'ph-clock-clockwise', page: 'activity', color: AD.greenText },
            ].map(c => (
              <button key={c.page} onClick={() => setPage(c.page)} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', textAlign: 'left', cursor: 'pointer', boxShadow: AD.shadowSm, fontFamily: AD.fontSans, transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
              >
                <i className={`ph ${c.icon}`} style={{ fontSize: 22, color: c.color, display: 'block', marginBottom: 10 }} />
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: c.color }}>{c.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
