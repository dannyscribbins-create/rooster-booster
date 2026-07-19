'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');
const { createApp } = require('../app');
const { runAttributionEngine } = require('../utils/attributionEngine');

// ── HTTP HELPERS (teamRoutes.test.js / requirePermission.test.js pattern) ─────

function httpRequest(port, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    };
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method, headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── LOCAL SEED HELPERS ────────────────────────────────────────────────────────

async function seedTeamMember(pool, {
  contractorId, email, tier = 'general', permissions = null,
  isAttributable = false, jobberUserId = null, fullName = 'Test Rep',
}) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, is_attributable, jobber_user_id, full_name)
     VALUES ($1, $2, 'hash', $3, $4, $5, $6, $7)
     RETURNING id`,
    [contractorId, email, tier, permissions, isAttributable, jobberUserId, fullName]
  );
  return rows[0].id;
}

async function makeSession(pool, { contractorId, teamMemberId }) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, contractorId, teamMemberId]
  );
  return token;
}

async function seedFlaggedAssignment(pool, {
  contractorId, jobberClientId, flagReason, status = 'open',
  repsInvolved = null, resolution = null, resolvedBy = null, resolvedAt = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO flagged_assignments
       (contractor_id, jobber_client_id, flag_reason, reps_involved, status, resolution, resolved_by, resolved_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8)
     RETURNING id`,
    [
      contractorId, jobberClientId, flagReason,
      repsInvolved ? JSON.stringify(repsInvolved) : null,
      status,
      resolution ? JSON.stringify(resolution) : null,
      resolvedBy, resolvedAt,
    ]
  );
  return rows[0].id;
}

async function seedJobberClient(pool, { contractorId, jobberClientId, firstName, lastName }) {
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
    [jobberClientId, contractorId, firstName, lastName]
  );
}

// ── CLIENT + FETCHER FIXTURES (mirrors attributionEngine.test.js) ────────────

function makeClient(id, quoteNodes = []) {
  return { id, quotes: { nodes: quoteNodes }, jobs: { nodes: [] }, customFields: [] };
}

function makeApprovedQuote({
  id = 'q-1', salespersonId = null, quoteStatus = 'converted',
  lastTransitioned = { approvedAt: '2026-05-01T00:00:00Z' },
} = {}) {
  return { id, quoteStatus, salesperson: salespersonId ? { id: salespersonId } : null, lastTransitioned };
}

function modeAFetcher(assignedUserIds = [], assessmentId = 'assess-1', requestCreatedAt = '2026-05-01T00:00:00Z') {
  const assessment = { id: assessmentId, assignedUsers: { nodes: assignedUserIds.map(id => ({ id })) } };
  return async () => ({
    assessments: [assessment],
    requests: [{ id: 'req-1', createdAt: requestCreatedAt, salesperson: null, assessment }],
  });
}

const emptyFetcher = async () => ({ assessments: [], requests: [] });

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const CID_A = 'fa-tenant-a';
const CID_B = 'fa-tenant-b';
const DEFAULT_ANCHOR = new Date('2026-01-01T00:00:00Z');

async function cleanTenant(pool, contractorId) {
  await pool.query('DELETE FROM admin_messages WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM flagged_assignments WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM client_rep_assignments WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM jobber_clients WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM sessions WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM team_members WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM contractor_crm_settings WHERE contractor_id = $1', [contractorId]);
}

