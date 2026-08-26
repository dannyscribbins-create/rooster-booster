'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.4 — GATE BYPASS REPAIR. RED-FIRST.
//
// Wave 0.4 created a state that had never existed in production: MATCHED BUT
// NOT INVITED — contact columns populated, needs_admin_verification false,
// invite_channel 'none', invite_sent_at NULL. Production row 18 is the first
// instance ever.
//
// The admin card renders "Resend Invite" and "Follow Up" on such a row, and
// BOTH send routes were written for rows that HAD been invited. Neither reads
// the referral_match_outreach gate. Neither could: isMatchOutreachEnabled was
// added to pendingReferral.js and not exported, so the gate is structurally
// unreachable from any route — the same defect as fetchReferrerContact, in the
// same file, reintroduced hours after being corrected.
//
// ⚠ THE POLICY IS REFUSAL, NOT OVERRIDE (ruled). An admin-initiated send with
// the gate closed returns an error naming the toggle. An override on a
// deliberate click is exactly how a contractor sends forty invites they did not
// mean to send: the card's own copy reads "Invite pending your approval", which
// reads as an instruction to click. The toggle is one click away and IS the
// deliberate act. Forward-only still holds, so opening it does not release the
// backlog — refusal routes the admin to the control, it does not trap them.
//
// ⚠ EVERY SUPPRESSION TEST HAS A POSITIVE CONTROL. A route that refuses with
// the gate closed proves nothing if it also refuses with the gate open — that
// is a broken route, not a working gate.
// ─────────────────────────────────────────────────────────────────────────────

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
          send: async (msg) => { sentEmails.push(msg); return { data: { id: 'gb-stub' }, error: null }; },
        };
      }
    },
  },
};

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');
// Fenced, not merely stubbed: /confirm-referrer resolves contact details through
// fetchReferrerContact, which posts to api.getjobber.com. Unfenced this file
// would reach the network with a live key present in the process (setup.js loads
// .env alongside .env.test). The canned reply also gives the route a REAL email
// to send to, which is what makes B4's "nothing went out" assertion mean
// something — without it the route sends nothing regardless of the gate and B4
// passes vacuously.
const axios = require('axios');

const TENANT = 'gb-tenant';
const GATE_KEY = 'referral_match_outreach';

function httpPost(port, path, bodyObj, token) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj || {}));
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      {
        hostname: 'localhost', port, path, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuf.length,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
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
    req.write(bodyBuf);
    req.end();
  });
}

