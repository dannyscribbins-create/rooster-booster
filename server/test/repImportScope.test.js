'use strict';

// ── CANVASS-STAGE BACKFILL: THE REP SCOPE, THE FACT TABLES AND THE REPLAY ────
//
// Rulings (Danny, 2026-09-21), and the case in this file that holds each one:
//   2  Steps A–I untouched; rep scope gets its OWN steps  → THE COUNTING TEST
//   5  mapping lights up a book, retroactively             → replay + route cases
//   6  sale grouping in the import, full-history paging    → sales cases
//   7  the bulk fence, with a positive control             → THE FENCE
//   8  pacing on requestedQueryCost; every nested first:   → pacing cases
//   1  assigned users atomic per assessment                → co-assignment pair
//
// ⚠ LIVE-SEND GUARD, AND IT IS LOAD-BEARING — same reason as errorLoggerAlertFlag.test.js.
// setup.js loads .env alongside .env.test, so the REAL RESEND_API_KEY leaks into this
// process, and several modules build their Resend client at require() time. The stub
// below must be installed BEFORE ./setup is required. It doubles as the fence's email
// observation channel: every Resend send anywhere in the process lands in sentEmails.

const _resendPath = require.resolve('resend');
const sentEmails = [];
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async (msg) => { sentEmails.push(msg); return { data: { id: 'test-stub' }, error: null }; },
        };
      }
    },
  },
};
// Twilio is required lazily and only when all three credentials are set; stubbed anyway
// so that if they ever are, an SMS is counted here rather than sent.
const smsSent = [];
try {
  const _twilioPath = require.resolve('twilio');
  require.cache[_twilioPath] = {
    id: _twilioPath, filename: _twilioPath, loaded: true,
    exports: () => ({ messages: { create: async (m) => { smsSent.push(m); return { sid: 'stub' }; } } }),
  };
} catch { /* twilio not installed — nothing can send SMS */ }

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const { startTestServer, stopTestServer, seedAudience, waitFor } = require('./helpers');

const importJob = require('../jobs/fullJobberImport');
const repScope = require('../jobs/repImportScope');
const clientSales = require('../utils/clientSales');
// Rep Step 3b (3d Phase 1a Commit 3b): the LIVE capture path and the shared fact writers, so the
// R5i case can drive both sides through their own real query text into the same writer.
const jobberClientFetch = require('../utils/jobberClientFetch');
const factCapture = require('../utils/factCapture');
const replay = require('../utils/attributionReplay');
const { runAttributionEngine } = require('../utils/attributionEngine');
const { evaluateAudience } = require('../cron/jobs/dynamicAudiences');

const TENANT = 'rep-scope-a';
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

let pool, realAxiosPost;

// ── THE JOBBER DOUBLE ─────────────────────────────────────────────────────────
// Routes each query by its operation name. ⚠ It THROWS on anything it does not
// recognise rather than answering "no data" — a double that can return a plausible
// empty shape satisfies every assertion of absence (CLAUDE.md, shell-harness section).
// Every non-Jobber URL is counted as an outbound send and answered, never forwarded.
const calls = { byOp: {}, outbound: [] };
const sleeps = [];

function page(key, nodes, { hasNextPage = false, endCursor = null, cost = null } = {}) {
  return {
    data: {
      data: { [key]: { nodes, pageInfo: { hasNextPage, endCursor } } },
      ...(cost ? { extensions: { cost } } : {}),
    },
  };
}

// ⚠ THE HARNESS ANSWERS FROM WHAT THE QUERY ACTUALLY SELECTS, AND IT DID NOT BEFORE 3b.
// projectToSelection keeps only the fields the query text names, so a selection that drops a field
// yields a node without it — the production consequence. A stub that returns the whole fixture
// regardless of the query CANNOT detect a missing SELECTION, and that is not hypothetical: the
// R5i guard-proof for 3b (drop receivedDate from the import's invoice selection) stayed GREEN at
// 39/39 against the un-projected harness. Same defect the 3a-2 stub had, one file along.
// ⚠ Word-boundary matching against the whole query is deliberate here: each rep query selects ONE
// entity, so there is no sibling selection for a name to hide in — unlike the live BASE_QUERY,
// where the per-entity split is what makes the fence precise.
function projectToSelection(node, query) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((n) => projectToSelection(n, query));
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (!new RegExp('\\b' + k + '\\b').test(query)) continue;
    out[k] = (v !== null && typeof v === 'object') ? projectToSelection(v, query) : v;
  }
  return out;
}

// ⚠ `clientInvoices` ARRIVED WITH REP STEP 3b, AND ITS DEFAULT IS AN EMPTY PAGE RATHER THAN A
// THROW ON PURPOSE. Step 3b fetches invoices per rep-scope client, so every existing fixture now
// reaches it; answering an unlisted client with "no invoices" keeps those fixtures meaningful
// instead of turning them into per-client failures. ⚠ An empty answer is NOT an untested one —
// the fact-writing cases below supply real invoices and assert the rows.
function installJobber({ campaign = {}, rep = {}, clientJobs = {}, clientInvoices = {}, identities = IDENTITIES, repHandler = null } = {}) {
  const fn = async (url, body) => {
    if (!String(url).includes('api.getjobber.com')) {
      calls.outbound.push(url);
      return { data: { ok: true } };
    }
    const q = body?.query || '';
    const op = (q.match(/query\s+(\w+)/) || [])[1] || 'unknown';
    calls.byOp[op] = (calls.byOp[op] || 0) + 1;
    if (repHandler && /^Rep/.test(op)) {
      const r = await repHandler(op, body.variables);
      if (r) return r;
    }
    switch (op) {
      case 'GetClients':  return page('clients', campaign.clients || []);
      case 'GetInvoices': return page('invoices', campaign.invoices || []);
      case 'GetJobs':     return page('jobs', campaign.jobs || []);
      case 'GetQuotes':   return page('quotes', campaign.quotes || []);
      case 'GetRequests': return page('requests', campaign.requests || []);
      case 'RepRequests': return page('requests', rep.requests || []);
      case 'RepQuotes':   return page('quotes', rep.quotes || []);
      case 'RepJobs':     return page('jobs', (rep.jobs || []).map((n) => projectToSelection(n, body.query)));
      // Rep Step 4 — one client's identity. A client absent from the map is one Jobber
      // cannot return, answered as a null client (not an error), exactly as Jobber does.
      case 'RepClientIdentity': return { data: { data: { client: identities[body.variables.id] || null } } };
      case 'RepClientInvoices': {
        const id = body.variables.id;
        const nodes = (clientInvoices[id] || []).map((n) => projectToSelection(n, body.query));
        return { data: { data: { client: { invoices: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } } } };
      }
      case 'GetClientJobsPaged': {
        const id = body.variables.id;
        if (!clientJobs[id]) throw new Error(`harness: no full job history for ${id}`);
        return { data: { data: { client: { jobs: { nodes: clientJobs[id], pageInfo: { hasNextPage: false, endCursor: null } } } } } };
      }
      default: throw new Error(`harness: unexpected query ${op}`);
    }
  };
  axios.post = fn;
  importJob._setTestOverrides({ axiosPost: fn, getFreshToken: async () => 'tok', startupDelayMs: 0 });
  repScope._setTestOverrides({ axiosPost: fn, sleep: async (ms) => { sleeps.push(ms); } });
  clientSales._setTestOverrides({ axiosPost: fn });
}

