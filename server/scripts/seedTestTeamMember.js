'use strict';
// ⚠ THIS WAS A BARE `dotenv.config()` AND IT IS THE RISKIEST OF THE FIVE, because its own name
// says it runs in a test context. A bare call resolves `.env` from the CURRENT WORKING DIRECTORY,
// so running it from the repo root under a test signal loaded real credentials. Routed through
// the shared loader, which picks `.env.test` for a test process and the real file otherwise.
const { loadEnv } = require('../utils/loadEnv');
loadEnv();
const { assertLocalDatabase } = require('../utils/requireLocalDatabase');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// ── EDIT THESE BEFORE RUNNING ─────────────────────────────────────────────────
const TIER = 'admin'; // 'admin' or 'general'
const PERMISSIONS = {
  campaigns: true,
  'campaigns.manage': true,
  contacts: true,
  'contacts.manage': true,
  audiences: true,
  'audiences.manage': true,
  dashboard: true,
};
// ─────────────────────────────────────────────────────────────────────────────

// Email + password from env vars (set in .env or inline before the command).
// Example: TEST_MEMBER_EMAIL=test@example.com TEST_MEMBER_PASSWORD=... node server/scripts/seedTestTeamMember.js
const CONTRACTOR_ID = 'accent-roofing-dev';

async function run() {
  // ⚠ THE FIRST STATEMENT, BEFORE ANY INPUT VALIDATION AND BEFORE THE POOL — AND ITS FIRST WRITING
  // HAD IT LAST, WHICH A TEST CAUGHT. Placed after the `TEST_MEMBER_*` checks it was reachable only
  // by an operator who had already supplied an email and a password — which is precisely the
  // operator capable of seeding a test fixture into production. **The most consequential refusal
  // must not sit behind the least consequential one.** This script takes no argument naming an
  // environment, so run by hand it loads the real `.env`, which points at PRODUCTION. The reason is
  // in `server/utils/requireLocalDatabase.js`; it throws, and the throw is deliberately not caught.
  assertLocalDatabase(process.env.DATABASE_URL, 'server/scripts/seedTestTeamMember.js');

  const email    = process.env.TEST_MEMBER_EMAIL;
  const password = process.env.TEST_MEMBER_PASSWORD;

  if (!email || !password) {
    console.error('Error: TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD must be set.');
    process.exit(1);
  }

  if (!['admin', 'general'].includes(TIER)) {
    console.error(`Error: TIER must be 'admin' or 'general', got '${TIER}'.`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             tier          = EXCLUDED.tier,
             permissions   = EXCLUDED.permissions
       RETURNING id, email, tier, permissions`,
      [CONTRACTOR_ID, email, passwordHash, TIER, PERMISSIONS]
    );

    const row = rows[0];
    console.log('\n[seedTestTeamMember] Done.');
    console.log(`  contractor_id : ${CONTRACTOR_ID}`);
    console.log(`  id            : ${row.id}`);
    console.log(`  email         : ${row.email}`);
    console.log(`  tier          : ${row.tier}`);
    console.log(`  permissions   :`);
    console.log(JSON.stringify(row.permissions, null, 4).replace(/^/gm, '    '));
  } catch (err) {
    console.error('[seedTestTeamMember] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
