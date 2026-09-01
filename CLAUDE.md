This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **When working on any feature listed in the Feature Registry or Pending Features, read `CLAUDE_REGISTRY.md` before writing any code.**
>
> **`PRE_LAUNCH_CHECKLIST.md` (repo root) is the CANONICAL index of all open and deferred work** — pre-launch items, C/DL-3b-2, C/DL-3c, Decision E, contractor-ID reconciliation, and the named builds. Read it when picking up work or closing a session. Detail stays in the documents it points at.
>
> ⚠ **DOC UPDATES ARE A PRECONDITION FOR THE HANDOFF, NOT A SECTION OF IT.** Before you write one line of a handoff, `PRE_LAUNCH_CHECKLIST.md` must already carry what this session deferred. **A handoff is not a place deferrals live** — it is untracked, it is read once, and the next session opens the checklist instead. **This has failed measurably, twice, and the second time while the warning was open.** `account.js:436` was ruled into the record as a live defect and simply was not written, for four commits. Then ABR Phases 1-4 deferred six items, wrote them into its handoff, and left the checklist untouched **for nine commits** — including one flagged in that very document as *"needing a checklist line in Phase 6."* Both were recovered by luck, from a file git has never seen. **The order is: checklist, then handoff. If the checklist edit is not committed, the session is not finished.**

## Where New Content Goes

Four destinations. Route by ONE question:

> **Could this be violated without anyone looking it up?**

If yes it is a RULE and it must be resident — a rule nobody loads is not a rule. If it is
only discoverable by going and reading it, it is REFERENCE and does not belong in context.

| Destination | Holds |
|---|---|
| `CLAUDE.md` (this file) | Rules governing decisions made **before** any file is open |
| `.claude/rules/*.md` | Rules that only bite once you are editing a matching file |
| `docs/ARCHITECTURE.md` | Reference — read at most once a session, usually derivable from the codebase |
| `CLAUDE_REGISTRY.md` | The feature registry (see above) |

⚠ **SCOPE BY WHO NEEDS IT, NOT BY WHAT IT MENTIONS.** The `?admin=true` block reads as
frontend because it names an admin URL, but its audience is the server-side email templates
that still build those links. Scoped to `src/**` it would have been guaranteed absent for the
one session that needs it. Ask who gets hurt by not having it, not what it talks about.

**This file loads IN FULL at the start of every session, so every addition is paid for by
every future session.** Adding a rule is correct. Adding reference data borrows against all
of them.

⚠ **THERE IS NO FIXED SIZE LIMIT, AND THIS SENTENCE USED TO CLAIM ONE.** It read *"40,000
chars is Claude Code's performance-warning threshold"* until 2026-08-23. That number was
never sourced: it traces to a single unsourced line in a May audit which was itself
"correcting" one unsourced figure to another, and it was then copied into three more
documents that read as independent confirmation. Claude Code's *"CLAUDE.md is too long"*
warning **scales with the model's context window** (2.1.169), is counted in **TOKENS** — not
chars, and not the bytes every figure here was actually measured in — and its consequence is
**a console warning**. Not truncation. Not dropped instructions.
⚠ **Do not write a replacement number here, including a token estimate.** Substituting one
unverified figure for another is exactly the move that produced the last one. If size ever
needs to bind a decision, establish the threshold, the unit and the consequence first —
`PRE_LAUNCH_CHECKLIST.md` records what that would take.

⚠ **When reclaiming, measure the REFERENCE SENTENCES that will move — not the character
extent between headings.** A block is rarely all reference: the rule inside it stays resident
and a pointer replaces what left, and in ABR 6A that overhead consumed **68% of two blocks
measured as pure reference**. Estimate net, then verify by measuring after.

**Headings are load-bearing.** `CDL_3a_BUILD_SPEC.md`, `CDL_3b_BUILD_SPEC.md` and
`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` cite headings here BY NAME, and code comments cite
sections. Renaming one breaks them silently and all at once. When a block moves, its heading
stays in both places.

**Relocations are verbatim.** Never correct staleness in the same commit as a move. A diff
containing both cannot be reviewed, and a relocation's whole value is that it can be checked
mechanically. Phase 1 shipped one knowingly-wrong line rather than break this
(`docs/ARCHITECTURE.md:217`); Phase 2 shipped a second (`server/test/escapeHtmlExport.test.js:6`).
**Both were corrected in ABR 6A commit 1**, once the relocations were complete and a
correction could be reviewed on its own. ⚠ **The two examples stay.** They are the evidence
the rule was ever obeyed, and a fence whose subject is gone is still the record that someone
chose to build it.

### Scoped rule files — ⚠ and they may not be loaded right now

| File | Governs | Loads when |
|---|---|---|
| `.claude/rules/backend.md` | server conventions: util/adapter signatures, the cron-job procedure, pipeline-cache, webhook, payout, cron-lock and rate-limit behaviors, the Contact Matching Standard | Claude reads `server/**/*.js` |
| `.claude/rules/frontend.md` | src conventions: import conventions and `useBranding()`, the ESLint disable rule, styling tokens and brand values | Claude reads `src/**/*.{js,jsx}` |

⚠ **These are NOT loaded at session start and are NOT re-injected after a compaction.** They
load when Claude first reads a matching file. **If this session needs backend or frontend
conventions and has not opened a matching file, read the file directly — never read the
absence of a rule as the absence of a rule.**

This block exists because *unannounced* absence is this codebase's recurring failure mode:
the hand-maintained FILES list, the hex-only sweep needles, the value-only `toContain`, the
unconsumed fixture. Each read as covered and was not. Known absence is recoverable; silent
absence is not.

---

## Commands
```bash
# Development
npm start          # Vite dev server on port 3000
node server.js     # Express backend on port 4000

# Production (Railway)
npm install        # build step
node server.js     # start step

# Build
npm run build      # production Vite build → dist/

# Quality
npm run lint       # ESLint over src/ — react-hooks rules only
npm test           # lint + server suite + React suite (the single pre-push gate)
```

The frontend builds with **Vite**, not create-react-app. **Frontend env vars are `import.meta.env.VITE_*`, never `process.env.REACT_APP_*`.** `npm run lint` is narrow by design — react-hooks rules only; **never add a recommended preset.**

> The build/lint history and the reasons — Vercel's `vercel.json` config, why the preset is excluded, `.npmrc`'s `legacy-peer-deps` — moved to `docs/ARCHITECTURE.md` in ABR 6A commit 2. See **The Vite migration — build and lint configuration** there.

---

## Architectural Principles

Every decision must pass two filters:
1. Will this produce healthy, efficient code unlikely to break?
2. Will this work at large scale — many contractors, many referrers?

MVP shortcuts must be flagged with a code comment explaining: (a) the limitation, (b) the scalable version, (c) when to build it.

> The **Known MVP shortcuts** inventory moved to `docs/ARCHITECTURE.md` in ABR 6A commit 2 — see **Known MVP shortcuts** there. The rule above is what makes that list reference: the flag lives in the code, so the inventory is a lookup, not a thing you could violate.

---

## Architecture

**RoofMiles** is a white-label referral rewards SaaS platform — Node.js/Express backend (Railway), React SPA frontend (Vercel), PostgreSQL.

### Backend — Folder Structure

`server.js` is a lean entry point only — dotenv, process-level error handlers, the initDB()/cron bootstrap IIFE, the legacy backup cron, and `app.listen()`. All Express app construction (middleware, all 9 route mounts) lives in `server/app.js`'s `createApp()` factory (tenant-resolution rebuild, S1) — never add route handlers, middleware, or business logic to server.js itself.

> Moved to `docs/ARCHITECTURE.md` in restructure Phase 1 — see **Backend — Folder Structure** there.

**Key backend rules:**

> Moved to `.claude/rules/backend.md` in restructure Phase 2 — see **Key backend rules** there.

**Key backend behaviors:**

- Pipeline stages: lead → inspection → sold → paid. DB value `'paid'` maps to frontend key `'complete'` ("Complete ✓").
> Moved to `.claude/rules/backend.md` in restructure Phase 2 — see **Key backend behaviors** there.

**Database tables:** the full list, and the note on tables missing from it, moved to
`docs/ARCHITECTURE.md` in restructure Phase 1.

---

### Frontend — Component Structure

> Moved to `.claude/rules/frontend.md` in restructure Phase 2 — see **Frontend — Component Structure** there.

**Three top-level surfaces, chosen by IDENTITY — never by URL** (C/DL-3b Phase 5):
- **Referrer app** — 5-tab bottom nav: Home, Refer, Rankings, Cash Out, Profile
- **Field rep** — 3c placeholder today; reached only by `tier='general'` **and** `is_field_rep`
- **Admin panel** — sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Referral Review, Engagement, Settings, Contacts, Campaigns, Inbox

⚠ **`?admin=true` NO LONGER DOES ANYTHING.** This line used to read "Admin panel — accessed via `?admin=true`", and that has been false since Phase 5. One unified door (`src/components/auth/LoginScreen.jsx`) serves every role; `src/App.jsx`'s `surfaceFor()` routes on the authenticated session descriptor, and the query string is not consulted. Typing the parameter gets the same login screen as typing nothing. Several server-side notification emails still build `?admin=true` links — they land correctly on that door, and the inert parameter is queued for the pre-launch literal sweep.

#### Folder structure
> Moved to `docs/ARCHITECTURE.md` in restructure Phase 1 — see **Folder structure** there.

#### Import conventions
> Moved to `.claude/rules/frontend.md` in restructure Phase 2 — see **Import conventions** there.

#### ESLint note
> Moved to `.claude/rules/frontend.md` in restructure Phase 2 — see **ESLint note** there.

#### Styling
> Moved to `.claude/rules/frontend.md` in restructure Phase 2 — see **Styling** there.

---

## Contact Matching Standard

> Moved to `.claude/rules/backend.md` in restructure Phase 2 — see **Contact Matching Standard** there.

---

## Code Quality Standards

When reading any file during a session, silently audit and flag violations before proceeding:

- `.then()` chains → must be async/await
- `var` declarations → must be `const` or `let`
- Callbacks → must be async/await
- Class components → must be functional (except ErrorBoundary.jsx — intentional)
- Missing try/catch on async functions → must be wrapped
- Hardcoded contractor_id or credentials → must use env vars; contractor **identity** comes from `useBranding()` / the D4 branding chain, never a config module
- Unparameterized SQL → always use `$1`/`$2` placeholders, never concatenate user values
- Missing retryWithBackoff on external API calls → all Jobber, Resend, Twilio, Stripe, Anthropic calls must use it
- `SELECT *` returning data to client → always use explicit column lists
- `err.message` or `err.stack` in `res.status(500)` responses → replace with `'Internal server error'`
- `console.log` in production code → remove unless marked `// diagnostic log — intentional`
- A backtick inside a **comment within a template literal** → remove it, or reword

Report violations and ask whether to fix before or after the assigned task. Never silently leave a violation.

**The backtick rule, because it produces no error and is invisible in review.** A stray `` ` `` inside a comment in a template literal *closes the string*. The remainder does not become a syntax error — it parses as an expression, so the file loads, the server boots, and the tests that do not read that value stay green. In the case that established this rule, a backtick in a CSS comment inside `landing.js`'s `PAGE_CSS` turned the stylesheet into `"…first half…" || \`…second half…\``, and `||` short-circuited on the truthy first half: **everything after the comment was silently dropped from the served page** — the hardcoded `#F26A1B` RoofMiles mark and every `@keyframes` rule. Two existing fences caught it; nothing else would have.

