'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-2 — WHERE THE PAYOUT CATEGORY COMES FROM (Danny's rulings 1-3, 2026-09-30)
//
// ⚠ EVERY FIXTURE USES A REAL JOBBER EncodedId, NOT A SYNTHETIC ONE, AND THAT IS DELIBERATE. A
// synthetic id like 'job-1' is what let the 7b `$3` defect ship: `isDerivableJobberClientId` rejects
// one, so no pre-existing fixture could ENTER the branch that commit added and the gate was green
// because the code never ran. The ids below decode to real `gid://Jobber/...` forms, and a case
// below asserts a decode so the claim is checked rather than asserted.
//
// ⚠ THE CENTRAL PROPERTY IS A REFUSAL, NOT A LOOKUP: a same-label field with NO link must be
// IGNORED. On the live tenant Accent has THREE configurations named "Job Type" and two of them share
// an identical 19-option list, so the label cannot distinguish them and neither can the option list.
// Only `transferedFrom` can. A resolver that matched by label would read the wrong field and pay on
// the wrong schedule, and it would look exactly like working code.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET, including `category_mismatches` and
// `crm_custom_field_facts` which it both writes AND asserts the absence of — an absence assertion
// over an uncleared table starts measuring a prior case's leftovers.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON, so a
// per-describe teardown would end the pool the next describe needs and CANCEL its cases under a
// green-looking `fail 0`.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveCategoryValue, resolveAcceptableConfigurations, readMappedConfigurationId, valueOf,
  STAGE_ORDER,
} = require('../utils/categorySource');
const { writeCustomFieldFacts, captureClientFacts } = require('../utils/factCapture');

const TENANT = 'category-source-tenant';
const OTHER = 'category-source-other';

// Real Jobber EncodedIds. The decode is asserted in a case below.
const CLIENT    = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85OTAwMDE=';
const CLIENT_B  = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85OTAwMDI=';
const JOB       = 'Z2lkOi8vSm9iYmVyL0pvYi83NzAwMDE=';
const QUOTE     = 'Z2lkOi8vSm9iYmVyL1F1b3RlLzY2MDAwMQ==';
const INVOICE   = 'Z2lkOi8vSm9iYmVyL0ludm9pY2UvODgwMDAx';
const INVOICE2  = 'Z2lkOi8vSm9iYmVyL0ludm9pY2UvODgwMDAy';
// 730114 ALL_JOBS (the mapped field) · 730115 ALL_INVOICES (its transferred counterpart)
// · 1573072 ALL_QUOTES · 999999 a DECOY sharing the label with no link
const CFG_JOB   = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzczMDExNA==';
const CFG_INV   = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzczMDExNQ==';
const CFG_QUO   = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzE1NzMwNzI=';
const CFG_DECOY = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzk5OTk5OQ==';

const LABEL = 'Job Type';

let pool;

async function seedTenant(id) {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
}

/**
 * The four configurations, with the link that ruling 1 turns on.
 *
 * ⚠ ONE OPTIONS OBJECT, NOT `(tenant, opts)`, AND THAT SHAPE IS THE FIX FOR A REAL VACUITY RATHER
 * THAN TIDINESS. Written `(tenant = TENANT, { linkInvoice } = {})`, the call
 * `seedConfigurations({ linkInvoice: true })` binds the OBJECT to `tenant` — so all four rows landed
 * under contractor_id `[object Object]` and the table was EMPTY for the real tenant. The central
 * case then passed for the wrong reason: the decoy was excluded because NO configuration existed to
 * make it acceptable, not because the link was followed, and it passed identically under the
 * label-matching injection. A guard-proof found it; reading the test could not.
 */
