'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.2 — TAG-WIPE GUARD. RED-FIRST TESTS.
//
// THE DEFECT (measured in production 2026-08-26, contractor accent-roofing-dev):
//   fullJobberImport's Step A selection set does not request `tags`. Step I then
//   passes `tags: client.tags` — undefined — into deriveAndSaveTags, whose native-tag
//   block DELETEs every jobber_tag:% / source='jobber_crm' row for that client and
//   restores none. 1,838 rows across 386 clients, destroyed on every import run.
//
// THE GUARD: `clientData.tags !== undefined` distinguishes "we never ASKED Jobber for
// tags" from "we asked and this client has none". See the comment at the guard site in
// deriveJobberTags.js for why `!= null` is WRONG here.
//
// ⚠ ONLY T1 IS RED AGAINST TODAY'S CODE, AND THAT IS THE CORRECT STATE — do not read
// the other four as vacuous for being green.
//   T1  — RED today. Asserts the behaviour the fix introduces.
//   T2  — GREEN today, and must STAY green. A regression fence: it is what makes
//         "delete the DELETE" an illegal way to turn T1 green.
//   T3  — GREEN today, and must STAY green. The case the guard must NOT block. It is
//         where an over-broad guard (`!= null`, or `tags?.nodes?.length`) fails.
//   T4  — GREEN today. Standing tripwire on Step A's query text (throttle budget).
//   T5  — GREEN today. Standing tripwire on Step I's CALL SITE.
//
// ⚠ THE STATE ABOVE IS THE RECORD OF 2026-08-26, BEFORE THE FIX. T1 IS NOW GREEN.
// Left as written because it is what each test was authored against and it is what
// the guard-proofs below check against — see CLAUDE.md → "A RED narrative is a record,
// not a claim about today". Everything in this file is green as of the fix commit.
//
// ⚠ A GREEN-TODAY TEST IS A CLAIM UNTIL ITS FAILURE MODE HAS BEEN OBSERVED
// (CLAUDE.md → "A mechanism that reports health it cannot observe"). None of these is
// trusted on the strength of a green run. Every one was PROVEN to fail by building the
// broken implementation it guards against:
//
//   PROBE A  DELETE block removed entirely
//            → RED: T2, T3a, T3b.  GREEN: T1, T4, T5.
//            ⚠ T1 PASSES UNDER PROBE A. Removing the DELETE satisfies it trivially —
//            which is precisely why T2 exists and must never be deleted as redundant.
//   PROBE B  guard written `clientData.tags != null`
//            → RED: T3b ONLY.  GREEN: T1, T2, T3a, T4, T5.
//            ⚠ THE LOAD-BEARING RESULT. A single-shape T3 would have shipped the
//            append-only bug with a fully green suite. This is why T3 is two tests.
//   PROBE C  `tags { nodes { label } }` added to Step A's selection set
//            → RED: T4.  GREEN: T2, T3a, T3b, T5.
//   PROBE D  call site → `tags: client.tags || { nodes: [] }`
//            → RED: T5 ONLY.  T4 STAYS GREEN.
//            ⚠ T4 and T5 catch DISJOINT changes. T4 reads the query text; a defensive
//            tidy at the call site sails straight past it. Neither substitutes for the
//            other.
//
// GUARD-PROOFS, run against the FIXED code (2026-08-26):
//   GP1  whole guard block reverted to its pre-fix form
//        → T1 RED with the exact shape recorded at its own site below. Restored, green.
//   GP2  guard operator flipped to `!= null`, comment and structure untouched
//        → T3b RED alone; T1/T2/T3a green. Reproduces Probe B against the final code,
//          so the claim in deriveJobberTags.js's guard comment is checked, not
//          remembered. Restored, green.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const deriveAndSaveTags = require('../utils/deriveJobberTags');
const { seedContractor, seedJobberClient } = require('./helpers');

const TENANT = 'tagwipe-tenant';
const JCID   = 'JCLIENT_TAGWIPE_1';

