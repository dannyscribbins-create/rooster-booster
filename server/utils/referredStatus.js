'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 7b — THE REFERRER-VISIBLE STATUS, FROM SAVED FACTS
//
// `pipeline_cache.pipeline_status` is what a referrer sees on "My Referrals". Until this commit it
// was classified from the LIVE Jobber object by `syncSingleClient`, while
// `jobber_clients.pipeline_stage` — the REP's view — had already moved onto saved facts. The two
// disagreed: measured 2026-09-29, **6 of 15 shared clients**, and in two of those the referrer was
// shown the LOWER value. This module is the one derivation both now use.
//
// ⚠ IT DERIVES; IT DOES NOT CREDIT. No conversion is written here and none may be added: the
// conversion credit is commit 7d, and it is blocked on 7c (the Job Type custom field is not
// captured, so `evaluateReferral` cannot be driven from facts at all yet). A derivation that also
// paid people would be unreviewable as one diff.
//
// ⚠ `paid_at` IS THE EARLIEST PAID INVOICE'S OWN DATE (Danny ruling, 2026-09-29), NEVER `NOW()`.
// It answers "when did this referral become payable", and that instant does not move because a
// second invoice settles later. Taking the LATEST would push the date forward every time another
// invoice landed, re-clocking the engagement cadence for a client that had been payable for
// months; taking the TRIGGERING invoice's would make the value depend on which webhook happened to
// arrive, so a re-capture could change it. Same principle as the R5 assigned-date ruling: dates
// come from facts.
//
// ⚠ AND `received_date` RATHER THAN `issued_date`. Issued is when the invoice was SENT. Measured on
// the two live cases they differ by 6 and 34 seconds — close enough to look interchangeable and
// wrong in principle.
// ─────────────────────────────────────────────────────────────────────────────

const { decideFromFacts } = require('./attributionDecide');
const { isDerivableJobberClientId } = require('./derivableClient');
const { PROGRESS_LADDER, highWaterParams, highWaterRaiseSql } = require('./stageHighWater');

/**
 * The earliest paid invoice's own received date for one client, from saved facts.
 * Inputs: a db/pool, the contractor, the Jobber client id.
 * Output: a Date, or null when no invoice qualifies.
 *
 * ⚠ THE THREE PAID CONDITIONS ARE THE ONE DEFINITION, EXPRESSED IN SQL RATHER THAN RE-DECIDED.
 * `isInvoicePaid` is status 'paid' AND balance 0 AND total > 0; this query must not drift from it.
 * A `paid_at` taken from an invoice the shared helper would reject would date a payability that
 * never happened.
 *
 * ⚠ AND IT JOINS THROUGH THE JOB LINKS, NOT `crm_invoice_facts.jobber_client_id`, SO IT AGREES WITH
 * `decideFromFacts`. That function reaches invoices via `crm_invoice_job_links` off the client's
 * jobs — an invoice with a client id but no linked job does NOT make the client 'paid' there, and
 * must not supply a `paid_at` here either. Two different reachability rules would let a client be
 * 'paid' with a null date, or dated without being paid.
 */
async function earliestPaidAt(db, { contractorId, jobberClientId }) {
  const { rows } = await db.query(
    `WITH jobs AS (
       SELECT jobber_job_id FROM crm_job_facts
        WHERE contractor_id = $1 AND jobber_client_id = $2
       UNION
       SELECT csj.jobber_job_id
         FROM client_sale_jobs csj
         JOIN client_sales cs ON cs.id = csj.sale_id AND cs.contractor_id = csj.contractor_id
        WHERE csj.contractor_id = $1 AND cs.jobber_client_id = $2
     )
     SELECT MIN(f.received_date) AS earliest
       FROM jobs j
       JOIN crm_invoice_job_links l
         ON l.contractor_id = $1 AND l.jobber_job_id = j.jobber_job_id
       JOIN crm_invoice_facts f
         ON f.contractor_id = $1 AND f.jobber_invoice_id = l.jobber_invoice_id
      WHERE LOWER(f.invoice_status) = 'paid'
        AND f.invoice_balance = 0
        AND f.total > 0`,
    [contractorId, jobberClientId]
  );
  return rows[0]?.earliest ?? null;
}

/**
 * The referrer-visible status and payable date for one client, from saved facts.
 * Inputs: a db/pool (a `tx` when the caller holds the per-client lock), the contractor, the id.
 * Output: { status, paidAt } — `status` is one of the five; `paidAt` is a Date or null.
 *
 * ⚠ `decideFromFacts` IS THE DERIVATION. It is not re-implemented here, and must not be: the whole
 * subject of N4 is that one function answers this question for every surface.
 *
 * ⚠ A NON-DERIVABLE CLIENT IS REFUSED RATHER THAN DERIVED (commit 2, Danny ruling 9). An
 * `app_user_*` placeholder or a synthetic id has no facts by construction, so it would derive
 * `'lead'` — the default wearing a derivation's clothes — and three live `pipeline_cache` rows
 * would lose the `'app_user'` status that is the only true thing known about them. **Callers
 * iterating a mixed population must filter FIRST**; this throw is a programmer-error guard.
 */
