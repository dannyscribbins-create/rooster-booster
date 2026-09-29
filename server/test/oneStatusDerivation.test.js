'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 1 — ONE DERIVATION OF PIPELINE STATUS, AND AN EXPIRING INVENTORY
//
// Danny approved the N4 design 2026-09-29. This commit ships NO production change.
// It ships the fence, plus the inventory of what does not satisfy it yet — so that
// commits 3 and 4 are measured against a list that can only shrink.
//
// THE RULE THIS FENCE PROTECTS:
//   A client's pipeline status is decided in exactly ONE function, from SAVED FACTS,
//   and a client's facts are made complete at the moment its status is decided.
//   `decideFromFacts` (server/utils/attributionDecide.js) is that one function; it is
//   the only sanctioned caller of the classifier.
//
// ⚠ WHY THIS FILE EXISTS AT ALL, STATED PLAINLY. Three derivations of one value
// already disagree in production. Measured 2026-09-29 on accent-roofing-dev: of the
// 15 referred clients carrying both a `pipeline_cache` row and a `jobber_clients` row,
// SIX disagree, and in two of those the referrer is shown the LOWER value. Nothing
// failed; nothing could. The split is recorded as "accepted and temporary" in two
// source comments, and an accepted temporary state with no mechanism attached is how
// it stays for four months.
//
// ⚠ THE ALLOW-LIST IS THE DANGEROUS PART OF THIS FILE AND IT IS BUILT TO DIE.
// CLAUDE.md records that a KNOWN_GAPS list is how a fence stops meaning anything.
// Three things stop that here:
//   · every EXPIRING entry names the commit that deletes it;
//   · every entry is asserted to be LIVE — a stale entry FAILS, so the list cannot
//     outlive the thing it excuses (this is the closure half CLAUDE.md demands of any
//     tracking mechanism: it can record an arrival AND a departure);
//   · every entry pins its SPAN COUNT, so a listed function cannot quietly gain a
//     second write.
//
// ⚠ WHAT THIS FENCE CANNOT SEE — WRITTEN DOWN RATHER THAN ASSUMED AWAY.
//   · It matches a DIRECT call by name. A classifier reached through a helper, or
//     through a value passed as a callback, is invisible to it. Checked by hand once,
//     at this commit: the six call sites below are the only ones in `server/`.
//   · `enclosingRole()` resolves the nearest COLUMN-ZERO declaration — a function, a
//     `router.VERB(`, or a `const x = (`. A writer inside a nested closure resolves to
//     its outermost enclosing declaration, not to itself.
//   · It reads `server/` only. A write issued from a migration in `server/db.js` is in
//     scope; one issued from a script outside `server/` is not.
//
// ⚠ THE BEHAVIOURAL CROSS-SURFACE FENCE IS DELIBERATELY NOT HERE, AND THAT IS NOT AN
// OMISSION. The design's commit 1 sketch named one, asserting that the rep surface and
// the referrer surface report the same stage for one client. That assertion CANNOT BE
// GREEN TODAY — the two columns legitimately disagree until commit 4, which is the
// whole subject of N4. Shipping it now would mean either pinning the defect or marking
// it skipped, and a skipped test is a failure until explained (CLAUDE.md). It lands in
// commit 4, where it can pass for the right reason.
//
// ⚠ NO DATABASE. This suite reads source text only, so it seeds nothing, writes no
// table, and therefore adds nothing to any suite's reset list.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVER_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(__dirname, '..', '..');

// ⚠ NEEDLES ASSEMBLED FROM PIECES. The walk already excludes `server/test/`, which is
// the primary reason this file cannot report itself — but CLAUDE.md records a sweep that
// walked its own test file and named itself as the offender, so the second mechanism is
// cheap and kept. The prose in this header names these symbols repeatedly on purpose:
// a fence that stops reading the text an idiom gets copied from has a hole in it.
const FN_CLASSIFY = 'classify' + 'PipelineStatus';
const FN_DECIDE = 'decide' + 'FromFacts';
const FN_CAPTURE = 'capture' + 'ClientFacts';
const COL_STAGE = 'pipeline' + '_stage';
const COL_STATUS = 'pipeline' + '_status';

/**
 * Every `.js` file under `server/`, excluding this suite's own directory.
 * ⚠ WALKED, NEVER A TYPED LIST. Every sweep in this repo built from a hand-maintained
 * FILES list has gone stale without announcing it.
 */
function serverFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'test' && path.resolve(dir) === path.resolve(SERVER_ROOT)) continue;
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        out.push(full);
      }
    }
  })(SERVER_ROOT);
  return out;
}

