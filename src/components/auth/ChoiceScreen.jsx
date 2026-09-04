import { useState } from 'react';
import { statusVar, STATUS_BANNER } from '../../constants/statusTheme';
import useEntrance from '../../hooks/useEntrance';

// ─── The Choice Screen ────────────────────────────────────────────────────────
//
// C/DL-3b Phase 5, decision D2. Shown ONLY when one credential opened more than
// one identity — a homeowner registered with two contractors, or the CD-4
// multi-role case of an Owner who also holds a homeowner account.
//
// ⚠ THIS SCREEN IS REACHED WITH NO SESSION. The password has been PROVEN, but the
// server does not yet know which identity the person means, so it has minted
// nothing. What this screen holds is a choice token: single-use, two-minute TTL,
// and a bearer credential in its own right.
//
// ── WHAT MAY BE DISPLAYED, AND WHAT MAY NOT (D2, binding) ───────────────────
// CONTRACTOR NAME AND ROLE ONLY. Never an email, never an id. The server already
// honours this — it builds the list from display names and a role string — but the
// risk this screen carries is different from the server's: the typed email is
// sitting in the parent's component state, one prop away. Rendering it here would
// put an address on screen beside a list of the companies that address is
// registered with, which is the precise privacy leak D1's verify-then-disambiguate
// ordering exists to prevent.
//
// src/components/auth/unifiedLogin.test.jsx asserts the negative: the typed
// address must not appear in the DOM of this screen, and neither must the token.
//
// ── PAINTS FROM --rm-*, LIKE ITS PARENT ─────────────────────────────────────
// This is a pre-auth surface inside ThemeProvider, so it is white-labeled by the
// D4 chain exactly as the login screen is. It carries no branding logic of its
// own (CD-24) — everything comes down as CSS custom properties.
//
// @param {Array<{selection:number, contractor_name:string, role:string}>} identities
// @param {(selection:number) => Promise<void>} onChoose  parent posts the token
// @param {() => void} onCancel  returns to the form; the token is simply abandoned
// @param {string|null} error
export default function ChoiceScreen({ identities = [], onChoose, onCancel, error = null }) {
  const cardVisible = useEntrance(80);
  // Which row is mid-flight. Guards against a double-submit racing the burn: the
  // token is single-use, so a second click would land on a consumed token and be
  // answered with a generic 401 — a confusing failure for a person who simply
  // tapped twice on a slow connection.
  const [pending, setPending] = useState(null);

  async function choose(selection) {
    if (pending !== null) return;
    setPending(selection);
    try {
      await onChoose(selection);
    } finally {
      setPending(null);
    }
  }

  // "Team" is the wire value; "Team member" is what a person is called. The
  // mapping lives here rather than on the server so re-wording it can never be a
  // protocol change — the same rule the frozen screen's copy follows.
  const roleLabel = (role) => (role === 'team' ? 'Team member' : 'Homeowner account');

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20, padding: '32px 28px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <h2 style={{
          margin: '0 0 8px', fontSize: 22, fontWeight: 700,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Which account?
        </h2>
        <p style={{
          margin: '0 0 24px', fontSize: 15, lineHeight: 1.5,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
        }}>
          This email opens more than one account. Choose the one you want to use.
        </p>

        {identities.map(identity => {
          const busy = pending === identity.selection;
          return (
            <button
              key={identity.selection}
              onClick={() => choose(identity.selection)}
              disabled={pending !== null}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 12,
                marginBottom: 10, padding: '16px 18px',
                // A 1px rule rather than a fill: light-mode bg and surface can be
                // the same colour by design (themeTokens' documented light-mode
                // consequence), so a row defined by a background wash would be
                // invisible on a default palette. The EDGE is what separates them.
                backgroundColor: 'var(--rm-surface, #FFFFFF)',
                border: '1.5px solid var(--rm-primary, #F26A1B)',
                borderRadius: 12, cursor: pending !== null ? 'default' : 'pointer',
                textAlign: 'left', font: 'inherit',
                opacity: pending !== null && !busy ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <span>
                <span style={{
                  display: 'block', fontSize: 16, fontWeight: 700,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  color: 'var(--rm-text, #1C2D4D)',
                }}>
                  {identity.contractor_name}
                </span>
                <span style={{
                  display: 'block', marginTop: 2, fontSize: 13,
                  color: 'var(--rm-text, #1C2D4D)', opacity: 0.7,
                }}>
                  {roleLabel(identity.role)}
                </span>
              </span>
              <i
                className={busy ? 'ph ph-circle-notch' : 'ph ph-arrow-right'}
                style={{
                  fontSize: 18, color: 'var(--rm-text, #1C2D4D)', flexShrink: 0,
                  animation: busy ? 'rmSpin 0.8s linear infinite' : 'none',
                }}
              />
            </button>
          );
        })}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            ...STATUS_BANNER.danger,
            borderRadius: 8, padding: '8px 12px',
          }}>
            <i className="ph ph-warning-circle" style={{ color: statusVar('dangerText'), fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: statusVar('dangerText'), fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', padding: '20px 0 0',
            width: '100%', textAlign: 'center', font: 'inherit', cursor: 'pointer',
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
            fontWeight: 600, fontSize: 14,
          }}
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}
