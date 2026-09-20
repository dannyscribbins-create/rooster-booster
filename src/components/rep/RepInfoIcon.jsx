import { useId, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';
import { entrance } from './repMotion';
import { glossary } from './repGlossary';

// ─── THE INFO AFFORDANCE — Canvass-9b ────────────────────────────────────────
//
// 9a reserved the room and built nothing, on A29's reasoning: *a control that is
// present but inert reads as an oversight, and the next person to see it enables
// it.* This is the mechanism arriving into that reserved room.
//
// ── ⚠ AN INLINE DISCLOSURE, NOT A FLOATING POPOVER, AND THAT IS A PHONE DECISION ─
// The obvious build is an absolutely-positioned bubble anchored to the icon. On a
// 430px screen the stat cards are ~190px wide, so a bubble wide enough to hold a
// sentence **overflows its own card immediately** and needs collision maths,
// flipping, and a viewport clamp — three things that are wrong at some width nobody
// tested. The panel here is a BLOCK inside the card, full card width, and cannot
// overflow at any width because it is not positioned at all.
//
// ⚠ THE CARD GROWS WHILE IT IS OPEN, AND THAT IS ACCEPTED RATHER THAN OVERLOOKED.
// A deliberate tap producing a deliberate reflow is legible; a bubble clipped by a
// card edge is not. **The grid reflow is the cost and it is the smaller one.**
//
// ── ⚠ IT IS NOT THE ONLY ROUTE TO THE FACT ──────────────────────────────────
// Danny's constraint on the long-press applies here in the same spirit: an
// affordance must not be the only way to reach something. It is not — the label is
// already true on its own (see `repGlossary`'s header), and the popup adds depth.
// **A rep who never taps this misses elaboration, never information they need.**
//
// ── ⚠ Q2 FROM CANVASS-8: THE GRAPHIC FLOOR, MEASURED ON THE RENDERED NODE ───────
// An icon is a GRAPHIC element answering the **3:1** floor, not the 4.5 text floor —
// the same distinction `RowChevron` records and the same reason `MUTED = 0.72` is
// not reused here. Measured in the browser pass, both modes, both brands, on the
// card ground it actually sits on. The figures are in the commit body and the
// checklist; they are deliberately NOT restated here, because a contrast number
// copied into a component comment is a fact in two places and this repo has counted
// what that costs.
//
// ⚠ AND THE ICON IS NOT FADED. `RowChevron` is at 0.55 because a chevron is
// decoration repeated on every row; this is a CONTROL a rep is meant to find, and
// fading a control to match nearby decoration is how an affordance becomes
// invisible. It carries full-strength `--rm-text`.

const PANEL_ID_PREFIX = 'rep-info';

/**
 * @param {keyof import('./repGlossary').REP_GLOSSARY} termKey
 * @param {string} [label] - overrides the accessible name. Defaults to the term.
 */
export default function RepInfoIcon({ termKey, label = null }) {
  // ⚠ THROWS ON AN UNKNOWN KEY, at render, rather than opening an empty panel. See
  // `glossary()` — a control that is present and says nothing is worse than none.
  const entry = glossary(termKey);
  const [open, setOpen] = useState(false);
  // ⚠ `useId` RATHER THAN A COUNTER OR THE TERM ITSELF. The same term appears on
  // BOTH Home and Clients (`locked`, `provisional`), so a term-derived id would
  // produce duplicate ids the moment both screens are in one document — which they
  // are in the branding preview. React owns uniqueness here.
  const id = `${PANEL_ID_PREFIX}-${useId()}`;

  return (
    <>
      <button
        type="button"
        data-rep-info-icon={termKey}
        aria-expanded={open}
        aria-controls={id}
        // ⚠ THE ACCESSIBLE NAME SAYS WHAT IT EXPLAINS, not "info". A screen reader
        // hearing "info, button" five times on one screen has been told nothing;
        // "About Locked, button" is navigable.
        aria-label={`About ${label || entry.term}`}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          // ⚠ A 24px TARGET AROUND A 15px GLYPH. The glyph is small by design — it
          // must not compete with the label — but the TARGET is not, because a
          // control a thumb cannot hit is a control that does not exist.
          width: 24, height: 24, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--rm-text, #1C2D4D)',
          flexShrink: 0,
        }}
      >
        <Info size={15} weight="bold" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={id}
          data-rep-info-panel={termKey}
          // ⚠ `role="note"` RATHER THAN `dialog`. It traps no focus and takes no
          // decision — announcing it as a dialog would promise a modal that must be
          // dismissed before anything else can happen, which is not what this is.
          role="note"
          style={{
            // ⚠ `flexBasis: 100%` IS WHAT MAKES THIS TAKE ITS OWN ROW inside the
            // card's flex heading row without being positioned. A plain block child
            // of a flex row would sit BESIDE the label; this forces a wrap.
            flexBasis: '100%',
            width: '100%',
            margin: '8px 0 0',
            padding: '10px 12px',
            borderRadius: 10,
            // The recess ground, so the panel reads as inset into the card rather
            // than as a second card stacked on it. `--rm-text` is floored against
            // recess by construction (A34.1), so the body copy needs no separate
            // per-brand measurement.
            background: 'var(--rm-recess, #ECF0F8)',
            border: `1px solid ${elevationVar('border')}`,
            fontFamily: fontVar('body'),
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--rm-text, #1C2D4D)',
            ...entrance({ fadeOnly: true }),
          }}
        >
          {entry.body}
        </div>
      )}
    </>
  );
}
