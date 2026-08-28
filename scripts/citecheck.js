#!/usr/bin/env node
'use strict';

// ─── citecheck.js — file:line citations in the records, checked against source ─
//
// WHY THIS EXISTS. The cleanup arc reconciled documents against documents,
// against the filesystem, and against the production database. It never
// reconciled documents against SOURCE CODE, because no tool did that. A wrong
// path survived in two governing documents for months — copied forward each
// time rather than re-derived — because the path was ALMOST right and nothing
// ever resolved it. This closes that hole mechanically instead of by attention.
//
// IT PRINTS. It does not assert, it never exits non-zero on a finding, and it
// must never be wired into a build or a test gate. A tripwire set to the wrong
// number is exactly the false-health defect CLAUDE.md's Test Design section
// warns about. This tool's job is to make citation rot cheap to SEE, not to
// have an opinion about it. (`--strict` exists for the fixture proof only and
// is documented at the flag itself.)
//
// It WALKS the tracked file list. It does not iterate a hand-maintained FILES
// list — that is the defect recorded against the brand sweep, where new files
// were invisible until someone remembered them and nothing announced it.
//
// Usage:  npm run citecheck
//         npm run citecheck -- --verbose         every hit, not just problems
//         npm run citecheck -- --path <glob-ish> scan something other than
//                                                tracked *.md (opt-in; the
//                                                .docx handoffs are untracked)
//         npm run citecheck -- --strict          exit 1 if any problem found.
//                                                FOR THE FIXTURE PROOF ONLY.
//                                                Never put this in a gate.
// Zero dependencies; Node core only.
//
// ─── WHAT THE FIVE VERDICTS MEAN ─────────────────────────────────────────────
//   FILE_MISSING  the cited path resolves to nothing tracked. A real defect.
//   AMBIGUOUS     a bare filename matching MORE THAN ONE tracked file. The
//                 citation names no single thing; a reader resolves it by
//                 guessing. This is CLAUDE.md's substring hazard ("a needle
//                 that is a substring of a longer real name passes against the
//                 wrong line") applied to citations.
//   PAST_EOF      the line number exceeds the file's length. A real defect.
//   STALE         the cited file's last commit is NEWER than the citing
//                 document's last commit. A SUSPICION, NOT A DEFECT — most
//                 stale citations are perfectly fine. See below.
//   OK            resolves, in range, and the citing document is no older than
//                 the file it cites.
//
// ─── ⚠ STALE IS LOAD-BEARING HERE, NOT A SOFT SIGNAL ─────────────────────────
// The original design note called STALE the weakest of the checks. Measuring it
// against the two known-rotted citations inside TENANT_RESOLUTION_REBUILD_SPEC.md
// (admin/index.js:66-67, truly :103-106; auth.js:11-32, truly :45-70) shows the
// opposite: NEITHER is FILE_MISSING and NEITHER is PAST_EOF. Both paths resolve
// and both line numbers still exist — they simply point at different code than
// the document describes. STALE is the ONLY verdict that can see them.
//
// That is the whole class this script exists for, and the one a human reader
// cannot detect by looking: a rotted line number is visually identical to a
// correct one. The cost of STALE being load-bearing is a high false-positive
// rate, which is why it prints a suspicion and never a failure.
//
// ⚠ AND STALE HAS A FALSE-NEGATIVE MODE THAT IS WORSE THAN ITS FALSE
// POSITIVES: ANY EDIT TO A DOCUMENT, FOR ANY REASON, CLEARS EVERY STALENESS
// SIGNAL INSIDE IT. The timestamp is per-FILE, not per-line, so touching one
// paragraph resets the clock on every citation in the document.
//
// Two measured instances, both found while proving this script:
//
//   1. The Phase 1 commit that ADDED the "both line citations have rotted"
//      marker to TENANT_RESOLUTION_REBUILD_SPEC.md also made that document
//      newer than the files it cites. At c2434d2^ both citations report STALE;
//      at c2434d2 both report OK. The act of documenting the rot hid it.
//
//   2. `admin/contacts.js:891` is cited in FIVE places, including CLAUDE.md.
//      The `is_archived = false` predicate it names was REMOVED on 2026-08-24
//      and line 891 is now blank. All five report OK, because CLAUDE.md and
//      PRE_LAUNCH_CHECKLIST.md are edited constantly.
//
// ⚠ THE DOCUMENTS MOST LIKELY TO BE EDITED ARE EXACTLY THE ONES WHERE STALE
// CANNOT HELP — and those are the governing documents. A clean STALE result
// for CLAUDE.md means "CLAUDE.md was edited recently", nothing more. Read a
// LOW stale count on a hot document as no evidence at all, never as health.
//
// ─── ⚠ WHAT THIS SCRIPT CANNOT SEE — read this before trusting a clean run ───
//
// 1. A WRONG RANGE INSIDE A FILE THAT RESOLVES. This is the big one, and it is
//    the exact defect that motivated the script. The records said
//    `permissions.js:48-50` when the truth is
//    `server/middleware/permissions.js:49-51`. Bare `permissions.js` resolves
//    uniquely, and lines 48-50 exist in a 108-line file — so this tool reports
//    OK. ⚠ THE LITERAL STRING `server/permissions/permissions.js` NEVER
//    APPEARED IN ANY DOCUMENT; it was an inference about what the bare citation
//    implied. Do not expect this script to have caught it. ⚠ MEASURED at
//    c2434d2^: all three permissions.js citations report OK, including the
//    wrong one. Not STALE either — both citing documents had been edited more
//    recently than permissions.js. THE SCRIPT WOULD NOT HAVE FOUND THE DEFECT
//    IT WAS BUILT AFTER. It closes the neighbouring hole (a path that resolves
//    to nothing, a line past EOF, a name meaning two files), not that one.
//
// 2. ANY CLAIM THAT IS NOT A file:line CITATION. `npm test --
//    --test-concurrency=1` was a live wrong instruction in the plan of record
//    for months. It names no file and carries no line number, so nothing here
//    reaches it. Prose claims need a reader.
//
// 3. WHETHER THE SENTENCE IS TRUE. A citation can resolve, be in range, be
//    newer than the file, and still describe behaviour that was removed. This
//    is "sweep by value and you will miss the claim" — the eleven inverted
//    records that survived ABR Phase 5 contained no retired literal at all.
//
// 4. UNTRACKED FILES. The .docx handoffs are untracked by design
//    (EXECUTION_SEQUENCE.md §5), so citations inside them are invisible unless
//    you point --path at them, and they are not plain text anyway.
//
// 5. SECTION POINTERS. `→ CDL_3b_BUILD_SPEC.md §10` is a citation a human
//    resolves and this tool ignores. Section pointers are how the well-behaved
//    records cite each other, precisely because they do not rot.
//
// ─── ⚠ AND A NOTE ON PROVING THIS SCRIPT WORKS ───────────────────────────────
// When you write a control for a change here, MAKE SURE THE CONTROL ACTUALLY
// INJECTS. In Phase 1 of this same wave, a bundle-hash control used an unused
// module-scope `const` as its probe; it was tree-shaken, moved no hash, and
// looked EXACTLY like a clean run. That is the fifth recorded instance of "a
// guard-proof that comes back green is a broken proof, not a passing one," and
// the first on a build artifact. The replacement probe changed a rendered
// string, which cannot be eliminated, and moved the hash immediately.
// Whoever next writes a control for THIS script will reach for the same
// unused-const shape. Prefer a probe whose effect is observable in the output.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const STRICT = argv.includes('--strict');
const pathIdx = argv.indexOf('--path');
const PATH_ARG = pathIdx !== -1 ? argv[pathIdx + 1] : null;
// --grep <substring>: print the verdict for every citation whose text contains
// <substring>, INCLUDING OK ones. Needed because OK findings are otherwise
// never printed by name, so "what does this tool say about THIS citation?" had
// no answer — a reader could only infer OK from an absence, which is precisely
// the reasoning this project keeps getting bitten by.
const grepIdx = argv.indexOf('--grep');
const GREP = grepIdx !== -1 ? argv[grepIdx + 1] : null;

