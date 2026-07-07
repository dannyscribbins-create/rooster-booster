# Tenant Resolution Rebuild — Build Specification

**Status:** Ready for execution. Written 2026-07-07 as a read-only planning session — no code was changed to produce this document.

**Changelog:** v1.0 — 2026-07-07, initial spec. v1.2 — Q1 confirmed via Jobber docs July 7, 2026; Batch C unblocked; six other open questions (Q2–Q7) remain; spec is build-ready for Session 3's webhook work. **v1.3 — Q2–Q7 resolutions recorded July 7, 2026; combined with v1.2's Q1 confirmation, all seven open questions are now genuinely resolved; spec is build-ready with zero external unknowns.**

**Scope:** Audit findings F7 (users/sessions schema has no tenant boundary) + F1 (26 call sites resolve tenant via a fail-closed singleton helper), batched with the `createApp()` factory refactor, per the audit's own Fix Sequencing recommendation ("F7 and F1 are the load-bearing pair — batch them with... the `createApp()` refactor, since all four touch the same 'how does a request know its contractor' problem").

**Explicitly OUT of scope** (tracked separately, do not fold into this work):
- F2 (`oauth.js` token `id=1` hardcode), F3 (`refreshTokenIfNeeded()` tenant-blindness), F4 (two `WHERE id=1` token reads), F5 (`runScheduledSync` single-contractor discovery) — the audit calls these "a separable, self-contained CRM-token fix that can be its own session."
- F6 (`admin_cache` / `announcement_settings` global singletons) — independent, can be done anytime by anyone.
- F8 (users-matching in invoice-paid webhook + `pipelineSync.js` referrer-account lookup, no `contractor_id` filter) — already tracked and deferred; this spec's schema change makes F8 *exercisable* for the first time, so it is called out at every relevant point below, but the fix itself is not in scope here.
- F9, F10 (hardcoded `'accent-roofing'` in `stripe.js`, `account.js`) — tracked pre-launch cleanup, separate sweep.

**Governing rule for every decision below:** Accent-ready must equal contractor-#2-ready by design. There is no "quick patch for now, fix it properly later" anywhere in this document.

**Correction to the audit:** F1 states `server/routes/referrer.js` has **21 call sites** for `getDefaultContractorId()`. A fresh, exhaustive grep against the current file (2026-07-07) finds **16** actual invocations (4 more matches are `// MVP: ... resolved via getDefaultContractorId()` comments, 1 is the `require()` line — 21 total string matches, 16 real calls). `webhooks/jobber.js` checks out exactly at 5. This does not change the shape of the fix — every real call site is still accounted for in Section 4 — but Section 4's table uses the verified count (16), not the audit's.

---

## 1. Plain-Language Overview

### What is RoofMiles, in one sentence?

RoofMiles is one piece of software that different roofing companies ("contractors") can each run their own referral-rewards program on — homeowner referral, jobber pipeline tracking, cash out, the works. Right now exactly one contractor (Accent Roofing) uses it. Danny is preparing to onboard a second one.

### What does "tenant resolution" mean?

Every time someone uses the app — a referrer logging in, a homeowner's Jobber invoice getting paid, an admin looking at their dashboard — the server has to answer one question before it does anything else: **"whose data is this?"** That answer is the `contractor_id`. Get it right, and Contractor A never sees Contractor B's data. Get it wrong, and you either crash (safe) or leak one contractor's referrers/invoices/payouts into another contractor's screen (not safe).

Today, the server answers that question for referrer-facing traffic (login, pipeline, cash out — literally the whole app a referrer uses) and for every Jobber webhook using a helper function called `getDefaultContractorId()`. Read literally, that function's job is: *"look in the `contractors` table, and if there is exactly one row, hand back its id. If there are zero rows or two-or-more rows, refuse and throw an error."* That's not a bug — it was built on purpose, in a prior session, specifically so that the day someone *did* try to add a second contractor without finishing this rebuild first, the app would loudly break instead of quietly mixing up two companies' data. It is a tripwire, and it is working as designed.

### Why does this rebuild have to happen before contractor #2 goes live?

Because the tripwire firing means the referrer app and every Jobber webhook **stop working completely** — for Contractor A too, not just the new one — the instant that second `contractors` row is inserted. There is currently no other way for those code paths to know whose request they're handling. This isn't a "nice to have" — contractor #2 cannot be onboarded at all until this exists, because turning it on breaks contractor #1.

### What's the actual fix, in plain terms?

The admin side of this app already solved this problem, months ago: when an admin logs in, the server writes that admin's `contractor_id` onto their session row, and every admin-side request just reads it back off the session — no guessing, no singleton table. This rebuild does the *same thing* for referrers: add a `contractor_id` column to the table that stores referrer accounts (`users`), stamp it onto the session at login the same way admin login already does, and change every one of those 16 + 5 call sites to read `session.contractorId` (or the webhook-side equivalent) instead of asking the singleton-table tripwire. Once every call site reads from a real, per-request source of truth, the tripwire itself can be safely deleted — it will have no callers left.

The webhook side is harder, because a webhook has no "session" — Jobber calls RoofMiles's server directly, with no login step in between. As of this update, that side is fully solved: Jobber's own webhook payload includes an identifier for which Jobber account (i.e., which contractor) sent the event, confirmed via official Jobber documentation, so Section 4's webhook batch can be built with no remaining unknowns. Section 3's login/forgot-pin flows still carry one open question for Danny (Section 9) — not about webhooks, but about a narrow, reasoned exception to a client-trust rule.

### What breaks if this ISN'T done carefully?

Two failure modes, and this rebuild has to avoid both:
1. **Fails loud (current state):** the tripwire throws, app goes down for everyone. Bad, but safe — no data leaks.
2. **Fails silent (the risk of doing this rebuild carelessly):** a request from Contractor B's referrer accidentally reads or writes Contractor A's data because some code path still trusts a client-supplied value, or a schema change wasn't backfilled correctly, or a stale session slipped through. This is *worse* than the current state, because nothing would look wrong until someone noticed the data.

Every decision in this document is written to avoid failure mode 2, even where that means being more conservative or doing more work than the minimum needed to make the referrer app "work."

---

## 2. Schema Migration Plan

All migration statements go into `initDB()` in `server/db.js`, following the codebase's existing idempotent pattern (`ADD COLUMN IF NOT EXISTS`, `pg_constraint` pre-check for constraints — see `tokens_contractor_id_unique` at `db.js:285-295` for the exact pattern to copy). **Do not write a standalone migration script** — `server/migrations/` is documented as one-time/superseded; new schema changes belong in `initDB()` per the existing convention (`add_referrer_bank_columns.js` and `add_notification_email_columns.js` are the two still-imported examples).

### 2.1 Current state (confirmed by direct read of `server/db.js`)

```sql
-- db.js:23-26
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, pin TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
)
-- (16+ later ALTER TABLE users ADD COLUMN IF NOT EXISTS statements add profile_photo,
-- phone, jobber_client_id, email_verified, deleted_at, etc. — none add contractor_id.)

-- db.js:41-47
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
)
-- db.js:1122 ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id)
-- (nullable, no default — currently populated ONLY by admin login, admin/index.js:66)
```

`users.email` has exactly one constraint: the inline `UNIQUE` on the `CREATE TABLE`, which Postgres auto-names `users_email_key` (default `<table>_<column>_key` naming for a single-column inline `UNIQUE`). **VERIFIED (2026-07-07, Railway console, screenshot-confirmed) — the name is exactly `users_email_key`.** (Verification query, for reference: `SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'u';`.) Step 4 below runs exactly as written, no name substitution needed.

### 2.2 Target state

```sql
users:
  ... (all existing columns, unchanged)
  contractor_id TEXT NOT NULL REFERENCES contractors(id)   -- NEW
  -- UNIQUE(email) REPLACED BY UNIQUE(contractor_id, email)
```

No changes needed to `sessions.contractor_id` — the column already exists with the right type and FK; it just needs to start being populated at referrer login too (Section 3).

### 2.3 Migration order (safe on the LIVE database, with real data)

**VERIFIED (2026-07-07, Railway console, screenshot-confirmed):** `SELECT COUNT(*), array_agg(id) FROM contractors;` returns count `1`, `["accent-roofing-dev"]`. This matches the data-state findings from Session 94 (registry, Known Issues section) and satisfies Section 2 Step 2's backfill precondition — the migration's fail-closed guard will pass on the first run. This migration is only safe to run while that remains true — **it must be the very next contractor-related migration to run, before any second `contractors` row is ever inserted.**

**Step 1 — Add the column, nullable, no default.**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id);
```
Rollback: `ALTER TABLE users DROP COLUMN IF EXISTS contractor_id;`

**Step 2 — Backfill every existing row to the single current contractor, but fail closed if that assumption no longer holds.** This mirrors `getDefaultContractorId()`'s own fail-closed philosophy, applied once, at migration time, in SQL:
```sql
DO $$
DECLARE
  the_contractor_id TEXT;
  contractor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO contractor_count FROM contractors;
  IF contractor_count <> 1 THEN
    RAISE EXCEPTION 'users.contractor_id backfill aborted: expected exactly 1 contractors row, found %. This migration is only safe pre-contractor-#2 — investigate before re-running.', contractor_count;
  END IF;

  SELECT id INTO the_contractor_id FROM contractors LIMIT 1;

  UPDATE users SET contractor_id = the_contractor_id WHERE contractor_id IS NULL;
