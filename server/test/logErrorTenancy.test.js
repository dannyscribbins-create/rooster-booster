'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// EVERY `logError` CALL SAYS WHICH TENANT IT BELONGS TO (post-N4 cleanup D)
//
// Danny's rulings (2026-10-03):
//   1. the dead `req.session` fallback arm is DELETED — no session middleware exists, it never fired;
//   2. an error with genuinely no tenant is filed under an explicit `'platform'`, never a fake
//      contractor id;
//   4. a `logError` call with neither a `contractorId` nor an explicit platform marker FAILS a test,
//      naming the file and line.
//
// ⚠ THE EXPLANATION LIVES HERE AND NOT IN THE PRODUCTION FILES, AND THAT PLACEMENT IS DELIBERATE
// RATHER THAN TIDY. D1's first writing put a 33-line comment block at the TOP of `errorLogger.js` —
// a citation-rotting edit, the exact shape this repo recorded from `db.js`, where nine lines rotted
// 137 citations and one line rotted 15. Six citations point into `errorLogger.js` below that
// insertion point. Collapsed to a ONE-LINE constant replacing the blank line after the requires, the
// net delta is **0** and **not one of the six moved** (verified line by line against HEAD).
// ⚠ AND D3 MADE THE SAME MISTAKE AGAIN, IN A DIFFERENT FILE, WHICH IS WHY THIS NOTE IS NOW GENERAL.
// Three short comment blocks in `crm/jobber.js` — two and two and four lines — rotted **17
// citations across six documents**, because that file is heavily cited and the insertions sat near
// its top. Collapsed to trailing one-liners pointing here: **net delta 0, and `citecheck
// --changed-files` fell from 17 LIKELY ROTTED to 0.** ⚠ **The rule is not "write shorter
// comments" — it is that a cleanup commit's explanation belongs in the fence that enforces it**,
// where it costs nobody a citation and the next reader finds it beside the assertions.
//
// ⚠ THE DEFAULT USED TO BE THE STRING `'accent-roofing'`, WHICH IS NOT A TENANT — IT IS A CONTRACTOR
// ID THAT DOES NOT EXIST. The dev tenant is `accent-roofing-dev`, so every contractor-less error was
// filed against a row no `contractors` record matches. **Measured read-only 2026-10-03: 23
// `error_log` rows carry it across 1,074 occurrences, and all 23 match no contractor.** A fake id is
// worse than an honest one — it reads as a real tenant's problem, so a defect in a shared util looked
// like a defect in Accent's account.
//
// ⚠ `'platform'` IS NOT A CONTRACTOR AND MUST NEVER BECOME ONE. `contractors.id` is `TEXT PRIMARY
// KEY` with no format constraint, so nothing structurally stops someone creating it — which is why
// the name is fenced below and why the constant is EXPORTED rather than spelled at each site.
// ⚠ Checked rather than assumed: the only `INSERT INTO contractors` outside tests is `db.js`'s
// first-boot seed, and production holds exactly one contractor, so no application path creates it.
//
// ⚠ AND DELETING THE DEAD ARM IS NOT COSMETIC, WHICH IS THE PART WORTH KEEPING. The chain read
// `contractorId || req?.session?.contractorId || <literal>`, and **nothing in `server/` has ever
// assigned `req.session`** — there is no session middleware, and the `verify*Session` helpers RETURN
// a descriptor rather than attaching one. While that arm was there, every reader believed a
// logged-in request was already attributed correctly, **and 311 of the 376 sites were counted as
// fine on exactly that belief.** That is why D grew from 65 sites to 376.
// ⚠ ITS WIDTH IS 1 AND THE SPLIT IS HONEST: restoring the arm reds the SOURCE case only. The
// behavioural case stays green **because the arm genuinely never fires**, so no fixture can tell the
// two states apart — the property is a source property, and saying otherwise would overstate it.
//
// ⚠ WHAT READS THIS COLUMN, SAID PLAINLY BECAUSE IT BOUNDS RULING 2: **nothing in the application
// does.** `error_log` is written by `logError` and read by no query in `server/` — the only consumers
// are the alert email, which prints `Contractor: <id>`, and a human running SQL. So there is no
// tenant-scoped error query to exclude `'platform'` from, and ruling 2's second half has no code to
// check. A human filtering by a real contractor id simply no longer sees platform-level rows.
//
// ⚠ THE ALLOW-LIST IS KEYED BY FILE WITH A PINNED COUNT, NOT BY SITE, AND THAT IS A DELIBERATE
// TRADE. There were 376 non-compliant sites across 42 files when D1 wrote this and 270 across 15
// after D4; a list of that many entries would be unreadable and nobody would maintain it.
// Per file with an exact count gives the same two protections that matter:
// a file NOT listed must be at zero, and a listed file whose count CHANGES fails — so a new
// non-compliant call cannot hide inside an allow-listed file, and a batch that fixes sites must come
// here and say so.
//
// ⚠ AN ALLOW-LIST IS NORMALLY HOW A FENCE DIES. The three things stopping that are the same three
// `oneStatusDerivation.test.js` uses: every entry NAMES THE BATCH that deletes it; every entry is
// asserted LIVE, so a file that reaches zero must be REMOVED rather than lingering; and the count is
// exact rather than a ceiling.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { initTestDb } = require('./setup');
const { seedContractor } = require('./helpers');
const { logError, PLATFORM_TENANT } = require('../middleware/errorLogger');

const SERVER_ROOT = path.join(__dirname, '..');

