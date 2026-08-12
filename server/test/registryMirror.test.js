'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SECTIONS } = require('../permissions/registry');

// ── REGISTRY MIRROR DRIFT GUARD ───────────────────────────────────────────────
// Ensures src/constants/registrySections.mjs stays in sync with
// server/permissions/registry.js.
//
// If this fails: update src/constants/registrySections.mjs to match the backend
// registry. Do NOT change this test or add phantom entries to the mirror.
//
// ⚠ `await import()` INSIDE THE TEST, not a top-level require — CHANGED AT THE
// VITE DEV PIPELINE FIX. The mirror was CommonJS so that a require() here could
// read it, and that shape is what white-screened `npm start`: Vite's dev server
// serves source files verbatim, so `module.exports =` reached the browser as a
// module with zero exports and AdminTeamSettings.jsx's named import of it failed
// at LINK time — which, because App.jsx imports AdminApp statically, blanked the
// whole app rather than just the admin panel. The mirror is ESM (.mjs) now, so
// this guard reads the exact artefact the browser links.

describe('registry mirror drift guard', () => {
  it('src/constants/registrySections.mjs matches server/permissions/registry.js', async () => {
    const { REGISTRY_SECTIONS } = await import('../../src/constants/registrySections.mjs');

    const backendMap = new Map(SECTIONS.map(s => [s.key, s]));
    const mirrorMap  = new Map(REGISTRY_SECTIONS.map(s => [s.key, s]));

    // 1 — no phantom keys in the mirror
    const phantomKeys = REGISTRY_SECTIONS
      .filter(s => !backendMap.has(s.key))
      .map(s => s.key);
    assert.deepEqual(
      phantomKeys,
      [],
      `Mirror contains keys absent from the backend registry: [${phantomKeys.join(', ')}]. ` +
        `Remove them from src/constants/registrySections.mjs.`
    );

    // 2 — mirror covers every backend key
    const missingKeys = SECTIONS
      .filter(s => !mirrorMap.has(s.key))
      .map(s => s.key);
    assert.deepEqual(
      missingKeys,
      [],
      `Backend registry contains keys absent from the mirror: [${missingKeys.join(', ')}]. ` +
        `Add them to src/constants/registrySections.mjs.`
    );

    // 3 — type, flags, and forward status must match for every shared key
    const typeMismatches    = [];
    const flagMismatches    = [];
    const forwardMismatches = [];

    for (const bs of SECTIONS) {
      const ms = mirrorMap.get(bs.key);
      if (!ms) continue; // already caught above

      if (ms.type !== bs.type) {
        typeMismatches.push(`${bs.key}: backend='${bs.type}' mirror='${ms.type}'`);
      }

      // Compare each flag value individually — avoids key-order sensitivity in JSON.stringify.
      for (const [role, flag] of Object.entries(bs.flags)) {
        if (ms.flags[role] !== flag) {
          flagMismatches.push(`${bs.key}.flags.${role}: backend='${flag}' mirror='${ms.flags[role]}'`);
        }
      }
      for (const role of Object.keys(ms.flags)) {
        if (!(role in bs.flags)) {
          flagMismatches.push(`${bs.key}.flags.${role}: in mirror but absent from backend`);
        }
      }

      if (!!ms.forward !== !!bs.forward) {
        forwardMismatches.push(
          `${bs.key}: backend.forward=${bs.forward} mirror.forward=${ms.forward}`
        );
      }
    }

    assert.deepEqual(
      typeMismatches,
      [],
      `Type mismatches between backend and mirror:\n  ${typeMismatches.join('\n  ')}\n` +
        `Fix src/constants/registrySections.mjs.`
    );
    assert.deepEqual(
      flagMismatches,
      [],
      `Flag mismatches between backend and mirror:\n  ${flagMismatches.join('\n  ')}\n` +
        `Fix src/constants/registrySections.mjs.`
    );
    assert.deepEqual(
      forwardMismatches,
      [],
      `Forward-status mismatches:\n  ${forwardMismatches.join('\n  ')}\n` +
        `Fix src/constants/registrySections.mjs.`
    );
  });
});
