import { useEffect, useState } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';
import { greetingLine } from '../../utils/greeting';
import RepTimeframeBar, { TIMEFRAME_PHRASES } from './RepTimeframeBar';
import { useRowPress, RowChevron } from './repRowAffordance';
import RepInfoIcon from './RepInfoIcon';
import RepRevealCard from './RepRevealCard';
import { STAGE_LABELS } from './RepClientsScreen';

// ─── THE HOME TAB — mockups 2A/2B, on ruling ④ (Canvass-6) ──────────────────
//
// ── ⚠ THE SCREEN'S SHAPE, RESTRUCTURED IN CANVASS-9a (Part 3c) ──────────────
//   greeting  →  "Your book at a glance" (timeframe bar, stat grid, conversions)
//             →  "Today's focus" (Referral progress, Recently assigned)
//
// ⚠ WHAT THIS REPLACED, BECAUSE THE OLD SHAPE READS AS DELIBERATE UNTIL IT IS NAMED:
// the `h1` said "Today's focus" and its subtitle said "Your book at a glance", so the
// STAT GRID was titled "Today's focus" and the two actual focus lists were untitled
// subsections underneath it. The subtitle has become the stats section's own heading —
// it is what that phrase always described — and Today's Focus is now a sibling section
// below, which is the mockup's arrangement.
//
// ⚠ TODAY'S FOCUS IS TWO SECTIONS WITH TWO HONEST LABELS, AND THE REASONING IS
// RECORDED HERE SO IT IS NOT "SIMPLIFIED" BACK INTO ONE LIST.
//   **Referral progress** ranks clients that HAVE a pipeline stage, by that stage.
//   **Recently assigned** ranks the rest, by assignment date.
// ⚠ THE FIRST WAS CALLED "Furthest along" UNTIL CANVASS-9a AND THE RENAME CHANGES NO
// RULING. A34.5 governs both names identically: two orderings, two labels each true
// about its own rows, neither implying the other, and the first not demoted for being
// small today.
// Neither section implies the other and neither borrows the other's label. A client
// in the second is NOT behind one in the first — it simply has no referral record to
// place it on the pipeline. They are two orderings, not one ranking split in half.
//
// ⚠ WHY NOT THE TWO OBVIOUS ALTERNATIVES, measured 2026-09-18 rather than argued:
// ranking ONLY staged clients shows 3 of a 39-client production book and 5 of a
// 268-row seeded one — uninformative about a book that is not empty. Ranking
// EVERYTHING by recency covers the book but calls assignment recency "furthest
// along", which is false for ~92% of the list and is the exact risk A34.5 names.
// **④ is the only option where every label is true about its own rows.**
//
// ⚠ AND IT DEGRADES CORRECTLY, WHICH IS PART OF THE DESIGN RATHER THAN A SIDE EFFECT:
// as the historical backfill and referral coverage grow, the first section fills and
// becomes the real focus with NO code change and NO relabelling. **That is why it is
// NOT visually subordinate just because it is small today** — it leads the screen, at
// the same weight as the second, and only its row count differs.
//
// ⚠ NO REVENUE ANYWHERE, IN EITHER FLAG STATE (A34.6 + CD-7; mockup 2B already draws
// it). Not a locked card, not an empty slot, not a reserved grid cell — the remaining
// stats reflow to fill the row. **The flag is not the reason**: the revenue NUMBER
// exists for nobody until Wave 1.5/1.6, so "drop any stat that would need a number
// nobody has" applies to a permitted rep too.
// ⚠ AND THE ABSENCE MUST NOT READ AS A LOCK BY OMISSION. An obvious gap where money
// would go invites a rep to infer they are being denied something — the same reason
// the membership badge reserves no slot. There is no gap: the grid has no hole in it.

const MUTED = 0.72;

