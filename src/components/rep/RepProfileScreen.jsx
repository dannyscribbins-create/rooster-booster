import { useEffect, useState } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';
import RepThemeToggleRow from './RepThemeToggleRow';

// ─── THE PROFILE SCREEN — mockup 6, completed in Canvass-8 ──────────────────
//
// Canvass-2 (3-A) shipped this screen far enough to carry the theme row and Sign
// out. Canvass-8 adds what mockup 6 draws above them: the avatar, the Title control
// and Attribution type. **It ADDS above; it rebuilds nothing.**
//
// ⚠ A30's ANCHOR IS NOT NEGOTIABLE AND IS THE REASON FOR THE ORDER HERE. The theme
// row sits DIRECTLY above Sign out, so every row this phase adds goes ABOVE the theme
// row rather than between it and Sign out. `repProfileScreen.test.jsx` asserts the
// adjacency from this side and `repThemeToggle.test.jsx` asserts it from the shell's;
// both fail if a row is ever inserted into that gap.
//
// ⚠ TWO ROWS THE MOCKUP DRAWS DO NOT SHIP, AND NEITHER IS AN OVERSIGHT:
//   · **Fallback link** — CD-8 voided the mockup's example value, and nothing mints a
//     rep link at all: `contractor_invite_links.owner_team_member_id` has ZERO writers
//     repo-wide, and the `link_type='rep'` mint is 3d's. A row with a placeholder
//     would tell a rep they have a link they do not have.
//   · **Security** — A34.9. There is no self-service change-password route anywhere in
//     this codebase, for any role; a password is written only on invite acceptance and
//     credential recovery. Shipping the row means shipping a new authenticated write
//     path, which A24.7 assigns elsewhere. **Re-verified in Canvass-8 and still true.**
//
// ⚠ AND REVENUE VISIBILITY GETS NO ROW IN EITHER STATE. `rep_revenue_visibility`
// reaches this component and is deliberately not rendered: a row reading "Revenue:
// hidden" tells a rep they are being denied something, which is exactly the
// lock-by-omission the Home stat grid already refuses (A34.6, CD-7). Revenue is
// absent from the rep surface entirely until Wave 1.5/1.6.
//
// ⚠ CAPABILITIES ARRIVE AS A PROP, NEVER FROM useRepCapabilities(). RepShell is a
// LEAF with respect to RepCapabilitiesContext, on purpose — `repThemeToggle.test.jsx`
// mounts the shell BARE and clicks through to this screen, and the hook throws
// outside its provider by design. Calling it here would take that suite red and
// remove the state the seam test exists to assert on. `caps` is therefore nullable,
// and every read below tolerates its absence rather than assuming a provider.

const MUTED = 0.72;

// Initials from a full name. ⚠ RETURNS '' RATHER THAN A PLACEHOLDER when the name is
// absent: a name is identity-bearing, and "??" or "NA" in an avatar is a fabricated
// value on a white-label surface. An empty disc is a non-claim.
function initialsOf(fullName) {
  if (typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase();
}

// ── ⚠ `infoSlot` RESERVES ROOM AND BUILDS NO MECHANISM (Canvass-9a, Part 6b) ──
//
// The brief asks for room to the RIGHT OF THE LABEL for an info icon, and says in terms
// that the icon and its popup are 9b's. So this makes the label half a flex ROW with a
// gap instead of a bare span — an icon becomes one child here and nothing reflows.
//
// ⚠ IT RENDERS NOTHING TODAY, AND THAT IS THE POINT RATHER THAN AN UNFINISHED EDGE.
// A29 already ruled this exact shape for the bottom nav's FAB slot: a control that is
// present but inert — disabled, greyed, tooltipped, wired to a no-op — reads as an
// oversight, and the next person to see it enables it. **An absent control is a
// decision.** The slot is a layout property, not a placeholder: there is no element, no
// reserved width, and no empty box.
function Row({ label, children, testId, infoSlot = false }) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '14px 0',
        borderBottom: `1px solid ${elevationVar('border')}`,
        fontFamily: fontVar('body'),
      }}
    >
      <div
        data-rep-row-label=""
        data-rep-info-slot={infoSlot ? 'true' : 'false'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)' }}>
          {label}
        </span>
        {/* 9b's info icon mounts HERE. Nothing else changes when it does. */}
      </div>
      <div style={{ minWidth: 0, textAlign: 'right' }}>{children}</div>
    </div>
  );
}

