'use strict';

// 3d Phase 1a Commit 6c — THE TEST RESET LIST CANNOT MISS A TABLE.
//
// ⚠ WHY THIS EXISTS: FOUR TABLES ADDED DURING THIS ARC WERE LEFT OUT OF A RESET LIST, AND
// EACH TIME A PRIOR CASE'S ROWS LEAKED INTO THE NEXT AND MADE AN ASSERTION PASS THAT SHOULD
// HAVE FAILED. The five crm_* fact tables, then rep_request_sweep_failures in 6b — whose
// absence made the poison-pill case reach the cap a run early, reading "run 2 holds" as
// true !== false. Every one was found by a test failing oddly, never by a check.
//
// PURE SOURCE ANALYSIS — no database. It deliberately does NOT call initTestDb(), so it
// cannot participate in the pool-singleton teardown failure CLAUDE.md records.
//
// ── HOW IT DECIDES WHICH TABLES A SUITE TOUCHES ──────────────────────────────────────────
// A suite TOUCHES table t if, anywhere in the file OUTSIDE a before()/after() region, the
// source contains `FROM t`, `JOIN t`, `INSERT INTO t` or `UPDATE t SET`.
//
// ⚠ THE CONTEXT IS THE COMPLEMENT OF before()/after(), NOT THE INSIDE OF it(). That is not a
// stylistic choice — an inside-it() scan WOULD HAVE MISSED 6b's OWN DEFECT. 6b's read of
// rep_request_sweep_failures lives in a file-level helper (failureCount) that tests CALL, so
// it sits inside no it() block at all. before()/after() are excluded because a table seeded
// once there is the suite's baseline fixture and is deliberately outside the per-test reset;
// `before` is matched with a word boundary so beforeEach — which IS per-test — still counts.
//
// A suite CLEARS table t if it contains `DELETE FROM t` / `TRUNCATE t`, or clears an ancestor
// that cascades to t. ⚠ CASCADES ARE RESOLVED TRANSITIVELY, and without that the fence lies:
// dynamic_audience_members cascades from dynamic_audiences, so a suite clearing the parent HAS
// cleared the child, and reporting it would be a false positive. db.js carries 25 such FKs.
//
// ── WHAT IT CANNOT SEE — stated because a fence named for a property reads as covering it ──
// 1. A TABLE WRITTEN BY PRODUCTION CODE AND NEVER NAMED BY THE SUITE. If a suite drives a
//    webhook that writes table t and asserts nothing about t, this fence is blind to t. It
//    reads the SUITE's SQL, not the call graph beneath it. (A require-closure version was
//    measured and rejected: it makes one group of ~45 tables and would demand every suite
//    clear nearly everything — 3165 findings, which is a fence switched off within a month.)
// 2. A RESET WHOSE TABLE NAMES ARE BUILT AT RUN TIME AND NOT FROM AN ARRAY LITERAL. Nine
//    files are in that state and are listed in UNREADABLE_RESETS below, so a new one surfaces
//    as a failure of the last case here rather than as silence. This is the same blind spot
//    as CLAUDE.md's "a name-based search cannot find a name that is never written down".
// 3. A TABLE CREATED OUTSIDE db.js, or created only inside a DO block whose name the CREATE /
//    ALTER needles cannot reach.
// 4. WHETHER A LEAK ACTUALLY CHANGES AN ASSERTION. It reports coverage, not consequence — a
//    suite may touch an uncleaned table entirely harmlessly, which is why the pre-existing
//    findings are recorded below rather than treated as bugs.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const TEST_DIR = __dirname;

// Comments stripped before any needle runs. ⚠ NOT OPTIONAL: the first draft of this analysis
// read db.js WITH comments and the prose "ALTER TABLE is required" invented a table named
// `is`, which then matched `FROM is` nowhere and `contacts is` everywhere. That is exactly
// CLAUDE.md's \bFROM\b-in-a-SQL-comment defect, reproduced inside the tool built to avoid it.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/--[^\n]*/g, ' ');
}

