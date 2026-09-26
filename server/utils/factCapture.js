'use strict';

// ── FACT CAPTURE — the writers for the stored Jobber facts the attribution replay reads ──
//
// ⚠ ARRIVED HERE BY VERBATIM RELOCATION (3d Phase 1a, Commit 1). Both functions were
// private to server/jobs/repImportScope.js; nothing about them was changed on the way in
// — same names, same signatures, same SQL, same comments, same behaviour — so the move is
// checkable mechanically and repImportScope.test.js proves it unmodified.
//
// WHY THEY MOVED: capture is becoming a step that more than one path performs. Leaving the
// row shape defined in a job file guarantees the next caller copies the SQL instead of
// calling it. The conflict targets are the durable identity of the Jobber object, and
// because both statements are INSERT … ON CONFLICT … DO UPDATE SET <every non-key column>,
// a retried or duplicated delivery converges on the same row.

async function writeRequestFacts(db, contractorId, nodes) {
  const rows = nodes.filter((n) => n?.id && n.createdAt && n.client?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at,
        salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids,
        assigned_users_truncated)
     SELECT $1, r.id, r.client_id, r.created_at, r.sp, r.aid, r.assigned, r.trunc
       FROM unnest($2::text[], $3::text[], $4::timestamptz[], $5::text[], $6::text[], $7::jsonb[],
                   $8::boolean[])
         AS r(id, client_id, created_at, sp, aid, assigned, trunc)
     ON CONFLICT (contractor_id, jobber_request_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       created_at                 = EXCLUDED.created_at,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       assessment_id              = EXCLUDED.assessment_id,
       assigned_jobber_user_ids   = EXCLUDED.assigned_jobber_user_ids,
       assigned_users_truncated   = EXCLUDED.assigned_users_truncated`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client.id),
      rows.map((n) => n.createdAt),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => n.assessment?.id || null),
      // ⚠ ATOMIC PER ASSESSMENT — the people on ONE assessment stay together (ruling 1).
      rows.map((n) => JSON.stringify((n.assessment?.assignedUsers?.nodes || []).map((u) => u.id).filter(Boolean))),
      // ⚠ STRICT === true, NOT TRUTHINESS, AND THE DIFFERENCE IS THE WHOLE POINT (7a-2).
      // `hasNextPage` is absent on a node whose query did not select pageInfo — every row captured
      // before 7a-2, and any future selection that forgets it. `undefined` must record FALSE
      // ("nobody asked") rather than default to true, because a column reading "truncated" for
      // every historical row would flag the whole book and teach admins to ignore the flag. The
      // honest reading of an unasked question is recorded at the column in server/db.js.
      rows.map((n) => n.assessment?.assignedUsers?.pageInfo?.hasNextPage === true),
    ]
  );
  return rows.length;
}

async function writeQuoteFacts(db, contractorId, nodes) {
  const rows = nodes.filter((n) => n?.id && n.client?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at,
        salesperson_jobber_user_id, created_at)
     SELECT $1, q.id, q.client_id, q.status, q.approved_at, q.sp, q.created_at
       FROM unnest($2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::text[], $7::timestamptz[])
         AS q(id, client_id, status, approved_at, sp, created_at)
     ON CONFLICT (contractor_id, jobber_quote_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       quote_status               = EXCLUDED.quote_status,
       approved_at                = EXCLUDED.approved_at,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       created_at                 = EXCLUDED.created_at`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client.id),
      rows.map((n) => n.quoteStatus || null),
      rows.map((n) => n.lastTransitioned?.approvedAt || null),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => n.createdAt || null),
    ]
  );
  return rows.length;
}

