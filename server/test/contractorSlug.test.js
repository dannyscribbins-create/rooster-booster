'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 1 RED SUITE — CONTRACTOR SLUG MODULE
//
// Covers the public per-contractor slug rules (LP §6.2 / §6.3):
//   format validation   ^[a-z0-9-]{3,30}$, plus no leading/trailing hyphen
//   reserved denylist   hostnames that must never become a contractor subdomain
//   immutability guard  a slug is freely changeable ONLY until that contractor
//                       has at least one contractor_invite_links row; from then
//                       on it is frozen, because printed QR codes carry it
//
// Implementation target: server/utils/contractorSlug.js — DOES NOT EXIST YET.
// Required lazily inside each test (the inviteTokenService.test.js convention) so
// a missing module fails each test individually with a clear MODULE_NOT_FOUND
// rather than aborting the whole file at load time.
//
// WISHED-FOR API, as pinned by these tests:
//   RESERVED_SLUGS                      iterable of reserved values
//   isValidSlugFormat(slug)   -> bool   format only; total function, never throws
//   isReservedSlug(slug)      -> bool   denylist only, case-insensitive
//   validateSlug(slug)        -> { valid: bool, reason: string|null }
//   isSlugMutable(db, contractorId) -> Promise<bool>
//
// WHY isSlugMutable TAKES A db HANDLE. The brief called for "a tested pure
// function"; taken literally that would mean isSlugMutable({ tokenCount }) with
// the caller running the query. That was rejected deliberately: the rule being
// enforced is "THIS contractor's tokens lock THIS contractor's slug", and if the
// contractor_id predicate lives in the caller then the caller is the enforcement
// seam, not the function — and test 5c below would be proving nothing about the
// module. Putting the scoped count inside the function makes the predicate
// guard-proofable (see below) and gives the future onboarding endpoint a single
// call it cannot get wrong. It stays side-effect-free: it reads, never writes.
//
// GUARD-PROOF (spec §6 requirement) — performed during the GREEN phase:
//   Delete the `AND contractor_id = $1` predicate from isSlugMutable's count
//   query and re-run this file. Expected: 'scopes per contractor' goes RED —
//   Contractor A reports NOT mutable because it now sees Contractor B's token —
//   while 5a and 5b stay green (they are single-tenant and cannot detect the
//   missing predicate). That asymmetry is the proof the two-tenant fixture is
//   load-bearing rather than decorative. Then restore.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { seedContractor } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

// RED: server/utils/contractorSlug.js is created by the C/DL-2 GREEN phase.
function loadSlugModule() {
  return require('../utils/contractorSlug');
}

let tokenSlugCounter = 0;
function uniqueTokenSlug(prefix) {
  tokenSlugCounter += 1;
  return `${prefix}-${Date.now()}-${tokenSlugCounter}`;
}

// The minimum denylist, pinned LITERALLY here on purpose.
//
// The "every denylisted value is rejected" test below could have been written by
// iterating the module's own RESERVED_SLUGS export — but that test passes
// trivially against an EMPTY denylist, and equally against one someone quietly
// shrank. Pinning the required floor in the test file is what makes shrinking it
// a test failure. The module may hold MORE than this; it may never hold less.
const REQUIRED_RESERVED = [
  'www', 'api', 'app', 'admin', 'ops', 'mail', 'smtp', 'staging',
  'test', 'dev', 'status', 'help', 'support', 'docs', 'blog',
  'assets', 'cdn', 'go',
];

