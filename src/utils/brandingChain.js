// ─────────────────────────────────────────────────────────────────────────────
// THE BRANDING RESOLUTION CHAIN — CD-24 / CD-25, spec D4 (C/DL-3b Phase 1)
//
// HOW A LOGIN SCREEN KNOWS WHOSE LOGO TO SHOW BEFORE ANYONE HAS LOGGED IN.
//
// CD-24 binds that the login screen contains NO branding logic of its own. It
// consults an ordered list and takes the first answer. That list is
// BRANDING_SOURCES below; the whole file exists so that "whose brand is this?"
// has exactly one implementation with exactly one order.
//
//   1    session        the authenticated contractor_id      (null this phase)
//   2    host           <slug>.roofmiles.com                 (null on app.*)
//   2.5  URL hint       ?brand=<slug>                        (new in 3b)
//   3    stored hint    localStorage 'rm_brand_hint'
//   4    deferred link  EXPLICIT NO-OP — the Capacitor slot
//   5    neutral        the RoofMiles defaults, always answers
//
// ── THE RULES THAT MAKE THIS SAFE (CD-24, binding) ──────────────────────────
//
// R1 — COSMETIC ONLY. Every source except session picks a LOGO and a PALETTE and
//      nothing else. A resolved slug is NEVER an input to tenancy: not a request
//      body, not a query parameter, not a field on anything sent to the server.
//      Someone typing ?brand=whatever sees a wrong logo and gains nothing. This
//      is enforced structurally — the resolver returns a branding payload with no
//      identity fields in it at all — and guard-proofed adversarially in
//      brandingChain.test.js.
//
// R2 — SESSION OVERRIDES AND REWRITES. Source 1 is first, so when it starts
//      answering (Phase 5) it wins outright, and the generic write-through below
//      rewrites the stored hint to the authenticated contractor. R2 therefore
//      needs no special case; it falls out of the ordering.
//
// R3 — LOGOUT PRESERVES THE HINT. Nothing in this file removes
//      BRAND_HINT_STORAGE_KEY. The logout seam itself is Phase 4.
//
// ── WHY SOURCE 2.5 EXISTS, since it is the one link the original spec lacked ──
// localStorage is scoped PER ORIGIN. The branded landing page lives on
// <slug>.roofmiles.com and the React app on app.roofmiles.com — different
// origins — so the landing page cannot write a hint the login screen can read.
// Without this source the core funnel breaks visibly: homeowner scans a rep's QR
// code, sees a fully branded landing page, signs up, verifies, and lands on a
// NEUTRAL RoofMiles login screen. Signup mints no session, so that handoff always
// passes through login.
//
// ── THE ONE PIECE OF CLEVERNESS, STATED PLAINLY ─────────────────────────────
// GET /api/branding/:slug must not disclose whether a slug resolved — answering
// would make it a tenant-roster oracle (see that file's header). So it returns
// the neutral defaults for unknown, malformed AND reserved slugs alike, and a
// caller cannot ask it "did that work?".
//
// The chain therefore INFERS a non-answer: a payload equal to the platform
// defaults means "no contractor was identified", and the source reports null so
// the next link gets a turn. isNeutralBranding() is that inference. Its
// soundness rests on one fact — contractors.name is NOT NULL and
// resolveBrandingTheme falls back to it, so a real contractor ALWAYS returns
// their own companyName even with every colour unset. See that function for the
// two ways the inference can still be wrong, and why both are harmless.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveBrandingTheme } from './brandingTheme.mjs';
import { BACKEND_URL } from '../config/contractor';
// Extracted to a shared helper in Phase 4 — authStorage.js needs the identical
// guard now that the bearer token lives in localStorage too.
import { safeLocalStorage } from './safeStorage';

