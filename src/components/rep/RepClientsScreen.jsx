import { useEffect, useState } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';

// ─── THE CLIENTS TAB — the rep's book of business (Canvass-4, A34.4) ─────────
//
// Replaces the shell's "Coming soon" placeholder for this one tab. The layout is
// the mockup's 4a-my-clients-catalogue; the BEHAVIOUR is the dated rulings, and
// where they disagree the ruling governs (CLAUDE.md, Mockup precedence).
//
// ⚠ WHERE THIS DEPARTS FROM THE MOCKUP, AND WHY — RULED 2026-09-18, NOT IMPROVISED:
//   · **The mockup's four assignment sources are QR · Link · Inherited · Manual.**
//     "Inherited" is referral inheritance, which `docs/ASSIGNMENT_RULES_LOCKED.md`'s
//     V1 records as NOT IMPLEMENTED ANYWHERE — re-verified this session. "Link" maps
//     to nothing in the schema. Both are dropped and the REAL vocabulary is used.
//   · **Its four stages** ("Inspection set", "Converted", "Proposal sent") are not our
//     pipeline vocabulary either. Ours is lead → inspection → sold → paid, and DB
//     'paid' renders as "Complete" — the mapping CLAUDE.md keeps resident.
//   · **Its metadata line is already full**, which Canvass-0 §5 recorded, so the
//     membership badge gets its own slot beside the status pill rather than a fifth
//     segment nobody can read.
//   · **It is never drawn empty.** A first-run rep sees exactly that, so the empty
//     state is designed here rather than inherited.
//
// ⚠ NO REVENUE VALUE ANYWHERE ON THIS SCREEN, DELIBERATELY (A34.6). The lock-vs-
// "no revenue recorded yet" distinction is Canvass-5's and it is a SERVER contract —
// A24.4 requires the server to OMIT the value, because a CSS-dimmed figure is still
// in the page and readable in developer tools. Adding a revenue column here would
// pre-commit that contract from a phase with no revenue path to test it against.

// ── THE FADED-TEXT CONSTANT (A34.2) ─────────────────────────────────────────
// ⚠ 0.72, declared file-locally. A34.2 rules that "reuse the existing one" means the
// VALUE and the CONVENTION — there is no module exporting MUTED and inventing one as
// a side effect of building a screen is exactly what that ruling forbids. Ninth site.
const MUTED = 0.72;

// ── THE PIPELINE VOCABULARY ─────────────────────────────────────────────────
// ⚠ DB 'paid' RENDERS AS "Complete" — the mapping CLAUDE.md keeps resident rather
// than in a scoped file. The other three are their own labels.
// ⚠ A MISSING STAGE IS NOT A STAGE. A client with no pipeline_cache row has no
// referral record, and saying so is honest where inventing "Lead" would not be —
// that client may be anywhere in the job pipeline; we simply have no referral view
// of them. This is A34.4's whole-book ruling reaching the copy.
const STAGE_LABELS = Object.freeze({
  lead: 'Lead',
  inspection: 'Inspection',
  sold: 'Sold',
  paid: 'Complete',
  not_sold: 'Not sold',
});
const NO_STAGE_LABEL = 'No referral record';

// ── ASSIGNMENT SOURCES — the real enum, not the mockup's ────────────────────
// Values come from client_rep_assignments' two CHECK constraints:
//   sticky_source      quote_salesperson · promoted_provisional · mode_a_at_close ·
//                      mode_b_at_close · manual
//   provisional_source mode_a · mode_b · qr_link
// ⚠ 'qr_link' IS IN THE CONSTRAINT AND IS WRITTEN BY NOTHING TODAY — the mint is 3d's.
// It is labelled here anyway so the label lands with the writer rather than after it.
const SOURCE_LABELS = Object.freeze({
  quote_salesperson: 'Quote',
  promoted_provisional: 'Promoted',
  mode_a_at_close: 'Assessment',
  mode_b_at_close: 'Salesperson',
  manual: 'Manual',
  mode_a: 'Assessment',
  mode_b: 'Salesperson',
  qr_link: 'QR',
});

function formatAssignedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── THE STATUS PILL ─────────────────────────────────────────────────────────
// Three states, where the mockup drew two. "Provisional" is the one it assumes
// away: an assignment that has not yet passed the sticky gate is real, common, and
// materially different from a locked one — a rep should not read it as settled.
//
// ⚠ NO TINT FILL, AND THAT IS A RULING RATHER THAN A STYLE PREFERENCE. The first
// draft of this pill put `warningText` on `STATUS_TINT.warning`, which that table's
// own entry forbids in terms: *"it has NO text consumer and must not gain one"* —
// measured at **4.42:1**, under the 4.5 floor. `STATUS_TINT` is an icon-badge ground.
// So the pill is unfilled and sits on the CARD's `--rm-surface`, where both text
// tokens are floored and measured: `successText` #137639 at **5.71:1**, `warningText`
// #B45309 at **4.87:1**.
// ⚠ THE BORDER IS `currentColor` SO IT CANNOT DRIFT FROM THE TEXT. A border is a
// graphic element answering the 3:1 floor, and both tokens clear that with room; tying
// it to the text means one value can never be changed without the other.
function StatusPill({ isFlagged, isSticky }) {
  const spec = isFlagged
    ? { label: 'Flagged', fg: statusVar('warningText') }
    : isSticky
      ? { label: 'Locked', fg: statusVar('successText') }
      : { label: 'Provisional', fg: 'var(--rm-text, #1C2D4D)' };

  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 600, lineHeight: 1,
        padding: '4px 9px', borderRadius: 999,
        color: spec.fg,
        border: '1px solid currentColor',
        background: 'transparent',
        fontFamily: fontVar('body'),
      }}
    >
      {spec.label}
    </span>
  );
}