// ── FIXTURES ─────────────────────────────────────────────────────────────────
const client = (id, createdDaysAgo) => ({
  id, firstName: 'C', lastName: id, isCompany: false, isLead: false, isArchived: false,
  createdAt: ago(createdDaysAgo), updatedAt: ago(1),
  emails: [{ address: `${id}@example.com`, primary: true }],
  phones: [{ number: '770-555-0100', primary: true }],
  customFields: [],
});
const campaignJob = (id, clientId, days) => ({
  id, jobStatus: 'active', jobType: 'ONE_OFF', completedAt: null, createdAt: ago(days),
  client: { id: clientId }, customFields: [],
});

// The campaign-scope data. pc-old: a PAYING client from three years ago. new-1: an
// UNPAID prospect created inside 12 months (Step G keeps it). up-1: UNPAID and created
// two years ago — Step G EXCLUDES it, so the campaign never tags it.
const CAMPAIGN = {
  clients: [client('pc-old', 1100), client('new-1', 60), client('up-1', 730)],
  invoices: [{ id: 'inv-pc', invoiceStatus: 'paid', createdAt: ago(1000), amounts: { total: 9000 }, client: { id: 'pc-old' } }],
  jobs: [
    campaignJob('j-pc', 'pc-old', 1050),
    campaignJob('j-new1a', 'new-1', 25),
    campaignJob('j-new1b', 'new-1', 20),
  ],
  quotes: [{ id: 'q-pc', quoteStatus: 'converted', createdAt: ago(1060), client: { id: 'pc-old' } }],
  requests: [{ id: 'r-pc', requestStatus: 'converted', createdAt: ago(1070), client: { id: 'pc-old' } }],
};

// The rep window's data (last 12 months).
// ⚠ up-1 IS THE DISCRIMINATING CASE the ruling names: an UNPAID client inside the rep
// window that the campaign excluded. It must get a stage, fact rows and sales — and NO
// contact_tags. ghost-1 has no jobber_clients row at all, so it must get facts and no row.
const REP = {
  requests: [
    { id: 'rq-up1', createdAt: ago(40), client: { id: 'up-1' }, salesperson: null,
      assessment: { id: 'as-up1', assignedUsers: { nodes: [{ id: 'ju-rep1' }] } } },
    { id: 'rq-new1', createdAt: ago(50), client: { id: 'new-1' }, salesperson: null,
      // ⚠ TWO people on ONE assessment — the import must store them TOGETHER (ruling 1).
      // Guard-proofed: keeping only the first user left every other case green, because
      // the replay's flag case seeds its facts directly; only this fixture sees the write.
      assessment: { id: 'as-new1', assignedUsers: { nodes: [{ id: 'ju-rep2' }, { id: 'ju-rep3' }] } } },
    { id: 'rq-ghost', createdAt: ago(20), client: { id: 'ghost-1' }, salesperson: { id: 'ju-rep1' }, assessment: null },
  ],
  quotes: [
    { id: 'q-up1', createdAt: ago(38), quoteStatus: 'approved', client: { id: 'up-1' },
      salesperson: { id: 'ju-rep1' }, lastTransitioned: { approvedAt: ago(35) } },
  ],
  jobs: [
    { id: 'j-up1', createdAt: ago(30), client: { id: 'up-1', createdAt: ago(730) } },
    { id: 'j-new1a', createdAt: ago(25), client: { id: 'new-1', createdAt: ago(60) } },
    { id: 'j-new1b', createdAt: ago(20), client: { id: 'new-1', createdAt: ago(60) } },
  ],
};
// Rep Step 4's answers: identity for the one rep-scope client with no mirror row.
const IDENTITIES = {
  'ghost-1': { id: 'ghost-1', firstName: 'Gina', lastName: 'Ghost', isCompany: false, isLead: true, isArchived: false,
    emails: [{ address: 'gina@example.com', primary: true }], phones: [{ number: '770-555-0199', primary: true }] },
};

// Full history for the one client created BEFORE the window — a job 700 days ago is a
// second, separate sale that the window alone cannot see.
const CLIENT_JOBS = { 'up-1': [{ id: 'j-up1-old', createdAt: ago(700) }, { id: 'j-up1', createdAt: ago(30) }] };

async function reset() {
  for (const t of [
    'client_sale_jobs', 'client_sales', 'crm_request_facts', 'crm_quote_facts',
    // Rep Step 3b's tables. ⚠ Added with 3b — a fact table missing from this list leaks rows
    // between cases, and a leaked row reads as a successful write by the case that follows.
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
    'flagged_assignments', 'admin_messages', 'client_rep_assignments', 'dynamic_audiences',
    'contact_tags', 'pipeline_cache', 'notifications', 'jobber_import_progress', 'jobber_clients',
    'sessions', 'error_log', 'contact_jobber_links', 'contacts', 'contractor_settings', 'contractor_crm_settings', 'tokens', 'titles',
  ]) {
    await pool.query(`DELETE FROM ${t}`);
  }
  await pool.query(`DELETE FROM referral_schedules WHERE contractor_id = $1`, [TENANT]);
  await pool.query(`DELETE FROM team_members WHERE contractor_id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active') ON CONFLICT (id) DO NOTHING`, [TENANT]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'tok', 'refresh', NOW() + INTERVAL '120 minutes')`,
    [TENANT]
  );
  // up-1's mirror row exists (as a client webhook would have created it), UNSTAGED and
  // UNTAGGED — so the fill-only stage write has something to fill and nothing to regress.
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ('up-1', $1, 'Up', NOW())`,
    [TENANT]
  );
  calls.byOp = {};
  calls.outbound = [];
  sleeps.length = 0;
  sentEmails.length = 0;
  smsSent.length = 0;
  importJob.importState.status = 'idle';
}

async function seedRep(jobberUserId, { attributable = true } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, jobber_user_id)
     VALUES ($1, $2, 'x', 'general', true, $3, $4) RETURNING id`,
    [TENANT, `${jobberUserId}-${crypto.randomBytes(3).toString('hex')}@rep.test`, attributable, jobberUserId]
  );
  return rows[0].id;
}

const count = async (table, where = 'contractor_id = $1') => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`, [TENANT]);
  return rows[0].n;
};
const stageOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, id]);
  return rows[0] ? rows[0].pipeline_stage : undefined;
};
const assignmentOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, provisional_rep_id FROM client_rep_assignments
      WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, id]);
  return rows[0] || null;
};

before(async () => {
  pool = await initTestDb();
  realAxiosPost = axios.post;
});
after(async () => {
  axios.post = realAxiosPost;
  importJob._resetTestOverrides();
  repScope._resetTestOverrides();
  clientSales._resetTestOverrides();
  await pool.end();
});
beforeEach(reset);

