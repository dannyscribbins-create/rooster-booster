'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SECTIONS } = require('../permissions/registry');
const { REGISTRY_SECTIONS } = require('../../src/constants/registrySections');

// ── REGISTRY MIRROR DRIFT GUARD ───────────────────────────────────────────────
// Ensures src/constants/registrySections.js stays in sync with
// server/permissions/registry.js.
//
// If this fails: update src/constants/registrySections.js to match the backend
// registry. Do NOT change this test or add phantom entries to the mirror.

describe('registry mirror drift guard', () => {
  it('src/constants/registrySections.js matches server/permissions/registry.js', () => {
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
        `Remove them from src/constants/registrySections.js.`
    );

    // 2 — mirror covers every backend key
    const missingKeys = SECTIONS
      .filter(s => !mirrorMap.has(s.key))
      .map(s => s.key);
    assert.deepEqual(
      missingKeys,
      [],
      `Backend registry contains keys absent from the mirror: [${missingKeys.join(', ')}]. ` +
        `Add them to src/constants/registrySections.js.`
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
        `Fix src/constants/registrySections.js.`
    );
    assert.deepEqual(
      flagMismatches,
      [],
      `Flag mismatches between backend and mirror:\n  ${flagMismatches.join('\n  ')}\n` +
        `Fix src/constants/registrySections.js.`
    );
    assert.deepEqual(
      forwardMismatches,
      [],
      `Forward-status mismatches:\n  ${forwardMismatches.join('\n  ')}\n` +
        `Fix src/constants/registrySections.js.`
    );
  });
});
