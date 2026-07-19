# Rep Surface Remainder — Attributable Toggle + Flagged Assignments Queue ("FA")

**Status:** LOCKED — 2026-07-09. FQ-1/FQ-2/FQ-3 and AT-1 resolved by Danny same day. Zero open questions; one Phase-0 unknown deliberately deferred to build (§5).

**What this is:** the final unspecced slice of the Execution Plan's B1-C "rep-mapping admin surface." Already done elsewhere: the Jobber User Mapping card is **built** (type-ahead Jobber-user link on a RoofMiles team member, saved as the explicit mapping); the webhook attribution path is live and writing `client_rep_assignments` (S92/93); `is_attributable` exists at the schema level (rep 5 set via direct SQL — the "no UI yet" tell). This spec covers the two remainders: **(A)** the `is_attributable` UI toggle, **(B)** the `flagged_assignments` review queue.

**Authority boundary:** every assignment *rule* (triggers, precedence, inheritance, sticky/existing-wins, cascade semantics, multi-team-member disambiguation) is already LOCKED in RoofMiles_Team_RBAC_RepAssignment_Spec + the Decision B–E Prep Note. This spec builds surfaces over those rules and re-litigates none of them.

---

## 1. Plain-Language Overview

Decision B deliberately refuses to guess: when the system can't tell which rep should own a client — two attributable reps on one Jobber request, or a new event pointing at a different rep than the sticky one — it leaves the client unassigned (or keeps the existing assignment) and **flags it for a human**. Today those flags have nowhere to live and no way to be seen or resolved. This build gives them a home: a queue card in Team Management, a bell notification when a flag is born, and a resolve flow whose outcome is just a normal manual assignment (with all its locked cascade behavior). Separately, the attributable/non-attributable switch — currently flippable only by SQL — becomes a proper toggle in the member drawer.

---

## 2. Locked Decisions (2026-07-09)

