import reactHooks from 'eslint-plugin-react-hooks';

// Narrow, deliberate replacement for what react-scripts used to enforce.
//
// SCOPE FENCE: this config enables ONLY the two react-hooks rules. It does NOT
// extend any recommended preset. CRA's eslintConfig ("react-app") ran a much
// wider rule set, but the only part of it CLAUDE.md treats as a hard rule -- and
// the only part Vercel failed the build on via CI=true -- is exhaustive-deps.
// Under Vite, ESLint is not part of the build at all, so this file plus the
// lint step in the npm test gate is the entire safety net.
//
// Do not add a recommended preset here without a dedicated session. Doing so
// surfaces hundreds of pre-existing violations across src/ that have never been
// enforced, which is a cleanup project, not a lint config change.
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
];
