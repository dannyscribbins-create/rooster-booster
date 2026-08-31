'use strict';

const fs = require('fs');
const path = require('path');
const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { collectRoutes } = require('./helpers/adminRouterIntrospection');
const { SESSION_VERIFIER_RE, stripComments, findRawSessionLookups } = require('./helpers/sourceScan');
const { createApp } = require('../app');

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-d2 — THE INLINE-AUTH RULE, ASSERTED INSTEAD OF STATED.
//
// CLAUDE.md's Never Break These Rules says verifyAdminSession(),
// verifyReferrerSession() and verifyAnySession() are the only authorised ways to
// protect an endpoint, and that a raw token check must never be inlined. That
// was true, resident, and enforced by nothing.
//
// WHAT IT COST. Four routes in server/routes/stripe.js —
// POST /api/referrer/stripe/create-financial-connections-session,
// POST …/save-bank-account, GET …/bank-status, POST …/disconnect-bank — each
// hand-rolled `SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND
// expires_at > NOW()`. They differed from the real verifier in SIX ways,
// including admitting a soft-deleted homeowner and admitting a session with no
// tenant. They survived because nothing was looking: adminRouteCoverage.test.js
// and adminRouteInvariant.test.js both filter on the /api/admin/ prefix, and
// these were /api/referrer/. Closed in Wave 1.1-d; this file is the reason they
// cannot come back.
//
// ── TWO ASSERTIONS, AND THE SECOND IS THE ONE THAT MATTERS ───────────────────
//   A. Every /api/referrer/* route calls a verify*Session, or is allowlisted.
//   B. No file under server/**/*.js (excluding server/test/**) contains a raw
//      session lookup outside the allowlisted sites.
//
// ⚠ A WOULD NOT HAVE CAUGHT THE FOUR. They DID check a session — they just did
// it wrong. A is the missing-call gap; B is the wrong-call gap, and the four
// lived in the second one. A guard built only from the obvious assertion would
// have shipped green over the exact defect it was written for.
//
// ── ⚠ WHAT THIS FILE DOES NOT COVER, SAID WHERE A GREEN RUN CANNOT HIDE IT ───
// Assertion A is scoped BY URL PREFIX, and a prefix-scoped guard is itself the
// downward frame CLAUDE.md warns about in "Sweep from the shared UTILITY
// outward". It covers 23 routes. There are ~49 session-bearing referrer-surface
// routes. The 26 outside it:
//     POST /api/cashout · GET /api/pipeline · all 15 /api/account/* ·
//     GET|POST /api/profile/photo · POST /api/review/dismiss ·
//     POST /api/announcement/seen · GET /api/referral/pending/match-check ·
//     PUT /api/referral/pending/:id/seen · GET /api/preferences/theme-mode ·
//     PUT /api/preferences/theme-mode · GET /api/session
// All 26 DO call a verify*Session as of 2026-08-31 — MEASURED, not counted by
// eye: walk createApp()'s real router stack, keep every route whose path starts
// with neither prefix, and test each layer's stripComments(String(handle))
// against SESSION_VERIFIER_RE from ./helpers/sourceScan. That returns 214 routes
// in the stack, 53 outside both prefixes, 26 of them session-bearing. Re-run it
// the same way rather than adjusting the number to taste.
// So this is a gap in the FENCE, not a gap in the code — but it is
// a real gap, it is recorded in PRE_LAUNCH_CHECKLIST.md, and it is written here
// too because adminRouteCoverage.test.js named ITS gap in a comment and was
// believed as coverage anyway. That comment is why the four routes survived.
//
// ⚠ THIS LIST READ "25" AND "~48" AND WENT STALE NINE COMMITS LATER, IN THE SAME
// ARC, AND THE WAY IT HAPPENED IS THE POINT.
// `PUT /api/preferences/theme-mode` shipped in `9c99fdb` (C/DL-3c Phase 1b) —
// session-bearing via verifyAnySession, outside /api/referrer/, and outside
// /api/admin/ too, so it is collected by NEITHER prefixed guard. The route is
// correct and Assertion B covers it. What was wrong was the RECORD — and the
// record is what a future session reads to decide whether a fence covers
// something. The commit that added the route was a user_preferences commit;
// nobody had any reason to open a session-auth test.
//
// ⚠ THAT IS CLAUDE.md's "a list that can only grow" IN ITS PUREST FORM: this
// enumeration has a mechanism for recording a route ARRIVING (someone writes it
// down) and none at all for the population changing underneath it. It cannot be
// fixed by counting more carefully. THE REAL FIX IS THE ONE THE HELPER'S HEADER
// ALREADY NAMES — thread the mount path through collectRoutes()'s recursion so
// the walk yields ABSOLUTE paths, after which a single prefix-free sweep replaces
// this hand-maintained sentence entirely. Until that lands, whoever adds a
// session-bearing route outside /api/referrer/* must edit this list, and this
// paragraph is the only thing that tells them so.
//
// ⚠ AND /api/account/* CANNOT SIMPLY BE ADDED AS A THIRD PREFIX TODAY.
// collectRoutes() matches a MOUNT-RELATIVE path; accountRoutes mounts at
// /api/account, so its routes surface from the walk as 'GET /me'. A
// '/api/account/' prefix would collect ZERO routes and pass vacuously. See the
// header of server/test/helpers/adminRouterIntrospection.js. That is why every
// prefix here carries a non-vacuity floor.
//
// Assertion B has no prefix and no such gap: it walks the server tree.
//
// ⚠ WHAT A SOURCE-TEXT TEST COSTS — the same limits adminRouteInvariant records:
//   - It sees the handler as WRITTEN, not as executed. A route delegating auth
//     to a helper would read as a violation even though it is correct. None
//     exist; if one is added, widen SESSION_VERIFIER_RE in
//     server/test/helpers/sourceScan.js rather than deleting an assertion.
//   - It cannot tell a REACHED call from an unreachable one. A verify*Session
//     behind `if (false)` would satisfy assertion A.
//   Both are narrower than the holes this closes: a call that is not there at
//   all, and a call that is there but hand-rolled.
// ─────────────────────────────────────────────────────────────────────────────

