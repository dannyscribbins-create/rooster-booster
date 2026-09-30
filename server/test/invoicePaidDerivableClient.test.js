'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE 7b REGRESSION THAT SHIPPED GREEN, AND WHY NO TEST COULD SEE IT
//
// 7b added a `pipeline_cache` UPDATE inside `upsertAndTagClient`'s locked transaction, gated on
// `alsoDeriveReferredStatus && isDerivableJobberClientId(fullClient.id)`. The statement used `$3`
// twice — assigned to `pipeline_status` (VARCHAR(50)) and compared to a literal inside a CASE — so
// Postgres refused it at PREPARE with **"inconsistent types deduced for parameter $3"**.
//
// ⚠ IT FAILED FOR EVERY INVOCATION, NOT FOR CERTAIN DATA. The error is a property of the SQL. No
// value of `ref.status` could have made it work.
//
// ⚠ AND NO EXISTING TEST EXECUTED THAT BLOCK, WHICH IS THE ENTRY WORTH KEEPING.
// `invoicePaidWebhook.test.js` drives the whole webhook end to end — and its client id is
// `'jobber-c1'`, which `isDerivableJobberClientId` REJECTS. So the guard commit 2 added meant every
// pre-existing fixture skipped the new block: the gate was green because the code never ran.
// **A fixture that satisfies every other assertion can still fail to reach the one branch a commit
// added**, and a guard introduced for good reasons is an excellent way to arrange that.
//
// ⚠ THE COST WAS NOT ONLY THE STATUS. The UPDATE shares a transaction with `captureClientFacts`, so
// the throw rolled the CAPTURE back. Measured in production: 7 clients over three hours on the
// invoice-paid door, one of them (gid://Jobber/Client/154808209) left with 0 job facts. Logged at
// INFO with `alert: false`, so nothing surfaced it.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { seedContractor } = require('./helpers');
const { deriveReferredStatus } = require('../utils/referredStatus');
const { withClientLock } = require('../utils/clientLock');

const CID = 'inv-paid-derivable';
// ⚠ A REAL EncodedId. The whole defect hid behind a synthetic one, so a synthetic fixture here
// would reproduce the blindness rather than the bug.
const GID = Buffer.from('gid://Jobber/Client/987654321', 'utf8').toString('base64');

let pool;

before(async () => { pool = await initTestDb(); await seedContractor(pool, CID); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'pipeline_cache', 'jobber_clients', 'error_log']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [CID]);
  }
});

/**
 * The exact statement `upsertAndTagClient` runs, driven directly.
 *
 * ⚠ IT IS READ OUT OF THE PRODUCTION SOURCE RATHER THAN RETYPED. A copy pasted here would be a twin
 * of the thing under test: it could only agree with production, and the original defect was IN the
 * SQL text — so a retyped copy carrying the fix would pass while production stayed broken. This
 * extracts the template literal from the file and executes it.
 */
function productionUpdateSql() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
  const start = src.indexOf('`UPDATE pipeline_cache');
  assert.ok(start > 0, 'harness: the UPDATE must be findable in the webhook source');
  const end = src.indexOf('`', start + 1);
  assert.ok(end > start, 'harness: the template literal must terminate');
  const sql = src.slice(start + 1, end);
  // ⚠ NON-VACUITY FLOOR. Without these, a slice that captured the wrong span would still "run" and
  // the test would prove nothing about the statement production sends.
  assert.match(sql, /UPDATE pipeline_cache/, 'harness: wrong span captured');
  assert.match(sql, /status_derived_at/, 'harness: the span must include the whole statement');
  assert.ok(sql.includes('$4'), 'harness: the span must include every parameter');
  return sql;
}

