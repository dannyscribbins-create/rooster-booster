'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — COMMIT (3): A GET REQUEST NEVER WRITES A MONEY ROW
//
// Danny's ruling, 2026-09-28, on finding 3.
//
// WHAT WAS WRONG. `GET /api/pipeline` INSERTed into `referral_conversions` every time a
// referrer opened their own screen, with `bonus_amount` taken from `item.payout` — the
// SPECULATIVE `500 + boost` ladder in `fetchPipelineForReferrer`, which reads no invoice,
// no job and no `referral_schedules` row.
//
// ⚠ AND `ON CONFLICT (user_id, jobber_client_id) DO NOTHING` MADE IT PERMANENT. The UNIQUE
// constraint means the FIRST writer wins forever, so this path RACED the invoice-paid
// webhook — the one place a payout is derived from a schedule and an invoice — and whichever
// arrived first fixed the amount beyond correction. A referrer could decide their own bonus
// by loading a page.
//
// ⚠ MEASURED, WHICH IS WHY THE FIXTURE BELOW IS SHAPED AS IT IS: production's two
// `referral_conversions` rows both carry ladder-shaped amounts, `activity_log` holds ZERO
// `referral_conversion` events (the webhook writes one unconditionally, so its absence is
// proof the webhook never booked them), and `SUM(paid_count)` was 1 against 2 rows — this
// path increments neither.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { request: _httpRequest } = require('node:http');

const referrerRouter = require('../routes/referrer');
const {
  seedContractor, seedUser, seedSession, startTestServer, stopTestServer,
} = require('./helpers');

const CONTRACTOR = 'accent-roofing';
const TOKEN = 'get-never-writes-money-token';
const REFERRER = 'Ladder Referrer';

function buildApp() {
  const express = require('express');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', referrerRouter);
  return app;
}

function httpGet(port, p, token) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: p, method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── THE FENCE ────────────────────────────────────────────────────────────────
// ⚠ NEEDLES ASSEMBLED FROM PIECES so this file cannot match itself, and the money-table
// names are never written whole here.
const MONEY_TABLES = ['referral' + '_conversions', 'cashout' + '_requests'];
const WRITE_VERBS = ['INSERT' + ' INTO', 'UPDATE', 'DELETE' + ' FROM'];

/** Every .js file under server/, excluding server/test — walked, never a typed list. */
function serverFiles() {
  const root = path.join(__dirname, '..');
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'test' && path.resolve(dir) === path.resolve(root)) continue;
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.js')) out.push(full);
    }
  })(root);
  return out;
}

// ⚠ COMMENTS ARE STRIPPED, AND THIS IS NOT PRECAUTIONARY — IT IS A LIVE INSTANCE.
// `routes/referrer.js` now carries a comment block explaining what was REMOVED, and it
// names both the verb and the table. Unstripped, this fence would flag the very comment
// recording the fix, which is CLAUDE.md's "a guard that fires on the prose beside it"
// with the sign flipped. Reworded prose was not the fix here — stripping was — because the
// comment has to be able to name what it removed.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extract every GET route handler, by matching parens from `router.get(` / `app.get(`
 * to the call's own closing paren. Returns { file, line, body }.
 * ⚠ PAREN MATCHING, NOT A LINE WINDOW. A fixed window would read into the next route and
 * attribute its writes to this one.
 */
function getRouteBodies() {
  const bodies = [];
  for (const file of serverFiles()) {
    const rel = path.relative(path.join(__dirname, '..', '..'), file);
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const re = /\b(?:router|app)\.get\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      let depth = 0;
      let i = m.index + m[0].length - 1;
      const start = i;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) break; }
      }
      bodies.push({
        file: rel,
        line: src.slice(0, m.index).split('\n').length,
        body: src.slice(start, i + 1),
      });
    }
  }
  return bodies;
}

/** Does this text write one of the money tables? Returns the offending descriptions. */
function moneyWritesIn(text) {
  const hits = [];
  for (const table of MONEY_TABLES) {
    for (const verb of WRITE_VERBS) {
      // The verb and the table in the same statement, in either order for UPDATE
      // (`UPDATE cashout_requests SET`) vs INSERT/DELETE (`INSERT INTO referral_conversions`).
      const re = new RegExp(verb + '\\s+' + table + '\\b', 'i');
      if (re.test(text)) hits.push(`${verb} ${table}`);
    }
  }
  return hits;
}

