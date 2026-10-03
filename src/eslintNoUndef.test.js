// ─────────────────────────────────────────────────────────────────────────────
// THE `no-undef` RULE IS ON, AND ITS GLOBALS ARE RIGHT IN BOTH DIRECTIONS
//
// Added with the rule itself (post-N4 cleanup B). `npm run lint` is the FIRST step of `npm test`,
// chained with `&&`, so a violation blocks the gate before either suite runs.
//
// ⚠ WHY A TEST FOR A LINT CONFIG AT ALL: because the rule has two failure modes and they are
// opposite, and a clean `npm run lint` is evidence against only one of them.
//   · TOO WEAK — the rule off, or a global declared that should not be, and a real
//     `ReferenceError` ships. That is exactly what happened: `CashOutTab.jsx` read `balance`, an
//     identifier removed with its prop by payout-audit (3b), and a clean lint shipped it.
//   · TOO STRONG — a missing global, so the rule flags legitimate code. **That is the one that gets
//     the rule deleted**, and this repo records it as the fate of any check that reports plausible
//     findings. A clean lint today cannot distinguish "the globals are complete" from "nobody has
//     used `Blob` yet".
// So every case below drives the REAL config on SYNTHETIC source, in both directions.
//
// ⚠ IT IMPORTS `eslint.config.mjs` RATHER THAN RESTATING IT. A retyped copy carrying the rule would
// pass while the shipped config had it switched off — this repo's `$3` lesson, where a suite drove a
// retyped SQL statement and production could have been broken with every case green.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import config from '../eslint.config.mjs';

const linter = new Linter();

/** Lint synthetic source through the REAL config, as if it were the given filename. */
function lint(code, filename) {
  return linter.verify(code, config, filename);
}

/** Just the no-undef messages, so an unrelated rule cannot satisfy or break a case. */
function undefMessages(code, filename) {
  return lint(code, filename).filter((m) => m.ruleId === 'no-undef').map((m) => m.message);
}

const PROD = 'src/components/referrer/Synthetic.jsx';
const TEST = 'src/components/referrer/Synthetic.test.jsx';

describe('cleanup B — no-undef is enabled for src/', () => {
  it('CATCHES an undefined identifier in production code, naming it', () => {
    // ⚠ THE SHAPE OF THE REAL DEFECT, NOT A SPELLING OF IT. `balance` is the identifier
    // `CashOutTab.jsx` actually read after payout-audit (3b) removed the prop.
    const msgs = undefMessages('const x = balance + 1; export default x;', PROD);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/'balance' is not defined/);
  });

  it('and it is enabled by the CONFIG rather than by a default', () => {
    // Without this, the case above would also pass if some other config layer happened to turn the
    // rule on — and the property is that THIS file does it.
    const entries = config.filter((c) => c?.rules && 'no-undef' in c.rules);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((c) => c.rules['no-undef'] === 'error')).toBe(true);
  });

  it('⚠ and NO recommended preset has crept in — the standing scope fence', () => {
    // CLAUDE.md: never add a recommended preset to this config. A preset arrives as `extends` or as
    // a large rules object, and either would make the "three rules" claim in the config header false.
    const allRules = config.flatMap((c) => Object.keys(c?.rules || {}));
    expect(new Set(allRules)).toEqual(new Set([
      'react-hooks/rules-of-hooks',
      'react-hooks/exhaustive-deps',
      'no-undef',
    ]));
    expect(config.some((c) => 'extends' in (c || {}))).toBe(false);
  });
});

describe('cleanup B — the globals are complete enough not to flag real code', () => {
  // ⚠ THIS IS THE DIRECTION THAT KEEPS THE RULE ALIVE. Each of these is a global the browser or the
  // test runner genuinely supplies; flagging any of them would be a false positive, and a lint rule
  // that reports plausible findings gets switched off within a week.
  const BROWSER_SAMPLE = [
    'document.title', 'window.innerWidth', 'navigator.userAgent', 'localStorage.getItem("k")',
    'sessionStorage.getItem("k")', 'fetch("/x")', 'new URL("https://x.test")',
    'new URLSearchParams("a=1")', 'new FormData()', 'new AbortController()',
    'setTimeout(() => {}, 1)', 'clearTimeout(1)', 'setInterval(() => {}, 1)', 'clearInterval(1)',
    'requestAnimationFrame(() => {})', 'getComputedStyle(document.body)', 'console.log("x")',
    'new Blob([])', 'new FileReader()', 'btoa("x")', 'structuredClone({})', 'performance.now()',
    'matchMedia("(min-width: 1px)")', 'CSS.escape("x")', 'new Image()',
  ];

  for (const expr of BROWSER_SAMPLE) {
    it(`spares the browser global in: ${expr}`, () => {
      expect(undefMessages(`export default (() => { ${expr}; })();`, PROD)).toEqual([]);
    });
  }

  it('spares the Vitest globals in a .test. file', () => {
    const code = 'describe("d", () => { it("i", () => { expect(vi.fn()).toBeTruthy(); }); });';
    expect(undefMessages(code, TEST)).toEqual([]);
  });

  it('PAIRED NEGATIVE: the Vitest globals are NOT granted to production code', () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE WOULD PASS AGAINST A CONFIG THAT GAVE EVERY FILE EVERY GLOBAL —
    // which is the "too strong is bad, too weak is worse" direction. A stray `describe(` left in a
    // shipped component is a real defect, and this is what catches it.
    const msgs = undefMessages('describe("d", () => {});', PROD);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/'describe' is not defined/);
  });
});

describe('cleanup B — no-undef now enforces the Vite env rule, which nothing enforced before', () => {
  it('a `process.env` read in PRODUCTION code is a violation', () => {
    // ⚠ A CLAUDE.md RULE GAINS A MECHANISM HERE: "Frontend env vars are `import.meta.env.VITE_*`,
    // never `process.env.REACT_APP_*`." That was prose with nothing checking it. Withholding the
    // `process` global from production files is what turns it into a lint error.
    // Measured when the rule landed: 0 such reads exist in non-test `src/`, so this starts green.
    const msgs = undefMessages('export default process.env.VITE_X;', PROD);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/'process' is not defined/);
  });

  it('but a TEST file may read process.env, which several legitimately do', () => {
    expect(undefMessages('export default process.env.VITE_X;', TEST)).toEqual([]);
  });

  it('and `import.meta.env` — the sanctioned form — is never flagged', () => {
    expect(undefMessages('export default import.meta.env.DEV;', PROD)).toEqual([]);
  });
});

describe('cleanup B — the .mjs gap is closed', () => {
  it('a `.mjs` file under src/ is linted, where the old glob saw only js/jsx', () => {
    // ⚠ FIVE `.mjs` FILES UNDER `src/` ARE PRODUCTION CODE — `themeTokens.mjs` computes the six
    // render tokens, `brandingTheme.mjs` holds the platform defaults — and `eslint src` could not see
    // them because the only glob named `{js,jsx}`. Measured at 0 violations before including them.
    const msgs = undefMessages('export default notDeclaredAnywhere;', 'src/utils/synthetic.mjs');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/'notDeclaredAnywhere' is not defined/);
  });
});
