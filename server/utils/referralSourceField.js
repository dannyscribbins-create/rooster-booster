'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT B — ONE PLACE THAT ANSWERS "WHICH FIELD NAMES THE REFERRER, AND WHAT DOES IT SAY?"
//
// ⚠ THE SETTING HAD STORAGE AND AN EDITOR AND NO DELIVERY. `contractor_crm_settings.referrer_field_name`
// has been stored, edited, PATCHed and returned in the adapter config since the single-tenant era —
// and read by NOTHING. Both extraction sites matched a hardcoded literal:
// `f.label.toLowerCase() === 'referred by'`. Measured 2026-10-01: the only consumer of
// `referrerFieldName` anywhere in `server/` or `src/` was the admin screen reading it back into its own
// text box. **So a contractor who typed anything else had a setting that was accepted, echoed back and
// inert — silently, on the field that decides who gets paid.** That is CLAUDE.md's five-states
// category (d), delivery, which is invisible to a check built from the schema and the admin panel
// because both halves look finished.
//
// ⚠ NO LIVE DAMAGE, AND THAT WAS LUCK RATHER THAN DESIGN: exactly one row existed and it held the
// default, which happens to equal the literal.
//
// ⚠ A LABEL CANNOT NAME A FIELD, AND ON THIS TENANT IT COLLIDES ON THE CLIENT ENTITY TOO. Accent has
// NINE `ALL_CLIENTS` configurations, and among them:
//   · `Referred by`               — Text, LIVE      ← the one that is meant
//   · `Referred by Chuck Rigdon`  — Text, ARCHIVED  ← a PREFIX/substring match returns this as well
//   · `Source`                    — Text, archived  ┐ two live/archived rows sharing one label, which
//   · `Source`                    — Dropdown, LIVE  ┘ is why the id is the identity and not the name
// **So the match is EXACT and normalised (trim + case-fold + collapsed whitespace) and never a prefix,
// a substring or an ILIKE.** A `%referred by%` match would admit the archived Chuck Rigdon field and
// read a referrer out of a field nobody filled this decade.
//
// ⚠ THE RESOLUTION IS BY CONFIGURATION ID, AND THE DISCOVERED ROW IS ONLY FOR DISPLAY. Matching uses
// the STORED id against the record's own `customFieldConfiguration.id`, which works whether or not
// `contractor_jobber_fields` still has a row for it — discovery lagging is not the same as the field
// being gone. The row is read to say "archived" or "missing" on the settings screen, never to decide
// the match. Getting that backwards would make a stale discovery table stop a contractor earning.
//
// ⚠ AND THE FALLBACK IS THE STORED SETTING, NOT THE OLD LITERAL (Danny, 2026-10-01). A contractor with
// no picked field resolves by the EXACT normalised `referrer_field_name`, which defaults to
// 'Referred by' — so anyone who never changed it, Accent included, sees no change at all. This is the
// same reasoning CLAUDE.md records for 7c-0 keeping `|| 'Job Type'`: two readers must resolve the same
// field for an unmapped contractor, or their tags and their payouts disagree.
// ─────────────────────────────────────────────────────────────────────────────

const { parseMappingEntry, resolveMappedField, describeField, ENTITY_LABELS } = require('./fieldMapping');

/** The entity a referral-source field must belong to. There is no request entity; this is a client. */
const REFERRAL_SOURCE_ENTITY = 'ALL_CLIENTS';

/** The platform default, and the value the column defaults to. */
const DEFAULT_REFERRER_FIELD_LABEL = 'Referred by';

/**
 * Normalise a custom-field label for comparison. Inputs: anything. Output: a string.
 *
 * ⚠ TRIM + COLLAPSE + CASE-FOLD, AND NOTHING ELSE. It must never become a loose match: two of
 * Accent's live client labels differ only by a trailing phrase, and CLAUDE.md records two live Jobber
 * option values carrying a TRAILING SPACE, so collapsing interior whitespace is load-bearing rather
 * than cosmetic. ⚠ `\s` here is JavaScript's class and is correct; the `[[:space:]]` rule in
 * `.claude/rules/backend.md` governs Postgres, where `\s` matches the literal letter s.
 */
