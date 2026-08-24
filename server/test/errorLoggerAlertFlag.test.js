'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.2 ITEM 2 — T10. logError({ alert: false }) suppresses the email and
// still writes the row. RED FIRST: the flag does not exist yet, so today the
// alert fires regardless.
//
// ⚠ LIVE-SEND GUARD, AND IT IS LOAD-BEARING. .env.test does not set
// RESEND_API_KEY, but setup.js loads .env alongside it and the REAL key leaks
// into the test process — see the same note in attributionWiring.test.js and
// signupTenantStamp.test.js. errorLogger.js builds its Resend instance at
// require() time, so a post-require env mutation cannot help. The require.cache
// stub below must therefore be installed BEFORE ./setup is required (setup ->
// db.js -> errorLogger). Without it this file would send real mail to
// admin1@roofmiles.com on every run.
//
// The stub doubles as T10's observation channel: sendErrorAlert() is private and
// unexported, so "did an alert fire" is only observable at the Resend boundary.
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
          send: async (msg) => { sentEmails.push(msg); return { data: { id: 'test-stub' }, error: null }; },
        };
      }
    },
  },
};

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { logError } = require('../middleware/errorLogger');

describe('Wave 0.2 item 2 — logError alert suppression (T10)', () => {
  let pool;

  before(async () => { pool = await initTestDb(); });
  after(async () => { await pool.end(); });

  beforeEach(async () => {
    sentEmails.length = 0;
    await pool.query('DELETE FROM error_log');
  });

  // Proves the stub is wired. Without this, a stub that silently failed to
  // install would make the suppression test below pass for the wrong reason —
  // "no email sent" is indistinguishable from "email channel never worked".
  it('T10 harness — the Resend stub is installed and observable', async () => {
    await logError({ req: null, error: new Error('T10 harness probe — stub reachability') });
    assert.equal(sentEmails.length, 1, 'the stub must observe an alert on a first-occurrence error');
    assert.match(sentEmails[0].to, /admin1@roofmiles\.com/, 'and it must be the real alert payload');
  });

  // ── DIRECTION 1 — the RED one. Suppression must work. ─────────────────────
  it('T10a — alert:false writes the error_log row and sends NO email (RED: logError destructures only { req, error, contractorId, source }, so an alert key is ignored and sendErrorAlert fires anyway)', async () => {
    await logError({
      req: null,
      error: new Error('T10a — high-cardinality skip record, must not email'),
      alert: false,
    });

    const { rows } = await pool.query(
      `SELECT error_message, count FROM error_log WHERE error_message LIKE 'T10a%'`
    );
    assert.equal(rows.length, 1, 'the row must still be written — suppression is about the EMAIL, not the record');
    assert.equal(rows[0].count, 1, 'and it must be a first occurrence, so the alert would otherwise have fired');

    assert.equal(sentEmails.length, 0,
      `alert:false must suppress the email — ${sentEmails.length} were sent`);
  });

  // ── DIRECTION 2 — the inverse. ⚠ GREEN TODAY, and that is the point. ──────
  // A suppression flag proven only in the suppressing direction is a flag that
  // might suppress EVERYTHING. This assertion is what catches an implementation
  // that reads the option wrongly (e.g. `if (opts.alert === false)` written as
  // `if (!opts.alert)`, which would suppress every caller that omits the key —
  // all 380 of them). It is green before the change and must stay green after.
  it('T10b — WITHOUT the flag the alert still fires, and the default is alert-ON (green today; it is the direction that proves the flag does not suppress everything)', async () => {
    await logError({
      req: null,
      error: new Error('T10b — ordinary error, must still alert'),
    });

    const { rows } = await pool.query(
      `SELECT error_message FROM error_log WHERE error_message LIKE 'T10b%'`
    );
    assert.equal(rows.length, 1, 'the row must be written');

    assert.equal(sentEmails.length, 1,
      'a caller that does not pass the flag must keep alerting — the opt-out must never become the default');
  });

  // Explicit alert:true must behave exactly like omitting it. Cheap, and it pins
  // the tri-state (true / false / absent) rather than leaving the third case to
  // be discovered by a caller.
  it('T10c — alert:true behaves identically to omitting the flag', async () => {
    await logError({
      req: null,
      error: new Error('T10c — explicit alert true'),
      alert: true,
    });
    assert.equal(sentEmails.length, 1, 'an explicit alert:true must alert');
  });
});
