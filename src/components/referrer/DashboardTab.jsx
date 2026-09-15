import { useState, useEffect } from 'react';
import { ShareNetwork, X, Lock, DownloadSimple } from '@phosphor-icons/react';
import { getNextPayout } from '../../constants/boostSchedule';
import RewardScheduleCard from './RewardScheduleCard';
import { BACKEND_URL } from '../../config/contractor';
import { useBranding } from '../shared/ThemeProvider';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import StatusBadge from '../shared/StatusBadge';
import AvatarCircle from '../shared/AvatarCircle';
import Skeleton from '../shared/Skeleton';
import ContractorAboutModal from './ContractorAboutModal';
import BookingFormModal from './BookingFormModal';
import { getReferrerToken } from '../../utils/authStorage';
import { statusVar, STATUS_BANNER } from '../../constants/statusTheme';
import { elevationVar, fontVar } from '../../constants/elevationTheme';

// ─── PALETTE-4a PART B — THE RENDER TOKENS THIS TAB PAINTS WITH ──────────────
//
// ⚠ EVERY FALLBACK BELOW IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE
// PLATFORM BRAND IN LIGHT MODE, NOT A VALUE THAT MERELY LOOKS RIGHT (M.5).
// That is the whole of R-1: `var(--rm-danger, #FEE2E2)` read as a pale error
// tint, measured 5.30:1, and never painted — the provider mounts the saturated
// fill and the login screen's failed-login message rendered at 1.34:1.
// `src/constants/themeKeyIntegrity.test.js` fails on any fallback that disagrees
// with the derivation and names the expected value, so these are checked rather
// than trusted.
//
// ⚠ NAMED CONSTANTS RATHER THAN INLINE `var(...)` STRINGS BECAUSE THIS FILE
// USES EACH ONE MANY TIMES. A typo in one of sixty inline strings is a silent
// no-op — the declaration is simply dropped and the element inherits.
const PRIMARY        = 'var(--rm-primary, #F26A1B)';
const PRIMARY_DARK   = 'var(--rm-primary-dark, #CE530C)';
const ON_PRIMARY     = 'var(--rm-on-primary, #000000)';
const SECONDARY      = 'var(--rm-secondary, #1C2D4D)';
const SECONDARY_DARK = 'var(--rm-secondary-dark, #0C1320)';
const ON_SECONDARY   = 'var(--rm-on-secondary, #FFFFFF)';
const SURFACE        = 'var(--rm-surface, #FFFFFF)';
const RECESS         = 'var(--rm-recess, #ECF0F8)';
const TEXT           = 'var(--rm-text, #1C2D4D)';
const MONEY          = 'var(--rm-primary-text, #B1480A)';

// ─── ⚠ `--rm-primary-text` IS THE MONEY TONE. IT HAD ZERO CONSUMERS FOR THREE
//     PHASES AND THE NOTE SAYING SO IS NOW STALE IN THE OTHER DIRECTION ───────
//
// ⚠ WHAT THIS BLOCK USED TO SAY, kept because it is the reason the token
// survived to be used: *"`--rm-primary-text` NOW HAS ZERO CONSUMERS, AND IT IS
// KEPT ON PURPOSE — do not delete it. The next brand-coloured text site will
// want it, and re-deriving it correctly is a phase of work."* Palette-6 wrote
// that. Palette-9 is that next site, three phases later.
//
// ⚠ IT IS THE ONLY TOKEN IN THE SET THAT IS A BRAND COLOUR MADE SAFE FOR TEXT.
// `primary` cannot stand in for it: that is floored against the 3:1 NON-TEXT
// threshold and measures 3.06:1 on a card for the platform brand. `primaryText`
// is floored at 4.5:1 against BOTH `surface` and `recess`, which is what lets
// the same tone serve a balance card and a recessed activity row.
//
// ⚠ AND THE LESSON THE ZERO-CONSUMER NOTE ACTUALLY TAUGHT: a consumer count of
// zero is what makes something look deletable. The note is what stopped it being
// deleted in the three phases before anything read it.

