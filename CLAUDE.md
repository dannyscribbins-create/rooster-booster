This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **When working on any feature listed in the Feature Registry or Pending Features, read `CLAUDE_REGISTRY.md` before writing any code.**
>
> **`PRE_LAUNCH_CHECKLIST.md` (repo root) is the CANONICAL index of all open and deferred work** — pre-launch items, C/DL-3b-2, C/DL-3c, Decision E, contractor-ID reconciliation, and the named builds. Read it when picking up work or closing a session. Detail stays in the documents it points at; **add what you defer before writing the handoff, not after.**

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

**The budget is finite and every addition spends it.** This file loads IN FULL at the start
of every session. 40,000 chars is Claude Code's performance-warning threshold; it sits at
~31,300 as of restructure Phase 2. Adding a rule is correct. Adding reference data borrows
against every future session.

**Headings are load-bearing.** `CDL_3a_BUILD_SPEC.md`, `CDL_3b_BUILD_SPEC.md` and
`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` cite headings here BY NAME, and code comments cite
sections. Renaming one breaks them silently and all at once. When a block moves, its heading
stays in both places.

**Relocations are verbatim.** Never correct staleness in the same commit as a move. A diff
containing both cannot be reviewed, and a relocation's whole value is that it can be checked
mechanically. Phase 1 shipped one knowingly-wrong line rather than break this
(`docs/ARCHITECTURE.md:217`); Phase 2 shipped a second (`server/test/escapeHtmlExport.test.js:6`).

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

The frontend builds with **Vite** (`vite.config.mjs`), not create-react-app — react-scripts was removed in the Vite migration. Vercel is configured by `vercel.json` (`framework: vite`, `outputDirectory: dist`). Frontend env vars are `import.meta.env.VITE_*`, never `process.env.REACT_APP_*`.

`npm run lint` is narrow by design: `eslint.config.mjs` enables ONLY `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, with no recommended preset. It reproduces exactly what CRA enforced and nothing more — adding a preset would surface hundreds of never-enforced pre-existing violations. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

---

## Architectural Principles

Every decision must pass two filters:
1. Will this produce healthy, efficient code unlikely to break?
2. Will this work at large scale — many contractors, many referrers?

MVP shortcuts must be flagged with a code comment explaining: (a) the limitation, (b) the scalable version, (c) when to build it.

**Known MVP shortcuts:**
- `paid_count` on users table — updated only when referrer loads pipeline. At scale, replace with background cron. Flagged in code: `// MVP: update this to cron-based sync at scale`
- `contractor_id` resolution — RESOLVED — tenant-resolution rebuild S1-S3; referrer=session-derived, webhooks=accountId-derived.

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

Brand files at `G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`.

---

## Deployment

Hosted on Railway (backend) and Vercel (frontend). All commits to main auto-deploy to Railway. Vercel may need manual redeploy — dashboard → latest deployment → three dots → Redeploy.

**Local environment cannot connect to Railway PostgreSQL.** Always test login-dependent features on live deployment.

**Jobber API version header: `2026-02-17`** — monitor for deprecation notices.

`DB_QUERIES.md` in project root — reference cheat-sheet of Railway query interface SQL snippets. Accurate and inert.

`server/migrations/` — three one-time migration scripts, all applied. Two imported in db.js (idempotent). One standalone (add_payout_columns.js — superseded by initDB(), do not run again).

### Environment Variables (Railway)
> Moved to `docs/ARCHITECTURE.md` in restructure Phase 1 — see **Environment Variables (Railway)** there.

---

## Testing

