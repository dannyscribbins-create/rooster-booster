'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-1 — A CUSTOM FIELD IS IDENTIFIED BY ENTITY + CRM ID, NEVER BY ITS LABEL
//
// ⚠ THE NUMBERS BELOW ARE MEASURED AGAINST THE LIVE JOBBER API AT THE PINNED 2026-05-12, ON
// 2026-09-30, AND THEY ARE THE WHOLE ARGUMENT. `accent-roofing-dev` has **27** custom field
// configurations and **THREE** are named "Job Type":
//   · Dropdown/730114   appliesTo ALL_JOBS      transferable:true   19 options
//   · Dropdown/730115   appliesTo ALL_INVOICES  transferable:false  19 options (identical list)
//   · Dropdown/1573072  appliesTo ALL_QUOTES    transferable:false   7 options (different list)
// "Insurance Company" appears FOUR times, "OTHER" three, "Material Type"/"Source"/"Sales
// Representative" twice each. Discovery used to de-duplicate by name and keep the first, discarding
// 10 of 27 and letting Jobber's response order decide which field the payout engine is configured
// against. **It kept the right one by luck.**
//
// ⚠ AND THE COLLISION HAD ALREADY DONE DAMAGE: Accent's flagship escalating schedule was keyed on
// `New Construction` — an option of the QUOTE field — while the engine reads the JOB field, so it
// could never fire.
//
// ⚠ WHAT 7c-1 DOES AND DOES NOT ACHIEVE, STATED SO NOBODY OVERREADS IT. It makes the
// CONFIGURATION unambiguous, and therefore the option list and the entity. Matching a VALUE on a
// record is still by label, because the capture queries select `{ label, valueDropdown }` and not
// the configuration id. ⚠ **That id IS selectable — `customFieldConfiguration { id name appliesTo }`
// on a record's custom field, verified against the live schema, and a live Accent job reports
// `730114 / ALL_JOBS` through it.** Selecting it is 7c-2's job, not this commit's.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { seedContractor } = require('./helpers');
const {
  MAPPING_KEYS, ENTITIES, ENTITY_LABELS,
  parseMappingEntry, readFieldMappings, resolveMappedField, describeField,
} = require('../utils/fieldMapping');

const CID = 'fm-entity-tenant';
const ROOT_DIR = path.join(__dirname, '..', '..');

// Accent's three real "Job Type" configurations, ids and all.
const JOB_FIELD = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzczMDExNA==';
const INVOICE_FIELD = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzczMDExNQ==';
const QUOTE_FIELD = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzE1NzMwNzI=';

// ⚠ THE JOB AND QUOTE OPTION LISTS MUST DIFFER, or no assertion here can tell which field was
// resolved. These are the real lists, trailing spaces included.
const JOB_OPTIONS = ['Out of Pocket', 'Insurance', 'Finance', 'Skylight Install ', 'Repair'];
const QUOTE_OPTIONS = ['Full Roof Replacement', 'Repair', 'New Construction', 'Restoration'];

let pool;

// ⚠ ONE POOL PER FILE. initTestDb() returns the server/db.js pool SINGLETON, so a per-describe
// pool.end() ends the pool the next describe needs — which surfaces as CANCELLED, not failed.
before(async () => { pool = await initTestDb(); await seedContractor(pool, CID); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  await pool.query('DELETE FROM contractor_jobber_fields WHERE contractor_id = $1', [CID]);
  await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [CID]);
});

async function seedField(id, label, { entity, options = null, transferable = null, archived = null } = {}) {
  await pool.query(
    `INSERT INTO contractor_jobber_fields
       (contractor_id, jobber_field_id, label, field_type, options, entity, transferable, archived)
     VALUES ($1, $2, $3, 'dropdown', $4::jsonb, $5, $6, $7)`,
    [CID, id, label, options ? JSON.stringify(options) : null, entity, transferable, archived]
  );
}

