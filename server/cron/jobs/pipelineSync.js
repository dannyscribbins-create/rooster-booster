const cron = require('node-cron');
const { withLock } = require('../withLock');
const { runScheduledSync } = require('../../crm/pipelineSync');

function register() {
  // Every 30 minutes
  // ⚠ THE EXPIRY IS 25 MINUTES, NOT 10, AND THE OLD VALUE WAS SHORTER THAN THE TICK BY DESIGN
  // ACCIDENT (7a-3). At 10 minutes on a 30-minute tick, a sweep still running at T+10 had a
  // takeable lock, so the T+30 tick started a SECOND sweep while the first was working — and the
  // first then cleared the row, releasing the second's lock. See server/cron/withLock.js.
  //
  // ⚠ 25 IS CHOSEN TO SIT JUST UNDER THE TICK, AND THAT IS THE ONLY PRINCIPLE AVAILABLE.
  // Under the tick, a CRASHED holder is recovered by the very next tick — one skipped cycle, not
  // two. Above the tick, a dead holder would block a cycle for no benefit.
  // ⚠ AND IT IS NOT DERIVED FROM A MEASURED SWEEP, BECAUSE NO HEALTHY SWEEP EXISTS IN THE LOGS.
  // Every run in the retained Railway window (2026-09-26, from 06:00) aborts on a Jobber 401 in
  // under 1.3s — 20 of them — so the observed durations measure a failing sweep, not a working
  // one. The realistic worst case is structural rather than observed: a CATCH-UP sweep after an
  // outage covers everything updated since last_synced_at, serially, with an attribution Jobber
  // call per client, and is unbounded in principle. 25 minutes reduces how often a takeover
  // happens; the OWNER CHECK in withLock is what makes one safe. Re-derive this from a real
  // sweep's duration once one exists in the logs.
  cron.schedule('0 */30 * * * *', () => {
    withLock('pipeline_sync', 25, async () => {
      await runScheduledSync();
    });
  });
  console.log('[cron] pipeline_sync registered (every 30 min)');
}

module.exports = { register };
