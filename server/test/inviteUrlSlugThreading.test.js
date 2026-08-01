'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2b RED SUITE — PUBLIC SLUG THREADED THROUGH EVERY GENERATOR
//
// buildInviteUrl(slug, { contractorSlug }) has accepted a contractorSlug since
// C/DL-1, and not one of the five call sites passes it (Phase 0 finding F-1).
// Every generated stage-2 URL therefore renders on the bare apex today. This file
// pins the fix: each generator must supply the PUBLIC slug of the contractor that
// owns the token it is rendering.
//
// THE PUBLIC SLUG, NEVER THE INTERNAL ID. contractors.slug is a separate nullable
// column precisely so contractors.id never reaches a public URL. These URLs are
// printed on yard signs, door hangers and truck wraps; a wrong one cannot be
// recalled, and a leaked internal id cannot be un-printed.
//
// THE FIVE GENERATORS (line numbers re-confirmed by grep for this phase — the
// Phase 0 numbers had drifted):
//   server/routes/referrer.js:1627      GET  /api/referrer/qr-code
//   server/routes/referrer.js:1652      GET  /api/referrer/my-invite-link
//   server/routes/admin/index.js:513    POST /api/admin/invite-links
//   server/routes/admin/index.js:546    GET  /api/admin/invite-links
//   server/cron/jobs/postJobSequence.js:149  Scenario B welcome-email CTA
//
// FOUR CLAIMS PER GENERATOR, and they are deliberately separate tests so a failure
// says which property broke:
//
//   STAGE 1   with INVITE_LINK_BASE_URL unset, the emitted URL is byte-identical to
//             the legacy `${FRONTEND_URL}?signup=<slug>` shape. GREEN ON ARRIVAL BY
//             DESIGN — this is the safety net, not a wish. Every link minted before
//             the D3 flip must keep working, so threading a slug must change stage-1
//             output by exactly zero bytes.
//
//   STAGE 2   with it set, `https://<public-slug>.<base>/i/<token-slug>`. RED today:
//             all five emit the bare apex.
//
//   LEAK      the internal contractor id appears nowhere in the emitted URL, in
//             EITHER stage. GREEN ON ARRIVAL BY CONSTRUCTION — nothing threads any
//             contractor value yet, so nothing can leak yet. Its job is to fail the
//             moment Phase 2c threads `contractors.id` in place of contractors.slug,
//             which is the single most likely way to implement this wrong.
//
//   NO-SLUG   a contractor with slug IS NULL renders on go.roofmiles.com — not the
//             bare apex (which serves the marketing site and has no /i/ route), not
//             the internal id, not a throw. RED today: emits the bare apex.
//
// GUARD-PROOF SITE (spec item 5). The two-tenant tests below are proven non-vacuous
// by disabling the tenancy predicate of whatever lookup Phase 2c writes to fetch the
// slug — i.e. change `SELECT slug FROM contractors WHERE id = $1` to
// `SELECT slug FROM contractors ORDER BY id LIMIT 1`. Tenant B's generators then
// emit tenant A's slug and every "two tenants" test in this file must go red. If
// they do not, they are not testing what they claim.
//
// FIXTURE IDS ARE DERIVED, NEVER PRODUCTION LITERALS (house rule). The internal ids
// below are deliberately chosen to share no substring with the public slugs, so
// `url.includes(internalId)` is unambiguous — see the fixture-hygiene test, which
// asserts that property rather than trusting it.
//
// RESEND INTERCEPTION — the require.cache pattern established by
// signupEmailWhiteLabel.test.js, installed before anything that constructs a Resend
// client is required. Needed for the cron generator, whose CTA is only observable
// inside the email it sends. No real mail.
// ─────────────────────────────────────────────────────────────────────────────

// Every send the process makes, in order. Populated by the stub below.
const sentEmails = [];

const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async payload => {
            sentEmails.push(payload);
            return { data: { id: 'test-stub' }, error: null };
          },
        };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURE IDENTITIES ───────────────────────────────────────────────────────
// Internal ids and public slugs are drawn from disjoint alphabets on purpose: the
// leak assertions are substring searches, and an internal id that happened to be a
// substring of its own slug would make them meaningless.
const TENANT_A_ID = 'tnt-k7fq-internal';
const TENANT_B_ID = 'tnt-m2wp-internal';
const TENANT_NOSLUG_ID = 'tnt-r9xv-internal';

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';
// TENANT_NOSLUG deliberately has contractors.slug IS NULL — the state EVERY
// contractor except Accent is in today, because nothing is backfilled.