// ⚠ CHAINS IS NOT HERE, AND THAT IS A DATA FACT RATHER THAN AN OMISSION. The mockup's
// CHAINS card counts referral chains; the referral link is a name string with no
// foreign key, which is the same reason the detail screen draws no chain.
// ⚠ CONV IS NOT IN THIS GRID EITHER, BUT IT NOW SHIPS — AS ITS OWN CARD BELOW.
// ⚠ THE SENTENCE THIS REPLACES SAID IT COULD NOT BE MEASURED FROM THIS ENVIRONMENT
// AND THAT "the standing rule is not to ship a card that always reads 0". Danny ran
// the funnel on Railway 2026-09-19 and it CAN be measured: 2 conversions, both
// bridged to a Jobber client, neither client in any rep's book — so it reads 0 today.
// ⚠ AND THE REASONING THAT ZERO WOULD FILL IN AS THE BACKFILL RAN WAS WRONG, which is
// why this note is longer than the line it replaces. A conversion is a ROOFMILES
// concept — a tracked referral becoming a customer — and the backfill imports JOBBER
// data, which never recorded a referral chain. **No import can manufacture one.** The
// number starts accumulating when real referrals convert AFTER launch, and the card
// existing is what makes that recordable. See `ConversionsCard` for why it is not a
// fifth cell in this grid.
// ── ⚠ THERE IS NO `FLAGGED` CARD, AND IT WAS REMOVED RATHER THAN NEVER ADDED ──
//
// Canvass-9a, ruled by Danny. **Flagged is a PILL on the rows it applies to, and
// nowhere else in the app is there explanatory language about it** — an FAQ and
// contractor training cover the concept later.
//
// ⚠ THE REASON IS THAT A DEDICATED CARD DRAWS ATTENTION TO A THING THAT MEANS
// NOTHING TO A REP. A flag is resolved by an owner or an admin (A34.7); the rep can
// take no action on it. A stat card reading "1 FLAGGED" on the entry screen asks a
// question the rep cannot answer and cannot dismiss, and for most reps it reads 0
// forever — a permanent slot for a number with no consequence.
//
// ⚠ THE SERVER STILL COUNTS IT AND THAT IS NOT DEAD CODE. `GET /api/rep/home` keeps
// returning `flagged`, scoped by A34.7 to open co-assignment flags naming this rep,
// because the DETAIL screen's pending-review card and the row pill are both driven
// by the same scoping and the count is what its tests pin. Removing the card is a
// display decision; the data contract is A34.7's and is untouched.
//
// ⚠ AND THE GRID REFLOWS RATHER THAN LEAVING A HOLE — same rule the absent revenue
// card already follows. `flex: 1 1 40%` means three cards redistribute; a hole is
// what a rep reads as a lock.
// ⚠ `wide` IS A LAYOUT CONSEQUENCE OF REMOVING THE FOURTH CARD, AND IT WAS FOUND BY
// LOOKING RATHER THAN BY MEASURING — no contrast reading or count could have shown it.
// With four cards at `flex: 1 1 40%` the grid was a tidy 2x2. With three, the third
// WRAPS ALONE AND STRETCHES TO FULL WIDTH, so a PROVISIONAL of 1 rendered at the same
// visual weight as the conversions card, directly above a CLIENTS of 272. **The least
// important number became the largest object on the screen.**
//
// ⚠ THE TWO OBVIOUS FIXES ARE BOTH WRONG, AND THE MEASUREMENTS AND THE RULINGS SAY WHY.
//   · **Three across** fits at 430px — measured on the rendered node, 123.3px per card
//     with no label overflow — and does NOT fit at 320-375px, where three cards needing
//     121px each plus gaps want 383px of a 280px column. It would break on the narrower
//     half of real phones, which is the half this app is most used on.
//   · **A half-width lone card** leaves empty space beside it, and that is exactly the
//     HOLE this grid's own note forbids in terms: *"a three-card grid with a hole would
//     satisfy the prose and contradict the design. A hole is what a rep would read as a
//     lock."*
//
// **So CLIENTS leads at full width and the two stats that PARTITION it pair beneath.**
// No hole at any width, and the hierarchy becomes the honest one: the size of the book,
// then its split. ⚠ It also matches the Clients tab, where Locked and Provisional are
// already a pair — and they pair there for a structural reason rather than a visual one:
// `sticky_rep_id IS NULL` and `IS NOT NULL` partition the rows, so those two always sum
// to this one. The layout now says what the data means.
// ⚠ `info` NAMES THE GLOSSARY ENTRY, AND ITS ABSENCE IS A DECISION RATHER THAN A
// GAP. Which cards get an icon is DATA here, in one table, so the answer is readable
// in one place instead of being inferred from scattered JSX. All three of these are
// vocabulary a rep can reasonably get wrong — see `repGlossary` for what each says
// and for the two things that deliberately have NO entry at all (FLAGGED, by
// Danny's ruling, and REFERRAL CONVERSIONS, which already explains itself).
const STAT_CARDS = Object.freeze([
  { key: 'clients', label: 'CLIENTS', wide: true, info: 'clients' },
  { key: 'locked', label: 'LOCKED', info: 'locked' },
  { key: 'provisional', label: 'PROVISIONAL', info: 'provisional' },
]);