- **FQ-1 (placement): Option A.** The queue is a card/tab inside **Team Management**, alongside the mapping card, with an unresolved-count badge on the section nav. Forward hook (not built now): flags also feed the Zone 1 action feed when that exists.
- **FQ-2 (permission):** view + resolve gated under the existing **`team_manage`-family flag** — resolving a flag IS making a rep assignment, a team-shaping act. Phase 0 confirms the exact registered flag name and checks whether one of the RBAC registry's 4 reserved forward sections was earmarked for assignments/reps; if so, use it instead. **No new permission concept is invented here.** All new routes join the Decision A enforcement net (endpoint coverage test, registry reconciliation, Owner parity) — not a separate testing track.
- **FQ-3 (notification):** on flag creation, a message is inserted into the **existing Notification Center** (bell, top-right, drawer popup, red count badge — backend live since S77). The message carries a **clickable deep link to the Team Management page** (landing focused on the queue card). One notification per flag (no re-notify on updates). Recipients: team members holding the FQ-2 gating permission. No email/push at MVP.
- **AT-1 (toggle semantics):** flipping attributable ⇄ non-attributable is **future-only**. Previous states persist: existing assignments and their inherited descendants stay exactly where they are; from the flip moment forward, new events assign (or don't) per the new state. No retroactive sweeps in either direction. A non-attributable rep's link continues onboarding clients per the locked design — it just stops assigning.

---

## 3. Scope A — `is_attributable` Toggle

- **Where:** Member detail/edit drawer, in the rep-promotion controls area (per the Phase 6 Team Management design — Roster/drawer/Titles patterns already shipped; follow them).
- **Visibility:** rendered only for members promoted to field rep (General tier + field flags). Displays current state as the Roster's rep-status column already does (— / Attributable / Non-attributable).
- **Backend:** extend the existing team-member PATCH endpoint if its shape allows (Phase 0 confirms — the mapping card faced the same question), else a dedicated endpoint; either way tagged `requirePermission(<FQ-2 flag>)` and registered.
- **Semantics:** AT-1 verbatim. If team edits currently write to the activity log, this follows the same pattern (Phase 0 checks; match existing behavior, don't invent).
- **Copy:** toggle label "Attributable rep" with helper text: "When on, clients who enter through this rep's link or Jobber appointments are assigned to them. Turning this off never removes existing assignments."

## 4. Scope B — Flagged Assignments Queue

### 4.1 Flag creation (backend)
Flags are emitted at the **existing detection points** in the attribution engine (webhook path / assignment writer built in S92–93) — the two locked trigger cases:
1. `multi_rep_conflict` — a Jobber request carries 2+ attributable mapped reps → client left unassigned, flag created with all candidates.
2. `sticky_conflict` — a new event resolves to a different rep than the client's existing sticky assignment → assignment untouched, flag created carrying existing rep + challenger + source context.
Phase 0 determines what that code does with these cases **today** (silent skip? log line?) and wires flag-row creation in at those exact points — the detection logic itself is not rebuilt. Dedup rule: one OPEN flag per (contractor, client); a new conflicting event on an already-flagged client updates the existing flag's context rather than stacking a second row.

### 4.2 Schema (created only if Phase 0 finds none — see §5)
`flagged_assignments`: `id` · `contractor_id TEXT NOT NULL REFERENCES contractors(id)` (**tenant-scoped from birth** — no ST-style migration ever needed) · client reference (`jobber_client_id` and/or contact id per what `client_rep_assignments` uses — mirror it) · `flag_type` · `candidates JSONB` (rep ids + display context) · `source_context JSONB` (event type, Jobber request id, timestamps) · `status` (`open` / `resolved` / `dismissed` / `auto_resolved`) · `resolution JSONB` · `resolved_by` · `created_at` / `resolved_at`. Index `(contractor_id, status)`. Resolved flags are **retained as history**, never deleted.

### 4.3 Queue UI
Card lists OPEN flags (client name, flag type in plain words — "Two reps matched this client" / "New event conflicts with existing assignment" — candidates with avatars, source context, age). Row expands to the resolve panel:
- **multi_rep_conflict:** pick a candidate (radio) or any attributable rep from the full dropdown → Assign.
- **sticky_conflict:** "Keep {existing rep}" (closes flag, no write) or "Reassign to {challenger/any}" → manual reassignment.
- **Dismiss** available on both (status `dismissed`, no assignment write).
Resolved/dismissed history viewable behind a filter toggle. Empty state: "No assignment conflicts — the system flags anything it can't resolve safely."

### 4.4 Resolution semantics (inherited, not invented)
An Assign/Reassign action from the queue **is** an Owner/Admin manual assignment and carries the locked cascade behavior verbatim: it cascades down the client's referral branch, except descendants holding their own separate manual assignment, which stay put. Sticky rule remains intact everywhere else.

### 4.5 Auto-resolution
If a flagged client becomes assigned by ANY route while the flag is open (e.g., a later unambiguous event, or the client-portal banner pick), the flag auto-closes as `auto_resolved` — the same auto-stop philosophy as the banner. The queue never shows stale work.

---

## 5. Phase 0 — Read-Only Investigation (mandatory)

1. **Does any flagged-assignments table/mechanism already exist?** (Danny: unknown — confirm at build.) Grep `flag` across `server/` + inspect the S92/93 attribution writer for its current handling of the two conflict cases. Adopt/extend anything found; create §4.2 otherwise.
2. Exact FQ-2 permission flag name in the registry + whether a reserved forward section covers assignments/reps.
3. Current team-member PATCH endpoint shape (extend vs. new endpoint for the toggle).
4. Notification Center insert pattern (type/shape of notification rows, how deep links are encoded in existing messages) — follow it exactly.
5. `client_rep_assignments` client-reference shape (to mirror in §4.2).
6. Whether team edits write activity-log entries (toggle follows suit).
7. Confirm live data state: which reps are currently attributable (expect rep 5 only).

STOP after Phase 0 with findings before any edit.

---

## 6. Test Plan (RED-first; two-tenant fixtures throughout)

1. Simulated two-attributable-rep event → client unassigned + one `multi_rep_conflict` flag with both candidates; a second conflicting event updates, not duplicates.
2. Sticky-conflict event → existing assignment untouched + `sticky_conflict` flag.
3. Resolve-assign cascades down the branch except own-manual descendants (reuse/extend the Decision B engine fixtures).
4. Keep-existing and Dismiss close the flag with zero assignment writes.
5. Auto-resolve: independent assignment while flag open → status `auto_resolved`.
6. Tenant isolation: Admin A cannot list or resolve Contractor B's flags (404-family; guard-proof the predicate per the Session 86 lesson).
7. Permission: member without the FQ-2 flag → 403 on list and resolve; enforcement-net tests (coverage/reconciliation/Owner-parity) still green with the new routes registered.
8. Notification row created on flag birth with working deep link; exactly one per flag.
9. Toggle: flip to non-attributable → pre-existing assignment persists; subsequent link entry does NOT assign; flip back → next event assigns; no retroactive changes either direction.

---

## 7. Sequencing & Discipline

- **Placement:** the natural Phase-6-adjacent slot in the build track — after the mapping card (done) and **after Tenant S3 + TF deploy cycles complete**, because §4.1 touches the webhook attribution path that S3 is rewriting (same-file collision avoidance, same reasoning as TF's placement). Before Decision C link/QR attribution, per S93's declared order — Decision C's flows will create assignment events that need this queue existing.
- Standard discipline: Backblaze backup (touches the money-adjacent attribution path), RED first, file-by-file diffs, STOP checkpoints after Phase 0 and before commit.
- Registry edits at completion: close the S93 "flagged_assignments review queue" line; record AT-1's future-only semantics as a binding rule; log the new routes in the permission registry.

**Done-statement, in advance:** Accent's admins can flip any field rep's attributable state from the drawer with future-only effect; both conflict types produce visible, resolvable queue entries with bell notifications; resolving cascades exactly per Decision B; Contractor B's flags are structurally invisible to Contractor A; the enforcement-net tests pass with every new route registered.

*End of FA Specification v1.0. B1-C's admin surface is now fully specced: mapping card (built) + toggle + queue (this doc). Plug-and-play after S3+TF.*
