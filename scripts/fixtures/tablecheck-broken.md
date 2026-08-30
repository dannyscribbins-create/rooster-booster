# tablecheck fixture — DELIBERATELY BROKEN. Do not "fix" it.

This file exists so `scripts/tablecheck.js`'s failure mode can be re-proved on demand
rather than assumed. It reproduces the exact defect found in
`DECISION_C_DL_BUILD_SPEC.md` section 10 during C/DL-3c Phase 1: a blockquote inserted
between a table's header separator and its first body row.

The file parses. A diff of the insertion looks correct. The table below stops rendering
as a table after its header, which is the whole point.

⚠ It is excluded from tablecheck's default walk (see FIXTURE_DIR in the script), so it
does not make the normal run permanently red. Reach it with `--path`.

Expected: `BROKEN TABLE` reported at the separator line, and exit 1 under `--strict`.

| Mockup page | Session | Notes |
|---|---|---|
> a blockquote wedged between the separator and the first body row

| Token table | 3c | this row is now orphaned from its header |
| 1A Splash | 3b | so is this one |