// ── THE MEMBERSHIP BADGE (ruling, Danny 2026-09-18) ─────────────────────────
//
// THREE STATES, TWO OF WHICH RENDER. 'confirmed' and 'invited' each get a badge;
// EVERYTHING ELSE RENDERS NOTHING AT ALL.
//
// ⚠ THIS COMPONENT RETURNS null AND RESERVES NO SPACE, AND THAT IS THE RULING
// RATHER THAN A LAYOUT CHOICE. A34.4's D4 clause forbids showing a client who MAY
// have signed up as a confirmed "not signed up", and states 2/3/4 of A24.5's
// four-state space are indistinguishable — a peer signup who was never matched looks
// identical to someone who never signed up. **An empty slot in a consistent position
// becomes a negative claim by convention**, so there is no slot: the row simply has
// one fewer element. Do not add a placeholder, a dash, or a reserved width.
//
// ⚠ 'invited' IS NOT A CLAIM ABOUT THE ACCOUNT — it is a record of what the REP did,
// which is exactly why it is safe where "no app account on file" is not. The server
// cannot produce it yet (nothing records a per-client rep send; see the route's own
// note and the checklist entry). It is built and tested here so the badge is proven
// rather than hypothetical — a slot that has never rendered cannot be trusted to
// render when 3d lights it.
function MembershipBadge({ membership }) {
  if (membership !== 'confirmed' && membership !== 'invited') return null;

  // Same unfilled treatment and the same reason as StatusPill — see its note on
  // STATUS_TINT. 'Invited' reads on `--rm-text`, which the derivation floors against
  // `surface` by construction, so it needs no separate measurement per brand.
  const spec = membership === 'confirmed'
    ? { label: 'In app', fg: statusVar('successText') }
    : { label: 'Invited', fg: 'var(--rm-text, #1C2D4D)' };

  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11, fontWeight: 600, lineHeight: 1,
        padding: '3px 8px', borderRadius: 999,
        color: spec.fg,
        border: '1px solid currentColor',
        background: 'transparent',
        fontFamily: fontVar('body'),
      }}
    >
      {spec.label}
    </span>
  );
}

