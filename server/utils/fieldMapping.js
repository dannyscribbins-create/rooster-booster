'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-1 — ONE PLACE THAT ANSWERS "WHICH CUSTOM FIELD DID THE CONTRACTOR CHOOSE?"
//
// ⚠ THE OLD ANSWER WAS A BARE LABEL, AND LABELS COLLIDE ON THE FIELD THAT DECIDES MONEY.
// Measured against Jobber 2026-05-12 on 2026-09-30, `accent-roofing-dev` has **27** custom field
// configurations and **three** named "Job Type":
//   · Dropdown/730114   ALL_JOBS      transferable   19 options  ← the one the engine reads
//   · Dropdown/730115   ALL_INVOICES                 19 options  (identical option list)
//   · Dropdown/1573072  ALL_QUOTES                    7 options  (a different vocabulary)
// "Insurance Company" appears four times and "OTHER" three. `WHERE label = $1 LIMIT 1` picks one of
// them by whatever order Postgres felt like.
//
// ⚠ AND THE COLLISION HAD ALREADY DONE DAMAGE BEFORE ANYONE LOOKED. Accent's active schedules were
// keyed on `New Construction` and `Restoration` — options of the QUOTE field — while the engine
// reads the JOB field, so the flagship escalating schedule could never fire. That is what a label
// buys you: a configuration screen and an engine that can disagree about which field they mean.
//
// THE NEW SHAPE, stored in `contractor_settings.contractor_field_mappings` (JSONB):
//   { "work_category": { "field_id": "<EncodedId>", "entity": "ALL_JOBS", "label": "Job Type" } }
// `label` is DISPLAY ONLY and is never matched on.
//
// ⚠ AND THE LEGACY STRING FORM MUST KEEP WORKING, WHICH IS WHY THIS IS A RESOLVER AND NOT A CAST.
// Any contractor other than Accent still holds `{"work_category": "Job Type"}`. A boot migration
// cannot safely convert those: resolving a bare label to one of several same-named configurations
// is precisely the ambiguity 7c-1 removes, so guessing during a migration would bake the coin-flip
// in rather than end it. An unmigrated contractor therefore resolves the OLD way — by label — and
// keeps exactly the behaviour it had, until an admin re-picks the field.
// ─────────────────────────────────────────────────────────────────────────────

const MAPPING_KEYS = ['work_category', 'job_source', 'material_type', 'assigned_rep'];

// The seven values Jobber's CustomFieldAppliesTo enum can take, read from the live schema at the
// pinned 2026-05-12 rather than assumed. ⚠ THERE IS NO REQUEST ENTITY — a custom field cannot be
// attached to a request, so nothing may offer one.
const ENTITIES = [
  'ALL_PROPERTIES', 'ALL_CLIENTS', 'ALL_QUOTES', 'ALL_JOBS', 'ALL_INVOICES',
  'ALL_PRODUCTS_AND_SERVICES', 'TEAM',
];

// Human wording for an admin screen. ⚠ Jobber's own labels are plural-collective ("ALL_JOBS"),
// which reads oddly next to a field name, so "Job Type (Job)" rather than "Job Type (All jobs)".
const ENTITY_LABELS = {
  ALL_PROPERTIES: 'Property',
  ALL_CLIENTS: 'Client',
  ALL_QUOTES: 'Quote',
  ALL_JOBS: 'Job',
  ALL_INVOICES: 'Invoice',
  ALL_PRODUCTS_AND_SERVICES: 'Product/Service',
  TEAM: 'Team',
};

/**
 * Normalise one mapping entry into a single shape. Inputs: whatever the JSONB holds for one key.
 * Output: `{ fieldId, entity, label, legacy }`, or null when nothing is configured.
 *
 * `legacy: true` means the stored value was a bare label and the caller must resolve it the old
 * way. ⚠ THE FLAG IS RETURNED RATHER THAN HIDDEN, so a caller can say "this mapping is ambiguous"
 * instead of silently behaving as though it were precise.
 */
