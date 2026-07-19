# Rep Assignment Rules — Locked

**Source:** extracted from the governing RBAC/RepAssignment spec + Prep Note (project
documents maintained outside this repo). Recorded here verbatim-in-substance during the
FA (Flagged Assignments) session, 2026-07-17, so no future session has to re-derive them
from a document this repo can't see.

**Status:** LOCKED. This session (FA) does not redesign any of these rules — it only
implements the queue/resolve surface described in `FLAGGED_ASSIGNMENTS_TOGGLE_SPEC.md`
§4.4/§4.5 against them.

---

## Assignment sources, in precedence order

1. **Automatic — unambiguous.** Either:
   - an attributable link is used (exactly one attributable mapped rep on a Jobber
     request), or
   - the client **inherits** its rep from an already-assigned referrer. Inheritance
     fills ONLY currently-unassigned clients, at infinite depth down the referral chain.
2. **Ambiguous / conflicting.** The client is left unassigned (or the existing
   assignment is kept) and the case is **flagged for human review**. This is the
   `flagged_assignments` queue this FA session builds a surface for.
3. **Still orphaned.** Client-portal banner dropdown lets the client pick — **not built
   yet** (deferred feature).
4. **Anytime — Owner/Admin manual (re)assignment.** A human can assign or reassign a
   client's rep at any time. This action **cascades down that node's referral-descendant
   branch**, EXCEPT descendants that carry their OWN separate manual assignment — those
   stay put.

## Sticky rule

**Existing-wins.** The first assignment a client receives is sticky. Later conflicting
events never overwrite it — they flag instead (source #2 above). A queue resolve-assign
**is** an Owner/Admin manual assignment (source #4) and is therefore always allowed to
set/override the sticky value, since #4 is the one path that supersedes sticky-by-design.

## FA session scoping note (V1/V2 verification, 2026-07-17)

Before implementing the resolve action, this session verified against the live codebase:

- **V1 — referral inheritance (source #1's second clause) is NOT implemented anywhere.**
  `server/utils/attributionEngine.js` has no `referred_by`/`referrer`/inheritance logic;
  its only caller is `server/crm/pipelineSync.js:235`. Confirmed via full-repo grep.
- **V2 — `client_rep_assignments.flag_reason` / `flag_resolved` / `flag_resolved_at` /
  `flag_resolved_note` are dead columns.** They exist only in
  `server/migrations/add_decision_b_schema.js`'s `CREATE TABLE` — no code anywhere reads
  or writes them. They are a separate, unreconciled parallel mechanism from the
  standalone `flagged_assignments` table this session's queue targets, and are left
  untouched by this session (Danny-ruled).

**Consequence for this session's resolve-assign implementation:** since referral
inheritance (the only thing that could create "referral-descendant branch" state) does
not exist yet, rule #4's branch cascade is **vacuous today** — there are no inherited
descendants to walk. Resolve-assign therefore writes ONLY the flagged client's own
`client_rep_assignments` row: `sticky_rep_id`, `sticky_source = 'manual'` (new enum
value), `sticky_set_at = NOW()`. No branch walk is implemented. `'manual'` is deliberately
the marker the future cascade will need to identify "stay-put" descendants once
inheritance (and therefore a real branch to cascade down) lands — Decision C-era.
Branch cascade is registered as its own scoped follow-up work at that point; the rows
this session writes are already forward-compatible with it.

If a future session finds V1 has changed (referral inheritance has been implemented),
the branch-cascade behavior of resolve-assign must be revisited before relying on this
document's "vacuous today" conclusion.
