'use strict';

// ── THE ONE SHARED CREDIT (7d, Danny 2026-10-01) ──────────────────────────────
//
// Every path that can make a referred client 'paid' credits through THIS function, inside the
// per-client lock it already holds. Before 7d a conversion could only be written by the invoice-paid
// webhook, from a LIVE invoice object — so a client that became paid by any other route (the sync, a
// stage webhook, the catch-up job, a re-capture) was never credited at all, and a referrer waited on
// a webhook that had already been delivered.
//
// ⚠ THE GATES ARE NOT RE-IMPLEMENTED HERE, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE. This
// function assembles an invoice object FROM STORED FACTS and hands it to `evaluateReferral`, which
// remains the one definition of `invoice_before_start_date`, `referrer_not_found`, the financed gate,
// the schedule match, the minimum threshold and the duplicate check. A second fact-driven evaluator
// would be a second set of money rules, and this repo has already paid twice for a second copy of a
// money formula — once for the cash-out balance, once for the speculative payout ladder.
//
// ⚠ THE CATEGORY COMES FROM `categorySource` (RULINGS 1-3), NEVER FROM A LABEL SCAN. The live read
// matches by LABEL, and on the live tenant THREE distinct configurations share the label "Job Type"
// across ALL_JOBS, ALL_INVOICES and ALL_QUOTES — so a label scan can read quote vocabulary onto a
// job-reading schedule. `resolveCategoryValue` follows the configuration LINK instead: the invoice's
// own copy first, then the job, then the linked quote, with a differing invoice copy winning and
// recorded as a mismatch.
//
// ⚠ IT WRITES, SO IT TAKES A `tx` AND MUST BE CALLED INSIDE THE LOCK. The conversion row and the
// activity-log line commit with the decision that produced them. What it does NOT do is send email —
// see `server/utils/referralNotify.js`. A notify inside the lock would hold a pooled connection
// across an outbound HTTP call, which is the defect commit 6b fixed in `withClientLock` itself.
//
// ⚠ AND IT NEVER THROWS INTO ITS CALLER. A referral that cannot be evaluated must not roll back the
// stage decision it rode in on; the outcome is returned as a `reason` and logged.

const { evaluateReferral } = require('../referralRules');
const { writeReferralConversion } = require('./referralConversion');
const { resolveCategoryValue } = require('./categorySource');
const { isInvoicePaid } = require('./invoicePaid');
const { applyTag } = require('./tags');
const { logError: realLogError } = require('../middleware/errorLogger');
// ⚠ ONE RESOLVER FOR THE LIVE DOOR AND THE FACT DOOR (Commit B). The fact rows are shaped into the
// same `customFields` array a record produces, so `readReferredByValue` matches identically on both —
// by configuration id when a field is picked, by exact normalised label otherwise.
const {
  resolveReferralSourceField, readReferredByValue, REFERRAL_SOURCE_ENTITY,
} = require('./referralSourceField');

/**
 * Assembles the invoice shape `evaluateReferral` reads, from stored facts.
 * Inputs: a db/tx, { contractorId, jobberClientId }.
 * Output: the qualifying paid invoice shaped for evaluateReferral, or null when there is none.
 *
 * ⚠ THE QUALIFYING INVOICE IS CHOSEN BY `isInvoicePaid`, THE ONE DEFINITION OF PAID — status 'paid'
 * AND a zero balance AND a total above zero. Picking "the newest invoice" or "any invoice whose
 * status says paid" would re-introduce exactly the two defects 4a closed.
 * ⚠ AND WHEN SEVERAL QUALIFY, THE EARLIEST ISSUED ONE WINS. The start-date gate compares the
 * invoice's issued date against `referral_start_date`, so choosing the earliest is the conservative
 * direction: it cannot smuggle a pre-start-date job in behind a later invoice.
 */
