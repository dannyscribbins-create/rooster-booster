'use strict';

// ── THE FULL-CAPTURE CERTIFICATION (catch-up schedule, Danny 2026-10-01) ──────
//
// Danny's ruling: the catch-up job decides ONLY from COMPLETE history. A backwards move caused by
// partial capture is a data gap, not the truth — and a ratchet was REJECTED, because it would also
// block genuine corrections and contradict the ruling that reps always see the true stage.
//
// ⚠ THE WRITER CANNOT KNOW WHETHER A FETCH WAS EXHAUSTIVE, SO THE FETCHER CERTIFIES IT. That is the
// whole design. `captureClientFacts` receives an already-assembled client object; nothing in that
// object says whether `quotes`, `jobs`, `invoices` and `requests` were paged to the end or truncated
// at the first page. Only the function that did the paging knows, and in this codebase it knows for a
// strong reason: `pageClientConnection` THROWS rather than returning a short set, so simply REACHING
// the end of `fetchFullClient` / `fetchClientRelatedData` is proof that every connection was drained.
// Certification is therefore stamped at the point of return, where the proof exists.
//
// ⚠ IT IS A SYMBOL, AND THAT IS LOAD-BEARING RATHER THAN STYLISTIC. Three properties follow:
//   · `JSON.parse` can never produce it — so a client object reconstructed from a webhook payload,
//     or round-tripped through `JSON.stringify`, cannot forge the certification. A webhook body is
//     exactly the untrusted, partial shape this guard exists to refuse.
//   · it is NON-ENUMERABLE, so `{ ...client }` does not carry it. A caller that spreads the object
//     loses the certification and the stamp is skipped — which FAILS CLOSED: the client is simply
//     not eligible for the catch-up, rather than being decided from data nobody vouched for.
//   · a string key like `fullyPaged: true` would be settable by anything, including by a fixture
//     that wanted a green test. A module-private Symbol can only be applied by code that imports
//     this file.
//
// ⚠ AND `repImportScope.js` CAN NEVER STAMP, BY CONSTRUCTION RATHER THAN BY A RULE. It calls
// `writeJobFacts` / `writeInvoiceFacts` / `writeQuoteFacts` / `writeRequestFacts` directly, over a
// time-windowed per-ENTITY scan, and never goes through either fetcher or through
// `captureClientFacts`. It is the measured source of the partial data this ruling is about: 212
// stored-'paid' clients with invoice facts and no job facts, and 194 whose captured invoices contain
// no paid one.

/**
 * The certification mark. Module-private by convention and unforgeable through JSON.
 * Exported only so the writer can read it and the tests can prove its absence.
 */
const FULLY_PAGED = Symbol('roofmiles.capture.fullyPaged');

/**
 * Marks a client object as having had every connection paged to exhaustion.
 * Inputs: the assembled client object.
 * Output: the SAME object, with a non-enumerable certification.
 *
 * ⚠ CALL THIS ONLY AT A POINT WHERE EXHAUSTION IS ALREADY PROVEN — i.e. after every
 * `pageClientConnection` has resolved. Calling it earlier would certify a truncated set, which is
 * the one failure this whole mechanism cannot detect for itself.
 */
function certifyFullyPaged(client) {
  if (!client || typeof client !== 'object') return client;
  Object.defineProperty(client, FULLY_PAGED, {
    value: true,
    enumerable: false,   // so a spread drops it and the stamp fails closed
    writable: false,
    configurable: false,
  });
  return client;
}

/**
 * Whether a client object carries the certification.
 * Inputs: any value. Output: boolean — false for anything that is not certified.
 */
function isCertifiedFullyPaged(client) {
  return Boolean(client && typeof client === 'object' && client[FULLY_PAGED] === true);
}

module.exports = { certifyFullyPaged, isCertifiedFullyPaged, FULLY_PAGED };
