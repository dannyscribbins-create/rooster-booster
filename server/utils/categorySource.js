'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WHERE THE PAYOUT CATEGORY COMES FROM — Danny's rulings 1-3, 2026-09-30 (7c-2)
//
// One definition of "which value decides this client's payout schedule", read from SAVED FACTS
// only. No Jobber call, no live object.
//
// ── RULING 1 — THE MAPPED FIELD, FOLLOWED BY ITS LINK. NEVER BY LABEL. ──────────────────────
// The contractor maps ONE configuration (`contractor_settings.contractor_field_mappings.work_category`,
// an object carrying `field_id`). Reading order:
//   1. the mapped field's LINKED COUNTERPART on the INVOICE, found via
//      `contractor_jobber_fields.transfered_from` pointing at the mapped id;
//   2. else the mapped field on the JOB;
//   3. else the mapped field on the LINKED QUOTE.
// ⚠ NEVER BY LABEL AND NEVER BY MATCHING OPTION LISTS, and that is not fastidiousness. Measured on
// the live tenant: Accent has THREE configurations named "Job Type", and the ALL_INVOICES one
// (730115) has the **same 19 options** as the ALL_JOBS one (730114). So the label cannot tell them
// apart and neither can the option list. `transferedFrom` on 730115 names 730114 explicitly and is
// the only thing that can. A same-label field with NO link is a different field and is ignored.
//
// ── RULING 2 — THE LATEST STAGE WITH A VALUE WINS; BLANK IS ABSENT. ─────────────────────────
// A blank or whitespace-only value is treated as ABSENT and reading falls through to the next
// stage. ⚠ THIS IS NOT A HYPOTHETICAL: a live Accent job carries `""` on 730114 while its invoice
// copy carries "Out of Pocket", and invoice 60504 is the mirror image — a blank INVOICE copy over a
// job that says "Out of Pocket". Without this rule one of those two reads as "no category found"
// and pays nothing.
//
// ── RULING 3 — ON A CONFLICT THE INVOICE WINS, AND THE DISAGREEMENT IS RECORDED. ────────────
// If the invoice copy and the job BOTH have values and they DIFFER, the invoice wins (it is the
// later stage) and a `category_mismatches` row is written naming the client, the invoice and BOTH
// values. ⚠ THE RECORD IS THE POINT, not the tie-break: a contractor who changed the job's category
// after invoicing has told us two different things, and which they meant is a question only they can
// answer. Picking one silently would be a decision disguised as a lookup.
//
// ⚠ NO PRODUCTION CALLER YET, AND THAT IS STATED RATHER THAN HIDDEN. `evaluateReferral` still reads
// the category off the live invoice object; switching the MONEY path onto this resolver is 7d's
// subject, and doing it inside a capture commit would mix a schema change with a payout change in
// one unreviewable diff. A test case is named for this absence so it reads as known rather than as
// an oversight — the same treatment N4 commit 2 gave its backed-out guard.
// ─────────────────────────────────────────────────────────────────────────────

const { normalizeCategoryValue, categoryValuesMatch } = require('./categoryMatch');
const { parseMappingEntry } = require('./fieldMapping');

// The three stages, latest first. Ruling 2's "latest stage with a value" is this order.
const STAGE_ORDER = ['ALL_INVOICES', 'ALL_JOBS', 'ALL_QUOTES'];

/**
 * The configuration ids that count as "the mapped field" at each stage.
 * Inputs: a db/tx, contractorId, the mapped configuration id.
 * Output: { mappedId, acceptable: Set<string> } — the mapped id plus every configuration that
 * declares `transfered_from = mappedId`.
 *
 * ⚠ THE LINK IS FOLLOWED IN ONE DIRECTION ONLY: a counterpart points AT the mapped field. Accepting
 * the reverse (a field the mapped one was transferred FROM) would walk up to the quote-level source
 * and quietly widen the mapping to a field the contractor did not choose.
 */
async function resolveAcceptableConfigurations(db, contractorId, mappedId) {
  const acceptable = new Set([mappedId]);
  const { rows } = await db.query(
    `SELECT jobber_field_id FROM contractor_jobber_fields
      WHERE contractor_id = $1 AND transfered_from = $2`,
    [contractorId, mappedId]
  );
  for (const r of rows) acceptable.add(r.jobber_field_id);
  return { mappedId, acceptable };
}

/** The mapped configuration id for a contractor, or null. Never throws. */
async function readMappedConfigurationId(db, contractorId) {
  try {
    const { rows } = await db.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const entry = parseMappingEntry(rows[0]?.contractor_field_mappings?.work_category);
    // ⚠ A LEGACY LABEL-ONLY MAPPING RESOLVES NOTHING HERE, DELIBERATELY. `parseMappingEntry` returns
    // `{ legacy: true }` with no `fieldId` for the old string form, and guessing which same-named
    // configuration it meant is precisely the coin-flip 7c-1 removed. The caller reports
    // `mapping_not_by_id` so an admin can re-pick, rather than being paid on a guess.
    return entry?.fieldId || null;
  } catch {
    return null;
  }
}

