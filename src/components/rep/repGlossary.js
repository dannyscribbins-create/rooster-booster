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
  //
  // ⚠ REWORDED (Canvass-stage Part 4) BECAUSE THE OLD COPY CONTRADICTED A36.3, WHICH
  // IS A RULING AND NOT A MATTER OF TASTE. It read "credited to you for good. A later
  // match cannot move them to someone else." — a flat claim of permanence. A36.3
  // (DECISION_C_DL_BUILD_SPEC.md §25) makes Owner/Admin manual reassignment the one
  // path that supersedes sticky BY DESIGN, and §25 records that (h)'s premise — that
  // sticky can never be corrected later — was FALSE. So the old sentence told a rep
  // something the system does not guarantee, and the case where it breaks is exactly
  // the case a rep would care about: an admin moving their client away.
  //
  // ⚠ IT NAMES THE EXCEPTION RATHER THAN SOFTENING THE RULE. "A later match cannot
  // move them" keeps the true and reassuring half — automatic reattribution really is
  // foreclosed — and "only an owner or admin can" is the A36.3 override said out loud.
  // A vaguer hedge would have been honest and useless.
  locked: Object.freeze({
    term: 'Locked',
    body: 'The client is credited to you. A later match cannot move them — only an owner or admin can.',
  }),

  // ⚠ SAYS WHAT HAPPENS NEXT RATHER THAN ONLY WHAT IS TRUE NOW, because the useful
  // question a rep has about a provisional client is "do I need to do something".
  // ⚠ CORRECTED 2026-09-22, AND THE OLD WORDING WAS A PROMISE THE ENGINE STOPPED KEEPING.
  // It read *"It locks once the job reaches a stage that confirms it"*, which was true
  // until Danny's confidence ruling: when an approved quote names someone who is not
  // mapped to a team member, the client is now left PROVISIONAL rather than being frozen
  // to the second-best match. Those clients do not lock when the job is created, and a
  // rep reading the old sentence would have waited for something that never happens.
  // ⚠ AND THE GENERAL RULE FOR EVERY REP-FACING STRING ABOUT THIS PAIR: the split is
  // CONFIDENCE, never ownership or safety. A provisional client is fully in the rep's
  // book — the book predicate is COALESCE(sticky, provisional) — so copy that implies
  // "locked = really mine" or "provisional = might be taken away" is wrong in a way that
  // costs trust. The provisional population grew on purpose; see
  // PRE_LAUNCH_CHECKLIST.md, the confidence-rule entry.
  provisional: Object.freeze({
    term: 'Provisional',
    body: 'You are matched to this client for now. It locks when your CRM confirms who closed the job — some clients stay provisional, and they are still yours.',
  }),

  // ⚠ DANNY'S OWN WORDING, VERBATIM, AND NOT TO BE EDITED WITHOUT HIM. It is the one
  // string in this file that is already approved.
  attributionType: Object.freeze({
    term: 'Attribution type',
    body: 'Clients matched to you through any means are credited to you.',
  }),

  // ⚠ THIS DEFINITION EXISTS BECAUSE THE LABEL ALONE CANNOT CARRY IT. "Conversions"
  // is the right word and it leaves two real questions open, both of which a rep will
  // otherwise answer wrongly from experience: does selling the same customer twice
  // count twice (yes), and does a job added to an existing project count again (no).
  //
  // ⚠ AND IT MUST NOT SAY "referrals". A rep's conversions count SALES, repeats
  // included; a referrer's payouts count PEOPLE REFERRED, once each. The two numbers
  // measure different things by ruling, so the breakdown's Referral figure can exceed
  // that referrer's payouts — this sentence is what stops a rep reading one as the
  // other, and it is the reason the term is defined at all.
  conversions: Object.freeze({
    term: 'Conversions',
    body: 'Every sale in your book. Selling the same client again counts again, but jobs booked close together count as one sale. Referral and Direct split the same total — Referral counts sales from clients who came through the referral programme, which is not the same as what a referrer is paid.',
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
