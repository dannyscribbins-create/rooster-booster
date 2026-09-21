import { useEffect, useState } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';
import RepTimeframeBar, { TIMEFRAME_PHRASES } from './RepTimeframeBar';
import { useRowPress, RowChevron } from './repRowAffordance';

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
// ⚠ THIS LABEL NO LONGER APPEARS IN THE LIST, AND THE RULING IS "SHOW NOTHING"
// (Canvass-9a, Part 4d). It is still exported and still rendered on the DETAIL screen,
// where a named "Pipeline stage" section with nothing in it would be worse than a
// sentence saying why.
//
// **Ruled by Danny: a list row with no referral record says nothing at all.** This is
// the membership-badge principle reaching the stage segment — a referred client says
// who referred them and everyone else says nothing. ⚠ MOST OF A BOOK IS DIRECT
// CLIENTS (measured: 264 of 272 rows on the seeded fixture have no pipeline row), so
// the label was repeated text on almost every row that told a rep nothing actionable.
//
// ⚠ AND A LABEL ON EVERY ROW IS WHAT MAKES IT INVISIBLE ANYWAY. A string that never
// varies stops being read, so it cost a line of vertical space per row and carried no
// information — while the eight rows where a stage DOES exist were the ones it made
// harder to spot.
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
// ── ⚠ WHAT A ROW CARRIES, AFTER CANVASS-9a: NAME · BADGES · STAGE IF ANY · DATE ──
//
// **TWO SEGMENTS WERE REMOVED BY RULING, AND NEITHER IS A SIMPLIFICATION I CHOSE.**
//
//   · **THE SOURCE IS GONE** (Part 4c). "· Quote", "· Assessment" — Danny: redundant,
//     since the source appears in the detail, and not the information he wants at a
//     glance. `SOURCE_LABELS` is still exported and still used by the DETAIL screen,
//     where it answers a question the rep went looking for.
//   · **A MISSING STAGE NOW RENDERS NOTHING** (Part 4d), rather than the words "No
//     referral record". See NO_STAGE_LABEL's own note for the ruling and the measured
//     reason — it was repeated text on 264 of 272 rows.
//
// ⚠ AND THE ROW HAD TO BE CHECKED FOR READING DELIBERATELY WITH BOTH GONE, WHICH THE
// BRIEF ASKS FOR IN TERMS. The worst case is a direct client with no stage: the meta
// line becomes the single segment "Assigned Sep 15". **That is a complete sentence-like
// fragment rather than a fragment of a longer one** — there is no leading separator, no
// trailing "·", and no empty space where something used to be, because the line is
// built by joining a FILTERED list rather than by interpolating slots. A row that
// failed to load would show an empty meta line; this one shows a date, which is the
// distinction the brief is asking about.
function ClientRow({ client, onOpen }) {
  const { pressed, pressHandlers, pressStyle } = useRowPress();
  const stage = client.stage ? (STAGE_LABELS[client.stage] || client.stage) : null;
  const assigned = formatAssignedAt(client.assignedAt);

  // Built as a list so a missing segment collapses instead of leaving a stray
  // separator — the ' · '.join a template literal would have to fake.
  //
  // ⚠ 'Referral' IS A TEXT SEGMENT AND NOT A THIRD PILL (Ruling 2, Danny 2026-09-21),
  // AND THE ROW IS WHY. It already carries two pills — MembershipBadge and StatusPill —
  // and a third chip of the same shape is precisely the collision the ruling guards
  // against: the rep must be able to tell "where is the sale" from "is this from my
  // network" at a glance, and three similar chips make that harder, not easier.
  // ⚠ SO THE TWO CHANNELS ARE: the STAGE, identical plain text for every client because
  // "Sold" means the same thing however the client arrived; and the REFERRAL marker,
  // which never touches the stage's colour, shape or wording.
  // ⚠ AND NOTHING RENDERS FOR A DIRECT CLIENT. Danny's standing principle — no badge
  // unless it IS a referral — held; only its FORM changed, from a badge to text. A
  // "Direct" label would put a word on the majority of rows to announce that nothing
  // had happened, which is the reserved-slot failure the membership ruling already
  // forbids one line up.
  const meta = [
    stage,
    client.isReferred ? 'Referral' : null,
    assigned ? `Assigned ${assigned}` : null,
  ].filter(Boolean);

  return (
    <li
      onClick={onOpen ? () => onOpen(client.jobberClientId) : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(client.jobberClientId); } } : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      data-rep-row-pressed={onOpen && pressed ? 'true' : 'false'}
      {...(onOpen ? pressHandlers : {})}
      style={{
        listStyle: 'none',
        cursor: onOpen ? 'pointer' : undefined,
        // ⚠ PRESSED PRESSES *DOWN* TO `--rm-recess` HERE, WHICH IS THE OPPOSITE
        // DIRECTION FROM HOME'S FOCUS ROWS — and it is the same rule. These rows are
        // CARDS sitting on `surface`, above a column painted `recess` (A34.1), so
        // swapping to the other ground means going down into the column. Home's rows
        // sit directly on the column and swap up to `surface`. ⚠ `--rm-text` is floored
        // against BOTH grounds, which is what makes either direction safe without a
        // per-brand measurement.
        background: onOpen && pressed ? 'var(--rm-recess, #ECF0F8)' : 'var(--rm-surface, #FFFFFF)',
        border: elevationVar('border') ? `1px solid ${elevationVar('border')}` : undefined,
        borderLeft: `4px solid ${client.isFlagged ? statusVar('warning') : 'var(--rm-primary, #F26A1B)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 10,
        fontFamily: fontVar('body'),
        // ⚠ LAST, SO IT CANNOT BE OVERWRITTEN by a property above it — and it is a
        // TRANSITION only. `pressStyle` never sets a colour; the ground swap above is
        // still what changes, and this decides only how it settles.
        ...(onOpen ? pressStyle : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* ⚠ THREE NAME STATES, AND THEY ARE NOT INTERCHANGEABLE (Canvass-4b).
            a real name · 'Unnamed client' (we hold the client, it has no name parts) ·
            NAME UNAVAILABLE (we hold no client record at all, only the assignment).
            The third is the one this phase added: those rows used to be dropped by an
            inner join. Its copy states what is true of OUR data and makes no claim about
            the client, and it is rendered at MUTED so it reads as incomplete rather than
            as somebody's name. */}
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 16, fontWeight: 700,
            color: 'var(--rm-text, #1C2D4D)',
            opacity: client.nameUnavailable ? MUTED : 1,
            fontStyle: client.nameUnavailable ? 'italic' : 'normal',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {client.nameUnavailable ? 'Details not available yet' : client.name}
        </span>
        <MembershipBadge membership={client.membership} />
        <StatusPill isFlagged={client.isFlagged} isSticky={client.isSticky} />
        {/* ⚠ ONLY WHEN THE ROW OPENS SOMETHING — see FocusRow's note. */}
        {onOpen && <RowChevron />}
      </div>
      {/* ⚠ THE WHOLE LINE IS CONDITIONAL, NOT JUST ITS SEGMENTS. With the source and
          the no-stage label both gone, a row for a client with no stage AND no
          assignment date has nothing to put here — and an empty `<p>` still occupies
          its line box and its 6px top margin, which is the "something failed to load"
          reading the brief warns against. No segments, no element. */}
      {meta.length > 0 && (
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
      )}
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
// ── ⚠ AND A WINDOWED EMPTY RESULT IS NOT AN EMPTY BOOK (Canvass-9a) ─────────
//
// The copy above is a claim about the REP — "you have not been assigned anyone yet" —
// and the timeframe bar makes it reachable by a rep with 272 clients who tapped
// "Week". Telling that rep their book is empty is simply false, and it is the kind of
// false that makes someone think the app has lost their data.
//
// ⚠ THIS IS THE SAME DISTINCTION A34.6 DRAWS ON THE REVENUE CARD — "you may not see
// this" and "this does not exist yet" must not share a treatment — arriving on a
// different screen. Two different states, two different sentences, and the filtered
// one says how to get back.
function EmptyBook({ timeframe = 'all' }) {
  const filtered = timeframe !== 'all';
  return (
    <div style={{ padding: '24px 4px', textAlign: 'center', fontFamily: fontVar('body') }}>
      <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)' }}>
        {filtered ? 'Nothing in this timeframe' : 'No clients yet'}
      </p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>
        {filtered
          ? 'No clients were assigned to you in this window. Choose All to see your whole book.'
          : 'Clients appear here once a request in Jobber is assigned to you.'}
      </p>
    </div>
  );
}

// ── ⚠ THE BOOK STAT CARDS — LOCKED AND PROVISIONAL ONLY (Part 4a) ───────────
//
// **NOT FLAGGED**, by the same ruling that removed it from Home's grid: Flagged is a
// pill on the rows it applies to, there is no explanatory language for it anywhere in
// the app, and a rep can take no action on a flag an owner resolves. See
// `RepHomeScreen`'s STAT_CARDS note for the full reasoning — it is one ruling, and
// naming it in both places is deliberate rather than duplicated, because the next
// person to add a card will be looking at whichever file they happen to open.
//
// ⚠ AND THESE TWO ARE THE RIGHT PAIR FOR *THIS* SCREEN RATHER THAN A SUBSET OF HOME'S.
// Home answers "how big is my book" and leads with CLIENTS; this screen IS the book, so
// the total is already on it — the count line under the list has rendered it
// unconditionally since Canvass-4b, which was a production bug report. Repeating it in
// a card would be the same number twice on one screen. Locked and Provisional are the
// split that the list's own pills show per row and that nothing else totals.
const BOOK_STAT_CARDS = Object.freeze([
  { key: 'locked', label: 'LOCKED' },
  { key: 'provisional', label: 'PROVISIONAL' },
]);

// ⚠ ITS OWN COMPONENT RATHER THAN AN IMPORT FROM RepHomeScreen, AND THE REASON IS A
// CYCLE. `RepHomeScreen` already imports `STAGE_LABELS` from THIS file; importing
// `StatCard` back from it would close the loop. The two are eleven lines of identical
// presentation, and the honest fix is a shared primitive rather than a cycle — filed
// rather than improvised here, because extracting it means touching Home's exports in
// a phase whose Home work is already the largest part of the diff.
function BookStatCard({ label, value }) {
  return (
    <div
      style={{
        flex: '1 1 40%',
        minWidth: 0,
        background: 'var(--rm-surface, #FFFFFF)',
        border: `1px solid ${elevationVar('border')}`,
        borderRadius: 12,
        padding: '12px 14px',
        fontFamily: fontVar('body'),
      }}
    >
      <p style={{
        margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.15,
        color: 'var(--rm-text, #1C2D4D)',
      }}>
        {value}
      </p>
      <p style={{
        margin: '2px 0 0', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
      }}>
        {label}
      </p>
    </div>
  );
}

export default function RepClientsScreen({ onOpenClient = null }) {
  const [state, setState] = useState({ status: 'loading', clients: [], total: 0, limit: 0, nextCursor: null, counts: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [timeframe, setTimeframe] = useState('all');

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
        const res = await fetch(`${BACKEND_URL}/api/rep/clients?timeframe=${encodeURIComponent(timeframe)}`, {
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
          nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
          // ⚠ `Number.isFinite` PER FIELD, NOT `Array.isArray` AND NOT `!= null`. The
          // guard matches THIS value's own shape — an object carrying two numbers — and
          // its siblings above are guarded differently because they are differently
          // shaped. `!= null` would admit a string, and `"7" + 2` is `"72"`: a
          // confidently wrong figure in a stat card. Deliberate difference, not drift.
          counts: data.counts && Number.isFinite(data.counts.locked) && Number.isFinite(data.counts.provisional)
            ? data.counts
            : null,
        });
      } catch {
        if (live) setState((s) => ({ ...s, status: 'error' }));
      }
    }, 'RepClientsScreen/load')();
    // ⚠ SAME RACE GUARD AS HOME'S, AND IT MATTERS MORE HERE: this effect REPLACES the
    // list wholesale, so a stale response arriving second would paint one window's rows
    // under another window's bar and cursor.
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // ── LOAD THE NEXT PAGE ────────────────────────────────────────────────────
  // ⚠ APPENDS, AND IS GUARDED AGAINST A DOUBLE-TAP. Two in-flight requests with the
  // same cursor would append the same page twice — the duplicate-row failure the
  // keyset exists to prevent, reintroduced on the client. The guard is the flag, not
  // a disabled attribute, because a disabled button still fires from a keyboard
  // repeat before React re-renders.
  const loadMore = () => {
    if (loadingMore || !state.nextCursor) return;
    setLoadingMore(true);
    safeAsync(async () => {
      try {
        const token = getAdminToken();
        // ⚠ THE WINDOW TRAVELS WITH THE CURSOR. Omitting it here would make page 2 of a
        // filtered list unfiltered — the list would silently widen as a rep scrolled,
        // and the count line would stop agreeing with the rows above it. A keyset cursor
        // is only valid within the predicate it was minted under.
        const res = await fetch(
          `${BACKEND_URL}/api/rep/clients?timeframe=${encodeURIComponent(timeframe)}&cursor=${encodeURIComponent(state.nextCursor)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) throw new Error(`rep clients page: HTTP ${res.status}`);
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          clients: [...prev.clients, ...(Array.isArray(data.clients) ? data.clients : [])],
          total: Number.isFinite(data.total) ? data.total : prev.total,
          nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
        }));
      } catch {
        // ⚠ THE PAGE STAYS PUT AND THE CURSOR IS NOT CLEARED. Clearing it on failure
        // would make a transient error look like the end of the book, permanently.
        setState((prev) => ({ ...prev, pageError: true }));
      } finally {
        setLoadingMore(false);
      }
    }, 'RepClientsScreen/loadMore')();
  };

  const { status, clients, total, limit, counts } = state;

  return (
    <>
      <div style={{ marginBottom: 14 }}>
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
        {/* ⚠ THE SUBTITLE NOW CARRIES THE WINDOW, exactly as Home's stats section does,
            and for the same reason: the window is stated ONCE and governs everything
            below it — the cards, the list and the count. On THIS screen that includes the
            list, which is a decision recorded in RepTimeframeBar's header rather than
            left implicit: one control on one screen means one thing. */}
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)' }}>
          {timeframe === 'all' ? 'Book of business' : `Clients ${TIMEFRAME_PHRASES[timeframe]}`}
        </p>
      </div>

      <RepTimeframeBar value={timeframe} onChange={setTimeframe} label="Book timeframe" />

      {/* ⚠ RENDERED ONLY WHEN THE SERVER SUPPLIED BOTH COUNTS. A stat card is a claim
          about a number, and drawing 0 because a payload lost a field is the
          "absent is not zero" defect this codebase already shipped once on the admin
          money surface — an admin was told affirmatively there was nothing to review.
          Absent counts mean no cards, not two zeros. */}
      {status === 'ready' && counts && (
        <div data-rep-book-stats="" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {BOOK_STAT_CARDS.map((c) => (
            <BookStatCard key={c.key} label={c.label} value={counts[c.key]} />
          ))}
        </div>
      )}

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

      {status === 'ready' && clients.length === 0 && <EmptyBook timeframe={timeframe} />}

      {status === 'ready' && clients.length > 0 && (
        <>
          <ul style={{ margin: 0, padding: 0 }}>
            {clients.map((c) => <ClientRow key={c.jobberClientId} client={c} onOpen={onOpenClient} />)}
          </ul>
          {/* ⚠ THE COUNT ALWAYS RENDERS — CANVASS-4b. It used to render only when
              `total > clients.length`, i.e. only when the page was truncated, so a rep
              whose book fits on one page saw no count anywhere. That was reported from
              production as a missing feature, and it was: "tell me how big my book is"
              and "warn me the list is cut off" are two different jobs, and the condition
              served only the second.
              ⚠ THE TOTAL IS THE REP'S REAL ASSIGNMENT COUNT, counted WITHOUT the client
              join, so it cannot inherit a join's omissions. "Showing 30 of 30" against a
              database holding 39 would be a lie of a different kind — and with the LEFT
              JOIN above the two now agree for the right reason rather than by luck. */}
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
            {total > clients.length
              ? `Showing ${clients.length} of ${total} — most recently assigned first.`
              : `${total} ${total === 1 ? 'client' : 'clients'}`}
          </p>
          {state.pageError && (
            <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: statusVar('dangerText'), fontFamily: fontVar('body') }}>
              Could not load more. Tap to try again.
            </p>
          )}
          {state.nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              style={{
                display: 'block', width: '100%', marginTop: 12, padding: '11px 14px',
                background: 'transparent',
                border: `1px solid ${elevationVar('border')}`,
                borderRadius: 10,
                color: 'var(--rm-text, #1C2D4D)',
                fontFamily: fontVar('body'), fontSize: 15, fontWeight: 600,
                cursor: loadingMore ? 'default' : 'pointer',
                opacity: loadingMore ? MUTED : 1,
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </>
  );
}

export { STAGE_LABELS, SOURCE_LABELS, NO_STAGE_LABEL, MembershipBadge, StatusPill, EmptyBook, formatAssignedAt };