/**
 * Strip comments WITHOUT moving any line or column.
 * ⚠ THIS IS NOT A STYLE CHOICE AND IT WAS A REAL DEFECT IN THIS FILE'S OWN FIRST DRAFT.
 * The obvious strip — deleting the comment text — shifted every line below it, so the
 * harness reported `pipelineSync.js:215` for a call site that is really at `:235`. A
 * fence whose findings name the wrong line is worse than none: the reader follows the
 * number, sees unrelated code, and concludes the fence is broken. Comments become
 * blanks of equal length, so line AND column survive.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

const relPath = (f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/**
 * One named function's body, by brace matching from its declaration.
 * ⚠ THIS EXISTS BECAUSE A FILE-SCOPED NEEDLE FLAGGED CORRECT CODE ON THIS SUITE'S FIRST
 * RUN. `crm/pipelineSync.js` contains a legitimate `app_user_%` cleanup — it deletes the
 * signup placeholder row once the real Jobber client is upserted — and a whole-file
 * assertion reported it as the classifier "knowing about" app_user. CLAUDE.md's rule is
 * reword or narrow, NEVER exempt the file: an exemption would have removed the fence's
 * reach into the one file it most needs to read.
 */
function functionBody(src, name) {
  const decl = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = decl.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * The nearest COLUMN-ZERO declaration above `line` — a named function, a route, or a
 * `const x = (`. Roles, not line numbers: a function name does not drift, and CLAUDE.md
 * forbids pinning a moving target by number.
 */
function enclosingRole(src, line) {
  const lines = src.split('\n');
  for (let i = line - 1; i >= 0; i--) {
    const text = lines[i];
    let m = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/.exec(text);
    if (m) return 'function ' + m[1];
    m = /^router\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)/.exec(text);
    if (m) return 'route ' + m[1].toUpperCase() + ' ' + m[2];
    m = /^(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/.exec(text);
    if (m) return 'const ' + m[1];
  }
  return '(top level)';
}

/**
 * Call sites of a named function, excluding its own `function NAME(` definition.
 * ⚠ AN IMPORT IS NOT A CALL, AND CONFLATING THEM MISCOUNTS. CLAUDE.md records a fence
 * whose author expected 3 for "one import plus two call sites" and got 2, because a
 * destructured import carries no paren. This needle requires the paren, so a destructure
 * is correctly not a call — and `webhooks/jobber.js` imports the classifier and never
 * calls it, which is exactly the case that would break a looser needle.
 */
function callSites(fnName) {
  const found = [];
  for (const file of serverFiles()) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const re = new RegExp('(function\\s+)?' + fnName + '\\s*\\(', 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m[1]) continue; // the definition
      const line = lineOf(src, m.index);
      found.push({ file: relPath(file), line, role: enclosingRole(src, line) });
    }
  }
  return found;
}

/**
 * Every quoted span in a file, with its starting line.
 * ⚠ SPANS, NOT LINE WINDOWS. A window heuristic around a column name reads neighbouring
 * statements and reports a write that belongs to a different query — the defect
 * CLAUDE.md records as 21 false flags in the font migration.
 */