/**
 * Files that still have `logError` calls carrying no tenant, with the EXACT count and the batch that
 * clears them. Measured 2026-10-04 after batch D4: **270 sites across 15 files**.
 * The arc so far: 376/42 at D1 → 349/32 after D2 → 309/22 after D3 → 270/15 after D4.
 * D2 closed 27 of its 28 (the 28th moved to D5); D3 closed 40 of its 41 (the 41st moved to
 * RECON); D4 closed 39 of its 70 and moved **31 to D5**, because every one of those sits in a
 * handler that verifies a session and passes a real `req` — D5's mechanism, not threading.
 *
 * ⚠ TO CHANGE A NUMBER HERE YOU MUST BE FIXING SITES. A count that rises fails; a count that falls
 * fails until it is updated; a file that reaches zero must be DELETED from this object.
 */
const EXPIRING_BY_FILE = {
  // ── batch D2: CLOSED 2026-10-03. Ten files reached zero and are DELETED from this object, which
  //    is what the CLOSURE case below requires — a file left pinned at 0 fails.
  //    The ONE survivor is retagged D5 rather than carried as D2, because its tenant cannot be
  //    hand-threaded: `expressErrorHandler` is generic Express middleware holding only the
  //    request, which is exactly what D5's request-attached value is for.
  'middleware/errorLogger.js': { sites: 1, batch: 'D5' },
  // ── batch D3: CLOSED 2026-10-03. Ten files reached zero and are DELETED from this object.
  //    ⚠ THE ONE SURVIVOR IS TAGGED `RECON`, NOT `D3`, BECAUSE D3 IS NOT WHAT CLEARS IT.
  //    `sendAdminNotification`'s `contractorId` parameter DEFAULTS to the phantom
  //    `'accent-roofing'` and all six callers omit it, so threading it would file errors under a
  //    contractor that does not exist — the defect this whole batch closes. Clearing it means
  //    changing six call sites, which changes WHICH contractor's notification settings are read,
  //    i.e. where live email goes. That belongs to the contractor-id reconciliation wave.
  //    ⚠ An entry must name the batch that DELETES it; naming `D3` here would have been a lie the
  //    CLOSURE case cannot catch, because the count would still have been right.
  'utils/notificationEmail.js': { sites: 1, batch: 'RECON' },
  // ── batch D4: CLOSED 2026-10-04. Seven files reached zero and are DELETED from this object.
  //    ⚠ THE FOUR SURVIVORS ARE RETAGGED D5, AND THAT IS THE RULING RATHER THAN A SHORTFALL.
  //    Every one of their 31 sites sits inside a handler that calls a verify*Session helper AND
  //    passes a real `req` — measured, not assumed — so D5's request-attached value labels them
  //    with zero edits. Hand-threading them now would build the wrong mechanism one batch early
  //    and then have to be unpicked.
  'routes/account.js': { sites: 16, batch: 'D5' },
  'routes/rep.js': { sites: 4, batch: 'D5' },
  'routes/session.js': { sites: 2, batch: 'D5' },
  'routes/stripe.js': { sites: 9, batch: 'D5' },
  // ── batch D5: the referrer surface ──
  'routes/referrer.js': { sites: 69, batch: 'D5' },
  // ── batch D6: admin/index.js ──
  'routes/admin/index.js': { sites: 57, batch: 'D6' },
  // ── batch D7: admin/campaigns.js ──
  'routes/admin/campaigns.js': { sites: 57, batch: 'D7' },
  // ── batch D8: the remaining admin routers ──
  'routes/admin/cashouts.js': { sites: 3, batch: 'D8' },
  'routes/admin/contacts.js': { sites: 13, batch: 'D8' },
  'routes/admin/metrics.js': { sites: 3, batch: 'D8' },
  'routes/admin/notifications.js': { sites: 4, batch: 'D8' },
  'routes/admin/referrers.js': { sites: 6, batch: 'D8' },
  'routes/admin/team.js': { sites: 25, batch: 'D8' },
};

// ⚠ `RECON` IS NOT A CLEANUP-D BATCH AND THAT IS THE POINT OF LISTING IT SEPARATELY. It names the
// deferred contractor-id reconciliation wave, for the one site whose tenant cannot be supplied
// without changing where live email goes (see `utils/notificationEmail.js` below). Admitting it as
// a known batch keeps the naming case honest; the alternative was tagging it `D3`, which would have
// claimed a batch clears a file it does not — a lie the CLOSURE case cannot catch, because the
// COUNT would still have been right.
// ⚠ DO NOT add further names here to park work. `RECON` has a tracked owner on
// PRE_LAUNCH_CHECKLIST.md; a batch name with no owner is how an allow-list becomes a graveyard.
const KNOWN_BATCHES = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'RECON'];

/** Comment-stripped, LINE-PRESERVING, so a reported line number is the real one. */
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock.split('\n').map((line) => {
    const i = line.indexOf('//');
    if (i < 0) return line;
    const before = line.slice(0, i);
    // Only treat `//` as a comment when it is not inside a string literal.
    const balanced = ["'", '"', '`'].every((q) => (before.split(q).length - 1) % 2 === 0);
    return balanced ? before + ' '.repeat(line.length - before.length) : line;
  }).join('\n');
}

/** Every .js under server/, excluding the test directory. */
function serverFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'test' || e.name === 'node_modules') continue;
        walk(path.join(dir, e.name));
        continue;
      }
      if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
    }
  };
  walk(SERVER_ROOT);
  return out;
}

/** The text of a `logError(...)` call, by matching parens from its opening one. */
function callExtent(src, fromIndex) {
  const open = src.indexOf('(', fromIndex);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length && i < open + 4000; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open, open + 400);
}

