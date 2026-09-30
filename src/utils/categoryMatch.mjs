// ⚠ MIRROR. The CANONICAL copy is `server/utils/categoryMatch.js` — read the reasoning there, it is
// not repeated here on purpose. `server/test/categoryMatchMirror.test.js` fails if the two drift.
//
// The two intentional differences from the canonical copy are the ones every mirror in this repo
// carries: the module system (ESM here, CommonJS there) and no `'use strict'` (ESM is strict by
// definition). Nothing else may differ.
//
// It exists because the Schedule Builder's Step 2 must decide, for UNSAVED state as the admin
// toggles pills, whether a selected key matches a real option — so that comparison cannot come from
// the server. Every SAVED verdict does come from the server (`GET /api/admin/schedules` returns
// `unmatched_job_types` per schedule), which is what keeps one definition where it matters.

/** See the canonical copy. Blank becomes null, and null never matches anything. */
export function normalizeCategoryValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/** See the canonical copy. Trim- and case-insensitive; blank never matches. */
export function categoryValuesMatch(a, b) {
  const na = normalizeCategoryValue(a);
  if (na === null) return false;
  return na === normalizeCategoryValue(b);
}

/** See the canonical copy. */
export function categoryListIncludes(values, candidate) {
  if (!Array.isArray(values)) return false;
  const n = normalizeCategoryValue(candidate);
  if (n === null) return false;
  return values.some((v) => normalizeCategoryValue(v) === n);
}

/** See the canonical copy. An empty option list returns [], never every key. */
export function findUnmatchedCategoryKeys(keys, options) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  if (!Array.isArray(options) || options.length === 0) return [];
  const known = new Set();
  for (const o of options) {
    const n = normalizeCategoryValue(o);
    if (n !== null) known.add(n);
  }
  if (known.size === 0) return [];
  return keys.filter((k) => {
    const n = normalizeCategoryValue(k);
    return n !== null && !known.has(n);
  });
}
