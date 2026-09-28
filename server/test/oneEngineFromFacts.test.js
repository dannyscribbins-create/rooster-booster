'use strict';

// ── ONE ENGINE, FROM SAVED FACTS (3d Phase 1a Commit 7b) ─────────────────────
//
// R5i: live and replay choose the rep from the SAME saved facts using the SAME code. Commits 4
// and 5 moved the QUOTE half and `currentStatus` onto facts; the REQUEST half — which is what
// Mode A and Mode B actually decide the rep on — stayed on a live Jobber fetch until 7b. This
// file pins what that change is for.
//
// ⚠ THE FOUR PROPERTIES, AND EACH ONE IS HERE BECAUSE A GUARD-PROOF SHOWED SOMETHING ELSE COULD
// NOT SEE IT:
//   1. ORDERING — equal createdAt resolves to the higher NUMERIC id inside the Jobber gid. The
//      live path never implemented this; only the replay did.
//   2. PARITY — a live door, the replay and the 7c preview reach the same assignment from one
//      set of rows.
//   3. NO LIVE FETCH — structurally, by reading the production source.
//   4. TRUNCATION — reaches the live doors for the first time, because the live query never
//      selected pageInfo.
//
// ⚠ ONE POOL PER FILE, NOT PER describe. initTestDb() returns the server/db.js pool SINGLETON, so
// a per-describe pool.end() kills the pool the next describe is about to use — which surfaces as
// CANCELLED tests during setup, under a green-looking `fail 0`.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { seedContractor } = require('./helpers');
const { requestsFromFacts, makeRequestReader, jobberIdNumber } = require('../utils/requestFacts');
const { runAttributionEngine } = require('../utils/attributionEngine');
const { replayClientAttribution } = require('../utils/attributionReplay');
const { decideFromFacts } = require('../utils/attributionDecide');
const { captureClientFacts } = require('../utils/factCapture');
const { withClientLock } = require('../utils/clientLock');

const CID = 'one-engine-tenant';
const OTHER = 'one-engine-other';

// Real Jobber gid shapes. ⚠ THE NUMBERS ARE CHOSEN SO TEXT ORDER AND NUMERIC ORDER DISAGREE:
// 341664448 > 99999999 numerically, but their base64 encodings compare the other way. That is
// the case the tie-break exists for, and it is the common shape in real data rather than a
// contrived one — 9- and 8-digit request ids are neighbours on Accent's account.
const gid = (n) => Buffer.from(`gid://Jobber/Request/${n}`, 'utf8').toString('base64');
const REQ_HIGH = gid(341664448);
const REQ_LOW = gid(99999999);

let pool;

async function seedRep(contractorId, jobberUserId, email) {
  const { rows } = await pool.query(
    `INSERT INTO team_members
       (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, jobber_user_id, full_name)
     VALUES ($1, $2, 'hash', 'member', true, true, $3, $4) RETURNING id`,
    [contractorId, email, jobberUserId, `Rep ${jobberUserId}`]
  );
  return rows[0].id;
}

// One request fact, written the way a capture would write it.
async function seedRequestFact(contractorId, {
  requestId, jobberClientId, createdAt, salesperson = null, assessmentId = null,
  assignedUsers = [], truncated = false,
}) {
  await pool.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at,
        salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids, assigned_users_truncated)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [contractorId, requestId, jobberClientId, createdAt, salesperson, assessmentId,
     JSON.stringify(assignedUsers), truncated]
  );
}

// A client that classifies 'sold' from facts — a job with no paid invoice. 'sold' is NOT in the
// engine's GATE_EXCLUSIONS, so the sticky gate fires, which is the only branch on which a rep is
// actually chosen. A 'lead' client would take the provisional branch and prove far less.
async function seedSoldClient(contractorId, jobberClientId) {
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ($1, $2, 'Facts', NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`,
    [jobberClientId, contractorId]
  );
  await pool.query(
    `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [contractorId, `${jobberClientId}-job`, jobberClientId]
  );
}

const assignmentsFor = async (contractorId, jobberClientId) => {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, provisional_rep_id, provisional_source, written_by
       FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId]
  );
  return rows[0] || null;
};

// The tables every case here touches, cleared between cases.
// The 6c reset-coverage fence reads this list, so a table added to a case must be added here.
const RESET_TABLES = ['crm_request_facts', 'crm_quote_facts', 'crm_job_facts', 'crm_invoice_facts',
  'crm_invoice_job_links', 'client_rep_assignments', 'flagged_assignments', 'admin_messages',
  'pipeline_cache', 'jobber_clients', 'team_members', 'contractor_crm_settings'];

// ⚠ FILE-LEVEL, NOT PER describe, AND THIS FILE HAS TWO. initTestDb() returns the server/db.js
// pool SINGLETON, so a per-describe pool.end() would kill the pool the second describe is about
// to use — which surfaces as CANCELLED tests during setup, under a green-looking `fail 0`.
before(async () => {
  pool = await initTestDb();
  await seedContractor(pool, CID);
  await seedContractor(pool, OTHER);
});

after(async () => {
  await pool.end();
});

