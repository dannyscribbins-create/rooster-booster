'use strict';

// ── 3d PHASE 1a COMMIT 3 — crm_job_facts, crm_invoice_facts, crm_invoice_job_links ──
//
// Danny's Q4 ruling: jobs and invoices are stored as their OWN rows, not a derived boolean.
// Six properties, each one a rule the later sale-value commit depends on:
//   (i)   an invoice row keeps its amounts, dates and status
//   (ii)  money round-trips as an exact decimal, with no float in the path
//   (iii) an older Jobber updatedAt never overwrites a newer stored row
//   (iv)  ONE invoice row plus N link rows — never one invoice row per job
//   (v)   a voided invoice is KEPT as a fact, status verbatim
//   (vi)  tenancy: the same Jobber id under two contractors is two independent rows
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON, and a
// per-describe pool.end() kills the pool the next describe is about to use, which surfaces as
// CANCELLED tests rather than failures.
//
// ⚠ AND THE FIXTURE VALUES ARE CHOSEN TO DISCRIMINATE, WHICH IS THE POINT OF (ii). See the
// comment on MONEY_CASES: two of the three values pass against a float path, so a test built
// only from them would be vacuous.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  writeJobFacts,
  writeInvoiceFacts,
  writeInvoiceJobLinks,
  toMoneyString,
} = require('../utils/factCapture');

const A = 'cjif-tenant-a';
const B = 'cjif-tenant-b';

let pool;

const T1 = '2026-03-01T10:00:00.000Z';
const T2 = '2026-06-01T10:00:00.000Z';

function job(id, over = {}) {
  return {
    id,
    jobNumber: 101,
    jobStatus: 'active',
    jobType: 'ONE_OFF',
    title: 'Roof replacement',
    client: { id: 'jc-1' },
    quote: { id: 'q-1' },
    request: { id: 'r-1' },
    salesperson: { id: 'u-1' },
    createdAt: T1,
    updatedAt: T1,
    startAt: T1,
    endAt: T2,
    completedAt: T2,
    total: 29724.8,
    invoicedTotal: 29724.8,
    uninvoicedTotal: 0,
    ...over,
  };
}

function invoice(id, jobIds = [], over = {}) {
  return {
    id,
    invoiceNumber: 5001,
    invoiceStatus: 'paid',
    client: { id: 'jc-1' },
    amounts: {
      total: 29724.8,
      invoiceBalance: 0,
      paymentsTotal: 29724.8,
      depositAmount: 1000,
      subtotal: 27000.5,
      taxAmount: 2724.3,
      discountAmount: 0,
    },
    issuedDate: T1,
    dueDate: T2,
    receivedDate: T2,
    createdAt: T1,
    updatedAt: T1,
    jobs: { nodes: jobIds.map((j) => ({ id: j })), pageInfo: { hasNextPage: false } },
    ...over,
  };
}

const oneInvoice = async (contractor, id) => {
  const { rows } = await pool.query(
    `SELECT * FROM crm_invoice_facts WHERE contractor_id = $1 AND jobber_invoice_id = $2`,
    [contractor, id]
  );
  return rows[0];
};

const oneJob = async (contractor, id) => {
  const { rows } = await pool.query(
    `SELECT * FROM crm_job_facts WHERE contractor_id = $1 AND jobber_job_id = $2`,
    [contractor, id]
  );
  return rows[0];
};

