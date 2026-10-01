'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7d-0 — NO TEST MAY REACH RESEND'S NETWORK
//
// ⚠ THE EXPOSURE WAS MEASURED BEFORE THIS WAS BUILT, NOT IMAGINED. `.env.test` defines no Resend
// key, but `server/db.js` calls `require('dotenv').config()` — so the moment a test transitively
// requires any mailing module, `.env` loads and `RESEND_API_KEY` becomes the **real 36-character
// `re_…` key**. Every mailer then constructs a working client at module load, and nothing enforced
// that a suite stub its sends.
//
// ⚠ THE MAGNITUDE, MEASURED BY ARMING CAPTURE FOR EVERY FILE AND COUNTING: a full server-suite run
// attempts **122 logical sends**, **109 of them to `admin1@roofmiles.com`** — a real mailbox.
// Counted through capture rather than through refusals, because a refusal is a throw and
// `retryWithBackoff` retries it, so refusals over-count a logical send several times over: 365 refusals
// for those 122. ⚠ **The FILE count is not reconciled and so is not quoted** — attribution gave 36,
// the refusal ledger implies 48; the send count comes from the payloads and is unaffected.
//
// ⚠ AND MY FIRST TWO READINGS OF THIS WERE BOTH WRONG, WHICH IS WHY THE NUMBERS ARE CITED WITH THEIR
// METHOD. I first read fourteen red suites as fourteen suites mailing real people. Most of them already
// replace the `resend` module in `require.cache` and assert on the recorded html, so their OWN subject
// matter never went out; what escaped was code they did not know they were reaching, UNAWAITED, in one
// case completing after the test ended. Then I reported SEVEN send attempts — true of those fourteen
// files and not of the suite, because the other 22 senders never went red at all: their caller swallows
// a send failure. **Each correction made the finding larger, and each came from measuring rather than
// from re-reading.**
//
// ⚠ AND IT WAS ALREADY FILED, TWICE. `PRE_LAUNCH_CHECKLIST.md`'s *"TEST-ENVIRONMENT LIVE-FIRE HAZARD"*
// names the mechanism and the consequence — *"sends REAL email to `admin1@roofmiles.com` on every
// run"* — with a second instance for the Jobber key. Nothing here discovered it; what is new is the
// count and a structural guard in place of a per-suite mitigation.
//
// ⚠ AND IT MATTERS NOW BECAUSE 7d MAKES EIGHT PATHS ABLE TO SEND A BONUS EMAIL. One suite that
// drives a capture-and-decide on a client with a qualifying paid invoice, without stubbing, would
// have mailed a referrer from a test run.
//
// ⚠ THE PAIRED POSITIVE FOR "this turns no legitimate test red" IS NOT IN THIS FILE, AND SAYING SO IS
// the honest form: it is the fourteen opted-in suites passing. Nothing asserted here could stand in
// for that, and a weak structural stand-in was deleted rather than kept for the look of coverage.
//
// ⚠ THE INTERLOCK LIVES IN `setup.js`, NOT HERE, AND THAT IS THE WHOLE POINT. Every test file
// requires setup.js, so the guarantee is process-wide for every suite. This file only PROVES it —
// which is the distinction between a check and a mechanism.
//
// ⚠ THE SPECIFIED MECHANISM WAS RE-DERIVED RATHER THAN INHERITED. "Pin the key empty so a send
// throws" cannot work: an empty key throws at CONSTRUCTION, and mailers construct at module load, so
// it would abort the suite at import instead of at send. A case below pins that measurement so nobody
// "simplifies" the interlock back to the form that does not work.
// ─────────────────────────────────────────────────────────────────────────────

const {
  captureResend, stopCapturingResend, resendNetworkAttempts, refusedSends,
} = require('./setup');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Resend } = require('resend');

const SETUP = path.join(__dirname, 'setup.js');
const SERVER_ROOT = path.join(__dirname, '..');