END $$;
```
Rollback: `UPDATE users SET contractor_id = NULL;` (only meaningful before Step 3 runs — after Step 3, rollback is "drop the NOT NULL constraint first," see Step 3's rollback).

**Step 3 — Enforce NOT NULL, once every row is backfilled.**
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'contractor_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN contractor_id SET NOT NULL;
  END IF;
END $$;
```
Rollback: `ALTER TABLE users ALTER COLUMN contractor_id DROP NOT NULL;`

**Same-deploy requirement triggered by this step (Q5, Section 9 — resolved, elevated into this session's scope):** once this `NOT NULL` constraint is live, `POST /api/admin/users`'s `INSERT INTO users (full_name,email,pin,phone) VALUES ($1,$2,$3,$4)` (`admin/referrers.js:69`, no `contractor_id` column) starts failing with a `NOT NULL` violation on **every call, in production, immediately** — this is not a future contractor-#2 risk, it is an immediate breakage of this migration's own deploy. The fix (`INSERT INTO users (full_name,email,pin,phone,contractor_id) VALUES ($1,$2,$3,$4,$5)`, using the admin session's own `contractorId` already in scope earlier in that file) is therefore **part of Section 2's migration, not Section 4's call-site batches** — it must ship in the same deploy as Step 3, not deferred to Session 2. The founding-referrer `COUNT(*) FROM users` at `admin/referrers.js:79` rides along in the same one-line-each commit, since it's the same file, same cause. See Section 8, Session 1 for the updated scope this creates.

**Step 4 — Replace the global email UNIQUE with a per-contractor one.** Two sub-statements — drop then add, guarded so a re-run of `initDB()` is idempotent:
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_contractor_id_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_contractor_id_email_unique UNIQUE (contractor_id, email);
  END IF;
END $$;
```
Rollback (exact inverse, run in the opposite order):
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_contractor_id_email_unique;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
```
**Danny must confirm no two existing rows would collide** before Step 4's `ADD CONSTRAINT` runs — with a real single-contractor dataset this is structurally impossible (the old global `UNIQUE(email)` already guarantees no duplicate emails exist at all, so a stricter per-contractor unique constraint can only ever be *more* permissive, never rejected by existing data). No pre-check query is needed for this specific migration for that reason — call this out explicitly so a future session doesn't waste time on an unnecessary verification step, but also doesn't skip Step 1-3's own guards.

**Step 5 — No changes needed to `sessions` schema.** `sessions.contractor_id` already exists (`db.js:1122`), nullable, FK'd to `contractors(id)`. Leave the column nullable — do not add `NOT NULL` to `sessions.contractor_id`. Reason: `role='super_admin'` sessions (`server/routes/superAdmin.js:47`) intentionally have no `contractor_id` (platform-wide, not tenant-scoped) — see `server/middleware/auth.js:76-94`, `verifySuperAdminSession()`. Forcing `NOT NULL` here would break that role. Referrer-session correctness is enforced at the application layer instead (Section 3's `verifyReferrerSession()` change), not at the schema layer, for this one column.

### 2.4 Order safety notes

- Steps 1→2→3→4 must run in that exact order, in that exact grouping, inside `initDB()`. Because `initDB()` runs every statement sequentially on every boot (all idempotent), simply adding these five blocks in this order to `db.js` is sufficient — no separate deploy step needed.
- **Run Backup Now (Backblaze) immediately before this deploy**, per the non-negotiable CLAUDE.md rule ("Always click Run Backup Now before any migration or DB-touching push") — this touches the `users` table's core identity constraint, the highest-blast-radius table in the schema.
- This migration does **not** touch `sessions`, `team_members`, `contractors`, or any other table — it is isolated to `users`.

---

## 3. Session Stamping Plan

### 3.1 The admin-side template (already built, do not modify)

```js
// server/routes/admin/index.js:66-67
await pool.query(
  'INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id) VALUES (NULL,$1,$2,$3,$4,$5)',
  [token, expiresAt, 'admin', teamMember.contractor_id, teamMember.id]
);
```
```js
// server/middleware/auth.js:11-32
async function verifyAdminSession(req, res) {
  ...
  const result = await pool.query(
    'SELECT s.contractor_id, s.team_member_id FROM sessions s WHERE s.token=$1 AND s.role=$2 AND s.expires_at > NOW()',
    [token, 'admin']
  );
  ...
  return { contractorId: result.rows[0].contractor_id, teamMemberId: result.rows[0].team_member_id };
}
```
The key property: `contractor_id` is stamped from the **verified DB row** (`teamMember.contractor_id`, read from `team_members` by a query that already required a correct password match) — never from anything the client sent directly. `verifyAdminSession()` then just reads it back off the session row on every subsequent request. This is the exact shape to replicate for referrers.

### 3.2 Referrer login change

Current code (`server/routes/referrer.js:741-744`):
```js
const sessionResult = await pool.query(
  'INSERT INTO sessions (user_id, token, expires_at, device_info, ip_address) VALUES ($1,$2,$3,$4,$5) RETURNING id',
  [user.id, token, expiresAt, deviceInfo, ipAddress]
);
```
New code:
```js
const sessionResult = await pool.query(
  'INSERT INTO sessions (user_id, token, expires_at, device_info, ip_address, role, contractor_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
  [user.id, token, expiresAt, deviceInfo, ipAddress, 'referrer', user.contractor_id]
);
```
`user.contractor_id` comes from the row already fetched at `referrer.js:731` (`SELECT id, full_name, email, pin, phone FROM users WHERE LOWER(email) = LOWER($1)`) — add `contractor_id` to that column list. **This is the same "already-verified DB row" pattern as admin login** — by the time this INSERT runs, `bcrypt.compare` has already confirmed the PIN, so `user.contractor_id` is trustworthy exactly the way `teamMember.contractor_id` is.

