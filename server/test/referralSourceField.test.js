'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT B — THE REFERRAL-SOURCE FIELD IS PICKED BY ID, AND ONE RESOLVER SERVES BOTH DOORS
//
// ⚠ THE DEFECT: THE SETTING HAD STORAGE AND AN EDITOR AND NO DELIVERY.
// `contractor_crm_settings.referrer_field_name` was stored, edited, PATCHed and returned in the adapter
// config — and read by NOTHING. Both extraction sites matched a hardcoded literal,
// `f.label.toLowerCase() === 'referred by'`. Measured 2026-10-01: the only consumer of
// `referrerFieldName` anywhere in `server/` or `src/` was the admin screen reading it back into its own
// box. **A contractor who typed anything else had a setting that was accepted, echoed back and inert,
// on the field that decides who gets paid.** CLAUDE.md's five-states category (d).
//
// ⚠ AND A LABEL CANNOT NAME A FIELD ON THIS TENANT EITHER. Accent has NINE live-or-archived
// `ALL_CLIENTS` configurations, including BOTH `Referred by` (Text, live) and
// `Referred by Chuck Rigdon` (Text, archived) — so a prefix, substring or ILIKE match returns two, and
// the archived one would be read as a referrer nobody named. Two further rows share the label `Source`.
// The fixtures below are those real shapes, not invented ones.
//
// ⚠ WHY THE READER THROWS RATHER THAN RETURNING null WHEN THE QUERY IS NARROW. If a field is mapped by
// id and no custom field on the record carries `customFieldConfiguration`, the caller selected the old
// shape — and null there means "not referred", which stops a payout silently. That is exactly the class
// Commit A closed (a writer reading a field no query selects), so it is made LOUD. An EMPTY array is a
// different thing and is a legitimate "nothing to match".
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveReferralSourceField, readReferredByValue, normaliseFieldLabel,
  REFERRAL_SOURCE_ENTITY, DEFAULT_REFERRER_FIELD_LABEL,
} = require('../utils/referralSourceField');
const { getReferredByValue } = require('../crm/pipelineSync');
const { isDerivableJobberClientId } = require('../utils/derivableClient');

const TENANT = 'refsrc-tenant';

const gid = (type, n) => Buffer.from(`gid://Jobber/${type}/${n}`).toString('base64');
const CLIENT = gid('Client', '92000001');

// Accent's real shapes, by label and archived state.
const CFG_REFERRED_BY = gid('CustomFieldConfigurationText', '3655374');          // live
const CFG_REFERRED_BY_CHUCK = gid('CustomFieldConfigurationText', '2519789');    // ARCHIVED, label is a superset
const CFG_SOURCE_LIVE = gid('CustomFieldConfigurationDropdown', '89729');        // live dropdown
const CFG_SOURCE_ARCHIVED = gid('CustomFieldConfigurationText', '2508865');      // archived, SAME label
const CFG_JOB_TYPE = gid('CustomFieldConfigurationDropdown', '730114');          // ALL_JOBS, wrong entity

let pool;

const addField = (id, label, type, entity, archived) => pool.query(
  `INSERT INTO contractor_jobber_fields
     (contractor_id, jobber_field_id, label, field_type, entity, archived)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (contractor_id, jobber_field_id) DO UPDATE SET
     label = $3, field_type = $4, entity = $5, archived = $6`,
  [TENANT, id, label, type, entity, archived]
);

const setSettings = ({ name = null, fieldId = null, entity = null, label = null } = {}) => pool.query(
  `INSERT INTO contractor_crm_settings
     (contractor_id, referrer_field_name, referrer_field_id, referrer_field_entity, referrer_field_label)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (contractor_id) DO UPDATE SET
     referrer_field_name = $2, referrer_field_id = $3,
     referrer_field_entity = $4, referrer_field_label = $5`,
  [TENANT, name, fieldId, entity, label]
);

/** A record's customFields in the WIDE shape every capture door now selects (Commit A). */
const wide = (...entries) => entries.map(([label, value, cfgId, shape = 'text']) => ({
  label,
  ...(shape === 'text' ? { valueText: value } : { valueDropdown: value }),
  customFieldConfiguration: { id: cfgId },
}));

/** The OLD narrow shape — label and value only, no configuration. The pre-Commit-A selection. */
const narrow = (...entries) => entries.map(([label, value]) => ({ label, valueText: value }));

