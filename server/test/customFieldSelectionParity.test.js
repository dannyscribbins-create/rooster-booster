'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT A — EVERY CAPTURE DOOR SELECTS THE CONFIGURATION ID, AND A FENCE THAT CAN SEE DEPTH 2
//
// ⚠ THE DEFECT THIS CLOSES: THE MONEY DOOR CAPTURED ZERO CUSTOM-FIELD FACTS AND REPORTED SUCCESS.
// `writeCustomFieldFacts` skips any field with no configuration id —
// `const configurationId = field?.customFieldConfiguration?.id; if (!configurationId) continue;` —
// and `server/routes/webhooks/jobber.js` selected `customFieldConfiguration` **zero times**, measured
// with `grep -c` on 2026-10-01. So the invoice-paid door wrote no custom-field facts at all, which is
// this arc's most-repeated shape: a writer reading a field no query selects, where the absent value
// reads as an answer rather than as "nobody looked".
//
// ⚠ AND TWO OF THE FOUR SELECTIONS ON THAT DOOR HAD NO `customFields` WHATSOEVER — the INVOICE and
// the QUOTE. `categorySource`'s ruling 1 reads the INVOICE copy FIRST, then the job, then the linked
// quote, so the door that decides money could not see its first or its last choice. The live tenant
// proves that is not theoretical: a real Accent job reports `""` while its invoice copy reports
// `"Out of Pocket"`.
//
// ⚠ WHY THE EXISTING reads-vs-selects FENCE COULD NOT CATCH IT, STATED RATHER THAN ASSUMED AWAY.
// `captureFetchContract.test.js` derives a writer's reads from `factCapture.js` and compares them
// against the per-entity selection constants — and its derivation extracts top-level and
// SINGLE-NESTED fields only, a limit its own suite fences explicitly. `customFieldConfiguration.id`
// sits at depth 2 inside `customFields`. **The fence is not broken; this was outside its stated
// reach, which is exactly why that reach was written down.** This file is the depth-2 reader.
//
// ⚠ IT READS THE RESOLVED QUERY TEXT, NOT THE SOURCE, AND PER ENTITY RATHER THAN PER FILE. Both are
// deliberate. Source regex would pass on a file that interpolates a constant it never reaches; and a
// whole-query check passes when the field appears somewhere ELSE in the query — which is not
// hypothetical in this repo, where checking `writeJobFacts` against `BASE_QUERY` reported
// `salesperson` and `total` as selected because the quote and invoice constants carry them.
//
// ⚠ AND THERE IS A PAIRED NEGATIVE THAT MATTERS: THE REQUEST SELECTIONS MUST CARRY NONE.
// `CustomFieldAppliesTo` has seven values and **there is no request entity** — a custom field cannot
// attach to a request. A fence that only ever demanded "more fields" would be satisfied by adding
// them everywhere, including where Jobber would reject the query outright.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const fetchMod = require('../utils/jobberClientFetch');
const webhookRouter = require('../routes/webhooks/jobber');
const { captureClientFacts, writeCustomFieldFacts } = require('../utils/factCapture');
const { certifyFullyPaged } = require('../utils/captureCompleteness');
const { isDerivableJobberClientId } = require('../utils/derivableClient');

const TENANT = 'cfsel-tenant';

// ⚠ REALISTIC JOBBER EncodedIds, BUILT RATHER THAN TYPED, so every gated branch is genuinely
// ENTERED. `isDerivableJobberClientId` rejects a synthetic id like `'c1'`, and CLAUDE.md records a
// whole commit whose new branch no pre-existing fixture could reach for exactly that reason.
const gid = (type, n) => Buffer.from(`gid://Jobber/${type}/${n}`).toString('base64');
const CLIENT = gid('Client', '91000001');
const JOB = gid('Job', '91000002');
const INVOICE = gid('Invoice', '91000003');
const QUOTE = gid('Quote', '91000004');

// Configuration ids, one per entity, so a row can be attributed to the stage it came from.
const CFG_CLIENT_TEXT = gid('CustomFieldConfigurationText', '7100001');
const CFG_CLIENT_DROPDOWN = gid('CustomFieldConfigurationDropdown', '7100002');
const CFG_JOB = gid('CustomFieldConfigurationDropdown', '7100003');
const CFG_INVOICE = gid('CustomFieldConfigurationDropdown', '7100004');
const CFG_QUOTE = gid('CustomFieldConfigurationDropdown', '7100005');

