'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b PHASE 1 — THE PLATFORM'S OWN NAME IS A RESERVED SLUG
//
// WHY THIS IS NOT A COSMETIC FIX. A slug FREEZES the moment its contractor mints
// their first invite link (server/utils/contractorSlug.js, isSlugMutable) —
// because by then a QR code carrying <slug>.roofmiles.com may already be printed
// on a yard sign, a door hanger or a truck wrap, and printed material cannot be
// recalled. A contractor issued the slug 'roofmiles' would therefore hold the
// PLATFORM'S OWN NAME, permanently, on physical material, unrecoverable.
//
// HOW IT WENT UNNOTICED. extractSlugFromHost's label-count rule (>2 labels) means
// the apex can never read its own second-level label as a slug: 'roofmiles.com'
// is two labels, so 'roofmiles' never reached the contractors lookup from a host.
// The denylist did not need the entry to be SAFE on that path, so nobody added
// it. The exposure was always in validateSlug — the ISSUING path — which would
// hand 'roofmiles' to a contractor on request.
//
// C/DL-3b Phase 1 added resolveSlugToContractor, a second path to that lookup
// that takes a bare slug and therefore has no label-count rule. That surfaced the
// gap; it did not create it.
//
// SAME CLASS AS 'app' (spec amendment A22): an entry that is load-bearing
// infrastructure rather than a nice-to-have. A22's rule — that any change to
// RESERVED_SLUGS must treat such entries as load-bearing — is why this file locks
// the whole list against removal, not just the new entry.
//
// BOTH PATHS AND THE ISSUER ARE ASSERTED, because they fail independently:
//   extractSlugFromHost        the host path      (already safe, locked here)
//   resolveSlugToContractor    the bare-slug path (new in Phase 1)
//   validateSlug               the ISSUING path   (the real exposure)
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');
const { BRANDING_THEME_DEFAULTS } = require('../utils/brandingTheme');
const {
  RESERVED_SLUGS,
  isReservedSlug,
  validateSlug,
  extractSlugFromHost,
  resolveSlugToContractor,
} = require('../utils/contractorSlug');

const TENANT_A = 'test-tenant-a';
const APEX = 'roofmiles.com';

// The platform's own second-level label. The entry this phase adds.
const PLATFORM_SLUG = 'roofmiles';

// Infrastructure labels that must stay reserved. Named explicitly rather than
// read from RESERVED_SLUGS, so deleting one from the source cannot also delete it
// from the expectation — the failure mode a self-referential test cannot catch.
const INFRASTRUCTURE_SLUGS = Object.freeze([
  'www', 'mail', 'api', 'admin', 'go',
]);

