# GROUND TRUTH — 2026-08-21

**HEAD:** `d0fb3aa` — *6A commit 2: the rules 6B paid for, and a budget crossed with its cause named*
**Date run:** 2026-08-21
**Nature:** read-only verification pass. No source file, test, config or other document was
modified. This file is the only thing this session created.

**What this is.** A roadmap reconciliation produced a sequencing plan from documents alone.
Several records contradicted each other and the ordering depended on which side was true.
Every check below states an EXPECTED value taken from those records, the ACTUAL value measured
against the codebase at `d0fb3aa`, and a verdict. **A MATCH is a result.** Roughly half the
value here is the confirmations — they retire hedges that were costing sequencing decisions.

**How to read a verdict.**
- **MATCH** — the record was right. Stop re-deriving it.
- **MISMATCH** — the record was wrong, stale, or inverted. The Delta says which, and how.
- **COULD NOT RUN** — see *NOT CHECKED* at the bottom.

---

## GROUP A — DOCUMENT INTEGRITY

| Check | Expected | Actual | Verdict | Delta |
|---|---|---|---|---|
| **A1a** `git add` in CLAUDE.md | exactly one `git add -A` | exactly one, at **`CLAUDE.md:502`** (Session Safety Protocol, step 6) | **MATCH** | The known-wrong instruction is real, is singular, and is at 502. |
| **A1b** exact-path staging rule | ZERO hits anywhere in CLAUDE.md | ZERO hits for `exact-path`, `exact path`, `staging` (grep exit 1) | **MATCH** | The staging discipline this session ran under **exists nowhere in the repo's resident rules.** It survives only in session prompts. |
| **A2a** CLAUDE.md size | ~40,812 chars | **40,812** chars | **MATCH** | Exact. 99.5% of the 40,000-char performance-warning threshold CLAUDE.md itself names — i.e. **over it.** |
| **A2b** Testing tripwire counts | a count believed set below the true floor | `CLAUDE.md:272` claims **"734 server tests and 35 React tests across 6 files"** | **MISMATCH** | True floor (F1) is **947 / 459 / 31**. The tripwire sits **213 server tests, 424 React tests and 25 files below** the real suite. It cannot fire for any shrink smaller than a 23% server collapse, and the React half would have to lose 92% of its tests. **It is not a tripwire; it is decoration.** See *SEQUENCING IMPACT*. |
| **A3a** Jobber-Connect entry | cites the `tokens.id=1` clobber risk | present, verbatim | **MATCH (text)** / **MISMATCH (substance)** | Quote below. The cited reason is **retired** — see C3. |
| **A3b** Admin Brand Retirement entry | reads "IN PROGRESS — Phase 1 shipped `cd198cf`" | present, verbatim | **MATCH (text)** / **MISMATCH (substance)** | Quote below. Phases 2, 3+4, 5.0–5.5, 6A and 6B have all shipped since. The entry describes the build's state ~30 commits ago. |
| **A4a** five `.docx` untracked | all five error under `git ls-files --error-unmatch` | all five errored | **MATCH** | The canonical index still depends on five files git has never seen. |
| **A4b** real untracked population | (unstated — this check exists to replace assumption) | see list below | **MISMATCH vs the session's own premise** | **`HARDCODED_ACCENT_INVENTORY.md` is TRACKED**, and **`.claude/settings.local.json` is TRACKED and MODIFIED.** Both were named in this session's standing-order as files that "must never be committed." Both are already committed. |
| **A5a** registry size | ~69,170 chars | **69,170** chars | **MATCH** | Exact. Unchanged since last measured. |
| **A5b** highest Known Issue | 13, 14 or 15 | **15** | **MATCH** | `CLAUDE_REGISTRY.md:320` — *Test-runner isolation*. Numbering also carries 2a/2b/2c/2d sub-entries at `:246–262`. |

### A3 — the two entries, quoted verbatim

**(a) `PRE_LAUNCH_CHECKLIST.md:329–332`**

```
- [ ] **Jobber OAuth return post-Phase-4 is UNVERIFIED — and ⚠ DO NOT TEST IT TO FIND OUT.**
      The standing order against clicking Connect holds until this session (the `tokens.id=1`
      clobber risk, unrelated). Verification comes free the first time this session exercises
      the path. → §10
```

**(b) `PRE_LAUNCH_CHECKLIST.md:337–347`** (final line is the claim under test)

```
- [ ] **Admin Panel Brand Retirement — SOONER RATHER THAN LATER**, ideally while the Phase 6
      mechanism is still warm.
      ...
      → **`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`** (the governing spec; supersedes §10 for this
      build). **IN PROGRESS** — Phase 1 shipped `cd198cf`; Phase 2 is the delivery seam.
```

The same stale framing repeats at **`PRE_LAUNCH_CHECKLIST.md:547`** in the *Where detail lives*
table: *"**ACTIVE.** … Phase 1 shipped `cd198cf`"*. **Two copies, one fact, both stale** — the
N-files-N-corrections shape, on this page right now.

### A4 — the actual working-tree population

`git status --porcelain` at `d0fb3aa`:

```
 M .claude/settings.local.json
?? RoofMiles_BuildSequence_JobRevenueCapture.docx
?? RoofMiles_BuildSequence_LandingAmbientBranding.docx
?? RoofMiles_Handoff_ABR_Phase5.docx
?? RoofMiles_Handoff_ABR_Phases1-4.docx
?? RoofMiles_Handoff_CDL_3b.docx
?? docs/desktop.ini
?? docs/superpowers/plans/2026-05-26-grouped-filter-jobber-clients.md
```

**Untracked at repo ROOT: exactly the five `.docx` files.** Nothing else.

Two corrections to the standing order this session was given:

- **`HARDCODED_ACCENT_INVENTORY.md` — TRACKED.** `git ls-files --error-unmatch` returns it
  cleanly. It is 9,031 bytes, present on disk, and already in the repo. It is not gitignored.
  An instruction to keep it out of a commit describes a state that ended some time ago.
- **`.claude/settings.local.json` — TRACKED, and currently MODIFIED.** `.gitignore` carries
  `.claude/*`, but **gitignore does not apply to already-tracked files**, which is why it shows
  as ` M` rather than `??`. Its modification is live in the working tree right now and would be
  picked up by any `git add -A` or `git commit -a`.

Neither was staged by this session. Both are recorded because the standing order treats them as
untracked, and **an order built on a false premise protects nothing.**

---

## GROUP B — THE MATCHING ENGINE

**The claim under test:** the pending-referral matcher searches a transient in-memory array
instead of the persisted `jobber_clients` table; a funnel-status join compares the wrong column;
names are never normalised; and no pending referral has ever converted end to end.

**Result: one of the three code-side root causes is confirmed exactly as stated, one is
falsified, and one is confirmed with a correction to its mechanism.**

