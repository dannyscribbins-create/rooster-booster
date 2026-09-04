'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-0 — THE LOCAL MULTI-CONTRACTOR STACK, AS A COMMITTED RECIPE
//
// ⚠ THE RECIPE IS THE DELIVERABLE, NOT THE RUNNING STACK. A stack was built by
// hand twice during the BR arc and thrown away twice; what survived each time was
// the EVIDENCE that it had run (browser walkthroughs quoted in commit bodies),
// never the steps. PRE_LAUNCH_CHECKLIST.md's Developer-setup entry is a request
// to stop doing that. This file is the answer.
//
// ── HOW TO RUN IT ───────────────────────────────────────────────────────────
//     npm run seed:local            # create + migrate + seed, idempotent
//     npm run seed:local -- --drop  # start from nothing
//
// Then point a server at it and open the app:
//     DATABASE_URL=<printed by this script> node server.js     # API on :4000
//     npm start                                                # Vite on :3000
//
// ── ⚠ SAFETY, AND IT IS THE FIRST THING BECAUSE IT IS THE WORST FAILURE ─────
// A seeding script that could point at production is a worse defect than
// anything this arc has found. TWO independent interlocks, both fail-closed,
// both asserted by tests:
//   1. The host MUST be localhost or 127.0.0.1. Same rule and same shape as
//      server/test/setup.js's interlock.
//   2. The database MUST NOT be `roofmiles_test`. That one belongs to the suite,
//      which runs `DROP SCHEMA public CASCADE` on every invocation — a long-lived
//      hand-seeded stack living there is destroyed by the next `npm test` and can
//      wedge pg_trgm on the way out. This stack gets its own scratch database.
// ⚠ NEITHER INTERLOCK IS ADVISORY. They throw before a single query is issued.
//
// ── ⚠ WHY CONTRACTOR C IS THE POINT ────────────────────────────────────────
// A and B exist so a cross-tenant leak is OBVIOUS rather than subtle — different
// palettes, different logos, different names. But every absence rule this arc has
// ruled (BrandMark's A1/A2 prongs, the review-destination gates, the socials row,
// the hint write-through) is only exercisable against a contractor that has NOT
// set things. C is that contractor.
//
// ⚠ AND C USES NULL *AND* EMPTY STRING, DELIBERATELY. This arc has repeatedly
// found the two behaving differently — `firstNonEmpty` treats '' as absent while
// a plain `|| null` does not, and the resolver OMITS some keys rather than
// nulling them. A fixture using only NULL exercises only one branch, and reads
// as complete while covering half the cases.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const { Client } = require('pg');

const DEFAULT_STACK_DB = 'roofmiles_local';
const FORBIDDEN_DB = 'roofmiles_test';

/**
 * Fail-closed check on where this script is allowed to write.
 *
 * @param {string} url  a postgres connection string
 * @returns {{hostname: string, database: string}} on success
 * @throws  on a missing/unparseable URL, a non-local host, or the suite's own
 *          database. Never returns a partial answer — a guard that can also say
 *          "I could not tell" is indistinguishable from a guard that passed.
 */
function assertLocalStackTarget(url) {
  if (!url || typeof url !== 'string') {
    throw new Error(
      'LOCAL STACK INTERLOCK: no connection string.\n' +
      'Expected .env.test to supply DATABASE_URL, or LOCAL_STACK_DATABASE_URL to be set.'
    );
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`LOCAL STACK INTERLOCK: cannot parse connection string: ${url}`);
  }
  const hostname = parsed.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error(
      '\n\n*** LOCAL STACK INTERLOCK ***\n' +
      `Connection string points to '${hostname}' — the local stack may only be seeded\n` +
      'against localhost or 127.0.0.1. ABORTING before any query is issued.\n'
    );
  }
  const database = parsed.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('LOCAL STACK INTERLOCK: connection string names no database.');
  }
  if (database === FORBIDDEN_DB) {
    throw new Error(
      '\n\n*** LOCAL STACK INTERLOCK ***\n' +
      `Refusing to seed '${FORBIDDEN_DB}'. That database belongs to the test suite,\n` +
      'which runs DROP SCHEMA public CASCADE on every run — this stack would be\n' +
      'destroyed by the next `npm test`. Use a separate scratch database.\n'
    );
  }
  return { hostname, database };
}

/** Swaps the database name in a connection string, preserving credentials. */
function withDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

