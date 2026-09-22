'use strict';

// ── REP-SCOPE MIRROR ROWS STAY OUT OF CAMPAIGNS (Canvass-stage, Rep Step 4) ─────
//
// Rep Step 4 creates jobber_clients rows — WITH full identity — for clients the rep
// scope reached but the campaign import did not (Danny, 2026-09-22). Such a row is
// marked `rep_scope_only = true` and must receive no contact_tags and enter no
// campaign audience.
//
// ⚠ WHY A ROW ALONE WOULD LEAK: evaluateAudience()'s NO-TAG branch selects EVERY
// jobber_clients row of the contractor, so a mirror row with zero tags still joins an
// "all clients" audience. And the contact matching pass links app contacts to any
// matching jobber_clients row and then WRITES a `tier_2` contact_tag on it. Both
// readers therefore carry this predicate.
//
// ⚠ THE FLAG IS NOT THE WHOLE TEST, AND THE SECOND HALF IS WHAT KEEPS IT FROM BEING A
// PERMANENT EXCLUSION. Every campaign-side writer that creates or refreshes a mirror
// row — Step H+I of the full import, the client webhooks, jobberIncrementalSync — also
// writes the permanent `jobber_client` system tag. So "flagged AND never tagged
// jobber_client" means exactly "only the rep scope has ever touched this row". The
// moment a campaign writer ingests the client for its own reasons (they pay, they are
// edited in Jobber), the tag arrives and the row becomes campaign-visible — with NO
// change to any of those writers, which ruling 2 keeps exactly as they are.
// ⚠ For every row that existed before this column did, the flag is false and the
// predicate is TRUE — so existing audiences and matching are unchanged by construction.

/**
 * SQL predicate, true when the jobber_clients row at `alias` may be seen by campaign
 * machinery. `alias` is a trusted literal from the caller, never user input.
 */
function campaignVisibleClient(alias) {
  return `NOT (${alias}.rep_scope_only AND NOT EXISTS (
      SELECT 1 FROM contact_tags ct_rs
       WHERE ct_rs.contractor_id = ${alias}.contractor_id
         AND ct_rs.jobber_client_id = ${alias}.jobber_client_id
         AND ct_rs.tag = 'jobber_client'))`;
}

module.exports = { campaignVisibleClient };
