'use strict';

// ── THE MANUAL STICKY: ONE SHARED WRITER, AND A36.3 (3d Phase 1b Commit 3) ───
// PHASE_1b_DESIGN.md §3.6.
//
// Both admin write paths wrote BYTE-IDENTICAL INSERT ... ON CONFLICT statements. The batch
// ruling puts the same-rep date guard in ONE shared writer rather than in two copies, and
// this file holds that writer to two obligations that pull in opposite directions:
//
//   · THE DATE obeys the same-rep guard — re-assigning the SAME rep must not move it.
//   · THE REP obeys A36.3 — a manual assignment ALWAYS supersedes whatever the engine
//     decided, so there is no `WHERE sticky_rep_id IS NULL` and never may be.
//
// ⚠ THE ONE WAY THIS COMMIT COULD GO WRONG IS THE GUARD LEAKING FROM THE DATE ONTO THE REP,
// AND EVERY DATE ASSERTION HERE WOULD STILL PASS IF IT DID. That is why the A36.3 cases are
// not decoration: a writer that quietly refused to change the rep would satisfy "the date
// held" perfectly, and the failure would be a contractor's correction silently doing
// nothing. Guard-proof (ii) is the one that pins it.
//
// ⚠ AND IT IS TESTED AT TWO LEVELS FOR THE REASON COMMIT 2 RECORDS. The writer level proves
// the statement decides correctly; the ROUTE level proves both routes actually call it —
// a writer test cannot discover a route that still carries its own copy.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { writeManualSticky } = require('../utils/clientAssignment');

const TENANT = 'manual-aa';
const OTHER = 'manual-aa-b';

// ⚠ MONTHS IN THE PAST, SO "THE DATE HELD" AND "THE DATE MOVED TO NOW()" CANNOT LOOK ALIKE.
// A fixture seeded at NOW() makes a guard that never fires indistinguishable from one that
// always does.
const OLD_AT = '2026-03-04T11:22:33.000Z';
const OLDER_AT = '2026-01-09T07:08:09.000Z';

let pool;

const seedRep = async (contractorId, label, { attributable = true, active = true } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, active, jobber_user_id)
     VALUES ($1, $2, 'x', 'general', true, $3, $4, $5) RETURNING id`,
    [contractorId, `${contractorId}-${label}-${Math.random().toString(16).slice(2, 8)}@rep.test`,
      attributable, active, `ju-${label}`]
  );
  return rows[0].id;
};

const seedAssignment = async (clientId, {
  provisionalRepId = null, provisionalSource = null,
  stickyRepId = null, stickySource = null, writtenBy = 'live',
  assignedAt, factKind = null, factId = null, factAt = null,
}) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at,
        sticky_rep_id, sticky_source, sticky_set_at, written_by,
        assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::int IS NULL THEN NULL ELSE $10::timestamptz END,
             $5, $6, CASE WHEN $5::int IS NULL THEN NULL ELSE $10::timestamptz END, $7,
             $8::timestamptz, $9, $11, $12::timestamptz)`,
    [TENANT, clientId, provisionalRepId, provisionalSource, stickyRepId, stickySource, writtenBy,
      assignedAt, factKind, assignedAt, factId, factAt]
  );
};

const readRow = async (clientId) => {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, sticky_set_at,
            provisional_rep_id, provisional_source, written_by,
            assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at, updated_at
       FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [TENANT, clientId]
  );
  return rows[0] || null;
};

