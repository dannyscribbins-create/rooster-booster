'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { seedContractor } = require('./helpers');
const { runAttributionEngine } = require('../utils/attributionEngine');

// ── LOCAL SEED HELPERS ────────────────────────────────────────────────────────

async function seedCrmSettings(pool, { contractorId, attributionSource = 'assessment_assigned_users' }) {
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
     VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET attribution_source = $2`,
    [contractorId, attributionSource]
  );
}

// Returns the new team_member id.
async function seedTeamMember(pool, { contractorId, email, jobberUserId = null, isAttributable = false, fullName = 'Test Rep' }) {
  const { rows } = await pool.query(
    `INSERT INTO team_members
       (contractor_id, email, password_hash, tier, is_attributable, jobber_user_id, full_name)
     VALUES ($1, $2, 'hash', 'member', $3, $4, $5)
     RETURNING id`,
    [contractorId, email, isAttributable, jobberUserId, fullName]
  );
  return rows[0].id;
}

// Upserts a client_rep_assignments row with explicit field values.
async function seedAssignment(pool, {
  contractorId, jobberClientId,
  provisionalRepId = null, provisionalSource = null, provisionalSetAt = null,
  stickyRepId = null, stickySource = null, stickySetAt = null,
}) {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id,
        provisional_rep_id, provisional_source, provisional_set_at,
        sticky_rep_id, sticky_source, sticky_set_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       provisional_rep_id = EXCLUDED.provisional_rep_id,
       provisional_source = EXCLUDED.provisional_source,
       provisional_set_at = EXCLUDED.provisional_set_at,
       sticky_rep_id      = EXCLUDED.sticky_rep_id,
       sticky_source      = EXCLUDED.sticky_source,
       sticky_set_at      = EXCLUDED.sticky_set_at`,
    [contractorId, jobberClientId,
     provisionalRepId, provisionalSource, provisionalSetAt,
     stickyRepId, stickySource, stickySetAt]
  );
}

// Inserts a flagged_assignments row.
async function seedFlaggedAssignment(pool, { contractorId, jobberClientId, flagReason, reviewed = false }) {
  await pool.query(
    `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reviewed)
     VALUES ($1, $2, $3, $4)`,
    [contractorId, jobberClientId, flagReason, reviewed]
  );
}

// ── CLIENT + FETCHER FIXTURES ─────────────────────────────────────────────────

// Returns a minimal Jobber client object with the given quotes array.
function makeClient(quoteNodes = []) {
  return {
    id: CLIENT_ID,
    quotes: { nodes: quoteNodes },
    jobs: { nodes: [] },
    customFields: [],
  };
}

// Returns a quote node for the sticky gate.
// quoteStatus defaults to 'converted' — real Jobber data (confirmed via GraphiQL against a
// production client) shows a quote that produced a job reads 'converted', not 'approved'.
// The old fixture default of 'approved' encoded the bug this suite now guards against.
// salespersonId: Jobber user id string (or null for no salesperson).
// lastTransitioned: object { approvedAt } matching Jobber GraphQL shape (NOT a scalar string).
function makeApprovedQuote({
  id = 'q-1',
  salespersonId = null,
  quoteStatus = 'converted',
  lastTransitioned = { approvedAt: '2026-05-01T00:00:00Z' },
} = {}) {
  return {
    id,
    quoteStatus,
    salesperson: salespersonId ? { id: salespersonId } : null,
    lastTransitioned,
  };
}

// Mode A fetcher — returns a request (with createdAt) wrapping an assessment with the given
// assigned user IDs. requestCreatedAt matters now: the anchor/grace filter operates on the
// REQUEST's createdAt, not on the assessment (assessments have no timestamp of their own).
function modeAFetcher(assignedUserIds = [], assessmentId = 'assess-1', requestCreatedAt = '2026-05-01T00:00:00Z') {
  const assessment = { id: assessmentId, assignedUsers: { nodes: assignedUserIds.map(id => ({ id })) } };
  return async () => ({
    assessments: [assessment],
    requests: [{ id: 'req-1', createdAt: requestCreatedAt, salesperson: null, assessment }],
  });
}

