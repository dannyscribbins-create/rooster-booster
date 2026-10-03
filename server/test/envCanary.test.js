'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE CANARY — NO REAL CREDENTIAL IS PRESENT DURING A TEST RUN
//
// Danny's ruling: tests never load the real `.env`, so no real credential — Jobber, Stripe, Resend,
// the database, or any other — reaches a test process.
//
// ⚠ IT DELIBERATELY DOES NOT REQUIRE `./setup`, AND THAT IS THE POINT RATHER THAN AN OVERSIGHT.
// 17 files in this suite never require it, Node's runner gives each FILE its own process, and the
// defect being fenced is one that appears in exactly those files. A canary that loaded the test
// harness first would be testing the harness, not the guarantee.
//
// ⚠ AMENDED 2026-10-03: `setup.js` IS NOW LOADED FOR THIS FILE, BY THE RUNNER, AND THE SENTENCE ABOVE
// IS KEPT BECAUSE IT IS STILL TRUE OF WHAT THIS FILE DOES — it still does not require `./setup`. What
// changed is that `npm run test:server` preloads it via `--require`, so "never require it" no longer
// implies "runs without it". **Read the paragraph above as a statement about this file, not about the
// environment it runs in.**
// ⚠ AND THE CASES BELOW STILL MEASURE WHAT THEY CLAIM, CHECKED RATHER THAN ASSUMED. The leak case
// compares each exclusive name's VALUE against the real `.env`, and `setup.js` sets its own test
// values — so its pins read as pins, not as leaks, which is exactly why the name-only version of this
// assertion had to become a value comparison. The *"recognised WITHOUT NODE_ENV"* case asserts
// `isTestProcess()` and the presence of `NODE_TEST_CONTEXT`; it never asserted `NODE_ENV` was unset,
// so the preload setting it changes nothing there. ⚠ **Its NAME is now a poor description of its
// environment though, and that is said rather than left to mislead**: the runner's signal is what it
// pins, and `NODE_ENV` happens also to be present now.
//
// ⚠ AND IT IS IN TWO HALVES BECAUSE THE OBVIOUS ONE GOES VACUOUS OFF THIS MACHINE.
//   · The REAL-`.env` half can only run where that file exists. On CI, on a fresh clone, or in the
//     deployed container there is no `.env` at all — so on its own this canary would pass by having
//     nothing to look for, which is this repo's most-recorded defect shape.
//   · The SENTINEL half plants its own `.env` in a temp directory and runs a CHILD PROCESS there.
//     It needs no real credential, works everywhere, and exercises the actual mechanism — dotenv's
//     cwd-relative default, which is what the leak was.
// **Neither half is sufficient; the pair is what makes the claim checkable anywhere.**
//
// ⚠ NO VALUE IS EVER READ, COMPARED OR PRINTED. The assertions are on variable NAMES and on a
// sentinel this file invents. A test that echoed a credential to make its point would be a worse
// leak than the one it closes.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SERVER_ROOT = path.join(__dirname, '..');

const {
  isTestProcess, chosenEnvFile, REAL_ENV_FILE, TEST_ENV_FILE,
} = require('../utils/loadEnv');

/** Variable NAMES declared in an env file. Values are never read. */
function keyNamesOf(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath, 'utf8').split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.indexOf('=') > 0)
    .map((l) => l.slice(0, l.indexOf('=')).trim());
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

/**
 * The fence's needle, declared ONCE.
 *
 * ⚠ IT WAS WRITTEN TWICE UNTIL A GUARD-PROOF WAS DESIGNED AGAINST IT, AND THAT IS THE ENTRY WORTH
 * KEEPING. The fence below and its non-vacuity floor each carried their own copy of this pattern —
 * so pointing the FENCE's copy at a name that matches nothing would have left the floor matching its
 * own separate copy and **both cases green**. A floor that re-spells the needle it is meant to
 * validate proves only that a needle of that shape can match something, which is this repo's
 * recorded *"a floor built from the NEEDLE's shape rather than from the DEFECT's shape only confirms
 * the needle matches itself"*. One constant is what makes the floor load-bearing.
 */
