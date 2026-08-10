'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC BRANDING RESOLUTION — GET /api/branding/:slug  (C/DL-3b Phase 1)
//
// THE QUESTION THIS ANSWERS: "whose logo do I show?" — asked by a browser that
// has nobody logged in yet. It is source 2.5 of the D4 branding resolution chain
// (src/utils/brandingChain.js) and, through it, sources 2 and 3 as well.
//
// ── WHY THIS IS NOT GET /api/invite/:slug ───────────────────────────────────
// Phase 0 recorded that endpoint as the only slug→branding bridge. It cannot do
// this job, for three independent reasons:
//
//   1. ITS :slug IS AN INVITE TOKEN SLUG, NOT A CONTRACTOR SLUG. resolveLanding()
//      hands `slug` to resolveToken() — the contractor_invite_links lookup. The
//      CONTRACTOR slug reaches that function only through `host`. Two different
//      namespaces must not share a URL shape, which is why this route lives at a
//      distinct path rather than as a second mount on that one.
//   2. IT RETURNS contractorId at the top level (landingResolve.js:232,285).
//      Tenancy-bearing, and this endpoint returns none.
//   3. IT WRITES. recordScanEvent() fires on every token resolution
//      (landingResolve.js:275). A branding read must never record a scan.
//
// ── WHAT MAKES THIS SAFE TO EXPOSE UNAUTHENTICATED ──────────────────────────
// It returns ONLY resolveBrandingTheme's output: a company name, a program name,
// four colours, a logo URL and the public contact details a contractor already
// prints on a yard sign. No contractor_id, no counts, no user data, no token
// data. Every one of these values is already served to anonymous traffic by the
// landing page at <slug>.roofmiles.com.
//
// ── THE ANTI-ORACLE RULE, AND WHY IT IS AN ENDPOINT PROPERTY ────────────────
// An unknown, malformed or RESERVED slug returns the neutral RoofMiles defaults
// at 200 — never a 404, never a distinguishable error. A 404 would turn this into
// a contractor-slug oracle: walk the slug space, keep the 200s, and you have the
// platform's tenant roster.
//
// NO SLUG IS ECHOED BACK, and that omission is load-bearing rather than tidy.
// The caller already holds the slug — it is the thing it put in the URL — so
// echoing buys the chain nothing. Omitting it is what makes the unknown and the
// reserved responses BYTE-IDENTICAL rather than merely same-shaped, which is the
// difference between "you cannot tell these apart" and "you can, if you look at
// the values". It also keeps the endpoint free of reflected input entirely.
//
// CONSEQUENCE THE CLIENT LIVES WITH, STATED HERE SO IT IS NOT REDISCOVERED: a
// caller cannot ask this endpoint "did that slug resolve?", because answering is
// exactly the disclosure above. The chain infers a non-answer by comparing the
// payload against BRANDING_THEME_DEFAULTS instead — see isNeutralBranding() in
// src/utils/brandingChain.js for why that inference is sound.
//
// ── WHY loadContractorBranding RATHER THAN A LOCAL SELECT ───────────────────
// It is the one branding SELECT in the codebase. A second one here would be the
// second implementation that server/utils/landingResolve.js's header exists to
// prevent, and the drift it describes has already happened once in this repo.
// Its `slug` re-attachment is dropped below; see that line.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { resolveBrandingTheme } = require('../utils/brandingTheme');
const { resolveSlugToContractor } = require('../utils/contractorSlug');
const { loadContractorBranding } = require('../utils/landingResolve');

// ── PUBLIC BRANDING RESOLUTION LIMIT ─────────────────────────────────────────
// 60 per 5 minutes per IP.
//
// DELIBERATELY NOT landingResolveLimiter (30/5min), and not merely because
// sharing an imported limiter would share a bucket. The two endpoints have
// different shapes and must fail independently: a burst of branding reads on the
// login screen must never rate-limit a real QR-code scan arriving at
// /api/invite/:slug, which is a customer standing in a driveway.
//
// HIGHER THAN THE LANDING LIMIT, on purpose. This route performs one indexed
// lookup and WRITES NOTHING, where the landing route records a scan event; and it
// is called on every app boot rather than once per scan, so a household or a
// jobsite crew behind one NAT address legitimately produces more traffic here.
// Still far below what walking the slug space would need.
//
// EXPORTED as a plain object so the test suite reads the threshold instead of
// hardcoding it — same convention as LANDING_RESOLVE_LIMIT and RESEND_CODE_LIMIT
// in referrer.js. Tuning these numbers must not break a test.
const BRANDING_RESOLVE_LIMIT = { windowMs: 5 * 60 * 1000, max: 60 };

const brandingResolveLimiter = rateLimit({
  windowMs: BRANDING_RESOLVE_LIMIT.windowMs,
  max: BRANDING_RESOLVE_LIMIT.max,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' },
});

// The neutral answer, built from the shared resolver rather than from a literal
// so it cannot drift from the defaults every other surface falls back to.
// resolveBrandingTheme(null) returns the full default token set.
function neutralBranding() {
  return resolveBrandingTheme(null);
}

// GET /api/branding/:slug — public, read-only, GET only.
//
// The 500 branch is deliberate and is NOT a hole in the anti-oracle rule above.
// A database failure is not slug-dependent, so it discloses nothing about which
// slugs exist. Answering a neutral 200 during an incident would be worse: a
// confident wrong answer, which is the exact posture landingResolve.js's header
// refuses for the same class of read. The chain treats a failed fetch as a
// non-answer and falls through to its next source, so the login screen still
// renders.
router.get('/api/branding/:slug', brandingResolveLimiter, async (req, res) => {
  try {
    // Format and reserved-label rules live inside resolveSlugToContractor, which
    // is the enforcement seam. Nothing about slug validity is decided here.
    const contractor = await resolveSlugToContractor(pool, req.params.slug);
    if (!contractor) return res.json(neutralBranding());

    const branding = await loadContractorBranding(pool, contractor.id);
    if (!branding) return res.json(neutralBranding());

    // SLUG DROPPED, DELIBERATELY. loadContractorBranding re-attaches it because
    // its landing-page callers need it (landingResolve.js:102). This endpoint
    // must not return it — see the NO SLUG IS ECHOED BACK note in the header.
    // Destructured away rather than deleted so the omission is visible at the
    // one line that performs it.
    const { slug: _slugNotReturned, ...theme } = branding;
    res.json(theme);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/branding/:slug' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.BRANDING_RESOLVE_LIMIT = BRANDING_RESOLVE_LIMIT;