// ── THE DEPTH-2 READER ───────────────────────────────────────────────────────

/**
 * Every `customFields { … }` block in a GraphQL selection, brace-matched to its close.
 * Inputs: resolved query or selection text. Output: an array of block strings.
 *
 * ⚠ BRACE-MATCHED, NOT A LINE WINDOW. A window heuristic around the word `customFields` reads
 * neighbouring selections and reports a member that belongs to a different block — the defect
 * CLAUDE.md records as 21 false flags in the font migration.
 */
function customFieldBlocks(text) {
  const out = [];
  const needle = 'customFields';
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at === -1) return out;
    const open = text.indexOf('{', at);
    // `customFields` with no following brace is not a selection block; skip it rather than guess.
    if (open === -1) return out;
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return out;
    out.push(text.slice(at, end + 1));
    from = end + 1;
  }
}

/**
 * What is wrong with one `customFields` block, or null when nothing is.
 * ⚠ THE THREE REQUIREMENTS ARE SEPARATE CLAIMS AND ARE REPORTED SEPARATELY. "It carries the id" and
 * "it carries both value shapes" are different defects with different symptoms: the first writes no
 * rows at all, the second writes rows for text fields and silently omits every dropdown.
 */
function faultsIn(block) {
  const faults = [];
  if (!block.includes('customFieldConfiguration { id }')) faults.push('no configuration id');
  if (!block.includes('valueText')) faults.push('no Text member');
  if (!block.includes('valueDropdown')) faults.push('no Dropdown member');
  return faults.length ? faults.join(' + ') : null;
}

/**
 * The client's own SCALAR selections — the tokens before its first sub-selection.
 *
 * ⚠ THIS EXISTS BECAUSE A GUARD-PROOF MEASURED MY FIRST NEEDLE AT WIDTH 0, AND IT IS THE
 * SUBSTRING TRAP IN THE FENCE RATHER THAN IN THE CODE. The first writing asserted
 * `/\bid\b/` against the client-level slice — and that slice OPENS with `client(id: $id) {` and
 * CONTAINS `customFieldConfiguration { id }`, so the needle was satisfied twice over by text that
 * says nothing about whether the client's own `id` is selected. Deleting `id` from the selection
 * left the case GREEN.
 *
 * ⚠ SO IT IS A TOKEN CHECK OVER THE SCALAR HEAD, not a substring search over a region. Cutting at
 * the first `{` drops every sub-selection, which is what makes `id` here mean the client's id and
 * nothing else.
 */
function clientScalarTokens(query) {
  const at = query.indexOf('client(id: $id) {');
  assert.ok(at > -1, 'harness: the client selection must be found');
  const body = query.slice(query.indexOf('{', at) + 1);
  const firstSub = body.indexOf('{');
  assert.ok(firstSub > -1, 'harness: a client selection must open at least one sub-selection');
  return body.slice(0, firstSub).split(/\s+/).filter(Boolean);
}

/** The client's OWN selection, cut out of a full client query before its first connection. */
function clientLevelSlice(query) {
  const at = query.indexOf('client(id: $id) {');
  assert.ok(at > -1, 'harness: the client selection must be found');
  const rest = query.slice(at);
  const ends = ['jobs(first:', 'quotes(first:', 'requests(first:', 'invoices(first:']
    .map((k) => rest.indexOf(k)).filter((i) => i > -1);
  assert.ok(ends.length > 0, 'harness: a client query must open at least one connection');
  return rest.slice(0, Math.min(...ends));
}

const Q = webhookRouter._captureQueries;

