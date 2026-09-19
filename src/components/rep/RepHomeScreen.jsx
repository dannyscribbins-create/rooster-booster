import { useEffect, useState } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { statusVar } from '../../constants/statusTheme';
import { BACKEND_URL } from '../../config/contractor';
import { getAdminToken } from '../../utils/authStorage';
import { safeAsync } from '../../utils/clientErrorReporter';
import { STAGE_LABELS } from './RepClientsScreen';

// ─── THE HOME TAB — mockups 2A/2B, on ruling ④ (Canvass-6) ──────────────────
//
// ⚠ TODAY'S FOCUS IS TWO SECTIONS WITH TWO HONEST LABELS, AND THE REASONING IS
// RECORDED HERE SO IT IS NOT "SIMPLIFIED" BACK INTO ONE LIST.
//   **Furthest along** ranks clients that HAVE a pipeline stage, by that stage.
//   **Recently assigned** ranks the rest, by assignment date.
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
// ⚠ CONV IS NOT HERE EITHER — see the checklist entry. It is computable, but its
// population on Accent could not be measured from this environment and the standing
// rule is not to ship a card that always reads 0.
const STAT_CARDS = Object.freeze([
  { key: 'clients', label: 'CLIENTS' },
  { key: 'locked', label: 'LOCKED' },
  { key: 'provisional', label: 'PROVISIONAL' },
  { key: 'flagged', label: 'FLAGGED' },
]);

function StatCard({ label, value, alert = false }) {
  return (
    <div
      style={{
        // ⚠ FLEX-GROW RATHER THAN A FIXED GRID COLUMN, SO THE ROW REFLOWS. §b records
        // that 2B's remaining cards stretch when revenue is dropped: "a three-card grid
        // with a hole would satisfy the prose and contradict the design". A hole is what
        // a rep would read as a lock.
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
        color: alert && value > 0 ? statusVar('warningText') : 'var(--rm-text, #1C2D4D)',
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

function FocusRow({ client, onOpen, trailing }) {
  return (
    <li
      onClick={onOpen ? () => onOpen(client.jobberClientId) : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(client.jobberClientId); } } : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      style={{
        listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 0',
        borderBottom: `1px solid ${elevationVar('border')}`,
        cursor: onOpen ? 'pointer' : undefined,
        fontFamily: fontVar('body'),
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
    </li>
  );
}

// ⚠ BOTH SECTIONS USE THIS SAME SHELL, AT THE SAME WEIGHT, DELIBERATELY. If the first
// section were styled as secondary while it is small, filling up later would require a
// restyle — and the ruling is that it becomes the real focus with no code change.
function FocusSection({ title, subtitle, clients, onOpen, trailingFor, emptyCopy }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{
        margin: '0 0 2px', fontFamily: fontVar('heading'),
        fontSize: 17, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)',
      }}>
        {title}
      </h2>
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
const PREVIEW_SAMPLE = Object.freeze({
  stats: { clients: 128, locked: 121, provisional: 7, flagged: 2 },
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

export default function RepHomeScreen({ onOpenClient = null, preview = false }) {
  const [state, setState] = useState(
    preview
      ? { status: 'ready', stats: PREVIEW_SAMPLE.stats, focus: PREVIEW_SAMPLE.focus }
      : { status: 'loading', stats: null, focus: null }
  );

  useEffect(() => {
    // ⚠ FIRST LINE, BEFORE ANYTHING IS CONSTRUCTED. B-4's fence asserts the branding
    // preview fires NO request; returning here is what makes that structural.
    if (preview) return undefined;
    let live = true;
    safeAsync(async () => {
      try {
        const token = getAdminToken();
        const res = await fetch(`${BACKEND_URL}/api/rep/home`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`rep home: HTTP ${res.status}`);
        const data = await res.json();
        if (live) setState({ status: 'ready', stats: data.stats, focus: data.focus });
      } catch {
        if (live) setState((s) => ({ ...s, status: 'error' }));
      }
    }, 'RepHomeScreen/load')();
    return () => { live = false; };
  }, [preview]);

  const { status, stats, focus } = state;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: '0 0 4px', fontFamily: fontVar('heading'),
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          Today&apos;s focus
        </h1>
        {/* ⚠ THE MOCKUP'S BANNER COPY IS NOT REPRODUCED. 2A/2B read "Two referral chains
            are one step from conversion" — which is about the referral CHAIN, the very
            thing A34.5 replaced with the one-hop version. Reproducing it would put
            two-hop copy over one-hop data, the lie A34.5 names. */}
        <p style={{ margin: 0, fontSize: 15, opacity: MUTED, color: 'var(--rm-text, #1C2D4D)' }}>
          Your book at a glance
        </p>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            {STAT_CARDS.map((c) => (
              <StatCard key={c.key} label={c.label} value={stats[c.key] ?? 0} alert={c.key === 'flagged'} />
            ))}
          </div>

          <FocusSection
            title="Furthest along"
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
        </>
      )}
    </>
  );
}

export { StatCard, FocusSection, FocusRow, STAT_CARDS };