describe('C/DL-2 contractor slug — format validation', () => {
  // Pure-function group: no database, no fixtures.

  const ACCEPTED = [
    ['abc', 'minimum length, 3 chars'],
    ['accent', 'ordinary lowercase word'],
    ['a-b-c', 'internal hyphens'],
    ['summit-exteriors-co', 'multi-word hyphenated'],
    ['a1b2c3', 'mixed letters and digits'],
    ['123', 'all digits is legal under the approved pattern'],
    ['a'.repeat(30), 'maximum length, 30 chars'],
  ];

  for (const [value, why] of ACCEPTED) {
    it(`[RED] accepts ${JSON.stringify(value)} — ${why}`, () => {
      const { isValidSlugFormat } = loadSlugModule();
      assert.equal(isValidSlugFormat(value), true, `${JSON.stringify(value)} should be a valid slug`);
    });
  }

  const REJECTED = [
    ['Accent', 'uppercase'],
    ['ACCENT', 'all uppercase'],
    ['ac cent', 'space'],
    [' accent', 'leading space'],
    ['accent ', 'trailing space'],
    ['ac_cent', 'underscore'],
    ['-accent', 'leading hyphen'],
    ['accent-', 'trailing hyphen'],
    ['-', 'hyphen alone'],
    ['ab', 'fewer than 3 chars'],
    ['a'.repeat(31), 'more than 30 chars'],
    ['', 'empty string'],
    ['accent.roofing', 'dot — would split the subdomain label'],
    ['accent/roofing', 'slash — would escape the host into a path'],
    ['accént', 'non-ascii'],
  ];

  for (const [value, why] of REJECTED) {
    it(`[RED] rejects ${JSON.stringify(value)} — ${why}`, () => {
      const { isValidSlugFormat } = loadSlugModule();
      assert.equal(isValidSlugFormat(value), false, `${JSON.stringify(value)} should be rejected`);
    });
  }

  // Non-string input is called out separately: these must RETURN false, not
  // throw. The function sits in front of user input on a future onboarding
  // endpoint, and a throw there is a 500 where a 400 belongs.
  const NON_STRING = [
    [null, 'null'],
    [undefined, 'undefined'],
    [123, 'number'],
    [{}, 'object'],
    [[], 'array'],
    [['accent'], 'array containing a valid slug'],
    [true, 'boolean'],
  ];

  for (const [value, why] of NON_STRING) {
    it(`[RED] returns false (does not throw) for ${why}`, () => {
      const { isValidSlugFormat } = loadSlugModule();
      let result;
      assert.doesNotThrow(
        () => { result = isValidSlugFormat(value); },
        `isValidSlugFormat must not throw on ${why} — it guards an HTTP boundary`
      );
      assert.equal(result, false, `${why} should be rejected`);
    });
  }
});

describe('C/DL-2 contractor slug — reserved denylist', () => {

  it('[RED] the denylist contains every required reserved value', () => {
    const { RESERVED_SLUGS } = loadSlugModule();
    const present = new Set(Array.from(RESERVED_SLUGS));
    const missing = REQUIRED_RESERVED.filter(v => !present.has(v));
    assert.deepEqual(missing, [], `denylist is missing required values: ${missing.join(', ')}`);
  });

  for (const value of REQUIRED_RESERVED) {
    it(`[RED] rejects reserved slug ${JSON.stringify(value)}`, () => {
      const { isReservedSlug } = loadSlugModule();
      assert.equal(isReservedSlug(value), true, `${value} must be reserved`);
    });
  }

  it("[RED] reserves 'go' — the neutral fallback host go.roofmiles.com (spec A7)", () => {
    // Called out on its own because 'go' is the one reserved value that carries a
    // live product dependency: A7 designates go.roofmiles.com as the neutral
    // fallback host for stage-2 invite URLs with no contractor subdomain. A
    // contractor holding this slug would collide with it.
    //
    // Subtle: 'go' is 2 chars, so isValidSlugFormat already rejects it on length.
    // The denylist check must be INDEPENDENT of format — asserted directly here —
    // so the reservation survives any future change to the minimum length.
    const { isReservedSlug } = loadSlugModule();
    assert.equal(isReservedSlug('go'), true);
  });

  it('[RED] the denylist is case-insensitive', () => {
    const { isReservedSlug } = loadSlugModule();
    assert.equal(isReservedSlug('WWW'), true, "'WWW' must be reserved");
    assert.equal(isReservedSlug('Www'), true, "'Www' must be reserved");
    assert.equal(isReservedSlug('ADMIN'), true, "'ADMIN' must be reserved");
  });

  it('[RED] does not over-reject slugs that merely contain a reserved word', () => {
    // The denylist is an exact-match rule, not a substring rule. 'appleton-roofing'
    // contains 'app'; refusing it would be a bug that only surfaces when a real
    // contractor is blocked from onboarding.
    const { isReservedSlug } = loadSlugModule();
    assert.equal(isReservedSlug('appleton-roofing'), false);
    assert.equal(isReservedSlug('devon-exteriors'), false);
    assert.equal(isReservedSlug('gold-standard-roofing'), false);
  });

  it('[RED] validateSlug refuses a reserved value even though its format is legal', () => {
    // 'admin' passes ^[a-z0-9-]{3,30}$ cleanly. This is the composition test: the
    // single call an endpoint makes must apply BOTH rules, so a format-only
    // implementation cannot pass.
    const { isValidSlugFormat, validateSlug } = loadSlugModule();
    assert.equal(isValidSlugFormat('admin'), true, "'admin' is format-legal — that is the point");

    const result = validateSlug('admin');
    assert.equal(result.valid, false, "validateSlug must refuse the reserved value 'admin'");
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0, 'a refusal must carry a non-empty reason');
  });

  it('[RED] validateSlug accepts a well-formed, unreserved slug', () => {
    const { validateSlug } = loadSlugModule();
    const result = validateSlug('accent');
    assert.equal(result.valid, true, `validateSlug('accent') should pass; reason: ${result.reason}`);
    assert.equal(result.reason, null, 'an accepted slug carries no reason');
  });
});