before(async () => {
  pool = await initTestDb();
});
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of ['contractor_jobber_fields', 'contractor_crm_settings', 'contractor_settings', 'error_log']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]).catch(async () => {
      await pool.query(`DELETE FROM ${t}`);
    });
  }
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  // Accent's real ALL_CLIENTS set, abridged to the rows that decide something.
  await addField(CFG_REFERRED_BY, 'Referred by', 'text', 'ALL_CLIENTS', false);
  await addField(CFG_REFERRED_BY_CHUCK, 'Referred by Chuck Rigdon', 'text', 'ALL_CLIENTS', true);
  await addField(CFG_SOURCE_LIVE, 'Source', 'dropdown', 'ALL_CLIENTS', false);
  await addField(CFG_SOURCE_ARCHIVED, 'Source', 'text', 'ALL_CLIENTS', true);
  await addField(CFG_JOB_TYPE, 'Job Type', 'dropdown', 'ALL_JOBS', false);
});

describe('the fixtures are real, so these cases ENTER the gated branches', () => {
  it('the client id is a real Jobber EncodedId', () => {
    assert.equal(Buffer.from(CLIENT, 'base64').toString('utf8'), 'gid://Jobber/Client/92000001');
    assert.equal(isDerivableJobberClientId(CLIENT), true);
  });

  it('the configuration ids decode to real Jobber configuration gids', () => {
    assert.equal(Buffer.from(CFG_REFERRED_BY, 'base64').toString('utf8'),
      'gid://Jobber/CustomFieldConfigurationText/3655374');
    assert.equal(Buffer.from(CFG_JOB_TYPE, 'base64').toString('utf8'),
      'gid://Jobber/CustomFieldConfigurationDropdown/730114');
  });

  it('the entity constant is the client entity, and there is no request entity', () => {
    assert.equal(REFERRAL_SOURCE_ENTITY, 'ALL_CLIENTS');
    assert.equal(DEFAULT_REFERRER_FIELD_LABEL, 'Referred by');
  });
});