// Every capture-path selection that MUST carry the full custom-field shape, per entity.
// ⚠ ASSEMBLED FROM EXPORTS, NEVER A TYPED LIST OF FILES. Every sweep in this repo built from a
// hand-maintained list has gone stale without announcing it.
const MUST_CARRY = () => [
  // The shared fetcher — every door except the webhook routes through it.
  ['jobberClientFetch CLIENT_FIELDS', fetchMod.CLIENT_FIELDS],
  ['jobberClientFetch QUOTE_FIELDS', fetchMod.QUOTE_FIELDS],
  ['jobberClientFetch JOB_FIELDS', fetchMod.JOB_FIELDS],
  ['jobberClientFetch INVOICE_FIELDS', fetchMod.INVOICE_FIELDS],
  ['jobberClientFetch BASE_QUERY client level', clientLevelSlice(fetchMod.BASE_QUERY)],
  // The webhook door's own query — the one that carried none of this.
  ['webhook RELATED_BASE_QUERY client level', clientLevelSlice(Q.RELATED_BASE_QUERY)],
  ['webhook RELATED_JOBS_PAGE_QUERY', Q.RELATED_JOBS_PAGE_QUERY],
  ['webhook RELATED_QUOTES_PAGE_QUERY', Q.RELATED_QUOTES_PAGE_QUERY],
  ['webhook RELATED_INVOICES_PAGE_QUERY', Q.RELATED_INVOICES_PAGE_QUERY],
  ['webhook INVOICE_WITH_JOBS_QUERY', Q.INVOICE_WITH_JOBS_QUERY],
  ['webhook INVOICE_JOBS_PAGE_QUERY', Q.INVOICE_JOBS_PAGE_QUERY],
  ['webhook INVOICE_ARCHIVED_JOBS_PAGE_QUERY', Q.INVOICE_ARCHIVED_JOBS_PAGE_QUERY],
];