// The one muted-text alpha, shared with the nine files that already use this
// idiom. ⚠ IT IS DERIVED, NOT PICKED: 0.72 is the lowest value that clears 4.5:1
// on BOTH `surface` and `recess` for every seeded brand in both modes (worst
// case 4.95:1, Beta light on recess). 0.60 fails.
// ⚠ AND IT IS ONLY VALID OVER A TOKEN WITH HEADROOM — see the bank banner, where
// applying it to `warningText` measured 3.07:1 and was dropped.
const MUTED = 0.72;

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ setTab, pipeline, loading, pipelineRateLimited, pipelineStale, pipelineStaleSince, pipelineUnavailable, userName, balance, paidCount, profilePhoto, showReviewCard, onDismissReview, sessionToken, onViewAllReferrals, bankStatus, onOpenBankSetup }) {
  const branding = useBranding();
  const soldCount = paidCount;
  const nextPayout = getNextPayout(soldCount);
  const progressPct = Math.min((soldCount / 7) * 100, 100);
  const [barAnimated, setBarAnimated] = useState(false);

  const [aboutData, setAboutData]           = useState(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [shareLinkTapped, setShareLinkTapped] = useState(false);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setBarAnimated(true), 400);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Fetch About Us data on mount
  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/about`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const d = await r.json();
        if (!d || !d.enabled) { setAboutData(null); return; }
        setAboutData(d);
        if (d.booking_submitted) setBookingSubmitted(true);
      } catch {
        setAboutData(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-show About Us modal on first visit
  useEffect(() => {
    if (aboutData && !aboutData.about_modal_seen) {
      setShowAboutModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aboutData]);

  function markAboutModalSeen() {
    if (!sessionToken) return;
    (async () => {
      try {
        await fetch(`${BACKEND_URL}/api/referrer/about/seen`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {}
    })();
  }

  function handleAboutContinue() {
    markAboutModalSeen();
    setShowAboutModal(false);
  }

  function handleAboutBook() {
    markAboutModalSeen();
    setShowAboutModal(false);
    setShowBookingModal(true);
  }

  useEffect(() => {
    if (!showQRModal) return;
    setQrLoading(true);
    setQrError(false);
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/qr-code`, {
          headers: { Authorization: `Bearer ${getReferrerToken()}` },
        });
        const data = await r.json();
        if (data.qrCodeDataUrl) {
          setQrCodeDataUrl(data.qrCodeDataUrl);
        } else {
          setQrError(true);
        }
      } catch {
        setQrError(true);
      } finally {
        setQrLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRModal]);

  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = 'my-referral-qr.png';
    a.click();
  };

  const closeModal = () => {
    setShowQRModal(false);
    setShareLinkTapped(false);
  };

  return (
    <Screen>
      {/* Bank account warning banner */}
      {bankStatus && !bankStatus.connected && (
        <div style={{ padding: '12px 20px 4px' }}>
          <div
            onClick={onOpenBankSetup}
            style={{
              // ⚠ THIS WAS A NEAR-BLACK BLOCK ON A LIGHT DASHBOARD (#1a0a00 with
              // #ff8c00 copy) — the same shape as ManageAccount's dark card, and
              // the reason Part A reported these as STATUS BANNERS rather than
              // the "award literals" they were first taken for. The ground is now
              // the surface and the status colour is the EDGE, which is the
              // arrangement R-1 established. See STATUS_BANNER for the ratios.
              ...STATUS_BANNER.warning,
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer'
            }}
          >
            <i className="ph-fill ph-warning"
               style={{ fontSize: 20, color: statusVar('warning'), flexShrink: 0 }} />
            <div>
              <div style={{
                // ⚠ THE FONT PHASE THIS WAS FLAGGED FOR IS THIS ONE, and the
                // flag worked: the colour pass left a raw literal here rather
                // than "normalising" it onto the display key, because that key
                // carried a different fallback stack and the swap would have
                // changed rendering under cover of a colour migration.
                // ⚠ THE STACK DID CHANGE, DELIBERATELY AND ON THE RECORD (R-H).
                // The display key's second term is gone — the mounted value is
                // the family plus its OWN generic, per family, so a serif falls
                // back to a serif rather than to a sans.
                fontFamily: fontVar('heading'),
                fontWeight: 700,
                fontSize: 13,
                color: statusVar('warningText'),
                marginBottom: 2
              }}>
                Connect Your Bank Account
              </div>
              {/* ⚠ NO `opacity: MUTED` HERE, AND THE ABSENCE IS THE POINT. The
                  muted idiom is derived against --rm-text, which is floored at
                  4.5 WITH HEADROOM. warningText sits AT 5.02:1 and has none:
                  measured, 0.72 of it over the surface is 3.07:1 — under the
                  floor. Copying the mechanism instead of re-deriving the property
                  would have shipped a second unreadable sub-label into the file
                  this phase is fixing one out of. The hierarchy here is carried
                  by weight and size, which cost no contrast. */}
              <div style={{
                fontFamily: fontVar('body'),
                fontSize: 12,
                color: statusVar('warningText')
              }}>
                You won't be able to cash out until your bank is connected.
                Tap to set up now.
              </div>
            </div>
            <i className="ph ph-caret-right"
               style={{ fontSize: 16, color: statusVar('warning'), marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Hero header — navy gradient with brand feel */}
      <div style={{
        background: `linear-gradient(145deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
        padding: "52px 24px 32px",
        position: "relative", overflow: "hidden",
      }}>
        {/* ⚠ DECORATIVE CIRCLES — ALL THREE WERE RETIRED ACCENT TONES AS ALPHAS,
            WHICH IS THE FORM NO SWEEP IN THIS REPO CAN SEE: two were that
            contractor's light blue and one its red, written as DECIMAL CHANNELS
            inside an rgba() rather than as hex, so neither a hex sweep nor an
            `R.`-keyed needle could reach them.

            An alpha wash cannot be a render token — themeCssVariables validates
            every token as #RRGGBB. But these divs have NO CHILDREN, so element
            `opacity` is exactly equivalent to a background alpha, and that is
            what lets the fill itself be a token. The two washes become
            onSecondary (a lighter tint of whatever ground the brand produces,
            in either mode) and the accent glow becomes the real action colour,
            which is what the red was standing in for. */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 180, height: 180, borderRadius: "50%",
          background: ON_SECONDARY, opacity: 0.12,
        }} />
        <div style={{
          position: "absolute", top: 20, right: 40,
          width: 80, height: 80, borderRadius: "50%",
          background: ON_SECONDARY, opacity: 0.08,
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: -20,
          width: 120, height: 120, borderRadius: "50%",
          background: PRIMARY, opacity: 0.12,
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            {/* ⚠ NO `opacity: MUTED` HERE, AND THE HARNESS IS WHY. This ground is
                a GRADIENT, so the text must clear its DARKER STOP — `secondaryDark`,
                not `secondary`. Measured in a real browser on the seeded stack, the
                muted idiom against that stop is 3.54 · 3.54 · 4.14 · 3.74 in dark
                mode: UNDER THE FLOOR ON EVERY BRAND. The arithmetic that approved
                0.72 here had measured it against `secondary` and read 4.67–5.48,
                which is the right number for the wrong ground.
                ⚠ THE BOOKING BANNER'S SUB-LABEL KEEPS `MUTED` and that is not an
                inconsistency: its ground is a FLAT `secondary` fill with no second
                stop, where the worst case is 4.67. Same idiom, different ground,
                different answer — which is the point.
                Second instance in this file of "re-derive the property, do not
                inherit the mechanism"; the bank banner's warningText was the first. */}
            <p style={{ margin: 0, fontSize: 15, color: ON_SECONDARY }}>
              Hey, {userName.split(" ")[0]}! 👋
            </p>
            <h1 style={{
              margin: "4px 0 0", fontSize: 22, fontWeight: 800,
              fontFamily: fontVar('heading'), color: ON_SECONDARY,
              letterSpacing: "-0.02em",
            }}>Your Dashboard</h1>
          </div>
          <AvatarCircle
            userName={userName}
            profilePhoto={profilePhoto}
            size={44}
            shadow="0 0 0 3px rgba(255,255,255,0.2)"
            showCameraHint={false}
          />
        </div>

        {/* Balance card — floats on the hero */}
        <AnimCard delay={100} screenKey="dashboard" style={{ marginTop: 24 }}>
          <div style={{
            background: SURFACE, borderRadius: 18,
            padding: "24px 24px 16px",
            boxShadow: elevationVar('shadowLg'),
          }}>
            <p style={{
              margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
              fontFamily: fontVar('mono'), letterSpacing: "0.12em", textTransform: "uppercase",
            }}>Available Balance</p>

            {loading ? (
              <div style={{ margin: "10px 0 6px" }}>
                <Skeleton height="52px" borderRadius="8px" style={{ marginBottom: 8 }} />
                <Skeleton width="60%" height="14px" borderRadius="6px" />
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, margin: "6px 0 4px" }}>
                  {/* ⚠ RULED 2026-09-05 BY DANNY, AFTER SEEING THE GREEN LIVE ON THIS CARD:
                      MONEY IS BRAND-RESPONSIVE, NOT GREEN. Both spans take `--rm-primary-text`.
                      They are ONE figure split across two elements for typography.
                      ⚠ THIS REVERSES THE 2026-09-04 RULING THAT THIS COMMENT USED TO CARRY,
                      which read *"MONEY IS GREEN EVERYWHERE, NOT ONLY ON PROFILE — the
                      Available Balance is 'money the user has', the clearest case of the
                      rule"*. It is recorded rather than deleted because a reversal with no
                      trace reads as drift to the next reader.
                      ⚠ WHY IT REVERSED, and it is not that the green was wrong about
                      contrast — it measured 5.71:1 and never failed: the green stood out as
                      intended and agreed with nothing else on the screen, so distinction was
                      bought at the cost of cohesion. And THE LABEL ALREADY CARRIED THE
                      MEANING — "AVAILABLE BALANCE" sits directly above this figure, so the
                      colour was doing semantic work the copy had already done.
                      ⚠ THE RULING WAS TESTED BY SHIPPING IT AND LOOKING AT IT. That is the
                      correct reason to reverse one, and the reason it was shipped rather
                      than argued.
                      ⚠ AND THE 52px FIGURE IS HELD TO 4.5:1, NOT the 3:1 large-text
                      allowance WCAG would permit at this size. A payout figure is the thing
                      a homeowner reads most carefully; `primaryText` is already floored at
                      4.5 against both grounds, so the allowance buys nothing and would cost
                      a justification nobody would find later. */}
                  <span style={{ fontSize: 32, color: MONEY, fontFamily: fontVar('mono'), fontWeight: 700, lineHeight: 1 }}>$</span>
                  <span style={{
                    fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em",
                    fontFamily: fontVar('heading'), color: MONEY, lineHeight: 1,
                  }}>
                    {balance.toLocaleString()}
                  </span>
                </div>
                {/* ⚠ THE OPACITY IS ON THE PROSE SPAN, NOT ON THE PARAGRAPH, AND THAT
                    IS A REPAIR RATHER THAN A STYLE CHOICE. Palette-4a put
                    `opacity: MUTED` on this <p> to mute the sold-count sentence, and
                    the money span nested inside it INHERITED the 0.72 — compositing
                    primaryText down to 3.29:1, under the text floor, on the payout
                    figure. Measured in a browser; a declaration-level test cannot see
                    it, because every element's own colour was correct.
                    ⚠ OPACITY INHERITS AND COLOUR DOES NOT. Any muted container with a
                    non-muted child has this defect, and this is the third regression in
                    the arc caused by a GROUND or an ALPHA moving under a foreground
                    that was itself never touched. */}
                <p style={{ margin: "4px 0 0", fontSize: 12, color: 'var(--rm-text, #1C2D4D)' }}>
                  <span style={{ opacity: MUTED }}>
                    {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year ·{" "}
                  {/* ⚠ THE TEXT TONE, BY THE RULE'S OWN BOUNDARY. "Money in the account"
                      is the test; `nextPayout` is a PROJECTION — what the next sold deal
                      WOULD pay — which the ruling excludes alongside tier thresholds and
                      schedule rows.
                      ⚠ THE CONFLICT PALETTE-5 FILED IS RESOLVED: a PROJECTION takes
                      the TEXT TONE, so this now matches ProfileTab's stat row and the same
                      $600 finally reads one way across both screens. */}
                    Next:{" "}
                  </span>
                  <span style={{ color: TEXT, fontWeight: 700 }}>${nextPayout.total}</span>
                </p>
              </>
            )}

            <button onClick={() => setTab("cashout")} style={{
              marginTop: 16, width: "100%",
              background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
              border: "none", borderRadius: 10, padding: "13px 24px",
              color: ON_PRIMARY, fontSize: 15, fontWeight: 700,
              fontFamily: fontVar('heading'), cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              // ⚠ THE BRAND-TINTED GLOW IS LOST HERE, AND IT IS A REAL LOSS.
              // This was the retired Accent red at 30% alpha, reached as decimal
              // channels, so no hex sweep could see it. A coloured drop
              // glow under a coloured button needs "primary at 30% alpha", which
              // no render token can express: themeCssVariables validates every
              // token as #RRGGBB, and that strictness is what makes an emitted
              // `--rm-text: undefined` impossible. The neutral shadow is the
              // honest available answer; a per-brand alpha channel is a token
              // design decision, not a migration one.
              boxShadow: elevationVar('shadowMd'),
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <i className="ph ph-money" style={{ fontSize: 17 }} />
              Cash Out Now
            </button>
          </div>
        </AnimCard>

        {/* Refer a Friend button */}
        <AnimCard delay={180} screenKey="dashboard" style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowQRModal(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, background: PRIMARY, border: 'none', borderRadius: 12,
              padding: 16, color: ON_PRIMARY, fontSize: 16, fontWeight: 700,
              fontFamily: fontVar('heading'), cursor: 'pointer',
            }}
          >
            <ShareNetwork size={20} weight="fill" />
            Refer a Friend
          </button>
        </AnimCard>
      </div>

      {/* 429 rate-limit notice — shown without clearing existing data */}
      {pipelineRateLimited && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            ...STATUS_BANNER.warning,
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <i className="ph ph-warning" style={{ fontSize: 18, color: statusVar('warning'), flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: statusVar('warningText'), fontFamily: fontVar('body'), lineHeight: 1.5 }}>
              Pipeline data is temporarily unavailable. Please wait a few minutes and try again.
            </p>
          </div>
        </div>
      )}

      {/* Stale cache notice — live sync failed, serving last known data */}
      {pipelineStale && !pipelineUnavailable && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            ...STATUS_BANNER.warning,
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <i className="ph ph-clock-countdown" style={{ fontSize: 18, color: statusVar('warning'), flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: statusVar('warningText'), fontFamily: fontVar('body'), lineHeight: 1.5 }}>
              {'Showing cached pipeline data' + (pipelineStaleSince ? ` (last updated ${(() => { const diff = Date.now() - new Date(pipelineStaleSince).getTime(); const mins = Math.floor(diff / 60000); const hrs = Math.floor(mins / 60); return hrs > 0 ? `${hrs}h ago` : mins > 0 ? `${mins}m ago` : 'just now'; })()})` : '') + '. Live sync will resume automatically.'}
            </p>
          </div>
        </div>
      )}

      {/* Pipeline unavailable — no cache to fall back to */}
      {pipelineUnavailable && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            ...STATUS_BANNER.danger,
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <i className="ph ph-warning-circle" style={{ fontSize: 18, color: statusVar('danger'), flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: statusVar('dangerText'), fontFamily: fontVar('body'), lineHeight: 1.5 }}>
              Pipeline data is currently unavailable. Please try again later.
            </p>
          </div>
        </div>
      )}

      {/* Booking Banner */}
      {/* TODO: hide booking banner for contractor-link users (signup_source not in login response) */}
      {aboutData?.booking_enabled && !bookingSubmitted && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={200} screenKey="dashboard">
            <div style={{
              background: SECONDARY, borderRadius: 16, padding: '18px 20px',
              boxShadow: elevationVar('shadowLg'),
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: ON_SECONDARY, fontFamily: fontVar('heading') }}>
                Book Your Free Inspection
              </p>
              {/* ⚠ R-A MEASURED THIS PAIR BEFORE CHOOSING. It was the retired
                  Accent light blue at 75% alpha, compositing on the navy card to
                  6.87:1 against that ground. That is a MUTED
                  sub-label, not full-strength copy, so full onSecondary (13.71:1)
                  would have been louder than the design. The muted idiom on
                  onSecondary reproduces the intent and clears the floor on every
                  brand in both modes: 7.83 · 4.67 · 7.05 · 5.48 · 8.20 · 4.77.
                  ⚠ The alpha moves 0.75 -> 0.72 to land on the ONE muted value
                  used across the nine files that already have this idiom (R-F).
                  Two near-identical muted alphas is how a tenth pattern starts. */}
              <p style={{ margin: '0 0 14px', fontSize: 13, color: ON_SECONDARY, opacity: MUTED, fontFamily: fontVar('body'), lineHeight: 1.5 }}>
                Schedule your free roof inspection with {branding.companyName || 'us'} today.
              </p>
              <button
                onClick={() => setShowBookingModal(true)}
                style={{
                  background: PRIMARY, border: 'none', borderRadius: 10, padding: '11px 20px',
                  color: ON_PRIMARY, fontSize: 14, fontWeight: 700,
                  fontFamily: fontVar('heading'), cursor: 'pointer',
                }}
              >
                Book Now
              </button>
            </div>
          </AnimCard>
        </div>
      )}

      {/* Boost Progress Card */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={200} screenKey="dashboard">
          <div style={{
            background: SURFACE, border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, padding: "18px 20px",
            boxShadow: elevationVar('shadow'),
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{
                  margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
                  fontFamily: fontVar('mono'), letterSpacing: "0.1em", textTransform: "uppercase",
                }}>Boost Progress</p>
                <p style={{
                  margin: "4px 0 0", fontSize: 16, fontWeight: 800,
                  fontFamily: fontVar('heading'), color: 'var(--rm-text, #1C2D4D)',
                }}>
                  {soldCount} <span style={{ color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontWeight: 400, fontSize: 15 }}>of 7 referrals</span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: fontVar('mono'), textTransform: "uppercase" }}>Next Payout</p>
                {/* ⚠ HELD ON `MONEY` — a PROJECTION, same as the "Next:" figure above.
                    Still never --rm-primary: that is the 3:1 FILL tone and this is text. */}
                <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, fontFamily: fontVar('mono'), color: TEXT }}>${nextPayout.total}</p>
              </div>
            </div>

            {/* Animated progress bar */}
            {/* R-E: the track is a recessed groove -> --rm-recess. */}
            <div style={{ background: RECESS, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{
                width: "100%",
                height: "100%",
                // ⚠ THE HOLD IS CLOSED. RULED 2026-09-05 (Palette-12 Part B,
                // Option A): this becomes a TONAL gradient like the four tab
                // headers, and the two-colour effect is GIVEN UP DELIBERATELY.
                //
                // ⚠ THE EFFECT WAS MEASURED IMPOSSIBLE, NOT ABANDONED, AND THAT
                // DISTINCTION IS THE WHOLE RULING. A contractor chooses `primary`
                // and `secondary` INDEPENDENTLY; nothing constrains them to sit
                // far apart, close, or harmonious, so a gradient between them is a
                // coin flip per brand. The mechanical substitution
                // `secondary -> primary` fell below the 1.35 separation floor in
                // 54% of 1728 synthetic pairs, was FLAT on all four seeded brands
                // in dark (1.01-1.05), and on Beta measured WORSE than the shipped
                // pair (2.05 against 2.49) — Beta being the brand the hold was
                // raised on. The choice was an effect that works only on one brand
                // against a gradient that works on every brand.
                //
                // ⚠ THE DERIVED PARTNERS WORK FOR THE OPPOSITE REASON: `X -> X-dark`
                // has a GUARANTEED relationship, which is what let Palette-1
                // calibrate it to 1.35 and have it hold everywhere. Measured here:
                // 1.35-1.49 across all eight seeded brand/mode pairs.
                //
                // ⚠ AND THE TRACK IS A SECOND GROUND. The fill sits on `RECESS`,
                // not on the card — `--rm-secondary` is floored against `surface`
                // only and `--rm-secondary-dark` against its partner rather than
                // any ground, so BOTH stops are UNPROVEN here and were measured:
                // 4.38:1 worst against the track, over the 3:1 graphic floor.
                background: `linear-gradient(90deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
                borderRadius: 999,
                transform: barAnimated ? `scaleX(${progressPct / 100})` : "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>
              {soldCount < 7
                ? `${7 - soldCount} more sold deal${7 - soldCount !== 1 ? "s" : ""} to reach max boost — `
                : "Max boost reached — "}
              {/* ⚠ A DOLLAR FIGURE THAT IS NOT ON `MONEY`, AND THE DIFFERENCE IS
                  ROLE, NOT TYPE. "$900/deal" is painted in the body-text tone
                  today, not the accent — it is emphasis inside a sentence, not a
                  payout amount. Promoting it to the action colour because it
                  begins with a $ would be a design change smuggled in as a
                  substitution. The figures on MONEY are the ones that were red. */}
              <span style={{ color: 'var(--rm-text, #1C2D4D)', fontWeight: 700 }}>
                {soldCount < 7 ? "$900/deal" : "$900/deal! 🎉"}
              </span>
            </p>
          </div>
        </AnimCard>
      </div>

      {/* Reward Schedule — dynamic, driven by referral_schedules table */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={280} screenKey="dashboard">
          <RewardScheduleCard sessionToken={sessionToken} />
        </AnimCard>
      </div>

      {/* About Us Card */}
      {aboutData && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={220} screenKey="dashboard">
            <div
              onClick={() => setShowAboutModal(true)}
              style={{
                background: SURFACE, border: `1px solid ${elevationVar('border')}`,
                borderRadius: 16, padding: '16px 20px',
                boxShadow: elevationVar('shadow'), cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = elevationVar('shadowMd')}
              onMouseLeave={e => e.currentTarget.style.boxShadow = elevationVar('shadow')}
            >
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: fontVar('mono'), letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                About {branding.companyName || 'Your Contractor'}
              </p>
              {aboutData.google_rating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  {/* ⚠ HELD ON A LITERAL, DELIBERATELY. #F5A623 is a review-star
                      gold. It is not a retired tone, it is not brand-owned, and it
                      is not a status — it belongs to the Google rating convention
                      this row reproduces. Routing it to statusVar('warning') would
                      give a non-status thing a status colour, and to --rm-primary
                      would make a third-party rating look like our brand. */}
                  <i className="ph ph-star-fill" style={{ color: '#F5A623', fontSize: 14 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('mono') }}>
                    {aboutData.google_rating}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>star rating on Google</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--rm-text, #1C2D4D)', fontWeight: 600, fontFamily: fontVar('body') }}>Learn more</span>
                  <i className="ph ph-arrow-right" style={{ fontSize: 13, color: 'var(--rm-text, #1C2D4D)' }} />
                </div>
                {!bookingSubmitted && (
                  <button
                    onClick={e => { e.stopPropagation(); setShowBookingModal(true); }}
                    style={{
                      background: PRIMARY, border: 'none', borderRadius: 8,
                      padding: '6px 14px', color: ON_PRIMARY,
                      fontSize: 12, fontWeight: 700,
                      fontFamily: fontVar('heading'), cursor: 'pointer',
                    }}
                  >
                    Book Now
                  </button>
                )}
              </div>
            </div>
          </AnimCard>
        </div>
      )}

      {/* Recent Referrals */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={360} screenKey="dashboard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{
              margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
              fontFamily: fontVar('mono'), letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Recent Referrals</p>
            <button onClick={onViewAllReferrals} style={{
              background: "none", border: "none", cursor: "pointer",
              color: 'var(--rm-text, #1C2D4D)', fontSize: 12, fontFamily: fontVar('mono'), fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              View all <i className="ph ph-arrow-right" style={{ fontSize: 15 }} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height="62px" borderRadius="12px" />
              ))}
            </div>
          ) : pipeline.length === 0 ? (
            <div style={{
              background: SURFACE, border: `1px solid ${elevationVar('border')}`,
              borderRadius: 14, padding: "28px 20px", textAlign: "center",
              boxShadow: elevationVar('shadow'),
            }}>
              {/* R-E: the decorative icon goes to --rm-primary. It was the retired
                  light blue — 1.15:1 on white, effectively invisible — so this is
                  a visible brightening, not a like-for-like swap. */}
              <i className="ph ph-users" style={{ fontSize: 32, color: PRIMARY, display: "block", marginBottom: 8 }} />
              <p style={{ margin: 0, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontSize: 15 }}>
                No referrals yet — start sending names to earn rewards!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pipeline.slice(0, 3).map((ref, idx) => (
                <AnimCard key={ref.id} delay={400 + idx * 60}>
                  <div style={{
                    background: SURFACE, border: `1px solid ${elevationVar('border')}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: elevationVar('shadow'),
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = elevationVar('shadowMd')}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = elevationVar('shadow')}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* ⚠ primary + onPrimary, MATCHING AvatarCircle (R-D). This is
                          the same object — a circular initials avatar — rendered
                          inline instead of through the primitive, and it was on a
                          different pair (bgBlueLight + navy). Two initials avatars
                          painting differently is the kind of inconsistency nobody
                          notices until they do. Extracting it into AvatarCircle is
                          the better fix and is not this phase's job. */}
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: PRIMARY, color: ON_PRIMARY,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, fontFamily: fontVar('mono'), flexShrink: 0,
                      }}>
                        {ref.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)' }}>
                        {ref.name}
                      </p>
                    </div>
                    <StatusBadge status={ref.status} />
                  </div>
                </AnimCard>
              ))}
            </div>
          )}
        </AnimCard>
      </div>

      {/* Google Review Banner */}
      {/* ⚠ GATED ON A USABLE REVIEW URL, NOT JUST ON showReviewCard.
          reviewUrl is deliberately allowed to be null (identity-bearing values get
          no defaults), and with review_url empty this card shipped rendering a
          button whose window.open(null) resolved to the app's own origin plus a literal "null" path —
          `null` stringifies to "null" per USVString conversion and resolves
          against the document.

          NO PLACEHOLDER, NO DISABLED BUTTON, NO DEAD LINK: a review card with
          nothing to link to has no job to do, so it is absent. The URL now derives
          from google_place_id when review_url is unset, so this is only reached by
          a contractor with neither. */}
      {showReviewCard && branding.reviewUrl && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={600} screenKey="dashboard">
            {/* ⚠ THIS CARD WAS BUILT ENTIRELY FROM LITERALS AND TWO OF THEM WERE
                RETIRED ACCENT TONES REACHED WITHOUT GOING THROUGH `R` AT ALL:
                the border was that contractor's dark navy and the message copy
                its light blue, each written as a bare hex. Neither was findable
                by an `R.`-keyed needle, which is why the count this file was
                scoped from missed both. */}
            <div style={{
              background: SECONDARY,
              border: `1px solid ${SECONDARY_DARK}`,
              outline: `2px solid ${ON_SECONDARY}`,
              outlineOffset: "-4px",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: elevationVar('shadow'),
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}>
              {/* Dismiss X */}
              <button
                onClick={onDismissReview}
                aria-label="Dismiss"
                style={{
                  position: "absolute", top: 10, right: 10,
                  // ⚠ THE TRANSLUCENT WHITE CHIP IS GONE, AND THIS IS A REAL
                  // CHANGE RATHER THAN A SUBSTITUTION. A white wash reads as a
                  // chip only while the ground is dark. `--rm-secondary` is a
                  // dark navy in light mode and a BRIGHTENED tone in dark mode
                  // (#7392CC platform, #21B6B0 for a teal brand), where a white
                  // chip disappears into it. Expressing "onSecondary at 12%"
                  // needs either a per-mode alpha table or an extra layer,
                  // because `opacity` here would fade the glyph too — both are
                  // design decisions, not migrations. A transparent hit area
                  // with a correctly-coloured glyph is the minimal correct move
                  // and the chip is flagged for the UI arc.
                  background: "transparent", border: "none",
                  borderRadius: "50%", width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 14, color: ON_SECONDARY }} />
              </button>
              <i className="ph ph-star-fill" aria-hidden="true" style={{
                fontSize: 32,
                color: ON_SECONDARY,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <p style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  // FULL onSecondary, not the muted idiom: this is the card's
                  // whole message, not a sub-label beneath one.
                  color: ON_SECONDARY,
                  fontFamily: fontVar('body'),
                  lineHeight: 1.4,
                }}>
                  {branding.reviewMessage}
                </p>
                <button
                  onClick={() => window.open(branding.reviewUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 16px",
                    color: ON_PRIMARY,
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: fontVar('body'),
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: elevationVar('shadowMd'),
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <i className="ph ph-star" aria-hidden="true" style={{ fontSize: 15 }} />
                  {branding.reviewButtonText}
                </button>
              </div>
            </div>
          </AnimCard>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* About Us Modal */}
      <ContractorAboutModal
        visible={showAboutModal}
        onContinue={handleAboutContinue}
        onBook={handleAboutBook}
        aboutData={aboutData}
      />

      {/* Booking Form Modal */}
      <BookingFormModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onBookingSuccess={() => setBookingSubmitted(true)}
        sessionToken={sessionToken}
      />

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: SURFACE,
              borderRadius: '20px 20px 0 0',
              padding: '24px 24px env(safe-area-inset-bottom, 24px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}
          >
            {/* Top row */}
            <div style={{
              width: '100%', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 4,
            }}>
              <span style={{
                fontFamily: fontVar('heading'), fontSize: 18, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)',
              }}>
                Your Referral QR Code
              </span>
              <button
                onClick={closeModal}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, display: 'flex', alignItems: 'center',
                  // ⚠ THE COLOUR IS SET HERE AND THE `color` PROP IS DROPPED,
                  // DELIBERATELY. Phosphor defaults `color` to `currentColor`,
                  // so the icon inherits this. Passing `var(--rm-text, …)` to
                  // the prop instead would put a custom property into an SVG
                  // PRESENTATION ATTRIBUTE — a place jsdom resolves nothing and
                  // browser support is not something this migration should be
                  // betting a glyph on. Every other Phosphor icon in this file
                  // already inherits; this was the only one passing a colour.
                  color: 'var(--rm-text, #1C2D4D)',
                }}
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            {/* Spinner */}
            {qrLoading && (
              <div style={{
                width: 180, height: 180,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `3px solid ${PRIMARY}`, borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {/* Error */}
            {!qrLoading && qrError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                {/* ⚠ NOT --rm-primary-text. This is red because it is an ERROR,
                    not because it is the brand — the one red in this file that
                    belongs to the status system rather than the render set. */}
                <p style={{ fontFamily: fontVar('body'), fontSize: 14, color: statusVar('dangerText'), margin: '0 0 12px' }}>
                  Could not load your QR code. Please try again.
                </p>
                <button
                  onClick={() => { setQrError(false); setShowQRModal(false); setTimeout(() => setShowQRModal(true), 50); }}
                  style={{
                    background: SECONDARY, color: ON_SECONDARY, border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontFamily: fontVar('heading'), fontWeight: 600,
                    fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* QR image + buttons */}
            {!qrLoading && !qrError && qrCodeDataUrl && (
              <>
                <img
                  src={qrCodeDataUrl}
                  alt="Your personal referral QR code"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
                <p style={{
                  fontFamily: fontVar('body'), fontSize: 12,
                  color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
                  margin: 0, textAlign: 'center',
                }}>
                  Scan to refer a friend
                </p>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={() => setShareLinkTapped(true)}
                    disabled
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: PRIMARY, opacity: 0.5, color: ON_PRIMARY,
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: fontVar('heading'), fontWeight: 600, fontSize: 14, cursor: 'not-allowed',
                    }}
                  >
                    <Lock size={16} weight="bold" />
                    Share Link
                  </button>
                  <button
                    onClick={handleSaveQr}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: SECONDARY, color: ON_SECONDARY,
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: fontVar('heading'), fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Save QR
                  </button>
                </div>
                {shareLinkTapped && (
                  <p style={{
                    fontFamily: fontVar('body'), fontSize: 13,
                    color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
                    margin: 0, textAlign: 'center',
                  }}>
                    Share link coming soon!
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}
