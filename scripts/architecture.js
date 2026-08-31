#!/usr/bin/env node
'use strict';

// ─── architecture.js — generated folder structure for docs/ARCHITECTURE.md ────
//
// WHY THIS EXISTS. docs/ARCHITECTURE.md's two folder-structure blocks were
// hand-maintained and had drifted by 30 files and 11 directories — including
// server/utils/sessionPolicy.js, which CLAUDE.md's session non-negotiable cites
// BY NAME as the one place the session numbers live. The rules pointed at a file
// the map did not list.
//
// The document carried its own check for exactly this, in its "Periodic Code
// Health Checklist". ⚠ It is NOT mis-pointed today — ff81b48 (ABR 6A commit 1)
// repointed it from "CLAUDE.md's folder structure" to "this file's". For its
// whole life before that it named a file that no longer held the structure,
// from inside the file that did, so anyone who ran it found nothing and could
// not tell "not applicable" from "not done". It has never run. This script
// replaces a correct-but-manual instruction with an automated one; the drift it
// would have caught is the reason generation beats vigilance.
// See CLAUDE.md, Test Design — "A mechanism that reports health it cannot
// observe is worse than no mechanism."
//
// It WALKS THE TREE via scripts/lib/fsWalk.js, shared with sizing.js. It never
// iterates a hand-maintained FILES list — that is the defect recorded against
// the brand sweep, where new files were invisible until someone remembered them
// and nothing announced the omission.
//
// ─── ⚠ IT WRITES, AND THAT IS WHY IT ASSERTS ─────────────────────────────────
// sizing.js's header says "IT PRINTS ... it does not exit non-zero". This script
// deliberately departs from that, and the difference is not an inconsistency to
// be tidied away. sizing.js failing means a wrong number on a screen. This one
// failing means a corrupted tracked document, or 104 hand-written annotations
// silently deleted. A writer needs a fail-closed guard where a printer needs
// none. Concretely:
//   --check  NEVER exits non-zero and NEVER writes. It reports drift and stops.
//            It is not wired into any build or test gate, for sizing.js's reason.
//   --write  exits non-zero and writes NOTHING if any blocking guard fails.
//            Refusing is the success case there.
//
// ─── ⚠ THE SIX GUARDS, AND WHICH ONES ARE REAL ──────────────────────────────
// 0. GUARD 6 (PATH SANITY) was added in Phase 2 after proof P4 exposed a CRLF
//    parse failure that guards 1-5 ALL reported PASS through. Read its comment
//    at the parse site before trusting any of the others. The lesson is in the
//    header of the read: guards agreeing with each other is not evidence when
//    they share a parse.
// 1. THE ARROW AUDIT is the real guard against parser under-recognition.
//    H1 below counts annotations IN and OUT, and BOTH numbers come from the
//    parser. If the parser fails to RECOGNISE an
//    annotation line, that line never enters the IN count — not carried, not
//    quarantined, not counted as lost. in == out, conservation passes, and the
//    annotation is silently gone. H1 structurally cannot observe its own
//    parser's under-recognition; it reports health in exactly the population it
//    exists to protect. The audit is an INDEPENDENT observer with a
//    DELIBERATELY BROADER needle than the parser's: any line inside a region
//    carrying an arrow-like mark that the parser did not turn into an
//    annotation is UNRECOGNISED, and the run refuses. ⚠ If you ever narrow
//    ARROW_NEEDLE to match the parser, you have deleted the guard and left
//    something that looks like one.
// 2. THE CONSERVATION COUNT (H1) catches loss BETWEEN parse and emit — a
//    duplicate annotated path collapsing in the Map, an annotation spanning
//    lines. Real, but narrower than it looks.
// 3. ANNOTATION_BASELINE is a TRIPWIRE, not a mechanism. It pins the known
//    annotation count so an unexplained change cannot pass unnoticed.
//    ⚠ IT WILL FIRE THE FIRST TIME SOMEONE LEGITIMATELY ADDS AN ANNOTATION,
//    and the cheapest move at that moment is to bump the number without
//    thinking — which converts the guard into a rubber stamp. THE RULE:
//    this number is updated ONLY in the same commit that deliberately changes
//    the annotation set, and THE COMMIT MESSAGE MUST SAY SO. The friction is
//    the point; these are the most valuable lines in the document and a
//    filesystem walk cannot reproduce them.
//    Do not mistake the tripwire (3) for the mechanism (1).
//    ⚠ THERE IS NO OVERRIDE FLAG, DELIBERATELY. An earlier draft carried
//    --baseline for "proof-only" use. It was deleted: a documented bypass is
//    still a bypass, and "proof-only" is a convention, not a mechanism. If you
//    find yourself wanting one, the honest move is to change the constant in a
//    commit that says why.
//
// ─── GUARDS DO NOT SHORT-CIRCUIT ─────────────────────────────────────────────
// All six guards are EVALUATED, all findings COLLECTED, a complete report
// PRINTED, and only then is the write refused once, at the end, as a single AND
// across all six. A run that aborted at the first failure would hide the
// others — and the pressure that creates is exactly what makes someone reach
// for a bypass flag.
// ⚠ Marker integrity is the one exception: with no valid region there is
// nothing to parse, so guards 2-6 CANNOT run. They are then reported as
// NOT EVALUATED — never as passing. Printing PASS for a guard that did not
// execute is the false-health defect verbatim.
//
// ─── WHAT IT CANNOT SEE ──────────────────────────────────────────────────────
// It lists files. It says NOTHING about whether a file is correctly described,
// whether the "←" annotation beside it is still true, or whether the prose
// around the block is accurate. A clean --check means the listing matches the
// filesystem, and means nothing whatsoever about the document being right.
//
// ─── NOT COVERED BY THIS SCRIPT ──────────────────────────────────────────────
//   - TEST FILES (.test.js / .test.jsx, and everything under server/test/).
//     Excluded because the blocks are a reader's map of the production surface;
//     117 test paths would bury it. The count is PRINTED on every run, so the
//     exclusion is announced rather than silent.
//   - ASSET AND BINARY FILES (.png, .woff2, .txt). Excluded because a byte blob
//     tells a reader nothing its filename does not. Also printed every run.
//     ⚠ src/index.css is NOT in this category. It is a source file and the theme
//     engine work makes it load-bearing, so .css is on the allowlist and
//     index.css IS listed. Do not "tidy" it into the asset denylist.
//   - ROUTE MOUNT COUNTS. ARCHITECTURE.md claimed "all 9 app.use() mounts"
//     against 13 real route mounts. That sentence was rewritten to carry no
//     number rather than a corrected one, because an un-generated count is a
//     lower bound that decays. Enumerating mounts from server/app.js is a
//     candidate for v2; it is deliberately not attempted here.
//   - WHETHER AN ANNOTATION IS TRUE. Annotations are carried, never validated.
//   - DIRECTORIES HOLDING ZERO LISTED FILES. Suppressed from the tree, because
//     an empty-looking directory is indistinguishable from a genuinely empty
//     one. Every suppressed directory is printed BY NAME on every run and named
//     in the note beneath the blocks — the absence is announced, never silent.
//     ⚠ server/test/ can NEVER reappear by adding a file: its exclusion is
//     PATH-based (isTestPath), not extension-based, so every file under it is
//     excluded whatever its extension. The asset directories are the opposite —
//     extension-based, so a .js file dropped into src/assets/ DOES bring the
//     directory back. Proof P11 covers both halves.
//
// Usage:  npm run architecture -- --check     report drift, write nothing
//         npm run architecture                rewrite the generated blocks
//         (add --file <path> to target a copy instead of docs/ARCHITECTURE.md)
// Zero dependencies; Node core only.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { walkTree } = require('./lib/fsWalk');