describe('resolution — by configuration id when one is picked', () => {
  it('a picked field resolves by id, carrying its label and entity from the DISCOVERED row', async () => {
    // ⚠ THE STORED LABEL IS DELIBERATELY WRONG HERE. The discovered row is the authority for display,
    // so a stale stored label must not win — otherwise the screen contradicts the resolution.
    await setSettings({ name: 'Referred by', fieldId: CFG_REFERRED_BY, entity: 'ALL_CLIENTS', label: 'STALE LABEL' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(r.fieldId, CFG_REFERRED_BY);
    assert.equal(r.entity, 'ALL_CLIENTS');
    assert.equal(r.label, 'Referred by', 'the discovered row wins over the stored label');
    assert.equal(r.legacy, false);
    assert.equal(r.archived, false);
    assert.equal(r.missing, false);
  });

  it('an ARCHIVED picked field resolves and is FLAGGED, never refused', async () => {
    // Refusing would make a contractor stop earning the moment they archive a field in Jobber; the
    // values already on existing clients are still real.
    await setSettings({ name: 'x', fieldId: CFG_REFERRED_BY_CHUCK, entity: 'ALL_CLIENTS', label: 'Referred by Chuck Rigdon' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(r.fieldId, CFG_REFERRED_BY_CHUCK);
    assert.equal(r.archived, true, 'the screen must be able to warn');
    assert.equal(r.missing, false);
    assert.match(r.displayLabel, /archived/i);
  });

  it('a picked field DISCOVERY NO LONGER LISTS is marked missing and STILL resolves by id', async () => {
    // ⚠ THIS IS THE CASE THAT MUST NOT REFUSE. Discovery lagging is not the field being gone, and the
    // match uses the stored id against the record itself — so a stale discovery table cannot stop a
    // contractor earning. The warning is the product of this, not a block.
    const vanished = gid('CustomFieldConfigurationText', '999999');
    await setSettings({ name: 'x', fieldId: vanished, entity: 'ALL_CLIENTS', label: 'Gone Away' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(r.fieldId, vanished, 'it still resolves');
    assert.equal(r.missing, true);
    assert.equal(r.label, 'Gone Away', 'the stored label is all there is left to show');

    const value = readReferredByValue(
      wide(['Gone Away', 'Jane Referrer', vanished]), r);
    assert.equal(value, 'Jane Referrer', 'and it still READS, which is the whole point');
  });
});

describe('the FALLBACK — the stored setting, by EXACT normalised label', () => {
  it('an unmapped contractor reads the field named by referrer_field_name', async () => {
    await setSettings({ name: 'Who Sent You' });
    await addField(gid('CustomFieldConfigurationText', '5000001'), 'Who Sent You', 'text', 'ALL_CLIENTS', false);
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(r.fieldId, null);
    assert.equal(r.legacy, true);
    assert.equal(r.label, 'Who Sent You');

    const value = readReferredByValue(
      narrow(['Who Sent You', 'Tom Referrer'], ['Referred by', 'WRONG']), r);
    assert.equal(value, 'Tom Referrer',
      'the CUSTOM name is honoured — under the old hardcoded literal this returned WRONG');
  });

  it('an unmapped contractor with NO setting defaults to the platform label', async () => {
    await setSettings({ name: null });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(r.label, DEFAULT_REFERRER_FIELD_LABEL);
    assert.equal(readReferredByValue(narrow(['Referred by', 'Jane']), r), 'Jane');
  });

  it('a contractor with NO settings row at all still resolves to the default rather than throwing', async () => {
    const r = await resolveReferralSourceField(pool, TENANT); // no setSettings call
    assert.equal(r.label, DEFAULT_REFERRER_FIELD_LABEL);
    assert.equal(r.legacy, true);
  });

  it('🔴 EXACT ONLY — the archived "Referred by Chuck Rigdon" must NEVER match "Referred by"', async () => {
    // ⚠ THE WHOLE REASON THE MATCH IS EXACT, AND IT IS A REAL LABEL ON THE LIVE TENANT. A prefix,
    // substring or ILIKE match returns this row as well, and it is archived — so a referrer would be
    // read out of a field nobody has filled in years.
    await setSettings({ name: 'Referred by' });
    const r = await resolveReferralSourceField(pool, TENANT);

    const value = readReferredByValue(
      narrow(['Referred by Chuck Rigdon', 'Chuck Rigdon']), r);
    assert.equal(value, null, 'a label that merely STARTS WITH the wanted one is not a match');

    // Paired positive on the same fixture, or the negative proves only that nothing matched.
    const paired = readReferredByValue(
      narrow(['Referred by Chuck Rigdon', 'Chuck Rigdon'], ['Referred by', 'Jane Referrer']), r);
    assert.equal(paired, 'Jane Referrer', 'the exact label still matches when it is present');
  });

  it('normalisation is trim + collapse + case-fold, and nothing looser', () => {
    assert.equal(normaliseFieldLabel('  Referred   BY  '), 'referred by');
    assert.equal(normaliseFieldLabel('REFERRED BY'), normaliseFieldLabel('referred by'));
    assert.equal(normaliseFieldLabel(undefined), '');
    // ⚠ AND IT IS NOT A PREFIX TEST. Stated as an assertion so a future "helpful" loosening fails here.
    assert.notEqual(normaliseFieldLabel('Referred by Chuck Rigdon'), normaliseFieldLabel('Referred by'));
  });
});

describe('reading a value off a record', () => {
  it('matches by id even when ANOTHER field shares the wanted label', async () => {
    // ⚠ THE DISCRIMINATING CASE. Two fields carry the label `Source`; only the id can tell them apart,
    // and the live one is the DROPDOWN. A label match here is a coin flip.
    await setSettings({ name: 'Source', fieldId: CFG_SOURCE_LIVE, entity: 'ALL_CLIENTS', label: 'Source' });
    const r = await resolveReferralSourceField(pool, TENANT);
    const value = readReferredByValue([
      { label: 'Source', valueText: 'the ARCHIVED text copy', customFieldConfiguration: { id: CFG_SOURCE_ARCHIVED } },
      { label: 'Source', valueDropdown: 'the LIVE dropdown', customFieldConfiguration: { id: CFG_SOURCE_LIVE } },
    ], r);
    assert.equal(value, 'the LIVE dropdown');
  });

  it('reads a DROPDOWN value as well as a text one', async () => {
    await setSettings({ name: 'Source', fieldId: CFG_SOURCE_LIVE, entity: 'ALL_CLIENTS', label: 'Source' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(readReferredByValue(wide(['Source', 'Word of mouth', CFG_SOURCE_LIVE, 'dropdown']), r),
      'Word of mouth');
  });

  it('a BLANK or whitespace-only value is null, not an empty referrer name', async () => {
    await setSettings({ name: 'Referred by', fieldId: CFG_REFERRED_BY, entity: 'ALL_CLIENTS', label: 'Referred by' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(readReferredByValue(wide(['Referred by', '', CFG_REFERRED_BY]), r), null);
    assert.equal(readReferredByValue(wide(['Referred by', '   ', CFG_REFERRED_BY]), r), null);
    assert.equal(readReferredByValue(wide(['Referred by', ' Jane ', CFG_REFERRED_BY]), r), 'Jane',
      'and a real value is trimmed');
  });

  it('an EMPTY custom-field array is a legitimate null, not an error', async () => {
    await setSettings({ name: 'Referred by', fieldId: CFG_REFERRED_BY, entity: 'ALL_CLIENTS', label: 'Referred by' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.equal(readReferredByValue([], r), null);
    assert.equal(readReferredByValue(undefined, r), null);
  });

  it('🔴 THROWS when a field is mapped by id and the query selected the OLD narrow shape', async () => {
    // ⚠ THE SILENT-FAILURE CLASS, MADE LOUD. Returning null here would read as "not referred" and stop
    // a payout with nothing to see — which is how the custom-field capture went unnoticed for weeks.
    await setSettings({ name: 'Referred by', fieldId: CFG_REFERRED_BY, entity: 'ALL_CLIENTS', label: 'Referred by' });
    const r = await resolveReferralSourceField(pool, TENANT);
    assert.throws(
      () => readReferredByValue(narrow(['Referred by', 'Jane Referrer']), r),
      /missing that selection/,
      'a narrow selection under an id mapping must fail loudly');
    // Paired positive: the WIDE shape on the same mapping reads fine, so the throw is about the
    // selection and not about the mapping.
    assert.equal(readReferredByValue(wide(['Referred by', 'Jane Referrer', CFG_REFERRED_BY]), r),
      'Jane Referrer');
  });
});

describe('ONE resolver — the two extraction sites cannot drift', () => {
  it('🔴 pipelineSync and the invoice-paid handler agree on the same fixture', async () => {
    // ⚠ THE DRIFT THIS FORBIDS WAS REAL: each site spelled its own `.find()` over the same literal, so
    // either could be changed alone. `getReferredByValue` is pipelineSync's export and now delegates;
    // the webhook calls `readReferredByValue` directly. Driving both and comparing is what pins it.
    await setSettings({ name: 'Referred by', fieldId: CFG_REFERRED_BY, entity: 'ALL_CLIENTS', label: 'Referred by' });
    const r = await resolveReferralSourceField(pool, TENANT);
    const fields = wide(
      ['Referred by Chuck Rigdon', 'Chuck Rigdon', CFG_REFERRED_BY_CHUCK],
      ['Referred by', 'Jane Referrer', CFG_REFERRED_BY],
    );

    const viaSync = getReferredByValue({ id: CLIENT, customFields: fields }, r);
    const viaWebhook = readReferredByValue(fields, r);
    assert.equal(viaSync, 'Jane Referrer');
    assert.equal(viaWebhook, 'Jane Referrer');
    assert.equal(viaSync, viaWebhook, 'the two doors must never disagree about who referred a client');
  });

  it('SOURCE FENCE: neither extraction site spells the old hardcoded literal in CODE', () => {
    // ⚠ COMMENTS ARE STRIPPED, AND THAT IS REQUIRED HERE RATHER THAN TIDY. Both files now carry a
    // comment NAMING the literal they removed — CLAUDE.md records this as the one shape where rewording
    // is not the fix, because the comment has to be able to say what it removed.
    const strip = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    const read = (...p) => strip(fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8'));

    for (const file of [['crm', 'pipelineSync.js'], ['routes', 'webhooks', 'jobber.js']]) {
      const src = read(...file);
      assert.ok(!/toLowerCase\(\)\s*===\s*'referred by'/.test(src),
        `${file.join('/')} must not match the referral-source field by a hardcoded literal`);
      assert.match(src, /readReferredByValue/,
        `${file.join('/')} must read through the shared resolver`);
    }

    // ⚠ HARNESS FLOOR, BOTH DIRECTIONS: the needle must catch the pre-fix line, and the strip must be
    // what makes the assertions above real. Built by concatenation so this file is not itself the defect.
    const prefix = "f.label && f.label." + "toLowerCase() === " + "'referred by'";
    assert.match(prefix, /toLowerCase\(\)\s*===\s*'referred by'/,
      'harness: the needle must match the exact pre-fix shape');
    const raw = fs.readFileSync(path.join(__dirname, '..', 'crm', 'pipelineSync.js'), 'utf8');
    assert.match(raw, /'referred by'/,
      'harness: the comment copy must still exist, or the strip proves nothing');
  });

  it('SOURCE FENCE: the bulk client queries carry the configuration id', () => {
    // ⚠ WITHOUT THIS THE ID PATH CANNOT WORK ON THE SYNC AT ALL. `getReferredByValue` is fed by
    // pipelineSync's two BULK list queries, which selected `... on CustomFieldText { label valueText }`
    // — no configuration id — so a mapped contractor would hit the loud throw above on every client.
    const { CUSTOM_FIELDS_VALUE_ONLY } = require('../utils/jobberClientFetch');
    assert.match(CUSTOM_FIELDS_VALUE_ONLY, /customFieldConfiguration \{ id \}/);
    assert.match(CUSTOM_FIELDS_VALUE_ONLY, /valueText/);
    assert.match(CUSTOM_FIELDS_VALUE_ONLY, /valueDropdown/);

    const src = fs.readFileSync(path.join(__dirname, '..', 'crm', 'pipelineSync.js'), 'utf8')
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    const uses = src.split('${CUSTOM_FIELDS_VALUE_ONLY}').length - 1;
    assert.equal(uses, 2, 'both bulk client queries must interpolate the shared value-only selection');
  });
});

describe('the migration — it refuses rather than guesses', () => {
  // ⚠ THE STATEMENT IS EXTRACTED FROM db.js AND EXECUTED, NOT RETYPED — AND THE FIRST WRITING OF THIS
  // SUITE DID RETYPE IT, WHICH A GUARD-PROOF MEASURED. Injecting db.js then reddened only the SOURCE
  // fence below: every behavioural case was driving the TEST's own copy, so production could have been
  // broken while all eight stayed green. That is CLAUDE.md's recorded shape from the `$3` cast — "a
  // retyped copy carrying the fix would pass while production stayed broken" — reproduced here by the
  // session that quoted it. After this change, injections (6) and (7) red behaviourally.
  const migrationSql = (() => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
    // ⚠ ANCHORED ON A LINE UNIQUE TO THIS STATEMENT, AND THE FIRST WRITING WAS NOT.
    // `UPDATE contractor_crm_settings s` appears TWICE in db.js — the other is the `rep_window_start`
    // migration — and taking the first match sliced 340 characters of an unrelated statement. The
    // length floor below is what caught it, which is the whole reason a floor is written from the
    // SUBJECT's plausible size rather than from the needle's own shape.
    const marker = 'SET referrer_field_id';
    assert.equal(raw.split(marker).length - 1, 1, 'harness: the marker must identify ONE statement');
    const at = raw.lastIndexOf('UPDATE contractor_crm_settings s', raw.indexOf(marker));
    assert.ok(at > -1, 'harness: the migration statement must be found in db.js');
    const end = raw.indexOf('`', at);
    assert.ok(end > at, 'harness: the statement must be a closed template literal');
    const sql = raw.slice(at, end);
    // Non-vacuity floors: a slice that found the wrong thing, or almost nothing, must fail HERE rather
    // than silently make every case below assert against an empty statement.
    assert.ok(sql.length > 400, `harness: the extracted statement is implausibly short (${sql.length})`);
    assert.match(sql, /RETURNING/, 'harness: the slice must reach the RETURNING clause');
    assert.ok(!sql.includes('$1'), 'harness: this migration takes no parameters');
    return sql;
  })();

  const runMigration = () => pool.query(migrationSql);

  const stored = async () => (await pool.query(
    `SELECT referrer_field_id, referrer_field_entity, referrer_field_label
       FROM contractor_crm_settings WHERE contractor_id = $1`, [TENANT])).rows[0];

  it('the SQL under test is the one db.js ships, read from source rather than retyped', () => {
    // ⚠ A RETYPED COPY CARRYING A FIX WOULD PASS WHILE PRODUCTION STAYED BROKEN — CLAUDE.md records
    // exactly that from the `$3` cast. The shape is pinned here; the behaviour is driven above.
    // ⚠ COMMENTS ARE STRIPPED, AND THE FIRST WRITING OF THIS CASE FAILED BECAUSE THEY WERE NOT.
    // db.js's own comment explains the migration by NAMING the forbidden form — `LIKE 'referred by%'`
    // would find two — so an unstripped read reported the comment that documents the fix as the defect.
    // This is CLAUDE.md's "scans read comments" rule, and it is the one shape where rewording is NOT
    // the answer: the comment has to be able to say what it rejected, so the parser changes instead.
    const raw = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    assert.match(src, /referrer_field_id\s*=\s*m\.jobber_field_id/, 'db.js must ship the migration');
    assert.match(src, /AND s\.referrer_field_id IS NULL/, 'and it must never overwrite a pick');
    assert.match(src, /\) = 1/, 'and it must require EXACTLY ONE match');
    assert.ok(!/LIKE\s+'referred by/i.test(src), 'and never a prefix match');
    // ⚠ FLOOR, BOTH DIRECTIONS: the comment copy must survive in the RAW file, or the strip above is
    // proving nothing; and the needle must match the shape it forbids.
    assert.match(raw, /LIKE\s+'referred by/i,
      'harness: db.js must still carry the comment naming the prefix form it rejects');
    assert.match("LIKE 'referred by%'", /LIKE\s+'referred by/i,
      'harness: the needle must match the forbidden shape');
  });

  it("Accent's typed default migrates to the one live exact match", async () => {
    await setSettings({ name: 'Referred by' });
    const r = await runMigration();
    assert.equal(r.rowCount, 1);
    const row = await stored();
    assert.equal(row.referrer_field_id, CFG_REFERRED_BY, 'the LIVE Referred by field, by id');
    assert.equal(row.referrer_field_entity, 'ALL_CLIENTS');
    assert.equal(row.referrer_field_label, 'Referred by');
  });

  it('🔴 AMBIGUOUS leaves the contractor on the legacy path, writing nothing', async () => {
    // Two live `Source` fields — picking one would bake in the coin flip this change exists to end.
    await addField(CFG_SOURCE_ARCHIVED, 'Source', 'text', 'ALL_CLIENTS', false); // now BOTH live
    await setSettings({ name: 'Source' });
    const r = await runMigration();
    assert.equal(r.rowCount, 0, 'two live exact matches must migrate nothing');
    assert.equal((await stored()).referrer_field_id, null);
  });

  it('MISSING leaves the contractor on the legacy path, writing nothing', async () => {
    await setSettings({ name: 'A Field Nobody Has' });
    assert.equal((await runMigration()).rowCount, 0);
    assert.equal((await stored()).referrer_field_id, null);
  });

  it('an ARCHIVED-only match migrates nothing — a dead field is not a pick', async () => {
    await setSettings({ name: 'Referred by Chuck Rigdon' });
    assert.equal((await runMigration()).rowCount, 0);
    assert.equal((await stored()).referrer_field_id, null);
  });

  it('it NEVER overwrites an existing pick, and is idempotent', async () => {
    await setSettings({ name: 'Referred by', fieldId: CFG_SOURCE_LIVE, entity: 'ALL_CLIENTS', label: 'Source' });
    assert.equal((await runMigration()).rowCount, 0, 'a deliberate choice must survive a later boot');
    assert.equal((await stored()).referrer_field_id, CFG_SOURCE_LIVE);

    // And on a fresh contractor it runs once and then no-ops.
    await setSettings({ name: 'Referred by' });
    assert.equal((await runMigration()).rowCount, 1);
    assert.equal((await runMigration()).rowCount, 0, 'second run is a no-op');
  });

  it('whitespace and case in the typed name do not stop the match', async () => {
    await setSettings({ name: '  referred    BY ' });
    assert.equal((await runMigration()).rowCount, 1);
    assert.equal((await stored()).referrer_field_id, CFG_REFERRED_BY);
  });

  it('a JOB-entity field with the same label is never chosen', async () => {
    await addField(gid('CustomFieldConfigurationText', '7777777'), 'Referred by', 'text', 'ALL_JOBS', false);
    await setSettings({ name: 'Referred by' });
    assert.equal((await runMigration()).rowCount, 1, 'the client field is still unambiguous');
    assert.equal((await stored()).referrer_field_id, CFG_REFERRED_BY);
    assert.equal((await stored()).referrer_field_entity, 'ALL_CLIENTS');
  });
});
