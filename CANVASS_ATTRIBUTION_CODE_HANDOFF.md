# Canvass attribution arc — code-side handoff

**Companion to `RoofMiles_Decisions_Record_Canvass_Attribution.md`, which holds the rulings and
the reasoning.** This file holds only what can be verified from the repository: what shipped,
where it lives, what the fences prove, and what a session would get wrong by reading the code
alone. Where the two disagree, §7 says so.

**HEAD at writing:** the docs commit that adds this file. **Gate:** `tests 1696 · suites 282 ·
pass 1696 · fail 0 · cancelled 0 · skipped 0 · todo 0`, React **1342 across 80 files**.

---

## 1. Commits in this session, in order

| Commit | What it changed |
|---|---|
| `684a71d` | Rep Step 4 as a standalone one-off boot job (`repNamesBackfill.js`) — names the rowless rep-scope clients an import left behind, from stored facts, claimed once via `rep_names_checked_at` |
| `576ccf1` | Docs: the query results, the naming queries, the conversion-rule preparation; corrected the phantom `'accent-roofing'` in filed SQL |
| `0e64ff2` | Sale grouping switched **anchored → chained** (20 days from the previous job) in `saleGrouping.js`; `saleRegroupBackfill.js` rewrites stored sales by merging, with no Jobber call; admin copy for the shared grouping window; cost accumulation added to `fetchAllClientJobs` |
| `922665b` | Docs: the unmapped-quote fall-through confirmed from source, and the rebuild scoped |
| `7eb2da3` | **The confidence rule** — an eligible quote by an unmapped author writes a PROVISIONAL, never a sticky; `written_by` marker; `repAssignmentRebuild.js` |
| `68e95d8` | **The correction path** — assigned-rep card on the client record, client-keyed reassign/clear route, deactivation-tags-as-history, the campaign-audience fence, rebuild guard excludes deactivated reps |
| `c5f275a` | `REP_ASSIGNMENT_REBUILD_SOP.md` and its CLAUDE.md link |

Immediately before this session, on the same arc: `370717d` (fact tables, the three rep steps,
the replay) and `c337612` (the book-window clip, Rep Step 4 inside the import, `rep_scope_only`).

## 2. Schema

| Object | Added | Notes |
|---|---|---|
| `jobber_clients.pipeline_stage` | Canvass-stage | The ONLY stage the rep tree reads. Fill-only from the rep steps; Step H+I classifies from full history |
| `client_sales` | Canvass-stage | One row per sale: `anchor_at` (first job), `last_event_at` (latest job), `revenue_total` **NULL until the money phase** |
| `client_sale_jobs` | Canvass-stage | Sale membership. ⚠ **No job dates stored** — which is why a narrower grouping window cannot be recomputed without re-paging Jobber |
| `crm_request_facts` | Canvass-stage | `assigned_jobber_user_ids` is **atomic per assessment** — a flat (user, time) list cannot tell a co-assignment from two visits |
| `crm_quote_facts` | Canvass-stage | Quote status, `approved_at`, salesperson |
| `contractor_crm_settings.rep_window_start` | `c337612` | Where the book starts; the conversions count is clipped to it at READ time |
| `jobber_clients.rep_scope_only` | `c337612` | Marks a mirror row created by Rep Step 4 so campaigns cannot see it |
| `contractor_crm_settings.rep_names_checked_at` | `684a71d` | Claim marker for the names backfill; also stamped by every completed rep scope |
| `client_rep_assignments.written_by` | `7eb2da3` | `live` / `replay` / `manual`. **Existing rows are NULL** and a rebuild treats NULL as replay-written |
| The attribution tag | `68e95d8` | Not a column: an ordinary `contact_tags` row, `attribution:former-rep:<Rep Name>`, in a reserved namespace campaigns cannot select |

## 3. Jobs, steps and routes

**Inside the full import** (`fullJobberImport.js` → `repImportScope.js`), after the campaign
steps A–I and the contact matching pass, in its own `try`:
Rep Step 1 requests · Rep Step 2 quotes · Rep Step 3 jobs · Rep stages · **Rep Step 4 names**
(fetches identity only for clients with no row) · Rep sales (grouping) · `recordBookWindow` ·
then `replayForMappedReps`.

**Boot jobs** (`server.js`, after `initDB()`):
`startRepNamesBackfill()` — one-off, claimed · `startSaleRegroupBackfill()` — idempotent, merges
stored sales to the chained rule · `startAssignmentRebuildIfRequested()` — does nothing unless
`REP_ASSIGNMENT_REBUILD` names a contractor (see the SOP).

**The replay** (`attributionReplay.js`) — runs the real engine over stored facts, oldest request
first, history AS OF each request, `writeOrphanOnMiss: false`, `notifyAdminOnFlag: false`,
`writtenBy: 'replay'`. **No Jobber call anywhere in the file.**

**Stage webhooks** — `quote-create`, `quote-update`, `job-create` (plus the pre-existing
`job-update`, `request-create`, `request-update`).

**Routes added this arc:** `GET /api/admin/team/book-status` (`370717d`) and
`PATCH /api/admin/team/client-assignment/:jobberClientId` (`68e95d8`). Admin route count is
fenced at **140** in `adminRouteCoverage.test.js`.

## 4. The fences, and what each proves