// ═══════════════════════════════════════════════════════════════════════════
describe('Rep scope — the import writes facts, stages and sales for the rep window', () => {

  it('writes request and quote facts, keeping raw unmapped jobber_user_ids', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });

    assert.equal(importJob.importState.status, 'complete');
    assert.equal(importJob.importState.repScopeError, null);
    const { rows: reqs } = await pool.query(
      `SELECT jobber_request_id, jobber_client_id, salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids
         FROM crm_request_facts WHERE contractor_id = $1 ORDER BY jobber_request_id`, [TENANT]);
    assert.deepEqual(reqs, [
      { jobber_request_id: 'rq-ghost', jobber_client_id: 'ghost-1', salesperson_jobber_user_id: 'ju-rep1', assessment_id: null, assigned_jobber_user_ids: [] },
      { jobber_request_id: 'rq-new1', jobber_client_id: 'new-1', salesperson_jobber_user_id: null, assessment_id: 'as-new1', assigned_jobber_user_ids: ['ju-rep2', 'ju-rep3'] },
      { jobber_request_id: 'rq-up1', jobber_client_id: 'up-1', salesperson_jobber_user_id: null, assessment_id: 'as-up1', assigned_jobber_user_ids: ['ju-rep1'] },
    ]);
    const { rows: quotes } = await pool.query(
      `SELECT jobber_quote_id, quote_status, salesperson_jobber_user_id, approved_at IS NOT NULL AS approved
         FROM crm_quote_facts WHERE contractor_id = $1`, [TENANT]);
    assert.deepEqual(quotes, [{ jobber_quote_id: 'q-up1', quote_status: 'approved', salesperson_jobber_user_id: 'ju-rep1', approved: true }]);
    // No rep is mapped, so the replay had nothing to do — and the facts are kept anyway.
    assert.equal(await count('client_rep_assignments'), 0);
  });

  it('fills an UNSTAGED row, never regresses a staged one, and creates rows only through Rep Step 4', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });

    assert.equal(await stageOf('up-1'), 'sold', 'the unpaid client in the window gets a stage');
    assert.equal(await stageOf('new-1'), 'sold', 'Step H+I staged it; the rep fill leaves it');
    assert.equal(await stageOf('pc-old'), 'paid', 'a full-history "paid" is never regressed');
    // ⚠ INVERTED BY DANNY'S 2026-09-22 RULING, NOT RELAXED: the stage step still creates no
    // row (noRow is counted there), and Rep Step 4 then creates ghost-1's row WITH identity.
    assert.equal(importJob.importState.repScope.stages.noRow, 1, 'the stage step counts the rowless client');
    assert.equal(await stageOf('ghost-1'), 'lead', 'Rep Step 4 creates it, carrying the stage computed for it');

    // ⚠ THE REGRESSION GUARD'S OWN PROOF: a staged row that the rep scope DOES touch.
    await pool.query(`UPDATE jobber_clients SET pipeline_stage = 'paid' WHERE contractor_id = $1 AND jobber_client_id = 'up-1'`, [TENANT]);
    await repScope.runRepScope(pool, { contractorId: TENANT, filterPreference: { mode: 'recommended' }, getToken: async () => 'tok' });
    assert.equal(await stageOf('up-1'), 'paid', 'the rep window cannot see invoices, so it must not overwrite');
  });

  it('groups sales, re-paging in full ONLY the client created before the window', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });

    const { rows } = await pool.query(
      `SELECT jobber_client_id, COUNT(*)::int AS sales FROM client_sales WHERE contractor_id = $1
        GROUP BY jobber_client_id ORDER BY jobber_client_id`, [TENANT]);
    // up-1: the 700-day-old job is its own sale — visible only through the full re-page.
    // new-1: two jobs 5 days apart, inside 20 days → ONE sale, from the window alone.
    assert.deepEqual(rows, [{ jobber_client_id: 'new-1', sales: 1 }, { jobber_client_id: 'up-1', sales: 2 }]);
    assert.equal(calls.byOp.GetClientJobsPaged, 1, 'only up-1 needed its full history');
  });

  it('names the rep steps distinctly in the log, with pages and cost as each finishes', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    const lines = [];
    const realLog = console.log;
    console.log = (...a) => { lines.push(a.join(' ')); };
    try {
      await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    } finally {
      console.log = realLog;
    }
    for (const step of ['Rep Step 1 — requests', 'Rep Step 2 — quotes', 'Rep Step 3 — jobs']) {
      assert.ok(
        lines.some((l) => l.includes(`${step} complete — 1 pages`) && l.includes('cost requested=')),
        `missing summary line for ${step}`
      );
    }
  });

  it('a rep-scope failure leaves the campaign import complete and reports the error', async () => {
    installJobber({
      campaign: CAMPAIGN,
      clientJobs: CLIENT_JOBS,
      repHandler: async (op) => (op === 'RepRequests'
        ? { data: { errors: [{ message: "Field 'createdAt' doesn't exist" }] } }
        : null),
    });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });

    assert.equal(importJob.importState.status, 'complete');
    assert.match(importJob.importState.repScopeError, /createdAt/);
    // The campaign's own work committed: pc-old and new-1 are imported and tagged.
    assert.ok(await count('contact_tags', `contractor_id = $1 AND jobber_client_id = 'pc-old'`) > 0);
    assert.equal(await count('crm_request_facts'), 0, 'a failed query records no history rather than an empty one');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ruling 2 — THE COUNTING TEST: campaigns are identical with and without the rep scope', () => {

  async function campaignSnapshot() {
    const { rows: tags } = await pool.query(
      `SELECT jobber_client_id, contact_id, tag, source FROM contact_tags WHERE contractor_id = $1
        ORDER BY jobber_client_id, tag`, [TENANT]);
    const audiences = {};
    for (const [name, filter] of [
      ['all', { tags: [], mode: 'OR' }],
      ['pipeline', { tags: ['job:active', 'quote:approved', 'request:assessment_completed', 'paying_client', 'job_count:first_time'], mode: 'OR' }],
    ]) {
      const id = await seedAudience(pool, { contractorId: TENANT, name, tags: filter.tags, mode: filter.mode });
      await evaluateAudience(pool, id);
      const { rows } = await pool.query(
        `SELECT jobber_client_id FROM dynamic_audience_members WHERE audience_id = $1 ORDER BY jobber_client_id`, [id]);
      audiences[name] = rows.map((r) => r.jobber_client_id);
    }
    return { tags, audiences };
  }

  it('contact_tags and campaign audiences are IDENTICAL; up-1 gets a stage, facts and NO tags', async () => {
    // Run A — the same campaign data, with a rep window that holds nothing.
    installJobber({ campaign: CAMPAIGN, rep: {}, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    const without = await campaignSnapshot();

    // Run B — identical campaign data, with the rep window populated.
    await reset();
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    const withRep = await campaignSnapshot();

    // ⚠ NOT VACUOUS: the campaign really did tag, so "identical" is not "both empty".
    assert.ok(without.tags.length > 5, `expected campaign tags, got ${without.tags.length}`);
    assert.ok(without.audiences.pipeline.length > 0, 'the tag audience must have members');
    assert.deepEqual(withRep.tags, without.tags, 'contact_tags must be identical');
    assert.deepEqual(withRep.audiences, without.audiences, 'campaign audiences must be identical');

    // The discriminating client: the rep scope DID reach it …
    assert.equal(await stageOf('up-1'), 'sold');
    assert.equal(await count('crm_request_facts', `contractor_id = $1 AND jobber_client_id = 'up-1'`), 1);
    assert.equal(await count('client_sales', `contractor_id = $1 AND jobber_client_id = 'up-1'`), 2);
    // … and wrote it NO tags.
    assert.equal(await count('contact_tags', `contractor_id = $1 AND jobber_client_id = 'up-1'`), 0);
    // ⚠ THE SECOND DISCRIMINATING CLIENT (Rep Step 4): ghost-1 now HAS a named mirror row —
    // and the no-tag "all clients" audience, which selects every jobber_clients row, must
    // still not contain it. Before the repScopeRows predicate it would have.
    const { rows: ghost } = await pool.query(
      `SELECT first_name, last_name, rep_scope_only FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = 'ghost-1'`, [TENANT]);
    assert.deepEqual(ghost, [{ first_name: 'Gina', last_name: 'Ghost', rep_scope_only: true }], 'named, and marked');
    assert.equal(await count('contact_tags', `contractor_id = $1 AND jobber_client_id = 'ghost-1'`), 0, 'no tags');
    assert.ok(!withRep.audiences.all.includes('ghost-1'), 'a rep-scope row never enters an audience');
  });

  it('⚠ the campaign sweeps are the SAME queries as before — no rep filter leaked into them', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    const sent = [];
    const inner = axios.post;
    const spy = async (url, body) => { sent.push(body?.query || ''); return inner(url, body); };
    importJob._setTestOverrides({ axiosPost: spy });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    for (const op of ['GetJobs', 'GetQuotes', 'GetRequests']) {
      const q = sent.find((s) => new RegExp(`query ${op}\\b`).test(s));
      assert.ok(q, `${op} must still run`);
      assert.ok(!/createdAt:\s*\{\s*after/.test(q), `${op} must carry no createdAt filter on Recommended`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ruling 7 — THE FENCE: the rep steps and the replay send and create nothing', () => {

  const FENCED = [
    ['users', 'contractor_id = $1'],
    ['pending_referrals', 'contractor_id = $1'],
    ['contractor_invite_links', 'contractor_id = $1'],
    ['experience_invite_tokens', 'contractor_id = $1'],
    ['pipeline_cache', 'contractor_id = $1'],
    ['notifications', 'contractor_id = $1'],
    ['admin_messages', 'contractor_id = $1'],
    ['contact_tags', 'contractor_id = $1'],
  ];
  const snapshot = async () => {
    const out = {};
    for (const [t, w] of FENCED) out[t] = await count(t, w);
    out.emails = sentEmails.length;
    out.sms = smsSent.length;
    out.outboundHttp = calls.outbound.length;
    return out;
  };

  it('rep steps + mapping replay: every counter is unchanged, and attribution really ran', async () => {
    installJobber({ rep: REP, clientJobs: CLIENT_JOBS });
    const rep1 = await seedRep('ju-rep1');
    const before0 = await snapshot();

    await repScope.runRepScope(pool, { contractorId: TENANT, filterPreference: { mode: 'recommended' }, getToken: async () => 'tok' });
    await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: rep1 });

    // ⚠ THE PROOF THAT SOMETHING HAPPENED — "nothing was sent" is also what a no-op sends.
    assert.equal((await assignmentOf('up-1'))?.sticky_rep_id, rep1, 'the replay must have attributed up-1');
    assert.deepEqual(await snapshot(), before0);
  });

  it('POSITIVE CONTROL — the same counters DO see a real send and a real referral write', async () => {
    // Without this, the fence above passes against a harness that could never observe
    // anything. Each counter is driven by a real product path through the SAME stubs.
    installJobber({});
    const before0 = await snapshot();

    const { sendAdminNotification } = require('../utils/notificationEmail');
    await sendAdminNotification(pool, 'cashout', 'probe', '<p>probe</p>', TENANT);
    await axios.post('https://api.resend.com/emails', {});        // an outbound call via axios
    await pool.query(
      `INSERT INTO admin_messages (contractor_id, message_type, title, body, color_code) VALUES ($1, 'probe', 't', 'b', 'orange')`, [TENANT]);
    // The engine's DEFAULT still rings the bell for a co-assignment — the live paths' behaviour.
    const [a, b] = [await seedRep('ju-pa'), await seedRep('ju-pb')];
    await runAttributionEngine(pool, {
      contractorId: TENANT, jobberClientId: 'pc-probe', currentStatus: 'lead', client: { quotes: { nodes: [] } },
      fetchAttributionData: async () => ({ requests: [{ id: 'r', createdAt: ago(1), salesperson: null,
        assessment: { id: 'as', assignedUsers: { nodes: [{ id: 'ju-pa' }, { id: 'ju-pb' }] } } }] }),
      token: null, referralAnchor: ago(1),
    });

    const after0 = await snapshot();
    assert.equal(after0.emails, before0.emails + 1, 'the email counter must see a real Resend send');
    assert.equal(after0.outboundHttp, before0.outboundHttp + 1, 'the HTTP counter must see a non-Jobber call');
    assert.equal(after0.admin_messages, before0.admin_messages + 2, 'the table counter must see admin alerts');
    assert.ok(a && b);
  });

  it('a co-assignment found in history is FLAGGED without ringing the bell', async () => {
    const [a, b] = [await seedRep('ju-a'), await seedRep('ju-b')];
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_client_id, jobber_request_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'co-1', 'rq-co', $2, 'as-co', '["ju-a","ju-b"]'::jsonb)`, [TENANT, ago(10)]);
    await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });

    const { rows } = await pool.query(`SELECT reps_involved FROM flagged_assignments WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows.length, 1, 'the co-assignment is recorded in the Flagged queue');
    assert.deepEqual([...rows[0].reps_involved].sort(), [a, b].sort());
    assert.equal(await count('admin_messages'), 0, 'and no bell rings');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ruling 1 + 5 — the replay reproduces the engine over stored history', () => {

  const addRequest = (clientId, id, days, { assigned = [], salesperson = null, assessment = true } = {}) => pool.query(
    `INSERT INTO crm_request_facts (contractor_id, jobber_client_id, jobber_request_id, created_at,
       salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [TENANT, clientId, id, ago(days), salesperson, assessment ? `as-${id}` : null, JSON.stringify(assigned)]);
  const setStage = (clientId, stage) => pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage, last_synced_at)
     VALUES ($1, $2, 'X', $3, NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET pipeline_stage = EXCLUDED.pipeline_stage`,
    [clientId, TENANT, stage]);

  it('⚠ TWO SEPARATE assessments are NOT a co-assignment — the pair to the flag case', async () => {
    // The grouping finding (ruling 1): the same two reps, on two assessments instead of one.
    // A flat (user, occurred_at) list would read both as the same event.
    const a = await seedRep('ju-a');
    const b = await seedRep('ju-b');
    await setStage('sep-1', 'inspection');
    await addRequest('sep-1', 'rq-1', 30, { assigned: ['ju-a'] });
    await addRequest('sep-1', 'rq-2', 10, { assigned: ['ju-b'] });
    await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });

    assert.equal(await count('flagged_assignments'), 0, 'no co-assignment flag');
    assert.equal((await assignmentOf('sep-1')).provisional_rep_id, b, 'the newest assessment holds the provisional');
  });

  it('replays oldest-first with history AS OF each request — the older rep wins a sold client', async () => {
    // Sold, no quote: Mode A at close. Oldest request (rep A) is replayed first with only
    // itself visible, so A becomes sticky; the newer request (rep B) then short-circuits.
    // ⚠ Without the "as of" cut the first pass would see B's newer request as eligible[0]
    // and credit B — a request that did not exist yet when A's request happened.
    const a = await seedRep('ju-a');
    await seedRep('ju-b');
    await setStage('ord-1', 'sold');
    await addRequest('ord-1', 'rq-old', 40, { assigned: ['ju-a'] });
    await addRequest('ord-1', 'rq-new', 20, { assigned: ['ju-b'] });
    await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });

    const row = await assignmentOf('ord-1');
    assert.equal(row.sticky_rep_id, a);
    assert.equal(row.sticky_source, 'mode_a_at_close');
  });

  it('an existing sticky WINS — history never overwrites a present assignment', async () => {
    const a = await seedRep('ju-a');
    const other = await seedRep('ju-other');
    await setStage('st-1', 'sold');
    await addRequest('st-1', 'rq-st', 15, { assigned: ['ju-a'] });
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
       VALUES ($1, 'st-1', $2, 'manual', NOW(), NOW())`, [TENANT, other]);
    await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });
    assert.equal((await assignmentOf('st-1')).sticky_rep_id, other);
  });

  it('R3 — a sold client whose history names nobody attributable records nothing', async () => {
    const a = await seedRep('ju-a');
    await setStage('r3-1', 'sold');
    await addRequest('r3-1', 'rq-r3', 15, { assigned: ['ju-a'] });
    await pool.query(`UPDATE team_members SET is_attributable = false WHERE id = $1`, [a]);
    const result = await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });
    assert.equal(result, null, 'a non-attributable member triggers no replay');
    // And replaying the client directly still resolves nobody — no orphan flag.
    await replay.replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'r3-1' });
    assert.equal(await count('client_rep_assignments'), 0);
    assert.equal(await count('flagged_assignments'), 0);
  });

  it('with NO mirror row, the stage falls back to stored facts (a sale means sold)', async () => {
    const a = await seedRep('ju-a');
    await addRequest('nr-1', 'rq-nr', 15, { salesperson: 'ju-a', assessment: false });
    await pool.query(
      `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at) VALUES ($1, 'nr-1', $2, $2)`,
      [TENANT, ago(10)]);
    await pool.query(`INSERT INTO contractor_crm_settings (contractor_id, attribution_source) VALUES ($1, 'request_salesperson')
                      ON CONFLICT (contractor_id) DO UPDATE SET attribution_source = EXCLUDED.attribution_source`, [TENANT]);
    try {
      await replay.replayForTeamMember(pool, { contractorId: TENANT, teamMemberId: a });
      const row = await assignmentOf('nr-1');
      assert.equal(row.sticky_rep_id, a, 'sold → the sticky gate, Mode B at close');
      assert.equal(await count('jobber_clients'), 1, 'still no row for nr-1 (only up-1 from the reset)');
    } finally {
      await pool.query(`DELETE FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ruling 8 — pacing on requestedQueryCost, and every nested connection capped', () => {

  it('waits exactly what computeThrottlePaceDelayMs says between pages, from the response cost', async () => {
    const cost = { requestedQueryCost: 1506, actualQueryCost: 1174, throttleStatus: { currentlyAvailable: 500, restoreRate: 500, maximumAvailable: 10000 } };
    installJobber({
      repHandler: async (op, vars) => {
        if (op !== 'RepRequests') return null;
        return vars.after === null
          ? page('requests', [], { hasNextPage: true, endCursor: 'c1', cost })
          : page('requests', [], { cost });
      },
    });
    await repScope.pageRepConnection({
      label: 'Rep Step 1 — requests', query: repScope.REP_REQUESTS_QUERY, dataPath: 'requests',
      since: ago(365), getToken: async () => 'tok', onPage: async () => {},
    });
    // ceil((1506 - 500) / 500 * 1000) + 500 buffer = 2512. A hardcoded 2500 page cost would give 4500.
    assert.deepEqual(sleeps, [2512]);
  });

  it('a THROTTLED page is retried at the same cursor after a paced wait', async () => {
    let n = 0;
    const cursors = [];
    installJobber({
      repHandler: async (op, vars) => {
        if (op !== 'RepQuotes') return null;
        cursors.push(vars.after);
        n += 1;
        if (n === 1) {
          return { data: { errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
            extensions: { cost: { requestedQueryCost: 906, throttleStatus: { currentlyAvailable: 6, restoreRate: 500 } } } } };
        }
        return page('quotes', [{ id: 'q', client: { id: 'c' } }]);
      },
    });
    const r = await repScope.pageRepConnection({
      label: 'Rep Step 2 — quotes', query: repScope.REP_QUOTES_QUERY, dataPath: 'quotes',
      since: ago(365), getToken: async () => 'tok', onPage: async () => {},
    });
    assert.deepEqual(cursors, [null, null]);
    assert.equal(r.nodes, 1);
    assert.equal(sleeps[0], Math.ceil(((906 - 6) / 500) * 1000) + 500);
  });

  it('every nested connection in the three rep queries carries an explicit first:', () => {
    for (const q of [repScope.REP_REQUESTS_QUERY, repScope.REP_QUOTES_QUERY, repScope.REP_JOBS_QUERY]) {
      const connections = [...q.matchAll(/(\w+)(\([^)]*\))?\s*\{\s*nodes\b/g)];
      assert.ok(connections.length > 0, 'the needle must find the connections it checks');
      for (const m of connections) {
        assert.match(m[2] || '', /first:\s*\d+/, `${m[1]} has no explicit first:`);
      }
    }
  });

  it('the rep window follows the mode: 12 months, or the chosen custom date', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    for (const mode of ['recommended', 'paying_only', 'pull_all']) {
      assert.equal(repScope.repWindowStart({ mode }, now).toISOString(), '2025-09-21T12:00:00.000Z', mode);
    }
    assert.equal(
      repScope.repWindowStart({ mode: 'custom_date', customDate: '2026-01-15' }, now).toISOString(),
      '2026-01-15T00:00:00.000Z'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ruling 5 — mapping a rep through the admin routes lights up their book', () => {
  let server, port, ownerToken;

  function http(method, path, body) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = _httpRequest({
        hostname: 'localhost', port, path, method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  beforeEach(async () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/', require('../routes/admin/index'));
    ({ server, port } = await startTestServer(app));
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier) VALUES ($1, $2, 'x', 'owner') RETURNING id`,
      [TENANT, `owner-${crypto.randomBytes(3).toString('hex')}@rep.test`]);
    ownerToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`, [ownerToken, TENANT, rows[0].id]);
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_client_id, jobber_request_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'up-1', 'rq-route', $2, 'as-route', '["ju-route"]'::jsonb)`, [TENANT, ago(12)]);
  });
  // node:test runs this after each case in the describe, so the server never outlives it.
  const { afterEach } = require('node:test');
  afterEach(async () => { await stopTestServer(server); });

  it('PATCH mapping an ATTRIBUTABLE member starts the replay and book-status reports it', async () => {
    const rep = await seedRep(null);
    const res = await http('PATCH', `/api/admin/team/${rep}`, { jobber_user_id: 'ju-route' });
    assert.equal(res.status, 200);
    assert.equal(res.body.book_replay, 'started');
    await waitFor(async () => (await assignmentOf('up-1'))?.provisional_rep_id === rep);
    await waitFor(async () => (await http('GET', '/api/admin/team/book-status')).body.state === 'complete');
    const status = (await http('GET', '/api/admin/team/book-status')).body;
    assert.equal(status.teamMemberId, rep);
    assert.equal(status.clientsDone, 1);
  });

  it('PATCH mapping a NON-attributable member starts nothing — and the response says so', async () => {
    const rep = await seedRep(null, { attributable: false });
    const res = await http('PATCH', `/api/admin/team/${rep}`, { jobber_user_id: 'ju-route' });
    assert.equal(res.status, 200);
    assert.equal(res.body.book_replay, undefined);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await assignmentOf('up-1'), null);
  });

  it('promote → attributable on an already-MAPPED member starts it; UNMAPPING removes nothing', async () => {
    const rep = await seedRep('ju-route', { attributable: false });
    const res = await http('POST', `/api/admin/team/${rep}/promote`, { is_attributable: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.book_replay, 'started');
    await waitFor(async () => (await assignmentOf('up-1'))?.provisional_rep_id === rep);

    const unmap = await http('PATCH', `/api/admin/team/${rep}`, { jobber_user_id: null });
    assert.equal(unmap.body.book_replay, undefined);
    assert.equal((await assignmentOf('up-1')).provisional_rep_id, rep, 'unmapping is not retroactive');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Rep Step 4 — names, and the book window (Danny, 2026-09-22)', () => {

  it('names ONLY the rowless client, from one identity fetch, and logs its own step', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    const lines = [];
    const realLog = console.log;
    console.log = (...a) => { lines.push(a.join(' ')); };
    try {
      await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    } finally {
      console.log = realLog;
    }
    assert.equal(calls.byOp.RepClientIdentity, 1, 'one identity fetch — for ghost-1 and nobody else');
    const { rows } = await pool.query(
      `SELECT email, phone, is_lead, pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = 'ghost-1'`, [TENANT]);
    assert.deepEqual(rows, [{ email: 'gina@example.com', phone: '770-555-0199', is_lead: true, pipeline_stage: 'lead' }]);
    assert.ok(lines.some((l) => l.includes('Rep Step 4 — names complete — 1 clients with no row, 1 named')));
    assert.equal(importJob.importState.repScope.names.named, 1);
  });

  it('a client Jobber cannot return is COUNTED and never written as a nameless row', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS, identities: {} });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    assert.equal(await stageOf('ghost-1'), undefined, 'no identity → no row');
    assert.equal(importJob.importState.repScope.names.notFound, 1);
  });

  it('⚠ THE EXIT — once a campaign writer ingests the client, it joins audiences normally', async () => {
    // Without this, the predicate could be excluding every flagged row forever, which
    // would silently drop a client from campaigns after they pay. The campaign writers
    // all write the permanent `jobber_client` tag, and that is the whole exit.
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    const id = await seedAudience(pool, { contractorId: TENANT, name: 'all', tags: [], mode: 'OR' });
    const members = async () => {
      await evaluateAudience(pool, id);
      const { rows } = await pool.query(`SELECT jobber_client_id FROM dynamic_audience_members WHERE audience_id = $1`, [id]);
      return rows.map((r) => r.jobber_client_id);
    };
    assert.ok(!(await members()).includes('ghost-1'), 'excluded while only the rep scope has touched it');
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at) VALUES ('ghost-1', $1, 'jobber_client', 'system', NOW())`, [TENANT]);
    assert.ok((await members()).includes('ghost-1'), 'included once a campaign writer has tagged it');
  });

  it('the contact matching pass never links a rep-scope row — paired with one it DOES link', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    await pool.query(
      `INSERT INTO contacts (id, contractor_id, email, name) VALUES
         ('aaaaaaaa-0000-0000-0000-000000000001', $1, 'gina@example.com', 'Gina Ghost'),
         ('aaaaaaaa-0000-0000-0000-000000000002', $1, 'new-1@example.com', 'C new-1')`, [TENANT]);
    const { runContactMatchingPass } = require('../jobs/contactMatchingPass');
    await runContactMatchingPass(TENANT);
    const linked = async (jid) => (await pool.query(
      `SELECT COUNT(*)::int AS n FROM contact_jobber_links WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, jid])).rows[0].n;
    assert.equal(await linked('new-1'), 1, 'the POSITIVE: an ordinary row with the same shape of match links');
    assert.equal(await linked('ghost-1'), 0, 'the rep-scope row does not');
    assert.equal(await count('contact_tags', `contractor_id = $1 AND jobber_client_id = 'ghost-1'`), 0, 'and gets no tier_2 tag');
  });

  it('records where the book starts, and a later import can only move it EARLIER', async () => {
    installJobber({ rep: {}, clientJobs: CLIENT_JOBS });
    const windowOf = async () => (await pool.query(
      `SELECT rep_window_start FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT])).rows[0]?.rep_window_start;
    const run = (mode, customDate) => repScope.runRepScope(pool, {
      contractorId: TENANT, filterPreference: { mode, customDate }, getToken: async () => 'tok',
      now: new Date('2026-09-21T12:00:00Z'),
    });
    try {
      await run('custom_date', '2026-03-01');
      assert.equal((await windowOf()).toISOString(), '2026-03-01T00:00:00.000Z');
      await run('custom_date', '2026-06-01');
      assert.equal((await windowOf()).toISOString(), '2026-03-01T00:00:00.000Z', 'a LATER window never narrows the book');
      await run('recommended');
      assert.equal((await windowOf()).toISOString(), '2025-09-21T12:00:00.000Z', 'an EARLIER one widens it');
    } finally {
      await pool.query(`DELETE FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT]);
    }
  });

  it('the one-time backfill derives the window for an import that ran before the column existed', async () => {
    await pool.query(`INSERT INTO contractor_crm_settings (contractor_id) VALUES ($1)`, [TENANT]);
    await pool.query(
      `INSERT INTO jobber_import_progress (contractor_id, run_id, started_at, completed_at, updated_at)
       VALUES ($1, 'r', '2025-01-01T00:00:00Z', '2026-09-22T02:15:00Z', '2026-09-22T02:15:00Z')`, [TENANT]);
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_client_id, jobber_request_id, created_at)
       VALUES ($1, 'c', 'r1', NOW())`, [TENANT]);
    try {
      await require('../db').initDB();
      const { rows } = await pool.query(`SELECT rep_window_start FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT]);
      // completed_at, NOT started_at — started_at is the FIRST-ever run and can be months old.
      assert.equal(rows[0].rep_window_start.toISOString(), '2025-09-22T02:15:00.000Z');
    } finally {
      await pool.query(`DELETE FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Rep Step 4, standalone — the boot backfill names an older import\'s rowless clients', () => {
  const backfill = require('../jobs/repNamesBackfill');
  const ident = (id) => ({ id, firstName: 'N', lastName: id, isCompany: false, isLead: false, isArchived: false,
    emails: [{ address: `${id}@example.com`, primary: true }], phones: [] });
  const IDS = { 'gh-req': ident('gh-req'), 'gh-quote': ident('gh-quote'), 'gh-job': ident('gh-job'), 'gh-old': ident('gh-old') };

  // The state Accent's first import left behind: facts and sales stored, window recorded,
  // Step 4 never run (rep_names_checked_at NULL). up-1 already has a row (see reset).
  async function seedStoredScope() {
    await pool.query(`INSERT INTO contractor_crm_settings (contractor_id, rep_window_start) VALUES ($1, $2)`, [TENANT, ago(365)]);
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_request_id, jobber_client_id, created_at) VALUES
         ($1, 'r-a', 'gh-req', $2), ($1, 'r-b', 'up-1', $2)`, [TENANT, ago(20)]);
    await pool.query(
      `INSERT INTO crm_quote_facts (contractor_id, jobber_quote_id, jobber_client_id, quote_status, created_at)
       VALUES ($1, 'q-a', 'gh-quote', 'approved', $2)`, [TENANT, ago(30)]);
    // gh-job: a sale whose last job is INSIDE the window. gh-old: one that ENDED before it —
    // history re-paged for grouping, not rep scope, and must not be fetched.
    for (const [cid, jobId, days] of [['gh-job', 'j-gh', 10], ['gh-old', 'j-old', 500]]) {
      const { rows } = await pool.query(
        `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
         VALUES ($1, $2, $3, $3) RETURNING id`, [TENANT, cid, ago(days)]);
      await pool.query(`INSERT INTO client_sale_jobs (sale_id, contractor_id, jobber_job_id) VALUES ($1, $2, $3)`,
        [rows[0].id, TENANT, jobId]);
    }
  }
  const run = () => backfill.startRepNamesBackfill(pool, { getToken: async () => 'tok' });

  it('names ONLY the rowless rep-scope clients, from stored facts, behind the Step 4 fence', async () => {
    installJobber({ identities: IDS });
    await seedStoredScope();
    const [result] = await run();
    assert.equal(calls.byOp.RepClientIdentity, 3, 'gh-req, gh-quote, gh-job — not up-1 (has a row), not gh-old');
    assert.equal(result.rowless, 3);
    assert.equal(result.named, 3);
    const { rows } = await pool.query(
      `SELECT jobber_client_id, last_name, pipeline_stage, rep_scope_only FROM jobber_clients
        WHERE contractor_id = $1 AND jobber_client_id LIKE 'gh-%' ORDER BY 1`, [TENANT]);
    assert.deepEqual(rows, [
      { jobber_client_id: 'gh-job', last_name: 'gh-job', pipeline_stage: 'sold', rep_scope_only: true },
      { jobber_client_id: 'gh-quote', last_name: 'gh-quote', pipeline_stage: 'inspection', rep_scope_only: true },
      { jobber_client_id: 'gh-req', last_name: 'gh-req', pipeline_stage: 'lead', rep_scope_only: true },
    ]);
    assert.equal(await count('contact_tags'), 0, 'no tags — the rows join no campaign audience');
    assert.equal(calls.outbound.length, 0);
  });

  it('is ONE-OFF — a second boot claims nothing and calls Jobber for nobody', async () => {
    installJobber({ identities: {} }); // every client "not found" — so nothing gets a row
    await seedStoredScope();
    const first = await run();
    assert.equal(first.length, 1);
    assert.equal(first[0].notFound, 3, 'counted, and never written blank');
    const before = calls.byOp.RepClientIdentity;
    assert.deepEqual(await run(), [], 'the claim holds even though all three are still rowless');
    assert.equal(calls.byOp.RepClientIdentity, before);
  });

  it('a COMPLETED import stamps the check, so the boot job never re-runs its Step 4', async () => {
    installJobber({ campaign: CAMPAIGN, rep: REP, clientJobs: CLIENT_JOBS });
    // ⚠ A SETTINGS ROW ALREADY EXISTS, as it does in production. Guard-proofed: without it
    // the INSERT branch stamps, the ON CONFLICT branch is never reached, and dropping the
    // stamp from that branch left this case green.
    await pool.query(`INSERT INTO contractor_crm_settings (contractor_id) VALUES ($1)`, [TENANT]);
    await importJob.runFullJobberImport(TENANT, { mode: 'recommended' });
    const { rows } = await pool.query(
      `SELECT rep_names_checked_at FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT]);
    assert.ok(rows[0].rep_names_checked_at instanceof Date, 'stamped by recordBookWindow');
    const before = calls.byOp.RepClientIdentity;
    assert.deepEqual(await run(), []);
    assert.equal(calls.byOp.RepClientIdentity, before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Rep Step 3b — the import writes job and invoice facts (3d Phase 1a Commit 3b)', () => {
// ═══════════════════════════════════════════════════════════════════════════

  // ⚠ EVERY FIELD NON-NULL, ON PURPOSE. A fixture that leaves columns empty cannot tell a correct
  // write from no write at all — the columns are NULL either way, which is exactly how 3a-2's
  // 42-field gap survived a whole passing test file. The R5i case below asserts on the columns by
  // name and FAILS on any NULL.
  const FULL_JOB = {
    id: 'j-up1', jobNumber: 4101, jobStatus: 'active', jobType: 'ONE_OFF', title: 'Roof replacement',
    createdAt: ago(30), updatedAt: ago(5), startAt: ago(28), endAt: ago(6), completedAt: ago(6),
    total: 29724.8, invoicedTotal: 29724.8, uninvoicedTotal: 0,
    client: { id: 'up-1', createdAt: ago(730) },
    quote: { id: 'q-up1' }, request: { id: 'rq-up1' }, salesperson: { id: 'ju-rep1' },
  };

  const FULL_INVOICE = {
    id: 'inv-up1', invoiceNumber: 9101, invoiceStatus: 'paid',
    createdAt: ago(10), updatedAt: ago(4), issuedDate: ago(10), dueDate: ago(1), receivedDate: ago(2),
    client: { id: 'up-1' },
    amounts: {
      total: 29724.8, subtotal: 27000.5, invoiceBalance: 0, paymentsTotal: 29724.8,
      depositAmount: 1000, discountAmount: 0, taxAmount: 2724.3,
    },
    jobs: { nodes: [{ id: 'j-up1' }], pageInfo: { hasNextPage: false } },
    archivedJobs: { nodes: [{ id: 'j-up1-old' }], pageInfo: { hasNextPage: false } },
  };

  const runScope = () => repScope.runRepScope(pool, {
    contractorId: TENANT, filterPreference: { mode: 'recommended' }, getToken: async () => 'tok',
    now: new Date('2026-09-21T12:00:00Z'),
  });

  const installWithFacts = () => installJobber({
    campaign: CAMPAIGN,
    rep: { ...REP, jobs: [FULL_JOB, ...REP.jobs.filter((j) => j.id !== 'j-up1')] },
    clientJobs: CLIENT_JOBS,
    clientInvoices: { 'up-1': [FULL_INVOICE] },
  });

  it('writes a job fact row for every job the rep window paged', async () => {
    installWithFacts();
    await runScope();
    const { rows } = await pool.query(
      `SELECT jobber_job_id FROM crm_job_facts WHERE contractor_id = $1 ORDER BY jobber_job_id`, [TENANT]
    );
    assert.deepEqual(rows.map((r) => r.jobber_job_id), ['j-new1a', 'j-new1b', 'j-up1']);
  });

  it('the job fact carries money, dates and its three foreign Jobber ids', async () => {
    installWithFacts();
    await runScope();
    const { rows } = await pool.query(
      `SELECT * FROM crm_job_facts WHERE contractor_id = $1 AND jobber_job_id = 'j-up1'`, [TENANT]
    );
    const r = rows[0];
    assert.equal(r.total, '29724.80');
    assert.equal(r.invoiced_total, '29724.80');
    assert.equal(r.uninvoiced_total, '0.00');
    assert.equal(r.job_number, '4101');
    assert.equal(r.job_type, 'ONE_OFF');
    assert.equal(r.title, 'Roof replacement');
    assert.equal(r.jobber_quote_id, 'q-up1');
    assert.equal(r.jobber_request_id, 'rq-up1');
    assert.equal(r.salesperson_jobber_user_id, 'ju-rep1');
    assert.equal(r.jobber_client_id, 'up-1');
  });

  it('writes invoice facts and their job links, including the archived one', async () => {
    installWithFacts();
    await runScope();
    const inv = await pool.query(`SELECT * FROM crm_invoice_facts WHERE contractor_id = $1`, [TENANT]);
    assert.equal(inv.rows.length, 1, 'ONE row for the invoice, keyed by its own id');
    assert.equal(inv.rows[0].total, '29724.80');
    assert.equal(inv.rows[0].invoice_balance, '0.00');
    assert.equal(inv.rows[0].deposit_amount, '1000.00');

    const links = await pool.query(
      `SELECT jobber_job_id, from_archived_jobs FROM crm_invoice_job_links
        WHERE contractor_id = $1 ORDER BY jobber_job_id`, [TENANT]
    );
    assert.deepEqual(links.rows, [
      { jobber_job_id: 'j-up1', from_archived_jobs: false },
      { jobber_job_id: 'j-up1-old', from_archived_jobs: true },
    ]);
  });

  it('the summary reports what was captured, and nothing failed', async () => {
    installWithFacts();
    const summary = await runScope();
    assert.equal(summary.invoices.failed, 0, 'a per-client invoice failure must not pass silently');
    assert.equal(summary.invoices.invoices, 1);
    assert.equal(summary.invoices.links, 2);
    assert.equal(summary.jobs.facts, 3);
  });

  it('tenancy — every fact row carries this contractor and no other', async () => {
    installWithFacts();
    await runScope();
    for (const t of ['crm_job_facts', 'crm_invoice_facts', 'crm_invoice_job_links']) {
      const { rows } = await pool.query(`SELECT DISTINCT contractor_id FROM ${t}`);
      assert.deepEqual(rows.map((r) => r.contractor_id), [TENANT], `${t} wrote outside the tenant`);
    }
  });

  it('re-running the import is idempotent — no duplicate facts or links', async () => {
    installWithFacts();
    await runScope();
    await runScope();
    const counts = {};
    for (const t of ['crm_job_facts', 'crm_invoice_facts', 'crm_invoice_job_links']) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE contractor_id = $1`, [TENANT]);
      counts[t] = rows[0].n;
    }
    assert.deepEqual(counts, { crm_job_facts: 3, crm_invoice_facts: 1, crm_invoice_job_links: 2 });
  });

  it('a per-client invoice FAILURE is counted and recorded, never a silent zero', async () => {
    installJobber({
      campaign: CAMPAIGN,
      rep: { ...REP, jobs: [FULL_JOB, ...REP.jobs.filter((j) => j.id !== 'j-up1')] },
      clientJobs: CLIENT_JOBS,
      // An invoice whose job set is TRUNCATED — the writers refuse it rather than replace links
      // from a short set, which is the contract Commit 3 established.
      clientInvoices: { 'up-1': [{ ...FULL_INVOICE, jobs: { nodes: [{ id: 'j-up1' }], pageInfo: { hasNextPage: true } } }] },
    });
    const summary = await runScope();
    assert.equal(summary.invoices.failed, 1, 'the refusing client must be counted as failed');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM error_log WHERE source = 'fullJobberImport — rep invoices'`
    );
    assert.ok(rows[0].n >= 1, 'a per-client failure must reach error_log, loudly');
  });

  // ⚠ R5i — THE IMPORT AND THE LIVE PATH MUST PRODUCE THE SAME ROW FOR THE SAME OBJECT.
  // Both sides are driven through their OWN REAL QUERY TEXT against one underlying fixture, so a
  // field missing from either selection produces a NULL on that side and the comparison fails.
  // Comparing two rows built by handing the same object to the same writer would be vacuous.
  it('IDENTICAL ROWS — live capture and import capture agree column for column, with no NULLs', async () => {
    installWithFacts();
    await runScope();
    const importRow = (await pool.query(
      `SELECT * FROM crm_invoice_facts WHERE contractor_id = $1 AND jobber_invoice_id = 'inv-up1'`, [TENANT]
    )).rows[0];

    // The LIVE path, through fetchFullClient's own query text, into the same writer.
    const LIVE = 'r5i-live-tenant';
    const savedPost = axios.post;
    axios.post = async (url, body) => {
      if (!/GetClient\b/.test(body.query)) throw new Error('unexpected live follow-up page');
      return { data: { data: { client: {
        id: 'up-1',
        quotes: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        jobs: { nodes: [FULL_JOB], pageInfo: { hasNextPage: false, endCursor: null } },
        invoices: { nodes: [FULL_INVOICE], pageInfo: { hasNextPage: false, endCursor: null } },
      } } } };
    };
    let liveRow;
    try {
      const client = await jobberClientFetch.fetchFullClient('up-1', 'tok');
      await factCapture.writeInvoiceFacts(pool, LIVE, client.invoices.nodes);
      liveRow = (await pool.query(
        `SELECT * FROM crm_invoice_facts WHERE contractor_id = $1 AND jobber_invoice_id = 'inv-up1'`, [LIVE]
      )).rows[0];
    } finally {
      axios.post = savedPost;
      await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, [LIVE]);
    }

    assert.ok(importRow && liveRow, 'both paths must have written a row');

    // ⚠ FAIL ON ANY NULL, NAMED. Two identically-EMPTY rows would otherwise satisfy a
    // column-for-column comparison perfectly, which is the failure this arc keeps meeting.
    const compared = Object.keys(importRow).filter((k) => k !== 'contractor_id' && k !== 'captured_at');
    for (const col of compared) {
      assert.notEqual(importRow[col], null, `import row has NULL ${col} — its query is not selecting what the writer reads`);
      assert.notEqual(liveRow[col], null, `live row has NULL ${col} — its query is not selecting what the writer reads`);
    }
    assert.ok(compared.length >= 16, `only ${compared.length} columns compared — the fixture is too thin to prove agreement`);

    for (const col of compared) {
      assert.deepEqual(importRow[col], liveRow[col], `column ${col} differs between the import and the live path`);
    }
  });
});
