'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE TEST-ENVIRONMENT ROOT FIX — A TEST PROCESS NEVER LOADS THE REAL `.env`
//
// Danny's ruling: tests never load the real `.env`, so no real credential — Jobber, Stripe, Resend,
// the database, or anything else — is present during a test run.
//
// ⚠ THE LEAK WAS ONE LINE AND EVERYTHING WENT THROUGH IT. `server/db.js` opened with
// `require('dotenv').config()` — no path, so dotenv resolves `.env` from the CURRENT WORKING
// DIRECTORY, which during a test run is the repo root. Virtually every module requires `db.js`, so
// the real `.env` was loaded the moment any suite touched the database layer. Measured on this
// machine: six variables exist only in the real `.env`, and **all six reached a suite that does not
// require `./setup`** — three of them credential-shaped by name. A suite that DOES require `setup.js`
// leaked four of the six, because that file pins the other two itself.
// ⚠ FOUR IS THE NUMBER I FIRST REPORTED, AND IT WAS THE FLATTERING HALF OF THE ANSWER. It was
// measured through `setup.js`, which is not the path the exposed files take — see the note on
// `TEST_CREDENTIAL_STUBS`, which is where the six made themselves known.
//
// ⚠ dotenv DOES NOT OVERRIDE, WHICH IS WHY THE DAMAGE WAS SELECTIVE AND THEREFORE EASY TO MISS.
// `.env.test` is loaded first with `override: true`, so DATABASE_URL, NODE_ENV and ENCRYPTION_KEY
// were safe — and every variable `.env.test` does NOT define was filled in from the real file. The
// three safe ones are exactly the three anyone would check.
//
// ⚠ AND `setup.js` SAID SO IN TERMS: *"Only `RESEND_API_KEY` is pinned; every other credential in
// `.env` still leaks."* 7d-0 closed the Resend half with an interlock because the root fix was out
// of scope for a feature commit. This is the root fix.
//
// ── WHY NOT `NODE_ENV === 'test'` ────────────────────────────────────────────
//
// ⚠ BECAUSE IT FAILS OPEN, AND THAT IS THE WRONG DIRECTION FOR A CREDENTIAL GUARD. `npm run
// test:server` is `node --test --test-concurrency=1 server/test/*.test.js` with **no `cross-env`**,
// so `NODE_ENV` is undefined when a child process starts; it only becomes `'test'` once a suite
// requires `./setup`, which loads `.env.test`. **Measured: 17 of this suite's files never require
// `./setup` at all**, and Node's runner gives each FILE its own process — so for those files a
// NODE_ENV-keyed guard would be absent exactly when it was needed, and silently.
//
// ⚠ `NODE_TEST_CONTEXT` IS SET BY THE RUNNER ITSELF, BEFORE ANY REPO FILE IS LOADED. Measured under
// the real script: `"child-v8"`, with `NODE_ENV` undefined beside it. It cannot depend on require
// order, cannot be forgotten by a new suite, and does not need a `cross-env` someone might drop.
//
// ── WHY THE SIGNALS ARE OR-ED ────────────────────────────────────────────────
//
// ⚠ ANY ONE OF THEM MEANS "TEST", SO THE GUARD FAILS CLOSED. A false positive refuses the real
// `.env`; a false negative hands a test process a live credential. Those are not symmetric, so the
// loose direction is chosen deliberately.
// ⚠ AND A FALSE POSITIVE IS HARMLESS IN PRODUCTION ANYWAY, WHICH IS MEASURED RATHER THAN HOPED:
// there is no `.env` file in the deployed container at all (verified over SSH — `/app/.env` does not
// exist), because Railway injects environment variables into the process directly. So
// `dotenv.config()` has always been a no-op there and this branch cannot change what production
// reads.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('node:path');

/** The file a non-test process loads. Named so the canary can assert against it. */
const REAL_ENV_FILE = '.env';
/** The file a test process loads instead. */
const TEST_ENV_FILE = '.env.test';

/**
 * Is this process a test process?
 * Output: boolean.
 *
 * ⚠ READ THE THREE SIGNALS IN THIS ORDER OF TRUSTWORTHINESS, and keep all three:
 *   1. `NODE_TEST_CONTEXT` — set by `node --test` in every child, before any repo file loads.
 *   2. `VITEST` — the same guarantee from the React runner.
 *   3. `NODE_ENV === 'test'` — the explicit, conventional signal, which a `cross-env` invocation or
 *      `.env.test` supplies. ⚠ **Kept LAST and never alone**: it is the one that was absent for 17
 *      files, and relying on it was the design this module exists to reject.
 */
function isTestProcess() {
  return process.env.NODE_TEST_CONTEXT !== undefined
    || process.env.VITEST !== undefined
    || process.env.NODE_ENV === 'test';
}

