'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE FULL-CAPTURE MARKER — "decide only from COMPLETE history" (Danny, 2026-10-01)
//
// ⚠ THE PREVIEW THAT FORCED THIS RULING IS THE REASON TO READ THE FILE. The catch-up job's first
// selector was "any fact is newer than the decision". Measured against production that would have
// moved 364 clients on its first run, **354 BACKWARDS and 353 off 'paid'**. Sampled against Jobber
// live, 21 of those split **14 DATA GAP / 2 BOTH WRONG / 5 REAL CORRECTION** — i.e. mostly clients
// whose stored 'paid' was RIGHT and whose stored FACTS were short, because `repImportScope.js`
// captures only the rep WINDOW, per entity.
//
// ⚠ A RATCHET WAS REJECTED. Refusing downward writes would also block the 5 genuine corrections and
// contradicts the ruling that reps always see the TRUE stage. The defect is deciding from missing
// data, so the guard belongs upstream of the decision.
//
// ⚠ THE WRITER CANNOT KNOW WHETHER A FETCH WAS EXHAUSTIVE, SO THE FETCHER CERTIFIES IT, and the
// certification is honest for a structural reason: `pageClientConnection` THROWS rather than returning
// a short set, so reaching either fetcher's `return` proves all four connections drained.
//
// ⚠ IT IS A SYMBOL SO THAT JSON CANNOT FORGE IT. A webhook body is parsed from JSON; a client object
// reconstructed that way can never carry the mark. Cases below pin both that and the spread case,
// because both are how a certification would silently leak to partial data.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const {
  certifyFullyPaged, isCertifiedFullyPaged,
} = require('../utils/captureCompleteness');
const { captureClientFacts, writeJobFacts, writeInvoiceFacts } = require('../utils/factCapture');
const { selectStaleClients } = require('../jobs/redecideStaleClients');
const { isDerivableJobberClientId } = require('../utils/derivableClient');
const { fetchFullClient } = require('../utils/jobberClientFetch');
const cronJob = require('../cron/jobs/redecideStaleClients');

const TENANT = 'marker-tenant';
// Real Jobber EncodedIds — the decode is asserted, so these cases ENTER the gated branches.
const CLIENT   = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85MDAxMDAwMQ==';
const CLIENT_B = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85MDAxMDAwMg==';
const UNSEEN   = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85MDAxMDAwMw==';
const JOB      = 'Z2lkOi8vSm9iYmVyL0pvYi83NTAwMDE=';
const INVOICE  = 'Z2lkOi8vSm9iYmVyL0ludm9pY2UvODUwMDAx';

const SERVER_ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8');
/** Line-preserving comment strip, so a finding's line number stays true. */
const stripComments = (src) => src.split('\n')
  .map((line) => {
    const i = line.indexOf('//');
    return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
  }).join('\n');

let pool;
let realAxiosPost;

const addClient = (id, { stage = null, derivedAt = null, fullCaptureAt = null } = {}) => pool.query(
  `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage,
     stage_derived_at, last_full_capture_at)
   VALUES ($1, $2, 'Marker', $3, $4, $5)`, [id, TENANT, stage, derivedAt, fullCaptureAt]);

const markerOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT last_full_capture_at FROM jobber_clients
      WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, id]);
  return rows[0] ? rows[0].last_full_capture_at : undefined;
};

/** The connection-shaped client object a full fetch produces. NOT certified unless asked. */
const clientShape = (id) => ({
  id, isCompany: false, isLead: false, isArchived: false,
  quotes: { nodes: [] },
  requests: { nodes: [] },
  jobs: { nodes: [{ id: JOB, jobStatus: 'active', client: { id }, createdAt: new Date().toISOString(), customFields: [] }] },
  invoices: { nodes: [] },
  tags: { nodes: [] }, customFields: [],
});