// ⚠ THE FIRST AND ONLY localStorage KEY IN THIS CODEBASE, AND THAT IS DELIBERATE
// (spec D5). Everything else here uses sessionStorage, and this is not an
// oversight or an inconsistency: sessionStorage dies with the tab, which is
// precisely the case this key exists to serve — a returning visitor seeing their
// contractor's brand before they type anything.
//
// The existing convention is right for what it governs: TOKENS belong in
// sessionStorage. This is not a token. It is a cosmetic hint that grants nothing,
// which is what makes a longer-lived store acceptable for it and not for them.
//
// PREFIXED rm_ RATHER THAN rb_, on purpose. rb_* is credential-adjacent state
// (rb_token). A future logout that clears "the rb keys" must not take the brand
// hint with it — CD-24 R3 requires the hint to survive logout.
export const BRAND_HINT_STORAGE_KEY = 'rm_brand_hint';

// The payload GET /api/branding/:slug returns for anything it declines to
// resolve. Built from the shared resolver rather than written out, so it cannot
// drift from what the endpoint actually sends.
const NEUTRAL_BRANDING = Object.freeze(resolveBrandingTheme(null));

/**
 * True when a branding payload is the platform's neutral default set — i.e. the
 * endpoint declined to identify a contractor.
 *
 * See THE ONE PIECE OF CLEVERNESS in this file's header for why this inference
 * is necessary. It is an INFERENCE, not a fact the endpoint reported, so it has
 * false negatives. There are TWO, and neither changes the design:
 *
 *   1. A CONTRACTOR WHO NEVER CUSTOMISED THEIR BRANDING. If every stored value
 *      still equals BRANDING_THEME_DEFAULTS — no logo, no colours, and a company
 *      name that also matches — the payload is byte-identical to the neutral one
 *      and this returns true, so the chain keeps walking and eventually answers
 *      neutral. CONSEQUENCE IS NIL: neutral IS what that contractor's own
 *      branding resolves to, so the user sees exactly the same pixels either way.
 *      The only thing lost is the write-through of a hint that would have
 *      resolved to the same palette on the next visit.
 *
 *   2. A CONTRACTOR LITERALLY NAMED 'RoofMiles'. The narrower case of (1), and
 *      the only one where the company NAME collides rather than merely the
 *      colours. That name belongs to the platform, so in practice this is the
 *      platform being mistaken for itself.
 *
 * ⚠ DO NOT READ (2) AS THE ONLY ROUTE. It is the memorable one, not the general
 * one — the general one is (1), and a future reader who "fixes" the name
 * collision alone will not have closed anything.
 *
 * Closing either properly would require the endpoint to report whether the slug
 * resolved, which is precisely the tenant-roster disclosure it refuses. That
 * trade is deliberate: a cosmetic mis-resolution that produces identical pixels
 * is cheaper than an endpoint that enumerates the platform's tenants.
 *
 * A missing or malformed payload counts as neutral: there is no contractor in it
 * either way, and the caller's next step is identical.
 *
 * @param {object|null|undefined} theme
 * @returns {boolean}
 */
export function isNeutralBranding(theme) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return true;

  const neutralKeys = Object.keys(NEUTRAL_BRANDING);
  // A DIFFERENT KEY COUNT MEANS NOT NEUTRAL. resolveBrandingTheme omits `address`
  // and `website` rather than nulling them, so a contractor carrying either has
  // strictly more keys than the neutral set — and is correctly not neutral.
  if (Object.keys(theme).length !== neutralKeys.length) return false;

  return neutralKeys.every(key => theme[key] === NEUTRAL_BRANDING[key]);
}

