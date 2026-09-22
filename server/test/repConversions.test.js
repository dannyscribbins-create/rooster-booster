'use strict';

// ── CANVASS-STAGE: GET /api/rep/home CONVERSIONS (Ruling 1, Danny 2026-09-21) ──
//
// ⚠ THIS FILE WAS REWRITTEN, NOT PATCHED, AND THE REASON IS THAT ITS SUBJECT CHANGED.
// Canvass-8 built this against the OLD definition: a conversion was a
// `referral_conversions` ROW, and "my conversions" meant *conversions whose REFERRER
// sits in my book*. Every case asked whether a referrer resolved to this rep.
//
// **Ruling 1 replaced that definition outright.** A rep's conversions now count SALES
// in the rep's own book — every job is a sale from its createdAt, and jobs within the
// contractor's window are one sale. The old cases were not wrong; they were about a
// question the product no longer asks, so re-pointing their assertions would have left
// eight case names describing a referrer chain that nothing reads.
//
// ⚠ WHAT CARRIES OVER, DELIBERATELY: the SCOPING proofs. Own-book, cross-rep, tenancy,
// the mis-tenanted row and the fan-out fence are properties of the QUERY rather than of
// the definition, and each is reproduced below against sales. Dropping them while
// changing the definition is how a rewrite loses coverage nobody notices.
//
// ⚠ AND THE TWO NUMBERS MEASURE DIFFERENT THINGS ON PURPOSE. A rep's CONVERSIONS count
// SALES, repeats included; a referrer's PAYOUTS count PEOPLE REFERRED, one each. The
// breakdown's Referral figure can therefore exceed what that referrer was paid, which
// is why the glossary entry says so in the rep's own words.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');

const repRouter = require('../routes/rep');

const TENANT = 'repconv-a';
const OTHER_TENANT = 'repconv-b';

let pool, server, port;

function request(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function seedTenant(id) {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active') ON CONFLICT (id) DO NOTHING`, [id]);
}

async function seedRep(contractorId, email) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, tier, active, is_field_rep, password_hash)
     VALUES ($1, $2, $2, 'general', TRUE, TRUE, 'x') RETURNING id`,
    [contractorId, email]
  );
  return rows[0].id;
}

async function seedSession(token, { contractorId, teamMemberId }) {
  await pool.query(
    `INSERT INTO sessions (token, role, contractor_id, team_member_id, expires_at, created_at)
     VALUES ($1, 'admin', $2, $3, NOW() + INTERVAL '1 day', NOW())`,
    [token, contractorId, teamMemberId]
  );
}

async function seedClient(contractorId, jobberClientId) {
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ($1, $2, 'C', NOW()) ON CONFLICT DO NOTHING`,
    [jobberClientId, contractorId]
  );
}