async function seedConfigurations({ tenant = TENANT, linkInvoice = true } = {}) {
  const rows = [
    [CFG_JOB, LABEL, 'ALL_JOBS', true, null],
    // ⚠ THE COUNTERPART DECLARES ITS SOURCE. With `linkInvoice: false` it becomes a same-label
    // field with no link — which ruling 1 says must be ignored.
    [CFG_INV, LABEL, 'ALL_INVOICES', false, linkInvoice ? CFG_JOB : null],
    [CFG_QUO, LABEL, 'ALL_QUOTES', false, null],
    // A DECOY: same label, ALL_INVOICES, and NO link. It exists so "match by label" and
    // "follow the link" give different answers.
    [CFG_DECOY, LABEL, 'ALL_INVOICES', false, null],
  ];
  for (const [id, label, entity, transferable, from] of rows) {
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, entity, transferable, transfered_from, discovered_at)
       VALUES ($1, $2, $3, 'dropdown', $4, $5, $6, NOW())`,
      [tenant, id, label, entity, transferable, from]
    );
  }
}

/** Map work_category to the JOB-level configuration, by id (never by label). */
async function mapByIdTo(configurationId, tenant = TENANT) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
    [tenant, JSON.stringify({ work_category: { field_id: configurationId, entity: 'ALL_JOBS', label: LABEL } })]
  );
}

/** The LEGACY label-only mapping, which must resolve nothing rather than guess. */
async function mapByLabel(tenant = TENANT) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
    [tenant, JSON.stringify({ work_category: LABEL })]
  );
}

const fact = (entity, recordId, configurationId, dropdown, { tenant = TENANT, client = CLIENT, text = null } = {}) =>
  pool.query(
    `INSERT INTO crm_custom_field_facts
       (contractor_id, entity, entity_jobber_id, jobber_client_id, configuration_id, label, value_dropdown, value_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [tenant, entity, recordId, client, configurationId, LABEL, dropdown, text]
  );

const mismatchRows = async (tenant = TENANT) => {
  const { rows } = await pool.query(
    `SELECT jobber_client_id, jobber_invoice_id, configuration_id, invoice_value, job_value, resolved
       FROM category_mismatches WHERE contractor_id = $1 ORDER BY jobber_invoice_id`,
    [tenant]
  );
  return rows;
};

const resolve = (opts = {}) => resolveCategoryValue(pool, {
  contractorId: TENANT, jobberClientId: CLIENT, jobberInvoiceId: INVOICE, ...opts,
});

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of [
    'category_mismatches', 'crm_custom_field_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
    'crm_job_facts', 'crm_quote_facts', 'crm_request_facts', 'jobber_clients',
    'contractor_jobber_fields', 'contractor_settings', 'error_log',
  ]) {
    for (const tn of [TENANT, OTHER]) {
      await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [tn]).catch(async () => {
        await pool.query(`DELETE FROM ${t}`);
      });
    }
  }
  await pool.query(`DELETE FROM contractors WHERE id = ANY($1::text[])`, [[TENANT, OTHER]]);
  await seedTenant(TENANT);
});

