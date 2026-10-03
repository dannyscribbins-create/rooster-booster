import { useState, useEffect } from 'react';
import { statusVar, STATUS_BANNER, STATUS_TINT } from '../../constants/statusTheme';
import { elevationVar, fontVar } from '../../constants/elevationTheme';

// ─── PALETTE-6 — THE RENDER TOKENS THIS TAB PAINTS WITH ───
// ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE PLATFORM
// BRAND IN LIGHT MODE (M.7). themeKeyIntegrity.test.js fails on any that disagrees.
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

// The one muted alpha, shared with the files that already use this idiom.
// ⚠ AND ITS GROUND AND ITS PARENTS ARE BOTH CHECKED (M.5). Palette-5 found a
// money span nested inside a muted paragraph inheriting 0.72 down to 3.29:1 —
// every element's own declaration correct, the composited pair wrong. Nothing
// below puts a non-muted child inside a muted parent.
const MUTED = 0.72;

import { useBranding } from '../shared/ThemeProvider';
import { useCashoutBalance } from '../../hooks/useCashoutBalance';
import { formatBalance, showsBalanceNote, canRequestCashout, BALANCE_ADJUSTMENT_NOTE } from '../../constants/balanceCopy';
import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import Skeleton from '../shared/Skeleton';
import { getReferrerToken } from '../../utils/authStorage';

// id values must match contractor_settings.enabled_payout_methods valid set
const ALL_METHODS = [
  { id: 'stripe_ach', icon: 'ph-bank',           label: 'Stripe ACH',     sub: 'Direct bank transfer'  },
  { id: 'zelle',      icon: 'ph-lightning',       label: 'Zelle',          sub: 'Sent within 24 hrs'    },
  { id: 'venmo',      icon: 'ph-device-mobile',   label: 'Venmo',          sub: 'Sent within 24 hrs'    },
  { id: 'check',      icon: 'ph-envelope-simple', label: 'Check by Mail',  sub: '5–7 business days'     },
];

const DETAIL_LABELS = {
  stripe_ach: 'Bank account linked via Stripe',
  zelle:      'Zelle phone or email',
  venmo:      'Venmo username',
  check:      'Mailing address',
};

