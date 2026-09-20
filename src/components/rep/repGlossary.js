// ─── THE REP APP'S GLOSSARY — ONE COPY SOURCE (Canvass-9b) ───────────────────
//
// Canvass-8 filed three open questions about the info affordance. This file answers
// the first, and the other two are answered where they are observable rather than
// here — see the bottom of this header.
//
// ── Q1: ONE COPY SOURCE ─────────────────────────────────────────────────────
// **Every explanation in the rep app is defined here exactly once**, and the card,
// the popup and any test all read the SAME binding. The alternative — a string on
// the card and a longer one in the popup — is two copies of one claim, and this
// repo has the measured precedent: `preset_2` was a TRIPLET of byte-identical
// cashout strings across three files, and the drift is what made it a defect.
//
// ⚠ AND THE FAILURE MODE HERE IS WORSE THAN DRIFT, IT IS CONTRADICTION. A label and
// its own explanation disagreeing is not a typo; it is the screen telling a rep two
// different things about one number, with the popup — the thing they opened
// deliberately — carrying more authority than the label they were reading.
//
// ── ⚠ THE LABEL MUST BE TRUE WITHOUT THE POPUP. THAT IS THE BINDING CONSTRAINT ──
// A rep who never taps the icon must not be misled. So `term` is not a shortened
// label that the explanation rescues — it is already true, and `body` adds DEPTH.
// The conversions card records the same rule at its own site and this is the second
// statement of one principle, not a second principle.
//
// ── ⚠ WHAT DELIBERATELY HAS NO ENTRY, AND WHY EACH ABSENCE IS A DECISION ────────
//   · **FLAGGED** — ruled by Danny: *no explanatory language about it anywhere in
//     the app.* An FAQ and contractor training cover the concept. It is a pill on
//     the rows it applies to and nothing else; a rep can take no action on a flag an
//     owner resolves. ⚠ **Adding a friendly one-liner here is the obvious helpful
//     move and it is forbidden.**
//   · **REFERRAL CONVERSIONS** — it already explains itself. The card carries a
//     definition line, *"People your clients referred who have become customers"*,
//     which is the explanation an icon would have opened. A second route to the same
//     sentence is clutter, not help.
//   · **The two Clients-tab cards** reuse `locked` and `provisional` from here rather
//     than getting their own entries — same term, same screen family, one source.
//
// ── Q2 (graphic-floor contrast) and Q3 (shared with admin) ──────────────────────
// ⚠ **Q2 IS NOT ANSWERABLE IN THIS FILE AND MUST NOT BE ASSERTED HERE.** An icon's
// contrast is a property of the rendered node on a ground, and is measured in the
// browser pass on both modes and both brands. `RepInfoIcon` carries the figures.
// ⚠ **Q3 IS ANSWERED "NO", AND IT WAS CHECKED RATHER THAN ASSUMED.** The admin tree
// does not mention "provisional" ANYWHERE — measured across `src/components/admin`
// — so there is no admin surface explaining this vocabulary and therefore nothing to
// share with. **This file stays in the rep tree for exactly that reason**: inventing
// a `src/constants` module for a single consumer is the "never introduce a shared
// export as a side effect" failure, and it would also imply a sharing that does not
// exist. **If 3d gives the admin panel these terms, that is the moment to promote
// this file — not before.**

/**
 * @typedef {{ term: string, body: string }} GlossaryEntry
 */

// ⚠ THE `body` STRINGS ARE PROVISIONAL AND ARE WITH DANNY FOR REVIEW. They are
// written to his stated constraint — true on their own, adding depth rather than
// rescuing a label — but the wording is his call and he asked to see it before it
// ships as final. `attributionType` is the ONE he supplied, verbatim.
export const REP_GLOSSARY = Object.freeze({
  // ⚠ "ASSIGNED TO YOU" IS THE WHOLE POINT OF THIS ENTRY. A rep reading "272
  // CLIENTS" on a screen inside their contractor's app can reasonably read it as the
  // contractor's client list. It is not: it is their own book, and the number moves
  // only when an assignment does.
  clients: Object.freeze({
    term: 'Clients',
    body: 'Every client assigned to you. This is your book, not the whole company list — it changes when a client is assigned to you or moved away.',
  }),

  // ⚠ THE TERM A REP IS MOST LIKELY TO GUESS WRONG. "Locked" sounds like a
  // restriction on THEM. It is the opposite: it is the credit being settled in their
  // favour and no longer reassignable by a later event.
  locked: Object.freeze({
    term: 'Locked',
    body: 'The client is credited to you for good. A later match cannot move them to someone else.',
  }),

  // ⚠ SAYS WHAT HAPPENS NEXT RATHER THAN ONLY WHAT IS TRUE NOW, because the useful
  // question a rep has about a provisional client is "do I need to do something".
  provisional: Object.freeze({
    term: 'Provisional',
    body: 'You are matched to this client for now, but it is not settled. It locks once the job reaches a stage that confirms it.',
  }),

  // ⚠ DANNY'S OWN WORDING, VERBATIM, AND NOT TO BE EDITED WITHOUT HIM. It is the one
  // string in this file that is already approved.
  attributionType: Object.freeze({
    term: 'Attribution type',
    body: 'Clients matched to you through any means are credited to you.',
  }),
});

/**
 * Look an entry up, refusing an unknown key rather than returning something
 * plausible.
 *
 * ⚠ IT THROWS. A missing entry returning `undefined` would render an info icon that
 * opens an empty panel — a control that is present and says nothing, which is worse
 * than no control and is the exact shape A29 rules against for the nav FAB. A throw
 * surfaces in development and in the suite, where a silent empty panel would not.
 *
 * @param {keyof typeof REP_GLOSSARY} key
 * @returns {GlossaryEntry}
 */
export function glossary(key) {
  const entry = REP_GLOSSARY[key];
  if (!entry) throw new Error(`repGlossary: no entry for "${key}"`);
  return entry;
}