This applies to every template literal carrying markup or styles — `server/routes/landing.js`, and the HTML email bodies in `referrer.js`, `admin/campaigns.js` and the cron jobs. Backticks are natural to write in a comment (quoting a CSS property, an operator, a variable name), which is exactly why this is worth a line here. Use plain words or single quotes instead.

**The predicate matches its own VALUE's shape, not its siblings' form.** `Number.isFinite`, not `Array.isArray`, and not `!= null`. In ABR 6B one of five settled responses was an object carrying a number while the other four were arrays; guarding it like its siblings reads nothing, and `!= null` admits a string — `"7" + 2` is `"72"`, a confidently-wrong badge in a red pill. **Write the guard the value needs, and say in a comment why it differs from the ones beside it** — otherwise someone will "correct" it into line with them.

## Dependency Management Standards

- Run `npm audit` before every push to Railway. HIGH/CRITICAL findings must be resolved or explicitly acknowledged.
- Run `npm outdated` at the start of any session touching package.json.
- Never install a new npm package without flagging it to Danny first — state what it does, why it's needed, whether anything already installed could do the job.
- Never install a package for a single use case that a few lines of native Node.js could handle.
- When a feature is removed or rewritten, check whether any package it depended on is now unused. Remove unused packages in the same session.
- devDependencies must never be imported in server/ production code.

## Code Cleanliness Standards

- Dead code must be removed in the same session it is identified — no commented-out functions, unused imports, or orphaned files.
- Every function with non-obvious logic must have a comment explaining what it does, inputs, and outputs.
- Functions longer than 60 lines are a signal to split — flag and discuss before leaving in place.
- Duplicate logic written in more than one file must be extracted to a shared utility in server/utils/ or src/utils/.
- No `console.log` in production code paths. Exception: lines marked `// diagnostic log — intentional`.
- Known complexity debt (do not refactor without explicit scheduling): server/routes/webhooks/jobber.js invoice-paid handler (~460 lines), server/routes/admin/campaigns.js (~3,163 lines).

## Periodic Code Health Checklist (every 5–10 sessions)

> Moved to `docs/ARCHITECTURE.md` in restructure Phase 1 — see **Periodic Code Health Checklist** there.

---

## Security Standards

- Never trust identity values from the request — `user_id`, `full_name`, `email` must come from verified session token via DB lookup.
- Session queries must always include `AND role = $n AND expires_at > NOW()`.
- New endpoints handling user data must use `verifyReferrerSession()` — never inline a raw token check.
- All external API calls must use `retryWithBackoff()`.
- Never remove `express.raw()` on `/webhooks/*` in server.js — required for HMAC verification.
- `ADMIN_PASSWORD` must always be a Railway env var — app crashes on startup if missing (intentional).
- `logError()` must be called in every catch block — never use `console.error` alone in production.
- Never delete rows from `error_log` — use `resolved = true`.
- Error responses must never expose `err.message` or `err.stack` to the client.

---

## Brand Standards

For UI/UX work, read:
- `.claude/skills/ui-designer/`
- `.claude/skills/ux-designer/`
- `.claude/skills/ui-ux-pro-max/`

⚠ **THE PLATFORM BRAND IS ROOFMILES.** `#F26A1B` primary, `#1C2D4D` secondary, `#FDF0E7`
background, `#FFFFFF` surface — `src/utils/brandingTheme.mjs`. This line used to read *"Brand
files at `G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`"*, which
pointed every UI/UX session at **one tenant's** brand kit as the platform's source of truth.
That was the single-tenant era's assumption surviving inside the section named *Brand
Standards* — **the defect D-B was raised about, and the reason the colours it went looking for
were never here.** Accent Roofing is a **contractor**; contractor identity resolves at runtime
through `useBranding()`, never from a file on a drive.

### ⚠ THE INFRASTRUCTURE IS STILL NAMED `rooster-booster`, AND THAT IS A KNOWN ACCEPTED STATE

**A fresh session hunting for a RoofMiles-named resource will not find one, and will conclude it is
looking at the wrong account.** That happened: C/DL-3c Phase 0.5 opened Railway, saw no project
named for the product, and recorded *"none of them RoofMiles"* as a fact about **access**. It was
an inference drawn from a **name**.

- **RoofMiles** — the product and the platform-facing name. Resolved at runtime from
  `resolveBrandingTheme(null).companyName`; there is deliberately no second copy
  (`src/utils/platformIdentity.js`).
- **Rooster Booster** — the name the project started under. ⚠ **Two source comments characterise
  it differently and neither says "a contractor's white-label":** `src/utils/platformIdentity.js`
  calls it *"the retired platform name"*, `src/utils/brandingTheme.mjs` calls it *"this platform's
  internal codename"*. **Recorded as a discrepancy rather than resolved** — whichever is right, the
  infrastructure consequence below is the same.
- **Still stamped with the old name, each verified against source rather than copied from a list:**
  the **Railway project** · the **GitHub repo** (`git remote -v` → `dannyscribbins-create/rooster-booster`)
  · the **local working directory** (`C:\Users\stacy\rooster-booster`) · **`package.json`'s `name`**
  and **`package-lock.json`'s two `name` fields**.

⚠ **THE RENAME IS DELIBERATELY NOT DONE. IT IS NOT A CLEANUP ITEM SOMEONE SHOULD HELPFULLY CLOSE.**
Renaming a Railway project or a Git remote touches deploy wiring on a **live** service for a
**cosmetic** gain. It is recorded here as a known, accepted state so the next session neither
"fixes" it nor mistakes it for evidence of anything.

⚠ **AND THE GENERAL RULE, WHICH IS WHY THIS SITS IN A GOVERNING FILE RATHER THAN A HANDOFF: DO NOT
INFER A FACT ABOUT ACCESS, OWNERSHIP OR IDENTITY FROM A NAME.** Stopping rather than guessing at an
unfamiliar resource is right; **recording the guess as a finding is not.** Say what was observed,
then say what was not checked.

---

## Deployment

**Every commit to main auto-deploys to Railway.** Pushing IS deploying.

**Local environment cannot connect to Railway PostgreSQL.** Always test login-dependent features on live deployment.

**`server/migrations/add_payout_columns.js` — superseded by initDB(). DO NOT RUN AGAIN.**

> Vercel's manual-redeploy procedure, the Jobber API version header, `DB_QUERIES.md` and the migration inventory moved to `docs/ARCHITECTURE.md` in ABR 6A commit 2 — see **Deployment** there. (The version header stays resident where it is a rule: *Never Break → Jobber API*.)

### Environment Variables (Railway)
> Moved to `docs/ARCHITECTURE.md` in restructure Phase 1 — see **Environment Variables (Railway)** there.

---

## Testing

- `npm test` runs the lint step and BOTH suites, and is the single pre-push gate:
  - `npm run lint` — ESLint over `src/`, react-hooks rules only (see Commands above).
  - `npm run test:server` — `node:test` over `server/test/*.test.js` with `--test-concurrency=1` (the concurrency flag is load-bearing: Node 24 runs test files in parallel by default and the suites share one database).
  - `npm run test:react` — **Vitest** + jsdom over `src/**/*.test.{js,jsx}` via `vitest run` (the `run` subcommand is what makes it exit instead of entering watch mode; `npm run test:react:watch` is the interactive one).
  - The three are chained with `&&`, lint → server → react, so a red React test blocks a push exactly like a red server test. Consequence to know: if an earlier step fails, the later ones do not run that invocation.
  - ⚠ **THE TWO RUNNERS MUST NEVER OVERLAP.** `vite.config.mjs`'s `test.include` glob is what enforces it structurally rather than by convention — **never widen it, and never point another runner at `server/test/`.** (Why, and the incident: `docs/ARCHITECTURE.md` → **The Vitest include glob**. Moved there in ABR 6A commit 2 — reference, not rule.)
  - ⚠ These were separate commands until C/DL-2 Phase 3c, and component tests were therefore green only when someone remembered to run them. That is precisely how `BrandingPreview.jsx` drifted to Accent Roofing's palette while the server used RoofMiles' — no test was wrong, none of them ran.
- Never add a React test that only runs under `test:react:watch`, and never split the gate back apart.
- Test database is local PostgreSQL at localhost:5432, database `roofmiles_test`, credentials in `.env.test` (gitignored, local-only — never commit).
- `server/test/setup.js` contains a safety interlock: the run aborts unless `DATABASE_URL` points to localhost/127.0.0.1. Tests cannot touch production by construction.
- Rule: run `npm test` before every push. Lint must be clean and both suites fully green — **1118 server tests across 177 suites, and 483 React tests across 34 files** (measured 2026-08-30 at HEAD `7252cc5`, Wave 1.1 close-out, by running the gate). A drop below these numbers means tests were deleted; stop and report.
  ⚠ **THE HEAD STAYS `7252cc5` DELIBERATELY — DO NOT "UPDATE" IT TO THE WAVE'S CLOSING SHA.** Wave 1.1 closed at `d16bc31`, which is docs-only; the gate was re-run there on 2026-08-30 and returned the identical four numbers. **`7252cc5` is where the measurement was actually taken, and that is what makes the figure re-checkable.** Rewriting it to a HEAD the measurement was not taken at would make the citation *less* true while looking tidier. **Second time a tripwire in this file has attracted a well-meaning edit** — the first set it 171 tests below its own floor.
  ⚠ **THIS TRIPWIRE HAD GONE STALE BY 171 SERVER TESTS AND WAS RE-ARMED HERE.** It read *"947 server tests and 459 React tests across 31 files (measured 2026-08-21, HEAD `d0fb3aa`)"* — the figure `docs/GROUND_TRUTH_2026-08-21.md` established, correct on the day and never moved since. At 947 it could not fire until someone deleted a fifth of the server suite. **That is the second time this exact tripwire has been found below its own floor**, and it is the worked example in *A mechanism that reports health it cannot observe* below. The failure mode is structural: a hand-maintained number in a document nobody edits when the thing it measures grows. **When you find it stale, re-arm it with the figure you MEASURED and the HEAD you measured it at** — never an estimate, and never a number carried from a prior session's report. ⚠ Check the EXIT CODE, not the pass count — a suite can report passing while exiting 1. (Treat the numbers as a tripwire for an unexpectedly SHRINKING suite, not as a target to keep updated by hand. A Vitest file count that jumps far above 31 means the include glob has been widened and is picking up the server suite — see the warning above.)
- Characterization rule: a failing or surprising test result means STOP and report — never adjust production code to satisfy a test, and never silently adjust a test to satisfy the code. Deliberate behavior changes update the relevant test openly and are documented in the session handoff.
- Migration idempotency proofs must include a reproduction seeded with production's actual pre-existing row shapes, not only fresh-schema runs — a test DB rebuilt from scratch every run can never exercise "a real pre-existing row already in some legacy state," which is exactly what breaks in production and never breaks locally. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that established this.

---

## Editing mechanics — edits that produce no error

### Multi-range edits go in strictly DESCENDING order, and you ASSERT it

When one commit inserts at several points in a file, **apply the lowest-numbered edit LAST.**
An insertion shifts every line below it, so ascending order invalidates the anchors you
derived before you started — silently, because the edit still applies somewhere.