describe('the depth-2 selection fence', () => {
  it('HARNESS FLOOR: the writer still reads the configuration id at depth 2', () => {
    // ⚠ WITHOUT THIS THE WHOLE FILE COULD PASS AGAINST A WRITER THAT NO LONGER CARES. The fence's
    // subject is "the selection supplies what the writer reads"; if the writer stops reading it,
    // every assertion below is about nothing.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'factCapture.js'), 'utf8');
    assert.match(src, /customFieldConfiguration\?\.id/,
      'harness: writeCustomFieldFacts must still key on the configuration id');
    assert.match(src, /if \(!configurationId\) continue;/,
      'harness: and must still SKIP a field without one — that skip is the silent failure');
  });

  it('HARNESS FLOOR, BOTH DIRECTIONS: the checker flags a narrow block and spares a full one', () => {
    // ⚠ ASSEMBLED BY CONCATENATION, DELIBERATELY. Spelled out in full, the narrow form below WOULD
    // BE the defect this file forbids, sitting in a file the fence reads — CLAUDE.md's
    // "scans read test files, so prose describing a forbidden pattern IS the pattern". Rewording is
    // the rule; exempting the file would remove the fence's reach into the text an idiom gets
    // copied from.
    const narrow = 'customFields {\n  ... on CustomField' + 'Text { label value' + 'Text }\n}';
    assert.equal(customFieldBlocks(narrow).length, 1, 'harness: the block parser must find it');
    assert.equal(faultsIn(customFieldBlocks(narrow)[0]),
      'no configuration id + no Dropdown member',
      'the checker must name BOTH faults in the exact pre-fix shape');

    // And the paired positive — the real shared constant must be clean, or the negative above
    // proves only that the checker dislikes something.
    const good = customFieldBlocks(fetchMod.CUSTOM_FIELDS);
    assert.equal(good.length, 1, 'harness: the shared constant must contain exactly one block');
    assert.equal(faultsIn(good[0]), null, 'the shared selection must itself be clean');
  });

  it('every capture-path selection carries the configuration id and BOTH value members', () => {
    const offenders = [];
    let blocksSeen = 0;
    for (const [name, text] of MUST_CARRY()) {
      assert.ok(typeof text === 'string' && text.length > 0, `harness: ${name} must be a string`);
      const blocks = customFieldBlocks(text);
      assert.ok(blocks.length > 0, `${name} selects NO customFields at all`);
      for (const block of blocks) {
        blocksSeen += 1;
        const fault = faultsIn(block);
        if (fault) offenders.push(`${name} — ${fault}`);
      }
    }
    // ⚠ A NON-VACUITY FLOOR ON THE POPULATION, not only on the needle. An empty MUST_CARRY list, or
    // an export renamed to undefined, would otherwise pass this case having checked nothing.
    assert.ok(blocksSeen >= 12,
      `harness: expected at least 12 custom-field blocks across the capture path, saw ${blocksSeen}`);
    assert.deepEqual(offenders, [],
      'a capture-path selection is missing part of the custom-field shape:\n  ' + offenders.join('\n  '));
  });

  it('PAIRED NEGATIVE: the REQUEST selections carry NO customFields, because no such entity exists', () => {
    // ⚠ `CustomFieldAppliesTo` has seven values and a request is not one of them. This is what stops
    // the fence above degrading into "add the fields everywhere": doing so here would make Jobber
    // reject the query outright.
    for (const [name, text] of [
      ['jobberClientFetch REQUEST_FIELDS', fetchMod.REQUEST_FIELDS],
      ['webhook RELATED_REQUESTS_PAGE_QUERY', Q.RELATED_REQUESTS_PAGE_QUERY],
    ]) {
      assert.equal(customFieldBlocks(text).length, 0,
        `${name} must not select customFields — there is no request entity`);
    }
  });

  it('the record-level configuration takes NO inline fragments, on the webhook door too', () => {
    // ⚠ TWO SELECTIONS THAT LOOK ALIKE WITH OPPOSITE REQUIREMENTS. `customFieldConfiguration` on a
    // RECORD is the concrete matching type and fragments there are rejected with thirty errors;
    // `transferedFrom` on a CONFIGURATION is a union and REQUIRES them. The existing fence pins this
    // for `jobberClientFetch`; now that the webhook door carries the selection, it is pinned there
    // too — by reading the resolved query rather than the file, so an imported constant is covered.
    for (const [name, text] of MUST_CARRY()) {
      assert.ok(!text.includes('customFieldConfiguration { ... on'),
        `${name}: a record-level configuration must not take inline fragments`);
    }
  });

  it('the webhook door selects the client id, so the full-capture marker can fire at all', () => {
    // ⚠ THIS WAS THE SECOND HALF OF THE SAME DEFECT AND IT IS WORTH ITS OWN CASE.
    // `fetchClientRelatedData` DOES call `certifyFullyPaged`, but its client selection had no `id` —
    // so `captureClientFacts`'s stamp (`isCertifiedFullyPaged(client) && client.id`) was skipped on
    // EVERY webhook door. Measured 2026-10-01: 10 of 19,598 clients stamped, while the webhook doors
    // are the most frequent capture path. The marker is what makes a client eligible for the catch-up
    // job, so a door that certifies completeness and cannot record it is a mechanism reporting
    // health it never observed.
    // ⚠ A TOKEN CHECK, AND THE FIRST WRITING OF THIS CASE WAS VACUOUS. It asserted `/\bid\b/` over
    // the whole client-level slice, which OPENS with `client(id: $id) {` and CONTAINS
    // `customFieldConfiguration { id }` — so deleting the client's own `id` left it GREEN. Measured
    // at width 0 by the guard-proof, not noticed by reading it.
    const tokens = clientScalarTokens(Q.RELATED_BASE_QUERY);
    assert.ok(tokens.includes('id'),
      `the webhook client selection must select id — scalars are: ${tokens.join(' ')}`);
    // And the positive control: the shared fetcher has always selected it, so a reader can tell the
    // two doors were brought into line rather than both being broken.
    assert.ok(clientScalarTokens(fetchMod.BASE_QUERY).includes('id'),
      'harness: the shared fetcher must still select the client id');
  });

  it('ONE definition of the selection — the webhook door imports it rather than spelling its own', () => {
    // ⚠ A SECOND COPY IS HOW ONE COPY GETS FIXED AND THE OTHER DOES NOT, which is precisely what
    // happened: `jobberClientFetch` was widened for 7c-2 and the webhook door was not, for three
    // weeks, on the path that decides money.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    assert.ok(!/\.\.\. on CustomField/.test(stripped),
      'the webhook door must not spell its own custom-field members — import CUSTOM_FIELDS instead');
    assert.match(stripped, /\bCUSTOM_FIELDS\b/,
      'and it must actually use the shared constant');
  });
});

// ── BEHAVIOUR: THE FACTS LAND, PER ENTITY, THROUGH THE REAL WRITER ───────────

let pool;

