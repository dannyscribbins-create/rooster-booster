'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RE-DECIDE ANY CLIENT WHOSE FACTS ARE NEWER THAN THEIR DECISION
//
// HOW TO RUN IT (from a machine with the Railway CLI):
//
//   railway ssh "node server/scripts/redecideStaleClients.js <contractor-id> [limit]"
//
// One required argument, the contractor id; an optional second, the cap (default 200). It refuses
// without the contractor id.
//
// ⚠ SAVED FACTS ONLY — NO JOBBER CALL. That is the ruling, and it is what makes this safe to re-run
// freely: it re-runs a pure derivation over rows already stored. A fence scans the job's source and
// fails if a Jobber fetcher or `axios` appears in it.
//
// ⚠ WHAT IT WRITES: `jobber_clients.pipeline_stage` (COALESCEd) and `stage_derived_at`, and — for a
// client that has a `pipeline_cache` row — the referrer-visible status through the SHARED
// `writeReferredStatus`. Nothing else. No conversion, no assignment, no flag, no tag.
//
// ⚠ IT IS SAFE TO RE-RUN AND EXPECTED TO BE RUN REPEATEDLY. The first runs are large because
// `stage_derived_at` is deliberately not backfilled (see `server/db.js`), so the summary reports how
// many clients remain beyond the limit and says ATTENTION rather than COMPLETE until that reaches 0.
//
// ⚠ SET BEFORE ANY require — dotenv v17 prints a tip line to STDOUT and `server/db.js` loads dotenv
// too, so a redirected run would otherwise carry two dotenv lines ahead of the output.
process.env.DOTENV_CONFIG_QUIET = 'true';

// ⚠ ROUTED THROUGH THE SHARED LOADER (test-env root fix). It resolved the SAME repo-root
// `.env` by an explicit path, so behaviour for an operator run is unchanged — but the decision
// about WHICH file a process may read now lives in exactly one place, and a run that happens to
// carry a test signal reads `.env.test` instead of real credentials. `DOTENV_CONFIG_QUIET` above
// still applies: dotenv reads it itself, whoever calls it.
const { loadEnv } = require('../utils/loadEnv');
loadEnv();

const { pool } = require('../db');
const { runRedecideStaleClients, formatSummary, DEFAULT_LIMIT } = require('../jobs/redecideStaleClients');

function usage(message) {
  process.stderr.write(`${message}\n\n`);
  process.stderr.write('usage: node server/scripts/redecideStaleClients.js <contractor-id> [limit]\n');
  process.stderr.write(`  re-decides every client whose facts are newer than their decision, from\n`);
  process.stderr.write(`  SAVED FACTS ONLY. No Jobber call. Default limit ${DEFAULT_LIMIT}.\n`);
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage('A contractor id is required.');
  if (args.length > 2) usage(`Expected at most two arguments, got ${args.length}: ${args.join(' ')}`);

  const contractorId = args[0];
  // ⚠ REFUSED RATHER THAN TREATED AS A FLAG, per captureReferredClients.js: a leading dash is far
  // likelier to be someone reaching for `--dry-run` than a real id, and accepting it would run the
  // real thing under a name that reads like a rehearsal.
  if (contractorId.startsWith('-')) usage(`This script takes no flags — got ${contractorId}`);

  let limit = DEFAULT_LIMIT;
  if (args.length === 2) {
    limit = Number(args[1]);
    if (!Number.isInteger(limit) || limit < 1) usage(`The limit must be a positive integer — got ${args[1]}`);
  }

  const { rows } = await pool.query('SELECT id FROM contractors WHERE id = $1', [contractorId]);
  if (rows.length === 0) usage(`No contractor with id ${contractorId}`);

  process.stderr.write(`[redecideStaleClients] starting for ${contractorId}, limit ${limit}\n`);

  const summary = await runRedecideStaleClients(pool, {
    contractorId,
    limit,
    onLine: (line) => process.stderr.write(`${line}\n`),
  });

  for (const line of formatSummary(summary)) process.stderr.write(`${line}\n`);

  // ⚠ NON-ZERO ON A FAILED CLIENT, so a wrapper can see it. Work REMAINING is not a failure — it is
  // the expected state of a bounded run — so it does not set a non-zero code, and the summary says
  // ATTENTION instead.
  if (summary.failed.length > 0) process.exitCode = 1;
}

// ⚠ AN ASYNC IIFE WITH try/catch/finally, NOT A `.then()` CHAIN — CLAUDE.md's *Never Break → Code
// Quality* forbids the chain, and `finally` is the only form that closes the pool on BOTH paths.
(async () => {
  try {
    await main();
  } catch (err) {
    process.stderr.write(`[redecideStaleClients] FAILED — ${err.message}\n`);
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
