'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TARGETED RE-CAPTURE — facts plus the displayed stage, for a named list of clients
//
// HOW TO RUN IT (from a machine with the Railway CLI):
//
//   railway ssh "node server/scripts/recaptureClients.js <contractor-id> <client-id>[,<client-id>...]"
//
// Two arguments: the contractor id, then the client ids as ONE comma-separated list. It refuses
// without both. No flags, no "all clients" mode, no route.
//
// ⚠ NAMING THE CLIENTS IS THE CONFIRMATION STEP, and it is why there is no discovery mode. A
// script that worked out for itself which clients to re-capture would be a sweep, and a sweep that
// writes is the thing this repo gates behind a preview. Here the operator states the list.
//
// ⚠ WHAT IT WRITES: fact rows, and `jobber_clients.pipeline_stage` (COALESCEd, so a run that
// decides nothing leaves the stored stage standing) plus that row's `last_synced_at`. Nothing
// else — no `pipeline_status`, no `client_rep_assignments`, no `flagged_assignments`, no
// `referral_conversions`. `server/test/recaptureClients.test.js` scans this job's own source for
// every one of those write shapes and fails naming file and line.
//
// ⚠ IT REFUSES A CLIENT THAT HAS A `pipeline_cache` ROW. That client's referrer-visible status has
// exactly one owner, and writing the displayed stage alone would put the two surfaces out of step
// — the divergence the whole N4 arc exists to have closed. The job's header has the full reasoning.
//
// ⚠ IT IS SAFE TO RE-RUN. Every fact writer is an `INSERT ... ON CONFLICT DO UPDATE` keyed on the
// fact's own Jobber id and none deletes, so a second run re-upserts the same rows to the same
// values; only `captured_at` moves.
//
// ⚠ IT DOES CALL JOBBER — one `fetchFullClient` per admitted client, paged to exhaustion and paced
// against the cost figures Jobber returns. Read-only: the adapter issues queries, never mutations.
//
// ⚠ SET BEFORE ANY require, AND IT IS A CORRECTNESS FIX RATHER THAN TIDINESS. dotenv v17 prints a
// tip line to STDOUT and `server/db.js` calls `dotenv.config()` too, so a redirected run would
// otherwise carry two dotenv lines ahead of the output — the defect commit 7c's preview shipped
// past every assertion in its own suite.
process.env.DOTENV_CONFIG_QUIET = 'true';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../db');
const { getFreshContractorAccessToken } = require('../crm/jobber');
const { runRecaptureClients, formatSummary } = require('../jobs/recaptureClients');

function usage(message) {
  process.stderr.write(`${message}\n\n`);
  process.stderr.write('usage: node server/scripts/recaptureClients.js <contractor-id> <client-id>[,<client-id>...]\n');
  process.stderr.write('  re-captures facts for exactly the clients named, then re-decides each\n');
  process.stderr.write('  displayed stage from those facts, under the per-client lock.\n');
  process.stderr.write('  refuses a client that has a pipeline_cache row. safe to re-run. calls Jobber.\n');
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage('A contractor id and at least one client id are required.');
  if (args.length === 1) usage('At least one client id is required, as a comma-separated list.');
  if (args.length > 2) {
    usage(`Expected exactly two arguments — got ${args.length}. Pass the client ids as ONE comma-separated list, not as separate arguments.`);
  }

  const contractorId = args[0];
  // ⚠ REFUSED RATHER THAN TREATED AS A FLAG, for the reason captureReferredClients.js records: a
  // leading dash is far likelier to be someone reaching for `--dry-run` than a real id, and
  // accepting it would run the real thing under a name that reads like a rehearsal.
  if (contractorId.startsWith('-')) usage(`This script takes no flags — got ${contractorId}`);

  const clientIds = args[1].split(',').map(s => s.trim()).filter(Boolean);
  if (clientIds.length === 0) usage('The client id list is empty.');
  const duplicates = clientIds.filter((id, i) => clientIds.indexOf(id) !== i);
  if (duplicates.length > 0) usage(`Duplicate client ids in the list: ${[...new Set(duplicates)].join(', ')}`);

  const { rows } = await pool.query('SELECT id FROM contractors WHERE id = $1', [contractorId]);
  if (rows.length === 0) usage(`No contractor with id ${contractorId}`);

  process.stderr.write(`[recaptureClients] starting for ${contractorId} — ${clientIds.length} client(s) requested\n`);

  const summary = await runRecaptureClients(pool, {
    contractorId,
    clientIds,
    getToken: getFreshContractorAccessToken,
    onLine: (line) => process.stderr.write(`${line}\n`),
  });

  for (const line of formatSummary(summary)) process.stderr.write(`${line}\n`);

  // ⚠ A NON-ZERO EXIT ON ANY FAILED OR EXCLUDED CLIENT, so a wrapper can see it. A run that
  // captured 5 of 7 and exited 0 reads as a success to anything but a human reading the summary.
  if (summary.failed.length > 0 || summary.excluded.length > 0) process.exitCode = 1;
}

// ⚠ AN ASYNC IIFE WITH try/catch/finally, NOT A `.then()` CHAIN — CLAUDE.md's *Never Break →
// Code Quality* forbids the chain, and `finally` is also the only form that closes the pool on
// BOTH paths.
(async () => {
  try {
    await main();
  } catch (err) {
    process.stderr.write(`[recaptureClients] FAILED — ${err.message}\n`);
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