async function qualifyingPaidInvoiceFromFacts(db, { contractorId, jobberClientId }) {
  const { rows } = await db.query(
    `SELECT jobber_invoice_id, invoice_number, invoice_status, total, invoice_balance,
            issued_date, waiting_for_financed_payment
       FROM crm_invoice_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      ORDER BY issued_date ASC NULLS LAST, jobber_invoice_id ASC`,
    [contractorId, jobberClientId]
  );

  for (const r of rows) {
    const shaped = {
      // ⚠ THE CONNECTION SHAPE evaluateReferral READS, assembled explicitly. A flattened object would
      // make `jobs?.nodes` undefined and the category step read nothing — the shape mismatch
      // CLAUDE.md records as vacuity #12, here on the money path.
      client: { id: jobberClientId },
      // ⚠ CARRIED SO THE CATEGORY CAN BE INVOICE-SCOPED. Ruling 1 resolves the invoice's OWN copy
      // first, which is only expressible if the chosen invoice's id travels with the shape. The first
      // writing of this file read `invoice.jobber_invoice_id` off an object that never had it, so the
      // resolution would silently have fallen back to the job — a wrong-but-plausible category.
      jobber_invoice_id: r.jobber_invoice_id,
      invoiceNumber: r.invoice_number,
      invoiceStatus: r.invoice_status,
      issuedDate: r.issued_date,
      // ⚠ NULL IS PRESERVED, NEVER COERCED. `evaluateReferral`'s 7d gate blocks unless this is
      // explicitly `false`; a `|| false` here would assert "not financed" of every row that predates
      // the column and convert on unknown, which is the whole defect the nullable column exists for.
      waitingForFinancedPayment: r.waiting_for_financed_payment,
      amounts: { total: Number(r.total), invoiceBalance: Number(r.invoice_balance) },
      // Kept for isInvoicePaid's flat-shape fallback, so the two readings cannot disagree.
      total: Number(r.total),
      invoiceBalance: Number(r.invoice_balance),
      jobs: { nodes: [] },
      archivedJobs: { nodes: [] },
    };
    if (isInvoicePaid(shaped)) return shaped;
  }
  return null;
}

/**
 * Credits the referrer for a client that is paid, from stored facts, inside the caller's lock.
 * Inputs: a tx, { contractorId, jobberClientId, req, logError }.
 * Output: { credited, inserted, reason, userId, bonusAmount, isFirstConversion, scheduleName,
 *           clientName } — `credited` is true only when a conversion row was INSERTED by this call.
 *
 * ⚠ `inserted` IS THE NOTIFY TRIGGER AND `credited` IS ITS ALIAS, DELIBERATELY. A duplicate delivery
 * is `qualified: true` with `inserted: false`, and emailing on `qualified` is how a referrer would be
 * told twice about one bonus. The notify function is called only when this returns credited true.
 */
/**
 * @param {string|Date|null} [opts.clientCreatedAt] — the client's own Jobber creation date, passed by a
 *   caller that holds the live client. Omit it and the one start-date rule reads the stored column.
 *
 * ⚠ IT IS PASSED THROUGH UNTOUCHED, INCLUDING `undefined`, AND THAT DISTINCTION IS LOAD-BEARING.
 * `evaluateReferral` tells "nobody supplied one, read the column" from "I looked and there is none" by
 * the PRESENCE of the key, so this must not default it to null — a default would turn every caller that
 * omits it into one asserting the date is unknown, and the catch-up (which correctly reads the column)
 * would stop crediting anyone.
 */