const REFERRER_PREFIX = '/api/referrer/';

// ⚠ EXACT, NOT A FLOOR — the same choice adminRouteCoverage.test.js made after
// its own floor of 60 was found to sit under half the true population and could
// never fire. An exact number is falsifiable in BOTH directions and forces a
// deliberate decision on every change.
// Measured 2026-08-29 by walking createApp()'s real router stack at HEAD ae70e50.
const EXPECTED_REFERRER_ROUTE_COUNT = 23;

// ─── ASSERTION A'S ALLOWLIST ─────────────────────────────────────────────────
// ⚠ ADDING AN ENTRY HERE IS A DELIBERATE SECURITY DECISION, NOT A WAY TO GET
// GREEN. The reason lives in the DATA, not in a comment above the list, so it
// cannot be separated from the entry it justifies. Entries are
// [method, path, reason] — never a bare path: a route that is public for GET
// must not become accidentally public for POST.
const PUBLIC_REFERRER_ROUTES = [
  {
    method: 'POST',
    path: '/api/referrer/claim-experience-token',
    reason:
      'NO SESSION CAN EXIST YET. src/App.jsx fires this from the signup flow at the ' +
      'email-verify step, before any token has been minted, so there is nothing to ' +
      'verify. Same position as POST /api/admin/team/accept-invite: the single-use, ' +
      'time-limited experience_invite_tokens row IS the authentication. ' +
      '⚠ AND IT IS NOT CLEAN, WHICH IS PART OF THE ENTRY AND NOT A FOOTNOTE: the ' +
      'handler takes user_id FROM THE REQUEST BODY and never binds it to the token. ' +
      'The token row carries contractor_id and jobber_invoice_id — not a user — so the ' +
      'token authenticates the INVITE and nothing authenticates WHOSE ' +
      'experience_prompts row gets created. That violates CLAUDE.md Security ' +
      'Standards ("never trust identity values from the request"). Impact today is a ' +
      'stray prompt row and a burned token; the PATTERN is what is filed, as a 🟡 in ' +
      'PRE_LAUNCH_CHECKLIST.md. accept-invite does NOT have this weakness — its token ' +
      'identifies the invitee. Do not delete this paragraph to tidy the entry: an ' +
      'exemption that reads clean is how a defect gets laundered.',
  },
];

