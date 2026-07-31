'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// INVITE TOKEN SERVICE — C/DL-1 token foundation
//
// The single sanctioned way to resolve, redeem, mint, and render invite tokens.
// Backed by contractor_invite_links (extended, not superseded — amendment A4).
//
// REDEMPTION IS link_type-AWARE. This is the load-bearing rule of the module:
//
//   peer       — multi-use. One referrer's personal link serves many friend
//                signups. resolveToken only; NOTHING is ever written to the row.
//   contractor — multi-use. One marketing QR serves many scans. Same as peer.
//   rep        — single-use. Redeemed exactly once, atomically, by redeemToken.
//
// Routing a peer or contractor token through redeemToken would deactivate every
// referrer's personal link on its first signup. The 'rep' predicate therefore
// lives INSIDE the UPDATE's WHERE clause rather than in a JS branch upstream, so
// a mis-called redeemToken matches zero rows and writes nothing.
//
// ERROR HANDLING: these functions deliberately let PostgreSQL errors propagate
// rather than wrapping each in a try/catch that would swallow them. Every caller
// is a route handler or cron job whose own catch block runs logError() — catching
// here would hide a failed write behind a silent null and break that contract.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

// Explicit column list — never SELECT *. Kept in one place so resolveToken and
// any future reader return the same shape.
const TOKEN_COLUMNS = `
  id, contractor_id, slug, link_type,
  created_by_user_id, owner_team_member_id,
  active, created_at, expires_at,
  scanned_at, redeemed_at, redeemed_user_id, superseded_by,
  soft_save_name, soft_save_email, soft_save_phone,
  consent_affirmed_at, consent_channel
`;

// Mints an opaque slug. 8 bytes = 64 bits of entropy, replacing the legacy
// randomBytes(5) (40 bits). Applies to NEWLY minted tokens only — every slug
// already printed, texted, or emailed keeps resolving (see resolveToken, which
// matches on the stored value and imposes no length rule).
function generateSlug() {
  return crypto.randomBytes(8).toString('hex');
}

// Resolves a slug to its token row, or null.
//
// A token is resolvable only while it is active and unexpired. Passing
// contractorId narrows resolution to that tenant — a token belonging to
// Contractor A must never resolve under Contractor B.
//
// READ-ONLY by contract. Callers rely on resolution not mutating the row.
//
// db may be a pool or a checked-out client (the rep signup branch resolves
// inside its transaction).
async function resolveToken(db, slug, { contractorId = null } = {}) {
  if (!slug) return null;

  const params = [slug];
  let tenantPredicate = '';
  if (contractorId) {
    params.push(contractorId);
    tenantPredicate = 'AND contractor_id = $2';
  }

  const { rows } = await db.query(
    `SELECT ${TOKEN_COLUMNS}
       FROM contractor_invite_links
      WHERE slug = $1
        AND active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        ${tenantPredicate}`,
    params
  );
  return rows[0] || null;
}

// Atomically redeems a REP token for a user. Returns the redeemed row, or null.
//
// Null means refuse, and covers every failure identically: not a rep token,
// already redeemed, revoked, expired, or unknown. Callers must treat null as a
// hard stop — in the signup rep branch it triggers a ROLLBACK.
//
// The four WHERE predicates are the entire safety model, and none of them may be
// hoisted into JS:
//   link_type = 'rep'         peer and contractor tokens are multi-use — never touch them
//   active = true             a revoked token cannot be redeemed
//   redeemed_user_id IS NULL  single redemption, enforced by the engine not by a read
//   expires_at                an expired token is never resurrected (CD-14)
//
// Pass a checked-out client, not the pool, when redeeming inside a transaction.
async function redeemToken(db, slug, userId) {
  if (!slug || !userId) return null;

  const { rows } = await db.query(
    `UPDATE contractor_invite_links
        SET active = false,
            redeemed_at = NOW(),
            redeemed_user_id = $2
      WHERE slug = $1
        AND link_type = 'rep'
        AND active = true
        AND redeemed_user_id IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    RETURNING id, contractor_id, slug, link_type,
              owner_team_member_id, redeemed_at, redeemed_user_id`,
    [slug, userId]
  );
  return rows[0] || null;
}

// Records that a landing page was loaded against this token (CD-16). Returns
// true if this call was the one that stamped it.
//
// First scan wins and later scans are no-ops, so the roster's "first seen"
// timestamp stays honest. Both conditions are WHERE predicates rather than a
// read-then-write, so concurrent scans cannot both pass a check and both write:
//   scanned_at IS NULL   only the first scan stamps
//   redeemed_at IS NULL  a late scan can never disturb a redemption record
//
// Never touches `active` — recording a scan must not take a live marketing QR
// out of service, nor resurrect a revoked one.
async function recordScanEvent(db, slug) {
  if (!slug) return false;

  const result = await db.query(
    `UPDATE contractor_invite_links
        SET scanned_at = NOW()
      WHERE slug = $1
        AND scanned_at IS NULL
        AND redeemed_at IS NULL`,
    [slug]
  );
  return result.rowCount > 0;
}

// Renders the public URL for a slug. TWO-STAGE by design — read this before
// changing it.
//
// INVITE_LINK_BASE_URL is the single switch that moves invite links onto the
// token scheme, and it controls BOTH the domain and the path shape at once. That
// coupling is deliberate: the URL shape must change at exactly the moment a
// domain exists that can serve it, never before.
//
//   UNSET (stage 1, interim — what production runs today)
//     -> `${FRONTEND_URL}?signup=<slug>`, byte-identical to the legacy shape.
//     The SPA reads the slug from this query parameter and ONLY from there
//     (src/App.js:58-59). It has no /i/:slug route — that route is the C/DL-2
//     landing page. Emitting the token shape before C/DL-2 ships would produce
//     links that load the app root, find no `signup` param, and die silently.
//
//   SET (stage 2, D3) -> `https://<contractorSlug>.<base>/i/<slug>`
//     Preconditions, both required: wildcard DNS/TLS for *.roofmiles.com is
//     verified, AND the C/DL-2 landing page serves /i/:slug. The flip is
//     therefore the CLOSING ACT OF C/DL-2, not a step in C/DL-1.
//
// Why its own variable and not FRONTEND_URL: FRONTEND_URL has 38 other consumers
// — PIN reset links, Stripe return_url, unsubscribe links, the OAuth callback
// redirect. Repointing it to move invite links would drag all of those with it.
//
// contractorSlug renders the per-contractor subdomain (CD-8). Skipped for hosts
// that cannot carry one (localhost, bare IPs) so local development still works.
function buildInviteUrl(slug, { contractorSlug = null } = {}) {
  if (!slug) throw new Error('buildInviteUrl: slug is required');

  const tokenBase = process.env.INVITE_LINK_BASE_URL;

  // STAGE 1 — legacy shape. Mirrors the previous inline construction exactly,
  // including the `|| 'http://localhost:3000'` fallback the call sites used.
  if (!tokenBase) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}?signup=${slug}`;
  }

  // STAGE 2 — token shape.
  const url = new URL(tokenBase);
  const isBareHost = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || /^[\d.]+$/.test(url.hostname);

  if (contractorSlug && !isBareHost && !url.hostname.startsWith(`${contractorSlug}.`)) {
    url.hostname = `${contractorSlug}.${url.hostname}`;
  }

  url.pathname = `/i/${slug}`;
  // Identity never travels in the query string — the token is the sole carrier.
  url.search = '';
  return url.toString();
}

module.exports = {
  generateSlug,
  resolveToken,
  redeemToken,
  recordScanEvent,
  buildInviteUrl,
  TOKEN_COLUMNS,
};