// Seeds a jobber_tag row in the EXACT shape the DELETE targets: keyed by
// jobber_client_id (not contact_id) and source='jobber_crm'. seedTag() in helpers.js
// writes source='system', which the DELETE does not match — using it here would make
// every one of these tests pass vacuously.
async function seedJobberCrmTag(pool, tag) {
  await pool.query(
    `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
     VALUES ($1, $2, $3, 'jobber_crm', NOW())
     ON CONFLICT DO NOTHING`,
    [JCID, TENANT, tag]
  );
}

// Reads back exactly the population the DELETE targets, sorted for stable comparison.
async function jobberTags(pool) {
  const { rows } = await pool.query(
    `SELECT tag FROM contact_tags
      WHERE jobber_client_id = $1
        AND contractor_id = $2
        AND tag LIKE 'jobber_tag:%'
        AND source = 'jobber_crm'
      ORDER BY tag`,
    [JCID, TENANT]
  );
  return rows.map(r => r.tag);
}

const STALE = ['jobber_tag:storm_damage', 'jobber_tag:vip'];

// Seeds the two stale rows and PROVES they are readable before the subject runs.
// Without this, a broken seed and a correct DELETE are indistinguishable in the
// failure output — and a broken seed would make T2/T3 pass for the wrong reason.
async function seedStaleAndAssertPrecondition(pool) {
  for (const t of STALE) await seedJobberCrmTag(pool, t);
  assert.deepEqual(
    await jobberTags(pool), STALE,
    'PRECONDITION FAILED: the stale jobber_tag rows were not seeded in the shape the ' +
    'DELETE targets (jobber_client_id + source=jobber_crm). This is a harness failure, ' +
    'not a finding about the subject.'
  );
}

