'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 2 — 'app_user' AND EVERY OTHER JOBBER-LESS CLIENT IS EXCLUDED FROM DERIVATION
//
// Danny ruling 9, 2026-09-29. One shared predicate, so the exclusion cannot be spelled three
// different ways by the three commits that will need it (4, 7 and the eventual backfill).
//
// ⚠ THE FIXTURES ARE THE REAL PRODUCTION SHAPES, NOT INVENTED ONES. `app_user_10`, `app_user_12`,
// `app_user_13` and `test-client-002` are the four non-derivable `pipeline_cache` rows on
// `accent-roofing-dev` as of 2026-09-29, and the two encoded ids are the two stale referred
// clients the N4 read surfaced. A predicate validated only against ids someone made up is
// validated against someone's idea of the problem.
//
// ⚠ THE DIRECTION THAT MATTERS IS THE FALSE NEGATIVE, AND IT IS TESTED FIRST. A predicate that
// wrongly EXCLUDES a real client is silent and permanent — that client's stage simply stops
// being derived and nothing says so. One that wrongly admits a stray string fails loudly at the
// next query. Production was measured for exactly this: all 19,565 stored `jobber_clients` ids
// satisfy it, zero exclusions.
//
// ⚠ NO DATABASE. Pure unit assertions plus one source-text fence, so this suite seeds nothing,
// writes no table, and joins no reset list.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  JOBBER_CLIENT_GID_PREFIX,
  isDerivableJobberClientId,
  assertDerivableJobberClientId,
  derivableClientIdSql,
} = require('../utils/derivableClient');

// The two stale referred clients from the N4 production read — real encoded ids.
const REAL_RAVINDER = 'Z2lkOi8vSm9iYmVyL0NsaWVudC8xMzkxODg5OTE=';
const REAL_LINDA = 'Z2lkOi8vSm9iYmVyL0NsaWVudC8xNDQ1NDYyMzE=';

// The four non-derivable rows live in production today.
const PRODUCTION_NON_DERIVABLE = ['app_user_10', 'app_user_12', 'app_user_13', 'test-client-002'];

/** Build a real-shaped Jobber client EncodedId for a numeric id. */
function encodeClientId(numericId) {
  return Buffer.from(JOBBER_CLIENT_GID_PREFIX + numericId, 'utf8').toString('base64');
}

describe('N4 commit 2 — a real Jobber client is derivable', () => {
  it('accepts the two real encoded ids from the production read', () => {
    assert.equal(isDerivableJobberClientId(REAL_RAVINDER), true);
    assert.equal(isDerivableJobberClientId(REAL_LINDA), true);
  });

  it('the fixtures really do decode to the Jobber client prefix', () => {
    // ⚠ NON-VACUITY. Without this, both ids above could be arbitrary base64 and the case
    // would still pass — it would be asserting that the predicate accepts SOMETHING, not that
    // it accepts a Jobber client. Proves the fixture is what its name claims.
    for (const id of [REAL_RAVINDER, REAL_LINDA]) {
      const decoded = Buffer.from(id, 'base64').toString('utf8');
      assert.ok(
        decoded.startsWith(JOBBER_CLIENT_GID_PREFIX),
        `fixture ${id} decodes to ${decoded}, which is not a Jobber client id`
      );
    }
  });

  it('accepts encoded ids across a wide range of numeric ids, including padding variants', () => {
    // Base64 padding differs by input length, so an id whose encoding ends `=`, `==` or with
    // no padding at all must all be accepted. A predicate that only ever saw one padding shape
    // would look correct against a single fixture.
    const paddings = new Set();
    for (const n of [1, 42, 6869983, 49084747, 139188991, 144546231, 1234567890123]) {
      const id = encodeClientId(n);
      assert.equal(isDerivableJobberClientId(id), true, `rejected a real-shaped id for ${n}`);
      paddings.add((id.match(/=*$/) || [''])[0].length);
    }
    assert.ok(paddings.size >= 2, `harness: the fixtures must span more than one padding shape, saw ${[...paddings]}`);
  });

  it('accepts the URL-safe alphabet too, because excluding a real client is the silent failure', () => {
    const standard = encodeClientId(999999999999);
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_');
    assert.equal(isDerivableJobberClientId(urlSafe), true);
  });
});

