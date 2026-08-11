const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();
const addReferrerBankColumns = require('./migrations/add_referrer_bank_columns');
const addNotificationEmailColumns = require('./migrations/add_notification_email_columns');
const addDecisionBSchema = require('./migrations/add_decision_b_schema');
const widenStickySourceCheck = require('./migrations/widen_sticky_source_check');
const addFlaggedAssignmentsStatus = require('./migrations/add_flagged_assignments_status');

const _connStr = process.env.DATABASE_URL || '';
// Skip SSL for localhost/127.0.0.1 (local dev + test). Railway URLs are non-local.
const _isLocalhost = /[@/](localhost|127\.0\.0\.1)[:/]/.test(_connStr);
const pool = new Pool({
  connectionString: _connStr,
  ssl: _isLocalhost ? false : { rejectUnauthorized: false },
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
  // Prevents double-approval creating duplicate announcement rows.
  // Risk on first deploy: fails if duplicate rows already exist in production — deduplicate first.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS payout_announcements_cashout_unique
    ON payout_announcements(cashout_request_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcement_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    mode TEXT DEFAULT 'preset_1',
    custom_message TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
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

  // ── C/DL-2 LANDING PAGE — the ONE genuinely missing branding column ──────────
  // The landing page's --brand-bg has no existing source. Its three siblings DO:
  // --brand-primary <- primary_color, --brand-secondary <- secondary_color, and
  // --landing-logo <- logo_url. LP §5 called all four "NEW columns"; that was
  // written before those columns existed. Adding brand_* twins alongside them was
  // explicitly rejected — two competing colour sources on one table is precisely
  // the failure mode this avoids. Nullable with no default: a NULL falls back to
  // the RoofMiles default token at render time, so a brand-new contractor has a
  // decent page before uploading anything.
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS landing_bg_color VARCHAR(20)`);

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

  // Tenant rebuild S3, Batch C(a): captures which Jobber account (accountId) a contractor's
  // OAuth connection belongs to, so webhook handlers can resolve contractor_id from the
  // payload via resolveWebhookContractorId() (webhooks/jobber.js) — the single-tenant
  // getDefaultContractorId() tripwire this replaced was retired the same session.
  await pool.query(`ALTER TABLE contractor_crm_settings ADD COLUMN IF NOT EXISTS jobber_account_id TEXT`);

  // Guarded UNIQUE — two contractors sharing a Jobber account indicates an OAuth-connection
  // bug and should fail loud at connect time, not silently misroute webhooks later. NULLs
  // never collide under a Postgres UNIQUE, so pre-backfill rows are unaffected.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contractor_crm_settings_jobber_account_id_unique'
      ) THEN
        ALTER TABLE contractor_crm_settings ADD CONSTRAINT contractor_crm_settings_jobber_account_id_unique UNIQUE (jobber_account_id);
      END IF;
    END $$;
  `);

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

  // tokens.id is inert as of the TF token-fix session (decision TF-D1.1) — auto-filled by
  // this sequence, never written or read by application code. contractor_id is the real
  // key (UNIQUE above, used by the ON CONFLICT upsert in routes/oauth.js). The PK stays on
  // id (D1) — this only gives the column a self-filling default so an INSERT can omit it.
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS tokens_id_seq`);
  await pool.query(`ALTER TABLE tokens ALTER COLUMN id SET DEFAULT nextval('tokens_id_seq')`);
  await pool.query(`ALTER SEQUENCE tokens_id_seq OWNED BY tokens.id`);
  // Idempotent-safe on every restart: re-reads MAX(id), which only grows.
  await pool.query(`SELECT setval('tokens_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM tokens), 0), 1))`);

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
  // Only seed on a genuinely empty table (first-ever boot). ON CONFLICT (contractor_id, name)
  // DO NOTHING was not safe post-rename: after renaming the dev tenant, the live rows have
  // the new contractor_id, so the conflict never fires and phantom 'accent-roofing' rows
  // would be created on every deploy. The empty-table guard prevents this while still seeding
  // a fresh production deployment correctly.
  const { rows: existingSchedules } = await pool.query('SELECT id FROM referral_schedules LIMIT 1');
  if (existingSchedules.length === 0) {
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
  }

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

  // audience_id FK on campaigns — must run after dynamic_audiences table is created above
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_id INTEGER REFERENCES dynamic_audiences(id)`);

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

  // ── SUPER ADMINS ──────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS super_admins (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
  )`);

  // One-time seed: inserts the platform super-admin account if the table is empty.
  // Reads credentials from env vars SUPER_ADMIN_SEED_EMAIL + SUPER_ADMIN_SEED_PASSWORD.
  // Once the row exists these vars are no longer needed and can be removed from Railway.
  if (process.env.SUPER_ADMIN_SEED_EMAIL && process.env.SUPER_ADMIN_SEED_PASSWORD) {
    const { rows: saRows } = await pool.query('SELECT COUNT(*) AS count FROM super_admins');
    if (parseInt(saRows[0].count, 10) === 0) {
      const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_SEED_PASSWORD, 12);
      await pool.query(
        'INSERT INTO super_admins (email, password_hash) VALUES ($1, $2)',
        [process.env.SUPER_ADMIN_SEED_EMAIL, passwordHash]
      );
      console.log('[Seed] Super-admin account created.'); // diagnostic log — intentional
    }
  }

  // CONTRACTORS — single row per contractor, TEXT primary key
  await pool.query(`CREATE TABLE IF NOT EXISTS contractors (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  // Seed the default contractor only on a genuinely empty table (first-ever boot).
  // ON CONFLICT (id) DO NOTHING was not safe post-rename: after renaming the dev tenant,
  // 'accent-roofing' no longer exists so the guard never fired and the row was silently
  // re-created on every deploy. The empty-table guard prevents this while still seeding
  // a fresh production deployment correctly.
  const { rows: existingContractors } = await pool.query('SELECT id FROM contractors LIMIT 1');
  if (existingContractors.length === 0) {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ('accent-roofing', 'Accent Roofing Service', 'active')`
    );
  }

  // ── C/DL-2 LANDING PAGE — PUBLIC PER-CONTRACTOR SLUG (LP §6.2) ──────────────
  // The slug is what appears in a public URL: https://<slug>.roofmiles.com/i/<token>.
  //
  // IT IS NOT contractors.id, AND IT IS DELIBERATELY NOT BACKFILLED FROM IT.
  // The internal id must never reach a public URL — preventing exactly that leak
  // is the entire reason this column exists as a separate value. A migration that
  // did `UPDATE contractors SET slug = id` would satisfy every schema check while
  // defeating the column's only purpose, so there is no backfill here and no
  // DEFAULT. Every row starts NULL and stays NULL until a slug is set deliberately.
  //
  // No slug VALUE is seeded either. Seeding one would mean naming a contractor id
  // in a migration, which is a standing prohibition; the first real slug is set by
  // a separate one-off statement after this deploys.
  await pool.query(`ALTER TABLE contractors ADD COLUMN IF NOT EXISTS slug TEXT`);

  // Standard UNIQUE semantics, NOT `NULLS NOT DISTINCT`. This distinction is
  // load-bearing rather than stylistic: because nothing is backfilled above, EVERY
  // contractor row carries slug IS NULL on arrival. Postgres treats NULLs as
  // distinct by default, so any number of contractors can coexist unslugged.
  // Under PG15's opt-in NULLS NOT DISTINCT the second contractor row would be
  // rejected outright and onboarding would break on contractor #2.
  //
  // CREATE UNIQUE INDEX IF NOT EXISTS rather than ADD CONSTRAINT in a DO block:
  // it is idempotent by construction and cannot collide with its own backing index
  // on re-run (the 42P07 hazard CLAUDE.md documents for the ADD CONSTRAINT form).
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_contractors_slug_unique ON contractors (slug)`
  );

  // TEAM MEMBERS — per-contractor admin accounts replacing shared ADMIN_PASSWORD
  await pool.query(`CREATE TABLE IF NOT EXISTS team_members (
    id            SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL REFERENCES contractors(id),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    tier          TEXT NOT NULL DEFAULT 'owner',
    permissions   JSONB,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP DEFAULT NOW()
  )`);

  // Wire contractor_id into sessions so every admin session carries tenant identity
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)`);
  // Wire team_member_id so requirePermission() can do live JSONB reads without session caching
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS team_member_id INTEGER REFERENCES team_members(id)`);

  // ── TENANT RESOLUTION REBUILD — users.contractor_id (Session 1, Phase 4) ────
  // See TENANT_RESOLUTION_REBUILD_SPEC.md Section 2. Four sequential blocks, run in
  // this exact order every boot (idempotent) — do not reorder. Runs after the
  // contractors table (created + empty-table-guard seeded above) so the backfill's
  // exactly-1-row check always has a contractor to read.

  // Step 1 — add the column, nullable, no default.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)`);

  // Step 2 — fail-closed backfill: mirrors the fail-closed philosophy the now-retired
  // getDefaultContractorId() used, applied once, at migration time, in SQL. Only safe
  // pre-contractor-#2. Scope amendment (ST session, Danny-ruled): only runs while
  // backfill work remains (a users row still has contractor_id NULL) — otherwise this
  // guard would re-fire and crash every boot once a second contractors row exists,
  // long after the backfill itself completed.
  await pool.query(`
    DO $$
    DECLARE
      the_contractor_id TEXT;
      contractor_count INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE contractor_id IS NULL) THEN
        SELECT COUNT(*) INTO contractor_count FROM contractors;
        IF contractor_count <> 1 THEN
          RAISE EXCEPTION 'users.contractor_id backfill aborted: expected exactly 1 contractors row, found %. This migration is only safe pre-contractor-#2 — investigate before re-running.', contractor_count;
        END IF;
        SELECT id INTO the_contractor_id FROM contractors LIMIT 1;
        UPDATE users SET contractor_id = the_contractor_id WHERE contractor_id IS NULL;
      END IF;
    END $$;
  `);

  // Step 3 — enforce NOT NULL once every row is backfilled. Guarded so a re-run
  // (contractor_id already NOT NULL) is a no-op, not an error.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'contractor_id' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE users ALTER COLUMN contractor_id SET NOT NULL;
      END IF;
    END $$;
  `);

  // Step 4 — replace the global email UNIQUE with a per-contractor one. No collision
  // pre-check needed: the old global UNIQUE(email) already guarantees no duplicate
  // emails exist, so the stricter per-contractor constraint can never be rejected by
  // existing data (spec Section 2, Step 4).
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_contractor_id_email_unique'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_contractor_id_email_unique UNIQUE (contractor_id, email);
      END IF;
    END $$;
  `);

  // ── C/DL-3b PHASE 2A — UNIFIED-LOGIN EMAIL LOOKUP INDEXES ───────────────────
  // See CDL_3b_BUILD_SPEC.md §4.2 and decision D1 (verify-then-disambiguate).
  //
  // The unified login collects { email, password } and has no tenant information
  // at all — the React app lives on app.roofmiles.com and `app` is a reserved
  // slug, so host resolution correctly returns null there. So the lookup has to
  // search an email across ALL contractors and across BOTH identity tables before
  // it knows who anybody is. Two facts make that unsound today.
  //
  // NON-UNIQUE on users, and that is not an oversight. The only email index on
  // users is users_contractor_id_email_unique, added directly above, which LEADS
  // with contractor_id — a tenant-less LOWER(email) predicate cannot use it and
  // sequential-scans the whole table on every login attempt. This index supports
  // that predicate. It must NOT be unique: one address holding an account with two
  // different contractors is a supported state per the tenant rebuild, and it is
  // precisely the case D1 exists to disambiguate.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email))
  `);

  // UNIQUE on team_members, because team_members.email is already globally unique;
  // this only closes the case-variant hole in a guarantee that already exists.
  // users is matched with LOWER() everywhere (referrer.js:1058 and friends);
  // team_members is matched case-SENSITIVELY (admin/index.js:58, and the
  // OWNER_SEED block below). One endpoint reading both needs the two tables to
  // agree on what "the same email" means, or a rep whose row was stored as
  // Jane@x.com is simply unreachable by a login form that normalises input.
  //
  // ⚠ THE PRE-CHECK RAISES RATHER THAN RESOLVING, DELIBERATELY. Two rows differing
  // only by email case are two credential records — two password hashes, two
  // permission sets, possibly two people. Choosing a survivor is an identity
  // decision. A migration that silently deleted or merged one could lock a real
  // person out, or hand one person's session to the other's row, and would do it
  // during a boot with nobody watching. It fails closed and names the addresses so
  // an operator resolves it deliberately.
  //
  // The shape is absent from production today (verified pre-flight) but stays
  // REACHABLE: the OWNER_SEED_EMAIL block below inserts whatever letter case the
  // env var holds, with no normalisation on the way in. That is why the proof in
  // server/test/unifiedLoginSchema.test.js seeds the shape rather than trusting a
  // fresh-schema run — the ST-session standing principle.
  //
  // WORK-REMAINING WRAPPER (CLAUDE.md, binding): the whole block is gated on the
  // index not existing yet. Once it does, Postgres enforces the invariant, so the
  // duplicate scan can never again have anything to find and this is a permanent
  // no-op — rather than a fail-closed guard that re-fires on every boot the moment
  // contractor #2 exists. The gate is also what makes the bare CREATE UNIQUE INDEX
  // idempotent: without it the second boot raises 42P07 on the index name.
  await pool.query(`
    DO $$
    DECLARE
      dup_list TEXT;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'uniq_team_members_lower_email' AND relkind = 'i'
      ) THEN
        SELECT string_agg(le, ', ' ORDER BY le) INTO dup_list
          FROM (
            SELECT LOWER(email) AS le
              FROM team_members
             GROUP BY LOWER(email)
            HAVING COUNT(*) > 1
          ) d;
        IF dup_list IS NOT NULL THEN
          RAISE EXCEPTION 'team_members case-insensitive email uniqueness aborted: these addresses exist under more than one letter case — %. Each pair is two separate credential records; decide by hand which account survives before re-running. Do not guess.', dup_list;
        END IF;
        CREATE UNIQUE INDEX uniq_team_members_lower_email ON team_members (LOWER(email));
      END IF;
    END $$;
  `);

  // ── C/DL-1 — CONTRACTOR_INVITE_LINKS TOKEN LAYER ─────────────────────────────
  // See DECISION_C_DL_BUILD_SPEC.md §4 (C/DL-1) and amendment A4. EXTEND, not
  // supersede: signup, the T+24h cron CTA, and the admin invite-link surface all
  // already read this table, so extending leaves every reader untouched.
  //
  // PLACEMENT IS LOAD-BEARING. This block sits here, not beside the table's own
  // CREATE at ~line 179, because owner_team_member_id carries an FK to team_members
  // — created at line 1138. Placed at the CREATE site, a fresh-database boot would
  // fail on a forward reference to a table that does not exist yet.

  // Eleven additive columns. ADD COLUMN IF NOT EXISTS is idempotent, and when the
  // column already exists the inline REFERENCES clause is skipped with it.
  //
  // superseded_by is a SELF-reference: a replacement token points back at the token
  // it replaced. The data model ships now so a future row has somewhere to point;
  // the supersedeToken() function that writes it is deferred to C/DL-3 (CD-14 —
  // resend mints a fresh token, and an expired or superseded token is never
  // resurrected). ON DELETE SET NULL so deleting a superseded ancestor never
  // cascades into its replacement.
  await pool.query(`
    ALTER TABLE contractor_invite_links
      ADD COLUMN IF NOT EXISTS owner_team_member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS superseded_by        INTEGER REFERENCES contractor_invite_links(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS redeemed_at          TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS redeemed_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS expires_at           TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS scanned_at           TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS soft_save_name       TEXT,
      ADD COLUMN IF NOT EXISTS soft_save_email      TEXT,
      ADD COLUMN IF NOT EXISTS soft_save_phone      TEXT,
      ADD COLUMN IF NOT EXISTS consent_affirmed_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS consent_channel      TEXT
  `);

  // Drop the stale 'accent-roofing' default (amendment A1 — dynamic-id-first). Every
  // writer passes contractor_id explicitly; the default only exists to silently
  // mis-tenant a row that forgot to. Verified safe: 0 production rows carry it.
  // ALTER COLUMN ... DROP DEFAULT is a no-op when no default is present, so this is
  // idempotent without a guard.
  await pool.query(`ALTER TABLE contractor_invite_links ALTER COLUMN contractor_id DROP DEFAULT`);

  // OWNER CHECK — orphan-tolerant, negative-only. Enforces only that the WRONG owner
  // column is never set for a type; each type's own owner column stays nullable so
  // ON DELETE SET NULL can always fire and pre-existing orphans cannot block ADD
  // CONSTRAINT. Production carries 2 peer rows with a NULL owner today (Railway Q6) —
  // the rejected NOT NULL form would have failed on arrival against real data.
  //
  // Fail-closed on unknown link_type: a fourth type is rejected until this constraint
  // is deliberately widened. Verified safe — production holds only 'peer' and
  // 'contractor' (Railway Q2).
  //
  // pg_constraint pre-check per CLAUDE.md. A CHECK has no backing index, so unlike a
  // UNIQUE it cannot collide with a 42P07 on re-run.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invite_links_owner'
      ) THEN
        ALTER TABLE contractor_invite_links ADD CONSTRAINT chk_invite_links_owner CHECK (
             (link_type = 'peer'       AND owner_team_member_id IS NULL)
          OR (link_type = 'rep'        AND created_by_user_id   IS NULL)
          OR (link_type = 'contractor' AND created_by_user_id   IS NULL
                                       AND owner_team_member_id IS NULL)
        );
      END IF;
    END $$;
  `);

  // CONSENT CHECK (CD-15) — the affirmation and the channel it was given for travel
  // together or not at all, and the channel is a closed vocabulary. A token with a
  // channel but no timestamp would be an unlogged consent claim, which is exactly
  // what 10DLC makes non-negotiable.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invite_links_consent'
      ) THEN
        ALTER TABLE contractor_invite_links ADD CONSTRAINT chk_invite_links_consent CHECK (
             (consent_affirmed_at IS NULL     AND consent_channel IS NULL)
          OR (consent_affirmed_at IS NOT NULL AND consent_channel IN ('sms', 'email'))
        );
      END IF;
    END $$;
  `);

  // CONTACT-METHOD CHECK (CD-11) — a consented send must have somewhere to send to.
  // SMS consent requires a phone on the row; email consent requires an email. The
  // raw-scan path (CD-11a) carries no name and no contact at all and stays legal:
  // both sides are NULL, no consent is recorded, and every branch passes.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invite_links_contact_method'
      ) THEN
        ALTER TABLE contractor_invite_links ADD CONSTRAINT chk_invite_links_contact_method CHECK (
              (consent_channel IS DISTINCT FROM 'sms'   OR soft_save_phone IS NOT NULL)
          AND (consent_channel IS DISTINCT FROM 'email' OR soft_save_email IS NOT NULL)
        );
      END IF;
    END $$;
  `);

  // ── DEFAULT MARKETING LINK (C/DL-2 Phase 3d-3, amendment A18) ───────────────
  // Two facts the bare-subdomain marketing page needs and this table could not
  // express, both additive and both defaulting to false — so every pre-existing
  // row (production carries six for the first contractor) lands in exactly the
  // state it was already in: an ordinary marketing link that is not the default.
  //
  //   is_default_marketing  WHICH of a contractor's marketing links their bare
  //                         subdomain serves. Without it there is no way to
  //                         honour "admins MAY designate a different existing
  //                         marketing link as the default", and no way for a
  //                         second page serve to find the token the first one
  //                         minted rather than minting another.
  //
  //   auto_minted           whether the PLATFORM minted it or a human did. A18
  //                         requires the admin marketing-links list to label an
  //                         auto-minted link as automatic, "so an admin never
  //                         finds a link they did not create and cannot account
  //                         for" — and a label the list can render has to be a
  //                         stored fact rather than an inference.
  //
  // NOT NULL DEFAULT false needs no table rewrite on PostgreSQL 11+, so this is
  // safe on a table with existing rows.
  await pool.query(`
    ALTER TABLE contractor_invite_links
      ADD COLUMN IF NOT EXISTS is_default_marketing BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS auto_minted          BOOLEAN NOT NULL DEFAULT false
  `);

  // ⚠ THE CONCURRENCY GUARD, AND IT MUST LIVE HERE RATHER THAN IN JAVASCRIPT.
  //
  // The obvious implementation of auto-mint — SELECT a default, INSERT one if the
  // SELECT found nothing — races. Every concurrent request reads "no default"
  // before any of them writes, and all of them insert. The window is small and
  // the trigger is entirely ordinary: a QR scanned by several people at once at
  // an event, a link posted to a group chat, a preview crawler fanning out. It
  // will happen in production and it will never happen in manual testing.
  //
  // SCOPED PER CONTRACTOR, and that is the whole point of the leading column. An
  // index on the marker ALONE would permit exactly one default row across the
  // entire platform — every contractor after the first would find their bare
  // subdomain permanently unable to mint, silently, and only the first one would
  // work. server/test/landingMarketingMode.test.js's two-contractor test is what
  // catches that specific mistake.
  //
  // PARTIAL, on `is_default_marketing AND active`, which is deliberately the same
  // predicate resolveDefaultMarketingToken() reads by. Two consequences worth
  // stating: a contractor may hold any number of NON-default marketing links, and
  // revoking a default (active = false) drops it out of the index so the next
  // serve can mint a fresh one rather than leaving that subdomain permanently
  // broken.
  //
  // Known edge, deliberately not automated: a default that is still `active` but
  // has passed its `expires_at` stays in the index, so no replacement can be
  // minted while it sits there. It is unreachable for an auto-minted default,
  // which never carries an expiry, and for an admin-designated one it is both
  // admin-caused and admin-recoverable (revoke it, or clear the flag). Inventing
  // a self-healing write for a state no test exercises would be worse.
  //
  // CREATE UNIQUE INDEX IF NOT EXISTS is idempotent on its own. CLAUDE.md's
  // 42P07 warning covers `ADD CONSTRAINT ... UNIQUE`, which collides with its own
  // backing index on re-run; a bare index has no such second identity.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_marketing_link_per_contractor
      ON contractor_invite_links (contractor_id)
      WHERE is_default_marketing AND active
  `);

  // Every read of this table is contractor-scoped and nearly all filter active=true
  // (admin/index.js:537, postJobSequence.js:142). Roster-facing indexes are
  // deliberately deferred until C/DL-3 defines the roster's actual query shape.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_invite_links_contractor_active
      ON contractor_invite_links (contractor_id, active)
  `);

  // ── C/DL-3b PHASE 2B — LOGIN CHOICE TOKENS (D2) ─────────────────────────────
  // When verify-then-disambiguate finds MORE THAN ONE candidate whose hash the
  // supplied password opened, the server cannot mint a session — it does not yet
  // know which identity the person means — and D2 forbids asking them to re-send
  // the password. It issues a short-lived choice token instead.
  //
  // ⚠ WHY THIS IS A TABLE AND NOT A SIGNED STATELESS VALUE. Two independent
  // reasons, either one sufficient:
  //
  //   1. D2's privacy rule. A stateless token has to carry the matched identity
  //      set INSIDE ITSELF, because there is nowhere else for it to live — which
  //      means shipping user ids and contractor ids to the client, exactly what
  //      D2 forbids ("contractor name and role only, never emails, never IDs").
  //      Encrypting rather than signing only means handing over tenancy-bearing
  //      data and trusting the cipher to hide it. A row keeps the ids server-side
  //      and hands out an opaque 64-hex string.
  //   2. Single-use is unimplementable without state. Statelessness means the
  //      server keeps no record, so it cannot know a token was already redeemed.
  //      Adding a burn-list to a stateless design is a table with extra steps.
  //
  // ⚠ AND WHY NOT A ROW IN `sessions` WITH role = 'choice'. That is the
  // half-authenticated-session shape D9 already names as the thing that makes 2FA
  // decorative. It would not authenticate today — every session query filters on
  // role — but it puts a non-session in the sessions table, and the next person
  // to write a session query has to REMEMBER to exclude it. Fail-open by
  // construction; the query that forgets is the bug. Kept out of that table.
  //
  // consumed_at is a burn MARKER, not a delete, mirroring pin_reset_tokens.used_at
  // — a redeemed token stays visible for the short window it lives, so a replay
  // is distinguishable from a forgery in the row itself rather than only in a log.
  //
  // candidates holds [{ source, id, contractor_id }] and is the ONLY place the
  // matched set exists. `selection` from the client indexes into it, so "select an
  // identity that did not match" is not addressable rather than merely refused.
  await pool.query(`CREATE TABLE IF NOT EXISTS login_choice_tokens (
    id          SERIAL PRIMARY KEY,
    token       TEXT UNIQUE NOT NULL,
    candidates  JSONB NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`);
  // Redemption reads by token (already unique-indexed). This index serves the
  // sessionCleanup sweep, which deletes by expiry.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_login_choice_tokens_expires_at
      ON login_choice_tokens (expires_at)
  `);
  console.log('✓ migration: login_choice_tokens'); // diagnostic log — intentional

  // One-time seed: inserts the Accent Roofing Owner account if the email does not yet exist.
  // Reads credentials from env vars OWNER_SEED_EMAIL + OWNER_SEED_PASSWORD.
  if (process.env.OWNER_SEED_EMAIL && process.env.OWNER_SEED_PASSWORD) {
    // LOWER() on both sides is load-bearing as of C/DL-3b Phase 2A. This check was
    // case-SENSITIVE, so an env var whose letter case differed from the stored row
    // missed it, fired the INSERT, and created a second row unreachable by any
    // LOWER()-normalising login. uniq_team_members_lower_email now rejects that
    // INSERT outright — which would turn a benign no-op seed into a 23505 that
    // aborts initDB() and kills the boot. The seed has to agree with the invariant
    // the same file enforces.
    const { rows: ownerRows } = await pool.query(
      'SELECT id FROM team_members WHERE LOWER(email) = LOWER($1)',
      [process.env.OWNER_SEED_EMAIL]
    );
    if (ownerRows.length === 0) {
      // Read contractor_id from the contractors table rather than hardcoding — safe after any rename.
      const { rows: contractorRows } = await pool.query('SELECT id FROM contractors LIMIT 1');
      const seedContractorId = contractorRows[0]?.id || 'accent-roofing';
      const passwordHash = await bcrypt.hash(process.env.OWNER_SEED_PASSWORD, 12);
      await pool.query(
        `INSERT INTO team_members (contractor_id, email, password_hash, tier) VALUES ($1, $2, $3, 'owner')`,
        [seedContractorId, process.env.OWNER_SEED_EMAIL, passwordHash]
      );
      console.log('[Seed] Accent Roofing Owner account created.'); // diagnostic log — intentional
    }
  }

  // ── PHASE 6: TEAM MEMBERS EXTENSIONS + TITLES ────────────────────────────────
  // titles must be created before the title_id FK is added to team_members
  await pool.query(`CREATE TABLE IF NOT EXISTS titles (
    id            SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL REFERENCES contractors(id),
    name          TEXT NOT NULL,
    UNIQUE(contractor_id, name)
  )`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS full_name TEXT`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_field_rep BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_attributable BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS rep_revenue_visibility BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS jobber_user_id TEXT`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS title_id INTEGER REFERENCES titles(id)`);
  // Sub-piece 4: one Jobber user maps to at most one RoofMiles rep.
  // DO block is the idiomatic idempotent pattern — ALTER TABLE ADD CONSTRAINT IF NOT EXISTS
  // is not valid PostgreSQL syntax in any supported version. Confirmed via Railway console
  // (Session 93): the constraint already exists and is healthy (pg_constraint contype='u'),
  // backed by its own unique index of the same name. Every re-run of this ADD CONSTRAINT
  // recreates that same-named backing index and collides with the constraint's own existing
  // index, raising 42P07 (duplicate_table) rather than 42710 (duplicate_object) — Postgres
  // treats the index-name collision differently from a constraint-name collision. The old
  // handler only caught duplicate_object, so every boot threw here and skipped the rest of
  // initDB(). Catching duplicate_table too is safe: it's a no-op on an already-satisfied
  // invariant, not a swallowed real error.
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE team_members
        ADD CONSTRAINT team_members_jobber_user_id_unique UNIQUE (jobber_user_id);
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$
  `);

  // ── C/DL-3a PHASE 2A: REP-FLAG COHERENCE CHECK ───────────────────────────────
  // Every rep ability requires is_field_rep. This is the second of two enforcement
  // layers — POST /api/admin/team/:id/promote is the first. The DB layer exists
  // because Known Issue 13's production drift (rep id 5 held is_attributable=true
  // with is_field_rep=false) was created by DIRECT SQL, before any endpoint existed;
  // an application-only check could never have prevented it.
  //
  // DEFENSIVE BY DESIGN — this block must never be able to abort a boot:
  //   • Idempotent: skipped outright once the constraint exists.
  //   • Pre-flight count: if any row already violates coherence, the ADD is SKIPPED
  //     and a loud warning is logged instead of raising. A legacy drifted row must
  //     surface as an operator warning, never as a crashed initDB() that takes the
  //     whole service down (the ST-session incident, CLAUDE_REGISTRY Architecture
  //     Notes). The next boot after the data is corrected adds the constraint.
  // The pre-flight count runs in JS, not inside the DO block, DELIBERATELY: a Postgres
  // RAISE WARNING is delivered to the client only as a 'notice' event, and nothing in
  // this app attaches a notice listener — the warning would be swallowed silently,
  // exactly in the case where an operator most needs to see it. console.error reaches
  // the Railway app log.
  const { rows: repCoherenceConstraint } = await pool.query(
    `SELECT 1 FROM pg_constraint WHERE conname = 'team_members_rep_coherence'`
  );
  if (repCoherenceConstraint.length === 0) {
    const { rows: [{ violating }] } = await pool.query(`
      SELECT COUNT(*)::int AS violating
      FROM team_members
      WHERE NOT is_field_rep AND (is_attributable OR rep_revenue_visibility)
    `);
    if (violating > 0) {
      // diagnostic log — intentional
      console.error(
        `*** REP COHERENCE CONSTRAINT NOT APPLIED *** ${violating} team_members row(s) have ` +
        `is_attributable or rep_revenue_visibility set while is_field_rep is false. ` +
        `initDB() has SKIPPED adding team_members_rep_coherence rather than aborting the boot. ` +
        `Correct those rows (set is_field_rep = true, or clear the dependent flags) and redeploy — ` +
        `the constraint applies itself on the next boot. See CLAUDE_REGISTRY.md Known Issue 13.`
      );
    } else {
      // A CHECK has no backing index, so the duplicate_table hazard documented on the
      // UNIQUE above cannot occur — duplicate_object alone is the complete guard. Kept
      // as a DO block anyway so a concurrent boot losing the race is a no-op, not a crash.
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE team_members
            ADD CONSTRAINT team_members_rep_coherence
            CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      console.log('✓ migration: team_members.rep_coherence_check'); // diagnostic log — intentional
    }
  }

  // ── DECISION B SCHEMA (attribution_source, client_rep_assignments, flagged_assignments) ──
  await addDecisionBSchema(pool);

  // ── ANCHOR/GRACE ATTRIBUTION FIX — widen sticky_source for gate-fallthrough writes ──
  await widenStickySourceCheck(pool);

  // ── FA: flagged_assignments status lifecycle (replaces boolean `reviewed`) ──
  await addFlaggedAssignmentsStatus(pool);

  // Backfill full_name on the seeded Owner row. WHERE full_name IS NULL is idempotent.
  await pool.query(`UPDATE team_members SET full_name = 'Danny Scribbins' WHERE id = 1 AND full_name IS NULL`);

  // Seed preset titles for every existing contractor. Reads contractor_id dynamically —
  // never hardcoded — so this works correctly after any tenant rename.
  // Preset names mirror permission-preset labels for UX convenience ONLY.
  // CRITICAL DECOUPLING: titles are display labels; they confer zero permissions.
  const PRESET_TITLES = ['Full Admin', 'Marketing Admin', 'Finance Admin', 'Office Manager', 'Internal Team', 'Field Rep'];
  const { rows: contractorRowsForTitles } = await pool.query('SELECT id FROM contractors');
  for (const { id: contractorIdForTitles } of contractorRowsForTitles) {
    for (const titleName of PRESET_TITLES) {
      await pool.query(
        `INSERT INTO titles (contractor_id, name) VALUES ($1, $2) ON CONFLICT (contractor_id, name) DO NOTHING`,
        [contractorIdForTitles, titleName]
      );
    }
  }

  // ── ST SESSION: SINGLETON TABLE TENANCY + cashout_requests SCOPING ───────────
  // SINGLETON_CASHOUT_TENANCY_SPEC.md. ST-1 (Option A): announcement_settings —
  // contractor_id becomes the sole PRIMARY KEY, old id column dropped. ST-1A
  // (amendment): admin_cache is a multi-entry cache table (dashboard stats keyed
  // 'dashboard_stats', Google Places rating keyed 'google_rating') — its key becomes
  // COMPOSITE: PRIMARY KEY (contractor_id, cache_key). Must run after the contractors
  // table (created + seeded above) — same fail-closed precondition family as the
  // tenant migrations. cashout_requests uses the DERIVED backfill house pattern
  // (tenancy is derivable from the owning user, not a single-contractor assumption).

  // ── 2.1 admin_cache (ST-1A composite key) ────────────────────────────────────
  await pool.query(`ALTER TABLE admin_cache ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)`);
  // Fail-closed backfill — only runs while backfill work remains (a row still has
  // contractor_id NULL). Once NOT NULL is enforced below, this guard is a permanent
  // no-op — it must never re-fire on every boot after a second contractors row exists.
  await pool.query(`
    DO $$
    DECLARE
      the_contractor_id TEXT;
      contractor_count INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM admin_cache WHERE contractor_id IS NULL) THEN
        SELECT COUNT(*) INTO contractor_count FROM contractors;
        IF contractor_count <> 1 THEN
          RAISE EXCEPTION 'admin_cache.contractor_id backfill aborted: expected exactly 1 contractors row, found %. This migration is only safe pre-contractor-#2 — investigate before re-running.', contractor_count;
        END IF;
        SELECT id INTO the_contractor_id FROM contractors LIMIT 1;
        UPDATE admin_cache SET contractor_id = the_contractor_id WHERE contractor_id IS NULL;
      END IF;
    END $$;
  `);
  // Key normalization — MUST run before the NOT NULL enforcement below: a pre-existing
  // dashboard-stats row (from the old id=1 shape) has cache_key NULL until this runs, and
  // the NOT NULL step would abort on that row otherwise. Guarded on the id column still
  // being present (same guard as the id-drop block below) so it's a permanent no-op once
  // id no longer exists — legacy id=1 dashboard-stats row → cache_key 'dashboard_stats';
  // legacy 'google_rating_<contractorId>' rows → plain 'google_rating'.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_cache' AND column_name = 'id'
      ) THEN
        UPDATE admin_cache SET cache_key = 'dashboard_stats' WHERE id = 1 AND cache_key IS NULL;
        UPDATE admin_cache SET cache_key = 'google_rating' WHERE cache_key LIKE 'google\_rating\_%' ESCAPE '\';
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_cache' AND column_name = 'contractor_id' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE admin_cache ALTER COLUMN contractor_id SET NOT NULL;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_cache' AND column_name = 'cache_key' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE admin_cache ALTER COLUMN cache_key SET NOT NULL;
      END IF;
    END $$;
  `);
  // id-drop + composite-PK swap — guarded on the id column still being present, so this
  // runs exactly once. Verifies no duplicate (contractor_id, cache_key) pairs first.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_cache' AND column_name = 'id'
      ) THEN
        IF EXISTS (
          SELECT 1 FROM admin_cache GROUP BY contractor_id, cache_key HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'admin_cache composite-key migration aborted: duplicate (contractor_id, cache_key) pairs found.';
        END IF;
        ALTER TABLE admin_cache DROP CONSTRAINT admin_cache_pkey;
        ALTER TABLE admin_cache ADD PRIMARY KEY (contractor_id, cache_key);
        ALTER TABLE admin_cache DROP COLUMN id;
      END IF;
    END $$;
  `);

  // ── 2.2 announcement_settings (ST-1 Option A — contractor_id sole PK) ────────
  await pool.query(`ALTER TABLE announcement_settings ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)`);
  // Same reasoning as admin_cache above: only runs while backfill work remains.
  await pool.query(`
    DO $$
    DECLARE
      the_contractor_id TEXT;
      contractor_count INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM announcement_settings WHERE contractor_id IS NULL) THEN
        SELECT COUNT(*) INTO contractor_count FROM contractors;
        IF contractor_count <> 1 THEN
          RAISE EXCEPTION 'announcement_settings.contractor_id backfill aborted: expected exactly 1 contractors row, found %. This migration is only safe pre-contractor-#2 — investigate before re-running.', contractor_count;
        END IF;
        SELECT id INTO the_contractor_id FROM contractors LIMIT 1;
        UPDATE announcement_settings SET contractor_id = the_contractor_id WHERE contractor_id IS NULL;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'announcement_settings' AND column_name = 'contractor_id' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE announcement_settings ALTER COLUMN contractor_id SET NOT NULL;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'announcement_settings' AND column_name = 'id'
      ) THEN
        ALTER TABLE announcement_settings DROP CONSTRAINT announcement_settings_pkey;
        ALTER TABLE announcement_settings ADD PRIMARY KEY (contractor_id);
        ALTER TABLE announcement_settings DROP COLUMN id;
      END IF;
    END $$;
  `);

  // ── 2.3 cashout_requests (derived backfill — the house pattern for tenancy that is
  // derivable from ownership rather than a single-contractor assumption) ───────
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)`);
  await pool.query(`
    UPDATE cashout_requests cr SET contractor_id = u.contractor_id
    FROM users u WHERE cr.user_id = u.id AND cr.contractor_id IS NULL
  `);
  // One-time historical exception (ST session, Danny-confirmed 2026-07-13): 13
  // production rows have user_id NULL — Danny's own early manual test cashouts
  // (full_name "Daniel Scribbins"), created before any contractor besides the sole
  // seeded contractor existed. Not derivable via the user-ownership join above (there
  // is no user to derive from), so backfilled explicitly rather than via the general
  // derived-backfill pattern. Reads the contractor id dynamically (never hardcoded —
  // the dev tenant has been renamed before and may be again) via the same safe
  // "SELECT id FROM contractors LIMIT 1" pattern used by the seed-data block above.
  // This does NOT relax the orphan guard below for any other case — a future cashout
  // with an unresolvable owner (including any other NULL user_id row that isn't one of
  // these known historical rows) still fails closed.
  await pool.query(`
    DO $$
    DECLARE
      the_contractor_id TEXT;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM cashout_requests
        WHERE contractor_id IS NULL AND user_id IS NULL AND full_name = 'Daniel Scribbins'
      ) THEN
        SELECT id INTO the_contractor_id FROM contractors LIMIT 1;
        UPDATE cashout_requests SET contractor_id = the_contractor_id
        WHERE contractor_id IS NULL AND user_id IS NULL AND full_name = 'Daniel Scribbins';
      END IF;
    END $$;
  `);
  // Fail-closed orphan guard — a cashout whose owning user can't be resolved (user_id
  // NULL, or otherwise unmatched) must never silently default to a guessed contractor.
  await pool.query(`
    DO $$
    DECLARE
      orphan_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO orphan_count FROM cashout_requests WHERE contractor_id IS NULL;
      IF orphan_count > 0 THEN
        RAISE EXCEPTION 'cashout_requests.contractor_id backfill aborted: % row(s) have no resolvable owning user (contractor_id still NULL after derived backfill). Investigate before re-running — do not guess a value.', orphan_count;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashout_requests' AND column_name = 'contractor_id' AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE cashout_requests ALTER COLUMN contractor_id SET NOT NULL;
      END IF;
    END $$;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cashout_requests_contractor ON cashout_requests (contractor_id)`);

  // TEAM MEMBER INVITE TOKENS — single-use, time-limited tokens for the invite-link
  // flow. A new member is created with a locked password_hash; they set their real
  // password by following this link. 24-hour expiry (longer than PIN reset — the
  // invitee may not see the email immediately).
  await pool.query(`CREATE TABLE IF NOT EXISTS team_member_invite_tokens (
    id             SERIAL PRIMARY KEY,
    team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    token          TEXT NOT NULL UNIQUE,
    created_at     TIMESTAMP DEFAULT NOW(),
    expires_at     TIMESTAMP NOT NULL,
    used_at        TIMESTAMP
  )`);

  // ── C/DL-3a — USER PREFERENCES (shared user-level preference store) ─────────
  // See DECISION_C_DL_BUILD_SPEC.md CD-21. ONE store read by BOTH apps: the
  // referrer/client app (users) and the team/admin/field-rep side (team_members).
  // Deliberately NOT a team_members column — the client app must be able to read
  // the same store when its own light/dark toggle is built.
  //
  // PLACEMENT IS LOAD-BEARING, for the same reason as the C/DL-1 block above:
  // this table carries an FK to team_members, created at ~line 1178. It cannot
  // live beside contact_tags (~line 928), whose dual-nullable shape it copies —
  // on a fresh-database boot that would be a forward reference to a table that
  // does not exist yet.
  //
  // Shape follows contact_tags (two nullable id columns + CHECK + partial unique
  // indexes) with ONE deliberate divergence: contact_tags' CHECK is "at least
  // one", this one is EXACTLY ONE. A preference row naming two different subjects
  // has no coherent meaning, and the partial unique indexes below would not catch
  // it. Do not relax this to the contact_tags form.
  //
  // No migration guard, no backfill, no dirty-data hazard: the table is new, so
  // CREATE TABLE IF NOT EXISTS is idempotent by construction and there is no
  // pre-existing row anywhere in any legacy state.
  await pool.query(`CREATE TABLE IF NOT EXISTS user_preferences (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
    contractor_id  TEXT NOT NULL REFERENCES contractors(id),
    pref_key       TEXT NOT NULL,
    pref_value     JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_preferences_exactly_one_subject CHECK (
         (user_id IS NOT NULL AND team_member_id IS NULL)
      OR (user_id IS NULL     AND team_member_id IS NOT NULL)
    )
  )`);
  // Partial unique indexes — one preference per (subject, key). CREATE UNIQUE INDEX
  // IF NOT EXISTS rather than ADD CONSTRAINT: idempotent by construction, and it
  // cannot collide with its own backing index on re-run (the 42P07 hazard CLAUDE.md
  // documents for the ADD CONSTRAINT form).
  //
  // contractor_id is deliberately NOT a member of either index. The subject already
  // implies its tenant (users.contractor_id and team_members.contractor_id are both
  // NOT NULL), so adding it here would WEAKEN these into permitting a duplicate
  // (subject, key) pair under a second contractor id. These are also the ON CONFLICT
  // inference targets used by setPreference() in server/utils/userPreferences.js —
  // that upsert must repeat the WHERE predicate verbatim, since Postgres cannot
  // infer a partial index without it.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_key_unique
    ON user_preferences (user_id, pref_key)
    WHERE user_id IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_team_member_key_unique
    ON user_preferences (team_member_id, pref_key)
    WHERE team_member_id IS NOT NULL`);

  // TF-P0-2 (CRM_TOKEN_FIX_SPEC.md v1.0): this bootstrap read's return value is discarded
  // by every caller — server.js does `await initDB();` with no assignment — so it was
  // log-only. Replaced with a tenant-neutral startup log; the old single-row-keyed
  // read/return was a single-contractor relic with no consumer to break.
  const result = await pool.query('SELECT COUNT(*) AS n FROM tokens WHERE access_token IS NOT NULL');
  console.log(`${result.rows[0].n} contractor token(s) loaded`);
}

module.exports = { pool, initDB };
