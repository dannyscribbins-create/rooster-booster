'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 4 — CAPTURE FACTS FOR EVERY REFERRED CLIENT (Danny ruling 8, 2026-09-29)
//
// HOW TO RUN IT (from a machine with the Railway CLI):
//
//   railway ssh "node server/scripts/captureReferredClients.js accent-roofing-dev"
//
// One argument, the contractor id. No flags. It refuses without one.
//
// ⚠ IT WRITES FACTS AND NOTHING ELSE — no `pipeline_stage`, no `pipeline_status`, no
// `client_rep_assignments`, no `flagged_assignments`, no `referral_conversions`. It does not
// even call `decideFromFacts`. That guarantee is not a promise in this comment:
// `server/test/referredCaptureBackfill.test.js` scans the job's own source for every one of
// those write shapes and fails naming file and line, and a guard-proof adds one to prove the
// fence fires.
//
// ⚠ IT IS SAFE TO RE-RUN. Every fact writer is an `INSERT ... ON CONFLICT DO UPDATE` keyed on
// the fact's own Jobber id and none of them deletes, so a second run re-upserts the same rows to
// the same values. There is no cursor and no watermark to corrupt.
//
// ⚠ IT DOES CALL JOBBER, unlike `previewRebuild.js`. One `fetchFullClient` per admitted client,
// paged to exhaustion, paced against the cost figures Jobber returns. Expect roughly one call
// per client plus one per extra page on any connection over 20 items.
//
// ⚠ SET BEFORE ANY require, AND IT IS A CORRECTNESS FIX RATHER THAN TIDINESS. dotenv v17 prints
// a tip line to STDOUT and `server/db.js` calls `dotenv.config()` too, so a redirected run would
// otherwise carry two dotenv lines ahead of the output. The env var reaches both call sites
// without editing either contract — the same reasoning previewRebuild.js records.
process.env.DOTENV_CONFIG_QUIET = 'true';

// ⚠ ROUTED THROUGH THE SHARED LOADER (test-env root fix). It resolved the SAME repo-root
// `.env` by an explicit path, so behaviour for an operator run is unchanged — but the decision
// about WHICH file a process may read now lives in exactly one place, and a run that happens to
// carry a test signal reads `.env.test` instead of real credentials. `DOTENV_CONFIG_QUIET` above
// still applies: dotenv reads it itself, whoever calls it.
const { loadEnv } = require('../utils/loadEnv');
loadEnv();

const { pool } = require('../db');
const { getFreshContractorAccessToken } = require('../crm/jobber');
const { runReferredCaptureBackfill, formatSummary } = require('../jobs/referredCaptureBackfill');

// ⚠ THE ARGUMENT IS THE CONFIRMATION STEP. There is deliberately no "all contractors" mode and
// no default: naming the contractor is what makes the run something the operator chose rather
// than something that happened. Same reasoning as previewRebuild.js and as the gated rebuild.
function usage(message) {
  process.stderr.write(`${message}\n\n`);
  process.stderr.write('usage: node server/scripts/captureReferredClients.js <contractor-id>\n');
  process.stderr.write('  captures facts for every pipeline_cache client of that contractor.\n');
  process.stderr.write('  writes FACTS ONLY — never a stage, a status, an assignment or a conversion.\n');
  process.stderr.write('  safe to re-run. calls Jobber. no flags, no apply mode, no route.\n');
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage('A contractor id is required.');
  if (args.length > 1) usage(`Expected exactly one argument, got ${args.length}: ${args.join(' ')}`);
  const contractorId = args[0];
  // ⚠ REFUSED RATHER THAN TREATED AS A FLAG. A leading dash is far more likely to be someone
  // reaching for `--dry-run` than a contractor whose id starts with one, and silently accepting
  // it would run the real thing under a name that reads like a rehearsal.
  if (contractorId.startsWith('-')) usage(`This script takes no flags — got ${contractorId}`);

  const { rows } = await pool.query('SELECT id FROM contractors WHERE id = $1', [contractorId]);
  if (rows.length === 0) usage(`No contractor with id ${contractorId}`);

  process.stderr.write(`[captureReferredClients] starting for ${contractorId}\n`);

  const summary = await runReferredCaptureBackfill(pool, {
    contractorId,
    getToken: getFreshContractorAccessToken,
    onLine: (line) => process.stderr.write(`${line}\n`),
  });

  for (const line of formatSummary(summary)) process.stderr.write(`${line}\n`);

  // ⚠ A NON-ZERO EXIT ON A FAILED CLIENT, SO A WRAPPER CAN SEE IT. A run that captured 12 of 16
  // and exited 0 reads as a success to anything but a human reading the summary.
  if (summary.failed.length > 0) process.exitCode = 1;
}

// ⚠ AN ASYNC IIFE WITH try/catch/finally, NOT A `.then()` CHAIN — CLAUDE.md's *Never Break →
// Code Quality* forbids the chain, and `finally` is also the only form that closes the pool on
// BOTH paths.
(async () => {
  try {
    await main();
  } catch (err) {
    process.stderr.write(`[captureReferredClients] FAILED — ${err.message}\n`);
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