describe('N4 commit 2 — a Jobber-less client is never derivable', () => {
  it('rejects every non-derivable id live in production today', () => {
    for (const id of PRODUCTION_NON_DERIVABLE) {
      assert.equal(
        isDerivableJobberClientId(id), false,
        `${id} is a production pipeline_cache row with no Jobber client and must be excluded`
      );
    }
  });

  it('rejects the app_user placeholder shape for any user id', () => {
    for (const userId of [1, 10, 12, 13, 99, 100000]) {
      assert.equal(isDerivableJobberClientId(`app_user_${userId}`), false);
    }
  });

  it('rejects an id that decodes to a DIFFERENT Jobber type', () => {
    // ⚠ THE SHARPEST NEGATIVE, AND IT IS NOT A NONSENSE STRING. A quote, job or invoice id is
    // valid base64 AND decodes to a real `gid://Jobber/...` — so a predicate that merely
    // checked "decodes to a gid" would accept it, and `decideFromFacts` would then query the
    // fact tables with an invoice id in the client column and get an empty, plausible 'lead'.
    for (const type of ['Quote', 'Job', 'Invoice', 'Request', 'User']) {
      const id = Buffer.from(`gid://Jobber/${type}/12345`, 'utf8').toString('base64');
      assert.equal(
        isDerivableJobberClientId(id), false,
        `a ${type} id must not pass a CLIENT predicate`
      );
      assert.ok(
        Buffer.from(id, 'base64').toString('utf8').startsWith('gid://Jobber/'),
        `harness: the ${type} fixture must really be a Jobber gid, or this negative is vacuous`
      );
    }
  });

  it('rejects a NON-CANONICAL encoding that decodes to a real client gid', () => {
    // ⚠ THIS CASE WAS VACUOUS ON ITS FIRST WRITING, AND A GUARD-PROOF IS WHAT SAID SO.
    // It used to insert a `!` into a valid id and assert the result was rejected. It was —
    // but by the CHARSET REGEX, three lines before the round-trip check ever ran. Removing
    // the round-trip check left the case GREEN (measured: width 0), so it was testing the
    // regex while claiming to test the round-trip.
    //
    // The discriminating fixture has to PASS the charset and length tests and still fail the
    // round-trip: base64 ignores the unused low bits of the final character, so changing that
    // character yields a DIFFERENT string that decodes to the SAME bytes.
    // `...C8xMR==` decodes to `gid://Jobber/Client/11` and re-encodes as `...C8xMQ==`.
    const canonical = Buffer.from(JOBBER_CLIENT_GID_PREFIX + '11', 'utf8').toString('base64');
    const nonCanonical = canonical.slice(0, -3)
      + String.fromCharCode(canonical.charCodeAt(canonical.length - 3) + 1)
      + canonical.slice(-2);

    // The harness assertions are the whole point here: they prove the fixture reaches the
    // round-trip rather than being turned away earlier.
    assert.notEqual(nonCanonical, canonical, 'harness: the fixture must differ from the canonical id');
    assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(nonCanonical), 'harness: it must PASS the charset test');
    assert.equal(nonCanonical.length % 4, 0, 'harness: it must PASS the length test');
    assert.equal(
      Buffer.from(nonCanonical, 'base64').toString('utf8'), JOBBER_CLIENT_GID_PREFIX + '11',
      'harness: it must decode to a real client gid, or the prefix check would reject it anyway'
    );

    assert.equal(isDerivableJobberClientId(nonCanonical), false);

    // ⚠ AND REJECTING IT IS CORRECT RATHER THAN MERELY STRICT, WHICH IS WORTH STATING BECAUSE
    // THE PREDICATE OTHERWISE PREFERS TO ADMIT. Two distinct strings decoding to one client
    // would break the `(contractor_id, jobber_client_id)` uniqueness every fact table depends
    // on — one client, two rows. And canonicality is MEASURED, not assumed: all 19,565 stored
    // `jobber_clients` ids were accepted by this predicate with the round-trip check active.
    assert.equal(isDerivableJobberClientId(canonical), true, 'the canonical form must still pass');
  });

  it('rejects non-strings, empty strings and nullish values without throwing', () => {
    for (const bad of [null, undefined, '', 0, 42, {}, [], true, Symbol.iterator]) {
      assert.equal(isDerivableJobberClientId(bad), false, `${String(bad)} must be rejected quietly`);
    }
  });
});

