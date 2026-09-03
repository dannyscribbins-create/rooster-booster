// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b PHASE 1 STEP 3 — THE BRANDING RESOLUTION CHAIN (CD-24 / CD-25)
//
// WHAT THIS SUITE PINS. The ordered list a pre-auth screen consults to answer
// "whose logo do I show?", and — more importantly — the RULES that keep that
// answer cosmetic. The chain is the mechanism; R1 is the reason it is safe.
//
// THE LOAD-BEARING TEST IN THIS FILE is 'CHAIN COMPOSITION AND ORDER'. CD-25
// requires it by name and requires it GREEN, because source 4 is a no-op that
// the Capacitor session fills in later. Without a test asserting the slot exists
// in sequence, a tidying pass deletes a function that does nothing and the
// deferred-deep-link work reopens login to put it back.
//
// ⚠ THE OTHER LOAD-BEARING TEST IS THE R1 GUARD-PROOF. Every source except
// session is COSMETIC ONLY: a resolved slug picks a logo and a palette and must
// never reach a tenancy-bearing field. That is asserted adversarially — the test
// tries to make ?brand= leak and proves it cannot — rather than by inspection.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS anywhere in this file (house rule).
// ─────────────────────────────────────────────────────────────────────────────

import { resolveBrandingTheme, BRANDING_THEME_DEFAULTS } from './brandingTheme.mjs';
import {
  BRAND_HINT_STORAGE_KEY,
  BRANDING_SOURCES,
  isNeutralBranding,
  resolveBranding,
  resolveFromSession,
  resolveFromHost,
  resolveFromUrlHint,
  resolveFromStoredHint,
  resolveFromDeferredLink,
  resolveNeutral,
} from './brandingChain';

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';
const SLUG_BOGUS = 'nosuchroofer';

const APEX = 'roofmiles.com';
// The host the React app is actually served from. 'app' is a RESERVED slug
// (server/utils/contractorSlug.js RESERVED_SLUGS), which is why source 2 must
// return null here — see the CD-23 test below before "fixing" anything.
const APP_HOST = `app.${APEX}`;

const BRAND_A = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Alpha Roofing Co',
  primary_color: '#AA1111',
  secondary_color: '#AA2222',
  accent_color: '#AA4444',
  landing_bg_color: '#AA3333',
  logo_url: 'https://cdn.test.invalid/alpha-logo.png',
}));

const BRAND_B = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Beta Roofing Co',
  primary_color: '#BB1111',
  secondary_color: '#BB2222',
  accent_color: '#BB4444',
  landing_bg_color: '#BB3333',
}));

// What GET /api/branding/:slug returns for anything it declines to resolve.
const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

// A localStorage stand-in. Deliberately NOT jsdom's real localStorage: these
// tests must prove the chain reads and writes the key it claims to, and a shared
// global would let one test's write satisfy another test's read.
function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: vi.fn(k => (map.has(k) ? map.get(k) : null)),
    setItem: vi.fn((k, v) => { map.set(k, String(v)); }),
    removeItem: vi.fn(k => { map.delete(k); }),
    _map: map,
  };
}

// A stand-in for GET /api/branding/:slug. `table` maps slug -> payload; anything
// absent gets the neutral defaults, exactly as the real endpoint does for an
// unknown, malformed or reserved slug.
function makeFetchBranding(table = {}, { fail = false } = {}) {
  return vi.fn(async (slug) => {
    if (fail) return null;
    return table[slug] ? { ...table[slug] } : { ...NEUTRAL };
  });
}

// A stand-in for GET /api/session/branding. `table` maps token ->
// `{ branding, slug }`; anything absent gets `null`, exactly as the real fetcher
// does for a 401 or a failed call.
//
// ⚠ THE ENTRY IS THE ENVELOPE, AND IT IS EXPLICIT RATHER THAN INFERRED (BR-1
// Phase 1-B). This double returned a bare THEME until 1-B, because source 1 had
// no slug to carry. It has one now, and the write-through branches on it —
// substitute the hint when there is a slug, remove it when there is not — so
// every fixture has to SAY which case it is. A double that defaulted a slug in
// would make the removal branch unreachable; one that defaulted it out would
// make the substitution branch unreachable. Neither would fail.
function makeFetchSessionBranding(table = {}, { fail = false } = {}) {
  return vi.fn(async (token) => {
    if (fail) return null;
    const entry = table[token];
    if (!entry) return null;
    if (!entry.branding) {
      throw new Error(
        'makeFetchSessionBranding: entries are { branding, slug } envelopes, not bare themes. ' +
        'Passing a theme silently produced a non-answer before this check existed.'
      );
    }
    return { branding: { ...entry.branding }, slug: entry.slug ?? null };
  });
}

