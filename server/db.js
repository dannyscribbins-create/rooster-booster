const { Pool } = require('pg');
require('dotenv').config();
const addReferrerBankColumns = require('./migrations/add_referrer_bank_columns');
const addNotificationEmailColumns = require('./migrations/add_notification_email_columns');

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
    full_name TEXT, email TEXT, detail TEXT, created_at TIMESTAMP DEFAULT NOW(),
    category TEXT DEFAULT 'user_action'
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_cache (
    id INTEGER PRIMARY KEY DEFAULT 1, stats JSONB, cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMPTZ
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
  await pool.query(`ALTER TABLE admin_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
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
    payout_status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
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
    updated_at          TIMESTAMP DEFAULT NOW(),
    payout_automation         VARCHAR(20) NOT NULL DEFAULT 'manual_all',
    payout_review_threshold   NUMERIC(10,2)
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
  // Migration: T+24h post-job sequence — set TRUE for non-app users who sign up via warm welcome email
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS post_job_invite BOOLEAN DEFAULT FALSE`);
  // Migration: referral_code — unique referral identifier; exists in Railway DB, added here for completeness
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);

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
  // Migration: paid_at records the first moment a client transitions to 'paid'; never overwritten
  await pool.query(`ALTER TABLE pipeline_cache ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);
  // Migration: T+24h post-job sequence columns
  await pool.query(`ALTER TABLE pipeline_cache ADD COLUMN IF NOT EXISTS job_completed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE pipeline_cache ADD COLUMN IF NOT EXISTS t24_sequence_triggered BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE pipeline_cache ADD COLUMN IF NOT EXISTS post_job_modal_shown BOOLEAN NOT NULL DEFAULT FALSE`);

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

  // 'full_auto' | 'manual_all' | 'threshold' — controls payout approval flow
  // Defaults to manual_all (safest default — no money moves without review)
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS payout_automation VARCHAR(20) NOT NULL DEFAULT 'manual_all'`);
  // Only used when payout_automation = 'threshold'
  // Payouts at or above this amount require manual review
  // Nullable — null means threshold mode has not been configured
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS payout_review_threshold NUMERIC(10,2)`);
  // Valid values: stripe_ach | check | venmo | zelle — populated on cashout request submission
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20)`);
  // Links cashout back to the conversion that generated the balance; SET NULL if conversion is removed
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS referral_conversion_id INTEGER REFERENCES referral_conversions(id) ON DELETE SET NULL`);
  // Which payout methods the contractor has enabled; defaults to all four
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS enabled_payout_methods TEXT[] DEFAULT ARRAY['stripe_ach','check','venmo','zelle']`);
  // Set when admin marks a cashout request as paid
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);

  // ── STRIPE CONNECT ────────────────────────────────────────────────────────────
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS stripe_connect_status VARCHAR(20) NOT NULL DEFAULT 'not_connected'`);
  // Tag group visibility — opt-out model: missing key = visible, explicit false = hidden
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS tag_group_visibility JSONB DEFAULT '{}'`);

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
    complained BOOLEAN DEFAULT false,
    bounced BOOLEAN DEFAULT false,
    failed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_url TEXT`);

  // ── CAMPAIGN SESSION A MIGRATIONS ────────────────────────────────────────────
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_batch_sent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS csv_raw TEXT`);
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'jobber'`);
  // CSV contacts have no Jobber ID — drop NOT NULL to allow nullable; existing rows unaffected
  await pool.query(`ALTER TABLE campaign_contacts ALTER COLUMN client_jobber_id DROP NOT NULL`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS builder_path TEXT DEFAULT 'jobber'`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_step INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_rapport_generations INT DEFAULT 0`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS subject_line TEXT`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS selected_tone TEXT DEFAULT 'friendly'`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_message TEXT`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_header TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_images (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    b2_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_size_bytes INTEGER,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // ── CAMPAIGN SESSION B MIGRATIONS ─────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_batches (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    UNIQUE (campaign_id, batch_number)
  )`);
  await pool.query(`ALTER TABLE campaign_batches ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE campaign_batches ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE campaign_batches ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE campaign_batches ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_send_log (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    batch_number INTEGER NOT NULL,
    contact_id INTEGER,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // ── CAMPAIGN TRACKING TABLES ──────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_tracking_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_name TEXT,
    batch_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracking_tokens_campaign
    ON campaign_tracking_tokens(campaign_id, batch_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracking_tokens_email
    ON campaign_tracking_tokens(contact_email)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_events (
    id SERIAL PRIMARY KEY,
    token UUID NOT NULL REFERENCES campaign_tracking_tokens(token),
    campaign_id INTEGER NOT NULL,
    contractor_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'open_server', 'click_server', 'complained', 'bounced', 'delivered', 'failed')),
    cta_url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign
    ON campaign_events(campaign_id, batch_number, event_type)`);

  // ── SESSION 65: RESEND WEBHOOK EVENT TRACKING ────────────────────────────────
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS complained BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS bounced BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS failed BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS complained_alert_sent BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bounced_alert_sent BOOLEAN DEFAULT false`);

  // Drop and re-add event_type CHECK to expand allowed types
  await pool.query(`ALTER TABLE campaign_events DROP CONSTRAINT IF EXISTS campaign_events_event_type_check`);
  await pool.query(`ALTER TABLE campaign_events ADD CONSTRAINT campaign_events_event_type_check CHECK (event_type IN ('open', 'click', 'open_server', 'click_server', 'complained', 'bounced', 'delivered', 'failed'))`);

  // ── UNSUBSCRIBE / EMAIL PREFERENCES TABLES ────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(128) NOT NULL UNIQUE,
    contractor_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    batch_number INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    pixel_fired_at TIMESTAMP
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON unsubscribe_tokens(token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_email ON unsubscribe_tokens(contractor_id, email)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS email_opt_outs (
    id SERIAL PRIMARY KEY,
    contractor_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    opt_out_campaigns BOOLEAN NOT NULL DEFAULT FALSE,
    opt_out_sms BOOLEAN NOT NULL DEFAULT FALSE,
    opt_out_all BOOLEAN NOT NULL DEFAULT FALSE,
    referral_only BOOLEAN NOT NULL DEFAULT FALSE,
    opted_out_at TIMESTAMP DEFAULT NOW(),
    resubscribed_at TIMESTAMP,
    resubscribe_source VARCHAR(50),
    token_used VARCHAR(128),
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'unsubscribe_page',
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT,
    CONSTRAINT uq_opt_out_contractor_email UNIQUE (contractor_id, email)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_opt_outs_lookup ON email_opt_outs(contractor_id, email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_opt_outs_campaign ON email_opt_outs(campaign_id)`);

  // ── CONTACTS + SEND HISTORY ───────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id   VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    phone           VARCHAR(50),
    is_app_user     BOOLEAN DEFAULT false,
    jobber_client_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (contractor_id, email)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_contractor
    ON contacts(contractor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_contractor_email
    ON contacts(contractor_id, email)`);

  // ── ACTIVITY LOG CATEGORY + CONTACT DEEP-LINK ────────────────────────────────
  await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'user_action'`);
  await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_category ON activity_log(category)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id ON activity_log(contact_id)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contact_send_history (
    id             SERIAL PRIMARY KEY,
    contact_id     UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contractor_id  VARCHAR(100) NOT NULL,
    campaign_id    INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    batch_number   INTEGER,
    sent_at        TIMESTAMPTZ DEFAULT NOW(),
    channel        VARCHAR(20) NOT NULL,
    status         VARCHAR(50) DEFAULT 'sent',
    message_type   VARCHAR(50),
    subject        VARCHAR(500)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_send_history_contact
    ON contact_send_history(contact_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_send_history_contractor_campaign
    ON contact_send_history(contractor_id, campaign_id)`);

  // ── REFERRAL RULES ENGINE MIGRATIONS ──────────────────────────────────────────

  // 1A — Widen bonus_amount from INTEGER to NUMERIC(10,2) for tiered/percentage models
  await pool.query(`ALTER TABLE referral_conversions
    ALTER COLUMN bonus_amount TYPE NUMERIC(10,2)
    USING bonus_amount::NUMERIC(10,2)`);

  // Payout lifecycle state for this conversion
  // 'pending_review' | 'approved' | 'denied' | 'paid' | 'not_applicable'
  // Defaults to pending_review — no payout moves without explicit approval
  await pool.query(`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) NOT NULL DEFAULT 'pending_review'`);

  // 1B — Referral schedules: defines payout rules per contractor
  await pool.query(`CREATE TABLE IF NOT EXISTS referral_schedules (
    id                  SERIAL PRIMARY KEY,
    contractor_id       TEXT NOT NULL,
    name                TEXT NOT NULL,
    is_active           BOOLEAN DEFAULT true,
    payout_model        TEXT NOT NULL CHECK (payout_model IN ('escalating','tiered','flat','percentage')),
    minimum_invoice     NUMERIC(10,2),
    reset_period        TEXT NOT NULL DEFAULT 'none' CHECK (reset_period IN ('annual','lifetime','none')),
    escalating_steps    JSONB,
    tier_brackets       JSONB,
    flat_amount         NUMERIC(10,2),
    percentage_rate     NUMERIC(6,4),
    percentage_max_cap  NUMERIC(10,2),
    invoice_window_days INTEGER NOT NULL DEFAULT 20,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (contractor_id, name)
  )`);
  // Migration: add unique constraint to existing tables that predate this column
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'referral_schedules_contractor_id_name_unique'
      ) THEN
        ALTER TABLE referral_schedules ADD CONSTRAINT referral_schedules_contractor_id_name_unique UNIQUE (contractor_id, name);
      END IF;
    END $$;
  `);

  // 1C — Maps Jobber job type labels to schedules (many-to-one)
  await pool.query(`CREATE TABLE IF NOT EXISTS referral_schedule_job_types (
    id            SERIAL PRIMARY KEY,
    schedule_id   INTEGER NOT NULL REFERENCES referral_schedules(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    jobber_label  TEXT NOT NULL,
    UNIQUE(contractor_id, jobber_label)
  )`);

  // ── ACCENT ROOFING SEED DATA ──────────────────────────────────────────────────
  // Schedule A — Full Roof Replacement (escalating, annual reset, $9,500 minimum)
  await pool.query(`
    INSERT INTO referral_schedules
      (contractor_id, name, is_active, payout_model, minimum_invoice, reset_period,
       escalating_steps, invoice_window_days)
    VALUES (
      'accent-roofing',
      'Full Roof Replacement',
      true,
      'escalating',
      9500,
      'annual',
      '[
        {"referral_number": 1, "payout_amount": 500},
        {"referral_number": 2, "payout_amount": 600},
        {"referral_number": 3, "payout_amount": 700},
        {"referral_number": 4, "payout_amount": 750},
        {"referral_number": 5, "payout_amount": 800},
        {"referral_number": 6, "payout_amount": 850},
        {"referral_number": 7, "payout_amount": 900}
      ]'::jsonb,
      20
    )
    ON CONFLICT (contractor_id, name) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
    SELECT s.id, 'accent-roofing', v.label
    FROM referral_schedules s,
    (VALUES
      ('Out of Pocket'),
      ('Insurance'),
      ('Finance'),
      ('New Construction')
    ) AS v(label)
    WHERE s.contractor_id = 'accent-roofing'
      AND s.name = 'Full Roof Replacement'
    ON CONFLICT (contractor_id, jobber_label) DO NOTHING
  `);

  // Schedule B — Repair (tiered, no reset, $950 minimum floor)
  await pool.query(`
    INSERT INTO referral_schedules
      (contractor_id, name, is_active, payout_model, minimum_invoice, reset_period,
       tier_brackets, invoice_window_days)
    VALUES (
      'accent-roofing',
      'Repair',
      true,
      'tiered',
      950,
      'none',
      '[
        {"min": 951,  "max": 1200, "payout_amount": 50},
        {"min": 1201, "max": 2500, "payout_amount": 100},
        {"min": 2501, "max": 4000, "payout_amount": 150},
        {"min": 4001, "max": null, "payout_amount": 200}
      ]'::jsonb,
      20
    )
    ON CONFLICT (contractor_id, name) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
    SELECT s.id, 'accent-roofing', v.label
    FROM referral_schedules s,
    (VALUES
      ('Repair'),
      ('Repair Attempt'),
      ('Chimney Cap Install'),
      ('Skylight Install'),
      ('Rain Pan Install'),
      ('Gutter Install'),
      ('Gutter Cover Install'),
      ('Side Work'),
      ('Restoration')
    ) AS v(label)
    WHERE s.contractor_id = 'accent-roofing'
      AND s.name = 'Repair'
    ON CONFLICT (contractor_id, jobber_label) DO NOTHING
  `);

  // ── NOTIFICATION PREFERENCES ──────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    trigger_key TEXT NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contractor_id, trigger_key)
  )`);

  // ── CONTACT TAGS ──────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS contact_tags (
    id SERIAL PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('system', 'jobber', 'jobber_crm', 'admin')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_id, tag)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_tags_contractor_id ON contact_tags(contractor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag)`);

  // ── CONTACT TAGS MIGRATIONS (Jobber client import) ────────────────────────────
  await pool.query(`ALTER TABLE contact_tags ALTER COLUMN contact_id DROP NOT NULL`);
  await pool.query(`ALTER TABLE contact_tags ADD COLUMN IF NOT EXISTS jobber_client_id TEXT`);
  await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT IF EXISTS contact_tags_at_least_one_id`);
  await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT contact_tags_at_least_one_id
    CHECK (contact_id IS NOT NULL OR jobber_client_id IS NOT NULL)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_jobber_unique
    ON contact_tags (jobber_client_id, contractor_id, tag)
    WHERE jobber_client_id IS NOT NULL`);

  // ── JOBBER CLIENTS ────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS jobber_clients (
    id SERIAL PRIMARY KEY,
    jobber_client_id TEXT NOT NULL,
    contractor_id TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    is_company BOOLEAN DEFAULT FALSE,
    is_lead BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (jobber_client_id, contractor_id)
  )`);

  // ── REFERRER BANK ACCOUNT COLUMNS ─────────────────────────────────────────────
  await addReferrerBankColumns(pool);

  // ── NOTIFICATION EMAIL COLUMNS ────────────────────────────────────────────────
  await addNotificationEmailColumns(pool);

  // ── DYNAMIC AUDIENCES ─────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS dynamic_audiences (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filter_json JSONB NOT NULL DEFAULT '{}',
    member_count INTEGER NOT NULL DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dynamic_audiences_contractor_id
    ON dynamic_audiences(contractor_id)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS dynamic_audience_members (
    audience_id INTEGER NOT NULL REFERENCES dynamic_audiences(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (audience_id, contact_id)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dam_audience_id ON dynamic_audience_members(audience_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dam_contact_id ON dynamic_audience_members(contact_id)`);

  // ── DYNAMIC AUDIENCE MEMBERS MIGRATIONS (Phase 6.6 — Tier 1 Jobber clients) ──
  // Extend schema to support both contacts (Tier 2) and jobber_clients (Tier 1) members.
  // DROP CONSTRAINT drops the PK whose implicit NOT NULL blocks nullable contact_id.
  await pool.query(`ALTER TABLE dynamic_audience_members ADD COLUMN IF NOT EXISTS jobber_client_id TEXT`);
  await pool.query(`ALTER TABLE dynamic_audience_members DROP CONSTRAINT IF EXISTS dynamic_audience_members_pkey`);
  await pool.query(`ALTER TABLE dynamic_audience_members ALTER COLUMN contact_id DROP NOT NULL`);
  await pool.query(`ALTER TABLE dynamic_audience_members DROP CONSTRAINT IF EXISTS dam_at_least_one_id`);
  await pool.query(`ALTER TABLE dynamic_audience_members ADD CONSTRAINT dam_at_least_one_id
    CHECK (contact_id IS NOT NULL OR jobber_client_id IS NOT NULL)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS dam_contact_unique
    ON dynamic_audience_members(audience_id, contact_id)
    WHERE contact_id IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS dam_jobber_unique
    ON dynamic_audience_members(audience_id, jobber_client_id)
    WHERE jobber_client_id IS NOT NULL`);

  // ── ENGAGEMENT CADENCE ────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS engagement_cadence_settings (
    contractor_id TEXT NOT NULL,
    cadence_month INTEGER NOT NULL CHECK (cadence_month IN (1, 3, 6, 12)),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contractor_id, cadence_month)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS engagement_cadence_log (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    cadence_month INTEGER NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (contact_id, cadence_month)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ecl_contractor_id ON engagement_cadence_log(contractor_id)`);

  // Seed default engagement cadence settings for any contractor missing them
  const cadenceContractorRows = await pool.query(
    `SELECT DISTINCT contractor_id FROM contractor_settings`
  );
  for (const row of cadenceContractorRows.rows) {
    const defaults = [
      { month: 1,  subject: 'How is everything holding up?',           body: 'Hi {{first_name}},\n\nJust checking in after your recent project. We hope everything is looking great. Reach out anytime if you have questions.\n\n— {{company_name}}' },
      { month: 3,  subject: 'Your {{job_type}} — seasonal update',     body: 'Hi {{first_name}},\n\nStorm season is approaching. Your {{job_type}} completed in {{install_month}} is covered under our workmanship warranty through {{warranty_year}}. Reach out if anything looks off.\n\n— {{company_name}}' },
      { month: 6,  subject: "You've been a great ambassador",          body: "Hi {{first_name}},\n\nIt's been 6 months since your project wrapped — and we couldn't be more grateful. If anyone in your network needs a roofer this season, here's your referral link: {{referral_link}}.\n\nNo pressure — just wanted to make sure you had it.\n\n— {{company_name}}" },
      { month: 12, subject: 'Happy anniversary from {{company_name}}', body: "Hi {{first_name}},\n\nOne year ago we completed your {{job_type}}. Your workmanship warranty runs through {{warranty_year}} — we've got you covered.\n\nIf you know anyone who needs roofing work, your referral link is always active: {{referral_link}}.\n\n— {{company_name}}" },
    ];
    for (const d of defaults) {
      await pool.query(
        `INSERT INTO engagement_cadence_settings (contractor_id, cadence_month, is_enabled, subject, body)
         VALUES ($1, $2, TRUE, $3, $4)
         ON CONFLICT (contractor_id, cadence_month) DO NOTHING`,
        [row.contractor_id, d.month, d.subject, d.body]
      );
    }
  }

  // ── CRON JOB LOCKS ────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS cron_job_locks (
    job_name    TEXT PRIMARY KEY,
    is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at   TIMESTAMPTZ,
    locked_by   TEXT,
    timeout_at  TIMESTAMPTZ
  )`);
  await pool.query(`INSERT INTO cron_job_locks (job_name) VALUES
    ('pipeline_sync'),
    ('session_cleanup'),
    ('admin_cache_expiry'),
    ('engagement_cadence'),
    ('dynamic_audiences'),
    ('post_job_sequence'),
    ('jobber_incremental_sync')
  ON CONFLICT DO NOTHING`);

  // ── CONTACT JOBBER LINKS ──────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS contact_jobber_links (
    id SERIAL PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    jobber_client_id TEXT NOT NULL,
    contractor_id TEXT NOT NULL,
    match_confidence TEXT NOT NULL DEFAULT 'high',
    matched_on TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_id, jobber_client_id)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cjl_contact_id ON contact_jobber_links(contact_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cjl_jobber_client_id ON contact_jobber_links(jobber_client_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cjl_contractor_id ON contact_jobber_links(contractor_id)`);

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    deeplink TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_contractor_id ON notifications(contractor_id)`);

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
