'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTOR SLUG SERVICE — C/DL-2 landing page
//
// The public per-contractor slug: the label in https://<slug>.roofmiles.com.
// It is NOT contractors.id. The internal id (a value like '<tenant>-dev') must
// never appear in a public URL, and keeping the two separate is the whole reason
// contractors.slug exists as its own nullable column.
//
// Three rules live here, and all three are enforcement seams rather than
// suggestions:
//
//   FORMAT      ^[a-z0-9-]{3,30}$, and no leading or trailing hyphen. The base
//               pattern alone would accept '-acme' and 'acme-'; both are legal
//               DNS-ish noise that reads as a typo in print, so they are refused
//               separately. 3 chars is the floor, 30 the ceiling.
//
//   RESERVED    An exact-match, case-insensitive denylist of hostnames that must
//               never become a contractor subdomain because the platform already
//               owns them or intends to.
//
//   IMMUTABLE   A slug is freely changeable ONLY until that contractor has minted
//               its first invite link. After that it is frozen, because printed
//               QR codes and texted links already carry it and cannot be recalled.
//
// NO INTERNAL try/catch — this follows the shared-util exemption ratified in
// C/DL-1 (see the identical note in server/utils/inviteTokens.js). isSlugMutable
// deliberately lets PostgreSQL errors propagate instead of wrapping them and
// returning a silent boolean. Every caller is a route handler or job whose own
// catch block runs logError(); swallowing here would turn a failed query into a
// confident "true" — i.e. it would report a FROZEN slug as changeable, which is
// the one wrong answer this function can give. Please do not "fix" this.
//
// NO ENDPOINT WIRING EXISTS YET. Nothing calls these functions in production
// today; the future contractor-onboarding endpoint is their first consumer. They
// ship now so that endpoint has a single call it cannot get wrong.
// ─────────────────────────────────────────────────────────────────────────────

// Base shape. Length is enforced by the quantifier, so a separate length check
// would be redundant — the hyphen-edge rules below are the only additions.
const SLUG_PATTERN = /^[a-z0-9-]{3,30}$/;

// Hostnames a contractor may never claim.
//
// Three groups, kept together because they are all "the platform already owns
// this label": infrastructure/DNS conventions (www, mail, smtp, cdn, assets),
// environments and platform surfaces (api, app, admin, ops, staging, test, dev,
// status), and content surfaces (help, support, docs, blog).
//
// 'go' is the one entry with a live product dependency: spec amendment A7
// designates go.roofmiles.com as the neutral fallback host for invite URLs that
// carry no contractor subdomain. A contractor holding this slug would collide
// with it directly.
//
// Frozen so a caller cannot mutate the platform's reserved set at runtime.
const RESERVED_SLUGS = Object.freeze([
  'www', 'api', 'app', 'admin', 'ops', 'mail', 'smtp', 'staging',
  'test', 'dev', 'status', 'help', 'support', 'docs', 'blog',
  'assets', 'cdn', 'go',
]);

// Pre-lowercased lookup set. Built once at module load rather than per call.
const RESERVED_LOOKUP = new Set(RESERVED_SLUGS.map(s => s.toLowerCase()));

// True when `value` is a well-formed slug. Format only — says nothing about
// whether the slug is reserved or already taken.
//
// TOTAL FUNCTION: returns false for null, undefined, numbers, objects, arrays,
// and booleans rather than throwing. It guards an HTTP boundary where user input
// arrives unvalidated, and a throw there would be a 500 in place of a 400. The
// typeof gate is what makes that true — note that a permissive String(value)
// coercion would quietly accept ['acme'] by turning it into 'acme'.
function isValidSlugFormat(value) {
  if (typeof value !== 'string') return false;
  if (!SLUG_PATTERN.test(value)) return false;
  // The pattern permits hyphens anywhere, including the ends. Refuse the edges.
  if (value.startsWith('-') || value.endsWith('-')) return false;
  return true;
}