async function setMapping(value) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
    [CID, JSON.stringify({ work_category: value })]
  );
}

describe('7c-1 — the entity is stored, and it is the enum Jobber actually reports', () => {
  it('the entity column exists and accepts every CustomFieldAppliesTo value', async () => {
    // ⚠ READ FROM THE LIVE SCHEMA, NOT INVENTED. Seven values, and the list is asserted whole so a
    // future reader cannot quietly add an eighth that nothing handles.
    assert.deepEqual(ENTITIES, ['ALL_PROPERTIES', 'ALL_CLIENTS', 'ALL_QUOTES', 'ALL_JOBS',
      'ALL_INVOICES', 'ALL_PRODUCTS_AND_SERVICES', 'TEAM']);
    // ⚠ AND THERE IS NO REQUEST ENTITY. A custom field cannot be attached to a request, so nothing
    // downstream may offer one — worth pinning, because "quote, job, invoice, client, request" is
    // the natural guess and it is wrong.
    assert.ok(!ENTITIES.some(e => /REQUEST/i.test(e)), 'Jobber exposes no request entity');
    for (const e of ENTITIES) {
      await seedField(`gid-${e}`, `F ${e}`, { entity: e });
    }
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS n FROM contractor_jobber_fields WHERE contractor_id = $1 AND entity IS NOT NULL', [CID]);
    assert.equal(Number(rows[0].n), ENTITIES.length);
  });

  it('three same-label fields coexist, which the old dedupe made impossible', async () => {
    await seedField(JOB_FIELD, 'Job Type', { entity: 'ALL_JOBS', options: JOB_OPTIONS, transferable: true });
    await seedField(INVOICE_FIELD, 'Job Type', { entity: 'ALL_INVOICES', options: JOB_OPTIONS });
    await seedField(QUOTE_FIELD, 'Job Type', { entity: 'ALL_QUOTES', options: QUOTE_OPTIONS });
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS n FROM contractor_jobber_fields WHERE contractor_id = $1 AND label = 'Job Type'`, [CID]);
    assert.equal(Number(rows[0].n), 3, 'all three must be stored — uniqueness is on the id, not the label');
  });
});

describe('7c-1 — the mapping resolves by entity + CRM id', () => {
  beforeEach(async () => {
    await seedField(JOB_FIELD, 'Job Type', { entity: 'ALL_JOBS', options: JOB_OPTIONS, transferable: true });
    await seedField(INVOICE_FIELD, 'Job Type', { entity: 'ALL_INVOICES', options: JOB_OPTIONS });
    await seedField(QUOTE_FIELD, 'Job Type', { entity: 'ALL_QUOTES', options: QUOTE_OPTIONS });
  });

  it('⚠ THE CENTRAL CASE: an id mapping reaches the JOB field, not one of its namesakes', async () => {
    await setMapping({ field_id: JOB_FIELD, entity: 'ALL_JOBS', label: 'Job Type' });
    const m = await readFieldMappings(pool, CID);
    assert.equal(m.work_category.legacy, false);
    const f = await resolveMappedField(pool, CID, m.work_category);
    assert.equal(f.jobber_field_id, JOB_FIELD);
    assert.equal(f.entity, 'ALL_JOBS');
    // ⚠ THE OPTION LIST IS THE DISCRIMINATOR. The job and invoice fields share a list, so only the
    // QUOTE list proves the wrong field was not returned.
    assert.deepEqual(f.options, JOB_OPTIONS);
    assert.ok(!f.options.includes('New Construction'), 'the quote vocabulary must not appear');
  });

  it('⚠ PAIRED: pointing the SAME label at the QUOTE field yields the quote options', async () => {
    // Without this, the case above would pass against a resolver that always returned the first row.
    await setMapping({ field_id: QUOTE_FIELD, entity: 'ALL_QUOTES', label: 'Job Type' });
    const m = await readFieldMappings(pool, CID);
    const f = await resolveMappedField(pool, CID, m.work_category);
    assert.equal(f.jobber_field_id, QUOTE_FIELD);
    assert.deepEqual(f.options, QUOTE_OPTIONS);
  });

  it('transferable is carried through, because the payout order depends on it', async () => {
    await setMapping({ field_id: JOB_FIELD, entity: 'ALL_JOBS', label: 'Job Type' });
    const f = await resolveMappedField(pool, CID, (await readFieldMappings(pool, CID)).work_category);
    assert.equal(f.transferable, true, "Accent's job Job Type is transferable — R-7c-3 leans on it");
  });

  it('an id naming no discovered field resolves to null, never to a namesake', async () => {
    // ⚠ THE TEMPTING WRONG BEHAVIOUR IS A LABEL FALLBACK HERE. It would "helpfully" resolve a stale
    // id to a same-named field and re-introduce the coin-flip under a new name.
    await setMapping({ field_id: 'gid://Jobber/Nope/1', entity: 'ALL_JOBS', label: 'Job Type' });
    const f = await resolveMappedField(pool, CID, (await readFieldMappings(pool, CID)).work_category);
    assert.equal(f, null);
  });
});

describe('7c-1 — the legacy label form still works, and says that it is legacy', () => {
  it('a bare-string mapping resolves by label and is flagged legacy', async () => {
    // ⚠ NOT MIGRATED WHOLESALE, DELIBERATELY. Resolving a bare label to one of several same-named
    // configurations is the ambiguity 7c-1 removes; guessing at it in a boot migration would bake
    // the coin-flip in rather than end it. An unmigrated contractor keeps its behaviour.
    await seedField('gid-solo', 'Work Type', { entity: 'ALL_JOBS', options: JOB_OPTIONS });
    await setMapping('Work Type');
    const m = await readFieldMappings(pool, CID);
    assert.equal(m.work_category.legacy, true, 'the caller must be able to say the mapping is ambiguous');
    assert.equal(m.work_category.label, 'Work Type');
    const f = await resolveMappedField(pool, CID, m.work_category);
    assert.equal(f.jobber_field_id, 'gid-solo');
  });

  it('a legacy label prefers a LIVE field over an archived namesake', async () => {
    // ⚠ DETERMINISTIC RATHER THAN CORRECT, AND THE COMMENT SAYS SO. With two same-named fields a
    // label cannot say which was meant; preferring the unarchived one is the best available guess
    // and it beats planner order, which is what `LIMIT 1` with no ORDER BY gave.
    await seedField('gid-dead', 'Job Type', { entity: 'ALL_JOBS', options: QUOTE_OPTIONS, archived: true });
    await seedField('gid-live', 'Job Type', { entity: 'ALL_JOBS', options: JOB_OPTIONS, archived: false });
    await setMapping('Job Type');
    const f = await resolveMappedField(pool, CID, (await readFieldMappings(pool, CID)).work_category);
    assert.equal(f.jobber_field_id, 'gid-live');
  });

  it('an object with no field_id is treated as legacy rather than as configured', async () => {
    // A half-written mapping must keep resolving something; resolving nothing here means a
    // contractor silently stops earning.
    await seedField('gid-solo', 'Job Type', { entity: 'ALL_JOBS', options: JOB_OPTIONS });
    await setMapping({ entity: 'ALL_JOBS', label: 'Job Type' });
    const m = await readFieldMappings(pool, CID);
    assert.equal(m.work_category.legacy, true);
    assert.equal((await resolveMappedField(pool, CID, m.work_category)).jobber_field_id, 'gid-solo');
  });

  it('nothing configured resolves to null across every mapping key', async () => {
    const m = await readFieldMappings(pool, CID);
    for (const k of MAPPING_KEYS) assert.equal(m[k], null, `${k} must be null`);
  });
});

describe('7c-1 — the admin screen can tell two same-named fields apart', () => {
  it('describeField names the entity in words', () => {
    assert.equal(describeField({ label: 'Job Type', entity: 'ALL_JOBS' }), 'Job Type (Job)');
    assert.equal(describeField({ label: 'Job Type', entity: 'ALL_INVOICES' }), 'Job Type (Invoice)');
    assert.equal(describeField({ label: 'Job Type', entity: 'ALL_QUOTES' }), 'Job Type (Quote)');
    // ⚠ EVERY ENUM VALUE HAS WORDING, or a field on an unworded entity renders as a bare label and
    // becomes indistinguishable again — which is the defect, returning quietly.
    for (const e of ENTITIES) {
      assert.ok(ENTITY_LABELS[e], `${e} has no human wording`);
    }
  });

  it('an unknown or absent entity degrades to the bare label rather than inventing one', () => {
    assert.equal(describeField({ label: 'Job Type', entity: null }), 'Job Type');
    assert.equal(describeField({ label: 'Job Type', entity: 'SOMETHING_NEW' }), 'Job Type');
    assert.equal(describeField(null), null);
  });

  it('an archived field says so, because the mapping screen listed dead fields as live', () => {
    // Eleven of Accent's 27 configurations are archived in Jobber.
    assert.equal(describeField({ label: 'Lead Status', entity: 'ALL_CLIENTS', archived: true }),
      'Lead Status (Client) — archived in Jobber');
  });
});

describe('7c-1 — source fences: no consumer reads a mapping value as a bare string', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  /** Comments stripped, line positions preserved, so a finding names the right line. */
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  }

  // ⚠ THIS FENCE EXISTS BECAUSE THE MIGRATION CREATES A NEW STATE AND ACTIVATES EVERY READER THAT
  // ASSUMED THE OLD ONE. An object-valued mapping read as a string breaks four consumers at once,
  // and two of them fail SILENTLY: deriveAndSaveTags throws a TypeError it catches itself (every
  // tag for every client stops), and evaluateReferral finds no field and returns
  // no_job_type_found for every referral. Neither raises anything a person would see.
  const CONSUMERS = [
    'server/referralRules.js',
    'server/utils/deriveJobberTags.js',
    'server/routes/admin/campaigns.js',
  ];

  it('every consumer routes mapping values through the shared parser', () => {
    for (const rel of CONSUMERS) {
      const src = stripComments(read(rel));
      assert.match(src, /parseMappingEntry\(/, `${rel} must parse mapping values`);
    }
  });

  it('no consumer uses a raw mapping value where a label is expected', () => {
    // ⚠ NEEDLES ASSEMBLED FROM PIECES so this assertion is not itself the pattern it forbids.
    const raw = ['work_category', 'job_source', 'material_type', 'assigned_rep'];
    const findings = [];
    for (const rel of CONSUMERS) {
      const lines = stripComments(read(rel)).split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const key of raw) {
          // a read of `mappings.<key>` or `contractorFieldMappings.<key>` NOT wrapped in the parser
          const bad = new RegExp('(?:mappings|contractorFieldMappings)\\.' + key + '\\b');
          if (!bad.test(line)) continue;
          if (/parseMappingEntry\s*\(/.test(line)) continue;
          // a bare truthiness check is safe for both shapes; anything else is not
          if (/^\s*(?:if|\}\s*else if)\s*\(/.test(line) && !/===|!==|\.toLowerCase|label/.test(line)) continue;
          findings.push(`${rel}:${i + 1} — ${line.trim().slice(0, 100)}`);
        }
      });
    }
    assert.deepEqual(findings, [], 'a raw mapping value used as a label:\n' + findings.join('\n'));
  });

  it('⚠ HARNESS FLOOR: the needle really does catch the shape it forbids', () => {
    // Without this, a needle matching nothing passes identically to a clean codebase.
    const synthetic = '      const label = mappings.work_category;';
    const bad = /(?:mappings|contractorFieldMappings)\.work_category\b/;
    assert.ok(bad.test(synthetic), 'the needle must match the pre-7c-1 form');
    assert.ok(!bad.test('const label = parseMappingEntry(mappings2.other)?.label;'),
      'and must not match an unrelated identifier');
  });

  it('discovery no longer de-duplicates configurations by name', () => {
    const src = stripComments(read('server/crm/jobber.js'));
    assert.ok(!/seen\.has\(node\.name\)/.test(src),
      'the de-duplication that discarded 10 of Accent\'s 27 configurations must be gone');
    assert.match(src, /appliesTo/, 'the entity must be selected');
    assert.match(src, /transferable/, 'and transferable, which the payout order depends on');
    assert.match(src, /pageInfo/, 'and the query must page — it did not before');
    assert.match(src, /CustomFieldConfigurationArea/,
      'Area was in TYPE_MAP with no fragment, so those configurations arrived nameless and were dropped');
  });

  it('the PATCH mapping route refuses a bare label', () => {
    const src = stripComments(read('server/routes/admin/index.js'));
    assert.match(src, /field_id/, 'the route must take an id');
    assert.match(src, /a bare label is no longer accepted/,
      'and must say so, rather than silently storing an ambiguous mapping');
  });

  it('the admin mapping screen keys its selections on the CRM id, not the label', () => {
    const src = read('src/components/admin/CRMSettings.jsx');
    assert.match(src, /cfmSelections\[field\.jobber_field_id\]/,
      'three same-named rows shared one slot while this was keyed on the label');
    assert.ok(!/cfmSelections\[field\.label\]/.test(src), 'the label-keyed form must be gone');
    assert.match(src, /display_label/, 'and each row must show its entity');
  });
});

describe("7c-1 — Accent's mapping is migrated to the measured JOB field, and only that", () => {
  // ⚠ THE MIGRATION IS EXERCISED BY RUNNING initDB AGAIN, NOT BY RE-WRITING ITS SQL HERE. A test
  // that pastes the production UPDATE can only agree with it; this repo has that recorded as the
  // twin-formula trap, and one of its own fences caught a third copy of a query being pasted into
  // the test that guarded against a second. initDB is idempotent by construction, which is what
  // makes calling it twice a legitimate way to observe it.
  const { initDB } = require('../db');
  const ACCENT = 'accent-roofing-dev';
  const JOB_ID = 'Z2lkOi8vSm9iYmVyL0N1c3RvbUZpZWxkQ29uZmlndXJhdGlvbkRyb3Bkb3duLzczMDExNA==';

  async function accentMapping() {
    const { rows } = await pool.query(
      'SELECT contractor_field_mappings AS m FROM contractor_settings WHERE contractor_id = $1', [ACCENT]);
    return rows[0]?.m || null;
  }
  async function setAccent(value) {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
      [ACCENT, JSON.stringify(value)]
    );
  }

  before(async () => { await seedContractor(pool, ACCENT); });

  it("⚠ the legacy string 'Job Type' becomes the ALL_JOBS field 730114", async () => {
    // 730114 is not a guess: `appliesTo` from the live API says ALL_JOBS, and a live Accent job
    // reports that same id through `customFieldConfiguration { id }` on its own custom field.
    await setAccent({ work_category: 'Job Type', job_source: 'Source' });
    await initDB();
    const m = await accentMapping();
    assert.equal(typeof m.work_category, 'object', 'it must become the object form');
    assert.equal(m.work_category.field_id, JOB_ID);
    assert.equal(m.work_category.entity, 'ALL_JOBS');
    // ⚠ AND THE OTHER KEYS ARE LEFT ALONE. jsonb_set touches one path; a whole-object replace would
    // silently drop every mapping the contractor had configured besides this one.
    assert.equal(m.job_source, 'Source', 'the other mappings must survive untouched');
  });

  it('⚠ IDEMPOTENT — a second run does not re-migrate or disturb it', async () => {
    await setAccent({ work_category: 'Job Type' });
    await initDB();
    const first = await accentMapping();
    await initDB();
    assert.deepEqual(await accentMapping(), first, 'a re-run must be a no-op');
  });

  it('⚠ a DELIBERATE later choice is never overwritten', async () => {
    // The migration is conditional on the value still being the legacy STRING form. Without that
    // condition, every boot would stamp Accent back onto 730114 and an admin could never re-pick.
    const chosen = { field_id: 'gid-admin-picked', entity: 'ALL_QUOTES', label: 'Job Type' };
    await setAccent({ work_category: chosen });
    await initDB();
    assert.deepEqual((await accentMapping()).work_category, chosen);
  });

  it('a DIFFERENT legacy label is not migrated — the condition names the value too', async () => {
    // ⚠ THE PAIRED NEGATIVE. Without it, a migration that converted ANY string would pass the case
    // above and would also convert a contractor whose field is genuinely called something else,
    // pointing them at Accent's field id.
    await setAccent({ work_category: 'Work Type' });
    await initDB();
    assert.equal((await accentMapping()).work_category, 'Work Type');
  });

  it('the migration names the measured id and entity in source', () => {
    // ⚠ A SOURCE FENCE BESIDE THE BEHAVIOURAL ONES, because the behavioural cases would still pass
    // if the id were changed to another ALL_JOBS field — they assert the id they were written with.
    // This pins that the id in db.js is the one that was measured.
    const src = fs.readFileSync(path.join(ROOT_DIR, 'server', 'db.js'), 'utf8');
    assert.ok(src.includes(JOB_ID), 'db.js must migrate to the measured 730114 id');
    assert.match(src, /ALL_JOBS/, 'and record its entity');
  });
});

describe('7c-1 — ⚠ PAIRED POSITIVE: a contractor with unique labels behaves exactly as before', () => {
  // ⚠ THIS IS THE CASE THAT STOPS 7c-1 BEING A REGRESSION DRESSED AS A FIX. Every other case here
  // is about collisions; the overwhelming majority of contractors have none, and for them nothing
  // may change. Without this, a resolver that only ever worked for the object form would pass the
  // whole file and break every unmigrated tenant.
  const SOLO = 'fm-solo-tenant';

  before(async () => { await seedContractor(pool, SOLO); });

  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_jobber_fields WHERE contractor_id = $1', [SOLO]);
    await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [SOLO]);
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, options, entity)
       VALUES ($1, 'gid-unique-1', 'Work Category', 'dropdown', $2::jsonb, 'ALL_JOBS')`,
      [SOLO, JSON.stringify(['Roof', 'Gutter'])]
    );
  });

  it('a legacy label mapping resolves to the same single field it always did', async () => {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb) ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
      [SOLO, JSON.stringify({ work_category: 'Work Category' })]
    );
    const m = await readFieldMappings(pool, SOLO);
    const f = await resolveMappedField(pool, SOLO, m.work_category);
    assert.equal(f.jobber_field_id, 'gid-unique-1');
    assert.deepEqual(f.options, ['Roof', 'Gutter']);
    assert.equal(m.work_category.legacy, true, 'flagged legacy, but still resolved');
  });

  it('and the id form resolves to the identical row, so migrating changes nothing for them', async () => {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb) ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
      [SOLO, JSON.stringify({ work_category: { field_id: 'gid-unique-1', entity: 'ALL_JOBS', label: 'Work Category' } })]
    );
    const m = await readFieldMappings(pool, SOLO);
    const f = await resolveMappedField(pool, SOLO, m.work_category);
    assert.equal(f.jobber_field_id, 'gid-unique-1');
    assert.deepEqual(f.options, ['Roof', 'Gutter']);
    assert.equal(m.work_category.legacy, false);
  });
});

