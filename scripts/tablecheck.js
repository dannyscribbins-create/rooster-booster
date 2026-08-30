#!/usr/bin/env node
'use strict';

// ─── tablecheck.js — markdown tables, checked for insertions that break them ──
//
// WHY THIS EXISTS. C/DL-3c Phase 1 inserted an explanatory blockquote into
// DECISION_C_DL_BUILD_SPEC.md section 10 and it landed BETWEEN the table's
// header separator and its first body row. The file parsed. The diff showed
// exactly the intended text, in the intended place, with no surprises. And the
// table would have stopped rendering as a table — taking the Session column
// with it, which was the entire point of the amendment that inserted it.
//
// ⚠ A DIFF CANNOT SHOW THIS. A diff shows added and removed lines; it cannot
// show a document's relationship to its own structure changing. That defect was
// found by re-reading the rendered section, not by reviewing the change — which
// is the same reason CLAUDE.md's comment-block rule exists. This closes the
// mechanical half so the next one does not depend on someone re-reading.
//
// IT PRINTS. It does not assert, it never exits non-zero on a finding, and it
// must never be wired into a build or a test gate. Same contract as
// citecheck.js and for the same reason recorded there: a check whose correct
// real-repo output is nonzero becomes a permanently-red gate and is silenced
// within a week. (`--strict` exists for the fixture proof only and is
// documented at the flag itself.)
//
// It WALKS the tracked file list. It does not iterate a hand-maintained FILES
// list — that is the defect recorded against the brand sweep, where new files
// were invisible until someone remembered them and nothing announced it.
//
// Usage:  npm run tablecheck
//         npm run tablecheck -- --verbose        also print every table found,
//                                                not only the problems
//         npm run tablecheck -- --path <file>    check one file instead of the
//                                                tracked *.md set. Accepts an
//                                                absolute path, so a fixture
//                                                outside the repo can be used
//                                                for the failure proof.
//         npm run tablecheck -- --strict         exit 1 if any BROKEN TABLE was
//                                                found. FOR THE FIXTURE PROOF
//                                                ONLY. Never put this in a gate.
// Zero dependencies; Node core only.
//
// ─── THE TWO RULES, AND WHY ONE OF THEM IS DELIBERATELY OVER-BROAD ───────────
//
// RULE 1 — BROKEN TABLE. A header-separator row (`|---|---|`) followed by
//   content that is NEITHER a table row NOR blank — a blockquote, a paragraph, a
//   heading. This is the real defect and the one the script was written for: the
//   table stops after its header AND the rows that were meant to be its body are
//   orphaned below the interloper.
//
//   ⚠ "SEPARATOR FOLLOWED BY A BLANK LINE" IS *NOT* RULE 1, AND THE FIRST DRAFT
//   GOT THIS WRONG. A header row plus a separator plus nothing is a valid,
//   intentional HEADER-ONLY table; it renders as a one-row table and loses no
//   content. The first full-repo run reported 192 of them — **every one in
//   `docs/RoofMiles_Security_Audit_May2026.md`, and every one the same Word-export
//   idiom** (each two-cell fact written as its own header-plus-separator block).
//   Read, not assumed: they render exactly as the document has always rendered.
//   ⚠ **THIS IS A NARROWING, SO IT IS STATED RATHER THAN SILENTLY APPLIED, and
//   what it stopped covering is recorded: rule 1 no longer reports a header-only
//   table.** Those are counted separately as HEADER-ONLY below so the number
//   stays visible instead of disappearing — a check whose coverage shrank
//   quietly is the thing this project keeps getting hurt by.
//
// RULE 2 — BLOCKQUOTE BEFORE TABLE. A table row whose previous non-blank line
//   starts with `>`. ⚠ THIS IS OVER-BROAD AND IT IS KEPT THAT WAY ON PURPOSE.
//   A blockquote, then a BLANK line, then a table header is perfectly valid and
//   renders correctly — and section 10 now has exactly that shape, so this rule
//   reports it every run. As of writing, rule 2 has produced ONE hit and it is
//   that false positive; it has never caught a real defect.
//
//   ⚠ SO WHY KEEP IT. Because the alternative is narrowing it until it reports
//   nothing, and then nobody can state what the script covers. A documented
//   false positive is honest: a reader sees the hit, reads this paragraph, and
//   knows the check's edge. A silently narrowed rule is a check whose coverage
//   is unknown, which is CLAUDE.md's "a mechanism that reports health it cannot
//   observe" — the failure this whole family of tools exists to avoid.
//   A TRUE positive for rule 2 would be a blockquote directly abutting a table
//   row with no blank line between them, which does swallow the row.
//   ⚠ Do not "fix" rule 2 by deleting it. If it is ever tuned, say in this
//   header what it stopped covering.
//
// ─── FAILURE MODE, STATED SO A PASS CAN BE TRUSTED ───────────────────────────
// Proven, not assumed, per CLAUDE.md ("state what it would look like when it
// FAILS, and prove it fails that way before trusting that it passes"):
//   scripts/fixtures/tablecheck-broken.md  -> must report BROKEN TABLE, exit 1
//                                             under --strict
//   scripts/fixtures/tablecheck-good.md    -> must report OK, exit 0
// Both fixtures are tracked. Re-run them after any change to this file.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const STRICT = argv.includes('--strict');
const pathIdx = argv.indexOf('--path');
const PATH_ARG = pathIdx !== -1 ? argv[pathIdx + 1] : null;

if (pathIdx !== -1 && !PATH_ARG) {
  console.error('tablecheck: --path requires a file argument');
  process.exit(2);
}

