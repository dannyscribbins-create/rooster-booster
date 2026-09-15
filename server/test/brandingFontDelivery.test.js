'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE FONT CHAIN'S MISSING LINK — loadContractorBranding SELECTED NO FONT COLUMNS
//
// ⚠ THE DEFECT. `loadContractorBranding()` is, by its own comment, *the ONE
// loader behind both the landing page and GET /api/branding/:slug*. Its SELECT
// named every column the resolver reads EXCEPT `font_heading` and `font_body`.
// So `resolveBrandingTheme(row)` saw `undefined` for both, `resolveFont()`
// returned the platform default, and **no contractor's chosen fonts could reach
// any surface.** Measured live before the fix: a contractor stored as
// `Playfair Display` mounted `'Montserrat', sans-serif`.
//
// ⚠ THE WHOLE FONT ARC WAS INERT. Palette-13 built the resolver, the allowlist,
// the per-family generics and the mount; Part B declared 25 self-hosted faces;
// B.7 migrated 313 painters. **None of it could receive a contractor's value**,
// because the loader upstream never asked for the columns.
//
// ⚠ AND B.7's SERIF TEST PASSED, WHICH IS THE PART TO UNDERSTAND. It set the
// family at a layer DOWNSTREAM of the missing SELECT and verified forward from
// there. Nobody checked that the resolver RECEIVES anything. **A test that
// injects at the wrong layer passes on a broken chain** — the same family as
// four independent checks passing on five black icons.
//
// ── ⚠ SO EVERY CASE BELOW SOURCES ITS VALUE FROM A REAL ROW ─────────────────
// These run against the real local Postgres (server/test/setup.js's interlock
// refuses anything but localhost). **Nothing here injects a font value into the
// resolver, the provider or a component.** A `db` double that returned whatever
// row the test handed it would NOT exercise the SELECT at all — it would
// reproduce exactly the mistake this file exists to fix, and would stay green
// against the broken loader.
//
// ⚠ EXPECTED COUNT: 15 cases across 6 suites. Stated because a module that
// fails to LOAD contributes zero while the runner still reports the run as
// passing. Several `for` loops appear below and EVERY one sits inside an `it()`
// body — they multiply nothing.
// ⚠ COUNTED WITH `grep -c`, AND THE FIRST PASS PREDICTED 14 — one block was
// planned with two cases and written with three. That is the third recorded
// estimate-instead-of-count slip in this repo and all three were LOW, which is
// the dangerous direction: a low prediction looks identical to a suite that did
// not run.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedUser, seedSession } = require('./helpers');
const { loadContractorBranding } = require('../utils/landingResolve');
const { BRANDING_THEME_DEFAULTS, FONT_STACKS } = require('../utils/brandingTheme');

const TENANT = 'font-delivery-tenant';
const SLUG = 'fontdeliveryco';

// ⚠ A SERIF, AND DELIBERATELY NOT THE PLATFORM DEFAULT. `Montserrat` is both the
// platform heading default AND what the two seeded reference contractors store,
// so on those a correct wiring and a completely unwired one produce IDENTICAL
// values — `elevationTheme.js` warns about exactly this and it is why the whole
// defect survived. Every assertion here uses a family the default is not.
const STORED_HEADING = 'Playfair Display';
const STORED_BODY = 'Lato';

let pool;
let server;
let port;

