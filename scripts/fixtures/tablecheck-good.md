# tablecheck fixture — the SAME content, correctly structured

The positive control for `scripts/tablecheck.js`. Identical to
`tablecheck-broken.md` except the blockquote sits ABOVE the table rather than inside it.

⚠ **THE POSITIVE CONTROL IS THE HALF THAT MAKES A PASS MEAN ANYTHING.** Without it, a
clean run on the broken fixture and a clean run on a correct file are indistinguishable
— the script could be reporting nothing because it works, or because it is broken. Two
fixtures, opposite expected results, is the smallest pair that separates those.

Expected: `OK — no findings.` and exit 0 under `--strict`.

> a blockquote, then a blank line, then the table — valid, and how section 10 now reads

| Mockup page | Session | Notes |
|---|---|---|
| Token table | 3c | this row is attached to its header |
| 1A Splash | 3b | so is this one |