const ROOT = path.resolve(__dirname, '..');

// ─── policy ──────────────────────────────────────────────────────────────────
// An ALLOWLIST governs what gets listed, not a denylist: a new extension
// appearing in the repo must not silently join the map. ASSET_EXTS is the
// second half — an extension in neither set is reported as UNCLASSIFIED and
// printed loudly, because a silent drop is the FILES-list defect in miniature.
const CODE_EXTS = new Set(['.js', '.jsx', '.mjs', '.css', '.md']);
const ASSET_EXTS = new Set(['.png', '.woff2', '.txt']);

const isTestPath = (p) => p.includes('.test.') || p.startsWith('server/test/');

// The parser recognises exactly one annotation delimiter: U+2190 LEFTWARDS
// ARROW. Everything else on a tree line is part of the name.
const ANNOTATION_CHAR = '←';

// ⚠ DELIBERATELY BROADER THAN THE PARSER. See "THE THREE GUARDS" above. This
// needle exists to catch lines the parser did NOT recognise, so it must match
// arrow-like marks the parser would ignore — other unicode arrows, and the
// ASCII forms. Narrowing this to ANNOTATION_CHAR removes the guard entirely.
const ARROW_NEEDLE = /[←→↔↚↠⇐⇒⇦⇨⟵⟶⬅⮕➜]|(?:^|\s)<-{1,2}(?=\s|$)|(?:^|\s)-{1,2}>(?=\s|$)/u;

// ─── ANNOTATION_BASELINE — a TRIPWIRE, not the mechanism ─────────────────────
// The hand-written annotation count per block, as measured on 2026-08-23 at
// HEAD 580f404. Asserted, never merely printed: a writer that silently accepts
// a changed count is how 104 irreplaceable lines leave without anyone noticing.
// ⚠ UPDATE THIS ONLY IN THE SAME COMMIT THAT DELIBERATELY CHANGES THE
// ANNOTATION SET, AND SAY SO IN THE COMMIT MESSAGE. Bumping it to make a run
// go green is the rubber-stamp failure this guard exists to prevent.
// There is no override flag. See "THE THREE GUARDS" in the header.
// frontend 50 → 51 on 2026-08-31 (C/DL-3c Phase 2a): ONE annotation added, on
// src/components/rep/RepSurface.jsx — the rep tree's new root and the first
// consumer of RepCapabilitiesContext. Deliberate, and the reason the guard fired
// is the reason it exists: it noticed. Nothing was removed; backend is untouched.
//
// frontend 51 → 53 on 2026-08-31 (C/DL-3c Phase 2b): TWO annotations added, on
// src/components/admin/AdminNoAccessScreen.jsx (Ruling A(i)'s empty state) and
// src/components/shared/SurfaceSwitcher.jsx (the owner/admin-rep's second
// destination). Deliberate; nothing removed; backend untouched. Second time this
// guard has fired on a real addition and second time it was right to.
// frontend 53 → 54 on 2026-08-31 (C/DL-3c Phase 2c): ONE annotation added, on
// src/components/auth/TeamAccessRevokedScreen.jsx — Ruling B's screen. The
// annotation says it is a SIBLING of FrozenAccountScreen rather than a variant,
// which is the one thing about that file a listing can usefully carry: the two
// screens are adjacent in the tree, look alike, and merging them would tell a
// person who just signed in that they cannot get in. Deliberate; nothing
// removed; backend untouched. THIRD consecutive phase this guard has fired on a
// real addition and third time it was right to.
const ANNOTATION_BASELINE = { backend: 54, frontend: 54 }; // 108 total