describe('Wave 0.2 — tag-wipe guard (RED first)', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM jobber_clients');
    await seedContractor(pool, TENANT);
    await seedJobberClient(pool, { contractorId: TENANT, jobberClientId: JCID, name: 'Tagwipe Test' });
  });

  // ── T1 ──────────────────────────────────────────────────────────────────────
  // RED against today's code. Recorded failure shape:
  //   AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  //   + actual - expected
  //   + []
  //   - [ 'jobber_tag:storm_damage', 'jobber_tag:vip' ]
  // i.e. BOTH rows destroyed by a caller that never fetched tags.
  it('T1 — tags undefined (caller never fetched them) leaves jobber_tag rows INTACT', async () => {
    await seedStaleAndAssertPrecondition(pool);

    // The fullJobberImport Step I payload, faithfully: every key Step I builds, with
    // `tags` carrying what `client.tags` actually evaluates to when Step A's selection
    // set omits the field.
    const clientData = {
      isCompany:    false,
      isLead:       false,
      tags:         undefined,
      customFields: [],
      jobs:         [],
      invoices:     [],
      quotes:       [],
      requests:     [],
    };

    await deriveAndSaveTags(pool, TENANT, JCID, clientData, {});

    assert.deepEqual(
      await jobberTags(pool), STALE,
      'A caller that did not fetch tags destroyed them. `tags: undefined` means "we ' +
      'never ASKED Jobber", not "this client has none" — deleting is data destruction.'
    );
  });

  // ── T2 — POSITIVE CONTROL ───────────────────────────────────────────────────
  // GREEN today and must stay green. Without it, T1 is satisfiable by removing the
  // DELETE outright.
  // PROVEN NON-VACUOUS: with the DELETE block removed, this test goes RED —
  //   + [ 'jobber_tag:storm_damage', 'jobber_tag:storm_damage_2024', 'jobber_tag:vip' ]
  //   - [ 'jobber_tag:storm_damage_2024' ]
  it('T2 — tags present with a label REPLACES the stale rows (positive control)', async () => {
    await seedStaleAndAssertPrecondition(pool);

    const clientData = {
      isCompany: false,
      isLead:    false,
      tags:      { nodes: [{ label: 'Storm Damage 2024' }] },
      customFields: [], jobs: [], invoices: [], quotes: [], requests: [],
    };

    await deriveAndSaveTags(pool, TENANT, JCID, clientData, {});

    assert.deepEqual(
      await jobberTags(pool), ['jobber_tag:storm_damage_2024'],
      'The asked-and-has-tags case must still fully replace: both stale rows gone, the ' +
      'new label written. A guard that blocks this has been written too broadly.'
    );
  });

  // ── T3 — THE GENUINELY-EMPTY CASE, BOTH SHAPES ──────────────────────────────
  // Jobber's response shape for an empty tags connection is NOT established — no
  // fixture, test or comment in this repo records it, and `tags?.nodes || []`
  // collapsed both shapes so the question never had to be answered. It is pinned
  // here rather than by a remembered GraphiQL session: the guard is correct under
  // BOTH answers, and these two assertions are what hold that true.
  //
  // ⚠ THIS IS WHERE `!= null` FAILS. It would block the null case, making
  // jobber_tag rows APPEND-ONLY — a quieter bug than the one being fixed.
  // PROVEN NON-VACUOUS: with the guard written as `clientData.tags != null`, the
  // null case goes RED —
  //   + [ 'jobber_tag:storm_damage', 'jobber_tag:vip' ]
  //   - []
  it('T3a — tags { nodes: [] } (asked; client genuinely has none) DELETEs', async () => {
    await seedStaleAndAssertPrecondition(pool);

    const clientData = {
      isCompany: false, isLead: false,
      tags: { nodes: [] },
      customFields: [], jobs: [], invoices: [], quotes: [], requests: [],
    };

    await deriveAndSaveTags(pool, TENANT, JCID, clientData, {});

    assert.deepEqual(
      await jobberTags(pool), [],
      'We asked Jobber and got an empty connection — the client genuinely has no tags, ' +
      'so the stale rows must go. The guard must NOT block this.'
    );
  });

  it('T3b — tags null (asked; Jobber returned null for the empty connection) DELETEs', async () => {
    await seedStaleAndAssertPrecondition(pool);

    const clientData = {
      isCompany: false, isLead: false,
      tags: null,
      customFields: [], jobs: [], invoices: [], quotes: [], requests: [],
    };

    await deriveAndSaveTags(pool, TENANT, JCID, clientData, {});

    assert.deepEqual(
      await jobberTags(pool), [],
      'null is an ANSWER from Jobber, not an absence of one — the field was selected, ' +
      'so this client has no tags and the stale rows must go. This assertion is what ' +
      'makes `!= null` an illegal way to write the guard.'
    );
  });

  // ── T4 — THROTTLE TRIPWIRE ──────────────────────────────────────────────────
  // Standing guard, green today. PROVEN NON-VACUOUS: inserting `tags { nodes { label } }`
  // into Step A's selection set turns this RED with the message below.
  it('T4 — fullJobberImport Step A does NOT select tags (throttle budget)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'jobs', 'fullJobberImport.js'), 'utf8'
    );

    // Split on /\r?\n/ — a tracked LF file becomes CRLF in the working tree under
    // core.autocrlf=true, and `.` does not match \r, so a $-anchored pattern would
    // silently no-op. (CLAUDE.md → "Guards agreeing is not evidence".)
    const lines = src.split(/\r?\n/);

    const startIdx = lines.findIndex(l => l.includes('const clientsQuery = `'));
    assert.notEqual(
      startIdx, -1,
      'NON-VACUITY: could not locate Step A\'s `const clientsQuery = ` declaration. ' +
      'This test proves nothing if it cannot find its subject — repoint it rather than ' +
      'deleting it.'
    );
    const endOffset = lines.slice(startIdx).findIndex((l, i) => i > 0 && l.includes('`;'));
    assert.notEqual(endOffset, -1, 'NON-VACUITY: Step A query literal is not terminated.');
    const stepAQuery = lines.slice(startIdx, startIdx + endOffset + 1).join('\n');

    // Positive control on the slice: it must be the clients query, not some neighbour.
    assert.ok(
      /clients\(first:\s*100/.test(stepAQuery),
      `NON-VACUITY: the extracted slice is not Step A's clients query. Got:\n${stepAQuery}`
    );

    assert.ok(
      !/\btags\b/.test(stepAQuery),
      'Step A\'s selection set now requests `tags`. DO NOT ADD IT.\n' +
      '  Session 75: `tags { nodes { label } }` costs 10,305 points per 100-node page\n' +
      '  against a 10,000-point bucket ceiling, so it is ALWAYS throttled — removing it\n' +
      '  is what made Step A work at all, after 13 sub-sessions of debugging.\n' +
      '  Measured again in GraphiQL 2026-08-26: the current selection set costs\n' +
      '  actualQueryCost 2,285 at first:100 against maximumAvailable 10,000. Adding tags\n' +
      '  breaks the FIRST page.\n' +
      '  If you are here because tags are being wiped, that is a different defect and it\n' +
      '  is already fixed — see the guard in server/utils/deriveJobberTags.js.\n' +
      `  Extracted Step A query:\n${stepAQuery}`
    );
  });

  // ── T5 — CALL-SITE TRIPWIRE ─────────────────────────────────────────────────
  // T4 guards the QUERY TEXT. It does not guard the CALL SITE, and a defensive tidy
  // there — `tags: client.tags || { nodes: [] }` — would pass T4 while silently
  // re-arming the destruction: the manufactured `{nodes: []}` reads to the guard as
  // "we asked and there are none", which is exactly the state that DELETEs.
  //
  // MECHANISM: source text, not behaviour. Chosen deliberately; the reasoning and the
  // cost of the behavioural alternative are in the Phase 2 report.
  //
  // PROVEN NON-VACUOUS: rewriting the call site as `tags: client.tags || { nodes: [] },`
  // turns this RED with the message below.
  it('T5 — fullJobberImport forwards tags VERBATIM to deriveAndSaveTags', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'jobs', 'fullJobberImport.js'), 'utf8'
    );
    const lines = src.split(/\r?\n/);

    // Anchor on the call, and assert there is EXACTLY ONE — so this cannot be
    // satisfied by a different site than the one it means to guard.
    const callIdxs = lines
      .map((l, i) => (l.includes('await deriveAndSaveTags(') ? i : -1))
      .filter(i => i !== -1);
    assert.equal(
      callIdxs.length, 1,
      `NON-VACUITY: expected exactly one deriveAndSaveTags call site in ` +
      `fullJobberImport.js, found ${callIdxs.length} at lines ` +
      `[${callIdxs.map(i => i + 1).join(', ')}]. Re-derive this test's anchor before ` +
      'trusting it.'
    );

    // The clientData literal is the block immediately above the call.
    const litStart = lines.slice(0, callIdxs[0]).map((l, i) => (l.includes('const clientData = {') ? i : -1))
      .filter(i => i !== -1).pop();
    assert.notEqual(
      litStart, undefined,
      'NON-VACUITY: could not locate the `const clientData = {` literal above the ' +
      'deriveAndSaveTags call. Repoint this test rather than deleting it.'
    );

    const tagsLines = lines.slice(litStart, callIdxs[0]).filter(l => /^\s*tags:/.test(l));
    assert.equal(
      tagsLines.length, 1,
      'NON-VACUITY: expected exactly one `tags:` key in the clientData literal, found ' +
      `${tagsLines.length}. Found:\n${tagsLines.join('\n')}`
    );

    // The whole point: the value expression is `client.tags` and NOTHING else.
    // Rejects `client.tags || {...}`, `client.tags ?? {...}`, `client.tags || []`.
    assert.match(
      tagsLines[0], /^\s*tags:\s*client\.tags,\s*$/,
      'The Step I call site no longer forwards `client.tags` VERBATIM.\n' +
      `  Found: ${tagsLines[0].trim()}\n` +
      '  The tag-wipe guard in deriveJobberTags.js distinguishes "we never asked Jobber\n' +
      '  for tags" (undefined) from "we asked and there are none" ({nodes:[]} or null).\n' +
      '  Coalescing or defaulting HERE manufactures the second state out of the first,\n' +
      '  which re-arms the DELETE this guard exists to prevent — 1,838 rows across 386\n' +
      '  clients, measured 2026-08-26.\n' +
      '  If Step A now genuinely selects tags, T4 is the test to look at; this one still\n' +
      '  wants the value forwarded verbatim.'
    );
  });
});