function quotedSpans(src) {
  const out = [];
  const re = /`[^`]*`|'[^'\n]*'|"[^"\n]*"/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push({ text: m[0], line: lineOf(src, m.index) });
  return out;
}

/**
 * Spans that WRITE one of the two displayed columns.
 * ⚠ VERB-ANCHORED, BECAUSE ALMOST EVERY REP ROUTE SELECTS THESE COLUMNS. A needle that
 * flagged a read would report `routes/rep.js`'s book query and be carved out within a
 * week — CLAUDE.md's recorded fate of any check that reports plausible findings. The
 * paired negative below proves a SELECT cannot trip it.
 */
function statusWriteSpans() {
  const found = [];
  for (const file of serverFiles()) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const span of quotedSpans(src)) {
      const touchesColumn = span.text.includes(COL_STAGE) || span.text.includes(COL_STATUS);
      if (!touchesColumn) continue;
      if (!/\bINSERT\s+INTO\b|\bUPDATE\s+[a-z_]+\s+SET\b/i.test(span.text)) continue;
      found.push({ file: relPath(file), line: span.line, role: enclosingRole(src, span.line) });
    }
  }
  return found;
}

const key = (f) => f.file + ' :: ' + f.role;

// ── THE SANCTIONED DERIVATION ────────────────────────────────────────────────
const SANCTIONED_CALLER = 'server/utils/attributionDecide.js :: function ' + FN_DECIDE;

// ── THE EXPIRING INVENTORY — each entry names the commit that DELETES it ──────
const EXPIRING_CLASSIFIERS = [
  {
    key: 'server/cron/jobs/jobberIncrementalSync.js :: function runForContractor',
    spans: 1,
    removedBy: 'N4 commit 3 — the incremental sync captures, then decides',
    why: 'classifies from the LIVE Jobber object; it already holds the capture-shape client',
  },
  {
    key: 'server/crm/pipelineSync.js :: function syncSingleClient',
    spans: 1,
    removedBy: 'N4 commit 4 — syncSingleClient decides from the facts it already captured',
    why: 'classifies from the LIVE object ten lines above a capture that already happened',
  },
];

// ── PERMANENT CARVE-OUTS — ruled, with the ruling named ──────────────────────
const PERMANENT_CLASSIFIERS = [
  {
    key: 'server/jobs/fullJobberImport.js :: function classifyImportedClientStage',
    spans: 1,
    why: 'Danny ruling 6 (2026-09-29) — the import classifies live as an explicit SEED. '
      + 'Building a capture-shape client from Step F recreates the three-shapes trap and '
      + 'still would not produce a complete history.',
  },
  {
    key: 'server/jobs/repImportScope.js :: function writeStages',
    spans: 1,
    why: 'FILL-ONLY and UPDATE-only, and it sees no invoices at all, so its ceiling is '
      + 'sold. It cannot regress a stored value.',
  },
  {
    key: 'server/jobs/repNamesBackfill.js :: function findRowlessRepClients',
    spans: 1,
    why: 'derives from saved facts already, for rowless clients only; INSERT-only with '
      + 'ON CONFLICT DO NOTHING, and capped at sold.',
  },
];

// ── WRITERS ──────────────────────────────────────────────────────────────────
// Sanctioned: the file captures facts AND decides from them before writing.
const SANCTIONED_WRITERS = [
  { key: 'server/routes/webhooks/jobber.js :: function upsertAndTagClient', spans: 1 },
  { key: 'server/routes/webhooks/jobber.js :: function handleStageWebhook', spans: 1 },
  { key: 'server/utils/requestAttribution.js :: function writeStage', spans: 1 },
];

const EXPIRING_WRITERS = [
  {
    key: 'server/cron/jobs/jobberIncrementalSync.js :: function runForContractor',
    spans: 1,
    removedBy: 'N4 commit 3',
    why: 'writes a live-classified stage; COALESCEd, so a null cannot erase a good value',
  },
  {
    key: 'server/crm/pipelineSync.js :: function syncSingleClient',
    spans: 2,
    removedBy: 'N4 commit 4',
    why: 'TWO spans: the pipeline_cache upsert (the live-classified status, which commit 4 '
      + 'repoints at the facts) AND the flagged_referrals insert, which COPIES the value '
      + 'into another table rather than deriving it. The count is pinned so a THIRD write '
      + 'cannot hide behind this entry.',
  },
];

const PERMANENT_WRITERS = [
  {
    key: 'server/jobs/fullJobberImport.js :: function runFullJobberImport',
    spans: 1,
    why: 'the SEED write (Danny ruling 6); COALESCEd',
  },
  {
    key: 'server/jobs/repImportScope.js :: function writeStages',
    spans: 1,
    why: 'FILL-ONLY UPDATE — WHERE ' + COL_STAGE + ' IS NULL',
  },
  {
    key: 'server/jobs/repImportScope.js :: function nameMissingClients',
    spans: 1,
    why: 'INSERT ... ON CONFLICT DO NOTHING, carrying the fill-only stage from writeStages',
  },
  {
    key: 'server/routes/referrer.js :: route POST /api/signup/verify-email',
    spans: 1,
    why: "Danny ruling 9 (2026-09-29) — writes the LITERAL 'app_user', which is not a stage "
      + 'and has no fact-derived equivalent. Excluded from derivation entirely.',
  },
];

const allowedClassifiers = new Map(
  [...EXPIRING_CLASSIFIERS, ...PERMANENT_CLASSIFIERS].map((e) => [e.key, e])
);
const allowedWriters = new Map(
  [...SANCTIONED_WRITERS, ...EXPIRING_WRITERS, ...PERMANENT_WRITERS].map((e) => [e.key, e])
);

/** Group findings by `file :: role`. */
function countByKey(findings) {
  const counts = new Map();
  for (const f of findings) counts.set(key(f), (counts.get(key(f)) || 0) + 1);
  return counts;
}

describe('N4 commit 1 — the classifier has one sanctioned caller', () => {
  it('every call site is sanctioned, expiring, or a named permanent carve-out', () => {
    const sites = callSites(FN_CLASSIFY);
    const offenders = sites
      .filter((s) => key(s) !== SANCTIONED_CALLER && !allowedClassifiers.has(key(s)))
      .map((s) => `${s.file}:${s.line} — ${s.role}`);
    assert.deepEqual(
      offenders, [],
      `${FN_CLASSIFY} may only be called by ${FN_DECIDE}. Unlisted caller(s):\n  `
      + offenders.join('\n  ')
      + `\nIf this is a new writer, it must capture facts and call ${FN_DECIDE} instead.`
    );
  });

  it('NON-VACUITY: the needle actually matches the sanctioned caller', () => {
    // Without this, a needle matching NOTHING passes identically to a codebase with one
    // derivation — and every assertion above it would be about an empty set.
    const sites = callSites(FN_CLASSIFY);
    assert.ok(
      sites.some((s) => key(s) === SANCTIONED_CALLER),
      `harness: the needle must find ${FN_DECIDE}'s own call to ${FN_CLASSIFY}; found `
      + sites.map(key).join(' | ')
    );
  });

  it('NON-VACUITY: the walk reaches crm/, cron/, jobs/, routes/ and utils/', () => {
    // A walk that stopped short would exonerate every file it never opened.
    const dirs = new Set(serverFiles().map((f) => relPath(f).split('/')[1]));
    for (const d of ['crm', 'cron', 'jobs', 'routes', 'utils']) {
      assert.ok(dirs.has(d), `harness: the walk must reach server/${d}/`);
    }
  });

  it('DISCRIMINATOR: an import is not counted as a call site', () => {
    // webhooks/jobber.js destructures the classifier and never calls it. A looser needle
    // would report it, the entry would be added to the allow-list, and the list would
    // then be excusing something that is not happening.
    const sites = callSites(FN_CLASSIFY);
    const inWebhooks = sites.filter((s) => s.file === 'server/routes/webhooks/jobber.js');
    assert.deepEqual(
      inWebhooks.map((s) => `${s.file}:${s.line}`), [],
      'the webhook router imports the classifier but must not CALL it'
    );
    const src = fs.readFileSync(
      path.join(SERVER_ROOT, 'routes', 'webhooks', 'jobber.js'), 'utf8'
    );
    assert.ok(
      new RegExp('\\{[^}]*' + FN_CLASSIFY + '[^}]*\\}\\s*=\\s*require').test(src),
      'harness: the import this case discriminates against must still exist — if it was '
      + 'removed, this discriminator is no longer being exercised and should be re-pointed'
    );
  });

  it('CLOSURE: every listed classifier entry is still live — a stale entry fails', () => {
    // The half CLAUDE.md says tracking mechanisms always miss: a list that can only grow
    // stops being a list of open work. An entry whose call site is gone must be DELETED.
    const counts = countByKey(callSites(FN_CLASSIFY));
    const stale = [];
    for (const entry of [...EXPIRING_CLASSIFIERS, ...PERMANENT_CLASSIFIERS]) {
      const actual = counts.get(entry.key) || 0;
      if (actual !== entry.spans) {
        stale.push(`${entry.key} — listed ${entry.spans}, found ${actual}`);
      }
    }
    assert.deepEqual(
      stale, [],
      'the allow-list has drifted from the code. A call site that is GONE means the entry '
      + 'must be deleted; a count that ROSE means a new call is hiding behind an entry:\n  '
      + stale.join('\n  ')
    );
  });

  it('every expiring entry names the commit that deletes it', () => {
    for (const entry of EXPIRING_CLASSIFIERS) {
      assert.match(
        entry.removedBy, /N4 commit \d/,
        `${entry.key} must name the commit that removes it, not merely be listed`
      );
    }
    for (const entry of PERMANENT_CLASSIFIERS) {
      assert.ok(entry.why && entry.why.length > 40, `${entry.key} must carry its reason`);
    }
  });
});