// ─── block definitions ───────────────────────────────────────────────────────
// TWO blocks, TWO marker pairs, deliberately never merged. The backend and
// frontend listings are non-adjacent, and the prose between them — the Database
// tables paragraph and its known-incomplete note — is load-bearing and must
// survive untouched. A single wide marker span would swallow it.
// arrowCol reproduces each block's existing annotation column, so carrying an
// annotation over leaves the line byte-identical and the diff stays reviewable.
// ⚠ PADDING IS A GLOBAL MINIMUM OF arrowCol, WITH A ONE-SPACE OVERFLOW for names
// too long to fit. ANY HAND-TUNED LOCAL ALIGNMENT WILL BE NORMALISED ON THE NEXT
// WRITE, AND THAT IS INTENDED, NOT A DEFECT. The migrations group was hand-set
// to column 42 to fit its own longest sibling; regeneration moved two of its
// three lines to 37 and 35. The annotation TEXT was byte-identical either way.
// Do not restore the hand alignment — it reverts silently on the next run, and
// do not build per-group alignment: that puts ad-hoc visual state into a tool
// whose entire value is that its output is reproducible.
const BLOCKS = [
  { id: 'backend', roots: ['server'], rootFiles: ['server.js'], arrowCol: 35 },
  { id: 'frontend', roots: ['src'], rootFiles: [], arrowCol: 36 },
];

const beginMark = (id) => `<!-- BEGIN GENERATED STRUCTURE: ${id} -->`;
const endMark = (id) => `<!-- END GENERATED STRUCTURE: ${id} -->`;

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const MODE = argv.includes('--check') ? 'check' : 'write';
const fileArgIdx = argv.indexOf('--file');
const TARGET = fileArgIdx >= 0 && argv[fileArgIdx + 1]
  ? path.resolve(ROOT, argv[fileArgIdx + 1])
  : path.join(ROOT, 'docs', 'ARCHITECTURE.md');

// ─── provenance ──────────────────────────────────────────────────────────────
let head = 'unknown';
try {
  head = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout, or git absent. The listing is still correct; only the
  // provenance line degrades. Never fail the run over this.
}
const today = new Date().toISOString().slice(0, 10);

// ─── classify(): split the disk walk into listed / excluded / unclassified ───
// Input: one block definition.
// Output: { files, dirs, suppressedDirs, tests, assets, unclassified }, all
// repo-relative POSIX paths, sorted.
//
// ⚠ DIRECTORY SUPPRESSION. A directory holding zero listed files (recursively)
// is NOT listed. A reader cannot distinguish an empty-looking directory from a
// genuinely empty one, and that ambiguity is worse than a clean absence —
// PROVIDED the absence is announced, which is why every suppressed directory is
// printed BY NAME at runtime and named in the note beneath the blocks.
// ⚠ ITS FAILURE MODE: if the listed-file predicate ever mis-classifies, a
// directory holding real code disappears from the document silently — the
// FILES-list defect with a new mechanism. Proof P11 exists for exactly this:
// drop a listed-extension file into a suppressed directory and it must reappear.
function classify(block) {
  const files = [];
  const dirs = [];
  const tests = [];
  const assets = [];
  const unclassified = [];
  for (const rootName of block.roots) {
    const abs = path.join(ROOT, rootName);
    if (!fs.existsSync(abs)) continue;
    dirs.push(rootName);
    const t = walkTree(abs, ROOT);
    dirs.push(...t.dirs);
    for (const f of t.files) {
      const ext = path.extname(f);
      if (isTestPath(f)) tests.push(f);
      else if (ASSET_EXTS.has(ext)) assets.push(f);
      else if (CODE_EXTS.has(ext)) files.push(f);
      else unclassified.push(f);
    }
  }
  for (const f of block.rootFiles) {
    if (fs.existsSync(path.join(ROOT, f))) files.push(f);
  }
  // A directory survives only if some LISTED file lives under it, at any depth.
  // Derived from `files` rather than from a second predicate, so suppression can
  // never disagree with listing about what counts.
  const holdsListed = (d) => files.some((f) => f.startsWith(`${d}/`));
  return {
    files: files.sort(),
    dirs: dirs.filter(holdsListed).sort(),
    suppressedDirs: dirs.filter((d) => !holdsListed(d)).sort(),
    tests: tests.sort(),
    assets: assets.sort(),
    unclassified: unclassified.sort(),
  };
}

// ─── parseBlock(): pull paths + annotations out of an existing rendered block ─
// Input: the lines inside one marker region, quarantine lines already filtered.
// Output: { entries: [{path, isDir}], annotations: Map(path -> "← text"),
//           duplicatePaths }
// Depth comes from the box-drawing prefix; a bare trailing-slash line sets the
// implicit root ("server/"), and a bare non-slash line is a repo-root file.
const TREE_RE = /^((?:(?:│   |    ))*)(?:├── |└── )(.+)$/;

