import reactHooks from 'eslint-plugin-react-hooks';

// Narrow, deliberate replacement for what react-scripts used to enforce.
//
// SCOPE FENCE: this config enables THREE rules -- the two react-hooks rules and
// no-undef. It does NOT extend any recommended preset. CRA's eslintConfig
// ("react-app") ran a much wider rule set, but the only part of it CLAUDE.md
// treats as a hard rule -- and the only part Vercel failed the build on via
// CI=true -- is exhaustive-deps. Under Vite, ESLint is not part of the build at
// all, so this file plus the lint step in the npm test gate is the entire safety
// net.
//
// ⚠ THIS COMMENT READ "enables ONLY the two react-hooks rules" UNTIL 2026-10-03,
// and that is now false rather than merely dated. no-undef was added as a SINGLE
// RULE, which is not the same act as adding a preset: it has a measured cost of
// zero (see the block below) where a preset has a measured cost of hundreds.
//
// Do not add a recommended preset here without a dedicated session. Doing so
// surfaces hundreds of pre-existing violations across src/ that have never been
// enforced, which is a cleanup project, not a lint config change.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY no-undef, AND WHY IT COULD NOT HAVE BEEN ADDED AS A BARE SWITCH
//
// It was added because it found a live defect. `CashOutTab.jsx` read `balance` --
// an identifier removed with its prop by payout-audit (3b) -- inside the amount
// step's preset buttons. In module scope an undeclared free variable THROWS, so
// that line raised `ReferenceError: balance is not defined` and the error boundary
// blanked the whole Cash Out tab for any referrer with a positive balance. A clean
// `npm run lint` shipped it, because no-undef was not in the gate. Seven test files
// mount that component and none could see it: every fixture seeded a non-positive
// balance, which is the one state that skips the branch.
//
// ⚠ AND THE RULE IS USELESS WITHOUT ITS GLOBALS, WHICH IS MEASURED RATHER THAN
// ASSUMED. Enabling it with NO globals declared reports **3274 violations across 37
// identifiers** -- and 36 of those identifiers are legitimate browser, Vitest or
// Node globals. Exactly ONE was a real defect. **The signal was one line inside
// that noise**, so the rule and its globals are one change or the rule gets turned
// off within a week.
//
// ⚠ WHY THE GLOBALS ARE DECLARED BY HAND AND NOT VIA THE `globals` PACKAGE: that
// package is not installed, and CLAUDE.md forbids adding a dependency for a job a
// few lines can do. Ruled by Danny 2026-10-03.
//
// ⚠ A HAND-MAINTAINED LIST USUALLY GOES STALE SILENTLY -- THIS ONE CANNOT, WHICH IS
// THE WHOLE REASON IT IS ACCEPTABLE HERE. This repo's recorded failure is the
// hand-maintained FILES list that reported clean while missing new files. A missing
// GLOBAL fails in the opposite direction: it flags legitimate code, loudly, on the
// first run. **To add one, add it below -- do not disable the rule and do not add a
// preset.**
// ─────────────────────────────────────────────────────────────────────────────

/** Globals the browser supplies on every surface this app renders on. */
const BROWSER_GLOBALS = [
  // DOM + document
  'document', 'window', 'navigator', 'location', 'history', 'getComputedStyle',
  'Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'DOMException', 'CSS', 'Image',
  // storage
  'localStorage', 'sessionStorage',
  // network + URLs
  'fetch', 'URL', 'URLSearchParams', 'FormData', 'AbortController', 'Blob', 'File', 'FileReader',
  // timers + scheduling
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  // observers + misc platform
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'matchMedia',
  'performance', 'crypto', 'structuredClone', 'TextDecoder', 'TextEncoder',
  'btoa', 'atob', 'alert', 'confirm', 'console',
];

/** Vitest injects these into every test file (`globals: true` in vite.config.mjs). */
const VITEST_GLOBALS = [
  'describe', 'it', 'test', 'expect', 'vi',
  'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
];

/**
 * Node globals a TEST file may legitimately read -- several read `process.env`, and a few use
 * `global` to install a fetch stub. ⚠ Deliberately NOT given to production files: a `process.env`
 * read in `src/` production code is a defect (Vite uses `import.meta.env.VITE_*`), and withholding
 * the global is what makes no-undef catch it.
 */
const NODE_GLOBALS_IN_TESTS = ['process', 'global', 'globalThis', '__dirname', '__filename', 'Buffer'];

const readonly = (names) => Object.fromEntries(names.map((n) => [n, 'readonly']));

export default [
  {
    // The 50 eslint-disable directives in src/ are stale only because
    // eslint-plugin-react-hooks v7 understands stable setState setters and refs
    // that the CRA-era v4 flagged. They are kept deliberately: they document
    // intent and re-arm if a future plugin version changes its analysis.
    // CLAUDE.md requires a disable comment above intentionally-omitted deps.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // no-undef over every source file under src/, with the browser globals declared.
    //
    // ⚠ `.mjs` IS INCLUDED HERE AND NOT IN THE BLOCK ABOVE, DELIBERATELY. The react-hooks glob is
    // left byte-identical so this commit cannot change what that rule sees. The five `.mjs` files
    // under `src/` are production code — `themeTokens.mjs` computes the six render tokens and
    // `brandingTheme.mjs` holds the platform defaults — and they were invisible to `eslint src`
    // because the only glob named `{js,jsx}`. **Measured before including them: 0 violations**, so
    // closing the gap is free rather than a cleanup project.
    files: ['src/**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: readonly(BROWSER_GLOBALS),
    },
    rules: { 'no-undef': 'error' },
  },
  {
    // Test files additionally see the Vitest globals and the few Node ones they legitimately read.
    // ⚠ Flat config MERGES `languageOptions.globals` across every matching entry, so this adds to
    // the browser set above rather than replacing it.
    files: ['src/**/*.test.{js,jsx,mjs}'],
    languageOptions: {
      globals: { ...readonly(VITEST_GLOBALS), ...readonly(NODE_GLOBALS_IN_TESTS) },
    },
  },
];