describe('the invoice-paid stage UPDATE runs at all — the 7b parameter-type regression', () => {
  it('⚠ THE DEFECT: the production UPDATE executes without a type-inference failure', async () => {
    // This is the whole bug. Before the `::text` casts, this line threw
    // "inconsistent types deduced for parameter $3" and nothing downstream ran.
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, $2, 'Derivable Client', 'Some Referrer', 'sold')`,
      [CID, GID]
    );
    await pool.query(productionUpdateSql(), [CID, GID, 'paid', new Date('2026-07-04T10:00:00Z')]);

    const { rows } = await pool.query(
      `SELECT pipeline_status, paid_at, status_derived_at FROM pipeline_cache
        WHERE contractor_id = $1 AND jobber_client_id = $2`, [CID, GID]);
    assert.equal(rows[0].pipeline_status, 'paid');
    assert.ok(rows[0].paid_at, 'the payable date must be written on the transition into paid');
    assert.ok(rows[0].status_derived_at, 'and the derived marker stamped');
  });

  it('it also runs for a NON-referred client, affecting no rows — which is what happened live', async () => {
    // ⚠ ALL SEVEN PRODUCTION CASUALTIES WERE NON-REFERRED CLIENTS, because the guard tests
    // derivability and NOT referred-ness. The statement is a no-op for them by row count — but it
    // still has to PREPARE, and that is what was failing. A test that only ever drove referred
    // clients would have missed the population the defect actually hit.
    const other = Buffer.from('gid://Jobber/Client/111222333', 'utf8').toString('base64');
    await pool.query(productionUpdateSql(), [CID, other, 'paid', null]);
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS n FROM pipeline_cache WHERE contractor_id = $1', [CID]);
    assert.equal(Number(rows[0].n), 0, 'no row is created — this is an UPDATE, never an INSERT');
  });

  it('a NULL paid_at is accepted, so a non-paid status cannot fail on the cast', async () => {
    // The `$4::timestamptz` cast already existed; this pins that adding `$3::text` did not disturb
    // the case where no payable date is supplied.
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, $2, 'C', 'R', 'lead')`, [CID, GID]);
    await pool.query(productionUpdateSql(), [CID, GID, 'inspection', null]);
    const { rows } = await pool.query(
      `SELECT pipeline_status, paid_at FROM pipeline_cache
        WHERE contractor_id = $1 AND jobber_client_id = $2`, [CID, GID]);
    assert.equal(rows[0].pipeline_status, 'inspection');
    assert.equal(rows[0].paid_at, null);
  });

  it('⚠ AND IT RUNS INSIDE A LOCKED TRANSACTION BESIDE A CAPTURE, WHICH IS THE AMPLIFIER', async () => {
    // The production shape: one transaction holding both the capture and this UPDATE. The point of
    // this case is the ROLLBACK — a throw here loses the facts too, which is why the live defect
    // left a client with 0 job facts rather than merely an undecided stage.
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, $2, 'C', 'R', 'sold')`, [CID, GID]);

    const sql = productionUpdateSql();
    await assert.rejects(
      () => withClientLock(pool, { contractorId: CID, jobberClientId: GID, door: 'test-rollback' },
        async (tx) => {
          await tx.query(
            `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id)
             VALUES ($1, 'job-rollback', $2)`, [CID, GID]);
          await tx.query(sql, [CID, GID, 'paid', null]);
          throw new Error('deliberate failure after both writes');
        }),
      /deliberate failure/
    );
    // ⚠ BOTH WRITES MUST BE GONE. If the fact row survived, the two were not in one transaction and
    // the production blast radius would have been smaller than reported — worth asserting either way.
    const facts = await pool.query(
      'SELECT COUNT(*) AS n FROM crm_job_facts WHERE contractor_id = $1', [CID]);
    assert.equal(Number(facts.rows[0].n), 0, 'the capture rolls back with the UPDATE — one transaction');
    const pc = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, GID]);
    assert.equal(pc.rows[0].pipeline_status, 'sold', 'and the stage is unchanged');
  });

  it('deriveReferredStatus feeds it a status the column accepts', async () => {
    // ⚠ A PAIRED POSITIVE FOR THE WHOLE CHAIN, because the cases above supply the status by hand.
    // If the deriver ever returned something `pipeline_status` could not store, those would all
    // still pass while production failed on the real value.
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
       VALUES ($1, $2, 'C', NOW()) ON CONFLICT DO NOTHING`, [GID, CID]);
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, $2, 'C', 'R', 'lead')`, [CID, GID]);

    const ref = await deriveReferredStatus(pool, { contractorId: CID, jobberClientId: GID });
    await pool.query(productionUpdateSql(), [CID, GID, ref.status, ref.paidAt]);
    const { rows } = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, GID]);
    assert.equal(rows[0].pipeline_status, ref.status);
  });
});

describe('a capture failure on the invoice-paid door must ALERT, not whisper', () => {
  const ROOT = path.join(__dirname, '..', '..');

  /** Comments stripped, line positions preserved. */
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  }

  it('the upsertAndTagClient capture catch alerts', () => {
    // ⚠ `alert: false` IS WHY THIS RAN FOR THREE HOURS UNSEEN. `logError` gates the Resend alert on
    // `alert !== false`, and severity is auto-classified, so the rows landed as INFO among routine
    // noise. A failure that rolls back a fact capture on the money door is not routine.
    const src = stripComments(fs.readFileSync(
      path.join(ROOT, 'server', 'routes', 'webhooks', 'jobber.js'), 'utf8'));
    const i = src.indexOf("source: 'upsertAndTagClient — capture'");
    assert.ok(i > 0, 'harness: the capture catch must be findable, or this asserts nothing');
    // ⚠ SLICED TO THE END OF THE logError CALL, NOT A FIXED NUMBER OF CHARACTERS. The first writing
    // used `i + 200` and failed against CORRECT code: comment-stripping leaves the comment's LENGTH
    // in place as blanks, so explaining the flag pushed the flag itself outside the window. A
    // character budget is a guess about how much prose someone will write.
    const end = src.indexOf('});', i);
    assert.ok(end > i, 'harness: the logError call must terminate after the source line');
    const window = src.slice(Math.max(0, i - 400), end);
    assert.match(window, /alert:\s*true/,
      'the capture failure must alert — it loses facts, not just a stage');
    assert.ok(!/alert:\s*false/.test(window), 'and must not still pass alert: false');
  });

  it('⚠ HARNESS FLOOR: the window really can see an alert:false', () => {
    // Without this, a window that happened to miss the flag entirely would pass the case above.
    const synthetic = "source: 'x — capture',\n        alert: false,\n      });";
    assert.ok(/alert:\s*false/.test(synthetic), 'the needle must detect the pre-fix form');
  });

  it('the UPDATE casts $3 in both of its uses', () => {
    const sql = productionUpdateSql();
    // ⚠ COUNTED, NOT MERELY PRESENT. One cast and one bare use is the defect; the assertion has to
    // see that no bare `$3` survives.
    const bare = sql.match(/\$3(?!::)/g) || [];
    assert.deepEqual(bare, [], 'every use of $3 must carry an explicit cast');
    assert.equal((sql.match(/\$3::text/g) || []).length, 2, 'both uses, cast the same way');
  });
});