// The full list as it stood before this change. Locked against REMOVAL only —
// additions are fine and expected.
const PRE_EXISTING_ENTRIES = Object.freeze([
  'www', 'api', 'app', 'admin', 'ops', 'mail', 'smtp', 'staging',
  'test', 'dev', 'status', 'help', 'support', 'docs', 'blog',
  'assets', 'cdn', 'go',
]);

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.96.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers: { 'X-Forwarded-For': nextIp() } },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let body = null;
          try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
          resolve({ status: res.statusCode, body, raw });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('C/DL-3b Phase 1 — platform-reserved slugs', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_invite_links');
    await seedContractor(pool, TENANT_A);
    await pool.query('UPDATE contractors SET slug = NULL WHERE id = $1', [TENANT_A]);
  });

  // ── THE LIST ───────────────────────────────────────────────────────────────

  it('[RED] the platform\'s own name is reserved', async () => {
    assert.ok(
      RESERVED_SLUGS.includes(PLATFORM_SLUG),
      `'${PLATFORM_SLUG}' must be in RESERVED_SLUGS — a contractor holding the platform's own ` +
      'name would freeze it onto printed QR codes permanently'
    );
  });

  it('every infrastructure label stays reserved', async () => {
    for (const slug of INFRASTRUCTURE_SLUGS) {
      assert.ok(isReservedSlug(slug), `'${slug}' must be reserved`);
    }
  });

  it('no pre-existing entry was removed', async () => {
    // A22: entries here are load-bearing infrastructure, not preferences. This
    // list may only grow.
    const missing = PRE_EXISTING_ENTRIES.filter(s => !RESERVED_SLUGS.includes(s));
    assert.deepEqual(missing, [], `RESERVED_SLUGS lost entries: ${missing.join(', ')}`);
  });

  it('reservation is case-insensitive', async () => {
    for (const variant of ['RoofMiles', 'ROOFMILES', '  RoOfMiLeS  ']) {
      assert.equal(isReservedSlug(variant), true, `'${variant}' must be reserved`);
    }
  });

  // ── THE ISSUING PATH — where the real exposure was ────────────────────────

  it('[RED] validateSlug refuses to issue the platform slug', async () => {
    const result = validateSlug(PLATFORM_SLUG);
    assert.equal(result.valid, false, `validateSlug must refuse '${PLATFORM_SLUG}'`);
    assert.match(result.reason, /reserved/i);
  });

  it('validateSlug refuses every infrastructure label', async () => {
    for (const slug of INFRASTRUCTURE_SLUGS) {
      assert.equal(validateSlug(slug).valid, false, `validateSlug must refuse '${slug}'`);
    }
  });

  // ── PATH 1 — HOST ──────────────────────────────────────────────────────────

  it('extractSlugFromHost refuses the platform slug as a subdomain', async () => {
    // roofmiles.roofmiles.com — three labels, so the label-count rule does NOT
    // save us here. Only the denylist does.
    assert.equal(extractSlugFromHost(`${PLATFORM_SLUG}.${APEX}`), null);
  });

  it('the apex itself still resolves to no slug, for the original reason', async () => {
    // The label-count rule, unchanged. Asserted alongside the denylist so a future
    // reader can see the two guards are independent.
    assert.equal(extractSlugFromHost(APEX), null);
  });

  // ── PATH 2 — BARE SLUG (new in Phase 1) ───────────────────────────────────

  it('[RED] resolveSlugToContractor refuses the platform slug even when a row holds it', async () => {
    // contractors.slug has a UNIQUE index but NO CHECK constraint, so a
    // hand-written statement can park the value there regardless of validateSlug.
    // The denylist is the enforcement seam, not the schema.
    await pool.query('UPDATE contractors SET slug = $2 WHERE id = $1', [TENANT_A, PLATFORM_SLUG]);

    const resolved = await resolveSlugToContractor(pool, PLATFORM_SLUG);
    assert.equal(resolved, null,
      'a reserved label must not resolve to a tenant even when the column holds it');
  });

  it('resolveSlugToContractor refuses every infrastructure label held in the column', async () => {
    for (const slug of INFRASTRUCTURE_SLUGS) {
      await pool.query('UPDATE contractors SET slug = $2 WHERE id = $1', [TENANT_A, slug]);
      const resolved = await resolveSlugToContractor(pool, slug);
      assert.equal(resolved, null, `'${slug}' must not resolve to a tenant`);
    }
  });

  // ── PATH 2, OVER HTTP ─────────────────────────────────────────────────────

  it('[RED] GET /api/branding/roofmiles returns neutral even when a contractor holds it', async () => {
    await pool.query('UPDATE contractors SET slug = $2 WHERE id = $1', [TENANT_A, PLATFORM_SLUG]);

    const res = await httpGet(port, `/api/branding/${PLATFORM_SLUG}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.companyName, BRANDING_THEME_DEFAULTS.companyName,
      'the platform slug must never serve a tenant\'s branding');
    assert.equal(res.body.primaryColor, BRANDING_THEME_DEFAULTS.primaryColor);
  });

  it('the platform slug is indistinguishable from an unknown slug over HTTP', async () => {
    // The anti-oracle rule still holds for the new entry: reserving a label must
    // not become a way to detect which labels are reserved.
    await pool.query('UPDATE contractors SET slug = $2 WHERE id = $1', [TENANT_A, PLATFORM_SLUG]);

    const reserved = await httpGet(port, `/api/branding/${PLATFORM_SLUG}`);
    const unknown = await httpGet(port, '/api/branding/nosuchroofer');

    assert.equal(reserved.status, unknown.status);
    assert.equal(reserved.raw, unknown.raw, 'bodies must be byte-identical');
  });
});
