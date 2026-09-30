'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-0 — ONE DEFINITION OF "DO THESE TWO CATEGORY VALUES MATCH?"
//
// A contractor's category field (Accent's JOB "Job Type") has a dropdown option list, and the
// admin picks which of those options qualify for each payout schedule. Three places compare a
// stored schedule key against an option or against a value on a CRM record, and before this
// module they compared it THREE DIFFERENT WAYS:
//
//   · `referralRules.js` — SQL `LOWER(jt.jobber_label)` against JS `jobType.toLowerCase()`:
//     case-insensitive, NEVER trimmed.
//   · `deriveJobberTags.js` — `f.label.toLowerCase() === label.toLowerCase()`: case-insensitive,
//     never trimmed, and on the LABEL rather than the value.
//   · `ScheduleBuilderDrawer.jsx` — `!allLabels.includes(l)`: EXACT, case-SENSITIVE, never trimmed.
//
// ⚠ AND JOBBER'S OWN OPTION STRINGS CARRY TRAILING SPACES. Measured on `accent-roofing-dev`
// 2026-09-30: of 19 options on the mapped job field, **two** are stored by Jobber with a trailing
// space — `'Skylight Install '` and `'Gutter Cleaning '`. So whitespace is not a hypothetical.
//
// ⚠ THE DEFECT IS SILENT AND IT IS MONEY. An untrimmed comparison that fails returns
// `no_matching_schedule_for_job_type`, and the caller acts only on `qualified` — no row, no flag,
// no alert, no email. A referrer is simply not paid, and nothing anywhere says so.
//
// ⚠ AND THE SAME LOOSENESS LIES IN THE OTHER DIRECTION IN THE UI. The drawer's exact-match
// `includes` flags a key as "not in Jobber fields" when the only difference is whitespace — a real
// option reported as missing. So one normaliser fixes a false negative in the engine AND a false
// positive in the admin panel; they are the same bug seen from two sides.
//
// ⚠ WHY TRIM AND CASE-FOLD, AND NOTHING MORE. It is tempting to go further — collapse interior
// whitespace, strip punctuation, fold accents. **No.** These strings are a contractor's own
// vocabulary, and two options that differ only in punctuation are two options they chose to
// distinguish. Normalising harder would silently merge them and pay the wrong schedule. Trim and
// case are safe because no CRM lets a user create two dropdown options differing only in leading
// or trailing space, or only in case — they would be indistinguishable in the CRM's own UI.
//
// MIRRORED TO `src/utils/categoryMatch.mjs` for the admin panel, following this repo's established
// server-canonical / src-mirrored arrangement (see `server/utils/brandingTheme.js` and its `.mjs`
// twin). ⚠ **THIS FILE IS THE CANONICAL ONE.** A drift fence asserts the two agree.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise one category value for comparison. Inputs: anything. Output: a trimmed, lowercased
 * string, or `null` when the value carries no information.
 *
 * ⚠ BLANK BECOMES null, AND null NEVER MATCHES ANYTHING — including another null. Two records
 * with no category set are not "the same category"; they are both unknown. Returning '' instead
 * would make every blank value match every other blank value and select a schedule on the strength
 * of two absences.
 */
function normalizeCategoryValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/**
 * Do two category values refer to the same option? Inputs: two raw strings. Output: boolean.
 * Trim- and case-insensitive; a blank or non-string on either side is never a match.
 */
function categoryValuesMatch(a, b) {
  const na = normalizeCategoryValue(a);
  if (na === null) return false;
  return na === normalizeCategoryValue(b);
}

/**
 * Does any value in `values` match `candidate`? Inputs: an array of raw strings and one raw
 * string. Output: boolean. This is the engine's schedule test.
 */
function categoryListIncludes(values, candidate) {
  if (!Array.isArray(values)) return false;
  const n = normalizeCategoryValue(candidate);
  if (n === null) return false;
  return values.some((v) => normalizeCategoryValue(v) === n);
}

/**
 * THE INVERSE GUARDRAIL, as one function so the engine's view and the admin panel's cannot drift.
 * Inputs: the schedule's qualifying keys, and the mapped field's option list. Output: the keys
 * that match NO option, returned in their ORIGINAL form so a message can quote what is stored.
 *
 * ⚠ AN EMPTY OR ABSENT OPTION LIST RETURNS AN EMPTY ARRAY, NOT EVERY KEY. With no options known —
 * Jobber never connected, discovery never run, or no field mapped — nothing is known about whether
 * a key is valid, and reporting all of them as broken would be a wall of false alarms on exactly
 * the setup where the admin can do least about it. **Unknown is not the same as wrong**, and a
 * guardrail that cries wolf on a fresh install is one somebody switches off.
 */
function findUnmatchedCategoryKeys(keys, options) {
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
    // ⚠ A key that normalises to null (blank, or not a string) is NOT reported as unmatched. It is
    // a different defect — a key that should never have been stored — and folding it in here would
    // make the message claim Jobber lost an option it never had.
    return n !== null && !known.has(n);
  });
}

module.exports = {
  normalizeCategoryValue,
  categoryValuesMatch,
  categoryListIncludes,
  findUnmatchedCategoryKeys,
};