describe('C/DL-2 contractor slug — immutability guard', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  // ── 5a. zero tokens → mutable ──────────────────────────────────────────────

  it('[RED] permits a slug change while the contractor has zero invite links', async () => {
    const { isSlugMutable } = loadSlugModule();
    assert.equal(
      await isSlugMutable(pool, TENANT_A), true,
      'a contractor with no minted tokens must be free to change its slug'
    );
  });

  // ── 5b. at least one token → frozen ────────────────────────────────────────

  it('[RED] refuses a slug change once the contractor has one invite link', async () => {
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_A, uniqueTokenSlug('lock')]
    );

    const { isSlugMutable } = loadSlugModule();
    assert.equal(
      await isSlugMutable(pool, TENANT_A), false,
      'one minted token is enough to freeze the slug — printed QR codes carry it'
    );
  });

  it('[RED] an INACTIVE invite link still freezes the slug', async () => {
    // Deactivating a token does not un-print the QR codes already carrying that
    // subdomain. The guard must count every row for the contractor, not only
    // active = true. Written explicitly because every OTHER read of this table in
    // the codebase filters on active (admin/index.js:537, postJobSequence.js:142),
    // so `AND active = true` is the natural thing to copy in by reflex — and here
    // it would be wrong.
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', false)`,
      [TENANT_A, uniqueTokenSlug('revoked')]
    );

    const { isSlugMutable } = loadSlugModule();
    assert.equal(
      await isSlugMutable(pool, TENANT_A), false,
      'a revoked token still freezes the slug — the printed material is already out there'
    );
  });

  // ── 5c. per-contractor scoping — TWO-TENANT FIXTURE ────────────────────────

  it("[RED] scopes per contractor — B's tokens must not freeze A's slug", async () => {
    // GUARD-PROOF SITE. During GREEN: strip `AND contractor_id = $1` from the
    // count query and confirm THIS test goes red while 5a and 5b stay green.
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_B, uniqueTokenSlug('tenant-b')]
    );

    const { isSlugMutable } = loadSlugModule();

    assert.equal(
      await isSlugMutable(pool, TENANT_A), true,
      "Contractor A has minted nothing — Contractor B's token must not freeze A's slug"
    );
    assert.equal(
      await isSlugMutable(pool, TENANT_B), false,
      'Contractor B minted a token and must itself be frozen'
    );
  });

  it('[RED] an unknown contractor id reports mutable rather than throwing', async () => {
    // Fail-open is correct HERE and only here: this function answers "is the slug
    // frozen yet", and a contractor that does not exist has minted nothing. The
    // caller (a future onboarding endpoint) is what must establish that the
    // contractor exists at all; conflating the two inside this guard would give
    // it two jobs and one confusing return value.
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, 'test-tenant-does-not-exist'), true);
  });

  // ── MISSING id vs UNKNOWN id — the contrast, pinned ────────────────────────
  //
  // READ THIS BEFORE "FIXING" EITHER OF THESE. They look contradictory and are not:
  //
  //   isSlugMutable(pool, 'never-onboarded')  -> TRUE   (test directly above)
  //   isSlugMutable(pool, null)               -> FALSE  (tests below)
  //
  // A SUPPLIED id that happens to match no contractor is a real, answerable
  // question: that contractor has minted nothing, so nothing freezes its slug.
  // True is the correct answer and the query is what produces it.
  //
  // A MISSING id is not a question at all — it is a caller bug. The function was
  // asked "may this slug be changed" without being told whose slug. There is no
  // safe true: answering it would green-light a slug change on a contractor whose
  // links may already be printed. So it fails closed, before any query runs.
  //
  // Collapsing these two into one answer breaks something either way. Making the
  // missing-id case return true hands out a mutable verdict for an unidentified
  // tenant; making the unknown-id case return false blocks the very first slug a
  // brand-new contractor sets, which is the only moment the setter is ever used.

  it('fails closed on a null contractor id — a missing id is a caller bug, not a question', async () => {
    const { isSlugMutable } = loadSlugModule();
    assert.equal(
      await isSlugMutable(pool, null), false,
      'null contractor id must fail closed — no safe "true" exists for an unidentified tenant'
    );
  });

  it('fails closed on an undefined contractor id', async () => {
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, undefined), false);
  });

  it('fails closed on an empty-string contractor id', async () => {
    // '' is what an unfilled form field arrives as, so it reaches this function
    // more plausibly than null does.
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, ''), false);
  });

  it('answers missing-id and unknown-id differently, in one place', async () => {
    // The contrast asserted side by side rather than split across two tests, so a
    // future reader who changes one sees the other fail in the same run.
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, null), false, 'MISSING id -> false');
    assert.equal(await isSlugMutable(pool, 'test-tenant-never-onboarded'), true, 'UNKNOWN id -> true');
  });

  // ── NON-STRING CONTRACTOR IDS — fail closed ────────────────────────────────

  it('fails closed on an array wrapping a real, FROZEN contractor id', async () => {
    // THE REGRESSION GUARD FOR THE WHOLE FINDING. Do not weaken this test.
    //
    // Express parses a duplicated query parameter into an array:
    //   ?contractorId=a&contractorId=b   ->   ['a', 'b']
    // so a future onboarding endpoint reading req.query.contractorId can hand this
    // function an array with nothing looking wrong at the call site.
    //
    // Before the type guard, isSlugMutable's only check was `if (!contractorId)`.
    // An array is truthy, so it reached the query, where node-postgres serialized
    // it to the Postgres array literal {test-tenant-a} — a value no contractor_id
    // column ever equals. Zero rows came back, zero rows means "no links minted",
    // and the function answered TRUE: this slug is changeable. For a contractor
    // that is genuinely FROZEN, with an invite link already minted and its QR code
    // potentially printed on a yard sign.
    //
    // The string control is asserted in the same test deliberately. It is what
    // makes the array's old answer visibly WRONG rather than merely surprising:
    // same contractor, same question, two different answers.
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_A, uniqueTokenSlug('frozen')]
    );

    const { isSlugMutable } = loadSlugModule();

    assert.equal(
      await isSlugMutable(pool, TENANT_A), false,
      'control: the real string id must report FROZEN'
    );
    assert.equal(
      await isSlugMutable(pool, [TENANT_A]), false,
      'an array wrapping that same frozen id must ALSO report frozen — it answered true before the type guard'
    );
  });

  it('fails closed on an object contractor id', async () => {
    // The malformed-JSON-body counterpart to the array case.
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, { id: TENANT_A }), false);
  });

  it('fails closed on a number contractor id', async () => {
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, 123), false);
  });

  it('fails closed on a boolean contractor id', async () => {
    const { isSlugMutable } = loadSlugModule();
    assert.equal(await isSlugMutable(pool, true), false);
  });
});
