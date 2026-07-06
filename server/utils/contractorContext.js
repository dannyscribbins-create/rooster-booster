'use strict';

const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

// Resolves the single-tenant contractor_id for MVP referrer routes by reading the
// contractors table directly, instead of a hardcoded literal that goes stale on rename
// (this is exactly what broke the referrer app on 2026-07-06: contractors.id was renamed
// to 'accent-roofing-dev' but referrer.js kept hardcoding the old 'accent-roofing' string).
//
// Deliberately fails closed the moment the table holds anything other than exactly one row.
// "MVP: single contractor" is the only case this function can answer safely — the tripwire
// throws everywhere the instant a second contractor row appears, forcing session-derived,
// per-request tenancy resolution to be built (CLAUDE.md: "before contractor #2") BEFORE any
// cross-tenant data exposure becomes possible.
//
// No caching/memoization: this is a tiny indexed read on every call, on purpose. A cached
// value would survive a future rename and silently reintroduce this exact bug class.
async function getDefaultContractorId() {
  const { rows } = await pool.query('SELECT id FROM contractors');
  if (rows.length !== 1) {
    const err = new Error(
      `getDefaultContractorId: expected exactly 1 contractor row, found ${rows.length} contractor rows. ` +
      'Refusing to guess which tenant this request belongs to — session-derived contractor ' +
      'resolution must be built before a second contractor exists.'
    );
    await logError({ error: err, source: 'getDefaultContractorId' });
    throw err;
  }
  return rows[0].id;
}

module.exports = { getDefaultContractorId };