beforeEach(async () => {
  for (const t of RESET_TABLES) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1 OR contractor_id = $2`, [CID, OTHER]);
  }
});

describe('7b — the fact-backed request reader and its ruled order', () => {

  it('returns requests NEWEST FIRST, which is the order eligible[0] depends on', async () => {
    const C = 'order-1';
    await seedRequestFact(CID, { requestId: 'r-old', jobberClientId: C, createdAt: '2026-09-01T00:00:00Z' });
    await seedRequestFact(CID, { requestId: 'r-new', jobberClientId: C, createdAt: '2026-09-20T00:00:00Z' });
    await seedRequestFact(CID, { requestId: 'r-mid', jobberClientId: C, createdAt: '2026-09-10T00:00:00Z' });

    const requests = await requestsFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.deepEqual(requests.map((r) => r.id), ['r-new', 'r-mid', 'r-old']);
  });

  it('⚠ THE TIE-BREAK: equal createdAt resolves to the HIGHER NUMERIC id, not the higher text', async () => {
    // ⚠ THE PAIRED PROOF THAT TEXT ORDER WOULD GET THIS WRONG, ASSERTED RATHER THAN CLAIMED. If
    // the two encodings happened to sort the same way both ways, this case would pass against a
    // plain string comparator and prove nothing — which is a fixture vacuity, not a test failure.
    assert.ok(REQ_LOW > REQ_HIGH,
      'fixture precondition: the LOWER-numbered request must sort HIGHER as text, or this case cannot discriminate');
    assert.ok(jobberIdNumber(REQ_HIGH) > jobberIdNumber(REQ_LOW), 'and numerically the other way');

    const C = 'tie-1';
    const SAME = '2026-09-18T15:41:20Z';
    await seedRequestFact(CID, { requestId: REQ_LOW, jobberClientId: C, createdAt: SAME });
    await seedRequestFact(CID, { requestId: REQ_HIGH, jobberClientId: C, createdAt: SAME });

    const requests = await requestsFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.equal(requests[0].id, REQ_HIGH,
      'the request Jobber created later — the higher numeric id — must be eligible[0]');
  });

  it('carries assigned_users_truncated through as assignedUsers.pageInfo.hasNextPage', async () => {
    const C = 'trunc-1';
    await seedRequestFact(CID, {
      requestId: 'r-t', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z',
      assessmentId: 'a-t', assignedUsers: ['ju-1'], truncated: true,
    });
    const [r] = await requestsFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.equal(r.assessment.assignedUsers.pageInfo.hasNextPage, true);
  });

  it('TENANCY — a request fact under another contractor is never returned', async () => {
    const C = 'tenant-1';
    await seedRequestFact(OTHER, { requestId: 'r-other', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z' });
    await seedRequestFact(CID, { requestId: 'r-mine', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z' });

    const requests = await requestsFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.deepEqual(requests.map((r) => r.id), ['r-mine']);
  });

  it('the reader makeRequestReader builds answers in the engine\'s { requests } shape', async () => {
    const C = 'shape-1';
    await seedRequestFact(CID, { requestId: 'r-s', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z' });
    const read = makeRequestReader(pool, CID);
    const out = await read(C);
    assert.ok(Array.isArray(out.requests) && out.requests.length === 1);
    assert.equal(out.requests[0].id, 'r-s');
  });

  // ── (iv) ORDERING, ON THE ENGINE ────────────────────────────────────────────
  it('⚠ (iv) ORDERING reaches the ENGINE: the higher-numeric-id request names the rep on a tie', async () => {
    // ⚠ THE READER'S ORDER IS ONLY INTERESTING IF THE ENGINE OBEYS IT. The case above proves the
    // list is ordered; this proves the ORDER DECIDES WHO GETS THE CLIENT, which is the thing the
    // ruling is actually about. Two requests at the same instant, each naming a DIFFERENT
    // attributable rep — so eligible[0] is the whole answer.
    const C = 'order-engine-1';
    const SAME = '2026-09-18T15:41:20Z';
    const winner = await seedRep(CID, 'ju-high', 'high@t.com');
    const loser = await seedRep(CID, 'ju-low', 'low@t.com');
    await seedSoldClient(CID, C);
    await seedRequestFact(CID, {
      requestId: REQ_LOW, jobberClientId: C, createdAt: SAME,
      assessmentId: 'a-low', assignedUsers: ['ju-low'],
    });
    await seedRequestFact(CID, {
      requestId: REQ_HIGH, jobberClientId: C, createdAt: SAME,
      assessmentId: 'a-high', assignedUsers: ['ju-high'],
    });

    const decided = await decideFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.equal(decided.currentStatus, 'sold', 'precondition: the sticky gate must fire');
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: C,
      currentStatus: decided.currentStatus, client: decided.client,
      readRequests: makeRequestReader(pool, CID),
      referralAnchor: SAME, writeOrphanOnMiss: false,
    });

    const row = await assignmentsFor(CID, C);
    assert.ok(row, 'an assignment must be written');
    assert.equal(row.sticky_rep_id, winner, 'the higher numeric id wins the tie');
    assert.notEqual(row.sticky_rep_id, loser);
  });

  // ── (vi) NO JOBBER, STRUCTURALLY ────────────────────────────────────────────
  it('⚠ (vi) the ENGINE and the READER name no Jobber fetcher and no HTTP client', () => {
    // ⚠ THIS IS WHAT REPLACES runAttributionEngine'S ENTRY IN clientLock.test.js'S FORBIDDEN
    // LIST. The engine moved INSIDE the lock in 7b, so the locked-section fence can no longer
    // guard it by name; the property — no network call in there — is guarded HERE instead, by
    // reading the engine's own source. Dropped from one fence, picked up by another, never
    // dropped outright.
    // ⚠ AND IT IS A SOURCE READ, NOT A CALL-GRAPH WALK. It sees what these two files NAME. A
    // Jobber call added inside a helper they invoke is invisible to it — stated rather than
    // assumed, exactly as the locked-section fence states its own blind spot. Today neither file
    // requires anything from server/crm at all, which the last assertion pins.
    // ⚠ COMMENTS ARE STRIPPED FIRST, AND THE FIRST WRITING OF THIS CASE FAILED BECAUSE THEY WERE
    // NOT. Both files now carry comments explaining that the live fetcher was REMOVED, so the
    // fence reported three offenders — its own subject's prose describing the thing it forbids.
    // That is CLAUDE.md's scans-read-comments shape, and the resolution here is stripping rather
    // than exempting, because this fence's subject is a CALL: whether the engine INVOKES a
    // fetcher. The prose recording that it used to is exactly the text that must survive.
    const FILES = ['attributionEngine.js', 'requestFacts.js'].map(
      (f) => path.join(__dirname, '..', 'utils', f));
    // Assembled from pieces so this file is not its own offender.
    const FORBIDDEN = ['axios', 'fetch' + 'AttributionData', 'fetch' + 'FullClient',
      'capture' + 'Post', 'getjobber', 'graphql'];

    const offenders = [];
    let checked = 0;
    for (const file of FILES) {
      const raw = fs.readFileSync(file, 'utf8');
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, ' ');
      checked += 1;
      // ⚠ NON-VACUITY: stripping must not have eaten the file. A regex that removed everything
      // would make every assertion below pass against nothing, which is this whole family's
      // failure mode.
      assert.ok(src.includes('module.exports'),
        `${path.basename(file)}: comment stripping destroyed the source — the check would be vacuous`);
      for (const needle of FORBIDDEN) {
        if (src.toLowerCase().includes(needle.toLowerCase())) {
          offenders.push(`${path.basename(file)} names ${needle}`);
        }
      }
      assert.ok(!/require\(['"][.][.]\/crm\//.test(src),
        `${path.basename(file)} must not require anything from server/crm — that is the network layer`);
    }
    assert.equal(checked, 2, 'both files must actually have been read');
    assert.deepEqual(offenders, [],
      'the engine runs inside the per-client lock; a Jobber call in it holds a pooled connection '
      + `across the network: ${offenders.join(' | ')}`);
  });

  it('⚠ (i) NO LIVE DOOR passes a Jobber fetcher to the engine, and the live fetcher no longer exists', () => {
    // ⚠ TWO CLAIMS, AND THEY ARE DIFFERENT. (1) crm/jobber.js no longer EXPORTS a request
    // fetcher, so a door cannot reach for one by habit; (2) no door FILE names one. The first
    // alone would let a door write its own query inline; the second alone would let the export
    // sit there waiting to be used.
    const jobber = require('../crm/jobber');
    assert.equal(jobber.fetchAttributionData, undefined,
      'the live attribution fetcher was deleted in 7b and must not come back as an export');

    const DOORS = [
      path.join(__dirname, '..', 'utils', 'requestAttribution.js'),
      path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'),
      path.join(__dirname, '..', 'crm', 'pipelineSync.js'),
      path.join(__dirname, '..', 'cron', 'jobs', 'repRequestSweep.js'),
    ];
    const NEEDLE = 'fetch' + 'AttributionData';
    const offenders = [];
    let checked = 0;
    for (const file of DOORS) {
      const src = fs.readFileSync(file, 'utf8');
      checked += 1;
      // ⚠ COMMENTS ARE STRIPPED FIRST, AND THIS REPO HAS PAID TO LEARN WHY TWICE. Every one of
      // these files now carries a comment explaining that the live fetcher was REMOVED — prose
      // describing a forbidden pattern IS the pattern to a naive sweep, and exempting comments
      // outright would remove the sweep's reach into the text a future reader copies from. So
      // the code is checked and the prose is not.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, ' ');
      if (code.includes(NEEDLE)) offenders.push(path.basename(file));
    }
    assert.equal(checked, 4, 'all four doors must actually have been read');
    assert.deepEqual(offenders, [],
      `a live door still names the Jobber attribution fetcher in CODE: ${offenders.join(', ')}`);
  });

  // ── (ii) PARITY ─────────────────────────────────────────────────────────────
  it('⚠ (ii) PARITY — the engine-from-facts and the REPLAY reach the same rep from one set of rows', async () => {
    // The replay walks the same facts per stored request; both must name the same rep. ⚠ The
    // engine leg runs FIRST and writes a sticky, so the replay leg is then short-circuited by
    // existing-wins — which would make a second assertion on the row vacuous. The two legs are
    // therefore run on SEPARATE CLIENTS carrying IDENTICAL facts, and compared.
    const REP = await seedRep(CID, 'ju-parity', 'parity@t.com');
    const facts = (C) => ([
      { requestId: `${C}-r1`, jobberClientId: C, createdAt: '2026-09-10T00:00:00Z',
        assessmentId: `${C}-a1`, assignedUsers: ['ju-parity'] },
      { requestId: `${C}-r2`, jobberClientId: C, createdAt: '2026-09-18T00:00:00Z',
        assessmentId: `${C}-a2`, assignedUsers: ['ju-parity'] },
    ]);

    const LIVE = 'parity-live';
    const REPLAYED = 'parity-replay';
    for (const C of [LIVE, REPLAYED]) {
      await seedSoldClient(CID, C);
      for (const f of facts(C)) await seedRequestFact(CID, f);
    }

    // Leg 1 — the live door's computation: decide from facts, read requests from facts.
    const decided = await decideFromFacts(pool, { contractorId: CID, jobberClientId: LIVE });
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: LIVE,
      currentStatus: decided.currentStatus, client: decided.client,
      readRequests: makeRequestReader(pool, CID),
      referralAnchor: '2026-09-18T00:00:00Z', writeOrphanOnMiss: false,
    });

    // Leg 2 — the replay, over identical facts.
    await replayClientAttribution(pool, { contractorId: CID, jobberClientId: REPLAYED });

    const live = await assignmentsFor(CID, LIVE);
    const replayed = await assignmentsFor(CID, REPLAYED);
    assert.ok(live && live.sticky_rep_id === REP, 'the live leg must assign the rep');
    assert.ok(replayed && replayed.sticky_rep_id === REP, 'the replay leg must assign the same rep');
    assert.equal(live.sticky_source, replayed.sticky_source,
      'and by the same route — a differing source means the two legs took different branches');
  });

  // ⚠ A GUARD-PROOF FOR THIS PAIR WAS INVALID ON ITS FIRST WRITING AND READ GREEN, WHICH IS THE
  // ENTRY WORTH KEEPING. The narrow injection — corrupt ONLY the replay leg's referralAnchor —
  // was first written as `new Date(0)`, the epoch. That does not break the anchor; it makes the
  // eligibility cutoff 1970, so EVERY request is in-grace and the replay reaches the same rep by
  // a wider route. Green, and it reads exactly like a fence that does not fire. Pointed a YEAR
  // INTO THE FUTURE instead — so nothing is eligible — it reds exactly these two cases.
  // ⚠ THE LESSON IS THE DIRECTION, NOT THE VALUE: an injection that makes a window PERMISSIVE
  // tests nothing, because the correct answer is still reachable. It must make the answer
  // UNREACHABLE.
  it('⚠ (ii) PARITY, THE DISCRIMINATOR — breaking ONE side\'s input makes the two disagree', async () => {
    // ⚠ WITHOUT THIS THE CASE ABOVE PASSES AGAINST TWO LEGS THAT AGREE BY COINCIDENCE. Two
    // clients with the same facts reaching the same rep is also what a build that always picked
    // the only mapped rep would produce. Here the two clients' facts DIFFER — one names a rep the
    // other does not — so agreement would be the bug and disagreement is the proof that each leg
    // actually read its own client's rows.
    const repA = await seedRep(CID, 'ju-a', 'a@t.com');
    const repB = await seedRep(CID, 'ju-b', 'b@t.com');
    const A = 'disc-a';
    const B = 'disc-b';
    await seedSoldClient(CID, A);
    await seedSoldClient(CID, B);
    await seedRequestFact(CID, { requestId: 'disc-ra', jobberClientId: A, createdAt: '2026-09-18T00:00:00Z',
      assessmentId: 'disc-aa', assignedUsers: ['ju-a'] });
    await seedRequestFact(CID, { requestId: 'disc-rb', jobberClientId: B, createdAt: '2026-09-18T00:00:00Z',
      assessmentId: 'disc-ab', assignedUsers: ['ju-b'] });

    await replayClientAttribution(pool, { contractorId: CID, jobberClientId: A });
    const decidedB = await decideFromFacts(pool, { contractorId: CID, jobberClientId: B });
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: B,
      currentStatus: decidedB.currentStatus, client: decidedB.client,
      readRequests: makeRequestReader(pool, CID),
      referralAnchor: '2026-09-18T00:00:00Z', writeOrphanOnMiss: false,
    });

    assert.equal((await assignmentsFor(CID, A)).sticky_rep_id, repA);
    assert.equal((await assignmentsFor(CID, B)).sticky_rep_id, repB);
    assert.notEqual(repA, repB, 'fixture precondition: the two reps must differ');
  });

  // ── TRUNCATION REACHES THE LIVE PATH ────────────────────────────────────────
  it('⚠ a TRUNCATED assessment FLAGS instead of assigning — which the live path could never do before 7b', async () => {
    // ⚠ THE LIVE QUERY SELECTED NO pageInfo, SO hasNextPage WAS ALWAYS undefined AND THE 7a-2
    // BRANCH COULD NOT FIRE ON ANY LIVE DOOR. A six-person assessment with one mapped rep was
    // written as a single-match STICKY — existing-wins, uncorrectable by any later mapping, with
    // no flag and nothing to notice it by. Reading from facts is what gives the live doors the
    // column the capture query has always stored.
    const C = 'trunc-engine';
    await seedRep(CID, 'ju-trunc', 'trunc@t.com');
    await seedSoldClient(CID, C);
    await seedRequestFact(CID, {
      requestId: 'r-trunc', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z',
      assessmentId: 'a-trunc', assignedUsers: ['ju-trunc'], truncated: true,
    });

    const decided = await decideFromFacts(pool, { contractorId: CID, jobberClientId: C });
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: C,
      currentStatus: decided.currentStatus, client: decided.client,
      readRequests: makeRequestReader(pool, CID),
      referralAnchor: '2026-09-18T00:00:00Z', writeOrphanOnMiss: false,
    });

    assert.equal(await assignmentsFor(CID, C), null, 'a truncated assessment must NOT be assigned');
    const { rows: flags } = await pool.query(
      `SELECT flag_reason FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, C]);
    assert.equal(flags.length, 1, 'it must flag for a human instead');
    assert.equal(flags[0].flag_reason, 'rep_co_assignment');
  });

  it('⚠ ITS PAIRED POSITIVE — the SAME fixture assigns when the assignee list is complete', async () => {
    // Without this, the case above passes against a build that flags everything, or that cannot
    // assign at all. Identical rows; only `truncated` moves.
    const C = 'trunc-engine-ok';
    const rep = await seedRep(CID, 'ju-trunc-ok', 'truncok@t.com');
    await seedSoldClient(CID, C);
    await seedRequestFact(CID, {
      requestId: 'r-trunc-ok', jobberClientId: C, createdAt: '2026-09-18T00:00:00Z',
      assessmentId: 'a-trunc-ok', assignedUsers: ['ju-trunc-ok'], truncated: false,
    });

    const decided = await decideFromFacts(pool, { contractorId: CID, jobberClientId: C });
    await runAttributionEngine(pool, {
      contractorId: CID, jobberClientId: C,
      currentStatus: decided.currentStatus, client: decided.client,
      readRequests: makeRequestReader(pool, CID),
      referralAnchor: '2026-09-18T00:00:00Z', writeOrphanOnMiss: false,
    });

    assert.equal((await assignmentsFor(CID, C)).sticky_rep_id, rep);
    const { rows: flags } = await pool.query(
      `SELECT 1 FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, C]);
    assert.equal(flags.length, 0, 'a complete assignee list must not flag');
  });

  // ── (iii) THE LOST UPDATE ON THE ASSIGNMENT ─────────────────────────────────
  it('⚠ (iii) LOST UPDATE — a slow unit holding an OLDER answer cannot overwrite the PROVISIONAL', async () => {
    // ⚠ THE PROVISIONAL, NOT THE STICKY, AND THE FIRST WRITING OF THIS CASE HAD IT WRONG.
    // writeSticky carries `WHERE sticky_rep_id IS NULL`, so existing-wins ALREADY prevents a
    // second write from landing on a sticky — a lost-update case aimed at the sticky is
    // protected by a mechanism that has nothing to do with the lock, and would pass against the
    // engine sitting outside it. writeProvisional overwrites UNCONDITIONALLY. That is where the
    // defect actually bites, and it is the only half of the row this case can observe it on.
    //
    // ⚠ THE CLIENT IS A 'lead' ON PURPOSE. 'lead' is in the engine's GATE_EXCLUSIONS, so the
    // sticky gate is skipped entirely and the provisional step is the only branch that runs.
    const C = 'lost-update';
    const repSlow = await seedRep(CID, 'ju-slow', 'slow@t.com');
    const repFast = await seedRep(CID, 'ju-fast', 'fast@t.com');
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
       VALUES ($1, $2, 'Lost', NOW())`, [C, CID]);
    const RECENT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // The facts as they stand when the SLOW unit begins: they name the slow rep.
    await seedRequestFact(CID, {
      requestId: 'lu-r1', jobberClientId: C, createdAt: RECENT,
      assessmentId: 'lu-a1', assignedUsers: ['ju-slow'],
    });

    // One locked unit — capture, decide, assign — which is exactly the shape every door now
    // runs. The `stallMs` sits BETWEEN decide and assign, which is precisely the gap the engine
    // occupied when it ran outside the lock.
    const unit = async (label, extraFact, stallMs) => withClientLock(
      pool, { contractorId: CID, jobberClientId: C, door: `lu-${label}` },
      async (tx) => {
        if (extraFact) {
          await tx.query(
            `INSERT INTO crm_request_facts
               (contractor_id, jobber_request_id, jobber_client_id, created_at,
                salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids, assigned_users_truncated)
             VALUES ($1, $2, $3, $4, NULL, $5, $6::jsonb, false)
             ON CONFLICT (contractor_id, jobber_request_id) DO NOTHING`,
            [CID, extraFact.requestId, C, extraFact.createdAt, extraFact.assessmentId,
             JSON.stringify(extraFact.assignedUsers)]
          );
        }
        const d = await decideFromFacts(tx, { contractorId: CID, jobberClientId: C });
        assert.equal(d.currentStatus, 'lead', 'precondition: the provisional branch must be the one that runs');
        if (stallMs) await new Promise((r) => setTimeout(r, stallMs));
        await runAttributionEngine(tx, {
          contractorId: CID, jobberClientId: C,
          currentStatus: d.currentStatus, client: d.client,
          readRequests: makeRequestReader(tx, CID),
          referralAnchor: RECENT, writeOrphanOnMiss: false,
        });
      }
    );

    const newer = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await Promise.all([
      // The slow unit reads the facts as they are, stalls, then assigns.
      unit('slow', null, 300),
      // The fast unit brings a NEWER request naming a different rep.
      unit('fast', { requestId: 'lu-r2', createdAt: newer, assessmentId: 'lu-a2', assignedUsers: ['ju-fast'] }, 0),
    ]);

    const row = await assignmentsFor(CID, C);
    assert.ok(row, 'one of the two units must have written a provisional');

    // ⚠ THE DECISIVE ASSERTION: the stored rep must agree with the facts as they FINALLY stand.
    // lu-r2 is the newest request, so the newest eligible assignee is the fast rep, and any
    // unit that ran after lu-r2 landed must have reached that answer. The slow unit writing its
    // pre-lu-r2 answer on top is the lost update, and under the lock it cannot: whichever unit
    // holds the lock first completes capture-decide-assign atomically, and the second one
    // re-decides from the facts INCLUDING lu-r2.
    const requests = await requestsFromFacts(pool, { contractorId: CID, jobberClientId: C });
    assert.equal(requests[0].id, 'lu-r2', 'precondition: lu-r2 must be the newest request');
    assert.equal(row.provisional_rep_id, repFast,
      'the provisional must name the rep the FINAL fact set points at — a stale unit overwriting '
      + 'a newer answer is the lost update this lock exists to prevent');
    assert.notEqual(row.provisional_rep_id, repSlow);
  });

  it('⚠ (iii) STRUCTURAL — every live door calls runAttributionEngine INSIDE its withClientLock callback', () => {
    // ⚠ THIS FENCE EXISTS BECAUSE THE BEHAVIOURAL CASE ABOVE HAS A NAMED BLIND SPOT, AND SAYING
    // SO IS THE POINT. That case builds its own locked unit in order to control the stall
    // between decide and assign — a stall no test can inject into production code — so it proves
    // the LOCK serialises capture-decide-assign, and proves nothing about whether the DOORS put
    // the engine inside it. Moving runAttributionEngine back out in production would leave it
    // green. This reads the doors instead.
    // ⚠ IT IS A POSITION CHECK, NOT A CALL-GRAPH WALK: it requires the engine call to fall inside
    // the parenthesised extent of a withClientLock call in the same file. A door that called the
    // engine through a helper invoked from inside the lock would not be seen, which is the same
    // blind spot clientLock.test.js's locked-section fence states about itself.
    const DOORS = [
      path.join(__dirname, '..', 'utils', 'requestAttribution.js'),
      path.join(__dirname, '..', 'crm', 'pipelineSync.js'),
    ];
    const ENGINE = 'run' + 'AttributionEngine(';
    const offenders = [];
    let enginesChecked = 0;

    for (const file of DOORS) {
      const src = fs.readFileSync(file, 'utf8');
      // Every withClientLock callback's extent, by brace matching from its opening paren.
      const extents = [];
      let from = 0;
      for (;;) {
        const at = src.indexOf('withClientLock(', from);
        if (at === -1) break;
        from = at + 1;
        let depth = 0;
        let i = src.indexOf('(', at);
        let end = -1;
        for (; i < src.length; i += 1) {
          if (src[i] === '(') depth += 1;
          else if (src[i] === ')') { depth -= 1; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) extents.push([at, end]);
      }

      // Every CALL to the engine — a bare `await run…Engine(` — ignoring the import line.
      let k = 0;
      for (;;) {
        const at = src.indexOf(ENGINE, k);
        if (at === -1) break;
        k = at + 1;
        // Skip the require/destructure line, which names it without calling it.
        const lineStart = src.lastIndexOf('\n', at) + 1;
        const line = src.slice(lineStart, src.indexOf('\n', at));
        if (line.includes('require(')) continue;
        enginesChecked += 1;
        const inside = extents.some(([a, b]) => at > a && at < b);
        if (!inside) {
          offenders.push(`${path.basename(file)}: an engine call sits OUTSIDE every withClientLock callback`);
        }
      }
    }

    // ⚠ NON-VACUITY. If the extraction finds no engine calls at all — a rename, a refactor, a
    // brace matcher that silently returns nothing — the assertion below passes against an empty
    // set, which is this whole family's failure mode.
    assert.ok(enginesChecked >= 2,
      `only ${enginesChecked} engine call sites found across the doors — expected at least 2`);
    assert.deepEqual(offenders, [],
      'the assignment write must be atomic with the capture it was decided from: '
      + offenders.join(' | '));
  });
});