// ── MONEY (3d Phase 1a Commit 3) ─────────────────────────────────────────────
/**
 * Converts Jobber's GraphQL Float to a decimal STRING with exactly two places.
 * Inputs: a number, a numeric string, null or undefined.
 * Output: a string like '29724.80', or null.
 *
 * ⚠ A STRING, NOT A NUMBER, AND THAT IS THE WHOLE POINT. The target column is
 * NUMERIC(12,2); handing node-postgres a JS double lets a binary float decide the stored
 * value, and `Math.round(v * 100) / 100` is the same mistake wearing arithmetic. Formatting
 * to a decimal string first means Postgres parses an exact decimal literal and no float ever
 * reaches the database.
 * ⚠ AND NEVER CENTS. The repo records Jobber's amounts as whole dollars (29724.8 is
 * $29,724.80, not $297.24), so multiplying by 100 anywhere is a defect, not a unit choice.
 */
function toMoneyString(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

/**
 * Upserts job facts, one row per Jobber job.
 * Inputs: a db/pool, the contractor id, the job nodes from the capture fetch.
 * Output: the number of rows offered (not the number actually updated — see the guard).
 *
 * ⚠ AN OLDER FETCH MUST NEVER OVERWRITE A NEWER ROW. Two doors can capture the same job
 * seconds apart, and a webhook's client-wide fetch can arrive after a narrower, fresher one.
 * The ON CONFLICT branch therefore carries a WHERE on updated_at, and the COALESCE to
 * -infinity makes all four NULL combinations total rather than accidental:
 *   stored NULL, incoming NULL  -> update (no basis to refuse, and nothing is lost)
 *   stored NULL, incoming value -> update (we gain information)
 *   stored value, incoming NULL -> REFUSE (cannot prove it is newer, so keep what we have)
 *   stored value, incoming older-> REFUSE
 * ⚠ Written as a WHERE on the conflict branch rather than a read-then-write, so two
 * concurrent captures cannot interleave between the check and the write.
 */
async function writeJobFacts(db, contractorId, nodes) {
  const rows = (nodes || []).filter((n) => n?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_job_facts
       (contractor_id, jobber_job_id, jobber_client_id, jobber_quote_id, jobber_request_id,
        salesperson_jobber_user_id, job_number, job_status, job_type, title,
        created_at, updated_at, start_at, end_at, completed_at,
        total, invoiced_total, uninvoiced_total)
     SELECT $1, j.id, j.client_id, j.quote_id, j.request_id, j.sp, j.job_number, j.job_status,
            j.job_type, j.title, j.created_at, j.updated_at, j.start_at, j.end_at,
            j.completed_at, j.total, j.invoiced_total, j.uninvoiced_total
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                   $8::text[], $9::text[], $10::text[], $11::timestamptz[], $12::timestamptz[],
                   $13::timestamptz[], $14::timestamptz[], $15::timestamptz[],
                   $16::numeric[], $17::numeric[], $18::numeric[])
         AS j(id, client_id, quote_id, request_id, sp, job_number, job_status, job_type, title,
              created_at, updated_at, start_at, end_at, completed_at,
              total, invoiced_total, uninvoiced_total)
     ON CONFLICT (contractor_id, jobber_job_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       jobber_quote_id            = EXCLUDED.jobber_quote_id,
       jobber_request_id          = EXCLUDED.jobber_request_id,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       job_number                 = EXCLUDED.job_number,
       job_status                 = EXCLUDED.job_status,
       job_type                   = EXCLUDED.job_type,
       title                      = EXCLUDED.title,
       created_at                 = EXCLUDED.created_at,
       updated_at                 = EXCLUDED.updated_at,
       start_at                   = EXCLUDED.start_at,
       end_at                     = EXCLUDED.end_at,
       completed_at               = EXCLUDED.completed_at,
       total                      = EXCLUDED.total,
       invoiced_total             = EXCLUDED.invoiced_total,
       uninvoiced_total           = EXCLUDED.uninvoiced_total,
       captured_at                = NOW()
     WHERE COALESCE(EXCLUDED.updated_at, '-infinity'::timestamptz)
        >= COALESCE(crm_job_facts.updated_at, '-infinity'::timestamptz)`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client?.id || null),
      rows.map((n) => n.quote?.id || null),
      rows.map((n) => n.request?.id || null),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => (n.jobNumber === null || n.jobNumber === undefined ? null : String(n.jobNumber))),
      rows.map((n) => n.jobStatus || null),
      rows.map((n) => n.jobType || null),
      rows.map((n) => n.title || null),
      rows.map((n) => n.createdAt || null),
      rows.map((n) => n.updatedAt || null),
      rows.map((n) => n.startAt || null),
      rows.map((n) => n.endAt || null),
      rows.map((n) => n.completedAt || null),
      rows.map((n) => toMoneyString(n.total)),
      rows.map((n) => toMoneyString(n.invoicedTotal)),
      rows.map((n) => toMoneyString(n.uninvoicedTotal)),
    ]
  );
  return rows.length;
}

/**
 * Upserts invoice facts, ONE ROW PER INVOICE.
 * Inputs: a db/pool, the contractor id, the invoice nodes from the capture fetch.
 * Output: the number of rows offered.
 *
 * ⚠ KEYED BY THE INVOICE'S OWN ID, NEVER BY (invoice, job). An invoice can cover several
 * jobs; keying per job would store it twice and a sale's value would count it twice. The job
 * set is a separate table — see writeInvoiceJobLinks.
 * ⚠ THE STATUS IS STORED VERBATIM, INCLUDING 'voided'. Dropping or rewriting a voided invoice
 * here would put a DECISION inside a fact table, and the fact that an invoice was voided is
 * exactly what a later consumer needs in order to exclude it.
 * ⚠ Same updated_at guard as writeJobFacts, for the same reason.
 */
async function writeInvoiceFacts(db, contractorId, nodes) {
  const rows = (nodes || []).filter((n) => n?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_invoice_facts
       (contractor_id, jobber_invoice_id, jobber_client_id, invoice_number, invoice_status,
        total, invoice_balance, payments_total, deposit_amount, subtotal, tax_amount,
        discount_amount, issued_date, due_date, received_date, created_at, updated_at)
     SELECT $1, v.id, v.client_id, v.invoice_number, v.invoice_status, v.total, v.balance,
            v.payments, v.deposit, v.subtotal, v.tax, v.discount,
            v.issued_date, v.due_date, v.received_date, v.created_at, v.updated_at
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[],
                   $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[],
                   $10::numeric[], $11::numeric[], $12::numeric[],
                   $13::timestamptz[], $14::timestamptz[], $15::timestamptz[],
                   $16::timestamptz[], $17::timestamptz[])
         AS v(id, client_id, invoice_number, invoice_status, total, balance, payments, deposit,
              subtotal, tax, discount, issued_date, due_date, received_date,
              created_at, updated_at)
     ON CONFLICT (contractor_id, jobber_invoice_id) DO UPDATE SET
       jobber_client_id = EXCLUDED.jobber_client_id,
       invoice_number   = EXCLUDED.invoice_number,
       invoice_status   = EXCLUDED.invoice_status,
       total            = EXCLUDED.total,
       invoice_balance  = EXCLUDED.invoice_balance,
       payments_total   = EXCLUDED.payments_total,
       deposit_amount   = EXCLUDED.deposit_amount,
       subtotal         = EXCLUDED.subtotal,
       tax_amount       = EXCLUDED.tax_amount,
       discount_amount  = EXCLUDED.discount_amount,
       issued_date      = EXCLUDED.issued_date,
       due_date         = EXCLUDED.due_date,
       received_date    = EXCLUDED.received_date,
       created_at       = EXCLUDED.created_at,
       updated_at       = EXCLUDED.updated_at,
       captured_at      = NOW()
     WHERE COALESCE(EXCLUDED.updated_at, '-infinity'::timestamptz)
        >= COALESCE(crm_invoice_facts.updated_at, '-infinity'::timestamptz)`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client?.id || null),
      rows.map((n) => (n.invoiceNumber === null || n.invoiceNumber === undefined ? null : String(n.invoiceNumber))),
      rows.map((n) => n.invoiceStatus || null),
      rows.map((n) => toMoneyString(n.amounts?.total)),
      rows.map((n) => toMoneyString(n.amounts?.invoiceBalance)),
      rows.map((n) => toMoneyString(n.amounts?.paymentsTotal)),
      rows.map((n) => toMoneyString(n.amounts?.depositAmount)),
      rows.map((n) => toMoneyString(n.amounts?.subtotal)),
      rows.map((n) => toMoneyString(n.amounts?.taxAmount)),
      rows.map((n) => toMoneyString(n.amounts?.discountAmount)),
      rows.map((n) => n.issuedDate || null),
      rows.map((n) => n.dueDate || null),
      rows.map((n) => n.receivedDate || null),
      rows.map((n) => n.createdAt || null),
      rows.map((n) => n.updatedAt || null),
    ]
  );
  return rows.length;
}

