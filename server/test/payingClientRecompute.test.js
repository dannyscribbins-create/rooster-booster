'use strict';

// ── paying_client IS RECOMPUTED, NOT ACCUMULATED (3d Phase 1a Commit 4b) ─────
//
// Danny's ruling: paying_client must reflect the truth TODAY — ADDED when isInvoicePaid() holds
// for some invoice and REMOVED when none does, exactly as value:* already worked via
// replaceTagGroup.
//
// ⚠ THE DEFECT THIS CLOSES IS NOT "A MISSING FEATURE", IT IS AN ASYMMETRY 4a MADE VISIBLE.
// Before 4a a status-only rule marked a $0 or unsettled invoice as paid. 4a tightened the
// definition, which means clients already carry a paying_client the app no longer stands behind —
// and an upsert-only tag has no way to say so. Campaign audiences read this tag, so the stale
// marker mails people RoofMiles does not consider paying.
//
// ⚠ EVERY CASE HERE DRIVES THE REAL deriveAndSaveTags AGAINST THE REAL DATABASE. A source scan
// can prove the else-branch exists; only this can prove the row leaves the table.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const deriveAndSaveTags = require('../utils/deriveJobberTags');

const T     = 'payrc-a';
const OTHER = 'payrc-b';
const CID   = 'payrc-client-1';

// ⚠ THE FLATTENED SHAPE, NOT THE CONNECTION SHAPE — CLAUDE.md vacuity shape #12.
// deriveAndSaveTags' callers flatten (`jobs: nodes.map(j => ({ ...j, invoices: j.invoices.nodes }))`)
// while classifyPipelineStatus takes the connection shape. Hand this one { nodes: [] } and its
// .filter() throws into deriveAndSaveTags' own SWALLOWING catch: the tag block never runs, and the
// only symptom is a positive case failing with nothing in error_log.
const client = (invoices) => ({
  isCompany: false, isLead: false, tags: { nodes: [] }, customFields: [],
  quotes: [], requests: [],
  jobs: [{
    id: 'payrc-job-1', jobStatus: 'active', jobType: 'ONE_OFF',
    completedAt: null, createdAt: '2026-09-01T00:00:00.000Z',
    customFields: [], invoices,
  }],
  invoices: [],
});

const invoice = (over = {}) => ({
  id: 'payrc-inv-1', invoiceStatus: 'paid', createdAt: '2026-09-01T00:00:00.000Z',
  amounts: { total: 900, invoiceBalance: 0 }, ...over,
});