// ─── readLines(): the CRLF rule, stated once ─────────────────────────────────
// Split on /\r?\n/, never on '\n'. JavaScript's '.' does not match '\r', so a
// $-anchored regex silently no-ops on a CRLF line. With core.autocrlf=true (the
// Windows default) a tracked LF file becomes CRLF in the working tree the moment
// anyone runs `git checkout`, so this is not an exotic input.
function readLines(abs) {
  return fs.readFileSync(abs, 'utf8').split(/\r?\n/);
}

function git(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

// A separator row: starts with '|', contains at least one '-', and is built from
// nothing but pipes, dashes, colons and spaces.
function isSeparator(t) {
  if (!t.startsWith('|') || !t.includes('-')) return false;
  return t.replace(/[|\-: ]/g, '') === '';
}

// ⚠ scripts/fixtures/ IS EXCLUDED FROM THE DEFAULT WALK, AND MUST STAY EXCLUDED.
// tablecheck-broken.md contains a deliberately broken table — that is its whole
// job. Left in the default set it would report BROKEN TABLE on every run
// forever, and a check that is permanently red is a check that gets ignored,
// which is the defect this script's contract exists to prevent. The fixtures are
// reached with --path, which is how the failure proof is run.
const FIXTURE_DIR = 'scripts/fixtures/';

const files = PATH_ARG
  ? [PATH_ARG]
  : git('git ls-files "*.md"')
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((f) => !f.replace(/\\/g, '/').startsWith(FIXTURE_DIR));

const broken = [];
const headerOnly = [];
const quoted = [];
let tablesSeen = 0;

for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  let lines;
  try {
    lines = readLines(abs);
  } catch (err) {
    console.error(`tablecheck: cannot read ${f} — ${err.message}`);
    process.exit(2);
  }

  // Fenced code blocks are skipped entirely: a ```sql block can legitimately
  // contain a line of pipes and dashes, and flagging it would be noise that
  // teaches the reader to ignore real hits.
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    if (t.startsWith('```') || t.startsWith('~~~')) { inFence = !inFence; continue; }
    if (inFence) continue;

    if (isSeparator(t)) {
      tablesSeen++;
      // i + 1 may be past the end; readLines' trailing '' makes that a blank,
      // which is the HEADER-ONLY case, not a break.
      const next = (lines[i + 1] === undefined) ? '' : lines[i + 1].trim();
      if (VERBOSE) console.log(`  table  ${f}:${i + 1}`);
      if (next === '') {
        headerOnly.push({ f, line: i + 1 });
      } else if (!next.startsWith('|')) {
        broken.push({ f, line: i + 1, next });
      }
      continue;
    }

    if (t.startsWith('|')) {
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      if (j >= 0 && lines[j].trim().startsWith('>')) {
        quoted.push({ f, line: i + 1, blankBetween: j !== i - 1 });
      }
    }
  }
}

console.log('='.repeat(76));
console.log(`TABLE-CHECK — ${files.length} file(s), ${tablesSeen} table(s)`);
console.log('='.repeat(76));

if (broken.length) {
  console.log('\n' + '-'.repeat(76));
  console.log(`BROKEN TABLE — ${broken.length}. A separator row is not followed by a body row,`);
  console.log('so the table stops rendering after its header. THIS IS THE ONE TO ACT ON.');
  console.log('-'.repeat(76));
  for (const b of broken) {
    console.log(`  ${b.f}:${b.line}`);
    console.log(`      next line is: ${b.next.slice(0, 90) || '(blank)'}`);
  }
}

if (quoted.length) {
  console.log('\n' + '-'.repeat(76));
  console.log(`BLOCKQUOTE BEFORE TABLE — ${quoted.length}. Rule 2, which is DELIBERATELY`);
  console.log('over-broad; read this script\'s header before acting. A blockquote, a blank');
  console.log('line, then a table header is VALID and renders correctly.');
  console.log('-'.repeat(76));
  for (const q of quoted) {
    const note = q.blankBetween
      ? 'blank line between — almost certainly fine, this is the known false positive'
      : 'NO blank line between — this one can actually swallow the row';
    console.log(`  ${q.f}:${q.line}   ${note}`);
  }
}

if (headerOnly.length) {
  console.log('\n' + '-'.repeat(76));
  console.log(`HEADER-ONLY TABLE — ${headerOnly.length}. A separator followed by a blank line or`);
  console.log('EOF: a valid, intentional one-row table that loses no content. Informational,');
  console.log('and counted rather than hidden so rule 1\'s narrowing stays visible.');
  console.log('-'.repeat(76));
  const byFile = new Map();
  for (const h of headerOnly) byFile.set(h.f, (byFile.get(h.f) || 0) + 1);
  for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${file}`);
  }
}

if (!broken.length && !quoted.length && !headerOnly.length) console.log('\nOK — no findings.');

console.log('\n' + '='.repeat(76));
console.log(`TOTALS — BROKEN ${broken.length} · HEADER-ONLY ${headerOnly.length} · BLOCKQUOTE-BEFORE ${quoted.length}`);
console.log('END TABLE-CHECK');
console.log('='.repeat(76));

// ⚠ --strict EXISTS FOR THE FIXTURE PROOF AND NOTHING ELSE. Without it this
// script always exits 0, which is the "IT PRINTS" contract at the top. Do not
// add it to a gate, a hook, or npm test. It gates on BROKEN only: rule 2's
// documented false positive would otherwise make --strict permanently red on
// this repo, which is the exact defect the contract exists to prevent.
if (STRICT && broken.length) process.exit(1);
