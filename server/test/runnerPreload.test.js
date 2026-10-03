'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// NO SUITE CAN SKIP THE SAFETY INTERLOCKS, BECAUSE THE RUNNER LOADS THEM
//
// Danny's ruling: every server test file loads `./setup` automatically through the test runner's
// configuration, so no suite can skip the 7d-0 Resend interlock or the `.env` guard. Proof: a suite
// that never requires `./setup` still has the interlock active.
//
// ⚠ THIS FILE IS THAT PROOF, AND IT WORKS ONLY BECAUSE IT NEVER REQUIRES `./setup`. That is not a
// style choice and it is not an oversight — it is the entire mechanism. A case asserting "the
// interlock is active" from a file that had just required `setup.js` would prove that requiring
// `setup.js` installs the interlock, which nobody doubted. **The property is that a file which does
// NOT ask for it gets it anyway**, and the only way to observe that is to be such a file.
// ⚠ SO A SOURCE ASSERTION BELOW FORBIDS THIS FILE FROM EVER REQUIRING IT. Without that, a future
// edit adding `require('./setup')` — to reach `initTestDb`, say — would silently turn every case
// here into a tautology, and the suite would stay green while proving nothing.
//
// ── WHAT CHANGED, AND WHAT IT DOES NOT MEAN ──────────────────────────────────
//
// `npm run test:server` now carries `--require ./server/test/setup.js`. Node's test runner passes
// its own `execArgv` to the child it spawns per FILE, so the preload reaches every suite before the
// suite's first line — verified empirically before this was written, not assumed from the docs.
//
// ⚠ IT DOES **NOT** MEAN THE `loadEnv` GUARD MAY NOW KEY ON `NODE_ENV` ALONE, and that inference is
// the one thing this commit makes tempting. `NODE_ENV` is now set for every suite, so the measured
// reason for OR-ing the signals ("17 files never require ./setup") no longer describes the running
// state. **The reason the guard fails CLOSED is unchanged**: this flag can be dropped from a script
// by anyone, a suite can be run directly with `node --test <file>`, and a guard that depends on its
// own belt is not a guard. See `server/utils/loadEnv.js`.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const THIS_FILE = __filename;
const SETUP_PATH = path.join(__dirname, 'setup.js');

