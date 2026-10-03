'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 9 — THE BACKWARDS-MOVE NOTE, AND THE OBSERVATION COLUMN BEHIND IT
//
// Danny's ruling: a referrer whose card moves BACKWARDS sees a subtle note reading exactly
// "This job is no longer active." A rep always sees the plain truth with no note.
//
// ⚠ THE COLUMN IS AN OBSERVATION AND NOTHING MAY GATE MONEY ON IT. Eligibility is
// `evaluateReferral`'s and the ledger is `referral_conversions`; "what was this referrer once
// shown" is a different question from "what are they owed", and conflating the two would let a
// display concern move a payout. A fence below names every money path and reads its source.
//
// ⚠ AND THE DAY-ONE PROPERTY IS THE ONE WORTH PROVING FIRST: no EXISTING referral may show the
// note. The initialisation sets the mark to each row's CURRENT status, so the comparison is false
// by construction on every pre-existing row — and that is asserted behaviourally, through the real
// migration, rather than argued from the SQL.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET.
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON, so a per-describe
// pool.end() would kill the pool a later describe needs and surface as CANCELLED under `fail 0`.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { seedContractor } = require('./helpers');
const {
  PROGRESS_LADDER, STAGE_RANK_ALIASES, stageRank, isStageRegressed,
  highWaterParams, highWaterRaiseSql, stageRegressedFromRow,
} = require('../utils/stageHighWater');
const { writeReferredStatus } = require('../utils/referredStatus');

const pipelineSync = require('../crm/pipelineSync');
const {
  syncSingleClient,
  _setPipelineSyncFetchForTest, _resetPipelineSyncFetch,
  _setPipelineSyncEmailsForTest, _resetPipelineSyncEmails,
  _setAttributionEngineForTest, _resetAttributionEngine,
} = pipelineSync;

const SERVER_ROOT = path.join(__dirname, '..');
const CID = 'high-water-tenant';
const REFERRER = 'High Water Referrer';
const START = new Date('2026-01-01T00:00:00Z');

const gid = (name) => Buffer.from('gid://Jobber/Client/' + name, 'utf8').toString('base64');
const CLIENT = gid('hw-main');

let pool;

/** Strip comments line-preservingly, so a needle cannot match prose and a line number stays true. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

const read = (rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8');

/**
 * The REAL initialisation statement, read out of db.js.
 *
 * ⚠ THE FLOOR IS BUILT FROM WHAT THE SUBJECT MUST CONTAIN, NOT FROM THE NEEDLE'S OWN SHAPE. This
 * repo records a floor that asserted its needle matched a string nobody would ever write, which
 * only confirmed the needle matched itself. So this one requires the five stage values AND the
 * not_sold normalisation AND the IS NULL guard — each of which is a property the statement needs to
 * be correct, and any of which going missing is a real defect rather than a parse miss.
 */
function extractInitStatement() {
  const db = stripComments(read('db.js'));
  const m = /UPDATE pipeline_cache\s+SET stage_high_water = CASE[\s\S]*?IN \([^)]*\)/.exec(db);
  assert.ok(m, 'harness: the initialisation UPDATE must still be findable in db.js');
  const sql = m[0];
  for (const needle of ['not_sold', 'lead', 'inspection', 'sold', 'paid', 'IS NULL']) {
    assert.ok(sql.includes(needle), `harness: the extracted statement is missing ${needle}`);
  }
  assert.ok(sql.length > 160, 'harness: the extracted statement is too short to be the real one');
  return sql;
}

const syncNode = (id) => ({
  id,
  firstName: 'Water', lastName: 'Client',
  createdAt: new Date('2026-06-01T00:00:00Z').toISOString(),
  customFields: [{ label: 'Referred by', valueText: REFERRER }],
});

/**
 * A capture-shape client whose facts produce a chosen stage.
 * `stage` is one of 'lead' | 'inspection' | 'sold' | 'paid' | 'not_sold', and the fixture is built
 * to reach it through the REAL classifier rather than by asserting it.
 *
 * ⚠ THE FIXTURES ARE BUILT FROM THE CLASSIFIER'S OWN RULES, NOT FROM A STAGE LABEL. `lead` is no
 * jobs and no quotes; `not_sold` is quotes that are ALL archived and no job; `inspection` is a live
 * quote and no job; `sold` is a job with no paid invoice; `paid` is a job with one. Seeding the
 * label directly is this repo's recorded vacuity shape #12 — a fixture carrying the value a broken
 * read also produces.
 */
