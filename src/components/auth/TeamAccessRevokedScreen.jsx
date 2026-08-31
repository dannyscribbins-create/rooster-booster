import useEntrance from '../../hooks/useEntrance';

// ─── Team Access Revoked ──────────────────────────────────────────────────────
//
// C/DL-3c Phase 2c, Ruling B. What a DEACTIVATED team member sees when the same
// credential still opens a homeowner account — told once, then continuing.
//
// ⚠ A SIBLING OF FrozenAccountScreen, NOT A VARIANT OF IT, AND THE DIFFERENCE IS
// NOT COSMETIC. That screen is TERMINAL: no session exists, nothing was minted,
// its copy says "contact your administrator to have it restored", and its only
// exit is `onBack` to the sign-in form. Reaching it requires `live.length === 0`.
//
// This screen is reached with a VALID SESSION ALREADY MINTED. Reusing the frozen
// one here would tell someone who has just successfully signed in that they
// cannot get in — which is false, and would conflate "you cannot get in" with
// "you got in, but something changed". PRE_LAUNCH_CHECKLIST.md's Ruling B entry
// ruled a new component for that reason; this comment is the record of why, so
// the two are not helpfully merged later.
//
// ⚠ THE NAME IS A PROP AND IT IS THE ONLY IDENTITY ON THIS SCREEN. It comes from
// the FROZEN team_members row's contractor, carried down in the login response.
// It is NOT the session's contractor and must never be read from ThemeContext:
// the session being minted is a referrer session for a `users` row that may
// belong to a completely different company (`users` is UNIQUE(contractor_id,
// email); `team_members.email` is globally unique). Reading the provider here
// would name the wrong employer, plausibly, with nothing failing.
//
// ⚠ NO LOGO, DELIBERATELY, AND THIS IS THE OPPOSITE CALL FROM THE FROZEN SCREEN.
// That screen paints the frozen contractor's logo because it is the ONLY thing
// on a person's screen at that moment. Here the person is one click from a
// DIFFERENT contractor's app, so an employer logo on the way in would mis-brand
// the destination. Identity-bearing values get no defaults either (CLAUDE.md), so
// the platform's mark is not a fallback — a name with no logo is the honest
// shape, and the chrome comes down as --rm-* like ChoiceScreen's does.
//
// ⚠ IT IS AN ACKNOWLEDGEMENT, NOT A CHOICE. Nothing here is selectable and there
// is no route to the revoked identity — that is what keeps D2's rejected shape
// rejected. The frozen identity is made VISIBLE, never available.
//
// @param {string|null} contractorName  the FROZEN row's contractor; null degrades
//        to a sentence that names nobody rather than borrowing a name.
// @param {() => void} onContinue  proceeds into the referrer app with the session
//        the parent is already holding.
export default function TeamAccessRevokedScreen({ contractorName = null, onContinue }) {
  const cardVisible = useEntrance(80);

  // Generic copy may be defaulted freely; a company name says WHO and may not be.
  // So the SENTENCE changes rather than the name being substituted.
  const message = contractorName
    ? `Your team member access at ${contractorName} has been removed.`
    : 'Your team member access has been removed.';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <div style={{ height: 4, backgroundColor: 'var(--rm-primary, #F26A1B)' }} />

        <div style={{ padding: '32px 28px', textAlign: 'center' }}>
          <i
            className="ph ph-info"
            style={{ fontSize: 32, color: 'var(--rm-text, #1C2D4D)', opacity: 0.6 }}
          />

          <h2 style={{
            margin: '14px 0 10px', fontSize: 22, fontWeight: 700,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            color: 'var(--rm-text, #1C2D4D)',
          }}>
            Your team access has ended
          </h2>

          <p style={{
            margin: '0 0 6px', fontSize: 15, lineHeight: 1.55,
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.8,
          }}>
            {message}
          </p>
          <p style={{
            margin: 0, fontSize: 15, lineHeight: 1.55,
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
          }}>
            Your rewards account is unaffected — you can keep using it as usual.
          </p>

          <button
            onClick={onContinue}
            style={{
              width: '100%', marginTop: 24, padding: '15px 18px',
              backgroundColor: 'var(--rm-primary, #F26A1B)',
              color: 'var(--rm-on-primary, #FFFFFF)',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            Continue to my account
          </button>
        </div>
      </div>
    </div>
  );
}