async function assign(contractorId, jobberClientId, repId) {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
     VALUES ($1, $2, $3, 'mode_a_at_close', NOW(), NOW())`,
    [contractorId, jobberClientId, repId]
  );
}

// A sale, written directly — these cases are about the QUERY, not about grouping,
// which `saleGrouping.test.js` drives through the primitive itself.
async function seedSale(contractorId, jobberClientId, anchorIso) {
  await pool.query(
    `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
     VALUES ($1, $2, $3, $3)`,
    [contractorId, jobberClientId, anchorIso]
  );
}

/** Marks a client as referred through the CRM "Referred by" field. */
async function seedCrmReferral(contractorId, jobberClientId) {
  await pool.query(
    `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
     VALUES ($1, $2, 'C', 'Someone', 'sold')`,
    [contractorId, jobberClientId]
  );
}

/** Marks the SAME client as referred through the in-app invite chain — the second source. */
async function seedAppReferral(contractorId, jobberClientId) {
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
     VALUES ('Inviter', $2, 'x', TRUE, $1) RETURNING id`,
    [contractorId, `inviter-${jobberClientId}@x.test`]
  );
  await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, jobber_client_id, invited_by_user_id)
     VALUES ('Invitee', $3, 'x', TRUE, $1, $2, $4)`,
    [contractorId, jobberClientId, `invitee-${jobberClientId}@x.test`, rows[0].id]
  );
}

before(async () => {
  pool = await initTestDb();
  const app = express();
  app.use(express.json());
  app.use('/', repRouter);   // mounted at '/', exactly as createApp() does
  await new Promise((resolve) => { server = app.listen(0, 'localhost', resolve); });
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  // ⚠ ORDER MATTERS — children before parents, or the hook raises 23503 and fails
  // every case in the file including ones that touch none of these tables.
  for (const t of ['client_sale_jobs', 'client_sales', 'referral_conversions',
    'client_rep_assignments', 'pipeline_cache', 'jobber_clients', 'sessions',
    'users', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  }
  await seedTenant(TENANT);
  await seedTenant(OTHER_TENANT);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — conversions count SALES in the rep\'s own book', () => {

  it('[RED] counts every sale, proven at a NON-ZERO value', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-1', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c1');
    await assign(TENANT, 'c1', rep);
    await seedSale(TENANT, 'c1', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'c1', '2026-08-01T00:00:00Z');

    const res = await request('/api/rep/home', 'conv-1');
    assert.equal(res.status, 200);
    // ⚠ TWO SALES FOR ONE CLIENT IS TWO CONVERSIONS. This is the whole of Ruling 1:
    // selling the same customer again converts them again. Under the OLD definition
    // this was structurally impossible — `UNIQUE(user_id, jobber_client_id)` on
    // referral_conversions allows one per client ever.
    assert.equal(res.body.stats.conversions, 2);
  });

  it('[RED] does NOT count another rep\'s sale — the own-book proof', async () => {
    const mine = await seedRep(TENANT, 'rep-mine@x.test');
    const theirs = await seedRep(TENANT, 'rep-theirs@x.test');
    await seedSession('conv-2', { contractorId: TENANT, teamMemberId: mine });
    await seedClient(TENANT, 'c-mine');
    await seedClient(TENANT, 'c-theirs');
    await assign(TENANT, 'c-mine', mine);
    await assign(TENANT, 'c-theirs', theirs);
    await seedSale(TENANT, 'c-mine', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'c-theirs', '2026-06-01T00:00:00Z');

    const res = await request('/api/rep/home', 'conv-2');
    assert.equal(res.body.stats.conversions, 1, 'only my own client\'s sale counts');
  });

  it('[RED] does NOT count a sale for a client in NOBODY\'s book', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-3', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c-orphan');
    await seedSale(TENANT, 'c-orphan', '2026-06-01T00:00:00Z');
    // No assignment at all.

    const res = await request('/api/rep/home', 'conv-3');
    assert.equal(res.body.stats.conversions, 0);
  });

  it('[RED] does NOT count another contractor\'s sale — tenancy', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-4', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(OTHER_TENANT, 'c-other');
    const otherRep = await seedRep(OTHER_TENANT, 'rep-other@x.test');
    await assign(OTHER_TENANT, 'c-other', otherRep);
    await seedSale(OTHER_TENANT, 'c-other', '2026-06-01T00:00:00Z');

    const res = await request('/api/rep/home', 'conv-4');
    assert.equal(res.body.stats.conversions, 0);
  });

  it('[RED] renders zero honestly when the rep has no sales', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-5', { contractorId: TENANT, teamMemberId: rep });
    const res = await request('/api/rep/home', 'conv-5');
    assert.equal(res.body.stats.conversions, 0);
    assert.equal(res.body.stats.conversionsReferral, 0);
    assert.equal(res.body.stats.conversionsDirect, 0);
  });

  it('[RED] ⚠ counting sales does not inflate the other stats — the FAN-OUT fence', async () => {
    // ⚠ CARRIED OVER FROM CANVASS-8 AND STILL EXACTLY THE RIGHT FENCE. A client with
    // three sales would multiply `COUNT(*)` if the sales table were joined into the
    // stats query, so `clients` would read 3 for one client — silently, and plausibly.
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-6', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c1');
    await assign(TENANT, 'c1', rep);
    await seedSale(TENANT, 'c1', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'c1', '2026-07-01T00:00:00Z');
    await seedSale(TENANT, 'c1', '2026-08-01T00:00:00Z');

    const res = await request('/api/rep/home', 'conv-6');
    assert.equal(res.body.stats.conversions, 3, 'three sales');
    assert.equal(res.body.stats.clients, 1, 'but still ONE client');
    assert.equal(res.body.stats.locked, 1, 'and one locked assignment');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the Referral / Direct split is a UNION over sales', () => {

  it('[RED] a CRM-referred client\'s sales count as Referral, a plain client\'s as Direct', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('split-1', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c-ref');
    await seedClient(TENANT, 'c-dir');
    await assign(TENANT, 'c-ref', rep);
    await assign(TENANT, 'c-dir', rep);
    await seedCrmReferral(TENANT, 'c-ref');
    await seedSale(TENANT, 'c-ref', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'c-dir', '2026-06-01T00:00:00Z');

    const res = await request('/api/rep/home', 'split-1');
    assert.equal(res.body.stats.conversions, 2);
    assert.equal(res.body.stats.conversionsReferral, 1);
    assert.equal(res.body.stats.conversionsDirect, 1);
  });

  it('[RED] ⚠ A CLIENT REFERRED THROUGH BOTH SOURCES IS COUNTED ONCE PER SALE', async () => {
    // ⚠ DANNY'S DISCRIMINATING CASE, AND THE REASON THE SPLIT IS A UNION RATHER THAN A
    // SUM. This client is referred BOTH through the CRM "Referred by" field AND through
    // the in-app invite chain. Two per-source counts added together would report 2
    // referral conversions for ONE sale, and referral + direct would exceed the total —
    // a breakdown that does not add up, on the rep's headline card.
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('split-2', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c-both');
    await assign(TENANT, 'c-both', rep);
    await seedCrmReferral(TENANT, 'c-both');
    await seedAppReferral(TENANT, 'c-both');
    await seedSale(TENANT, 'c-both', '2026-06-01T00:00:00Z');

    const res = await request('/api/rep/home', 'split-2');
    assert.equal(res.body.stats.conversions, 1, 'one sale');
    assert.equal(res.body.stats.conversionsReferral, 1, 'counted ONCE, not once per source');
    assert.equal(res.body.stats.conversionsDirect, 0);
  });

  it('[RED] ⚠ the split always ADDS UP to the total — the invariant, over a mixed book', async () => {
    // ⚠ THE PROPERTY, NOT THE NUMBERS. Asserting 2 and 1 in a specific case pins one
    // arrangement; asserting the sum pins the relationship that must hold for every
    // arrangement, which is what a rep would actually notice being wrong.
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('split-3', { contractorId: TENANT, teamMemberId: rep });
    for (const id of ['a', 'b', 'c']) {
      await seedClient(TENANT, id);
      await assign(TENANT, id, rep);
    }
    await seedCrmReferral(TENANT, 'a');
    await seedAppReferral(TENANT, 'b');
    await seedSale(TENANT, 'a', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'a', '2026-08-01T00:00:00Z');
    await seedSale(TENANT, 'b', '2026-06-01T00:00:00Z');
    await seedSale(TENANT, 'c', '2026-06-01T00:00:00Z');

    const { stats } = (await request('/api/rep/home', 'split-3')).body;
    assert.equal(stats.conversions, 4);
    assert.equal(stats.conversionsReferral + stats.conversionsDirect, stats.conversions,
      'referral + direct must equal the total');
    assert.equal(stats.conversionsReferral, 3, 'a has two sales, b has one');
    assert.equal(stats.conversionsDirect, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — conversions obey the timeframe', () => {

  it('[RED] ⚠ the window is the SALE anchor, not the assignment date', async () => {
    // ⚠ THE DEFECT THIS GUARDS AGAINST IS A PLAUSIBLE SIMPLIFICATION. The four other
    // statements on this route window on the assignment date via timeframeClause();
    // making this one match them would count conversions by the age of an unrelated
    // assignment row. The assignment here is created NOW and the sale is 200 days old,
    // so the two anchors disagree and only one of them can produce 0.
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('tf-1', { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, 'c-old');
    await assign(TENANT, 'c-old', rep);
    await seedSale(TENANT, 'c-old', new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString());

    const all = await request('/api/rep/home?timeframe=all', 'tf-1');
    assert.equal(all.body.stats.conversions, 1, 'the sale exists');

    const week = await request('/api/rep/home?timeframe=week', 'tf-1');
    assert.equal(week.body.stats.conversions, 0,
      'a 200-day-old SALE is outside this week, even though the assignment is minutes old');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Danny, 2026-09-22: a rep's book starts at the import window. "All" had exceeded
// "Year" by 61 on Accent — sales that predated the window and existed only because
// 1,143 clients were re-paged in full so grouping could be exact.
describe('Canvass-stage — conversions are clipped to where the book starts', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const setWindow = (contractorId, daysAgo) => pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, rep_window_start) VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET rep_window_start = EXCLUDED.rep_window_start`,
    [contractorId, new Date(Date.now() - daysAgo * DAY).toISOString()]);

  beforeEach(async () => {
    await pool.query(`DELETE FROM contractor_crm_settings WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  });
  after(async () => {
    await pool.query(`DELETE FROM contractor_crm_settings WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  });

  async function bookWithOldAndNewSale(token) {
    const rep = await seedRep(TENANT, `${token}@x.test`);
    await seedSession(token, { contractorId: TENANT, teamMemberId: rep });
    await seedClient(TENANT, `${token}-c`);
    await assign(TENANT, `${token}-c`, rep);
    await seedSale(TENANT, `${token}-c`, new Date(Date.now() - 200 * DAY).toISOString()); // before the window
    await seedSale(TENANT, `${token}-c`, new Date(Date.now() - 10 * DAY).toISOString());  // inside it
  }

  it('[RED] a sale anchored BEFORE the window counts on neither "All" nor "Year"', async () => {
    await bookWithOldAndNewSale('clip-1');
    await setWindow(TENANT, 30);
    const all = await request('/api/rep/home?timeframe=all', 'clip-1');
    const year = await request('/api/rep/home?timeframe=year', 'clip-1');
    assert.equal(all.body.stats.conversions, 1, '"All" means since the book started');
    assert.equal(year.body.stats.conversions, 1, 'and Year is clipped the same way — the 200-day sale is inside a year but before the book');
  });

  it('⚠ PAIRED — with NO window recorded, the same two sales both count', async () => {
    // The proof the clip is the SETTING and not the data: same fixture, no row, 2.
    await bookWithOldAndNewSale('clip-2');
    const all = await request('/api/rep/home?timeframe=all', 'clip-2');
    assert.equal(all.body.stats.conversions, 2);
  });

  it('[RED] the window is per contractor — another tenant\'s window clips nothing here', async () => {
    await bookWithOldAndNewSale('clip-3');
    await setWindow(OTHER_TENANT, 30);
    const all = await request('/api/rep/home?timeframe=all', 'clip-3');
    assert.equal(all.body.stats.conversions, 2);
  });
});
