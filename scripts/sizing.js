#!/usr/bin/env node
'use strict';

// ─── sizing.js — generated counts for the greppable sweeps ────────────────────
//
// WHY THIS EXISTS. Four corrections in session A (2026-08-21) were COUNTS that
// had been hand-written once and never recomputed: escapeHtml 3 -> 7, brand
// literals 77 -> 166, err.message ~40 -> 45, unguarded stats reads 7 -> 17/19.
// Every one drifted silently, because nothing recomputed them and nothing
// announced that they were stale. The fix is GENERATION, not vigilance — the
// same conclusion docs/ARCHITECTURE.md's folder-structure finding reached.
//
// IT PRINTS. It does not assert, it does not exit non-zero on a count change,
// and it must never be wired into a build or a test gate. A tripwire set to the
// wrong number is exactly the false-health defect CLAUDE.md's Test Design
// section warns about ("A mechanism that reports health it cannot observe is
// worse than no mechanism"). This tool's job is to make the number cheap to
// re-derive, not to have an opinion about it.
//
// Output carries today's date and the current HEAD sha, so a pasted result is
// self-dating and a reader can tell at a glance whether it predates their work.
//
// It WALKS THE TREE. It does not iterate a hand-maintained FILES list — that is
// the defect recorded against the brand sweep, where new files were invisible
// until someone remembered them and nothing announced the omission.
//
// ─── NOT COVERED BY THIS SCRIPT — count these by hand, or not at all ──────────
//   - Unguarded stats reads. Needs AST analysis, not grep.
//   - The five-state "wired up" classification. Judgement, not a match.
//   - Anything requiring a database read. Live counts (pending_referrals,
//     error_log, contractor rows) come from production and are recorded in
//     docs/GROUND_TRUTH_2026-08-21.md with a date.
// ⚠ This script makes three counts self-updating. It does not make the document
// trustworthy — it narrows the set of numbers that can drift silently. Numbers
// outside this list still need a dated source.
//
// ─── ⚠ THIS SCRIPT HAS ALREADY BEEN WRONG ONCE ───────────────────────────────
// Its first run reported 3 files importing the canonical escapeHtml. The real
// answer is 1. The importer check tested "requires pendingReferral AND contains
// the string escapeHtml" — true of every file that requires it for something
// else and then defines its own copy. Every local redefiner was a false
// positive: the check reported health in exactly the population it existed to
// find. It was caught only because the number contradicted a hand verification
// done minutes earlier.
// If you extend this script, state the failure mode of your new check and prove
// it fails that way before trusting a pass.
// See CLAUDE.md, Test Design — "A mechanism that reports health it cannot
// observe is worse than no mechanism."
//
// Usage:  npm run sizing
// Zero dependencies; Node core only.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// walk() and SKIP_DIRS were extracted to scripts/lib/fsWalk.js in Wave 0.1 so
// that this script and scripts/architecture.js cannot drift about what the repo
// contains. Behaviour is unchanged — proven by diffing this script's full
// output across the extraction. The helper is read-only; it does not affect the
// "IT PRINTS" contract above.
const { walk: walkExts } = require('./lib/fsWalk');

const ROOT = path.resolve(__dirname, '..');

const walk = (dir, exts) => walkExts(dir, exts, ROOT);

const isTestFile = (p) => p.includes('.test.') || p.startsWith('server/test/');
const readLines = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/);

// ─── report(): per-file breakdown, highest first, with a total ───────────────
// Input: array of {file, line, text} hits, and a label.
// Prints nothing but the breakdown; the caller prints its own heading.
function report(hits, indent = '  ') {
  const byFile = new Map();
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || 0) + 1);
  const rows = [...byFile.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const width = rows.reduce((m, r) => Math.max(m, r[0].length), 0);
  for (const [file, n] of rows) console.log(`${indent}${file.padEnd(width)}  ${String(n).padStart(4)}`);
  console.log(`${indent}${'TOTAL'.padEnd(width)}  ${String(hits.length).padStart(4)}`);
}