describe('N4 commit 1 — every writer of a displayed status is accounted for', () => {
  it('every write span is sanctioned, expiring, or a named permanent carve-out', () => {
    const spans = statusWriteSpans();
    const offenders = spans
      .filter((s) => !allowedWriters.has(key(s)))
      .map((s) => `${s.file}:${s.line} — ${s.role}`);
    assert.deepEqual(
      offenders, [],
      `a new writer of ${COL_STAGE} / ${COL_STATUS} must capture facts and derive from `
      + `them. Unlisted writer(s):\n  ` + offenders.join('\n  ')
    );
  });

  it('NON-VACUITY: the writer needle matches the known capture doors', () => {
    const spans = statusWriteSpans();
    for (const expected of SANCTIONED_WRITERS.map((w) => w.key)) {
      assert.ok(
        spans.some((s) => key(s) === expected),
        `harness: the writer needle must still find ${expected}; found `
        + [...new Set(spans.map(key))].join(' | ')
      );
    }
  });

  it('PAIRED NEGATIVE: a SELECT of the column is not flagged', () => {
    // routes/rep.js SELECTs the stage on every book query and is a correct read. A fence
    // that reported it would be switched off within a month.
    const spans = statusWriteSpans();
    assert.deepEqual(
      spans.filter((s) => s.file === 'server/routes/rep.js').map((s) => s.line), [],
      'the verb anchor has broken — rep.js only reads these columns'
    );
    const repSrc = fs.readFileSync(path.join(SERVER_ROOT, 'routes', 'rep.js'), 'utf8');
    assert.ok(
      repSrc.includes(COL_STAGE),
      'harness: rep.js must still mention the column, or this negative proves nothing'
    );
  });

  it('PAIRED NEGATIVE: the fill-only rep writers ARE still seen by the raw scan', () => {
    // If the scan stopped detecting them, their carve-outs would be silently unnecessary
    // and the fence would have gone blind without anything saying so.
    const seen = new Set(statusWriteSpans().map(key));
    for (const entry of PERMANENT_WRITERS) {
      assert.ok(
        seen.has(entry.key),
        `${entry.key} is carved out but no longer detected — the discriminator has rotted`
      );
    }
  });

  it('CLOSURE: every listed writer entry is still live, at its pinned span count', () => {
    const counts = countByKey(statusWriteSpans());
    const stale = [];
    for (const entry of [...SANCTIONED_WRITERS, ...EXPIRING_WRITERS, ...PERMANENT_WRITERS]) {
      const actual = counts.get(entry.key) || 0;
      if (actual !== entry.spans) stale.push(`${entry.key} — listed ${entry.spans}, found ${actual}`);
    }
    assert.deepEqual(stale, [], 'writer allow-list has drifted:\n  ' + stale.join('\n  '));
  });

  it('every expiring writer names the commit that deletes it', () => {
    for (const entry of EXPIRING_WRITERS) {
      assert.match(entry.removedBy, /N4 commit \d/, `${entry.key} must name its removing commit`);
    }
  });
});