describe('7c-2 ruling 1 — the mapped field, followed by its LINK, never by label', () => {
  it('the fixture ids really are Jobber EncodedIds — so these cases ENTER the gated paths', () => {
    // ⚠ THIS CASE EXISTS BECAUSE A SYNTHETIC ID IS HOW THE 7b DEFECT SHIPPED. If these decoded to
    // nothing, every case below would still pass while exercising a different code path from
    // production. Asserting the decode is what makes "realistic ids" checkable.
    const dec = (id) => Buffer.from(id, 'base64').toString('utf8');
    assert.equal(dec(CLIENT), 'gid://Jobber/Client/990001');
    assert.equal(dec(JOB), 'gid://Jobber/Job/770001');
    assert.equal(dec(QUOTE), 'gid://Jobber/Quote/660001');
    assert.equal(dec(INVOICE), 'gid://Jobber/Invoice/880001');
    assert.equal(dec(CFG_JOB), 'gid://Jobber/CustomFieldConfigurationDropdown/730114');
    assert.equal(dec(CFG_INV), 'gid://Jobber/CustomFieldConfigurationDropdown/730115');
    const { isDerivableJobberClientId } = require('../utils/derivableClient');
    assert.equal(isDerivableJobberClientId(CLIENT), true, 'the client id must pass the real gate');
  });

  it('reads the LINKED counterpart on the invoice first', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Out of Pocket');

    const out = await resolve();

    assert.equal(out.value, 'Out of Pocket', 'the later stage wins');
    assert.equal(out.stage, 'ALL_INVOICES');
    assert.equal(out.configurationId, CFG_INV, 'and it came from the LINKED configuration');
    assert.equal(out.reason, 'ok');
  });

  it('IGNORES a same-label field with NO link — the refusal ruling 1 is built on', async () => {
    // The decoy shares the label and the entity and has no `transfered_from`. A resolver matching by
    // label would read it; one following the link cannot see it.
    await seedConfigurations({ tenant: TENANT, linkInvoice: true });
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_DECOY, 'WRONG FIELD');

    // ⚠ THE PRECONDITION IS ASSERTED IN THE CASE, BECAUSE THIS EXACT CASE WAS VACUOUS. A mis-called
    // seeder put every configuration under contractor_id `[object Object]`, so the table was EMPTY
    // for this tenant — and the decoy was then excluded because NOTHING was acceptable rather than
    // because the link was followed. It passed identically under the label-matching injection.
    // Observing the SETUP is what was missing; these four lines make the fixture falsifiable.
    const { rows: cfgs } = await pool.query(
      `SELECT jobber_field_id, label, transfered_from FROM contractor_jobber_fields
        WHERE contractor_id = $1 ORDER BY jobber_field_id`, [TENANT]);
    assert.equal(cfgs.length, 4, 'harness: all four configurations must exist for this tenant');
    const decoy = cfgs.find(c => c.jobber_field_id === CFG_DECOY);
    const counterpart = cfgs.find(c => c.jobber_field_id === CFG_INV);
    assert.ok(decoy, 'harness: the decoy must exist, or there is nothing to ignore');
    assert.equal(decoy.transfered_from, null, 'harness: the decoy must be UNLINKED');
    assert.equal(decoy.label, LABEL, 'harness: and must share the label, or it is not a decoy');
    assert.equal(counterpart.transfered_from, CFG_JOB,
      'harness: the real counterpart must be linked, or label and link agree and prove nothing');

    const out = await resolve();

    assert.equal(out.value, 'Repair', 'the decoy must not be read');
    assert.equal(out.stage, 'ALL_JOBS');
    assert.notEqual(out.configurationId, CFG_DECOY);
  });

  it('and the acceptable set is the mapped id plus ONLY what points at it', async () => {
    await seedConfigurations();
    const { acceptable } = await resolveAcceptableConfigurations(pool, TENANT, CFG_JOB);
    assert.deepEqual([...acceptable].sort(), [CFG_INV, CFG_JOB].sort());
    assert.ok(!acceptable.has(CFG_DECOY), 'an unlinked same-label field is not acceptable');
    assert.ok(!acceptable.has(CFG_QUO), 'nor is an unrelated configuration');
  });

  it('falls through to the JOB when the invoice carries no copy at all', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Restoration');

    const out = await resolve();

    assert.equal(out.value, 'Restoration');
    assert.equal(out.stage, 'ALL_JOBS');
    assert.equal(out.configurationId, CFG_JOB);
  });

  it('falls through to the linked QUOTE when neither invoice nor job has a value', async () => {
    // The quote-level configuration is reachable only when the mapping points at it, because ruling 1
    // follows the link from the MAPPED field. Mapping to the quote field proves the third stage.
    await seedConfigurations();
    await mapByIdTo(CFG_QUO);
    await fact('ALL_QUOTES', QUOTE, CFG_QUO, 'New Construction');

    const out = await resolveCategoryValue(pool, {
      contractorId: TENANT, jobberClientId: CLIENT, jobberInvoiceId: INVOICE,
    });

    assert.equal(out.value, 'New Construction');
    assert.equal(out.stage, 'ALL_QUOTES');
  });

  it('a LEGACY label-only mapping resolves nothing rather than guessing', async () => {
    await seedConfigurations();
    await mapByLabel();
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');

    const out = await resolve();

    assert.equal(out.value, null);
    assert.equal(out.reason, 'mapping_not_by_id');
    assert.equal(await readMappedConfigurationId(pool, TENANT), null);
  });

  it('is scoped to one contractor', async () => {
    await seedTenant(OTHER);
    await seedConfigurations();
    await seedConfigurations({ tenant: OTHER });
    await mapByIdTo(CFG_JOB);
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'OTHER TENANT VALUE', { tenant: OTHER });

    const out = await resolve();

    assert.equal(out.value, null, "another tenant's facts must not be read");
    assert.equal(out.reason, 'no_category_value');
  });

  it('is scoped to the invoice being converted, not any invoice the client has', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_INVOICES', INVOICE2, CFG_INV, 'A DIFFERENT INVOICE');
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');

    const out = await resolve({ jobberInvoiceId: INVOICE });

    assert.equal(out.value, 'Repair', 'the other invoice must not decide this conversion');
    assert.equal(out.stage, 'ALL_JOBS');
  });
});

