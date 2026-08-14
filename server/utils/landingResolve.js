'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// LANDING RESOLUTION — THE SINGLE ANSWER TO "WHO IS THIS PAGE FOR?"
// (C/DL-2 Phase 3d-1)
//
// Extracted verbatim from the callback of
// `router.get(['/api/invite', '/api/invite/:slug'], ...)` in
// server/routes/referrer.js, together with the three helpers it leaned on —
// loadContractorBranding, toChipName and loadReferrerChip — which were
// module-private in that file and therefore unreachable in-process.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The server-rendered landing page (3d-2) needs the same resolution the JSON
// endpoint performs. The cheap way to get it is a second copy inside the HTML
// route. That would give the product TWO mismatch rules and TWO chip-privacy
// rules — agreeing on the day they are written and drifting thereafter.
//
// That is not hypothetical. server/utils/brandingTheme.js's header records this
// exact shape having already happened once here: BrandingPreview.jsx and the
// server fell back to different palettes, a contractor with no saved colours saw
// one brand in the admin preview and a different one on their live surface,
// neither of them theirs, and nothing failed. One implementation, called twice,
// is the only durable answer.
//
// The parity test in server/test/landingResolve.test.js compares this function's
// return value against the HTTP endpoint's JSON body across five scenarios. It is
// what keeps the two from becoming two.
//
// ── WHAT IS BINDING HERE ────────────────────────────────────────────────────
// THE TOKEN IS THE TENANCY AUTHORITY; THE SUBDOMAIN IS COSMETIC ROUTING.
// Every contractor-scoped value below is read from the TOKEN ROW's contractor_id
// — never from the hostname, never from a client-supplied field. The hostname has
// exactly two jobs: selecting branding when there is no token at all, and being
// checked for agreement when there is one.
//
// `db` MAY BE A POOL OR A CHECKED-OUT CLIENT, matching resolveToken,
// isSlugMutable and resolveHostToContractor. Every shared util in this family
// takes that shape; a resolver that closed over the pool instead could not be
// called inside a transaction and would be the one exception.
//
// NO try/catch AROUND THE READS, per the shared-util exemption ratified in
// C/DL-1 (see the identical notes in inviteTokens.js and contractorSlug.js). A
// failed query propagates to the caller's own catch, which runs logError().
// Swallowing here would return a confident State 0 during a database incident —
// i.e. it would tell a homeowner their valid link was dead. The ONE exception is
// the scan event, which is telemetry and is documented at its call site.
// ─────────────────────────────────────────────────────────────────────────────

const { resolveToken, recordScanEvent } = require('./inviteTokens');
const { resolveHostToContractor } = require('./contractorSlug');
const { resolveBrandingTheme, BRANDING_THEME_DEFAULTS } = require('./brandingTheme');
const { logError } = require('../middleware/errorLogger');

// Loads one contractor's public branding block, or null if the contractor is gone.
//
// REUSES primary_color / secondary_color / accent_color / logo_url and adds only
// landing_bg_color. The brand_* columns LP §5 listed as "NEW" do not exist and
// must not be referenced (amendment A10) — two competing colour sources on one
// table is the failure mode that decision avoided.
//
// `c.id = $1` IS THE TENANCY PREDICATE, and it is the whole reason this function
// exists instead of an inline query: one contractor's landing page must never be
// able to render another's name, colours or logo. It lives here so that this
// function, not each call site, is the enforcement seam.
//
// RESOLUTION LIVES IN THE SHARED RESOLVER. Every token is resolved by
// resolveBrandingTheme, which the admin preview also consumes, so the page's
// fallbacks and the preview's cannot be tuned independently. The resolver also
// VALIDATES colours against a strict six-digit hex rather than passing them
// through: 'navy', a pasted 'F26A1B', a 3-digit '#abc' and a padded '  #F26A1B  '
// would all otherwise reach the page and render as NO COLOUR AT ALL — an
// invisible CTA or a header with no background, with nothing thrown and nothing
// logged.
//
// SLUG IS RE-ATTACHED EXPLICITLY, and that line is load-bearing. The resolver
// deliberately emits NO slug token — it is an identity value rather than a brand
// value, with no counterpart in the admin form state that the preview feeds it.
// Every caller still needs it, so `return resolveBrandingTheme(row)` on its own
// would silently drop it.
//
// ADDRESS IS OMITTED, NOT NULLED, when company_address is unset (LP-1) — the
// resolver preserves that rule; the page decides whether to draw the contact row
// by the key's presence, so a null would render an empty row where none belongs.
async function loadContractorBranding(db, contractorId) {
  const { rows } = await db.query(
    `SELECT c.slug, c.name AS contractor_name,
            s.company_name, s.app_display_name,
            s.primary_color, s.secondary_color, s.accent_color, s.landing_bg_color,
            s.logo_url,
            s.company_phone, s.company_email, s.company_address, s.company_url,
            -- The review trio (C/DL-3b Phase 6A). Selected here because this is
            -- the ONE loader behind both the landing page and GET /api/branding/:slug,
            -- so the referrer app gets them without a second delivery path.
            s.review_url, s.review_button_text, s.review_message,
            -- ⚠ A THIRD TABLE, and the reason is the review-URL derivation.
            -- google_place_id lives on contractor_about (entered via Company
            -- Details → About Us) while review_url lives on contractor_settings
            -- (entered via Branding). The resolver derives one from the other when
            -- the override is unset, so BOTH have to arrive in the same row.
            ca.google_place_id
       FROM contractors c
       LEFT JOIN contractor_settings s ON s.contractor_id = c.id
       LEFT JOIN contractor_about ca ON ca.contractor_id = c.id
      WHERE c.id = $1`,
    [contractorId]
  );
  const row = rows[0];
  if (!row) return null;

  // The row's column names ARE the resolver's input keys, so it is passed
  // straight through. Extra columns are ignored by design.
  return { slug: row.slug, ...resolveBrandingTheme(row) };
}

