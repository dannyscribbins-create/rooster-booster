'use strict';

// ── ATTRIBUTION TAGS — A RESERVED NAMESPACE THAT CAMPAIGNS CANNOT SELECT ─────
// (Danny, 2026-09-22)
//
// A departed rep's clients are marked on the CLIENT RECORD with an ordinary contact tag,
// so they are searchable and filterable with the machinery that already exists. ⚠ AND
// THAT IS EXACTLY WHY THEY NEED A FENCE: campaign audiences are built FROM contact tags
// (evaluateAudience reads `filter_json.tags`), so without one, "everyone Tom used to
// have" is one click away from being an email list — a marketing send built out of an
// attribution record, to people who never opted into anything of the sort.
//
// THE SEPARATION: a reserved PREFIX, enforced in two places that fail in opposite
// directions.
//   1. THE CATALOGUE hides them, so nobody can pick one by accident.
//   2. ⚠ evaluateAudience FAILS CLOSED on one anyway — an audience whose filter names an
//      attribution tag resolves to ZERO members. Hiding alone would be a UI convention;
//      a filter_json row can be written by an import, a fixture, or a future editor.
// ⚠ AND FAILING CLOSED IS WHY THE TAG IS NOT SIMPLY DROPPED FROM THE FILTER. Dropping it
// from an AND filter WIDENS the audience — `attribution:x AND paid-customer` would become
// `paid-customer`, which is a bigger send than the person asked for. Empty is the only
// safe answer.
//
// ⚠ IT IS A PREFIX RATHER THAN A `source` VALUE, and that is a schema fact rather than a
// preference: audiences select tags BY NAME (`ct.tag = $n`), so a rule written against
// `source` would not be consulted by the query that matters.

const ATTRIBUTION_TAG_PREFIX = 'attribution:';

// SQL fragment for the tag CATALOGUE queries — the lists an admin picks from.
// Written once here so a third catalogue cannot quietly ship without the exclusion.
const ATTRIBUTION_TAG_SQL_EXCLUSION = `tag NOT LIKE '${ATTRIBUTION_TAG_PREFIX}%'`;

function isAttributionTag(tag) {
  return typeof tag === 'string' && tag.startsWith(ATTRIBUTION_TAG_PREFIX);
}

/**
 * The tag for a client whose rep has been deactivated.
 *
 * ⚠ IT NAMES THE PERSON ON PURPOSE. A contractor reading the client's record has to
 * understand why the client is marked, and "former rep" alone answers nothing. The name
 * is the member's full_name, falling back to their email — the same order the admin team
 * list uses — so the tag reads as a sentence: `attribution:former-rep:Tom Rees`.
 * ⚠ IT IS A RECORD, NOT A STATE MACHINE. Nothing reads this tag to decide ownership; the
 * assignment row does that. Re-activating the member removes it.
 */
function formerRepTag(memberNameOrEmail) {
  const name = (memberNameOrEmail || '').trim() || 'a former team member';
  return `${ATTRIBUTION_TAG_PREFIX}former-rep:${name}`;
}

module.exports = {
  ATTRIBUTION_TAG_PREFIX,
  ATTRIBUTION_TAG_SQL_EXCLUSION,
  isAttributionTag,
  formerRepTag,
};
