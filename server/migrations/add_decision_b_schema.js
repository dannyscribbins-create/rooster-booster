const steps = [
  // ── Piece 1: attribution_source column on contractor_crm_settings ────────────
  {
    name: 'contractor_crm_settings.attribution_source',
    sql: `ALTER TABLE contractor_crm_settings
          ADD COLUMN IF NOT EXISTS attribution_source TEXT NOT NULL DEFAULT 'assessment_assigned_users'`,
  },
  {
    name: 'contractor_crm_settings.attribution_source_check',
    sql: `DO $$ BEGIN
            ALTER TABLE contractor_crm_settings
              ADD CONSTRAINT contractor_crm_settings_attribution_source_check
              CHECK (attribution_source IN ('assessment_assigned_users', 'request_salesperson'));
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },

  // ── Piece 2: client_rep_assignments ──────────────────────────────────────────
  {
    name: 'client_rep_assignments.create',
    sql: `CREATE TABLE IF NOT EXISTS client_rep_assignments (
            id                  SERIAL PRIMARY KEY,
            contractor_id       TEXT NOT NULL,
            jobber_client_id    TEXT NOT NULL,
            provisional_rep_id  INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
            provisional_source  TEXT,
            provisional_set_at  TIMESTAMPTZ,
            sticky_rep_id       INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
            sticky_source       TEXT,
            sticky_set_at       TIMESTAMPTZ,
            flag_reason         TEXT,
            flag_resolved       BOOLEAN NOT NULL DEFAULT false,
            flag_resolved_at    TIMESTAMPTZ,
            flag_resolved_note  TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
  },
  {
    name: 'client_rep_assignments.provisional_source_check',
    sql: `DO $$ BEGIN
            ALTER TABLE client_rep_assignments
              ADD CONSTRAINT client_rep_assignments_provisional_source_check
              CHECK (provisional_source IN ('mode_a', 'mode_b', 'qr_link'));
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },
  {
    name: 'client_rep_assignments.sticky_source_check',
    sql: `DO $$ BEGIN
            ALTER TABLE client_rep_assignments
              ADD CONSTRAINT client_rep_assignments_sticky_source_check
              CHECK (sticky_source IN ('quote_salesperson', 'promoted_provisional'));
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },
  {
    name: 'client_rep_assignments.flag_reason_check',
    sql: `DO $$ BEGIN
            ALTER TABLE client_rep_assignments
              ADD CONSTRAINT client_rep_assignments_flag_reason_check
              CHECK (flag_reason IN ('orphan', 'rep_co_assignment'));
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },
  {
    name: 'client_rep_assignments.unique_contractor_client',
    sql: `DO $$ BEGIN
            ALTER TABLE client_rep_assignments
              ADD CONSTRAINT client_rep_assignments_unique_contractor_client
              UNIQUE (contractor_id, jobber_client_id);
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },

  // ── Piece 3: flagged_assignments ─────────────────────────────────────────────
  {
    name: 'flagged_assignments.create',
    sql: `CREATE TABLE IF NOT EXISTS flagged_assignments (
            id                       SERIAL PRIMARY KEY,
            contractor_id            TEXT NOT NULL,
            jobber_client_id         TEXT NOT NULL,
            flag_reason              TEXT NOT NULL,
            reps_involved            JSONB,
            triggering_quote_id      TEXT,
            triggering_assessment_id TEXT,
            reviewed                 BOOLEAN NOT NULL DEFAULT false,
            reviewed_at              TIMESTAMPTZ,
            review_note              TEXT,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
  },
  {
    name: 'flagged_assignments.flag_reason_check',
    sql: `DO $$ BEGIN
            ALTER TABLE flagged_assignments
              ADD CONSTRAINT flagged_assignments_flag_reason_check
              CHECK (flag_reason IN ('orphan', 'rep_co_assignment'));
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$`,
  },
];

async function addDecisionBSchema(pool) {
  if (!pool) throw new Error('addDecisionBSchema: pool is required');
  for (const step of steps) {
    try {
      await pool.query(step.sql);
      console.log(`✓ migration: ${step.name}`);
    } catch (err) {
      console.error(`✗ migration: ${step.name}: ${err.message}`);
    }
  }
  console.log('addDecisionBSchema migration complete');
}

module.exports = addDecisionBSchema;