let seededLockRows;
before(async () => {
  pool = await initTestDb();
  realAxiosPost = axios.post;
  // ⚠ READ IN before(), NOT IN THE CASE, AND THAT IS THE 6c FENCE BEING OBEYED RATHER THAN
  // WORKED AROUND. `cron_job_locks` is seeded by initDB and shared by every suite; clearing it in a
  // beforeEach — which is what the fence's message literally prescribes — would break `withLock`
  // for everything else. The fence deliberately excludes before()/after() because a table seeded as
  // the suite's BASELINE belongs there, and this is a read of exactly that: a schema/seed fact, not
  // per-test state. `KNOWN_GAPS` was NOT widened.
  const { rows } = await pool.query(
    `SELECT job_name FROM cron_job_locks WHERE job_name = $1`, [cronJob.LOCK_NAME]);
  seededLockRows = rows.length;
});
after(async () => { axios.post = realAxiosPost; await pool.end(); });

beforeEach(async () => {
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'crm_custom_field_facts', 'category_mismatches',
    'pipeline_cache', 'jobber_clients', 'error_log',
  ]) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]).catch(async () => {
      await pool.query(`DELETE FROM ${t}`);
    });
  }
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  axios.post = async () => { throw new Error('harness: no Jobber call unless a case installs one'); };
});

describe('the certification itself', () => {
  it('the fixture ids are real Jobber EncodedIds, so these cases ENTER the gated branches', () => {
    assert.equal(Buffer.from(CLIENT, 'base64').toString('utf8'), 'gid://Jobber/Client/90010001');
    assert.equal(isDerivableJobberClientId(CLIENT), true);
    assert.equal(isDerivableJobberClientId(UNSEEN), true);
  });

  it('certifies, and reads back as certified', () => {
    const c = certifyFullyPaged(clientShape(CLIENT));
    assert.equal(isCertifiedFullyPaged(c), true);
  });

  it('an UNCERTIFIED object reads as not certified — the default, and the safe one', () => {
    assert.equal(isCertifiedFullyPaged(clientShape(CLIENT)), false);
    assert.equal(isCertifiedFullyPaged(null), false);
    assert.equal(isCertifiedFullyPaged(undefined), false);
    assert.equal(isCertifiedFullyPaged('a string'), false);
    assert.equal(isCertifiedFullyPaged({}), false);
  });

  it('⚠ JSON CANNOT FORGE IT — a round-tripped object loses the certification', () => {
    // A webhook body arrives as JSON. If the mark survived serialisation, an untrusted partial payload
    // could claim completeness, which is the one thing this mechanism must make impossible.
    const c = certifyFullyPaged(clientShape(CLIENT));
    const roundTripped = JSON.parse(JSON.stringify(c));
    assert.equal(isCertifiedFullyPaged(roundTripped), false);
    // And a hand-written property of a plausible name does not satisfy it either.
    assert.equal(isCertifiedFullyPaged({ ...clientShape(CLIENT), fullyPaged: true }), false);
  });

  it('⚠ A SPREAD LOSES IT, which FAILS CLOSED rather than open', () => {
    // Non-enumerable, so `{ ...client }` drops it. The consequence is that a caller which rebuilds the
    // object is simply not eligible for the catch-up — never that partial data is certified.
    const c = certifyFullyPaged(clientShape(CLIENT));
    assert.equal(isCertifiedFullyPaged({ ...c }), false);
  });
});