// ─── EXTENSIONS THAT MAKE A `thing:NNN` A CITATION ───────────────────────────
// An allow-list, not a deny-list, and that is what makes the hazard handling
// fail CLOSED. `4.5:1`, `1.67:1`, `3.06:1` and `13.71:1` are contrast ratios
// that appear all over the accessibility records; a deny-list would need to
// anticipate every one of them, while an allow-list simply never sees `.5` or
// `.67` as an extension. Same for timestamps (`02:00` has no extension at all)
// and version strings.
const CITED_EXTS = ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'md', 'json', 'css', 'sql', 'csv', 'yml', 'yaml', 'sh'];

// path/to/file.ext:NNN, :NNN-MMM, or :NNN,MMM — with optional further groups.
// The leading char class deliberately excludes backticks, asterisks, quotes,
// parentheses and whitespace, so a citation wrapped in `code` or **bold** or a
// markdown table cell yields the path and not the decoration.
const CITE_RE = new RegExp(
  '([A-Za-z0-9_.\\-/]+\\.(?:' + CITED_EXTS.join('|') + '))' +   // 1: path
  ':(\\d+(?:\\s*[-–]\\s*\\d+)?(?:\\s*,\\s*\\d+(?:\\s*[-–]\\s*\\d+)?)*)', // 2: line spec
  'g'
);