describe('Wave 0.4 — admin send routes must honour the outreach gate (RED first)', () => {
  let pool, server, port, realAxiosPost;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
    realAxiosPost = axios.post;
  });

  after(async () => {
    axios.post = realAxiosPost;
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    // Canned Jobber reply carrying a real address, so the confirm path has
    // something to send and its suppression assertion is non-vacuous.
    axios.post = async () => ({
      data: { data: { client: {
        emails: [{ address: 'confirmed.referrer@fixture.test.invalid', description: 'Main' }],
        phones: [],
      } } },
    });
    await pool.query('DELETE FROM pending_referrals WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM notification_preferences WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM sessions WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM team_members WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM jobber_clients WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM tokens WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM contractors WHERE id = $1', [TENANT]);

    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, 'GB Roofing')
       ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]
    );
    // fetchReferrerContact refuses without a usable token and returns two nulls,
    // which would silently re-vacuum B4's suppression assertion.
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'gb-access', 'gb-refresh', NOW() + interval '120 minutes')`, [TENANT]
    );
  });

  // ── HARNESS ────────────────────────────────────────────────────────────────

  async function adminToken(tag) {
    const hash = await bcrypt.hash('TestAdmin123!', 4);
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
      [TENANT, `owner-${tag}@gate-bypass-test.invalid`, hash]
    );
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, TENANT, rows[0].id]
    );
    return token;
  }

  async function setGate(enabled) {
    await pool.query(
      `INSERT INTO notification_preferences (contractor_id, trigger_key, email_enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contractor_id, trigger_key) DO UPDATE SET email_enabled = EXCLUDED.email_enabled`,
      [TENANT, GATE_KEY, enabled]
    );
  }

  // The state Wave 0.4 created and that had never existed before: matched, with
  // contact details, and never invited.
  async function seedHeldRow() {
    const { rows } = await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          referred_by_email, referred_by_phone,
          invite_channel, invite_sent_at, status, needs_admin_verification)
       VALUES ($1, 'jc-held', 'Referred Person', 'Held Referrer',
               'held.referrer@fixture.test.invalid', NULL,
               'none', NULL, 'pending', false)
       RETURNING id`,
      [TENANT]
    );
    return rows[0].id;
  }

  const rowById = async (id) => (await pool.query('SELECT * FROM pending_referrals WHERE id=$1', [id])).rows[0];

  // ── 1 — THE GATE MUST BE REACHABLE AT ALL ──────────────────────────────────
  // ⚠ This is the defect that makes the other four unfixable, and it produces
  // NO ERROR at require time: destructuring a missing name yields undefined and
  // only fails when called. Asserted at the module boundary rather than through
  // a route, so the failure names the real cause instead of surfacing as a 500.
  it('B1 — isMatchOutreachEnabled is exported from pendingReferral.js (RED: it is not, so no route can consult the gate even if written to — the same defect as fetchReferrerContact, in the same file)', () => {
    const mod = require('../utils/pendingReferral');
    assert.equal(typeof mod.isMatchOutreachEnabled, 'function',
      'the gate must be importable by the routes that send invites — it is currently module-private');
  });

  // ── 2 — /resend HONOURS THE GATE ───────────────────────────────────────────
  it('B2 — POST /resend REFUSES with the gate closed and sends nothing (RED: the route checks status and contact info only, then calls sendPendingInviteEmail directly — a live gate bypass)', async () => {
    const token = await adminToken('b2');
    const id = await seedHeldRow();

    const res = await httpPost(port, `/api/admin/pending-referrals/${id}/resend`, {}, token);

    assert.equal(sentEmails.length, 0,
      `nothing may go out while the gate is closed — ${sentEmails.length} sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
    assert.equal(res.status, 400, `expected a refusal, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(String(res.body?.error || ''), /outreach/i,
      `the refusal must name the control the admin needs — got ${JSON.stringify(res.body)}`);
  });

  // ⚠ POSITIVE CONTROL for B2. A route that refuses in both directions is a
  // broken route, not a working gate, and B2 alone cannot tell them apart.
  it('B3 — POST /resend DOES send with the gate open (the partner that stops B2 from being satisfied by a route that refuses everything)', async () => {
    const token = await adminToken('b3');
    await setGate(true);
    const id = await seedHeldRow();

    const res = await httpPost(port, `/api/admin/pending-referrals/${id}/resend`, {}, token);

    assert.equal(res.status, 200, `expected success with the gate open, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(sentEmails.some(e => /held\.referrer@fixture\.test\.invalid/.test(e.to)),
      `the invite must go out when the gate is open — sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
  });

  // ── 3 — /confirm-referrer HONOURS THE GATE ─────────────────────────────────
  // ⚠ THIS PATH IS THE ONE WAVE 0.4 ACTIVATED. Before the wave it was
  // unreachable, because jobber_name_matches was always [] so the "Confirm This
  // Referrer" button never rendered. The matcher now writes real candidates.
  it('B4 — POST /confirm-referrer REFUSES with the gate closed and sends nothing (RED: it sends unconditionally, and this is the path the matcher rebuild just brought to life)', async () => {
    const token = await adminToken('b4');
    const { rows } = await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          invite_channel, status, needs_admin_verification, jobber_name_matches)
       VALUES ($1, 'jc-ambig', 'Referred Person', 'Ambiguous Referrer',
               'none', 'pending', true, '[]'::jsonb)
       RETURNING id`,
      [TENANT]
    );
    const id = rows[0].id;

    // ⚠ referrer_jobber_id IS SUPPLIED DELIBERATELY. Without it the route
    // resolves no contact, sends nothing regardless of the gate, and the
    // assertion below passes vacuously — which is exactly what the first run of
    // this test did: it returned 200 with inviteChannel "none", so "nothing was
    // sent" was true and meaningless.
    const res = await httpPost(port, `/api/admin/pending-referrals/${id}/confirm-referrer`,
      { referrer_name: 'Ambiguous Referrer', referrer_jobber_id: 'jc-referrer-1' }, token);

    assert.equal(sentEmails.length, 0,
      `nothing may go out while the gate is closed — ${sentEmails.length} sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
    assert.equal(res.status, 400, `expected a refusal, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(String(res.body?.error || ''), /outreach/i,
      `the refusal must name the control — got ${JSON.stringify(res.body)}`);
  });

  it('B5 — POST /confirm-referrer still resolves the referrer with the gate OPEN (positive control: proves B4 refuses because of the gate, not because the route is broken)', async () => {
    const token = await adminToken('b5');
    await setGate(true);
    const { rows } = await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          invite_channel, status, needs_admin_verification, jobber_name_matches)
       VALUES ($1, 'jc-ambig2', 'Referred Person', 'Old Name',
               'none', 'pending', true, '[]'::jsonb)
       RETURNING id`,
      [TENANT]
    );
    const id = rows[0].id;

    const res = await httpPost(port, `/api/admin/pending-referrals/${id}/confirm-referrer`,
      { referrer_name: 'Chosen Referrer', referrer_jobber_id: 'jc-referrer-1' }, token);

    assert.equal(res.status, 200, `expected success with the gate open, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(sentEmails.some(e => /confirmed\.referrer@fixture\.test\.invalid/.test(e.to)),
      `the invite must actually go out with the gate open — sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
    const row = await rowById(id);
    assert.equal(row.referred_by_name, 'Chosen Referrer', 'the confirmation must still record the admin\'s choice');
    assert.equal(row.needs_admin_verification, false, 'and clear the verification flag');
  });

  // ── 4 — A SEND ON A NEVER-INVITED ROW MUST SET invite_sent_at ──────────────
  // ⚠ TWO THINGS BREAK IF IT ONLY WRITES invite_resent_at, and both are silent.
  // The row keeps rendering as HELD (isHeld requires invite_sent_at IS NULL), so
  // the admin sends and the card says nothing was sent. And Wave 0.4's own
  // idempotency guard reads invite_sent_at, so the matcher would invite AGAIN on
  // the next sync — two invites from one click.
  it('B6 — a /resend on a never-invited row sets invite_sent_at, not only invite_resent_at (RED: the route writes invite_resent_at alone, leaving the row rendering as held and the matcher blind to the send)', async () => {
    const token = await adminToken('b6');
    await setGate(true);
    const id = await seedHeldRow();

    const before = await rowById(id);
    assert.equal(before.invite_sent_at, null, 'precondition: the row must start never-invited');

    const res = await httpPost(port, `/api/admin/pending-referrals/${id}/resend`, {}, token);
    assert.equal(res.status, 200, `precondition: the send must succeed — got ${res.status}: ${JSON.stringify(res.body)}`);

    const after = await rowById(id);
    assert.ok(after.invite_sent_at,
      'invite_sent_at must be set once an invite has actually gone out, or the row still reads as held and the matcher will send a second one');
  });

  // ── 5 — THE RENDER CONDITION IS TESTED ON THE REACT SIDE ───────────────────
  // Item 4 of the ruling (both send buttons must not render on a held row) is a
  // component concern and lives in AdminPendingReferralsHeld.test.jsx. Named
  // here so the split is deliberate rather than an omission.
});