/**
 * Replaces an invoice's job set from a COMPLETE fetch.
 * Inputs: a db/pool, the contractor id, the invoice nodes (each carrying jobs and optionally
 *         archivedJobs, with pageInfo).
 * Output: the number of link rows written.
 *
 * ⚠ HOW THIS KNOWS THE SET IS COMPLETE, AND WHY IT CHECKS RATHER THAN INHERITS. The capture
 * fetch already throws when an invoice's job set spans more than one page
 * (assertInvoiceJobsComplete in server/utils/jobberClientFetch.js). This writer asserts it
 * AGAIN, locally, because a safety measure carried forward unchecked is not a safety measure:
 * this writer will later be called from doors that do not exist yet, and one of them may build
 * its nodes by hand. If `hasNextPage` is true on either connection, it THROWS and writes
 * nothing — a REPLACE against a truncated set would silently delete real links.
 * ⚠ AND THE REPLACE IS SCOPED TO THE INVOICE, NOT THE CONTRACTOR. Deleting this invoice's
 * links and reinserting them is how a job REMOVED from an invoice stops being linked; doing it
 * per contractor would wipe every other invoice's links on a single-invoice capture.
 */
async function writeInvoiceJobLinks(db, contractorId, nodes) {
  const invoices = (nodes || []).filter((n) => n?.id);
  if (invoices.length === 0) return 0;

  for (const inv of invoices) {
    if (inv.jobs?.pageInfo?.hasNextPage === true || inv.archivedJobs?.pageInfo?.hasNextPage === true) {
      throw new Error(
        `writeInvoiceJobLinks: invoice ${inv.id} job set is INCOMPLETE (hasNextPage) — `
        + 'refusing to replace links from a truncated set'
      );
    }
  }

  let written = 0;
  for (const inv of invoices) {
    const links = new Map();
    for (const j of (inv.jobs?.nodes || [])) {
      if (j?.id) links.set(j.id, false);
    }
    // archivedJobs second so a job present in BOTH is recorded as archived.
    for (const j of (inv.archivedJobs?.nodes || [])) {
      if (j?.id) links.set(j.id, true);
    }

    await db.query(
      `DELETE FROM crm_invoice_job_links WHERE contractor_id = $1 AND jobber_invoice_id = $2`,
      [contractorId, inv.id]
    );
    if (links.size === 0) continue;

    const jobIds = [...links.keys()];
    await db.query(
      `INSERT INTO crm_invoice_job_links
         (contractor_id, jobber_invoice_id, jobber_job_id, from_archived_jobs)
       SELECT $1, $2, l.job_id, l.archived
         FROM unnest($3::text[], $4::boolean[]) AS l(job_id, archived)
       ON CONFLICT (contractor_id, jobber_invoice_id, jobber_job_id) DO UPDATE SET
         from_archived_jobs = EXCLUDED.from_archived_jobs,
         captured_at        = NOW()`,
      [contractorId, inv.id, jobIds, jobIds.map((id) => links.get(id))]
    );
    written += jobIds.length;
  }

  return written;
}

