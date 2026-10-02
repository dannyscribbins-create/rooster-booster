'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 6 — ONE WRITER FOR referral_conversions
//
// A pure extraction ahead of commit 7. Commit 7 makes a revealed paid invoice credit a referrer
// automatically (Danny ruling 3), which means a SECOND caller starts writing conversions. Doing
// the extraction and the money change in one commit would produce a diff nobody can review, so
// the extraction lands first with the webhook's behaviour proven unchanged.
//
// ⚠ THE FENCE IS THE POINT OF THIS FILE. `referral_conversions` is the ledger every balance
// surface reads — `getCashoutBalance` is `SUM(bonus_amount)` minus cash-outs — and its integrity
// rests on there being exactly one writer. A second `INSERT INTO` anywhere is a second definition
// of what a referrer earned.
//
// ⚠ AND `UNIQUE(user_id, jobber_client_id)` IS A RESIDENT NON-NEGOTIABLE: one conversion per
// client ever. The writer's `ON CONFLICT DO NOTHING` is what makes a redelivered webhook harmless,
// so `inserted` reports which happened rather than the caller guessing from a row count.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET — contractors, users, referral_conversions.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { writeReferralConversion } = require('../utils/referralConversion');

const TENANT = 'conv-writer-tenant';
const SANCTIONED = 'server/utils/referralConversion.js';

