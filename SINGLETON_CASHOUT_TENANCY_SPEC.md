# Singleton Tables + cashout_requests Tenancy — Build Specification ("ST")

**Status:** LOCKED except one marked decision box (ST-1, recommendation given). Written 2026-07-08, spec-and-planning-only session; no code changed to produce this document.

**Scope origin:** Audit finding **F6** (`admin_cache` + `announcement_settings` are true global singletons — no `contractor_id` column exists at all) plus the **`cashout_requests` contractor_id migration** (Session 50 explicitly deferred it: "cashout_requests has no contractor_id column. The UPDATE is scoped by cashout id only."). The Execution Plan carries both in B1-A as parallelizable; the Master Findings v2 lists them under "Parallel/any session."

**Governing rule:** Accent-ready must equal contractor-#2-ready by design. All three tables here are contractor-#2 data-leak or data-collision points; this session closes them at the schema level.

---

## 1. Plain-Language Overview

Three tables were built in the one-contractor era with no concept of "whose row is this":

- **`admin_cache`** — the 15-minute admin dashboard stats cache. It's one shared shelf: at contractor #2, Contractor A's dashboard numbers and Contractor B's would be the *same cached blob*, each overwriting the other every refresh. Not a leak of money, but a leak of business metrics — and guaranteed-wrong dashboards for both.
- **`announcement_settings`** — the referrer-facing announcement popup config. One shared row means Contractor A toggling their announcement changes what **Contractor B's referrers see**. A direct cross-tenant behavior leak.
- **`cashout_requests`** — the money queue. Rows are only findable by their own id; there is no way to ask "show me *this contractor's* cashouts." At contractor #2, the admin cashout queue would show **every contractor's payout requests to every admin**, and nothing structurally stops Admin A approving Referrer-of-B's cashout. This is the money-path version of the problem and the reason this session is treated as a money/auth-path session (backup, transaction review, file-by-file diffs).

The fix is the same move the tenant rebuild just made on `users`: give each table a `contractor_id`, backfill the existing rows, enforce it, and scope every read/write by the requester's session-derived contractor. Small in code; the care is in the migration and the money-path queries.

---

## 2. Decisions

**[ST-1 — OPEN, recommendation: Option A] Singleton-table key shape.** Both singleton tables are defined `id INTEGER PRIMARY KEY DEFAULT 1` — that `DEFAULT 1` means a second contractor's row would collide on the primary key by construction.
- **Option A (recommended):** make `contractor_id` the PRIMARY KEY and drop the `id` column. These are one-row-per-tenant config/cache tables; Phase 0 verifies nothing references `id` by foreign key (none is expected). Cleanest, and removes the booby-trapped `DEFAULT 1` entirely.
- **Option B:** keep `id`, convert its default to a real sequence, add `UNIQUE (contractor_id)` — symmetric with the tokens D1 pattern, but requires live sequence surgery for zero benefit on tables nothing FKs into.
[ ] A  [ ] B

**Locked — cashout_requests backfill is DERIVED, not blanket.** Because Tenant S1 gave `users.contractor_id NOT NULL`, every cashout's tenant is *derivable from its owner*: backfill via join to `users` (`cr.user_id = u.id`), not via the single-contractor assumption. This is strictly safer (correct even if run late) and fail-closes on orphans (§3). The two singleton tables (one row each) use the standard single-contractor fail-closed guard and therefore **must run before any second `contractors` row exists** — same precondition family as the tenant migrations.

**Locked — missing-row semantics for the per-tenant singletons.** A brand-new contractor has no `admin_cache` or `announcement_settings` row yet. Reads must handle absence with safe defaults (cache miss → recompute and upsert; announcements → treated as disabled/default config), and writes upsert `ON CONFLICT (contractor_id) DO UPDATE`. No onboarding-time seeding required; rows are born lazily on first use.