describe('7c-2 ruling 2 — the latest stage WITH A VALUE wins; blank is absent', () => {
  it('a BLANK invoice copy falls through to the job — the live shape on this tenant', async () => {
    // ⚠ NOT HYPOTHETICAL. A live Accent job carries "" on 730114 while its invoice copy has a value,
    // and invoice 60504 is the mirror: a blank INVOICE copy over a job that says "Out of Pocket".
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_INVOICES', INVOICE, CFG_INV, '');
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Out of Pocket');

    const out = await resolve();

    assert.equal(out.value, 'Out of Pocket');
    assert.equal(out.stage, 'ALL_JOBS');
  });

  it('whitespace-only is blank too, and falls through', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_INVOICES', INVOICE, CFG_INV, '   ');
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');

    const out = await resolve();

    assert.equal(out.value, 'Repair');
    assert.equal(out.stage, 'ALL_JOBS');
  });

  it('a blank at EVERY stage is no value found, not an empty string', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_INVOICES', INVOICE, CFG_INV, '');
    await fact('ALL_JOBS', JOB, CFG_JOB, '  ');

    const out = await resolve();

    assert.equal(out.value, null);
    assert.equal(out.reason, 'no_category_value');
  });

  it('a TEXT value is accepted as well as a dropdown — a text category field must still qualify', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, null, { text: 'Skylight Install' });

    const out = await resolve();

    assert.equal(out.value, 'Skylight Install');
    assert.equal(out.stage, 'ALL_JOBS');
  });

  it('valueOf prefers the dropdown and treats blank as absent, checked directly', () => {
    assert.equal(valueOf({ value_dropdown: 'A', value_text: 'B' }), 'A');
    assert.equal(valueOf({ value_dropdown: '', value_text: 'B' }), 'B');
    assert.equal(valueOf({ value_dropdown: '   ', value_text: null }), null);
    assert.equal(valueOf({ value_dropdown: null, value_text: '' }), null);
    // The stage order is latest-first, which is ruling 2 expressed as data.
    assert.deepEqual(STAGE_ORDER, ['ALL_INVOICES', 'ALL_JOBS', 'ALL_QUOTES']);
  });
});