// Words the needles can pick up out of surviving prose. Kept explicit so that a real table
// one day named like one of these fails loudly here instead of being silently dropped.
const NOT_TABLES = new Set(['is', 'add', 'if', 'the', 'this', 'to', 'a', 'it']);

function knownTables(dbSrc) {
  const t = new Set();
  for (const m of dbSrc.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) t.add(m[1].toLowerCase());
  // ALTER TABLE is an independent witness: it names a table that must already exist, which
  // catches any CREATE the needle above could not reach.
  for (const m of dbSrc.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) t.add(m[1].toLowerCase());
  for (const junk of NOT_TABLES) t.delete(junk);
  return t;
}

// child -> parents whose deletion also deletes the child.
function cascadeEdges(dbSrc, tables) {
  const edges = new Map();
  const add = (child, parent) => {
    if (!tables.has(child) || !tables.has(parent) || child === parent) return;
    if (!edges.has(child)) edges.set(child, new Set());
    edges.get(child).add(parent);
  };
  for (const m of dbSrc.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\)/gi)) {
    for (const r of m[2].matchAll(/REFERENCES\s+([a-z_][a-z0-9_]*)\s*\([^)]*\)\s*ON DELETE CASCADE/gi)) {
      add(m[1].toLowerCase(), r[1].toLowerCase());
    }
  }
  for (const m of dbSrc.matchAll(/ALTER TABLE\s+([a-z_][a-z0-9_]*)[\s\S]{0,400}?REFERENCES\s+([a-z_][a-z0-9_]*)\s*\([^)]*\)\s*ON DELETE CASCADE/gi)) {
    add(m[1].toLowerCase(), m[2].toLowerCase());
  }
  return edges;
}

function closeOverCascades(cleared, edges) {
  const out = new Set(cleared);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [child, parents] of edges) {
      if (!out.has(child) && [...parents].some((p) => out.has(p))) { out.add(child); grew = true; }
    }
  }
  return out;
}

// Brace-match the callback whose `(` is at or after idx; returns [start, end) of its body.
function regionFrom(src, idx) {
  const i = src.indexOf('{', idx);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return [i, j + 1]; }
  }
  return null;
}

function tablesReferenced(text, tables) {
  const out = new Set();
  const needles = [
    /\bFROM\s+([a-z_][a-z0-9_]*)/gi,
    /\bJOIN\s+([a-z_][a-z0-9_]*)/gi,
    /INSERT INTO\s+([a-z_][a-z0-9_]*)/gi,
    /UPDATE\s+([a-z_][a-z0-9_]*)\s+SET/gi,
  ];
  for (const re of needles) {
    for (const m of text.matchAll(re)) {
      const t = m[1].toLowerCase();
      if (tables.has(t)) out.add(t);
    }
  }
  return out;
}

