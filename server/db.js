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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    experience_flow_enabled BOOLEAN DEFAULT false
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
  )`);
  await pool.query(`ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT false`);

  // SCALABLE: referral_conversions is the source of truth for all leaderboard period queries.
  // paid_count on users remains as an all-time cache only. Do not use paid_count for period filtering.
  await pool.query(`CREATE TABLE IF NOT EXISTS referral_conversions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    jobber_client_id TEXT NOT NULL,
    converted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, jobber_client_id)
  )`);

  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS year_start_month INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS quarter_1_start INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS quarter_2_start INTEGER DEFAULT 4`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS quarter_3_start INTEGER DEFAULT 7`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS quarter_4_start INTEGER DEFAULT 10`);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS shout_opt_out BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_shout TEXT DEFAULT null`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS warmup_mode_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS shouts_enabled BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS experience_flow_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 0`);

  // ── SELF-SERVE SIGNUP MIGRATIONS ─────────────────────────────────────────────
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_slug TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jobber_client_id TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'admin'`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_invite_links (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL DEFAULT 'accent-roofing',
    slug TEXT NOT NULL UNIQUE,
    link_type TEXT NOT NULL DEFAULT 'contractor',
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_settings (
    id                  SERIAL PRIMARY KEY,
    contractor_id       VARCHAR(100) NOT NULL UNIQUE,
    company_name        VARCHAR(255),
    company_phone       VARCHAR(50),
    company_email       VARCHAR(255),
    company_url         VARCHAR(500),
    company_address     TEXT,
    company_city        VARCHAR(100),
    company_state       VARCHAR(100),
    company_zip         VARCHAR(20),
    company_country     VARCHAR(100) DEFAULT 'US',
    logo_url            TEXT,
    app_logo_url        TEXT,
    primary_color       VARCHAR(20),
    secondary_color     VARCHAR(20),
    accent_color        VARCHAR(20),
    social_facebook     VARCHAR(500),
    social_instagram    VARCHAR(500),
    social_google       VARCHAR(500),
    social_nextdoor     VARCHAR(500),
    social_website      VARCHAR(500),
    review_url          TEXT,
    review_button_text  VARCHAR(255),
    review_message      TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS font_heading VARCHAR(100)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS font_body VARCHAR(100)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS app_display_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS tagline TEXT`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS email_sender_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS email_footer_text TEXT`);

  // ── CRM SETTINGS ──────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_crm_settings (
    contractor_id        TEXT PRIMARY KEY,
    crm_type             TEXT,
    crm_account_name     TEXT,
    connection_method    TEXT,
    api_key              TEXT,
    referrer_field_name  TEXT DEFAULT 'Referred by',
    stage_map            JSONB DEFAULT '{"lead":"Quote Sent","inspection":"Assessment Scheduled","sold":"Job Approved","paid":"Invoice Paid"}',
    connected_at         TIMESTAMP,
    last_synced_at       TIMESTAMP,
    sync_interval_mins   INTEGER DEFAULT 30,
    is_connected         BOOLEAN DEFAULT false,
    referral_start_date  TIMESTAMP
  )`);

  await pool.query(`ALTER TABLE contractor_crm_settings ADD COLUMN IF NOT EXISTS referral_start_date TIMESTAMP`);

  // ── MANAGE ACCOUNT MIGRATIONS ─────────────────────────────────────────────────
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_2fa_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_phone VARCHAR(20)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP`);

  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_info TEXT`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(30) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // Add UNIQUE constraint to tokens.contractor_id if not already present
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tokens_contractor_id_unique'
      ) THEN
        ALTER TABLE tokens ADD CONSTRAINT tokens_contractor_id_unique UNIQUE (contractor_id);
      END IF;
    END $$;
  `);

  // ── PIPELINE CACHE MIGRATIONS ─────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS pipeline_cache (
    id SERIAL PRIMARY KEY,
    contractor_id VARCHAR(100) NOT NULL,
    jobber_client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    referred_by VARCHAR(255),
    pipeline_status VARCHAR(50) DEFAULT 'lead',
    bonus_amount NUMERIC(10,2), -- MVP: not populated in this phase; reserved for future caching of computed bonus at sync time
    jobber_created_at TIMESTAMP,
    pre_start_date BOOLEAN DEFAULT false,
    last_synced_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(contractor_id, jobber_client_id)
  )`);

  // Migration: raw_data column added in Session 41 for app_signup placeholder rows
  await pool.query(`ALTER TABLE pipeline_cache ADD COLUMN IF NOT EXISTS raw_data JSONB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS flagged_referrals (
    id SERIAL PRIMARY KEY,
    contractor_id VARCHAR(100) NOT NULL,
    jobber_client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    referred_by VARCHAR(255),
    pipeline_status VARCHAR(50),
    flag_reason VARCHAR(100),
    reviewed BOOLEAN DEFAULT false,
    review_label VARCHAR(100),
    review_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    UNIQUE(contractor_id, jobber_client_id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sync_state (
    contractor_id VARCHAR(100) PRIMARY KEY,
    last_synced_at TIMESTAMP,
    initial_sync_complete BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);

  // ── PENDING REFERRALS ─────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS pending_referrals (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    jobber_client_id TEXT NOT NULL,
    client_name TEXT,
    referred_by_name TEXT,
    referred_by_phone TEXT,
    referred_by_email TEXT,
    invite_sent_at TIMESTAMPTZ,
    invite_channel TEXT,
    invite_resent_at TIMESTAMPTZ,
    matched_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,
    match_seen_at TIMESTAMPTZ,
    closed_out_by_admin BOOLEAN DEFAULT false,
    closed_out_at TIMESTAMPTZ,
    closed_out_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contractor_id, jobber_client_id)
  )`);
  await pool.query(`ALTER TABLE pending_referrals ADD COLUMN IF NOT EXISTS needs_admin_verification BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE pending_referrals ADD COLUMN IF NOT EXISTS jobber_name_matches JSONB`);
  await pool.query(`ALTER TABLE pending_referrals ADD COLUMN IF NOT EXISTS referrer_lookup_attempted BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE pending_referrals ADD COLUMN IF NOT EXISTS credit_email_sent_at TIMESTAMPTZ`);

  // ── BOOKING REQUESTS ──────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS booking_requests (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL DEFAULT 'accent-roofing',
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    referred_name TEXT NOT NULL,
    referred_phone TEXT,
    referred_email TEXT,
    referred_address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    jobber_client_id TEXT,
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // ── ERROR LOG ─────────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS error_log (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT DEFAULT 'accent-roofing',
    route TEXT,
    method TEXT,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    app_version TEXT DEFAULT 'unknown',
    count INTEGER NOT NULL DEFAULT 1,
    resolved BOOLEAN NOT NULL DEFAULT false,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS error_log_dedup_idx
    ON error_log (contractor_id, route, method, error_message)`);
  await pool.query(`
    ALTER TABLE error_log ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'backend'
  `);

  // ── MISSING REFERRAL REPORTS ──────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS missing_referral_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_name TEXT NOT NULL,
    referred_contact TEXT,
    channel TEXT NOT NULL,
    approximate_date DATE,
    admin_note TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // ── ADMIN MESSAGES (stub — full inbox built Session 39C) ───────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_messages (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL DEFAULT 'accent-roofing',
    message_type TEXT NOT NULL,
    reference_id INTEGER,
    title TEXT NOT NULL,
    body TEXT,
    color_code TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // ── SUGGESTION BOX ────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS suggestion_box_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    contractor_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // ── EXPERIENCE FLOW ───────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS experience_prompts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    jobber_invoice_id TEXT,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    response_type TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    CHECK (response_type IN ('pending','positive','negative'))
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS experience_invite_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    contractor_id TEXT NOT NULL,
    jobber_client_name TEXT NOT NULL,
    jobber_client_email TEXT,
    jobber_client_phone TEXT,
    jobber_invoice_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // ── CRM FIELD MAPPING ─────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_jobber_fields (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    jobber_field_id TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options JSONB,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contractor_id, jobber_field_id)
  )`);
  await pool.query(`ALTER TABLE contractor_settings
    ADD COLUMN IF NOT EXISTS contractor_field_mappings JSONB DEFAULT '{}'::jsonb`);

  // ── CAMPAIGNS ─────────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    parent_campaign_id INTEGER REFERENCES campaigns(id),
    filters JSONB,
    message_preset TEXT,
    message_body TEXT,
    ai_rapport_enabled BOOLEAN DEFAULT false,
    cta_enabled BOOLEAN DEFAULT true,
    outreach_method TEXT,
    batch_cap INTEGER,
    total_contacts INTEGER,
    total_batches INTEGER,
    current_batch INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    client_jobber_id TEXT NOT NULL,
    client_name TEXT,
    phone TEXT,
    email TEXT,
    job_type TEXT,
    job_source TEXT,
    job_date TEXT,
    job_value NUMERIC,
    in_app BOOLEAN DEFAULT false,
    selected BOOLEAN DEFAULT true,
    outreach_method TEXT,
    opted_out BOOLEAN DEFAULT false,
    batch_number INTEGER DEFAULT 1,
    delivered BOOLEAN DEFAULT false,
    opened BOOLEAN DEFAULT false,
    clicked BOOLEAN DEFAULT false,
    converted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_url TEXT`);

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