| Fence | Proves | Positive control |
|---|---|---|
| **The two-pipelines fence** (`repImportScope.test.js`, "the counting test") | The rep scope changes NO campaign behaviour: `contact_tags` and two evaluated audiences are byte-identical with and without it, while the in-window unpaid client gets a stage, facts and sales and **zero tags** | Yes — the discriminating clients (`up-1`, `ghost-1`) must gain rep data in the same run |
| **The campaign-audience fence** (`clientAssignmentCorrection.test.js`) | An audience naming an `attribution:` tag resolves to **zero members** and writes none; a mixed AND audience is empty too | Yes — an ordinary audience still selects the same client |
| **The bulk fence** (ruling 7) | The rep steps and the replay send nothing and create nothing: users, pending_referrals, invites, pipeline_cache, notifications, admin_messages, contact_tags, Resend, SMS, non-Jobber HTTP all unchanged | Yes — a positive control drives a real send, a real non-Jobber call and the engine's default bell through the same counters |
| **The money fence** (`saleGrouping.test.js`) | Grouping is never wired into `evaluateReferral()` — a source-text check plus a referral/cashout row-count check | Partial: the row-count half is behavioural |
| **The rebuild's no-refetch fence** (`repAssignmentRebuild.test.js`) | A rebuild is a replay: the double **throws** on any HTTP call | n/a — a throw is the assertion |
| **`sessionAuthInvariant` / `adminRouteCoverage`** | Every admin route is permission-gated and the exact route count is pinned | Yes — both take an empty allowlist as a control |

## 5. Test counts and the tripwire

`CLAUDE.md`'s tripwire is armed at **1696 server tests across 282 suites, and 1342 React tests
across 80 files**, measured at the correction-path commit. A drop means tests were deleted.
The React figure includes **one phantom case**: `adminBranding.test.jsx` walks
`src/components/admin`, `src/constants`, `src/components/superAdmin` and `src/utils` and emits
one case per swept non-test file, so any new non-test file in those roots adds one.

## 6. Standing traps

Do not restate them — read them. `CLAUDE.md` → *Test Design*, *Editing mechanics*, *A shell
harness lies plausibly*, and *Never Break These Rules*. The ones this arc tripped over in
practice: the backtick inside a comment inside a template literal (cost one gate run this
session), `ON CONFLICT` against a **partial** unique index needing the predicate repeated,
`cancelled`/`skipped` counts, and guard-proofs that must reintroduce the **defect** rather than
a different spelling of the fix.

## 7. What a session would get WRONG from the code alone

1. **Locked vs provisional is CONFIDENCE, not ownership.** Book membership is
   `COALESCE(sticky, provisional)` — a provisional client is fully in that rep's book. The
   provisional population grew deliberately with the confidence rule.
2. **A sticky is not permanent by design, only by mechanism.** An owner/admin manual assignment
   supersedes it (A36.3) and is the one designed correction.
3. **`written_by` is plumbing.** No contractor sees it. It exists only so a rebuild can tell the
   replay's rows from live ones.
4. **Chained-20 is a PROXY.** The intended boundary is *completion ends a sale*, unbuilt because
   completion dates are not stored.
5. **Clearing an assignment is not permanent.** The row is deleted and the engine may attribute
   the client again — that is the ruling, not a leak.
6. **Danny's 10 wrong stickies are known and deliberately unrepaired.** Not evidence of a live
   defect.
7. **1,990 unassigned clients are not damage.** Nobody is mapped yet; mapping turns them into books.
8. **The 12-month window filters on ACTIVITY, not client creation date.**
9. ⚠ **THREE PLACES WHERE THE DECISIONS RECORD AND THE CODE DISAGREE — the code is what runs:**
   - **§7.4 "Home stats: Clients · Referrals · Conversions · Revenue. Locked and Provisional
     moved to the Clients page."** The code shows `CLIENTS`, `LOCKED`, `PROVISIONAL` on Home
     (`RepHomeScreen.jsx` `STAT_CARDS`) plus a separate Conversions card, **no Referrals card,
     and no revenue value anywhere on Home** — the file says so explicitly, citing A34.6/CD-7.
     Locked and Provisional appear on BOTH screens (`BOOK_STAT_CARDS` on Clients). Either the
     record describes an intended layout that was not built, or the move was reversed; **it is
     not what ships today.**
   - **§2.1 "The count is `IN ('sold','paid')`, never `= 'sold'`."** No such predicate exists in
     `rep.js` or `repBook.js` any more, and that is correct: §2.3's ruling redefined conversions
     to count `client_sales` rows, which have no stage predicate at all. The sentence is true of
     the stage vocabulary and **superseded as a description of the conversions count** — a
     session that goes looking for it will not find it, and must not "restore" it.
   - **§4.2 "writing only the fact tables, `pipeline_stage` and `client_sales`."** The rep scope
     also CREATES `jobber_clients` rows with full identity (Rep Step 4, `rep_scope_only = true`)
     and writes `contractor_crm_settings.rep_window_start` and `rep_names_checked_at`. An
     understatement rather than an error, but "only" would mislead.

Everything else in the record that can be checked against the repo holds — including the
`pipeline_cache` rulings (§3.1/§3.2: the rep tree reads the stage from `jobber_clients` only,
joins `pipeline_cache` solely for `is_referred`, and never writes it), the confidence rule's gate
order (§5.1), the tag name and campaign fence (§6.3), the glossary copy (§5.2), and the
one-shared-grouping-setting ruling with its admin copy (§2.7).
