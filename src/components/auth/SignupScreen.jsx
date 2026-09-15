import { useState } from 'react';
import { BACKEND_URL } from '../../config/contractor';
import { statusVar } from '../../constants/statusTheme';
// ⚠ ONE IMPORT FROM THE SIDE CHANNEL, NOT TWO. `fontVar` was imported from this
// module on its own line at the bottom of this block; adding `elevationVar`
// beside it would have made two import statements naming one module.
import { elevationVar, fontVar } from '../../constants/elevationTheme';
// ⚠ A FIVE-LINE COMMENT DESCRIBING THE PLATFORM LOGO IMPORT STOOD HERE AND THE
// IMPORT IT DESCRIBED WAS DELETED IN BR-1 PHASE 2 — it went with `logoSrc`, and
// the prose stayed. It has been dangling ever since, and this phase's import
// edit moved it adjacent to `useEntrance`, where it read as describing THAT.
// Removed rather than relocated: BrandMark's own header now carries the whole
// absence rule, including the sentence this comment was making.
import useEntrance from '../../hooks/useEntrance';
import BrandMark from '../shared/BrandMark';

// ─── Signup Screen ─────────────────────────────────────────────────────────────
//
// `branding` is the invite payload's contractor block, passed straight through by
// App.js from GET /api/invite/:slug — the same resolved token set the landing page
// and the admin preview consume.
export default function SignupScreen({ inviteSlug, contractorName, branding, onSignupComplete }) {
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [focused, setFocused]             = useState(null);
  const [loading, setLoading]             = useState(false);
  const [serverError, setServerError]     = useState('');
  const [fieldErrors, setFieldErrors]     = useState({});
  const cardVisible = useEntrance(80);

  // Same rule as EmailVerifyScreen: the fallback chain ends at the PLATFORM, never
  // at another contractor. A borrowed logo or a borrowed name on a homeowner-facing
  // screen is a white-label breach, and reads as phishing to the person looking at it.
  const companyName = branding?.companyName || contractorName || 'RoofMiles';
  // ⚠ NO `logoSrc` HERE ANY MORE (BR-1 Phase 2). This read
  // `branding?.logoUrl || roofMilesLogo`, which substituted the PLATFORM's mark
  // whenever a contractor had no logo of their own — a white-label breach in the
  // opposite direction from the one the chain was built to prevent. BrandMark
  // makes that a BRANCH on whether a contractor resolved at all; see its header.

  // ─── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    const errors = {};
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim())  errors.lastName  = 'Last name is required.';
    if (!phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!/^[\d\s\-()+]{7,}$/.test(phone)) {
      errors.phone = 'Enter a valid phone number.';
    }
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      // D12 — the unified 8-character policy, both sides. Signup enforced 6 here
      // while the SERVER already required 8 (referrer.js POST /api/signup), so a
      // 6- or 7-character password passed the client check and was then rejected
      // by the round trip. Raising it breaks nobody: existing shorter credentials
      // still authenticate, because bcrypt does not care what was hashed — this
      // binds new signups and resets only.
      errors.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setServerError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, email, password, inviteSlug }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setServerError(data.error || 'Something went wrong. Please try again.');
        } else {
          onSignupComplete({ action: 'verify', userId: data.userId, email });
        }
      })
      .catch(() => {
        setLoading(false);
        setServerError('Something went wrong. Please try again.');
      });
  }

  // ─── Styles ───────────────────────────────────────────────────────────────────
  //
  // ⚠ THE ERROR EDGE TAKES THE FILL ROLE AND THE ERROR TEXT TAKES THE TEXT ROLE,
  // AND THEY ARE DIFFERENT VALUES ON PURPOSE. `danger` (#DC2626) is a 3:1
  // GRAPHIC value — correct for a border. `dangerText` (#B91C1C) is the 4.5:1
  // text tone. The retired code used the FILL for both; as text it measured
  // 4.83:1 and passed by luck rather than by role.
  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: 'var(--rm-bg, #FFFFFF)',
    border: `1.5px solid ${fieldErrors[field]
      ? statusVar('danger')
      : focused === field ? 'var(--rm-primary, #F26A1B)' : elevationVar('border')}`,
    borderRadius: 10,
    padding: '14px 16px 14px 44px',
    color: 'var(--rm-text, #1C2D4D)',
    fontSize: 15,
    fontFamily: fontVar('body'),
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  });

  const inputStyleNoIcon = (field) => ({
    ...inputStyle(field),
    padding: '14px 16px',
  });

  const inputStyleWithIconRight = (field) => ({
    ...inputStyle(field),
    padding: '14px 44px 14px 44px',
  });

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--rm-text, #1C2D4D)',
    opacity: 0.75,
    marginBottom: 6,
    fontFamily: fontVar('body'),
  };

  const fieldErrorStyle = {
    color: statusVar('dangerText'),
    fontSize: 12,
    marginTop: 4,
    marginBottom: 0,
  };

  // ⚠ 0.6, NOT THE 0.5 THE MIGRATED SIBLINGS USE — RE-DERIVED, NOT INHERITED.
  // `--rm-text` at 0.5 composites to 2.85:1 on the worst brand, under the 3:1
  // non-text floor these glyphs answer to; 0.6 is 3.68:1. The margin is
  // deliberate: a floor met by hundredths is one the next token change silently
  // breaks, which is the lesson `successText` cost. The siblings' 0.5 is FILED.
  // ⚠ IT REPLACES `R.textMuted` (#A0A0A0), WHICH WAS 2.61:1 — a live defect, not
  // a stylistic preference.
  const iconStyle = (field) => ({
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 16,
    color: focused === field ? 'var(--rm-primary, #F26A1B)' : 'var(--rm-text, #1C2D4D)',
    opacity: focused === field ? 1 : 0.6,
    transition: 'color 0.2s, opacity 0.2s',
    pointerEvents: 'none',
  });

  // The show/hide control on both password fields. One object rather than two
  // identical inline blocks — they were duplicated, and a duplicated style is
  // two things to keep in step.
  const revealButtonStyle = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    color: 'var(--rm-text, #1C2D4D)',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // ── THE PAGE GROUND (M.2, A.1) ────────────────────────────────────────
      // ⚠ WAS A RETIRED-ACCENT GRADIENT, #012854 -> #D3E3F0, AND IT IS NOT
      // MIGRATED TO A TOKEN PAIR — IT IS GONE. Three reasons, in order:
      //
      //   1. IT FAILED THE TEXT FLOOR AT EVERY STOP. The footer company name sat
      //      on it at rgba(255,255,255,0.4): 3.50:1 against the DARK stop,
      //      1.12:1 against the light one, and 1.46:1 where the line actually
      //      falls below the centred card. ⚠ THE BINDING STOP IS THE LIGHTEST
      //      ONE, NOT THE DARKEST — "text on a gradient clears the darker stop"
      //      is the rule for DARK text and inverts for white.
      //   2. NO DERIVED PARTNER EXPRESSES IT. Palette-1 publishes `primaryDark`
      //      and `secondaryDark` — X -> X-DARK pairs. This ran X -> X-LIGHT, and
      //      there is no light partner in the render set. It is NOT Palette-12's
      //      cross-colour case either (that ruling is about `secondary` ->
      //      `primary`), so neither existing ruling covers it and inventing a
      //      third pairing is precisely what was declined.
      //   3. ⚠ ALL FIVE MIGRATED AUTH SIBLINGS USE A FLAT `--rm-bg` PAGE GROUND
      //      and none of them carries a gradient. A sixth and seventh screen
      //      diverging from five is worse than the state this phase found.
      //
      // ⚠ AND `bg` IS THE RIGHT LEVEL HERE EVEN THOUGH IT HAS NO CONSUMER IN THE
      // REFERRER TREE. Screen.jsx records that `--rm-bg` goes unused there
      // because that tree's outermost element is a 430px COLUMN, which is the
      // `recess` level. These are full-page screens with no column, so the level
      // that is genuinely page-ground exists on them and this is it.
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
      {/* Signup card */}
      {/* ⚠ THE CARD IS DEFINED BY ITS EDGE, NOT BY CONTRAST AGAINST THE CANVAS.
          Light-mode `bg` and `surface` are legitimately the same colour on a
          default palette (themeTokens' documented consequence), so this shadow
          is what separates the two — the same reasoning LoginScreen's card
          carries, and the reason the shadow is not optional here. */}
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
          margin: '0 0 6px',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: fontVar('heading'),
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Create your account
        </h2>
        <p style={{
          margin: '0 0 24px', fontSize: 15,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
        }}>
          Join {branding?.companyName || contractorName || 'the referral program'} and start earning rewards.
        </p>

        {/* Server error */}
        {serverError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fee2e2',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
          }}>
            {/* #b91c1c, NOT the #dc2626 FILL tone. R-1: the fill measures 3.95:1
                on this tint — under the 4.5 text floor — while the text tone
                measures 5.30:1. Same pair, same distinction statusTheme.js draws
                between the danger and dangerText roles.
                ⚠ THE LITERALS HERE ARE DELIBERATE AND MUST NOT BECOME A CUSTOM
                PROPERTY. This banner is opaque precisely so nothing mounted over
                it can invert it, which is the defect R-1 fixed on the other three
                auth screens. statusBannerContrast.test.jsx asserts the absence.
                ⚠ The forbidden declaration is NOT spelled out here on purpose —
                that test reads this block as source text, and naming the pattern
                in prose would trip it. Rewording the prose is the rule; exempting
                comments from the guard is not. */}
            <i className="ph ph-warning-circle" style={{ color: '#b91c1c', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: '#b91c1c', fontSize: 14, margin: 0, lineHeight: 1.4 }}>{serverError}</p>
          </div>
        )}

        {/* First Name + Last Name row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: fieldErrors.firstName || fieldErrors.lastName ? 4 : 16 }}>
          {/* First Name */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <div style={{ position: 'relative' }}>
              <i className="ph ph-user" style={iconStyle('firstName')} />
              <input
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setFieldErrors(fe => ({ ...fe, firstName: '' })); }}
                onFocus={() => setFocused('firstName')}
                onBlur={() => setFocused(null)}
                placeholder="First"
                style={inputStyle('firstName')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {fieldErrors.firstName && <p style={fieldErrorStyle}>{fieldErrors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <div style={{ position: 'relative' }}>
              <input
                value={lastName}
                onChange={e => { setLastName(e.target.value); setFieldErrors(fe => ({ ...fe, lastName: '' })); }}
                onFocus={() => setFocused('lastName')}
                onBlur={() => setFocused(null)}
                placeholder="Last"
                style={inputStyleNoIcon('lastName')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {fieldErrors.lastName && <p style={fieldErrorStyle}>{fieldErrors.lastName}</p>}
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: fieldErrors.phone ? 4 : 16 }}>
          <label style={labelStyle}>Phone number</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-phone" style={iconStyle('phone')} />
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setFieldErrors(fe => ({ ...fe, phone: '' })); }}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              placeholder="(770) 555-1234"
              style={inputStyle('phone')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {fieldErrors.phone && <p style={fieldErrorStyle}>{fieldErrors.phone}</p>}
        </div>

        {/* Email */}
        <div style={{ marginBottom: fieldErrors.email ? 4 : 16 }}>
          <label style={labelStyle}>Email address</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-envelope" style={iconStyle('email')} />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: '' })); }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@example.com"
              style={inputStyle('email')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {fieldErrors.email && <p style={fieldErrorStyle}>{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: fieldErrors.password ? 4 : 16 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={iconStyle('password')} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(fe => ({ ...fe, password: '' })); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="Min. 6 characters"
              style={inputStyleWithIconRight('password')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                ...revealButtonStyle,
              }}
            >
              <i className={`ph ph-${showPassword ? 'eye-slash' : 'eye'}`} style={{ fontSize: 16 }} />
            </button>
          </div>
          {fieldErrors.password && <p style={fieldErrorStyle}>{fieldErrors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: fieldErrors.confirmPassword ? 4 : 24 }}>
          <label style={labelStyle}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={iconStyle('confirmPassword')} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(fe => ({ ...fe, confirmPassword: '' })); }}
              onFocus={() => setFocused('confirmPassword')}
              onBlur={() => setFocused(null)}
              placeholder="Re-enter password"
              style={inputStyleWithIconRight('confirmPassword')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              style={{
                ...revealButtonStyle,
              }}
            >
              <i className={`ph ph-${showConfirm ? 'eye-slash' : 'eye'}`} style={{ fontSize: 16 }} />
            </button>
          </div>
          {fieldErrors.confirmPassword && <p style={{ ...fieldErrorStyle, marginBottom: 16 }}>{fieldErrors.confirmPassword}</p>}
        </div>

        {/* ── Submit button ────────────────────────────────────────────────
            ⚠ THIS READ "navy gradient (not red, differentiates from login)", AND
            THAT REASON IS GONE RATHER THAN OUT OF DATE. It differentiated one
            tenant's navy from that same tenant's red, at a time when both were
            hardcoded. There is no product-wide navy or red now: the login
            button is `--rm-primary`, and a signup button deliberately painted a
            DIFFERENT colour would be the contractor's primary action rendered in
            their dark neutral on the one screen where it matters most.

            ⚠ `primary`, NOT `secondary`, AND THE CROSSOVER IS WHY IT LOOKS
            BACKWARDS. B-1 routes the render token `primary` from the STORED
            `secondaryColor` — the contractor's ACTION colour. The retired
            gradient ran on the dark NEUTRAL, which is the render token
            `secondary`. Reading "navy" and reaching for `secondary` reproduces
            the old pixels and the old mistake.

            ⚠ THE SHADOW CARRIED THE RETIRED TONE AND NO NEEDLE IN THIS ARC SAW
            IT: `rgba(1,40,84,0.35)` is the retired navy written as three DECIMAL
            channels, so it is neither a hex nor a colour key. `shadowMd` is the
            published role with the same geometry and a neutral black.

            ⚠ NO `opacity` ON THE LOADING STATE, DELIBERATELY. Opacity INHERITS,
            so fading the button fades its label against a ground that is already
            fading — the composite defect that put a payout figure at 3.29:1.
            The scale nudge and the dropped shadow carry the state instead. */}
        <button
          onClick={handleSubmit}
          disabled={loading}
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
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            boxShadow: loading ? 'none' : elevationVar('shadowMd'),
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Creating account...</>
            : <><i className="ph ph-user-plus" style={{ fontSize: 16 }} /> Create Account</>
          }
        </button>

        {/* ── Sign in link ─────────────────────────────────────────────────
            ⚠ `R.textMuted` WAS #A0A0A0 — 2.61:1 on the card, a live text defect
            under the 4.5 floor. `--rm-text` at 0.7 is 4.91:1 on the worst brand.
            The inline button takes the same treatment LoginScreen's "Contact
            your rep" does: the text token at full strength, weight 600. */}
        <p style={{
          textAlign: 'center', marginTop: 20, fontSize: 15,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.7,
        }}>
          Already have an account?{' '}
          <button
            onClick={() => onSignupComplete({ action: 'login' })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              cursor: 'pointer',
              color: 'var(--rm-text, #1C2D4D)',
              fontWeight: 600,
            }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────
          ⚠ WAS `rgba(255,255,255,0.4)` — WHITE, because this sat on a dark
          gradient. That gradient is gone (see the page ground above), so white
          here would now be white on `--rm-bg`. The colour had to move with the
          ground; leaving it would have been a rule applied once to a surface and
          never re-run when the surface moved.

          ⚠ AND THE ALPHA IS 0.7, NOT THE 0.45 LoginScreen AND ResetPinScreen USE.
          Re-derived rather than inherited: 0.45 composites to 2.51:1 on the worst
          brand, under the 4.5 floor for this 12px uppercase line. 0.7 is 4.91:1
          on that same worst case. The siblings' value is FILED, not copied —
          paletteAuthScreens.test.jsx carries the measurement and fails if 0.45
          ever becomes adequate. */}
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
