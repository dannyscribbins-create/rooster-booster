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

function Row({ label, children, testId }) {
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
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ minWidth: 0, textAlign: 'right' }}>{children}</div>
    </div>
  );
}

export default function RepProfileScreen({ onLogout, caps = null }) {
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: '0 0 4px', fontFamily: fontVar('heading'),
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Profile
        </h1>
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)' }}>
          Self-service settings
        </p>
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

      {/* ── ATTRIBUTION TYPE — display only, from the capability seam ───────── */}
      <Row label="Attribution type" testId="rep-attribution">
        <span style={{ fontSize: 15, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: fontVar('body') }}>
          {attributable === null
            ? '—'
            : attributable
              ? 'Attributable — clients matched to you are credited to you'
              : 'Not attributable — clients are not credited to you'}
        </span>
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

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          data-rep-signout=""
          style={{
            background: 'none', border: 'none', padding: 0,
            font: 'inherit', cursor: 'pointer', textAlign: 'left',
            fontWeight: 700, fontSize: 16,
            color: 'var(--rm-danger-text, #B91C1C)',
          }}
        >
          Sign out
        </button>
      )}
    </>
  );
}
