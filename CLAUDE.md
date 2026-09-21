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

### ⚠ ROOFMILES IS NOT ANOTHER CRM — WHAT THE REP APP IS FOR

Ruled by Danny 2026-09-19, and it governs **every** rep-surface decision.

**Reps do not need RoofMiles to manage and follow up with every assigned client. Jobber is
where the work is managed.** RoofMiles tracks who is assigned to them, their
closing/converting stats, their referral network and their referral potential, and makes it
easier to capitalise on clients through the referral programme. **Its purpose is to help reps
get clients into the app and into the contractor's programme, one way or another.**

⚠ **THIS IS RESIDENT BECAUSE THE FAILURE IS SILENT AND LOOKS LIKE GOOD PRODUCT SENSE.** Every
CRM-ward feature is individually reasonable — a follow-up queue, a task list, a "clients
needing attention" sort. Each one is a small step, none of them announces itself as a change
of purpose, and a session that has not met this sentence will propose one and be right to.
**Meet the answer before writing the proposal** — the same reasoning that makes the Jobber
write-back ruling resident (*Never Break → Jobber API*, A36.5.a).

⚠ **THE WORKED EXAMPLE IS A RULING THAT WAS MADE AND REVERSED THE SAME DAY.** Canvass-stage
gave every client a pipeline stage. Today's Focus split its two sections on *"has a stage"*,
so the obvious consequence was that one section would empty and should be merged away — and
that was ruled, then **reversed by Danny within the hour**: the two sections are two different
JOBS (the referral network; who to work now), not one list split by which data happens to
exist. The partition stayed on the referral record. **Deciding a rep-surface question from the
shape of the data rather than from what the app is for is exactly what this block exists to
catch**, and it caught its author.

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

⚠ **THE PLATFORM BRAND IS ROOFMILES, AND EVERY VALUE BELOW IS STATED WITH ITS ROLE. A BARE
LIST OF HEXES IS WHAT LET THE ROLES DRIFT SILENTLY, TWICE.** The four platform defaults live
in `BRANDING_THEME_DEFAULTS` (`src/utils/brandingTheme.mjs`, mirrored from the canonical
`server/utils/brandingTheme.js`):

| Stored brand input | Platform default | What a contractor means by it |
|---|---|---|
| `primaryColor` (`primary_color`) | `#1C2D4D` | their **PRIMARY BRAND COLOUR — the dark neutral**, the one on the trucks |
| `secondaryColor` (`secondary_color`) | `#F26A1B` | their **ACTION colour** — buttons, links, anything tapped |
| `accentColor` (`accent_color`) | `#FDF0E7` | **soft background washes** — progress tracks, avatar fills. A pale tint of the primary, by ruling |
| `backgroundColor` (`landing_bg_color`) | `#FFFFFF` | the **landing page's own canvas** |

⚠ **THESE ARE THE STORED INPUTS. THEY ARE NOT THE RENDER TOKENS, THEY DO NOT SHARE NAMES WITH
THEM, AND CONFLATING THE TWO SETS CARRIED A20 WRONG FOR WEEKS.** `deriveThemeTokens()`
(`src/utils/themeTokens.mjs`) computes the six `RENDER_TOKEN_KEYS` — `primary`, `secondary`,
`bg`, `surface`, `text`, `onPrimary` — which mount as `--rm-primary`, `--rm-secondary`,
`--rm-bg`, `--rm-surface`, `--rm-text`, `--rm-on-primary`. **The routing crosses over**, by
B-1's ruling (2026-09-01): the render token `primary` (the button fill) comes from the stored
**`secondaryColor`**, and the render token `secondary` comes from the stored
**`primaryColor`**. `surface`, `text` and `onPrimary` are **computed under contrast floors and
cannot be stored at all** — a contractor cannot set them, and a colour read off a mockup for
either can never be reproduced. **`accentColor` has no render token whatsoever**; the
server-rendered landing page emits its own `--brand-*` set from the stored hexes and never
calls the derivation.

⚠ **DO NOT "TIDY" THE CROSSOVER BY SWAPPING THE TOKEN NAMES BACK.** *"Primary"* names the
contractor's primary BRAND colour, not the primary ACTION colour, and that is the reading
every contractor already had — the mismatch is what produced a live page with a burgundy
ground and a blue button. The render tokens did not move in B-1; only the routing into them
did, which is why no component changed.