// True when `value` is a reserved platform hostname.
//
// EXACT MATCH, never substring: 'appleton-roofing' contains 'app' and must still
// be allowed. A substring rule here would silently block legitimate contractors
// from onboarding, and would only be discovered by the contractor it blocked.
//
// Case-insensitive, and INDEPENDENT OF FORMAT on purpose. 'go' is two characters,
// so isValidSlugFormat already rejects it on length today — but that is a
// coincidence of the current floor, not a guarantee. Checking the denylist
// without a format precondition keeps every reservation standing if the length
// bounds are ever changed.
function isReservedSlug(value) {
  if (typeof value !== 'string') return false;
  return RESERVED_LOOKUP.has(value.trim().toLowerCase());
}

// Composes the two rules above into the single call an endpoint makes.
// Returns { valid: boolean, reason: string | null } — reason is null when valid
// and a caller-safe explanation otherwise. The strings describe the rule that was
// broken and never echo internal state, so they are safe to return to a client.
//
// Uniqueness is NOT checked here: it is owned by the UNIQUE index on
// contractors.slug, which is the only place that can decide it without a race.
// The caller handles the resulting 23505.
function validateSlug(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return { valid: false, reason: 'Slug is required.' };
  }
  if (!isValidSlugFormat(value)) {
    return {
      valid: false,
      reason: 'Slug must be 3-30 characters, lowercase letters, numbers and hyphens only, and cannot start or end with a hyphen.',
    };
  }
  if (isReservedSlug(value)) {
    return { valid: false, reason: 'That slug is reserved and cannot be used.' };
  }
  return { valid: true, reason: null };
}

// True while this contractor's slug may still be changed.
//
// A single minted invite link freezes it. The moment a token exists, a QR code
// carrying <slug>.roofmiles.com may already be printed on a yard sign or sitting
// in someone's text messages; changing the slug then would break links nobody can
// reissue.
//
// DELIBERATELY NOT FILTERED ON active = true. Revoking a token does not un-print
// the material that carries it, so a deactivated link freezes the slug exactly as
// firmly as a live one. Worth stating explicitly because every OTHER read of this
// table in the codebase does filter on active (admin/index.js, postJobSequence.js)
// — copying that predicate in here by reflex would be a silent correctness bug.
//
// The `contractor_id = $1` predicate is the tenancy guard: Contractor B's tokens
// must never freeze Contractor A's slug. It lives inside this function rather than
// in the caller so that this function, not its caller, is the enforcement seam.
//
// Fail-open for an unknown contractor is correct and scoped: a contractor that
// does not exist has minted nothing, so its slug is trivially unfrozen. Confirming
// the contractor exists at all is the caller's job — folding that in here would
// give one boolean two meanings.
//
// READ-ONLY by contract; never writes. `db` may be a pool or a checked-out client,
// matching resolveToken in server/utils/inviteTokens.js, so a future onboarding
// endpoint can call this inside the same transaction that updates the slug.
async function isSlugMutable(db, contractorId) {
  // TYPE-CHECKED, not merely falsy-checked, and that difference is the whole point.
  //
  // A truthy non-string reaches the query if this only tests falsiness. The
  // plausible case is an array: Express parses a duplicated query parameter
  // (?contractorId=a&contractorId=b) into ['a','b'], so an endpoint reading
  // req.query.contractorId can hand this function an array with nothing looking
  // wrong at the call site. A malformed JSON body does the same with an object.
  //
  // node-postgres then serializes that value to something no contractor_id ever
  // equals — an array becomes the literal {a,b} — the query matches zero rows,
  // and zero rows means "no links, slug is free". So the function would answer
  // MUTABLE for a contractor that is genuinely frozen, whose QR codes may already
  // be printed. That is the one wrong answer this module must never give, and it
  // would arrive through the most ordinary input path there is.
  if (typeof contractorId !== 'string' || contractorId === '') return false;

  const { rows } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM contractor_invite_links WHERE contractor_id = $1
     ) AS has_links`,
    [contractorId]
  );
  return rows[0].has_links === false;
}

module.exports = {
  RESERVED_SLUGS,
  SLUG_PATTERN,
  isValidSlugFormat,
  isReservedSlug,
  validateSlug,
  isSlugMutable,
};