// `recognised` collects the INDEX of every line this parser turned into an
// annotation, indexed against the array passed in. The arrow audit subtracts
// that set from the set of lines carrying an arrow-like mark; the difference is
// what the parser failed to see. Returning indices rather than a count is what
// makes the audit independent — a count would come from the parser too.
function parseBlock(lines) {
  const entries = [];
  const annotations = new Map();
  const recognised = new Set();
  const stack = [];
  let implicitRoot = null;
  let duplicatePaths = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    // Quarantine lines are parsed by parseQuarantine(), not here. Skipped by
    // index so the audit still sees them as accounted for.
    if (raw.startsWith('>')) { recognised.add(idx); continue; }
    // The stamp is generator-owned, matched by its exact shape, and carries no
    // annotation. Recognised so the arrow audit does not fire on its "-->".
    if (STAMP_RE.test(raw)) { recognised.add(idx); continue; }
    const m = raw.match(TREE_RE);
    let full;
    let isDir;
    let body;
    if (m) {
      const depth = m[1].length / 4;
      body = m[2];
      stack.length = depth;
      let name = body.replace(/\s+←.*$/, '').trim();
      isDir = name.endsWith('/');
      if (isDir) name = name.slice(0, -1);
      stack[depth] = name;
      full = [implicitRoot, ...stack.slice(0, depth + 1)].filter(Boolean).join('/');
    } else {
      body = raw;
      const bare = raw.replace(/\s+←.*$/, '').trim();
      if (!bare || bare === '```') continue;
      if (bare.endsWith('/')) {
        implicitRoot = bare.slice(0, -1);
        stack.length = 0;
        full = implicitRoot;
        isDir = true;
      } else {
        full = bare;
        isDir = false;
      }
    }
    entries.push({ path: full, isDir });
    const arrow = body.indexOf(ANNOTATION_CHAR);
    if (arrow >= 0) {
      // A second annotation for one path means the earlier one is unreachable.
      // Counted, not swallowed — the conservation check turns it into a refusal.
      if (annotations.has(full)) duplicatePaths++;
      annotations.set(full, body.slice(arrow).trimEnd());
      recognised.add(idx);
    }
  }
  return { entries, annotations, duplicatePaths, recognised };
}

// ─── auditArrows(): the independent observer ─────────────────────────────────
// Input: the region's lines, and the set of indices the parser recognised.
// Output: [{ line, text }] for every line carrying an arrow-like mark that the
// parser did NOT turn into an annotation.
// ⚠ This is the ONLY check that can see a parser edge case. Conservation
// cannot: an unrecognised line is absent from both sides of its equation.
function auditArrows(lines, recognised, lineOffset) {
  const out = [];
  lines.forEach((raw, idx) => {
    if (recognised.has(idx)) return;
    if (!ARROW_NEEDLE.test(raw)) return;
    out.push({ line: lineOffset + idx, text: raw });
  });
  return out;
}

// ─── the generated stamp ─────────────────────────────────────────────────────
// Sits INSIDE the marker region, past the closing fence, so it round-trips
// through this script's own parse. It reports what the block was generated
// AGAINST, not merely when: a date alone says the block was WRITTEN recently,
// which is not the same as CURRENT — regenerate against a stale tree and you get
// a fresh date on stale content. The COUNTS are the load-bearing part, because a
// reader can compare them against a fresh --check and get a real currency
// signal. The --check pointer is there so verifying costs nothing.
// ⚠ THE STAMP ENDS IN "-->", WHICH ARROW_NEEDLE MATCHES (its `\s-{1,2}>` arm).
// The parser therefore recognises the stamp EXPLICITLY, by this exact pattern.
// ⚠ Do NOT solve this by exempting all HTML comments from the arrow audit — a
// blanket carve-out would let a real annotation hide inside a comment and vanish,
// which is the guard's entire subject. Exempt the stamp, nothing else.
const STAMP_RE = /^<!-- generated .*-->$/;
const stampLine = (files, dirs) =>
  `<!-- generated ${today} · HEAD ${head} · ${files} files, ${dirs} dirs · npm run architecture -- --check -->`;

