'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// A HAND-RUN SCRIPT THAT SEEDS TEST DATA REFUSES TO RUN AGAINST A REMOTE DATABASE
//
// Danny's ruling: a hand-run script that writes to a database must refuse unless its
// `DATABASE_URL` is local, mirroring `server/test/setup.js`'s check, with a clear message.
//
// ⚠ THE SCRIPT THIS EXISTS FOR IS `server/scripts/seedTestTeamMember.js`, AND THE REASON IS ITS
// NAME. It seeds a TEST team member — a row with a known PIN — and it takes no argument naming an
// environment. Run from a terminal it carries no test signal, so `loadEnv()` correctly hands it the
// real `.env`, and the real `.env` points at **production**. So the one script whose name promises a
// test fixture was the one most likely to write that fixture into the live database.
//
// ⚠ AND THE GUARD BELONGS HERE RATHER THAN IN THE SCRIPT BECAUSE A GUARD WITH NO TEST IS A CLAIM.
// Inline, its only proof would be spawning the seeder — and the LOCAL direction of that proof
// would really insert a row. As a pure function both directions are checkable without writing
// anything, and the script's own refusal is still proven by spawning it with a remote URL.
//
// ── WHAT IS DELIBERATELY *NOT* GUARDED, BECAUSE IT WOULD BREAK THE TOOL ──────
//
// ⚠ THE THREE OPERATOR SCRIPTS EXIST TO RUN AGAINST PRODUCTION AND MUST NOT CALL THIS.
// `captureReferredClients.js`, `recaptureClients.js` and `redecideStaleClients.js` write to the
// live database **on purpose** — that is the whole job — so a localhost gate would not make them
// safer, it would make them useless. Each already refuses without an explicit contractor id, which
// is the opt-in that fits a production tool. `previewRebuild.js` is read-only by design, and
// `server/utils/backup.js` is the production backup and writes nothing to the database.
// ⚠ **Reading "every hand-run script that writes to a database" as "all of them" would have
// disabled three working operator tools under a commit message about safety.** The distinction is
// what the script is FOR, not whether it writes.
//
// ⚠ AND TWO OTHER COPIES OF THIS CHECK ARE LEFT ALONE, SAID RATHER THAN QUIETLY DUPLICATED.
// `server/test/setup.js` carries its own, which must run before anything else loads and whose
// message the test suite depends on; `scripts/seedLocalStack.js` carries its own, already modelled
// on setup.js and already working. **Rewriting either to route through this file would risk a live
// interlock for a tidiness gain**, so consolidation is filed rather than taken here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this connection string pointed at a database on this machine?
 * Input: a Postgres connection string, or any string.
 * Output: boolean — true only for localhost / 127.0.0.1.
 *
 * ⚠ IT PARSES THE URL RATHER THAN SUBSTRING-MATCHING, and that is not fastidiousness: a remote host
 * can CONTAIN the word localhost (`localhost.db.example.com`, or a password that happens to spell
 * it), and a substring check would admit it. This repo's own record of the substring trap is why.
 * ⚠ AN UNPARSEABLE STRING IS **NOT** LOCAL. The guard fails CLOSED — refusing a valid-but-odd URL
 * costs a confused operator one message, while admitting one writes test rows into production.
 */
function isLocalDatabaseUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Refuse to continue unless `DATABASE_URL` is local.
 * Inputs: the connection string, and the script's name for the message.
 * Output: nothing on success; THROWS with an operator-readable message otherwise.
 *
 * ⚠ IT THROWS RATHER THAN CALLING `process.exit`, so it is testable and so a caller cannot
 * accidentally swallow it into an exit code nobody reads. The scripts let it escape.
 */
function assertLocalDatabase(url, scriptName) {
  if (isLocalDatabaseUrl(url)) return;

  // ⚠ THE HOST IS NAMED AND THE URL IS NOT. A connection string carries the password, and a refusal
  // message is exactly the kind of line that gets pasted into a chat or a bug report.
  let where = 'unset';
  if (typeof url === 'string' && url.length > 0) {
    try {
      where = `host "${new URL(url).hostname}"`;
    } catch {
      where = 'a connection string that could not be parsed';
    }
  }

  throw new Error(
    `\n\n*** REFUSING TO RUN ***\n`
    + `${scriptName} seeds TEST data and may only run against a local database.\n`
    + `DATABASE_URL points at ${where}.\n\n`
    + `This script takes no environment argument, so run by hand it loads the real .env — which\n`
    + `points at PRODUCTION. Seeding a test fixture there is what this guard exists to prevent.\n\n`
    + `To run it locally, point DATABASE_URL at localhost or 127.0.0.1 (the value in .env.test):\n`
    + `  DATABASE_URL=<your .env.test value> node ${scriptName}\n\n`
    + `ABORTING before any query is issued.\n`
  );
}

module.exports = { isLocalDatabaseUrl, assertLocalDatabase };