describe('N4 commit 2 — the assert guard and the SQL fragment', () => {
  it('assertDerivableJobberClientId throws on a placeholder and names the caller', () => {
    assert.throws(
      () => assertDerivableJobberClientId('app_user_10', 'decideFromFacts'),
      (err) => err.message.includes('decideFromFacts') && err.message.includes('app_user_10')
    );
  });

  it('assertDerivableJobberClientId is silent on a real id', () => {
    // The paired positive. Without it, a guard that threw on EVERYTHING would pass the case
    // above — CLAUDE.md's "a plausible-looking rejection is not the rejection you are testing
    // for", one layer in.
    assert.doesNotThrow(() => assertDerivableJobberClientId(REAL_LINDA, 'decideFromFacts'));
  });

  it('⚠ decideFromFacts does NOT yet enforce this, and the reason is measured', async () => {
    // ⚠ THIS CASE RECORDS A DELIBERATE ABSENCE, WHICH IS WHY IT ASSERTS THE ABSENCE RATHER
    // THAN SKIPPING. Commit 2 first wired `assertDerivableJobberClientId` into
    // `decideFromFacts` — the one function every derivation path goes through, and the
    // obvious home for the guard. **The full gate went red with 120 failures across 12
    // suites**, every one a fixture using a synthetic client id (`"c1"`, `"client-1"`) that
    // is correct for its own test and is not a Jobber EncodedId.
    //
    // The guard is right and the placement is premature: nothing today feeds
    // `decideFromFacts` a non-derivable id, so it would buy no protection in exchange for a
    // 120-case fixture migration. **That migration is sized here so the next session does not
    // rediscover it: 120 cases, 12 suites** — assignedAtWriters, assignmentPreview,
    // attributionDecide, attributionWiring, captureThenDecide, clientAssignmentCorrection,
    // clientLock, oneEngineFromFacts, repAssignmentRebuild, repImportScope,
    // requestAttribution, stageWebhooks.
    //
    // The consumer arrives at N4 commit 4 (the referred-capture backfill) and commit 7 (the
    // status derivation), which are the first paths to iterate a population that actually
    // CONTAINS non-derivable rows. **Until then this predicate is called by its callers, not
    // by the decider**, and pretending otherwise would be the orphaned-utility shape.
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'attributionDecide.js'), 'utf8');
    assert.ok(
      !src.includes('assertDerivableJobberClientId'),
      'decideFromFacts now enforces the predicate — that is a real improvement, but it needs '
      + 'the 120-case fixture migration described above. Do the migration in the same commit, '
      + 'then delete this case.'
    );
  });

  it('derivableClientIdSql refuses anything that is not a plain column identifier', () => {
    // It is interpolated, so the validation is what keeps it from becoming an injection point.
    for (const bad of ["x'; DROP TABLE users; --", 'a b', '1abc', '', null, 'tbl.col.extra']) {
      assert.throws(() => derivableClientIdSql(bad), /plain column identifier/);
    }
  });

  it('derivableClientIdSql accepts a bare column and a qualified one', () => {
    for (const good of ['jobber_client_id', 'pc.jobber_client_id']) {
      const sql = derivableClientIdSql(good);
      assert.ok(sql.includes(good), `the fragment must mention ${good}`);
      assert.ok(sql.includes(JOBBER_CLIENT_GID_PREFIX), 'the fragment must test the client prefix');
    }
  });

  it('the SQL fragment tests length BEFORE decoding, or a short id aborts the statement', () => {
    // Postgres decode(..., 'base64') RAISES on malformed input rather than returning null, so
    // the order of the AND terms is load-bearing: a single short id would otherwise take down
    // the whole query rather than being filtered out of it.
    const sql = derivableClientIdSql('jobber_client_id');
    assert.ok(
      sql.indexOf('length(') < sql.indexOf('decode('),
      'the length guard must short-circuit before decode() is reached'
    );
  });
});

describe('N4 commit 2 — the exclusion is written once', () => {
  it('no other file spells the app_user exclusion for itself', () => {
    // ⚠ WALKED, NOT A TYPED LIST, and comments stripped line-preservingly so a finding names
    // the real line. The point of a shared predicate is defeated the moment a second file
    // writes `LIKE 'app_user_%'` into a derivation query of its own.
    const SERVER_ROOT = path.join(__dirname, '..');
    const REPO_ROOT = path.join(__dirname, '..', '..');
    const strip = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'test' && path.resolve(dir) === path.resolve(SERVER_ROOT)) continue;
          if (entry.name === 'node_modules') continue;
          walk(full);
        } else if (entry.name.endsWith('.js')) files.push(full);
      }
    })(SERVER_ROOT);
    assert.ok(files.length > 50, `harness: the walk must reach the server tree, saw ${files.length}`);

    // Needle assembled from pieces, so this file cannot report itself if the walk ever widens.
    const NEEDLE = 'app' + '_user_%';
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      const src = strip(fs.readFileSync(file, 'utf8'));
      if (!src.includes(NEEDLE)) continue;
      const line = src.slice(0, src.indexOf(NEEDLE)).split('\n').length;
      offenders.push(`${rel}:${line}`);
    }

    // ⚠ ONE SANCTIONED SITE, AND IT IS NOT A DERIVATION. `syncSingleClient` deletes the signup
    // placeholder row once the real Jobber client has been upserted. That is cleanup, not a
    // status decision, and it legitimately keys on the literal shape.
    assert.deepEqual(
      offenders.filter((o) => !o.startsWith('server/crm/pipelineSync.js:')), [],
      'the app_user exclusion must be expressed through derivableClient.js, not re-spelled:\n  '
      + offenders.join('\n  ')
    );
    assert.equal(
      offenders.length, 1,
      `harness: exactly one sanctioned site is expected (the placeholder cleanup), saw ${offenders.length}: ${offenders.join(', ')}`
    );
  });
});