⚠ **THIS IS THE SECOND CORRECTION TO THIS LINE, AND THE FIRST ONE IS WHY THE TABLE EXISTS.**
The ABR spec's D-B already corrected it once, when it recorded one contractor's palette as the
platform's. It was then wrong again from B-1 until 2026-09-03 — right hexes, wrong roles,
because the values were listed and the roles were not. This line used to read *"Brand
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
- Rule: run `npm test` before every push. Lint must be clean and both suites fully green — **1606 server tests across 264 suites, and 1328 React tests across 79 files** (measured 2026-09-21 by the Canvass-stage Ruling-2 commit, by running the gate; the log's own `EXIT=` line read 0, and **all SEVEN server numbers were read by name off the log, never tailed**: `tests 1606 · suites 264 · pass 1606 · fail 0 · cancelled 0 · skipped 0 · todo 0`). A drop below these numbers means tests were deleted; stop and report.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE RULING-2 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS
  TESTS.** **BOTH HALVES MOVED AND NEITHER SUITE COUNT DID**, which is the expected shape here:
  server 1604 → 1606 is **+2** appended to an EXISTING `describe` in `repClients.test.js`, and
  React 1325 → 1328 is **+3** appended to the EXISTING `repClientsScreen.test.jsx`. **No new test
  file of either kind**, so suites hold at 264 and files at 79. A file count and a suite count
  answer different questions, and neither answers "how many cases".
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN.** The only `src/` file touched is
  `RepClientsScreen.jsx` — an EXISTING file, and `src/components/rep/` is not one of
  `adminBranding.test.jsx`'s four walked roots either way — so the arithmetic closes at exactly 3.
  ⚠ **AND A GUARD-PROOF FAILED TO APPLY AND WAS CAUGHT BY READING ITS OWN OUTPUT.** The first
  attempt to make the restored `pipeline_cache` join INNER used an anchor string that matched
  nothing; the injection never landed, and the suite reported **71/71 green** — which reads
  exactly like a fence that does not fire. **A guard-proof that proves nothing looks identical to
  a guard-proof that passes**, and the only tell was the Python `AssertionError` printed above the
  green count. Re-applied by line number, it took **29** tests red. **Check that the injection
  landed before believing the result.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE STAGE-WEBHOOKS COMMIT ITSELF.* It
  read **1604 / 264 / 1325 / 79**, +14 server from 11 `it(` lines (one inside a three-entry loop
  that wraps it), and records the five guard-proofs plus the test of its own that was looking in
  a place its subject could not be.
  Server 1590 → 1604 is **+14 = 13 + 1**: thirteen in one new file
  (`stageWebhooks.test.js`) and **one appended to an EXISTING describe** in
  `requestAttribution.test.js`. Suites 260 → 264 is **+4** — the new file's four top-level
  `describe` blocks; the requestAttribution case landed inside one that already existed.
  ⚠ **13 FROM 11 `it(` LINES, AND THE GAP IS THE WHOLE REASON TO COUNT RATHER THAN READ.**
  `grep -c` reports **11**, and ONE of them sits inside a three-entry `for` loop that WRAPS the
  `it()` — the fence is asserted per topic BY NAME rather than once for a shared handler. So
  10 × 1 + 1 × 3 = 13. **Reading "11 lines" as 11 cases would have been low by two**, which is
  the direction that looks identical to a suite that partly failed to register.
  ⚠ **THE REACT NUMBERS DID NOT MOVE AND WERE RE-MEASURED RATHER THAN CARRIED.** This commit
  touches no `src/` file at all, so 1325 / 79 is the same measurement re-observed, read by name
  off this run's own log. **A number that did not change still has to be MEASURED to be re-armed.**
  ⚠ **FIVE MORE GUARD-PROOFS, AND ONE FOUND A TEST LOOKING IN THE WRONG PLACE.** Making the
  request path CREATE rows took 1 red; removing its stage write took 1; making the stage webhooks
  CREATE rows took 1; routing a stage handler through `syncSingleClient` took **3** red across the
  three topics; and flattening the dedupe key took the genuine-second-update case red. ⚠ **A
  sixth case failed first for a reason that was mine, not the code's**: an unresolvable-tenant
  test waited on a tenant-scoped `error_log` count, and a contractor-resolution failure BY
  DEFINITION carries no contractor — the assertion was about the right subject and was looking
  somewhere the subject could not be.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-STAGE COMMIT ITSELF.* It
  read **1590 / 260 / 1325 / 79**, +16 server across two new files and two appended cases, and it
  records the nine guard-proofs of which two found vacuous tests.
  Server 1574 → 1590 is **+16 = 8 + 6 + 2**: eight in one new file
  (`pipelineStageWriters.test.js`), six in another (`fullImportCursor.test.js`), and **two appended
  to EXISTING describes** in `repClients.test.js`. Suites 254 → 260 is **+6 = 3 + 3** — those two
  new files' three top-level `describe` blocks each; the repClients pair landed inside describes
  that already existed, so they add cases without adding a suite.
  ⚠ **COUNTED WITH `grep -c`, AND BOTH NEW FILES CONTAIN NO LOOP OF ANY KIND** — checked
  explicitly rather than assumed, because a loop's position is a property of the file and not of
  the arc. So 8 and 6 are exact, not 8 × anything.
  ⚠ **REACT 1323 → 1325 IS +2 WHILE THE FILE COUNT HOLDS AT 79**, which is the shape that means
  an existing suite grew rather than a new one arriving. Both are in `repHomeScreen.test.jsx`.
  **A THIRD CASE THERE WAS RENAMED AND CONTRIBUTES 0** — its title had been INVERTED by this
  phase (*"section 2 shows the assignment date"* stated a contrast that stopped being true when
  section 2 gained a stage), and it kept passing only because its fixture had no stage to show.
  ⚠ **NO PHANTOM, AND IT WAS ASKED BEFORE THE RUN.** This commit's `src/` changes are confined to
  `src/components/rep/`, which is **not** one of `adminBranding.test.jsx`'s four walked roots, and
  it adds no new non-test file to any of them — so the arithmetic closes at exactly 2.
  ⚠ **AND NINE GUARD-PROOFS WERE RUN, OF WHICH TWO FOUND VACUOUS TESTS — WHICH IS THE ENTRY
  WORTH KEEPING.** Injecting the flattened client shape into the sync took **all seven** stage
  cases red, every one reporting `actual: 'lead'`; reinstating a referral gate took **five** red
  and left the two REFERRED cases green; breaching the fence's seventh zero took exactly **one**;
  degrading the import cursor to a high-water mark took **one**; removing the per-client
  transaction took **three**. ⚠ **But removing the COALESCE left all seven GREEN**, and disabling
  resume entirely left all six GREEN — both tests were passing for the wrong reason. The first
  made its fetch THROW, which aborts before the upsert, so the stage survived because nothing was
  written; the second keyed on `clients_done`, which resets on a non-resume and reaches the same
  number by both routes. **Repaired to drive a resolved 200 with a null client, and to observe a
  sentinel on the prefix row** — both then failed as predicted.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CANVASS-9b PART 2 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS
  TESTS.** React 1319 → 1323 is **+4**, all appended to the EXISTING
  `repInfoAndReveal.test.jsx` for the three overlay fixes — so **the FILE count stays 79** and the
  server numbers do not move. One existing case was REWRITTEN rather than added to (the frost
  layering), contributing 0.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-9b INFO/REVEAL COMMIT ITSELF, BECAUSE THAT COMMIT
  SHIPS TESTS.* React 1299 → 1319 is **+20**, the `it(` lines of ONE new file
  (`repInfoAndReveal.test.jsx`); 78 → 79 is that file. **The server numbers do not move** — the
  info affordance and the reveal have no server surface.
  ⚠ **TWO EXISTING CASES WERE EDITED AND NEITHER ADDS TO THE COUNT**, which is the shape worth
  naming: one was INVERTED (the Attribution-type slot went from "empty by design" to "filled by
  9b", contributing 0) and one gained a paired positive INSIDE its own body (the revenue lock,
  still one case). **A count that moves by exactly one file's worth while two other files changed
  is the expected shape here, not a miss.**
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN.** The three new source files — `repGlossary.js`,
  `RepInfoIcon.jsx`, `RepRevealCard.jsx` — are all in `src/components/rep/`, which is **not** one
  of `adminBranding.test.jsx`'s four walked roots, so the arithmetic closes at exactly 20.
  ⚠ **AND A BARE NEEDLE IN AN EXISTING TEST WENT RED FOR THE RIGHT REASON.**
  `repClientDetail.test.jsx` asserted the revenue lock's absence with
  `container.querySelector('svg')` — a needle meaning *"no icon at all"*, which was correct only
  while the lock was the ONLY icon on that card. The reveal's caret is a legitimate non-lock SVG
  and broke it **without the behaviour being wrong**. Repaired by naming the subject
  (`data-rep-revenue-lock`) and adding the paired positive, so the needle can no longer be
  satisfied by a renamed attribute.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-9b MOTION COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  React 1280 → 1299 is **+19 = 18 + 1**: eighteen in one new file (`repMotion.test.jsx`, which is
  77 → 78) and **one net** in `repTimeframeAndRows.test.jsx`, where a single 9a fence was **SPLIT
  INTO TWO** rather than extended. The server numbers do not move — motion has no server surface.
  ⚠ **THE SPLIT IS WORTH THE LINE BECAUSE ONE HALF WAS SUPERSEDED AND THE OTHER BECAME
  PERMANENT.** 9a's *"there is NO transition declared — motion is 9b"* asserted `transition` AND
  `animation` were both empty. 9b built the motion system, so the transition half is superseded by
  design; **the animation half is not** — a list row must never animate in, because
  `REP_BOOK_LIMIT` is 100 and Load more appends a hundred rows in one commit. Inverting one case
  into two is why the delta is +1 against two cases touched.
  ⚠ **AND A DEFECT SHIPPED GREEN THROUGH THIS SUITE AND WAS CAUGHT ONLY IN THE BROWSER, WHICH IS
  THE ENTRY THAT MATTERS.** `pressTransition` emitted
  `background-color, transform 140ms cubic-bezier(...)`. The CSS shorthand **does not distribute a
  duration across a comma list**: the browser parsed that as `background-color` at the DEFAULT
  **0s** and `transform` at 140ms — computed on a real row as `transition-duration: 0s, 0.14s`.
  **The ground swap, which is the only property that actually changes, never eased; `transform`,
  which nothing sets, did.** The release settle was inert while the source looked right.
  ⚠ **THE ASSERTION THAT MISSED IT WAS `toContain('140ms')`, AND THE MALFORMED STRING CONTAINS
  '140ms'.** jsdom stores a shorthand verbatim and computes nothing, so **no declaration-level
  assertion can see a shorthand that parses into the wrong thing.** The fence now requires every
  top-level segment to carry its own duration — a SHAPE check, which is what survives having no
  CSS engine — and re-emitting the original form breaks it.
  ⚠ **AND THE FENCE'S OWN FIRST WRITING HAD THE SAME CLASS OF BUG**: it used a bare
  `split(',')`, which shatters `cubic-bezier(0.22, 1, 0.36, 1)` into five fragments and failed
  against CORRECT code. A comma list parsed without regard to what the commas belong to — in the
  checker this time. **Both directions are now guard-proofed.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-9b PART 0 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  It read **1574 / 254 / 1280 / 77**, +9 React across two existing files with no new file and no
  phantom, and it records the guard-proof that found `row-reverse` invisible to a DOM-order fence.
  React 1271 → 1280 is **+9 = 5 + 4**, both appended to EXISTING files — five cases in
  `repProfileScreen.test.jsx` (the switcher's new home) and four in `repTimeframeAndRows.test.jsx`
  (its absence from the other three screens). **The FILE count stays 77 and the SERVER numbers do
  not move at all**, which is the expected shape: Part 0 is a placement change with no server
  surface. ⚠ **A React figure that rises while the file count holds means an existing suite grew**
  — a different event from a new suite arriving, and worth reading as such.
  ⚠ **NO PHANTOM THIS TIME, AND IT WAS ASKED BEFORE THE RUN RATHER THAN RECONCILED AFTER.** Part 0
  adds **no new file of any kind**, so none of `adminBranding.test.jsx`'s four walked roots gained a
  sweepable file and the arithmetic closes at exactly 9.
  ⚠ **FIVE GUARD-PROOFS WERE RUN AND ONE OF THEM FOUND A HOLE, WHICH IS THE ENTRY WORTH KEEPING.**
  Reinstating the chrome slot took the absence fences to **4 failed**; removing the eligibility gate
  took the ineligible-member case red; inserting a row into A30's gap took **4** cases red across
  two files; and swapping the JSX order broke the ordering fence. ⚠ **But `flex-direction:
  row-reverse` DID NOT** — it paints Sign out to the LEFT of the switcher, breaking the ruling,
  while leaving DOM order untouched, and the ordering assertion stayed **green** against it.
  **jsdom performs no layout, so a visual reversal is invisible to every position assertion.** The
  fence now forbids a reversing `flex-direction` outright, and that proof breaks it. *A fence whose
  failure mode has never been observed is a claim, not a check — and this one had its gap exactly
  where the reader is blind.*
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-9a COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  It read **1574 / 254 / 1271 / 77**, +18 server across two files and +42 React across five
  contributors including one phantom, and it records the two guard-proofs that took the
  header-parity and timeframe fences red.
  Server 1556 → 1574 is **+18 = 8 + 10**: eight in one new file (`repTimeframe.test.js`) and ten
  appended to an EXISTING file (`repClients.test.js`). Suites 251 → 254 is **+3 = 2 + 1** — that
  new file's TWO top-level `test.describe` blocks plus the ONE `describe` appended to
  `repClients.test.js`. React 1229 → 1271 is **+42**; files 75 → 77 is two new files.
  ⚠ **COUNTED WITH `grep -c`, AND EVERY LOOP CHECKED FOR POSITION RATHER THAN COUNTED.** Every
  `for` in both new server files and in `repTimeframeAndRows.test.jsx` sits INSIDE an `it()`/`test()`
  body — they iterate assertions and fixtures, not cases — so they multiply nothing.
  ⚠ **THE REACT +42 IS FIVE CONTRIBUTORS, NOT TWO, AND WRITING THEM OUT IS THE CHECK:**
  5 (`repHeaderModeParity.test.jsx`, new) + 22 (`repTimeframeAndRows.test.jsx`, new) + 6 (a new
  describe appended to `repClientDetail.test.jsx`) + 6 (one appended to `repProfileScreen.test.jsx`)
  + **1 where a single case was SPLIT INTO TWO** in `repClientsScreen.test.jsx` (the source
  assertion moved out of the row case into its own) + **1** new negative-fill case in
  `repProfileScreen.test.jsx` + **1 PHANTOM**. That is 42.
  ⚠ **AND THE PHANTOM WAS PREDICTED BEFORE THE RUN AND THEN PROVEN, NOT RECONCILED AFTER IT.**
  This commit adds `src/utils/greeting.js`, and **`src/utils` is one of the four roots
  `adminBranding.test.jsx` walks**, emitting one case per swept non-test file. Asked before the
  gate, per the rule this file states; then proven by moving the util aside and re-running that
  file alone — **63 → 62 → 63**. `src/components/rep/` is NOT a walked root, so the two new
  components there (`RepTimeframeBar.jsx`, `repRowAffordance.jsx`) add nothing, which is why the
  arithmetic closes at exactly 42 rather than 44.
  ⚠ **TWO GUARD-PROOFS WERE RUN AGAINST THIS COMMIT'S OWN NEW FENCES, AND BOTH WENT RED AS
  PREDICTED.** Removing `stableBox` from `RepShell`'s `<BrandMark>` took the header-parity file to
  **2 failed / 3 passed**, reporting *"expected 5 to be 4"* — dark renders five header elements and
  light four, which is the shape of the original defect. Neutralising `timeframeClause()` took
  `repClients.test.js` to **6 failed**, and re-pointing `conversionTimeframeClause()` at the
  assignment date took it to **exactly 1**. A fence whose failure mode has never been observed is a
  claim, not a check.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-8 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  It read **1556 / 251 / 1229 / 75**, +8 server in one new file and +22 React across an existing
  file and one new one, and it records that its gate went red twice first — once on `cancelled 8`
  beside `fail 1`, which is the reading this file insists is not a passing count.
  Server 1548 → 1556 is **+8**, the `it(` lines of one new file (`repConversions.test.js`); suites
  250 → 251 is that file's single top-level `describe`. React 1207 → 1229 is **+22 = 6 + 16** — six
  cases appended to the EXISTING `repHomeScreen.test.jsx` for the conversions card, and sixteen in
  one new file (`repProfileScreen.test.jsx`); 74 → 75 is that file.
  ⚠ **COUNTED WITH `grep -c`, AND EVERY LOOP CHECKED FOR POSITION.** `repConversions.test.js`
  contains NO loop at all, so 8 is exact. `repProfileScreen.test.jsx`'s three `for` loops all sit
  INSIDE `it()` bodies — they iterate forbidden-word assertions and the two revenue-flag states —
  so they multiply nothing and the count is 16.
  ⚠ **AND THE REACT ARITHMETIC CLOSES EXACTLY BECAUSE THE WALKER WAS ASKED BEFORE THE RUN, NOT
  RECONCILED AFTER IT.** `adminBranding.test.jsx` walks `src/components/admin`, `src/constants`,
  `src/components/superAdmin` and `src/utils`, emitting one case per swept file. This commit's new
  non-test file is `src/components/rep/RepProfileScreen.jsx` — **`src/components/rep` is not a
  walked root** — so there is no phantom twenty-third case.
  ⚠ **THE GATE WENT RED TWICE BEFORE THIS FIGURE, AND BOTH FAILURES WERE THE TRIPWIRES WORKING.**
  First `cancelled 8` with `fail 1`: the seeder threw during setup on an `ON CONFLICT (email)` whose
  arbiter index no longer exists — **a CANCELLED count is not a passing count**, and reading only
  `pass` would have hidden an entire un-run suite. Then `fail 1` on a `deepEqual` over the whole
  `stats` object, which is exactly the fence that catches an **unannounced payload change**; it was
  repaired by ADDING the new key, never by relaxing it to a subset.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-6 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  Server 1534 → 1548 is **+14**, one new `describe` appended to the EXISTING `repClients.test.js`;
  suites 249 → 250 is that single block. React 1191 → 1207 is **+16** in one new file
  (`repHomeScreen.test.jsx`), and 73 → 74 is that file.
  ⚠ **COUNTED WITH `grep -c`, LOOPS CHECKED FOR POSITION** — the server file's `for` loops all
  sit inside `it()` bodies (they seed books), so they multiply nothing.
  ⚠ **AND THE REACT FILE GREW 13 → 16 MID-PHASE FOR A REASON WORTH THE LINE: AN EXISTING FENCE IN
  A FILE THIS PHASE NEVER OPENED WENT RED, AND IT WAS RIGHT.** `BrandingPreview.test.jsx`'s B-4
  case asserts the admin branding preview fires **no request**; that preview mounts the REAL
  `RepShell`, and Canvass-6 turned its entry screen into one that fetches on mount. **The preview's
  own safety note said "the entry screen is Home" — an argument that held only while Home was a
  placeholder.** Fixed at the cause with a `preview` prop whose effect returns on its FIRST line,
  plus three new cases here including the paired positive (without `preview` it DOES fetch).
  ⚠ **THAT IS THE "a safety argument resting on another component's current behaviour is a
  coincidence with a comment beside it" SHAPE** — and it was caught only because the test asserted
  the PROPERTY (no request fired) rather than the coincidence.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-5 COMMIT ITSELF.* It read
  **1534 / 249 / 1191 / 73**, +16 server across two new describes and +19 React in one new file,
  and it records the `BrandLogo` hoist that fixed a timing flake at its cause rather than its
  threshold.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CANVASS-5 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.**
  Server 1518 → 1534 is **+16** — the `it(` lines of two new `describe` blocks appended to the
  EXISTING `repClients.test.js`; suites 247 → 249 is those **two** blocks. React 1172 → 1191 is
  **+19** in one new file (`repClientDetail.test.jsx`), and 72 → 73 is that file.
  ⚠ **COUNTED WITH `grep -c`, AND EVERY LOOP CHECKED FOR POSITION.** The server file's loops all
  sit inside `it()` bodies (they seed 250-row books); the React file's `it.each` is in
  `BrandLogo.test.jsx`, not here.
  ⚠ **A REACT CASE COUNT ROSE WITHOUT A NEW CASE BEING WRITTEN, AND IT IS WORTH THE LINE:**
  `BrandLogo.test.jsx` was EDITED but not extended — its four `it.each` rows are unchanged. The
  file's totals do not move; only where its cost is paid does.
  ⚠ **AND THE ONE FAILURE THIS GATE PRODUCED WAS FIXED AT ITS CAUSE, NOT ITS THRESHOLD.**
  `BrandLogo.test.jsx`'s RepShell case timed out at 5000ms under full-suite load while passing in
  isolation at 2.23s — the exact shape recorded under *Fix a timing flake at its cause*. Cause: the
  four screens were `() => import(...)` thunks awaited INSIDE each test body, so module-load cost
  was charged to the per-test budget, and RepShell had just gained a transitive dependency on
  `@phosphor-icons/react`. **Hoisted to static imports: `tests` fell 2.23s → 0.12s and `import`
  rose 0.18s → 2.26s** — the cost moved out of the budget rather than the budget moving.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-4b COMMIT ITSELF.* It read
  **1518 / 247 / 1172 / 72**, +3 server and +4 React, all into existing describes and an existing
  file — which is why its suite and file counts held still.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CANVASS-4b COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.**
  Server 1515 → 1518 is **+3** and React 1168 → 1172 is **+4**, all added to **EXISTING `describe`
  blocks and an EXISTING file** — which is why **`suites` stays 247 and the React FILE count stays
  72.** ⚠ **A suite count that does not move while the case count does is the expected shape here,
  not a miss**: a file count and a suite count answer different questions, and neither answers "how
  many cases".
  ⚠ **THE REACT DELTA IS +4 AGAINST FIVE CASES TOUCHED, AND THE ARITHMETIC IS WORTH WRITING DOWN.**
  One existing case was **inverted rather than added** — Canvass-4's *"stays silent when the page IS
  the whole book"* asserted the count line was ABSENT when nothing was truncated. That assertion
  passed and was wrong: it pinned the very defect production reported. It became *"the count STILL
  renders"*, so it contributes 0 to the delta while four genuinely new cases contribute 4.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-4 COMMIT ITSELF.* It read
  **1515 / 247 / 1168 / 72**, +24 server cases across five new top-level describes and +22 React
  cases in one new file, with the count rising twice mid-phase because guard-proofs found vacuous
  cases.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CANVASS-4 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.**
  ⚠ **BOTH HALVES MOVED, AND THIS IS THE FIRST ENTRY IN THE ARC WHERE THEY MOVED TOGETHER.**
  Server 1491 → 1515 is **+24**, the `it(` lines of one new file (`repClients.test.js`); suites
  242 → 247 is that file's **five top-level `describe` blocks**. React 1146 → 1168 is **+22**, the
  `it(` lines of `repClientsScreen.test.jsx`, and 71 → 72 is that file.
  ⚠ **COUNTED WITH `grep -c`, AND EVERY LOOP WAS CHECKED FOR POSITION RATHER THAN COUNTED.** The
  server file's two `for` loops both sit INSIDE `it()` bodies (they build a 105-row fixture and a
  three-client membership fixture), so they multiply nothing; the React file's loops likewise
  iterate assertions inside cases.
  ⚠ **THE REACT ARITHMETIC CLOSES EXACTLY, AND THAT WAS PREDICTED RATHER THAN RECONCILED.** Before
  the run: does this commit add a non-test file under `src/components/admin`, `src/constants`,
  `src/components/superAdmin` or `src/utils` — the four roots `adminBranding.test.jsx` walks, one
  case per swept file? **It does not** — the new component is `src/components/rep/`, which is not a
  walked root. So +22 and no phantom twenty-third.
  ⚠ **AND THE COUNT ROSE TWICE DURING THE PHASE, BOTH TIMES BECAUSE A GUARD-PROOF FOUND A VACUOUS
  CASE — NOT BECAUSE CASES WERE PADDED.** The server file shipped 22, then 23, then 24: deleting
  the `flag_reason` clause left all 22 GREEN (an orphan flag writes no `reps_involved`, and
  `NULL @> anything` is NULL, so the containment clause alone was doing the work), and deleting the
  `contractor_id` predicate left all 23 GREEN (`team_members.id` is globally unique, so the rep-id
  filter alone already excluded the cross-tenant row). **Each repair added the one fixture that
  makes the clause falsifiable.** The React file went 21 → 22 the same way: its missing-stage case
  used `NO_STAGE_LABEL` as its own needle, so changing that constant to the exact defect moved the
  needle with the code and the test stayed green.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-3.7 REQUEST-ATTRIBUTION COMMIT.*
  It read **1491 / 242 / 1146 / 71**, +25 server cases in one new file across five top-level
  describes, with the React half unmoved and re-measured rather than carried. Its own note records
  that its count moved 24 → 25 for the same reason this one moved twice: a guard-proof found a
  vacuous anchor case and the repair split it into a discriminating pair.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CANVASS-3.7 REQUEST-ATTRIBUTION COMMIT ITSELF, BECAUSE THAT
  COMMIT SHIPS TESTS.** Server 1466 → 1491 is **+25**, the `it(` lines of one new file
  (`requestAttribution.test.js`); suites 237 → 242 is that file's **five TOP-LEVEL `describe`
  blocks**. ⚠ **COUNTED WITH `grep -c`, AND THE ONE `.map` IN THE FILE WAS CHECKED AND WRAPS NO
  `it()`** — it builds assignedUsers nodes inside a fixture helper, so the count is 25, not 25 ×
  anything.
  ⚠ **THE PREDICTION WAS 24 AND THE FILE SHIPPED 25, AND THE EXTRA CASE IS THE POINT RATHER THAN A
  MISCOUNT.** 24 was counted correctly from the file as first written and the run reported 24. A
  **guard-proof then found one of those 24 to be VACUOUS**: swapping the anchor from the request's
  `createdAt` (ruling R2, option A) to the client's `createdAt` (option B, the recorded fallback)
  left the whole suite **green at 24/24**, because the fixture's dates sat inside the grace window
  under BOTH anchors. Repairing it split one case into a discriminating **pair** — a negative whose
  dates make the two anchors disagree, and its positive on the same fixture. **The count moved
  because the coverage did**, and it was re-counted from the file afterwards rather than adjusted.
  ⚠ **THE REACT HALF DID NOT MOVE, AND THAT IS NOT STALENESS.** This commit adds no React test and
  **no non-test file under `src/components/admin`, `src/constants`, `src/components/superAdmin` or
  `src/utils`** — the four roots `adminBranding.test.jsx` walks — so the one-case-per-swept-file
  effect recorded three times below does not apply here. That was **asked before the run**, per the
  rule two entries down, rather than reconciled after it. 1146 / 71 was read by name off this run's
  own log.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-3.7 STEP-0 COMMIT.* It read
  **1466 / 237 / 1146 / 71**, and recorded that *NOT ONE OF THE FOUR NUMBERS MOVED* — a commit that
  changed assertions and no cases, re-measured rather than carried. ⚠ **Its instruction not to
  "correct" the head back to `cb1fb90` applied to that figure and is spent; this entry supersedes
  it rather than contradicting it.**
  ⚠ **NOT ONE OF THE FOUR NUMBERS MOVED, AND THAT IS NOT STALENESS — IT IS THE CASE THIS FILE
  DISTINGUISHES.** The Canvass-3.7 Step-0 commit CHANGED assertions (a label's expected value) and
  the file that holds them, but added and removed **no cases**, so the tree differs from `cb1fb90`
  in things the gate can observe while the counts stay put. **A number that did not change still
  has to be MEASURED to be re-armed**, and all four were read by name off this run's own log rather
  than carried. ⚠ **DO NOT "CORRECT" THE HEAD BACK TO `cb1fb90`:** the figure is true at both, and
  naming the commit that re-measured it is what keeps the re-arming habit visible.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-3.6b COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  Server 1460 → 1466 is **+6**, a new NESTED `describe` inside an existing file; suites 236 → 237
  is that nested block — **a nested describe adds a suite exactly as a top-level one does**, which
  is the half that surprises people who expect "one file, one suite". React files 70 → 71 is one
  new test file.
  ⚠ **REACT WENT +9 FOR AN 8-CASE FILE, AND THIS TIME THE NINTH WAS PREDICTED BEFORE THE RUN
  RATHER THAN RECONCILED AFTER IT.** `adminBranding.test.jsx` walks four roots and **`src/utils` is
  one**; its walker skips `.test.` files but not ordinary ones, so the new
  `src/utils/jobberUserStatus.js` adds a case by itself. **8 + 1 = 9**, and it was proven the same
  way as last time — the util moved aside, `adminBranding` re-run: **62 → 61 → 62**.
  ⚠ **TWO COMMITS RUNNING NOW. THE RULE IS NOT "REMEMBER THIS FILE" — IT IS: BEFORE PREDICTING A
  REACT COUNT, ASK WHETHER THE COMMIT ADDS A NON-TEST FILE UNDER `src/components/admin`,
  `src/constants`, `src/components/superAdmin` OR `src/utils`.** If it does, add one per file.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-3.6 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  Server 1446 → 1460 is **+14**, the `it(` lines of one new file (`jobberUserPicker.test.js`);
  suites 235 → 236 is that file's single `describe`. React files 69 → 70 is one new test file.
  ⚠ **REACT WENT +11 WHILE THE NEW TEST FILE HOLDS 10, AND THE ELEVENTH IS THE POINT — THE SAME
  SHAPE THIS FILE ALREADY RECORDS TWICE.** `adminBranding.test.jsx` walks four roots recursively
  and emits ONE CASE PER SWEPT FILE; its walker **excludes `.test.` files but not ordinary ones**,
  and **`src/utils` is one of the four roots**. This commit adds
  `src/utils/jobberUserSearch.js` — a non-test file in a walked root — so the sweep gained a case
  by itself. **10 + 1 = 11.**
  ⚠ **AND IT WAS PROVEN, NOT INFERRED:** the util was moved aside and `adminBranding.test.jsx`
  re-run — **61 → 60 → 61**. *A total one higher than the new tests account for is the only signal
  this leaves*, and the breakdown is the only thing that can explain it. **Read the walker's roots
  AND its exclusions before predicting** — the previous entry's arithmetic closed exactly because
  its new file was a `.test.` file and was skipped; this one's did not.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-3 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  **BOTH HALVES MOVED, AND THE SERVER HALF CAME FROM TWO FILES RATHER THAN ONE.** Server 1427 →
  1446 is **+19 = 15 + 4**: fifteen cases in the new `repRouteGuard.test.js`, and four added to an
  **EXISTING** `describe` in `sessionAuthInvariant.test.js` (the rep-prefix count, its allowlist
  case, its control, and assertion A for the rep prefix). Suites 232 → 235 is **+3 from
  `repRouteGuard.test.js`'s three `describe` blocks ONLY** — the four sessionAuthInvariant cases
  landed inside a describe that already existed, so they add cases without adding a suite.
  React 1118 → 1126 is **+8 in an EXISTING FILE**: `roleRouting.test.jsx` went 12 → 20 cases when
  the substring fence was replaced by an exact allowlist plus its controls. **The FILE count does
  not move, and that is the tell worth keeping** — a React figure that rises while the file count
  holds means an existing suite grew, which is a different event from a new suite arriving.
  ⚠ **COUNTED WITH `grep -c`, WITH THE LOOP ARITHMETIC CHECKED IN BOTH FILES.**
  `repRouteGuard.test.js`: 15 `it(` lines; its two `.map`/`.filter` calls sit inside the
  `unguarded()` helper and wrap no `it()`. `roleRouting.test.jsx`: 20 `it(` lines and **four `for`
  loops, every one of them INSIDE an `it()` body** — they iterate assertions, not cases, so the
  count is 20 and not 20 × anything. **Both files had to be checked separately; a loop's position
  is a property of the file, not of the arc.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CANVASS-2 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.*
  **BOTH HALVES MOVED.** Server 1425 → 1427 is its two new cases, added to an **EXISTING** `describe`
  in `paletteLocalStack.test.js` — so suites stay 232, and **a file count and a suite count answer
  different questions.** React 1097 → 1118 is its 21 cases in one new file, and 68 → 69 is that file.
  ⚠ **THE REACT FIGURE THIS REPLACES WAS THREE FILES AND 27 TESTS STALE, AND THE STALENESS WAS
  FOUND BY A SESSION THAT DECLINED TO FIX IT — CORRECTLY.** It read *1070 across 65*, while
  `e0c596f`'s own commit body already reported **1097 across 68**. Canvass-1 measured the gap and
  deliberately did **not** re-arm, because it never ran the gate, and *a figure carried from someone
  else's report is exactly what this tripwire forbids.* **It flagged it for the next session that
  did run one. That is this commit.** Declining to re-arm from a second-hand number and declining to
  re-arm at all are different acts; the first is the rule working.
  ⚠ **21 WAS COUNTED FROM THE FILE WITH `grep -c`, WITH THE LOOP ARITHMETIC SHOWN.** It reports
  **17** `it(` lines. The file has **six** loops and ⚠ **only ONE wraps an `it()`** — the five-entry
  `SITES` table; the other five sit inside `it()` bodies or inside the `eachBrandMode`/`composite`
  helpers and emit nothing. So 17 − 1 + 5 = 21. **Reading "six loops" as six multipliers, or "17
  lines" as 17 cases, both give the wrong answer, and only the breakdown separates them.**
  ⚠ **AND THE FOURTEENTH-CASE TRAP WAS CHECKED FOR AND DOES NOT APPLY HERE, WHICH IS WHY THE
  ARITHMETIC CLOSES EXACTLY.** `adminBranding.test.jsx` walks `src/` recursively and emits one case
  per swept file — but its walker carries `if (/\.test\.(js|jsx|mjs)$/.test(entry.name)) continue;`,
  so a new TEST file adds nothing there, and this commit adds no new non-test file to a walked root.
  **Read the walker's exclusions before predicting; the entry below records the commit where a new
  UTIL file did add a fourteenth case, and the difference is the file's extension, not the sweep.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-16 COMMIT ITSELF.* 1056 → 1070 is **+14 from a new
  file holding 13**, and the fourteenth is the point: `adminBranding.test.jsx` WALKS `src/`
  recursively and emits ONE CASE PER SWEPT FILE, so the new `src/utils/bodyDefaults.js` added one
  by itself. 64 → 65 is the new test file. The SERVER numbers did not move and were re-measured
  rather than carried.
  ⚠ **AND THE FOURTEENTH WAS PROVEN, NOT ASSUMED** — the new util was stashed and
  `adminBranding.test.jsx` re-run: 59 → 58, then back. **A total one higher than the new tests
  account for is the only signal this leaves**, and CLAUDE.md already records the identical shape
  from `fontManifest.mjs`. The breakdown is the check; the total agreeing is not.
  ⚠ **THE COUNT IN THAT FILE'S OWN HEADER WAS WRONG TWICE** — written as "12 across 4", counted as
  13 across 5. The suite number was never counted; the case number went stale when a case was
  SPLIT after jsdom turned out not to model `-webkit-font-smoothing`. Four earlier slips in this
  arc were all in the CASE count, so the habit had formed around the one number being watched.
  **Re-count every number from the file, at the end.**
  ⚠ **A KNOWN FLAKE COST ONE GATE RUN AND IS NOT A REGRESSION:** `webhookContractorResolution`
  failed with `Cannot use a pool after calling end on the pool` on a commit touching only `src/`.
  Re-running was green. That is the documented webhook tenant flake.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE LANDING-FONTS COMMIT ITSELF.* 1410 →
  1425 is its 15 server cases in one new file, and 225 → 232 is that file's seven `describe`
  blocks. The REACT numbers did not move and were re-measured rather than carried.
  ⚠ **15 CASES, COUNTED WITH `grep -c`, AND THE FIRST PASS PREDICTED 14 — AGAIN.** That is the
  **FOURTH** recorded estimate-instead-of-count slip in this arc **and all four were LOW**, which
  is the direction that matters: a low prediction is indistinguishable from a suite that partly
  failed to register. **Write the count from the file, never from the plan.**
  ⚠ **AND A BROKEN `beforeEach` ANNOUNCES ITSELF BY FAILING EVERYTHING, INCLUDING WHAT CANNOT
  DEPEND ON IT.** That file's first RED run failed all 15 cases — including a pure-arithmetic
  fixture case with no database access — because the hook deleted `contractors` without first
  clearing the `titles` FK. **A hook fault and a subject fault look different: a subject fault
  spares the cases that do not touch it.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE FONT-LOADER COMMIT ITSELF.* 1395 →
  1410 is its 15 server cases in one new file, and 219 → 225 is that file's six `describe` blocks.
  The REACT numbers did not move and were re-measured rather than carried. Several `for` loops in that file all sit inside
  `it()` bodies and multiply nothing.
  ⚠ **AND A `suites 0` READING WAS SEEN AND ACTED ON DURING THAT WORK** — `tests 1` beside
  `suites 0` and `fail 1`, the module-load signature this file names. Cause: a backtick inside a
  SQL comment **inside a template literal**, which closed the string. The lucky variant; the
  recorded `landing.js` case produced no error at all.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-15 COMMIT ITSELF.* 1030 →
  1056 is its 26 React cases in one new file; 63 → 64 is that file. The SERVER numbers did not
  move and were re-measured rather than carried — Palette-15 touches no server file.
  ⚠ **26 `it(` LINES AND NINETEEN `for` LOOPS, AND THE LOOPS MULTIPLY NOTHING** — every one sits
  inside an `it()` body or a helper, so the count is 26, not 26 × anything.
  ⚠ **AND THE FIRST PASS PREDICTED 25.** One block was planned with two cases and written with
  three; `grep -c` caught it before the run. **Both previously recorded estimate-instead-of-count
  failures were also LOW**, which is the dangerous direction — a prediction that is low looks
  identical to a suite that did not run.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-14 COMMIT ITSELF.* 1022 →
  1030 is its 8 React cases in one new file; 62 → 63 is that file. The SERVER numbers did not
  move and were re-measured rather than carried — Palette-14 touches no server file.
  ⚠ **8 `it(` LINES AND FOUR `for` LOOPS, AND THE LOOPS MULTIPLY NOTHING** — all four sit
  inside `it()` bodies or helpers, so the count is 8, not 8 × anything. The two commits before
  this both had loops that DID wrap an `it()`, which is why the distinction is worth making
  every time rather than pattern-matching on "there are loops".
  ⚠ **THE HEAD FOR THIS FIGURE IS THE URL-CONTEXT COMMIT ITSELF.** 1339 → 1395 is its 56
  server cases in one new file, and 212 → 219 is that file's seven `describe` blocks. The
  REACT numbers did not move and were re-measured rather than carried — this commit touches
  no `src/` file.
  ⚠ **AND THE 56 WAS COUNTED, WITH THE LOOP ARITHMETIC — WHICH IS WHERE IT WOULD HAVE GONE
  WRONG.** `grep -c` reports **17** `it(` lines and **five** loops over the 14-payload evasion
  table. ⚠ **ONLY THREE OF THOSE FIVE WRAP AN `it()`**; the other two sit INSIDE `it()` bodies
  and emit nothing. So 3 × 14 = 42, plus the 14 un-looped lines = 56. **Reading "five loops ×
  14" would have predicted 70 and reading "17 lines" would have predicted 17** — neither is a
  small error, and only the breakdown distinguishes them.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE B.7 COMMIT ITSELF.* 1007 → 1022
  is its 15 React cases in one new file; 61 → 62 is that file. The server numbers did not move
  and were re-measured rather than carried — B.7 touches no server file at all.
  ⚠ **AND THE 15 WAS COUNTED, WITH THE LOOP ARITHMETIC, AND THE FIRST PASS WAS STILL WRONG.**
  `grep -c` reports **13** `it(` lines; ONE sits inside a three-role loop and emits 3, the
  other twelve emit one each — 12 + 3 = 15. A first pass predicted **14** by mis-splitting the
  lines across the file's three `describe` blocks. ⚠ **EIGHT other `for` loops in that file sit
  INSIDE `it()` bodies and emit no cases at all** — treating a loop as a case-multiplier
  because it is a loop is how this goes wrong, and it went wrong here.
  ⚠ **NOTHING ELSE MOVED THIS TIME, AND THAT WAS CHECKED RATHER THAN ASSUMED** — 1022 − 1007
  is exactly the new file, unlike the chain commit below, where a directory-walking sweep
  picked up a new file and made the total one higher than the new tests accounted for.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PALETTE-13 CHAIN COMMIT ITSELF, BECAUSE THAT COMMIT
  SHIPS TESTS.** 954 → 1007 is its 53 React cases across three new files; 58 → 61 is those
  three files. **The SERVER numbers did not move and were re-measured rather than carried** —
  this commit adds no server test, it only widens two existing fences.
  ⚠ **AND THE 53 WAS RECONCILED PER FILE, NOT ACCEPTED AS A TOTAL — WHICH IS THE ONLY REASON
  A FOURTH CONTRIBUTOR WAS FOUND.** The three new files hold 33 + 12 + 7 = **52**, and the
  gate reported **53**. The missing case is in `adminBranding.test.jsx`, which this commit
  never opened: that sweep WALKS `src/constants/` recursively rather than iterating a
  hand-maintained FILES list, so the new `fontManifest.mjs` was swept automatically, one case
  per file. **A total that looked one too high was the only signal, and a breakdown was the
  only thing that could explain it** — the previous entry records two arithmetic errors that
  cancelled and left the total agreeing.
  ⚠ **AND THE LOOP ARITHMETIC IS SHOWN BECAUSE A LINE COUNT STRUCTURALLY CANNOT SEE A LOOP.**
  `fontChain.test.jsx`: 19 `it(` lines, two inside loops emitting 8 each → 8 + 8 + 17 = 33.
  `fontFallbackIntegrity.test.js`: 6 `it(` lines, three inside a 3-role loop → 9 + 3 = 12.
  `fontLoader.test.jsx`: 7 lines, no loops → 7. ⚠ **Two `for` loops in those files sit INSIDE
  an `it()` body and emit no cases at all**; counting them as case-multipliers is the obvious
  way to get this wrong.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE ESCAPING-REPAIR COMMIT ITSELF,
  BECAUSE THAT COMMIT SHIPS TESTS.* It adds `server/test/campaignEmailEscaping.test.js`;
  1320 → 1339 is exactly its 19 cases and 210 → 212 is exactly its two `describe` blocks.
  Citing the parent would name a revision at which this figure was never true.
  ⚠ **AND THE 19 WAS COUNTED, NOT ESTIMATED — WITH THE LOOP ARITHMETIC SHOWN, BECAUSE A LINE
  COUNT STRUCTURALLY CANNOT SEE A LOOP.** `grep -c` reports **12** `it(` lines; three of them
  sit inside `for` loops emitting 4, 3 and 3 cases, and the other nine emit one each —
  4 + 3 + 3 + 9 = 19, which is what the runner reported. ⚠ **A FIRST PASS AT THIS ARITHMETIC
  SAID "11 `it(` lines" AND STILL REACHED 19**, because two errors cancelled. The total
  agreeing is not the check; the breakdown is.
  ⚠ **THE REACT HALF DID NOT MOVE, AND THAT IS NOT STALENESS.** This change adds no React
  test, so 954 / 58 is the same measurement re-observed — read by name off this run's own log.
  **A number that did not change still has to be measured to be re-armed.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS `ad3b6d7`, THE multer COMMIT — NOT THE LAST COMMIT OF THE ARC.*
  That commit adds `server/test/multerFieldArrayIndex.test.js` (13 cases), taking 1307 → 1320 and
  209 → 210. The three dependency commits after it moved **no** test, so the figure is true at all
  four — and naming the revision where it *became* true is the rule this line states.
  ⚠ **THE REACT HALF DID NOT MOVE, AND THAT IS NOT STALENESS.** 954 / 58 was re-measured on every
  one of the four gate runs rather than carried; a number that did not change still has to be
  measured to be re-armed.
  ⚠ **AND ON THE `vitest` COMMIT THE REACT FIGURE WAS CHECKED THREE WAYS, BECAUSE THE UPGRADE WAS
  THE INSTRUMENT ITSELF.** A runner that silently stops collecting a file reports smaller numbers
  and no reason. The runner's own report (58 / 954), a **case-level diff of every case NAME from a
  verbose run before and after** (954 lines each, zero differences), and a grep the runner cannot
  influence (58 files by `find`, 817 `it(`/`test(` lines by `grep -c`). ⚠ **817 is not 954 and is
  not meant to be** — the gap is cases emitted by loops, which a line count structurally cannot
  see. **A figure derived from the instrument cannot validate the instrument.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-12 PART B COMMIT ITSELF.* It adds
  `paletteBoostBar.test.jsx` (20 cases), and 934 → 954 is exactly those 20; the file count moves
  57 → 58. **BOTH HALVES MOVED THIS TIME**: three cases were added to `server/test/graphicFloor.test.js`
  for the partner-floored tokens, and 1304 → 1307 is exactly those three. ⚠ **THE SUITE COUNT DID
  NOT MOVE, AND THAT IS NOT A MISS** — the three landed inside an EXISTING `describe`, so they add
  cases without adding a suite. A file count and a suite count answer different questions.
  ⚠ **AND BOTH PREDICTIONS WERE COUNTED WITH `grep -c`, NOT ESTIMATED** — 20 `it(` lines in the
  React file, and 30 `test(` lines in `graphicFloor.test.js` of which one sits inside a loop that
  emits 3, so 30 + 2 = 32 cases from that file. The run reported 32.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-11 B2 COMMIT ITSELF.* It adds
  `palettePopupsB2.test.jsx` (28 cases), and 906 → 934 is exactly those 28; the file count moves
  56 → 57. The server figures did not move and were re-measured rather than carried.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-11 B1-FIX COMMIT ITSELF.* It adds four
  ground-fence cases to `server/test/graphicFloor.test.js` (1300 → 1304, suites 208 → 209) and two
  stringified-call cases to `themeKeyIntegrity.test.js` (904 → 906). **Both numbers moved this
  time**, which is the first time in the arc — the phase ships a server-side fence and a React one.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-11 B1 COMMIT ITSELF.* It adds
  `palettePopupsB1.test.jsx` (27 cases), and 877 → 904 is exactly those 27; the file count moves
  55 → 56 for the same reason. Server unchanged and re-measured, not carried.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-10 PART B COMMIT ITSELF.* It adds two cases to
  `paletteManageAccount.test.jsx` — the all-14-pairs fence and A.3's bank-status fence — taking that
  file 29 → 31 and the suite 875 → 877. The FILE count does not move: no new test file.
  ⚠ **AND THE CASE COUNT WAS COUNTED WITH `grep -c`, NOT ESTIMATED.** The two previous phases both
  predicted low (24 vs 29, 18 vs 23), and the prediction exists to catch a silent module-load
  failure — a wrong prediction that happens to be low looks identical to a suite that did not run.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-10 COMMIT ITSELF, BECAUSE THAT
  COMMIT SHIPS TESTS.* It adds `paletteManageAccount.test.jsx`, and 846 → 875 is exactly its 29
  cases; the file count moves 54 → 55 for the same reason. The server figures did not move and were
  re-measured rather than carried — same reasoning as the entry it replaces, quoted below.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-9 COMMIT ITSELF, BECAUSE THAT
  COMMIT SHIPS TESTS.* It adds `paletteMoneyBrandResponsive.test.jsx`, and 823 → 846 is exactly its
  23 cases; the file count moves 53 → 54 for the same reason.
  ⚠ **THE SERVER NUMBERS DID NOT MOVE, AND THAT IS NOT STALENESS — IT IS THE MIRROR OF THE
  PREVIOUS ENTRY.** Palette-8 Part C moved the server figures and left React still; this phase does
  the opposite. Both halves were read by name off this run's own log either way, because **a number
  that did not change still has to be measured to be re-armed.**
  ⚠ **THE PREVIOUS ENTRY, KEPT FOR ITS REASONING:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-8
  PART C COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.* It adds `server/test/graphicFloor.test.js`,
  and 1275 → 1300 is exactly its 25 cases.
  ⚠ **THE REACT NUMBERS DID NOT MOVE, AND THAT IS NOT STALENESS.** This phase added no React test,
  so 823 / 53 is the same measurement re-observed, not a figure carried forward unchecked — it was
  read by name off this run's own log. **A number that did not change still has to be measured to be
  re-armed**, which is the distinction the entry below draws between a docs-only pass and this one.
  ⚠ **AND THE PREVIOUS ENTRY, WHOSE REASONING IS UNCHANGED BECAUSE IT IS THE RULE AND NOT THE
  NUMBER:** *THE HEAD FOR THIS FIGURE IS THE PALETTE-6 COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS
  TESTS.* The gate was run against its working tree and the counts INCLUDE its own new cases, so
  citing the parent would name a revision at which this figure was never true. Same reasoning as
  the BR-1 Phase 1-B entry below, and the OPPOSITE of the docs-only entry below that — which is
  not a contradiction: **the rule is "name the revision at which the figure is true", and which
  commit that is depends on whether the pass added tests.**
  ⚠ **RE-ARMED BY THE NEXT PHASE FOUR TIMES RUNNING NOW, WHICH IS THE POINT.** Each previous
  figure was ONE commit old when it was replaced and already low — Palette-5 by 21 React tests,
  Palette-4c by 18, Palette-4b by 10, Palette-4a Part B by 23. **A figure re-armed every phase is never more than
  one phase wrong**, which is the whole difference from the six-commit drift below. **Re-arming when the number is one commit stale costs nothing; the six-commit
  drift it replaced took 41 server tests and 97 React tests to notice.** If you have just run the
  gate and read all four numbers, you are the session that should re-arm.
  ⚠ **AND THE FIGURE BEFORE THAT WAS FOUND SIX COMMITS STALE, WHICH WAS THE SIXTH INSTANCE.** It
  read 1234 / 191 / 654 / 43 at `f7dfeed` while the whole Palette arc had landed since. Nobody
  lowered it; it simply was not re-armed by the five phases that ran the gate in between.
  ⚠ **64 REACT FILES IS ABOVE THE "far above 40" TRIPWIRE BELOW AND WAS CHECKED RATHER THAN
  ASSUMED, RE-CHECKED 2026-09-15 BY PALETTE-15.** `vite.config.mjs`'s `test.include` is still
  `src/**/*.test.{js,jsx}`. The glob has not widened; the React suite has grown.
  ⚠ **AND THE COUNT WAS CONFIRMED BY AN INSTRUMENT VITEST CANNOT INFLUENCE.** A green run's
  default reporter prints **no per-file lines at all**, so "read what Vitest listed" has nothing
  to read on a passing gate — and the `✓ migration:` lines in the log belong to the SERVER suite,
  which is exactly the kind of thing a loose grep mistakes for one. `find src -name '*.test.js'
  -o -name '*.test.jsx'` returns **64**, matching Vitest's own 64, and a search for any test file
  outside `src/` and `server/test/` returns nothing. **A figure derived from the instrument cannot
  validate the instrument.**
  ⚠ **THE PREVIOUS ENTRY:** *58 REACT FILES … `vite.config.mjs`'s `test.include` is still
  `src/**/*.test.{js,jsx}`, and the ONE `server/test` string in the gate log is the `node --test`
  npm-script line, not a Vitest path.* ⚠ **Its stated check — "which paths did Vitest run" —
  cannot be performed on a green run**, which is why the independent count above replaces it
  rather than repeating it.
  ⚠ **THE PREVIOUS ENTRY:** *53 REACT FILES IS ABOVE THE "far above 40" TRIPWIRE BELOW AND WAS
  CHECKED RATHER THAN ASSUMED.*
  ⚠ **THE HEAD FOR THIS FIGURE IS `f7dfeed`, THE PARENT OF THE COMMIT RE-ARMING IT, AND THE REASONING IS THE OPPOSITE OF THE ENTRY BELOW RATHER THAN A CONTRADICTION OF IT.** This pass changed **only markdown** — no test file, no source file — so the working tree it was measured against differs from `f7dfeed` in nothing the gate can see, and 1234 / 191 / 654 / 43 is exactly what `f7dfeed`'s own commit body reported. **The figure is therefore true AT `f7dfeed`**, which is the test the rule below actually states: name the revision at which the figure is true. A docs-only commit that adds no tests is the one case where the parent is the honest citation, and saying so here is what stops the next reader "correcting" it back.
  ⚠ **THE PREVIOUS ENTRY, AND ITS WARNING, WHICH STILL GOVERN THE ORDINARY CASE.** It read **1182 / 186 / 628 / 41**, measured 2026-09-03 by BR-1 Phase 1-B, and said: *"THE HEAD FOR THIS FIGURE IS THE BR-1 PHASE 1-B COMMIT ITSELF — the child of `5a365e1` on `main`. The gate was run against 1-B's working tree, and the counts INCLUDE 1-B's own new tests, so citing the parent SHA would name a revision at which this figure was never true. Do not 'correct' it to `5a365e1`, and do not rewrite it to a later docs-only SHA either."* **That was right for that figure** — 1-B shipped tests, so only 1-B's own commit could carry it. ⚠ **It went stale in four commits anyway**, ending 52 server tests and 26 React tests below the truth, which is the fifth instance of the failure the paragraphs below enumerate.
  **The figures this line carried before, kept as the record of what it said rather than as live numbers:** 1182 / 186 / 628 / 41, measured 2026-09-03 by BR-1 Phase 1-B; 1160 / 183 / 557 / 40, measured 2026-09-01 at `a5dd574` (C/DL-3c Phase 3 Phase 0); and before that 1118 / 177 / 483 / 34, measured 2026-08-30 at `7252cc5` (Wave 1.1 close-out). ⚠ **A tripwire in this file has attracted a well-meaning edit twice**; one of them set it 171 tests below its own floor.
  ⚠ **AND THE `a5dd574` FIGURE WAS TWO SESSIONS STALE WHEN 1-B FOUND IT, WHICH IS THE FOURTH INSTANCE OF THE SAME STRUCTURAL FAILURE.** BR-1 Phase 1 measured 1180 / 186 / 625 / 41 and deliberately did NOT re-arm, reasoning that the line is documented as a shrink detector rather than a hand-maintained target. That reasoning is in the paragraph below and is correct as far as it goes — **but "do not maintain it as a target" is not "do not re-arm it when you have measured it", and reading the first as the second is exactly how a floor drifts 22 tests below the truth without anyone deciding to lower it.** If you have just run the gate and read all four numbers, you are the session that should re-arm.
  ⚠ **THIS TRIPWIRE HAS NOW BEEN FOUND BELOW ITS OWN FLOOR THREE TIMES, AND THE FAILURE IS STRUCTURAL RATHER THAN CARELESS.** It read *"947 server tests and 459 React tests across 31 files (measured 2026-08-21, HEAD `d0fb3aa`)"* — the figure `docs/GROUND_TRUTH_2026-08-21.md` established, correct on the day and never moved since; then 1118 / 177 / 483 / 34, likewise correct on its day. At 947 it could not fire until a fifth of the server suite was deleted; at 1118 it could not fire until 42 server tests were. **Each figure was true when written and went stale because a hand-maintained number sits in a document nobody edits when the thing it measures grows** — which is the worked example in *A mechanism that reports health it cannot observe* below. **When you find it stale, re-arm it with the figure you MEASURED and the HEAD you measured it at** — never an estimate, and never a number carried from a prior session's report. ⚠ Check the EXIT CODE, not the pass count — a suite can report passing while exiting 1. (Treat the numbers as a tripwire for an unexpectedly SHRINKING suite, not as a target to keep updated by hand. A Vitest file count far above 40 means the include glob has been widened and is picking up the server suite — see the warning above.)
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

**The shapes are enumerated below — ⚠ and this sentence deliberately does not say how many.**
They were found in C/DL-3b, in the Admin Brand Retirement build and its 6B pass, in Wave 1.1-g,
in C/DL-3c Phase 0 (the one predicted before it could ship) and in the Palette arc's font work.
**Every one that shipped was found by forcing the failure, not by reading.**

⚠ **THIS INTRO SAID "SIX … A SEVENTH … AN EIGHTH" ABOVE A LIST OF NINE UNTIL 2026-08-30, THEN
"TEN" ABOVE A LIST OF TEN UNTIL 2026-09-15**, when an eleventh was appended. Each correction
replaced one hand-maintained number with the next. ⚠ **THE NUMBER IS NOW GONE RATHER THAN
UPDATED, AND THAT IS DELIBERATE — DO NOT PUT ONE BACK.** This file's own conclusion, reached
after four self-referential miscounts, is *"do not put a count in a heading or a lead sentence at
all"* when the thing it counts is a list directly beneath it: there is no mechanism that updates
it, and even a reader actively cataloguing this defect bumps the number rather than deleting it.
Same failure as this file's test-count tripwire and `PRE_LAUNCH_CHECKLIST.md`'s *"FIVE items"*
above a list of six.

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

11. **A NEGATIVE CASE THAT IS VACUOUS *BECAUSE IT MIRRORS THE DEFECT*.** Found while fixing the
    font loader, and it is the sharpest of the family because the assertion is about the right
    subject and still cannot fail. A draft test asserted *"an off-allowlist font value falls back
    to the platform default."* It passed. ⚠ **IT PASSED AGAINST THE BROKEN LOADER TOO — BECAUSE A
    COLUMN NOBODY READS ALSO PRODUCES THE DEFAULT.** The fallback is the observable for both "the
    value was rejected" and "the value never arrived", so the two states are indistinguishable by
    it.
    ⚠ **DISTINCT FROM #10, AND THE DISTINCTION DECIDES THE FIX.** #10 is a context default making
    a missing PROVIDER invisible; this is a validator's own fallback making a missing SUPPLY
    invisible. #10's repair is a flag-ON sibling on the same mount; this one's is upstream.
    **THE RULE: pair every negative case with a STORED-VALUE POSITIVE on the same path.** Without
    the pair it passes against a build that ignores the column entirely — which is exactly what
    shipped. The pairing took both allowlist cases from green to RED before the fix, **which is
    the proof they had been passing for the wrong reason.**
    ⚠ **AND A SECOND INSTANCE IN THE SAME FAMILY, WHERE THE MECHANISM WAS THE HARNESS RATHER THAN
    THE ASSERTION.** A fence asserting a hostile sentinel is **ABSENT** from a rendered page
    passed **twice** against writes that never happened — once on a SQL syntax error from
    interpolating the payload, once on an unresolvable `pg` import. Both left the column
    unchanged, and *"the sentinel is absent"* read like a pass each time. **Fixed by
    parameterising the write and READING THE COLUMN BACK before trusting the page.** ⚠ **An
    absence assertion must first prove the presence it is asserting the absence of.**

12. **A FIXTURE SEEDED WITH THE VALUE A BROKEN READ ALSO PRODUCES.** Found in Canvass-stage,
    before it shipped, and it is the *wiring* counterpart to #10 and #11 — there a default hid a
    missing provider and a missing supply; here the DEFAULT VERDICT of a pure function hides that
    the function was handed the wrong shape entirely.
    `classifyPipelineStatus` reads the GraphQL **connection** shape — `client.jobs?.nodes`,
    `client.quotes?.nodes`, `job.invoices?.nodes`. The object every caller has nearest to hand is
    the **flattened** one built for `deriveAndSaveTags`, which needs the exact opposite. Hand it
    the flattened object and `undefined?.nodes || []` yields empty arrays for jobs AND quotes —
    which is the classifier's first branch, so it returns **`'lead'`**. No throw, no warning.
    ⚠ **THE CONSEQUENCE IS WHAT MAKES IT WORTH A NUMBER: the column fills with a plausible verdict
    for the ENTIRE book and the dependent stat sits at zero forever, reading as a business fact
    rather than a bug.** *"Most of our clients are leads and conversions are slow"* is a sentence
    a contractor would simply accept.
    ⚠ **AND A `'lead'` FIXTURE PASSES AGAINST IT.** Seeding the state that happens to equal the
    default makes correct wiring and no wiring indistinguishable — the vacuity is in the FIXTURE,
    not in the assertion, which is why reading the test tells you nothing.
    **THE RULE: seed the state FURTHEST from the function's default, and prefer one that can only
    be reached by traversing the whole structure.** Here that is a client with a job AND a paid
    invoice, since `'paid'` requires walking `jobs.nodes` and then `invoices.nodes`. Proven: the
    flattened shape injected into the writer took all seven cases RED, every one reporting
    `actual: 'lead'`. ⚠ **More generally — when two consumers of one fetch need opposite shapes,
    say so at both sites**; the shapes are individually correct and the mismatch is invisible.

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

### Sweeps have independent gaps, and the widest one is the scope nobody wrote down

- **Formatting, not values.** `770-277-4869` and `7702774869` are the same number and do not
  match. **Normalise before comparing** — strip non-digits for phones; strip scheme, `www.`
  and trailing slash for URLs. A `tel:` href dialled the wrong company through a sweep that
  reported clean.
- **The hand-maintained FILES list — NOT FIXED.** Every sweep iterates a list someone typed.
  New files are invisible until remembered, and **nothing announces the omission**. A clean
  sweep is evidence about the listed files only. Prefer walking a directory tree.
- ⚠ **THE UNSTATED SCOPE, AND IT IS THE ONE THAT SHIPPED THREE DEFECTS: A NEGATIVE FINDING IS
  ONLY AS WIDE AS THE SCOPE IT NAMES.** Eleven consecutive phases reported *"zero retired
  tones"*. **Every one of those sweeps was scoped to the referrer tree, every report was TRUE,
  and three live reaches sat one directory along the whole time.** Each was found by a different
  accident, none by a sweep:
  - **`App.jsx`'s focus ring** — `outline: 2px solid #012854`, the retired contractor navy on
    **every focus ring across three trees**, injected from inside a **template string** in a
    file that belongs to none of the trees the sentence counted.
  - **`ErrorBoundary`'s crash-screen button** — `#CC0000`, one tenant's retired red, **under an
    exception that was sound.** The exception was granted for the MECHANISM (the tree has
    crashed, possibly outside the provider, so a literal is the honest choice) and **the VALUE
    was never re-run when the palette was retired.** ⚠ ***"Use a literal" never meant "use that
    contractor's literal."*** It is in `shared/`, so the referrer-scoped sweeps could not see it.
  - **`SignupScreen` and `EmailVerifyScreen`** — **46 colour keys and 25 retired reaches**,
    never colour-migrated at all while their five auth siblings were. Missed for eleven phases,
    on the signup and email-verification path: the first two screens a contractor's first
    referrer ever sees. ⚠ **Not residue — an entire unmigrated surface**, which is a different
    thing from leftovers and must not be filed as one.

  ⚠ **AND A FOURTH WAS FOUND BY THE ARC'S OWN CLOSE-OUT, STILL LIVE, IN THE SAME BLIND SPOT** —
  `ContactModal` reading a shadow key whose VALUE is the retired navy. It is in `shared/` (the
  scope gap) **and** it travels the non-colour-key route (the needle gap), so **two independent
  blind spots had to close for it to be visible, and neither did.** Filed on
  `PRE_LAUNCH_CHECKLIST.md`; not counted in the three above, because those are closed and it is
  not.

  **THE RULE: state the scope BESIDE the claim, in the same sentence, every time.** *"Zero
  retired tones in `src/components/referrer/`"* is a finding. *"Zero retired tones"* is the same
  measurement written so that it will be read as covering everything, by a reader who has no way
  to tell. ⚠ **The sweep was never wrong. The sentence was**, and a true sentence is the hardest
  kind of claim to catch — nothing about it invites checking.

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

⚠ **AND THE SAME FAILURE WITH THE SIGN FLIPPED: A MECHANISM THAT REPORTS A LIMITATION IT NEVER
DIAGNOSED. A RECORDED LIMITATION IS A CLAIM, AND IT NEEDS A SOURCE LIKE ANY OTHER NUMBER.**

`scripts/paletteHarness.js` opened with *"Screenshot capture is unusable in this environment:
reproduced against a white page with black text — the capture returned a uniformly near-black
frame AND REPORTED SUCCESS."* ⚠ **THE OBSERVATION WAS ACCURATE AND REPRODUCES TODAY. THE
DIAGNOSIS WAS WRONG, AND IT WAS CARRIED IN FIVE CONSECUTIVE PHASE BRIEFS.** The cause is a
**screen-dimming browser extension**: it injects a `<screen-shader>` element as a direct child
of `<html>` which paints a full-viewport `div` at `rgb(17,17,17)`, `opacity: 1`,
`z-index: 2147483645` — the maximum. **The capture pipeline was working the whole time and
faithfully photographing an opaque overlay.** Hide any full-viewport `div` whose `z-index`
exceeds 2,000,000,000, then capture; it is per-tab and reversible. The accompanying claim in the
same briefs — that `innerWidth` / `outerWidth` / `screen.width` are all zero — **is also false,
measured 2560.** Both halves of a standing caveat were wrong, and a session that inherits it
skips a check it could actually run.

⚠ **THE COST: a whole arc concluded "say the numbers instead of looking", and a font question
that one photograph settled in one look stayed open for five phases.** Each phase re-ran the
observation and inherited the conclusion. **Re-running an observation is not re-deriving a
diagnosis.**

⚠ **AND THE EVIDENCE WAS ALREADY SITTING IN A REPORT.** An earlier phase's paint sweep listed
`html` at `rgb(17, 17, 17)` and a `<screen-shader>` element, **and filtered both out as browser
chrome.** The value in that reading and the value of the black frames are the same number.
**THE RULE: a value filtered as noise in one investigation is evidence in another.** When a
sweep discards something as chrome, it is discarding it for THAT question only — say what was
filtered, so the next question can look at it.

⚠ **AND ONE MEASUREMENT, TAKEN ONCE, IS NOT A DIAGNOSIS.** The zero-viewport reading was real
and transient, and it became a premise **four phases carried without re-testing**. A transient
reading promoted to a standing environment fact is indistinguishable from a permanent one, and
nothing about it announces which it was.

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
- ⚠ **A HEREDOC CAN CONSUME THE ESCAPE, AND THE SWEEP STILL RETURNS ORDERED,
  FILE-ATTRIBUTED, ENTIRELY WRONG FINDINGS.** Measured in the R/AD Phase 0: `\.` written
  inside a heredoc reached the script as `.`, so the needle `R\.` became *"R followed by any
  character"* and returned **80** hits — plausible, sorted, each with a real file and a real
  line. **The true count was 7.** `R.fer` came from the word *"Refer"*.
  ⚠ **AND IT IS NOT ONLY THE QUOTED-HEREDOC FORM THAT IS SAFE OR UNSAFE BY RULE — CHECK THE
  BYTES THAT ARRIVED.** A `<<'EOF'` heredoc in this session still lost one level of
  backslash before the shell saw it, turning `.split('\\')` into an unterminated regex; that
  one raised a `SyntaxError`, which is the lucky variant. **The unlucky variant is the one
  above: no error, and a number.**
  **THE RULE: a sweep returning far more or far fewer results than expected is a TOOL REPORT,
  not a finding, until the pattern has been validated against a case whose answer is already
  known.** Know the expected answer before you run it — the same discipline the `^` case
  above was caught by.
- ⚠ **`git grep` SEES TRACKED FILES ONLY, AND THIS REPO KEEPS ITS REPORTS UNTRACKED AT ROOT
  AS A STANDING PATTERN.** The R/AD Phase 0 report claimed amendment `A31` free and said so
  in terms — *"verified, not assumed"* — having verified it with `git grep`, **while being an
  untracked file itself.** A tracked-only search structurally cannot see a reservation made
  in an untracked file, including the one making the claim.
  **THE RULE: if the thing you are checking for could live in an untracked file — a
  reservation, a handoff, a Phase 0 report — `git grep` is not the check. Search the working
  tree as well, and say which of the two you ran.**
- ⚠ **A TEST DOUBLE THAT CAN RETURN A "NO ANSWER" SHAPE WILL SATISFY EVERY TEST ASSERTING AN
  ABSENCE.** Not a shell, same family. In BR-1 Phase 1-B three fixtures returned a bare theme
  where the code expected a `{ branding, slug }` envelope; the provider read the bare object
  as a **non-answer**, published neutral branding, and nothing anywhere raised. The suite
  stayed green because the assertions were about what should NOT be there.
  **THE RULE: make a double THROW on a shape it does not recognise rather than returning
  something plausible.** A double's job is to stand in for one contract; the moment it can
  also stand in for "no contract", it is indistinguishable from the failure. **This caught
  real defects three times in the BR arc**, which is why it is a rule and not an anecdote.
  Same shape as `getStripeRow()`'s `|| { … not_connected }` under *Two rules about defaults*.
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

### A check can only see the defect it was built to look for, and the gap is where the next one lives

⚠ **THE HEADLINE FINDING OF THE PALETTE ARC: FOUR INDEPENDENT CHECKS PASSED ON FIVE ICONS
RENDERING BLACK, AND EACH ONE PASSED FOR A CORRECT REASON.** `ExperiencePopup` held
`const AMBER = "statusVar('warning')"` — a string containing the TEXT of a call, not the
call. Phosphor received a value that is not a CSS colour and fell back to black.

| check | why it passed |
|---|---|
| the retired-tone sweep | no retired tone was present, and none was |
| the R-key sweep | no `R.` read was present, and none was |
| the arithmetic | it measures TOKENS, never what the element received |
| the graphic-floor checker | **black on white is 21:1** |

⚠ **THE GAP NONE OF THEM COVERS IS WHETHER THE VALUE REACHING THE ELEMENT IS A COLOUR AT
ALL.** Every one of them assumes a colour is present and measures its properties.
⚠ **A CHECKER CANNOT SEE A DEFECT WHOSE SYMPTOM IS HIGH CONTRAST.** Only a reading taken at
the rendered node found it, as `fill: rgb(0,0,0)`.

**A fence now catches the class**, in `themeKeyIntegrity`, anchored on ASSIGNMENT position —
`[=:]` then a quote then `<word>Var(`. ⚠ **EXEMPTING TEST FILES WAS REJECTED AS THE FIX.** The
first draft matched any quoted call and fired on 26 legitimate test needles like
`.toContain("statusVar('successText')")`; the anchor separates a VALUE from a NEEDLE with no
carve-out, because **a fence that stops reading the files an idiom gets copied from has a hole
in it.**

⚠ **THE SECOND INSTANCE IS THE SAME SHAPE ONE LAYER UP, AND IT LEFT AN ENTIRE ARC INERT.**
`loadContractorBranding()` — the ONE loader behind the landing page, `GET /api/branding/:slug`,
`GET /api/session/branding`, `GET /api/admin/me` and `GET /api/invite/:slug` — **named neither
font column in its SELECT.** The resolver read `src.font_heading`, the loader supplied
`undefined`, `resolveFont()` returned the platform default, and **no contractor's chosen fonts
could reach any surface.** Three commits of work sat behind a query that never asked: the
resolver, the allowlist, the per-family generics, 25 declared faces and 313 migrated painters.

⚠ **AND THE SERIF TEST PASSED, WHICH IS THE PART WORTH KEEPING.** `fontChain.test.jsx` hands a
row straight to the resolver via `row({ font_heading: 'Playfair Display' })`. **That is the
correct unit test for the resolver's own contract — still valid, still green, never wrong.** The
gap was not a bad assertion. It was that **no test existed at the layer ABOVE.**

**THE RULE: A TEST THAT INJECTS THE VALUE ITSELF CANNOT DISCOVER THAT NOTHING UPSTREAM SUPPLIES
IT. Assert at the boundary that actually supplies the value.** Practically: for any resolved
value, one test must source it from the real producer — a real row through the real query — and
a double that returns whatever the test handed it does not count, because it would not exercise
the SELECT at all and would stay green against the broken loader.

⚠ **THE CLOSURE HALF IS WHAT MAKES IT A FIX RATHER THAN A REPAIR.** The defect was never *"the
fonts were forgotten"*; it was *"nothing checks the loader against the resolver"*, and a second
missing column would have had the identical symptom — a value that resolves to its default for
everyone and looks correct on the platform brand. Every `src.<col>` the resolver reads is now
differenced against the loader's SELECT and that difference is a permanent fence, so the next
missing column fails there instead of shipping. **The audit found 26 of 28 supplied, and the
fonts were the only gap** — asked mechanically, because "if fonts were missing, what else is?"
is not answerable by reading either list by eye.

### Measure composited, on the rendered node — never at the declaration

**Three shapes, all CORRECT AT THE DECLARATION, all wrong where they landed, all passing every
test that existed.**

- ⚠ **OPACITY INHERITS; COLOUR DOES NOT.** `opacity: MUTED` on a paragraph muted a money span
  nested inside it — **3.29:1 on a payout figure, live for two phases.** Every element's own
  declaration was right.
- ⚠ **A GROUND CAN MOVE UNDER AN ELEMENT, AND THIS WAS CAUGHT IN FOUR CONSECUTIVE PHASES.**
  Palette-4b took an icon from 3.00 to 2.55 by moving what it sat on, in a phase whose subject
  was contrast. Then twice more at **2.68 and 2.89**, and again at **2.68** — every one
  `--rm-primary` (floored against `surface`) used on `--rm-recess`.
  ⚠ **A TOKEN FLOORED AGAINST ONE GROUND IS NOT SAFE ON ANOTHER**, and **modals change grounds
  by construction** — one had two grounds in a single sheet.
- ⚠ **TEXT ON A GRADIENT CLEARS THE DARKER STOP, NOT THE BASE.** Arithmetic against the base
  approved 4.67–5.48 where the real figure was **3.54–4.14**.

⚠ **THE COMMON PROPERTY: a declaration is a claim about a token; only the rendered tree says
what is behind it.** Which is why the ground fence lives in the harness rather than in a sweep.

### Two guards agreeing is not evidence when they share a precondition

⚠ **STABILITY SAID A SURFACE WAS STABLE AT 6 READINGS AND COVERAGE SAID IT WAS 1/1 COVERED.
BOTH WERE TRUE AND BOTH WERE READING AN UNRENDERED PAGE** — unrevealed content sits at
effective alpha 0, so it left the coverage denominator entirely. The page had not finished
rendering and nothing in either guard could say so.

*(Same family as the five guards fed by one broken parse, recorded above. The test is not
whether guards agree; it is whether they could disagree.)*

### One instrument in three hats is one instrument, and three methods agreeing can all be wrong

**The two rules above are about GUARDS sharing an input or a precondition. This is the same
failure one level down: three METHODS that share whatever the fault is.**

Width measurement said a landing-page `h1` rendered approximately Georgia rather than the
contractor's Playfair Display. It was measured three independent-looking ways — a DOM clone with
`nowrap`, a `Range` over the real element, and canvas `measureText` — **and all three agreed.**

⚠ **THE TELL WAS AN IMPOSSIBLE ANSWER, NOT A DISAGREEMENT.** The same instrument reported that
`"Lato", sans-serif` renders **WIDER** than `"Lato"` alone. **A font list cannot be beaten by its
own second entry.** Three methods producing one incoherent result are not three checks; they are
one check wearing three hats.

⚠ **THE RESOLUTION WAS A DIFFERENT KIND OF INSTRUMENT, AND IT TOOK ONE LOOK.** A screenshot
settled it: the face paints, exactly as the stack is written, and **every width-based font claim
in the arc is retired.** The `document.fonts` load status — which had said `loaded` throughout —
was right the whole time.

⚠ **AND THE RESTRAINT WAS VINDICATED, WHICH IS THE PART TO COPY.** The measurement indicated
dropping a family from a font stack. **Production code was not adjusted**, on the grounds that
this would be fitting the code to an instrument already shown to be unreliable — which the
characterization rule forbids. Had it been "fixed", the repair would have damaged a stack that
was already correct, under a commit message saying a defect was closed.

⚠ **THE FINGERPRINT PREDATED THE PHASE AND HAD BEEN RECORDED AS A PROPERTY.** The same
instrument put a loaded webfont and the generic default **0.35px apart**, which was written down
as *"the discriminator separates nothing"*. **It was not a property of the discriminator; it was
the symptom.** When a measurement cannot tell two states apart, that is a claim about the
measurement until something else confirms it.

### If readings do not vary across conditions that should differ, suspect the reader

**The recorded variants — ⚠ and the last of them is not a reader fault at all, which is why the
list is worth reading to the end rather than pattern-matching on the heading.**

- A **backgrounded tab** whose opacity transition never ticked: the inline style said `1` and
  the computed style said `0`. ⚠ **The colour form of this is worse**: a backgrounded tab returns
  each colour transition's **START** value, which on a repainted surface is the pre-repaint
  platform neutral — **byte-identical to the `var()` fallback**. Five icons read as `fallback`
  with the property demonstrably mounted, and **no colour comparison could ever have separated
  the two.** Proven a reader fault rather than assumed: probes injected into the same parent with
  the same declaration resolved correctly, and killing the transition snapped the real icon to
  the mounted value. **Suppress transitions before every sweep.**
- A **memoised `getComputedStyle`** serving stale values across five brand/mode combinations —
  every combo returned an identical reading while the host carried different variables.
- ⚠ **A PROBE MOUNTED WITHOUT ITS REAL ANCESTOR CHAIN, AND IT LOOKED EXACTLY LIKE THE PREDICTED
  DEFECT.** A component mounted bare reported `-apple-system` on its `font: inherit` buttons —
  the body stack, not the contractor's face — which was precisely the defect that phase was
  looking for. It was an artifact: the probe had no ancestor declaring a family. Re-run inside a
  real `Screen`, all four resolved correctly. ⚠ **A reader fault that CONFIRMS your hypothesis is
  the one you will not question.**
- ⚠ **A PROBE'S OWN SPAN CAUSED A FACE TO APPEAR ON A PAGE THAT DOES NOT USE IT.** The
  measurement created a USED family, the browser fetched the face, and the fetch set — the very
  evidence that separates a painted face from a declared one — was the thing the probe changed.
  **A reader that writes to the DOM is part of the system under measurement.**
- ⚠ **A CONTAMINATED `rm_brand_hint` FROM THE SESSION'S OWN EARLIER `?brand=` VISIT.** A "no
  brand parameter" read resolved a contractor from source 3 of the D4 chain, because an earlier
  visit in the same browser had written the hint. **Clear persisted state and re-read cold before
  recording any negative result about resolution.**
- ⚠ **AND THE LAST: THE CONTRACTOR COULD NOT MAKE THEM VARY.** The local stack's first
  contractor was seeded with the PLATFORM DEFAULT PALETTE, so **all six render tokens mount
  EQUAL to their fallbacks on it** and a correct wiring is indistinguishable from a broken one.
  ⚠ **THAT IS THE ACCENT PROBLEM REPRODUCED INSIDE OUR OWN FIXTURE**, and the seeder had been
  placing every popup row on exactly that contractor.
  **THE RULE: verify on a contractor whose palette DIFFERS from the platform default — in the
  LOCAL STACK as well as in production.**

⚠ **AND ONE CONDITION TO CONTROL FOR THAT IS NOT A DIAGNOSIS AND MUST NOT BE WRITTEN UP AS ONE:
THE BROWSER MAY BE IN USE BY A PERSON WHILE A SESSION READS FROM IT.** Danny's observation, and
it would account for the backgrounded-tab stall above — a tab only backgrounds when something
else takes focus. **Recorded as a question to ask, not as a cause that was established.** If a
reading looks wrong in a way that smells like the reader, ask whether the browser was contended
**before** concluding an environment limitation. That is the question nobody asked for the five
phases recorded in the entry below.

### Validate every needle against known answers, in BOTH directions

**It must find the defect AND spare the legitimate idiom. The measured failures, each checkable
— ⚠ and deliberately not totalled in this sentence, per the heading rule below:**

- a **heredoc consuming `\.`** — 80 plausible, file-attributed findings; the true count was **7**
- **`git grep` sees tracked files only**, and it was run from an untracked file to decide
  whether an identifier was free
- a **bare substring** deciding `A32` was taken, when every hit was the hex colour `#A32D2D`
- a **proximity grep** reporting "on a fill" for elements merely NEAR one
- ⚠ **`${…}` matching every interpolation** — in JSX TEXT it renders a literal `$`, inside
  BACKTICKS it interpolates. **Same three characters, opposite meanings.**
- ⚠ **`\p{Emoji_Component}` INCLUDES THE ASCII DIGITS.** `"500"` and `"1"` were exempted as
  pictographic **by a checker built to catch contrast defects on money figures.** A false
  NEGATIVE in a checker is worse than the defect it hides, because it reports health it never
  observed.
- a **prefix substitution** truncating three lines into invalid JavaScript
- ⚠ **A `\bFROM\b` NEEDLE MATCHED THE WORD "from" IN A SQL COMMENT.** A non-greedy
  `/SELECT(.*?)\bFROM\b/i` run over `loadContractorBranding()` matched the prose *"the resolver
  derives one from the other"*, truncated the capture immediately before a real column, and
  **reported a SUPPLIED column as absent** — a confident, file-attributed, entirely wrong
  "missing column" finding, in an audit whose whole purpose was finding missing columns.
  Comments are stripped before the `FROM` is located now, with the regression fixture in the
  test. ⚠ **This is the scans-read-comments rule below with the sign flipped: there prose
  MATCHES a forbidden pattern, here prose IS the delimiter the parse depends on.**
- ⚠ **A BIG/BOLD HEURISTIC READ `fontSize` FROM NEIGHBOURING LINES.** Reading a window instead of
  the line produced **21 false flags** in the 313-site font migration; checking each line's OWN
  size cleared all 21. **A heuristic that reports plausible findings is worse than none** —
  every one of them costs a verification, and a real finding hides among them.
- ⚠ **A STYLESHEET SWEEP MATCHED ITS OWN TEST FILE.** It walks all of `src/` **including
  itself**, so a needle spelled out in full made the test file the offender, and the first run
  reported `bodyDefaults.test.jsx` as importing a stylesheet. Fixtures are assembled from pieces
  now. **Reword, never exempt** — per the rule below.
- ⚠ **`grep -oh … | grep -v test` CANNOT FILTER BY FILENAME, BECAUSE `-oh` DISCARDS IT.**
  Matches-only output carries no path, so the second `grep` filters the MATCH TEXT and nothing
  else. It reported **4** font-key reads in the four migrated trees where there are **0**.
  ⚠ **A filter that silently filters nothing returns a number with no error attached** — the
  shell-harness class arriving through a pipeline rather than through quoting.

⚠ **AND THE THIRD ROUTE A VALUE TRAVELS.** A retired tone reaches code as a HEX, as a DECIMAL
`rgba()`, **and through a key whose VALUE is the tone**. A gear icon reached `#012854` via
`R.navy` and the hex needle found zero. Measured at the close of the arc: of 45 retired-tone
reaches in `src/`, the hex needle sees **23** — a bare majority, and it saw **none** of a
twelve-instance class in one phase.

⚠ **AND A FOURTH ROUTE, WHICH NONE OF THE THREE NEEDLES COUNTS: THE TONE INSIDE A NON-COLOUR
KEY.** `R.shadowLg` is `"0 8px 32px rgba(1,40,84,0.13)"` — the retired navy as three DECIMAL
channels inside a **shadow**. Not a hex, not a colour key, not an `R.`-keyed *colour* read: it
passes the hex needle, the decimal needle scoped to colour properties, and the key needle
alike. The auth migration found it only by reading the key's VALUE rather than its name, and
the true reach for those two screens was **25, not the 22 all three needles agreed on**.
**When a needle set agrees, ask what kind of container it cannot open.**

### Scans read test files and comments, so prose describing a forbidden pattern IS the pattern

⚠ **FOUR PHASES RUNNING, AND IT ESCALATES.** In one phase a fence reported **itself three
times** — the assertion, the comment explaining the assertion, then the comment explaining
THAT. In another, a guard-proof fixture had to be **assembled from pieces** (`'R' + '.' +
'cardBg'`) because written plainly it WAS the defect. The JSX comment inside `cond && ( … )`
cost four phases and was then **reproduced inside the comment describing it.**

⚠ **THE RULE IS REWORD, NEVER EXEMPT.** To describe a forbidden pattern without matching it:
name the parts without the connector (*"the keys `cardBg` and `accent`"*, never the dotted
form), say the shape in words (*"a JSX comment block cannot be the first child"*), or build the
fixture from concatenated pieces. **A comments-are-exempt carve-out removes the scan's reach
into exactly the text a future reader copies from.**

### Predict the test count, and COUNT it — an estimate cannot do this job

⚠ **THE PREDICTION EXISTS TO CATCH A SILENT MODULE-LOAD FAILURE**, where a file throws while
being imported and contributes nothing to either column. **A wrong prediction that happens to
be LOW looks identical to a suite that did not run.**

**Two estimate-instead-of-count failures before `grep -c` settled it** — 24 predicted against
29, and 18 against 23. Both were low; neither was a typo; both were arithmetic done in the head
about a file already written. **Count the `it(`/`test(` lines, and remember a loop emits cases
a line count cannot see.**

### Fix a timing flake at its cause, not at its threshold

**Three instances, none resolved by raising a number.**

- A **dynamic `await import()` inside a test body** is charged against the per-test timeout. A
  case failed at 5.2s under full-suite load and passed in isolation — **which reads exactly
  like a flake and is not one.** Hoisted to a static import; the cost lands at module load.
- **Contention from suite growth**, 49 files to 57. A case reached 44s against a 20000ms
  allowance while its **isolated cost was unchanged at 2.41s.** The imports were hoisted and
  the bespoke timeout **REMOVED, not raised** — its own comment had said a second timeout meant
  "a real change in the component, investigate rather than re-raise", and the investigation
  showed the cost had not moved.
- One case does carry an explicit timeout, and it was **DERIVED FROM MEASUREMENT** rather than
  guessed.

⚠ **RAISING A THRESHOLD TWICE IS FITTING THE CHECK TO THE FAILURE.** The second raise is the
tell.

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

### Sweep for the SHAPE, not the NAME — a name can claim a property it lacks

**Two opposite disguises, one class, both measured in the same arc.**

- ⚠ **IT HID BY *NOT* HAVING THE CANONICAL NAME.** `buildEmailHtml()`'s local escaper was called
  `esc`, covered three characters (`& < >`) where the sanctioned `escapeHtml()` covers five, and
  its output landed inside double-quoted `style` and `alt` attributes — a stored font name
  carrying a `"` closed the attribute and injected new ones. **Three separate enumerations each
  listed SIX local escapers and each searched for the name `escapeHtml`** —
  `escapeHtmlExport.test.js`, `PRE_LAUNCH_CHECKLIST.md`, and ground truth §C5. A sweep for the
  **replace CHAIN** finds **eight**, and the invisible one was the weakest of all eight.
- ⚠ **AND IT HID BY *HAVING* THE NAME.** `pendingReferral.js` carried
  `const safeLogoUrl = escapeHtml(logoUrl || '')` — escaping only, **no scheme check** —
  interpolated into **three** `<img src>`. **The name asserted the property, so every call site
  read as solved**, and a sweep for the name would have found it and passed it.

**THE RULE: sweep for the SHAPE — a value inside a URL attribute, a replace chain, an assignment
position — not for the identifier.** The shape sweep that found the second one covered **45**
URL-attribute sites across 11 files in `server/`; the other 42 were system-generated, constant,
or already checked, which is a result a name sweep cannot produce at all.

*(Same family as* **A name-based search cannot find a name that is never written down**
*directly above: there the name is never written down, here it is written differently or written
honestly-but-falsely. In all three the identifier is the wrong thing to search for.)*

### Escaping and scheme-checking are different controls, and one does not imply the other

**Escaping answers whether a value can break OUT of an attribute. ⚠ IT SAYS NOTHING ABOUT
WHETHER THE VALUE, SITTING ENTIRELY INSIDE THE ATTRIBUTE, IS EXECUTABLE.**

Nothing in `javascript:alert(1)` needs escaping, so an escaped hostile scheme lands in
`src=`/`href=` perfectly intact and is still a link that runs code. **Two commits, one lesson:**
the first replaced a weak local escaper and closed every attribute-BREAKOUT site in the campaign
email, deliberately leaving the URL attributes; that gap was real and had to be closed separately
by `safeLogoUrl` / `safeWebsiteUrl` (`server/utils/safeUrl.js`).

⚠ **THIS IS NOT DEFENCE IN DEPTH — IT IS A DIFFERENT CONTROL FOR A DIFFERENT HOLE**, and reading
it as the former is exactly how the second one gets skipped. ⚠ **AND AN HTTP `Location` IS A
THIRD CONTEXT AGAIN**: the tracking route's `res.redirect(cta_url)` is not an HTML attribute, is
closed by neither control, and is filed separately rather than assumed covered.

### A needle that is a substring of a longer real name passes against the wrong line

Checking the canary annotation on `Screen.jsx` with the needle `Screen.jsx` matched
**`AdminSetPasswordScreen.jsx`** — a real file, a real annotation, and entirely the wrong
one. The check reported success against a line nobody was asking about. **Anchor a
verification on the full line, or on a token that cannot be a substring of a sibling**
(here, the tree connector: `/(├|└)── Screen\.jsx/`). This is the `toContain`-on-a-bare-value
trap in a different costume — the assertion's edge lands exactly where the ambiguity lives.

⚠ **AND THE SAME TRAP DECIDES WHETHER AN IDENTIFIER IS FREE, WHICH IS A CLAIM PEOPLE ACT ON.**
Measured in BR-2 Phase 2, checking that amendment number `A32` was unclaimed:
`git grep "A32"` returned hits and **every one of them was the hex colour `#A32D2D`**.
`\bA32\b` returned zero. A bare substring answers *"do these three characters occur?"*; the
question asked was *"is this TOKEN taken?"*, and the two differ by exactly the case that makes
the answer wrong. **When a search decides whether a name, a number or a slot is free, anchor on
word boundaries** — and read the hits rather than the count, because a hex colour, a version
string and a test fixture all look like a reservation from a distance.

⚠ **AND IT IS NOT ONLY ASSERTIONS AND GREPS — IT IS TEST QUERIES.** Same phase, same shape, in
`getByText`: `/Great/i` matched **two** nodes because the intro copy carried *"great work"*
beside a *"Great experience"* button, and `getByText` throws on multiple matches, so the test
fails for a reason that has nothing to do with the behaviour under test. It recurred in BR-2
Phase 3 when two helper texts ended with the same sentence — **and one of the two was written
in that same commit.**
**THE RULE: anchor a query on the full string or on rendered structure (a role, a label, a test
id), never on a distinctive-sounding fragment. And re-check the queries near copy you ADD**, not
only near copy you change — adding a second match breaks a query that was correct, and the
diff shows only the addition.

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
Secondary, BG, Surface, Text) map onto `--rm-primary`, `--rm-secondary`,
`--rm-bg`, `--rm-surface` and `--rm-text`, and a sixth DERIVED token,
`--rm-on-primary`, has no swatch at all.
⚠ **TWO OF THE FIVE ARE DERIVED, NOT STORED, AND THAT IS THE REAL
CONSTRAINT.** The branding resolver stores four colours; `surface` and
`text` are computed from them under a WCAG contrast floor. **So a
contractor cannot set either, and a value read off a PNG for either can
never be reproduced** — the engine computes its own and nudges it until it
passes. Specific colours read off a PNG are approximations, never
authority.
⚠ **THIS PARAGRAPH CLAIMED THE OPPOSITE FOR ONE DAY, AND IT IS LEFT
RECORDED RATHER THAN QUIETLY REPAIRED.** It read *"`surface` and `text`
have no token today. Two of the five roles have nothing to map onto"*,
citing amendment A20 — and that was **false at HEAD when written**:
`RENDER_TOKEN_KEYS` in `src/utils/themeTokens.mjs` has carried both since
before this section existed, and `ThemeProvider` mounts one property per
key. **A20's real subject is the RESOLVER's stored set, not the mounted
token set**, and the two were conflated. Corrected 2026-09-01 by C/DL-3c
Phase 3 Phase 0, which read the token file rather than the amendment.
**A governing file that silently self-corrects teaches nobody**, and this
one was wrong in the commit that created it.

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
6. **RULINGS CHECK — every build phase, before code and again before commit.** List every
   ruling recorded for the arc or phase (checklist tables, spec amendments, dated RULING
   lines) and state, for each, how the diff complies. **A ruling is not self-applying; it
   binds only when checked. A test that pins a behaviour a ruling forbids is itself a
   violation.** (Origin: Preview-1, `9b1fe59` — P2 recorded in `a2772e2`, violated one
   commit later, and pinned by a test.)

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
8. Run the RULINGS CHECK again (pre-change step 6) — against the final diff this time, not
   against the plan.

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
- ⚠ **A TABLE'S SHAPE IS ITS `CREATE` PLUS EVERY `ALTER` SINCE. READING THE CREATE ALONE GETS IT
  WRONG, AND THE FAILURE DOES NOT LOOK LIKE A SCHEMA FAILURE.** Twice in two phases, both NOT NULL
  columns added by a later migration: `cashout_requests.contractor_id` aborted a seed on the
  constraint, and `sessions.contractor_id` — required by `verifyReferrerSession`'s
  `s.contractor_id IS NOT NULL` — made a hand-minted token return a **plain 401**, which reads as a
  bad token rather than a missing column. **The second cost a debugging detour precisely because
  the error was plausible.** Before writing a row by hand, grep the table name across `db.js` for
  `ALTER TABLE`, not just for `CREATE TABLE`.
- `ADD CONSTRAINT ... UNIQUE` in a `DO $$` block must catch `WHEN duplicate_object OR duplicate_table` (re-run collides with its own backing index, raising 42P07). `CHECK` constraints only need `duplicate_object` (no backing index). Prefer the `pg_constraint` pre-check pattern (see `tokens_contractor_id_unique` in db.js) for new UNIQUE constraints.
- Every fail-closed migration guard (e.g. "exactly 1 `contractors` row") must be wrapped in a work-remaining check (`IF EXISTS (SELECT 1 FROM <table> WHERE <backfill column> IS NULL) THEN ... END IF`) so it fires while backfill work remains and is a permanent no-op after — otherwise it re-crashes every boot the moment a second `contractors` row exists. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that surfaced this.

### Jobber API
- All Jobber GraphQL calls wrapped in retryWithBackoff with jobberShouldRetry.
- retryHelpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry, **stripeShouldRetry**) live in server/utils/retryHelpers.js — never redefine locally. ⚠ `stripeShouldRetry` was missing from this list until 2026-08-29 while being imported and used in `server/routes/stripe.js` — **an incomplete resident list is how someone concludes a helper does not exist and writes a fifth one locally**, which is the exact thing this line forbids.
- Jobber API version: `2026-02-17`. Do not change without verifying changelog.
- `ClientFilterAttributes` does NOT support name/firstName/lastName filtering — always filter locally in JS.
- Jobber GraphQL is read-only. Never add mutations without explicit instruction.
- ⚠ **ROOFMILES NEVER WRITES TO A CONTRACTOR'S CRM. THIS IS A PRODUCT PRINCIPLE, NOT A TECHNICAL
  LIMITATION, AND IT IS THE REASON THE LINE ABOVE EXISTS** — ruled by Danny 2026-09-19, amendment
  A36.5.a (`DECISION_C_DL_BUILD_SPEC.md` §25). **RoofMiles READS from the CRM and is ADDITIVE, NOT
  INVASIVE. That is part of what makes it adoptable.** ⚠ **The specific proposal this forecloses is
  the obvious one: writing a note or a custom field onto a Jobber client to tell the office about a
  referral. It is RULED OUT — not deferred, not "when we have the scope".** A36.5.b and A36.5.c rule
  the sanctioned channels instead: the contractor's own notification email, and the admin dashboard.
  ⚠ **WHY THIS IS RESIDENT RATHER THAN ONLY IN THE SPEC:** *"Jobber GraphQL is read-only"* reads as a
  constraint awaiting a good enough reason, and the write-back is a genuinely good idea on its
  merits — so a session that meets only that line will propose it, and will be right to, having
  never opened §25. **Meet the answer before writing the proposal.**
  ⚠ **AND WHAT THE REPO CANNOT TELL YOU: there is NO scope declaration in this codebase.** The only
  OAuth call is a refresh-token exchange carrying no scope parameter; the authorize step that grants
  scopes lives in the Jobber developer console, outside this repo and unchecked. **So read-only is
  enforced here by the absence of mutations and by this rule — not by anything a grep can confirm**,
  and enabling a write scope is a product decision taken elsewhere rather than a build detail
  reachable by editing a query.
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
- **Design tokens, by surface. Never invent a colour, font or spacing value outside these.**
  - **On a THEMED surface** (anything inside `ThemeProvider` — referrer, rep, auth): colour comes
    from the **render tokens**, declared `var(--rm-X, <fallback>)`. Non-colour — borders, shadows,
    fonts — comes from the **side channel**, `elevationVar()` / `fontVar()`
    (`src/constants/elevationTheme.js`), because `themeCssVariables()` validates every render
    token as `#RRGGBB` and an alpha border, a multi-part shadow and a font stack are none of them.
    Status colour comes from `statusVar()`. ⚠ **The validator stays strict; that is the whole
    reason the side channel exists rather than a looser contract.**
  - **On the ADMIN tree** — `src/components/admin/**` and `superAdmin/**` — declare `AD` directly.
    It renders **outside `ThemeProvider`** (Ruling 5), so no `--rm-*` is mounted and every
    `var(--rm-*, …)` there would take its fallback forever. ⚠ **Explicitly excluded, and NOT
    because it is correct**: `AdminSettingsNotifications.jsx` and `AdminReferrers.jsx` still reach
    retired Accent values through `R`, which is a different job.
  - **`R` and `AD` survive** for what neither set covers — `R`'s fonts, radii and the status
    config, `AD`'s whole palette.
- ⚠ **A `var()` FALLBACK MUST BE THE VALUE THAT ACTUALLY MOUNTS — A TINT IS NOT A FILL.** This is
  a defect class, not a style note. `var(--rm-danger, #FEE2E2)` reads as a pale error tint,
  measures 5.30:1, and painted **1.34:1** on the login screen's failed-login message for months,
  because the provider mounts `--rm-danger` as the saturated FILL `#DC2626`. jsdom resolves no
  `var()`, so no test saw it. **Write the fallback the mount will produce, never a plausible
  alternative** — `src/constants/themeKeyIntegrity.test.js` enforces this and names the expected
  value when it fires.
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