// ── THE THREE CONTRACTORS ───────────────────────────────────────────────────
// ⚠ NO 'accent-roofing' ANYWHERE. These ids are deliberately arc-named so a grep
// for a tenant literal cannot match a seeded fixture, and so nobody mistakes one
// of these for a real row.
const CONTRACTORS = Object.freeze([
  {
    id: 'palette-alpha',
    name: 'Alpha Roofing Co',
    slug: 'alpha-roofing',
    label: 'A — fully configured',
    settings: {
      company_name: 'Alpha Roofing Co',
      app_display_name: 'Alpha Rewards',
      company_phone: '(770) 555-0101',
      company_email: 'hello@alpha-roofing.test',
      company_url: 'alpha-roofing.test',
      company_address: '1 Alpha Way, Marietta, GA',
      logo_url: 'https://example.invalid/alpha-logo.png',
      primary_color: '#1C2D4D',
      secondary_color: '#F26A1B',
      accent_color: '#FDF0E7',
      landing_bg_color: '#FFFFFF',
      font_heading: 'Montserrat',
      font_body: 'Roboto',
      social_facebook: 'https://facebook.com/alpharoofing',
      social_instagram: 'https://instagram.com/alpharoofing',
      social_google: 'https://g.page/alpharoofing',
      social_nextdoor: 'https://nextdoor.com/alpharoofing',
      social_website: 'https://alpha-roofing.test',
      review_url: 'https://g.page/alpharoofing/review',
      review_button_text: 'Leave a Review',
      review_message: 'Enjoying the rewards? Leave us a quick review!',
    },
  },
  {
    id: 'palette-beta',
    name: 'Beta Exteriors',
    slug: 'beta-exteriors',
    label: 'B — fully configured, VISIBLY different',
    settings: {
      company_name: 'Beta Exteriors',
      app_display_name: 'Beta Perks',
      company_phone: '(770) 555-0202',
      company_email: 'hello@beta-exteriors.test',
      company_url: 'beta-exteriors.test',
      company_address: '2 Beta Blvd, Roswell, GA',
      logo_url: 'https://example.invalid/beta-logo.png',
      // ⚠ CHOSEN TO BE UNMISTAKABLE, NOT TASTEFUL. A cross-tenant leak has to be
      // obvious at a glance: a teal ground and a magenta action cannot be
      // confused with Alpha's navy/orange by anyone, including a screenshot.
      primary_color: '#0B3D3B',
      secondary_color: '#C2185B',
      accent_color: '#E6F4F1',
      landing_bg_color: '#F4FBFA',
      font_heading: 'Playfair Display',
      font_body: 'Lato',
      social_facebook: 'https://facebook.com/betaexteriors',
      social_instagram: '',
      social_google: '',
      social_nextdoor: '',
      social_website: 'https://beta-exteriors.test',
      review_url: 'https://g.page/betaexteriors/review',
      review_button_text: 'Rate Beta',
      review_message: 'How did we do? A quick review helps us a lot.',
    },
  },
  {
    id: 'palette-gamma',
    name: 'Gamma Roofing',
    // ⚠ NULL, NOT ''. contractors.slug IS NULL is the state EVERY contractor
    // arrives in — no migration seeds one — so this is the common case, not an
    // edge case, and source 3 / source 2.5 of the D4 chain are unreachable
    // without a contractor in it.
    slug: null,
    label: 'C — deliberately sparse (the absence rule lives here)',
    settings: {
      company_name: 'Gamma Roofing',
      // ⚠ NULL *AND* '' ON PURPOSE, MIXED. firstNonEmpty() treats '' as absent;
      // a bare `|| null` does not; and the resolver OMITS socials/address/website
      // rather than nulling them. A fixture using only NULL exercises one branch
      // and reads as complete.
      app_display_name: null,
      company_phone: '',
      company_email: null,
      company_url: '',
      company_address: null,
      logo_url: null,          // A2: resolved contractor, no mark -> the NAME as text
      primary_color: null,     // -> platform defaults, the onboarding baseline
      secondary_color: null,
      accent_color: null,
      landing_bg_color: null,
      font_heading: null,
      font_body: null,
      social_facebook: '',
      social_instagram: '',
      social_google: '',
      social_nextdoor: '',
      social_website: '',      // all '' -> the socials row must not render at all
      review_url: null,        // no destination -> the review card and the
      review_button_text: null, //   ExperiencePopup button must both hide
      review_message: null,
    },
  },
]);

// ── THE ACCOUNTS ────────────────────────────────────────────────────────────
// ⚠ THE DUAL-IDENTITY ACCOUNT IS NOT PADDING. One person holding a team_members
// row AND a users row is the class that reproduced 1b102d9, and the only class
// that can hold a rep-side dark theme preference and then authenticate onto a
// referrer surface. Palette needs it because the referrer tree's lightness
// currently rests on those two subjects never meeting.
const DUAL_EMAIL = 'dual@alpha-roofing.test';

