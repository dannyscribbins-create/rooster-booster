# C/DL-3c — Live Verification Record

Reads performed by Danny against production. A production read that is not
written down is a measurement nobody can re-check.

⚠ **SECOND-HAND RECORD.** Danny performed every read below and reported it
in session. No session observed these directly. Written down 2026-09-01,
after the previous session drafted this file and did not write it.

⚠ Cite by role only — this file is inside `citecheck --role-only`'s set.

## 2b — the surface switcher · 2026-08-31 · deployment 0d32189

Account: Danny Bobanny (`team_members` id 5), Accent Roofing, incognito.
Tier: **UNESTABLISHED** — Railway Postgres unreachable from the build
environment; settle from the Railway console or `/api/admin/me`.

- **Sidebar mount** — admin panel, rep holding permissions. Switcher
  renders below the identity block, above Sign out, boxed. White-alpha
  values copied from the Sign out button read clearly on the dark sidebar;
  the contrast concern raised in the phase report did not materialise.
- **Empty-state mount** — same account with permissions removed.
  "Switch to the rep app" renders inside `AdminNoAccessScreen`. This is the
  mount that matters: a rep with an empty JSONB has no sidebar.
- **Rep-card mount** — "Switch to the admin panel" on `RepPlaceholder`.
- **Both directions** confirmed.
- **Eligibility** — Adam IN (general tier, no permissions, no rep flag)
  received the empty state with NO switcher.
- **AdminNoAccessScreen copy** — "Nothing here yet" / "Your Owner has not
  given you access to any sections yet" / "Your account works — there is
  nothing wrong with it." Contractor name resolved from settings, not a
  literal.

**Not observed:** the brief Loading… state; the admin boot request count.

## 2c — deactivation, the notice, and reactivation · 2026-08-31

### Observed

- **Dark mode persists** on the deactivation notice page.
- **Silence on the second login** after deactivation — the notice does not
  repeat.
- **The notice returns** after reactivate → deactivate again → log in.
  ⚠ **This is the load-bearing one.** It is the only thing distinguishing
  "the reset works" from "the flag was never written." The two are
  indistinguishable from outside and the suite proves it only against a
  fixture.

### Not observed — do NOT infer these from the sequence passing

- **`TeamAccessRevokedScreen` in LIGHT mode.** Dark only was reported.
- **Whether the employer name resolves** on that screen, and whether the
  chrome reads correctly on `--rm-*` in both modes. The screen carries the
  employer's name from the frozen row and deliberately no logo — the
  person is one click from a different contractor's app, so an employer
  mark would mis-brand the destination.
- **The Reactivate control's appearance** — icon, colour in both themes,
  spinner, and the row flipping to Active on refetch. The control was
  exercised during the sequence above, but exercising a control is not
  observing it.

These three ride along with the real-browser verification of the 4A
primitives, `Skeleton` and `LockedSection` in dark, owed since 3a and due
when Phase 3 first gives them a surface.

### Known bound, not a failure

A frozen rep holding **two** live homeowner accounts hits D2's choice
branch and is still never shown the notice. That is a filed design question
about `login_choice_tokens`, not a defect in this behaviour.