// ── THE ATTRIBUTION PILL ────────────────────────────────────────────────────
//
// ⚠ THE POSITIVE STATE IS FILLED IN THE BRAND PRIMARY, AS THE BRIEF SPECIFIES, AND THE
// NEGATIVE STATE IS DELIBERATELY NOT. A brand-primary badge is an affirmation — it is
// the colour this app uses for the thing you tapped and the thing that is true — and
// putting a RESTRICTION in it would announce a limitation as though it were a feature.
// The negative takes the unfilled treatment `StatusPill` already uses for
// "Provisional", so the two surfaces agree about what an unfilled pill means.
//
// ⚠ `--rm-on-primary` IS THE INK, NEVER A LITERAL WHITE. It is COMPUTED under a
// contrast floor against whatever the primary fill turns out to be, and the platform
// primary is the orange #F26A1B whose floored pair is **BLACK**. White-on-orange is
// what it looks like it should be and is not what mounts; `themeKeyIntegrity` fails on
// the plausible answer and has already caught exactly this on the avatar in this file.
//
// ⚠ THE null STATE GETS NO PILL AT ALL. `caps` is null until `/api/admin/me` lands, so
// `attributable` is genuinely unknown for the first frame — and a pill in either
// direction would be a claim about the rep's configuration made before the answer
// arrived. An em dash says "not known yet" and claims nothing, which is the same
// reasoning `initialsOf()` uses for an empty avatar.
//
// ── ⚠ IT SITS VALUE-RIGHT, NOT CENTRED, AND THAT IS A34's A30 OVERRIDING THE BRIEF ──
// The brief asks for the pill "centred under the Title control". **A30 rules this row's
// alignment in terms** — *"Label left, control right, matching Title, Attribution type,
// Fallback link and Security, which all read label-left / value-right"* — and it names
// Attribution type as one of the four rows that establish the rhythm. Centring this one
// value would break the alignment A30 derived from the mockup's own row rhythm, and
// would leave a right-aligned `<select>` directly above a centred pill.
// **The ruling governs the brief on a question the ruling already answered** (CLAUDE.md,
// Mockup precedence: the dated rulings win on behaviour and placement). The pill IS
// directly under the Title control, in the same value column — which is the part of the
// instruction that survives the ruling. ⚠ Raised rather than silently resolved: if Danny
// wants it genuinely centred, that is an A30 amendment and not a styling tweak.
function AttributionPill({ attributable }) {
  if (attributable === null) {
    return (
      <span style={{ fontSize: 15, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: fontVar('body') }}>
        —
      </span>
    );
  }

  const positive = attributable === true;
  return (
    <span
      data-rep-attribution-pill=""
      data-attributable={positive ? 'true' : 'false'}
      style={{
        display: 'inline-block',
        fontSize: 13, fontWeight: 600, lineHeight: 1.2,
        padding: '5px 11px', borderRadius: 999,
        fontFamily: fontVar('body'),
        background: positive ? 'var(--rm-primary, #F26A1B)' : 'transparent',
        color: positive ? 'var(--rm-on-primary, #000000)' : 'var(--rm-text, #1C2D4D)',
        // `currentColor` so the border cannot drift from the text it outlines — the
        // same reasoning StatusPill records for its own border.
        border: positive ? '1px solid transparent' : '1px solid currentColor',
      }}
    >
      {positive ? 'Matches credited to you' : 'Matches not credited to you'}
    </span>
  );
}

