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

const axios = require('axios');
const fetchModule = require('../utils/jobberClientFetch');
const jobberRouter = require('../routes/webhooks/jobber');

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

  // ⚠ EACH ENTRY NAMES THE CONSUMER THAT READS IT AND WHY. This list is hand-written on
  // purpose: if it were derived from the query it would agree with the query by construction
  // and could never fail. The pairing with the consumer's name is what makes a deletion
  // reviewable rather than silent.
  const REQUIRED = [
    // classifyPipelineStatus (server/crm/pipelineSync.js) reads these three.
    { field: 'quoteStatus', read_by: 'classifyPipelineStatus — filters out archived quotes' },
    { field: 'invoiceStatus', read_by: 'classifyPipelineStatus — a paid invoice means stage paid' },
    { field: 'jobStatus', read_by: 'deriveJobberTags JOB_STATUS_MAP' },
    // runAttributionEngine (server/utils/attributionEngine.js) documents this contract at its
    // own entry point: quotes.nodes with quoteStatus, salesperson.id and lastTransitioned.
    { field: 'lastTransitioned', read_by: 'attributionEngine isQuoteEligible — approvedAt gate' },
    { field: 'approvedAt', read_by: 'attributionEngine — the sticky gate cutoff comparison' },
    { field: 'salesperson', read_by: 'attributionEngine — quote_salesperson sticky source' },
    // Sale dating and grouping.
    { field: 'createdAt', read_by: 'sale grouping and the request grace window' },
    // Sale VALUE. Danny's ruling: sum of final invoice totals, paid means invoiceBalance = 0.
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
    for (const { field, read_by } of REQUIRED) {
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
