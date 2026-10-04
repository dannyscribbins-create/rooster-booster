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
// ⚠ THE EXPLANATION LIVES HERE AND NOT IN `errorLogger.js`, AND THAT PLACEMENT IS DELIBERATE RATHER
// THAN TIDY. The first writing put a 33-line comment block at the TOP of `errorLogger.js` — which is
// a citation-rotting edit, the exact shape this repo recorded from `db.js`, where nine lines rotted
// 137 citations and one line rotted 15. Six citations point into `errorLogger.js` below that
// insertion point. Collapsed to a ONE-LINE constant replacing the blank line after the requires, the
// net delta is **0** and **not one of the six moved** (verified line by line against HEAD).
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
// TRADE. There are 376 non-compliant sites across 42 files; a 376-entry list would be unreadable and
// nobody would maintain it. Per file with an exact count gives the same two protections that matter:
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
 * clears them. Measured 2026-10-03: 376 sites across 42 files.
 *
 * ⚠ TO CHANGE A NUMBER HERE YOU MUST BE FIXING SITES. A count that rises fails; a count that falls
 * fails until it is updated; a file that reaches zero must be DELETED from this object.
 */
const EXPIRING_BY_FILE = {
  // ── batch D2: middleware, cron, jobs ──
  'middleware/auth.js': { sites: 5, batch: 'D2' },
  'middleware/errorLogger.js': { sites: 1, batch: 'D2' },
  'middleware/permissions.js': { sites: 1, batch: 'D2' },
  'cron/jobs/dynamicAudiences.js': { sites: 1, batch: 'D2' },
  'cron/jobs/engagementCadence.js': { sites: 1, batch: 'D2' },
  'cron/jobs/jobberIncrementalSync.js': { sites: 5, batch: 'D2' },
  'cron/withLock.js': { sites: 2, batch: 'D2' },
  'jobs/contactMatchingPass.js': { sites: 4, batch: 'D2' },
  'jobs/fullJobberImport.js': { sites: 6, batch: 'D2' },
  'jobs/repNamesBackfill.js': { sites: 1, batch: 'D2' },
  'jobs/saleRegroupBackfill.js': { sites: 1, batch: 'D2' },
  // ── batch D3: crm + utils ──
  'crm/jobber.js': { sites: 3, batch: 'D3' },
  'crm/pipelineSync.js': { sites: 15, batch: 'D3' },
  'utils/attributionEngine.js': { sites: 1, batch: 'D3' },
  'utils/deriveJobberTags.js': { sites: 1, batch: 'D3' },
  'utils/emailSuppression.js': { sites: 1, batch: 'D3' },
  'utils/landingResolve.js': { sites: 1, batch: 'D3' },
  'utils/notificationEmail.js': { sites: 1, batch: 'D3' },
  'utils/pendingReferral.js': { sites: 8, batch: 'D3' },
  'utils/stripeTransfer.js': { sites: 1, batch: 'D3' },
  'utils/tags.js': { sites: 6, batch: 'D3' },
  'utils/userPreferences.js': { sites: 3, batch: 'D3' },
  // ── batch D4: the non-referrer, non-admin routes ──
  'routes/account.js': { sites: 16, batch: 'D4' },
  'routes/branding.js': { sites: 1, batch: 'D4' },
  'routes/landing.js': { sites: 1, batch: 'D4' },
  'routes/oauth.js': { sites: 5, batch: 'D4' },
  'routes/rep.js': { sites: 4, batch: 'D4' },
  'routes/resendWebhook.js': { sites: 21, batch: 'D4' },
  'routes/session.js': { sites: 3, batch: 'D4' },
  'routes/stripe.js': { sites: 11, batch: 'D4' },
  'routes/superAdmin.js': { sites: 1, batch: 'D4' },
  'routes/unsubscribe.js': { sites: 2, batch: 'D4' },
  'routes/webhooks/jobber.js': { sites: 5, batch: 'D4' },
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

const KNOWN_BATCHES = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];

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