Note: the existing `INSERT` does not currently set `role` at all — it relies on the column default (`sessions.role DEFAULT 'referrer'`, `db.js:50`). Setting it explicitly here is a minor hygiene improvement (matches the admin insert's explicit style) but is not load-bearing; keep it explicit for symmetry and to make the session row self-documenting during the migration window when both old (no `contractor_id`) and new (with `contractor_id`) referrer sessions may briefly coexist.

### 3.3 `verifyReferrerSession()` change

Current (`server/middleware/auth.js:41-65`):
```js
async function verifyReferrerSession(req, res) {
  ...
  const result = await pool.query(
    `SELECT s.id AS session_id, s.user_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.role = $2 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
    [token, 'referrer']
  );
  ...
  return { userId: result.rows[0].user_id, sessionId: result.rows[0].session_id };
}
```
New:
```js
async function verifyReferrerSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return null; }
  try {
    const result = await pool.query(
      `SELECT s.id AS session_id, s.user_id, s.contractor_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.role = $2
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
         AND s.contractor_id IS NOT NULL`,
      [token, 'referrer']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return null;
    }
    return {
      userId: result.rows[0].user_id,
      sessionId: result.rows[0].session_id,
      contractorId: result.rows[0].contractor_id,
    };
  } catch (err) {
    logError({ req, error: err, source: 'verifyReferrerSession' });
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}
```
Two changes from today's version: (1) `s.contractor_id` added to the `SELECT` and the returned object — this is the whole point; (2) `AND s.contractor_id IS NOT NULL` added to the `WHERE` clause — this is what handles pre-migration sessions (next subsection). Every existing call site in `referrer.js` already does `const session = await verifyReferrerSession(req, res); if (!session) return;` — none of them need to change *how* they call it, only what they do with the returned object (Section 4).

### 3.4 What happens to sessions created before the migration — DECISION: invalidate, do not backfill

**Chosen: invalidate.** Every referrer session row created before this deploy has `contractor_id IS NULL` (today's schema literally cannot populate it — the column exists on `sessions` but nothing writes it for `role='referrer'`). The `AND s.contractor_id IS NOT NULL` clause added in 3.3 means those rows simply stop matching, and any request carrying an old token gets a normal 401 `"Session expired. Please log in again."` — indistinguishable from a naturally expired session from the client's point of view. No explicit `DELETE FROM sessions` or backfill `UPDATE` is needed; the old rows become dead weight that the existing `session_cleanup` cron job (daily 2am UTC, per registry) will eventually purge on its normal expiry-based cleanup pass.

**Why not backfill instead** (e.g. `UPDATE sessions s SET contractor_id = u.contractor_id FROM users u WHERE s.user_id = u.id AND s.role='referrer' AND s.contractor_id IS NULL`)? Backfilling is *possible* — the data to do it correctly exists once `users.contractor_id` is populated — but it buys nothing here and adds risk: (a) referrer sessions expire in 24 hours by design (CLAUDE.md: "Sessions expire 24 hours. Never extend TTL without explicit instruction"), so the disruption window for forcing a re-login is at most one day, self-healing with zero code; (b) a backfill UPDATE is one more live-data-touching statement to get right and roll back if wrong, for a benefit (avoiding one re-login) that is smaller than the risk; (c) unlike admin sessions (which might represent a longer, more deliberate work session an admin would be annoyed to lose), referrer login is a two-field form (email + PIN) with no OAuth dance behind it — cheap to redo. Invalidate-via-fail-closed-query is strictly simpler and carries less risk, and matches this rebuild's governing rule (correctness over convenience) better than a backfill UPDATE would.

**Deploy-order consequence:** because of this, the `verifyReferrerSession()` change (3.3) and the login-stamping change (3.2) must ship in the **same deploy** as the schema migration (Section 2). Shipping the schema change alone (contractor_id column exists but nothing stamps or checks it yet) is safe and inert. Shipping 3.3 without 3.2 would lock out every currently-logged-in referrer with no way to get a valid session at all (login wouldn't stamp `contractor_id` yet, so the new WHERE clause would reject every session including brand new ones) — do not split these two across separate deploys.

### 3.5 Pre-session flows: login, forgot-pin, signup — the harder problem, solved without new client trust

Sections 3.2-3.4 cover *authenticated* requests. Three referrer-facing flows have no session yet at the point they need to know the contractor: **signup**, **login**, and **forgot-pin**. Each is handled differently, and the differences matter:

**Signup — already solved, no new mechanism needed.** `POST /api/signup` (`referrer.js:203`) requires an `inviteSlug` and looks it up first: `SELECT id, contractor_id, link_type, created_by_user_id FROM contractor_invite_links WHERE slug=$1 AND active=true` (`referrer.js:218-222`). `contractor_invite_links.contractor_id` already exists and is trustworthy — it was set when the invite link itself was created (by an authenticated admin, or by an authenticated peer referrer), not supplied by the person signing up. **Fix:** thread `link.contractor_id` into (a) the duplicate-email check at `referrer.js:229` (add `AND contractor_id = $2`), and (b) the `INSERT INTO users` at `referrer.js:241` (add `contractor_id` to the column list, `link.contractor_id` to the values). No client-supplied contractor identity is introduced. `POST /api/signup/verify-email` (`referrer.js:420`, the `getDefaultContractorId()` call at line 466) is even simpler — it already has `userId` in hand and already does `SELECT ... FROM users WHERE id=$1` at line 436; add `contractor_id` to that column list and use `newUser.contractor_id` directly. **No trust decision needed for either of these two.**

**Login and forgot-pin — genuinely need a new, narrow, deliberately-scoped exception.** `POST /api/login` (`referrer.js:728`) and `POST /api/forgot-pin` (`referrer.js:1114`) each take only an `email` (plus PIN, for login) — no invite slug, no prior session, nothing else that ties the request to a contractor. Post-migration, `WHERE LOWER(email) = LOWER($1)` alone is ambiguous the moment two contractors exist and happen to share a referrer email address (a real, if narrow, possibility — nothing prevents the same person, or an unrelated person, from having accounts at two different contractors under the same address).

**Decision: add a `contractorSlug` field to the request body of these two endpoints only, sourced from `CONTRACTOR_CONFIG.contractorId` on the frontend (`src/config/contractor.js:15`), and use it strictly to scope the `WHERE` clause — never to bypass a check.**

This is a deliberate, reasoned exception to the hardened rule written into `src/config/contractor.js:9-13` ("`contractorId` below must NEVER be sent to the backend or used to resolve tenancy... no client-supplied contractor id is trusted anywhere in the referrer API surface"), which exists because of a real 2026-07-06 incident (referrer app resolving to the wrong tenant after a `contractors` table rename, per the recent commit history). **APPROVED by Danny (Section 9, Q2 — resolved 2026-07-07), subject to two binding conditions covered after the reasoning below.** **The reasoning for why this exception is safe, unlike that incident:**

- The incident's danger was a client-supplied contractor id being used to directly *select whose data to serve*, with no independent verification step in between (the exact shape of audit findings F4 and F1 — pick a contractor, hand back that contractor's Jobber data / pipeline / tokens, no password, no ownership check).
- `contractorSlug` on login is used only to narrow a `WHERE` clause **before** a `bcrypt.compare()` PIN check still has to pass. If the frontend sends the wrong slug (stale build, misconfiguration, or an attacker guessing), the query simply finds no matching row (or the wrong row, which then fails the PIN check) — the result is an ordinary `401 Invalid email or PIN`, not data disclosure. It is the same trust category as `contractor_invite_links.slug` (an opaque, non-secret, DB-verified scoping token) — not the same category as a value that is trusted *instead of* a credential check.
- `contractorSlug` on forgot-pin narrows the same `WHERE` clause before a `pin_reset_tokens` row is created and an email is sent. A wrong slug means "no match found" → the endpoint's existing generic response (`"If that email is registered, you'll receive a reset link shortly."`) is returned either way — this endpoint is already written to reveal nothing about whether an email exists, and scoping it correctly only makes that guarantee tenant-aware too.

**Exact change for login** (`referrer.js:728-735`):
```js
router.post('/api/login', referrerLoginLimiter, async (req, res) => {
  const { email, pin, contractorSlug } = req.body;
  if (!contractorSlug) return res.status(400).json({ error: 'Missing contractor context.' });
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, pin, phone, contractor_id FROM users WHERE contractor_id = $1 AND LOWER(email) = LOWER($2)',
      [contractorSlug, email]
    );
    ...
```
**Exact change for forgot-pin** (`referrer.js:1114-1122`):
```js
router.post('/api/forgot-pin', forgotPinLimiter, async (req, res) => {
  const { email, contractorSlug } = req.body;
  const genericResponse = { message: "If that email is registered, you'll receive a reset link shortly." };
  if (!contractorSlug) return res.json(genericResponse); // fail closed to the same generic response — never reveal the missing-param distinction
  try {
    const userResult = await pool.query(
      'SELECT id, full_name, email, contractor_id FROM users WHERE contractor_id = $1 AND LOWER(email) = LOWER($2)',
      [contractorSlug, email]
    );
    ...
```
Note `forgot-pin`'s missing-slug case returns the *same* generic response as a not-found email, not a 400 — this preserves the endpoint's existing "never reveal whether an email is registered" property even under a malformed/missing request.

**Frontend change required** (out of this spec's server-side scope, but must ship in the same deploy): `LoginScreen.jsx` and `ResetPinScreen.jsx` (`src/components/auth/`) must add `contractorSlug: CONTRACTOR_CONFIG.contractorId` to their existing `POST /api/login` and `POST /api/forgot-pin` request bodies. This is the only place in this entire rebuild where `CONTRACTOR_CONFIG.contractorId` starts being sent to the backend.

**Two binding conditions from Danny's approval (Section 9, Q2), both hard blockers on shipping this — do not ship `contractorSlug` on either endpoint until both land in the same commit:**

**Condition 1 — the hardened-rule comment at `src/config/contractor.js:9-13` must be rewritten**, replacing the old absolute rule with the narrower one this spec actually establishes. Exact replacement text for a future session to write into that file (not written by this spec-only session):
```js
// Display/branding config only. contractorId below may be sent to the backend ONLY on the
// two pre-session endpoints that explicitly accept a contractorSlug field (POST /api/login,
// POST /api/forgot-pin — see TENANT_RESOLUTION_REBUILD_SPEC.md Section 3.5), where it scopes
// a WHERE clause that a credential check (PIN, or a not-found-either-way generic response)
// still gates. It may NEVER be used to select whose data to serve on any authenticated or
// data-returning endpoint. This narrower rule replaces the original blanket "never send to
// backend" rule after the 2026-07-06 tenant-resolution rebuild (approved by Danny, spec
// Section 9, Q2, 2026-07-07).
//
// Planned retirement: once per-contractor Host-header/subdomain-based tenant resolution
// exists, this exception should be removed and contractorSlug deleted from both endpoints'
// request bodies — same retirement discipline as getDefaultContractorId() (Section 5).
```
A future reader must never be able to find the old absolute "never send to backend" comment still in place alongside code that sends it — that contradiction is exactly what this condition prevents.

**Condition 2 — the planned-retirement note is included in the same comment** (already folded into the block above): the long-term replacement at white-label scale is Host-header/subdomain-based tenant resolution, not a permanent `contractorSlug` carve-out. This gives the exception the same kind of explicit retirement path `getDefaultContractorId()` has (Section 5), rather than leaving it open-ended.

Once `getDefaultContractorId()` at `referrer.js:1139` (inside forgot-pin, used only to look up `contractor_settings.email_sender_name`/`company_name` for the reset email's "from" name) is replaced, use the `contractor_id` now returned by the scoped query directly — no separate resolution call needed.

---

## 4. Call-Site Conversion Table

Every real invocation (16 in `referrer.js`, 5 in `webhooks/jobber.js` — see the correction note at the top of this document) with its exact replacement, grouped into commit-sized batches, plus a "Batch B-extended" group for three additional cross-tenant sites found during Phase 0.6 that don't call `getDefaultContractorId()` at all but break the same way (resolved as Q6/Q7, Section 9). Each batch is independently deployable and independently testable — do not combine batches into one commit.

### Batch A — Pre-session flows (3 sites, needs the frontend `contractorSlug` change from 3.5 in the same deploy)

| # | File:Line | Route | Current | Replacement |
|---|-----------|-------|---------|-------------|
| A1 | `referrer.js:229` | `POST /api/signup` (not a `getDefaultContractorId()` call, but breaks the same way — global email check) | `SELECT id FROM users WHERE LOWER(email)=LOWER($1)` | `SELECT id FROM users WHERE contractor_id = $1 AND LOWER(email)=LOWER($2)`, params `[link.contractor_id, email]` |
| A2 | `referrer.js:241` | `POST /api/signup` INSERT | `INSERT INTO users (full_name, email, pin, phone, invite_slug, invited_by_user_id, signup_source, email_verified) VALUES (...)` | add `contractor_id` column + `link.contractor_id` value |
| A3 | `referrer.js:466` | `POST /api/signup/verify-email` | `const pipelineContractorId = await getDefaultContractorId();` | Add `contractor_id` to the `SELECT full_name, email FROM users WHERE id=$1` at line 436 (rename to `newUser` and reuse the existing lookup at line 453 which already selects from `users WHERE id=$1` — consolidate into one query returning `full_name, email, contractor_id`); use `newUser.contractor_id` in place of `pipelineContractorId` |
| A4 | `referrer.js:731` | `POST /api/login` | `SELECT id, full_name, email, pin, phone FROM users WHERE LOWER(email) = LOWER($1)` | Per 3.5: add `contractorSlug` param, `contractor_id` to SELECT list, `WHERE contractor_id = $1 AND LOWER(email) = LOWER($2)` |
| A5 | `referrer.js:742` | `POST /api/login` session INSERT | (3.2) | add `role`, `contractor_id` columns |
| A6 | `referrer.js:1120` + `1139` | `POST /api/forgot-pin` | `SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)` then later `getDefaultContractorId()` | Per 3.5: add `contractorSlug` param + `contractor_id` to SELECT + WHERE scoping; delete the `getDefaultContractorId()` call entirely, use `user.contractor_id` |

**Verification for Batch A:** two-contractor simulation (Section 7) — seed two contractors, two users with the same email under each, confirm login with contractor A's slug + contractor A's PIN succeeds and returns contractor A's data only; confirm login with contractor B's slug + contractor A's PIN fails with a normal 401.

### Batch B — Session-derived sites, 14 already-authenticated routes (mechanical, one-line change each)

All 14 follow the identical pattern: the route already calls `const session = await verifyReferrerSession(req, res); if (!session) return;` above the `getDefaultContractorId()` call. Once Section 3.3 ships, replace `const contractorId = await getDefaultContractorId();` with `const contractorId = session.contractorId;` (or, for line 466's `pipelineContractorId` variable name, keep the existing local variable name and just change the right-hand side — do not rename variables mid-refactor, per the "no drift" rule in Section 8).

| # | File:Line | Route |
|---|-----------|-------|
| B1 | `referrer.js:533` | `GET /api/pipeline` (branch 1) |
| B2 | `referrer.js:626` | `GET /api/pipeline` (branch 2) |
| B3 | `referrer.js:808` | `GET /api/referrer/enabled-payout-methods` |
| B4 | `referrer.js:849` | `POST /api/cashout` |
| B5 | `referrer.js:1075` | `POST /api/profile/photo` |
| B6 | `referrer.js:1286` | `GET /api/referrer/qr-code` |
| B7 | `referrer.js:1318` | `GET /api/referrer/my-invite-link` |
| B8 | `referrer.js:1347` | `GET /api/referrer/about` |
| B9 | `referrer.js:1443` | `POST /api/referrer/booking` |
| B10 | `referrer.js:1596` | `GET /api/referrer/leaderboard` |
| B11 | `referrer.js:1889` | `POST /api/referrer/missing-referral` |
| B12 | `referrer.js:2143` | `POST /api/referrer/feedback` |
| B13 | `referrer.js:2221` | `GET /api/referrer/schedules` |
| B14 | `referrer.js:2253` | `GET /api/referrer/conversions` |

**Verification for Batch B:** the existing `contractorResolution.test.js` rename-safety pattern, extended to a genuine two-contractor case (Section 7) — session for contractor A must never return contractor B's schedules/conversions/pipeline rows even when both exist in the same test DB.

Batch B can be split across multiple commits if preferred (e.g., one per route, or grouped by feature area) since every site is independent and mechanically identical — but all 14 must ship in the same deploy as Section 3.3 (they'd otherwise call a `session.contractorId` that doesn't exist yet on old sessions, though since 3.3 and 3.2 are also same-deploy, this is naturally satisfied).

### Batch B-extended — three sites found in Phase 0.6, not part of the original F1/F7 list, resolved as Q6/Q7 (Section 9) and folded into Session 2

None of these call `getDefaultContractorId()` — they're cross-tenant risks caused by the same `users` schema change, found during investigation rather than named in the audit. Each is a one-line-each fix, decided in scope for Session 2 alongside Batch B.

| # | File:Line | Fix |
|---|-----------|-----|
| BX1 | `server/cron/jobs/engagementCadence.js:84` | `LEFT JOIN users u ON u.email = c.email` → `LEFT JOIN users u ON LOWER(u.email) = LOWER(c.email) AND u.contractor_id = c.contractor_id`. Two changes on the same line, decided together (Q6): the `contractor_id` join condition this rebuild requires, plus normalizing the pre-existing case-sensitive match bug of the same shape — not worth a separate follow-up session since the line is already being touched. |
| BX2 | `server/cron/jobs/postJobSequence.js:77` | `WHERE LOWER(email) = LOWER($1)` → `WHERE LOWER(email) = LOWER($1) AND contractor_id = $2`, with `$2` supplied from whatever contractor context the cron job is already iterating under (Q6). |
| BX3 | `server/routes/admin/campaigns.js:502` | `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1` → `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND contractor_id = $2 LIMIT 1`, `$2` from the admin session's `contractorId` already in scope in `upsertContactRecord()`'s caller. **Hard scope fence (Q7): this one line only.** No other line in `admin/campaigns.js` is touched in Session 2 regardless of what else is found nearby — the review diff for this file must show exactly one changed line. This does not reopen the file's "known complexity debt" status (~3,163 lines, CLAUDE.md) for any other purpose. |

**Verification for Batch B-extended:** extend the two-contractor isolation test (Section 7.1) with three narrow assertions — a cadence email match, a post-job-sequence match, and a campaign contact upsert must each resolve only within the requesting contractor's own `users` rows, never across `CONTRACTOR_A`/`CONTRACTOR_B` in the test DB.

### Batch C — Webhook handlers, 5 sites — **UNBLOCKED** (Q1 confirmed, 2026-07-07: the payload carries `accountId`)

| # | File:Line | Handler | Resolution mechanism |
|---|-----------|---------|---|
| C1 | `webhooks/jobber.js:392` | `disconnect` | `accountId` → `contractor_crm_settings.jobber_account_id` lookup. N/A in practice — unreachable from Jobber today (no subscription registered), fixed for consistency only |
| C2 | `webhooks/jobber.js:452` | `client-create` | `accountId` → `contractor_crm_settings.jobber_account_id` lookup (no local-DB fallback needed — the client doesn't exist in `jobber_clients` yet, but that no longer matters since `accountId` resolves it directly) |
| C3 | `webhooks/jobber.js:529` | `client-update` | `accountId` lookup as primary path; `SELECT contractor_id FROM jobber_clients WHERE jobber_client_id = $1` kept as a defensive fallback (client already synced at least once) |
| C4 | `webhooks/jobber.js:607` | `invoice-paid` | `accountId` → `contractor_crm_settings.jobber_account_id` lookup (resolves the chicken-and-egg problem noted in the original draft of this spec — no GraphQL call is needed before contractor identity is known) |
| C5 | `webhooks/jobber.js:1126` | `job-update` | Same as C4 |

**Finalized resolution mechanism, all 5 handlers:**

**(a) Schema — new column on `contractor_crm_settings`, not `tokens`.** `contractor_crm_settings` is chosen over `tokens` for one reason: it is already the table that holds CRM-connection metadata (`crm_type`, `crm_account_name`, `connected_at`, `sync_interval_mins`, etc.) — `jobber_account_id` is exactly that kind of fact ("which Jobber account is this connection to"), not a credential. `tokens` is explicitly out of scope for this rebuild (F2/F3 — its `id=1` hardcode and tenant-blind refresh are a separate, already-tracked session) and this spec deliberately does not touch it.
```sql
ALTER TABLE contractor_crm_settings ADD COLUMN IF NOT EXISTS jobber_account_id TEXT;
```
No `UNIQUE` constraint is required for correctness (a lookup by `jobber_account_id` only needs to find the one matching row; `contractor_id` is already the table's `PRIMARY KEY`, so at most one row per contractor already holds any given `jobber_account_id` in practice) — but add one anyway, guarded per the existing `pg_constraint` pre-check pattern, since two contractors sharing a `jobber_account_id` would itself indicate an OAuth-connection bug worth surfacing immediately rather than silently misrouting webhooks:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_crm_settings_jobber_account_id_unique'
  ) THEN
    ALTER TABLE contractor_crm_settings ADD CONSTRAINT contractor_crm_settings_jobber_account_id_unique UNIQUE (jobber_account_id);
  END IF;
END $$;
```

**(b) OAuth callback captures it at connect time.** `server/routes/oauth.js`'s callback, immediately after the token exchange, adds one GraphQL call:
```js
const accountResult = await retryWithBackoff(
  () => axios.post(
    'https://api.getjobber.com/api/graphql',
    { query: `query { account { id } }` },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
  ),
  { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
);
const jobberAccountId = accountResult.data?.data?.account?.id;
await pool.query(
  `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)
   ON CONFLICT (contractor_id) DO UPDATE SET jobber_account_id = EXCLUDED.jobber_account_id`,
  [contractorId, jobberAccountId]
);
```
This runs once per contractor, at the moment they connect (or reconnect) Jobber — no ongoing maintenance, no dependency on webhook traffic to populate itself.

**(c) Webhook handlers resolve `contractor_id` via `accountId`, fail closed via the existing quarantine pattern:**
```js
async function resolveWebhookContractorId(payload, fallbackLookup) {
  const accountId = payload?.data?.webHookEvent?.accountId; // confirmed field name, Jobber Developer Center docs, 2026-07-07
  if (accountId) {
    const { rows } = await pool.query(
      'SELECT contractor_id FROM contractor_crm_settings WHERE jobber_account_id = $1',
      [accountId]
    );
    if (rows.length) return rows[0].contractor_id;
  }
  if (fallbackLookup) {
    const viaLocalData = await fallbackLookup();
    if (viaLocalData) return viaLocalData;
  }
  throw new Error('resolveWebhookContractorId: could not resolve contractor_id from payload accountId or local data');
}
```
This function replaces every `getDefaultContractorId()` call in `webhooks/jobber.js`. `fallbackLookup` is supplied only for C3 (the `jobber_clients` lookup, kept as defense-in-depth for a client record that predates the `jobber_account_id` backfill below); C1/C2/C4/C5 pass `undefined` and rely entirely on `accountId`, which is sufficient because it's present on every event, including the first-ever `client-create` for a brand-new client. On failure it throws into the existing `catch` block that already calls `logWebhookResolutionFailure()` (`webhooks/jobber.js:291-296`) — no new error-handling shape needed, this reuses the exact quarantine pattern already built for the 2026-07-06 fix.

**Backfill for the existing `accent-roofing-dev` contractor:** chosen approach is a **one-time manual capture during Session 3**, not a wait-for-next-token-refresh approach. Reasoning: `accent-roofing-dev` already holds a valid, connected access token today, so there is no need to wait for any future refresh cycle — Session 3 can run the exact same `account { id }` GraphQL query from (b) once, directly, against the currently-live token, and `UPDATE contractor_crm_settings SET jobber_account_id = '<result>' WHERE contractor_id = 'accent-roofing-dev'` immediately. This is deterministic and has no timing dependency, unlike piggybacking on a refresh cycle (which only fires on token expiry and would leave the column NULL — and every webhook handler failing closed via `logWebhookResolutionFailure()` — for an unpredictable window after Session 3 deploys).

**Two payload-era notes for future reference (both already satisfied by this app, no action needed, recorded here so a future session doesn't have to re-verify):**
- Jobber apps created after April 11, 2022 receive webhook payloads as `application/json` — this app does (confirmed by the existing `express.raw({ type: 'application/json' })` middleware and HMAC verification already in place).
- Jobber apps created after December 8, 2023 use the correctly-spelled `occurredAt` field (not the earlier `occuredAt` typo some older Jobber apps still receive) — this app does, so any future code reading event timestamps from the payload should use `occurredAt`, not `occuredAt`.

**"Done" statement for Batch C, no longer conditional:** all 5 handlers, including `client-create` for a brand-new never-before-seen client, resolve `contractor_id` correctly the moment `accent-roofing-dev`'s `jobber_account_id` backfill (above) completes and the OAuth-callback change (b) is deployed for future contractor connections. There is no remaining caveat to attach to this batch.

---

## 5. `getDefaultContractorId()` Retirement Plan

**Do not delete it as part of Batches A, B, or C.** Retire it only after all three batches are deployed, verified in production for at least one full day (covers the daily cron cycles and a realistic login/webhook traffic sample), and after confirming via grep that zero call sites remain:

```bash
grep -rn "getDefaultContractorId" server/ --include="*.js" | grep -v "/test/" | grep -v "contractorContext.js"
```
Expected output after retirement is safe: empty (or only comment-only matches, which should also be cleaned up in the same pass).

**Deletion steps:**
1. Delete `getDefaultContractorId()` and its export from `server/utils/contractorContext.js`. If nothing else lives in that file, delete the file entirely and remove its `require()` from every former caller.
2. Delete or rewrite `server/test/contractorResolution.test.js`'s three "fail-closed tripwire" tests (`contractorResolution.test.js:93-108`) — they directly test the function being deleted. **Do not just delete them silently** — replace them with a test asserting the function no longer exists as an export (a "pin its absence" test, per the task's requirement):
   ```js
   it('getDefaultContractorId has been retired — contractorContext.js no longer exports it', () => {
     assert.throws(() => require('../utils/contractorContext'), /Cannot find module/);
     // OR, if the file is kept for other future single-lookup helpers:
     // const mod = require('../utils/contractorContext');
     // assert.equal(mod.getDefaultContractorId, undefined);
   });
   ```
3. Rewrite the remaining tests in `contractorResolution.test.js` (the `GET /api/referrer/schedules`, `/conversions`, `/pipeline`, `/enabled-payout-methods` rename-safety tests, lines 110-207) to seed a real referrer session with `contractor_id` stamped (per Section 3.2) instead of relying on the singleton-table pattern — these tests are still valuable, they just need to stop depending on the retired function's existence.

**Registry edit superseding the old rule:** `CLAUDE_REGISTRY.md`'s architecture section does not currently contain an explicit "always adopt `getDefaultContractorId()`" rule as a standalone line — the closest is the *Known Issues* entry 2a: *"When these are swept, adopt `getDefaultContractorId()` — do not invent a second parallel resolution helper"* (referring to the still-open `stripe.js`, `account.js`, etc. sweep). **This line must be edited** once this rebuild ships, because it will instruct a future session to adopt a function that no longer exists. Replace it with:
> "When these are swept, resolve `contractor_id` from `verifyAdminSession()`'s or `verifyReferrerSession()`'s returned `contractorId` — do not reintroduce `getDefaultContractorId()` or invent a new singleton-table helper. It was retired in the tenant-resolution rebuild (see `TENANT_RESOLUTION_REBUILD_SPEC.md`) specifically because it cannot support more than one contractor."

Also update `CLAUDE.md`'s "Known MVP shortcuts" line — *"`contractor_id` hardcoded as `'accent-roofing'` in all MVP endpoints — must be pulled from session token before contractor #2"* — this line describes the *problem* this rebuild fixes; once shipped, either delete it or change it to a past-tense note (e.g. "RESOLVED — see tenant-resolution rebuild") so a future reader doesn't think the shortcut still exists.

---

## 6. `createApp()` Refactor Scope

### 6.1 Why this is bundled with F7/F1

Investigation found **three independent, hand-rolled, partial re-implementations** of `server.js`'s app-construction logic already living in the test suite:
- `server/test/helpers.js:187-197` — `buildTestApp()` (webhook router only)
- `server/test/ownerParity.test.js:63-71` — `buildOwnerParityApp()` (admin routes only, with a comment explicitly noting it "mirrors the two `app.use()` calls in server.js... confirmed by adminRouteCoverage drift guard" — i.e., a test already exists purely to catch this duplication drifting out of sync)
- `server/test/requirePermission.test.js:16-34` — `buildPermissionTestApp()` (a different subset of admin routes)

None of these mount `referrer.js` alongside the admin routes in the same app instance, and none exercise the exact middleware order `server.js` uses (helmet, CORS, the raw-body-before-json split for webhooks). This is exactly the kind of drift this rebuild's two-contractor isolation tests (Section 7) need to not have to fight — they need one real app, not a fourth hand-rolled variant.

### 6.2 Exact change to `server.js`

Split `server.js` into two files:

**New file: `server/app.js`** — everything from the current `server.js` except the `app.listen()` call and the cron-scheduling IIFE:
```js
const express = require('express');
const cors = require('cors');
const oauthRoutes = require('./routes/oauth');
const referrerRoutes = require('./routes/referrer');
const adminRoutes = require('./routes/admin/index');
const superAdminRoutes = require('./routes/superAdmin');
const stripeRoutes = require('./routes/stripe');
const jobberWebhooks = require('./routes/webhooks/jobber');
const resendWebhookRouter = require('./routes/resendWebhook');
const accountRoutes = require('./routes/account');
const unsubscribeRoutes = require('./routes/unsubscribe');
const { expressErrorHandler } = require('./middleware/errorLogger');
const helmet = require('helmet');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.get('/health', (req, res) => res.json({ status: 'ok', version: process.env.APP_VERSION || 'unknown', timestamp: new Date().toISOString() }));
  app.use(cors());
  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use('/api/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '5mb' }));

  app.use('/webhooks', jobberWebhooks);
  app.use('/api/webhooks', resendWebhookRouter);
  app.use('/', oauthRoutes);
  app.use('/', referrerRoutes);
  app.use('/', adminRoutes);
  app.use('/', superAdminRoutes);
  app.use('/', stripeRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/', unsubscribeRoutes);

  app.use(expressErrorHandler);
  return app;
}

module.exports = { createApp };
```
Note: the path is `server/app.js` (inside the `server/` folder, alongside `db.js`), so its internal `require()` paths lose the `./server/` prefix — this is a mechanical path adjustment during the move, not a logic change.

**Rewritten `server.js`** (project root, unchanged location — stays the lean entry point):
```js
require('dotenv').config();
const { initDB } = require('./server/db');
const { createApp } = require('./server/app');
const { startCronJobs } = require('./server/cron/index');
const { runBackup } = require('./server/utils/backup');
const cron = require('node-cron');

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[server] Unhandled promise rejection:', reason)
  const { logError } = require('./server/middleware/errorLogger')
  await logError({ req: null, error: reason instanceof Error ? reason : new Error(String(reason)) })
})

process.on('uncaughtException', async (err) => {
  console.error('[server] Uncaught exception:', err)
  const { logError } = require('./server/middleware/errorLogger')
  await logError({ req: null, error: err })
})

const app = createApp();

;(async () => {
  try {
    await initDB();
    startCronJobs();
  } catch (err) {
    console.error('[server] initDB() failed — cron jobs will NOT start:', err);
    const { logError } = require('./server/middleware/errorLogger');
    logError({ req: null, error: err, source: 'startup' });
  }
})();

cron.schedule('0 2 * * *', async () => {
  console.log('[Backup] Scheduled daily backup starting...');
  try {
    await runBackup();
    console.log('[Backup] Scheduled daily backup completed successfully.');
  } catch (err) {
    console.error('[Backup] Scheduled daily backup FAILED:', err.message);
  }
});

app.listen(4000, () => console.log('Server running on port 4000'));
```

This is a pure extraction — no middleware order changes, no route changes, no behavior changes. `server.js` stays under the ~80-line target (it's now ~35 lines); `server/app.js` is the new home for what used to be inline in `server.js`, and is still not "route handlers or business logic" (it only mounts already-defined routers) — it does not violate the "server.js is a lean entry point" rule because it isn't `server.js`.

### 6.3 What the test harness gains

Tests can now do:
```js
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');
const app = createApp();
const { server, port } = await startTestServer(app);
```
and get the **exact same app** `server.js` runs in production — full route surface (referrer + admin + webhooks + oauth + stripe + account + unsubscribe), exact same middleware order, zero drift risk from a fourth hand-rolled variant. No `initDB()`/cron side effects fire (those stay in `server.js`, not `server/app.js`), so tests remain in full control of schema setup via `initTestDb()` exactly as today.

### 6.4 Which existing tests get upgraded

- **`server/test/ownerParity.test.js`** — replace `buildOwnerParityApp()` (lines 63-90ish) with `createApp()`. This directly closes the drift risk the file's own comment already flags ("mirrors the two `app.use()` calls in server.js... confirmed by adminRouteCoverage drift guard") — the drift guard becomes structurally impossible instead of comment-enforced.
- **`server/test/requirePermission.test.js`** — replace `buildPermissionTestApp()` (lines 16-34) with `createApp()`.
- **`server/test/helpers.js`** — `buildTestApp()` (lines 187-197) can either be deleted in favor of every webhook test calling `createApp()` directly, or kept as-is if any webhook test intentionally wants the narrower webhook-only surface for speed/isolation. **Decision: keep it.** Webhook tests don't need the referrer/admin route surface mounted, and mounting it adds no test value there — only tests that need cross-router behavior (the two-contractor isolation tests in Section 7) need the full `createApp()`.
- **`server/test/contractorResolution.test.js`** — its own local `buildTestApp()` (lines 25-32, referrer-only) should also switch to `createApp()`, since Section 4's Batch A fixes touch both `referrer.js` and (for the frontend `contractorSlug` change) nothing else server-side — but using the real `createApp()` here means this file's tests also implicitly verify no other router's middleware breaks referrer routes, which the narrower hand-rolled version couldn't catch.
- **New two-contractor isolation test** (Section 7) should be written against `createApp()` from the start — no reason to hand-roll a fifth variant for a test that specifically needs the full route surface across two simulated tenants.

---

## 7. Test Plan — RED-first, written BEFORE implementation

Per CLAUDE.md's Testing section and the project's TDD discipline: write every test below, confirm it fails for the *expected* reason (not a typo or missing import), THEN implement Sections 2-6.

### 7.1 Two-contractor isolation simulation (the centerpiece test — write this first)

New file: `server/test/tenantIsolation.test.js`
```js
'use strict';
const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedSession, seedReferralSchedule } = require('./helpers');
const { request: _httpRequest } = require('node:http');

function httpGet(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'GET', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(port, path, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(bodyObj));
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('two-contractor isolation — the core guarantee of this rebuild', () => {
  let pool, server, port;
  const CONTRACTOR_A = 'test-tenant-a';
  const CONTRACTOR_B = 'test-tenant-b';

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractors');
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Tenant A', 'active'), ($2, 'Tenant B', 'active')`, [CONTRACTOR_A, CONTRACTOR_B]);
  });

  it('same email, two contractors: login with contractor A slug + A password succeeds and returns only A data', async () => {
    const bcrypt = require('bcrypt');
    const pinA = await bcrypt.hash('1234', 10);
    const pinB = await bcrypt.hash('5678', 10);
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id) VALUES
       ('Referrer A', 'shared@test.com', $1, $2), ('Referrer B', 'shared@test.com', $3, $4)`,
      [pinA, CONTRACTOR_A, pinB, CONTRACTOR_B]
    );

    const loginA = await httpPost(port, '/api/login', { email: 'shared@test.com', pin: '1234', contractorSlug: CONTRACTOR_A });
    assert.equal(loginA.status, 200, `expected login success, got: ${JSON.stringify(loginA.body)}`);

    const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [loginA.body.token]);
    assert.equal(rows[0].contractor_id, CONTRACTOR_A, 'session stamped with the logging-in user\'s own contractor, not the other tenant');
  });

  it('same email, two contractors: contractor A slug + contractor B password fails with a normal 401 (no cross-tenant credential match)', async () => {
    const bcrypt = require('bcrypt');
    const pinA = await bcrypt.hash('1234', 10);
    const pinB = await bcrypt.hash('5678', 10);
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id) VALUES
       ('Referrer A', 'shared@test.com', $1, $2), ('Referrer B', 'shared@test.com', $3, $4)`,
      [pinA, CONTRACTOR_A, pinB, CONTRACTOR_B]
    );

    const crossAttempt = await httpPost(port, '/api/login', { email: 'shared@test.com', pin: '5678', contractorSlug: CONTRACTOR_A });
    assert.equal(crossAttempt.status, 401, 'contractor A slug + contractor B\'s password must not succeed');
  });

  it('a valid contractor-A session cannot read contractor-B schedules', async () => {
    const userA = (await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id) VALUES ('Referrer A', 'a@test.com', 'x', $1) RETURNING id`,
      [CONTRACTOR_A]
    )).rows[0].id;
    const tokenA = 'a'.repeat(64);
    await seedSession(pool, { userId: userA, token: tokenA, role: 'referrer', contractorId: CONTRACTOR_A });
    await seedReferralSchedule(pool, { contractorId: CONTRACTOR_B, jobberLabel: 'Roof Replacement', flatAmount: 999 });

    const resp = await httpGet(port, '/api/referrer/schedules', { authorization: `Bearer ${tokenA}` });
    assert.equal(resp.status, 200);
    assert.equal(resp.body.schedules.length, 0, 'contractor A session must see zero of contractor B\'s schedules');
  });

  it('a pre-migration-shaped session (contractor_id NULL) is rejected, not silently allowed through', async () => {
    const userA = (await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id) VALUES ('Referrer A', 'legacy@test.com', 'x', $1) RETURNING id`,
      [CONTRACTOR_A]
    )).rows[0].id;
    const legacyToken = 'b'.repeat(64);
    // Simulate an old, pre-migration session row: no contractor_id, exactly what existed before this deploy.
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id) VALUES ($1, $2, NOW() + INTERVAL '1 hour', 'referrer', NULL)`,
      [userA, legacyToken]
    );

    const resp = await httpGet(port, '/api/referrer/schedules', { authorization: `Bearer ${legacyToken}` });
    assert.equal(resp.status, 401, 'a session with no contractor_id must fail closed, forcing re-login');
  });

  it('rename-safety: renaming contractor A\'s id does not leak into contractor B\'s session resolution', async () => {
    const RENAMED = 'test-tenant-a-renamed';
    await pool.query('UPDATE contractors SET id = $1 WHERE id = $2', [RENAMED, CONTRACTOR_A]);
    // FK on users.contractor_id and sessions.contractor_id must cascade or this UPDATE itself
    // would fail — if it fails, that is itself useful signal for Section 9.
    const userA = (await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id) VALUES ('Referrer A', 'renamed@test.com', 'x', $1) RETURNING id`,
      [RENAMED]
    )).rows[0].id;
    const token = 'c'.repeat(64);
    await seedSession(pool, { userId: userA, token, role: 'referrer', contractorId: RENAMED });
    await seedReferralSchedule(pool, { contractorId: RENAMED, jobberLabel: 'Roof Replacement', flatAmount: 250 });

    const resp = await httpGet(port, '/api/referrer/schedules', { authorization: `Bearer ${token}` });
    assert.equal(resp.status, 200);
    assert.equal(resp.body.schedules.length, 1, 'schedule under the renamed id is still visible after rename');
  });
});
```
**Expected failure before implementation:** every test above fails, most with `column "contractor_id" of relation "users" does not exist` — confirming the test suite genuinely exercises the not-yet-built schema, not a typo.

### 7.2 Webhook-derivation correctness tests

New file: `server/test/webhookTenantDerivation.test.js` — extend the existing `signJobberWebhook`/`httpPost` pattern from `webhookContractorResolution.test.js`. Since Q1 is resolved, every handler gets a real assertion (no `it.todo` placeholders needed):
- **C2 (`client-create`)**: seed a `contractor_crm_settings` row with a known `jobber_account_id` under contractor A, send a signed `client-create` webhook whose payload's `data.webHookEvent.accountId` matches that value, for a client id that does NOT yet exist in `jobber_clients`, assert the handler resolves `contractor_id = 'A'` and the new client row lands under contractor A.
- **C3 (`client-update`)**: two sub-cases — (i) seed a `jobber_clients` row under contractor A with no `contractor_crm_settings.jobber_account_id` set yet, send a signed webhook with a matching `accountId` anyway, assert resolution still succeeds via the `accountId` path; (ii) seed only the `jobber_clients` fallback (no matching `jobber_account_id` row), assert the fallback lookup still resolves `contractor_id = 'A'`.
- **C4 (`invoice-paid`) / C5 (`job-update`)**: seed `contractor_crm_settings.jobber_account_id` under contractor A, send a signed webhook with a matching `accountId`, assert `contractor_id` resolves to A before any Jobber GraphQL call would need to happen (mock `fetchInvoiceWithJobs`/`fetchFullClient` to confirm they're invoked with contractor A's token, not a default/global one).
- **Resolution failure case**: send a signed webhook with an `accountId` that matches no `contractor_crm_settings` row, assert `logWebhookResolutionFailure()`'s quarantine path fires (an `error_log` row is written, event acked 200) — the fail-closed behavior for a genuinely unresolvable event (e.g., a Jobber account that was never actually connected) must still work.

### 7.3 Rename-safety (already partially covered in 7.1's last test)

Extend the *existing* `server/test/contractorResolution.test.js` rename pattern (already proven, `RENAMED_CONTRACTOR_ID = 'rename-safety-tenant'`) rather than replacing it — after Section 5's retirement pass, this file's tests should assert the same rename-survives-the-request behavior but via `session.contractorId`, not via `getDefaultContractorId()`.

### 7.4 `createApp()` parity test

New assertion in `ownerParity.test.js` or a new small file: instantiate `createApp()` twice and assert the returned route stacks are structurally equivalent (or, simpler: assert a known route from each of the six mounted routers — `/health`, `/auth/jobber`, `/api/login`, `/api/admin/login`, `/api/rm-control/login`, `/webhooks/jobber/client-create` — all resolve to a non-404 status when hit, proving all six `app.use()` mounts are present). This is the regression test that makes the "adminRouteCoverage drift guard" comment in `ownerParity.test.js` literally true instead of aspirational.

---

## 8. Execution Order Across Sessions

Three sessions, each with a hard STOP checkpoint before the next begins. **Do not attempt to compress this into one session** — the schema migration (Session 1) must be deployed and verified live before Session 2's application code can be meaningfully tested against real data shape, and Session 2 must ship before Session 3's webhook work can be verified end-to-end against live Jobber traffic.

### Session 1 — Schema + `createApp()` + the migration's own same-deploy fix (lowest risk, ships first)

**Scope:** Section 2 (schema migration, including the Q5-elevated `admin/referrers.js:69` and `:79` fix) + Section 6 (`createApp()` refactor). **Do not touch any of the 26 F1/F7 call sites yet** — `getDefaultContractorId()` keeps working exactly as today throughout this session, because nothing that calls it changes. The one exception is `admin/referrers.js:69`/`:79`, which is not a `getDefaultContractorId()` call site at all but is elevated into this session because Step 3's `NOT NULL` constraint would otherwise break it immediately (Q5, Section 9 — see the callout in Section 2, Step 3).

1. Backblaze backup (manual, before touching `db.js`).
2. Write Section 7.4's `createApp()` parity test (RED).
3. Implement Section 6 (`server/app.js` extraction). Run parity test → GREEN.
4. Update `ownerParity.test.js`, `requirePermission.test.js`, `contractorResolution.test.js` to use `createApp()` (Section 6.4). Run full suite → GREEN (this alone should not change any test's pass/fail outcome — it's a pure plumbing swap).
5. Write Section 2's migration into `db.js` (Steps 1-4, in order).
6. Fix `admin/referrers.js:69` (`INSERT INTO users` — add `contractor_id`, sourced from the admin session's own `contractorId`) and `admin/referrers.js:79` (founding-referrer `COUNT(*)` — scope by `contractor_id`), in the same commit as Step 5. Add a test asserting `POST /api/admin/users` still succeeds post-migration (this is the regression Q5 exists to prevent — without this fix, this exact request 500s the moment Step 3 lands).
7. Run `npm test` locally against `roofmiles_test` (which gets rebuilt from scratch via `initTestDb()` on every run — the new schema is exercised automatically). Expect: all currently-passing tests still pass, including the new `admin/referrers.js:69` regression test.
8. **STOP CHECKPOINT 1.** Deploy to Railway. Verify live: `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='contractor_id';` returns one row; `SELECT COUNT(*) FROM users WHERE contractor_id IS NULL;` returns `0`; `SELECT conname FROM pg_constraint WHERE conrelid='users'::regclass AND contype='u';` shows `users_contractor_id_email_unique`, not `users_email_key`. Confirm the live app still works end-to-end (login, pipeline, cash out) — it must, since nothing else reads the new column yet. **Additionally confirm `POST /api/admin/users` (admin-creates-a-referrer) still succeeds live** — this is the one behavior this migration does change, and it must be verified explicitly, not assumed. **Do not proceed to Session 2 until this checkpoint passes.**

**"Done" for Session 1, stated in advance:** schema exists, is backfilled, is constrained correctly, live app behavior is unchanged for every referrer-facing flow and for `POST /api/admin/users` specifically (verified, not assumed), `npm test` is fully green, `createApp()` is live in `server.js` and in three test files.

### Session 2 — Referrer-side resolution (Batches A + B + B-extended, Sections 3, 4, 5)

**Scope:** Section 3 (session stamping) + Section 4 Batches A, B, and B-extended (19 + 3 = 22 sites total) + the frontend `contractorSlug` change (3.5), **gated on both of Q2's binding conditions landing in the same commit** + Section 5 partial retirement (referrer.js side only — `webhooks/jobber.js` still calls `getDefaultContractorId()` at this point, so do not delete the function yet, only stop calling it from `referrer.js`).

1. Backblaze backup.
2. Write Section 7.1's full `tenantIsolation.test.js` (RED — expect failures like "login endpoint doesn't accept contractorSlug" or 401s where 200s are expected), extended per Batch B-extended's verification note (cadence/post-job/campaign cross-tenant assertions).
3. **Before writing any Batch A code:** rewrite the `src/config/contractor.js:9-13` comment per Section 3.5's Condition 1 (exact replacement text given there) — this is a hard blocker on the rest of this session, not an afterthought.
4. Implement Batch A (Section 4) + Section 3 (session stamping + `verifyReferrerSession()` change). Frontend: `LoginScreen.jsx`, `ResetPinScreen.jsx` add `contractorSlug`.
5. Run `tenantIsolation.test.js`'s login/session tests → GREEN. Run full `npm test` → GREEN (existing single-tenant tests must still pass — Batch A's `WHERE contractor_id = $1 AND ...` clauses are strictly narrower than before, but with exactly one contractor in the test DB by default, behavior is unchanged for the existing single-tenant test suite).
6. Implement Batch B (14 mechanical replacements). Run `tenantIsolation.test.js`'s schedules-isolation test → GREEN.
7. Implement Batch B-extended (BX1-BX3: `engagementCadence.js:84`, `postJobSequence.js:77`, `admin/campaigns.js:502` — the last one under its hard one-line scope fence, Q7). Run the extended cross-tenant assertions → GREEN.
8. **STOP CHECKPOINT 2.** Deploy to Railway. Verify live: log in as the existing Accent Roofing referrer, confirm pipeline/cash-out/schedules/conversions all still load correctly (this is the "Accent-ready must equal contractor-#2-ready" check in its most literal form — if contractor #1 breaks here, the batching is wrong). Confirm `src/config/contractor.js`'s rewritten comment shipped (grep for the old absolute wording — it must be gone). Do NOT insert a second `contractors` row yet — that's explicitly Danny's call, separate from this spec, once he's satisfied. **Do not proceed to Session 3 until this checkpoint passes and Danny has had a chance to use the live referrer app for at least one normal work day.**

**"Done" for Session 2, stated in advance:** all 22 referrer-side call sites (19 original + 3 Phase-0.6 finds) resolve `contractor_id` from a session or a DB-verified pre-session lookup, zero client-supplied trust anywhere except the two narrowly-justified `contractorSlug` fields (themselves now documented per Q2's binding conditions, with a stated retirement path), `admin/campaigns.js` shows exactly one changed line, `tenantIsolation.test.js` fully green, live Accent Roofing referrer traffic unaffected.

### Session 3 — Webhook resolution (Batch C, Section 4) + full retirement (Section 5)

**Scope:** Section 4 Batch C + Section 5 (final retirement, now safe since both referrer.js and webhooks/jobber.js are done).

**Zero external unknowns remain for this session.** Q1 (Section 9) is resolved — the payload's `accountId` field is confirmed via official Jobber Developer Center documentation (2026-07-07), so Batch C's mechanism (Section 4) is fully specified and there is no conditional branching left in this session's steps.

1. Backblaze backup.
2. Write Section 7.2's webhook derivation tests (RED) — all 5 handlers (C1-C5) now get real assertions against `accountId`-based resolution, not `it.todo` placeholders.
3. Add `jobber_account_id` column to `contractor_crm_settings` (Section 4, Batch C part (a) — its own small, separately-guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` plus the `UNIQUE` constraint, in `db.js`).
4. Capture `jobber_account_id` in `oauth.js`'s callback via the `account { id }` GraphQL query (Section 4, Batch C part (b)).
5. Run the one-time backfill for `accent-roofing-dev` (Section 4, Batch C — the manual, deterministic capture against its existing live token, not a wait-for-refresh approach).
6. Implement `resolveWebhookContractorId()` (Section 4, Batch C part (c)) for all 5 handlers.
7. Run Section 7.2 tests → GREEN for all 5 handlers.
8. Execute Section 5's retirement: grep confirms zero remaining callers, delete `getDefaultContractorId()`, update the "pin its absence" test, update `contractorResolution.test.js`'s remaining tests, edit `CLAUDE_REGISTRY.md` and `CLAUDE.md` per Section 5.
9. **STOP CHECKPOINT 3.** Deploy to Railway. Verify live: trigger (or wait for) a real `client-update` webhook for an existing Accent Roofing client, confirm `pipeline_cache` still updates correctly and resolves via `accountId` (check `error_log` — no new `logWebhookResolutionFailure()` quarantine rows for this contractor after deploy). Run the full `npm test` suite one final time — expect all tests green, including the new "getDefaultContractorId no longer exported" pin test.