describe('paying_client — added when a paid invoice exists, REMOVED when none does', () => {

  let pool;

  const tagsOf = async (contractorId = T) => (await pool.query(
    `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2 ORDER BY tag`,
    [contractorId, CID])).rows.map((r) => r.tag);

  before(async () => { pool = await initTestDb(); });
  after(async () => { await pool.end(); });

  beforeEach(async () => {
    for (const c of [T, OTHER]) {
      await pool.query(`DELETE FROM contact_tags WHERE contractor_id = $1`, [c]);
      await pool.query(`DELETE FROM jobber_clients WHERE contractor_id = $1`, [c]);
      await pool.query(`DELETE FROM contractors WHERE id = $1`, [c]);
      await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [c]);
      await pool.query(
        `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
         VALUES ($1, $2, 'Payrc', NOW())`, [CID, c]);
    }
  });

  // ── THE PAIRED POSITIVE, FIRST, BECAUSE EVERY REMOVAL CASE BELOW DEPENDS ON IT ────────────
  // Danny's guard-proof (ii): removal must not be over-eager. Without this case a bug that
  // removed the tag unconditionally — or a fixture shape that made tagging not run at all —
  // would satisfy every negative assertion in the file.
  it('PAIRED POSITIVE — a settled invoice with a real total GETS paying_client', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    assert.ok((await tagsOf()).includes('paying_client'),
      'if this fails, every removal case below is passing against tagging that never ran');
  });

  it('PAIRED POSITIVE — a second derivation on the SAME paid invoice KEEPS it', async () => {
    // ⚠ THE RECOMPUTE MUST NOT REMOVE WHAT IT IS ABOUT TO WRITE. An else-branch placed above the
    // upsert, or a removal outside the conditional, passes the first case and fails here.
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    assert.ok((await tagsOf()).includes('paying_client'));
  });

  it('PAIRED POSITIVE — one truly paid invoice beside an unpaid one KEEPS it', async () => {
    // Danny's guard-proof (ii) in its sharpest form: the client HAS a disqualifying invoice, and
    // the tag must survive anyway, because the rule is "some invoice", never "every invoice".
    await deriveAndSaveTags(pool, T, CID, client([
      invoice(),
      invoice({ id: 'payrc-inv-2', amounts: { total: 1200, invoiceBalance: 400 } }),
    ]));
    assert.ok((await tagsOf()).includes('paying_client'),
      'a single settled invoice is enough — a removal that reads "all invoices" is wrong');
  });

  // ── THE REMOVALS — each is a state that USED to keep the tag forever ──────────────────────
  it('REMOVED when the only paid invoice drops to a $0 total', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    assert.ok((await tagsOf()).includes('paying_client'), 'precondition: the tag is there to remove');

    await deriveAndSaveTags(pool, T, CID, client([invoice({ amounts: { total: 0, invoiceBalance: 0 } })]));
    assert.ok(!(await tagsOf()).includes('paying_client'),
      'zero-value work must not leave a client marked as paying');
  });

  it('REMOVED when the only paid invoice becomes unsettled', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    assert.ok((await tagsOf()).includes('paying_client'), 'precondition: the tag is there to remove');

    await deriveAndSaveTags(pool, T, CID, client([invoice({ amounts: { total: 900, invoiceBalance: 250 } })]));
    assert.ok(!(await tagsOf()).includes('paying_client'),
      'a non-zero balance is not a paid invoice, so the marker must go');
  });

  it('REMOVED when the only invoice is voided', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    await deriveAndSaveTags(pool, T, CID, client([invoice({ invoiceStatus: 'voided' })]));
    assert.ok(!(await tagsOf()).includes('paying_client'));
  });

  it('REMOVED when the invoice disappears from the client entirely', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    await deriveAndSaveTags(pool, T, CID, client([]));
    assert.ok(!(await tagsOf()).includes('paying_client'),
      'an empty invoice set is the "none does" case, not a "leave it alone" case');
  });

  it('a client who never paid gets no tag and the removal is a harmless no-op', async () => {
    await deriveAndSaveTags(pool, T, CID, client([invoice({ amounts: { total: 900, invoiceBalance: 250 } })]));
    const tags = await tagsOf();
    assert.ok(!tags.includes('paying_client'));
    // ⚠ The positive control that the derivation RAN at all — a DELETE of a row that is not there
    // succeeds silently, so "no paying_client" is also true of a function that threw on line one.
    assert.ok(tags.length > 0, 'other tag groups must still have been written');
  });

  // ── THE TWO WAYS A REMOVAL GOES TOO FAR ──────────────────────────────────────────────────
  it('REMOVAL IS EXACT — a prefix sibling on the same client survives', async () => {
    // ⚠ removeTagsByPrefix('paying_client') would take this too. The tag does not exist today,
    // which is exactly why the fence belongs here: it fails the moment someone "simplifies" the
    // exact delete into a prefix one, rather than years later when a sibling is introduced.
    // ⚠ THIS CASE WAS VACUOUS ON ITS FIRST WRITING AND GUARD-PROOF (i) IS WHAT FOUND IT.
    // It went straight to `client([])`, so paying_client was never written and the negative
    // assertion below was satisfied by a tag that had never existed — it stayed GREEN against
    // upsert-only code. The paid derivation is the precondition, and it has to be asserted.
    await deriveAndSaveTags(pool, T, CID, client([invoice()]));
    assert.ok((await tagsOf()).includes('paying_client'), 'precondition: the tag is there to remove');
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ($1, $2, 'paying_client_since', 'jobber_crm', NOW())`, [CID, T]);
    await deriveAndSaveTags(pool, T, CID, client([]));
    const tags = await tagsOf();
    assert.ok(!tags.includes('paying_client'));
    assert.ok(tags.includes('paying_client_since'), 'an exact delete must not reach a longer name');
  });

  it('TENANCY — another contractor\'s paying_client on the same client id is untouched', async () => {
    // ⚠ TENANT A MUST BE GIVEN THE TAG FIRST, AND THE FIRST WRITING OF THIS CASE DID NOT.
    // Deriving only `client([])` for A meant A never had the tag, so "tenant A loses it" was
    // true before the code ran — the case stayed GREEN under guard-proof (i) too. Found by that
    // proof, not by reading.
    await deriveAndSaveTags(pool, OTHER, CID, client([invoice()]));
    await deriveAndSaveTags(pool, T,     CID, client([invoice()]));
    assert.ok((await tagsOf(OTHER)).includes('paying_client'), 'precondition: tenant B is paying');
    assert.ok((await tagsOf(T)).includes('paying_client'),     'precondition: tenant A is paying');

    await deriveAndSaveTags(pool, T, CID, client([]));
    assert.ok(!(await tagsOf(T)).includes('paying_client'), 'tenant A loses it');
    assert.ok((await tagsOf(OTHER)).includes('paying_client'),
      'a tag delete without contractor_id in the predicate is a cross-tenant write');
  });
});
