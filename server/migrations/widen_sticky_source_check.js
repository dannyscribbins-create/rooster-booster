// Widens client_rep_assignments.sticky_source to allow the two values written when the
// sticky gate falls through to Mode A/B at close (sold/paid) instead of immediately orphaning:
// 'mode_a_at_close' and 'mode_b_at_close'. See attributionEngine.js fallback chain.
async function widenStickySourceCheck(pool) {
  await pool.query(`
    ALTER TABLE client_rep_assignments
      DROP CONSTRAINT IF EXISTS client_rep_assignments_sticky_source_check
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE client_rep_assignments
        ADD CONSTRAINT client_rep_assignments_sticky_source_check
        CHECK (sticky_source IN ('quote_salesperson', 'promoted_provisional', 'mode_a_at_close', 'mode_b_at_close'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('✓ migration: client_rep_assignments.sticky_source_check (widened)');
}

module.exports = widenStickySourceCheck;