const iso = (v) => (v === null || v === undefined ? null : new Date(v).toISOString());

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  // ⚠ activity_log is NOT here and that is correct rather than an omission: it has no
  // contractor_id column, so it cannot be tenant-scoped, and this suite never reads it.
  for (const t of ['admin_messages', 'flagged_assignments', 'client_rep_assignments',
    'crm_request_facts', 'crm_quote_facts', 'jobber_clients',
    'sessions', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[TENANT, OTHER]]);
  }
  await pool.query('DELETE FROM contractors WHERE id = ANY($1::text[])', [[TENANT, OTHER]]);
  for (const id of [TENANT, OTHER]) {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('writeManualSticky — A36.3: a manual assignment ALWAYS supersedes the engine', () => {

  it('⚠ OVERWRITES AN EXISTING ENGINE STICKY — no WHERE sticky_rep_id IS NULL, ever', async () => {
    // ⚠ THE A36.3 CASE, AND THE ONE THE SAME-REP GUARD MUST NOT BREAK. The engine's
    // writeSticky is existing-wins; this writer is deliberately NOT, because an admin
    // correcting a wrong lock is the whole reason the correction path exists. A guard that
    // leaked from the date onto the rep would make this a silent no-op.
    const engineRep = await seedRep(TENANT, 'engine');
    const adminRep = await seedRep(TENANT, 'admin');
    await seedAssignment('c1', {
      stickyRepId: engineRep, stickySource: 'quote_salesperson', writtenBy: 'live',
      assignedAt: OLD_AT, factKind: 'quote', factId: 'q-1', factAt: OLD_AT,
    });

    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: adminRep });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, adminRep, 'the admin\'s rep must win');
    assert.equal(row.sticky_source, 'manual');
    assert.equal(row.written_by, 'manual');
  });

  it('overwrites an engine PROVISIONAL too, and the sticky is what wins afterwards', async () => {
    const engineRep = await seedRep(TENANT, 'engine');
    const adminRep = await seedRep(TENANT, 'admin');
    await seedAssignment('c1', {
      provisionalRepId: engineRep, provisionalSource: 'mode_a', writtenBy: 'live',
      assignedAt: OLD_AT, factKind: 'request', factId: 'r-1', factAt: OLD_AT,
    });

    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: adminRep });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, adminRep);
    // ⚠ The provisional half SURVIVES, untouched — this writer names only the sticky half,
    // exactly as both routes' statements did before the extraction.
    assert.equal(row.provisional_rep_id, engineRep);
    assert.equal(row.provisional_source, 'mode_a');
  });

  it('inserts when there is no row at all', async () => {
    const adminRep = await seedRep(TENANT, 'admin');
    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c-new', repId: adminRep });

    const row = await readRow('c-new');
    assert.equal(row.sticky_rep_id, adminRep);
    assert.equal(row.assigned_fact_kind, 'manual');
  });

  it('refuses a null rep — clearing is the DELETE path, not this writer', async () => {
    await assert.rejects(
      () => writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: null }),
      /repId is required/
    );
  });

  it('refuses without identity', async () => {
    await assert.rejects(
      () => writeManualSticky(pool, { contractorId: null, jobberClientId: 'c1', repId: 1 }),
      /contractorId and jobberClientId are required/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('writeManualSticky — the same-rep guard, on the DATE only', () => {

  it('⚠ A SAME-REP MANUAL RE-ASSIGN DOES NOT MOVE THE DATE', async () => {
    // Recon case (f-ii): an admin submits the same rep that is already there. Nothing
    // changed hands, so the client must not look newly assigned.
    const rep = await seedRep(TENANT, 'admin');
    await seedAssignment('c1', {
      stickyRepId: rep, stickySource: 'manual', writtenBy: 'manual',
      assignedAt: OLD_AT, factKind: 'manual', factId: null, factAt: OLD_AT,
    });

    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: rep });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), OLD_AT, 'the date must NOT have moved');
    assert.equal(iso(row.assigned_fact_at), OLD_AT, 'nor the fact time');
    // ⚠ AND THE WRITE STILL HAPPENED — otherwise "the date held" is satisfied by a writer
    // that did nothing at all, which is the vacuity this pairing exists to exclude.
    assert.notEqual(iso(row.updated_at), OLD_AT, 'updated_at is "last touched" and DOES move');
    assert.equal(row.sticky_source, 'manual');
  });

  it('⚠ A DIFFERENT-REP MANUAL RE-ASSIGN SETS THE DATE TO THE ACTION\'S TIME — the paired positive', async () => {
    // Guard-proof (iv). Without this, "the date held" above would be satisfied by a writer
    // that never moves the date under any circumstances.
    const oldRep = await seedRep(TENANT, 'old');
    const newRep = await seedRep(TENANT, 'new');
    await seedAssignment('c1', {
      stickyRepId: oldRep, stickySource: 'quote_salesperson', writtenBy: 'live',
      assignedAt: OLD_AT, factKind: 'quote', factId: 'q-1', factAt: OLD_AT,
    });

    const before = new Date();
    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: newRep });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, newRep);
    assert.equal(row.assigned_fact_kind, 'manual', 'the new tenure is dated by the admin action');
    assert.equal(row.assigned_fact_id, null, 'a manual action has no Jobber fact id');
    assert.notEqual(iso(row.assigned_at), OLD_AT, 'the date must have moved off the old rep\'s');
    assert.ok(new Date(row.assigned_at).getTime() >= before.getTime() - 1000,
      'and it is the action\'s own time');
  });

  it('⚠ assigned_at and assigned_fact_at are the SAME instant, not merely close', async () => {
    // Both come from one statement's NOW(), which Postgres fixes at transaction start. A
    // writer that took one from SQL and the other from a JS clock would differ by
    // milliseconds — invisible to a "roughly now" assertion, and a lie about provenance.
    const rep = await seedRep(TENANT, 'admin');
    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: rep });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), iso(row.assigned_fact_at));
  });

  it('⚠ a manual write is kind "manual", NEVER "write_time" — they coincide in value only', async () => {
    // For a manual assignment the admin's decision IS the fact, so its own time IS the
    // write time. 'write_time' means "no fact time was available", which is a different
    // claim about the same number.
    const rep = await seedRep(TENANT, 'admin');
    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: rep });

    const row = await readRow('c1');
    assert.equal(row.assigned_fact_kind, 'manual');
    assert.notEqual(row.assigned_fact_kind, 'write_time');
  });

  it('a manual assignment onto a row whose PROVISIONAL is the same rep does not move the date', async () => {
    // The effective owner is COALESCE(sticky, provisional), so promoting the incumbent
    // provisional by hand is a same-rep move even though the sticky half is newly filled.
    const rep = await seedRep(TENANT, 'admin');
    await seedAssignment('c1', {
      provisionalRepId: rep, provisionalSource: 'mode_a', writtenBy: 'live',
      assignedAt: OLD_AT, factKind: 'request', factId: 'r-1', factAt: OLD_AT,
    });

    await writeManualSticky(pool, { contractorId: TENANT, jobberClientId: 'c1', repId: rep });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, rep, 'harness: the sticky really was written');
    assert.equal(iso(row.assigned_at), OLD_AT, 'but the owner did not change');
    assert.equal(row.assigned_fact_kind, 'request', 'and the original provenance survives');
    assert.equal(row.assigned_fact_id, 'r-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('writeManualSticky — the transaction, and the two routes', () => {

  it('⚠ BOUND TO THE TRANSACTION: a ROLLBACK undoes it', async () => {
    // ⚠ Guard-proof (iii)'s subject. Both routes run inside an explicit BEGIN/COMMIT on a
    // checked-out client; a writer bound to the POOL would land on another connection and
    // SURVIVE a rollback that was supposed to undo it — leaving an assignment behind from a
    // request that returned 422 or 500.
    const rep = await seedRep(TENANT, 'admin');
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await writeManualSticky(tx, { contractorId: TENANT, jobberClientId: 'c-rb', repId: rep });
      // Visible inside the transaction...
      const { rows: inside } = await tx.query(
        `SELECT sticky_rep_id FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [TENANT, 'c-rb']
      );
      assert.equal(inside.length, 1, 'harness: the write must be visible inside its own transaction');
      await tx.query('ROLLBACK');
    } finally {
      tx.release();
    }
    assert.equal(await readRow('c-rb'), null, 'and gone after the ROLLBACK');
  });

  it('⚠ BOTH admin routes call the shared writer, and NEITHER carries its own INSERT', async () => {
    // ⚠ A SOURCE FENCE, BECAUSE A BEHAVIOURAL TEST CANNOT SEE A SECOND COPY. If one route
    // kept its own byte-identical statement, every behavioural case here would still pass
    // while that route silently skipped the same-rep guard — which is the divergence the
    // extraction exists to prevent.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin', 'team.js'), 'utf8');

    // ⚠ THE IMPORT IS ASSERTED SEPARATELY FROM THE CALL SITES, AND THIS FENCE CAUGHT ITS
    // OWN AUTHOR GETTING THAT WRONG. It first counted `writeManualSticky(` and expected 3
    // — "one import plus two call sites" — but the import is a DESTRUCTURE
    // (`const { …, writeManualSticky } = require(…)`), so it carries no `(` and the real
    // count is 2. A needle that happens to match the import as well as the calls is the
    // substring trap this repo records; separating them makes each number mean one thing.
    assert.match(src, /const \{[^}]*\bwriteManualSticky\b[^}]*\} = require\('\.\.\/\.\.\/utils\/clientAssignment'\)/,
      'team.js must import the shared writer');

    const calls = src.match(/writeManualSticky\(/g) || [];
    assert.equal(calls.length, 2, 'exactly two call sites — the flagged path and the correction path');
    assert.ok(!/INSERT INTO client_rep_assignments/.test(src),
      'no route may keep its own assignment INSERT');
  });

  it('⚠ the shared writer has NO sticky guard, asserted on its own source text', async () => {
    // ⚠ A36.3 AS A TEXT FENCE. The behavioural case above proves an engine sticky is
    // overwritten today; this pins the REASON, so a future edit adding the engine's
    // existing-wins guard "for consistency" fails here naming the rule rather than
    // surfacing as a contractor's correction doing nothing.
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'clientAssignment.js'), 'utf8');
    const body = src.slice(src.indexOf('async function writeManualSticky'));
    assert.ok(body.length > 0, 'harness: the writer must be findable');
    assert.ok(!/WHERE\s+client_rep_assignments\.sticky_rep_id\s+IS\s+NULL/i.test(body),
      'A36.3: a manual assignment always supersedes — no existing-wins guard here');
    // The paired positive: the same-rep DATE guard IS present.
    assert.match(body, /assignedAtSetClause\('sticky'\)/);
  });
});