const PUBLIC_REFERRER_KEYS = new Set(PUBLIC_REFERRER_ROUTES.map((r) => `${r.method} ${r.path}`));

// ─── ASSERTION B'S ALLOWLIST ─────────────────────────────────────────────────
// File-scoped, repo-relative, forward slashes. Same rule as above: the reason is
// data. Each was verified against source on 2026-08-29 rather than inherited
// from a prior phase's instruction — CLAUDE.md, "a safety measure copied from a
// prior phase must be RE-DERIVED, not inherited."
const RAW_LOOKUP_ALLOWLIST = [
  {
    file: 'server/middleware/auth.js',
    reason:
      'THE SANCTIONED VERIFIERS THEMSELVES. This is the one file the rule points AT; ' +
      'four lookups live here (verifyAdminSession, verifyReferrerSession, the ' +
      'sliding-window read, verifyAnySession) and every other caller is supposed to ' +
      'route through them.',
  },
  {
    file: 'server/middleware/permissions.js',
    reason:
      'THE SANCTIONED PERMISSION GATE — the one genuine raw lookup outside auth.js. ' +
      'requirePermission() reads role/contractor_id/team_member_id to decide the gate, ' +
      'and it deliberately does NOT establish the handler identity: every gated route ' +
      'independently calls verifyAdminSession, which is what keeps the super-admin ' +
      'short-circuit latent. server/test/adminRouteInvariant.test.js is what holds ' +
      'that. ⚠ THIS FILE IS MIDDLEWARE, NOT A ROUTE — scoping this sweep to ' +
      'server/routes/** would have excluded it silently, which is why the scope is ' +
      'the whole server tree.',
  },
  {
    file: 'server/routes/session.js',
    reason:
      'POST /api/logout — DELETE FROM sessions WHERE token = $1. Deleting by token is ' +
      'not an identity check: the route answers an idempotent 200 whether or not the ' +
      'token existed, deliberately, so it cannot be used as a token oracle. There is ' +
      'nothing to verify and nothing to leak. This is also why assertion B matches a ' +
      'token PREDICATE rather than a SELECT — a SELECT-only needle would make this ' +
      'entry unfirable, and an entry that can never fire is decoration.',
  },
];

const RAW_LOOKUP_ALLOWED_FILES = new Set(RAW_LOOKUP_ALLOWLIST.map((e) => e.file));

// ─── the file walk ───────────────────────────────────────────────────────────
// WALKS THE TREE. It does not iterate a hand-maintained FILES list — that is the
// defect recorded against the brand sweep, where new files were invisible until
// someone remembered them and nothing announced the omission.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_ROOT = path.resolve(__dirname, '..');

const rel = (abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/');

// server/**/*.js minus server/test/**. Plus the repo-root server.js: it is a
// lean entry point today, but it boots the app, and a raw lookup there would sit
// outside a server/-only walk with nothing announcing it.
function collectServerSourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (abs === path.join(SERVER_ROOT, 'test')) continue;
        if (e.name === 'node_modules') continue;
        walk(abs);
      } else if (e.name.endsWith('.js')) {
        out.push(abs);
      }
    }
  })(SERVER_ROOT);
  const entry = path.join(REPO_ROOT, 'server.js');
  if (fs.existsSync(entry)) out.push(entry);
  return out;
}

// ─── the two checkers ────────────────────────────────────────────────────────

// Routes carrying neither a verify*Session call nor an allowlist entry.
// allowlistKeys is a PARAMETER so a control can prove the allowlist is consulted
// by passing an empty one — without that seam, "zero violations" cannot be
// distinguished from "the allowlist is swallowing everything".
function findUnverifiedRoutes(routes, allowlistKeys = PUBLIC_REFERRER_KEYS) {
  const out = [];
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (allowlistKeys.has(key)) continue;
    const callsVerifier = route.middlewareStack.some((layer) => {
      const h = layer && layer.handle;
      if (typeof h !== 'function') return false;
      return SESSION_VERIFIER_RE.test(stripComments(h.toString()));
    });
    if (!callsVerifier) out.push(key);
  }
  return out;
}