/**
 * Test-shaped stand-ins for credentials the code needs in order to LOAD AT ALL.
 *
 * ⚠ THIS EXISTS BECAUSE CLOSING THE LEAK TURNED A CREDENTIAL HAZARD INTO SIX MODULE-LOAD FAILURES,
 * AND THE MEASUREMENT IS THE WHOLE JUSTIFICATION FOR THE COMMIT. `server/middleware/errorLogger.js`
 * constructs `new Resend(process.env.RESEND_API_KEY)` at module scope, and Resend's constructor
 * THROWS on a falsy key. Six suites — `campaignEmailEscaping`, `captureFetchContract`,
 * `emailUrlSafety`, `errorLogger`, `landingSocialFooter`, `landingStepCopy` — reach that module and do
 * NOT require `./setup`, so nothing pinned the key for them. **Measured: the gate fell from
 * 2567 tests / 432 suites to 2396 / 417 — 171 tests and 15 suites that were loading only because a
 * real production Resend key was present in the test process.** They did not fail; they could not be
 * imported.
 *
 * ⚠ AND THAT CORRECTS A FIGURE I REPORTED EARLIER. The leak was measured THROUGH `setup.js`, which
 * pins `JOBBER_CLIENT_SECRET` and `RESEND_API_KEY` itself, so those two read as "pinned, not leaked"
 * and the leak came out as FOUR. That is true of a suite which requires `setup.js` and false as a
 * statement about the suite as a whole: **for the 17 files that never require it the leaked set is all
 * SIX exclusive names, including both credentials.** The smaller number was the flattering one.
 *
 * ⚠ WHY HERE AND NOT IN `.env.test`: THAT FILE IS GITIGNORED. Adding the key there would fix this
 * machine and leave a fresh clone, CI, or any other developer with six unloadable suites — a commit
 * that cannot reproduce its own green. This file is committed, and it runs before anything else
 * regardless of require order, which `setup.js` demonstrably cannot claim.
 *
 * ⚠ EVERY VALUE IS DELIBERATELY UNUSABLE RATHER THAN MERELY FAKE. None is well-formed for its
 * service — the Resend stub does not begin `re_` — so a call that escaped the 7d-0 interlock would be
 * REFUSED by the provider rather than quietly succeeding. A plausible-looking dummy is the worse
 * choice: it fails in a way that looks like a real failure.
 */
const TEST_CREDENTIAL_STUBS = {
  RESEND_API_KEY: 'STUB-tests-may-not-send-email',
  JOBBER_CLIENT_ID: 'STUB-tests-may-not-reach-jobber',
  JOBBER_CLIENT_SECRET: 'STUB-tests-may-not-reach-jobber',
  GOOGLE_PLACES_API_KEY: 'STUB-tests-may-not-reach-google',
  REDIRECT_URI: 'http://localhost:0/stub-tests-may-not-redirect',
};

/**
 * Which env file this process would load. PURE — it reads nothing and sets nothing.
 * Output: `.env` or `.env.test`.
 *
 * ⚠ IT EXISTS SO A TEST CAN ASSERT THE DECISION WITHOUT TAKING IT, AND THAT IS NOT A STYLE
 * PREFERENCE. The canary needs to prove that a process with no test signal chooses the REAL file —
 * and calling `loadEnv()` to find that out would have loaded the real `.env` into the canary's own
 * process, reddening the very leak assertion two describes later. **An observation that changes the
 * thing observed is not available to this test**, so the decision is separable from the load.
 */
function chosenEnvFile() {
  return isTestProcess() ? TEST_ENV_FILE : REAL_ENV_FILE;
}

/**
 * Load environment variables for this process, from the correct file.
 * Output: { file, isTest } — what was loaded, so a caller or a test can assert on the decision
 * rather than infer it from which variables happen to be present.
 *
 * ⚠ IT RESOLVES THE PATH FROM THIS FILE RATHER THAN FROM `process.cwd()`. The leak depended on
 * dotenv's cwd-relative default, and a script run from a sub-directory would otherwise silently load
 * nothing — which reads exactly like a missing credential.
 *
 * ⚠ NO `override`. A variable already set — by the shell, by Railway, or by `setup.js`'s own pins —
 * must win over any file. `setup.js` pins `JOBBER_CLIENT_SECRET` and `RESEND_API_KEY` before
 * anything requires this, and overriding would undo the 7d-0 interlock.
 */
function loadEnv() {
  const isTest = isTestProcess();
  const file = chosenEnvFile();
  require('dotenv').config({ path: path.join(__dirname, '..', '..', file) });

  // ⚠ STUBS ARE APPLIED ONLY IN A TEST PROCESS, AND ONLY WHERE NOTHING HAS SET THE VARIABLE.
  // `setup.js` sets its own `RESEND_API_KEY` and `JOBBER_CLIENT_SECRET` and its interlock probe is
  // built from its own constant, so it must keep winning; so must the shell, and so must Railway.
  // **Never `override`** — that would undo the 7d-0 interlock from underneath it.
  const stubbed = [];
  if (isTest) {
    for (const [key, value] of Object.entries(TEST_CREDENTIAL_STUBS)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        stubbed.push(key);
      }
    }
  }
  return { file, isTest, stubbed };
}

module.exports = {
  loadEnv, isTestProcess, chosenEnvFile, REAL_ENV_FILE, TEST_ENV_FILE,
  // NAMES only. The canary asserts the stub values are disjoint from the real ones; it has no
  // business reading the stub values themselves, and nothing outside this module should set them.
  TEST_CREDENTIAL_STUB_NAMES: Object.keys(TEST_CREDENTIAL_STUBS),
};