/**
 * Captures every fact a fetched client carries, in one call, for the live doors.
 * Inputs: a db/pool/tx, and { contractorId, client } where `client` is the CONNECTION-shape
 *         client returned by fetchFullClient or fetchClientRelatedData.
 * Output: { requests, quotes, jobs, invoices, links } — rows offered per writer.
 * Throws: on any write failure, and on an invoice whose job set is truncated.
 *
 * ⚠ IT THROWS RATHER THAN RETURNING A PARTIAL COUNT, AND THAT IS THE WHOLE CONTRACT.
 * 3d Phase 1a Commit 5 rule 2: if capture for a client fails, the door must NOT decide for that
 * client. A helper that swallowed and returned counts would let a door read a half-written fact
 * set as a complete one and write a confident wrong decision — which is worse than no decision,
 * because the next event would see a stored answer and have no reason to look again.
 *
 * ⚠ THE CONNECTION SHAPE, NOT THE FLATTENED ONE. It reads `client.quotes.nodes`,
 * `client.jobs.nodes`, `client.requests.nodes` and `client.invoices.nodes`. Handing it the
 * object built for deriveAndSaveTags yields empty arrays for every connection and captures
 * NOTHING, with no error — CLAUDE.md vacuity shape #12, and the reason this doc block names the
 * shape instead of leaving it to the caller to infer.
 *
 * ⚠ `requests` MAY BE ABSENT AND THAT IS NOT THE SAME AS EMPTY. fetchFullClient does not select
 * requests at all; fetchClientRelatedData does. Every writer here is an UPSERT and none deletes,
 * so an absent connection captures zero rows and removes nothing — a client's request facts
 * survive a capture that never asked about them. Do not "tidy" any writer into a replace.
 */
