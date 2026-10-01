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

## 2.1a A SALE HAPPENS AT JOB CREATION, NOT AT QUOTE APPROVAL — and this REVERSES a same-day ruling

**RULED by Danny, 2026-09-28.** A sale happens when a **JOB is created**. An approved quote with
no job is **not** a sale and is **not** 'sold'. **This confirms `classifyPipelineStatus` exactly
as it ships — no classifier change, no migration, no backfill.**

⚠ **IT IS RECORDED AS A REVERSAL RATHER THAN AS A CONFIRMATION, AND THAT IS THE POINT OF THE
ENTRY.** Earlier the same day the opposite was ruled — *"an approved quote counts as sold even
before a job exists"* — and an implementation report was commissioned against it. **Nothing was
built.** Writing this as *"the classifier was right all along"* would delete the reasoning below,
and the reasoning is the only thing that stops the approved-quote proposal returning: on the
evidence available at the time it was an entirely sensible ruling.

**Danny's three reasons, and each one is a property the classifier already has:**

1. **An approved quote can be cancelled**, or approved by mistake when several were sent. Approval
   is not a commitment; job creation is.
2. ⚠ **A REFERRAL WOULD BE ABLE TO GO SOLD → NOT SOLD ON THE REFERRER'S OWN SCREEN.** That is the
   decisive one, and it is about trust rather than accuracy. A referrer who has been told their
   person is sold, and then sees it withdrawn, reads the platform as acting in bad faith — and no
   amount of correct downstream arithmetic repairs that. **A stage a referrer can see must only
   ever move forward.** (The bonus is already gated to `complete`, so no money was ever at risk —
   the exposure is the WORD, not the amount. → Never-Break, *Frontend Rules*.)
3. **A quote becomes a job only after offline follow-through** between rep and client, so the
   quote-to-job rate is far higher than the sent-to-approved rate. The stronger signal is the one
   that survives the follow-through.

**R5j STAYS, AND IS NOT WEAKENED BY THIS.** The QUOTE_APPROVED door
(`POST /webhooks/jobber/quote-approved`, added in `75dec0c`) captures the approval into
`crm_quote_facts` **immediately** and runs the engine. The approval is therefore on record the
moment it happens — it simply does not move the stage, and **the sticky lock follows at job
creation.** ⚠ **Capture and decision are different jobs**, and the value of capturing early is
exactly that the decision, whenever it comes, has the fact already.