describe('7c-2 ruling 3 — a differing invoice copy WINS and is RECORDED', () => {
  it('the invoice wins AND a mismatch row names the client, invoice and both values', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Out of Pocket');

    const out = await resolve();

    assert.equal(out.value, 'Out of Pocket', 'the invoice wins');
    assert.ok(out.mismatch, 'and the disagreement is reported to the caller');

    const rows = await mismatchRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jobber_client_id, CLIENT);
    assert.equal(rows[0].jobber_invoice_id, INVOICE);
    assert.equal(rows[0].invoice_value, 'Out of Pocket');
    assert.equal(rows[0].job_value, 'Repair');
    assert.equal(rows[0].resolved, false);
  });

  it('PAIRED NEGATIVE: values that AGREE record no mismatch at all', async () => {
    // Without this, a recorder that wrote a row on every conversion would pass the case above.
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Repair');

    const out = await resolve();

    assert.equal(out.value, 'Repair');
    assert.equal(out.mismatch, null);
    assert.deepEqual(await mismatchRows(), []);
  });

  it('and agreement is judged by the SHARED matcher, so trailing space is not a conflict', async () => {
    // Two of Accent's nineteen live options carry a trailing space, so a byte comparison here would
    // manufacture mismatches out of the contractor's own option list.
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Skylight Install ');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'skylight install');

    const out = await resolve();

    assert.equal(out.mismatch, null, 'case and trailing space are not a disagreement');
    assert.deepEqual(await mismatchRows(), []);
  });

  it('a blank job is not a conflict — there is nothing to disagree with', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, '');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Out of Pocket');

    const out = await resolve();

    assert.equal(out.value, 'Out of Pocket');
    assert.equal(out.mismatch, null);
    assert.deepEqual(await mismatchRows(), []);
  });

  it('recording is idempotent, and a RESOLVED review is not silently reopened', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Out of Pocket');

    await resolve();
    await pool.query(
      `UPDATE category_mismatches SET resolved = TRUE WHERE contractor_id = $1`, [TENANT]);
    await resolve();

    const rows = await mismatchRows();
    assert.equal(rows.length, 1, 'a retry must not produce a second review item');
    assert.equal(rows[0].resolved, true, 'and must not reopen one an admin has already handled');
  });

  it('recordMismatch:false resolves without writing a review row', async () => {
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await fact('ALL_JOBS', JOB, CFG_JOB, 'Repair');
    await fact('ALL_INVOICES', INVOICE, CFG_INV, 'Out of Pocket');

    const out = await resolve({ recordMismatch: false });

    assert.equal(out.value, 'Out of Pocket');
    assert.ok(out.mismatch, 'the caller is still told');
    assert.deepEqual(await mismatchRows(), [], 'but nothing is persisted');
  });
});

