'use strict';

// ── REGROUPING STORED SALES FOR THE CHAINED RULE (Danny, 2026-09-22) ─────────
//
// The grouping rule changed from ANCHORED (a job joins while it is within the window of
// the sale's FIRST job) to CHAINED (within the window of the sale's MOST RECENT job).
// Every writer now groups the new way, but `client_sales` rows are MATERIALISED — nothing
// regroups at read time — so the rows written under the old rule have to be rewritten.
//
// ⚠ NO JOBBER CALL, AND THE EXACTNESS ARGUMENT IS WHY THAT IS POSSIBLE. Chaining can only
// ever MERGE consecutive stored sales, never split one, as long as the window is not
// NARROWER than the one the rows were written with: inside an anchored sale every job sits
// within the window of the sale's first job, so consecutive jobs inside it are at most one
// window apart and the chained rule would have admitted all of them too. So the whole
// change is: merge a sale into the one before it when the gap from that sale's LAST job to
// this sale's FIRST job is within the window. The merged sale keeps the earlier anchor,
// the later last_event, and both job lists. Job dates are not needed and are not stored.
// ⚠ IF THE WINDOW IS EVER NARROWED, THIS IS THE WRONG TOOL — a narrower window can SPLIT a
// stored sale, and splitting needs each job's createdAt, which only Jobber has. ⚠ AND IT
// CANNOT DETECT THAT ITSELF: the window a row was written with is not stored, so there is
// nothing to compare the current setting against. This job only ever MERGES, so after a
// narrowing it would quietly leave over-merged sales in place. **Narrowing the window
// requires a re-page through `fetchAllClientJobs`, and that is not built.** Recorded on
// PRE_LAUNCH_CHECKLIST.md rather than guarded here, because the guard would need a column
// and this commit adds no schema.
//
// ⚠ NO MARKER COLUMN, AND NONE IS NEEDED — THIS COMMIT ADDS NO SCHEMA. The merge is
// idempotent by construction: once it has run, no two consecutive sales are within the
// window of each other, so a second run finds nothing to do. That is also why it is safe
// at every boot — after the first it is one indexed scan per contractor and a log line
// saying zero.
//
// ⚠ IT TOUCHES NO MONEY PATH. It rewrites client_sales / client_sale_jobs and nothing
// else; referral_conversions, cashouts and evaluateReferral() are not reachable from here.

const { pool } = require('../db');
const { windowDaysFor } = require('../utils/clientSales');
const { logError: realLogError } = require('../middleware/errorLogger');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Merge one client's stored sales under the chained rule.
 * Returns the number of sales REMOVED by merging (0 = already chained).
 *
 * One transaction per client: a half-merged client would show a sale whose jobs live on
 * another sale's row, which is a wrong conversion count rather than a missing one.
 *
 * ⚠ THE `FOR UPDATE` IS ABOUT THE WEBHOOKS, NOT ABOUT THIS JOB RACING ITSELF. A JOB_CREATE
 * arriving mid-run recomputes that one client with delete-then-insert; the lock makes the
 * two serialise. Either order is correct: the recompute rewrites the client from full
 * history under the chained rule, and a merge that then finds its rows gone updates
 * nothing.
 */