const DOTENV_REQUIRE = /require\(\s*['"]dotenv['"]\s*\)/;

/** Every .js under server/, excluding the test directory. */
function serverFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'test' || e.name === 'node_modules') continue;
        walk(path.join(dir, e.name));
        continue;
      }
      if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
    }
  };
  walk(SERVER_ROOT);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('THE CANARY — this process is a test process and knows it', () => {
  it('is recognised as a test process WITHOUT NODE_ENV being set', () => {
    // ⚠ THE WHOLE REASON THE GUARD IS NOT KEYED ON NODE_ENV. Under `npm run test:server` — which
    // carries no `cross-env` — NODE_ENV is undefined in a fresh child, and this file never loads
    // `.env.test` to set it. The runner's own signal is what holds.
    assert.equal(isTestProcess(), true, 'the guard must recognise a test process here of all places');
    assert.ok(
      process.env.NODE_TEST_CONTEXT !== undefined,
      'harness: NODE_TEST_CONTEXT must be set by the runner, or this file is proving something else'
    );
  });

  it('and would be recognised even if NODE_ENV said production', () => {
    // A stray NODE_ENV must not be able to turn the guard off.
    const saved = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assert.equal(
        isTestProcess(), true,
        'NODE_ENV must not be able to override the runner signal — the signals are OR-ed so the '
        + 'guard fails CLOSED'
      );
    } finally {
      if (saved === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = saved;
    }
  });

  // ⚠ THE THREE SIGNALS ARE EXERCISED ON SYNTHETIC INPUT, ONE AT A TIME, BECAUSE TWO OF THEM HAVE NO
  // OBSERVER IN A REAL RUN AND ONE DIRECTION HAD NO OBSERVER AT ALL.
  //   · `VITEST`: measured — **no file under `src/` requires any `server/` module**, so the React
  //     runner never reaches `loadEnv()` and that arm is unreachable today. It is KEPT, because it
  //     costs nothing and the day a React test does require a server module it must already be
  //     closed — but an arm nothing can falsify is a claim, not a check, so it is driven here.
  //   · The FALSE direction: until this case existed, `isTestProcess()` could have been written
  //     `return true` and every other case in this file would have passed — while PRODUCTION loaded
  //     `.env.test`. A guard with no negative case cannot tell "always on" from "correct".
  const SIGNALS = ['NODE_TEST_CONTEXT', 'VITEST', 'NODE_ENV'];

  /** Run fn with all three signals cleared, restoring them afterwards whatever happens. */
  function withNoSignals(fn) {
    const saved = {};
    for (const k of SIGNALS) saved[k] = process.env[k];
    try {
      for (const k of SIGNALS) delete process.env[k];
      return fn();
    } finally {
      for (const k of SIGNALS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  it('EACH signal alone is sufficient — including VITEST, which no real run exercises', () => {
    withNoSignals(() => {
      assert.equal(isTestProcess(), false, 'harness: with all three cleared the answer must be false, '
        + 'or the three assertions below prove nothing');

      process.env.NODE_TEST_CONTEXT = 'child-v8';
      assert.equal(isTestProcess(), true, 'NODE_TEST_CONTEXT alone must be sufficient');
      delete process.env.NODE_TEST_CONTEXT;

      process.env.VITEST = 'true';
      assert.equal(isTestProcess(), true, 'VITEST alone must be sufficient — the React runner\'s signal');
      delete process.env.VITEST;

      process.env.NODE_ENV = 'test';
      assert.equal(isTestProcess(), true, 'NODE_ENV=test alone must be sufficient');
    });
  });

  it('and with NO signal present it is FALSE — a real process still gets the real file', () => {
    // The direction that keeps production working. Without it, an always-true guard would make the
    // deployed app load `.env.test`, and nothing in this file would notice.
    withNoSignals(() => {
      assert.equal(isTestProcess(), false, 'a process with no test signal must NOT be treated as a test');
      // ⚠ `chosenEnvFile()`, NEVER `loadEnv()`. Calling the loader here would load the real `.env`
      // into this very process and red the leak assertion two describes below — the observation
      // would create the condition it exists to rule out.
      assert.equal(
        chosenEnvFile(), REAL_ENV_FILE,
        'a real process must choose the real file — the decision and the signal must agree'
      );
    });
    // And the inverse, back under the runner's own signal, so the pair brackets the decision.
    assert.equal(chosenEnvFile(), TEST_ENV_FILE, 'and this process must choose the test file');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE CANARY — no variable exclusive to the real .env is present', () => {
  const realKeys = keyNamesOf(path.join(REPO_ROOT, REAL_ENV_FILE));
  const testKeys = keyNamesOf(path.join(REPO_ROOT, TEST_ENV_FILE)) || [];

  /**
   * Names whose process VALUE equals the value the real `.env` declares for them.
   *
   * ⚠ THIS COMPARES VALUES AND REPORTS ONLY NAMES, AND IT REPLACED A NAME-ONLY CHECK THAT COULD NOT
   * SURVIVE ITS OWN COMMIT. The first writing asserted these names were ABSENT — correct until
   * `loadEnv()` began substituting test stubs for the credentials the code needs in order to load, at
   * which point three of them are legitimately PRESENT and the old assertion would have failed
   * against a working guard. **Presence was never the property; provenance is.** Comparing values is
   * strictly stronger: a name check cannot tell a stub from a live key, and the live key is the whole
   * subject.
   * ⚠ NO VALUE IS PRINTED, RETURNED OR LOGGED. The comparison happens here and only names leave.
   */
  function namesCarryingTheirRealValue(declaredIn) {
    const out = [];
    for (const [name, realValue] of Object.entries(declaredIn)) {
      if (process.env[name] !== undefined && process.env[name] === realValue) out.push(name);
    }
    return out;
  }

  /** name -> value, for the real `.env` only. Used for comparison; never printed. */
  function realPairs() {
    const abs = path.join(REPO_ROOT, REAL_ENV_FILE);
    if (!fs.existsSync(abs)) return null;
    const pairs = {};
    for (const raw of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      pairs[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
    return pairs;
  }

  it('REQUIRING server/db.js brings no VALUE from the real .env', () => {
    // The leak path, driven directly: db.js is what every suite reaches through.
    require('../db');
    const pairs = realPairs();
    if (pairs === null) {
      // No real `.env` here — the sentinel describe below is what covers this case, and it says so
      // rather than letting an absent file read as a pass.
      assert.ok(true, 'no real .env on this machine; the sentinel half carries the proof');
      return;
    }
    const exclusive = realKeys.filter((k) => !testKeys.includes(k));
    assert.ok(
      exclusive.length > 0,
      'harness: the real .env must declare at least one variable .env.test does not, or this '
      + 'assertion has nothing to detect and would pass against the leak'
    );
    const exclusivePairs = {};
    for (const k of exclusive) exclusivePairs[k] = pairs[k];

    const leaked = namesCarryingTheirRealValue(exclusivePairs);
    assert.deepEqual(
      leaked, [],
      'these variables hold the value the real .env declares for them: ' + leaked.join(', ')
      + ' — the real .env has been loaded into this test process. (Names only; no value is printed.)'
    );
  });

  it('PAIRED POSITIVE: the detector DOES catch a real value when one is present', () => {
    // ⚠ WITHOUT THIS THE CASE ABOVE PASSES IF THE COMPARISON CAN NEVER MATCH — a mis-parsed file, a
    // quoting difference, an empty pair map. It plants one real value under its OWN name, confirms
    // the detector names it, and puts the variable back whatever happens. This is the only thing that
    // proves an absence assertion is capable of being false.
    const pairs = realPairs();
    if (pairs === null) { assert.ok(true, 'no real .env here; nothing to prove the detector against'); return; }
    const exclusive = realKeys.filter((k) => !testKeys.includes(k) && pairs[k]);
    if (exclusive.length === 0) { assert.ok(true, 'no exclusive key with a value'); return; }

    const probe = exclusive[0];
    const saved = process.env[probe];
    try {
      process.env[probe] = pairs[probe];
      const caught = namesCarryingTheirRealValue({ [probe]: pairs[probe] });
      assert.deepEqual(
        caught, [probe],
        `the detector must name ${probe} when it genuinely holds its real value, or the assertion `
        + 'above is not measuring anything'
      );
    } finally {
      if (saved === undefined) delete process.env[probe];
      else process.env[probe] = saved;
    }
  });

  it('the stubs loadEnv substitutes are NOT the real values, by construction and by check', () => {
    // ⚠ A STUB THAT HAPPENED TO EQUAL THE REAL VALUE WOULD MAKE THE WHOLE CANARY MEANINGLESS, so the
    // two sets are checked disjoint rather than assumed to be. This is cheap and it closes the one
    // way the substitution could defeat the guard it exists to serve.
    const { TEST_CREDENTIAL_STUB_NAMES } = require('../utils/loadEnv');
    const pairs = realPairs() || {};
    const collisions = TEST_CREDENTIAL_STUB_NAMES
      .filter((k) => pairs[k] !== undefined && pairs[k] === process.env[k]);
    assert.deepEqual(
      collisions, [],
      'a test stub equals the real value for: ' + collisions.join(', ')
      + ' — change the stub; it must be unmistakably not the real credential'
    );
    assert.ok(TEST_CREDENTIAL_STUB_NAMES.length > 0, 'harness: there must be stubs to check');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE CANARY — the sentinel half, which needs no real credential', () => {
  it('a planted .env in the working directory does NOT reach a process that requires db.js', () => {
    // ⚠ THIS IS THE HALF THAT WORKS ANYWHERE, AND IT EXERCISES THE REAL MECHANISM. The leak was
    // dotenv's cwd-relative default, so the fixture is a `.env` in a DIFFERENT cwd — exactly the
    // shape that used to be loaded. If `db.js` ever resolves `.env` from the cwd again, the sentinel
    // appears in the child's environment and this case reds.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcanary-'));
    const SENTINEL = 'RM_CANARY_MUST_NOT_LEAK';
    try {
      fs.writeFileSync(path.join(dir, '.env'), `${SENTINEL}=planted\n`, 'utf8');

      // A child that loads db.js the way a test does, from that cwd, and reports only PRESENCE.
      const script = [
        'process.env.NODE_TEST_CONTEXT = process.env.NODE_TEST_CONTEXT || "child-v8";',
        `require(${JSON.stringify(path.join(SERVER_ROOT, 'db.js').replace(/\\/g, '/'))});`,
        `process.stdout.write(String(process.env.${SENTINEL} !== undefined));`,
      ].join('\n');

      const out = execFileSync(process.execPath, ['-e', script], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, [SENTINEL]: undefined, NODE_TEST_CONTEXT: 'child-v8' },
      });

      assert.ok(
        /^(true|false)$/.test(out.trim().split('\n').pop()),
        `harness: the child must report exactly true or false, got: ${JSON.stringify(out.slice(-200))}`
      );
      assert.equal(
        out.trim().split('\n').pop(), 'false',
        'a `.env` sitting in the working directory reached the process — db.js is resolving it from '
        + 'the cwd again, which is the exact leak this commit closed'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PAIRED POSITIVE: the same child DOES pick the sentinel up through a bare dotenv load', () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES IF THE CHILD SIMPLY NEVER RAN, OR IF THE PLANTED FILE
    // WAS NEVER READABLE, OR IF dotenv STOPPED RESOLVING FROM THE CWD AT ALL. It proves the fixture
    // is capable of producing the leak it asserts the absence of — an absence assertion must first
    // prove the presence it is asserting the absence of.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcanary-pos-'));
    const SENTINEL = 'RM_CANARY_MUST_NOT_LEAK';
    try {
      fs.writeFileSync(path.join(dir, '.env'), `${SENTINEL}=planted\n`, 'utf8');
      const dotenvPath = path.join(REPO_ROOT, 'node_modules', 'dotenv').replace(/\\/g, '/');
      const script = [
        `require(${JSON.stringify(dotenvPath)}).config();`,
        `process.stdout.write(String(process.env.${SENTINEL} !== undefined));`,
      ].join('\n');
      const out = execFileSync(process.execPath, ['-e', script], {
        cwd: dir, encoding: 'utf8', env: { ...process.env },
      });
      assert.equal(
        out.trim().split('\n').pop(), 'true',
        'harness: a BARE dotenv.config() in that cwd must pick the sentinel up, or the negative '
        + 'case above is not measuring anything'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE CANARY — no server module may load env the unguarded way', () => {
  it('no file under server/ calls dotenv directly — every load goes through loadEnv()', () => {
    // ⚠ A FENCE, BECAUSE THE BEHAVIOURAL HALVES ABOVE ONLY COVER THE PATH THROUGH db.js. A new
    // module calling `require('dotenv').config()` would reopen the leak for any suite that requires
    // IT instead, and nothing above would notice.
    const offenders = [];
    for (const f of serverFiles()) {
      if (f.endsWith(path.join('utils', 'loadEnv.js'))) continue; // the one sanctioned caller
      const src = stripComments(fs.readFileSync(f, 'utf8'));
      if (DOTENV_REQUIRE.test(src)) {
        offenders.push(path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
      }
    }
    assert.deepEqual(
      offenders, [],
      'these load env without the test guard: ' + offenders.join(', ')
      + ' — route them through server/utils/loadEnv.js'
    );
  });

  it('NON-VACUITY: the needle matches the one sanctioned caller', () => {
    // Without this, a renamed package or a broken walk would make the fence above pass trivially.
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'utils', 'loadEnv.js'), 'utf8'));
    assert.ok(
      DOTENV_REQUIRE.test(src),
      'the needle must be able to match — loadEnv.js is where the one real dotenv call lives'
    );
  });

  it('NON-VACUITY: the walk reaches db.js, which is where the leak was', () => {
    const files = serverFiles().map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
    assert.ok(files.includes('server/db.js'), `the walk must reach db.js; found ${files.length} files`);
    assert.ok(files.length > 50, `the walk looks too small to be real: ${files.length}`);
  });

  it('db.js routes through loadEnv() rather than carrying its own path', () => {
    const src = stripComments(fs.readFileSync(path.join(SERVER_ROOT, 'db.js'), 'utf8'));
    assert.ok(/loadEnv\s*\(\s*\)/.test(src), 'db.js must call loadEnv()');
    assert.ok(
      !/\.env['"]\s*\}/.test(src),
      'db.js must not name an env file itself — the decision belongs in one place'
    );
  });
});