// ─── readLines(): the CRLF rule, stated once ─────────────────────────────────
// Split on /\r?\n/, never on '\n'. JavaScript's '.' does not match '\r', so a
// $-anchored regex silently no-ops on a CRLF line — the match simply fails and
// the code carries on with unstripped text. With core.autocrlf=true (the
// Windows default) a tracked LF file becomes CRLF in the working tree the
// moment anyone runs `git checkout`, so this is not an exotic input: it is what
// made five guards all report PASS on a corpse in Wave 0.1.
// This repo now pins eol=lf in .gitattributes, which means the bug CANNOT
// currently reproduce here — and that is exactly why the tolerant split stays.
// It costs one character and it is the fence around the day someone unpins it.
// ⚠ THE TRAILING-NEWLINE OFF-BY-ONE, AND IT WAS FOUND BY THE FIXTURE.
// A file ending in a newline — nearly all of them — splits into one MORE
// element than it has lines, the last being ''. The first version of this
// script reported sessionPolicy.js as 97 lines (true: 96) and permissions.js
// as 109 (true: 108). That made PAST_EOF one line too LENIENT: a citation
// pointing exactly one past the end would have read as in-range. Dropping the
// trailing empty element is what makes the length the file's real length.
function readLines(abs) {
  const parts = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// ─── git plumbing ────────────────────────────────────────────────────────────
function git(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return fallback;
  }
}

// Last-commit timestamp for EVERY tracked path, from ONE git call.
// A per-file `git log -1` would be ~200 process spawns; this is one walk of
// history. Map holds the FIRST (newest) time seen per path, since git log emits
// newest-first.
function buildLastCommitMap() {
  const map = new Map();
  const raw = git('git log --format=@%ct --name-only --no-renames');
  if (!raw) return map;
  let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('@')) { cur = Number(line.slice(1)); continue; }
    if (!line || cur === null) continue;
    if (!map.has(line)) map.set(line, cur);
  }
  return map;
}

// ─── the tracked-file index, and the suffix resolver ─────────────────────────
// ⚠ THE BARE-FILENAME CONVENTION IS WHY THIS RESOLVER EXISTS. 81 of the 130
// distinct cited paths in this repo do NOT resolve from the repo root:
// `account.js:436`, `team.js:555`, `admin/referrers.js:78`. Every one is a real
// citation that a human resolves by convention. Resolving only from root would
// report all 81 as FILE_MISSING and drown the real findings — a check whose
// noise floor is above its signal is not a check.
//
// So: exact path first, then a UNIQUE suffix match on a path boundary. A suffix
// matching more than one tracked file is AMBIGUOUS, not resolved — reporting
// the first match would be the substring trap, picking a real file that is
// entirely the wrong one.
const trackedFiles = git('git ls-files').split(/\r?\n/).filter(Boolean);
const trackedSet = new Set(trackedFiles);

