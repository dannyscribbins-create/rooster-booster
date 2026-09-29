'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 5 — CAPTURE `waitingForFinancedPayment`
//
// `evaluateReferral`'s Step 4 defers a conversion when Jobber says an invoice is waiting on a
// financed payment. Before this commit the field was selected by exactly ONE query — the
// webhook router's `fetchInvoiceWithJobs` — and stored nowhere. So anything deciding from SAVED
// FACTS read `undefined`, `undefined === true` is false, the gate did not fire, and **a financed
// invoice that should have been deferred would have converted.** Silent, and money.
//
// ⚠ THE COLUMN IS THREE-VALUED AND THE THIRD VALUE IS THE WHOLE POINT. `NULL` means "nobody
// asked" — it is NOT "not financed". A `BOOLEAN NOT NULL DEFAULT FALSE` column, which is what
// the sibling `crm_request_facts.assigned_users_truncated` uses, would have asserted of every
// row captured before this commit that it is safe to pay a bonus on. That claim was never
// checked, so it must not be stored.
//
// ⚠ THE MONEY RULE FOR COMMIT 7, RECORDED HERE AS WELL AS IN THE DESIGN: a NULL is **not
// eligible**. Never `waiting_for_financed_payment IS NOT TRUE` as a conversion gate — that reads
// unknown as permission. The invoice is re-captured before any conversion decision is taken.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET — contractors and crm_invoice_facts.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { writeInvoiceFacts } = require('../utils/factCapture');

const TENANT = 'financed-capture-tenant';
const CLIENT = 'Z2lkOi8vSm9iYmVyL0NsaWVudC84ODAwMDE=';

let pool;