**"Done" for Session 3, stated in advance:** `getDefaultContractorId()` no longer exists anywhere in the codebase (confirmed by grep), all 5 webhook handlers — including `client-create` for a brand-new client — resolve `contractor_id` correctly via `accountId` in production, with no remaining caveat or quarantine risk from the resolution mechanism itself — and **only after this checkpoint is it safe for Danny to insert a second `contractors` row.**

Note: Q2-Q7 (Section 9) are all now resolved (recorded 2026-07-07) and, regardless, were never gates on this session's webhook mechanism — Q2 (the `contractorSlug` login exception) belongs to Session 2, Q3-Q4 were pre-Session-1 confirmations, and Q5-Q7 are Session-1/Session-2-scoped fixes. Section 9 now contains zero open questions.

---

## 9. Open Questions for Danny

These could not be resolved from the repository alone. Each is phrased as a concrete task.

1. ~~Does the Jobber webhook payload include an account identifier?~~ **RESOLVED — CONFIRMED YES (2026-07-07, via official Jobber Developer Center webhook documentation).** The webhook payload contains `accountId` inside `data.webHookEvent`, alongside `topic`, `appId`, `itemId`, and `occurredAt`. Documented example: `accountId: "MQ=="` — Jobber's encoded global ID format, the same format returned by the GraphQL `account { id }` query, so contractor lookup is a direct string-equality match (no decoding/transformation needed). This is authoritative per Jobber's own docs — no diagnostic deploy, live-payload capture, or further empirical check is needed before implementing Section 4's Batch C. See Section 4, Batch C for the finalized resolution mechanism this unblocks.

