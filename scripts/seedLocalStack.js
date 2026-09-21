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

  // ── THE REP'S DARK-MODE PREFERENCE (Canvass-2, amendment A34.10) ──────────
  //
  // ⚠ WITHOUT THIS ROW THE REP SHELL'S DARK STATE IS UNREACHABLE FROM A FRESH
  // SEED, and that is the whole reason it is here rather than in a phase of its
  // own. A fixture that never renders a state cannot test that state — the same
  // argument the money-surface block above makes, and the shape this repo has
  // recorded as "a mechanism reporting health it cannot observe", arriving as
  // absence: a dark-mode sweep against a stack with no dark preference reports a
  // clean light surface and never says the mode was never entered.
  //
  // ⚠ IT IS THE STACK'S ONLY `team_member`-SUBJECT PREFERENCE ROW, AND THAT IS
  // THE POINT RATHER THAN A DETAIL. Every other row in `user_preferences` is
  // homeowner-subject (`user_id`). Canvass-1 created the first team-member one by
  // hand through the real toggle and the real route; A34.10 makes the seeder own
  // it, because a hand-worked stack is a stack that is throwaway by the next
  // phase.
  //
  // ⚠ BETA, NOT ALPHA, AND NOT THE SPARSE ONE. The rep shell must be verified on
  // a contractor whose palette DIFFERS from the platform default — on the unset
  // contractor all six render tokens equal their fallbacks, so a correct wiring
  // and a broken one are indistinguishable. Alpha's palette IS the platform
  // default pair. Beta's teal/magenta is the one that can tell them apart.
  //
  // ⚠ ON CONFLICT NAMES THE PARTIAL INDEX'S OWN PREDICATE, VERBATIM. The unique
  // index is `(team_member_id, pref_key) WHERE team_member_id IS NOT NULL`, and
  // Postgres cannot INFER a partial index without repeating its WHERE clause —
  // omit it and this is a plain INSERT that raises on the second run and aborts
  // the entire seed. That is the same contract `setPreference()` documents.
  //
  // ⚠ pref_value IS JSONB, SO THE STRING IS JSON-ENCODED. `'dark'` would be
  // invalid JSON and `to_jsonb($1::text)` is how the value becomes the JSON
  // string the reader expects — not the bare word, which is a parse error rather
  // than a silently wrong row, and so fails loudly if this is ever "simplified".
  {
    const rep = summary.accounts.find((a) => a.contractor === 'palette-beta' && a.role === 'rep');
    if (rep) {
      await pool.query(
        `INSERT INTO user_preferences (team_member_id, contractor_id, pref_key, pref_value)
         VALUES ($1, 'palette-beta', 'theme_mode', to_jsonb($2::text))
         ON CONFLICT (team_member_id, pref_key) WHERE team_member_id IS NOT NULL
         DO UPDATE SET pref_value = EXCLUDED.pref_value, updated_at = NOW()`,
        [rep.id, 'dark']
      );
      summary.repThemePreference = { teamMemberId: rep.id, contractor: 'palette-beta', mode: 'dark' };
    }
  }

  // ── THE MONEY SURFACE (Palette-5, C.1) ───────────────────────────────────
  //
  // ⚠ WITHOUT THESE ROWS EVERY MONEY FIGURE IN THE APP RENDERS NOT AT ALL, and a
  // harness run reports a clean surface that is simply empty — which is the
  // "mechanism reporting health it cannot observe" shape, arriving as absence.
  // Palette-4c hit exactly that and worked around it by hand; this is that
  // workaround made into the recipe, because a hand-worked stack is a stack that
  // is throwaway by the next phase.
  //
  // ⚠ TWO NON-OBVIOUS REQUIREMENTS, BOTH FOUND THE HARD WAY:
  //   1. `referred_by` must be the referrer's FULL NAME, not their id. The
  //      stale-cache query matches `LOWER(referred_by) = LOWER($2)` against the
  //      user's name — an id here yields zero rows and an empty, plausible page.
  //   2. A `contractor_crm_settings` row must exist, because GET /api/pipeline
  //      returns 503 `crm_not_connected` BEFORE it reaches its stale-cache
  //      fallback. ⚠ IT CARRIES NO CREDENTIALS AND IS NOT AN OAUTH CONNECTION —
  //      the adapter then throws for want of a token, and that throw is exactly
  //      the path that serves pipeline_cache.
  for (const c of CONTRACTORS) {
    const who = summary.accounts.find((a) => a.contractor === c.id && a.role === 'referrer');
    if (!who) continue;
    const { rows: named } = await pool.query('SELECT full_name FROM users WHERE id = $1', [who.id]);
    const referrerName = named[0].full_name;

    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, crm_type, is_connected, connected_at)
       VALUES ($1, 'jobber', TRUE, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET is_connected = TRUE`,
      [c.id]
    );

    // One PAID row (drives the balance, the activity feed and the earnings
    // figures) and one still in flight (drives a non-empty pipeline list).
    const money = [
      ['stack-paid-' + c.id, 'Sam Reed', 'paid', 500, new Date(Date.now() - 5 * 864e5)],
      ['stack-lead-' + c.id, 'Ada Kim', 'lead', null, null],
    ];
    for (const [jid, client, status, bonus, paidAt] of money) {
      await pool.query(
        `INSERT INTO pipeline_cache
           (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
            bonus_amount, jobber_created_at, last_synced_at, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - INTERVAL '30 days', NOW(), $7)
         ON CONFLICT DO NOTHING`,
        [c.id, jid, client, referrerName, status, bonus, paidAt]
      );
    }
    summary.money = (summary.money || 0) + 1;
  }

  // ── ⚠ THE FOUR GATED POPUP SURFACES (Palette-11 A.3) ──────────────────────
  //
  // Each of these renders only when a row exists that the seeder never wrote,
  // which is why three of them had never been opened in a browser on this stack
  // and one — the badge grid — had only ever rendered its EMPTY branch.
  //
  // ⚠ EVERY ROW BELOW GOES TO **BETA'S** REFERRER, so one login reaches all four.
  // They are deliberately NOT spread across tenants: a popup that needs a second
  // login to see is a popup nobody checks. Beta is chosen over the first
  // contractor for the reason given at `popupUser` below — it is the one whose
  // palette differs from the platform default, so a fallback is visible as a
  // fallback.
  //
  // ⚠ AND THEY ARE ORDERED THE WAY THE APP GATES THEM. ReferrerApp renders
  // PendingMatch first, then Announcement only when there is no pending match
  // and no experience prompt, then Experience. Seeding all three at once means
  // only the FIRST is visible; the seeder therefore reports the precedence so a
  // reader knows to dismiss one to reach the next, rather than concluding the
  // seed failed.
  // ⚠ BETA, NOT THE FIRST CONTRACTOR, AND THE REASON IS THE WHOLE POINT OF THE
  // FIXTURE. `palette-alpha`'s brand IS the platform default palette — primary
  // #1C2D4D, secondary #F26A1B — so ALL SIX render tokens mount EQUAL to their
  // fallbacks on it. A correct wiring and a broken one are indistinguishable
  // there: it is the Accent problem, reproduced inside the local stack.
  // ⚠ THE POPUPS SEEDED ONTO ALPHA AND THAT NEARLY HID A LIVE DEFECT. The
  // B1 browser pass could only read mounted-vs-fallback after hand-seeding a
  // prompt for Beta, whose tokens differ in five of six.
  const popupUser = summary.accounts.find((a) => a.contractor === 'palette-beta' && a.role === 'referrer')
    || summary.accounts.find((a) => a.role === 'referrer');
  if (popupUser) {
    const uid = popupUser.id;
    const cid = popupUser.contractor;

    // 1 ── PendingMatchPopup: pending_referrals matched to this user, unseen.
    //      Route: GET /api/referral/pending/match-check
    //      Needs status='matched' AND matched_user_id=<uid> AND match_seen_at IS NULL.
    await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          matched_user_id, matched_at, match_seen_at, status)
       VALUES ($1, $2, 'Jordan Blake', $3, $4, NOW() - INTERVAL '2 days', NULL, 'matched')
       ON CONFLICT DO NOTHING`,
      [cid, 'stack-pending-' + cid, `${CONTRACTORS[0].name} Homeowner`, uid]
    );

    // 2 ── AnnouncementPopup: an unseen payout announcement. ⚠ TWO rows — the
    //      route JOINs cashout_requests for the amount and the OTHER person's
    //      name, which is what makes this "other people's money".
    // ⚠ contractor_id IS NOT-NULL AND IS ADDED BY A LATER MIGRATION THAN THE
    // CREATE TABLE, so reading the CREATE statement alone gets this wrong — it
    // did, and the seed aborted on the constraint rather than writing a tenantless
    // row. Read the migrations, not just the create.
    const cash = await pool.query(
      `INSERT INTO cashout_requests (user_id, contractor_id, full_name, email, amount, method, status)
       VALUES ($1, $2, 'Riley Chen', $3, 250, 'ach', 'paid')
       RETURNING id`,
      [uid, cid, `referrer@${cid}.test`]
    );
    await pool.query(
      `INSERT INTO payout_announcements (cashout_request_id, user_id, seen_at)
       VALUES ($1, $2, NULL)
       ON CONFLICT (cashout_request_id) DO NOTHING`,
      [cash.rows[0].id, uid]
    );

    // 3 ── ExperiencePopup: a pending experience prompt.
    //      Route: GET /api/referrer/experience-prompt, response_type='pending'.
    await pool.query(
      `INSERT INTO experience_prompts (user_id, contractor_id, response_type, triggered_at)
       VALUES ($1, $2, 'pending', NOW() - INTERVAL '1 day')
       ON CONFLICT DO NOTHING`,
      [uid, cid]
    );

    // 4 ── BadgeCelebrationPopup AND the badge grid's EARNED branch.
    //      ⚠ `badge_id` IS A PLAIN STRING FROM A HARDCODED MASTER LIST in
    //      server/routes/referrer.js — there is no catalogue table to seed, and
    //      an id that is not in that list simply never renders.
    //      ⚠ seen=false is what fires the celebration popup; the grid renders
    //      earned badges regardless. Palette-4b's #999 repair on the UNEARNED
    //      tiles has never been seen in a browser because every tile was
    //      unearned AND the grid renders an empty branch with no rows at all.
    //      Seeding three of seven leaves four unearned, so BOTH branches paint.
    for (const badgeId of ['first_referral', 'milestone_5', 'client_badge']) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id, badge_id) DO UPDATE SET seen = false`,
        [uid, badgeId]
      );
    }

    summary.popups = {
      referrerId: uid,
      contractor: cid,
      pendingMatch: 'Jordan Blake',
      announcement: { amount: 250, referredName: 'Riley Chen' },
      experiencePrompt: 'pending',
      badgesEarned: ['first_referral', 'milestone_5', 'client_badge'],
      badgesUnearned: 4,
      precedence: 'PendingMatch > Announcement > Experience — dismiss one to reach the next',
    };
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

  // ── CANVASS-3.7: AN ATTRIBUTABLE REP, AND AN ASSIGNMENT THE ENGINE MADE ────
  //
  // ⚠ THE GOVERNING NUMBER FOR THE WHOLE REQUEST-ATTRIBUTION ARC IS HOW MANY REPS
  // ARE ACTUALLY MAPPED, AND ON THIS STACK IT WAS ZERO. Every attribution lookup
  // requires `jobber_user_id = <id> AND is_attributable = true`; with no such row
  // EVERY request resolves to nobody, so a correct engine and a completely unwired
  // one produce identical output — nothing. That is this repo's recorded
  // "the fixture could not make the readings vary" shape, arriving as absence.
  //
  // ⚠ is_field_rep MUST BE TRUE ALONGSIDE is_attributable. `team_members_rep_coherence`
  // (db.js) is CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility)) —
  // added by a later ALTER and invisible in the table's CREATE. Seeding without it
  // aborts on the constraint, which is how the test fixture for this phase failed first.
  const attributableRep = await pool.query(
    `INSERT INTO team_members
       (contractor_id, full_name, email, tier, is_field_rep, active, jobber_user_id, is_attributable, password_hash)
     VALUES ($1, 'Mapped Rep', $2, 'general', TRUE, TRUE, $3, TRUE,
             '$2b$10$local.stack.placeholder.hash.not.a.password')
     ON CONFLICT (email) DO UPDATE
       SET jobber_user_id = EXCLUDED.jobber_user_id,
           is_attributable = TRUE, is_field_rep = TRUE, active = TRUE
     RETURNING id`,
    [alpha, `mapped-rep@${alpha}.test`, 'jobber-user-local-1']
  );
  const mappedRepId = attributableRep.rows[0].id;

  // Two Jobber clients: one the engine will attribute, one it will leave alone.
  for (const [jcId, name] of [['jc-local-attributed', 'Attributed Client'], ['jc-local-unresolved', 'Unresolved Client']]) {
    await pool.query(
      `INSERT INTO jobber_clients
         (jobber_client_id, contractor_id, first_name, last_name, email, phone, last_synced_at)
       VALUES ($1, $2, $3, NULL, NULL, NULL, NOW())
       ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET first_name = EXCLUDED.first_name`,
      [jcId, alpha, name]
    );
  }

  // ⚠ THE ASSIGNMENT IS PRODUCED BY THE ENGINE, NOT WRITTEN DIRECTLY, and that is the
  // whole point of seeding it this way. A hand-written client_rep_assignments row proves
  // a row can exist; driving the real engine proves the engine can produce one, which is
  // the only claim worth making from a fixture. The fetcher below is a local double
  // returning the Mode A shape — no Jobber call is made, and none may be: this script
  // must never reach a contractor's production CRM.
  //
  // ⚠ THE DOUBLE THROWS ON AN UNEXPECTED CLIENT RATHER THAN RETURNING AN EMPTY SHAPE.
  // A double that can also stand in for "no answer" is indistinguishable from the
  // failure it is meant to exclude — an empty `{ requests: [] }` would silently make
  // this seed a no-op that still reports success.
  const { runAttributionEngine } = require('../server/utils/attributionEngine');
  const REQUEST_CREATED_AT = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const localAttributionDouble = async (jobberClientId) => {
    if (jobberClientId === 'jc-local-attributed') {
      return {
        requests: [{
          id: 'req-local-1',
          createdAt: REQUEST_CREATED_AT,
          salesperson: null,           // Accent's real shape — the rep is on the assessment
          assessment: { id: 'assess-local-1', assignedUsers: { nodes: [{ id: 'jobber-user-local-1' }] } },
        }],
        assessments: [],
      };
    }
    if (jobberClientId === 'jc-local-unresolved') {
      return {
        requests: [{
          id: 'req-local-2',
          createdAt: REQUEST_CREATED_AT,
          salesperson: null,
          assessment: { id: 'assess-local-2', assignedUsers: { nodes: [{ id: 'jobber-user-NOT-mapped' }] } },
        }],
        assessments: [],
      };
    }
    throw new Error(`seedLocalStack attribution double: unexpected client ${jobberClientId}`);
  };

  // A client with a job and no paid invoice classifies as 'sold' — not in the engine's
  // GATE_EXCLUSIONS, so the sticky gate fires. That is the only path on which the
  // request pipeline's R3 silence is observable at all.
  const soldShell = (id) => ({
    id, quotes: { nodes: [] },
    jobs: { nodes: [{ id: `job-${id}`, jobStatus: 'active', invoices: { nodes: [] } }] },
  });

  for (const jcId of ['jc-local-attributed', 'jc-local-unresolved']) {
    await runAttributionEngine(pool, {
      contractorId: alpha,
      jobberClientId: jcId,
      currentStatus: 'sold',
      client: soldShell(jcId),
      fetchAttributionData: localAttributionDouble,
      token: 'local-stack-not-a-real-token',
      referralAnchor: REQUEST_CREATED_AT,   // R2 — the request's own createdAt
      writeOrphanOnMiss: false,             // R3 — the request path records nothing on a miss
      logError: async () => {},             // no error_log noise from a seeder
    });
  }

  const { rows: seededAssignments } = await pool.query(
    `SELECT jobber_client_id, sticky_rep_id, sticky_source FROM client_rep_assignments
     WHERE contractor_id = $1 ORDER BY jobber_client_id`,
    [alpha]
  );
  summary.repAttribution = {
    contractor: alpha,
    mappedRepId,
    mappedJobberUserId: 'jobber-user-local-1',
    assignments: seededAssignments,
  };

  // ── CANVASS-4: A BOOK OF BUSINESS WORTH LOOKING AT, ON palette-beta ────────
  //
  // ⚠ ON BETA, NOT ALPHA, AND THAT IS THE POINT RATHER THAN A COIN TOSS. Alpha is
  // seeded with the PLATFORM DEFAULT PALETTE, so all six render tokens mount EQUAL to
  // their fallbacks there and a correct wiring is indistinguishable from a broken one
  // — this repo's recorded "the contractor could not make the readings vary" failure,
  // reproduced inside our own fixture. Beta is the visibly-different brand, so it is
  // the one any rendered measurement must be taken on.
  //
  // ⚠ EVERY STATE THIS SCREEN CAN RENDER IS SEEDED, BECAUSE A STATE THE FIXTURE NEVER
  // RENDERS CANNOT BE EYE-TESTED. That is: all three assignment states (sticky,
  // provisional, flagged), a client WITH a pipeline_cache row and one WITHOUT (A34.4's
  // whole book), every stage in the vocabulary, several assignment sources, and ALL
  // FOUR membership states — of which only the first renders a badge.
  const beta = CONTRACTORS[1].id;

  const betaRep = await pool.query(
    `INSERT INTO team_members
       (contractor_id, full_name, email, tier, is_field_rep, active, jobber_user_id, is_attributable, password_hash)
     VALUES ($1, 'Beta Book Rep', $2, 'general', TRUE, TRUE, $3, TRUE,
             '$2b$10$local.stack.placeholder.hash.not.a.password')
     ON CONFLICT (email) DO UPDATE
       SET jobber_user_id = EXCLUDED.jobber_user_id, is_attributable = TRUE,
           is_field_rep = TRUE, active = TRUE
     RETURNING id`,
    [beta, `book-rep@${beta}.test`, 'jobber-user-beta-1']
  );
  const betaRepId = betaRep.rows[0].id;

  // A second rep, so the co-assignment flag has someone to be co-assigned WITH and the
  // own-book predicate has a colleague to exclude.
  const betaOther = await pool.query(
    `INSERT INTO team_members
       (contractor_id, full_name, email, tier, is_field_rep, active, jobber_user_id, is_attributable, password_hash)
     VALUES ($1, 'Beta Other Rep', $2, 'general', TRUE, TRUE, $3, TRUE,
             '$2b$10$local.stack.placeholder.hash.not.a.password')
     ON CONFLICT (email) DO UPDATE SET is_field_rep = TRUE, active = TRUE
     RETURNING id`,
    [beta, `other-rep@${beta}.test`, 'jobber-user-beta-2']
  );
  const betaOtherId = betaOther.rows[0].id;

  // [jobberClientId, name, stage|null, sticky|null, provisional|null, source, membershipState, referred]
  // membershipState: 1 = linked users row · 4 = contact-level app user · 3 = contact,
  // not an app user · 2 = nothing known. ⚠ ONLY STATE 1 RENDERS A BADGE — 2, 3 and 4
  // are indistinguishable and the ruling forbids asserting anything about them. They
  // are all seeded anyway, precisely so the screen can be EYE-CHECKED for the absence
  // of a reserved slot: three rows that differ in the database and must look identical.
  //
  // ⚠ `referred` IS AN EIGHTH COLUMN SINCE CANVASS-STAGE, AND IT USED TO BE IMPLIED BY
  // `stage`. Before this phase the only stage column lived on pipeline_cache, so a
  // client with a stage necessarily had a referral record and one seeder flag stood for
  // both facts. They are now independent — the stage lives on jobber_clients and every
  // client can have one, while the referral record still decides which Today's Focus
  // section a client falls in. **A state the fixture never renders cannot be
  // eye-tested**, and "staged but not referred" is now the single most common state in
  // a real rep's book, so it is seeded explicitly below rather than left to inference.
  const BOOK = [
    ['jc-beta-1', 'Maria Lopez',   'paid',       betaRepId, null, 'quote_salesperson',  1, true],
    ['jc-beta-2', 'Allen Wade',    'sold',       betaRepId, null, 'mode_a_at_close',    4, true],
    ['jc-beta-3', 'Pat Chen',      'inspection', betaRepId, null, 'manual',             3, true],
    ['jc-beta-4', 'June Harris',   null,         betaRepId, null, 'mode_b_at_close',    2, false],
    ['jc-beta-5', 'Sam Okafor',    null,         null, betaRepId, 'mode_a',             2, false],
    ['jc-beta-6', 'Dana Whitfield','lead',       betaRepId, null, 'promoted_provisional', 1, true],
    ['jc-beta-7', 'Ellis Brand',   'not_sold',   betaRepId, null, 'manual',             3, true],
    // ⚠ THE PHASE'S OWN STATE, AND THE REASON THE COLUMN EXISTS: a NON-REFERRED client
    // carrying a real stage. jc-beta-10 is the exact shape Danny described — a client
    // his team assigned him in Jobber who then sold and had an invoice paid, with no
    // "Referred by" value anywhere. Before this phase it could carry no stage at all,
    // so a rep could not see that it had converted. It must render in RECENTLY ASSIGNED
    // (the partition is the referral record) and must SHOW "Complete" there.
    ['jc-beta-10', 'Wes Trammell', 'paid',       betaRepId, null, 'mode_a_at_close',    2, false],
    // Its mid-pipeline sibling, so the section shows more than one stage value and a
    // stage-ordering regression in section 2 would be visible rather than inferred.
    ['jc-beta-11', 'Nia Alvarez',  'sold',       betaRepId, null, 'quote_salesperson',  3, false],
    // ⚠ NO CLIENT MIRROR ROW — name null means the jobber_clients INSERT is skipped.
    // The Canvass-4b state: a real assignment for a client we cannot yet name.
    ['jc-beta-9', null,            null,         betaRepId, null, 'mode_a_at_close',    2, false],
    // The colleague's client — must NOT appear in the book rep's list.
    ['jc-beta-8', 'Not Mine',      'sold',       betaOtherId, null, 'mode_a_at_close',  2, true],
  ];

  for (const [jcId, name, stage, sticky, provisional, source, membershipState, referred] of BOOK) {
    // ⚠ `name === null` MEANS "SEED NO jobber_clients ROW AT ALL" (Canvass-4b), and it
    // is the one fixture state this screen had no way to render before. An assignment
    // whose client has no mirror row was silently dropped by an inner join — 39
    // assignments showing ~30 rows in production. The state is reachable by
    // construction: the request-driven path writes client_rep_assignments and never
    // jobber_clients, so every client the hourly sweep attributes looks like this until
    // the 2am sync catches it. **A state the fixture never renders cannot be eye-tested**,
    // which is exactly why the defect shipped.
    if (name !== null) {
      const [first, ...rest] = name.split(' ');
      await pool.query(
        `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name, pipeline_stage, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE
           SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
               pipeline_stage = EXCLUDED.pipeline_stage`,
        [jcId, beta, first, rest.join(' ') || null, stage]
      );
    }

    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
          provisional_rep_id, provisional_source, provisional_set_at, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() END,
               $5, $6, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() END, NOW())
       ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE
         SET sticky_rep_id = EXCLUDED.sticky_rep_id,
             sticky_source = EXCLUDED.sticky_source,
             provisional_rep_id = EXCLUDED.provisional_rep_id,
             provisional_source = EXCLUDED.provisional_source,
             updated_at = NOW()`,
      [beta, jcId, sticky, sticky ? source : null, provisional, provisional ? source : null]
    );

    // ⚠ ONLY THE REFERRED CLIENTS GET A pipeline_cache ROW, AND THE FLAG IS NOW THE
    // `referred` COLUMN RATHER THAN `stage`. It used to read `if (stage)`, which was
    // correct only while a stage could not exist without a referral record. Keying it
    // on the stage now would give every staged client a referral row and erase the
    // whole-book case this fixture exists to show — the "a condition whose meaning
    // changed without its text changing" failure, in a seeder.
    if (referred) {
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
         VALUES ($1, $2, $3, 'Seeded Referrer', $4)
         ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET pipeline_status = EXCLUDED.pipeline_status`,
        [beta, jcId, name, stage]
      );
    }

    if (membershipState === 1) {
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, jobber_client_id)
         VALUES ($1, $2, '$2b$10$local.stack.placeholder.hash.not.a.password', TRUE, $3, $4)
         ON CONFLICT (contractor_id, email) DO UPDATE SET jobber_client_id = EXCLUDED.jobber_client_id`,
        [name || jcId, `${jcId}@${beta}.test`, beta, jcId]
      );
    } else if (membershipState === 4 || membershipState === 3) {
      await pool.query(
        `INSERT INTO contacts (contractor_id, email, name, is_app_user, jobber_client_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [beta, `${jcId}-contact@${beta}.test`, name || jcId, membershipState === 4, jcId]
      );
    }
    // state 2 gets nothing at all — which is the point.
  }

  // ⚠ A PEER SIGNUP WITH NO JOBBER MATCH — state (2) of A24.5's space, and the reason
  // the absence of a badge must stay a non-claim. This person HAS an account and cannot
  // be tied to any client, so at least one of the four unbadged rows above may well be
  // them. Seeding it is what makes that argument checkable rather than asserted.
  await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
     VALUES ('Peer Signup', $1, '$2b$10$local.stack.placeholder.hash.not.a.password', TRUE, $2)
     ON CONFLICT (contractor_id, email) DO NOTHING`,
    [`peer-signup@${beta}.test`, beta]
  );

  // One OPEN co-assignment flag naming the book rep — the Flagged pill. A34.7: a rep
  // sees co-assignment flags naming them, never orphan flags.
  const { rows: existingFlag } = await pool.query(
    `SELECT id FROM flagged_assignments
      WHERE contractor_id = $1 AND jobber_client_id = 'jc-beta-3'
        AND flag_reason = 'rep_co_assignment' AND status = 'open'`,
    [beta]
  );
  if (existingFlag.length === 0) {
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1, 'jc-beta-3', 'rep_co_assignment', $2::jsonb, 'open')`,
      [beta, JSON.stringify([betaRepId, betaOtherId])]
    );
  }

  // ⚠ AN ORPHAN FLAG, SEEDED ON PURPOSE AND EXPECTED NEVER TO RENDER. It is admin-only
  // by A34.7, and a fixture that omits it cannot tell "orphans are correctly excluded"
  // from "orphans are unreachable" — the fixture obligation A34.7 states in terms.
  const { rows: existingOrphan } = await pool.query(
    `SELECT id FROM flagged_assignments
      WHERE contractor_id = $1 AND jobber_client_id = 'jc-beta-4'
        AND flag_reason = 'orphan' AND status = 'open'`,
    [beta]
  );
  if (existingOrphan.length === 0) {
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status)
       VALUES ($1, 'jc-beta-4', 'orphan', 'open')`,
      [beta]
    );
  }

  // ── CANVASS-5: A BOOK BIG ENOUGH TO PAGE, AND A REVENUE-PERMITTED REP ──────
  //
  // ⚠ 260 FILLER ASSIGNMENTS, SO THE SECOND PAGE IS REACHABLE BY EYE. The route
  // pages at 100, so a 268-row book has three pages and the "Load more" control has
  // somewhere to go. **A state the fixture never renders cannot be eye-tested** —
  // which is exactly how the inner join shipped in Canvass-4.
  // ⚠ AND THEY ARE WRITTEN WITH DISTINCT updated_at VALUES IN DESCENDING ORDER, not
  // all NOW(). A fixture where every row shares a timestamp cannot exercise the
  // keyset's tiebreaker at all, and would make a broken cursor look correct.
  for (let i = 0; i < 260; i += 1) {
    const jcId = `jc-beta-fill-${String(i).padStart(3, '0')}`;
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name, last_synced_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET first_name = EXCLUDED.first_name`,
      [jcId, beta, 'Filler', `Client ${i}`]
    );
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW() - ($5 || ' minutes')::interval)
       ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE
         SET sticky_rep_id = EXCLUDED.sticky_rep_id, updated_at = EXCLUDED.updated_at`,
      // A spread of sources so the detail screen's vocabulary is exercised, and a
      // descending clock so the ordering is meaningful.
      [beta, jcId, betaRepId,
       ['mode_a_at_close', 'mode_b_at_close', 'manual', 'quote_salesperson', 'promoted_provisional'][i % 5],
       String(i + 10)]
    );
  }

  // ⚠ TWO REPS, ONE WITH REVENUE VISIBILITY AND ONE WITHOUT — A34.6 HAS TWO STATES
  // AND A FIXTURE WITH ONE OF THEM CANNOT TELL THEM APART. The book rep sees the
  // locked treatment; this one sees "No revenue recorded yet."
  const betaRevRep = await pool.query(
    `INSERT INTO team_members
       (contractor_id, full_name, email, tier, is_field_rep, active, jobber_user_id,
        is_attributable, rep_revenue_visibility, password_hash)
     VALUES ($1, 'Beta Revenue Rep', $2, 'general', TRUE, TRUE, $3, TRUE, TRUE,
             '$2b$10$local.stack.placeholder.hash.not.a.password')
     ON CONFLICT (email) DO UPDATE
       SET rep_revenue_visibility = TRUE, is_field_rep = TRUE, active = TRUE
     RETURNING id`,
    [beta, `revenue-rep@${beta}.test`, 'jobber-user-beta-3']
  );
  const betaRevRepId = betaRevRep.rows[0].id;

  // One client in the revenue rep's book, so the permitted branch has something to open.
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name, last_synced_at)
     VALUES ('jc-beta-rev', $1, 'Revenue', 'Visible', NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`, [beta]);
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
     VALUES ($1, 'jc-beta-rev', $2, 'manual', NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET sticky_rep_id = EXCLUDED.sticky_rep_id`,
    [beta, betaRevRepId]);

  // ── CANVASS-6: A HOME TAB WHERE ④'s ORDER AND ②'s DISAGREE ────────────────
  //
  // ⚠ THE WHOLE POINT OF THESE FOUR ROWS IS THAT THEY DISCRIMINATE. Ruling ④ orders
  // section 1 BY STAGE; the rejected option ② would order everything by assignment
  // RECENCY. A fixture where both orders agree proves nothing — the Canvass-3.7 anchor
  // lesson, applied to a ranking instead of a window.
  //   home-paid-old   paid       assigned LONGEST ago  -> ④ ranks it FIRST,  ② LAST
  //   home-lead-new   lead       assigned MOST recently -> ④ ranks it LAST,   ② FIRST
  // So section 1 reading [paid, lead] can only be ④, and [lead, paid] can only be ②.
  // The two unstaged rows below then prove section 2 is the complement rather than a
  // second page of the same list.
  const HOME_FIXTURE = [
    ['home-paid-old',  'Ada Sterling',   'paid',       6000],
    ['home-lead-new',  'Boris Vance',    'lead',          2],
    ['home-unstaged1', 'Cleo Marchetti', null,            1],
    ['home-unstaged2', 'Dev Okonkwo',    null,         4000],
  ];
  for (const [jcId, name, stage, minutesAgo] of HOME_FIXTURE) {
    const [first, ...rest] = name.split(' ');
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name, last_synced_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET first_name = EXCLUDED.first_name`,
      [jcId, beta, first, rest.join(' ')]
    );
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
       VALUES ($1, $2, $3, 'mode_a_at_close',
               NOW() - ($4 || ' minutes')::interval, NOW() - ($4 || ' minutes')::interval)
       ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE
         SET sticky_rep_id = EXCLUDED.sticky_rep_id, sticky_set_at = EXCLUDED.sticky_set_at,
             updated_at = EXCLUDED.updated_at`,
      [beta, jcId, betaRepId, String(minutesAgo)]
    );
    if (stage) {
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
         VALUES ($1, $2, $3, 'Seeded Referrer', $4)
         ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET pipeline_status = EXCLUDED.pipeline_status`,
        [beta, jcId, name, stage]
      );
    }
  }

  // ⚠ THE FIRST-RUN REP IS KEPT DELIBERATELY EMPTY — rep@palette-beta.test has no
  // assignments at all, so Home's zeroed stats and BOTH empty states are reachable by
  // eye. **A state the fixture never renders cannot be eye-tested**, and a first-run
  // rep is the common case at launch rather than an edge one.

  // ⚠ BADGE 2 ('Invited') IS NOT SEEDED, AND IT CANNOT BE. Nothing in the schema records
  // "this rep sent this client a link": contractor_invite_links carries
  // owner_team_member_id but NO client column and has no 'rep' writer at all, and
  // pending_referrals carries the client but no rep and describes the REFERRAL
  // pipeline's send. Faking a row here would seed a state production cannot reach and
  // make the screen look finished when it is not. The badge is proved by the React
  // test instead, which drives the component directly. → PRE_LAUNCH_CHECKLIST.md,
  // the Canvass-4 badge-2 entry, which names exactly what 3d must write.

  // ── CANVASS-8: A TITLE ON THE BOOK REP ──────────────────────────────────────
  // initDB seeds 6 titles per contractor and leaves EVERY team_members.title_id
  // NULL, so the no-title state — the one a real rep meets on first open — is
  // already renderable. What is NOT renderable without this is the OTHER state.
  // ⚠ A STATE THE FIXTURE NEVER RENDERS CANNOT BE EYE-TESTED, so the book rep gets
  // a title and the colleague keeps NULL. Both states now exist on one stack.
  const { rows: betaTitles } = await pool.query(
    `SELECT id, name FROM titles WHERE contractor_id = $1 ORDER BY name ASC LIMIT 1`,
    [beta]
  );
  if (betaTitles.length > 0) {
    await pool.query(`UPDATE team_members SET title_id = $1 WHERE id = $2`, [betaTitles[0].id, betaRepId]);
  }

  // ── CANVASS-8: CONVERSIONS, ON BOTH SIDES OF THE SCOPING BOUNDARY ───────────
  // ⚠ SEEDED NON-ZERO ON PURPOSE. Danny's Railway baseline is 0 for every rep, and
  // a card that has only ever rendered 0 is untested — a scoping bug is invisible
  // at zero. The card must be eye-testable with real ink in it.
  //
  // THE PATH the card reads: referral_conversions.user_id → users.jobber_client_id
  // → client_rep_assignments. The conversion names the REFERRER; the referrer's own
  // client row is what carries the rep. So a referrer must be bridged to a client
  // that is already in a rep's book.
  //
  // ⚠ THREE REFERRERS, AND THE SECOND AND THIRD ARE THE DISCRIMINATING ONES:
  //   · bridged to jc-beta-1, which is the BOOK REP's client  → 2 conversions, COUNT
  //   · bridged to jc-beta-8, which is the COLLEAGUE's client → 1 conversion, MUST NOT
  //     count for the book rep. Without this row the screen reads the same whether
  //     the rep predicate is there or not.
  //   · NOT bridged at all (jobber_client_id NULL)            → 1 conversion, counts
  //     for NOBODY. This is the ordinary production shape, and it is what stops the
  //     seeded total from being mistaken for "every conversion finds a rep".
  // Expected on this stack: book rep sees 2, colleague sees 1.
  const convFixtures = [
    ['conv-referrer-mine@local.test',      'Nadia Prescott', 'jc-beta-1', 2],
    ['conv-referrer-colleague@local.test', 'Owen Bramley',   'jc-beta-8', 1],
    ['conv-referrer-unbridged@local.test', 'Rosa Lindqvist', null,        1],
  ];
  for (const [email, name, jobberClientId, count] of convFixtures) {
    const { rows: u } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, jobber_client_id, email_verified)
       VALUES ($1, $2, 'local-stack-placeholder', $3, $4, TRUE)
       -- ⚠ (contractor_id, email), NOT (email). The global UNIQUE(email) that the
       -- users CREATE still shows was DROPPED by a later ALTER and replaced with
       -- users_contractor_id_email_unique. ON CONFLICT (email) finds no arbiter index
       -- and raises 42P10 — which is a TABLE'S SHAPE IS ITS CREATE PLUS EVERY ALTER
       -- SINCE, caught here by the seeder test cancelling eight cases.
       ON CONFLICT (contractor_id, email) DO UPDATE SET jobber_client_id = EXCLUDED.jobber_client_id
       RETURNING id`,
      [name, email, beta, jobberClientId]
    );
    for (let i = 0; i < count; i += 1) {
      await pool.query(
        `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
         VALUES ($1, $2, $3, NOW() - ($4 || ' days')::interval, 100)
         ON CONFLICT (user_id, jobber_client_id) DO NOTHING`,
        [u[0].id, beta, `converted-${email.split('@')[0]}-${i}`, String(i * 3 + 2)]
      );
    }
  }

  const { rows: betaBook } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM client_rep_assignments
      WHERE contractor_id = $1 AND COALESCE(sticky_rep_id, provisional_rep_id) = $2`,
    [beta, betaRepId]
  );
  summary.repBook = {
    contractor: beta,
    repId: betaRepId,
    revenueRepId: betaRevRepId,
    revenueRepEmail: `revenue-rep@${beta}.test`,
    repEmail: `book-rep@${beta}.test`,
    colleagueId: betaOtherId,
    clientsInBook: betaBook[0].n,
    // Canvass-8 — both states of the title row, and both sides of the conversions
    // scoping, are on this stack. Expected: book rep 2 conversions, colleague 1.
    repTitle: betaTitles.length > 0 ? betaTitles[0].name : null,
    colleagueTitle: null,
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
// · ⚠ MONEY RENDERS, BUT FROM THE STALE-CACHE PATH ONLY. The pipeline rows are
//   served because the Jobber adapter THROWS and the route falls back to
//   pipeline_cache — so every pipeline response carries `stale: true` and the
//   staleness banner is always up. The live sync path is still unreachable.
// · ⚠ CORRECTED IN CANVASS-8 — THERE ARE NOW referral_conversions ROWS, four of
//   them, seeded for the rep Home conversions card. The line that stood here said
//   "NO referral_conversions ROWS"; it was true until this phase and is left quoted
//   rather than deleted so the change is visible. What it went on to claim is STILL
//   TRUE and is the part that matters: the REFERRER-side `conversion_bonus` is
//   the figures come from the boost-schedule fallback (500 + boost). The
//   CONVERSION-sourced amount, the schedule NAME on an expanded card, and the
//   inline expand it gates are all still unreachable.
// · ⚠ BADGES NOW SEED (Palette-11). Three of the seven master badges are earned
//   and UNSEEN, which fires BadgeCelebrationPopup and leaves four unearned so the
//   grid paints BOTH branches. **This closes a gap that had been open since
//   Palette-4b: the #999 pair that phase repaired had never been seen in a
//   browser** — it was verified by arithmetic and by forcing the branch in jsdom,
//   because every tile was unearned and the grid rendered its empty branch.
// · ⚠ THE POPUP SURFACES NOW SEED (Palette-11 A.3): a matched pending referral,
//   an unseen payout announcement with its cashout row, a pending experience
//   prompt, and three earned-unseen badges. All four land on the FIRST
//   contractor's referrer so one login reaches them.
//   ⚠ THEY GATE EACH OTHER, AND THAT IS THE APP'S OWN PRECEDENCE, NOT A SEEDING
//   BUG: ReferrerApp shows PendingMatch first, Announcement only when there is
//   no pending match and no experience prompt, then Experience. Dismiss one to
//   reach the next.
// · NOT PRODUCTION-SHAPED DATA. ⚠ "Still NO referral_conversions rows" was true
//   when written and is NOT true after Canvass-8 — there are four, and they exist to
//   make the rep conversions card eye-testable at a non-zero value. The referrer-side
//   consequence this sentence described is unchanged, so
//   `conversion_bonus` remains null and the CONVERSION-sourced amount, the
//   schedule NAME on an expanded card and the inline expand it gates are all
//   still unreachable.
