'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-3 — THE DEFAULT SCHEDULE
//
// Danny's ruling: each contractor has a DEFAULT schedule used when a job's category value is
// blank, absent at every stage, or not mapped to any schedule. **It starts as "No bonus" until the
// contractor chooses one of their own schedules in the Referral Program settings. Unmapped and
// blank values never silently pay on a schedule nobody chose.**
//
// ⚠ AND THE HARD-CODED 'Job Type' FALLBACK IS RETIRED IN BOTH READERS TOGETHER. 7c-0 kept it
// deliberately, with a comment arguing that `evaluateReferral` and `deriveJobberTags` must resolve
// the SAME field for an unmapped contractor or their tags and their payouts would disagree. **That
// argument was about AGREEMENT, not about the literal** — both now resolve null, both mean "no
// category field is mapped", and the default schedule decides. A fence asserts neither site carries
// the literal, because retiring one alone is the regression that comment warned about.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET.
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { seedContractor } = require('./helpers');
const { getDefaultSchedule, SCHEDULE_COLUMNS } = require('../utils/defaultSchedule');
const deriveAndSaveTags = require('../utils/deriveJobberTags');
const { evaluateReferral } = require('../referralRules');

const SERVER_ROOT = path.join(__dirname, '..');
const CID = 'default-sched-tenant';
const OTHER = 'default-sched-other';
const REFERRER = 'Default Schedule Referrer';

let pool;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}
const read = (rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8');

/** A flat schedule paying a known, ODD amount so a figure cannot be reached by coincidence. */
async function seedSchedule(contractorId, name, { amount = 377, active = true, labels = [] } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO referral_schedules
       (contractor_id, name, is_active, payout_model, flat_amount, reset_period, invoice_window_days)
     VALUES ($1, $2, $3, 'flat', $4, 'none', 20) RETURNING id`,
    [contractorId, name, active, amount]
  );
  const id = rows[0].id;
  for (const label of labels) {
    // ⚠ `contractor_id` IS NOT NULL HERE AND I OMITTED IT FIRST. A table's shape is its CREATE
    // plus every ALTER since, and this one also carries UNIQUE(contractor_id, jobber_label) -- so
    // one label belongs to at most ONE schedule per contractor, which is why no fixture below
    // assigns the same label twice.
    await pool.query(
      `INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
       VALUES ($1, $2, $3)`,
      [id, contractorId, label]
    );
  }
  return id;
}

async function setDefault(contractorId, scheduleId) {
  await pool.query(
    'UPDATE contractor_settings SET default_schedule_id = $1 WHERE contractor_id = $2',
    [scheduleId, contractorId]
  );
}

/** A referrer with an account, so STEP 2 passes and the category gates are what decide. */
async function seedReferrer(contractorId) {
  const { rows } = await pool.query(
    // ⚠ THE COLUMN IS `pin`, NOT `pin_hash` -- read from db.js rather than guessed at the second time.
    `INSERT INTO users (full_name, email, pin, contractor_id)
     VALUES ($1, $2, 'x', $3) RETURNING id`,
    [REFERRER, `ref-${contractorId}@example.com`, contractorId]
  );
  return rows[0].id;
}

/**
 * A paid invoice whose job carries a chosen category value, or none at all.
 * `categoryLabel` is the FIELD label on the record; `categoryValue` its value.
 */
const invoice = ({ categoryLabel = null, categoryValue = null } = {}) => ({
  id: 'inv-default-1',
  invoiceStatus: 'paid',
  amounts: { total: 9000, invoiceBalance: 0 },
  issuedDate: '2026-07-04T10:00:00Z',
  receivedDate: '2026-07-04T10:00:00Z',
  waitingForFinancedPayment: false,
  client: { id: 'gid-default-client' },
  jobs: {
    nodes: [{
      id: 'job-default-1',
      customFields: categoryLabel
        ? [{ label: categoryLabel, valueDropdown: categoryValue }]
        : [],
    }],
    pageInfo: { hasNextPage: false },
  },
  archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
});

/**
 * ⚠ EVERY CALL SUPPLIES `clientCreatedAt`, AND THE FIRST WRITING DID NOT — SO STEP 3b REFUSED WITH
 * `client_created_at_unknown` BEFORE ANY CATEGORY GATE RAN, AND SIX CASES FAILED ON A REASON THAT
 * HAS NOTHING TO DO WITH THIS SUITE'S SUBJECT. The client has no stored `jobber_created_at` and the
 * contractor has a programme start date, so the date gate decided first. The option is the path a
 * live caller with a fresh client already takes, and the date is comfortably after the start date,
 * so what these cases measure is the category logic and nothing else.
 */
const EVAL_OPTS = { clientCreatedAt: '2026-06-01T00:00:00Z' };

// ⚠ `contractor_settings` IS CLEARED AND RE-SEEDED PER TEST, BECAUSE THE 6c FENCE CAUGHT THIS SUITE
// AND IT WAS RIGHT. The first writing only UPDATEd the two columns it cared about in `beforeEach`,
// which is a reset in spirit and invisible to a scanner reading DELETEs — and an UPDATE of two
// columns would have left any OTHER column a case wrote leaking into the next one.
// ⚠ IT IS LISTED BEFORE `referral_schedules` FOR FK ORDER. `default_schedule_id` references that
// table; clearing the settings row first means the reference is gone before its target is.
const RESET_TABLES = ['referral_conversions', 'contractor_settings',
  'referral_schedule_job_types', 'referral_schedules',
  'contact_tags', 'pipeline_cache', 'jobber_clients', 'users', 'error_log'];

before(async () => {
  pool = await initTestDb();
  await seedContractor(pool, CID);
  await seedContractor(pool, OTHER);
  for (const c of [CID, OTHER]) {
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, referral_start_date)
       VALUES ($1, '2020-01-01') ON CONFLICT (contractor_id) DO NOTHING`, [c]);
  }
});

