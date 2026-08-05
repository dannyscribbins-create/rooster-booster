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
  },
});