// Renders a full name as first name + last initial — 'Daniel Zylkiewicz' becomes
// 'Daniel Z.'. Returns null for anything unusable.
//
// THE REDACTION HAPPENS HERE, SERVER-SIDE, and that placement is the point: LP §7
// requires that the full last name is never SENT to the page, not merely never
// displayed by it. A page that receives the full name has already leaked it,
// whatever it chooses to render.
//
// A single-word name degrades to itself — there is no initial to take, and
// inventing one would be worse than showing the mononym.
function toChipName(fullName) {
  if (typeof fullName !== 'string') return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Resolves the referrer chip for a token, or null when there is no chip to show.
//
// CHIP RULES BY link_type (amendment A12), and the absence cases matter as much
// as the presence:
//   peer       — owned by a referrer (users.full_name).        Chip.
//   rep        — owned by a field rep (team_members.full_name). Chip.
//   contractor — general marketing, no personal owner.          NEVER a chip.
//
// Degrades to null rather than to a partial chip when the owner row is gone.
// created_by_user_id and owner_team_member_id are both ON DELETE SET NULL, and
// production already carries peer rows with a NULL owner, so an ownerless token
// is an ordinary case and must stay a valid link.
//
// The `contractor_id = $2` predicate on both lookups is defence in depth: the
// token already fixes the tenant, and this makes a cross-tenant owner join
// impossible even if that ever stopped being true.
async function loadReferrerChip(db, token) {
  let fullName = null;

  if (token.link_type === 'peer' && token.created_by_user_id) {
    const { rows } = await db.query(
      `SELECT full_name FROM users WHERE id = $1 AND contractor_id = $2`,
      [token.created_by_user_id, token.contractor_id]
    );
    fullName = rows[0]?.full_name ?? null;
  } else if (token.link_type === 'rep' && token.owner_team_member_id) {
    const { rows } = await db.query(
      `SELECT full_name FROM team_members WHERE id = $1 AND contractor_id = $2`,
      [token.owner_team_member_id, token.contractor_id]
    );
    fullName = rows[0]?.full_name ?? null;
  }

  const displayName = toChipName(fullName);
  return displayName ? { displayName } : null;
}

// Builds the State 0 payload, and the ONLY place that decides how much an
// invalid landing is allowed to say.
//
// TWO KINDS OF INVALID, AND THEY ARE NOT THE SAME KIND OF THING (C/DL-2 Phase
// 3d-2; the ruling itself is Phase 2a's).
//
//   ORDINARY INVALID — unknown, expired or revoked token. The subdomain is the
//     ONLY signal present and nothing is in conflict with it, so the homeowner
//     gets the branding of the roofer whose sign they scanned, plus a way to
//     reach that roofer. LP §2 State 0: "Contractor branding if the slug
//     resolved." Anything less shows someone holding a dead link a page from a
//     company they have never heard of.
//
//   MISMATCH — the token resolves to one contractor and the subdomain to
//     another. That is not a stale link; two sources of truth actively
//     disagreeing happens through tampering or miswiring and nothing else. So
//     TRUST NEITHER, and say nothing: rendering the HOST's branding would
//     confirm to a prober that that subdomain resolves to a real contractor,
//     and rendering the TOKEN's would confirm whose link they are holding.
//     The mismatch branch below therefore never calls this function.
//
// The distinction lives HERE rather than in the HTML route because both callers
// need it — GET /api/invite/:slug answers the same two cases, and a route-local
// copy would be the second implementation this whole file exists to prevent.
//
// Returns a bare { valid: false } when the host resolved to nothing, which is
// the neutral State 0 an unrecognised subdomain has always produced.
async function buildInvalidPayload(db, hostContractor) {
  if (!hostContractor) return { valid: false };

  const branding = await loadContractorBranding(db, hostContractor.id);
  if (!branding) return { valid: false };

  // `valid: false` is what the page and the JSON endpoint branch on, and it does
  // not move. The branding rides alongside it and describes the HOST only — no
  // contractorId, no linkType, no chip, because there is no trustworthy token to
  // describe and a rejected resolution must not describe one.
  return { valid: false, contractor: branding };
}

/**
 * Resolves a landing request into the payload both the JSON endpoint and the
 * server-rendered page render from.
 *
 * @param {object} db - A pg Pool or a checked-out client.
 * @param {object} options
 * @param {string|null} options.host - The Host header (or req.hostname).
 * @param {string|null} options.slug - The token slug, or null for marketing mode.
 * @param {object|null} [options.req] - Passed to logError() when the scan write
 *        fails, so the error_log row carries a route and method. Optional
 *        precisely because the HTML route and any future in-process caller may
 *        not have one — logError tolerates its absence.
 * @returns {Promise<object>} the landing payload. `{ valid: false }` is a normal
 *          outcome (LP State 0), never an error.
 */
async function resolveLanding(db, { host = null, slug = null, req = null } = {}) {
  // Cosmetic only. Null is an ordinary outcome — apex, localhost, unknown or
  // reserved subdomain — and never an error.
  const hostContractor = await resolveHostToContractor(db, host);

  // ── MARKETING MODE — a bare subdomain, no token ────────────────────────────
  // Valid, not State 0. Pure read: there is no token here, so nothing is
  // recorded and nothing is written. A contractor's subdomain alone is a usable
  // marketing asset (LP §6.4, amendment A17).
  if (!slug) {
    if (!hostContractor) return { valid: false };
    const branding = await loadContractorBranding(db, hostContractor.id);
    if (!branding) return { valid: false };

    return {
      valid: true,
      mode: 'marketing',
      contractorId: hostContractor.id,
      contractorName: branding.companyName,
      contractor: branding,
    };
  }

  // ── INVITE MODE — a token ──────────────────────────────────────────────────
  // resolveToken carries the expiry and active predicates: a token is resolvable
  // only while active AND unexpired (CD-14 — an expired token is never
  // resurrected).
  const token = await resolveToken(db, slug);
  // ORDINARY INVALID — unknown, expired or revoked, all indistinguishable here
  // because resolveToken carries the active and expiry predicates itself. The
  // host is the only signal left, and it is not in conflict with anything, so
  // State 0 renders that contractor. See buildInvalidPayload.
  if (!token) return buildInvalidPayload(db, hostContractor);

  // MISMATCH RULE (binding). Two sources of truth actively disagreeing happens
  // only through tampering or miswiring, so TRUST NEITHER — not the token, not
  // the subdomain. Preferring the token would make the subdomain decorative in
  // the one case where its disagreement is the entire signal.
  //
  // The rejection is a bare { valid: false } carrying no branding from EITHER
  // side. LP §2 State 0's "contractor branding if the slug resolved" governs the
  // ordinary invalid case — an expired or unknown token, where the subdomain is
  // the only signal present and nothing is in conflict. A mismatch is different
  // in kind, and rendering the host's branding would confirm to a prober that
  // that subdomain resolves to a real contractor. (Ruling: C/DL-2 Phase 2a.)
  //
  // DELIBERATELY NOT buildInvalidPayload. That function attaches the host's
  // branding, which is exactly the disclosure this branch exists to withhold —
  // the one line of difference between the two invalid paths, and the reason
  // they are written as two branches rather than one.
  if (hostContractor && hostContractor.id !== token.contractor_id) {
    return { valid: false };
  }

  // TELEMETRY, NEVER A GATE, and deliberately recorded only AFTER the mismatch
  // check so a tampering attempt never writes to the roster. A failed scan record
  // costs a roster row; a throw here would cost the homeowner their signup.
  // Logged and swallowed on purpose — this is the one documented exception to the
  // no-try/catch rule in this file's header.
  try {
    await recordScanEvent(db, slug);
  } catch (scanErr) {
    await logError({ req, error: scanErr, source: 'resolveLanding — scan event' });
  }

  // Branding by the TOKEN's contractor, never the host's.
  const branding = await loadContractorBranding(db, token.contractor_id);
  const payload = {
    valid: true,
    mode: 'invite',
    contractorId: token.contractor_id,
    // Kept at the TOP LEVEL alongside the branding block: src/App.jsx reads
    // data.contractorName today, and moving it would break the live signup
    // screen for a cosmetic gain.
    contractorName: branding ? branding.companyName : BRANDING_THEME_DEFAULTS.companyName,
    linkType: token.link_type,
  };
  if (branding) payload.contractor = branding;

  // Absent, never null: the page draws the chip by the key's presence.
  const chip = await loadReferrerChip(db, token);
  if (chip) payload.referrer = chip;

  return payload;
}

module.exports = {
  resolveLanding,
  loadContractorBranding,
  toChipName,
  loadReferrerChip,
};