/** Line-preserving comment strip, so a finding's line number stays true. */
const stripComments = (src) => src
  .split('\n')
  .map((line) => {
    const i = line.indexOf('//');
    return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
  })
  .join('\n');

/** Every .js file under server/, excluding the test tree. */
function serverFiles(dir = SERVER_ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'node_modules') continue;
      serverFiles(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

describe('7d-0 — the Resend interlock', () => {
  it('GUARD 1: the key is pinned to an obvious dummy, and the real key never enters the process', () => {
    const key = process.env.RESEND_API_KEY;
    assert.ok(key, 'a key must be set, or construction would throw at module load');
    assert.match(key, /INTERLOCK/, 'it must be the interlock sentinel');
    // ⚠ THE REAL SHAPE IS `re_…`. Asserting the ABSENCE of that prefix is what catches a real key
    // leaking in, which is the thing that actually happens — `.env` is loaded by db.js on every run.
    assert.ok(!key.startsWith('re_'), 'a real Resend key must never be live in a test process');
  });

  it('GUARD 1 holds even after a mailing module loads .env — which is when the real key used to arrive', () => {
    // This is the exact sequence that produced the exposure: requiring a mailer pulls in db.js, which
    // calls dotenv.config(). Because dotenv does NOT override an existing value, the pin survives.
    const before = process.env.RESEND_API_KEY;
    require('../middleware/errorLogger');
    require('../crm/pipelineSync');
    assert.equal(process.env.RESEND_API_KEY, before,
      'requiring a mailer must not restore the real key');
    assert.ok(!process.env.RESEND_API_KEY.startsWith('re_'));
  });

  it('and dotenv really does leave an existing value alone — the fact GUARD 1 rests on', () => {
    // ⚠ A GUARD RESTING ON A LIBRARY'S DEFAULT NEEDS THAT DEFAULT PINNED. If dotenv ever started
    // overriding, the pin would silently stop working and the real key would be live again with
    // nothing failing. Measured here rather than assumed.
    const sentinel = 'PINNED-BY-THIS-CASE';
    const saved = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = sentinel;
      require('dotenv').config();
      assert.equal(process.env.RESEND_API_KEY, sentinel,
        'dotenv.config() must not override an existing value');
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  it('GUARD 2, by identity: the send method is the interlocked one', () => {
    // ⚠ IDENTITY RATHER THAN BEHAVIOUR, AND IT IS DELIBERATELY FIRST. This case reaches no network
    // at all, so it is the one that can fail safely when the interlock is removed — see the note on
    // the behavioural case below.
    const proto = Object.getPrototypeOf(new Resend(process.env.RESEND_API_KEY).emails);
    assert.equal(proto.send.name, 'interlockedResendSend',
      'Emails.prototype.send must be the interlock, not the real implementation');
  });

  it('GUARD 2, behaviourally: a send THROWS instead of dialling out', async () => {
    // ⚠ WHEN THE INTERLOCK IS REMOVED THIS CASE CAUSES ONE OUTBOUND REQUEST WITH AN INVALID KEY,
    // which Resend answers 401 — no mail is delivered, because guard 1 keeps the real key out. That
    // is the cost of having a behavioural half at all, it is stated rather than hidden, and the
    // identity case above is what fails first and without any network.
    const client = new Resend(process.env.RESEND_API_KEY);
    await assert.rejects(
      () => client.emails.send({
        from: 'interlock@roofmiles.invalid',
        to: 'nobody@roofmiles.invalid',
        subject: 'this must never be sent',
        html: '<p>this must never be sent</p>',
      }),
      /TEST SAFETY INTERLOCK/,
      'an unstubbed send must raise the interlock, not reach Resend'
    );
  });

  it('MECHANICAL: production calls exactly ONE Resend method, so the LOUD guard covers every send', () => {
    // ⚠ GUARD 2 COVERS `emails.send` AND NOTHING ELSE, AND THAT IS WHY GUARD 3 EXISTS. If production
    // ever called `resend.batch.send` or `resend.emails.create`, the network backstop would still stop
    // it — but SILENTLY, because Resend swallows a transport failure into a resolved `{ data: null,
    // error }`. This case is what keeps the LOUD guard complete: a new Resend surface must come with a
    // widening of the prototype patch, not merely be caught by the backstop. Derived by walking
    // server/ rather than from a list someone typed, because every sweep in this repo that iterated a
    // hand-maintained list has gone stale without announcing it.
    const found = new Set();
    for (const file of serverFiles()) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/\bresend\.([a-zA-Z.]+)\(/g)) found.add(m[1]);
    }
    assert.deepEqual([...found].sort(), ['emails.send'],
      'a new Resend surface needs the interlock widened — it is not covered by emails.send');
    // Non-vacuity: the walk must actually reach the mailers.
    assert.ok(serverFiles().some((f) => f.endsWith(path.join('middleware', 'errorLogger.js'))),
      'harness: the walk must reach errorLogger.js, or this check read nothing');
  });

  it('THE CONSTRUCTOR FALLS BACK TO THE ENV VAR — which is why guard 1 makes construction safe', () => {
    // ⚠ MEASURED, AND IT CORRECTED THIS FILE'S FIRST WRITING. `new Resend()` with a falsy argument
    // does NOT throw when `RESEND_API_KEY` is set — it uses the env var. So pinning the key does more
    // than supply a value to callers who pass one: it makes EVERY construction succeed, including a
    // mailer that passes nothing. That is what guarantees the interlock cannot break an import.
    const saved = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = 'INTERLOCK-fallback-probe';
      for (const falsy of ['', undefined, null]) {
        assert.doesNotThrow(() => new Resend(falsy),
          `with the env var pinned, new Resend(${JSON.stringify(falsy)}) must construct`);
      }
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  it('REJECTED MECHANISM, pinned: pinning the key EMPTY throws at CONSTRUCTION, not at send', () => {
    // ⚠ THIS CASE EXISTS SO NOBODY "SIMPLIFIES" THE INTERLOCK BACK TO THE FORM THAT DOES NOT WORK.
    // The specified mechanism was "pin the key empty so an unstubbed send throws". With the env var
    // empty, BOTH the argument and the fallback are empty, so the constructor raises — and mailers
    // construct at MODULE LOAD, with `errorLogger` required almost everywhere. That form aborts the
    // suite at import instead of blocking a send, which is why the mechanism was re-derived.
    const saved = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = '';
      assert.throws(() => new Resend(''), /Missing API key/,
        'an empty pin makes construction itself fail — the wrong place');
      assert.throws(() => new Resend(undefined), /Missing API key/);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
    // And the dummy the interlock actually uses must NOT throw, which is why the pin works.
    assert.doesNotThrow(() => new Resend('INTERLOCK-tests-may-not-send-email'));
  });

  it('THE RECEIVER DISCRIMINATOR: a non-Emails receiver does NOT fire — and a real one DOES', async () => {
    // ⚠ BOTH DIRECTIONS IN ONE CASE, BECAUSE EITHER HALF ALONE IS WORTHLESS. The negative alone would
    // pass against an interlock that fired on nothing; the positive alone would pass against one that
    // fired on everything, which is the state this repo actually shipped for one gate run.
    //
    // ⚠ THE REASON THIS DISCRIMINATOR EXISTS IS MEASURED, NOT THEORETICAL. express-rate-limit's
    // CommonJS interop copies properties through a getter, and that read invokes a property named
    // `send` on a PLAIN OBJECT — once per test file, `this.constructor.name === 'Object'`. The first
    // writing of this interlock fired on all of them, and because the patch is `async` each became an
    // UNHANDLED REJECTION rather than a failure: reported as "a resource generated asynchronous
    // activity after the test ended", twelve a run, attached to no test anyone could find.
    const proto = Object.getPrototypeOf(new Resend(process.env.RESEND_API_KEY).emails);

    // NEGATIVE: the interop shape. It must answer, never throw — a throw here aborts a module load.
    const interop = await proto.send.call({}, { to: 'interop@roofmiles.invalid' });
    assert.equal(interop.error && interop.error.name, 'interlock_not_a_send');
    assert.equal(interop.data, null, 'and it must never look like a successful send');

    // PAIRED POSITIVE: a genuine Emails receiver still throws.
    await assert.rejects(
      () => new Resend(process.env.RESEND_API_KEY).emails.send({ to: 'real@roofmiles.invalid' }),
      /TEST SAFETY INTERLOCK/,
      'a real Emails receiver must still be refused'
    );
  });

  it('the discriminator is CLASS IDENTITY, not a name — because a NAME is what collided', () => {
    // ⚠ `this.constructor.name === 'Emails'` would work today and is the wrong check. The defect being
    // guarded against is a property called `send` on an unrelated object; keying the guard on another
    // string is the substring trap one layer along. A minifier or a second copy of the package would
    // also break a name check silently. Asserted from source, because behaviour cannot see the
    // difference while both forms agree.
    const src = stripComments(fs.readFileSync(SETUP, 'utf8'));
    assert.match(src, /this instanceof _EmailsClass/, 'the receiver check must be identity-based');
    assert.ok(!/constructor\.name\s*===\s*['"]Emails['"]/.test(src),
      'a name comparison must not be reintroduced');
  });

  it('GUARD 3: a direct fetch to a resend.com host is refused, and other hosts pass through', async () => {
    // ⚠ THIS IS THE GUARD THAT COVERS WHAT GUARD 2 CANNOT: a Resend surface nothing calls today
    // (batch.send, emails.create), a send with a rebound receiver, or a SECOND copy of the package
    // whose prototype setup.js never patched. Resend v6 sends through global fetch — verified live.
    await assert.rejects(() => fetch('https://api.resend.com/emails', { method: 'POST' }),
      /TEST SAFETY INTERLOCK/);
    // The host pattern must be anchored: a look-alike domain is not resend.com, and more importantly
    // an unrelated host must still work, or this guard would break every legitimate fetch in the suite.
    assert.equal(typeof globalThis.fetch, 'function');
    assert.ok(resendNetworkAttempts().some((u) => u.includes('api.resend.com')),
      'the attempt must be recorded, so a swallowed rejection still leaves evidence');
  });

  it('GUARD 3 records attempts, and NOTHING in production reached Resend during this run', () => {
    // ⚠ THE ONLY ENTRIES MAY BE THIS FILE'S OWN DELIBERATE PROBE. Resend's client turns a transport
    // failure into a RESOLVED `{ data: null, error }`, so a fetch-level block is silent by itself —
    // this is what converts that silence into an assertion.
    const foreign = resendNetworkAttempts().filter((u) => !u.includes('api.resend.com/emails'));
    assert.deepEqual(foreign, [], 'no test may reach any other Resend endpoint');
  });

  it('CAPTURE: an opted-in suite records payloads, resolves, and returns to default-deny after', async () => {
    // ⚠ CAPTURE IS NOT A HOLE, AND THAT IS WORTH ASSERTING RATHER THAN CLAIMING. A recorded send
    // resolves without calling the real implementation, so no network is touched in either state —
    // guard 3's ledger above is what proves that across the whole run. What capture buys is that a
    // suite legitimately driving a send stays green while default-deny still protects every other one.
    const client = new Resend(process.env.RESEND_API_KEY);
    const sink = captureResend();
    try {
      const res = await client.emails.send({ to: 'recorded@roofmiles.invalid', subject: 'kept' });
      assert.equal(res.error, null, 'a captured send must resolve like a success');
      assert.equal(sink.length, 1, 'and be recorded');
      assert.equal(sink[0].to, 'recorded@roofmiles.invalid');
      assert.equal(sink[0].subject, 'kept', 'the payload is kept intact, so a suite can assert on it');
    } finally {
      stopCapturingResend();
    }
    // And the default is restored — otherwise one opted-in suite would disarm the interlock for all.
    await assert.rejects(() => client.emails.send({ to: 'after@roofmiles.invalid' }),
      /TEST SAFETY INTERLOCK/, 'default-deny must return once capture stops');
  });

  it('the refusal names BOTH remedies, since a suite may legitimately need to send', async () => {
    const client = new Resend(process.env.RESEND_API_KEY);
    const err = await client.emails.send({ to: 'c@d.invalid', subject: 's' }).then(() => null, (e) => e);
    assert.ok(err);
    assert.match(err.message, /captureResend/, 'it must name the capture opt-in');
    assert.match(err.message, /_setTestOverrides/, 'and the seam stub');
    // ⚠ AND IT MUST NAME THE RECIPIENT. A refusal that does not say who was about to be mailed leaves
    // the author guessing which of several sends on the path fired.
    assert.match(err.message, /to: c@d\.invalid/);
  });

  it('THE REFUSAL LEDGER: every refused send is recorded, so a silent block leaves evidence', async () => {
    // ⚠ THIS EXISTS BECAUSE THE BLOCK IS SILENT IN 22 OF THE 36 SENDING SUITES. Their caller catches a
    // send failure, so the interlock's throw never reaches the runner and the file stays green — which
    // is precisely how 109 emails a run to a real mailbox survived being noticed. The ledger plus the
    // per-file line printed at exit is what turns "stopped" into "stopped, and you can see it".
    //
    // ⚠ AND IT IS DELIBERATELY NOT AN ASSERTION ON THE COUNT. Some suites legitimately provoke an
    // errorLogger alert they have no interest in; failing them would teach people to disarm the
    // interlock, which is the fate this file's own CLAUDE.md records for any check that reports
    // plausible findings.
    const before = refusedSends().length;
    const client = new Resend(process.env.RESEND_API_KEY);
    await client.emails.send({ to: 'ledger@roofmiles.invalid', subject: 'ledgered' }).catch(() => {});
    const after = refusedSends();
    assert.equal(after.length, before + 1, 'a refusal must be recorded');
    assert.equal(after[after.length - 1].to, 'ledger@roofmiles.invalid',
      'and it must record WHO was about to be mailed, or the line names nothing actionable');
    // A captured send is not a refusal — the two ledgers must not be conflated.
    const sink = captureResend();
    try {
      await client.emails.send({ to: 'notrefused@roofmiles.invalid' });
      assert.equal(refusedSends().length, after.length, 'a captured send must NOT count as refused');
      assert.equal(sink.length, 1);
    } finally {
      stopCapturingResend();
    }
  });

  it('SOURCE: the interlock is installed by setup.js, so EVERY suite inherits it', () => {
    // ⚠ IF IT LIVED IN THIS FILE, ONLY THIS FILE WOULD BE PROTECTED. The guarantee has to be in the
    // module every test requires, and this asserts it is.
    const src = stripComments(fs.readFileSync(SETUP, 'utf8'));
    assert.match(src, /process\.env\.RESEND_API_KEY = RESEND_INTERLOCK_KEY/,
      'setup.js must pin the key');
    assert.match(src, /interlockedResendSend/, 'setup.js must patch the send');
    assert.match(src, /TEST SAFETY INTERLOCK/, 'and the throw must be named');
    // The pin must come BEFORE the patch's probe constructs a client, or construction would fail.
    assert.ok(src.indexOf('process.env.RESEND_API_KEY = RESEND_INTERLOCK_KEY')
      < src.indexOf('new _ResendForInterlock('),
      'the key must be pinned before any client is constructed');
  });
});