⚠ **ASSERTING IS THE RULE, NOT THE ORDERING.** Intending descending order and achieving it are
different things, and nothing in the tooling tells you which happened. **Write the start lines
down and check they decrease.** ABR 6A commit 1: `310 → 292 → 282 → 243 → 67 → 51 → 47 → 28`,
verified rather than intended.

⚠ **TWO EDITS AT ONE ANCHOR IS THE CASE THIS EXISTS TO PREVENT — MERGE THEM.** When an
insertion and a replacement share a line, they are not two edits in an order; they are one
edit you have not written yet.

*(Exact-string matching hides the ordering error rather than removing it: each edit still
finds its anchor, so the failure surfaces as a correct-looking file with content in the wrong
place. Order and assert anyway.)*

### A fact written into N files costs N corrections, and you will find N-1

The lock icon's contrast figures — `1.67:1`, `4.87:1`, `#B45309` — are in **seven** files.
Every one had to move together, and the count was recorded as five. **Before duplicating a
fact into a comment, ask whether a NAME would do.** Same-file, cite by role; cross-file, cite
by name. **Never cross-file by line number** — ABR 6B step 4 corrected four citations that had
gone stale, one of which the correcting commit itself falsified.

⚠ **AND ITS SCOPE IS EVERY TRACKED `.md`, NOT ONLY CODE COMMENTS. STATED HERE BECAUSE THE
AMBIGUITY WAS COSTING 785 CITATIONS.** This paragraph opens *"before duplicating a fact into a
COMMENT"*, so the rule read as being about code, and the governing documents were left to their
own devices. **Measured 2026-08-31: 785 line citations across the tracked markdown, outside record
blocks** — under a rule that appears to forbid them. **A rule whose reach is ambiguous is not
being violated; it is being read differently**, and every one of those was written by someone who
had read this file.

**So: a document cites CODE by role — a handler, a function, a constraint, a route — exactly as a
comment does.** *"`POST /api/login`'s frozen branch"*, never a line number into `referrer.js`. A
line number is correct on the day it is written, and nothing ever tells you the day it stops
being — which is the entire failure mode, and the reason this sentence carries no example of the
wrong form.

⚠ **TWO NARROW EXEMPTIONS, AND BOTH ARE ABOUT RECORDS RATHER THAN CONVENIENCE.** A **dated
snapshot** that quotes what it cites, and a sentence **whose subject is that a citation is wrong**.
Both are marked with `<!-- citecheck:record -->` … `<!-- /citecheck:record -->` and excluded from
the count. **Marking a live citation to get it out of the count is the rubber-stamp failure** —
the marker is for a record of a past state, never for a citation you did not want to fix.

**`npm run citecheck -- --role-only` is what makes this enforceable rather than aspirational.** It
counts what is there against `ROLE_ONLY_BASELINE` and reports growth. ⚠ **It PRINTS — it is in no
gate, and it must not be added to one.** ⚠ **And it does NOT require the 785 to be repaired
first**: the baseline is today's number and the assertion is that it must not grow, so the rule
binds new writing immediately while the repair stays incremental and optional.