// ⚠ `alert` IS GONE, NOT DISABLED. It tinted a value with `warningText` when the
// count was above zero, and FLAGGED was its ONLY consumer — removed above by ruling.
// A prop with no caller is dead code, and CLAUDE.md requires it to go in the same
// session it is identified rather than be left for a reader to wonder about.
function StatCard({ label, value, wide = false, info = null }) {
  return (
    <div
      style={{
        // ⚠ FLEX-GROW RATHER THAN A FIXED GRID COLUMN, SO THE ROW REFLOWS. §b records
        // that 2B's remaining cards stretch when revenue is dropped: "a three-card grid
        // with a hole would satisfy the prose and contradict the design". A hole is what
        // a rep would read as a lock.
        // ⚠ 100% TAKES A WHOLE ROW; 40% LETS EXACTLY TWO SHARE ONE. Both still GROW, so
        // neither can leave a gap at the end of its row at any viewport width — which is
        // what keeps the no-hole rule true for both shapes rather than only the pair.
        flex: wide ? '1 1 100%' : '1 1 40%',
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
      {/* ⚠ A FLEX ROW WITH `wrap`, WHICH IS WHAT LETS THE PANEL TAKE ITS OWN LINE
          without being positioned — `RepInfoIcon`'s panel sets `flexBasis: 100%` and
          wraps beneath the label. No absolute positioning means no overflow maths and
          nothing to clip at a width nobody tested. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
        }}>
          {label}
        </p>
        {/* ⚠ THE ICON IS NOT FADED WITH THE LABEL. `opacity` INHERITS, so putting the
            icon inside the muted <p> would dim a CONTROL to match decoration — the
            recorded defect where a payout figure was muted by the paragraph it sat
            inside. It is a sibling, at full strength. */}
        {info && <RepInfoIcon termKey={info} label={label} />}
      </div>
    </div>
  );
}

// ─── THE CONVERSIONS CARD (Canvass-8) ───────────────────────────────────────
//
// ⚠ DELIBERATELY NOT A FIFTH STAT CELL, AND THE REASON IS THE LABEL RATHER THAN THE
// LAYOUT. The grid's cells carry one-word uppercase labels — CLIENTS, LOCKED and
// PROVISIONAL — and the truthful label for this number is a phrase: it
// counts *people your clients referred who have become customers*. "CONV" is the
// mockup's word and says nothing; "CONVERSIONS" alone does not say whose, or of
// what, and a rep with sold jobs would reasonably read it as their own closings.
// **A label that cannot fit the grid is a reason to leave the grid, not to shorten
// the label**, so this is a full-width card with the phrase as its label and a
// definition line under it.
//
// ⚠ THE LABEL MUST STAY TRUE ON ITS OWN. The UI pass will add a tappable "i" to each
// card explaining the term, and the label problem largely dissolves — but a rep who
// never taps it must not be misled, so the popup adds DEPTH and never rescues a
// label that overstates. Same principle as the membership badge, where an absent
// badge is a non-claim. **Do not shorten this label when the info affordance lands.**
//
// ⚠ ROOM IS LEFT FOR THAT AFFORDANCE ON PURPOSE — the heading row is a flex row with
// the label on one side and nothing on the other, so an icon slots in without a
// reflow. The popup MECHANISM is not built here, and Danny's note that this card may
// deserve a standout outline is a UI-pass direction, not this phase's work.
// ── ⚠ THE STANDOUT TREATMENT (Canvass-9b, part c) ───────────────────────────
//
// 9a's own finding was that this card "reads as another box", and Danny wants it
// visually distinct given what it means to the product: **it is the only number on
// this screen that measures the thing RoofMiles exists to do.** CLIENTS, LOCKED and
// PROVISIONAL all describe a rep's book, which would exist without this product;
// a referral conversion would not.
//
// ⚠ WHAT I CHOSE, AND WHAT I REJECTED — BECAUSE THE REJECTED ONES ARE WHAT A READER
// WILL SUGGEST:
//   · **A BRAND-PRIMARY FILL.** Rejected: `--rm-primary` is the ACTION colour — it is
//     what this app fills buttons and the selected timeframe chip with — and a
//     filled non-interactive card would read as a tappable thing that does nothing.
//     It would also force `--rm-on-primary` onto a paragraph, and that pair is
//     floored for a button label, not for a sentence at 13px.
//   · **A LARGER NUMBER ALONE.** Rejected: it was already the largest figure on the
//     screen at 28px and still read as another box. Size was not the problem.
//   · **A SHADOW.** Rejected: `elevationVar('shadow')` on a recess ground measures
//     almost nothing in light mode — the repo already records the shadow/border
//     tokens as sub-3:1 against these grounds — so it would be a treatment that only
//     exists in dark mode.
//
// **CHOSEN: an accent EDGE plus a recess ground.** A 3px left border in the action
// colour — the same device the client rows already use to carry state, so it is this
// app's existing vocabulary rather than a new one — and the card sits on
// `--rm-recess` while its neighbours sit on `--rm-surface`. **It differs from the
// cards around it in two independent channels (edge and ground), so it still reads
// as distinct for anyone who cannot separate the accent hue from the text.**
//
// ⚠ AND THE GROUND SWAP IS THE HALF THAT SURVIVES A COLOUR-VISION DIFFERENCE, which
// is why it is not decoration on top of the border. A treatment carried only by hue
// is a treatment some readers do not get.
function ConversionsCard({ value }) {
  return (
    <RepRevealCard
      testId="rep-conversions"
      revealLabel="Referral conversions breakdown"
      // ⚠ THE LEFT FIGURE IS REAL AND THE RIGHT ONE HAS NO SOURCE TODAY — SAID
      // PLAINLY RATHER THAN FILLED WITH A PLAUSIBLE NUMBER. Danny's spec is
      // "referral and total side by side". The referral figure is `stats.conversions`,
      // which the server computes. **There is no total-conversions figure anywhere in
      // the payload or the schema**, and the candidates are all wrong: the
      // contractor's total would disclose other reps' numbers, and the rep's client
      // count is a different unit entirely. Inventing either would be exactly the
      // "do not fake one" this phase was told to avoid. Filed as a data question.
      left={{ title: 'Referral', value }}
      right={{ title: 'Total', empty: 'Not recorded yet.' }}
    >
      <section
        data-rep-conversions=""
        style={{
          // See the header for what this is and what it is not.
          background: 'var(--rm-recess, #ECF0F8)',
          border: `1px solid ${elevationVar('border')}`,
          borderLeft: '3px solid var(--rm-primary, #F26A1B)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 22,
          fontFamily: fontVar('body'),
        }}
      >
        <p style={{
          margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.1,
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          {value}
        </p>
        {/* ⚠ NO INFO ICON HERE, AND THAT IS A DECISION. The definition line below IS
            the explanation an icon would have opened — a second route to the same
            sentence is clutter, not help. The caret `RepRevealCard` draws opens the
            BREAKDOWN, which is different content. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{
            margin: '2px 0 0', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: fontVar('body'),
          }}>
            REFERRAL CONVERSIONS
          </h2>
        </div>
        {/* ⚠ THE DEFINITION LINE IS PART OF THE LABEL, NOT DECORATION. It is what makes
            the number unambiguous without the info popup: whose referrals, and what
            happened to them. It renders in every state, including zero. */}
        <p style={{
          margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, maxWidth: '88%',
          color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
        }}>
          People your clients referred who have become customers.
        </p>
      </section>
    </RepRevealCard>
  );
}

// ⚠ THE CHEVRON AND THE PRESS STATE ARE WHAT MAKE THIS READ AS TAPPABLE (Part 3e).
// The row has been activatable since Canvass-6 and said so only to a screen reader.
// See `repRowAffordance.jsx` for why hover and `cursor: pointer` do not count.
//
// ⚠ PRESSED SWAPS TO `--rm-surface`, AND THE DIRECTION IS DELIBERATE. These rows sit
// directly on the column, which A34.1 puts on `--rm-recess`, so lifting to `surface`
// is the visible change here — the inverse of the Clients tab's card rows, which sit
// ON surface and press DOWN to recess. One rule, "swap to the other ground", applied
// to two different starting grounds. ⚠ BOTH DIRECTIONS KEEP THE TEXT FLOORED: A34.1
// records that `--rm-text` is floored to 4.5:1 against BOTH `surface` and `recess`,
// which is exactly what makes a ground swap safe without a per-brand measurement.
function FocusRow({ client, onOpen, trailing }) {
  const { pressed, pressHandlers, pressStyle } = useRowPress();
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
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 8px 10px 0',
        borderBottom: `1px solid ${elevationVar('border')}`,
        cursor: onOpen ? 'pointer' : undefined,
        fontFamily: fontVar('body'),
        background: onOpen && pressed ? 'var(--rm-surface, #FFFFFF)' : 'transparent',
        // ⚠ LAST, AND A TRANSITION ONLY — see ClientRow's note. Same helper on both
        // rows, so the two grounds settle at the same speed even though they swap in
        // opposite directions.
        ...(onOpen ? pressStyle : {}),
      }}
    >
      <span style={{
        flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600,
        color: 'var(--rm-text, #1C2D4D)',
        opacity: client.nameUnavailable ? MUTED : 1,
        fontStyle: client.nameUnavailable ? 'italic' : 'normal',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {client.nameUnavailable ? 'Details not available yet' : client.name}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>
        {trailing}
      </span>
      {/* ⚠ ONLY WHEN THE ROW ACTUALLY OPENS SOMETHING. A chevron on an inert row is a
          promise the row does not keep — and `onOpen` is genuinely absent in the
          admin branding preview, which mounts these rows to demonstrate a palette. */}
      {onOpen && <RowChevron />}
    </li>
  );
}

// ⚠ BOTH SECTIONS USE THIS SAME SHELL, AT THE SAME WEIGHT, DELIBERATELY. If the first
// section were styled as secondary while it is small, filling up later would require a
// restyle — and the ruling is that it becomes the real focus with no code change.
// ⚠ `h3`, NOT `h2`, AND THE CHANGE IS STRUCTURAL RATHER THAN COSMETIC (Part 3c).
// These two sections are now NESTED INSIDE a "Today's focus" section that owns the
// `h2`, so an `h2` here would make them siblings of their own parent and give the
// screen two headings claiming the same level. The visual weight is unchanged — the
// font size and weight are the same numbers as before — which matters because A34.5
// forbids the first section being visually subordinate. **The level moved; the
// prominence did not.**
function FocusSection({ title, subtitle, clients, onOpen, trailingFor, emptyCopy }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{
        margin: '0 0 2px', fontFamily: fontVar('heading'),
        fontSize: 17, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)',
      }}>
        {title}
      </h3>
      <p style={{ margin: '0 0 6px', fontSize: 13, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
        {subtitle}
      </p>
      {clients.length === 0 ? (
        // ⚠ AN EMPTY FIRST SECTION IS NORMAL AND MUST NOT READ AS AN ERROR OR A GAP.
        // A book with no staged clients is the common case today — measured at 3 of 39
        // in production. No alert role, no warning colour, no dashed placeholder box.
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
          {emptyCopy}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0 }}>
          {clients.map((c) => (
            <FocusRow key={c.jobberClientId} client={c} onOpen={onOpen} trailing={trailingFor(c)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function formatAssigned(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ⚠ A SAMPLE FOR THE ADMIN BRANDING PREVIEW, WHICH MUST FIRE NO REQUEST AT ALL.
// BrandingPreview mounts the REAL RepShell inside a phone casing so a contractor's
// palette is demonstrated on the real component. Its safety argument was written as
// "the entry screen is Home" — i.e. Home was inert — and Canvass-6 made Home fetch,
// which B-4's fence caught immediately. **The fix is that preview mode cannot reach
// the network rather than chooses not to**: the effect below returns before it is
// built, so there is no branch a later edit can accidentally invert.
// ⚠ AND IT RENDERS REAL-LOOKING NUMBERS RATHER THAN ZEROS, because the preview's job
// is to show what a contractor's brand looks like on a populated screen — an all-zero
// dashboard would demonstrate the palette on almost no ink.
// ⚠ `flagged` STAYS IN THIS FIXTURE THOUGH NO CARD READS IT ANY MORE. The route still
// returns it — A34.7's scoping is a data contract this phase did not touch — and a
// preview payload that omits a key the server sends is a fixture that has quietly
// stopped mirroring the thing it stands in for. That is this repo's recorded
// "a double that can also stand in for a different shape" failure, and the cost of
// keeping one honest key is nothing.
const PREVIEW_SAMPLE = Object.freeze({
  stats: { clients: 128, locked: 121, provisional: 7, flagged: 2, conversions: 6 },
  focus: {
    furthestAlong: [
      { jobberClientId: 'preview-1', name: 'Maria Lopez', nameUnavailable: false, stage: 'paid' },
      { jobberClientId: 'preview-2', name: 'Allen Wade', nameUnavailable: false, stage: 'sold' },
    ],
    recentlyAssigned: [
      { jobberClientId: 'preview-3', name: 'Pat Chen', nameUnavailable: false, assignedAt: '2026-09-15T12:00:00Z' },
    ],
  },
});

export default function RepHomeScreen({ onOpenClient = null, preview = false, caps = null }) {
  const [state, setState] = useState(
    preview
      ? { status: 'ready', stats: PREVIEW_SAMPLE.stats, focus: PREVIEW_SAMPLE.focus }
      : { status: 'loading', stats: null, focus: null }
  );
  // ⚠ `all` IS THE DEFAULT, WHICH IS WHAT KEEPS THE ENTRY SCREEN A RUNNING TOTAL.
  // See RepTimeframeBar's header: defaulting to a window would silently shrink every
  // number a rep sees on arrival and read as data loss.
  const [timeframe, setTimeframe] = useState('all');

  useEffect(() => {
    // ⚠ FIRST LINE, BEFORE ANYTHING IS CONSTRUCTED. B-4's fence asserts the branding
    // preview fires NO request; returning here is what makes that structural.
    if (preview) return undefined;
    let live = true;
    safeAsync(async () => {
      try {
        const token = getAdminToken();
        // ⚠ THE WINDOW IS A SERVER PARAMETER, NOT A CLIENT FILTER, AND THAT IS NOT AN
        // IMPLEMENTATION PREFERENCE. The stats are COUNTS over the rep's whole book —
        // 272 rows on the seeded fixture and 3,756 in Danny's worst case — and the
        // payload carries only the focus lists, never the rows the counts are taken
        // over. There is nothing on the client to filter, so a client-side window
        // could only ever filter what happened to be paged in and would report a
        // confidently wrong number.
        const res = await fetch(`${BACKEND_URL}/api/rep/home?timeframe=${encodeURIComponent(timeframe)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`rep home: HTTP ${res.status}`);
        const data = await res.json();
        if (live) setState({ status: 'ready', stats: data.stats, focus: data.focus });
      } catch {
        if (live) setState((s) => ({ ...s, status: 'error' }));
      }
    }, 'RepHomeScreen/load')();
    // ⚠ `live` IS WHAT MAKES CHANGING THE WINDOW SAFE. Tapping Week then Month leaves
    // two requests in flight, and without this the slower one wins whichever it is —
    // the stats would show a window the bar is not displaying. The cleanup runs before
    // the next effect, so only the newest request may write.
    return () => { live = false; };
  }, [preview, timeframe]);

  const { status, stats, focus } = state;

  return (
    <>
      {/* ── THE GREETING (Part 3a) ──────────────────────────────────────
          ⚠ `greetingLine` IS THE ADMIN DASHBOARD'S OWN IMPLEMENTATION, EXTRACTED — not a
          second one written to match. It lived inline in `AdminDashboard.jsx` (the
          block under `pendingState`) and now lives in `src/utils/greeting.js`, which
          both surfaces call. The `< 12` / `< 17` boundaries are the admin's unchanged,
          so the two surfaces cannot greet differently at 4pm.
          ⚠ AND IT RESOLVES IN THE VIEWER'S TIMEZONE because `new Date().getHours()` reads
          the clock of the machine running it, which in a browser is the rep's own. That
          is a requirement, not a side effect — see the util's header for why it must
          never move to the server or take a timezone from the contractor record.
          ⚠ THE NAME COMES FROM `caps`, WHICH ARRIVES AFTER FIRST PAINT, so the greeting
          renders without a name for one frame and then gains one. That is correct and
          is why `firstNameOf` returns null rather than a placeholder — a fabricated
          name on a white-label surface is the one thing this must not do. */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: 0, fontFamily: fontVar('heading'),
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          {greetingLine(caps && caps.full_name)}
        </h1>
      </div>

      {status === 'loading' && (
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
          Loading…
        </p>
      )}

      {status === 'error' && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: statusVar('dangerText'), fontFamily: fontVar('body') }}>
          Could not load your dashboard.
        </p>
      )}

      {status === 'ready' && stats && focus && (
        <>
          {/* ── THE STATS SECTION — "Your book at a glance" (Part 3c) ─────────
              ⚠ THIS SECTION IS NOW NAMED, AND TODAY'S FOCUS IS NO LONGER THE NAME OF IT.
              The screen used to open with an `h1` reading "Today's focus" whose subtitle
              was "Your book at a glance", with the two lists below under their own
              headings — so the stat grid was titled "Today's focus" and the actual focus
              lists were untitled subsections of it. **Danny's intent is the mockup's:
              stats at the top, Today's Focus as its own section BELOW them.** The
              subtitle became this section's name, which is what it always described.
              ⚠ AND THE SUBTITLE NOW CARRIES THE WINDOW, WHICH IS THE WHOLE ANSWER TO
              "make it obvious which cards respond". Every card under this bar obeys it,
              so the window is stated ONCE here and there is nothing to distinguish
              per-card. See RepTimeframeBar's header for the ruling. */}
          <section style={{ marginBottom: 22 }} data-rep-stats-section="">
            <h2 style={{
              margin: '0 0 2px', fontFamily: fontVar('heading'),
              fontSize: 17, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)',
            }}>
              Your book at a glance
            </h2>
            <p style={{
              margin: '0 0 10px', fontSize: 13, opacity: MUTED,
              color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body'),
            }}>
              {/* ⚠ ONE SENTENCE GOVERNING THE WHOLE GRID. `all` reads "all time" rather
                  than naming a date range, because there is no range — the server
                  applies no predicate at all in that case. */}
              Clients {TIMEFRAME_PHRASES[timeframe]}
            </p>

            <RepTimeframeBar value={timeframe} onChange={setTimeframe} label="Stats timeframe" />

            <div data-rep-stats="" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {STAT_CARDS.map((c) => (
                <StatCard key={c.key} label={c.label} value={stats[c.key] ?? 0} wide={c.wide === true} info={c.info ?? null} />
              ))}
            </div>

            <ConversionsCard value={stats.conversions ?? 0} />
          </section>

          {/* ── TODAY'S FOCUS — ITS OWN SECTION, BELOW THE STATS (Part 3c) ────
              ⚠ IT IS NOT FILTERED BY THE TIMEFRAME, DELIBERATELY. These two lists answer
              "what should I do now", which is not a question about a date range: a client
              assigned in March sitting at `sold` is exactly what belongs here in
              September. The bar is scoped to the stats and sits inside their section
              rather than above both, so it does not appear to govern this one. */}
          <section data-rep-focus-section="">
            <h2 style={{
              margin: '0 0 10px', fontFamily: fontVar('heading'),
              fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em',
              color: 'var(--rm-text, #1C2D4D)',
            }}>
              Today&apos;s focus
            </h2>

            <FocusSection
              // ⚠ RENAMED FROM "Furthest along" (Part 3d). A34.5's ruling is UNCHANGED by
              // the rename and is what constrains it: two orderings, two labels each true
              // about its own rows, neither implying the other. "Referral progress" says
              // what these rows have — a referral record with a pipeline position — and
              // still makes no claim that the rows in the other section are behind them.
              // ⚠ AND IT IS STILL NOT VISUALLY SUBORDINATE. Same heading level, same size,
              // same weight as "Recently assigned", and it still leads. A34.5's note that
              // it must not be demoted "just because it is small today" governs the rename
              // exactly as it governed the original.
              title="Referral progress"
              subtitle="Your clients with a referral record, by pipeline stage"
              clients={focus.furthestAlong}
              onOpen={onOpenClient}
              trailingFor={(c) => (c.stage ? (STAGE_LABELS[c.stage] || c.stage) : '')}
              // ⚠ STATES A FACT ABOUT THE DATA, NOT A FAILURE. "None yet" would read as
              // something missing; this says why the section is empty and implies nothing
              // about the clients in the other one.
              emptyCopy="None of your clients has a referral record yet, so there is no pipeline stage to rank by."
            />

            <FocusSection
              title="Recently assigned"
              subtitle="Your other clients, newest assignment first"
              clients={focus.recentlyAssigned}
              onOpen={onOpenClient}
              trailingFor={(c) => formatAssigned(c.assignedAt)}
              emptyCopy="Clients appear here once a request in Jobber is assigned to you."
            />
          </section>
        </>
      )}
    </>
  );
}

export { StatCard, FocusSection, FocusRow, STAT_CARDS };