// Reads the contractor label out of a hostname, or null.
//
// DELIBERATELY MINIMAL, AND DELIBERATELY NOT A MIRROR OF
// server/utils/contractorSlug.js's extractSlugFromHost. The format rule and the
// reserved denylist are SERVER-SIDE FACTS; copying eighteen reserved labels into
// the bundle would create a second list to keep in agreement, and this codebase
// has already been bitten once by exactly that shape (see brandingTheme.js's
// header on the palette drift). The server applies both rules and answers neutral
// for anything it refuses, which the chain reads as a non-answer.
//
// So all this needs to do is decide whether the host carries a subdomain at all.
//
// THE LABEL-COUNT RULE, same as the server's: a host needs MORE THAN TWO labels
// to carry a subdomain. 'roofmiles.com' is the bare apex and 'localhost' is one
// label. The numeric guard stops '127.0.0.1' from offering '127' as a candidate
// and spending a request to be told no.
function hostLabel(hostname) {
  if (typeof hostname !== 'string') return null;

  let host = hostname.trim().toLowerCase();
  if (host === '') return null;
  if (host.startsWith('[')) return null;               // bracketed IPv6 literal

  const colon = host.indexOf(':');
  if (colon !== -1) host = host.slice(0, colon);        // strip the port
  if (host.endsWith('.')) host = host.slice(0, -1);     // trailing root dot
  if (/^[\d.]+$/.test(host)) return null;               // bare IPv4

  const labels = host.split('.');
  if (labels.length <= 2) return null;

  return labels[0] || null;
}

// Asks the branding endpoint about one slug and turns the reply into an answer or
// a non-answer. The single place a slug is allowed to touch the network.
//
// THREE OUTCOMES, TWO OF THEM null:
//   the endpoint identified a contractor  -> { branding, slug }
//   the endpoint returned neutral         -> null  (it declined; see the header)
//   the call failed                       -> null  (a non-answer, never a crash)
//
// A FAILED FETCH IS A NON-ANSWER RATHER THAN A NEUTRAL ANSWER, and the difference
// matters: returning neutral here would stop the chain at this link and prevent
// every later source from being tried during a transient network blip.
//
// ⚠ THE try/catch IS NOT BELT-AND-BRACES — IT IS WHERE THE RULE LIVES. Without
// it, a REJECTING fetcher propagates straight out of resolveBranding and blanks
// the login screen. fetchBrandingFromApi catches its own errors and returns null,
// so production never rejects today — but that makes the safety a property of ONE
// CALLER rather than of the chain, and the chain is what other code plugs into: a
// test double, a future source, the Capacitor fetcher that fills the source-4 slot.
//
// A COSMETIC BRANDING LOOKUP MUST NEVER BE ABLE TO TAKE DOWN THE LOGIN SCREEN. It
// selects a logo; its worst possible outcome is the wrong logo. Asserted in
// brandingChain.test.js under 'a failing branding lookup can never white-screen
// the login' — added after Phase 1's Step 5 browser check exercised this path with
// no backend reachable and nothing asserted it.
async function brandingForSlug(ctx, slug) {
  if (typeof slug !== 'string' || slug.trim() === '') return null;

  let theme = null;
  try {
    theme = await ctx.fetchBranding(slug);
  } catch {
    return null;   // a non-answer — the next source gets its turn
  }

  // Also covers a fetcher that resolves to undefined, a string, or a number:
  // isNeutralBranding treats anything that is not a branding object as neutral,
  // i.e. as "no contractor identified".
  if (isNeutralBranding(theme)) return null;

  return { branding: theme, slug };
}

// ── SOURCE 1 — SESSION ───────────────────────────────────────────────────────
// Branding for the authenticated session. Returns null before anyone has logged
// in, which on the login screen is always.
//
// IT RETURNS null UNCONDITIONALLY THIS PHASE, AND THAT IS A REAL ANSWER RATHER
// THAN A STUB. There is still no endpoint this source can ask, and there is no
// referrer-session equivalent at all (verified, C/DL-3b Phase 1 Step 1).
//
// ⚠ ONE CLAUSE HERE WENT STALE AND IS CORRECTED (Admin Brand Retirement Phase
// 2B). It used to read "GET /api/admin/me returns no branding and no
// contractor_id". The first half is no longer true — /me now carries a branding
// block, which is how the ADMIN PANEL learns its contractor (spec D-H).
//
// THAT DOES NOT MAKE IT A SOURCE FOR THIS CHAIN, and the reason is sharper than
// the old one rather than weaker. Every source here returns { branding, slug },
// because the slug is what the generic write-through below stores as the hint.
// /me deliberately carries NO SLUG AND NO contractor_id (CD-24 R1) — tenancy is
// proven by the session there, so an identifier in the reply would be a
// disclosure with no capability behind it. A source built on /me could resolve
// branding and would still have nothing to write through.
//
// Wiring this source is C/DL-3c's (spec D-J): it needs the contractors.slug
// backfill, and it reopens the deliberate non-enumerability of
// GET /api/branding/:slug at PRE_LAUNCH_CHECKLIST.md:139-143. When it lands, R2
// falls out of the ordering with no further change here — source 1 is first, so
// it wins and the write-through rewrites the stored hint.
// eslint-disable-next-line no-unused-vars
export async function resolveFromSession(ctx) {
  return null;
}