// ── (v) THE REFERRAL DOOR — CAPTURE, THEN DECIDE ─────────────────────────────
//
// ⚠ crm/pipelineSync.js WAS THE LAST FULLY-LIVE DOOR, AND 7b IS WHERE IT STOPS BEING ONE. It
// passed the LIVE client object, a currentStatus classified from that object, and the live Jobber
// fetcher — three inputs the replay took from stored rows, so the same client could get two
// different reps depending on which door fired.
//
// ⚠ IT COULD NOT SIMPLY BE HANDED THE FACT READER, AND THAT IS WHAT THESE CASES PIN. The sync's
// own clients(first: 25) query selects no requests connection at all, so reading facts without
// capturing first would have found an EMPTY request set, resolved nobody, and — because this is
// the one door whose writeOrphanOnMiss defaults to TRUE — raised an orphan flag and an admin bell
// for every referred client on every 30-minute tick.
describe('7b — the referral door captures before it decides', () => {
  const { syncSingleClient, _setPipelineSyncEmailsForTest, _resetPipelineSyncEmails,
    _setPipelineSyncFetchForTest, _resetPipelineSyncFetch } = require('../crm/pipelineSync');

  const REFERRAL_START = new Date('2026-01-01T00:00:00Z');

  // The referral door's anchor is pipeline_cache.created_at, which the upsert writes as NOW() on
  // first sight of the client. GRACE_MS is 7 days, so a request fact must be RECENT relative to
  // the run or it is outside the eligibility window and resolves to nobody.
  // ⚠ A HARDCODED 2026-09-18 IS WHAT THE FIRST WRITING USED, AND IT FAILED FOR EXACTLY THAT
  // REASON — the facts were captured, the engine ran, and nothing was assigned. That reads like a
  // wiring failure and was a fixture that had aged out of its own grace window. Anchor-relative
  // dates are the fix; a date literal here is a test that starts failing on a calendar.
  const RECENT = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // The sparse node the SYNC's own query produces — what syncSingleClient is handed.
  const syncNode = (id) => ({
    id,
    firstName: 'Ref', lastName: 'Client',
    createdAt: '2026-09-01T00:00:00Z',
    customFields: [{ label: 'Referred by', valueText: 'Jane Referrer' }],
    quotes: { nodes: [] },
    jobs: { nodes: [{ id: `${id}-job`, jobStatus: 'active', invoices: { nodes: [] } }] },
  });

  // The CONNECTION-shape client the door fetches for capture, carrying a request that names a rep.
  const captureShape = (id, jobberUserId) => ({
    id,
    quotes: { nodes: [] },
    jobs: { nodes: [{ id: `${id}-job`, jobStatus: 'active', client: { id }, invoices: { nodes: [] } }] },
    invoices: { nodes: [] },
    requests: { nodes: [{
      id: `${id}-req`,
      createdAt: RECENT,
      client: { id },
      salesperson: null,
      assessment: {
        id: `${id}-assess`,
        assignedUsers: { nodes: [{ id: jobberUserId }], pageInfo: { hasNextPage: false } },
      },
    }] },
  });

  before(() => {
    // LIVE-SEND GUARD — RESEND_API_KEY is active in the test env.
    _setPipelineSyncEmailsForTest({
      adminNotification: async () => {},
      email: async () => ({ data: null, error: null }),
    });
  });

  after(() => {
    _resetPipelineSyncEmails();
    _resetPipelineSyncFetch();
  });

  it('⚠ (v) THE PAIRED POSITIVE — a referred client is captured and then attributed from the facts', async () => {
    // ⚠ ORDERED FIRST DELIBERATELY. The absence case below asserts that NOTHING is written, and
    // "nothing was written" is also what a door that never runs the engine produces. This is the
    // control that proves the door can attribute at all.
    const C = 'ps-ok';
    const rep = await seedRep(CID, 'ju-ps', 'ps@t.com');
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, 'ju-ps'));

    await syncSingleClient(CID, syncNode(C), REFERRAL_START, [], 'tok');

    const { rows: facts } = await pool.query(
      `SELECT jobber_request_id FROM crm_request_facts WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, C]);
    assert.equal(facts.length, 1, 'the door must have CAPTURED the request before deciding');

    const row = await assignmentsFor(CID, C);
    assert.ok(row, 'and then attributed from it');
    assert.equal(row.sticky_rep_id, rep);
  });

  it('⚠ (v) A FAILED CAPTURE WRITES NO DECISION — no assignment, no orphan flag, no bell', async () => {
    // ⚠ THE CAPTURE FAILS FOR A REAL REASON, NOT A STUBBED THROW: an invoice whose job set is
    // truncated, which writeInvoiceJobLinks refuses outright because replacing links from a
    // partial set would silently delete real ones.
    // ⚠ AND THE ORPHAN FLAG IS THE POINT. This door's writeOrphanOnMiss defaults to TRUE, so a
    // decision taken from a half-written fact set would not merely pick the wrong rep — it would
    // raise an incident about a referral that is fine, and ring the admin bell about it.
    const C = 'ps-fail';
    await seedRep(CID, 'ju-ps-fail', 'psfail@t.com');
    _setPipelineSyncFetchForTest(async (id) => {
      const c = captureShape(id, 'ju-ps-fail');
      c.invoices = { nodes: [{
        id: `${id}-inv`, invoiceNumber: 1, invoiceStatus: 'paid',
        createdAt: '2026-09-04T00:00:00Z', updatedAt: '2026-09-04T00:00:00Z',
        issuedDate: null, dueDate: null, receivedDate: null, client: { id },
        amounts: { total: 10, subtotal: 10, invoiceBalance: 0, paymentsTotal: 10,
          depositAmount: 0, discountAmount: 0, taxAmount: 0 },
        jobs: { nodes: [], pageInfo: { hasNextPage: true } },
        archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      }] };
      return c;
    });

    await syncSingleClient(CID, syncNode(C), REFERRAL_START, [], 'tok');

    assert.equal(await assignmentsFor(CID, C), null, 'a failed capture must write NO assignment');
    const { rows: flags } = await pool.query(
      `SELECT 1 FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`, [CID, C]);
    assert.equal(flags.length, 0, 'and NO orphan flag — the referral is fine, our capture was not');
    const { rows: bells } = await pool.query(
      `SELECT 1 FROM admin_messages WHERE contractor_id = $1 AND message_type = 'flagged_assignment'`, [CID]);
    assert.equal(bells.length, 0, 'and no admin bell');

    // ⚠ THE REST OF THE SYNC MUST SURVIVE IT. A capture failure is scoped to attribution; the
    // referral record is the sync's actual job and must still be written.
    const { rows: cache } = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, C]);
    assert.equal(cache.length, 1, 'the pipeline_cache row must still be written');
  });

  it('⚠ the door never captures the SYNC OWN NODE — which would write job facts with a NULL client id', async () => {
    // ⚠ THIS IS THE FINDING THAT MADE 7b ITEM 4 MORE THAN A ONE-LINE CHANGE, AND IT IS FENCED
    // RATHER THAN ONLY WRITTEN DOWN. writeJobFacts filters on n?.id alone, so the sync node's
    // jobs — which carry no client { id } — pass the filter and land with jobber_client_id
    // NULL, orphaned from decideFromFacts' client-scoped read. A capture that corrupts.
    const C = 'ps-shape';
    await seedRep(CID, 'ju-ps-shape', 'psshape@t.com');
    _setPipelineSyncFetchForTest(async (id) => captureShape(id, 'ju-ps-shape'));

    await syncSingleClient(CID, syncNode(C), REFERRAL_START, [], 'tok');

    const { rows } = await pool.query(
      `SELECT jobber_job_id, jobber_client_id FROM crm_job_facts WHERE contractor_id = $1`, [CID]);
    assert.ok(rows.length > 0, 'job facts must have been written from the capture-shape client');
    for (const r of rows) {
      assert.ok(r.jobber_client_id != null,
        `job fact ${r.jobber_job_id} has a NULL client id — the sync own node was captured`);
    }
  });

  it('⚠ the capture fetch happens ONCE per referred client, and NOT AT ALL for an unreferred one', async () => {
    // ⚠ THE COST HALF OF ITEM 4, ASSERTED RATHER THAN ASSUMED. The added Jobber call is bounded
    // by the `if (!referredBy) return` guard at the top of syncSingleClient; if it ever moved
    // below that guard it would fire for every client in the book on every 30-minute tick.
    let fetches = 0;
    _setPipelineSyncFetchForTest(async (id) => { fetches += 1; return captureShape(id, 'ju-none'); });

    await syncSingleClient(CID, syncNode('ps-count-ref'), REFERRAL_START, [], 'tok');
    assert.equal(fetches, 1, 'exactly one capture fetch for a referred client');

    const unreferred = { ...syncNode('ps-count-unref'), customFields: [] };
    await syncSingleClient(CID, unreferred, REFERRAL_START, [], 'tok');
    assert.equal(fetches, 1, 'and none at all for an unreferred client');
  });

  it('⚠ a caller that SUPPLIES a capture client is not charged a second fetch', async () => {
    // Both client webhooks already hold a fetchFullClient result and pass it through, so the
    // referral door captures without fetching again. A regression here is invisible in behaviour
    // and doubles this door's Jobber cost.
    const C = 'ps-supplied';
    const rep = await seedRep(CID, 'ju-ps-sup', 'pssup@t.com');
    let fetches = 0;
    _setPipelineSyncFetchForTest(async (id) => { fetches += 1; return captureShape(id, 'ju-ps-sup'); });

    await syncSingleClient(CID, syncNode(C), REFERRAL_START, [], 'tok',
      { captureClient: captureShape(C, 'ju-ps-sup') });

    assert.equal(fetches, 0, 'a supplied capture client must prevent the fetch entirely');
    assert.equal((await assignmentsFor(CID, C)).sticky_rep_id, rep,
      'and the supplied client must still be captured and decided from');
  });
});
