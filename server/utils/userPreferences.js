'use strict';
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

// Shared user-level preference store (DECISION_C_DL_BUILD_SPEC.md CD-21).
//
// THIS MODULE IS THE ONLY PLACE THAT TOUCHES user_preferences. Callers never see
// raw SQL, and in particular never see which id column a subject type maps to —
// that routing is the whole reason this file exists. One store serves both the
// referrer/client app (users) and the team/admin/field-rep side (team_members).
//
// Subject types map to the two nullable FK columns. Anything else throws rather
// than defaulting, so a typo'd subjectType can never silently write to (or read
// from) the wrong column.
const SUBJECT_COLUMNS = {
  user: 'user_id',
  team_member: 'team_member_id',
};

// ── KNOWN PREFERENCE KEYS ────────────────────────────────────────────────────
// Named here rather than spelled as a literal at each call site, for the same
// reason STATUS_VARS names its custom properties in one place: pref_key is a bare
// TEXT column with no constraint, so a reader and a writer that disagree by one
// character produce NO ERROR ANYWHERE — the read simply returns null forever and
// the setting appears not to save.
//
// theme_mode holds 'light' or 'dark' (spec D8). Its READER shipped in C/DL-3b
// Phase 1 (GET /api/preferences/theme-mode); its WRITER is the 3c Profile toggle,
// which must use this same constant.
const THEME_MODE_PREF_KEY = 'theme_mode';

// team_access_revoked_seen holds `true` once a deactivated team member has been
// SHOWN the Ruling B notice at login (C/DL-3c Phase 2c). Subject is always
// 'team_member' — the frozen row — never the homeowner `users` row the session
// is actually minted for, which in the general case belongs to a different
// contractor entirely.
//
// ⚠ ITS WRITER AND ITS ERASER LIVE IN DIFFERENT FILES, WHICH IS THE WHOLE REASON
// IT IS NAMED HERE. POST /api/login writes it (server/routes/referrer.js); the
// reactivation transaction clears it (PATCH /api/admin/team/:id/reactivate in
// server/routes/admin/team.js). pref_key is a bare TEXT column with no
// constraint, so a writer and an eraser that disagree by one character produce
// NO ERROR ANYWHERE — the clear silently matches nothing, the flag survives
// reactivation, and a SECOND freeze is never announced. That is precisely the
// defect Ruling B exists to fix, reintroduced by a typo.
const TEAM_ACCESS_REVOKED_SEEN_PREF_KEY = 'team_access_revoked_seen';

// Resolves a subjectType to its column, or throws. Fail-closed by design —
// there is no sensible default subject type.
function resolveSubjectColumn(subjectType) {
  const column = SUBJECT_COLUMNS[subjectType];
  if (!column) {
    throw new Error(
      `userPreferences: unknown subjectType '${subjectType}' — expected 'user' or 'team_member'`
    );
  }
  return column;
}

// Reads one preference value.
// Inputs: subjectType ('user' | 'team_member'), subjectId, contractorId, key.
// Returns: the stored value (JSONB, already parsed by node-pg), or null if no row
// exists for this subject+key under this contractor.
//
// contractor_id is in the WHERE clause as a tenancy guard. That is belt-and-braces
// rather than strictly necessary (the subject id already implies its tenant), but it
// means a mis-routed contractorId reads nothing instead of another tenant's value.
//
// FAILS SOFT: on a DB error this logs and returns null, so a preference lookup can
// never take down the caller — the caller falls back to its own default, exactly as
// isEmailSuppressed() does. Note the consequence: a stored JSON null and "no row"
// and "DB error" are all indistinguishable to the caller. Do not store null as a
// meaningful preference value.
async function getPreference({ subjectType, subjectId, contractorId, key }) {
  try {
    const column = resolveSubjectColumn(subjectType);
    const { rows } = await pool.query(
      `SELECT pref_value FROM user_preferences
        WHERE ${column} = $1 AND contractor_id = $2 AND pref_key = $3`,
      [subjectId, contractorId, key]
    );
    if (rows.length === 0) return null;
    return rows[0].pref_value;
  } catch (err) {
    await logError({ req: null, error: err, source: 'getPreference' });
    return null;
  }
}