// ── SOURCE 2 — HOST ──────────────────────────────────────────────────────────
// The contractor subdomain the app is being served from.
//
// ⚠ THIS CORRECTLY RETURNS null ON app.roofmiles.com, WHICH IS WHERE THE REACT
// APP ACTUALLY LIVES. 'app' is a reserved slug, so the endpoint declines it and
// this source reports "I cannot answer" — NOT "the answer is RoofMiles". If it
// answered, the chain would stop here and sources 2.5 and 3 would never run,
// which is exactly the funnel break source 2.5 was added to fix. Asserted
// deliberately in brandingChain.test.js under CD-23. Please do not "fix" it.
export async function resolveFromHost(ctx) {
  const label = hostLabel(ctx.hostname);
  if (!label) return null;
  return brandingForSlug(ctx, label);
}

// ── SOURCE 2.5 — URL HINT ────────────────────────────────────────────────────
// ?brand=<slug>, handed over by the branded landing page across the origin
// boundary localStorage cannot cross. See the header for why this link exists.
//
// COSMETIC ONLY (R1). The value is attacker-controlled by definition — it is a
// query parameter — and the only thing it can do is select a logo and a palette.
export async function resolveFromUrlHint(ctx) {
  let slug = null;
  try {
    slug = new URLSearchParams(ctx.search || '').get('brand');
  } catch {
    return null;   // a malformed query string is a non-answer, never a crash
  }
  if (!slug) return null;
  return brandingForSlug(ctx, slug);
}