// Files containing a raw session lookup that are not allowlisted.
// Returns [{ file, literals }]. allowedFiles is a parameter for the same reason.
function findRawLookupFiles(absFiles, allowedFiles = RAW_LOOKUP_ALLOWED_FILES) {
  const out = [];
  for (const abs of absFiles) {
    const r = rel(abs);
    const hits = findRawSessionLookups(fs.readFileSync(abs, 'utf8'));
    if (!hits.length) continue;
    if (allowedFiles.has(r)) continue;
    out.push({ file: r, literals: hits });
  }
  return out;
}

// ─── a scratch app carrying deliberately-violating referrer routes ───────────
// Built in-process so the controls run on EVERY suite run rather than existing
// as a one-off manual probe. A control that only ran once, months ago, in
// someone's terminal, is a claim about the past.
function buildProbeApp() {
  const app = express();
  const router = express.Router();

  // VIOLATION — a referrer route with no session call anywhere.
  router.get('/api/referrer/__probe_no_session', async (req, res) => {
    res.json({ ok: true });
  });

  // VIOLATION — the only mention of a verifier is in a COMMENT.
  router.get('/api/referrer/__probe_comment_only', async (req, res) => {
    // userId would come from verifyReferrerSession(req, res) here
    res.json({ ok: true });
  });

  // CLEAN — calls a verifier for real. If this is ever reported the checker is
  // over-firing, which a violations-only assertion would never reveal.
  // ⚠ The name must be EXACT: SESSION_VERIFIER_RE requires `\s*\(` immediately
  // after the verifier name, so a `verifyReferrerSessionStub(` would correctly
  // NOT match and this control would go red for the wrong reason. That happened
  // to adminRouteInvariant's equivalent probe on its first writing.
  const verifyReferrerSession = async () => ({ userId: 1, contractorId: 'probe' });
  router.get('/api/referrer/__probe_clean', async (req, res) => {
    const s = await verifyReferrerSession(req, res);
    if (!s) return;
    res.json({ ok: true });
  });

  // ALLOWLIST-SHAPED — no session call, but it stands in for an entry so the
  // control can show an allowlisted route is skipped rather than passing on its
  // own merits.
  router.post('/api/referrer/__probe_allowlisted', async (req, res) => {
    res.json({ ok: true });
  });

  app.use('/', router);
  return app;
}