const captureShape = (id, stage) => {
  const job = { id: `${id}-job`, jobStatus: 'active', client: { id }, invoices: { nodes: [] } };
  const paidInvoice = {
    id: `${id}-inv`, invoiceNumber: '1', invoiceStatus: 'paid', client: { id },
    amounts: { total: 1000, subtotal: 1000, invoiceBalance: 0, paymentsTotal: 1000,
      depositAmount: 0, discountAmount: 0, taxAmount: 0 },
    issuedDate: '2026-07-04T10:00:00Z', dueDate: null, receivedDate: '2026-07-04T10:00:00Z',
    createdAt: '2026-07-04T10:00:00Z', updatedAt: '2026-07-04T10:00:00Z',
    waitingForFinancedPayment: false,
    jobs: { nodes: [{ id: `${id}-job` }], pageInfo: { hasNextPage: false } },
    archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
  };
  const quote = (status) => ({
    id: `${id}-q`, quoteStatus: status, client: { id },
    createdAt: '2026-05-01T00:00:00Z', lastTransitioned: { approvedAt: null }, salesperson: null,
  });

  const base = {
    id,
    firstName: 'Water', lastName: 'Client',
    createdAt: new Date('2026-06-01T00:00:00Z').toISOString(),
    emails: [], phones: [], tags: { nodes: [] },
    customFields: [{ label: 'Referred by', valueText: REFERRER }],
    requests: { nodes: [] },
    quotes: { nodes: [] },
    jobs: { nodes: [] },
    invoices: { nodes: [] },
  };

  if (stage === 'lead') return base;
  if (stage === 'not_sold') return { ...base, quotes: { nodes: [quote('archived')] } };
  if (stage === 'inspection') return { ...base, quotes: { nodes: [quote('awaiting_response')] } };
  if (stage === 'sold') return { ...base, jobs: { nodes: [job] } };
  if (stage === 'paid') {
    return { ...base, jobs: { nodes: [job] }, invoices: { nodes: [paidInvoice] } };
  }
  throw new Error(`captureShape: unknown stage ${stage}`);
};

