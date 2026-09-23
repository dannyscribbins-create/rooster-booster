# RoofMiles — Decisions and Reasoning Record
## Canvass rep-screen arc through the attribution backfill

**Covers:** the chat session from Canvass-3.7 (request-driven attribution) through
the deactivation-as-history ruling.
**Companion to:** the Claude Code handoff doc (what was built) and
`PRE_LAUNCH_CHECKLIST.md` (what is filed).

**What this document is for.** Claude Code records what reached the repo. It does
not know the arguments that produced the rulings, the options that were rejected,
or the corrections made along the way. That is what this file holds. A future
session that has the decisions without the reasoning re-opens settled questions —
which is the specific failure this record exists to prevent.

⚠ **Do not re-open a ruling recorded here without saying why.** Several of these
were reached by rejecting a plausible alternative, and the alternative will look
attractive again to anyone who only sees the outcome.

---

# PART 1 — THE ATTRIBUTION MODEL

## 1.1 The chain determines initial ownership (A36.1)

**Ruled:** where a referral relationship leads to a rep, that rep owns the referral
from the moment the relationship exists — before any quote, request or assessment.

**The apparent conflict, and why it was not one.** The locked assignment rules say
a quote's salesperson beats a request or assessment assignment. That looked like it
contradicted referral inheritance. It does not: the two rules answer *different
questions*.

- "Who does this client belong to?" → the chain. That is ownership.
- "Among CRM signals, which is truest?" → quote over request. That is precedence.

The quote-over-request rule was written when CRM signals were the only inputs. It
was never asked whether a relationship beats a Jobber field. It applies **where the
chain does not**.

**The known consequence, accepted:** Rep B may quote, sell and run a job while Rep A
owns the client, because Rep A grew the network. This is correct under the model and
will feel wrong to Rep B. A36.3 (admin manual reassignment) is the remedy where it
is genuinely wrong. Nothing is built for it.