let pool;
let userId;
let otherUserId;

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  await pool.query(`DELETE FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
  await pool.query(`DELETE FROM users WHERE contractor_id = $1`, [TENANT]);
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  const a = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id) VALUES ('Conv One','conv1@test.com','1234',$1) RETURNING id`,
    [TENANT]);
  userId = a.rows[0].id;
  const b = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id) VALUES ('Conv Two','conv2@test.com','1234',$1) RETURNING id`,
    [TENANT]);
  otherUserId = b.rows[0].id;
});

const args = (over = {}) => ({
  userId, contractorId: TENANT, jobberClientId: 'jc-conv-1', bonusAmount: 250, ...over,
});

describe('N4 commit 6 — the shared conversion writer', () => {
  it('writes the row and reports it as inserted and first', async () => {
    const r = await writeReferralConversion(pool, args());
    assert.equal(r.inserted, true);
    assert.ok(r.id, 'the new row id is returned');
    assert.equal(r.isFirstConversion, true);

    const { rows } = await pool.query(
      `SELECT user_id, contractor_id, jobber_client_id, bonus_amount, payout_status, converted_at
         FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, userId);
    assert.equal(rows[0].contractor_id, TENANT);
    assert.equal(rows[0].jobber_client_id, 'jc-conv-1');
    assert.equal(parseFloat(rows[0].bonus_amount), 250);
    assert.ok(rows[0].converted_at, 'converted_at is stamped');
  });

  it('a REDELIVERY writes no second row and reports inserted:false', async () => {
    await writeReferralConversion(pool, args());
    const second = await writeReferralConversion(pool, args());
    assert.equal(second.inserted, false, 'the UNIQUE constraint refused it');
    assert.equal(second.id, null, 'and no id is invented for a row that was not written');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows[0].n, 1, 'one conversion per client ever');
  });

  it('isFirstConversion is read BEFORE the insert, and is per USER', async () => {
    // ⚠ THE ORDERING IS THE REASON THE COUNT MOVED INTO THE WRITER. Taken AFTER the insert it
    // would always be false, and the #13 first-milestone email would never fire again — a
    // silent regression a call-site reorder could introduce without looking wrong.
    const first = await writeReferralConversion(pool, args());
    assert.equal(first.isFirstConversion, true);

    const second = await writeReferralConversion(pool, args({ jobberClientId: 'jc-conv-2' }));
    assert.equal(second.inserted, true, 'a DIFFERENT client is a new conversion');
    assert.equal(second.isFirstConversion, false, 'but no longer the referrer\'s first');

    // PAIRED POSITIVE: a different referrer's first conversion is still a first.
    const other = await writeReferralConversion(pool, args({ userId: otherUserId, jobberClientId: 'jc-conv-3' }));
    assert.equal(other.isFirstConversion, true, 'the count must be scoped to the user');
  });

  it('refuses a call missing any required value rather than writing a partial row', async () => {
    for (const missing of ['userId', 'contractorId', 'jobberClientId', 'bonusAmount']) {
      const bad = args();
      delete bad[missing];
      await assert.rejects(() => writeReferralConversion(pool, bad), new RegExp(missing));
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows[0].n, 0, 'no row may be written by a refused call');
  });

  it('a ZERO bonus is written, not refused — zero is a value, absent is not', async () => {
    // ⚠ THE GUARD IS `undefined || null`, NOT FALSINESS. A $0 conversion is a real thing:
    // production holds one (`bonus_amount 0.00`, the April row). `if (!bonusAmount)` would
    // refuse it, which is the shape CLAUDE.md's "write the guard the value needs" rule is about.
    const r = await writeReferralConversion(pool, args({ bonusAmount: 0 }));
    assert.equal(r.inserted, true);
    const { rows } = await pool.query(
      `SELECT bonus_amount FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
    assert.equal(parseFloat(rows[0].bonus_amount), 0);
  });

  it('accepts a transaction, not only the pool', async () => {
    // Commit 7 may want the conversion inside the same transaction as the status write, so the
    // db handle is the first argument. Proven by rolling one back.
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const r = await writeReferralConversion(tx, args({ jobberClientId: 'jc-rollback' }));
      assert.equal(r.inserted, true, 'it wrote inside the transaction');
      await tx.query('ROLLBACK');
    } finally {
      tx.release();
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM referral_conversions WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows[0].n, 0, 'a rolled-back transaction leaves no conversion');
  });
});

describe('N4 commit 6 — the single-writer fence', () => {
  const SERVER_ROOT = path.join(__dirname, '..');
  const REPO_ROOT = path.join(__dirname, '..', '..');

  // Needles assembled from pieces so this file cannot report itself if the walk ever widens.
  const TABLE = 'referral' + '_conversions';
  const VERB = 'INSERT' + ' INTO';

  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  const lineOf = (src, i) => src.slice(0, i).split('\n').length;

  function serverFiles() {
    const out = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'test' && path.resolve(dir) === path.resolve(SERVER_ROOT)) continue;
          if (e.name === 'node_modules') continue;
          walk(full);
        } else if (e.name.endsWith('.js')) out.push(full);
      }
    })(SERVER_ROOT);
    return out;
  }

  /** Every quoted span that INSERTs into the conversions table, with its file and line. */
  function insertSites() {
    const found = [];
    for (const file of serverFiles()) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      const src = strip(fs.readFileSync(file, 'utf8'));
      const re = /`[^`]*`|'[^'\n]*'|"[^"\n]*"/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const text = m[0];
        if (!text.includes(TABLE)) continue;
        if (!new RegExp(VERB + '\\s+' + TABLE, 'i').test(text)) continue;
        found.push({ file: rel, line: lineOf(src, m.index) });
      }
    }
    return found;
  }

  it('exactly ONE file INSERTs into the conversions ledger', () => {
    const sites = insertSites();
    const offenders = sites.filter((s) => s.file !== SANCTIONED).map((s) => `${s.file}:${s.line}`);
    assert.deepEqual(
      offenders, [],
      `${TABLE} is the ledger every balance surface reads. It must have ONE writer — `
      + `${SANCTIONED}. Import writeReferralConversion instead of writing:\n  `
      + offenders.join('\n  ')
    );
  });

  it('NON-VACUITY: the needle finds the sanctioned writer', () => {
    // Without this, a needle matching NOTHING passes identically to a codebase with one writer,
    // and every assertion above it would be about an empty set.
    const sites = insertSites();
    assert.ok(
      sites.some((s) => s.file === SANCTIONED),
      `harness: the needle must find the INSERT in ${SANCTIONED}; found `
      + (sites.map((s) => s.file).join(' | ') || '(nothing)')
    );
    assert.equal(sites.length, 1, `expected exactly one INSERT site, found ${sites.length}`);
  });

  it('PAIRED NEGATIVE: a SELECT, an UPDATE or a DELETE on the table is not flagged', () => {
    // The table is legitimately READ in several places — getCashoutBalance sums it, the admin
    // surfaces list it, the pipeline route joins it — and `payout_status` is legitimately
    // UPDATED by the cash-out path. A fence that flagged those would be carved out within a week.
    // ⚠ ASSEMBLED BY CONCATENATION RATHER THAN INTERPOLATION, AND THAT IS NOT STYLE — A
    // NEIGHBOURING FENCE MADE IT NECESSARY. `testResetCoverage.test.js` decides whether it can
    // read a suite's reset list, and a literal `DELETE FROM ${` anywhere in the file makes it
    // treat every reset here as interpolated; it then looks for an array of table names to
    // resolve, finds none, and records the whole suite as UNREADABLE — a pinned set, so this
    // file joined it and that case failed. Concatenation keeps the synthetic SQL readable to a
    // human while leaving no `DELETE FROM ${` for the scanner to trip on.
    const cases = [
      ['SELECT SUM(bonus_amount) FROM ', TABLE, ' WHERE user_id = $1'].join(''),
      ['UPDATE ', TABLE, " SET payout_status = 'paid' WHERE id = $1"].join(''),
      ['DELETE FROM ', TABLE, ' WHERE id = $1'].join(''),
    ];
    for (const sql of cases) {
      assert.ok(
        !new RegExp(VERB + '\\s+' + TABLE, 'i').test(sql),
        `the verb anchor must not flag: ${sql}`
      );
    }
    // And the discriminator must still fire on the real shape.
    assert.ok(
      new RegExp(VERB + '\\s+' + TABLE, 'i').test(`${VERB} ${TABLE} (user_id) VALUES ($1)`),
      'harness: the needle must match a genuine insert'
    );
  });

  it('the walk reaches the directories a second writer would plausibly live in', () => {
    const dirs = new Set(serverFiles().map((f) =>
      path.relative(REPO_ROOT, f).replace(/\\/g, '/').split('/')[1]));
    for (const d of ['routes', 'utils', 'jobs', 'cron', 'crm']) {
      assert.ok(dirs.has(d), `harness: the walk must reach server/${d}/`);
    }
  });

  it('the webhook no longer writes the conversion itself, and the ONE caller is the shared credit', () => {
    // ⚠ RE-POINTED BY C1, AND THE FLOOR IS WHY THIS CASE WENT RED RATHER THAN QUIETLY PASSING.
    // It required `webhooks/jobber.js` to still CALL `writeReferralConversion`. C1 moved that call into
    // `server/utils/referralCredit.js` — the shared credit every path now goes through — so the floor
    // failed LOUDLY on a moved target instead of slicing past it and asserting nothing. That is exactly
    // what a non-vacuity floor is for, and it is the second time this one has caught a relocation.
    //
    // ⚠ THE PROPERTY IS UNCHANGED: `referral_conversions` has exactly one writer. What moved is WHERE
    // that writer is called from, and the new target is more durable — a fence below keeps
    // `referralCredit.js` the only caller, so this cannot drift again without something going red.
    const webhookSrc = strip(fs.readFileSync(
      path.join(SERVER_ROOT, 'routes', 'webhooks', 'jobber.js'), 'utf8'));
    assert.ok(
      !new RegExp(VERB + '\\s+' + TABLE, 'i').test(webhookSrc),
      'the invoice-paid webhook must not write the conversion itself'
    );
    // ⚠ AND IT MUST NOT CALL THE WRITER EITHER, WHICH IS STRICTER THAN BEFORE. The door credits through
    // `creditReferralFromFacts`; a direct call here would be a second crediting path with none of the
    // gates the shared credit applies.
    assert.ok(
      !webhookSrc.includes('writeReferralConversion('),
      'the door must credit through creditReferralFromFacts, not by calling the writer directly'
    );

    const creditSrc = strip(fs.readFileSync(
      path.join(SERVER_ROOT, 'utils', 'referralCredit.js'), 'utf8'));
    assert.ok(
      creditSrc.includes('writeReferralConversion('),
      'HARNESS FLOOR: the shared credit must actually call the writer — an absence assertion alone '
      + 'would pass against a codebase that stopped writing conversions entirely'
    );
    // And the door must reach the credit, or the two assertions above are satisfied by a door that
    // simply does nothing.
    assert.ok(
      webhookSrc.includes('creditReferralFromFacts('),
      'HARNESS FLOOR: the invoice-paid door must still credit, through the shared credit'
    );
  });
});