async function regroupClient(db, { contractorId, jobberClientId, windowMs }) {
  const tx = await db.connect();
  try {
    await tx.query('BEGIN');
    const { rows: sales } = await tx.query(
      `SELECT id, anchor_at, last_event_at FROM client_sales
        WHERE contractor_id = $1 AND jobber_client_id = $2
        ORDER BY anchor_at ASC, id ASC
        FOR UPDATE`,
      [contractorId, jobberClientId]
    );

    let merged = 0;
    let keeper = sales[0] || null;
    let keeperLast = keeper ? new Date(keeper.last_event_at).getTime() : 0;

    for (let i = 1; i < sales.length; i += 1) {
      const next = sales[i];
      const nextAnchor = new Date(next.anchor_at).getTime();
      if (nextAnchor - keeperLast <= windowMs) {
        // ⚠ MOVE THE JOBS FIRST, THEN DELETE. client_sale_jobs is ON DELETE CASCADE, so
        // deleting the absorbed sale first would take its job rows with it and the merged
        // sale would silently lose them — a sale whose job list shrank rather than grew.
        await tx.query(
          `UPDATE client_sale_jobs SET sale_id = $1 WHERE contractor_id = $2 AND sale_id = $3`,
          [keeper.id, contractorId, next.id]
        );
        await tx.query(`DELETE FROM client_sales WHERE id = $1`, [next.id]);
        const nextLast = new Date(next.last_event_at).getTime();
        if (nextLast > keeperLast) {
          keeperLast = nextLast;
          // The keeper now ends at the absorbed sale's last job. Written every time it
          // moves, so the row is correct even if a later client's merge fails.
          await tx.query(
            `UPDATE client_sales SET last_event_at = $1, updated_at = NOW() WHERE id = $2`,
            [new Date(keeperLast), keeper.id]
          );
        }
        merged += 1;
      } else {
        keeper = next;
        keeperLast = new Date(next.last_event_at).getTime();
      }
    }

    await tx.query('COMMIT');
    return merged;
  } catch (err) {
    try { await tx.query('ROLLBACK'); } catch { /* connection already unusable */ }
    throw err;
  } finally {
    tx.release();
  }
}

/**
 * Regroup every client of one contractor. Returns { clients, merged, failed, windowDays }.
 * `clients` counts clients whose sales CHANGED, not clients examined.
 */
async function regroupContractor(db, { contractorId, logError = realLogError }) {
  const windowDays = await windowDaysFor(db, contractorId);
  const windowMs = Number(windowDays) * DAY_MS;
  const totals = { clients: 0, merged: 0, failed: 0, windowDays };

  // Only clients that HAVE a mergeable pair, so a boot after the first costs one scan.
  const { rows } = await db.query(
    `SELECT DISTINCT jobber_client_id FROM (
       SELECT jobber_client_id, anchor_at,
              LAG(last_event_at) OVER (PARTITION BY jobber_client_id ORDER BY anchor_at) AS prev_last
         FROM client_sales WHERE contractor_id = $1
     ) g
     WHERE prev_last IS NOT NULL AND anchor_at - prev_last <= ($2 || ' days')::interval
     ORDER BY 1`,
    [contractorId, String(windowDays)]
  );

  for (const { jobber_client_id: jobberClientId } of rows) {
    try {
      const merged = await regroupClient(db, { contractorId, jobberClientId, windowMs });
      if (merged > 0) {
        totals.clients += 1;
        totals.merged += merged;
      }
    } catch (err) {
      totals.failed += 1;
      await logError({
        req: null,
        contractorId,
        error: new Error(`saleRegroupBackfill — client ${jobberClientId}: ${err.message}`),
        source: 'saleRegroupBackfill — client',
        alert: false,
      });
    }
  }
  return totals;
}

/**
 * Boot entry point: every contractor with stored sales.
 * Fire-and-forget from server.js — never throws.
 */
async function startSaleRegroupBackfill(db = pool, { logError = realLogError } = {}) {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT contractor_id FROM client_sales ORDER BY 1`
    );
    const results = [];
    for (const { contractor_id: contractorId } of rows) {
      const totals = await regroupContractor(db, { contractorId, logError });
      // diagnostic log — intentional
      console.log(`[saleRegroupBackfill] ${contractorId} — chained regroup at ${totals.windowDays} days: `
        + `${totals.clients} clients changed, ${totals.merged} sales merged away, ${totals.failed} failed`);
      results.push({ contractorId, ...totals });
    }
    return results;
  } catch (err) {
    await logError({ req: null, error: err, source: 'saleRegroupBackfill — scan', alert: false });
    return [];
  }
}

module.exports = { startSaleRegroupBackfill, regroupContractor, regroupClient };
