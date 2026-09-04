// ─────────────────────────────────────────────────────────────────────────────
// PALETTE D-5 / D-1 — THE TOKEN-INTEGRITY SWEEP, MADE PERMANENT
//
// Ruled 2026-09-04. Three checks, all source-text, all cheap, none of them
// observing a pixel — and that limit is stated here rather than discovered:
// this file proves NAMES resolve and FALLBACKS agree with the derivation. It
// proves nothing about what paints. statusBannerContrast.test.jsx is where the
// rendered pairs are measured.
//
// ⚠ WHY THIS EXISTS AT ALL. The keys `cardBg` and `accent` DO NOT EXIST, and
// three sites in ManageAccount's Payout Method block read them anyway, written
// as a missing key OR-ed with a hex literal. The `||` makes it silent: the
// expression is valid, so there is no error, no lint failure and no test
// failure — and the fallback is
// not a fallback, it is the only value that has ever painted. The result is a
// near-black card carrying near-black text at 1.06:1, ON THE PAYOUT PATH, for
// months. A source-text existence check would have caught it the day it shipped.
//
// ⚠ AND IT SWEEPS COMMENTS TOO, DELIBERATELY. `statusTheme.js` carried
// `emeraldTxt` in a contrast table — right value, wrong name, for a key that
// does not exist. A mistyped token name in prose is exactly what someone copies
// into code, so there is NO comments-are-exempt carve-out. When this fires on
// prose, the prose gets reworded; that is the rule, and it already happened once
// in the R-1 commit.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { R } from './theme';
import { deriveThemeTokens, RENDER_TOKEN_VARS } from '../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../utils/brandingTheme.mjs';
import { STATUS_VARS, STATUS_LIGHT } from './statusTheme';

const SRC = path.resolve(process.cwd(), 'src');

