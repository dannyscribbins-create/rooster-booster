'use strict';

// ── EVERY READER MOVES ONTO assigned_at (3d Phase 1b Commit 5) ──────────────
// PHASE_1b_DESIGN.md §4. #15: the clients list sorts newest assigned_at first, and Home's
// tie-break follows.
//
// ⚠ THE FIXTURE IS THE WHOLE TEST, AND IT IS BUILT SO THE TWO CLOCKS DISAGREE.
// Every case here seeds rows whose `assigned_at` order is the REVERSE of their `updated_at`
// order. A book written in one burst — which is what a naive fixture produces, and what the
// sweep produces in production — has the two agreeing, and against that **every injection
// in this file passes**: the list looks correctly sorted, the cursor lands in the right
// place, and the window keeps the right rows, all for the wrong reason.
// **`assertClocksDisagree()` is called before the assertions, not after**, so a fixture that
// stopped discriminating fails as a fixture rather than as a silent pass.
//
// ⚠ AND THE PAGING CASE IS THE ONE THAT MATTERS MOST. Moving the ORDER BY onto assigned_at
// while the keyset still compares updated_at does not error — it SILENTLY SKIPS AND
// DUPLICATES ROWS. The only way to see it is to page all the way through and compare the
// collected set against the truth, which is what `pageAll()` does.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const express = require('express');
const repRouter = require('../routes/rep');

const TENANT = 'aa-readers';
const TOKEN = 'aa-readers-token';

let pool, server, port, repId;

const request = async (path, token) => {
  const res = await fetch(`http://localhost:${port}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

// Seeds one assignment with FULL, INDEPENDENT control of THREE clocks.
// ⚠ `stickyDaysAgo` DEFAULTS TO `assignedDaysAgo` AND MUST BE SET APART WHERE THE RETIRED
// EXPRESSION IS THE SUBJECT. A guard-proof caught this: reverting timeframeClause to
// COALESCE(sticky_set_at, provisional_set_at) came back GREEN, because every fixture had
// sticky_set_at EQUAL to assigned_at and the two readings could not differ. The
// discriminating shape is the real one R5f is about — a tenure that began long ago and a
// LOCK that happened recently.
const seed = async (clientId, {
  assignedDaysAgo, updatedMinutesAgo, stickyDaysAgo = null, stage = 'sold', referred = false,
}) => {
  await pool.query(
    `INSERT INTO jobber_clients (contractor_id, jobber_client_id, first_name, last_name, pipeline_stage)
     VALUES ($1, $2, 'C', $2, $3)
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET pipeline_stage = EXCLUDED.pipeline_stage`,
    [TENANT, clientId, stage]
  );
  if (referred) {
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, referred_by, pipeline_status)
       VALUES ($1, $2, 'Someone', $3) ON CONFLICT DO NOTHING`,
      [TENANT, clientId, stage]
    );
  }
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
        updated_at, assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at)
     VALUES ($1, $2, $3, 'mode_a_at_close',
             NOW() - ($6 || ' days')::interval,
             NOW() - ($5 || ' minutes')::interval,
             NOW() - ($4 || ' days')::interval,
             'request', 'r-' || $2, NOW() - ($4 || ' days')::interval)`,
    [TENANT, clientId, repId, String(assignedDaysAgo), String(updatedMinutesAgo),
      String(stickyDaysAgo === null ? assignedDaysAgo : stickyDaysAgo)]
  );
};

// ⚠ THE FIXTURE'S OWN PRECONDITION, ASSERTED. If the two clocks ever order the rows the
// same way, every injection in this file passes and the suite reports health it never
// observed.
const assertClocksDisagree = async () => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT array_agg(jobber_client_id ORDER BY assigned_at DESC, jobber_client_id DESC)
          FROM client_rep_assignments WHERE contractor_id = $1) AS by_assigned,
       (SELECT array_agg(jobber_client_id ORDER BY updated_at DESC, jobber_client_id DESC)
          FROM client_rep_assignments WHERE contractor_id = $1) AS by_updated`,
    [TENANT]
  );
  const { by_assigned: a, by_updated: u } = rows[0];
  assert.ok(a && a.length > 1, 'harness: need more than one row to have an order at all');
  assert.notDeepEqual(a, u,
    'harness: assigned_at and updated_at must order these rows DIFFERENTLY, or every '
    + 'injection in this file passes against the wrong column');
  return { byAssigned: a, byUpdated: u };
};