const countOf = async (table, contractor) => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE contractor_id = $1`, [contractor]);
  return rows[0].n;
};

before(async () => {
  pool = await initTestDb();
});

after(async () => {
  await pool.end();
});

beforeEach(async () => {
  for (const t of ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[A, B]]);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(i) an invoice row keeps amounts, dates and status — not a boolean', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ SEEDED PAID WITH A NON-ZERO AMOUNT, DELIBERATELY. Zero and false are the column
  // defaults, so a fixture with a zero amount or an unpaid status passes against a writer
  // that stores nothing at all — vacuity shape #12, where the seeded state equals the broken
  // path's output.
  it('stores total, invoiceBalance, paymentsTotal and depositAmount', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'])]);
    const row = await oneInvoice(A, 'inv-1');
    assert.equal(row.total, '29724.80');
    assert.equal(row.invoice_balance, '0.00');
    assert.equal(row.payments_total, '29724.80');
    assert.equal(row.deposit_amount, '1000.00');
  });

  it('stores subtotal, taxAmount and discountAmount', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'])]);
    const row = await oneInvoice(A, 'inv-1');
    assert.equal(row.subtotal, '27000.50');
    assert.equal(row.tax_amount, '2724.30');
    assert.equal(row.discount_amount, '0.00');
  });

  it('stores every date and the status and number', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'])]);
    const row = await oneInvoice(A, 'inv-1');
    assert.equal(row.invoice_status, 'paid');
    assert.equal(row.invoice_number, '5001');
    assert.equal(row.jobber_client_id, 'jc-1');
    assert.equal(new Date(row.issued_date).toISOString(), T1);
    assert.equal(new Date(row.due_date).toISOString(), T2);
    assert.equal(new Date(row.received_date).toISOString(), T2);
  });

  it('a job row keeps its money, its dates and its three foreign Jobber ids', async () => {
    await writeJobFacts(pool, A, [job('job-1')]);
    const row = await oneJob(A, 'job-1');
    assert.equal(row.total, '29724.80');
    assert.equal(row.invoiced_total, '29724.80');
    assert.equal(row.uninvoiced_total, '0.00');
    assert.equal(row.jobber_quote_id, 'q-1');
    assert.equal(row.jobber_request_id, 'r-1');
    assert.equal(row.salesperson_jobber_user_id, 'u-1');
    assert.equal(row.job_status, 'active');
    assert.equal(row.job_type, 'ONE_OFF');
    assert.equal(row.title, 'Roof replacement');
    assert.equal(new Date(row.completed_at).toISOString(), T2);
  });

  it('a narrow capture does not disturb rows it did not see', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1']), invoice('inv-2', ['job-2'])]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'past_due', updatedAt: T2 })]);
    assert.equal((await oneInvoice(A, 'inv-1')).invoice_status, 'past_due');
    assert.equal((await oneInvoice(A, 'inv-2')).invoice_status, 'paid', 'inv-2 was not in the capture and must be untouched');
    assert.equal(await countOf('crm_invoice_facts', A), 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(ii) money round-trips as an exact decimal, with no float in the path', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ WHICH OF THESE ACTUALLY DISCRIMINATE WAS MEASURED, NOT REASONED — and the first guess
  // was wrong, which is why the measurement is recorded here instead of the guess. Injecting a
  // real[] cast in place of numeric[] takes **12599.25 and 1234567.89 RED and leaves 29724.8
  // GREEN**: 29724.8 survives a 4-byte float unharmed, so a test built from that value alone
  // would pass against the very defect it is meant to catch. The draft of this comment claimed
  // 12599.25 was also exactly representable and therefore non-discriminating; the guard-proof
  // says otherwise, and the guard-proof is the instrument.
  // ⚠ KEEP ALL THREE. The exact-trailing-zero case is what proves the FORMAT (29724.8 must
  // store as 29724.80), and the other two are what prove the PATH.
  const MONEY_CASES = [
    ['29724.8 keeps its trailing zero', 29724.8, '29724.80'],
    ['12599.25 is exact', 12599.25, '12599.25'],
    ['1234567.89 needs more precision than a 4-byte float has', 1234567.89, '1234567.89'],
  ];

  for (const [label, input, expected] of MONEY_CASES) {
    it(`stores ${label}`, async () => {
      await writeInvoiceFacts(pool, A, [invoice('inv-m', ['job-1'], {
        amounts: { total: input, invoiceBalance: 0, paymentsTotal: input, depositAmount: 0, subtotal: input, taxAmount: 0, discountAmount: 0 },
      })]);
      const row = await oneInvoice(A, 'inv-m');
      assert.equal(row.total, expected);
      assert.equal(row.payments_total, expected);
    });
  }

  it('toMoneyString formats a decimal STRING, never a number', () => {
    assert.equal(toMoneyString(29724.8), '29724.80');
    assert.equal(toMoneyString(0), '0.00');
    assert.equal(typeof toMoneyString(1), 'string', 'a number here lets a binary float decide the stored value');
    assert.equal(toMoneyString(null), null);
    assert.equal(toMoneyString(undefined), null);
  });

  it('money is DOLLARS, never cents — 29724.8 is not 297.24', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'])]);
    const row = await oneInvoice(A, 'inv-1');
    assert.equal(row.total, '29724.80');
    assert.notEqual(row.total, '297.24');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(iii) an older Jobber updatedAt never overwrites a newer stored row', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('an OLDER invoice fetch is refused', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'paid', updatedAt: T2 })]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'awaiting_payment', updatedAt: T1 })]);
    const row = await oneInvoice(A, 'inv-1');
    assert.equal(row.invoice_status, 'paid', 'the T1 fetch is older than the stored T2 row and must not land');
    assert.equal(new Date(row.updated_at).toISOString(), T2);
  });

  it('PAIRED POSITIVE — a NEWER fetch does land', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'awaiting_payment', updatedAt: T1 })]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'paid', updatedAt: T2 })]);
    assert.equal((await oneInvoice(A, 'inv-1')).invoice_status, 'paid');
  });

  it('an EQUAL updatedAt lands — re-capture of the same version is not refused', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'paid', updatedAt: T2 })]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'past_due', updatedAt: T2 })]);
    assert.equal((await oneInvoice(A, 'inv-1')).invoice_status, 'past_due');
  });

  it('an incoming NULL updatedAt cannot displace a stored timestamp', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'paid', updatedAt: T2 })]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'bad_debt', updatedAt: null })]);
    assert.equal((await oneInvoice(A, 'inv-1')).invoice_status, 'paid', 'a fetch that cannot prove it is newer must not win');
  });

  it('a stored NULL updatedAt is replaceable — we gain information', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'paid', updatedAt: null })]);
    await writeInvoiceFacts(pool, A, [invoice('inv-1', ['job-1'], { invoiceStatus: 'past_due', updatedAt: T1 })]);
    assert.equal((await oneInvoice(A, 'inv-1')).invoice_status, 'past_due');
  });

  it('the same guard holds for job facts', async () => {
    await writeJobFacts(pool, A, [job('job-1', { jobStatus: 'archived', updatedAt: T2 })]);
    await writeJobFacts(pool, A, [job('job-1', { jobStatus: 'active', updatedAt: T1 })]);
    assert.equal((await oneJob(A, 'job-1')).job_status, 'archived');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(iv) ONE invoice row plus N link rows, and re-capture adds no duplicates', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('an invoice covering two jobs is ONE invoice row and TWO link rows', async () => {
    const inv = invoice('inv-shared', ['job-1', 'job-2']);
    await writeInvoiceFacts(pool, A, [inv]);
    await writeInvoiceJobLinks(pool, A, [inv]);

    assert.equal(await countOf('crm_invoice_facts', A), 1, 'the invoice must be stored ONCE, keyed by its own id');
    assert.equal(await countOf('crm_invoice_job_links', A), 2);
  });

  it('SALE VALUE IS DOUBLE-COUNT-PROOF — summing DISTINCT invoices across both jobs gives the invoice once', async () => {
    const inv = invoice('inv-shared', ['job-1', 'job-2']);
    await writeJobFacts(pool, A, [job('job-1'), job('job-2')]);
    await writeInvoiceFacts(pool, A, [inv]);
    await writeInvoiceJobLinks(pool, A, [inv]);

    // The shape the later sale-value commit will use: collect DISTINCT invoice ids linked to
    // any job in the sale, then sum those invoices once each.
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(f.total), 0) AS value
         FROM crm_invoice_facts f
        WHERE f.contractor_id = $1
          AND f.jobber_invoice_id IN (
            SELECT DISTINCT l.jobber_invoice_id
              FROM crm_invoice_job_links l
             WHERE l.contractor_id = $1 AND l.jobber_job_id = ANY($2::text[])
          )`,
      [A, ['job-1', 'job-2']]
    );
    assert.equal(rows[0].value, '29724.80', 'one invoice across two jobs must contribute its total ONCE');
  });

  it('re-capturing the same invoice creates no duplicate rows or links', async () => {
    const inv = invoice('inv-shared', ['job-1', 'job-2']);
    for (let i = 0; i < 3; i += 1) {
      await writeInvoiceFacts(pool, A, [inv]);
      await writeInvoiceJobLinks(pool, A, [inv]);
    }
    assert.equal(await countOf('crm_invoice_facts', A), 1);
    assert.equal(await countOf('crm_invoice_job_links', A), 2);
  });

  it('a job REMOVED from an invoice stops being linked — the set is replaced, not merged', async () => {
    await writeInvoiceJobLinks(pool, A, [invoice('inv-1', ['job-1', 'job-2'])]);
    assert.equal(await countOf('crm_invoice_job_links', A), 2);
    await writeInvoiceJobLinks(pool, A, [invoice('inv-1', ['job-1'])]);
    const { rows } = await pool.query(
      `SELECT jobber_job_id FROM crm_invoice_job_links WHERE contractor_id = $1 ORDER BY jobber_job_id`,
      [A]
    );
    assert.deepEqual(rows.map((r) => r.jobber_job_id), ['job-1']);
  });

  it('archivedJobs links are recorded, and flagged as archived', async () => {
    await writeInvoiceJobLinks(pool, A, [invoice('inv-1', ['job-1'], {
      archivedJobs: { nodes: [{ id: 'job-archived' }], pageInfo: { hasNextPage: false } },
    })]);
    const { rows } = await pool.query(
      `SELECT jobber_job_id, from_archived_jobs FROM crm_invoice_job_links WHERE contractor_id = $1 ORDER BY jobber_job_id`,
      [A]
    );
    assert.deepEqual(rows, [
      { jobber_job_id: 'job-1', from_archived_jobs: false },
      { jobber_job_id: 'job-archived', from_archived_jobs: true },
    ]);
  });

  it('an INCOMPLETE job set THROWS and writes nothing — a replace from a truncated set would delete real links', async () => {
    await writeInvoiceJobLinks(pool, A, [invoice('inv-1', ['job-1', 'job-2'])]);
    assert.equal(await countOf('crm_invoice_job_links', A), 2);

    const truncated = invoice('inv-1', ['job-1']);
    truncated.jobs.pageInfo.hasNextPage = true;
    await assert.rejects(() => writeInvoiceJobLinks(pool, A, [truncated]), /job set is INCOMPLETE/);
    assert.equal(await countOf('crm_invoice_job_links', A), 2, 'the existing links must survive a refused write');
  });

  it('an incomplete archivedJobs page THROWS too', async () => {
    const bad = invoice('inv-1', ['job-1'], {
      archivedJobs: { nodes: [{ id: 'job-a' }], pageInfo: { hasNextPage: true } },
    });
    await assert.rejects(() => writeInvoiceJobLinks(pool, A, [bad]), /job set is INCOMPLETE/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(v) a voided invoice is KEPT as a fact, status verbatim', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('an invoice with status voided is stored, with the status Jobber sent', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-void', ['job-1'], {
      invoiceStatus: 'voided',
      amounts: { total: 9000, invoiceBalance: 9000, paymentsTotal: 0, depositAmount: 0, subtotal: 9000, taxAmount: 0, discountAmount: 0 },
    })]);
    const row = await oneInvoice(A, 'inv-void');
    assert.ok(row, 'a voided invoice must not be dropped at write time — its status IS the fact');
    assert.equal(row.invoice_status, 'voided');
    assert.equal(row.total, '9000.00');
  });

  it('a voided invoice keeps a NON-ZERO balance, so it can never read as paid', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-void', ['job-1'], {
      invoiceStatus: 'voided',
      amounts: { total: 9000, invoiceBalance: 9000, paymentsTotal: 0, depositAmount: 0, subtotal: 9000, taxAmount: 0, discountAmount: 0 },
    })]);
    const row = await oneInvoice(A, 'inv-void');
    assert.notEqual(row.invoice_balance, '0.00');
    // ⚠ "Paid" is invoiceBalance = 0 by ruling. THE EXCLUSION OF A VOIDED INVOICE FROM SALE
    // VALUE IS NOT ENFORCED HERE AND MUST NOT BE — a fact table records what Jobber said. The
    // decision path enforces it (Commit 4's decideFromFacts), and the sale-value consumer must
    // exclude it explicitly rather than relying on the balance happening to be non-zero.
  });

  it('a voided invoice is still LINKED to its jobs — the link is a fact too', async () => {
    const inv = invoice('inv-void', ['job-1'], { invoiceStatus: 'voided' });
    await writeInvoiceFacts(pool, A, [inv]);
    await writeInvoiceJobLinks(pool, A, [inv]);
    assert.equal(await countOf('crm_invoice_job_links', A), 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(vi) tenancy — the same Jobber id under two contractors is two rows', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('two contractors holding the same Jobber invoice id get independent rows', async () => {
    await writeInvoiceFacts(pool, A, [invoice('inv-same', ['job-1'], { invoiceStatus: 'paid' })]);
    await writeInvoiceFacts(pool, B, [invoice('inv-same', ['job-1'], { invoiceStatus: 'bad_debt' })]);

    assert.equal((await oneInvoice(A, 'inv-same')).invoice_status, 'paid');
    assert.equal((await oneInvoice(B, 'inv-same')).invoice_status, 'bad_debt');
    assert.equal(await countOf('crm_invoice_facts', A), 1);
    assert.equal(await countOf('crm_invoice_facts', B), 1);
  });

  it('two contractors holding the same Jobber job id get independent rows', async () => {
    await writeJobFacts(pool, A, [job('job-same', { jobStatus: 'active' })]);
    await writeJobFacts(pool, B, [job('job-same', { jobStatus: 'archived' })]);
    assert.equal((await oneJob(A, 'job-same')).job_status, 'active');
    assert.equal((await oneJob(B, 'job-same')).job_status, 'archived');
  });

  it('replacing one contractor link set leaves the other contractor untouched', async () => {
    await writeInvoiceJobLinks(pool, A, [invoice('inv-same', ['job-1', 'job-2'])]);
    await writeInvoiceJobLinks(pool, B, [invoice('inv-same', ['job-9'])]);

    // Replacing A's set must not reach into B's.
    await writeInvoiceJobLinks(pool, A, [invoice('inv-same', ['job-1'])]);
    assert.equal(await countOf('crm_invoice_job_links', A), 1);
    assert.equal(await countOf('crm_invoice_job_links', B), 1, 'B had one link and must still have it');
    const { rows } = await pool.query(
      `SELECT jobber_job_id FROM crm_invoice_job_links WHERE contractor_id = $1`,
      [B]
    );
    assert.deepEqual(rows.map((r) => r.jobber_job_id), ['job-9']);
  });
});