/** A connection-shaped client carrying custom fields at all four levels. */
const fullShape = () => ({
  id: CLIENT,
  isCompany: false,
  isLead: false,
  isArchived: false,
  tags: { nodes: [] },
  customFields: [
    { label: 'Referred by', valueText: 'Jane Referrer', customFieldConfiguration: { id: CFG_CLIENT_TEXT } },
    { label: 'Insurance Company', valueDropdown: 'Acme Mutual', customFieldConfiguration: { id: CFG_CLIENT_DROPDOWN } },
  ],
  requests: { nodes: [] },
  quotes: {
    nodes: [{
      id: QUOTE, quoteStatus: 'approved', createdAt: new Date().toISOString(), client: { id: CLIENT },
      customFields: [{ label: 'Job Type', valueDropdown: 'New Construction', customFieldConfiguration: { id: CFG_QUOTE } }],
    }],
  },
  jobs: {
    nodes: [{
      id: JOB, jobStatus: 'active', createdAt: new Date().toISOString(), client: { id: CLIENT },
      customFields: [{ label: 'Job Type', valueDropdown: '', customFieldConfiguration: { id: CFG_JOB } }],
    }],
  },
  invoices: {
    nodes: [{
      id: INVOICE, invoiceStatus: 'paid', client: { id: CLIENT },
      amounts: { total: 1000, invoiceBalance: 0 },
      jobs: { nodes: [{ id: JOB }], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      customFields: [{ label: 'Job Type', valueDropdown: 'Out of Pocket', customFieldConfiguration: { id: CFG_INVOICE } }],
    }],
  },
});

const factsFor = async (entity) => {
  const { rows } = await pool.query(
    `SELECT entity, entity_jobber_id, jobber_client_id, configuration_id, label,
            value_dropdown, value_text
       FROM crm_custom_field_facts
      WHERE contractor_id = $1 AND entity = $2
      ORDER BY configuration_id`, [TENANT, entity]);
  return rows;
};

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'crm_custom_field_facts', 'category_mismatches',
    'pipeline_cache', 'jobber_clients', 'error_log',
  ]) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]).catch(async () => {
      await pool.query(`DELETE FROM ${t}`);
    });
  }
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
});

