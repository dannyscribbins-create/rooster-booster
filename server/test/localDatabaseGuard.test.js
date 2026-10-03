'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// A HAND-RUN SEEDER REFUSES A REMOTE DATABASE
//
// Danny's ruling: `seedTestTeamMember.js` (and any other hand-run script that writes to a database)
// refuses to run unless its `DATABASE_URL` is local, mirroring `setup.js`'s check, with a clear
// message.
//
// ⚠ THE SCRIPT'S REFUSAL IS DRIVEN BY SPAWNING THE REAL SCRIPT, AND THE PERMITTED DIRECTION IS NOT.
// The negative needs the real file — a unit test on the helper cannot prove the script CALLS it, and
// *"a test that injects the value itself cannot discover that nothing upstream supplies it"*. The
// positive deliberately does NOT spawn it: the seeder's whole job is to INSERT a team member, so
// proving "a local URL is permitted" by running it would write a row into the test database as a side
// effect of a test about refusing to write. The helper covers that direction as a pure function.
//
// ⚠ AND THE INVENTORY IS ASSERTED, NOT DESCRIBED. The three operator scripts write to production ON
// PURPOSE and must NOT be gated; a case below pins that they do not call this guard, so a later
// "consistency" pass cannot quietly disable them. **The distinction is what a script is FOR, not
// whether it writes.**
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { isLocalDatabaseUrl, assertLocalDatabase } = require('../utils/requireLocalDatabase');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SEEDER = path.join('server', 'scripts', 'seedTestTeamMember.js');

/** A remote-looking URL used only as an input. No host here is ever contacted. */
const REMOTE_URL = 'postgresql://u:p@db.example.invalid:5432/prod';