2. ~~Bless (or reject) the `contractorSlug` exception for login and forgot-pin (Section 3.5).~~ **RESOLVED — APPROVED, with two binding conditions.** Danny approved the exception per Section 3.5's reasoning, subject to:
   1. **The hardened-rule comment at `src/config/contractor.js:9-13` must be rewritten in the same commit that ships `contractorSlug`.** The old comment ("`contractorId` below must NEVER be sent to the backend or used to resolve tenancy... no client-supplied contractor id is trusted anywhere in the referrer API surface") is now too absolute and must be replaced with the narrower rule this spec actually establishes: *a client-supplied slug may scope a `WHERE` clause on pre-session endpoints where a credential check still gates access; it may never select whose data to serve on authenticated or data-returning endpoints.* This rewrite is a **hard blocker on Session 2's Batch A** — do not ship `contractorSlug` while the old, broader comment is still in place, since a future reader would reasonably conclude the codebase contradicts its own documented rule.
   2. **A planned-retirement note must be added alongside the rewritten comment**, stating that the long-term replacement at white-label scale is Host-header/subdomain-based tenant resolution (each contractor's frontend resolved to its contractor by a server-controlled hostname, not a client-supplied field) — giving this exception the same kind of explicit retirement path `getDefaultContractorId()` had (Section 5), rather than leaving it as a permanent, unexamined carve-out.

3. ~~Confirm the exact name of the existing `UNIQUE(email)` constraint on `users`.~~ **VERIFIED (2026-07-07, Railway console, screenshot-confirmed): the constraint name is exactly `users_email_key`.** Section 2 Step 4's migration runs exactly as written — no name substitution needed.

4. ~~Confirm exactly one `contractors` row exists in production.~~ **VERIFIED (2026-07-07, Railway console, screenshot-confirmed): `SELECT COUNT(*), array_agg(id) FROM contractors;` returns count `1`, `["accent-roofing-dev"]`.** Section 2 Step 2's backfill precondition is satisfied — the migration's fail-closed guard will pass on the first run.

5. ~~How should `POST /api/admin/users` and the founding-referrer `COUNT(*)` query be scoped?~~ **DECIDED — elevated to Session 1 scope, not Session 2.** Once `users.contractor_id` is `NOT NULL` (Section 2, Step 3), the admin-created-referrer `INSERT INTO users` at `admin/referrers.js:69` fails at **migration time** (a `NOT NULL` violation on every insert, immediately, in production), not merely at some future contractor-#2 time — so this is not an optional mechanical follow-up, it is a same-deploy requirement of Section 2 itself. The `INSERT` fix (use the admin session's own `contractorId`, already in scope in that file per the existing `GET` list endpoint above it) must ship in the **same deploy as the schema migration**. The founding-referrer `COUNT(*) FROM users` scoping at `admin/referrers.js:79` rides along in the same commit, since it is one line in the same file, touched for the same reason. See Sections 2, 4, and 8 for the consequences of this elevation.

6. ~~Should `engagementCadence.js:84` and `postJobSequence.js:77` be fixed alongside Batch B?~~ **DECIDED — yes.** Both receive their `contractor_id` join/filter alongside Batch B in Session 2. Additionally: while `engagementCadence.js:84`'s `LEFT JOIN users u ON u.email = c.email` is being touched for the `contractor_id` condition, its existing case-sensitive email join is normalized to `LOWER(u.email) = LOWER(c.email)` in the same edit — a known matching bug of the same shape, on the same line, not worth a separate follow-up session.

7. ~~Should the one-line fix at `admin/campaigns.js:502` be pulled into Session 2?~~ **DECIDED — yes, with a hard scope fence.** The single line at `admin/campaigns.js:502` is pulled into Session 2. Scope fence, binding: **that one line only** — nothing else in `admin/campaigns.js` is touched, and the review diff for this file must show exactly one changed line. This does not reopen the file's "known complexity debt" status for any other purpose.

---

**Section 9 status: zero open questions remain.** Q1 was confirmed 2026-07-07 via official Jobber documentation; Q2 through Q7 were decided/verified 2026-07-07 and recorded above in this update. Every decision this spec required from Danny has been made and is now written into Sections 2, 3, 4, and 8 — a future execution session should find no unresolved judgment calls left in this document.