// Returns { cleared, unreadable } for one suite's reset.
function clearedBy(src, tables) {
  const cleared = new Set();
  for (const m of src.matchAll(/(?:DELETE FROM|TRUNCATE(?: TABLE)?)\s+([a-z_][a-z0-9_]*)/gi)) {
    cleared.add(m[1].toLowerCase());
  }
  const interpolated = /(?:DELETE FROM|TRUNCATE(?: TABLE)?)\s+\$\{/i.test(src);
  if (interpolated) {
    // The loop form: `for (const t of ['a','b']) DELETE FROM ${t}`. The needle sees a
    // placeholder, so the array literal's members are resolved instead. Two or more known
    // table names in one bracket is the signature of a reset list rather than of any array.
    let resolved = 0;
    for (const m of src.matchAll(/\[([^\][]*)\]/g)) {
      if (!/['"`]/.test(m[1])) continue;
      const names = [...m[1].matchAll(/['"`]([a-z_][a-z0-9_]*)['"`]/gi)]
        .map((x) => x[1].toLowerCase()).filter((t) => tables.has(t));
      if (names.length >= 2) { for (const t of names) { cleared.add(t); resolved++; } }
    }
    if (!resolved) return { cleared, unreadable: true };
  }
  return { cleared, unreadable: false };
}

function analyse() {
  const dbSrc = stripComments(fs.readFileSync(path.join(REPO, 'server', 'db.js'), 'utf8'));
  const tables = knownTables(dbSrc);
  const edges = cascadeEdges(dbSrc, tables);

  const suites = [];
  const unreadable = [];
  for (const f of fs.readdirSync(TEST_DIR).filter((x) => x.endsWith('.test.js')).sort()) {
    const src = stripComments(fs.readFileSync(path.join(TEST_DIR, f), 'utf8'));
    const { cleared, unreadable: bad } = clearedBy(src, tables);
    if (bad) { unreadable.push(f); continue; }
    if (!cleared.size) continue;

    let masked = src;
    for (const re of [/\bbefore\s*\(/g, /\bafter\s*\(/g]) {
      for (const m of [...masked.matchAll(re)]) {
        const r = regionFrom(masked, m.index);
        if (r) masked = masked.slice(0, r[0]) + ' '.repeat(r[1] - r[0]) + masked.slice(r[1]);
      }
    }

    const effective = closeOverCascades(cleared, edges);
    const touched = tablesReferenced(masked, tables);
    const missing = [...touched].filter((t) => !effective.has(t)).sort();
    suites.push({ file: f, cleared, effective, touched, missing });
  }
  return { tables, edges, suites, unreadable };
}

// ⚠ PRE-EXISTING GAPS, RECORDED BY NAME SO THE FENCE BINDS NEW WRITING IMMEDIATELY.
// This is the ROLE_ONLY_BASELINE pattern from scripts/citecheck.js: the list is today's
// measurement and the assertion is that it MUST NOT GROW. Named pairs, never a count —
// a count would let one gap close while another opened and report health it never observed.
// ⚠ IT MAY ONLY SHRINK. Adding a line here to make a red run green is the rubber-stamp
// failure; if a NEW pair appears, clear the table in that suite's reset instead.
// ⚠ AND THESE ARE NOT ALL BUGS. Most are `contractors` / `contractor_settings` re-seeded per
// test with ON CONFLICT DO NOTHING, which is harmless. They are listed because the fence
// reports COVERAGE, not consequence, and verifying each is its own job.
const KNOWN_GAPS = new Set([
  'attributionWiring.test.js|error_log',
  'brandingEndpoint.test.js|contractor_settings',
  'brandingEndpoint.test.js|contractors',
  'flaggedQueue.test.js|activity_log',
  'freezeNoticeAndReactivation.test.js|contractor_settings',
  'frozenAccount.test.js|contractor_settings',
  'invoicePaidWebhook.test.js|contractor_crm_settings',
  'jobberSyncRepair.test.js|contractor_settings',
  'jobberUserPicker.test.js|sessions',
  'jobberUserPicker.test.js|team_members',
  'pipelineSyncThrottle.test.js|contractor_crm_settings',
  'pipelineSyncThrottle.test.js|sync_state',
  'repClients.test.js|client_sales',
  'repClients.test.js|contacts',
  'repClients.test.js|pending_referrals',
  'repConversions.test.js|contractors',
  'repImportScope.test.js|contractors',
  'repRouteGuard.test.js|team_members',
  'requirePermission.test.js|team_members',
  'reservedPlatformSlugs.test.js|contractors',
  'saleGrouping.test.js|referral_conversions',
  'sessionBranding.test.js|contractor_settings',
  'sessionBranding.test.js|contractors',
  'teamCredentialRecovery.test.js|contractor_settings',
  'themeModeWriter.test.js|team_members',
  'unifiedForgotPin.test.js|contractor_settings',
  'unifiedLogin.test.js|contractor_settings',
  'unifiedLoginSchema.test.js|contractors',
]);

// The nine suites whose reset the parser cannot read. Recorded so that a NEW unreadable
// reset fails a case here instead of being silently skipped — an unannounced absence is
// this codebase's recurring failure mode.
const UNREADABLE_RESETS = [
  'adminInviteLinkFlags.test.js',
  'inviteLinkConvergence.test.js',
  'inviteTokenScanEvent.test.js',
  'inviteTokenSchema.test.js',
  'inviteTokenService.test.js',
  'inviteTokenSignup.test.js',
  'landingMarketingMode.test.js',
  'landingSkipPath.test.js',
  'linkGeneratorSweep.test.js',
];

describe('6c — a test reset list cannot silently miss a table', () => {
  const { tables, edges, suites, unreadable } = analyse();

  // ── non-vacuity: the derivation actually derived something ────────────────────
  it('derives the table list from db.js, and the derivation is not prose', () => {
    // A check whose failure mode has never been observed is a claim, not a check: these
    // four must be present or every later assertion is vacuous for want of a subject.
    for (const t of ['crm_request_facts', 'rep_request_sweep_failures',
      'client_rep_assignments', 'contractors']) {
      assert.equal(tables.has(t), true, `db.js must yield the table ${t}`);
    }
    // And the prose that polluted the first draft must be gone.
    for (const junk of ['is', 'add', 'the']) {
      assert.equal(tables.has(junk), false, `'${junk}' is a word from a comment, not a table`);
    }
    assert.ok(tables.size > 60, `expected the full schema, got ${tables.size} tables`);
  });

  it('resolves ON DELETE CASCADE, so clearing a parent counts as clearing the child', () => {
    // Without this the fence reports false positives. Proven on a real edge rather than
    // asserted: repImportScope clears dynamic_audiences and reads dynamic_audience_members.
    const parents = edges.get('dynamic_audience_members');
    assert.ok(parents, 'dynamic_audience_members must be recorded as a cascade child');
    assert.equal(parents.has('dynamic_audiences'), true);
    assert.ok(edges.size > 15, `expected the cascade graph, got ${edges.size} children`);
  });

  it('reads a real reset list, so a silent parse failure cannot read as coverage', () => {
    // requestAttribution.test.js carries the arc's widest literal reset. If the parser ever
    // stops finding it, every "no missing table" result below becomes vacuously true.
    const s = suites.find((x) => x.file === 'requestAttribution.test.js');
    assert.ok(s, 'the parser must find requestAttribution.test.js');
    assert.ok(s.cleared.size >= 20, `expected its ~21-table reset, read ${s.cleared.size}`);
    // ⚠ ANCHORED ON crm_request_facts, NOT ON rep_request_sweep_failures, DELIBERATELY. The
    // guard-proof for the fence below removes rep_request_sweep_failures from that reset; if
    // this case named the same table it would go red too, and an injection that trips two
    // assertions is reporting two things at once — only one of them about the fence.
    assert.equal(s.cleared.has('crm_request_facts'), true,
      'Commit 5 added the fact tables to that reset; if this fails the parse has drifted');
    assert.equal(s.touched.has('rep_request_sweep_failures'), true,
      'and it must be seen as TOUCHED — the read is in a file-level helper, not inside an it().\n' +
      'This is the property that makes the fence able to see 6b\'s own defect at all.');
  });

  it('sees every suite that has a reset at all', () => {
    assert.ok(suites.length > 90, `expected ~95 suites with a readable reset, got ${suites.length}`);
  });

  // ── THE FENCE ────────────────────────────────────────────────────────────────
  it('⚠ no suite touches a table its reset does not clear (outside the recorded gaps)', () => {
    const offenders = [];
    for (const s of suites) {
      for (const t of s.missing) {
        if (!KNOWN_GAPS.has(`${s.file}|${t}`)) offenders.push(`${s.file} touches ${t} but never clears it`);
      }
    }
    assert.deepEqual(offenders, [],
      'A table a suite touches per-test must be in that suite\'s reset, or a prior case\'s rows\n' +
      'leak into the next one. Add it to the reset (respecting foreign-key order) — do NOT add\n' +
      'a line to KNOWN_GAPS, which may only shrink.\n' + offenders.join('\n'));
  });

  it('the set of resets it cannot read is exactly the recorded one', () => {
    // A new unreadable reset means the fence silently stopped covering a file. Known absence
    // is recoverable; silent absence is not.
    assert.deepEqual(unreadable.sort(), [...UNREADABLE_RESETS].sort());
  });
});