// ─── parseQuarantine(): re-read orphans so they survive a second run ─────────
// Without this, an orphan quarantined on run N would evaporate on run N+1 —
// which is the silent deletion the quarantine exists to prevent, one run later.
const QUAR_RE = /^>\s+- `([^`]+)`\s+(←.*)$/;

function parseQuarantine(lines) {
  const out = new Map();
  for (const raw of lines) {
    const m = raw.match(QUAR_RE);
    if (m) out.set(m[1], m[2].trimEnd());
  }
  return out;
}

// ─── renderTree(): paths -> box-drawing lines, annotations re-attached ───────
// Files sort before directories at every level, each alphabetically. The old
// hand ordering (docs/ after utils/, before routes/) cannot be reproduced by a
// generator and is not worth preserving; determinism is.
// Returns the rendered lines and the set of paths whose annotation was used.
function renderTree(block, disk, annotations) {
  const node = () => ({ dirs: new Map(), files: [] });
  const tree = node();

  const insert = (segs, isDir) => {
    let cur = tree;
    for (let i = 0; i < segs.length; i++) {
      const last = i === segs.length - 1;
      if (last && !isDir) { cur.files.push(segs[i]); return; }
      if (!cur.dirs.has(segs[i])) cur.dirs.set(segs[i], node());
      cur = cur.dirs.get(segs[i]);
    }
  };

  for (const d of disk.dirs) insert(d.split('/'), true);
  for (const f of disk.files) {
    if (block.rootFiles.includes(f)) continue;
    insert(f.split('/'), false);
  }

  const raw = [];
  // Bare root files (server.js) sit above the tree, with no connector.
  for (const f of block.rootFiles) {
    if (disk.files.includes(f)) raw.push({ text: f, path: f });
  }

  const walkNode = (n, prefix, pathPrefix) => {
    const files = n.files.slice().sort();
    const dirs = [...n.dirs.keys()].sort();
    const items = [
      ...files.map((name) => ({ name, dir: false })),
      ...dirs.map((name) => ({ name, dir: true })),
    ];
    items.forEach((item, i) => {
      const last = i === items.length - 1;
      const full = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
      raw.push({
        text: `${prefix}${last ? '└── ' : '├── '}${item.name}${item.dir ? '/' : ''}`,
        path: full,
      });
      if (item.dir) walkNode(n.dirs.get(item.name), `${prefix}${last ? '    ' : '│   '}`, full);
    });
  };

  for (const rootName of block.roots.slice().sort()) {
    if (!tree.dirs.has(rootName)) continue;
    raw.push({ text: `${rootName}/`, path: rootName });
    walkNode(tree.dirs.get(rootName), '', rootName);
  }

  const used = new Set();
  const lines = raw.map(({ text, path: p }) => {
    const ann = annotations.get(p);
    if (!ann) return text;
    used.add(p);
    const pad = text.length >= block.arrowCol ? ' ' : ' '.repeat(block.arrowCol - text.length);
    return `${text}${pad}${ann}`;
  });
  return { lines, used };
}

// ─── buildRegion(): the full replacement text between one marker pair ────────
function buildRegion(block, disk, annotations, orphans) {
  const { lines, used } = renderTree(block, disk, annotations);
  const out = ['```', ...lines, '```', stampLine(disk.files.length, disk.dirs.length)];
  if (orphans.size) {
    out.push('');
    out.push(`> ⚠ **QUARANTINED ANNOTATIONS (${block.id}) — ${orphans.size}.** The path each of`);
    out.push('> these described is no longer on disk. **A RENAME is the common case, not a');
    out.push('> deletion** — under a naive regeneration the annotation would have been eaten');
    out.push('> silently, and the diff would have looked like a plausible file swap. Re-attach');
    out.push('> the text to the new path, or delete the line deliberately, then regenerate.');
    out.push('>');
    for (const [p, text] of [...orphans.entries()].sort()) {
      out.push(`> - \`${p}\` ${text}`);
    }
  }
  return { lines: out, used };
}

// ─── locateRegions(): marker integrity ───────────────────────────────────────
// Verifies BOTH markers of every pair exist, exactly once each, in the correct
// order, and that no two regions overlap. Refuses rather than guessing.
// ⚠ Never append at EOF as a fallback, and never rewrite the whole file.
function locateRegions(docLines) {
  const problems = [];
  const regions = [];
  for (const block of BLOCKS) {
    const b = beginMark(block.id);
    const e = endMark(block.id);
    const bIdx = [];
    const eIdx = [];
    docLines.forEach((l, i) => {
      if (l.trim() === b) bIdx.push(i);
      if (l.trim() === e) eIdx.push(i);
    });
    if (bIdx.length !== 1 || eIdx.length !== 1) {
      problems.push(`${block.id}: expected exactly 1 BEGIN and 1 END, found ${bIdx.length} BEGIN and ${eIdx.length} END`);
      continue;
    }
    if (bIdx[0] > eIdx[0]) {
      problems.push(`${block.id}: END (line ${eIdx[0] + 1}) precedes BEGIN (line ${bIdx[0] + 1}) — markers inverted`);
      continue;
    }
    regions.push({ block, begin: bIdx[0], end: eIdx[0] });
  }
  regions.sort((a, b) => a.begin - b.begin);
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].begin <= regions[i - 1].end) {
      problems.push(`regions overlap: ${regions[i - 1].block.id} ends at line ${regions[i - 1].end + 1}, ${regions[i].block.id} begins at line ${regions[i].begin + 1}`);
    }
  }
  return { regions, problems };
}

// ═════════════════════════════════════════════════════════════════════════════
// main
// ═════════════════════════════════════════════════════════════════════════════
const bar = (c) => c.repeat(72);
console.log(bar('='));
console.log(`ARCHITECTURE STRUCTURE — ${MODE.toUpperCase()} — ${today}, HEAD ${head}`);
console.log(bar('='));
console.log(`target: ${path.relative(ROOT, TARGET).split(path.sep).join('/')}`);

if (!fs.existsSync(TARGET)) {
  console.error(`\n⚠ REFUSING: target does not exist: ${TARGET}`);
  process.exit(MODE === 'check' ? 0 : 1);
}

const original = fs.readFileSync(TARGET, 'utf8');

// ─── ⚠ LINE ENDINGS — THIS BROKE THE PARSER IN PHASE 2 PROOF P4 ──────────────
// core.autocrlf=true is the Windows default, so the working-tree copy of a
// tracked LF file is CRLF the moment anyone runs `git checkout`. Splitting on
// '\n' alone leaves a trailing '\r' on every line, and in JavaScript '.' does
// NOT match '\r' — so the annotation-strip regex /\s+←.*$/ can never reach
// end-of-string and silently fails to match. The annotation text then becomes
// part of the parsed PATH, every path fails its on-disk lookup, and all 104
// annotations are classified as orphans.
// ⚠ THE THREE GUARDS ALL REPORTED PASS THROUGH THIS. Arrow audit saw the arrows
// (they were "recognised"), conservation saw in==out (54 in, 54 in quarantine),
// and the baseline saw 54 parsed. Guards agreeing with each other is not
// evidence; they were consistently wrong together. GUARD 6 (path sanity) exists
// because of this and is the only one that can see it.
// Split tolerantly, remember what the file actually used, and write it back the
// same way — never normalise someone's line endings as a side effect.
const EOL = original.includes('\r\n') ? '\r\n' : '\n';
const docLines = original.split(/\r?\n/);
const { regions, problems } = locateRegions(docLines);