/**
 * Does this call name a tenant? True for `contractorId: x` AND for the ES6 shorthand
 * `{ req, error, contractorId }`.
 *
 * ⚠ SHORTHAND IS THE COMMON FORM AND MISSING IT PRODUCES A PLAUSIBLE WRONG ANSWER. A `contractorId\s*:`
 * needle reported **1** tenant-carrying site out of 460 when the real figure is 84 — and that wrong
 * number would have made this whole fence look like it had almost nothing to allow-list.
 */
function namesATenant(extent) {
  return /\bcontractorId\s*(?::|,|\})/.test(extent);
}

/** Every `logError(` site with no tenant: { rel, line }. */
function untenantedSites() {
  const out = [];
  for (const abs of serverFiles()) {
    const rel = path.relative(SERVER_ROOT, abs).replace(/\\/g, '/');
    const src = stripComments(fs.readFileSync(abs, 'utf8'));
    const re = /\blogError\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (namesATenant(callExtent(src, m.index))) continue;
      out.push({ rel, line: src.slice(0, m.index).split('\n').length });
    }
  }
  return out;
}

let pool;
let platformRowsAtBaseline;

// ⚠ `contractors` IS TOUCHED IN `before()` ONLY, AND THAT IS THE 6c RESET FENCE'S OWN ANSWER RATHER
// THAN A DODGE. The first writing seeded the tenant inside a case and read the table inside another,
// so `testResetCoverage.test.js` failed: *"logErrorTenancy.test.js touches contractors but never
// clears it."* ⚠ Its prescribed fix — add the table to the per-test reset — is the right fix for
// state a suite MUTATES per case, and this suite does not: the tenant is one row, created once,
// never changed, and the collision check is a read of a baseline fact. Clearing `contractors` per
// test would also drag its FK chain (`titles` first, the shape this repo has already recorded as a
// hook fault that fails every case including ones with no database dependency).
// ⚠ **`KNOWN_GAPS` WAS NOT WIDENED** — the fence's message forbids that, and the baseline placement
// is a real property of the suite rather than an exemption from one.
before(async () => {
  pool = await initTestDb();

  // The PAIRED POSITIVE's tenant: proves an explicit contractorId beats the default.
  await seedContractor(pool, 'd1-real-tenant');

  // ⚠ READ HERE, ASSERTED BELOW. `'platform'` must never be a contractor row, and that is a fact
  // about the database rather than per-case state — so the read belongs with the baseline and the
  // assertion stays in a named case where a failure says what broke.
  platformRowsAtBaseline = (await pool.query(
    `SELECT COUNT(*)::int AS n FROM contractors WHERE id = $1`, [PLATFORM_TENANT])).rows[0].n;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D — the platform tenant is explicit, and is not a contractor', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM error_log');
  });

  it('the exported constant is the literal string the column will hold', () => {
    assert.equal(PLATFORM_TENANT, 'platform');
  });

  it('[RED before the fix] a logError with NO contractor files under platform, not a fake id', async () => {
    await logError({
      req: { baseUrl: '', path: '/d1-no-tenant', method: 'GET' },
      error: new Error('d1 untenanted'),
      source: 'd1-test',
      alert: false,
    });
    const { rows } = await pool.query(
      `SELECT contractor_id FROM error_log WHERE source = 'd1-test'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].contractor_id, PLATFORM_TENANT);
    assert.notEqual(rows[0].contractor_id, 'accent-roofing',
      'still filed under the phantom contractor id');
  });

  it('PAIRED POSITIVE: an explicit contractorId still wins over the default', async () => {
    // Without this, a default that overwrote every caller would satisfy the case above.
    // The tenant is seeded once in `before()` — see the note there for why, not in a `beforeEach`.
    await logError({
      req: { baseUrl: '', path: '/d1-with-tenant', method: 'GET' },
      error: new Error('d1 tenanted'),
      source: 'd1-test-tenanted',
      contractorId: 'd1-real-tenant',
      alert: false,
    });
    const { rows } = await pool.query(
      `SELECT contractor_id FROM error_log WHERE source = 'd1-test-tenanted'`);
    assert.equal(rows[0].contractor_id, 'd1-real-tenant');
  });

  it('⚠ `platform` is NOT a contractor id, and must never become one', () => {
    // ⚠ `contractors.id` is TEXT PRIMARY KEY with NO format constraint, so nothing structurally
    // prevents this row existing. Checked rather than assumed: the only `INSERT INTO contractors`
    // outside tests is `db.js`'s first-boot seed, and production holds exactly one contractor.
    // The count is taken in `before()` — see the note there for why the read is not per-test.
    // ⚠ MEASURED, AND THE MEASUREMENT IS RECORDED HERE INSTEAD OF THE REASONING IT WAS WRITTEN ON.
    // Rewriting this as `assert.equal(0, 0, …)` reds NOTHING — width 0. That reads like a hole and is
    // not one: that injection does not reintroduce a defect, it DELETES the test, and no assertion
    // can catch its own removal. The discriminating injection is a real collision — seeding a
    // `contractors` row with this id in `before()` — and that reds exactly this case. ⚠ The opposite
    // direction is already covered for free: if the `before()` read stops happening the variable is
    // `undefined`, and `assert.equal(undefined, 0)` FAILS rather than passing quietly.
    assert.equal(platformRowsAtBaseline, 0,
      `a contractor with id "${PLATFORM_TENANT}" exists — the reserved platform value now collides `
      + 'with a real tenant, and platform-level errors would be filed against it');
  });

  it('⚠ the DEAD `req.session` arm is gone (ruling 1) and must not come back', () => {
    // ⚠ NOTHING IN `server/` HAS EVER ASSIGNED `req.session` — no session middleware exists and the
    // `verify*Session` helpers RETURN a descriptor. The arm never fired, and while it was there it
    // made ~311 call sites look correctly attributed. A source assertion is the only way to pin an
    // absence that no behaviour can demonstrate.
    const src = stripComments(
      fs.readFileSync(path.join(SERVER_ROOT, 'middleware', 'errorLogger.js'), 'utf8'));
    assert.ok(!/req\?\.session/.test(src),
      'the dead req.session fallback is back in errorLogger.js');
    assert.ok(!/'accent-roofing'/.test(src),
      'the phantom contractor literal is back in errorLogger.js');
    // NON-VACUITY: the needles must be able to match something in this file.
    assert.ok(/PLATFORM_TENANT/.test(src), 'harness: the file should name the platform constant');
  });

  it('and NO NEW file defaults a tenant to the phantom literal', () => {
    // ⚠ THIS FENCE FOUND TWO SITES THE logError ENUMERATION COULD NOT SEE, AND NEITHER IS D's TO FIX.
    // The enumeration asked "which `logError` calls carry no tenant"; this asks "who DEFAULTS a tenant
    // to the phantom id anywhere", which is a wider and different question. Danny's scope fence for D
    // is explicit — D is ONLY about which contractor NEW error reports are filed under — so these are
    // recorded here and filed under the deferred contractor-id reconciliation wave.
    // ⚠ THE LIST IS ASSERTED LIVE, so when that wave fixes one, THIS ENTRY FAILS and must be deleted.
    // An allow-list that outlives its subject is a permanent exemption nobody re-reads.
    const DEFERRED = {
      // Resolves a tenant for a Jobber PIPELINE FETCH, not for error reporting. A legacy-path call
      // would query the wrong tenant's pipeline — a real defect, and reconciliation-wave work.
      'crm/jobber.js': 'fetchPipelineForReferrer — pipeline fetch, not error reporting',
      // The first-boot seed, and it reads the contractors table FIRST. On a genuinely fresh
      // deployment this literal is the correct id, so it is not a phantom there at all.
      'db.js': 'first-boot seed; reads contractors first and only falls back on an empty table',
    };

    const offenders = [];
    for (const abs of serverFiles()) {
      const rel = path.relative(SERVER_ROOT, abs).replace(/\\/g, '/');
      const src = stripComments(fs.readFileSync(abs, 'utf8'));
      if (/\|\|\s*'accent-roofing'/.test(src) && !(rel in DEFERRED)) offenders.push(rel);
    }
    assert.deepEqual(offenders, [],
      'these files default a tenant to the phantom contractor id: ' + offenders.join(', ')
      + '\nUse PLATFORM_TENANT for a genuinely tenantless error, or thread the real contractor.');

    // CLOSURE: every deferred entry must still be live, or the exemption is stale.
    const fixed = Object.keys(DEFERRED).filter((rel) => {
      const abs = path.join(SERVER_ROOT, rel);
      return !fs.existsSync(abs)
        || !/\|\|\s*'accent-roofing'/.test(stripComments(fs.readFileSync(abs, 'utf8')));
    });
    assert.deepEqual(fixed, [],
      'these deferred entries no longer apply and must be DELETED from DEFERRED: ' + fixed.join(', '));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D — the fence: every logError call names a tenant', () => {
  it('no file outside the expiring list has an untenanted logError call', () => {
    const sites = untenantedSites()
      .filter((s) => !(s.rel in EXPIRING_BY_FILE))
      .map((s) => `${s.rel}:${s.line}`);
    assert.deepEqual(sites, [],
      'these logError calls name no tenant and are not on the expiring list:\n  '
      + sites.join('\n  ')
      + '\nPass the contractor the caller already holds, or `contractorId: PLATFORM_TENANT` if there '
      + 'genuinely is none.');
  });

  it('every expiring file has EXACTLY the pinned number of untenanted calls', () => {
    // ⚠ EXACT, NOT A CEILING. A ceiling lets a new untenanted call hide inside an allow-listed file,
    // which is how an allow-list stops meaning anything.
    const counts = {};
    for (const s of untenantedSites()) counts[s.rel] = (counts[s.rel] || 0) + 1;
    const drift = [];
    for (const [rel, { sites }] of Object.entries(EXPIRING_BY_FILE)) {
      const actual = counts[rel] || 0;
      if (actual !== sites) drift.push(`${rel}: pinned ${sites}, found ${actual}`);
    }
    assert.deepEqual(drift, [], 'the expiring list has drifted:\n  ' + drift.join('\n  '));
  });

  it('CLOSURE: a file that reaches zero must be REMOVED from the list, not left at 0', () => {
    // ⚠ THIS IS WHAT STOPS THE LIST OUTLIVING THE WORK. A stale entry is how an allow-list becomes a
    // permanent exemption that nobody re-reads.
    const stale = Object.entries(EXPIRING_BY_FILE)
      .filter(([, v]) => v.sites === 0)
      .map(([rel]) => rel);
    assert.deepEqual(stale, [],
      'these files are pinned at 0 and must be deleted from EXPIRING_BY_FILE: ' + stale.join(', '));
  });

  it('every expiring entry NAMES the batch that deletes it', () => {
    // ⚠ MEASURED LIMIT, RECORDED HERE RATHER THAN THE REASONING IT WAS WRITTEN ON: this case checks
    // that a batch name is KNOWN, and it cannot check that the name is TRUE. A D3 guard-proof
    // retagged `utils/notificationEmail.js` from RECON to D3 — claiming a batch that does not clear
    // it — and reds **nothing**, because the name is still known and the count is still right.
    // ⚠ That is inherent rather than a hole to plug: a batch label is a CLAIM about future work, and
    // no count-based fence can verify a claim. What IS checkable is covered from the other side —
    // removing RECON from KNOWN_BATCHES reds this case (width 1) — so an unknown name cannot be
    // invented to park an entry. **The honest protection for a wrong-but-known name is review.**
    const bad = Object.entries(EXPIRING_BY_FILE)
      .filter(([, v]) => !KNOWN_BATCHES.includes(v.batch))
      .map(([rel, v]) => `${rel} -> ${v.batch}`);
    assert.deepEqual(bad, [], 'these entries name no known batch: ' + bad.join(', '));
  });

  it('and every listed file EXISTS — a renamed file must not silently keep its exemption', () => {
    const missing = Object.keys(EXPIRING_BY_FILE)
      .filter((rel) => !fs.existsSync(path.join(SERVER_ROOT, rel)));
    assert.deepEqual(missing, [], 'these listed files do not exist: ' + missing.join(', '));
  });

  it('NON-VACUITY: the needle flags a synthetic untenanted call and spares a tenanted one', () => {
    // ⚠ BOTH DIRECTIONS, ON SYNTHETIC INPUT, because a needle that matches nothing passes this fence
    // identically to a codebase with no violations.
    assert.equal(namesATenant("{ req, error: err, source: 'x' }"), false);
    assert.equal(namesATenant("{ req, error: err, contractorId, source: 'x' }"), true,
      'the ES6 SHORTHAND form must count as naming a tenant');
    assert.equal(namesATenant("{ req: null, error: err, contractorId: PLATFORM_TENANT }"), true,
      'an explicit platform marker must count as naming a tenant');
    assert.equal(namesATenant("{ error: err, contractorId: row.contractor_id }"), true);
  });

  it('NON-VACUITY: the walk reaches the file logError lives in, and finds real sites', () => {
    const files = serverFiles().map((f) => path.relative(SERVER_ROOT, f).replace(/\\/g, '/'));
    assert.ok(files.includes('middleware/errorLogger.js'), 'the walk must reach errorLogger.js');
    assert.ok(files.length > 50, `the walk looks too small to be real: ${files.length}`);
    const total = untenantedSites().length;
    assert.ok(total > 100,
      `only ${total} untenanted sites found — the needle or the walk has stopped working, because `
      + 'this was 376 when the fence was written');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH D2 — EVERY `applySessionSlide` CALL SUPPLIES THE TENANT IT JUST READ
//
// ⚠ A PARAMETER WITH NO DEFAULT IS A CONVENTION UNTIL SOMETHING READS THE CALL SITES. D2 made
// `applySessionSlide`'s `contractorId` required precisely so a new caller cannot omit it and get a
// silently platform-labelled slide failure — and the only thing that can enforce that is a sweep of
// the callers, because JavaScript will happily pass `undefined`.
//
// ⚠ AND `undefined` IS THE DANGEROUS VALUE RATHER THAN A LOUD ONE: `logError` would fall back to
// PLATFORM_TENANT, so an omission looks exactly like a deliberate platform decision. That is the
// defect cleanup D exists to close, one level up.
// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D2 — the session-slide call sites name their tenant', () => {
  const AUTH = path.join(SERVER_ROOT, 'middleware', 'auth.js');

  /** Every `applySessionSlide(` CALL (never the declaration), as its parenthesised extent. */
  function slideCalls() {
    const src = stripComments(fs.readFileSync(AUTH, 'utf8'));
    const out = [];
    const re = /\bapplySessionSlide\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      // The declaration is `async function applySessionSlide(` — not a call.
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
      out.push({ line: src.slice(0, m.index).split('\n').length, text: callExtent(src, m.index) });
    }
    return out;
  }

  it('the declaration takes contractorId and does NOT default it', () => {
    const src = stripComments(fs.readFileSync(AUTH, 'utf8'));
    const decl = /async function applySessionSlide\(req, \{([^}]*)\}\)/.exec(src);
    assert.ok(decl, 'harness: the applySessionSlide declaration must be findable');
    assert.match(decl[1], /\bcontractorId\b/, 'contractorId must be a declared option');
    assert.doesNotMatch(decl[1], /contractorId\s*=/,
      'contractorId must NOT be defaulted — a default is how a new caller omits it silently');
  });

  it('every call site passes a contractorId, and there are at least six of them', () => {
    const calls = slideCalls();
    // Six: one per verify helper (admin, referrer, super_admin) plus verifyAnySession's three
    // role branches. A count that FALLS means a slide stopped happening on some path.
    assert.ok(calls.length >= 6,
      `only ${calls.length} applySessionSlide call sites found — expected at least 6`);
    const missing = calls.filter((c) => !/\bcontractorId\b/.test(c.text))
      .map((c) => `middleware/auth.js:${c.line}`);
    assert.deepEqual(missing, [],
      'these applySessionSlide calls do not name a tenant, so a slide failure there would be '
      + 'filed under the platform rather than the contractor whose row was just read');
  });

  it('the two super-admin paths pass PLATFORM_TENANT, not a contractor', () => {
    // ⚠ NOT COSMETIC: a super-admin session carries no contractor_id at all, so inventing one
    // would be the phantom-id defect with a different literal. Asserted positively so the
    // distinction cannot be "tidied" into `s.contractor_id` (which is undefined there).
    const calls = slideCalls().filter((c) => /PLATFORM_TENANT/.test(c.text));
    assert.equal(calls.length, 2,
      `expected exactly 2 platform-labelled slide calls (verifySuperAdminSession and `
      + `verifyAnySession's super_admin branch), found ${calls.length}`);
  });

  it('PAIRED POSITIVE: the needle can see a call that omits the tenant', () => {
    // Without this, a `slideCalls()` that matched nothing would report "all compliant".
    const synthetic = 'await applySessionSlide(req, { sessionId: s.id, createdAt: a, expiresAt: b });';
    assert.ok(!/\bcontractorId\b/.test(synthetic), 'the synthetic omission must read as missing');
    const real = "await applySessionSlide(req, { sessionId: s.id, contractorId: s.contractor_id });";
    assert.ok(/\bcontractorId\b/.test(real), 'a real compliant call must read as present');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH D2 — THE CRON'S AUDIENCE ERROR NAMES A TENANT THE QUERY ACTUALLY SELECTED
//
// ⚠ SOURCE-ONLY, AND THE LIMIT IS STATED RATHER THAN IMPLIED. The per-audience loop lives inside
// `cron.schedule(...)`'s callback in `startDynamicAudiencesJob`, and only `evaluateAudience` is
// exported — so **no test can drive that loop**, and a behavioural case is not available. This
// proves the shape is WRITTEN, not that it paints. Saying which is the difference between a proof
// and a claim.
//
// ⚠ IT IS STILL WORTH A CASE, BECAUSE THE DEFECT IT GUARDS IS THIS REPO'S MOST-RECORDED ONE: a
// writer reading a field no query SELECTS. `logError({ contractorId: audience.contractor_id })`
// against `SELECT id, name` passes `undefined`, which `logError` then turns into PLATFORM_TENANT —
// so the error would be filed platform-level while the code reads as if it names the tenant. The
// two halves must move together or neither is true.
// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D2 — the audience cron selects the tenant it logs', () => {
  const DYN = path.join(SERVER_ROOT, 'cron', 'jobs', 'dynamicAudiences.js');

  // ⚠ THE TABLE NAME IS ASSEMBLED FROM PIECES, AND IT IS NOT AN AFFECTATION — THE 6c RESET FENCE
  // WENT RED ON THE FIRST WRITING. `testResetCoverage.test.js` scans a suite's source for table
  // names outside before()/after() and reports a table the suite "touches but never clears". This
  // suite touches NO table here at all: it reads `dynamicAudiences.js` as TEXT. But the needle and
  // its paired negative both had to SPELL the table, so the scanner read a source-reading fence as
  // a database write. ⚠ **`KNOWN_GAPS` was NOT widened** — the fence's own message forbids that,
  // and the right fix is to stop supplying the string, exactly as N4 commit 6 did for `DELETE FROM`.
  // ⚠ This is the "scans read test files" rule with the sign flipped once more: there prose MATCHES
  // a forbidden pattern; here a NEEDLE is mistaken for the thing it hunts.
  const AUD = 'dynamic_' + 'audiences';
  const QUERY_TAIL = `FROM ${AUD} WHERE is_active = TRUE`;

  it('the active-audience query SELECTS contractor_id', () => {
    const src = stripComments(fs.readFileSync(DYN, 'utf8'));
    const q = new RegExp(`SELECT([^\`]*?)${QUERY_TAIL}`).exec(src);
    assert.ok(q, 'harness: the active-audience query must be findable');
    assert.match(q[1], /\bcontractor_id\b/,
      'the query must select contractor_id, or the catch below logs `undefined` and the error is '
      + 'filed platform-level while the source reads as if it names the tenant');
  });

  it('the per-audience catch passes that column, not a literal and not nothing', () => {
    const src = stripComments(fs.readFileSync(DYN, 'utf8'));
    const call = /logError\(\{([\s\S]{0,220}?)\}\);/.exec(src);
    assert.ok(call, 'harness: the per-audience logError call must be findable');
    assert.match(call[1], /contractorId:\s*audience\.contractor_id/,
      'the tenant must come from the audience row itself — a hardcoded id here would be the '
      + 'phantom-id defect with a different literal');
  });

  it('PAIRED NEGATIVE: the needle rejects the pre-D2 query shape', () => {
    // Without this the first case could be satisfied by any SELECT at all.
    const preD2 = `SELECT id, name ${QUERY_TAIL}`;
    const q = new RegExp(`SELECT([^\`]*?)${QUERY_TAIL}`).exec(preD2);
    assert.ok(q, 'the needle must still match the old shape');
    assert.doesNotMatch(q[1], /\bcontractor_id\b/, 'the old shape must read as missing the column');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH D3 — THE PLATFORM SITES REALLY PASS THE PLATFORM MARKER
//
// ⚠ THIS CLOSES A HOLE A GUARD-PROOF MEASURED AT WIDTH 0, AND THE HOLE IS STRUCTURAL RATHER THAN AN
// OVERSIGHT. `namesATenant` is satisfied by ANY `contractorId`, so swapping a correct
// `PLATFORM_TENANT` for an invented real contractor id reds nothing — the allow-list fence cannot
// tell an honest platform label from the phantom defect wearing a different literal. That is exactly
// what cleanup D exists to stop, so the chosen platform sites are pinned by name.
//
// ⚠ EACH ENTRY SAYS WHY IT IS PLATFORM, because the two reasons are different and a later reader
// will otherwise flatten them: a site that fires ONLY when no contractor was supplied has no tenant
// to name, while a site whose work spans every contractor has no single tenant.
// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D3 — the platform-level sites are explicit, and are not contractors', () => {
  // file -> [ [needle that must appear inside the call, why] ]
  const PLATFORM_SITES = {
    'crm/jobber.js': [
      ["source: 'refreshTokenIfNeeded'", 'fires only when the caller supplied no contractor'],
      ["source: 'getContractorAccessToken'", 'fires only when the caller supplied no contractor'],
    ],
    'utils/stripeTransfer.js': [
      ["source: 'getContractorStripeAccountId'", 'fires only when the caller supplied no contractor'],
    ],
    'crm/pipelineSync.js': [
      ["console.error('[scheduler] Failed to query contractor list:'", 'the contractor-LISTING query spans every tenant'],
    ],
    'utils/pendingReferral.js': [
      ['refusing to match a pending referral without a tenant', 'fires only when the user row carries no contractor'],
    ],
    // ── batch D4's sixteen, added to THIS list rather than a second fence ────────────────────
    // ⚠ ONE LIST AND ONE MECHANISM. A parallel D4 fence would have been easier to write and would
    // have split the property in two, so a later batch could satisfy one and not the other.
    'routes/oauth.js': [
      // ⚠ BOTH FIRE WHEN THE IDENTITY IS MISSING, and that file's own rule is that a
      // client-supplied identity is never trusted — so there is nothing to name here.
      ["source: 'GET /auth/jobber — contractor resolution'", 'no contractorId query param at all'],
      ["source: 'GET /callback — contractor resolution'", 'no contractor identity in the state param'],
    ],
    'routes/stripe.js': [
      ["source: 'getStripeRow'", 'fires only when the caller supplied no contractor'],
      ["source: 'upsertStripeAccount'", 'fires only when the caller supplied no contractor'],
    ],
    'routes/resendWebhook.js': [
      ["error: new Error('RESEND_WEBHOOK_SECRET not set')", 'a platform configuration error, every tenant'],
      ["error: 'Invalid signature'", 'an unauthenticated and possibly hostile request'],
      ['JSON parse', 'before any tenant is known'],
      ['token lookup', 'the lookup that would RESOLVE the tenant is what failed'],
    ],
    'routes/branding.js': [
      ["source: 'GET /api/branding/:slug'", 'the slug→contractor resolution is what failed'],
    ],
    'routes/session.js': [
      ["source: 'POST /api/logout'", 'deletes by token; no contractor is selected or needed'],
    ],
    'routes/superAdmin.js': [
      ["source: 'POST /api/rm-control/login'", 'a super-admin session carries no contractor by design'],
    ],
    'routes/webhooks/jobber.js': [
      ['contractor resolution` })', 'this IS the failure-to-resolve-the-contractor log'],
      ["source: 'POST /webhooks/jobber/invoice-paid — payload parse'", 'upstream of resolveWebhookContractorId'],
      ["source: 'POST /webhooks/jobber/job-update — payload parse'", 'upstream of resolveWebhookContractorId'],
    ],
  };

  it('every chosen platform site passes PLATFORM_TENANT and not a contractor id', () => {
    const missing = [];
    for (const [rel, sites] of Object.entries(PLATFORM_SITES)) {
      const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8'));
      for (const [needle, why] of sites) {
        const at = src.indexOf(needle);
        assert.notEqual(at, -1, `harness: ${rel} no longer contains the site marker ${needle}`);
        // The call's own text: back to the nearest `logError(`, forward to the needle.
        const open = src.lastIndexOf('logError(', at);
        assert.notEqual(open, -1, `harness: no logError( before ${needle} in ${rel}`);
        const span = src.slice(open, at + needle.length);
        if (!/contractorId:\s*PLATFORM_TENANT/.test(span)) {
          missing.push(`${rel} — ${needle} (${why})`);
        }
      }
    }
    assert.deepEqual(missing, [],
      'these sites were decided PLATFORM, so they must say so with the exported constant — an '
      + 'invented contractor id here is the phantom defect with a different literal, and the '
      + 'allow-list fence cannot see it because any contractorId satisfies it');
  });

  it('PAIRED NEGATIVE: the needle rejects a real contractor id in that position', () => {
    // Without this, a needle that matched nothing would report every site as compliant.
    const good = "logError({ req: null, contractorId: PLATFORM_TENANT, error: err, source: 'x' })";
    const bad = "logError({ req: null, contractorId: 'accent-roofing-dev', error: err, source: 'x' })";
    assert.match(good, /contractorId:\s*PLATFORM_TENANT/);
    assert.doesNotMatch(bad, /contractorId:\s*PLATFORM_TENANT/);
  });

  it('⚠ landingResolve logs the VERIFIED TOKEN\'s contractor, never the host\'s', () => {
    // ⚠ A WHITE-LABEL PROPERTY, NOT A LOGGING DETAIL. That function's own comment says branding is
    // read from the token's contractor and never the host's, precisely because the host is
    // attacker-controllable; the error label must follow the same rule or a tampering attempt gets
    // filed against the tenant whose domain was borrowed. The mismatch check runs BEFORE this.
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'utils', 'landingResolve.js'), 'utf8'));
    const at = src.indexOf('scan event');
    assert.notEqual(at, -1, 'harness: the scan-event site must be findable');
    const open = src.lastIndexOf('logError(', at);
    const span = src.slice(open, at);
    assert.match(span, /contractorId:\s*token\.contractor_id/,
      'the scan-event error must be filed under the token\'s contractor');
    assert.doesNotMatch(span, /hostContractor/,
      'the HOST\'s contractor must not be used — it is the untrusted half of this comparison');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH D4 — A TENANT LABEL IS NEVER TAKEN FROM UNVERIFIED CLIENT INPUT
//
// ⚠ TWO GUARD-PROOFS MEASURED 0 AND THESE ARE THE CASES THAT CLOSE THEM. The allow-list fence only
// asks whether a `contractorId` is PRESENT, and the platform fence only covers sites decided
// PLATFORM — so a site that correctly names a tenant could be switched to name the WRONG one,
// client-supplied, and nothing would fail.
//
// ⚠ WHY THIS IS WORTH A FENCE RATHER THAN CARE: `error_log`'s dedup key is
// (contractor_id, route, method, error_message). A caller who can choose the contractor_id can
// therefore choose which lineage their errors join — which means both filing noise against another
// tenant and, with a known message, suppressing the alert on a real one. That is the same principle
// as D5's guardrail 1, applied one batch early to the sites that already resolve a tenant by hand.
// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup D4 — route tenant labels come from a VERIFIED source, not from the request', () => {
  function callSpanBefore(rel, needle) {
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8'));
    const at = src.indexOf(needle);
    assert.notEqual(at, -1, `harness: ${rel} no longer contains ${needle}`);
    const open = src.lastIndexOf('logError(', at);
    assert.notEqual(open, -1, `harness: no logError( before ${needle} in ${rel}`);
    return src.slice(open, at + needle.length);
  }

  it('⚠ oauth\'s OUTER catch labels from the VALIDATED contractor, never the `state` param', () => {
    // ⚠ `contractorId` in that handler IS the client's `state` query param. It becomes a tenant only
    // once the `contractors` row is found — which is what that file's own comment means by "client-
    // supplied identity is never trusted enough to guess". The outer catch wraps that very check, so
    // it must read the value set AFTER it passed, and fall back to platform otherwise.
    const span = callSpanBefore('routes/oauth.js', "source: 'GET /callback' });");
    assert.match(span, /contractorId:\s*verifiedContractorId\s*\|\|\s*PLATFORM_TENANT/,
      'the outer catch must use the VALIDATED contractor or the platform marker');
    assert.doesNotMatch(span, /contractorId:\s*contractorId\b/,
      'labelling from the raw `state` param would let a caller choose the tenant an error is filed under');
  });

  it('⚠ and `verifiedContractorId` is assigned ONLY after the contractors row is found', () => {
    // Without this, the name could be set from `state` at the top and the case above would pass
    // while the property was gone — the needle would still match.
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'routes', 'oauth.js'), 'utf8'));
    const decl = src.indexOf('let verifiedContractorId');
    const assign = src.indexOf('verifiedContractorId = contractorId;');
    // ⚠ THE TABLE NAME IS ASSEMBLED, AND THIS IS THE THIRD TIME THIS SHAPE HAS BITTEN THIS ARC.
    // `testResetCoverage.test.js` scans a suite's source for table names outside before()/after()
    // and reports a table it "touches but never clears". This case touches NO table — it reads
    // `oauth.js` as TEXT — but spelling the name in a NEEDLE made the scanner read a source-reading
    // fence as a database write. D1 hit it with `contractors` (fixed by moving real touches into
    // `before()`), D3 with `dynamic_audiences`, and D4 here. **`KNOWN_GAPS` was NOT widened.**
    // ⚠ THE GENERAL RULE, SINCE THREE INSTANCES IS A PATTERN: a source-reading fence must never
    // SPELL a table name. Build it from pieces — a human still reads it, the scanner does not.
    const CONTRACTORS = 'contract' + 'ors';
    const check = src.indexOf(`SELECT id FROM ${CONTRACTORS} WHERE id = $1`);
    assert.ok(decl !== -1 && assign !== -1 && check !== -1, 'harness: all three sites must be findable');
    assert.ok(decl < check, 'it must be declared before the check so the catch can see it');
    assert.ok(assign > check, 'it must be ASSIGNED after the check — otherwise it is just `state`');
  });

  it('⚠ serveLanding labels from the token\'s contractor, never from the host', () => {
    // Same property as `utils/landingResolve.js`'s scan-event fence, one layer up: the host is
    // attacker-controllable, and the page's own comment says every contractor-scoped value it
    // carries comes from the token.
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'routes', 'landing.js'), 'utf8'));
    const fn = src.indexOf('async function serveLanding');
    assert.notEqual(fn, -1, 'harness: serveLanding must be findable');
    const body = src.slice(fn, src.indexOf('\n}', fn));
    assert.match(body, /logContractorId\s*=\s*contractorId/,
      'the log label must track the resolved contractorId');
    assert.doesNotMatch(body, /logContractorId\s*=\s*req\./,
      'the log label must never be assigned from the request — host, header, query or body');
  });

  it('⚠ every hoisted log-only local is READ, not merely assigned', () => {
    // ⚠ THE HOLE THIS CLOSES, MEASURED: a guard-proof swapped `logContractorId || PLATFORM_TENANT`
    // for a bare `PLATFORM_TENANT` in one unsubscribe route and **nothing failed** — the value was
    // still declared and still assigned, so every other check stayed green while the route silently
    // stopped naming a tenant it had in hand. The allow-list fence cannot see it: `PLATFORM_TENANT`
    // IS a contractorId as far as that needle is concerned.
    // ⚠ This is the dead-write shape: an assignment with no reader looks exactly like a working one.
    const HOISTED = {
      'routes/landing.js': 1,
      'routes/unsubscribe.js': 2,   // one per route — validate and submit
    };
    for (const [rel, expected] of Object.entries(HOISTED)) {
      const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8'));
      const assigned = (src.match(/logContractorId\s*=/g) || []).length;
      const read = (src.match(/contractorId:\s*logContractorId\s*\|\|/g) || []).length;
      assert.ok(assigned > 0, `${rel}: harness — the hoisted local must exist`);
      assert.equal(read, expected,
        `${rel}: expected ${expected} logError call(s) to READ the hoisted local and found ${read} — `
        + 'an assignment nobody reads means the route stopped naming a tenant it already resolved');
    }
  });

  it('PAIRED NEGATIVE: the needles reject the request-derived forms', () => {
    // Without this, a needle that could not match the bad form would report compliance.
    assert.doesNotMatch("contractorId: verifiedContractorId || PLATFORM_TENANT",
      /contractorId:\s*contractorId\b/, 'the good oauth form must not look like the bad one');
    assert.match("contractorId: contractorId, error: err", /contractorId:\s*contractorId\b/,
      'the bad oauth form must be detectable');
    assert.match("logContractorId = req.hostname;", /logContractorId\s*=\s*req\./,
      'the bad landing form must be detectable');
  });
});
