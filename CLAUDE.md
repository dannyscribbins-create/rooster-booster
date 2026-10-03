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
  the **Railway SERVICE** · the **GitHub repo** (`git remote -v` → `dannyscribbins-create/rooster-booster`)
  · the **local working directory** (`C:\Users\stacy\rooster-booster`) · **`package.json`'s `name`**
  and **`package-lock.json`'s two `name` fields**.
  ⚠ **CORRECTED 2026-10-01: THIS LINE SAID "the Railway PROJECT" AND THAT IS THE WRONG RESOURCE.**
  `railway status --json` reports `name: RoofMiles` for the **project**, with
  `services -> ['rooster-booster', 'Postgres']` and `environments -> ['production', 'staging']`. **So
  the project is already renamed and the SERVICE is what still carries the old name** — which is also
  why the production URL is `rooster-booster-production.up.railway.app` and why
  `railway logs --service rooster-booster` is the form that works. Whether the project was renamed
  after that list was written, or the list was wrong when written, is **NOT established and saying
  which would be inventing a source.** The infrastructure consequence is unchanged: a session hunting
  for a RoofMiles-named *service* will not find one.

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
⚠ **THAT SENTENCE IS ABOUT THE APP'S INTERNAL `DATABASE_URL`, WHICH IS NOT REACHABLE FROM
OUTSIDE RAILWAY. THE POSTGRES SERVICE'S PUBLIC TCP PROXY IS REACHABLE**, and the rule below
governs what may be done through it. Read as an unqualified "you cannot reach production",
the line above forecloses a check that is permitted — which is why the two sit together.
*(A fuller narrowing of this line is filed separately; this commit adds only what the
read-only rule requires to not contradict it.)*

### ⚠ READ-ONLY PRODUCTION READS ARE PERMITTED — UNDER FOUR CONDITIONS, ALL OF THEM

Ruled by Danny 2026-09-28, during 3d Phase 1b. **A question about what production data
actually holds may be answered by reading it, rather than guessed at or left open.** The
conditions are not advisory and none of them is optional:

1. **Read-only `SELECT`s only.** No `INSERT`, `UPDATE`, `DELETE`, no DDL, no `EXPLAIN ANALYZE`
   on a data-modifying statement, nothing that takes a lock. A statement that is not a bare
   `SELECT` is outside the ruling, whatever it is for.
2. **Over the public Postgres TCP proxy**, never by reaching for the app's internal URL.
3. **Credentials are NEVER printed and NEVER written to any file** — not into a script, not a
   report, not a log line, not a commit message, not a shell history. ⚠ A connection string
   carries the password; echoing the command echoes the credential.
4. **Scripts live OUTSIDE the repo**, and **every query actually run is stated in the report.**
   Not "I queried the assignments table" — the statement, as it was run.

⚠ **THE FOURTH CONDITION IS THE ONE THAT WILL GET SKIPPED, AND IT IS THE ONE THAT MAKES THE
OTHER THREE CHECKABLE.** A reported finding whose query is not written down cannot be
distinguished from a remembered one, and this repo's records are full of numbers that were
right on the day and had no source. **A production read with no stated query is not evidence.**

⚠ **AND THE OUTPUT IS DATA ABOUT REAL PEOPLE.** Client names, emails and phone numbers are in
these tables. Aggregate where the question allows it, never paste a row dump into a tracked
file, and keep any CSV outside the repo — the rebuild preview's own CSVs are already handled
this way for exactly this reason.

**`server/migrations/add_payout_columns.js` — superseded by initDB(). DO NOT RUN AGAIN.**

⚠ **ONE ENVIRONMENT VARIABLE IS A DESTRUCTIVE OPERATOR TOOL, NOT CONFIGURATION.**
`REP_ASSIGNMENT_REBUILD=<contractor id>` makes the next boot **delete that contractor's
engine-written rep assignments** and re-derive them from stored facts. It is for support, it is
irreversible, and **leaving the variable set re-runs it on every restart.** The procedure —
precondition, steps, what survives, how to verify, and the backup that must be taken first —
is `REP_ASSIGNMENT_REBUILD_SOP.md` in the repo root. **Read it before setting the variable, and
never set it to "see what happens".**
⚠ **AND IT IS GATED SHUT RIGHT NOW (Danny, 2026-09-26): NO RUN AGAINST REAL DATA UNTIL THE
PREVIEW (Commit 7c) EXISTS AND DANNY HAS REVIEWED ITS OUTPUT FOR THAT CONTRACTOR.** R5k stops the
rebuild clearing what it cannot recreate; **it does not promise that what comes back is what was
there** — a client can return with a different rep, a sticky flipped to provisional, dates reset
to `NOW()`, or no assignment at all. The gate, what clears it, and the guard's blind spot are on
`PRE_LAUNCH_CHECKLIST.md`. ⚠ **This line is resident because the gate binds at the moment someone
sets an env var — before any document is open, which is the one moment a checklist cannot reach.**