function httpGet(p, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path: p, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch { /* non-JSON is a real answer */ }
          resolve({ status: res.statusCode, body: json, raw: data });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Writes the two font columns for the tenant. `undefined` leaves them unset. */
async function setFonts(heading, body) {
  await pool.query(
    `UPDATE contractor_settings SET font_heading = $2, font_body = $3 WHERE contractor_id = $1`,
    [TENANT, heading === undefined ? null : heading, body === undefined ? null : body]
  );
}

before(async () => {
  pool = await initTestDb();
  await seedContractor(pool, TENANT);
  await pool.query(`UPDATE contractors SET slug = $2 WHERE id = $1`, [TENANT, SLUG]);
  const app = createApp();
  ({ server, port } = await startTestServer(app));
});

after(async () => {
  if (server) await stopTestServer(server);
  if (pool) await pool.end();
});

beforeEach(async () => {
  await setFonts(null, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// NON-VACUITY, FIRST AND UNCONDITIONALLY
// ═══════════════════════════════════════════════════════════════════════════
describe('font delivery — the fixture is real', () => {
  it('the families this file uses are on the allowlist and are NOT the defaults', () => {
    // ⚠ IF EITHER OF THESE EVER EQUALS THE DEFAULT, every assertion in this file
    // goes vacuous in the exact way the original defect did — passing because
    // the stored value and the fallback are the same string.
    assert.ok(FONT_STACKS[STORED_HEADING], `${STORED_HEADING} must be allowlisted`);
    assert.ok(FONT_STACKS[STORED_BODY], `${STORED_BODY} must be allowlisted`);
    assert.notEqual(STORED_HEADING, BRANDING_THEME_DEFAULTS.headingFont);
    assert.notEqual(STORED_BODY, BRANDING_THEME_DEFAULTS.bodyFont);
    assert.equal(FONT_STACKS[STORED_HEADING], 'serif', 'the heading fixture must be a serif');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T1 — AT THE LOADER'S OWN BOUNDARY
// ⚠ A TEST DOWNSTREAM OF IT IS THE DEFECT THAT SHIPPED.
// ═══════════════════════════════════════════════════════════════════════════
describe('T1 — loadContractorBranding returns the stored fonts', () => {
  it('[RED] the STORED heading font arrives, sourced from the row', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const branding = await loadContractorBranding(pool, TENANT);
    assert.ok(branding, 'the loader returned nothing for a seeded contractor');
    assert.equal(
      branding.headingFont, STORED_HEADING,
      'the loader did not deliver the stored heading font. If this is the platform ' +
      'default, the SELECT is not asking for font_heading — which is the whole defect.'
    );
  });

  it('[RED] the STORED body font arrives, sourced from the row', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const branding = await loadContractorBranding(pool, TENANT);
    assert.equal(branding.bodyFont, STORED_BODY);
  });

  it('[RED] the two roles are independent — one set, one unset', async () => {
    // ⚠ A SINGLE COMBINED ASSERTION WOULD PASS IF THE LOADER SELECTED ONE COLUMN
    // AND NOT THE OTHER, which is a state this defect makes entirely plausible.
    await setFonts(STORED_HEADING, null);
    const branding = await loadContractorBranding(pool, TENANT);
    assert.equal(branding.headingFont, STORED_HEADING);
    assert.equal(branding.bodyFont, BRANDING_THEME_DEFAULTS.bodyFont);
    // And mono is platform-fixed in both directions — there is no column.
    assert.equal(branding.monoFont, BRANDING_THEME_DEFAULTS.monoFont);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2 — END TO END OVER HTTP, FROM THE ROW. NO INJECTION AT ANY LAYER.
// ═══════════════════════════════════════════════════════════════════════════
describe('T2 — the delivery surfaces carry the stored fonts', () => {
  it('[RED] GET /api/branding/:slug delivers them', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const res = await httpGet(`/api/branding/${SLUG}`);
    assert.equal(res.status, 200);
    const b = res.body.branding || res.body;
    assert.equal(b.headingFont, STORED_HEADING);
    assert.equal(b.bodyFont, STORED_BODY);
  });

  it('[RED] GET /api/session/branding delivers them — the D4 chain\'s source 1', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const userId = await seedUser(pool, {
      fullName: 'Font Tester', email: 'font@tester.invalid', contractorId: TENANT,
    });
    const token = 'f'.repeat(64);
    await seedSession(pool, { userId, token, role: 'referrer', contractorId: TENANT });
    const res = await httpGet('/api/session/branding', { Authorization: `Bearer ${token}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.branding.headingFont, STORED_HEADING);
    assert.equal(res.body.branding.bodyFont, STORED_BODY);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 — THE ABSENCE SHAPES, EACH PAIRED WITH A STORED-VALUE CASE
// ⚠ WITHOUT THE PAIR, EVERY ONE OF THESE PASSES AGAINST A BUILD THAT IGNORES
// THE COLUMN ENTIRELY — which is exactly what shipped.
// ═══════════════════════════════════════════════════════════════════════════
describe('T3 — absent means the platform default, and absence is four shapes', () => {
  // The loop is INSIDE the it() body; it emits no cases.
  const ABSENT = [['null', null], ['empty string', ''], ['whitespace only', '   '], ['a tab', '\t']];

  it('[RED] every absent shape returns the platform default', async () => {
    for (const [label, value] of ABSENT) {
      await setFonts(value, value);
      const b = await loadContractorBranding(pool, TENANT);
      assert.equal(b.headingFont, BRANDING_THEME_DEFAULTS.headingFont, `heading, ${label}`);
      assert.equal(b.bodyFont, BRANDING_THEME_DEFAULTS.bodyFont, `body, ${label}`);
    }
  });

  it('[RED] THE PAIR — the same contractor with a stored value gets that value', async () => {
    // ⚠ THIS IS THE CASE THAT MAKES THE ONE ABOVE MEAN ANYTHING. Flipping the
    // same row between absent and present, through the same loader, is what
    // separates "the default is correct" from "the column is never read".
    for (const [label, value] of ABSENT) {
      await setFonts(value, value);
      const absent = await loadContractorBranding(pool, TENANT);
      assert.equal(absent.headingFont, BRANDING_THEME_DEFAULTS.headingFont, `absent, ${label}`);

      await setFonts(STORED_HEADING, STORED_BODY);
      const present = await loadContractorBranding(pool, TENANT);
      assert.equal(present.headingFont, STORED_HEADING, `present after ${label}`);
      assert.equal(present.bodyFont, STORED_BODY, `present after ${label}`);
      assert.notEqual(present.headingFont, absent.headingFont, `the row made no difference after ${label}`);
    }
  });

  it('[RED] a contractor with NO settings row at all gets the defaults', async () => {
    const bare = 'font-delivery-bare';
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`, [bare]);
    const b = await loadContractorBranding(pool, bare);
    assert.ok(b, 'a contractor with no settings row must still resolve');
    assert.equal(b.headingFont, BRANDING_THEME_DEFAULTS.headingFont);
    assert.equal(b.bodyFont, BRANDING_THEME_DEFAULTS.bodyFont);
  });

  it('[RED] and a contractor that does not exist returns null, not a default block', async () => {
    const b = await loadContractorBranding(pool, 'font-delivery-nobody');
    assert.equal(b, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T4 — THE ALLOWLIST STILL GOVERNS. THIS FIX MUST NOT BYPASS resolveFont.
// ═══════════════════════════════════════════════════════════════════════════
describe('T4 — an off-allowlist value still falls back', () => {
  // ⚠ BOTH CASES BELOW ARE PAIRED WITH A STORED-VALUE ASSERTION, FOR THE SAME
  // REASON T3'S ARE — AND THIS PAIRING WAS MISSING FROM THE FIRST DRAFT.
  // A rejection test passes against the BROKEN loader too, because a column that
  // is never read also produces the default. The two states are indistinguishable
  // by the fallback alone: one is `resolveFont` doing its job, the other is the
  // value never arriving. CLAUDE.md's shape #10 exactly — the behaviour fails
  // safe either way, and only the REASON differs, which is the whole property.
  it('[RED] a plausible but unlisted family resolves to the platform default', async () => {
    await setFonts('Comic Sans MS', 'Comic Sans MS');
    const rejected = await loadContractorBranding(pool, TENANT);
    assert.equal(rejected.headingFont, BRANDING_THEME_DEFAULTS.headingFont);
    assert.equal(rejected.bodyFont, BRANDING_THEME_DEFAULTS.bodyFont);

    // THE PAIR: the same column, an allowlisted value, must arrive — otherwise
    // the rejection above proves nothing about the allowlist.
    await setFonts(STORED_HEADING, STORED_BODY);
    const accepted = await loadContractorBranding(pool, TENANT);
    assert.equal(accepted.headingFont, STORED_HEADING,
      'the column is not being read at all, so the rejection above was not resolveFont\'s doing');
  });

  it('[RED] GUARD-PROOF — a hostile value never reaches the output', async () => {
    // ⚠ THE COLUMN IS REACHABLE BY A DIRECT DATABASE WRITE, a migration, and any
    // tenant admin holding `branding.manage`. resolveFont is READ-TIME for that
    // reason; the write-time check is defence in depth and is not sufficient.
    // This writes the hostile value straight to the column, bypassing the
    // endpoint entirely — which is the threat model resolveFont was built for.
    const HOSTILE = 'Evil", sans-serif; } body { display:none } /*';
    await setFonts(HOSTILE, HOSTILE);
    const b = await loadContractorBranding(pool, TENANT);
    assert.equal(b.headingFont, BRANDING_THEME_DEFAULTS.headingFont);
    assert.equal(b.bodyFont, BRANDING_THEME_DEFAULTS.bodyFont);
    // And it is absent from the whole payload, not merely from the font keys.
    assert.ok(!JSON.stringify(b).includes('display:none'), 'the hostile value reached the payload');
    assert.ok(!JSON.stringify(b).includes('Evil'), 'the hostile family name reached the payload');

    // THE PAIR, for the same reason as the case above: a column nobody reads
    // rejects a hostile value just as thoroughly as a working allowlist does.
    await setFonts(STORED_HEADING, STORED_BODY);
    const accepted = await loadContractorBranding(pool, TENANT);
    assert.equal(accepted.headingFont, STORED_HEADING,
      'the column is not being read at all, so the rejection above was free');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T5 — ONE LOADER, AND IT SUPPLIES EVERYTHING THE RESOLVER READS
// ⚠ THIS IS THE CLOSURE HALF. The defect was not "fonts were forgotten"; it was
// "nothing checks the loader against the resolver". A second missing column
// would have the identical symptom — a value that resolves to its default for
// every contractor and looks correct on the platform brand.
// ═══════════════════════════════════════════════════════════════════════════
describe('T5 — the loader supplies every column the resolver reads', () => {
  const ROOT = path.resolve(__dirname, '..');

  // Block comments blanked so prose naming a column is not read as a read.
  // brandingTheme.js's own comments name `font_heading`, `review_url` and more.
  const blankComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/)
    .map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/\/\/[^\n'"`]*$/, '')))
    .join('\n');

  function selectColumns(sql) {
    // ⚠ COMMENTS ARE STRIPPED BEFORE THE `FROM` IS LOCATED, AND THE ORDER IS A
    // BUG THIS FENCE ALREADY HIT ONCE. Matching /SELECT(.*?)\bFROM\b/i against
    // the RAW sql lets the word "from" inside a SQL comment end the column list
    // — the real query contains "the resolver derives one from the other" — and
    // it reported a supplied column as missing. A confident, wrong finding.
    const decommented = sql.split(/\r?\n/).map((l) => l.replace(/--.*$/, '')).join('\n');
    const m = /SELECT([\s\S]*?)\bFROM\b/i.exec(decommented);
    assert.ok(m, 'no SELECT ... FROM found');
    const out = new Set();
    for (const raw of m[1].split(/\r?\n/).join(' ').split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const as = /\bAS\s+([a-z_][a-z0-9_]*)\s*$/i.exec(t);
      if (as) { out.add(as[1].toLowerCase()); continue; }
      const col = /([a-z_][a-z0-9_]*)\s*$/i.exec(t);
      if (col) out.add(col[1].toLowerCase());
    }
    return out;
  }

  it('the SQL parser is correct in BOTH directions', () => {
    const cols = selectColumns('SELECT c.slug, c.name AS contractor_name FROM x');
    assert.ok(cols.has('slug'));
    assert.ok(cols.has('contractor_name'));
    assert.ok(!cols.has('name'), 'the AS alias leaked the raw column');
    assert.ok(!cols.has('c'), 'a table alias was read as a column');
    // The regression fixture for the comment-containing-"from" bug above.
    const tricky = selectColumns(
      'SELECT c.slug,\n  -- derives one from the other when unset\n  ca.google_place_id\n FROM t'
    );
    assert.ok(tricky.has('google_place_id'), 'a comment containing "from" truncated the list');
    assert.ok(tricky.has('slug'));
  });

  it('[RED] every column resolveBrandingTheme reads is in the loader\'s SELECT', () => {
    const resolverSrc = blankComments(
      fs.readFileSync(path.join(ROOT, 'utils/brandingTheme.js'), 'utf8')
    );
    const reads = new Set();
    for (const m of resolverSrc.matchAll(/\bsrc\.([a-z_][a-z0-9_]*)/g)) reads.add(m[1]);
    // ⚠ NON-VACUITY: if the needle ever stops matching, this fence passes by
    // comparing two empty sets — the shape it exists to catch.
    assert.ok(reads.size >= 25, `the resolver-read needle found only ${reads.size} columns`);
    assert.ok(reads.has('font_heading'), 'the needle did not find the column this phase is about');

    const loaderSrc = fs.readFileSync(path.join(ROOT, 'utils/landingResolve.js'), 'utf8');
    const at = loaderSrc.indexOf('async function loadContractorBranding');
    assert.ok(at > -1, 'loadContractorBranding not found');
    const tick = loaderSrc.indexOf('`', at);
    const end = loaderSrc.indexOf('`', tick + 1);
    const supplied = selectColumns(loaderSrc.slice(tick + 1, end));

    const missing = [...reads].filter((c) => !supplied.has(c)).sort();
    assert.deepEqual(
      missing, [],
      'The loader does not supply these columns, so resolveBrandingTheme sees undefined and ' +
      'returns the platform default for EVERY contractor — silently, and correct-looking on ' +
      'the platform brand. That is the font defect, and this fence exists so the next one ' +
      'fails here instead of shipping: ' + missing.join(', ')
    );
  });

  it('every branding-serving route goes through the ONE loader', () => {
    // ⚠ A FIX TO ONE LOADER THAT LEAVES ANOTHER SHORT REPRODUCES THE DEFECT ON A
    // DIFFERENT SURFACE. There is exactly one loader today; this pins that.
    const ROUTES = ['routes/branding.js', 'routes/session.js', 'routes/admin/index.js'];
    for (const rel of ROUTES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.ok(
        src.includes('loadContractorBranding'),
        `${rel} serves branding without the shared loader — a second SELECT is a second thing to forget`
      );
    }
  });
});