const suffixIndex = new Map(); // basename -> [full tracked paths]
for (const f of trackedFiles) {
  const base = f.slice(f.lastIndexOf('/') + 1);
  if (!suffixIndex.has(base)) suffixIndex.set(base, []);
  suffixIndex.get(base).push(f);
}

function resolveCitation(cited) {
  if (trackedSet.has(cited)) return { mode: 'exact', matches: [cited] };
  const base = cited.slice(cited.lastIndexOf('/') + 1);
  const candidates = suffixIndex.get(base) || [];
  // Match on a path BOUNDARY: `index.js` must not match `admin/index.js` via a
  // raw endsWith, and `contacts.js` must not match `admin/contacts.js` unless
  // the citation actually said so.
  const hits = candidates.filter((f) => f === cited || f.endsWith('/' + cited));
  return { mode: hits.length === 1 ? 'suffix' : (hits.length ? 'ambiguous' : 'missing'), matches: hits };
}

// ─── the URL hazard — MASKED BEFORE MATCHING, not tested after ───────────────
// `http://localhost:3000` and `https://host:443/path` both carry `:NNN`. The
// extension allow-list already rejects those (there is no `.js` before the
// colon in `localhost:3000`), but a URL CAN legitimately end in a code
// extension — `https://cdn.example.com/app.js:12` — so this is a real second
// gate, not a belt on an existing brace.
//
// ⚠ THE FIRST IMPLEMENTATION LOOKED BACKWARD FROM THE MATCH AND FAILED.
// It tested the preceding text for /https?:\/\/\S*$/ — but `/` and `.` are in
// the path char class, so CITE_RE had already SWALLOWED the `//`, matching
// `//cdn.example.com/app.js:12` and leaving only `https:` behind it. The
// lookbehind could never see the `//` because the match had eaten it. The
// fixture caught this; reading the regex did not.
//
// Masking the URL out of the line before matching cannot fail that way: there
// is nothing left for CITE_RE to match against. Replaced with spaces rather
// than deleted so every match index still lines up with the original line.
const URL_RE = /https?:\/\/\S+/g;
const maskUrls = (line) => line.replace(URL_RE, (u) => ' '.repeat(u.length));

// ⚠ WINDOWS DRIVE LETTERS. `C:\Users\...` cannot match CITE_RE — a drive letter
// is a single char with no dot-extension before the colon, and backslashes are
// outside the path char class. But a POSIX-ised Windows path pasted into a doc
// (`C:/Users/stacy/x.js:12`) WOULD match, and would then resolve as missing.
// That is the correct outcome: it is not a repo-relative citation.

// ─── collect the documents to scan ───────────────────────────────────────────
// DEFAULT: tracked *.md only. The .docx handoffs are untracked by design and
// are not plain text; --path is the opt-in for anything else.
let docs;
if (PATH_ARG) {
  const abs = path.resolve(ROOT, PATH_ARG);
  if (!fs.existsSync(abs)) {
    console.error(`citecheck: --path does not exist: ${PATH_ARG}`);
    process.exit(2);
  }
  if (fs.statSync(abs).isDirectory()) {
    const out = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name)) walk(path.join(d, e.name)); }
        else if (e.name.endsWith('.md')) out.push(path.join(d, e.name));
      }
    })(abs);
    docs = out;
  } else {
    docs = [abs];
  }
} else {
  docs = trackedFiles.filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, f));
}

// ─── scan ────────────────────────────────────────────────────────────────────
const lastCommit = buildLastCommitMap();
const findings = [];
let scanned = 0;