describe('7c-2 — capturing the custom-field facts', () => {
  const node = (id, fields) => ({ id, client: { id: CLIENT }, customFields: fields });

  it('stores entity, entity id, configuration id, label and BOTH value shapes', async () => {
    const written = await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', [
      node(JOB, [
        { __typename: 'CustomFieldDropdown', label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: { id: CFG_JOB } },
        { __typename: 'CustomFieldText', label: 'Notes', valueText: 'hello', customFieldConfiguration: { id: CFG_DECOY } },
      ]),
    ]);
    assert.equal(written, 2);

    const { rows } = await pool.query(
      `SELECT entity, entity_jobber_id, jobber_client_id, configuration_id, label, value_dropdown, value_text
         FROM crm_custom_field_facts WHERE contractor_id = $1 ORDER BY configuration_id`, [TENANT]);
    const dropdown = rows.find(r => r.configuration_id === CFG_JOB);
    assert.equal(dropdown.entity, 'ALL_JOBS');
    assert.equal(dropdown.entity_jobber_id, JOB);
    assert.equal(dropdown.jobber_client_id, CLIENT);
    assert.equal(dropdown.label, LABEL);
    assert.equal(dropdown.value_dropdown, 'Repair');
    assert.equal(dropdown.value_text, null);
    const text = rows.find(r => r.configuration_id === CFG_DECOY);
    assert.equal(text.value_text, 'hello');
    assert.equal(text.value_dropdown, null);
  });

  it('a BLANK value survives as an empty string rather than becoming NULL', async () => {
    // ⚠ THE DISTINCTION IS RULING 2's AND IT BELONGS TO THE RESOLVER. Collapsing '' to NULL here
    // would make "the contractor cleared this field" and "this field has no value column" the same
    // row — and the live tenant really does carry a blank Job Type on a job.
    await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', [
      node(JOB, [{ __typename: 'CustomFieldDropdown', label: LABEL, valueDropdown: '', customFieldConfiguration: { id: CFG_JOB } }]),
    ]);
    const { rows } = await pool.query(
      `SELECT value_dropdown FROM crm_custom_field_facts WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows[0].value_dropdown, '', 'stored as empty string');
    assert.notEqual(rows[0].value_dropdown, null);
  });

  it('SKIPS a field with no configuration id rather than storing it under its label', async () => {
    const written = await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', [
      node(JOB, [
        { __typename: 'CustomFieldDropdown', label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: null },
        { __typename: 'CustomFieldDropdown', label: LABEL, valueDropdown: 'Repair' },
      ]),
    ]);
    assert.equal(written, 0, 'a row that cannot be attributed is worse than an absent one');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM crm_custom_field_facts WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows[0].n, 0);
  });

  it('SKIPS a record with no client, because the resolver reads per client', async () => {
    const written = await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', [
      { id: JOB, customFields: [{ label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: { id: CFG_JOB } }] },
    ]);
    assert.equal(written, 0, 'an unreachable fact is not a fact');
  });

  it('is idempotent and re-capture UPDATES the value in place', async () => {
    const one = [node(JOB, [{ label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: { id: CFG_JOB } }])];
    await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', one);
    const two = [node(JOB, [{ label: LABEL, valueDropdown: 'Restoration', customFieldConfiguration: { id: CFG_JOB } }])];
    await writeCustomFieldFacts(pool, TENANT, 'ALL_JOBS', two);

    const { rows } = await pool.query(
      `SELECT configuration_id, value_dropdown FROM crm_custom_field_facts WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows.length, 1, 'one row per (record, configuration)');
    assert.equal(rows[0].value_dropdown, 'Restoration', 'and the later capture wins');
  });

  it('captureClientFacts captures all THREE stages in one pass', async () => {
    const client = {
      id: CLIENT,
      quotes: { nodes: [{ id: QUOTE, quoteStatus: 'approved', client: { id: CLIENT }, createdAt: new Date().toISOString(), lastTransitioned: { approvedAt: new Date().toISOString() }, salesperson: null, customFields: [{ label: LABEL, valueDropdown: 'New Construction', customFieldConfiguration: { id: CFG_QUO } }] }] },
      jobs: { nodes: [{ id: JOB, jobStatus: 'active', client: { id: CLIENT }, createdAt: new Date().toISOString(), customFields: [{ label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: { id: CFG_JOB } }] }] },
      requests: { nodes: [] },
      invoices: { nodes: [{ id: INVOICE, invoiceStatus: 'paid', client: { id: CLIENT }, amounts: { total: 100, invoiceBalance: 0 }, receivedDate: new Date().toISOString(), jobs: { nodes: [{ id: JOB }], pageInfo: { hasNextPage: false } }, archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } }, customFields: [{ label: LABEL, valueDropdown: 'Out of Pocket', customFieldConfiguration: { id: CFG_INV } }] }] },
    };

    const out = await captureClientFacts(pool, { contractorId: TENANT, client });

    assert.equal(out.customFields, 3, 'one per stage');
    const { rows } = await pool.query(
      `SELECT entity, value_dropdown FROM crm_custom_field_facts WHERE contractor_id = $1 ORDER BY entity`, [TENANT]);
    assert.deepEqual(rows.map(r => r.entity), ['ALL_INVOICES', 'ALL_JOBS', 'ALL_QUOTES']);
  });

  it('END TO END: a captured client resolves its category through the real resolver', async () => {
    // ⚠ THE BOUNDARY CASE. Every other resolver case seeds fact rows directly, which cannot discover
    // that the capture never supplies them — the shape this repo records as "a test that injects the
    // value itself cannot discover that nothing upstream supplies it".
    await seedConfigurations();
    await mapByIdTo(CFG_JOB);
    await captureClientFacts(pool, {
      contractorId: TENANT,
      client: {
        id: CLIENT,
        quotes: { nodes: [] },
        requests: { nodes: [] },
        jobs: { nodes: [{ id: JOB, jobStatus: 'active', client: { id: CLIENT }, createdAt: new Date().toISOString(), customFields: [{ label: LABEL, valueDropdown: 'Repair', customFieldConfiguration: { id: CFG_JOB } }] }] },
        invoices: { nodes: [{ id: INVOICE, invoiceStatus: 'paid', client: { id: CLIENT }, amounts: { total: 100, invoiceBalance: 0 }, receivedDate: new Date().toISOString(), jobs: { nodes: [{ id: JOB }], pageInfo: { hasNextPage: false } }, archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } }, customFields: [{ label: LABEL, valueDropdown: 'Out of Pocket', customFieldConfiguration: { id: CFG_INV } }] }] },
      },
    });

    const out = await resolve();
    assert.equal(out.value, 'Out of Pocket');
    assert.equal(out.stage, 'ALL_INVOICES');
    assert.equal(out.configurationId, CFG_INV);
  });
});

