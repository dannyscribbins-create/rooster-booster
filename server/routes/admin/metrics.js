const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { fetchPipelineForReferrer } = require('../../crm/jobber');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { logError } = require('../../middleware/errorLogger');
const { getPeriodDateRange } = require('../../utils/dateUtils');
const { getContractorOwedTotal } = require('../../utils/cashoutBalance');

// ── ADMIN: ACTIVITY LOG ───────────────────────────────────────────────────────
router.get('/api/admin/activity', requirePermission('activity'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const ALLOWED_CATEGORIES = ['user_action', 'admin_action'];
  const { category } = req.query;
  try {
    let queryText;
    let params;
    if (category && ALLOWED_CATEGORIES.includes(category)) {
      queryText = 'SELECT id, event_type, full_name, email, detail, created_at, category, contact_id FROM activity_log WHERE category = $1 ORDER BY created_at DESC LIMIT 100';
      params = [category];
    } else {
      queryText = 'SELECT id, event_type, full_name, email, detail, created_at, category, contact_id FROM activity_log ORDER BY created_at DESC LIMIT 100';
      params = [];
    }
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/activity' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: DASHBOARD STATS (cached 15 min) ────────────────────────────────────
router.get('/api/admin/stats', requirePermission('dashboard'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { refresh } = req.query;
  try {
    if (refresh !== 'true') {
      const cached = await pool.query(
        `SELECT stats, cached_at FROM admin_cache WHERE contractor_id = $1 AND cache_key = 'dashboard_stats'`,
        [contractorId]
      );
      if (cached.rows.length > 0) {
        const ageMin = (Date.now() - new Date(cached.rows[0].cached_at).getTime()) / 60000;
        if (ageMin < 15) return res.json({ ...cached.rows[0].stats, cachedAt: cached.rows[0].cached_at, fromCache: true });
      }
    }
    const usersResult = await pool.query('SELECT full_name FROM users');
    const allUsers = usersResult.rows;
    let totalReferrals=0, totalSold=0, totalNotSold=0, totalLeads=0, totalInspections=0, totalBalance=0, activeReferrers=0;
    const crmCheck = await pool.query(
      `SELECT is_connected FROM contractor_crm_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    if (!crmCheck.rows[0]?.is_connected) {
      return res.status(503).json({ error: 'crm_not_connected', message: 'No CRM is connected for this contractor. Please connect a CRM in admin settings.' });
    }
    for (const user of allUsers) {
      try {
        const data = await fetchPipelineForReferrer(user.full_name, contractorId);
        const p = data.pipeline;
        if (p.length > 0) activeReferrers++;
        totalReferrals   += p.length;
        totalSold        += p.filter(x => x.status==='sold').length;
        totalNotSold     += p.filter(x => x.status==='closed').length;
        totalLeads       += p.filter(x => x.status==='lead').length;
        totalInspections += p.filter(x => x.status==='inspection').length;
        // ⚠ `data.balance` IS DELIBERATELY NO LONGER SUMMED HERE — SEE BELOW. It is the
        // adapter's speculative `500 + boost` figure and subtracts NO cash-outs, so summing it
        // reported everything ever earned as still owed. The true total is computed from the
        // ledger after this loop.

      } catch(e) {
        await logError({ req, error: e });
        console.error(`Stats: failed for ${user.full_name}:`, e.message);
      }
    }
    // ── TOTAL BALANCE OWED — FROM THE LEDGER, VIA THE ONE SHARED DEFINITION ─────
    // ⚠ THIS REPLACED `totalBalance += data.balance` INSIDE THE LOOP ABOVE, WHICH SUBTRACTED
    // NO CASH-OUTS AT ALL. An admin reading "Total Balance Owed" was shown the sum of every
    // bonus ever earned across every referrer, including every dollar already paid out — a
    // number that can only ever grow. On this tenant it read $500 while the one referrer with
    // any history is at −$500 and nothing is owed to anybody.
    // ⚠ AND THE SQL IS NOT WRITTEN HERE. It was, for one revision, with a comment claiming it
    // was "scoped by contractor, not by user_id" and therefore not a second per-user formula —
    // and `server/test/cashoutBalanceSingleSource.test.js` flagged it immediately, correctly:
    // the subquery IS scoped by `user_id`. **The comment asserted something the code
    // contradicted, and the fence caught it before the gate did.** It lives in
    // server/utils/cashoutBalance.js with getCashoutBalance, which is where the one definition
    // of this arithmetic belongs.
    totalBalance = await getContractorOwedTotal(pool, contractorId);

    const paidRes    = await pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM cashout_requests WHERE status='approved' AND contractor_id=$1`, [contractorId]);
    const pendingRes = await pool.query(`SELECT COUNT(*) as count FROM cashout_requests WHERE status='pending' AND contractor_id=$1`, [contractorId]);
    const stats = {
      totalReferrers: allUsers.length, activeReferrers,
      totalReferrals, totalSold, totalNotSold, totalLeads, totalInspections,
      totalBalance, totalPaidOut: parseFloat(paidRes.rows[0].total),
      pendingCashouts: parseInt(pendingRes.rows[0].count),
    };
    await pool.query(
      `INSERT INTO admin_cache (contractor_id,cache_key,stats,cached_at) VALUES ($1,'dashboard_stats',$2,NOW())
       ON CONFLICT (contractor_id, cache_key) DO UPDATE SET stats=$2, cached_at=NOW()`,
      [contractorId, JSON.stringify(stats)]
    );
    res.json({ ...stats, cachedAt: new Date(), fromCache: false });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/stats' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
