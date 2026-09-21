'use strict';

// ── SALE GROUPING (Canvass-stage, Ruling 1 / Danny 2026-09-21) ───────────────
//
// Turns a client's jobs into SALES. Every job counts as a sale from its createdAt,
// and jobs close together in time are one sale rather than several.
//
// ⚠ THE ANCHOR IS **JOB CREATED**, RULED 2026-09-21. A sale begins when a job is
// created in Jobber — which is what the admin panel calls Sold and what
// classifyPipelineStatus already returns 'sold' for. The three candidate anchors
// disagreed (the admin UI's copy says invoices; the original description said the
// first approved quote or scheduled job; the classifier says a job exists) and the
// third won, so the count and the stage cannot drift apart.
// ⚠ **QUOTE_APPROVED IS THEREFORE NOT NEEDED AND IS NOT REGISTERED.** Approving a
// quote creates no job, so it starts no sale and moves no stage — the classifier
// reads only "a quote is not archived", which approval does not change. A handler
// for it would fire on an event that can change nothing.
//
// ⚠ AND THE WINDOW IS MEASURED FROM THE GROUP'S ANCHOR, NEVER FROM THE PREVIOUS JOB.
// This is the whole difference between "a sale" and "a chain". Measuring from the
// previous member lets a job every 19 days extend one sale forever, so a client who
// buys steadily for a year would show ONE conversion. Measuring from the anchor
// closes the group a fixed distance after it opened, which is what "jobs within the
// window of that first job" means and is how the ruling is worded.
//
// ⚠ IT IS A PURE FUNCTION ON PURPOSE. The grouping decision is the part most likely
// to be argued about and re-ruled, so it takes jobs and a number and returns groups —
// no database, no Jobber, no clock. Every discriminating test drives it directly.

// One day in ms, written out rather than imported: this file has no other constants
// and a shared "day" would be a dependency for arithmetic everybody can read.
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Group a client's jobs into sales.
 *
 * @param {Array<{id: string, createdAt: string|Date}>} jobs — any order; sorted here.
 * @param {number} windowDays — the contractor's invoice_window_days (default 20).
 * @returns {Array<{anchorAt: Date, lastEventAt: Date, jobIds: string[]}>} oldest first.
 */
function groupJobsIntoSales(jobs, windowDays) {
  const windowMs = Number(windowDays) * DAY_MS;
  // ⚠ NOT `|| 20`. A windowDays of 0 is a real (if odd) setting meaning "every job is
  // its own sale", and `||` would silently turn it into 20 — a value the contractor
  // did not choose, applied to their money. Only a genuinely unusable number falls
  // back, and it says so.
  const effectiveMs = Number.isFinite(windowMs) && windowMs >= 0 ? windowMs : 20 * DAY_MS;

  // ⚠ A JOB WITH NO createdAt IS DROPPED RATHER THAN ANCHORED AT THE EPOCH. It cannot
  // be placed in time, and defaulting it to 0 would open a spurious 1970 sale that
  // swallows nothing and counts as one — a conversion the contractor never made.
  const dated = jobs
    .filter((j) => j && j.id && j.createdAt)
    .map((j) => ({ id: j.id, ms: new Date(j.createdAt).getTime() }))
    .filter((j) => Number.isFinite(j.ms))
    .sort((a, b) => a.ms - b.ms);

  const groups = [];
  for (const job of dated) {
    const current = groups[groups.length - 1];
    if (current && job.ms - current.anchorMs <= effectiveMs) {
      current.jobIds.push(job.id);
      current.lastEventMs = job.ms;   // dated is ascending, so this is always the max
    } else {
      groups.push({ anchorMs: job.ms, lastEventMs: job.ms, jobIds: [job.id] });
    }
  }

  return groups.map((g) => ({
    anchorAt: new Date(g.anchorMs),
    lastEventAt: new Date(g.lastEventMs),
    jobIds: g.jobIds,
  }));
}

module.exports = { groupJobsIntoSales, DAY_MS };
