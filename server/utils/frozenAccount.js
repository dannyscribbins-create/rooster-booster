'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE FROZEN-ACCOUNT ANSWER — C/DL-3b Phase 3, spec §5 / decision D3
//
// One place that builds the response a VERIFIED-BUT-DEACTIVATED credential gets,
// because three call sites need it — POST /api/login, POST /api/login/choice and
// POST /api/admin/login — and three copies of one shape is how two of them
// eventually disagree about what a frozen account looks like.
//
// ── WHEN THIS MAY BE CALLED, AND IT IS THE WHOLE SECURITY ARGUMENT ───────────
// ONLY AFTER bcrypt.compare HAS SUCCEEDED. Never before, never on a lookup miss,
// never on a wrong password.
//
// The starting bug D3 fixes is that `AND active = true` sat in the login LOOKUP,
// so a deactivated person typing their CORRECT password was told the credential
// was invalid and retried until the rate limiter locked them out. But simply
// deleting that predicate turns the endpoint into an account enumerator: anyone
// could discover which addresses exist by watching for a different response. The
// predicate therefore moves to a branch that runs after the password is proven —
// and this function is that branch's answer. Calling it anywhere earlier
// reintroduces the enumeration hole in one line.
//
// ── WHY THE BRANDING TRAVELS IN THE BODY ─────────────────────────────────────
// Because the server has already proven the credential, it knows the contractor.
// The client usually does not: the frozen screen is most likely to appear on a
// brand-new device with no session, no stored hint and no contractor subdomain
// (the React app is served from app.roofmiles.com, and 'app' is a reserved slug,
// so host resolution correctly answers nothing there). Shipping the branding in
// the 403 is what makes that screen correctly white-labelled anyway.
//
// NO NEW BRANDING LOGIC LIVES HERE. loadContractorBranding is the same loader the
// landing page and GET /api/branding/:slug use, and it resolves through the
// shared resolveBrandingTheme. A second resolution path is exactly the drift that
// brandingTheme.js's header documents having already happened once.
// ─────────────────────────────────────────────────────────────────────────────

const { loadContractorBranding } = require('./landingResolve');
const { resolveBrandingTheme } = require('./brandingTheme');

// The typed error code the client branches on. A CODE, not a sentence: the
// screen owns the copy, and a wording change must never be a protocol change.
const ACCOUNT_FROZEN = 'account_frozen';

/**
 * Builds the body for a verified-but-frozen credential.
 *
 * @param {object} db - the pg pool.
 * @param {string} contractorId - taken from the AUTHENTICATED ROW, never from the
 *        request. Same rule session issuance follows.
 * @returns {Promise<{error: string, branding: object}>} branding is
 *          resolveBrandingTheme's output shape — the same one the login screen
 *          already consumes from GET /api/branding/:slug.
 */
async function buildFrozenAccountBody(db, contractorId) {
  const branding = await loadContractorBranding(db, contractorId);

  // A contractor row that cannot be read is not a reason to withhold the answer:
  // the person is still frozen and still needs telling. They get the platform's
  // neutral palette instead of their employer's, which is the same fallback every
  // other pre-auth surface uses.
  if (!branding) return { error: ACCOUNT_FROZEN, branding: resolveBrandingTheme(null) };

  // SLUG DROPPED, DELIBERATELY, exactly as GET /api/branding/:slug drops it
  // (server/routes/branding.js:119). loadContractorBranding re-attaches it for its
  // landing-page callers; it is an identity value with no place in a cosmetic
  // payload. Destructured away rather than deleted so the omission is visible at
  // the one line that performs it.
  const { slug: _slugNotReturned, ...theme } = branding;
  return { error: ACCOUNT_FROZEN, branding: theme };
}

module.exports = { buildFrozenAccountBody, ACCOUNT_FROZEN };
