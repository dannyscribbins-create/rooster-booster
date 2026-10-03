#!/usr/bin/env node
'use strict';

// ── PREVIEW THE ASSIGNMENT REBUILD — READ-ONLY (3d Phase 1a Commit 7c) ────────
//
// WHAT IT IS FOR. Danny's gate: no REP_ASSIGNMENT_REBUILD run against real data until a preview
// exists and its output has been reviewed. This is that preview. It also answers 7b's question —
// what choosing the rep from saved facts would do to every client, compared with who owns them
// now — because the replay already decides from saved facts, so the two are one computation.
//
// HOW TO RUN IT (from a machine with the Railway CLI):
//
//   railway ssh "node server/scripts/previewRebuild.js accent-roofing-dev" > preview.csv
//
// Totals and progress go to STDERR, so they appear on screen while the CSV lands in the file.
//
// ⚠ IT HAS NO APPLY MODE, NO FLAG THAT COULD ENABLE ONE, AND NO ROUTE (Danny, 2026-09-27).
// Applying remains the gated env-var rebuild. The read-only guarantee is not a promise in this
// comment: every statement goes through assignmentPreview's SELECT-only proxy, which throws on
// anything else, and the engine is driven through its `writers` seam with writers that only
// mutate memory. server/test/assignmentPreview.test.js proves both by injection.
//
// ⚠ AND IT MAKES NO JOBBER CALL. It reads the fact tables the full import stored; that is the
// whole reason a rebuild needs no re-import, and the reason a preview can be run safely at all.

// ⚠ SET BEFORE ANY require, AND IT IS A CORRECTNESS FIX RATHER THAN TIDINESS. dotenv v17 prints a
// tip line to **STDOUT**, and `server/db.js` calls `dotenv.config()` too — so an end-to-end run of
// this script put TWO dotenv lines at the top of the redirected file, ahead of the CSV header. The
// promise that STDOUT carries the CSV and nothing else was false, and only running it for real and
// reading the FILE showed that; every unit test in this arc writes the CSV through `toCsv()` and
// could never have seen it.
// ⚠ THE ENV VAR RATHER THAN `{ quiet: true }`, BECAUSE ONE OF THE TWO CALL SITES IS NOT MINE.
// Passing the option here would silence this file's own dotenv and leave db.js's line in the CSV;
// editing db.js would change what the SERVER logs on every boot, to fix a script. The variable
// reaches both without touching either contract.
process.env.DOTENV_CONFIG_QUIET = 'true';

// ⚠ ROUTED THROUGH THE SHARED LOADER (test-env root fix). It resolved the SAME repo-root
// `.env` by an explicit path, so behaviour for an operator run is unchanged — but the decision
// about WHICH file a process may read now lives in exactly one place, and a run that happens to
// carry a test signal reads `.env.test` instead of real credentials. `DOTENV_CONFIG_QUIET` above
// still applies: dotenv reads it itself, whoever calls it.
const { loadEnv } = require('../utils/loadEnv');
loadEnv();

const { pool } = require('../db');
const { previewAssignments, toCsv, selectOnlyDb } = require('../utils/assignmentPreview');

