'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');
const { createApp } = require('../app');
const { initDB } = require('../db');

// ── C/DL-3a PHASE 2A — REP-PROMOTION WRITE-PATH ───────────────────────────────
// Covers the single sanctioned writer of the three rep flags
// (is_field_rep, is_attributable, rep_revenue_visibility) and the database
// CHECK constraint that backstops it independently of the endpoint.
//
// COHERENCE RULE (locked): every rep ability requires is_field_rep = true.
// is_attributable and rep_revenue_visibility may never be true while
// is_field_rep is false — enforced at BOTH layers, deliberately:
//   Layer 1 — POST /api/admin/team/:id/promote returns 422 on an incoherent merge.
//   Layer 2 — team_members_rep_coherence CHECK rejects it at the database, so a
//             direct SQL write (the exact mechanism that produced Known Issue 13's
//             production drift, before any UI existed) cannot reintroduce it.
//
// Groups 1 and 2 are the guard proof: group 1 bypasses the endpoint entirely and
// writes straight to the table, so a green group 1 with a broken endpoint — or a
// green group 2 with no constraint — each still leaves the other layer proven.

const CID_A = 'rep-promo-tenant-a';
const CID_B = 'rep-promo-tenant-b';

// ── HTTP HELPER (teamRoutes.test.js / flaggedQueue.test.js pattern) ───────────

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

// Asserts fn() rejects with a SPECIFIC PostgreSQL SQLSTATE (inviteTokenSchema.test.js
// pattern, Phase 1 precedent). Pinning the code matters here: a bare assert.rejects()
// could go green on a typo'd column name (42703) and would silently stop testing the
// CHECK the moment anything else about the statement broke.
async function expectPgError(fn, code, label) {
  try {
    await fn();
  } catch (err) {
    assert.equal(
      err.code, code,
      `${label}: expected SQLSTATE ${code}, got ${err.code} — ${err.message}`
    );
    return;
  }
  assert.fail(`${label}: expected SQLSTATE ${code}, but the statement succeeded`);
}

// ── LOCAL SEED HELPERS ────────────────────────────────────────────────────────