function makeContext({
  hostname = APP_HOST,
  search = '',
  storage = makeStorage(),
  fetchBranding = makeFetchBranding(),
  // BR-1: source 1's two inputs. The DEFAULT IS "no session", which is what
  // every pre-BR-1 test in this file was implicitly written against — a signed-out
  // visitor at the login screen. Tests that mean to exercise source 1 opt in.
  sessionToken = null,
  fetchSessionBranding = makeFetchSessionBranding(),
} = {}) {
  return { hostname, search, storage, fetchBranding, sessionToken, fetchSessionBranding };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('CD-25 — chain composition and order', () => {

  // ⚠ THIS IS THE TEST CD-25 REQUIRES BY NAME, AND IT MUST STAY GREEN.
  it('composes exactly six links in the specified order', () => {
    expect(BRANDING_SOURCES.map(s => s.id)).toEqual([
      'session', 'host', 'url', 'stored', 'deferred', 'neutral',
    ]);
  });

  it('numbers the links per spec D4, including the 2.5 insertion', () => {
    // The half-step is not decoration. Source 2.5 was inserted BETWEEN host and
    // stored-hint because localStorage is per-origin: the branded landing page on
    // <slug>.roofmiles.com cannot write a hint the app on app.roofmiles.com can
    // read. Keeping the original numbering makes the spec table and the code
    // readable against each other.
    expect(BRANDING_SOURCES.map(s => s.order)).toEqual([1, 2, 2.5, 3, 4, 5]);
  });

  it('every link is a callable resolver', () => {
    for (const source of BRANDING_SOURCES) {
      expect(typeof source.resolve, `source '${source.id}' has no resolve()`).toBe('function');
    }
  });

  // THE SLOT, NOT THE BEHAVIOUR. Source 4 does nothing today and is supposed to.
  // Deleting a function that always returns null is the obvious tidy-up, and it
  // is exactly what this test exists to prevent — the Capacitor session
  // (Android install-referrer / iOS disclosed clipboard) fills this slot without
  // having to reopen the login screen to do it.
  it('keeps the source-4 deferred-deep-link slot present even though it is a no-op', () => {
    const deferred = BRANDING_SOURCES.find(s => s.id === 'deferred');
    expect(deferred, 'the source-4 slot has been removed — see CD-25').toBeTruthy();
    expect(deferred.order).toBe(4);
    expect(deferred.resolve).toBe(resolveFromDeferredLink);
  });

  it('the source list is frozen so the order cannot be mutated at runtime', () => {
    expect(Object.isFrozen(BRANDING_SOURCES)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('each source in isolation', () => {

  // ⚠ THIS TEST'S NARRATIVE WAS INVERTED BY BR-1 PHASE 1 AND IS CORRECTED, NOT
  // RETITLED. It read 'source 1 (session) returns null this phase — Phase 5 wires
  // it', and its comment said there was no session-branding endpoint in the
  // product. Both were true when written and are now false: GET
  // /api/session/branding exists and source 1 asks it. What the test PINS is
  // unchanged and is still worth pinning — the SIGNED-OUT path, which is every
  // visitor at the login screen.
  it('source 1 (session) returns null when there is no session, without touching the network', async () => {
    const fetchSessionBranding = makeFetchSessionBranding();
    const ctx = makeContext({ sessionToken: null, fetchSessionBranding });

    await expect(resolveFromSession(ctx)).resolves.toBeNull();
    // ⚠ THE SECOND ASSERTION IS THE ONE THAT CANNOT BE SATISFIED BY ACCIDENT. A
    // source that fired a request and discarded a 401 would also resolve null,
    // and would put an unauthenticated round-trip in front of every login screen.
    expect(fetchSessionBranding).not.toHaveBeenCalled();
  });

  it('source 2 (host) resolves a contractor subdomain', async () => {
    const ctx = makeContext({
      hostname: `${SLUG_A}.${APEX}`,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
    });
    const answer = await resolveFromHost(ctx);

    expect(answer.slug).toBe(SLUG_A);
    expect(answer.branding.companyName).toBe(BRAND_A.companyName);
  });

  // ⚠ CD-23 — THIS NULL IS CORRECT BEHAVIOUR. DO NOT "FIX" IT.
  it('source 2 (host) returns null on app.roofmiles.com, BY DESIGN', () => {
    // The React app is served from app.roofmiles.com. 'app' is a RESERVED slug,
    // so the branding endpoint declines it and returns the neutral defaults, and
    // this source correctly reports "I cannot answer" rather than "the answer is
    // RoofMiles". If it answered, the chain would stop here and sources 2.5 and 3
    // would never run — which would break the whole funnel: a homeowner arriving
    // from a branded landing page would land on a neutral login screen.
    //
    // A future reader who "fixes" this to return neutral branding has silently
    // deleted sources 2.5 and 3.
    const ctx = makeContext({ hostname: APP_HOST });
    return expect(resolveFromHost(ctx)).resolves.toBeNull();
  });

  it('source 2 (host) returns null for the bare apex and for localhost', async () => {
    for (const hostname of [APEX, 'localhost', '127.0.0.1', '']) {
      const answer = await resolveFromHost(makeContext({ hostname }));
      expect(answer, `'${hostname}' must not resolve a contractor`).toBeNull();
    }
  });

  it('source 2.5 (URL hint) resolves ?brand=<slug>', async () => {
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
    });
    const answer = await resolveFromUrlHint(ctx);

    expect(answer.slug).toBe(SLUG_A);
    expect(answer.branding.primaryColor).toBe(BRAND_A.primaryColor);
  });

  it('source 2.5 returns null when there is no ?brand= parameter', () => {
    // ⚠ THE FIXTURE PARAMETER IS DELIBERATELY 'exp' RATHER THAN THE OBVIOUS ONE.
    // server/test/linkGeneratorSweep.test.js sweeps server/ and src/ for a LITERAL
    // Scheme-B query-parameter string, skipping only directories named 'test' —
    // and colocated React tests live under src/, so any occurrence in this file
    // reads to that sweep as client-side invite-URL construction and fails it.
    // (Including one inside a comment, which is how this note got rewritten.)
    // 'exp' is a real parameter App.jsx already reads and carries no such meaning.
    return expect(resolveFromUrlHint(makeContext({ search: '?exp=abc' }))).resolves.toBeNull();
  });

  it('source 2.5 returns null for a slug the endpoint declines', () => {
    // The endpoint cannot say "that slug does not exist" without becoming a
    // tenant-roster oracle, so it returns the neutral defaults. The chain reads
    // that neutral payload as a NON-ANSWER and keeps walking.
    const ctx = makeContext({ search: `?brand=${SLUG_BOGUS}` });
    return expect(resolveFromUrlHint(ctx)).resolves.toBeNull();
  });

  it('source 3 (stored hint) resolves from localStorage', async () => {
    const ctx = makeContext({
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });
    const answer = await resolveFromStoredHint(ctx);

    expect(ctx.storage.getItem).toHaveBeenCalledWith(BRAND_HINT_STORAGE_KEY);
    expect(answer.slug).toBe(SLUG_B);
    expect(answer.branding.companyName).toBe(BRAND_B.companyName);
  });

  it('source 3 returns null when nothing is stored', () => {
    return expect(resolveFromStoredHint(makeContext())).resolves.toBeNull();
  });

  it('source 3 survives storage being unavailable', async () => {
    // Safari private mode and a hardened browser profile both make localStorage
    // throw on access rather than return null. A branding hint must never be able
    // to take down the login screen.
    const hostile = {
      getItem: () => { throw new DOMException('denied', 'SecurityError'); },
      setItem: () => { throw new DOMException('denied', 'SecurityError'); },
    };
    await expect(resolveFromStoredHint(makeContext({ storage: hostile }))).resolves.toBeNull();
  });

  it('source 4 (deferred deep link) is an explicit no-op returning null', () => {
    return expect(resolveFromDeferredLink(makeContext())).resolves.toBeNull();
  });

  it('source 5 (neutral) always answers, and answers with the platform defaults', async () => {
    const answer = await resolveNeutral(makeContext());

    expect(answer).toBeTruthy();
    expect(answer.branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
    expect(answer.branding.primaryColor).toBe(BRANDING_THEME_DEFAULTS.primaryColor);
    expect(answer.branding.secondaryColor).toBe(BRANDING_THEME_DEFAULTS.secondaryColor);
    expect(answer.branding.backgroundColor).toBe(BRANDING_THEME_DEFAULTS.backgroundColor);
    // No slug — there is no contractor to remember, so nothing is written through.
    expect(answer.slug).toBeNull();
  });

  it('a failed branding fetch is a non-answer, not a crash and not a neutral answer', async () => {
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      fetchBranding: makeFetchBranding({}, { fail: true }),
    });
    await expect(resolveFromUrlHint(ctx)).resolves.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('isNeutralBranding — how a non-disclosing endpoint is read', () => {

  // THIS HELPER IS WHY THE ENDPOINT CAN STAY NON-DISCLOSING. GET /api/branding
  // must not tell a caller whether a slug resolved — answering is exactly the
  // tenant-roster leak it refuses. So the chain infers it: a payload equal to the
  // platform defaults means "no contractor was identified".
  it('recognises the neutral payload', () => {
    expect(isNeutralBranding(NEUTRAL)).toBe(true);
  });

  it('does not mistake a real contractor for neutral', () => {
    expect(isNeutralBranding(BRAND_A)).toBe(false);
    expect(isNeutralBranding(BRAND_B)).toBe(false);
  });

  it('a contractor who has saved NO branding at all is still not neutral', () => {
    // The one case worth stating: contractors.name is NOT NULL and
    // resolveBrandingTheme's three-step chain falls back to it, so a contractor
    // who has never opened the Branding page still returns their OWN name. The
    // payload therefore differs from neutral even with every colour unset.
    const bare = resolveBrandingTheme({ contractor_name: 'Gamma Roofing Co' });
    expect(isNeutralBranding(bare)).toBe(false);
  });

  it('treats a missing or malformed payload as neutral', () => {
    for (const bad of [null, undefined, '', 0, 'nope', []]) {
      expect(isNeutralBranding(bad)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('resolveBranding — precedence and write-through', () => {

  it('first non-null wins: the URL hint beats a conflicting stored hint', async () => {
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A, [SLUG_B]: BRAND_B }),
    });
    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('url');
    expect(branding.companyName).toBe(BRAND_A.companyName);
  });

  it('the host beats the URL hint when both could answer', async () => {
    const ctx = makeContext({
      hostname: `${SLUG_B}.${APEX}`,
      search: `?brand=${SLUG_A}`,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A, [SLUG_B]: BRAND_B }),
    });
    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('host');
    expect(branding.companyName).toBe(BRAND_B.companyName);
  });

  it('falls all the way through to neutral when nothing can answer', async () => {
    const { branding, source } = await resolveBranding(makeContext());

    expect(source).toBe('neutral');
    expect(branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
  });

  it('sources after the winner are never consulted', async () => {
    // Proves the loop short-circuits rather than resolving everything and picking.
    // With ?brand= (source 2.5) answering, the stored hint (source 3) must not
    // even be READ, let alone looked up.
    //
    // ⚠ NOT ASSERTED AS "exactly one fetch". Source 2 runs BEFORE the winner and
    // legitimately queries the endpoint for the host label — on app.roofmiles.com
    // it asks about 'app' and is told neutral, which is how it learns to decline
    // (see the CD-23 test above). Counting total fetches would make this test fail
    // for correct behaviour. What it must prove is that nothing AFTER the winner
    // ran.
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B });
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      storage,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A, [SLUG_B]: BRAND_B }),
    });
    await resolveBranding(ctx);

    expect(ctx.fetchBranding).toHaveBeenCalledWith(SLUG_A);
    expect(storage.getItem, 'source 3 was consulted despite source 2.5 answering')
      .not.toHaveBeenCalled();
    expect(ctx.fetchBranding, 'the stored hint was looked up despite source 2.5 answering')
      .not.toHaveBeenCalledWith(SLUG_B);
  });

  // ── WRITE-THROUGH (spec D5) ────────────────────────────────────────────────

  it('persists the resolved slug to localStorage under rm_brand_hint', async () => {
    const storage = makeStorage();
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      storage,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
    });
    await resolveBranding(ctx);

    expect(storage.setItem).toHaveBeenCalledWith(BRAND_HINT_STORAGE_KEY, SLUG_A);
  });

  it('the key is exactly rm_brand_hint — prefixed apart from the rb_* token keys', () => {
    // D5. rb_* is credential-adjacent state; rm_* is cosmetic. The prefixes are
    // deliberately different so a future reader clearing "the rb keys" on logout
    // cannot take the brand hint with them (CD-24 R3).
    expect(BRAND_HINT_STORAGE_KEY).toBe('rm_brand_hint');
    expect(BRAND_HINT_STORAGE_KEY.startsWith('rb_')).toBe(false);
  });

  it('a later visit reads the hint back and resolves from it', async () => {
    const storage = makeStorage();
    const fetchBranding = makeFetchBranding({ [SLUG_A]: BRAND_A });

    // First visit — arrives from a branded landing page.
    const first = await resolveBranding(makeContext({
      search: `?brand=${SLUG_A}`, storage, fetchBranding,
    }));
    expect(first.source).toBe('url');

    // Second visit — no URL hint, same origin, same storage.
    const second = await resolveBranding(makeContext({
      search: '', storage, fetchBranding,
    }));
    expect(second.source).toBe('stored');
    expect(second.branding.companyName).toBe(BRAND_A.companyName);
  });

  it('does not write through when the neutral source answers', async () => {
    // There is no contractor to remember. Writing 'RoofMiles' as a hint would
    // make the neutral fallback sticky and prevent a later real hint from ever
    // being tried first.
    const storage = makeStorage();
    await resolveBranding(makeContext({ storage }));

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // ── CD-24 R3 ───────────────────────────────────────────────────────────────
  // ⚠ SCOPED TO THE UNAUTHENTICATED PATH BY BR-1 PHASE 1, AND THE TITLE MOVED
  // WITH IT. It read 'NOTHING in the chain clears rm_brand_hint' — which was a
  // true description of the chain when every source that could answer carried a
  // slug. Source 1 does not: it resolves from a session, and CD-24 R2 requires
  // an authenticated answer to REWRITE the hint. With no slug to write, the
  // rewrite is a removal, which is asserted in the BR-1 suite below.
  //
  // ⚠ R3 IS UNTOUCHED AND THIS TEST IS STILL ITS FENCE. R3 is about LOGOUT, and
  // its fixture here is a signed-out visitor — the case R3 governs. Deleting this
  // test because "the chain clears the hint now" would unfence R3 entirely; the
  // two rules coexist in the chain's own header and always did.
  it('nothing in the chain clears rm_brand_hint for a SIGNED-OUT visitor', async () => {
    // R3: logout preserves the hint. The logout seam itself is Phase 4; what this
    // phase owes is that nothing here removes the key.
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_A });
    const fetchBranding = makeFetchBranding({ [SLUG_A]: BRAND_A });

    await resolveBranding(makeContext({ storage, fetchBranding }));
    await resolveBranding(makeContext({ storage, fetchBranding, search: `?brand=${SLUG_B}` }));

    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage._map.has(BRAND_HINT_STORAGE_KEY)).toBe(true);
  });

  it('a hostile storage that throws on write does not break resolution', async () => {
    const hostile = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
    };
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      storage: hostile,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
    });

    const { branding, source } = await resolveBranding(ctx);
    expect(source).toBe('url');
    expect(branding.companyName).toBe(BRAND_A.companyName);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a failing branding lookup can never white-screen the login', () => {

  // ⚠ WHY THIS SUITE EXISTS, AND WHY IT WAS ADDED AFTER THE FACT. Phase 1's Step 5
  // browser check ran with no backend reachable, so every branding fetch failed —
  // and the chain fell through to source 5 and rendered neutral, exactly as
  // intended. NOTHING ASSERTED THAT. The behaviour was demonstrated by accident,
  // which means it could have regressed without a single test noticing.
  //
  // The distinction under test is REJECTS vs RESOLVES-NULL, and it is not
  // academic. fetchBrandingFromApi catches its own errors and returns null, so
  // production never rejects — but that makes the chain's safety a property of
  // ONE caller rather than of the chain. Any future source, any test double, any
  // Capacitor-supplied fetcher filling the source-4 slot can reject, and a
  // propagating throw out of resolveBranding is a blank page.
  //
  // THE RULE: a cosmetic branding lookup must never be able to take down the
  // login screen. It selects a logo. Its worst possible outcome is the wrong logo.

  const REJECT = () => { throw new Error('network down'); };

  it('[RED] source 2.5 returns null rather than propagating a rejected fetch', async () => {
    const ctx = makeContext({ search: `?brand=${SLUG_A}`, fetchBranding: vi.fn(REJECT) });
    await expect(resolveFromUrlHint(ctx)).resolves.toBeNull();
  });

  it('[RED] source 2 returns null rather than propagating a rejected fetch', async () => {
    const ctx = makeContext({ hostname: `${SLUG_A}.${APEX}`, fetchBranding: vi.fn(REJECT) });
    await expect(resolveFromHost(ctx)).resolves.toBeNull();
  });

  it('[RED] source 3 returns null rather than propagating a rejected fetch', async () => {
    const ctx = makeContext({
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_A }),
      fetchBranding: vi.fn(REJECT),
    });
    await expect(resolveFromStoredHint(ctx)).resolves.toBeNull();
  });

  it('[RED] a rejected fetch FALLS THROUGH to the next source rather than throwing', async () => {
    // The whole point: a failure at 2.5 must not end the walk. It must hand over.
    const ctx = makeContext({ search: `?brand=${SLUG_A}`, fetchBranding: vi.fn(REJECT) });

    const { branding, source } = await resolveBranding(ctx);
    expect(source).toBe('neutral');
    expect(branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
  });

  it('[RED] a rejected fetch at source 2 still lets a LATER source answer', async () => {
    // Distinguishes "falls through" from "gives up". Source 2 fails hard; the
    // stored hint must still get its turn and win.
    const fetchBranding = vi.fn(async (slug) => {
      if (slug === 'brokenhost') throw new Error('network down');
      return slug === SLUG_B ? { ...BRAND_B } : { ...NEUTRAL };
    });
    const ctx = makeContext({
      hostname: `brokenhost.${APEX}`,
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding,
    });

    const { branding, source } = await resolveBranding(ctx);
    expect(source).toBe('stored');
    expect(branding.companyName).toBe(BRAND_B.companyName);
  });

  it('[RED] resolveBranding never rejects, whatever the fetcher does', async () => {
    // Every shape of misbehaviour a fetcher can exhibit, including the ones a
    // hand-written double produces by accident.
    const misbehaviours = [
      () => { throw new Error('sync throw'); },
      async () => { throw new Error('async reject'); },
      async () => { throw new TypeError('Failed to fetch'); },   // the real browser one
      async () => undefined,
      async () => null,
      async () => 'not an object',
      async () => 42,
    ];

    for (const fetchBranding of misbehaviours) {
      const ctx = makeContext({ search: `?brand=${SLUG_A}`, fetchBranding: vi.fn(fetchBranding) });
      const result = await resolveBranding(ctx);

      expect(result.branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
      expect(result.source).toBe('neutral');
    }
  });

  it('[RED] a rejected fetch does not suppress the write-through of a source that DID answer', async () => {
    // Source 2 fails, source 3 answers — the hint must still be written through
    // for the winning source rather than being lost with the failed one.
    const fetchBranding = vi.fn(async (slug) => {
      if (slug === 'brokenhost') throw new Error('network down');
      return slug === SLUG_B ? { ...BRAND_B } : { ...NEUTRAL };
    });
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B });
    await resolveBranding(makeContext({ hostname: `brokenhost.${APEX}`, storage, fetchBranding }));

    expect(storage.setItem).toHaveBeenCalledWith(BRAND_HINT_STORAGE_KEY, SLUG_B);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CD-24 R1 — the hint is COSMETIC ONLY (guard-proof)', () => {

  // ⚠ ADVERSARIAL BY CONSTRUCTION. These do not inspect the implementation and
  // conclude it looks safe; they try to make the slug leak and prove it cannot.

  it('a bogus ?brand= yields fallback branding and nothing else', async () => {
    const ctx = makeContext({ search: `?brand=${SLUG_BOGUS}` });
    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('neutral');
    expect(branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
  });

  it('the resolved branding carries NO tenancy-bearing field — full key sweep', async () => {
    // A SWEEP, not a spot check: the failure mode is an ADDED key, and a spot
    // check only catches the keys someone already thought of.
    const ALLOWED = new Set(Object.keys(NEUTRAL).concat(['address', 'website']));

    for (const search of [`?brand=${SLUG_A}`, `?brand=${SLUG_BOGUS}`, '']) {
      const ctx = makeContext({
        search,
        fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
      });
      const { branding } = await resolveBranding(ctx);
      for (const key of Object.keys(branding)) {
        expect(ALLOWED.has(key), `branding carries an unexpected key '${key}'`).toBe(true);
      }
      expect('contractorId' in branding).toBe(false);
      expect('contractor_id' in branding).toBe(false);
      expect('slug' in branding).toBe(false);
    }
  });

  it('an attacker-supplied ?brand= never reaches the branding object as a value', async () => {
    // THE LEAK ATTEMPT. A slug crafted to be recognisable if it ever surfaced.
    const MARKER = 'zzmarkerslug';
    const ctx = makeContext({
      search: `?brand=${MARKER}`,
      fetchBranding: makeFetchBranding({}),
    });
    const { branding } = await resolveBranding(ctx);

    const serialised = JSON.stringify(branding);
    expect(serialised.includes(MARKER),
      `the requested slug leaked into the branding payload: ${serialised}`).toBe(false);
  });

  it('the slug reaches the network ONLY as the branding lookup, never as a body or extra query', async () => {
    // The single legitimate use of the slug is asking the branding endpoint about
    // it. EVERY call must therefore carry the slug and NOTHING ELSE — a second
    // argument is where a request body or an extra query parameter would ride
    // along, which is precisely what R1 forbids.
    const ctx = makeContext({
      search: `?brand=${SLUG_A}`,
      fetchBranding: makeFetchBranding({ [SLUG_A]: BRAND_A }),
    });
    await resolveBranding(ctx);

    expect(ctx.fetchBranding).toHaveBeenCalledWith(SLUG_A);
    for (const call of ctx.fetchBranding.mock.calls) {
      expect(call.length, `a branding lookup carried extra arguments: ${JSON.stringify(call)}`).toBe(1);
      expect(typeof call[0]).toBe('string');
    }
  });

  it('a URL-hint slug carrying injection payloads is inert', async () => {
    for (const nasty of ['../../etc/passwd', '<script>alert(1)</script>', "'; DROP TABLE contractors;--", 'a'.repeat(500)]) {
      const ctx = makeContext({
        search: `?brand=${encodeURIComponent(nasty)}`,
        fetchBranding: makeFetchBranding({}),
      });
      const { branding, source } = await resolveBranding(ctx);

      expect(source).toBe('neutral');
      expect(branding.companyName).toBe(BRANDING_THEME_DEFAULTS.companyName);
      expect(JSON.stringify(branding).includes(nasty)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BR-1 Phase 1 — source 1 (session) answers', () => {

  // ⚠ WHAT WAS BROKEN, AND WHY ONE EMPTY FUNCTION PRODUCED THREE UNRELATED-LOOKING
  // SYMPTOMS. `resolveFromSession` was `return null` — the whole body. It is FIRST
  // in the chain, so an authenticated user's branding was decided by whatever the
  // user's own browser happened to supply: a `?brand=` parameter, a localStorage
  // hint, or nothing. Three consequences, all one cause:
  //
  //   (a) a logged-in user on a device with no hint saw platform branding;
  //   (b) ContactModal rendered EMPTY, because `phone` and `email` are the two
  //       fields with no platform default (BR Phase 0 §3.4) — every other field
  //       had a default doing its job and looked merely wrong, while these two
  //       vanished entirely;
  //   (c) a planted `?brand=` was PERMANENT, because CD-24 R2's correction —
  //       "source 1 is first, so it wins and the write-through rewrites the
  //       stored hint" — was written as something that falls out of the ordering,
  //       and the ordering only helps once source 1 answers.
  //
  // (c) IS A SECURITY BOUNDARY, latent today only because `contractors.slug` is
  // unpopulated so no crafted slug can name anyone. That gate is a column, not a
  // control, and it opens on the day slugs are backfilled.

  // A session token is a 64-char hex string. The VALUE is never interpreted here —
  // it is a bearer credential handed to a fetcher — but using a realistic shape
  // keeps the fixture honest about what is being passed around.
  const TOKEN_A = 'a'.repeat(64);
  const TOKEN_B = 'b'.repeat(64);

  // The envelopes GET /api/session/branding returns, named so each fixture says
  // out loud whether its contractor has a slug — the write-through branches on
  // exactly that, and BR-1 Phase 1-B added the branch.
  const SESSION_A = { branding: BRAND_A, slug: SLUG_A };
  const SESSION_B = { branding: BRAND_B, slug: SLUG_B };
  // ⚠ THE R4 FIXTURE. A real contractor, fully resolved, whose `contractors.slug`
  // is NULL — the case that cannot be represented in the hint at all and must
  // therefore still REMOVE it. Kept beside its sibling so the two branches are
  // visibly a pair rather than one rule with an exception someone may prune.
  const SESSION_A_NO_SLUG = { branding: BRAND_A, slug: null };

  // ── T1 ─────────────────────────────────────────────────────────────────────
  it('[RED] T1 — source 1 returns branding for an authenticated session', async () => {
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
    });

    const answer = await resolveFromSession(ctx);

    expect(answer).not.toBeNull();
    expect(answer.branding.companyName).toBe(BRAND_A.companyName);
    expect(ctx.fetchSessionBranding).toHaveBeenCalledWith(TOKEN_A);
  });

  it('[RED] T1 — the chain STOPS at source 1 and reports it as the answering source', async () => {
    // ⚠ THE SECOND HALF IS THE ONE THAT MATTERS. A source 1 that answered while
    // some later source ALSO ran would still produce the right pixels here and
    // would not be first in any meaningful sense. `fetchBranding` is the slug
    // fetcher used by sources 2, 2.5 and 3; it must never be called.
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      search: `?brand=${SLUG_B}`,
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('session');
    expect(branding.companyName).toBe(BRAND_A.companyName);
    expect(ctx.fetchBranding).not.toHaveBeenCalled();
  });

  // ── T2 — THE NULL PATH, AND THE FALL-THROUGH IT MUST PRESERVE ──────────────
  it('[RED] T2 — with no session the chain still falls through to a LATER source', async () => {
    // ⚠ ASSERTS THE FALL-THROUGH, NOT THE NULL. `resolveFromSession(...) === null`
    // is satisfied by a source that swallowed an exception, by one that answered
    // and lost its answer, and by the pre-BR-1 `return null` alike. What proves
    // the chain is intact is that a later source WINS and its answer arrives.
    const ctx = makeContext({
      sessionToken: null,
      search: `?brand=${SLUG_B}`,
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('url');
    expect(branding.companyName).toBe(BRAND_B.companyName);
  });

  it('[RED] T2 — a session-branding lookup that FAILS is a non-answer, not a crash and not neutral', async () => {
    // Same rule sources 2, 2.5 and 3 already follow: a failed lookup hands over
    // rather than stopping the walk. A cosmetic branding call must never be able
    // to take down the surface it is decorating.
    for (const fetchSessionBranding of [
      vi.fn(() => { throw new Error('sync throw'); }),
      vi.fn(async () => { throw new TypeError('Failed to fetch'); }),
      vi.fn(async () => null),
      vi.fn(async () => undefined),
      vi.fn(async () => 'not an object'),
      vi.fn(async () => 42),
      vi.fn(async () => ({})),          // a 200 with no branding block (super_admin)
    ]) {
      const ctx = makeContext({
        sessionToken: TOKEN_A,
        fetchSessionBranding,
        search: `?brand=${SLUG_B}`,
        fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
      });

      const { branding, source } = await resolveBranding(ctx);

      expect(source).toBe('url');
      expect(branding.companyName).toBe(BRAND_B.companyName);
    }
  });

  // ── T3 — THE TENANCY TEST ──────────────────────────────────────────────────
  it('[RED] T3 — a session for A with a hint and a ?brand= naming B resolves A', async () => {
    // ⚠ THE CLIENT HALF. What the SERVER derived is asserted in
    // server/test/sessionBranding.test.js — this asserts that the client never
    // hands the server a channel to be misled through, and never prefers one.
    const fetchSessionBranding = makeFetchSessionBranding({ [TOKEN_A]: SESSION_A });
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding,
      search: `?brand=${SLUG_B}`,
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const { branding, source } = await resolveBranding(ctx);

    // POSITIVE: A resolved, by the session.
    expect(source).toBe('session');
    expect(branding.companyName).toBe(BRAND_A.companyName);
    expect(branding.primaryColor).toBe(BRAND_A.primaryColor);
    // NEGATIVE: nothing of B survived anywhere in the payload.
    expect(JSON.stringify(branding).includes(BRAND_B.companyName)).toBe(false);

    // ⚠ AND THE CHANNEL ITSELF: the session lookup is handed the TOKEN and
    // NOTHING ELSE. A second argument is where a slug, a hint or a contractor id
    // would ride along — the same assertion the R1 guard-proof makes of the slug
    // fetcher, applied to the one call that IS tenancy-bearing.
    for (const call of fetchSessionBranding.mock.calls) {
      expect(call.length, `the session lookup carried extra arguments: ${JSON.stringify(call)}`).toBe(1);
      expect(call[0]).toBe(TOKEN_A);
    }
  });

  it('[RED] T3 — two sessions on one fixture resolve to their OWN contractors', async () => {
    // THE PREDICATE PROOF. A source that ignored its token and returned "the
    // branding" would pass the test above and fail this one.
    const fetchSessionBranding = makeFetchSessionBranding({ [TOKEN_A]: SESSION_A, [TOKEN_B]: SESSION_B });

    const a = await resolveBranding(makeContext({ sessionToken: TOKEN_A, fetchSessionBranding }));
    const b = await resolveBranding(makeContext({ sessionToken: TOKEN_B, fetchSessionBranding }));

    expect(a.branding.companyName).toBe(BRAND_A.companyName);
    expect(b.branding.companyName).toBe(BRAND_B.companyName);
  });

  // ── THE WRITE-THROUGH / CD-24 R2 — TWO BRANCHES, BOTH PINNED ───────────────
  //
  // ⚠ PHASE 1 HAD ONE BRANCH AND 1-B ADDED THE OTHER, WHICH IS WHY THEY ARE
  // ADJACENT AND SAY SO. R2 requires an authenticated answer to REWRITE the
  // hint. Phase 1's source 1 carried no slug, so "rewrite" degraded to REMOVE —
  // correct for the planted value and destructive to the legitimate one, since
  // the hint is the only thing that makes a returning signed-out visitor see
  // their own contractor. 1-B echoes the session's own slug, so the rewrite is a
  // SUBSTITUTION whenever the contractor has one. Removal survives, scoped to
  // the case that genuinely cannot be represented.
  it('[RED] T3 — a planted hint naming B is REPLACED by A\'s slug, not merely dropped', async () => {
    // ⚠ THE SUBSTITUTION, AND IT IS THE HALF THAT REGRESSED. Asserting only that
    // B is gone would pass against Phase 1's removal, which is exactly the
    // behaviour this test exists to change — so the assertion is on the VALUE
    // now stored, not on the absence of the old one.
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B });
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      storage,
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    await resolveBranding(ctx);

    expect(storage.getItem(BRAND_HINT_STORAGE_KEY)).toBe(SLUG_A);
    expect(storage.setItem).toHaveBeenCalledWith(BRAND_HINT_STORAGE_KEY, SLUG_A);
    // AND THE PLANTED VALUE IS GONE — the security half, unchanged from Phase 1.
    expect(storage._map.get(BRAND_HINT_STORAGE_KEY)).not.toBe(SLUG_B);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('[RED] T5 — a signed-out load AFTER an authenticated one resolves A from the corrected hint', async () => {
    // ⚠ THIS IS THE REGRESSION TEST, AND IT IS THE POINT OF 1-B. Phase 1's
    // equivalent asserted the second walk answered NEUTRAL, which was the
    // regression written down as an expectation: a returning visitor who had
    // signed in lost their contractor's login screen. The second walk is signed
    // out — no token — so the ONLY thing that can carry A across it is the hint
    // the authenticated walk wrote.
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B });
    const fetchBranding = makeFetchBranding({ [SLUG_A]: BRAND_A, [SLUG_B]: BRAND_B });

    await resolveBranding(makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      storage,
      fetchBranding,
    }));

    const after = await resolveBranding(makeContext({ sessionToken: null, storage, fetchBranding }));

    expect(after.source).toBe('stored');
    expect(after.branding.companyName).toBe(BRAND_A.companyName);
    // NOT VACUOUS IN THE DANGEROUS DIRECTION: B must not be what answered, and
    // neutral must not be either — three distinguishable outcomes, not two.
    expect(after.branding.companyName).not.toBe(BRAND_B.companyName);
    expect(after.branding.companyName).not.toBe(BRANDING_THEME_DEFAULTS.companyName);
  });

  it('[RED] T4 — a session for a contractor with NO slug REMOVES a planted hint', async () => {
    // ⚠ R4, AND IT NEEDS ITS OWN TEST PRECISELY BECAUSE T3 CANNOT SEE IT. A
    // contractor whose `contractors.slug` is NULL cannot be named in the hint at
    // all. Leaving B's value in place would be the white-label breach; writing
    // null or '' would leave a key that exists and resolves to nothing. Removal
    // is the only correct action, and it is the behaviour Phase 1 shipped for
    // every contractor — 1-B narrows it rather than deleting it.
    const storage = makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B });
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A_NO_SLUG }),
      storage,
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const { source, branding } = await resolveBranding(ctx);

    // POSITIVE CONTROL: source 1 still ANSWERED. Without this, a source that had
    // simply declined would also leave no hint written and satisfy every
    // assertion below — the plausible-rejection trap.
    expect(source).toBe('session');
    expect(branding.companyName).toBe(BRAND_A.companyName);

    expect(storage._map.has(BRAND_HINT_STORAGE_KEY)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(BRAND_HINT_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('[RED] T3 — a session answer WRITES the hint even when there was none before', async () => {
    // The first authenticated visit on a fresh device. Phase 1 wrote nothing
    // here (there was no slug to write) and this test asserted `setItem` was
    // never called — the inverse of what it now asserts.
    const storage = makeStorage();
    await resolveBranding(makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      storage,
    }));

    expect(storage.getItem(BRAND_HINT_STORAGE_KEY)).toBe(SLUG_A);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('[RED] T4 — a no-slug session does not INVENT a hint when there was none', async () => {
    // The R4 branch on a clean store. The removal must be a no-op rather than a
    // write of its own: a source that called setItem(key, '') would satisfy the
    // R4 test above — the key would be present-but-empty, and `_map.has` would
    // be true, so that one would catch it — but a source that wrote the
    // COMPANY NAME, or the token, or 'null' as a string would not be caught
    // anywhere else.
    const storage = makeStorage();
    await resolveBranding(makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A_NO_SLUG }),
      storage,
    }));

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage._map.has(BRAND_HINT_STORAGE_KEY)).toBe(false);
  });

  it('[RED] T4 — a hostile storage that throws on removal does not break resolution', async () => {
    // Same rule persistBrandHint already follows. Safari private mode and
    // hardened profiles raise SecurityError; a cosmetic correction must never
    // cost the visit its surface.
    const hostile = {
      getItem: () => SLUG_B,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      storage: hostile,
    });

    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('session');
    expect(branding.companyName).toBe(BRAND_A.companyName);
  });

  // ── T5 — HONEST NULLS ──────────────────────────────────────────────────────
  it('[RED] T5 — a contractor with NULL branding values resolves, and the nulls arrive as null', async () => {
    // ⚠ WHAT RENDERS FOR THESE IS PHASE 2. This asserts only that the chain does
    // not substitute, does not throw, and does not read the absence as a
    // non-answer.
    //
    // ⚠ NOT VACUOUS, AND THE COMPANY NAME IS WHAT MAKES IT SO. A theme equal to
    // the platform defaults would be indistinguishable from source 5's answer,
    // and this test would pass against a completely unwired source 1. The fixture
    // therefore carries a real company name — which is exactly what production
    // does, since `contractors.name` is NOT NULL and the resolver falls back to
    // it. The `source` assertion is the proof that source 1, not neutral,
    // produced this.
    const BARE = Object.freeze(resolveBrandingTheme({ contractor_name: 'Unbranded Roofing Co' }));
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: { branding: BARE, slug: SLUG_A } }),
    });

    const { branding, source } = await resolveBranding(ctx);

    expect(source).toBe('session');
    expect(branding.companyName).toBe('Unbranded Roofing Co');
    expect(branding.logoUrl).toBeNull();
    expect(branding.phone).toBeNull();
    expect(branding.email).toBeNull();
    expect(branding.programName).toBeNull();
  });

  it('[RED] T5 — an unbranded contractor is NOT read as a non-answer', async () => {
    // ⚠ THE INFERENCE THAT MUST NOT BE REUSED HERE. Sources 2, 2.5 and 3 read a
    // neutral-looking payload as "the endpoint declined", because the endpoint
    // refuses to say whether a slug resolved. Source 1 has no such ambiguity — a
    // 200 on an authenticated route IS the contractor's answer — so applying
    // isNeutralBranding here would silently drop the branding of every contractor
    // who has customised nothing, and fall through to a hint instead.
    const ALL_DEFAULT = Object.freeze(resolveBrandingTheme(null));
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: { branding: ALL_DEFAULT, slug: SLUG_A } }),
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const { source } = await resolveBranding(ctx);

    expect(source).toBe('session');
    expect(ctx.fetchBranding).not.toHaveBeenCalled();
  });

  // ── T1 — THE SLUG HALF FLIPPED; THE OTHER TWO HALVES DID NOT ───────────────
  //
  // ⚠ THIS TEST WAS 'the published answer carries no token, no slug and no
  // contractor id'. The slug half is now its opposite AT THE SOURCE, and
  // unchanged AT THE PUBLISHED VALUE — those are two different places, and
  // collapsing them is the one way to get this wrong.
  //
  //   source 1's ANSWER        carries the slug — the write-through needs it
  //   resolveBranding's RETURN does not — `answer.slug` is dropped, exactly as
  //                            it already is for sources 2, 2.5 and 3
  //
  // So CD-24 R1 is untouched: nothing tenancy-bearing reaches the provider, and
  // `AdminBrandingContext` still publishes a branding object with no identity
  // field in it at all. The token and contractor-id halves are re-asserted below
  // rather than dropped in the rewrite.
  it('[RED] T1 — source 1\'s answer CARRIES the session slug; the published value still does not', async () => {
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
    });

    // FLIPPED: at the source, the slug is present and it is A's.
    const answer = await resolveFromSession(ctx);
    expect(answer.slug).toBe(SLUG_A);

    // UNCHANGED: at the published value, it is not.
    const result = await resolveBranding(makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
    }));
    expect(Object.keys(result).sort()).toEqual(['branding', 'source']);
    const ALLOWED = new Set(Object.keys(NEUTRAL).concat(['address', 'website']));
    for (const key of Object.keys(result.branding)) {
      expect(ALLOWED.has(key), `source 1 published an unexpected key: ${key}`).toBe(true);
    }
    // UNCHANGED: neither the token nor the slug reaches a consumer.
    expect(JSON.stringify(result).includes(TOKEN_A)).toBe(false);
    expect(JSON.stringify(result).includes(SLUG_A)).toBe(false);
  });

  // ── T2 — THE SCOPE TEST, CLIENT SIDE ───────────────────────────────────────
  it('[RED] T2 — the slug source 1 carries is A\'s, with a hint and a ?brand= both naming B', async () => {
    // ⚠ THE SERVER HALF IS THE REAL ONE — server/test/sessionBranding.test.js
    // asserts the SERVER never lets a client-supplied value choose the slug.
    // This asserts the client never substitutes one either: source 1 must carry
    // what the server said, not what the URL or the store happened to hold.
    const ctx = makeContext({
      sessionToken: TOKEN_A,
      fetchSessionBranding: makeFetchSessionBranding({ [TOKEN_A]: SESSION_A }),
      search: `?brand=${SLUG_B}`,
      storage: makeStorage({ [BRAND_HINT_STORAGE_KEY]: SLUG_B }),
      fetchBranding: makeFetchBranding({ [SLUG_B]: BRAND_B }),
    });

    const answer = await resolveFromSession(ctx);

    expect(answer.slug).toBe(SLUG_A);
    expect(answer.slug).not.toBe(SLUG_B);
    // AND EXACTLY ONE SLUG — not an array, not a list of candidates.
    expect(typeof answer.slug).toBe('string');
  });
});