// ─── GUARD 1: marker integrity ───────────────────────────────────────────────
// The one guard that can stop the others running: with no valid region there is
// nothing to parse, so guards 2-5 are reported NOT EVALUATED rather than PASS.
const markerFail = problems.length > 0 || regions.length !== BLOCKS.length;

// Guard results, COLLECTED not short-circuited. Each entry is
// { name, state: 'PASS' | 'FAIL' | 'NOT EVALUATED', detail }.
const guards = [];
const guardReport = () => {
  console.log(`\n${bar('=')}`);
  console.log('GUARD REPORT');
  console.log(bar('-'));
  guards.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.name.padEnd(20)} ${g.state.padEnd(14)} ${g.detail}`);
  });
  console.log(bar('-'));
};

if (markerFail) {
  const detail = problems.length
    ? problems.join('; ')
    : `expected ${BLOCKS.length} regions, resolved ${regions.length}`;
  guards.push({ name: 'Marker integrity', state: 'FAIL', detail });
  for (const name of ['Path sanity', 'Arrow audit', 'Conservation', 'Baseline assertion', 'Orphan quarantine']) {
    guards.push({ name, state: 'NOT EVALUATED', detail: 'no valid region to parse' });
  }
  guardReport();
  console.error('⚠ MARKER INTEGRITY FAILURE — nothing was written, the file is untouched.');
  for (const p of problems) console.error(`   - ${p}`);
  console.error('   Expected markers, each exactly once, BEGIN before END:');
  for (const b of BLOCKS) console.error(`     ${beginMark(b.id)} ... ${endMark(b.id)}`);
  console.error(bar('='));
  process.exit(MODE === 'check' ? 0 : 1);
}
guards.push({
  name: 'Marker integrity',
  state: 'PASS',
  detail: `${regions.length} regions resolved, markers well-formed`,
});

let drift = 0;
const replacements = [];
// Findings per guard, accumulated across BOTH blocks before any verdict is taken.
const found = { sanity: [], arrow: [], conservation: [], baseline: [], orphans: [] };
const sanityDetail = [];
const arrowDetail = [];
const conservationDetail = [];
const baselineDetail = [];
const orphanDetail = [];

for (const { block, begin, end } of regions) {
  const regionLines = docLines.slice(begin + 1, end);
  const parsed = parseBlock(regionLines);
  const priorOrphans = parseQuarantine(regionLines);
  const disk = classify(block);

  // Annotations available to re-attach = those parsed from the tree, plus any
  // still sitting in quarantine (re-attaching after a rename is just a lookup).
  const annotations = new Map([...priorOrphans, ...parsed.annotations]);

  // Counted from the RAW region text, independently of the parse, so a parser
  // bug surfaces as a conservation mismatch instead of hiding inside it.
  const annotationsIn = regionLines.reduce((n, l) => n + (l.includes('←') ? 1 : 0), 0);

  const listedPaths = new Set(parsed.entries.map((e) => e.path));
  const diskPaths = new Set([...disk.files, ...disk.dirs]);
  const addedFiles = disk.files.filter((f) => !listedPaths.has(f));
  const addedDirs = disk.dirs.filter((d) => !listedPaths.has(d));
  const goneEntries = parsed.entries.filter((e) => !diskPaths.has(e.path));

  const orphans = new Map();
  for (const [p, text] of annotations) if (!diskPaths.has(p)) orphans.set(p, text);

  const built = buildRegion(block, disk, annotations, orphans);
  const annotationsOut = built.lines.reduce((n, l) => n + (l.includes('←') ? 1 : 0), 0);

  const listedAfter = built.lines.filter(
    (l) => l !== '```' && l !== '' && !l.startsWith('>')
  ).length;

  console.log(`\n${bar('-')}`);
  console.log(`BLOCK: ${block.id}   (content lines ${begin + 2}–${end})`);
  console.log(bar('-'));
  console.log(`  entries listed now: ${parsed.entries.length}   after regeneration: ${listedAfter}`);
  console.log(`  EXCLUDED — test files ${disk.tests.length}, asset/binary files ${disk.assets.length}`);
  // BY NAME, not as a count. A suppressed directory is a deletion rule, and a
  // deletion rule that reports only a number is not announced.
  console.log(`  SUPPRESSED DIRECTORIES (zero listed files) — ${disk.suppressedDirs.length}:`);
  for (const d of disk.suppressedDirs) console.log(`      ${d}/`);
  if (disk.unclassified.length) {
    console.log(`  ⚠ UNCLASSIFIED (extension in neither allowlist nor asset list) — ${disk.unclassified.length}:`);
    for (const f of disk.unclassified) console.log(`      ${f}`);
    console.log('      NOT listed and NOT recognised as assets. Classify in CODE_EXTS or ASSET_EXTS.');
  }

  const show = (label, arr) => {
    console.log(`\n  ${label}: ${arr.length}`);
    for (const f of arr) console.log(`      ${f}`);
  };
  show('ON DISK, NOT LISTED (files)', addedFiles);
  show('ON DISK, NOT LISTED (directories)', addedDirs);
  show('LISTED, NOT ON DISK', goneEntries.map((e) => e.path + (e.isDir ? '/' : '')));

  console.log(`\n  ANNOTATIONS — in ${annotationsIn}, out ${annotationsOut}, carried ${built.used.size}, quarantined ${orphans.size}`);
  if (orphans.size) {
    console.log('  ⚠ ORPHANED ANNOTATIONS (path not on disk — rename? deletion?):');
    for (const [p, t] of [...orphans.entries()].sort()) console.log(`      ${p}  ${t}`);
  }
  if (parsed.duplicatePaths) {
    console.log(`  ⚠ ${parsed.duplicatePaths} DUPLICATE annotated path(s) in the existing block — later wins, earlier is LOST.`);
  }

  // ── THE ARROW AUDIT, fail-closed — the real guard ─────────────────────────
  // Runs BEFORE conservation because it can see a failure conservation cannot:
  // a line the parser never recognised is absent from both sides of H1's
  // equation, so H1 reports in == out and the annotation is silently gone.
  // ── GUARD 6: path sanity — the only guard that can see a mis-segmentation ──
  // A parsed path is a filesystem path. It can never legitimately contain the
  // annotation delimiter, a box-drawing connector, or a carriage return. If one
  // does, the parser split the line in the wrong place, and every downstream
  // guard will agree with it because they all read the same broken parse.
  // ⚠ This is the guard that catches the CRLF failure described at the read
  // site. Do not remove it because "paths obviously don't contain arrows" —
  // that is exactly the assumption that failed.
  const insane = parsed.entries.filter((e) => /[←│├└─\r]/.test(e.path));
  if (insane.length) {
    console.log(`\n  ⚠ MALFORMED PARSED PATH(S) in ${block.id}: ${insane.length}.`);
    console.log('    A path contains an annotation delimiter, a tree connector, or a CR.');
    console.log('    The parser mis-segmented; every other guard is reading the same bad parse.');
    for (const e of insane.slice(0, 3)) console.log(`      ${JSON.stringify(e.path.slice(0, 90))}`);
    if (insane.length > 3) console.log(`      ... and ${insane.length - 3} more`);
    found.sanity.push(`${block.id}: ${insane.length} malformed path(s)`);
  }
  sanityDetail.push(`${block.id} ${insane.length}`);

  const unrecognised = auditArrows(regionLines, parsed.recognised, begin + 2);
  if (unrecognised.length) {
    console.log(`\n  ⚠ UNRECOGNISED ANNOTATION LINE(S) in ${block.id}: ${unrecognised.length}.`);
    console.log('    These carry an arrow-like mark the parser did NOT turn into an annotation.');
    console.log('    They would be DROPPED with conservation reporting clean.');
    for (const u of unrecognised) console.log(`      line ${u.line}: ${u.text}`);
    found.arrow.push(`${block.id}: ${unrecognised.length} at line(s) ${unrecognised.map((u) => u.line).join(', ')}`);
  }

  // ── ANNOTATION_BASELINE tripwire, fail-closed ─────────────────────────────
  // Asserted, never merely printed. See the header: this is the tripwire, not
  // the mechanism, and bumping it to go green is the failure it guards against.
  const expected = ANNOTATION_BASELINE[block.id];
  if (Number.isFinite(expected) && parsed.annotations.size !== expected) {
    console.log(`\n  ⚠ ANNOTATION BASELINE MISMATCH in ${block.id}: expected ${expected}, parsed ${parsed.annotations.size}.`);
    console.log('    If this change is DELIBERATE, update ANNOTATION_BASELINE in the same');
    console.log('    commit and say so in the commit message. Do not bump it to go green.');
    found.baseline.push(`${block.id}: expected ${expected}, parsed ${parsed.annotations.size}`);
  }

  // ── H1 conservation, fail-closed ──────────────────────────────────────────
  // Every annotation read in must leave again, either attached in the rendered
  // tree or held in quarantine. A mismatch means the parser or the emitter
  // dropped one, which is the single failure this script must never commit
  // silently. Its observed failure mode is a duplicate annotated path: the Map
  // collapses two entries into one, in exceeds out, and the run refuses.
  if (annotationsIn !== annotationsOut) {
    console.log(`\n  ⚠ CONSERVATION FAILURE in ${block.id}: ${annotationsIn} annotation(s) in, ${annotationsOut} out.`);
    const emitted = new Set([...built.used, ...orphans.keys()]);
    const lost = [...annotations.keys()].filter((p) => !emitted.has(p));
    for (const p of lost) console.log(`      LOST: ${p}  ${annotations.get(p)}`);
    if (!lost.length) {
      console.log('      No per-path loss identified — suspect a duplicate annotated path,');
      console.log('      or an annotation whose text spans more than one line.');
    }
    found.conservation.push(`${block.id}: in ${annotationsIn}, out ${annotationsOut}`);
  } else {
    found.conservation.push(null); // records that the block was evaluated and passed
  }
  conservationDetail.push(`${block.id} ${annotationsIn}/${annotationsOut}`);
  baselineDetail.push(`${block.id} ${parsed.annotations.size}=${expected}`);
  arrowDetail.push(`${block.id} ${unrecognised.length}`);
  if (orphans.size) {
    found.orphans.push(`${block.id}: ${orphans.size} (${[...orphans.keys()].sort().join(', ')})`);
  }
  orphanDetail.push(`${block.id} ${orphans.size}`);

  drift += addedFiles.length + addedDirs.length + goneEntries.length;
  replacements.push({ begin, end, lines: built.lines });
}

