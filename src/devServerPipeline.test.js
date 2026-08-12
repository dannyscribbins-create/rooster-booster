// ─────────────────────────────────────────────────────────────────────────────
// DEV-SERVER PIPELINE SMOKE TEST
//
// WHAT THIS EXISTS FOR. This repo has three module pipelines and they do not
// agree with each other:
//
//   production build   rolldown + the commonjs plugin  → interops CJS source
//   Vitest             vite-node, Node-side resolution → interops CJS source
//   Vite dev server    no CJS interop for SOURCE files → DOES NOT
//
// Two of those three were covered by the gate. The third is the one a developer
// actually looks at, and it was uncovered — so `npm start` white-screened for
// six days (2026-08-04 → 2026-08-12) with lint, the server suite and the React
// suite all green the entire time.
//
// The bug: src/utils/brandingTheme.js and src/utils/themeTokens.js were
// CommonJS. Vite's dev server serves source files ESSENTIALLY VERBATIM — it does
// not rewrite `module.exports` into export statements the way the production
// build does — so the browser linked a module with ZERO exports and
// `import { resolveBrandingTheme } from '../../utils/brandingTheme'` failed AT
// LINK TIME, before a single line of application code ran. Hence a blank page
// rather than a partial render or a console error next to a rendered app.
//
// WHY src/App.test.jsx COULD NOT HAVE CAUGHT IT. App.test.jsx renders the entire
// application and passes. It runs under Vitest, which resolves that import
// through Node-side interop, so the CJS module hands back its exports and the
// render succeeds. A full-app render test is structurally incapable of catching
// a defect whose whole nature is "this pipeline links differently from that
// one" — you have to run the failing pipeline.
//
// HOW THIS TEST RUNS THE FAILING PIPELINE. It boots a real Vite dev server,
// fetches modules over HTTP exactly as a browser tab does, and links them with
// vm.SourceTextModule — the same ECMAScript module linking algorithm a browser
// implements, applied to the same bytes a browser would receive. A module that
// declares no exports fails to link here for precisely the reason it fails to
// link there. It then evaluates the graph against a jsdom document and asserts
// that #root actually has content, because "every module resolved" is a weaker
// claim than "the app mounted" and only the second one is what a white screen
// disproves.
//
// NO NEW DEPENDENCY. vite, jsdom and vitest are already devDependencies;
// node:vm is built in.
//
// ⚠ IF THIS TEST EVER FAILS, THE APP IS BROKEN IN THE BROWSER. It is not a
// linting nicety and it does not have a "close enough" mode. Read the failure
// message — a link-time SyntaxError names the module and the export that is
// missing, which is the whole diagnosis.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import vm from 'node:vm';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

// Booting Vite and letting it pre-bundle deps on a cold node_modules/.vite is
// the slow part, and it happens once. 120s is a CI allowance, not an
// expectation — a warm local run is a few seconds.
const BOOT_TIMEOUT_MS = 120_000;

let server;
let origin;

beforeAll(async () => {
  server = await createServer({
    // hmr:false keeps the client from opening a websocket back to a server this
    // test is about to close. Nothing here exercises HMR.
    //
    // port 0 lets the OS assign a free port, so this can never collide with a
    // dev server the developer already has running on 3000.
    server: { port: 0, hmr: false },
    logLevel: 'warn',
  });
  await server.listen();
  origin = `http://localhost:${server.httpServer.address().port}`;
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  if (server) await server.close();
});

/**
 * Links and evaluates the dev server's module graph from `entryUrl` inside a
 * jsdom window, returning that window.
 *
 * Modules are fetched over HTTP from the running dev server, so what gets linked
 * is byte-for-byte what a browser tab receives. Specifiers in that output are
 * already absolute dev-server URLs (Vite's import analysis rewrites them), so
 * resolution is just "fetch it", and the cache keyed on URL is what gives the
 * graph correct single-instantiation semantics.
 *
 * @param {string} entryUrl - dev-server path, e.g. '/src/index.jsx'.
 * @returns {Promise<Window>} the jsdom window after the graph has evaluated.
 * @throws {SyntaxError} at LINK time if any module fails to provide an export
 *         another module imports from it — the failure mode this file polices.
 */
