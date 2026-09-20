import { elevationVar, fontVar } from '../../constants/elevationTheme';

// ─── THE TIMEFRAME BAR — Canvass-9a, Home and Clients ────────────────────────
//
// The mockup draws a four-segment window selector above the stats. This is it,
// built once and mounted on both screens, because two copies of a control that
// filters two payloads is how the two screens end up meaning different things by
// "This week".
//
// ── ⚠ WHAT IT FILTERS, AND THE DECISION IS RECORDED HERE BECAUSE THE BRIEF ────
//    ASKED FOR IT PER-STAT AND THE ANSWER IS "ALL OF THEM".
//
// Danny's framing: *"'39 clients' is a current total; 'clients assigned this week'
// is a different number and a different meaning. A grid where some cards respond
// and others do not is confusing unless it is visually obvious which is which."*
//
// **Ruled: every stat under this bar responds to it. None is exempt.** The window
// is applied to the date the ASSIGNMENT was made — `COALESCE(sticky_set_at,
// provisional_set_at)` — and, for conversions, to the conversion's own date.
//
// ⚠ THE ALTERNATIVE WAS REJECTED ON THE BRIEF'S OWN REASONING RATHER THAN ON
// TASTE. A mixed grid — CLIENTS a running total beside CONVERSIONS a windowed
// count — needs a per-card marker saying which is which, and a rep has to learn
// the marker before any number on the screen can be trusted. Making every card
// obey one window removes the question instead of answering it: **the window is
// stated ONCE, in the section's own subtitle directly above the grid, and it
// governs everything beneath it.** That is how "which ones respond" is made
// obvious — there is nothing to distinguish.
//
// ⚠ AND `all` IS THE DEFAULT, WHICH IS WHAT PRESERVES THE RUNNING TOTAL. The
// number a rep sees on arrival is still the size of their whole book; the windowed
// readings are something they ask for. Defaulting to `week` would silently shrink
// every number on the entry screen and read as data loss.
//
// ⚠ IT DOES NOT FILTER TODAY'S FOCUS. Those two lists answer "what should I do
// now", which is not a question about a date range — a client assigned in March
// sitting at `sold` is exactly what a rep wants on that list in September. The
// brief scopes the bar to the stats and that scope is kept.
//
// ── ⚠ ON THE CLIENTS TAB IT ALSO FILTERS THE LIST, AND THAT IS A DECISION ────
// The brief says "it filters the stats". On Home that is the whole screen content
// under the bar. On Clients the LIST is the dominant element, and a bar at the top
// of that screen that windowed two small cards while leaving the list untouched
// would put TWO different windows on one screen — the thing this control exists to
// avoid. **One control on one screen means one thing**, so the list and its count
// obey the same window. Reported to Danny as a decision rather than buried, since
// it reaches further than "the stats".

// ⚠ `all` CARRIES NO BOUND, IT IS NOT A 100-YEAR WINDOW. A sentinel window would
// silently drop a row with a null assignment date; the absence of a predicate
// cannot. The server branches on this value rather than computing a date from it.
const TIMEFRAMES = Object.freeze([
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
  { key: 'all',   label: 'All' },
]);

// The window's name, for the sentence that states it once above the grid. ⚠ These
// are the ONLY place the window is described in prose, so a stat card never has to
// carry a qualifier of its own.
const TIMEFRAME_PHRASES = Object.freeze({
  week:  'assigned in the last 7 days',
  month: 'assigned in the last 30 days',
  year:  'assigned in the last 12 months',
  all:   'all time',
});

const MUTED = 0.72;

/**
 * @param {'week'|'month'|'year'|'all'} value
 * @param {(next: string) => void} onChange
 */
export default function RepTimeframeBar({ value, onChange, label = 'Timeframe' }) {
  return (
    <div
      data-rep-timeframe=""
      role="group"
      aria-label={label}
      style={{
        display: 'flex',
        gap: 4,
        padding: 3,
        marginBottom: 12,
        background: 'var(--rm-surface, #FFFFFF)',
        border: `1px solid ${elevationVar('border')}`,
        borderRadius: 999,
        fontFamily: fontVar('body'),
      }}
    >
      {TIMEFRAMES.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            // ⚠ aria-pressed, NOT a tablist. These buttons do not reveal panels —
            // they re-query one payload — so `tab` would promise a relationship to
            // tabpanels that does not exist. A pressed toggle is what this is.
            aria-pressed={selected}
            data-rep-timeframe-option={t.key}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => { if (!selected) onChange(t.key); }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '7px 4px',
              borderRadius: 999,
              border: 'none',
              cursor: selected ? 'default' : 'pointer',
              fontFamily: fontVar('body'),
              fontSize: 13,
              fontWeight: 600,
              // ⚠ THE SELECTED FILL IS `--rm-primary` AND ITS INK IS
              // `--rm-on-primary`, WHICH IS THE COMPUTED CONTRAST PAIR FOR IT —
              // never a literal white. The platform primary is the orange #F26A1B
              // and its floored pair is BLACK, which is why the fallback below says
              // #000000 and not the #FFFFFF it looks like it should say. Writing the
              // plausible one is the defect `themeKeyIntegrity` fires on, and it has
              // caught exactly this on the Profile avatar already.
              background: selected ? 'var(--rm-primary, #F26A1B)' : 'transparent',
              color: selected ? 'var(--rm-on-primary, #000000)' : 'var(--rm-text, #1C2D4D)',
              // The unselected label is faded to the shell's constant; the selected
              // one is full strength on its own fill and must NOT be faded, or the
              // floored pair stops being the pair that was floored.
              opacity: selected ? 1 : MUTED,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export { TIMEFRAMES, TIMEFRAME_PHRASES };