// ─── guards 2-5, evaluated across both blocks, verdict taken LAST ────────────
guards.push({
  name: 'Path sanity',
  state: found.sanity.length ? 'FAIL' : 'PASS',
  detail: found.sanity.length
    ? found.sanity.join(' | ')
    : `all paths well-formed (${sanityDetail.join(', ')})`,
});
guards.push({
  name: 'Arrow audit',
  state: found.arrow.length ? 'FAIL' : 'PASS',
  detail: found.arrow.length
    ? found.arrow.join(' | ')
    : `0 unrecognised (${arrowDetail.join(', ')})`,
});
guards.push({
  name: 'Conservation',
  state: found.conservation.filter(Boolean).length ? 'FAIL' : 'PASS',
  detail: found.conservation.filter(Boolean).length
    ? found.conservation.filter(Boolean).join(' | ')
    : `in==out (${conservationDetail.join(', ')})`,
});
guards.push({
  name: 'Baseline assertion',
  state: found.baseline.length ? 'FAIL' : 'PASS',
  detail: found.baseline.length
    ? found.baseline.join(' | ')
    : `matches (${baselineDetail.join(', ')})`,
});
// Orphans are normally a FINDING, not a defect: quarantine is the designed
// outcome of a rename, and the write must PROCEED or the quarantine block never
// reaches the document. But a MASS orphaning is not a rename — it is a parse
// failure wearing a rename's clothes, which is precisely what the CRLF bug
// produced. Above the threshold the guard escalates to FAIL and blocks.
// ⚠ THE 25% IS A JUDGEMENT CALL, NOT A DERIVED CONSTANT, AND THIS GUARD IS A
// BACKSTOP RATHER THAN THE PRIMARY CATCH. The reasoning, recorded so it is not
// re-derived wrongly later:
//   - The CRLF case orphaned 100%, so ANY threshold would have caught it. This
//     guard gets no credit for that one; GUARD 6 is what catches it precisely.
//   - A PARTIAL mis-segmentation, below the threshold, is caught by GUARD 6
//     (path sanity), not by this guard.
//   - ⚠ THIS GUARD THEREFORE EXISTS FOR A MASS-ORPHANING WHOSE PATHS HAPPEN TO
//     LOOK WELL-FORMED — A CASE NOT CURRENTLY KNOWN TO OCCUR. That is a
//     legitimate guard for a hypothetical. It stops being legitimate the moment
//     someone forgets it was for a hypothetical and treats its silence as
//     evidence about the parser.
const ORPHAN_ALARM = 0.25;
const totalBaseline = Object.values(ANNOTATION_BASELINE).reduce((a, b) => a + b, 0);
const orphanTotal = orphanDetail.reduce((n, d) => n + Number(d.split(' ')[1] || 0), 0);
const orphanFlood = orphanTotal > totalBaseline * ORPHAN_ALARM;
guards.push({
  name: 'Orphan quarantine',
  state: orphanFlood ? 'FAIL' : (found.orphans.length ? 'HELD' : 'PASS'),
  detail: orphanFlood
    ? `${orphanTotal} orphans exceeds ${Math.floor(totalBaseline * ORPHAN_ALARM)} (${Math.round(ORPHAN_ALARM * 100)}% of ${totalBaseline}) — this is a PARSE FAILURE, not a rename`
    : (found.orphans.length ? found.orphans.join(' | ') : `0 orphans (${orphanDetail.join(', ')})`),
});