async function mountViaDevServer(entryUrl) {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: origin, runScripts: 'outside-only', pretendToBeVisual: true }
  );

  // STUB THE HMR SOCKET, and nothing else about HMR. Vite's dev output imports
  // /@vite/client, which opens a websocket back to the server; under jsdom that
  // throws an unhandled ERR_INVALID_ARG_TYPE from undici before it can connect.
  // Neutralising the TRANSPORT is deliberately narrower than disabling HMR on the
  // server would be: every module still arrives with exactly the HMR wrapper a
  // browser receives, which is part of what is being linked here.
  dom.window.WebSocket = class {
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };

  const context = dom.getInternalVMContext();
  const cache = new Map();

  const resolve = (spec, fromUrl) => {
    const u = new URL(spec, origin + fromUrl);
    return u.pathname + u.search;
  };

  // INSTANTIATE THE WHOLE GRAPH FIRST, THEN LINK IT ONCE. Doing both in one
  // recursive pass looks simpler and is wrong: this graph has import cycles
  // (ThemeProvider ↔ the branding chain among them), so a recursive linker
  // re-enters a module whose own link() has not returned yet and vm rejects it
  // with "can not be resolved on module … that is not linked". Building every
  // module up front lets the linker itself be synchronous and total, which is
  // also how a browser does it.
  const instantiate = async (url) => {
    if (cache.has(url)) return;

    const res = await fetch(origin + url);
    if (!res.ok) throw new Error(`dev server returned ${res.status} for ${url}`);
    const code = await res.text();

    const mod = new vm.SourceTextModule(code, {
      identifier: url,
      context,
      initializeImportMeta(meta) {
        meta.url = origin + url;
        // The dev server's own resolved env, rather than a hand-written stand-in,
        // so a module reading import.meta.env.VITE_* sees what it sees in dev.
        meta.env = server.config.env;
      },
      importModuleDynamically: async (spec) => {
        const target = resolve(spec, url);
        await instantiate(target);
        const dep = cache.get(target);
        if (dep.status === 'unlinked') await dep.link(linker);
        if (dep.status === 'linked') await dep.evaluate();
        return dep;
      },
    });
    cache.set(url, mod);

    for (const spec of mod.dependencySpecifiers) {
      await instantiate(resolve(spec, url));
    }
  };

  function linker(spec, referencingModule) {
    const target = resolve(spec, referencingModule.identifier);
    const dep = cache.get(target);
    if (!dep) throw new Error(`${target} was never instantiated (imported by ${referencingModule.identifier})`);
    return dep;
  }

  await instantiate(entryUrl);
  const entry = cache.get(entryUrl);
  await entry.link(linker);
  await entry.evaluate();

  // WAIT FOR THE MOUNT, don't assume it. React 19's createRoot().render() SCHEDULES
  // work rather than performing it, so #root is legitimately empty for a tick or
  // two after evaluate() resolves. Polling to a deadline distinguishes "not
  // rendered yet" from "never renders" — a fixed sleep would either flake or hide
  // a real failure behind a long wait.
  const deadline = Date.now() + 10_000;
  const root = dom.window.document.getElementById('root');
  while (root.children.length === 0 && Date.now() < deadline) {
    await new Promise((resolve_) => setTimeout(resolve_, 25));
  }

  return dom.window;
}

describe('Vite dev-server pipeline (the one `npm start` uses)', () => {
  it(
    'links the whole src/ module graph and mounts the app into #root',
    async () => {
      const win = await mountViaDevServer('/src/index.jsx');
      const root = win.document.getElementById('root');

      // THE ASSERTION THAT MATTERS. A white screen is exactly "#root is empty",
      // and every weaker check — the module resolved, the request returned 200,
      // no exception was thrown — was true throughout the six days this was
      // broken.
      expect(root.children.length).toBeGreaterThan(0);
      expect(root.textContent.trim().length).toBeGreaterThan(0);
    },
    BOOT_TIMEOUT_MS
  );

  it(
    'serves every src/ module as an ES module with real export bindings',
    async () => {
      // A second, narrower net cast over the same graph. The mount test above
      // catches a CJS module the instant something imports a NAMED export from
      // it; this one catches a CJS module that has slipped into src/ but is not
      // yet imported that way — a default-only import, or a module reached only
      // by a code path the mount does not touch. Both are one refactor away from
      // becoming the white screen again.
      //
      // The tell is textual and unambiguous: Vite's dev output for a genuine ESM
      // source file never contains a top-level `module.exports =`, because
      // nothing in the dev pipeline emits one. Its presence means the file was
      // written as CommonJS and handed to the browser unconverted.
      const seen = new Set();
      const offenders = [];

      const walk = async (url) => {
        if (seen.has(url)) return;
        seen.add(url);

        const res = await fetch(origin + url);
        if (!res.ok) throw new Error(`dev server returned ${res.status} for ${url}`);
        const code = await res.text();

        if (url.startsWith('/src/') && /^\s*module\.exports\s*=/m.test(code)) {
          offenders.push(url);
        }

        // Only walk src/. Pre-bundled node_modules deps are Vite's own output
        // and ARE legitimately CJS-interoped by the dep optimizer — that half of
        // the pipeline works and is not what this guards.
        const specs = [...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]);
        for (const spec of specs) {
          const u = new URL(spec, origin + url);
          if (u.pathname.startsWith('/src/')) await walk(u.pathname + u.search);
        }
      };

      await walk('/src/index.jsx');

      expect(offenders,
        `These src/ modules are served to the browser as CommonJS by the dev server. ` +
        `Vite does not convert module.exports in SOURCE files, so any named import ` +
        `of one of these fails at LINK time and the page renders blank:\n  ` +
        `${offenders.join('\n  ')}\n` +
        `Convert them to ESM with a .mjs extension (see src/utils/brandingTheme.mjs).`
      ).toEqual([]);
    },
    BOOT_TIMEOUT_MS
  );
});
