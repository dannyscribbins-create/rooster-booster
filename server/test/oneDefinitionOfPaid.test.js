'use strict';

// ── ONE DEFINITION OF "PAID" (3d Phase 1a Commit 4a) ─────────────────────────
//
// Danny's ruling: the whole app agrees that an invoice is paid when
//   invoiceStatus = 'paid' AND invoiceBalance = 0 AND total > 0
// via the ONE shared helper, server/utils/invoicePaid.js.
//
// ⚠ THIS FILE IS THE FENCE THAT KEEPS IT ONE. It walks the tracked source and fails if any file
// other than the helper decides paid-ness itself, naming the offender by file:line. Before 4a
// SEVEN sites tested the status alone, and they disagreed with the helper in two shapes: status
// paid with a NON-ZERO balance, and status paid with TOTAL 0. Both used to mark a client as
// paying.
//
// ⚠ IT WALKS A DIRECTORY TREE, IT DOES NOT ITERATE A LIST. A hand-maintained FILES list is this
// repo's recurring blind spot: a new file is invisible until someone remembers it, and nothing
// announces the omission.
//
// ⚠ AND IT READS ITS OWN NEEDLES FROM PIECES, because spelled out in full they would match this
// file and report the fence as the offender. Recorded rather than exempted: a comments-are-exempt
// carve-out removes the scan's reach into exactly the text a future reader copies from.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const deriveAndSaveTags = require('../utils/deriveJobberTags');

const REPO = path.join(__dirname, '..', '..');
const ROOTS = [path.join(REPO, 'server'), path.join(REPO, 'src')];

// The helper itself, and this fence, are the only files allowed to carry the literal comparison.
const ALLOWED = new Set([
  path.join('server', 'utils', 'invoicePaid.js'),
  path.join('server', 'test', 'oneDefinitionOfPaid.test.js'),
]);

const PAID = 'pa' + 'id';                      // assembled, so this file is not its own offender
const STATUS = 'invoice' + 'Status';
const SNAKE = 'invoice' + '_status';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(p, out);
    } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

