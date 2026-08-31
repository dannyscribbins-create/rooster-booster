import { useContext, useState } from 'react';
import { BACKEND_URL } from '../../config/contractor';
import { ThemeContext } from '../shared/ThemeProvider';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import BrandLogo from '../shared/BrandLogo';
import ContactModal from '../shared/ContactModal';
import FrozenAccountScreen from './FrozenAccountScreen';
import ChoiceScreen from './ChoiceScreen';
import TeamAccessRevokedScreen from './TeamAccessRevokedScreen';
import useEntrance from '../../hooks/useEntrance';

// ─────────────────────────────────────────────────────────────────────────────
// THE UNIFIED LOGIN DOOR — C/DL-3b Phase 5, CD-4
//
// ONE WHITE-LABELED DOOR, replacing two: this file's client-only predecessor and
// the inline `AdminLogin` that lived inside AdminApp.jsx. The ENDPOINT was
// already unified in Phase 2B — D1's verify-then-disambiguate means one form can
// serve a homeowner, a field rep and an owner without asking which they are — but
// the UI still had two forms, styled differently, and the team one announced the
// admin panel's existence to anyone who typed `?admin=true`.
//
// CLIENT-FACING BY DEFAULT (CD-4). The homeowner framing is what an unknown
// visitor sees. The team route is present but quiet, and it changes COPY ONLY:
// both modes post the same body to the same endpoint, because the server decides
// what this person is from the credential, never from a flag the client sends.
// Anyone can flip the affordance and learn nothing.
//
// ── ⚠ THIS IS THE FIRST SURFACE IN THE PRODUCT TO ACTUALLY PAINT FROM --rm-* ──
// Phase 1 mounted the --rm-* custom properties and nothing consumed them; every
// theme test since has been declaration-level, because jsdom never resolves
// var(). Every colour below is a var() with a platform-default fallback, so the
// screen is correct with no provider at all and contractor-branded under one.
//
// NO BRANDING LOGIC OF ITS OWN (CD-24). The company name and logo come from
// ThemeContext, which the D4 chain resolved; this file consults the chain's
// OUTPUT and never a source.
//
// ── NO COLOUR MATH IS DONE HERE ANY MORE — THE GAP CLOSED ──────────────────
// ⚠ THIS BLOCK IS INVERTED FROM WHAT IT SAID, NOT MERELY OUT OF DATE, WHICH IS
// WHY IT IS REWRITTEN RATHER THAN DATED. It read "There is no `on-primary`
// render token to read, so this screen picks the readable foreground itself" and
// went on to describe a local useMemo as the correct approach. A reader
// following that today would rebuild a workaround that no longer has anything to
// work around.
//
// WHAT WAS TRUE AND STILL IS: the theme engine guarantees `primary` is readable
// as text ON `surface`, and says nothing about text ON a primary FILL. Those are
// different questions, and the platform default #F26A1B carries only 3.06:1
// under a white label — below the AA floor for this button's 15px/700 text.
//
// WHAT CHANGED: C/DL-3c Phase 1a Ruling 1 made `onPrimary` a real render token,
// so the answer arrives as `--rm-on-primary` with the other brand variables and
// this file simply reads it. The local computation is gone from here and from
// ResetPinScreen, which carried the identical copy.
//
// ⚠ AND THE FALLBACK IS #000000, NOT THE #111111 THIS FILE USED TO RETURN. The
// pair (white, #111111) cannot hold 4.5:1 for every fill — measured, it bottoms
// out at 4.345:1 and misses AA on blues, which is why the token uses the true
// extremes. #000000 is also the correct answer for the `--rm-primary` fallback
// beside it: with no provider mounted this button paints #F26A1B, and black on
// #F26A1B is 6.85:1 against white's 3.06:1. Fallbacks are chosen for where the
// component renders with nothing mounted — the rule statusTheme.js states.
// ─────────────────────────────────────────────────────────────────────────────