// Writes one preference value, creating it or overwriting the existing one.
// Inputs: subjectType ('user' | 'team_member'), subjectId, contractorId, key, value.
// Returns: the number of rows written — 1 on success, 0 when the tenancy
// predicate refused. ⚠ THIS USED TO RETURN NOTHING; it was given a return value
// in C/DL-3c Phase 1b, when the function acquired its first production caller.
// See the note at the query for why a caller must check it.
//
// RE-THROWS on failure (unlike getPreference). A silently-swallowed write would let
// a user save a setting, see no error, and find it reverted later — so callers must
// be able to surface it. logError still records it first.
async function setPreference({ subjectType, subjectId, contractorId, key, value }) {
  try {
    const column = resolveSubjectColumn(subjectType);

    // The ON CONFLICT target must repeat the partial index's WHERE predicate
    // verbatim — Postgres cannot infer a partial unique index without it. These
    // mirror user_preferences_user_key_unique / _team_member_key_unique in db.js.
    //
    // The DO UPDATE carries its own contractor_id predicate. The conflict target is
    // (subject, pref_key) and does NOT include contractor_id, so without this a call
    // with a mismatched contractorId would overwrite the existing row AND rewrite its
    // tenant. With it, a mis-tenanted write hits zero rows instead — the same
    // defense-in-depth shape as the cashout approve/deny UPDATE in admin/cashouts.js.
    const result = await pool.query(
      `INSERT INTO user_preferences (${column}, contractor_id, pref_key, pref_value)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (${column}, pref_key) WHERE ${column} IS NOT NULL
       DO UPDATE SET pref_value = EXCLUDED.pref_value, updated_at = NOW()
        WHERE user_preferences.contractor_id = $2`,
      [subjectId, contractorId, key, JSON.stringify(value)]
    );

    // ⚠ THE ROW COUNT IS THE RETURN VALUE, AND IT IS LOAD-BEARING (C/DL-3c
    // Phase 1b). When the DO UPDATE's tenancy predicate matches nothing,
    // Postgres RAISES NOTHING — the statement succeeds having changed no rows.
    // A caller that ignored this would report a saved preference to someone
    // whose preference was not saved, which is the same silent shape as the
    // ON CONFLICT DO NOTHING first-writer-wins race on the pre-launch checklist.
    //
    // 1 on an insert or a permitted update; 0 when the predicate blocked it.
    // ⚠ CALLERS MUST CHECK IT. The route that does is the only one there is —
    // PUT /api/preferences/theme-mode — and it answers 409 rather than 200.
    return result.rowCount;
  } catch (err) {
    await logError({ req: null, error: err, source: 'setPreference' });
    throw err;
  }
}

// Deletes one preference, so the next read is indistinguishable from never
// having been written. Returns the number of rows removed — 0 when there was
// nothing to clear, which is an ordinary state and not an error.
//
// ⚠ IT TAKES A `db`, AND THAT IS THE ENTIRE REASON THIS FUNCTION EXISTS RATHER
// THAN A DELETE AT THE CALL SITE. Its one caller is the reactivation handler,
// which must clear the key INSIDE the same transaction that sets
// `active = true` — so the statement has to run on that checked-out client, not
// on the pool. `getPreference`/`setPreference` are hardcoded to the pool and
// therefore cannot join a transaction; passing them a client was rejected as a
// wider change than this phase needs. If either ever acquires a transactional
// caller, give it the same parameter rather than duplicating the SQL.
//
// ⚠ AND IT RE-THROWS, UNLIKE getPreference. A swallowed failure here would let
// the transaction COMMIT with `active = true` and a stale seen key still
// present: reactivation would look successful and the member's NEXT freeze would
// be silent, which is the exact defect Ruling B exists to fix. The caller's
// ROLLBACK depends on this throw reaching it.
//
// The default of `pool` keeps every non-transactional caller unchanged; the
// tenancy predicate is the same defense-in-depth shape setPreference carries.
async function clearPreference({ db = pool, subjectType, subjectId, contractorId, key }) {
  try {
    const column = resolveSubjectColumn(subjectType);
    const result = await db.query(
      `DELETE FROM user_preferences
        WHERE ${column} = $1 AND contractor_id = $2 AND pref_key = $3`,
      [subjectId, contractorId, key]
    );
    return result.rowCount;
  } catch (err) {
    await logError({ req: null, error: err, source: 'clearPreference' });
    throw err;
  }
}

module.exports = {
  getPreference,
  setPreference,
  clearPreference,
  THEME_MODE_PREF_KEY,
  TEAM_ACCESS_REVOKED_SEEN_PREF_KEY,
};
