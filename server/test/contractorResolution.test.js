'use strict';

// Bug: referrer-facing routes hardcode contractor_id = 'accent-roofing' instead of
// resolving against whatever the contractors table actually contains. After the dev-tenant
// rename to 'accent-roofing-dev' (Session 92/93), every referrer route resolved to an
// empty tenant. These tests seed the contractors table under a RENAMED id and assert the
// referrer routes still work — proving resolution is DB-driven, not a hardcoded literal.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const referrerRouter = require('../routes/referrer');
const { getDefaultContractorId } = require('../utils/contractorContext');

const {
  seedUser,
  seedSession,
  seedReferralSchedule,
  startTestServer,
  stopTestServer,
} = require('./helpers');

function buildTestApp() {
  const express = require('express');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', referrerRouter);
  return app;
}

function httpGet(port, path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers: extraHeaders },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
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

const RENAMED_CONTRACTOR_ID = 'rename-safety-tenant';
const REFERRER_TOKEN = 'contractor-resolution-test-token';

describe('contractor_id resolution — rename safety (referrer path)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    referrerRouter._resetTestOverrides();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractors');
  });

  async function renameContractor() {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ($1, 'Renamed Tenant', 'active')`,
      [RENAMED_CONTRACTOR_ID]
    );
  }

  // ── getDefaultContractorId() — fail-closed tripwire ──────────────────────────

  it('getDefaultContractorId resolves the single contractors row, whatever its id', async () => {
    await renameContractor();
    const id = await getDefaultContractorId();
    assert.equal(id, RENAMED_CONTRACTOR_ID);
  });

  it('getDefaultContractorId fails closed with 0 contractor rows', async () => {
    // beforeEach already deleted all contractors rows for this test file
    await assert.rejects(() => getDefaultContractorId(), /0 contractor rows/i);
  });

  it('getDefaultContractorId fails closed with 2 contractor rows (contractor #2 tripwire)', async () => {
    await renameContractor();
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ('second-tenant', 'Second', 'active')`);
    await assert.rejects(() => getDefaultContractorId(), /2 contractor rows/i);
  });

  // ── GET /api/referrer/schedules ──────────────────────────────────────────────

  it('GET /api/referrer/schedules resolves against the renamed contractor id', async () => {
    await renameContractor();
    const userId = await seedUser(pool, {
      fullName: 'Test Referrer', email: 'resolve-sched@test.com', contractorId: RENAMED_CONTRACTOR_ID,
    });
    await seedSession(pool, { userId, token: REFERRER_TOKEN, role: 'referrer' });
    await seedReferralSchedule(pool, {
      contractorId: RENAMED_CONTRACTOR_ID, jobberLabel: 'Roof Replacement', flatAmount: 250,
    });

    const resp = await httpGet(port, '/api/referrer/schedules', { authorization: `Bearer ${REFERRER_TOKEN}` });

    assert.equal(resp.status, 200);
    assert.equal(resp.body.schedules.length, 1, 'schedule seeded under renamed id is visible');
  });

  // ── GET /api/referrer/conversions ─────────────────────────────────────────────

  it('GET /api/referrer/conversions resolves against the renamed contractor id', async () => {
    await renameContractor();
    const userId = await seedUser(pool, {
      fullName: 'Test Referrer', email: 'resolve-conv@test.com', contractorId: RENAMED_CONTRACTOR_ID,
    });
    await seedSession(pool, { userId, token: REFERRER_TOKEN, role: 'referrer' });
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount, converted_at)
       VALUES ($1, $2, 'jc-resolve-001', 500, NOW())`,
      [userId, RENAMED_CONTRACTOR_ID]
    );

    const resp = await httpGet(port, '/api/referrer/conversions', { authorization: `Bearer ${REFERRER_TOKEN}` });

    assert.equal(resp.status, 200);
    assert.equal(resp.body.conversions.length, 1, 'conversion seeded under renamed id is visible');
    assert.equal(parseFloat(resp.body.conversions[0].bonus_amount), 500);
  });

  // ── GET /api/pipeline ─────────────────────────────────────────────────────────

  it('GET /api/pipeline resolves against the renamed contractor id (adapter lookup + stale-cache fallback)', async () => {
    await renameContractor();
    const userId = await seedUser(pool, {
      fullName: 'Pipeline Referrer', email: 'resolve-pipeline@test.com', contractorId: RENAMED_CONTRACTOR_ID,
    });
    await seedSession(pool, { userId, token: REFERRER_TOKEN, role: 'referrer' });

    // Connected CRM under the renamed id, using the servicetitan placeholder adapter so the
    // test never touches the network — it throws a deterministic, non-"No CRM connected" error,
    // which routes into the stale-cache fallback path (also under the renamed id).
    await pool.query(
      `INSERT INTO contractor_crm_settings
         (contractor_id, crm_type, connection_method, api_key, is_connected, connected_at)
       VALUES ($1, 'servicetitan', 'api_key', 'test-key', true, NOW())`,
      [RENAMED_CONTRACTOR_ID]
    );
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status, last_synced_at)
       VALUES ($1, 'jc-stale-001', 'Stale Client', 'Pipeline Referrer', 'paid', NOW())`,
      [RENAMED_CONTRACTOR_ID]
    );

    const resp = await httpGet(port, '/api/pipeline', { authorization: `Bearer ${REFERRER_TOKEN}` });

    assert.equal(resp.status, 200, `expected stale-cache fallback to succeed, got: ${JSON.stringify(resp.body)}`);
    assert.equal(resp.body.stale, true);
    assert.equal(resp.body.pipeline.length, 1, 'pipeline_cache row seeded under renamed id is visible');
    assert.equal(resp.body.pipeline[0].name, 'Stale Client');
  });

  // ── GET /api/referrer/enabled-payout-methods ──────────────────────────────────
  // Security fix: contractorId must never come from the client. Route drops the
  // :contractorId param entirely and resolves server-side via getDefaultContractorId().

  it('GET /api/referrer/enabled-payout-methods resolves server-side under the renamed contractor id', async () => {
    await renameContractor();
    const userId = await seedUser(pool, {
      fullName: 'Test Referrer', email: 'resolve-payout@test.com', contractorId: RENAMED_CONTRACTOR_ID,
    });
    await seedSession(pool, { userId, token: REFERRER_TOKEN, role: 'referrer' });
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, enabled_payout_methods)
       VALUES ($1, 'Renamed Co', $2)`,
      [RENAMED_CONTRACTOR_ID, ['zelle']]
    );

    const resp = await httpGet(port, '/api/referrer/enabled-payout-methods', { authorization: `Bearer ${REFERRER_TOKEN}` });

    assert.equal(resp.status, 200);
    assert.deepEqual(resp.body.enabled_payout_methods, ['zelle']);
  });

  it('GET /api/referrer/enabled-payout-methods requires a valid referrer session', async () => {
    const resp = await httpGet(port, '/api/referrer/enabled-payout-methods', {});
    assert.equal(resp.status, 401);
  });
});
