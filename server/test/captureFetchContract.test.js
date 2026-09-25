'use strict';

// ── 3d PHASE 1a COMMIT 2 — THE CAPTURE-PATH FETCH CONTRACT ───────────────────
//
// Four properties, and each one replaced a defect rather than describing a preference:
//   1. A 200 carrying an `errors` array is a FAILURE, not "no data".
//   2. The BOUNDARY FENCE — every field a consumer reads is actually SELECTED.
//   3. Every connection is paged to EXHAUSTION; no fixed cap silently drops records.
//   4. A fetched invoice carries the money, the dates, the status and its job ids.
//
// ⚠ NO NETWORK AND NO DATABASE. These fetches take a token and return an object, so the tests
// patch `axios.post` on the shared module object and drive the real functions. That is
// deliberate: the whole point is to exercise the REAL selection text, because a test that
// stubs the fetch and injects the value cannot discover that nothing upstream supplies it —
// which is exactly how loadContractorBranding() shipped a query missing two columns.
//
// ⚠ AND THE FENCE READS THE QUERY TEXT, NOT A CONSTANT THE QUERY ALSO READS. A fence fed by
// the thing it checks is one guard wearing two hats.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const axios = require('axios');
const fetchModule = require('../utils/jobberClientFetch');
const jobberRouter = require('../routes/webhooks/jobber');
const repImport = require('../jobs/repImportScope');

const { fetchFullClient } = fetchModule;
const { fetchClientRelatedData, fetchClientJobsForJobUpdate, fetchInvoiceWithJobs } = jobberRouter._captureFetches;

const CLIENT = 'jc-capture-1';
const TOKEN = 'tok-capture';

let realPost;
let calls;

// Installs a fake Jobber. `handler` receives ({ query, variables, callIndex }) and returns the
// object that becomes `response.data`.
function installJobber(handler) {
  calls = [];
  axios.post = async (url, body, config) => {
    calls.push({ url, query: body.query, variables: body.variables, headers: config.headers });
    const data = await handler({ query: body.query, variables: body.variables, callIndex: calls.length - 1 });
    return { data };
  };
}

// Which connection a follow-up query is paging, read off the query text.
function connectionOf(query) {
  if (/JobsPage/.test(query)) return 'jobs';
  if (/QuotesPage/.test(query)) return 'quotes';
  if (/RequestsPage/.test(query)) return 'requests';
  if (/InvoicesPage/.test(query)) return 'invoices';
  return 'base';
}

const page = (nodes, hasNextPage = false, endCursor = null) => ({
  nodes,
  pageInfo: { hasNextPage, endCursor },
});

const invoice = (id, jobIds = [], over = {}) => ({
  id,
  invoiceStatus: 'paid',
  createdAt: '2026-01-01T00:00:00Z',
  issuedDate: '2026-01-02T00:00:00Z',
  dueDate: '2026-02-01T00:00:00Z',
  amounts: { total: 1000.5, invoiceBalance: 0, paymentsTotal: 1000.5 },
  jobs: { nodes: jobIds.map((j) => ({ id: j })), pageInfo: { hasNextPage: false } },
  ...over,
});

const job = (id) => ({ id, jobStatus: 'active', createdAt: '2026-01-01T00:00:00Z' });

beforeEach(() => {
  realPost = axios.post;
  calls = [];
});

afterEach(() => {
  axios.post = realPost;
});