function parseMappingEntry(value) {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return null;
    return { fieldId: null, entity: null, label, legacy: true };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const fieldId = typeof value.field_id === 'string' && value.field_id.trim()
      ? value.field_id.trim() : null;
    if (!fieldId) {
      // ⚠ AN OBJECT WITHOUT A field_id IS TREATED AS LEGACY, NOT AS CONFIGURED. Falling through to
      // the label is how a half-written mapping keeps resolving something instead of resolving
      // nothing, and "nothing" on this path means a contractor stops earning.
      const label = typeof value.label === 'string' ? value.label.trim() : '';
      return label ? { fieldId: null, entity: null, label, legacy: true } : null;
    }
    return {
      fieldId,
      entity: typeof value.entity === 'string' ? value.entity : null,
      label: typeof value.label === 'string' ? value.label : null,
      legacy: false,
    };
  }
  return null;
}

/**
 * Read one contractor's whole mapping. Inputs: a db/pool and the contractor id.
 * Output: an object keyed by MAPPING_KEYS whose values are parseMappingEntry results or null.
 *
 * ⚠ NEVER THROWS. Every caller of this is on a path where failing means a contractor silently
 * stops earning or gets no tags, so a settings read that fails degrades to "nothing configured"
 * and the caller's own default applies.
 */
async function readFieldMappings(db, contractorId) {
  const out = {};
  for (const k of MAPPING_KEYS) out[k] = null;
  try {
    const { rows } = await db.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const raw = rows[0]?.contractor_field_mappings || {};
    for (const k of MAPPING_KEYS) out[k] = parseMappingEntry(raw[k]);
  } catch {
    // deliberately silent here — the CALLER logs, because only the caller knows whether an absent
    // mapping is a degradation worth alerting on or the ordinary unconfigured case.
  }
  return out;
}

/**
 * Resolve a parsed mapping entry to the stored discovered field. Inputs: a db/pool, the contractor
 * id, and a parseMappingEntry result. Output: the `contractor_jobber_fields` row, or null.
 *
 * ⚠ BY ID WHEN WE HAVE ONE, BY LABEL ONLY AS THE LEGACY PATH — and the two are not interchangeable.
 * The id is unique per contractor by construction (`UNIQUE(contractor_id, jobber_field_id)`); the
 * label is not, which is the whole defect.
 */
async function resolveMappedField(db, contractorId, entry) {
  if (!entry) return null;
  if (entry.fieldId) {
    const { rows } = await db.query(
      `SELECT jobber_field_id, label, field_type, options, entity, transferable, archived
         FROM contractor_jobber_fields
        WHERE contractor_id = $1 AND jobber_field_id = $2`,
      [contractorId, entry.fieldId]
    );
    return rows[0] || null;
  }
  // ⚠ LEGACY. `LIMIT 1` over a non-unique label is exactly the coin-flip 7c-1 exists to remove, and
  // it is kept ONLY so an unmigrated contractor behaves as it did before rather than losing its
  // mapping. ORDER BY makes the flip deterministic instead of planner-dependent, which is the most
  // that can honestly be done without knowing which field was meant.
  const { rows } = await db.query(
    `SELECT jobber_field_id, label, field_type, options, entity, transferable, archived
       FROM contractor_jobber_fields
      WHERE contractor_id = $1 AND LOWER(BTRIM(label)) = LOWER(BTRIM($2))
      ORDER BY (archived IS NOT TRUE) DESC, jobber_field_id ASC
      LIMIT 1`,
    [contractorId, entry.label]
  );
  return rows[0] || null;
}

/** "Job Type (Job)" — a label an admin can tell apart from its same-named siblings. */
function describeField(field) {
  if (!field) return null;
  const ent = ENTITY_LABELS[field.entity] || null;
  const base = ent ? `${field.label} (${ent})` : field.label;
  return field.archived ? `${base} — archived in Jobber` : base;
}

module.exports = {
  MAPPING_KEYS, ENTITIES, ENTITY_LABELS,
  parseMappingEntry, readFieldMappings, resolveMappedField, describeField,
};
