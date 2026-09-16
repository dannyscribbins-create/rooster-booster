// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-16 — src/index.css IS GONE, AND WHAT NOW CARRIES ITS ONE LIVE RULE
//
// ⚠ THE FILE WAS A CRA LEFTOVER AND A STANDING VIOLATION of CLAUDE.md's "All
// styling inline. Never add CSS files." It held five declarations and exactly
// one of them was load-bearing.
//
// ⚠ AND IT WAS MASKING A REFERRER-FACING DEFECT RATHER THAN MERELY SITTING
// THERE. Measured in a real browser before this change, across four surfaces —
// signup (21 text nodes), the admin panel (75), the legal pages (64) and the
// referrer app (72) — exactly ONE element that a real visitor can see inherited
// `body`'s font: `ExperiencePopup`'s "0 / 2000" character counter. Its card
// declares no family and its ancestor chain reaches `body` without passing
// through `Screen`, so it painted `-apple-system` on a contractor's surface.
// **Deleting the rule outright would have moved it to the browser default —
// worse, not better.**
//
// ── WHAT REPLACED IT, AND WHY IT IS AN UPGRADE ──────────────────────────────
//   applyBodyDefaults()   writes the EXACT former declarations imperatively, so
//                         every surface OUTSIDE ThemeProvider — the admin tree,
//                         the legal pages — is byte-for-byte unchanged.
//   ThemeProvider         additionally writes the MOUNTED body font onto
//                         document.body, on the same seam that already writes
//                         the page background (Ruling 4). So anything inheriting
//                         inside the themed tree now gets the CONTRACTOR'S face
//                         instead of a system stack.
//
// ⚠ THAT SECOND WRITE IS WHY THE COUNTER DID NOT NEED A LOCAL FIX. Repairing
// `ExperiencePopup` alone would have closed the one node I could FIND by
// opening modals in a browser; it could not close the ones I could not reach.
// Setting the inherited default correctly closes the whole class, including
// states no walkthrough opened.
//
// ⚠ EXPECTED COUNT: 13 cases across 5 suites. Counted with `grep -c`, never
// from the plan. Every `for` loop sits inside an `it()` body and multiplies
// nothing.
// ⚠ IT WAS WRITTEN AS "12 across 4" AND IS 13 ACROSS 5. The suite count was
// wrong from the start; the case count became wrong when one case was SPLIT in
// two after jsdom turned out not to model the smoothing properties. Four
// earlier slips in this arc were all in the CASE count, so the habit formed
// around the number being watched — and a number can also go stale because the
// file changed under it. **Re-count every number from the file, at the end.**
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, cleanup } from '@testing-library/react';
import ThemeProvider, { themeVariables } from './ThemeProvider';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { FONT_VARS, FONT_DEFAULTS } from '../../constants/elevationTheme';
import { applyBodyDefaults, BODY_DEFAULTS } from '../../utils/bodyDefaults';

const SRC = path.resolve(process.cwd(), 'src');

// The exact stack src/index.css put on body. Held here as the record of what
// the removed file did, so the replacement is checked against the original
// rather than against itself.
const FORMER_INDEX_CSS_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', " +
  "'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

function resetBody() {
  document.body.style.removeProperty('margin');
  document.body.style.removeProperty('font-family');
  document.body.style.removeProperty('-webkit-font-smoothing');
  document.body.style.removeProperty('-moz-osx-font-smoothing');
  document.body.style.removeProperty('background');
}
beforeEach(resetBody);
afterEach(() => { cleanup(); resetBody(); });