describe('N4 commit 1 — the vocabulary the derivation may produce', () => {
  it('the five stage values are exactly the CHECK constraint values', () => {
    // The derivation's output and the column's constraint must not drift apart: a sixth
    // value returned by the classifier would be a runtime constraint violation on write.
    const db = fs.readFileSync(path.join(SERVER_ROOT, 'db.js'), 'utf8');
    const m = new RegExp(
      'CHECK\\s*\\(\\s*' + COL_STAGE + '\\s+IN\\s*\\(([^)]*)\\)', 'i'
    ).exec(db);
    assert.ok(m, `harness: the ${COL_STAGE} CHECK constraint must still exist in db.js`);
    const values = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort();
    assert.deepEqual(
      values, ['inspection', 'lead', 'not_sold', 'paid', 'sold'],
      'the five-value vocabulary moved; the classifier and every label map must move with it'
    );
  });

  it("'app_user' is a pipeline_cache value only and is never a stage", () => {
    // Danny ruling 9. It has no Jobber client and no fact-derived equivalent; the three
    // live rows would all derive to 'lead' if it were ever fed through the derivation.
    const db = fs.readFileSync(path.join(SERVER_ROOT, 'db.js'), 'utf8');
    const m = new RegExp(
      'CHECK\\s*\\(\\s*' + COL_STAGE + '\\s+IN\\s*\\(([^)]*)\\)', 'i'
    ).exec(db);
    assert.ok(m, 'harness: the CHECK constraint must still exist');
    assert.ok(
      !m[1].includes('app_user'),
      "'app_user' must never become a valid " + COL_STAGE
    );
    // ⚠ SCOPED TO THE CLASSIFIER'S OWN BODY, NOT THE FILE. See functionBody()'s note:
    // the file legitimately contains an `app_user_%` placeholder cleanup, and a
    // whole-file needle reported that correct code on this suite's first run.
    const body = functionBody(
      stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'crm', 'pipelineSync.js'), 'utf8')),
      FN_CLASSIFY
    );
    assert.ok(body, `harness: ${FN_CLASSIFY}'s body must be locatable`);
    assert.ok(
      !body.includes('app_user'),
      'the classifier must not know about app_user — it is written as a literal at signup'
    );
  });
});