// ─── THE COPY IS ROLE-NEUTRAL, AND THAT IS A RULING ──────────────────────────
//
// ⚠ THERE IS NO "TEAM MEMBER LOGIN" AFFORDANCE, AND ONE MUST NOT BE ADDED BACK.
// CD-4 describes a quiet team-member affordance; Phase 5 shipped one, and it was
// removed after the ruling below. The reasoning, so it is not re-litigated:
//
// THE DOOR IS PERMANENTLY SHARED BY THREE POPULATIONS, NOT TWO — homeowners,
// field reps, and office staff. The Capacitor rep app routes through this same
// door, so there is no later split where a two-way toggle becomes true. A
// two-way choice presented to a three-way audience is wrong at any point in the
// arc, not merely early.
//
// THE PHRASE ITSELF MISDIRECTS. A field rep IS a team member, but "Team member
// login" reads as office staff — so the population most likely to need
// reassurance is the one most likely to skip it.
//
// AND IT HAD NOTHING TO DO. Phase 2B unified the endpoint: D1's
// verify-then-disambiguate means the server reads the credential and decides what
// the person is. The affordance changed copy only. Making it functional would
// re-introduce the client-side role distinction D1 deliberately removed — any
// client-supplied "I am a team member" hint is either IGNORED (pointless) or
// TRUSTED (a tenancy input, forbidden by CD-24 R1). There is no third option.
//
// So the copy names no role at all. "Sign in to {companyName}" is correct for all
// three, and stays correct in the native app, where source 4 of the D4 chain has
// already resolved the brand at install time.
//
// ── THE ONE DELIBERATE ASYMMETRY ────────────────────────────────────────────
// "Contact your rep" stays prominent and is LABELLED FOR HOMEOWNERS. A homeowner
// arriving cold is the only population that can be genuinely stuck; reps and
// office staff reached this door through onboarding and already have credentials.
// The label is what lets the other two read past it instead of wondering who was
// supposed to contact them.