⚠ **A MEASURED INSTANCE, AND THE WAY THE LAST COPY SURFACED IS THE LESSON.** C/DL-3c Phase 1a
found one claim — *"the theme engine exists, so only the toggle is missing"* — repeated across
governing documents, engine-true and surface-false in every copy. A deliberate enumeration
found **three**. The **fourth** (`EXECUTION_SEQUENCE.md`'s Wave 3 *UI Overhaul arc* row) was
found **by opening that file to make one of the other three edits** — not by any search.
**Grep found the copies that shared a phrase; the fourth said the same thing in different
words**, which is precisely what a needle cannot reach. ⚠ **This happened in the same session
that filed the checklist item the claim had been hiding** — so the enumeration was careful, was
the whole point of the work, and was still short by one. **Budget for N-1 as the expected
outcome of a search, not as a failure of one.** When a claim matters, the search is a starting
set: read the files that would have reason to carry it.

⚠ **AND THE INVERSE, WHICH IS THE DANGEROUS DIRECTION. When deduplicating, dedupe TOWARD the
resident copy, never away from it.** The `.claude/rules/*.md` files elaborate non-negotiables
that stay resident here. Deleting the resident line because a fuller version exists in a
scoped file **silently unscopes a non-negotiable** — it now loads only for sessions that
happen to open a matching file. The scoped copies say this too, and that is exactly why it
must also be said here: **a rule protecting resident rules cannot itself be scoped.**

### Adding a comment block is a citation-rotting edit

**Comments feel inert. They are not: they move every line beneath them.**

`9ad52f2` added a ~45-line explanatory comment to `verifyAdminSession()`. Four citations below
it in the same commit's own files went stale — `server/middleware/auth.js:86-90` and `:209`
became `:137` and `:256`, and the fix moved `server/routes/admin/team.js:554-555` to
`:575-576`. **Every one still resolved to real code.** That is the silent variety: the number stays plausible, the file exists, the line
exists, and it describes something else entirely.

**Before adding a comment block, grep for citations into the lines below it.** Or write the
citation by role in the first place, per the rule above — a handler name does not drift.

⚠ **AND `scripts/citecheck.js` DOES NOT CATCH THIS, WHICH IS WHY THE RULE IS HERE.** *"We have
a tool for that now"* is what lets the next one through. **Three confirmed limits, all
measured:**
- **It cannot see a wrong range inside a file that resolves.** Measured at `c2434d2^`: all
  three `permissions.js` citations reported OK, including the wrong one. That was the defect
  the tool was built after.
- **It goes blind on frequently-edited documents.** STALE compares git timestamps per FILE, so
  any edit clears every staleness signal inside it. `server/routes/admin/contacts.js:891` is
  cited in five places including this file, names a predicate deleted 2026-08-24, and reports OK.
  **A low STALE count on a hot document is NO EVIDENCE, not health** — and the governing
  documents are the hottest.
- **It cannot see line drift caused by the edit being made**, which is this rule's whole
  subject. ⚠ **PARTLY CLOSED IN WAVE 1.1-d2 — `npm run citecheck -- --changed-files` now
  reports citations pointing into files you just touched, ranked. Read the next block before
  acting on it.**

**The mechanism that caught all four was the audit, not the tool.** Run
`npm run citecheck`, then still read the citations you moved.

⚠ **`--changed-files` SAYS "LIKELY ROTTED". IT MEANS "YOUR EDIT MOVED THE TARGET LINE." IT
DOES NOT MEAN "THIS CITATION WAS CORRECT BEFORE."** An already-rotted citation reports
*identically*, because a diff knows nothing about what the citation was ever pointing at.

⚠ **SO DO NOT REPAIR BY ADDING THE DELTA.** It is the obvious fix, it is one keystroke, and on
an already-rotted citation it **certifies a wrong number as repaired** — which is exactly how
`db209f3`'s citation repair falsified one of the four it was fixing. **Measured: the commit
that shipped the mode flagged ELEVEN of its own citations, and on verification ALL ELEVEN had
already been wrong beforehand**, some by many commits. Adding 10 to each would have produced
eleven confidently-wrong citations under a message saying they were repaired.

**The procedure: read the cited content at the OLD line in the OLD revision and confirm it is
what the citing sentence describes. Only then shift it.** If it was already wrong, the fix is
re-deriving where the subject lives — a different and larger job, and one to record rather
than improvise.

⚠ **THE SHARPEST PROOF OF THAT PROCEDURE, MEASURED IN C/DL-3c PHASE 1 — AND IT CAME FROM A LIST
WHERE ONE MEMBER WAS FLAGGED AND THE REST WERE NOT.** `PRE_LAUNCH_CHECKLIST.md`'s *"Retire the four
spec-level copies of the exact-path staging rule"* cited four files by line. `--changed-files`
flagged **one** — `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`, because that spec was edited in the same
commit. It had been **correct**, and the edit moved it. Verifying it forced a read of the other
three, and **`UI_OVERHAUL_SPEC.md:290` was ALREADY WRONG** — it pointed at *"Phase 0 read-only
investigation before each phase"*, while the staging bullet sat two lines further down.
**`citecheck` never flagged it, because that file was not touched.**
**ADDING THIS COMMIT'S DELTA TO ALL FOUR WOULD HAVE MOVED THE ONE CORRECT CITATION AND LEFT THE
WRONG ONE WRONG.** All four are now cited by role.

⚠ **SECOND PROOF IN THE SAME PHASE, AND IT IS THE STRONGER FORM: the two copies of
`PRE_LAUNCH_CHECKLIST.md:139-143` WERE NEVER SIMULTANEOUSLY RIGHT.** It was correct in
`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` when written at `ceae890`, and **already false when copied
into `src/utils/brandingChain.js` at `923958b`.** No single delta could ever have repaired both,
at any point in their history. **That is the argument against arithmetic repair in its strongest
form: the two numbers were never the same fact.** Both now cite by role.
→ *When the artifact under repair is a SET of citations* below, which is what finding these
required.

⚠ **AND THE EXEMPTION HAS A HOLE IN IT: A RECORD-OF-A-ROT WRITTEN AS A LINE NUMBER ROTS TOO.**
*"Never repair a record"* is the standing exemption — a dated snapshot, or a sentence whose
subject is that a citation is wrong, must not be renumbered, because renumbering destroys the
evidence. **That is right and it is only half the rule.**

<!-- citecheck:record -->
**The worked example, and it is deliberately left unrepaired so it stays checkable:**
`TENANT_RESOLUTION_REBUILD_SPEC.md`'s PRE-D7 record block records its own rot **and writes the
CORRECTIONS as line numbers** — *"`admin/index.js:66-67` is now `:103-106`; `auth.js:11-32` is now
`:45-70`. Verified 2026-08-27 at `8884a97`."* Both corrected targets are hot files. **The
correction is now itself a citation that nobody is allowed to touch, into code that has moved
underneath it.** Protecting that block preserves an answer that is already going wrong, and the
protection is what stops anyone noticing.

⚠ **SO THE CLASS NEEDS ROLE-BASED CORRECTIONS, NOT PROTECTION.** When you record that a citation
rotted, quote the wrong number — that is the evidence — and give the correction **by role**: the
function, the handler, the constraint. *"`auth.js:11-32` — now `verifyAdminSession()`"* is a
record that stays true. *"now `:45-70`"* is a second citation with the same lifespan as the first.
<!-- /citecheck:record -->
*(The two paragraphs above are inside a record marker, and that is not decoration: they QUOTE
rotted citations as evidence. Without it this file's own rule would count them as violations of
itself — which is how the mechanism gets switched off within a month.)*

⚠ **AND DO NOT FIX THE EXAMPLE ABOVE AS PART OF WRITING THIS DOWN.** Repairing the worked example
inside the entry that describes it is the shape this project keeps getting wrong — the correcting
commit falsifying the thing it corrects. It is filed on `PRE_LAUNCH_CHECKLIST.md` as its own job.

**Machine-readable since 2026-08-31:** a record block is marked with
`<!-- citecheck:record -->` … `<!-- /citecheck:record -->`, and `npm run citecheck -- --role-only`
excludes what is inside one. ⚠ **The marker says "this is a record." It does NOT say "this is
correct."** A record's citations are exempt from repair and are not exempt from being wrong.

**And the cheapest mitigation is WHERE you insert, which costs nothing to get right.**
Append new `server/db.js` migrations near the **END** of the file. The highest citation
anywhere into `db.js` is around `:1672`, so a block landing below that moves nothing anyone
points at. Measured in Wave 1.1-f: its block landed at roughly `:1963` and `--changed-files`
reported **54 TARGET TOUCHED and only 1 LIKELY ROTTED**. The same block inserted mid-file
would have rotted dozens.
⚠ **This is a convention, not a licence to move a block that must sit elsewhere.** 1.1-f's
placement was forced by a *correctness* constraint — the three tables are `CREATE`d above
`team_members`, so an inline `REFERENCES` would kill a fresh-database boot — and the citation
benefit was a side effect. **Correctness first, then this.**

⚠ **AND DO NOT READ A CHANGE IN THE ROTTED COUNT AS PROGRESS — IT MOVES WHEN THE MEASURED SET
MOVES, NOT ONLY WHEN THE CODE DOES.** Measured in C/DL-3c Phase 2a: trimming twelve lines out
of a comment block in `server/routes/admin/team.js` cut that file's delta from `+31` to `+19`,
and the run's total went **UP, from 87 to 88.** Nothing regressed. Editing two more documents
in the same commit made *those* files changed files, so citations pointing INTO them began
counting. **`--changed-files` reports citations into the files you touched, so touching more
files raises it independently of anything you fixed.** Compare like with like, or do not
compare: a figure taken mid-session is about a different set from the one taken at the end, and
the mid-session number in that phase was stale by the time it was committed.

⚠ **AND SOME CITATIONS MUST NOT BE SHIFTED AT ALL.** `docs/GROUND_TRUTH_2026-08-21.md` is a
**dated snapshot that quotes verbatim what it cites**. Its line numbers are part of a record
of a past state, not pointers into today's file; renumbering them would make the document
claim its quotes come from lines that now hold something else. Same distinction as the
RED-narrative rule below — **a record is not a claim about today.** Its six flagged citations
are a *different job* from the five in `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` and must not be
swept together.

### An insertion can break a markdown TABLE, and the diff looks correct

**Third member of this section, and the same shape as the two above: an edit that produces no
error and changes what the document says.**

C/DL-3c Phase 1 inserted an explanatory blockquote into `DECISION_C_DL_BUILD_SPEC.md` §10 and it
landed **between the table's header separator and its first body row**. The file parsed. The diff
showed exactly the intended text. **The table would have stopped rendering as a table** — taking
the Session column with it, which was the entire point of the amendment that inserted it.

⚠ **A DIFF CANNOT SHOW THIS.** A diff shows added and removed lines; it cannot show a document's
relationship to its own structure changing. **It was found by re-reading the rendered section, not
by reviewing the change.** Same reason the comment-block rule above exists: the edit is locally
correct and globally wrong.

**`npm run tablecheck`** — `scripts/tablecheck.js`, added for this. It walks the tracked `.md` list
(never a hand-maintained one) and reports a separator row not followed by a body row.
**Run it after any edit that inserts into or near a markdown table**, alongside `npm run citecheck`.
⚠ **It PRINTS and always exits 0**, exactly like `citecheck`, and for the same reason recorded in
that script's header — **it is not in `npm test` and must not be added to it.**

---

## Test Design — learnings that cost production bugs to acquire

*Read before writing a test, not after it goes green. Every rule below was learned by shipping
something a green suite did not catch.*

### CANCELLED and SKIPPED are FAILURES until explained — read all four numbers

**A test run reports `pass`, `fail`, `cancelled` and `skipped`. Reading two of them is how a
suite that did not run reads as a suite that passed.**

Wave 1.1-b's first RED run reported **3 pass / 2 fail / 2 CANCELLED**. The two failures were
the expected ones, the summary line looked entirely plausible, and **the entire transaction
suite had not executed.** Cause: two `describe`s in one file each called `initTestDb()` in
`before()` and `pool.end()` in `after()` — and `initTestDb()` returns the **`server/db.js` pool
SINGLETON**, so the first suite's teardown killed the pool the second was about to use. It
surfaced as `Cannot use a pool after calling end on the pool`, thrown from inside `initDB()`,
**during setup** — which is why the tests were cancelled rather than failed.

⚠ **A CANCELLED SUITE REPORTS NEITHER PASS NOR FAIL.** It contributes nothing to either
column, so a green-looking `fail 0` can sit directly above tests that never ran. `skipped` has
the same property. **Neither number is ever acceptable unexplained — treat both as failures
until you can say why.**

⚠ **AND THE SECOND TELL IS A WHOLE-FILE SHAPE, NOT A TEST RESULT: A MODULE-LOAD FAILURE.**
When a test file throws while being *imported* — a bad `require`, a syntax error, a missing
export — nothing inside it ever registers, so the run reports **`suites 0`** (or `pass 0` /
`fail 0` with every test in the file marked failed at once). **The distinguishing feature is
that the numbers move in FILE-sized jumps rather than by ones.** A non-zero test count sitting
beside `suites 0` is the signature, and it is easy to read as "the runner did something" when
the runner did nothing at all. **Read `suites` alongside `tests` on every run**, not only when
something looks wrong — the point is that nothing does.

**Practically: one pool per test FILE.** A file-level `before`/`after` pair, never one per
`describe`. And when a count moves, check all four before concluding anything.

*Sixth recorded instance of a mechanism producing output that resembles a result.*

### A test's own greenness is not evidence that it tests anything

**TEN shapes are recorded below.** Six were found in C/DL-3b, a seventh in the Admin Brand
Retirement build, an eighth in its 6B pass, a ninth in Wave 1.1-g, and a tenth predicted in
C/DL-3c Phase 0 before it could ship. **None of the nine that shipped was findable by reading;
every one was found by forcing the failure.**

⚠ **THIS INTRO SAID "SIX … A SEVENTH … AN EIGHTH" ABOVE A LIST OF NINE UNTIL 2026-08-30.** Shape 9
was appended without it, and shape 10 would have left it two behind. **The count lives in the list,
not in this sentence — recount by reading when you add one.** Same failure this file records for
its own test-count tripwire and for `PRE_LAUNCH_CHECKLIST.md`'s *"FIVE items"* above a list of six:
**a hand-maintained number in prose nobody edits when the thing it counts grows.**

1. **A case row proves nothing until the field exists.** Five rows added to the branding drift
   guard passed vacuously — that guard compares two copies, so a field absent from **both** is
   invisible to it. Rows are scaffolding; **injection is the mechanism.**
2. **An assertion against a state that cannot display the value proves nothing.**
   `BookingFormModal` renders branding only on its success screen, so a test of the idle form
   would have passed whatever the wiring said.
3. **A slice keyed on shared text checks the wrong thing.** `indexOf('You are an expert…')`
   matched the first of **two** prompts while the test claimed to check the second.
4. **An import-based check for a deleted export cannot fail** — under Vite a missing named
   import yields `undefined` rather than throwing. Read the source text instead.
5. **A test asserting a component's DEFAULTED fields cannot see a bug in its NON-DEFAULTED
   one.** This one reached production: the review card asserted `reviewMessage` and
   `reviewButtonText` (both defaulted, both always render) while `reviewUrl` was null and the
   button linked to a stringified `null`.
   **⚠ WHEN A VALUE MAY LEGITIMATELY BE ABSENT, THE ABSENT CASE IS THE PRIMARY TEST.**
6. **A sweep proves a string is ABSENT. It proves NOTHING about whether the code still runs.**
   `AnnouncementPopup` threw a `ReferenceError` on every render while its literal sweep passed
   — the sweep was correct, the component simply no longer ran. **Any file a sweep touches
   needs at least one render test, however trivial.**

7. **`toContain` on a bare VALUE cannot see a defect in the CONTEXT around it.** A seventh
   shape, found after 3b: the admin announcement preview was covered by
   `expect(preview.textContent).toContain('$500')`, and it went green for months against a
   preview that actually rendered **`$$500`** — because `"$$500"` contains `"$500"`. Both
   preset templates wrote a literal `$` in front of `[Amount]` while the resolver's
   substitution already supplied one. It shipped referrer-facing in `c5c0617` (2026-03-29)
   and survived four extractions and a consolidation.
   **⚠ ANCHOR ON THE SURROUNDING PHRASE, NOT THE VALUE** — `'cashout request of $500 for
   referring'`, never `'$500'`. The trap is that the value is the obvious thing to assert
   *because it is the thing being substituted*, which puts the assertion's edge exactly where
   a formatting bug lives. A `toContain` on a bare value is only ever evidence that the value
   appears **somewhere, in some context**, and the context is usually where the bug is. The
   same applies to any wrapped value: a currency symbol, a unit, a prefix, a delimiter.

8. **A FIXTURE NOTHING CONSUMES IS COVERAGE THAT IS NOT THERE.** An eighth shape, found in
   ABR 6B: three suites shared a shaped stats payload, and after extracting it to one module
   a green run proved nothing about sharing — **a file still holding a private copy stays
   green.** ⚠ **Probe A is the proof: throw at the fixture's module top and count which suites
   die.** Three failed; 28 were untouched. ⚠ **And Probe B — a throwing getter per export —
   found the real defect: two of the three suites never read a single field.** They mount the
   dashboard, but the fetch never reaches a render before the assertion resolves. Their
   protection was **timing, not the fixture**, and they would pass identically against `{}`.
   **Ask "what dies if this is removed", not "is it green with this present."**

9. **A FIXTURE THAT ESTABLISHES A PRECONDITION'S PROXY RATHER THAN THE PRECONDITION.** A ninth
   shape, found in Wave 1.1-g when the defect it claimed to cover reached production.
   `resetSurfaceRoleBlind.test.jsx` was named *"the admin surface never intercepts"*, set
   `ADMIN_TOKEN_KEY` in localStorage, and asserted the reset screen rendered. It passed — and
   its `installFetch()` answered **401 on `/api/session` unconditionally**, so `session` stayed
   `null`, `surfaceFor(null)` was `'login'`, and the admin branch it named was never reached.
   **The file drove the no-session path three times under three different names.** Four days
   later a team member clicked a reset link while logged in and landed in the admin panel.
   **A stored token is not a session.** The token is an INPUT to boot rehydration; the SESSION
   is what the branch reads. Setting the correlate looks exactly like setting the condition.
   ⚠ **THIS IS WORSE THAN NO TEST, AND THAT IS THE PART TO INTERNALISE.** The NAME occupied the
   space where real coverage would have gone — the next reader sees the title in the file list
   and stops looking. An absent test at least leaves a hole someone can find.
   ⚠ **THE FIX IS STRUCTURAL, NOT MORE CARE.** Assert the precondition **inside** the test, by
   observing its CONSEQUENCE rather than its setup: the repaired file pairs each
   admin-session case with a sibling on the same fixture and **no** `?reset=`, which must
   render the panel. That sibling is the proof the session is admin-surface, and it fails
   loudly if the fixture ever stops producing one.

10. **A DEFAULT THAT MAKES THE NEGATIVE CASE INDISTINGUISHABLE FROM THE BROKEN CASE.** A tenth
    shape, and **the first recorded BEFORE it could ship** — predicted in C/DL-3c Phase 0 against
    the rep app's revenue gate, which is not built yet.
    `AdminPermissionsContext` is created **with a default value** (`src/hooks/useAdminPermissions.js`),
    and all eight of its consumers live in `src/components/admin/`. **The rep surface renders
    outside `AdminApp` entirely.** So a rep component calling `usePermissions()` outside the
    provider does not throw — it receives the default, where `rep_revenue_visibility` is
    `undefined` → falsy → **revenue hidden.** A test that mounts that component with the flag off
    and asserts *"revenue is not rendered"* **passes identically against completely unwired code.**
    ⚠ **THE BEHAVIOUR FAILS SAFE, WHICH IS EXACTLY WHY NOBODY LOOKS.** The gate is closed either
    way; only the REASON differs, and the reason is the entire property under test.
    ⚠ **DISTINCT FROM #5 AND #9, AND THE DISTINCTION IS WORTH KEEPING.** #5 is *"the default hid a
    bug in the sibling nobody asserted"*; this is *"the default hid the absence of the wiring"* —
    same family, inverted. #9's fixture set a **correlate** of the precondition; this sets nothing
    at all and still goes green. **And unlike #1, #4 and #8, the assertion here CAN fail** — it
    simply cannot tell two states apart. **That is a different defect from an unfalsifiable
    assertion and must not be filed with them.**
    **THE RULE: when a context carries a default, every flag-OFF test must be paired with a flag-ON
    sibling on the SAME MOUNT.** The flag-ON case is the proof that the provider is present and the
    value reaches the component; without it, flag-OFF proves nothing about wiring. Structurally
    the same repair as #9 — **observe the CONSEQUENCE, not the setup.**
    ⚠ **AND PREFER DELETING THE DEFAULT WHERE THE CONSUMER CANNOT LEGITIMATELY RENDER WITHOUT A
    PROVIDER.** `useAdminBranding()` throws rather than defaulting, deliberately (D-H), and that
    throw is exercised on every referrer boot instead of only in a test. **A default is a claim
    that its absence is acceptable — fix by routing, not by asserting harder.**

**The conclusion:** non-vacuity assertions belong in tests that look **too simple to need
them** — grep-a-file, render-and-check, slice-a-string — because that is exactly where this
keeps happening.

### A safety measure copied from a prior phase must be RE-DERIVED, not inherited

**A guard is correct against a code path, not in the abstract. Carried forward unchecked, it
can permit the exact thing it was written to prevent.**

Wave 1.1-c pinned `STRIPE_SECRET_KEY` to a dummy so its tests could get PAST
`executeStripeTransfer()`'s first statement, which aborts on a missing key. Wave 1.1-d inherited
that instruction — and it was **exactly wrong there**. Those four routes call
`getStripeClient()` only AFTER the auth check, and it throws on a falsy key, so **emptying** the
key makes constructing a client structurally impossible while **pinning a dummy would have let
one route dial `api.stripe.com` for real.** Same instruction, opposite effect, one phase apart.

⚠ **THE TELL IS THAT THE MEASURE IS DESCRIBED BY ITS MECHANISM, NOT ITS PROPERTY.** "Pin the key
to a dummy" is a mechanism; "no test may reach Stripe" is the property. **Re-derive the
mechanism from the property against the new path every time** — and state which one you are
relying on, so the next phase inherits the property.

*(Same root cause as the `permissions.js` path: true in one context, carried forward unchecked,
wrong in the next.)*

### Sweep from the shared UTILITY outward, not from the entry point inward

**A sweep scoped to a directory, a route file, or a call chain traced downward will miss the
caller that sits outside it — and nothing announces the omission.**

**Twice in Wave 1.1 alone:**
- Decision A Phase 4A/4B enumerated gated routes and **missed `server/routes/stripe.js`
  entirely**, because it sat outside `server/routes/admin/` while serving five
  `/api/admin/stripe/*` routes.
- Wave 1.1-c Phase 0 was asked to trace the chain *route → Stripe*, did so correctly, and
  **missed the other caller of `executeStripeTransfer()`** — `POST /api/cashout`'s auto-fire
  path in `server/routes/referrer.js`, which moves money with **no admin review** under
  `payout_automation='full_auto'` and drew on the same hardcoded literal. It was found only
  because changing the function's signature forced an enumeration of its callers.

⚠ **THE DOWNWARD FRAME IS THE TRAP, AND IT IS THE NATURAL ONE.** "What does this route call?"
terminates at the leaf and feels complete. **"Who calls this?" is the question that finds the
second caller**, and it is the only one of the two that can.

**Practically: when a fix touches a shared utility, `grep` its export name repo-wide BEFORE
deciding the blast radius** — not the directory it lives in, not the route that led you to it.
This is the same rule as *"When a fix makes new DATA possible, enumerate every consumer"*,
applied to code paths rather than to states.

### A plausible-looking rejection is not the rejection you are testing for

**This is the negative test's counterpart to "green by construction."** A positive test can
pass without asserting anything; a NEGATIVE test can pass because the request was refused for
a reason that has nothing to do with what it claims to prove. It reads identically either way
— refused is refused — and the assertion never has to be wrong to be worthless.

**Three instances in one afternoon, building the Wave 1.1-c harness:**
- A cross-tenant `DELETE` was refused because `cashout_requests.user_id` is `ON DELETE
  NO ACTION` and the victim held a cashout. The route 500'd, the row survived, **the tenancy
  test passed** — and there was no tenancy check in the code at all. Caught only because the
  positive control beside it also broke.
- The **ghost contractor id** made every call to the ACH endpoint return `400
  no_stripe_account` regardless of caller, so "a cross-tenant request is rejected" passed
  vacuously against a route that performed no tenancy check whatsoever. **A defect masked a
  defect.**
- A source-text needle of `contractor_id` would have matched the `contractorId` already in
  the handler for an unrelated reason — the `toContain`-on-a-bare-value trap wearing a
  third costume.

**THE RULE: a negative test must assert WHY the request was refused, not only THAT it was.**
Pin the status code AND the state that proves the intended mechanism fired — the row still
exists, the hash did not change, the error is *this* error and not that one. And when a
negative goes green, **ask what else could have produced that same green.**

⚠ **THE POSITIVE CONTROL IS WHAT CATCHES THIS, WHICH IS WHY IT IS ORDERED FIRST.** Two of the
three above were invisible in the negative and obvious in the positive.

### A RED narrative is a record, not a claim about today

A comment written to explain why a test was RED describes **the state it was written
against**. Its referent is unambiguous, the fix sits in the same file with the passing
assertions as proof, and it causes nobody to act wrongly. **Leave it. Mark it if you must.**

**Correct a stale record when it claims something about a CURRENT surface — and especially
when it INSTRUCTS AGAINST the fix.** ABR 6B step 4 found eleven records asserting the admin
panel is dark after Phase 5 had repainted it. **Three had not gone stale, they had INVERTED**:
they told the next session not to make the change that was correct. Four separate records
defended a lock icon shipping at 1.67:1.

⚠ **The distinction is not age, it is what a reader would DO.** "Out of date" invites a reader
to discount the sentence and keep the conclusion, which is the wrong one. Say **inverted**,
and say what is true now.

### A negative assertion is a fence, and a fence can end up guarding the defect

`expect(x).not.toBe(y)` pins the ABSENCE of a value. When the correct value turns out to be
`y`, the assertion does not go stale — **its PURPOSE reverses.** It is still true, still
green, and now the thing standing between the codebase and the fix.

ABR 6B: `LockedSection.test.jsx` asserted the lock icon was NOT `statusVar('warningText')`.
That was the fence around a 1.67:1 defect, and it had to be **deleted with its reason
recorded**, not updated with a new value. **Prefer asserting what a site DOES say.** When a
negative assertion is genuinely the only way to see a mechanism, say so in the comment —
otherwise the next reader deletes it as redundant, which is the regression it exists to catch.

⚠ **AND THERE IS A SECOND, SHARPER SHAPE: A NEGATIVE ASSERTION WHOSE NEEDLE IS A LITERAL OWNED
BY A DIFFERENT FILE. IT GOES VACUOUS SILENTLY, AND NEITHER FILE SHOWS THE COUPLING.**

The rule above is about a value inside one file, where a reader can at least see both halves.
This is worse. `src/components/admin/AdminTeamSettings.test.jsx` asserted
`queryByText(/no longer writable here/)` is null, against a fixture mirroring the wording of a
**server** 422. C/DL-3c Phase 2a reworded that server message to *"is not writable here"* — and
the assertion became **true forever, watching nothing.** Nothing failed. Nothing could: a
needle that can never match makes a negative assertion permanently satisfied.

⚠ **IT WAS CAUGHT ONLY BY GREPPING THE OLD STRING BEFORE COMMITTING**, which is not a mechanism.
`citecheck` cannot see it — there is no citation, only a sentence that two files happen to
share. **Before rewording ANY user-visible or API-visible string, grep the old wording
repo-wide.** And prefer anchoring such assertions on something structural — a status code, an
absent element, a data attribute — over a sentence someone will reasonably improve later.
**Where a test must mirror a server string, say so at BOTH sites and name the other one by
role**, so the pair is discoverable from either end.

### When a fix makes new DATA possible, enumerate every consumer before calling it contained

A change that alters **which rows** a query returns is usually contained. A change that makes a
**state occur for the first time** is not — it activates every code path that was dormant only
because the data never arrived. Those paths have never run, so nothing has ever tested them, and
they fail in ways their authors never considered, because the state they now receive did not
exist when they were written.

**Four instances across Waves 0.2 and 0.4, all found only by looking:**

- `admin/contacts.js:891`'s `is_archived = false` predicate was vacuously true for years. Making
  the column truthful would have activated it — gradually, in one surface only, as a side effect
  of an ingestion fix.
- `fetchReferrerContact` was never exported; `admin/index.js` had destructured and called it
  since it was written, raising a `TypeError` caught as a generic 500. **Unreachable because the
  matcher wrote `[]` on every call, so the button never rendered.** Writing real candidates
  activated it.
- **T4b was RE-POINTED, not broken**, by a change in a different file — the caller relationship
  it drove through no longer existed.
- The Pending Referrals send buttons keyed off `(referred_by_email || referred_by_phone)`, which
  **meant** "was invited", because the same branch wrote contact and fired the invite together.
  Wave 0.4 decoupled them. **The condition never changed; its meaning did.** Result: a live gate
  bypass on the first matched-but-not-invited row in production history.

**The check is mechanical.** Before shipping a fix that creates a new state, grep every reader of
the columns or conditions involved and ask of each: **what did this condition mean before, and
does it still mean that?** ⚠ **A condition whose meaning changed without its text changing is
invisible to every diff, every test, and every review.**

⚠ **Wave 0.3 bounds the rule.** Twelve tenant-scoping fixes changed which rows a query returned
and activated nothing, because **no new state became possible**. The rule is about new STATES,
not new RESULTS.

### A rule applied once to a surface does not stay applied when the surface moves

⚠ **THE RULE DID NOT FAIL. IT WAS NEVER RE-APPLIED.** `LockedSection`'s lock glyph declared
the DARK status value as its `var()` fallback, and that was **correct** — the admin panel was
dark, nothing mounts `--rm-*` on the admin tree, so the fallback is what paints. ABR Phase 5
repainted the panel white. **Nobody re-ran the choice**, and the icon shipped at 1.67:1 —
under the 3:1 graphic floor — for five sub-phases, defended by four separate comments.

**When you change a surface, enumerate what was DECIDED against it and re-derive each one.**
A repaint is not a cosmetic change; it is a change of premise, and every conclusion drawn from
that premise is now unverified. The decisions look untouched in the diff, which is exactly the
problem: **nothing about a still-correct-looking line announces that its reason is gone.**

⚠ **THIS IS NOT THE RED-NARRATIVE RULE ABOVE, AND THE LOCK ICON IS WHY THEY KEEP BEING
MERGED.** They share an example and not a subject. **The RED-narrative rule governs RECORDS —
is this comment stale?** **This one governs DECISIONS — is this choice still correct?** A
codebase can have perfectly current comments describing a choice nobody re-checked. Keep them
separate.

⚠ **AND FIX BY ROUTING, NOT BY REPLACING THE VALUE.** The repair was
`color: statusVar('warningText')`, not a corrected hex. A hardcoded right answer produces
identical pixels, keeps the special case, and goes wrong again the next time the table moves.
**Deleting the special case makes the right value fall out — and keep falling out.**

### Sweeps have two independent gaps

- **Formatting, not values.** `770-277-4869` and `7702774869` are the same number and do not
  match. **Normalise before comparing** — strip non-digits for phones; strip scheme, `www.`
  and trailing slash for URLs. A `tel:` href dialled the wrong company through a sweep that
  reported clean.
- **The hand-maintained FILES list — NOT FIXED.** Every sweep iterates a list someone typed.
  New files are invisible until remembered, and **nothing announces the omission**. A clean
  sweep is evidence about the listed files only. Prefer walking a directory tree.

### A guard that fires on the prose beside it is working. Reword the prose.

ABR 6B step 4's own commit tripped the brand sweep: a `#012854` needle inside a **comment**
explaining why the value was retired. **The comment was rewritten; the sweep was not
exempted** — and step 5 made the same call for a symbol name.

⚠ **A symbol or literal in prose is how a retired thing gets pasted back into code.** Never
add a comments-are-exempt carve-out to a sweep. It is the cheapest-looking fix and it removes
the sweep's reach into exactly the text a future reader will copy from.

### Sweep by value and you will miss the claim

A sweep answers *"does this STRING survive?"* It cannot answer *"does this file still assert
something false?"* — the eleven inverted records that survived ABR Phase 5 contained no
retired literal at all. **Where a claim matters, the guard reads the source TEXT and asserts
on the sentence**, not on a value inside it.

### Retirements need a producer sweep, not only a consumer assertion

Proving a value is ignored is **not** proving nothing depended on it. Grep the **producers**
repo-wide — server routes, email templates, redirects — and enumerate **consumers** repo-wide
too, remembering that a consumer need not sit on the obvious path: any component can read
`window.location` directly.

### Two rules about defaults, and a third about the absence a default hides

- **Canonical-default rule.** When a default exists in two places, **the one that reaches
  production users is canonical**; the other is a copy that drifted.
- ⚠ **A DEFAULT VALUE MAKES A MISSING PROVIDER INDISTINGUISHABLE FROM A CORRECT ONE.** Added
  Wave 1.1-g. A `createContext(defaultValue)` does not throw when a consumer renders outside
  its provider — it silently hands over the default, and **every test stays green**.
  Moving `ResetPinScreen` above `ThemeProvider` (the correct fix for a routing defect) would
  have rendered `NEUTRAL_BRANDING` and the platform logo **to a contractor's team member on a
  white-label surface**, with nothing failing anywhere. It carries its own provider instance
  instead.
  **Same class as two defects already recorded here:** `getStripeRow()`'s
  `|| { … not_connected }`, where zero rows produced a manufactured "not connected" that read
  exactly like a real one; and the lock icon's `var()` fallback, which painted correctly right
  up until the surface it assumed was repainted. **A fallback is a claim that its absence is
  acceptable — check that the claim is still true wherever you move the consumer.**
  Practically: when relocating a component in a routing chain, ask **which providers it was
  inside** before the move, not only which branches ran before it.
- **Identity-bearing values get no defaults.** A logo, a review link, a phone number —
  anything that says **who** the contractor is — resolves to `null` when unset, and the
  consumer decides whether to draw the element. Borrowing another contractor's value is a
  white-label breach; fabricating one sends a homeowner somewhere that does not exist. Generic
  copy is the opposite case and may be defaulted freely. **The line is: does the value say
  WHO, or does it say WHAT.**

### A literal can bias generated text without ever appearing in output

An AI prompt whose worked **example** names a real tenant is **instructing** the model toward
it. No sweep of generated copy can catch it. Assert on the **shipped prompt template**.

### Classifying whether a value is "wired up" has five states, not three

Storage, an editor and a validator are three conditions — **delivery is the fourth**, and
**derivability is the fifth**. Both are invisible to a check built from the schema and the
admin panel, because both look complete. Ask: *"does anything carry this to the surface that
needs it?"* and *"can this be constructed from something already stored?"* — and ask the second
about the fields that look **empty**, not the ones that look finished.
→ `CDL_3b_BUILD_SPEC.md` §8.0 categories (d) and (e).

### A mechanism that reports health it cannot observe is worse than no mechanism

Test Design's vacuity shapes cover tests. This is broader: ANY mechanism that reports a state
it has no way of actually observing. It reads as a passing check, so nobody looks again.

Four confirmed instances:
- `docs/ARCHITECTURE.md`'s own folder-structure check was mis-pointed at a file that no longer
  held the structure. It would have caught 24 missing files. Anyone who ran it found nothing
  and could not distinguish "not applicable" from "not done."
- Two test suites mocked a shaped stats payload no assertion ever read. They pass identically
  against `{}`.
- CLAUDE.md's own test-count tripwire was set ~213 below the true floor, so it could never fire.
- Four "standing untracked files" were named across four consecutive handoffs; two were tracked
  the whole time.

**THE RULE: when you add a check, a guard, a sweep, or a tripwire, state what it would look
like when it FAILS, and prove it fails that way before trusting that it passes. A check whose
failure mode has never been observed is a claim, not a check.**

**The closure half.** Every one of the four instances above is a mechanism that could record a
state ARRIVING and could not record it LEAVING. That asymmetry has its own name and its own fix.

R14 requires deferrals to reach `PRE_LAUNCH_CHECKLIST.md` before a handoff is written. It works.
But nothing requires an entry to be CLOSED when the work lands — so the Admin Brand Retirement
entry read *"IN PROGRESS — Phase 1 shipped"* for roughly thirty commits after Phase 6B closed
the arc, **in the document R14 exists to protect, during the arc that authored R14.**

Same shape one layer down: `error_log.resolved` exists as a column and has never been set on any
row, so the log cannot distinguish "fixed" from "stopped happening" and dates do all the work.

**THE RULE: a tracking mechanism needs both halves. When you add an entry, a row, or a flag, say
what will REMOVE it and who does that. A list that can only grow stops being a list of open work
and becomes a list of things that were once true.**

Practically: closing an arc means closing its checklist entry in the same session, before the
handoff. **Deferring is R14; completing is this.**

---

### Guards agreeing is not evidence when they share an input

**Five independent guards reported PASS on a parse that had silently reclassified all 104
annotations as orphans — because all five read the same broken parse.** Arrow audit saw the
arrows and called them recognised. Conservation saw `in == out`. The baseline saw the
expected count. Each was correct about what it measured, and all of them were measuring a
corpse. **When guards agree, confirm they have INDEPENDENT INPUTS before treating agreement
as verification.** Agreement among guards fed by one parse is one guard wearing five hats.

**The mechanism, because it produces no error and is invisible in review.** JavaScript's `.`
does not match `\r`, so a `$`-anchored regex silently no-ops on a CRLF line — the match
simply fails and the code carries on with unstripped text. With `core.autocrlf=true` (the
Windows default) **a tracked LF file becomes CRLF in the working tree the moment anyone runs
`git checkout`**, so this is not an exotic input. **Any tool reading a tracked file must
split on `/\r?\n/`, and must never normalise endings as a side effect** — rewriting someone
else's line endings turns a two-line diff into a whole-file one.

⚠ **The guard that caught it was the one with a different input**: a path-sanity check
asserting that a parsed path cannot contain an annotation delimiter, a tree connector, or a
CR. It read the parse OUTPUT against an independent invariant rather than re-reading the
parse. That is what independence means here.

### A shell harness lies plausibly, and never with an error

⚠ **AND IT IS NOT ALWAYS A SHELL. `npm ls <pkg>` PRINTS A VERSION THAT IS NOT THE INSTALLED
ONE.** Measured 2026-08-31 in C/DL-3c Phase 2a, chasing a HIGH `npm audit` finding:
`npm ls nanoid` printed **`nanoid@3.3.18`** — the FIXED version — while `package-lock.json`
and `node_modules/nanoid/package.json` both held **`3.3.17`**, which is the vulnerable one.
The advisory reads `<3.3.18`. **Trusting that output would have closed a live HIGH as already
fixed.** `npm ls` prints the tree it resolves, which is not a statement about what is on disk.
**Read `package-lock.json` and the installed package's own `package.json`. Never `npm ls`.**
Same family as everything below — a plausible wrong answer, no error, no way to tell by looking.

**Tools in this project have silently returned a wrong answer through a shell, and not one of
them raised anything.** They are not related by tool; they are related by *shape* — something
belonging to a layer nobody was thinking about: a metacharacter, or the size of the window the
answer was read through.

- **`grep -c $'\r'` returned full line counts on LF-only files.**
- **`\d` in a shell-quoted pattern reached Node as `d`** — it matched the letter, not a digit.
  (Same family as the `'\s+'`-in-Postgres defect in `.claude/rules/backend.md`.)
- ⚠ **ANY GIT REV-SPEC CONTAINING `^` IS UNSAFE IN A NODE-SHELLED COMMAND ON WINDOWS. USE
  `~1`.** `execSync` spawns **cmd.exe**, where `^` is the **escape character**, so
  `git diff <sha>^ <sha>` reaches git as `git diff <sha> <sha>` — a *valid* command that
  returns nothing. Measured in Wave 1.1-d2: it reported **"0 changed file(s)" against a
  five-file commit** and was indistinguishable from a clean run. `~1` means the same thing to
  git and nothing at all to cmd.exe.
- ⚠ **NEVER `tail` A CHECK WHOSE TOTALS PRINT LAST. READ THE FINDINGS SECTION IN FULL, OR
  READ NOTHING AND SAY SO.** Measured in C/DL-3c Phase 1a: `npm run citecheck -- --changed-files`
  piped through `tail -25` put the TOTALS line **inside** the window and the four
  `LIKELY ROTTED` findings **outside** it. The output read as a clean run and was reported as
  *"zero LIKELY ROTTED"* before a second look found them.
  ⚠ **THIS IS NOT A QUOTING BUG — IT IS THE HEALTH-REPORTING CLASS ARRIVING THROUGH TERMINAL
  PAGINATION.** A truncated read that happens to preserve the reassuring line reports health
  it never observed, which is the failure *A mechanism that reports health it cannot observe*
  is about. The mechanism here is `tail`.
  **The checks in this repo whose summary prints LAST, verified by running each:**
  `citecheck` · `tablecheck` · `sizing` · `architecture` (both the bare form and `--check`) ·
  `node --test` (the `tests/suites/pass/fail/cancelled/skipped/todo` block) · `vitest run`.
  ⚠ **`npm test` IS THE WORST OF THEM AND THE ONE MOST LIKELY TO BE TAILED, SO IT IS NAMED
  HERE AND NOT ONLY IN THE LIST ABOVE.** It chains three tools with `&&`, so the last summary
  in the stream is **Vitest's**. When the run is green, a `tail` shows the React numbers and
  **CANNOT SHOW THE SERVER NUMBERS AT ALL** — and the server suite is where the count tripwire
  lives, so the one number a tail can never reach is the one the tripwire was built to protect.
  ⚠ **A green `npm test` read through a tail is therefore evidence about the React suite and
  about nothing else.** Grep the `ℹ tests / suites / pass / fail / cancelled / skipped / todo`
  lines by name, every time.

**Every one produced a PLAUSIBLE WRONG ANSWER rather than an error**, which is why none was
caught by looking and why the rule cannot be "be careful with quoting."

**Practically: regex-bearing or escape-bearing code goes in a FILE, never a shell one-liner**
— and when a harness returns a number, **know the expected answer before you run it.** The
`^` case was caught only because a five-file commit was known to be five files.

⚠ **AND A SECOND SIDE EFFECT WORTH KNOWING BEFORE YOU RUN ONE: `npm run architecture` WRITES
TO A TRACKED FILE.** The bare form regenerates `docs/ARCHITECTURE.md`; `npm run architecture --
--check` is the read-only form and is the one the generated comment inside that file names.
Running the bare form to "see what it says" modifies the working tree. `citecheck`,
`tablecheck` and `--check` all print and exit 0, touching nothing.

### A number in a governing document needs a source

**A number with no source is a claim, not a measurement.** Three instances surfaced in one
day: the test-count tripwire set below its own floor, `docs/ARCHITECTURE.md`'s structure
check pointed at a file that no longer held the structure, and a size threshold that was
never a constant and was counted in a different unit than every figure compared against it.
**All three looked like working mechanisms.**

⚠ **A FOURTH, IN THE CANONICAL DOCUMENT, AND IT WAS NEVER CORRECT RATHER THAN GONE STALE.**
`PRE_LAUNCH_CHECKLIST.md`'s D13 entry said *"§13's 18 open decisions"*. It entered at `39a099f`,
and **at that very commit the table held 15 rows, all 15 live** — it was never a measurement of
anything. `EXECUTION_SEQUENCE.md` said 12 in three places and was right. **The previous doc pass
found the error, fixed all three correct copies, and never opened the canonical one** — then
recorded the finding in an untracked handoff. **Fixing the copies you are looking at is not
fixing the claim; ask which document is canonical BEFORE deciding you are done.**

⚠ **AND A NUMBER CAN BE RIGHT FOR THE WRONG REASON, WHICH IS THE HARDEST VARIANT TO SEE.**
Counting `MEMBER_RANK_ECONOMY_SPEC.md` §13's live decisions with `grep -c "| RANK-"` returns
**12**, which is the correct live count — but not because it counts live rows. Struck rows read
`| ~~RANK-` and **fail to match the literal**. The right answer and the wrong method coincide
**only while strikethrough remains the retirement notation**; retire a decision any other way and
the same command returns a confidently wrong number under a method that has "always worked."
**Verifying a count means knowing what the needle EXCLUDES, not comparing the output to your
expectation.**
⚠ **THIS BELONGS HERE AND NOT WITH THE VACUITY SHAPES, AND THE DISTINCTION IS WORTH KEEPING.**
Every vacuity shape is *"this assertion cannot fail."* **This is the opposite** — the assertion
could have failed, and the number came out right by a coincidence of notation. Filing it with the
vacuity shapes would blur a distinction that section spends its length maintaining.

---

### When the artifact under repair is a SET of citations, the unit of verification is the SET

**Sampling cannot find the ones that look right.**

⚠ **THIS IS NOT A VACUITY SHAPE, AND FILING IT WITH THEM WOULD BLUR A DISTINCTION THAT SECTION
SPENDS ITS LENGTH MAINTAINING.** Every vacuity shape is *"this assertion cannot fail."* Here every
one of these citations **could** have been checked and **would** have failed. It is a
**verification-coverage** rule, and it sits beside *"a number in a governing document needs a
source"* because both are about a claim nobody sourced.

**The measured case, C/DL-3c Phase 1.** A repair was instructed against **three** `activity_log`
citations in `CDL_3c_PHASE0_REPORT.md`. Grepping rather than trusting the count found **two**.
Extracting **all 133** citations in that file and reading each against its own citing sentence
found **three more**, each wrong by a different amount and by a different mechanism:

- `contacts.jobber_client_id` cited `:738` — off by one, onto `is_app_user`.
- `users.jobber_client_id` cited `:790` — **a different table entirely**; the number had been read
  out of the wrong half of a two-block `sed` whose output was taken as one.
- `rep_promotion`'s registry entry cited `:127-133` — ⚠ **it resolved to the ADJACENT
  `rep_assignment` block.**

⚠ **THE THIRD IS THE DANGEROUS SHAPE AND IT IS WHY THE RULE EXISTS. A CITATION THAT LANDS ON A
PLAUSIBLE SIBLING READS AS CORRECT TO ANYONE WHO FOLLOWS IT.** It survives `citecheck` — the target
resolves. It survives a sweep — the file exists. It survives a human spot-check — the content is
about the right subject, one entry away. **Only reading it against the sentence that cites it
catches it.** Same family as the substring rule directly below, one level up: there the *needle*
matched a sibling, here the *line number* does.

**THE RULE: when the artifact under repair is a SET of citations, the unit of verification is the
SET, not the flagged members.** Enumerate every citation in the artifact, resolve each, and read it
against its own sentence — then repair. **A spot-check of the suspicious ones would have found one
of five.**

⚠ **AND THE NEAR-MISS BENEATH IT IS ITS OWN INSTANCE: the repair note carried an UNSOURCED COUNT —
"three places" — inside a document whose subject is unsourced counts, in the same paragraph that
tells the reader to grep.**

**Four self-referential miscounts that can be cited by location. This is a FLOOR, not a total —**
the wider family is recorded in the section above, and the point of enumerating is that each one is
checkable rather than asserted:

1. `CDL_3c_PHASE05_RULINGS.md`'s repair note — *"three places"* against two.
2. `CLAUDE.md`'s own vacuity-section intro — *"six … a seventh … an eighth"* above a list of
   **nine**. Corrected in `97fd2e8`.
3. `PRE_LAUNCH_CHECKLIST.md`'s theme-engine pass — *"FIVE items"* above a list of **six**, and the
   number appeared **twice in one sentence**. Corrected in `97fd2e8`.
4. ⚠ **THIS FILE'S OWN *Editing mechanics* HEADING, AND IT IS THE WORST OF THE FOUR BECAUSE OF WHAT
   HAPPENED NEXT.** It read *"the two that produce no error"* over **three** subsections — wrong
   before this session touched it. The session that added a fourth subsection first "fixed" it to
   *"the three"*, **reproducing the identical error one number along, in the file that records the
   rule, while writing this very list.** The count is now gone from the heading entirely.

⚠ **THE LESSON IS NOT "COUNT MORE CAREFULLY." IT IS: DO NOT PUT A COUNT IN A HEADING OR A LEAD
SENTENCE AT ALL** when the thing it counts is a list directly beneath it. A count there has no
mechanism that updates it, and instance 4 shows that even a reader actively cataloguing this defect
will bump the number rather than delete it. **Name the section for what it contains, not how much.**

⚠ **Do not replace this enumeration with a running total.** A total is the thing that goes stale,
which is the failure the whole section is about.

⚠ **AND THE FAILURE HAS AN OPPOSITE THAT IS EASIER TO REACH ONCE THE LIST ABOVE IS LONG.**
C/DL-3c Phase 1b nearly added a sixth entry that was not one. `CDL_3c_PHASE05_RULINGS.md` says
*"the five `CLAUDE.md:502` citations **in `PRE_LAUNCH_CHECKLIST.md`**"*; a repo-wide grep
returns **seven**, and the write-up had already begun. The sentence is exactly right — that
file holds exactly five — and the needle counted every file while the claim scoped to one.

**THE SHAPE: after a run of confirmed miscounts, "the stated number is low" becomes the
expectation — and an expectation is precisely what this section exists to replace.** Verifying
a count means knowing what the needle excludes **AND what the claim excludes**. Read the whole
sentence before counting: a scope clause four words later changes the answer.

---

### A name-based search cannot find a name that is never written down

**Wave 1.1 ruled: count `exactly_one_subject` constraints BY NAME, never by number,**
because a `COUNT(*) = 3` check would have looked right. **That rule is correct and it finds
ONE OF FOUR.**

Measured in C/DL-3c Phase 1b. `grep "exactly_one_subject" server/db.js` returns
`user_preferences_exactly_one_subject` and nothing else that is a name. The other three —
`pin_reset_tokens_`, `verification_codes_`, `email_verifications_` — **exist nowhere in the
source as literals.** They are assembled at run time:

```js
const DUAL_SUBJECT_TABLES = ['pin_reset_tokens', 'verification_codes', 'email_verifications'];
const constraintName = `${tbl}_exactly_one_subject`;
```

⚠ **THIS IS NOT THE SUBSTRING TRAP BELOW, AND THE DIFFERENCE DECIDES WHAT TO DO.** There, the
needle matched **the wrong thing** and the fix is a better needle. Here the needle **cannot
exist**, and no amount of anchoring produces one. A grep over a loop that builds names finds
the loop or it finds nothing.

**THE RULE, amending Wave 1.1's rather than replacing it: count by name, and then read the
code that GENERATES names.** A constraint, a route, a permission key or a cron id assembled
from a template is invisible to every search for the thing it becomes. **When a count matters,
grep for the SUFFIX and the TEMPLATE too** — `_exactly_one_subject` finds the interpolation
site that `pin_reset_tokens_exactly_one_subject` never will.

### A needle that is a substring of a longer real name passes against the wrong line

Checking the canary annotation on `Screen.jsx` with the needle `Screen.jsx` matched
**`AdminSetPasswordScreen.jsx`** — a real file, a real annotation, and entirely the wrong
one. The check reported success against a line nobody was asking about. **Anchor a
verification on the full line, or on a token that cannot be a substring of a sibling**
(here, the tree connector: `/(├|└)── Screen\.jsx/`). This is the `toContain`-on-a-bare-value
trap in a different costume — the assertion's edge lands exactly where the ambiguity lives.

---

## Mockup precedence — FieldRepApp

`docs/mockups/fieldrepapp/` holds 72 PNGs from a Lovable mockup dated
2026-06-26: 18 screens × 4 brand/mode variants (RoofMiles and Accent, each
light and dark). These mockups are the original foundation the FieldRepApp
planning was built on. They are guidance and inspiration — reference
material, not a specification — and the distinction is load-bearing.

**Sequencing and scope — the plan wins, absolutely.** `EXECUTION_SEQUENCE.md`
and `DECISION_C_DL_BUILD_SPEC.md` decide which phase builds what. An element
appearing in a mockup says nothing about when it is built. The mockup set
includes Add Client and the network constellation, which belong to later
phases; their presence in a PNG is not a licence to build them early.

**Behaviour and rules — the dated rulings win.** Where a mockup contradicts
a ruling recorded in `DECISION_C_DL_BUILD_SPEC.md` or
`EXECUTION_SEQUENCE.md`, the ruling governs, regardless of which came
first. This includes at least: CD-4, superseding the mockup's splash-to-
login flow; CD-7, requiring the server to omit the revenue value rather
than the client to hide it; CD-8, voiding the mockup's example link
format; and D14, which vacated Wave 1.2's row and consolidated the rank
economy into a single arc after Wave 1.4 — the rank economy is DEFERRED,
not cancelled, and RANK-2, RANK-9 and RANK-17 remain live and move with
the arc. No rank renders in 3c.

**Layout and usability — the mockup is the strongest reference.** Screen
composition, element order, navigation structure, information hierarchy,
spacing relationships, the empty / loading / error treatment, and copy
strings are what the mockup was built to settle. Start from it, and treat it
as the default when nothing else speaks to a question.

**Palette STRUCTURE, not palette VALUES.** The four-variant set is a
deliberate proof that theming is token-driven rather than hardcoded per
brand, and that structure carries over — the five swatch roles (Primary,
Secondary, BG, Surface, Text) are intended to map onto the `--rm-*`
tokens. ⚠ That mapping is INCOMPLETE: amendment A20 records that the
shipped resolver emits a different set and that `surface` and `text` have
no token today. Two of the five roles have nothing to map onto, and the
gap is unresolved. Specific colours read off a PNG are approximations,
never authority.

**Brand assets in the mockup are PLACEHOLDERS.** Lovable did not have the
real contractor assets, so the Accent variants render a recoloured RoofMiles
chevron. No logo, mark, or icon in any non-RoofMiles variant represents
design intent, and none should be reproduced. White-label brand assets come
from the contractor's own asset set, never from a mockup PNG. Treat any
mockup element Lovable would have had to invent for want of a real asset the
same way.

**The mockup does not override judgment during the build.** It is inspiration
against which common-sense rulings get made as the interface is really
built. Where it shows something wrong, impractical, or since superseded, rule
against it and record the ruling. Deferring to a PNG over a considered
decision is the failure this section exists to prevent.

**A feature shown in a mockup that no spec claims is an open question, not a
dropped one.** Flag it and leave it unbuilt. Absence from the specs is at
least as likely to be an omission as a decision.

**No code from the Lovable project enters this repository** — see CD-18,
which is the resident ruling; this is a pointer to it, not a second copy.
The mockup's stated design target is React Native, but the prototype
Lovable generated around it is a web stack: TypeScript, TanStack Router,
shadcn and Tailwind. This repo uses none of those, and its router choice
is still deferred. Importing that code would settle a deferred
architectural decision as a side effect of copying a component. Read it
for reference; port nothing.

**Provenance is not fully reconciled.** `DECISION_C_DL_BUILD_SPEC.md`
records the FieldRepApp mockup as a 19-page PDF delivered 2026-07-24; what
is committed here is 72 PNGs across 18 screens, exported 2026-06-26 per the
Lovable Files panel's own timestamps. Whether these are one artifact at two
export dates or two versions is unresolved. The CD-* rulings postdate both,
so nothing inverts — but do not treat either date as a cutoff, and reconcile
this before citing the mockup as a dated authority.

---

## Session Safety Protocol — Run Before Any Code Changes

1. Read this entire CLAUDE.md file
2. If the session touches a feature in the registry, read CLAUDE_REGISTRY.md
3. Read every file that will be touched — in full, before touching it
4. For any function being modified, search the codebase for all call sites and list them
5. Produce a brief impact statement before proceeding

**After completing changes:**
1. Re-read every modified file in full
2. Confirm all imports resolve, no functions renamed/deleted, no logic altered outside target
3. Confirm all useEffect hooks with intentionally omitted deps still have eslint-disable comments
4. Confirm no .then() chains introduced, no console.log added to production paths
5. Run `npm audit` before pushing (per Dependency Management Standards) — resolve or explicitly acknowledge any HIGH/CRITICAL findings before proceeding
6. Stage by EXACT PATH ONLY — never `git add -A`, never `git add .`.
   List each file you intend to commit and stage them individually:
       git add path/to/file-one path/to/file-two
   Then run `git status --porcelain` and confirm the staged set is exactly what you listed
   before committing. Local-only files are protected by `.gitignore` patterns, not by anyone
   remembering a list — but the verification step is what makes that true, so run it every time.
   ⚠ Do NOT pass a pathspec to `git commit`. `git commit -- <path>` commits working-tree
   content for that path, bypassing the index, which can silently re-add a file you just
   removed with `git rm --cached`. Stage, verify, then commit bare.
7. Never commit a broken or partial state

⚠ **NEVER ADD OR EDIT REPOSITORY FILES THROUGH THE GITHUB WEB UI.** Write to the local
working tree and commit through the normal path.

The web UI writes to the remote without touching the local tree, so it bypasses everything
the local path enforces — commit trailers, hooks, ignore rules, and diff review. **Two
defects in the Wave 0.1 arc trace to a single web-UI commit.** `EXECUTION_SEQUENCE.md`
existed on the remote and not locally, collided with the untracked local copy, was deleted
in `580f404`, and the plan of record for the following ~50 sessions went untracked until
`99ab323`. And `fead367`/`580f404` are **the only two commits in the repository's history
missing the standard trailers** — which is how you can spot the others, if there are others.

---

## Never Break These Rules — Non-Negotiable Constraints

### Authentication & Session Security
- Every session token has a role column. Admin endpoints: `AND role='admin'`. Referrer endpoints: `AND role='referrer'`. Never remove these filters.
- `verifyAdminSession()`, `verifyReferrerSession()` and `verifyAnySession()` are the only authorized ways to protect endpoints. Never inline auth checks. (`verifyAnySession()` is the role-agnostic one, added in C/DL-3b Phase 4 for boot rehydration — it exists because a client holding a stored token does not yet know which surface the token belongs to.)
- Session tokens are 64-char hex from 32 random bytes. Never weaken.
- **Session lifetime: a 30-day sliding window with a 90-day absolute cap, one policy for all three roles** (referrer, admin/team, super_admin). `expires_at` is pushed forward on each successful verify, but never past `created_at + 90 days` — the cap is what stops a slide from producing an immortal token. Bumps are throttled to at most one write per session per hour. **The numbers live in exactly one place — `server/utils/sessionPolicy.js` — and `computeSessionSlide()` is the only thing that may write `expires_at`. Never inline a TTL literal at a mint site.**
  - **This replaced a flat 24-hour TTL, extended DELIBERATELY by C/DL-3b decision D7** — recorded here so a future session does not read a stale rule and "restore" it. **The rule itself is unchanged: never alter session lifetime without explicit instruction.** Only the numbers moved.
  - The security control that makes a long session safe is **step-up re-authentication on high-consequence actions**, not a short session. That is a PRE-LAUNCH item (see `CDL_3b_BUILD_SPEC.md` §10) and it is what D7's tradeoff was accepted against. A 30-day session without it is a 30-day key to the money paths.
  - `sessions.created_at` is the cap's anchor. **Never rewrite it on a slide** — doing so makes the 90-day ceiling unreachable and silently uncaps every session.
- Logout is server-side: `POST /api/logout` deletes the session row. Never reduce a logout to clearing client storage — that leaves the bearer token valid for its full remaining lifetime, which is the defect D6 was raised to fix.
- `ADMIN_PASSWORD` in Railway env vars only. Never hardcode.

### Database Integrity
- `UNIQUE(user_id, jobber_client_id)` on referral_conversions enforces one conversion per client ever. Never remove.
- `contractor_id` must be present on every DB write touching contractor-owned data.
- Never use `SELECT *` in production queries (exception: backup.js — documented).
- Never run destructive SQL without explicit instruction and confirmed backup.
- Always click Run Backup Now before any migration or DB-touching push.
- `pending_referrals` records never hard deleted — close-out sets `status='closed'`.
- `ADD CONSTRAINT ... UNIQUE` in a `DO $$` block must catch `WHEN duplicate_object OR duplicate_table` (re-run collides with its own backing index, raising 42P07). `CHECK` constraints only need `duplicate_object` (no backing index). Prefer the `pg_constraint` pre-check pattern (see `tokens_contractor_id_unique` in db.js) for new UNIQUE constraints.
- Every fail-closed migration guard (e.g. "exactly 1 `contractors` row") must be wrapped in a work-remaining check (`IF EXISTS (SELECT 1 FROM <table> WHERE <backfill column> IS NULL) THEN ... END IF`) so it fires while backfill work remains and is a permanent no-op after — otherwise it re-crashes every boot the moment a second `contractors` row exists. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that surfaced this.

### Jobber API
- All Jobber GraphQL calls wrapped in retryWithBackoff with jobberShouldRetry.
- retryHelpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry, **stripeShouldRetry**) live in server/utils/retryHelpers.js — never redefine locally. ⚠ `stripeShouldRetry` was missing from this list until 2026-08-29 while being imported and used in `server/routes/stripe.js` — **an incomplete resident list is how someone concludes a helper does not exist and writes a fifth one locally**, which is the exact thing this line forbids.
- Jobber API version: `2026-02-17`. Do not change without verifying changelog.
- `ClientFilterAttributes` does NOT support name/firstName/lastName filtering — always filter locally in JS.
- Jobber GraphQL is read-only. Never add mutations without explicit instruction.
- OAuth token refresh handled by `refreshTokenIfNeeded(contractorId, {force})` — never bypass. Token access is contractor-scoped: never read or write the `tokens` table without a `contractor_id` predicate. Use `getContractorAccessToken(contractorId)` for reads — it is the only sanctioned way to read a contractor's access token. `tokens.id` is inert (sequence-filled default, never referenced by application code) — `contractor_id` is the real key.
- `getPrimaryEmail`/`getPrimaryPhone` handle both GraphQL array shape and flat-string fallback — never simplify.
- phones/emails absent from bulk allClients sync query intentionally (API load). Only in fetchFullClient and targeted lookups.

