import { useCallback, useContext, useState } from 'react';
import { ThemeContext, saveThemeMode } from '../shared/ThemeProvider';

// ─── THE PROFILE THEME ROW — C/DL-3c Phase 3-A, amendment A30 (CD-6) ─────────
//
// The light/dark switch, on its own row on the Profile screen, DIRECTLY ABOVE
// Sign out. Label left, control right, matching the row rhythm the mockup uses
// for Title, Attribution type, Fallback link and Security — none of which are
// 3-A's, all of which are 3-C's.
//
// ⚠ Sign out IS THE ANCHOR, NOT Security. A30 was corrected on exactly this
// point: "below Security" and "above Sign out" name the same slot whenever
// Security is present, and only the second survives Security's absence. Security
// carries a 2FA toggle that is Wave 4's, so whether that row ships at all is
// still 3-C's decision — and this placement does not depend on which way it
// goes.
//
// ⚠ THE MOCKUP HAS NO CONTROL TO COPY. Phase 0 read all 72 PNGs and found no
// light/dark control anywhere in the set; the only toggle-shaped object is the
// device-chrome pill, which is the mockup's own variant switcher and not a
// FieldRepApp feature. So this is designed against the row rhythm rather than
// traced, and every colour comes from a token — no hex was read off an image.
//
// ── ⚠ WRITE FIRST, THEN MOVE. THIS IS THE WHOLE DESIGN. ─────────────────────
// The control does not move until the server has agreed. The alternative — flip
// optimistically and revert on failure — produces a switch that slides back on
// its own, which teaches a person the app is broken while telling them nothing.
// A control that has moved is a claim that the preference is stored, and this
// one does not make that claim until it is true.
//
// The cost is a brief pending state on a slow connection, and that is the right
// trade: `busy` disables the control so the state is legible as "working", not
// as "dead".
//
// ── WHAT HAPPENS WHEN THE WRITE FAILS ───────────────────────────────────────
// Three outcomes, three different sentences, none of them exposing server
// internals:
//   403 — the rep flag was revoked between render and click. The endpoint
//         re-reads is_field_rep on every call precisely so this is possible.
//   409 — the write matched no row for this tenant. The server logs that as a
//         data anomaly; the person is told it did not save, not why, because
//         "a row exists under another tenant" is not theirs to act on.
//   null status — the request never reached the server.
// In every case the mode is unchanged and the control still reports the STORED
// state, because it never moved.
//
// ── ⚠ HOW THIS BEHAVES UNDER A PINNED PROVIDER, WHICH IS TEST-ONLY ──────────
// `setMode` refuses when ThemeProvider's `mode` prop is pinned, and warns. So in
// a pinned mount the PUT still fires and the preference IS stored — the request
// is not conditional on the pin — while the rendered mode holds and the console
// explains why. That combination is correct rather than a bug: the pin is a
// display override, not a storage one. No production mount pins the mode, so
// this paragraph describes a test, and the warning is what a developer meeting
// it will see.

const LABEL = 'Dark mode';

// One sentence per outcome, chosen by what the person can actually do about it.
function messageFor(status) {
  if (status === 403) return 'Your account can no longer change this. Ask your Owner if that looks wrong.';
  if (status === null) return 'Could not reach the server. Your theme was not changed.';
  return 'Could not save that. Your theme was not changed.';
}

export default function RepThemeToggleRow({ save = saveThemeMode }) {
  const { mode, setMode } = useContext(ThemeContext);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  const isDark = mode === 'dark';

  const onToggle = useCallback(async () => {
    if (busy) return;
    const next = isDark ? 'light' : 'dark';
    setBusy(true);
    // CLEARED ON ATTEMPT, not only on success — a message left standing through
    // a retry reads as "it failed again" when nothing has been decided yet.
    setFailure(null);
    try {
      const result = await save(next);
      if (result?.ok) {
        setMode(next);
      } else {
        setFailure(messageFor(result?.status ?? null));
      }
    } catch {
      // saveThemeMode is documented as never throwing; this is the belt-and-
      // braces guard on an injected `save` that might, since a swallowed throw
      // here would leave the control stuck in `busy` forever.
      setFailure(messageFor(null));
    } finally {
      setBusy(false);
    }
  }, [busy, isDark, save, setMode]);

  return (
    <div data-rep-theme-row="">
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, padding: '18px 0',
        }}
      >
        <span
          id="rep-theme-row-label"
          style={{ fontSize: 16, color: 'var(--rm-text, #1C2D4D)', opacity: 0.75 }}
        >
          {LABEL}
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={isDark ? 'true' : 'false'}
          aria-labelledby="rep-theme-row-label"
          aria-busy={busy ? 'true' : undefined}
          disabled={busy}
          onClick={onToggle}
          data-rep-theme-switch=""
          style={{
            position: 'relative',
            width: 52, height: 30, flexShrink: 0,
            borderRadius: 999,
            borderWidth: 1, borderStyle: 'solid',
            // OFF is the text token at low strength rather than a grey literal,
            // so the track is visible on the light surface AND on the near-black
            // dark one. A raw black-alpha would vanish on the second — the
            // StateCard defect, which is not repeated here.
            borderColor: isDark ? 'var(--rm-primary, #F26A1B)' : 'var(--rm-text, #1C2D4D)',
            background: isDark ? 'var(--rm-primary, #F26A1B)' : 'transparent',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
            padding: 0,
            transition: 'background 200ms ease, border-color 200ms ease, opacity 150ms ease',
          }}
        >
          {/* THE KNOB. On the ON track it sits on `primary`, so its colour is
              --rm-on-primary — the token derived against primary for exactly
              this, added in Phase 1a. Off-track it is the text token. */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: 3, left: isDark ? 25 : 3,
              width: 22, height: 22, borderRadius: '50%',
              background: isDark ? 'var(--rm-on-primary, #000000)' : 'var(--rm-text, #1C2D4D)',
              opacity: isDark ? 1 : 0.55,
              transition: 'left 200ms ease, background 200ms ease, opacity 200ms ease',
            }}
          />
        </button>
      </div>

      {/* ⚠ role="alert" SO IT IS ANNOUNCED, NOT ONLY DRAWN. A failure the person
          cannot see is the silent revert in a different costume. */}
      {failure && (
        <p
          role="alert"
          data-rep-theme-error=""
          style={{
            margin: '0 0 14px',
            fontSize: 14, lineHeight: 1.45,
            color: 'var(--rm-danger-text, #B91C1C)',
          }}
        >
          {failure}
        </p>
      )}

      <div
        aria-hidden="true"
        style={{ height: 1, background: 'var(--rm-text, #1C2D4D)', opacity: 0.12 }}
      />
    </div>
  );
}
