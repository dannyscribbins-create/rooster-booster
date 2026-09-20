import { useEffect, useState } from 'react';
import { CaretLeft, Lock } from '@phosphor-icons/react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';
import { STAGE_LABELS, SOURCE_LABELS, NO_STAGE_LABEL, MembershipBadge, StatusPill } from './RepClientsScreen';

// ─── CLIENT DETAIL — mockup 4b, on the dated rulings (Canvass-5) ────────────
//
// Reached by tapping a row in the Clients tab. The screen state is PARAMETERISED —
// `{ screen: 'clientDetail', clientId }` — which is A24.6's binding condition for
// deferring the router to 3e: a bare string cannot express WHICH client, and
// CD-10's Today's Focus is already planned to open a specific one from the dashboard.
//
// ⚠ WHAT THE MOCKUP SHOWS THAT THIS DOES NOT BUILD, AND WHY — NOT SILENT OMISSIONS:
//   · **"Referral relationship" — the three-node chain `Danny → Sarah K. → Maria
//     Lopez`. NOT BUILT: THERE IS NO DATA BEHIND IT.** Canvass-0 §5 recorded it and
//     it is still true — the referral link is a NAME STRING in
//     `pipeline_cache.referred_by` with no foreign key to anything. A single hop
//     cannot be resolved to a person, let alone a chain. Drawing it would mean
//     inventing the relationship. The one honest fragment — the referrer's NAME, when
//     a referral record exists — is shown in the stage card instead.
//   · **A revenue VALUE.** Wave 1.5/1.6 owns the data. A34.6 governs the two states
//     that exist today and both are built; the number itself does not exist anywhere.
//   · **The invite / QR affordance.** 3d's, and the badge it would light is dark
//     until 3d writes a per-client rep send.
//
// ⚠ AND THE SUBTITLE IS NOT THE MOCKUP'S. It reads "Sticky assignment record" there,
// which is true of a sticky assignment and FALSE of a provisional one — and
// provisional is a state the mockup assumes away entirely. It says "Assignment
// record", and the pill carries which kind.

const MUTED = 0.72;