**Corrections recorded:** inheritance chaining was already ruled *unbounded* ("at
infinite depth down the referral chain") in a LOCKED document. And the premise "a
sticky can never be corrected later" was false — owner/admin manual reassignment is
the one designed path that supersedes it.

## 1.2 Floaters are rep-facing only (A36.4)

A person in the app with no chain leading to a rep belongs to nobody. That is
correct, not a gap.

⚠ **But this is a REP-FACING rule.** The orphan flag and its admin bell are
unchanged — an unclaimed referral is still a money question. `writeOrphanOnMiss`
keeps its true default. The general form, worth remembering: **a rule about what a
surface shows is not a rule about what the server records.**

## 1.3 The seven entry paths (A35.2)

How a client enters the system is independent of who gets credit. Credit follows the
chain; the entry path only determines how the chain is discovered. The paths, in
Danny's words:

1. Traditional: they call the office and book, and may or may not mention a referral.
2. Referred by a RoofMiles referrer; they book an inspection through the app, are
   called by the office, and added to Jobber.
3. A rep's own self-generated lead, introduced to the app by that rep.
4. Already in Jobber, not using the app.
5. Already in Jobber, then onboarded by a salesperson.
6. Already in Jobber, then onboarded by automated outreach before the assessment.
7. Already in Jobber, has bought, did not finish signup via a salesperson's link,
   then onboarded on project day by a **non-attributable** field rep.

## 1.4 RoofMiles never writes to a contractor's CRM (A36.5.a)

**Ruled as a product principle, not a technical limitation.** RoofMiles reads from
the CRM and is additive, not invasive. That is part of what makes it adoptable.

The Jobber write-back option — a note or custom field on the client, which would be
the most visible place to warn an office scheduler — is **ruled out, not deferred**.
Recorded in CLAUDE.md's Never-Break set as well as the spec, because a session
meeting only the "Jobber GraphQL is read-only" line would read it as a constraint
awaiting a good enough reason and would propose the write-back on its merits.

## 1.5 The visibility problem (A36.5)

⚠ **Attribution decides who is CREDITED; it cannot decide who is SENT.** Tom is
referred by Maria (Rep A's), calls the office, and is scheduled with Rep B before
anyone knows there was a referral. Attribution may credit Rep A correctly and the
wrong rep has still done the job. The rules cannot prevent the failure they correct.

Three channels ruled:

- **Rep-facing:** the inbound-referral notice appears on Home BOTH as a statistic
  AND in Today's Focus. A rep who does not open the app sees nothing, so a count on
  the main screen is the nudge that makes it actionable. Later attached to a push
  notification.
- **Office-facing:** the existing booking-request email is enriched with the
  referrer and the rep in the chain, plus a second notification to the same
  configured destination for referrals arriving through other channels.
- **Admin dashboard:** referrals surface as banners and notifications — a cornerstone
  element, not a side panel.

⚠ **Why notification #25 cannot serve this:** it fires on first insert of a
`pipeline_cache` row, i.e. *after* the client is in Jobber, after the office created
them, after scheduling. By then Tom has met Rep B. The booking email is the only one
that fires before the office acts. Record the timing argument explicitly — a future
session will otherwise reach for #25 as the obvious candidate.

## 1.6 The booking email: the roles were inverted

`booking_requests.submitted_by_user_id` is the person **who was referred**, not the
referrer. Being referred is how they got into the app. An earlier plan would have
shipped that identity to the office labelled "the referrer" — telling them the exact
opposite of what they need, in a message that looks correct.

**The worked case Danny specified:** Rep A has a client, Tom. Tom refers Maria via
his link or QR. Maria signs up and is immediately accredited to Tom. Later Maria
submits a booking request. The office email carries **Maria's details, Tom as the
referrer, and Rep A's name**. If no rep is attached to Tom and/or Maria, attribution
simply begins when a rep is assigned to the request — an absent rep is not an error
state.

**Two hops, not one, and they must not be collapsed:**

| Hop | Source | Reliability |
|---|---|---|
| booker → referrer | `users.invited_by_user_id` (FK, written at signup) | reliable where present |
| referrer → rep | `users.jobber_client_id` → the assignment bridge | mostly empty today |

⚠ **`pipeline_cache.referred_by` is NOT involved in this path.** It is a name string
matched `LOWER(full_name)` with `LIMIT 1` and silently disambiguates duplicate names.
That ambiguity stays live and severe on the bonus/pipeline path, where `referred_by`
genuinely is the link — and under A36.1 a chain would inherit it at every hop.
**Two different mechanisms read in English as the same relationship. Unifying them
on that basis would import the ambiguity into the path that does not have it.**

---

# PART 2 — WHAT A SALE IS

## 2.1 Sold means a job exists

Verified twice: Danny's admin panel documents it contractor-facing as "Sold — Job
approved and work is in progress · Triggered by: Job created in Jobber", and
`classifyPipelineStatus` agrees. Quote approval alone is *inspection*. A
contractor-facing doc and the classifier saying the same thing is worth noting,
because they often do not.

⚠ **The count is `IN ('sold','paid')`, never `= 'sold'`.** The stage is current, not
historical. Counting 'sold' alone would make a rep's conversions **shrink** as jobs
get paid, reading as lost work. Once sold, always converted.

## 2.2 Conversions count sales; the close rate counts clients

Danny expected ~213 from a 52% close rate on 411 clients. The card showed 286.

**Measured:** 286 sales across **184 distinct clients**. 184/411 = 45%, close to the
stated close rate. **Attribution and client-level conversion were right.** The gap
was sales-per-client, not a defect. Record this — a figure above 213 is expected.

## 2.3 Grouping: chained 20 days from the most recent job

**Ruled:** jobs created within 20 days of the *previous job* are minor add-ons or
addendums — part of the same sale. A job 21+ days later is a separate sale. An add-on
to an add-on is still the same project.

**Rejected: anchored from the first job** (the original implementation). Jobs on
days 0, 15 and 30 made *two* sales even though no gap exceeded 15 days.

**The gap distribution that decided it** (Danny's book, Year window, 286 sales):

| Gap after previous sale's last job | Sales |
|---|---|
| First sale | 147 |
| ≤ 20 days | 14 |
| 21–30 days | 33 |
| 31–45 days | 23 |
| 46–90 days | 16 |
| 91+ days | 53 |

Chained at 20 days removes 14 → **272**. (Chained 30 → 239, 45 → 216, 90 → 200.)
Danny ruled: within 20 days is an add-on; 45+ is a different job; 21–44 are separate
sales.

⚠ **A chain has no ceiling** — a client with a job every 19 days would be one sale
indefinitely. Accepted as unrealistic for a roofer. The real boundary is 2.4.

## 2.4 Completion ends a sale — the intended rule, not yet built

**Ruled:** a job created after the sale's first job has been **completed** is a new
sale, regardless of the 20 days. Danny's reasoning: everything belonging to one sale
is approved and has its job created before the first job finishes, so a job arriving
after completion is new work by definition.

⚠ **This is better than a time window** — it is the real business event rather than a
proxy, and it removes the no-ceiling problem. **Chained-20 is a PROXY for it.** Do
not mistake the window for the intended rule.

**Not built** because job completion dates are not stored. It rides with the `total`
work. ⚠ **Measure first:** concurrent jobs. If a roof and gutters are both sold and
the roof completes before the gutters job is created, this rule makes gutters a
separate sale. That may be correct or may split a project Danny would call one.

## 2.5 Cancellations: no automatic detection

Three probes, all on Accent's live account:

- `completedAt` does **not** distinguish cancelled from completed — closing stamps it
  either way.
- Jobber's workflow: a finished job enters `requires_invoicing`; creating the invoice
  moves it to `archived`. So archived-with-no-invoice *looked* like a cancellation
  signal.
- ⚠ **But a real cancelled job at Accent is left UNSCHEDULED, with a note.** It never
  reaches archived.

**Therefore: every job counts as a sale from its createdAt.** Do not build an
archived-with-no-invoice rule — real cancellations never reach it, so it would add
machinery that catches nothing. Notes are **ruled out** as a signal; nothing may
depend on free text.

**Cancellations are removed by hand** — a discreet "strike from record" action inside
a settings control on the client detail page, not broadcast on any main page. It
removes the SALE, and optionally its revenue, never the client. **Filed, not built.**
Three things it must settle: who may strike (a rep has every reason never to use a
control that lowers their own numbers); exclude-never-delete so a wrong strike is
reversible; and that it must not touch referral payouts.

## 2.6 Sale value is the contract amount

**Ruled:** a sale's value is the **contract amount** of its jobs, not the invoice
totals. An invoice after a job may be only the balance — a deposit invoiced up front
and the remainder after — so no single invoice is the sale's value.

The candidate field is the job's `total`, which is also what the $0 exclusion needs:
one field serves both. **Unverified at the pinned API version**, and it now carries
money rather than just a count.

## 2.7 Payouts: one per person referred, not per sale

**Ruled:** a referred person's FIRST sale produces ONE payout; their later sales
count as rep conversions and pay the referrer nothing further.

`UNIQUE(user_id, jobber_client_id)` on `referral_conversions` enforces this and is in
Never-Break for good reason.

⚠ **The two numbers measure different things, deliberately:** a rep's conversions
count SALES (repeats included); a referrer's payouts count PEOPLE REFERRED. No future
session should "align" them by loosening the payout constraint.

⚠ **Which safeguard does what:** pre-RoofMiles referrals are kept from producing
payouts by the one-per-person rule and the **program start date** — NOT by the
import's 12-month anchor, which affects only the rep's conversion count.

**One shared grouping setting** (`invoice_window_days`): the sale means the same
thing on both sides, so a change moving both is intended. What must not happen is it
being silent — the admin copy says so explicitly.

⚠ **Open for the payout phase:** the trigger (first job completes, paying on contract
amounts — earlier but exposed to unfinished jobs; or all jobs complete — slower and
safer); invoice-to-job linkage (the import links invoices to CLIENTS, not jobs); and
**whether a payout on contract amount may fire before the client has paid in full** —
the contractor would be paying a referrer out of money not yet received.

---

# PART 3 — WHERE THE STAGE LIVES

## 3.1 Option B: on `jobber_clients`, and read ONLY from there

**Rejected — widening `pipeline_cache`.** It means "referred clients' pipeline" and
has **23 read sites**, of which **7 treat a row's existence as proof of referral**
and **two of those are message senders** (`engagementCadence.js`,
`postJobSequence.js`). Widening it would have enrolled ~47,000 non-referred clients
into two outreach paths — the two-pipelines fence broken at the data layer, where no
review of the rep tree would ever see it.

**Rejected — compute on demand.** `classifyPipelineStatus` needs jobs, invoices and
quotes, and nothing in Postgres holds them. It would mean a Jobber round-trip per
client per render.

⚠ **Read-and-fall-back was ruled and then CORRECTED — do not reinstate it.** The
original ruling said the rep view should read `pipeline_cache` where a row exists and
fall back otherwise. That is wrong:

- **The frozen row.** Clearing "Referred by" in Jobber makes `syncSingleClient`
  return before doing anything, and nothing deletes the row — so that client's stage
  freezes forever. Read-and-fall-back would **prefer the frozen value** over the
  correct, daily-updated one. Read-order picks the wrong side of the disagreement
  rather than resolving it.
- `pipeline_status = 'app_user'` is a non-stage literal the frontend's label map does
  not cover.
- The only argument *for* the fallback was freshness, and it does not survive the
  writer list: both tables are webhook-fresh and cron-fresh.

**Read `jobber_clients` only. Nothing in the rep tree writes `pipeline_cache`.**

## 3.2 The stage is stored for every client, not only non-referred

Same frozen-row reasoning: a client whose referrer field is cleared would otherwise be
stage-less in one table and permanently stale in the other. The writers run for every
client already, so it costs nothing.

---

# PART 4 — THE IMPORT

## 4.1 One press does everything

Danny's original ruling: one import that captures who was on each job, whether or not
that person is mapped, with **mapping a rep later being what lights up their book**.
The alternative — backfilling only for already-mapped reps — fails because a
contractor will not map everyone on day one, and a rep mapped two months later would
have an empty book until someone remembered to re-run something.

## 4.2 Two scopes, separate steps

⚠ **The campaign steps were NOT modified.** Campaign tags (`request:`, `quote:`,
`job:`, `job_count:`, `recency:`) are built from the import's existing quote, request
and job sweeps, and campaign audiences are picked from those tags. Filtering those
sweeps to 12 months for rep attribution would have silently changed the tags of older
paying clients — and therefore **who receives campaigns**.

**Three separate rep steps** were added instead, with their own date filter and wider
selections, writing only the fact tables, `pipeline_stage` and `client_sales`. Cost:
about 7 minutes. Isolation was worth it.

## 4.3 The 12-month window, and why it is by activity

The bulk import defaults to the last 12 months, not all history. A contractor's book
starts when their program starts — accepted, and the Conversions info copy says so.

⚠ The window filters on **activity**, not client creation date. Filtering on client
`createdAt` would exclude repeat customers: a homeowner first entered in 2021 with a
new request last month is exactly the active client a rep should see. Accent is a
37-year-old company with many returning customers.

## 4.4 Measured production run (Accent, 2026-09-21)

| | |
|---|---|
| Rep Step 1 — requests | 67 pages, 6,656 nodes, requested 100,835 / actual 74,917 |
| Rep Step 2 — quotes | 96 pages, 9,592 nodes, 86,880 / 86,792 |
| Rep Step 3 — jobs | 62 pages, 6,110 nodes, 31,310 / 30,860 |
| Rep stages | 7,041 rep-scope clients, 162 newly staged, 148 with no client row |
| Rep sales | 2,982 clients → 5,619 sales, 1,143 re-paged in full |
| Replay | 430 clients, 0 failed |
| Whole import | 8:42 pm → 10:27 pm; the **rep steps were ~12 minutes** |

⚠ The remaining ~1.5 hours was the campaign import sweeping **full history** on
Recommended — it fetches unfiltered and trims afterwards. The result matches the UI
copy; the cost is higher than needed. Filed as an efficiency note, not a defect.

⚠ The hourly rep sweep ran mid-import, was throttled because the import held the
budget, and **held its watermark** — the never-advance-on-failure design working.
The import and the crons share one Jobber budget; nothing coordinates them.

**Account magnitudes (2026-09-21):** 47,065 clients · 36,462 requests · 36,452 quotes
· 147 Jobber users (60 activated, 87 deactivated) · ~6,600 requests/year steady since
2020.

---

# PART 5 — THE CONFIDENCE RULE

## 5.1 The defect

The sticky gate tries, in order: the most recently approved eligible quote's
salesperson (matched against **attributable** team members), then promoting an
existing provisional, then Mode A/B, then orphan.

There is no branch for "a quote exists but its author is unknown". So an eligible
quote by an **unmapped** user matches nobody and the gate walks on to Mode A, handing
the client to whoever was on the assessment — **and writes it as a sticky, which no
later mapping can correct.**

## 5.2 The ruling: downgrade, do not block

**Rejected — blocking.** Mapping is incomplete by design. Schedulers write quotes; one
of Accent's own quote authors is a Jobber user literally called "Scheduled Jobs". If
any non-member's name on a quote blocked attribution, clients a rep really worked
would go unassigned whenever the office wrote the quote.

**Ruled — keep the fall-through, write a PROVISIONAL.** A provisional is re-examined
by every later replay, so mapping that person later fixes it automatically. Same
behaviour, different confidence. The engine used its second-best signal and had been
recording the result as certain.

⚠ **Why it matters beyond one cleanup: every new contractor starts with nobody
mapped.** Without this, every one of them takes a batch of permanently-wrong stickies
on their first import. That is the launch-blocking version of the problem.

⚠ **The copy consequence, and it must not be undone:** the rep glossary's
*Provisional* entry used to say "It locks once the job reaches a stage that confirms
it." That became false — a rep would wait for something that never happens. Now: *"It
locks when your CRM confirms who closed the job — some clients stay provisional, and
they are still yours."* And **rep-facing copy must never imply "locked" means "safe"
or "definitely mine"** — the provisional population is larger now, honestly so.

## 5.3 Measured exposure

Danny's book: 411 clients, 208 locked / 203 provisional.

**403 of 411 have "shared" assessments — and it is noise.** Bailey Nabinger (170),
Kate Preiss (138), Haley Lowery (93) are schedulers; none is a team member, none is
attributable, and the engine only ever matches attributable members. The small rows
are one-offs with other salespeople, project managers and ride-alongs.

⚠ **RULE: a scheduler or office person must never be marked attributable.** Nothing in
the admin UI warns before that toggle is set; the only guard is that they must first
be marked a field rep. If a scheduler who is also a field rep were made attributable,
the replay would start on save and flag up to 170 clients at once.

**The real exposure:** 10 clients where another salesperson's approved quote exists and
Danny got the client anyway via Mode A. ⚠ Every one showed `in_grace_for_some_request
= TRUE`, so the 7-day grace window was **not** the cause for any of them — they lost
purely because their author is unmapped.

⚠ **The number that matters is 1,990:** clients with an eligible approved quote whose
salesperson is mapped to nobody, currently unassigned. **That is not damage — it is
what launch looks like.** Mapping the real salespeople turns them into real books.
Top unmapped quote salespeople: Bobby Wiggins 180, Mark Flores 179, Daniel Magdziarz
175, Maurice Poole 175, Matt Mitchell 167, Nick Gonzalez 153, Adam Cherry 151, Chase
Castellanos 148, Tony Labandero 134, Brett Chance 126, **Tom Rees 116 (DEACTIVATED)**,
Matthew Reep 103, Adam Reep 83, Vince Scribbins 43.

## 5.4 No rebuild for Danny's 10

**Ruled:** Danny is the only person in a pre-launch test instance; his 10 wrong
stickies cost nothing. What matters is that the rules are right when a real contractor
onboards. Rebuilding before fixing the rule would have rebuilt against a rule about to
change. ⚠ His 10 stay wrong until he chooses to run the rebuild — a later session must
not read them as evidence of a live defect.

---

# PART 6 — CORRECTION AND DEACTIVATION

## 6.1 What a contractor actually wants

Danny's framing, which reset this work: **a contractor wants attribution to be right
with few exceptions, and a front-end way to correct it when it is not.** They will
never see or care about internal machinery.

⚠ The `written_by` marker is **plumbing only** — no UI, no product story. An earlier
claim that "every contractor will want one" was wrong. It exists solely so a rebuild
can tell replay-written assignments from live ones.

⚠ The **rebuild is a support tool, not a feature** — operator-run, no route, no
button. A contractor never deals with it.

## 6.2 The correction path was the real gap

Before this work: a contractor could not see who a client was assigned to, and could
only change it if the client happened to be **flagged**. Danny's 10 had no front-end
fix at all.

Built: the assigned rep on the client record (with the unassigned state reading as
normal, since 1,990 clients are unassigned today), and a client-keyed reassign control
that can also clear. Clearing deletes the row and a later replay may attribute again —
deliberate, because the CRM is what says who is working a client, so clearing means
"this is wrong", not "nobody may ever hold this client".

## 6.3 Deactivation is history, not handover

⚠ **This REPLACED a bulk-reassignment design that was worked through in detail and
then rejected.** Do not rebuild it under another name.

**The reasoning:** a departed rep's clients are not a book to hand over — they are
**history that needs an owner only when something new happens.** And when it does, the
CRM already answers it: a new request or quote names whoever actually picked the client
up, and the engine follows.

**The flow:**

1. A rep is deactivated → their clients enter a historical state, marked with who had
   them.
2. Someone new works one → the CRM records it → the engine assigns them normally.
3. Nothing happens → the client stays history, which is accurate.
4. An admin may pull one out early, one at a time.

⚠ **Every hard question the handover design raised disappears:** no inherited clients
means no question of whether they count toward a new rep's stats, no marker that has to
fade, no stats-versus-list mismatch, and no reversal of a bulk move.

**Where it lives:** on the client record as a RoofMiles **tag**
(`attribution:former-rep:<Rep Name>`), searchable and filterable with existing contact
tag machinery. No separate per-rep pool — redundant once the tag exists.

⚠ **The campaign fence:** audiences match tags by name, so the separation is a reserved
prefix enforced twice — the catalogues hide it, and `evaluateAudience` fails closed, so
an audience naming an attribution tag resolves to **zero members**. Empty rather than
ignored, because dropping the tag from an AND filter would *widen* the audience.

**A locked assignment records that this person SOLD that client.** That is a true
historical fact and the conversion and payout history depends on it — it is not erased.

---

# PART 7 — THE REP SCREENS

## 7.1 Screen 8 is not a screen

The mockup inventory says so twice: it is the client detail screen with a fifth card
when that client is flagged. A rep-facing **flagged list** was never in the mockup and
would be a new product decision. The error came from the ADMIN panel having a Flagged
tab, and that shape being carried across without checking.

⚠ **The rep arc's fourth tab is NETWORK (3e), not Flagged.**

## 7.2 Today's Focus: two sections, and the partition stays on the referral record

**Ruled and then CORRECTED.** An intermediate ruling said to rank the whole book by
stage and rename the section. That was wrong, and the reframing that corrected it is
the most important thing in this section:

⚠ **RoofMiles is not another CRM.** Reps do not need it to manage and follow up with
every assigned client — Jobber is where the work is managed. RoofMiles tracks who is
assigned to them, their closing and converting stats, their referral network, their
referral potential, and makes it easier to capitalise on clients through the program.
**Its purpose is to help reps get clients into the app and into the contractor's
program.** This framing should govern every future rep-surface decision.

So the two sections are **two different jobs**, not one list split by data
availability:

- **Referral progress** — clients marked in some referrer's pipeline and attributed to
  this rep. The referral network, which is the product's point. ⚠ Its partition stays
  on whether a **referral record** exists, not on whether a stage exists.
- **Recently assigned** — who the rep should be working now, and where that sale stands.

## 7.3 Membership badges: never assert the negative

A badge when confirmed in the app; a badge when invited-but-not-signed-up (dark until
3d writes it); **nothing otherwise**. The app cannot tell "hasn't signed up" from
"signed up but we couldn't match them", so a "No" badge would sometimes be false.

⚠ **"Not in app" as a filter is exactly the negative this forbids.** 3d must resolve
whether that filter can exist at all — "it cannot" is an acceptable answer.

Same principle applied to "No referral record" on list rows: **show nothing**. Most of
a book is direct clients, and a label on every one is repeated text that says nothing
actionable. And to the referral marker: **text, not a third pill** — the row already
carries two pills and a third chip of similar shape is a collision.

## 7.4 Other rep-screen rulings

- **Home stats:** Clients · Referrals · Conversions · Revenue. Locked and Provisional
  moved to the Clients page. Flagged is a **pill on relevant rows only** — no
  explanatory language about it anywhere in the app (an FAQ and contractor training
  cover it later).
- **Info icons** on cards, with one shared copy source; the label must still be TRUE on
  its own for a rep who never taps.
- **Long-press reveal** on Conversions and Revenue only, with a caret as a discoverable
  second route — an undiscoverable gesture is one nobody uses.
- **Revenue (A34.6):** a rep WITHOUT visibility sees the locked treatment; a rep WITH
  it sees "no revenue recorded yet", **never the lock**.
- **Colleague names are not shown** on a flag — "Another rep" stands. No rep-facing
  route exposes another team member's name, attribution is commission, and an owner
  resolves it anyway.
- **Motion:** press-in is 0ms and only the settle eases — easing into a pressed state
  *is* the friction. Sections and screens animate; their contents never do, because a
  "Load more" appends 100 rows in one commit. Reduced motion is structural, not
  per-component.
- **Timeframe bar** filters the whole Clients page, not just the stats — one control on
  one screen means one thing.
- **The switcher** moved to Profile beside Sign out; it is a rare account-level action
  and does not belong on every screen.

---

# PART 8 — CORRECTIONS MADE TO CLAUDE'S OWN REASONING

Recorded because each was a confident claim that measurement overturned. The pattern
matters more than the individual cases.

| Claim | What was true |
|---|---|
| The nightly sync already shapes data the way the stage classifier expects | **Exactly backwards.** It is flattened for a different function. Passing it would have returned `'lead'` for **every client in the book** — and a test seeded with a lead passes against that |
| A failure partway through the import leaves earlier clients complete | It fetches everything into memory first and writes nothing until the end; a failure in the fetch loses everything. And partly-written clients were already the current shape |
| Read the referral stage where it exists, fall back otherwise | The frozen-row case makes the fallback prefer the *wrong* value (§3.1) |
| ~12 consumers read `pipeline_cache` | **23**, seven existence-based, two of them message senders |
| `completedAt` will distinguish cancelled from completed | It does not — closing stamps it either way |
| Every contractor will want the `written_by` marker | No contractor will ever see or care about it |
| Bulk reassignment is the answer for a departed rep | History-plus-natural-reattribution is better and removes every hard question |
| The chain vs quote precedence is a contradiction | Two rules answering different questions (§1.1) |
| Rank the whole book by stage in Today's Focus | Collapses a meaningful product distinction into a technical one (§7.2) |
| The 13 NULL `how_assigned` rows are source-less assignments | It was the query's own ROLLUP total |

⚠ **And three test-discipline lessons worth keeping:**

- **A guard-proof must reintroduce the actual defect, not a different spelling of the
  fix.** Swapping `EXISTS` for a correlated `COUNT(*) > 0` left 73 tests green because
  both de-duplicate.
- **A green suite is not proof.** A motion transition shipped green because the
  assertion checked that a string *contained* `140ms` — and the malformed string did,
  while the browser applied 0s to the property that mattered.
- **`team_members.id` is globally unique**, which has twice made a tenancy assertion
  look tested when it was not.

---

# PART 9 — OPEN ITEMS AT THE END OF THIS SESSION

**Blocking or near-term**
- Danny's 10 wrong stickies — pending a rebuild he has chosen not to run.
- The `$0`-job exclusion — held on verifying job `total` at the pinned API version.
- Completion-ends-a-sale — the intended boundary; needs completion dates and the
  concurrent-jobs measurement.
- Search on the Clients page — ruled to come **before** books get large (one rep alone
  has 3,756 requests).

**Filed phases**
- Sale value and payout grouping (the money path) — §2.6, §2.7.
- Strike-from-record — §2.5.
- The third flag reason: "an approved quote names someone other than the assigned rep" —
  exactly the shape of Danny's 10, measurable with no Jobber call.
- Multi-select bulk reassignment on the admin clients list — post-launch, and **not**
  the departure case.
- The attributable-toggle warning, and a "People on your Jobber visits" panel.
- Rep profile photos (Backblaze, 2MB).
- The unbuilt "Invoice Grouping Window" — storage ✅ editor ✅ validator ✅ delivery ❌.
- The API version upgrade — 43+ occurrences across 17+ files; retirement date for
  `2026-02-17` unknown (Jobber's docs refuse automated fetch).
- Tom Rees: deactivated with 116 clients carrying his approved quotes.
- The documentation pass — deferred since the start of Canvass; the pile is large.

**Next build tasks:** 3d (QR/link mint, Add Client, the roster with invite resending)
and 3e (the Network tab).