describe('custom-field facts land for all four entities', () => {
  it('the fixture ids are real Jobber EncodedIds, so the gated branches are ENTERED', () => {
    assert.equal(Buffer.from(CLIENT, 'base64').toString('utf8'), 'gid://Jobber/Client/91000001');
    assert.equal(isDerivableJobberClientId(CLIENT), true);
  });

  it('a capture writes a fact for the CLIENT, the quote, the job and the invoice', async () => {
    const res = await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });

    // ⚠ FIVE, NOT FOUR: the client carries TWO fields (a text and a dropdown).
    assert.equal(res.customFields, 5, 'one row per field across the four stages');

    const clients = await factsFor('ALL_CLIENTS');
    assert.equal(clients.length, 2, 'ALL_CLIENTS facts must be captured — they never were before');
    assert.equal((await factsFor('ALL_QUOTES')).length, 1);
    assert.equal((await factsFor('ALL_JOBS')).length, 1);
    assert.equal((await factsFor('ALL_INVOICES')).length, 1);
  });

  it('a client-level DROPDOWN field is captured, with its value in the dropdown column', async () => {
    // ⚠ THE SPECIFIC GAP THE OLD CLIENT SELECTION HAD. `CLIENT_SCALARS` selected
    // `... on CustomFieldText` ONLY, so a dropdown client field did not arrive at all — and Accent's
    // live ALL_CLIENTS set contains one ("Insurance Company"), so this was reachable.
    await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });
    const rows = await factsFor('ALL_CLIENTS');
    const dropdown = rows.find((r) => r.configuration_id === CFG_CLIENT_DROPDOWN);
    assert.ok(dropdown, 'the dropdown client field must be captured');
    assert.equal(dropdown.value_dropdown, 'Acme Mutual');
    assert.equal(dropdown.value_text, null, 'and its text column stays null — the shapes are distinct');

    const text = rows.find((r) => r.configuration_id === CFG_CLIENT_TEXT);
    assert.ok(text, 'and the text client field too');
    assert.equal(text.value_text, 'Jane Referrer');
    assert.equal(text.value_dropdown, null);
  });

  it('the ALL_CLIENTS row keys the record and the client to the SAME id, which the entity means', async () => {
    await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });
    for (const row of await factsFor('ALL_CLIENTS')) {
      assert.equal(row.entity_jobber_id, CLIENT);
      assert.equal(row.jobber_client_id, CLIENT, 'for a client-entity field the record IS the client');
    }
  });

  it('the INVOICE copy is captured, which is the stage categorySource reads FIRST', async () => {
    // ⚠ THIS IS THE COMMIT'S WHOLE POINT ON THE MONEY DOOR. The webhook's invoice selection carried
    // no customFields at all, so ruling 1's first choice was structurally unavailable there.
    await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });
    const [inv] = await factsFor('ALL_INVOICES');
    assert.equal(inv.value_dropdown, 'Out of Pocket');
    // And the job's BLANK value is stored as a blank rather than collapsed to NULL — the resolver
    // decides that blank means absent, and this row is what lets it.
    const [job] = await factsFor('ALL_JOBS');
    assert.equal(job.value_dropdown, '', 'a blank stays a blank; `?? null` not `|| null`');
  });

  it('FAILS CLOSED: a field with no configuration id writes NOTHING, per entity', async () => {
    // ⚠ THE EXACT PRE-FIX STATE, DRIVEN THROUGH THE REAL WRITER. This is what every webhook-door
    // capture did: fields present, configuration id absent, zero rows, success reported.
    const client = fullShape();
    client.customFields = [{ label: 'Referred by', valueText: 'Jane Referrer' }];
    for (const n of client.jobs.nodes) n.customFields = [{ label: 'Job Type', valueDropdown: 'x' }];
    for (const n of client.quotes.nodes) n.customFields = [{ label: 'Job Type', valueDropdown: 'x' }];
    for (const n of client.invoices.nodes) n.customFields = [{ label: 'Job Type', valueDropdown: 'x' }];

    const res = await captureClientFacts(pool, { contractorId: TENANT, client });
    assert.equal(res.customFields, 0, 'no configuration id anywhere means no custom-field facts');
    for (const entity of ['ALL_CLIENTS', 'ALL_JOBS', 'ALL_QUOTES', 'ALL_INVOICES']) {
      assert.equal((await factsFor(entity)).length, 0, `${entity} must write nothing`);
    }
    // ⚠ AND THE REST OF THE CAPTURE STILL SUCCEEDED, which is what made it silent: the job, quote
    // and invoice FACTS all landed. Nothing anywhere said the category was missing.
    assert.equal(res.jobs, 1);
    assert.equal(res.invoices, 1);
  });

  it('a client with no id writes no ALL_CLIENTS row rather than one keyed on undefined', async () => {
    // The honest consequence of failing closed: a door whose query omits the client id captures
    // nothing for that entity instead of writing an unattributable row.
    const client = fullShape();
    delete client.id;
    const res = await captureClientFacts(pool, { contractorId: TENANT, client });
    assert.equal((await factsFor('ALL_CLIENTS')).length, 0);
    assert.equal(res.customFields, 3, 'the other three stages are unaffected');
  });

  it('a re-capture UPDATES rather than duplicating, and a changed value converges', async () => {
    await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });
    const changed = fullShape();
    changed.customFields[0].valueText = 'Tom Referrer';
    await captureClientFacts(pool, { contractorId: TENANT, client: changed });

    const rows = await factsFor('ALL_CLIENTS');
    assert.equal(rows.length, 2, 'still two rows — the PK is (contractor, record, configuration)');
    assert.equal(rows.find((r) => r.configuration_id === CFG_CLIENT_TEXT).value_text, 'Tom Referrer');
  });

  it('facts are scoped to the contractor', async () => {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, ['cfsel-other']);
    try {
      await captureClientFacts(pool, { contractorId: 'cfsel-other', client: fullShape() });
      assert.equal((await factsFor('ALL_CLIENTS')).length, 0, 'the other tenant must see nothing here');
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM crm_custom_field_facts WHERE contractor_id = $1`, ['cfsel-other']);
      assert.equal(rows[0].n, 5);
    } finally {
      await pool.query(`DELETE FROM crm_custom_field_facts WHERE contractor_id = $1`, ['cfsel-other']);
      await pool.query(`DELETE FROM crm_invoice_job_links WHERE contractor_id = $1`, ['cfsel-other']);
      await pool.query(`DELETE FROM crm_invoice_facts WHERE contractor_id = $1`, ['cfsel-other']);
      await pool.query(`DELETE FROM crm_job_facts WHERE contractor_id = $1`, ['cfsel-other']);
      await pool.query(`DELETE FROM crm_quote_facts WHERE contractor_id = $1`, ['cfsel-other']);
      await pool.query(`DELETE FROM contractors WHERE id = $1`, ['cfsel-other']);
    }
  });

  it('writeCustomFieldFacts REFUSES an entity it was not given, rather than defaulting one', async () => {
    await assert.rejects(
      () => writeCustomFieldFacts(pool, TENANT, null, []),
      /entity is required/,
      'a defaulted entity would silently file a fact under the wrong stage');
  });

  it('END TO END: the fixture is PROJECTED from the real webhook query, so a narrowed door writes nothing', async () => {
    // ⚠ A STUB THAT ANSWERS A FIXED FIXTURE REGARDLESS OF THE QUERY CANNOT DISCOVER A MISSING
    // SELECTION. CLAUDE.md records that harness defect twice in this arc — once where dropping
    // `updatedAt` left 37/37 green, once where dropping `receivedDate` left 39/39 green — both found
    // only by a guard-proof that refused to go red. So this case builds its fixture FROM the real
    // query text: a field carries `customFieldConfiguration` only if the door actually asks for it,
    // and a dropdown arrives only if the door selects the Dropdown member.
    //
    // ⚠ IT ASSERTS ITS OWN PRECONDITION, so it cannot quietly become vacuous: if the door stops
    // selecting the id, the precondition fails AND the projected capture writes nothing. One
    // injection, two independent reds.
    const slice = clientLevelSlice(Q.RELATED_BASE_QUERY);
    const selectsCfg = slice.includes('customFieldConfiguration { id }');
    const selectsDropdown = slice.includes('valueDropdown');
    const selectsText = slice.includes('valueText');

    assert.equal(selectsCfg, true,
      'PRECONDITION: the invoice-paid door must select the configuration id');
    assert.equal(selectsDropdown, true, 'PRECONDITION: and the Dropdown member');
    assert.equal(selectsText, true, 'PRECONDITION: and the Text member');

    // The projection. Only what the query selects reaches the writer.
    const project = (field) => {
      const out = { label: field.label };
      if (field.valueText !== undefined && selectsText) out.valueText = field.valueText;
      if (field.valueDropdown !== undefined && selectsDropdown) out.valueDropdown = field.valueDropdown;
      if (selectsCfg) out.customFieldConfiguration = field.customFieldConfiguration;
      return out;
    };

    const client = fullShape();
    client.customFields = fullShape().customFields
      .filter((f) => (f.valueDropdown !== undefined ? selectsDropdown : selectsText))
      .map(project);

    // ⚠ THE CLIENT'S OWN `id` IS PROJECTED TOO, so the second half of the same defect is observable
    // here rather than only in the fence. `writeCustomFieldFacts` needs the record id AND the client
    // id, and for this entity they are the same value — so a door that does not select `id` writes no
    // ALL_CLIENTS fact at all, and cannot stamp the full-capture marker either.
    const selectsClientId = clientScalarTokens(Q.RELATED_BASE_QUERY).includes('id');
    assert.equal(selectsClientId, true, 'PRECONDITION: the door must select the client id');
    if (!selectsClientId) delete client.id;

    await captureClientFacts(pool, { contractorId: TENANT, client });
    const rows = await factsFor('ALL_CLIENTS');
    assert.equal(rows.length, 2,
      'both client fields must land when the door selects the whole shape');
    assert.ok(rows.some((r) => r.value_dropdown === 'Acme Mutual'),
      'including the dropdown, which the pre-fix selection could not deliver at all');
  });

  it('the full-capture marker fires on a CERTIFIED capture once the client id is present', async () => {
    // ⚠ PAIRED WITH THE SELECTION CASE ABOVE. The fence proves the webhook door now selects `id`;
    // this proves what selecting it BUYS — the stamp that makes a client eligible for the catch-up.
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name) VALUES ($1, $2, 'Sel')`,
      [CLIENT, TENANT]);

    const uncertified = await captureClientFacts(pool, { contractorId: TENANT, client: fullShape() });
    assert.equal(uncertified.fullCaptureStamped, 0, 'an uncertified capture must never stamp');

    const certified = await captureClientFacts(
      pool, { contractorId: TENANT, client: certifyFullyPaged(fullShape()) });
    assert.equal(certified.fullCaptureStamped, 1, 'a certified capture stamps exactly one row');
  });
});
