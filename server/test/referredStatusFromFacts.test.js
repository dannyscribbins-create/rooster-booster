'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 7b — THE REFERRER-VISIBLE STATUS COMES FROM SAVED FACTS
//
// `pipeline_cache.pipeline_status` is what a referrer reads on "My Referrals". Until this commit it
// was classified from the LIVE Jobber object by `syncSingleClient`, while the REP's view
// (`jobber_clients.pipeline_stage`) had already moved onto saved facts. Measured 2026-09-29:
// **6 of 15 shared clients disagreed**, and in two of them the referrer was shown the LOWER value.
//
// ⚠ AND THE UNDECIDABLE CASE IS THE HALF THAT NEEDED A RULING. A capture can fail, and on a
// brand-new referred client there is then no fact-derived status to write at all. Danny ruled
// (2026-09-29):
//   · EXISTING row + failed capture → `pipeline_status` and `paid_at` are LEFT ALONE. The referral
//     record is still refreshed; the status belongs to the derivation, which did not run.
//   · NEW row + failed capture → `'lead'`, the entry stage, plus `status_derived_at = NULL` as the
//     not-yet-derived marker. From `'lead'` the only way is forward.
//   · NEVER NULL for the status, and NEVER a live classify.
//
// ⚠ WHY NOT A LIVE-CLASSIFY FALLBACK, WHICH WAS THE OBVIOUS ALTERNATIVE AND WAS REJECTED: a
// TRANSIENT Jobber failure must never flip a referrer-visible stage BACKWARDS — the forward-only
// principle behind §2.1a. The live object is truncated by construction (`jobs(first: 50)`, an
// unpaged `invoices`), so classifying from it on the failure path could downgrade a `'paid'` client
// to `'sold'` because of one bad afternoon at Jobber. The fence in
// `server/test/oneStatusDerivation.test.js` stays strict with **no carve-out** for this path.
//
// ⚠ WHY NOT NULL: `STATUS_CONFIG` (`src/constants/theme.js`) has no null key and `StatusBadge` has
// no null guard, so an unmapped value THROWS rather than rendering. "Write NULL and let the surface
// decide" is not available.
//
// ⚠ NO CONVERSION IS WRITTEN BY 7b. The credit is 7d and it is blocked on 7c — the Job Type custom
// field is not captured, so `evaluateReferral` cannot be driven from facts at all yet.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET.
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { seedContractor } = require('./helpers');

const pipelineSync = require('../crm/pipelineSync');
const {
  syncSingleClient,
  _setPipelineSyncFetchForTest, _resetPipelineSyncFetch,
  _setPipelineSyncEmailsForTest, _resetPipelineSyncEmails,
  _setAttributionEngineForTest, _resetAttributionEngine,
} = pipelineSync;

const CID = 'referred-status-tenant';
const OTHER = 'referred-status-other';
const REFERRER = 'Facts Referrer';
const START = new Date('2026-01-01T00:00:00Z');

// Real Jobber EncodedIds — the derivation refuses a synthetic id (commit 2's predicate).
const gid = (name) => Buffer.from('gid://Jobber/Client/' + name, 'utf8').toString('base64');
const CLIENT = gid('rs-main');
const CLIENT_B = gid('rs-second');

let pool;

/** The shape `syncSingleClient` receives from a sync's own client query. */
const syncNode = (id) => ({
  id,
  firstName: 'Facts', lastName: 'Client',
  createdAt: new Date('2026-06-01T00:00:00Z').toISOString(),
  customFields: [{ label: 'Referred by', valueText: REFERRER }],
});

/**
 * A capture-shape client. `paidInvoices` is a list of { id, receivedDate } — each becomes a PAID
 * invoice linked to the single job, so the derivation reaches 'paid' through the job links exactly
 * as production does.
 */
