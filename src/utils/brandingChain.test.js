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

function makeContext({
  hostname = APP_HOST,
  search = '',
  storage = makeStorage(),
  fetchBranding = makeFetchBranding(),
  session = null,
} = {}) {
  return { hostname, search, storage, fetchBranding, session };
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

  it('source 1 (session) returns null this phase — Phase 5 wires it', () => {
    // A LEGITIMATE NULL, NOT A STUB. There is no session-branding endpoint in the
    // product: GET /api/admin/me returns no branding and no contractor_id, and
    // there is no referrer equivalent at all. Phase 5 changes the login response
    // shape and this source starts answering then.
    return expect(resolveFromSession(makeContext())).resolves.toBeNull();
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
  it('NOTHING in the chain clears rm_brand_hint', async () => {
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
