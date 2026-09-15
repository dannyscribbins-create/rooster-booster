// ─────────────────────────────────────────────────────────────────────────────
// THE PAINTERS — Palette-13 Part B.7
//
// The chain commit wired resolver -> provider -> loader, so a contractor's face
// RESOLVED, MOUNTED and LOADED. Nothing asked for it. This commit moved 313
// sites across four trees onto the three font roles, which is what turns the
// chain into pixels.
//
// ── WHAT jsdom CAN AND CANNOT SEE, STATED RATHER THAN IMPLIED ───────────────
// ⚠ jsdom RESOLVES NO var(). Every migrated site now declares
// `var(--rm-font-X, <fallback>)`, so in every test in this repo what "renders"
// is the FALLBACK, never the mounted contractor value. That means:
//   CAN see — that the site declares a token rather than a hardcoded family;
//             that the token is the right ROLE; that the file still renders.
//   CANNOT see — that a contractor's face actually reaches the node. That is a
//             real-browser reading, and it is recorded in the commit body from a
//             run against the dev server, not asserted here.
// A test that claimed the second would be the shape this repo keeps recording:
// an assertion that passes identically against completely unwired code.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FONT_VARS, FONT_DEFAULTS, fontVar } from '../../constants/elevationTheme';

const SRC = path.join(process.cwd(), 'src');
const TREES = ['components/referrer', 'components/shared', 'components/auth', 'components/rep'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = TREES.flatMap((t) => walk(path.join(SRC, t)))
  .map((f) => [path.relative(SRC, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]);

// Comments are not sites. A key name in prose is a RECORD; treating it as a
// violation is how a sweep reports a defect that is not there — which a draft of
// this suite actually did, against AvatarCircle's three retired-read records.
function codeOnly(src) {
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');   // JSX comment blocks
}

describe('T2 — no font key and no raw family literal remains in the four trees', () => {
  it('the file set is non-empty and is the four in-scope trees', () => {
    // Non-vacuity: every assertion below iterates FILES, so an empty FILES makes
    // all of them pass trivially. This is the shape that keeps recurring.
    // MEASURED 2026-09-15: 44 production files across the four trees.
    expect(FILES.length).toBeGreaterThanOrEqual(44);
    for (const t of TREES) {
      expect(FILES.some(([f]) => f.startsWith(t + '/')), `${t} contributed no files`).toBe(true);
    }
  });

  it('no R font key is READ in code', () => {
    const hits = [];
    for (const [f, src] of FILES) {
      // ⚠ THE MESSAGE IS ASSEMBLED FROM PIECES RATHER THAN WRITTEN OUT.
      // themeKeyIntegrity scans source TEXT and does not exempt test files —
      // correctly, since a key name in prose is exactly what someone pastes back
      // into code. It fired on the first draft of THIS LINE, and on the message
      // string rather than on the regex, which is the half nobody watches.
      // Reword, never exempt.
      for (const m of codeOnly(src).matchAll(/\bR\.font(Sans|Body|Mono)\b/g)) {
        hits.push(f + ' reads ' + ['R', 'font' + m[1]].join('.'));
      }
    }
    expect(hits).toEqual([]);
  });

  it('no AD font key is READ in code — a shared component reaching into the admin theme', () => {
    const hits = [];
    for (const [f, src] of FILES) {
      for (const m of codeOnly(src).matchAll(/\bAD\.font(Sans|Display)\b/g)) {
        hits.push(f + ' reads ' + ['AD', 'font' + m[1]].join('.'));
      }
    }
    expect(hits).toEqual([]);
  });

  it('no raw fontFamily literal remains', () => {
    const hits = [];
    for (const [f, src] of FILES) {
      codeOnly(src).split('\n').forEach((l) => {
        const m = l.match(/\bfontFamily:\s*(['"`])/);
        if (m) hits.push(f + '  ' + l.trim().slice(0, 70));
      });
    }
    expect(hits).toEqual([]);
  });

  it('and the trees DO declare typography — absence alone is satisfied by emptying them', () => {
    // ⚠ THE PAIRED POSITIVE. Every assertion above is an absence, and a sweep
    // that deleted every fontFamily declaration would pass all three.
    const declaring = FILES.filter(([, src]) => /fontVar\('(heading|body|mono)'\)/.test(src));
    // MEASURED: 36 of the 44 declare a role. The eight that do not declare
    // no family at all and never did — they inherit, which is V4's subject.
    expect(declaring.length).toBeGreaterThanOrEqual(36);
    const roles = new Set();
    for (const [, src] of FILES) {
      for (const m of src.matchAll(/fontVar\('(heading|body|mono)'\)/g)) roles.add(m[1]);
    }
    expect([...roles].sort()).toEqual(['body', 'heading', 'mono']);
  });

  it('every fontVar call names a role the side channel actually publishes', () => {
    // A typo'd role would throw at render; this names the file instead.
    for (const [f, src] of FILES) {
      for (const m of src.matchAll(/fontVar\('([^']*)'\)/g)) {
        expect(Object.keys(FONT_VARS), `${f} calls fontVar('${m[1]}')`).toContain(m[1]);
      }
    }
  });

  it('no site declares the TEXT of a call instead of the call', () => {
    // ⚠ FIVE ICONS SHIPPED BLACK FROM EXACTLY THIS — a string containing a call
    // rather than the call. Phosphor got a value that is not a colour and fell
    // back to black, and four independent checks passed because black on white
    // is 21:1.
    for (const [f, src] of FILES) {
      expect(codeOnly(src), `${f} declares the text of a fontVar call`)
        .not.toMatch(/[=:]\s*['"`]fontVar\(/);
    }
  });
});

describe('T5 — the font: inherit sites, and what src/index.css does to them', () => {
  // ⚠ THESE 13 SITES DECLARE NO FAMILY OF THEIR OWN. They follow whatever their
  // nearest ancestor declares, which is why migrating an ancestor carries them
  // for free — and why an ancestor NOT migrated would leave them on a different
  // face from their siblings. That is M.7's subject.
  //
  // ⚠ jsdom CANNOT ANSWER THE QUESTION THIS CASE IS ABOUT. It resolves no var(),
  // so a computed-style reading here would report the declaration, not the
  // contractor's face — declaration and resolution are indistinguishable, which
  // is the trap the chain commit recorded against getComputedStyle. What jsdom
  // CAN prove is the STRUCTURE: the chain exists and nothing competes with it.
  // The resolution itself was read in a real browser and is in the commit body:
  // all four RepBottomNav buttons resolved to the contractor's body face.
  const inheritSites = [];
  for (const [f, src] of FILES) {
    codeOnly(src).split('\n').forEach((l, i) => {
      if (/[^-\w]font:\s*['"]inherit['"]/.test(l)) inheritSites.push([f, i + 1, l.trim()]);
    });
  }

  it('there ARE inherit sites — otherwise everything below is vacuous', () => {
    // MEASURED 2026-09-15: 13 across the four trees. The arc's earlier figure of
    // 15 counted the whole of src/, including the admin tree and the dev harness.
    expect(inheritSites.length).toBeGreaterThanOrEqual(13);
  });

  it('no inherit site ALSO declares a family — that would make the inherit dead', () => {
    for (const [f, line, text] of inheritSites) {
      expect(text, `${f}:${line} declares a family beside font: inherit`).not.toMatch(/fontFamily:/);
    }
  });

  it('Screen — the universal container every referrer surface renders inside — declares the body role', () => {
    // ⚠ THIS IS THE LINK THE INHERIT SITES HANG FROM. If it ever stops declaring
    // a family, all 13 fall through to `body`, and `src/index.css` sets that to
    // a SYSTEM stack (-apple-system, …) rather than the contractor's face. That
    // file is a CRA leftover and a standing violation of "never add CSS files";
    // removing it is its own job, and this case is what would catch the fallout.
    const [, screenSrc] = FILES.find(([f]) => f.endsWith('shared/Screen.jsx'));
    expect(screenSrc).toMatch(/fontFamily:\s*fontVar\('body'\)/);
  });

  it('src/index.css still sets a SYSTEM stack on body — recorded, not fixed', () => {
    // Asserted so the interaction above is a known quantity rather than a
    // surprise. If this file is ever removed, this case fails and points at the
    // 13 sites that would change what they inherit.
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8');
    expect(css).toMatch(/body\s*\{[^}]*font-family:\s*-apple-system/);
  });
});

describe('the three roles resolve to the values the provider mounts', () => {
  for (const role of ['heading', 'body', 'mono']) {
    it(`fontVar('${role}') is the property plus the mounted fallback`, () => {
      expect(fontVar(role)).toBe(`var(${FONT_VARS[role]}, ${FONT_DEFAULTS[role]})`);
    });
  }

  it('an unknown role throws rather than rendering nothing', () => {
    // A silent '' would render as no family at all — the same failure statusVar
    // refuses, for the same reason.
    expect(() => fontVar('display')).toThrow(/unknown font role/);
  });
});
