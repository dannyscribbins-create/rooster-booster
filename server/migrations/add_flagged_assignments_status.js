'use strict';

// Replaces flagged_assignments' boolean `reviewed` flag with a status lifecycle
// (open/resolved/dismissed/auto_resolved) so the FA queue can express dismiss/auto-resolve,
// which a boolean can't. Backfills status from reviewed and resolved_at from reviewed_at for
// any pre-existing rows, then drops both legacy columns — but only once every row is provably
// backfilled (no status IS NULL remains), so legacy data is never destroyed ahead of its copy.
// review_note is untouched: it isn't part of the boolean being replaced and keeps working as-is.
async function addFlaggedAssignmentsStatus(pool) {
  await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS status TEXT`);
  await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS resolution JSONB`);
  await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS resolved_by INTEGER`);
  await pool.query(`ALTER TABLE flagged_assignments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`);

  // Backfill + legacy-column drop fire only while the legacy `reviewed` column still exists —
  // a raw UPDATE referencing `reviewed`/`reviewed_at` would fail to even parse once those
  // columns are gone, so the guard must be an existence check, not just a "any NULL status
  // rows left" check. Permanently a no-op once `reviewed` is dropped.
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flagged_assignments' AND column_name = 'reviewed'
      ) THEN
        UPDATE flagged_assignments
        SET status = CASE WHEN reviewed THEN 'resolved' ELSE 'open' END,
            resolved_at = COALESCE(resolved_at, reviewed_at)
        WHERE status IS NULL;

        ALTER TABLE flagged_assignments DROP COLUMN IF EXISTS reviewed;
        ALTER TABLE flagged_assignments DROP COLUMN IF EXISTS reviewed_at;
      END IF;
    END $$;
  `);

  // Guarded fail-closed enforcement — only takes once backfill has resolved every row, so a
  // mid-migration crash never leaves the table half backfilled and half rejected.
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM flagged_assignments WHERE status IS NULL) THEN
        ALTER TABLE flagged_assignments ALTER COLUMN status SET NOT NULL;
        ALTER TABLE flagged_assignments ALTER COLUMN status SET DEFAULT 'open';
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE flagged_assignments
        ADD CONSTRAINT flagged_assignments_status_check
        CHECK (status IN ('open', 'resolved', 'dismissed', 'auto_resolved'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS flagged_assignments_contractor_status_idx
      ON flagged_assignments (contractor_id, status)
  `);

  console.log('✓ migration: flagged_assignments.status (reviewed boolean → status lifecycle)');
}

module.exports = addFlaggedAssignmentsStatus;