// `R.` followed by a key. Anchored so `AD.bgSurface` and `foo.R.bar` cannot
// match — the bare word is a different question, and answering it instead is how
// a dead key reads as live.
const R_REF = /(^|[^A-Za-z0-9_.])R\.([a-zA-Z][A-Za-z0-9_]*)/g;
const VAR_DECL = /var\(\s*(--rm-[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

function rel(p) {
  return p.split(path.sep).join('/').replace(/^.*\/src\//, 'src/');
}

// Split on /\r?\n/ — `.` does not match `\r`, so a $-anchored pattern silently
// no-ops on a CRLF line, and core.autocrlf=true is the Windows default.
const FILES = walk(SRC).map((f) => ({ path: rel(f), lines: fs.readFileSync(f, 'utf8').split(/\r?\n/) }));

// ⚠ NON-VACUITY, FIRST AND UNCONDITIONALLY. Every assertion below is a sweep
// over this list; if the walk ever returns nothing they all pass by examining
// nothing, which is the exact shape this file was written to catch elsewhere.
it('the sweep actually has files to sweep', () => {
  expect(FILES.length).toBeGreaterThan(60);
  expect(FILES.some((f) => f.path === 'src/constants/theme.js')).toBe(true);
});

// ── 1. EVERY R.<key> REFERENCED IN src/ EXISTS ──────────────────────────────
describe('Palette D-5 — no source reads a key R does not define', () => {
  // ⚠ THIS LIST SHRINKS TO EMPTY, IT NEVER GROWS. Both members are the SAME
  // filed defect: PRE_LAUNCH_CHECKLIST.md's ManageAccount Payout Method item
  // (🔴, 8 of 10 measured pairs below their floor, two at 1.06:1). They are
  // listed rather than tolerated so that a NEW undefined key fails immediately
  // instead of hiding behind a known one.
  //
  // ⚠ THE ASSERTION IS EQUALITY, NOT SUBSET, AND THAT IS THE CLOSURE HALF. When
  // the payout block is repaired this case goes RED and whoever repaired it must
  // delete the entry — so the exception cannot outlive the defect. A list that
  // can only be added to becomes a list of things that were once true.
  const KNOWN_MISSING = ['accent', 'cardBg'];

  it('reports every undefined R.<key>, and only the two filed ones remain', () => {
    const found = new Map();
    for (const { path: p, lines } of FILES) {
      if (p === 'src/constants/theme.js') continue; // the definition itself
      lines.forEach((line, i) => {
        R_REF.lastIndex = 0;
        let m;
        while ((m = R_REF.exec(line)) !== null) {
          const key = m[2];
          if (!Object.prototype.hasOwnProperty.call(R, key)) {
            if (!found.has(key)) found.set(key, []);
            found.get(key).push(`${p}:${i + 1}`);
          }
          R_REF.lastIndex = m.index + m[0].length;
        }
      });
    }
    const names = [...found.keys()].sort();
    expect(
      names,
      'A key R does not define evaluates to undefined, and OR-ing it with a literal ' +
      'makes that silent. Sites:\n' +
      [...found.entries()].map(([k, at]) => `  R.${k} — ${at.join(', ')}`).join('\n') +
      '\nIf you FIXED one, delete it from KNOWN_MISSING in this file.'
    ).toEqual([...KNOWN_MISSING].sort());
  });
});

// ── 2. EVERY KEY R DEFINES IS REFERENCED SOMEWHERE ──────────────────────────
describe('Palette D-5 — R defines no key that nothing reads', () => {
  it('has no dead keys', () => {
    // theme.js IS included this time: STATUS_CONFIG consumes ten status keys
    // inside the definition file itself, and excluding it would report all ten
    // as dead. The question is "does anything read this", not "does anything
    // outside this file read this".
    const referenced = new Set();
    for (const { lines } of FILES) {
      for (const line of lines) {
        R_REF.lastIndex = 0;
        let m;
        while ((m = R_REF.exec(line)) !== null) {
          referenced.add(m[2]);
          R_REF.lastIndex = m.index + m[0].length;
        }
      }
    }
    const dead = Object.keys(R).filter((k) => !referenced.has(k)).sort();
    expect(
      dead,
      'These keys are defined and read by nothing. Five were removed on ' +
      '2026-09-04 (see theme.js\'s tombstone); do not let the class re-accumulate. ' +
      'Dead: ' + dead.join(', ')
    ).toEqual([]);
  });
});

// ── 3. EVERY var(--rm-*, #hex) FALLBACK AGREES WITH THE DERIVATION ──────────
describe('Palette D-1 — a fallback is the platform default, not a second opinion', () => {
  // The values the provider mounts for an UNSET contractor. A fallback is what
  // paints where nothing is mounted, so it must be what the light mount would
  // have produced — the rule statusTheme.js states and LockedSection is the
  // counter-example to.
  const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
  const EXPECTED = {};
  for (const [key, prop] of Object.entries(RENDER_TOKEN_VARS)) EXPECTED[prop] = light[key];
  for (const [role, prop] of Object.entries(STATUS_VARS)) EXPECTED[prop] = STATUS_LIGHT[role];

  // ⚠ ONE DELIBERATE EXCEPTION, AND IT IS A KNOWN DEFECT RATHER THAN A STYLE.
  // LockedSection's permission scrim declares var(--rm-bg, #012854): off the
  // theme tree it takes the navy and veils gated content, and mounted in light
  // mode it resolves to #FFFFFF — a white veil over the thing it is hiding, a
  // scrim that FAILS OPEN. That is why App.jsx keeps the admin branch outside
  // ThemeProvider. It is filed separately and is NOT repaired here.
  const KNOWN_EXCEPTIONS = new Set(['src/components/shared/LockedSection.jsx']);

  it('every hex fallback in src/ matches the platform default for its token', () => {
    const bad = [];
    let checked = 0;
    for (const { path: p, lines } of FILES) {
      if (/\.test\./.test(p) || KNOWN_EXCEPTIONS.has(p)) continue;
      // ⚠ BLOCK COMMENTS ARE STRIPPED AS A REGION, NOT LINE BY LINE. A `//`
      // check alone misses the CONTINUATION lines of a /* */ or {/* */} block,
      // and LockedSection's own prose quotes this exact declaration shape —
      // which made an earlier version of this sweep report a comment as code.
      let inBlock = false;
      lines.forEach((line, i) => {
        const t = line.trim();
        if (inBlock) { if (t.includes('*/')) inBlock = false; return; }
        if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) inBlock = true; return; }
        if (t.startsWith('//') || t.startsWith('*')) return;
        VAR_DECL.lastIndex = 0;
        let m;
        while ((m = VAR_DECL.exec(line)) !== null) {
          const [, prop, fallback] = m;
          const want = EXPECTED[prop];
          if (want) {
            checked++;
            if (fallback.toUpperCase() !== want.toUpperCase()) {
              bad.push(`${p}:${i + 1} — ${prop} falls back to ${fallback}, derivation says ${want}`);
            }
          }
          VAR_DECL.lastIndex = m.index + m[0].length;
        }
      });
    }
    expect(checked, 'no var() fallbacks were found to check').toBeGreaterThan(40);
    expect(
      bad,
      'A fallback that disagrees with the mount is the R-1 defect class: the ' +
      'source reads correctly and the screen does not.\n' + bad.join('\n')
    ).toEqual([]);
  });

  it('the LockedSection exception is real, so the carve-out cannot go stale', () => {
    // ⚠ AN EXCEPTION NOBODY RE-CHECKS BECOMES A PERMANENT HOLE. This asserts the
    // excepted file still contains the thing it was excepted FOR. If the scrim is
    // ever repaired, this goes red and the carve-out above must be deleted.
    const src = fs.readFileSync(
      path.resolve(SRC, 'components/shared/LockedSection.jsx'), 'utf8'
    );
    expect(src).toMatch(/background:\s*'var\(--rm-bg,\s*#012854\)'/);
    expect(EXPECTED['--rm-bg']).toBe('#FFFFFF');
  });
});