| Check | Expected | Actual | Verdict | Delta |
|---|---|---|---|---|
| **B1** matcher candidate source | in-memory `allClients`, not a `SELECT` on `jobber_clients` | `server/utils/pendingReferral.js:372` — `const matches = allClients.filter(...)`. `allClients` is the function's 4th parameter, defaulting to `[]` | **MATCH** | Confirmed verbatim. No query against `jobber_clients` exists anywhere on this path. |
| **B2** funnel-status join on `referred_by` | compares `referred_by` where it should compare `client_name` | **No such SQL exists.** The pending-referral read (`admin/index.js:1668–1682`) selects 22 columns from `pending_referrals` alone — **no join, no pipeline status.** | **MISMATCH — claim falsified** | The nearest match is `admin/referrers.js:51–55`, which is about `users`, not pending referrals, and **is correct as written.** One of three root causes retires. See below. |
| **B3** name normalisation on write | none — names stored as Jobber returns them | **Confirmed. Three write sites, zero trim.** | **MATCH** | With a correction that changes the SQL Danny should run — `jobber_clients` has **no `name` column.** See below. |
| **B4** a `matched_user_id` writer exists | at least one writer; the precondition never becomes true | **One writer**, `pendingReferral.js:570–574`; **one caller**, `referrer.js:720` | **MATCH** | The writer exists and is reachable. The precondition is the failure. Chain traced below. |

### B1 — the matcher, located

**File:** `server/utils/pendingReferral.js`
**Function:** `checkAndCreatePendingReferral(contractorId, client, referredByName, allClients = [])` — declared at **`:309`**
**Candidate source:** **`:372–376`**

```js
const matches = allClients.filter(c => {
  const fullName    = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
  const reverseName = `${c.lastName || ''} ${c.firstName || ''}`.trim().toLowerCase();
  return fullName === normalizedReferrerName || reverseName === normalizedReferrerName;
});
```

`allClients` is a **Jobber GraphQL response array accumulated in process memory**, populated in
`server/crm/pipelineSync.js` at `:626` (full sync) and `:775` (incremental sync) and passed down
through `syncSingleClient` (`:147`) to `:543`. It is **never** read from the database.

**The file states this deliberately, at `:304–308`:**

```
// MVP: webhook path calls this with allClients=[] because the full client list is
// not available per-request. When allClients=[] the name match always fails and the
// record is flagged needs_admin_verification=true. The next scheduled full sync
// (which has allClients populated) will re-attempt the name match for those records
// via the isRetry path below.
```