// ─── Cash Out ─────────────────────────────────────────────────────────────────
// ⚠ THE `pipeline` PROP IS GONE, and that is the observable proof this screen no longer
// derives money from the pipeline. It was consumed by exactly one expression — the
// client-side balance sum removed below — so keeping it would leave the input to a
// deleted calculation sitting in the signature, which is how the calculation comes back.
export default function CashOut({ loading, userName, userEmail, bankStatus, setTab, onOpenBankSetup, token }) {
  const branding = useBranding();
  const programName = branding?.programName || branding?.companyName || '';
  // ⚠ THE SAME FALLBACK THE LANDING PAGE USES (renderState1's headlineSubject).
  // `programName` is contractor_settings.app_display_name and is deliberately
  // NOT platform-defaulted — the resolver leaves it null rather than inventing
  // one — so the company name is the second rung. Both come from the resolved
  // branding; neither is ever a literal.
  const [method, setMethod] = useState(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [popping, setPopping] = useState(null);
  const [detail, setDetail] = useState("");
  const [displayAmount, setDisplayAmount] = useState(0);
  const [amountPunching, setAmountPunching] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [logosVisible, setLogosVisible] = useState(false);

  const [enabledMethods, setEnabledMethods] = useState(['stripe_ach', 'check', 'venmo', 'zelle']);

  useEffect(() => {
    if (!token) return;
    async function fetchEnabledMethods() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/enabled-payout-methods`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (d.enabled_payout_methods) setEnabledMethods(d.enabled_payout_methods);
      } catch {
        // silent — default (all methods) remains in place
      }
    }
    fetchEnabledMethods();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── THE BALANCE COMES FROM THE ONE SHARED SOURCE ─────────────────────
  // ⚠ THIS FILE USED TO FETCH `/api/cashout/balance` ITSELF, AND SO DID ProfileTab. Two
  // fetchers is how two screens drift; `useCashoutBalance` is now the only place in `src/`
  // that asks. `balanceRenderSites.test.jsx` fails if a second one appears.
  const balanceState = useCashoutBalance(token);
  const { available: serverBalance, known: balanceKnown, error: balanceError } = balanceState;

  const advanceStep = (n) => {
    setStep(n);
    setPopping(n);
    setTimeout(() => setPopping(null), 300);
  };

  useEffect(() => {
    if (step !== 4) return;
    setDisplayAmount(0); setCardVisible(false); setLogosVisible(false); setAmountPunching(false);
    setTimeout(() => setCardVisible(true), 50);
    const target = parseFloat(amount);
    const countStart = 650;
    const countDuration = 600;
    const startTime = Date.now() + countStart;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const progress = Math.min(elapsed / countDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(eased * target));
      if (progress < 1) { requestAnimationFrame(tick); }
      else {
        setAmountPunching(true);
        setTimeout(() => setAmountPunching(false), 250);
        setTimeout(() => setLogosVisible(true), 300);
      }
    };
    requestAnimationFrame(tick);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ⚠ WHAT WAS HERE SUMMED THE SPECULATIVE LADDER CLIENT-SIDE AND WAS WRONG THREE WAYS.
  // `pipeline.filter(p => p.payout).reduce(...)` added up `payout` — the `500 + boost`
  // figure computed in fetchPipelineForReferrer, which reads no invoice and no schedule —
  // ignored the CONFIRMED `conversion_bonus` beside it, ignored the server's own `balance`
  // field, and subtracted NO pending, approved or paid cashouts. Measured on Danny's
  // account: it displayed $500 available while the server's own gate computed −$500, so
  // the screen invited a request the server then refused. Finding 6 of the payout audit.
  // ⚠ THERE IS NO BALANCE ARITHMETIC LEFT IN THIS FILE, AND
  // src/components/referrer/balanceRenderSites.test.jsx FAILS IF ANY RETURNS.
  // ⚠ `balanceKnown` COMES FROM THE HOOK NOW, not from a local Number.isFinite. A local
  // re-derivation would say "known" for a value the hook had rejected as malformed.
  // ⚠ THE CLAMP IS GONE. §2.9 clamped every non-positive balance to a plain `$0`; §2.10
  // AMENDED that the same day — a NEGATIVE now displays as negative with a subtle note, and
  // only a TRUE zero stays silent. The old comment here argued the clamp was display-only and
  // not policy B; that was correct and is now moot, because there is no clamp to argue about.
  const balanceText = formatBalance(balanceState);
  const showsNote = showsBalanceNote(balanceState);
  // ⚠ TWO DIFFERENT GATES, DELIBERATELY. `canRequestCashout` is the §2.10 rule (a balance
  // must be ABOVE zero to start a request at all); the $20 minimum is a separate, older rule
  // about the REQUEST rather than the balance, so it is applied on top rather than folded in.
  const canRequest = canRequestCashout(balanceState) && serverBalance >= 20;

  const filteredMethods = ALL_METHODS.filter(m => enabledMethods.includes(m.id));

  // Step indicator
  const steps = ["Method", "Amount", "Confirm"];

  if (loading) {
    return (
      <Screen>
        <div style={{
          background: `linear-gradient(145deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
          padding: "52px 24px 24px",
        }}>
          <Skeleton width="120px" height="12px" borderRadius="4px" style={{ marginBottom: 8 }} />
          <Skeleton width="140px" height="28px" borderRadius="6px" style={{ marginBottom: 8 }} />
          <Skeleton width="160px" height="18px" borderRadius="6px" style={{ marginBottom: 24 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} width="28px" height="28px" borderRadius="50%" style={{ flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height="14px" width="180px" borderRadius="4px" style={{ marginBottom: 4 }} />
          {[0, 1, 2].map(i => (
            <Skeleton key={i} height="66px" borderRadius="14px" />
          ))}
        </div>
      </Screen>
    );
  }

  if (step === 4) {
    return (
      <Screen>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "0 32px",
          background: `linear-gradient(160deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
        }}>
          <style>{`@keyframes cardDrop { 0%{transform:translateY(-60px) scale(0.96);opacity:0} 60%{transform:translateY(8px) scale(1.01);opacity:1} 80%{transform:translateY(-4px) scale(0.995)} 100%{transform:translateY(0) scale(1);opacity:1} }`}</style>
          <div style={{
            background: SURFACE, borderRadius: 24, padding: "40px 32px",
            textAlign: "center", boxShadow: elevationVar('shadowLg'),
            opacity: 0,
            animation: cardVisible ? "cardDrop 400ms ease-out forwards" : "none",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, fontFamily: fontVar('heading'), color: TEXT }}>
              Request Submitted!
            </h2>
            <p style={{
              margin: "0 0 4px", fontSize: 42, fontWeight: 900, color: MONEY, fontFamily: fontVar('mono'),
              display: "inline-block",
              transform: amountPunching ? "scale(1.15)" : "scale(1)",
              transition: amountPunching ? "transform 150ms ease-out" : "transform 100ms ease-in",
            }}>
              ${displayAmount.toLocaleString()}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: TEXT, opacity: MUTED, fontFamily: fontVar('body') }}>
              via {ALL_METHODS.find(m => m.id === method)?.label}
            </p>

            {/* Logo lockup */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 16, marginBottom: 20, marginTop: 8,
              opacity: logosVisible ? 1 : 0,
              transition: "opacity 300ms ease-in-out",
            }}>
              {/* ⚠ GUARDED — same class as AnnouncementPopup's, introduced in the
                  same 6C edit for the same reason: the hardcoded logo it replaced
                  could never be null. The divider goes with it, or a separator is
                  left with nothing on one side. */}
              {/* ⚠ NO PLATFORM-MARK FALLBACK HERE, AND NO COMPANY-NAME ONE EITHER (5.3).
                  The sidebar plate DOES fall back to branding.companyName when there is no
                  logo; this does not, and the difference is deliberate. Two reasons:

                  1. R9 — RoofMiles belongs in email footers, not on screen popups. A
                     referrer-facing surface carries the CONTRACTOR. And
                     resolveBrandingTheme(null) defaults companyName to 'RoofMiles', so a
                     name fallback would print the platform's name in text exactly where
                     R9 forbids its mark. The rule would have defeated itself.
                  2. The sidebar needs a fallback because the plate is the ONLY place the
                     contractor is named on that surface. Here the name is already in the
                     copy beside this lockup, so an absent logo costs nothing.

                  No logo -> this collapses to nothing, which is the designed state. */}
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt={branding.companyName}
                  style={{ height: 36, width: "auto", objectFit: "contain" }} />
              )}
            </div>

            <p style={{ color: TEXT, opacity: MUTED, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
              Our team will process your payout within 1–2 business days. You'll get a confirmation when it's on its way!
            </p>
            <button onClick={() => { setStep(1); setMethod(null); setAmount(""); setDetail(""); }} style={{
              background: `linear-gradient(135deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
              border: "none", borderRadius: 12, padding: "14px 36px",
              color: ON_SECONDARY, fontSize: 15, fontWeight: 700,
              fontFamily: fontVar('heading'), cursor: "pointer",
              boxShadow: elevationVar('shadowMd'),
            }}>Done</button>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Bank account warning banner */}
      {bankStatus && !bankStatus.connected && (
        <div style={{ padding: '12px 20px 0' }}>
          <div
            onClick={onOpenBankSetup}
            style={{
              ...STATUS_BANNER.warning,
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer'
            }}
          >
            <i className="ph-fill ph-warning"
               style={{ fontSize: 20, color: statusVar('warning'), flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: fontVar('heading'),
                fontWeight: 700,
                fontSize: 13,
                color: statusVar('warningText'),
                marginBottom: 2
              }}>
                Bank Account Required
              </div>
              <div style={{
                fontFamily: fontVar('body'),
                fontSize: 12,
                color: statusVar('warningText')
              }}>
                Connect your bank account to initiate cashouts.
                Tap to connect now.
              </div>
            </div>
            <i className="ph ph-caret-right"
               style={{ fontSize: 16, color: statusVar('warning'), marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: `linear-gradient(145deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
        padding: "52px 24px 24px",
      }}>
        {/* ⚠ THE CONTRACTOR'S PROGRAM NAME, NOT A CODENAME (BR-1 Phase 2, B.1).
              This line was the hardcoded literal "ROOSTER BOOSTER" — the RETIRED
              project codename, a brand belonging to neither RoofMiles nor the
              contractor, on a homeowner-facing screen, while the resolved value
              sat unused in the same component.
              `programName || companyName` is the landing page's own precedent
              (renderState1's headlineSubject): the contractor's App Display Name
              when they have set one, their company name when they have not.
              `app_display_name`'s helper text in the admin panel has always
              promised this line — "replaces Rooster Booster throughout the
              referrer app" — and nothing had ever consumed it. */}
        {/* ⚠ FULL onSecondary, NOT the muted idiom. This sits on a GRADIENT, so its
            floor is the DARKER STOP, and 0.72 of onSecondary measures 3.54-4.14:1
            there in dark mode across the seeded brands. Third application of the
            rule; it has cost a fix in every phase that skipped it. */}
        <p style={{ margin: "0 0 4px", fontSize: 12, color: ON_SECONDARY, fontFamily: fontVar('mono'), letterSpacing: "0.14em", textTransform: "uppercase" }}>{programName}</p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: fontVar('heading'), color: ON_SECONDARY, letterSpacing: "-0.02em" }}>Cash Out</h1>
        {/* ⚠ THIS IS ACCOUNT MONEY AND IT IS **NOT** ON THE MONEY TONE. THE
            EXCEPTION SURVIVES THE 2026-09-05 REVERSAL, WITH A NEW MEASUREMENT AND A
            STRONGER REASON THAN IT HAD UNDER GREEN.
            Palette-8 A.4 established that no green clears 4.5:1 on a brand fill,
            over 1328 sampled fills, because a fill can be any lightness.
            ⚠ PALETTE-9 ASKED WHETHER `--rm-primary-text` WORKS HERE INSTEAD, AND IT
            IS THE WORST POSSIBLE PAIRING RATHER THAN THE NATURAL ONE. The money
            tone is DERIVED FROM THE BRAND and this fill IS the brand, so the two
            converge instead of separating: measured against the darker gradient
            stop it fails all eight brand/mode pairs — 2.48 / 2.05 / 2.49 in light
            and 1.02 / 1.05 / 1.01 in dark, where it is very nearly the fill itself.
            `onSecondary` clears 4.61-14.66 on the same pairs.
            ⚠ SO THE BALANCE IS THE ONE FIGURE THAT CHANGES COLOUR BY SCREEN, and it
            is forced by the ground rather than chosen: brand-coloured on the
            Dashboard card and the Profile rows, white here. V3's "the same number
            paints the same colour" holds everywhere the ground allows it, and this
            is the only place it does not. */}
        {/* ⚠ A NON-POSITIVE BALANCE IS A PLAIN `$0 available` AND NOTHING ELSE (§2.9). The
            previous writing of this line said "$500 over-paid — nothing available", which was
            honest and is now FORBIDDEN on a referrer surface by ruling. `balanceError` still
            distinguishes "we could not read it" from "it is zero", because that is not a
            balance claim — it is the absence of one, and inventing $0 there would be the
            manufactured-answer failure rather than the clamp. */}
        <p style={{ margin: "4px 0 0", fontSize: 15, color: ON_SECONDARY }} data-cashout-balance>
          {!balanceKnown
            ? (balanceError ? "Balance unavailable" : "Checking balance…")
            : `${balanceText} available`}
        </p>
        {/* ⚠ THE NOTE, AND IT APPEARS ONLY BESIDE A NEGATIVE (§2.10). A true $0 is silent —
            that is the half of §2.9 that SURVIVED the amendment, and it is the whole reason
            `showsBalanceNote` tests `< 0` rather than `<= 0`.
            ⚠ SUBTLE BY RULING: the muted body tone on the hero's own ground, not a status
            colour and not a banner. It must read as a footnote, not an alert. */}
        {showsNote && (
          <p data-balance-note style={{
            margin: "6px 0 0", fontSize: 12, color: ON_SECONDARY, opacity: MUTED,
            fontFamily: fontVar('body'), lineHeight: 1.5,
          }}>
            {BALANCE_ADJUSTMENT_NOTE}
          </p>
        )}
        {/* ⚠ A STATUS MESSAGE ON A BRAND FILL, which the token set still has no pair
            for — the gap Palette-4b filed. Held on the literal here rather than
            routed to statusVar, whose LIGHT tone would mount at 2.87:1 on this navy.
            Reported; the fix is a ground move, and this hero has no room for one. */}
        {/* ⚠ NO MESSAGE OF ANY KIND BESIDE A NON-POSITIVE BALANCE (§2.9). The only copy that
            may appear here is the $20 minimum — which is about the REQUEST, not the balance —
            and the read-failure notice, which is the absence of a balance rather than a claim
            about one. "No balance available to cash out" was removed: it is a message beside a
            $0, which is exactly what the ruling forbids. The button is disabled either way, so
            the silence costs the referrer nothing they can act on. */}
        {!canRequest && (
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#fca5a5", fontFamily: fontVar('body') }}>
            {!balanceKnown
              ? (balanceError ? "We could not read your balance — please try again shortly" : " ")
              : serverBalance > 0
                ? "Minimum cashout amount is $20"
                : " "}
          </p>
        )}
        {canRequest && <div style={{ marginBottom: 16 }} />}

        {/* Step indicator */}
        <style>{`@keyframes nodePop { 0%{transform:scale(1)} 50%{transform:scale(1.22)} 100%{transform:scale(1)} } @keyframes cardDrop { 0%{transform:translateY(-60px) scale(0.96);opacity:0} 60%{transform:translateY(8px) scale(1.01);opacity:1} 80%{transform:translateY(-4px) scale(0.995)} 100%{transform:translateY(0) scale(1);opacity:1} }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i + 1 <= step ? PRIMARY : "rgba(255,255,255,0.2)",
                  color: i + 1 <= step ? ON_PRIMARY : ON_SECONDARY, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontFamily: fontVar('mono'),
                  border: i + 1 === step ? `2px solid ${ON_SECONDARY}` : "none",
                  transition: "background 0.3s, border-color 0.3s",
                  animation: popping === i + 1 ? "nodePop 300ms ease-out" : "none",
                }}>
                  {i + 1 < step
                    ? <i className="ph ph-check" style={{ fontSize: 15 }} />
                    : i + 1}
                </div>
                <span style={{ fontSize: 12, color: ON_SECONDARY, fontFamily: fontVar('mono'), marginTop: 3, textTransform: "uppercase" }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 16, marginLeft: 4, marginRight: 4,
                  background: "rgba(255,255,255,0.2)", position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: i + 1 < step ? "100%" : "0%",
                    background: PRIMARY,
                    transition: "width 450ms ease-in-out",
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px" }}>

        {/* Step 1 — Method */}
        {step >= 1 && (
          <AnimCard delay={80}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: fontVar('heading') }}>
              1. Choose payout method
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* ⚠ THE METHOD BUTTONS ARE DISABLED WHEN THERE IS NOTHING TO REQUEST (§2.9).
                  Gating only the final continue button was NOT enough: a referrer at a
                  non-positive balance could still pick a method and type an amount, and was
                  stopped three steps later — which, with the balance message now removed by
                  ruling, would be a dead end carrying no information at all. Measured: the
                  case asserting the request is blocked failed against exactly that. */}
              {filteredMethods.map(m => (
                <button key={m.id} disabled={!canRequest}
                  onClick={() => { if (!canRequest) return; setMethod(m.id); if (step === 1) advanceStep(2); }}
                  style={{
                  opacity: canRequest ? 1 : 0.45,
                  cursor: canRequest ? "pointer" : "not-allowed",
                  background: method === m.id ? STATUS_TINT.danger : SURFACE,
                  border: `1.5px solid ${method === m.id ? PRIMARY : elevationVar('border')}`,
                  borderRadius: 14, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 16,
                  textAlign: "left",
                  boxShadow: elevationVar(method === m.id ? 'shadowMd' : 'shadow'),
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                }}
                  onMouseEnter={e => { if (method !== m.id) e.currentTarget.style.borderColor = elevationVar('border'); }}
                  onMouseLeave={e => { if (method !== m.id) e.currentTarget.style.borderColor = elevationVar('border'); }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: method === m.id ? STATUS_TINT.danger : RECESS,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <i className={`ph ${m.icon}`} style={{ fontSize: 22, color: method === m.id ? PRIMARY : TEXT }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: fontVar('heading') }}>{m.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: TEXT, opacity: MUTED }}>{m.sub}</p>
                  </div>
                  {method === m.id && (
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ph ph-check" style={{ fontSize: 15, color: ON_PRIMARY }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </AnimCard>
        )}

        {/* Step 2 — Amount */}
        {step >= 2 && method && (
          <AnimCard delay={0} style={{ marginTop: 24 }}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: fontVar('heading') }}>
              2. Enter amount
            </p>
            <div style={{
              background: SURFACE, border: `1.5px solid ${elevationVar('border')}`,
              borderRadius: 14, padding: "18px 18px", boxShadow: elevationVar('shadow'),
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 32, color: TEXT, fontFamily: fontVar('mono'), fontWeight: 800 }}>$</span>
                <input
                  type="number" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  style={{
                    background: "none", border: "none", outline: "none",
                    fontSize: 36, fontWeight: 900, color: TEXT,
                    width: "100%", fontFamily: fontVar('heading'),
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* ⚠ MAX IS THE SERVER'S NUMBER, AND THE PRESETS CANNOT EXCEED IT.
                    Previously this was `[500, 1000, balance]` against a client-side sum, so
                    the screen offered $500 and $1,000 buttons to an account with neither —
                    pre-filling an amount the server would refuse. Presets above the balance
                    are dropped, Max is the balance itself, and duplicates are removed so a
                    balance of exactly 500 does not render two buttons with the same React key
                    (which the old expression did). */}
                {[...new Set([500, 1000, serverBalance].filter(v => v > 0 && v <= serverBalance))].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} style={{
                    flex: 1, background: RECESS, border: `1px solid ${elevationVar('border')}`,
                    borderRadius: 8, padding: "8px", color: TEXT,
                    fontSize: 12, cursor: "pointer", fontFamily: fontVar('mono'), fontWeight: 600,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = RECESS; e.currentTarget.style.borderColor = SECONDARY; }}
                    onMouseLeave={e => { e.currentTarget.style.background = SURFACE; e.currentTarget.style.borderColor = elevationVar('border'); }}
                  >
                    {/* ⚠ `serverBalance`, AND IT READ `balance` UNTIL 2026-10-03 — AN IDENTIFIER THAT HAS
                        NOT EXISTED SINCE COMMIT (3b) REMOVED THE PROP. In module scope an undeclared
                        free variable THROWS, so this line raised `ReferenceError: balance is not
                        defined` and the error boundary blanked the whole Cash Out tab.
                        ⚠ IT WAS LATENT, NOT DORMANT BY DESIGN: the enclosing `.map` runs only when a
                        preset survives `v > 0 && v <= serverBalance`, which needs a POSITIVE balance.
                        Measured in production the day it was found — 6 live users, 5 at zero, 1
                        negative, **0 positive** — so the only thing preventing the crash was that
                        nobody had earned yet, and the first referrer to earn anything would have hit
                        it on the money screen. **A safety argument resting on nobody having succeeded
                        yet is a coincidence, not a guard.**
                        ⚠ AND NO TEST COULD SEE IT, FOR A REASON WORTH KNOWING: seven files mount this
                        component and every fixture used `available: -500` or `0`, because the whole
                        payout-audit arc was about the over-paid account. **Every fixture seeded the
                        one state that skips this branch.** `cashOutPositiveBalance.test.jsx` is the
                        missing fixture. */}
                    {v === serverBalance ? "Max" : `$${v}`}
                  </button>
                ))}
              </div>
            </div>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: TEXT, opacity: MUTED, marginBottom: 8, fontFamily: fontVar('body'),
            }}>
              {DETAIL_LABELS[method]}
            </label>
            <div style={{ marginTop: 12 }}>
              <input
                value={detail} onChange={e => setDetail(e.target.value)}
                placeholder={method === "check" ? "Mailing address" : `Your ${ALL_METHODS.find(m => m.id === method)?.label} handle / email`}
                style={{
                  width: "100%", background: SURFACE,
                  border: `1.5px solid ${elevationVar('border')}`, borderRadius: 12,
                  padding: "14px 16px", color: TEXT, fontSize: 15,
                  fontFamily: fontVar('body'), outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = SECONDARY}
                onBlur={e => e.target.style.borderColor = elevationVar('border')}
              />
            </div>
            {/* ⚠ canRequest GATES THIS TOO, so an unknown or non-positive balance cannot
                reach the confirm step even if an amount was typed before the fetch landed. */}
            {canRequest && amount && parseFloat(amount) >= 20 && parseFloat(amount) <= serverBalance && (
              <button onClick={() => advanceStep(3)} style={{
                width: "100%", marginTop: 16,
                background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
                border: "none", borderRadius: 12, padding: "16px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: fontVar('heading'), cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: elevationVar('shadowMd'),
              }}>
                Continue <i className="ph ph-arrow-right" style={{ fontSize: 16 }} />
              </button>
            )}
          </AnimCard>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <AnimCard delay={0} style={{ marginTop: 24 }}>
            <div style={{
              background: SURFACE, border: `1.5px solid ${elevationVar('border')}`,
              borderRadius: 16, padding: "20px", boxShadow: elevationVar('shadow'),
            }}>
              <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: fontVar('heading') }}>
                Confirm your payout
              </p>
              {[
                ["Amount",    `$${parseFloat(amount).toLocaleString()}`],
                ["Method",    ALL_METHODS.find(m => m.id === method)?.label],
                ["Sent to",   detail || "—"],
                ["Remaining", `$${(serverBalance - parseFloat(amount)).toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 16,
                  paddingBottom: 16, borderBottom: `1px solid ${elevationVar('border')}`,
                }}>
                  <span style={{ fontSize: 15, color: TEXT, opacity: MUTED, fontFamily: fontVar('mono') }}>{k}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{v}</span>
                </div>
              ))}
              {submitError && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  ...STATUS_BANNER.danger, borderRadius: 8, padding: "8px 12px",
                  marginBottom: 16,
                }}>
                  <i className="ph ph-warning-circle" style={{ color: statusVar('dangerText'), fontSize: 16, flexShrink: 0 }} />
                  <p style={{ color: statusVar('dangerText'), fontSize: 15, margin: 0 }}>{submitError}</p>
                </div>
              )}
              <button onClick={safeAsync(async () => {
                if (!bankStatus?.connected) return;  // guard — belt and suspenders
                setSubmitting(true);
                setSubmitError("");
                try {
                  const res = await fetch(`${BACKEND_URL}/api/cashout`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${getReferrerToken()}`,
                    },
                    body: JSON.stringify({
                      amount: parseFloat(amount),
                      method,
                      payout_method: method,
                      // TODO: wire referral_conversion_id once conversion data is available on this screen
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok || data.error) {
                    setSubmitError(data.error || "Something went wrong. Please try again.");
                    setSubmitting(false);
                    return;
                  }
                  setSubmitting(false);
                  setStep(4);
                } catch {
                  setSubmitError("Connection error. Please check your connection and try again.");
                  setSubmitting(false);
                }
              }, 'CashOutTab')}
                disabled={!bankStatus?.connected}
                style={{
                  width: "100%", marginTop: 4,
                  background: `linear-gradient(135deg, ${statusVar('success')} 0%, ${statusVar('successText')} 100%)`,
                  border: "none", borderRadius: 12, padding: "16px",
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  fontFamily: fontVar('heading'),
                  cursor: !bankStatus?.connected ? "not-allowed" : "pointer",
                  opacity: !bankStatus?.connected ? 0.45 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(22,163,74,0.3)",
                }}
              >
                {submitting
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Submitting...</>
                  : <><i className="ph ph-check-circle" style={{ fontSize: 17 }} /> Submit Payout Request</>
                }
              </button>
              {bankStatus && !bankStatus.connected && (
                <p style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: statusVar('warningText'),
                  marginTop: 8,
                  fontFamily: fontVar('body')
                }}>
                  Connect your bank account to enable cashouts
                </p>
              )}
              <button onClick={() => { setStep(2); setSubmitError(""); }} style={{
                width: "100%", marginTop: 10, background: "none",
                border: `1.5px solid ${elevationVar('border')}`, borderRadius: 12,
                padding: "12px", color: TEXT, opacity: MUTED, fontSize: 15,
                cursor: "pointer", fontFamily: fontVar('body'),
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <i className="ph ph-arrow-left" style={{ fontSize: 15 }} /> Go Back
              </button>
            </div>
          </AnimCard>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
