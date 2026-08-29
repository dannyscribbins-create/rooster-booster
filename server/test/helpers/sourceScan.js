'use strict';

/**
 * Source-text scanning primitives shared by the auth invariant suites.
 *
 * Imported by:
 *   - server/test/adminRouteInvariant.test.js   (every gated route verifies a session)
 *   - server/test/sessionAuthInvariant.test.js  (Wave 1.1-d2 — the referrer surface,
 *                                                and the raw-lookup sweep)
 *
 * EXTRACTED HERE IN WAVE 1.1-d2 because the second suite needed the same scanner
 * and CLAUDE.md's Code Cleanliness Standard forbids the second copy. The comment
 * blocks below moved VERBATIM from adminRouteInvariant.test.js — nothing was
 * corrected on the way in, per CLAUDE.md's relocation rule. (The one citation
 * inside them, server/routes/admin/index.js:982, was re-resolved at move time and
 * is exact.)
 */

// The four sanctioned session verifiers (server/middleware/auth.js:233-239).
// ⚠ ANCHORED ON THE CALL, NOT THE NAME. The trailing `\s*\(` is what makes this
// evidence of an invocation rather than of the string appearing somewhere —
// CLAUDE.md's toContain-on-a-bare-value trap, in a different costume. A bare
// name matches an import line, a property, or a mention in a string.
const SESSION_VERIFIER_RE =
  /\b(?:verifyAdminSession|verifyReferrerSession|verifySuperAdminSession|verifyAnySession)\s*\(/;

// ─── scanSource(): a real scanner, not a regex ───────────────────────────────
// ⚠ THIS IS LOAD-BEARING AND THERE IS A LIVE SUBJECT FOR IT.
// server/routes/admin/index.js:982 — inside the POST /api/admin/branding/logo
// handler — reads:
//     // TENANCY. contractorId comes from verifyAdminSession and from nowhere
// That comment is INSIDE the handler body, so fn.toString() returns it. Without
// stripping, a route could satisfy the invariant on a comment alone. That is
// precisely the shape Phase 0's first parser hit: it reported a false violation
// on POST /api/admin/login because it matched `requirePermission('branding')`
// in the comment at server/routes/admin/index.js:129.
//
// ⚠ AND WAVE 1.1-d2 GAVE IT A SECOND LIVE SUBJECT, IN THE OPPOSITE DIRECTION.
// server/routes/stripe.js's Wave 1.1-d record comment quotes the raw session
// lookup it removed:
//     //     SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND …
// Without stripping, the raw-lookup sweep reports the file that FIXED the defect
// as still containing it. The first subject is a comment producing a false PASS;
// this one is a comment producing a false FAIL. One scanner answers both.
//
// A regex cannot do this correctly. `'https://x'` contains `//`, and a naive
// line-comment strip would delete the rest of the line — which could delete a
// REAL call sitting after a URL. So this tracks string, template and comment
// state properly.
//
// Known limitation: a REGEX LITERAL containing `//` or `/*` would confuse it,
// because distinguishing `/` as division from `/` as a regex delimiter needs a
// real parser. No handler in this codebase contains one. If that changes, this
// fails toward reporting a violation (text gets eaten, the call disappears),
// which is the safe direction — a false alarm, never a false pass.
//
// Second known limitation, added with the literal collector: a `${...}`
// interpolation inside a template literal is treated as part of the literal
// rather than as code. A verifier call written ONLY inside an interpolation
// would be invisible. None exists; the SQL templates this collects have plain
// `$1` placeholders, which are literal text, not interpolations.
//
// Returns { code, literals }:
//   code     — the source with comments removed and every string/template
//              literal copied through VERBATIM, quotes included. This is byte-
//              identical to what the old stripComments() returned.
//   literals — the CONTENTS of each string/template literal encountered, in
//              source order, without the surrounding quotes. This is what makes
//              the raw-lookup sweep able to ask "are `sessions` and a `token`
//              predicate in the SAME SQL statement" rather than "within N
//              characters of each other", which is the difference between
//              seeing a lookup and seeing an INSERT that happens to have a
//              column called token.
function scanSource(src) {
  let code = '';
  const literals = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // string or template literal — copied through verbatim, including any
    // slashes inside it, so a URL in a string cannot start a fake comment.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let inner = '';
      code += c; i++;
      while (i < n) {
        if (src[i] === '\\') {
          code += src[i] + (src[i + 1] || '');
          inner += src[i] + (src[i + 1] || '');
          i += 2;
          continue;
        }
        code += src[i];
        if (src[i] === quote) { i++; break; }
        inner += src[i];
        i++;
      }
      literals.push(inner);
      continue;
    }
    code += c; i++;
  }
  return { code, literals };
}

// Thin wrapper preserving the original name and contract. adminRouteInvariant's
// non-vacuity test asserts against THIS, so the behaviour it pins is unchanged
// by the extraction.
function stripComments(src) {
  return scanSource(src).code;
}

// ─── the raw-session-lookup needle (Wave 1.1-d2, assertion B) ────────────────
// A raw session lookup is a SQL statement that BOTH names the `sessions` table
// AND filters on `token`. Both conditions must hold in the SAME literal.
//
// ⚠ IT IS NOT "A SELECT", AND THAT IS THE WHOLE DESIGN.
//   - A SELECT-only needle cannot see server/routes/session.js's
//     `DELETE FROM sessions WHERE token = $1`, which makes that allowlist entry
//     UNFIRABLE — an entry that can never fire is decoration, and a decorative
//     allowlist is the exact defect this guard exists to prevent.
//   - Requiring a `token` PREDICATE (rather than the bare word `token`) is what
//     excludes the four session mint sites — server/routes/admin/index.js,
//     server/routes/referrer.js twice, and server/routes/superAdmin.js — where
//     `token` appears as an INSERT column name beside `sessions`. Confirmed
//     2026-08-29: all four are correctly silent.
// Known limit: `WHERE token IN (...)` and `WHERE token LIKE ...` are covered;
// an exotic predicate form (a function call wrapping the column, say) is not.
// None exists. It fails toward a MISS there, which is why the walk also asserts
// it still finds all three known lookups.
const SESSIONS_TABLE_RE = /\bsessions\b/i;
const TOKEN_PREDICATE_RE = /\btoken\b\s*(?:=|IN\b|LIKE\b)/i;

// Returns the SQL literals in `src` that are raw session lookups. Empty array
// means none. Comments are stripped first — see the two live subjects above.
function findRawSessionLookups(src) {
  return scanSource(src).literals.filter(
    (lit) => SESSIONS_TABLE_RE.test(lit) && TOKEN_PREDICATE_RE.test(lit)
  );
}

module.exports = {
  SESSION_VERIFIER_RE,
  SESSIONS_TABLE_RE,
  TOKEN_PREDICATE_RE,
  scanSource,
  stripComments,
  findRawSessionLookups,
};
