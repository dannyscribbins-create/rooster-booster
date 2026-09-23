# Rep assignment rebuild — operator SOP

**What it is:** a support tool that discards the attribution engine's own assignments for one
contractor and re-derives them from stored CRM facts. No Jobber call, no re-import.
**Who runs it:** Danny or support, through a Railway environment variable. Contractors never
see it and there is no button.
**Code:** `server/jobs/repAssignmentRebuild.js`.

---

## 1. When to run it

**Run it when a contractor's books are wrong AT SCALE because reps were mapped in the wrong
order** — typically: an import ran while only some reps were mapped to Jobber users, the
engine locked clients to whoever it could match, and mapping the right people afterwards
changed nothing, because a locked assignment is never revisited.

**Do NOT run it for:**

| Situation | What to do instead |
|---|---|
| One client, or a handful, assigned to the wrong rep | Reassign on the client's record — the **Assigned rep** card in the admin contact drawer |
| A rep has left the company | Nothing. Deactivate them: their clients are tagged as history and their assignments stay put |
| A rep was never mapped and should be | Map them. The replay runs automatically and picks up everything not already locked |
| Conversions look wrong, but ownership is right | Not this tool. Ownership and the sale count are separate |

---

## 2. Precondition — check this FIRST

> **Every ATTRIBUTABLE, ACTIVE team member must be mapped to a Jobber user before you run it.**

If they are not, the rebuild refuses and changes nothing — deliberately: mapping people one at
a time replays each in turn, and the first rep's locked clients block everyone else. That is
the fault this tool repairs, so running it early would rebuild straight back into it.

Run this in the Railway database console. **Replace `<CONTRACTOR_ID>` with the real id** — for
example the production contractor, which is *not* the one seeded locally:

```sql
SELECT id, full_name, email, jobber_user_id
  FROM team_members
 WHERE contractor_id = '<CONTRACTOR_ID>'
   AND is_attributable = true
   AND active = true
 ORDER BY jobber_user_id NULLS FIRST;
```

**Ready when:** every row has a `jobber_user_id`. Any row with NULL must be mapped in Team
Settings first, or made non-attributable if they are not a rep.

The tool cannot check the other half — that everyone who *should* be a rep exists at all. **You
check that.** If someone is missing entirely, add and map them before running.

---

## 3. Steps

1. **Take a backup.** Admin panel → Settings → **Run Backup Now**, and wait for it to finish.
   See §6 for why this is not optional.
2. **Confirm the precondition** (§2).
3. In **Railway → the service → Variables**, add:
   `REP_ASSIGNMENT_REBUILD` = the contractor id, exactly.
4. **Restart the service** (Railway redeploys on a variable change; if it does not, restart it).
5. **Read the logs.** On success:
   ```
   [repAssignmentRebuild] REQUESTED for <contractor> — discarding engine-written assignments, then replaying from stored facts. Remove REP_ASSIGNMENT_REBUILD after this run.
   [repAssignmentRebuild] <contractor> — 208 stickies and 203 provisionals cleared (395 rows removed), of which 0 carried NO written_by marker and were treated as replay-written (treatNullAsReplay=true); 4 open co-assignment flags closed; 430 clients replayed, 0 failed
   ```
   On refusal — **nothing was changed**, fix the cause and start again at step 2:
   ```
   [repAssignmentRebuild] REFUSED — 2 attributable team member(s) have no jobber_user_id — map every rep first, then re-run: Jane Smith, Tom Rees
   [repAssignmentRebuild] REFUSED — no such contractor: accent-roofing
   ```
6. **REMOVE the `REP_ASSIGNMENT_REBUILD` variable** and restart.
   > ⚠ **Leaving it set re-runs the rebuild on EVERY restart** — including automatic restarts
   > after a deploy or a crash. It reaches the same result each time, but it also re-closes any
   > co-assignment flag raised in between, so an admin's queue keeps emptying itself.
7. **Verify** (§5).

---

## 4. What it preserves, and what it discards

| Kept | Discarded and re-derived |
|---|---|
| Manual assignments (`sticky_source = 'manual'`) — an admin's decision always wins | Engine-written locked assignments (`quote_salesperson`, `promoted_provisional`, `mode_a_at_close`, `mode_b_at_close`) |
| QR-link assignments (`provisional_source = 'qr_link'`) | Engine-written provisional assignments (`mode_a`, `mode_b`) |
| Anything a live webhook wrote since the import (`written_by = 'live'`) | Anything the replay wrote (`written_by = 'replay'`), and see §7 for rows with no marker |
| Flags an admin has already resolved | **Open** co-assignment flags — closed first, then re-raised by the replay if still true |
| `client_sales`, conversions, referral payouts, contact tags — untouched | |

Reps' books read empty between the discard and the end of the replay. On Accent's volume that
is well under a minute (430 clients), but do not run it while reps are working if that matters.

---

## 5. Verify it worked

The log line in step 5 is the primary check: `clients replayed` should be close to the number
of clients with stored CRM history, and `failed` should be **0**. Any failure is also in
`error_log` under source `attributionReplay — client`.

Then, in the database console:

```sql
SELECT COALESCE(tm.full_name, tm.email) AS rep,
       COUNT(*) FILTER (WHERE cra.sticky_rep_id IS NOT NULL) AS locked,
       COUNT(*) FILTER (WHERE cra.sticky_rep_id IS NULL)     AS provisional,
       COUNT(*)                                              AS total
  FROM client_rep_assignments cra
  JOIN team_members tm ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
 WHERE cra.contractor_id = '<CONTRACTOR_ID>'
 GROUP BY 1
 ORDER BY 4 DESC;
```

**Good result:** every rep who should have a book has one, and the totals are in the range the
contractor expects. A rep with zero after mapping means their Jobber user id is wrong — check
it against the Jobber user picker in Team Settings.

---

## 6. What it cannot undo — take the backup

**It cannot be reversed.** The discard deletes assignment rows outright; there is no history
table and no undo. The replay re-derives ownership from stored facts, so a correct rebuild
restores most of what it removed — but **anything the engine can no longer derive is gone**,
and that includes any engine-written assignment whose supporting request or quote is no longer
in `crm_request_facts` / `crm_quote_facts`.

> ⚠ **YES — RUN A BACKBLAZE BACKUP FIRST.** Admin panel → Settings → **Run Backup Now**. This
> is the same rule the repo applies to any migration or DB-touching push, and this tool deletes
> rows, so it is squarely inside it.

Closed co-assignment flags are also not restored to `open` if the replay does not re-raise them.

---

## 7. The NULL marker caveat — read before running on a new contractor

Assignments written before the `written_by` column existed carry **NULL**, and the rebuild
treats NULL as *replay-written* — so it discards them.

- **That is correct for Accent**, whose rows predate the column and came from one import and
  one replay, with no live rep traffic after it.
- **It is NOT correct for a contractor with months of live activity after their import.** There,
  NULL rows may include work the live webhooks did, and discarding them throws that away.

**Before running it on any contractor whose import is not recent, check how many rows are at
risk:**

```sql
SELECT written_by, COUNT(*)
  FROM client_rep_assignments
 WHERE contractor_id = '<CONTRACTOR_ID>'
 GROUP BY 1 ORDER BY 2 DESC;
```

If a large share is NULL and that contractor has been live for a while, **stop and ask Danny.**
The tool can decline the assumption (`treatNullAsReplay: false`, which keeps every NULL row),
but that is a code-level option today, not an environment variable — so it needs a change, not
a restart.