⚠ **THE MEASURED CONSEQUENCE, so nobody re-opens this expecting it to be large.** At Accent on
2026-09-28: **2,379** clients hold a live approved quote and **26** of those have no job. Of the
26, **23** are unassigned with unmapped quote authors (PART 10b's population, not this one) and
**3** hold a provisional for rep 5. **The population this ruling decides is three clients**, and
they lock in when their jobs are created.

→ §2.1 states the rule; §2.5 records why a cancellation is invisible to us, which is reason 1's
teeth; §2.6 and §2.7 hold the money path, which this does not touch.

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

## 2.8 Over-payment: POLICY B — the contractor absorbs it, the balance restarts at zero

**Ruled by Danny, 2026-09-29**, in answer to the payout amount audit.

**When a referrer's earnings SHRINK after they have already been paid** — a sale unwinds, an
admin corrects a figure, a Mark-as-Paid is clicked by mistake — **the CONTRACTOR ABSORBS the
shortfall and the referrer's balance restarts from ZERO.** The referrer is never asked for
money back and never carries a debt forward. To be documented in a future contractor FAQ.

**Rejected: policy A** — carrying the shortfall forward so the referrer's next earnings pay it
off. It makes a referrer work for nothing without being told, and it is indistinguishable to
them from the programme being broken.

⚠ **A DISPLAY CLAMP ALONE DOES NOT IMPLEMENT B, AND THIS IS THE WHOLE REASON THIS SECTION
EXISTS.** The referrer display ruling (below) shows a non-positive balance as a plain `$0`. That
is correct as a DISPLAY rule and it is **not** policy B. The stored arithmetic is still
`earned − cashouts`, so:

> A referrer at **−$500** who then earns **$300** computes to **−$200**, and the clamp shows them
> **$0**. Their $300 has been silently consumed by the shortfall. **That is policy A, arrived at
> by accident**, and the clamp is what hides it.

**B therefore needs a WRITE-OFF RECORD** — the contractor's absorption stored as a fact, so the
balance returns to a true zero and later earnings count normally from there. Without it the
clamp is a cosmetic layer over the policy Danny rejected.

⚠ **THE DISTINCTION IS NOT COSMETIC VS REAL — IT IS WHICH POLICY IS IN FORCE.** A reader who
sees `$0` on both screens cannot tell B from A, and neither can the referrer. The write-off is
the only thing that makes the two states different.

**Filed on `PRE_LAUNCH_CHECKLIST.md` under the MONEY PHASE launch gate, beside §2.7's payout
timing, with Danny's test account (−$500) as its first case. NOT BUILT — ruled, recorded, and
deliberately left for the money phase.**

## 2.9 Referrer display: a non-positive balance is a plain $0, with no message

**Ruled by Danny, 2026-09-29.** On **every referrer-facing screen**, a zero or negative
available balance displays as a plain **`$0`** — **no message of any kind**, and the request
control is **disabled**.

**Never** *"over-paid"*, *"overpaid"*, *"negative"*, or a minus sign, on any referrer screen.

⚠ **THE SERVER KEEPS RETURNING THE TRUE VALUE. THE CLAMP IS DISPLAY-ONLY.**
`GET /api/cashout/balance` returns the real `available`, negative included, because the ADMIN
panel has to show it and because a server that lied would make the over-payment unfindable.
**Clamping at the source would destroy the evidence the write-off mechanism needs.**

⚠ **AND THE ADMIN PANEL SHOWS THE TRUE NEGATIVE AND FLAGS IT**, which is what keeps the
referrer-side silence honest rather than concealing. An over-payment nobody can see is how it
stays unresolved.

⚠ **§2.9 IS SUPERSEDED BY §2.10 BELOW, THE SAME DAY IT WAS WRITTEN. IT IS KEPT VERBATIM RATHER
THAN REWRITTEN**, because the amendment is only legible against what it replaced — and because
the clamp it specifies SHIPPED (commits 3b/3c) and is what the next reader will find in the code.

## 2.10 AMENDMENT to §2.9 — show the TRUE balance, including a negative

**Ruled by Danny, 2026-09-29, superseding §2.9 above.**

**What §2.9 said, quoted so the change is reviewable:**

> On **every referrer-facing screen**, a zero or negative available balance displays as a plain
> **`$0`** — **no message of any kind**, and the request control is **disabled**.
> **Never** *"over-paid"*, *"overpaid"*, *"negative"*, or a minus sign, on any referrer screen.

**What now governs instead:**

- **A NEGATIVE balance DISPLAYS AS NEGATIVE**, with a **subtle** on-screen note explaining why.
  *Subtle* means not an alert, not a warning colour dominating the screen.
- **A TRUE `$0` — someone with no progress yet — displays as `$0` with NO message of any kind.**
  That was the point of the original ruling and **it stands**: never explain a zero that just
  means *"nothing yet"*.

⚠ **THE DISTINCTION IS BETWEEN A `$0` THAT MEANS NO PROGRESS AND A `$0` THAT WAS HIDING A
NEGATIVE.** The first gets silence. The second **no longer exists**, because the negative now
shows.

⚠ **THE CONSEQUENCE IS THE POINT: THE DISPLAY NOW MATCHES THE ARITHMETIC.** Under §2.9's clamp a
referrer who earned **$300** while at **−$500** saw **`$0`** and would reasonably conclude nothing
had happened — while the system applied their $300 to a debt **nobody had told them about**. With
the negative shown they see **−$200**, and the note explains it. **The clamp did not make the
situation kinder; it made it unexplainable.**

⚠ **WHAT DID NOT CHANGE.** Cash-out remains unavailable at or below `$0`, and the payout controls
stay disabled there. The SERVER still returns the true value — it always did — and the admin panel
still shows it and flags it. **Only the referrer-facing DISPLAY rule moved.**

⚠ **AND THIS AMENDMENT DOES NOT CHANGE THE POLICY, WHICH IS ALREADY DECIDED.** §2.8 ruled
**policy B** — the contractor absorbs the shortfall and the balance restarts at zero — and A is
rejected. What the money phase still owes is the **write-off record** that makes B real, not a
decision.
§2.10 changes only what the referrer is SHOWN. Until the write-off exists the stored arithmetic
still carries the shortfall, so what the amended display gives is a **truthful view of the state
the system is actually in** — which is what makes the gap between the ruling and the code
visible instead of hidden behind a `$0`.

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

# PART 10 — MODE A/B ORDERING: MOST RECENT ELIGIBLE REQUEST WINS

**RULED by Danny, 2026-09-26.** For Mode A and Mode B rep resolution, the **MOST RECENT
eligible request wins** — not the earliest.

**The ground for it, in Danny's terms:** Mode A/B sets the **provisional** rep only. The
**sticky** comes from the **quote salesperson at approval**, which is a different and stronger
signal. So the ordering question decides a value that every later replay re-examines, not a
permanent owner — and the most recent engagement is the better guess at who is working the
client now.

⚠ **THE CODE ALREADY ASSERTS THIS IN FOUR PLACES, AND NONE OF THEM WAS A RULING UNTIL NOW.**
Each is an implementation contract that had no recorded decision behind it:
- `server/utils/attributionEngine.js` — the comment above `resolveModeAMatch` stating that
  requests must already be sorted newest-first, as `fetchAttributionData`'s contract;
- the same file, inside `resolveModeAMatch` — *"most recent in-grade request with an
  assessment"* beside its `eligible[0]`;
- the same file, inside `resolveModeBMatch` — *"most recent in-grace request with a
  salesperson"* beside its `eligible[0]`;
- `server/utils/attributionReplay.js` — the header's *"NEWEST FIRST. Newest-first is
  contractual — resolveModeAMatch takes eligible[0]"*.

⚠ **NO MIGRATION AND NO CODE CHANGE IS REQUIRED.** The ruling matches what ships today, so this
entry is a record of a decision that was previously only an assumption. **That is the whole
reason it is worth writing down:** four sites agreed with each other and nothing said why, so a
future reader weighing "earliest engagement owns the client" had nothing to overrule.

⚠ **WHAT THIS DOES NOT SETTLE — the TIE-BREAK, which is a separate defect.**
`ONE_ENGINE_1a_DESIGN.md` §(ii) records that live and replay currently break ties on
`createdAt` **oppositely**: live keeps the highest `REQUESTED_AT`, the replay keeps the lowest
request id. Most-recent-wins is now ruled; which of two requests with the SAME `createdAt` wins
is not, and the design's fix (one read plus one stable re-sort) is still outstanding.
⚠ **SUPERSEDED BY PART 10a BELOW (2026-09-27). The paragraph above is kept as the record of what
was open**, not as a statement about today — it is the sentence 10a answers.

---

# PART 10a — THE TIE-BREAK: THE HIGHER NUMERIC ID INSIDE THE EncodedId WINS

**RULED by Danny, 2026-09-27, amending the tie-break question Part 10 left open. Implemented in
3d Phase 1a Commit 7c.**

When two eligible requests share the same `createdAt`, **the one Jobber created later wins**, and
that is determined by the **higher NUMERIC id inside the Jobber request id** — the base64
`EncodedId` is decoded (`gid://Jobber/Request/341664448` → `341664448`) and the numbers are
compared **as numbers**.

⚠ **NEVER AS BASE64 TEXT, AND THAT IS THE OPERATIVE HALF OF THE RULING RATHER THAN A DETAIL.**
`341664448` and `99999999` are ordinary neighbours in real Accent data, and lexically the `9`
sorts first — so a text comparison ranks the OLDER request as the later one. Compared as numbers
it is right; compared as text it is wrong in the common case, not an edge one.

⚠ **NO NEW COLUMN AND NO NEW JOBBER FIELD.** The first reading of this question concluded a
`request_number` would be needed and reported the ruling as unimplementable: `requestNumber`
appears nowhere in the repo, `crm_request_facts` has no such column, and `ATTRIBUTION_QUERY`
selects none. **Danny's amendment removed the need** — the number was already inside the id we
already store, so this is a pure ordering change over existing data.

**WHAT IT CORRECTS, STATED PLAINLY.** Until 7c the replay read its facts
`ORDER BY created_at ASC, jobber_request_id ASC` and then applied a **stable** descending sort, so
`eligible[0]` on a tie was the **LOWEST** id — the **opposite** of this ruling wherever Jobber ids
ascend with creation. Ties were therefore resolved backwards, silently, for as long as the replay
has existed.

**SCOPE.** The fact-based ordering used by the replay and by the rebuild preview — which is the
same ordering Commit 7b switches the live doors onto. ⚠ **Live's Jobber-side ordering is
deliberately OUT of scope**: it sorts server-side on `REQUESTED_AT` and 7b retires that path, so
changing it now would mean maintaining a tie-break in a code path scheduled for removal.

**WHERE IT LIVES.** `compareRequestsOldestFirst` and `jobberIdNumber` in
`server/utils/attributionReplay.js`. ⚠ **ONE COMPARATOR SERVES BOTH THE ORDERING AND THE "AT OR
BEFORE" CUT**, because under this ruling "did not exist yet" includes a same-instant request with
a higher id — two spellings of that rule would drift apart.

⚠ **AN UNDECODABLE ID IS NOT AN ERROR.** Test fixtures and any pre-gid row carry plain ids; they
fall back to raw string order so ordering stays deterministic. The gid shape is anchored end to
end (`^gid://Jobber/<Type>/<digits>$`) because `Buffer.from(…, 'base64')` is **lenient** — it
drops characters it does not recognise, so a bare "ends with digits" match would invent a number
out of mojibake.

**GUARD-PROOFED.** Comparing as base64 text instead takes two cases red, and the fixture's own
non-vacuity is a test of its own: the two ids are asserted to DISAGREE between text order and
numeric order, because a fixture whose orderings happened to agree would leave the injection green
and the ruling untested while looking tested.

---

# PART 10b — AN UNMAPPED PERSON ON THE NEWEST ACTIVITY DOES NOT BLOCK ATTRIBUTION

**RULED by Danny, 2026-09-28.** When a client's MOST RECENT activity belongs to a person who is
**not mapped to a RoofMiles team member**, the engine may attribute from **older** activity that
does name a mapped rep. The engine's answer is accepted as it stands; **an admin corrects it by
hand if it is wrong.**

**This sits beside PART 10** and does not amend it. Most-recent-eligible-request-wins governs
ordering *within the eligible set*; this governs what happens when the newest request is not
eligible at all, because nobody it names is mapped. The eligible set skips it and the next one
down wins — which is the behaviour that already ships.

**The worked case: Lyndall Tunnell.** The newest request named an unmapped person; an older one
named rep 5. The engine reached past the newer activity and attributed to rep 5.

⚠ **IT SELF-CORRECTS, AND THAT IS WHY NO MACHINERY IS BEING BUILT.** The moment the current
person is mapped to a team member, their activity becomes eligible and — being the most recent —
wins under PART 10. The repair path is then the ordinary one: **map the rep, run the preview,
review, run the rebuild.** No migration, no special case, no flag.

⚠ **THE PRE-LAUNCH CONSEQUENCE IS FILED RATHER THAN LEFT IMPLICIT.** Every active Accent rep must
be mapped **before launch**, then previewed and rebuilt, or clients will launch attributed to
whoever happens to be mapped rather than to whoever is working them. See
`PRE_LAUNCH_CHECKLIST.md`.

⚠ **THE REJECTED ALTERNATIVE, RECORDED BECAUSE IT LOOKS LIKE THE CAUTIOUS ONE.** Leaving such a
client **unassigned** until the newest person is mapped is the obvious conservative move, and it
is worse: it hides a client from the rep who has genuinely worked them, produces an empty book
rather than a correctable one, and gives an admin nothing to correct. **A wrong-but-visible
assignment can be fixed; an absent one is not even noticed.**

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

---

# PART 11 — EARNING IS AUTOMATIC; MONEY MOVES ONLY THROUGH AN APPROVED CASH-OUT

**Ruled by Danny, 2026-09-29, during the N4 design review. This REPLACES the N4 design's
own default, which proposed gating the conversion write behind a one-off admin review.**

## 11.1 The ruling

When a referral's invoice is paid **and detected** — by the invoice-paid webhook, by the
sync, or by a LATE detection weeks or months afterwards — the bonus **credits the
referrer's balance and the notification fires AUTOMATICALLY.** There is **no admin review
of earnings**, and no review gate is to be added on the earning path.

**Money moves only through an approved cash-out**: the referrer requests it, an admin
approves it, and only then is the transfer sent.

## 11.2 Why the review gate the design proposed was the wrong instrument

The design's default existed to satisfy one worry — *"a deploy must never trigger a
payout."* ⚠ **That guarantee is already provided by the cash-out approval, and providing
it twice costs something.** A review gate on EARNING would mean a referrer's balance did
not reflect what they had actually earned until an admin acted, which makes the balance a
queue rather than a record, and puts a human in a path that has no decision to make: the
invoice is either paid or it is not, and `isInvoicePaid` already answers that.

**The pre-program protection is a different control and it stays.** The existing start-date
rule — `invoice_before_start_date` in `evaluateReferral`, and `pre_start_date` on
`pipeline_cache` — is what stops a pre-program invoice crediting anyone. It is a rule about
WHICH invoices count, not a human checkpoint, and it is unaffected by this ruling.

## 11.3 What this binds

- **N4 commit 4** (the pipeline-cache status moving onto saved facts) ships **without** an
  earnings review gate. Where it detects a paid invoice, the credit and the notification
  fire.
- **Late detection is explicitly in scope.** A bonus detected months after the invoice
  settled is still earned and still credits. The only question a late detection raises is
  the DATE, which §11.4 settles.
- ⚠ **A missed DETECTION is therefore the whole risk, and it is filed as a money-phase item
  on `PRE_LAUNCH_CHECKLIST.md`.** The cash-out gate protects against wrong money movement;
  it cannot protect against an earning that never happened, because nothing is queued for
  anyone to look at. That is the sharper reading of the invoice-sweep gap, not a softer one.

## 11.4 `paid_at` comes from the fact, not from the clock

**Ruled the same day (ruling 4), on the same principle as the assigned-date ruling (R5):
dates come from facts.** `paid_at` takes the invoice's own paid date, **not `NOW()`**.

**The field is `crm_invoice_facts.received_date`**, captured from Jobber's
`Invoice.receivedDate` (selected in `INVOICE_FIELDS`, written by `writeInvoiceFacts`).

**Why `received_date` and not one of its neighbours:**
- `issued_date` is when the invoice was SENT, not when it was paid. Measured on the two
  live cases the N4 read surfaced, the two differ by six seconds and by thirty-four seconds
  — close enough to look interchangeable and wrong in principle, which is exactly the kind
  of near-miss that survives review.
- `updated_at` is the row's last touch for ANY reason. On those same two invoices it reads
  2026-06-10 and 2026-08-11 — **four weeks and two weeks after payment** — so it would
  overstate the date by an arbitrary amount that grows every time Jobber touches the record.
- `received_date` is Jobber's own record of when the money arrived, and it is already
  captured. **Nothing new is fetched to obey this ruling.**

⚠ **THE CONSEQUENCE, SAID PLAINLY BECAUSE IT LOOKS LIKE A BUG THE FIRST TIME IT IS SEEN:**
a late detection writes a `paid_at` **in the past** — potentially months in the past. That
is correct and intended. Anything reading `paid_at` as "recently became payable" — the
engagement cadence is the one to check — is reading it as a write timestamp, which it is
not, and must be re-derived against this ruling rather than assumed safe.

## 11.5 A confirmed boost tier is never recomputed

**Ruling 5, same day.** Once a tier is written into `referral_conversions`, it stands. A
later discovery that an earlier referral was in fact paid first does **not** re-index the
ladder for conversions already booked. **The ledger wins.**

⚠ **This is a deliberate acceptance of a small inconsistency in exchange for a stable
record.** The alternative — recomputing tiers whenever detection order differs from payment
order — makes a referrer's already-credited balance change retroactively, which is worse
than a tier that is one step off.

# 12. THE CATEGORY FIELD — CONTRACTOR- AND CRM-AGNOSTIC (7c, ruled 2026-09-30)

The field that decides which payout schedule a referral is paid on. Accent's is the **JOB custom
field "Job Type"**; the point of these rulings is that nothing in the platform may assume that.

## 12.1 The contractor chooses the field, on any entity, identified by entity + CRM id

**Ruling 1.** Any custom field, on a quote, a job or an invoice, chosen in the admin mapping and
identified by **entity plus the field's CRM id** — never by its label.

⚠ **THE REJECTED ALTERNATIVE IS THE ONE THAT SHIPPED, AND IT IS WHY THIS RULING EXISTS.** Every
identification path today is by label: the mapping stores the string `"Job Type"`, discovery
de-duplicates its results **by name**, and the option lookup is `WHERE label = $2 LIMIT 1`. Accent
has **two** custom fields both labelled "Job Type" — one on quotes, one on jobs — with different
option lists. Discovery keeps whichever Jobber returned first and discards the other, so which field
the platform uses is decided by response order. It happened to keep the right one.

⚠ **AND A LABEL CANNOT BE MADE CORRECT BY BEING MORE CAREFUL WITH IT.** It is not that the matching
is sloppy; it is that the identifier does not identify. Two fields can share a label legitimately,
and a contractor may rename either at any time.

## 12.2 The Schedule Builder's options are always the chosen field's options

**Ruling 2.** Whatever the mapping points at, that field's real options are the qualifying values the
admin picks from.

⚠ **THE FALLBACK THIS RETIRES IS A MECHANISM THAT REPORTS HEALTH IT NEVER OBSERVED.** When no options
are known the schedules endpoint falls back to the qualifying keys already stored — at which point
every key matches itself by construction and any "are these keys still valid?" check comes back
clean. 7c-0 separates the two cases with an explicit `options_known` flag; ruling 2 removes the need
for the fallback at all.

## 12.3 Latest stage wins

**Ruling 3.** Read the category from the **invoice**, else the **job**, else the **quote linked to the
job**. Later stages are more trustworthy: they describe what was delivered and invoiced, not what was
proposed.

- A quote-level field marked **Transferable** in Jobber is copied onto the job, so it is read **from
  the job** like any job field — no special case.
- A **quote-only, non-transferable** field is read from the linked quote, as the fallback.
- **No value at any stage** → the contractor's **default schedule**, and it counts toward the
  coverage notice.

⚠ **THE INVOICE STEP IS DEFERRED, NOT DROPPED, AND THE REASON IS A GAP IN WHAT WE KNOW RATHER THAN A
DESIGN PREFERENCE.** Nothing in this codebase selects `customFields` on an Invoice, so the claim that
a transferable field is reachable there is **unverified**. Building the preference now would be a
branch that silently never fires — the exact failure this arc exists to prevent. **A transferable
field carries the job's value anyway**, so reading the job loses nothing today. Jobber's changelog
returns 403 to automated fetches; proving it needs a browser.

## 12.4 Capture covers quotes as well as jobs

**Ruling 4.** So ruling 3's quote fallback has saved facts to read rather than a live fetch.

## 12.5 RoofMiles never creates or edits a contractor's CRM fields

**Ruling 5.** Not a field, not a dropdown option, not a configuration. **Resident in `CLAUDE.md`
beside A36.5.a.**

⚠ **THE REJECTED PROPOSAL IS A KINDNESS, WHICH IS WHY IT NEEDED RULING OUT RATHER THAN ARGUING
AGAINST.** A contractor with no category field cannot earn anything until they make one; creating it
for them during onboarding is one mutation and removes a whole support burden. **A field RoofMiles
created is a field RoofMiles owns inside the system their business runs on**, and the first collision
with their own naming or a later integration does damage there rather than here. Sanctioned instead:
discovery lists what exists, onboarding gives the steps, and a contractor without one uses their
default schedule rather than being blocked.

## 12.6 Schedule configuration is the contractor's, never a commit's

**Ruling 6.** Qualifying values are re-picked in the Schedule Builder. **No commit edits schedule
data.**

⚠ **RECORDED BECAUSE THE TEMPTATION WAS LIVE AND SPECIFIC.** 7c's investigation found Accent's
escalating schedule — the flagship, $9,500 minimum — keyed on a value that could never appear on the
entity the engine reads, so it could never pay. Fixing that in a migration would have been quick, and
would have made the platform the author of a contractor's payout policy. Danny re-picked them himself
on 2026-09-30, and matchable options went from 1 of 19 to 8 of 19.

⚠ **AND THE SEQUEL IS THE PART WORTH KEEPING: THE CONFIGURATION FIX LANDED BEFORE THE CODE FIX, WHICH
CHANGED WHAT THE CODE FIX IS FOR.** 7c-0's trim-and-fold was written as a repair of a live break; by
the time it shipped, the break was gone and the same commit had become **durability** — protection
against the trailing space being tidied in Jobber later, or a key arriving by any route other than
clicking a pill. **It also invalidated a guard-proof as originally specified**: with the whitespace on
both sides, removing the trim no longer changed the outcome, so the injection had to be rewritten
around fixtures where the two forms genuinely differ. *An injection that cannot reach a
discriminating value is not a guard-proof* — and a configuration change can quietly turn a valid one
into a vacuous one.

---

## 7c-2 — WHERE THE PAYOUT CATEGORY COMES FROM (Danny, 2026-09-30)

Three rulings, and each was reached by rejecting a plausible alternative — which is why they are
recorded here rather than left to be inferred from the code.

### RULING 1 — the mapped field, followed by its LINK. Never by label.

Invoice counterpart (via `customFieldConfiguration.transferedFrom`) → else the job → else the linked
quote.

**REJECTED: match by LABEL.** It is the obvious implementation and it cannot work here. Accent has
**three** configurations named "Job Type". A label match would pick whichever Jobber returned first,
which is how discovery already kept the right one *by luck* before 7c-1.

**REJECTED: match by comparing OPTION LISTS.** Plausible — a transferred copy ought to have the same
options as its source — and measurably useless: `730115` (ALL_INVOICES) has the **same 19 options** as
`730114` (ALL_JOBS), so the option list is exactly what cannot tell them apart. The thing that looks
like a discriminator is the thing the two share.

**REJECTED: infer the link from adjacent ids.** Observed live that Jobber allocates the invoice copy's
id right after the job's (`681762`/`681763`, `1637875`/`1637876`, `730114`/`730115`). It is a real
pattern and it is not a contract; reading it would be deriving a fact about identity from a NAME,
which this project has a resident rule against.

**AND THE LINK IS FOLLOWED IN ONE DIRECTION ONLY.** Accepting the reverse direction would walk up to a
quote-level source and silently widen the mapping to a field the contractor never chose.

### RULING 2 — the latest stage WITH A VALUE wins; blank is absent.

**REJECTED: the latest stage, full stop.** It is simpler and it loses money. Both directions of the
blank case exist in production *today*: a live job carries `""` while its invoice copy has a value,
and invoice **60504** is the mirror — a blank invoice copy over a job that says "Out of Pocket".
Taking the later stage unconditionally returns `no_job_type_found` for one of those two.

**REJECTED: collapse blank to NULL at capture time.** That would make "the contractor cleared this
field" and "this field has no value column" the same row. The distinction belongs to the resolver, so
the fact row keeps `''` as `''`.

### RULING 3 — on a conflict the invoice wins, and the disagreement is RECORDED.

**REJECTED: pick the invoice silently.** A contractor who changed the job's category after invoicing
has told us two different things, and which they meant is a question only they can answer. A silent
pick is a decision disguised as a lookup.

**REJECTED: refuse to convert on a conflict.** It fails closed, and it fails closed on the
contractor's own data-entry habit rather than on anything risky — withholding a referrer's bonus to
register our own uncertainty.

**Agreement is judged by the shared matcher**, so case and a trailing space are not a conflict; two of
Accent's nineteen live options carry a trailing space, and a byte comparison would manufacture
mismatches out of the contractor's own option list. **A blank is not a conflict either** — ruling 2
already made it absent.

---

## SPLIT CAPTURE FROM DECISION (Danny, 2026-09-30) — ruled, built immediately after 7c-2

**Facts are saved in their own transaction first; the stage decision runs in a separate locked
transaction afterwards.** A decision failure then never discards facts.

**WHY, AND IT SUPERSEDES THE "the two inconsistencies are symmetrical" READING I FILED.** The
coupling was filed as *not obviously wrong*, on the grounds that splitting it trades one inconsistency
for another. That is true and the two are **not** equal: *"facts stored, stage stale"* leaves the
already-handled `status_derived_at IS NULL` state, which the next pass converges out of; *"stage
written, facts discarded"* is a decision resting on data that was rolled back, and it cost **seven
clients their facts** on the invoice-paid door with nothing left to re-derive from.

**THE SAFETY NET IS PART OF THE RULING, NOT AN ADDITION.** A failed decision **raises an alert**, and
a small job **re-decides any client whose facts are newer than their decision** — from saved facts
only, no Jobber calls.

⚠ **THE CATCH-UP JOB IS WHAT MAKES THE SPLIT SAFE RATHER THAN MERELY DIFFERENT.** Without it, "the
next pass will fix it" is a hope: a client whose decision failed and who then has no further webhook
would keep a stale stage indefinitely. With it, the divergence is bounded by the job's cadence and is
observable — `facts newer than decision` is a query anyone can run.

⚠ **AND THE ALERT IS THE OTHER HALF, FOR THE REASON THE `$3` DEFECT DEMONSTRATED**: that failure ran
for three hours at severity INFO with `alert: false`, and nothing surfaced it. A correct behaviour
nobody can see is how a 10-minute expiry survived on a 30-minute tick.

---

## TWO START-DATE GATES, AND THEY COMPARE DIFFERENT DATES (recorded 2026-10-01, Danny ruling 3)

**Recorded because a source comment asserted the opposite, and asserted it in the reassuring
direction.** `server/crm/pipelineSync.js` said *"Pre-start-date clients never trigger bonus logic
(checked upstream by hard gate)"*. That is **false of the money engine**, and a reader who believed it
would conclude the engine is protected by a gate it does not consult.

**No behaviour changed in Commit B.** The comment was corrected and the gap recorded. This section is
the record; the behaviour question is open.

### What is actually there

Both gates read the same setting — `contractor_crm_settings.referral_start_date` — and compare it to
**different dates**:

| gate | date compared | where | what it does |
|---|---|---|---|
| `invoice_before_start_date` | the **INVOICE's** `issuedDate` | `evaluateReferral`, `server/referralRules.js` | refuses the conversion. **The only start-date gate the engine applies.** |
| `pipeline_cache.pre_start_date` | the **CLIENT's** `createdAt` | computed in `syncSingleClient`, stored on the row | suppresses `bonusEarned` on the referrer's card, suppresses `users.paid_count`, suppresses notifications, and writes a `flagged_referrals` row during initial sync. **Gates DISPLAY, not the engine.** |

⚠ **`evaluateReferral` DOES NOT READ `pre_start_date`.** Measured: searching
`pre_start_date|isPreStart|preStart` across `server/` returns **zero hits** in `server/referralRules.js`.

### The reachable consequence, stated plainly

**A pre-start-date CLIENT with a post-start-date INVOICE qualifies in the engine and gets a
`referral_conversions` row, while the card shows `bonusEarned = false` and the balance excludes it.**
That is a ledger row the referrer cannot see — money recorded as owed on a surface that says nothing is.

⚠ **IT IS NOT KNOWN WHETHER ANY SUCH ROW EXISTS TODAY, AND SAYING OTHERWISE WOULD BE INVENTING A
SOURCE.** It needs a read of `referral_conversions` joined to `pipeline_cache.pre_start_date`. Filed
rather than asserted.

### Why neither gate is simply "the right one"

- **The invoice date is the right question for the engine.** The programme pays on work invoiced after
  it started; a client who existed before it started can still generate qualifying work.
- **The client date is the right question for the card.** A client who predates the programme was never
  a referral, and showing them a bonus would be the product claiming credit for pre-existing work.

**So the two gates are not a duplication to be collapsed.** They answer different questions and both
are defensible. ⚠ **What is NOT defensible is the engine and the card disagreeing silently** — one
writing a ledger row the other hides. Whichever way that is resolved, it is a ruling about what a
referrer is owed, not a refactor.

⚠ **AND THE OBVIOUS FIX IS THE WRONG ONE TO REACH FOR FIRST.** Adding `pre_start_date` to
`evaluateReferral` would make the engine refuse those conversions — which is a decision to **not pay**
on work the programme's own invoice rule accepts. That is a change to the payout promise and belongs to
Danny, not to a commit tidying a comment.

### ✅ RESOLVED — ONE START-DATE RULE (Danny, 2026-10-01). BUILT IN COMMIT C.

**The ruling:** a referral earns a bonus only if **BOTH**

1. the referred **CLIENT** was created **on or after** the programme start date, **AND**
2. the qualifying **INVOICE** was issued **on or after** it.

**A client created before the programme start never earns a bonus**, so **no ledger row can exist that
the referrer cannot see.** `evaluateReferral` reads the client's creation date as well, through the
**same start-date source** — one setting, two dates, one rule.

⚠ **THIS CLOSES THE GAP THE SECTION ABOVE OPENED RATHER THAN ARGUING WITH IT.** The two gates stay —
they still compare different dates — but they are now both *required* instead of one gating the engine
and the other gating the display. The disagreement is what produced the defect; requiring both removes
it in the direction that cannot surprise a referrer.

⚠ **IT IS THE CONSERVATIVE DIRECTION, AND SAYING WHICH WAY IT CUTS MATTERS.** The rule can only
*refuse* conversions that previously qualified — a pre-start client with a post-start invoice. It can
never create one. So the risk it carries is "a bonus somebody expected is not paid", not "a bonus is
paid twice", and the previous section flagged the obvious-fix version of exactly this as **Danny's call
rather than a commit's**. This is that call, made.

⚠ **AND THE DISPLAY SIDE NEEDS NO CHANGE, WHICH IS THE POINT.** `pipeline_cache.pre_start_date` already
suppresses `bonusEarned`, `users.paid_count` and notifications for a pre-start client. Under the old
behaviour the engine could write a row the card hid; under this rule the engine refuses the same
population the card hides, so the two agree **by construction** rather than by coincidence.

**Its own guard-proof:** a client created **before** the start date with an invoice issued **after** it
must produce **no credit** — and crediting it must go **red**.

### WHERE THE CLIENT'S CREATION DATE COMES FROM (Danny, 2026-10-01, option (a)). BUILT IN C1.

**The one start-date rule above needs the CLIENT's creation date, and it was stored in exactly one
place: `pipeline_cache.jobber_created_at` — the row the fact path has to CREATE.** So the rule and
ruling 1 (referred-by from facts, which creates that row on a first paid invoice) could not both be
true. Measured before ruling: `jobber_clients.created_at` is `DEFAULT NOW()`, i.e. *our* row's insert
time; and every `crm_*_facts.created_at` is that RECORD's date, never the client's.

**The ruling:** add **`jobber_clients.jobber_created_at`**, nullable, written by `captureClientFacts`
from the client's own `createdAt` on **every full capture**, and **backfilled once** from
`pipeline_cache.jobber_created_at` where a row exists — *the same value, the same meaning.*

⚠ **A CLIENT WHOSE CREATION DATE IS STILL UNKNOWN IS NOT ELIGIBLE. UNKNOWN IS NEVER PERMISSION.**
It becomes eligible when its next full capture fills the column. This is the financed-flag precedent
applied to a second nullable gate input, and it is the conservative direction on purpose: the cost of a
NULL is a *delayed* bonus, which the catch-up converges; the cost of treating NULL as eligible is a
bonus paid on a client the programme never covered, which is money out the door.

⚠ **WHY A COLUMN RATHER THAN A FACT ROW.** `crm_custom_field_facts` exists for CUSTOM FIELDS. Filing a
scalar there would make that table mean two things, and the resolver that reads it would need to know
which. The client's creation date is an attribute of the client, so it belongs on the client's row.

⚠ **AND THE BACKFILL IS HONEST BECAUSE THE SOURCE IS THE SAME FACT, NOT A PROXY.** This is the
distinction `stage_derived_at` and `last_full_capture_at` were deliberately NOT backfilled on: there,
no stored value meant what the new column claims, so any backfill would have asserted something false.
Here `pipeline_cache.jobber_created_at` IS the client's Jobber creation date, already stored by the
sync — so copying it asserts nothing new. **A backfill is wrong when it invents a value, not whenever
it is a backfill.**

⚠ **IT IS IN HAND AT CAPTURE TIME, WHICH IS WHY THIS IS CHEAP.** `CLIENT_FIELDS` has always selected
the client's `createdAt`; every full capture already received it and discarded it.