async function creditReferralFromFacts(tx, {
  contractorId, jobberClientId, req = null, logError = realLogError, ...rest
} = {}) {
  const hasSuppliedCreatedAt = Object.prototype.hasOwnProperty.call(rest, 'clientCreatedAt');
  // ⚠ NORMALISED ONCE, HERE, BECAUSE THE RAW VALUE REACHES A `::timestamptz` CAST BEFORE IT REACHES THE
  // GATE. The `pipeline_cache` create below binds this value, so an unparseable string made Postgres
  // raise, the catch swallowed it, and the outcome came back `credit_failed` WITH AN ALERT — measured,
  // where the honest answer is `client_created_at_unknown` and no alert at all. A wrong reason on a money
  // path is worse than a crude one: it sends someone looking for a broken credit instead of a bad date.
  // ⚠ AND IT COLLAPSES ONLY *INVALID* TO NULL, NEVER *ABSENT* TO NULL. `hasSuppliedCreatedAt` still
  // carries "did anyone supply one at all", which is what keeps the stored read reachable for the
  // catch-up. Folding the two would stop that path crediting anybody.
  let suppliedCreatedAt = null;
  if (hasSuppliedCreatedAt && rest.clientCreatedAt) {
    const parsed = new Date(rest.clientCreatedAt);
    suppliedCreatedAt = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!contractorId) throw new Error('creditReferralFromFacts: contractorId is required');
  if (!jobberClientId) throw new Error('creditReferralFromFacts: jobberClientId is required');

  const none = (reason) => ({
    credited: false, inserted: false, reason,
    userId: null, bonusAmount: null, isFirstConversion: false, scheduleName: null, clientName: null,
  });

  try {
    // ── IS THIS CLIENT REFERRED AT ALL? FROM THE SAVED CLIENT FACTS (Danny, ruling 1) ────────────
    //
    // ⚠ THE REFERRER COMES FROM `crm_custom_field_facts`, NOT FROM `pipeline_cache.referred_by`, AND
    // THAT IS THE WHOLE OF RULING 1. Reading the cache row meant a brand-new referred client whose
    // first invoice-paid webhook arrived BEFORE the sync had created that row could not be credited at
    // all — it waited for the sync and then for a re-decide. Reading the facts means the capture that
    // just ran is sufficient.
    //
    // ⚠ THE FACT ROWS ARE SHAPED INTO THE SAME `customFields` ARRAY A LIVE RECORD PRODUCES, so
    // `readReferredByValue` is the ONE matcher for both. Spelling a second match here — by label, or by
    // id — is how the live door and the fact door would come to disagree about who referred a client,
    // which is a money question. The resolver matches by CONFIGURATION ID when the contractor has
    // picked a field, and by EXACT normalised label otherwise.
    const sourceField = await resolveReferralSourceField(tx, contractorId);
    const { rows: factRows } = await tx.query(
      `SELECT label, value_text, value_dropdown, configuration_id
         FROM crm_custom_field_facts
        WHERE contractor_id = $1 AND jobber_client_id = $2 AND entity = $3`,
      [contractorId, jobberClientId, REFERRAL_SOURCE_ENTITY]
    );
    const referredBy = readReferredByValue(
      factRows.map((r) => ({
        label: r.label,
        valueText: r.value_text,
        valueDropdown: r.value_dropdown,
        customFieldConfiguration: { id: r.configuration_id },
      })),
      sourceField
    );
    if (!referredBy) return none('not_referred');

    // ── THE CLIENT'S DISPLAY NAME, AND THE REFERRAL RECORD IF IT DOES NOT EXIST YET ──────────────
    //
    // ⚠ CREATING THE `pipeline_cache` ROW HERE IS THE OTHER HALF OF RULING 1: *"the decision creates the
    // referral record in the same pass when a full capture shows a referrer and no row exists yet, so a
    // first paid invoice is credited immediately rather than waiting for the sync."*
    //
    // ⚠ `referred_by` IS THE STORED DISPLAY VALUE, WRITTEN FROM THE FACTS — Danny's wording. It is not a
    // second source of truth: the facts decide, and this column is what the referrer's screen reads.
    //
    // ⚠ AND IT IS AN INSERT ... ON CONFLICT DO NOTHING, NEVER AN UPSERT. The sync owns this row's other
    // columns; overwriting `client_name`, `pre_start_date` or `pipeline_status` from here would make two
    // writers of one row disagree. `COALESCE` on the status is deliberately absent for the same reason —
    // `writeReferredStatus` is the one writer of the referrer-visible stage, and it runs separately.
    const { rows: clientRows } = await tx.query(
      `SELECT first_name, last_name, jobber_created_at FROM jobber_clients
        WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId]
    );
    const clientName = clientRows[0]
      ? `${clientRows[0].first_name || ''} ${clientRows[0].last_name || ''}`.trim() || null
      : null;

    await tx.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, jobber_created_at, last_synced_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, NOW())
       ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING`,
      [contractorId, jobberClientId, clientName, referredBy,
        // ⚠ THE STORED VALUE FIRST, THE SUPPLIED ONE AS THE FALLBACK — and on the path that creates this
        // row the stored one is absent by construction, which is the whole reason the fallback is here.
        // Writing NULL would leave the referrer's own record claiming the creation date is unknown for a
        // client we had just proven eligible on it, and `syncSingleClient` (this column's owner) would
        // then be the only thing that could ever fill it.
        clientRows[0]?.jobber_created_at || suppliedCreatedAt || null]
    );

    // ── The qualifying paid invoice, from facts ──
    const invoice = await qualifyingPaidInvoiceFromFacts(tx, { contractorId, jobberClientId });
    if (!invoice) return none('invoice_not_paid');

    // ── The category, by ruling 1-3, with a mismatch recorded rather than silently preferred ──
    const category = await resolveCategoryValue(tx, {
      contractorId,
      jobberClientId,
      jobberInvoiceId: invoice.jobber_invoice_id ?? null,
      recordMismatch: true,
    });
    const categoryValues = category.value === null ? [] : [category.value];

    // ── Every gate, in the one place they live ──
    // ⚠ THE CREATION DATE IS FORWARDED ONLY WHEN THE CALLER ACTUALLY SUPPLIED ONE, so a caller that
    // omits it keeps the stored read rather than silently asserting "unknown". See the note above.
    const result = await evaluateReferral(contractorId, invoice, referredBy, {
      categoryValues,
      ...(hasSuppliedCreatedAt ? { clientCreatedAt: suppliedCreatedAt } : {}),
    });
    if (!result.qualified) return { ...none(result.reason), clientName };

    // ── The write. ONE writer, which also takes the prior count BEFORE the insert. ──
    const conversion = await writeReferralConversion(tx, {
      userId: result.referrerId,
      contractorId,
      jobberClientId: result.jobberClientId,
      bonusAmount: result.bonusAmount,
    });

    if (conversion.inserted) {
      await tx.query(
        `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
        ['referral_conversion',
          `Referral bonus $${result.bonusAmount} — schedule: ${result.scheduleName} — `
          + `referrer user_id: ${result.referrerId} — client: ${clientName}`]
      );

      // ── THE 'Active Referrer' TAG — CARRIED OVER, NOT DROPPED (7d) ──────────
      // ⚠ THIS CAME FROM THE RETIRED invoice-paid BLOCK AND IS NAMED HERE SO THE MOVE IS REVIEWABLE.
      // Retiring ~173 lines is exactly where a side effect gets lost: the old code applied this tag on
      // every new conversion, and a reader comparing behaviour would have found it missing with
      // nothing to explain why.
      // ⚠ AND IT IS NOW INSIDE THE TRANSACTION, which is stricter than before. The old write was
      // fire-and-forget on the pool, so a tag could land for a conversion that rolled back. Here it
      // commits with the credit or not at all. Its own `ON CONFLICT` makes it idempotent either way.
      const { rows: refRows } = await tx.query(
        `SELECT email FROM users WHERE id = $1 LIMIT 1`, [result.referrerId]);
      if (refRows[0]?.email) {
        const { rows: contactRows } = await tx.query(
          `SELECT id FROM contacts WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
          [contractorId, refRows[0].email]);
        if (contactRows[0]) {
          await applyTag(tx, contactRows[0].id, contractorId, 'Active Referrer', 'system');
        }
      }
    }

    return {
      credited: conversion.inserted,
      inserted: conversion.inserted,
      reason: conversion.inserted ? 'credited' : 'conversion_already_recorded',
      userId: result.referrerId,
      bonusAmount: result.bonusAmount,
      isFirstConversion: conversion.isFirstConversion,
      scheduleName: result.scheduleName,
      clientName,
    };
  } catch (err) {
    // ⚠ SWALLOWED ON PURPOSE, AND ALERTED. A referral evaluation that fails must not roll back the
    // stage decision in the same transaction — that coupling is what cost seven clients their facts
    // on this very door. The outcome is a reason the caller can log, and the alert is what makes a
    // persistently failing credit visible rather than quiet.
    await logError({
      req,
      contractorId,
      error: new Error(`[referralCredit] credit failed for client ${jobberClientId}: ${err.message}`),
      source: 'creditReferralFromFacts',
      alert: true,
    });
    return none('credit_failed');
  }
}

module.exports = { creditReferralFromFacts, qualifyingPaidInvoiceFromFacts };