guardReport();

// The single AND, taken last. Orphans deliberately excluded — see above.
const refuse = found.sanity.length > 0
  || found.arrow.length > 0
  || found.conservation.filter(Boolean).length > 0
  || found.baseline.length > 0
  || orphanFlood;

console.log(refuse ? 'VERDICT: REFUSE — one or more guards failed.' : 'VERDICT: guards clear.');
console.log(`\n${bar('=')}`);

if (MODE === 'check') {
  console.log(drift === 0
    ? 'CHECK: CLEAN — the listing matches the filesystem.'
    : `CHECK: DRIFT — ${drift} entr(ies) differ. Run \`npm run architecture\` to regenerate.`);
  console.log('⚠ A clean check means the LISTING matches the filesystem. It says nothing');
  console.log('  about whether the annotations or the surrounding prose are true.');
  console.log('--check never exits non-zero and is wired into no gate, by design.');
  console.log(bar('='));
  process.exit(0);
}

if (refuse) {
  // Name the guards that actually failed. An earlier draft always said
  // "conservation failed", which was wrong whenever a different guard fired —
  // a refusal message that misattributes its own cause sends the next reader
  // to the wrong mechanism.
  const failed = guards.filter((g) => g.state === 'FAIL').map((g) => g.name);
  console.error(`REFUSING TO WRITE — ${failed.join(' + ')} failed. The file is untouched.`);
  console.error(bar('='));
  process.exit(1);
}

// ─── atomic write ────────────────────────────────────────────────────────────
// Splice the highest region first so the earlier region's line indices stay
// valid — CLAUDE.md's descending-order editing rule, ASSERTED rather than
// intended, because intending it and achieving it are different things and
// nothing in the tooling reports which happened.
replacements.sort((a, b) => b.begin - a.begin);
for (let i = 1; i < replacements.length; i++) {
  if (replacements[i].begin >= replacements[i - 1].begin) {
    console.error('REFUSING TO WRITE — internal error: replacements are not in descending order.');
    process.exit(1);
  }
}

const out = docLines.slice();
for (const r of replacements) out.splice(r.begin + 1, r.end - r.begin - 1, ...r.lines);

// Temp file then rename: a crash mid-write leaves the original intact rather
// than a half-written tracked document.
const tmp = `${TARGET}.tmp-${process.pid}`;
fs.writeFileSync(tmp, out.join(EOL), 'utf8');
fs.renameSync(tmp, TARGET);
console.log(`WROTE ${path.relative(ROOT, TARGET).split(path.sep).join('/')} — ${drift} entr(ies) reconciled, ${today}, HEAD ${head}`);
console.log(bar('='));