/**
 * Seeds the three contractors and their accounts into an already-migrated pool.
 * Idempotent: every write is an upsert, so re-running converges rather than
 * duplicating.
 *
 * @param {import('pg').Pool} pool  a pool already pointed at the scratch database
 * @returns {Promise<object>} a summary for the caller to print or assert on
 * @throws if the schema is missing a column this stack writes — see the preflight
 *         below. A seeder that silently skips a field it cannot write produces a
 *         stack that looks configured and is not.
 */
async function seedStack(pool) {
  // ── PREFLIGHT: every column this script writes must actually exist ────────
  // ⚠ THROWS RATHER THAN SKIPPING. If db.js drops or renames a branding column,
  // the failure has to be loud here — a stack quietly missing `review_url` would
  // send a future session hunting a component bug that is a seeding gap.
  const wanted = new Set();
  for (const c of CONTRACTORS) for (const k of Object.keys(c.settings)) wanted.add(k);
  const { rows: cols } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'contractor_settings'`
  );
  const have = new Set(cols.map((r) => r.column_name));
  const missing = [...wanted].filter((k) => !have.has(k)).sort();
  if (missing.length) {
    throw new Error(
      'LOCAL STACK: contractor_settings is missing columns this stack seeds: ' +
      missing.join(', ') + '\nRun initDB() first, or update CONTRACTORS in this file.'
    );
  }

  const summary = { contractors: [], accounts: [] };

  for (const c of CONTRACTORS) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
      [c.id, c.name, c.slug]
    );

    const keys = Object.keys(c.settings);
    const placeholders = keys.map((_, i) => `$${i + 2}`);
    const updates = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, ${keys.join(', ')})
       VALUES ($1, ${placeholders.join(', ')})
       ON CONFLICT (contractor_id) DO UPDATE SET ${updates.join(', ')}`,
      [c.id, ...keys.map((k) => c.settings[k])]
    );
    summary.contractors.push({ id: c.id, slug: c.slug, label: c.label });

    // ── one referrer, one field rep, one owner, per tenant ─────────────────
    // The PIN hash is a fixed placeholder: this stack is for LOOKING at surfaces,
    // and nothing here should imply a working password. See the limits block at
    // the foot of this file.
    const referrer = await pool.query(
      `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
       VALUES ($1, $2, '$2b$10$local.stack.placeholder.hash.not.a.password', TRUE, $3)
       ON CONFLICT (contractor_id, email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [`${c.name} Homeowner`, `referrer@${c.id}.test`, c.id]
    );
    summary.accounts.push({ contractor: c.id, role: 'referrer', email: `referrer@${c.id}.test`, id: referrer.rows[0].id });

    // ⚠ ON CONFLICT (email), NOT (contractor_id, email), AND THE DIFFERENCE IS A
    // FILED LAUNCH GATE. `team_members` carries `UNIQUE (email)` — GLOBALLY
    // unique, across every tenant — while `users` carries
    // `UNIQUE (contractor_id, email)`. The two tables disagree about what
    // identifies a person. Consequence, measured here rather than assumed: one
    // email address cannot be a team member at two contractors at all, so the
    // dual-identity fixture below is deliberately scoped to ONE tenant.
    // → PRE_LAUNCH_CHECKLIST.md's `team_members.email` uniqueness item.
    for (const [tier, isRep, who] of [['general', true, 'rep'], ['owner', false, 'owner']]) {
      const { rows } = await pool.query(
        `INSERT INTO team_members (contractor_id, full_name, email, tier, is_field_rep, active, password_hash)
         VALUES ($1, $2, $3, $4, $5, TRUE, '$2b$10$local.stack.placeholder.hash.not.a.password')
         ON CONFLICT (email) DO UPDATE
           SET tier = EXCLUDED.tier, is_field_rep = EXCLUDED.is_field_rep, active = TRUE
         RETURNING id`,
        [c.id, `${c.name} ${who}`, `${who}@${c.id}.test`, tier, isRep]
      );
      summary.accounts.push({ contractor: c.id, role: who, email: `${who}@${c.id}.test`, id: rows[0].id });
    }
  }

  // ── THE DUAL-IDENTITY PERSON — one email, two subjects, one tenant ────────
  const alpha = CONTRACTORS[0].id;
  const dualUser = await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
     VALUES ($1, $2, '$2b$10$local.stack.placeholder.hash.not.a.password', TRUE, $3)
     ON CONFLICT (contractor_id, email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    ['Dual Identity', DUAL_EMAIL, alpha]
  );
  const dualMember = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, tier, is_field_rep, active, password_hash)
     VALUES ($1, 'Dual Identity', $2, 'general', TRUE, TRUE, '$2b$10$local.stack.placeholder.hash.not.a.password')
     ON CONFLICT (email) DO UPDATE SET is_field_rep = TRUE, active = TRUE
     RETURNING id`,
    [alpha, DUAL_EMAIL]
  );
  summary.dual = {
    email: DUAL_EMAIL,
    contractor: alpha,
    userId: dualUser.rows[0].id,
    teamMemberId: dualMember.rows[0].id,
  };

  return summary;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