// ═════════════════════════════════════════════════════════════════════════════
describe('capture fetch — (i) a 200 with an errors array is a FAILURE, not an absence', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ THE PAIRED POSITIVE IS THE PROOF, NOT THE NEGATIVE. "It threw" is satisfied by any
  // broken fetch; what has to be true is that an ERROR and a genuine ABSENCE are told apart.
  it('fetchClientRelatedData THROWS on a 200 carrying errors, and the error names them', async () => {
    installJobber(() => ({ errors: [{ message: 'Field xyz does not exist' }], data: { client: null } }));

    await assert.rejects(
      () => fetchClientRelatedData(CLIENT, TOKEN),
      (err) => {
        assert.match(err.message, /Jobber GraphQL error/);
        assert.match(err.message, /Field xyz does not exist/);
        assert.ok(Array.isArray(err.jobberGraphQLErrors), 'the failure must be distinguishable by KIND, not by message text');
        assert.equal(err.jobberGraphQLErrors.length, 1);
        return true;
      }
    );
  });

  it('PAIRED POSITIVE — a clean 200 whose client is genuinely absent returns null, NOT an error', async () => {
    installJobber(() => ({ data: { client: null } }));
    const result = await fetchClientRelatedData(CLIENT, TOKEN);
    assert.equal(result, null);
  });

  it('the two outcomes are DISTINGUISHABLE — same null client, opposite handling', async () => {
    installJobber(() => ({ errors: [{ message: 'boom' }], data: { client: null } }));
    await assert.rejects(() => fetchClientRelatedData(CLIENT, TOKEN));

    installJobber(() => ({ data: { client: null } }));
    assert.equal(await fetchClientRelatedData(CLIENT, TOKEN), null);
    // ⚠ Both responses carry `data.client === null`. Before this commit both returned null,
    // so the ONLY difference between "Jobber said no" and "no such client" was discarded.
  });

  it('fetchFullClient THROWS on a 200 carrying errors, with the GraphQL message', async () => {
    installJobber(() => ({ errors: [{ message: 'Throttled' }], data: { client: null } }));
    await assert.rejects(
      () => fetchFullClient(CLIENT, TOKEN),
      (err) => {
        assert.match(err.message, /Jobber GraphQL error/);
        assert.match(err.message, /Throttled/);
        return true;
      }
    );
  });

  it('fetchFullClient distinguishes an errors failure from an absent client BY MESSAGE', async () => {
    installJobber(() => ({ data: { client: null } }));
    await assert.rejects(
      () => fetchFullClient(CLIENT, TOKEN),
      (err) => {
        assert.match(err.message, /no client returned/);
        assert.equal(err.jobberGraphQLErrors, undefined);
        return true;
      }
    );
  });

  it('fetchClientJobsForJobUpdate THROWS rather than returning an empty sibling list', async () => {
    installJobber(() => ({ errors: [{ message: 'nope' }], data: { client: null } }));
    await assert.rejects(() => fetchClientJobsForJobUpdate(CLIENT, TOKEN), /Jobber GraphQL error/);
  });

  it('fetchInvoiceWithJobs reports the GraphQL error rather than "no invoice returned"', async () => {
    installJobber(() => ({ errors: [{ message: 'bad field' }], data: { invoice: null } }));
    await assert.rejects(
      () => fetchInvoiceWithJobs('inv-9', TOKEN),
      (err) => {
        assert.match(err.message, /Jobber GraphQL error/);
        assert.doesNotMatch(err.message, /no invoice returned/);
        return true;
      }
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('capture fetch — (ii) THE BOUNDARY FENCE: what consumers read must be SELECTED', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ MECHANICAL, NOT HAND-MAINTAINED, AND THE REPLACEMENT IS THE POINT (3d Phase 1a Commit
  // 3a-2). This block used to be a hand-written list of 12 fields, each paired with the consumer
  // that reads it. The reasoning for writing it by hand was that a list derived from the query
  // would agree with the query by construction — which is sound, and it is NOT what this does.
  // ⚠ IT WENT STALE THE MOMENT COMMIT 3 ADDED WRITERS, AND MISSED 26 FIELDS. The list was
  // written from Commit 2's needs; Commit 3's writers read 26 fields no capture query selected,
  // so those columns were NULL for every client in production. Worst of them was `updatedAt`,
  // the INPUT to the staleness guard — so that guard was inert while its own unit test proved
  // the SQL worked. A fence built from a list someone maintains is a number in a governing
  // document, and this repo has found those stale repeatedly.
  //
  // HOW EACH SIDE IS DERIVED, so the fence cannot silently stop reading either one:
  //   READS    — the SOURCE TEXT of each writer in server/utils/factCapture.js is sliced by
  //              function name, and every `<node>.field` / `<node>.amounts?.field` access is
  //              collected. It grows automatically when a writer starts reading a new field.
  //   SELECTS  — the per-entity FIELD CONSTANT the queries are built from, exported for this
  //              purpose. ⚠ PER-ENTITY, NEVER THE WHOLE QUERY: checking writeJobFacts against
  //              the whole BASE_QUERY reports `salesperson` and `total` as selected, because
  //              QUOTE_FIELDS carries a salesperson and INVOICE_FIELDS carries a total. The
  //              loose form is how the 26 were undercounted as 11 on first measurement.
  //
  // ⚠ AND IT IS NOT CIRCULAR. The two sides come from different files and different languages —
  // JavaScript property reads on one side, GraphQL selection text on the other — so neither is
  // derived from the other. Deleting a field from a selection makes the fence fail; deleting it
  // from a writer makes the fence stop requiring it, which is correct, because a field no writer
  // reads is not a field the query owes anyone.

  const FACT_CAPTURE_SRC = readFileSync(join(__dirname, '..', 'utils', 'factCapture.js'), 'utf8');

  // Slices one writer's body out of factCapture.js and collects the node fields it reads.
  function fieldsReadBy(writerName) {
    const start = FACT_CAPTURE_SRC.indexOf(`async function ${writerName}(`);
    assert.ok(start >= 0, `harness: ${writerName} not found in factCapture.js — the fence must be re-anchored, not skipped`);
    const end = FACT_CAPTURE_SRC.indexOf('\n}', start);
    assert.ok(end > start, `harness: could not find the end of ${writerName}`);
    const body = FACT_CAPTURE_SRC.slice(start, end);
    assert.ok(body.length > 200, `harness: the ${writerName} slice is too short to be the real body`);

    const nested = new Set();
    for (const m of body.matchAll(/\b(?:n|inv)\.amounts\?\.([A-Za-z_][A-Za-z0-9_]*)/g)) nested.add(m[1]);
    const top = new Set();
    for (const m of body.matchAll(/\b(?:n|inv)\.([A-Za-z_][A-Za-z0-9_]*)/g)) top.add(m[1]);
    top.delete('amounts');
    return { top: [...top].sort(), nested: [...nested].sort() };
  }

  // writer -> EVERY selection that must be able to feed it, live AND import.
  // ⚠ THE IMPORT'S QUERIES ARE IN HERE SINCE 3b, AND THAT IS THE POINT OF R5i. The import and the
  // webhooks must produce the same fact row for the same Jobber object; a fence that checked only
  // the live path would let the import drift and would report health about a path it never read.
  const WRITER_SELECTIONS = [
    ['writeJobFacts', {
      'fetchFullClient JOB_FIELDS': fetchModule.JOB_FIELDS,
      'fetchClientRelatedData RELATED_JOB_FIELDS': jobberRouter._captureFields.RELATED_JOB_FIELDS,
      'repImportScope REP_JOB_FIELDS': repImport.REP_JOB_FIELDS,
    }],
    ['writeInvoiceFacts', {
      'fetchFullClient INVOICE_FIELDS': fetchModule.INVOICE_FIELDS,
      'fetchClientRelatedData RELATED_INVOICE_FIELDS': jobberRouter._captureFields.RELATED_INVOICE_FIELDS,
      'repImportScope REP_INVOICE_FIELDS': repImport.REP_INVOICE_FIELDS,
    }],
    ['writeInvoiceJobLinks', {
      'fetchFullClient INVOICE_FIELDS': fetchModule.INVOICE_FIELDS,
      'fetchClientRelatedData RELATED_INVOICE_FIELDS': jobberRouter._captureFields.RELATED_INVOICE_FIELDS,
      'repImportScope REP_INVOICE_FIELDS': repImport.REP_INVOICE_FIELDS,
    }],
    // ⚠ THE QUOTE WRITER WAS NOT IN THIS LIST UNTIL COMMIT 5, AND THE GAP SHIPPED THE DEFECT
    // THIS FENCE EXISTS TO CATCH. writeQuoteFacts keys its row on `n.client.id`, and NEITHER
    // live selection carried `client { id }` — so a live capture filtered out every quote and
    // reported success having written nothing. It was invisible because the only writer of
    // quote facts was the IMPORT, whose own query does select it.
    // ⚠ THE FENCE PASSED THE WHOLE TIME, AND THAT IS THE ENTRY WORTH KEEPING: it covered
    // writeJobFacts and writeInvoiceFacts only, so its green was evidence about two writers
    // out of four — a mechanism reporting health it never observed. Fixing the two columns
    // without widening the list would leave the next missing column to ship the same way.
    ['writeQuoteFacts', {
      'fetchFullClient QUOTE_FIELDS': fetchModule.QUOTE_FIELDS,
      'fetchClientRelatedData RELATED_QUOTE_FIELDS': jobberRouter._captureFields.RELATED_QUOTE_FIELDS,
    }],
  ];

  for (const [writer, selections] of WRITER_SELECTIONS) {
    for (const [label, selection] of Object.entries(selections)) {
      it(`${label} selects EVERY field ${writer} reads`, () => {
        const { top, nested } = fieldsReadBy(writer);
        assert.ok(top.length > 0, `harness: ${writer} appears to read no fields — the slice or the regex is wrong`);

        const missing = [
          ...top.filter((f) => !new RegExp(`\\b${f}\\b`).test(selection)),
          ...nested.filter((f) => !new RegExp(`\\b${f}\\b`).test(selection)).map((f) => `amounts.${f}`),
        ];
        assert.deepEqual(
          missing, [],
          `${label} does not select ${missing.length} field(s) that ${writer} reads: ${missing.join(', ')}. `
          + 'A writer reading a field no query selects stores NULL, and NULL reads as an answer '
          + 'rather than as "nobody looked".'
        );
      });
    }
  }

  // ⚠ THE FENCE'S OWN NON-VACUITY CHECK. If the derivation ever stops finding reads — a renamed
  // writer, a changed node variable, a regex that no longer matches — every assertion above
  // passes against an empty list. That is the failure mode of this whole class, so it is asserted
  // rather than assumed, with a floor that is well below the real counts (17 / 16 / 3 today).
  it('the derivation actually finds reads — an empty read set would make every check above vacuous', () => {
    const job = fieldsReadBy('writeJobFacts');
    const inv = fieldsReadBy('writeInvoiceFacts');
    const lnk = fieldsReadBy('writeInvoiceJobLinks');
    assert.ok(job.top.length >= 12, `writeJobFacts reads only ${job.top.length} fields — derivation is probably broken`);
    assert.ok(inv.top.length >= 8, `writeInvoiceFacts reads only ${inv.top.length} top-level fields`);
    assert.ok(inv.nested.length >= 7, `writeInvoiceFacts reads only ${inv.nested.length} amounts fields`);
    assert.ok(lnk.top.length >= 2, `writeInvoiceJobLinks reads only ${lnk.top.length} fields`);
    // And the fields the ruling named by hand must be among them, so a derivation that finds
    // SOMETHING but the wrong thing is caught too.
    for (const f of ['jobNumber', 'invoicedTotal', 'uninvoicedTotal', 'updatedAt']) {
      assert.ok(job.top.includes(f), `writeJobFacts should read ${f}`);
    }
    for (const f of ['invoiceNumber', 'receivedDate', 'updatedAt']) {
      assert.ok(inv.top.includes(f), `writeInvoiceFacts should read ${f}`);
    }
    for (const f of ['depositAmount', 'subtotal', 'taxAmount', 'discountAmount']) {
      assert.ok(inv.nested.includes(f), `writeInvoiceFacts should read amounts.${f}`);
    }
  });

  // The CONSUMER fields — what classifyPipelineStatus and the attribution engine read. These are
  // not fact-writer fields, so the mechanical check above cannot see them, and they keep an
  // explicit list naming the consumer. ⚠ Kept deliberately: the two mechanisms cover different
  // sets, and dropping this one would lose the engine's contract entirely.
  const CONSUMER_REQUIRED = [
    { field: 'quoteStatus', read_by: 'classifyPipelineStatus — filters out archived quotes' },
    { field: 'invoiceStatus', read_by: 'classifyPipelineStatus — a paid invoice means stage paid' },
    { field: 'jobStatus', read_by: 'deriveJobberTags JOB_STATUS_MAP' },
    { field: 'lastTransitioned', read_by: 'attributionEngine isQuoteEligible — approvedAt gate' },
    { field: 'approvedAt', read_by: 'attributionEngine — the sticky gate cutoff comparison' },
    { field: 'salesperson', read_by: 'attributionEngine — quote_salesperson sticky source' },
    { field: 'createdAt', read_by: 'sale grouping and the request grace window' },
    { field: 'total', read_by: 'sale value — sum of DISTINCT invoice totals' },
    { field: 'invoiceBalance', read_by: 'paid means invoiceBalance = 0, authoritative' },
    { field: 'paymentsTotal', read_by: 'amount paid' },
    { field: 'issuedDate', read_by: 'invoice dates' },
    { field: 'dueDate', read_by: 'invoice dates' },
  ];

  const FETCH_QUERIES = {
    'fetchFullClient BASE_QUERY': fetchModule.BASE_QUERY,
    'fetchClientRelatedData RELATED_BASE_QUERY': jobberRouter._captureQueries.RELATED_BASE_QUERY,
  };

  for (const [name, query] of Object.entries(FETCH_QUERIES)) {
    for (const { field, read_by } of CONSUMER_REQUIRED) {
      it(`${name} SELECTS ${field} — read by ${read_by}`, () => {
        assert.ok(
          new RegExp(`\\b${field}\\b`).test(query),
          `${name} does not select ${field}, which ${read_by} reads. `
          + 'A consumer reading a field nobody selects gets undefined and falls back to a '
          + 'default, which looks exactly like a correct answer.'
        );
      });
    }
  }

  // ⚠ THE PAGING CONTRACT IS PART OF THE SELECTION, and a fence that only checked field names
  // would pass against a query that fetched one page and stopped.
  it('every paged connection selects pageInfo with BOTH hasNextPage and endCursor', () => {
    const queries = { ...FETCH_QUERIES, ...jobberRouter._captureQueries, ...{
      'fetchFullClient JOBS_PAGE_QUERY': fetchModule.JOBS_PAGE_QUERY,
      'fetchFullClient QUOTES_PAGE_QUERY': fetchModule.QUOTES_PAGE_QUERY,
      'fetchFullClient INVOICES_PAGE_QUERY': fetchModule.INVOICES_PAGE_QUERY,
    } };
    for (const [name, query] of Object.entries(queries)) {
      if (typeof query !== 'string') continue;
      assert.match(query, /pageInfo\s*\{[^}]*hasNextPage/, `${name} must select hasNextPage`);
      assert.match(query, /pageInfo\s*\{[^}]*endCursor/, `${name} must select endCursor — a cursor-less pager silently stops`);
    }
  });

  // ⚠ ANY QUERY WHOSE INVOICES REACH isInvoicePaid MUST SELECT ALL THREE FIELDS IT READS (4a).
  // The helper needs invoiceStatus, amounts.total AND amounts.invoiceBalance. A query missing one
  // does not fail — it returns undefined, the helper rejects the invoice, and the client silently
  // reads as 'sold' instead of 'paid'. That is a wrong answer shaped exactly like a correct one,
  // and it is the same class as the 42 fields 3a-2 found missing.
  // ⚠ IT WALKS EVERY INVOICE SELECTION IN server/, not a list of the ones I remembered.
  it('every invoice selection in server/ carries all three fields isInvoicePaid reads', () => {
    const { readdirSync, statSync } = require('node:fs');
    const REPO = join(__dirname, '..');
    const files = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'test') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.js')) files.push(p);
      }
    })(REPO);

    const missing = [];
    let selections = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // Each `amounts {` block is one invoice money selection.
      let from = 0;
      for (;;) {
        const at = src.indexOf('amounts {', from);
        if (at < 0) break;
        const close = src.indexOf('}', at);
        const block = src.slice(at, close < 0 ? src.length : close + 1);
        selections += 1;
        const rel = file.slice(REPO.length + 1).split('\\').join('/');
        const line = src.slice(0, at).split('\n').length;
        if (!/\btotal\b/.test(block)) missing.push(`${rel}:${line} — amounts block omits total`);
        if (!/\binvoiceBalance\b/.test(block)) missing.push(`${rel}:${line} — amounts block omits invoiceBalance`);
        from = at + 1;
      }
    }

    // ⚠ NON-VACUITY: if the walk finds no selections the assertion below is meaningless.
    assert.ok(selections >= 8, `only ${selections} invoice money selections found — the walk is probably broken`);
    assert.deepEqual(missing, [],
      'isInvoicePaid reads invoiceStatus, amounts.total and amounts.invoiceBalance. A selection '
      + `missing one makes a paid invoice read as unpaid, silently:\n  ${missing.join('\n  ')}`);
  });

  it('an invoice selects its job ids, so the invoice-to-sale link exists at all', () => {
    for (const [name, query] of Object.entries(FETCH_QUERIES)) {
      assert.match(query, /jobs\(first:\s*\d+\)\s*\{\s*nodes\s*\{\s*id\s*\}/, `${name} must select the invoice's job ids`);
    }
  });

  // ⚠ BOTH CONNECTIONS (Commit 3a). Jobber splits an invoice's jobs into `jobs` and
  // `archivedJobs`; selecting only the first made from_archived_jobs structurally always false
  // in production while the writer that sets it was correct and tested. Proven at 2026-05-12 by
  // fetchInvoiceWithJobs, which has selected archivedJobs since 2026-04-30.
  it('an invoice selects archivedJobs too, or from_archived_jobs can never be true', () => {
    for (const [name, query] of Object.entries(FETCH_QUERIES)) {
      assert.match(
        query,
        /archivedJobs\(first:\s*\d+\)\s*\{\s*nodes\s*\{\s*id\s*\}/,
        `${name} must select the invoice's archivedJobs — an archived job is still a job whose invoice was paid`
      );
    }
  });

  it('BOTH invoice job connections select pageInfo, so neither can truncate silently', () => {
    for (const [name, query] of Object.entries(FETCH_QUERIES)) {
      for (const conn of ['jobs', 'archivedJobs']) {
        const re = new RegExp(`${conn}\\(first:\\s*\\d+\\)\\s*\\{[^}]*\\}\\s*pageInfo\\s*\\{[^}]*hasNextPage`);
        assert.match(query, re, `${name}: the invoice's ${conn} must select pageInfo.hasNextPage`);
      }
    }
  });

  it('both capture queries pin the API version header the repo pins', async () => {
    installJobber(() => ({ data: { client: { id: CLIENT, quotes: page([]), jobs: page([]), invoices: page([]) } } }));
    await fetchFullClient(CLIENT, TOKEN);
    assert.ok(calls.length > 0);
    for (const c of calls) {
      assert.equal(c.headers['X-JOBBER-GRAPHQL-VERSION'], fetchModule.JOBBER_API_VERSION);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('capture fetch — (iii) paging to EXHAUSTION, no cap that drops records', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ THE FIXTURE IS DELIBERATELY BIGGER THAN ONE PAGE IN EVERY CONNECTION. A fixture that
  // fits in one page passes identically against a fetch that never pages — the vacuity shape
  // where the seeded state equals the broken path's output.
  function installThreePageClient() {
    const jobsPages = [
      page([job('j1'), job('j2')], true, 'jc1'),
      page([job('j3')], false, null),
    ];
    const invoicePages = [
      page([invoice('i1', ['j1']), invoice('i2', ['j2'])], true, 'ic1'),
      page([invoice('i3', ['j3']), invoice('i4', ['j1'])], false, null),
    ];
    const quotePages = [
      page([{ id: 'q1', quoteStatus: 'approved', createdAt: '2026-01-01T00:00:00Z', lastTransitioned: { approvedAt: '2026-01-02T00:00:00Z' }, salesperson: { id: 'u1' } }], true, 'qc1'),
      page([{ id: 'q2', quoteStatus: 'archived', createdAt: '2026-01-03T00:00:00Z', lastTransitioned: null, salesperson: null }], false, null),
    ];
    const seen = { jobs: 0, invoices: 0, quotes: 0 };

    installJobber(({ query }) => {
      const conn = connectionOf(query);
      if (conn === 'base') {
        return { data: { client: { id: CLIENT, firstName: 'Cap', quotes: quotePages[0], jobs: jobsPages[0], invoices: invoicePages[0] } } };
      }
      if (conn === 'jobs') { seen.jobs += 1; return { data: { client: { jobs: jobsPages[seen.jobs] } } }; }
      if (conn === 'invoices') { seen.invoices += 1; return { data: { client: { invoices: invoicePages[seen.invoices] } } }; }
      if (conn === 'quotes') { seen.quotes += 1; return { data: { client: { quotes: quotePages[seen.quotes] } } }; }
      throw new Error(`unexpected query: ${conn}`);
    });
  }

  it('fetchFullClient returns ALL jobs across pages, not just the first page', async () => {
    installThreePageClient();
    const client = await fetchFullClient(CLIENT, TOKEN);
    assert.deepEqual(client.jobs.nodes.map((j) => j.id), ['j1', 'j2', 'j3']);
  });

  it('fetchFullClient returns ALL invoices across pages', async () => {
    installThreePageClient();
    const client = await fetchFullClient(CLIENT, TOKEN);
    assert.deepEqual(client.invoices.nodes.map((i) => i.id), ['i1', 'i2', 'i3', 'i4']);
  });

  it('fetchFullClient returns ALL quotes across pages', async () => {
    installThreePageClient();
    const client = await fetchFullClient(CLIENT, TOKEN);
    assert.deepEqual(client.quotes.nodes.map((q) => q.id), ['q1', 'q2']);
  });

  it('a job on the LAST page still carries its invoices — the two pagers are joined', async () => {
    installThreePageClient();
    const client = await fetchFullClient(CLIENT, TOKEN);
    const j3 = client.jobs.nodes.find((j) => j.id === 'j3');
    assert.deepEqual(j3.invoices.nodes.map((i) => i.id), ['i3'], 'j3 arrived on jobs page 2 and i3 on invoices page 2');
  });

  it('an invoice covering a job appears under that job, and an invoice naming two jobs appears under both', async () => {
    installJobber(({ query }) => {
      if (connectionOf(query) !== 'base') throw new Error('should not page');
      return { data: { client: { id: CLIENT, quotes: page([]), jobs: page([job('j1'), job('j2')]), invoices: page([invoice('shared', ['j1', 'j2'])]) } } };
    });
    const client = await fetchFullClient(CLIENT, TOKEN);
    assert.deepEqual(client.jobs.nodes.find((j) => j.id === 'j1').invoices.nodes.map((i) => i.id), ['shared']);
    assert.deepEqual(client.jobs.nodes.find((j) => j.id === 'j2').invoices.nodes.map((i) => i.id), ['shared']);
    // ⚠ And it is stored ONCE in the authoritative set, which is what a value must be summed over.
    assert.equal(client.invoices.nodes.length, 1);
  });

  it('fetchClientRelatedData pages jobs, quotes, requests AND invoices to exhaustion', async () => {
    const jobs = [page([job('rj1')], true, 'c1'), page([job('rj2')], false, null)];
    const quotes = [page([{ id: 'rq1', quoteStatus: 'approved' }], true, 'c1'), page([{ id: 'rq2', quoteStatus: 'archived' }], false, null)];
    const requests = [page([{ id: 'rr1' }], true, 'c1'), page([{ id: 'rr2' }], false, null)];
    const invoices = [page([invoice('ri1', ['rj1'])], true, 'c1'), page([invoice('ri2', ['rj2'])], false, null)];
    const seen = { jobs: 0, quotes: 0, requests: 0, invoices: 0 };

    installJobber(({ query }) => {
      const conn = connectionOf(query);
      if (conn === 'base') {
        return { data: { client: { isCompany: false, isLead: false, tags: { nodes: [] }, customFields: [], jobs: jobs[0], quotes: quotes[0], requests: requests[0], invoices: invoices[0] } } };
      }
      seen[conn] += 1;
      const src = { jobs, quotes, requests, invoices }[conn];
      return { data: { client: { [conn]: src[seen[conn]] } } };
    });

    const related = await fetchClientRelatedData(CLIENT, TOKEN);
    assert.deepEqual(related.jobs.nodes.map((j) => j.id), ['rj1', 'rj2']);
    assert.deepEqual(related.quotes.nodes.map((q) => q.id), ['rq1', 'rq2']);
    assert.deepEqual(related.requests.nodes.map((r) => r.id), ['rr1', 'rr2']);
    assert.deepEqual(related.invoices.nodes.map((i) => i.id), ['ri1', 'ri2']);
  });

  it('hasNextPage with NO endCursor THROWS rather than quietly returning a short set', async () => {
    installJobber(({ query }) => {
      if (connectionOf(query) !== 'base') throw new Error('should not reach a follow-up');
      return { data: { client: { id: CLIENT, quotes: page([]), invoices: page([]), jobs: page([job('j1')], true, null) } } };
    });
    await assert.rejects(() => fetchFullClient(CLIENT, TOKEN), /hasNextPage with no endCursor/);
  });

  it('a follow-up page whose connection is absent THROWS', async () => {
    installJobber(({ query }) => {
      if (connectionOf(query) === 'base') {
        return { data: { client: { id: CLIENT, quotes: page([]), invoices: page([]), jobs: page([job('j1')], true, 'c1') } } };
      }
      return { data: { client: {} } };
    });
    await assert.rejects(() => fetchFullClient(CLIENT, TOKEN), /connection absent on page/);
  });

  it('an errors array on a FOLLOW-UP page is a failure too, not a short set', async () => {
    installJobber(({ query }) => {
      if (connectionOf(query) === 'base') {
        return { data: { client: { id: CLIENT, quotes: page([]), invoices: page([]), jobs: page([job('j1')], true, 'c1') } } };
      }
      return { errors: [{ message: 'throttled mid-page' }], data: { client: null } };
    });
    await assert.rejects(() => fetchFullClient(CLIENT, TOKEN), /throttled mid-page/);
  });

  it('an invoice naming more jobs than one page can carry THROWS — the link must not truncate', async () => {
    installJobber(({ query }) => {
      if (connectionOf(query) !== 'base') throw new Error('should not page');
      const truncated = invoice('i-big', ['j1']);
      truncated.jobs.pageInfo.hasNextPage = true;
      return { data: { client: { id: CLIENT, quotes: page([]), jobs: page([job('j1')]), invoices: page([truncated]) } } };
    });
    await assert.rejects(() => fetchFullClient(CLIENT, TOKEN), /names more than .* jobs/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('capture fetch — (iv) a fetched invoice carries money, dates, status and job ids', () => {
// ═════════════════════════════════════════════════════════════════════════════

  async function oneInvoice(over = {}) {
    installJobber(({ query }) => {
      if (connectionOf(query) !== 'base') throw new Error('should not page');
      return { data: { client: { id: CLIENT, quotes: page([]), jobs: page([job('j1')]), invoices: page([invoice('i1', ['j1'], over)]) } } };
    });
    const client = await fetchFullClient(CLIENT, TOKEN);
    return client.invoices.nodes[0];
  }

  it('carries total, invoiceBalance and paymentsTotal as DOLLARS, unconverted', async () => {
    const inv = await oneInvoice();
    assert.equal(inv.amounts.total, 1000.5);
    assert.equal(inv.amounts.invoiceBalance, 0);
    assert.equal(inv.amounts.paymentsTotal, 1000.5);
    // ⚠ 1000.5 is dollars, not cents. Nothing here multiplies by 100.
  });

  it('carries its status, including voided — a voided invoice is FETCHED, not skipped', async () => {
    const inv = await oneInvoice({ invoiceStatus: 'voided' });
    assert.equal(inv.invoiceStatus, 'voided');
    // ⚠ 2026-05-12 added `voided` to InvoiceStatusTypeEnum. Its STATUS is a fact worth having;
    // nothing in this commit treats it as paid, and nothing downstream may count it toward a
    // sale's value. That exclusion is Commit 3's job and is filed on the checklist.
  });

  it('a voided invoice is NOT paid, by the authoritative balance rule', async () => {
    const inv = await oneInvoice({ invoiceStatus: 'voided', amounts: { total: 900, invoiceBalance: 900, paymentsTotal: 0 } });
    assert.notEqual(inv.invoiceStatus, 'paid');
    assert.notEqual(inv.amounts.invoiceBalance, 0);
  });

  it('carries createdAt, issuedDate and dueDate', async () => {
    const inv = await oneInvoice();
    assert.equal(inv.createdAt, '2026-01-01T00:00:00Z');
    assert.equal(inv.issuedDate, '2026-01-02T00:00:00Z');
    assert.equal(inv.dueDate, '2026-02-01T00:00:00Z');
  });

  it('carries the job ids it covers', async () => {
    const inv = await oneInvoice();
    assert.deepEqual(inv.jobs.nodes.map((j) => j.id), ['j1']);
  });

  it('classifyPipelineStatus reads the assembled shape and returns paid, not lead', async () => {
    const { classifyPipelineStatus } = require('../crm/pipelineSync');
    installJobber(({ query }) => {
      if (connectionOf(query) !== 'base') throw new Error('should not page');
      return { data: { client: { id: CLIENT, quotes: page([]), jobs: page([job('j1')]), invoices: page([invoice('i1', ['j1'])]) } } };
    });
    const client = await fetchFullClient(CLIENT, TOKEN);
    assert.equal(classifyPipelineStatus(client), 'paid');
    // ⚠ THE FIXTURE IS FURTHEST FROM THE DEFAULT ON PURPOSE. classifyPipelineStatus returns
    // 'lead' when it can read neither jobs nor quotes, so a 'lead' fixture cannot tell correct
    // wiring from a flattened shape it cannot traverse. Reaching 'paid' requires walking
    // jobs.nodes and then invoices.nodes.
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('capture fetch — (v) fetchInvoiceWithJobs pages BOTH job connections to exhaustion', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ THE MONEY PATH, AND THE OLD DEFECT WAS A WRONG BONUS RATHER THAN A MISSING ONE.
  // evaluateReferral collects Job Type custom fields from jobs.nodes PLUS archivedJobs.nodes and
  // picks a payout schedule from them — a Full Roof label selects the ESCALATING schedule.
  // `archivedJobs(first: 10)` with no pageInfo could drop the job carrying that label, so the
  // referral paid on the wrong schedule, or returned no_job_type_found and was not paid at all.
  // ⚠ AND assertInvoiceJobsComplete COULD NOT SEE IT: with no pageInfo selected, hasNextPage is
  // `undefined`, which is not `true`. An absent field reads as health.

  const invoiceQueries = jobberRouter._captureQueries;

  // A job carrying a Job Type label, so a dropped node is a dropped payout decision.
  const jobNode = (i, label) => ({
    id: `aj-${i}`,
    customFields: label ? [{ label: 'Job Type', valueDropdown: label }] : [],
  });

  // ⚠ THE HARNESS ANSWERS FROM WHAT THE QUERY SELECTS, WHICH IS THE LESSON FROM 3a-2 AND 3b.
  // Twice in two commits an injection produced NO red because the stub returned a fixed object
  // regardless of the query. Here: a page is only ever returned when the query asks for that
  // connection, and pageInfo is only supplied when the query selects it — so restoring
  // `archivedJobs(first: 10)` with no pageInfo genuinely truncates, exactly as production did.
  function installInvoice({ jobs = [], archived = [], pageSize = 50 } = {}) {
    calls = [];
    const slice = (all, after, query, conn) => {
      const start = after ? Number(after) : 0;
      const nodes = all.slice(start, start + pageSize);
      const end = start + nodes.length;
      const out = { nodes };
      // pageInfo ONLY if the query selected it for this connection.
      const block = sliceConnectionBlock(query, conn);
      if (/pageInfo/.test(block)) {
        out.pageInfo = { hasNextPage: end < all.length, endCursor: end < all.length ? String(end) : null };
      }
      return out;
    };

    axios.post = async (url, body, config) => {
      calls.push({ query: body.query, variables: body.variables, headers: config.headers });
      const q = body.query;
      if (/GetInvoiceJobsPage/.test(q)) {
        return { data: { data: { invoice: { jobs: slice(jobs, body.variables.after, q, 'jobs') } } } };
      }
      if (/GetInvoiceArchivedJobsPage/.test(q)) {
        return { data: { data: { invoice: { archivedJobs: slice(archived, body.variables.after, q, 'archivedJobs') } } } };
      }
      if (!/GetInvoiceWithJobs/.test(q)) throw new Error('unexpected query in this fixture');
      const invoice = {
        id: 'inv-money', invoiceNumber: 5555, invoiceStatus: 'paid', issuedDate: '2026-01-01T00:00:00Z',
        waitingForFinancedPayment: false, amounts: { total: 12000, invoiceBalance: 0 }, client: { id: 'jc-1', name: 'C' },
      };
      if (/\bjobs\(first:/.test(q)) invoice.jobs = slice(jobs, null, q, 'jobs');
      if (/\barchivedJobs\(first:/.test(q)) invoice.archivedJobs = slice(archived, null, q, 'archivedJobs');
      return { data: { data: { invoice } } };
    };
  }

  // Returns just the named connection's selection, by brace matching, so a pageInfo check cannot
  // be satisfied by the OTHER connection selecting one.
  function sliceConnectionBlock(query, conn) {
    const at = query.indexOf(`${conn}(first:`);
    if (at < 0) return '';
    const open = query.indexOf('{', at);
    if (open < 0) return '';
    let depth = 0;
    for (let i = open; i < query.length; i += 1) {
      if (query[i] === '{') depth += 1;
      else if (query[i] === '}') { depth -= 1; if (depth === 0) return query.slice(at, i + 1); }
    }
    return query.slice(at);
  }

  it('both job connections select pageInfo, or truncation cannot be detected at all', () => {
    for (const conn of ['jobs', 'archivedJobs']) {
      const block = sliceConnectionBlock(invoiceQueries.INVOICE_WITH_JOBS_QUERY, conn);
      assert.ok(block.length > 0, `the invoice query must select ${conn}`);
      assert.match(block, /pageInfo\s*\{[^}]*hasNextPage/, `${conn} must select hasNextPage`);
      assert.match(block, /pageInfo\s*\{[^}]*endCursor/, `${conn} must select endCursor — a cursor-less pager stops silently`);
    }
  });

  it('an invoice with MORE THAN ONE PAGE of archived jobs returns every one of them', async () => {
    const archived = Array.from({ length: 63 }, (_, i) => jobNode(i, i === 60 ? 'Full Roof' : 'Repair'));
    installInvoice({ archived });
    const invoice = await fetchInvoiceWithJobs('inv-money', TOKEN);
    assert.equal(invoice.archivedJobs.nodes.length, 63);
    // ⚠ THE 61st NODE CARRIES THE Full Roof LABEL ON PURPOSE. It is past any first:10 or first:50
    // cap, so a truncating fetch drops the label that selects the escalating payout schedule.
    const labels = invoice.archivedJobs.nodes.flatMap((j) => (j.customFields || []).map((f) => f.valueDropdown));
    assert.ok(labels.includes('Full Roof'), 'the Job Type that decides the payout must survive paging');
  });

  it('an invoice with more than one page of LIVE jobs returns every one of them', async () => {
    const jobs = Array.from({ length: 51 }, (_, i) => jobNode(i, 'Repair'));
    installInvoice({ jobs });
    const invoice = await fetchInvoiceWithJobs('inv-money', TOKEN);
    assert.equal(invoice.jobs.nodes.length, 51);
  });

  it('both connections page independently in one fetch', async () => {
    installInvoice({
      jobs: Array.from({ length: 52 }, (_, i) => jobNode(`l${i}`, 'Repair')),
      archived: Array.from({ length: 55 }, (_, i) => jobNode(`a${i}`, 'Repair')),
    });
    const invoice = await fetchInvoiceWithJobs('inv-money', TOKEN);
    assert.equal(invoice.jobs.nodes.length, 52);
    assert.equal(invoice.archivedJobs.nodes.length, 55);
  });

  it('a single page makes NO follow-up request — paging is not a per-call cost', async () => {
    installInvoice({ jobs: [jobNode(1, 'Repair')], archived: [] });
    await fetchInvoiceWithJobs('inv-money', TOKEN);
    assert.equal(calls.length, 1, 'the common small invoice must still cost one request');
  });

  it('hasNextPage with NO endCursor THROWS rather than returning a short job set', async () => {
    installInvoice({ archived: [jobNode(1, 'Repair')] });
    const saved = axios.post;
    axios.post = async (url, body, config) => {
      const res = await saved(url, body, config);
      if (/GetInvoiceWithJobs/.test(body.query)) {
        res.data.data.invoice.archivedJobs.pageInfo = { hasNextPage: true, endCursor: null };
      }
      return res;
    };
    await assert.rejects(() => fetchInvoiceWithJobs('inv-money', TOKEN), /hasNextPage with no endCursor/);
  });

  it('an errors array on a FOLLOW-UP job page is a failure, not a short set', async () => {
    const archived = Array.from({ length: 60 }, (_, i) => jobNode(i, 'Repair'));
    installInvoice({ archived });
    const saved = axios.post;
    axios.post = async (url, body, config) => {
      if (/GetInvoiceArchivedJobsPage/.test(body.query)) {
        return { data: { errors: [{ message: 'throttled mid-page' }], data: { invoice: null } } };
      }
      return saved(url, body, config);
    };
    await assert.rejects(() => fetchInvoiceWithJobs('inv-money', TOKEN), /throttled mid-page/);
  });

  it('a 200 carrying errors on the FIRST page is a failure, with the GraphQL message', async () => {
    calls = [];
    axios.post = async () => ({ data: { errors: [{ message: 'bad field' }], data: { invoice: null } } });
    await assert.rejects(
      () => fetchInvoiceWithJobs('inv-money', TOKEN),
      (err) => {
        assert.match(err.message, /Jobber GraphQL error/);
        assert.doesNotMatch(err.message, /no invoice returned/);
        return true;
      }
    );
  });

  it('the invoice still carries the money and status the referral engine reads', async () => {
    installInvoice({ jobs: [jobNode(1, 'Full Roof')] });
    const invoice = await fetchInvoiceWithJobs('inv-money', TOKEN);
    assert.equal(invoice.amounts.total, 12000);
    assert.equal(invoice.invoiceStatus, 'paid');
    assert.equal(invoice.waitingForFinancedPayment, false);
    assert.equal(invoice.client.id, 'jc-1');
  });
});