describe('7c-2 — the fences on the selection and the link', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

  // ⚠ COMMENTS ARE STRIPPED, LINE-PRESERVINGLY, AND THAT IS NOT A PRECAUTION — IT IS A REPAIR. The
  // first writing of the fence below matched `customFieldConfiguration { id }` against the WHOLE
  // file, and this module carries a COMMENT containing that exact phrase to explain why the record
  // -level selection takes no fragments. So when guard-proof (vi) removed the real selection, the
  // comment kept the fence green: width 0. That is "scans read comments" with the sign flipped —
  // prose SATISFYING a required pattern rather than matching a forbidden one, the same shape as the
  // lock-door fence that was satisfied by the word "doors" in a comment.
  const stripComments = (src) => src
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
    })
    .join('\n');

  it('the capture selects the CONFIGURATION ID on every stage — reads-vs-selects', () => {
    // ⚠ THE WRITER'S READS ARE THE AUTHORITY. `writeCustomFieldFacts` keys on
    // `field.customFieldConfiguration.id`; a selection that omitted it would store nothing and
    // report success, which is this arc's most-repeated defect.
    const fetchSrc = stripComments(read('utils', 'jobberClientFetch.js'));
    const writerSrc = stripComments(read('utils', 'factCapture.js'));

    assert.match(writerSrc, /customFieldConfiguration\?\.id/,
      'harness: the writer must still read the configuration id, or this fence checks nothing');
    assert.match(fetchSrc, /customFieldConfiguration \{ id \}/,
      'the selection must carry the configuration id');
    // ⚠ AND THE FLOOR PROVES THE STRIP IS WHAT MAKES THIS REAL: the phrase appears in a comment in
    // that file, so an unstripped read would pass even with the selection gone.
    assert.ok(read('utils', 'jobberClientFetch.js').split('customFieldConfiguration { id }').length - 1 >= 2,
      'harness: the comment copy must still exist, or this floor no longer proves the strip matters');
    assert.equal(fetchSrc.split('customFieldConfiguration { id }').length - 1, 1,
      'after stripping, exactly the CODE occurrence remains');

    // All three stages must carry the selection, checked per constant rather than against the whole
    // query — a whole-query check passes when the field appears somewhere else in it.
    for (const constant of ['QUOTE_FIELDS', 'JOB_FIELDS', 'INVOICE_FIELDS']) {
      const at = fetchSrc.indexOf(`const ${constant} =`);
      assert.ok(at > -1, `harness: ${constant} must exist`);
      const body = fetchSrc.slice(at, fetchSrc.indexOf('`;', at));
      assert.match(body, /CUSTOM_FIELDS/, `${constant} must include the custom-field selection`);
    }
  });

  it('the record-level configuration is selected WITHOUT fragments, and the link WITH them', () => {
    // ⚠ TWO SELECTIONS THAT LOOK ALIKE AND HAVE OPPOSITE REQUIREMENTS, both verified live:
    // `customFieldConfiguration` on a RECORD is the concrete matching type (fragments there are
    // rejected, 30 errors), while `transferedFrom` on a CONFIGURATION is a UNION (a bare `{ id }` is
    // rejected). Getting either backwards fails the whole query, so both are pinned.
    const fetchSrc = read('utils', 'jobberClientFetch.js');
    assert.doesNotMatch(fetchSrc, /customFieldConfiguration \{ \.\.\. on/,
      'a record-level configuration must NOT take inline fragments');

    const discoverySrc = read('crm', 'jobber.js');
    assert.match(discoverySrc, /transferedFrom \{ \$\{LINK_MEMBERS\}/,
      'the configuration-level link MUST take inline fragments');
    assert.match(discoverySrc, /CustomFieldConfiguration\$\{t\} \{ id \}/,
      'and they select only the id');
  });

  it('discovery stores the link on BOTH the insert and the conflict branch', () => {
    // A value written only on INSERT would be present for a brand-new contractor and permanently
    // NULL for Accent, because discovery re-runs on every admin click. That is the convergence
    // failure `waiting_for_financed_payment` needed its own guard-proof for.
    const src = read('crm', 'jobber.js');
    const at = src.indexOf('INSERT INTO contractor_jobber_fields');
    assert.ok(at > -1, 'harness: the discovery upsert must be found');
    const stmt = src.slice(at, src.indexOf('`', src.indexOf('DO UPDATE SET', at)));
    assert.match(stmt, /transfered_from/, 'the column is written');
    assert.match(stmt.slice(stmt.indexOf('DO UPDATE SET')), /transfered_from = \$9/,
      'and carried on the conflict branch');
  });

  it('the resolver never matches on a LABEL — ruling 1 as a source fence', () => {
    // A label comparison is exactly what ruling 1 forbids, and it is the change someone would make
    // to "fix" a contractor whose link is missing. The fence names the rule rather than the symptom.
    // The same line-preserving strip as above, so a finding's line number stays true and a comment
    // cannot satisfy — or trip — the needle.
    const code = stripComments(read('utils', 'categorySource.js'));
    assert.doesNotMatch(code, /\blabel\b\s*(===|==|\.toLowerCase)/,
      'the resolver must not compare labels');
    assert.match(code, /configuration_id = ANY/, 'it selects by configuration id');
    // Non-vacuity: the needle CAN match a synthetic label comparison.
    assert.match('if (row.label === x) {', /\blabel\b\s*(===|==|\.toLowerCase)/);
  });

  it('CURRENT STATE: the resolver has no production caller yet, and that is 7d', () => {
    // ⚠ LABELLED AS THE STATE OF THINGS RATHER THAN FENCED, so wiring it in 7d means updating a
    // clearly-named case instead of arguing with a guard that forbade the feature. `evaluateReferral`
    // still reads the category off the live invoice object; moving the MONEY path onto saved facts is
    // 7d's subject, and doing it inside this capture commit would mix a schema change with a payout
    // change in one unreviewable diff.
    const rules = read('referralRules.js');
    assert.doesNotMatch(rules, /categorySource|resolveCategoryValue/,
      'when this fails, 7d has landed — update this case, do not delete it');
    assert.match(rules, /customFields/, 'it still reads the live object today');
  });
});