/** One fact row's usable value under ruling 2 — blank and whitespace-only are ABSENT. */
function valueOf(row) {
  const dropdown = normalizeCategoryValue(row.value_dropdown);
  if (dropdown !== null) return row.value_dropdown;
  const text = normalizeCategoryValue(row.value_text);
  if (text !== null) return row.value_text;
  return null;
}

/**
 * The category value for one client's conversion, per rulings 1-3.
 * Inputs: a db/tx, { contractorId, jobberClientId, jobberInvoiceId, recordMismatch }.
 *   `jobberInvoiceId` scopes the invoice stage to the invoice being converted; omit it to consider
 *   every invoice fact for the client.
 *   `recordMismatch` defaults true; pass false to resolve without writing a review row.
 * Output: { value, stage, configurationId, reason, mismatch } — `value` is null when nothing was
 * found, and `reason` says why.
 */
async function resolveCategoryValue(db, {
  contractorId,
  jobberClientId,
  jobberInvoiceId = null,
  recordMismatch = true,
} = {}) {
  if (!contractorId) throw new Error('resolveCategoryValue: contractorId is required');
  if (!jobberClientId) throw new Error('resolveCategoryValue: jobberClientId is required');

  const mappedId = await readMappedConfigurationId(db, contractorId);
  if (!mappedId) {
    return { value: null, stage: null, configurationId: null, reason: 'mapping_not_by_id', mismatch: null };
  }

  const { acceptable } = await resolveAcceptableConfigurations(db, contractorId, mappedId);

  const { rows } = await db.query(
    `SELECT entity, entity_jobber_id, configuration_id, value_dropdown, value_text
       FROM crm_custom_field_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
        AND configuration_id = ANY($3::text[])
      ORDER BY entity_jobber_id ASC`,
    [contractorId, jobberClientId, [...acceptable]]
  );

  // Per stage, the first row that has a usable value under ruling 2.
  const byStage = new Map();
  for (const row of rows) {
    if (!STAGE_ORDER.includes(row.entity)) continue;
    // ⚠ SCOPED TO THE INVOICE UNDER CONVERSION WHEN ONE IS NAMED. A client with two invoices could
    // otherwise have its category decided by a DIFFERENT invoice than the one being paid on, which
    // would be a wrong answer that looks like a right one.
    if (row.entity === 'ALL_INVOICES' && jobberInvoiceId && row.entity_jobber_id !== jobberInvoiceId) continue;
    const value = valueOf(row);
    if (value === null) continue;
    if (!byStage.has(row.entity)) {
      byStage.set(row.entity, { value, configurationId: row.configuration_id, recordId: row.entity_jobber_id });
    }
  }

  const invoiceHit = byStage.get('ALL_INVOICES') || null;
  const jobHit = byStage.get('ALL_JOBS') || null;

  // ── RULING 3 — a real disagreement between the two stages that both have values ──
  let mismatch = null;
  if (invoiceHit && jobHit && !categoryValuesMatch(invoiceHit.value, jobHit.value)) {
    mismatch = {
      jobberClientId,
      jobberInvoiceId: invoiceHit.recordId,
      configurationId: invoiceHit.configurationId,
      invoiceValue: invoiceHit.value,
      jobValue: jobHit.value,
    };
    if (recordMismatch) {
      // ⚠ UPSERTED, because a conversion decision can be retried and a redelivered webhook must not
      // produce a second identical review item. Same exactly-once reasoning as the conversion row's
      // UNIQUE constraint.
      // ⚠ AND `resolved` IS NOT TOUCHED ON CONFLICT. An admin who has already reviewed this exact
      // disagreement must not have it silently reopened by a retry of the same decision.
      await db.query(
        `INSERT INTO category_mismatches
           (contractor_id, jobber_client_id, jobber_invoice_id, configuration_id,
            invoice_value, job_value, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (contractor_id, jobber_client_id, jobber_invoice_id, configuration_id)
         DO UPDATE SET invoice_value = $5, job_value = $6, detected_at = NOW()`,
        [contractorId, jobberClientId, mismatch.jobberInvoiceId, mismatch.configurationId,
          mismatch.invoiceValue, mismatch.jobValue]
      );
    }
  }

  // ── RULINGS 1 and 2 — the latest stage that has a value ──
  for (const stage of STAGE_ORDER) {
    const hit = byStage.get(stage);
    if (hit) {
      return {
        value: hit.value,
        stage,
        configurationId: hit.configurationId,
        reason: 'ok',
        mismatch,
      };
    }
  }

  return { value: null, stage: null, configurationId: null, reason: 'no_category_value', mismatch };
}

module.exports = {
  resolveCategoryValue,
  resolveAcceptableConfigurations,
  readMappedConfigurationId,
  valueOf,
  STAGE_ORDER,
};