async function deriveReferredStatus(db, { contractorId, jobberClientId } = {}) {
  if (!contractorId) throw new Error('deriveReferredStatus: contractorId is required');
  if (!jobberClientId) throw new Error('deriveReferredStatus: jobberClientId is required');
  if (!isDerivableJobberClientId(jobberClientId)) {
    throw new Error(
      `deriveReferredStatus: ${JSON.stringify(jobberClientId)} is not a Jobber client id, so the `
      + 'referrer-visible status cannot be derived from saved facts. Filter the population first.'
    );
  }

  const { currentStatus } = await decideFromFacts(db, { contractorId, jobberClientId });
  // ⚠ ONLY A 'paid' CLIENT HAS A PAYABLE DATE, and the query is skipped otherwise rather than
  // returning whatever MIN() finds. A client at 'sold' with a stray paid invoice its jobs do not
  // link to must not acquire a date — see earliestPaidAt's reachability note.
  const paidAt = currentStatus === 'paid'
    ? await earliestPaidAt(db, { contractorId, jobberClientId })
    : null;

  return { status: currentStatus, paidAt };
}

/**
 * Derive AND store the referrer-visible status for one client.
 * Inputs: a db/tx (must be inside the per-client lock), { contractorId, jobberClientId }.
 * Output: { status, paidAt, rowCount } — `rowCount` 0 is the expected quiet outcome for a client
 * the referral sync has never seen.
 *
 * ⚠ EXTRACTED HERE SO THERE IS ONE COPY OF THIS STATEMENT, AND THAT IS NOT TIDINESS. It is the
 * money-adjacent write on the referrer's surface, and the capture/decision split gives it a SECOND
 * caller (the catch-up job). A pasted copy is exactly what
 * `cashoutBalanceSingleSource.test.js` exists to catch one table along, and what this repo has
 * already paid for twice — once when a corrected balance aggregate was written inline with a comment
 * claiming it was not a second formula, and once when the test for it pasted the same SQL a third
 * time inside the very file fencing against a second copy.
 *
 * ⚠ IT IS AN UPDATE, NEVER AN INSERT. `syncSingleClient` alone owns creating a `pipeline_cache` row,
 * because it is the only path that knows the referrer name and the pre-start-date decision.
 *
 * ⚠ `$3::text` IN BOTH PLACES, AND THE CAST IS LOAD-BEARING. Written without it, `$3` appears in two
 * incompatible inference contexts — assigned to a `VARCHAR(50)` column and compared to a bare
 * literal in the CASE — and Postgres refuses the statement at PREPARE with "inconsistent types
 * deduced for parameter $3". ⚠ **It fails for EVERY invocation, not for certain data**, which is how
 * it rolled back seven clients' fact captures over three hours on the invoice-paid door.
 *
 * ⚠ `paid_at` IS WRITTEN ONCE AND NEVER OVERWRITTEN — the CASE only fills it on the transition INTO
 * 'paid'. It is the source of truth for cadence timing.
 *
 * ⚠ AND N4 COMMIT 9 RAISES `stage_high_water` IN THE SAME STATEMENT, WHICH IS DELIBERATE RATHER
 * THAN CONVENIENT. The mark must move in the same transaction as the status it records, or a
 * failure between two statements would leave a card claiming a regression against a stage it was
 * never shown at. It is the same write-once-on-transition shape as `paid_at` one line above, and it
 * uses the SHARED fragment so the ladder has exactly one definition — see `stageHighWater.js`.
 */
async function writeReferredStatus(db, { contractorId, jobberClientId } = {}) {
  const ref = await deriveReferredStatus(db, { contractorId, jobberClientId });
  const hw = highWaterParams(ref.status);
  const { rowCount } = await db.query(
    `UPDATE pipeline_cache
        SET pipeline_status   = $3::text,
            updated_at        = NOW(),
            paid_at           = CASE
              WHEN $3::text = 'paid' AND pipeline_status != 'paid'
              THEN COALESCE($4::timestamptz, paid_at)
              ELSE paid_at
            END,
            ${highWaterRaiseSql('$5', '$6', '$7', 'stage_high_water')},
            status_derived_at = NOW()
      WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId, ref.status, ref.paidAt,
      hw.rank, hw.mark, PROGRESS_LADDER]
  );
  return { ...ref, rowCount };
}

module.exports = { deriveReferredStatus, earliestPaidAt, writeReferredStatus };