async function captureClientFacts(db, { contractorId, client }) {
  if (!contractorId) throw new Error('captureClientFacts: contractorId is required');
  if (!client) throw new Error('captureClientFacts: client is required');

  // ⚠ DEFAULTED TO [] HERE, BECAUSE THE WRITERS DO NOT ALL AGREE ON THAT.
  // writeJobFacts and writeInvoiceJobLinks guard with `(nodes || [])`; writeRequestFacts and
  // writeQuoteFacts call `nodes.filter(...)` directly and THROW on undefined. fetchFullClient
  // selects no `requests` connection at all, so the request door handed writeRequestFacts an
  // undefined and the whole capture threw — surfacing as `capture_failed` on every request.
  // The absent connection is a legitimate state (see the doc block above), so it is normalised
  // at the one place that knows it, rather than by loosening four writers individually.
  const requestNodes = client.requests?.nodes || [];
  const quoteNodes   = client.quotes?.nodes   || [];
  const jobNodes     = client.jobs?.nodes     || [];
  const invoiceNodes = client.invoices?.nodes || [];

  // ⚠ SEQUENTIAL, NOT Promise.all. writeInvoiceJobLinks DELETEs and re-INSERTs per invoice, and
  // the throw it raises on a truncated job set must happen before anything reads the links.
  // Concurrency here buys nothing — these are small writes on one connection — and would make
  // a partial failure's residue depend on scheduling.
  const requests = await writeRequestFacts(db, contractorId, requestNodes);
  const quotes   = await writeQuoteFacts(db, contractorId, quoteNodes);
  const jobs     = await writeJobFacts(db, contractorId, jobNodes);
  const invoices = await writeInvoiceFacts(db, contractorId, invoiceNodes);
  const links    = await writeInvoiceJobLinks(db, contractorId, invoiceNodes);

  return { requests, quotes, jobs, invoices, links };
}

module.exports = {
  writeRequestFacts,
  writeQuoteFacts,
  writeJobFacts,
  writeInvoiceFacts,
  writeInvoiceJobLinks,
  captureClientFacts,
  toMoneyString,
};