// Mode B fetcher — returns a request with the given salesperson Jobber user ID (or null).
function modeBFetcher(salespersonJobberUserId = null, requestCreatedAt = '2026-05-01T00:00:00Z') {
  return async () => ({
    assessments: [],
    requests: [{ id: 'req-1', createdAt: requestCreatedAt, salesperson: salespersonJobberUserId ? { id: salespersonJobberUserId } : null }],
  });
}

// Fetcher that returns no actionable data.
const emptyFetcher = async () => ({ assessments: [], requests: [] });

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const CID       = 'accent-roofing';
const CLIENT_ID = 'jc-attr-001';

// Referral anchor for tests that aren't specifically exercising anchor/grace edge cases.
// Set well before every fixture quote/request timestamp above (2026-04-01 onward) so those
// fixtures are unambiguously "post-referral" regardless of the grace window.
const DEFAULT_ANCHOR = new Date('2026-01-01T00:00:00Z');

// ── TEST SUITE ────────────────────────────────────────────────────────────────

describe('runAttributionEngine — provisional assignment engine + sticky gate', () => {
  let pool, repId, rep2Id;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean in FK-safe order: assignments and flags before team_members.
    await pool.query('DELETE FROM flagged_assignments');
    await pool.query('DELETE FROM client_rep_assignments');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    // Remove any extra contractors added by the scoping test ($1 = CID, never deleted).
    await pool.query('DELETE FROM contractors WHERE id != $1', [CID]);

    await seedContractor(pool, CID);
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'assessment_assigned_users' });

    // Standard reps for most tests:
    //   repId  — jobber-user-A, IS attributable
    //   rep2Id — jobber-user-B, NOT attributable
    repId  = await seedTeamMember(pool, { contractorId: CID, email: 'rep-alpha@attr-test.com', jobberUserId: 'jobber-user-A', isAttributable: true,  fullName: 'Rep Alpha' });
    rep2Id = await seedTeamMember(pool, { contractorId: CID, email: 'rep-beta@attr-test.com',  jobberUserId: 'jobber-user-B', isAttributable: false, fullName: 'Rep Beta (non-attributable)' });
  });

  // ── MODE A: ASSESSMENT ASSIGNED USERS ────────────────────────────────────────

  it('Mode A: no assessments returned → benign skip, no row written', async () => {
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'no assignment row for zero-assessment case');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(flags.length, 0, 'no flag written for zero-assessment case');
  });

  it('Mode A: non-attributable users only → zero matches → no provisional, no flag', async () => {
    const fetcher = modeAFetcher(['jobber-user-B']); // rep2Id is NOT attributable
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'non-attributable user must not create a row');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(flags.length, 0, 'no flag for zero attributable matches');
  });

  it('Mode A: one attributable + one non-attributable → exactly one match → provisional set, no flag', async () => {
    const fetcher = modeAFetcher(['jobber-user-A', 'jobber-user-B']); // only A is attributable
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 1, 'one assignment row for one attributable match');
    assert.equal(rows[0].provisional_rep_id, repId, 'provisional set to the attributable rep');
    assert.equal(rows[0].provisional_source, 'mode_a');
    assert.ok(rows[0].provisional_set_at, 'provisional_set_at must be set');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(flags.length, 0, 'no co-assignment flag for exactly one attributable match');
  });

  it('Mode A: exactly one attributable match → provisional set (mode_a)', async () => {
    const fetcher = modeAFetcher(['jobber-user-A']); // repId IS attributable
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 1, 'one assignment row');
    assert.equal(rows[0].provisional_rep_id, repId);
    assert.equal(rows[0].provisional_source, 'mode_a');
    assert.ok(rows[0].provisional_set_at);
    assert.equal(rows[0].sticky_rep_id, null, 'sticky must not be set at lead status');
  });

  it('Mode A: two+ attributable matches → flagged_assignments (rep_co_assignment), no provisional', async () => {
    const rep3Id = await seedTeamMember(pool, { contractorId: CID, email: 'rep-gamma@attr-test.com', jobberUserId: 'jobber-user-C', isAttributable: true, fullName: 'Rep Gamma' });
    const fetcher = modeAFetcher(['jobber-user-A', 'jobber-user-C'], 'assess-co');
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows: assignments } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(assignments.length, 0, 'no provisional row for co-assignment');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'rep_co_assignment']
    );
    assert.equal(flags.length, 1, 'one rep_co_assignment flag written');
    assert.equal(flags[0].triggering_assessment_id, 'assess-co');
    assert.ok(Array.isArray(flags[0].reps_involved), 'reps_involved is an array');
    assert.equal(flags[0].reps_involved.length, 2, 'both attributable reps listed in reps_involved');
  });

  it('Mode A: duplicate flag suppression — existing unreviewed rep_co_assignment → no second flag', async () => {
    await seedFlaggedAssignment(pool, { contractorId: CID, jobberClientId: CLIENT_ID, flagReason: 'rep_co_assignment', reviewed: false });
    await seedTeamMember(pool, { contractorId: CID, email: 'rep-gamma@attr-test.com', jobberUserId: 'jobber-user-C', isAttributable: true, fullName: 'Rep Gamma' });
    const fetcher = modeAFetcher(['jobber-user-A', 'jobber-user-C'], 'assess-co2');
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'rep_co_assignment']
    );
    assert.equal(flags.length, 1, 'must not duplicate an existing unreviewed rep_co_assignment flag');
  });

  // ── MODE B: REQUEST SALESPERSON ───────────────────────────────────────────────

  it('Mode B: attributable salesperson match → provisional set (mode_b)', async () => {
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'request_salesperson' });
    const fetcher = modeBFetcher('jobber-user-A'); // repId is attributable
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].provisional_rep_id, repId);
    assert.equal(rows[0].provisional_source, 'mode_b');
    assert.ok(rows[0].provisional_set_at);
  });

  it('Mode B: null salesperson → do nothing', async () => {
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'request_salesperson' });
    const fetcher = modeBFetcher(null);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'no row for null salesperson');
  });

  it('Mode B: non-attributable salesperson → do nothing', async () => {
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'request_salesperson' });
    const fetcher = modeBFetcher('jobber-user-B'); // rep2Id is NOT attributable
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'non-attributable salesperson must not set provisional');
  });

  it('Mode B: engine invokes the injected fetchAttributionData with correct arguments', async () => {
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'request_salesperson' });
    let fetcherCalledWith = null;
    const trackingFetcher = async (clientId, token) => {
      fetcherCalledWith = { clientId, token };
      return { assessments: [], requests: [] };
    };
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: trackingFetcher, token: 'test-token', referralAnchor: DEFAULT_ANCHOR,
    });
    assert.ok(fetcherCalledWith !== null, 'fetchAttributionData must be called');
    assert.equal(fetcherCalledWith.clientId, CLIENT_ID, 'fetcher receives jobberClientId');
    assert.equal(fetcherCalledWith.token, 'test-token', 'fetcher receives token');
  });

  // ── PRECEDENCE PROTECTION ─────────────────────────────────────────────────────

  it('qr_link precedence: existing qr_link provisional must NOT be overwritten by mode_a', async () => {
    const qrRepId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-qr@attr-test.com', jobberUserId: 'jobber-user-QR', isAttributable: true, fullName: 'QR Rep' });
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      provisionalRepId: qrRepId, provisionalSource: 'qr_link', provisionalSetAt: new Date(),
    });
    const fetcher = modeAFetcher(['jobber-user-A']); // would normally match repId
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].provisional_rep_id, qrRepId, 'qr_link provisional must be preserved against mode_a');
    assert.equal(rows[0].provisional_source, 'qr_link');
  });

  it('qr_link precedence: existing qr_link provisional must NOT be overwritten by mode_b', async () => {
    await seedCrmSettings(pool, { contractorId: CID, attributionSource: 'request_salesperson' });
    const qrRepId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-qr@attr-test.com', jobberUserId: 'jobber-user-QR', isAttributable: true, fullName: 'QR Rep' });
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      provisionalRepId: qrRepId, provisionalSource: 'qr_link', provisionalSetAt: new Date(),
    });
    const fetcher = modeBFetcher('jobber-user-A'); // would normally match repId
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].provisional_rep_id, qrRepId, 'qr_link provisional must be preserved against mode_b');
    assert.equal(rows[0].provisional_source, 'qr_link');
  });

  it('sticky present: engine makes NO changes — provisional not set, sticky not touched', async () => {
    const stickyRepId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-sticky@attr-test.com', jobberUserId: 'jobber-user-STICKY', isAttributable: true, fullName: 'Sticky Rep' });
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      stickyRepId, stickySource: 'quote_salesperson', stickySetAt: new Date(),
    });
    const fetcher = modeAFetcher(['jobber-user-A']); // would normally match repId
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client: makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]),
      fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, stickyRepId, 'sticky_rep_id must not change');
    assert.equal(rows[0].sticky_source, 'quote_salesperson', 'sticky_source must not change');
    assert.equal(rows[0].provisional_rep_id, null, 'provisional must remain null when sticky is set');
  });

  // ── STICKY GATE ───────────────────────────────────────────────────────────────

  it('sticky gate at sold: attributable quote salesperson wins over a different provisional', async () => {
    const provRepId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-prov@attr-test.com', jobberUserId: 'jobber-user-PROV', isAttributable: true, fullName: 'Prov Rep' });
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      provisionalRepId: provRepId, provisionalSource: 'mode_a', provisionalSetAt: new Date(),
    });
    // repId (jobber-user-A) is the quote salesperson — different from the provisional
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, repId, 'quote salesperson (repId) wins over different provisional');
    assert.equal(rows[0].sticky_source, 'quote_salesperson');
    assert.ok(rows[0].sticky_set_at, 'sticky_set_at must be set');
  });

  it('sticky gate fires at paid (null sticky on first encounter — skipped-stages case)', async () => {
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'paid',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'gate fires for paid status with no prior sticky');
    assert.equal(rows[0]?.sticky_source, 'quote_salesperson');
  });

  it('sticky gate does NOT fire for lead status', async () => {
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'sticky must not be set at lead');
  });

  it('sticky gate does NOT fire for inspection status', async () => {
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'inspection',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'sticky must not be set at inspection');
  });

  it('sticky gate does NOT fire for not_sold status', async () => {
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'not_sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'sticky must not be set at not_sold');
  });

  it('sticky gate fires for unknown status (exclusion-list fails open toward attribution)', async () => {
    // 'pending_completion_whatever' is not in the exclusion list — gate must fire
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'pending_completion_whatever',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'unknown status must trigger gate (fail-open)');
  });

  it('sticky gate: promote provisional when quote salesperson is non-attributable', async () => {
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      provisionalRepId: repId, provisionalSource: 'mode_a', provisionalSetAt: new Date(),
    });
    // jobber-user-B is NOT attributable
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-B' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, repId, 'provisional promoted to sticky');
    assert.equal(rows[0].sticky_source, 'promoted_provisional');
  });

  it('sticky gate: promote provisional when quote has no salesperson', async () => {
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      provisionalRepId: repId, provisionalSource: 'mode_b', provisionalSetAt: new Date(),
    });
    const client = makeClient([makeApprovedQuote({ salespersonId: null })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, repId, 'provisional promoted when salesperson absent');
    assert.equal(rows[0].sticky_source, 'promoted_provisional');
  });

  it('sticky gate: orphan flag when no attributable salesperson AND no provisional AND no Mode A match', async () => {
    // No assignment row exists, salesperson is non-attributable, and the assessment fetch
    // (emptyFetcher) yields nothing either — only then must the gate orphan.
    const client = makeClient([makeApprovedQuote({ id: 'q-orphan', salespersonId: 'jobber-user-B' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'orphan flag written');
    assert.equal(flags[0].triggering_quote_id, 'q-orphan');
    const { rows: assignments } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(assignments[0]?.sticky_rep_id ?? null, null, 'sticky remains null for orphan case');
  });

  it('sticky gate: duplicate orphan flag suppression — existing unreviewed orphan → no second flag', async () => {
    await seedFlaggedAssignment(pool, { contractorId: CID, jobberClientId: CLIENT_ID, flagReason: 'orphan', reviewed: false });
    const client = makeClient([makeApprovedQuote({ id: 'q-orphan2', salespersonId: 'jobber-user-B' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'must not duplicate an existing unreviewed orphan flag');
  });

  it('sticky gate: multi-quote tiebreak — most recently lastTransitioned wins', async () => {
    const rep3Id = await seedTeamMember(pool, { contractorId: CID, email: 'rep-gamma@attr-test.com', jobberUserId: 'jobber-user-C', isAttributable: true, fullName: 'Rep Gamma' });
    const client = makeClient([
      makeApprovedQuote({ id: 'q-old', salespersonId: 'jobber-user-A', lastTransitioned: { approvedAt: '2026-04-01T00:00:00Z' } }),
      makeApprovedQuote({ id: 'q-new', salespersonId: 'jobber-user-C', lastTransitioned: { approvedAt: '2026-06-01T00:00:00Z' } }),
    ]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, rep3Id, 'most recently transitioned quote salesperson (rep3Id/C) wins');
    assert.equal(rows[0].sticky_source, 'quote_salesperson');
  });

  it('sticky never overwritten — re-running engine on same client leaves sticky unchanged', async () => {
    const alreadyStickyRepId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-already@attr-test.com', jobberUserId: 'jobber-user-ALREADY', isAttributable: true, fullName: 'Already Sticky Rep' });
    await seedAssignment(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID,
      stickyRepId: alreadyStickyRepId, stickySource: 'promoted_provisional', stickySetAt: new Date(),
      provisionalRepId: repId, provisionalSource: 'mode_a', provisionalSetAt: new Date(),
    });
    // Re-run engine with a different quote salesperson — sticky must not change
    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'paid',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0].sticky_rep_id, alreadyStickyRepId, 'sticky_rep_id unchanged after re-run');
    assert.equal(rows[0].sticky_source, 'promoted_provisional', 'sticky_source unchanged after re-run');
  });

  // ── CONTRACTOR SCOPING ────────────────────────────────────────────────────────

  it('contractor scoping: engine reads settings and writes assignments only for the given contractorId', async () => {
    // seedContractor handles both contractors (id/name) and contractor_settings rows.
    await seedContractor(pool, 'contractor-b');
    await seedCrmSettings(pool, { contractorId: 'contractor-b', attributionSource: 'assessment_assigned_users' });
    // jobber_user_id is UNIQUE across the whole team_members table — contractor-b must use its own.
    const repBId = await seedTeamMember(pool, { contractorId: 'contractor-b', email: 'rep-d@attr-test.com', jobberUserId: 'jobber-user-D', isAttributable: true, fullName: 'Contractor B Rep' });

    // Pre-seed a contractor-b assignment for the same client — must remain untouched.
    await seedAssignment(pool, {
      contractorId: 'contractor-b', jobberClientId: CLIENT_ID,
      provisionalRepId: repBId, provisionalSource: 'mode_a', provisionalSetAt: new Date(),
    });

    // Run engine for contractor-a — assessment has 'jobber-user-A' (repId, contractor-a only).
    const fetcher = modeAFetcher(['jobber-user-A']);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });

    // contractor-a should have its provisional set.
    const { rows: aRows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(aRows.length, 1, 'contractor-a assignment written');
    assert.equal(aRows[0].provisional_rep_id, repId, 'contractor-a provisional is repId (not repBId)');

    // contractor-b row must be unchanged.
    const { rows: bRows } = await pool.query(
      `SELECT * FROM client_rep_assignments WHERE contractor_id='contractor-b' AND jobber_client_id=$1`,
      [CLIENT_ID]
    );
    assert.equal(bRows[0].provisional_rep_id, repBId, 'contractor-b row must not be touched');
  });

  // ── MISSING FETCHER GUARD ─────────────────────────────────────────────────────

  // Proves the provisional skip at a pre-gate status (lead).
  // A separate test below verifies the sticky gate still fires when the fetcher is missing.
  it('missing fetchAttributionData: logError called once, provisional skipped, no DB writes at pre-gate status', async () => {
    const errors = [];
    const mockLogError = async (params) => { errors.push(params); };

    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: undefined, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      logError: mockLogError,
    });

    assert.equal(errors.length, 1, 'logError must be called exactly once');
    assert.ok(errors[0].error instanceof Error, 'logError receives { error: Error instance }');
    assert.ok(typeof errors[0].source === 'string' && errors[0].source.length > 0, 'logError receives { source: string }');

    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'no DB writes when fetcher is missing at pre-gate status');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(flags.length, 0, 'no flag writes when fetcher is missing at pre-gate status');
  });

  // Missing fetcher skips the provisional/fallthrough step only; the sticky gate's quote
  // check still fires because it reads quote data from the client object, not the fetcher.
  it('missing fetchAttributionData at gate: logError called once AND sticky still set from client quotes', async () => {
    const errors = [];
    const mockLogError = async (params) => { errors.push(params); };

    const client = makeClient([makeApprovedQuote({ salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: undefined, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      logError: mockLogError,
    });

    assert.equal(errors.length, 1, 'logError called exactly once (for missing fetcher on provisional step)');
    assert.ok(errors[0].error instanceof Error, 'logError receives { error: Error instance }');

    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'sticky set from quote salesperson despite missing fetcher');
    assert.equal(rows[0]?.sticky_source, 'quote_salesperson');
  });

  // Missing fetcher at gate, WITHOUT a quote match or provisional to fall back on — must
  // orphan directly (cannot fall through to Mode A, since the fetcher that would run it
  // is exactly what's missing).
  it('missing fetchAttributionData at gate with no quote/provisional match: orphans directly, no crash', async () => {
    const errors = [];
    const mockLogError = async (params) => { errors.push(params); };

    const client = makeClient([makeApprovedQuote({ id: 'q-nofetcher', salespersonId: 'jobber-user-B' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: undefined, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
      logError: mockLogError,
    });

    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'orphans directly when fetcher is missing and no quote/provisional resolves it');
  });

  // ── ANCHOR / GRACE WINDOW (temporal scoping fix) ──────────────────────────────

  it('PRIMARY: pre-existing converted quote (ancient, null salesperson) + pre-existing jobs + new request BEFORE anchor within grace, assessment matches attributable rep → sticky via mode_a_at_close, not orphan', async () => {
    // Models the real Session flagged row: shared/returning-customer client with a 2024
    // converted quote (null salesperson) and pre-existing jobs (making status 'sold'), plus
    // a brand-new 2026 request whose assessment names the attributable rep. The request was
    // created several hours BEFORE the anchor — anchor = detection time (first sync to see
    // the client as referred), which lagged the real referral due to a 2-day sync outage.
    const anchor = new Date('2026-07-03T18:30:00Z'); // first sync saw the client (post-outage)
    const requestCreatedAt = '2026-07-03T00:33:40Z'; // ~18h BEFORE anchor — within 7-day grace

    const ancientQuote = makeApprovedQuote({
      id: 'q-2024', salespersonId: null, quoteStatus: 'converted',
      lastTransitioned: { approvedAt: '2024-07-24T16:48:46Z' },
    });
    const client = makeClient([ancientQuote]);
    const fetcher = modeAFetcher(['jobber-user-A'], 'assess-real', requestCreatedAt);

    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: fetcher, token: 'tok', referralAnchor: anchor,
    });

    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'anchor-lag request must still win attribution via Mode A fallthrough');
    assert.equal(rows[0]?.sticky_source, 'mode_a_at_close', 'sticky written directly from the gate fallthrough, not left provisional');

    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 0, 'must NOT orphan — this is exactly the bug being fixed');
  });

  it('post-referral quote approved then archived: excluded from quote-salesperson matching even though salesperson is attributable and approvedAt is post-anchor', async () => {
    const client = makeClient([
      makeApprovedQuote({
        id: 'q-archived', salespersonId: 'jobber-user-A', quoteStatus: 'archived',
        lastTransitioned: { approvedAt: '2026-05-01T00:00:00Z' },
      }),
    ]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'archived quote must never produce a quote_salesperson sticky');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'falls through to orphan since archived quote is fully ignored and no Mode A match exists');
  });

  it('null-salesperson eligible quote + no provisional → falls through to Mode A, sticky via mode_a_at_close', async () => {
    const client = makeClient([
      makeApprovedQuote({ id: 'q-nosales', salespersonId: null, quoteStatus: 'converted' }),
    ]);
    const fetcher = modeAFetcher(['jobber-user-A']);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: fetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'Mode A fallthrough resolves the null-salesperson-quote case');
    assert.equal(rows[0]?.sticky_source, 'mode_a_at_close');
  });

  it('null/missing referralAnchor: fails closed — quote is NOT treated as eligible, never reverts to old unscoped behavior', async () => {
    const client = makeClient([makeApprovedQuote({ id: 'q-noanchor', salespersonId: 'jobber-user-A' })]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: null,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'no sticky written when anchor is missing — fail closed, not fail open');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'missing anchor with no other resolution path ends in orphan, not a silent unscoped match');
  });

  it('two-quote tiebreak: archived quote has the latest approvedAt but must lose to the still-valid earlier quote', async () => {
    const client = makeClient([
      makeApprovedQuote({
        id: 'q-archived-latest', salespersonId: 'jobber-user-A', quoteStatus: 'archived',
        lastTransitioned: { approvedAt: '2026-06-01T00:00:00Z' },
      }),
      makeApprovedQuote({
        id: 'q-valid-earlier', salespersonId: 'jobber-user-B', quoteStatus: 'converted',
        lastTransitioned: { approvedAt: '2026-04-01T00:00:00Z' },
      }),
    ]);
    // jobber-user-B (rep2Id) is NOT attributable in this suite's default seed. Asserting
    // "no sticky" here proves the *valid earlier* quote (jobber-user-B) was the one
    // considered — if the archived-but-later quote had wrongly won, sticky would be repId.
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: DEFAULT_ANCHOR,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'archived quote (jobber-user-A, attributable) must not win despite later approvedAt');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'valid earlier quote (jobber-user-B, non-attributable) was the one considered, and it does not match — orphans');
  });

  it('ancient quote (2 years pre-anchor) excluded even with the grace window applied', async () => {
    const client = makeClient([
      makeApprovedQuote({
        id: 'q-ancient', salespersonId: 'jobber-user-A', quoteStatus: 'converted',
        lastTransitioned: { approvedAt: '2024-07-24T16:48:46Z' },
      }),
    ]);
    const anchor = new Date('2026-05-15T00:00:00Z');
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: anchor,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id ?? null, null, 'a 2-year-old quote must never be eligible, 7-day grace or not');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'orphan']
    );
    assert.equal(flags.length, 1, 'ancient quote ignored, no Mode A match, falls to orphan');
  });

  it('quote-side grace: approvedAt a few hours BEFORE the anchor, within grace, still eligible for quote_salesperson', async () => {
    const anchor = new Date('2026-07-03T18:30:00Z');
    const client = makeClient([
      makeApprovedQuote({
        id: 'q-in-grace', salespersonId: 'jobber-user-A', quoteStatus: 'converted',
        lastTransitioned: { approvedAt: '2026-07-03T12:00:00Z' }, // ~6.5h before anchor, within 7-day grace
      }),
    ]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: emptyFetcher, token: 'tok', referralAnchor: anchor,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'quote approved shortly before anchor, within grace, must still win via quote_salesperson');
    assert.equal(rows[0]?.sticky_source, 'quote_salesperson');
  });

  it('Mode A anchor filtering (pre-gate, step 6): an ancient request with an assessment must NOT set a provisional when the only in-grace request has no assessment', async () => {
    // Uses a PRE-GATE status ('lead') deliberately — this exercises the EXISTING step-6
    // provisional path (which already calls fetchAttributionData today), isolating whether
    // Mode A's own selection needs anchor filtering, independent of the new gate-fallthrough
    // mechanism. Without the anchor filter, the ancient (2024) request's assessment is the
    // only assessment available and would wrongly set a provisional today.
    const anchor = new Date('2026-07-03T18:30:00Z');
    const oldAssessment = { id: 'assess-old', assignedUsers: { nodes: [{ id: 'jobber-user-A' }] } };
    const fetcher = async () => ({
      assessments: [oldAssessment],
      requests: [
        { id: 'req-in-grace', createdAt: '2026-07-03T00:33:40Z', salesperson: null, assessment: null },
        { id: 'req-ancient', createdAt: '2024-01-01T00:00:00Z', salesperson: null, assessment: oldAssessment },
      ],
    });
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'lead',
      client: makeClient(), fetchAttributionData: fetcher, token: 'tok', referralAnchor: anchor,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows.length, 0, 'the ancient assessment must be excluded by the anchor filter — no provisional written, even though the fetcher returns a matching assessment');
  });

  it('Mode A anchor filtering: pre-anchor and in-grace requests name different attributable reps — only the in-grace one counts, never co-assignment', async () => {
    const repXId = await seedTeamMember(pool, { contractorId: CID, email: 'rep-x@attr-test.com', jobberUserId: 'jobber-user-X', isAttributable: true, fullName: 'Rep X (pre-anchor — must be excluded)' });
    const anchor = new Date('2026-07-03T18:30:00Z');
    const oldAssessment = { id: 'assess-old-x', assignedUsers: { nodes: [{ id: 'jobber-user-X' }] } };
    const newAssessment = { id: 'assess-new-a', assignedUsers: { nodes: [{ id: 'jobber-user-A' }] } };
    const fetcher = async () => ({
      assessments: [newAssessment, oldAssessment],
      requests: [
        { id: 'req-in-grace', createdAt: '2026-07-03T00:33:40Z', salesperson: null, assessment: newAssessment },
        { id: 'req-ancient', createdAt: '2024-01-01T00:00:00Z', salesperson: null, assessment: oldAssessment },
      ],
    });
    const client = makeClient([]);
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: CLIENT_ID, currentStatus: 'sold',
      client, fetchAttributionData: fetcher, token: 'tok', referralAnchor: anchor,
    });
    const { rows } = await pool.query(
      'SELECT * FROM client_rep_assignments WHERE contractor_id=$1 AND jobber_client_id=$2',
      [CID, CLIENT_ID]
    );
    assert.equal(rows[0]?.sticky_rep_id, repId, 'only the in-grace request (rep A) counts — the excluded pre-anchor rep (X) must never win');
    assert.equal(rows[0]?.sticky_source, 'mode_a_at_close');
    const { rows: flags } = await pool.query(
      'SELECT * FROM flagged_assignments WHERE contractor_id=$1 AND jobber_client_id=$2 AND flag_reason=$3',
      [CID, CLIENT_ID, 'rep_co_assignment']
    );
    assert.equal(flags.length, 0, 'anchor filtering happens before match-counting — the excluded pre-anchor rep must not trigger co-assignment');
    void repXId;
  });
});