⚠ **THE ATTRIBUTION RULINGS AND THE REASONING BEHIND THEM ARE IN
`RoofMiles_Decisions_Record_Canvass_Attribution.md`** (repo root). It holds what the code cannot:
the options that were REJECTED, the corrections made along the way, and why each ruling came out
the way it did. **Read it before re-opening any attribution, sale-definition or rep-surface
decision** — several rulings were reached by rejecting a plausible alternative, and the
alternative looks attractive again to anyone who sees only the outcome.

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
- Rule: run `npm test` before every push. Lint must be clean and both suites fully green — **2508 server tests across 423 suites, and 1410 React tests across 86 files** (measured 2026-10-03 by the N4 commit 8 commit, by running the gate; the log's own `EXIT=` line read 0, and **all SEVEN server numbers were read by name off the log, never tailed**: `tests 2508 · suites 423 · pass 2508 · fail 0 · cancelled 0 · skipped 0 · todo 0`). A drop below these numbers means tests were deleted; stop and report.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 8 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2504 → 2508 is **+4**, all four APPENDED to `oneStatusDerivation.test.js` (14 → 18), so
  **suites hold at 423** — the expected shape when a file grows rather than a file arriving. React did
  not move — **no `src/` file was touched at all** — and was re-measured. **All four predicted before the
  run and matched, and the gate was green on its first run.** Counted with an anchored `^\s*it\(` (18),
  and the file's **32** loops were each checked for POSITION rather than counted: all 18 `it(` lines sit
  at exactly two spaces and **zero** at four or more, so no loop and no nested describe wraps a case.
  ⚠ **THE COMMIT'S SUBJECT: TWO ALLOW-LISTS REACHED EMPTY AND NOTHING SAID SO.** `EXPIRING_CLASSIFIERS`
  and `EXPIRING_WRITERS` emptied as commits 3 and 7b retired their entries — and the two cases named
  *"every expiring entry names the commit that deletes it"* ITERATE those arrays, so **over an empty
  array they run zero times and assert nothing.** *"The arc is complete"* was a fact about the source
  that no test could observe. Both are `assert.deepEqual(…, [])` now, which makes it a RATCHET: a future
  temporary exception cannot be parked in a list nothing checks.
  ⚠ **THE TWO NAMING CASES ARE KEPT THOUGH THEY NOW ITERATE NOTHING.** The one path that re-opens either
  list is someone deleting the emptiness assertion on purpose, and the naming requirement must still
  bite when they do. **A rule removed because it is currently unreachable is a rule nobody re-adds when
  it becomes reachable again.**
  ⚠ **AND A JUSTIFICATION STRING'S CLAIM IS NOW CHECKED INSTEAD OF ASSERTED.** `PERMANENT_WRITERS` says
  of the import `why: 'the SEED write (Danny ruling 6); COALESCEd'` — **and nothing read the SQL.** A
  case reads `fullJobberImport.js` with comments stripped and requires `COL_STAGE = COALESCE` present and
  `COL_STAGE = EXCLUDED.COL_STAGE` absent, so "COALESCEd" is a property rather than a promise.
  ⚠ **DANNY PREDICTED EXACTLY 1 RED FOR HIS NAMED INJECTION AND THE TRUE WIDTH IS 3 — REPORTING 1 WOULD
  HAVE HIDDEN TWO MECHANISMS.** A new file writing the stage FROM the live classifier trips the caller
  allow-list, the writer allow-list AND the new only-live-classifier case. Split into halves to show
  why: **caller-only → 2, writer-only → 1, both → 3.**
  ⚠ **ONE GUARD-PROOF CAME BACK WIDTH 0 AND THE FLATTERING READING WAS WRONG — WHICH IS THE ENTRY WORTH
  KEEPING.** Removing `classifyImportedClientStage(client)` from the import loop changed nothing, which
  reads as *"the CLOSURE case does not cover PERMANENT entries"*. **It does.** The carve-out names the
  classifier call INSIDE that function and I had removed a caller **OF** it, leaving the span in place —
  an injection that edits the wrong site, not a fence hole. Re-pointed at the real
  `return classifyPipelineStatus({` it reds **2**. Found by reading the fence rather than believing the
  number.
  ⚠ **AND THAT RAISED A FAIR QUESTION ABOUT MY OWN NEW CASE, SETTLED BY MEASUREMENT RATHER THAN
  ARGUMENT.** Two injections red it ALONGSIDE a pre-existing case, so on their evidence it could be a
  duplicate. An eighth injection removes the classifier call **AND** its allow-list entry together — a
  COHERENT edit, which is exactly what CLOSURE is built to permit, because that is how an entry retires
  — and it reds **exactly 1, the new case alone.** ⚠ **So the uniquely-caught state is the import's SEED
  retiring tidily, after which a fresh import writes no stage at all and every other mechanism stays
  green.** The measurement is in the case's comment instead of the reasoning it was written on.
  ⚠ **TWO OF THE EIGHT INJECTIONS CREATE A FILE RATHER THAN PATCHING ONE, which is new to this arc** —
  deleted in the same `finally`, with the directory asserted afterwards to hold no leftover. **A
  guard-proof that leaves a file behind is a source edit.**
  ⚠ **NO DATABASE, so nothing joins any reset list** — the suite reads source text only.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE DELIVERY-CLAIM COMMIT ITSELF, BECAUSE IT
  SHIPS TESTS.* It read **2504 / 423 / 1410 / 86**. Server 2499 → 2504 was **+5**, one new file
  (`invoicePaidDeliveryClaim.test.js`); suites 422 → 423 was that file's single describe.
  ⚠ **THE INVOICE-PAID DOOR WAS THE ONLY ONE THAT CLAIMED NOTHING, AND THAT IS HOW C1'S LAUNCH-GATE CAME
  TO BE ANSWERED FROM LOGS RATHER THAN FROM THE DATABASE.** `claimWebhookDelivery` had exactly two call
  sites, so `jobber_webhook_events` held **0 rows for `topic ILIKE '%INVOICE%'` across 5,379 events**. A
  zero from a table that structurally cannot hold the row is not an observation, and it was checked only
  because the figure looked too clean.
  ⚠ **WHAT IT CHANGES AND WHAT IT DOES NOT, BECAUSE THE SECOND HALF IS EASY TO OVERREAD.** It adds a
  durable record and makes a duplicate skip EARLY — before the settings read, the invoice fetch, the
  client fetch, the capture, the decision and the credit. **It does NOT make the door exactly-once and is
  NOT what prevents a double payout**: that is `referral_conversions`' UNIQUE constraint plus
  `evaluateReferral`'s STEP 8, with the email gated on a row being INSERTED, all unchanged.
  ⚠ **THE OBSERVABLE IS THE JOBBER CALL COUNT, NOT THE CONVERSION COUNT, AND THAT DISTINCTION IS THE
  TEST'S WHOLE VALUE.** A conversion count of 1 after a duplicate was ALREADY true before this commit, so
  asserting it would pass against the pre-fix code and prove nothing. What changed is that the duplicate
  no longer does the WORK — previously two Jobber round trips and a full re-capture, discarded.
  ⚠ **PLACED AFTER THE CHEAP STATUS EXIT, AND A CASE PINS THE PLACEMENT.** Jobber sends INVOICE_UPDATE
  for every status change, each with its own `occurred_at`, so claiming earlier would write a delivery row
  for every draft and awaiting-payment transition this door ignores.
  ⚠ **MEASURED BEFORE ACCEPTING THE FAIL-OPEN PATH, BECAUSE IT COULD HAVE MEANT AN `error_log` ROW PER
  WEBHOOK:** **6,172 claimed deliveries across six topics** since 2026-09-18 and **0 dedupe-inert notices
  ever**. A delivery row exists only when `occurred_at` was present, so Jobber does send it and the inert
  path has never fired. ⚠ **CAVEAT SAID RATHER THAN GLOSSED: invoice-paid has no rows yet, so this is
  strong evidence from a SHARED ENVELOPE, not an observation of `INVOICE_UPDATE` itself** — the same
  distinction C1's launch gate had to draw.
  ⚠ **SIX GUARD-PROOFS, widths 1 · 4 · 1 · 3 · 1 · 1**, every revert byte-identical by sha256.
  ⚠ **THE GATE WENT RED FIRST AT `fail 1`, AND IT WAS A PROXY ASSERTION THIS COMMIT INVALIDATED RATHER
  THAN A DEFECT.** `webhookContractorResolution.test.js` asserted `error_log` was **globally empty** as a
  proxy for *"resolution succeeded cleanly"*; its payload carries no `occurredAt`, so the new claim fails
  open and records a `dedupe key` notice. **Narrowed with the old assertion quoted in place and made
  STRICTLY STRONGER** — the surviving rows are enumerated BY SOURCE and the expected notice asserted
  positively, so an unrelated error cannot hide behind the narrowing, which is how a narrowed assertion
  usually goes quietly blind.
  ⚠ **AND THE WRAPPER REPORTED exit 0 WHILE THE LOG'S OWN `EXIT=` LINE READ 1** — another instance of
  that disagreement. On the red run React never ran at all, because the gate chains with `&&`, so a tail
  would have shown no React numbers and no reason.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE IDENTITY-ROW REORDER COMMIT ITSELF, BECAUSE
  IT SHIPS TESTS.* It read **2499 / 422 / 1410 / 86**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE IDENTITY-ROW REORDER COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2491 → 2499 is **+8**, one new file (`identityRowOrder.test.js`); suites 420 → 422 is that
  file's **two** describes. React did not move and was re-measured — **no `src/` file was touched**.
  ⚠ **THE GATE WAS RUN TWICE AND THE SECOND RUN IS THE ONE CITED.** The first read 2498 / 422, against a
  7-case file; two of those cases were then REPAIRED (see below) and the file holds 8. **A figure measured
  against code that no longer exists is a claim rather than a measurement**, so it was re-run rather than
  adjusted. Both runs read `EXIT=0`; only `tests`/`pass` moved, by exactly the one added case.
  ⚠ **RULING 3 (Danny, 2026-10-02): THE IDENTITY ROW IS CREATED BEFORE THE CAPTURE.** `captureClientFacts`
  writes `jobber_created_at` and the full-capture marker with `UPDATE jobber_clients …`, and the identity
  upsert that CREATES that row ran after both the capture and the decision — so on a FIRST SIGHTING both
  writes affected **0 rows**. An `ON CONFLICT … DO NOTHING` pre-insert now runs before the capture lock.
  ⚠ **A PRE-INSERT RATHER THAN A MOVE, AND THE REASON IS STRUCTURAL:** the real upsert writes
  `pipeline_stage` and `stage_derived_at` from the DECIDED stage, so it cannot run before the decision.
  Relocating it would split one statement into two writers of one row.
  ⚠ **THE ELIGIBILITY EFFECT IS MEASURED AND IS NARROWER THAN THE RULING FEARED. Immediate effect: ZERO.**
  The reorder changes no existing row and backfills nothing — measured read-only: the eligible set is
  **3** before and after, the newly-reachable state (marker set AND no decision) has **0** members today,
  and there are **0** clients with fact rows but no `jobber_clients` row. Going forward the only newly
  eligible state is *a first sighting whose decision did not record*; where the decision DOES record the
  capture commits first and the stage is stamped afterwards, so marker < decision and the client is not
  selected. A case pins that end to end.
  ⚠ **AND THE MEASUREMENT INVERTED A NOTE IN `PRE_LAUNCH_CHECKLIST.md`.** It said `client-create` /
  `client-update` "stamp `last_full_capture_at` and leave `stage_derived_at` alone". **Measured on the
  live door: the opposite, in BOTH columns** — `decideFromFacts` runs regardless of
  `alsoDeriveReferredStatus` and the upsert's INSERT stamps `stage_derived_at` from its `CASE` (observed
  `2026-10-02T15:30:48Z`), while `last_full_capture_at` was the column left NULL. **Inverted rather than
  stale: it told the next reader the catch-up would make the first derivation for those clients, when
  they were invisible to it.** Filed with the old wording quoted.
  ⚠ **C1'S BRAND-NEW-CREDIT CASE WAS RE-POINTED OPENLY, WITH THE OLD ASSERTION QUOTED VERBATIM BESIDE
  THE NEW ONE.** It asserted `jobber_created_at` was STILL NULL after a credit — correct when written,
  and now forbidden. **A ruling changed the mechanism, not a bug.** "The column is empty" was never the
  property; it was the only available PROOF that the gate used the supplied date, and with the column
  filled that proof is gone. The supplied-date mechanism is still load-bearing — the bulk syncs write
  `pipeline_cache`, never `jobber_clients` — and is pinned by guard-proofs instead.
  ⚠ **FIVE GUARD-PROOFS, widths 4 · 2 · 1 · 2 · 2**, every revert byte-identical by sha256.
  ⚠ **AND TWO OF MY OWN CASES WERE WRONG, BOTH FOUND BY A WIDTH-0 RESULT, BOTH REPAIRED RATHER THAN
  EXPLAINED AWAY.** (a) *"the pre-insert carries IDENTITY"* was BEHAVIOURAL AND VACUOUS: the real upsert
  runs immediately after and fills name, email and phone, so nulling every identity parameter in the
  pre-insert left it green. It was observing the final state, which the real upsert determines, while
  claiming to test the pre-insert — and the only window a bare row is visible in is not reachable from a
  test. Re-pointed to a SOURCE assertion that the pre-insert binds the same identity expressions; (4)
  then reds it. (b) The ORDERING injection added a SQL comment instead of MOVING the block, so it
  reintroduced no defect — **my mistake, not a fence failure.** A genuine relocation is multi-line and
  not expressible as a one-line injection, so the fence's order comparison is now exercised on SYNTHETIC
  input in both directions, which is the only way that half could be observed at all. **The injection was
  retired with its reason recorded rather than left reporting a meaningless 0.**
  ⚠ **AND A FIXTURE FALLBACK HID A MISSING EXPORT, WHICH IS THE SHAPE THIS FILE KEEPS RECORDING.**
  `certifyFullyPaged` was required from `jobberClientFetch` (which only imports it) behind a
  `typeof === 'function' ? … : shape` fallback. The export was `undefined`, the fallback returned an
  UNCERTIFIED shape, the marker was never stamped, and the case failed **for a harness reason that looked
  exactly like the production defect.** It requires from `captureCompleteness` and asserts now.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CREDIT-VISIBILITY COMMIT ITSELF, BECAUSE IT
  SHIPS TESTS.* It read **2491 / 420 / 1410 / 86**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE CREDIT-VISIBILITY COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2478 → 2491 is **+13**, one new file (`creditVisibility.test.js`); suites 416 → 420 is that
  file's **four** describes — one top-level and three nested. React did not move and was re-measured —
  **no `src/` file was touched at all**. **All four predicted before the run and matched.** Counted with
  an anchored `^\s*it\(` (13); every loop was checked for POSITION — one in `beforeEach`, the rest inside
  `it()` bodies — so **none wraps a case**.
  ⚠ **THE COMMIT'S SUBJECT: THE CREDIT WAS INVISIBLE IN PRODUCTION LOGS, IN BOTH DIRECTIONS, AND C1
  SHIPPED THE COUNTER WITHOUT THE LOG LINE.** `runRedecideStaleClients` has maintained `summary.credited`
  since C1 and `formatSummary()` prints a `CREDITED` row — **but the cron does not call `formatSummary`**;
  it builds its own line, and the counter was never added there. So a credit made by the catch-up left no
  log evidence at all. ⚠ **AND NEITHER DID ITS ABSENCE:** `creditReferralFromFacts` RETURNS a reason that
  no caller logged, so a client persistently refused was indistinguishable from a client nobody looked
  at. **That is the silent-gate shape on the money path, in the observability layer rather than the
  logic** — and it is why the 2026-10-02 live check had to be answered from the database rather than the
  logs. **A live check that cannot see its subject is weak evidence however green it looks.**
  ⚠ **ONE AGGREGATED LINE PER RUN, NEVER ONE PER CLIENT, AND IT IS COUNTED RATHER THAN INTENDED.** The
  catch-up is bounded at 200 clients and the full sync iterates ~19,600, so per-client logging would bury
  the summary it exists to surface. Two cases count the LINES, and a positional fence requires
  `formatCreditTally` to sit outside any per-client loop.
  ⚠ **`syncSingleClient` NOW RETURNS `{ creditOutcome }`, WHICH IS THE CONTRACT THE BULK LOOPS TALLY
  FROM.** It returned `undefined` before, so there was nothing to aggregate. Every caller ignored the
  return, so adding one breaks nothing — and a null means "the credit was never attempted", which the
  tally deliberately does NOT count as a refusal. **Counting a non-referred client as a refusal would
  inflate every tally with clients the engine never saw.**
  ⚠ **CLIENT IDS ARE DELIBERATELY ABSENT FROM THE LINE, AND A CASE ASSERTS IT.** They are data about real
  people, and the aggregate answers the question: *"14 hit `referrer_not_found`"* is actionable, while one
  id invites chasing one row and missing that it is thirty.
  ⚠ **EIGHT GUARD-PROOFS, EVERY REVERT PROVEN BYTE-IDENTICAL BY sha256.** Widths: (1) the cron line stops
  saying `credited` → **2**; (2) a credited client stops being counted → **4**; (3) the tally records
  nothing → **7**; (4) a NULL outcome IS counted → **2**; (5) the catch-up stops tallying → **6**; (6) the
  SYNC stops tallying → **1**; (7) a zero `credited` is dropped from the line → **1**; (8) the aggregated
  line is printed inside a per-client loop → **2**. (1) and (2) are the pair Danny named.
  ⚠ **AND TWO CAME BACK WIDTH 0 FIRST, BOTH REAL FINDINGS RATHER THAN FORMALITIES.**
  **(a)** Removing the `outcome.credited ?` branch changed nothing — because a success's `reason` is
  ALREADY the literal `'credited'`, so reading the reason alone reaches the same key. The branch is
  **redundant today and is kept deliberately**, because it reads the field that MEANS "a row was
  inserted" rather than depending on one reason string happening to spell it; the measurement is recorded
  beside it so nobody "tidies" it on the strength of the very evidence that makes tidying look safe.
  **(b)** Removing a tally call from the SYNC changed nothing — the suite drove only the catch-up, **and**
  the sync has TWO bulk loops (`runFullSync` and `runIncrementalSync`) so an `includes()` check stayed
  green with one removed. Closed with a COUNT requiring both, plus two behavioural cases on the new
  return contract. ⚠ **An `includes()` where the real property is "all of them" is the same shape as a
  count that cannot see a loop.**
  ⚠ **AND TWO INJECTIONS HAD TO BE REWRITTEN BECAUSE THEIR REPLACEMENT CONTAINED THEIR OWN ANCHOR** —
  the overlapping-anchor problem this file records from `db.js`. The landed-check refused rather than
  reporting a wrong width, which is the behaviour to want. **A wrapping injection is almost always this
  mistake; change the condition instead of wrapping the line.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE C2 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  It read **2478 / 416 / 1410 / 86**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE C2 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2468 → 2478 is **+10**, one new file (`syncLockPartition.test.js`); suites 414 → 416 is that
  file's **two** describes. React did not move and was re-measured — **no `src/` file was touched at
  all**. **All four predicted before the run and matched.** Counted with an anchored `^\s*it\(` (10);
  every loop was checked for POSITION — one in `beforeEach`, the rest inside `it()` bodies or inside the
  `lockedExtents` helper — so **none wraps a case**.
  ⚠ **THE COMMIT'S SUBJECT IS A PARTITION, NOT A FEATURE, AND THAT IS DANNY'S FRAMING.** `syncSingleClient`
  now credits inside its own lock, so a referred client the SYNC discovers as already paid is paid at once
  instead of waiting up to 30 minutes for the catch-up. The reviewable question is the boundary: what may
  run while a pooled connection is held, and what may not.
  ⚠ **TRANSACTION 1 KEEPS THE DERIVE, AND THE FIRST WRITING OF C2 GOT THAT WRONG.** I moved derive into
  transaction 2, which would have made a derive failure roll back the referral record — and catching it
  inside would not have helped, because **a SQL failure aborts the transaction and every later statement
  fails with "current transaction is aborted"**. `oneEngineFromFacts` (v) requires the record to be written
  even when the capture fails, and that is only expressible with derive in transaction 1. The split is
  therefore `capture+derive` / `record+attribute+credit`, not `capture` / `derive+record+…`.
  ⚠ **`attributeReferredClient` WAS DELETED RATHER THAN CONVERTED TO TAKE A `tx`, AND A FENCE DECIDED
  THAT.** It had exactly one caller, so a wrapper only moved the engine one level away from the lock —
  and `oneEngineFromFacts` (iii) requires the engine call to fall inside the PARENTHESISED EXTENT of a
  `withClientLock` call, stating of itself that *"a door that called the engine through a helper invoked
  from inside the lock would not be seen"*. **The property still held and the fence could no longer check
  it**, which is the moved-target failure a non-vacuity floor exists to produce. Inlining keeps the fence
  working by its own mechanism instead of widening it, and the locked extent is visibly contiguous — which
  is what makes a partition reviewable at all. **The lock's callback is inline for the same reason**: a
  named callback put the engine out of the extent too.
  ⚠ **AND THE DOUBLE CAPTURE WENT WITH IT.** The sync captured once for the derivation and again inside
  that function — the same facts, written twice, in two transactions, with the `pipeline_cache` upsert on
  the POOL between them. ⚠ **The second-chance Jobber fetch went too, on purpose rather than by accident:
  a retry is not available inside a lock.** On a capture failure the record is still written, the status
  stays underived, and the next tick retries.
  ⚠ **A GUARD-PROOF MEASURED WIDTH 0 AND THE REPAIR IS THE ENTRY WORTH KEEPING.** Changing
  `_runAttributionEngine(db, …)` to `(pool, …)` **inside** the lock broke nothing any test could see — and
  it is a real defect: the engine's writes would commit on another connection, outside the transaction,
  surviving a rollback of the record that justified them and serialised by nothing. ⚠ **BOTH FENCES ARE
  BLIND TO IT FOR THE SAME REASON: they check a call's POSITION, never which connection it was handed.**
  A call can sit perfectly inside a locked extent and bypass the lock through its first argument. The new
  case forbids the word `pool` anywhere inside a locked callback, skipping past `withClientLock`'s own
  first argument, which is legitimately the pool. (4) and (7) then red **exactly 1** each against it.
  ⚠ **THE BEHAVIOURAL HALF PATCHES `withClientLock` IN THE TEST, BEFORE `pipelineSync` IS REQUIRED, AND
  THE ORDER IS THE WHOLE TRICK.** The sync destructures the lock at module load, capturing the function
  REFERENCE, so replacing the export afterwards would change nothing. Patching first means the sync
  captures the tracking wrapper — and **production is untouched**, so the thing under test is the shipped
  code rather than a testability variant of it. Each outbound stub records the lock depth when it fires.
  ⚠ **AND IT CARRIES THREE PRECONDITIONS, BECAUSE "every outbound call saw depth 0" IS TRIVIALLY TRUE OF
  A RUN THAT MADE NO OUTBOUND CALL AND EQUALLY TRUE OF A RUN THAT TOOK NO LOCK.** It asserts outbound
  calls fired, that a lock was really taken, and that a conversion was written — plus a PAIRED POSITIVE
  proving the probe can see a call made inside a lock, without which a mis-ordered require would report
  the partition as proven while nothing was observed.
  ⚠ **SEVEN GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY sha256.**
  Widths: (1) the notify sent from inside the lock → **4**; (2) a Jobber fetch from inside it → **4**;
  (3) the sync stops crediting → **3**; (4) the referral record written on the pool again → **1**;
  (5) a capture failure rethrown instead of swallowed → **1**; (6) the sync stops supplying the client's
  creation date → **3**; (7) the engine handed the pool inside the lock → **1**.
  ⚠ **THE WIDTHS WERE MEASURED TWICE, AND THE SECOND SET IS THE ONE CITED.** The lock callback's body was
  re-indented by four spaces after the first run, so every anchor inside it stopped matching — the harness
  SKIPPED rather than reporting a wrong width, which is the behaviour to want, **and a width measured
  against code that no longer exists is a claim rather than a measurement.**
  ⚠ **ONE ANCHOR WAS UNIQUE FORWARDS AND NOT BACKWARDS, AND THE HARNESS REFUSED IT.**
  `await upsertReferralRecord(pool);` already exists in the legitimate falsy-`contractorId` branch, so the
  INVERSE patch had two candidates. **An anchor unique in one direction is not therefore unique in the
  other** — this file already records that from `db.js`, and it cost nothing this time because the check
  runs before anything is written.
  ⚠ **AND THE INTERLOCK NOISE IN THE GATE LOG IS PRE-EXISTING, CHECKED RATHER THAN ASSUMED.** 109
  `ABORTING the send` refusals, **none** of them a bonus email — measured against the C1 gate's 354 on the
  same tree shape. C2 added no new refused send; the retries are `errorLogger`'s first-occurrence alerts
  in suites that have not opted in, which `PRE_LAUNCH_CHECKLIST.md` already records.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE C1 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  It read **2468 / 414 / 1410 / 86**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE C1 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2445 → 2468 is **+23**, one new file (`c1Credit.test.js`); suites 408 → 414 is that file's
  **six** describes — one top-level and five nested, and **a nested describe adds a suite exactly as a
  top-level one does**. React did not move and was re-measured: **no `src/` file was touched at all**.
  **All four predicted before the run and matched.** ⚠ **NO PHANTOM, ASKED BEFORE THE RUN:** this commit
  adds no non-test file under `src/components/admin`, `src/constants`, `src/components/superAdmin` or
  `src/utils` — `adminBranding.test.jsx`'s four walked roots — so the arithmetic closes at exactly 23 and 0.
  ⚠ **23 FROM 22 `it(` LINES, AND THE GAP IS WHY THE COUNT IS COUNTED RATHER THAN READ.** An anchored
  `^\s*it\(` reports **22**. Seven loops were each checked for POSITION and **exactly one WRAPS an
  `it()`** — a two-entry `for` over the preview/replay FILES, asserted per file BY NAME; the other six
  sit in `beforeEach` or inside `it()` bodies. So 21 × 1 + 1 × 2 = 23. **Reading "22 lines" as 22 cases
  would have been low by one**, the direction that looks identical to a suite that partly failed to register.
  ⚠ **TWO EXISTING SUITES WERE MIGRATED AND CONTRIBUTE 0**, which is the expected shape:
  `invoicePaidWebhook.test.js` holds at 11 and `f8TenantScoping.test.js` at 13 — both had fixtures
  repaired, neither gained a case.
  ⚠ **THE COMMIT'S SUBJECT: RULING 1's HEADLINE WAS STRUCTURALLY DARK, AND THE CAUSE WAS ORDERING
  RATHER THAN LOGIC.** C1 added `jobber_clients.jobber_created_at` so the one start-date rule could gate
  on the CLIENT's creation date. On the invoice-paid door the identity upsert that CREATES that row runs
  **after** both the capture and the decision — `factCapture.js` records exactly that ordering for the
  full-capture marker directly above the new write — so on a first sighting `captureClientFacts`'
  `UPDATE` affects **0 rows**, the gate read nothing, and the credit returned `client_created_at_unknown`.
  **Ruling 1 exists precisely so a first paid invoice is credited immediately rather than waiting for the
  sync, so the one case the stored read cannot serve is the one the ruling names.** Measured end to end:
  after the fix the client is credited and that column is **still NULL**, which is the case's own proof
  that the supplied live date is what admitted it.
  ⚠ **AND THE FIX IS AN OPTION ON THE GATE, NOT A REORDER OF THE DOOR.** `evaluateReferral` takes an
  optional `clientCreatedAt` — the `categoryValues` precedent from the same commit — and falls back to the
  stored column, which is what keeps the catch-up (holding no live client) correct. ⚠ **`undefined` and
  `null` are deliberately different**: absent means "read the column", null means "I looked and there is
  none" and is REFUSED. Guard-proof 10 collapses the two and reds **8**.
  ⚠ **A GUARD-PROOF MEASURED ONE OF MY OWN GUARDS AT WIDTH 0 AND THE REPAIR CHANGED WHAT THE CASE
  ASSERTS.** Removing the door's `isDerivableJobberClientId` check credited no placeholder: it makes
  `deriveReferredStatus` RAISE instead, because that function carries a deliberate programmer-error throw
  and its own comment says callers "must filter FIRST". Both states write no conversion and only an
  `error_log` row separates them, so every conversion assertion stayed green. The case now asserts the
  placeholder is **skipped cleanly**; (12) then reds **exactly 1**. **A guard whose failure mode has never
  been observed is a claim, not a check** — and here the observable was not the one I had assumed.
  ⚠ **AND A SECOND EMAIL SEAM REPORTED COVERAGE IT DID NOT HAVE, FAILING BY TIMEOUT RATHER THAN LOUDLY.**
  `referralNotify.js` carries its own `_sendEmail` while its comment claimed *"ONE SEAM, MATCHING THE
  WEBHOOK ROUTER'S"*. Overriding the router left the notify holding the real Resend client, so the two
  bonus emails went into the 7d-0 interlock's capture ledger where no assertion could see them — **nothing
  threw, nothing logged, the credit was correct, and four cases waiting on `emails.length >= 2` simply
  timed out.** `_setTestOverrides` forwards into the module now, and `_resetTestOverrides` resets it so one
  suite's stub cannot leak into the next.
  ⚠ **TWO INJECTIONS ARE DELIBERATELY TWO-PART, AND SAYING SO IS THE HONEST REPORT.** A duplicate
  delivery is refused by TWO independent mechanisms — `evaluateReferral`'s STEP 8 returns
  `conversion_already_recorded` **before** the writer runs, and the writer's `ON CONFLICT DO NOTHING`
  behind `UNIQUE(user_id, jobber_client_id)` is the net under it. **Breaking either alone leaves the
  outcome AND the reason string identical**, so a one-line injection reports width 0 against a property
  that is genuinely protected. Reporting that as a fence failing to fire would have been wrong, and
  calling it one edit would have misdescribed what the property rests on.
  ⚠ **AND A COMMENT OF MINE CLAIMED A MEASUREMENT I HAD NOT MADE, CORRECTED IN THE SAME COMMIT.** It said
  dropping `ON CONFLICT` leaves the duplicate case green "measured" — true, but only because STEP 8 shields
  the writer, which I had not established when I wrote it. **A recorded cost is a claim like any other number.**
  ⚠ **TWELVE GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY sha256
  ACROSS SEVEN WATCHED FILES, ANCHORS CHECKED UNIQUE IN BOTH DIRECTIONS, EMPTY-STRING REPLACEMENTS REFUSED
  OUTRIGHT, AND EVERY INJECTION CONFIRMED LANDED BEFORE ITS RESULT WAS BELIEVED.** Widths: (1) the supplied
  date ignored, the exact pre-fix state → **3**; (2) a pre-start client admitted → **2**; (3) the
  unknown-date guard removed, so the refusal survives and the DIAGNOSIS does not → **1**; (4) the financed
  gate back to `=== true` → **1**; (5) two-part, a duplicate emails twice → **3**; (6) two-part, a duplicate
  becomes an alert → **1**; (7) the catch-up stops crediting → **1**; (8) the rebuild preview names the
  credit → **1**; (9) the category resolver accepts any configuration → **1**; (10) the supplied/omitted
  distinction collapsed → **8**; (11) ruling 1's referral-record create removed → **2**; (12) the
  derivable-id filter removed → **1**.
  ⚠ **(10) IS WIDE BECAUSE THE INJECTION IS WIDE, NOT BECAUSE THE CASES ARE COUPLED** — every direct
  `creditReferralFromFacts` call in the suite omits the key, so collapsing the distinction breaks the
  stored read for all of them at once.
  ⚠ **THE HARNESS PARSES TAP, NOT THE DEFAULT REPORTER.** `# fail N` is pure ASCII and parsed by TOKENS;
  the default summary's prefix glyph is the one whose stripping produced `-1` for every count in an
  earlier arc, through four anchor spellings. Output is ASCII-folded, because a cp1252 `UnicodeEncodeError`
  in the printer after an injection has landed turns the printer into a source edit.
  ⚠ **CITATION ROT THIS COMMIT CAUSED, MEASURED AND NOT REPAIRED: 26 LIKELY ROTTED across six documents**
  (11 in `PRE_LAUNCH_CHECKLIST.md`, 6 in `TENANT_RESOLUTION_REBUILD_SPEC.md`, 3 in
  `MEMBER_RANK_ECONOMY_SPEC.md`, 2 in `SECURITY_HARDENING_SPEC.md`, 1 each in `CLAUDE_REGISTRY.md` and
  `CDL_3c_PHASE0_REPORT.md`), from +42 lines in `referralRules.js` and +38 in `webhooks/jobber.js`.
  **NOT repaired by adding the delta**, per this file's own rule: the commit that shipped `--changed-files`
  flagged eleven of its own and all eleven had already been wrong beforehand. Filed on
  `PRE_LAUNCH_CHECKLIST.md`.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CRASH-FIX COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2445 / 408 / 1410 / 86**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE CRASH-FIX COMMIT, BECAUSE IT SHIPS TESTS.**
  React 1398 → 1410 is **+12**, one new file (`src/components/admin/CRMSettings.test.jsx`), and 85 → 86
  is that file. **Server did not move — no `server/` file was touched at all** — and was re-measured.
  **All four predicted before the run and matched.** ⚠ **NO PHANTOM, ASKED BEFORE THE RUN:** the new
  file lives in `src/components/admin`, which **IS** one of `adminBranding.test.jsx`'s four walked
  roots — but that walker skips `.test.` files, so a new TEST file there adds nothing. Counted with an
  anchored `^\s*it\(` (12); the file's loops were each checked for POSITION — one in the module-scope
  fixture builder, four inside `it()` bodies — so **none wraps a case**.
  ⚠ **THE COMMIT FIXES A PRODUCTION CRASH THAT COMMIT B SHIPPED, AND THE ENTRY WORTH KEEPING IS WHY
  NOTHING CAUGHT IT.** Commit B's rewrite of the Referrer Field Mapping card used `crmDisplayName` in
  three places inside `renderFieldMappingCard()`; it was declared inside
  `renderCampaignFieldMappingCard()` — a DIFFERENT function — so the card threw
  `ReferenceError: crmDisplayName is not defined`. That card renders whenever
  `isConnected && !tokenError`, so **the error boundary blanked the ENTIRE CRM Settings page on every
  visit, surviving refresh.**
  ⚠ **`npm run lint` CANNOT CATCH THIS CLASS, BY DESIGN — A CLEAN LINT SHIPPED A `ReferenceError`.**
  The ESLint config is react-hooks rules only and this file says never add a recommended preset, so
  `no-undef` is not in the gate. Confirmed by running `no-undef` alone out-of-tree: it names the three
  references exactly. **Whether to add that single rule is a ruling, not a tidy-up.**
  ⚠ **AND THE GAP WAS NAMED IN THE COMMIT THAT FELL INTO IT.** Commit B's own report said *"no React
  test mounts `CRMSettings`"* — offered as the reason the React count would not move, and
  simultaneously the reason the crash could ship. **A noticed absence is not a covered one.** This is
  the *"any file a sweep touches needs at least one render test, however trivial"* rule with the sweep
  being an edit.
  ⚠ **THE MOUNT TEST ASSERTS THE PAGE RENDERED ITS OWN CONTENT, NOT THAT `render()` RETURNED.** A
  component that throws during render leaves an EMPTY container rather than raising out of `render()`,
  so *"it did not throw"* is satisfied by the crash itself. It waits for real text, asserts the three
  cards AFTER the crashing one exist, and asserts no `ReferenceError` reached the console.
  ⚠ **ONE GUARD-PROOF, AND IT IS THE PRE-FIX STATE RATHER THAN A SPELLING OF IT.** Removing the
  component-scope declaration — so the identifier is once again local to the other card — reds
  **12 of 12** and the test output contains the production string `crmDisplayName is not defined`.
  Reverted byte-identical by sha256.
  ⚠ **AND THE FIX IS ONE DECLARATION SHARED BY BOTH CARDS, NOT A SECOND COPY.** Pasting the expression
  into Card 3 would have stopped the crash and left two definitions of "what this CRM is called" that
  can drift. ⚠ **A `label`/`id` pair was added too, and it is load-bearing**: without the association
  `getByLabelText` cannot reach the control, so the test could only query a bare `select` — which would
  silently start matching a different one the day a second is added.
  ⚠ **MEASURED WHILE FIXING IT: 19 ADMIN COMPONENTS, ~13,750 LINES, ARE MOUNTED BY NO TEST** —
  `AdminCampaigns` alone is 4,327. Filed on `PRE_LAUNCH_CHECKLIST.md` with the priority argued by
  RENDER SURFACE rather than line count: `AdminSetPasswordScreen` and `AdminNoAccessScreen` are reached
  by people who have no other route in.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE COMMIT B COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2445 / 408 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE COMMIT B COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2418 → 2445 is **+27**, one new file (`referralSourceField.test.js`); suites 402 → 408 is that
  file's **six** top-level describes. React did not move and was re-measured — **and that is the reading
  worth checking, because this commit DOES touch `src/`**: `CRMSettings.jsx` is EDITED, and
  `adminBranding.test.jsx` emits one case per swept FILE, not per edit. No React test mounts
  `CRMSettings` at all (searched). **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (27); every loop checked for POSITION — two in the fixture helpers, one in
  `beforeEach`, one inside an `it()` body — so **none wraps a case**.
  ⚠ **THE COMMIT'S SUBJECT: A SETTING WITH STORAGE, AN EDITOR, AND NO DELIVERY.**
  `contractor_crm_settings.referrer_field_name` was stored, edited, PATCHed and returned in the adapter
  config — and read by NOTHING. Both extraction sites matched a hardcoded
  `f.label.toLowerCase() === 'referred by'`. Measured: the only consumer of `referrerFieldName` anywhere
  in `server/` or `src/` was the admin screen reading it back into its own box. **So a contractor who
  typed anything else had a setting that was accepted, echoed back and inert, on the field that decides
  who gets paid.** Five-states category (d), invisible to a check built from the schema and the admin
  panel because both halves look finished. ⚠ **No live damage, and that was luck: one row existed and it
  held the default, which happens to equal the literal.**
  ⚠ **THE FIELD IS PICKED BY CONFIGURATION ID, AND THE LABEL COLLIDES ON THIS TENANT TOO.** Accent has
  NINE `ALL_CLIENTS` configurations including BOTH `Referred by` (live) and `Referred by Chuck Rigdon`
  (archived), plus TWO rows labelled `Source`. **A prefix, substring or `ILIKE` match returns two and one
  of them is dead**, so the fallback is an EXACT normalised match (trim + collapse + case-fold) and the
  primary is the stored id. The migration moved Accent to `…CustomFieldConfigurationText/3655374`,
  verified live in the `ALL_CLIENTS` facts Commit A started capturing.
  ⚠ **THE RESOLUTION IS BY ID; THE DISCOVERED ROW IS ONLY FOR DISPLAY.** A picked field that discovery
  no longer lists is marked `missing` and **still resolves**, because a lagging discovery table must not
  stop a contractor earning. Injection (9) makes it refuse and reds that case.
  ⚠ **AND THE READER THROWS WHEN THE CALLER'S QUERY CANNOT ANSWER THE QUESTION.** If a field is mapped
  by id and no custom field on the record carries `customFieldConfiguration`, returning null would read
  as "not referred" and stop a payout silently — the class Commit A closed. It is LOUD instead. An empty
  array is a different thing and stays a legitimate null.
  ⚠ **THE BULK QUERIES HAD TO BE WIDENED TOO, WHICH THE SPEC DID NOT NAME.** `getReferredByValue` is fed
  by `pipelineSync`'s two BULK list queries, which selected `... on CustomFieldText { label valueText }`
  — no configuration id — so a mapped contractor would have hit that throw on every client. They take a
  **value-only** selection (the two shapes this product reads) rather than the full capture one, because
  cost scales with a 25-client page and they write no facts.
  ⚠ **STORED ON `contractor_crm_settings`, NOT AS A FIFTH KEY IN `contractor_field_mappings`, AND THE
  REASON IS MEASURED FROM THE HANDLER.** `PATCH /api/admin/jobber/field-mappings` **400s on any key
  outside its four** AND rebuilds the whole JSONB from those four — so a `referral_source` key there
  would be refused on write and then WIPED by an unrelated save from the campaign card.
  `parseMappingEntry` / `resolveMappedField` / `describeField` are still the resolution path.
  ⚠ **TWO GUARD-PROOFS FIRST REDDENED ONLY A SOURCE FENCE, AND THAT WAS THE ENTRY WORTH KEEPING.**
  The migration's behavioural cases drove a **RETYPED** copy of the SQL, so injecting `db.js` could not
  change them: production could have been broken with all eight green. **That is this file's own `$3`
  lesson, reproduced by the session quoting it.** The suite now EXTRACTS the statement from `db.js` and
  executes it; (6) and (7) then red **2** each, one behavioural.
  ⚠ **AND THE EXTRACTION ITSELF MATCHED THE WRONG STATEMENT FIRST.**
  `UPDATE contractor_crm_settings s` appears **twice** in `db.js` — the other is `rep_window_start` — so
  the first match sliced 340 characters of an unrelated migration. **A length floor written from the
  SUBJECT's plausible size caught it**; a floor built from the needle's own shape would not have.
  ⚠ **NINE GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY sha256
  ACROSS FOUR WATCHED FILES.** (1) the resolver matches by LABEL despite holding an id → **1**;
  (2) the fallback becomes a PREFIX match, admitting the archived Chuck Rigdon field → **1**; (3) an
  unmapped contractor read by the hardcoded literal instead of its stored name → **1**; (4) `pipelineSync`
  spells its own match again so the two doors can disagree → **1**; (5) the loud throw removed → **1**;
  (6) the migration stops requiring EXACTLY ONE match → **2**; (7) the migration overwrites a deliberate
  pick → **2**; (8) the bulk selection loses the configuration id → **1**; (9) a `missing` field stops
  resolving → **1**.
  ⚠ **A FALSY `contractorId` FALLS BACK TO THE DEFAULT LABEL, NOT TO null, AND A TEST IS WHY.**
  `syncSingleClient` tolerates a falsy contractor — `attributionWiring.test.js` case (c) drives it — and
  a null descriptor would return null for every client, making that whole path a silent no-op. The
  default label is what the hardcoded literal did, so this is the OLD behaviour spelled out.
  ⚠ **AND MY OWN FENCE READ A COMMENT AS THE DEFECT.** The "never a prefix match" assertion ran over RAW
  `db.js`, whose comment NAMES `LIKE 'referred by%'` as the form it rejects. Comments are stripped now —
  this is the one shape where rewording is not the fix, because the comment has to be able to say what it
  removed.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE COMMIT A COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2418 / 402 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE COMMIT A COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2399 → 2418 is **+19**, one new file (`customFieldSelectionParity.test.js`); suites 400 → 402
  is that file's **two** top-level describes. React did not move — **no `src/` file was touched at
  all** — and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (19); the file's loops were each checked for POSITION — two in the
  brace-matching helper, two in other helpers, one in `beforeEach`, the rest inside `it()` bodies —
  so **none wraps a case**.
  ⚠ **THE GATE WAS RUN TWICE AND THE SECOND RUN IS THE ONE CITED**, because a case in
  `categorySource.test.js` was RENAMED while the first was running. A rename cannot change a count —
  and *"it cannot have changed" is a prediction, not a measurement*, which is this block's own rule.
  Both runs read `EXIT=0` and the same seven numbers.
  ⚠ **THE COMMIT'S SUBJECT: THE MONEY DOOR CAPTURED ZERO CUSTOM-FIELD FACTS AND REPORTED SUCCESS.**
  `writeCustomFieldFacts` skips any field with no configuration id, and `webhooks/jobber.js` selected
  `customFieldConfiguration` **zero times** — measured with `grep -c`: webhook **0**,
  `repImportScope` **0**, `recaptureClients` **0**, `jobberClientFetch` **3**. So the invoice-paid
  door wrote no custom-field facts at all. **Two of its four selections carried no `customFields`
  whatsoever** — the INVOICE and the QUOTE — and `categorySource`'s ruling 1 reads the invoice copy
  FIRST, then the job, then the linked quote. 7d would therefore have returned `no_job_type_found`
  for every credit: a gate that silently never fires.
  ⚠ **THE reads-vs-selects FENCE STRUCTURALLY COULD NOT SEE IT, AND THAT IS NOT A FENCE FAILURE.**
  `customFieldConfiguration.id` sits at **depth 2** inside `customFields`, and that fence's derivation
  extracts top-level and single-nested fields only — a limit its own suite fences explicitly. **The
  reach was written down, which is the only reason this was findable at all.** The new suite is the
  depth-2 reader: it brace-matches every `customFields` block in the RESOLVED query text, per entity
  rather than per file, and requires the configuration id AND both value members.
  ⚠ **AND THE SECOND HALF OF THE SAME DEFECT: THE FULL-CAPTURE STAMP WAS DEAD ON EVERY WEBHOOK DOOR.**
  `fetchClientRelatedData` **does** call `certifyFullyPaged`, but its client selection had no `id`, so
  `captureClientFacts`'s stamp (`isCertifiedFullyPaged(client) && client.id`) was skipped — measured
  **10 of 19,598 clients stamped** while the webhook doors are the most frequent capture path. ⚠ **So
  adding `id` NEWLY ENABLES the stamp, which grows catch-up eligibility**; that is reported rather
  than slipped in, and it is one word to revert.
  ⚠ **A GUARD-PROOF MEASURED ONE OF MY OWN NEEDLES AT WIDTH 0 — THE SUBSTRING TRAP, IN THE FENCE.**
  The client-id case asserted `/\bid\b/` over the client-level slice, and that slice OPENS with
  `client(id: $id) {` and CONTAINS `customFieldConfiguration { id }`. Deleting the client's own `id`
  left it **GREEN**. Replaced with a TOKEN check over the scalar head (cut at the first `{`, so every
  sub-selection is dropped); injection (iv) then reds **2**, one of them behavioural.
  ⚠ **AND THE END-TO-END CASE PROJECTS ITS FIXTURE FROM THE REAL QUERY TEXT**, because a stub that
  answers a fixed fixture regardless of the query cannot discover a missing selection — the harness
  defect this file already records twice, where dropping `updatedAt` left 37/37 green and dropping
  `receivedDate` left 39/39 green. It asserts its own preconditions, so it cannot go vacuous quietly.
  ⚠ **SEVEN GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256 ACROSS THREE WATCHED FILES.** (i) the door's selections narrowed to the pre-fix shape → **3**;
  (i-b) the INVOICE copy's custom fields dropped → **exactly 1**; (ii) the Dropdown member removed →
  **3**; (iii) the `ALL_CLIENTS` write removed → **5**; (iv) the client `id` no longer selected → **2**
  (after the needle repair; **0** before, which is how the vacuity surfaced); (v) the writer stops
  skipping a field with no configuration id → **2**; (vi) the shared constant no longer exported →
  **3**.
  ⚠ **AND MY OWN HARNESS PARSED EVERY COUNT AS −1 THROUGH FOUR ANCHOR SPELLINGS, WHICH IS THE ENTRY
  WORTH KEEPING.** First CRLF sat between the digits and `$`; then the prefix glyph decoded to three
  `?` under the console's codepage; then I stripped the prefix with `while (!t[0].isalpha())` on the
  assumption that it is a symbol. ⚠ **`unicodedata.category('ℹ')` is `Ll` — a lowercase
  LETTER — so `isalpha()` is TRUE** and the loop stopped on the glyph itself. **A harness returning a
  plausible wrong number is the failure class**, and the only thing that found it was printing
  `repr()` rather than re-reading the code. It parses by TOKENS now. The printer is ASCII-folded,
  which is also why a `UnicodeEncodeError` in a probe did not leave a file injected.
  ⚠ **`repImportScope.js` IS DELIBERATELY EXCLUDED AND IT IS NOT AN OVERSIGHT.** It selects no
  `customFields` at all and calls `writeCustomFieldFacts` never, so there was nothing to widen — and
  it captures only the rep WINDOW per entity and can never stamp the full-capture marker, so facts
  written from it would be incomplete by construction. **Adding them is a ruling, not a tidy-up.**
  ⚠ **ONE EXISTING CASE WAS RENAMED AND CONTRIBUTES 0.** `categorySource.test.js`'s *"captures all
  THREE stages"* is still TRUE of its fixture — that client carries no `customFields` — so both its
  assertions hold **unchanged and unrelaxed**. Only the name misdescribed the mechanism once a fourth
  stage existed.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CATCH-UP-SCHEDULE COMMIT ITSELF, BECAUSE
  IT SHIPS TESTS.* It read **2399 / 400 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE CATCH-UP-SCHEDULE COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2375 → 2399 is **+24 = 23 + 1**: twenty-three in one new file (`fullCaptureMarker.test.js`) and
  **one APPENDED** to `captureDecisionSplit.test.js` (22 → 23). Suites 395 → 400 is the new file's
  **five** top-level describes only — the appended case landed in a describe that already existed.
  React did not move — **no `src/` file was touched at all** — and was re-measured. **All four predicted
  before the run and matched.** Counted with an anchored `^\s*it\(` (23); the file's six loops were each
  checked for POSITION — one `.map` in the comment-stripping helper, one `for` in `beforeEach`, one in
  the directory walk, three inside `it()` bodies — so **none wraps a case**.
  ⚠ **THE COMMIT'S SUBJECT: THE WRITER CANNOT KNOW WHETHER A FETCH WAS EXHAUSTIVE, SO THE FETCHER
  CERTIFIES IT.** Danny's ruling — the catch-up decides ONLY from COMPLETE history — after a preview
  measured the first selector moving **364 clients, 354 BACKWARDS, 353 off `'paid'`**. Sampled 21
  against Jobber live: **14 DATA GAP · 2 BOTH WRONG · 5 REAL CORRECTION**. Cause: `repImportScope`
  captures only the rep WINDOW per ENTITY, so 212 stored-`'paid'` clients have invoice facts with **no**
  job facts and 194 have invoices none of which are paid.
  ⚠ **A RATCHET WAS PROPOSED AND REJECTED, AND THE REASON IS THE ENTRY.** Refusing downward writes
  would also block the 5 genuine corrections and contradicts the ruling that reps always see the true
  stage. **The defect was never the DIRECTION of the move; it was deciding from data that is missing** —
  so the guard belongs upstream of the decision, not on its output.
  ⚠ **THE CERTIFICATION IS HONEST FOR A STRUCTURAL REASON, NOT BY CONVENTION.**
  `pageClientConnection` **throws** rather than returning a short set, so reaching either fetcher's
  `return` IS proof that all four connections drained. Certifying anywhere earlier would vouch for a set
  that had not finished paging — the one failure the mechanism cannot detect for itself.
  ⚠ **AND IT IS A SYMBOL, WHICH IS LOAD-BEARING.** `JSON.parse` cannot produce it, so a client object
  reconstructed from a webhook body — an untrusted, partial shape — can never forge completeness. It is
  **non-enumerable**, so a spread DROPS it and the stamp is skipped, which **fails CLOSED**. A string key
  like `fullyPaged: true` would be settable by any fixture that wanted a green test.
  ⚠ **NEVER BACKFILLED, AND UNLIKE `stage_derived_at` THAT IS NOT MERELY CAUTION — A BACKFILL WOULD
  RE-CREATE THE DEFECT.** Nothing already stored supports "every connection was paged to exhaustion at
  this moment", so stamping from `last_synced_at` or `captured_at` would declare partial data complete.
  **Eligibility is therefore 0 on the day it ships, by design**, and grows at ~58 clients a day.
  ⚠ **FIVE GUARD-PROOFS, EVERY REVERT BYTE-IDENTICAL BY sha256 ACROSS THREE WATCHED FILES.** (i) the
  stamp ungated → **2**; (ii) a cut-short page returning instead of throwing → **exactly 1**; (iii) the
  OLD rule restored, admitting a PARTIALLY captured client → **5**; (iv) completeness dropped entirely,
  admitting a FACTLESS client too → **7**; (v) `axios` added to the job → **2**, both no-Jobber fences.
  ⚠ **(iii) AND (iv) ARE DELIBERATELY DIFFERENT INJECTIONS RATHER THAN ONE REPORTED TWICE.** Under the
  new rule a partially-captured and a factless client are excluded by the SAME predicate, so dropping it
  would prove one thing and be reported as two. (iii) restores the old rule — admitting the partial while
  still excluding the factless; (iv) removes completeness altogether. Hence 5 against 7, (iv) strictly
  wider, which is what shows they are two measurements.
  ⚠ **AND A BEHAVIOURAL CASE IN THE SPLIT SUITE HAD TO CERTIFY ITS OWN FIXTURE — THE MECHANISM FAILING
  CLOSED, OBSERVED.** It hand-builds `relatedData`, so the capture saved facts and stamped nothing, and
  its assertion that the catch-up then finds the client failed. The fixture calls the PRODUCTION
  certifier now — a literal property would prove nothing — and additionally asserts the stamp landed.
  ⚠ **TWO EXISTING CASES ARE MARKED SUPERSEDED RATHER THAN DELETED, WITH THE OLD ASSERTIONS QUOTED.**
  The selector no longer reads fact timestamps, so *"the newest fact is the GREATEST across the tables
  that HAVE a captured_at"* describes a mechanism that no longer exists — its fixture now asserts the
  **INVERSE**. And the quote/request `captured_at` LIMITATION is **CLOSED for the selector**: a full
  capture pages quotes and requests too, so it stamps whichever connection changed. **Neither was a bug;
  a ruling changed the mechanism.**
  ⚠ **THE 6c RESET-COVERAGE FENCE CAUGHT THE NEW SUITE AND ITS PRESCRIBED FIX WOULD HAVE BEEN WRONG.**
  It said to add `cron_job_locks` to the per-test reset. That table is seeded by `initDB` and shared by
  every suite; clearing it would break `withLock` everywhere. The read moved into `before()`, which the
  fence deliberately excludes because a table seeded as the suite's BASELINE belongs there.
  **`KNOWN_GAPS` was NOT widened** — but *"follow the fence's message"* was the wrong move here, and
  knowing which fences prescribe a fix that does not fit is worth the line.
  ⚠ **AND THE BACKGROUND WRAPPER REPORTED exit 0 WHILE THE LOG'S OWN `EXIT=` LINE READ 1 — THE FIFTH
  RECORDED INSTANCE.** On that run React never ran at all, because the gate chains with `&&`.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 7d-0 COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2375 / 395 / 1398 / 85**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE 7d-0 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2359 → 2375 is **+16**, one new file (`resendInterlock.test.js`); suites 394 → 395 is that
  file's single top-level describe. React did not move — **no `src/` file was touched at all** — and was
  re-measured. **All four predicted before the run and matched.** Counted with an anchored `^\s*it\(`
  (16); the file's six loops were each checked for POSITION — two sit in helper bodies (`stripComments`,
  `serverFiles`) and four inside `it()` bodies — so **none wraps a case**.
  ⚠ **THE FOURTEEN SUITES THIS COMMIT EDITS CONTRIBUTE 0.** Each gains one `captureResend()` call and no
  case. A count that moves by exactly one file's worth while fifteen files changed is the expected shape.
  ⚠ **THE COMMIT'S SUBJECT: THE TEST SUITE WAS SENDING REAL EMAIL, AND THE NUMBER IS 109 A RUN.**
  `.env.test` sets no Resend key, but `server/db.js` calls `dotenv.config()`, so the real `re_…` key
  entered the process the moment any mailer was required. Measured by arming capture for every file:
  **122 logical sends per server-suite run, 109 of them to `admin1@roofmiles.com`** —
  almost all `errorLogger`'s first-occurrence alert. ⚠ **Counted through CAPTURE, not through refusals:
  a refusal is a throw and `retryWithBackoff` retries it, so refusals over-count a logical send several
  times over** (the raw firing count was 384 for 122 sends).
  ⚠ **AND IT WAS ALREADY FILED, TWICE — THIS COMMIT DISCOVERED NOTHING.** `PRE_LAUNCH_CHECKLIST.md`'s
  *"TEST-ENVIRONMENT LIVE-FIRE HAZARD"* named the mechanism AND the consequence, in those words, with a
  second instance for the Jobber key. What is new is the measurement and a structural guard in place of
  a per-suite mitigation. ⚠ **That entry forbids the root fix in a feature session, and this is NOT it:**
  `setup.js` still loads `.env`, so every other credential still leaks. Only the Resend half is closed.
  ⚠ **MY FIRST TWO READINGS WERE BOTH WRONG AND EACH CORRECTION MADE IT LARGER — WHICH IS THE ENTRY
  WORTH KEEPING.** I read fourteen red suites as fourteen suites mailing real people; most already
  replace the `resend` module in `require.cache` and assert on the recorded html, so their own subject
  matter never went out. I then reported SEVEN sends — true of those fourteen FILES and not of the suite,
  because **22 further senders never went red at all: their caller swallows a send failure.** The loud
  failures were the minority, and the silent majority was the actual exposure. **Both corrections came
  from measuring; neither came from re-reading.**
  ⚠ **AND A FALSE POSITIVE IN MY OWN GUARD, FOUND BEFORE IT SHIPPED.** `express-rate-limit`'s CommonJS
  interop invokes a property named `send` on a PLAIN OBJECT — 12 times in a 14-file run,
  `this.constructor.name === 'Object'`. The first writing answered all 12 with a throw. Narrowed on the
  RECEIVER by **class identity, never the name** — a name is exactly what collided — which closes no
  hole, because a non-`Emails` receiver cannot be a Resend send. Guard-proof (d) inverts it and reds 6,
  which is what proves that.
  ⚠ **I OVERCLAIMED THAT FALSE POSITIVE'S COST AND RETRACTED IT IN THE SAME COMMIT.** My comment said the
  12 became "unhandled rejections, twelve a run". Injecting the discriminator away and running four
  non-opted-in suites that perform the read produced **0** such reports, so the 16 pre-fix failures were
  the genuine post-test sends, not the interop read. **A recorded cost is a claim like any other number**,
  and that one had no source until it was counted.
  ⚠ **SEVEN GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY sha256.**
  (a) guard 2 never installed → **6**; (b) the key pin removed → **3**; (c) the discriminator firing on
  everything → **2**; (d) the discriminator swallowing a REAL send → **6**; (e) the fetch backstop
  removed → **exactly 1**; (f) capture never disarming → **3**; (g) the refusal ledger not recording →
  **exactly 1**. ⚠ **NO INJECTION EVER LEAVES A DELIVERABLE PATH**: guard 1 and guard 3 are never both
  removed, and neither is removed together with guard 2, so at least two of the three are always live.
  ⚠ **(f)'s FIRST INVERSE PATCH WAS REFUSED BECAUSE THE INJECTION WAS A SUBSET OF ITS OWN ANCHOR** —
  removing a line leaves the replacement already present, so the reverse anchor matched. The
  saved-original-bytes floor restored it byte-identically. **Third time that fallback has fired in this
  arc**, and the reason anchors are checked unique in BOTH directions.
  ⚠ **A SILENT GUARD IS THE SHAPE THAT CAUSED THIS, SO THE REFUSAL IS MADE VISIBLE.** 22 of the 36
  senders stay green under the interlock, so a per-file line is printed at exit naming the count and the
  recipients. **Deliberately not an assertion on the count**: some suites legitimately provoke an alert
  they have no interest in, and failing them would only teach people to disarm the interlock.
  ⚠ **AND THE HEREDOC ESCAPE TRAP AGAIN, ON `\n` INSIDE A PYTHON STRING IN A SHELL HEREDOC** — it
  arrived as a real newline, so the harness anchor matched 0 times. Repaired with an editor, which is the
  rule this file states and the habit that keeps costing time.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CAPTURE/DECISION-SPLIT COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2359 / 394 / 1398 / 85**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CAPTURE/DECISION-SPLIT COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2337 → 2359 is **+22**, one new file (`captureDecisionSplit.test.js`); suites 392 → 394 is
  that file's **two** top-level describes. React did not move — no `src/` file was touched — and was
  re-measured. **All four predicted before the run and matched.** ⚠ **Two EXISTING suites were
  changed and contribute 0**, which is the expected shape: `oneStatusDerivation.test.js` gained
  allow-list ENTRIES and no case, and `invoicePaidDerivableClient.test.js` was RE-POINTED, not extended.
  ⚠ **THE FIRST GUARD-PROOF EXPOSED A GAP IN MY OWN TESTING, AND THAT IS THE ENTRY WORTH KEEPING.**
  Danny's proof (a) — restore the shared transaction — reddened **only a SOURCE assertion: width 1.**
  A text check proves the shape is WRITTEN and says nothing about whether a decision failure leaves
  the facts behind, **which is the entire property of the ruling.** A BEHAVIOURAL case was added: it
  forces a real failure with a trigger on `pipeline_cache`, drives the REAL `upsertAndTagClient`, and
  asserts the job facts SURVIVE, the stage and `stage_derived_at` stay unset, the referrer-visible
  status is untouched, the alert names the DECISION rather than the capture, and the catch-up job now
  finds the client. (a) then reds **2**.
  ⚠ **AND IT FORCED AN HONEST SPLIT ON THE ALERT: the error_log ROW is behavioural, the `alert: true`
  FLAG is not.** The flag controls whether Resend sends, which no test observes without stubbing
  Resend, so it is pinned by a source assertion. Saying which half is which is the difference between
  a proof and a claim.
  ⚠ **TWO PROOFS WERE REPORTING SIX PRE-EXISTING FAILURES AS INJECTION RESULTS, CAUGHT BY QUESTIONING
  A WIDTH THAT LOOKED WRONG.** (c) changes one `alert` flag and reddened **7**, which cannot be right.
  Baseline check: `invoicePaidDerivableClient.test.js` was **already failing 6 of 8 on the clean
  tree** — it reads the `pipeline_cache` UPDATE **out of production source**, and this commit EXTRACTED
  that statement to `server/utils/referredStatus.js` so the door and the catch-up job share one copy
  of a money-adjacent write. **It failed LOUDLY on a moved target rather than slicing past it and
  asserting nothing**, which is precisely what that design is for. Re-pointed, not deleted: the
  subject moved, the claims did not. **Always baseline a suite an injection includes.**
  ⚠ **FIVE GUARD-PROOFS, TRUE WIDTHS AFTER THE REPAIRS.** (a) the shared transaction restored →
  **2 = 1 behavioural + 1 source**; (b) the catch-up selector neutralised → **8**; (c) the decision
  failure stops alerting → **exactly 1**; (d) the decision runs even when the capture FAILED →
  **2**; (e) the catch-up job reaches Jobber → **exactly 1**.
  ⚠ **AND THE BACKTICK RULE, HIT BY THE SESSION THAT HAS QUOTED IT ALL DAY.** A comment inside a SQL
  template literal quoted `` `captured_at` `` in backticks, which CLOSES the string. It surfaced as
  `SyntaxError: missing ) after argument list` with **`tests 1 · suites 0 · fail 1`** — the exact
  module-load signature this file names, and the LOUD variant. **Reworded, never escaped**, and the
  five files this arc touched were swept for the same shape (0 found). **Knowing the rule is not the
  mechanism; the `suites 0` reading is.**
  ⚠ **AND AN INVERSE PATCH REFUSED AGAIN, FOR THE OVERLAPPING-ANCHOR REASON — AND THE FLOOR HELD.**
  Injection (e) prepends a line, so the reverse anchor sits inside the injected text; `patch` refused,
  and the saved-original-bytes fallback restored the file byte-identically by sha256. **That fallback
  exists because the same refusal once left a file injected**, and this is the second time it has
  fired — the floor is not decoration.
  ⚠ **A REAL LIMITATION FOUND AND FILED RATHER THAN SMOOTHED OVER: `crm_quote_facts` AND
  `crm_request_facts` HAVE NO `captured_at`.** Only the job and invoice fact tables do, so the
  catch-up job's "facts are newer" branch cannot see a quote-only change. Their `created_at` is the
  JOBBER record's own date, and reading it would call every old quote newer than the decision forever
  — absent is better than wrong. ⚠ **The branch the ruling depends on is unaffected**:
  `stage_derived_at IS NULL` catches every failed or never-made decision. A case named *"CURRENT
  LIMITATION"* asserts from `information_schema` exactly which tables have the column, so closing it
  means deleting a named case.
  ⚠ **AND `stage_derived_at` IS DELIBERATELY NOT BACKFILLED.** Backfilling from `last_synced_at` would
  have avoided a large first run and would have asserted of ~19,565 clients that they were decided at
  a moment that column does not describe — so a client whose decision had FAILED would look decided
  and be missed. **Doing extra idempotent work is recoverable; missing a client is permanent and
  invisible.** The job is bounded by a limit and reports what it did not reach.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 7c-2 COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2337 / 392 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE 7c-2 COMMIT, BECAUSE IT SHIPS TESTS.** Server 2305 → 2337
  is **+32**, one new file (`categorySource.test.js`); suites 387 → 392 is that file's **five**
  top-level describes. React did not move — **no `src/` file was touched at all** — and was
  re-measured. **All four predicted before the run and matched.** Counted with an anchored `^\s*it\(`
  (32); every loop was checked for POSITION — two in `beforeEach`, one in the seeder, one in the
  comment-stripping helper, the rest inside `it()` bodies — so **none wraps a case**.
  ⚠ **A GUARD-PROOF FOUND ONE OF THIS COMMIT'S OWN CENTRAL CASES VACUOUS, AND THE CAUSE IS A
  PARAMETER ORDER — WHICH IS THE ENTRY WORTH KEEPING.** The seeder was
  `seedConfigurations(tenant = TENANT, { linkInvoice } = {})` and one call site passed
  `seedConfigurations({ linkInvoice: true })`, binding the OBJECT to `tenant`. **All four
  configurations landed under contractor_id `[object Object]`, so the table was EMPTY for the real
  tenant** — and the case named *"IGNORES a same-label field with NO link"*, which is the refusal
  ruling 1 is built on, passed because **nothing was acceptable** rather than because the link was
  followed. It passed identically under the label-matching injection: width 0 on the one case the
  commit exists for.
  ⚠ **FIXED BY THE SHAPE, NOT THE INSTANCE.** The seeder takes ONE options object now, so the
  mis-call is unexpressible; and the case asserts its own precondition — all four configurations
  present, the decoy UNLINKED and sharing the label, the counterpart LINKED — so it cannot go
  vacuous again. **Found by a red count that disagreed with the prediction by one**, then measured by
  printing the acceptable set from inside the resolver. Reading the test could not have found it.
  ⚠ **AND A SECOND GUARD-PROOF CAME BACK GREEN ON A FENCE OF MINE THAT MATCHED ITS OWN COMMENT.**
  The reads-vs-selects fence asserted `customFieldConfiguration { id }` against the whole file — and
  that file carries a COMMENT containing the exact phrase, explaining why the record-level selection
  takes no fragments. So injection (vi), which removes the real selection, left it green. **Comments
  are stripped line-preservingly now**, with a floor asserting the comment copy still exists and
  that exactly ONE occurrence survives the strip. ⚠ **This is "scans read comments" with the sign
  flipped — prose SATISFYING a required pattern** — the same shape as the lock-door fence satisfied
  by the word "doors".
  ⚠ **SIX GUARD-PROOFS, EVERY REVERT BYTE-IDENTICAL BY sha256.** (i) the acceptable set matched by
  LABEL → **2** (after the repair; **1** before, which is how the vacuity surfaced); (ii) the invoice
  copy ignored when present → **7**; (iii) a blank invoice copy no longer falls through → **5**;
  (iv) a differing copy not recorded → **3**; (v) the job fallback removed → **7**; (vi) the capture
  drops the configuration id → **exactly 1** (after the fence repair; **0** before).
  ⚠ **AND ONE INJECTION WAS INVALID AND WAS DISCARDED RATHER THAN READ.** A permissive form written
  `AND label IS NOT NULL AND $2 IS NOT NULL` left `$2`'s type undeterminable, so Postgres refused the
  statement and **18 of 32** went red. **18 red from a one-line change is a tell, not a result** —
  the SQL-breaking shape this file already records twice.
  ⚠ **AND MY OWN HARNESS EXECUTED ON IMPORT, WHICH IS A SOURCE EDIT DISGUISED AS A LIBRARY.**
  Importing it to reuse one helper re-ran all six proofs and then fought a manual patch, leaving a
  file momentarily divergent. Recovered and verified. One-off scripts carry
  `if __name__ == "__main__":` now; the proof harness still needs it.
  ⚠ **TWO SCHEMA FACTS THAT LOOK ALIKE AND HAVE OPPOSITE REQUIREMENTS, BOTH VERIFIED LIVE AT THE
  PINNED 2026-05-12.** `transferedFrom` on a CONFIGURATION is a **UNION** — `transferedFrom { id }` is
  REJECTED and it needs an inline fragment per member (all six carry it). `customFieldConfiguration`
  on a RECORD is the **CONCRETE** matching type — `{ id }` is correct and fragments are rejected with
  **thirty** errors, one per illegal pair. ⚠ **And the record-level union is `CustomFieldUnion`, not
  `CustomField`**; introspecting the obvious name returns null.
  ⚠ **THE LIVE DATA VALIDATED RULING 2 BEFORE A LINE OF IT WAS TESTED.** A real Accent job reports
  `""` on `730114` while its invoice copy (`730115`) reports `"Out of Pocket"` — so "blank is absent,
  fall through" is a production shape, not a defensive branch.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE TARGETED-RE-CAPTURE COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2305 / 387 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE TARGETED-RE-CAPTURE COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2286 → 2305 is **+19**, one new file (`recaptureClients.test.js`); suites 384 → 387 is that
  file's **three** top-level describes. React did not move — **no `src/` file was touched at all** —
  and was re-measured. **All four predicted before the run and matched.** Counted with an anchored
  `^\s*it\(` (19); the file's six loops were each checked for POSITION — two in `beforeEach`, one in
  the comment-stripping helper, three inside `it()` bodies — so **none wraps a case**.
  ⚠ **`oneStatusDerivation.test.js` GAINED AN ALLOW-LIST ENTRY AND NO CASE, SO IT CONTRIBUTES 0** —
  the expected shape when a list grows rather than a describe.
  ⚠ **THE GATE WENT RED FIRST AT `fail 1`, AND IT WAS N4 COMMIT 1's OWN FENCE CATCHING THIS COMMIT
  UNPROMPTED — WHICH IS THE ENTRY WORTH KEEPING.** The new job writes the displayed stage, so the
  writer-accounting fence failed naming `server/jobs/recaptureClients.js:194 — function
  runRecaptureClients` before the commit could land. **That is the allow-list mechanism working on a
  real arrival rather than on an injection**: commit 1 built it so a new writer of `pipeline_stage`
  has to be ARGUED FOR instead of arriving, and it has now been paid for once. Registered as
  **SANCTIONED rather than carved out**, because the job satisfies the property the fence enforces —
  capture, then decide, then write what was decided — rather than being excused from it. Its span
  count is pinned at 1, and the job's own suite separately asserts exactly one `UPDATE
  jobber_clients`, so a second stage write cannot hide behind the entry from either side.
  ⚠ **AND A GUARD-PROOF CAME BACK GREEN ON A FENCE I HAD WRITTEN WRONG, WHICH IS THE OTHER ENTRY.**
  The new suite forbids the job writing `pipeline_status`, and the needle was
  `(INSERT INTO|UPDATE|DELETE FROM)\s+pipeline_status`. ⚠ **`pipeline_status` IS A COLUMN.** The real
  statement is `UPDATE pipeline_cache SET pipeline_status = …`, so the verb is followed by the TABLE
  and the needle could never match the defect it was named for; injection (v) added exactly that
  write and all 18 cases stayed green. ⚠ **MY NON-VACUITY FLOOR HID IT, AND THAT IS THE
  TRANSFERABLE PART: it asserted the needle matched `UPDATE pipeline_status SET x = 1`** — a string
  nobody would ever write. **A floor built from the NEEDLE's shape rather than from the DEFECT's
  shape only confirms the needle matches itself.** Both needles now read the table and the
  assignment, every floor uses a statement in the shape production would really take, and the
  paired negative is LIVE rather than synthetic — the job genuinely `SELECT`s `pipeline_cache`, so
  the verb anchor is load-bearing and the real source proves it.
  ⚠ **AND THE HARNESS LEFT A FILE INJECTED, FOR THE BOTH-DIRECTIONS REASON THIS FILE ALREADY
  RECORDS FROM `db.js`.** Injection (v) was written as the anchor PLUS an extra line, so the
  reverse anchor — the original line — was still present inside the injected text; `patch` correctly
  refused, and the `finally` raised **before writing**. Recovered by hand and re-verified. Two fixes:
  the injected text no longer contains the anchor it replaces (`client: client`, behaviourally
  identical), and the harness now keeps the ORIGINAL BYTES and restores them if the inverse patch
  refuses. **The inverse patch is still the primary revert — it proves the injection was exactly
  undone — and this is the floor under it**, not a `git checkout`, which on an uncommitted file
  discards real work.
  ⚠ **SIX GUARD-PROOFS, EVERY REVERT PROVEN BYTE-IDENTICAL BY sha256.** (i) the `pipeline_cache`
  refusal disabled → **2**; (ii) the stage no longer decided from saved facts → **6**; (iii) the
  stage write dropped → **8**; (iv) the stage UPDATE loses its contractor scope → **exactly 1**;
  (v) a forbidden `pipeline_status` write added → **2** (after the needle was repaired; **0**
  before, which is how the defect was found); (vi) the per-client lock removed → **0 behavioural**,
  see below.
  ⚠ **(vi) IS RECORDED AS WIDTH 0 RATHER THAN QUIETLY FIXED.** Removing `withClientLock` changed
  nothing, and correctly so: every case in the file drives ONE re-capture and **a single caller is
  serialised by definition**, so nothing a single-threaded test asserts can tell locked from
  unlocked. The anomaly the lock prevents is a LOST UPDATE between two concurrent units, which needs
  real concurrency (`clientLock.test.js` owns that property and pays for it in elapsed time). A
  STRUCTURAL case now pins the POSITION — capture, decide and the stage write inside the locked
  extent, the Jobber fetch outside and before it — and (vi) reds **exactly 1** against it.
  ⚠ **AND THE BACKGROUND TASK REPORTED exit 0 WHILE THE LOG'S OWN `EXIT=` LINE READ 1** — the
  fourth recorded instance of that disagreement. **Read the `EXIT=` written into the log.** On that
  red run the React step never ran at all, because the gate chains with `&&`, so a tail would have
  shown no React numbers and no reason.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE INVOICE-PAID PARAMETER-CAST COMMIT
  ITSELF, BECAUSE IT SHIPS TESTS.* It read **2286 / 384 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE INVOICE-PAID PARAMETER-CAST COMMIT, BECAUSE IT SHIPS
  TESTS.** Server 2278 → 2286 is **+8**, one new file (`invoicePaidDerivableClient.test.js`); suites
  382 → 384 is that file's **two** top-level describes. React did not move — **no `src/` file was
  touched at all** — and was re-measured. **All four predicted before the run and matched.** Counted
  with an anchored `^\s*it\(` (8); the file's single loop sits inside `beforeEach`, iterating tables to
  clear, so it wraps no case.
  ⚠ **THE COMMIT FIXES A 7b REGRESSION THAT RAN FOR THREE HOURS ON THE MONEY DOOR, AND THE GATE WAS
  GREEN THE WHOLE TIME BECAUSE THE CODE NEVER RAN.** 7b's `pipeline_cache` UPDATE used `$3` **twice** —
  assigned to `pipeline_status` (a `VARCHAR(50)` column) and compared to a bare literal inside a `CASE`
  — which Postgres refuses at PREPARE with *"inconsistent types deduced for parameter $3"*. ⚠ **It
  failed on EVERY invocation, not on certain data**: the error is a property of the SQL text, so no
  value could have made it work. Fixed with `$3::text` in both uses.
  ⚠ **AND THE COST WAS NOT THE STATUS, IT WAS THE CAPTURE.** The statement shares its transaction with
  `captureClientFacts`, so the throw rolled the capture back too — measured at **7 clients between
  12:55 and 15:46 UTC**, one of them (`gid://Jobber/Client/154808209`) left with **0 job facts**. The
  transaction coupling that amplified it is filed on `PRE_LAUNCH_CHECKLIST.md` rather than changed,
  because one transaction is what makes capture-and-decide atomic and splitting it buys a *different*
  inconsistency.
  ⚠ **A NEW GUARD MADE EVERY PRE-EXISTING FIXTURE SKIP THE NEW BRANCH — THAT IS THE ENTRY WORTH
  KEEPING.** `invoicePaidWebhook.test.js` drives the whole webhook end to end, and its client id is
  `'jobber-c1'`, which commit 2's `isDerivableJobberClientId` **rejects**. So the guard added for good
  reasons meant no existing case could reach the block 7b added. **When a commit puts a branch behind a
  NEW predicate, one test must be shown to ENTER it — assert the precondition, not only the outcome.**
  ⚠ **AND THE SUITE READS THE UPDATE OUT OF PRODUCTION SOURCE RATHER THAN RETYPING IT**, because the
  defect was in the SQL TEXT: a retyped copy carrying the fix would pass while production stayed
  broken. Non-vacuity floors prove the extraction found a statement at all.
  ⚠ **THREE GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256.** (i) the exact pre-fix SQL, `$3` uncast in BOTH uses → **6 red** (5 behavioural + the source
  fence); (i-b) the plausible HALF-fix, casting the assignment and leaving the comparison bare →
  **1 red, the source fence ONLY**; (ii) `alert: false` restored → **exactly 1**.
  ⚠ **(i-b) IS RECORDED BECAUSE IT MEASURES THE FIX AS SMALLER THAN IT LOOKS.** One cast is
  behaviourally sufficient; both are written anyway so no bare `$3` can return to either position, and
  the fence is what pins that. **The second cast is belt-and-braces, not a correctness requirement, and
  saying otherwise would overstate the fix.**
  ⚠ **AND I REPORTED IT AS "NOT MINE, BUT REAL" — A TRUE MEASUREMENT WITH A FALSE INFERENCE.** I
  established that the earliest occurrence (12:55) predated the 7c-0 deploy (13:09) and concluded it was
  pre-existing. **I never asked whether it POSTDATED 7b**, which is also mine; the three-hour lag had a
  checkable cause, in that the block runs only for invoice-paid AND only for a derivable client id, so
  7b sat inert until the first qualifying webhook. **"It predates commit X" is not "it is not mine"
  when there is a commit Y.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 7c-1 COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2278 / 382 / 1398 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE 7c-1 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2245 → 2278 is **+33**, one new file (`fieldMappingEntity.test.js`); suites 374 → 382 is that
  file's **eight** top-level describes. React did not move and was re-measured — **no phantom, asked
  before the run**: this commit adds no new non-test file under `src/utils`, `src/constants`,
  `src/components/admin` or `src/components/superAdmin` (it EDITS `CRMSettings.jsx`, and
  `adminBranding.test.jsx` emits one case per swept FILE, not per edit). **All four predicted before
  the run and matched.** Counted with an anchored `^\s*it\(` (33); every loop was checked for POSITION
  and all sit inside `it()` bodies.
  ⚠ **A LABEL IS NOT AN IDENTIFIER, AND ON THE LIVE TENANT IT COLLIDES ON THE FIELD THAT DECIDES
  MONEY.** Measured against Jobber 2026-05-12: `accent-roofing-dev` has **27** custom field
  configurations and **THREE** named "Job Type" — `Dropdown/730114` on **ALL_JOBS** (transferable, 19
  options), `Dropdown/730115` on **ALL_INVOICES** (the *same* 19 options), `Dropdown/1573072` on
  **ALL_QUOTES** (7 different options). "Insurance Company" appears **four** times. Discovery
  de-duplicated **by name** and kept the first, discarding **10 of 27** and letting Jobber's response
  order decide which field the payout engine was configured against. **It kept the right one by
  luck**, and the collision had already put quote-vocabulary values on a job-reading schedule.
  ⚠ **THE ENTITY IS `appliesTo`, AN ENUM WITH SEVEN VALUES, AND THERE IS NO REQUEST ENTITY.**
  `ALL_PROPERTIES · ALL_CLIENTS · ALL_QUOTES · ALL_JOBS · ALL_INVOICES · ALL_PRODUCTS_AND_SERVICES ·
  TEAM`. "quote, job, invoice, client, request" is the natural guess and it is wrong — a custom field
  cannot attach to a request, so nothing downstream may offer one.
  ⚠ **AND THE MIGRATION CREATED A NEW STATE THAT WOULD HAVE BROKEN FOUR READERS, TWO OF THEM
  SILENTLY — THIS IS THE ENTRY WORTH KEEPING.** The mapping's value changes from a string to
  `{ field_id, entity, label }`, and `object || 'Job Type'` yields the OBJECT. `deriveJobberTags`
  then calls `.toLowerCase()` on it, throwing a TypeError **it catches itself** — every tag for every
  client stops, with one `error_log` row. `evaluateReferral` normalises it to null, matches no field,
  and returns `no_job_type_found` for **every referral** — undoing exactly what 7c-0 had repaired.
  **Neither raises anything a person would see.** All four readers route through one parser now, with
  a source fence and a harness floor proving the needle catches the pre-7c-1 form.
  ⚠ **A GUARD-PROOF CAME BACK WITH NO BEHAVIOURAL RED AND THAT WAS A FINDING, NOT A PASS.** Restoring
  the de-duplication failed only a SOURCE fence: every case in the new file **seeded
  `contractor_jobber_fields` rows directly**, so none could observe what discovery does to a
  RESPONSE. **A test that injects the stored rows cannot discover that discovery discarded them** —
  the same shape as a test injecting a value it claims something upstream supplies. A transport seam
  (`_setJobberHttpForTest`) was added and seven cases now drive the real function; (i) reds
  **2 = 1 behavioural + 1 structural**.
  ⚠ **THREE WIDTHS.** (i) discovery de-duplicates by label again → **2 = 1 behavioural + 1
  structural**; (ii) the mapping resolves by label despite holding an id → **2**, including the
  QUOTE-field paired case that is the only thing able to tell the two apart, since the job and
  invoice fields share an option list; (iii) Accent's migration pointed at the QUOTE field →
  **2 = 1 behavioural + 1 source fence**. Every revert an inverse patch in a `finally`, byte-identical
  by sha256, anchors unique in BOTH directions.
  ⚠ **AND THREE THINGS DISCOVERY WAS DOING WRONG BESIDES THE DEDUPE, ALL SILENT.** It **never paged**
  (no `first:`, no cursor — Accent's 27 fit in one page, which is why it was invisible); it stored
  **archived** fields as live (**12 of 27** are archived — this read **11** until 2026-09-30, when a
  post-7c-1 Run Discovery measured 12; whether one was archived in Jobber in between or the original
  count was off by one is NOT established, and saying which would be inventing a source. The
  correction is recorded rather than made silently, because the figure is a claim about the CURRENT
  tenant rather than a dated snapshot — and the mapping screen listed them
  indistinguishably); and `CustomFieldConfigurationArea` was in `TYPE_MAP` **with no fragment in the
  query**, so those configurations arrived nameless and were dropped — a whole field type invisible
  while the type map claimed to handle it.
  ⚠ **WHAT 7c-1 DOES NOT ACHIEVE, SAID SO NOBODY OVERREADS IT.** It makes the CONFIGURATION
  unambiguous, and therefore the option list and the entity. Matching a VALUE on a record is **still
  by label**, because the capture queries select `{ label, valueDropdown }`. ⚠ **That id IS
  selectable** — `customFieldConfiguration { id name appliesTo }` on a record's custom field,
  verified live, and an Accent job reports `730114 / ALL_JOBS` through it. Selecting it is 7c-2's job.
  ⚠ **AND THE ADMIN SCREEN WAS KEYED ON THE LABEL, SO THREE ROWS SHARED ONE SLOT.** Picking a target
  on any "Job Type" row appeared to pick it on all three and only one could be saved. Re-keyed on the
  CRM id, with the entity rendered ("Job Type (Job)") and a guard against two fields claiming one
  target — a clash that was **unexpressible** while the rows were collapsed.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 7c-0 COMMIT ITSELF, BECAUSE IT SHIPS
  TESTS.* It read **2245 / 374 / 1398 / 85**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE 7c-0 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2219 → 2245 is **+26 = 17 + 9**: seventeen in one new file (`categoryMatch.test.js`) and
  nine APPENDED to `referralRules.test.js` (8 → 17). Suites 369 → 374 is **+5 = 4 + 1** — the new
  file's four top-level describes plus the one appended describe. React 1397 → 1398 is **+1, A
  PHANTOM**, and files hold at 85. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(`; every loop was checked for POSITION — the `.map`/`.filter` chain sits inside
  the mirror fence's `bodyOf()` helper and the one `for` inside an `it()` body — so none wraps a case.
  ⚠ **THE PHANTOM WAS PREDICTED AND ITS MECHANISM IS THE ONE THIS FILE KEEPS RECORDING:**
  `src/utils/categoryMatch.mjs` is a non-test file in a walked root, and `adminBranding.test.jsx`
  **sweeps `.mjs` as well as `.js`/`.jsx`** — a detail worth re-reading rather than remembering, since
  the 3b walker does NOT include `.mjs`.
  ⚠ **AND THAT SWEEP CARRIED A COMMENT MY OWN COMMIT FALSIFIED, CORRECTED RATHER THAN LEFT.** Its
  `.mjs` case said *"registrySections.mjs is the only .mjs under a walked root today"*. There are two
  now. **The ASSERTION was always a `toContain` and never a count, so nothing broke** — only the
  sentence beside it, which the next reader would have used to conclude the walker has one `.mjs` to
  worry about.
  ⚠ **THE COMMIT'S SUBJECT: THREE PLACES COMPARED A CATEGORY VALUE THREE DIFFERENT WAYS AND NONE
  TRIMMED.** The engine lowercased in SQL and in JS; `deriveJobberTags` folded case on the label; the
  Schedule Builder used an exact, case-sensitive `includes`. **Two of Accent's nineteen live Jobber
  options carry a trailing space** (`'Skylight Install '`, `'Gutter Cleaning '`), so the looseness was
  reachable — and it produced a **false negative in the engine** (a referrer silently unpaid) and a
  **false positive in the admin panel** (a real option reported missing) **on the very same pair. One
  bug, two directions**, now one matcher.
  ⚠ **AND THE ENGINE WAS THE ONLY READER IGNORING THE CONTRACTOR'S MAPPING.** It hard-coded
  `f.label === 'Job Type'`, so a contractor who renamed the field kept perfectly correct TAGS and
  stopped qualifying for every payout schedule — silent, because `no_job_type_found` writes no row and
  raises no alert. The `|| 'Job Type'` **fallback is kept deliberately**: `deriveJobberTags` has the
  identical one, and the two readers must resolve the same field for an unmapped contractor or their
  tags and their payouts would disagree. **Removing it would have looked like a cleanup and broken
  every unmapped contractor** — a case says so.
  ⚠ **FOUR WIDTHS, AND TWO OF THEM REPORT TWO THINGS AT ONCE SO THEY ARE SPLIT.** (i) TRIM removed
  from the shared normaliser → **10 red = 9 behavioural/unit + 1 the MIRROR-DRIFT fence** (only the
  server copy was injected, so the two copies diverge — the fence working, but not evidence about
  behaviour); (ii) the hard-coded label restored → **exactly 1**; (iii) case-sensitive label
  comparison → **exactly 1**; (iv) the guardrail always returning no findings → **2 = 1 behavioural +
  1 mirror fence**, **and the PAIRED POSITIVE stayed green**, which is what proves the guardrail is
  not simply flagging everything.
  ⚠ **AND A CONFIGURATION CHANGE INVALIDATED A GUARD-PROOF BETWEEN THE DESIGN AND THE BUILD — THIS IS
  THE ENTRY WORTH KEEPING.** (i) was specified as *"remove TRIM → `Skylight Install ` no longer
  matches"*. By build time Danny had re-picked the qualifying types in the Schedule Builder, and the
  key is now stored **with** Jobber's space — so the space sits on **both** sides and removing TRIM
  changes nothing. **The injection would have come back GREEN and proved nothing.** Rewritten around
  fixtures where key and value genuinely differ, in both directions. **An injection that cannot reach
  a discriminating value is not a guard-proof, and a change in production DATA can turn a valid one
  vacuous without touching a line of code.**
  ⚠ **THE SAME RECONFIGURATION ALSO RETIRED THE COMMIT'S OWN HEADLINE, WHICH IS SAID PLAINLY RATHER
  THAN QUIETLY DROPPED.** 7c's design measured Accent able to pay on **1 of 19** job types; after
  Danny's re-pick it is **8 of 19**, and all eight match even without TRIM. **So this commit is
  durability, not a live repair** — protection against the trailing space being tidied in Jobber
  later, or a key arriving by any route other than clicking a pill. Claiming the repair would be
  taking credit for a configuration change.
  ⚠ **AND I REPORTED "THE EXISTING GUARDRAIL CANNOT SEE IT" AND WAS WRONG — CORRECTED IN THE SAME
  COMMIT, INCLUDING IN THE CHECKLIST WHERE I HAD WRITTEN IT.** `ScheduleBuilderDrawer.jsx`'s Step 2
  has always computed the inverse check and rendered it as amber *"Currently assigned (not in Jobber
  fields)"* pills. True statement: the **list-level** warning covers only the other direction, and the
  Step 2 check is reachable only by opening each schedule. **I conflated two mechanisms and reported a
  VISIBILITY gap as total blindness** — the *state-the-scope-beside-the-claim* failure, committed into
  the file that records it. 7c-0 therefore **REUSES** that check rather than adding a second.
  ⚠ **AND THE HEREDOC ESCAPE TRAP AGAIN, ON AN APOSTROPHE THIS TIME.** Appending the behavioural block
  through a quoted shell heredoc died on `unexpected EOF while looking for matching`. Verified the
  target file was untouched, then wrote the block to a FILE with an editor and appended it with a
  script — which is the rule this file states and the habit that keeps costing time.
  ⚠ **AND `cancelled 0` WAS EARNED RATHER THAN OBSERVED.** The new block's first run reported ten
  CANCELLED cases and `Cannot use a pool after calling end on the pool` from inside `initDB`, because
  it kept its own `before`/`after` and `initTestDb()` returns the **`server/db.js` pool SINGLETON** —
  so the first describe's teardown ended the pool the second needed. Hoisted to **one pool per FILE**.
  **The exact shape this file records, hit by the session that had read it.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 7b COMMIT ITSELF, BECAUSE IT
  SHIPS TESTS.* It read **2219 / 369 / 1397 / 85**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 7b COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2210 → 2219 is **+9**, one new file (`referredStatusFromFacts.test.js`); suites 367 → 369
  is that file's **two** top-level describes. React did not move — no `src/` file was touched at
  all — and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (9); the file's two loops were each checked for POSITION — a `.map` inside
  the `captureShape` fixture helper and a `for` inside `beforeEach` — so **neither wraps a case**.
  ⚠ **THE GATE WAS RUN TWICE AND THE SECOND RUN IS THE ONE CITED**, because a comment-only edit to
  `crm/pipelineSync.js` landed while the first was running. **A comment cannot change a count — and
  "it cannot have changed" is a prediction, not a measurement**, which is this block's own rule.
  Both runs read `EXIT=0` and the same seven numbers.
  ⚠ **THE NEW SUITE FOUND A DEFECT IN THE COMMIT IT WAS WRITTEN FOR, AND THAT IS THE ENTRY WORTH
  KEEPING.** The Jobber fetch sat **outside** the try/catch that handles a failed capture, so a
  fetch failure escaped `syncSingleClient` entirely: the referral record was not written at all and
  a brand-new referred client simply **did not appear**. ⚠ **A FETCH failure IS a capture failure,
  and it is the MOST LIKELY one** — precisely the transient Jobber failure the ruling is about — so
  the one path the handler most needed to cover was the one it could not see. Found by the case
  named `(ii)`, on its first run, **not by reading the block I had just written.**
  ⚠ **THE RULING IS REFINED A, AND IT TURNS ON `$5` RATHER THAN `EXCLUDED.pipeline_status`.**
  A failed capture leaves an EXISTING row's `pipeline_status` and `paid_at` **alone**, and gives a
  NEW row `'lead'` plus a NULL `status_derived_at` marker. `EXCLUDED` carries the INSERT's
  `COALESCE($5, 'lead')` and is therefore **never null**, so reading it on the conflict branch
  would write `'lead'` over a real stage on every failed capture; the bare parameter is what makes
  "leave it alone" expressible. ⚠ **A live-classify fallback was REJECTED**: the live object is
  truncated by construction (`jobs(first: 50)`, an unpaged `invoices`), so a transient failure could
  downgrade a `'paid'` client to `'sold'` — and **a referrer-visible stage must never move
  backwards.** ⚠ **NULL was rejected too, for a different reason**: `STATUS_CONFIG` has no null key
  and `StatusBadge` no null guard, so it **throws** rather than rendering.
  ⚠ **FOUR WIDTHS, AND (iii) REPORTS TWO THINGS AT ONCE SO IT IS SPLIT.** (i) the conflict branch
  reading `EXCLUDED.pipeline_status` — the defect exactly → **exactly 1 red**, the existing-paid
  case; (ii) `COALESCE($5, 'lead')` dropped from the INSERT so a new row stores NULL → **4 red**,
  and crucially **two of them are the amended cases in `oneEngineFromFacts` and
  `attributionWiring`**, which is the evidence those amendments are load-bearing rather than
  decorative; (iii) a live classify restored on the failure path → **5 red = 4 behavioural + 1
  STRUCTURAL** (the commit-1 call-site fence, naming the file and line) — the behavioural width is
  4; (iv) `status_derived_at` never cleared → **exactly 1 red**, the healing case.
  ⚠ **AND THE HARNESS CRASHED ON A cp1252 CONSOLE AFTER AN INJECTION HAD LANDED — THE EXACT FAILURE
  THIS FILE RECORDS, HIT BY THE SESSION THAT HAD READ IT.** A test name containing `✖` raised
  `UnicodeEncodeError` from the PRINTER. **The revert was in a `finally`, so the file came back
  byte-identical by sha256 and nothing was left injected** — which is the whole reason that rule is
  written as "revert in a `finally`" rather than "revert after reading the result". Output is
  ASCII-folded now.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 7a COMMIT ITSELF, BECAUSE IT
  SHIPS TESTS.* It read **2210 / 367 / 1397 / 85**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 7a COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2199 → 2210 is **+11**, one new file (`cardShowsCreditedBonus.test.js`); suites 365 → 367
  is that file's **two** top-level describes. React did not move — **no `src/` file was touched**,
  which is worth stating because this commit is about what a referrer SEES: the change is entirely
  in what the server puts on the payload. Re-measured rather than carried. **All four predicted
  before the run and matched.**
  ⚠ **COMMIT 7 SPLIT INTO FOUR BECAUSE A READ-ONLY INVESTIGATION FOUND A BLOCKER NOBODY HAD
  COSTED — AND THAT INVESTIGATION IS THE ENTRY WORTH KEEPING.** `evaluateReferral` selects a
  payout schedule from the **"Job Type" CUSTOM FIELD** (`invoiceData.jobs.nodes[].customFields`,
  label `Job Type`, `valueDropdown`). **No fact table stores it.** `crm_job_facts.job_type` is a
  DIFFERENT thing with a confusingly identical name — Jobber's own `Job.jobType` enum — and
  **measured in production it reads `ONE_OFF` for all 6,277 rows**, while the live schedules are
  keyed on `New Construction` / `Skylight Install` / `Restoration`. A fact-driven
  `evaluateReferral` would therefore return `no_job_type_found` for **every** client. ⚠ **Had this
  been discovered during the build rather than before it, the conversion credit would have shipped
  as a gate that silently never fires** — the same shape as the font columns and
  `waitingForFinancedPayment`. Capturing the field is now its own commit (7c) and it blocks 7d.
  ⚠ **AND THE CARD CHANGE HAD TO GO FIRST, WHICH IS THE OPPOSITE OF THE PLAN'S ORDER.** The plan
  listed card display last. The stage change makes two production clients derive `'paid'`; with the
  speculative ladder still in place each would have shown **`+$500` against no ledger row**. Nobody
  would have seen it — neither referrer has a `users` row — but that is a coincidence, and this file
  already records *"a safety argument resting on another component's current behaviour"* as a defect
  class. **Retiring the ladder first means the window never opens.**
  ⚠ **THE LADDER WAS IN TWO PLACES AND THE SECOND ONE IS THE ONE THAT WOULD HAVE BEEN MISSED.**
  `fetchPipelineForReferrer` (`crm/jobber.js`) and the stale-cache fallback in `GET /api/pipeline`
  — which also carried its **own inline copy of `boostSchedule`** rather than importing the shared
  constant, already recorded as a defect on `PRE_LAUNCH_CHECKLIST.md`. That path runs precisely
  when the adapter has just failed, i.e. when nobody is checking the figures.
  ⚠ **AND THE FALLBACK IS NOW DRIVEN BEHAVIOURALLY, NOT JUST FENCED.** The first writing covered
  it with a source fence only, and guard-proof (ii) reported width 2 — both of them text checks.
  **A source fence proves the ladder is not WRITTEN there; it cannot prove a request travelling
  that branch shows the right figure.** The branch is reachable: the route falls back on any
  adapter error whose message is not "No CRM connected", and an `oauth` connection with no `tokens`
  row produces one. With a behavioural case the same injection reds **3**, and the case asserts
  `body.stale === true` as its precondition so it cannot quietly become a duplicate of the live
  path.
  ⚠ **THE POSITIVE FIXTURES USE 737, 823 AND 611 — DELIBERATELY UNREACHABLE BY `500 + boost`.**
  A round 500 would have been satisfied by the ladder AND by the ledger, which is the
  `toContain`-on-a-bare-value trap wearing a currency symbol. An odd value cannot.
  ⚠ **TWO EXISTING CASES WERE INVERTED BY THE RULING RATHER THAN BY A BUG, AND BOTH ARE QUOTED IN
  PLACE.** `getNeverWritesMoney.test.js` asserted `typeof item.payout === 'number'`, described in
  its own comment as *"the speculative payout it would have written"* — the exact thing ruling 3b
  retires. Inverted to `payout === null`, and its non-vacuity is untouched because the removed
  GET-write fired on `bonusEarned`, which is asserted separately. Its sibling's PAIRED POSITIVE
  asserted only that a complete item carried *a number*, which the ladder satisfied for any paid
  row — **so it proved the field was populated, not that the figure was real.** It now seeds a
  conversion and asserts the exact amount, which is strictly stronger.
  ⚠ **FIVE GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256.** (i) the ladder restored in the adapter → **8**; (ii) restored in the stale-cache
  fallback → **3**, one behavioural; (iii) the balance falling back to the speculative figure
  (`conversionBonus ?? payout`) → **exactly 1**; (iv) the `pre_start_date` gate removed → **exactly
  1** — a gate this commit must NOT touch, proven untouched by breaking it deliberately; (v) the
  conversion lookup losing its contractor scope → **exactly 1**.
  ⚠ **AND (iv) IS THERE BECAUSE "I DID NOT TOUCH THAT" IS A CLAIM.** A commit that rewrites the
  money line of a payload should prove the eligibility gates beside it still bite, not assert it.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 6 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2199 / 365 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 6 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2187 → 2199 is **+12 = 11 + 1**: eleven in one new file
  (`referralConversionWriter.test.js`) and **one APPENDED to an existing describe** in
  `invoicePaidWebhook.test.js` (10 → 11 cases). Suites 363 → 365 is the new file's **two**
  top-level describes only — the appended case landed in a describe that already existed. React
  did not move — no `src/` file was touched — and was re-measured. **All four predicted before
  the run and matched.**
  ⚠ **A PURE EXTRACTION, AND THE PROOF THAT IT IS PURE IS AN EXISTING SUITE STAYING GREEN.**
  `invoicePaidWebhook.test.js` drives the whole webhook end to end, including the duplicate
  delivery; it passed unchanged. The new appended case is the stronger claim: it asserts the
  conversion row **column for column**, because the old case checked three columns of eight and a
  writer that dropped `contractor_id`, mis-set `payout_status` or stopped stamping `converted_at`
  would have passed it.
  ⚠ **AND THAT COLUMN LIST CANNOT BE A FIXED SET, WHICH IS A SCHEMA FACT WORTH KNOWING.**
  `referral_conversions.job_type` **exists in the Railway database and does not exist in the test
  database** — its migration was removed from `db.js` in Session 49 and must not be re-added, so a
  fresh schema never grows it. A `deepEqual` against one list fails in one environment or the
  other, which is exactly what the first writing did (`job_type === null` against `undefined`).
  The case now asserts the seven required columns are present, that any extra is a NAMED
  divergence, and that `job_type` is left null **if** it exists.
  ⚠ **THE PRIOR-COUNT READ MOVED INTO THE WRITER WITH THE INSERT, AND THAT IS DELIBERATE RATHER
  THAN TIDY.** `isFirstConversion` is only correct if the count is taken BEFORE the insert; left
  at the call site it was one harmless-looking reorder away from being permanently false, which
  would silently retire the #13 first-milestone email. Guard-proof (ii) does exactly that and
  reds **5**.
  ⚠ **AND THE RACE IT DOES NOT FIX IS RECORDED RATHER THAN CARRIED.** The count and the insert
  are two statements on the pool, so two concurrent first conversions for one referrer could both
  send a first-milestone email. That race exists today and is **unchanged** — fixing it inside a
  no-behaviour-change commit would make the guard-proof meaningless. The UNIQUE constraint still
  makes the conversion itself exactly-once, so the worst case is a duplicate email, never a
  duplicate credit.
  ⚠ **TWO EXISTING FENCES WENT RED AND BOTH WERE RIGHT — THIS IS THE ENTRY WORTH KEEPING.**
  (1) `getNeverWritesMoney.test.js`'s **HARNESS FLOOR** read the invoice-paid webhook to prove its
  money-write needle fires at all. The extraction moved the only money write out of that file, so
  the floor **failed loudly on a moved target rather than quietly passing against nothing** —
  precisely what a non-vacuity floor is for. Re-pointed at `server/utils/referralConversion.js`,
  which is the more durable target because a fence now keeps that file the only writer. The
  suite's property — no GET route writes money — is unchanged.
  (2) `testResetCoverage.test.js` recorded the new suite as **UNREADABLE**, and the cause is a
  neighbouring-fence interaction worth writing down: a literal `DELETE FROM ${` anywhere in a file
  makes that scanner treat the whole reset as interpolated, then look for an array of table names
  to resolve, find none, and give up. My fence's own SYNTHETIC SQL — the paired negative proving a
  DELETE is not flagged — supplied that string. Rebuilt by concatenation, so the synthetic SQL
  stays readable to a human and leaves no `DELETE FROM ${` for the scanner. **`UNREADABLE_RESETS`
  was NOT widened.**
  ⚠ **SIX GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256.** (i) the inline INSERT restored in the webhook → **3**, including the fence naming
  `file:line`; (ii) the prior count moved after the insert → **5**; (iii) `contractor_id` dropped
  from the INSERT → **10**, wide because a tenantless conversion breaks every tenancy-scoped read
  as well; (iv) the `ON CONFLICT` clause dropped → **exactly 1**, the redelivery case; (v) the
  writer refusing a ZERO bonus → **exactly 1** — a `$0` conversion is real and production holds
  one, so `if (!bonusAmount)` would silently drop a ledger row; (vi) the fence's verb anchor
  neutralised → **2**.
  ⚠ **EVERY REPLACEMENT STRING IN THAT HARNESS IS BUILT BY `array.join`, DELIBERATELY** — the
  heredoc/escape trap has now cost this arc three separate detours, and a multi-line SQL
  injection is exactly the shape that triggers it.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 5 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2187 / 363 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 5 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2177 → 2187 is **+10**, one new file (`financedPaymentCapture.test.js`); suites 361 →
  363 is that file's **two** top-level describes. React did not move — no `src/` file was touched
  — and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (10); the isolated run's own `tests 10` agrees.
  ⚠ **THE COLUMN IS NULLABLE WITH NO DEFAULT, AND THAT IS THE OPPOSITE OF ITS SIBLING ON
  PURPOSE.** `crm_request_facts.assigned_users_truncated` is `NOT NULL DEFAULT FALSE`, because a
  false there means "not flagged" — safe for an old row to say. **Here false means "not financed",
  which `evaluateReferral`'s Step 4 reads as permission to convert**, so a defaulted FALSE would
  assert of all **3,881** pre-existing invoice rows that they are safe to pay a bonus on. NULL
  says "nobody asked", which is true of them. **The money rule for commit 7: a NULL is NOT
  eligible — never `IS NOT TRUE`, which folds unknown in with false and converts on unknown.**
  A fence walks `server/` and fails on that phrasing, with a non-vacuity check proving the needle
  can match its own synthetic case.
  ⚠ **THE THIRD INVOICE SELECTION WAS FOUND BY THE reads-vs-selects FENCE, NOT BY ME, AND THAT IS
  THE ENTRY WORTH KEEPING.** The commit set out to change `INVOICE_FIELDS` and
  `REP_INVOICE_FIELDS`. The fence then failed naming **`RELATED_INVOICE_FIELDS`** in
  `server/routes/webhooks/jobber.js` — a third selection feeding the same writer. Its message was
  the argument in one line: *"a writer reading a field no query selects stores NULL, and NULL
  reads as an answer rather than as 'nobody looked'."* **The writer's reads are the authority; a
  list of queries someone remembered is not** — this is *sweep from the shared utility outward*
  earning its place, and it is the mechanism that would have caught the two font columns.
  ⚠ **AND AN EXISTING CROSS-PATH PARITY FENCE CAUGHT THE TEST FIXTURE, WHICH IS A SECOND,
  DIFFERENT CATCH.** `repImportScope.test.js`'s *"IDENTICAL ROWS — live capture and import capture
  agree column for column, with no NULLs"* compares the two paths' rows and **fails on any NULL,
  named**. It went red on `waiting_for_financed_payment` because `FULL_INVOICE` did not supply the
  field. Repaired in the fixture — and set to **`true`, not `false`, deliberately**: both paths
  share that fixture, so a coercion bug (`|| false`, `!!undefined`) would make BOTH rows false and
  they would still agree column-for-column, passing against the defect.
  ⚠ **SIX GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256 ACROSS SIX WATCHED FILES.** (i-a/i-b/i-c) the field dropped from each of the three
  selections in turn → **2 red each**, its own per-selection fence plus the three-selection case;
  (ii) the writer storing `!!value` instead of the typeof guard → **5**; (iii) the column given
  `NOT NULL DEFAULT FALSE` → **5**, including the live-schema case that reads
  `information_schema` rather than `db.js`'s source text; (iv) the `ON CONFLICT` branch no longer
  carrying the column → **exactly 1**, the convergence case — without which the 3,881 unknowns
  could never fill.
  ⚠ **THE HARNESS REFUSED TWO INJECTIONS ON THE FIRST RUN AND THAT IS THE BOTH-DIRECTIONS CHECK
  WORKING.** Deleting the field left the reverse anchor `client { id }` matching three times in
  one file and twice in another; the patcher refused, reverted, and both files stayed
  byte-identical. Repaired by swapping the field for a duplicate of an already-selected scalar —
  legal GraphQL, so the query stays valid while the field under test is gone.
  ⚠ **AND THE HEREDOC ESCAPE TRAP FOR THE THIRD TIME IN THIS ARC, IN THE HARNESS AGAIN.** A `\n`
  written through a shell one-liner became a REAL newline inside a JS string literal — an
  unterminated string, caught by `node --check`. The replacement is built with
  `['…','…'].join('\n')` now, and every harness edit goes through the editor. **Knowing the rule
  is not the mechanism.** Every changed file is checked for stray control bytes (0 found).
  ⚠ **MEASURED EXPOSURE, AND IT IS SMALL WHERE IT MATTERS.** The column does not exist in
  production yet — the `ALTER` runs on the next boot. **3,881** invoice fact rows will hold NULL,
  but only **4 of them, across 3 clients, belong to the referred population** — and all 4 are
  PAID, i.e. exactly the rows a conversion decision reads. **So commit 7 needs a re-capture of
  the referred clients first, and it is one script run.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 4 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2177 / 361 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 4 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2159 → 2177 is **+18**, one new file (`referredCaptureBackfill.test.js`); suites 358 →
  361 is that file's **three** top-level describes. React did not move — no `src/` file was
  touched — and was re-measured. **All four predicted before the run and matched.** Counted with
  an anchored `^\s*it\(` (18); the isolated run's own `tests 18` agrees, and every loop sits
  inside an `it()` body iterating fixtures or needles, so none wraps a case.
  ⚠ **THE GATE WENT RED FIRST ON THE 6c RESET-COVERAGE FENCE, AND IT WAS RIGHT.**
  `referredCaptureBackfill.test.js touches referral_conversions but never clears it` — the suite
  only ever READS that table (the facts-only case asserts the backfill wrote none), and that is
  exactly the shape the fence exists for: **an absence assertion over an uncleared table starts
  measuring a prior case's leftovers.** Added to the reset in FK order; `KNOWN_GAPS` was NOT
  widened, as the fence's own message instructs.
  ⚠ **AND A GUARD-PROOF FOUND THIS COMMIT'S VERB ANCHOR ENTIRELY INERT — WIDTH 0 — WHICH IS THE
  ENTRY WORTH KEEPING.** The facts-only fence scans the job's source for five forbidden write
  targets, verb-anchored so a legitimate SELECT is not flagged. Replacing the anchor with `true`
  changed **nothing**, because after comment-stripping the job mentions **none** of the five
  needles, so the loop never ran. ⚠ **The fence still fired when a forbidden write was ADDED**
  (injections i-a and i-b), so it was not broken — its DISCRIMINATOR was simply never exercised,
  and *a check whose failure mode has never been observed is a claim, not a check.*
  ⚠ **AND MY OWN NON-VACUITY CASE WAS THE MISLEADING PART: it asserted `pipeline_cache` was
  present "so the needles CAN match" — and `pipeline_cache` is not one of the needles.** The
  write detection is now an extracted function driven on SYNTHETIC input in **both** directions:
  a synthetic `UPDATE` of each of the five IS flagged, and a synthetic `SELECT` of each is NOT.
  Injection (v) now reds **exactly 1**, naming the READ discriminator.
  ⚠ **THE JOB WRITES FACTS AND NOTHING ELSE, AND THE ABSENCE IS FENCED RATHER THAN ASSERTED
  ONCE.** No `pipeline_stage`, no `pipeline_status`, no `client_rep_assignments`, no
  `flagged_assignments`, no `referral_conversions` — and it never calls `decideFromFacts` or
  `classifyPipelineStatus` either, because a job that derived a status and discarded it would be
  one edit from writing it. **Ordering is the reason this is commit 4 and not commit 8:** run
  after the derivation, the referred clients with no facts today would derive `'lead'` for want
  of data, on the one surface where a stage must only move forward.
  ⚠ **`capturePost` GAINED AN OPTIONAL `onCost` HOOK, AND IT IS A PACING HOOK RATHER THAN A
  SECOND LOG.** `logCaptureCost` writes the throttle figures to the console, which nothing can
  read back — so a caller issuing captures in a LOOP had no way to pace against them. It is
  wrapped in try/catch for the same reason the cost LINE is: an observation must never fail a
  capture. Forwarded to the paging queries too, so a client with 200 quotes is paced on all four
  round trips rather than the first.
  ⚠ **SIX GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256 ACROSS ALL THREE WATCHED FILES.** (i-a) the job also writes the displayed stage → **2**;
  (i-b) it also writes a conversion → **5**; (ii) the client selection returns an empty set →
  **8**, which is the non-vacuity proof that every case is driven by a real population;
  (iii) a per-run row added to a fact table → **2**, including the idempotence case, which
  compares the ROWS rather than the count — a count would also be satisfied by a run that
  deleted one row and inserted another; (iv) the script stops refusing a missing contractor id →
  **exactly 1**; (v) the fence's verb anchor neutralised → **exactly 1**.
  ⚠ **INJECTION (v)'s ANCHOR IS ESCAPE-FREE ON PURPOSE.** The obvious anchor is the regex line,
  and writing it into a JS string turns every `\b` into a BACKSPACE byte — the trap that cost
  commit 3 two debugging passes. Every changed file is checked for stray control bytes (0).
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 3 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2159 / 358 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 3 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2149 → 2159 is **+10**, one new file (`syncCaptureThenDecide.test.js`); suites 355 → 358
  is that file's **three** top-level describes. React did not move — no `src/` file was touched —
  and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (10), and the isolated run's own `tests 10` agrees, so no loop wraps a case.
  ⚠ **TWO EXISTING SUITES WERE REPAIRED AND CONTRIBUTE 0, AND THE REPAIR IS THE ENTRY.** The
  sync now makes a SECOND per-client Jobber call — `fetchFullClient` for the capture — and
  `pipelineStageWriters.test.js` (8 cases) and `jobberSyncRepair.test.js`'s T12 stub both
  answered only the two queries the old sync made, so the capture threw and every stage came
  back null. **The property is unchanged and the assertions are untouched**; the harnesses
  learned to answer the capture query. ⚠ **This made `pipelineStageWriters` STRONGER rather
  than merely different: it now drives the real fetch → fact rows → derivation → stored stage
  path, where before it exercised a pure function on a live object.**
  ⚠ **AND A LITERAL BACKSPACE BYTE (0x08) SAT INSIDE A REGEX FOR TWO DEBUGGING PASSES — THE
  HEREDOC ESCAPE TRAP THIS FILE RECORDS, HIT BY THE SESSION THAT HAD QUOTED THE RULE.** A `\b`
  written into a Python heredoc reached the file as the control character, so
  `/GetClient<BS>/` never matched and the harness fell through to "unexpected query" while
  `grep` DISPLAYED the line as `/GetClient\b/`. **The tell was `JSON.stringify` showing `"\b"`
  with ONE backslash** — a real backslash-b stringifies as `"\\b"`. Found only by evaluating
  the landed line rather than reading it. Regex-bearing edits go through the editor.
  ⚠ **A CALL-SITE FENCE CAUGHT A TEST SEAM HIDING A REQUIRED ARGUMENT, WHICH IS THE OTHER
  ENTRY WORTH KEEPING.** The first draft wrapped `fetchFullClient` and `decideFromFacts` in
  `_`-prefixed seams so a capture failure could be injected. `captureFetchContract`'s 6b fence
  went red: it requires every capture-path fetch to pass a `door` and a `contractorId`, and a
  seam's `(...args) =>` default forwards them with no literal for the fence to see. **The seams
  were also never used** — a capture failure is injectable at the AXIOS layer, as a 200
  carrying an `errors` array, which is the shape a real GraphQL failure arrives in and is a
  strictly better test. Both seams deleted; only `_sleep` remains, and it is used.
  ⚠ **MEASURED BEFORE BUILDING, AND THE ANSWER IS WHY THIS WAS SAFE TO SHIP: ZERO DISPLAYED
  STAGES CHANGE.** Of the 57 clients `accent-roofing-dev` touched in the last 25 hours — the
  sync's fixed window — **all 57 already have facts and all 57 already agree** with the
  fact-derived answer (0 differ, 0 backwards, 0 forwards); exactly 1 is in a rep book and it
  does not differ. They agree because the webhook doors are already capture-then-decide, so
  the active population was fact-derived before this commit reached it.
  ⚠ **AND THE WINDOW IS FIXED AT 25 HOURS WITH NO CHUNKING, SO AN UNBOUNDED CATCH-UP IS NOT
  REACHABLE ON THIS PATH** — unlike `crm/pipelineSync.js`'s separately-named
  `runIncrementalSync`, which chunks up to 30 days. ⚠ **The two functions share a name and NOT
  a path**: the cron writes `jobber_clients` only and never touches `pipeline_cache`. That one
  is N4 commit 7's subject.
  ⚠ **PACING IS ADDED AGAINST THE RESERVATION, NOT THE SPEND.** Jobber reserves
  `requestedQueryCost` and refunds the unused part, so a capture is refused on the RESERVATION.
  Measured live across 143 capture lines: requested **3408–3515**, actual **46–72**, bucket
  **10,000**, restore **500/s**, `currentlyAvailable` never below **9,781**. Serial round trips
  restore far more than they spend, so the computed delay is 0 today — a guard against a burst,
  not a throttle we are near, and the paired positive asserts a healthy bucket does NOT pace.
  ⚠ **FIVE GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256.** (i) the stage decided from the LIVE object again → **4**, including the fence's
  caller check and the source case; (ii) the upsert's COALESCE removed so a failed capture
  erases a good stage → **3**; (iii) a Jobber fetch moved INSIDE the per-client lock → **exactly
  1**; (iv) the pacing neutralised → **exactly 1**; (v) the retired fence entry put back while
  its call site is gone → **exactly 1**, the CLOSURE case — **the first expiring entry to
  close, and the mechanism commit 1 built for it working on a real retirement.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 2 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2149 / 355 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 2 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2133 → 2149 is **+16**, one new file (`derivableClient.test.js`); suites 351 → 355 is
  that file's **four** top-level describes. React did not move — no `src/` file was touched —
  and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (16); the file's ten loops were each checked for POSITION and **all ten
  sit inside `it()` bodies** (iterating fixtures and assertions) or inside the walk helper, so
  none wraps a case.
  ⚠ **THE GATE WENT RED FIRST AT `fail 120` ACROSS 12 SUITES, AND THE CAUSE WAS MY OWN
  DEVIATION FROM THE PLAN — WHICH IS THE ENTRY WORTH KEEPING.** The plan said commit 2 ships
  "a shared predicate and its tests, no behaviour change yet". I wired the new
  `assertDerivableJobberClientId` into `decideFromFacts` as well, reasoning that a utility with
  no consumer is this file's vacuity shape #8. **Every existing fixture uses a synthetic client
  id — `"c1"`, `"client-1"` — which is correct for its own test and is not a Jobber
  EncodedId**, so the guard threw for all of them. **120 cases, 12 suites**, and the React half
  never ran at all because the gate chains with `&&`.
  ⚠ **BACKED OUT RATHER THAN "FIXED", AND THE DISTINCTION IS THE CHARACTERIZATION RULE.**
  Migrating 120 fixtures would have been changing tests to satisfy new code, inside a commit
  whose stated purpose is no behaviour change. The guard is RIGHT and PREMATURE: nothing today
  feeds `decideFromFacts` a non-derivable id, so it buys no protection in exchange for that
  migration. **The 120/12 figure is now recorded IN a test case** (*"decideFromFacts does NOT
  yet enforce this, and the reason is measured"*), which asserts the absence and names every
  affected suite — so the next session sizes the work instead of rediscovering it, and
  guard-proof (i) re-wires the guard and takes exactly that case red.
  ⚠ **AND A GUARD-PROOF FOUND ONE OF THIS COMMIT'S OWN CASES VACUOUS, MEASURED AT WIDTH 0.**
  *"rejects a string that base64-decodes leniently"* inserted a `!` into a valid id — which the
  **charset regex** rejects three lines before the round-trip check is ever reached. Removing
  the round-trip left the case GREEN. The discriminating fixture has to PASS charset and length
  and still fail the round-trip: base64 ignores the unused low bits of the final character, so
  `…C8xMR==` decodes to `gid://Jobber/Client/11` and re-encodes as `…C8xMQ==`. Rewritten with
  four harness assertions proving it reaches the round-trip; (iv) now reds **exactly 1**.
  ⚠ **THE PREDICATE IS WIDER THAN THE RULING'S WORDING, DELIBERATELY, AND (iii) IS WHY.** Danny
  ruled *"`'app_user'` is excluded"*; a predicate matching that literal passes
  **`test-client-002`**, a synthetic id live in production with a `'paid'` status and a real
  `referral_conversions` row. The question is not what a row's status says but whether a Jobber
  client exists behind its id, so the check is *decodes to `gid://Jobber/Client/`*. Injection
  (iii) writes the naive reading and reds **3**.
  ⚠ **MEASURED AGAINST PRODUCTION BEFORE BEING WRITTEN, IN THE DIRECTION THAT MATTERS.** All
  **19,565** stored `jobber_clients` ids satisfy it — **zero** false negatives — and the only
  rows rejected anywhere are the three `app_user_*` placeholders and the one synthetic id, none
  of which carries a single row in any of the five fact tables. **A predicate that silently
  EXCLUDES a real client is permanent and invisible; one that admits a stray string fails at
  the next query** — so the URL-safe base64 alphabet is accepted too, chosen for the failure
  mode rather than for strictness.
  ⚠ **SEVEN GUARD-PROOFS, SIX OF THEM EXACTLY 1 RED.** (i) the guard re-wired into
  `decideFromFacts` → 1; (ii) the client-type check dropped so any Jobber gid passes → 1;
  (iii) the naive `app_user`-literal predicate → 3; (iv) the round-trip removed → 1; (v) the
  SQL fragment decoding before it checks length, which makes Postgres `decode()` RAISE and
  abort the statement rather than filter → 1; (vi) the interpolated identifier no longer
  validated → 1; (vii) a second file spelling the exclusion for itself → 1. Every revert an
  inverse patch in a `finally`, all three watched files proven byte-identical by sha256.
  ⚠ **NO DATABASE, SO NOTHING JOINS ANY RESET LIST** — pure unit assertions plus one source
  fence.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE N4 COMMIT 1 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2133 / 351 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE N4 COMMIT 1 COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2119 → 2133 is **+14**, one new file (`oneStatusDerivation.test.js`); suites 348 → 351
  is that file's **three** top-level describes. React did not move — **no `src/` file was touched
  at all**, and the only non-test files this commit edits are markdown — and was re-measured
  rather than carried. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (14), and the runner's own `tests 14` on the isolated run agrees, so no
  loop wraps a case.
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN:** this commit adds no non-test file under
  `src/components/admin`, `src/constants`, `src/components/superAdmin` or `src/utils` — the four
  roots `adminBranding.test.jsx` walks — so the arithmetic closes at exactly 14 and 0.
  ⚠ **THE FENCE SHIPS AN ALLOW-LIST, WHICH IS NORMALLY HOW A FENCE DIES, AND THE THREE THINGS
  STOPPING THAT ARE THE ENTRY WORTH KEEPING.** `KNOWN_GAPS` lists are recorded in this file as
  the shape that makes a green run meaningless. Here every EXPIRING entry **names the commit that
  deletes it**; every entry is asserted **LIVE**, so a stale entry FAILS rather than lingering;
  and every entry pins its **SPAN COUNT**, so a listed function cannot quietly gain a second
  write. That third one is what guard-proof (vii) exercises — removing an expiring call site
  while leaving its entry behind reds **exactly 1**, the CLOSURE case.
  ⚠ **A LINE-PRESERVING COMMENT STRIP IS NOT A STYLE CHOICE, AND THE FIRST DRAFT GOT IT WRONG.**
  Deleting comment text shifts every line below it, and the harness reported
  `pipelineSync.js:215` for a call site that is really at `:235`. **A fence whose findings name
  the wrong line is worse than none** — the reader follows the number, sees unrelated code, and
  concludes the fence is broken. Comments become blanks of equal length, so line AND column
  survive. Caught by comparing the probe's output against a `grep` whose answer was already known.
  ⚠ **AND A NEEDLE OF MINE REPORTED CORRECT CODE ON THE FIRST RUN — THE SUBSTRING TRAP, SCOPED
  TOO WIDE.** The `'app_user'` case asserted the string was absent from the whole of
  `crm/pipelineSync.js`, and that file legitimately contains an `app_user_%` **placeholder
  cleanup** — it deletes the signup row once the real Jobber client is upserted. **Narrowed to the
  classifier's own brace-matched body, never exempted**, per this file's reword-don't-exempt rule:
  an exemption would have removed the fence's reach into the one file it most needs to read.
  ⚠ **SEVEN GUARD-PROOFS, EVERY REVERT AN INVERSE PATCH IN A `finally` PROVEN BYTE-IDENTICAL BY
  sha256, ANCHORS CHECKED UNIQUE IN BOTH DIRECTIONS, EMPTY-STRING REPLACEMENTS REFUSED OUTRIGHT,
  AND EACH FILE RE-READ FROM DISK PER PATCH.** Widths: (i) the classifier needle pointed at a
  non-existent name → **4**; (ii) the walk stopped from reaching `crm/` → **3**; (iii) a NEW route
  file calling the classifier → **exactly 1**, the caller fence; (iv) a NEW route file writing
  `pipeline_stage` → **exactly 1**, the writer fence; (v) the writer needle's verb anchor removed
  so reads count as writes → **3**, including the `rep.js` PAIRED NEGATIVE; (vi) the call-site
  needle no longer requiring a paren, so a destructured import counts as a call → **2**;
  (vii) an expiring call site removed with its entry left behind → **exactly 1**.
  ⚠ **(vi) IS THE ONE THIS CODEBASE HAS GOT WRONG BEFORE.** `webhooks/jobber.js` **imports the
  classifier and never calls it**, so a needle without the paren reports a caller that does not
  exist — the same miscount this file records from the `writeManualSticky(` fence, where "one
  import plus two call sites" expected 3 and got 2. The discriminator case pins it in both
  directions: no call site in that file, **and** the import must still be there, or the
  discriminator is no longer exercising anything.
  ⚠ **THE BEHAVIOURAL CROSS-SURFACE FENCE IS DELIBERATELY ABSENT AND THAT IS NOT AN OMISSION.**
  The design's commit-1 sketch named one asserting the rep and referrer surfaces report the same
  stage. **It cannot be green today** — the two columns legitimately disagree until commit 4,
  which is N4's whole subject — so shipping it now would mean pinning the defect or marking it
  skipped, and a skipped test is a failure until explained. It lands in commit 4.
  ⚠ **NO DATABASE, SO NOTHING JOINS ANY RESET LIST.** The suite reads source text only; it seeds
  nothing and writes no table. Stated because the 6c reset-coverage fence exists precisely to
  catch a suite that quietly gains a table.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE BADGE-EARNING COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2119 / 348 / 1397 / 85**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE BADGE-EARNING COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 2105 → 2119 is **+14 = 11 + 3**: eleven in one new file
  (`referrerProgressEarning.test.js`) and three APPENDED to the existing
  `getNeverWritesMoney.test.js` (8 → 11). Suites 347 → 348 is the new file's single describe —
  the three appended cases landed in a describe that already existed. React 1387 → 1397 is
  **+10**, one new file (`badgeCelebrationSuccession.test.jsx`), and 84 → 85 is that file.
  **All four predicted before the run and matched.**
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN:** the new React file is a `.test.` file (skipped by
  `adminBranding.test.jsx`'s walker) and the new server file is under `server/test/`, so neither
  walked root gained a sweepable non-test file.
  ⚠ **EARNING MOVED OFF A PAGE VIEW; SHOWING DID NOT MOVE AT ALL.** `GET /api/pipeline` wrote
  `users.paid_count` and awarded badges, so whether a referrer earned anything depended on
  whether they opened the app — and a refresh re-ran it. **The catalogue already declared
  `trigger: "pipeline_sync"` for those four badges; only the code disagreed.** Awarding now
  happens in the sync, quietly; the celebration still fires only on the Profile tab.
  ⚠ **AND THE THREE-WAY SEPARATION IS THE RULING RATHER THAN A REFACTOR:** EARN where the fact
  changes, SHOW on the page the referrer lands on, mark SEEN by an explicit act. Two of the
  three were already right — `BadgeCelebrationPopup` is mounted inside `ProfileTab` and nowhere
  else, and `POST /api/referrer/badges/acknowledge` already existed — which is why only earning
  moved. **A fence pins the mount site**, because "never on app entry" is structural: the entry
  popups live in `ReferrerApp`, and the badge popup being absent from that tree is what makes
  the guarantee checkable rather than asserted.
  ⚠ **`paid_count` HAS ONE WRITER AND IT IS AN ABSOLUTE RECOMPUTE.** The webhook's
  `paid_count + 1` is retired. The old comment argued the `rowCount > 0` guard made the
  increment safe against duplicate deliveries, and it did — **but only against duplicates that
  reached that branch.** An increment cannot self-heal: any divergence is permanent. A case
  proves the recompute **corrects a deliberately wrong stored value**, which is the argument for
  absolute over incremental stated as a test rather than as prose.
  ⚠ **TWO EXISTING WEBHOOK CASES WERE INVERTED BY THE RULING, AND ONE OF THEM HAD THE
  INCREMENT AS ITS SUBJECT.** *"paid_count increments exactly once"* was an assertion about a
  mechanism that no longer exists; it now pins that the webhook leaves the column alone, and
  the idempotence it used to prove is proven where the writer now lives. **Neither was a bug
  — both were correct about the old design.**
  ⚠ **AND THE EDIT THAT UPDATED THEM PRODUCED `tests 1 · suites 0 · fail 1` — THE MODULE-LOAD
  SIGNATURE THIS FILE NAMES, HIT BY THE SESSION THAT HAD READ IT.** An apostrophe inside a
  single-quoted test name (*"the webhook's job"*) closed the string: `SyntaxError: missing )
  after argument list`. **Reworded, not escaped.** The tell was the `suites 0` reading, exactly
  as recorded — a non-zero test count beside zero suites.
  ⚠ **FIVE WIDTHS.** (i) the GET writing `paid_count` and a badge again → **2 red** (the
  behavioural case and the widened fence); (ii) the sync no longer awarding `first_referral` →
  **4 red**; (iii) the webhook increment restored → **1 red**, the source fence; (iv) the popup
  naming every badge in one card → **4 red**, including the INSIDE-tap negative; (v) Total
  Balance Owed summing signed balances → **1 red**.
  ⚠ **THE FENCE WIDENED TO `users` AND `user_badges`, AND `users` NEEDED A PAIRED NEGATIVE.**
  Almost every GET route SELECTs from `users`, so a needle that flagged a read would be carved
  out within a week. It is verb-anchored, and a case proves a `SELECT` cannot trip it while an
  `UPDATE` can — plus a floor asserting some GET route really does read `users`, or that
  negative proves nothing.
  ⚠ **AND NO FENCE FORBIDS A NOTIFICATION AT EARNING TIME — THAT IS A RULING.** Push
  notifications for badges are a planned feature (filed on `PRE_LAUNCH_CHECKLIST.md`): push will
  fire at EARNING time while the celebration stays on the Profile tab. The suite carries ONE
  case named *"CURRENT STATE: awarding a badge sends no email, push or SMS today"* — labelled as
  the state of things, so adding push means updating a clearly-named case rather than arguing
  with a guard that forbade the feature. **The awarder is idempotent, which is what will make a
  push safe from duplicates.**
  ⚠ **`client_badge` STAYS UNAWARDED AND A CASE SAYS SO.** The catalogue marks it
  `pipeline_sync`, but it has never had a qualifying rule — it was commented out in the old
  GET-time awarder, and **moving code does not invent one.** Recorded so its absence reads as
  known rather than as this commit dropping it.
  ⚠ **THE DEAD AWARDER WAS DELETED, NOT LEFT ORPHANED.** `checkAndAwardBadges`'s only caller
  was the GET; once earning moved it had none.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3e) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2105 / 347 / 1387 / 84**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3e) ITSELF, BECAUSE IT SHIPS TESTS.**
  React 1382 → 1387 is **+5 = 4 + 1 PHANTOM**, and the phantom was PREDICTED before the run
  rather than reconciled after it. Four cases were appended to the renamed
  `balanceRenderSites.test.jsx` (16 → 20); the fifth is `adminBranding.test.jsx` sweeping the new
  `src/constants/balanceCopy.js`, because **`src/constants` IS one of its four walked roots** and
  it emits one case per swept NON-TEST file. ⚠ **`src/hooks/` is NOT a walked root**, so the
  other new file (`useCashoutBalance.js`) adds nothing — which is why the arithmetic closes at
  exactly 5 and not 6. Files hold at 84: the suite was RENAMED, not added. Server held at
  2105 / 347 and was re-measured. **All four predicted and matched.**
  ⚠ **THE PREVIOUS FENCE WAS THE WRONG SHAPE AND MISSED THE MAIN SCREEN. THAT IS THE ENTRY.**
  Commit (3b)'s fence forbade a client-side SUM (`reduce(` beside `payout`) and caught Cash Out
  and Profile because they CALCULATED a balance. **The Dashboard calculates nothing** — it
  rendered `data.balance`, the server's speculative pipeline total, handed down as a PROP from
  `App.jsx` — so a fence for the shape of a CALCULATION was structurally blind to it. One
  account read **$500 on the Dashboard and $0 on the other two screens on the same day**.
  ⚠ **A VALUE THAT ARRIVES ALREADY WRONG IS STILL WRONG**, and the general rule is: when the
  defect is *which number is shown*, fence the RENDER SITES and their SOURCE, never the
  arithmetic. The replacement fences three things — only the shared hook may fetch the
  endpoint, no `data.balance`/`detail.balance` may appear anywhere in `src/`, and no component
  may be handed `balance={…}` as a prop — with a harness floor proving the walk reaches
  `DashboardTab.jsx` and that each needle matches a synthetic line AND spares the legitimate
  identifiers (`balanceState`, `balanceText`, `cashoutBalance`).
  ⚠ **THE `balance` PROP WAS REMOVED FROM THE COMPONENT AND FROM `App.jsx`'s STATE, NOT
  REPOINTED.** While the prop exists the wrong number can be passed back in, and nothing would
  say so. Same reasoning as (3b) removing `pipeline` from CashOutTab.
  ⚠ **THE §2.9 CASES WERE INVERTED A SECOND TIME, BY A RULING, ONE DAY AFTER THE FIRST
  INVERSION — AND BOTH REVERSALS ARE QUOTED IN THE FILE.** (3c) made the screen clamp a
  negative to `$0`; §2.10 amends that to show the true negative with a subtle note, keeping the
  silence only for a TRUE zero. **Neither writing was a bug.** The clamp made a referrer who
  earned $300 while at −$500 see `$0` and conclude nothing had happened. **Recording the
  reversal is what stops the next reader treating the clamp as the intent.**
  ⚠ **FIVE WIDTHS.** (i) `data.balance` read again in `App.jsx` → **1 red**, the source fence;
  (ii) the note firing at `<= 0` instead of `< 0` → **1 red**, the TRUE-$0 case — which is the
  only thing standing between the amendment and explaining a zero that just means *nothing yet*;
  (iii) the formatter clamping → **3 red**; (iv) the ADMIN view clamping → **1 red**, the leak
  that would make an over-payment invisible to everyone; (v) a `balance={…}` prop pass in a new
  file → **1 red**, the delivery shape the old fence could not see.
  ⚠ **AND THE GATE WENT RED FIRST ON THE DOCUMENTED `stageWebhooks` FLAKE, CONFIRMED RATHER
  THAN ASSUMED.** *"a LATER update of the same quote is NOT swallowed"* failed under full-suite
  load; the suite passed **19/19 alone**, this commit modifies **no server file at all**, and the
  re-run was green. That is the flake this file already records with its mechanism — a
  fire-and-forget handler completing after the hook's reset.
  ⚠ **TWO EXISTING PALETTE CASES NEEDED UPDATING AND NEITHER WAS A DEFECT.** The muted-idiom
  count went **13 → 14** because the §2.10 note is a fourteenth `opacity: MUTED` site — raised
  deliberately rather than relaxed to a range, because a range would stop the fence noticing a
  new muted container. And the Dashboard render case had to **await** its figure: it used to
  arrive as a prop on the first paint and now resolves asynchronously, so the synchronous
  assertion failed against correct code. **A timing change, not a defect.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3d) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2105 / 347 / 1382 / 84**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3d) ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2103 → 2105 is **+2**, both APPENDED to the existing `cashoutBalanceSingleSource.test.js`
  (15 → 17), so **suites hold at 347** — the expected shape when a file grows rather than a file
  arriving. React 1380 → 1382 is **+2** appended to `adminOverpaidFlag.test.jsx` (6 → 8), so the
  FILE count holds at 84 for the same reason. **All four predicted before the run and matched.**
  ⚠ **AND THE SINGLE-SOURCE FENCE CAUGHT ITS OWN AUTHOR WRITING A SECOND FORMULA, WHICH IS THE
  ENTRY WORTH KEEPING.** The admin dashboard's *Total Balance Owed* was summing the adapter's
  speculative figure and subtracting NO cash-outs. The first repair wrote the corrected
  aggregate INLINE in `routes/admin/metrics.js`, with a comment claiming it was *"scoped by
  contractor, not by `user_id`"* and therefore not a second per-user balance. **The subquery IS
  scoped by `user_id` — the comment asserted something the code contradicted** — and
  `cashoutBalanceSingleSource.test.js` went red naming the file and line before the gate ran.
  The aggregate moved into `server/utils/cashoutBalance.js` as `getContractorOwedTotal`.
  **A comment is not a carve-out, and a fence that reads the code rather than the claim is why.**
  ⚠ **THE TEST FOR IT THEN PASTED THE SAME SQL A THIRD TIME**, inside the very file that fences
  against a second copy. It calls the shared export now. **The fence does not scan `server/test/`,
  so nothing would have flagged that one** — it is recorded because the next person will do it.
  ⚠ **THE CLAMP-AT-ZERO IN THAT AGGREGATE IS A JUDGEMENT, PINNED SO IT IS VISIBLE RATHER THAN
  INCIDENTAL.** A negative balance is not money the contractor can collect, so letting it reduce
  the total would understate what is owed to everyone else — one over-paid account could mask a
  real liability to a dozen healthy referrers. Measured on the live tenant: **raw −$500, clamped
  $0**, and $0 is what is actually owed. A case asserts the two readings DISAGREE on the same
  fixture, because a fixture where they agree cannot tell a clamped aggregate from an unclamped
  one.
  ⚠ **AND COMMIT (3c) HAD LEFT TWO CONTRADICTORY "Balance" FIGURES ON ONE ADMIN SCREEN.** It
  added the true balance card without auditing the view it was adding to, which already carried
  a StatCard labelled *Balance* reading the speculative `detail.balance`: **−$500 at the top and
  $500 a few lines below.** That is worse than the single wrong figure it replaced. Repointed at
  the ledger AND relabelled *Lifetime earned*, because calling two different questions by one
  name is what made them look like one.
  ⚠ **A NEEDLE OF MINE WAS THE SUBSTRING TRAP FOR THE THIRD TIME IN THIS ARC.**
  `not.toMatch(/[$]500/)` failed against CORRECT code, because the true card renders **`-$500`**
  — which contains `$500` — and the arithmetic line says `$500 earned`. The property is
  *two figures both labelled Balance*, so the assertion counts LABELS now.
  ⚠ **AND ONE CASE MOUNTED TWICE WITHOUT CLEANUP.** testing-library cleans up between TESTS,
  not within one, so both trees stayed in `document.body` and a body-wide assertion saw the
  union of two renders. **It read like a wrong figure and was a harness fault.** One mount per
  case now.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3c) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2103 / 347 / 1380 / 84**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3c) ITSELF, BECAUSE IT SHIPS TESTS.**
  React 1369 → 1380 is **+11 = 5 + 6**: five APPENDED to the existing
  `cashOutBalanceSource.test.jsx` (11 → 16) and six in one new file
  (`adminOverpaidFlag.test.jsx`), which is also the 83 → 84. Server held at 2103 / 347 and was
  **re-measured**. **All four predicted before the run and matched.**
  ⚠ **THE SERVER HALF HELD ALTHOUGH A SERVER FILE CHANGED** — `routes/admin/referrers.js`
  gained an import and a response key. No route was added, so no route-count fence moved; the
  new key is asserted from the React side against a fixture, which is the honest place for it.
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN.** The new file lives in `src/components/admin`, which
  **IS** one of `adminBranding.test.jsx`'s four walked roots — but that walker skips
  `.test.` files, so a new TEST file there adds nothing. This is the case the arc's earlier
  entries distinguish: a new UTIL in a walked root DOES add one.
  ⚠ **THREE EXISTING CASES WERE INVERTED BY A RULING RATHER THAN BY A BUG, AND THE OLD
  ASSERTIONS ARE QUOTED IN THE FILE SO THE CHANGE IS REVIEWABLE.** Commit (3b) had the screen
  say *"$500 over-paid — nothing available"* and three cases ASSERTED that wording. Danny then
  ruled (§2.9) that a referrer sees a plain `$0` with **no message of any kind**. **The old
  copy was HONEST and is now FORBIDDEN** — a product decision about what a referrer is told,
  not a discovery that the text was wrong, and the true value is still what the server returns
  and what the admin panel shows. **Writing that distinction down is what stops the next reader
  'restoring' the clearer wording.**
  ⚠ **AND THE CLAMP IS NOT POLICY B — SAID IN THE CODE, THE TESTS, THE DECISIONS RECORD AND
  THE CHECKLIST, BECAUSE A READER SEEING `$0` CANNOT TELL B FROM A.** The stored arithmetic is
  still `earned − cashouts`, so a referrer at −$500 who then earns $300 computes to −$200 and
  still sees `$0` — their $300 silently absorbed, which is the policy Danny REJECTED. The
  write-off record that makes B real is filed under the money-phase launch gate.
  ⚠ **FOUR WIDTHS.** (i) the "over-paid" wording restored → **6 red**, including the wording
  fence; (ii) a message beside a `$0` balance → **2 red**; (iii-a) the admin card reading the
  SPECULATIVE `detail.balance` instead of the true available → **2 red**, one of them the
  PAIRED POSITIVE; (iii-b) the admin card CLAMPING like the referrer → **1 red**. **(iii-b) is
  the one worth keeping: it is the failure where the referrer rule leaks onto the admin surface
  and an over-payment becomes invisible to everyone** — the fixture deliberately sets
  `detail.balance` to 500 against a true −500 so reading the wrong field is observable rather
  than coincidentally right.
  ⚠ **A CASE NAME MISSTATED ITS OWN ASSERTION AND WAS RENAMED.** *"no method button is
  offered"* asserted ABSENCE; the ruling is that the request is **disabled**, which is a
  different claim — hiding the controls would leave a referrer with a `$0` and no idea what the
  screen is for. It now reads *"every method button is disabled"*.
  ⚠ **AND THE FIRST WRITING OF THAT CASE FAILED AGAINST CORRECT CODE FOR A SECOND REASON:
  `queryByText('Venmo')` RETURNS THE LABEL `<p>` INSIDE THE BUTTON**, so a text assertion could
  never reach the button's own `disabled` state. The enclosing control is what carries it.
  ⚠ **GATING THE FINAL CONTINUE BUTTON WAS NOT ENOUGH, AND A TEST IS WHAT SAID SO.** A
  referrer at a non-positive balance could still pick a method and type an amount, and was
  stopped three steps later — which, with the balance message now removed by ruling, is a dead
  end carrying no information. The method chooser itself is disabled now.
  ⚠ **THE WORDING FENCE'S FIRST NEEDLE REPORTED TWO CORRECT LINES, AND NARROWING IT WAS THE
  FIX RATHER THAN EXEMPTING THE FILE.** A bare `negative` match flagged
  `ExperiencePopup.jsx`'s `direction === 'negative'` twice — the experience flow's own
  positive/negative branch, nothing to do with a balance. **A heuristic that reports plausible
  findings is worse than none**, and a fence flagging correct code gets carved out within a
  month. `negative` is now flagged only inside a STRING CONTAINING A SPACE — copy has spaces,
  an enum value does not — and the harness floor validates that discriminator in **BOTH**
  directions: it catches synthetic copy and spares the identifier.
  ⚠ **`ProfileTab.jsx`'s COVERAGE IS STRUCTURAL, AND THE LIMIT IS STATED RATHER THAN IMPLIED.**
  Mounting it means standing up six unrelated fetches, so the clamp is asserted from SOURCE
  (`Math.max(0, serverBalance)` present, the old `reduce` over `conversion_bonus` absent) while
  the wording fence covers its copy. **A source assertion proves the clamp is WRITTEN, not that
  it paints.**
  ⚠ **AND THE ADMIN TEST'S FIRST HELPER FAILED EVERY CASE WITH "expected null to be truthy",
  WHICH READS LIKE A MISSING CARD AND WAS A DETAIL VIEW THAT NEVER OPENED.** It passed
  `on401` as a prop — `on401` is a LOCAL helper built from `setLoggedIn` — and clicked the
  referrer's NAME, which is plain text with no handler. The detail opens from a "View" button.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3b) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2103 / 347 / 1369 / 83**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3b) ITSELF, BECAUSE IT SHIPS TESTS.**
  ⚠ **THE REACT HALF MOVED AND THE SERVER HALF DID NOT, WHICH IS THE MIRROR OF THE LAST
  THREE ENTRIES.** React 1358 → 1369 is **+11**, one new file
  (`cashOutBalanceSource.test.jsx`), and 82 → 83 is that file. Server held at 2103 / 347
  and was **re-measured** rather than carried.
  ⚠ **AND THE SERVER HOLDING IS THE READING WORTH CHECKING, BECAUSE THIS COMMIT ADDS A
  ROUTE.** `GET /api/cashout/balance` is new, and no server count moved — asked before the
  run: `adminRouteCoverage`'s exact route count covers the ADMIN routers only, and nothing
  counts referrer routes by number. A new route that moved no count is the expected shape
  here; the same addition under `admin/` would have taken that fence red by one.
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN.** `src/components/referrer/` is **not** one of
  `adminBranding.test.jsx`'s four walked roots, so the two non-test `src/` files this commit
  edits add nothing there, and the arithmetic closes at exactly 11.
  ⚠ **11 FROM 11 `it(` LINES: two loops, BOTH inside `it()` bodies** (each is the fence's own
  directory walk), so neither multiplies.
  ⚠ **THE FENCE FOUND A SECOND INSTANCE OF THE DEFECT THAT NOBODY HAD LOOKED FOR, AND THAT
  IS THE ENTRY WORTH KEEPING.** The commit's subject was `CashOutTab.jsx`. On its first run
  the fence named `src\components\referrer\ProfileTab.jsx:63`, which computed a
  DIFFERENT client-side balance — `filter(p => p.bonusEarned).reduce(… p.conversion_bonus ??
  p.payout ?? 0)`. It was **better** than the one being removed (it preferred the CONFIRMED
  bonus over the speculative ladder) and still wrong in the way that matters: it subtracted
  **no cashouts at all**, so a row labelled "Balance" was really lifetime EARNINGS, and a
  referrer who had cashed out everything still saw their full earnings there. **The two
  screens also disagreed with each other**, because their fallback chains differed.
  ⚠ **NARROWING THE FENCE TO THE ONE FILE WAS THE WRONG FIX AND WAS REJECTED.** Danny's
  instruction was *no `src/` file computes an available balance itself*; a per-file carve-out
  is the "exempt rather than reword" failure this file already forbids, and it would have
  shipped a fence whose green meant nothing. ProfileTab was rewired to the same endpoint.
  ⚠ **THE TWO WIDTHS.** (i) the client-side sum restored — both halves, because the `pipeline`
  prop is the INPUT and restoring only the expression does not compile → **10 of 11 red**,
  including Danny's shape. **The width is wide because the INJECTION is wide, not because the
  cases are coupled** — it reverts the whole mechanism, so every case that reads the server
  number fails. (ii) a NEW `src/` file of the forbidden shape → **exactly 1 red**, the fence.
  ⚠ **AND THE INJECTION IS OBSERVABLE ONLY BECAUSE THE TEST PASSES A PROP THE FIXED
  COMPONENT IGNORES.** `CashOutTab` no longer takes `pipeline`, so a mount without it would
  make the restored sum total **0** — and "$0 available" against a −500 server balance would
  look like a pass. The suite passes a deliberate `DANNYS_PIPELINE` summing to exactly 500,
  inert today, so the restored formula produces the figure his screen really showed.
  **An injection that cannot reach a discriminating value is not a guard-proof.**
  ⚠ **AND ONE OF THIS COMMIT'S OWN ASSERTIONS WAS THE SUBSTRING TRAP, IN THE CHECKER.**
  *"a FAILED balance fetch fails closed"* was written `not.toMatch(/available$/)` and FAILED
  against correct code, because the honest copy **"Balance unavailable"** ends with
  "available". What is forbidden is reporting a FIGURE as available, so the needle is now
  `/\$[\d,]+ available/`. Same class as this file's `A32` / `#A32D2D` record, one layer in.
  ⚠ **THE `pipeline` PROP WAS REMOVED FROM THE SIGNATURE AND THE CALL SITE, NOT LEFT
  UNUSED**, and a case pins its absence: the prop was the input to the deleted calculation,
  so while it remained the calculation could be restored without touching the caller and
  nothing would flag it.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2103 / 347 / 1358 / 82**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (3) ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2095 → 2103 is **+8**, one new file (`getNeverWritesMoney.test.js`); suites 346 → 347
  is that file's single top-level describe. React did not move — no `src/` file was touched —
  and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (8); the file has **nine** loops and **none wraps a case** — six sit in the
  fence's helper bodies (the directory walk, the paren matcher, the needle pairs) and three
  inside `it()` bodies — so 8 is exact rather than 8 × anything.
  ⚠ **THE GET-TIME WRITE IS GONE, AND THE FENCE THAT REPLACES IT NAMES `file:line`.** A GET
  loading the referrer pipeline used to INSERT a `referral_conversions` row with
  `bonus_amount` from the speculative `500 + boost` ladder, under `ON CONFLICT DO NOTHING` —
  so the FIRST writer won forever and this path RACED the webhook that derives a payout from
  a schedule. Conversions are now written in exactly one place.
  ⚠ **THE TWO WIDTHS, BOTH CONFIRMED OBSERVABLE RATHER THAN MERELY RED.** (i) the removed
  write restored → **3 red**, and the fence's message named
  `server\routes\referrer.js:898 — INSERT INTO referral_conversions`; (ii) a money write added to a
  DIFFERENT GET route (`admin/cashouts.js`'s list handler) → **exactly 1 red**, naming
  `server\routes\admin\cashouts.js:25 — UPDATE cashout_requests`. **(ii) exists because (i) only
  proves the fence sees the route this commit edited**; a fence claiming "any GET route" has
  to be shown to reach one it was not written against.
  ⚠ **AND A GUARD-PROOF MEASURED ONE OF THIS COMMIT'S OWN CASES NON-DISCRIMINATING, WHICH IS
  THE ENTRY WORTH KEEPING.** *"a GET does not MODIFY an existing conversion row either"* stayed
  **GREEN** under injection (i) — correctly, because the restored statement carries
  `ON CONFLICT … DO NOTHING`, so an existing row is spared by construction. The case is kept
  deliberately, for the writer shape it DOES cover (a future `DO UPDATE SET bonus_amount =
  EXCLUDED.bonus_amount`, which "the table stays empty" could never see), and its comment now
  records the measurement instead of the reasoning it was written on.
  ⚠ **AND THE FIRST WRITING OF THIS FILE WAS VACUOUS IN THE MOST ORDINARY WAY: THE ROUTE
  RETURNED 503 AND TWO ABSENCE CASES WENT GREEN BECAUSE NOTHING RAN.** The fixture omitted a
  `contractor_crm_settings` row, so `getCRMAdapter` threw *'No connected CRM'* before the
  handler body. **Only the case that asserts the removed code's own trigger condition was MET
  — `item.bonusEarned === true` on the response itself — could tell the difference.** That is
  this file's vacuity shape #9 (a fixture establishing a proxy rather than the precondition),
  and it is why an absence assertion needs its precondition asserted in the same case.
  ⚠ **THE FIXTURE USES `connection_method = 'api_key'`, NOT `'oauth'`,** because the oauth
  branch calls `refreshTokenIfNeeded` and reaches Jobber. `fetchPipelineForReferrer` reads
  `pipeline_cache` only, so the whole route runs offline against real code with no stub.
  ⚠ **THE FENCE STRIPS COMMENTS, AND THAT IS A LIVE INSTANCE RATHER THAN A PRECAUTION.**
  `routes/referrer.js` now carries a comment naming both the verb and the table it removed, so
  an unstripped fence would flag the very comment recording the fix. **Rewording was NOT the
  right fix here** — the comment has to be able to name what it removed — which is the one
  shape where this file's *"reword, never exempt"* rule needs the parser to change instead.
  ⚠ **AND THE FENCE'S BLIND SPOT IS WRITTEN DOWN RATHER THAN ASSUMED AWAY:** it matches SQL
  written DIRECTLY inside a GET handler, so a GET calling a helper that writes is invisible to
  it. The closure was checked BY HAND once, at this commit — every remaining write to either
  money table sits in a POST, PATCH or DELETE handler or in the invoice-paid webhook.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (1) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2095 / 346 / 1358 / 82**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (1) ITSELF, BECAUSE IT SHIPS TESTS.**
  ⚠ **THE GATE WAS RUN TWICE AND THE SECOND RUN IS THE ONE CITED**, because markdown-only edits
  landed after the first — this block, and ten citations in `PRE_LAUNCH_CHECKLIST.md` converted to
  role form. It was checked that **no test reads either file** (`readFileSync` over `server/test/`
  returns nothing for `CLAUDE.md` or the checklist; every mention is in a comment), so a change was
  not possible — **and "it cannot have changed" is a prediction, not a measurement**, which is this
  block's own rule from the Commit 7 entry. Both runs read `EXIT=0` and the same seven numbers.
  Server 2080 → 2095 is **+15**, one new file (`cashoutBalanceSingleSource.test.js`); suites
  345 → 346 is that file's single top-level describe. React did not move — **no `src/` file was
  touched at all** — and was re-measured. **All four predicted before the run and matched.**
  ⚠ **15 FROM 13 `it(` LINES, AND NINE LOOPS OF WHICH EXACTLY ONE MULTIPLIES.** The wrapping one
  is a three-entry `for` over the deducting states (`pending` · `approved` · `paid`), asserted per
  state BY NAME. The other eight were each checked for POSITION rather than counted: four sit in
  the fence's own helper bodies (`serverFiles`, `sqlSpans`, `findLocalBalanceSums`) and four inside
  `it()` bodies. So 12 × 1 + 1 × 3 = 15.
  ⚠ **AND ONE EXISTING CASE WAS REWRITTEN AND CONTRIBUTES 0, WHICH IS THE ENTRY WORTH KEEPING:
  IT WAS INVERTED, NOT STALE, AND IT PINNED THE DEFECT.** `cashout.test.js`'s *"balance formula
  SQL: pending+approved reduce available; denied excluded"* **re-implemented the old two-query
  formula inside its own body** and asserted `pending = 150` — i.e. it asserted that a SETTLED
  cashout does not deduct, which is finding 1. **A test that re-implements the production formula
  cannot fail when the formula is wrong; it can only agree with it**, and this one agreed for
  months. Rewritten to drive the shared `getCashoutBalance` — so a regression now reds it instead
  of being mirrored by it — and its comment's citation *"the exact queries from referrer.js lines
  846-847"* was **already rotted into a file where those queries no longer exist**; cited by role now.
  ⚠ **THE THREE WIDTHS, AND (ii) IS THE ONE THAT EARNS ITS PLACE.** (i) the old
  `status IN ('pending','approved')` gate restored — the defect exactly → **7 red** across BOTH
  suites, including both Danny's-shape cases (his real numbers: earned $500, two settled $500
  cashouts, old deduction **0**, so it read $500 available and allowed another request);
  (ii) the `<> 'denied'` exclusion removed so EVERY cashout deducts → **4 red**, including the
  DENIED paired positive. **Without (ii) a function that deducted every cashout would have passed
  the whole three-state loop**, because that loop cannot tell "not denied" from "all of them";
  (iii) a new file under `server/routes/` computing its own per-user balance → **exactly 1 red**,
  the single-source fence, and it was confirmed OBSERVABLE rather than merely red — the failure
  message names `server\routes\_gp_tmp.js:5`, file and line.
  ⚠ **THE FENCE DISCRIMINATES ON `user_id`, AND THAT IS WHAT KEEPS IT ALIVE.**
  `routes/admin/metrics.js` sums `cashout_requests` by CONTRACTOR for a dashboard total — a
  different and correct question. A fence that flagged it would be switched off within a month,
  which this file already records as the fate of any check that reports plausible findings. There is
  a paired NEGATIVE asserting metrics.js is not flagged, so the discriminator cannot rot silently.
  ⚠ **ITS NEEDLES ARE ASSEMBLED FROM CONCATENATED PIECES, AND IT READS SQL SPANS RATHER THAN LINE
  WINDOWS.** Both are this file's own recorded defects: a stylesheet sweep that walked its own test
  file and reported itself, and a big/bold heuristic that read neighbouring lines and produced 21
  false flags. Comments are stripped from every scanned file first.
  ⚠ **AND THE FENCE HAS A NON-VACUITY FLOOR THAT IS NOT DECORATION:** it asserts the needle
  actually matches the sum inside `server/utils/cashoutBalance.js`. Without it, a needle matching
  NOTHING passes identically to a codebase with no second formula.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (2) ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2080 / 345 / 1358 / 82**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PAYOUT-AUDIT COMMIT (2) ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2065 → 2080 is **+15**, one new file (`stripeTransferAmountAuthority.test.js`); suites
  344 → 345 is that file's single top-level describe. React did NOT move — and that is the
  entry worth reading, because this commit **does** touch `src/`. **All four predicted before the
  run and matched.**
  ⚠ **15 FROM 13 `it(` LINES, AND THE GAP IS WHY THE COUNT IS COUNTED RATHER THAN READ.**
  An anchored `^\s*it\(` reports **13**. The file has two loops and **only one WRAPS an `it()`** —
  a three-entry `for` over the forbidden cashout states (`pending` · `denied` · `paid`), asserted
  per state BY NAME; the other iterates matched call sites **inside** an `it()` body and emits
  nothing. So 12 × 1 + 1 × 3 = 15. **Reading "13 lines" as 13 cases would have been low by two**,
  which is the direction that looks identical to a suite that partly failed to register.
  ⚠ **REACT HELD AT 1358 / 82 WHILE `src/components/admin/AdminCashOuts.jsx` CHANGED, AND THE
  ARITHMETIC WAS ASKED BEFORE THE RUN RATHER THAN RECONCILED AFTER IT.** `src/components/admin` **is**
  one of `adminBranding.test.jsx`'s four walked roots — but that sweep emits one case per **FILE**,
  and this commit adds no file there; it edits an existing one. So no phantom, and the React halves
  were **re-measured** rather than carried.
  ⚠ **A GUARD-PROOF PROVED ONE OF THIS COMMIT'S OWN TESTS COULD NOT MEASURE WHAT ITS NAME
  CLAIMED, AND THAT IS THE ENTRY WORTH KEEPING.** Injection (iii) removed `AND status = 'approved'`
  from the claim `UPDATE` — **the compare-and-swap itself** — and the case named *"two CONCURRENT
  requests … transfer exactly once"* stayed **GREEN**. Only the source fence fired, so the
  injection's behavioural width was **0**. Cause: the claim runs BEFORE the transfer, so request 1
  flips the row to `'paid'` and request 2 is refused by the **state gate**, conditional `UPDATE` or
  not. The window the CAS protects is between the `SELECT` and the `UPDATE`, and **nothing a test
  can do from outside the process reliably lands two requests inside it** — a slow stub does not
  help, because the claim has already happened by the time the stub is entered. Renamed to the
  property it can actually pin (*two concurrent requests never both transfer*), with the
  measurement recorded beside it. **The CAS's own proof is therefore the source fence plus
  injection (iv)**, which removes the gate AND the CAS together and takes it red.
  ⚠ **THE FOUR WIDTHS, AND (i) vs (ii) IS THE PAIR WORTH SEPARATING.** (i) the pass-through alone
  (`bonusAmount: amountToSend` → `bonusAmount`) → **3 red**, and crucially the over-ask case stays
  GREEN, because the mismatch check still refuses it; (ii) the mismatch check disabled **as well**,
  which is the actual pre-fix state — body decides and nothing compares it — → **6 red**, including
  *"REFUSES a request asking for MORE than the approved amount"*, which is the guard-proof Danny
  named; (iii) → **1 red**, the source fence only (see above); (iv) both at-most-once gates removed
  → **6 red**, including the repeat-request case. **Two injections reintroduce two different halves
  of one defect, and reporting a single number for "the amount fix" would have hidden that the
  over-ask case is protected by the CHECK and not by the pass-through.**
  ⚠ **EVERY REVERT WAS AN INVERSE PATCH IN A `finally`, PROVEN BYTE-IDENTICAL BY sha256**, with
  anchors checked unique in **BOTH** directions before writing, empty-string replacements refused
  outright, and the file re-read from disk per patch so two edits to one file could not degrade into
  the last one only. Final re-run: `tests 2080 · pass 2080 · fail 0`, and the file's sha256 matched
  the baseline exactly.
  ⚠ **AND AN EXISTING SUITE'S SAFETY MECHANISM HAD TO BE RE-DERIVED RATHER THAN CARRIED — THE
  `STRIPE_SECRET_KEY` RULE IN THIS FILE, ARRIVING FOR THE THIRD TIME.**
  `crossTenantCredentialWrites.test.js`'s stated property is *no test may ever reach Stripe*, and its
  MECHANISM was a **negative amount in the request body**, which made `amountInCents <= 0` throw
  before dispatch. This commit makes the body amount non-authoritative, so that mechanism **retired
  silently** — the row's amount (250) would have been dispatched for real. The sentinel moved into
  the **ROW** (two new fixtures seeded at `NEVER_DISPATCHED_AMOUNT`), every D4 assertion unchanged,
  14/14 still green. **The property was preserved; the mechanism could not be.** The new file states
  the property twice over with two INDEPENDENT guards — a stub that cannot dispatch, and
  `STRIPE_SECRET_KEY` pinned **empty** so a stub that failed to install throws instead of calling out.
  ⚠ **AND THE HOOK FAULT AGAIN: deleting `contractors` without clearing `titles` first failed
  EVERY case inside setup**, including ones with no database dependency — the shape this file already
  records, where a hook fault fails what cannot depend on it while a subject fault spares it.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 6 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2065 / 344 / 1358 / 82**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 6 COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 2056 → 2065 is **+9**, all APPENDED to the EXISTING `assignmentPreview.test.js`;
  suites 341 → 344 is **+3**, the three new top-level describes in that same file. ⚠ **A file
  count that does not move while the suite count does is the expected shape here** — no new
  test file arrived. React did not move — no `src/` file was touched — and was re-measured.
  ⚠ **A GUARD-PROOF CAME BACK GREEN AND FOUND A COVERAGE HOLE THAT MATTERED, WHICH IS WHY THE
  COUNT MOVED 8 → 9 MID-BUILD.** Making `ownerWouldChange` return TRUE for every transition
  changed nothing: **no case drove a preview writer with the same rep ALREADY IN PLACE.** Every
  other date fixture either has both halves cleared first (so the before-owner is null and the
  date *should* move) or is never visited by the replay at all (so no writer runs). **The
  same-rep branch — the one R5f is entirely about — was untested from the preview's side.**
  ⚠ **THE SHAPE THAT REACHES IT IS WORTH WRITING DOWN, BECAUSE IT IS NOT OBVIOUS:**
  `written_by = 'live'` so the discard SPARES the row, plus a request fact naming the mapped
  rep so the client is RECREATABLE and the replay still visits it. The writer is then called
  with the rep already there. The new case asserts `recreatable`, `requestsReplayed > 0` and
  the resulting rep as preconditions, so it cannot quietly stop reaching the branch.
  ⚠ **THE FOUR WIDTHS:** (i) the recording writers ignoring the `fact` argument — the exact
  pre-Commit-6 state, a stub silently dropping a 7th positional parameter → **3**; (ii) the JS
  twin disagreeing with the SQL on the same-rep transition → **exactly 1**, naming the new
  case; (iii) `simulateDiscard` dropping `assigned_at` → **4**; (iv) the preview reaching the
  REAL writers → **13**. Every revert an inverse patch in a `finally`, byte-identical by
  sha256, anchors unique in BOTH directions, empty-string replacements refused outright.
  ⚠ **AND THE DATE SUMMARY EXISTS BECAUSE THE REP SUMMARY CAN READ AS "NOTHING HAPPENS" WHILE
  EVERY DATE MOVES.** Measured on the demo fixture: **`would change 0`** for the rep and
  **`date would change 3`** in the same run. An operator reading only the old three lines
  would have approved a run that rewrote every date in the book.
  ⚠ **A SHELL HEREDOC ATE THE ESCAPES FOUR TIMES IN THIS ONE COMMIT** — appending a test block,
  then three separate attempts to patch a harness. Each time the fix was the same: write the
  content to a FILE with an editor and let a script read it. The rule is in this file; the
  habit is what costs the time.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 5 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2056 / 341 / 1358 / 82**.
  Server 2045 → 2056 is **+11**, one new file (`assignedAtReaders.test.js`); suites 337 → 341
  is that file's **four** top-level describes. React did not move — the only `src/` edit is a
  COMMENT in an existing file — and was re-measured. ⚠ **THE +11 NETS A DELETION: one case was
  REMOVED from `repClients.test.js` and one added in its place**, so the arithmetic is
  11 + 1 − 1. Writing both numbers rather than the net is this file's own rule.
  ⚠ **TWO OF FIVE GUARD-PROOFS CAME BACK GREEN, AND BOTH WERE VACUOUS FIXTURES — THIS IS THE
  ENTRY WORTH KEEPING.** Neither was a fence failing to fire; both were tests that could not
  reach the mechanism they named.
  ⚠ **(i) THE PAGING CASE SEEDED 12 ROWS AND `REP_BOOK_LIMIT` IS 100.** Everything came back
  on page 1, `nextCursor` was null, and **the keyset clause was never evaluated at all** —
  `$4` is NULL and the whole condition is inert. So reverting the cursor to `updated_at`
  changed nothing. **A paging test on a book smaller than one page is not a paging test.**
  The book is 105 rows now and the PAGE COUNT is asserted, so it cannot quietly shrink back
  under the limit.
  ⚠ **(iii) THE WINDOW CASE SET `sticky_set_at` EQUAL TO `assigned_at`.** Reverting
  `timeframeClause` to the retired COALESCE therefore produced the SAME answer. The
  discriminating fixture is the shape R5f actually exists for — a tenure that began 200 days
  ago and a same-rep LOCK a day ago — and the case now asserts the two readings disagree
  about that row BEFORE asserting the window. **A fixture whose columns agree cannot tell two
  readings apart**, which is this file's recorded "seed the state furthest from the default".
  ⚠ **THE REPAIRED WIDTHS:** (i) → **1**; (ii) the list ORDER BY reverted → **2**; (iii) → **1
  behavioural** plus 1 structural text fence; (iv) Focus §1's tie-break reverted → **1**;
  (v) `getClientAssignment` reverted to the rep-id branch → **1**. Every revert an inverse
  patch in a `finally`, byte-identical by sha256, anchors unique in BOTH directions, and the
  harness refuses an empty-string replacement outright.
  ⚠ **AND A BACKTICK INSIDE A SQL COMMENT INSIDE A TEMPLATE LITERAL CLOSED THE STRING —
  THE THIRD RECORDED INSTANCE, COMMITTED BY A SESSION THAT HAD READ THE RULE AT THE TOP OF
  THIS FILE.** Two new comments in `rep.js`'s query strings quoted column names in backticks.
  It surfaced as `SyntaxError: missing ) after argument list` with **`tests 1 · suites 0`** —
  the loud variant, and the exact signature this file names. Reworded, never escaped.
  **Knowing the rule is not the mechanism; the `suites 0` reading is.**
  ⚠ **THE GATE ALSO WENT RED ON `repTimeframe.test.js`'s SOURCE-TEXT FENCE, WHICH WAS
  PREDICTED AND FILED.** It pinned the retired COALESCE by name. Re-pointed rather than
  deleted: the property — the window is the ASSIGNMENT date and never the write clock — is
  unchanged, and it now ALSO forbids the retired columns, because a fence that merely
  required `assigned_at` would pass against a clause reading both.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 4 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2045 / 337 / 1358 / 82**.
  Server 2036 → 2045 is **+9**, one new file (`assignedAtNotNull.test.js`); suites 335 → 337 is
  that file's **two** top-level describes. React did not move — no `src/` file was touched — and
  was re-measured. Counted with an anchored `^\s*it\(` (9); the file's one loop sits inside an
  `it()` body. **The case count matched; the GATE DID NOT — see below.**
  ⚠ **THE GATE WENT RED FIRST AT `fail 9`, AND EVERY ONE WAS A TEST WHOSE SUBJECT THIS COMMIT
  DELETED.** `assigned_at` became NOT NULL, and Commit 1's own suite is built entirely on the
  column being NULLABLE: its nullability assertion, its "inserted without it gets NULL" case,
  and every backfill case — which seeds a row with `assigned_at` NULL and therefore **cannot
  insert its fixture at all** any more. Repaired openly per the characterization rule: the
  nullability assertion was INVERTED with its reason, the insert case was REPOINTED onto the
  R5h triple (its old property now lives beside the constraint), and the backfill describe
  **drops the constraint for each case and restores it in `afterEach`**.
  ⚠ **I PREDICTED THE FIXTURE BLAST RADIUS AND MISSED THIS ONE, WHICH IS THE ENTRY WORTH
  KEEPING.** I enumerated the ~20 fixture INSERTs that would fail and repaired them before
  running — and did not think of the suite whose SUBJECT was the nullability itself. **A search
  for "who writes this column" cannot find "who asserts this column's shape".** The gate found
  it; nothing else would have.
  ⚠ **AND A SUITE THAT MUTATES THE SHARED SCHEMA IS UNUSUAL ENOUGH TO SAY TWICE.** Both the new
  gate suite and Commit 1's backfill describe now DROP and re-add the constraint around their
  cases, because a row with `assigned_at` NULL cannot otherwise exist. Restores are in
  `afterEach`/`after` rather than at the end of each case, so an assertion failure cannot leave
  the column nullable for everything that follows — which would surface as unrelated suites
  failing on inserts, a long way from the cause.
  ⚠ **THE THREE GUARD-PROOF WIDTHS, AND (i-b) IS THE ONE THAT SEPARATES TWO CLAIMS.** (i) the
  PRE-RULING code restored — no gate, and the throw allowed to escape → **4 red**; (i-b) the
  gate removed with the catch left in place → **2 red**, and crucially the "never throws" cases
  stay GREEN: **the boot survives because of the CATCH, while the operator loses the precise
  "N rows, here are their ids" alert because of the GATE.** Those are two different claims and
  only running both injections tells them apart. (ii) the constraint never applied → **exactly
  1**, the paired positive, which without it would be invisible — every "it was not applied"
  assertion would still pass.
  ⚠ **AND THE HARNESS REFUSED TO INJECT UNTIL I STOPPED REPLACING WITH `''`.** The
  both-directions uniqueness check fired on an empty replacement, because `''.count('')` is
  enormous — which is this file's own *"never revert by replacing with `''`; use a marker"*
  rule, caught by a check rather than by a left-injected file. Markers now.
  ⚠ **AND A SHELL HEREDOC ATE THE ESCAPES IN THE FIX FOR THAT**, so the harness edit was made
  with an editor instead. Third recorded instance in this arc of the rule that regex- and
  escape-bearing code goes in a FILE.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 3 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2036 / 335 / 1358 / 82**.
  Server 2023 → 2036 is **+13**, one new file (`manualAssignedAt.test.js`); suites 332 → 335 is
  that file's **three** top-level describes. React did not move — no `src/` file was touched —
  and was re-measured. **All four predicted before the run and matched.** Counted with an
  anchored `^\s*it\(` (13); the file's two loops both sit in `beforeEach` and wrap no case.
  ⚠ **TWO OBLIGATIONS PULL IN OPPOSITE DIRECTIONS IN THIS COMMIT, AND THE WHOLE RISK IS THAT
  ONE SILENTLY WINS.** The DATE obeys the same-rep guard; the REP obeys A36.3 — a manual
  assignment ALWAYS supersedes the engine, so the shared writer has no
  `WHERE sticky_rep_id IS NULL` and never may. ⚠ **A guard leaking from the date onto the rep
  would leave EVERY date assertion passing** while a contractor's correction silently did
  nothing, so the A36.3 cases are load-bearing rather than decorative — guard-proof (ii) is
  what pins them.
  ⚠ **AND THREE WIDTHS ARE TWO THINGS AT ONCE, SO EACH IS SPLIT RATHER THAN REPORTED AS ONE
  NUMBER.** (i) the date re-stamped unconditionally → **2 behavioural** + 1 structural; (ii)
  the engine's existing-wins guard added to the manual writer → **2 behavioural** + 1
  structural; (iii) the writer ignoring its `tx` and using the pool → **exactly 1**, no
  structural; (iv) the guard made always-on → **1 behavioural** + 1 structural. The structural
  one is the same source-text fence each time, and it firing is the fence working — but
  **an injection that also trips a text fence is reporting two things at once, and one of them
  is not evidence about the behaviour.** Every revert was an inverse patch in a `finally`,
  byte-identical by sha256, with anchors checked unique in BOTH directions before writing.
  ⚠ **(ii) REDS THE PAIRED POSITIVE TOO, AND THAT IS CORRECT RATHER THAN NOISE.** With
  existing-wins on the manual writer, a DIFFERENT-rep re-assign onto an existing sticky is
  also a no-op, so its date does not move either. Both failures are genuine consequences of
  the same broken rule.
  ⚠ **A SOURCE FENCE CAUGHT ITS OWN AUTHOR MISCOUNTING, WHICH IS THE ENTRY WORTH KEEPING.**
  The "both routes call the shared writer" fence first counted `writeManualSticky(` and
  expected **3** — "one import plus two call sites" — and got 2, because the import is a
  DESTRUCTURE and carries no `(`. The needle would have matched the import in a file that
  imported it differently, which is the substring trap this file records. The import is now
  asserted by its own pattern and the call sites counted separately, so each number means one
  thing.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 2 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **2023 / 332 / 1358 / 82**.
  Server 1998 → 2023 is **+25**, one new file (`assignedAtWriters.test.js`); suites 327 → 332 is
  that file's **five** top-level describes. React did not move — no `src/` file was touched — and
  was re-measured. **All four predicted before the run and matched.** Counted with an anchored
  `^\s*it\(` (25); the file's five loops were each checked for POSITION — two in `beforeEach`,
  three inside `it()` bodies iterating assertions and a case table — so **none wraps a case**.
  ⚠ **AND ONE GUARD-PROOF'S WIDTH IS TWO THINGS AT ONCE, WHICH IS WORTH SEPARATING RATHER THAN
  REPORTING AS A NUMBER.** Injection (iv) — the provisional form comparing only the provisional
  halves — reds **2**, but only **one** is behavioural (a provisional-B write under sticky-A
  moving a date whose owner never changed). The other is a STRUCTURAL fence asserting the two
  halves of the shared clause differ in exactly one term. **An injection that also trips a text
  fence is reporting two things at once, and one of them is not evidence about the behaviour** —
  this file already records that from the lock-timeout commit. The behavioural width is 1.
  ⚠ **THE OTHER FOUR WIDTHS:** (i) the CASE replaced by a bare `EXCLUDED` — R5f's exact defect,
  a same-rep lock moving the date → **8**; (ii) the quote fact pointed at the clock instead of
  `approvedAt` → **exactly 1**; (iii) `resolveModeAMatch` no longer carrying `requestAt`, which
  is the pre-Commit-2 state → **6**; (v) both writers stamping `NOW()` regardless of the fact →
  **12**. Every revert was an inverse patch in a `finally`, proven byte-identical by sha256.
  ⚠ **AND THE HARNESS NOW CHECKS ANCHOR UNIQUENESS IN BOTH DIRECTIONS BEFORE WRITING ANYTHING,
  BECAUSE COMMIT 1's DID NOT AND LEFT A FILE INJECTED.** A forward anchor that matches once
  gives no guarantee the REVERSE anchor does; there the injected form also matched a prose
  sentence, the revert refused, and `db.js` was left holding the injection.
  ⚠ **AND THE ONE CASE MOST WORTH COPYING IS THE ONE THAT NEEDED A DELETE.** *"A re-run writes
  the ORIGINAL date"* is **vacuous** written the obvious way: seed a row, replay twice, assert
  the date is unchanged — that passes IDENTICALLY against a writer that stamped `NOW()` on the
  first run, because the same-rep guard then preserves the wrong value just as faithfully as the
  right one. R5 holds because the date is a FUNCTION OF THE STORED FACT, so the discriminating
  case **deletes the row between runs, exactly as a rebuild does**, and asserts the second date
  equals the request's own `created_at`. Injection (v) takes it red; without the delete it
  would not.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PHASE 1b COMMIT 1 COMMIT ITSELF,
  BECAUSE IT SHIPS TESTS.* It read **1998 / 327 / 1358 / 82**.
  Server 1984 → 1998 is **+14**, one new file (`assignedAtColumn.test.js`); suites 324 → 327 is
  that file's **three** top-level describes. React did not move — **no `src/` file was touched at
  all**, and the three non-test files this commit edits are `server/db.js`, `CLAUDE.md` and
  `PRE_LAUNCH_CHECKLIST.md`, none of them under one of `adminBranding.test.jsx`'s four walked
  roots — and was re-measured rather than carried. **All four predicted before the run and
  matched.** Counted with an anchored `^\s*it\(` (14); the file's two loops were each checked for
  POSITION — one `.map` building a Map and one `for` iterating column names, **both inside `it()`
  bodies** — so neither wraps a case and 14 is exact rather than 14 × anything.
  ⚠ **A GUARD-PROOF'S REVERT REFUSED AND LEFT A SOURCE FILE INJECTED, AND THE CAUSE IS THIS
  FILE'S OWN "SCANS READ COMMENTS" RULE WITH THE SIGN FLIPPED.** Injection (iii) replaced the
  backfill's `COALESCE(sticky_set_at, provisional_set_at, updated_at),` with the two-argument
  form. The FORWARD patch landed (the three-argument anchor was unique). The REVERT then searched
  for the two-argument form and found it **twice** — once in the SQL it had just injected, and
  once in a **PROSE SENTENCE in the same file's header comment** describing the very
  two-COALESCE defect the column exists to fix. The revert asserted rather than guessing, which
  is right, but its `finally` raised **before writing**, so `db.js` was left holding the
  injection. Recovered by hand, re-verified 14/14 green, and the anchor now carries
  `SET assigned_at = ` so it cannot match prose. ⚠ **There prose MATCHES a forbidden pattern;
  here prose SATISFIED A REVERT ANCHOR — and an anchor that is unique in one direction is not
  therefore unique in the other.** Check both.
  ⚠ **AND A GUARD-PROOF MEASURED ONE OF THIS COMMIT'S OWN COMMENTS FALSE, WHICH IS THE ENTRY
  WORTH KEEPING.** The index fence's non-vacuity floor carried the standard claim — *"an empty
  set, and every assertion built on it would otherwise be skipped rather than failed."*
  Guard-proof (iv) pointed the index name at nothing and reds **3**; guard-proof (iv-b) did the
  same **with the floor assertion deleted** and reds **the same 3**. Every downstream assertion
  dereferences `rows[0]`, so an empty set reds either way — **the floor is a LEGIBILITY guard
  here, not a vacuity guard**, converting a `TypeError` into a named failure. It is kept, for the
  case the measurement does not cover (a later assertion reading the SET rather than a row), and
  the comment now records the measurement instead of the reasoning. **A non-vacuity floor is a
  claim like any other; ask what actually fails without it.**
  ⚠ **THE OTHER THREE WIDTHS, AND TWO DISAGREED WITH THE PREDICTION.** (i) the backfill's
  `WHERE assigned_at IS NULL` guard removed → **2** red, not the predicted 1: it takes the no-op
  case AND "fills only the rows that need it", because without the guard the second call refills
  every row rather than the one new one. (ii) the index's `COALESCE` arguments swapped → **exactly
  1**, the argument-order fence — the defect `idx_cra_contractor_owner`'s own header warning
  describes as an index that "still builds, still looks right, and is silently never used".
  (iii) the backfill's third `COALESCE`
  arm dropped → **exactly 1**, the dateless-row case, with both fact-dated siblings staying green,
  so the injection is narrow. Every revert was an inverse patch in a `finally`, proven
  byte-identical by sha256, and each patch re-read the file from disk so several edits to one
  file could not degrade into the last one only.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE POST-1a DOOR-TAGGING COMMIT, AND
  NOT ONE OF THE FOUR NUMBERS MOVED — WHICH IS NOT STALENESS.* It read **1984 / 324 / 1358 / 82**.
  That commit REWROTE a describe block in
  `captureFetchContract.test.js` (three cases out, three cases in; one top-level describe out, one
  in) and changed three production call sites in `routes/webhooks/jobber.js`, so the tree differs
  from Commit 7b in things the gate can observe while the counts stay put. **Predicted before the
  run from an anchored `^\s*it\(` count of the file at HEAD and in the working tree — 48 both ways,
  7 top-level describes both ways — then all four measured off this run's own log rather than
  carried.** React did not move because no `src/` file was touched, and was re-measured. **Every
  loop in the rewritten block was checked for POSITION**: eight sit in helper bodies
  (`serverFiles`, `argsFrom`, `optionsObjectOf`, the two collectors) and the rest are `for`/`.map`
  inside `it()` bodies or assertions, so **none wraps a case** and 48 is exact rather than 48 ×
  anything.
  ⚠ **AND A GUARD-PROOF FOUND THE NEW LOCK FENCE VACUOUS ON ITS FIRST WRITING, WHICH IS THE ENTRY
  WORTH KEEPING.** Deleting the real `door: 'pipeline-sync'` from `crm/pipelineSync.js` left the
  fence **GREEN**. Cause: `withClientLock(pool, {…}, async (tx) => { … })` closes its paren at the
  END of the callback, so paren-matching hands back the entire locked section — and a `/door/`
  needle over that extent is satisfied by the word **"doors"** in a COMMENT inside the body. The
  needle now reads the OPTIONS OBJECT only, with comments stripped, accepting the ES6 shorthand
  (`upsertAndTagClient`'s locked section passes a bare `door`, so a `door\s*:` needle would have
  flagged a correct site). **This is the "scans read comments" rule with the sign flipped: there prose MATCHES
  a forbidden pattern, here prose SATISFIES a required one.**
  ⚠ **AND THE PRE-EXISTING 6b NEEDLE WAS FALSIFIABLE AT THE THREE SITES IT READ AND VACUOUS AT THE
  ONE IT DID NOT — MEASURED, NOT INFERRED.** With the options object removed entirely, `/door/` still
  matches the rest of the call at `attributeReferredClient`'s locked section and at **none** of the
  other three. So
  widening the fence's SCOPE without tightening its NEEDLE would have added the single door whose
  prose defeats the needle, and reported coverage it never had. **A widening that lands on the one
  unfalsifiable site is indistinguishable from a widening that worked.**
  ⚠ **THE FENCE'S FILE LIST IS NOW DERIVED BY WALKING `server/`, NOT TYPED**, because every sweep in
  this repo that iterated a hand-maintained FILES list has gone stale without announcing it. Six
  guard-proofs, with their widths: (i) the client-update call untagged → **exactly 1**, naming
  the client-update handler's `fetchFullClient` call; (ii) the referral door's lock untagged → **exactly 1**, naming
  `attributeReferredClient`'s locked section; (iii) the fetch needle renamed to match nothing → **exactly 1**, the
  non-vacuity floor firing rather than the fence passing against an empty set; (iii-b) the same for
  the lock needle → **exactly 1**; (iii-c) the walk stopped from reaching `crm/` → **2**, both
  fences' named-door-file checks; (iv) the paired positive — baseline **96/96 green** on the two
  fence suites, and every injection left the other 95 green, so no legitimate site is flagged.
  Every revert was an inverse patch in a `finally`, proven byte-identical by sha256.
  ⚠ **AND 78 DOUBLE-ENCODED UTF-8 SEQUENCES REMAIN IN `captureFetchContract.test.js`, ALL ON PURE
  COMMENT LINES — VERIFIED, NOT ASSUMED.** The rewrite removed the 7 that sat in prose inside the
  block it replaced; the rest are box-drawing separators. **Checked that none sits in a needle, an
  assertion message or a string literal**, so nothing silently matches the wrong thing. It is the
  only file in the repo with any, and repairing it is a docs-pass job, deliberately not mixed into
  a behaviour-and-fence commit.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE COMMIT 7b ONE-ENGINE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1970 → 1984 is **+14 = +19 − 5**, and it is the first entry in this arc where a test file
  was DELETED: one new file (`oneEngineFromFacts.test.js`, 19 cases) against the removal of
  `attributionFetcher.test.js` (5), whose entire subject was `fetchAttributionData` — the live
  Jobber request fetch this commit deletes. Suites 323 → 324 is the same arithmetic: **+2** for the
  new file's two top-level describes, **−1** for the deleted file's one. React did not move — no
  `src/` file touched — and was re-measured. **All four predicted before the run and matched.**
  ⚠ **A DELETED TEST FILE IS THE ONE EVENT THIS TRIPWIRE IS BUILT TO CATCH, SO IT IS SPELLED OUT
  RATHER THAN NETTED.** The rule above says a drop means tests were deleted and to stop — here
  tests WERE deleted, on purpose, because the function they exercised no longer exists. Reporting
  only "+14" would hide that under a rise. **When a figure nets a deletion against an addition,
  write both numbers.**
  ⚠ **COUNTED WITH AN ANCHORED `^\s*it\(` (19), AND THE FILE'S ELEVEN `for` LOOPS WERE EACH
  CHECKED FOR POSITION:** one sits in `beforeEach`, the other ten inside `it()` bodies — the
  source-reading fences iterate files, needles and brace-matching indices — so **none wraps a
  case** and 19 is exact rather than 19 × anything.
  ⚠ **THE GATE WENT RED FIRST, AND IT WAS THE 6c RESET-COVERAGE FENCE WORKING EXACTLY AS BUILT.**
  `attributionWiring.test.js touches crm_request_facts but never clears it` — because 7b made
  `syncSingleClient` CAPTURE before it decides, so a suite that had never written a fact table
  suddenly did. A leaked row reads as a successful write by the case that follows, which is the
  vacuity family wearing a fixture. Repaired by adding the six tables to that suite's reset in
  FK order, never by widening `KNOWN_GAPS`. **The counts were identical on both runs (1984/324),
  which is the expected shape for a reset fix: it changes what rows exist, not how many cases.**
  ⚠ **AND TWO OF THE SEVEN GUARD-PROOFS WERE INVALID ON FIRST WRITING, BOTH READING GREEN.**
  (iii) was written as `if (false) await runAttributionEngine(tx, {` — which DISABLES the engine
  without MOVING it, so the structural fence (which checks the call's position inside the
  `withClientLock` extent) correctly did not fire; rewritten to actually relocate the call onto
  the pool after the lock, it reds **exactly 1**. And the narrow parity injection pointed the
  replay's anchor at `new Date(0)` — the EPOCH — which does not break the eligibility window but
  makes it maximally PERMISSIVE, so the replay reached the same rep by a wider route and the pair
  stayed green; pointed a year into the FUTURE instead, it reds **exactly 2**. ⚠ **An injection
  that loosens a constraint tests nothing, because the correct answer is still reachable — the
  direction is the whole content of the injection, not the line it edits.**
  ⚠ **THE OTHER FIVE, WITH THEIR WIDTHS:** (i) a door reaching for a live Jobber fetcher again →
  **14** red across two files; (ii) the reader bound to the wrong client → **9**; (iv) the numeric
  tie-break reversed → **2**; (v) the referral door deciding after a swallowed capture failure →
  **exactly 1**; (vi) `axios` added to the engine, which now runs inside the lock → **exactly 1**.
  Every revert was an inverse patch in a `finally`, proven byte-identical by sha256, and each
  patch was recomputed from the file as read from disk so three edits to one file could not
  degrade into the last one only.
  ⚠ **AND THE HARNESS ITSELF WAS BITTEN TWICE BY THE HEREDOC ESCAPE TRAP THIS FILE RECORDS.** A
  `\b` written inside a quoted heredoc reached Python as a literal **backspace byte** (`\x08`)
  inside a regex, and a `\n` collapsed into a real newline mid-string-literal — the first produced
  a summary parser that silently returned `-1` for every count, the second a `SyntaxError`. **The
  lucky variant and the unlucky variant, in one session.** Regex- and escape-bearing code goes in
  a FILE, written with an editor, never through a shell heredoc.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE COMMIT 7c PREVIEW COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1951 → 1970 is **+19**, one new file (`assignmentPreview.test.js`); suites 319 → 323 is
  that file's **four** top-level describes. React did not move — no `src/` file touched — and was
  re-measured. **All four predicted before the run and matched.** Counted with an anchored
  `^\s*it\(` (19); the file's twelve loops were each checked for POSITION — two sit in `beforeEach`,
  seven inside `it()` bodies, three are `.map` inside assertions — so **none wraps a case** and 19
  is exact rather than 19 × anything.
  ⚠ **THE COUNT MOVED 18 → 19 MID-BUILD BECAUSE A DEFECT SHIPPED PAST EVERY TEST IN THE FILE AND
  WAS CAUGHT BY RUNNING THE SCRIPT AND READING THE REDIRECTED FILE.** dotenv v17 prints a tip line
  to **STDOUT**, and `server/db.js` loads dotenv as well as the script does — so a real run put TWO
  dotenv lines ABOVE the CSV header, and the operator's `preview.csv` would have opened with two
  junk rows. **No assertion about `toCsv()` could have seen it**: the pollution happens in the
  PROCESS, before `main()`, from a module neither file wrote. That is *"a test that injects the
  value itself cannot discover that nothing upstream supplies it"* with the boundary being a
  PROCESS rather than a query, and the repair is a fence that spawns the real script and requires
  STDOUT to be **empty** when no CSV is produced — with a stderr assertion as its paired positive,
  because an empty stdout is also what a crashed-on-import process produces.
  ⚠ **A GUARD-PROOF FOUND A VACUOUS CASE BY REFUSING TO GO RED ON THE CASE IT WAS NAMED FOR, AND
  THAT IS THE ENTRY WORTH KEEPING.** The loop-threading injection — removing the simulated
  assignment row from the per-request loop — took two OTHER cases red and left **the
  loop-threading case itself GREEN**. Cause: the preview's recording `writeSticky` carries its own
  `if (after.sticky_rep_id == null)` guard, mirroring production's `WHERE sticky_rep_id IS NULL`, so
  existing-wins was being enforced on the WRITE side whether or not the READ was threaded. **The
  case asserted a property two mechanisms provided and measured neither.** Repaired by asserting
  what only the read seam decides: with the row threaded the engine's step 3 returns, and without it
  iteration 2 proceeds into the gate and raises a **co-assignment flag production would never
  raise** — a spurious item in the admin queue on a client whose rep never moved. That required a
  new `would_flag` column, because a flag on a client that keeps its rep does not change its group
  and was therefore invisible in the output.
  ⚠ **AND A SECOND VACUITY IN THE SAME FILE, MASKED BY A DIFFERENT MECHANISM.** *"WRITES NOTHING"*
  passed even with the preview driving the REAL writers, because its only fixture already had a
  sticky and `writeSticky`'s `WHERE sticky_rep_id IS NULL` made the write a no-op. **The test was
  protected by existing-wins, not by write-freedom** — a defect masked by a defect, the shape this
  file already records from the Wave 1.1-c harness. A second client with no assignment row was
  added, which a real write INSERTS; the injection then takes it red.
  ⚠ **TWO OF NINE INJECTIONS WERE INVALID ON FIRST WRITING AND WERE REPAIRED RATHER THAN READ.**
  A tenancy injection written as `WHERE $1 IS NOT NULL` left `$1`'s type undeterminable, so Postgres
  refused the statement and **12 of 18 cases went red** — the SQL-breaking shape this file records
  twice, not a result. Recast as `WHERE contractor_id IS NOT NULL AND $1::text IS NOT NULL` it reds
  **exactly 1**. And a Jobber-call injection that threw aborted every client and reported 12 red;
  wrapped in a `try/catch` so the counter could be observed instead of the crash, it reds **2**.
  ⚠ **AND THE HARNESS ITSELF SILENTLY DEGRADED ONE INJECTION INTO ANOTHER.** Applying three patches
  to ONE file, each computed from the file's ORIGINAL contents, means only the LAST survives — so
  the combined "real writers AND permissive proxy" injection became the permissive-proxy injection
  alone and reported an identical, plausible, invalid result. Fixed by re-reading from disk per
  patch and unwinding in reverse. **A harness bug that produces a plausible number is the failure
  class, not an inconvenience.**
  ⚠ **EVERY REVERT WAS AN INVERSE PATCH IN A `finally`, PROVEN BYTE-IDENTICAL BY sha256** — never a
  `git checkout`, per this file's own record of what that costs on an uncommitted commit.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE COMMIT 7 REBUILD-SAFETY COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1938 → 1951 is **+13**, all in the EXISTING `repAssignmentRebuild.test.js`, which went
  10 cases → 23; suites 317 → 319 is its **two NEW top-level describes** (the R5k guard, and the
  writer marker) — the pre-existing describe grew without adding a suite. React did not move —
  no `src/` file touched — and was re-measured. **All four predicted before the run and matched.**
  Counted with an anchored `^\s*it\(`; all four `for` loops sit in `beforeEach` or inside an
  `it()` body and wrap no case.
  ⚠ **THE GATE WAS RUN TWICE AND THE SECOND RUN IS THE ONE CITED, BECAUSE TWO COMMENT-ONLY EDITS
  LANDED WHILE THE FIRST WAS RUNNING.** A comment cannot change a count — and *"it cannot have
  changed"* is a prediction, not a measurement, which is the whole subject of this block. Both
  runs read `EXIT=0` and the same seven numbers.
  ⚠ **A BACKTICK INSIDE A COMMENT INSIDE A TEMPLATE LITERAL CLOSED THE STRING, COMMITTED BY THE
  SESSION THAT HAD READ THE RULE FORBIDDING IT** — the second recorded instance, after the
  correction-path commit. It surfaced as `SyntaxError: missing ) after argument list` with
  `tests 1 · suites 0`, which is the LOUD variant and the module-load signature this file names.
  Reworded, not escaped. **Knowing the rule is not the mechanism; the `suites 0` reading is.**
  ⚠ **AND A GUARD-PROOF FOUND A VACUOUS CASE IN THIS COMMIT'S OWN NEW TESTS, WHICH IS WHY THE
  COUNT MOVED 22 → 23 MID-BUILD.** Injection (a) — restoring the pre-Commit-7 predicates — took
  the >50 kept-rows case red and left its under-50 sibling GREEN. Cause: the kept LIST is built
  by its own predicate, so it went on reporting three spared rows **correctly** while all three
  were being cleared underneath it. **A report about rows that no longer exist reads exactly like
  a report about rows that were spared**, and only the sibling's survival assertion could tell
  them apart. Repaired by asserting survival; (a) now reds 8 rather than 7.
  ⚠ **FIVE INJECTIONS, AND THE TWO THAT PROVE THE GUARD IS THE RIGHT GUARD ARE THE NARROW ONES.**
  (a) the pre-Commit-7 predicates → **8** red; (b) the unconditional `written_by` rewrite → **2**;
  (c) `recreatable` widened to "any fact table" → **exactly 1**, the quote-facts-only client;
  (f) `recreatable` with the mapped-user half dropped → **exactly 1**, the unmapped-user client;
  (e′) `recreatable` always false → **6**, including both paired positives. **A one-case red from
  a one-line change is the result; an eight-case red is only a result when the injection is meant
  to be that wide.** Every injection binds `$2` deliberately — deleting the clause instead would
  leave the parameter unused and Postgres would refuse the statement, which breaks the SQL rather
  than reintroducing the defect, and this file already records that shape twice.
  ⚠ **AND THE HARNESS LEFT A FILE INJECTED ONCE, FOR A REASON THAT HAD NOTHING TO DO WITH THE
  INJECTION.** A test name containing `✖` crashed the Python printer on a cp1252 console
  **before** the revert ran. The revert is in a `finally` now and output is ASCII-folded. **An
  injection harness must revert on the failure path, or its own crash is a source edit**; every
  revert here was an inverse patch proven byte-identical by sha256, never a `git checkout`.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 6c RESET-COVERAGE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1932 → 1938 is **+6**, one new file (`testResetCoverage.test.js`); suites 316 → 317 is
  that file's single describe. React did not move — no `src/` file touched — and was re-measured.
  **All four predicted before the run and matched.** Counted with an anchored `^\s*it\(`; every
  `for` in the new file sits inside a helper body and wraps no case, so 6 is exact.
  ⚠ **FOUR NEW TABLES IN ONE ARC WERE LEFT OUT OF A RESET LIST, AND EVERY ONE WAS FOUND BY A TEST
  FAILING ODDLY RATHER THAN BY A CHECK.** A leaked row reads as a successful write by the case that
  follows, which is the vacuity family wearing a fixture. The fence derives every table from
  `db.js` and fails naming `file: table` when a suite touches a table its reset does not clear.
  ⚠ **THE CONTEXT IS THE COMPLEMENT OF `before()`/`after()`, NOT THE INSIDE OF `it()`, AND THAT
  IS THE ENTRY WORTH KEEPING.** The first draft scanned inside `it()` blocks — and **it would have
  missed 6b's own defect**, because that read lives in a file-level helper (`failureCount`) that
  tests CALL. A table seeded only in `before()` is the suite's baseline fixture and is deliberately
  outside the per-test reset, so excluding those two hooks is what separates a real leak from a
  legitimate fixture; it cut the findings from 148 to 29 without losing the defect.
  ⚠ **AND CASCADES HAD TO BE RESOLVED OR THE FENCE LIES.** `dynamic_audience_members` cascades
  from `dynamic_audiences`, so a suite clearing the parent HAS cleared the child — `db.js` carries
  25 such FKs, and without the closure the fence reports confident false positives.
  ⚠ **THREE BROADER RULES WERE MEASURED AND REJECTED, WHICH IS WHY THIS ONE IS NARROW.** "Tables
  one production module writes together must be cleared together" gives **3165** findings across 97
  of 104 suites, because `referrer.js` alone writes 23 tables and the group stops meaning one unit
  of work; capping the group size still leaves 168 at a cap of 2. **A heuristic that reports
  plausible findings is worse than none**, so the require-closure form was never shipped.
  ⚠ **AND THE TOOL REPRODUCED THIS FILE'S OWN `\bFROM\b`-IN-A-COMMENT DEFECT.** The first draft
  read `db.js` WITHOUT stripping comments, so the prose *"ALTER TABLE is required"* invented a table
  named **`is`**, which then matched inside ordinary SQL. Comments are stripped from every input
  now, and the fence asserts the junk words are absent as well as that real tables are present.
  ⚠ **CONSOLIDATION TO ONE SHARED RESET WAS MEASURED AND REPORTED RATHER THAN DONE:** 104 of 136
  suites carry a reset, in **70 distinct table sets** that are **divergent, not nested** (3741
  divergent pairs against 1615 nested), and the union is 56 tables against a widest single reset of
  21. One list would therefore clear tables many suites deliberately leave seeded in `before()`.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE 6b SWEEP-HOLD COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1923 → 1932 is **+9 = 4 + 2 + 3**: four appended to the EXISTING sweep describe in
  `requestAttribution.test.js`, two appended to an existing describe in `clientLock.test.js`, and
  three in a NEW describe in `captureFetchContract.test.js`. Suites 315 → 316 is that one new
  describe. React did not move and was re-measured. **All four predicted and matched.**
  ⚠ **A RETURNED FAILURE IS NOT A THROWN ONE, AND THAT GAP LOST REQUESTS SILENTLY.**
  `attributeFromRequest` RETURNS `'capture_failed'`, so `repRequestSweep`'s try/catch — which only
  aborts on a throw — counted it as swept, carried on, and advanced the watermark past it. A LOCK
  TIMEOUT, transient by definition, therefore lost that request's attribution permanently: only a
  later REQUEST_UPDATE would ever attribute it. **An existing catch does not cover an outcome that
  is returned rather than raised**, and the test that covered the throwing case could not see it.
  ⚠ **AND THE HOLD NEEDED A CAP IN THE SAME COMMIT, OR IT WOULD HAVE BEEN A WORSE BUG.** One
  permanently broken request holding the watermark forever starves every later request in the
  window. Three CONSECUTIVE failures, counted in a durable table because the process restarts on
  every deploy and an in-memory counter would reset before reaching the cap — a cap that cannot be
  reached is a mechanism reporting health it never observed.
  ⚠ **POOL SAFETY RESTING ON A FLAG IS NOT POOL SAFETY.** `withClientLock`'s rollback path awaited
  `logError` while the pooled connection was still held, and `logError` can send a Resend alert with
  two retries. It was safe ONLY because that call passed `alert: false`. The log is now deferred
  until after `tx.release()`, so one edit to a flag can no longer hold a connection across an
  outbound HTTP call.
  ⚠ **AND AN OPTIONAL ARGUMENT WITH A DEFAULT IS INVISIBLE TO EVERY TEST.** Commit 5 added the
  cost-log `meta` and its own comment said the door is what makes the line useful — then never
  passed it from five call sites. Production logged `door=fetchClientRelatedData contractor=-` and
  the suite was green. **Only a call-site sweep can see a missing optional argument**, which is what
  the new fence does; it names the file and line, proven by dropping one site.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CRON-LOCK-OWNER COMMIT ITSELF, AND IT COVERS THE PAIR.*
  Server 1911 → 1923 is **+12 = 2 + 1 + 9** across TWO commits that ship tests — 7a-2's two
  truncation cases in `attributionEngine.test.js` and one stored-column case in
  `captureThenDecide.test.js`, plus 7a-3's nine in a new file (`cronLockOwner.test.js`). Suites
  313 → 315 is that new file's **two** describes only; 7a-2's three cases landed in describes that
  already existed. React did not move and was re-measured. **All four predicted and matched.**
  ⚠ **THE FIGURE IS TRUE AT THE SECOND OF THE TWO, NOT AT EITHER ALONE**, which is why 7a-2's own
  message says the counts are re-armed here. Naming the revision at which the figure is true is the
  rule; with two test-shipping commits in one turn that revision is the later one.
  ⚠ **A CRON LOCK THAT RELEASED BY NAME ALONE WAS WORSE THAN NO LOCK, AND THE ARITHMETIC IS THE
  POINT.** `pipeline_sync` held a 10-minute expiry against a 30-minute tick, so a sweep still
  running at T+10 had a takeable lock; the T+30 tick started a SECOND sweep, and the first then
  cleared the row — releasing the lock the second was holding, so a third could join at T+60.
  Fixed in both halves: the expiry is 25 minutes (under the tick, so a crashed holder self-heals on
  the very next tick) and the release is scoped `AND locked_by = $2` with a per-run random token.
  `locked_by` had existed on `cron_job_locks` since the table was created and was never written.
  ⚠ **AND THE EXPIRY IS NOT DERIVED FROM A MEASURED SWEEP, BECAUSE NO HEALTHY SWEEP EXISTS IN THE
  LOGS.** Every run in the retained Railway window aborts on a Jobber 401 in under 1.3s — twenty of
  them — so the observed durations measure a failing sweep. The worst case is structural: a
  catch-up sweep after an outage is unbounded in principle. **The owner check is the load-bearing
  half; the number only reduces how often a takeover happens.**
  ⚠ **AND AN OVERRUN NOW WRITES AN error_log ROW**, because a correct behaviour nobody can see is
  how a 10-minute expiry survived on a 30-minute tick in the first place.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE REQUEST-CAPTURE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1903 → 1911 is **+8 = 4 + 2 + 2**: four in a NEW describe in `captureFetchContract.test.js`
  (three structural fences and one end-to-end), two appended to an existing describe in
  `captureThenDecide.test.js`, and two from the mechanical reads-vs-selects fence gaining its
  FOURTH writer over two selections. Suites 312 → 313 is that one new describe. React did not move
  and was re-measured. **All four predicted before the run and matched.**
  ⚠ **AND THE DEFECT IT CLOSES IS THE ONE THIS FILE KEEPS RECORDING: a writer reading a field no
  query selects.** `fetchFullClient`'s BASE_QUERY had no `requests` connection, so
  `captureClientFacts` read `undefined`, normalised it to `[]`, and `writeRequestFacts` wrote ZERO
  rows while reporting success — on the ONE door whose subject is a request. Live since Commit 5.
  ⚠ **MY FIRST TWO GUARD-PROOFS FOR IT CAME BACK GREEN, AND THE REASON IS ALREADY WRITTEN DOWN
  HERE.** Deleting the whole `requests` connection from BASE_QUERY changed nothing, because the
  behavioural test STUBS `fetchFullClient` — *"a test that injects the value itself cannot
  discover that nothing upstream supplies it"*, reproduced by the commit closing an instance of
  it. `captureFetchContract`'s harness returns its fixture regardless of the query (it does not
  project onto the selection, unlike the import harness fixed in 3a-2/3b), so the reads are fenced
  STRUCTURALLY instead: BASE_QUERY must contain the connection, and REQUEST_FIELDS must carry the
  assessment's `assignedUsers`.
  ⚠ **THE MECHANICAL FENCE DID NOT SEE THE assignedUsers CASE EITHER, AND THE REASON IS ITS DEPTH.**
  `writeRequestFacts` reads `n.assessment?.assignedUsers?.nodes[].id` — doubly nested — and the
  reads-vs-selects derivation extracts top-level and single-nested fields only. It caught the
  `client { id }` case and not this one, so the depth limit is now fenced explicitly rather than
  assumed away.
  ⚠ **AND A GUARD-PROOF INJECTOR THAT REPLACED WITH AN EMPTY STRING COULD NOT UNDO ITSELF.**
  `s.count('')` is 25,981, so the revert's assert fired and the file was LEFT INJECTED — caught
  only by the sha256 check afterwards. **Never revert by replacing with ''; use a marker.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE LOCK-TIMEOUT COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1901 → 1903 is **+2**, both appended to an EXISTING describe in `clientLock.test.js`, so
  **suites hold at 312** — the expected shape when a file grows rather than a file arriving. React
  did not move and was re-measured. **All four predicted before the run and matched.**
  ⚠ **AND THE KEY GUARD-PROOFS WERE RE-RUN IN A STRICTLY BETTER FORM, ON DANNY'S INSTRUCTION.**
  The previous entry's (ii) and (iii) rewrote the lock's SQL to a one-parameter call: the
  behavioural case did red, but so did the source fence, because the fence pins the exact two-key
  text. Re-run by corrupting only the BOUND VALUES — contractor bound to both arguments, then
  client bound to both — the SQL text is byte-identical to production, the source fence stays
  GREEN, and each injection reds exactly its own behavioural case. **An injection that also trips
  a text fence is reporting two things at once; one of them is not evidence about the behaviour.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PER-CLIENT-LOCK COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1892 → 1901 is **+9**, one new file (`clientLock.test.js`); suites 309 → 312 is that
  file's **three** top-level describes. React did not move — no `src/` file was touched — and was
  re-measured. **All four predicted before the run and matched.** Counted with an anchored
  `^\s*it\(`; every `for` sits in a hook or an `it()` body and wraps no case.
  ⚠ **A LOCK CANNOT BE TESTED BY CALLING THE LOCKED FUNCTION ONCE, AND THAT IS WHY THIS FILE
  USES REAL CONCURRENCY.** A single caller is serialised by definition, so every assertion would
  pass against no lock at all. Two of the cases assert on ELAPSED TIME, each PAIRED with its
  opposite on the same machinery — same client must take over 550ms, different clients under 500 —
  because "different clients never wait" has no observable other than the ordering itself.
  ⚠ **AND THE FIRST WRITING OF THE CENTRAL CASE TESTED SOMETHING POSTGRES ALREADY GUARANTEES.**
  It ran two identical capture-then-decide units concurrently and asserted neither read a partial
  fact set — and removing the lock left it GREEN, for two reasons that are both about Postgres:
  the units INSERTed the same keys so the unique index already serialised them, and **a
  transaction never exposes a half-written capture anyway** under READ COMMITTED.
  **The anomaly the lock actually prevents is a LOST UPDATE, not a dirty read**: a slow unit
  decides from the facts as they were, a fast unit then captures a new job and commits 'sold', and
  the slow unit finally writes the 'inspection' it computed earlier on top of it. Rewritten around
  that, the injection takes it red. **A guard-proof that will not fire is a finding about the
  test, not a formality.**
  ⚠ **AND TWO KEY INJECTIONS BROKE THE QUERY INSTEAD OF THE KEY, TAKING 8 OF 9 CASES RED.**
  Dropping one component from `pg_advisory_xact_lock(hashtext($1), hashtext($2))` while still
  binding two parameters made Postgres refuse it outright — *"bind message supplies 2 parameters,
  but prepared statement requires 1"*. **8 red from a one-line change is a tell, not a result**,
  and it is the same invalid-injection shape recorded in 4c. Repaired to bind only what the SQL
  uses; each then takes exactly its own case red.
  ⚠ **THE HOLD TIME IS MEASURED, NOT ESTIMATED** — median 9.3ms, max 15.4ms over 7 runs for a
  full page of every connection, recorded at the constant with the caveat that Railway is slower
  because app and Postgres are separate services.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CAPTURE-THEN-DECIDE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1874 → 1892 is **+18 = 16 + 2**: sixteen in one new file (`captureThenDecide.test.js`)
  and **two in an EXISTING describe** in `captureFetchContract.test.js`, where the mechanical
  reads-vs-selects fence gained a fourth writer over its two selections. Suites 307 → 309 is the
  new file's **two** top-level describes only. React did not move — no `src/` file was touched —
  and was re-measured rather than carried. **All four predicted before the run and matched.**
  ⚠ **THE FENCE THAT WAS SUPPOSED TO CATCH THIS ARC'S RECURRING DEFECT COVERED TWO WRITERS OUT
  OF FOUR, AND ITS GREEN WAS EVIDENCE ABOUT THOSE TWO.** `writeQuoteFacts` keys its row on
  `n.client.id` and **neither capture query selected `client` on a quote** — so a live capture
  filtered out every quote and reported success having written nothing. Invisible because the only
  writer of quote facts had been the IMPORT, whose own query does select it. The same hole existed
  on `requests`. Both columns added, and the fence widened, because fixing the columns alone would
  leave the next missing column to ship identically. **A mechanism reporting health it never
  observed, inside the mechanism built to stop exactly that.**
  ⚠ **SEVEN GUARD-PROOFS, AND FOUR OF THEM WERE INVALID ON THEIR FIRST WRITING — EVERY ONE
  READING GREEN.** Each was a plausible edit that did not reintroduce the defect: (i) inserted a
  throwaway decide above the capture and left the real one below; (vi) targeted paging that the
  file under test never exercises; (vii) failed three separate times — it guarded one property
  access so the code THREW instead of misbehaving, then hit the CAPTURE gate instead of the TAG
  gate (Commit 5 gave `upsertAndTagClient` two `if (relatedData)` blocks), then finally fired once
  the test got a timing control. **A green result from the wrong injection is indistinguishable
  from a fence that does not fire, and it is the more flattering reading.**
  ⚠ **AND TWO OF THIS COMMIT'S OWN NEW CASES WERE VACUOUS, BOTH FOUND BY A GUARD-PROOF REFUSING
  TO GO RED.** The PARITY case handed the door the same data it had captured, so deciding from the
  live object and from the facts gave one answer — repaired so the two sources DISAGREE. And the
  failed-fetch case waited on an observable that precedes the code under test, twice: first an
  `error_log` row the FETCH writes, then `last_synced_at` which the UPSERT bumps. **An absence
  assertion needs a timing control, and its paired positive is what supplies one.**
  ⚠ **AND A `git checkout` IS STILL NOT HOW A GUARD-PROOF IS REVERTED** — see the previous entry.
  Every revert here was an inverse patch, each verified byte-identical by sha256.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAID-CLIENT-AUDIENCE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  **BOTH HALVES MOVED, EACH BY ONE NEW FILE.** Server 1862 → 1874 is **+12**, one new file
  (`payingClientAudience.test.js`); suites 305 → 307 is that file's **two** top-level describes.
  React 1353 → 1358 is **+5** in one new file (`bareTagGroup.test.jsx`), and 81 → 82 is that file.
  **All four predicted before the run and matched.**
  ⚠ **COUNTED WITH AN ANCHORED NEEDLE THIS TIME — `grep -cE "^\s*it\("` — BECAUSE THE PREVIOUS
  COMMIT RECORDED A BARE `it(` MATCHING `split(`.** Every `for` in both files was checked for
  position: they sit inside `beforeEach` hooks, inside `it()` bodies, or inside the `walk` helper,
  so none wraps a case and 12 and 5 are exact.
  ⚠ **NO PHANTOM.** The new React file is a `.test.` file in `src/constants`, a walked root, and
  `adminBranding.test.jsx`'s walker skips `.test.` files; the only other `src/` edits are to
  files that already existed.
  ⚠ **THE NEW SERVER FILE'S FIRST RUN REPORTED `pass 8 · fail 0 · cancelled 4`, WHICH IS THE
  EXACT SHAPE THIS FILE WARNS ABOUT AND IT STILL HAPPENED.** Two describes each carried their own
  `before`/`after`; `initTestDb()` returns the `server/db.js` pool SINGLETON, so the first suite's
  teardown ended the pool the second was about to use and its four cases were CANCELLED during
  setup — **an entire describe that never ran, under a `fail 0` summary.** The lifecycle is now
  file-level, with the reason recorded in the file. **One pool per test FILE is not a style
  preference; reading only `pass` and `fail` would have called this green.**
  ⚠ **AND TWO GUARD-PROOF INJECTIONS WERE INVALID AND WERE DISCARDED RATHER THAN READ.** Pasting
  the new bare predicate over the PREFIXED query took **all 8** summary cases red — it breaks the
  SQL (`POSITION` returns 0 for a tag with no colon, so the `SUBSTRING` length goes negative)
  rather than reintroducing a defect. **8 red from a one-line change is a tell, not a result.** An
  untyped `$1` in the tenancy injection failed the same way. Both were replaced with injections
  that reintroduce the actual defect and take **1** and **2** red respectively.
  ⚠ **AND ONE INJECTION FAILED TO LAND WHILE THE SUITE REPORTED 12/12 GREEN** — which reads
  exactly like a fence that does not fire. The only tell was the patch script's `AssertionError`
  printed above the green count. **Confirm the injection landed before believing the result.**
  ⚠ **A `git checkout` OF A FILE WITH UNCOMMITTED WORK DISCARDED THAT WORK, NOT THE INJECTION.**
  Reverting a guard-proof with `git checkout <file>` restores HEAD, which on an uncommitted commit
  is *the previous commit's* content — the whole 4c edit to that file went with it. Recovered by
  reapplying and **proven byte-identical by sha256**, which is the only reason it is recorded as a
  detour rather than as data loss. **Revert a guard-proof with its inverse patch, never with git.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE PAYING-CLIENT RECOMPUTE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  **BOTH HALVES MOVED, AND BOTH BY ONE WHOLE NEW FILE.** Server 1852 → 1862 is **+10**, the `it(`
  lines of one new file (`payingClientRecompute.test.js`); suites 304 → 305 is that file's single
  describe. React 1342 → 1353 is **+11** in one new file (`tagLabels.test.jsx`), and 80 → 81 is that
  file. **All four predicted before the run and matched.**
  ⚠ **NO PHANTOM, AND THE WALKER'S EXCLUSION WAS READ RATHER THAN REMEMBERED.** The new React file
  sits in `src/constants`, which IS one of the four roots `adminBranding.test.jsx` walks — but its
  walker carries `if (/\.test\.(js|jsx|mjs)$/.test(entry.name)) continue;`, confirmed at that line,
  so a new TEST file adds nothing there. The only non-test `src/` files this commit touches already
  existed, so the arithmetic closes at exactly 11.
  ⚠ **AND `grep -c "it("` REPORTED 14 FOR AN 11-CASE FILE, WHICH IS THE SUBSTRING TRAP IN THE
  COUNTING TOOL ITSELF.** Three matches were `split(` — *spl-it(*. The runner said 11 and the
  anchored count agrees; **the bare needle was wrong in the direction that is dangerous**, since a
  prediction three too HIGH reads as a suite that partly failed to register. Anchor the count on
  `^\s*it\(`, and this is why the prediction is COUNTED and then checked against the runner rather
  than trusted from either alone.
  ⚠ **A GUARD-PROOF FOUND TWO VACUOUS CASES IN MY OWN NEW FILE, AND THE PREDICTION IS WHAT EXPOSED
  THEM.** Restoring upsert-only was predicted to take **6** red and took **4**. The two that stayed
  green — the exact-removal case and the tenancy case — both asserted `paying_client` was ABSENT
  after a derivation that had **never added it**, so each was satisfied by a tag that had never
  existed. Both now derive a paid invoice first and ASSERT the precondition; the proof then took
  exactly 6. **A negative case whose precondition was never established is CLAUDE.md's shape #9
  wearing a fixture, and the only thing that surfaced it was a red count that disagreed with the
  prediction by two.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE ONE-DEFINITION-OF-PAID COMMIT ITSELF, BECAUSE IT SHIPS TESTS.*
  Server 1842 → 1852 is **+10 = 7 + 2 + 1**: seven in a new file (`oneDefinitionOfPaid.test.js`),
  two appended to an EXISTING describe in `referralRules.test.js`, and one appended to an EXISTING
  describe in `captureFetchContract.test.js`. Suites 302 → 304 is **the new file's TWO describes
  only** — the other three cases landed inside describes that already existed. React did not move
  and was re-measured. **All four predicted before the run and matched.**
  ⚠ **"PAID" IS NOW ONE HELPER — `server/utils/invoicePaid.js` — AND IT LIVES IN ITS OWN MODULE
  FOR A STRUCTURAL REASON.** `classifyPipelineStatus` needs it and lives in `crm/pipelineSync.js`,
  which `attributionDecide.js` imports; putting the helper in either file makes a require cycle.
  ⚠ **TWENTY-TWO EXISTING TESTS WENT RED, AND EVERY ONE WAS A FIXTURE ENCODING THE OLD RULE** —
  `invoiceStatus: 'paid'` with no `invoiceBalance`. Repaired by adding `invoiceBalance: 0` ONLY
  where it was absent, so the cases that deliberately set a NON-ZERO balance keep the distinction
  they exist to test.
  ⚠ **AND A FIXTURE OF MINE GOT THE SHAPE WRONG THREE TIMES RUNNING, WHICH IS THE ENTRY WORTH
  KEEPING.** `deriveAndSaveTags` takes the FLATTENED shape (`jobs` and `job.invoices` as plain
  arrays) while `classifyPipelineStatus` takes the CONNECTION shape — CLAUDE.md's vacuity shape
  #12, two consumers of one fetch needing opposite shapes. I wrote `quotes: { nodes: [] }`, then
  `invoices: { nodes: [] }`, then `jobs: { nodes: [] }`. **Each time the only symptom was the
  PAIRED POSITIVE failing with nothing in `error_log`**, because `deriveAndSaveTags` catches its
  own TypeError and logs it. A function that swallows needs a positive control; negative
  assertions alone would all have passed against tagging that never ran.
  ⚠ **AND THE TAG THE HELPER DRIVES IS `paying_client`, NOT `invoice:paid`.** `invoice:<status>`
  comes from `INVOICE_STATUS_MAP` and is a VERBATIM MIRROR of Jobber's status across all five
  values, not a paid-ness decision. Three of my case names said `invoice:paid` while asserting
  `paying_client`; renamed, because a name that misstates its own assertion is the inverted-record
  failure.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE decideFromFacts COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1842 / 302 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE decideFromFacts COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1818 → 1842 is **+24**, one new file (`attributionDecide.test.js`); suites 296 → 302 is
  that file's **six** top-level describes. React did not move — no `src/` file touched — and was
  re-measured. **All four predicted before the run and matched.** Three EXISTING suites had
  fixtures corrected (see below) and none gained a case, so they contribute 0.
  ⚠ **A GUARD-PROOF THAT FIRED ONLY AT THE UNIT LEVEL EXPOSED A VACUITY IN THE DB-LEVEL CASES,
  AND THIS IS THE ENTRY WORTH KEEPING.** Deleting `isInvoicePaid`'s status condition took only the
  unit test red; the voided and bad_debt cases through the real database stayed GREEN. Cause:
  `decideFromFacts` passed each row's RAW `invoiceStatus` into `classifyPipelineStatus`, which
  tests `=== 'paid'` itself — so **the classifier was doing the excluding and the helper's
  condition was redundant.** The cases could not tell the two apart. Fixed by marking every
  invoice the helper ACCEPTS as `invoiceStatus: 'paid'`, which states the conclusion instead of
  re-deriving it; deleting any of the three conditions now fails a database case.
  ⚠ **AND A FIXTURE SEEDING A STAGE THAT ONLY THE DISPLAY COLUMN CARRIED IS THE Q6 RULING ARRIVING
  IN THE TESTS.** Four cases across three suites seeded `jobber_clients.pipeline_stage = 'sold'`
  and nothing else; `stageFor` read that column FIRST, so the decision inherited it. With the
  column removed from the decision, those clients derive `'lead'` — which is in
  `attributionEngine`'s `GATE_EXCLUSIONS`, so the sticky gate is skipped and nothing is attributed.
  **Three went red and one did not**: a case asserting NOTHING is written passes against a skipped
  gate too, so it would have kept asserting its ruling while proving only that the gate never ran.
  The shared `setStage` helper now seeds the FACT its stage claims, which keeps every caller's
  precondition real rather than repairing the three that complained.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE INVOICE-JOBS-PAGING COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1818 / 296 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE INVOICE-JOBS-PAGING COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1809 → 1818 is **+9**, one new describe appended to `captureFetchContract.test.js`;
  suites 295 → 296 is that describe. React did not move — no `src/` file touched — and was
  re-measured. **All four predicted before the run and matched.**
  ⚠ **AN ABSENT FIELD READ AS HEALTH, AND THAT IS THE DEFECT WORTH REMEMBERING.**
  `fetchInvoiceWithJobs` selected `jobs(first: 10)` and `archivedJobs(first: 10)` with **no
  `pageInfo` on either**, so `assertInvoiceJobsComplete` could not catch a truncation:
  `hasNextPage` was `undefined`, and `undefined` is not `true`. A completeness check that reads a
  field nobody selects reports completeness it never observed.
  ⚠ **AND THE CONSEQUENCE WAS A WRONG BONUS, NOT A MISSING ONE.** `evaluateReferral`
  (`server/referralRules.js`) collects Job Type custom fields from `jobs.nodes` PLUS
  `archivedJobs.nodes` and picks a payout schedule from them — a Full Roof label selects the
  ESCALATING schedule. Dropping the job that carries that label pays on the wrong schedule, or
  returns `no_job_type_found` and pays nothing. **Silent, and money.** The regression fixture puts
  the deciding label on the **61st** archived node on purpose, past any plausible cap.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE IMPORT-FACT-CAPTURE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1809 / 295 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE IMPORT-FACT-CAPTURE COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1798 → 1809 is **+11 = 8 + 3**: eight in a new describe appended to
  `repImportScope.test.js` and three appended to an EXISTING describe in
  `captureFetchContract.test.js` (the mechanical fence gaining the import's selections). Suites
  294 → 295 is **that one new describe only**. React did not move and was re-measured.
  **All four predicted before the run and matched.**
  ⚠ **AND A TEST HARNESS THAT ANSWERS FROM A FIXED FIXTURE CANNOT SEE A MISSING SELECTION — THE
  SAME DEFECT TWICE IN TWO COMMITS, CAUGHT ONLY BY A GUARD-PROOF REFUSING TO GO RED.** In 3a-2 a
  stub gated its fixture on the WHOLE query and `JOB_FIELDS` also carried `updatedAt`, so dropping
  it from the invoice selection left 37/37 green. In 3b the import harness returned the whole
  fixture object regardless of the query, so dropping `receivedDate` from the import's invoice
  selection left **39/39 green**. Both harnesses now PROJECT the fixture to what the query
  actually selects. **A stub that cannot represent a missing field cannot test for one**, and the
  only symptom either time was an injection that produced no red.
  ⚠ **THE MECHANICAL FENCE ALSO CAUGHT THIS COMMIT'S OWN AUTHOR.** `REP_JOB_FIELDS` first kept
  `client { id createdAt }` outside the shared constant, reasoning the QUERY still selected it;
  the fence went red naming `client`, correctly — it checks the per-entity CONSTANT, because that
  is the unit a writer is fed from.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE READS-VS-SELECTS COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1798 / 294 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE READS-VS-SELECTS COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1787 → 1798 is **+11 = 7 + 4**, both appended to EXISTING files and EXISTING describes —
  seven in `captureFetchContract.test.js` (six mechanical checks plus the derivation's own
  non-vacuity case) and four in `crmJobInvoiceFacts.test.js`. **Suites hold at 294**, which is the
  expected shape: no new file and no new describe. React did not move — no `src/` file touched —
  and was re-measured. **All four predicted before the run and matched.**
  ⚠ **A HAND-MAINTAINED FENCE LIST WENT STALE AND MISSED 26 FIELDS — AND THE REAL NUMBER WAS 42.**
  `captureFetchContract`'s `REQUIRED` list named 12 fields, written from Commit 2's needs, and
  Commit 3 then added writers reading fields no query selected. Replaced with a MECHANICAL check:
  the writers' reads are derived from `factCapture.js`'s source text, the selections from the
  per-entity field constants, and any field read-but-not-selected fails. **It is not circular** —
  JavaScript property reads on one side, GraphQL selection text on the other.
  ⚠ **AND THE FIRST MEASUREMENT OF THE GAP WAS ITSELF AN UNDERCOUNT, FOR THE REASON THE FENCE NOW
  AVOIDS.** Checking a writer's reads against the WHOLE query reports `salesperson`, `total` and
  `client` as selected, because `QUOTE_FIELDS` carries a salesperson and `INVOICE_FIELDS` carries a
  total. Loose form: 26. **Per-entity form: 42.** Compare like with like, or the check flatters itself.
  ⚠ **THE WORST MISSING FIELD WAS `updatedAt`, THE INPUT TO THE STALENESS GUARD** — so the guard
  Commit 3 built and guard-proofed was INERT in production while its own unit tests stayed green.
  Those tests hand the writer a value; they cannot prove anything supplies it. The repair is an
  end-to-end case through the real query → fetch → writer path.
  ⚠ **AND THE FIRST RUN OF THAT GUARD-PROOF STAYED GREEN AT 37/37, WHICH IS THE ENTRY WORTH
  KEEPING.** Dropping `updatedAt` from the invoice selection changed nothing, because the test
  stub gated its fixture on `/\bupdatedAt\b/` against the WHOLE query — and `JOB_FIELDS` also
  contains `updatedAt`. **The identical looseness being fixed in production, reappearing inside
  the harness meant to prove the fix**, and the only tell was a guard-proof that refused to go red.
  The stub now slices the invoice selection by brace matching. **A guard-proof that will not fire
  is a finding, never a formality.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE archivedJobs COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1787 / 294 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE archivedJobs COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1781 → 1787 is **+6 = 4 + 2**: four in a new describe appended to
  `crmJobInvoiceFacts.test.js` and two appended to an EXISTING describe in
  `captureFetchContract.test.js`. Suites 293 → 294 is **that one new describe only** — the
  captureFetchContract pair landed inside a describe that already existed, so they add cases
  without adding a suite. React did not move and was re-measured. **All four predicted and matched.**
  ⚠ **COUNTED WITH `grep -c` PER FILE, BECAUSE EACH HAS A DIFFERENT MULTIPLIER.**
  `crmJobInvoiceFacts.test.js`: 31 `it(` lines, one wrapped by the 3-entry `MONEY_CASES` loop →
  30 + 3 = 33. `captureFetchContract.test.js`: 29 lines, one wrapped by a NESTED pair
  (2 queries × 12 fields) → 28 + 24 = 52. **A loop's multiplier is a property of the file, not
  of the arc.**
  ⚠ **AND THE COMMIT EXISTS BECAUSE A WRITER WAS CORRECT AND TESTED WHILE NOTHING SUPPLIED IT.**
  Commit 3's `writeInvoiceJobLinks` handled `archivedJobs` and had two passing cases for it, but
  the capture queries selected only `jobs` — so `from_archived_jobs` was STRUCTURALLY always
  false in production. Both of those cases hand the value to the writer directly, which is
  exactly why they could not see it. **The repair is a BOUNDARY test** — real query text, real
  fetch, real writer, real row — and it is the only shape that could have caught this. Same
  class as the font columns `loadContractorBranding()` never selected.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE JOB/INVOICE FACT-TABLES COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1781 / 293 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE JOB/INVOICE FACT-TABLES COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1752 → 1781 is **+29**, one new file (`crmJobInvoiceFacts.test.js`); suites 287 → 293 is
  that file's **six** top-level describes. React did not move — no `src/` file was touched — and
  was re-measured rather than carried. **All four predicted before the run and matched.**
  ⚠ **COUNTED WITH `grep -c`, AND THE ONE LOOP THAT MULTIPLIES WAS SEPARATED FROM THE TWO THAT
  DO NOT.** 27 `it(` lines; the loop over `MONEY_CASES` **WRAPS** its `it()` and emits 3, while
  the other two sit inside a `beforeEach` (iterating tables to clear) and inside an `it()` body
  (re-capturing three times). So 26 × 1 + 3 = **29**.
  ⚠ **AND A GUARD-PROOF CORRECTED A CLAIM THIS FILE'S OWN TEST COMMENT MADE — WHICH IS THE ENTRY
  WORTH KEEPING.** The money test's comment asserted that `29724.8` AND `12599.25` are both
  exactly representable in a 4-byte float and therefore non-discriminating. Injecting a `real[]`
  cast took **12599.25 red and left 29724.8 green**: the first half was right, the second was
  wrong, and only the injection said so. **The comment now records the measurement instead of the
  reasoning.** A fixture's discriminating power is a claim like any other and needs a source.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CAPTURE-FETCH-CONTRACT COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1752 / 287 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE CAPTURE-FETCH-CONTRACT COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1702 → 1752 is **+50**, one new file (`captureFetchContract.test.js`); suites 283 → 287
  is that file's **four** top-level describes. React did not move — no `src/` file was touched —
  and was re-measured rather than carried. **All four predicted before the run and matched.**
  ⚠ **COUNTED WITH `grep -c`, AND THE ONE LOOP PAIR THAT MULTIPLIES WAS SEPARATED FROM THE THREE
  THAT DO NOT.** 27 `it(` lines, of which **one sits inside a NESTED pair of `for` loops that
  WRAPS the `it()`** — the boundary fence asserts per (query × field) BY NAME — so 2 × 12 = 24
  from that line, plus 26 × 1 = **50**. The other three `for` loops sit inside `it()` bodies and
  emit nothing. **Reading "27 lines" as 27 cases would have been low by 23**, which is the
  direction that looks identical to a suite that partly failed to register.
  ⚠ **THE GATE WENT RED FIRST, AND THE FAILURE WAS A NON-VACUITY CHECK DOING EXACTLY ITS JOB.**
  `jobberSyncRepair.test.js`'s **T11b** slices `fetchFullClient`'s body and asserts it selects
  `isArchived`. This commit moved the query text OUT of the function into a module constant, so
  the slice no longer contained the query and the test failed on *"harness: the slice must
  contain the GraphQL query"* — **it failed LOUDLY on a moved target instead of slicing past the
  query and asserting nothing**, which is the precise vacuity T11c records. **The property was
  never broken** (`isArchived` is in `CLIENT_SCALARS`, verified independently before the
  re-anchor). Re-anchored on the EXPORTED query text, which is stronger — it reads the string
  that goes on the wire — plus a separate assertion that the function actually sends that
  constant, so the two halves cannot drift apart. **Guard-proofed: removing `isArchived` takes
  T11b red.** Contributes 0 to the count; it was edited, not added.
  ⚠ **AND THE HARNESS REPORTED exit 0 WHILE THE LOG'S OWN `EXIT=` LINE READ 1** — the third
  recorded instance of that disagreement. **Read the `EXIT=` written into the log, never the
  harness's summary of it.** On that red run the React step never ran at all, because the gate
  chains with `&&` — so a tail would have shown no React numbers and no reason.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE QUOTE_APPROVED ROUTE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1702 / 283 / 1342 / 80**.
  ⚠ **THE HEAD FOR THAT FIGURE WAS THE QUOTE_APPROVED ROUTE COMMIT, BECAUSE IT SHIPS TESTS.**
  Server 1696 → 1702 is **+6**, one new describe appended to the EXISTING
  `stageWebhooks.test.js`; suites 282 → 283 is that describe. React did not move — no `src/` file
  was touched — and was re-measured rather than carried. **All four predicted before the run, and
  the gate was green on its first run.**
  ⚠ **COUNTED WITH `grep -c`, AND THE FILE'S ONE LOOP WAS CHECKED FOR POSITION RATHER THAN
  COUNTED.** 17 `it(` lines, of which **one sits inside a three-entry `for` that WRAPS the
  `it()`** (the fence asserted per topic by name), so 16 × 1 + 1 × 3 = 19 for the file — and the
  delta is +6 because the loop is pre-existing and this commit added none. **Reading "17 lines" as
  17 cases would have been low by two**, which is the direction that looks identical to a suite
  that partly failed to register.
  ⚠ **AND THE GUARD-PROOF'S RED RUN IS WHY THE DEDUPE KEY'S TOPIC IS LOAD-BEARING.** Pointing the
  new route's literal at `'quote-update'` — the ACTUAL defect, a shared topic in
  `jobber_webhook_events`' key, not a different spelling of the fix — took **2** red and printed
  `[quote-update] duplicate delivery for q-1 — already claimed, skipping`: a real QUOTE_APPROVED
  swallowed under a log line calling it a duplicate. Reverted to byte-identical, re-run green.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CORRECTION-PATH COMMIT ITSELF, BECAUSE IT SHIPS TESTS.* It read **1696 / 282 / 1342 / 80**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CORRECTION-PATH COMMIT ITSELF, BECAUSE IT SHIPS TESTS.**
  Server 1683 → 1696 is **+13**, one new file (`clientAssignmentCorrection.test.js`); suites 280 →
  282 is that file's **two** top-level describes. React 1331 → 1342 is **+11 = 10 + 1 PHANTOM**, and
  files 79 → 80 is `AssignedRepCard.test.jsx`.
  ⚠ **THE PHANTOM WAS PREDICTED BEFORE THE RUN, NOT RECONCILED AFTER IT.** This commit adds
  `src/components/admin/AssignedRepCard.jsx`, and `src/components/admin` is one of the four roots
  `adminBranding.test.jsx` walks, emitting one case per swept NON-TEST file. **All four numbers
  matched the prediction.**
  ⚠ **AN UNRELATED TEST FAILED ONCE UNDER FULL-SUITE LOAD AND PASSED ALONE AND ON RE-RUN.**
  `stageWebhooks.test.js`'s *"a LATER update of the same quote is NOT swallowed"* read
  `jobber_webhook_events` **3 against 2**. The counter is tenant-scoped and the hook clears the
  table, so a THIRD delivery landed for that tenant — consistent with an earlier case's
  fire-and-forget handler completing AFTER the reset. **Recorded as an observed flake with a
  mechanism, not as fixed**, and it is not this commit's: nothing here is reachable from a webhook
  path, and the gate before these edits was green on the same code.
  ⚠ **AND A BACKTICK INSIDE A SQL COMMENT INSIDE A TEMPLATE LITERAL CLOSED THE STRING** — the exact
  defect this file's backtick rule describes, committed by the session that had read the rule. It
  surfaced as `SyntaxError: missing ) after argument list` and `tests 1 · pass 0` — the loud
  variant, caught immediately. Reworded, not escaped.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CONFIDENCE-RULE COMMIT ITSELF.* It
  read **1683 / 280 / 1331 / 79**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CONFIDENCE-RULE COMMIT ITSELF, BECAUSE IT SHIPS TESTS.** Server
  1665 → 1683 is **+18 = 8 + 10**: eight appended to the EXISTING describe in
  `attributionEngine.test.js` and ten in one new file (`repAssignmentRebuild.test.js`); suites 279 →
  280 is that file's single describe. React did not move — no `src/` file was touched — and was
  re-measured. **All four predicted before the run; green on the first gate run.**
  ⚠ **COUNTED WITH `grep -c`, AND THE NEW FILE'S TWO `for` LOOPS WERE CHECKED FOR POSITION** — both
  sit inside `beforeEach`, iterating tables and tenants, so they wrap no `it()` and 10 is exact.
  ⚠ **ONE EXISTING CASE WAS INVERTED AND CONTRIBUTES 0.** *"promote provisional when quote salesperson
  is non-attributable"* asserted the `promoted_provisional` STICKY that Danny's ruling forbids; it now
  asserts the provisional SURVIVES and no sticky is written. Rewritten in place, with the reason.
  ⚠ **A TEST FOUND A DESIGN LIMIT RATHER THAN A BUG, AND IT WAS RECORDED INSTEAD OF ENGINEERED AWAY.**
  `written_by` is one column per ROW, so a row whose last writer was the admin keeps an engine-written
  provisional the rebuild cannot reach. Harmless — the sticky wins every read — and now its own case.
  ⚠ **AND A FIXTURE USED A STATUS THE SCHEMA FORBIDS:** `flagged_assignments.status` admits only
  `open` · `resolved` · `dismissed` · `auto_resolved`, and the first draft seeded `'assigned'`. **The
  CHECK constraint caught it, which is the fence working** — the value was invented from the route's
  `action: 'assign'` rather than read from the migration.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CHAINED-GROUPING COMMIT ITSELF.* It read
  **1665 / 279 / 1331 / 79**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CHAINED-GROUPING COMMIT ITSELF, BECAUSE IT SHIPS TESTS.** Server
  1657 → 1665 is **+8 = 1 + 7**: one new case in the EXISTING grouping describe (the paired negative for
  the chained rule) and seven in a new describe for the regroup; suites 278 → 279 is that one describe.
  React did not move — the only `src/` edit is copy inside an EXISTING file — and was re-measured.
  ⚠ **THE PREDICTION WAS 7 AND THE FILE SHIPPED 8, AND THE EXTRA CASE IS THE POINT.** A guard-proof
  found a VACUOUS NEGATIVE: the "a real gap is left alone" case is decided entirely by the pre-filter
  query that selects clients with a mergeable pair, so making the per-sale condition merge
  unconditionally left the whole file GREEN. The repair adds a MIXED-GAP client — selected by the
  filter, so the per-sale condition has to decide the far sale on its own — and that injection is
  now red. **The count moved because the coverage did**, and it was re-counted from the file.
  ⚠ **AND ONE INJECTION WAS INVALID AND WAS DISCARDED RATHER THAN READ.** Widening the pre-filter to
  `WHERE true` left `$2` unused and took 7 red with *"bind message supplies 2 parameters"* — it broke
  the query rather than reintroducing a defect, which is the "a different spelling" failure with the
  sign flipped. **7 red from a 1-line injection is a tell, not a result.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE NAMES-BACKFILL COMMIT ITSELF.* It read
  **1657 / 278 / 1331 / 79**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE NAMES-BACKFILL COMMIT ITSELF, BECAUSE IT SHIPS TESTS.** Server
  1654 → 1657 is **+3**, one new describe appended to `repImportScope.test.js`; suites 277 → 278 is
  that describe. React did not move — no `src/` file was touched — and was re-measured rather than
  carried. **All four predicted before the run; green on the first gate run.**
  ⚠ **ONE OF THREE GUARD-PROOFS FOUND A VACUOUS CASE.** Dropping the import's stamp from the
  `ON CONFLICT` branch left all green: the fixture had no settings row, so only the INSERT branch
  ran — while production always has one. The fixture now seeds the row, and the injection goes red.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE FOLLOW-UPS COMMIT ITSELF.* It read
  **1654 / 277 / 1331 / 79**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE FOLLOW-UPS COMMIT ITSELF, BECAUSE IT SHIPS TESTS.** Server
  1645 → 1654 is **+9 = 6 + 3**: six in a new describe appended to `repImportScope.test.js` and three
  in one appended to `repConversions.test.js`; suites 275 → 277 is those **two** describes. React
  did not move — no `src/` file was touched — and was re-measured rather than carried. **All four
  predicted before the run, and the gate was green on its first run.**
  ⚠ **A FIXTURE LEAK WENT RED FIRST, IN THE FILE, AND IT WAS NOT THE CODE.** The window-recording case
  read an earlier case's window, because the file's reset never cleared `contractor_crm_settings` and
  LEAST correctly kept the earlier value. **The code under test was right, and it said so by failing.**
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE BACKFILL COMMIT ITSELF.* It read
  **1645 / 275 / 1331 / 79**.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE BACKFILL COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS TESTS.**
  Server 1623 → 1645 is **+22**, the `it(` lines of one new file (`repImportScope.test.js`);
  suites 269 → 275 is its **six** top-level describes. React 1329 → 1331 is **+2** appended to
  the EXISTING `AdminTeamSettings.test.jsx`, so files hold at 79. **All four were predicted
  before the run and matched.** Counted with `grep -c`; the file's `for` loops all sit inside
  `it()` bodies or helpers and wrap no case.
  ⚠ **NO PHANTOM, ASKED BEFORE THE RUN:** the only `src/` files touched are EXISTING files under
  `src/components/admin`, and `adminBranding.test.jsx` emits one case per FILE, not per edit.
  ⚠ **THE GATE WENT RED FIRST, AND IT WAS A FENCE WORKING:** `adminRouteCoverage`'s exact route
  count reported 139 against 138 — the one route this commit adds. Moved deliberately, with the
  reason beside the constant. ⚠ **And the background task reported exit 0 while the log's own
  `EXIT=` line read 1** — the second time in one day that the wrapper's status disagreed.
  ⚠ **ONE OF TEN GUARD-PROOFS FOUND A VACUOUS CASE, AND ONE INJECTION FIRST FAILED TO LAND.**
  Keeping only the first user of a co-assignment left all 22 green — the replay's flag case seeds
  its facts directly, so nothing saw the import's WRITE — and the fixture now carries two people
  on one assessment. The anchor for that same injection had first matched nothing; the script
  said so, and the run it would have produced was discarded rather than read.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE CONVERSIONS COMMIT ITSELF.* It read
  **1623 / 269 / 1329 / 79**, measured by the Canvass-stage conversions commit.
  ⚠ **THE HEAD FOR THIS FIGURE IS THE CONVERSIONS COMMIT ITSELF, BECAUSE THAT COMMIT SHIPS
  TESTS.** Server 1606 → **1623** is **+17 = 13 + 2 + 1 + 1**: the last two are fan-out
  fences added late, and **BOTH were the same defect shape in two different tables** — see below.
  Read as 13 + 2: thirteen in one new file
  (`saleGrouping.test.js`), a net +2 in the REWRITTEN `repConversions.test.js`, and **+1 for a
  fan-out fence added late** — see below. Read as 13 + 2: thirteen in one new file
  (`saleGrouping.test.js`) and a net **+2** in `repConversions.test.js`, which was REWRITTEN
  from 8 cases to 10. Suites 264 → 269 is **+5 = 3 + 2** — the new file's three top-level
  describes, plus that rewrite going from ONE describe to THREE. React 1328 → 1329 is **+1**:
  two inverted cases in `repHomeScreen.test.jsx` were replaced by three.
  ⚠ **COUNTED WITH `grep -c`, AND THE TWO `for` LOOPS WERE CHECKED FOR POSITION RATHER THAN
  COUNTED.** One is inside a `beforeEach` hook (it iterates tables to clear) and one is inside an
  `it()` body (it seeds three clients); **neither wraps an `it()`**, so 13 and 10 are exact.
  ⚠ **A WHOLE TEST FILE WAS REWRITTEN RATHER THAN PATCHED, AND THE DELTA IS THE TELL.** Ruling 1
  replaced the DEFINITION of a rep's conversion — it counted `referral_conversions` rows and now
  counts SALES — so eight case names describing a referrer chain were about a question the product
  no longer asks. **The scoping proofs were carried over deliberately** (own-book, cross-rep,
  tenancy, fan-out); dropping them while changing a definition is how a rewrite loses coverage
  nobody notices.
  ⚠ **THE GATE WENT RED FIRST, AND BOTH FAILURES WERE FENCES WORKING.** A `deepEqual` over the
  whole `stats` object caught the two new breakdown keys — **the SECOND unannounced-key catch by
  that same assertion in two phases** — and was repaired by ADDING them, never by relaxing it to
  a subset. The other was a timeframe case still seeding `referral_conversions`.
  ⚠ **AND THE `EXIT=` LINE IS WHY THE RED RUN WAS NOTICED AT ALL.** The background task reported
  **exit 0** while the log's own `EXIT=` line read **1** — the wrapper's status, not the gate's.
  **Read the EXIT= written into the log, never the harness's summary of it.**
  ⚠ **THE SECOND FAN-OUT WAS FOUND BY ASKING WHERE ELSE THE SHAPE LIVED, AND IT WAS WORSE.**
  `flagged_assignments` was joined the same way in THREE queries, and it has no uniqueness on
  (contractor_id, jobber_client_id) either — one client can carry two open co-assignment flags
  naming one rep. In the LIST that duplicates a row; **in the STATS query `COUNT(*)` counts the
  client once per flag, so CLIENTS and LOCKED inflate as well as FLAGGED** and the rep's headline
  number on Home is wrong. **The first instance was found by looking at a screen; the second by
  asking what else had the shape** — which is the cheaper of the two and is why the first one was
  filed with its general form rather than just fixed.
  ⚠ **AND THE FIRST GUARD-PROOF FOR IT PROVED NOTHING.** Swapping `EXISTS` for a correlated
  `COUNT(*) > 0` left all 73 green — correctly, since both de-duplicate. Only restoring the actual
  LEFT JOIN took it red. **An injection has to reintroduce the DEFECT, not merely a different
  spelling of the fix.**
  ⚠ **AND THE FIRST OF THE TWO CAME FROM A LIVE DEFECT FOUND IN A BROWSER, NOT BY A TEST — WHICH
  IS THE ENTRY WORTH KEEPING.** A client with TWO linked `users` rows rendered TWICE in the rep's book:
  `membership_confirmed` was a `LEFT JOIN` on a column with no uniqueness, so it emitted one row
  per match while `total` counted the client once. **No fixture had two users on one client, so
  no assertion could see it** — the seeder models the state and nothing had ever read it. **A
  boolean needs `EXISTS`; a join is for columns you SELECT.** It is the MIRROR of the Canvass-4b
  defect, where an INNER JOIN silently DROPPED rows instead.
  ⚠ **THE PREVIOUS ENTRY:** *THE HEAD FOR THIS FIGURE IS THE RULING-2 COMMIT ITSELF.* **BOTH HALVES MOVED AND NEITHER SUITE COUNT DID**, which is the expected shape here:
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

⚠ **AND THE GUARD-PROOF ITSELF HAS THIS FAILURE MODE: AN INJECTION MUST REINTRODUCE THE
DEFECT, NOT A DIFFERENT SPELLING OF THE FIX.** Measured in Canvass-stage. A fence caught a
fan-out caused by a `LEFT JOIN` on a non-unique key, repaired by computing the boolean with
`EXISTS`. The guard-proof swapped `EXISTS` for a correlated `COUNT(*) > 0` — and **all 73 cases
stayed green, correctly**, because both forms de-duplicate. Only restoring the actual join took
it red.
⚠ **A GREEN RESULT FROM THE WRONG INJECTION IS INDISTINGUISHABLE FROM A FENCE THAT DOES NOT
FIRE**, and it is the more flattering reading, so it is the one that gets believed. **Before
trusting a guard-proof, say which DEFECT the injection reintroduces** — not which line it
edits. Rewriting the fix in another correct form tests nothing but your own refactor.
⚠ **AND CONFIRM THE INJECTION LANDED.** A separate instance in the same arc: an anchor string
matched nothing, the edit was silently skipped, and the suite reported **71/71 green** — which
reads exactly like a fence that does not fire. The only tell was an `AssertionError` printed
above the green count by the patching script.

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

⚠ **AND THE SAME CLASS THROUGH A LOG FETCHER, RULED 2026-10-01 AFTER IT PRODUCED A CONFIDENT WRONG
FINDING TWICE IN ONE SESSION: `railway logs` WITH NO `--lines` OR `--since` RETURNS A SHORT RECENT
BUFFER AND EXITS. IT DOES NOT TAIL.** Measured: **35 lines** where the deployment's real history held
**1,129**. I searched that buffer for `door=invoice-paid`, found zero, and reported *"no invoice-paid
webhook arrived"* — twice, once in a written report. The full history showed **48 occurrences across 6
clients**. The window happened to contain the reassuring absence and not the evidence.
**Pass `--lines <n>` or `--since <iso>`, and remember logs are per-DEPLOYMENT** — a new deploy starts a
new stream, so a question about yesterday's code needs that deployment's id:
`railway logs <deployment-id> --service rooster-booster --lines 5000`.
⚠ **THE RULE THAT GENERALISES, AND IT IS NOT ONLY ABOUT RAILWAY: ANY ABSENCE READ FROM LOGS MUST STATE
THE WINDOW IT COVERED.** *"No invoice-paid webhook in the logs"* is not a finding; *"none in the 35-line
buffer `railway logs` returned"* is one, and it is obviously worthless, which is the point — **naming
the window is what makes a weak absence look weak.** An absence with no stated window is
indistinguishable from a search that could never have found anything.
⚠ **AND THE SECOND TRAP IN THE SAME INVESTIGATION WAS A DATABASE READ, NOT A LOG: ASK WHETHER THE TABLE
CAN HOLD THE ROW BEFORE READING A ZERO AS AN OBSERVATION.** `jobber_webhook_events` returned **0 rows
for `topic ILIKE '%INVOICE%'` across 5,379 events since 2026-09-18** — because `claimWebhookDelivery` is
called from exactly TWO sites and the invoice-paid door is not one of them. **A zero from a table that
structurally cannot hold the row is not evidence of anything.** It was checked only because the figure
looked too clean, which is the one instinct that saved it.

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

### A call-site fence is name-only unless it follows the call graph, and it must say so

`server/test/clientLock.test.js` fences the rule *"no Jobber fetch inside a per-client lock"* by
brace-matching each `withClientLock` callback and substring-matching five function names inside it.
**That is a real check and it has a precise blind spot: it sees DIRECT calls by name and nothing
else.** A Jobber call added inside a helper the callback invokes — `captureClientFacts`,
`decideFromFacts`, anything they call — is invisible to it, and the fence stays green.

⚠ **THE DANGEROUS PART IS NOT THE GAP, IT IS ASSUMING THERE ISN'T ONE.** A fence named for a
property reads as covering the property. This one covers *one shape* of the property, so both the
fence's own comment and this entry say which shape, and the closure was checked by hand rather
than inferred: today the three helpers inside a locked section contain no `axios` and call no
`logError`, and `classifyPipelineStatus` has no `await` at all. ⚠ **The REQUIRE closure DOES reach
network-capable modules** — `attributionDecide` imports `classifyPipelineStatus` from
`crm/pipelineSync`, which also houses Jobber callers — **and importing is not calling.** A fence
built on requires instead of calls would fire constantly and be switched off within a month.

⚠ **AND THE ONE IT ACTUALLY MISSED WAS NOT A JOBBER CALL AT ALL.** `withClientLock`'s own rollback
path awaited `logError` while still holding the pooled connection, and `logError` can send a Resend
alert with two retries. It was safe *only* because that call passed `alert: false` and
`errorLogger` gates the send on `alert !== false` — **pool safety resting on a flag one edit could
change.** Commit 6b releases the connection before logging so it no longer does. **No name-based
fence could have caught it: Resend is not in the list, and the list is of Jobber fetches.**
**The transferable rule: when a fence matches names, write down what it cannot see, and check the
closure by hand once rather than trusting the fence to have done it.**

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
  ⚠ **SHARPENED BY DANNY 2026-10-01, AND IT MOVES A JUDGEMENT OFF CLAUDE: BEFORE ANY PUSH THAT
  CHANGES THE DATABASE **SCHEMA** (DDL), ASK DANNY TO CLICK RUN BACKUP NOW AND **WAIT FOR HIS
  CONFIRMATION**.** Only he can click it, so "I checked and it looked safe" is not a substitute —
  **a judgement that a push is safe without a backup is his to make, not Claude's.**
  ⚠ **THE OCCASION, RECORDED BECAUSE IT WAS MY MISS RATHER THAN A HYPOTHETICAL.** Pushing Commit A
  I verified mechanically that the range contained no DDL (`db.js` untouched, no `ALTER`/`CREATE`),
  concluded no backup was needed, and pushed — **then mentioned it afterwards.** The verification was
  right and the decision was not mine to take. Danny ruled no action was needed for that push
  (`c17f8cc`) and ruled the asking mandatory from here.
  ⚠ **THE LINE ABOVE READS "migration OR DB-TOUCHING", AND THAT AMBIGUITY IS WHAT I RESOLVED IN MY
  OWN FAVOUR.** Commit A wrote new ROWS and no DDL. The test is now explicit: **DDL means ask.**
  Rows-only is not a schema change — but say so in the report, rather than deciding quietly.
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
- Jobber API version: `2026-05-12`. Do not change without verifying changelog. ⚠ **Danny keeps this pin current from Jobber's changelog; it moved from `2026-02-17` on 2026-09-25 (3d Phase 1a Commit 2-pre) after the five intervening versions were read and found ADDITIVE ONLY.** ⚠ **Jobber's changelog returns HTTP 403 to automated fetches — it must be read in a browser**, so a version bump cannot verify its own precondition unaided; ask.
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
- ⚠ **AND ROOFMILES NEVER CREATES OR EDITS A CONTRACTOR'S CRM FIELDS** — ruled by Danny 2026-09-30
  during 7c. Not a custom field, not a dropdown option, not a field's configuration. **RoofMiles
  READS the fields a contractor already has and tells them, in plain words, how to make one
  themselves.** Same principle as A36.5.a one level down: additive, never invasive.
  ⚠ **THE PROPOSAL THIS FORECLOSES IS SPECIFIC AND IT IS GENUINELY TEMPTING.** The referral
  programme needs a category field (Accent's job "Job Type") to pick a payout schedule, and a
  contractor who has none cannot earn anything until they make one. *"Just create it for them during
  onboarding"* is one mutation, removes a whole support burden, and is the obvious kindness — **and
  it is ruled out.** A field RoofMiles created is a field RoofMiles owns in their CRM, and the first
  time it collides with their own naming, or an integration they add later, the damage is in the
  system their business runs on and not in ours.
  ⚠ **WHAT IS SANCTIONED INSTEAD:** discovery lists what exists; onboarding shows the steps
  (Settings → Custom Fields → Job custom fields → Add Field, a dropdown, tick **Transferable**); and
  a contractor with no such field uses their **default schedule** rather than being blocked. The
  guardrails are read-only too — a coverage notice and an unmapped-option warning.
  ⚠ **RESIDENT BECAUSE THE PROPOSAL ARRIVES BEFORE ANY DOCUMENT IS OPEN**, exactly like the
  write-back one: a session asked to "make onboarding smoother" will suggest it on the merits and be
  right to, having never read the spec. **Meet the answer first.**
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