function normaliseFieldLabel(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Which field names the referrer for this contractor.
 * Inputs: a db/pool and the contractor id. Output:
 *   { fieldId, entity, label, archived, missing, legacy, displayLabel }
 *
 * `fieldId` null means nothing is picked and the caller matches by `label`.
 * `missing` means a field IS picked and discovery has no row for it — a warning, never a refusal.
 *
 * ⚠ IT NEVER THROWS ON A SETTINGS READ. Every caller is on a path where failing means a contractor
 * silently stops earning, so an unreadable settings row degrades to the platform default label — the
 * behaviour that was in place before this module existed.
 */
async function resolveReferralSourceField(db, contractorId) {
  if (!contractorId) throw new Error('resolveReferralSourceField: contractorId is required');

  let row = null;
  try {
    const { rows } = await db.query(
      `SELECT referrer_field_id, referrer_field_entity, referrer_field_label, referrer_field_name
         FROM contractor_crm_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    row = rows[0] || null;
  } catch {
    // deliberately silent HERE — the caller logs, because only the caller knows whether an absent
    // settings row is a degradation worth alerting on or the ordinary unconfigured case.
    row = null;
  }

  // ⚠ BOTH FORMS GO THROUGH `parseMappingEntry`, which is the one place that knows what "configured"
  // means. The object form is built from the three stored columns; the legacy form is the bare label.
  const entry = row && row.referrer_field_id
    ? parseMappingEntry({
      field_id: row.referrer_field_id,
      entity: row.referrer_field_entity,
      label: row.referrer_field_label,
    })
    : parseMappingEntry(row?.referrer_field_name || DEFAULT_REFERRER_FIELD_LABEL);

  const resolved = {
    fieldId: entry?.fieldId || null,
    entity: entry?.entity || null,
    label: entry?.label || DEFAULT_REFERRER_FIELD_LABEL,
    archived: false,
    missing: false,
    legacy: !entry?.fieldId,
    displayLabel: null,
  };

  if (resolved.fieldId) {
    // ⚠ FOR DISPLAY AND FOR THE WARNING, NOT FOR THE MATCH. See the header: a lagging discovery table
    // must not stop a picked field resolving.
    let discovered = null;
    try {
      discovered = await resolveMappedField(db, contractorId, entry);
    } catch {
      discovered = null;
    }
    if (discovered) {
      resolved.entity = discovered.entity || resolved.entity;
      resolved.label = discovered.label || resolved.label;
      resolved.archived = discovered.archived === true;
      resolved.displayLabel = describeField(discovered);
    } else {
      resolved.missing = true;
      resolved.displayLabel = resolved.label
        ? `${resolved.label} — no longer found in ${ENTITY_LABELS[REFERRAL_SOURCE_ENTITY] || 'the CRM'}`
        : null;
    }
  } else {
    resolved.displayLabel = resolved.label;
  }

  return resolved;
}

/**
 * Read the referrer value off one record's custom fields.
 * Inputs: the record's `customFields` array, and a `resolveReferralSourceField` result.
 * Output: the trimmed string value, or null.
 *
 * ⚠ EXACT MATCH, BY ID WHEN THERE IS ONE. Never a prefix, a substring or an ILIKE — see the header for
 * the two live labels that make that a correctness requirement rather than a preference.
 *
 * ⚠ IT THROWS WHEN THE CALLER'S QUERY CANNOT ANSWER THE QUESTION, AND THAT IS DELIBERATE. If a field
 * is picked by id and the record carries custom fields of which NOT ONE has a
 * `customFieldConfiguration`, the caller selected the old narrow shape — and returning null there
 * would mean "this client was not referred", which stops a payout silently. That is precisely the
 * failure class Commit A closed (a writer reading a field no query selects), so this one is made LOUD
 * instead. An EMPTY array is a different thing and is a legitimate answer: nothing to match.
 */
function readReferredByValue(customFields, resolved) {
  const fields = Array.isArray(customFields) ? customFields : [];
  if (!resolved) return null;
  if (fields.length === 0) return null;

  let field = null;
  if (resolved.fieldId) {
    const anyConfigured = fields.some((f) => f && f.customFieldConfiguration);
    if (!anyConfigured) {
      throw new Error(
        'readReferredByValue: a field is mapped by configuration id, but no custom field on this '
        + 'record carries customFieldConfiguration — the caller\'s query is missing that selection. '
        + 'Returning null here would read as "not referred" and silently stop a payout.'
      );
    }
    field = fields.find((f) => f && f.customFieldConfiguration
      && f.customFieldConfiguration.id === resolved.fieldId) || null;
  } else {
    const wanted = normaliseFieldLabel(resolved.label);
    if (!wanted) return null;
    field = fields.find((f) => f && normaliseFieldLabel(f.label) === wanted) || null;
  }

  if (!field) return null;
  // ⚠ `??` SO A BLANK SURVIVES AS A BLANK rather than falling through to the other shape. A dropdown
  // and a text field are different answers and a cleared field is not an absent one.
  const raw = field.valueText ?? field.valueDropdown ?? null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

module.exports = {
  REFERRAL_SOURCE_ENTITY,
  DEFAULT_REFERRER_FIELD_LABEL,
  normaliseFieldLabel,
  resolveReferralSourceField,
  readReferredByValue,
};