const cacheRow = async (id = CLIENT) => {
  const { rows } = await pool.query(
    `SELECT pipeline_status, stage_high_water, paid_at
       FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [CID, id]);
  return rows[0] || null;
};

/** Drive a real sync so the stage is derived from facts and stored, exactly as production does. */
const syncAt = async (stage, id = CLIENT) => {
  _setPipelineSyncFetchForTest(async (cid) => captureShape(cid, stage));
  await syncSingleClient(CID, syncNode(id), START, [], 'tok');
  return cacheRow(id);
};

/**
 * Make the facts behind a stage GO AWAY, then re-derive — which is what a backwards move IS.
 *
 * ⚠ THIS HELPER EXISTS BECAUSE TWO OF THIS SUITE'S OWN CASES WERE WRITTEN WRONG AND THE RUN SAID SO.
 * They drove `syncAt('paid')` and then `syncAt('sold')` and asserted the stage had fallen — and it
 * had not, because the CAPTURE IS CUMULATIVE. Supplying a smaller live client writes no new invoice
 * facts and deletes none, so `decideFromFacts` still reads the paid invoice and still answers
 * 'paid'. **The sync was right and the fixture was wrong**, and that is the whole reason N4 moved
 * the decision onto saved facts: a thinner fetch can no longer pull a referrer's stage down.
 *
 * ⚠ SO A REAL REGRESSION NEEDS A FACT TO DISAPPEAR — a voided invoice, a deleted job, an archived
 * quote — which is exactly what these deletes model.
 */
const dropFacts = async (what) => {
  if (what === 'invoices') {
    await pool.query(`DELETE FROM crm_invoice_job_links WHERE contractor_id = $1`, [CID]);
    await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, [CID]);
  } else if (what === 'jobs') {
    await pool.query(`DELETE FROM crm_invoice_job_links WHERE contractor_id = $1`, [CID]);
    await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, [CID]);
    await pool.query(`DELETE FROM crm_job_facts WHERE contractor_id = $1`, [CID]);
  } else {
    throw new Error(`dropFacts: unknown ${what}`);
  }
  return writeReferredStatus(pool, { contractorId: CID, jobberClientId: CLIENT });
};

const RESET_TABLES = ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
  'crm_quote_facts', 'crm_request_facts', 'crm_custom_field_facts', 'client_sale_jobs',
  'client_sales', 'client_rep_assignments', 'flagged_assignments', 'flagged_referrals',
  'referral_conversions', 'pipeline_cache', 'jobber_clients', 'admin_messages', 'error_log'];

before(async () => {
  pool = await initTestDb();
  await seedContractor(pool, CID);
  _setPipelineSyncEmailsForTest({
    adminNotification: async () => {},
    email: async () => ({ data: null, error: null }),
  });
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
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [CID]);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('N4 commit 9 — the ladder, and what ranks where', () => {
  it('the progress ladder is exactly the four rungs, lowest first', () => {
    assert.deepEqual(
      PROGRESS_LADDER, ['lead', 'inspection', 'sold', 'paid'],
      'the ordering moved; the SQL raise takes this array as a parameter, so both move together'
    );
  });

  it('not_sold TIES with lead, and app_user ranks 0 — off the ladder for different reasons', () => {
    // ⚠ THIS CASE WAS WRITTEN THE OTHER WAY ROUND AND WAS WRONG, AND THE OLD ASSERTION IS QUOTED
    // HERE RATHER THAN DELETED. It read `assert.equal(stageRank('not_sold'), 0)` with the comment
    // "not_sold is a lost outcome, not a rung" — and a rank of 0 put not_sold BELOW lead, so
    // `lead → not_sold` came out as a regression and the note fired on a client that had never
    // progressed. **That contradicts Danny's constraint directly**, and it was caught by two cases
    // disagreeing with the design comment rather than by reading either.
    //
    // ⚠ A LOST QUOTE IS NOT LESS PROGRESS THAN NEVER HAVING HAD ONE. `not_sold` requires a quote to
    // exist and be archived; `lead` is nothing at all. So they tie, and `not_sold` is only a
    // regression from `inspection` or above.
    assert.equal(stageRank('not_sold'), stageRank('lead'),
      'not_sold ties with lead — it is a lost outcome, not a rung BELOW the entry stage');
    assert.equal(stageRank('not_sold'), 1, 'and that shared rank is lead’s, which is 1');
    assert.equal(stageRank('app_user'), 0, 'app_user is a pipeline_cache value and never a stage');
  });

  it('a null, an undefined and an unknown value all rank 0 — the fail-closed direction', () => {
    // A rank of 0 can never EXCEED a real rank, so an unanticipated value can neither raise the
    // mark nor produce a note. That is the safe failure for a claim about someone's job.
    for (const v of [null, undefined, '', 'something_new']) {
      assert.equal(stageRank(v), 0, `${JSON.stringify(v)} must rank 0`);
    }
  });

  it('the four rungs rank in strictly increasing order', () => {
    const ranks = PROGRESS_LADDER.map(stageRank);
    assert.deepEqual(ranks, [1, 2, 3, 4], 'ranks are 1-based so that 0 is reserved for off-ladder');
    for (let i = 1; i < ranks.length; i += 1) {
      assert.ok(ranks[i] > ranks[i - 1], `${PROGRESS_LADDER[i]} must outrank ${PROGRESS_LADDER[i - 1]}`);
    }
  });

  it('REGRESSION IS STRICTLY LOWER: a never-moved card is NOT regressed, at every rung', () => {
    // ⚠ THIS IS THE `<` vs `<=` CASE, AND IT IS THE ONE DANNY NAMED. At `<=` every card would
    // carry the note, because the mark equals the stage on every row that has never moved — which
    // is every live row the day this ships.
    for (const stage of [...PROGRESS_LADDER, 'not_sold']) {
      assert.equal(
        isStageRegressed(stage, stage), false,
        `${stage} → ${stage} is not a backwards move and must show no note`
      );
    }
  });

  it('a genuine backwards move IS regressed, including into not_sold', () => {
    assert.equal(isStageRegressed('sold', 'paid'), true, 'paid → sold');
    assert.equal(isStageRegressed('inspection', 'sold'), true, 'sold → inspection');
    assert.equal(isStageRegressed('lead', 'inspection'), true, 'inspection → lead');
    // ⚠ THE MOST LIKELY BACKWARDS MOVE THERE IS, and the copy was written for it: a quote is
    // archived, so a client at 'inspection' becomes 'not_sold'.
    assert.equal(isStageRegressed('not_sold', 'inspection'), true, 'inspection → not_sold');
    assert.equal(isStageRegressed('not_sold', 'paid'), true, 'paid → not_sold');
  });

  it('a FORWARD move is never regressed', () => {
    assert.equal(isStageRegressed('paid', 'sold'), false, 'sold → paid');
    assert.equal(isStageRegressed('inspection', 'lead'), false, 'lead → inspection');
    assert.equal(isStageRegressed('inspection', 'not_sold'), false, 'not_sold → inspection');
  });

  it('NEVER on a true lead with no prior progress — Danny\'s constraint, as arithmetic', () => {
    // ⚠ `lead → not_sold` IS REACHABLE: a quote can first be seen already archived if the sync
    // window missed its live period. Both rank 0, so no note — which is what "no prior progress"
    // means. This is why not_sold TIES with lead rather than sitting below it.
    assert.equal(isStageRegressed('lead', 'lead'), false, 'a fresh lead shows nothing');
    assert.equal(isStageRegressed('lead', null), false, 'an uninitialised mark shows nothing');
    assert.equal(isStageRegressed('not_sold', 'lead'), false,
      'a client whose only quote was already archived has no prior progress to have lost — '
      + 'not_sold is ALIASED to the rank of lead, and the first writing of this file got that wrong');
  });

  it('the payload helper reads the row and answers a BOOLEAN, and tolerates a missing row', () => {
    assert.equal(stageRegressedFromRow({ pipeline_status: 'sold', stage_high_water: 'paid' }), true);
    assert.equal(stageRegressedFromRow({ pipeline_status: 'paid', stage_high_water: 'paid' }), false);
    assert.equal(stageRegressedFromRow({ pipeline_status: 'lead', stage_high_water: null }), false);
    assert.equal(stageRegressedFromRow(null), false, 'no row is not a regression');
    assert.equal(stageRegressedFromRow(undefined), false);
  });

  it('THE STORED MARK IS ALWAYS A LADDER VALUE — not_sold normalises to lead', () => {
    // ⚠ THIS IS WHAT MAKES THE SQL SAFE. The raise ranks the STORED side with `array_position` over
    // PROGRESS_LADDER, which cannot see an alias — so a mark holding the literal 'not_sold' would
    // rank 0 forever and the row could never be raised past it. `highWaterParams` is what keeps
    // that value out of the column.
    assert.deepEqual(highWaterParams('not_sold'), { rank: 1, mark: 'lead' },
      'not_sold carries the rank of lead and is STORED as lead');
    assert.deepEqual(highWaterParams('paid'), { rank: 4, mark: 'paid' });
    assert.deepEqual(highWaterParams('lead'), { rank: 1, mark: 'lead' });
    // A failed capture supplies no stage, and must move the mark in neither direction.
    assert.deepEqual(highWaterParams(null), { rank: 0, mark: null });
    assert.deepEqual(highWaterParams('app_user'), { rank: 0, mark: null },
      'app_user is not a stage, so it can never become a mark');

    // Every mark the helper can produce must be rankable by the ladder the SQL uses.
    for (const s of [...PROGRESS_LADDER, 'not_sold']) {
      const { mark } = highWaterParams(s);
      assert.ok(PROGRESS_LADDER.includes(mark), `${s} stored a non-ladder mark: ${mark}`);
    }
  });

  it('the alias set is exactly the one lost outcome, named rather than branched', () => {
    assert.deepEqual(STAGE_RANK_ALIASES, { not_sold: 'lead' },
      'a new alias is a ruling about what counts as progress, not a tidy-up');
  });

  it('the raise fragment REFUSES to be built without saying how the stored mark is named', () => {
    // The two call sites differ — a plain UPDATE says `stage_high_water`, an upsert's ON CONFLICT
    // must say `pipeline_cache.stage_high_water`. Defaulting one would make the other silently
    // correct-looking.
    assert.throws(() => highWaterRaiseSql('$5', '$6', '$7'), /storedRef is required/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('N4 commit 9 — the column, and what the migration does to EXISTING rows', () => {
  it('the column exists, is NULLABLE, and has NO default', async () => {
    const { rows } = await pool.query(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_name = 'pipeline_cache' AND column_name = 'stage_high_water'`
    );
    assert.equal(rows.length, 1, 'the column must exist in the live schema, not only in db.js');
    assert.equal(rows[0].is_nullable, 'YES', 'NULL means "nothing known about prior progress"');
    assert.equal(
      rows[0].column_default, null,
      'a DEFAULT would assert of a row created by the credit or the job-completed upsert that it '
      + 'had been SEEN at that stage, which nobody observed'
    );
  });

  it('DANNY\'S GUARD-PROOF 4 — an EXISTING referral shows NO note immediately after the migration',
    async () => {
      // ⚠ THE WHOLE DAY-ONE SAFETY PROPERTY, DRIVEN THROUGH THE REAL MIGRATION STATEMENT rather
      // than argued from the SQL text. Seed rows at every stage with a NULL mark — which is exactly
      // what production looked like before this boot — then run the initialisation and assert not
      // one of them is regressed.
      const stages = ['lead', 'inspection', 'sold', 'paid', 'not_sold'];
      for (const s of stages) {
        await pool.query(
          `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by,
             pipeline_status, stage_high_water)
           VALUES ($1, $2, 'Pre-existing', $3, $4, NULL)`,
          [CID, gid('pre-' + s), REFERRER, s]
        );
      }
      // The app_user placeholder, which the migration must leave alone.
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by,
           pipeline_status, stage_high_water)
         VALUES ($1, 'app_user_hw', 'Signup', $2, 'app_user', NULL)`,
        [CID, REFERRER]
      );

      // Precondition: every mark is NULL, so the assertion below cannot be satisfied by a
      // migration that never ran.
      const before = await pool.query(
        `SELECT COUNT(*)::int AS n FROM pipeline_cache
          WHERE contractor_id = $1 AND stage_high_water IS NULL`, [CID]);
      assert.equal(before.rows[0].n, 6, 'harness: all six rows start with a NULL mark');

      // THE REAL MIGRATION STATEMENT, extracted from db.js rather than retyped — a retyped copy
      // carrying the fix would pass while production stayed broken.
      // ⚠ EXTRACTED FROM db.js, NOT RETYPED. A retyped copy carrying the fix would pass while
      // production stayed broken — this repo's own recorded lesson about the uncast parameter.
      await pool.query(extractInitStatement());

      const { rows } = await pool.query(
        `SELECT jobber_client_id, pipeline_status, stage_high_water FROM pipeline_cache
          WHERE contractor_id = $1 ORDER BY jobber_client_id`, [CID]);
      const regressed = rows.filter(stageRegressedFromRow);
      assert.deepEqual(
        regressed.map((r) => r.pipeline_status), [],
        'NOT ONE pre-existing card may show the note on day one'
      );

      // And the mark is the row's own current stage — NORMALISED, and NULL for the placeholder.
      for (const r of rows) {
        if (r.pipeline_status === 'app_user') {
          assert.equal(r.stage_high_water, null, 'app_user is not a stage and stays unmarked');
        } else if (r.pipeline_status === 'not_sold') {
          // ⚠ THE ONE ROW WHERE THE MARK IS NOT A STRAIGHT COPY, AND IT IS DELIBERATE: the mark
          // must only hold a value the ladder can rank, or the row could never be raised past it.
          // The DISPLAY is identical — both rank 1 — which the regression check above already
          // proved by finding no note on this row.
          assert.equal(r.stage_high_water, 'lead',
            'not_sold is normalised to the rank it shares with lead');
        } else {
          assert.equal(r.stage_high_water, r.pipeline_status,
            'the mark is initialised to the row’s own current stage, never to a guess');
        }
        // Whatever was stored must be rankable, for every row that got a mark at all.
        if (r.stage_high_water !== null) {
          assert.ok(PROGRESS_LADDER.includes(r.stage_high_water),
            `the migration stored an unrankable mark: ${r.stage_high_water}`);
        }
      }
    });

  it('the initialisation is a permanent no-op once a mark is set — it cannot pull one back down',
    async () => {
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by,
           pipeline_status, stage_high_water)
         VALUES ($1, $2, 'Raised', $3, 'sold', 'paid')`,
        [CID, CLIENT, REFERRER]
      );
      await pool.query(extractInitStatement());
      const row = await cacheRow();
      assert.equal(
        row.stage_high_water, 'paid',
        'a raised mark must survive every later boot — otherwise the history the column exists to '
        + 'hold is erased by the migration that created it'
      );
      assert.equal(stageRegressedFromRow(row), true, 'and that row IS the regressed case');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('N4 commit 9 — the mark is raised and never lowered, through the real writers', () => {
  it('a brand-new referral is born with its mark EQUAL to its stage, so it shows no note',
    async () => {
      const row = await syncAt('sold');
      assert.equal(row.pipeline_status, 'sold', 'precondition: derived from facts');
      assert.equal(row.stage_high_water, 'sold', 'seeded in the same statement as the status');
      assert.equal(stageRegressedFromRow(row), false, 'a referral cannot be born looking backwards');
    });

  it('a FORWARD move raises the mark with the stage', async () => {
    await syncAt('inspection');
    const row = await syncAt('paid');
    assert.equal(row.pipeline_status, 'paid');
    assert.equal(row.stage_high_water, 'paid', 'the mark followed the stage up');
    assert.equal(stageRegressedFromRow(row), false);
  });

  it('A BACKWARDS MOVE LEAVES THE MARK HIGH, AND THE CARD IS THEN REGRESSED', async () => {
    const up = await syncAt('paid');
    assert.equal(up.stage_high_water, 'paid', 'precondition: the mark reached paid');

    // The invoice is voided — the fact goes away, so the derivation falls to 'sold'.
    const out = await dropFacts('invoices');
    assert.equal(out.status, 'sold', 'precondition: the derivation genuinely fell');

    const down = await cacheRow();
    assert.equal(down.pipeline_status, 'sold', 'the stage moved backwards, as it must be allowed to');
    assert.equal(down.stage_high_water, 'paid', 'and the mark did NOT follow it down');
    assert.equal(stageRegressedFromRow(down), true, 'so the note is shown');
  });

  it('the stage still moves backwards — the mark explains it, it does not ratchet it', async () => {
    // ⚠ 7b REJECTED A RATCHET ON THIS COLUMN DELIBERATELY: it would block the genuine corrections
    // too, and 5 of 21 sampled moves were real. This case pins that commit 9 did not sneak one in.
    await syncAt('paid');
    const out = await dropFacts('jobs');
    assert.equal(out.status, 'lead', 'precondition: with no jobs and no quotes the facts say lead');
    const down = await cacheRow();
    assert.equal(
      down.pipeline_status, 'lead',
      'the referrer-visible stage is the TRUTH; the note is what makes a backwards move legible'
    );
    assert.equal(down.stage_high_water, 'paid', 'the mark is the only thing that held');
  });

  it('inspection → not_sold is a regression, which is the move the copy was written for', async () => {
    const up = await syncAt('inspection');
    assert.equal(up.stage_high_water, 'inspection', 'precondition');
    const down = await syncAt('not_sold');
    assert.equal(down.pipeline_status, 'not_sold', 'every quote archived, no job');
    assert.equal(down.stage_high_water, 'inspection');
    assert.equal(stageRegressedFromRow(down), true);
  });

  it('a client that only ever reached lead shows no note when it becomes not_sold', async () => {
    const first = await syncAt('lead');
    assert.equal(first.stage_high_water, 'lead', 'precondition: no prior progress');
    const next = await syncAt('not_sold');
    assert.equal(next.pipeline_status, 'not_sold', 'precondition: the stage really is not_sold');
    assert.equal(
      next.stage_high_water, 'lead',
      'the mark holds a LADDER value — not_sold ties with lead, so it neither raises nor is stored'
    );
    assert.equal(stageRegressedFromRow(next), false, 'nothing was lost, so nothing is explained');
  });

  it('A FAILED CAPTURE MOVES THE MARK IN NEITHER DIRECTION', async () => {
    // ⚠ THE UPSERT'S OTHER BRANCH, AND IT NEEDED ITS OWN CASE. When the derivation does not run the
    // sync still writes the referral record, with a NULL status — so the mark's parameters are rank
    // 0 and mark NULL, and a strict `>` leaves the stored value alone. Without this case that
    // branch had no test at all, and a guard-proof aimed at it measured width 0.
    // ⚠ THE MARK MUST START LOW, AND THE FIRST WRITING OF THIS CASE DID NOT — IT STARTED AT 'paid',
    // so an injection that raises a failed capture TO 'paid' changed nothing and measured width 0.
    // A fixture whose before and after agree cannot tell a protected branch from an unprotected
    // one. Starting at 'inspection' makes a spurious raise observable.
    const up = await syncAt('inspection');
    assert.equal(up.stage_high_water, 'inspection', 'precondition: the mark is BELOW the top rung');

    // The Jobber fetch fails, which IS a capture failure and the most likely one.
    _setPipelineSyncFetchForTest(async () => { throw new Error('jobber down'); });
    await syncSingleClient(CID, syncNode(CLIENT), START, [], 'tok');

    const after = await cacheRow();
    assert.equal(after.stage_high_water, 'inspection', 'a failed capture must not raise the mark');
    assert.equal(after.pipeline_status, 'inspection',
      'and must not move the stage either (the 7b ruling)');
    assert.equal(stageRegressedFromRow(after), false, 'so no note appears because Jobber blipped');
  });

  it('writeReferredStatus raises the mark on an EXISTING row — the catch-up\'s path', async () => {
    // The catch-up job reaches the column through writeReferredStatus rather than through the sync,
    // so the raise has to be in that statement too. Seeded low, then derived high from facts.
    await syncAt('paid');
    await pool.query(
      `UPDATE pipeline_cache SET pipeline_status = 'lead', stage_high_water = 'lead'
        WHERE contractor_id = $1 AND jobber_client_id = $2`, [CID, CLIENT]);

    const out = await writeReferredStatus(pool, { contractorId: CID, jobberClientId: CLIENT });
    assert.equal(out.rowCount, 1, 'precondition: the row was found and updated');
    assert.equal(out.status, 'paid', 'precondition: the facts still say paid');

    const row = await cacheRow();
    assert.equal(row.stage_high_water, 'paid', 'writeReferredStatus raised it');
  });

  it('writeReferredStatus does NOT lower the mark when the derivation drops', async () => {
    await syncAt('paid');
    // The facts go away: delete the invoice facts so the derivation falls to 'sold'.
    await pool.query(`DELETE FROM crm_invoice_job_links WHERE contractor_id = $1`, [CID]);
    await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, [CID]);

    const out = await writeReferredStatus(pool, { contractorId: CID, jobberClientId: CLIENT });
    assert.equal(out.status, 'sold', 'precondition: the derivation genuinely fell');

    const row = await cacheRow();
    assert.equal(row.stage_high_water, 'paid', 'the mark held');
    assert.equal(stageRegressedFromRow(row), true, 'and the note fires on the real path');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('N4 commit 9 — NO MONEY PREDICATE READS THE MARK', () => {
  // ⚠ DANNY'S SECOND GUARD-PROOF. The column is an observation about a DISPLAY; the moment an
  // eligibility rule or a ledger query reads it, a referrer's payout depends on what they were
  // once shown. These are the money paths by name, and the fence reads their source.
  const MONEY_FILES = [
    'referralRules.js',
    'utils/referralCredit.js',
    'utils/cashoutBalance.js',
    'utils/referralConversion.js',
    'utils/stripeTransfer.js',
  ];

  it('the money files exist — the fence is not reading an empty set', () => {
    for (const f of MONEY_FILES) {
      assert.ok(
        fs.existsSync(path.join(SERVER_ROOT, f)),
        `${f} must exist, or this fence is asserting the absence of a column from nothing`
      );
    }
  });

  it('not one money path mentions stage_high_water', () => {
    const offenders = [];
    for (const f of MONEY_FILES) {
      const src = stripComments(read(f));
      if (/stage_high_water/.test(src)) offenders.push(f);
    }
    assert.deepEqual(
      offenders, [],
      'a money predicate reads the display mark: ' + offenders.join(', ')
    );
  });

  it('NON-VACUITY: the needle DOES match a file that legitimately uses the column', () => {
    // Without this, a renamed column would make the fence above pass against everything.
    const src = stripComments(read('utils/referredStatus.js'));
    assert.ok(
      /stage_high_water/.test(src),
      'the needle must be able to match — referredStatus.js is where the raise lives'
    );
  });

  it('and no money table is written in the same statement as the mark', () => {
    // A statement touching both would couple them whatever the file list says.
    for (const f of ['utils/referredStatus.js', 'crm/pipelineSync.js']) {
      const src = stripComments(read(f));
      const spans = src.split('stage_high_water');
      for (let i = 1; i < spans.length; i += 1) {
        const window = spans[i].slice(0, 400);
        assert.ok(
          !/referral_conversions|cashout_requests/.test(window),
          `${f}: a money table appears within 400 characters after a stage_high_water write`
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('N4 commit 9 — one ladder, two payload builders, and the rep surface untouched', () => {
  it('BOTH referrer payload builders call the SHARED helper', () => {
    // ⚠ N4 commit 7a RECORDS THE SECOND ONE AS "the one that would have been missed", because the
    // stale-cache fallback runs precisely when the adapter has just failed.
    for (const f of ['crm/jobber.js', 'routes/referrer.js']) {
      const src = stripComments(read(f));
      assert.ok(
        /stageRegressedFromRow\s*\(/.test(src),
        `${f} must compute the note's boolean through the shared helper`
      );
      assert.ok(
        /stage_high_water/.test(src),
        `${f} must SELECT the column, or the helper reads undefined and silently answers false`
      );
    }
  });

  it('neither payload builder spells the comparison itself', () => {
    for (const f of ['crm/jobber.js', 'routes/referrer.js']) {
      const src = stripComments(read(f));
      assert.ok(
        !/stageRank\s*\(/.test(src),
        `${f} ranks stages itself — the ordering must have exactly one definition`
      );
    }
  });

  it('the ladder is passed as a PARAMETER, so the SQL carries no ordering of its own', () => {
    for (const f of ['utils/referredStatus.js', 'crm/pipelineSync.js']) {
      const src = stripComments(read(f));
      assert.ok(
        /highWaterRaiseSql\s*\(/.test(src),
        `${f} must build the raise from the shared fragment`
      );
      assert.ok(
        /PROGRESS_LADDER/.test(src),
        `${f} must bind the shared ladder rather than writing an ORDER of its own`
      );
      // A hand-written CASE ladder is the mirror-drift shape this avoids.
      assert.ok(
        !/WHEN\s+'(lead|inspection|sold|paid)'\s+THEN\s+\d/.test(src),
        `${f} spells a CASE ladder — that is a second copy of the ordering`
      );
    }
  });

  it('THE REP SURFACE IS UNTOUCHED: no rep file reads the mark, and the note is referrer-only', () => {
    // ⚠ DANNY'S RULING: reps always see the plain truth with no note. The rep's column is
    // `jobber_clients.pipeline_stage` and nothing here touches it.
    const repFiles = ['routes/rep.js', 'jobs/repImportScope.js', 'jobs/repNamesBackfill.js'];
    for (const f of repFiles) {
      if (!fs.existsSync(path.join(SERVER_ROOT, f))) continue;
      const src = stripComments(read(f));
      assert.ok(
        !/stage_high_water|stage_regressed/.test(src),
        `${f} reads the referrer's display mark — a rep must see the plain truth`
      );
    }
  });

  it('the mark is never written to the REP column\'s table', () => {
    for (const f of ['utils/referredStatus.js', 'crm/pipelineSync.js']) {
      const src = stripComments(read(f));
      const spans = src.split('stage_high_water');
      for (let i = 1; i < spans.length; i += 1) {
        assert.ok(
          !/^\s*[^;]{0,200}jobber_clients/.test(spans[i]),
          `${f}: stage_high_water appears alongside jobber_clients — it belongs to pipeline_cache`
        );
      }
    }
  });
});