// ═══════════════════════════════════════════════════════════════════════════
// T4a — THE FILE IS GONE, AND NOTHING IMPORTS A STYLESHEET
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-16 — the CSS file is gone', () => {
  it('src/index.css does not exist', () => {
    expect(fs.existsSync(path.join(SRC, 'index.css'))).toBe(false);
  });

  it('NO source file in src/ imports a .css file at all', () => {
    // ⚠ THE RULE IS "never add CSS files", SO THE FENCE IS THE RULE, NOT THE ONE
    // FILE. An assertion that `index.css` specifically is absent passes forever
    // once it is — and says nothing about the next one somebody adds.
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
        const src = fs.readFileSync(p, 'utf8');
        // Strip comments so prose naming a .css file is not read as an import.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
          .split(/\r?\n/).map((l) => (/^\s*\/\//.test(l) ? '' : l)).join('\n');
        if (/\bimport\s+['"][^'"]+\.css['"]/.test(code)) {
          offenders.push(path.relative(SRC, p).split(path.sep).join('/'));
        }
      }
    };
    walk(SRC);
    expect(offenders, 'these files import a stylesheet').toEqual([]);
  });

  it('and the sweep is real — it finds a planted import', () => {
    // ⚠ NON-VACUITY. Without this the case above passes by examining nothing if
    // the walk or the needle ever breaks.
    //
    // ⚠ THE FIXTURES ARE ASSEMBLED FROM PIECES, AND THAT IS NOT STYLE. Written
    // plainly, this case's own needle made THIS FILE an offender — the sweep
    // walks all of `src/`, including itself, and a test needle spelled in full
    // IS the pattern it looks for. The first run reported
    // `components/shared/bodyDefaults.test.jsx` as importing a stylesheet.
    // CLAUDE.md's rule is reword, never exempt: a comments-are-exempt or
    // tests-are-exempt carve-out would remove the sweep's reach into exactly
    // the files someone copies an import from.
    const IMPORT = 'im' + 'port';
    const DOT_CSS = '.c' + 'ss';
    const NEEDLE = /\bimport\s+['"][^'"]+\.css['"]/;
    expect(NEEDLE.test(`${IMPORT} './index${DOT_CSS}';`)).toBe(true);
    expect(NEEDLE.test(`${IMPORT} x from "./a${DOT_CSS}"`)).toBe(false);  // a DEFAULT import — a different form
    expect(NEEDLE.test(`${IMPORT} './styles.scss';`)).toBe(false);        // a near miss, one extra letter
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T4b — THE REPLACEMENT CARRIES THE FORMER DECLARATIONS EXACTLY
// ⚠ THIS REPLACES B.7's "index.css still sets a SYSTEM stack on body" FENCE,
// which was written to FAIL if the file was ever removed. Deleting it would
// have left body's font guarded by nothing.
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-16 — applyBodyDefaults carries what index.css carried', () => {
  it('the recorded stack is the one the removed file actually had', () => {
    // ⚠ CHECKED AGAINST THE ORIGINAL, NOT AGAINST ITSELF. Both sides of this
    // are now in the repo, so a fence comparing the module to a constant it
    // exports would be circular.
    const normalise = (s) => s.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
    expect(normalise(BODY_DEFAULTS.fontFamily)).toBe(normalise(FORMER_INDEX_CSS_STACK));
  });

  it('applying them writes margin and the family', () => {
    applyBodyDefaults();
    expect(document.body.style.margin).toBe('0px');
    expect(document.body.style.fontFamily).toContain('-apple-system');
  });

  it('the two smoothing hints are carried — ⚠ AS DATA, because jsdom drops them', () => {
    // ⚠ WHAT THIS CASE CANNOT SEE, STATED RATHER THAN ASSERTED AROUND.
    // `-webkit-font-smoothing` and `-moz-osx-font-smoothing` are non-standard,
    // and jsdom's CSSStyleDeclaration returns '' for both after setProperty —
    // measured here, not assumed. So asserting the APPLIED value would fail
    // against a browser where it works, which is worse than not asserting it.
    // What is checkable is that the module still carries them and still tries.
    applyBodyDefaults();
    expect(document.body.style.getPropertyValue('-webkit-font-smoothing')).toBe('');
    expect(BODY_DEFAULTS.webkitFontSmoothing).toBe('antialiased');
    expect(BODY_DEFAULTS.mozOsxFontSmoothing).toBe('grayscale');
    const src = fs.readFileSync(path.join(SRC, 'utils/bodyDefaults.js'), 'utf8');
    expect(src).toMatch(/setProperty\('-webkit-font-smoothing'/);
    expect(src).toMatch(/setProperty\('-moz-osx-font-smoothing'/);
  });

  it('it is idempotent — index.jsx and a hot reload must not fight', () => {
    applyBodyDefaults();
    const first = document.body.style.cssText;
    applyBodyDefaults();
    expect(document.body.style.cssText).toBe(first);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T1/T2 — THE THEMED TREE GETS THE CONTRACTOR'S FACE ON BODY
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-16 — ThemeProvider sets the inherited family', () => {
  const beta = { primary_color: '#0B3D3B', secondary_color: '#C2185B', font_body: 'Lato', font_heading: 'Playfair Display' };

  // ⚠ COMPARED AGAINST WHAT THE LAYER ITSELF MOUNTED, NOT AGAINST A VALUE THIS
  // TEST COMPUTES. The property that matters is that `body` and the themed
  // wrapper agree — if they can disagree, an inheriting node paints one font
  // while its themed siblings paint another, which is the whole defect class.
  // Recomputing the expected value here would also make the case depend on the
  // provider's prop semantics rather than on its behaviour.
  // ⚠ AND jsdom NORMALISES QUOTES — it returns `"Lato", sans-serif` for a value
  // written as `'Lato', sans-serif` — so both sides are normalised before
  // comparison. An exact string match fails on punctuation, not on substance.
  const normaliseStack = (s) => (s || '').replace(/['"]/g, '').replace(/\s+/g, ' ').trim();

  it('[RED] mounting writes the layer\'s OWN body stack onto document.body', () => {
    applyBodyDefaults();
    const systemBefore = document.body.style.fontFamily;
    expect(systemBefore).toContain('-apple-system');

    const { container } = render(
      <ThemeProvider supplied={resolveBrandingTheme(beta)} pinnedMode="light"><div>x</div></ThemeProvider>
    );

    const layer = container.querySelector('[data-rm-theme]');
    expect(layer, 'the theme layer did not render').toBeTruthy();
    const mounted = layer.style.getPropertyValue(FONT_VARS.body);
    expect(mounted, 'the layer mounted no body font var').toBeTruthy();

    expect(normaliseStack(document.body.style.fontFamily)).toBe(normaliseStack(mounted));
    // ⚠ NON-VACUITY: the written value must actually DIFFER from what it
    // replaced, or this passes against a provider that writes nothing at all.
    expect(normaliseStack(document.body.style.fontFamily)).not.toBe(normaliseStack(systemBefore));
  });

  it('[RED] and an UNSET contractor gets the platform stack, not the system one', () => {
    applyBodyDefaults();
    render(<ThemeProvider supplied={resolveBrandingTheme(null)} pinnedMode="light"><div>x</div></ThemeProvider>);
    expect(document.body.style.fontFamily).toContain(FONT_DEFAULTS.body.split(',')[0].replace(/'/g, ''));
    expect(document.body.style.fontFamily).not.toContain('-apple-system');
  });

  it('[RED] unmounting RESTORES what was there — it does not clear', () => {
    // ⚠ SAME RULE THE BACKGROUND WRITE ALREADY FOLLOWS: another provider may sit
    // above this one (ResetPinScreen carries its own), and clearing would leave
    // the page with no family on the way back out.
    applyBodyDefaults();
    const before = document.body.style.fontFamily;
    const { unmount } = render(
      <ThemeProvider supplied={resolveBrandingTheme(beta)} pinnedMode="light"><div>x</div></ThemeProvider>
    );
    expect(document.body.style.fontFamily).not.toBe(before);
    unmount();
    expect(document.body.style.fontFamily).toBe(before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 — THE ADMIN TREE IS UNAFFECTED
// ⚠ IT RENDERS OUTSIDE ThemeProvider, SO NO PROVIDER WRITE REACHES IT. Measured
// in a browser before this change: 75 visible text nodes, and the only one on
// the system stack was <noscript>, which never renders for a real visitor.
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-16 — the admin surface keeps exactly what it had', () => {
  it('with no provider mounted, body keeps the former index.css stack', () => {
    applyBodyDefaults();
    expect(document.body.style.fontFamily).toContain('-apple-system');
    // No ThemeProvider is rendered in this case — that IS the admin condition.
    expect(document.body.style.fontFamily).not.toContain('Lato');
  });

  it('the admin tree declares its own family rather than inheriting one', () => {
    // ⚠ THE CLAIM IS ABOUT THE TREE, NOT ONE FILE. If admin components began
    // relying on an inherited family, this change would start to matter to them.
    const adminDir = path.join(SRC, 'components/admin');
    const files = fs.readdirSync(adminDir).filter((f) => /\.jsx$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(20);
    const declaring = files.filter((f) => /fontFamily/.test(fs.readFileSync(path.join(adminDir, f), 'utf8')));
    expect(declaring.length / files.length).toBeGreaterThan(0.9);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2b — B.7's OTHER FENCE, RE-RULED RATHER THAN DELETED
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-16 — Screen still declares the body role', () => {
  it('Screen declares fontVar(body), and the reason has changed', () => {
    // ⚠ THE FENCE SURVIVES; ITS RATIONALE DID NOT. B.7 justified it as "if Screen
    // stops declaring a family, all 13 inherit sites fall through to body, and
    // index.css sets that to a SYSTEM stack". Falling through to body is no
    // longer a downgrade inside the themed tree — the provider now puts the
    // contractor's face there. The fence is still worth keeping because Screen
    // is the only thing that carries the family to the 430px column's
    // descendants in the frame BEFORE the provider's effect runs.
    const screenSrc = fs.readFileSync(path.join(SRC, 'components/shared/Screen.jsx'), 'utf8');
    expect(screenSrc).toMatch(/fontFamily:\s*fontVar\('body'\)/);
  });
});
