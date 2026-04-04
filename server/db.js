const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── DATABASE INIT ─────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY, access_token TEXT, refresh_token TEXT,
    expires_at TIMESTAMP, updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, pin TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cashout_requests (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
    full_name TEXT, email TEXT, amount NUMERIC, method TEXT,
    status TEXT DEFAULT 'pending', requested_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY, event_type TEXT NOT NULL,
    full_name TEXT, email TEXT, detail TEXT, created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_cache (
    id INTEGER PRIMARY KEY DEFAULT 1, stats JSONB, cached_at TIMESTAMP DEFAULT NOW()
  )`);
await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
  )`);
  await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS method TEXT`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS review_dismissed_login INTEGER`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payout_announcements (
    id SERIAL PRIMARY KEY,
    cashout_request_id INTEGER REFERENCES cashout_requests(id),
    user_id INTEGER REFERENCES users(id),
    seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payout_announcements_user_unseen
    ON payout_announcements(user_id, seen_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcement_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    mode TEXT DEFAULT 'preset_1',
    custom_message TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`INSERT INTO announcement_settings (id, enabled, mode)
    VALUES (1, true, 'preset_1')
    ON CONFLICT (id) DO NOTHING`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pin_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
  )`);
  await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS contractor_id TEXT DEFAULT 'accent-roofing'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_about (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL DEFAULT 'accent-roofing',
    enabled BOOLEAN DEFAULT false,
    booking_enabled BOOLEAN DEFAULT false,
    bio TEXT,
    years_in_business TEXT,
    service_area TEXT,
    google_place_id TEXT,
    certifications JSONB DEFAULT '[]',
    booking_email TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_about_contractor_id ON contractor_about(contractor_id)`);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contractor_about'
        AND column_name = 'certifications'
        AND data_type = 'ARRAY'
      ) THEN
        ALTER TABLE contractor_about
          ALTER COLUMN certifications DROP DEFAULT;
        ALTER TABLE contractor_about
          ALTER COLUMN certifications TYPE JSONB
          USING CASE
            WHEN certifications IS NULL THEN '[]'::jsonb
            ELSE to_jsonb(certifications)
          END;
        ALTER TABLE contractor_about
          ALTER COLUMN certifications SET DEFAULT '[]'::jsonb;
      END IF;
    END
    $$;
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS about_modal_seen BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_submitted BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE admin_cache ADD COLUMN IF NOT EXISTS cache_key TEXT`);
  await pool.query(`ALTER TABLE admin_cache ADD COLUMN IF NOT EXISTS data JSONB`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_count_updated_at TIMESTAMPTZ`);

  await pool.query(`CREATE TABLE IF NOT EXISTS engagement_settings (
    contractor_id TEXT PRIMARY KEY,
    leaderboard_enabled BOOLEAN DEFAULT true,
    quarterly_prizes JSONB DEFAULT '[]',
    yearly_prizes JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
  )`);

  const result = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
  if (result.rows.length > 0) {
    console.log('Token loaded from database');
    return result.rows[0].access_token;
  } else {
    console.log('No token found - visit /auth/jobber to authorize');
    return null;
  }
}

module.exports = { pool, initDB };