/** One invoice node. `financed` may be true, false, or omitted entirely. */
function invoiceNode(id, financed) {
  const node = {
    id,
    invoiceNumber: '1001',
    invoiceStatus: 'paid',
    client: { id: CLIENT },
    amounts: { total: 1000, subtotal: 1000, invoiceBalance: 0, paymentsTotal: 1000,
      depositAmount: 0, discountAmount: 0, taxAmount: 0 },
    issuedDate: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    receivedDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (financed !== undefined) node.waitingForFinancedPayment = financed;
  return node;
}

const financedOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT waiting_for_financed_payment AS f FROM crm_invoice_facts
      WHERE contractor_id = $1 AND jobber_invoice_id = $2`, [TENANT, id]);
  return rows.length ? rows[0].f : undefined;
};

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, [TENANT]);
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
});

describe('N4 commit 5 — the stored value is three-valued', () => {
  it('a FINANCED invoice stores true', async () => {
    await writeInvoiceFacts(pool, TENANT, [invoiceNode('inv-financed', true)]);
    assert.equal(await financedOf('inv-financed'), true);
  });

  it('a NON-FINANCED invoice stores false', async () => {
    // The paired positive for the case above. Without it, a writer that stored `true` for
    // everything would pass — and the gate would then defer every conversion forever, which is
    // a different defect with the same fixture.
    await writeInvoiceFacts(pool, TENANT, [invoiceNode('inv-plain', false)]);
    assert.equal(await financedOf('inv-plain'), false);
  });

  it('an ABSENT field stores NULL, never false', async () => {
    // ⚠ THE LOAD-BEARING CASE. `false` here means "not financed" and is permission to convert;
    // `null` means "nobody asked". A `|| false` or a `!!` in the writer collapses the two, and
    // the difference is a bonus paid on an invoice Jobber wanted deferred.
    await writeInvoiceFacts(pool, TENANT, [invoiceNode('inv-unknown', undefined)]);
    assert.equal(await financedOf('inv-unknown'), null, 'an unasked field must be NULL');
  });

  it('an explicit null stores NULL', async () => {
    const node = invoiceNode('inv-null', undefined);
    node.waitingForFinancedPayment = null;
    await writeInvoiceFacts(pool, TENANT, [node]);
    assert.equal(await financedOf('inv-null'), null);
  });

  it('a non-boolean value stores NULL rather than being coerced', async () => {
    // Jobber would not send these, and that is exactly why the guard is `typeof === 'boolean'`
    // rather than a truthiness test: a string 'false' is truthy, and `!!'false'` is `true` —
    // the worst available answer. CLAUDE.md's "write the guard the value needs" rule.
    for (const [id, value] of [['inv-str', 'false'], ['inv-zero', 0], ['inv-one', 1]]) {
      const node = invoiceNode(id, undefined);
      node.waitingForFinancedPayment = value;
      await writeInvoiceFacts(pool, TENANT, [node]);
      assert.equal(await financedOf(id), null, `${JSON.stringify(value)} must not be coerced`);
    }
  });

  it('a re-capture UPDATES the value rather than leaving the first answer standing', async () => {
    // A NULL row must be able to become a real boolean on the next capture — that is the whole
    // convergence story for the rows captured before this commit. `ON CONFLICT DO UPDATE` has to
    // carry the column, and a first draft that added it to the INSERT and not the UPDATE would
    // pass every case above and never converge.
    await writeInvoiceFacts(pool, TENANT, [invoiceNode('inv-converge', undefined)]);
    assert.equal(await financedOf('inv-converge'), null, 'precondition: it starts unknown');

    const later = invoiceNode('inv-converge', true);
    later.updatedAt = new Date(Date.now() + 60000).toISOString();
    await writeInvoiceFacts(pool, TENANT, [later]);
    assert.equal(await financedOf('inv-converge'), true, 'a later capture must fill the unknown');
  });
});

describe('N4 commit 5 — the column and the selections', () => {
  it('the column is NULLABLE and has no default', async () => {
    // ⚠ ASSERTED FROM THE LIVE SCHEMA, NOT FROM db.js\'s SOURCE TEXT. A migration that ran with
    // NOT NULL DEFAULT FALSE would leave the source saying one thing and the table another, and
    // it is the table the money path reads.
    const { rows } = await pool.query(
      `SELECT is_nullable, column_default, data_type FROM information_schema.columns
        WHERE table_name = 'crm_invoice_facts' AND column_name = 'waiting_for_financed_payment'`);
    assert.equal(rows.length, 1, 'the column must exist');
    assert.equal(rows[0].is_nullable, 'YES', 'NULL means "nobody asked" and must be storable');
    assert.equal(rows[0].column_default, null, 'a default would manufacture an answer');
    assert.equal(rows[0].data_type, 'boolean');
  });

  it('ALL THREE invoice capture selections carry the field', () => {
    // ⚠ THREE, NOT TWO — AND THE THIRD WAS FOUND BY THE reads-vs-selects FENCE RATHER THAN BY
    // THIS AUTHOR. The commit began by adding the field to `INVOICE_FIELDS` and
    // `REP_INVOICE_FIELDS`; the fence then failed naming `RELATED_INVOICE_FIELDS` in the webhook
    // router, which feeds the very same writer. That is the "sweep from the shared utility
    // outward" rule earning its place: the writer's reads are the authority, not a list of
    // queries someone remembered.
    const sites = [
      ['server/utils/jobberClientFetch.js', 'INVOICE_FIELDS'],
      ['server/jobs/repImportScope.js', 'REP_INVOICE_FIELDS'],
      ['server/routes/webhooks/jobber.js', 'RELATED_INVOICE_FIELDS'],
    ];
    for (const [rel, constName] of sites) {
      const src = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
      const m = new RegExp('const ' + constName + ' = `([\\s\\S]*?)`').exec(src);
      assert.ok(m, `harness: ${constName} must be locatable in ${rel}`);
      assert.ok(
        m[1].includes('waitingForFinancedPayment'),
        `${rel} :: ${constName} must select waitingForFinancedPayment — a writer reading a field `
        + 'no query selects stores NULL, and NULL reads as an answer rather than as "nobody looked"'
      );
    }
  });

  it('the writer guards on the VALUE\'S OWN SHAPE, not on truthiness', () => {
    // A source assertion, because the behavioural cases above cannot distinguish
    // `typeof === 'boolean'` from a longer chain that happens to agree on the fixtures tried.
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'factCapture.js'), 'utf8');
    const line = src.split('\n').find((l) => l.includes('waitingForFinancedPayment'));
    assert.ok(line, 'the writer must read the field');
    assert.ok(
      line.includes("typeof") && line.includes("'boolean'"),
      'the guard must test the value\'s own type; || false and !! both collapse absent into false'
    );
  });

  it('NO conversion gate reads this column as IS NOT TRUE anywhere in server/', () => {
    // ⚠ THE RULE THIS COMMIT EXISTS TO PROTECT, FENCED BEFORE THE CODE THAT WOULD BREAK IT IS
    // WRITTEN. `IS NOT TRUE` is SQL's way of folding NULL in with false, so it would convert on
    // unknown — the exact defect, re-created by a plausible-looking one-line gate. Commit 7 must
    // treat NULL as not-eligible instead.
    const root = path.join(__dirname, '..');
    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'test' && path.resolve(dir) === path.resolve(root)) continue;
          if (e.name === 'node_modules') continue;
          walk(full);
        } else if (e.name.endsWith('.js')) files.push(full);
      }
    })(root);
    assert.ok(files.length > 50, `harness: the walk must reach the server tree, saw ${files.length}`);

    const COL = 'waiting_for_financed' + '_payment';
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
      if (!src.includes(COL)) continue;
      const re = new RegExp(COL + '\\s+IS\\s+NOT\\s+TRUE', 'i');
      if (re.test(src)) {
        offenders.push(path.relative(path.join(__dirname, '..', '..'), f).replace(/\\/g, '/'));
      }
    }
    assert.deepEqual(
      offenders, [],
      'a gate written as IS NOT TRUE converts on unknown. Treat NULL as not eligible:\n  '
      + offenders.join('\n  ')
    );
    // NON-VACUITY: the needle must be able to match at all.
    assert.ok(
      new RegExp(COL + '\\s+IS\\s+NOT\\s+TRUE', 'i').test(`x ${COL} IS NOT TRUE y`),
      'harness: the needle must match its own synthetic case'
    );
  });
});