describe('Flagged Assignments queue — migration, routes, engine wiring', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    await seedContractor(pool, CID_A);
    await seedContractor(pool, CID_B);
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await cleanTenant(pool, CID_A);
    await cleanTenant(pool, CID_B);
    await pool.end();
  });

  beforeEach(async () => {
    await cleanTenant(pool, CID_A);
    await cleanTenant(pool, CID_B);
  });

  // ── GROUP 1: MIGRATION ──────────────────────────────────────────────────────
  describe('migration: flagged_assignments status backfill', () => {
    let addFlaggedAssignmentsStatus;

    before(() => {
      // Lazy require so a missing module only fails this describe's tests, not the whole file.
      addFlaggedAssignmentsStatus = require('../migrations/add_flagged_assignments_status');
    });

    it('fresh double-run is idempotent (no throw, columns/constraint present)', async () => {
      await addFlaggedAssignmentsStatus(pool);
      await addFlaggedAssignmentsStatus(pool);
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'flagged_assignments' AND column_name IN ('status', 'resolution', 'resolved_by', 'resolved_at')`
      );
      assert.equal(rows.length, 4, 'all four new columns must exist after migration');
    });

    it('dirty-data reproduction: reproduces production\'s exact live shape (2 rows, both flag_reason=orphan, reviewed=false/true) plus a rep_co_assignment edge row with reps_involved JSONB', async () => {
      // Re-add the legacy columns temporarily to simulate a real pre-existing row shape;
      // the migration's own DROP COLUMN IF EXISTS steps will remove them again when re-invoked
      // below. (Both reviewed and reviewed_at, since the migration drops both — reviewed_at was
      // missing from this reproduction originally; added so the INSERT below, which references
      // it directly, doesn't fail against a column the earlier fresh-double-run test already dropped.)
      await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE flagged_assignments ALTER COLUMN status DROP NOT NULL`);

      // Production's exact reported shape (Danny's breakdown query): exactly 2 rows, both
      // flag_reason='orphan' — one reviewed=false, one reviewed=true. Zero rep_co_assignment rows.
      const oldReviewedAt = new Date('2026-06-01T12:00:00Z');
      const { rows: ins } = await pool.query(
        `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reviewed, reviewed_at, review_note, status)
         VALUES ($1, $2, 'orphan', true, $3, 'legacy note', NULL) RETURNING id`,
        [CID_A, 'dirty-legacy-resolved', oldReviewedAt]
      );
      const { rows: ins2 } = await pool.query(
        `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reviewed, status)
         VALUES ($1, $2, 'orphan', false, NULL) RETURNING id`,
        [CID_A, 'dirty-legacy-open']
      );
      // Edge addition (Danny-suggested): a rep_co_assignment row carrying reps_involved JSONB,
      // to prove the migration's backfill leaves candidate data completely untouched.
      const repsInvolved = [{ id: 501, full_name: 'Edge Rep One' }, { id: 502, full_name: 'Edge Rep Two' }];
      const { rows: ins3 } = await pool.query(
        `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, reviewed, status)
         VALUES ($1, $2, 'rep_co_assignment', $3::jsonb, false, NULL) RETURNING id`,
        [CID_A, 'dirty-legacy-co-assign', JSON.stringify(repsInvolved)]
      );

      await addFlaggedAssignmentsStatus(pool);

      const { rows: resolvedRow } = await pool.query(
        'SELECT status, resolved_at, review_note FROM flagged_assignments WHERE id = $1',
        [ins[0].id]
      );
      assert.equal(resolvedRow[0].status, 'resolved', 'reviewed=true legacy row must backfill to status=resolved');
      assert.equal(new Date(resolvedRow[0].resolved_at).getTime(), oldReviewedAt.getTime(), 'reviewed_at must carry into resolved_at');
      assert.equal(resolvedRow[0].review_note, 'legacy note', 'review_note must be preserved, not dropped');

      const { rows: openRow } = await pool.query(
        'SELECT status, resolved_at FROM flagged_assignments WHERE id = $1',
        [ins2[0].id]
      );
      assert.equal(openRow[0].status, 'open', 'reviewed=false legacy row must backfill to status=open');
      assert.equal(openRow[0].resolved_at, null, 'no reviewed_at means resolved_at stays null');

      const { rows: coAssignRow } = await pool.query(
        'SELECT status, resolved_at, reps_involved FROM flagged_assignments WHERE id = $1',
        [ins3[0].id]
      );
      assert.equal(coAssignRow[0].status, 'open', 'rep_co_assignment edge row (reviewed=false) must also backfill to status=open');
      assert.equal(coAssignRow[0].resolved_at, null);
      assert.deepEqual(coAssignRow[0].reps_involved, repsInvolved, 'reps_involved JSONB must survive the migration completely untouched');

      const { rows: reviewedColStillExists } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'flagged_assignments' AND column_name = 'reviewed'`
      );
      assert.equal(reviewedColStillExists.length, 0, 'reviewed column must be dropped after migration');

      await assert.rejects(
        pool.query(`INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status) VALUES ($1, $2, 'orphan', NULL)`,
          [CID_A, 'null-status-reject']),
        err => { assert.equal(err.code, '23502', `expected NOT NULL violation, got ${err.code}`); return true; }
      );
    });

    it('contractor-#2 present boot clean: migration runs per-row without any single-contractor assumption', async () => {
      // Both legacy columns must come back together — the real pre-migration table always has
      // reviewed and reviewed_at side by side, and the migration's backfill UPDATE references
      // both unconditionally once it detects `reviewed`, so reviewed_at must exist too even
      // though this test's own rows don't set it.
      await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE flagged_assignments ALTER COLUMN status DROP NOT NULL`);
      const { rows: rowsA } = await pool.query(
        `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reviewed, status)
         VALUES ($1, 'boot-sim-a', 'orphan', true, NULL) RETURNING id`, [CID_A]
      );
      const { rows: rowsB } = await pool.query(
        `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reviewed, status)
         VALUES ($1, 'boot-sim-b', 'orphan', false, NULL) RETURNING id`, [CID_B]
      );

      await assert.doesNotReject(addFlaggedAssignmentsStatus(pool));

      const { rows: checkA } = await pool.query('SELECT status FROM flagged_assignments WHERE id = $1', [rowsA[0].id]);
      const { rows: checkB } = await pool.query('SELECT status FROM flagged_assignments WHERE id = $1', [rowsB[0].id]);
      assert.equal(checkA[0].status, 'resolved');
      assert.equal(checkB[0].status, 'open');
    });

    it('index (contractor_id, status) exists', async () => {
      await addFlaggedAssignmentsStatus(pool);
      const { rows } = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'flagged_assignments' AND indexdef LIKE '%contractor_id%status%'`
      );
      assert.ok(rows.length >= 1, 'expected an index covering (contractor_id, status)');
    });

    it('status CHECK constraint accepts open/resolved/dismissed/auto_resolved and rejects anything else', async () => {
      await addFlaggedAssignmentsStatus(pool);
      for (const status of ['open', 'resolved', 'dismissed', 'auto_resolved']) {
        await assert.doesNotReject(
          pool.query(`INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status) VALUES ($1, $2, 'orphan', $3)`,
            [CID_A, `check-ok-${status}`, status])
        );
      }
      await assert.rejects(
        pool.query(`INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status) VALUES ($1, $2, 'orphan', 'bogus')`,
          [CID_A, 'check-bad']),
        err => { assert.equal(err.code, '23514'); return true; }
      );
    });
  });

  // ── GROUP 2: GET queue list ─────────────────────────────────────────────────
  describe('GET /api/admin/team/flagged-assignments', () => {
    it('returns only the session contractor\'s flags (tenant isolation)', async () => {
      const ownerA = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-a@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const ownerB = await seedTeamMember(pool, { contractorId: CID_B, email: 'owner-b@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-a-1', flagReason: 'orphan' });
      await seedFlaggedAssignment(pool, { contractorId: CID_B, jobberClientId: 'jc-b-1', flagReason: 'orphan' });

      const tokenA = await makeSession(pool, { contractorId: CID_A, teamMemberId: ownerA });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, tokenA);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.flags));
      assert.equal(res.body.flags.length, 1);
      assert.equal(res.body.flags[0].jobber_client_id, 'jc-a-1');
    });

    it('defaults to status=open when no filter param given', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-default@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-open', flagReason: 'orphan', status: 'open' });
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-resolved', flagReason: 'orphan', status: 'resolved' });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, token);
      assert.equal(res.status, 200);
      assert.equal(res.body.flags.length, 1);
      assert.equal(res.body.flags[0].jobber_client_id, 'jc-open');
    });

    it('status filter param reaches resolved/dismissed history', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-filter@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-dismissed', flagReason: 'orphan', status: 'dismissed' });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments?status=dismissed', null, token);
      assert.equal(res.status, 200);
      assert.equal(res.body.flags.length, 1);
      assert.equal(res.body.flags[0].status, 'dismissed');
    });

    it('hydrates rep names for reps_involved', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-hydrate@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const repA = await seedTeamMember(pool, { contractorId: CID_A, email: 'rep-a@fa.com', fullName: 'Rep Alpha', isAttributable: true, jobberUserId: 'jb-rep-a' });
      const repB = await seedTeamMember(pool, { contractorId: CID_A, email: 'rep-b@fa.com', fullName: 'Rep Beta', isAttributable: true, jobberUserId: 'jb-rep-b' });
      await seedFlaggedAssignment(pool, {
        contractorId: CID_A, jobberClientId: 'jc-co-assign', flagReason: 'rep_co_assignment',
        repsInvolved: [repA, repB],
      });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, token);
      assert.equal(res.status, 200);
      const names = res.body.flags[0].reps_involved.map(r => r.full_name).sort();
      assert.deepEqual(names, ['Rep Alpha', 'Rep Beta']);
    });

    it('renders flag_reason generically — an orphan flag (no reps_involved) does not crash the hydration step', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-orphan@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-orphan', flagReason: 'orphan', repsInvolved: null });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, token);
      assert.equal(res.status, 200);
      assert.equal(res.body.flags[0].flag_reason, 'orphan');
      assert.deepEqual(res.body.flags[0].reps_involved, []);
    });

    it('permission gate: 403 without rep_assignment', async () => {
      const noPerm = await seedTeamMember(pool, { contractorId: CID_A, email: 'noperm-list@fa.com', tier: 'general', permissions: {} });
      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: noPerm });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, token);
      assert.equal(res.status, 403);
    });
  });

  // ── GROUP 3: PATCH resolve (assign) ────────────────────────────────────────
  describe('PATCH /api/admin/team/flagged-assignments/:id — assign', () => {
    it('assigns a candidate: writes client_rep_assignments (sticky_source=manual), resolves the flag, logs activity', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-assign@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const rep = await seedTeamMember(pool, { contractorId: CID_A, email: 'rep-assign@fa.com', isAttributable: true, jobberUserId: 'jb-assign-rep' });
      const flagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-resolve-1', flagReason: 'rep_co_assignment', repsInvolved: [rep] });

      const { rows: beforeLog } = await pool.query('SELECT COUNT(*) FROM activity_log');

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagId}`, { action: 'assign', rep_id: rep }, token);
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const { rows: cra } = await pool.query(
        'SELECT sticky_rep_id, sticky_source, sticky_set_at FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2',
        [CID_A, 'jc-resolve-1']
      );
      assert.equal(cra[0].sticky_rep_id, rep);
      assert.equal(cra[0].sticky_source, 'manual');
      assert.ok(cra[0].sticky_set_at);

      const { rows: flag } = await pool.query('SELECT status, resolution, resolved_by, resolved_at FROM flagged_assignments WHERE id = $1', [flagId]);
      assert.equal(flag[0].status, 'resolved');
      assert.equal(flag[0].resolution.action, 'assign');
      assert.equal(flag[0].resolution.rep_id, rep);
      assert.equal(flag[0].resolved_by, owner);
      assert.ok(flag[0].resolved_at);

      const { rows: afterLog } = await pool.query('SELECT COUNT(*) FROM activity_log');
      assert.equal(Number(afterLog[0].count), Number(beforeLog[0].count) + 1, 'exactly one activity_log row must be written');
    });

    it('rejects assigning a rep from another contractor (cross-tenant rep_id)', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-crossrep@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const repB = await seedTeamMember(pool, { contractorId: CID_B, email: 'rep-crossrep@fa.com', isAttributable: true, jobberUserId: 'jb-crossrep' });
      const flagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-crossrep', flagReason: 'orphan' });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagId}`, { action: 'assign', rep_id: repB }, token);
      assert.ok([400, 404, 422].includes(res.status), `expected a client-error rejection, got ${res.status}`);

      const { rows: cra } = await pool.query('SELECT 1 FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2', [CID_A, 'jc-crossrep']);
      assert.equal(cra.length, 0, 'no assignment row should be written on a rejected cross-tenant rep_id');
    });

    it('rejects assigning to a non-open flag (already resolved)', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-notopen@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const rep = await seedTeamMember(pool, { contractorId: CID_A, email: 'rep-notopen@fa.com', isAttributable: true, jobberUserId: 'jb-notopen' });
      const flagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-notopen', flagReason: 'orphan', status: 'resolved' });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagId}`, { action: 'assign', rep_id: rep }, token);
      assert.ok([404, 409].includes(res.status), `expected 404/409 for a non-open flag, got ${res.status}`);
    });
  });

  // ── GROUP 4: PATCH dismiss ──────────────────────────────────────────────────
  describe('PATCH /api/admin/team/flagged-assignments/:id — dismiss', () => {
    it('dismisses: status=dismissed, no client_rep_assignments write, activity logged, note recorded', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-dismiss@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const flagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-dismiss-1', flagReason: 'orphan' });

      const { rows: beforeLog } = await pool.query('SELECT COUNT(*) FROM activity_log');

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagId}`, { action: 'dismiss', note: 'false positive' }, token);
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const { rows: flag } = await pool.query('SELECT status, resolution, resolved_by, resolved_at FROM flagged_assignments WHERE id = $1', [flagId]);
      assert.equal(flag[0].status, 'dismissed');
      assert.equal(flag[0].resolution.note, 'false positive');
      assert.ok(flag[0].resolved_by);
      assert.ok(flag[0].resolved_at);

      const { rows: cra } = await pool.query('SELECT 1 FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2', [CID_A, 'jc-dismiss-1']);
      assert.equal(cra.length, 0, 'dismiss must never write client_rep_assignments');

      const { rows: afterLog } = await pool.query('SELECT COUNT(*) FROM activity_log');
      assert.equal(Number(afterLog[0].count), Number(beforeLog[0].count) + 1);
    });
  });

  // ── GROUP 5: CROSS-TENANT KILL-SHOT ─────────────────────────────────────────
  describe('cross-tenant kill-shot', () => {
    it('admin A resolving contractor B\'s flag → 0 rows, 404-family, no assignment write, no log row, flag untouched', async () => {
      const ownerA = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-killshot@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const repA = await seedTeamMember(pool, { contractorId: CID_A, email: 'rep-killshot@fa.com', isAttributable: true, jobberUserId: 'jb-killshot' });
      const flagIdB = await seedFlaggedAssignment(pool, { contractorId: CID_B, jobberClientId: 'jc-killshot-b', flagReason: 'orphan' });

      const { rows: beforeLog } = await pool.query('SELECT COUNT(*) FROM activity_log');

      const tokenA = await makeSession(pool, { contractorId: CID_A, teamMemberId: ownerA });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagIdB}`, { action: 'assign', rep_id: repA }, tokenA);
      assert.ok([404, 403].includes(res.status), `expected 404-family rejection, got ${res.status}`);

      const { rows: flag } = await pool.query('SELECT status FROM flagged_assignments WHERE id = $1', [flagIdB]);
      assert.equal(flag[0].status, 'open', 'contractor B\'s flag must remain untouched');

      const { rows: cra } = await pool.query('SELECT 1 FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2', [CID_B, 'jc-killshot-b']);
      assert.equal(cra.length, 0, 'no assignment write must occur');

      const { rows: afterLog } = await pool.query('SELECT COUNT(*) FROM activity_log');
      assert.equal(Number(afterLog[0].count), Number(beforeLog[0].count), 'no activity_log row on a rejected cross-tenant resolve');
    });

    it('admin A listing the queue never sees contractor B\'s flag by direct id lookup either (also covered by list-scoping test above)', async () => {
      const ownerA = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-killshot2@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const flagIdB = await seedFlaggedAssignment(pool, { contractorId: CID_B, jobberClientId: 'jc-killshot-b2', flagReason: 'orphan' });
      const tokenA = await makeSession(pool, { contractorId: CID_A, teamMemberId: ownerA });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/flagged-assignments/${flagIdB}`, { action: 'dismiss' }, tokenA);
      assert.ok([404, 403].includes(res.status));
    });
  });

  // ── GROUP 6: is_attributable toggle (existing PATCH /api/admin/team/:id) ───
  describe('PATCH /api/admin/team/:id — is_attributable whitelist addition', () => {
    it('Owner can set is_attributable=true, persisted', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-attr1@fa.com', tier: 'owner', permissions: {} });
      const target = await seedTeamMember(pool, { contractorId: CID_A, email: 'target-attr1@fa.com', isAttributable: false });
      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`, { is_attributable: true }, token);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const { rows } = await pool.query('SELECT is_attributable FROM team_members WHERE id = $1', [target]);
      assert.equal(rows[0].is_attributable, true);
    });

    it('Owner can set is_attributable=false, persisted', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-attr2@fa.com', tier: 'owner', permissions: {} });
      const target = await seedTeamMember(pool, { contractorId: CID_A, email: 'target-attr2@fa.com', isAttributable: true });
      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`, { is_attributable: false }, token);
      assert.equal(res.status, 200);
      const { rows } = await pool.query('SELECT is_attributable FROM team_members WHERE id = $1', [target]);
      assert.equal(rows[0].is_attributable, false);
    });

    it('rejects a non-boolean is_attributable value with 422', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-attr3@fa.com', tier: 'owner', permissions: {} });
      const target = await seedTeamMember(pool, { contractorId: CID_A, email: 'target-attr3@fa.com' });
      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`, { is_attributable: 'yes' }, token);
      assert.equal(res.status, 422);
    });

    it('denied without team.manage', async () => {
      const noPerm = await seedTeamMember(pool, { contractorId: CID_A, email: 'noperm-attr@fa.com', tier: 'admin', permissions: {} });
      const target = await seedTeamMember(pool, { contractorId: CID_A, email: 'target-attr4@fa.com' });
      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: noPerm });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`, { is_attributable: true }, token);
      assert.equal(res.status, 403);
    });
  });

  // ── GROUP 7: admin_messages insert on flag creation ────────────────────────
  describe('attributionEngine flag creation → admin_messages', () => {
    it('a NEW rep_co_assignment flag inserts exactly one message_type=flagged_assignment admin_messages row; dedup no-op inserts none', async () => {
      const repA = await seedTeamMember(pool, { contractorId: CID_A, email: 'engine-rep-a@fa.com', isAttributable: true, jobberUserId: 'jb-engine-a' });
      const repB = await seedTeamMember(pool, { contractorId: CID_A, email: 'engine-rep-b@fa.com', isAttributable: true, jobberUserId: 'jb-engine-b' });
      const clientId = 'jc-engine-co-assign';
      const client = makeClient(clientId, []);
      const fetcher = modeAFetcher(['jb-engine-a', 'jb-engine-b']);

      await runAttributionEngine(pool, {
        contractorId: CID_A, jobberClientId: clientId, currentStatus: 'sold',
        client, fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      });

      const { rows: flagRows } = await pool.query(
        `SELECT id FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'rep_co_assignment'`,
        [CID_A, clientId]
      );
      assert.equal(flagRows.length, 1);
      const flagId = flagRows[0].id;

      const { rows: msgRows } = await pool.query(
        `SELECT * FROM admin_messages WHERE contractor_id = $1 AND message_type = 'flagged_assignment' AND reference_id = $2`,
        [CID_A, flagId]
      );
      assert.equal(msgRows.length, 1, 'exactly one admin_messages row on flag creation');

      // Second conflicting event on the same already-flagged client — dedup no-op, no second message
      await runAttributionEngine(pool, {
        contractorId: CID_A, jobberClientId: clientId, currentStatus: 'sold',
        client, fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      });
      const { rows: msgRowsAfter } = await pool.query(
        `SELECT * FROM admin_messages WHERE contractor_id = $1 AND message_type = 'flagged_assignment' AND reference_id = $2`,
        [CID_A, flagId]
      );
      assert.equal(msgRowsAfter.length, 1, 'no second message on dedup no-op');
    });

    it('a NEW orphan flag inserts one admin_messages row', async () => {
      const clientId = 'jc-engine-orphan';
      const client = makeClient(clientId, []);

      await runAttributionEngine(pool, {
        contractorId: CID_A, jobberClientId: clientId, currentStatus: 'sold',
        client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      });

      const { rows: flagRows } = await pool.query(
        `SELECT id FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'orphan'`,
        [CID_A, clientId]
      );
      assert.equal(flagRows.length, 1);

      const { rows: msgRows } = await pool.query(
        `SELECT * FROM admin_messages WHERE contractor_id = $1 AND message_type = 'flagged_assignment' AND reference_id = $2`,
        [CID_A, flagRows[0].id]
      );
      assert.equal(msgRows.length, 1);
    });
  });

  // ── GROUP 8: auto-resolution ────────────────────────────────────────────────
  describe('auto-resolution: independent successful sticky assignment closes an open flag', () => {
    it('flag open → client receives sticky via quote_salesperson path → flag becomes auto_resolved and drops off the open queue', async () => {
      const rep = await seedTeamMember(pool, { contractorId: CID_A, email: 'autoresolve-rep@fa.com', isAttributable: true, jobberUserId: 'jb-autoresolve' });
      const clientId = 'jc-autoresolve';
      const openFlagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: clientId, flagReason: 'orphan' });
      // control flag for a different client — must remain untouched
      const controlFlagId = await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: 'jc-control-untouched', flagReason: 'orphan' });

      const quote = makeApprovedQuote({ salespersonId: 'jb-autoresolve', lastTransitioned: { approvedAt: '2026-05-01T00:00:00Z' } });
      const client = makeClient(clientId, [quote]);

      await runAttributionEngine(pool, {
        contractorId: CID_A, jobberClientId: clientId, currentStatus: 'sold',
        client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      });

      const { rows: cra } = await pool.query(
        'SELECT sticky_rep_id, sticky_source FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2',
        [CID_A, clientId]
      );
      assert.equal(cra[0].sticky_rep_id, rep, 'sanity: sticky must actually have been set via the normal engine path');
      assert.equal(cra[0].sticky_source, 'quote_salesperson');

      const { rows: flag } = await pool.query('SELECT status, resolved_at FROM flagged_assignments WHERE id = $1', [openFlagId]);
      assert.equal(flag[0].status, 'auto_resolved');
      assert.ok(flag[0].resolved_at);

      const { rows: control } = await pool.query('SELECT status FROM flagged_assignments WHERE id = $1', [controlFlagId]);
      assert.equal(control[0].status, 'open', 'a different client\'s open flag must not be touched');
    });

    it('the auto-resolved flag no longer appears in the default (status=open) queue list', async () => {
      const owner = await seedTeamMember(pool, { contractorId: CID_A, email: 'owner-autoresolve@fa.com', tier: 'owner', permissions: { rep_assignment: true } });
      const rep = await seedTeamMember(pool, { contractorId: CID_A, email: 'autoresolve-rep2@fa.com', isAttributable: true, jobberUserId: 'jb-autoresolve2' });
      const clientId = 'jc-autoresolve2';
      await seedFlaggedAssignment(pool, { contractorId: CID_A, jobberClientId: clientId, flagReason: 'orphan' });

      const quote = makeApprovedQuote({ salespersonId: 'jb-autoresolve2', lastTransitioned: { approvedAt: '2026-05-01T00:00:00Z' } });
      const client = makeClient(clientId, [quote]);
      await runAttributionEngine(pool, {
        contractorId: CID_A, jobberClientId: clientId, currentStatus: 'sold',
        client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      });

      const token = await makeSession(pool, { contractorId: CID_A, teamMemberId: owner });
      const res = await httpRequest(port, 'GET', '/api/admin/team/flagged-assignments', null, token);
      assert.equal(res.status, 200);
      assert.equal(res.body.flags.find(f => f.jobber_client_id === clientId), undefined, 'auto_resolved flag must not show in the open queue');
    });
  });
});