**Locked — defense-in-depth on the money path.** The cashout approve/deny `UPDATE` gains `AND contractor_id = $n` (admin session's contractor) *in addition to* the queue list being scoped — a mis-routed id from any future UI bug hits zero rows instead of another tenant's money. Consistent with the `cashout_approve` defense-in-depth precedent.

---

## 3. Migration Plan (per-table, tenant-spec pattern: add nullable → fail-closed backfill → enforce)

Order within the session: singletons first (trivial), then `cashout_requests` (money path). One statement at a time in any manual verification, per Railway console rules.

### 3.1 `admin_cache` and `announcement_settings` (identical shape, run separately)
1. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES contractors(id);`
2. Fail-closed backfill (the tenant spec's `DO $$` pattern verbatim): count `contractors`; abort with a descriptive `RAISE EXCEPTION` unless exactly 1; set the lone row's `contractor_id`.
3. `SET NOT NULL` (guarded, idempotent).
4. Key change per ST-1 (Option A: drop old PK constraint, `ADD PRIMARY KEY (contractor_id)`, drop `id`). Idempotent guards via the established `duplicate_object`/`duplicate_table` exception-block pattern.

### 3.2 `cashout_requests`
1. Add nullable `contractor_id TEXT REFERENCES contractors(id)`.
2. **Derived backfill:** `UPDATE cashout_requests cr SET contractor_id = u.contractor_id FROM users u WHERE cr.user_id = u.id AND cr.contractor_id IS NULL;`
3. **Fail-closed orphan check:** `SELECT COUNT(*) FROM cashout_requests WHERE contractor_id IS NULL;` — must be 0 before step 4. If not 0, STOP and report the orphan rows to Danny (a cashout whose user row is gone is itself a finding); do not guess a value. (Soft-deleted users retain their rows per the Manage Account 30-day design, so the join is expected to cover everything.)
4. `SET NOT NULL` + index: `CREATE INDEX IF NOT EXISTS idx_cashout_requests_contractor ON cashout_requests (contractor_id);` (the admin queue's new hot filter; also nods to Security Audit item 38's missing-index list).

Rollbacks per step mirror the tenant spec's (drop NOT NULL → null the column → drop column).

---

## 4. Code Touchpoints (audit-era file:line — Phase 0 re-locates; files have moved since)

| Site | Change |
|---|---|
| `server/db.js:37–40, 67–76` | New DDL shape for both singletons + migration blocks |
| `server/routes/admin/metrics.js:41, 83` | `admin_cache` read/write → `WHERE contractor_id = $1` / upsert `ON CONFLICT (contractor_id)`, contractorId from verified admin session |
| `server/routes/admin/index.js:230, 248` | `announcement_settings` admin read/write → same pattern, admin session |
| `server/routes/referrer.js:793` | Referrer-side announcement read → session-derived contractorId (post-S2 pattern already in the file) |
| `server/cron/jobs/` (admin_cache_expiry, 20-min) | Expiry goes per-row by timestamp across all tenants (no per-contractor logic needed) — Phase 0 confirms current mechanism |
| `server/routes/referrer.js` (cashout submit INSERT) | Stamp `contractor_id` from the referrer session at INSERT |
| `server/routes/admin/cashouts.js` | Queue list gains `WHERE contractor_id = $1`; approve/deny UPDATE gains `AND contractor_id = $n` inside the existing BEGIN/COMMIT transaction; deny path likewise |

**Phase 0 checklist:** re-locate all lines above via grep (`admin_cache`, `announcement_settings`, `cashout_requests` — bare table names, per the multi-line-grep lesson); verify no FK references `admin_cache.id` / `announcement_settings.id` (ST-1 precondition); confirm every touched handler has a session-derived `contractorId` in scope (all should, post-S1/S2 — any that doesn't is a STOP-and-report); **verify `payout_announcements` has a `contractor_id` column** — it is adjacent to this work (cashout approval writes it) and if it lacks tenancy that is a report-back finding for its own scoped fix, NOT silently folded into this session.

---

## 5. Test Plan (RED-first)

New `server/test/singletonTenancy.test.js` + additions to the cashout test family; two-tenant fixtures throughout (the tenant rebuild's `tenantIsolation.test.js` fixture pattern):
1. `admin_cache`: writes for A and B coexist; A's read never returns B's blob; missing-row read → recompute path, then row exists.
2. `announcement_settings`: A's admin update does not change B's referrer-side read; missing row → default/disabled config.
3. `cashout_requests` INSERT stamps the session's contractor; a request body attempting to supply a different contractor is ignored (server-derived only).
4. Admin queue for A lists only A's cashouts.
5. **Money-path kill-shot:** Admin A approving a cashout id belonging to B → zero rows updated, 404-family response, no announcement/email side effects fired, transaction rolled back clean.
6. Migration guards: derived backfill covers a seeded two-user fixture; orphan row → NOT NULL step blocked (exercised against the rebuilt-from-scratch test DB).
7. Guard-proof discipline (Session 86 lesson) on test 5: temporarily remove the `AND contractor_id` predicate, watch it go RED, restore.

---

## 6. Sequencing & Session Discipline

- **Placement:** parallelizable per the Execution Plan — any slot after Tenant S3 + TF this week; it must complete **before any second `contractors` row exists** (the singleton backfills' fail-closed guards depend on it, and the plan's B1-A groups it with the tenant arc for exactly this reason).
- **Treated as money/auth-path:** Backblaze backup before build; RED tests first; file-by-file diff review (no allow-all); `admin/cashouts.js` transaction body reviewed line-by-line.
- **Deploy verification:** live checks — admin dashboard stats load (cache recompute path exercised); announcement popup config round-trips in admin and renders referrer-side; submit + approve one test cashout end-to-end (using the standard test-balance seeding reference, updated to `accent-roofing-dev`); `SELECT COUNT(*) FROM cashout_requests WHERE contractor_id IS NULL;` → 0 live.
- Registry edits at completion: close F6; close the S50 deferred-migration note; record the derived-backfill pattern as the house pattern for ownership-derivable tenancy backfills; record the `payout_announcements` Phase-0 verdict either way.

**Done-statement, in advance:** no table in the live schema that the cashout or announcement paths touch lacks a `contractor_id`; every read/write of the three tables is session-scoped; Admin A structurally cannot list, approve, or deny Contractor B's cashouts (test 5 green, guard-proven); live Accent dashboard, announcements, and cashout flow verified unaffected.

*End of ST Specification v1.0. One open box (ST-1, recommend A); everything else locked. Plug-and-play any slot after TF, before contractor #2.*