const APEX = 'roofmiles.com';
const TOKEN_BASE = `https://${APEX}`;

// The neutral host for a contractor with no slug (spec amendment A7). Already in the
// reserved-slug denylist in server/utils/contractorSlug.js for exactly this reason,
// so no contractor can ever collide with it.
const FALLBACK_HOST = `go.${APEX}`;

// Distinctive stage-1 base. Not a real host — if it ever appears in a stage-2
// assertion the env plumbing has leaked between stages.
const STAGE1_FRONTEND = 'https://stage1.example.invalid';
// A different value for stage 2, so a generator that silently falls back to
// FRONTEND_URL instead of building a token URL is visible rather than plausible.
const STAGE2_FRONTEND = 'https://stage2.example.invalid';

let _counter = 0;
function uniq(prefix) {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

// Fresh IP per request. server/app.js sets `trust proxy 1`, so express-rate-limit
// keys on X-Forwarded-For; without this the file would share one bucket across
// every request and start 429ing partway through for a reason unrelated to slugs.
function nextIp() {
  _counter += 1;
  return `10.70.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
}

function httpRequest(port, method, path, { token = null, body = null } = {}) {
  const payload = body === null ? null : Buffer.from(JSON.stringify(body));
  const headers = { 'X-Forwarded-For': nextIp() };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = payload.length;
  }
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── ENV STAGING ──────────────────────────────────────────────────────────────
// buildInviteUrl reads process.env at call time, so these flip the live endpoints
// between stages without restarting the server. Restored in a finally so a failing
// assertion cannot leak a variable into the next test.
async function withStage(fn, { tokenBase = null, frontendUrl }) {
  const prevBase = process.env.INVITE_LINK_BASE_URL;
  const prevFront = process.env.FRONTEND_URL;
  if (tokenBase === null) delete process.env.INVITE_LINK_BASE_URL;
  else process.env.INVITE_LINK_BASE_URL = tokenBase;
  process.env.FRONTEND_URL = frontendUrl;
  try {
    return await fn();
  } finally {
    if (prevBase === undefined) delete process.env.INVITE_LINK_BASE_URL;
    else process.env.INVITE_LINK_BASE_URL = prevBase;
    if (prevFront === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prevFront;
  }
}

const withStage1 = fn => withStage(fn, { tokenBase: null, frontendUrl: STAGE1_FRONTEND });
const withStage2 = fn => withStage(fn, { tokenBase: TOKEN_BASE, frontendUrl: STAGE2_FRONTEND });

describe('C/DL-2 Phase 2b — the public contractor slug reaches every invite-URL generator', () => {
  let pool, server, port;

  // contractorId -> { referrerToken, referrerUserId, adminToken }
  const fixtures = {};

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    for (const key of Object.keys(fixtures)) delete fixtures[key];
    await seedTenant(TENANT_A_ID, SLUG_A);
    await seedTenant(TENANT_B_ID, SLUG_B);
    await seedTenant(TENANT_NOSLUG_ID, null);
  });

  // Seeds one contractor plus the two authenticated identities its generators need.
  // contractor_settings is required by the cron, which iterates that table.
  async function seedTenant(contractorId, publicSlug) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $1, $2)`,
      [contractorId, publicSlug]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $1)`,
      [contractorId]
    );

    const { rows: userRows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ($1, $2, 'x', $3, true) RETURNING id`,
      [uniq('Referrer'), `${uniq('referrer')}@test.invalid`, contractorId]
    );
    const referrerUserId = userRows[0].id;
    const referrerToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', 'referrer', $3)`,
      [referrerUserId, referrerToken, contractorId]
    );

    // Owner tier short-circuits requirePermission (see ownerParity.test.js), so one
    // seeded owner covers both admin generators regardless of their permission flags.
    const { rows: memberRows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, 'placeholder-hash-not-used-in-login', 'owner', '{}')
       RETURNING id`,
      [contractorId, `${uniq('owner')}@test.invalid`]
    );
    const adminToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [adminToken, contractorId, memberRows[0].id]
    );

    fixtures[contractorId] = { referrerUserId, referrerToken, adminToken };
  }

  // Mints a contractor-type token directly in the DB, bypassing the admin endpoint,
  // so the listing and cron generators have something to render that does not depend
  // on another generator working.
  async function mintContractorToken(contractorId) {
    const slug = uniq('tok');
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [contractorId, slug]
    );
    return slug;
  }

  // ── THE FIVE GENERATORS, BEHIND ONE SHAPE ──────────────────────────────────
  // Each emitter returns { url, slug }: the URL the generator handed out, and the
  // token slug it was rendering. Every emitter asserts its own transport succeeded
  // BEFORE returning — that assertion is what makes the absence tests below
  // non-vacuous, since a 404 body contains no internal id either.

  async function emitMyInviteLink(contractorId) {
    const res = await httpRequest(port, 'GET', '/api/referrer/my-invite-link', {
      token: fixtures[contractorId].referrerToken,
    });
    assert.equal(res.status, 200, `my-invite-link failed: ${res.raw}`);
    assert.ok(res.body.slug, 'my-invite-link returned no slug');
    return { url: res.body.fullUrl, slug: res.body.slug };
  }

  async function emitQrCode(contractorId) {
    const res = await httpRequest(port, 'GET', '/api/referrer/qr-code', {
      token: fixtures[contractorId].referrerToken,
    });
    assert.equal(res.status, 200, `qr-code failed: ${res.raw}`);
    assert.ok(res.body.slug, 'qr-code returned no slug');
    return { url: res.body.fullUrl, slug: res.body.slug };
  }

  async function emitAdminMint(contractorId) {
    const res = await httpRequest(port, 'POST', '/api/admin/invite-links', {
      token: fixtures[contractorId].adminToken,
      body: { linkType: 'contractor' },
    });
    assert.equal(res.status, 200, `admin invite-link mint failed: ${res.raw}`);
    assert.ok(res.body.slug, 'admin mint returned no slug');
    return { url: res.body.fullUrl, slug: res.body.slug };
  }

  async function emitAdminList(contractorId) {
    const slug = await mintContractorToken(contractorId);
    const res = await httpRequest(port, 'GET', '/api/admin/invite-links', {
      token: fixtures[contractorId].adminToken,
    });
    assert.equal(res.status, 200, `admin invite-link listing failed: ${res.raw}`);
    assert.ok(Array.isArray(res.body), `expected an array, got: ${res.raw}`);
    const row = res.body.find(r => r.slug === slug);
    assert.ok(row, `the listing did not include the seeded token ${slug}`);
    return { url: row.fullUrl, slug };
  }

  // The cron CTA is only observable inside the email it sends, and the cron has no
  // callable entry point today — its whole body is a closure inside
  // cron.schedule(() => withLock(...)), and startPostJobSequenceJob only registers
  // the 7am-UTC schedule. tenantIsolation.test.js already documents that gap as the
  // reason it could only assert a verbatim-copied query. Phase 2c must extract the
  // pass and export it, exactly as engagementCadence.js exports
  // _runEngagementCadencePass — otherwise this generator is untestable, which is how
  // it came to be the only one nobody noticed was emitting an unbranded host.
  async function emitCronCta(contractorId) {
    const mod = require('../cron/jobs/postJobSequence');
    assert.equal(
      typeof mod._runPostJobSequencePass, 'function',
      'server/cron/jobs/postJobSequence.js must export a callable pass ' +
      '(_runPostJobSequencePass, mirroring engagementCadence.js _runEngagementCadencePass) — ' +
      'the Scenario B CTA cannot be asserted while the only export registers a 7am cron schedule'
    );

    await mintContractorToken(contractorId);
    // Resolve the slug through the cron's OWN selection query rather than assuming it
    // picks the token just minted. Any token it picks must still be this tenant's.
    const { rows: tokenRows } = await pool.query(
      `SELECT slug FROM contractor_invite_links
        WHERE contractor_id = $1 AND link_type = 'contractor' AND active = TRUE
        ORDER BY created_at DESC LIMIT 1`,
      [contractorId]
    );
    const slug = tokenRows[0].slug;

    const jobberClientId = uniq('jc');
    const recipient = `${uniq('homeowner')}@test.invalid`;
    // Unique, and never equal to a seeded users.full_name: the cron's name-match
    // lookup is global and unscoped, so a collision would route this row into
    // Scenario A (which sends no invite CTA at all) and the test would fail for a
    // reason that has nothing to do with slugs.
    const clientName = uniq('Cron Client');

    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, job_completed_at, t24_sequence_triggered)
       VALUES ($1, $2, $3, NOW() - INTERVAL '24 hours', FALSE)`,
      [contractorId, jobberClientId, clientName]
    );
    await pool.query(
      `INSERT INTO contacts (id, contractor_id, email, name, jobber_client_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [contractorId, recipient, clientName, jobberClientId]
    );

    sentEmails.length = 0;
    await mod._runPostJobSequencePass();

    const sent = sentEmails.find(e => e.to === recipient);
    assert.ok(sent, `the cron sent no Scenario B welcome email to ${recipient}`);
    const href = /href="([^"]+)"/.exec(sent.html);
    assert.ok(href, 'the Scenario B email carries no CTA href');
    return { url: href[1], slug };
  }

  const GENERATORS = [
    { name: 'GET /api/referrer/my-invite-link', emit: emitMyInviteLink },
    { name: 'GET /api/referrer/qr-code', emit: emitQrCode },
    { name: 'POST /api/admin/invite-links', emit: emitAdminMint },
    { name: 'GET /api/admin/invite-links', emit: emitAdminList },
    { name: 'cron post_job_sequence — Scenario B CTA', emit: emitCronCta },
  ];

  // ── 0. FIXTURE HYGIENE ─────────────────────────────────────────────────────

  it('fixture hygiene — no internal id is a substring of any public slug, or vice versa', () => {
    // Every leak assertion in this file is a substring search. If an internal id
    // shared text with the slug that is SUPPOSED to be in the URL, the leak tests
    // would either pass vacuously or fail spuriously, and no failure message would
    // say which. Asserted rather than assumed.
    const ids = [TENANT_A_ID, TENANT_B_ID, TENANT_NOSLUG_ID];
    const slugs = [SLUG_A, SLUG_B, FALLBACK_HOST.split('.')[0]];
    for (const id of ids) {
      for (const slug of slugs) {
        assert.equal(id.includes(slug), false, `internal id ${id} contains public slug ${slug}`);
        assert.equal(slug.includes(id), false, `public slug ${slug} contains internal id ${id}`);
      }
    }
  });

  // ── 1. STAGE-1 BYTE IDENTITY — THE SAFETY NET ──────────────────────────────
  // GREEN ON ARRIVAL BY DESIGN for the four HTTP generators. Stage 1 is what
  // production serves right now and will keep serving until the D3 flip closes this
  // session; every invite link already texted, printed or emailed resolves through
  // it. Threading a slug must change these bytes by exactly zero. A test that only
  // went green after the change could not have proven that.
  //
  // The cron generator is red here for a different reason — it has no callable
  // entry point yet — and that is the correct failure.

  for (const g of GENERATORS) {
    it(`STAGE 1 — ${g.name} emits the byte-identical legacy signup shape`, async () => {
      await withStage1(async () => {
        const { url, slug } = await g.emit(TENANT_A_ID);
        assert.equal(
          url, `${STAGE1_FRONTEND}?signup=${slug}`,
          'stage-1 output must not change by a single byte — every link already in the ' +
          'wild resolves through this shape until the D3 flip'
        );
      });
    });
  }

  // ── 2. STAGE-2 SUBDOMAIN EMISSION ──────────────────────────────────────────
  // RED today: every generator calls buildInviteUrl with no contractor context, so
  // all five render on the bare apex.

  for (const g of GENERATORS) {
    it(`STAGE 2 — ${g.name} emits https://<public-slug>.<base>/i/<token>`, async () => {
      await withStage2(async () => {
        const { url, slug } = await g.emit(TENANT_A_ID);
        assert.equal(
          url, `https://${SLUG_A}.${APEX}/i/${slug}`,
          `${g.name} must render on the contractor's own subdomain`
        );
      });
    });
  }

  // ── 3. THE INTERNAL ID NEVER LEAKS ─────────────────────────────────────────
  // GREEN ON ARRIVAL BY CONSTRUCTION, and deliberately so: no generator threads any
  // contractor value today, so none can leak one today. This is a guard aimed at
  // Phase 2c, where the whole task is "pass the contractor through" and the value
  // closest to hand at every call site is contractor_id — the wrong one. It is the
  // single most likely way to implement this phase incorrectly, and the resulting
  // URL would look entirely plausible in a code review.
  //
  // NON-VACUITY: each emitter asserts a 200 (or, for the cron, that an email was
  // actually sent) before returning, and each test below asserts the URL parses and
  // carries its token slug BEFORE asserting the internal id is absent. A 404 body
  // and an empty string both contain no internal id.

  for (const g of GENERATORS) {
    it(`LEAK GUARD — ${g.name} never puts the internal contractor id in the URL`, async () => {
      for (const [label, stage] of [['stage 1', withStage1], ['stage 2', withStage2]]) {
        await stage(async () => {
          const { url, slug } = await g.emit(TENANT_A_ID);

          // Preconditions — the thing that must NOT contain the id has to exist first.
          assert.ok(url, `${g.name} (${label}): emitted no URL at all`);
          const parsed = new URL(url);
          assert.ok(parsed.protocol.startsWith('http'), `${g.name} (${label}): not an http(s) URL: ${url}`);
          assert.ok(
            url.includes(slug),
            `${g.name} (${label}): the emitted URL does not carry its own token slug: ${url}`
          );

          // The claim. These URLs are printed on physical material and cannot be recalled.
          assert.equal(
            url.includes(TENANT_A_ID), false,
            `${g.name} (${label}): the internal contractor id leaked into a public URL: ${url}`
          );
        });
      }
    });
  }

  // ── 4. NO-SLUG FALLBACK ────────────────────────────────────────────────────
  // Every contractor except Accent is in this state today — contractors.slug is
  // nullable, has no DEFAULT, and is deliberately not backfilled from the id.
  // A working link with generic branding beats a contractor who cannot share
  // anything at all, so the answer is the neutral host, not a refusal.

  for (const g of GENERATORS) {
    it(`NO-SLUG — ${g.name} falls back to the neutral ${FALLBACK_HOST} host`, async () => {
      await withStage2(async () => {
        const { url, slug } = await g.emit(TENANT_NOSLUG_ID);

        assert.ok(url, `${g.name}: emitted no URL at all`);
        const parsed = new URL(url);
        assert.ok(url.includes(slug), `${g.name}: the emitted URL does not carry its token slug: ${url}`);

        assert.equal(
          parsed.hostname, FALLBACK_HOST,
          `${g.name}: an unslugged contractor must render on the neutral host. ` +
          `The bare apex serves the marketing site and has no /i/ route, so a link ` +
          `pointing there is a dead link on a printed sign. Got: ${url}`
        );
        assert.equal(
          url.includes(TENANT_NOSLUG_ID), false,
          `${g.name}: the internal id was used as a stand-in slug: ${url}`
        );
      });
    });
  }

  // ── 5. TWO-TENANT CORRECTNESS ──────────────────────────────────────────────
  // See the GUARD-PROOF SITE note in the file header: drop the `WHERE id = $1`
  // predicate from Phase 2c's slug lookup and every test below must go red.

  for (const g of GENERATORS) {
    it(`TWO TENANTS — ${g.name} emits each contractor's own slug, never the other's`, async () => {
      await withStage2(async () => {
        const a = await g.emit(TENANT_A_ID);
        const b = await g.emit(TENANT_B_ID);

        assert.equal(a.url, `https://${SLUG_A}.${APEX}/i/${a.slug}`, `${g.name}: tenant A got the wrong host`);
        assert.equal(b.url, `https://${SLUG_B}.${APEX}/i/${b.slug}`, `${g.name}: tenant B got the wrong host`);

        assert.equal(
          new URL(a.url).hostname.startsWith(`${SLUG_B}.`), false,
          `${g.name}: tenant A's link renders on tenant B's subdomain: ${a.url}`
        );
        assert.equal(
          new URL(b.url).hostname.startsWith(`${SLUG_A}.`), false,
          `${g.name}: tenant B's link renders on tenant A's subdomain: ${b.url}`
        );
        assert.equal(a.url.includes(TENANT_B_ID), false, `${g.name}: tenant B's internal id leaked into tenant A's URL`);
        assert.equal(b.url.includes(TENANT_A_ID), false, `${g.name}: tenant A's internal id leaked into tenant B's URL`);
      });
    });
  }
});
