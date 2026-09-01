import { useContext } from 'react';
import { ThemeContext } from '../shared/ThemeProvider';

// ─── THE REP BOTTOM NAV — C/DL-3c Phase 3-A, amendment A29 ───────────────────
//
// Four tabs across the full width: Home · Clients · Network · Profile. The
// mockup draws FIVE slots, the middle one a raised orange FAB for Add Client.
// A24 places Add Client in 3d, so Phase 3 ships this bar FAB-AWARE BUT CLOSED.
//
// ── ⚠ WHAT "FAB-AWARE BUT CLOSED" MEANS HERE, MECHANICALLY ─────────────────
// `centreSlot` defaults to null and NOTHING is rendered for it — no element, no
// width, no gap. 3d passes a node and the bar re-splits around it on its own.
// That is A29's binding requirement: 3d must not have to rewrite this layout in
// order to insert a child.
//
// ⚠ NO FAB IN ANY FORM. Not disabled, not greyed, not dimmed, not tooltipped,
// not wired to a no-op. Every one of those is Add Client existing in Phase 3,
// and A29 rules them out by name. The reason is not tidiness: a control that is
// present but inert reads as an oversight, and the next person to see it enables
// it. An absent control is a decision; a disabled one is an invitation.
//
// ── ⚠ "EVENLY DISTRIBUTED" AND "A FUNCTION OF THE SLOT" ARE THE SAME RULE ───
// Phase 0 flagged these as possibly in tension, and they are only in tension if
// evenness is written as a VALUE. It is not. Every tab carries `flex: 1` and
// nothing carries a width, so the even quarters in Phase 3 are an EMERGENT
// PROPERTY of the flex rule rather than a number anyone typed. Put a
// fixed-width child in the middle and the same rule distributes what is left —
// four equal tabs around it — with no edit here. Had this been `width: 25%`,
// evenness would have been true and the layout would have had to be rewritten
// for 3d; that is the version A29 is guarding against.
//
// ── THE PALETTE IS TOKENS, AND ONE MOCKUP CHOICE IS OVERRULED ──────────────
// ⚠ THE ACTIVE LABEL IS NOT ORANGE, AND THAT IS A MEASURED DEPARTURE FROM THE
// MOCKUP. The mockup paints the active tab's dot AND its label in the primary.
// Measured with this repo's own contrastRatio() against its own
// TEXT_CONTRAST_MIN of 4.5: the platform primary on the light surface is
// 3.064:1, and an ordinary blue brand primary is 4.289:1 — both BELOW the text
// floor, in light mode, for the default brand. Dark mode is fine (5.586:1), so
// shipping the mockup's choice would fail in exactly the mode that has always
// shipped.
//
// ⚠ AND THE ENGINE CANNOT RESCUE IT. `primary` is STORED, not derived, and is
// floored only against the weaker non-text threshold — deliberately, because it
// is a fill. So there is no nudge loop that would make an orange label pass.
//
// THE RESOLUTION KEEPS THE MOCKUP'S STRUCTURE: the DOT carries the primary,
// where 3:1 is the correct floor for a graphic and 3.064:1 clears it, and the
// LABEL stays on --rm-text and signals active by WEIGHT. The tab still reads as
// selected, in both modes, for any brand the resolver can produce.

// Tab ids are also the entry SCREEN ids the shell opens — see RepShell's
// TAB_FOR_SCREEN, which is what lets a sub-screen keep its parent tab lit.
export const REP_TABS = Object.freeze([
  { id: 'home', label: 'Home' },
  { id: 'clients', label: 'Clients' },
  { id: 'network', label: 'Network' },
  { id: 'profile', label: 'Profile' },
]);

// Where the centre slot sits when there is one. Written as a constant rather
// than a literal 2 so the split point is named at the one place that uses it.
const CENTRE_INDEX = 2;

/**
 * @param {string} activeTab - one of REP_TABS' ids.
 * @param {(tabId: string) => void} onSelect
 * @param {React.ReactNode} centreSlot - 3d's Add Client FAB. NULL in Phase 3,
 *        and null renders nothing at all rather than an empty box.
 */
export default function RepBottomNav({ activeTab, onSelect, centreSlot = null }) {
  const { mode } = useContext(ThemeContext);

  // A HAIRLINE FROM A TOKEN, NOT A BLACK-ALPHA LITERAL. StateCard's border is a
  // raw black alpha and DISAPPEARS on the near-black dark surface — the finding
  // the mockup inventory records and 3-D owns fixing. Deriving the rule from
  // --rm-text means it flips with the mode instead of dissolving into it, and
  // the opacity sits on a dedicated element so it cannot dim the tabs.
  const hairline = (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'var(--rm-text, #1C2D4D)', opacity: 0.12, pointerEvents: 'none',
      }}
    />
  );

  const renderTab = (t) => {
    const active = t.id === activeTab;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onSelect(t.id)}
        aria-current={active ? 'page' : undefined}
        data-rep-tab={t.id}
        data-rep-tab-active={String(active)}
        style={{
          // ⚠ THE WHOLE LAYOUT RULE IS THIS ONE DECLARATION. See the header.
          flex: 1,
          background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          font: 'inherit',
        }}
      >
        {/* The dot carries the primary — a graphic at the 3:1 floor, which is
            the threshold the resolver actually guarantees for `primary`. */}
        <span
          aria-hidden="true"
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: active ? 'var(--rm-primary, #F26A1B)' : 'var(--rm-text, #1C2D4D)',
            opacity: active ? 1 : 0.4,
            transition: 'opacity 200ms ease',
          }}
        />
        <span
          style={{
            fontFamily: 'Roboto, system-ui, sans-serif',
            fontSize: 13,
            fontWeight: active ? 700 : 500,
            color: 'var(--rm-text, #1C2D4D)',
            opacity: active ? 1 : 0.65,
            letterSpacing: '0.01em',
          }}
        >
          {t.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Field rep sections"
      data-rep-nav=""
      data-rep-nav-mode={mode}
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(430px, 100vw)',
        background: 'var(--rm-surface, #FFFFFF)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 100,
        paddingTop: 12,
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {hairline}
      {REP_TABS.slice(0, CENTRE_INDEX).map(renderTab)}
      {/* NULL IN PHASE 3 — renders nothing, occupies nothing, leaves no gap. */}
      {centreSlot}
      {REP_TABS.slice(CENTRE_INDEX).map(renderTab)}
    </nav>
  );
}