for (const absDoc of docs) {
  const relDoc = path.relative(ROOT, absDoc).split(path.sep).join('/');
  const docTime = lastCommit.get(relDoc) ?? null;
  let lines;
  try { lines = readLines(absDoc); } catch { continue; }

  lines.forEach((rawLine, i) => {
    const line = maskUrls(rawLine);
    CITE_RE.lastIndex = 0;
    let m;
    while ((m = CITE_RE.exec(line)) !== null) {
      const [full, citedPath, lineSpec] = m;
      scanned++;

      const res = resolveCitation(citedPath);
      const rec = {
        doc: relDoc, docLine: i + 1, cited: citedPath, lineSpec,
        raw: full, target: res.matches[0] || null, mode: res.mode,
        matches: res.matches,
      };

      if (res.mode === 'missing')   { findings.push({ ...rec, verdict: 'FILE_MISSING' }); continue; }
      if (res.mode === 'ambiguous') { findings.push({ ...rec, verdict: 'AMBIGUOUS' });    continue; }

      // PAST_EOF — check the HIGHEST number in the spec against the file length.
      const target = res.matches[0];
      let len = 0;
      try { len = readLines(path.join(ROOT, target)).length; } catch { /* unreadable */ }
      const nums = lineSpec.match(/\d+/g).map(Number);
      const maxNum = Math.max(...nums);
      if (len && maxNum > len) {
        findings.push({ ...rec, verdict: 'PAST_EOF', fileLen: len, maxNum });
        continue;
      }

      // STALE — the cited file moved after the citing document last did.
      // Self-citations (a document citing itself) are excluded: the two
      // timestamps are the same commit by construction, and a document is never
      // stale about itself in the sense this check means.
      const tgtTime = lastCommit.get(target) ?? null;
      if (target !== relDoc && docTime !== null && tgtTime !== null && tgtTime > docTime) {
        findings.push({ ...rec, verdict: 'STALE', docTime, tgtTime });
        continue;
      }

      findings.push({ ...rec, verdict: 'OK' });
    }
  });
}

// ─── report ──────────────────────────────────────────────────────────────────
const head = git('git rev-parse --short HEAD', 'unknown');
const today = new Date().toISOString().slice(0, 10);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

const by = (v) => findings.filter((f) => f.verdict === v);
const missing = by('FILE_MISSING'), ambiguous = by('AMBIGUOUS');
const pastEof = by('PAST_EOF'), stale = by('STALE'), ok = by('OK');

console.log('='.repeat(76));
console.log(`CITE-CHECK — ${today}, HEAD ${head}`);
console.log('='.repeat(76));
console.log(`Scanned ${docs.length} document(s); found ${scanned} file:line citation(s).`);
console.log('IT PRINTS. It asserts nothing and is wired to no gate, by design.');
console.log('⚠ STALE is a SUSPICION, not a defect — most stale citations are fine. It is');
console.log('  nonetheless the ONLY check that can see a rotted line number, which is the');
console.log('  one class a human reader cannot detect by looking. Read the header.');

function dump(label, rows, note, extra) {
  console.log('\n' + '-'.repeat(76));
  console.log(`${label} — ${rows.length}`);
  if (note) console.log(note);
  console.log('-'.repeat(76));
  if (!rows.length) { console.log('  (none)'); return; }
  // Two lines per finding rather than padEnd(). A --path run outside the repo
  // produces doc paths far longer than any column width, and the first version
  // ran the citation straight into the path with no separator at all.
  for (const r of rows) {
    console.log(`  ${r.raw}${extra ? extra(r) : ''}`);
    console.log(`      cited at ${r.doc}:${r.docLine}`);
  }
}

dump('FILE_MISSING — path resolves to nothing tracked', missing,
  '  A real defect. The cited file does not exist under that name.');

dump('AMBIGUOUS — bare filename matching more than one tracked file', ambiguous,
  '  The citation names no single thing; a reader resolves it by guessing.',
  (r) => `   → ${r.matches.length} matches: ${r.matches.slice(0, 3).join(', ')}${r.matches.length > 3 ? ', …' : ''}`);