describe('session-auth invariant — the referrer surface, and the raw-lookup sweep', () => {
  let pool;
  let referrerRoutes;
  let serverFiles;

  before(async () => {
    pool = await initTestDb();
    const app = createApp();
    referrerRoutes = collectRoutes(app._router.stack, REFERRER_PREFIX);
    serverFiles = collectServerSourceFiles();
  });

  after(async () => {
    await pool.end();
  });

  // ── NON-VACUITY 1: the prefix collected something, and the right amount ────
  // ⚠ THIS IS THE FLOOR THE MOUNT-RELATIVE LIMIT MAKES MANDATORY. A prefix that
  // does not match how a router is mounted yields an EMPTY array, and every
  // assertion below would then pass trivially. An empty collection must fail
  // loudly, because it cannot fail any other way.
  it('router walk: /api/referrer/* route count matches the recorded number exactly', () => {
    assert.ok(
      referrerRoutes.length > 0,
      `collectRoutes() returned NOTHING for '${REFERRER_PREFIX}'. Either the walk is ` +
        `broken, or the prefix no longer matches how the router is mounted — ` +
        `collectRoutes() matches a MOUNT-RELATIVE path. Everything below this line ` +
        `would pass vacuously. Do not "fix" this by relaxing an assertion.`
    );
    assert.equal(
      referrerRoutes.length,
      EXPECTED_REFERRER_ROUTE_COUNT,
      `Router walk found ${referrerRoutes.length} /api/referrer/* route/method ` +
        `combinations; EXPECTED_REFERRER_ROUTE_COUNT is ${EXPECTED_REFERRER_ROUTE_COUNT}.\n` +
        `If you ADDED or REMOVED a referrer route, this is correct and expected — update ` +
        `the constant in this file, deliberately, and say so in the commit.\n` +
        `If you did NOT change any route, the walk in collectRoutes() is broken. Fix the ` +
        `walk. Do NOT read a low number as "all routes are verified".`
    );
  });

  // ── NON-VACUITY 2: allowlist entries name routes that actually exist ──────
  // A renamed or deleted route leaves a dead allowlist entry, which could then
  // silently cover a newly-unverified replacement at the same key.
  it('allowlist: every PUBLIC_REFERRER_ROUTES entry exists in the walk and carries a reason', () => {
    for (const entry of PUBLIC_REFERRER_ROUTES) {
      const found = referrerRoutes.some((r) => r.method === entry.method && r.path === entry.path);
      assert.ok(
        found,
        `Allowlist entry '${entry.method} ${entry.path}' was not found in the router walk. ` +
          `The route may have been renamed or deleted — remove or update the entry.`
      );
      assert.ok(
        typeof entry.reason === 'string' && entry.reason.trim().length >= 40,
        `Allowlist entry '${entry.method} ${entry.path}' has no substantive reason. The ` +
          `reason is the entry; without it the next reader cannot tell an exemption from ` +
          `an oversight.`
      );
    }
  });

  // ── NON-VACUITY 3: the file walk found files, and found the known lookups ──
  // The three allowlisted sites are this walk's POSITIVE CONTROL. They are real
  // subjects, not constructed ones: if the walk stopped finding them, assertion
  // B's empty result would mean "the scanner is broken", not "the codebase is
  // clean", and the two are indistinguishable from the outside.
  it('file walk: scans the server tree and still finds all three known raw lookups', () => {
    assert.ok(
      serverFiles.length > 50,
      `The server-tree walk found only ${serverFiles.length} .js files. That is far below ` +
        `the real population — the walk is broken and assertion B would pass vacuously.`
    );
    assert.ok(
      !serverFiles.some((f) => rel(f).startsWith('server/test/')),
      'The walk picked up server/test/** — this suite would then scan its own fixtures.'
    );

    const found = findRawLookupFiles(serverFiles, new Set()).map((r) => r.file).sort();
    assert.deepEqual(
      found,
      ['server/middleware/auth.js', 'server/middleware/permissions.js', 'server/routes/session.js'],
      `With the allowlist emptied, the sweep must find EXACTLY the three known raw ` +
        `session lookups. It found: ${JSON.stringify(found)}.\n` +
        `FEWER means the scanner or the walk has stopped working, and assertion B's ` +
        `green is meaningless.\n` +
        `MORE means a new raw lookup was introduced — that is assertion B firing, and ` +
        `the fix is the production file, not this list.`
    );
  });

  // ── NON-VACUITY 4: the scanner strips comments, both directions ────────────
  it('scanner: a lookup inside a comment is not a lookup; one in a literal is', () => {
    assert.deepEqual(
      findRawSessionLookups('// SELECT user_id FROM sessions WHERE token=$1 AND role=$2'),
      [],
      'a line-commented raw lookup survived comment-stripping'
    );
    assert.deepEqual(
      findRawSessionLookups('/* SELECT user_id FROM sessions WHERE token=$1 */'),
      [],
      'a block-commented raw lookup survived comment-stripping'
    );
    assert.equal(
      findRawSessionLookups("const q = 'SELECT user_id FROM sessions WHERE token=$1';").length,
      1,
      'a REAL raw lookup was destroyed by comment-stripping — assertion B cannot fire'
    );
    // The mint-site discrimination, which is what makes the needle a PREDICATE
    // and not the bare word `token`.
    assert.deepEqual(
      findRawSessionLookups(
        "const q = 'INSERT INTO sessions (user_id, token, expires_at, role) VALUES ($1,$2,$3,$4)';"
      ),
      [],
      'a session MINT SITE was reported as a lookup — the needle is matching the column ' +
        'name rather than a token predicate, and all four mint sites will now fail'
    );
  });

  // ── CONTROL 5: stripComments fires on a LIVE subject ──────────────────────
  // server/routes/stripe.js's Wave 1.1-d record comment quotes the exact SELECT
  // it removed. Without stripping, the file that FIXED the defect reports as
  // still containing it.
  it('control: the stripe.js record comment quoting the removed SELECT is NOT flagged', () => {
    const abs = path.join(REPO_ROOT, 'server', 'routes', 'stripe.js');
    const raw = fs.readFileSync(abs, 'utf8');

    // INJECTION PROOF: the needle's text really is present in the file, as a
    // comment. If this ever stops matching, the control below is asserting
    // nothing and must be re-pointed, not deleted.
    assert.match(
      raw,
      /\/\/\s*SELECT user_id FROM sessions WHERE token=\$1/,
      'server/routes/stripe.js no longer carries the Wave 1.1-d record comment quoting ' +
        'the removed raw lookup. This control has lost its subject — find the new live ' +
        'subject or say in the commit that there is none.'
    );

    assert.deepEqual(
      findRawSessionLookups(raw),
      [],
      'server/routes/stripe.js was reported as containing a raw session lookup. The only ' +
        'occurrence is inside a COMMENT — comment-stripping is not being applied, and ' +
        'assertion B is now failing the file that fixed the defect.'
    );
  });

  // ── CONTROL: assertion A fires on a deliberate violation ──────────────────
  it('control: a referrer route with no session call IS reported (assertion A)', () => {
    const probe = collectRoutes(buildProbeApp()._router.stack, REFERRER_PREFIX);
    assert.ok(probe.length >= 4, `probe app exposed ${probe.length} routes, expected 4+ — it did not inject`);

    const violations = findUnverifiedRoutes(probe, new Set(['POST /api/referrer/__probe_allowlisted']));

    assert.ok(
      violations.includes('GET /api/referrer/__probe_no_session'),
      `checker did not flag a referrer route with no session call. Got: ${JSON.stringify(violations)}`
    );
    assert.ok(
      violations.includes('GET /api/referrer/__probe_comment_only'),
      'checker was satisfied by a verifier name appearing only in a COMMENT'
    );
    assert.ok(
      !violations.includes('GET /api/referrer/__probe_clean'),
      'checker flagged a route that DOES call a verifier — it is over-firing, and a ' +
        'violations-only assertion would never have shown this'
    );
    assert.ok(
      !violations.includes('POST /api/referrer/__probe_allowlisted'),
      'an allowlisted route was flagged — the allowlist is not being consulted'
    );
  });

  // ── CONTROL: assertion B fires on a CONSTRUCTED inline raw lookup ─────────
  // ⚠ CONSTRUCTED DELIBERATELY. Wave 1.1-d fixed the four, so this shape has no
  // natural subject left in the codebase — and it is the shape nothing else in
  // the suite covers. Fed through the SAME primitive the file walk uses, so the
  // control exercises the production path rather than a parallel one.
  it('control: an inline raw session lookup with no verifier call IS reported (assertion B)', () => {
    const inlineAuthRoute = [
      "router.get('/api/referrer/__probe_inline', async (req, res) => {",
      "  const token = req.headers['authorization']?.replace('Bearer ', '');",
      '  const r = await pool.query(',
      "    'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',",
      "    [token, 'referrer']",
      '  );',
      '  if (!r.rows.length) return res.status(401).json({ error: '
        + "'Not authorized' });",
      '  res.json({ ok: true });',
      '});',
    ].join('\n');

    const hits = findRawSessionLookups(inlineAuthRoute);
    assert.equal(
      hits.length,
      1,
      `The 1.1-d shape — a hand-rolled session lookup inside a handler — was NOT ` +
        `detected. This is the exact defect assertion B exists for. Got: ${JSON.stringify(hits)}`
    );
    assert.match(hits[0], /FROM sessions/i);

    // And it must survive the file-level path too, not just the primitive: a
    // file whose only lookup is this one, with no allowlist entry, is reported.
    const asFile = { file: 'server/routes/__probe.js', literals: hits };
    assert.ok(
      !RAW_LOOKUP_ALLOWED_FILES.has(asFile.file),
      'the probe path is accidentally allowlisted — this control proves nothing'
    );
  });

  // ── CONTROL: both allowlists are CONSULTED, not decorative ───────────────
  // The fastest path to green on a red guard is adding an allowlist line. These
  // two assertions are what make that line cost something: removing an entry
  // must turn the guard red, or the entry was never doing any work.
  it('control: removing the claim-experience-token entry turns assertion A RED', () => {
    const withAllowlist = findUnverifiedRoutes(referrerRoutes, PUBLIC_REFERRER_KEYS);
    assert.deepEqual(
      withAllowlist,
      [],
      `With the allowlist applied, assertion A must be clean. Got: ${JSON.stringify(withAllowlist)}`
    );

    const withoutAllowlist = findUnverifiedRoutes(referrerRoutes, new Set());
    assert.deepEqual(
      withoutAllowlist,
      ['POST /api/referrer/claim-experience-token'],
      `With the allowlist EMPTIED, exactly one real route must be reported — the one the ` +
        `allowlist is carrying. Got: ${JSON.stringify(withoutAllowlist)}.\n` +
        `An empty result here means the allowlist is decoration: the route would pass ` +
        `without it, so nothing proves the allowlist is consulted.\n` +
        `More than one means a NEW unverified referrer route exists — fix the route.`
    );
  });

  it('control: removing any RAW_LOOKUP_ALLOWLIST entry turns assertion B RED', () => {
    for (const entry of RAW_LOOKUP_ALLOWLIST) {
      const reduced = new Set(RAW_LOOKUP_ALLOWED_FILES);
      reduced.delete(entry.file);
      const flagged = findRawLookupFiles(serverFiles, reduced).map((r) => r.file);
      assert.ok(
        flagged.includes(entry.file),
        `Removing the allowlist entry for ${entry.file} did NOT turn assertion B red. ` +
          `That entry is decoration — the file contains no raw session lookup, so the ` +
          `entry covers nothing and would silently cover a real one added later. ` +
          `Delete it or re-point it. Flagged: ${JSON.stringify(flagged)}`
      );
      assert.ok(
        typeof entry.reason === 'string' && entry.reason.trim().length >= 40,
        `Allowlist entry for ${entry.file} has no substantive reason.`
      );
    }
  });

  // ── ASSERTION A ───────────────────────────────────────────────────────────
  it('every /api/referrer/* route calls a verify*Session or is explicitly allowlisted', () => {
    const violations = findUnverifiedRoutes(referrerRoutes);

    assert.deepEqual(
      violations,
      [],
      `The following /api/referrer/* routes never call a verify*Session and are not ` +
        `allowlisted.\n` +
        `Each is an UNAUTHENTICATED referrer endpoint. Add ` +
        `"const s = await verifyReferrerSession(req, res); if (!s) return;" to the handler.\n\n` +
        `⚠ ADDING AN ENTRY TO PUBLIC_REFERRER_ROUTES IS A DELIBERATE SECURITY DECISION, ` +
        `NOT A WAY TO GET GREEN. It requires a WRITTEN REASON in the entry itself saying ` +
        `why no session can exist at that point — and, if the route is exempt but not ` +
        `clean, saying THAT too. The fastest path to green on a red guard is adding a ` +
        `line; that is how a fence becomes a formality.\n\n` +
        violations.map((v) => `  • ${v}`).join('\n')
    );
  });

  // ── ASSERTION B ───────────────────────────────────────────────────────────
  it('no file under server/** inlines a raw session lookup outside the allowlisted sites', () => {
    const violations = findRawLookupFiles(serverFiles);

    assert.deepEqual(
      violations.map((v) => v.file),
      [],
      `The following files contain a SQL statement that names the \`sessions\` table AND ` +
        `filters on \`token\` — a hand-rolled session lookup.\n` +
        `CLAUDE.md, Never Break These Rules: verifyAdminSession(), verifyReferrerSession() ` +
        `and verifyAnySession() are the ONLY authorised ways to protect an endpoint. Never ` +
        `inline a raw token check.\n` +
        `This is the Wave 1.1-d shape: those four routes DID check a session, and differed ` +
        `from the real verifier in six ways — admitting a soft-deleted homeowner, admitting ` +
        `a tenant-less session, and silently opting out of the sliding window among them.\n\n` +
        `⚠ ADDING AN ENTRY TO RAW_LOOKUP_ALLOWLIST IS A DELIBERATE SECURITY DECISION, NOT ` +
        `A WAY TO GET GREEN, and it requires a WRITTEN REASON in the entry itself.\n\n` +
        violations
          .map((v) => `  • ${v.file}\n${v.literals.map((l) => `      ${l.replace(/\s+/g, ' ').trim().slice(0, 140)}`).join('\n')}`)
          .join('\n')
    );
  });
});