after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of RESET_TABLES) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1 OR contractor_id = $2`, [CID, OTHER]);
  }
  // ⚠ THE TAG DERIVER'S OWN ERROR ROWS CARRY NO contractor_id, so the tenant-scoped delete above
  // cannot reach them — and an absence assertion over an uncleared table starts measuring a prior
  // case's leftovers, which is exactly what the 6c reset-coverage fence exists to catch.
  await pool.query(`DELETE FROM error_log WHERE source LIKE 'deriveAndSaveTags%'`);
  // Re-seeded rather than UPDATEd, so every column starts at its default for each case.
  for (const c of [CID, OTHER]) {
    await pool.query('INSERT INTO contractor_settings (contractor_id) VALUES ($1)', [c]);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('7c-3 — the reader, and what "No bonus" means', () => {
  it('a contractor who has never chosen has NO default — the ruled starting state', async () => {
    await seedSchedule(CID, 'Flat 377');
    assert.equal(
      await getDefaultSchedule(pool, CID), null,
      'NULL is "No bonus", and it is where every contractor starts — nothing to migrate'
    );
  });

  it('a chosen, ACTIVE schedule is returned with the engine\'s own column set', async () => {
    const id = await seedSchedule(CID, 'Flat 377');
    await setDefault(CID, id);
    const got = await getDefaultSchedule(pool, CID);
    assert.ok(got, 'the default resolves');
    assert.equal(got.id, id);
    for (const col of SCHEDULE_COLUMNS) {
      assert.ok(col in got, `the default row must carry ${col} — the engine reads it downstream`);
    }
  });

  it('mapped_labels is EMPTY on the default, deliberately', async () => {
    const id = await seedSchedule(CID, 'Flat 377', { labels: ['Full Roof'] });
    await setDefault(CID, id);
    const got = await getDefaultSchedule(pool, CID);
    assert.deepEqual(
      got.mapped_labels, [],
      'the default applies BECAUSE it is the default, never because something matched — handing '
      + 'back the labels it failed to match on would invite a reader to re-run the comparison'
    );
  });

  it('an INACTIVE default does not apply', async () => {
    const id = await seedSchedule(CID, 'Retired', { active: false });
    await setDefault(CID, id);
    assert.equal(
      await getDefaultSchedule(pool, CID), null,
      'a retired schedule paying on the fallback path would contradict the settings screen'
    );
  });

  it('a DELETED default reverts to No bonus rather than dangling', async () => {
    const id = await seedSchedule(CID, 'Doomed');
    await setDefault(CID, id);
    assert.ok(await getDefaultSchedule(pool, CID), 'precondition: it resolved first');

    await pool.query('DELETE FROM referral_schedules WHERE id = $1', [id]);
    const { rows } = await pool.query(
      'SELECT default_schedule_id FROM contractor_settings WHERE contractor_id = $1', [CID]);
    assert.equal(rows[0].default_schedule_id, null, 'ON DELETE SET NULL cleared it');
    assert.equal(await getDefaultSchedule(pool, CID), null);
  });

  it('TENANCY: another contractor’s schedule can never resolve as this one’s default',
    async () => {
      // ⚠ THE FK CONSTRAINS EXISTENCE, NOT OWNERSHIP, so the id below is storable. The reader's
      // JOIN carries its own `s.contractor_id = cs.contractor_id` predicate, which is the second
      // guard behind the PATCH handler's ownership check.
      const theirs = await seedSchedule(OTHER, 'Theirs');
      await setDefault(CID, theirs);
      assert.equal(
        await getDefaultSchedule(pool, CID), null,
        'a cross-tenant default must not decide this contractor’s payouts'
      );
    });

  it('a falsy contractor id returns null rather than querying', async () => {
    assert.equal(await getDefaultSchedule(pool, null), null);
    assert.equal(await getDefaultSchedule(pool, ''), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('7c-3 — the engine, at both refusal points', () => {
  it('BLANK/ABSENT with NO default credits NOTHING, and the reason is unchanged', async () => {
    await seedReferrer(CID);
    await seedSchedule(CID, 'Flat 377', { labels: ['Full Roof'] });
    const out = await evaluateReferral(CID, invoice(), REFERRER, EVAL_OPTS);
    assert.equal(out.qualified, false, 'Danny’s ruling: No bonus means nothing is paid');
    assert.equal(
      out.reason, 'no_job_type_found',
      'the reason string is deliberately unchanged — every caller and the credit tally group by it'
    );
  });

  it('BLANK/ABSENT with a default PAYS ON THE DEFAULT', async () => {
    await seedReferrer(CID);
    const id = await seedSchedule(CID, 'Fallback 377');
    await setDefault(CID, id);
    const out = await evaluateReferral(CID, invoice(), REFERRER, EVAL_OPTS);
    assert.equal(out.qualified, true, 'the default applies when there is no category at all');
    assert.equal(out.scheduleId, id, 'and it is the schedule the contractor chose');
    assert.equal(out.scheduleName, 'Fallback 377');
    assert.equal(Number(out.bonusAmount), 377,
      'the ODD amount — a round number could be a coincidence. ⚠ Number() because NUMERIC comes '
      + 'back from pg as a STRING, which referralRules.test.js already documents at its own flat '
      + 'assertions — a pre-existing property, not something 7c-3 introduced.');
  });

  it('AN UNMAPPED VALUE with NO default credits NOTHING, reason unchanged', async () => {
    await seedReferrer(CID);
    await pool.query(
      `UPDATE contractor_settings SET contractor_field_mappings = $1 WHERE contractor_id = $2`,
      [JSON.stringify({ work_category: { field_id: 'cfg-1', entity: 'ALL_JOBS', label: 'Job Type' } }), CID]);
    await seedSchedule(CID, 'Flat 377', { labels: ['Full Roof'] });

    const out = await evaluateReferral(
      CID, invoice({ categoryLabel: 'Job Type', categoryValue: 'Gutter Cleaning' }), REFERRER, EVAL_OPTS);
    assert.equal(out.qualified, false, 'an unmapped value must never pay on a schedule nobody chose');
    assert.equal(out.reason, 'no_matching_schedule_for_job_type');
  });

  it('AN UNMAPPED VALUE with a default PAYS ON THE DEFAULT — the case the ruling names most directly',
    async () => {
      await seedReferrer(CID);
      await pool.query(
        `UPDATE contractor_settings SET contractor_field_mappings = $1 WHERE contractor_id = $2`,
        [JSON.stringify({ work_category: { field_id: 'cfg-1', entity: 'ALL_JOBS', label: 'Job Type' } }), CID]);
      await seedSchedule(CID, 'Full Roof Only', { amount: 500, labels: ['Full Roof'] });
      const fallbackId = await seedSchedule(CID, 'Fallback 611', { amount: 611 });
      await setDefault(CID, fallbackId);

      const out = await evaluateReferral(
        CID, invoice({ categoryLabel: 'Job Type', categoryValue: 'Gutter Cleaning' }), REFERRER, EVAL_OPTS);
      assert.equal(out.qualified, true);
      assert.equal(out.scheduleId, fallbackId, 'the DEFAULT, not the matching-by-nothing schedule');
      assert.equal(Number(out.bonusAmount), 611, 'and NOT 500 — the mapped schedule must not have won');
    });

  it('A MATCHED VALUE still beats the default — the default is a FALLBACK, not an override',
    async () => {
      // ⚠ THE PAIRED POSITIVE, and without it every assertion above is satisfied by an engine that
      // ignores the schedules entirely and always pays the default.
      await seedReferrer(CID);
      await pool.query(
        `UPDATE contractor_settings SET contractor_field_mappings = $1 WHERE contractor_id = $2`,
        [JSON.stringify({ work_category: { field_id: 'cfg-1', entity: 'ALL_JOBS', label: 'Job Type' } }), CID]);
      const matchedId = await seedSchedule(CID, 'Full Roof', { amount: 823, labels: ['Full Roof'] });
      const fallbackId = await seedSchedule(CID, 'Fallback 611', { amount: 611 });
      await setDefault(CID, fallbackId);

      const out = await evaluateReferral(
        CID, invoice({ categoryLabel: 'Job Type', categoryValue: 'Full Roof' }), REFERRER, EVAL_OPTS);
      assert.equal(out.qualified, true);
      assert.equal(out.scheduleId, matchedId, 'the MATCH wins');
      assert.equal(Number(out.bonusAmount), 823, 'and NOT 611');
    });

  it('NO FIELD MAPPED AT ALL now falls to the default, rather than guessing at a label', async () => {
    // ⚠ THIS IS WHAT RETIRING THE 'Job Type' FALLBACK BUYS. Before 7c-3 an unmapped contractor had
    // its category read from a field literally named "Job Type" — a label that on the live tenant
    // names THREE different configurations with different option lists. Now nothing is guessed.
    await seedReferrer(CID);
    const fallbackId = await seedSchedule(CID, 'Fallback 611', { amount: 611 });
    await setDefault(CID, fallbackId);

    // The record DOES carry a field called 'Job Type' with a value the schedule would have matched.
    await seedSchedule(CID, 'Would Have Matched', { amount: 500, labels: ['Full Roof'] });
    const out = await evaluateReferral(
      CID, invoice({ categoryLabel: 'Job Type', categoryValue: 'Full Roof' }), REFERRER, EVAL_OPTS);
    assert.equal(out.qualified, true);
    assert.equal(
      Number(out.bonusAmount), 611,
      'with NO mapping, the literal is no longer consulted — so the value on the record is not '
      + 'read at all and the default decides. 500 here would mean the fallback is still alive.'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('7c-3 — the fallback literal is retired in BOTH readers, or neither', () => {
  const READERS = ['referralRules.js', 'utils/deriveJobberTags.js'];

  it('NEITHER reader resolves the category label to a hard-coded literal', () => {
    // ⚠ COMMENTS ARE STRIPPED, AND THIS IS THE ONE SHAPE WHERE REWORDING IS NOT THE FIX. Both files
    // carry prose NAMING the retired literal, because a comment has to be able to say what it
    // removed — the same exception `routes/referrer.js` needed for its removed money write.
    for (const f of READERS) {
      const code = stripComments(read(f));
      assert.ok(
        !/'Job Type'/.test(code),
        `${f} still resolves the category label to a literal; 7c-3 retires it in BOTH or NEITHER`
      );
    }
  });

  it('NON-VACUITY: the needle DOES match the prose, so stripping is what cleared it', () => {
    // Without this, a renamed file or a broken read would make the absence above trivially true.
    for (const f of READERS) {
      assert.ok(
        /'Job Type'/.test(read(f)),
        `harness: ${f} must still mention the literal in PROSE, or the strip proved nothing`
      );
    }
  });

  it('BOTH readers resolve the label through the shared parser and accept null', () => {
    const engine = stripComments(read('referralRules.js'));
    assert.ok(/parseMappingEntry\(/.test(engine), 'the engine resolves through the parser');
    assert.ok(
      /workCategoryLabel\s*=\s*null/.test(engine),
      'and its unmapped value is null — a literal here is the regression'
    );
    const tags = stripComments(read('utils/deriveJobberTags.js'));
    assert.ok(
      /mappedLabel\('work_category',\s*null\)/.test(tags),
      'the tag reader passes null for an unmapped category'
    );
  });

  it('THE NULL LABEL IS GUARDED, because the throw it would cause is SWALLOWED', () => {
    // ⚠ `getCustomFieldValue` called `label.toLowerCase()`. A null label throws a TypeError that
    // `deriveAndSaveTags`' own try/catch catches — so EVERY tag for EVERY client would vanish
    // behind one error_log row. The guard is what makes retiring the fallback safe.
    const tags = stripComments(read('utils/deriveJobberTags.js'));
    assert.ok(
      /if \(!label\) return null;/.test(tags),
      'getCustomFieldValue must refuse a null label rather than throwing into a catch that hides it'
    );
    assert.ok(
      /catch/.test(tags),
      'harness: the swallowing catch must still exist, or this guard protects nothing'
    );
  });

  it('BEHAVIOURAL: with NO mapping, tagging still RUNS — the swallow is what made this dangerous',
    async () => {
      // ⚠ THE SOURCE FENCE ABOVE PROVES THE GUARD IS WRITTEN; THIS PROVES THE CONSEQUENCE. Saying
      // which half is which is the difference between a proof and a claim. Without the guard,
      // `getCustomFieldValue(fields, null)` throws a TypeError that `deriveAndSaveTags` CATCHES, so
      // every tag for every client vanishes behind one error_log row and nothing visible fails.
      const TC = 'gid-tagcheck-1';
      await pool.query(
        `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
         VALUES ($1, $2, 'Tag', NOW())
         ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`, [TC, CID]);

      // No mapping at all, so `workCategoryLabel` resolves null -- the newly reachable state.
      await deriveAndSaveTags(pool, CID, TC, {
        isCompany: false,
        customFields: [],
        quotes: [], requests: [],
        jobs: [{
          id: 'tagcheck-job',
          // ⚠ THE JOB MUST CARRY AT LEAST ONE CUSTOM FIELD, AND THE FIRST WRITING GAVE IT NONE —
          // so the guard-proof measured width 1 (source only) and the behavioural half proved
          // nothing. `getCustomFieldValue` does `fields.find(f => … label.toLowerCase() …)`, and
          // over an EMPTY array the predicate never runs, so the null label is never dereferenced
          // and the throw this case exists to observe cannot happen. **A fixture that cannot reach
          // the discriminating value is not a test of it** — the field below is what makes the
          // predicate execute.
          customFields: [{ label: 'Some Unrelated Field', valueText: 'x' }],
          invoices: [{ id: 'tagcheck-inv', invoiceStatus: 'paid', createdAt: new Date().toISOString(),
            amounts: { total: 900, invoiceBalance: 0 } }],
        }],
        invoices: [],
      }, {});

      const tags = (await pool.query(
        `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [CID, TC])).rows.map((r) => r.tag);

      // ⚠ "ZERO TAGS" IS THE WRONG OBSERVABLE, AND TWO GUARD-PROOF RUNS AT WIDTH 1 ARE WHAT SAID
      // SO. The category is read PART-WAY THROUGH `deriveAndSaveTags` — the client-type, invoice:*
      // and value:* groups are already written and committed by then — so a throw there leaves
      // those tags in place and `tags.length > 0` survives the defect intact. **A fixture whose
      // observable is unaffected by the injection is not a test of it.**
      // ⚠ THE DISCRIMINATING OBSERVABLE IS THE SWALLOW'S OWN FOOTPRINT: the catch writes an
      // error_log row named for this function, and that row is the only difference between "the
      // guard held" and "it threw and nobody saw".
      assert.ok(
        tags.length > 0,
        'precondition: tagging ran at all for an unmapped contractor'
      );
      assert.ok(
        tags.includes('paying_client'),
        'precondition: the paid invoice produced its own tag: ' + tags.join(', ')
      );
      // ⚠ NOT SCOPED BY CONTRACTOR, AND THAT IS A FINDING RATHER THAN A SHORTCUT. The swallow calls
      // `logError({ req: null, error: err, source: ... })` with NO contractorId, so the row lands
      // with `contractor_id` NULL — invisible to every tenant-scoped query, including this suite's
      // own reset and any per-contractor error aggregate. **The one trace of a defect that stops
      // all tagging cannot be found by asking about the affected contractor.** Filed on
      // PRE_LAUNCH_CHECKLIST.md; this case works around it by matching on the source alone.
      const swallowed = (await pool.query(
        `SELECT source FROM error_log WHERE source LIKE 'deriveAndSaveTags%'`)).rows;
      assert.deepEqual(
        swallowed.map((r) => r.source), [],
        'the tag deriver must not have thrown — an error_log row here is the swallowed TypeError, '
        + 'and in production it is the ONLY trace that every later tag group stopped being written'
      );
      // And no category tag, because no category field is mapped — the truthful absence.
      assert.deepEqual(
        tags.filter((t) => t.startsWith('work_category:')), [],
        'no mapping means no category tag, which is the honest outcome rather than a guess'
      );
    });

  it('the four OTHER tag labels keep their fallbacks — the ruling is about the category only', () => {
    const tags = stripComments(read('utils/deriveJobberTags.js'));
    for (const [key, fallback] of [
      ['material_type', 'Material Type'],
      ['assigned_rep', 'Sales Representative'],
      ['job_source', 'Source'],
      ['insurance_company', 'Insurance Company'],
    ]) {
      assert.ok(
        new RegExp(`mappedLabel\\('${key}',\\s*'${fallback}'\\)`).test(tags),
        `${key} must keep its fallback — a material or insurance tag pays nobody, and changing it `
        + 'would be scope this ruling does not cover'
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('7c-3 — the column list, the route, and the tenancy guard', () => {
  it('the column exists, is NULLABLE and has NO default', async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_name = 'contractor_settings' AND column_name = 'default_schedule_id'`);
    assert.equal(rows.length, 1, 'the column must exist in the LIVE schema, not only in db.js');
    assert.equal(rows[0].is_nullable, 'YES', 'NULL is "No bonus"');
    assert.equal(
      rows[0].column_default, null,
      'a DEFAULT would be the platform choosing a schedule, which the ruling forbids'
    );
  });

  it('the FK exists with ON DELETE SET NULL', async () => {
    const { rows } = await pool.query(
      `SELECT confdeltype FROM pg_constraint
        WHERE conname = 'contractor_settings_default_schedule_fk'`);
    assert.equal(rows.length, 1, 'the FK must exist');
    assert.equal(rows[0].confdeltype, 'n',
      "'n' is SET NULL — deleting the default must revert to No bonus, never dangle");
  });

  it('THE READER AND THE ENGINE SELECT THE SAME SCHEDULE COLUMNS', () => {
    // ⚠ A COLUMN SELECTED BY ONE AND NOT THE OTHER WOULD READ AS NULL ON THE DEFAULT PATH ONLY —
    // this repo's most-recorded defect, a reader reading a field no query selects, confined to a
    // branch nobody exercises until a contractor sets a default.
    const engine = stripComments(read('referralRules.js'));
    const m = /SELECT s\.id, s\.name([\s\S]*?)FROM referral_schedules/.exec(engine);
    assert.ok(m, 'harness: the engine’s schedule SELECT must still be findable');
    const engineCols = ('s.id, s.name' + m[1])
      .split(',').map((c) => c.trim()).filter((c) => /^s\.[a-z_]+$/.test(c))
      .map((c) => c.replace('s.', ''));
    assert.ok(engineCols.length >= 10, `harness: parsed too few columns (${engineCols.length})`);
    const missing = engineCols.filter((c) => !SCHEDULE_COLUMNS.includes(c));
    assert.deepEqual(
      missing, [],
      'the engine selects schedule columns the default reader does not: ' + missing.join(', ')
    );
  });

  it('the PATCH route verifies OWNERSHIP, which the FK does not', () => {
    const src = stripComments(read('routes/admin/campaigns.js'));
    const i = src.indexOf("'/api/admin/schedules/default'");
    assert.ok(i > 0, 'the route must exist');
    const body = src.slice(i, i + 2200);
    assert.ok(
      /FROM referral_schedules WHERE id = \$1 AND contractor_id = \$2/.test(body),
      'the schedule must be proven to belong to the caller before it is stored — the FK constrains '
      + 'existence, not tenancy, so without this a cross-tenant id decides this tenant’s payouts'
    );
    assert.ok(/is_active = true/.test(body), 'and it must be active');
    assert.ok(
      /hasOwnProperty\.call\(req\.body/.test(body),
      'null is a legitimate value ("No bonus"), so the KEY must be required rather than the value'
    );
  });

  it('the route is gated on finance_settings.manage, like its schedule siblings', () => {
    const src = stripComments(read('routes/admin/campaigns.js'));
    const i = src.indexOf("'/api/admin/schedules/default'");
    const head = src.slice(i, i + 220);
    assert.ok(
      /requirePermission\('finance_settings\.manage'\)/.test(head),
      'the default decides money; it needs the same permission as the writes beside it'
    );
  });

  it('no PATCH on /api/admin/schedules/:id could swallow the literal "default"', () => {
    // ⚠ A ROUTE-ORDERING HAZARD WORTH PINNING RATHER THAN NOTICING LATER. Today the only other
    // PATCH is `/:id/toggle`, whose shape cannot collide. If a bare `PATCH /:id` is ever added
    // above this one, "default" would parse as an id and this control would stop working.
    const src = stripComments(read('routes/admin/campaigns.js'));
    assert.ok(
      !/router\.patch\('\/api\/admin\/schedules\/:id'/.test(src),
      'a bare PATCH /:id would capture the /default path — register it AFTER, or rename the path'
    );
  });
});
