'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 2, STEP 2B — POST /api/forgot-pin RESHAPED (D1)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §4.1, decision D1.
//
// forgot-pin retires the contractorSlug narrowing the same way login does, and
// for the same reason: the unified form has no tenant to send. But it cannot
// borrow login's answer, because there is no password here to disambiguate with
// — nothing is ever proven. So it does the only thing that leaks nothing: send
// one reset email PER matching account, each naming its own contractor in the
// body, and answer with the identical generic response every time.
//
// The recipient sorts it out from their inbox, where they are already
// authenticated by possession of the mailbox. The HTTP response must stay
// constant for N = 0, 1 and 2, or the endpoint becomes the account-enumeration
// oracle the generic response exists to prevent.
//
// RESEND INTERCEPTION — the require.cache pattern from
// forgotPinEmailEscaping.test.js, installed before anything that constructs a
// Resend client is required. No real mail is sent.
// ─────────────────────────────────────────────────────────────────────────────

const sentEmails = [];

const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async payload => {
            sentEmails.push(payload);
            return { data: { id: 'test-stub' }, error: null };
          },
        };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const FORGOT = '/api/forgot-pin';

const TENANT_A = 'tnt-forgot-a';
const TENANT_B = 'tnt-forgot-b';
const NAME_A = 'Alpha Roofing';
const NAME_B = 'Beta Exteriors';

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.94.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpPost(port, path, bodyObj) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Forwarded-For': nextIp(),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

let pool, server, port;

async function seedReferrer(contractorId, email) {
  const hash = await bcrypt.hash('placeholder-password', 10);
  await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ('Reset Requester', $1, $2, $3, true)`,
    [email, hash, contractorId]
  );
}

function emailsTo(address) {
  return sentEmails.filter(e => e.to === address);
}

describe('C/DL-3b Phase 2B — forgot-pin without a tenant', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await pool.query('DELETE FROM pin_reset_tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-forgot-%']);
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_A, TENANT_A]);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_B, TENANT_B]);
  });

  it('[RED] one matching account sends exactly one email', async () => {
    const email = 'single@forgot.test';
    await seedReferrer(TENANT_A, email);

    const res = await httpPost(port, FORGOT, { email });
    assert.equal(res.status, 200, res.raw);
    assert.equal(emailsTo(email).length, 1, 'one account, one email');
  });

  it('[RED] two matching accounts send two emails, each naming its own contractor', async () => {
    // The whole point of the reshape. Two accounts, two resets, and the person
    // tells them apart by the company name in the body — the only place it is
    // safe to disclose, because reaching the mailbox already proves possession.
    const email = 'double@forgot.test';
    await seedReferrer(TENANT_A, email);
    await seedReferrer(TENANT_B, email);

    const res = await httpPost(port, FORGOT, { email });
    assert.equal(res.status, 200, res.raw);

    const sent = emailsTo(email);
    assert.equal(sent.length, 2, `two accounts must produce two emails, got ${sent.length}`);
    assert.ok(sent.some(e => e.html.includes(NAME_A)), `no email named ${NAME_A}`);
    assert.ok(sent.some(e => e.html.includes(NAME_B)), `no email named ${NAME_B}`);
  });

  it('[RED] two matching accounts mint two distinct reset tokens', async () => {
    // A single shared token would let either email reset whichever account the
    // server picked first — the arbitrary-row bug, relocated into the mailbox.
    const email = 'tokens@forgot.test';
    await seedReferrer(TENANT_A, email);
    await seedReferrer(TENANT_B, email);

    await httpPost(port, FORGOT, { email });

    const { rows } = await pool.query(
      `SELECT prt.token, u.contractor_id
         FROM pin_reset_tokens prt JOIN users u ON u.id = prt.user_id
        WHERE LOWER(u.email) = LOWER($1) ORDER BY u.contractor_id`,
      [email]
    );
    assert.equal(rows.length, 2, `expected one token per account, got ${rows.length}`);
    assert.notEqual(rows[0].token, rows[1].token, 'each account needs its own token');
    assert.deepEqual(rows.map(r => r.contractor_id), [TENANT_A, TENANT_B]);
  });

  it('[RED] the response is byte-identical for zero, one and two matches', async () => {
    // The enumeration guard. If the body or the status varied with the number of
    // matches, an attacker would learn both whether an address is registered and
    // with how many contractors — strictly more than the old endpoint leaked.
    const none = await httpPost(port, FORGOT, { email: 'nobody@forgot.test' });

    await seedReferrer(TENANT_A, 'one@forgot.test');
    const one = await httpPost(port, FORGOT, { email: 'one@forgot.test' });

    await seedReferrer(TENANT_A, 'two@forgot.test');
    await seedReferrer(TENANT_B, 'two@forgot.test');
    const two = await httpPost(port, FORGOT, { email: 'two@forgot.test' });

    assert.equal(none.status, 200);
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.equal(none.raw, one.raw, 'zero and one match must be indistinguishable');
    assert.equal(one.raw, two.raw, 'one and two matches must be indistinguishable');
  });

  it('[RED] zero matches sends no email at all', async () => {
    // The counterweight to the test above: identical responses must not have been
    // achieved by sending mail to an address with no account behind it.
    const res = await httpPost(port, FORGOT, { email: 'nobody@forgot.test' });
    assert.equal(res.status, 200);
    assert.equal(emailsTo('nobody@forgot.test').length, 0, 'a miss must send nothing');
  });

  it('[RED] a request with no contractorSlug is served normally — the field is retired', async () => {
    // The old handler returned the generic response WITHOUT doing any work when
    // contractorSlug was absent, so every unified-form request silently did
    // nothing at all. Retiring the field has to mean the work now happens.
    const email = 'retired@forgot.test';
    await seedReferrer(TENANT_A, email);
    const res = await httpPost(port, FORGOT, { email });
    assert.equal(res.status, 200, res.raw);
    assert.equal(emailsTo(email).length, 1, 'a request with no tenant field must still send the reset');
  });

  it('[RED] a client-supplied contractorSlug does not narrow the result', async () => {
    // Hostile-payload parity with login: the retired field must be inert, not
    // quietly honoured. Naming tenant A must not suppress tenant B's email.
    const email = 'hostile@forgot.test';
    await seedReferrer(TENANT_A, email);
    await seedReferrer(TENANT_B, email);

    const res = await httpPost(port, FORGOT, { email, contractorSlug: TENANT_A });
    assert.equal(res.status, 200, res.raw);
    assert.equal(emailsTo(email).length, 2, 'a client-supplied tenant must not filter the matches');
  });

  it('[RED] matching is case-insensitive', async () => {
    const email = 'MixedCase@Forgot.Test';
    await seedReferrer(TENANT_A, email);
    const res = await httpPost(port, FORGOT, { email: 'mixedcase@forgot.test' });
    assert.equal(res.status, 200, res.raw);
    assert.equal(emailsTo(email).length, 1, 'the stored address must be reachable from a normalised form');
  });
});