// Walks every page through the cursor. Returns { seen, pages }.
// ⚠ IT REPORTS THE PAGE COUNT BECAUSE THE CALLER HAS TO ASSERT IT. REP_BOOK_LIMIT is 100,
// so a book of fewer than 101 rows returns everything on page 1, `nextCursor` is null, and
// **the keyset clause is never evaluated at all** — $4 is NULL and the whole condition is
// inert. A guard-proof caught exactly that: reverting the cursor to updated_at came back
// GREEN against a 12-row fixture, because no cursor was ever used.
const pageAll = async (qs = '') => {
  const seen = [];
  let cursor = null;
  let pages = 0;
  for (let guard = 0; guard < 50; guard += 1) {
    const url = `/api/rep/clients?${qs}${qs ? '&' : ''}${cursor ? `cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await request(url, TOKEN);
    assert.equal(res.status, 200, `paging must not error: ${JSON.stringify(res.body)}`);
    pages += 1;
    for (const c of res.body.clients) seen.push(c.jobberClientId);
    cursor = res.body.nextCursor;
    if (!cursor) return { seen, pages };
  }
  throw new Error('paging did not terminate');
};

before(async () => {
  pool = await initTestDb();
  const app = express();
  app.use(express.json());
  app.use('/', repRouter);   // mounted at '/', exactly as createApp() does
  await new Promise((resolve) => { server = app.listen(0, 'localhost', resolve); });
  port = server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

beforeEach(async () => {
  for (const t of ['client_rep_assignments', 'pipeline_cache', 'jobber_clients',
    'sessions', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[TENANT]]);
  }
  await pool.query('DELETE FROM contractors WHERE id = $1', [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  // ⚠ is_field_rep MUST accompany is_attributable — team_members_rep_coherence is
  // CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility)), added by a
  // later ALTER and invisible in the table's CREATE.
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, password_hash, tier, is_field_rep, is_attributable, active)
     VALUES ($1, 'Rep', 'rep@aa-readers.test', 'x', 'general', true, true, true) RETURNING id`,
    [TENANT]
  );
  repId = rows[0].id;
  await pool.query(
    `INSERT INTO sessions (token, role, contractor_id, team_member_id, expires_at, created_at)
     VALUES ($1, 'admin', $2, $3, NOW() + INTERVAL '1 day', NOW())`,
    [TOKEN, TENANT, repId]
  );
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Commit 5 — the clients list sorts and pages on assigned_at (#15)', () => {

  // assigned_at ascending as the number grows; updated_at DESCENDING as it grows. So the
  // two orders are exact reverses of one another.
  const seedOpposed = async (n) => {
    for (let i = 0; i < n; i += 1) {
      await seed(`z${String(i).padStart(3, '0')}`, { assignedDaysAgo: i + 1, updatedMinutesAgo: n - i });
    }
  };

  it('⚠ NEWEST assigned_at FIRST — and the fixture proves updated_at would give another answer', async () => {
    await seedOpposed(6);
    const { byAssigned, byUpdated } = await assertClocksDisagree();

    const res = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.equal(res.status, 200);
    const got = res.body.clients.map((c) => c.jobberClientId);

    assert.deepEqual(got, byAssigned, 'the list is ordered by assigned_at DESC');
    assert.notDeepEqual(got, byUpdated, 'and NOT by updated_at — which orders them otherwise');
  });

  it('⚠ PAGING THROUGH THE WHOLE BOOK LOSES NOTHING AND REPEATS NOTHING', async () => {
    // ⚠ THE CASE THE KEYSET INJECTION IS FOR, AND IT WAS VACUOUS ON ITS FIRST WRITING.
    // A cursor compared against a column the rows are not ordered by produces NO ERROR — it
    // skips and duplicates. Only walking every page and comparing the collected set against
    // the truth can see it.
    // ⚠ IT SEEDED 12 ROWS, AND REP_BOOK_LIMIT IS 100. Everything came back on page 1,
    // nextCursor was null, and the keyset clause was never evaluated — so reverting the
    // cursor to updated_at changed nothing and the guard-proof came back GREEN. **A paging
    // test on a book smaller than one page is not a paging test.** The book is now 105 rows
    // and the page count is ASSERTED, so it cannot quietly shrink back under the limit.
    const N = 105;
    await seedOpposed(N);
    const { byAssigned } = await assertClocksDisagree();

    const { seen, pages } = await pageAll('timeframe=all');

    assert.ok(pages > 1, `harness: the cursor must actually be used — got ${pages} page(s)`);
    assert.equal(pages, 2, 'a 105-row book is two pages at REP_BOOK_LIMIT 100');
    assert.deepEqual(seen, byAssigned, 'every row exactly once, in assigned_at order');
    assert.equal(new Set(seen).size, seen.length, 'no duplicates');
    assert.equal(seen.length, N, 'and none skipped');
  });

  it('the cursor carries assigned_at, not the write clock', async () => {
    // A structural check on the one value that travels between pages. If the cursor still
    // carried updated_at, the page-2 boundary would be computed in the wrong ordering.
    await seedOpposed(4);
    const { rows } = await pool.query(
      `SELECT assigned_at::text AS a, updated_at::text AS u FROM client_rep_assignments
        WHERE contractor_id = $1 ORDER BY assigned_at DESC LIMIT 1`, [TENANT]
    );
    assert.notEqual(rows[0].a, rows[0].u, 'harness: the two clocks must differ on this row');

    const res = await request('/api/rep/clients?timeframe=all', TOKEN);
    // The cursor is opaque base64url of { t, i }; decode it and read what it pinned.
    const page2 = await request(`/api/rep/clients?timeframe=all&cursor=${encodeURIComponent(res.body.nextCursor || '')}`, TOKEN);
    if (res.body.nextCursor) {
      const decoded = JSON.parse(Buffer.from(res.body.nextCursor, 'base64url').toString('utf8'));
      const { rows: last } = await pool.query(
        `SELECT assigned_at::text AS a, updated_at::text AS u FROM client_rep_assignments
          WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, decoded.i]
      );
      assert.equal(decoded.t, last[0].a, 'the cursor pins assigned_at');
      assert.notEqual(decoded.t, last[0].u, 'and not updated_at');
      assert.equal(page2.status, 200);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Commit 5 — the timeframe window is over assigned_at', () => {

  it('⚠ a client whose THREE CLOCKS STRADDLE the boundary is judged by assigned_at', async () => {
    // ⚠ THE DISCRIMINATING FIXTURE, AND IT TOOK A GREEN GUARD-PROOF TO GET IT RIGHT.
    // `straddler` was ASSIGNED 200 days ago, TOUCHED a minute ago, and LOCKED a day ago —
    // which is the real shape R5f exists for: a tenure that began long ago and a same-rep
    // lock that happened recently. Under `assigned_at` it is OUTSIDE the 30-day month;
    // under the retired COALESCE(sticky_set_at, …) it would be INSIDE, and under
    // `updated_at` it would be inside too.
    // ⚠ THE FIRST WRITING SET sticky_set_at EQUAL TO assigned_at, so reverting the clause
    // to the retired expression produced the SAME answer and the guard-proof came back
    // GREEN. A fixture whose columns agree cannot tell two readings apart.
    await seed('straddler', { assignedDaysAgo: 200, updatedMinutesAgo: 1, stickyDaysAgo: 1 });
    await seed('recent', { assignedDaysAgo: 2, updatedMinutesAgo: 500 });

    // The fixture's own precondition: the two readings must disagree about this row.
    const { rows: probe } = await pool.query(
      `SELECT (assigned_at    >= NOW() - INTERVAL '30 days') AS in_month_by_assigned,
              (COALESCE(sticky_set_at, provisional_set_at) >= NOW() - INTERVAL '30 days') AS in_month_by_retired
         FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = 'straddler'`,
      [TENANT]
    );
    assert.equal(probe[0].in_month_by_assigned, false, 'harness: OUT of the month by assigned_at');
    assert.equal(probe[0].in_month_by_retired, true, 'harness: IN by the retired expression');

    const month = await request('/api/rep/clients?timeframe=month', TOKEN);
    const ids = month.body.clients.map((c) => c.jobberClientId);
    assert.ok(ids.includes('recent'), 'a recently ASSIGNED client is in the month');
    assert.ok(!ids.includes('straddler'),
      'a client assigned 200 days ago is OUT, however recently the row was touched');

    const all = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.equal(all.body.clients.length, 2, 'and `all` still has both');
  });

  it('the counts agree with the rows the window returns', async () => {
    // The list, the total and the locked/provisional split all run the same clause; a
    // window on the rows but not the total is "Showing 1 of 2", which is a wrong sentence.
    await seed('straddler', { assignedDaysAgo: 200, updatedMinutesAgo: 1 });
    await seed('recent', { assignedDaysAgo: 2, updatedMinutesAgo: 500 });

    const month = await request('/api/rep/clients?timeframe=month', TOKEN);
    assert.equal(month.body.total, month.body.clients.length);
    assert.equal(month.body.total, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Commit 5 — Home, the detail screen and the admin card', () => {

  it('⚠ Focus §1\'s TIE-BREAK is assigned_at, not updated_at (Q6)', async () => {
    // Both clients are REFERRED and at the SAME stage, so STAGE_RANK cannot separate them
    // and the tie-break alone decides. Their two clocks are opposed, so the wrong tie-break
    // gives the opposite order rather than the same one.
    await seed('f-older-assigned', { assignedDaysAgo: 30, updatedMinutesAgo: 1, stage: 'sold', referred: true });
    await seed('f-newer-assigned', { assignedDaysAgo: 2, updatedMinutesAgo: 900, stage: 'sold', referred: true });
    await assertClocksDisagree();

    const home = await request('/api/rep/home?timeframe=all', TOKEN);
    assert.equal(home.status, 200);
    const ids = home.body.focus.furthestAlong.map((c) => c.jobberClientId);
    assert.deepEqual(ids, ['f-newer-assigned', 'f-older-assigned'],
      'the more recently ASSIGNED client comes first');
  });

  it('Focus §2 is ordered by assigned_at and carries it', async () => {
    // Section 2 is the complement: clients with NO pipeline_cache row.
    await seed('s2-old', { assignedDaysAgo: 40, updatedMinutesAgo: 1 });
    await seed('s2-new', { assignedDaysAgo: 3, updatedMinutesAgo: 900 });
    await assertClocksDisagree();

    const home = await request('/api/rep/home?timeframe=all', TOKEN);
    const section2 = home.body.focus.recentlyAssigned;
    assert.deepEqual(section2.map((c) => c.jobberClientId), ['s2-new', 's2-old']);
    assert.ok(section2[0].assignedAt, 'and the date is shipped');
  });

  it('the client detail screen ships assigned_at', async () => {
    await seed('d1', { assignedDaysAgo: 17, updatedMinutesAgo: 1 });
    const { rows } = await pool.query(
      `SELECT assigned_at, updated_at FROM client_rep_assignments
        WHERE contractor_id = $1 AND jobber_client_id = 'd1'`, [TENANT]
    );

    const res = await request('/api/rep/clients/d1', TOKEN);
    assert.equal(res.status, 200);
    assert.equal(new Date(res.body.assignedAt).toISOString(), new Date(rows[0].assigned_at).toISOString());
    assert.notEqual(new Date(res.body.assignedAt).toISOString(), new Date(rows[0].updated_at).toISOString(),
      'and it is NOT the write clock');
  });

  it('⚠ the admin card reads assigned_at — the last divergent reader, closed', async () => {
    // getClientAssignment used to branch on the REP-ID column while every other reader
    // branched on which DATE was non-null. With one stored date there is nothing to branch
    // on. ⚠ The fixture gives the row a sticky whose sticky_set_at differs from
    // assigned_at, which is exactly the shape the old branch would have returned.
    const { getClientAssignment } = require('../utils/clientAssignment');
    await seed('a1', { assignedDaysAgo: 90, updatedMinutesAgo: 1 });
    await pool.query(
      `UPDATE client_rep_assignments SET sticky_set_at = NOW()
        WHERE contractor_id = $1 AND jobber_client_id = 'a1'`, [TENANT]
    );
    const { rows } = await pool.query(
      `SELECT assigned_at, sticky_set_at FROM client_rep_assignments
        WHERE contractor_id = $1 AND jobber_client_id = 'a1'`, [TENANT]
    );
    assert.notEqual(new Date(rows[0].assigned_at).toISOString(),
      new Date(rows[0].sticky_set_at).toISOString(),
      'harness: the two must differ or this case cannot discriminate');

    const card = await getClientAssignment(pool, TENANT, 'a1');
    assert.equal(new Date(card.set_at).toISOString(), new Date(rows[0].assigned_at).toISOString());
    assert.notEqual(new Date(card.set_at).toISOString(), new Date(rows[0].sticky_set_at).toISOString(),
      'and NOT sticky_set_at, which is what the old branch returned');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Commit 5 — nothing reads the retired columns as "the date"', () => {

  it('⚠ no production reader names the old COALESCE any more', async () => {
    // ⚠ A SOURCE FENCE, BECAUSE A BEHAVIOURAL TEST CANNOT SEE A READER NOBODY DROVE. The
    // batch ruling is that the old columns stay as HISTORY and nothing reads them as "the
    // date"; this is what holds that after the readers moved.
    const fs = require('fs');
    const path = require('path');
    const files = [
      ['routes', 'rep.js'], ['utils', 'repBook.js'], ['utils', 'clientAssignment.js'],
    ];
    let checked = 0;
    for (const parts of files) {
      const src = fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
      // Comments are stripped first: this repo has paid for a needle matching prose, in
      // both directions. The retired expression is DESCRIBED in several of these comments.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/--[^\n]*/g, ' ');
      assert.ok(!/COALESCE\(\s*cra\.sticky_set_at/i.test(code),
        `${parts.join('/')} must not read the retired date COALESCE`);
      checked += 1;
    }
    assert.equal(checked, files.length, 'harness: every named file was actually read');
  });

  it('the SQL doc mirrors the route', async () => {
    // The batch ruling: the SQL doc is updated in the same change. It is a diagnostic a
    // human runs by hand, so a stale one is a wrong answer with no test behind it.
    const fs = require('fs');
    const path = require('path');
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'sql', 'rep_book_partition.sql'), 'utf8');
    assert.match(sql, /cra\.assigned_at/);
    assert.ok(!/COALESCE\(cra\.sticky_set_at/.test(sql), 'no retired expression left in the doc');
  });
});