### External Services
- All Resend calls: retryWithBackoff with resendShouldRetry.
- All Twilio calls: retryWithBackoff with twilioShouldRetry.
- SMS gated by `TWILIO_10DLC_ACTIVE` env var. Never remove this guard.
- Resend sends from noreply@roofmiles.com. Admin alerts to admin1@roofmiles.com.

### Frontend Rules
- Screen.jsx overflow settings intentional — do not change.
- All styling inline. Never add CSS files or CSS framework.
- Design tokens in theme.js (R) and adminTheme.js (AD). Never hardcode colors/fonts/spacing outside these files.
- Icons: Phosphor Icons v2.1.1 only.
- `WARMUP_ENTRIES_SERVER` must stay in sync with `WARMUP_ENTRIES` in shouts.js.
- Never display referral bonus dollar amount at `sold` stage — bonus only shown at `complete`, from `referral_conversions.bonus_amount`.

### Code Quality
- No `.then()` chains. No `var`. No callbacks. No class components except ErrorBoundary.jsx.
- Every async function must have try/catch.
- Error responses never expose internal stack traces or DB details to client.
- No `console.log` in production code paths (exception: `// diagnostic log — intentional`).
- User-sourced and CRM-sourced strings in HTML emails must be HTML-escaped via `escapeHtml()` in pendingReferral.js.
- Silent audit rule applies on every file read — flag violations before proceeding.

### Architecture Boundaries
- server.js is a lean entry point. No route handlers or business logic.
- App.jsx is a routing shell. No component code.
- pendingReferral.js is a utility file. No route handling or middleware.
- `getCRMAdapter(contractorId)` is the multi-contractor hook — never bypass.
- New referrer routes → referrer.js. New admin routes → admin/ sub-folder. New CRM adapters → crm/[name].js.