⚠ **This is a documented MVP shortcut, not an unknown defect** — and `:365` argues the design is
correct (*"Jobber `ClientFilterAttributes` does not support name filtering — confirmed in
GraphiQL. Local matching against `allClients` is the correct approach"*). That argument is about
**Jobber's API**, and it is sound. It is **not** an argument against querying the local
`jobber_clients` table, which holds 17,564 rows for this tenant and is not subject to Jobber's
filter limitations at all. **The comment defends the choice not to filter remotely; nobody has
yet defended the choice not to read locally.**

### B2 — the claimed join does not exist

`GET /api/admin/pending-referrals` (`server/routes/admin/index.js:1661–1687`) is the only read of
`pending_referrals` on the admin side. Its query:

```sql
SELECT id, contractor_id, jobber_client_id, client_name, referred_by_name,
       referred_by_phone, referred_by_email, invite_sent_at, invite_channel,
       invite_resent_at, matched_user_id, matched_at, match_seen_at,
       closed_out_by_admin, closed_out_at, closed_out_note, status, created_at,
       needs_admin_verification, jobber_name_matches, referrer_lookup_attempted,
       credit_email_sent_at
FROM pending_referrals
WHERE contractor_id = $1 AND status != 'closed'
ORDER BY ...
```

**No join. No `pipeline_cache`. No funnel status.** The referrer-side read
(`referrer.js:2666–2672`) likewise reads `pending_referrals` alone.

The record almost certainly points at **`server/routes/admin/referrers.js:51–55`**, which does
join on `referred_by`:

```sql
EXISTS (SELECT 1 FROM pipeline_cache pc
        WHERE LOWER(pc.referred_by) = LOWER(u.full_name)
          AND pc.pipeline_status = 'paid' AND pc.contractor_id = $n)
```

That computes `lifecycle_status` for a **`users` row** — rendered as the "Funnel Status" pill in
`AdminReferrers.jsx:205,289,600`. Asking *"has this referrer referred anyone who reached paid?"*
means matching `pipeline_cache.referred_by` against the referrer's name. **`referred_by` is the
correct column and `client_name` would be wrong.** The query is right.

**Verdict: the defect was attributed to the wrong query.** It is a "Funnel Status" surface, but
about referrers, not pending referrals. One of the three claimed root causes is retired.

### B3 — normalisation, and a correction to Danny's SQL

Three write sites for `jobber_clients` name fields. **All three write `client.firstName || null`
and `client.lastName || null` with no `trim()`, no case fold, no whitespace collapse:**

| File | Line | Path |
|---|---|---|
| `server/routes/webhooks/jobber.js` | **330** (`upsertAndTagClient`, values at `:344–357`) | webhook |
| `server/cron/jobs/jobberIncrementalSync.js` | **162** (values at `:176–185`) | 30-min cron |
| `server/jobs/fullJobberImport.js` | **542** (Step H, values at `:555–565`) | first-time import |

⚠ **`jobber_clients` HAS NO `name` COLUMN.** Schema at `server/db.js:952–966`: the name is split
across **`first_name TEXT`** and **`last_name TEXT`**. **Group D's D5 as written
(`WHERE name <> btrim(name)`) will error with `42703 column "name" does not exist`.** A corrected
statement is supplied in *DANNY'S SQL*.

**Two related facts, so the fix is not scoped wrongly:**

1. **`pipeline_cache` IS normalised at write, on both columns.** `referred_by` is trimmed by
   `getReferredByValue()` (`pipelineSync.js:137` — `field.valueText?.trim()`), and `client_name`
   is trimmed at `pipelineSync.js:151`. **The untrimmed population is `jobber_clients` only.**
2. **The matcher already trims — but only at the ends of the joined string.**
   `` `${firstName} ${lastName}`.trim().toLowerCase() `` handles a leading or trailing space on
   the whole name. It does **not** collapse interior whitespace: `firstName = "John "` with
   `lastName = "Smith"` produces `"john  smith"` (two spaces), which never equals `"john smith"`.
   **So trailing spaces on `first_name` specifically are still fatal to a match**, and they are
   exactly what an untrimmed CRM write produces. This is why D5 is worth running against
   `first_name` in particular.

### B4 — the conversion path exists; its precondition is unreachable

**Sole writer:** `server/utils/pendingReferral.js:569–574`

```sql
UPDATE pending_referrals
   SET matched_user_id = $1, matched_at = NOW(), status = 'matched'
 WHERE id = $2
```

**Sole caller:** `server/routes/referrer.js:717–720` — after email verification.

`matchPendingReferral(userId, email, phone)` (`:542`) finds its row by matching the signing-up
user against **`referred_by_email`** (`:546–550`) or **`referred_by_phone`** (`:557–563`,
digits-normalised on both sides — correctly).

**The chain, and where it breaks:**

```
allClients.filter(...)  →  matches.length === 1  →  fetchReferrerContact()
                                                 →  UPDATE ... referred_by_phone, referred_by_email
                                                 →  matchPendingReferral() can now match
```

`referred_by_email` / `referred_by_phone` are written in **exactly one branch** —
`if (matches.length === 1)` at **`:383`**. Every other outcome takes the `else` at `:409` and sets
`needs_admin_verification = true`, leaving both contact columns **NULL** (they are inserted NULL
at `:350`).

**A row with both columns NULL can never be selected by `matchPendingReferral`.**
`LOWER(NULL) = LOWER($1)` is NULL, not true; `REGEXP_REPLACE(NULL, ...) = ...` is NULL, not true.

So: **the writer is present and correct. It is starved.** Whether it has *never* fired is a data
question — **D1 answers it.** If D1 returns `matched = 0` against `total = 13`, the starvation is
total and the two upstream causes (B1's array, B3's untrimmed names) are jointly sufficient to
explain it without B2.

**Incidental, noted because it is the exact query B4 asked me to record:** `matchPendingReferral`
has **no `contractor_id` predicate** on either SELECT. Both are `WHERE status = 'pending' AND
<email|phone> = ...` across the whole table. Same shape as the registry's *"users matching in
invoice-paid webhook and pipelineSync — cross-tenant risk"* entry, in a third place that entry
does not name. **Not fixed here, not scoped here** — recorded so it is not found a fourth time.

---

## GROUP C — STALE-OR-LIVE

| Check | Expected | Actual | Verdict | Delta |
|---|---|---|---|---|
| **C1** `account.js` phantom id | query on `contractor_settings WHERE contractor_id = 'accent-roofing'`; line 436 possibly stale | **`server/routes/account.js:436`** — exact line, exact query | **MATCH** | The line number did **not** drift. Only hit for `accent-roofing'` in the file. Live-broken as recorded, pending D2/D4. |
| **C2** full-sync abort guard | unknown — does it key on a hardcoded contractor id? | **No.** `pipelineSync.js:594` takes `contractorId` as a parameter; the guard at `:598–605` queries `WHERE contractor_id = $1` | **MISMATCH vs the hypothesis** | The guard is correctly tenant-scoped. **But the abort logs via `console.warn` only (`:603`) — never `logError()`. It cannot appear in `error_log`, so D6 will not see it.** Only D3 and Railway stdout can answer whether it still fires. |
| **C3** `tokens.id = 1` survivors | ZERO in production code | **ZERO.** All 13 hits are in `server/test/tokenTenancy.test.js`, and every one is a RED-narrative comment describing the pre-fix state | **MATCH — TF's claim is correct** | Structurally confirmed, not just grep-confirmed. See below. **The "do not click Jobber Connect" order's stated reason is retired.** |
| **C4** any security-hardening session | no commits corresponding to `SECURITY_HARDENING_SPEC.md` Sessions 1–10 | **None.** The spec landed `5a9f6c5` (2026-07-07). In the **120 commits since**, the only security-adjacent one is `1d3d7d1` (2026-08-01), a `multer`/`axios` version bump | **MATCH** | Every other `fix(security)` commit **predates the spec** (2026-04-16 → 2026-06-30). No SH-numbered work has ever run. |
| **C5** `escapeHtml` sites | checklist: 3. SH-5: 7+ | **7 definitions** — 1 canonical + **6 local redefinitions**. `const esc =`: zero hits | **MISMATCH — checklist undercounts by 2×** | And worse than a count: **4 of the 6 are a weaker variant.** See below. **This is the single largest sizing correction in this pass.** |
| **C6** `err.message` leaks | checklist ~40; SH-3 43+ | **45** sites inside a response body, all in `server/routes/` | **MISMATCH — SH-3 is closer** | Per-file breakdown below. No multi-line variants; none outside `server/routes/`. The checklist's cited `referrer.js:1158` **is stale** — that line is now `compareCandidate`, which leaks nothing. |
| **C7** brand-literal sweep, `server/` | 77 sites across 11 files | **77 sites across 11 files** | **MATCH — exact, file by file** | Every per-file count in the checklist is correct. But the **`src/` population has never been counted: 55 hex across 17 files + 34 `rgb()`/`rgba()` across 14.** True production total **166**, not 77. |
| **C8** unguarded `stats.X` reads | 17 (an earlier record said 7) | **19** unguarded by field-level definition; **17** if you count the checklist's own named ranges | **MATCH (reconciled)** | Both numbers are right under different definitions — stated below so the next reader does not re-derive it. The earlier "7" is definitively wrong. |

### C1 — verbatim

```js
// server/routes/account.js:436
`SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = 'accent-roofing' LIMIT 1`
```

Consumed three lines later at `:439` — `escapeHtml(delSettings.email_sender_name || delSettings.company_name || 'RoofMiles')` — the sender identity on the account-deletion email. **If `contractors` holds only `accent-roofing-dev` (D2) then this returns zero rows and every such email silently ships as "RoofMiles" instead of the contractor.** D2 and D4 settle it.

### C3 — why this is structural, not just absent

Zero is the count, but the reason it stays zero matters more:

- **`server/db.js:314–323`** — `tokens_contractor_id_unique UNIQUE (contractor_id)`, added under a
  `pg_constraint` pre-check.
- **`server/routes/oauth.js:58–62`** — the OAuth upsert keys **`ON CONFLICT (contractor_id)`**,
  not `(id)`.
- **`server/db.js:329–334`** — `tokens.id` given a `nextval('tokens_id_seq')` default explicitly
  so an INSERT can omit it, with the in-code note *"inert as of the TF token-fix session
  (decision TF-D1.1) … `contractor_id` is the real key."*
- All **24** production reads/writes of `tokens` carry a `contractor_id` predicate.

**Clicking Jobber Connect cannot clobber another contractor's token row.** The mechanism the
standing order names is gone. (Whether the *return path* is correct post-Phase-4 is a separate,
still-open question — that half of `PRE_LAUNCH_CHECKLIST.md:329` stands.)

### C5 — the seven `escapeHtml` sites, and the four that are weaker

| # | File:line | Escapes `&  <  >  "` | Escapes `'` | Non-string input |
|---|---|---|---|---|
| 1 | `server/utils/pendingReferral.js:37` — **CANONICAL** | ✅ | ✅ | → `''` |
| 2 | `server/routes/account.js:24` | ✅ | ✅ | coerced via `String()` |
| 3 | `server/routes/referrer.js:57` | ✅ | ✅ | coerced via `String()` |
| 4 | `server/crm/pipelineSync.js:48` | ✅ | ❌ | → `''` |
| 5 | `server/routes/admin/cashouts.js:15` | ✅ | ❌ | → `''` |
| 6 | `server/routes/resendWebhook.js:14` | ✅ | ❌ | → `''` |
| 7 | `server/routes/webhooks/jobber.js:3` | ✅ | ❌ | → `''` |

**Only ONE file in the entire codebase imports the canonical one:** `server/routes/landing.js:73`.

⚠ **The checklist's "THREE sites" names #5, #3 and #7.** It misses **`pipelineSync.js:48`**,
**`resendWebhook.js:14`** and **`account.js:24`** — and two of those three misses are weak
variants.

⚠ **THIS IS NOT A CONSOLIDATION ITEM. IT IS A SECURITY FIX WITH A CONSOLIDATION ATTACHED.**
Rows 4–7 do not escape the single quote. Every one of them interpolates CRM- and user-sourced
strings into HTML email bodies (`pipelineSync.js:254,326–337,365,393,421,449`;
`cashouts.js:100–137`; `resendWebhook.js:217,299`; `jobber.js:1052–1099`). A single quote reaching
an unquoted or single-quoted HTML attribute in those templates escapes the attribute. **Three
distinct behaviours across seven functions is also exactly the state in which "we swept
`escapeHtml`" reads as done while four call sites stay wrong** — the same shape the checklist
already names this item as the argument for.

### C6 — the 45 leaks, per file

| File | Count |
|---|---|
| `server/routes/referrer.js` | **19** |
| `server/routes/account.js` | **15** |
| `server/routes/admin/referrers.js` | **5** |
| `server/routes/admin/index.js` | **3** |
| `server/routes/admin/cashouts.js` | **2** |
| `server/routes/stripe.js` | **1** |
| **TOTAL** | **45** |

Raw grep over `server/routes/` for `err.message`/`err.stack` minus `logError`/`console.` lines
returns **59**; **45** of those sit inside a response body. Verified no multi-line
`res.status(...).json({\n error: err.message \n})` forms exist, and no leak sites outside
`server/routes/`.

Two shapes worth knowing before scoping: **five are not the plain `{ error: err.message }`
form** — `admin/referrers.js:176,213` concatenate (`'Jobber match failed: ' + err.message`),
`admin/index.js:1294,1329` and `stripe.js:184` return it under a `message:` key alongside a
`success: false` or an error code. A regex-only sweep written against the plain form leaves those
five.

**The checklist's per-file citations are right where they name files and wrong where they name
lines:** `account.js (15 sites)` ✅, `admin/cashouts.js:37,156` ✅, `admin/referrers.js:68,114,127`
✅ (but it has **5**, not 3), and **`referrer.js:1158` ✗** — that line is now inside
`compareCandidate`, which routes through `logError` and returns `null`. `referrer.js` has 19 leak
sites and 1158 is not one of them.

### C7 — the brand-literal population

**`server/` — 77 across 11 files. The checklist is exact, file for file:**

| File | Sites | | File | Sites |
|---|---|---|---|---|
| `routes/referrer.js` | 30 | | `routes/admin/cashouts.js` | 4 |
| `crm/pipelineSync.js` | 12 | | `routes/account.js` | 4 |
| `utils/pendingReferral.js` | 7 | | `routes/admin/index.js` | 2 |
| `routes/admin/team.js` | 6 | | `cron/jobs/postJobSequence.js` | 2 |
| `routes/webhooks/jobber.js` | 5 | | `utils/brandingTheme.js` | 1 |
| `routes/resendWebhook.js` | 4 | | **TOTAL** | **77** |

(82 including `server/test/`. Zero `rgb()`/`rgba()` decimal forms in `server/` — that axis is
`src/`-only.)

**`src/` — never counted before this pass:**

- **Hex needles: 55 sites across 17 files** (production; `.test.` excluded). Largest:
  `constants/theme.js` (8), `shared/LockedSection.jsx` (6), `PrivacyPolicy.jsx` (6),
  `ContractorTerms.jsx` (6), `TermsOfService.jsx` (5).
- **`rgb()`/`rgba()` decimal forms: 34 sites across 14 files** (production). Largest:
  `referrer/DashboardTab.jsx` (6), `referrer/ContractorAboutModal.jsx` (5),
  `referrer/RankingsTab.jsx` (4), `referrer/BookingFormModal.jsx` (4).

**True production population: 77 + 55 + 34 = 166 sites.** The checklist says *"SIZE IT FROM 77,
NOT FROM 5"* and is scrupulously honest that 77 is `server/` alone — but the number that has been
carried forward as the size of the work is **2.2× too small.**

⚠ **`src/components/shared/` confirmed unreachable by the D-N sweep, as recorded.**
`LockedSection.jsx` alone holds **6 hex + 2 rgba** needle hits and `Skeleton.jsx` holds **2 + 1**.
D-N walks `admin/`, `constants/`, `superAdmin/`, `utils/`. `shared/` is not a walk root, so **9
live sites in one file are invisible to it by construction.**

**Fifth-needle class (`#1f2638`) — still live, unchanged:**
`src/components/admin/BrandingProfileSettings.jsx:192` still reads
`<option key={opt} value={opt} style={{ background: '#1f2638' }}>`. Falsified prose still at
`Skeleton.jsx:7,31`; a third mention at `LockedSection.test.jsx:90`. **Still not observed in a
browser** — that remains the cheapest verification in the queue.

### C8 — the two correct answers, and why they differ

**Both 17 and 19 are right. State which you mean.**

- **19** = every read with **no field-level guard**, counting the whole file.
- **17** = every `stats.` occurrence inside the checklist's own named ranges
  (`:214-222`, `:232-235`, `:259-262`, `:275-277`), minus the one guarded occurrence at `:277`.
  That arithmetic reproduces the checklist's number exactly — **so the record was derived
  correctly; it just did not include `:83`.**

| Site | Reads | Guard | Status |
|---|---|---|---|
| `:83` `pipelineTotal` sum | 4 | object-level `stats ?` only | **UNGUARDED** — the NaN source |
| `:117` | 1 | `Number.isFinite(stats?.pendingCashouts)` | guarded |
| `:154`, `:158` | 3 | enclosing `stats?.pendingCashouts > 0` | guarded |
| `:214` `activeReferrers`, `totalReferrers` | 2 | none | **UNGUARDED** |
| `:215`, `:216` | 2 | `money()` → `Number.isFinite` | guarded |
| `:219–222` | 4 | none | **UNGUARDED** |
| `:232–235` PipelineBar segments | 4 | none | **UNGUARDED** |
| `:259–262` legend `{s.val}` | 4 | `pct()` guards the % only; `{s.val}` renders raw | **UNGUARDED** |
| `:275` `totalReferrers` | 1 | none | **UNGUARDED** |
| `:277` `pendingCashouts` | 1 | `pendingState === 'some'` | guarded |
| | | **UNGUARDED TOTAL** | **19** |

**The checklist's items 1 and 2 are one item, not two.** `:83`'s four reads *are* four of the
unguarded reads; counting the NaN source separately from "17 unguarded reads" double-books them.

**One thing neither record names:** `PipelineBar` (`AdminComponents.jsx:495`) filters with
`segments.filter(s => s.val > 0)`. `undefined > 0` is `false`, so **an absent field silently
vanishes from the bar** and the remaining segments re-proportion to fill the width — a confident,
wrong-looking-correct pipeline. Same *absent-reads-as-zero* shape as `:154`'s banner and `:117`'s
pill, in a third place, and it belongs in the same one design call.

---

## GROUP D — DATABASE CHECKS

**NOT RUN.** The local environment cannot reach Railway Postgres and no attempt was made.
See *DANNY'S SQL* below for the copy-paste block, including **one corrected statement.**

---

## GROUP E — REP-APP READINESS

| Check | Expected | Actual | Verdict | Delta |
|---|---|---|---|---|
| **E1** rep-flag write path | `promote` is sole writer; `is_attributable` pulled off the general PATCH. A conflicting record says FA **added** it to the PATCH whitelist | **`POST /api/admin/team/:id/promote` (`team.js:340`) is the sole writer** of all three flags (`:406–409`). The general PATCH **rejects** `is_attributable` with a **422** at `:243–247` | **MATCH — the conflicting record is INVERTED** | Not merely stale: it says the opposite of what the code does. The PATCH does not silently ignore the field, it names the replacement endpoint in the error body. **Plus a fact neither record carries — see below.** |
| **E2** context plumbing | `is_field_rep` only; the other two dropped | **`useAdminPermissions` surfaces NONE of the three.** `src/hooks/useAdminPermissions.js:43–46` documents dropping **four** fields: `title_id`, `is_field_rep`, `is_attributable`, `rep_revenue_visibility` | **MISMATCH — right outcome, wrong mechanism** | `is_field_rep` **does** reach React, via two other paths. Traced below. This matters for 3c: a rep-surface component cannot get the flag from `usePermissions()`. |
| **E3** shared primitives | Skeleton, EmptyState/StateCard, LockedSection, LoadingIndicator, ErrorState, SuccessState, statusTheme.js | **All seven present.** `EmptyState.jsx` **and** `StateCard.jsx` both exist. `statusTheme.js` lives at **`src/constants/statusTheme.js`**, not in `shared/` | **MATCH** | **All three of `UI_OVERHAUL_SPEC.md` §11.1's planned primitives already exist.** Phase 4.1/4.4 scope is partly discharged and that spec does not know it. |
| **E4** deactivation / Decision E | exactly one post-creation write, `active = false`, no route sets it true | **Confirmed: `team.js:555`, unconditional `false`, and it is the only one.** No `SET active = true` exists anywhere. Then: **`verifyAdminSession()` does NOT check `active`; `verifyAnySession()` DOES; `GET /api/admin/me` DOES; `surfaceFor()` does NOT** | **MATCH + the harder half answered** | The four gates disagree, and the disagreement is what decides the 3c question. Full answer below. |
| **E5** Phase 6 completeness | titles CRUD + `jobber_user_id` on team PATCH | **All present.** `GET :808`, `POST :825`, `PATCH :845`, `DELETE :872` on `/api/admin/titles`; `body('jobber_user_id')` validated at `team.js:238` | **MATCH** | Sessions 87–90 landed as recorded. Nothing owed. |

### E1 — and the fact neither record carries

The PATCH's rejection is explicit and reasoned in-code (`team.js:227–233`), and the promote
endpoint enforces coherence on the **merged** state (`:385–399`), cascading both dependent flags
to `false` when `is_field_rep` goes false.

⚠ **But the enforcement is no longer application-level only.** `server/db.js:1672` adds:

```sql
CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility))
```

…behind a work-remaining guard at `:1653` that fails the boot closed if any pre-existing row
violates it, with the operator instructions and a `CLAUDE_REGISTRY.md Known Issue 13` citation in
the error text at `:1659–1662`.

**Registry Known Issue 14 asks for exactly this** — *"consider a DB constraint or
application-level coherence check so `is_attributable=true` structurally requires
`is_field_rep=true`"* — and marks it *"Do not build until: Explicitly scheduled by Danny."*
**It has been built.** Both halves. Known Issue 14's second paragraph is dischargeable; its first
(the promotion write-path itself) is discharged too, by `POST .../promote`.

### E2 — where `is_field_rep` actually reaches React

Three independent paths, none of them the permissions context:

1. **Login → `App.jsx:304`** — `setSession({ role: 'team', tier: data.tier, is_field_rep: data.is_field_rep })`, sourced from `POST /api/login` (`referrer.js:1265`). **This is the one `surfaceFor()` reads.**
2. **Boot rehydration → `server/routes/session.js:69`** — via `verifyAnySession()`, which selects it at `auth.js:206` with the in-code note *"is_field_rep is here for ROUTING on boot rehydration … never for authorisation. It must match what `POST /api/login` reported for the same member."*
3. **`GET /api/admin/team` → `AdminTeamSettings.jsx:133,505,515`** — the roster's own list payload (`team.js:32`).

`GET /api/admin/me` **does** return all three flags (`admin/index.js:201–203`) — the hook simply
discards them at `useAdminPermissions.js:60–72`. **So E2's fix is a one-line widening of an
existing payload, not a plumbing build.** The hook's own comment says as much: *"Left alone
deliberately: nothing in the panel reads them from here today, and widening the context is a
change whose consumers should ask for it."* **3c is that consumer.**

### E4 — Decision E: does it gate 3c, or ride with it?

**The four gates, and what each checks:**

| Gate | Checks `team_members.active`? | Evidence |
|---|---|---|
| `verifyAdminSession()` | ❌ **No** | `auth.js:44–68` — queries `sessions` only: `WHERE s.token=$1 AND s.role='admin' AND s.expires_at > NOW()`. Never touches `team_members`. |
| `verifyAnySession()` | ✅ Yes | `auth.js:206–210` — `if (!members.length || !members[0].active) return deny();` |
| `GET /api/admin/me` | ✅ Yes | `admin/index.js:169–174` — `WHERE id = $1 AND active = true`, else **403**. |
| `surfaceFor()` | ❌ **No** | `App.jsx:53–57` — reads `role`, `tier`, `is_field_rep`. Identity only. |

**Answer to the specific question — can a frozen rep's homeowner session reach rep capability?**

**No, and not by accident.** A homeowner login takes the `else` branch of `handleAuthenticated`
(`App.jsx:305–314`) and sets `setSession({ role: 'referrer' })` — **a descriptor carrying no
`tier` and no `is_field_rep` at all.** `surfaceFor()` returns `'referrer'` on `role` alone at
`:55`, before the rep rule at `:57` is ever reached. The rep surface is **structurally
unreachable** through the homeowner door, because the homeowner door does not carry the field the
rep rule needs.

**What IS live is R4, and it is narrower than "Decision E".** `verifyAdminSession()` gates all
~130 `requirePermission` routes and does not check `active`. A frozen member holding a still-valid
admin token would clear it. It stays latent **only** because `team.js:554` deletes the sessions
**before** `:555` writes the flag — and those are the two statements the checklist separately
records as a **non-transactional paired write**. **If that pair ever half-fails, R4 goes live in
the same instant.** They are one fix, not two.

**Consequence for sequencing:** the frozen-rep-with-homeowner-account question **does not gate
3c** — it is already answered correctly by construction, and Decision E can record the ruling
rather than build a control. **Decision E rides with 3c.** What must not ride is R4 + the
non-transactional pair, which are already on the pre-launch list and should be done together.

**One residual worth a line:** a deactivated member whose session somehow survives gets
`surfaceFor() === 'admin'` (identity-only) while `/api/admin/me` 403s, so `useAdminPermissions`
falls to `EMPTY` — `tier: null, permissions: {}`. **They land on a rendered, permission-less admin
panel rather than the login screen.** Not a privilege leak; a confusing dead end. Decision E
should rule on it explicitly rather than inherit it.

---

## GROUP F — BASELINE NUMBERS

| Check | Expected | Actual | Verdict | Delta |
|---|---|---|---|---|
| **F1** full suite | ~947 server / ~459 React / ~31 files, **exit 0** | **947 server** (148 suites) / **459 React** (31 files) / **exit 0**. fail 0, cancelled 0, skipped 0 | **MATCH — exact** | Server 127.7s, React 69.0s. **No flake this run** — neither the webhook tenant-derivation flake (KI 12) nor the React async-leak flake appeared. |
| **F2a** `npm audit --omit=dev` | 0 production findings | **`found 0 vulnerabilities`** | **MATCH** | |
| **F2b** `npm audit` | one dev-only HIGH, nanoid via vite → postcss | **1 high: `nanoid <3.3.18`** (GHSA-2v37-7h3g-55p8), reached `vite@8.2.0 → postcss@8.5.25 → nanoid` | **MATCH** | **Installed version is 3.3.17 — inside the advisory range. The finding is live, not stale.** ⚠ See the reporting trap below. |
| **F3** HEAD + tree | — | **`d0fb3aa`**; 1 modified tracked file, 7 untracked | **recorded** | Identical before and after this session. |

### F1 — the command actually run, and why

**Run: `npm test`.** Not `npm test -- --test-concurrency=1`.

`package.json` defines `test` as `npm run lint && npm run test:server && npm run test:react`.
`npm test -- <flag>` appends to the **end** of that chain — i.e. to **`vitest run`**, not to
`node --test`. It would have been passed to the wrong runner.

**The safety property the flag was meant to secure is already structural:**
`"test:server": "node --test --test-concurrency=1 server/test/*.test.js"`. The flag is baked into
the invocation, which is precisely what registry Known Issue 15 records as the correct place for
it. Nothing was weakened.

### F1 — the file-count alarm is a false positive, verified

CLAUDE.md:272 warns that *"a Vitest file count that jumps far above 6 means the include glob has
been widened and is picking up the server suite."* The count is **31**. **It is not the glob.**

- `vite.config.mjs:28` — `include: ['src/**/*.test.{js,jsx}']`, unchanged and still narrow.
- `find src -name "*.test.js*"` → **31**. Vitest ran **31**. Exact match.
- `server/test/*.test.js` → **83** files, none of which Vitest touched.

The two runners do not overlap. **The suite grew legitimately from 6 files to 31; the tripwire's
alarm condition was written against a number that has been obsolete for months** — which is the
same defect as A2b, from the other direction. **Set against the current floor, one number stops
being unable to fire and the other stops crying wolf.**

### F2 — a reporting trap worth knowing

```
$ npm ls nanoid
└─┬ vite@8.2.0
  └─┬ postcss@8.5.25
    └── nanoid@3.3.18          ← npm prints 3.3.18

$ node -e "console.log(require('./node_modules/nanoid/package.json').version)"
3.3.17                          ← on disk

$ package-lock.json
node_modules/nanoid => 3.3.17   ← locked
```

**`npm ls` displays 3.3.18; the lockfile and the installed package are both 3.3.17.** The advisory
range is `<3.3.18`. Anyone checking with `npm ls` alone would read "3.3.18 — patched" and dismiss
a finding that is real. **Check the lockfile, not `npm ls`.**

Nothing was run to fix it — the checklist's *"⚠ Do not run `npm audit fix` inside a feature
session"* holds, and this session ships no dependency change.

---

## SEQUENCING IMPACT

Only the mismatches that change **what should be built next**, and how.

### 1. The pending-referral fix is smaller and better-aimed than the plan assumed
**B2 is falsified.** There is no wrong-column funnel join. The plan carried three root causes;
there are **two**, both in one file:
- **B1** — `pendingReferral.js:372` filters an in-memory array that is `[]` on every webhook call.
- **B3** — `jobber_clients` name fields are written untrimmed at three sites, and the matcher's
  `.trim()` does not collapse interior whitespace.

**Both are fixed by the same change**: replace the `allClients.filter()` with a normalised query
against `jobber_clients` (`LOWER(BTRIM(first_name || ' ' || last_name))`, contractor-scoped).
That removes the webhook path's `allClients = []` starvation **and** the untrimmed-name miss in
one edit, and it does not touch `matchPendingReferral`, which B4 confirms is correct.
**Do not schedule a query-rewrite session for B2. It does not exist.**
⚠ **Gate on D1 first** — if `matched > 0`, the mechanism is partial and the scoping changes.

### 2. The standing order against clicking Jobber Connect loses its stated reason
**C3 confirms zero `tokens.id=1` survivors**, backed by a `UNIQUE(contractor_id)` constraint, an
`ON CONFLICT (contractor_id)` upsert, and a sequence-filled inert `id`. The clobber risk is
structurally impossible. `PRE_LAUNCH_CHECKLIST.md:329` should be **rewritten, not ticked** — the
OAuth-return verification it also names is still owed, and that is now the only thing holding the
order. **Whoever next needs a live Jobber token is no longer blocked by this.**

### 3. `escapeHtml` is a launch-gating security item, not a tidy — and it is 2.3× the size
**C5: seven definitions, not three. Four of the six local copies do not escape `'`.** This
changes the item's **class**, not just its estimate: it is currently filed under *Correctness /
data integrity* as a consolidation, and four of the seven are a live escaping gap on
CRM-sourced strings entering HTML email bodies. **Re-file it on the security list, and size it
from 7.** The checklist's own framing — *"a partial sweep leaves two correct examples and one
wrong one"* — now understates itself: it leaves **three** correct and **four** wrong.

### 4. Two records are INVERTED, not stale — they instruct against the correct action
Per CLAUDE.md's own distinction, say *inverted* and say what is true now:
- **E1** — the record claiming FA added `is_attributable` to the general PATCH whitelist is the
  opposite of the code. The PATCH **422s** on that field (`team.js:243–247`). A session trusting
  that record would go looking for a hole that was deliberately closed.
- **A3b / `PRE_LAUNCH_CHECKLIST.md:346` and `:547`** — "IN PROGRESS — Phase 1 shipped `cd198cf`"
  describes ABR ~30 commits ago. Phases 2 through 6B have shipped. A session picking up ABR from
  the checklist would restart at the delivery seam. **Both copies must move together.**

### 5. Known Issue 14 is dischargeable — the DB constraint exists
`db.js:1672`'s `CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility))`,
with its fail-closed backfill guard at `:1653`, is exactly what KI 14 marks *"Do not build
until: Explicitly scheduled by Danny."* **It was built.** Close it rather than scheduling it.

### 6. Decision E rides with 3c; R4 does not
**E4.** A frozen rep's homeowner session cannot reach rep capability — the referrer descriptor
carries no `is_field_rep`, so `surfaceFor()` returns at `:55` before the rep rule. Decision E can
**record a ruling** instead of building a control. **But R4 is live** (`verifyAdminSession()`
never reads `active`) and is held latent only by `team.js:554`'s session delete — the first half
of the non-transactional pair the checklist records separately. **Merge those two pre-launch
items and do them in one pass.** Add the frozen-member-lands-on-an-empty-panel residual to
Decision E's ruling list.

### 7. `UI_OVERHAUL_SPEC.md` §11.1 is partly already built
**E3.** Skeleton, EmptyState **and** LockedSection all exist in `src/components/shared/`, plus
StateCard, LoadingIndicator, ErrorState, SuccessState. **Phase 4.1/4.4 should be re-scoped to
adoption, not construction**, before anyone builds a second copy of three primitives.

### 8. The brand sweep's size is 166, not 77 — and `shared/` still cannot be reached
**C7.** `server/` is exactly 77 as recorded; **`src/` adds 55 hex + 34 rgb that have never been
counted.** Separately, `LockedSection.jsx` (9 needle hits) and `Skeleton.jsx` (3) sit in
`shared/`, which is **not a D-N walk root** — confirmed, as the checklist predicted. **Add
`shared/` as a walk root in the same pass that sizes from 166**, or the sweep will report clean
over 12 live sites in two files.

### 9. Both test-count numbers in CLAUDE.md are wrong, in opposite directions
**A2b + F1.** The floor (734/35/6) cannot fire; the file-count alarm (>6) fires falsely at 31.
**Set both from today's measured baseline — 947 server / 459 React / 31 files, exit 0** — in
whatever session next touches CLAUDE.md. This is a two-number edit that restores a safety
mechanism currently providing neither protection nor signal.

### 10. Two "untracked" files in the standing order are tracked
**A4b.** `HARDCODED_ACCENT_INVENTORY.md` is committed. `.claude/settings.local.json` is committed
**and currently modified**. Any future session running `git add -A` under the belief that these
are untracked would commit a live working-tree change to the second one. **The standing order
should name what is actually untracked: the five root `.docx` files, `docs/desktop.ini`, and
`docs/superpowers/plans/`.**

---

## DANNY'S SQL

**UNRUN.** The local environment cannot reach Railway Postgres; nothing below was executed and
none of its answers are inferred anywhere in this document.

⚠ **Run these ONE STATEMENT AT A TIME in the Railway console** — it shows only the last
statement's result when several are pasted together.

⚠ **D5 HAS BEEN CORRECTED. The original will error.** `jobber_clients` has **no `name` column** —
`server/db.js:952–966` defines `first_name TEXT` and `last_name TEXT` separately. The original
`WHERE name <> btrim(name)` returns `ERROR: 42703 column "name" does not exist`. The replacement
below tests both real columns and is the one that answers B3.

```sql
-- D1 — has ANY pending referral ever converted?
--      EXPECTED: total 13, matched 0.
--      This is the gate on the whole B-group fix. If matched > 0 the
--      starvation is partial and the scoping changes.
SELECT count(*) AS total,
       count(matched_user_id) AS matched
FROM pending_referrals;
```

```sql
-- D2 — how many contractor rows, and what are they?
--      EXPECTED: exactly one row, id = 'accent-roofing-dev'.
--      Also returns status: getScheduledSyncDiscoveryRows()
--      (pipelineSync.js:900) now requires c.status = 'active'.
--      A non-'active' row silently stops the 30-min sync cycle.
SELECT id, contractor_id, status FROM contractors;
```

```sql
-- D3 — is the sync actually running?
--      EXPECTED: last_synced_at within ~30 min.
--      ⚠ If stuck at an old date, the full-sync abort is still live.
--      C2 confirmed the abort logs via console.warn ONLY
--      (pipelineSync.js:603) and never reaches error_log — so D6
--      CANNOT show it. This statement and Railway stdout are the
--      only two places that can.
SELECT contractor_id, last_synced_at FROM sync_state;
```

```sql
-- D4 — the contractor_settings split-brain.
--      EXPECTED: possibly two rows — 'accent-roofing' and 'accent-roofing-dev'.
--      Read together with D2: if 'accent-roofing' is absent from contractors
--      but present here, account.js:436 (C1) is reading a row under a
--      contractor that does not exist — or reading nothing at all.
SELECT contractor_id, count(*) FROM contractor_settings
GROUP BY contractor_id;
```

```sql
-- D5 — CORRECTED. Untrimmed names in jobber_clients.
--      EXPECTED: roughly 25% of total rows.
--      ⚠ The original (WHERE name <> btrim(name)) errors — there is no
--      `name` column. This tests the two columns that actually exist.
--      first_name is the one that matters most: a trailing space there
--      survives the matcher's own .trim() as an interior double space.
SELECT count(*) AS total,
       count(*) FILTER (WHERE first_name <> btrim(first_name)) AS untrimmed_first,
       count(*) FILTER (WHERE last_name  <> btrim(last_name))  AS untrimmed_last,
       count(*) FILTER (WHERE first_name <> btrim(first_name)
                           OR last_name  <> btrim(last_name))  AS untrimmed_either
FROM jobber_clients;
```

```sql
-- D6 — what is actually failing in production right now?
--      EXPECTED: unknown. This is the ground truth on live failures.
--      ⚠ Will NOT show the full-sync abort (console.warn only — see D3).
SELECT source, count(*), max(last_seen)
FROM error_log GROUP BY source ORDER BY 2 DESC LIMIT 15;
```

**One optional statement, added because C1's severity depends on it and D2/D4 only bracket the
answer.** Run it after D2 and D4 if either surprises:

```sql
-- D4b — does account.js:436's query return anything at all?
--       Zero rows means every account-deletion email on that path has been
--       shipping with the 'RoofMiles' fallback sender instead of the
--       contractor's, in production.
SELECT email_sender_name, company_name
FROM contractor_settings
WHERE contractor_id = 'accent-roofing'
LIMIT 1;
```

---

## NOT CHECKED

Everything a check could not reach, and why. **Nothing below is inferred anywhere above.**

- **Group D in full (D1–D6).** The local environment cannot reach Railway Postgres — CLAUDE.md
  *Deployment*, and `server/test/setup.js`'s localhost interlock makes it structural. Handed to
  Danny above.
- **Whether the full-sync abort is currently firing (C2, live half).** The code half is answered:
  the guard is contractor-scoped, not hardcoded. **Whether it fires cannot be determined from
  the repo at all** — it logs via `console.warn` (`pipelineSync.js:603`), never `logError()`, so
  it leaves no `error_log` row. Needs **D3** plus Railway stdout. **D6 will not show it**, and a
  clean D6 must not be read as evidence it has stopped.
- **Whether pending referrals have ever converted (B4, live half).** The code half is answered —
  the writer exists, is reachable, and its precondition is starved by an identified mechanism.
  Whether starvation has been total is **D1**.
- **`BrandingProfileSettings.jsx:192` in a browser.** The `#1f2638` option background is
  confirmed **still present in source** (C7). The ≈1.1:1 contrast remains **arithmetic over two
  declared values** — `#1f2638` at `:192` against `AD.textPrimary` `#1C2D4D` at
  `adminTheme.js:137`. jsdom resolves no colour, so no test in this repo can compute it. **Still
  the cheapest verification in the queue, still unperformed.**
- **Jobber OAuth return path post-Phase-4.** Untested by design — C3 retires the `tokens.id=1`
  half of the reason, not the verification itself. Requires actually clicking Connect.
- **Vercel routing-layer behaviour.** No local command exercises it (recorded as a defect class
  in the checklist). Out of scope; unchanged by this pass.
- **Whether the ~130 `requirePermission` routes each independently call `verifyAdminSession()`.**
  The checklist asserts they do and that this repetition is the only thing keeping the super-admin
  bypass latent. **Not counted here** — it needs a per-route enumeration, which is its own pass,
  and no check in this session's scope requested it. E4 confirms only the narrower fact that
  `verifyAdminSession()` itself does not check `active`.
- **Known Issue 12 / the React async-leak flake.** Neither appeared in F1's single run. **One
  green run is not evidence a load-dependent flake is gone** — both are documented as
  intermittent under full-suite load. Treat the flake entries as open.
- **The `?admin=true` producer count (8, not 5)** and the `section=crm` reader — recorded in the
  checklist, not re-verified here; no assigned check covered them.

---

*Verification pass complete. `d0fb3aa`, 2026-08-21. 31 rows: 30 carry a verdict (F3 records
state only). **21 MATCH, 9 MISMATCH, 0 COULD NOT RUN** — the 9 counting A3a and A3b, whose text
matched and whose substance did not. Group D (6 statements) was deferred to Danny by design, not
by failure.*

---

## ADDENDUM — 2026-08-21, Group D results

All six Group D queries were run in production after this document was written (D5 and D6
required corrected column names; see below). The DANNY'S SQL block above is preserved as
written.

| Query | Result | Verdict |
|---|---|---|
| D1 pending_referrals | 13 total, 0 matched | MATCH — confirms the headline |
| D2 contractors | 1 row, `accent-roofing-dev`, active | MATCH |
| D3 sync_state | `accent-roofing-dev`, 2026-08-21 16:30 | ⚠ MISMATCH — the pipeline is HEALTHY. "Full-sync aborts every cycle" in `RoofMiles_BuildSequence_JobRevenueCapture.docx` is FALSE as of this date. |
| D4 contractor_settings | 1 row, `accent-roofing-dev` | ⚠ MISMATCH — split-brain CLOSED at the data level. |
| D5 trailing spaces | NOT RUN — `jobber_clients` has no `name` column (`first_name` / `last_name`). Sizes the fix; does not change it. | deferred |
| D6 error_log | RUN — see below | ⚠ one live finding |

### D6 — what is actually failing in production

⚠ The original D6 was wrong twice: no `last_seen` column (it is `last_seen_at`), and `count(*)`
counts DISTINCT ERRORS, not occurrences — `error_log` dedupes and carries its own `count`
column. Corrected query used `sum(count)`.

| Source | Occurrences | Last seen | Verdict |
|---|---|---|---|
| `backend` | 1,009 | **2026-08-21 13:28** | ⚠ LIVE — see below |
| invoice-paid 401 | 244 | 2026-07-17 | CLOSED by TF's retry mitigation |
| `cron:admin_cache_expiry` | 85 | 2026-05-25 | stopped, cause unknown |
| `cron:jobber_incremental_sync` | 52 | 2026-08-16 | quiet |
| Jobber GraphQL no-clients-data | 31 | 2026-08-14 | throttle, registry KI-5 |
| No OAuth token (stats) | 8 | 2026-06-23 | CLOSED by S90 Fix A. ⚠ Names `accent-roofing-dev` — the CORRECT id, NOT the phantom. Not a second `account.js:436`. |
| `inconsistent types deduced for parameter $5` | 8 | 2026-05-26 | real bug, route `unknown`, quiet 3 months, low priority |

### 🔴 THE ONE LIVE FINDING — registry KI-2b was closed in error

The `backend` bucket is not 48 unrelated failures. It is dominated by ONE bug:

```
null value in column "jobber_client_id"   /jobber/client-update  344
null value in column "jobber_client_id"   /jobber/client-create  144
null value in column "jobber_client_id"   /jobber/client-update   64  ← last seen 2026-08-21 13:28
client-update webhook: missing client id in payload             107
client-create webhook: missing client id in payload              54
```

**~550+ occurrences. Still firing today.**

⚠ Registry Known Issue 2b marks this "STALE/RESOLVED (Session 94)" on the strength of a careful
re-read: *"Re-read `upsertAndTagClient()` in full on 2026-07-06 — it consistently uses
`fullClient.id` at every write site. No patch needed."* **The read was correct and the
conclusion was wrong.** The companion rows show why: the failure is UPSTREAM of the write sites,
on the sparse-payload fallback path where the client id never arrives at all. A read scoped to
the write sites could not see it.

The Tenant Rebuild S1–S3 handoff caught a fresh instance three days later (`error_log` id 1339,
2026-07-09) and flagged it as evidence for 2b — **and the registry entry was never reopened.**
Two records, one item, neither seeing the other.

### ⚠ CORRECTION TO §C7 — the hand counts are line-counts, and they are LOWER BOUNDS

§C7 above records the brand-literal sweep at **77 (`server/`) / 166 (total)**. Those figures were
produced with `grep -c`, which counts matching **LINES**; a line carrying two literals counts
once. `scripts/sizing.js` — written the same day and counting **occurrences** — returns
**80 / 170**.

**Neither is an error. §C7 is correct as a line-count and superseded as a site-count**, and its
per-file table remains the accurate line-level breakdown.

⚠ **The consequence is wider than these two figures.** Every hand-derived count in this
document, and in this project's records generally, was produced the same way. **Each is a LOWER
BOUND, not a total.** Treat any un-generated number as *"at least N."* Run `npm run sizing` for
the three counts it covers; for the rest, the technique itself is the limitation.

### SEQUENCING IMPACT

1. D3 and D4 remove two of the three stated reasons for prioritising contractor-ID
   reconciliation. `account.js:436` remains live-broken; "the pipeline is degraded" does not.
2. ⚠ Every one of those ~550 failures is a Jobber client that never landed in `jobber_clients` —
   the table the matching-engine rebuild is meant to query. The ingestion path feeding the fix
   has been dropping rows the whole time. **The null-guard fix belongs IN the Tier 1 ingestion
   session**, alongside name normalisation, and the backfill must account for clients never
   written, not only clients written badly.
3. `error_log.resolved` has NEVER been set on any row — `still_open == distinct_errors`
   everywhere. The column exists and is unused, so the table cannot distinguish "fixed" from
   "stopped happening." Dates are doing all the work.
4. The `backend` source label carries 48 distinct errors with no attribution.
   `logError({ source: 'METHOD /path' })` is the convention; most callers omit it, so 72% of
   error volume lands in an ungroupable bin.
