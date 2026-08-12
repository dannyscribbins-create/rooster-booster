import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Explicit browser targets. Vite ignores the browserslist field in
    // package.json, so these must be stated here or the shipped bundle
    // silently targets newer browsers than CRA did. Roughly matches the
    // previous browserslist production query.
    target: ['es2020', 'chrome87', 'firefox78', 'safari14', 'edge88'],
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
    // Scope Vitest to the React suites only. Vitest's default include glob
    // scans the whole repo, which sweeps up server/test/*.test.js — those are
    // node:test files, so Vitest reports "No test suite found" for each AND
    // executes them on import, running DB-touching code inside test:react.
    // server/test is owned by test:server; these two runners must not overlap.
    include: ['src/**/*.test.{js,jsx}'],
    // --experimental-vm-modules is required by ONE test —
    // src/devServerPipeline.test.js — which links the dev server's own module
    // graph with vm.SourceTextModule to prove the app still mounts under the
    // pipeline `npm start` uses. That flag is a PROCESS flag: it cannot be set
    // from inside a test file, so it has to be declared here, for the pool.
    //
    // ⚠ TOP-LEVEL, NOT UNDER poolOptions. Vitest 4 removed `poolOptions` and
    // promoted its contents; nested here it is silently ignored apart from one
    // DEPRECATED line, and the test then fails with the misleading
    // "vm.SourceTextModule is not a constructor" rather than anything about the
    // flag.
    //
    // Cost is one ExperimentalWarning line per worker on stderr. The
    // alternative — spawning a flagged child process from the test — buys
    // nothing except indirection, since the flag would still have to be written
    // down somewhere.
    execArgv: ['--experimental-vm-modules'],
  },
});
