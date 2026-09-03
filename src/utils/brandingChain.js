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
//   1    session        the authenticated contractor_id      (BR-1 Phase 1)
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
// R2 — SESSION OVERRIDES AND REWRITES. Source 1 is first, so it wins outright,
//      and the write-through corrects the stored hint to the authenticated
//      contractor.
//      ⚠ THIS PARAGRAPH USED TO END "R2 therefore needs no special case; it
//      falls out of the ordering", and that was the sentence that let the rule
//      go unimplemented for the whole of C/DL-3b. It falls out of the ordering
//      ONLY ONCE SOURCE 1 ANSWERS — which it did not, so the guarantee was never
//      once available, and a hint planted by a link outlived every subsequent
//      visit. R2 now has a special case (see the write-through) and it is a
//      TWO-BRANCH one: source 1 carries the session contractor's own slug, so
//      the correction SUBSTITUTES the hint — and falls back to REMOVING it only
//      for a contractor whose `contractors.slug` is NULL and which therefore
//      cannot be named in the hint at all. Do not "simplify" either branch back
//      into the ordering.
//      ⚠ THIS READ "the contractor a session names HAS NO SLUG to rewrite the
//      hint TO, so the correction is a removal" for one commit, and that
//      removal-for-every-contractor was a REGRESSION: it erased the legitimate
//      hint that gives a returning signed-out visitor their own contractor's
//      login screen, not merely a planted one. Fixed in BR-1 Phase 1-B.
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
// BR-1 Phase 1. Source 1 needs the stored bearer token to ask the server whose
// session this is. READ-ONLY: nothing here writes, clears or interprets a token —
// it is handed to one fetcher as an Authorization header and never inspected.
import { getAdminToken, getReferrerToken } from './authStorage';

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
// Branding for the authenticated session: the contractor the SERVER says this
// token belongs to. Returns null before anyone has logged in, which on the login
// screen is always.
//
// ⚠ THIS FUNCTION WAS `return null` — THE WHOLE BODY — UNTIL BR-1 PHASE 1, AND
// THE HEADER THAT USED TO SIT HERE ARGUED IT SHOULD STAY THAT WAY. It said
// wiring this source needs the `contractors.slug` BACKFILL and its MINT PATH,
// and that it reopens the deliberate non-enumerability of
// GET /api/branding/:slug. Both claims were true of the design being imagined —
// a source that resolves a SLUG and writes it through — and neither is forced.
// BR Phase 0 §3.7 measured the alternative: GET /api/admin/me already resolves
// branding from a session's contractor_id with NO SLUG ANYWHERE IN THE PATH, and
// has shipped. The slug was only ever needed by the write-through, and an
// answer that carries none simply skips it — which is what source 5 already
// does. So the blockers belonged to a bundled design, not to this source.
//
// ── WHAT ITS ABSENCE COST, because three symptoms had one cause ──────────────
// Source 1 is FIRST. While it declined, an AUTHENTICATED user's branding was
// decided by whatever their own browser supplied — a `?brand=` parameter, a
// localStorage hint, or nothing:
//   (a) a logged-in user on a device with no hint saw platform branding;
//   (b) ContactModal rendered EMPTY, because `phone` and `email` are the only
//       two fields with no platform default, so they vanished where the others
//       merely painted the wrong thing;
//   (c) a planted `?brand=` was PERMANENT — see the write-through in
//       resolveBranding for why that is a security boundary and not a cosmetic
//       annoyance.
//
// ── WHY THIS IS THE ONLY SOURCE THAT MAY NOT USE isNeutralBranding ───────────
// The other three read a neutral-looking payload as "the endpoint declined",
// because GET /api/branding/:slug refuses to say whether a slug resolved. This
// route has no such ambiguity: it is authenticated, and a 200 with a branding
// block IS the caller's own contractor. Applying that inference here would
// silently discard the branding of every contractor who has customised nothing
// and fall through to a hint — reading "this contractor set no colours" as "no
// contractor was identified", which is precisely the false negative the
// inference's own docblock warns is the general case.
//
// ── NO NETWORK CALL WITHOUT A TOKEN ─────────────────────────────────────────
// The signed-out path returns before the fetcher is reached. Every visitor to
// the login screen is on that path, and a request that can only ever 401 is a
// round-trip in front of the first paint for all of them.
export async function resolveFromSession(ctx) {
  const token = ctx.sessionToken;
  if (typeof token !== 'string' || token.trim() === '') return null;

  let answer = null;
  try {
    answer = await ctx.fetchSessionBranding(token);
  } catch {
    return null;   // a non-answer — the next source gets its turn
  }

  // THE GUARD MATCHES ITS OWN VALUE'S SHAPE, and it is deliberately not the
  // isNeutralBranding() call its three siblings make — see above for why. What
  // it must exclude is a non-answer wearing an object's clothes: `{}` from a
  // super-admin session, `null` from a 401, and the string/number/undefined
  // shapes a misbehaving fetcher produces. `companyName` is the field that
  // cannot legitimately be absent — `contractors.name` is NOT NULL and the
  // resolver falls back to it — so its presence is what separates a real theme
  // from every one of those.
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const theme = answer.branding;
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return null;
  if (typeof theme.companyName !== 'string' || theme.companyName === '') return null;

  // ── THE SLUG, AND BOTH BRANCHES IT FEEDS (BR-1 Phase 1-B) ─────────────────
  // This line was `slug: null` unconditionally, with a note saying source 1 had
  // no slug to offer. It has one now — the session's OWN contractor's, derived
  // server-side — and the generic write-through in resolveBranding needed NO
  // change to use it: a truthy slug REWRITES the hint (R3), a null one REMOVES
  // it (R4).
  //
  // ⚠ RE-NORMALISED HERE RATHER THAN TRUSTED FROM THE FETCHER. The real fetcher
  // already collapses absent/empty to null, but `ctx.fetchSessionBranding` is an
  // injection point — a test double, a future native fetcher — and the two
  // branches turn on truthiness. A `''` reaching the write-through would take
  // neither branch correctly: falsy, so it clears rather than writes, while
  // looking in the payload exactly like a slug that was supplied.
  //
  // `authoritative` STAYS, and it is not redundant with the slug. It is what
  // distinguishes source 1's `slug: null` — "the contractor is known and has no
  // slug", so REMOVE the hint — from source 5's identical-looking `slug: null`,
  // which means "no contractor was identified" and must leave a good hint alone.
  const slug = (typeof answer.slug === 'string' && answer.slug.trim() !== '')
    ? answer.slug
    : null;

  return { branding: theme, slug, authoritative: true };
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

// Removes the source-3 hint. Called ONLY when an authoritative source answered
// and had no slug to write in its place — see the write-through in
// resolveBranding for why that is CD-24 R2 rather than a contradiction of D5.
//
// ⚠ REMOVE, NOT setItem(key, ''). An empty string is a value: source 3 would
// read it, `if (!slug) return null` would treat it as absent this time, and the
// key would sit there looking like a hint that had been set. Removing is the
// only operation that leaves the store in the state it was in before any hint
// was ever written.
//
// SWALLOWS ITS OWN FAILURE for the same reason persistBrandHint does. A hardened
// profile that refuses the write must not cost this visit its surface — the
// planted hint is then still there, which is the state we were already in.
function clearBrandHint(ctx) {
  try {
    ctx.storage?.removeItem(BRAND_HINT_STORAGE_KEY);
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
    // ── SOURCE 1'S TWO INPUTS (BR-1 Phase 1) ─────────────────────────────────
    // These replace a `session: null` slot whose comment read "Phase 5 supplies
    // this once the login response carries branding." That design was abandoned:
    // putting branding on the LOGIN response would answer only for the moment
    // someone signs in, and leave every subsequent boot — the common case, and
    // the one that produced the reported symptoms — with nothing to read.
    //
    // ⚠ READ AT CONTEXT-BUILD TIME, NOT AT MODULE LOAD. createBrandingContext()
    // is called inside BrandingProvider's effect, so the token is whatever
    // storage holds at the moment resolution runs. That is what lets a
    // re-resolution after login see the credential login just wrote.
    sessionToken: readSessionToken(),
    fetchSessionBranding: fetchSessionBrandingFromApi,
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

// Source 1's network call (BR-1 Phase 1). Never throws: a failed lookup is a
// non-answer and the chain moves on, exactly as it does for a slug lookup.
//
// ⚠ THE TOKEN TRAVELS IN THE Authorization HEADER AND NOWHERE ELSE — not in the
// path, not in a query parameter. A bearer credential in a URL is copied into
// server logs, proxy logs and browser history by machinery nobody owns; the slug
// fetcher above has the opposite constraint for the opposite reason (a slug is
// public and belongs in the path).
//
// THE CONTRACTOR IS NOT NAMED IN THE REQUEST AT ALL. The server derives it from
// the session row, which is what makes this source unspoofable in the way
// sources 2, 2.5 and 3 are not — see R1 in this file's header.
//
// NORMALISES THE ENVELOPE, and since BR-1 Phase 1-B it keeps BOTH halves. The
// route answers `{ branding, slug }` for a contractor that has a slug,
// `{ branding }` for one whose `contractors.slug` is NULL, and `{}` for a
// session with no contractor at all (a super admin) — the same D-I convention
// GET /api/admin/me follows, where a key's ABSENCE says "resolution did not
// happen" rather than "resolved to nothing". A missing `branding` collapses to
// the non-answer the chain already understands.
//
// ⚠ THIS RETURNED THE BARE THEME UNTIL 1-B, AND THE SLUG IS WHY IT CHANGED. The
// hint stores a SLUG, so an authenticated answer could not REWRITE the hint
// without one — CD-24 R2's correction degraded to a removal, which erased a
// returning visitor's branded login screen along with any planted value. Source
// 1 needs the slug for the write-through and for nothing else; it never reaches
// the published branding object.
//
// THE SLUG IS NORMALISED TO null WHEN ABSENT OR EMPTY, so exactly one shape
// reaches the write-through's truthiness test. A `''` arriving from a future
// server change would otherwise be stored as a hint that exists and resolves to
// nothing.
async function fetchSessionBrandingFromApi(token) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/session/branding`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload || typeof payload !== 'object' || !payload.branding) return null;
    const slug = typeof payload.slug === 'string' && payload.slug.trim() !== ''
      ? payload.slug
      : null;
    return { branding: payload.branding, slug };
  } catch {
    return null;
  }
}

// The stored bearer token for whichever surface this browser last signed into,
// or null.
//
// ⚠ THE TEAM TOKEN IS TRIED FIRST, AND THE ORDER MIRRORS App.jsx's BOOT
// REHYDRATION DELIBERATELY. A device that used both surfaces before C/DL-3b
// Phase 5 can still hold two stale-but-valid tokens, and boot resolves that
// ambiguity in favour of the team session. If branding resolved the other way
// round, a team member holding an old homeowner token would be routed to their
// team surface while it painted the brand of whichever session the OTHER token
// belonged to. Neither token is an escalation — both are credentials the person
// legitimately holds — but the two answers must agree, and agreement here means
// asking in the same order.
function readSessionToken() {
  return getAdminToken() || getReferrerToken() || null;
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
    //
    // ── CD-24 R2 USES BOTH BRANCHES, AND WHICH ONE IS THE CONTRACTOR'S DOING ──
    // R2: an authenticated answer OVERRIDES AND REWRITES the hint. Source 1 is
    // the only authoritative link — its answer comes from the session's own
    // contractor, server-side. It now carries that contractor's OWN SLUG when
    // one exists, so R2 is a SUBSTITUTION on the first branch, and a REMOVAL on
    // the second only when the contractor genuinely has no slug to name.
    //
    // ⚠ THIS BLOCK CLAIMED SOURCE 1 "CARRIES NO SLUG", CITING BR Phase 0
    // §3.6/§3.7 — that resolution needs no slug and that echoing one would
    // reopen the endpoint's non-enumerability. The first half is still true and
    // is why §3.7 was right to unblock on it. The second was wrong in a way that
    // COST A REGRESSION: the posture protects against discovering OTHER
    // contractors' slugs, and an authenticated route returning the caller's own
    // discloses nothing. Meanwhile removal-for-want-of-a-slug erased the
    // legitimate hint that made a returning signed-out visitor see their own
    // contractor, alongside any planted one. Fixed in BR-1 Phase 1-B.
    // ⚠ AND THE PREMISE WAS FALSE TOO, NOT MERELY THE CONCLUSION: this said
    // `contractors.slug` "has no backfill and no mint path", implying no slug
    // existed to echo. The production contractor's slug was already set. A
    // deferral written against a trigger that had already fired can never fire.
    //
    // ⚠ SO `slug: null` MEANS TWO DIFFERENT THINGS HERE AND THE FLAG IS WHAT
    // SEPARATES THEM. Source 5's null means "there is no contractor to remember"
    // and must leave a good hint alone; source 1's means "the contractor is
    // known and has no slug", and the hint that MATCHES that contractor is no
    // hint at all. Reading the null alone would make neutral wipe the hint on
    // every signed-out visit — the opposite of D5.
    //
    // ⚠ WHY THIS IS THE SECURITY FIX RATHER THAN TIDINESS. A `?brand=` value is
    // deliverable as a LINK, source 2.5 persists it, and nothing in this chain
    // has ever removed it. Without this branch a planted hint survives every
    // subsequent visit on that device, including signed-out ones. R2 promised
    // the correction and could never deliver it while source 1 returned null.
    if (answer.slug) persistBrandHint(ctx, answer.slug);
    else if (answer.authoritative) clearBrandHint(ctx);

    return { branding: answer.branding, source: source.id };
  }

  throw new Error(
    'brandingChain: every source declined — source 5 (neutral) must always answer. ' +
    'BRANDING_SOURCES has been altered.'
  );
}
