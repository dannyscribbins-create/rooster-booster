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
  consent_affirmed_at, consent_channel,
  is_default_marketing, auto_minted
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

// ── THE DEFAULT MARKETING LINK (C/DL-2 Phase 3d-3, amendment A18) ────────────
// Returns the token a contractor's BARE SUBDOMAIN serves, minting one on demand
// the first time there is no default present. Never returns an unusable token;
// returns null only if the mint could not be completed.
//
// WHY THIS EXISTS. A17 puts a working signup on the bare subdomain, and
// POST /api/signup requires an `inviteSlug` — deliberately, because THE TOKEN IS
// THE TENANCY AUTHORITY AND THE HOSTNAME IS COSMETIC ROUTING. Marketing mode is
// the one surface where that rule is under real pressure, since the hostname is
// the only input the visitor supplied. The answer is not to relax the endpoint
// but to route marketing mode through a token as well: the hostname selects
// WHICH contractor's marketing token to look up or mint, and the resulting token
// row is what stamps contractor_id on the user.
//
// WHY IT MINTS RATHER THAN REQUIRING SETUP. A18: auto-mint "exists so the path
// can never fail closed for a contractor who has configured nothing — which is
// the state every new contractor starts in." Requiring an admin to mint a link
// before their own subdomain works would ship a broken page to every contractor
// on day one, discovered by whoever visited first.
//
// ── THE RACE IS RESOLVED BY THE DATABASE, NOT BY THIS FUNCTION ──────────────
// The SELECT below is an optimisation, NOT the guard. Two concurrent callers can
// both read "no default" and both proceed to the INSERT; what stops them both
// succeeding is uniq_default_marketing_link_per_contractor, the partial unique
// index in db.js. ON CONFLICT DO NOTHING turns the loser's collision into zero
// rows instead of a 23505, and the loop then re-reads and returns THE WINNER'S
// token — so every concurrent visitor is served the same slug rather than one of
// them being handed a row that was never written.
//
// The ON CONFLICT arbiter names the index's own predicate, which is what lets
// PostgreSQL infer a PARTIAL index. It deliberately does not swallow a `slug`
// collision: that conflict is on a different index, so it still raises, which is
// correct — a slug collision at 64 bits of entropy is a fault worth hearing about
// rather than a race to absorb.
//
// THREE ATTEMPTS, not a while(true). A loser re-reads and finds the winner on the
// next pass, so two passes is the normal ceiling; the third is slack for the one
// case that genuinely needs it — a winner whose transaction rolled back between
// our INSERT and our re-read. An unbounded loop here would spin against a
// database problem on a public unauthenticated route.
//
// NO try/catch, per the shared-util exemption in this file's header: a failed
// query propagates to the caller's own catch, which runs logError().
//
// `db` may be a pool or a checked-out client, matching every other function here.
async function resolveDefaultMarketingToken(db, contractorId) {
  // TYPE-CHECKED rather than merely falsy-checked, for the reason isSlugMutable
  // documents at length: node-postgres serialises an array to `{a,b}`, which
  // matches no contractor and would have this function mint an orphan row.
  if (typeof contractorId !== 'string' || contractorId === '') return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await db.query(
      `SELECT ${TOKEN_COLUMNS}
         FROM contractor_invite_links
        WHERE contractor_id = $1
          AND is_default_marketing = true
          AND active = true`,
      [contractorId]
    );
    if (existing.rows[0]) return existing.rows[0];

    // link_type='contractor' with BOTH owner columns NULL is the only shape
    // chk_invite_links_owner permits for this type, and it is the right shape
    // anyway: a marketing link has no personal owner, which is exactly why the
    // page it serves renders no referrer chip (A12).
    //
    // MULTI-USE AND NEVER REDEEMED. redeemToken's WHERE clause carries
    // `link_type = 'rep'`, so a signup through this token writes nothing to the
    // row and cannot deactivate it — one printed truck-wrap URL keeps serving
    // every homeowner who uses it.
    //
    // NO expires_at. This link goes on printed material that cannot be recalled.
    const minted = await db.query(
      `INSERT INTO contractor_invite_links
         (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id,
          active, is_default_marketing, auto_minted)
       VALUES ($1, $2, 'contractor', NULL, NULL, true, true, true)
       ON CONFLICT (contractor_id) WHERE is_default_marketing AND active
       DO NOTHING
       RETURNING ${TOKEN_COLUMNS}`,
      [contractorId, generateSlug()]
    );
    if (minted.rows[0]) return minted.rows[0];
  }

  return null;
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
//     (src/App.jsx:58-59). It has no /i/:slug route — that route is the C/DL-2
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
  resolveDefaultMarketingToken,
  buildInviteUrl,
  TOKEN_COLUMNS,
};