// ⚠ THE ARGUMENT IS THE CONFIRMATION STEP, EXACTLY AS IT IS FOR THE REBUILD ITSELF. There is
// deliberately no "all contractors" mode and no default: naming the contractor is what makes the
// run something the operator chose rather than something that happened.
function usage(message) {
  process.stderr.write(`${message}\n\n`);
  process.stderr.write('usage: node server/scripts/previewRebuild.js <contractor-id>\n');
  process.stderr.write('  reads only — writes nothing, calls no Jobber API, has no apply mode.\n');
  process.stderr.write('  CSV goes to STDOUT; totals and progress go to STDERR.\n');
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '');
  if (args.length === 0) usage('previewRebuild: a contractor id is required.');
  if (args.length > 1) usage(`previewRebuild: expected one contractor id, got ${args.length}.`);
  const contractorId = args[0];

  const startedAt = Date.now();
  process.stderr.write(`[previewRebuild] ${contractorId} — reading saved facts (no writes, no Jobber calls)\n`);

  // ⚠ THROUGH THE PROXY, NOT THE POOL, AND THAT IS NOT FUSSINESS. This is the script's only
  // statement of its own, and a bare `pool.query` here would be a hole in the very guarantee the
  // rest of the file rests on — one that the fence in assignmentPreview.test.js is written to
  // catch, because "the script issues no non-SELECT" must be true of the script too.
  const { rows: exists } = await selectOnlyDb(pool).query(
    'SELECT 1 FROM contractors WHERE id = $1', [contractorId]
  );
  if (exists.length === 0) usage(`previewRebuild: no such contractor: ${contractorId}`);

  const result = await previewAssignments(pool, {
    contractorId,
    onProgress: ({ done, total }) => {
      process.stderr.write(`[previewRebuild] ${done}/${total} clients\n`);
    },
  });

  // CSV first and alone on STDOUT, so a redirect captures exactly the file and nothing else.
  process.stdout.write(toCsv(result.rows));

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const { totals } = result;
  process.stderr.write('\n');
  process.stderr.write(`[previewRebuild] ${contractorId} — ${result.candidates} candidate clients in ${seconds}s\n`);
  process.stderr.write(`[previewRebuild]   unchanged ................ ${totals.unchanged}\n`);
  process.stderr.write(`[previewRebuild]   would change ............. ${totals.would_change}\n`);
  process.stderr.write(`[previewRebuild]   unassigned or flagged .... ${totals.unassigned_or_flagged}\n`);

  // ── THE DATE SUMMARY (3d Phase 1b Commit 6) ────────────────────────────────────
  // ⚠ IT IS HERE SO THE DATE-RESTORING RUN CAN BE JUDGED AT A GLANCE. The gate is "preview,
  // Danny's review, one run", and a review that needs 400 rows of spreadsheet scrolling to
  // find out whether anything alarming happened is a review that stops being done.
  // ⚠ DIRECTION IS PRINTED BESIDE MAGNITUDE BECAUSE DIRECTION IS THE TELL. The restoring run
  // moves dates BACKWARDS, from the rebuild day to each fact's own time, so `earlier` should
  // account for essentially all of the movement. A row moving LATER is not what this run is
  // for and is worth opening the CSV over.
  const d = result.dateTotals;
  process.stderr.write('[previewRebuild]   ── assigned_at ──\n');
  process.stderr.write(`[previewRebuild]   date would change ........ ${d.changed}\n`);
  process.stderr.write(`[previewRebuild]   date unchanged ........... ${d.unchanged}\n`);
  if (d.no_date_either_side > 0) {
    // ⚠ COUNTED SEPARATELY, NEVER FOLDED INTO "unchanged". A client with no date before and
    // none after has not kept its date; it has none, and hiding that inside a reassuring
    // number is how a population of lost rows goes unnoticed.
    process.stderr.write(`[previewRebuild]   no date either side ...... ${d.no_date_either_side}\n`);
  }
  process.stderr.write(`[previewRebuild]     moving EARLIER ......... ${d.earlier}\n`);
  process.stderr.write(`[previewRebuild]     moving LATER ........... ${d.later}`
    + `${d.later > 0 ? '   ⚠ not what the restoring run is for — check these' : ''}\n`);
  process.stderr.write(`[previewRebuild]     shift: same day ........ ${d.shift_same_day}\n`);
  process.stderr.write(`[previewRebuild]     shift: under 7 days .... ${d.shift_under_7_days}\n`);
  process.stderr.write(`[previewRebuild]     shift: 7–30 days ....... ${d.shift_7_to_30_days}\n`);
  process.stderr.write(`[previewRebuild]     shift: over 30 days .... ${d.shift_over_30_days}\n`);

  // ⚠ THE QUERY COUNT IS REPORTED BECAUSE THE RUN'S COST IS THE THING NOBODY CAN PREDICT FROM
  // HERE. It is also the only evidence in the output that the read cache did its job.
  process.stderr.write(`[previewRebuild]   queries issued ${result.stats.issued}, `
    + `served from cache ${result.stats.servedFromCache}\n`);
  if (result.mappedUserIds.length === 0) {
    process.stderr.write('[previewRebuild] ⚠ NO ATTRIBUTABLE REP IS MAPPED TO A JOBBER USER. The replay would '
      + 'visit nobody, so every existing assignment is spared and this preview is a no-op that says so.\n');
  }
}

// ⚠ AN ASYNC IIFE WITH try/catch/finally, NOT A `.then()` CHAIN — CLAUDE.md's *Never Break →
// Code Quality* forbids the chain, and `finally` is also the only form that closes the pool on
// BOTH paths. A chain's catch that ends the pool itself duplicates the teardown and can miss it.
(async () => {
  try {
    await main();
  } catch (err) {
    // ⚠ NOT logError(). It WRITES to error_log, and a read-only preview that logs is a preview
    // that writes — the SELECT-only proxy would refuse it anyway. An operator reads this console.
    process.stderr.write(`[previewRebuild] FAILED — ${err.message}\n`);
    process.stderr.write(`${err.stack}\n`);
    process.exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch {
      // Shutting down either way; a pool that will not close must not mask the real error above.
    }
  }
})();