// ─────────────────────────────────────────────────────────────────────────────
describe('THE RUNNER PRELOAD — setup.js is loaded for a file that never asks for it', () => {
  it('setup.js is in the require cache although this file does not require it', () => {
    // ⚠ THE DIRECT, STRUCTURAL OBSERVATION: something other than this file loaded it. Nothing in
    // this suite requires `./setup`, and nothing it requires does either (`node:test`,
    // `node:assert`, `node:fs`, `node:path` are all built-ins), so the only remaining loader is the
    // runner's `--require`.
    const loaded = Object.keys(require.cache)
      .some((p) => path.resolve(p) === path.resolve(SETUP_PATH));
    assert.ok(
      loaded,
      'server/test/setup.js is NOT loaded in this process — the runner-level --require is missing '
      + 'from the test:server script, so any suite that does not require ./setup itself runs with '
      + 'no Resend interlock and no .env guard'
    );
  });

  it('ANTI-DEFEAT: this file must never require ./setup, or every case here goes vacuous', () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE IS ONE EDIT FROM MEANING NOTHING. Reading the file's own source
    // is the only way to pin it: `require.cache` cannot say WHO loaded a module.
    const src = fs.readFileSync(THIS_FILE, 'utf8');
    // Comments are stripped, because the header legitimately discusses the forbidden call — the
    // "prose describing a forbidden pattern IS the pattern" shape, and rewording is not available
    // here since the comment has to be able to name what it forbids.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
    assert.ok(
      !/require\(\s*['"]\.\/setup['"]\s*\)/.test(code),
      'this suite requires ./setup — which makes "the preload reached a file that did not ask for '
      + 'it" trivially true. Remove the require; use a different suite if you need initTestDb.'
    );
    // NON-VACUITY: the needle must be able to match, or the assertion above is permanently
    // satisfied by a pattern that can never fire. Checked against a synthetic line.
    // ⚠ ASSEMBLED FROM PIECES, AND THE FIRST WRITING WAS WRONG BECAUSE IT WAS NOT. Spelled out as a
    // literal, this fixture IS the forbidden call — it survives comment-stripping (a string is code)
    // and the assertion above flagged this very file. **A fence's own fixture is the likeliest place
    // for it to catch itself**, which this repo records from a stylesheet sweep that reported its
    // own test file.
    const syntheticCall = 'const x = ' + 'require(' + "'./setup'" + ');';
    assert.ok(
      /require\(\s*['"]\.\/setup['"]\s*\)/.test(syntheticCall),
      'harness: the needle cannot match the very call it forbids'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE RUNNER PRELOAD — the 7d-0 Resend interlock is active here', () => {
  it('an UNSTUBBED send is REFUSED, from a suite that never opted in', async () => {
    // ⚠ THIS IS THE BEHAVIOURAL HALF AND IT IS THE ONE DANNY NAMED. Before the preload, a suite
    // that did not require `./setup` held the REAL Resend key and an unpatched client — so a send
    // from it went to a real person. Here the send must be refused.
    // ⚠ IT ASSERTS THE REFUSAL'S IDENTITY, NOT MERELY THAT SOMETHING THREW. A missing key, a bad
    // argument or a network failure all throw too, and "it threw" would be satisfied by any of
    // them — the *plausible-looking rejection* trap. The interlock names itself.
    const { Resend } = require('resend');
    const client = new Resend(process.env.RESEND_API_KEY);

    // ⚠ IT IS AWAITED, AND THE FIRST WRITING WAS NOT — WHICH IS A FINDING ABOUT HOW THIS MUST BE
    // TESTED. The interlock replaces `send` with an `async` function, so a refusal arrives as a
    // REJECTED PROMISE, not a synchronous throw. A sync `try/catch` therefore caught nothing, the
    // case reported *"the interlock is not installed"* against a perfectly installed interlock, and
    // the rejection surfaced separately as *"asynchronous activity after the test ended"*.
    // **A guard that rejects and a guard that is absent look identical to a synchronous catch.**
    let threw = null;
    try {
      // Deliberately no `captureResend()` opt-in: the point is the DEFAULT state.
      await client.emails.send({
        from: 'noreply@roofmiles.com',
        to: 'nobody@example.invalid',
        subject: 'runnerPreload interlock probe',
        html: '<p>This must never leave the process.</p>',
      });
    } catch (err) {
      threw = err;
    }

    assert.ok(threw, 'an unstubbed Resend send was NOT refused — the interlock is not installed');
    assert.match(
      String(threw.message),
      /TEST SAFETY INTERLOCK/,
      `the send was refused for the wrong reason: ${String(threw.message).slice(0, 200)}`
    );
  });

  it('and the key in this process is the interlock dummy, not a real Resend key', () => {
    // ⚠ A SHAPE CHECK, NEVER A VALUE COMPARISON, AND NO VALUE IS PRINTED. A real Resend key begins
    // `re_`; the interlock pins an obvious placeholder. This is the second of the 7d-0 guards, and
    // it is what makes a send fail at the provider if the prototype patch were ever bypassed.
    const key = process.env.RESEND_API_KEY;
    assert.ok(typeof key === 'string' && key.length > 0, 'RESEND_API_KEY is unset in this process');
    assert.ok(
      !key.startsWith('re_'),
      'RESEND_API_KEY looks like a REAL Resend key in a test process — the interlock pin did not run'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('THE RUNNER PRELOAD — the .env guard is active here too', () => {
  it('DATABASE_URL points at this machine, so setup.js ran its own interlock', () => {
    // setup.js aborts at load unless this is local, so reaching any assertion at all is already
    // evidence — but stating it makes the guard's reach explicit rather than implied.
    const url = process.env.DATABASE_URL;
    assert.ok(url, 'DATABASE_URL is unset — setup.js did not run');
    assert.match(
      new URL(url).hostname,
      /^(localhost|127\.0\.0\.1)$/,
      'DATABASE_URL is not local in a test process'
    );
  });

  it('and NODE_ENV is test, which only .env.test supplies', () => {
    // ⚠ RECORDED AS A CONSEQUENCE OF THE PRELOAD, NOT AS A LICENCE. `loadEnv()`'s signals stay
    // OR-ed; see this file's header. Before the preload this was undefined for 18 suites, and the
    // figure is in `server/utils/loadEnv.js`.
    assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV is not test — .env.test was not loaded');
  });
});