dump('PAST_EOF — line number exceeds the file length', pastEof,
  '  A real defect.', (r) => `   → ${r.target} has ${r.fileLen} lines, cited ${r.maxNum}`);

if (VERBOSE) {
  dump('STALE — cited file committed after the citing document', stale,
    '  SUSPICION ONLY. Most are fine. Full list because --verbose was passed.',
    (r) => `   → ${r.target} ${iso(r.tgtTime)} > doc ${iso(r.docTime)}`);
} else {
  console.log('\n' + '-'.repeat(76));
  console.log(`STALE — cited file committed after the citing document — ${stale.length}`);
  console.log('  SUSPICION ONLY. Grouped by document; pass --verbose for every line.');
  console.log('-'.repeat(76));
  const byDoc = new Map();
  for (const s of stale) byDoc.set(s.doc, (byDoc.get(s.doc) || 0) + 1);
  const rows = [...byDoc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const w = rows.reduce((m, r) => Math.max(m, r[0].length), 0);
  for (const [d, n] of rows) console.log(`  ${d.padEnd(w)}  ${String(n).padStart(4)}`);
  if (!rows.length) console.log('  (none)');
}

if (GREP) {
  const hits = findings.filter((f) => f.raw.includes(GREP) || f.cited.includes(GREP));
  console.log('\n' + '-'.repeat(76));
  console.log(`--grep "${GREP}" — every matching citation WITH ITS VERDICT, OK included — ${hits.length}`);
  console.log('-'.repeat(76));
  if (!hits.length) console.log('  (no citation matched)');
  for (const h of hits) {
    let why = '';
    if (h.verdict === 'STALE') why = `  (${h.target} ${iso(h.tgtTime)} > doc ${iso(h.docTime)})`;
    if (h.verdict === 'PAST_EOF') why = `  (${h.target} has ${h.fileLen} lines)`;
    if (h.verdict === 'OK' && h.tgtTimeSeen) why = '';
    console.log(`  ${h.verdict.padEnd(13)} ${h.raw}${why}`);
    console.log(`      → resolves to ${h.target || '(nothing)'} [${h.mode}]`);
    console.log(`      → cited at ${h.doc}:${h.docLine}`);
  }
}

console.log('\n' + '-'.repeat(76));
console.log('RESOLUTION MODE — how the path was found');
console.log('-'.repeat(76));
const exactN = findings.filter((f) => f.mode === 'exact').length;
const suffixN = findings.filter((f) => f.mode === 'suffix').length;
console.log(`  exact path from repo root            ${String(exactN).padStart(4)}`);
console.log(`  resolved by UNIQUE suffix match      ${String(suffixN).padStart(4)}`);
console.log(`  ambiguous / unresolved               ${String(ambiguous.length + missing.length).padStart(4)}`);
console.log('  ⚠ The suffix bucket is the bare-filename convention (`team.js:555`). It is');
console.log('    legitimate and dominant here — but a bare name is also what let a WRONG');
console.log('    path live in two governing documents unnoticed, because there was never');
console.log('    a full path to be wrong about. Prefer repo-relative paths in new records.');

console.log('\n' + '='.repeat(76));
console.log(`TOTALS — OK ${ok.length} · STALE ${stale.length} · AMBIGUOUS ${ambiguous.length} · PAST_EOF ${pastEof.length} · FILE_MISSING ${missing.length}`);
console.log(`END CITE-CHECK — ${today}, HEAD ${head}`);
console.log('='.repeat(76));

// ⚠ --strict EXISTS FOR THE FIXTURE PROOF AND NOTHING ELSE. Without it this
// script always exits 0, which is the "IT PRINTS" contract at the top. Do not
// add it to a gate, a hook, or npm test: the correct real-repo output has a
// large STALE count and a nonzero AMBIGUOUS count, so a gate on this would be
// permanently red and would be silenced within a week.
if (STRICT && (missing.length || pastEof.length || ambiguous.length)) process.exit(1);