describe('the stamp — captureClientFacts', () => {
  it('a CERTIFIED capture stamps last_full_capture_at', async () => {
    await addClient(CLIENT);
    assert.equal(await markerOf(CLIENT), null, 'precondition: unmarked');

    const out = await captureClientFacts(pool, { contractorId: TENANT, client: certifyFullyPaged(clientShape(CLIENT)) });

    assert.equal(out.fullCaptureStamped, 1);
    assert.ok((await markerOf(CLIENT)) instanceof Date);
  });

  it('⚠ AN UNCERTIFIED capture writes the FACTS and stamps NOTHING', async () => {
    // The load-bearing case. Facts land; completeness is not claimed. That is exactly the state
    // `repImportScope` leaves a client in, and the state the catch-up must refuse to decide from.
    await addClient(CLIENT);

    const out = await captureClientFacts(pool, { contractorId: TENANT, client: clientShape(CLIENT) });

    assert.equal(out.fullCaptureStamped, 0, 'no stamp');
    assert.equal(await markerOf(CLIENT), null);
    const { rows } = await pool.query(
      `SELECT jobber_job_id FROM crm_job_facts WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, CLIENT]);
    assert.equal(rows.length, 1, 'but the facts ARE written — this is not a refusal to capture');
  });

  it('UPDATE-ONLY: a client with no identity row yet is not stamped, and no row is created', async () => {
    // ⚠ STATED RATHER THAN HIDDEN. A brand-new client is captured BEFORE its jobber_clients row exists
    // (the webhook's identity upsert runs after both capture and decision), so the first full capture
    // stamps 0 rows and the client becomes eligible only at its next one. Creating a row here would
    // give referredCaptureBackfill an identity side effect it deliberately does not have.
    const out = await captureClientFacts(pool, { contractorId: TENANT, client: certifyFullyPaged(clientShape(UNSEEN)) });

    assert.equal(out.fullCaptureStamped, 0);
    assert.equal(await markerOf(UNSEEN), undefined, 'and NO identity row was invented');
  });

  it('the stamp is scoped to one contractor', async () => {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ('marker-other','o','active')
                      ON CONFLICT DO NOTHING`);
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name)
       VALUES ($1, 'marker-other', 'Other')`, [CLIENT]);
    await addClient(CLIENT);

    await captureClientFacts(pool, { contractorId: TENANT, client: certifyFullyPaged(clientShape(CLIENT)) });

    const { rows } = await pool.query(
      `SELECT last_full_capture_at FROM jobber_clients
        WHERE contractor_id = 'marker-other' AND jobber_client_id = $1`, [CLIENT]);
    assert.equal(rows[0].last_full_capture_at, null, "the other tenant's row is untouched");
    await pool.query(`DELETE FROM jobber_clients WHERE contractor_id = 'marker-other'`);
    await pool.query(`DELETE FROM contractors WHERE id = 'marker-other'`);
  });

  it('⚠ THE PARTIAL WRITERS CANNOT STAMP, driven behaviourally rather than asserted', async () => {
    // repImportScope calls these directly, per entity, over a time window. It never reaches
    // captureClientFacts, so there is no path by which it could stamp — proven by calling the same
    // writers the import calls and observing the marker stay null.
    await addClient(CLIENT);
    const jobs = await writeJobFacts(pool, TENANT,
      [{ id: JOB, jobStatus: 'active', client: { id: CLIENT }, createdAt: new Date().toISOString() }]);
    const invoices = await writeInvoiceFacts(pool, TENANT,
      [{ id: INVOICE, invoiceStatus: 'paid', client: { id: CLIENT }, total: 100, invoiceBalance: 0 }]);

    assert.ok(jobs >= 1 && invoices >= 1, 'precondition: the partial writers really wrote facts');
    assert.equal(await markerOf(CLIENT), null, 'and stamped nothing');
  });
});

describe('the fetchers certify, and only when exhaustion is proven', () => {
  it('the REAL fetchFullClient returns a CERTIFIED object', async () => {
    // ⚠ THE BOUNDARY TEST. A unit assertion on certifyFullyPaged cannot discover that the fetcher
    // forgot to call it — the shape of defect this repo has recorded repeatedly (a writer reading a
    // field no query selects). So this drives the real function over a stubbed transport.
    axios.post = async () => ({
      data: { data: { client: {
        id: CLIENT, isCompany: false, isLead: false, isArchived: false,
        quotes: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        jobs: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        invoices: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        requests: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      } } },
    });

    const client = await fetchFullClient(CLIENT, 'token', { door: 'marker-test', contractorId: TENANT });

    assert.equal(client.id, CLIENT);
    assert.equal(isCertifiedFullyPaged(client), true, 'the fetcher must certify its own return');
  });

  it('⚠ A CAPTURE CUT SHORT CERTIFIES NOTHING — a page reporting more with no cursor THROWS', async () => {
    // The certification is only honest because the fetcher cannot return a short set. A page that says
    // hasNextPage with no endCursor is the anomaly pageClientConnection refuses; the fetcher raises and
    // no object exists to be certified, let alone stamped.
    axios.post = async () => ({
      data: { data: { client: {
        id: CLIENT, isCompany: false, isLead: false, isArchived: false,
        quotes: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
        jobs: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        invoices: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        requests: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      } } },
    });

    await assert.rejects(
      () => fetchFullClient(CLIENT, 'token', { door: 'marker-test', contractorId: TENANT }),
      /hasNextPage with no endCursor/,
      'a truncated connection must raise rather than return a short set'
    );
  });

  it('⚠ A GraphQL ERROR RESPONSE CERTIFIES NOTHING EITHER', async () => {
    axios.post = async () => ({ data: { errors: [{ message: 'boom' }] } });
    await assert.rejects(
      () => fetchFullClient(CLIENT, 'token', { door: 'marker-test', contractorId: TENANT }),
      /boom|GraphQL/i
    );
  });

  it('SOURCE: both fetchers certify AT THE RETURN, and nothing else calls certifyFullyPaged', () => {
    // ⚠ POSITION MATTERS, not merely presence. Certifying earlier would vouch for a set that had not
    // finished paging, which is the one failure the mechanism cannot detect for itself.
    const fetchSrc = stripComments(read('utils/jobberClientFetch.js'));
    assert.match(fetchSrc, /return certifyFullyPaged\(\{/, 'fetchFullClient certifies at its return');
    const whSrc = stripComments(read('routes/webhooks/jobber.js'));
    assert.match(whSrc, /return certifyFullyPaged\(\{/, 'fetchClientRelatedData certifies at its return');

    // The import path must never certify. Named explicitly, because this is the writer the measured
    // partial data came from.
    const importSrc = stripComments(read('jobs/repImportScope.js'));
    assert.ok(!/certifyFullyPaged/.test(importSrc),
      'repImportScope must never certify — it captures only the rep window, per entity');
    assert.ok(!/captureClientFacts/.test(importSrc),
      'nor reach captureClientFacts, which is the only place the stamp lives');
  });

  it('SOURCE: the stamp is gated on the certification, and lives in exactly one place', () => {
    const capSrc = stripComments(read('utils/factCapture.js'));
    assert.match(capSrc, /isCertifiedFullyPaged\(client\)/, 'the stamp is gated on certification');
    const stamps = capSrc.match(/last_full_capture_at\s*=\s*NOW\(\)/g) || [];
    assert.equal(stamps.length, 1, 'exactly one writer of the marker');

    // ⚠ AND NO OTHER server/ FILE MAY WRITE IT. A second writer could stamp without the certification,
    // which would reopen the whole defect. Derived by walking server/, never from a typed list.
    const walk = (dir, out = []) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'test' || e.name === 'node_modules') continue;
          walk(full, out);
        } else if (e.name.endsWith('.js')) out.push(full);
      }
      return out;
    };
    const offenders = [];
    for (const file of walk(SERVER_ROOT)) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      // db.js legitimately CREATEs the column; only an assignment is a write.
      if (/SET\s+last_full_capture_at/i.test(src) && !file.endsWith(path.join('utils', 'factCapture.js'))) {
        offenders.push(path.relative(SERVER_ROOT, file));
      }
    }
    assert.deepEqual(offenders, [], 'only factCapture.js may stamp the marker');
    // Non-vacuity: the walk must actually reach the one file that does.
    assert.ok(walk(SERVER_ROOT).some((f) => f.endsWith(path.join('utils', 'factCapture.js'))),
      'harness: the walk must reach factCapture.js, or this check read nothing');
  });
});

describe('the catch-up cron', () => {
  it('its lock row is seeded, so withLock can ever acquire it', () => {
    assert.equal(seededLockRows, 1, 'a cron whose lock row is absent never runs, silently');
  });

  it('⚠ THE EXPIRY IS UNDER THE TICK, which is the pipeline_sync precedent', () => {
    // An expiry LONGER than the interval lets a second run start while the first holds the lock; an
    // expiry shorter means a crashed holder self-heals on the very next tick. 25 < 30.
    assert.equal(cronJob.LOCK_EXPIRY_MINUTES, 25);
    const src = stripComments(read('cron/jobs/redecideStaleClients.js'));
    assert.match(src, /cron\.schedule\('10,40 \* \* \* \*'/, 'every 30 minutes');
    assert.ok(cronJob.LOCK_EXPIRY_MINUTES < 30, 'the expiry must be under the interval');
  });

  it('the per-run limit is 200, and it is passed to the job rather than left to the default', () => {
    assert.equal(cronJob.PER_RUN_LIMIT, 200);
    const src = stripComments(read('cron/jobs/redecideStaleClients.js'));
    assert.match(src, /limit: PER_RUN_LIMIT/, 'the cron must pass its own limit');
  });

  it('⚠ NO JOBBER CALL — neither the cron nor the job it runs may reach Jobber', () => {
    // Fenced rather than promised: this is what makes a 30-minute cadence affordable, and the whole
    // ruling rests on the job reading SAVED facts only.
    const needles = ['axios', 'fetchFullClient', 'fetchClientRelatedData', 'capturePost',
      'getContractorAccessToken', 'getFreshContractorAccessToken'];
    for (const rel of ['cron/jobs/redecideStaleClients.js', 'jobs/redecideStaleClients.js']) {
      const src = stripComments(read(rel));
      for (const n of needles) {
        assert.ok(!src.includes(n), `${rel} must not reference ${n}`);
      }
    }
    // Non-vacuity in BOTH directions: the needles must be able to match something real.
    const sweep = stripComments(read('cron/jobs/repRequestSweep.js'));
    assert.ok(sweep.includes('fetchFullClient'),
      'harness: the needle must match a file that DOES fetch, or it proves nothing');
  });

  it('it is REGISTERED in the cron index, or it never runs', () => {
    const src = stripComments(read('cron/index.js'));
    assert.match(src, /startRedecideStaleClientsJob/, 'imported and called');
    assert.equal((src.match(/startRedecideStaleClientsJob\(\)/g) || []).length, 1, 'called exactly once');
  });

  it('a failure ALERTS — a quiet catch-up is indistinguishable from one with nothing to do', () => {
    const src = stripComments(read('cron/jobs/redecideStaleClients.js'));
    const alerts = src.match(/alert:\s*true/g) || [];
    assert.ok(alerts.length >= 2, 'both the per-client summary and the contractor-level catch alert');
  });
});

describe('the selector, end to end with the stamp', () => {
  it('a client becomes eligible ONLY after a certified capture stamps it', async () => {
    await addClient(CLIENT, { stage: 'paid', derivedAt: null });

    const before = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(before.candidates, [], 'not eligible while unmarked');
    assert.equal(before.skippedPartial, 1, 'and counted as skipped');

    await captureClientFacts(pool, { contractorId: TENANT, client: certifyFullyPaged(clientShape(CLIENT)) });

    const after = await selectStaleClients(pool, { contractorId: TENANT });
    assert.equal(after.candidates.length, 1, 'eligible once its history is certified complete');
    assert.equal(after.candidates[0].jobberClientId, CLIENT);
    assert.equal(after.skippedPartial, 0);
  });

  it('skippedPartial counts every unmarked client, not just the one under test', async () => {
    await addClient(CLIENT);
    await addClient(CLIENT_B);
    const { candidates, skippedPartial } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(candidates, []);
    assert.equal(skippedPartial, 2);
  });
});