export default function LoginScreen({ onAuthenticated }) {
  const { branding } = useContext(ThemeContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const cardVisible = useEntrance(80);

  // Forgot-password sub-form.
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('idle'); // idle | loading | sent | error
  const [forgotError, setForgotError] = useState('');

  // D3. Holds the 403 body's branding when the credential was PROVEN but the
  // account is deactivated. Null the rest of the time, so its truthiness is the
  // whole state machine — there is no session and no half-authenticated mode.
  const [frozenAccount, setFrozenAccount] = useState(null);

  // D2. Holds the choice token and the display list on a genuine multi-match.
  // Null on every single-match login, which is what keeps the choice screen
  // unseen in the ordinary case.
  const [choice, setChoice] = useState(null);
  const [choiceError, setChoiceError] = useState(null);

  // Ruling B (C/DL-3c Phase 2c). Holds { contractorName, session } when the
  // login SUCCEEDED and the same credential also opened a deactivated team
  // membership. Unlike `frozenAccount`, this state carries a REAL SESSION — the
  // person is signed in and the screen is an acknowledgement on the way through,
  // not a refusal. Null on every other login, which is what keeps it unseen.
  const [revokedTeamAccess, setRevokedTeamAccess] = useState(null);

  const companyName = branding?.companyName || 'RoofMiles';
  const logoSrc = branding?.logoUrl || roofMilesLogo;

  // "Sign in to {companyName}", falling back to a role-neutral, brand-neutral line
  // when the chain has resolved nothing at all.
  //
  // THE FALLBACK IS A SAFETY NET, NOT THE FIRST-VISIT CASE. On a true first visit
  // — no session, no URL hint, no stored hint — the D4 chain answers source 5,
  // neutral RoofMiles, and this correctly reads "Sign in to RoofMiles". That is
  // the platform's own name on the platform's own door, not a leaked default.
  // The fallback covers only the frame before ThemeContext has a branding object
  // at all.
  const subtitle = branding?.companyName
    ? `Sign in to ${branding.companyName}`
    : 'Sign in to your account';

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  // async/await throughout (CLAUDE.md). The three .then() chains this file used
  // to carry are gone with the rewrite.
  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `password`, not `pin` (D12 — a label change, never a migration; the
        // column keeps its name). NO contractorSlug: D1 retired the Tenant
        // Rebuild §3.5 narrowing exception, tenancy comes from the authenticated
        // row, and sending it would imply to a future reader that the client
        // still has a say in it.
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      // BRANCHED ON THE TYPED CODE, NOT THE STATUS. 'account_frozen' is the
      // protocol; the copy belongs to the screen. Checked BEFORE the generic
      // branch, which would otherwise print the literal string at a person.
      if (data.error === 'account_frozen') {
        setFrozenAccount({ branding: data.branding ?? null });
      } else if (data.choice_required) {
        // D2: no session was minted. The token and the display list are all this
        // client holds, and the password is never sent again.
        setChoice({ token: data.choice_token, identities: data.identities ?? [] });
      } else if (data.error) {
        setError(data.error);
      } else if (data.team_access_revoked) {
        // RULING B'S FOURTH OUTCOME. A COMPLETE SESSION that arrives carrying
        // something the person should know first — checked AFTER the error
        // branches (a 200 has no `error`) and BEFORE the plain success, because
        // the plain success is what it is a special case of.
        //
        // ⚠ onAuthenticated IS NOT CALLED HERE. Calling it and rendering the
        // notice would navigate straight past the screen — the session is held
        // in state and handed over when the person continues.
        setRevokedTeamAccess({
          contractorName: data.team_access_revoked.contractor_name ?? null,
          session: data,
        });
      } else {
        onAuthenticated(data);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChoose(selection) {
    setChoiceError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice_token: choice.token, selection }),
      });
      const data = await res.json();

      // A deactivation landing inside the two-minute choice window gets the same
      // honest answer the first request would have given (D3).
      if (data.error === 'account_frozen') {
        setChoice(null);
        setFrozenAccount({ branding: data.branding ?? null });
      } else if (data.error) {
        // Expiry, replay and forgery are indistinguishable by design — all three
        // come back as the same generic failure, so the copy has to cover all of
        // them without guessing which happened.
        setChoiceError('That took too long, or the link was already used. Please sign in again.');
      } else {
        onAuthenticated(data);
      }
    } catch {
      setChoiceError('Something went wrong. Please try again.');
    }
  }

  async function handleForgot() {
    if (!forgotEmail) return;
    setForgotStatus('loading');
    setForgotError('');
    try {
      // No contractorSlug here either — D1 retired the same exception on this
      // endpoint: it now sends one reset email per matching account, each naming
      // its contractor, with a response that is always generic.
      const res = await fetch(`${BACKEND_URL}/api/forgot-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await res.json();
      setForgotStatus('sent');
    } catch {
      setForgotError('Something went wrong. Please try again.');
      setForgotStatus('error');
    }
  }

  // ── THE TWO SCREENS THAT REPLACE THE FORM RATHER THAN COVER IT ────────────
  // Leaving the credential fields on screen behind either of these would invite
  // the retry loop D3 exists to end, and would leave a proven password sitting in
  // state behind a different screen.
  if (frozenAccount) {
    return (
      <FrozenAccountScreen
        branding={frozenAccount.branding}
        onBack={() => { setFrozenAccount(null); setPassword(''); }}
      />
    );
  }

  // RULING B (C/DL-3c Phase 2c). The session is ALREADY MINTED and sitting in
  // this state; the screen precedes the destination rather than replacing it.
  // Continuing hands the whole body to onAuthenticated untouched — the parent
  // decides what to store, and trimming a key here would be this screen editing
  // someone else's payload.
  //
  // ⚠ ORDERED AFTER the frozen screen and BEFORE the choice screen for the same
  // reason they are ordered at all: these three are mutually exclusive by
  // construction, and reading them top to bottom is how the four login outcomes
  // stay legible from the client side.
  if (revokedTeamAccess) {
    return (
      <TeamAccessRevokedScreen
        contractorName={revokedTeamAccess.contractorName}
        onContinue={() => onAuthenticated(revokedTeamAccess.session)}
      />
    );
  }

  if (choice) {
    return (
      <ChoiceScreen
        identities={choice.identities}
        error={choiceError}
        onChoose={handleChoose}
        onCancel={() => { setChoice(null); setChoiceError(null); setPassword(''); }}
      />
    );
  }

  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: 'var(--rm-bg, #FFFFFF)',
    border: `1.5px solid ${focused === field ? 'var(--rm-primary, #F26A1B)' : 'rgba(128,128,128,0.35)'}`,
    borderRadius: 10, padding: '16px 16px 16px 48px',
    color: 'var(--rm-text, #1C2D4D)', fontSize: 15,
    fontFamily: 'Roboto, system-ui, sans-serif', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  });

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8,
    color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
    fontFamily: 'Roboto, system-ui, sans-serif',
  };

  const iconStyle = (field) => ({
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    fontSize: 16, pointerEvents: 'none', transition: 'color 0.2s',
    color: focused === field ? 'var(--rm-primary, #F26A1B)' : 'var(--rm-text, #1C2D4D)',
    opacity: focused === field ? 1 : 0.5,
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20, padding: '32px 28px',
        // Light-mode bg and surface are legitimately the same colour on a default
        // palette (themeTokens' documented consequence), so the card is defined by
        // its EDGE — this shadow — rather than by contrast against the canvas.
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <BrandLogo src={logoSrc} alt={companyName} marginBottom={20} />

        <h2 style={{
          margin: '0 0 8px', fontSize: 22, fontWeight: 700,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Welcome back
        </h2>
        <p style={{
          margin: '0 0 24px', fontSize: 15,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
        }}>
          {subtitle}
        </p>

        <label htmlFor="rm-login-email" style={labelStyle}>Email address</label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <i className="ph ph-envelope" style={iconStyle('email')} />
          <input
            id="rm-login-email"
            value={email} onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
            placeholder="Email address"
            autoComplete="username"
            style={inputStyle('email')}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {showForgot ? (
          forgotStatus === 'sent' ? (
            <div style={{
              backgroundColor: 'var(--rm-success, #DCFCE7)',
              borderRadius: 10, padding: 16, marginBottom: 16,
              fontSize: 15, lineHeight: 1.5,
              color: 'var(--rm-success-text, #166534)',
            }}>
              Check your email — if that address is registered, a reset link is on its way.
            </div>
          ) : (
            <>
              <label htmlFor="rm-forgot-email" style={labelStyle}>Email address</label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <i className="ph ph-envelope" style={iconStyle('forgotEmail')} />
                <input
                  id="rm-forgot-email"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  onFocus={() => setFocused('forgotEmail')} onBlur={() => setFocused(null)}
                  placeholder="Email address"
                  style={inputStyle('forgotEmail')}
                  onKeyDown={e => e.key === 'Enter' && handleForgot()}
                />
              </div>
              {forgotStatus === 'error' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4,
                  backgroundColor: 'var(--rm-danger, #FEE2E2)', borderRadius: 8, padding: '8px 12px',
                }}>
                  <i className="ph ph-warning-circle" style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 16, flexShrink: 0 }} />
                  <p style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 15, margin: 0 }}>{forgotError}</p>
                </div>
              )}
            </>
          )
        ) : (
          <>
            {/* "Password" (D12). The column is still users.pin and stays so — the
                rename was rejected as cosmetic — but nothing a person reads says
                PIN any more, and nothing here restricts the value to four digits. */}
            <label htmlFor="rm-login-password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <i className="ph ph-lock" style={iconStyle('password')} />
              <input
                id="rm-login-password"
                value={password} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                type="password" placeholder="Password"
                autoComplete="current-password"
                maxLength={200}
                style={inputStyle('password')}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </>
        )}

        {!showForgot && (
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            <button
              onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              style={{
                background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                color: 'var(--rm-text, #1C2D4D)', opacity: 0.8,
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {!showForgot && error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8,
            backgroundColor: 'var(--rm-danger, #FEE2E2)', borderRadius: 8, padding: '8px 12px',
          }}>
            <i className="ph ph-warning-circle" style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: 'var(--rm-danger-text, #B91C1C)', fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}

        {showForgot ? (
          <>
            {forgotStatus !== 'sent' && (
              <button onClick={handleForgot} disabled={forgotStatus === 'loading'} style={{
                width: '100%', marginTop: 16,
                backgroundColor: 'var(--rm-primary, #F26A1B)', color: 'var(--rm-on-primary, #000000)',
                border: 'none', borderRadius: 10, padding: 16,
                fontSize: 15, fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif',
                cursor: forgotStatus === 'loading' ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.2s, opacity 0.2s',
                transform: forgotStatus === 'loading' ? 'scale(0.98)' : 'scale(1)',
                opacity: forgotStatus === 'loading' ? 0.85 : 1,
              }}>
                {forgotStatus === 'loading'
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'rmSpin 0.8s linear infinite' }} /> Sending…</>
                  : <><i className="ph ph-paper-plane-tilt" style={{ fontSize: 16 }} /> Send reset link</>
                }
              </button>
            )}
            <button
              onClick={() => { setShowForgot(false); setForgotStatus('idle'); setForgotError(''); setForgotEmail(''); }}
              style={{
                background: 'none', border: 'none', padding: '12px 0 0',
                width: '100%', textAlign: 'center', font: 'inherit', cursor: 'pointer',
                color: 'var(--rm-text, #1C2D4D)', opacity: 0.8, fontWeight: 600, fontSize: 14,
              }}
            >
              ← Back to sign in
            </button>
          </>
        ) : (
          <button onClick={handleLogin} disabled={loading} style={{
            width: '100%', marginTop: 16,
            backgroundColor: 'var(--rm-primary, #F26A1B)', color: 'var(--rm-on-primary, #000000)',
            border: 'none', borderRadius: 10, padding: 16,
            fontSize: 15, fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif',
            cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'transform 0.2s, opacity 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            opacity: loading ? 0.85 : 1,
          }}>
            {loading
              ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'rmSpin 0.8s linear infinite' }} /> Signing in…</>
              : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
            }
          </button>
        )}

        {/* ── LABELLED FOR HOMEOWNERS, DELIBERATELY ────────────────────────
            The one place the copy names a population, and it names the only one
            that can be genuinely stuck. Reps and office staff reached this door
            through onboarding; the label is what lets them read past this line
            instead of wondering who was supposed to contact them. See the header. */}
        {!showForgot && (
          <p style={{
            textAlign: 'center', marginTop: 20, marginBottom: 0, fontSize: 15,
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.7,
          }}>
            Homeowners: don&apos;t have an account?{' '}
            <button
              onClick={() => setShowContact(true)}
              style={{
                background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', cursor: 'pointer', fontWeight: 600,
                color: 'var(--rm-text, #1C2D4D)',
              }}
            >
              Contact your rep
            </button>
          </p>
        )}

        <p style={{
          textAlign: 'center', marginTop: 16, marginBottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <button
            onClick={() => window.open('/privacy', '_blank')}
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0,
              font: 'inherit', cursor: 'pointer', fontSize: 12,
              color: 'var(--rm-text, #1C2D4D)', opacity: 0.55,
            }}
          >
            Privacy Policy
          </button>
          <span style={{ color: 'var(--rm-text, #1C2D4D)', opacity: 0.35, fontSize: 12 }}>·</span>
          <button
            onClick={() => window.open('/terms', '_blank')}
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0,
              font: 'inherit', cursor: 'pointer', fontSize: 12,
              color: 'var(--rm-text, #1C2D4D)', opacity: 0.55,
            }}
          >
            Terms of Service
          </button>
        </p>
      </div>

      {/* The contractor's own name, from the D4 chain. Replaces the hardcoded
          single-tenant footer line that shipped here — Group A retirement.
          ⚠ The retired string is deliberately NOT quoted anywhere in this file:
          src/components/auth/unifiedLogin.test.jsx sweeps the SOURCE TEXT, and a
          comment naming the literal is indistinguishable from the literal to it.
          That bluntness is the point — it is why the sweep cannot be fooled by a
          value that only appears on a branch no test happens to render. */}
      <p style={{
        marginTop: 24, marginBottom: 0, fontSize: 12,
        fontFamily: 'Roboto Mono, ui-monospace, monospace', letterSpacing: '0.06em',
        color: 'var(--rm-text, #1C2D4D)', opacity: 0.45,
        textTransform: 'uppercase',
        transition: 'opacity 0.5s ease 0.3s',
      }}>
        {companyName}
      </p>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      {/* rmSpin, not spin — the shared keyframe name used by LoadingIndicator. */}
      <style>{`
        @keyframes rmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