// ─── header ──────────────────────────────────────────────────────────────────
let head = 'unknown';
try {
  head = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout, or git absent. The counts are still valid; only the
  // provenance line degrades. Never fail the run over this.
}
const today = new Date().toISOString().slice(0, 10);

console.log('='.repeat(72));
console.log(`SIZING — generated ${today}, HEAD ${head}`);
console.log('='.repeat(72));
console.log('Counts below are GENERATED. Paste the dated output; do not hand-edit numbers.');
console.log('Test files are excluded from every figure and reported separately.');
console.log('⚠ These are OCCURRENCE counts, not line counts. A line carrying two needles');
console.log('  counts twice. `grep -c` counts lines and will read LOWER — that discrepancy');
console.log('  is exactly how the hand-written 77/166 figures drifted from the real 80/170.');

// ═════════════════════════════════════════════════════════════════════════════
// 1. escapeHtml definitions
// ═════════════════════════════════════════════════════════════════════════════
// A local redefinition is a CLAUDE.md violation on its own (the canonical one
// lives in server/utils/pendingReferral.js). The single-quote check is the part
// that makes this a security count rather than a tidiness count: a body that
// does not escape ' leaves an attribute-context injection path open wherever
// CRM-sourced text reaches an HTML email.
const DEF_RE = /^\s*(?:function\s+escapeHtml\s*\(|const\s+escapeHtml\s*=)/;
const QUOTE_RE = /&#0?39;|&apos;/;

const jsFiles = [...walk(path.join(ROOT, 'server'), ['.js']), ...walk(path.join(ROOT, 'src'), ['.js', '.jsx'])];
const escDefs = [];
for (const file of jsFiles) {
  if (isTestFile(file)) continue;
  const lines = readLines(file);
  lines.forEach((text, i) => {
    if (!DEF_RE.test(text)) return;
    // Body scan: 12 lines is comfortably more than any of the current forms.
    const body = lines.slice(i, i + 12).join('\n');
    escDefs.push({ file, line: i + 1, escapesQuote: QUOTE_RE.test(body) });
  });
}

console.log('\n' + '-'.repeat(72));
console.log(`1. escapeHtml DEFINITIONS — ${escDefs.length} total`);
console.log('-'.repeat(72));
const CANONICAL = 'server/utils/pendingReferral.js';
for (const d of escDefs) {
  const tag = (d.file === CANONICAL ? 'CANONICAL' : 'local').padEnd(9);
  const q = (d.escapesQuote ? "escapes '" : "⚠ NO ' ESCAPE").padEnd(14);
  console.log(`  ${tag}  ${q}  ${d.file}:${d.line}`);
}
const weak = escDefs.filter((d) => !d.escapesQuote);
const locals = escDefs.filter((d) => d.file !== CANONICAL);
console.log(`\n  ${locals.length} local redefinition(s); ${weak.length} do NOT escape the single quote.`);
// ⚠ Must match escapeHtml being DESTRUCTURED from the require, not merely a file
// that requires pendingReferral for something else and happens to contain the
// word "escapeHtml" — every local redefiner does both, which made a looser check
// report three importers when there is one.
const IMPORT_RE = /(?:const|let|var)\s*\{[^}]*\bescapeHtml\b[^}]*\}\s*=\s*require\(\s*['"][^'"]*pendingReferral['"]\s*\)/;
const importers = jsFiles.filter((f) => !isTestFile(f) && IMPORT_RE.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
console.log(`  Files importing the canonical one: ${importers.length}${importers.length ? ' — ' + importers.join(', ') : ''}`);

// ═════════════════════════════════════════════════════════════════════════════
// 2. Brand literals
// ═════════════════════════════════════════════════════════════════════════════
// BOTH axes are required (D-N amendment 3): a hex needle alone misses every
// rgb()/rgba() decimal form, and those are the majority of the src/ population.
const HEX_RE = /#(?:012854|CC0000|D3E3F0|041D3E)/gi;
const RGB_RE = /rgba?\(\s*(?:1\s*,\s*40\s*,\s*84|204\s*,\s*0\s*,\s*0|211\s*,\s*227\s*,\s*240|4\s*,\s*29\s*,\s*62)\b/gi;

function scanBrand(files) {
  const hex = [];
  const rgb = [];
  const testHex = [];
  const testRgb = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((text, i) => {
      const h = (text.match(HEX_RE) || []).length;
      const r = (text.match(RGB_RE) || []).length;
      for (let k = 0; k < h; k++) (isTestFile(file) ? testHex : hex).push({ file, line: i + 1 });
      for (let k = 0; k < r; k++) (isTestFile(file) ? testRgb : rgb).push({ file, line: i + 1 });
    });
  }
  return { hex, rgb, testHex, testRgb };
}

const serverBrand = scanBrand(walk(path.join(ROOT, 'server'), ['.js']));
const srcBrand = scanBrand(walk(path.join(ROOT, 'src'), ['.js', '.jsx']));

console.log('\n' + '-'.repeat(72));
const brandTotal = serverBrand.hex.length + serverBrand.rgb.length + srcBrand.hex.length + srcBrand.rgb.length;
console.log(`2. BRAND LITERALS (#012854 / #CC0000 / #D3E3F0 / #041D3E + rgb/rgba forms) — ${brandTotal} production sites`);
console.log('-'.repeat(72));
console.log(`\n  server/ — hex ${serverBrand.hex.length}, rgb ${serverBrand.rgb.length}`);
if (serverBrand.hex.length) report(serverBrand.hex, '    ');
if (serverBrand.rgb.length) { console.log('    -- rgb/rgba --'); report(serverBrand.rgb, '    '); }
console.log(`\n  src/ — hex ${srcBrand.hex.length}, rgb ${srcBrand.rgb.length}`);
if (srcBrand.hex.length) report(srcBrand.hex, '    ');
if (srcBrand.rgb.length) { console.log('    -- rgb/rgba --'); report(srcBrand.rgb, '    '); }
// Dropped counts are printed, never silently discarded — a sweep that hides
// what it excluded reads as "covered everything" when it did not.
console.log(
  `\n  EXCLUDED (test files): server hex ${serverBrand.testHex.length} / rgb ${serverBrand.testRgb.length}` +
  `, src hex ${srcBrand.testHex.length} / rgb ${srcBrand.testRgb.length}`
);

// ═════════════════════════════════════════════════════════════════════════════
// 3. err.message / err.stack in a response body
// ═════════════════════════════════════════════════════════════════════════════
// Counts only sites where the value reaches the CLIENT. logError() and console
// lines are legitimate and are excluded. Note the shapes this catches beyond the
// plain { error: err.message }: string concatenation, and a `message:` key
// alongside an error code — a regex written only against the plain form misses
// those, which is how a sweep of this reads as finished while leaving several.
const LEAK_RE = /res\s*\.\s*(?:status\s*\([0-9]+\)\s*\.)?(?:json|send)\s*\(.*\berr(?:or)?\s*\.\s*(?:message|stack)\b/;
const leaks = [];
for (const file of walk(path.join(ROOT, 'server'), ['.js'])) {
  if (isTestFile(file)) continue;
  readLines(file).forEach((text, i) => {
    if (!LEAK_RE.test(text)) return;
    if (/logError|console\s*\./.test(text)) return;
    leaks.push({ file, line: i + 1, text: text.trim() });
  });
}

console.log('\n' + '-'.repeat(72));
console.log(`3. err.message / err.stack REACHING THE CLIENT — ${leaks.length} sites`);
console.log('-'.repeat(72));
report(leaks, '  ');
console.log('\n  ⚠ Single-line matcher. A multi-line res.status(...).json({\\n error: err.message \\n})');
console.log('    would not be counted. None existed at the time this script was written; if the');
console.log('    count ever drops without a fix landing, check for a reformat before celebrating.');

console.log('\n' + '='.repeat(72));
console.log(`END SIZING — ${today}, HEAD ${head}`);
console.log('='.repeat(72));