describe('payout commit (3) — a GET request never writes a money row', () => {
  let pool, server, port, userId;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildApp()));
  });

  after(async () => {
    referrerRouter._resetTestOverrides();
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    referrerRouter._resetTestOverrides();
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM sync_state');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');

    await seedContractor(pool, CONTRACTOR);
    // ⚠ A CONNECTED CRM IS REQUIRED OR THE ROUTE 503s BEFORE ITS BODY RUNS — AND THAT
    // FAILURE MODE IS WHY THE PRECONDITION ASSERTION IN THE FIRST CASE EARNS ITS PLACE.
    // The first writing of this file omitted this row, so `getCRMAdapter` threw
    // 'No connected CRM', the handler returned 503, and the two absence cases
    // ("repeated GETs still write nothing", "does not MODIFY an existing row") went
    // **GREEN** — because nothing ran at all. Only the case that asserts the removed
    // code's own trigger condition was MET could tell the difference. That is CLAUDE.md's
    // vacuity shape #9 exactly: a fixture establishing a proxy rather than the precondition.
    // ⚠ connection_method 'api_key', NOT 'oauth': the oauth branch calls
    // refreshTokenIfNeeded, which reaches Jobber. api_key keeps this suite offline, and
    // jobber.fetchPipelineForReferrer reads pipeline_cache only either way.
    await pool.query(
      `INSERT INTO contractor_crm_settings
         (contractor_id, crm_type, connection_method, api_key, is_connected)
       VALUES ($1, 'jobber', 'api_key', 'test-key-pay3', true)
       ON CONFLICT (contractor_id) DO UPDATE
         SET crm_type = 'jobber', connection_method = 'api_key',
             api_key = 'test-key-pay3', is_connected = true`,
      [CONTRACTOR]
    );
    userId = await seedUser(pool, {
      fullName: REFERRER, email: 'ladder@pay3.test', contractorId: CONTRACTOR,
    });
    await seedSession(pool, { userId, token: TOKEN, role: 'referrer', contractorId: CONTRACTOR });
  });

  /**
   * A pipeline_cache row that the OLD code would have written a conversion for:
   * 'paid' and NOT pre-start-date, which is exactly `bonusEarned === true`.
   * ⚠ fetchPipelineForReferrer READS ONLY pipeline_cache — no Jobber call — so this drives
   * the real adapter and the real route end to end with no network and no stub.
   */
  async function seedPaidPipelineRow(clientId = 'gid-pay3-001') {
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, $2, 'Paid Client', $3, 'paid', false, NOW(), NOW())`,
      [CONTRACTOR, clientId, REFERRER]
    );
  }

  const conversions = async () => (
    await pool.query('SELECT user_id, jobber_client_id, bonus_amount FROM referral_conversions')
  ).rows;

  // ── THE BEHAVIOURAL CASE ───────────────────────────────────────────────────

  it('⚠ a GET that MEETS the old write condition creates NO referral_conversions row', async () => {
    await seedPaidPipelineRow();
    assert.equal((await conversions()).length, 0, 'precondition: no conversions exist');

    const res = await httpGet(port, '/api/pipeline', TOKEN);
    assert.equal(res.status, 200);

    // ⚠ THE PRECONDITION ASSERTION IS WHAT STOPS THIS BEING VACUOUS, AND IT IS THE WHOLE
    // POINT OF THE CASE. An empty table proves nothing unless the removed code's own
    // trigger condition was actually met — otherwise the loop simply never ran and the
    // test would pass identically against the defect. The old code wrote when
    // `item.bonusEarned` was true, so that is asserted here, on the response itself.
    const item = (res.body.pipeline || []).find(p => p.id === 'gid-pay3-001');
    assert.ok(item, 'the seeded client must appear in the pipeline response');
    assert.equal(item.bonusEarned, true, 'and must satisfy the removed write\'s condition');
    assert.equal(typeof item.payout, 'number', 'and carry the speculative payout it would have written');

    assert.deepEqual(await conversions(), [], 'yet NOTHING may be written to referral_conversions');
  });

  it('repeated GETs still write nothing', async () => {
    await seedPaidPipelineRow();
    for (let i = 0; i < 3; i++) await httpGet(port, '/api/pipeline', TOKEN);
    assert.deepEqual(await conversions(), [], 'three loads, still no money rows');
  });

  it('a GET does not MODIFY an existing conversion row either', async () => {
    // ⚠ MEASURED: THIS CASE DOES **NOT** DISCRIMINATE AGAINST THE DEFECT THAT WAS REMOVED,
    // AND SAYING SO IS BETTER THAN LETTING THE NAME IMPLY IT DOES. Guard-proof (i) restored
    // the exact removed statement and this case stayed **GREEN** — correctly, because that
    // statement carried `ON CONFLICT (user_id, jobber_client_id) DO NOTHING`, so an existing
    // row is spared by construction. Its width came from the other two cases.
    // ⚠ WHAT IT DOES COVER IS A DIFFERENT WRITER SHAPE: a future `DO UPDATE SET
    // bonus_amount = EXCLUDED.bonus_amount`, which would overwrite a webhook-derived amount
    // with the speculative ladder and which "the table stays empty" could never see. Kept
    // for that, deliberately, rather than deleted as redundant.
    await seedPaidPipelineRow();
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, $2, 'gid-pay3-001', 777)`,
      [userId, CONTRACTOR]
    );
    await httpGet(port, '/api/pipeline', TOKEN);
    const rows = await conversions();
    assert.equal(rows.length, 1, 'the existing row must survive');
    assert.equal(Number(rows[0].bonus_amount), 777, 'and must be UNCHANGED');
  });

  it('the pipeline response is unchanged — payout and conversion_bonus still render', async () => {
    // ⚠ DANNY RULED THE DISPLAY STAYS AS IT WAS. This pins that the removal did not also
    // strip the fields, which would have been an easy over-correction.
    await seedPaidPipelineRow();
    const res = await httpGet(port, '/api/pipeline', TOKEN);
    const item = (res.body.pipeline || []).find(p => p.id === 'gid-pay3-001');
    assert.equal(item.status, 'complete', "a 'paid' row still maps to 'complete'");
    assert.ok(Object.prototype.hasOwnProperty.call(item, 'payout'));
    assert.ok(Object.prototype.hasOwnProperty.call(item, 'conversion_bonus'));
    assert.equal(typeof res.body.balance, 'number', 'and the top-level balance still renders');
  });

  // ── THE CLAUDE.md NON-NEGOTIABLE ───────────────────────────────────────────

  it('⚠ NON-NEGOTIABLE: no item at the \'sold\' stage carries a bonus dollar amount', async () => {
    // CLAUDE.md, Never Break → Frontend Rules: "Never display referral bonus dollar amount
    // at `sold` stage — bonus only shown at `complete`". Re-checked here because this commit
    // edits the handler that assembles the payload.
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, 'gid-pay3-sold', 'Sold Client', $2, 'sold', false, NOW(), NOW())`,
      [CONTRACTOR, REFERRER]
    );
    await seedPaidPipelineRow('gid-pay3-paid');

    const res = await httpGet(port, '/api/pipeline', TOKEN);
    const sold = (res.body.pipeline || []).filter(p => p.status === 'sold');
    assert.ok(sold.length >= 1, 'precondition: a sold row must be present, or this proves nothing');
    for (const p of sold) {
      assert.equal(p.bonusEarned, false, "a 'sold' item must not report a bonus as earned");
      assert.equal(p.payout, null, "and must carry NO payout amount");
      assert.equal(p.conversion_bonus, null, 'and no confirmed bonus either');
    }
    // ⚠ PAIRED POSITIVE: the 'complete' item DOES carry one, so the assertions above are
    // not satisfied by a payload that simply never populates these fields.
    const complete = (res.body.pipeline || []).find(p => p.status === 'complete');
    assert.ok(complete, 'a complete item must be present');
    assert.equal(typeof complete.payout, 'number', 'and it must carry an amount');
  });

  // ── THE FENCE ──────────────────────────────────────────────────────────────

  it('HARNESS FLOOR: GET routes are actually being extracted', async () => {
    // ⚠ WITHOUT THIS, THE FENCE BELOW PASSES BECAUSE THE EXTRACTOR FOUND NOTHING, which is
    // indistinguishable from a codebase whose GET routes are all clean. A regex that stops
    // matching — a rename to `router.route(...).get(...)`, say — would silently switch the
    // whole fence off.
    const bodies = getRouteBodies();
    assert.ok(bodies.length >= 20, `expected many GET routes, extracted ${bodies.length}`);
    assert.ok(
      bodies.some(b => b.file.replace(/\\/g, '/') === 'server/routes/referrer.js'),
      'referrer.js must be among them — it is the file this commit edits'
    );
  });

  it('HARNESS FLOOR: the money-write needle matches a REAL money write', async () => {
    // ⚠ THE OTHER HALF OF THE NON-VACUITY PROOF. The floor above shows the extractor works;
    // this shows the DETECTOR works. Pointed at the invoice-paid webhook, which legitimately
    // inserts a conversion, the needle must fire — otherwise "no GET route writes money"
    // could mean "the needle never matches anything anywhere".
    const webhook = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8'
    );
    const hits = moneyWritesIn(stripComments(webhook));
    assert.ok(hits.length >= 1, `the needle must detect the webhook's conversion insert; got ${JSON.stringify(hits)}`);
  });

  it('⚠ FENCE: no GET route anywhere in server/ writes referral_conversions or cashout_requests', async () => {
    // ⚠ WHAT THIS FENCE CANNOT SEE, STATED RATHER THAN ASSUMED AWAY: it matches SQL written
    // DIRECTLY inside a GET handler. A GET that calls a helper which writes is invisible to
    // it. The closure was checked BY HAND once, at this commit: every remaining write to
    // either table sits in a POST, PATCH or DELETE handler or in the invoice-paid webhook —
    // account.js's DELETE /me, admin/cashouts.js's PATCH, referrer.js's POST /api/cashout,
    // stripe.js's POST transfer, and the webhook. A require-closure fence would fire on
    // every route file that merely imports the pool and would be switched off in a month.
    const offenders = [];
    for (const b of getRouteBodies()) {
      const hits = moneyWritesIn(b.body);
      if (hits.length) offenders.push(`${b.file}:${b.line} — ${hits.join(', ')}`);
    }
    assert.deepEqual(
      offenders, [],
      'a GET route writes a money table at:\n' + offenders.map(o => `  ${o}`).join('\n') +
      '\nA GET must never write. Move it to the POST/webhook path that owns the decision.'
    );
  });
});