// ── ONE ROW ─────────────────────────────────────────────────────────────────
// The mockup's thick left border carries the state: the action colour normally,
// the warning colour when flagged. ⚠ The colour comes from the tokens, never from
// the mockup's literal orange — that PNG is RoofMiles-branded and this surface is
// white-label.
function ClientRow({ client }) {
  const stage = client.stage ? (STAGE_LABELS[client.stage] || client.stage) : NO_STAGE_LABEL;
  const source = SOURCE_LABELS[client.assignmentSource] || client.assignmentSource || null;
  const assigned = formatAssignedAt(client.assignedAt);

  // Built as a list so a missing segment collapses instead of leaving a stray
  // separator — the ' · '.join a template literal would have to fake.
  const meta = [stage, assigned ? `Assigned ${assigned}` : null, source].filter(Boolean);

  return (
    <li
      style={{
        listStyle: 'none',
        background: 'var(--rm-surface, #FFFFFF)',
        border: elevationVar('border') ? `1px solid ${elevationVar('border')}` : undefined,
        borderLeft: `4px solid ${client.isFlagged ? statusVar('warning') : 'var(--rm-primary, #F26A1B)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 10,
        fontFamily: fontVar('body'),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 16, fontWeight: 700,
            color: 'var(--rm-text, #1C2D4D)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {client.name}
        </span>
        <MembershipBadge membership={client.membership} />
        <StatusPill isFlagged={client.isFlagged} isSticky={client.isSticky} />
      </div>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 13, lineHeight: 1.4,
          color: 'var(--rm-text, #1C2D4D)',
          opacity: MUTED,
        }}
      >
        {meta.join(' · ')}
      </p>
    </li>
  );
}

// ── THE EMPTY STATE ─────────────────────────────────────────────────────────
//
// ⚠ DELIBERATELY NOT StateCard/EmptyState, AND THIS IS A MEASURED DECISION RATHER
// THAN AN OVERSIGHT. Canvass-0 S11, re-measured at this HEAD: `StateCard`'s
// CARD_EDGE still reads bare `R.border` and `R.shadow` — unmigrated — and its only
// importer anywhere is `src/components/dev/PaletteHarnessRoute.jsx`. **This screen
// would be its first production consumer.** `R.border` measures 1.19:1 on the light
// surface and 1.02:1 on dark, against a component whose own header states "the edge
// IS the card"; and those figures were taken on `surface`, while A34.1 puts this
// column on `recess`, so a token floored against one ground is not floored here.
// Restyling a shared primitive four components depend on is not this phase's call,
// so this card carries the screen's own edge and the measurement is filed instead.
//
// ⚠ IT SAYS NOTHING ABOUT WHETHER CLIENTS EXIST ELSEWHERE. A rep with an empty book
// has not been assigned anyone yet; that is not an error, and it is not a claim about
// the contractor's client list.
// ⚠ NO CARD CHROME, AND THE REASON IS A MEASUREMENT TAKEN ON THIS SCREEN RATHER THAN
// A PREFERENCE. The first draft drew this as a card, matching the rows. Measured
// RENDERED on palette-beta with transitions suppressed and the shader hidden:
//   light  card fill vs column 1.08:1 · hairline vs fill 1.32:1
//   dark   card fill vs column 1.41:1 · hairline vs fill 1.76:1
// A CLIENT ROW survives those numbers because its 4px LEFT BORDER carries the edge —
// 5.87:1 light, 5.27:1 dark. **The empty state has no left border**, so the card was a
// box nobody can see: a false affordance, and precisely the "the edge IS the card"
// failure this repo records against StateCard. Removing the chrome is honest; the
// heading is what tells a rep this is a state rather than a failed render.
// Text carries it, and text is floored: full-opacity `--rm-text` on recess measured
// 11.16:1 light / 18.45:1 dark, and the MUTED line 4.97:1 / 9.67:1.
function EmptyBook() {
  return (
    <div style={{ padding: '24px 4px', textAlign: 'center', fontFamily: fontVar('body') }}>
      <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)' }}>
        No clients yet
      </p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>
        Clients appear here once a request in Jobber is assigned to you.
      </p>
    </div>
  );
}

export default function RepClientsScreen() {
  const [state, setState] = useState({ status: 'loading', clients: [], total: 0, limit: 0 });

  useEffect(() => {
    let live = true;
    // ⚠ safeAsync, NOT a bare IIFE. A component that renders successfully and throws
    // LATER — in an effect, a settled promise — is invisible to ErrorBoundary, which
    // catches render-phase throws only. An unwrapped async IIFE reaches no log at all.
    safeAsync(async () => {
      try {
        // ⚠ THE SANCTIONED ACCESSOR, NOT A RAW localStorage READ. The key is
        // `rb_admin_token` and a hand-written literal here would be a second,
        // silently-wrong copy of it — the first draft of this file had exactly that.
        const token = getAdminToken();
        const res = await fetch(`${BACKEND_URL}/api/rep/clients`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`rep clients: HTTP ${res.status}`);
        const data = await res.json();
        if (!live) return;
        setState({
          status: 'ready',
          clients: Array.isArray(data.clients) ? data.clients : [],
          total: Number.isFinite(data.total) ? data.total : 0,
          limit: Number.isFinite(data.limit) ? data.limit : 0,
        });
      } catch {
        if (live) setState((s) => ({ ...s, status: 'error' }));
      }
    }, 'RepClientsScreen/load')();
    return () => { live = false; };
  }, []);

  const { status, clients, total, limit } = state;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontFamily: fontVar('heading'),
            fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
            color: 'var(--rm-text, #1C2D4D)',
          }}
        >
          My Clients
        </h1>
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)' }}>
          Book of business
        </p>
      </div>

      {status === 'loading' && (
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
          Loading your clients…
        </p>
      )}

      {status === 'error' && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: statusVar('dangerText'), fontFamily: fontVar('body') }}>
          Could not load your clients. Pull down to try again.
        </p>
      )}

      {status === 'ready' && clients.length === 0 && <EmptyBook />}

      {status === 'ready' && clients.length > 0 && (
        <>
          <ul style={{ margin: 0, padding: 0 }}>
            {clients.map((c) => <ClientRow key={c.jobberClientId} client={c} />)}
          </ul>
          {/* ⚠ THE HONEST COUNT. A bounded page that does not say it is bounded reads
              as a complete list, which is the "reports health it cannot observe" shape
              arriving as a silently truncated list. Rendered ONLY when there is more
              than one page, so a rep with nine clients is not told about paging that
              does not affect them. */}
          {total > clients.length && (
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
              Showing {clients.length} of {total} — most recently assigned first.
            </p>
          )}
        </>
      )}
    </>
  );
}

export { STAGE_LABELS, SOURCE_LABELS, NO_STAGE_LABEL, MembershipBadge, StatusPill, EmptyBook, formatAssignedAt };