// ─────────────────────────────────────────────────────────────────────────────
describe('the local-database guard — the predicate', () => {
  it('accepts localhost and 127.0.0.1, and nothing else', () => {
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@localhost:5432/roofmiles_test'), true);
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@127.0.0.1:5432/roofmiles_test'), true);
    assert.equal(isLocalDatabaseUrl(REMOTE_URL), false);
  });

  it('REFUSES a remote host that merely CONTAINS the word localhost', () => {
    // ⚠ THE SUBSTRING TRAP, WHICH IS WHY THE HELPER PARSES RATHER THAN MATCHES. A check written
    // `url.includes('localhost')` admits both of these, and both are remote.
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@localhost.db.example.invalid:5432/prod'), false);
    assert.equal(isLocalDatabaseUrl('postgresql://u:localhost@db.example.invalid:5432/prod'), false);
  });

  it('FAILS CLOSED on an unset, empty or unparseable value', () => {
    // Refusing a valid-but-odd URL costs one confused operator a message; admitting one writes
    // test rows into production.
    for (const bad of [undefined, null, '', 'not a url', 'localhost:5432', 42, {}]) {
      assert.equal(isLocalDatabaseUrl(bad), false, `treated as local: ${JSON.stringify(bad)}`);
    }
  });

  it('assertLocalDatabase throws for a remote URL and is silent for a local one', () => {
    assert.throws(
      () => assertLocalDatabase(REMOTE_URL, 'some/script.js'),
      /REFUSING TO RUN/,
      'a remote URL must be refused'
    );
    // The PAIRED POSITIVE — without it, a helper that threw unconditionally would pass the case above.
    assert.doesNotThrow(
      () => assertLocalDatabase('postgresql://u:p@localhost:5432/roofmiles_test', 'some/script.js')
    );
  });

  it('the message names the HOST and never the connection string', () => {
    // ⚠ A CONNECTION STRING CARRIES THE PASSWORD, and a refusal message is exactly the line that
    // gets pasted into a chat or a bug report.
    let msg = '';
    try { assertLocalDatabase(REMOTE_URL, 'some/script.js'); } catch (e) { msg = e.message; }
    assert.match(msg, /db\.example\.invalid/, 'the message should name the host it refused');
    assert.ok(!msg.includes('p@'), 'the message must not contain the credential portion of the URL');
    assert.ok(!msg.includes(REMOTE_URL), 'the message must not contain the whole connection string');
    assert.match(msg, /localhost/, 'the message should say what WOULD be acceptable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the local-database guard — the real seeder refuses', () => {
  it('seedTestTeamMember.js REFUSES a remote DATABASE_URL, before any query', () => {
    // ⚠ THE REAL SCRIPT, SPAWNED. `DATABASE_URL` is set in the child's environment, which beats the
    // `.env` file `loadEnv()` would otherwise supply (dotenv does not override).
    let failed = false;
    let output = '';
    try {
      execFileSync(process.execPath, [SEEDER], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000,
        env: { ...process.env, DATABASE_URL: REMOTE_URL },
      });
    } catch (err) {
      failed = true;
      output = String(err.stdout || '') + String(err.stderr || '');
    }

    assert.ok(failed, 'the seeder did NOT refuse a remote DATABASE_URL — it ran against it');
    assert.match(
      output, /REFUSING TO RUN/,
      `the seeder failed for the wrong reason: ${output.slice(0, 300)}`
    );
    // ⚠ AND IT REFUSED BEFORE TOUCHING THE DATABASE, which is the property rather than "it failed".
    // A refusal after a connection attempt would still have reached the remote host.
    assert.ok(
      !/ENOTFOUND|ECONNREFUSED|getaddrinfo|timeout expired/i.test(output),
      `the seeder tried to CONNECT before refusing: ${output.slice(0, 300)}`
    );
  });

  it('and it calls the shared guard rather than spelling its own', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, SEEDER), 'utf8');
    assert.match(src, /assertLocalDatabase\s*\(/, 'the seeder must call the shared guard');
    assert.match(src, /requireLocalDatabase/, 'the seeder must import it');
  });

  it('and the guard runs BEFORE the input checks, which is where it was first written wrong', () => {
    // ⚠ A RATCHET ON AN ORDERING, BECAUSE THE BEHAVIOURAL CASE ABOVE CANNOT SEE IT ONCE IT PASSES.
    // The first writing placed the guard just above the pool, after the `TEST_MEMBER_*` validation —
    // so a remote URL was refused for the WRONG REASON (missing inputs) and the guard was reachable
    // only by an operator who had supplied them, i.e. the one who could really do damage. The
    // behavioural case went red on the message, which is the only reason this was found.
    const src = fs.readFileSync(path.join(REPO_ROOT, SEEDER), 'utf8');
    const guardAt = src.indexOf('assertLocalDatabase(process.env.DATABASE_URL');
    const inputAt = src.indexOf('process.env.TEST_MEMBER_EMAIL;');
    const poolAt = src.indexOf('new Pool(');
    assert.ok(guardAt > 0 && inputAt > 0 && poolAt > 0, 'harness: all three anchors must be found');
    assert.ok(
      guardAt < inputAt,
      'the local-database guard must run BEFORE the TEST_MEMBER_* validation, or a remote URL is '
      + 'refused for the wrong reason and only after the operator has supplied credentials'
    );
    assert.ok(guardAt < poolAt, 'the guard must run before the pool is constructed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the local-database guard — what is deliberately NOT gated', () => {
  // ⚠ THIS IS A RATCHET, NOT A DESCRIPTION. These three write to the live database ON PURPOSE, and a
  // localhost gate would not make them safer — it would make them useless. Pinning their absence
  // means a later "let's be consistent" pass has to argue with a named case instead of breaking
  // three working operator tools.
  const PRODUCTION_TOOLS = [
    'captureReferredClients.js',
    'recaptureClients.js',
    'redecideStaleClients.js',
  ];

  it('the production operator scripts do NOT carry the local-only guard', () => {
    for (const name of PRODUCTION_TOOLS) {
      const p = path.join(REPO_ROOT, 'server', 'scripts', name);
      assert.ok(fs.existsSync(p), `harness: ${name} must exist, or this case checks nothing`);
      const src = fs.readFileSync(p, 'utf8');
      assert.ok(
        !/assertLocalDatabase/.test(src),
        `${name} has been given the local-only guard — it exists to run against PRODUCTION, so this `
        + 'would disable it. If that is genuinely intended, change this case deliberately.'
      );
    }
  });

  it('and each of them refuses to run without an explicit contractor id', () => {
    // The opt-in that FITS a production tool: naming the tenant, not pinning the host. Without this
    // the case above would read as "these three have no safety at all".
    for (const name of PRODUCTION_TOOLS) {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'server', 'scripts', name), 'utf8');
      assert.match(
        src, /A contractor id (and at least one client id )?(is|are) required\./,
        `${name} must refuse without an explicit contractor id`
      );
    }
  });
});