function Card({ children, accent = null, style = {} }) {
  return (
    <section
      style={{
        background: 'var(--rm-surface, #FFFFFF)',
        border: `1px solid ${elevationVar('border')}`,
        borderLeft: accent ? `4px solid ${accent}` : `1px solid ${elevationVar('border')}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 12,
        fontFamily: fontVar('body'),
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function CardTitle({ children }) {
  return (
    <h2 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
      textTransform: 'uppercase', color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>
      {children}
    </h2>
  );
}

function Line({ children }) {
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--rm-text, #1C2D4D)' }}>
      {children}
    </p>
  );
}

// ── ⚠ THE FIELD ROW, AND IT IS THE FIX FOR A MEASURED DEFECT (Part 5) ───────
//
// Canvass-8 found the attribution value **wrapping to two cramped lines at phone
// width**, and the cause was its shape rather than its length: source, locked-state
// and date were joined with ' · ' into ONE paragraph, so the browser broke the line
// wherever it ran out of room — mid-fact, with a leading separator stranded on the
// second line. A longer source label or a contractor with a longer date format makes
// it worse, and nothing about the markup said which fact was which.
//
// ⚠ SO THIS IS NOT "GIVE IT MORE ROOM", WHICH WOULD HAVE BEEN THE AVAILABLE
// NON-FIX. Three facts joined by a separator is a LIST rendered as a sentence; each
// one gets its own labelled row, so a wrap happens inside one value and stays legible,
// and each fact is findable by its own name. **A label per fact also removes the ' · '
// entirely**, which is the character that was being orphaned.
//
// ⚠ `dt`/`dd` INSIDE A `dl`, NOT TWO SPANS. These genuinely are term/value pairs, and
// the semantics are free — a screen reader announces "Source, Quote" rather than
// reading two unrelated fragments in sequence.
function Field({ label, children }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        // ⚠ A ROW GAP RATHER THAN A MARGIN ON THE VALUE, so the last field adds no
        // trailing space inside the card.
        marginTop: 6,
      }}
    >
      <dt style={{
        flex: '0 0 auto', minWidth: 66,
        fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
        color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
      }}>
        {label}
      </dt>
      {/* ⚠ `minWidth: 0` IS WHAT LETS A LONG VALUE WRAP INSIDE ITS OWN COLUMN instead
          of forcing the row wider than the card. A flex child defaults to
          `min-width: auto`, which refuses to shrink below its content — the reason
          "it wraps badly" and "it overflows" are usually the same bug. */}
      <dd style={{
        margin: 0, minWidth: 0, flex: 1,
        fontSize: 15, lineHeight: 1.45, color: 'var(--rm-text, #1C2D4D)',
      }}>
        {children}
      </dd>
    </div>
  );
}

// ── THE REVENUE CARD (A34.6 + A24.4) ────────────────────────────────────────
//
// TWO STATES, AND TELLING THEM APART IS THE ENTIRE RULING.
//   revenue_hidden true  → the LOCKED treatment. The rep may not see revenue.
//   revenue_hidden false → "No revenue recorded yet." The rep MAY see it; there is
//                          simply nothing yet. ⚠ NEVER the lock — a lock here tells a
//                          permitted rep they are not permitted, which is untrue, and
//                          A34.6 rules that reusing one treatment for both is exactly
//                          what makes two different payloads indistinguishable.
//
// ⚠ THE VALUE IS NEVER IN THE PAYLOAD WHEN IT IS HIDDEN — A24.4 has the SERVER omit
// it, because a CSS-dimmed figure is still in the page and readable in developer
// tools. So this card cannot leak it even if this component were wrong.
//
// ⚠ AND IT DELIBERATELY DOES NOT REUSE `shared/LockedSection`. That component is an
// ADMIN primitive: it declares `AD` tokens throughout, and its `var(--rm-bg, #012854)`
// scrim is built for a tree where NO custom property is mounted — its own header says
// the admin panel "has no code path that emits a custom property". The rep surface
// renders INSIDE ThemeProvider, so that fallback would resolve to the mounted value
// and the AD palette would paint a contractor's white-label screen. Reusing it here is
// the "a rule applied once to a surface does not stay applied when the surface moves"
// failure, with the surface already moved.
// ⚠ The mockup agrees on the treatment, for its own reason: its Value card is "a plain
// card containing explanatory copy — no lock icon, no blur, no dimmed figure". The lock
// GLYPH is kept because A34.6 calls this "the locked treatment" and a word alone does
// not read as a permission state; the blur and the dimmed figure are not, because there
// is no figure to dim.
function RevenueCard({ revenueHidden }) {
  if (revenueHidden) {
    return (
      <Card>
        <CardTitle>Value</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} weight="fill" color={statusVar('warningText')} aria-hidden="true" />
          <Line>Revenue is not shown for your account.</Line>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <CardTitle>Value</CardTitle>
      <Line>No revenue recorded yet.</Line>
    </Card>
  );
}

export default function RepClientDetailScreen({ clientId, onBack }) {
  const [state, setState] = useState({ status: 'loading', client: null });

  useEffect(() => {
    let live = true;
    safeAsync(async () => {
      try {
        const token = getAdminToken();
        const res = await fetch(`${BACKEND_URL}/api/rep/clients/${encodeURIComponent(clientId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        // ⚠ 404 IS ITS OWN STATE, NOT AN ERROR. A34.8 makes it the answer for a client
        // that is not in this rep's book — including one that exists and belongs to
        // someone else — so it must read as "not yours", never as "something broke".
        if (res.status === 404) { if (live) setState({ status: 'notfound', client: null }); return; }
        if (!res.ok) throw new Error(`rep client detail: HTTP ${res.status}`);
        const data = await res.json();
        if (live) setState({ status: 'ready', client: data });
      } catch {
        if (live) setState({ status: 'error', client: null });
      }
    }, 'RepClientDetailScreen/load')();
    return () => { live = false; };
  }, [clientId]);

  const { status, client } = state;

  const back = (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'transparent', border: 'none', padding: '4px 0', marginBottom: 8,
        color: 'var(--rm-text, #1C2D4D)', opacity: MUTED,
        fontFamily: fontVar('body'), fontSize: 14, cursor: 'pointer',
      }}
    >
      <CaretLeft size={16} weight="bold" aria-hidden="true" />
      Clients
    </button>
  );

  return (
    <>
      {back}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontFamily: fontVar('heading'), fontSize: 28, fontWeight: 700,
          letterSpacing: '-0.01em', color: 'var(--rm-text, #1C2D4D)' }}>
          Client Detail
        </h1>
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)' }}>
          Assignment record
        </p>
      </div>

      {status === 'loading' && (
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body') }}>
          Loading…
        </p>
      )}

      {status === 'notfound' && (
        <Card>
          <Line>This client is not in your book.</Line>
        </Card>
      )}

      {status === 'error' && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: statusVar('dangerText'), fontFamily: fontVar('body') }}>
          Could not load this client.
        </p>
      )}

      {status === 'ready' && client && (
        <>
          {/* ── ⚠ FOUR NAMED SECTIONS, WHERE THERE USED TO BE ONE RUN-ON CARD ───
              Part 5. Danny: "all clunked together in scribble right now." The header
              card carried the client's identity, the membership and status badges, THREE
              attribution facts as a separator-joined sentence, and the contact details —
              four unrelated kinds of information in one box, at one visual weight, with
              no labels. Grouped by relevance now, each section titled:
                 CLIENT      — who they are and how to reach them
                 ATTRIBUTION — the assignment record: source, status, date
                 PIPELINE    — where the referral sits, when there is one
                 VALUE       — A34.6's two states, unchanged
              ⚠ THE SECTIONS ARE THE SAME `Card` PRIMITIVE AT THE SAME WEIGHT. GROUPING
              IS WHAT WAS MISSING, NOT HIERARCHY — ranking these four would be inventing a
              claim about which matters most, and the rep decides that by what they came
              looking for. */}

          {/* ── CLIENT ───────────────────────────────────────────────────────── */}
          <Card accent={client.isFlagged ? statusVar('warning') : 'var(--rm-primary, #F26A1B)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 18, fontWeight: 700,
                color: 'var(--rm-text, #1C2D4D)',
                opacity: client.nameUnavailable ? MUTED : 1,
                fontStyle: client.nameUnavailable ? 'italic' : 'normal',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {client.nameUnavailable ? 'Details not available yet' : client.name}
              </span>
              <MembershipBadge membership={client.membership} />
            </div>
            {/* ⚠ CONTACT DETAILS ARE LABELLED FIELDS NOW RATHER THAN A SEPARATOR JOIN,
                for the same reason as the attribution block below — with a second benefit
                that only shows on a phone: an email and a phone number are both things a
                rep wants to ACT on, and a labelled row is a target rather than half of a
                sentence. Rendered only when we actually hold a client record. */}
            {!client.nameUnavailable && (client.email || client.phone) && (
              <dl style={{ margin: '4px 0 0' }}>
                {client.email && <Field label="Email">{client.email}</Field>}
                {client.phone && <Field label="Phone">{client.phone}</Field>}
              </dl>
            )}
          </Card>

          {/* ── ATTRIBUTION ──────────────────────────────────────────────────
              ⚠ THIS IS THE BLOCK THAT WAS WRAPPING TO TWO CRAMPED LINES AT PHONE WIDTH
              — Canvass-8's own finding, fixed here because the brief asks for it. Three
              facts, three labelled rows; see `Field` for why the shape was the cause.
              ⚠ THE STATUS PILL MOVES HERE FROM THE HEADER CARD, and that is a correction
              rather than a rearrangement: "locked or provisional" is a fact about the
              RECORD, and sitting beside the client's name it read as a property of the
              PERSON. */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <CardTitle>Attribution</CardTitle>
              <StatusPill isFlagged={client.isFlagged} isSticky={client.isSticky} />
            </div>
            <dl style={{ margin: 0 }}>
              <Field label="Source">
                {SOURCE_LABELS[client.assignmentSource] || client.assignmentSource || 'Unknown'}
              </Field>
              {/* ⚠ SPELLED OUT RATHER THAN LEFT TO THE PILL. The pill is a one-word state
                  and this row says what that state MEANS — they are not redundant, and a
                  rep who does not yet know the vocabulary has only this row. */}
              <Field label="Status">
                {client.isSticky ? 'First assignment locked' : 'Provisional — not yet locked'}
              </Field>
              {/* ⚠ OMITTED ENTIRELY WHEN ABSENT, never rendered as a dash. A dash in a
                  labelled row is a claim that we looked and there was nothing; an absent
                  row makes no claim at all. Same rule as the membership badge. */}
              {client.assignedAt && (
                <Field label="Assigned">
                  {new Date(client.assignedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Field>
              )}
            </dl>
          </Card>

          {/* ── PIPELINE ─────────────────────────────────────────────────────
              ⚠ THE "No referral record" SENTENCE STAYS HERE, AND THAT IS NOT A
              CONTRADICTION OF PART 4d. That ruling removed the label from LIST ROWS,
              where it was repeated text on 264 of 272 rows that told a rep nothing
              actionable. Here it is the entire content of a section the rep opened
              deliberately, and a titled section with nothing in it reads as a failed
              load. **Showing nothing is right where the row already says enough; saying
              why is right where the rep is asking.** */}
          <Card>
            <CardTitle>Pipeline</CardTitle>
            <Line>{client.stage ? (STAGE_LABELS[client.stage] || client.stage) : NO_STAGE_LABEL}</Line>
            {/* ⚠ THE ONE HONEST FRAGMENT OF THE MOCKUP'S REFERRAL CHAIN. A referred
                client carries a referrer NAME and nothing else — no id, no link, no
                second hop. Showing the name is true; drawing an arrow diagram from it
                would be an invention. */}
            {client.referredBy && (
              <dl style={{ margin: 0 }}>
                <Field label="Referred by">{client.referredBy}</Field>
              </dl>
            )}
          </Card>

          <RevenueCard revenueHidden={client.revenue_hidden === true} />

          {/* ── THE FLAGGED CARD — mockup screen 8, which is 4b plus this ───── */}
          {client.isFlagged && (
            <Card accent={statusVar('warning')}>
              <CardTitle>Pending review</CardTitle>
              <Line>
                Another rep was also matched to this client. An owner or admin resolves it.
              </Line>
            </Card>
          )}
        </>
      )}
    </>
  );
}

export { RevenueCard };