// ── SOURCE 3 — STORED HINT ───────────────────────────────────────────────────
// What a previous visit wrote through. This is the link that makes a returning
// visitor see their contractor's brand before typing anything.
//
// STORAGE ACCESS IS WRAPPED because it genuinely throws: Safari private mode and
// hardened browser profiles raise SecurityError on localStorage access rather
// than returning null. A cosmetic hint must never be able to take down the login
// screen.
export async function resolveFromStoredHint(ctx) {
  let slug = null;
  try {
    slug = ctx.storage?.getItem(BRAND_HINT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!slug) return null;
  return brandingForSlug(ctx, slug);
}

// ── SOURCE 4 — DEFERRED DEEP LINK ────────────────────────────────────────────
// ⚠ AN EXPLICIT NO-OP, AND IT IS SUPPOSED TO BE. DO NOT DELETE IT.
//
// THE SLOT IS THE DELIVERABLE (CD-25). This is where the Capacitor session
// plugs in the install-time payload — Android's install-referrer, iOS's disclosed
// clipboard — which is what makes the native app contractor-branded on FIRST
// LAUNCH, before any login, with no tab to close and no incognito mode to lose
// the hint to. That work fills this function in; it must not also have to reopen
// the login screen to find somewhere to put it.
//
// A function that always returns null is the obvious thing to tidy away, which is
// precisely why brandingChain.test.js asserts this slot's presence AND its
// position in the sequence.
// eslint-disable-next-line no-unused-vars
export async function resolveFromDeferredLink(ctx) {
  return null;
}

// ── SOURCE 5 — NEUTRAL ───────────────────────────────────────────────────────
// The platform's own defaults. ALWAYS ANSWERS — it is what makes the chain total,
// so no caller ever has to handle "nothing resolved".
//
// RETURNS resolveBrandingTheme(null), which IS BRANDING_THEME_DEFAULTS expressed
// in the resolver's output shape. Same values; the extra always-present nulls
// (programName, logoUrl, phone, email) mean every source in this file returns one
// consistent shape, so a consumer never has to know which link answered.
//
// slug IS null, NOT A PLACEHOLDER, and that is what suppresses the write-through:
// there is no contractor to remember. Writing a hint here would make the neutral
// fallback sticky and stop a later real hint from ever being tried first.
// eslint-disable-next-line no-unused-vars
export async function resolveNeutral(ctx) {
  return { branding: { ...NEUTRAL_BRANDING }, slug: null };
}

// THE CHAIN. Order is the entire contract — see the table in this file's header
// and spec D4. Frozen so it cannot be reordered or extended at runtime.
//
// `order` carries the spec's own numbering, including the 2.5 half-step, so the
// table and the code stay readable against each other. It is documentation that
// the tests can assert, not a sort key — the array order is what runs.
export const BRANDING_SOURCES = Object.freeze([
  Object.freeze({ id: 'session',  order: 1,   resolve: resolveFromSession }),
  Object.freeze({ id: 'host',     order: 2,   resolve: resolveFromHost }),
  Object.freeze({ id: 'url',      order: 2.5, resolve: resolveFromUrlHint }),
  Object.freeze({ id: 'stored',   order: 3,   resolve: resolveFromStoredHint }),
  Object.freeze({ id: 'deferred', order: 4,   resolve: resolveFromDeferredLink }),
  Object.freeze({ id: 'neutral',  order: 5,   resolve: resolveNeutral }),
]);

// Persists the winning slug as the source-3 hint for next time (spec D5).
//
// SWALLOWS ITS OWN FAILURE, deliberately. A full quota or a blocked store costs
// the next visit its branded first paint; a throw here would cost this visit its
// login screen.
function persistBrandHint(ctx, slug) {
  try {
    ctx.storage?.setItem(BRAND_HINT_STORAGE_KEY, slug);
  } catch {
    // ignored on purpose — see above
  }
}

// Builds the default browser context. Split out from resolveBranding so every
// source is testable against injected inputs rather than against globals.
export function createBrandingContext(overrides = {}) {
  return {
    hostname: window.location.hostname,
    search: window.location.search,
    storage: safeLocalStorage(),
    fetchBranding: fetchBrandingFromApi,
    // Phase 5 supplies this once the login response carries branding.
    session: null,
    ...overrides,
  };
}

// The one network call in this file. Never throws: a failed lookup is a
// non-answer and the chain moves on.
//
// The slug is URL-ENCODED into the path and appears nowhere else — no body, no
// extra query parameter, no header. That is R1 at the transport layer.
async function fetchBrandingFromApi(slug) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/branding/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Walks the chain and returns the first answer.
 *
 * @param {object} [ctx] - resolution inputs; defaults to the live browser.
 * @returns {Promise<{branding: object, source: string}>} `branding` is
 *          resolveBrandingTheme's output shape and carries NO identity field
 *          (R1). `source` is the id of the link that answered — diagnostics and
 *          tests only; nothing downstream should branch on it.
 * @throws if every link declined, which cannot happen while source 5 is present.
 *         Throwing beats returning undefined: an unstyled surface with nothing
 *         logged is the failure mode this whole file exists to avoid.
 */
export async function resolveBranding(ctx = createBrandingContext()) {
  for (const source of BRANDING_SOURCES) {
    const answer = await source.resolve(ctx);
    if (!answer) continue;

    // WRITE-THROUGH (D5). Whichever link answered, remember its slug so the next
    // visit can resolve at source 3. Source 5 carries no slug and so writes
    // nothing — see resolveNeutral.
    if (answer.slug) persistBrandHint(ctx, answer.slug);

    return { branding: answer.branding, source: source.id };
  }

  throw new Error(
    'brandingChain: every source declined — source 5 (neutral) must always answer. ' +
    'BRANDING_SOURCES has been altered.'
  );
}
