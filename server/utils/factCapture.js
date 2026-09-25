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
        salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids)
     SELECT $1, r.id, r.client_id, r.created_at, r.sp, r.aid, r.assigned
       FROM unnest($2::text[], $3::text[], $4::timestamptz[], $5::text[], $6::text[], $7::jsonb[])
         AS r(id, client_id, created_at, sp, aid, assigned)
     ON CONFLICT (contractor_id, jobber_request_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       created_at                 = EXCLUDED.created_at,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       assessment_id              = EXCLUDED.assessment_id,
       assigned_jobber_user_ids   = EXCLUDED.assigned_jobber_user_ids`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client.id),
      rows.map((n) => n.createdAt),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => n.assessment?.id || null),
      // ⚠ ATOMIC PER ASSESSMENT — the people on ONE assessment stay together (ruling 1).
      rows.map((n) => JSON.stringify((n.assessment?.assignedUsers?.nodes || []).map((u) => u.id).filter(Boolean))),
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

module.exports = {
  writeRequestFacts,
  writeQuoteFacts,
};