// Strips // line comments and /* */ blocks, so PROSE describing the rule is not an offender while
// CODE still is. ⚠ The opposite choice — scanning comments too — would make every explanatory
// note in this arc a failure, and the notes are how the rule survives.
function stripComments(src) {
  return src
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('one definition of paid — nothing but the helper may decide it', () => {

  // Built once so both cases below report the same finding set.
  const offenders = [];
  const scanned = [];

  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const rel = path.relative(REPO, file);
      if (ALLOWED.has(rel)) continue;
      scanned.push(rel);
      const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, idx) => {
        // A comparison between an invoice status and the paid literal, in either spelling and
        // either direction, with or without a toLowerCase() in between.
        const hasStatus = line.includes(STATUS) || line.includes(SNAKE);
        if (!hasStatus) return;
        const quoted = line.includes(`'${PAID}'`) || line.includes(`"${PAID}"`);
        if (!quoted) return;
        if (!/===|!==|==|!=/.test(line)) return;
        offenders.push(`${rel}:${idx + 1}  ${line.trim()}`);
      });
    }
  }

  it('the scan actually reads files — an empty walk would make the check below vacuous', () => {
    // ⚠ THE FENCE'S OWN NON-VACUITY CHECK. If the walk ever returns nothing — a moved root, a
    // renamed directory, a readdir that throws and is swallowed — the assertion below passes
    // against an empty set, which is the failure mode of this entire class.
    assert.ok(scanned.length > 200, `only ${scanned.length} files scanned — the walk is probably broken`);
    assert.ok(scanned.some((f) => f.includes('pipelineSync')), 'the walk must reach server/crm');
    assert.ok(scanned.some((f) => f.startsWith('src')), 'the walk must reach src/');
    assert.ok(fs.existsSync(path.join(REPO, 'server', 'utils', 'invoicePaid.js')),
      'the helper must exist, or there is no one definition to enforce');
  });

  it('no file outside the helper compares an invoice status to the paid literal', () => {
    assert.deepEqual(offenders, [],
      'each line below decides "paid" for itself. Import isInvoicePaid from '
      + 'server/utils/invoicePaid.js instead — or PAID_STATUS if you need the string rather than '
      + `the decision:\n  ${offenders.join('\n  ')}`);
  });

  it('every site that decides paid imports the helper — the seven that used to inline it', () => {
    // ⚠ NAMED FILES, because "no offenders" is also true of a file that stopped deciding at all.
    // This is the paired positive: the seven must still be MAKING the decision, via the helper.
    const MUST_IMPORT = [
      path.join('server', 'crm', 'pipelineSync.js'),
      path.join('server', 'jobs', 'fullJobberImport.js'),
      path.join('server', 'referralRules.js'),
      path.join('server', 'routes', 'admin', 'campaigns.js'),
      path.join('server', 'routes', 'webhooks', 'jobber.js'),
      path.join('server', 'utils', 'deriveJobberTags.js'),
      path.join('server', 'utils', 'attributionDecide.js'),
    ];
    for (const rel of MUST_IMPORT) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
      assert.match(src, /require\(['"][^'"]*invoicePaid['"]\)/,
        `${rel} must import the shared helper — it is one of the sites that used to decide for itself`);
      assert.match(src, /isInvoicePaid|PAID_STATUS/, `${rel} must actually USE what it imports`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('the definition BITES — the tags a client gets change with it', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ THE SOURCE FENCE ABOVE PROVES NOBODY WRITES THE COMPARISON. IT PROVES NOTHING ABOUT WHAT
  // THE APP DOES. These cases run the real deriveAndSaveTags against the real database, so
  // reverting a site to status-only fails here too — not only in a text scan. A sweep proves a
  // string is absent; it cannot prove the code still behaves.

  const T = 'onedef-a';
  const CID = 'od-client-1';
  let pool;

  const client = (invoice) => ({
    isCompany: false, isLead: false, tags: { nodes: [] }, customFields: [],
    // ⚠ FLAT ARRAYS for quotes and requests, connection shape for tags — that is what the
    // callers pass, and it is not arbitrary. deriveAndSaveTags does quotes.filter(...), so handing
    // it { nodes: [] } throws a TypeError into its own SWALLOWING catch and the invoice block below
    // never runs at all. The paired positive then fails with no error anywhere, which is how this
    // was found — and it is why a function that swallows needs a positive control.
    quotes: [], requests: [],
    // ⚠ jobs AND j.invoices ARE PLAIN ARRAYS. deriveAndSaveTags takes the FLATTENED shape — its
    // callers do `(relatedData.jobs?.nodes || []).map(j => ({ ...j, invoices: j.invoices?.nodes ||
    // [] }))` before calling it — while classifyPipelineStatus takes the CONNECTION shape. Two
    // consumers of ONE fetch needing OPPOSITE shapes is CLAUDE.md's vacuity shape #12, and this
    // fixture got it wrong THREE times in a row: quotes, then jobs' invoices, then jobs itself.
    // Each time the only symptom was the paired positive failing with nothing in error_log,
    // because deriveAndSaveTags catches its own TypeError and logs — which is precisely why a
    // function that swallows needs a positive control rather than only negative assertions.
    jobs: [{
      id: 'od-job-1', jobStatus: 'active', jobType: 'ONE_OFF',
      completedAt: null, createdAt: new Date().toISOString(),
      customFields: [], invoices: [invoice],
    }],
    invoices: [],
  });

  const invoice = (over = {}) => ({
    id: 'od-inv-1', invoiceStatus: 'paid', createdAt: new Date().toISOString(),
    amounts: { total: 900, invoiceBalance: 0 }, ...over,
  });

  const tagsOf = async () => (await pool.query(
    `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2 ORDER BY tag`,
    [T, CID])).rows.map((r) => r.tag);

  before(async () => { pool = await initTestDb(); });
  after(async () => { await pool.end(); });

  beforeEach(async () => {
    await pool.query(`DELETE FROM contact_tags WHERE contractor_id = $1`, [T]);
    await pool.query(`DELETE FROM jobber_clients WHERE contractor_id = $1`, [T]);
    await pool.query(`DELETE FROM contractors WHERE id = $1`, [T]);
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [T]);
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
       VALUES ($1, $2, 'Od', NOW())`, [CID, T]);
  });

  // ⚠ THE MARKER IS paying_client, NOT invoice:paid, AND THE DIFFERENCE IS THE FINDING.
  // deriveJobberTags writes invoice:<status> from INVOICE_STATUS_MAP — a verbatim mirror of
  // Jobber's status across all five values, NOT a paid-ness decision. The two tags isInvoicePaid
  // actually drives are paying_client (lifetime) and value:* (the revenue bracket). The first
  // draft of this case asserted invoice:paid and FAILED, which is how the distinction surfaced.
  it('PAIRED POSITIVE — a settled invoice with a real total DOES get paying_client and a value bracket', async () => {
    await deriveAndSaveTags(pool, T, CID, client(invoice()));
    const tags = await tagsOf();
    assert.ok(tags.includes('paying_client'),
      'without this the negatives below pass against tagging that never runs at all');
    assert.ok(tags.some((t) => t.startsWith('value:')), 'the revenue bracket comes from the same filter');
  });

  it('a $0 invoice with status paid does NOT get paying_client or a value bracket', async () => {
    await deriveAndSaveTags(pool, T, CID, client(invoice({ amounts: { total: 0, invoiceBalance: 0 } })));
    const tags = await tagsOf();
    assert.ok(!tags.includes('paying_client'), 'zero-value work must not mark a client as paying');
    assert.ok(!tags.some((t) => t.startsWith('value:')), 'and it must not land in a revenue bracket');
  });

  it('a status-paid invoice with a NON-ZERO balance does NOT get paying_client', async () => {
    await deriveAndSaveTags(pool, T, CID, client(invoice({ amounts: { total: 900, invoiceBalance: 250 } })));
    assert.ok(!(await tagsOf()).includes('paying_client'), 'an unsettled invoice is not a paid one');
  });

  it('a VOIDED invoice with a zero balance does NOT get paying_client', async () => {
    await deriveAndSaveTags(pool, T, CID, client(invoice({ invoiceStatus: 'voided' })));
    assert.ok(!(await tagsOf()).includes('paying_client'));
  });
});