async function main() {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.test') });

  const base = process.env.LOCAL_STACK_DATABASE_URL || process.env.DATABASE_URL;
  const target = process.env.LOCAL_STACK_DATABASE_URL
    ? base
    : withDatabase(base, process.env.LOCAL_STACK_DB || DEFAULT_STACK_DB);

  const { hostname, database } = assertLocalStackTarget(target);
  console.log(`[local-stack] target: ${hostname}/${database}  (interlocks passed)`);

  // Create (or drop+create) the scratch database from the maintenance db.
  const admin = new Client({ connectionString: withDatabase(target, 'postgres') });
  await admin.connect();
  try {
    if (process.argv.includes('--drop')) {
      await admin.query(`DROP DATABASE IF EXISTS ${JSON.stringify(database).replace(/"/g, '"')}`);
      console.log(`[local-stack] dropped ${database}`);
    }
    await admin.query(`CREATE DATABASE ${JSON.stringify(database).replace(/"/g, '"')}`);
    console.log(`[local-stack] created ${database}`);
  } catch (err) {
    if (err.code !== '42P04') throw err; // duplicate_database — fine, we upsert
    console.log(`[local-stack] ${database} already exists`);
  } finally {
    await admin.end();
  }

  // db.js builds its pool from DATABASE_URL AT MODULE LOAD, so this assignment
  // must happen before the require. Same ordering constraint as test/setup.js.
  process.env.DATABASE_URL = target;
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      'LOCAL STACK: ENCRYPTION_KEY is not set. server.js will not boot without it ' +
      'either — .env.test carries one; add it to whatever env you run the server with.'
    );
  }
  const { pool, initDB } = require(path.resolve(__dirname, '..', 'server', 'db.js'));
  await initDB();
  console.log('[local-stack] schema migrated');

  const summary = await seedStack(pool);
  console.log('[local-stack] seeded:');
  for (const c of summary.contractors) console.log(`   ${c.id.padEnd(15)} slug=${String(c.slug)}  ${c.label}`);
  console.log(`   dual-identity: ${summary.dual.email} (user ${summary.dual.userId} + team_member ${summary.dual.teamMemberId})`);
  // ⚠ THE CONNECTION STRING IS NOT ECHOED. It carries a password, and a script
  // that prints one trains everybody to paste it into a terminal, a log or a
  // handoff. The database name is enough to reconstruct it from .env.test.
  console.log('\n[local-stack] run the app against it:');
  console.log(`   set DATABASE_URL to your .env.test value with the database swapped to '${database}',`);
  console.log('   set ENCRYPTION_KEY from .env.test, then:  node server.js');
  console.log('   npm start        # Vite on :3000, proxying to the API on :4000');
  await pool.end();
}

if (require.main === module) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}

module.exports = { assertLocalStackTarget, withDatabase, seedStack, CONTRACTORS, DUAL_EMAIL, DEFAULT_STACK_DB, FORBIDDEN_DB };

// ── ⚠ WHAT THIS STACK CANNOT DO. STATED SO NOBODY ASSUMES COVERAGE ──────────
// · NO REAL LOGIN. The pin column holds a fixed placeholder hash, not a bcrypt of
//   any known password. Surfaces are reached by minting a session row directly,
//   not by typing credentials. Making passwords real is a deliberate non-goal:
//   this stack is for LOOKING at rendered surfaces.
// · NO BACKBLAZE. logo_url points at example.invalid, so every logo <img> will
//   fail to load. That is USEFUL for the absence rule (it exercises the broken-
//   image path) and USELESS for judging a real mark.
// · NO JOBBER. No OAuth tokens, so no sync, no pipeline ingestion, no webhooks.
//   Anything downstream of a Jobber client is absent, not empty.
// · NO STRIPE. No connected accounts; the payout surfaces render their
//   not-connected branch only.
// · NO EMAIL OR SMS. Resend and Twilio are unconfigured; anything that sends will
//   fail rather than no-op, and that failure is not a defect in the surface.
// · NOT PRODUCTION-SHAPED DATA. No referrals, conversions, badges or
//   announcements are seeded here — the five contrived-data surfaces Palette
//   identified still need their own rows, and that is a separate job.