describe('7c-1 — discovery itself keeps every configuration (driven, not seeded)', () => {
  // ⚠ THIS DESCRIBE EXISTS BECAUSE A GUARD-PROOF REFUSED TO GO RED, AND THAT IS THE ENTRY WORTH
  // KEEPING. Restoring discovery's de-duplication-by-label failed only a SOURCE fence: every other
  // case in this file seeds `contractor_jobber_fields` rows directly, so none of them could observe
  // what discovery does to a RESPONSE. **A test that injects the stored rows cannot discover that
  // discovery discarded them** — the same shape as a test injecting a value it claims something
  // upstream supplies. These cases drive the real function through a stubbed transport.
  const { discoverJobberFields, _setJobberHttpForTest, _resetJobberHttp } = require('../crm/jobber');
  const DISCO = 'fm-discovery-tenant';

  /** A Jobber response carrying the given configuration nodes, one page. */
  function page(nodes, hasNextPage = false, endCursor = null) {
    return { data: { data: { customFieldConfigurations: { nodes, pageInfo: { hasNextPage, endCursor } } } } };
  }
  const dropdown = (id, name, appliesTo, opts, extra = {}) => ({
    __typename: 'CustomFieldConfigurationDropdown',
    id, name, appliesTo, dropdownOptions: opts, transferable: false, archived: false, ...extra,
  });

  before(async () => {
    await seedContractor(pool, DISCO);
    // A token must exist or discoverJobberFields throws before it ever calls the transport.
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'tok-discovery', 'refresh', NOW() + INTERVAL '1 hour')
       ON CONFLICT (contractor_id) DO UPDATE SET access_token = 'tok-discovery',
         expires_at = NOW() + INTERVAL '1 hour'`,
      [DISCO]
    );
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_jobber_fields WHERE contractor_id = $1', [DISCO]);
    _resetJobberHttp();
  });

  after(async () => {
    _resetJobberHttp();
    await pool.query('DELETE FROM tokens WHERE contractor_id = $1', [DISCO]);
  });

  it('⚠ THE CENTRAL CASE: three same-label configurations all survive discovery', async () => {
    // Accent's real shape. The old filter kept ONE of these and discarded two.
    _setJobberHttpForTest({
      axiosPost: async () => page([
        dropdown(JOB_FIELD, 'Job Type', 'ALL_JOBS', JOB_OPTIONS, { transferable: true }),
        dropdown(INVOICE_FIELD, 'Job Type', 'ALL_INVOICES', JOB_OPTIONS),
        dropdown(QUOTE_FIELD, 'Job Type', 'ALL_QUOTES', QUOTE_OPTIONS),
      ]),
    });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    const jt = rows.filter(r => r.label === 'Job Type');
    assert.equal(jt.length, 3, 'all three must be stored — the old dedupe kept one');
    assert.deepEqual(jt.map(r => r.entity).sort(), ['ALL_INVOICES', 'ALL_JOBS', 'ALL_QUOTES']);
    // ⚠ AND THE OPTION LISTS MUST BE THE RIGHT ONES PER ROW, not all copies of whichever came first.
    const byId = Object.fromEntries(jt.map(r => [r.jobber_field_id, r]));
    assert.deepEqual(byId[QUOTE_FIELD].options, QUOTE_OPTIONS);
    assert.deepEqual(byId[JOB_FIELD].options, JOB_OPTIONS);
    assert.equal(byId[JOB_FIELD].transferable, true, 'transferable is stored per configuration');
  });

  it('⚠ PAIRED POSITIVE — unique labels are stored exactly as before', async () => {
    // Without this, a discovery that stored duplicates and mangled everything else would pass above.
    _setJobberHttpForTest({
      axiosPost: async () => page([
        dropdown('gid-a', 'Work Category', 'ALL_JOBS', ['Roof']),
        dropdown('gid-b', 'Material Type', 'ALL_JOBS', ['Asphalt']),
      ]),
    });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.label).sort(), ['Material Type', 'Work Category']);
  });

  it('it PAGES, and the second page is not lost', async () => {
    // ⚠ THE OLD QUERY SENT NO `first:` AND NO CURSOR, so it took Jobber's default page and kept only
    // that. Accent's 27 fit in one page, which is exactly why the omission was invisible.
    let call = 0;
    _setJobberHttpForTest({
      axiosPost: async (_url, body) => {
        call += 1;
        if (call === 1) {
          assert.equal(body.variables.after, null, 'the first request must not send a cursor');
          return page([dropdown('gid-p1', 'Page One', 'ALL_JOBS', ['x'])], true, 'CURSOR-1');
        }
        assert.equal(body.variables.after, 'CURSOR-1', 'the second must send the endCursor');
        return page([dropdown('gid-p2', 'Page Two', 'ALL_JOBS', ['y'])], false, null);
      },
    });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    assert.equal(call, 2, 'it must make two requests');
    assert.deepEqual(rows.map(r => r.label).sort(), ['Page One', 'Page Two']);
  });

  it('⚠ GraphQL errors inside a 200 THROW rather than emptying the table', async () => {
    // ⚠ THE DANGEROUS SHAPE. Discovery DELETEs the contractor's rows before inserting, so an
    // unchecked error response reads as "this contractor has no custom fields" and the delete is
    // acted on — wiping every mapping's target. Seed a row first so the wipe would be observable.
    await pool.query(
      `INSERT INTO contractor_jobber_fields (contractor_id, jobber_field_id, label, field_type, entity)
       VALUES ($1, 'gid-keep', 'Keep Me', 'dropdown', 'ALL_JOBS')`, [DISCO]);
    _setJobberHttpForTest({
      axiosPost: async () => ({ data: { errors: [{ message: 'THROTTLED' }] } }),
    });
    await assert.rejects(() => discoverJobberFields(DISCO, 'tok-discovery'), /THROTTLED/);
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS n FROM contractor_jobber_fields WHERE contractor_id = $1', [DISCO]);
    assert.equal(Number(rows[0].n), 1, 'the pre-existing row must survive a failed discovery');
  });

  it('a field DELETED in Jobber disappears here, which is what the delete-then-insert is for', async () => {
    _setJobberHttpForTest({
      axiosPost: async () => page([dropdown('gid-a', 'A', 'ALL_JOBS', ['x']), dropdown('gid-b', 'B', 'ALL_JOBS', ['y'])]),
    });
    await discoverJobberFields(DISCO, 'tok-discovery');
    _setJobberHttpForTest({ axiosPost: async () => page([dropdown('gid-a', 'A', 'ALL_JOBS', ['x'])]) });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    assert.deepEqual(rows.map(r => r.jobber_field_id), ['gid-a'],
      'a stale row would leave a mapping resolving to a field that no longer exists');
  });

  it('an Area configuration is stored, not silently dropped', async () => {
    // ⚠ CustomFieldConfigurationArea WAS IN TYPE_MAP WITH NO FRAGMENT IN THE QUERY, so those
    // configurations arrived with no id and no name and were dropped by the usability filter —
    // a whole field type invisible while the type map claimed to handle it.
    _setJobberHttpForTest({
      axiosPost: async () => page([{
        __typename: 'CustomFieldConfigurationArea',
        id: 'gid-area', name: 'Notes Area', appliesTo: 'ALL_JOBS', transferable: false, archived: false,
      }]),
    });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].field_type, 'area');
    assert.equal(rows[0].options, null, 'a non-dropdown has no option list');
  });

  it('archived is stored rather than filtered, so a stale mapping can say so', async () => {
    // Eleven of Accent's 27 are archived in Jobber and the mapping screen listed them as live.
    _setJobberHttpForTest({
      axiosPost: async () => page([
        dropdown('gid-dead', 'Lead Status', 'ALL_CLIENTS', ['a'], { archived: true }),
      ]),
    });
    const rows = await discoverJobberFields(DISCO, 'tok-discovery');
    assert.equal(rows[0].archived, true);
    assert.equal(describeField(rows[0]), 'Lead Status (Client) — archived in Jobber');
  });
});