const captureShape = (id, { paidInvoices = [], quoteStatus = null } = {}) => ({
  id,
  firstName: 'Facts', lastName: 'Client',
  createdAt: new Date('2026-06-01T00:00:00Z').toISOString(),
  emails: [], phones: [], tags: { nodes: [] },
  customFields: [{ label: 'Referred by', valueText: REFERRER }],
  quotes: {
    nodes: quoteStatus
      ? [{ id: `${id}-q`, quoteStatus, client: { id }, createdAt: new Date().toISOString(),
           lastTransitioned: { approvedAt: null }, salesperson: null }]
      : [],
  },
  jobs: { nodes: [{ id: `${id}-job`, jobStatus: 'active', client: { id }, invoices: { nodes: [] } }] },
  requests: { nodes: [] },
  invoices: {
    nodes: paidInvoices.map((inv) => ({
      id: inv.id, invoiceNumber: '1', invoiceStatus: 'paid', client: { id },
      amounts: { total: 1000, subtotal: 1000, invoiceBalance: 0, paymentsTotal: 1000,
        depositAmount: 0, discountAmount: 0, taxAmount: 0 },
      issuedDate: inv.receivedDate, dueDate: null, receivedDate: inv.receivedDate,
      createdAt: inv.receivedDate, updatedAt: inv.receivedDate,
      waitingForFinancedPayment: false,
      jobs: { nodes: [{ id: `${id}-job` }], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    })),
  },
});

const cacheRow = async (id, contractorId = CID) => {
  const { rows } = await pool.query(
    `SELECT pipeline_status, paid_at, status_derived_at, client_name, pre_start_date, last_synced_at
       FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, id]);
  return rows[0] || null;
};

// The tables every case here touches, cleared between cases.
// ⚠ THE 6c RESET-COVERAGE FENCE READS THIS LIST, so a table a new case writes must be added here.
// `client_sale_jobs` precedes `client_sales` because it carries an FK onto it.
const RESET_TABLES = ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
  'crm_quote_facts', 'crm_request_facts', 'client_sale_jobs', 'client_sales',
  'client_rep_assignments', 'flagged_assignments', 'flagged_referrals', 'referral_conversions',
  'pipeline_cache', 'jobber_clients', 'admin_messages', 'error_log'];

// ⚠ FILE-LEVEL, NOT PER describe, AND THIS FILE HAS TWO. initTestDb() returns the server/db.js
// pool SINGLETON, so a per-describe pool.end() would kill the pool the second describe is about
// to use — which surfaces as CANCELLED tests during setup, under a green-looking `fail 0`.
before(async () => {
  pool = await initTestDb();
  await seedContractor(pool, CID);
  await seedContractor(pool, OTHER);
  // LIVE-SEND GUARD — RESEND_API_KEY is active in the test env.
  _setPipelineSyncEmailsForTest({
    adminNotification: async () => {},
    email: async () => ({ data: null, error: null }),
  });
  // The engine is not this suite's subject; stub it so an attribution path cannot colour a result.
  _setAttributionEngineForTest(async () => {});
});

after(async () => {
  _resetPipelineSyncEmails();
  _resetAttributionEngine();
  _resetPipelineSyncFetch();
  await pool.end();
});

beforeEach(async () => {
  _resetPipelineSyncFetch();
  for (const t of RESET_TABLES) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1 OR contractor_id = $2`, [CID, OTHER]);
  }
});

describe('N4 commit 7b — the status is derived from saved facts', () => {
  it('a client whose facts carry a PAID invoice is stored paid, with the marker stamped', async () => {
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [{ id: `${id}-inv`, receivedDate: '2026-07-04T10:00:00Z' }],
    }));
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const row = await cacheRow(CLIENT);
    assert.ok(row, 'the referral record is written');
    assert.equal(row.pipeline_status, 'paid', 'derived from the saved facts');
    assert.ok(row.status_derived_at, 'and the marker records that it WAS derived');
  });

  it('paid_at is the invoice\'s OWN date, not the moment the sync ran', async () => {
    const received = '2026-07-04T10:00:00Z';
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [{ id: `${id}-inv`, receivedDate: received }],
    }));
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const row = await cacheRow(CLIENT);
    assert.equal(
      row.paid_at.toISOString(), new Date(received).toISOString(),
      'paid_at is the invoice date (ruling 4) — NOW() dated a payability by when a sync noticed it'
    );
  });

  it('paid_at is the EARLIEST paid invoice when several are paid', async () => {
    // ⚠ THE FIXTURE HAS THREE, DELIBERATELY OUT OF ORDER, so "earliest" cannot be satisfied by
    // taking the first or the last element of the list.
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [
        { id: `${id}-inv-mid`, receivedDate: '2026-07-15T00:00:00Z' },
        { id: `${id}-inv-early`, receivedDate: '2026-05-02T00:00:00Z' },
        { id: `${id}-inv-late`, receivedDate: '2026-09-20T00:00:00Z' },
      ],
    }));
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const row = await cacheRow(CLIENT);
    assert.equal(
      row.paid_at.toISOString(), new Date('2026-05-02T00:00:00Z').toISOString(),
      'the earliest — when the client FIRST became payable (Danny ruling, 2026-09-29)'
    );
  });

  it('another tenant\'s facts are never read', async () => {
    // The same client id under a different contractor, with a paid invoice there and none here.
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [{ id: `${id}-inv`, receivedDate: '2026-07-04T10:00:00Z' }],
    }));
    await syncSingleClient(OTHER, syncNode(CLIENT), START, [], 'tok');
    assert.equal((await cacheRow(CLIENT, OTHER)).pipeline_status, 'paid', 'precondition: paid THERE');

    // Now sync the same client for CID, whose capture has NO paid invoice.
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, { quoteStatus: 'awaiting_response' }));
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const row = await cacheRow(CLIENT, CID);
    assert.equal(row.pipeline_status, 'sold', 'this tenant has a job and no paid invoice of its own');
    assert.equal(row.paid_at, null, 'and no payable date borrowed from the other contractor');
  });
});