let memberCounter = 0;
async function seedTeamMember(pool, {
  contractorId, tier = 'general', permissions = null, fullName = 'Test Member',
  isFieldRep = false, isAttributable = false, repRevenueVisibility = false,
}) {
  memberCounter += 1;
  const { rows } = await pool.query(
    `INSERT INTO team_members
       (contractor_id, email, password_hash, tier, permissions,
        full_name, is_field_rep, is_attributable, rep_revenue_visibility)
     VALUES ($1, $2, 'hash', $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      contractorId, `rep-promo-${memberCounter}@test.com`, tier, permissions,
      fullName, isFieldRep, isAttributable, repRevenueVisibility,
    ]
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

// Reads the three rep flags straight from the table — never from the response body,
// so an endpoint that returns the right JSON while writing the wrong row still fails.
async function readFlags(pool, memberId) {
  const { rows } = await pool.query(
    `SELECT is_field_rep, is_attributable, rep_revenue_visibility
     FROM team_members WHERE id = $1`,
    [memberId]
  );
  return rows[0];
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('C/DL-3a Phase 2A — rep-promotion write-path', () => {
  let pool, server, port;
  let ownerA, ownerAToken;

  before(async () => {
    pool = await initTestDb();
    await seedContractor(pool, CID_A);
    await seedContractor(pool, CID_B);
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // Fresh Owner + session per test — Owner tier short-circuits requirePermission,
    // so this caller always holds rep_promotion implicitly.
    ownerA = await seedTeamMember(pool, { contractorId: CID_A, tier: 'owner', fullName: 'Owner A' });
    ownerAToken = await makeSession(pool, { contractorId: CID_A, teamMemberId: ownerA });
  });

  // ══ GROUP 1 — DATABASE CHECK CONSTRAINT (endpoint bypassed entirely) ════════
  // These write directly to team_members with pool.query. They prove the DB layer
  // rejects an incoherent row on its own — no route, no middleware, no validator.
  describe('DB constraint: team_members_rep_coherence', () => {
    it('[direct SQL] is_attributable = true while is_field_rep = false → 23514', async () => {
      const id = await seedTeamMember(pool, { contractorId: CID_A });
      await expectPgError(
        () => pool.query(
          `UPDATE team_members SET is_field_rep = false, is_attributable = true WHERE id = $1`,
          [id]
        ),
        '23514',
        'attributable without field rep'
      );
    });

    it('[direct SQL] rep_revenue_visibility = true while is_field_rep = false → 23514', async () => {
      const id = await seedTeamMember(pool, { contractorId: CID_A });
      await expectPgError(
        () => pool.query(
          `UPDATE team_members SET is_field_rep = false, rep_revenue_visibility = true WHERE id = $1`,
          [id]
        ),
        '23514',
        'revenue visibility without field rep'
      );
    });

    it('[direct SQL] a coherent update is accepted (constraint is not over-broad)', async () => {
      const id = await seedTeamMember(pool, { contractorId: CID_A });
      await assert.doesNotReject(
        pool.query(
          `UPDATE team_members
           SET is_field_rep = true, is_attributable = true, rep_revenue_visibility = true
           WHERE id = $1`,
          [id]
        )
      );
      const flags = await readFlags(pool, id);
      assert.deepEqual(flags, {
        is_field_rep: true, is_attributable: true, rep_revenue_visibility: true,
      });
    });

    it('[direct SQL] a plain field rep with no extra abilities is accepted', async () => {
      const id = await seedTeamMember(pool, { contractorId: CID_A });
      await assert.doesNotReject(
        pool.query(`UPDATE team_members SET is_field_rep = true WHERE id = $1`, [id])
      );
    });
  });

  // ══ GROUP 2 — POST /api/admin/team/:id/promote ══════════════════════════════
  describe('POST /api/admin/team/:id/promote', () => {
    it('is_attributable = true on a member who is not (and is not being made) a field rep → 422', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_attributable: true }, ownerAToken);

      assert.equal(res.status, 422, 'incoherent merge must be rejected by the endpoint');
      const flags = await readFlags(pool, target);
      assert.equal(flags.is_attributable, false, 'rejected request must not have written anything');
    });

    it('rep_revenue_visibility = true without field rep → 422', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { rep_revenue_visibility: true }, ownerAToken);

      assert.equal(res.status, 422);
      const flags = await readFlags(pool, target);
      assert.equal(flags.rep_revenue_visibility, false, 'rejected request must not have written anything');
    });

    it('coherent promotion (is_field_rep + is_attributable together) → 200, all three flags in RETURNING', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_field_rep: true, is_attributable: true }, ownerAToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.is_field_rep, true, 'RETURNING must carry is_field_rep');
      assert.equal(res.body.is_attributable, true, 'RETURNING must carry is_attributable');
      assert.equal(res.body.rep_revenue_visibility, false, 'RETURNING must carry rep_revenue_visibility');

      const flags = await readFlags(pool, target);
      assert.deepEqual(flags, {
        is_field_rep: true, is_attributable: true, rep_revenue_visibility: false,
      });
    });

    it('is_attributable = true is coherent once the member is ALREADY a field rep (merge reads current state)', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A, isFieldRep: true });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_attributable: true }, ownerAToken);

      assert.equal(res.status, 200, 'coherence is evaluated on the MERGED state, not the payload alone');
      const flags = await readFlags(pool, target);
      assert.deepEqual(flags, {
        is_field_rep: true, is_attributable: true, rep_revenue_visibility: false,
      });
    });

    it('is_field_rep = false in the same call zeroes is_attributable AND rep_revenue_visibility', async () => {
      const target = await seedTeamMember(pool, {
        contractorId: CID_A, isFieldRep: true, isAttributable: true, repRevenueVisibility: true,
      });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_field_rep: false }, ownerAToken);

      assert.equal(res.status, 200, 'demotion is a legal coherent operation, not a 422');
      assert.equal(res.body.is_attributable, false);
      assert.equal(res.body.rep_revenue_visibility, false);

      const flags = await readFlags(pool, target);
      assert.deepEqual(flags, {
        is_field_rep: false, is_attributable: false, rep_revenue_visibility: false,
      }, 'demotion must force both dependent abilities off in the same UPDATE');
    });

    it('non-boolean body value → 422 (strict boolean — no isBoolean() yes/no leniency)', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });

      for (const payload of [
        { is_field_rep: 'yes' },
        { is_attributable: 'true' },
        { rep_revenue_visibility: 1 },
      ]) {
        const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`, payload, ownerAToken);
        assert.equal(
          res.status, 422,
          `${JSON.stringify(payload)} must be rejected — only a real boolean is acceptable`
        );
      }

      const flags = await readFlags(pool, target);
      assert.equal(flags.is_field_rep, false, 'no coerced value may have been written');
    });

    it('empty body → 400 (nothing to update)', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`, {}, ownerAToken);
      assert.equal(res.status, 400);
    });

    it('target belonging to a different contractor → 404, and is NOT modified (tenancy)', async () => {
      const foreign = await seedTeamMember(pool, { contractorId: CID_B });
      const res = await httpRequest(port, 'POST', `/api/admin/team/${foreign}/promote`,
        { is_field_rep: true }, ownerAToken);

      assert.equal(res.status, 404);
      // Body assertion is load-bearing: an UNMOUNTED route also 404s, which would make
      // this test pass for entirely the wrong reason. Express's default 404 is HTML with
      // no JSON error field — only the real handler produces 'Member not found'.
      assert.equal(res.body?.error, 'Member not found', 'must be the handler\'s 404, not Express\'s route-miss 404');

      const flags = await readFlags(pool, foreign);
      assert.equal(flags.is_field_rep, false, 'cross-tenant write must not land');
    });

    it('caller lacking rep_promotion → 403', async () => {
      const caller = await seedTeamMember(pool, {
        contractorId: CID_A, tier: 'admin', permissions: { 'team.manage': true },
      });
      const callerToken = await makeSession(pool, { contractorId: CID_A, teamMemberId: caller });
      const target = await seedTeamMember(pool, { contractorId: CID_A });

      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_field_rep: true }, callerToken);

      assert.equal(res.status, 403, 'team.manage must NOT be sufficient — promotion has its own flag');
      const flags = await readFlags(pool, target);
      assert.equal(flags.is_field_rep, false);
    });

    it('caller WITH rep_promotion but not Owner tier → allowed for a General-tier target', async () => {
      const caller = await seedTeamMember(pool, {
        contractorId: CID_A, tier: 'admin', permissions: { rep_promotion: true },
      });
      const callerToken = await makeSession(pool, { contractorId: CID_A, teamMemberId: caller });
      const target = await seedTeamMember(pool, { contractorId: CID_A, tier: 'general' });

      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_field_rep: true }, callerToken);
      assert.equal(res.status, 200);
    });

    it('non-Owner caller may not promote an Admin-tier target → 403 (Owner-edits-Admin wall, D-b)', async () => {
      const caller = await seedTeamMember(pool, {
        contractorId: CID_A, tier: 'admin', permissions: { rep_promotion: true },
      });
      const callerToken = await makeSession(pool, { contractorId: CID_A, teamMemberId: caller });
      const target = await seedTeamMember(pool, { contractorId: CID_A, tier: 'admin' });

      const res = await httpRequest(port, 'POST', `/api/admin/team/${target}/promote`,
        { is_field_rep: true }, callerToken);

      assert.equal(res.status, 403, 'only Owners may touch Admin-tier rows');
      const flags = await readFlags(pool, target);
      assert.equal(flags.is_field_rep, false);
    });
  });

  // ══ GROUP 3 — the general PATCH may no longer write rep flags ═══════════════
  describe('PATCH /api/admin/team/:id no longer writes is_attributable', () => {
    it('is_attributable in the PATCH body is rejected — promote is the only writer', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A, isFieldRep: true });

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`,
        { full_name: 'Renamed Via Patch', is_attributable: true }, ownerAToken);

      assert.equal(res.status, 422, 'PATCH must refuse a body carrying is_attributable');

      const flags = await readFlags(pool, target);
      assert.equal(flags.is_attributable, false, 'PATCH must not write the rep flag');

      const { rows } = await pool.query('SELECT full_name FROM team_members WHERE id = $1', [target]);
      assert.notEqual(
        rows[0].full_name, 'Renamed Via Patch',
        'rejection must be whole-request — no partial write of the legal fields'
      );
    });

    it('PATCH still updates its own legal fields', async () => {
      const target = await seedTeamMember(pool, { contractorId: CID_A });
      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${target}`,
        { full_name: 'Legit Rename' }, ownerAToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.full_name, 'Legit Rename');
      assert.equal(
        'is_attributable' in res.body, false,
        'the orphaned rep flag must be gone from the PATCH RETURNING too'
      );
    });
  });

  // ══ GROUP 4 — reads carry the three flags (Step 7 verification) ═════════════
  // Expected GREEN from the outset: GET /api/admin/team already selects all three.
  // Pinned so a future edit to that SELECT cannot silently starve the drawer.
  describe('GET /api/admin/team exposes all three rep flags', () => {
    it('roster rows carry is_field_rep, is_attributable and rep_revenue_visibility', async () => {
      const target = await seedTeamMember(pool, {
        contractorId: CID_A, isFieldRep: true, isAttributable: true, repRevenueVisibility: true,
      });
      const res = await httpRequest(port, 'GET', '/api/admin/team', null, ownerAToken);

      assert.equal(res.status, 200);
      const row = res.body.find(m => m.id === target);
      assert.ok(row, 'seeded member must appear in the roster');
      assert.equal(row.is_field_rep, true);
      assert.equal(row.is_attributable, true);
      assert.equal(row.rep_revenue_visibility, true);
    });
  });

  // ══ GROUP 5 — MIGRATION PROOFS (CLAUDE.md binding rules) ════════════════════
  // Two rules apply to this migration and neither is satisfiable by a fresh-schema run:
  //
  //   1. DIRTY-DATA REPRODUCTION (Architecture Notes, ST session): the proof must seed
  //      production's ACTUAL pre-existing row shape. Production has genuinely held this
  //      shape — Known Issue 13, rep id 5, is_attributable=true with is_field_rep=false.
  //      A wiped-and-rebuilt test DB can never produce it on its own, and "the ADD
  //      succeeds against clean data" is precisely the proof that passed locally and
  //      took down the first ST deploy.
  //   2. IDEMPOTENCY: re-running initDB() must be a silent no-op, never a raise.
  //
  // Runs last and restores the constraint before finishing, so no earlier group is
  // affected by the temporary DROP.
  describe('migration: team_members_rep_coherence is defensive and idempotent', () => {
    const constraintExists = async () => {
      const { rows } = await pool.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'team_members_rep_coherence'`
      );
      return rows.length > 0;
    };

    it('a pre-existing violating row makes initDB() SKIP the ADD — it must never crash the boot', async () => {
      await pool.query('ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_rep_coherence');
      assert.equal(await constraintExists(), false, 'precondition: constraint dropped');

      // The Known Issue 13 shape, only insertable while the constraint is absent —
      // exactly how it came to exist in production before any endpoint guarded it.
      const drifted = await seedTeamMember(pool, { contractorId: CID_A, fullName: 'Drifted Rep' });
      await pool.query(
        'UPDATE team_members SET is_field_rep = false, is_attributable = true WHERE id = $1',
        [drifted]
      );

      // Capture console.error: the skip MUST be loud. A silent skip would leave the
      // constraint quietly unapplied in production with nothing in the log to say so —
      // the failure mode this whole defensive path exists to avoid.
      const originalError = console.error;
      const captured = [];
      console.error = (...args) => { captured.push(args.join(' ')); };
      try {
        await assert.doesNotReject(
          initDB(),
          'a drifted row must produce a warning and a skip — never an exception that aborts initDB()'
        );
      } finally {
        console.error = originalError;
      }

      assert.ok(
        captured.some(line => line.includes('REP COHERENCE CONSTRAINT NOT APPLIED')),
        `the skip must be logged loudly to the app log; captured instead: ${JSON.stringify(captured)}`
      );
      assert.equal(
        await constraintExists(), false,
        'the ADD must be skipped while a violating row exists, not attempted and thrown'
      );

      // The row is left untouched by the migration — it is the operator's to correct.
      const flags = await readFlags(pool, drifted);
      assert.deepEqual(flags, {
        is_field_rep: false, is_attributable: true, rep_revenue_visibility: false,
      }, 'the migration must not silently rewrite live data to make itself applicable');

      // Correct the data as an operator would, then the next boot adds the constraint.
      await pool.query('UPDATE team_members SET is_field_rep = true WHERE id = $1', [drifted]);
      await assert.doesNotReject(initDB());
      assert.equal(await constraintExists(), true, 'constraint must self-apply once the data is clean');
    });

    it('re-running initDB() with the constraint already present is a clean no-op (idempotency)', async () => {
      assert.equal(await constraintExists(), true, 'precondition: constraint present');
      await assert.doesNotReject(initDB(), 'second run');
      await assert.doesNotReject(initDB(), 'third run');
      assert.equal(await constraintExists(), true);

      // Still enforcing after the repeat runs — not dropped and left off.
      const id = await seedTeamMember(pool, { contractorId: CID_A });
      await expectPgError(
        () => pool.query('UPDATE team_members SET is_attributable = true WHERE id = $1', [id]),
        '23514',
        'constraint still live after repeated initDB() runs'
      );
    });
  });
});
