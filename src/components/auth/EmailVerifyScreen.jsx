import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../config/contractor';
import { statusVar } from '../../constants/statusTheme';
// One import from the side channel, not two — see SignupScreen's note.
import { elevationVar, fontVar } from '../../constants/elevationTheme';
// ⚠ THE SAME DANGLING PLATFORM-LOGO COMMENT STOOD HERE, WORD FOR WORD, AND IT IS
// REMOVED FOR THE SAME REASON: the import it described went with `logoSrc` in
// BR-1 Phase 2 and the prose outlived it in BOTH files. A fact written into N
// files costs N corrections — this one was two, and finding the second took
// opening the file rather than any search, because the search that would have
// found it is for a comment nobody knew to look for.
import useEntrance from '../../hooks/useEntrance';
import BrandMark from '../shared/BrandMark';

// ─── Email Verify Screen ───────────────────────────────────────────────────────
//
// `branding` is the invite payload's contractor block (App.js passes it straight
// through from GET /api/invite/:slug). It is the SAME resolved token set the
// landing page and the admin preview consume, so this screen cannot drift from
// them.
export default function EmailVerifyScreen({ userId, email, inviteSlug, contractorName, contractorId, branding, onVerifyComplete }) {
  const [code, setCode]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [verified, setVerified]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess]   = useState(false);
  // Drives the code field's focus edge declaratively. Replaces an imperative
  // `e.target.style.borderColor` write — see the field's own note.
  const [codeFocused, setCodeFocused]       = useState(false);
  const cardVisible = useEntrance(80);

  // WHOSE PROGRAM THIS IS. The chain ends at the platform rather than at any
  // contractor: 'RoofMiles' on a homeowner's screen is merely unhelpful, whereas
  // another roofer's name there reads as phishing to the person looking at it.
  const companyName = branding?.companyName || contractorName || 'RoofMiles';
  // NO BORROWED LOGO, ever. A placeholder taken from another contractor is a
  // white-label breach, not a fallback — the platform mark is the only honest
  // stand-in.
  // ⚠ NO `logoSrc` HERE ANY MORE (BR-1 Phase 2). This read
  // `branding?.logoUrl || roofMilesLogo`, which substituted the PLATFORM's mark
  // whenever a contractor had no logo of their own — a white-label breach in the
  // opposite direction from the one the chain was built to prevent. BrandMark
  // makes that a BRANCH on whether a contractor resolved at all; see its header.

  // ─── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ─── Auto-redirect after success ──────────────────────────────────────────────
  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => onVerifyComplete(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  // ─── Verify ───────────────────────────────────────────────────────────────────
  function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    fetch(`${BACKEND_URL}/api/signup/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setError(data.error || 'Invalid or expired code. Please try again.');
        } else {
          setVerified(true);
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Something went wrong. Please try again.');
      });
  }

  // ─── Resend ───────────────────────────────────────────────────────────────────
  // Until C/DL-2 Phase 3c this function made NO NETWORK CALL. It set the cooldown,
  // said "Code resent! Check your inbox." and did nothing — so a homeowner whose
  // code never arrived (the only person who ever presses this) was told a new one
  // was on its way and waited for an email that did not exist.
  //
  // ── KEYED ON email + contractorId, NEVER ON userId ──────────────────────────
  // A security decision, not a style one, and it mirrors the endpoint's own
  // (referrer.js). users.id is a sequential integer, so a userId-keyed resend is a
  // mailbomb primitive: POST 1, 2, 3 … and every account in the table receives
  // mail. contractorId is required rather than optional because users is
  // UNIQUE(contractor_id, email) — the same homeowner address can hold an account
  // under two contractors.
  //
  // ── THE STATE IS SET BEFORE THE REQUEST, DELIBERATELY ───────────────────────
  // The endpoint returns ONE generic 200 for every outcome — found, unknown,
  // already verified, missing parameter, swallowed DB or mail error alike — so
  // that it cannot be used to enumerate accounts. Conditioning this message on the
  // response would move that oracle from the server to the screen and undo the
  // endpoint's entire design. Setting the copy and the cooldown first makes the
  // independence structural rather than a promise in a comment, and the failure is
  // swallowed for the same reason. The lost code is recoverable: the cooldown
  // expires and the button comes back.
  async function handleResend() {
    setResendCooldown(60);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 3000);
    try {
      await fetch(`${BACKEND_URL}/api/signup/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contractorId }),
      });
    } catch {
      // Swallowed on purpose — see above. Never surfaced to the homeowner.
    }
  }

  // ─── Success state ────────────────────────────────────────────────────────────
  if (verified) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // The FIRST of this file's two page grounds. See the second, on the
        // normal state below, for why the gradient went rather than moving.
        backgroundColor: 'var(--rm-bg, #FFFFFF)',
        padding: '32px 24px',
        fontFamily: fontVar('body'),
      }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          backgroundColor: 'var(--rm-surface, #FFFFFF)',
          borderRadius: 20,
          padding: '48px 28px',
          boxShadow: elevationVar('shadowLg'),
          textAlign: 'center',
        }}>
          {/* ⚠ THE TICK IS AN EMOJI AND STAYS ONE — classified, not defaulted.
              It carries no contractor meaning and has no colour declaration to
              migrate, so it belongs to Palette-14's DECORATIVE class alongside
              the medal golds and the review star: meaning that is not the
              contractor's, which must not move when their brand does. */}
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{
            margin: '0 0 8px',
            fontSize: 24,
            fontWeight: 700,
            fontFamily: fontVar('heading'),
            color: 'var(--rm-text, #1C2D4D)',
          }}>
            Email verified!
          </h2>
          <p style={{
            margin: 0, fontSize: 15,
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
          }}>
            Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  // ─── Normal state ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // ⚠ THE SECOND OF THIS FILE'S TWO PAGE GROUNDS. The success state above
      // carries the other and they must move together — a migration that took
      // only the state a test happens to render leaves the other half painting
      // a retired palette, green. See SignupScreen's page-ground note for the
      // full reasoning: the retired gradient failed the text floor at EVERY
      // stop, no derived partner expresses an X -> X-LIGHT pair, and all five
      // migrated auth siblings use a flat `--rm-bg`.
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px',
      fontFamily: fontVar('body'),
    }}>
      {/* ── 5.3: THE RETIRED TOP MARK IS GONE ────────────────────────────
          This carried the retired Rooster Booster wordmark ABOVE the card, while
          the card below already renders `logoSrc` — the CONTRACTOR's logo, falling
          back to the current RoofMiles mark. The platform was represented twice on
          one referrer-facing screen, and the outer one was a brand that no longer
          exists.

          REMOVED rather than swapped. A referrer reaches this screen through a
          contractor's invite, so the card shows THEIR mark, which is what R9 asks
          for. Swapping would have stacked the RoofMiles wordmark directly above
          the RoofMiles mark whenever no contractor resolved. The platform keeps
          its place inside the card, as the fallback it already was.

          The whole wrapper goes, not just the <img> — leaving an empty animated
          div would keep its marginBottom and its opacity transition. */}
      {/* ⚠ THE CARD IS DEFINED BY ITS EDGE. Light-mode `bg` and `surface` are
          legitimately the same colour on a default palette, so this shadow is
          what separates the card from the canvas — the same reasoning
          LoginScreen's card carries. */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20,
        padding: '32px 28px',
        boxShadow: elevationVar('shadowLg'),
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <BrandMark branding={branding} marginBottom={20} />

        <h2 style={{
          margin: '0 0 8px',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: fontVar('heading'),
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Check your email
        </h2>
        {/* ⚠ THE ADDRESS IS THE ONE THING A PERSON HAS TO CHECK ON THIS SCREEN,
            so it takes the text token at FULL strength while the sentence around
            it is muted. The `<strong>` sits inside the muted paragraph, and
            opacity INHERITS — so the emphasis has to be the parent's job, not a
            second opacity. Muting the paragraph as a whole and un-muting the
            child is not possible; the child would still composite through 0.72.
            The sentence is therefore split: muted wrapper, full-strength span
            declared on its own element outside the muted flow. */}
        <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.5 }}>
          <span style={{ color: 'var(--rm-text, #1C2D4D)', opacity: 0.72 }}>
            We sent a 6-digit code to{' '}
          </span>
          <strong style={{ color: 'var(--rm-text, #1C2D4D)' }}>{email}</strong>
          <span style={{ color: 'var(--rm-text, #1C2D4D)', opacity: 0.72 }}>
            . Enter it below to verify your account.
          </span>
        </p>

        {/* Error card */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fee2e2',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
          }}>
            {/* #b91c1c, NOT the #dc2626 FILL tone — 5.30:1 on this tint against
                3.95:1. Same correction as SignupScreen; see its note for why the
                literals here stay literals. */}
            <i className="ph ph-warning-circle" style={{ color: '#b91c1c', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: '#b91c1c', fontSize: 14, margin: 0, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        {/* 6-digit code input */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--rm-text, #1C2D4D)',
            opacity: 0.75,
            marginBottom: 8,
            fontFamily: fontVar('body'),
          }}>
            Verification code
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => {
              setError('');
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            }}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="000000"
            style={{
              width: '100%',
              backgroundColor: 'var(--rm-bg, #FFFFFF)',
              // ⚠ THE FOCUS EDGE IS DECLARATIVE NOW, AND THAT IS NOT TIDYING.
              // This field drove its focus colour by WRITING `e.target.style
              // .borderColor` in onFocus/onBlur. An imperative write of a
              // `var(--rm-primary, …)` string works in a browser and is
              // unreadable to any declaration-level test, so the migration would
              // have been unassertable exactly where it matters — and the
              // handlers silently reintroduce whatever value they name, out of
              // sight of every sweep that reads the style object. The `focused`
              // state pattern is what the five migrated siblings already use.
              border: `2px solid ${codeFocused
                ? 'var(--rm-primary, #F26A1B)' : elevationVar('border')}`,
              borderRadius: 12,
              padding: '18px 16px',
              color: 'var(--rm-text, #1C2D4D)',
              fontSize: 36,
              fontFamily: fontVar('mono'),
              textAlign: 'center',
              letterSpacing: '0.25em',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
          />
        </div>

        {/* ── Verify button ────────────────────────────────────────────────
            ⚠ `primary`, NOT `secondary` — see SignupScreen's submit button for
            why the crossover makes this look backwards. The retired gradient ran
            on the dark NEUTRAL; this is the contractor's ACTION colour, which is
            what a primary CTA takes everywhere else in the product.
            ⚠ The shadow's `rgba(1,40,84,0.35)` was the retired navy in DECIMAL
            channels — invisible to every hex needle and every key needle in this
            arc. `shadowMd` is the same geometry with a neutral black.

            ⚠ THE 0.6 ON THE DISABLED STATE IS KEPT, AND IT IS AN EXEMPTION RATHER
            THAN AN OVERSIGHT. Opacity inherits, so the label composites down with
            the fill: measured, that pair lands under the text floor. WCAG 1.4.3
            exempts INACTIVE user-interface components, and this button is
            genuinely `disabled` — a person cannot act on it and it carries no
            information the enabled state does not. It is recorded here rather
            than left for someone to rediscover as a finding. */}
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          style={{
            width: '100%',
            backgroundColor: 'var(--rm-primary, #F26A1B)',
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: 'var(--rm-on-primary, #000000)',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: fontVar('heading'),
            cursor: (loading || code.length !== 6) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            boxShadow: (loading || code.length !== 6) ? 'none' : elevationVar('shadowMd'),
            opacity: code.length !== 6 && !loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Verifying...</>
            : <><i className="ph ph-check-circle" style={{ fontSize: 16 }} /> Verify Email</>
          }
        </button>

        {/* ── Resend section ───────────────────────────────────────────────
            ⚠ THE CONFIRMATION WAS PAINTED WITH THE SUCCESS **FILL**, AND THAT
            WAS A LIVE TEXT DEFECT. `R.green` is #16A34A, which statusTheme
            records as "fill/accent — 3.30:1, graphic threshold only, never
            text". It carried this sentence at 3.30:1 on the card, under the 4.5
            floor. `successText` is the tone for the job — 5.71:1 — and is also
            floored against the worst derivable recess, which the fill is not.

            ⚠ THE TWO MUTED LINES WERE `R.textMuted` (#A0A0A0) AT 2.61:1, which
            is under the floor as text AND under 3:1 as a graphic. `--rm-text` at
            0.7 is 4.91:1 on the worst brand. */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          {resendSuccess ? (
            <p style={{ fontSize: 14, color: statusVar('successText'), margin: 0, fontWeight: 500 }}>
              Code resent! Check your inbox.
            </p>
          ) : resendCooldown > 0 ? (
            <p style={{ fontSize: 14, color: 'var(--rm-text, #1C2D4D)', opacity: 0.7, margin: 0 }}>
              Resend available in {resendCooldown}s
            </p>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--rm-text, #1C2D4D)', opacity: 0.7, margin: 0 }}>
              Didn't get a code?{' '}
              <button
                onClick={handleResend}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                  color: 'var(--rm-text, #1C2D4D)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Resend
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────
          ⚠ WAS `rgba(255,255,255,0.4)` — WHITE, because this sat on a dark
          gradient that is now gone. The colour had to move with the ground.
          ⚠ ALPHA 0.7, NOT the siblings' 0.45: 0.45 measures 2.51:1 on the worst
          brand, under the 4.5 floor for this 12px uppercase line. See
          SignupScreen's footer note — the reasoning is one decision, applied
          twice, and the sibling value is filed rather than copied. */}
      <p style={{
        marginTop: 24,
        color: 'var(--rm-text, #1C2D4D)',
        opacity: cardVisible ? 0.7 : 0,
        fontSize: 12,
        fontFamily: fontVar('mono'),
        letterSpacing: '0.06em',
        transition: 'opacity 0.5s ease 0.3s',
        textTransform: 'uppercase',
      }}>
        {companyName}
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