describe('N4 commit 7b — the undecidable case, as ruled', () => {
  const failingFetch = async () => { throw new Error('simulated capture failure'); };

  it('(i) an EXISTING paid row keeps its status and paid_at when the capture fails', async () => {
    const received = '2026-07-04T10:00:00Z';
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [{ id: `${id}-inv`, receivedDate: received }],
    }));
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');
    const before = await cacheRow(CLIENT);
    assert.equal(before.pipeline_status, 'paid', 'precondition: it is paid');
    assert.ok(before.paid_at, 'precondition: it has a payable date');

    _setPipelineSyncFetchForTest(failingFetch);
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const after = await cacheRow(CLIENT);
    assert.equal(after.pipeline_status, 'paid', 'a failed capture must NOT flip a stage backwards');
    assert.equal(
      after.paid_at.toISOString(), before.paid_at.toISOString(),
      'and must not move the payable date'
    );
    assert.equal(
      after.status_derived_at.toISOString(), before.status_derived_at.toISOString(),
      'the marker keeps its earlier value — the status is still derived, as of then'
    );
    // ⚠ PAIRED POSITIVE: the sync DID run and DID refresh the referral record. Without this, a
    // sync that crashed before touching the row would satisfy every assertion above.
    assert.ok(after.last_synced_at > before.last_synced_at, 'the referral record was still refreshed');
  });

  it('(ii) a NEW row with a failed capture gets lead plus the marker, never NULL', async () => {
    _setPipelineSyncFetchForTest(failingFetch);
    await syncSingleClient(CID, syncNode(CLIENT_B), START, [], 'tok');

    const row = await cacheRow(CLIENT_B);
    assert.ok(row, 'the referral record is still written — that is the sync\'s own job');
    assert.equal(row.pipeline_status, 'lead', 'the entry stage, which is simply true: a referral exists');
    assert.notEqual(row.pipeline_status, null, 'NEVER NULL — StatusBadge has no null guard');
    assert.equal(row.status_derived_at, null, 'with the not-yet-derived marker');
    assert.equal(row.paid_at, null, 'and no payable date');
    assert.equal(row.client_name, 'Facts Client', 'the identity columns ARE written');
  });

  it('(iv) the next successful capture clears the marker and derives the true stage', async () => {
    _setPipelineSyncFetchForTest(failingFetch);
    await syncSingleClient(CID, syncNode(CLIENT_B), START, [], 'tok');
    const stranded = await cacheRow(CLIENT_B);
    assert.equal(stranded.pipeline_status, 'lead', 'precondition: stranded at the entry stage');
    assert.equal(stranded.status_derived_at, null, 'precondition: marker set');

    _setPipelineSyncFetchForTest(async (id) => captureShape(id, {
      paidInvoices: [{ id: `${id}-inv`, receivedDate: '2026-08-08T00:00:00Z' }],
    }));
    await syncSingleClient(CID, syncNode(CLIENT_B), START, [], 'tok');

    const healed = await cacheRow(CLIENT_B);
    assert.equal(healed.pipeline_status, 'paid', 'the true stage, derived from facts');
    assert.ok(healed.status_derived_at, 'and the marker is cleared');
    assert.equal(
      healed.paid_at.toISOString(), new Date('2026-08-08T00:00:00Z').toISOString(),
      'with the invoice\'s own date'
    );
    // ⚠ AND IT MOVED FORWARD, WHICH IS WHY 'lead' IS THE SAFE PLACEHOLDER. From the lowest stage
    // the only direction available is up, so a failed capture can never have shown a referrer a
    // stage that later goes backwards.
    assert.notEqual(healed.pipeline_status, 'lead', 'lead was a floor, not a verdict');
  });

  it('a failed capture is recorded under its own source rather than swallowed', async () => {
    _setPipelineSyncFetchForTest(failingFetch);
    await syncSingleClient(CID, syncNode(CLIENT_B), START, [], 'tok');
    const { rows } = await pool.query(
      `SELECT source FROM error_log WHERE source = 'pipelineSync — capture'`);
    assert.ok(rows.length >= 1, 'an underived status must leave a record, or nobody can see it');
  });

  it('a non-derivable client id never reaches the derivation at all', async () => {
    // Danny ruling 9 / commit 2. An app_user placeholder has no facts by construction, so deriving
    // it would return 'lead' — the default wearing a derivation's clothes — and would overwrite the
    // 'app_user' status that is the only true thing known about it.
    const { deriveReferredStatus } = require('../utils/referredStatus');
    await assert.rejects(
      () => deriveReferredStatus(pool, { contractorId: CID, jobberClientId: 'app_user_7' }),
      /not a Jobber client id/
    );
  });
});