- `npm test` runs the lint step and BOTH suites, and is the single pre-push gate:
  - `npm run lint` — ESLint over `src/`, react-hooks rules only (see Commands above).
  - `npm run test:server` — `node:test` over `server/test/*.test.js` with `--test-concurrency=1` (the concurrency flag is load-bearing: Node 24 runs test files in parallel by default and the suites share one database).
  - `npm run test:react` — **Vitest** + jsdom over `src/**/*.test.{js,jsx}` via `vitest run` (the `run` subcommand is what makes it exit instead of entering watch mode; `npm run test:react:watch` is the interactive one).
  - The three are chained with `&&`, lint → server → react, so a red React test blocks a push exactly like a red server test. Consequence to know: if an earlier step fails, the later ones do not run that invocation.
  - ⚠ `vite.config.mjs` sets `test.include: ['src/**/*.test.{js,jsx}']`. This is NOT cosmetic. Vitest's default glob scans the whole repo and would sweep up `server/test/*.test.js` — and `--test-concurrency=1` is a property of the **node:test invocation**, not of the test files, so another runner importing them bypasses it entirely and executes `initTestDb()`'s `DROP SCHEMA public CASCADE` in parallel workers. That destroyed the local test DB once already. The two runners must never overlap; the include glob is what enforces it structurally rather than by convention.
  - ⚠ These were separate commands until C/DL-2 Phase 3c, and component tests were therefore green only when someone remembered to run them. That is precisely how `BrandingPreview.jsx` drifted to Accent Roofing's palette while the server used RoofMiles' — no test was wrong, none of them ran.
- Never add a React test that only runs under `test:react:watch`, and never split the gate back apart.
- Test database is local PostgreSQL at localhost:5432, database `roofmiles_test`, credentials in `.env.test` (gitignored, local-only — never commit).
- `server/test/setup.js` contains a safety interlock: the run aborts unless `DATABASE_URL` points to localhost/127.0.0.1. Tests cannot touch production by construction.
- Rule: run `npm test` before every push. Lint must be clean and both suites fully green — as of the Vite migration that is **734 server tests and 35 React tests across 6 files**. (Treat the numbers as a tripwire for an unexpectedly SHRINKING suite, not as a target to keep updated by hand. A Vitest file count that jumps far above 6 means the include glob has been widened and is picking up the server suite — see the warning above.)
- Characterization rule: a failing or surprising test result means STOP and report — never adjust production code to satisfy a test, and never silently adjust a test to satisfy the code. Deliberate behavior changes update the relevant test openly and are documented in the session handoff.
- Migration idempotency proofs must include a reproduction seeded with production's actual pre-existing row shapes, not only fresh-schema runs — a test DB rebuilt from scratch every run can never exercise "a real pre-existing row already in some legacy state," which is exactly what breaks in production and never breaks locally. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that established this.

---

## Test Design — learnings that cost production bugs to acquire

*Read before writing a test, not after it goes green. Every rule below was learned by shipping
something a green suite did not catch.*

### A test's own greenness is not evidence that it tests anything

**Six vacuity instances were found in C/DL-3b, in six different shapes, and a seventh in the
Admin Brand Retirement build. None was findable by reading; every one was found by forcing
the failure.**

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

**The conclusion:** non-vacuity assertions belong in tests that look **too simple to need
them** — grep-a-file, render-and-check, slice-a-string — because that is exactly where this
keeps happening.

### Sweeps have two independent gaps

- **Formatting, not values.** `770-277-4869` and `7702774869` are the same number and do not
  match. **Normalise before comparing** — strip non-digits for phones; strip scheme, `www.`
  and trailing slash for URLs. A `tel:` href dialled the wrong company through a sweep that
  reported clean.
- **The hand-maintained FILES list — NOT FIXED.** Every sweep iterates a list someone typed.
  New files are invisible until remembered, and **nothing announces the omission**. A clean
  sweep is evidence about the listed files only. Prefer walking a directory tree.

### Retirements need a producer sweep, not only a consumer assertion

Proving a value is ignored is **not** proving nothing depended on it. Grep the **producers**
repo-wide — server routes, email templates, redirects — and enumerate **consumers** repo-wide
too, remembering that a consumer need not sit on the obvious path: any component can read
`window.location` directly.

### Two rules about defaults

- **Canonical-default rule.** When a default exists in two places, **the one that reaches
  production users is canonical**; the other is a copy that drifted.
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
6. Run: `git add -A && git commit -m "[descriptive message]" && git push`
7. Never commit a broken or partial state

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
- retryHelpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry) live in server/utils/retryHelpers.js — never redefine locally.
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