export default function RepProfileScreen({ onLogout, caps = null, switcher = null }) {
  const [titles, setTitles] = useState([]);
  // `selected` is the COMMITTED value — it moves only after the server agrees.
  const [selected, setSelected] = useState(
    caps && caps.title_id != null ? String(caps.title_id) : ''
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Follow the capability once it resolves. `/api/admin/me` lands after first paint,
  // so title_id is null on the first render of a rep who does have a title.
  useEffect(() => {
    if (caps && caps.title_id != null) setSelected(String(caps.title_id));
  }, [caps && caps.title_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTitles = safeAsync(async () => {
    const token = getAdminToken();
    const res = await fetch(`${BACKEND_URL}/api/admin/titles`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`titles: HTTP ${res.status}`);
    const data = await res.json();
    // ⚠ Array.isArray, NOT a truthiness test — the guard matches THIS value's own
    // shape. An object is truthy and has no .map, and a permissive test stub returns
    // one. The sibling reads in this file guard differently because their values are
    // differently shaped; that is deliberate, not an inconsistency.
    setTitles(Array.isArray(data) ? data : []);
  }, 'RepProfileScreen/loadTitles');

  useEffect(() => { loadTitles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ⚠ NOT OPTIMISTIC, AND THAT IS A DECISION RATHER THAN A DEFAULT. This is the ONLY
  // write on the rep surface, and what it writes is the rep's own identity shown back
  // to them. An optimistic value that silently fails reads as saved until the next
  // load contradicts it — a lie the screen tells about the rep. The control shows a
  // brief saving state instead and reverts on failure.
  function onPick(e) {
    const next = e.target.value;
    const previous = selected;
    if (next === previous) return;
    setSaving(true);
    setMessage(null);

    safeAsync(async () => {
      try {
        const token = getAdminToken();
        const res = await fetch(`${BACKEND_URL}/api/admin/me/title`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ title_id: next === '' ? null : Number(next) }),
        });

        if (res.ok) {
          setSelected(next);
          setMessage(null);
          return;
        }

        // ⚠ ONE STATUS CODE, TWO MEANINGS, AND THE COPY MUST SERVE THE LIKELY ONE.
        // The server returns 403 `invalid_title` both for a title belonging to another
        // contractor AND for one an admin DELETED between this screen loading and the
        // rep saving — `DELETE /api/admin/titles/:id` nulls affected members and
        // leaves the id dangling. A rep hitting the second case has done nothing
        // forbidden, so permission language would be alarming and wrong. Say the title
        // is gone, and refresh the list so the screen stops offering it.
        if (res.status === 403) {
          setMessage('That title is no longer available. The list has been refreshed.');
          loadTitles();
          return;
        }
        setMessage('Could not save your title. It has not been changed.');
      } catch {
        setMessage('Could not reach the server. Your title has not been changed.');
      } finally {
        setSaving(false);
      }
    }, 'RepProfileScreen/saveTitle')();
  }

  const attributable = caps ? caps.is_attributable === true : null;

  return (
    <>
      {/* ⚠ NO SUBTITLE (Canvass-9a, Part 6a). It read "Self-service settings", and
          Danny's note is that the title already says it. It was also the weaker kind of
          subtitle — a description of the screen's CATEGORY rather than a fact about its
          contents, which is the one kind that earns its line. Home's and Clients'
          subtitles survive because they now carry the timeframe window, which is
          information the heading cannot give. */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: 0, fontFamily: fontVar('heading'),
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Profile
        </h1>
      </div>

      {/* The avatar disc — mockup 6 draws it centred and filled with the action
          colour. `--rm-primary` is the button fill by B-1's routing, and
          `--rm-on-primary` is the computed contrast pair for it, so the initials are
          legible on any contractor's palette rather than on a chosen one. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
        <div
          data-testid="rep-avatar"
          aria-hidden="true"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--rm-primary, #F26A1B)',
            // ⚠ #000000, NOT #FFFFFF — AND THE FENCE CAUGHT ME WRITING THE PLAUSIBLE
            // ONE. `--rm-on-primary` is COMPUTED under a contrast floor against the
            // primary fill, and the platform primary is the orange #F26A1B, whose
            // floored pair is BLACK. White initials on orange is what it looks like it
            // should be and is not what mounts. A fallback must be the value the
            // provider will actually produce; themeKeyIntegrity names the expected one
            // when it fires.
            color: 'var(--rm-on-primary, #000000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fontVar('heading'), fontSize: 26, fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {initialsOf(caps && caps.full_name)}
        </div>
        {caps && caps.full_name ? (
          <p style={{
            margin: '10px 0 0', fontSize: 17, fontWeight: 700,
            color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body'),
          }}>
            {caps.full_name}
          </p>
        ) : null}
      </div>

      {/* ── TITLE (A28) — a select over the contractor's seeded rows, never free text ── */}
      <Row label="Title" testId="rep-title">
        <select
          data-rep-title-select=""
          aria-label="Title"
          value={selected}
          disabled={saving}
          onChange={onPick}
          style={{
            font: 'inherit', fontSize: 15,
            color: 'var(--rm-text, #1C2D4D)',
            background: 'var(--rm-surface, #FFFFFF)',
            border: `1px solid ${elevationVar('border')}`,
            borderRadius: 8, padding: '6px 8px', maxWidth: '100%',
          }}
        >
          {/* ⚠ THE PLACEHOLDER IS A REAL OPTION, NOT A DISABLED LABEL. title_id is
              NULL for every seeded member, so "no title" is the common first state
              and must also be RE-SELECTABLE — the server accepts null explicitly. */}
          <option value="">No title set</option>
          {titles.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      </Row>

      {/* ── ATTRIBUTION TYPE — display only, from the capability seam ─────────
          ⚠ A PILL, NOT A SENTENCE (Canvass-9a, Part 6b). The sentence was up to 54
          characters in a right-aligned value column on a 430px screen, so it wrapped to
          three lines and pushed the row to nearly three times the height of Title
          beside it. A pill is one line by construction.
          ⚠ AND IT MUST BE TRUE ON ITS OWN, WHICH IS THE CONSTRAINT THAT PICKED THE COPY.
          The info popup 9b adds will say "Clients matched to you through any means are
          credited to you" — that adds DEPTH, and it must never be what rescues an
          overstated label. Same principle the conversions card records: a rep who never
          taps the icon must not be misled. "Matches credited to you" says whose, and
          what happens, and claims nothing about the mechanism that the popup then
          explains. */}
      <Row label="Attribution type" testId="rep-attribution" infoSlot>
        <AttributionPill attributable={attributable} />
      </Row>

      {/* ⚠ role="status" NOT role="alert". A failed save is worth announcing and is
          not an emergency; `alert` interrupts a screen reader mid-sentence. The
          rendered tone is the text-safe danger token, never a literal. */}
      {message && (
        <p
          role="status"
          style={{
            margin: '12px 0 0', fontSize: 14, lineHeight: 1.5,
            color: statusVar('dangerText'), fontFamily: fontVar('body'),
          }}
        >
          {message}
        </p>
      )}

      {/* ⚠ EVERYTHING ABOVE THIS LINE IS CANVASS-8'S. EVERYTHING BELOW IT IS A30's
          ANCHOR AND MUST STAY ADJACENT — theme row, then Sign out, nothing between. */}
      <div style={{ height: 20 }} aria-hidden="true" />
      <RepThemeToggleRow />

      {/* ── ⚠ SIGN OUT IS ISOLATED (Canvass-9a, Part 6c) ────────────────────
          It was touching the theme row's bottom hairline — `padding: 0` and no margin,
          directly under a `borderBottom` — so it read as one more row in the list rather
          than as the one destructive action on the screen. **The adjacency A30 requires
          is ORDER, not proximity**: "directly above Sign out" means nothing may be
          inserted between them, and it says nothing about the gap. Nothing is inserted.
          ⚠ THE PADDING IS ON THE BUTTON, NOT ONLY ABOVE IT, and that is a touch-target
          fix as much as a visual one: at `padding: 0` this control's hit area was the
          height of its own text — about 19px on a phone, well under the ~44px a thumb
          needs — for the single action on this screen that ends the session. A
          mis-tapped Sign out is a full re-authentication, and on this stack that is a
          PIN the rep may not have to hand. */}
      <div style={{ height: 28 }} aria-hidden="true" />

      {/* ── ⚠ THE ACCOUNT ROW — SWITCHER LEFT, SIGN OUT RIGHT (9b Part 0b) ──
          Ruled by Danny: the surface switcher moves here from the shell chrome,
          to the LEFT of Sign out. It was costing a 58px row on all four tabs for
          a rare, account-level action.

          ⚠ A30'S ANCHOR IS INTACT, AND THE READING MATTERS. A30 requires the
          theme toggle DIRECTLY ABOVE Sign out with nothing inserted between, and
          Sign out LAST. Its subject is the ROW LIST — Title, Attribution type,
          Fallback link, Security, theme toggle, Sign out. **The switcher joins
          Sign out's row rather than becoming a row of its own**, so the theme row
          is still directly above the Sign-out row and that row is still last. No
          row was inserted. `repProfileScreen.test.jsx` asserts both halves.

          ⚠ AND IT MUST NOT READ AS SUBORDINATE TO SIGN OUT, WHICH IS A REAL RISK
          OF PUTTING IT BESIDE A DESTRUCTIVE ACTION. Three things answer it, and
          none is "make it bigger":
            · **It is the only BORDERED control on this screen.** SurfaceSwitcher's
              rep variant is an outlined button with an icon; Sign out is bare text
              with no border and no background. The switcher is visually the
              stronger object in the row, which is the opposite of subordinate.
            · **It leads in reading order** — left, and first in the DOM, so a
              screen reader reaches it before the destructive action.
            · **`flexShrink: 0` on it**, so when the row runs out of width it is
              SIGN OUT that wraps, never the switcher that gets squeezed. A
              control compressed to fit beside a bigger neighbour is exactly how
              "subordinate" gets built by accident.

          ⚠ `justifyContent: space-between` WITH ONE CHILD PUTS IT AT FLEX-START,
          which is why a general-tier rep — who receives `switcher === null` — sees
          Sign out in exactly the position it occupied before this change. */}
      <div
        data-rep-account-actions=""
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        {/* ⚠ RENDERED ONLY WHEN App.jsx SUPPLIED ONE. Eligibility is decided there,
            once, against the live session — `canSwitchSurface()` is
            `role === 'team' && is_field_rep`. A general-tier rep who is NOT a field
            rep, and any referrer, gets null and no control. Deciding it here would
            be a second copy of that predicate with no way to stay current. */}
        {switcher && (
          <div data-rep-switcher-slot="" style={{ flexShrink: 0 }}>
            {switcher}
          </div>
        )}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          data-rep-signout=""
          style={{
            background: 'none', border: 'none',
            padding: '14px 0',
            font: 'inherit', cursor: 'pointer', textAlign: 'left',
            fontWeight: 700, fontSize: 16,
            // ⚠ `statusVar('dangerText')`, NOT A HAND-WRITTEN `var(--rm-danger-text, …)`.
            // This read the raw custom property with its own literal fallback, which is
            // the second copy of a value `statusTheme.js` already owns — and the exact
            // shape behind the recorded 1.34:1 login-screen defect, where a fallback was
            // a plausible tint rather than the value that mounts. Flagged on reading this
            // file, per CLAUDE.md's silent-audit rule, and fixed here because the line was
            // already being edited.
            color: statusVar('dangerText'),
          }}
        >
          Sign out
        </button>
      )}
      </div>
    </>
  );
}
